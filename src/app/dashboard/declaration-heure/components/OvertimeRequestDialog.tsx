
"use client";

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { OvertimeRequest, OvertimeDayDetail, PrestationType } from '../types';
import { PRESTATION_TYPE_LABELS } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon as LucideCalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { timeToMinutes, calculateDurationInMinutes, minutesToDecimalHoursString } from '@/app/dashboard/time-tracking/utils';

const overtimeDetailSchema = z.object({
  id: z.string().optional(),
  date: z.date({ required_error: "Date requise." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:MM requis.").optional().or(z.literal('')),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:MM requis.").optional().or(z.literal('')),
});

const prestationTypesSchema = z.array(z.custom<PrestationType>()).optional().default([]);

const formSchema = z.object({
  reasonStub: z.string().min(5, "Veuillez fournir un bref motif (min. 5 caractères).").max(500, "Le motif ne peut excéder 500 caractères."),
  position: z.string().optional(),
  prestationTypes: prestationTypesSchema,
  prestationTypeAutresDetail: z.string().max(100, "Détail max 100 caractères.").optional(),
  overtimeDetails: z.array(overtimeDetailSchema).optional().default([]),
  totalOvertimeHours: z.string().max(50, "Total heures max 50 caractères.").optional(),
  employeeSignatureDate: z.date().optional().nullable(),
  directManagerSignatureDate: z.date().optional().nullable(),
  directorSignatureDate: z.date().optional().nullable(),
  approvalStatus: z.enum(['pending', 'accepted', 'rejected']).default('pending'),
  rejectionReason: z.string().max(500, "Motif refus max 500 caractères.").optional(),
  decisionDate: z.date().optional().nullable(),
}).refine(data => {
  if (data.prestationTypes?.includes('autres') && (!data.prestationTypeAutresDetail || data.prestationTypeAutresDetail.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: "Veuillez préciser le type de prestation pour 'Autres'.",
  path: ['prestationTypeAutresDetail'],
}).refine(data => {
  if (data.approvalStatus === 'rejected' && (!data.rejectionReason || data.rejectionReason.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: "Le motif de refus est requis si la demande est refusée.",
  path: ['rejectionReason'],
});

type FormDataType = z.infer<typeof formSchema>;

export interface OvertimeRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmitRequest: (data: Partial<Omit<OvertimeRequest, 'compensationType'>>) => void;
  editingRequest?: OvertimeRequest | null;
  currentUser?: { name: string; role: string } | null;
  isApproverView?: boolean; 
}

export default function OvertimeRequestDialog({
  isOpen,
  onOpenChange,
  onSubmitRequest,
  editingRequest,
  currentUser,
  isApproverView = false,
}: OvertimeRequestDialogProps) {
  const form = useForm<FormDataType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reasonStub: '',
      position: '',
      prestationTypes: [],
      prestationTypeAutresDetail: '',
      overtimeDetails: [],
      totalOvertimeHours: '0.00 heures',
      employeeSignatureDate: null,
      directManagerSignatureDate: null,
      directorSignatureDate: null,
      approvalStatus: 'pending',
      rejectionReason: '',
      decisionDate: null,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "overtimeDetails"
  });

  const overtimeDetailsWatched = useWatch({
    control: form.control,
    name: "overtimeDetails",
  });

  const approvalStatusWatched = useWatch({ control: form.control, name: "approvalStatus" });
  const prestationTypesWatched = useWatch({ control: form.control, name: "prestationTypes" });

  useEffect(() => {
    let totalMinutes = 0;
    if (overtimeDetailsWatched) {
      overtimeDetailsWatched.forEach(detail => {
        if (detail.startTime && detail.endTime) {
          totalMinutes += calculateDurationInMinutes(detail.startTime, detail.endTime);
        }
      });
    }
    form.setValue('totalOvertimeHours', minutesToDecimalHoursString(totalMinutes) + " heures");
  }, [overtimeDetailsWatched, form]);

  useEffect(() => {
    if (isOpen) {
      let initialPosition = '';
      if (editingRequest) {
        initialPosition = editingRequest.position || '';
      } else if (currentUser?.role) {
        initialPosition = currentUser.role;
      }

      let initialOvertimeDetails: any[] = [];
      if (editingRequest?.overtimeDetails && editingRequest.overtimeDetails.length > 0) {
        initialOvertimeDetails = editingRequest.overtimeDetails.map(detail => ({
          ...detail,
          id: detail.id || Math.random().toString(36).substring(2, 9),
          date: detail.date && isValid(parseISO(detail.date)) ? parseISO(detail.date) : new Date(),
          startTime: detail.startTime || '',
          endTime: detail.endTime || '',
        }));
      } else if (!editingRequest) {
        initialOvertimeDetails = [{ id: Math.random().toString(36).substring(2, 9), date: new Date(), startTime: '', endTime: '' }];
      }
      
      let empSigDate = editingRequest?.employeeSignatureDate ? parseISO(editingRequest.employeeSignatureDate) : null;
      let managerSigDate = editingRequest?.directManagerSignatureDate ? parseISO(editingRequest.directManagerSignatureDate) : null;
      let directorSigDate = editingRequest?.directorSignatureDate ? parseISO(editingRequest.directorSignatureDate) : null;
      let decDate = editingRequest?.decisionDate ? parseISO(editingRequest.decisionDate) : null;

      if (!editingRequest) { // New request
        empSigDate = new Date();
      } else { // Editing existing request
        if (!isApproverView && !empSigDate && (!editingRequest.employeeSignatureDate || !isValid(parseISO(editingRequest.employeeSignatureDate)))) {
             // Only fill if it's truly empty or invalid
            empSigDate = new Date();
        }
        if (isApproverView) {
            // For approver view, pre-fill decision date and their own signature dates if empty
            if (!decDate && editingRequest.approvalStatus && editingRequest.approvalStatus !== 'pending') decDate = new Date();
            if (!managerSigDate) managerSigDate = new Date();
            if (!directorSigDate) directorSigDate = new Date();
        }
      }

      form.reset({
        reasonStub: editingRequest?.reasonStub || '',
        position: initialPosition,
        prestationTypes: editingRequest?.prestationTypes || [],
        prestationTypeAutresDetail: editingRequest?.prestationTypeAutresDetail || '',
        overtimeDetails: initialOvertimeDetails,
        totalOvertimeHours: editingRequest?.totalOvertimeHours || '0.00 heures',
        employeeSignatureDate: empSigDate,
        directManagerSignatureDate: managerSigDate,
        directorSignatureDate: directorSigDate,
        approvalStatus: editingRequest?.approvalStatus || 'pending',
        rejectionReason: editingRequest?.rejectionReason || '',
        decisionDate: decDate,
      });
      
      // Recalculate total hours if editing
      if (editingRequest?.overtimeDetails) {
        let totalMinutes = 0;
        initialOvertimeDetails.forEach(detail => { 
          if (detail.startTime && detail.endTime) {
            totalMinutes += calculateDurationInMinutes(detail.startTime, detail.endTime);
          }
        });
        form.setValue('totalOvertimeHours', minutesToDecimalHoursString(totalMinutes) + " heures");
      }
    }
  }, [isOpen, editingRequest, currentUser, form, isApproverView]);

  useEffect(() => {
    if (isApproverView && (approvalStatusWatched === 'accepted' || approvalStatusWatched === 'rejected')) {
      if (!form.getValues('decisionDate')) {
        form.setValue('decisionDate', new Date());
      }
      // If the current user is "Chef", auto-fill their signature dates if empty
      if (currentUser?.name === 'Chef') {
        if (!form.getValues('directManagerSignatureDate')) {
          form.setValue('directManagerSignatureDate', new Date());
        }
        if (!form.getValues('directorSignatureDate')) {
          form.setValue('directorSignatureDate', new Date());
        }
      }
    }
  }, [approvalStatusWatched, isApproverView, form, currentUser]);


  const handleSubmit = (data: FormDataType) => {
    const submitData: Partial<Omit<OvertimeRequest, 'compensationType'>> = {
      ...data,
      employeeSignatureDate: data.employeeSignatureDate ? data.employeeSignatureDate.toISOString() : undefined,
      directManagerSignatureDate: data.directManagerSignatureDate ? data.directManagerSignatureDate.toISOString() : undefined,
      directorSignatureDate: data.directorSignatureDate ? data.directorSignatureDate.toISOString() : undefined,
      decisionDate: data.decisionDate ? data.decisionDate.toISOString() : undefined,
      overtimeDetails: data.overtimeDetails?.map(detail => ({
        id: detail.id || Math.random().toString(36).substring(2, 9), 
        date: format(detail.date, 'yyyy-MM-dd'),
        startTime: detail.startTime,
        endTime: detail.endTime,
      })),
    };
    onSubmitRequest(submitData);
    onOpenChange(false);
  };

  const renderDateField = (name: keyof FormDataType, label: string, disabled: boolean = false) => (
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
              <Calendar mode="single" selected={field.value as Date | undefined} onSelect={field.onChange} initialFocus locale={fr} disabled={disabled} />
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const employeeFieldsDisabled = isApproverView && !!editingRequest; 
  const directionFieldsDisabled = !isApproverView;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingRequest ? "Modifier la" : "Nouvelle"} Demande de Dépassement d'Horaire</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <ScrollArea className="h-[70vh] pr-5">
              <div className="space-y-4">
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
                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Poste occupé à l'IME</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ex: Éducateur spécialisé"
                              {...field}
                              value={field.value || ''}
                              disabled={employeeFieldsDisabled || (!editingRequest && !!currentUser?.role)}
                              className={ (employeeFieldsDisabled || (!editingRequest && !!currentUser?.role)) ? "bg-muted/50" : ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                
                <FormItem>
                  <FormLabel>Prestation correspondante</FormLabel>
                  <div className="space-y-2 rounded-md border p-3">
                    {(Object.keys(PRESTATION_TYPE_LABELS) as PrestationType[]).map((typeKey) => (
                      <FormField
                        key={typeKey}
                        control={form.control}
                        name="prestationTypes"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(typeKey)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), typeKey])
                                    : field.onChange(
                                        (field.value || []).filter(
                                          (value) => value !== typeKey
                                        )
                                      )
                                }}
                                disabled={employeeFieldsDisabled}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">{PRESTATION_TYPE_LABELS[typeKey]}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                    {prestationTypesWatched?.includes('autres') && (
                        <FormField
                            control={form.control}
                            name="prestationTypeAutresDetail"
                            render={({ field }) => (
                            <FormItem className="ml-7 mt-1">
                                <FormControl><Input placeholder="Précisez..." {...field} value={field.value || ''} className="h-8 text-sm" disabled={employeeFieldsDisabled} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    )}
                  </div>
                  {form.formState.errors.prestationTypeAutresDetail && <FormMessage>{form.formState.errors.prestationTypeAutresDetail.message}</FormMessage>}
                </FormItem>

                <FormField
                  control={form.control}
                  name="reasonStub"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motif de la demande</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Entrez le motif principal de votre demande..." {...field} rows={3} disabled={employeeFieldsDisabled}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormLabel>Détail des heures supplémentaires</FormLabel>
                  {fields.map((fieldItem, index) => (
                    <div key={fieldItem.id} className="flex items-end gap-2 p-2 border rounded-md mb-2">
                      <Controller
                        control={form.control}
                        name={`overtimeDetails.${index}.date`}
                        render={({ field: dateField, fieldState: dateFieldState }) => (
                          <FormItem className="flex-grow">
                            <FormLabel className="text-xs">Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn("w-full pl-3 text-left font-normal h-9", !dateField.value && "text-muted-foreground", dateFieldState.error && "border-destructive")}
                                    disabled={employeeFieldsDisabled}
                                  >
                                    {dateField.value ? format(dateField.value, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
                                    <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus locale={fr} disabled={employeeFieldsDisabled}/>
                              </PopoverContent>
                            </Popover>
                            <FormMessage className="text-xs"/>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`overtimeDetails.${index}.startTime`}
                        render={({ field: timeField }) => (
                          <FormItem className="w-28">
                            <FormLabel className="text-xs">Début</FormLabel>
                            <FormControl><Input type="time" {...timeField} value={timeField.value || ''} className="h-9" disabled={employeeFieldsDisabled}/></FormControl>
                            <FormMessage className="text-xs"/>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`overtimeDetails.${index}.endTime`}
                        render={({ field: timeField }) => (
                          <FormItem className="w-28">
                            <FormLabel className="text-xs">Fin</FormLabel>
                            <FormControl><Input type="time" {...timeField} value={timeField.value || ''} className="h-9" disabled={employeeFieldsDisabled}/></FormControl>
                            <FormMessage className="text-xs"/>
                          </FormItem>
                        )}
                      />
                      {!employeeFieldsDisabled && (
                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} className="h-9 w-9">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!employeeFieldsDisabled && (
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ id: Math.random().toString(36).substring(2, 9), date: new Date(), startTime: '', endTime: '' })} className="mt-2" >
                      <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une date/plage horaire
                    </Button>
                  )}
                </div>
                
                <FormField
                  control={form.control}
                  name="totalOvertimeHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total des heures en plus de l'horaire prévu</FormLabel>
                      <FormControl>
                        <Input placeholder="Calculé automatiquement" {...field} value={field.value || ''} disabled className="bg-muted/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                 <div className="space-y-2 border-t pt-3">
                    <h3 className="text-md font-semibold">Signatures</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {renderDateField('employeeSignatureDate', "Date signature Salarié(e)", employeeFieldsDisabled || (isApproverView && !!editingRequest?.employeeSignatureDate))}
                        {renderDateField('directManagerSignatureDate', "Date signature Responsable Direct", directionFieldsDisabled || !isApproverView)}
                        {renderDateField('directorSignatureDate', "Date signature Directeur", directionFieldsDisabled || !isApproverView)}
                    </div>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <h3 className="text-md font-semibold">Cadre réservé à la Direction</h3>
                  <FormField
                    control={form.control}
                    name="approvalStatus"
                    render={({ field }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel>Décision</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4" disabled={directionFieldsDisabled}>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="accepted" disabled={directionFieldsDisabled} /></FormControl><FormLabel className="font-normal text-sm">Acceptée</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="rejected" disabled={directionFieldsDisabled} /></FormControl><FormLabel className="font-normal text-sm">Refusée</FormLabel></FormItem>
                             <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="pending" disabled={directionFieldsDisabled} /></FormControl><FormLabel className="font-normal text-sm">En attente</FormLabel></FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {approvalStatusWatched === 'rejected' && (
                    <FormField control={form.control} name="rejectionReason" render={({ field }) => (
                      <FormItem><FormLabel>Si refusée, motif :</FormLabel><FormControl><Textarea placeholder="Motif du refus..." {...field} value={field.value || ''} rows={2} disabled={directionFieldsDisabled}/></FormControl><FormMessage /></FormItem>
                    )} />
                  )}
                  {renderDateField('decisionDate', "Date de la Décision", directionFieldsDisabled)}
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Annuler</Button>
              </DialogClose>
              <Button type="submit">{editingRequest ? "Enregistrer les Modifications" : "Soumettre la Demande"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    
