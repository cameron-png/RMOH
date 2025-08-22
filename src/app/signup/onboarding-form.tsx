
"use client";

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Edit, Loader2, ImageIcon, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const onboardingFormSchema = z.object({
  phone: z.string().min(10, { message: "Please enter a valid 10-digit phone number."}).max(15, { message: "Phone number is too long."}),
});

export function OnboardingForm() {
    const { user, loading, refreshUserData } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [formattedPhone, setFormattedPhone] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isUploadingPersonal, setIsUploadingPersonal] = useState(false);
    const [isUploadingBrokerage, setIsUploadingBrokerage] = useState(false);

    const [photoURL, setPhotoURL] = useState<string | null>(null);
    const [personalLogoUrl, setPersonalLogoUrl] = useState<string | null>(null);
    const [brokerageLogoUrl, setBrokerageLogoUrl] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const personalLogoInputRef = useRef<HTMLInputElement>(null);
    const brokerageLogoInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<z.infer<typeof onboardingFormSchema>>({
        resolver: zodResolver(onboardingFormSchema),
        defaultValues: { phone: '' },
    });
    
    useEffect(() => {
        if (!loading && !user) {
            router.replace('/signup');
        }
    }, [user, loading, router]);


    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setFormattedPhone(formatted);
        form.setValue("phone", e.target.value.replace(/\D/g, ''), { shouldDirty: true });
    };

    const formatPhoneNumber = (value: string) => {
        const rawValue = value.replace(/\D/g, '');
        let formatted = "";
        if (rawValue.length > 0) formatted = "(" + rawValue.substring(0, 3);
        if (rawValue.length >= 4) formatted += ") " + rawValue.substring(3, 6);
        if (rawValue.length >= 7) formatted += "-" + rawValue.substring(6, 10);
        return formatted;
    }

    const createUploadHandler = (
        path: string, 
        setUploading: (isUploading: boolean) => void,
        setUrl: (url: string | null) => void
    ) => async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0 || !user) return;

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
            toast({ variant: "destructive", title: 'Upload Failed', description: 'Could not upload your image.' });
        } finally {
            setUploading(false);
        }
    };

    const handleAvatarClick = () => fileInputRef.current?.click();
    const handlePersonalLogoClick = () => personalLogoInputRef.current?.click();
    const handleBrokerageLogoClick = () => brokerageLogoInputRef.current?.click();
    
    const handleFileChange = createUploadHandler('profile-pictures', setIsUploadingPhoto, setPhotoURL);
    const handlePersonalLogoChange = createUploadHandler('personal-logos', setIsUploadingPersonal, setPersonalLogoUrl);
    const handleBrokerageLogoChange = createUploadHandler('brokerage-logos', setIsUploadingBrokerage, setBrokerageLogoUrl);

    async function onSubmit(values: z.infer<typeof onboardingFormSchema>) {
        if (!user) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, {
                phone: values.phone,
                region: 'us', // Default to US
                photoURL: photoURL,
                personalLogoUrl: personalLogoUrl,
                brokerageLogoUrl: brokerageLogoUrl,
            }, { merge: true });

            await refreshUserData();
            router.push('/user/dashboard');
        } catch (error) {
            console.error('Error saving profile:', error);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save your profile.' });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const handleSkip = () => {
        router.push('/user/dashboard');
    }

    if (loading || !user) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Card>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6 pt-6">
                        <FormField control={form.control} name="phone" render={({ field }) => (
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
                        )}/>
                        
                         <div className="flex flex-col sm:flex-row gap-6 items-center justify-around pt-4">
                            <FormItem className="flex flex-col items-center gap-2">
                                <FormLabel>Your Photo</FormLabel>
                                <div className="relative group">
                                    <Avatar className="h-24 w-24">
                                        <AvatarImage src={photoURL || ''} alt="Profile Photo" className="object-top" data-ai-hint="person headshot" />
                                        <AvatarFallback className="text-3xl">
                                             <UserIcon className="h-10 w-10 text-muted-foreground" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <button type="button" onClick={handleAvatarClick} disabled={isUploadingPhoto} className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isUploadingPhoto ? <Loader2 className="h-8 w-8 text-white animate-spin" /> : <Edit className="h-8 w-8 text-white" />}
                                    </button>
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                </div>
                            </FormItem>
                             <FormItem className="flex flex-col items-center gap-2">
                                <FormLabel>Personal Logo</FormLabel>
                                <div className="relative group">
                                    <Avatar className="h-24 w-24 rounded-md">
                                        <AvatarImage src={personalLogoUrl || ''} alt="Personal Logo" className="object-contain" data-ai-hint="company logo" />
                                        <AvatarFallback className="rounded-md"><ImageIcon className="h-10 w-10 text-muted-foreground" /></AvatarFallback>
                                    </Avatar>
                                    <button type="button" onClick={handlePersonalLogoClick} disabled={isUploadingPersonal} className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isUploadingPersonal ? <Loader2 className="h-8 w-8 text-white animate-spin" /> : <Edit className="h-8 w-8 text-white" />}
                                    </button>
                                    <input type="file" ref={personalLogoInputRef} onChange={handlePersonalLogoChange} className="hidden" accept="image/*" />
                                </div>
                            </FormItem>
                             <FormItem className="flex flex-col items-center gap-2">
                                <FormLabel>Brokerage Logo</FormLabel>
                                <div className="relative group">
                                    <Avatar className="h-24 w-24 rounded-md">
                                        <AvatarImage src={brokerageLogoUrl || ''} alt="Brokerage Logo" className="object-contain" data-ai-hint="company logo" />
                                        <AvatarFallback className="rounded-md"><ImageIcon className="h-10 w-10 text-muted-foreground" /></AvatarFallback>
                                    </Avatar>
                                    <button type="button" onClick={handleBrokerageLogoClick} disabled={isUploadingBrokerage} className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                        {isUploadingBrokerage ? <Loader2 className="h-8 w-8 text-white animate-spin" /> : <Edit className="h-8 w-8 text-white" />}
                                    </button>
                                    <input type="file" ref={brokerageLogoInputRef} onChange={handleBrokerageLogoChange} className="hidden" accept="image/*" />
                                </div>
                            </FormItem>
                         </div>

                    </CardContent>
                    <CardFooter className="flex flex-col-reverse sm:flex-row gap-2">
                        <Button variant="ghost" onClick={handleSkip} className="w-full sm:w-auto" type="button">Skip for Now</Button>
                        <Button type="submit" className="w-full" disabled={isSubmitting || isUploadingPhoto || isUploadingPersonal || isUploadingBrokerage}>
                            {isSubmitting ? "Saving..." : "Save and Continue to Dashboard"}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
