
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Copy, Loader2, Gift } from 'lucide-react';
import { createGiftLink } from './actions';
import type { Gift } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function CreateGiftSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : 'Create Gift Link'}
    </Button>
  );
}


export default function GiftsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);

  const [amountValue, setAmountValue] = useState("");
  const [createdGift, setCreatedGift] = useState<Gift | null>(null);

  const { toast } = useToast();
  const createFormRef = useRef<HTMLFormElement>(null);

  const [createGiftState, createGiftAction] = useActionState(createGiftLink, {
    success: false,
    message: '',
  });

  
  // Handle result of creating a gift link
  useEffect(() => {
    if (!createGiftState.success && createGiftState.message) {
        toast({
            title: 'Error',
            description: createGiftState.message,
            variant: 'destructive',
        });
    } else if (createGiftState.success && createGiftState.gift) {
        setIsCreateDialogOpen(false);
        createFormRef.current?.reset();
        setAmountValue("");
        setCreatedGift(createGiftState.gift);
        setIsSuccessDialogOpen(true);
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
    <>
    <div className="w-full mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-grow">
          <h1 className="text-3xl font-bold tracking-tight font-headline">Gifts</h1>
          <p className="text-muted-foreground">
            Create gift links to send to your clients and leads.
          </p>
        </div>
      </div>

       <Card>
        <CardHeader>
            <CardTitle>Create a Gift</CardTitle>
            <CardDescription>Enter an amount to generate a shareable gift link that the recipient can use for any available brand.</CardDescription>
        </CardHeader>
        <CardContent>
            <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => {
              setIsCreateDialogOpen(isOpen);
              if (!isOpen) {
                setAmountValue("");
                createFormRef.current?.reset();
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2" /> Create a Gift
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create a Gift Link</DialogTitle>
                  <DialogDescription>
                    Enter an amount to generate a link. The recipient can choose their preferred brand.
                  </DialogDescription>
                </DialogHeader>
                <form ref={createFormRef} action={createGiftAction} className="space-y-4 py-4">
                    <div className="space-y-4">
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
                      <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                      <CreateGiftSubmitButton />
                    </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        </CardContent>
       </Card>
    </div>

    {/* Success Dialog */}
     <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Gift Link Created!</DialogTitle>
                <DialogDescription>
                    Your {formatBalance(createdGift?.amountInCents)} gift link is ready. The recipient can choose any available brand. You can copy the link now to send it.
                </DialogDescription>
            </DialogHeader>
             <div className="space-y-4 py-4">
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
