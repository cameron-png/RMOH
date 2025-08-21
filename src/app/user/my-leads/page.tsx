
"use client";

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { Lead as LeadType, OpenHouse, AppSettings } from '@/lib/types';
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Users, Trash2, Edit, MoreHorizontal, FileText, PlusCircle, Download, Home, Contact } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

const leadFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }).optional().or(z.literal('')),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

function AllLeadsPageContent() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const houseQueryParam = searchParams.get('house');

  const [leads, setLeads] = useState<LeadType[]>([]);
  const [openHouses, setOpenHouses] = useState<Map<string, OpenHouse>>(new Map());
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedHouseId, setSelectedHouseId] = useState('all');

  const [isEditLeadDialogOpen, setIsEditLeadDialogOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<LeadType | null>(null);
  
  const [isDeleteLeadAlertOpen, setIsDeleteLeadAlertOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  
  const [formattedPhone, setFormattedPhone] = useState("");

  const fetchAllData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch all open houses for the user first
      const housesQuery = query(collection(db, 'openHouses'), where('userId', '==', user.uid));
      const housesSnapshot = await getDocs(housesQuery);
      const housesMap = new Map<string, OpenHouse>();
      housesSnapshot.docs.forEach(doc => {
        housesMap.set(doc.id, { id: doc.id, ...doc.data() } as OpenHouse);
      });
      setOpenHouses(housesMap);

      // Fetch all leads for the user
      const leadsQuery = query(collection(db, 'leads'), where('userId', '==', user.uid), where('status', '==', 'active'));
      const leadsSnapshot = await getDocs(leadsQuery);
      const leadsList = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeadType));
      setLeads(leadsList);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Data Fetch Error",
        description: "Could not fetch your leads.",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchAllData();
    }
  }, [authLoading, user, fetchAllData]);
  
  useEffect(() => {
    if (houseQueryParam) {
      setSelectedHouseId(houseQueryParam);
    }
  }, [houseQueryParam]);


  const leadEditForm = useForm<z.infer<typeof leadFormSchema>>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { name: "", email: "", phone: "", notes: "" },
  });
  
  const formatPhoneNumber = (value: string) => {
    if (!value) return "";
    const rawValue = value.replace(/\D/g, '');
    let formatted = "";

    if (rawValue.length > 0) formatted = "(" + rawValue.substring(0, 3);
    if (rawValue.length >= 4) formatted += ") " + rawValue.substring(3, 6);
    if (rawValue.length >= 7) formatted += "-" + rawValue.substring(6, 10);
    
    return formatted;
  }
  
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormattedPhone(formatted);
    leadEditForm.setValue("phone", e.target.value.replace(/\D/g, ''));
  };

  async function onEditLeadSubmit(values: z.infer<typeof leadFormSchema>) {
    if (!user || !leadToEdit) return;

    const leadDocRef = doc(db, 'leads', leadToEdit.id);
    try {
      await updateDoc(leadDocRef, { ...values });
      setIsEditLeadDialogOpen(false);
      setLeadToEdit(null);
      await fetchAllData();
    } catch (error) {
      console.error("Error updating lead: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not update lead. Please try again." });
    }
  }

  const handleDeleteLead = async () => {
    if (!leadToDelete) return;
    try {
      const leadRef = doc(db, 'leads', leadToDelete);
      await updateDoc(leadRef, { status: 'deleted' });
      await fetchAllData();
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast({ variant: "destructive", title: "Delete Failed", description: "Could not delete the lead." });
    } finally {
      setIsDeleteLeadAlertOpen(false);
      setLeadToDelete(null);
    }
  };
  
  const openDeleteLeadDialog = (leadId: string) => {
    setLeadToDelete(leadId);
    setIsDeleteLeadAlertOpen(true);
  };
  
  const openEditLeadDialog = (lead: LeadType) => {
    setLeadToEdit(lead);
    leadEditForm.reset({
      name: lead.name,
      email: lead.email || "",
      phone: lead.phone || "",
      notes: lead.notes || "",
    });
    setFormattedPhone(formatPhoneNumber(lead.phone || ""));
    setIsEditLeadDialogOpen(true);
  };

  const filteredAndSortedLeads = useMemo(() => {
    return leads
      .filter(lead => {
          // Filter by selected open house
          if (selectedHouseId !== 'all' && lead.openHouseId !== selectedHouseId) {
            return false;
          }
          
          // Filter by search term
          const houseAddress = openHouses.get(lead.openHouseId)?.address || '';
          return lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 (lead.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                 houseAddress.toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate()?.getTime() || 0;
        const dateB = b.createdAt?.toDate()?.getTime() || 0;
        return sortOrder === 'newest' ? dateB - dateA : dateA - b.createdAt.toDate().getTime();
      });
  }, [leads, openHouses, searchTerm, sortOrder, selectedHouseId]);
  
  const handleExportCSV = () => {
    if (filteredAndSortedLeads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Leads to Export',
        description: 'There are no leads matching the current filters.',
      });
      return;
    }

    const headers = ['Name', 'Email', 'Phone', 'Notes', 'Open House Address', 'Date Captured'];
    
    const escapeCsvCell = (cell: string | undefined | null) => {
        if (!cell) return '';
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const csvContent = [
      headers.join(','),
      ...filteredAndSortedLeads.map(lead => {
        const houseAddress = openHouses.get(lead.openHouseId)?.address || 'N/A';
        const dateCaptured = lead.createdAt ? format(lead.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A';
        const phoneFormatted = lead.phone ? formatPhoneNumber(lead.phone) : '';

        return [
          escapeCsvCell(lead.name),
          escapeCsvCell(lead.email),
          escapeCsvCell(phoneFormatted),
          escapeCsvCell(lead.notes),
          escapeCsvCell(houseAddress),
          escapeCsvCell(dateCaptured),
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'open-house-leads.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveContact = (lead: LeadType) => {
    const houseAddress = openHouses.get(lead.openHouseId)?.address;
    const dateCaptured = lead.createdAt ? format(lead.createdAt.toDate(), 'P') : 'N/A';
    
    let note = `Lead from RateMyOpenHouse.com`;
    if (houseAddress) {
        note += `\\nOpen House: ${houseAddress}`;
    }
    note += `\\nDate Captured: ${dateCaptured}`;
    if (lead.notes) {
        note += `\\n\\nNotes:\\n${lead.notes.replace(/\n/g, '\\n')}`;
    }

    const vCard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${lead.name}`,
      ...(lead.email ? [`EMAIL:${lead.email}`] : []),
      ...(lead.phone ? [`TEL;TYPE=CELL:${lead.phone}`] : []),
      `NOTE:${note}`,
      'END:VCARD'
    ].join('\n');

    const blob = new Blob([vCard], { type: 'text/vcard;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const sanitizedName = lead.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${sanitizedName}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="w-full mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">My Leads</h1>
          <p className="text-muted-foreground">A complete list of every lead from all your open houses.</p>
        </div>

        <Card>
          <CardHeader>
             <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex-1">
                    <CardTitle>All Leads ({filteredAndSortedLeads.length})</CardTitle>
                </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto md:flex-wrap md:justify-end">
                <Input
                  placeholder="Search by name, email, address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:w-auto"
                />
                <Select value={selectedHouseId} onValueChange={setSelectedHouseId}>
                    <SelectTrigger className="w-full sm:w-auto md:w-[200px]">
                        <SelectValue placeholder="Filter by open house" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Open Houses</SelectItem>
                        {Array.from(openHouses.values()).map(house => (
                            <SelectItem key={house.id} value={house.id}>
                                {house.address}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'newest' | 'oldest')}>
                  <SelectTrigger className="w-full sm:w-auto md:w-[150px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
                 <Button onClick={handleExportCSV} variant="outline" className="w-full sm:w-auto">
                    <Download className="mr-2"/>
                    Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-10">Loading all leads...</p>
            ) : filteredAndSortedLeads.length > 0 ? (
              <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                  {filteredAndSortedLeads.map((lead) => {
                       const house = openHouses.get(lead.openHouseId);
                       return (
                          <Card key={lead.id} className="relative">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                  {lead.name}
                              </CardTitle>
                              <CardDescription className="pt-1">
                                {house ? (
                                  <Link href={`/user/open-house/${house.id}`} className="hover:underline flex items-center gap-2">
                                    <Home className="w-4 h-4"/>
                                    {house.address}
                                  </Link>
                                ) : (
                                  <span className="text-muted-foreground">No associated house</span>
                                )}
                              </CardDescription>
                              <div className="absolute top-2 right-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                          <MoreHorizontal className="h-4 w-4" />
                                          <span className="sr-only">Lead Actions</span>
                                      </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleSaveContact(lead)}>
                                          <Contact className="mr-2 h-4 w-4" />
                                          <span>Save to Contacts</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => openEditLeadDialog(lead)}>
                                          <Edit className="mr-2 h-4 w-4" />
                                          <span>Edit</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                          onClick={() => openDeleteLeadDialog(lead.id)}
                                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                      >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          <span>Delete</span>
                                      </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {lead.email && (
                                  <a href={`mailto:${lead.email}`} className="block hover:underline">{lead.email}</a>
                                )}
                                {lead.phone && (
                                   <a href={`tel:${lead.phone}`} className="block hover:underline">{formatPhoneNumber(lead.phone)}</a>
                                )}
                                 {lead.notes && (
                                   <div className="flex items-start gap-2 pt-2 text-muted-foreground">
                                       <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                       <p className="text-sm text-foreground whitespace-pre-wrap">{lead.notes}</p>
                                   </div>
                                )}
                            </CardContent>
                             {lead.notes ? null : (
                                <CardFooter>
                                    <Button variant="outline" size="sm" className="w-full" onClick={() => openEditLeadDialog(lead)}>
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Add Note
                                    </Button>
                                </CardFooter>
                             )}
                          </Card>
                       )
                  })}
              </div>

              {/* Desktop Table View */}
              <div className="border rounded-lg hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Open House</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[50px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedLeads.map((lead) => {
                      const house = openHouses.get(lead.openHouseId);
                      return (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {lead.name}
                            </div>
                          </TableCell>
                           <TableCell>
                                {lead.email && (
                                    <a href={`mailto:${lead.email}`} className="hover:underline block">
                                        {lead.email}
                                    </a>
                                )}
                                {lead.phone && (
                                    <a href={`tel:${lead.phone}`} className="hover:underline block">
                                        {formatPhoneNumber(lead.phone)}
                                    </a>
                                )}
                                {(!lead.email && !lead.phone) && <span className="text-muted-foreground">-</span>}
                            </TableCell>
                          <TableCell>
                            {house ? (
                               <Link href={`/user/open-house/${house.id}`} className="hover:underline">
                                {house.address}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.notes ? (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="icon" aria-label="View Notes">
                                            <FileText className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Notes for {lead.name}</DialogTitle>
                                        </DialogHeader>
                                        <div className="py-4 whitespace-pre-wrap text-sm">
                                            {lead.notes}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            ) : (
                              <Button variant="ghost" size="icon" aria-label="Add Note" onClick={() => openEditLeadDialog(lead)}>
                                  <PlusCircle className="h-5 w-5 text-muted-foreground" />
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Lead Actions</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleSaveContact(lead)}>
                                        <Contact className="mr-2 h-4 w-4" />
                                        <span>Save to Contacts</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => openEditLeadDialog(lead)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => openDeleteLeadDialog(lead.id)}
                                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              </>
            ) : (
              <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-xl font-medium">No Leads Found</h3>
                <p className="mt-1 text-muted-foreground">
                  {searchTerm || selectedHouseId !== 'all' ? "Try a different filter or search term." : "Leads from your open houses will appear here."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

       {/* Edit Lead Dialog */}
      <Dialog open={isEditLeadDialogOpen} onOpenChange={(isOpen) => {
          setIsEditLeadDialogOpen(isOpen);
          if (!isOpen) {
              setLeadToEdit(null);
              leadEditForm.reset();
              setFormattedPhone("");
          }
      }}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <DialogTitle>Edit Lead</DialogTitle>
                  <DialogDescription>
                      Update the details for {leadToEdit?.name}.
                  </DialogDescription>
              </DialogHeader>
              <Form {...leadEditForm}>
                  <form onSubmit={leadEditForm.handleSubmit(onEditLeadSubmit)} className="space-y-4 py-4">
                      <FormField control={leadEditForm.control} name="name" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )}/>
                      <FormField control={leadEditForm.control} name="email" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )}/>
                      <FormField control={leadEditForm.control} name="phone" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Phone</FormLabel>
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
                      <FormField control={leadEditForm.control} name="notes" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Notes</FormLabel>
                              <FormControl><Textarea placeholder="E.g., interested in the kitchen, has a pre-approval..." {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )}/>
                      <DialogFooter>
                          <Button type="button" variant="ghost" onClick={() => setIsEditLeadDialogOpen(false)}>Cancel</Button>
                          <Button type="submit" disabled={leadEditForm.formState.isSubmitting}>
                              {leadEditForm.formState.isSubmitting ? "Saving..." : "Save Changes"}
                          </Button>
                      </DialogFooter>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteLeadAlertOpen} onOpenChange={setIsDeleteLeadAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete this lead.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setLeadToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteLead} className="bg-destructive hover:bg-destructive/90">
                    Yes, delete lead
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


export default function AllLeadsPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <AllLeadsPageContent />
    </React.Suspense>
  );
}
