import { AppLayout } from "@/components/layout";

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
