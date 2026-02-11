import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-app.firebaseapp.com",
  projectId: "tu-app",
  storageBucket: "tu-app.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
