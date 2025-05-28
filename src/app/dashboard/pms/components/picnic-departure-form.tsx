
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { PicnicDepartureEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, FileText, Loader2, CalendarIcon as LucideCalendarIcon, ShoppingBasket } from 'lucide-react';
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

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const PICNIC_DEPARTURE_FORMS_KEY = "pms_picnic_departure_forms_v1";

const picnicDepartureSchema = z.object({
  orderReceivedDate: z.date({ required_error: "Date de réception de commande requise." }),
  orderReceivedTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format HH:MM requis."),
  clientName: z.string().min(1, "Nom du client requis."),
  numberOfPicnics: z.coerce.number().min(1, "Nombre de pique-niques doit être au moins 1."),
  departureTemperature: z.string().min(1, "Température de départ requise."),
});

type PicnicDepartureFormData = z.infer<typeof picnicDepartureSchema>;

export default function PicnicDepartureForm() {
  const [forms, setForms] = useState<PicnicDepartureEntry[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<PicnicDepartureEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Used for general loading and PDF generation
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

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedForms = localStorage.getItem(PICNIC_DEPARTURE_FORMS_KEY);
      if (storedForms) {
        setForms(JSON.parse(storedForms).sort((a: PicnicDepartureEntry, b: PicnicDepartureEntry) => new Date(b.entryCreationDate).getTime() - new Date(a.entryCreationDate).getTime()));
      } else {
        setForms([]);
      }
    } catch (error) {
      console.error("Error loading picnic departure forms:", error);
      toast({ title: "Erreur de chargement", description: "Données des fiches de départ PN corrompues.", variant: "destructive" });
      setForms([]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!isLoading) { // Only save if not in a loading state (like PDF generation)
      localStorage.setItem(PICNIC_DEPARTURE_FORMS_KEY, JSON.stringify(forms));
    }
  }, [forms, isLoading]);

  const handleOpenDialog = (entry?: PicnicDepartureEntry) => {
    setEditingForm(entry || null);
    if (entry) {
      form.reset({
        orderReceivedDate: parseISO(entry.orderReceivedDate),
        orderReceivedTime: entry.orderReceivedTime,
        clientName: entry.clientName,
        numberOfPicnics: entry.numberOfPicnics,
        departureTemperature: entry.departureTemperature,
      });
    } else {
      form.reset({
        orderReceivedDate: new Date(),
        orderReceivedTime: format(new Date(), 'HH:mm'),
        clientName: '', numberOfPicnics: 1, departureTemperature: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleFormSubmit = (data: PicnicDepartureFormData) => {
    const entryData = {
      ...data,
      entryCreationDate: new Date().toISOString(),
      orderReceivedDate: data.orderReceivedDate.toISOString(),
    };
    if (editingForm) {
      setForms(prev => prev.map(f => f.id === editingForm.id ? { ...editingForm, ...entryData } : f)
                           .sort((a,b) => new Date(b.entryCreationDate).getTime() - new Date(a.entryCreationDate).getTime()));
      toast({ title: "Fiche Modifiée" });
    } else {
      const newForm: PicnicDepartureEntry = { ...entryData, id: `pn_dep_${Date.now()}` };
      setForms(prev => [newForm, ...prev].sort((a,b) => new Date(b.entryCreationDate).getTime() - new Date(a.entryCreationDate).getTime()));
      toast({ title: "Fiche Ajoutée" });
    }
    setIsDialogOpen(false);
  };

  const handleDeleteForm = (formId: string) => {
    setForms(prev => prev.filter(f => f.id !== formId));
    toast({ title: "Fiche Supprimée", variant: "destructive" });
  };

  const generatePdfForEntry = (entry: PicnicDepartureEntry) => {
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('pms_picnic_departure_form');
      const doc = new jsPDF({ 
        unit: 'pt', 
        format: pdfSettings.pageSize || 'a4',
        orientation: pdfSettings.orientation || 'portrait',
      }) as jsPDFWithAutoTable; 
      doc.setFont(pdfSettings.fontFamily || 'helvetica');
      const defaultFontSize = pdfSettings.defaultFontSize || 10;
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
      
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginLeft = pdfSettings.marginLeft || 40;
      const marginRight = pdfSettings.marginRight || 40;
      const marginTop = pdfSettings.marginTop || 40;
      const marginBottom = pdfSettings.marginBottom || 40;
      const contentWidth = pageWidth - marginLeft - marginRight;
      
      let currentY = marginTop;

      // Draw Logo and Custom Header Text (if any)
      if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
        try {
          const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
          const formatType = imgProps.fileType.toUpperCase();
          const desiredHeight = 30; 
          const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
          doc.addImage(pdfSettings.logoUrl, formatType, marginLeft, currentY, imgWidth, desiredHeight);
          currentY += desiredHeight + 10;
        } catch (e) {
          console.error("Error drawing logo in PDF:", e);
          doc.setFontSize(pdfSettings.headerFontSize || 8); doc.text("[Erreur Logo]", marginLeft, currentY); currentY += 15;
        }
      } else if (pdfSettings.headerText) {
        doc.setFontSize(pdfSettings.headerFontSize || 10);
        const headerLines = pdfSettings.headerText.split('\n');
        headerLines.forEach(line => {
            doc.text(line, marginLeft, currentY, {maxWidth: contentWidth});
            currentY += (pdfSettings.headerFontSize || 10) * 0.7 + 2;
        });
        currentY += 5;
      } else {
        doc.setFontSize(10); doc.setTextColor(150, 150, 150);
        doc.text("LA VIE ACTIVE - I.M.E BREBIERES", marginLeft, currentY); 
        doc.setTextColor(0,0,0);
        currentY += 20;
      }
      
      // Top right box with document reference
      const topRightBoxWidth = 120; // Adjusted width
      const topRightBoxHeight = 30;
      const topRightBoxX = pageWidth - marginRight - topRightBoxWidth;
      const topRightBoxY = marginTop - 10 > 0 ? marginTop -10 : marginTop; // Position it slightly above the main content start

      doc.rect(topRightBoxX, topRightBoxY, topRightBoxWidth, topRightBoxHeight);
      doc.setFontSize(8); doc.setTextColor(0,0,0);
      doc.text("09-GFL-F-17", topRightBoxX + 5, topRightBoxY + 12);
      doc.text("Version : 2.0", topRightBoxX + 5, topRightBoxY + 22);
      
      currentY = Math.max(currentY, topRightBoxY + topRightBoxHeight + 15);

      doc.setFontSize((pdfSettings.documentTitleFontSize || 14)); doc.setFont(undefined, 'bold');
      doc.text("ENLEVEMENT DE PREPARATION CULINAIRE", pageWidth / 2, currentY, { align: 'center' });
      currentY += (pdfSettings.documentTitleFontSize || 14) + 15;

      doc.setFontSize(defaultFontSize - 1); doc.setFont(undefined, 'normal');
      const addressLines = [
        "I.M.E Jean de Saint Aubert",
        "46, chemin du bois des Caures",
        "62117 BREBIERES",
        "Tel: 03.21.50.00.36"
      ];
      addressLines.forEach(line => {
        doc.text(line, pageWidth / 2, currentY, { align: 'center' });
        currentY += (defaultFontSize -1) * 1.2;
      });
      currentY += 15;

      const paragraph1 = "Ce Repas a été préparé en respectant scrupuleusement les règles d'hygiène en vigueur. Les repas sont stockés en réfrigération positive à 3° en attente d'enlèvement.";
      const paragraph2 = "Afin de conserver cette commande, il est impératif de le garder stocké en glacière, avec pains de glace ou plaques eutectiques.";
      const paragraph3 = "L'I.M.E Jean de Saint Aubert décline toute responsabilité après enlèvement de ce repas.";

      doc.text(doc.splitTextToSize(paragraph1, contentWidth), marginLeft, currentY);
      currentY += doc.getTextDimensions(doc.splitTextToSize(paragraph1, contentWidth)).h + 10;
      doc.text(doc.splitTextToSize(paragraph2, contentWidth), marginLeft, currentY);
      currentY += doc.getTextDimensions(doc.splitTextToSize(paragraph2, contentWidth)).h + 10;
      doc.text(doc.splitTextToSize(paragraph3, contentWidth), marginLeft, currentY);
      currentY += doc.getTextDimensions(doc.splitTextToSize(paragraph3, contentWidth)).h + 25;

      const orderDateStr = isValid(parseISO(entry.orderReceivedDate)) ? format(parseISO(entry.orderReceivedDate), "dd/MM/yyyy", { locale: fr }) : "Date Invalide";
      doc.text(`Commande reçue le ........ ${orderDateStr} ........`, marginLeft, currentY);
      currentY += defaultFontSize * 1.2 + 5;
      doc.text(`à ........ ${entry.orderReceivedTime || 'Heure N/A'} H ........`, marginLeft + 20, currentY);
      currentY += defaultFontSize * 1.2 + 5;
      doc.text("à Brebières", marginLeft + 20, currentY);
      currentY += 25;

      const signatureTableBody = [
        [
          { content: 'Le cuisinier\nMr Dernoncourt Julien', styles: { halign: 'center', valign: 'top', minCellHeight: 80 } }, // Increased minCellHeight for signature space
          { content: `Le client\n${entry.clientName}`, styles: { halign: 'center', valign: 'top', minCellHeight: 80 } }
        ]
      ];
      const sigTableColWidth = (contentWidth - (doc.getLineWidth() * 3)) / 2; // Adjusted for 2 columns

      doc.autoTable({
        startY: currentY,
        body: signatureTableBody,
        theme: 'grid',
        styles: { fontSize: defaultFontSize, cellPadding: 5, font: pdfSettings.fontFamily || 'helvetica' },
        columnStyles: { 0: { cellWidth: sigTableColWidth }, 1: { cellWidth: sigTableColWidth } },
        margin: { left: marginLeft, right: marginRight },
        tableWidth: 'auto'
      });
      currentY = (doc as any).lastAutoTable.finalY + 20;

      doc.text(`Nombre de Pique-Niques : ........ ${entry.numberOfPicnics} ........`, marginLeft, currentY);
      currentY += defaultFontSize * 1.2 + 10;
      doc.text(`T° de Départ : ........ ${entry.departureTemperature} ........`, marginLeft, currentY);
      currentY += defaultFontSize * 1.2 + 5;
      
      // Ensure currentY does not exceed page height before drawing footer
      if (currentY > pageHeight - marginBottom - (pdfSettings.footerFontSize || 8) - 10) { // Extra buffer for footer
         currentY = pageHeight - marginBottom - (pdfSettings.footerFontSize || 8) - 5;
      }

      if (pdfSettings.footerText) {
        let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', '1').replace('{totalPages}', '1');
        doc.setFontSize(pdfSettings.footerFontSize || 8);
        doc.text(footerStr, marginLeft, pageHeight - (marginBottom / 2));
      }

      doc.save(`Fiche_Depart_PN_${entry.clientName.replace(/\s+/g, '_')}_${format(parseISO(entry.orderReceivedDate), "yyyyMMdd")}.pdf`);
      toast({ title: "PDF Fiche Départ Généré" });
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${error.message || String(error)}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBasket className="w-6 h-6 text-primary"/>
            Fiche d'Enlèvement Pique-Nique
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/> Nouvelle Fiche</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>{editingForm ? "Modifier" : "Nouvelle"} Fiche de Départ Pique-Nique</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
                  <FormField control={form.control} name="orderReceivedDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Commande reçue le</FormLabel>
                    <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
                        <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button></FormControl></PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent></Popover><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="orderReceivedTime" render={({ field }) => (<FormItem><FormLabel>À ... H ... (Heure de réception)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="clientName" render={({ field }) => (<FormItem><FormLabel>Le Client</FormLabel><FormControl><Input placeholder="Nom du client" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="numberOfPicnics" render={({ field }) => (<FormItem><FormLabel>Nombre de Pique-Niques</FormLabel><FormControl><Input type="number" placeholder="0" min="1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="departureTemperature" render={({ field }) => (<FormItem><FormLabel>T° de Départ</FormLabel><FormControl><Input placeholder="Ex: 3°C" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit">{editingForm ? "Enregistrer" : "Ajouter Fiche"}</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardTitle>
        <CardDescription>
          Créez et gérez les fiches d'enlèvement pour les préparations culinaires (pique-niques).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && forms.length === 0 ? ( // Show loading only if initially loading and no forms yet
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Chargement...</div>
        ) : !isLoading && forms.length === 0 ? ( // Show no forms message only after loading is done
          <p className="text-muted-foreground text-center py-8">Aucune fiche de départ enregistrée. Cliquez sur "Nouvelle Fiche" pour commencer.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date Cde.</TableHead>
                  <TableHead>Heure Cde.</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Nb PN</TableHead>
                  <TableHead>T° Départ</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(parseISO(entry.orderReceivedDate), "dd/MM/yy", { locale: fr })}</TableCell>
                    <TableCell>{entry.orderReceivedTime}</TableCell>
                    <TableCell>{entry.clientName}</TableCell>
                    <TableCell className="text-right">{entry.numberOfPicnics}</TableCell>
                    <TableCell>{entry.departureTemperature}</TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button variant="outline" size="icon" onClick={() => generatePdfForEntry(entry)} className="h-7 w-7" disabled={isLoading} title="Générer PDF">
                        {isLoading && editingForm?.id === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <FileText className="h-3.5 w-3.5"/>}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5"/></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cette fiche ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Pour le client "{entry.clientName}" du {format(parseISO(entry.orderReceivedDate), "dd/MM/yyyy", { locale: fr })}. Action irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteForm(entry.id)}>Supprimer</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(entry)} className="h-7 w-7"><Edit2 className="h-3.5 w-3.5"/></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

