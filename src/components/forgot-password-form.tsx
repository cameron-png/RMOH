
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from 'next/link';
import { useState } from "react";

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
import { auth } from "@/lib/firebase/client";

const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

export function ForgotPasswordForm() {
  const { toast } = useToast();
  const { sendPasswordResetEmail } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await sendPasswordResetEmail(auth, values.email);
      setIsSubmitted(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
      });
    }
  }
  
  if (isSubmitted) {
    return (
        <Card>
            <CardContent className="pt-6 text-center">
                <h3 className="font-semibold">Check Your Email</h3>
                <p className="text-sm text-muted-foreground mt-2">If an account exists with that email, a password reset link has been sent.</p>
                 <Button variant="link" asChild className="mt-4">
                    <Link href="/">Back to Sign In</Link>
                 </Button>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4 pt-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Sending..." : "Send Reset Link"}
            </Button>
             <Button variant="link" asChild>
                <Link href="/">Back to Sign In</Link>
             </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
