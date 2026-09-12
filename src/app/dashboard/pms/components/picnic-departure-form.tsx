
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { PicnicDepartureEntry, PmsZone } from '../types';
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
import { format, parseISO, isValid, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings } from '@/lib/pdf-settings';
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
import { collection, getDocs, getDoc, addDoc, doc, setDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added Select
import useMobile from '@/hooks/use-mobile';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

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

// Helper function to draw a single form page
const drawSingleFormPage = async (doc: jsPDFWithAutoTable, entry: PicnicDepartureEntry, pageNumber: number, totalPages: number) => {
    // Note: This function is now async to await getPdfLayoutSettings
    const pdfSettings = await getPdfLayoutSettings('pms_picnic_departure_form');
    doc.setFont(pdfSettings.fontFamily || 'helvetica');
    const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
    
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const marginLeft = pdfSettings.marginLeft || 40;
    const marginRight = pdfSettings.marginRight || 40;
    const marginTop = pdfSettings.marginTop || 40;
    const marginBottom = pdfSettings.marginBottom || 40;
    const contentWidth = pageWidth - marginLeft - marginRight;
    
    let currentY = marginTop;

    // --- EN-TÊTE ---
    const effectiveHeaderText = pdfSettings.headerText || (pdfSettings.logoUrl ? '{logo}' : '');
    if (effectiveHeaderText) {
        const headerRows = effectiveHeaderText.split('\n');
        doc.setFontSize(pdfSettings.headerFontSize);
        for (const row of headerRows) {
            const cells = row.split('|');
            if (cells.length === 0) continue;
            let maxHeightInRow = 0;
            const cellWidth = contentWidth / cells.length; // LIGNE CORRIGÉE
            cells.forEach(cell => {
                const cellText = cell.trim();
                if (cellText === '{logo}' && pdfSettings.logoUrl) {
                    maxHeightInRow = Math.max(maxHeightInRow, 30);
                } else {
                    const textLines = doc.splitTextToSize(cellText, cellWidth - 6);
                    maxHeightInRow = Math.max(maxHeightInRow, (textLines.length * pdfSettings.headerFontSize * 0.7) + 6);
                }
            });

            let currentX = marginLeft;
            for (const cell of cells) {
                const cellText = cell.trim();
                doc.rect(currentX, currentY, cellWidth, maxHeightInRow, 'S');
                if (cellText === '{logo}' && pdfSettings.logoUrl) {
                    try {
                        const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                        const imgHeight = Math.min(maxHeightInRow - 6, 40);
                        const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                        doc.addImage(pdfSettings.logoUrl, imgProps.fileType, currentX + (cellWidth - imgWidth) / 2, currentY + (maxHeightInRow - imgHeight) / 2, imgWidth, imgHeight);
                    } catch (e) { console.error("Erreur logo.", e); }
                } else if (cellText !== '{logo}') {
                    doc.text(cellText, currentX + (cellWidth / 2), currentY + (maxHeightInRow / 2), { align: 'center', baseline: 'middle', maxWidth: cellWidth - 6 });
                }
                currentX += cellWidth;
            }
            currentY += maxHeightInRow;
        }
        currentY += 10;
    }
    
    // --- TITRE DU DOCUMENT ---
    const moduleDefaultTitle = `Fiche d'Enlèvement Pique-Nique - ${entry.clientName}`;
    let finalTitle = pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle ? pdfSettings.documentBaseTitle.trim() : "";
    if (pdfSettings.showModuleTitle) {
        finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
    }
    if (finalTitle) {
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text(finalTitle, pageWidth / 2, currentY, { align: 'center' });
        currentY += pdfSettings.documentTitleFontSize + 15;
    }

    doc.setFontSize(10); doc.setFont(undefined, 'normal');
    const paragraph1 = "Ce Repas a été préparé en respectant scrupuleusement les règles d'hygiène en vigueur. Les repas sont stockés en réfrigération positive à 3° en attente d'enlèvement.";
    const paragraph2 = "Afin de conserver cette commande, il est impératif de le garder stocké en glacière, avec pains de glace ou plaques eutectiques.";
    const paragraph3 = "L'établissement décline toute responsabilité après enlèvement de ce repas.";
    
    doc.text(doc.splitTextToSize(paragraph1, contentWidth), marginLeft, currentY);
    currentY += doc.getTextDimensions(doc.splitTextToSize(paragraph1, contentWidth)).h + 10;
    doc.text(doc.splitTextToSize(paragraph2, contentWidth), marginLeft, currentY);
    currentY += doc.getTextDimensions(doc.splitTextToSize(paragraph2, contentWidth)).h + 10;
    doc.text(doc.splitTextToSize(paragraph3, contentWidth), marginLeft, currentY);
    currentY += doc.getTextDimensions(doc.splitTextToSize(paragraph3, contentWidth)).h + 25;

    const orderDateStr = isValid(parseISO(entry.orderReceivedDate)) ? format(parseISO(entry.orderReceivedDate), "dd/MM/yyyy", { locale: fr }) : "Date Invalide";
    
    let detailsY = currentY;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("Commande reçue le:", marginLeft, detailsY);
    doc.setFont(undefined, 'normal');
    doc.text(orderDateStr, marginLeft + 140, detailsY);
    detailsY += 20;

    doc.setFont(undefined, 'bold');
    doc.text("À:", marginLeft, detailsY);
    doc.setFont(undefined, 'normal');
    doc.text(`${(entry.orderReceivedTime || 'N/A').replace(':', 'H')}`, marginLeft + 140, detailsY);
    detailsY += 20;

    doc.setFont(undefined, 'bold');
    doc.text("Lieu:", marginLeft, detailsY);
    doc.setFont(undefined, 'normal');
    doc.text("Brebières", marginLeft + 140, detailsY);
    
    currentY = detailsY + 30;

    const signatureTableBody = [
      [{ content: 'Le cuisinier\nMr Dernoncourt Julien', styles: { halign: 'center', valign: 'top', minCellHeight: 80 } },
       { content: `Le client\n${entry.clientName}`, styles: { halign: 'center', valign: 'top', minCellHeight: 80 } }]
    ];

    doc.autoTable({
      startY: currentY, body: signatureTableBody, theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5, font: pdfSettings.fontFamily || 'helvetica' },
      margin: { left: marginLeft, right: marginRight },
    });
    currentY = (doc as any).lastAutoTable.finalY + 20;

    let finalDetailsY = currentY;
    doc.setFont(undefined, 'bold');
    doc.text("Nombre de Pique-Niques:", marginLeft, finalDetailsY);
    doc.setFont(undefined, 'normal');
    doc.text(`${entry.numberOfPicnics} PN`, marginLeft + 150, finalDetailsY);
    finalDetailsY += 20;
    
    doc.setFont(undefined, 'bold');
    doc.text("T° de Départ:", marginLeft, finalDetailsY);
    doc.setFont(undefined, 'normal');
    doc.text(`${entry.departureTemperature}°C`, marginLeft + 150, finalDetailsY);
    
    currentY = finalDetailsY + 15;
    
    if (pdfSettings.footerText) {
      doc.setFontSize(pdfSettings.footerFontSize);
      doc.text(
        pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', String(pageNumber)).replace('{totalPages}', String(totalPages)),
        marginLeft, pageHeight - (marginBottom / 2)
      );
    }
};

