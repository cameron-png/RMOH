
"use client";

import { useState, useEffect, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Copy, Loader2, Gift as GiftIcon } from 'lucide-react';
import { createGiftLink } from './actions';
import type { Gift, GiftbitBrand } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { listBrands } from '@/lib/giftbit';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

function CreateGiftSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Loader2 className="animate-spin mr-2" /> : <PlusCircle className="mr-2" />}
      {pending ? 'Creating Link...' : 'Create Gift Link'}
    </Button>
  );
}

export default function GiftsPage() {
  const { user } = useAuth();
  const [brands, setBrands] = useState<GiftbitBrand[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(true);

  const { toast } = useToast();
  const createFormRef = useRef<HTMLFormElement>(null);

  const [createGiftState, createGiftAction] = useActionState(createGiftLink, {
    success: false,
    message: '',
  });
  
  useEffect(() => {
    async function fetchBrands() {
        try {
            const brandList = await listBrands();
            setBrands(brandList);
        } catch (error) {
            toast({
                title: 'Error Fetching Brands',
                description: 'Could not load the list of available gift card brands.',
                variant: 'destructive'
            });
        }
    }
    fetchBrands();
  }, [toast]);
  
  useEffect(() => {
    if (createGiftState.message) {
      if (createGiftState.success) {
        toast({
            title: 'Success!',
            description: createGiftState.message,
        });
        createFormRef.current?.reset();
      } else {
        toast({
            title: 'Error',
            description: createGiftState.message,
            variant: 'destructive',
        });
      }
    }
  }, [createGiftState, toast]);

  useEffect(() => {
    if (!user) return;
    setLoadingGifts(true);
    const q = query(
      collection(db, 'gifts'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const giftsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gift));
        setGifts(giftsData);
        setLoadingGifts(false);
    });

    return () => unsubscribe();
  }, [user]);


  const handleCopy = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
        toast({ title: 'Copied to clipboard!' });
    });
  };

  const formatBalance = (balanceInCents?: number) => {
    if (typeof balanceInCents !== 'number') return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(balanceInCents / 100);
  };
  
  const toDate = (timestamp: Date | Timestamp): Date => {
    if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
    }
    return timestamp;
  };

  return (
    <>
    <div className="w-full mx-auto space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-1">
                 <Card className="w-full">
                    <CardHeader>
                        <CardTitle>Create a Gift</CardTitle>
                        <CardDescription>Select a brand and amount to generate a shareable gift link.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form ref={createFormRef} action={createGiftAction} className="space-y-6">
                            <input type="hidden" name="userId" value={user?.uid || ''} />
                            <div className="space-y-2">
                                <Label htmlFor="brandCode">Brand</Label>
                                <Select name="brandCode" required>
                                <SelectTrigger id="brandCode">
                                    <SelectValue placeholder="Select a brand..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {brands.length > 0 ? brands.map(brand => (
                                        <SelectItem key={brand.brand_code} value={brand.brand_code}>
                                            {brand.name}
                                        </SelectItem>
                                    )) : (
                                        <div className="p-4 text-center text-sm text-muted-foreground">Loading brands...</div>
                                    )}
                                </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amountInCents">Amount (USD)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                    <Input 
                                        id="amountInCents" 
                                        name="amountInCents" 
                                        type="number"
                                        step="0.01"
                                        placeholder="25.00" 
                                        required
                                        className="pl-6"
                                    />
                                </div>
                            </div>
                            <CreateGiftSubmitButton />
                        </form>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Gift Log</CardTitle>
                        <CardDescription>A record of all the gift links you've created.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingGifts ? (
                            <p>Loading your gifts...</p>
                        ) : gifts.length > 0 ? (
                           <div className="border rounded-lg overflow-x-auto">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Brand</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="w-[120px] text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gifts.map(gift => (
                                        <TableRow key={gift.id}>
                                            <TableCell className="font-medium">{gift.brandName}</TableCell>
                                            <TableCell>{formatBalance(gift.amountInCents)}</TableCell>
                                            <TableCell>{format(toDate(gift.createdAt), 'MMM d, yyyy')}</TableCell>
                                            <TableCell className="text-right">
                                                <Button onClick={() => handleCopy(gift.claimUrl)} size="sm">
                                                    <Copy className="mr-2 h-3 w-3"/>
                                                    Copy Link
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                           </div>
                        ) : (
                            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                                <GiftIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="text-xl font-medium mt-4">No Gifts Created Yet</h3>
                                <p className="text-muted-foreground mt-2">
                                Use the form to create your first gift link.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
    </>
  );
}
