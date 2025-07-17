
"use client";

import { createContext, useContext, ReactNode } from 'react';
import type { User, Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

interface FirebaseContextType {
    user: User | null;
    db: Firestore | null;
    auth: Auth | null;
    firebaseUtils: any | null;
    firebaseReady: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider = ({ children, value }: { children: ReactNode, value: FirebaseContextType }) => {
    return (
        <FirebaseContext.Provider value={value}>
            {children}
        </FirebaseContext.Provider>
    );
};

export const useFirebase = (): FirebaseContextType => {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useFirebase must be used within a FirebaseProvider');
    }
    return context;
};
