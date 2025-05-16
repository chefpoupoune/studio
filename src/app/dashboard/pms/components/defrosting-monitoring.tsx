
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { DefrostingEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, FileText, Loader2, Snowflake, CalendarIcon as LucideCalendarIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
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

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const DEFROSTING_LOG_STORAGE_KEY = "pms_defrosting_log_v1";

const defrostingEntrySchema = z.object({
  defrostStartDate: z.date({ required_error: "Date de début de décongélation requise." }),
  defrostStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:MM requis."),
  productName: z.string().min(1, "Nom du produit requis."),
  quantity: z.string().min(1, "Quantité requise."),
  tempOnRemoval: z.string().optional(),
  initialsStart: z.string().optional(),
  
  useDate: z.date().optional().nullable(),
  useTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Format HH:MM requis."}).optional().or(z.literal('')),
  tempOnUse: z.string().optional(),
  initialsEnd: z.string().optional(),
}).refine(data => {
    if (data.useDate && !data.useTime) return false; 
    return true;
}, { message: "L'heure d'utilisation est requise si la date d'utilisation est définie.", path: ['useTime']});

type DefrostingFormData = z.infer<typeof defrostingEntrySchema>;

export default function DefrostingMonitoring() {
  const [entries, setEntries] = useState<DefrostingEntry[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DefrostingEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<DefrostingFormData>({
    resolver: zodResolver(defrostingEntrySchema),
    defaultValues: {
      defrostStartDate: new Date(),
      defrostStartTime: format(new Date(), 'HH:mm'),
      productName: '',
      quantity: '',
    },
  });

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedEntries = localStorage.getItem(DEFROSTING_LOG_STORAGE_KEY);
      if (storedEntries) {
        setEntries(JSON.parse(storedEntries));
      }
    } catch (error) {
      console.error("Error loading defrosting entries:", error);
      toast({ title: "Erreur de chargement", description: "Données de décongélation corrompues.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(DEFROSTING_LOG_STORAGE_KEY, JSON.stringify(entries));
    }
  }, [entries, isLoading]);

  const handleOpenDialog = (entry?: DefrostingEntry) => {
    setEditingEntry(entry || null);
    if (entry) {
      form.reset({
        ...entry,
        defrostStartDate: entry.defrostStartDate ? parseISO(entry.defrostStartDate) : new Date(),
        defrostStartTime: entry.defrostStartTime || format(new Date(), 'HH:mm'),
        useDate: entry.useDate ? parseISO(entry.useDate) : null,
        useTime: entry.useTime || '',
      });
    } else {
      form.reset({
        defrostStartDate: new Date(), defrostStartTime: format(new Date(), 'HH:mm'), productName: '', quantity: '',
        tempOnRemoval: '', initialsStart: '',
        useDate: null, useTime: '', tempOnUse: '', initialsEnd: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleFormSubmit = (data: DefrostingFormData) => {
    const entryData = { 
      ...data, 
      defrostStartDate: data.defrostStartDate.toISOString(),
      useDate: data.useDate ? data.useDate.toISOString() : null,
      useTime: data.useTime || null,
    };
    if (editingEntry) {
      setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...editingEntry, ...entryData } : e));
      toast({ title: "Enregistrement Modifié", description: "L'entrée de décongélation a été mise à jour." });
    } else {
      const newEntry: DefrostingEntry = { ...entryData, id: `defrost_${Date.now()}` };
      setEntries(prev => [newEntry, ...prev].sort((a,b) => new Date(b.defrostStartDate).getTime() - new Date(a.defrostStartDate).getTime()));
      toast({ title: "Enregistrement Ajouté", description: "Une nouvelle entrée de décongélation a été ajoutée." });
    }
    setIsDialogOpen(false);
  };

  const handleDeleteEntry = (entryId: string) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
    toast({ title: "Enregistrement Supprimé", variant: "destructive" });
  };
  
  const generatePdf = () => {
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('pms_defrosting_monitoring'); 
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable; 
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) { doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10; }
      if (pdfSettings.logoUrl) { doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY); currentY += 5; }
      
      doc.setFontSize(16); doc.text("Suivi de Décongélation", 14, currentY); currentY += 8;
      doc.setFontSize(10); doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY); currentY += 7;

      const headStylesBase = { fontSize: 8, fontStyle: 'bold', halign: 'center', valign: 'middle', cellPadding: 1, textColor: [0,0,0] }; // Changed text color to black
      
      const head: any[] = [
        [
          { content: 'Date', styles: {...headStylesBase, fillColor: hexToRgb('#4A86E8')} }, 
          { content: 'Produit', styles: {...headStylesBase, fillColor: hexToRgb('#4A86E8')} },
          { content: 'Quantité', styles: {...headStylesBase, fillColor: hexToRgb('#4A86E8')} },
          { content: 'T° Sortie Cong.', styles: {...headStylesBase, fillColor: hexToRgb('#FF9900')} }, 
          { content: 'Heure Sortie', styles: {...headStylesBase, fillColor: hexToRgb('#FF9900')} },
          { content: 'Initial Dém.', styles: {...headStylesBase, fillColor: hexToRgb('#B6B6B6')} }, 
          { content: 'Date Utilisation', styles: {...headStylesBase, fillColor: hexToRgb('#FFD966')} }, 
          { content: 'Heure Utilisation', styles: {...headStylesBase, fillColor: hexToRgb('#FFD966')} },
          { content: 'T° Utilisation', styles: {...headStylesBase, fillColor: hexToRgb('#FFD966')} },
          { content: 'Visa Fin', styles: {...headStylesBase, fillColor: hexToRgb('#B6B6B6')} }, 
        ]
      ];
      
      const body = entries.map(entry => [
        format(parseISO(entry.defrostStartDate), "dd/MM/yy", { locale: fr }),
        entry.productName,
        entry.quantity,
        entry.tempOnRemoval || '-',
        entry.defrostStartTime || '-',
        entry.initialsStart || '-',
        entry.useDate ? format(parseISO(entry.useDate), "dd/MM/yy", { locale: fr }) : '-',
        entry.useTime || '-',
        entry.tempOnUse || '-',
        entry.initialsEnd || '-',
      ]);

      doc.autoTable({
        head: head,
        body: body,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle', halign: 'center' },
        headStyles: {halign: 'center', valign: 'middle', fontStyle: 'bold', cellPadding: 1.5, fontSize: 7 },
        columnStyles: { 
            0: { cellWidth: 18 }, 1: { cellWidth: 40 }, 2: { cellWidth: 20 }, 
            3: { cellWidth: 20 }, 4: { cellWidth: 20 }, 5: { cellWidth: 20 },
            6: { cellWidth: 20 }, 7: { cellWidth: 20 }, 8: { cellWidth: 20 }, 9: { cellWidth: 20 }
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
            doc.setFontSize(9); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        },
      });
      doc.save(`Suivi_Decongelation_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast({ title: "PDF Généré", description: "Le PDF du suivi de décongélation a été téléchargé." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const columnHeaderStyle = (color: string) => ({
    backgroundColor: color,
    color: '#000000', // Black text color
    fontWeight: 'bold' as 'bold',
    textAlign: 'center' as 'center',
    padding: '4px 2px',
    fontSize: '0.7rem',
    borderRight: '1px solid #ccc',
  });

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Snowflake className="w-6 h-6 text-primary"/>
            Suivi de Décongélation
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/> Ajouter Enregistrement</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl md:max-w-3xl">
              <DialogHeader><DialogTitle>{editingEntry ? "Modifier" : "Nouvel"} Enregistrement de Décongélation</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-3 py-2 max-h-[75vh] overflow-y-auto pr-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField control={form.control} name="defrostStartDate" render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel>Date Décongélation</FormLabel>
                      <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
                        <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button></FormControl></PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent></Popover><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="defrostStartTime" render={({ field }) => (<FormItem><FormLabel>Heure Décongélation</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="productName" render={({ field }) => (<FormItem><FormLabel>Produit</FormLabel><FormControl><Input placeholder="Ex: Filet de Saumon" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantité</FormLabel><FormControl><Input placeholder="Ex: 2 kg" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="tempOnRemoval" render={({ field }) => (<FormItem><FormLabel>T° Sortie Cong.</FormLabel><FormControl><Input placeholder="Ex: -18°C" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="initialsStart" render={({ field }) => (<FormItem><FormLabel>Initial Dém.</FormLabel><FormControl><Input placeholder="Ex: JD" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  
                  <h4 className="text-md font-semibold pt-2 border-t mt-3">Informations d'Utilisation (Optionnel)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <FormField control={form.control} name="useDate" render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel>Date Utilisation</FormLabel>
                      <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
                        <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button></FormControl></PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent></Popover><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="useTime" render={({ field }) => (<FormItem><FormLabel>Heure Utilisation</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="tempOnUse" render={({ field }) => (<FormItem><FormLabel>T° Utilisation</FormLabel><FormControl><Input placeholder="Ex: 4°C" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="initialsEnd" render={({ field }) => (<FormItem><FormLabel>Visa Fin</FormLabel><FormControl><Input placeholder="Ex: JD" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  
                  <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit">{editingEntry ? "Enregistrer Modifications" : "Ajouter Entrée"}</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardTitle>
        <CardDescription>
          Enregistrez ici les informations relatives à la décongélation des produits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Chargement...</div>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Aucun enregistrement. Cliquez sur "Ajouter Enregistrement" pour commencer.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead style={columnHeaderStyle('#4A86E8')}>Date</TableHead>
                  <TableHead style={columnHeaderStyle('#4A86E8')}>Produit</TableHead>
                  <TableHead style={columnHeaderStyle('#4A86E8')}>Quantité</TableHead>
                  <TableHead style={columnHeaderStyle('#FF9900')}>T° Sortie</TableHead>
                  <TableHead style={columnHeaderStyle('#FF9900')}>Heure Sortie</TableHead>
                  <TableHead style={columnHeaderStyle('#B6B6B6')}>Initial Dém.</TableHead>
                  <TableHead style={columnHeaderStyle('#FFD966')}>Date Util.</TableHead>
                  <TableHead style={columnHeaderStyle('#FFD966')}>Heure Util.</TableHead>
                  <TableHead style={columnHeaderStyle('#FFD966')}>T° Util.</TableHead>
                  <TableHead style={{...columnHeaderStyle('#B6B6B6'), borderRight: 'none'}}>Visa Fin</TableHead>
                  <TableHead className="text-center sticky right-0 bg-card/80 min-w-[90px] w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="border-r text-center">{format(parseISO(entry.defrostStartDate), "dd/MM/yy", { locale: fr })}</TableCell>
                    <TableCell className="border-r">{entry.productName}</TableCell>
                    <TableCell className="border-r text-center">{entry.quantity}</TableCell>
                    <TableCell className="border-r text-center">{entry.tempOnRemoval || '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.defrostStartTime || '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.initialsStart || '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.useDate ? format(parseISO(entry.useDate), "dd/MM/yy", { locale: fr }) : '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.useTime || '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.tempOnUse || '-'}</TableCell>
                    <TableCell className="text-center">{entry.initialsEnd || '-'}</TableCell>
                    <TableCell className="text-center sticky right-0 bg-card group-hover:bg-muted/50 transition-colors">
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" className="h-7 w-7">
                            <Trash2 className="h-3.5 w-3.5"/>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer cet enregistrement ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. L'enregistrement pour {entry.productName} du {format(parseISO(entry.defrostStartDate), "dd/MM/yyyy", { locale: fr })} sera supprimé.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteEntry(entry.id)}>
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(entry)} className="ml-1 h-7 w-7"><Edit2 className="h-3.5 w-3.5"/></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {entries.length > 0 && (
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
