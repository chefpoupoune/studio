
"use client";

import React, { useEffect } from 'react'; // Added useEffect
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form'; // Added useWatch
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { OvertimeRequestStub, OvertimeDayDetail } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon as LucideCalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { timeToMinutes, calculateDurationInMinutes, minutesToDecimalHoursString } from '@/app/dashboard/time-tracking/utils'; // Corrected import path

const overtimeDetailSchema = z.object({
  id: z.string().optional(), // Keep id for existing entries if needed for keys
  date: z.date({ required_error: "Date requise." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:MM requis.").optional().or(z.literal('')),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:MM requis.").optional().or(z.literal('')),
});

const formSchema = z.object({
  reasonStub: z.string().min(5, "Veuillez fournir un bref motif (min. 5 caractères).").max(500, "Le motif ne peut excéder 500 caractères."),
  position: z.string().optional(),
  overtimeDetails: z.array(overtimeDetailSchema).optional().default([]),
  totalOvertimeHours: z.string().max(50, "Total heures max 50 caractères.").optional(),
});

type FormDataType = z.infer<typeof formSchema>;

type SubmitDataType = Omit<FormDataType, 'overtimeDetails'> & {
  overtimeDetails?: OvertimeDayDetail[];
};

interface OvertimeRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmitRequest: (data: SubmitDataType) => void;
  editingRequest?: OvertimeRequestStub | null;
  currentUser?: { name: string; role: string } | null;
}

export default function OvertimeRequestDialog({
  isOpen,
  onOpenChange,
  onSubmitRequest,
  editingRequest,
  currentUser,
}: OvertimeRequestDialogProps) {
  const form = useForm<FormDataType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reasonStub: '',
      position: '',
      overtimeDetails: [],
      totalOvertimeHours: '0.00',
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

  useEffect(() => {
    if (overtimeDetailsWatched) {
      let totalMinutes = 0;
      overtimeDetailsWatched.forEach(detail => {
        if (detail.startTime && detail.endTime) {
          totalMinutes += calculateDurationInMinutes(detail.startTime, detail.endTime);
        }
      });
      form.setValue('totalOvertimeHours', minutesToDecimalHoursString(totalMinutes) + " heures");
    }
  }, [overtimeDetailsWatched, form]);

  useEffect(() => {
    if (isOpen) {
      let initialPosition = '';
      if (editingRequest) {
        initialPosition = editingRequest.position || '';
      } else if (currentUser?.role) {
        initialPosition = currentUser.role;
      }

      let initialOvertimeDetails = [];
      if (editingRequest?.overtimeDetails && editingRequest.overtimeDetails.length > 0) {
        initialOvertimeDetails = editingRequest.overtimeDetails.map(detail => ({
          ...detail,
          id: detail.id || Math.random().toString(36).substring(2, 9),
          date: detail.date ? parseISO(detail.date) : new Date(),
          startTime: detail.startTime || '',
          endTime: detail.endTime || '',
        }));
      } else if (!editingRequest) {
        initialOvertimeDetails = [{ id: Math.random().toString(36).substring(2, 9), date: new Date(), startTime: '', endTime: '' }];
      }
      
      form.reset({
        reasonStub: editingRequest?.reasonStub || '',
        position: initialPosition,
        overtimeDetails: initialOvertimeDetails,
        totalOvertimeHours: editingRequest?.totalOvertimeHours || '0.00 heures',
      });
      
      // Trigger manual recalculation for existing entries after reset
      if (editingRequest?.overtimeDetails) {
        let totalMinutes = 0;
        editingRequest.overtimeDetails.forEach(detail => {
          if (detail.startTime && detail.endTime) {
            totalMinutes += calculateDurationInMinutes(detail.startTime, detail.endTime);
          }
        });
        form.setValue('totalOvertimeHours', minutesToDecimalHoursString(totalMinutes) + " heures");
      }

    }
  }, [isOpen, editingRequest, currentUser, form]);

  const handleSubmit = (data: FormDataType) => {
    const submitData: SubmitDataType = {
      ...data,
      overtimeDetails: data.overtimeDetails?.map(detail => ({
        id: detail.id || Math.random().toString(36).substring(2, 9), 
        date: format(detail.date, 'yyyy-MM-dd'),
        startTime: detail.startTime,
        endTime: detail.endTime,
      }))
    };
    onSubmitRequest(submitData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editingRequest ? "Modifier la" : "Nouvelle"} Demande de Dépassement d'Horaire</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <ScrollArea className="h-[65vh] pr-5">
              <div className="space-y-4">
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
                          disabled={!editingRequest && !!currentUser?.role}
                          className={(!editingRequest && !!currentUser?.role) ? "bg-muted/50" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormItem>
                  <FormLabel>Prestation correspondante</FormLabel>
                  <FormControl>
                    <Input value="Logistique" disabled className="bg-muted/50" />
                  </FormControl>
                </FormItem>

                <FormField
                  control={form.control}
                  name="reasonStub"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motif de la demande</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Entrez le motif principal de votre demande..." {...field} rows={3} />
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
                        render={({ field: dateField }) => (
                          <FormItem className="flex-grow">
                            <FormLabel className="text-xs">Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal h-9",
                                      !dateField.value && "text-muted-foreground"
                                    )}
                                  >
                                    {dateField.value ? (
                                      format(dateField.value, "dd/MM/yyyy", { locale: fr })
                                    ) : (
                                      <span>Choisir date</span>
                                    )}
                                    <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={dateField.value}
                                  onSelect={dateField.onChange}
                                  initialFocus
                                  locale={fr}
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`overtimeDetails.${index}.startTime`}
                        render={({ field: timeField }) => (
                          <FormItem className="w-28">
                            <FormLabel className="text-xs">Début</FormLabel>
                            <FormControl><Input type="time" {...timeField} className="h-9" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`overtimeDetails.${index}.endTime`}
                        render={({ field: timeField }) => (
                          <FormItem className="w-28">
                            <FormLabel className="text-xs">Fin</FormLabel>
                            <FormControl><Input type="time" {...timeField} className="h-9"/></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} className="h-9 w-9">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ id: Math.random().toString(36).substring(2, 9), date: new Date(), startTime: '', endTime: '' })}
                    className="mt-2"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une date/plage horaire
                  </Button>
                </div>
                
                <FormField
                  control={form.control}
                  name="totalOvertimeHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total des heures en plus de l'horaire prévu</FormLabel>
                      <FormControl>
                        <Input placeholder="Calculé automatiquement" {...field} disabled className="bg-muted/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <p className="text-xs text-muted-foreground pt-2">
                  D'autres champs (Signatures, dates spécifiques, etc.) seront ajoutés pour correspondre au document officiel.
                </p>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Annuler</Button>
              </DialogClose>
              <Button type="submit">{editingRequest ? "Enregistrer" : "Soumettre la Demande"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

