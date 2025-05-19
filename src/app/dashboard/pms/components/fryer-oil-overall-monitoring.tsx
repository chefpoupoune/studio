
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { FryerMaintenanceLogEntry, FryerOilTpmLogEntry, LedTpmStatus } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, FileText, Loader2, Flame, CalendarIcon as LucideCalendarIcon, Check } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parse, parseISO, isValid } from 'date-fns';
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

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const FRYER_MAINTENANCE_LOG_KEY = "pms_fryer_maintenance_log_v1";
const FRYER_OIL_TPM_LOG_KEY = "pms_fryer_oil_tpm_log_v1";

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
  ledTpmStatus: z.custom<LedTpmStatus>((val) => ['lt_20', '20_24', 'gt_24', ''].includes(val as LedTpmStatus), "Statut LED invalide."),
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
  const tpmForm = useForm<TpmLogFormData>({ resolver: zodResolver(tpmLogSchema) });

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedMaintenance = localStorage.getItem(FRYER_MAINTENANCE_LOG_KEY);
      if (storedMaintenance) setMaintenanceLog(JSON.parse(storedMaintenance));
      const storedTpm = localStorage.getItem(FRYER_OIL_TPM_LOG_KEY);
      if (storedTpm) setTpmLog(JSON.parse(storedTpm));
    } catch (error) {
      console.error("Error loading fryer/oil logs:", error);
      toast({ title: "Erreur de chargement", description: "Données friteuse/huiles corrompues.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => { if (!isLoading) localStorage.setItem(FRYER_MAINTENANCE_LOG_KEY, JSON.stringify(maintenanceLog)); }, [maintenanceLog, isLoading]);
  useEffect(() => { if (!isLoading) localStorage.setItem(FRYER_OIL_TPM_LOG_KEY, JSON.stringify(tpmLog)); }, [tpmLog, isLoading]);

  // Maintenance Log Handlers
  const handleOpenMaintenanceDialog = (entry?: FryerMaintenanceLogEntry) => {
    setEditingMaintenanceEntry(entry || null);
    maintenanceForm.reset(entry ? {
      ...entry,
      useDate: parseISO(entry.useDate),
      filterDate: entry.filterDate ? parseISO(entry.filterDate) : null,
      cleaningDate: entry.cleaningDate ? parseISO(entry.cleaningDate) : null,
      changeDate: entry.changeDate ? parseISO(entry.changeDate) : null,
    } : { useDate: new Date() });
    setIsMaintenanceDialogOpen(true);
  };

  const handleMaintenanceFormSubmit = (data: MaintenanceLogFormData) => {
    const entryData = { 
      ...data, 
      useDate: data.useDate.toISOString(),
      filterDate: data.filterDate ? data.filterDate.toISOString() : null,
      cleaningDate: data.cleaningDate ? data.cleaningDate.toISOString() : null,
      changeDate: data.changeDate ? data.changeDate.toISOString() : null,
    };
    if (editingMaintenanceEntry) {
      setMaintenanceLog(prev => prev.map(e => e.id === editingMaintenanceEntry.id ? { ...editingMaintenanceEntry, ...entryData } : e));
      toast({ title: "Maintenance Modifiée" });
    } else {
      setMaintenanceLog(prev => [{ ...entryData, id: `maint_${Date.now()}` }, ...prev].sort((a,b) => new Date(b.useDate).getTime() - new Date(a.useDate).getTime()));
      toast({ title: "Maintenance Ajoutée" });
    }
    setIsMaintenanceDialogOpen(false);
  };

  const handleDeleteMaintenanceEntry = (id: string) => {
    setMaintenanceLog(prev => prev.filter(e => e.id !== id));
    toast({ title: "Entrée de Maintenance Supprimée", variant: "destructive" });
  };

  // TPM Log Handlers
  const handleOpenTpmDialog = (entry?: FryerOilTpmLogEntry) => {
    setEditingTpmEntry(entry || null);
    tpmForm.reset(entry ? { ...entry, date: parseISO(entry.date) } : { date: new Date(), ledTpmStatus: '', fryerIdentifier: '' });
    setIsTpmDialogOpen(true);
  };

  const handleTpmFormSubmit = (data: TpmLogFormData) => {
    const entryData = { ...data, date: data.date.toISOString() };
    if (editingTpmEntry) {
      setTpmLog(prev => prev.map(e => e.id === editingTpmEntry.id ? { ...editingTpmEntry, ...entryData } : e));
      toast({ title: "Contrôle TPM Modifié" });
    } else {
      setTpmLog(prev => [{ ...entryData, id: `tpm_${Date.now()}` }, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      toast({ title: "Contrôle TPM Ajouté" });
    }
    setIsTpmDialogOpen(false);
  };

  const handleDeleteTpmEntry = (id: string) => {
    setTpmLog(prev => prev.filter(e => e.id !== id));
    toast({ title: "Contrôle TPM Supprimé", variant: "destructive" });
  };

  const generatePdf = (type: 'maintenance' | 'tpm') => {
    setIsLoading(true);
    try {
        const isMaintenance = type === 'maintenance';
        const dataToExport = isMaintenance ? maintenanceLog : tpmLog;
        const title = isMaintenance ? "Suivi Maintenance Friteuses" : "Suivi des Huiles (TPM)";
        const filenameSuffix = isMaintenance ? "Maintenance_Friteuses" : "Suivi_Huiles_TPM";
        const settingsKey = isMaintenance ? 'pms_fryer_maintenance_log' : 'pms_fryer_oil_tpm_log'; // Example keys for pdf-settings

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
            headStyles.textColor = (hexToRgb(pdfSettings.primaryColor)![0] * 299 + hexToRgb(pdfSettings.primaryColor)![1] * 587 + hexToRgb(pdfSettings.primaryColor)![2] * 114) / 1000 > 125 ? [0,0,0] : [255,255,255];
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
                e.filterDate ? format(parseISO(e.filterDate), "dd/MM/yyyy", { locale: fr }) : '-', e.filterSignature || '-',
                e.cleaningDate ? format(parseISO(e.cleaningDate), "dd/MM/yyyy", { locale: fr }) : '-', e.cleaningSignature || '-',
                e.changeDate ? format(parseISO(e.changeDate), "dd/MM/yyyy", { locale: fr }) : '-', e.changeSignature || '-',
            ]);
            columnStyles = { 0: {cellWidth: 40}, 1:{cellWidth:30}, 2:{cellWidth:30}, 3:{cellWidth:30}, 4:{cellWidth:30}, 5:{cellWidth:30}, 6:{cellWidth:30}};
        } else { // TPM Log
            head = [["Date", "Opérateur", "LED TPM", "Friteuse N°", "% TPM"]];
            body = (dataToExport as FryerOilTpmLogEntry[]).map(e => {
                let ledDisplay = '';
                if (e.ledTpmStatus === 'lt_20') ledDisplay = '<20% (Vert)';
                else if (e.ledTpmStatus === '20_24') ledDisplay = '20-24% (Jaune)';
                else if (e.ledTpmStatus === 'gt_24') ledDisplay = '>24% (Rouge)';
                return [
                    format(parseISO(e.date), "dd/MM/yyyy", { locale: fr }),
                    e.operator || '-',
                    ledDisplay,
                    e.fryerIdentifier,
                    e.tpmPercentage || '-'
                ];
            });
            columnStyles = { 0: {cellWidth:30}, 1:{cellWidth:30}, 2:{cellWidth:40}, 3:{cellWidth:30}, 4:{cellWidth:30}};
        }

        doc.autoTable({
            head, body, startY: currentY, theme: 'grid', styles: { fontSize: 8, cellPadding: 2 }, headStyles: headStyles, columnStyles: columnStyles,
            didDrawPage: (data) => { /* Footer logic */ }
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

  const renderDateField = (form: any, name: "useDate" | "filterDate" | "cleaningDate" | "changeDate" | "date") => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className="flex flex-col">
        <FormLabel>{name.startsWith("use") ? "Date Utilisation" : name.startsWith("filter") ? "Date Filtration" : name.startsWith("cleaning") ? "Date Nettoyage" : name.startsWith("change") ? "Date Changement" : "Date"}</FormLabel>
        <Popover>
          <PopoverTrigger asChild>
            <FormControl>
              <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                {field.value ? format(field.value, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
                <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </FormControl>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value as Date | undefined} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent>
        </Popover>
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
                    {renderDateField(maintenanceForm, "useDate")}
                    <fieldset className="border p-3 rounded-md"><legend className="text-sm font-medium px-1">Filtration de l'Huile</legend>
                        <div className="grid grid-cols-2 gap-3">
                            {renderDateField(maintenanceForm, "filterDate")}
                            <FormField control={maintenanceForm.control} name="filterSignature" render={({ field }) => (<FormItem><FormLabel>Emargement</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </fieldset>
                    <fieldset className="border p-3 rounded-md"><legend className="text-sm font-medium px-1">Nettoyage de la Friteuse</legend>
                        <div className="grid grid-cols-2 gap-3">
                            {renderDateField(maintenanceForm, "cleaningDate")}
                            <FormField control={maintenanceForm.control} name="cleaningSignature" render={({ field }) => (<FormItem><FormLabel>Emargement</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </fieldset>
                     <fieldset className="border p-3 rounded-md"><legend className="text-sm font-medium px-1">Changement d'Huile</legend>
                        <div className="grid grid-cols-2 gap-3">
                            {renderDateField(maintenanceForm, "changeDate")}
                            <FormField control={maintenanceForm.control} name="changeSignature" render={({ field }) => (<FormItem><FormLabel>Emargement</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </fieldset>
                    <DialogFooter className="pt-3"><DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose><Button type="submit">{editingMaintenanceEntry ? "Enregistrer" : "Ajouter"}</Button></DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Loader2/> : maintenanceLog.length === 0 ? <p className="text-center text-muted-foreground">Aucune entrée de maintenance.</p> : (
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
                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer cette entrée de maintenance?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteMaintenanceEntry(e.id)}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                        <Button variant="outline" size="icon" onClick={() => handleOpenMaintenanceDialog(e)} className="h-7 w-7"><Edit2 className="h-3.5 w-3.5"/></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {maintenanceLog.length > 0 && <div className="mt-4 flex justify-end"><Button onClick={() => generatePdf('maintenance')} size="sm" disabled={isLoading}>{isLoading ? <Loader2 /> : <FileText />} Générer PDF</Button></div>}
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
                    {renderDateField(tpmForm, "date")}
                    <FormField control={tpmForm.control} name="operator" render={({ field }) => (<FormItem><FormLabel>Opérateur</FormLabel><FormControl><Input placeholder="Initiales" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={tpmForm.control} name="fryerIdentifier" render={({ field }) => (<FormItem><FormLabel>Friteuse N°/Nom</FormLabel><FormControl><Input placeholder="Ex: 1, Gauche" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={tpmForm.control} name="tpmPercentage" render={({ field }) => (<FormItem><FormLabel>% TPM</FormLabel><FormControl><Input placeholder="Ex: 22%" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={tpmForm.control} name="ledTpmStatus" render={({ field }) => (
                        <FormItem><FormLabel>Indicateur LED TPM</FormLabel><FormControl>
                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-2 pt-1">
                                <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="lt_20" /></FormControl><FormLabel className="text-xs font-normal px-2 py-1 rounded bg-green-500 text-white">&lt;20%</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="20_24" /></FormControl><FormLabel className="text-xs font-normal px-2 py-1 rounded bg-yellow-400 text-black">20-24%</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="gt_24" /></FormControl><FormLabel className="text-xs font-normal px-2 py-1 rounded bg-red-500 text-white">&gt;24%</FormLabel></FormItem>
                            </RadioGroup>
                        </FormControl><FormMessage /></FormItem>
                    )} />
                    <DialogFooter className="pt-3"><DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose><Button type="submit">{editingTpmEntry ? "Enregistrer" : "Ajouter"}</Button></DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardTitle>
          <CardDescription>Légende TPM: <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-green-500 text-white">Conservation</span> / <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-yellow-400 text-black">Surveillance</span> / <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-red-500 text-white">Changement</span></CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading ? <Loader2/> : tpmLog.length === 0 ? <p className="text-center text-muted-foreground">Aucun contrôle TPM enregistré.</p> : (
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
                            <span className={cn("w-4 h-4 rounded-sm border border-gray-400", e.ledTpmStatus === 'lt_20' && "bg-green-500 ring-2 ring-offset-1 ring-black")}></span>
                            <span className={cn("w-4 h-4 rounded-sm border border-gray-400", e.ledTpmStatus === '20_24' && "bg-yellow-400 ring-2 ring-offset-1 ring-black")}></span>
                            <span className={cn("w-4 h-4 rounded-sm border border-gray-400", e.ledTpmStatus === 'gt_24' && "bg-red-500 ring-2 ring-offset-1 ring-black")}></span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{e.fryerIdentifier}</TableCell>
                      <TableCell className="text-center">{e.tpmPercentage || '-'}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger>
                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer ce contrôle TPM?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTpmEntry(e.id)}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                        <Button variant="outline" size="icon" onClick={() => handleOpenTpmDialog(e)} className="h-7 w-7"><Edit2 className="h-3.5 w-3.5"/></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {tpmLog.length > 0 && <div className="mt-4 flex justify-end"><Button onClick={() => generatePdf('tpm')} size="sm" disabled={isLoading}>{isLoading ? <Loader2 /> : <FileText />} Générer PDF</Button></div>}
        </CardContent>
      </Card>
    </div>
  );
}
