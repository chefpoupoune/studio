
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { FryerMaintenanceLogEntry, FryerOilTpmLogEntry, LedTpmStatus } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Textarea removed as it's not used in the provided schemas
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, FileText, Loader2, Flame, CalendarIcon as LucideCalendarIcon, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const FIRESTORE_MAINTENANCE_COLLECTION = "pmsFryerMaintenanceLog";
const FIRESTORE_TPM_COLLECTION = "pmsFryerOilTpmLog";

// Schemas
const maintenanceLogSchema = z.object({
  useDate: z.date({ required_error: "Date d'utilisation requise." }),
  filterDate: z.date().optional().nullable(),
  filterSignature: z.string().optional(),
  cleaningDate: z.date().optional().nullable(),
  cleaningSignature: z.string().optional(),
  changeDate: z.date().optional().nullable(),
  changeSignature: z.string().optional(),
});
type MaintenanceLogFormData = z.infer<typeof maintenanceLogSchema>;

const tpmLogSchema = z.object({
  date: z.date({ required_error: "Date requise." }),
  operator: z.string().optional(),
  ledTpmStatus: z.custom<LedTpmStatus>((val) => ['lt_20', '20_24', 'gt_24', ''].includes(val as LedTpmStatus), { message: "Statut LED invalide."}),
  fryerIdentifier: z.string().min(1, "Identifiant friteuse requis."),
  tpmPercentage: z.string().optional(),
});
type TpmLogFormData = z.infer<typeof tpmLogSchema>;

