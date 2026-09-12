"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ReceptionEntry, PmsSupplierDefinition, PmsConfigurations } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, FileText, Loader2, Truck, CalendarIcon as LucideCalendarIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { firestore } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  Timestamp,
  writeBatch,
  getDoc,
  where
} from 'firebase/firestore';
import { PMS_SUPPLIER_MANAGEMENT_KEY } from '@/app/dashboard/settings/types';
import useMobile from '@/hooks/use-mobile'; // Import the useMobile hook

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

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

// Shared Form Component
const ReceptionForm = ({ form, onSubmit, isLoading, editingEntry, onCancel, configuredSuppliers }: { form: any, onSubmit: any, isLoading: boolean, editingEntry: ReceptionEntry | null, onCancel?: () => void, configuredSuppliers: PmsSupplierDefinition[] }) => (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 py-2 max-h-[80vh] sm:max-h-[70vh] overflow-y-auto pr-2">
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
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="refused-check" /></FormControl>
                    <FormLabel htmlFor="refused-check" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Produit Refusé ?</FormLabel>
                    <FormMessage />
                </FormItem>
            )} />
            {form.watch('refused') && (
                <FormField control={form.control} name="refusalReason" render={({ field }) => (<FormItem><FormLabel>Raison du refus</FormLabel><FormControl><Textarea placeholder="Expliquer la raison du refus..." {...field} rows={2} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
            )}
            <FormField control={form.control} name="visa" render={({ field }) => (<FormItem><FormLabel>Visa (Initiales)</FormLabel><FormControl><Input placeholder="Ex: JD" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter className="pt-3">
                {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>}
                <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingEntry ? "Enregistrer" : "Ajouter"}</Button>
            </DialogFooter>
        </form>
    </Form>
);

export default function ReceptionMonitoring() {
    const [receptionEntries, setReceptionEntries] = useState<ReceptionEntry[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<ReceptionEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [configuredSuppliers, setConfiguredSuppliers] = useState<PmsSupplierDefinition[]>([]);
    const { toast } = useToast();
    const isMobile = useMobile();


    
    const [selectedDate, setSelectedDate] = useState(new Date());
    const handleMonthChange = (monthStr: string) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(parseInt(monthStr, 10));
        setSelectedDate(newDate);
    };
    
    const handleYearChange = (yearStr: string) => {
        const newDate = new Date(selectedDate);
        newDate.setFullYear(parseInt(yearStr, 10));
        setSelectedDate(newDate);
    };
    
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i.toString(),
        label: format(new Date(0, i), 'MMMM', { locale: fr }),
    }));
    



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

    const fetchReceptionEntries = useCallback(async () => {
    setIsLoading(true);
    try {
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

        const entriesCollectionRef = collection(firestore, FIRESTORE_COLLECTION);
        const q = query(entriesCollectionRef, 
            where("dateTime", ">=", Timestamp.fromDate(startOfMonth)),
            where("dateTime", "<=", Timestamp.fromDate(endOfMonth)),
            orderBy("dateTime", "desc")
        );
        const querySnapshot = await getDocs(q);
        const loadedEntries = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                dateTime: (data.dateTime as Timestamp).toDate().toISOString(),
            } as ReceptionEntry;
        });
        setReceptionEntries(loadedEntries);
    } catch (error) {
        console.error("Error loading reception entries from Firestore:", error);
        toast({ title: "Erreur de chargement", description: "Données de réception non chargées.", variant: "destructive" });
        setReceptionEntries([]);
    }
    setIsLoading(false);
}, [toast, selectedDate]);

    useEffect(() => {
    loadSuppliersFromPmsConfig();

    const handlePmsConfigUpdated = () => {
        console.log("[ReceptionMonitoring] pmsConfigUpdated event received. Reloading suppliers.");
        loadSuppliersFromPmsConfig();
    };
    window.addEventListener('pmsConfigUpdated', handlePmsConfigUpdated);
    return () => window.removeEventListener('pmsConfigUpdated', handlePmsConfigUpdated);
}, [loadSuppliersFromPmsConfig]);

