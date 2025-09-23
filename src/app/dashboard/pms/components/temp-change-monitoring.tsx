"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { TempChangeEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription as CardDesc } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, FileText, Loader2, ArrowDownUp, CalendarIcon as LucideCalendarIcon, Wind, Flame } from 'lucide-react';
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
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';

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

const actionSchema = z.object({
  finalTemp: z.string().min(1, "Température requise."),
  visa: z.string().min(1, "Visa requis."),
});
type ActionFormData = z.infer<typeof actionSchema>;

// Isolated Action Dialog Component to prevent re-rendering the parent on input change
interface ActionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  entry: TempChangeEntry | null;
  type: 'cooling' | 'reheating' | null;
  onSubmit: (data: ActionFormData) => void;
}

const ActionDialog: React.FC<ActionDialogProps> = ({ isOpen, onOpenChange, entry, type, onSubmit }) => {
    const form = useForm<ActionFormData>({
        resolver: zodResolver(actionSchema),
        defaultValues: { finalTemp: '', visa: '' }
    });

    useEffect(() => {
        if (isOpen) {
            form.reset({ finalTemp: '', visa: '' });
        }
    }, [isOpen, form]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[90vw] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {type === 'cooling' ? 'Fin du Refroidissement' : 'Fin de la Remise en T°'}
                    </DialogTitle>
                    <DialogDescription>
                        Pour le produit : {entry?.productName}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="finalTemp" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Température Finale (°C)</FormLabel>
                                <FormControl><Input placeholder="Ex: 8" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
                         <FormField control={form.control} name="visa" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Visa (Initiales)</FormLabel>
                                <FormControl><Input placeholder="Ex: JD" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}/>
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
  const [actionType, setActionType] = useState<'cooling' | 'reheating' | null>(null);

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
      const entriesCollectionRef = collection(firestore, 'pmsTempChangeLog');
      const q = query(entriesCollectionRef, orderBy("coolingDate", "desc"));
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
  }, [toast]);

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
        coolingHotProductTime: format(new Date(), 'HH:mm'), coolingHotProductTemp: '', coolingColdProductTime: '', coolingColdProductTemp: '', coolingVisa: '',
        reheatingDate: null, reheatingColdProductTime: '', reheatingColdProductTemp: '', reheatingHotProductTime: '', reheatingHotProductTemp: '', reheatingVisa: '',
      });
    }
    setIsDialogOpen(true);
  };
  
  const handleOpenActionDialog = (entry: TempChangeEntry, type: 'cooling' | 'reheating') => {
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
      await fetchEntries(); 
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
    } else if (actionType === 'reheating') {
      updatedFields.reheatingHotProductTime = currentTime;
      updatedFields.reheatingHotProductTemp = data.finalTemp;
      updatedFields.reheatingVisa = data.visa;
      if (!actionEntry.reheatingColdProductTime) {
        updatedFields.reheatingDate = now.toISOString();
        updatedFields.reheatingColdProductTime = currentTime;
      }
    }

    // Optimistic UI update
    setEntries(prevEntries =>
      prevEntries.map(e => e.id === actionEntry.id ? { ...e, ...updatedFields } : e)
    );
    setIsActionDialogOpen(false);

    // Async DB update
    const runAsyncUpdate = async () => {
      try {
        const fieldsForFirestore: any = { ...updatedFields };
        if (fieldsForFirestore.reheatingDate) {
          fieldsForFirestore.reheatingDate = Timestamp.fromDate(now);
        }
        const entryDocRef = doc(firestore, 'pmsTempChangeLog', actionEntry.id);
        await setDoc(entryDocRef, fieldsForFirestore, { merge: true });
        toast({ title: `Action enregistrée!` });
      } catch (error) {
        console.error("Error updating entry:", error);
toast({ title: "Erreur de mise à jour", variant: "destructive" });
        // Revert the optimistic update on error
        setEntries(originalEntries);
      }
    };
    runAsyncUpdate();
  };

  const handleDeleteEntry = (entryId: string) => {
      const originalEntries = [...entries];
      // Optimistic UI update
      setEntries(prevEntries => prevEntries.filter(entry => entry.id !== entryId));
      
      // Async DB update
      const runAsyncDelete = async () => {
        try {
            await deleteDoc(doc(firestore, 'pmsTempChangeLog', entryId));
            toast({ title: "Enregistrement Supprimé", variant: "destructive" });
        } catch (error) {
            console.error("Error deleting entry:", error);
            toast({ title: "Erreur de Suppression", variant: "destructive" });
            setEntries(originalEntries); // Revert on error
        }
      };
      runAsyncDelete();
  };
    
    const generatePdf = () => {
        setIsSubmitting(true);
        try {
            const pdfSettings = getPdfLayoutSettings('pms_temp_change_monitoring'); 
            const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
            const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
            let currentY = 15;
            if (pdfSettings.headerText) { doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10; }
            doc.setFontSize(16); doc.text("Suivi Baisse / Remise en Température", 14, currentY); currentY += 8;
            doc.setFontSize(10); doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY); currentY += 7;

            const headStylesBase: any = { fontSize: 7, fontStyle: 'bold', halign: 'center', valign: 'middle', cellPadding: 1 };
            const primaryColorRgb = hexToRgb(pdfSettings.primaryColor || '#CCCCCC'); 
            if (primaryColorRgb) {
                headStylesBase.fillColor = primaryColorRgb;
                const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
                headStylesBase.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
            }
            const orangeColor = hexToRgb('#FFA500') || [255, 165, 0]; 
            const blueColor = hexToRgb('#ADD8E6') || [173, 216, 230]; 

            const head: any[] = [
                [
                    { content: '', colSpan: 4, styles: { ...headStylesBase, fillColor: [255,255,255], textColor: [0,0,0] } }, 
                    { content: 'REFROIDISSEMENT RAPIDE', colSpan: 5, styles: headStylesBase },
                    { content: 'REMISE EN TEMPERATURE', colSpan: 6, styles: headStylesBase }, 
                ],
                [
                    { content: 'Date', styles: headStylesBase }, { content: 'Produit', styles: headStylesBase }, { content: 'Quantité', styles: headStylesBase }, { content: 'T° Départ', styles: headStylesBase },
                    { content: 'P. chauds\nHeure', styles: {...headStylesBase, fillColor: orangeColor, textColor: [0,0,0]} },
                    { content: 'P. chauds\nT°', styles: {...headStylesBase, fillColor: orangeColor, textColor: [0,0,0]} },
                    { content: 'P. froids\nHeure', styles: {...headStylesBase, fillColor: blueColor, textColor: [0,0,0]} },
                    { content: 'P. froids\nT°', styles: {...headStylesBase, fillColor: blueColor, textColor: [0,0,0]} },
                    { content: 'Visa', styles: headStylesBase }, { content: 'Date', styles: headStylesBase }, 
                    { content: 'P. froids\nHeure', styles: {...headStylesBase, fillColor: blueColor, textColor: [0,0,0]} },
                    { content: 'P. froids\nT°', styles: {...headStylesBase, fillColor: blueColor, textColor: [0,0,0]} },
                    { content: 'P. chauds\nHeure', styles: {...headStylesBase, fillColor: orangeColor, textColor: [0,0,0]} },
                    { content: 'P. chauds\nT°', styles: {...headStylesBase, fillColor: orangeColor, textColor: [0,0,0]} },
                    { content: 'Visa', styles: headStylesBase },
                ]
            ];
            
            const body = entries.map(entry => {
                const reheatingPart = entry.servedCold
                    ? ['N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'Servi Froid']
                    : [
                        entry.reheatingDate ? format(parseISO(entry.reheatingDate), "dd/MM/yy", { locale: fr }) : '-',
                        entry.reheatingColdProductTime || '-',
                        entry.reheatingColdProductTemp || '-',
                        entry.reheatingHotProductTime || '-',
                        entry.reheatingHotProductTemp || '-',
                        entry.reheatingVisa || '-',
                    ];

                return [
                    format(parseISO(entry.coolingDate), "dd/MM/yy", { locale: fr }),
                    entry.productName + (entry.cooledWithWater ? ' (eau)' : ''),
                    entry.quantity,
                    entry.coolingStartProductTemp ? `${entry.coolingStartProductTemp}°C` : '-',
                    entry.coolingHotProductTime || '-',
                    entry.coolingHotProductTemp || '-',
                    entry.coolingColdProductTime || '-',
                    entry.coolingColdProductTemp || '-',
                    entry.coolingVisa || '-',
                    ...reheatingPart,
                ];
            });

            doc.autoTable({
                head: head, body: body, startY: currentY, theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1, valign: 'middle', halign: 'center' },
                headStyles: {halign: 'center', valign: 'middle', fontStyle: 'bold', cellPadding: 1, fontSize: 6.5},
                columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 30 }, 2: { cellWidth: 15 }, 3: { cellWidth: 15 }, 4: { cellWidth: 15 }, 5: { cellWidth: 12 }, 6: { cellWidth: 15 }, 7: { cellWidth: 12 }, 8: { cellWidth: 10 }, 9: { cellWidth: 15 }, 10: { cellWidth: 15 }, 11: { cellWidth: 12 }, 12: { cellWidth: 15 }, 13: { cellWidth: 12 }, 14: { cellWidth: 10 } },
                didDrawPage: (data) => {
                    const pageCount = doc.internal.getNumberOfPages();
                    if (pdfSettings.footerText) {
                        let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
                        doc.setFontSize(9); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
                    }
                },
            });
            doc.save(`Suivi_Baisse_Remise_Temperature_${format(new Date(), "yyyyMMdd")}.pdf`);
            toast({ title: "PDF Généré" });
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ title: "Erreur PDF", variant: "destructive" });
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
                    <TableHead colSpan={5} className="text-center font-semibold border-r py-1">REFROIDISSEMENT RAPIDE</TableHead>
                    <TableHead colSpan={6} className="text-center font-semibold py-1">REMISE EN TEMPERATURE</TableHead> 
                    </TableRow>
                    <TableRow className="bg-primary/10 text-xs whitespace-nowrap">
                    <TableHead className="text-center border-r bg-orange-200 dark:bg-orange-700/50 min-w-[70px]">P.Chauds<br/>Heure</TableHead>
                    <TableHead className="text-center border-r bg-orange-200 dark:bg-orange-700/50 min-w-[60px]">P.Chauds<br/>T°</TableHead>
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
                                <TableCell className="border-r text-center">{entry.coolingHotProductTemp || '-'}</TableCell>
                                <TableCell className="border-r text-center">{entry.coolingColdProductTime || '-'}</TableCell>
                                <TableCell className="border-r text-center">{entry.coolingColdProductTemp || '-'}</TableCell>
                                <TableCell className="border-r text-center">{entry.coolingVisa || '-'}</TableCell>
                                <TableCell className={cn("border-r text-center", isServedCold && "text-muted-foreground")}>{isServedCold ? 'N/A' : (entry.reheatingDate ? format(parseISO(entry.reheatingDate), "dd/MM/yy", { locale: fr }) : '-')}</TableCell>
                                <TableCell className={cn("border-r text-center", isServedCold && "text-muted-foreground")}>{isServedCold ? 'N/A' : entry.reheatingColdProductTime || '-'}</TableCell>
                                <TableCell className={cn("border-r text-center", isServedCold && "text-muted-foreground")}>{isServedCold ? 'N/A' : entry.reheatingColdProductTemp || '-'}</TableCell>
                                <TableCell className={cn("border-r text-center", isServedCold && "text-muted-foreground")}>{isServedCold ? 'N/A' : entry.reheatingHotProductTime || '-'}</TableCell>
                                <TableCell className={cn("border-r text-center", isServedCold && "text-muted-foreground")}>{isServedCold ? 'N/A' : entry.reheatingHotProductTemp || '-'}</TableCell>
                                <TableCell className={cn("text-center font-semibold", isServedCold && "text-muted-foreground")}>{isServedCold ? 'Servi Froid' : entry.reheatingVisa || '-'}</TableCell>
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
        const isProcessComplete = isCoolingDone && (entry.servedCold || !!entry.reheatingHotProductTemp);
        return !isProcessComplete;
    });

    if (isInitiallyLoading) return <CardContent><div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin"/></div></CardContent>;
    if (entriesToAction.length === 0 && !isInitiallyLoading) return <CardContent><p className="text-center text-muted-foreground p-8">Aucun produit en attente d'action.</p></CardContent>;
    
    return (
        <CardContent className="p-2 sm:p-4 space-y-3">
            {entriesToAction.map(entry => {
                const isCoolingDone = !!entry.coolingColdProductTemp;
                
                let statusText = "En refroidissement";
                let StatusIcon = Wind;
                let statusColor = "text-blue-500";
                
                if (isCoolingDone) {
                    statusText = "Prêt pour remise en T°";
                    StatusIcon = Flame;
                    statusColor = "text-orange-500";
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
                            {!isCoolingDone ? (
                                <Button size="sm" className="w-full bg-blue-500 hover:bg-blue-600 text-white" disabled={isSuperviseur} onClick={() => handleOpenActionDialog(entry, 'cooling')}>
                                    <Wind className="mr-2 h-4 w-4"/> Fin Refroidissement
                                </Button>
                            ) : (
                                <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600 text-white" disabled={isSuperviseur} onClick={() => handleOpenActionDialog(entry, 'reheating')}>
                                    <Flame className="mr-2 h-4 w-4"/> Fin Remise en T°
                                </Button>
                            )}
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent className={isMobile ? "max-w-[95vw]" : "sm:max-w-4xl"}>
            <DialogHeader><DialogTitle>{editingEntry ? "Modifier" : (isMobile ? "Nouveau Produit" : "Nouvel Enregistrement")}</DialogTitle></DialogHeader>
            <Form {...mainForm}>
              <form onSubmit={mainForm.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[80vh] overflow-y-auto pr-2">
                
                {isMobile && !editingEntry ? (
                    <div className="space-y-3">
                        <FormField control={mainForm.control} name="productName" render={({ field }) => (<FormItem><FormLabel>Produit</FormLabel><FormControl><Input placeholder="Ex: Boeuf Bourguignon" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={mainForm.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantité</FormLabel><FormControl><Input placeholder="Ex: 5 kg" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={mainForm.control} name="coolingStartProductTemp" render={({ field }) => (<FormItem><FormLabel>T° de Départ (°C)</FormLabel><FormControl><Input placeholder="Ex: 65" type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="flex items-center space-x-2">
                            <FormField control={mainForm.control} name="cooledWithWater" render={({ field }) => ( <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Refroidi à l'eau</FormLabel></div></FormItem> )}/>
                            <FormField control={mainForm.control} name="servedCold" render={({ field }) => ( <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Servi froid</FormLabel></div></FormItem> )}/>
                        </div>
                    </div>
                ) : (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <FormField control={mainForm.control} name="coolingDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={!!editingEntry}><LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                  <FormField control={mainForm.control} name="productName" render={({ field }) => (<FormItem><FormLabel>Produit</FormLabel><FormControl><Input placeholder="Ex: Boeuf Bourguignon" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={mainForm.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantité</FormLabel><FormControl><Input placeholder="Ex: 5 kg" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={mainForm.control} name="coolingStartProductTemp" render={({ field }) => (<FormItem><FormLabel>T° de Départ (°C)</FormLabel><FormControl><Input placeholder="Ex: 65°C" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>

                <div className="flex items-center space-x-4 pt-2">
                    <FormField control={mainForm.control} name="cooledWithWater" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Refroidi à l'eau</FormLabel></FormItem> )}/>
                    <FormField control={mainForm.control} name="servedCold" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Servi froid</FormLabel></FormItem> )}/>
                </div>

                <div className="pt-3 border-t">
                  <h4 className="text-md font-semibold mb-2">Refroidissement Rapide</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    <FormField control={mainForm.control} name="coolingHotProductTime" render={({ field }) => (<FormItem><FormLabel>P. Chauds Heure</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} disabled={isSuperviseur} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={mainForm.control} name="coolingHotProductTemp" render={({ field }) => (<FormItem><FormLabel>P. Chauds T°C</FormLabel><FormControl><Input placeholder="T°C" {...field} value={field.value || ''} disabled={isSuperviseur} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={mainForm.control} name="coolingColdProductTime" render={({ field }) => (<FormItem><FormLabel>P. Froids Heure</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} disabled={isSuperviseur} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={mainForm.control} name="coolingColdProductTemp" render={({ field }) => (<FormItem><FormLabel>P. Froids T°C</FormLabel><FormControl><Input placeholder="T°C" {...field} value={field.value || ''} disabled={isSuperviseur} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={mainForm.control} name="coolingVisa" render={({ field }) => (<FormItem><FormLabel>Visa</FormLabel><FormControl><Input placeholder="Initiales" {...field} value={field.value || ''} disabled={isSuperviseur} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </div>
                <div className="pt-3 border-t">
                  <h4 className="text-md font-semibold mb-2">Remise en Température</h4>
                  <fieldset disabled={watchedServedCold} className={cn(watchedServedCold && "opacity-50")}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <FormField control={mainForm.control} name="reheatingDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date Remise</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isSuperviseur}><LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
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
                
                <DialogFooter className="pt-4">
                  <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                  <Button type="submit" disabled={isSubmitting || isSuperviseur}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{editingEntry ? "Enregistrer" : "Ajouter"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      {isMobile ? <MobileView /> : <DesktopView />}

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