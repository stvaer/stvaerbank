
"use client";

import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { AppLayout } from "@/components/layout";
import { useRouter } from 'next/navigation';
import { firebaseAuth, db, firebaseUtils } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { FirebaseProvider } from '@/hooks/use-firebase';

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
      setFirebaseReady(true);
      if (!currentUser) {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);
  
  const authContextValue = {
    user,
    db,
    firebaseUtils,
    auth: firebaseAuth,
    firebaseReady
  };


  if (!firebaseReady || !user) {
    return (
        <div className="flex h-screen items-center justify-center">
            <div>Loading...</div>
        </div>
    );
  }

  return (
    <FirebaseProvider value={authContextValue}>
        <AppLayout>
            {children}
        </AppLayout>
    </FirebaseProvider>
  );
}
