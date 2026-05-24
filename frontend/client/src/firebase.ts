// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyByBqlEiO0ZrkRFZy5-Ky3SQX2wfa900R8",
  authDomain: "speakup-d3593.firebaseapp.com",
  projectId: "speakup-d3593",
  storageBucket: "speakup-d3593.firebasestorage.app",
  messagingSenderId: "254688261210",
  appId: "1:254688261210:web:187dfaaeaba5b703ac5463",
  measurementId: "G-YKL8TVV4XC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics =  getAnalytics(app);

// Initialize Firebase Auth and Firestore
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
