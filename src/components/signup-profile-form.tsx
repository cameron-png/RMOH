
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase/client";
import { useEffect, useState } from "react";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  phone: z.string().min(10, {
    message: "Please enter a valid phone number.",
  }).transform((val) => val.replace(/\D/g, '')), // Keep only digits for submission
});

export function SignUpProfileForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [formattedPhone, setFormattedPhone] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  useEffect(() => {
    // If no user is logged in after loading, they shouldn't be here.
    if (!loading && !user) {
      router.replace('/signup');
    }
  }, [user, loading, router]);
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    let formatted = "";

    if (rawValue.length > 0) {
      formatted = "(" + rawValue.substring(0, 3);
    }
    if (rawValue.length >= 4) {
      formatted += ") " + rawValue.substring(3, 6);
    }
    if (rawValue.length >= 7) {
      formatted += "-" + rawValue.substring(6, 10);
    }
    
    setFormattedPhone(formatted);
    form.setValue("phone", rawValue);
  };


  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "You must be signed in to complete your profile.",
        });
        return;
    }

    try {
      // Create a document in the 'users' collection
      await setDoc(doc(db, "users", user.uid), {
        name: values.name,
        email: user.email, // Get email from the authenticated user object
        phone: values.phone,
      });

      toast({
        title: "Profile Complete!",
        description: "Redirecting to your dashboard...",
      });
      router.replace("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not save profile information.",
      });
    }
  }

  if (loading || !user) {
    return (
        <div className="flex w-full items-center justify-center">
            <p>Loading...</p>
        </div>
    );
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4 pt-6">
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
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">Complete Profile</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
