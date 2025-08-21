
"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { OpenHouse, FeedbackSubmission, Lead } from '@/lib/types';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MessageSquare, Star, User, Share2, Copy } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';

export default function FeedbackResponsesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const [openHouse, setOpenHouse] = useState<OpenHouse | null>(null);
  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([]);
  const [leads, setLeads] = useState<Map<string, Lead>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const id = params.id as string;

  const fetchData = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch open house data
      const houseDocRef = doc(db, 'openHouses', id);
      const houseDocSnap = await getDoc(houseDocRef);

      if (!houseDocSnap.exists() || houseDocSnap.data().userId !== user.uid) {
        setError("Open house not found or you don't have permission to view it.");
        setLoading(false);
        return;
      }
      const houseData = { id: houseDocSnap.id, ...houseDocSnap.data() } as OpenHouse;
      setOpenHouse(houseData);

      // Fetch feedback submissions
      const submissionsQuery = query(
        collection(db, 'feedbackSubmissions'),
        where('userId', '==', user.uid),
        where('openHouseId', '==', id),
        orderBy('submittedAt', 'desc')
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const submissionsList = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackSubmission));
      setSubmissions(submissionsList);

      if (submissionsList.length > 0) {
        // Fetch associated leads
        const leadsQuery = query(
          collection(db, 'leads'),
          where('userId', '==', user.uid),
          where('openHouseId', '==', id)
        );
        const leadsSnapshot = await getDocs(leadsQuery);
        const leadsMap = new Map<string, Lead>();
        leadsSnapshot.forEach(doc => {
          const lead = doc.data() as Lead;
          if (lead.feedbackSubmissionId) {
            leadsMap.set(lead.feedbackSubmissionId, { id: doc.id, ...lead } as Lead);
          }
        });
        setLeads(leadsMap);
      }

    } catch (err) {
      console.error("Error fetching feedback data:", err);
      setError("Failed to fetch feedback responses.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch feedback. Check console for details.",
      });
    } finally {
      setLoading(false);
    }
  }, [id, user, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  const renderAnswer = (answer: any, type: string) => {
    if (Array.isArray(answer)) {
      return answer.join(', ');
    }
    if (type === 'rating') {
      return (
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={cn("w-4 h-4", i < answer ? "text-yellow-500 fill-yellow-400" : "text-muted-foreground/30")} />
          ))}
          <span className="text-muted-foreground ml-2">({answer}/5)</span>
        </div>
      );
    }
    return answer || <span className="text-muted-foreground italic">No answer</span>;
  };
  
  const formatName = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      const firstName = parts[0];
      const lastInitial = parts[parts.length - 1].charAt(0);
      return `${firstName} ${lastInitial}.`;
    }
    return name;
  };

  const generateFeedbackText = (submission: FeedbackSubmission) => {
    const associatedLead = leads.get(submission.id);
    const visitorName = associatedLead ? formatName(associatedLead.name) : `Visitor #${submissions.length - submissions.indexOf(submission)}`;

    let text = `Feedback for ${openHouse?.address}\n`;
    text += `From: ${visitorName}\n`;
    text += `Date: ${format(submission.submittedAt.toDate(), 'MMM d, yyyy, p')}\n\n`;
    
    submission.answers.forEach(a => {
        let answerText = a.answer;
        if (a.questionType === 'rating') answerText = `${a.answer}/5`;
        if (Array.isArray(a.answer)) answerText = a.answer.join(', ');
        if (!answerText) answerText = '(No answer)';
        text += `Q: ${a.questionText}\nA: ${answerText}\n\n`;
    });
    return text;
  }
  
  const handleShareOrCopy = async (submission: FeedbackSubmission) => {
    const textToShare = generateFeedbackText(submission);

    // Try to use the Share API first
    if (navigator.share) {
        try {
            await navigator.share({
                title: `Feedback for ${openHouse?.address}`,
                text: textToShare,
            });
            // If the share is successful, we're done.
            return;
        } catch (error) {
            // If the user aborts the share, or if it fails for other reasons,
            // we'll fall through to the clipboard copy.
            if (error instanceof DOMException && error.name === 'AbortError') {
                 // User cancelled the share dialog, do nothing.
                 return;
            }
            console.warn("Share API failed, falling back to clipboard:", error);
        }
    }

    // Fallback to clipboard if Share API is not available or failed
    try {
        await navigator.clipboard.writeText(textToShare);
        toast({
            title: "Copied to Clipboard",
        });
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        toast({
            variant: "destructive",
            title: "Copy Failed",
            description: "Could not copy the feedback to the clipboard.",
        });
    }
  };


  if (loading || authLoading) return <p className="text-muted-foreground p-6">Loading feedback...</p>;
  if (error) return <p className="text-destructive p-6">{error}</p>;

  return (
    <div className="w-full mx-auto space-y-8">
      <div>
        <Button variant="ghost" onClick={() => router.back()} className="mb-4 -ml-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span>Back to Open House</span>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Feedback Responses</h1>
        <p className="text-muted-foreground">For: {openHouse?.address}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Submissions ({submissions.length})</CardTitle>
          <CardDescription>
            Here are all the feedback forms submitted during your open house.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submissions.length > 0 ? (
            <Accordion type="multiple" className="w-full">
              {submissions.map((submission, index) => {
                const associatedLead = leads.get(submission.id);
                return (
                  <AccordionItem value={submission.id} key={submission.id}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        {associatedLead ? (
                            <Link href={`/user/my-leads?house=${id}`} className="flex items-center gap-2 hover:underline">
                              <User className="w-4 h-4 text-primary" />
                              <span className="font-semibold">{formatName(associatedLead.name)}</span>
                          </Link>
                        ) : (
                          <span className="font-semibold">Anonymous Visitor #{submissions.length - index}</span>
                        )}
                          <span className="text-sm text-muted-foreground font-normal hidden sm:inline-block">
                            - {format(submission.submittedAt.toDate(), 'MMM d, p')}
                          </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                       <div className="space-y-4 pt-2">
                         <div className="flex justify-end -mt-2 mb-2">
                            <Button onClick={() => handleShareOrCopy(submission)}>
                                <Share2 className="mr-2 h-4 w-4" />
                                Share or Copy
                            </Button>
                          </div>
                        {submission.answers.map((answer, i) => (
                          <div key={i}>
                            <p className="font-medium text-sm">{answer.questionText}</p>
                            <div className="text-foreground pl-4 mt-1">
                               {renderAnswer(answer.answer, answer.questionType)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="text-xl font-medium mt-4">No Feedback Yet</h3>
              <p className="text-muted-foreground mt-2">
                Feedback from visitors will appear here once submitted.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
