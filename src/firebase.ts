import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const DEMO = import.meta.env.VITE_DEMO === "1";

const firebaseConfig = {
  projectId: "founderflow-crm-af1",
  appId: "1:102143104365:web:238753208884e3b647b664",
  apiKey: "AIzaSyAxhp2xuOgWGxgFPUqdGJRKKXOvj6LMfa8",
  authDomain: "founderflow-crm-af1.firebaseapp.com",
  storageBucket: "founderflow-crm-af1.firebasestorage.app",
  messagingSenderId: "102143104365",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
