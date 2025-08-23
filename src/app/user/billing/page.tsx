
"use client";

import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Mail, PlusCircle, MinusCircle, Loader2 } from 'lucide-react';
import { Transaction } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { getBillingHistory } from './actions';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';

export default function BillingPage() {
    const { user, availableBalance } = useAuth();
    const { toast } = useToast();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const { transactions } = await getBillingHistory();
                setTransactions(transactions);
            } catch (error: any) {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Could not load your transaction history.',
                });
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [toast]);

    const formattedBalance = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format((availableBalance || 0) / 100);

    const formatCurrency = (amountInCents: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amountInCents / 100);
    };

    const groupedTransactions = useMemo(() => {
        const groups: { [key: string]: Transaction[] } = {};
        transactions.forEach(tx => {
            const month = format(parseISO(tx.createdAt as any), 'MMMM yyyy');
            if (!groups[month]) {
                groups[month] = [];
            }
            groups[month].push(tx);
        });
        return groups;
    }, [transactions]);


    return (
        <div className="w-full mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Billing</h1>
                <p className="text-muted-foreground">
                    Manage your account balance and view transaction history.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Current Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold">{formattedBalance}</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Add Funds</CardTitle>
                            <CardDescription>
                                Need to increase your available balance?
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                           <p className="text-muted-foreground text-sm">
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
                <div className="md:col-span-2">
                     <Card>
                        <CardHeader>
                            <CardTitle>Transaction History</CardTitle>
                            <CardDescription>
                                A record of all credits and deductions on your account.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center items-center h-48">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : Object.keys(groupedTransactions).length > 0 ? (
                                <div className="space-y-6">
                                    {Object.entries(groupedTransactions).map(([month, txs]) => (
                                        <div key={month}>
                                            <h3 className="text-lg font-semibold mb-3">{month}</h3>
                                            <div className="space-y-4">
                                                {txs.map(tx => (
                                                    <div key={tx.id} className="flex items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3">
                                                           {tx.type === 'Credit' ? <PlusCircle className="h-5 w-5 text-green-500" /> : <MinusCircle className="h-5 w-5 text-destructive" />}
                                                           <div>
                                                              <p className="font-medium">{tx.description}</p>
                                                              <p className="text-xs text-muted-foreground">{format(parseISO(tx.createdAt as any), 'MMM d, yyyy')}</p>
                                                           </div>
                                                        </div>
                                                        <p className={`font-semibold ${tx.type === 'Credit' ? 'text-green-600' : 'text-foreground'}`}>
                                                            {tx.type === 'Credit' ? '+' : '-'}
                                                            {formatCurrency(tx.amountInCents)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                             <Separator className="mt-6" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground py-10">
                                    No transactions found.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
