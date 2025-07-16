// This is a temporary file to redirect to the login page.
// In a real app, you'd handle authenticated vs unauthenticated routes.
"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return null; 
}
