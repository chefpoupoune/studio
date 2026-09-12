'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { TempChangeEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription as CardDesc } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, FileText, Loader2, ArrowDownUp, CalendarIcon as LucideCalendarIcon, Wind, Flame, CheckCircle } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc, query, orderBy, Timestamp, where } from 'firebase/firestore';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const tempChangeEntrySchema = z.object({
  coolingDate: z.date({ required_error: "Date requise." }),
  productName: z.string().min(1, "Nom du produit requis."),
  quantity: z.string().min(1, "Quantité requise."),
  cooledWithWater: z.boolean().optional(),
  servedCold: z.boolean().optional(),
  coolingStartProductTemp: z.string().optional(),
  coolingHotProductTime: z.string().optional(),
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

type ActionFormData = {
    finalTemp: string;
    visa?: string;
}

// Isolated Action Dialog Component
interface ActionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  entry: TempChangeEntry | null;
  type: 'cooling' | 'reheating' | 'startReheating' | null;
  onSubmit: (data: ActionFormData) => void;
}

const ActionDialog: React.FC<ActionDialogProps> = ({ isOpen, onOpenChange, entry, type, onSubmit }) => {
    const currentActionSchema = type === 'startReheating'
        ? z.object({ finalTemp: z.string().min(1, "Température requise."), visa: z.string().optional() })
        : z.object({ finalTemp: z.string().min(1, "Température requise."), visa: z.string().min(1, "Visa requis.") });

    const form = useForm<ActionFormData>({
        resolver: zodResolver(currentActionSchema),
        defaultValues: { finalTemp: '', visa: '' }
    });

    useEffect(() => {
        if (isOpen) {
            form.reset({ finalTemp: '', visa: '' });
        }
    }, [isOpen, form]);

    const getTitle = () => {
        switch(type) {
            case 'cooling': return 'Fin du Refroidissement';
            case 'startReheating': return 'Début de la Remise en T°';
            case 'reheating': return 'Fin de la Remise en T°';
            default: return '';
        }
    };

    const getTempLabel = () => {
        switch(type) {
            case 'startReheating': return 'Température de Départ (°C)';
            default: return 'Température Finale (°C)';
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[90vw] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{getTitle()}</DialogTitle>
                    <DialogDescription>
                        Pour le produit : {entry?.productName}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="finalTemp" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{getTempLabel()}</FormLabel>
                                <FormControl><Input placeholder="Ex: 8" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                       {type !== 'startReheating' && (
                           <FormField control={form.control} name="visa" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Visa (Initiales)</FormLabel>
                                    <FormControl><Input placeholder="Ex: JD" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                       )}
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                            <Button type="submit">Valider</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};


export default function TempChangeMonitoring() {
  const [entries, setEntries] = useState<TempChangeEntry[]>([]);
  const [isInitiallyLoading, setIsInitiallyLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TempChangeEntry | null>(null);
  const { toast } = useToast();
  const [isSuperviseur, setIsSuperviseur] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionEntry, setActionEntry] = useState<TempChangeEntry | null>(null);
  const [actionType, setActionType] = useState<'cooling' | 'reheating' | 'startReheating' | null>(null);
  
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
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
      checkScreenSize();
      window.addEventListener('resize', checkScreenSize);
      
      const userPermissions = localStorage.getItem('LOGGED_IN_USER_PERMISSIONS_KEY');
      if (userPermissions) {
        try { const parsedPermissions = JSON.parse(userPermissions); setIsSuperviseur(parsedPermissions.role === 'superviseur'); } catch (e) { console.error("Failed to parse user permissions:", e); }
      }
      return () => window.removeEventListener('resize', checkScreenSize);
    }
  }, []);

  const mainForm = useForm<TempChangeFormData>({ resolver: zodResolver(tempChangeEntrySchema), defaultValues: { cooledWithWater: false, servedCold: false } });
  const watchedServedCold = mainForm.watch("servedCold");

  const fetchEntries = useCallback(async () => {
    try {
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

      const entriesCollectionRef = collection(firestore, 'pmsTempChangeLog');
      const q = query(entriesCollectionRef, 
        where("coolingDate", ">=", Timestamp.fromDate(startOfMonth)),
        where("coolingDate", "<=", Timestamp.fromDate(endOfMonth)),
        orderBy("coolingDate", "desc")
      );
      const querySnapshot = await getDocs(q);
      const loadedEntries = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id, ...data,
          coolingDate: (data.coolingDate as Timestamp).toDate().toISOString(),
          reheatingDate: data.reheatingDate ? (data.reheatingDate as Timestamp).toDate().toISOString() : null,
        } as TempChangeEntry;
      });
      setEntries(loadedEntries);
    } catch (error) {
      console.error("Error loading entries:", error);
      toast({ title: "Erreur de chargement", variant: "destructive" });
    }
  }, [toast, selectedDate]);


  useEffect(() => {
    setIsInitiallyLoading(true);
    fetchEntries().finally(() => setIsInitiallyLoading(false));
  }, [fetchEntries]);

  const handleOpenDialog = (entry?: TempChangeEntry) => {
    setEditingEntry(entry || null);
    if (entry) {
      mainForm.reset({
        ...entry,
        coolingDate: entry.coolingDate ? parseISO(entry.coolingDate) : new Date(),
        reheatingDate: entry.reheatingDate ? parseISO(entry.reheatingDate) : null,
      });
    } else {
      mainForm.reset({
        coolingDate: new Date(), productName: '', quantity: '',
        cooledWithWater: false, servedCold: false,
        coolingStartProductTemp: '',
        coolingHotProductTime: format(new Date(), 'HH:mm'), coolingColdProductTime: '', coolingColdProductTemp: '', coolingVisa: '',
        reheatingDate: null, reheatingColdProductTime: '', reheatingColdProductTemp: '', reheatingHotProductTime: '', reheatingHotProductTemp: '', reheatingVisa: '',
      });
    }
    setIsDialogOpen(true);
  };
  
  const handleOpenActionDialog = (entry: TempChangeEntry, type: 'cooling' | 'reheating' | 'startReheating') => {
    setActionEntry(entry);
    setActionType(type);
    setIsActionDialogOpen(true);
  };

