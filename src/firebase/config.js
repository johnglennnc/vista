// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

// ✅ Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC2I6CKmJInQeuZ922Yam4RjWYaknSKVsY",
  authDomain: "vista-lifeimaging.firebaseapp.com",
  projectId: "vista-lifeimaging",
  storageBucket: "vista-lifeimaging-ct-data",
  messagingSenderId: "243328113517",
  appId: "1:243328113517:web:c27aee325ba2e850911864"
};

// ✅ Initialize App
const app = initializeApp(firebaseConfig);

// ✅ Firebase Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app); // ✅ No need to manually pass bucket if defined above
export const db = getFirestore(app);
export { app };
