
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ReceptionEntry, PmsSupplierDefinition, PmsConfigurations } from '../types'; // Updated PmsZone alias
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  getDoc
} from 'firebase/firestore';
import { PMS_SUPPLIER_MANAGEMENT_KEY } from '@/app/dashboard/settings/types'; 

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

export default function ReceptionMonitoring() {
  const [receptionEntries, setReceptionEntries] = useState<ReceptionEntry[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ReceptionEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  const fetchReceptionEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const entriesCollectionRef = collection(firestore, FIRESTORE_COLLECTION);
      const q = query(entriesCollectionRef, orderBy("dateTime", "desc"));
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
  }, [toast]);

  useEffect(() => {
    loadSuppliersFromPmsConfig();
    fetchReceptionEntries();
    
    const handlePmsConfigUpdated = () => {
        console.log("[ReceptionMonitoring] pmsConfigUpdated event received. Reloading suppliers.");
        loadSuppliersFromPmsConfig();
    };
    window.addEventListener('pmsConfigUpdated', handlePmsConfigUpdated);
    return () => window.removeEventListener('pmsConfigUpdated', handlePmsConfigUpdated);

  }, [loadSuppliersFromPmsConfig, fetchReceptionEntries]);

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
      toast({ title: "Erreur de Sauvegarde", variant: "destructive"});
    } finally {
      setIsLoading(false);
      setIsDialogOpen(false);
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
      toast({ title: "Erreur de Suppression", variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  };

  const generatePdf = () => {
    if (receptionEntries.length === 0) {
      toast({ title: "Aucune Donnée", description: "Aucun enregistrement de réception à exporter.", variant: "destructive"});
      return;
    }
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('pms_reception_monitoring'); 
      const doc = new jsPDF({ 
        orientation: 'landscape', 
        unit: 'pt', 
        format: pdfSettings.pageSize || 'a4',
      }) as jsPDFWithAutoTable;
      doc.setFont(pdfSettings.fontFamily || 'helvetica');
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = pdfSettings.marginTop || 40;
      if (pdfSettings.headerText) { doc.setFontSize(pdfSettings.headerFontSize || 10); doc.text(pdfSettings.headerText, pdfSettings.marginLeft || 40, currentY); currentY += (pdfSettings.headerFontSize || 10) + 5; }
      if (pdfSettings.logoUrl) { doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, pdfSettings.marginLeft || 40, currentY); currentY += 5; }
      
      doc.setFontSize(pdfSettings.documentTitleFontSize || 16); doc.text("Suivi de Réception des Marchandises", pdfSettings.marginLeft || 40, currentY); currentY += (pdfSettings.documentTitleFontSize || 16) * 0.7 + 5;
      doc.setFontSize(pdfSettings.defaultFontSize || 10); doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft || 40, currentY); currentY += (pdfSettings.defaultFontSize || 10) + 7;

      const headStyles: any = { fontSize: pdfSettings.tableHeaderFontSize || 7, fontStyle: 'bold', halign: 'center', valign: 'middle', cellPadding: 1 };
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      } else {
        headStyles.fillColor = [144, 202, 249]; 
        headStyles.textColor = [0,0,0];
      }

      const head = [
        [
          { content: 'Date et heure', rowSpan: 2, styles: headStyles },
          { content: 'Nom du fournisseur', rowSpan: 2, styles: headStyles },
          { content: 'Dénomination du produit contrôlé', rowSpan: 2, styles: headStyles },
          { content: 'Véhicule: propreté température', rowSpan: 2, styles: headStyles },
          { content: 'Produits', colSpan: 6, styles: headStyles },
          { content: 'Refusé', rowSpan: 2, styles: headStyles },
          { content: 'Visa', rowSpan: 2, styles: headStyles },
        ],
        [
          { content: 'T° C', styles: headStyles },
          { content: 'DLC DLUO', styles: headStyles },
          { content: 'N° du lot', styles: headStyles },
          { content: 'Aspect et emballage', styles: headStyles },
          { content: 'Quantité', styles: headStyles },
          { content: 'Étiquetage Du produit', styles: headStyles },
        ]
      ];
      
      const body = receptionEntries.map(entry => [
        format(parseISO(entry.dateTime), "dd/MM/yy HH:mm", { locale: fr }),
        entry.supplierName,
        entry.productNameControlled,
        entry.vehicleObservations || '-',
        entry.productTemperature || '-',
        entry.dlcDluo || '-',
        entry.lotNumber || '-',
        entry.packagingAspect || '-',
        entry.quantity || '-',
        entry.productLabeling === 'conforme' ? 'Conforme' : entry.productLabeling === 'non_conforme' ? 'Non Conforme' : '-',
        entry.refused ? `Oui${entry.refusalReason ? ` (${entry.refusalReason})` : ''}` : 'Non',
        entry.visa || '-',
      ]);

      doc.autoTable({
        head: head,
        body: body,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: pdfSettings.tableBodyFontSize || 6.5, cellPadding: 1, valign: 'middle', font: pdfSettings.fontFamily || 'helvetica', overflow: 'linebreak' },
        headStyles: headStyles, 
        columnStyles: { 
          0: { cellWidth: 55, halign: 'center' },     // Date et heure
          1: { cellWidth: 100, halign: 'left' },     // Nom du fournisseur
          2: { cellWidth: 100, halign: 'left' },     // Dénomination du produit contrôlé
          3: { cellWidth: 80, halign: 'left' },      // Véhicule: propreté température
          4: { cellWidth: 30, halign: 'center' },     // Produits T° C
          5: { cellWidth: 50, halign: 'center' },     // Produits DLC DLUO
          6: { cellWidth: 50, halign: 'center' },     // Produits N° du lot
          7: { cellWidth: 80, halign: 'left' },      // Produits Aspect et emballage
          8: { cellWidth: 40, halign: 'center' },     // Produits Quantité
          9: { cellWidth: 50, halign: 'center' },     // Produits Étiquetage Du produit
          10: { cellWidth: 80, halign: 'left' },     // Refusé
          11: { cellWidth: 30, halign: 'center' },    // Visa
        },
        tableWidth: 'auto', 
        margin: {
          top: pdfSettings.marginTop || 40,
          right: pdfSettings.marginRight || 40,
          bottom: pdfSettings.marginBottom || 40,
          left: pdfSettings.marginLeft || 40,
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
            doc.setFontSize(pdfSettings.footerFontSize || 9); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - ((pdfSettings.marginBottom || 40) / 2));
          }
        },
      });
      doc.save(`Suivi_Reception_Marchandises_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast({ title: "PDF Généré", description: "Le PDF du suivi des réceptions a été téléchargé." });
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

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Truck className="w-6 h-6 text-primary"/>
                Suivi de Réception des Marchandises
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/> Ajouter Réception</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl md:max-w-3xl"> 
                <DialogHeader><DialogTitle>{editingEntry ? "Modifier" : "Nouvel"} Enregistrement de Réception</DialogTitle></DialogHeader>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField control={form.control} name="dateTime" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Date et Heure</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "dd/MM/yyyy HH:mm", { locale: fr }) : <span>Choisir date et heure</span>}
                            <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button></FormControl></PopoverTrigger>
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
                        </PopoverContent></Popover><FormMessage /></FormItem>
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
                                {validConfiguredSuppliers.length > 0 ? validConfiguredSuppliers.map(supplier => (
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
                    <FormField control={form.control} name="vehicleObservations" render={({ field }) => (<FormItem><FormLabel>Véhicule (propreté, température)</FormLabel><FormControl><Textarea placeholder="Ex: Camion propre, température ok" {...field} rows={2} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <h4 className="text-md font-semibold pt-2 border-t mt-3">Détails Produits</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField control={form.control} name="productTemperature" render={({ field }) => (<FormItem><FormLabel>T° C Produit</FormLabel><FormControl><Input placeholder="Ex: 3°C" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="dlcDluo" render={({ field }) => (<FormItem><FormLabel>DLC / DLUO</FormLabel><FormControl><Input placeholder="Ex: 25/12/2024" {...field} value={field.value || ''}/></FormControl><FormMessage /></FormItem>)} />
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
                    <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingEntry ? "Enregistrer Modifications" : "Ajouter Réception"}</Button>
                    </DialogFooter>
                </form>
                </Form>
            </DialogContent>
            </Dialog>
        </CardTitle>
        <CardDescription>
          Enregistrez ici les contrôles effectués à la réception des marchandises.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && receptionEntries.length === 0 ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Chargement...</div>
        ) : !isLoading && receptionEntries.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Aucun enregistrement de réception. Cliquez sur "Ajouter Réception" pour commencer.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10">
                  <TableHead className="min-w-[120px]">Date et heure</TableHead>
                  <TableHead className="min-w-[150px]">Fournisseur</TableHead>
                  <TableHead className="min-w-[150px]">Produit Contrôlé</TableHead>
                  <TableHead className="min-w-[150px]">Véhicule</TableHead>
                  <TableHead className="min-w-[70px] text-center">T°C</TableHead>
                  <TableHead className="min-w-[100px]">DLC/DLUO</TableHead>
                  <TableHead className="min-w-[100px]">N° Lot</TableHead>
                  <TableHead className="min-w-[120px]">Aspect/Emballage</TableHead>
                  <TableHead className="min-w-[80px]">Quantité</TableHead>
                  <TableHead className="min-w-[120px]">Étiquetage</TableHead>
                  <TableHead className="min-w-[100px]">Refusé</TableHead>
                  <TableHead className="min-w-[70px] text-center">Visa</TableHead>
                  <TableHead className="min-w-[100px] text-center sticky right-0 bg-primary/10">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receptionEntries.map(entry => (
                  <TableRow key={entry.id}>
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
                    <TableCell className={entry.refused ? 'text-destructive font-semibold' : ''}>
                      {entry.refused ? `Oui${entry.refusalReason ? ` (${entry.refusalReason})` : ''}` : 'Non'}
                    </TableCell>
                    <TableCell className="text-center">{entry.visa || '-'}</TableCell>
                    <TableCell className="text-center sticky right-0 bg-card group-hover:bg-muted/50 transition-colors">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" className="h-7 w-7">
                            <Trash2 className="h-4 w-4"/>
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
                              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(entry)} className="ml-1 h-7 w-7"><Edit2 className="h-4 w-4"/></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {receptionEntries.length > 0 && (
             <div className="mt-6 flex justify-end">
                <Button onClick={generatePdf} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>}
                    Générer PDF du Suivi
                </Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
