
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, onSnapshot, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Gift, GiftbitBrand } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Gift as GiftIcon, PlusCircle, Loader2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { processGift, getGiftbitBrands } from './actions';

const giftFormSchema = z.object({
  recipientName: z.string().min(2, "Please enter the recipient's name."),
  recipientEmail: z.string().email("Please enter a valid email address."),
  brand: z.string().min(1, "Please select a brand."),
  amount: z.string().min(1, "Please enter an amount."),
});


export default function GiftsPage() {
  const { user, availableBalance } = useAuth();
  const { toast } = useToast();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const [brands, setBrands] = useState<GiftbitBrand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<GiftbitBrand | null>(null);


  const form = useForm<z.infer<typeof giftFormSchema>>({
    resolver: zodResolver(giftFormSchema),
    defaultValues: {
      recipientName: '',
      recipientEmail: '',
      brand: '',
      amount: '',
    },
  });
  
  const handleBrandChange = (brandCode: string) => {
    const brand = brands.find(b => b.brand_code === brandCode);
    setSelectedBrand(brand || null);
    form.setValue('brand', brandCode);
    form.setValue('amount', ''); // Reset amount when brand changes
    form.clearErrors('amount');
  };
  
  const getAmountDescription = () => {
    if (!selectedBrand) return "Select a brand to see amount requirements.";

    if (selectedBrand.denominations_in_cents?.length) {
      const denominations = selectedBrand.denominations_in_cents.map(d => `$${(d / 100).toFixed(2)}`).join(', ');
      return `Allowed amounts: ${denominations}`;
    }
    if (selectedBrand.min_price_in_cents && selectedBrand.max_price_in_cents) {
        const min = (selectedBrand.min_price_in_cents / 100).toFixed(2);
        const max = (selectedBrand.max_price_in_cents / 100).toFixed(2);
      return `Amount must be between $${min} and $${max}.`;
    }
    return null;
  }

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

  // Fetch brands when the page loads, not just when dialog opens
  useEffect(() => {
    async function loadBrands() {
      if (!user?.region) return;

      setLoadingBrands(true);
      try {
        const fetchedBrands = await getGiftbitBrands(user.region);
        setBrands(fetchedBrands);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not load available gift brands.',
        });
      } finally {
        setLoadingBrands(false);
      }
    }
    if(user){
        loadBrands();
    }
  }, [toast, user]);

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
    if (!user) {
        toast({
            variant: 'destructive',
            title: 'Authentication Error',
            description: 'You must be logged in to create a gift.',
        });
        return;
    }
    const amountInCents = Math.round(parseFloat(values.amount) * 100);

    // Dynamic validation check
    if (selectedBrand) {
        if (selectedBrand.denominations_in_cents?.length) {
            if (!selectedBrand.denominations_in_cents.includes(amountInCents)) {
                form.setError('amount', { message: `Amount must be one of the allowed denominations.` });
                return;
            }
        } else if (selectedBrand.min_price_in_cents && selectedBrand.max_price_in_cents) {
            if (amountInCents < selectedBrand.min_price_in_cents || amountInCents > selectedBrand.max_price_in_cents) {
                 form.setError('amount', { message: `Amount is outside the allowed range.` });
                 return;
            }
        }
    }
        
    if (typeof availableBalance === 'undefined' || availableBalance < amountInCents) {
        toast({
            variant: 'destructive',
            title: 'Insufficient Funds',
            description: 'You do not have enough funds to create this gift.',
        });
        return;
    }

    try {
        const newGiftData = {
            userId: user.uid,
            recipientName: values.recipientName,
            recipientEmail: values.recipientEmail,
            brandCode: values.brand,
            amountInCents: amountInCents,
            type: 'Manual',
            status: 'Pending' as const,
            claimUrl: null,
            createdAt: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, "gifts"), newGiftData);

        toast({
            title: 'Gift Created',
            description: 'Your gift is being processed and will appear in the log.',
        });
        setIsFormOpen(false);
        form.reset();
        setSelectedBrand(null);

        // Trigger background processing
        await processGift(docRef.id);

    } catch (error: any) {
         toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not create the gift. Please try again.',
        });
    }
  }
  
  if (!user?.region) {
    return (
        <div className="w-full mx-auto space-y-8">
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Region Not Set</CardTitle>
                    <CardDescription>
                        Please set your region in your profile to use the gift-giving features.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Your region determines which gift card brands and currencies are available to you.</p>
                </CardContent>
                <CardFooter>
                    <Button asChild>
                        <Link href="/user/profile">
                            <Settings className="mr-2" />
                            Go to Profile Settings
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
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
             <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
                 setIsFormOpen(isOpen);
                 if (!isOpen) {
                     form.reset();
                     setSelectedBrand(null);
                 }
             }}>
                <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                        <PlusCircle className="mr-2"/> Create Gift
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create a New Gift</DialogTitle>
                        <DialogDescription>
                            Enter the details below to create a new digital gift card. The cost will be deducted from your available balance.
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
                                    <Select onValueChange={handleBrandChange} disabled={loadingBrands}>
                                        <FormControl>
                                            <SelectTrigger>
                                            <SelectValue placeholder={loadingBrands ? "Loading brands..." : "Select a brand..."} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {loadingBrands ? (
                                                <div className="flex items-center justify-center p-4">
                                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                </div>
                                            ) : (
                                                brands.map((brand) => (
                                                    <SelectItem key={brand.brand_code} value={brand.brand_code}>
                                                      {brand.name}
                                                    </SelectItem>
                                                ))
                                            )}
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
                                    <FormLabel>Amount ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 25.00" {...field} disabled={!selectedBrand} />
                                    </FormControl>
                                    <FormDescription>{getAmountDescription()}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
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
                {loading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : gifts.length > 0 ? (
                    <>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                        {gifts.map((gift) => (
                            <Card key={gift.id}>
                                <CardHeader>
                                    <CardTitle className="text-base">{gift.recipientName}</CardTitle>
                                    <CardDescription>{gift.recipientEmail}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Amount:</span>
                                        <span className="font-medium">{formatCurrency(gift.amountInCents)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Brand:</span>
                                        <span className="font-medium">{brands.find(b => b.brand_code === gift.brandCode)?.name || gift.brandCode}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Status:</span>
                                        <Badge variant={gift.status === 'Available' ? 'default' : gift.status === 'Failed' ? 'destructive' : 'secondary'}>
                                            {gift.status}
                                        </Badge>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    {gift.claimUrl ? (
                                        <Button variant="outline" size="sm" onClick={() => handleCopyLink(gift.claimUrl!)} className="w-full">
                                            <Copy className="mr-2 h-4 w-4" /> Copy Link
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" className="w-full" disabled>
                                            Link Not Available
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                    
                    {/* Desktop Table View */}
                    <div className="border rounded-lg hidden md:block overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Recipient</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Link</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {gifts.map((gift) => (
                                <TableRow key={gift.id}>
                                    <TableCell>
                                        <div>{gift.recipientName}</div>
                                        <div className="text-xs text-muted-foreground">{gift.recipientEmail}</div>
                                    </TableCell>
                                    <TableCell>{formatCurrency(gift.amountInCents)}</TableCell>
                                    <TableCell>
                                        {gift.brandCode ? (
                                            <span>{brands.find(b => b.brand_code === gift.brandCode)?.name || gift.brandCode}</span>
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={gift.status === 'Available' ? 'default' : gift.status === 'Failed' ? 'destructive' : 'secondary'}>
                                            {gift.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {gift.claimUrl ? (
                                            <Button variant="outline" size="sm" onClick={() => handleCopyLink(gift.claimUrl!)}>
                                                <Copy className="mr-2 h-4 w-4" /> Copy Link
                                            </Button>
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    </>
                ) : (
                    <div className="text-center py-16 border-2 border-dashed rounded-lg">
                        <div className="flex flex-col items-center gap-2">
                        <GiftIcon className="h-8 w-8 text-muted-foreground" />
                        <span className="font-medium">No Gifts Created Yet</span>
                        <span className="text-sm text-muted-foreground">Click "Create Gift" to send your first one.</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
    </>
  );
}

    