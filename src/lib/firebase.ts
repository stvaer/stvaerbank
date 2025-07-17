
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

// Initialize Firebase for client-side and export instances
let app: FirebaseApp;
let firebaseAuth: Auth;
let db: Firestore;

function initializeFirebase(): FirebaseApp {
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
    firebaseAuth = getAuth(app);
    db = getFirestore(app);
    return app;
}

export { app, db, firebaseAuth, initializeFirebase };
