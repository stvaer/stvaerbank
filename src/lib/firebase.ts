
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

// Initialize Firebase for client-side and export instances
let app: FirebaseApp;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

const firebaseAuth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

// This function is kept for compatibility but the initialization is now eager.
function initializeFirebase(): FirebaseApp {
    return app;
}

export { app, db, firebaseAuth, initializeFirebase };
