
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
import { PlusCircle, Gift as GiftIcon, Copy, Loader2, Send } from 'lucide-react';
import { createGiftLink, getGiftLog, getGiftbitBrands, sendGiftByEmail } from './actions';
import type { GiftbitBrand, Gift } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';


function CreateGiftSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : 'Create Gift Link'}
    </Button>
  );
}

function SendEmailSubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <><Send className="mr-2"/> Send Email</>}
        </Button>
    )
}

export default function GiftsPage() {
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);

  const [brands, setBrands] = useState<GiftbitBrand[]>([]);
  const [giftLog, setGiftLog] = useState<Gift[]>([]);
  const [amountValue, setAmountValue] = useState("");
  const [giftToSend, setGiftToSend] = useState<Gift | null>(null);
  const [createdGift, setCreatedGift] = useState<Gift | null>(null);

  const { toast } = useToast();
  const createFormRef = useRef<HTMLFormElement>(null);
  const sendFormRef = useRef<HTMLFormElement>(null);

  const [createGiftState, createGiftAction] = useActionState(createGiftLink, {
    success: false,
    message: '',
  });

  const [sendEmailState, sendEmailAction] = useActionState(sendGiftByEmail, {
    success: false,
    message: ''
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

  // Handle result of creating a gift link
  useEffect(() => {
    if (createGiftState.message && createGiftState.success) {
      setIsCreateDialogOpen(false);
      createFormRef.current?.reset();
      setAmountValue("");
      fetchGiftLog(); 
      if (createGiftState.gift) {
        setCreatedGift(createGiftState.gift);
        setIsSuccessDialogOpen(true);
      }
    } else if (createGiftState.message && !createGiftState.success) {
        toast({
            title: 'Error',
            description: createGiftState.message,
            variant: 'destructive',
        });
    }
  }, [createGiftState, toast, fetchGiftLog]);

  // Handle result of sending a gift email
  useEffect(() => {
    if (sendEmailState.message) {
        toast({
            title: sendEmailState.success ? 'Success' : 'Error',
            description: sendEmailState.message,
            variant: sendEmailState.success ? 'default' : 'destructive',
        });
        if(sendEmailState.success) {
            setIsSendDialogOpen(false);
            sendFormRef.current?.reset();
            fetchGiftLog();
        }
    }
  }, [sendEmailState, toast, fetchGiftLog]);


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
    <>
    <div className="w-full mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-grow">
          <h1 className="text-3xl font-bold tracking-tight font-headline">Gifts</h1>
          <p className="text-muted-foreground">
            Create gift links and send them to your clients and leads.
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => {
          setIsCreateDialogOpen(isOpen);
          if (!isOpen) {
            setAmountValue("");
            createFormRef.current?.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <PlusCircle className="mr-2" /> Create a Gift
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create a Gift Link</DialogTitle>
              <DialogDescription>
                Select a brand and amount. The cost will be deducted from your available balance.
              </DialogDescription>
            </DialogHeader>
            <form ref={createFormRef} action={createGiftAction} className="space-y-4 py-4">
                <input type="hidden" name="userId" value={user?.uid || ''} />
                <div className="space-y-4">
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
                  <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                  <CreateGiftSubmitButton />
                </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

       <Card>
        <CardHeader>
            <CardTitle>Gift Log</CardTitle>
            <CardDescription>A record of all the gifts you've created.</CardDescription>
        </CardHeader>
        <CardContent>
            {giftLog.length > 0 ? (
                 <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Gift</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Recipient</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                           {giftLog.map((gift) => (
                               <TableRow key={gift.id}>
                                   <TableCell>
                                        <div className="font-medium">{formatBalance(gift.amountInCents)}</div>
                                        <div className="text-sm text-muted-foreground">{gift.brandName}</div>
                                        <div className="text-xs text-muted-foreground mt-1">{format(toDate(gift.createdAt), 'MMM d, yyyy')}</div>
                                   </TableCell>
                                   <TableCell>
                                        <Badge variant={gift.status === 'created' ? 'outline' : 'secondary'} className={cn(gift.status === 'sent' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300')}>
                                            {gift.status.charAt(0).toUpperCase() + gift.status.slice(1)}
                                        </Badge>
                                   </TableCell>
                                   <TableCell>
                                        {gift.recipientName ? (
                                            <div>
                                                <div className="font-medium">{gift.recipientName}</div>
                                                <div className="text-sm text-muted-foreground">{gift.recipientEmail}</div>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground italic">Unsent</span>
                                        )}
                                   </TableCell>
                                   <TableCell className="text-right space-x-2">
                                        <Button variant="outline" size="sm" onClick={() => handleCopy(gift.claimUrl)}>
                                            <Copy className="mr-2"/>
                                            Copy Link
                                        </Button>
                                        {gift.status === 'created' && (
                                            <Button variant="default" size="sm" onClick={() => { setGiftToSend(gift); setIsSendDialogOpen(true); }}>
                                                <Send className="mr-2"/>
                                                Send
                                            </Button>
                                        )}
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
                        Click "Create a Gift" to get started.
                    </p>
                </div>
            )}
        </CardContent>
       </Card>
    </div>

    {/* Send Gift Dialog */}
    <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Send Gift</DialogTitle>
                <DialogDescription>
                    Enter recipient details to send the {formatBalance(giftToSend?.amountInCents)} {giftToSend?.brandName} gift card via email.
                </DialogDescription>
            </DialogHeader>
            <form ref={sendFormRef} action={sendEmailAction}>
                 <input type="hidden" name="giftId" value={giftToSend?.id || ''} />
                <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="recipientName">Recipient Name</Label>
                        <Input id="recipientName" name="recipientName" placeholder="John Doe" required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="recipientEmail">Recipient Email</Label>
                        <Input id="recipientEmail" name="recipientEmail" type="email" placeholder="name@example.com" required />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" type="button" onClick={() => setIsSendDialogOpen(false)}>Cancel</Button>
                    <SendEmailSubmitButton/>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>

    {/* Success Dialog */}
     <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Gift Link Created!</DialogTitle>
                <DialogDescription>
                    Your {formatBalance(createdGift?.amountInCents)} {createdGift?.brandName} gift link is ready. You can copy it now or send it from the Gift Log later.
                </DialogDescription>
            </DialogHeader>
             <div className="space-y-4 py-4">
                <Input readOnly value={createdGift?.claimUrl || ''} />
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
