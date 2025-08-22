
"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { collection, query, where, getDocs, addDoc, writeBatch, doc, Timestamp, updateDoc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { OpenHouse, Lead, FeedbackSubmission, AppSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { OpenHouseCard } from '@/components/open-house-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Loader } from '@googlemaps/js-api-loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { Users, Power, Search, ArrowUpDown, Gift } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';


const formSchema = z.object({
  address: z.string().min(10, {
    message: "Please enter a valid address.",
  }),
});

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([]);
  const [leadCounts, setLeadCounts] = useState<Map<string, number>>(new Map());
  const [feedbackCounts, setFeedbackCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const [newHouseId, setNewHouseId] = useState<string | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [pendingGiftsCount, setPendingGiftsCount] = useState(0);
  const [activeHouse, setActiveHouse] = useState<OpenHouse | null>(null);

  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      address: "",
    },
  });

  const fetchDashboardData = useCallback(async () => {
    if (!user) return; 

    setLoading(true);
    try {
      // Fetch open houses
      const housesQuery = query(
          collection(db, 'openHouses'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
      );
      const housesSnapshot = await getDocs(housesQuery);
      const houses = housesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OpenHouse));
      setOpenHouses(houses);

      // Find active house and new leads count
      const active = houses.find(h => h.isActive) || null;
      setActiveHouse(active);
      
      const oneWeekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const newLeadsQuery = query(
          collection(db, 'leads'),
          where('userId', '==', user.uid),
          where('createdAt', '>=', oneWeekAgo)
      );
      const newLeadsSnapshot = await getDocs(newLeadsQuery);
      setNewLeadsCount(newLeadsSnapshot.size);
      
      // Fetch pending gifts count
      const pendingGiftsQuery = query(
          collection(db, 'gifts'),
          where('userId', '==', user.uid),
          where('status', '==', 'Pending')
      );
      const pendingGiftsSnapshot = await getDocs(pendingGiftsQuery);
      setPendingGiftsCount(pendingGiftsSnapshot.size);

      if (houses.length === 0) {
        setLoading(false);
        return;
      }
      
      const houseIds = houses.map(h => h.id);
      
      // Fetch all leads to calculate counts per house
      const allLeadsQuery = query(collection(db, 'leads'), where('userId', '==', user.uid), where('openHouseId', 'in', houseIds));
      const leadsSnapshot = await getDocs(allLeadsQuery);

      const lCounts = new Map<string, number>();
      leadsSnapshot.forEach(doc => {
          const lead = doc.data() as Lead;
          lCounts.set(lead.openHouseId, (lCounts.get(lead.openHouseId) || 0) + 1);
      });
      setLeadCounts(lCounts);
      
      // Fetch all feedback to calculate counts per house
      const feedbackQuery = query(collection(db, 'feedbackSubmissions'), where('userId', '==', user.uid), where('openHouseId', 'in', houseIds));
      const feedbackSnapshot = await getDocs(feedbackQuery);
      
      const fCounts = new Map<string, number>();
      feedbackSnapshot.forEach(doc => {
          const submission = doc.data() as FeedbackSubmission;
          fCounts.set(submission.openHouseId, (fCounts.get(submission.openHouseId) || 0) + 1);
      });
      setFeedbackCounts(fCounts);

    } catch (error) {
      console.error("Error fetching dashboard data: ", error);
      toast({
        variant: "destructive",
        title: "Data Fetch Error",
        description: "Could not fetch your dashboard data.",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if(!authLoading && user) {
        fetchDashboardData();
    }
  }, [user, authLoading, fetchDashboardData]);
  
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && addressInputRef.current) {
      const loader = new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        version: "weekly",
        libraries: ["places"],
      });

      loader.load().then(() => {
        if (addressInputRef.current && !autocompleteRef.current) {
          autocompleteRef.current = new google.maps.places.Autocomplete(
            addressInputRef.current,
            {
              types: ["address"],
              componentRestrictions: { country: "us" },
            }
          );
          autocompleteRef.current.addListener("place_changed", () => {
            const place = autocompleteRef.current?.getPlace();
            if (place?.formatted_address) {
              form.setValue("address", place.formatted_address, { shouldValidate: true });
            }
          });
        }
      }).catch(e => {
          console.error("Failed to load Google Maps API", e);
      });
    }

    return () => {
        const pacContainers = document.querySelectorAll('.pac-container');
        pacContainers.forEach(container => container.remove());
    }
  }, [form]);
  
  const filteredAndSortedHouses = useMemo(() => {
    return openHouses
      .filter(house => house.address.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const dateA = a.createdAt ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt ? b.createdAt.toDate().getTime() : 0;
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      });
  }, [openHouses, searchTerm, sortOrder]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to create an open house.",
      });
      return;
    }

    try {
      const hadHousesBefore = openHouses.length > 0;
      
      // Determine the default form to use
      let defaultFormIdToSet: string | undefined = undefined;
      if (user.defaultFormId) {
        defaultFormIdToSet = user.defaultFormId;
      } else {
        const settingsDoc = await getDoc(doc(db, 'settings', 'appDefaults'));
        if (settingsDoc.exists()) {
            const settings = settingsDoc.data() as AppSettings;
            defaultFormIdToSet = settings.defaultGlobalFormId;
        }
      }

      const newHouseRef = await addDoc(collection(db, "openHouses"), {
        userId: user.uid,
        address: values.address,
        createdAt: Timestamp.now(),
        isActive: openHouses.length === 0,
        feedbackFormId: defaultFormIdToSet || null,
      });

      form.reset();
      
      await fetchDashboardData();

      if (hadHousesBefore) {
        setNewHouseId(newHouseRef.id);
        setIsAlertOpen(true);
      }
    } catch (error) {
      console.error("Error creating open house: ", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not create the open house. Please try again.",
      });
    }
  }

  const handleSetActive = async (houseId: string) => {
    if (!user) return;
    const batch = writeBatch(db);
    
    openHouses.forEach(house => {
        if (house.isActive && house.id !== houseId) {
            const docRef = doc(db, 'openHouses', house.id);
            batch.update(docRef, { isActive: false });
        }
    });

    const newActiveRef = doc(db, 'openHouses', houseId);
    batch.update(newActiveRef, { isActive: true });

    try {
        await batch.commit();
        await fetchDashboardData();
    } catch(err) {
        console.error("Error setting active open house:", err);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "Could not update the active open house. Please try again."
        });
    }
  };

  const handleAlertAction = async (setActive: boolean) => {
      if (setActive && newHouseId) {
          await handleSetActive(newHouseId);
      }
      setIsAlertOpen(false);
      setNewHouseId(null);
  };


  return (
    <>
    <div className="w-full mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard</h1>
        <p className="text-muted-foreground">An overview of your open house activity.</p>
      </div>

       <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card asChild>
            <Link href="/user/my-leads">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">New Leads (7d)</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{loading ? "..." : newLeadsCount}</div>
                </CardContent>
            </Link>
        </Card>
        <Card asChild className={cn(pendingGiftsCount > 0 && "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-800")}>
            <Link href="/user/gifts">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Gifts</CardTitle>
                    <Gift className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{loading ? "..." : pendingGiftsCount}</div>
                </CardContent>
            </Link>
        </Card>
        <Card asChild className={cn(activeHouse && "bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800")}>
            <Link href={activeHouse ? `/user/open-house/${activeHouse.id}` : "/user/dashboard"}>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Open House</CardTitle>
                    <Power className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-lg font-bold">...</div>
                    ) : activeHouse ? (
                        <div className="text-lg font-bold truncate" title={activeHouse.address}>
                            {activeHouse.address.split(',')[0]}
                        </div>
                    ) : (
                         <div className="text-lg font-bold">None</div>
                    )}
                </CardContent>
            </Link>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 gap-8 items-start">
        <Card>
            <CardHeader>
                <CardTitle>Create a New Open House</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row items-start gap-4">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem className="flex-grow relative form-item-container w-full">
                          <FormLabel className="sr-only">Address</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="123 Main St, Anytown, USA" 
                              {...field}
                               ref={addressInputRef}
                            />
                          </FormControl>
                          <FormMessage className="pt-2" />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
                      {form.formState.isSubmitting ? "Creating..." : "Create"}
                    </Button>
                  </form>
              </Form>
            </CardContent>
        </Card>

        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                 <h2 className="text-2xl font-bold tracking-tight font-headline">Your Open Houses</h2>
                 <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="icon">
                                <Search className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Search</h4>
                                    <p className="text-sm text-muted-foreground">
                                    Find an open house by its address.
                                    </p>
                                </div>
                                <Input
                                    id="search"
                                    placeholder="Search by address..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="icon">
                                <ArrowUpDown className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                         <PopoverContent className="w-48" align="end">
                           <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Sort by</h4>
                                </div>
                                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'newest' | 'oldest')}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Sort by" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="newest">Newest first</SelectItem>
                                        <SelectItem value="oldest">Oldest first</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

          {loading ? (
              <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">Loading your open houses...</p>
              </div>
          ) : filteredAndSortedHouses.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {filteredAndSortedHouses.map(house => (
                      <OpenHouseCard 
                        key={house.id} 
                        openHouse={house} 
                        leadCount={leadCounts.get(house.id) || 0}
                        feedbackCount={feedbackCounts.get(house.id) || 0}
                        isGiftEnabled={house.isGiftEnabled || false}
                        onSetActive={handleSetActive}
                      />
                  ))}
              </div>
          ) : (
              <div className="text-center py-16 border-2 border-dashed rounded-lg">
                  <h3 className="text-xl font-medium">No Open Houses Found</h3>
                  <p className="text-muted-foreground mt-2">
                    {searchTerm ? "Try a different search term." : "Use the form above to create your first listing."}
                  </p>
              </div>
          )}
        </div>
      </div>
    </div>
    <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>New Open House Created</AlertDialogTitle>
            <AlertDialogDescription>
                Would you like to make this new listing the active open house for your QR code?
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => handleAlertAction(false)}>Not now</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleAlertAction(true)}>Yes, make it active</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
