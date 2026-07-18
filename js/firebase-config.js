import { initializeApp } from "https://gstatic.com";
import { getAuth } from "https://gstatic.com";
import { getDatabase } from "https://gstatic.com";
// Menggunakan jalur relatif yang lebih aman untuk server produksi GitHub
import { signInWithEmailAndPassword } from "https://gstatic.com";
import { auth } from "../js/firebase-config.js"; // Diubah menggunakan ../js/ agar mutlak mencari di dalam folder js

const firebaseConfig = {
  apiKey: "AIzaSyDg2b6LERZ2zE86mTiYvUO1Uj--lAtpmgM",
  authDomain: "://firebaseapp.com",
  databaseURL: "https://firebasedatabase.app",
  projectId: "afatsumazer-app",
  storageBucket: "afatsumazer-app.firebasestorage.app",
  messagingSenderId: "16280759060",
  appId: "1:16280759060:web:fd4deacafdf5cadd777001",
  measurementId: "G-WB9YW9D726"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);

