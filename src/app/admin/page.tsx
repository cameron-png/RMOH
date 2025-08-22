
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, addDoc, updateDoc, deleteDoc, Timestamp, setDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { User, OpenHouse, FeedbackForm, Question, QuestionOption, AppSettings, GiftbitRegion, GiftbitBrand, GiftbitSettings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Home, PlusCircle, Trash2, Edit, MoreHorizontal, ArrowUp, ArrowDown, Gift, Loader2 } from 'lucide-react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getAdminDashboardData, getAvailableGiftbitRegionsAndBrands, saveGiftbitSettings } from './actions';
import { format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';

const optionSchema = z.object({
  id: z.string(),
  value: z.string().min(1, "Option text cannot be empty"),
});

const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(3, "Question text must be at least 3 characters"),
  type: z.enum(['short-answer', 'yes-no', 'rating', 'multiple-choice']),
  options: z.array(optionSchema).optional(),
});

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  questions: z.array(questionSchema).min(1, "You must add at least one question"),
});

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [openHouses, setOpenHouses] = useState<OpenHouse[]>([]);
  const [globalForms, setGlobalForms] = useState<FeedbackForm[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [userSearch, setUserSearch] = useState('');
  const [houseSearch, setHouseSearch] = useState('');

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [formToEdit, setFormToEdit] = useState<FeedbackForm | null>(null);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<string | null>(null);
  
  const [allRegions, setAllRegions] = useState<GiftbitRegion[]>([]);
  const [allBrands, setAllBrands] = useState<GiftbitBrand[]>([]);
  const [loadingGiftbitData, setLoadingGiftbitData] = useState(true);

  const [enabledRegionCodes, setEnabledRegionCodes] = useState<string[]>([]);
  const [enabledBrandCodes, setEnabledBrandCodes] = useState<string[]>([]);
  const [isSavingGiftbit, setIsSavingGiftbit] = useState(false);

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
    try {
      const { users, openHouses, forms, settings } = await getAdminDashboardData();
      setUsers(users);
      setOpenHouses(openHouses);
      setGlobalForms(forms);
      setAppSettings(settings);
      setEnabledRegionCodes(settings.giftbit?.enabledRegionCodes || []);
      setEnabledBrandCodes(settings.giftbit?.enabledBrandCodes || []);
      
      const { regions, brands } = await getAvailableGiftbitRegionsAndBrands();
      setAllRegions(regions);
      setAllBrands(brands);

    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch admin data. You might not have the required permissions.",
      });
    }
    setLoading(false);
    setLoadingGiftbitData(false);
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
            questions: formToEdit.questions.map(q => ({...q})) // Deep copy to avoid reference issues
        });
    } else {
        form.reset({ title: "", questions: [] });
    }
  }, [formToEdit, form]);

  const watchQuestions = form.watch('questions');

  const addQuestion = () => {
    append({ id: uuidv4(), text: '', type: 'short-answer', options: [] });
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

  const handleRegionToggle = (regionCode: string, checked: boolean) => {
    setEnabledRegionCodes(prev => 
        checked ? [...prev, regionCode] : prev.filter(code => code !== regionCode)
    );
  };

  const handleBrandToggle = (brandCode: string, checked: boolean) => {
    setEnabledBrandCodes(prev =>
        checked ? [...prev, brandCode] : prev.filter(code => code !== brandCode)
    );
  };
  
  const handleSaveGiftbitSettings = async () => {
    setIsSavingGiftbit(true);
    const settings: GiftbitSettings = { enabledRegionCodes, enabledBrandCodes };
    const result = await saveGiftbitSettings(settings);
    if (result.success) {
        toast({ title: "Giftbit settings saved successfully!" });
    } else {
        toast({ variant: "destructive", title: "Error", description: result.message });
    }
    setIsSavingGiftbit(false);
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Admin Dashboard</h1>
        <p className="text-muted-foreground">Oversee users, forms, and platform settings.</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-4 h-auto md:h-10">
          <TabsTrigger value="users">All Users</TabsTrigger>
          <TabsTrigger value="openHouses">Open Houses</TabsTrigger>
          <TabsTrigger value="formLibrary">Form Library</TabsTrigger>
          <TabsTrigger value="giftBrands">Gift Brands</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="w-full">
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>A list of all registered users on the platform.</CardDescription>
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
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Balance</TableHead>
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
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center">
                            No users found.
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
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead className="hidden sm:table-cell">Created By</TableHead>
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
                             <div className="text-sm text-muted-foreground sm:hidden">{house.userName}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{house.userName}</TableCell>
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
                <CardDescription>Manage feedback forms in the library that all users can access.</CardDescription>
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
                    <p className="text-sm text-muted-foreground mb-2">This form will be the default for all new users upon sign-up.</p>
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
        
         {/* Gift Brands Tab */}
        <TabsContent value="giftBrands">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Gift Brands</CardTitle>
                  <CardDescription>Configure which gift card regions and brands are available to users.</CardDescription>
                </div>
                 <Button onClick={handleSaveGiftbitSettings} disabled={isSavingGiftbit}>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    {/* Regions */}
                    <div className="md:col-span-1">
                        <h3 className="text-lg font-medium mb-4">Enabled Regions</h3>
                        <div className="space-y-3">
                            {allRegions.map(region => (
                                <div key={region.code} className="flex items-center space-x-2">
                                    <Switch
                                        id={`region-${region.code}`}
                                        checked={enabledRegionCodes.includes(region.code)}
                                        onCheckedChange={(checked) => handleRegionToggle(region.code, checked)}
                                    />
                                    <label htmlFor={`region-${region.code}`} className="text-sm font-medium leading-none">
                                       {region.name} ({region.currency})
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Brands */}
                    <div className="md:col-span-2">
                        <h3 className="text-lg font-medium mb-4">Enabled Brands</h3>
                        <ScrollArea className="h-[500px] border rounded-lg p-4">
                           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {allBrands
                                    .filter(brand => brand.region_codes?.some(code => enabledRegionCodes.includes(code)))
                                    .sort((a,b) => a.name.localeCompare(b.name))
                                    .map(brand => (
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
                            {enabledRegionCodes.length === 0 && (
                                <div className="text-center py-10 text-muted-foreground">
                                    <p>Select a region on the left to see available brands.</p>
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>
               )}
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
                            <Card key={field.id} className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 relative transition-all">
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex-grow space-y-4">
                                  <FormField control={form.control} name={`questions.${index}.text`} render={({ field }) => (
                                      <FormItem>
                                          <FormLabel>Question {index + 1}</FormLabel>
                                          <FormControl><Textarea placeholder="What would you like to ask?" {...field} /></FormControl>
                                          <FormMessage />
                                      </FormItem>
                                  )}/>
                                   <FormField control={form.control} name={`questions.${index}.type`} render={({ field }) => (
                                      <FormItem>
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

    </>
  );
}
