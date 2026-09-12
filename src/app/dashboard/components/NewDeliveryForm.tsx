"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { ReceptionEntry, PmsSupplierDefinition, PmsConfigurations } from '@/app/dashboard/pms/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';
import { Loader2, CalendarIcon as LucideCalendarIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { PMS_SUPPLIER_MANAGEMENT_KEY } from '@/app/dashboard/settings/types';

const PRODUCT_LABELING_NONE_VALUE = "_NONE_";

const receptionEntrySchema = z.object({
  dateTime: z.date({ required_error: "Date et heure sont requises." }),
  supplierName: z.string().min(1, "Nom du fournisseur requis."),
  productNameControlled: z.string().min(1, "Dénomination du produit requise."),
  vehicleObservations: z.string().optional(),
  productTemperature: z.string().optional(),
  dlcDluo: z.string().optional(),
  lotNumber: z.string().optional(),
  packagingAspect: z.string().optional(),
  quantity: z.string().optional(),
  productLabeling: z.enum(['conforme', 'non_conforme', PRODUCT_LABELING_NONE_VALUE, '']).default('').optional(),
  refused: z.boolean().default(false),
  refusalReason: z.string().optional(),
  visa: z.string().optional(),
}).refine(data => !data.refused || (data.refused && data.refusalReason && data.refusalReason.length > 0), {
  message: "La raison du refus est requise si le produit est refusé.",
  path: ['refusalReason'],
});

type ReceptionFormData = z.infer<typeof receptionEntrySchema>;

const FIRESTORE_COLLECTION = "pmsReceptionLog";
const FIRESTORE_PMS_CONFIG_COLLECTION = "pmsConfigurations";
const FIRESTORE_PMS_CONFIG_DOC_ID = "mainConfig";

export default function NewDeliveryForm({ onFormSubmit }: { onFormSubmit: () => void }) {
    const [isLoading, setIsLoading] = useState(false);
    const [configuredSuppliers, setConfiguredSuppliers] = useState<PmsSupplierDefinition[]>([]);
    const { toast } = useToast();

    const form = useForm<ReceptionFormData>({
        resolver: zodResolver(receptionEntrySchema),
        defaultValues: {
            dateTime: new Date(),
            supplierName: '',
            productNameControlled: '',
            vehicleObservations: 'RAS',
            productTemperature: '',
            dlcDluo: '',
            lotNumber: '',
            packagingAspect: 'RAS',
            quantity: '',
            productLabeling: '',
            refused: false,
            refusalReason: '',
            visa: 'JD',
        },
    });

    const loadSuppliersFromPmsConfig = useCallback(async () => {
        const docRef = doc(firestore, FIRESTORE_PMS_CONFIG_COLLECTION, FIRESTORE_PMS_CONFIG_DOC_ID);
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const pmsSettings = docSnap.data() as PmsConfigurations;
                const suppliers = (pmsSettings[PMS_SUPPLIER_MANAGEMENT_KEY] || []).filter(s => s.name && s.name.trim() !== "");
                setConfiguredSuppliers(suppliers.sort((a, b) => a.name.localeCompare(b.name)));
            } else {
                setConfiguredSuppliers([]);
                toast({ title: "Config Fournisseurs Manquante", description: "Veuillez définir des fournisseurs dans Paramètres PMS.", variant: "destructive" });
            }
        } catch (error) {
            console.error("Error loading suppliers from PMS config:", error);
            setConfiguredSuppliers([]);
            toast({ title: "Erreur Chargement Fournisseurs", variant: "destructive" });
        }
    }, [toast]);

    useEffect(() => {
        loadSuppliersFromPmsConfig();
    }, [loadSuppliersFromPmsConfig]);

    const handleFormSubmit = async (data: ReceptionFormData) => {
        setIsLoading(true);
        const entryDataForFirestore = {
            ...data,
            dateTime: Timestamp.fromDate(data.dateTime),
            vehicleObservations: data.vehicleObservations || 'RAS',
            packagingAspect: data.packagingAspect || 'RAS',
            productTemperature: data.productTemperature || '',
            dlcDluo: data.dlcDluo || '',
            lotNumber: data.lotNumber || '',
            quantity: data.quantity || '',
            productLabeling: data.productLabeling === PRODUCT_LABELING_NONE_VALUE ? '' : data.productLabeling || '',
            refusalReason: data.refused ? (data.refusalReason || '') : '',
            visa: data.visa || '',
        };

        try {
            await addDoc(collection(firestore, FIRESTORE_COLLECTION), entryDataForFirestore);
            toast({ title: "Réception Enregistrée", description: "Une nouvelle réception a été ajoutée." });
            onFormSubmit();
            // Dispatch a custom event to notify other components that a new delivery has been added
            window.dispatchEvent(new CustomEvent('deliveryAdded'));
        } catch (error) {
            console.error("Error saving reception entry to Firestore:", error);
            toast({ title: "Erreur de Sauvegarde", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-3 py-2 max-h-[80vh] sm:max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField control={form.control} name="dateTime" render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Date et Heure</FormLabel>
                            <Popover modal={true}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                            {field.value ? format(field.value, "dd/MM/yyyy HH:mm", { locale: fr }) : <span>Choisir date et heure</span>}
                                            <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={fr} />
                                    <Input type="time" className="mt-1"
                                        defaultValue={field.value ? format(field.value, 'HH:mm') : ""}
                                        onChange={(e) => {
                                            const timeParts = e.target.value.split(':');
                                            const newDate = new Date(field.value || new Date());
                                            newDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]));
                                            field.onChange(newDate);
                                        }}
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="supplierName" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nom du fournisseur</FormLabel>
                            <Select
                                onValueChange={field.onChange}
                                value={field.value || undefined}
                            >
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sélectionner un fournisseur" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {configuredSuppliers.length > 0 ? configuredSuppliers.map(supplier => (
                                        <SelectItem key={supplier.id} value={supplier.name}>
                                            {supplier.name}
                                        </SelectItem>
                                    )) : <SelectItem value="disabled_no_suppliers_in_select" disabled>Aucun fournisseur configuré</SelectItem>}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="productNameControlled" render={({ field }) => (<FormItem><FormLabel>Dénomination du produit contrôlé</FormLabel><FormControl><Input placeholder="Ex: Poulet entier" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="vehicleObservations" render={({ field }) => (<FormItem><FormLabel>Véhicule (propreté, T°)</FormLabel><FormControl><Textarea placeholder="Ex: Camion propre, T° ok" {...field} rows={2} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <h4 className="text-md font-semibold pt-2 border-t mt-3">Détails Produits</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField control={form.control} name="productTemperature" render={({ field }) => (<FormItem><FormLabel>T° C Produit</FormLabel><FormControl><Input placeholder="Ex: 3°C" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="dlcDluo" render={({ field }) => (<FormItem><FormLabel>DLC / DLUO</FormLabel><FormControl><Input placeholder="Ex: 25/12/2024" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="lotNumber" render={({ field }) => (<FormItem><FormLabel>N° du lot</FormLabel><FormControl><Input placeholder="Ex: LOT12345" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="packagingAspect" render={({ field }) => (<FormItem><FormLabel>Aspect et emballage</FormLabel><FormControl><Input placeholder="Ex: Emballage intact" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantité</FormLabel><FormControl><Input placeholder="Ex: 10 kg" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField
                        control={form.control}
                        name="productLabeling"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Étiquetage du produit</FormLabel>
                                <Select
                                    onValueChange={(valueFromSelect) => {
                                        field.onChange(valueFromSelect === PRODUCT_LABELING_NONE_VALUE ? "" : valueFromSelect);
                                    }}
                                    value={field.value === "" ? PRODUCT_LABELING_NONE_VALUE : field.value || ""}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Sélectionner statut étiquetage..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value={PRODUCT_LABELING_NONE_VALUE}>Non renseigné</SelectItem>
                                        <SelectItem value="conforme">Conforme</SelectItem>
                                        <SelectItem value="non_conforme">Non Conforme</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField control={form.control} name="refused" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 pt-2">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="refused-check-new" /></FormControl>
                        <FormLabel htmlFor="refused-check-new" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Produit Refusé ?</FormLabel>
                        <FormMessage />
                    </FormItem>
                )} />
                {form.watch('refused') && (
                    <FormField control={form.control} name="refusalReason" render={({ field }) => (<FormItem><FormLabel>Raison du refus</FormLabel><FormControl><Textarea placeholder="Expliquer la raison du refus..." {...field} rows={2} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                )}
                <FormField control={form.control} name="visa" render={({ field }) => (<FormItem><FormLabel>Visa (Initiales)</FormLabel><FormControl><Input placeholder="Ex: JD" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <DialogFooter className="pt-3">
                    <Button type="button" variant="outline" onClick={onFormSubmit}>Annuler</Button>
                    <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ajouter</Button>
                </DialogFooter>
            </form>
        </Form>
    );
}
