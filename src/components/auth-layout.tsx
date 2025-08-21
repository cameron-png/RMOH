
import type { ReactNode } from 'react';
import Image from 'next/image';

type AuthLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="p-4 sm:p-6">
        <div className="flex items-center justify-center gap-2 text-xl font-bold text-primary">
          <Image
            src="https://firebasestorage.googleapis.com/v0/b/openhouse-dashboard.firebasestorage.app/o/RMOH%20Logo.png?alt=media"
            alt="RateMyOpenHouse.com Logo"
            width={200}
            height={50}
            data-ai-hint="app logo"
          />
        </div>
      </header>
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight font-headline">{title}</h1>
            <p className="text-muted-foreground mt-2">{description}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