export default function PicnicDepartureForm() {
  const [forms, setForms] = useState<PicnicDepartureEntry[]>([]);
  const [clients, setClients] = useState<PmsZone[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<PicnicDepartureEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const isMobile = useMobile();
  const [showForm, setShowForm] = useState(false);

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
      } else {
        setClients([]);
      }
    } catch (error) {
      console.error("Error loading clients from Firestore:", error);
      toast({ title: "Erreur de chargement des clients", variant: "destructive" });
    }
  }, [toast]);

  const fetchForms = useCallback(async () => {
    setIsLoading(true);
    try {
      const formsCollectionRef = collection(firestore, FIRESTORE_COLLECTION);
      const q = query(formsCollectionRef, orderBy("orderReceivedDate", "desc"));
      const querySnapshot = await getDocs(q);
      const loadedForms = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          entryCreationDate: (data.entryCreationDate as Timestamp).toDate().toISOString(),
          orderReceivedDate: (data.orderReceivedDate as Timestamp).toDate().toISOString(),
        } as PicnicDepartureEntry;
      });
      setForms(loadedForms);
    } catch (error) {
      console.error("Error loading picnic departure forms from Firestore:", error);
      toast({ title: "Erreur de chargement", description: "Données des fiches de départ PN non chargées.", variant: "destructive" });
      setForms([]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchForms();
    fetchClients();
  }, [fetchForms, fetchClients]);

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
    if (isMobile) {
      setShowForm(true);
    } else {
      setIsDialogOpen(true);
    }
  };

  const handleFormSubmit = async (data: PicnicDepartureFormData) => {
    setIsLoading(true);
    const entryDataForFirestore = {
      orderReceivedDate: Timestamp.fromDate(data.orderReceivedDate),
      orderReceivedTime: data.orderReceivedTime,
      clientName: data.clientName,
      numberOfPicnics: data.numberOfPicnics,
      departureTemperature: data.departureTemperature,
    };

    try {
      if (editingForm) {
        const formDocRef = doc(firestore, FIRESTORE_COLLECTION, editingForm.id);
        await setDoc(formDocRef, {
            ...entryDataForFirestore,
             entryCreationDate: Timestamp.fromDate(new Date(editingForm.entryCreationDate)),
          });
        toast({ title: "Fiche Modifiée" });
      } else {
        await addDoc(collection(firestore, FIRESTORE_COLLECTION), {
            ...entryDataForFirestore,
            entryCreationDate: Timestamp.fromDate(new Date()),
        });
        toast({ title: "Fiche Ajoutée" });
      }
      fetchForms();
    } catch (error) {
      console.error("Error saving picnic departure form to Firestore:", error);
      toast({ title: "Erreur de Sauvegarde", variant: "destructive"});
    } finally {
      setIsLoading(false);
      setIsDialogOpen(false);
      setShowForm(false);
    }
  };

  const handleDeleteForm = async (formId: string) => {
    setIsLoading(true);
    try {
      await deleteDoc(doc(firestore, FIRESTORE_COLLECTION, formId));
      toast({ title: "Fiche Supprimée", variant: "destructive" });
      fetchForms();
    } catch (error) {
      console.error("Error deleting picnic departure form from Firestore:", error);
      toast({ title: "Erreur de Suppression", variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  };
  
  const generatePdfForEntry = async (entry: PicnicDepartureEntry) => {
    setIsLoading(true);
    try {
      const pdfSettings = await getPdfLayoutSettings('pms_picnic_departure_form');
      const doc = new jsPDF({ 
        unit: 'pt', 
        format: pdfSettings.pageSize as any || 'a4',
        orientation: pdfSettings.orientation as any || 'portrait',
      }) as jsPDFWithAutoTable;
      
      await drawSingleFormPage(doc, entry, 1, 1);
      
      doc.save(`Fiche_Depart_PN_${entry.clientName.replace(/\s+/g, '_')}_${format(parseISO(entry.orderReceivedDate), "yyyyMMdd")}.pdf`);
      toast({ title: "PDF Fiche Départ Généré" });

    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${error.message || String(error)}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const generateMonthlyPdfsByClient = async () => {
    setIsLoading(true);
    try {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      const monthlyForms = forms.filter(f => {
        const orderDate = parseISO(f.orderReceivedDate);
        return orderDate >= monthStart && orderDate <= monthEnd;
      });

      if (monthlyForms.length === 0) {
        toast({ title: "Aucune Donnée", description: "Aucune fiche de départ pour le mois sélectionné." });
        setIsLoading(false);
        return;
      }

      const formsByClient = monthlyForms.reduce((acc, form) => {
        const clientName = form.clientName || 'Client Inconnu';
        if (!acc[clientName]) acc[clientName] = [];
        acc[clientName].push(form);
        return acc;
      }, {} as Record<string, PicnicDepartureEntry[]>);

      const clientCount = Object.keys(formsByClient).length;

      for (const clientName in formsByClient) {
        const clientForms = formsByClient[clientName].sort((a, b) => new Date(a.orderReceivedDate).getTime() - new Date(b.orderReceivedDate).getTime());

        const pdfSettings = await getPdfLayoutSettings('pms_picnic_departure_form');
        const doc = new jsPDF({ 
          unit: 'pt', 
          format: pdfSettings.pageSize as any || 'a4',
          orientation: pdfSettings.orientation as any || 'portrait',
        }) as jsPDFWithAutoTable;
        
        for (let i = 0; i < clientForms.length; i++) {
          if (i > 0) doc.addPage();
          await drawSingleFormPage(doc, clientForms[i], i + 1, clientForms.length);
        }

        doc.save(`Fiches_${clientName.replace(/\s+/g, '_')}_${format(selectedMonth, "yyyy_MM")}.pdf`);
      }
      
      toast({ title: "PDFs par client générés", description: `${clientCount} fichier(s) PDF ont été créés.` });

    } catch (error: any) {
      console.error("Error generating monthly PDFs by client:", error);
      toast({ title: "Erreur PDF Mensuel", description: `La génération a échoué: ${error.message || String(error)}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  
  const filteredForms = forms.filter(f => {
      const orderDate = parseISO(f.orderReceivedDate);
      return orderDate >= startOfMonth(selectedMonth) && orderDate <= endOfMonth(selectedMonth);
  });

  const renderForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
        <FormField control={form.control} name="orderReceivedDate" render={({ field }) => (
          <FormItem className="flex flex-col"><FormLabel>Commande reçue le</FormLabel>
          <Popover modal={true}>
            <PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
              {field.value ? format(field.value, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
              <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
          </Button></FormControl></PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent></Popover><FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="orderReceivedTime" render={({ field }) => (<FormItem><FormLabel>À ... H ... (Heure de réception)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
        <FormField control={form.control} name="numberOfPicnics" render={({ field }) => (<FormItem><FormLabel>Nombre de Pique-Niques</FormLabel><FormControl><Input type="number" placeholder="0" min="1" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="departureTemperature" render={({ field }) => (<FormItem><FormLabel>T° de Départ</FormLabel><FormControl><Input placeholder="Ex: 3" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
          <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingForm ? "Enregistrer" : "Ajouter Fiche"}</Button>
        </DialogFooter>
      </form>
    </Form>
  );

  if (isMobile) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBasket className="w-6 h-6 text-primary"/>
              {showForm ? (editingForm ? "Modifier" : "Nouvelle") + " Fiche" : "Départ Pique-Nique"}
            </div>
            {!showForm && (
              <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/> Ajouter</Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showForm ? renderForm() : (
            <>
              {isLoading && filteredForms.length === 0 ? ( 
                <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin"/></div>
              ) : !isLoading && filteredForms.length === 0 ? ( 
                <p className="text-muted-foreground text-center py-8">Aucune fiche de départ.</p>
              ) : (
                <div className="overflow-x-auto border rounded-md max-h-[60vh]">
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead className="text-center">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredForms.map(entry => (
                        <TableRow key={entry.id}>
                          <TableCell>{format(parseISO(entry.orderReceivedDate), "dd/MM/yy")}</TableCell>
                          <TableCell>{entry.clientName}</TableCell>
                          <TableCell className="text-center space-x-1">
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Non</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteForm(entry.id)}>Oui</AlertDialogAction>
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
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBasket className="w-6 h-6 text-primary"/>
            Fiche d'Enlèvement Pique-Nique
          </div>
           <div className="flex items-center gap-2">
              <Popover modal={true}>
                <PopoverTrigger asChild>
                  <Button variant={"outline"}>
                    <LucideCalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedMonth, "MMMM yyyy", { locale: fr })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedMonth}
                    onSelect={(date) => {
                      if (date) setSelectedMonth(date);
                    }}
                    initialFocus
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
              <Button onClick={generateMonthlyPdfsByClient} disabled={isLoading || filteredForms.length === 0}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF du mois
              </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4"/> Nouvelle Fiche</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{editingForm ? "Modifier" : "Nouvelle"} Fiche de Départ Pique-Nique</DialogTitle></DialogHeader>
                {renderForm()}
              </DialogContent>
            </Dialog>
          </div>
        </CardTitle>
        <CardDescription>
          Créez et gérez les fiches d'enlèvement pour les préparations culinaires (pique-niques). Affichez les fiches par mois.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && filteredForms.length === 0 ? ( 
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Chargement des données...</div>
        ) : !isLoading && filteredForms.length === 0 ? ( 
          <p className="text-muted-foreground text-center py-8">Aucune fiche de départ enregistrée pour {format(selectedMonth, "MMMM yyyy", { locale: fr })}.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date Cde.</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Heure Cde.</TableHead>
                  <TableHead className="text-right">Nb PN</TableHead>
                  <TableHead>T° Départ</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredForms.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>{format(parseISO(entry.orderReceivedDate), "dd/MM/yy", { locale: fr })}</TableCell>
                    <TableCell>{entry.clientName}</TableCell>
                    <TableCell>{entry.orderReceivedTime}</TableCell>
                    <TableCell className="text-right">{entry.numberOfPicnics}</TableCell>
                    <TableCell>{entry.departureTemperature}</TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button variant="outline" size="icon" onClick={() => generatePdfForEntry(entry)} className="h-7 w-7" disabled={isLoading} title="Générer PDF">
                        <FileText className="h-3.5 w-3.5"/>
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
                            <AlertDialogAction onClick={() => handleDeleteForm(entry.id)} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Supprimer
                            </AlertDialogAction>
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
