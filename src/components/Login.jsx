import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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
      {/* Animated Scan Ring */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center">
        <svg
          className="w-[60vw] h-[60vw] max-w-2xl max-h-2xl opacity-20 animate-spin-slow"
          viewBox="0 0 600 600"
          fill="none"
          style={{ filter: "blur(1.5px)" }}
        >
          <circle
            cx="300"
            cy="300"
            r="230"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeDasharray="30 18"
            strokeLinecap="round"
            opacity="0.45"
          />
          <circle
            cx="300"
            cy="300"
            r="190"
            stroke="#f1f5f9"
            strokeWidth="2"
            strokeDasharray="7 15"
            strokeLinecap="round"
            opacity="0.22"
          />
        </svg>
      </div>

      {/* Login Content */}
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
