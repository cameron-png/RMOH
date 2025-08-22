
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, where, onSnapshot, orderBy, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Gift, GiftbitBrand, OpenHouse } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Gift as GiftIcon, PlusCircle, Loader2, Settings, Info, ExternalLink, ThumbsUp, ThumbsDown, Home, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getGiftConfigurationForUser, confirmPendingGift, declinePendingGift } from './actions';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

const giftFormSchema = z.object({
  recipientName: z.string().min(2, "Please enter the recipient's name."),
  recipientEmail: z.string().email("Please enter a valid email address."),
  brand: z.string().min(1, "Please select a brand."),
  amount: z.string().min(1, "Please enter an amount."),
  message: z.string().optional(),
});


export default function GiftsPage() {
  const { user, availableBalance, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [openHouses, setOpenHouses] = useState<Map<string, OpenHouse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const [brands, setBrands] = useState<GiftbitBrand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<GiftbitBrand | null>(null);

  const [giftToConfirm, setGiftToConfirm] = useState<Gift | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const [giftToDecline, setGiftToDecline] = useState<Gift | null>(null);
  const [isDeclining, setIsDeclining] = useState(false);
  
  const [isCreateConfirmOpen, setIsCreateConfirmOpen] = useState(false);
  const [giftDataToCreate, setGiftDataToCreate] = useState<z.infer<typeof giftFormSchema> | null>(null);
  const [showCustomAmount, setShowCustomAmount] = useState(false);


  const form = useForm<z.infer<typeof giftFormSchema>>({
    resolver: zodResolver(giftFormSchema),
    defaultValues: {
      recipientName: '',
      recipientEmail: '',
      brand: '',
      amount: '',
      message: '',
    },
  });
  
  const handleBrandChange = (brandCode: string) => {
    const brand = brands.find(b => b.brand_code === brandCode);
    setSelectedBrand(brand || null);
    form.setValue('brand', brandCode);
    form.setValue('amount', ''); // Reset amount when brand changes
    setShowCustomAmount(false);
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

  const fetchGiftsAndHouses = useCallback(() => {
    if (!user) return;

    setLoading(true);
    const giftsQuery = query(
        collection(db, 'gifts'), 
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(giftsQuery, async (giftsSnapshot) => {
        const giftsData = giftsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gift));
        setGifts(giftsData);

        // Fetch associated open houses
        const houseIds = [...new Set(giftsData.map(g => g.openHouseId).filter(Boolean))];
        if (houseIds.length > 0) {
            const housesQuery = query(collection(db, 'openHouses'), where('userId', '==', user.uid));
            const housesSnapshot = await onSnapshot(housesQuery, (snapshot) => {
              const housesMap = new Map<string, OpenHouse>();
              snapshot.forEach(doc => housesMap.set(doc.id, { id: doc.id, ...doc.data()} as OpenHouse));
              setOpenHouses(housesMap);
            });
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching gifts:", error);
        setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const sortedGifts = useMemo(() => {
    return [...gifts].sort((a, b) => {
        if (a.status === 'Pending' && b.status !== 'Pending') return -1;
        if (a.status !== 'Pending' && b.status === 'Pending') return 1;
        return (b.createdAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0);
    });
  }, [gifts]);

  useEffect(() => {
    const unsubscribe = fetchGiftsAndHouses();
    return () => unsubscribe?.();
  }, [fetchGiftsAndHouses]);

  useEffect(() => {
    async function loadConfiguration() {
      if (!user) return;

      setLoadingBrands(true);
      try {
        const { brands } = await getGiftConfigurationForUser();
        setBrands(brands);
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
        loadConfiguration();
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

    setGiftDataToCreate(values);
    setIsCreateConfirmOpen(true);
  }
  
  const handleConfirmCreateGift = async () => {
    if (!user || !giftDataToCreate) return;
    
    try {
        const newGiftData: Omit<Gift, 'id'> = {
            userId: user.uid,
            recipientName: giftDataToCreate.recipientName,
            recipientEmail: giftDataToCreate.recipientEmail,
            brandCode: giftDataToCreate.brand,
            amountInCents: Math.round(parseFloat(giftDataToCreate.amount) * 100),
            message: giftDataToCreate.message,
            type: 'Manual',
            status: 'Pending' as const,
            claimUrl: null,
            createdAt: Timestamp.now(),
        };

        const docRef = await addDoc(collection(db, "gifts"), newGiftData);

        toast({
            title: 'Gift Queued',
            description: 'Your gift is being processed and will appear in the log.',
        });
        
        setIsFormOpen(false);
        form.reset();
        setSelectedBrand(null);
        
        // Directly process the gift
        await confirmPendingGift(docRef.id);
        await refreshUserData();

    } catch (error: any) {
         toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not create the gift. Please try again.',
        });
    } finally {
        setIsCreateConfirmOpen(false);
        setGiftDataToCreate(null);
    }
  }


  const handleConfirmGift = async () => {
    if (!giftToConfirm) return;

    if ((availableBalance || 0) < giftToConfirm.amountInCents) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: `You need ${formatCurrency(giftToConfirm.amountInCents)} but only have ${formatCurrency(availableBalance || 0)}.`,
      });
      setGiftToConfirm(null);
      return;
    }

    setIsConfirming(true);
    try {
      await confirmPendingGift(giftToConfirm.id);
      toast({ title: 'Gift Confirmed', description: 'The gift is being sent to the recipient.' });
      await refreshUserData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Confirmation Failed', description: error.message });
    } finally {
      setIsConfirming(false);
      setGiftToConfirm(null);
    }
  };

  const handleDeclineGift = async () => {
    if (!giftToDecline) return;
    setIsDeclining(true);
    try {
      await declinePendingGift(giftToDecline.id);
      toast({ title: 'Gift Declined', description: 'The pending gift has been cancelled.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Decline Failed', description: error.message });
    } finally {
      setIsDeclining(false);
      setGiftToDecline(null);
    }
  };

    const AmountButton = ({ value }: { value: number }) => {
        const amountString = value.toString();
        const currentAmount = form.getValues('amount');
        return (
            <Button
                type="button"
                variant={currentAmount === amountString && !showCustomAmount ? 'default' : 'outline'}
                onClick={() => {
                    form.setValue('amount', amountString, { shouldValidate: true });
                    setShowCustomAmount(false);
                }}
            >
                ${value}
            </Button>
        );
    };
  
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
                     setShowCustomAmount(false);
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
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            </div>
                            <FormField
                                control={form.control}
                                name="brand"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Brand</FormLabel>
                                    <Select onValueChange={handleBrandChange} disabled={loadingBrands} value={field.value}>
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
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl>
                                        <>
                                            <div className="flex gap-2">
                                                <AmountButton value={5} />
                                                <AmountButton value={10} />
                                                <AmountButton value={15} />
                                                <Button
                                                    type="button"
                                                    variant={showCustomAmount ? 'default' : 'outline'}
                                                    onClick={() => {
                                                        setShowCustomAmount(true);
                                                        form.setValue('amount', '');
                                                    }}
                                                >
                                                    Custom
                                                </Button>
                                            </div>
                                            {showCustomAmount && (
                                                <Input 
                                                    type="number" 
                                                    placeholder="Enter amount" 
                                                    {...field}
                                                    className="mt-2"
                                                    autoFocus
                                                />
                                            )}
                                        </>
                                    </FormControl>
                                    <FormDescription className="text-xs h-4">{getAmountDescription()}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="message"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Message (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., Thank you for visiting!" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                     <Send className="mr-2 h-4 w-4" />
                                    {form.formState.isSubmitting ? 'Sending...' : 'Send Gift'}
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
                        {sortedGifts.map((gift) => {
                            const house = openHouses.get(gift.openHouseId || '');
                            const isPending = gift.status === 'Pending';
                            return (
                            <Card key={gift.id} className={cn(isPending && "bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800")}>
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
                                    {house && (
                                        <div className="flex justify-between items-center text-muted-foreground">
                                          <Link href={`/user/open-house/${house.id}`} className="flex items-center gap-2 hover:underline">
                                            <Home className="w-4 h-4" />
                                            <span className="truncate">{house.address}</span>
                                          </Link>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Status:</span>
                                        <Badge variant={gift.status === 'Sent' ? 'default' : gift.status === 'Failed' ? 'destructive' : gift.status === 'Pending' ? 'secondary' : 'outline'}>
                                            {gift.status}
                                        </Badge>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex gap-2">
                                     {gift.status === 'Pending' ? (
                                        <>
                                            <Button variant="outline" size="sm" className="flex-1" onClick={() => setGiftToDecline(gift)}><ThumbsDown className="mr-2"/>Decline</Button>
                                            <Button size="sm" className="flex-1" onClick={() => setGiftToConfirm(gift)}><ThumbsUp className="mr-2"/>Confirm</Button>
                                        </>
                                     ) : gift.claimUrl ? (
                                        <Button variant="outline" size="sm" asChild className="w-full">
                                            <a href={gift.claimUrl} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="mr-2 h-4 w-4" /> Open Gift
                                            </a>
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" className="w-full" disabled>
                                            Link Not Available
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        )})}
                    </div>
                    
                    {/* Desktop Table View */}
                    <div className="border rounded-lg hidden md:block overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Recipient</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Open House</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <span>Link / Actions</span>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="max-w-xs">
                                                            This is the recipient's live gift card link. It has already been emailed to them, but you can use this to open and resend it manually.
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedGifts.map((gift) => {
                                 const house = openHouses.get(gift.openHouseId || '');
                                 const isPending = gift.status === 'Pending';
                                 return (
                                <TableRow key={gift.id} className={cn(isPending && "bg-yellow-50 dark:bg-yellow-950/50 hover:bg-yellow-100 dark:hover:bg-yellow-950")}>
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
                                        {house ? (
                                             <Link href={`/user/open-house/${house.id}`} className="hover:underline text-xs truncate block max-w-[200px]">
                                                {house.address}
                                             </Link>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={gift.status === 'Sent' ? 'default' : gift.status === 'Failed' ? 'destructive' : gift.status === 'Pending' ? 'secondary' : 'outline'}>
                                            {gift.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {gift.status === 'Pending' ? (
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => setGiftToDecline(gift)}><ThumbsDown className="mr-2"/>Decline</Button>
                                                <Button size="sm" onClick={() => setGiftToConfirm(gift)}><ThumbsUp className="mr-2"/>Confirm</Button>
                                            </div>
                                        ) : gift.claimUrl ? (
                                            <Button variant="ghost" size="icon" asChild>
                                                <a href={gift.claimUrl} target="_blank" rel="noopener noreferrer" aria-label="Open Gift Link">
                                                    <ExternalLink />
                                                </a>
                                            </Button>
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                                )})}
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

    <AlertDialog open={isCreateConfirmOpen} onOpenChange={setIsCreateConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm New Gift</AlertDialogTitle>
                <AlertDialogDescription>
                    This will send a {giftDataToCreate ? formatCurrency(Math.round(parseFloat(giftDataToCreate.amount) * 100)) : ''} gift to {giftDataToCreate?.recipientName} and deduct the cost from your account balance.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsCreateConfirmOpen(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmCreateGift} disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Sending..." : "Yes, Send Gift"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    <AlertDialog open={!!giftToConfirm} onOpenChange={(open) => !open && setGiftToConfirm(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Gift?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will send a {giftToConfirm ? formatCurrency(giftToConfirm.amountInCents) : ''} gift to {giftToConfirm?.recipientName} and deduct the cost from your balance. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setGiftToConfirm(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmGift} disabled={isConfirming}>
                    {isConfirming ? "Confirming..." : "Yes, Send Gift"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={!!giftToDecline} onOpenChange={(open) => !open && setGiftToDecline(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Decline Gift?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will cancel the pending gift for {giftToDecline?.recipientName}. This cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setGiftToDecline(null)}>Back</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeclineGift} disabled={isDeclining} className="bg-destructive hover:bg-destructive/90">
                    {isDeclining ? "Declining..." : "Yes, Decline"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    </>
  );
}
