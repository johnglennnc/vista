// src/components/Login.jsx

import React, { useState } from 'react';
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { app } from '../firebase/config'; // make sure this exports 'app' from initializeApp

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      onLogin(userCredential.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onLogin(result.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-gray-900 border border-gray-700 rounded">
      <h2 className="text-white text-2xl font-bold mb-6">Login to VISTA</h2>

      <form onSubmit={handleEmailLogin} className="mb-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 p-2 rounded bg-gray-800 text-white"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full mb-3 p-2 rounded bg-gray-800 text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full p-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-semibold"
        >
          Sign in with Email
        </button>
      </form>

      <button
        onClick={handleGoogleLogin}
        className="w-full p-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold"
      >
        Sign in with Google
      </button>

      {error && <p className="text-red-500 mt-4 text-sm">{error}</p>}
    </div>
  );
}

export default Login;
