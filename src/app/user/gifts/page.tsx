
"use client";

import { useState, useEffect, useActionState, useRef, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Gift as GiftIcon, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { getGiftbitBrands, sendGift, getGiftLog } from './actions';
import type { GiftbitBrand, Gift } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';


function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : 'Send Gift'}
    </Button>
  );
}

export default function GiftsPage() {
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [brands, setBrands] = useState<GiftbitBrand[]>([]);
  const [giftLog, setGiftLog] = useState<Gift[]>([]);
  const [amountValue, setAmountValue] = useState("");
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [sendGiftState, sendGiftAction, isPending] = useActionState(sendGift, {
    success: false,
    message: '',
  });
  
  useEffect(() => {
    async function fetchBrands() {
        const fetchedBrands = await getGiftbitBrands();
        const sortedBrands = fetchedBrands.sort((a, b) => a.name.localeCompare(b.name));
        setBrands(sortedBrands);
    }
    fetchBrands();
  }, []);

  const fetchGiftLog = useCallback(async () => {
    if (!user?.uid) return;
    const log = await getGiftLog(user.uid);
    setGiftLog(log as Gift[]);
  }, [user]);

  useEffect(() => {
    fetchGiftLog();
  }, [fetchGiftLog]);

  useEffect(() => {
    if (sendGiftState.message) {
      toast({
        title: sendGiftState.success ? 'Success!' : 'Error',
        description: sendGiftState.message,
        variant: sendGiftState.success ? 'default' : 'destructive',
      });
      if (sendGiftState.success) {
        setIsDialogOpen(false);
        formRef.current?.reset();
        setAmountValue("");
        fetchGiftLog(); // Refresh the log
      }
    }
  }, [sendGiftState, toast, fetchGiftLog]);

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
  
  const toDate = (timestamp: any): Date => {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    return new Date(timestamp);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = value.replace(/[^0-9.]/g, '');
    const parts = numericValue.split('.');
    
    if (parts.length > 2) {
      return;
    }

    if (parts[1] && parts[1].length > 2) {
      parts[1] = parts[1].substring(0, 2);
    }

    setAmountValue(parts.join('.'));
  };

  const handleAmountBlur = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setAmountValue(value.toFixed(2));
    }
  };


  return (
    <div className="w-full mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-grow">
          <h1 className="text-3xl font-bold tracking-tight font-headline">Gifts</h1>
          <p className="text-muted-foreground">
            Send digital gift cards to your clients and leads.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) {
            setAmountValue("");
            formRef.current?.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <PlusCircle className="mr-2" /> Send a Gift
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Send a Gift</DialogTitle>
              <DialogDescription>
                Fill out the details below to send a digital gift card. The cost will be deducted from your available balance.
              </DialogDescription>
            </DialogHeader>
            <form ref={formRef} action={sendGiftAction} className="space-y-4 py-4">
                <input type="hidden" name="userId" value={user?.uid || ''} />
                <div className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="recipientName">Recipient Name</Label>
                        <Input id="recipientName" name="recipientName" placeholder="John Doe" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="recipientEmail">Recipient Email</Label>
                        <Input id="recipientEmail" name="recipientEmail" type="email" placeholder="name@example.com" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="brandCode">Brand</Label>
                        <Select name="brandCode" required>
                           <SelectTrigger id="brandCode">
                               <SelectValue placeholder="Select a brand" />
                           </SelectTrigger>
                           <SelectContent>
                            {brands.length > 0 ? (
                                brands.map(brand => (
                                    <SelectItem key={brand.brand_code} value={brand.brand_code}>
                                        {brand.name}
                                    </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="loading" disabled>Loading brands...</SelectItem>
                            )}
                           </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amountInCents">Amount (USD)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input 
                                id="amountInCents" 
                                name="amountInCents" 
                                type="text" 
                                inputMode="decimal"
                                placeholder="25.00" 
                                required
                                value={amountValue}
                                onChange={handleAmountChange}
                                onBlur={handleAmountBlur}
                                className="pl-6"
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <SubmitButton />
                </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

       <Card>
        <CardHeader>
            <CardTitle>Gift Log</CardTitle>
            <CardDescription>A record of all the gifts you've sent.</CardDescription>
        </CardHeader>
        <CardContent>
            {giftLog.length > 0 ? (
                 <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Recipient</TableHead>
                                <TableHead>Gift</TableHead>
                                <TableHead className="hidden sm:table-cell">Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                           {giftLog.map((gift) => (
                               <TableRow key={gift.id}>
                                   <TableCell>
                                       <div className="font-medium">{gift.recipientName}</div>
                                       <div className="text-sm text-muted-foreground">{gift.recipientEmail}</div>
                                   </TableCell>
                                   <TableCell>
                                        <div className="font-medium">{formatBalance(gift.amountInCents)}</div>
                                        <div className="text-sm text-muted-foreground">{gift.brandName}</div>
                                   </TableCell>
                                   <TableCell className="hidden sm:table-cell">
                                       {format(toDate(gift.createdAt), 'MMM d, yyyy')}
                                   </TableCell>
                                   <TableCell>
                                        <Badge variant={gift.status === 'delivered' ? 'secondary' : 'default'}>
                                            {gift.status.charAt(0).toUpperCase() + gift.status.slice(1)}
                                        </Badge>
                                   </TableCell>
                                   <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => handleCopy(gift.claimUrl)}>
                                            <Copy className="mr-2"/>
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
                    <h3 className="text-xl font-medium mt-4">No Gifts Sent Yet</h3>
                    <p className="text-muted-foreground mt-2">
                        Click "Send a Gift" to get started.
                    </p>
                </div>
            )}
        </CardContent>
       </Card>
    </div>
  );
}
