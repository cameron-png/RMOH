
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { doc, getDoc, deleteDoc, Timestamp, collection, query, where, getDocs, addDoc, orderBy, updateDoc, writeBatch } from 'firebase/firestore';
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { Lead as LeadType, OpenHouse, FeedbackForm, FeedbackSubmission, UserProfile, Address, GiftbitBrand } from '@/lib/types';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';


import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Trash2, Activity, MessageSquare, Users, Power, QrCode, ExternalLink, Download, Loader2, Edit, Upload, Home, Gift, Zap, Info } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FeedbackFormSelector } from '@/components/feedback-form-selector';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getGiftConfigurationForUser } from '../../gifts/actions';

const addressFormSchema = z.object({
  streetNumber: z.string().min(1, "Street number is required."),
  streetName: z.string().min(1, "Street name is required."),
  unitNumber: z.string().optional(),
  city: z.string().min(1, "City is required."),
  state: z.string().min(2, "State is required.").max(2, "Use 2-letter abbreviation."),
  zipCode: z.string().min(5, "Zip code must be 5 digits.").max(5, "Zip code must be 5 digits."),
});

const giftAutomationSchema = z.object({
    isGiftEnabled: z.boolean(),
    giftBrandCode: z.string().optional(),
    giftAmount: z.string().optional(),
}).refine(data => {
    if (data.isGiftEnabled) {
        return !!data.giftBrandCode && !!data.giftAmount;
    }
    return true;
}, {
    message: "Brand and amount are required when gifts are enabled.",
    path: ["giftBrandCode"], // Attach error to a field
});


