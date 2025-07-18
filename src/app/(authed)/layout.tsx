
"use client";

import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppLayout } from "@/components/layout";
import { useRouter } from 'next/navigation';
import { firebaseAuth, db, firebaseUtils } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { FirebaseProvider } from '@/hooks/use-firebase';
import type { UserProfile } from '@/lib/schemas';
import { userProfileSchema } from '@/lib/schemas';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Terminal } from 'lucide-react';

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const router = useRouter();

  const form = useForm<{ username: string }>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: { username: "" },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      setUser(currentUser);
      setFirebaseReady(true);
      if (!currentUser) {
        router.push('/login');
      } else {
        // Check for user profile
        if (db && firebaseUtils) {
          const { doc, getDoc } = firebaseUtils;
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setUserData(userDocSnap.data() as UserProfile);
            setShowUsernameModal(false);
          } else {
            setUserData(null);
            setShowUsernameModal(true);
          }
        }
        setLoadingUserData(false);
      }
    });

    return () => unsubscribe();
  }, [router, db, firebaseUtils]);

  const handleUsernameSubmit = async (data: { username: string }) => {
    if (!user || !db || !firebaseUtils) return;
    const { doc, setDoc } = firebaseUtils;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { username: data.username, email: user.email });
      setUserData({ username: data.username, email: user.email || "" });
      setShowUsernameModal(false);
      form.reset();
    } catch (error) {
      console.error("Error saving username:", error);
    }
  };

  const authContextValue = {
    user,
    db,
    firebaseUtils,
    auth: firebaseAuth,
    firebaseReady,
    userData
  };

  if (!firebaseReady || !user || loadingUserData) {
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
      <Dialog open={showUsernameModal}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>¡Bienvenido a STVAERBank!</DialogTitle>
            <DialogDescription>
              Para completar tu perfil, por favor elige un nombre de usuario.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUsernameSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Usuario</FormLabel>
                    <FormControl>
                      <Input placeholder="ej. stevaer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle>¡Atención!</AlertTitle>
                <AlertDescription>
                  Tu nombre de usuario será permanente y no podrá ser cambiado en el futuro.
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button type="submit">Guardar Nombre</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </FirebaseProvider>
  );
}
