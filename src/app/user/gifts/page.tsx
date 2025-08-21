"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift } from "lucide-react";

export default function GiftsPage() {
  return (
    <div className="w-full mx-auto space-y-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Gifts</h1>
            <p className="text-muted-foreground">
                This feature is currently unavailable.
            </p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Gifts</CardTitle>
                <CardDescription>This feature is not yet available.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <Gift className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="text-xl font-medium mt-4">Feature not available</h3>
                    <p className="text-muted-foreground mt-2">
                        This feature is temporarily disabled.
                    </p>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
