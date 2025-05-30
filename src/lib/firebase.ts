
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Import Firestore
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// For example, to use Authentication: import { getAuth } from "firebase/auth";

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

// Export Firestore instance
export const firestore = getFirestore(app);
// export const auth = getAuth(app); // Uncomment if you set up Firebase Auth

export default app;
