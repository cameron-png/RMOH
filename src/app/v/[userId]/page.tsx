

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc, collection, addDoc, Timestamp, getDocs, query, where, limit, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { OpenHouse, FeedbackForm, Question as QuestionType, UserProfile, Gift } from '@/lib/types';
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
import { Home, ThumbsUp, UserPlus, CheckCircle, Star, AlertCircle, Mail, Phone, Building, Contact, Gift as GiftIcon } from 'lucide-react';
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


// Function to build the Zod schema dynamically
const buildFeedbackSchema = (questions: QuestionType[]) => {
  const schemaShape: { [key: string]: z.ZodTypeAny } = {};

  questions.forEach(q => {
    if (q.isRequired) {
      switch (q.type) {
        case 'short-answer':
          schemaShape[q.id] = z.string().min(1, 'This field is required.');
          break;
        case 'yes-no':
           schemaShape[q.id] = z.enum(['Yes', 'No'], { required_error: 'Please select an option.' });
          break;
        case 'rating':
          schemaShape[q.id] = z.number().min(1, 'Please provide a rating.');
          break;
        case 'multiple-choice':
          schemaShape[q.id] = z.array(z.string()).nonempty('Please select at least one option.');
          break;
      }
    }
  });

  return z.object(schemaShape);
};


export default function VisitorFeedbackPage() {
  const { userId } = useParams();
  const { toast } = useToast();

  const [step, setStep] = useState<'welcome' | 'form' | 'lead' | 'thankyou'>('welcome');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [realtor, setRealtor] = useState<UserProfile | null>(null);
  const [activeHouse, setActiveHouse] = useState<OpenHouse | null>(null);
  const [formTemplate, setFormTemplate] = useState<FeedbackForm | null>(null);
  
  const [feedbackSubmissionId, setFeedbackSubmissionId] = useState<string | null>(null);

  const [dynamicFeedbackSchema, setDynamicFeedbackSchema] = useState(z.object({}));

  useEffect(() => {
    if (formTemplate) {
        setDynamicFeedbackSchema(buildFeedbackSchema(formTemplate.questions));
    }
  }, [formTemplate]);


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
        // Fetch Realtor's public profile first
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            setRealtor({ id: userDocSnap.id, ...userDocSnap.data() } as UserProfile);
        } else {
             setError("This agent does not have an active profile.");
             setLoading(false);
             return;
        }

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
            setLoading(false);
            return;
        }

        const houseData = { id: activeHouseSnapshot.docs[0].id, ...activeHouseSnapshot.docs[0].data() } as OpenHouse;
        setActiveHouse(houseData);
        
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


  const feedbackForm = useForm({
     resolver: zodResolver(dynamicFeedbackSchema),
  });

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
      answer: data[q.id] === undefined ? null : data[q.id]
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
        
        const newLeadData: Omit<any, 'id'> = {
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
            const newGift: Omit<Gift, 'id'> = {
                userId: activeHouse.userId,
                openHouseId: activeHouse.id,
                recipientName: newLeadData.name,
                recipientEmail: newLeadData.email,
                brandCode: activeHouse.giftBrandCode,
                ...(activeHouse.brandName && { brandName: activeHouse.brandName }),
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
    return (
      <FormField
        control={feedbackForm.control}
        name={fieldName}
        defaultValue={question.type === 'multiple-choice' ? [] : question.type === 'rating' ? 0 : ""}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <div className="space-y-2">
                {question.type === 'short-answer' && <Textarea placeholder="Your answer..." {...field} className="text-base" />}
                {question.type === 'yes-no' && (
                  <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-4">
                    <FormItem>
                      <RadioGroupItem value="Yes" id={`${fieldName}-yes`} className="peer sr-only" />
                      <FormLabel htmlFor={`${fieldName}-yes`} className="flex h-16 w-full items-center justify-center rounded-md border-2 border-muted bg-popover p-4 text-base font-semibold hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent peer-data-[state=checked]:text-accent-foreground">Yes</FormLabel>
                    </FormItem>
                    <FormItem>
                      <RadioGroupItem value="No" id={`${fieldName}-no`} className="peer sr-only" />
                      <FormLabel htmlFor={`${fieldName}-no`} className="flex h-16 w-full items-center justify-center rounded-md border-2 border-muted bg-popover p-4 text-base font-semibold hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent peer-data-[state=checked]:text-accent-foreground">No</FormLabel>
                    </FormItem>
                  </RadioGroup>
                )}
                {question.type === 'rating' && <StarRatingInput field={field} />}
                {question.type === 'multiple-choice' && (
                  <div className="space-y-3">
                    {question.options?.map(option => (
                      <FormItem key={option.id} className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            className="h-6 w-6"
                            checked={field.value?.includes(option.value)}
                            onCheckedChange={(checked) => {
                              const currentValue = field.value || [];
                              return checked
                                ? field.onChange([...currentValue, option.value])
                                : field.onChange(currentValue.filter((value: string) => value !== option.value));
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal text-base">{option.value}</FormLabel>
                      </FormItem>
                    ))}
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
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
    if (!activeHouse?.isGiftEnabled) return null;
    
    const giftAmountText = activeHouse.giftAmountInCents
        ? `a $${(activeHouse.giftAmountInCents / 100).toFixed(2)} ${activeHouse.giftBrandName || 'gift card'}`
        : 'a small gift';
        
    return (
        <div className="bg-green-100/60 dark:bg-green-950/40 border border-green-200 dark:border-green-800/60 rounded-lg p-3 flex items-center gap-4">
            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center">
                <GiftIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm text-green-800 dark:text-green-200">
                Provide your feedback and receive {giftAmountText} as a thank you!
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
        if (!formTemplate) return null;
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
                            <FormLabel className="font-semibold text-xl flex items-center gap-2">
                               <span>{index + 1}. {q.text}</span>
                               {q.isRequired && <span className="text-destructive text-lg">*</span>}
                            </FormLabel>
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
