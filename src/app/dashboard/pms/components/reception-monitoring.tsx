
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { ReceptionEntry } from '../types';
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
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const RECEPTION_LOG_STORAGE_KEY = "pms_reception_log_v1";

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
  productLabeling: z.string().optional(),
  refused: z.boolean().default(false),
  refusalReason: z.string().optional(),
  visa: z.string().optional(),
}).refine(data => !data.refused || (data.refused && data.refusalReason && data.refusalReason.length > 0), {
  message: "La raison du refus est requise si le produit est refusé.",
  path: ['refusalReason'],
});

type ReceptionFormData = z.infer<typeof receptionEntrySchema>;

export default function ReceptionMonitoring() {
  const [receptionEntries, setReceptionEntries] = useState<ReceptionEntry[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ReceptionEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<ReceptionFormData>({
    resolver: zodResolver(receptionEntrySchema),
    defaultValues: {
      dateTime: new Date(),
      supplierName: '',
      productNameControlled: '',
      vehicleObservations: '',
      productTemperature: '',
      dlcDluo: '',
      lotNumber: '',
      packagingAspect: '',
      quantity: '',
      productLabeling: '',
      refused: false,
      refusalReason: '',
      visa: '',
    },
  });

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedEntries = localStorage.getItem(RECEPTION_LOG_STORAGE_KEY);
      if (storedEntries) {
        setReceptionEntries(JSON.parse(storedEntries));
      }
    } catch (error) {
      console.error("Error loading reception entries:", error);
      toast({ title: "Erreur de chargement", description: "Données de réception corrompues.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(RECEPTION_LOG_STORAGE_KEY, JSON.stringify(receptionEntries));
    }
  }, [receptionEntries, isLoading]);

  const handleOpenDialog = (entry?: ReceptionEntry) => {
    setEditingEntry(entry || null);
    if (entry) {
      form.reset({
        ...entry,
        dateTime: parseISO(entry.dateTime), // Convert ISO string back to Date for the form
      });
    } else {
      form.reset({
        dateTime: new Date(), // Default to now for new entries
        supplierName: '', productNameControlled: '', vehicleObservations: '',
        productTemperature: '', dlcDluo: '', lotNumber: '', packagingAspect: '',
        quantity: '', productLabeling: '', refused: false, refusalReason: '', visa: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleFormSubmit = (data: ReceptionFormData) => {
    const entryData = { ...data, dateTime: data.dateTime.toISOString() }; // Store date as ISO string
    if (editingEntry) {
      setReceptionEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...editingEntry, ...entryData } : e));
      toast({ title: "Enregistrement Modifié", description: "La réception a été mise à jour." });
    } else {
      const newEntry: ReceptionEntry = { ...entryData, id: `reception_${Date.now()}` };
      setReceptionEntries(prev => [newEntry, ...prev].sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()));
      toast({ title: "Réception Enregistrée", description: "Une nouvelle réception a été ajoutée." });
    }
    setIsDialogOpen(false);
  };

  const handleDeleteEntry = (entryId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet enregistrement de réception ?")) {
      setReceptionEntries(prev => prev.filter(e => e.id !== entryId));
      toast({ title: "Enregistrement Supprimé", variant: "destructive" });
    }
  };

  const generatePdf = () => {
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('pms_reception_monitoring'); // Assuming new key
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) { doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10; }
      if (pdfSettings.logoUrl) { doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY); currentY += 5; }
      
      doc.setFontSize(18); doc.text("Suivi de Réception des Marchandises", 14, currentY); currentY += 8;
      doc.setFontSize(10); doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY); currentY += 7;

      const headStyles: any = { fontSize: 8, fontStyle: 'bold', halign: 'center', valign: 'middle' };
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      } else {
        headStyles.fillColor = [144, 202, 249]; // Default light green if no primary color
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
          // Sub-headers for "Produits"
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
        entry.vehicleObservations,
        entry.productTemperature || '-',
        entry.dlcDluo || '-',
        entry.lotNumber || '-',
        entry.packagingAspect || '-',
        entry.quantity || '-',
        entry.productLabeling || '-',
        entry.refused ? `Oui${entry.refusalReason ? ` (${entry.refusalReason})` : ''}` : 'Non',
        entry.visa || '-',
      ]);

      doc.autoTable({
        head: head,
        body: body,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle' },
        headStyles: {halign: 'center', valign: 'middle', fontStyle: 'bold', fillColor: headStyles.fillColor, textColor: headStyles.textColor, fontSize: 7}, // Apply custom header style
        columnStyles: { // Approximate widths
          0: { cellWidth: 25 }, 1: { cellWidth: 30 }, 2: { cellWidth: 35 }, 3: { cellWidth: 30 },
          4: { cellWidth: 12 }, 5: { cellWidth: 18 }, 6: { cellWidth: 18 }, 7: { cellWidth: 30 }, 8: { cellWidth: 15 }, 9: { cellWidth: 30 },
          10: { cellWidth: 25 }, 11: { cellWidth: 12 },
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
            doc.setFontSize(9); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        },
      });
      doc.save(`Suivi_Reception_Marchandises_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast({ title: "PDF Généré", description: "Le PDF du suivi des réceptions a été téléchargé." });
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
                <Truck className="w-6 h-6 text-primary"/>
                Suivi de Réception des Marchandises
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/> Ajouter Réception</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl md:max-w-3xl"> {/* Wider dialog */}
                <DialogHeader><DialogTitle>{editingEntry ? "Modifier" : "Nouvel"} Enregistrement de Réception</DialogTitle></DialogHeader>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField control={form.control} name="dateTime" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Date et Heure</FormLabel>
                        <Popover><PopoverTrigger asChild>
                            <FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "dd/MM/yyyy HH:mm", { locale: fr }) : <span>Choisir date et heure</span>}
                            <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button></FormControl>
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
                        </PopoverContent></Popover><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="supplierName" render={({ field }) => (<FormItem><FormLabel>Nom du fournisseur</FormLabel><FormControl><Input placeholder="Ex: Fournisseur ABC" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="productNameControlled" render={({ field }) => (<FormItem><FormLabel>Dénomination du produit contrôlé</FormLabel><FormControl><Input placeholder="Ex: Poulet entier" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="vehicleObservations" render={({ field }) => (<FormItem><FormLabel>Véhicule (propreté, température)</FormLabel><FormControl><Textarea placeholder="Ex: Camion propre, température ok" {...field} rows={2}/></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <h4 className="text-md font-semibold pt-2 border-t mt-3">Détails Produits</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FormField control={form.control} name="productTemperature" render={({ field }) => (<FormItem><FormLabel>T° C Produit</FormLabel><FormControl><Input placeholder="Ex: 3°C" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="dlcDluo" render={({ field }) => (<FormItem><FormLabel>DLC / DLUO</FormLabel><FormControl><Input placeholder="Ex: 25/12/2024" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="lotNumber" render={({ field }) => (<FormItem><FormLabel>N° du lot</FormLabel><FormControl><Input placeholder="Ex: LOT12345" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="packagingAspect" render={({ field }) => (<FormItem><FormLabel>Aspect et emballage</FormLabel><FormControl><Input placeholder="Ex: Emballage intact" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantité</FormLabel><FormControl><Input placeholder="Ex: 10 kg" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="productLabeling" render={({ field }) => (<FormItem><FormLabel>Étiquetage du produit</FormLabel><FormControl><Input placeholder="Ex: Conforme" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                     <FormField control={form.control} name="refused" render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-2 pt-2">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="refused-check" /></FormControl>
                        <FormLabel htmlFor="refused-check" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Produit Refusé ?</FormLabel>
                        <FormMessage />
                        </FormItem>
                    )} />
                    {form.watch('refused') && (
                         <FormField control={form.control} name="refusalReason" render={({ field }) => (<FormItem><FormLabel>Raison du refus</FormLabel><FormControl><Textarea placeholder="Expliquer la raison du refus..." {...field} rows={2} /></FormControl><FormMessage /></FormItem>)} />
                    )}
                    <FormField control={form.control} name="visa" render={({ field }) => (<FormItem><FormLabel>Visa (Initiales)</FormLabel><FormControl><Input placeholder="Ex: JD" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <DialogFooter className="pt-3">
                    <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit">{editingEntry ? "Enregistrer Modifications" : "Ajouter Réception"}</Button>
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
        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Chargement...</div>
        ) : receptionEntries.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Aucun enregistrement de réception. Cliquez sur "Ajouter Réception" pour commencer.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md">
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
                    <TableCell>{format(parseISO(entry.dateTime), "dd/MM/yy HH:mm", { locale: fr })}</TableCell>
                    <TableCell>{entry.supplierName}</TableCell>
                    <TableCell>{entry.productNameControlled}</TableCell>
                    <TableCell>{entry.vehicleObservations}</TableCell>
                    <TableCell className="text-center">{entry.productTemperature || '-'}</TableCell>
                    <TableCell>{entry.dlcDluo || '-'}</TableCell>
                    <TableCell>{entry.lotNumber || '-'}</TableCell>
                    <TableCell>{entry.packagingAspect || '-'}</TableCell>
                    <TableCell>{entry.quantity || '-'}</TableCell>
                    <TableCell>{entry.productLabeling || '-'}</TableCell>
                    <TableCell className={entry.refused ? 'text-destructive font-semibold' : ''}>
                      {entry.refused ? `Oui${entry.refusalReason ? ` (${entry.refusalReason})` : ''}` : 'Non'}
                    </TableCell>
                    <TableCell className="text-center">{entry.visa || '-'}</TableCell>
                    <TableCell className="text-center sticky right-0 bg-card group-hover:bg-muted/50 transition-colors">
                        <Button variant="outline" size="icon" onClick={() => handleOpenDialog(entry)} className="mr-1 h-7 w-7"><Edit2 className="h-4 w-4"/></Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteEntry(entry.id)} className="h-7 w-7"><Trash2 className="h-4 w-4"/></Button>
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

