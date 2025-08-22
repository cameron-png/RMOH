
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc, collection, addDoc, Timestamp, getDocs, query, where, limit, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { OpenHouse, FeedbackForm, Question as QuestionType, UserProfile, GiftbitBrand, AppSettings } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Home, ThumbsUp, UserPlus, CheckCircle, Star, AlertCircle, Mail, Phone, Building, Contact, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { sendNewLeadEmail } from '@/app/actions';


const leadSchema = z.object({
  name: z.string().min(2, "Please enter your name."),
  email: z.string().email("Please enter a valid email address.").optional().or(z.literal('')),
  phone: z.string().optional(),
}).refine(data => data.email || data.phone, {
  message: "Please provide either an email or a phone number.",
  path: ["email"], // Arbitrarily attach error to email field
});

async function getPublicGiftConfiguration(): Promise<{ brands: GiftbitBrand[] }> {
    // This function will run on the client, so we don't have access to adminDb or env vars here.
    // The logic to fetch brands needs to be carefully handled, perhaps via a dedicated server action if needed.
    // For now, let's assume we might need a different mechanism for public pages.
    return { brands: [] }; // Returning empty for now to avoid errors.
}


export default function VisitorFeedbackPage() {
  const { userId } = useParams();
  const { toast } = useToast();

  const [step, setStep] = useState<'welcome' | 'form' | 'lead' | 'thankyou'>('welcome');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [realtor, setRealtor] = useState<UserProfile | null>(null);
  const [activeHouse, setActiveHouse] = useState<OpenHouse | null>(null);
  const [formTemplate, setFormTemplate] = useState<FeedbackForm | null>(null);
  const [giftBrand, setGiftBrand] = useState<GiftbitBrand | null>(null);
  
  const [feedbackSubmissionId, setFeedbackSubmissionId] = useState<string | null>(null);


  const fetchPageData = useCallback(async () => {
    // Reset state for every page load to ensure a fresh session
    setStep('welcome');
    setError(null);
    setLoading(true);

    if (!userId || typeof userId !== 'string') {
        setError("Invalid link: No user ID provided.");
        setLoading(false);
        return;
    }

    try {
        // Find the active open house for this user
        const activeHouseQuery = query(
            collection(db, 'openHouses'),
            where('userId', '==', userId),
            where('isActive', '==', true),
            limit(1)
        );
        const activeHouseSnapshot = await getDocs(activeHouseQuery);

        if (activeHouseSnapshot.empty) {
            setError("This agent does not have an active open house at this time.");
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                setRealtor(userDocSnap.data() as UserProfile);
            }
            setLoading(false);
            return;
        }

        const houseData = { id: activeHouseSnapshot.docs[0].id, ...activeHouseSnapshot.docs[0].data() } as OpenHouse;
        setActiveHouse(houseData);
        
        // Fetch Realtor's public profile
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const realtorData = userDocSnap.data() as UserProfile;
            setRealtor(realtorData);

            // If gifts are enabled, fetch the specific brand details
            if (houseData.isGiftEnabled && houseData.giftBrandCode) {
                try {
                    // Public gift config is tricky; for now, we assume this info is public or fetched differently.
                    // This might need a dedicated server action later.
                } catch(e) {
                    console.warn("Could not fetch gift brand details for visitor page", e);
                }
            }
        }
        
        if (houseData.feedbackFormId) {
            const formDocRef = doc(db, 'feedbackForms', houseData.feedbackFormId);
            const formDocSnap = await getDoc(formDocRef);
            if(formDocSnap.exists()) {
                setFormTemplate({ id: formDocSnap.id, ...formDocSnap.data() } as FeedbackForm);
            } else {
                 setError("The assigned feedback form for this open house could not be found.");
            }
        } else {
             setError("No feedback form has been assigned to this open house.");
        }

    } catch (err) {
        console.error("Error fetching data:", err);
        setError("An error occurred while loading the page.");
    } finally {
        setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);


  const feedbackForm = useForm();
  const leadForm = useForm<z.infer<typeof leadSchema>>({
    resolver: zodResolver(leadSchema),
    defaultValues: { name: "", email: "", phone: "" },
  });
  
  const handleGetStarted = () => {
    setStep('form');
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  };
  
  async function onFeedbackSubmit(data: any) {
    if (!activeHouse || !formTemplate) return;

    const answers = formTemplate.questions.map(q => ({
      questionId: q.id,
      questionText: q.text,
      questionType: q.type,
      answer: data[q.id]
    }));

    try {
      const submissionRef = await addDoc(collection(db, 'feedbackSubmissions'), {
        userId: activeHouse.userId,
        openHouseId: activeHouse.id,
        formId: formTemplate.id,
        submittedAt: Timestamp.now(),
        answers: answers,
      });
      setFeedbackSubmissionId(submissionRef.id);
      setStep('lead');
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: 'Your feedback could not be saved. Please try again.'
      });
    }
  }

  async function onLeadSubmit(data: z.infer<typeof leadSchema>) {
    if (!activeHouse || !realtor) return;

    try {
        const lowerCaseEmail = data.email?.toLowerCase();
        const rawPhone = data.phone?.replace(/\D/g, '');
        
        const newLeadData: Omit<Lead, 'id'> = {
            name: data.name,
            email: lowerCaseEmail,
            phone: rawPhone,
            userId: activeHouse.userId,
            openHouseId: activeHouse.id,
            createdAt: Timestamp.now(),
            feedbackSubmissionId: feedbackSubmissionId,
            status: 'active' as const,
        };

        const leadRef = await addDoc(collection(db, "leads"), newLeadData);
        const leadId = leadRef.id;
        
        // If gifts are enabled for this house, create a pending gift
        if (activeHouse.isGiftEnabled && activeHouse.giftBrandCode && activeHouse.giftAmountInCents && newLeadData.email) {
            const newGift: Omit<any, 'id'> = {
                userId: activeHouse.userId,
                openHouseId: activeHouse.id,
                recipientName: newLeadData.name,
                recipientEmail: newLeadData.email,
                brandCode: activeHouse.giftBrandCode,
                amountInCents: activeHouse.giftAmountInCents,
                type: 'Auto',
                status: 'Pending',
                claimUrl: null,
                createdAt: Timestamp.now(),
            };
            await addDoc(collection(db, "gifts"), newGift);
        }
        
        setStep('thankyou');

        // Trigger email notification in the background, this will not block the UI
        sendNewLeadEmail({
            realtorId: realtor.id,
            leadId: leadId
        }).catch(err => {
            console.error("Failed to send new lead email in background:", err);
            // This error will not be shown to the visitor
        });

    } catch (error: any) {
        console.error("Error adding lead:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not save your information. Please try again."
        });
    }
  }

  const StarRatingInput = ({ field }: { field: any }) => {
    const [hover, setHover] = useState(0);
    const rating = field.value || 0;

    return (
        <div className="flex items-center gap-2">
        {[...Array(5)].map((_, index) => {
            const ratingValue = index + 1;
            return (
            <Star
                key={ratingValue}
                className={cn(
                "h-10 w-10 cursor-pointer transition-colors sm:h-12 sm:w-12",
                ratingValue <= (hover || rating)
                    ? "text-yellow-500 fill-yellow-400"
                    : "text-muted-foreground/50"
                )}
                onClick={() => field.onChange(ratingValue)}
                onMouseEnter={() => setHover(ratingValue)}
                onMouseLeave={() => setHover(0)}
            />
            );
        })}
        </div>
    );
  };
  
  const renderQuestion = (question: QuestionType) => {
    const fieldName = question.id;
    switch(question.type) {
        case 'short-answer':
            return (
                 <FormField
                    control={feedbackForm.control}
                    name={fieldName}
                    defaultValue=""
                    render={({ field }) => (
                      <FormItem>
                        <FormControl><Textarea placeholder="Your answer..." {...field} className="text-base" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                />
            );
        case 'yes-no':
            return (
                 <FormField
                    control={feedbackForm.control}
                    name={fieldName}
                    render={({ field }) => (
                        <FormItem>
                           <FormControl>
                                <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-4">
                                    <FormItem>
                                        <RadioGroupItem value="Yes" id={`${fieldName}-yes`} className="peer sr-only" />
                                        <FormLabel htmlFor={`${fieldName}-yes`} className="flex h-16 w-full items-center justify-center rounded-md border-2 border-muted bg-popover p-4 text-base font-semibold hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent peer-data-[state=checked]:text-accent-foreground">
                                            Yes
                                        </FormLabel>
                                    </FormItem>
                                    <FormItem>
                                        <RadioGroupItem value="No" id={`${fieldName}-no`} className="peer sr-only" />
                                        <FormLabel htmlFor={`${fieldName}-no`} className="flex h-16 w-full items-center justify-center rounded-md border-2 border-muted bg-popover p-4 text-base font-semibold hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent peer-data-[state=checked]:text-accent-foreground">
                                            No
                                        </FormLabel>
                                    </FormItem>
                                </RadioGroup>
                           </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            );
        case 'rating':
            return (
                <FormField
                    control={feedbackForm.control}
                    name={fieldName}
                    defaultValue={0}
                    render={({ field }) => (
                        <FormItem>
                           <FormControl>
                                <StarRatingInput field={field} />
                           </FormControl>
                           <FormMessage />
                        </FormItem>
                    )}
                />
            );
        case 'multiple-choice':
            return (
                 <FormField
                    control={feedbackForm.control}
                    name={fieldName}
                    defaultValue={[]}
                    render={({ field }) => (
                        <FormItem className="space-y-3">
                           {question.options?.map(option => (
                            <FormField
                                key={option.id}
                                control={feedbackForm.control}
                                name={fieldName}
                                render={({ field }) => {
                                return (
                                    <FormItem
                                        key={option.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                        <FormControl>
                                        <Checkbox
                                            className="h-6 w-6"
                                            checked={field.value?.includes(option.value)}
                                            onCheckedChange={(checked) => {
                                            return checked
                                                ? field.onChange([...(field.value || []), option.value])
                                                : field.onChange(
                                                    field.value?.filter(
                                                        (value: string) => value !== option.value
                                                    )
                                                    )
                                            }}
                                        />
                                        </FormControl>
                                        <FormLabel className="font-normal text-base">
                                            {option.value}
                                        </FormLabel>
                                    </FormItem>
                                )
                                }}
                            />
                            ))}
                            <FormMessage />
                        </FormItem>
                    )}
                />
            );
        default: return null;
    }
  };

  const formatPhoneNumber = (value?: string) => {
    if (!value) return "";
    const rawValue = value.replace(/\D/g, '');
    if (rawValue.length !== 10) return value;
    let formatted = `(${rawValue.substring(0, 3)}) ${rawValue.substring(3, 6)}-${rawValue.substring(6, 10)}`;
    return formatted;
  }
  
  const getInitials = (name?: string | null) => {
    if (!name) return "??";
    const names = name.split(' ');
    if (names.length > 1) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleSaveContact = () => {
    if (!realtor) return;

    const vCard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${realtor.name || ''}`,
      ...(realtor.phone ? [`TEL;TYPE=CELL:${realtor.phone}`] : []),
      ...(realtor.email ? [`EMAIL:${realtor.email}`] : []),
      ...(realtor.brokerageName ? [`ORG:${realtor.brokerageName}`] : []),
      'END:VCARD'
    ].join('\n');

    const blob = new Blob([vCard], { type: 'text/vcard;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const sanitizedName = (realtor.name || 'contact').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${sanitizedName}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const GiftBanner = () => {
    if (!activeHouse?.isGiftEnabled || !giftBrand) return null;
    
    return (
        <div className="bg-yellow-100/60 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800/60 rounded-lg p-3 flex items-center gap-4">
            <div className="w-12 h-12 relative bg-white rounded-md border flex items-center justify-center flex-shrink-0">
                <Image src={giftBrand.image_url} alt={giftBrand.name} fill className="object-contain p-1" data-ai-hint="company logo"/>
            </div>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Provide your feedback and receive a small gift as a thank you!
            </p>
        </div>
    )
  }


  const renderContent = () => {
    if (loading) {
      return (
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      );
    }

    if (error || !activeHouse) {
       return (
        <Card className="w-full max-w-lg">
          <CardHeader className="items-center text-center">
             <div className="flex justify-center mb-4">
                <div className="bg-destructive/10 h-16 w-16 rounded-full flex items-center justify-center">
                    <AlertCircle className="h-10 w-10 text-destructive"/>
                </div>
            </div>
            <CardTitle>Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-destructive">{error || "Could not load the open house details."}</p>
            {realtor && (
                 <div className="mt-6 text-sm text-muted-foreground">
                    <p>This link belongs to:</p>
                    <p className="font-semibold text-foreground">{realtor.name}</p>
                    <p>{realtor.email}</p>
                 </div>
            )}
          </CardContent>
        </Card>
      );
    }
    
    let streetAddress = '';
    let cityStateZip = '';

    if (activeHouse.structuredAddress) {
        streetAddress = `${activeHouse.structuredAddress.streetNumber} ${activeHouse.structuredAddress.streetName}${activeHouse.structuredAddress.unitNumber ? ` #${activeHouse.structuredAddress.unitNumber}` : ''}`;
        cityStateZip = `${activeHouse.structuredAddress.city}, ${activeHouse.structuredAddress.state} ${activeHouse.structuredAddress.zipCode}`;
    } else {
        const addressParts = activeHouse.address.split(',');
        streetAddress = addressParts[0];
        if (addressParts.length > 1) {
            cityStateZip = addressParts.slice(1).join(',').trim();
        }
    }

    switch (step) {
      case 'welcome':
        return (
          <Card className="w-full max-w-lg overflow-hidden">
            <CardHeader className="items-center text-center p-0">
               <div className="w-full h-48 sm:h-64 relative bg-muted">
                    {activeHouse.imageUrl ? (
                        <Image 
                            src={activeHouse.imageUrl}
                            alt={`Image of ${activeHouse.address}`}
                            fill
                            className="object-cover"
                            data-ai-hint="house exterior"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Home className="w-16 h-16 text-muted-foreground"/>
                        </div>
                    )}
               </div>
                <div className="p-6 pb-2 text-center">
                    <p className="text-muted-foreground">Welcome to</p>
                    <h2 className="text-2xl font-bold mt-1">{streetAddress}</h2>
                    <p className="text-muted-foreground">{cityStateZip}</p>
                </div>
            </CardHeader>
            <CardContent className="text-center px-6">
              <p className="text-muted-foreground">Please take a moment to provide your feedback.</p>
              <Button size="lg" className="w-full mt-6" onClick={handleGetStarted} disabled={!formTemplate}>
                {!formTemplate ? "Feedback form not available" : "Get Started"}
              </Button>
               <div className="mt-6">
                <GiftBanner />
               </div>
            </CardContent>
            <CardFooter className="flex-col gap-4 p-6 bg-muted/50 border-t">
                {realtor && (
                     <div className='flex flex-col items-center text-center'>
                        <p className="text-sm text-muted-foreground mb-2">Hosted by</p>
                         <div className="flex items-center gap-3">
                            {realtor.photoURL && (
                                <Avatar>
                                    <AvatarImage src={realtor.photoURL} alt={realtor.name || 'Realtor'} data-ai-hint="person headshot" />
                                    <AvatarFallback>{getInitials(realtor.name)}</AvatarFallback>
                                </Avatar>
                            )}
                             <div className='text-left'>
                                 <p className="font-semibold">{realtor.name}</p>
                                {realtor.title && (
                                    <p className="text-sm text-muted-foreground">{realtor.title}</p>
                                )}
                             </div>
                         </div>
                        {realtor.brokerageName && (
                            <p className="text-sm text-muted-foreground mt-2">{realtor.brokerageName}</p>
                        )}
                        {realtor.licenseNumber && (
                            <p className="text-xs text-muted-foreground/80 mt-1">{realtor.licenseNumber}</p>
                        )}
                    </div>
                )}
            </CardFooter>
          </Card>
        );

      case 'form':
        if (!formTemplate) return null; // Should be handled by button disable but good for safety
        return (
          <Card className="w-full max-w-lg">
             <Form {...feedbackForm}>
              <form onSubmit={feedbackForm.handleSubmit(onFeedbackSubmit)}>
                <CardHeader>
                  <CardTitle>Welcome to</CardTitle>
                   <div>
                        <h2 className="text-lg font-semibold -mt-1">{streetAddress}</h2>
                        <p className="text-sm text-muted-foreground">{cityStateZip}</p>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    {formTemplate.questions.map((q, index) => (
                        <div key={q.id}>
                            <FormLabel className="font-semibold text-xl">{index + 1}. {q.text}</FormLabel>
                            <div className="pt-4">
                               {renderQuestion(q)}
                            </div>
                        </div>
                    ))}
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" size="lg" disabled={feedbackForm.formState.isSubmitting}>
                     {feedbackForm.formState.isSubmitting ? "Submitting..." : "Submit Feedback"}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        );
        
      case 'lead':
         return (
          <Card className="w-full max-w-lg">
            <Form {...leadForm}>
              <form onSubmit={leadForm.handleSubmit(onLeadSubmit)}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><UserPlus/> Please Sign In</CardTitle>
                    <CardDescription>
                        Provide your contact info for the agent.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <GiftBanner />
                    <FormField control={leadForm.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={leadForm.control} name="email" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl><Input placeholder="jane@example.com" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                     <FormField control={leadForm.control} name="phone" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl><Input type="tel" placeholder="(555) 123-4567" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </CardContent>
                <CardFooter className="flex-col gap-4">
                  <div className="flex w-full flex-col-reverse sm:flex-row gap-2">
                        <Button type="submit" className="w-full" disabled={leadForm.formState.isSubmitting}>
                            <UserPlus className="mr-2" />
                            {leadForm.formState.isSubmitting ? "Saving..." : "Submit"}
                        </Button>
                  </div>
                  <FormDescription className="text-xs text-center text-muted-foreground pt-2 px-6">
                    By submitting your information, you consent for {realtor?.name || 'the agent'} to contact you.
                  </FormDescription>
                </CardFooter>
              </form>
            </Form>
          </Card>
        );

      case 'thankyou':
         return (
            <Card className="w-full max-w-lg text-center">
                <CardHeader>
                    {realtor?.photoURL && (
                       <div className="flex justify-center mb-4">
                           <Avatar className="h-24 w-24 border-2 border-primary">
                                <AvatarImage src={realtor.photoURL} alt={realtor.name || 'Realtor'} data-ai-hint="person headshot" />
                                <AvatarFallback>{getInitials(realtor.name)}</AvatarFallback>
                           </Avatar>
                        </div>
                    )}
                    <CardTitle className="text-2xl">Thank you!</CardTitle>
                    <CardDescription className="text-base">
                         Your feedback is greatly appreciated.
                    </CardDescription>
                </CardHeader>
                {realtor && (
                    <>
                    <CardContent className="space-y-4">
                         <Separator />
                        <div className="text-center">
                            <p className="font-semibold text-lg">{realtor.name}</p>
                            {realtor.title && (
                                <p className="text-muted-foreground">{realtor.title}</p>
                            )}
                            {realtor.brokerageName && (
                                <p className="text-muted-foreground">{realtor.brokerageName}</p>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                           {realtor.email && (
                             <a href={`mailto:${realtor.email}`} className="flex items-center gap-2 hover:text-primary">
                               <Mail className="w-4 h-4" />
                               <span>{realtor.email}</span>
                             </a>
                           )}
                           {realtor.phone && (
                              <a href={`tel:${realtor.phone}`} className="flex items-center gap-2 hover:text-primary">
                               <Phone className="w-4 h-4" />
                               <span>{formatPhoneNumber(realtor.phone)}</span>
                             </a>
                           )}
                        </div>
                         {(realtor.personalLogoUrl || realtor.brokerageLogoUrl) && (
                            <div className="flex justify-center items-center gap-8 pt-4">
                                {realtor.personalLogoUrl && (
                                    <div className="relative h-16 w-32">
                                        <Image
                                            src={realtor.personalLogoUrl}
                                            alt="Personal logo"
                                            fill
                                            className="object-contain"
                                            data-ai-hint="company logo"
                                        />
                                    </div>
                                )}
                                {realtor.brokerageLogoUrl && (
                                    <div className="relative h-16 w-32">
                                        <Image
                                            src={realtor.brokerageLogoUrl}
                                            alt={`${realtor.brokerageName} logo`}
                                            fill
                                            className="object-contain"
                                            data-ai-hint="company logo"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        {realtor.licenseNumber && (
                            <p className="text-xs text-muted-foreground/80 pt-4">{realtor.licenseNumber}</p>
                        )}
                    </CardContent>
                    <CardFooter>
                         <Button onClick={handleSaveContact} className="w-full">
                            <Contact className="mr-2" />
                            Save to Contacts
                        </Button>
                    </CardFooter>
                    </>
                )}
            </Card>
         );
    }
  };

  return (
    <div className="min-h-screen w-full bg-muted flex flex-col items-center justify-center p-4">
      {renderContent()}
    </div>
  );
}

    