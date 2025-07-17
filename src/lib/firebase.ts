
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

// Initialize Firebase for client-side and export instances
let app: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let db: Firestore | null = null;

function initializeFirebase() {
    if (typeof window !== 'undefined') {
        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApp();
        }
        firebaseAuth = getAuth(app);
        db = getFirestore(app);
    }
}

export { app, db, firebaseAuth, initializeFirebase };
