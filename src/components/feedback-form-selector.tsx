
"use client";

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FeedbackForm } from '@/lib/types';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PlusCircle } from 'lucide-react';

type FeedbackFormSelectorProps = {
  forms: FeedbackForm[];
  selectedFormId?: string | null;
  onFormSelect: (formId: string) => void;
  triggerClassName?: string;
};

export function FeedbackFormSelector({ forms, selectedFormId, onFormSelect, triggerClassName }: FeedbackFormSelectorProps) {
  const router = useRouter();
  
  const { globalForms, customForms } = useMemo(() => {
    const global: FeedbackForm[] = [];
    const custom: FeedbackForm[] = [];
    forms.forEach(form => {
      if (form.type === 'global') {
        global.push(form);
      } else {
        custom.push(form);
      }
    });
    return { globalForms: global, customForms: custom };
  }, [forms]);

  const selectedFormTitle = forms.find(f => f.id === selectedFormId)?.title;

  const handleValueChange = (value: string) => {
    if (value === 'create-new-form') {
      router.push('/user/feedback-forms');
    } else {
      onFormSelect(value);
    }
  };

  return (
    <Select value={selectedFormId || ''} onValueChange={handleValueChange}>
      <SelectTrigger className={cn("w-[280px]", triggerClassName)}>
        <SelectValue placeholder="Select a feedback form...">
          {selectedFormTitle || "Select a feedback form..."}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {globalForms.length > 0 && (
          <SelectGroup>
            <SelectLabel>Form Templates</SelectLabel>
            {globalForms.map(form => (
              <SelectItem key={form.id} value={form.id}>{form.title}</SelectItem>
            ))}
          </SelectGroup>
        )}
        
        {globalForms.length > 0 && customForms.length > 0 && <SelectSeparator />}

        {customForms.length > 0 && (
          <SelectGroup>
            <SelectLabel>My Custom Forms</SelectLabel>
            {customForms.map(form => (
              <SelectItem key={form.id} value={form.id}>{form.title}</SelectItem>
            ))}
          </SelectGroup>
        )}

        {(globalForms.length > 0 || customForms.length > 0) && <SelectSeparator />}

        <SelectGroup>
            <SelectItem value="create-new-form" className="text-primary focus:text-primary">
                <div className="flex items-center gap-2">
                    <PlusCircle className="h-4 w-4" />
                    <span>Create Custom Form</span>
                </div>
            </SelectItem>
        </SelectGroup>

        {forms.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
                No forms available.
            </div>
        )}
      </SelectContent>
    </Select>
  );
}
