
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/use-auth';
import { FeedbackForm, Question, QuestionOption } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { FileText, Copy, PlusCircle, Eye, Star, MoreHorizontal, Edit, Trash2, ArrowUp, ArrowDown, FilePenLine } from "lucide-react";
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';


const optionSchema = z.object({
  id: z.string(),
  value: z.string().min(1, "Option text cannot be empty"),
});

const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(3, "Question text must be at least 3 characters"),
  type: z.enum(['short-answer', 'yes-no', 'rating', 'multiple-choice']),
  options: z.array(optionSchema).optional(),
  isRequired: z.boolean().optional(),
});

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  questions: z.array(questionSchema).min(1, "You must add at least one question"),
});

const renameFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
});


export default function FeedbackFormsPage() {
  const { user, refreshUserData } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [allForms, setAllForms] = useState<FeedbackForm[]>([]);
  const [loading, setLoading] = useState(true);

  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [formToView, setFormToView] = useState<FeedbackForm | null>(null);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [formToEdit, setFormToEdit] = useState<FeedbackForm | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<string | null>(null);
  
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [formToRename, setFormToRename] = useState<FeedbackForm | null>(null);

  const fetchForms = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch global (system) forms
      const globalQuery = query(collection(db, 'feedbackForms'), where('type', '==', 'global'));
      
      // Fetch custom forms for the current user
      const customQuery = query(
        collection(db, 'feedbackForms'),
        where('type', '==', 'custom'),
        where('userId', '==', user.uid)
      );
      
      const [globalSnapshot, customSnapshot] = await Promise.all([
        getDocs(globalQuery),
        getDocs(customQuery),
      ]);

      const globalList = globalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackForm));
      const customList = customSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackForm));
      
      setAllForms([...customList, ...globalList]);

    } catch (error) {
      console.error("Error fetching forms:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not fetch feedback forms.",
      });
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    if(user) {
      fetchForms();
    }
  }, [user, fetchForms]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", questions: [] },
  });
  
  const renameForm = useForm<z.infer<typeof renameFormSchema>>({
    resolver: zodResolver(renameFormSchema),
    defaultValues: { title: "" },
  });

  const { fields, append, remove, update, move } = useFieldArray({
    control: form.control,
    name: "questions",
  });
  
  useEffect(() => {
    if (formToEdit) {
        form.reset({
            title: formToEdit.title,
            questions: formToEdit.questions.map(q => ({...q, isRequired: q.isRequired || false}))
        });
    } else {
        form.reset({ title: "", questions: [] });
    }
  }, [formToEdit, form]);

  const watchQuestions = form.watch('questions');

  const addQuestion = () => {
    append({ id: uuidv4(), text: '', type: 'short-answer', options: [], isRequired: false });
  };
  
  const addOption = (questionIndex: number) => {
    const question = form.getValues(`questions.${questionIndex}`);
    const newOptions = [...(question.options || []), { id: uuidv4(), value: "" }];
    update(questionIndex, { ...question, options: newOptions });
  };
  
  const removeOption = (questionIndex: number, optionIndex: number) => {
    const question = form.getValues(`questions.${questionIndex}`);
    const newOptions = question.options?.filter((_, i) => i !== optionIndex);
    update(questionIndex, { ...question, options: newOptions });
  };

  async function onFormSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;
    try {
      if (formToEdit) {
        // Update existing form
        const formDocRef = doc(db, "feedbackForms", formToEdit.id);
        await updateDoc(formDocRef, values);
      } else {
        // Create new form
        await addDoc(collection(db, "feedbackForms"), {
          ...values,
          type: 'custom',
          userId: user.uid,
          createdAt: Timestamp.now(),
        });
      }
      closeFormDialog();
      await fetchForms();
    } catch (error) {
      console.error("Error saving form:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not save the form." });
    }
  }
  
  async function onRenameSubmit(values: z.infer<typeof renameFormSchema>) {
    if (!formToRename) return;
    try {
        const formDocRef = doc(db, "feedbackForms", formToRename.id);
        await updateDoc(formDocRef, { title: values.title });
        closeRenameDialog();
        await fetchForms();
    } catch (error) {
        console.error("Error renaming form:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not rename the form." });
    }
  }

  const handleDeleteForm = async () => {
    if (!formToDelete) return;
    try {
        await deleteDoc(doc(db, "feedbackForms", formToDelete));
        await fetchForms();
    } catch (error) {
        console.error("Error deleting form:", error);
        toast({ variant: "destructive", title: "Delete Failed", description: "Could not delete the form." });
    } finally {
        setIsDeleteDialogOpen(false);
        setFormToDelete(null);
    }
  }

  const handleCopyForm = async (formToCopy: FeedbackForm) => {
    if (!user) return;
    try {
        const customForms = allForms.filter(f => f.type === 'custom');
        const newForm: Omit<FeedbackForm, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
            ...formToCopy,
            type: 'custom',
            userId: user.uid,
            createdAt: Timestamp.now(),
        };
        delete (newForm as Partial<FeedbackForm>).id; 
        delete (newForm as Partial<FeedbackForm>).description;
        
        const customFormTitles = new Set(customForms.map(f => f.title));
        let newTitle = `${formToCopy.title} (Copy)`;
        let copyCount = 2;
        while (customFormTitles.has(newTitle)) {
            newTitle = `${formToCopy.title} (Copy ${copyCount})`;
            copyCount++;
        }
        
        newForm.title = newTitle;
        
        newForm.questions = newForm.questions.map(q => ({
            ...q,
            id: uuidv4(),
            options: q.options ? q.options.map(o => ({...o, id: uuidv4()})) : []
        }));

        await addDoc(collection(db, 'feedbackForms'), newForm);
        await fetchForms();
    } catch (error) {
        console.error("Error copying form:", error);
        toast({
            variant: "destructive",
            title: "Copy Failed",
            description: "Could not copy the form.",
        });
    }
  };

  const handleSetDefault = async (formId: string) => {
    if (!user) return;
    try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { defaultFormId: formId });
        await refreshUserData();
        toast({
            title: "Default Form Set",
            description: "New open houses will use this form by default."
        });
    } catch (error) {
        console.error("Error setting default form:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not set default form." });
    }
  };

  const openViewDialog = (form: FeedbackForm) => {
    setFormToView(form);
    setIsViewDialogOpen(true);
  };
  
  const openFormDialog = (form?: FeedbackForm) => {
      setFormToEdit(form || null);
      setIsFormDialogOpen(true);
  }
  
  const openRenameDialog = (form: FeedbackForm) => {
    setFormToRename(form);
    renameForm.reset({ title: form.title });
    setIsRenameDialogOpen(true);
  };

  const closeFormDialog = () => {
      setIsFormDialogOpen(false);
      setFormToEdit(null);
      form.reset();
  }
  
  const closeRenameDialog = () => {
      setIsRenameDialogOpen(false);
      setFormToRename(null);
      renameForm.reset();
  };

  const openDeleteDialog = (id: string) => {
    setFormToDelete(id);
    setIsDeleteDialogOpen(true);
  }
  
  const renderQuestionPreview = (question: Question) => {
    switch (question.type) {
        case 'short-answer':
            return <p className="text-sm text-muted-foreground italic">Short text answer...</p>;
        case 'yes-no':
            return <div className="flex gap-2"><Badge variant="outline">Yes</Badge><Badge variant="outline">No</Badge></div>;
        case 'rating':
            return <div className="flex gap-1 items-center">{[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 text-muted-foreground/50"/>)}</div>;
        case 'multiple-choice':
            return (
                <div className="flex flex-wrap gap-2">
                    {question.options?.map(opt => <Badge key={opt.id} variant="secondary">{opt.value}</Badge>)}
                </div>
            );
        default:
            return null;
    }
  };

  return (
    <>
    <div className="w-full mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-grow">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Feedback Forms</h1>
                <p className="text-muted-foreground">
                Create, manage, and assign feedback forms for your open houses.
                </p>
            </div>
            <Button onClick={() => openFormDialog()} className="w-full sm:w-auto">
                <PlusCircle className="mr-2"/> Create New Form
            </Button>
      </div>

       <Card>
            <CardHeader>
                <CardTitle>All Forms</CardTitle>
                <CardDescription>
                    Manage your custom forms and copy templates from the system library.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <p>Loading your forms...</p>
                ): allForms.length > 0 ? (
                    <div className="border rounded-lg overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="hidden sm:table-cell">Questions</TableHead>
                                    <TableHead className="hidden md:table-cell">Created</TableHead>
                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allForms.map(form => (
                                    <TableRow key={form.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <span>{form.title}</span>
                                                {user?.defaultFormId === form.id && (
                                                    <Badge variant="secondary">Default</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {form.type === 'custom' ? (
                                                <Badge variant="outline">Custom</Badge>
                                            ) : (
                                                <Badge>System</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">{form.questions.length}</TableCell>
                                        <TableCell className="hidden md:table-cell">
                                                {form.createdAt ? format(form.createdAt.toDate(), 'MMM d, yyyy') : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Form Actions</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openViewDialog(form)}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        <span>View</span>
                                                    </DropdownMenuItem>
                                                    {form.type === 'custom' ? (
                                                      <>
                                                        <DropdownMenuItem onClick={() => handleSetDefault(form.id)} disabled={user?.defaultFormId === form.id}>
                                                            <Star className="mr-2 h-4 w-4" />
                                                            <span>Make Default</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => openFormDialog(form)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            <span>Edit</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openRenameDialog(form)}>
                                                            <FilePenLine className="mr-2 h-4 w-4" />
                                                            <span>Rename</span>
                                                        </DropdownMenuItem>
                                                         <DropdownMenuItem onClick={() => handleCopyForm(form)}>
                                                            <Copy className="mr-2 h-4 w-4" />
                                                            <span>Duplicate</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => openDeleteDialog(form.id)} className="text-destructive focus:text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            <span>Delete</span>
                                                        </DropdownMenuItem>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleCopyForm(form)}>
                                                            <Copy className="mr-2 h-4 w-4" />
                                                            <span>Copy to My Forms</span>
                                                        </DropdownMenuItem>
                                                      </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="text-center py-16 border-2 border-dashed rounded-lg">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="text-xl font-medium mt-4">No Forms Found</h3>
                        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                            You haven't created any forms yet. Create one from scratch or copy a system template.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
    
    <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formToView?.title}</DialogTitle>
          <DialogDescription>{formToView?.description || 'A preview of the form questions.'}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-1 space-y-6">
            {formToView?.questions.map((q, index) => (
                <div key={q.id}>
                    <p className="font-medium">{index + 1}. {q.text}</p>
                    <div className="mt-2 pl-6">
                        {renderQuestionPreview(q)}
                    </div>
                </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>

    {/* Form Dialog */}
    <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => !isOpen && closeFormDialog()}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>{formToEdit ? 'Edit Form' : 'Create Custom Form'}</DialogTitle>
                <DialogDescription>
                  {formToEdit ? 'Modify the details of your custom form.' : 'Design a new feedback form from scratch.'}
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onFormSubmit)}>
                    <div className="space-y-6 p-1 max-h-[60vh] overflow-y-auto">
                      <FormField control={form.control} name="title" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Form Title</FormLabel>
                              <FormControl><Input placeholder="e.g., My Awesome Feedback Form" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )}/>
                      <Separator />
                      <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium">Questions</h3>
                        </div>
                        <div className="space-y-4">
                          {fields.map((field, index) => (
                            <Card key={field.id} className="p-4 bg-muted/50 relative transition-all">
                              <div className="flex justify-between items-start gap-4">
                                <div className="flex-grow space-y-4">
                                  <FormField control={form.control} name={`questions.${index}.text`} render={({ field }) => (
                                      <FormItem>
                                          <FormLabel>Question {index + 1}</FormLabel>
                                          <FormControl><Textarea placeholder="What would you like to ask?" {...field} /></FormControl>
                                          <FormMessage />
                                      </FormItem>
                                  )}/>
                                   <div className="flex items-end gap-4">
                                        <FormField control={form.control} name={`questions.${index}.type`} render={({ field }) => (
                                            <FormItem className="flex-grow">
                                                <FormLabel>Question Type</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a question type" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="short-answer">Short Answer</SelectItem>
                                                        <SelectItem value="yes-no">Yes/No</SelectItem>
                                                        <SelectItem value="rating">1-5 Rating</SelectItem>
                                                        <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}/>
                                        <FormField control={form.control} name={`questions.${index}.isRequired`} render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-2 pb-2">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormLabel className="!mt-0">Required</FormLabel>
                                            </FormItem>
                                        )}/>
                                   </div>
                                  {watchQuestions[index]?.type === 'multiple-choice' && (
                                    <div className="space-y-3 pl-4 border-l-2 ml-2">
                                      <FormLabel>Options</FormLabel>
                                      {watchQuestions[index].options?.map((option, optionIndex) => (
                                        <div key={option.id} className="flex items-center gap-2">
                                           <FormField control={form.control} name={`questions.${index}.options.${optionIndex}.value`} render={({ field }) => (
                                              <FormItem className="flex-grow">
                                                  <FormControl><Input placeholder={`Option ${optionIndex + 1}`} {...field} /></FormControl>
                                                   <FormMessage />
                                              </FormItem>
                                          )}/>
                                          <Button variant="ghost" size="icon" onClick={() => removeOption(index, optionIndex)} type="button">
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                          </Button>
                                        </div>
                                      ))}
                                      <Button size="sm" variant="outline" type="button" onClick={() => addOption(index)}>
                                        <PlusCircle className="mr-2" /> Add Option
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                 <div className="absolute top-2 right-2 flex flex-col gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => move(index, index - 1)} disabled={index === 0} type="button" aria-label="Move up">
                                      <ArrowUp className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => move(index, index + 1)} disabled={index === fields.length - 1} type="button" aria-label="Move down">
                                      <ArrowDown className="w-4 h-4" />
                                    </Button>
                                     <Button variant="ghost" size="icon" onClick={() => remove(index)} type="button" aria-label="Delete question" className="text-destructive hover:text-destructive">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                        <FormMessage>{form.formState.errors.questions?.message}</FormMessage>
                        <div className="mt-4">
                            <Button size="sm" variant="secondary" onClick={addQuestion} type="button">
                                <PlusCircle className="mr-2" /> Add Question
                            </Button>
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="mt-6 pt-4 border-t">
                        <Button type="button" variant="ghost" onClick={closeFormDialog}>Cancel</Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "Saving..." : "Save Form"}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    {/* Rename Dialog */}
    <Dialog open={isRenameDialogOpen} onOpenChange={(isOpen) => !isOpen && closeRenameDialog()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename Form</DialogTitle>
          <DialogDescription>
            Enter a new title for your form '{formToRename?.title}'.
          </DialogDescription>
        </DialogHeader>
        <Form {...renameForm}>
          <form onSubmit={renameForm.handleSubmit(onRenameSubmit)} className="space-y-4 py-4">
            <FormField
              control={renameForm.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter a new title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeRenameDialog}>Cancel</Button>
              <Button type="submit" disabled={renameForm.formState.isSubmitting}>
                {renameForm.formState.isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    
    {/* Delete Confirmation Dialog */}
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this custom form.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setFormToDelete(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteForm} className="bg-destructive hover:bg-destructive/90">
            Yes, delete form
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

    