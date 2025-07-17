
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, Timestamp, orderBy, deleteDoc, addDoc, updateDoc, writeBatch, limit } from 'firebase/firestore';
import { getAuth, signOut } from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

let app: FirebaseApp;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

const firebaseAuth = getAuth(app);
const db = getFirestore(app);

const firebaseUtils = {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  orderBy,
  deleteDoc,
  addDoc,
  updateDoc,
  writeBatch,
  signOut,
  limit,
};

export { app, db, firebaseAuth, firebaseUtils };
