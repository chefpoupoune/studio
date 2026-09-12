"use client";

import React, { useEffect, useMemo } from 'react';
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
import type { ScheduleChangeRequest, ScheduleChangeDayDetail, PrestationType } from '../types';
import { PRESTATION_TYPE_LABELS } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon as LucideCalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { timeToMinutes, calculateDurationInMinutes, minutesToDecimalHoursString } from '@/app/dashboard/time-tracking/utils';

const scheduleChangeDetailSchema = z.object({
  id: z.string().optional(),
  date: z.date({ required_error: "Date requise." }),
 newStartTime: z.union([z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:MM requis."), z.literal(''), z.null(), z.undefined()]).optional(),
 newEndTime: z.union([z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:MM requis."), z.literal(''), z.null(), z.undefined()]).optional(),
 originalStartTime: z.union([z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:MM requis."), z.literal(''), z.null(), z.undefined()]).optional(),
 originalEndTime: z.union([z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:MM requis."), z.literal(''), z.null(), z.undefined()]).optional(),
});

const prestationTypesSchema = z.array(z.custom<PrestationType>()).optional().default([]);

const formSchema = z.object({
  reasonStub: z.string().min(5, "Veuillez fournir un bref motif (min. 5 caractères).").max(500, "Le motif ne peut excéder 500 caractères."),
  position: z.string().optional(),
  prestationTypes: prestationTypesSchema,
  prestationTypeAutresDetail: z.string().max(100, "Détail max 100 caractères.").optional(),
  scheduleChangeDetails: z.array(scheduleChangeDetailSchema).optional().default([]),
  totalScheduleChangeHours: z.string().max(50, "Total heures max 50 caractères.").optional(),

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

export interface ScheduleChangeRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmitRequest: (data: Partial<ScheduleChangeRequest>) => void;
  editingRequest?: ScheduleChangeRequest | null;
  currentUser?: { name: string; role: string } | null;
  isApproverView?: boolean;
}

export default function ScheduleChangeRequestDialog({
  isOpen,
  onOpenChange,
  onSubmitRequest,
  editingRequest,
  currentUser,
  isApproverView = false,
}: ScheduleChangeRequestDialogProps) {
  const form = useForm<FormDataType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reasonStub: '',
      position: '',
      prestationTypes: ['logistique'], // Default to logistique
      prestationTypeAutresDetail: '',
      scheduleChangeDetails: [],
      totalScheduleChangeHours: '0.00 heures',
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
    name: "scheduleChangeDetails"
  });

  const scheduleChangeDetailsWatched = useWatch({
    control: form.control,
    name: "scheduleChangeDetails",
  });

  const approvalStatusWatched = useWatch({ control: form.control, name: "approvalStatus" });
  const prestationTypesWatched = useWatch({ control: form.control, name: "prestationTypes" });
  const isChefCreating = useMemo(() => !editingRequest && currentUser?.name?.toLowerCase() === 'chef', [editingRequest, currentUser]);

  const isFormLockedForEmployee = useMemo(() => {
    return !isApproverView && editingRequest && (editingRequest.approvalStatus === 'accepted' || editingRequest.approvalStatus === 'rejected');
  }, [isApproverView, editingRequest]);

  const employeeFieldsActuallyDisabled = useMemo(() => {
    if (isChefCreating) return false;
    return (isApproverView && !!editingRequest) || isFormLockedForEmployee;
  }, [isApproverView, editingRequest, isFormLockedForEmployee, isChefCreating]);

  const directionFieldsActuallyDisabled = useMemo(() => {
    if (isChefCreating) return false;
    return !isApproverView;
  }, [isApproverView, isChefCreating]);


  useEffect(() => {
    // This effect might need adjustment depending on how "total hours" are represented for a schedule change.
    // For now, we will calculate the total *difference* in hours, which might be negative.
    let totalMinutesDifference = 0;
    if (scheduleChangeDetailsWatched) {
      scheduleChangeDetailsWatched.forEach(detail => {
        const originalDuration = (detail.originalStartTime && detail.originalEndTime) ? calculateDurationInMinutes(detail.originalStartTime, detail.originalEndTime) : 0;
        const newDuration = (detail.newStartTime && detail.newEndTime) ? calculateDurationInMinutes(detail.newStartTime, detail.newEndTime) : 0;
        totalMinutesDifference += (newDuration - originalDuration);
      });
    }
    // Display the difference in hours, potentially with a sign
    const sign = totalMinutesDifference >= 0 ? '+' : '-';
    const absoluteMinutes = Math.abs(totalMinutesDifference);
    form.setValue('totalScheduleChangeHours', `${sign}${minutesToDecimalHoursString(absoluteMinutes)} heures`);

  }, [scheduleChangeDetailsWatched, form]);

  useEffect(() => {
    if (isOpen) {
      const isChef = currentUser?.name?.toLowerCase() === 'chef';

      let initialPosition = editingRequest?.position || '';
      if (!editingRequest) {
        if (isChef) {
          initialPosition = 'Chef de cuisine';
        } else if (currentUser?.role) {
          initialPosition = currentUser.role;
        }
      }

      let initialScheduleChangeDetails: any[] = [];
      if (editingRequest?.scheduleChangeDetails && editingRequest.scheduleChangeDetails.length > 0) {
        initialScheduleChangeDetails = editingRequest.scheduleChangeDetails.map(detail => ({
          ...detail,
          id: detail.id || Math.random().toString(36).substring(2, 9),
          date: detail.date && isValid(parseISO(detail.date)) ? parseISO(detail.date) : new Date(),
          newStartTime: detail.newStartTime || '',
          newEndTime: detail.newEndTime || '',
          originalStartTime: detail.originalStartTime || '',
          originalEndTime: detail.originalEndTime || '',
        }));
      } else if (!editingRequest) {
        initialScheduleChangeDetails = [{ id: Math.random().toString(36).substring(2, 9), date: new Date(), newStartTime: '', newEndTime: '', originalStartTime: '', originalEndTime: '' }];
      }

      let empSigDate = editingRequest?.employeeSignatureDate ? parseISO(editingRequest.employeeSignatureDate) : null;
      let managerSigDate = editingRequest?.directManagerSignatureDate ? parseISO(editingRequest.directManagerSignatureDate) : null;
      let directorSigDate = editingRequest?.directorSignatureDate ? parseISO(editingRequest.directorSignatureDate) : null;
      let decDate = editingRequest?.decisionDate ? parseISO(editingRequest.decisionDate) : null;
      let approvalStatus = editingRequest?.approvalStatus || 'pending';

      if (!editingRequest) { // New request
        empSigDate = new Date();
        if (isChef) {
          approvalStatus = 'accepted';
          decDate = new Date();
          managerSigDate = new Date();
          directorSigDate = new Date();
        }
      } else { // Editing existing request
        if (!isApproverView && (!empSigDate || !isValid(empSigDate))) {
            empSigDate = new Date();
        }
        if (isApproverView) {
            if (!decDate && editingRequest.approvalStatus && editingRequest.approvalStatus !== 'pending') decDate = new Date();
            if (!managerSigDate && editingRequest.approvalStatus && editingRequest.approvalStatus !== 'pending') managerSigDate = new Date();
            if (!directorSigDate && editingRequest.approvalStatus && editingRequest.approvalStatus !== 'pending') directorSigDate = new Date();
        }
      }

      form.reset({
        reasonStub: editingRequest?.reasonStub || '',
        position: initialPosition,
        prestationTypes: editingRequest?.prestationTypes || ['logistique'],
        prestationTypeAutresDetail: editingRequest?.prestationTypeAutresDetail || '',
        scheduleChangeDetails: initialScheduleChangeDetails,
        totalScheduleChangeHours: editingRequest?.totalScheduleChangeHours || '0.00 heures',
        employeeSignatureDate: empSigDate,
        directManagerSignatureDate: managerSigDate,
        directorSignatureDate: directorSigDate,
        approvalStatus: approvalStatus,
        rejectionReason: editingRequest?.rejectionReason || '',
        decisionDate: decDate,
      });

    }
  }, [isOpen, editingRequest, currentUser, form, isApproverView]);

  const handleSubmit = (data: FormDataType) => {
    const isChef = currentUser?.name?.toLowerCase() === 'chef';
    const employeeName = isChef && !editingRequest ? 'Julien Dernoncourt' : (editingRequest?.employeeName || currentUser?.name || "Employé inconnu");
    const position = isChef && !editingRequest ? 'Chef de cuisine' : (data.position || editingRequest?.position || currentUser?.role || '');

    const submitData: Partial<ScheduleChangeRequest> = {
      ...data,
      employeeName,
      position,
      employeeSignatureDate: data.employeeSignatureDate ? data.employeeSignatureDate.toISOString() : undefined,
      directManagerSignatureDate: data.directManagerSignatureDate ? data.directManagerSignatureDate.toISOString() : undefined,
      directorSignatureDate: data.directorSignatureDate ? data.directorSignatureDate.toISOString() : undefined,
      decisionDate: data.decisionDate ? data.decisionDate.toISOString() : undefined,
      scheduleChangeDetails: data.scheduleChangeDetails?.map(detail => ({
        id: detail.id || Math.random().toString(36).substring(2, 9),
        date: format(detail.date, 'yyyy-MM-dd'),
        newStartTime: detail.newStartTime,
        newEndTime: detail.newEndTime,
        originalStartTime: detail.originalStartTime,
        originalEndTime: detail.originalEndTime,
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingRequest ? "Modifier le" : "Nouveau"} Changement D'horaire</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <ScrollArea className="h-[70vh] pr-5">
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
                        value={isChefCreating ? "Julien Dernoncourt" : (editingRequest?.employeeName || currentUser?.name || "Non identifié")}
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
                              disabled={employeeFieldsActuallyDisabled || (!editingRequest && !!currentUser?.role)}
                              className={(employeeFieldsActuallyDisabled || (!editingRequest && !!currentUser?.role)) ? "bg-muted/50" : ""}
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
                                disabled={employeeFieldsActuallyDisabled}
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
                                <FormControl><Input placeholder="Précisez..." {...field} value={field.value || ''} className="h-8 text-sm" disabled={employeeFieldsActuallyDisabled} /></FormControl>
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
                      <FormLabel>Motif du changement d'horaire</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Entrez le motif principal de votre demande..." {...field} rows={3} disabled={employeeFieldsActuallyDisabled}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormLabel>Détail des changements d'horaire</FormLabel>
                  <FormDescription className="text-xs text-muted-foreground">
                    Pour chaque jour concerné, indiquez les heures d'absence et/ou les heures de récupération.
                  </FormDescription>
                  <div className="space-y-4 mt-2">
                    {fields.map((fieldItem, index) => (
                      <div key={fieldItem.id} className="p-4 border rounded-lg space-y-4 relative bg-muted/20">
                        {!employeeFieldsActuallyDisabled && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => remove(index)}
                            className="absolute -top-3 -right-3 h-7 w-7 rounded-full"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Controller
                          control={form.control}
                          name={`scheduleChangeDetails.${index}.date`}
                          render={({ field, fieldState }) => {
                            const selectedDate = field.value ? (field.value instanceof Date ? field.value : parseISO(String(field.value))) : undefined;
                            const isDateValid = selectedDate && isValid(selectedDate);
                            return (
                              <FormItem>
                                <FormLabel>Jour de l'absence / récupération</FormLabel>
                                <Popover modal={true}>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant={"outline"}
                                        className={cn("w-full pl-3 text-left font-normal h-9", !isDateValid && "text-muted-foreground", fieldState.error && "border-destructive")}
                                        disabled={employeeFieldsActuallyDisabled}
                                      >
                                        {isDateValid ? format(selectedDate, "dd/MM/yyyy", { locale: fr }) : <span>Choisir une date</span>}
                                        <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={isDateValid ? selectedDate : undefined} onSelect={field.onChange} initialFocus locale={fr} disabled={employeeFieldsActuallyDisabled} />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage className="text-xs" />
                              </FormItem>
                            );
                          }}
                        />

                        <div className="space-y-2">
                          <p className="text-sm font-medium">Horaires d'absence</p>
                          <div className="grid grid-cols-2 gap-2">
                            <FormField
                              control={form.control}
                              name={`scheduleChangeDetails.${index}.originalStartTime`}
                              render={({ field: timeField }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Début</FormLabel>
                                  <FormControl><Input type="time" {...timeField} value={timeField.value || ''} className="h-9" disabled={employeeFieldsActuallyDisabled} /></FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`scheduleChangeDetails.${index}.originalEndTime`}
                              render={({ field: timeField }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Fin</FormLabel>
                                  <FormControl><Input type="time" {...timeField} value={timeField.value || ''} className="h-9" disabled={employeeFieldsActuallyDisabled} /></FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium">Horaires de récupération</p>
                          <div className="grid grid-cols-2 gap-2">
                            <FormField
                              control={form.control}
                              name={`scheduleChangeDetails.${index}.newStartTime`}
                              render={({ field: timeField }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Début</FormLabel>
                                  <FormControl><Input type="time" {...timeField} value={timeField.value || ''} className="h-9" disabled={employeeFieldsActuallyDisabled} /></FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`scheduleChangeDetails.${index}.newEndTime`}
                              render={({ field: timeField }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Fin</FormLabel>
                                  <FormControl><Input type="time" {...timeField} value={timeField.value || ''} className="h-9" disabled={employeeFieldsActuallyDisabled} /></FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!employeeFieldsActuallyDisabled && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ id: Math.random().toString(36).substring(2, 9), date: new Date(), newStartTime: '', newEndTime: '', originalStartTime: '', originalEndTime: '' })}
                      className="mt-4"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un jour
                    </Button>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="totalScheduleChangeHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Différence totale d'heures due au changement d'horaire</FormLabel>
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
                        {renderDateField('employeeSignatureDate', "Date signature Salarié(e)", employeeFieldsActuallyDisabled || (isApproverView && !!editingRequest?.employeeSignatureDate))}
                        {renderDateField('directManagerSignatureDate', "Date signature Responsable Direct", directionFieldsActuallyDisabled)}
                        {renderDateField('directorSignatureDate', "Date signature Directeur", directionFieldsActuallyDisabled)}
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
                          <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4" disabled={directionFieldsActuallyDisabled}>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="accepted" disabled={directionFieldsActuallyDisabled} /></FormControl><FormLabel className="font-normal text-sm">Acceptée</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="rejected" disabled={directionFieldsActuallyDisabled} /></FormControl><FormLabel className="font-normal text-sm">Refusée</FormLabel></FormItem>
                             <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="pending" disabled={directionFieldsActuallyDisabled} /></FormControl><FormLabel className="font-normal text-sm">En attente</FormLabel></FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {approvalStatusWatched === 'rejected' && (
                    <FormField control={form.control} name="rejectionReason" render={({ field }) => (
                      <FormItem><FormLabel>Si refusée, motif :</FormLabel><FormControl><Textarea placeholder="Motif du refus..." {...field} value={field.value || ''} rows={2} disabled={directionFieldsActuallyDisabled}/></FormControl><FormMessage /></FormItem>
                    )} />
                  )}
                  {/* Wrap renderDateField for decisionDate in a FormField */}
                  {renderDateField('decisionDate', "Date de la Décision", directionFieldsActuallyDisabled)}
                  {/* END Wrap */}
                </div>
                <div className="space-y-2 border-t pt-3">
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Annuler</Button>
              </DialogClose>
              {!isFormLockedForEmployee && (
                <Button type="submit">
                  {editingRequest ? "Enregistrer les Modifications" : "Soumettre la Demande"}
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
