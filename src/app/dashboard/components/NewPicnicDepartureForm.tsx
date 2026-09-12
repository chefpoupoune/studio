"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogFooter } from '@/components/ui/dialog';
import { Loader2, CalendarIcon as LucideCalendarIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, getDoc, addDoc, doc, Timestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PmsZone } from '@/app/dashboard/pms/types';

const FIRESTORE_COLLECTION = "pmsPicnicDepartureForms";
const PMS_CONFIG_COLLECTION = "pmsConfigurations";
const PMS_CONFIG_DOC_ID = "mainConfig";
const PMS_CLIENT_MANAGEMENT_KEY = 'clientManagement_v1';

const picnicDepartureSchema = z.object({
  orderReceivedDate: z.date({ required_error: "Date de réception de commande requise." }),
  orderReceivedTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:MM requis."),
  clientName: z.string().min(1, "Nom du client requis."),
  numberOfPicnics: z.coerce.number().min(1, "Nombre de pique-niques doit être au moins 1."),
  departureTemperature: z.string().min(1, "Température de départ requise."),
});

type PicnicDepartureFormData = z.infer<typeof picnicDepartureSchema>;

interface NewPicnicDepartureFormProps {
  onFormSubmit: () => void; // Callback to close dialog on success
}

export default function NewPicnicDepartureForm({ onFormSubmit }: NewPicnicDepartureFormProps) {
  const [clients, setClients] = useState<PmsZone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<PicnicDepartureFormData>({
    resolver: zodResolver(picnicDepartureSchema),
    defaultValues: {
      orderReceivedDate: new Date(),
      orderReceivedTime: format(new Date(), 'HH:mm'),
      clientName: '',
      numberOfPicnics: 1,
      departureTemperature: '',
    },
  });

  const fetchClients = useCallback(async () => {
    try {
      const docRef = doc(firestore, PMS_CONFIG_COLLECTION, PMS_CONFIG_DOC_ID);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setClients(data[PMS_CLIENT_MANAGEMENT_KEY] || []);
      }
    } catch (error) {
      console.error("Error loading clients:", error);
      toast({ title: "Erreur de chargement des clients", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleFormSubmit = async (data: PicnicDepartureFormData) => {
    setIsLoading(true);
    const entryDataForFirestore = {
      orderReceivedDate: Timestamp.fromDate(data.orderReceivedDate),
      orderReceivedTime: data.orderReceivedTime,
      clientName: data.clientName,
      numberOfPicnics: data.numberOfPicnics,
      departureTemperature: data.departureTemperature,
      entryCreationDate: Timestamp.fromDate(new Date()),
    };

    try {
      await addDoc(collection(firestore, FIRESTORE_COLLECTION), entryDataForFirestore);
      toast({ title: "Fiche de Départ Ajoutée" });
      form.reset({
        orderReceivedDate: new Date(),
        orderReceivedTime: format(new Date(), 'HH:mm'),
        clientName: '',
        numberOfPicnics: 1,
        departureTemperature: '',
      });
      onFormSubmit(); // Close the dialog
    } catch (error) {
      console.error("Error saving form:", error);
      toast({ title: "Erreur de Sauvegarde", variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-3 py-2">
        <FormField control={form.control} name="orderReceivedDate" render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Commande reçue le</FormLabel>
            <Popover modal={true}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                    {field.value ? format(field.value, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
                    <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={fr} />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="orderReceivedTime" render={({ field }) => (
            <FormItem>
                <FormLabel>À ... H ... (Heure de réception)</FormLabel>
                <FormControl><Input type="time" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
        )} />
        <FormField control={form.control} name="clientName" render={({ field }) => (
          <FormItem>
            <FormLabel>Le Client</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un client" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.name}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="numberOfPicnics" render={({ field }) => (
            <FormItem>
                <FormLabel>Nombre de Pique-Niques</FormLabel>
                <FormControl><Input type="number" placeholder="0" min="1" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
        )} />
        <FormField control={form.control} name="departureTemperature" render={({ field }) => (
            <FormItem>
                <FormLabel>T° de Départ</FormLabel>
                <FormControl><Input placeholder="Ex: 3" {...field} /></FormControl>
                <FormMessage />
            </FormItem>
        )} />
        <DialogFooter className="pt-4">
            <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Ajouter la Fiche"}
            </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
