
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, addDoc, updateDoc, deleteDoc, Timestamp, setDoc, collection, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { User, OpenHouse, FeedbackForm, Question, QuestionOption, AppSettings, GiftbitBrand, GiftbitSettings, AdminGift, Gift } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Home, PlusCircle, Trash2, Edit, MoreHorizontal, ArrowUp, ArrowDown, Gift as GiftIcon, Loader2, User as UserIcon, Mail, Phone, DollarSign, Calendar, Clock, Copy, Ban, Wallet, Users, BarChart, Settings, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { v4 as uuidv4 } from 'uuid';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getAvailableGiftbitBrands, saveGiftbitSettings, getAdminGiftData, cancelGiftbitReward, getGiftbitBalance, resetApplicationSettings } from './actions';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

const optionSchema = z.object({
  id: z.string(),
  value: z.string().min(1, "Option text cannot be empty"),
});

const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(3, "Question text must be at least 3 characters"),
  type: z.enum(['short-answer', 'yes-no', 'rating', 'multiple-choice']),
  options: z.array(optionSchema).optional(),
  isRequired: z.boolean().optional(),
});

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  questions: z.array(questionSchema).min(1, "You must add at least one question"),
});

type AdminStats = {
    totalUsers: number;
    newUsers7Days: number;
    totalOpenHouses: number;
    newOpenHouses7Days: number;
    totalGifts: number;
    newGifts7Days: number;
};

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, newUsers7Days: 0, totalOpenHouses: 0, newOpenHouses7Days: 0, totalGifts: 0, newGifts7Days: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([]);
  const [globalForms, setGlobalForms] = useState<FeedbackForm[]>([]);
  const [allGifts, setAllGifts] = useState<AdminGift[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({});
  const [giftbitBalance, setGiftbitBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [userSearch, setUserSearch] = useState('');
  const [houseSearch, setHouseSearch] = useState('');
  const [giftSearch, setGiftSearch] = useState('');

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [formToEdit, setFormToEdit] = useState<FeedbackForm | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<string | null>(null);
  
  const [allBrands, setAllBrands] = useState<GiftbitBrand[]>([]);
  const [loadingGiftbitData, setLoadingGiftbitData] = useState(true);
  const [loadingGifts, setLoadingGifts] = useState(true);

  const [enabledBrandCodes, setEnabledBrandCodes] = useState<string[]>([]);
  const [isSavingGiftbit, setIsSavingGiftbit] = useState(false);

  const [isCancelGiftDialogOpen, setIsCancelGiftDialogOpen] = useState(false);
  const [giftToCancel, setGiftToCancel] = useState<AdminGift | null>(null);

  const [isResetSettingsOpen, setIsResetSettingsOpen] = useState(false);
  const [isResettings, setIsResetting] = useState(false);

  const getInitials = (name?: string | null) => {
    if (!name) return "??";
    const names = name.split(' ');
    if (names.length > 1) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

    const fetchAllData = useCallback(async () => {
    setLoading(true);
    setLoadingGiftbitData(true);
    setLoadingGifts(true);
    try {
      const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Fetch all collections in parallel
      const [usersSnapshot, housesSnapshot, formsSnapshot, settingsDocSnap, giftsSnapshot] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'openHouses')),
          getDocs(query(collection(db, 'feedbackForms'), where('type', '==', 'global'))),
          getDoc(doc(db, 'settings', 'appDefaults')),
          getDocs(collection(db, 'gifts'))
      ]);

      // Process Users
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as User);
      setUsers(usersData);
      const newUsers7Days = usersData.filter(u => u.createdAt && u.createdAt >= sevenDaysAgo).length;

      // Process Open Houses
      const openHousesData = housesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as OpenHouse);
      setOpenHouses(openHousesData);
      const newOpenHouses7Days = openHousesData.filter(h => h.createdAt && h.createdAt >= sevenDaysAgo).length;
      
      // Process Gifts
      const giftsData = giftsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data()} as Gift));
      const newGifts7Days = giftsData.filter(g => g.createdAt && g.createdAt >= sevenDaysAgo).length;

      // Set Stats
      setStats({
          totalUsers: usersData.length,
          newUsers7Days,
          totalOpenHouses: openHousesData.length,
          newOpenHouses7Days,
          totalGifts: giftsData.length,
          newGifts7Days,
      });

      // Process Forms
      setGlobalForms(formsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackForm)));
      
      // Process Settings
      const settingsData = settingsDocSnap.exists() ? settingsDocSnap.data() as AppSettings : {};
      setAppSettings(settingsData);
      setEnabledBrandCodes(settingsData.giftbit?.enabledBrandCodes || []);
      
      // Fetch external Giftbit data
      getAvailableGiftbitBrands().then(({ brands }) => {
        setAllBrands(brands);
        setLoadingGiftbitData(false);
      });
      getAdminGiftData().then(gifts => {
        setAllGifts(gifts);
        setLoadingGifts(false);
      });
      getGiftbitBalance().then(balance => {
        setGiftbitBalance(balance);
      });

    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch admin data. You might not have the required permissions.",
      });
    }
    setLoading(false);
  }, [toast]);


  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      questions: [],
    },
  });

  const { fields, append, remove, update, move } = useFieldArray({
    control: form.control,
    name: "questions",
  });
  
  useEffect(() => {
    if (formToEdit) {
        form.reset({
            title: formToEdit.title,
            questions: formToEdit.questions.map(q => ({...q, isRequired: q.isRequired || false}))
        });
    } else {
        form.reset({ title: "", questions: [] });
    }
  }, [formToEdit, form]);

  const watchQuestions = form.watch('questions');

  const addQuestion = () => {
    append({ id: uuidv4(), text: '', type: 'short-answer', options: [], isRequired: false });
  };
  
  const addOption = (questionIndex: number) => {
    const question = form.getValues(`questions.${questionIndex}`);
    const newOptions = [...(question.options || []), { id: uuidv4(), value: "" }];
    update(questionIndex, { ...question, options: newOptions });
  };
  
  const removeOption = (questionIndex: number, optionIndex: number) => {
    const question = form.getValues(`questions.${questionIndex}`);
    const newOptions = question.options?.filter((_, i) => i !== optionIndex);
    update(questionIndex, { ...question, options: newOptions });
  };
  
  async function onFormSubmit(values: z.infer<typeof formSchema>) {
    try {
      if (formToEdit) {
        // Update existing form
        const formDocRef = doc(db, "feedbackForms", formToEdit.id);
        await updateDoc(formDocRef, {
            title: values.title,
            questions: values.questions,
        });
      } else {
        // Create new form
        await addDoc(collection(db, "feedbackForms"), {
          ...values,
          type: 'global',
          createdAt: Timestamp.now(),
        });
      }
      closeFormDialog();
      await fetchAllData();
    } catch (error) {
      console.error("Error saving form:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not save the form." });
    }
  }

  const handleDeleteForm = async () => {
    if (!formToDelete) return;
    try {
        await deleteDoc(doc(db, "feedbackForms", formToDelete));
        await fetchAllData();
    } catch (error) {
        console.error("Error deleting form:", error);
        toast({ variant: "destructive", title: "Delete Failed", description: "Could not delete the form." });
    } finally {
        setIsDeleteDialogOpen(false);
        setFormToDelete(null);
    }
  }

  const openFormDialog = (form?: FeedbackForm) => {
      setFormToEdit(form || null);
      setIsFormDialogOpen(true);
  }

  const closeFormDialog = () => {
      setIsFormDialogOpen(false);
      setFormToEdit(null);
      form.reset();
  }
  
  const openDeleteDialog = (id: string) => {
    setFormToDelete(id);
    setIsDeleteDialogOpen(true);
  }

  const openCancelGiftDialog = (gift: AdminGift) => {
    setGiftToCancel(gift);
    setIsCancelGiftDialogOpen(true);
  };
  
  const handleSetDefaultForm = async (formId: string) => {
    try {
        const settingsDocRef = doc(db, 'settings', 'appDefaults');
        await setDoc(settingsDocRef, { defaultGlobalFormId: formId }, { merge: true });
        setAppSettings(prev => ({...prev, defaultGlobalFormId: formId }));
        toast({
            title: "Default Form Set",
            description: "New users will now receive this form by default."
        });
    } catch (error) {
        console.error("Error setting default form:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not set the default form."
        });
    }
  };

  const handleBrandToggle = (brandCode: string, checked: boolean) => {
    setEnabledBrandCodes(prev =>
        checked ? [...prev, brandCode] : prev.filter(code => code !== brandCode)
    );
  };
  
  const handleSaveGiftbitSettings = async () => {
    setIsSavingGiftbit(true);
    const settings: GiftbitSettings = { enabledBrandCodes };
    const result = await saveGiftbitSettings(settings);
    if (result.success) {
        toast({ title: "Giftbit settings saved successfully!" });
    } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
    }
    setIsSavingGiftbit(false);
  };

  const handleCancelGift = async () => {
    if (!giftToCancel) return;
    const result = await cancelGiftbitReward(giftToCancel.id);
    if (result.success) {
        toast({ title: "Success", description: result.message });
        await fetchAllData();
    } else {
        toast({ variant: "destructive", title: "Cancellation Failed", description: result.message });
    }
    setIsCancelGiftDialogOpen(false);
    setGiftToCancel(null);
  }

   const handleResetSettings = async () => {
    setIsResetting(true);
    const result = await resetApplicationSettings();
    if (result.success) {
      toast({ title: "Success", description: result.message });
      await fetchAllData(); // Refresh data to reflect cleared settings
    } else {
      toast({ variant: "destructive", title: "Reset Failed", description: result.message });
    }
    setIsResetSettingsOpen(false);
    setIsResetting(false);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user =>
      user.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email?.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [users, userSearch]);

  const filteredHouses = useMemo(() => {
    const userMap = new Map(users.map(u => [u.id, u]));
    return openHouses
      .map(house => ({
        ...house,
        userName: userMap.get(house.userId)?.name || 'Unknown User'
      }))
      .filter(house =>
        house.address.toLowerCase().includes(houseSearch.toLowerCase()) ||
        house.userName.toLowerCase().includes(houseSearch.toLowerCase())
      );
  }, [openHouses, houseSearch, users]);
  
  const filteredBrands = useMemo(() => {
    return allBrands.sort((a,b) => a.name.localeCompare(b.name));
  }, [allBrands]);

   const filteredGifts = useMemo(() => {
    return allGifts.filter(gift =>
      gift.recipientName.toLowerCase().includes(giftSearch.toLowerCase()) ||
      gift.recipientEmail.toLowerCase().includes(giftSearch.toLowerCase()) ||
      gift.senderName.toLowerCase().includes(giftSearch.toLowerCase()) ||
      gift.senderEmail.toLowerCase().includes(giftSearch.toLowerCase()) ||
      (gift.brandName || gift.brandCode).toLowerCase().includes(giftSearch.toLowerCase())
    );
  }, [allGifts, giftSearch]);

  const formatBalance = (balanceInCents?: number | null) => {
    if (typeof balanceInCents !== 'number') return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(balanceInCents / 100);
  };
  
  const formatDate = (timestamp?: Timestamp | string) => {
      if (!timestamp) return 'N/A';
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp.toDate();
      return format(date, 'MMM d, yyyy');
  };

  const formatDateWithTime = (timestamp?: Timestamp | string) => {
    if (!timestamp) return 'N/A';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp.toDate();
    return format(date, 'MMM d, yyyy p');
  };

  const formatRelativeDate = (timestamp?: Timestamp | string) => {
    if (!timestamp) return 'N/A';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp.toDate();
    return formatDistanceToNow(date, { addSuffix: true });
  };

  const StatCard = ({ title, value, subtext, icon, isLoading }: { title: string, value: string | number, subtext?: string, icon: React.ReactNode, isLoading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
             {isLoading ? (
                 <div className="h-7 w-24 bg-muted animate-pulse rounded-md"/>
             ) : (
                <div className="text-2xl font-bold">{value}</div>
             )}
            {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
        </CardContent>
    </Card>
  )
    
  return (
    <>
    <div className="w-full mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Admin Dashboard</h1>
        <p className="text-muted-foreground">Oversee users, forms, and platform settings.</p>
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Users" value={stats.totalUsers} subtext={`${stats.newUsers7Days} new in last 7 days`} icon={<Users className="h-4 w-4 text-muted-foreground" />} isLoading={loading} />
            <StatCard title="Total Open Houses" value={stats.totalOpenHouses} subtext={`${stats.newOpenHouses7Days} new in last 7 days`} icon={<Home className="h-4 w-4 text-muted-foreground" />} isLoading={loading} />
            <StatCard title="Total Gifts Sent" value={stats.totalGifts} subtext={`${stats.newGifts7Days} in last 7 days`} icon={<GiftIcon className="h-4 w-4 text-muted-foreground" />} isLoading={loading} />
            <StatCard title="Giftbit Balance" value={formatBalance(giftbitBalance)} icon={<Wallet className="h-4 w-4 text-muted-foreground" />} isLoading={giftbitBalance === null} />
       </div>


      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-5 h-auto md:h-10">
          <TabsTrigger value="users">All Users</TabsTrigger>
          <TabsTrigger value="openHouses">Open Houses</TabsTrigger>
          <TabsTrigger value="allGifts">All Gifts</TabsTrigger>
          <TabsTrigger value="formLibrary">Form Library</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="w-full">
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>A list of all registered users.</CardDescription>
                </div>
                 <Input
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full md:w-64"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Loading users...</p>
              ) : (
                <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                    {filteredUsers.length > 0 ? filteredUsers.map(user => (
                        <Card key={user.id}>
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                     <Avatar>
                                        <AvatarImage src={user.photoURL || ''} alt={user.name || 'avatar'} data-ai-hint="person avatar"/>
                                        <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <CardTitle className="text-base">{user.name}</CardTitle>
                                        <CardDescription>{user.email}</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                               <div className="flex justify-between">
                                   <span className="text-muted-foreground flex items-center gap-1"><UserIcon className="w-4 h-4"/> Role:</span>
                                   {user.isAdmin ? <Badge>Admin</Badge> : <Badge variant="secondary">User</Badge>}
                               </div>
                                <div className="flex justify-between">
                                   <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="w-4 h-4"/> Balance:</span>
                                   <span className="font-medium">{formatBalance(user.availableBalance)}</span>
                               </div>
                               <div className="flex justify-between">
                                   <span className="text-muted-foreground flex items-center gap-1"><Calendar className="w-4 h-4"/> User Since:</span>
                                   <span className="font-medium">{formatDate(user.createdAt)}</span>
                               </div>
                                <div className="flex justify-between">
                                   <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-4 h-4"/> Last Activity:</span>
                                   <span className="font-medium">{formatDateWithTime(user.lastLoginAt)}</span>
                               </div>
                            </CardContent>
                        </Card>
                    )) : (
                        <div className="h-24 text-center flex items-center justify-center">
                            <p>No users found.</p>
                        </div>
                    )}
                </div>

                {/* Desktop Table View */}
                <div className="border rounded-lg hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>User Since</TableHead>
                        <TableHead>Last Activity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length > 0 ? filteredUsers.map(user => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={user.photoURL || ''} alt={user.name || 'avatar'} data-ai-hint="person avatar"/>
                                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{user.name}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                           <TableCell>
                            {user.isAdmin ? (
                                <Badge>Admin</Badge>
                            ) : (
                                <Badge variant="secondary">User</Badge>
                            )}
                          </TableCell>
                           <TableCell>
                                {formatBalance(user.availableBalance)}
                           </TableCell>
                           <TableCell>
                                {formatDate(user.createdAt)}
                           </TableCell>
                           <TableCell>
                                {formatDateWithTime(user.lastLoginAt)}
                           </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            No users found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Open Houses Tab */}
        <TabsContent value="openHouses">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="w-full">
                    <CardTitle>All Open Houses</CardTitle>
                    <CardDescription>A list of all open houses created by users.</CardDescription>
                </div>
                 <Input
                    placeholder="Search by address or user..."
                    value={houseSearch}
                    onChange={(e) => setHouseSearch(e.target.value)}
                    className="w-full md:w-64"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Loading open houses...</p>
              ) : (
                 <>
                {/* Mobile Card View */}
                 <div className="md:hidden space-y-4">
                    {filteredHouses.length > 0 ? filteredHouses.map(house => (
                        <Card key={house.id}>
                            <CardHeader>
                                <div className="flex items-start gap-4">
                                     <Link href={`/user/open-house/${house.id}`}>
                                        <div className="w-24 h-16 relative rounded-md overflow-hidden border flex-shrink-0 bg-muted">
                                            {house.imageUrl ? (
                                                <Image 
                                                    src={house.imageUrl}
                                                    alt={`Image of ${house.address}`}
                                                    fill
                                                    className="object-cover"
                                                    data-ai-hint="house exterior"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Home className="w-8 h-8 text-muted-foreground"/>
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                    <div className="flex-grow">
                                        <CardTitle className="text-base leading-tight">
                                           <Link href={`/user/open-house/${house.id}`} className="hover:underline">
                                                {house.address}
                                            </Link>
                                        </CardTitle>
                                        <CardDescription className="mt-1">{house.userName}</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardFooter>
                                {house.isActive ? (
                                    <Badge className="bg-green-600 text-white hover:bg-green-600">Active</Badge>
                                ) : (
                                    <Badge variant="outline">Inactive</Badge>
                                )}
                            </CardFooter>
                        </Card>
                     )) : (
                        <div className="h-24 text-center flex items-center justify-center">
                            <p>No open houses found.</p>
                        </div>
                    )}
                 </div>
                 
                {/* Desktop Table View */}
                <div className="border rounded-lg hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHouses.length > 0 ? filteredHouses.map(house => (
                        <TableRow key={house.id}>
                            <TableCell>
                                <Link href={`/user/open-house/${house.id}`}>
                                    <div className="w-24 h-16 relative rounded-md overflow-hidden border flex-shrink-0 bg-muted">
                                        {house.imageUrl ? (
                                             <Image 
                                                src={house.imageUrl}
                                                alt={`Image of ${house.address}`}
                                                fill
                                                className="object-cover"
                                                data-ai-hint="house exterior"
                                            />
                                        ) : (
                                             <div className="w-full h-full flex items-center justify-center">
                                                <Home className="w-8 h-8 text-muted-foreground"/>
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            </TableCell>
                          <TableCell>
                            <Link href={`/user/open-house/${house.id}`} className="hover:underline font-medium block max-w-xs truncate">
                                {house.address}
                            </Link>
                          </TableCell>
                          <TableCell>{house.userName}</TableCell>
                           <TableCell>
                                {house.isActive ? (
                                    <Badge className="bg-green-600 text-white hover:bg-green-600">
                                        Active
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">Inactive</Badge>
                                )}
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center">
                           No open houses found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Gifts Tab */}
        <TabsContent value="allGifts">
           <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="w-full">
                  <CardTitle>All Gifts</CardTitle>
                  <CardDescription>A complete log of all gifts sent.</CardDescription>
                </div>
                 <Input
                    placeholder="Search gifts..."
                    value={giftSearch}
                    onChange={(e) => setGiftSearch(e.target.value)}
                    className="w-full md:w-64"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loadingGifts ? (
                 <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                 </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Sender</TableHead>
                        <TableHead>DB Status</TableHead>
                        <TableHead>Giftbit Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGifts.length > 0 ? filteredGifts.map(gift => {
                        const isCancellable = gift.giftbitStatus && !['REDEEMED', 'CANCELLED'].includes(gift.giftbitStatus);
                        return (
                        <TableRow key={gift.id}>
                          <TableCell>
                            <div className="font-medium">{gift.recipientName}</div>
                            <div className="text-sm text-muted-foreground">{gift.recipientEmail}</div>
                          </TableCell>
                          <TableCell>{formatBalance(gift.amountInCents)}</TableCell>
                          <TableCell>{gift.brandName || gift.brandCode}</TableCell>
                          <TableCell>{gift.senderName}</TableCell>
                           <TableCell>
                                <Badge variant={gift.status === 'Sent' ? 'default' : gift.status === 'Failed' ? 'destructive' : gift.status === 'Cancelled' ? 'outline' : 'secondary'}>
                                    {gift.status}
                                </Badge>
                          </TableCell>
                          <TableCell>
                            {gift.giftbitStatus ? (
                                 <Badge variant="outline">{gift.giftbitStatus.replace(/_/g, ' ')}</Badge>
                            ) : <span className="text-muted-foreground text-xs">N/A</span>}
                          </TableCell>
                           <TableCell title={formatDateWithTime(gift.createdAt as any)}>
                                {formatRelativeDate(gift.createdAt as any)}
                           </TableCell>
                           <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Gift Actions</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {gift.claimUrl && (
                                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(gift.claimUrl || '')}>
                                            <Copy className="mr-2 h-4 w-4" />
                                            <span>Copy Claim Link</span>
                                        </DropdownMenuItem>
                                    )}
                                    {isCancellable && (
                                        <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => openCancelGiftDialog(gift)} className="text-destructive focus:text-destructive">
                                            <Ban className="mr-2 h-4 w-4" />
                                            <span>Cancel Gift</span>
                                        </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                           </TableCell>
                        </TableRow>
                        )
                      }) : (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center">
                            No gifts found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Form Library Tab */}
        <TabsContent value="formLibrary">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="w-full">
                <CardTitle>Form Library</CardTitle>
                <CardDescription>Manage feedback forms for all users.</CardDescription>
              </div>
               <Button onClick={() => openFormDialog()} className="w-full sm:w-auto"><PlusCircle className="mr-2"/> Create New Form</Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>Loading forms...</p>
              ) : globalForms.length > 0 ? (
                <>
                <div className="mb-6 bg-muted/50 p-4 rounded-lg">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="default-form-select">Default Form for New Users</label>
                    <p className="text-sm text-muted-foreground mb-2">This form will be the default for all new users.</p>
                    <Select onValueChange={handleSetDefaultForm} value={appSettings.defaultGlobalFormId}>
                        <SelectTrigger id="default-form-select" className="w-full max-w-sm">
                            <SelectValue placeholder="Select a default form..." />
                        </SelectTrigger>
                        <SelectContent>
                            {globalForms.map(form => (
                                <SelectItem key={form.id} value={form.id}>{form.title}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Questions</TableHead>
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalForms.map(form => (
                        <TableRow key={form.id}>
                          <TableCell className="font-medium flex items-center gap-2">
                            {form.title}
                            {form.id === appSettings.defaultGlobalFormId && (
                                <Badge variant="secondary">Default</Badge>
                            )}
                          </TableCell>
                          <TableCell>{form.questions.length}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Form Actions</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openFormDialog(form)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openDeleteDialog(form.id)} className="text-destructive focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                </>
              ) : (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <h3 className="text-xl font-medium">No Forms in Library</h3>
                    <p className="text-muted-foreground mt-2">
                      Click "Create New Form" to build a new form for the library.
                    </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
         {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Gift Brands</CardTitle>
                  <CardDescription>Configure which gift card brands are available to users.</CardDescription>
                </div>
                 <Button onClick={handleSaveGiftbitSettings} disabled={isSavingGiftbit} className="w-full sm:w-auto">
                    {isSavingGiftbit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
              </div>
            </CardHeader>
            <CardContent>
               {loadingGiftbitData ? (
                 <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                 </div>
               ) : (
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Enabled Brands (USA)</h3>
                    <ScrollArea className="h-[600px] border rounded-lg p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {filteredBrands.map(brand => (
                                <div key={brand.brand_code} className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted/50">
                                    <Switch
                                        id={`brand-${brand.brand_code}`}
                                        checked={enabledBrandCodes.includes(brand.brand_code)}
                                        onCheckedChange={(checked) => handleBrandToggle(brand.brand_code, checked)}
                                        className="mt-1"
                                    />
                                    <label htmlFor={`brand-${brand.brand_code}`} className="flex flex-col gap-2 cursor-pointer">
                                        <div className="w-20 h-10 relative bg-white rounded border flex items-center justify-center">
                                            <Image src={brand.image_url} alt={brand.name} fill className="object-contain p-1" data-ai-hint="company logo"/>
                                        </div>
                                        <span className="text-sm font-medium leading-none">
                                            {brand.name}
                                        </span>
                                    </label>
                                </div>
                            ))}
                        </div>
                        {filteredBrands.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground">
                                <p>No US brands available from Giftbit.</p>
                            </div>
                        )}
                    </ScrollArea>
                </div>
               )}
            </CardContent>
          </Card>
           <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle /> Danger Zone
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-destructive/5 rounded-lg">
                        <div>
                            <h4 className="font-semibold">Reset Application Settings</h4>
                            <p className="text-sm text-destructive/80 max-w-prose mt-1">
                                This will remove any old or unused setting fields from the database. Current settings will be preserved.
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={() => setIsResetSettingsOpen(true)}
                            className="w-full sm:w-auto"
                        >
                            Reset Settings
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
        
      </Tabs>
    </div>

    {/* Form Dialog */}
    <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => !isOpen && closeFormDialog()}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>{formToEdit ? 'Edit Form' : 'Create New Library Form'}</DialogTitle>
                <DialogDescription>
                  {formToEdit ? 'Modify the details of this form.' : 'Design a new feedback form for the library.'}
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onFormSubmit)}>
                    <div className="space-y-6 p-1 max-h-[60vh] overflow-y-auto">
                      <FormField control={form.control} name="title" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Form Title</FormLabel>
                              <FormControl><Input placeholder="e.g., General Property Feedback" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )}/>
                      <Separator />
                      <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium">Questions</h3>
                        </div>
                        <div className="space-y-4">
                          {fields.map((field, index) => (
                            <Card key={field.id} className="p-4 bg-muted relative transition-all">
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex-grow space-y-4">
                                  <FormField control={form.control} name={`questions.${index}.text`} render={({ field }) => (
                                      <FormItem>
                                          <FormLabel>Question {index + 1}</FormLabel>
                                          <FormControl><Textarea placeholder="What would you like to ask?" {...field} /></FormControl>
                                          <FormMessage />
                                      </FormItem>
                                  )}/>
                                   <div className="flex items-end gap-4">
                                        <FormField control={form.control} name={`questions.${index}.type`} render={({ field }) => (
                                            <FormItem className="flex-grow">
                                                <FormLabel>Question Type</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a question type" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="short-answer">Short Answer</SelectItem>
                                                        <SelectItem value="yes-no">Yes/No</SelectItem>
                                                        <SelectItem value="rating">1-5 Rating</SelectItem>
                                                        <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}/>
                                        <FormField control={form.control} name={`questions.${index}.isRequired`} render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 pb-2">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormLabel className="!mt-0">Required</FormLabel>
                                            </FormItem>
                                        )}/>
                                   </div>
                                  {watchQuestions[index]?.type === 'multiple-choice' && (
                                    <div className="space-y-3 pl-4 border-l-2 ml-2">
                                      <FormLabel>Options</FormLabel>
                                      {watchQuestions[index].options?.map((option, optionIndex) => (
                                        <div key={option.id} className="flex items-center gap-2">
                                           <FormField control={form.control} name={`questions.${index}.options.${optionIndex}.value`} render={({ field }) => (
                                              <FormItem className="flex-grow">
                                                  <FormControl><Input placeholder={`Option ${optionIndex + 1}`} {...field} /></FormControl>
                                                   <FormMessage />
                                              </FormItem>
                                          )}/>
                                          <Button variant="ghost" size="icon" onClick={() => removeOption(index, optionIndex)} type="button">
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                          </Button>
                                        </div>
                                      ))}
                                      <Button size="sm" variant="outline" type="button" onClick={() => addOption(index)}>
                                        <PlusCircle className="mr-2" /> Add Option
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="absolute top-2 right-2 flex flex-col gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => move(index, index - 1)} disabled={index === 0} type="button" aria-label="Move up">
                                      <ArrowUp className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => move(index, index + 1)} disabled={index === fields.length - 1} type="button" aria-label="Move down">
                                      <ArrowDown className="w-4 h-4" />
                                    </Button>
                                     <Button variant="ghost" size="icon" onClick={() => remove(index)} type="button" aria-label="Delete question" className="text-destructive hover:text-destructive">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                        <FormMessage>{form.formState.errors.questions?.message}</FormMessage>
                         <div className="mt-4">
                            <Button size="sm" variant="secondary" onClick={addQuestion} type="button">
                                <PlusCircle className="mr-2" /> Add Question
                            </Button>
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="mt-6 pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={closeFormDialog}>Cancel</Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "Saving..." : "Save Form"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    
    {/* Delete Confirmation Dialog */}
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this form from the library.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setFormToDelete(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteForm} className="bg-destructive hover:bg-destructive/90">
            Yes, delete form
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

     {/* Cancel Gift Confirmation Dialog */}
    <AlertDialog open={isCancelGiftDialogOpen} onOpenChange={setIsCancelGiftDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel This Gift?</AlertDialogTitle>
          <AlertDialogDescription>
            This will attempt to cancel the gift for <span className="font-bold">{giftToCancel?.recipientName}</span>. This cannot be undone. If the gift has already been claimed, this will fail.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setGiftToCancel(null)}>Back</AlertDialogCancel>
          <AlertDialogAction onClick={handleCancelGift} className="bg-destructive hover:bg-destructive/90">
            Yes, cancel this gift
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Reset Settings Confirmation Dialog */}
    <AlertDialog open={isResetSettingsOpen} onOpenChange={setIsResetSettingsOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Reset Application Settings?</AlertDialogTitle>
                <AlertDialogDescription>
                    This is a safe operation that removes old, unused setting fields from the database. This can resolve issues from past updates. Your current settings will not be lost.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetSettings} disabled={isResettings}>
                     {isResettings ? "Resetting..." : "Yes, Reset Settings"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

    