const handleFormSubmit = async (data: TempChangeFormData) => {
    setIsSubmitting(true);
    const isNew = !editingEntry;

    if (data.servedCold) {
        data.reheatingDate = null;
        data.reheatingColdProductTime = ''; data.reheatingColdProductTemp = '';
        data.reheatingHotProductTime = ''; data.reheatingHotProductTemp = '';
        data.reheatingVisa = '';
    }

    const entryDataForFirestore = {
        ...data,
        coolingDate: Timestamp.fromDate(data.coolingDate || new Date()),
        reheatingDate: data.reheatingDate ? Timestamp.fromDate(data.reheatingDate) : null,
    };

    try {
      if (isNew) {
        await addDoc(collection(firestore, 'pmsTempChangeLog'), entryDataForFirestore);
        toast({ title: "Produit Ajouté" });
      } else {
        const entryDocRef = doc(firestore, 'pmsTempChangeLog', editingEntry!.id);
        await setDoc(entryDocRef, entryDataForFirestore, { merge: true });
        toast({ title: "Produit Modifié" });
      }

      if (data.coolingDate && (data.coolingDate.getMonth() !== selectedDate.getMonth() || data.coolingDate.getFullYear() !== selectedDate.getFullYear())) {
          setSelectedDate(data.coolingDate);
      } else {
          await fetchEntries();
      }
    } catch (error) {
      console.error("Error saving entry:", error);
      toast({ title: "Erreur de Sauvegarde", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setIsDialogOpen(false);
    }
};

  const handleActionSubmit = (data: ActionFormData) => {
    if (!actionEntry || !actionType) return;

    const originalEntries = [...entries];
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    const updatedFields: Partial<TempChangeEntry> = {};

    if (actionType === 'cooling') {
      updatedFields.coolingColdProductTime = currentTime;
      updatedFields.coolingColdProductTemp = data.finalTemp;
      updatedFields.coolingVisa = data.visa;
      if (actionEntry.servedCold) {
        updatedFields.reheatingVisa = "Servi Froid";
        updatedFields.reheatingHotProductTemp = "0";
      }
    } else if (actionType === 'startReheating') {
        updatedFields.reheatingDate = now.toISOString();
        updatedFields.reheatingColdProductTime = currentTime;
        updatedFields.reheatingColdProductTemp = data.finalTemp;
    } else if (actionType === 'reheating') {
      updatedFields.reheatingHotProductTime = currentTime;
      updatedFields.reheatingHotProductTemp = data.finalTemp;
      updatedFields.reheatingVisa = data.visa;
      if (!actionEntry.reheatingDate) {
          updatedFields.reheatingDate = now.toISOString();
      }
      if (!actionEntry.reheatingColdProductTime) {
        updatedFields.reheatingColdProductTime = currentTime;
      }
    }

    setEntries(prevEntries =>
      prevEntries.map(e => e.id === actionEntry.id ? { ...e, ...updatedFields } : e)
    );
    setIsActionDialogOpen(false);

    const runAsyncUpdate = async () => {
      try {
        const fieldsForFirestore: any = { ...updatedFields };
        if (fieldsForFirestore.reheatingDate && typeof fieldsForFirestore.reheatingDate === 'string') {
          fieldsForFirestore.reheatingDate = Timestamp.fromDate(new Date(fieldsForFirestore.reheatingDate));
        }
        const entryDocRef = doc(firestore, 'pmsTempChangeLog', actionEntry.id);
        await setDoc(entryDocRef, fieldsForFirestore, { merge: true });
        toast({ title: `Action enregistrée!` });
      } catch (error) {
        console.error("Error updating entry:", error);
        toast({ title: "Erreur de mise à jour", variant: "destructive" });
        setEntries(originalEntries);
      }
    };
    runAsyncUpdate();
  };

  const handleDeleteEntry = (entryId: string) => {
      const originalEntries = [...entries];
      setEntries(prevEntries => prevEntries.filter(entry => entry.id !== entryId));
      
      const runAsyncDelete = async () => {
        try {
          await deleteDoc(doc(firestore, 'pmsTempChangeLog', entryId));
          toast({ title: "Enregistrement Supprimé", variant: "destructive" });
        } catch (error) {
          console.error("Error deleting entry:", error);
          toast({ title: "Erreur de Suppression", variant: "destructive" });
          setEntries(originalEntries);
        }
      };
      runAsyncDelete();
  };
    
   const generatePdf = async () => {
    setIsSubmitting(true);
    try {
        const pdfSettings = await getPdfLayoutSettings('pms_temp_change_monitoring');
        const doc = new jsPDF({
            orientation: pdfSettings.orientation as any || 'landscape',
            unit: 'pt',
            format: pdfSettings.pageSize as any || 'a4',
        }) as jsPDFWithAutoTable;
        
        const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

        let currentY = pdfSettings.marginTop;
        const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;
        
        const effectiveHeaderText = pdfSettings.headerText || (pdfSettings.logoUrl ? '{logo}' : '');

        if (effectiveHeaderText) {
            const headerRows = effectiveHeaderText.split('\n');
            doc.setFontSize(pdfSettings.headerFontSize);
            for (const row of headerRows) {
                const cells = row.split('|');
                if (cells.length === 0) continue;
                const cellWidth = pageContentWidth / cells.length;
                let maxHeightInRow = 0;
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
                    doc.rect(currentX, currentY, cellWidth, maxHeightInRow, 'S');
                    if (cellText === '{logo}' && pdfSettings.logoUrl) {
                        try {
                            const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                            const formatType = imgProps.fileType.toUpperCase();
                            const desiredImgHeight = Math.min(maxHeightInRow - 6, 40);
                            const imgWidth = (imgProps.width * desiredImgHeight) / imgProps.height;
                            const imgX = currentX + (cellWidth - imgWidth) / 2;
                            const imgY = currentY + (maxHeightInRow - desiredImgHeight) / 2;
                            doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, desiredImgHeight);
                        } catch (e) { console.error("Erreur d'ajout du logo.", e); }
                    } else if (cellText !== '{logo}') {
                        doc.text(cellText, currentX + (cellWidth / 2), currentY + (maxHeightInRow / 2), { align: 'center', baseline: 'middle', maxWidth: cellWidth - 6 });
                    }
                    currentX += cellWidth;  
                }
                currentY += maxHeightInRow;
            }
            currentY += 10;
        }

        const monthYearTitle = format(selectedDate, 'MMMM yyyy', { locale: fr });
        const moduleDefaultTitle = `Suivi Baisse / Remise en Température - ${monthYearTitle}`;
        let finalTitle = "";
        if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle) {
            finalTitle = pdfSettings.documentBaseTitle.trim();
        }
        if (pdfSettings.showModuleTitle) {
            finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
        }
        if (finalTitle) {
            doc.setFontSize(pdfSettings.documentTitleFontSize);
            doc.text(finalTitle, doc.internal.pageSize.width / 2, currentY, { align: 'center' });
            currentY += pdfSettings.documentTitleFontSize + 5;
        }

        const baseHeadStyles = { fontSize: 7, fontStyle: 'bold', halign: 'center', valign: 'middle', cellPadding: 1, textColor: [0, 0, 0] };
        
        const mainHeadStyles = { ...baseHeadStyles };
        if (pdfSettings.primaryColor) {
            const rgb = hexToRgb(pdfSettings.primaryColor);
            if (rgb) {
                mainHeadStyles.fillColor = [rgb.r, rgb.g, rgb.b];
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                mainHeadStyles.textColor = brightness > 125 ? [0, 0, 0] : [255, 255, 255];
            }
        }
        
        const orangeHeadStyle = { ...baseHeadStyles, fillColor: '#fed7aa' };
        const blueHeadStyle = { ...baseHeadStyles, fillColor: '#bfdbfe' };
        
        const orangeBodyStyle = { fillColor: '#fed7aa' };
        const blueBodyStyle = { fillColor: '#bfdbfe' };

        const head: any[] = [
            [
                { content: 'Date', rowSpan: 2, styles: mainHeadStyles }, { content: 'Produit', rowSpan: 2, styles: mainHeadStyles }, { content: 'Qté', rowSpan: 2, styles: mainHeadStyles }, { content: 'T° Départ', rowSpan: 2, styles: mainHeadStyles },
                { content: 'REFROIDISSEMENT RAPIDE', colSpan: 4, styles: mainHeadStyles },
                { content: 'REMISE EN TEMPERATURE', colSpan: 6, styles: mainHeadStyles },
            ],
            [
                { content: 'P. chauds\nHeure', styles: orangeHeadStyle },
                { content: 'P. froids\nHeure', styles: blueHeadStyle }, { content: 'P. froids\nT°', styles: blueHeadStyle },
                { content: 'Visa', styles: mainHeadStyles }, { content: 'Date', styles: mainHeadStyles },
                { content: 'P. froids\nHeure', styles: blueHeadStyle }, { content: 'P. froids\nT°', styles: blueHeadStyle },
                { content: 'P. chauds\nHeure', styles: orangeHeadStyle }, { content: 'P. chauds\nT°', styles: orangeHeadStyle },
                { content: 'Visa', styles: mainHeadStyles },
            ]
        ];

        const body = entries.map(entry => {
            const reheatingPart = entry.servedCold
                ? [{ content: 'Servi Froid', colSpan: 6, styles: { halign: 'center', fontStyle: 'bold' } }]
                : [
                    entry.reheatingDate ? format(parseISO(entry.reheatingDate), "dd/MM/yy", { locale: fr }) : '-',
                    { content: entry.reheatingColdProductTime || '-', styles: blueBodyStyle },
                    { content: entry.reheatingColdProductTemp || '-', styles: blueBodyStyle },
                    { content: entry.reheatingHotProductTime || '-', styles: orangeBodyStyle },
                    { content: entry.reheatingHotProductTemp || '-', styles: orangeBodyStyle },
                    entry.reheatingVisa || '-',
                ];

            return [
                format(parseISO(entry.coolingDate), "dd/MM/yy", { locale: fr }),
                entry.productName + (entry.cooledWithWater ? ' (eau)' : ''),
                entry.quantity,
                entry.coolingStartProductTemp ? `${entry.coolingStartProductTemp}°C` : '-',
                { content: entry.coolingHotProductTime || '-', styles: orangeBodyStyle },
                { content: entry.coolingColdProductTime || '-', styles: blueBodyStyle },
                { content: entry.coolingColdProductTemp || '-', styles: blueBodyStyle },
                entry.coolingVisa || '-',
                ...reheatingPart,
            ];
        });

        doc.autoTable({
            head: head, body: body, startY: currentY, theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1, valign: 'middle', halign: 'center', textColor: [0,0,0] },
            columnStyles: { 1: { halign: 'left' } },
            margin: { top: pdfSettings.marginTop, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
            didDrawPage: (data) => {
                const pageCount = doc.internal.getNumberOfPages();
                if (pdfSettings.footerText) {
                    let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
                    doc.setFontSize(pdfSettings.footerFontSize);
                    doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
                }
            },
        });
        doc.save(`Suivi_Baisse_Remise_Temperature_${format(selectedDate, "yyyy-MM")}.pdf`);
        toast({ title: "PDF Généré", description: "Le téléchargement de votre document a commencé." });
    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
};

  const DesktopView = () => (
      <>
      <CardContent>
        {isInitiallyLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin"/> Chargement...</div>
        ) : !isInitiallyLoading && entries.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Aucun enregistrement.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md max-h-[65vh]">
             <Table>
                <TableHeader>
                    <TableRow className="bg-primary/10 text-xs whitespace-nowrap">
                    <TableHead rowSpan={2} className="text-center align-middle border-r min-w-[80px] sticky left-0 bg-primary/10 z-20">Actions</TableHead>
                    <TableHead rowSpan={2} className="text-center align-middle border-r min-w-[90px]">Date</TableHead>
                    <TableHead rowSpan={2} className="text-center align-middle border-r min-w-[150px]">Produit</TableHead>
                    <TableHead rowSpan={2} className="text-center align-middle border-r min-w-[80px]">Quantité</TableHead>
                    <TableHead rowSpan={2} className="text-center align-middle border-r min-w-[70px]">T° Départ</TableHead>
                    <TableHead colSpan={4} className="text-center font-semibold border-r py-1">REFROIDISSEMENT RAPIDE</TableHead>
                    <TableHead colSpan={6} className="text-center font-semibold py-1">REMISE EN TEMPERATURE</TableHead> 
                    </TableRow>
                    <TableRow className="bg-primary/10 text-xs whitespace-nowrap">
                    <TableHead className="text-center border-r bg-orange-200 dark:bg-orange-700/50 min-w-[70px]">P.Chauds<br/>Heure</TableHead>
                    <TableHead className="text-center border-r bg-blue-200 dark:bg-blue-700/50 min-w-[70px]">P.Froids<br/>Heure</TableHead>
                    <TableHead className="text-center border-r bg-blue-200 dark:bg-blue-700/50 min-w-[60px]">P.Froids<br/>T°</TableHead>
                    <TableHead className="text-center border-r min-w-[60px]">Visa</TableHead>
                    <TableHead className="text-center border-r min-w-[90px]">Date</TableHead>
                    <TableHead className="text-center border-r bg-blue-200 dark:bg-blue-700/50 min-w-[70px]">P.Froids<br/>Heure</TableHead>
                    <TableHead className="text-center border-r bg-blue-200 dark:bg-blue-700/50 min-w-[60px]">P.Froids<br/>T°</TableHead>
                    <TableHead className="text-center border-r bg-orange-200 dark:bg-orange-700/50 min-w-[70px]">P.Chauds<br/>Heure</TableHead>
                    <TableHead className="text-center border-r bg-orange-200 dark:bg-orange-700/50 min-w-[60px]">P.Chauds<br/>T°</TableHead>
                    <TableHead className="text-center min-w-[60px]">Visa</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                    {entries.map(entry => {
                        const isServedCold = entry.servedCold;
                        return (
                            <TableRow key={entry.id} className="group">
                                <TableCell className="text-center sticky left-0 bg-white dark:bg-card group-hover:bg-muted/50 transition-colors z-10 border-r">
                                    <div className="flex items-center justify-center gap-1">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7" disabled={isSuperviseur}><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle><AlertDialogDescription>Action irréversible pour {entry.productName}.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteEntry(entry.id)} disabled={isSubmitting || isSuperviseur}>Supprimer</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                        <Button variant="outline" size="icon" onClick={() => handleOpenDialog(entry)} className="h-7 w-7" disabled={isSuperviseur}><Edit2 className="h-3.5 w-3.5"/></Button>
                                    </div>
                                </TableCell>
                                <TableCell className="border-r text-center">{format(parseISO(entry.coolingDate), "dd/MM/yy", { locale: fr })}</TableCell>
                                <TableCell className="border-r">{entry.productName}{entry.cooledWithWater ? " (eau)" : ""}</TableCell>
                                <TableCell className="border-r text-center">{entry.quantity}</TableCell>
                                <TableCell className="border-r text-center">{entry.coolingStartProductTemp ? `${entry.coolingStartProductTemp}°C` : '-'}</TableCell>
                                <TableCell className="border-r text-center">{entry.coolingHotProductTime || '-'}</TableCell>
                                <TableCell className="border-r text-center">{entry.coolingColdProductTime || '-'}</TableCell>
                                <TableCell className="border-r text-center">{entry.coolingColdProductTemp || '-'}</TableCell>
                                <TableCell className="border-r text-center">{entry.coolingVisa || '-'}</TableCell>
                                {isServedCold ? (
                                    <TableCell colSpan={6} className="text-center font-semibold text-muted-foreground">Servi Froid</TableCell>
                                ) : (
                                    <>
                                        <TableCell className="border-r text-center">{entry.reheatingDate ? format(parseISO(entry.reheatingDate), "dd/MM/yy", { locale: fr }) : '-'}</TableCell>
                                        <TableCell className="border-r text-center">{entry.reheatingColdProductTime || '-'}</TableCell>
                                        <TableCell className="border-r text-center">{entry.reheatingColdProductTemp || '-'}</TableCell>
                                        <TableCell className="border-r text-center">{entry.reheatingHotProductTime || '-'}</TableCell>
                                        <TableCell className="border-r text-center">{entry.reheatingHotProductTemp || '-'}</TableCell>
                                        <TableCell className="text-center font-semibold">{entry.reheatingVisa || '-'}</TableCell>
                                    </>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-4">
          {entries.length > 0 && !isMobile && (
            <Button onClick={generatePdf} disabled={isSubmitting}><FileText className="mr-2 h-4 w-4"/> Générer PDF</Button>
          )}
      </CardFooter>
      </>
  );

  const MobileView = () => {
    const entriesToAction = entries.filter(entry => {
        const isCoolingDone = !!entry.coolingColdProductTemp;
        const isReheatingComplete = !!entry.reheatingHotProductTemp;
        const isProcessComplete = isCoolingDone && (entry.servedCold || isReheatingComplete);
        return !isProcessComplete;
    });

    if (isInitiallyLoading) return <CardContent><div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin"/></div></CardContent>;
    if (entriesToAction.length === 0 && !isInitiallyLoading) return <CardContent><p className="text-center text-muted-foreground p-8">Aucun produit en attente d'action.</p></CardContent>;
    
    return (
        <CardContent className="p-2 sm:p-4 space-y-3">
            {entriesToAction.map(entry => {
                const isCoolingDone = !!entry.coolingColdProductTemp;
                const isReheatingStarted = !!entry.reheatingColdProductTime;
                const isServedCold = entry.servedCold;
                
                let statusText: string;
                let StatusIcon: React.ElementType;
                let statusColor: string;
                let actionButton: React.ReactNode;

                if (!isCoolingDone) {
                    statusText = "En refroidissement";
                    StatusIcon = Wind;
                    statusColor = "text-blue-500";
                    actionButton = (
                        <Button size="sm" className="w-full bg-blue-500 hover:bg-blue-600 text-white" disabled={isSuperviseur} onClick={() => handleOpenActionDialog(entry, 'cooling')}>
                            <Wind className="mr-2 h-4 w-4"/> Fin Refroidissement
                        </Button>
                    );
                } else if (!isReheatingStarted && !isServedCold) {
                    statusText = "Prêt pour remise en T°";
                    StatusIcon = Flame;
                    statusColor = "text-yellow-500";
                    actionButton = (
                        <Button size="sm" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white" disabled={isSuperviseur} onClick={() => handleOpenActionDialog(entry, 'startReheating')}>
                            <Flame className="mr-2 h-4 w-4"/> Début Remise en T°
                        </Button>
                    );
                } else if (isReheatingStarted && !isServedCold) {
                    statusText = "En remise en T°";
                    StatusIcon = Flame;
                    statusColor = "text-orange-500";
                    actionButton = (
                        <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600 text-white" disabled={isSuperviseur} onClick={() => handleOpenActionDialog(entry, 'reheating')}>
                            <Flame className="mr-2 h-4 w-4"/> Fin Remise en T°
                        </Button>
                    );
                } else {
                    // This case should technically not be rendered due to the filter, but as a fallback:
                    statusText = "Terminé";
                    StatusIcon = CheckCircle;
                    statusColor = "text-green-500";
                    actionButton = null;
                }

                return (
                    <Card key={entry.id} className="shadow-md border">
                        <CardHeader className="p-3">
                            <div className="flex flex-row items-start justify-between">
                                <div>
                                    <CardTitle className="text-base">{entry.productName}{entry.cooledWithWater ? <span className="text-xs font-normal text-muted-foreground"> (eau)</span> : ""}</CardTitle>
                                    <CardDesc>{entry.quantity}</CardDesc>
                                    {entry.coolingStartProductTemp && <CardDesc className="pt-1 text-xs">T° Départ: {entry.coolingStartProductTemp}°C</CardDesc>}
                                </div>
                                <div className={`flex items-center gap-2 ${statusColor}`}>
                                    <StatusIcon className="w-4 h-4" />
                                    <span className="text-xs font-semibold">{statusText}</span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardFooter className="p-3 flex justify-end">
                            {actionButton}
                        </CardFooter>
                    </Card>
                );
            })}
        </CardContent>
    );
  };

  return (
    <Card className="shadow-lg w-full">
      <CardHeader className="flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
    <div className="space-y-1.5">
      <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
        <ArrowDownUp className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        Suivi Baisse / Remise en T°
      </CardTitle>
      <CardDesc className="hidden md:block">
        Refroidissement rapide et remise en température des produits.
      </CardDesc>
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
        
        <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto" disabled={isSuperviseur && !editingEntry}>
            <PlusCircle className="mr-2 h-4 w-4" /> Ajouter
        </Button>
    </div>
      </CardHeader>
      
      {isMobile ? <MobileView /> : <DesktopView />}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
    <DialogContent
      className={isMobile ? "max-w-[95vw] h-[95vh] flex flex-col" : "sm:max-w-4xl"}
    >
      <DialogHeader><DialogTitle>{editingEntry ? "Modifier" : (isMobile ? "Nouveau Produit" : "Nouvel Enregistrement")}</DialogTitle></DialogHeader>
      <Form {...mainForm}>
        <form onSubmit={mainForm.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 flex-grow overflow-y-auto pr-2">

          <div className={cn("grid gap-3", isMobile && !editingEntry ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4")}>
            {!(isMobile && !editingEntry) && (
              <FormField
                control={mainForm.control}
                name="coolingDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover modal={true}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            <LucideCalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP', { locale: fr }) : <span>Choisir une date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={fr} initialFocus/>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField control={mainForm.control} name="productName" render={({ field }) => (<FormItem><FormLabel>Produit</FormLabel><FormControl><Input placeholder="Ex: Boeuf Bourguignon" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={mainForm.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantité</FormLabel><FormControl><Input placeholder="Ex: 5 kg" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={mainForm.control} name="coolingStartProductTemp" render={({ field }) => (<FormItem><FormLabel>T° de Départ (°C)</FormLabel><FormControl><Input placeholder="Ex: 65" type="text" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </div>

          <div className={cn("flex items-center space-x-4 pt-2", isMobile && !editingEntry ? "flex-col space-y-2 space-x-0" : "")}>
            <FormField control={mainForm.control} name="cooledWithWater" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-2 rounded-md border p-3 shadow-sm w-full sm:w-auto"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Refroidi à l'eau</FormLabel></FormItem> )}/>
            <FormField control={mainForm.control} name="servedCold" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-2 rounded-md border p-3 shadow-sm w-full sm:w-auto"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Servi froid</FormLabel></FormItem> )}/>
          </div>

          {!(isMobile && !editingEntry) && (
            <>
              <div className="pt-3 border-t">
                <h4 className="text-md font-semibold mb-2 flex items-center"><Wind className="mr-2 h-4 w-4 text-blue-500"/> Refroidissement Rapide</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <FormField control={mainForm.control} name="coolingHotProductTime" render={({ field }) => (<FormItem><FormLabel>P. Chauds Heure</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} disabled={isSuperviseur} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={mainForm.control} name="coolingColdProductTime" render={({ field }) => (<FormItem><FormLabel>P. Froids Heure</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} disabled={isSuperviseur} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={mainForm.control} name="coolingColdProductTemp" render={({ field }) => (<FormItem><FormLabel>P. Froids T°C</FormLabel><FormControl><Input placeholder="T°C" {...field} value={field.value || ''} disabled={isSuperviseur} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={mainForm.control} name="coolingVisa" render={({ field }) => (<FormItem><FormLabel>Visa</FormLabel><FormControl><Input placeholder="Initiales" {...field} value={field.value || ''} disabled={isSuperviseur} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </div>

              <div className="pt-3 border-t">
                <h4 className="text-md font-semibold mb-2 flex items-center"><Flame className="mr-2 h-4 w-4 text-orange-500"/> Remise en Température</h4>
                <fieldset disabled={watchedServedCold} className={cn(watchedServedCold && "opacity-50 pointer-events-none")}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      <FormField control={mainForm.control} name="reheatingDate" render={({ field }) => (
                          <FormItem className="flex flex-col">
                              <FormLabel>Date Remise</FormLabel>
                              <Popover modal={true}>
                                  <PopoverTrigger asChild>
                                      <FormControl>
                                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSuperviseur}>
                                              {field.value ? format(field.value, 'PPP', { locale: fr }) : <span>Choisir une date</span>}
                                              <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                          </Button>
                                      </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} locale={fr} initialFocus />
                                  </PopoverContent>
                              </Popover>
                              <FormMessage />
                          </FormItem>
                      )}/>
                      <FormField control={mainForm.control} name="reheatingColdProductTime" render={({ field }) => (<FormItem><FormLabel>P. Froids Heure</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} disabled={isSuperviseur} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={mainForm.control} name="reheatingColdProductTemp" render={({ field }) => (<FormItem><FormLabel>P. Froids T°C</FormLabel><FormControl><Input placeholder="T°C" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={mainForm.control} name="reheatingHotProductTime" render={({ field }) => (<FormItem><FormLabel>P. Chauds Heure</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={mainForm.control} name="reheatingHotProductTemp" render={({ field }) => (<FormItem><FormLabel>P. Chauds T°C</FormLabel><FormControl><Input placeholder="T°C" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={mainForm.control} name="reheatingVisa" render={({ field }) => (<FormItem><FormLabel>Visa</FormLabel><FormControl><Input placeholder="Initiales" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </fieldset>
              </div>
            </>
          )}

          <DialogFooter className="pt-4 sticky bottom-0 bg-card z-10 p-0 sm:p-2">
            <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting || isSuperviseur}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingEntry ? "Enregistrer" : "Ajouter"}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  </Dialog>


      <ActionDialog 
        isOpen={isActionDialogOpen}
        onOpenChange={setIsActionDialogOpen}
        entry={actionEntry}
        type={actionType}
        onSubmit={handleActionSubmit}
      />
    </Card>
  );
}
