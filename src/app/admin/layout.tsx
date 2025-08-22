"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { LoadingAnimation } from '@/components/loading-animation';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user?.isAdmin) {
      router.push('/user/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
            <LoadingAnimation />
            <p className="text-muted-foreground mt-4">Verifying admin credentials...</p>
        </div>
    );
  }

  if (user?.isAdmin) {
    return (
      <SidebarProvider>
          <div className="flex min-h-screen w-full">
              <DashboardSidebar />
              <div className="flex flex-1 flex-col">
                  <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-sidebar px-4 sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 md:hidden">
                      <SidebarTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                              <PanelLeft />
                              <span className="sr-only">Toggle Menu</span>
                          </Button>
                      </SidebarTrigger>
                       <Link href="/user/dashboard" className="flex items-center gap-2 text-lg font-semibold md:text-base font-headline text-sidebar-foreground">
                          <Image 
                              src="https://firebasestorage.googleapis.com/v0/b/openhouse-dashboard.firebasestorage.app/o/RMOHbug%20white.png?alt=media"
                              alt="RateMyOpenHouse.com Logo"
                              width={150}
                              height={40}
                              className="w-auto h-8"
                              data-ai-hint="app logo white"
                          />
                      </Link>
                  </header>
                  <main className="flex-1 p-4 sm:p-6">
                      {children}
                  </main>
                   <footer className="py-4 px-6 mt-auto">
                      <div className="flex justify-center">
                          <Image 
                              src="https://firebasestorage.googleapis.com/v0/b/openhouse-dashboard.firebasestorage.app/o/RMOHbug.png?alt=media"
                              alt="RateMyOpenHouse.com Icon"
                              width={40}
                              height={40}
                              className="h-8 w-auto opacity-50"
                              data-ai-hint="app icon"
                          />
                      </div>
                  </footer>
              </div>
          </div>
      </SidebarProvider>
    );
  }

  return null;
}
