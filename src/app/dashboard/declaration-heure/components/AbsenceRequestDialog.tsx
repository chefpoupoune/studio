
"use client";

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { AbsenceRequest, AbsenceType } from '../types';
import { ABSENCE_TYPES, ABSENCE_TYPE_LABELS } from '../types';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid, differenceInCalendarDays, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon as LucideCalendarIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';


const absenceFormSchema = z.object({
  absenceType: z.custom<AbsenceType>((val) => ABSENCE_TYPES.includes(val as AbsenceType), "Type d'absence invalide."),
  absenceTypeAutresDetail: z.string().max(100, "Détail max 100 caractères.").optional(),
  startDate: z.date({ required_error: "Date de début requise." }),
  endDate: z.date({ required_error: "Date de fin requise." }),
  reason: z.string().max(500, "Motif max 500 caractères.").optional(),
}).refine(data => {
    if (data.absenceType === 'Autre' && (!data.absenceTypeAutresDetail || data.absenceTypeAutresDetail.trim() === '')) {
        return false;
    }
    return true;
}, {
    message: "Veuillez préciser le type d'absence pour 'Autre'.",
    path: ['absenceTypeAutresDetail'],
}).refine(data => data.endDate >= data.startDate, {
    message: "La date de fin ne peut être antérieure à la date de début.",
    path: ['endDate'],
});

type AbsenceFormData = z.infer<typeof absenceFormSchema>;

export interface AbsenceRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmitRequest: (data: Partial<Omit<AbsenceRequest, 'id' | 'employeeName' | 'requestDate' | 'updatedAt' | 'status' | 'position'>>) => void;
  editingRequest?: AbsenceRequest | null;
  currentUser?: { name: string; role: string } | null;
  // isApproverView?: boolean; // For future approval logic
}

export default function AbsenceRequestDialog({
  isOpen,
  onOpenChange,
  onSubmitRequest,
  editingRequest,
  currentUser,
  // isApproverView = false, // For future
}: AbsenceRequestDialogProps) {
  
  const form = useForm<AbsenceFormData>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: {
      absenceType: 'CP',
      absenceTypeAutresDetail: '',
      startDate: new Date(),
      endDate: addDays(new Date(),1), // Default to one day after start
      reason: '',
    },
  });

  const absenceTypeWatched = form.watch('absenceType');

  useEffect(() => {
    if (isOpen) {
      if (editingRequest) {
        form.reset({
          absenceType: editingRequest.absenceType,
          absenceTypeAutresDetail: editingRequest.absenceTypeAutresDetail || '',
          startDate: editingRequest.startDate ? parseISO(editingRequest.startDate) : new Date(),
          endDate: editingRequest.endDate ? parseISO(editingRequest.endDate) : addDays(new Date(),1),
          reason: editingRequest.reason || '',
        });
      } else {
        form.reset({
          absenceType: 'CP',
          absenceTypeAutresDetail: '',
          startDate: new Date(),
          endDate: addDays(new Date(),1),
          reason: '',
        });
      }
    }
  }, [isOpen, editingRequest, form]);

  const handleSubmit = (data: AbsenceFormData) => {
    const daysDifference = differenceInCalendarDays(data.endDate, data.startDate) + 1;
    
    const submitData: Partial<Omit<AbsenceRequest, 'id' | 'employeeName' | 'requestDate' | 'updatedAt' | 'status' | 'position'>> = {
        ...data,
        startDate: format(data.startDate, 'yyyy-MM-dd'),
        endDate: format(data.endDate, 'yyyy-MM-dd'),
        numberOfDays: daysDifference > 0 ? daysDifference : 1, // Ensure at least 1 day
    };
    onSubmitRequest(submitData);
    onOpenChange(false);
  };

  const renderDateField = (name: "startDate" | "endDate", label: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>{label}</FormLabel>
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant={"outline"}
                  className={cn("w-full pl-3 text-left font-normal h-9", !field.value && "text-muted-foreground")}
                >
                  {field.value ? format(field.value as Date, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
                  <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={field.value as Date | undefined} onSelect={field.onChange} initialFocus locale={fr} />
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingRequest ? "Modifier la" : "Nouvelle"} Demande d'Absence</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <ScrollArea className="h-[60vh] pr-5">
              <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="absenceType"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Type d'Absence</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Choisir un type..." /></SelectTrigger></FormControl>
                            <SelectContent>
                            {ABSENCE_TYPES.map(type => (
                                <SelectItem key={type} value={type}>{ABSENCE_TYPE_LABELS[type]}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                {absenceTypeWatched === 'Autre' && (
                    <FormField control={form.control} name="absenceTypeAutresDetail" render={({ field }) => (
                        <FormItem><FormLabel>Préciser "Autre"</FormLabel><FormControl><Input placeholder="Précisez le type d'absence..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderDateField("startDate", "Date de Début")}
                    {renderDateField("endDate", "Date de Fin")}
                </div>

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motif (Optionnel)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Entrez le motif de votre demande d'absence..." {...field} value={field.value || ''} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 {/* Future: Calculate and display number of days */}
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
              <Button type="submit">{editingRequest ? "Enregistrer Modifications" : "Soumettre Demande"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
