// /lib/firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
  apiKey: "AIzaSyAGJRls2YUzf5j3Z7UM6ZwgftiGtSxB-Ds",
  authDomain: "central-mayorista-ccf65.firebaseapp.com",
  projectId: "central-mayorista-ccf65",
  storageBucket: "central-mayorista-ccf65.firebasestorage.app",
  messagingSenderId: "96248522666",
  appId: "1:96248522666:web:f199dd990e6deab58cadd3",
  measurementId: "G-B0KB7NH3BM"
};

// Inicializar app
const app = initializeApp(firebaseConfig);

// Exportar servicios
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);