
"use client";

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Mail } from 'lucide-react';

export default function BillingPage() {
    const { user, availableBalance } = useAuth();
    
    const formattedBalance = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format((availableBalance || 0) / 100);

    return (
        <div className="w-full mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Billing</h1>
                <p className="text-muted-foreground">
                    Manage your account balance and payment methods.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                     <Card>
                        <CardHeader>
                            <CardTitle>Current Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold">{formattedBalance}</p>
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-2">
                     <Card>
                        <CardHeader>
                            <CardTitle>Add Funds</CardTitle>
                            <CardDescription>
                                Need to increase your available balance?
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                           <p className="text-muted-foreground">
                                To add more funds to your account, please contact our support team. We are working on an automated top-up system that will be available soon.
                           </p>
                        </CardContent>
                        <CardFooter>
                            <Button asChild>
                                <a href="mailto:support@ratemyopenhouse.com">
                                    <Mail className="mr-2"/>
                                    Contact Support
                                </a>
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
