import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Firebase login if needed
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // If you have Firebase Auth here:
      const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
      const auth = getAuth();
      const result = await signInWithEmailAndPassword(auth, email, password);
      onLogin(result.user);
    } catch (err) {
      setError("Invalid email or password.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-black to-slate-900 flex flex-col items-center justify-center">
      {/* Logo/Brand */}
      <div className="mb-10 flex flex-col items-center">
        <div className="relative mb-2">
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-28 h-28 rounded-full bg-gradient-to-tr from-purple-600 via-cyan-400 to-purple-800 opacity-25 animate-ping"></span>
          </span>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 border-4 border-cyan-400 flex items-center justify-center shadow-lg relative z-10">
            <span className="text-3xl font-extrabold tracking-wide bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent select-none">
              V
            </span>
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-wider bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mt-2">
          VISTA
        </h1>
        <div className="text-slate-400 text-sm font-medium mt-1 mb-2 text-center">
          Vision Integrated Scan & Treatment Assistant
        </div>
      </div>

      {/* Login Card */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl shadow-2xl bg-slate-900 bg-opacity-80 border border-slate-800 p-8 flex flex-col"
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
          className="w-full py-3 mt-2 mb-1 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 font-bold text-white shadow-lg hover:scale-105 transition-all disabled:opacity-50"
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
      </form>

      <footer className="w-full text-center text-xs text-slate-500 py-4 mt-8">
        HIPAA-compliant | VISTA v1.0
      </footer>
    </div>
  );
}
