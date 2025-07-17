
"use client";

import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { AppLayout } from "@/components/layout";

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [db, setDb] = useState<any>(null);
  const [firebaseUtils, setFirebaseUtils] = useState<any>(null);
  const [auth, setAuth] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      const { initializeFirebase, firebaseAuth } = await import('@/lib/firebase');
      const { getFirestore, collection, getDocs, query, where, Timestamp, orderBy, deleteDoc, addDoc, updateDoc, writeBatch } = await import('firebase/firestore');
      const { onAuthStateChanged, signOut } = await import('firebase/auth');

      initializeFirebase();
      const authInstance = firebaseAuth;
      setAuth(authInstance);
      setDb(getFirestore());
      setFirebaseUtils({
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
      });

      const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
        setUser(currentUser);
        setFirebaseReady(true);
      });

      return () => unsubscribe();
    };

    init();
  }, []);

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      // Cloning element and passing all the necessary props.
      return React.cloneElement(child, { user, db, firebaseUtils, auth } as React.Attributes & { user: User | null, db: any, firebaseUtils: any, auth: any });
    }
    return child;
  });

  return (
    <AppLayout user={user} auth={auth} db={db} firebaseUtils={firebaseUtils} firebaseReady={firebaseReady}>
      {firebaseReady ? childrenWithProps : <div>Loading...</div>}
    </AppLayout>
  );
}
