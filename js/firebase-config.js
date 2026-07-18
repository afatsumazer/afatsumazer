// Import SDK menggunakan CDN resmi agar bisa langsung dibaca oleh browser
import { initializeApp } from "https://gstatic.com";
import { getAuth } from "https://gstatic.com";
import { getDatabase } from "https://gstatic.com";

// Kredensial asli proyek AFATSUMAZER Anda
const firebaseConfig = {
  apiKey: "AIzaSyDg2b6LERZ2zE86mTiYvUO1Uj--lAtpmgM",
  authDomain: "afatsumazer-app.firebaseapp.com",
  databaseURL: "https://afatsumazer-app-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "afatsumazer-app",
  storageBucket: "afatsumazer-app.firebasestorage.app",
  messagingSenderId: "16280759060",
  appId: "1:16280759060:web:fd4deacafdf5cadd777001",
  measurementId: "G-WB9YW9D726"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Ekspor layanan Auth dan Realtime Database agar bisa dipakai di file login.js / register.js
export const auth = getAuth(app);
export const database = getDatabase(app);
