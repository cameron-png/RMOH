
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Gift } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Gift as GiftIcon, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createGift } from './actions';


const giftFormSchema = z.object({
  recipientName: z.string().min(2, "Please enter the recipient's name."),
  recipientEmail: z.string().email("Please enter a valid email address."),
  brand: z.string().min(1, "Please select a brand."),
  amount: z.string().min(1, "Please select an amount."),
  customAmount: z.string().optional(),
}).refine(data => {
    if (data.amount === 'custom') {
        return data.customAmount && !isNaN(parseFloat(data.customAmount)) && parseFloat(data.customAmount) > 0;
    }
    return true;
}, {
    message: "Please enter a valid custom amount.",
    path: ['customAmount'],
});


// MOCK BRANDS - This will be replaced with API data later
const MOCK_BRANDS = [
    { code: 'amazon', name: 'Amazon' },
    { code: 'starbucks', name: 'Starbucks' },
    { code: 'target', name: 'Target' },
    { code: 'walmart', name: 'Walmart' },
];


export default function GiftsPage() {
  const { user, availableBalance } = useAuth();
  const { toast } = useToast();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const form = useForm<z.infer<typeof giftFormSchema>>({
    resolver: zodResolver(giftFormSchema),
    defaultValues: {
      recipientName: '',
      recipientEmail: '',
      brand: '',
      amount: '',
      customAmount: '',
    },
  });

  const watchAmount = form.watch('amount');

  const fetchGifts = useCallback(() => {
    if (!user) return;

    setLoading(true);
    const q = query(
        collection(db, 'gifts'), 
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const giftsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gift));
        setGifts(giftsData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching gifts:", error);
        setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const unsubscribe = fetchGifts();
    return () => unsubscribe?.();
  }, [fetchGifts]);

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: 'Link copied to clipboard!' });
    }, (err) => {
      toast({ variant: 'destructive', title: 'Failed to copy link.' });
    });
  };

  const formatCurrency = (amountInCents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amountInCents / 100);
  };
  
  async function onSubmit(values: z.infer<typeof giftFormSchema>) {
    if (!user?.name) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not find user information.' });
        return;
    }

    const amountInCents = values.amount === 'custom' 
        ? Math.round(parseFloat(values.customAmount || '0') * 100) 
        : parseInt(values.amount, 10);
        
    if (typeof availableBalance === 'undefined' || availableBalance < amountInCents) {
        toast({
            variant: 'destructive',
            title: 'Insufficient Funds',
            description: 'You do not have enough funds to create this gift.',
        });
        return;
    }

    const result = await createGift({
        userId: user.uid,
        recipientName: values.recipientName,
        recipientEmail: values.recipientEmail,
        brandCode: values.brand,
        amountInCents: amountInCents,
    });
    
    if (result.success) {
        toast({
            title: 'Gift Created',
            description: 'Your gift is being processed and will appear in the log.',
        });
        setIsFormOpen(false);
        form.reset();
    } else {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: result.message || 'An unknown error occurred.',
        });
    }
  }


  return (
    <>
    <div className="w-full mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-grow">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Gifts</h1>
                <p className="text-muted-foreground">
                    Create and track digital gift cards for your clients.
                </p>
            </div>
             <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                        <PlusCircle className="mr-2"/> Create Gift
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create a New Gift</DialogTitle>
                        <DialogDescription>
                            Enter the details below to create a new digital gift card.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="recipientName"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Recipient Name</FormLabel>
                                    <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="recipientEmail"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Recipient Email</FormLabel>
                                    <FormControl><Input placeholder="jane.doe@example.com" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="brand"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Brand</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder="Select a brand..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {MOCK_BRANDS.map(brand => (
                                                <SelectItem key={brand.code} value={brand.code}>{brand.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder="Select an amount..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="500">$5.00</SelectItem>
                                            <SelectItem value="1000">$10.00</SelectItem>
                                            <SelectItem value="1500">$15.00</SelectItem>
                                            <SelectItem value="custom">Custom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            {watchAmount === 'custom' && (
                                <FormField
                                    control={form.control}
                                    name="customAmount"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Custom Amount ($)</FormLabel>
                                        <FormControl><Input type="number" placeholder="e.g., 25.00" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            )}
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? 'Creating...' : 'Create Gift'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Gift Log</CardTitle>
                <CardDescription>A list of all the gifts you have created.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Gift</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                          <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading gifts...</TableCell></TableRow>
                      ) : gifts.length > 0 ? (
                        gifts.map((gift) => (
                          <TableRow key={gift.id}>
                            <TableCell>
                                <div>{gift.recipientName}</div>
                                <div className="text-xs text-muted-foreground">{gift.recipientEmail}</div>
                            </TableCell>
                            <TableCell>{formatCurrency(gift.amountInCents)}</TableCell>
                            <TableCell>{gift.brandCode.charAt(0).toUpperCase() + gift.brandCode.slice(1)}</TableCell>
                            <TableCell>
                                <Badge variant={gift.status === 'Available' ? 'default' : 'secondary'}>
                                    {gift.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                {gift.claimUrl ? (
                                    <Button variant="outline" size="sm" onClick={() => handleCopyLink(gift.claimUrl!)}>
                                        <Copy className="mr-2 h-4 w-4" />
                                        Copy Link
                                    </Button>
                                ) : (
                                    <span>-</span>
                                )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            No gifts have been created yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
            </CardContent>
        </Card>
    </div>
    </>
  );
}
