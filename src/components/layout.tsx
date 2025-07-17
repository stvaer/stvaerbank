
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AreaChart, ArrowRightLeft, CalendarClock, CreditCard, LayoutDashboard, LogOut, Plus, Bell, Wallet } from "lucide-react";
import { addDays, startOfToday } from "date-fns";
import React, { useEffect, useState, useCallback } from "react";
import type { DocumentData, Timestamp } from "firebase/firestore";

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "./ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFirebase } from "@/hooks/use-firebase";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transacciones", icon: ArrowRightLeft },
  { href: "/scheduler", label: "Calendario", icon: CalendarClock },
  { href: "/credit", label: "Crédito", icon: CreditCard },
  { href: "/reports", label: "Reportes", icon: AreaChart },
];

interface Notification {
  id: string;
  name: string;
  dueDate: Date;
  type: 'bill' | 'statement';
}

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, db, firebaseUtils, auth } = useFirebase();
  const pageTitle = navItems.find(item => pathname.startsWith(item.href))?.label || "Dashboard";
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  const fetchNotifications = useCallback(async (uid: string) => {
    if (!db || !firebaseUtils) return;
    setLoadingNotifications(true);

    const { collection, query, where, getDocs, Timestamp } = firebaseUtils;
    const today = startOfToday();
    const sevenDaysFromNow = addDays(today, 7);
    let upcomingPayments: Notification[] = [];

    try {
        const billsQuery = query(
            collection(db, "bills"),
            where("userId", "==", uid),
            where("dueDate", ">=", Timestamp.fromDate(today)),
            where("dueDate", "<=", Timestamp.fromDate(sevenDaysFromNow))
        );
        const billsSnapshot = await getDocs(billsQuery);
        billsSnapshot.forEach((doc: DocumentData) => {
            const data = doc.data();
            const dueDate = (data.dueDate as Timestamp).toDate();
            upcomingPayments.push({ id: doc.id, name: data.name, dueDate, type: 'bill' });
        });

        const statementsQuery = query(
            collection(db, "statements"),
            where("userId", "==", uid),
            where("isPaid", "==", false),
            where("dueDate", ">=", Timestamp.fromDate(today)),
            where("dueDate", "<=", Timestamp.fromDate(sevenDaysFromNow))
        );
        const statementsSnapshot = await getDocs(statementsQuery);
        statementsSnapshot.forEach((doc: DocumentData) => {
            const data = doc.data();
            const dueDate = (data.dueDate as Timestamp).toDate();
            upcomingPayments.push({ id: doc.id, name: `Pago Tarjeta (Mes ${data.month})`, dueDate, type: 'statement' });
        });

        upcomingPayments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
        setNotifications(upcomingPayments);

    } catch (error) {
        console.error("Error fetching notifications:", error);
    } finally {
        setLoadingNotifications(false);
    }
  }, [db, firebaseUtils]);

  useEffect(() => {
    if (user) {
        fetchNotifications(user.uid);
    } else {
        setNotifications([]);
        setLoadingNotifications(false);
    }
  }, [user, fetchNotifications]);
  

  const handleSignOut = async () => {
    if (!auth || !firebaseUtils) return;
    const { signOut } = firebaseUtils;
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Wallet className="size-8 text-primary" />
            <span className="text-xl font-semibold font-headline">STVAERBank</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                    tooltip={{ children: item.label }}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-5" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
           <Separator className="my-2" />
            <Button variant="ghost" className="justify-start gap-2" onClick={handleSignOut}>
              <LogOut className="size-5" />
              <span>Cerrar Sesión</span>
            </Button>
           <div className="flex items-center gap-3 p-2">
             <Avatar>
               <AvatarImage data-ai-hint="person abstract" src="https://placehold.co/40x40.png" alt="@user" />
               <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
             </Avatar>
             <div className="flex flex-col truncate">
                <span className="text-sm font-medium truncate">{user?.displayName || "Usuario"}</span>
                <span className="text-xs text-muted-foreground truncate">{user?.email || "cargando..."}</span>
             </div>
           </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2">
             <SidebarTrigger className="md:hidden" />
             <h2 className="text-lg font-semibold font-headline">{pageTitle}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-background" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Notificaciones</h4>
                    <p className="text-sm text-muted-foreground">
                      Tus próximos vencimientos.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {loadingNotifications ? (
                      <p className="text-sm text-muted-foreground">Cargando...</p>
                    ) : notifications.length > 0 ? (
                      notifications.map((n: Notification) => (
                        <div key={n.id} className="grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0">
                           <span className="flex h-2 w-2 translate-y-1 rounded-full bg-primary" />
                           <div className="grid gap-1">
                                <p className="text-sm font-medium leading-none truncate">{n.name}</p>
                                <p className="text-sm text-muted-foreground">Vence el {n.dueDate.toLocaleDateString()}</p>
                           </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No tienes notificaciones.</p>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary/10 hover:text-primary sm:w-auto w-10 sm:px-4 p-0">
               <Link href="/transactions">
                  <Plus className="sm:hidden" />
                  <span className="hidden sm:inline">Nueva Transacción</span>
               </Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 bg-background/95">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

    