export default function FryerOilOverallMonitoring() {
  const [maintenanceLog, setMaintenanceLog] = useState<FryerMaintenanceLogEntry[]>([]);
  const [tpmLog, setTpmLog] = useState<FryerOilTpmLogEntry[]>([]);

  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [editingMaintenanceEntry, setEditingMaintenanceEntry] = useState<FryerMaintenanceLogEntry | null>(null);
  
  const [isTpmDialogOpen, setIsTpmDialogOpen] = useState(false);
  const [editingTpmEntry, setEditingTpmEntry] = useState<FryerOilTpmLogEntry | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const maintenanceForm = useForm<MaintenanceLogFormData>({ resolver: zodResolver(maintenanceLogSchema) });
  const tpmForm = useForm<TpmLogFormData>({ 
    resolver: zodResolver(tpmLogSchema),
    defaultValues: {
      date: new Date(), operator: '', ledTpmStatus: '', fryerIdentifier: '', tpmPercentage: '',
    }
  });

  const fetchMaintenanceLogEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const entriesCollectionRef = collection(firestore, FIRESTORE_MAINTENANCE_COLLECTION);
      const q = query(entriesCollectionRef, orderBy("useDate", "desc"));
      const querySnapshot = await getDocs(q);
      const loadedEntries = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id, ...data,
          useDate: (data.useDate as Timestamp).toDate().toISOString(),
          filterDate: data.filterDate ? (data.filterDate as Timestamp).toDate().toISOString() : null,
          cleaningDate: data.cleaningDate ? (data.cleaningDate as Timestamp).toDate().toISOString() : null,
          changeDate: data.changeDate ? (data.changeDate as Timestamp).toDate().toISOString() : null,
        } as FryerMaintenanceLogEntry;
      });
      setMaintenanceLog(loadedEntries);
    } catch (error) {
      console.error("Error loading maintenance entries:", error);
      toast({ title: "Erreur chargement maintenance", variant: "destructive" });
      setMaintenanceLog([]);
    }
    setIsLoading(false);
  }, [toast]);

  const fetchTpmLogEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const entriesCollectionRef = collection(firestore, FIRESTORE_TPM_COLLECTION);
      const q = query(entriesCollectionRef, orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      const loadedEntries = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id, ...data,
          date: (data.date as Timestamp).toDate().toISOString(),
        } as FryerOilTpmLogEntry;
      });
      setTpmLog(loadedEntries);
    } catch (error) {
      console.error("Error loading TPM entries:", error);
      toast({ title: "Erreur chargement TPM", variant: "destructive" });
      setTpmLog([]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchMaintenanceLogEntries();
    fetchTpmLogEntries();
  }, [fetchMaintenanceLogEntries, fetchTpmLogEntries]);

  // Maintenance Log Handlers
  const handleOpenMaintenanceDialog = (entry?: FryerMaintenanceLogEntry) => {
    setEditingMaintenanceEntry(entry || null);
    maintenanceForm.reset(entry ? {
      ...entry,
      useDate: parseISO(entry.useDate),
      filterDate: entry.filterDate ? parseISO(entry.filterDate) : null,
      cleaningDate: entry.cleaningDate ? parseISO(entry.cleaningDate) : null,
      changeDate: entry.changeDate ? parseISO(entry.changeDate) : null,
    } : { 
      useDate: new Date(), filterDate: null, filterSignature: '',
      cleaningDate: null, cleaningSignature: '', changeDate: null, changeSignature: '',
    });
    setIsMaintenanceDialogOpen(true);
  };

  const handleMaintenanceFormSubmit = async (data: MaintenanceLogFormData) => {
    setIsLoading(true);
    const entryDataForFirestore = { 
      ...data, 
      useDate: Timestamp.fromDate(data.useDate),
      filterDate: data.filterDate ? Timestamp.fromDate(data.filterDate) : null,
      cleaningDate: data.cleaningDate ? Timestamp.fromDate(data.cleaningDate) : null,
      changeDate: data.changeDate ? Timestamp.fromDate(data.changeDate) : null,
      filterSignature: data.filterSignature || null,
      cleaningSignature: data.cleaningSignature || null,
      changeSignature: data.changeSignature || null,
    };

    try {
      if (editingMaintenanceEntry) {
        const entryDocRef = doc(firestore, FIRESTORE_MAINTENANCE_COLLECTION, editingMaintenanceEntry.id);
        await setDoc(entryDocRef, entryDataForFirestore);
        toast({ title: "Maintenance Modifiée" });
      } else {
        await addDoc(collection(firestore, FIRESTORE_MAINTENANCE_COLLECTION), entryDataForFirestore);
        toast({ title: "Maintenance Ajoutée" });
      }
      fetchMaintenanceLogEntries();
    } catch (error) {
      console.error("Error saving maintenance entry to Firestore:", error);
      toast({ title: "Erreur Sauvegarde Maintenance", variant: "destructive"});
    } finally {
      setIsLoading(false);
      setIsMaintenanceDialogOpen(false);
    }
  };

  const handleDeleteMaintenanceEntry = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteDoc(doc(firestore, FIRESTORE_MAINTENANCE_COLLECTION, id));
      toast({ title: "Entrée de Maintenance Supprimée", variant: "destructive" });
      fetchMaintenanceLogEntries();
    } catch (error) {
      console.error("Error deleting maintenance entry from Firestore:", error);
      toast({ title: "Erreur Suppression Maintenance", variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  };

  // TPM Log Handlers
  const handleOpenTpmDialog = (entry?: FryerOilTpmLogEntry) => {
    setEditingTpmEntry(entry || null);
    tpmForm.reset(entry ? { 
      ...entry, date: parseISO(entry.date),
      operator: entry.operator || '',
      fryerIdentifier: entry.fryerIdentifier || '',
      tpmPercentage: entry.tpmPercentage || '',
      ledTpmStatus: entry.ledTpmStatus || '',
     } : { 
      date: new Date(), operator: '', ledTpmStatus: '', fryerIdentifier: '', tpmPercentage: '',
     });
    setIsTpmDialogOpen(true);
  };

  const handleTpmFormSubmit = async (data: TpmLogFormData) => {
    setIsLoading(true);
    const entryDataForFirestore = { 
      ...data, 
      date: Timestamp.fromDate(data.date),
      operator: data.operator || null,
      fryerIdentifier: data.fryerIdentifier,
      tpmPercentage: data.tpmPercentage || null,
      ledTpmStatus: data.ledTpmStatus || null,
    };
    try {
      if (editingTpmEntry) {
        const entryDocRef = doc(firestore, FIRESTORE_TPM_COLLECTION, editingTpmEntry.id);
        await setDoc(entryDocRef, entryDataForFirestore);
        toast({ title: "Contrôle TPM Modifié" });
      } else {
        await addDoc(collection(firestore, FIRESTORE_TPM_COLLECTION), entryDataForFirestore);
        toast({ title: "Contrôle TPM Ajouté" });
      }
      fetchTpmLogEntries();
    } catch (error) {
      console.error("Error saving TPM entry to Firestore:", error);
      toast({ title: "Erreur Sauvegarde TPM", variant: "destructive"});
    } finally {
      setIsLoading(false);
      setIsTpmDialogOpen(false);
    }
  };

  const handleDeleteTpmEntry = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteDoc(doc(firestore, FIRESTORE_TPM_COLLECTION, id));
      toast({ title: "Contrôle TPM Supprimé", variant: "destructive" });
      fetchTpmLogEntries();
    } catch (error) {
      console.error("Error deleting TPM entry from Firestore:", error);
      toast({ title: "Erreur Suppression TPM", variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  };

  const generatePdf = (type: 'maintenance' | 'tpm') => {
    setIsLoading(true);
    try {
        const isMaintenance = type === 'maintenance';
        const dataToExport = isMaintenance ? maintenanceLog : tpmLog;
        const title = isMaintenance ? "Suivi Maintenance Friteuses" : "Suivi des Huiles (TPM)";
        const filenameSuffix = isMaintenance ? "Maintenance_Friteuses" : "Suivi_Huiles_TPM";
        const settingsKey = isMaintenance ? 'pms_fryer_maintenance_log' : 'pms_fryer_oil_tpm_log'; 

        if(dataToExport.length === 0) {
            toast({title: "Aucune donnée", description: `Aucune donnée à exporter pour ${title.toLowerCase()}.`, variant: "destructive"});
            setIsLoading(false);
            return;
        }

        const pdfSettings = getPdfLayoutSettings(settingsKey); 
        const doc = new jsPDF(isMaintenance ? 'landscape' : 'p') as jsPDFWithAutoTable;
        const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

        let currentY = 15;
        if (pdfSettings.headerText) { doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10; }
        if (pdfSettings.logoUrl) { doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY); currentY += 5; }
        
        doc.setFontSize(16); doc.text(title, 14, currentY); currentY += 8;
        doc.setFontSize(10); doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY); currentY += 7;

        const headStyles: any = { fontSize: 9, fontStyle: 'bold', halign: 'center', valign: 'middle' };
        if (pdfSettings.primaryColor) {
            const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
            if (primaryColorRgb) headStyles.fillColor = primaryColorRgb;
            const brightness = (hexToRgb(pdfSettings.primaryColor)![0] * 299 + hexToRgb(pdfSettings.primaryColor)![1] * 587 + hexToRgb(pdfSettings.primaryColor)![2] * 114) / 1000;
            headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        } else {
            headStyles.fillColor = [220,220,220];
            headStyles.textColor = [0,0,0];
        }

        let head: any[], body: any[][], columnStyles: any = {};
        
        if (isMaintenance) {
            head = [
                [
                    {content: "DATE D'UTILISATION DE LA FRITURE", rowSpan: 2, styles: headStyles},
                    {content: "FILTRATION DE L'HUILE", colSpan: 2, styles: headStyles},
                    {content: "NETTOYAGE DE LA FRITEUSE", colSpan: 2, styles: headStyles},
                    {content: "CHANGEMENT D'HUILE", colSpan: 2, styles: headStyles}
                ],
                [
                    {content: "Date", styles: headStyles}, {content: "Emargement", styles: headStyles},
                    {content: "Date", styles: headStyles}, {content: "Emargement", styles: headStyles},
                    {content: "Date", styles: headStyles}, {content: "Emargement", styles: headStyles}
                ]
            ];
            body = (dataToExport as FryerMaintenanceLogEntry[]).map(e => [
                format(parseISO(e.useDate), "dd/MM/yyyy", { locale: fr }),
                e.filterDate ? format(parseISO(e.filterDate), "dd/MM/yy") : '-', e.filterSignature || '-',
                e.cleaningDate ? format(parseISO(e.cleaningDate), "dd/MM/yy") : '-', e.cleaningSignature || '-',
                e.changeDate ? format(parseISO(e.changeDate), "dd/MM/yy") : '-', e.changeSignature || '-',
            ]);
            columnStyles = { 0: {cellWidth: 40}, 1:{cellWidth:30}, 2:{cellWidth:30}, 3:{cellWidth:30}, 4:{cellWidth:30}, 5:{cellWidth:30}, 6:{cellWidth:30}};
        } else { // TPM Log
            head = [["Date", "Opérateur", "LED TPM", "Friteuse N°", "% TPM"]];
            
            const ledStatusColors: Record<LedTpmStatus, {fill: [number,number,number], text: [number,number,number]}> = {
                'lt_20': { fill: [144, 238, 144], text: [0,0,0] }, 
                '20_24': { fill: [255, 249, 195], text: [0,0,0] }, 
                'gt_24': { fill: [254, 202, 202], text: [0,0,0] }, 
                '': { fill: [255,255,255], text: [0,0,0] } 
            };

            body = (dataToExport as FryerOilTpmLogEntry[]).map(e => {
                let ledDisplay = '';
                let cellStyle: {fillColor: [number,number,number], textColor: [number,number,number]} = { 
                    fillColor: ledStatusColors[''].fill, 
                    textColor: ledStatusColors[''].text
                };

                if (e.ledTpmStatus === 'lt_20') {
                    ledDisplay = '<20% (Vert)';
                    cellStyle = { fillColor: ledStatusColors.lt_20.fill, textColor: ledStatusColors.lt_20.text };
                } else if (e.ledTpmStatus === '20_24') {
                    ledDisplay = '20-24% (Jaune)';
                    cellStyle = { fillColor: ledStatusColors['20_24'].fill, textColor: ledStatusColors['20_24'].text };
                } else if (e.ledTpmStatus === 'gt_24') {
                    ledDisplay = '>24% (Rouge)';
                    cellStyle = { fillColor: ledStatusColors.gt_24.fill, textColor: ledStatusColors.gt_24.text };
                }
                return [
                    format(parseISO(e.date), "dd/MM/yyyy", { locale: fr }),
                    e.operator || '-',
                    { content: ledDisplay, styles: cellStyle },
                    e.fryerIdentifier,
                    e.tpmPercentage || '-'
                ];
            });
            columnStyles = { 0: {cellWidth:30}, 1:{cellWidth:30}, 2:{cellWidth:40}, 3:{cellWidth:30}, 4:{cellWidth:30}};
        }

        doc.autoTable({
            head, body, startY: currentY, theme: 'grid', styles: { fontSize: 8, cellPadding: 2 }, headStyles: headStyles, columnStyles: columnStyles,
            didDrawPage: (data) => { 
                const pageCount = doc.internal.getNumberOfPages();
                if (pdfSettings.footerText) {
                    let footerStr = pdfSettings.footerText
                    .replace('{date}', generationDateFormatted)
                    .replace('{pageNumber}', data.pageNumber.toString())
                    .replace('{totalPages}', pageCount.toString());
                    doc.setFontSize(9);
                    doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
                }
            }
        });
        doc.save(`PMS_${filenameSuffix}_${format(new Date(), "yyyyMMdd")}.pdf`);
        toast({ title: "PDF Généré", description: `Le PDF pour ${title.toLowerCase()} a été téléchargé.` });
    } catch (error) {
        console.error(`Error generating ${type} PDF:`, error);
        toast({ title: "Erreur PDF", description: `La génération du PDF ${type} a échoué.`, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
};

  const renderDateField = (formInstance: any, name: "useDate" | "filterDate" | "cleaningDate" | "changeDate" | "date", label: string) => (
    <FormField control={formInstance.control} name={name} render={({ field }) => (
      <FormItem className="flex flex-col">
        <FormLabel>{label}</FormLabel>
        <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
            {field.value ? format(field.value, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
            <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
        </Button></FormControl></PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value as Date | undefined} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent></Popover>
        <FormMessage />
      </FormItem>
    )} />
  );

  return (
    <div className="space-y-6">
      {/* Section 1: Suivi de Maintenance des Friteuses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Suivi de Maintenance des Friteuses
            <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
              <DialogTrigger asChild><Button onClick={() => handleOpenMaintenanceDialog()} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Ajouter Entrée</Button></DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{editingMaintenanceEntry ? "Modifier" : "Nouvelle"} Entrée de Maintenance</DialogTitle></DialogHeader>
                <Form {...maintenanceForm}>
                  <form onSubmit={maintenanceForm.handleSubmit(handleMaintenanceFormSubmit)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
                    {renderDateField(maintenanceForm, "useDate", "Date Utilisation Friture")}
                    <fieldset className="border p-3 rounded-md"><legend className="text-sm font-medium px-1">Filtration de l'Huile</legend>
                        <div className="grid grid-cols-2 gap-3">
                            {renderDateField(maintenanceForm, "filterDate", "Date Filtration")}
                            <FormField control={maintenanceForm.control} name="filterSignature" render={({ field }) => (<FormItem><FormLabel>Emargement</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </fieldset>
                    <fieldset className="border p-3 rounded-md"><legend className="text-sm font-medium px-1">Nettoyage de la Friteuse</legend>
                        <div className="grid grid-cols-2 gap-3">
                            {renderDateField(maintenanceForm, "cleaningDate", "Date Nettoyage")}
                            <FormField control={maintenanceForm.control} name="cleaningSignature" render={({ field }) => (<FormItem><FormLabel>Emargement</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </fieldset>
                     <fieldset className="border p-3 rounded-md"><legend className="text-sm font-medium px-1">Changement d'Huile</legend>
                        <div className="grid grid-cols-2 gap-3">
                            {renderDateField(maintenanceForm, "changeDate", "Date Changement")}
                            <FormField control={maintenanceForm.control} name="changeSignature" render={({ field }) => (<FormItem><FormLabel>Emargement</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </fieldset>
                    <DialogFooter className="pt-3"><DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose><Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingMaintenanceEntry ? "Enregistrer" : "Ajouter"}</Button></DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && maintenanceLog.length === 0 ? <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div> : maintenanceLog.length === 0 ? <p className="text-center text-muted-foreground">Aucune entrée de maintenance.</p> : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead rowSpan={2} className="text-center align-middle min-w-[120px]">DATE D'UTILISATION DE LA FRITURE</TableHead>
                    <TableHead colSpan={2} className="text-center">FILTRATION DE L'HUILE</TableHead>
                    <TableHead colSpan={2} className="text-center">NETTOYAGE DE LA FRITEUSE</TableHead>
                    <TableHead colSpan={2} className="text-center">CHANGEMENT D'HUILE</TableHead>
                    <TableHead rowSpan={2} className="text-center align-middle min-w-[100px]">Actions</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-center">Date</TableHead><TableHead className="text-center">Emargement</TableHead>
                    <TableHead className="text-center">Date</TableHead><TableHead className="text-center">Emargement</TableHead>
                    <TableHead className="text-center">Date</TableHead><TableHead className="text-center">Emargement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceLog.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-center">{format(parseISO(e.useDate), "dd/MM/yyyy", { locale: fr })}</TableCell>
                      <TableCell className="text-center">{e.filterDate ? format(parseISO(e.filterDate), "dd/MM/yy") : '-'}</TableCell><TableCell className="text-center">{e.filterSignature || '-'}</TableCell>
                      <TableCell className="text-center">{e.cleaningDate ? format(parseISO(e.cleaningDate), "dd/MM/yy") : '-'}</TableCell><TableCell className="text-center">{e.cleaningSignature || '-'}</TableCell>
                      <TableCell className="text-center">{e.changeDate ? format(parseISO(e.changeDate), "dd/MM/yy") : '-'}</TableCell><TableCell className="text-center">{e.changeSignature || '-'}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger>
                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer cette entrée de maintenance?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteMaintenanceEntry(e.id)} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                        <Button variant="outline" size="icon" onClick={() => handleOpenMaintenanceDialog(e)} className="h-7 w-7" disabled={isLoading}><Edit2 className="h-3.5 w-3.5"/></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {maintenanceLog.length > 0 && <div className="mt-4 flex justify-end"><Button onClick={() => generatePdf('maintenance')} size="sm" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>} Générer PDF</Button></div>}
        </CardContent>
      </Card>

      {/* Section 2: Suivi des Huiles (TPM) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Suivi des Huiles (Contrôle TPM)
            <Dialog open={isTpmDialogOpen} onOpenChange={setIsTpmDialogOpen}>
              <DialogTrigger asChild><Button onClick={() => handleOpenTpmDialog()} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Ajouter Contrôle</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>{editingTpmEntry ? "Modifier" : "Nouveau"} Contrôle TPM</DialogTitle></DialogHeader>
                <Form {...tpmForm}>
                  <form onSubmit={tpmForm.handleSubmit(handleTpmFormSubmit)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
                    {renderDateField(tpmForm, "date", "Date du Contrôle")}
                    <FormField control={tpmForm.control} name="operator" render={({ field }) => (<FormItem><FormLabel>Opérateur</FormLabel><FormControl><Input placeholder="Initiales" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={tpmForm.control} name="fryerIdentifier" render={({ field }) => (<FormItem><FormLabel>Friteuse N°/Nom</FormLabel><FormControl><Input placeholder="Ex: 1, Gauche" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={tpmForm.control} name="tpmPercentage" render={({ field }) => (<FormItem><FormLabel>% TPM</FormLabel><FormControl><Input placeholder="Ex: 22%" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={tpmForm.control} name="ledTpmStatus" render={({ field }) => (
                        <FormItem><FormLabel>Indicateur LED TPM</FormLabel><FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-2 pt-1">
                                <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="lt_20" /></FormControl><FormLabel className="text-xs font-normal px-2 py-1 rounded bg-green-500 text-white">&lt;20%</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="20_24" /></FormControl><FormLabel className="text-xs font-normal px-2 py-1 rounded bg-yellow-400 text-black">20-24%</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="gt_24" /></FormControl><FormLabel className="text-xs font-normal px-2 py-1 rounded bg-red-500 text-white">&gt;24%</FormLabel></FormItem>
                            </RadioGroup>
                        </FormControl><FormMessage /></FormItem>
                    )} />
                    <DialogFooter className="pt-3"><DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose><Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingTpmEntry ? "Enregistrer" : "Ajouter"}</Button></DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardTitle>
          <CardDescription>Légende TPM: <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-green-500 text-white">Conservation</span> / <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-yellow-400 text-black">Surveillance</span> / <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-red-500 text-white">Changement</span></CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading && tpmLog.length === 0 ? <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div> : tpmLog.length === 0 ? <p className="text-center text-muted-foreground">Aucun contrôle TPM enregistré.</p> : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Date</TableHead><TableHead className="text-center">Opérateur</TableHead>
                    <TableHead className="text-center">LED TPM</TableHead><TableHead className="text-center">Friteuse N°</TableHead>
                    <TableHead className="text-center">% TPM</TableHead><TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tpmLog.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-center">{format(parseISO(e.date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                      <TableCell className="text-center">{e.operator || '-'}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center space-x-1">
                            <span className={cn("w-4 h-4 rounded-sm border border-gray-400 inline-flex items-center justify-center", e.ledTpmStatus === 'lt_20' && "bg-green-500 ring-2 ring-offset-1 ring-black")}>{e.ledTpmStatus === 'lt_20' && <Check className="h-3 w-3 text-white"/>}</span>
                            <span className={cn("w-4 h-4 rounded-sm border border-gray-400 inline-flex items-center justify-center", e.ledTpmStatus === '20_24' && "bg-yellow-400 ring-2 ring-offset-1 ring-black")}>{e.ledTpmStatus === '20_24' && <Check className="h-3 w-3 text-black"/>}</span>
                            <span className={cn("w-4 h-4 rounded-sm border border-gray-400 inline-flex items-center justify-center", e.ledTpmStatus === 'gt_24' && "bg-red-500 ring-2 ring-offset-1 ring-black")}>{e.ledTpmStatus === 'gt_24' && <Check className="h-3 w-3 text-white"/>}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{e.fryerIdentifier}</TableCell>
                      <TableCell className="text-center">{e.tpmPercentage || '-'}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger>
                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer ce contrôle TPM?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTpmEntry(e.id)} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                        <Button variant="outline" size="icon" onClick={() => handleOpenTpmDialog(e)} className="h-7 w-7" disabled={isLoading}><Edit2 className="h-3.5 w-3.5"/></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {tpmLog.length > 0 && <div className="mt-4 flex justify-end"><Button onClick={() => generatePdf('tpm')} size="sm" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>} Générer PDF</Button></div>}
        </CardContent>
      </Card>
    </div>
  );
}
    
