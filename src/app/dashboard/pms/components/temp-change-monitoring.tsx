
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { TempChangeEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Might not be needed based on image
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, FileText, Loader2, ArrowDownUp, CalendarIcon as LucideCalendarIcon } from 'lucide-react';
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

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const TEMP_CHANGE_LOG_STORAGE_KEY = "pms_temp_change_log_v1";

const tempChangeEntrySchema = z.object({
  coolingDate: z.date({ required_error: "Date de refroidissement requise." }),
  productName: z.string().min(1, "Nom du produit requis."),
  quantity: z.string().min(1, "Quantité requise."),
  coolingHotProductTime: z.string().optional(),
  coolingHotProductTemp: z.string().optional(),
  coolingColdProductTime: z.string().optional(),
  coolingColdProductTemp: z.string().optional(),
  coolingVisa: z.string().optional(),
  reheatingDate: z.date().optional().nullable(),
  reheatingColdProductTime: z.string().optional(),
  reheatingColdProductTemp: z.string().optional(),
  reheatingHotProductTime: z.string().optional(),
  reheatingHotProductTemp: z.string().optional(),
  reheatingVisa: z.string().optional(),
});

type TempChangeFormData = z.infer<typeof tempChangeEntrySchema>;

export default function TempChangeMonitoring() {
  const [entries, setEntries] = useState<TempChangeEntry[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TempChangeEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<TempChangeFormData>({
    resolver: zodResolver(tempChangeEntrySchema),
    defaultValues: {
      coolingDate: new Date(),
      productName: '',
      quantity: '',
    },
  });

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedEntries = localStorage.getItem(TEMP_CHANGE_LOG_STORAGE_KEY);
      if (storedEntries) {
        setEntries(JSON.parse(storedEntries));
      }
    } catch (error) {
      console.error("Error loading temp change entries:", error);
      toast({ title: "Erreur de chargement", description: "Données de baisse/remise T° corrompues.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(TEMP_CHANGE_LOG_STORAGE_KEY, JSON.stringify(entries));
    }
  }, [entries, isLoading]);

  const handleOpenDialog = (entry?: TempChangeEntry) => {
    setEditingEntry(entry || null);
    if (entry) {
      form.reset({
        ...entry,
        coolingDate: parseISO(entry.coolingDate),
        reheatingDate: entry.reheatingDate ? parseISO(entry.reheatingDate) : null,
      });
    } else {
      form.reset({
        coolingDate: new Date(), productName: '', quantity: '',
        coolingHotProductTime: '', coolingHotProductTemp: '', coolingColdProductTime: '', coolingColdProductTemp: '', coolingVisa: '',
        reheatingDate: null, reheatingColdProductTime: '', reheatingColdProductTemp: '', reheatingHotProductTime: '', reheatingHotProductTemp: '', reheatingVisa: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleFormSubmit = (data: TempChangeFormData) => {
    const entryData = { 
      ...data, 
      coolingDate: data.coolingDate.toISOString(),
      reheatingDate: data.reheatingDate ? data.reheatingDate.toISOString() : undefined,
    };
    if (editingEntry) {
      setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...editingEntry, ...entryData } : e));
      toast({ title: "Enregistrement Modifié", description: "L'entrée a été mise à jour." });
    } else {
      const newEntry: TempChangeEntry = { ...entryData, id: `tc_${Date.now()}` };
      setEntries(prev => [newEntry, ...prev].sort((a,b) => new Date(b.coolingDate).getTime() - new Date(a.coolingDate).getTime()));
      toast({ title: "Enregistrement Ajouté", description: "Une nouvelle entrée a été ajoutée." });
    }
    setIsDialogOpen(false);
  };

  const handleDeleteEntry = (entryId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet enregistrement ?")) {
      setEntries(prev => prev.filter(e => e.id !== entryId));
      toast({ title: "Enregistrement Supprimé", variant: "destructive" });
    }
  };
  
  const generatePdf = () => {
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('pms_temp_change_monitoring'); // New PDF type key
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) { doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10; }
      if (pdfSettings.logoUrl) { doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY); currentY += 5; }
      
      doc.setFontSize(16); doc.text("Suivi Baisse / Remise en Température", 14, currentY); currentY += 8;
      doc.setFontSize(10); doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY); currentY += 7;

      const headStylesBase: any = { fontSize: 7, fontStyle: 'bold', halign: 'center', valign: 'middle', cellPadding: 1 };
      const primaryColorRgb = hexToRgb(pdfSettings.primaryColor || '#CCCCCC'); // Default gray if no primary
      if (primaryColorRgb) {
        headStylesBase.fillColor = primaryColorRgb;
        const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
        headStylesBase.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
      }

      const orangeColor = [255, 165, 0]; // Orange
      const blueColor = [173, 216, 230]; // Light Blue

      const head: any[] = [
        [
          { content: '', colSpan: 3, styles: { ...headStylesBase, fillColor: [255,255,255] } }, // Empty for top-left
          { content: 'REFROIDISSEMENT RAPIDE', colSpan: 5, styles: headStylesBase },
          { content: 'REMISE EN TEMPERATURE', colSpan: 5, styles: headStylesBase },
        ],
        [
          { content: 'Date', styles: headStylesBase },
          { content: 'Produit', styles: headStylesBase },
          { content: 'Quantité', styles: headStylesBase },
          // Refroidissement
          { content: 'Produit chauds\nHeure', styles: {...headStylesBase, fillColor: orangeColor, textColor: [0,0,0]} },
          { content: 'Produit chauds\nT°', styles: {...headStylesBase, fillColor: orangeColor, textColor: [0,0,0]} },
          { content: 'Produit froids\nHeure', styles: {...headStylesBase, fillColor: blueColor, textColor: [0,0,0]} },
          { content: 'Produit froids\nT°', styles: {...headStylesBase, fillColor: blueColor, textColor: [0,0,0]} },
          { content: 'Visa', styles: headStylesBase },
          // Remise
          { content: 'Date', styles: headStylesBase }, // Note: Added Date for reheating section as per image (can be different)
          { content: 'Produit froids\nHeure', styles: {...headStylesBase, fillColor: blueColor, textColor: [0,0,0]} },
          { content: 'Produit froids\nT°', styles: {...headStylesBase, fillColor: blueColor, textColor: [0,0,0]} },
          { content: 'Produit chauds\nHeure', styles: {...headStylesBase, fillColor: orangeColor, textColor: [0,0,0]} },
          { content: 'Produit chauds\nT°', styles: {...headStylesBase, fillColor: orangeColor, textColor: [0,0,0]} },
          { content: 'Visa', styles: headStylesBase },
        ]
      ];
      
      const body = entries.map(entry => [
        format(parseISO(entry.coolingDate), "dd/MM/yy", { locale: fr }),
        entry.productName,
        entry.quantity,
        entry.coolingHotProductTime || '-',
        entry.coolingHotProductTemp || '-',
        entry.coolingColdProductTime || '-',
        entry.coolingColdProductTemp || '-',
        entry.coolingVisa || '-',
        entry.reheatingDate ? format(parseISO(entry.reheatingDate), "dd/MM/yy", { locale: fr }) : '-',
        entry.reheatingColdProductTime || '-',
        entry.reheatingColdProductTemp || '-',
        entry.reheatingHotProductTime || '-',
        entry.reheatingHotProductTemp || '-',
        entry.reheatingVisa || '-',
      ]);

      doc.autoTable({
        head: head,
        body: body,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1, valign: 'middle', halign: 'center' },
        headStyles: {halign: 'center', valign: 'middle', fontStyle: 'bold', cellPadding: 1, fontSize: 6.5},
        columnStyles: { // Adjust widths as needed, this is approximate
            0: { cellWidth: 15 }, 1: { cellWidth: 30 }, 2: { cellWidth: 20 }, // Date, Produit, Qté
            3: { cellWidth: 15 }, 4: { cellWidth: 12 }, 5: { cellWidth: 15 }, 6: { cellWidth: 12 }, 7: { cellWidth: 10 }, // Refroid.
            8: { cellWidth: 15 }, 9: { cellWidth: 15 }, 10: { cellWidth: 12 }, 11: { cellWidth: 15 }, 12: { cellWidth: 12 }, 13: { cellWidth: 10 }, // Remise
        },
        didDrawCell: (data) => { // Custom cell coloring for body (if needed, usually handled by headStyles/columnStyles in simple cases)
            // Example for specific cell coloring if autoTable styles are not enough
            // For "Produit chauds" columns in body
            if (data.section === 'body' && (data.column.index === 3 || data.column.index === 4 || data.column.index === 11 || data.column.index === 12)) {
                 // data.cell.styles.fillColor = orangeColor; // Be careful, this might override other styles
            }
            // For "Produit froids" columns in body
            if (data.section === 'body' && (data.column.index === 5 || data.column.index === 6 || data.column.index === 9 || data.column.index === 10)) {
                // data.cell.styles.fillColor = blueColor; // Be careful
            }
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
            doc.setFontSize(9); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        },
      });
      doc.save(`Suivi_Baisse_Remise_Temperature_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast({ title: "PDF Généré", description: "Le PDF du suivi a été téléchargé." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDownUp className="w-6 h-6 text-primary"/>
            Suivi Baisse / Remise en Température
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/> Ajouter Enregistrement</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl md:max-w-4xl"> {/* Wider dialog */}
              <DialogHeader><DialogTitle>{editingEntry ? "Modifier" : "Nouvel"} Enregistrement</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-3 py-2 max-h-[75vh] overflow-y-auto pr-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField control={form.control} name="coolingDate" render={({ field }) => (
                      <FormItem className="flex flex-col"><FormLabel>Date Refroidissement</FormLabel>
                      <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
                        <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button></FormControl></PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent></Popover><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="productName" render={({ field }) => (<FormItem><FormLabel>Produit</FormLabel><FormControl><Input placeholder="Ex: Boeuf Bourguignon" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantité</FormLabel><FormControl><Input placeholder="Ex: 5 kg" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  
                  <div className="pt-3">
                    <h4 className="text-md font-semibold mb-1 border-b pb-1">REFROIDISSEMENT RAPIDE</h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
                      <FormField control={form.control} name="coolingHotProductTime" render={({ field }) => (<FormItem><FormLabel>P. Chauds Heure</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="coolingHotProductTemp" render={({ field }) => (<FormItem><FormLabel>P. Chauds T°C</FormLabel><FormControl><Input placeholder="Ex: 65°C" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="coolingColdProductTime" render={({ field }) => (<FormItem><FormLabel>P. Froids Heure</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="coolingColdProductTemp" render={({ field }) => (<FormItem><FormLabel>P. Froids T°C</FormLabel><FormControl><Input placeholder="Ex: 8°C" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="coolingVisa" render={({ field }) => (<FormItem><FormLabel>Visa</FormLabel><FormControl><Input placeholder="Initiales" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  </div>

                  <div className="pt-3">
                    <h4 className="text-md font-semibold mb-1 border-b pb-1">REMISE EN TEMPERATURE</h4>
                     <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-2">
                       <FormField control={form.control} name="reheatingDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Date Remise (si diff.)</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
                            <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button></FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent></Popover><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="reheatingColdProductTime" render={({ field }) => (<FormItem><FormLabel>P. Froids Heure</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="reheatingColdProductTemp" render={({ field }) => (<FormItem><FormLabel>P. Froids T°C</FormLabel><FormControl><Input placeholder="Ex: 10°C" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="reheatingHotProductTime" render={({ field }) => (<FormItem><FormLabel>P. Chauds Heure</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="reheatingHotProductTemp" render={({ field }) => (<FormItem><FormLabel>P. Chauds T°C</FormLabel><FormControl><Input placeholder="Ex: 70°C" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="reheatingVisa" render={({ field }) => (<FormItem><FormLabel>Visa</FormLabel><FormControl><Input placeholder="Initiales" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
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
          Enregistrez ici les informations relatives au refroidissement rapide et à la remise en température des produits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Chargement...</div>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Aucun enregistrement. Cliquez sur "Ajouter Enregistrement" pour commencer.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[1200px]"> {/* Ensure table is wide enough */}
              <TableHeader>
                <TableRow className="bg-primary/10 text-xs">
                  <TableHead rowSpan={2} className="text-center align-middle border-r min-w-[80px]">Date</TableHead>
                  <TableHead rowSpan={2} className="text-center align-middle border-r min-w-[150px]">Produit</TableHead>
                  <TableHead rowSpan={2} className="text-center align-middle border-r min-w-[100px]">Quantité</TableHead>
                  <TableHead colSpan={5} className="text-center font-semibold border-r py-1">REFROIDISSEMENT RAPIDE</TableHead>
                  <TableHead colSpan={6} className="text-center font-semibold py-1">REMISE EN TEMPERATURE</TableHead>
                </TableRow>
                <TableRow className="bg-primary/10 text-xs">
                  {/* Refroidissement */}
                  <TableHead className="text-center border-r bg-orange-200 dark:bg-orange-700/50 min-w-[70px]">P.Chauds<br/>Heure</TableHead>
                  <TableHead className="text-center border-r bg-orange-200 dark:bg-orange-700/50 min-w-[60px]">P.Chauds<br/>T°</TableHead>
                  <TableHead className="text-center border-r bg-blue-200 dark:bg-blue-700/50 min-w-[70px]">P.Froids<br/>Heure</TableHead>
                  <TableHead className="text-center border-r bg-blue-200 dark:bg-blue-700/50 min-w-[60px]">P.Froids<br/>T°</TableHead>
                  <TableHead className="text-center border-r min-w-[60px]">Visa</TableHead>
                  {/* Remise en T° */}
                  <TableHead className="text-center border-r min-w-[80px]">Date</TableHead>
                  <TableHead className="text-center border-r bg-blue-200 dark:bg-blue-700/50 min-w-[70px]">P.Froids<br/>Heure</TableHead>
                  <TableHead className="text-center border-r bg-blue-200 dark:bg-blue-700/50 min-w-[60px]">P.Froids<br/>T°</TableHead>
                  <TableHead className="text-center border-r bg-orange-200 dark:bg-orange-700/50 min-w-[70px]">P.Chauds<br/>Heure</TableHead>
                  <TableHead className="text-center border-r bg-orange-200 dark:bg-orange-700/50 min-w-[60px]">P.Chauds<br/>T°</TableHead>
                  <TableHead className="text-center min-w-[60px]">Visa</TableHead>
                  <TableHead className="text-center sticky right-0 bg-card/80 min-w-[90px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="border-r text-center">{format(parseISO(entry.coolingDate), "dd/MM/yy", { locale: fr })}</TableCell>
                    <TableCell className="border-r">{entry.productName}</TableCell>
                    <TableCell className="border-r text-center">{entry.quantity}</TableCell>
                    {/* Refroidissement */}
                    <TableCell className="border-r text-center">{entry.coolingHotProductTime || '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.coolingHotProductTemp || '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.coolingColdProductTime || '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.coolingColdProductTemp || '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.coolingVisa || '-'}</TableCell>
                    {/* Remise en T° */}
                    <TableCell className="border-r text-center">{entry.reheatingDate ? format(parseISO(entry.reheatingDate), "dd/MM/yy", { locale: fr }) : '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.reheatingColdProductTime || '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.reheatingColdProductTemp || '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.reheatingHotProductTime || '-'}</TableCell>
                    <TableCell className="border-r text-center">{entry.reheatingHotProductTemp || '-'}</TableCell>
                    <TableCell className="text-center">{entry.reheatingVisa || '-'}</TableCell>
                    <TableCell className="text-center sticky right-0 bg-card group-hover:bg-muted/50 transition-colors">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(entry)} className="mr-1 h-7 w-7"><Edit2 className="h-3.5 w-3.5"/></Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteEntry(entry.id)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5"/></Button>
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
