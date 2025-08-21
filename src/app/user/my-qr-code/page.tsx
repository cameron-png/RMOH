
"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import QRCode from "qrcode.react";
import { Button } from '@/components/ui/button';
import { Download, Copy, ExternalLink, CheckCircle, Info, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import Link from 'next/link';


export default function MyQrCodePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const qrCodeRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const url = window.location.origin;
        setPageUrl(url);
    }
  }, []);

  useEffect(() => {
    if (user && pageUrl) {
      setQrCodeValue(`${pageUrl}/v/${user.uid}`);
    }
  }, [user, pageUrl]);


  const handleDownload = () => {
    if (qrCodeRef.current) {
        const canvas = qrCodeRef.current.querySelector("canvas");
        if (canvas) {
            const pngUrl = canvas
                .toDataURL("image/png")
                .replace("image/png", "image/octet-stream");
            let downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = "my-open-house-qr-code.png";
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    }
  };

  const handleCopyLink = () => {
    if (!qrCodeValue) return;
    navigator.clipboard.writeText(qrCodeValue).then(() => {
        toast({
            title: "Copied to clipboard!",
        });
    }, (err) => {
        toast({
            variant: "destructive",
            title: "Failed to copy",
            description: "Could not copy the link. Please try again.",
        });
    });
  };

  return (
    <div className="w-full mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">My QR Code</h1>
        <p className="text-muted-foreground">
          This is your permanent QR code. It will always link to your currently active open house.
        </p>
      </div>

      <Card className="w-full max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Your Universal Open House QR Code</CardTitle>
          <CardDescription>
            Display this on a tablet or print it out. It automatically links to whichever open house you set as active on your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8 gap-6">
            {!user ? (
                <div className="w-[288px] h-[288px] bg-muted rounded-lg flex items-center justify-center border">
                    <Home className="w-24 h-24 text-muted-foreground/30" />
                </div>
            ) : (
                 <div className="p-4 bg-white rounded-lg border" ref={qrCodeRef}>
                    <QRCode value={qrCodeValue} size={256} />
                </div>
            )}
            <p className="text-sm text-center text-muted-foreground max-w-xs">
                Visitors can scan this code to open a feedback form on their device.
            </p>
             <Button onClick={handleDownload} disabled={!user}>
                <Download className="mr-2" />
                Download QR Code
             </Button>
        </CardContent>
        <CardFooter className="flex-col gap-4 items-start bg-muted/50 p-4 border-t">
            <label htmlFor="qr-link" className="text-sm font-medium text-muted-foreground">Your Public Link</label>
            <div className="flex w-full gap-2">
                <Input id="qr-link" readOnly value={!user ? "Loading your link..." : qrCodeValue} className="bg-background" />
                <Button variant="outline" size="icon" onClick={handleCopyLink} disabled={!user} aria-label="Copy Link">
                    <Copy />
                </Button>
                 <Button variant="outline" size="icon" asChild disabled={!user}>
                    <Link href={qrCodeValue} target="_blank" rel="noopener noreferrer" aria-label="Open Link in New Tab">
                        <ExternalLink />
                    </Link>
                </Button>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}
