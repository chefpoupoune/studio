
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Import Firestore
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB9oi3mzxN65KkwbQqQKg8oyPyeqpWa3c4",
  authDomain: "gestion-exellence.firebaseapp.com",
  projectId: "gestion-exellence",
  storageBucket: "gestion-exellence.appspot.com", 
  messagingSenderId: "1097443380581",
  appId: "1:1097443380581:web:ef3b071354f64cb0b0a58c"
};

// Initialize Firebase
let app;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Get Auth instance
const auth = getAuth(app);

// Set auth language to French
auth.languageCode = 'fr';

// Export Firestore and Auth instances
export const firestore = getFirestore(app);
export { auth };

export default app;
