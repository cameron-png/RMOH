"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Gift } from 'lucide-react';

// A placeholder type for now. This will be expanded later.
type Gift = {
  id: string;
  recipient: string;
  gift: string;
  type: string;
  from: string;
  status: 'Pending' | 'Available';
  link?: string;
};

export default function GiftsPage() {
  const [gifts, setGifts] = useState<Gift[]>([]);

  return (
    <div className="w-full mx-auto space-y-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Gifts</h1>
            <p className="text-muted-foreground">
                A log of all created gifts.
            </p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Gift Log</CardTitle>
                <CardDescription>A list of all the gifts you have created.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Gift</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Link</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gifts.length > 0 ? (
                        gifts.map((gift) => (
                          <TableRow key={gift.id}>
                            <TableCell>{gift.recipient}</TableCell>
                            <TableCell>{gift.gift}</TableCell>
                            <TableCell>{gift.type}</TableCell>
                            <TableCell>{gift.from}</TableCell>
                            <TableCell>
                                <Badge variant={gift.status === 'Available' ? 'default' : 'secondary'}>
                                    {gift.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                {gift.link ? (
                                    <Button variant="outline" size="sm">
                                        <Copy className="mr-2 h-4 w-4" />
                                        Copy Link
                                    </Button>
                                ) : (
                                    <span>-</span>
                                )}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center">
                            No gifts have been created yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
