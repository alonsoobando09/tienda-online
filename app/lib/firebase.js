// lib/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { db } from "@/lib/firebase";
// import { auth } from "@/lib/firebase";


const firebaseConfig = {
  apiKey: "AIzaSyAGJRls2YUzf5j3Z7UM6ZwgftiGtSxB-Ds",
  authDomain: "central-mayorista-ccf65.firebaseapp.com",
  projectId: "central-mayorista-ccf65",
  storageBucket: "central-mayorista-ccf65.firebasestorage.app",
  messagingSenderId: "96248522666",
  appId: "1:96248522666:web:f199dd990e6deab58cadd3",
  measurementId: "G-B0KB7NH3BM"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
