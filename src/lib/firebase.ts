
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
// For example, to use Firestore: import { getFirestore } from "firebase/firestore";
// For example, to use Authentication: import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB9oi3mzxN65KkwbQqQKg8oyPyeqpWa3c4",
  authDomain: "gestion-exellence.firebaseapp.com",
  projectId: "gestion-exellence",
  storageBucket: "gestion-exellence.appspot.com", // Corrected from your snippet, usually ends with .appspot.com
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

// Example of exporting Firestore and Auth (uncomment and import getFirestore/getAuth above if needed)
// export const firestore = getFirestore(app);
// export const auth = getAuth(app);

export default app;
