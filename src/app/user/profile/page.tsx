
"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { FeedbackForm } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, RefreshCw, KeyRound, Edit, Loader2, ImageIcon, Globe, User } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  phone: z.string().min(10, { message: "Please enter a valid 10-digit phone number."}).max(15, { message: "Phone number is too long."}),
  title: z.string().optional(),
  licenseNumber: z.string().optional(),
  brokerageName: z.string().optional(),
  defaultFormId: z.string().optional(),
});

export default function ProfilePage() {
  const { user, loading, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [formattedPhone, setFormattedPhone] = useState("");
  const [availableForms, setAvailableForms] = useState<FeedbackForm[]>([]);
  const [apiKey, setApiKey] = useState<string | null>(null);
  
  const personalLogoInputRef = useRef<HTMLInputElement>(null);
  const brokerageLogoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingPersonal, setIsUploadingPersonal] = useState(false);
  const [isUploadingBrokerage, setIsUploadingBrokerage] = useState(false);

  const [newPhotoURL, setNewPhotoURL] = useState<string | null>(null);
  const [newPersonalLogoUrl, setNewPersonalLogoUrl] = useState<string | null>(null);
  const [newBrokerageLogoUrl, setNewBrokerageLogoUrl] = useState<string | null>(null);

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      title: '',
      licenseNumber: '',
      brokerageName: '',
      defaultFormId: '',
    },
  });
  
  const fetchInitialData = useCallback(async () => {
    if (!user) return;
    
    // Fetch forms
    try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const globalQuery = query(collection(db, 'feedbackForms'), where('type', '==', 'global'));
        const customQuery = query(
          collection(db, 'feedbackForms'),
          where('type', '==', 'custom'),
          where('userId', '==', user.uid)
        );
        
        const [globalSnapshot, customSnapshot] = await Promise.all([
            getDocs(globalQuery), 
            getDocs(customQuery),
        ]);
        
        const allForms = [
            ...globalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackForm)),
            ...customSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackForm)),
        ];
        setAvailableForms(allForms);

    } catch (e) {
        console.error("Failed to fetch forms: ", e);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not load required data. Please refresh.",
        });
    }


    // Set form values from user data
     form.reset({
      name: user.name || '',
      phone: user.phone || '',
      title: user.title || '',
      licenseNumber: user.licenseNumber || '',
      brokerageName: user.brokerageName || '',
      defaultFormId: user.defaultFormId || '',
    });
    setFormattedPhone(formatPhoneNumber(user.phone || ""));
    setNewPhotoURL(user.photoURL || null);
    setNewPersonalLogoUrl(user.personalLogoUrl || null);
    setNewBrokerageLogoUrl(user.brokerageLogoUrl || null);

    // Check for API key
    if (user.apiKey) {
        setApiKey(user.apiKey);
    } else {
        // If no API key, generate and save one
        const newKey = `ohd_sk_${uuidv4().replace(/-/g, '')}`;
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { apiKey: newKey });
        setApiKey(newKey);
        await refreshUserData();
    }

  }, [user, form, refreshUserData, toast]);

  useEffect(() => {
    if (user) {
        fetchInitialData();
    }
  }, [user, fetchInitialData]);

  // Check for unsaved changes before leaving the page
  const { isDirty } = form.formState;
  const hasUnsavedImageChanges = useMemo(() => {
    return (
      newPhotoURL !== user?.photoURL ||
      newPersonalLogoUrl !== user?.personalLogoUrl ||
      newBrokerageLogoUrl !== user?.brokerageLogoUrl
    );
  }, [newPhotoURL, newPersonalLogoUrl, newBrokerageLogoUrl, user]);

  const hasUnsavedChanges = isDirty || hasUnsavedImageChanges;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
  
  const formatPhoneNumber = (value: string) => {
    const rawValue = value.replace(/\D/g, '');
    let formatted = "";

    if (rawValue.length > 0) formatted = "(" + rawValue.substring(0, 3);
    if (rawValue.length >= 4) formatted += ") " + rawValue.substring(3, 6);
    if (rawValue.length >= 7) formatted += "-" + rawValue.substring(6, 10);
    
    return formatted;
  }
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormattedPhone(formatted);
    form.setValue("phone", e.target.value.replace(/\D/g, ''), { shouldDirty: true });
  };

  async function onSubmit(values: z.infer<typeof profileFormSchema>) {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to update your profile.',
      });
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const updateData = {
        name: values.name,
        phone: values.phone,
        title: values.title,
        licenseNumber: values.licenseNumber,
        brokerageName: values.brokerageName,
        defaultFormId: values.defaultFormId,
        photoURL: newPhotoURL,
        personalLogoUrl: newPersonalLogoUrl,
        brokerageLogoUrl: newBrokerageLogoUrl,
      };

      await updateDoc(userDocRef, updateData);

      toast({
        title: 'Profile Updated',
        description: 'Your information has been successfully saved.',
      });

      await refreshUserData();
      // After successful save, reset form with the new values to clear dirty state
      form.reset({
        ...values,
        phone: values.phone, 
      });

    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save your profile. Please try again.',
      });
    }
  }

  const handleCopyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey).then(() => {
        toast({ title: "API Key Copied" });
    }, () => {
        toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy the key. Please try again." });
    });
  };

  const handleRegenerateKey = async () => {
    if (!user) return;
    try {
        const newKey = `ohd_sk_${uuidv4().replace(/-/g, '')}`;
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { apiKey: newKey });
        setApiKey(newKey);
        await refreshUserData();
        toast({ title: "API Key Regenerated", description: "Your new API key has been saved." });
    } catch (error) {
        console.error("Error regenerating API key:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not regenerate the API key." });
    }
  };

  const createUploadHandler = (
    path: string, 
    setUploading: (isUploading: boolean) => void,
    setUrl: (url: string | null) => void
  ) => async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user) {
        return;
    }

    const file = event.target.files[0];
    const maxFileSize = 2 * 1024 * 1024; // 2MB

    if (file.size > maxFileSize) {
        toast({
            variant: "destructive",
            title: "File Too Large",
            description: "Please select a file smaller than 2MB.",
        });
        return;
    }

    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `${path}/${user.uid}/${fileName}`);
    
    setUploading(true);
    
    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        setUrl(downloadURL);
        
    } catch (error) {
        console.error("Error uploading file: ", error);
        toast({
            variant: "destructive",
            title: 'Upload Failed',
            description: 'Could not upload your image. Please try again.'
        });
    } finally {
        setUploading(false);
    }
  };

  const handleAvatarClick = () => fileInputRef.current?.click();
  const handlePersonalLogoClick = () => personalLogoInputRef.current?.click();
  const handleBrokerageLogoClick = () => brokerageLogoInputRef.current?.click();

  const handleFileChange = createUploadHandler('profile-pictures', setIsUploadingPhoto, setNewPhotoURL);
  const handlePersonalLogoChange = createUploadHandler('personal-logos', setIsUploadingPersonal, setNewPersonalLogoUrl);
  const handleBrokerageLogoChange = createUploadHandler('brokerage-logos', setIsUploadingBrokerage, setNewBrokerageLogoUrl);

  if (loading) {
    return <p>Loading profile...</p>
  }
  
  if (!user) {
    return <p>Please log in to view your profile.</p>
  }

  const getInitials = (name?: string | null) => {
    if (!name) return "??";
    const names = name.split(' ');
    if (names.length > 1) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const LogoUploader = ({
      title,
      imageUrl,
      isUploading,
      onClick,
      inputRef,
      onChange
  }: {
      title: string;
      imageUrl: string | null;
      isUploading: boolean;
      onClick: () => void;
      inputRef: React.RefObject<HTMLInputElement>;
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  }) => (
      <FormItem>
          <FormLabel>{title}</FormLabel>
          <div className="flex items-center gap-4">
              <div className="relative group">
                  <Avatar className="h-20 w-20 rounded-md">
                      <AvatarImage src={imageUrl || ''} alt={`${title}`} className="object-contain" data-ai-hint="company logo" />
                      <AvatarFallback className="rounded-md">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </AvatarFallback>
                  </Avatar>
                  <button
                      type="button"
                      onClick={onClick}
                      disabled={isUploading}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                      {isUploading ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Edit className="h-6 w-6 text-white" />}
                  </button>
                  <input
                      type="file"
                      ref={inputRef}
                      onChange={onChange}
                      className="hidden"
                      accept="image/png, image/jpeg, image/gif"
                  />
              </div>
          </div>
      </FormItem>
  );

  return (
    <div className="w-full mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Profile & Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal and professional information.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
              <CardDescription>
                Your personal contact and licensing details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <FormItem>
                  <FormLabel>Your Photo</FormLabel>
                   <div className="flex items-center gap-4">
                      <div className="relative group">
                          <Avatar className="h-20 w-20">
                            <AvatarImage src={newPhotoURL || ''} alt={user.name || 'avatar'} data-ai-hint="person headshot" className="object-top" />
                            <AvatarFallback className="text-2xl">{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                           <button 
                                type="button" 
                                onClick={handleAvatarClick}
                                disabled={isUploadingPhoto}
                                className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                               {isUploadingPhoto ? (
                                   <Loader2 className="h-6 w-6 text-white animate-spin" />
                               ) : (
                                   <Edit className="h-6 w-6 text-white" />
                               )}
                           </button>
                           <input 
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/png, image/jpeg, image/gif"
                           />
                      </div>
                      <div className="flex-grow">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Full Name</FormLabel>
                                <FormControl>
                                <Input placeholder="John Doe" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                      </div>
                   </div>
               </FormItem>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                    <Input readOnly disabled value={user.email || ''} />
                    </FormControl>
                    <p className="text-sm text-muted-foreground pt-2">Your email address cannot be changed.</p>
                </FormItem>
                <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                        <Input 
                                placeholder="(555) 555-5555" 
                                {...field}
                                value={formattedPhone}
                                onChange={handlePhoneChange}
                                maxLength={14}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
                <Separator/>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-6">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Your Title</FormLabel>
                                <FormControl>
                                <Input placeholder="e.g., REALTOR®" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="licenseNumber"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Your License Number</FormLabel>
                                <FormControl>
                                <Input placeholder="e.g., #1234567" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                     <LogoUploader 
                        title="Your Personal Logo"
                        imageUrl={newPersonalLogoUrl}
                        isUploading={isUploadingPersonal}
                        onClick={handlePersonalLogoClick}
                        inputRef={personalLogoInputRef}
                        onChange={handlePersonalLogoChange}
                     />
                 </div>
            </CardContent>
          </Card>
          
          <Card className="mt-8">
            <CardHeader>
                <CardTitle>Brokerage Information</CardTitle>
                <CardDescription>
                    Your brokerage details and logo.
                </CardDescription>
            </CardHeader>
             <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <FormField
                    control={form.control}
                    name="brokerageName"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Brokerage Name</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., Awesome Realty Inc." {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <LogoUploader 
                    title="Your Brokerage Logo"
                    imageUrl={newBrokerageLogoUrl}
                    isUploading={isUploadingBrokerage}
                    onClick={handleBrokerageLogoClick}
                    inputRef={brokerageLogoInputRef}
                    onChange={handleBrokerageLogoChange}
                 />
             </CardContent>
          </Card>
          
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Feedback Preferences</CardTitle>
              <CardDescription>
                Customize your default feedback form for new open houses.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="defaultFormId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Feedback Form</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a default form..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableForms.map((form) => (
                          <SelectItem key={form.id} value={form.id}>
                            {form.title}{' '}
                            {form.type === 'global' && '(Library)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This form will be automatically assigned to new open houses.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

           <div className="flex justify-end mt-8">
                <Button type="submit" disabled={!hasUnsavedChanges || form.formState.isSubmitting || isUploadingPhoto || isUploadingPersonal || isUploadingBrokerage}>
                   {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
            </div>
        </form>
      </Form>

       <Separator className="my-8" />
      
       <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound/> API & Integrations</CardTitle>
            <CardDescription>
                Use this API key to connect your account to third-party services like Zapier.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Label htmlFor="api-key-input">Your API Key</Label>
            <div className="flex items-center gap-2 mt-1">
                <Input
                    id="api-key-input"
                    readOnly
                    value={apiKey ? `••••••••••••••••${apiKey.slice(-4)}` : "Generating key..."}
                    className="font-mono bg-muted"
                />
                 <Button variant="outline" size="icon" onClick={handleCopyKey} disabled={!apiKey}>
                    <Copy />
                </Button>
            </div>
             <p className="text-xs text-muted-foreground mt-2">
                Treat this key like a password. Do not share it publicly.
            </p>
        </CardContent>
        <CardFooter className="border-t pt-6 flex items-start justify-between flex-wrap gap-4">
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                        <RefreshCw className="mr-2"/> Regenerate Key
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Regenerating your API key will break any existing integrations using the old key. You will need to update them with the new key.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRegenerateKey} className="bg-destructive hover:bg-destructive/90">
                        Yes, regenerate key
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardFooter>
      </Card>

    </div>
  );
}
