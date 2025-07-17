
"use client";

import React, { useState, useEffect } from 'react';
import type { User, Unsubscribe } from 'firebase/auth';
import { AppLayout } from "@/components/layout";
import { useRouter } from 'next/navigation';
import { firebaseAuth } from "@/lib/firebase";
import { getFirestore, collection, getDocs, query, where, Timestamp, orderBy, deleteDoc, addDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';

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
  const router = useRouter();

  useEffect(() => {
    const authInstance = getAuth();
    const dbInstance = getFirestore();
    const { onAuthStateChanged } = require("firebase/auth");

    setAuth(authInstance);
    setDb(dbInstance);
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
    
    const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
      setFirebaseReady(true);
      if (!currentUser) {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { user, db, firebaseUtils, auth } as React.Attributes & { user: User | null, db: any, firebaseUtils: any, auth: any });
    }
    return child;
  });

  return (
    <AppLayout user={user} auth={auth} db={db} firebaseUtils={firebaseUtils} firebaseReady={firebaseReady}>
      {firebaseReady && user ? childrenWithProps : <div>Loading...</div>}
    </AppLayout>
  );
}
