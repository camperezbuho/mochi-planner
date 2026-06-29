import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot, query, orderBy, where, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCSt9GrpNut3SatAjkCtCH2KWgOLu2OqTQ",
  authDomain: "mochi-planner.firebaseapp.com",
  projectId: "mochi-planner",
  storageBucket: "mochi-planner.firebasestorage.app",
  messagingSenderId: "862459716867",
  appId: "1:862459716867:web:dcd57dbd8381899df27536"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot, query, orderBy, where, Timestamp };
