import React, { useState, useRef, useEffect } from "react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Glow ring state
  const [mouse, setMouse] = useState({ x: 0, y: 0, inside: false });
  const svgRef = useRef();

  // Size and position constants
  const SVG_SIZE = 600;
  const CENTER = SVG_SIZE / 2;
  const OUTER_RADIUS = 230;
  const RING_WIDTH = 30; // px
  const INNER_RADIUS = OUTER_RADIUS - RING_WIDTH;
  const GLOW_WIDTH_DEG = 44;
  const GLOW_MAX_OPACITY = 0.65;

  // Track mouse over SVG (even under content column)
  useEffect(() => {
    function handleMove(e) {
      // Get bounding rect of svg
      const rect = svgRef.current.getBoundingClientRect();
      let x, y;
      if (e.touches && e.touches.length > 0) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
      } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      }
      setMouse((m) => ({ ...m, x, y, inside: true }));
    }
    function handleLeave() {
      setMouse((m) => ({ ...m, inside: false }));
    }

    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener("mousemove", handleMove);
      svg.addEventListener("mouseleave", handleLeave);
      svg.addEventListener("touchmove", handleMove);
      svg.addEventListener("touchend", handleLeave);
    }
    return () => {
      if (svg) {
        svg.removeEventListener("mousemove", handleMove);
        svg.removeEventListener("mouseleave", handleLeave);
        svg.removeEventListener("touchmove", handleMove);
        svg.removeEventListener("touchend", handleLeave);
      }
    };
  }, []);

  // Calculate the nearest angle and glow intensity
  let glow = null;
  if (mouse.inside && svgRef.current) {
    const dx = mouse.x - CENTER;
    const dy = mouse.y - CENTER;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (angle < 0) angle += 360;

    const ringDist = Math.abs(dist - (OUTER_RADIUS - RING_WIDTH / 2));
    const intensity = Math.max(0, 1 - ringDist / 50);

    if (intensity > 0.05) {
      glow = { angle, opacity: intensity * GLOW_MAX_OPACITY };
    }
  }

  // SVG "donut wedge" for the glow (full ring width)
  function arcGlowPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
    // convert degrees to radians
    const rad = (deg) => (deg * Math.PI) / 180;
    // Outer arc
    const startOuter = {
      x: cx + rOuter * Math.sin(rad(startAngle)),
      y: cy - rOuter * Math.cos(rad(startAngle)),
    };
    const endOuter = {
      x: cx + rOuter * Math.sin(rad(endAngle)),
      y: cy - rOuter * Math.cos(rad(endAngle)),
    };
    // Inner arc (reverse direction)
    const startInner = {
      x: cx + rInner * Math.sin(rad(endAngle)),
      y: cy - rInner * Math.cos(rad(endAngle)),
    };
    const endInner = {
      x: cx + rInner * Math.sin(rad(startAngle)),
      y: cy - rInner * Math.cos(rad(startAngle)),
    };
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
      "Z",
    ].join(" ");
  }

  // Firebase login for email/password
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
      const auth = getAuth();
      const result = await signInWithEmailAndPassword(auth, email, password);
      onLogin(result.user);
    } catch (err) {
      setError("Invalid email or password.");
      setLoading(false);
    }
  };

  // Google sign-in
  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const { getAuth, GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      onLogin(result.user);
    } catch (err) {
      setError("Google sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-black to-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Interactive Scan Ring (full-screen, under content column) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center select-none"
        style={{ touchAction: "none" }}
      >
        <svg
          ref={svgRef}
          width={SVG_SIZE}
          height={SVG_SIZE}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          className="block max-w-[90vw] max-h-[90vh]"
        >
          {/* Outer subtle ring */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_RADIUS}
            stroke="#38bdf8"
            strokeWidth="3"
            opacity="0.11"
            fill="none"
          />
          {/* Inner subtle ring */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_RADIUS - 25}
            stroke="#f1f5f9"
            strokeWidth="2"
            opacity="0.07"
            fill="none"
          />
          {/* Dynamic Glow Donut Wedge */}
          {glow && (
            <path
              d={arcGlowPath(
                CENTER,
                CENTER,
                OUTER_RADIUS,
                INNER_RADIUS,
                glow.angle - GLOW_WIDTH_DEG / 2,
                glow.angle + GLOW_WIDTH_DEG / 2
              )}
              fill="url(#glowGradient)"
              opacity={glow.opacity}
              style={{
                filter: "blur(8px) drop-shadow(0 0 28px #38bdf8cc)",
                transition: "opacity 0.1s",
              }}
            />
          )}
          {/* Gradient for glow */}
          <defs>
            <radialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
              <stop offset="90%" stopColor="#38bdf8" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Login Content (always above scan ring) */}
      <div className="mb-10 flex flex-col items-center z-10">
        <div className="relative mb-2">
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-28 h-28 rounded-full bg-gradient-to-tr from-blue-300 via-cyan-200 to-blue-800 opacity-15 animate-ping"></span>
          </span>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 border-4 border-cyan-400 flex items-center justify-center shadow-lg relative z-10">
            <span className="text-3xl font-extrabold tracking-wide bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent select-none">
              V
            </span>
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-wider bg-gradient-to-r from-blue-300 to-cyan-400 bg-clip-text text-transparent mt-2">
          VISTA
        </h1>
        <div className="text-slate-400 text-sm font-medium mt-1 mb-2 text-center">
          Vision Integrated Scan & Treatment Assistant
        </div>
      </div>

      {/* Login Card */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl shadow-2xl bg-slate-900 bg-opacity-80 border border-slate-800 p-8 flex flex-col z-10"
      >
        <h2 className="text-xl font-bold text-cyan-300 mb-6 text-center">
          Sign in to your account
        </h2>
        <label className="text-slate-300 font-medium mb-1">Email</label>
        <input
          type="email"
          autoFocus
          className="mb-4 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
        <label className="text-slate-300 font-medium mb-1">Password</label>
        <input
          type="password"
          className="mb-4 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />

        {error && (
          <div className="text-red-400 text-sm mb-4 text-center">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 mt-2 mb-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 font-bold text-white shadow-lg hover:scale-105 transition-all disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </button>

        {/* Google Auth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-3 mb-1 rounded-xl bg-white text-slate-800 font-bold shadow-md hover:bg-slate-100 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48">
            <g>
              <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.7 32.4 30.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 6 .9 8.2 2.7l6.1-6.1C34.3 6.3 29.5 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.3-.1-2.7-.4-4z"/>
              <path fill="#34A853" d="M6.3 14.8l7 5.1C15.4 17.1 19.4 14.5 24 14.5c3.1 0 6 .9 8.2 2.7l6.1-6.1C34.3 6.3 29.5 4.5 24 4.5c-6.6 0-12 5.4-12 12 0 1.4.2 2.7.3 4.3z"/>
              <path fill="#FBBC05" d="M24 44.5c5.2 0 10-1.8 13.7-4.9l-6.3-5.2c-2.2 1.5-5.2 2.6-7.4 2.6-6.2 0-11.4-4.2-13.3-10H6.3C8.9 38 15.8 44.5 24 44.5z"/>
              <path fill="#EA4335" d="M44.5 25c0-1.3-.1-2.7-.4-4H24v8.5h11.7c-1.1 3-4.1 6.1-11.7 6.1-6.2 0-11.4-4.2-13.3-10H6.3C8.9 38 15.8 44.5 24 44.5c5.2 0 10-1.8 13.7-4.9l-6.3-5.2z"/>
            </g>
          </svg>
          {loading ? "Processing..." : "Sign in with Google"}
        </button>
      </form>

      <footer className="w-full text-center text-xs text-slate-500 py-4 mt-8 z-10">
        HIPAA-compliant | VISTA v1.0
      </footer>
    </div>
  );
}
