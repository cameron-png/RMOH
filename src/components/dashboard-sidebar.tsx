
"use client";

import Link from "next/link";
import Image from 'next/image';
import { usePathname } from "next/navigation";
import { Home, LogOut, User, LayoutDashboard, Shield, QrCode, Users, FileText, Gift, CreditCard, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function DashboardSidebar() {
  const { user, signOut, availableBalance } = useAuth();
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();

  const getInitials = (name?: string | null) => {
    if (!name) return "??";
    const names = name.split(' ');
    if (names.length > 1) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const isActive = (path: string) => {
    // Make it active if the path is a prefix
    return pathname.startsWith(path);
  };

  const handleLinkClick = () => {
    setOpenMobile(false);
  }
  
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format((availableBalance || 0) / 100);

  return (
    <Sidebar className="border-r" variant="sidebar" collapsible="offcanvas">
      <SidebarContent>
        <SidebarHeader>
          <Link href="/user/dashboard" className="flex items-center gap-2 text-lg font-semibold md:text-base font-headline text-sidebar-foreground" onClick={handleLinkClick}>
             <Image 
                src="https://firebasestorage.googleapis.com/v0/b/openhouse-dashboard.firebasestorage.app/o/RMOHbug%20white.png?alt=media"
                alt="RateMyOpenHouse.com Logo"
                width={200}
                height={50}
                className="w-auto h-10"
                data-ai-hint="app logo white"
             />
          </Link>
        </SidebarHeader>
        <SidebarMenu className="mt-4">
          <SidebarMenuItem>
            <Link href="/user/dashboard" onClick={handleLinkClick}>
              <SidebarMenuButton size="lg" isActive={pathname === '/user/dashboard'}>
                <LayoutDashboard /><span>Dashboard</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <Link href="/user/my-leads" onClick={handleLinkClick}>
              <SidebarMenuButton size="lg" isActive={isActive('/user/my-leads')}>
                <Users /><span>My Leads</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <Link href="/user/my-qr-code" onClick={handleLinkClick}>
              <SidebarMenuButton size="lg" isActive={isActive('/user/my-qr-code')}>
                <QrCode /><span>My QR Code</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/user/feedback-forms" onClick={handleLinkClick}>
              <SidebarMenuButton size="lg" isActive={isActive('/user/feedback-forms')}>
                <FileText /><span>Feedback Forms</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <Link href="/user/billing" onClick={handleLinkClick}>
              <SidebarMenuButton size="lg" isActive={isActive('/user/billing')}>
                <CreditCard /><span>Billing</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
           {user?.isAdmin && (
            <>
              <SidebarSeparator className="my-4" />
              <SidebarMenuItem>
                <Link href="/admin" onClick={handleLinkClick}>
                  <SidebarMenuButton size="lg" isActive={isActive('/admin')}>
                    <Shield /><span>Admin Dashboard</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
         <div className="px-3 pb-2 text-sm text-sidebar-foreground/70">
            Available Balance: <span className="font-semibold text-sidebar-foreground/90">{formattedBalance}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 px-2 text-left h-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL || ""} alt="User avatar" data-ai-hint="person headshot" />
                <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-sm truncate">
                  <span className="font-medium truncate">{user?.displayName || user?.name || user?.email?.split('@')[0]}</span>
                  <span className="text-xs text-sidebar-foreground/70 truncate">{user?.email}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="mb-2 ml-2">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link href="/user/profile" onClick={handleLinkClick}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                </Link>
            </DropdownMenuItem>
             <DropdownMenuItem asChild>
                <Link href="/user/billing" onClick={handleLinkClick}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Billing</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
                handleLinkClick();
                signOut();
            }}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
