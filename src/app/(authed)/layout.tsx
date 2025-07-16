import { AppLayout } from "@/components/layout";
import { getAuth } from "firebase/auth";
import { app } from "@/lib/firebase";
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
