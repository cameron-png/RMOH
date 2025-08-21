
"use client";

import { useState, useEffect, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Copy, Loader2 } from 'lucide-react';
import { createGiftLink } from './actions';
import type { Gift, GiftbitBrand } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listBrands } from '@/lib/giftbit';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [brands, setBrands] = useState<GiftbitBrand[]>([]);
  const [createdGift, setCreatedGift] = useState<Gift | null>(null);

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
      if (createGiftState.success && createGiftState.gift) {
        setCreatedGift(createGiftState.gift);
        setIsSuccessDialogOpen(true);
        createFormRef.current?.reset();
      } else if (!createGiftState.success) {
        toast({
            title: 'Error',
            description: createGiftState.message,
            variant: 'destructive',
        });
      }
    }
  }, [createGiftState, toast]);

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

  return (
    <>
    <div className="w-full mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-grow">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Gifts</h1>
            <p className="text-muted-foreground">
                Create a single gift link to send to your clients and leads.
            </p>
            </div>
        </div>

        <Card className="w-full max-w-md mx-auto">
            <CardHeader>
                <CardTitle>Create a Gift</CardTitle>
                <CardDescription>Select a brand and amount to generate a shareable gift link.</CardDescription>
            </CardHeader>
            <CardContent>
                <form ref={createFormRef} action={createGiftAction} className="space-y-6">
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

    {/* Success Dialog */}
     <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Gift Link Created!</DialogTitle>
                <DialogDescription>
                    Your {formatBalance(createdGift?.amountInCents)} gift link for {createdGift?.brandName} is ready.
                </DialogDescription>
            </DialogHeader>
             <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">Copy the link below and send it to your recipient.</p>
                <Input readOnly value={createdGift?.claimUrl || ''} className="bg-muted"/>
                <Button className="w-full" onClick={() => {
                    if (createdGift) handleCopy(createdGift.claimUrl);
                    setIsSuccessDialogOpen(false);
                }}>
                    <Copy className="mr-2" /> Copy Link and Close
                </Button>
            </div>
        </DialogContent>
     </Dialog>
    </>
  );
}
