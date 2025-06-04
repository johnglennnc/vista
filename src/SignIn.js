import React from "react";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { app } from "./firebase"; // make sure this matches your actual firebase.js path

const SignIn = () => {
  const handleGoogleSignIn = async () => {
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("✅ Logged in as:", user.displayName);
      // Redirect or update app state here
    } catch (error) {
      console.error("❌ Google sign-in error:", error.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-3xl font-bold mb-6">Sign In</h1>
      <button
        onClick={handleGoogleSignIn}
        className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 transition"
      >
        Sign in with Google
      </button>
    </div>
  );
};

export default SignIn;
