import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

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
export const appCheck = DEMO ? null : initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider("6LcxwG0tAAAAAKaMKLLn-y3VGnNhJxeasRchSB8-"),
  isTokenAutoRefreshEnabled: true,
});
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
