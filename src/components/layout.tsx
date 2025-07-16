"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AreaChart, ArrowRightLeft, CalendarClock, LayoutDashboard } from "lucide-react";

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
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "./ui/separator";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowRightLeft },
  { href: "/scheduler", label: "Scheduler", icon: CalendarClock },
  { href: "/reports", label: "Reports", icon: AreaChart },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageTitle = navItems.find(item => pathname.startsWith(item.href))?.label || "Dashboard";

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo className="size-8 text-primary" />
            <span className="text-xl font-semibold font-headline">STVAERBank</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={{ children: item.label }}
                  >
                    <item.icon className="size-5" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
           <Separator className="my-2" />
           <div className="flex items-center gap-3 p-2">
             <Avatar>
               <AvatarImage data-ai-hint="person abstract" src="https://placehold.co/40x40.png" alt="@user" />
               <AvatarFallback>U</AvatarFallback>
             </Avatar>
             <div className="flex flex-col">
                <span className="text-sm font-medium">User</span>
                <span className="text-xs text-muted-foreground">user@email.com</span>
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
          <Button variant="outline" className="border-primary text-primary hover:bg-primary/10 hover:text-primary">
            New Transaction
          </Button>
        </header>
        <main className="flex-1 p-4 sm:p-6 bg-background/95">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