useEffect(() => {
    fetchReceptionEntries();
}, [fetchReceptionEntries]);


    const handleOpenDialog = (entry?: ReceptionEntry) => {
        setEditingEntry(entry || null);
        if (entry) {
            form.reset({
                ...entry,
                dateTime: parseISO(entry.dateTime),
                productLabeling: entry.productLabeling === 'conforme' || entry.productLabeling === 'non_conforme' ? entry.productLabeling : PRODUCT_LABELING_NONE_VALUE,
                vehicleObservations: entry.vehicleObservations || 'RAS',
                packagingAspect: entry.packagingAspect || 'RAS',
                visa: entry.visa || 'JD',
            });
        } else {
            form.reset({
                dateTime: new Date(),
                supplierName: '', productNameControlled: '', vehicleObservations: 'RAS',
                productTemperature: '', dlcDluo: '', lotNumber: '', packagingAspect: 'RAS',
                quantity: '', productLabeling: PRODUCT_LABELING_NONE_VALUE, refused: false, refusalReason: '', visa: 'JD',
            });
        }
        setIsDialogOpen(true);
    };
    
    const handleCloseForm = () => {
        setEditingEntry(null);
        setIsDialogOpen(false);
        form.reset({ 
            dateTime: new Date(), supplierName: '', productNameControlled: '', vehicleObservations: 'RAS', 
            productTemperature: '', dlcDluo: '', lotNumber: '', packagingAspect: 'RAS', 
            quantity: '', productLabeling: PRODUCT_LABELING_NONE_VALUE, refused: false, refusalReason: '', visa: 'JD',
        });
    }

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
            if (editingEntry) {
                const entryDocRef = doc(firestore, FIRESTORE_COLLECTION, editingEntry.id);
                await setDoc(entryDocRef, entryDataForFirestore);
                toast({ title: "Enregistrement Modifié", description: "La réception a été mise à jour." });
            } else {
                await addDoc(collection(firestore, FIRESTORE_COLLECTION), entryDataForFirestore);
                toast({ title: "Réception Enregistrée", description: "Une nouvelle réception a été ajoutée." });
            }
            fetchReceptionEntries();
        } catch (error) {
            console.error("Error saving reception entry to Firestore:", error);
            toast({ title: "Erreur de Sauvegarde", variant: "destructive" });
        } finally {
            setIsLoading(false);
            if (isMobile) {
                handleCloseForm();
            } else {
                setIsDialogOpen(false);
            }
        }
    };

    const handleDeleteEntry = async (entryId: string) => {
        setIsLoading(true);
        try {
            await deleteDoc(doc(firestore, FIRESTORE_COLLECTION, entryId));
            toast({ title: "Enregistrement Supprimé", variant: "destructive" });
            fetchReceptionEntries();
        } catch (error) {
            console.error("Error deleting reception entry from Firestore:", error);
            toast({ title: "Erreur de Suppression", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAllEntries = async () => {
    setIsLoading(true);
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

    try {
        const entriesCollectionRef = collection(firestore, FIRESTORE_COLLECTION);
        const q = query(entriesCollectionRef,
            where("dateTime", ">=", Timestamp.fromDate(startOfMonth)),
            where("dateTime", "<=", Timestamp.fromDate(endOfMonth))
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            toast({ title: "Aucun enregistrement à supprimer", description: "Il n'y a pas de données pour le mois sélectionné." });
            setIsLoading(false);
            return;
        }

        const batch = writeBatch(firestore);
        querySnapshot.docs.forEach(docSnapshot => batch.delete(docSnapshot.ref));
        await batch.commit();

        fetchReceptionEntries(); // Re-fetch the (now empty) list of entries
        toast({
            title: "Enregistrements Supprimés",
            description: `L'historique pour ${format(selectedDate, 'MMMM yyyy', { locale: fr })} a été vidé.`,
            variant: "destructive"
        });
    } catch (error) {
        console.error("Error deleting month's reception entries:", error);
        toast({ title: "Erreur de Suppression", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
};

    const generatePdf = async () => {
        if (receptionEntries.length === 0) {
            toast({ title: "Aucune Donnée", description: "Aucun enregistrement de réception à exporter.", variant: "destructive" });
            return;
        }
        setIsLoading(true);
        try {
            const pdfSettings = await getPdfLayoutSettings('pms_reception_monitoring');
            const doc = new jsPDF({
                orientation: pdfSettings.orientation as any || 'landscape',
                unit: 'pt',
                format: pdfSettings.pageSize as any || 'a4',
            }) as jsPDFWithAutoTable;

            const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
            const monthYearTitle = format(selectedDate, 'MMMM yyyy', { locale: fr });

            doc.autoTable({
                didDrawPage: (data: any) => {
                    // --- EN-TÊTE ---
                    let headerY = pdfSettings.marginTop;
                    const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;
                    const effectiveHeaderText = pdfSettings.headerText || (pdfSettings.logoUrl ? '{logo}' : '');

                    if (data.pageNumber === 1 && effectiveHeaderText) {
                        const headerRows = effectiveHeaderText.split('\n');
                        doc.setFontSize(pdfSettings.headerFontSize);
                        for (const row of headerRows) {
                            const cells = row.split('|');
                            if (cells.length === 0) continue;
                            let maxHeightInRow = 0;
                            const cellWidth = pageContentWidth / cells.length;
                            cells.forEach(cell => {
                                const cellText = cell.trim();
                                if (cellText === '{logo}' && pdfSettings.logoUrl) {
                                    maxHeightInRow = Math.max(maxHeightInRow, 30);
                                } else {
                                    const textLines = doc.splitTextToSize(cellText, cellWidth - 6);
                                    maxHeightInRow = Math.max(maxHeightInRow, (textLines.length * pdfSettings.headerFontSize * 0.7) + 6);
                                }
                            });

                            let currentX = pdfSettings.marginLeft;
                            for (const cell of cells) {
                                const cellText = cell.trim();
                                doc.rect(currentX, headerY, cellWidth, maxHeightInRow, 'S');
                                if (cellText === '{logo}' && pdfSettings.logoUrl) {
                                    try {
                                        const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                                        const imgHeight = Math.min(maxHeightInRow - 6, 40);
                                        const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                                        doc.addImage(pdfSettings.logoUrl, imgProps.fileType, currentX + (cellWidth - imgWidth) / 2, headerY + (maxHeightInRow - imgHeight) / 2, imgWidth, imgHeight);
                                    } catch (e) { console.error("Erreur logo.", e); }
                                } else if (cellText !== '{logo}') {
                                    doc.text(cellText, currentX + (cellWidth / 2), headerY + (maxHeightInRow / 2), { align: 'center', baseline: 'middle', maxWidth: cellWidth - 6 });
                                }
                                currentX += cellWidth;
                            }
                            headerY += maxHeightInRow;
                        }
                    }
                    
                    // --- TITRE DU DOCUMENT ---
                    const moduleDefaultTitle = `Suivi de Réception des Marchandises - ${monthYearTitle}`;
                    let finalTitle = pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle ? pdfSettings.documentBaseTitle.trim() : "";
                    if (pdfSettings.showModuleTitle) {
                        finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
                    }
                    if (data.pageNumber === 1 && finalTitle) {
                        doc.setFontSize(pdfSettings.documentTitleFontSize);
                        doc.text(finalTitle, doc.internal.pageSize.width / 2, headerY + pdfSettings.documentTitleFontSize, { align: 'center' });
                    }

                    // --- PIED DE PAGE ---
                    if (pdfSettings.footerText) {
                        doc.setFontSize(pdfSettings.footerFontSize);
                        doc.text(
                            pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', doc.internal.getNumberOfPages().toString()),
                            data.settings.margin.left,
                            doc.internal.pageSize.height - (pdfSettings.marginBottom / 2)
                        );
                    }
                },
                startY: pdfSettings.marginTop + 80, // Adjust startY to make space for header and title
                head: [
                    [
                        { content: 'Date et heure', rowSpan: 2 }, 'Nom du fournisseur', 'Produit contrôlé', 'Véhicule',
                        { content: 'Produits', colSpan: 6 },
                        { content: 'Refusé', rowSpan: 2 }, { content: 'Visa', rowSpan: 2 }
                    ],
                    [
                        'T° C', 'DLC/DLUO', 'N° du lot', 'Aspect', 'Quantité', 'Étiquetage'
                    ]
                ],
                body: receptionEntries.map(entry => [
                    format(parseISO(entry.dateTime), "dd/MM/yy HH:mm"),
                    entry.supplierName, entry.productNameControlled, entry.vehicleObservations || '-',
                    entry.productTemperature || '-', entry.dlcDluo || '-', entry.lotNumber || '-',
                    entry.packagingAspect || '-', entry.quantity || '-',
                    entry.productLabeling === 'conforme' ? 'OK' : entry.productLabeling === 'non_conforme' ? 'Non OK' : '-',
                    entry.refused ? `Oui${entry.refusalReason ? ` (${entry.refusalReason})` : ''}` : 'Non',
                    entry.visa || '-',
                ]),
                theme: 'grid',
                styles: { fontSize: 6.5, cellPadding: 1, valign: 'middle', font: pdfSettings.fontFamily, overflow: 'linebreak' },
                headStyles: {
                    fontStyle: 'bold', halign: 'center', valign: 'middle',
                    fontSize: 7, cellPadding: 1,
                    fillColor: pdfSettings.primaryColor,
                    textColor: pdfSettings.primaryColor ? (hexToRgb(pdfSettings.primaryColor)!.r * 299 + hexToRgb(pdfSettings.primaryColor)!.g * 587 + hexToRgb(pdfSettings.primaryColor)!.b * 114) / 1000 > 125 ? '#000' : '#FFF' : '#FFF',
                },
                columnStyles: {
                    0: { cellWidth: 55, halign: 'center' }, 1: { cellWidth: 80 }, 2: { cellWidth: 80 },
                    3: { cellWidth: 60 }, 4: { cellWidth: 30, halign: 'center' }, 5: { cellWidth: 50, halign: 'center' },
                    6: { cellWidth: 50, halign: 'center' }, 7: { cellWidth: 60 }, 8: { cellWidth: 40, halign: 'center' },
                    9: { cellWidth: 50, halign: 'center' }, 10: { cellWidth: 'auto' }, 11: { cellWidth: 30, halign: 'center' }
                },
                margin: { top: pdfSettings.marginTop + 80, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
            });

            const filename = `Suivi_Reception_${format(selectedDate, "yyyy-MM")}.pdf`;
            doc.save(filename);
            toast({ title: "PDF Généré", description: `Le fichier "${filename}" a été téléchargé.` });

        } catch (error: any) {
            console.error("Error generating PDF:", error);
            toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${error.message || String(error)}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };


    const validConfiguredSuppliers = useMemo(() => {
        return configuredSuppliers.filter(s => s.name && s.name.trim() !== "");
    }, [configuredSuppliers]);

    // Mobile View
    if (isMobile) {
        return (
            <Card className="shadow-lg w-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Truck className="w-5 h-5 text-primary" />
                        {editingEntry ? 'Modifier' : 'Nouvelle'} Réception
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ReceptionForm
                        form={form}
                        onSubmit={handleFormSubmit}
                        isLoading={isLoading}
                        editingEntry={editingEntry}
                        onCancel={editingEntry ? handleCloseForm : undefined}
                        configuredSuppliers={validConfiguredSuppliers}
                    />
                </CardContent>
            </Card>
        );
    }
    
    // Desktop View
    return (
        <Card className="shadow-lg w-full">
            <CardHeader className="flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
    <div className="space-y-1.5">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Suivi de Réception
        </CardTitle>
        <CardDescription className="hidden md:block">
            Enregistrez ici les contrôles effectués à la réception des marchandises.
        </CardDescription>
    </div>
    <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={selectedDate.getMonth().toString()} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Mois" />
                </SelectTrigger>
                <SelectContent>
                    {months.map(month => (
                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={selectedDate.getFullYear().toString()} onValueChange={handleYearChange}>
                <SelectTrigger className="w-full sm:w-[100px]">
                    <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                    {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" /> Ajouter
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{editingEntry ? "Modifier" : "Nouvel"} Enregistrement de Réception</DialogTitle>
                </DialogHeader>
                <ReceptionForm
                    form={form}
                    onSubmit={handleFormSubmit}
                    isLoading={isLoading}
                    editingEntry={editingEntry}
                    onCancel={() => setIsDialogOpen(false)}
                    configuredSuppliers={validConfiguredSuppliers}
                />
            </DialogContent>
        </Dialog>
    </div>
</CardHeader>

            <CardContent>
                {isLoading && receptionEntries.length === 0 ? (
                    <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Chargement...</div>
                ) : !isLoading && receptionEntries.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Aucun enregistrement de réception. Cliquez sur "Ajouter" pour commencer.</p>
                ) : (
                    <div className="overflow-x-auto border rounded-md max-h-[65vh]">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-primary/10">
                                    <TableHead className="min-w-[120px]">Date et heure</TableHead>
                                    <TableHead className="min-w-[150px]">Fournisseur</TableHead>
                                    <TableHead className="min-w-[150px]">Produit</TableHead>
                                    <TableHead className="min-w-[150px]">Véhicule</TableHead>
                                    <TableHead className="min-w-[70px] text-center">T°C</TableHead>
                                    <TableHead className="min-w-[100px]">DLC/DLUO</TableHead>
                                    <TableHead className="min-w-[100px]">N° Lot</TableHead>
                                    <TableHead className="min-w-[120px]">Aspect</TableHead>
                                    <TableHead className="min-w-[80px]">Quantité</TableHead>
                                    <TableHead className="min-w-[120px]">Étiquetage</TableHead>
                                    <TableHead className="min-w-[100px]">Refusé</TableHead>
                                    <TableHead className="min-w'text-center">Visa</TableHead>
                                    <TableHead className="min-w-[110px] text-center sticky right-0 bg-primary/10 z-10">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {receptionEntries.map(entry => (
                                    <TableRow key={entry.id} className="group">
                                        <TableCell>{isValid(parseISO(entry.dateTime)) ? format(parseISO(entry.dateTime), "dd/MM/yy HH:mm", { locale: fr }) : 'Date invalide'}</TableCell>
                                        <TableCell>{entry.supplierName}</TableCell>
                                        <TableCell>{entry.productNameControlled}</TableCell>
                                        <TableCell>{entry.vehicleObservations}</TableCell>
                                        <TableCell className="text-center">{entry.productTemperature || '-'}</TableCell>
                                        <TableCell>{entry.dlcDluo || '-'}</TableCell>
                                        <TableCell>{entry.lotNumber || '-'}</TableCell>
                                        <TableCell>{entry.packagingAspect || '-'}</TableCell>
                                        <TableCell>{entry.quantity || '-'}</TableCell>
                                        <TableCell>{entry.productLabeling === 'conforme' ? 'Conforme' : entry.productLabeling === 'non_conforme' ? 'Non Conforme' : '-'}</TableCell>
                                        <TableCell className={cn(entry.refused && 'text-destructive font-semibold')}>
                                            {entry.refused ? `Oui${entry.refusalReason ? ` (${entry.refusalReason})` : ''}` : 'Non'}
                                        </TableCell>
                                        <TableCell className="text-center">{entry.visa || '-'}</TableCell>
                                        <TableCell className="text-center sticky right-0 bg-white dark:bg-card group-hover:bg-muted/50 transition-colors z-10">
                                            <div className="flex items-center justify-center gap-1">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="icon" className="h-7 w-7">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer cet enregistrement ?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Cette action est irréversible. L'enregistrement pour {entry.productNameControlled} du {isValid(parseISO(entry.dateTime)) ? format(parseISO(entry.dateTime), "dd/MM/yyyy", { locale: fr }) : 'Date invalide'} sera supprimé.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteEntry(entry.id)} disabled={isLoading}>
                                                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Supprimer
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                                <Button variant="outline" size="icon" onClick={() => handleOpenDialog(entry)} className="h-7 w-7"><Edit2 className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex flex-wrap justify-end gap-2 pt-4">
                <Button onClick={generatePdf} disabled={isLoading || receptionEntries.length === 0}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Générer PDF
                </Button>
                {receptionEntries.length > 0 && (
    <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isLoading}>
                <Trash2 className="mr-2 h-4 w-4" /> Supprimer le mois
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{`Confirmer la suppression pour ${format(selectedDate, 'MMMM yyyy', { locale: fr })} ?`}</AlertDialogTitle>
                <AlertDialogDescription>
                    Cette action est irréversible et supprimera tous les enregistrements pour le mois sélectionné.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAllEntries} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmer
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
)}

            </CardFooter>
        </Card>
    );
}

