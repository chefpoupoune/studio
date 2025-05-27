
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { AbsenceRequest } from '../types'; 
import { cn } from '@/lib/utils';
import { format, parseISO, isValid, differenceInCalendarDays, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon as LucideCalendarIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const absenceFormSchema = z.object({
  hoursPerDay: z.coerce.number().min(0.25, "Minimum 0.25 heures.").max(12, "Maximum 12 heures.").optional().nullable(),
  startDate: z.date({ required_error: "Date de début requise." }),
  endDate: z.date({ required_error: "Date de fin requise." }),
  reason: z.string().max(500, "Motif max 500 caractères.").optional(),
  position: z.string().optional(), 

  // Signatures
  employeeSignatureDate: z.date().optional().nullable(),
  directManagerSignatureDate: z.date().optional().nullable(),
  directorSignatureDate: z.date().optional().nullable(),
  
  // Approval section
  approvalStatus: z.enum(['pending', 'accepted', 'rejected']).default('pending'),
  rejectionReason: z.string().max(500, "Motif refus max 500 caractères.").optional(),
  decisionDate: z.date().optional().nullable(),
})
.refine(data => data.endDate >= data.startDate, {
    message: "La date de fin ne peut être antérieure à la date de début.",
    path: ['endDate'],
}).refine(data => {
  if (data.approvalStatus === 'rejected' && (!data.rejectionReason || data.rejectionReason.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: "Le motif de refus est requis si la demande est refusée.",
  path: ['rejectionReason'],
});

type AbsenceFormData = z.infer<typeof absenceFormSchema>;

export interface AbsenceRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmitRequest: (data: Partial<Omit<AbsenceRequest, 'id' | 'employeeName' | 'requestDate' | 'updatedAt'>>) => void;
  editingRequest?: AbsenceRequest | null;
  currentUser?: { name: string; role: string } | null;
  isApproverView?: boolean;
}

export default function AbsenceRequestDialog({
  isOpen,
  onOpenChange,
  onSubmitRequest,
  editingRequest,
  currentUser,
  isApproverView = false,
}: AbsenceRequestDialogProps) {
  
  const form = useForm<AbsenceFormData>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: {
      hoursPerDay: undefined,
      startDate: new Date(),
      endDate: addDays(new Date(),0), 
      reason: '',
      position: '',
      employeeSignatureDate: null,
      directManagerSignatureDate: null,
      directorSignatureDate: null,
      approvalStatus: 'pending',
      rejectionReason: '',
      decisionDate: null,
    },
  });

  const approvalStatusWatched = useWatch({ control: form.control, name: "approvalStatus" });
  const formStartDate = form.watch('startDate');
  const formEndDate = form.watch('endDate');
  const formHoursPerDay = form.watch('hoursPerDay');

  const [displayedNumberOfDays, setDisplayedNumberOfDays] = useState<string>('1 jour(s)');
  const [displayedTotalAbsenceHours, setDisplayedTotalAbsenceHours] = useState<string>('0.0 heures');

  useEffect(() => {
    let days = 1;
    if (formStartDate && isValid(formStartDate)) {
      if (formEndDate && isValid(formEndDate) && formEndDate >= formStartDate) {
        days = differenceInCalendarDays(formEndDate, formStartDate) + 1;
        setDisplayedNumberOfDays(`${days} jour(s)`);
      } else {
        setDisplayedNumberOfDays('1 jour(s)');
      }
    } else {
      setDisplayedNumberOfDays('N/A');
      days = 0; // Cannot calculate total hours if days are N/A
    }

    const hpd = form.getValues('hoursPerDay'); // Get current value directly
    if (days > 0 && hpd && hpd > 0) {
        setDisplayedTotalAbsenceHours(`${(days * hpd).toFixed(1)} heures`);
    } else if (days > 0 && !hpd) {
        setDisplayedTotalAbsenceHours('Préciser h/jour');
    }
     else {
        setDisplayedTotalAbsenceHours('0.0 heures');
    }
  }, [formStartDate, formEndDate, formHoursPerDay, form]);


  const isFormLockedForEmployee = useMemo(() => {
    return !isApproverView && editingRequest && (editingRequest.approvalStatus === 'accepted' || editingRequest.approvalStatus === 'rejected');
  }, [isApproverView, editingRequest]);

  const employeeFieldsActuallyDisabled = useMemo(() => {
    return (isApproverView && !!editingRequest) || isFormLockedForEmployee;
  }, [isApproverView, editingRequest, isFormLockedForEmployee]);
  
  const directionFieldsActuallyDisabled = useMemo(() => {
    return !isApproverView;
  }, [isApproverView]);

  useEffect(() => {
    if (isOpen) {
      let initialPosition = editingRequest?.position || '';
      if (!editingRequest && currentUser?.role) {
        initialPosition = currentUser.role;
      }

      let empSigDate = editingRequest?.employeeSignatureDate && isValid(parseISO(editingRequest.employeeSignatureDate)) ? parseISO(editingRequest.employeeSignatureDate) : null;
      let managerSigDate = editingRequest?.directManagerSignatureDate && isValid(parseISO(editingRequest.directManagerSignatureDate)) ? parseISO(editingRequest.directManagerSignatureDate) : null;
      let directorSigDate = editingRequest?.directorSignatureDate && isValid(parseISO(editingRequest.directorSignatureDate)) ? parseISO(editingRequest.directorSignatureDate) : null;
      let decDate = editingRequest?.decisionDate && isValid(parseISO(editingRequest.decisionDate)) ? parseISO(editingRequest.decisionDate) : null;
      
      const defaultStartDate = new Date();
      const defaultEndDate = addDays(new Date(), 0);

      if (!editingRequest) { 
        empSigDate = new Date();
      } else { 
          if (!isApproverView && !empSigDate) {
              empSigDate = new Date();
          }
      }
       // Auto-fill approver dates logic (moved to its own effect)

      form.reset({
        hoursPerDay: editingRequest?.hoursPerDay ?? undefined,
        startDate: editingRequest?.startDate && isValid(parseISO(editingRequest.startDate)) ? parseISO(editingRequest.startDate) : defaultStartDate,
        endDate: editingRequest?.endDate && isValid(parseISO(editingRequest.endDate)) ? parseISO(editingRequest.endDate) : defaultEndDate,
        reason: editingRequest?.reason || '',
        position: initialPosition,
        employeeSignatureDate: empSigDate,
        directManagerSignatureDate: managerSigDate,
        directorSignatureDate: directorSigDate,
        approvalStatus: editingRequest?.approvalStatus || 'pending',
        rejectionReason: editingRequest?.rejectionReason || '',
        decisionDate: decDate,
      });
    }
  }, [isOpen, editingRequest, currentUser, form, isApproverView]);

  useEffect(() => {
    if (isOpen && isApproverView && (approvalStatusWatched === 'accepted' || approvalStatusWatched === 'rejected')) {
      if (!form.getValues('decisionDate')) {
        form.setValue('decisionDate', new Date());
      }
      if (currentUser?.name?.toLowerCase() === 'chef') {
        if (!form.getValues('directManagerSignatureDate')) form.setValue('directManagerSignatureDate', new Date());
        if (!form.getValues('directorSignatureDate')) form.setValue('directorSignatureDate', new Date());
      }
    }
  }, [approvalStatusWatched, isApproverView, currentUser, form, isOpen]);


  const handleSubmit = (data: AbsenceFormData) => {
    let calculatedNumberOfDays = 1;
    if (data.startDate && data.endDate && isValid(data.startDate) && isValid(data.endDate) && data.endDate >= data.startDate) {
        calculatedNumberOfDays = differenceInCalendarDays(data.endDate, data.startDate) + 1;
    }

    let calculatedTotalAbsenceHours = 0;
    if (calculatedNumberOfDays > 0 && data.hoursPerDay && data.hoursPerDay > 0) {
        calculatedTotalAbsenceHours = calculatedNumberOfDays * data.hoursPerDay;
    }
    
    const submitData: Partial<Omit<AbsenceRequest, 'id' | 'employeeName' | 'requestDate' | 'updatedAt'>> = {
        ...data,
        startDate: format(data.startDate, 'yyyy-MM-dd'),
        endDate: format(data.endDate, 'yyyy-MM-dd'),
        numberOfDays: calculatedNumberOfDays,
        hoursPerDay: data.hoursPerDay ?? undefined, 
        totalAbsenceHours: calculatedTotalAbsenceHours,
        employeeSignatureDate: data.employeeSignatureDate ? data.employeeSignatureDate.toISOString() : null,
        directManagerSignatureDate: data.directManagerSignatureDate ? data.directManagerSignatureDate.toISOString() : null,
        directorSignatureDate: data.directorSignatureDate ? data.directorSignatureDate.toISOString() : null,
        decisionDate: data.decisionDate ? data.decisionDate.toISOString() : null,
    };
    onSubmitRequest(submitData);
    onOpenChange(false);
  };

  const renderDateField = (name: keyof AbsenceFormData, label: string, disabled: boolean = false) => (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>{label}</FormLabel>
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant={"outline"}
                  className={cn("w-full pl-3 text-left font-normal h-9", !field.value && "text-muted-foreground")}
                  disabled={disabled}
                >
                  {field.value ? format(field.value as Date, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
                  <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={field.value as Date | undefined} onSelect={field.onChange} initialFocus locale={fr} disabled={disabled}/>
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingRequest ? "Modifier la" : "Nouvelle"} Demande d'Absence</DialogTitle>
          <DialogDescription>
            {currentUser?.name && `Demandeur: ${currentUser.name}`}
            {editingRequest?.employeeName && !currentUser?.name && `Demandeur: ${editingRequest.employeeName}`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <ScrollArea className="h-[65vh] pr-5">
              <div className="space-y-4">
                {isFormLockedForEmployee && (
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-800/30 border border-yellow-300 dark:border-yellow-700 rounded-md text-sm text-yellow-700 dark:text-yellow-200">
                    Cette demande a été traitée par la direction et ne peut plus être modifiée.
                  </div>
                )}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormItem>
                        <FormLabel>Nom et prénom du salarié</FormLabel>
                        <FormControl>
                            <Input 
                            value={editingRequest?.employeeName || currentUser?.name || "Non identifié"} 
                            disabled 
                            className="bg-muted/50" />
                        </FormControl>
                    </FormItem>
                    <FormField control={form.control} name="position" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Poste occupé à l'IME</FormLabel>
                          <FormControl><Input placeholder="Ex: Éducateur spécialisé" {...field} value={field.value || ''} 
                           disabled={employeeFieldsActuallyDisabled || (!editingRequest && !!currentUser?.role)} 
                           className={(employeeFieldsActuallyDisabled || (!editingRequest && !!currentUser?.role)) ? "bg-muted/50" : ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderDateField("startDate", "Date de Début", employeeFieldsActuallyDisabled)}
                    {renderDateField("endDate", "Date de Fin", employeeFieldsActuallyDisabled)}
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <FormItem className="sm:col-span-1">
                        <FormLabel>Nombre de jours</FormLabel>
                        <Input 
                            value={displayedNumberOfDays} 
                            disabled 
                            className="bg-muted/50" 
                        />
                    </FormItem>
                    <FormField control={form.control} name="hoursPerDay" render={({ field }) => (
                        <FormItem className="sm:col-span-1">
                            <FormLabel>Heures/jour</FormLabel>
                            <FormControl><Input type="number" step="0.25" placeholder="Ex: 7.5" {...field} value={field.value ?? ''} disabled={employeeFieldsActuallyDisabled} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormItem className="sm:col-span-1">
                        <FormLabel>Total Heures Absence</FormLabel>
                        <Input 
                            value={displayedTotalAbsenceHours} 
                            disabled 
                            className="bg-muted/50" 
                        />
                    </FormItem>
                </div>


                <FormField control={form.control} name="reason" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motif (Optionnel)</FormLabel>
                      <FormControl><Textarea placeholder="Entrez le motif de votre demande d'absence..." {...field} value={field.value || ''} rows={3} disabled={employeeFieldsActuallyDisabled}/></FormControl>
                      <FormMessage />
                    </FormItem>
                )} />
                
                <div className="space-y-2 border-t pt-3">
                    <h3 className="text-md font-semibold">Signatures</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {renderDateField('employeeSignatureDate', "Date signature Salarié(e)", employeeFieldsActuallyDisabled || (isApproverView && !!editingRequest?.employeeSignatureDate))}
                        {renderDateField('directManagerSignatureDate', "Date signature Responsable Direct", directionFieldsActuallyDisabled)}
                        {renderDateField('directorSignatureDate', "Date signature Directeur", directionFieldsActuallyDisabled)}
                    </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <h3 className="text-md font-semibold">Cadre réservé à la Direction</h3>
                  <FormField control={form.control} name="approvalStatus" render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel>Décision</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4" disabled={directionFieldsActuallyDisabled}>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="accepted" /></FormControl><FormLabel className="font-normal text-sm">Acceptée</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="rejected" /></FormControl><FormLabel className="font-normal text-sm">Refusée</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="pending" /></FormControl><FormLabel className="font-normal text-sm">En attente</FormLabel></FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                  )} />
                  {approvalStatusWatched === 'rejected' && (
                    <FormField control={form.control} name="rejectionReason" render={({ field }) => (
                      <FormItem><FormLabel>Si refusée, motif :</FormLabel><FormControl><Textarea placeholder="Motif du refus..." {...field} value={field.value || ''} rows={2} disabled={directionFieldsActuallyDisabled}/></FormControl><FormMessage /></FormItem>
                    )} />
                  )}
                  {renderDateField('decisionDate', "Date de la Décision", directionFieldsActuallyDisabled)}
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
              {!isFormLockedForEmployee && (
                <Button type="submit">
                  {editingRequest ? "Enregistrer les Modifications" : "Soumettre Demande"}
                </Button>
              )}
              {isFormLockedForEmployee && (
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
