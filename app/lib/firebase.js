// lib/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { db } from "@/lib/firebase";
// import { auth } from "@/lib/firebase";


const firebaseConfig = {
  apiKey: "demo",
  authDomain: "demo",
  projectId: "demo",
  storageBucket: "demo",
  messagingSenderId: "demo",
  appId: "demo",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