export default function OpenHouseDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const [openHouse, setOpenHouse] = useState<OpenHouse | null>(null);
  const [feedbackForms, setFeedbackForms] = useState<FeedbackForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [leads, setLeads] = useState<LeadType[]>([]);
  const [feedbackSubmissions, setFeedbackSubmissions] = useState<FeedbackSubmission[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDeleteImageDialogOpen, setIsDeleteImageDialogOpen] = useState(false);

  const [brands, setBrands] = useState<GiftbitBrand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<GiftbitBrand | null>(null);
  

  const id = params.id as string;
  
  const addressForm = useForm<z.infer<typeof addressFormSchema>>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      streetNumber: '',
      streetName: '',
      unitNumber: '',
      city: '',
      state: '',
      zipCode: ''
    }
  });

   const giftAutomationForm = useForm<z.infer<typeof giftAutomationSchema>>({
    resolver: zodResolver(giftAutomationSchema),
    defaultValues: {
      isGiftEnabled: false,
      giftBrandCode: '',
      giftAmount: '',
    },
  });


  const fetchOpenHouseData = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    setLoadingStats(true);
    setError(null);

    try {
      // Fetch open house data
      const docRef = doc(db, 'openHouses', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const houseData = { id: docSnap.id, ...docSnap.data() } as OpenHouse;
        if (houseData.userId !== user.uid) {
          setError("You don't have permission to view this page.");
          setOpenHouse(null);
        } else {
          setOpenHouse(houseData);
          
          // Fetch forms
          const globalQuery = query(collection(db, 'feedbackForms'), where('type', '==', 'global'));
          const customQuery = query(collection(db, 'feedbackForms'), where('type', '==', 'custom'), where('userId', '==', user.uid));
          const [globalSnapshot, customSnapshot] = await Promise.all([ getDocs(globalQuery), getDocs(customQuery) ]);
          const allForms = [
              ...globalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackForm)),
              ...customSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackForm)),
          ];
          setFeedbackForms(allForms);

          // Fetch stats and details for PDF
          const leadsQuery = query(
              collection(db, "leads"),
              where("openHouseId", "==", id),
              where("userId", "==", user.uid)
          );
           const feedbackQuery = query(
                collection(db, "feedbackSubmissions"),
                where("openHouseId", "==", id),
                where("userId", "==", user.uid)
            );

          const [leadsSnapshot, feedbackSnapshot] = await Promise.all([ getDocs(leadsQuery), getDocs(feedbackQuery) ]);

          setLeads(leadsSnapshot.docs.map(d => d.data() as LeadType));
          setFeedbackSubmissions(feedbackSnapshot.docs.map(d => d.data() as FeedbackSubmission));
        }
      } else {
        setError('Open house not found.');
        setOpenHouse(null);
      }
    } catch (err) {
      console.error("Error fetching document:", err);
      if ((err as any).code === 'permission-denied') {
          setError('You do not have permission to view these records.');
      } else {
          setError('Failed to fetch open house details.');
      }
      setOpenHouse(null);
    } finally {
        setLoading(false);
        setLoadingStats(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (!authLoading && user) {
        fetchOpenHouseData();
    }
  }, [authLoading, user, fetchOpenHouseData]);
  
  useEffect(() => {
    if (openHouse?.structuredAddress) {
      addressForm.reset(openHouse.structuredAddress);
    } else if (openHouse) {
      // Basic parser for older address strings
      const parts = openHouse.address.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        const streetParts = parts[0].split(' ');
        const streetNumber = streetParts.length > 1 ? streetParts[0] : '';
        const streetName = streetParts.length > 1 ? streetParts.slice(1).join(' ') : parts[0];
        const city = parts[1];
        const stateZip = parts[2].split(' ');
        const state = stateZip[0];
        const zipCode = stateZip[1] || '';
        addressForm.reset({ streetNumber, streetName, city, state, zipCode, unitNumber: '' });
      }
    }
  }, [openHouse, addressForm]);

  useEffect(() => {
    async function loadConfiguration() {
      if (!user) return;
      setLoadingBrands(true);
      try {
        const { brands } = await getGiftConfigurationForUser();
        setBrands(brands);
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load gift brands.' });
      } finally {
        setLoadingBrands(false);
      }
    }
    loadConfiguration();
  }, [toast, user]);

  useEffect(() => {
    if (openHouse && brands.length > 0) {
      giftAutomationForm.reset({
        isGiftEnabled: openHouse.isGiftEnabled || false,
        giftBrandCode: openHouse.giftBrandCode || '',
        giftAmount: openHouse.giftAmountInCents ? (openHouse.giftAmountInCents / 100).toString() : '',
      });
      if (openHouse.giftBrandCode) {
        const brand = brands.find(b => b.brand_code === openHouse.giftBrandCode);
        setSelectedBrand(brand || null);
      }
    }
  }, [openHouse, brands, giftAutomationForm]);


  const handleSetForm = async (houseId: string, formId: string) => {
    const houseDocRef = doc(db, 'openHouses', houseId);
    try {
        await updateDoc(houseDocRef, { feedbackFormId: formId });
        await fetchOpenHouseData(); // Refresh data
    } catch (err) {
        console.error("Error setting feedback form:", err);
    }
  };

  const handleSetActive = async (houseIdToActivate: string) => {
    if (!user) return;
    const batch = writeBatch(db);
    
    // Find any currently active house for this user
    const q = query(collection(db, 'openHouses'), where('userId', '==', user.uid), where('isActive', '==', true));
    const activeHousesSnapshot = await getDocs(q);

    activeHousesSnapshot.forEach(doc => {
      if (doc.id !== houseIdToActivate) {
        batch.update(doc.ref, { isActive: false });
      }
    });

    const newActiveRef = doc(db, 'openHouses', houseIdToActivate);
    batch.update(newActiveRef, { isActive: true });

    try {
        await batch.commit();
        await fetchOpenHouseData();
    } catch(err) {
        console.error("Error setting active open house:", err);
    }
  };

  const handleDelete = async () => {
    if (!user || !openHouse) return;
    setIsDeleting(true);
    try {
        if (openHouse.imageUrl) {
            const imageRef = ref(storage, openHouse.imageUrl);
            await deleteObject(imageRef).catch((error) => {
                if (error.code !== 'storage/object-not-found') {
                    throw error;
                }
            });
        }
        
        await deleteDoc(doc(db, 'openHouses', openHouse.id));

        router.push('/user/dashboard');
    } catch(err) {
        console.error("Error deleting open house:", err);
        setIsDeleting(false);
    }
  };
  
  async function onAddressSubmit(values: z.infer<typeof addressFormSchema>) {
    if (!user || !openHouse) return;
    
    const { streetNumber, streetName, unitNumber, city, state, zipCode } = values;
    
    const newAddressString = `${streetNumber} ${streetName}${unitNumber ? ` #${unitNumber}` : ''}, ${city}, ${state.toUpperCase()} ${zipCode}`;
    const newStructuredAddress: Address = values;
    
    try {
        const houseDocRef = doc(db, 'openHouses', openHouse.id);
        await updateDoc(houseDocRef, {
            address: newAddressString,
            structuredAddress: newStructuredAddress,
        });
        
        setIsEditAddressOpen(false);
        await fetchOpenHouseData();

    } catch(err) {
        console.error("Error updating address:", err);
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user || !openHouse) return;

    const file = event.target.files[0];
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        return;
    }

    setIsUploadingImage(true);

    const imageRef = ref(storage, `open-house-images/${user.uid}/${openHouse.id}/${uuidv4()}`);

    try {
        const snapshot = await uploadBytes(imageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        const houseDocRef = doc(db, 'openHouses', openHouse.id);
        await updateDoc(houseDocRef, { imageUrl: downloadURL });

        setOpenHouse(prev => prev ? { ...prev, imageUrl: downloadURL } : null);
    } catch (error) {
        console.error("Error uploading image:", error);
    } finally {
        setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!openHouse || !openHouse.imageUrl) return;
    
    try {
      // Delete from storage
      const imageRef = ref(storage, openHouse.imageUrl);
      await deleteObject(imageRef);
      
      // Update Firestore
      const houseDocRef = doc(db, 'openHouses', openHouse.id);
      await updateDoc(houseDocRef, { imageUrl: null });

      setOpenHouse(prev => prev ? { ...prev, imageUrl: undefined } : null);

    } catch (error) {
      console.error("Error removing image:", error);
    } finally {
      setIsDeleteImageDialogOpen(false);
    }
  };
  
    const onGiftAutomationSubmit = async (data: z.infer<typeof giftAutomationSchema>) => {
        if (!openHouse) return;

        let amountInCents: number | undefined = undefined;
        if (data.isGiftEnabled && data.giftAmount) {
            amountInCents = Math.round(parseFloat(data.giftAmount) * 100);
        }
        
        const selectedBrandData = brands.find(b => b.brand_code === data.giftBrandCode);

        const houseDocRef = doc(db, 'openHouses', openHouse.id);
        try {
            await updateDoc(houseDocRef, {
                isGiftEnabled: data.isGiftEnabled,
                giftBrandCode: data.isGiftEnabled ? data.giftBrandCode : null,
                giftBrandName: data.isGiftEnabled ? selectedBrandData?.name : null,
                giftAmountInCents: data.isGiftEnabled ? amountInCents : null,
            });
            await fetchOpenHouseData();
            toast({ title: 'Gift settings updated successfully!' });
        } catch (error) {
            console.error("Error updating gift settings:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save gift settings.' });
        }
    };

    const handleBrandChange = (brandCode: string) => {
        const brand = brands.find(b => b.brand_code === brandCode);
        setSelectedBrand(brand || null);
        giftAutomationForm.setValue('giftBrandCode', brandCode, { shouldDirty: true });
        giftAutomationForm.setValue('giftAmount', '', { shouldDirty: true }); // Reset amount on brand change
    };
  
  if (loading || authLoading) return <p className="text-muted-foreground">Loading details...</p>;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!openHouse) return <p className="text-muted-foreground">Open house not found or you do not have permission to view it.</p>;
  
  const addressParts = openHouse.address.split(',');
  const streetAddress = addressParts[0];
  const cityStateZip = addressParts.length > 1 ? addressParts.slice(1).join(',').trim() : '';

  const StatusCard = () => (
    <Card className="flex flex-col h-full hover:bg-muted/50 transition-colors">
        <CardHeader className="flex-grow pb-2">
            <div className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
        </CardHeader>
        <CardContent>
            {openHouse.isActive ? (
                <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">Active</div>
                    <Badge className="bg-green-600 text-white hover:bg-green-600">
                        <QrCode className="mr-1"/> Live
                    </Badge>
                </div>
            ) : (
                <div className="text-2xl font-bold">Inactive</div>
            )}
        </CardContent>
    </Card>
  );


  return (
    <>
    <TooltipProvider>
    <div className="w-full mx-auto space-y-8">
      <div>
        <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span>Back to Dashboard</span>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
        <div className="w-full md:w-48 h-48 md:h-32 relative rounded-md overflow-hidden border flex-shrink-0 bg-muted group">
            {openHouse.imageUrl ? (
                <Image 
                    src={openHouse.imageUrl}
                    alt={`Image of ${openHouse.address}`}
                    fill
                    className="object-cover"
                    data-ai-hint="house exterior"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <Home className="w-12 h-12 text-muted-foreground"/>
                </div>
            )}
             <div
                className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
            >
                 <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    aria-label="Upload image"
                >
                    {isUploadingImage ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                </button>
                {openHouse.imageUrl && (
                    <button
                        onClick={() => setIsDeleteImageDialogOpen(true)}
                        className="p-2 rounded-full bg-destructive/80 text-white hover:bg-destructive transition-colors"
                        aria-label="Remove image"
                    >
                        <Trash2 className="h-6 w-6" />
                    </button>
                )}
            </div>
            <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageUpload}
                className="hidden"
                accept="image/png, image/jpeg, image/gif"
            />
        </div>
        <div className="flex-grow pt-1 w-full">
            <div className="flex flex-col sm:flex-row justify-between sm:items-start">
                <div>
                     <div className="flex items-center gap-2">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">{streetAddress}</h1>
                        <Button variant="ghost" size="icon" onClick={() => setIsEditAddressOpen(true)} className="flex-shrink-0">
                            <Edit className="h-5 w-5 text-muted-foreground" />
                        </Button>
                    </div>
                    <p className="text-muted-foreground">{cityStateZip}</p>
                </div>
            </div>
             <p className="text-sm text-muted-foreground mt-2">
                Created on {openHouse.createdAt ? new Date(openHouse.createdAt.toDate()).toLocaleDateString() : 'N/A'}
            </p>
        </div>
      </div>
      
       <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card asChild className="hover:bg-muted/50 transition-colors h-full">
          <Link href={`/user/my-leads?house=${openHouse.id}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loadingStats ? '...' : leads.length}</div>
              </CardContent>
          </Link>
        </Card>
        <Card asChild className="hover:bg-muted/50 transition-colors h-full">
            <Link href={`/user/open-house/${openHouse.id}/feedback`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Feedback Responses</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{loadingStats ? '...' : feedbackSubmissions.length}</div>
                </CardContent>
            </Link>
        </Card>
        
        <div className="col-span-2 lg:col-span-1">
             {openHouse.isActive ? (
                <StatusCard/>
            ) : (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button className="w-full h-full text-left"><StatusCard/></button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Make Open House Active?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will make your QR code direct visitors to this property's feedback form. Any other active open house will be deactivated.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleSetActive(openHouse.id)}>
                            Yes, make active
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
            <CardHeader>
            <CardTitle>Feedback Form</CardTitle>
            <CardDescription>Select which form visitors will see when they scan your QR code for this property.</CardDescription>
            </CardHeader>
            <CardContent>
            <div className="max-w-md">
                <FeedbackFormSelector
                    forms={feedbackForms}
                    selectedFormId={openHouse.feedbackFormId}
                    onFormSelect={(formId) => handleSetForm(openHouse.id, formId)}
                    triggerClassName="w-full"
                />
            </div>
            </CardContent>
        </Card>
        <Form {...giftAutomationForm}>
            <form onSubmit={giftAutomationForm.handleSubmit(onGiftAutomationSubmit)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Gifts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField
                            control={giftAutomationForm.control}
                            name="isGiftEnabled"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enable Automated Gifts</FormLabel>
                                        <FormDescription>
                                            Automatically queue a gift for each lead.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        {giftAutomationForm.watch('isGiftEnabled') && (
                            <div className="space-y-4">
                                <FormField
                                    control={giftAutomationForm.control}
                                    name="giftBrandCode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Gift Card Brand</FormLabel>
                                            <Select onValueChange={handleBrandChange} value={field.value} disabled={loadingBrands}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={loadingBrands ? "Loading..." : "Select a brand"} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {loadingBrands ? (
                                                        <div className="flex items-center justify-center p-4">
                                                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                        </div>
                                                    ) : brands.length > 0 ? (
                                                        brands.map(brand => (
                                                            <SelectItem key={brand.brand_code} value={brand.brand_code}>{brand.name}</SelectItem>
                                                        ))
                                                    ) : (
                                                        <div className="text-center p-4 text-sm text-muted-foreground">No brands enabled.</div>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={giftAutomationForm.control}
                                    name="giftAmount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Amount</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="Enter amount in dollars, e.g., 10.00"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={giftAutomationForm.formState.isSubmitting}>
                           {giftAutomationForm.formState.isSubmitting ? "Saving..." : "Save Gift Settings"}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
      </div>
      
      <Separator />
      
      <Card className="border-destructive">
          <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>This is a permanent action and cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete Open House</span>
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your
                        open house listing and all associated lead logs.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? "Deleting..." : "Yes, delete it"}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </CardContent>
      </Card>

    </div>
    </TooltipProvider>
    
    <Dialog open={isEditAddressOpen} onOpenChange={setIsEditAddressOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Address</DialogTitle>
                <DialogDescription>
                    Update the address details for this open house.
                </DialogDescription>
            </DialogHeader>
            <Form {...addressForm}>
                <form onSubmit={addressForm.handleSubmit(onAddressSubmit)} className="space-y-4 py-4">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-1">
                            <FormField control={addressForm.control} name="streetNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Number</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                        </div>
                        <div className="col-span-3">
                             <FormField control={addressForm.control} name="streetName" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Street Name</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                        </div>
                    </div>
                     <FormField control={addressForm.control} name="unitNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Unit Number (Optional)</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <div className="grid grid-cols-3 gap-4">
                         <div className="col-span-2">
                             <FormField control={addressForm.control} name="city" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>City</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                         </div>
                        <FormField control={addressForm.control} name="state" render={({ field }) => (
                            <FormItem>
                                <FormLabel>State</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                    </div>
                     <FormField control={addressForm.control} name="zipCode" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Zip Code</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsEditAddressOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={addressForm.formState.isSubmitting}>
                            {addressForm.formState.isSubmitting ? "Saving..." : "Save Address"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    <AlertDialog open={isDeleteImageDialogOpen} onOpenChange={setIsDeleteImageDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently remove the image for this open house. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveImage} className="bg-destructive hover:bg-destructive/90">
                    Yes, remove image
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
