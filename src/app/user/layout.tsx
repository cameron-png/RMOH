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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If loading is finished and there's still no user, redirect to login.
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  // While loading on the initial app load, show a loading screen.
  if (loading) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
            <LoadingAnimation />
            <p className="text-muted-foreground mt-4">Verifying authentication...</p>
        </div>
    );
  }

  // Once loading is false, if user is confirmed, render the dashboard.
  // If user is null, the useEffect above will handle the redirect.
  // This prevents the loading flash on page changes.
  if (user) {
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

  // If loading is false and there's no user, this will be null,
  // allowing the redirect to happen without showing anything.
  return null;
}
