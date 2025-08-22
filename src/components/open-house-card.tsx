
"use client";

import Link from 'next/link';
import Image from 'next/image';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OpenHouse } from '@/lib/types';
import { Home, QrCode, Users, MessageSquare, Gift } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';

type OpenHouseCardProps = {
  openHouse: OpenHouse;
  leadCount: number;
  feedbackCount: number;
  isGiftEnabled: boolean;
  onSetActive: (id: string) => void;
};

export function OpenHouseCard({ openHouse, leadCount, feedbackCount, isGiftEnabled, onSetActive }: OpenHouseCardProps) {
    if (!openHouse.address) {
        // Return a loading state or null if address is not yet available
        return (
             <Card className="flex flex-col h-full group w-full overflow-hidden">
                <div className="p-4 flex-grow flex flex-col">
                    <p className="text-muted-foreground">Loading address...</p>
                </div>
            </Card>
        );
    }
    
    const addressParts = openHouse.address.split(',');
    const streetAddress = addressParts[0];
    const cityStateZip = addressParts.length > 1 ? addressParts.slice(1).join(',').trim() : '';

    return (
        <Card className="flex flex-col h-full group w-full overflow-hidden">
            <Link href={`/user/open-house/${openHouse.id}`} className="block h-40 w-full relative bg-muted border-b">
                {openHouse.imageUrl ? (
                    <Image 
                        src={openHouse.imageUrl}
                        alt={`Image of ${openHouse.address}`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        data-ai-hint="house exterior"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Home className="w-10 h-10 text-muted-foreground"/>
                    </div>
                )}
            </Link>
            <div className="p-4 flex-grow flex flex-col">
                <div className="flex-grow">
                     <div className="flex justify-between items-start gap-2">
                         <div className="flex-grow">
                            <Link href={`/user/open-house/${openHouse.id}`}>
                                <p className="font-semibold text-lg leading-tight group-hover:underline">{streetAddress}</p>
                            </Link>
                            {cityStateZip && <p className="text-sm text-muted-foreground">{cityStateZip}</p>}
                        </div>
                        <div className="flex-shrink-0 mt-1">
                            {openHouse.isActive ? (
                                <Badge className="bg-green-600 text-white hover:bg-green-600">
                                    <QrCode className="mr-1.5" />
                                    Active
                                </Badge>
                            ) : (
                            <Button onClick={() => onSetActive(openHouse.id)} size="sm" variant="secondary" className="shadow-sm">
                                    Set Active
                            </Button>
                            )}
                        </div>
                    </div>
                </div>

                <Separator className="my-4" />

                <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <Link href={`/user/my-leads?house=${openHouse.id}`} className="hover:underline flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{leadCount} {leadCount === 1 ? 'Lead' : 'Leads'}</span>
                    </Link>
                    <Separator orientation="vertical" className="h-4 hidden sm:block"/>
                    <Link href={`/user/open-house/${openHouse.id}/feedback`} className="hover:underline flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        <span>{feedbackCount} {feedbackCount === 1 ? 'Entry' : 'Entries'}</span>
                    </Link>
                     <Separator orientation="vertical" className="h-4 hidden sm:block"/>
                     <div className={cn("flex items-center gap-2", isGiftEnabled ? 'text-green-600' : 'text-muted-foreground')}>
                        <Gift className="w-4 h-4" />
                        <span>Gifts {isGiftEnabled ? 'On' : 'Off'}</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}
