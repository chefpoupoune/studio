"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { FryerMaintenanceLogEntry, FryerOilTpmLogEntry, LedTpmStatus } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
// import useMobile from '@/hooks/use-mobile'; // DÉCOMMENTEZ ET UTILISEZ VOTRE VRAI HOOK ICI
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
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc, query, orderBy, Timestamp, where, writeBatch } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { truncate } from 'fs/promises';

// --- Dépendances Minimales Pour Rendre le Code Autonome (SIMULATIONS) ---

// 1. Simuler l'interface useMobile : MODIFIÉ POUR PERMETTRE LE RENDU CONDITIONNEL
// Si vous voulez tester le mode mobile, mettez '() => true'.
// Si vous voulez utiliser un vrai hook, décommentez l'importation ci-dessus et supprimez cette fonction.
const useMobile = () => {
    if (typeof window === 'undefined') return false; // Ne pas exécuter côté serveur
    return window.innerWidth < 768; // Ex: Considère mobile si moins de 768px de large
};



// ----------------------------------------------------------

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
    // Correction de l'enum custom pour être plus robuste
    ledTpmStatus: z.enum(['lt_20', '20_24', 'gt_24', '']).optional().or(z.literal('')),
    fryerIdentifier: z.string().min(1, "Identifiant friteuse requis."),
    tpmPercentage: z.string().optional(),
});
type TpmLogFormData = z.infer<typeof tpmLogSchema>;

export default function FryerOilOverallMonitoring() {
    const [maintenanceLog, setMaintenanceLog] = useState<FryerMaintenanceLogEntry[]>([]);
    const [tpmLog, setTpmLog] = useState<FryerOilTpmLogEntry[]>([]);

    const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
    const [editingMaintenanceEntry, setEditingMaintenanceEntry] = useState<FryerMaintenanceLogEntry | null>(null);
    const [isUseDateDialogOpen, setIsUseDateDialogOpen] = useState(false);
    const [newUseDate, setNewUseDate] = useState<Date | undefined>(new Date());
    
    const [isTpmDialogOpen, setIsTpmDialogOpen] = useState(false);
    const [editingTpmEntry, setEditingTpmEntry] = useState<FryerOilTpmLogEntry | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const isMobile = useMobile(); // Utilise le hook simulé (ou votre vrai hook si vous l'avez décommenté)

    const [selectedDate, setSelectedDate] = useState(new Date()); 
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);


    const maintenanceForm = useForm<MaintenanceLogFormData>({ resolver: zodResolver(maintenanceLogSchema) });
    const tpmForm = useForm<TpmLogFormData>({ 
        resolver: zodResolver(tpmLogSchema),
        defaultValues: {
            date: new Date(), operator: '', ledTpmStatus: '', fryerIdentifier: '', tpmPercentage: '',
        }
    });

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


    const fetchMaintenanceLogEntries = useCallback(async () => {
        setIsLoading(true);
        try {
            const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

            const entriesCollectionRef = collection(firestore, FIRESTORE_MAINTENANCE_COLLECTION);
            const q = query(entriesCollectionRef, 
                where("useDate", ">=", Timestamp.fromDate(startOfMonth)),
                where("useDate", "<=", Timestamp.fromDate(endOfMonth)),
                orderBy("useDate", "desc")
            );
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
    }, [toast, selectedDate]);

    const fetchTpmLogEntries = useCallback(async () => {
        setIsLoading(true);
        try {
            const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

            const entriesCollectionRef = collection(firestore, FIRESTORE_TPM_COLLECTION);
            const q = query(entriesCollectionRef, 
                where("date", ">=", Timestamp.fromDate(startOfMonth)),
                where("date", "<=", Timestamp.fromDate(endOfMonth)),
                orderBy("date", "desc")
            );
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
    }, [toast, selectedDate]);


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

    const handleAddUseDate = async () => {
        if (!newUseDate) {
            toast({ title: "Veuillez sélectionner une date.", variant: "destructive" });
            return;
        }
        setIsLoading(true);
        const entryDataForFirestore = {
            useDate: Timestamp.fromDate(newUseDate),
            filterDate: null,
            filterSignature: null,
            cleaningDate: null,
            cleaningSignature: null,
            changeDate: null,
            changeSignature: null,
        };

        try {
            await addDoc(collection(firestore, FIRESTORE_MAINTENANCE_COLLECTION), entryDataForFirestore);
            toast({ title: "Date d'utilisation ajoutée" });
            fetchMaintenanceLogEntries();
            setIsUseDateDialogOpen(false);
        } catch (error) {
            console.error("Error saving use date entry to Firestore:", error);
            toast({ title: "Erreur Sauvegarde", variant: "destructive" });
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


    const handleDeleteAllForMonth = async (type: 'maintenance' | 'tpm') => {
        setIsLoading(true);
        const isMaintenance = type === 'maintenance';
        const collectionName = isMaintenance ? FIRESTORE_MAINTENANCE_COLLECTION : FIRESTORE_TPM_COLLECTION;
        const dateField = isMaintenance ? 'useDate' : 'date';

        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

        try {
            const q = query(
                collection(firestore, collectionName),
                where(dateField, ">=", Timestamp.fromDate(startOfMonth)),
                where(dateField, "<=", Timestamp.fromDate(endOfMonth))
            );
            
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                toast({ title: "Aucun enregistrement à supprimer" });
                setIsLoading(false);
                return;
            }

            const batch = writeBatch(firestore);
            querySnapshot.docs.forEach(docSnapshot => batch.delete(docSnapshot.ref));
            await batch.commit();

            if (isMaintenance) {
                fetchMaintenanceLogEntries();
            } else {
                fetchTpmLogEntries();
            }

            toast({
                title: "Enregistrements Supprimés",
                description: `L'historique pour ${format(selectedDate, 'MMMM yyyy', { locale: fr })} a été vidé.`,
                variant: "destructive"
            });
        } catch (error) {
            console.error(`Error deleting month's ${type} entries:`, error);
            toast({ title: "Erreur de Suppression", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };


      const generatePdf = async (type: 'maintenance' | 'tpm') => {
        setIsGeneratingPdf(true);
        try {
            const isMaintenance = type === 'maintenance';
            const dataToExport = isMaintenance ? maintenanceLog : tpmLog;
            const moduleTitle = isMaintenance ? "Suivi de Maintenance des Friteuses" : "Suivi des Huiles (Contrôle TPM)";
            const settingsKey = 'pms_fryer_oil_overall_monitoring';

            if (dataToExport.length === 0) {
                toast({ title: "Aucune Donnée", description: `Aucune donnée à exporter pour ${moduleTitle.toLowerCase()}.` });
                setIsGeneratingPdf(false);
                return;
            }

            const pdfSettings = await getPdfLayoutSettings(settingsKey);
            const doc = new jsPDF({
                orientation: pdfSettings.orientation as any || 'landscape',
                unit: 'pt',
                format: pdfSettings.pageSize as any || 'a4',
            }) as jsPDFWithAutoTable;

            const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
                        // --- EN-TÊTE GLOBAL (LOGO, ETC.) ---
            let currentY = pdfSettings.marginTop;
            const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;
            const effectiveHeaderText = pdfSettings.headerText || (pdfSettings.logoUrl ? '{logo}' : '');

            if (effectiveHeaderText) {
                const headerRows = effectiveHeaderText.split('\n');
                doc.setFontSize(pdfSettings.headerFontSize);
                for (const row of headerRows) {
                    const cells = row.split('|');
                    if (cells.length === 0) continue;
                    let maxHeightInRow = 0;
                    const cellWidth = pageContentWidth / cells.length;
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
                                const imgHeight = Math.min(maxHeightInRow - 6, 40);
                                const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                                doc.addImage(pdfSettings.logoUrl, imgProps.fileType, currentX + (cellWidth - imgWidth) / 2, currentY + (maxHeightInRow - imgHeight) / 2, imgWidth, imgHeight);
                            } catch (e) { console.error("Erreur lors de l'ajout du logo.", e); }
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
            const monthYearTitle = format(selectedDate, 'MMMM yyyy', { locale: fr });
            const finalModuleTitle = `${moduleTitle} - ${monthYearTitle}`;
            let finalTitle = pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle ? pdfSettings.documentBaseTitle.trim() : "";
            if (pdfSettings.showModuleTitle) {
                finalTitle = finalTitle ? `${finalTitle} - ${finalModuleTitle}` : finalModuleTitle;
            }
            if (finalTitle) {
                doc.setFontSize(pdfSettings.documentTitleFontSize);
                doc.text(finalTitle, doc.internal.pageSize.width / 2, currentY, { align: 'center' });
                currentY += pdfSettings.documentTitleFontSize + 5;
            }

            // --- CONTENU DU TABLEAU ---
            let head: any[];
            let body: any[][];

            const headStyles: any = {
                fontStyle: 'bold', halign: 'center', valign: 'middle',
                fontSize: 8, cellPadding: 2,
            };

            if (pdfSettings.primaryColor) {
                const rgb = hexToRgb(pdfSettings.primaryColor);
                if (rgb) {
                    headStyles.fillColor = pdfSettings.primaryColor;
                    headStyles.textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 125 ? '#000000' : '#FFFFFF';
                }
            }

            if (isMaintenance) {
                const subHeadStyles = { ...headStyles, fillColor: '#f3f4f6', textColor: '#000000' };
                head = [
                    [{ content: "Date d'Utilisation", rowSpan: 2, styles: headStyles }, { content: "Filtration", colSpan: 2, styles: headStyles }, { content: "Nettoyage", colSpan: 2, styles: headStyles }, { content: "Changement", colSpan: 2, styles: headStyles }],
                    [{ content: "Date", styles: subHeadStyles }, { content: "Par", styles: subHeadStyles }, { content: "Date", styles: subHeadStyles }, { content: "Par", styles: subHeadStyles }, { content: "Date", styles: subHeadStyles }, { content: "Par", styles: subHeadStyles }]
                ];
                body = (dataToExport as FryerMaintenanceLogEntry[]).map(e => [
                    isValid(parseISO(e.useDate)) ? format(parseISO(e.useDate), "dd/MM/yyyy", { locale: fr }) : '-',
                    e.filterDate && isValid(parseISO(e.filterDate)) ? format(parseISO(e.filterDate), "dd/MM/yy") : '-',
                    e.filterSignature || '-',
                    e.cleaningDate && isValid(parseISO(e.cleaningDate)) ? format(parseISO(e.cleaningDate), "dd/MM/yy") : '-',
                    e.cleaningSignature || '-',
                    e.changeDate && isValid(parseISO(e.changeDate)) ? format(parseISO(e.changeDate), "dd/MM/yy") : '-',
                    e.changeSignature || '-',
                ]);
            } else { // TPM
                head = [["Date", "Opérateur", "Friteuse N°", "Statut LED", "% TPM"]];
                body = (dataToExport as FryerOilTpmLogEntry[]).map(e => {
                    let statusStyle: any = { halign: 'center' };
                    let statusText = '-';
                    if (e.ledTpmStatus === 'lt_20') { statusStyle.fillColor = '#bbf7d0'; statusText = 'Conservation'; }
                    else if (e.ledTpmStatus === '20_24') { statusStyle.fillColor = '#fef08a'; statusText = 'Surveillance'; }
                    else if (e.ledTpmStatus === 'gt_24') { statusStyle.fillColor = '#fecaca'; statusText = 'Changement'; }
                    
                    return [
                        isValid(parseISO(e.date)) ? format(parseISO(e.date), "dd/MM/yyyy", { locale: fr }) : '-',
                        e.operator || '-',
                        e.fryerIdentifier,
                        { content: statusText, styles: statusStyle },
                        e.tpmPercentage ? `${e.tpmPercentage}%` : '-',
                    ];
                });
            }

            doc.autoTable({
                head, body,
                startY: currentY,
                theme: 'grid',
                headStyles: headStyles,
                styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center', textColor: [0,0,0] },
                columnStyles: { 0: { halign: 'left' } },
                margin: { top: pdfSettings.marginTop, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
                didDrawPage: (data: any) => {
                    if (pdfSettings.footerText) {
                        doc.setFontSize(pdfSettings.footerFontSize);
                        doc.text(
                            pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', doc.internal.getNumberOfPages().toString()),
                            data.settings.margin.left,
                            doc.internal.pageSize.height - (pdfSettings.marginBottom / 2)
                        );
                    }
                }
            });
            
            const filename = `Suivi_Friteuse_${isMaintenance ? 'Maintenance' : 'TPM'}_${format(selectedDate, 'yyyy-MM')}.pdf`;
            doc.save(filename);
            toast({ title: "PDF Généré", description: `Le fichier "${filename}" a été téléchargé.` });

        } catch (error) {
            console.error(`Erreur lors de la génération du PDF (${type}):`, error);
            toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
        } finally {
            setIsGeneratingPdf(false);
        }
    };



    const renderDateField = (formInstance: any, name: "useDate" | "filterDate" | "cleaningDate" | "changeDate" | "date", label: string) => (
        <FormField control={formInstance.control} name={name} render={({ field }) => (
            <FormItem className="flex flex-col">
                <FormLabel>{label}</FormLabel>
                <Popover modal = {true} >
                <PopoverTrigger asChild>
                <FormControl>
                <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                    {field.value ? format(field.value, "dd/MM/yyyy", { locale: fr }) : <span>Choisir date</span>}
                    <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
                </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value as Date | undefined} onSelect={field.onChange} initialFocus locale={fr} /></PopoverContent></Popover>
                <FormMessage />
            </FormItem>
        )} />
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <Flame className="w-6 h-6 text-primary"/>
                        Suivi des Friteuses et Huiles
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Select value={selectedDate.getMonth().toString()} onValueChange={handleMonthChange}>
                            <SelectTrigger className="w-full sm:w-[150px]">
                                <SelectValue placeholder="Mois" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(month => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={selectedDate.getFullYear().toString()} onValueChange={handleYearChange}>
                            <SelectTrigger className="w-full sm:w-[100px]">
                                <SelectValue placeholder="Année" />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="tpm" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="tpm">Contrôle Quotidien (TPM)</TabsTrigger>
                        <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                    </TabsList>

                    {/* Onglet TPM */}
                    <TabsContent value="tpm">
                        <Card className="border-0 shadow-none">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    Suivi des Huiles (Contrôle TPM)
                                    <Dialog open={isTpmDialogOpen} onOpenChange={setIsTpmDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button onClick={() => handleOpenTpmDialog()} size="sm" className="ml-2">
                                                <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Contrôle
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            {/* ... (Contenu du Dialog TPM, inchangé) ... */}
                                            <DialogHeader>
                                                <DialogTitle>{editingTpmEntry ? "Modifier Contrôle TPM" : "Ajouter Contrôle TPM"}</DialogTitle>
                                            </DialogHeader>
                                            <Form {...tpmForm}>
                                                <form onSubmit={tpmForm.handleSubmit(handleTpmFormSubmit)} className="space-y-4">
                                                    {renderDateField(tpmForm, "date", "Date du Contrôle")}
                                                    <FormField control={tpmForm.control} name="fryerIdentifier" render={({ field }) => (
                                                        <FormItem><FormLabel>Identifiant Friteuse</FormLabel>
                                                            <FormControl><Input placeholder="Ex: Friteuse 1" {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                    <FormField control={tpmForm.control} name="operator" render={({ field }) => (
                                                        <FormItem><FormLabel>Opérateur</FormLabel>
                                                            <FormControl><Input placeholder="Nom/Initiales" {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                    <FormField control={tpmForm.control} name="tpmPercentage" render={({ field }) => (
                                                        <FormItem><FormLabel>% TPM (Optionnel)</FormLabel>
                                                            <FormControl><Input type="number" step="0.1" placeholder="Ex: 22.5" {...field} /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                    <FormField control={tpmForm.control} name="ledTpmStatus" render={({ field }) => (
                                                        <FormItem className="space-y-3"><FormLabel>Statut LED</FormLabel>
                                                            <FormControl>
                                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                                                        <FormControl><RadioGroupItem value="lt_20" /></FormControl>
                                                                        <FormLabel className="font-normal"><span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-green-500 text-white">Conservation (&lt;20%)</span></FormLabel>
                                                                    </FormItem>
                                                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                                                        <FormControl><RadioGroupItem value="20_24" /></FormControl>
                                                                        <FormLabel className="font-normal"><span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-yellow-400 text-black">Surveillance (20-24%)</span></FormLabel>
                                                                    </FormItem>
                                                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                                                        <FormControl><RadioGroupItem value="gt_24" /></FormControl>
                                                                        <FormLabel className="font-normal"><span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-red-500 text-white">Changement (&gt;24%)</span></FormLabel>
                                                                    </FormItem>
                                                                </RadioGroup>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                    <DialogFooter>
                                                        <Button type="submit" disabled={isLoading}>
                                                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingTpmEntry ? 'Modifier' : 'Ajouter'}
                                                        </Button>
                                                    </DialogFooter>
                                                </form>
                                            </Form>
                                        </DialogContent>
                                    </Dialog>
                                </CardTitle>
                                <CardDescription>Légende TPM: <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-green-500 text-white">Conservation</span> / <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-yellow-400 text-black">Surveillance</span> / <span className="px-1.5 py-0.5 rounded-sm text-xs font-medium bg-red-500 text-white">Changement</span></CardDescription>
                            </CardHeader>
                            <CardContent>
                                {/* DÉBUT DE LA LOGIQUE D'AFFICHAGE CONDITIONNEL POUR MOBILE */}
                                {isLoading && tpmLog.length === 0 ? (
                                    <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin"/></div>
                                ) : tpmLog.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-6">Aucun contrôle TPM pour ce mois.</p>
                                ) : !isMobile ? (
                                    <div className="overflow-x-auto border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Opérateur</TableHead>
                                                    <TableHead>Friteuse N°</TableHead>
                                                    <TableHead>Statut LED</TableHead>
                                                    <TableHead>% TPM</TableHead>
                                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {tpmLog.map(entry => {
                                                    let statusColor = '';
                                                    let statusText = '-';
                                                    if (entry.ledTpmStatus === 'lt_20') { statusColor = 'bg-green-500 text-white'; statusText = 'Conservation'; }
                                                    else if (entry.ledTpmStatus === '20_24') { statusColor = 'bg-yellow-400 text-black'; statusText = 'Surveillance'; }
                                                    else if (entry.ledTpmStatus === 'gt_24') { statusColor = 'bg-red-500 text-white'; statusText = 'Changement'; }

                                                    return (
                                                        <TableRow key={entry.id}>
                                                            <TableCell className="font-medium">{format(parseISO(entry.date), 'dd/MM/yyyy')}</TableCell>
                                                            <TableCell>{entry.operator || '-'}</TableCell>
                                                            <TableCell>{entry.fryerIdentifier}</TableCell>
                                                            <TableCell><span className={cn("px-1.5 py-0.5 rounded-sm text-xs font-medium", statusColor)}>{statusText}</span></TableCell>
                                                            <TableCell>{entry.tpmPercentage || '-'}</TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button variant="ghost" size="sm" onClick={() => handleOpenTpmDialog(entry)}><Edit2 className="h-4 w-4" /></Button>
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="sm" disabled={isLoading}><Trash2 className="h-4 w-4 text-red-500" /></Button></AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader><AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                                                                            <AlertDialogDescription>Ceci supprimera définitivement le contrôle TPM du {format(parseISO(entry.date), 'dd/MM/yyyy')}.</AlertDialogDescription></AlertDialogHeader>
                                                                            <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => handleDeleteTpmEntry(entry.id)}>Supprimer</AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : ( 
                                    <p className="text-center text-muted-foreground py-6">Le tableau est masqué sur mobile. Utilisez le bouton 'Ajouter Contrôle' pour saisir les données.</p> 
                                )}
                                {/* FIN DE LA LOGIQUE D'AFFICHAGE CONDITIONNEL POUR MOBILE */}
                            </CardContent>
                            <CardFooter className="flex flex-wrap justify-end gap-2 pt-4">
                                <Button onClick={() => generatePdf('tpm')} disabled={isGeneratingPdf || isLoading || tpmLog.length === 0}><FileText className="mr-2 h-4 w-4"/>Générer PDF</Button>
                                {tpmLog.length > 0 && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" disabled={isLoading}><Trash2 className="mr-2 h-4 w-4"/>Vider le mois</Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Vider l'Historique TPM</AlertDialogTitle>
                                                <AlertDialogDescription>Êtes-vous sûr de vouloir **supprimer tous les contrôles TPM** pour le mois de **{format(selectedDate, 'MMMM yyyy', { locale: fr })}** ? Cette action est irréversible.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteAllForMonth('tpm')} disabled={isLoading}>
                                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Supprimer Tout'}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </CardFooter>
                        </Card>
                    </TabsContent>
                    
                    {/* Onglet Maintenance */}
                    <TabsContent value="maintenance">
                            <Card className="border-0 shadow-none">
                                <CardHeader>
                                    <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        Suivi de Maintenance des Friteuses
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Dialog open={isUseDateDialogOpen} onOpenChange={(isOpen) => {
                                                setIsUseDateDialogOpen(isOpen);
                                                if (isOpen) { setNewUseDate(new Date()); }
                                            }}>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="outline" className="w-full sm:w-auto">
                                                        <Check className="mr-2 h-4 w-4" /> Ajout Rapide Date
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-min">
                                                    <DialogHeader>
                                                        <DialogTitle>Ajouter une date d'utilisation</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="py-4 flex justify-center">
                                                        <Calendar
                                                            mode="single"
                                                            selected={newUseDate}
                                                            onSelect={setNewUseDate}
                                                            initialFocus
                                                            locale={fr}
                                                        />
                                                    </div>
                                                    <DialogFooter>
                                                        <Button onClick={handleAddUseDate} disabled={isLoading || !newUseDate}>
                                                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Ajouter la date"}
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                            <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
                                                <DialogTrigger asChild>
                                                    <Button onClick={() => handleOpenMaintenanceDialog()} size="sm" className="w-full sm:w-auto">
                                                        <PlusCircle className="mr-2 h-4 w-4" /> Maintenance Complète
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[500px]">
                                                    <DialogHeader>
                                                        <DialogTitle>{editingMaintenanceEntry ? "Modifier Entrée Maintenance" : "Ajouter Entrée Maintenance"}</DialogTitle>
                                                    </DialogHeader>
                                                    <Form {...maintenanceForm}>
                                                        <form onSubmit={maintenanceForm.handleSubmit(handleMaintenanceFormSubmit)} className="space-y-4">
                                                            {renderDateField(maintenanceForm, "useDate", "Date d'Utilisation")}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div><h4 className="font-semibold mb-2">Filtration</h4>
                                                                    {renderDateField(maintenanceForm, "filterDate", "Date de Filtration")}
                                                                    <FormField control={maintenanceForm.control} name="filterSignature" render={({ field }) => (
                                                                        <FormItem><FormLabel>Signature/Nom</FormLabel>
                                                                            <FormControl><Input placeholder="Par qui ?" {...field} value={field.value || ''} /></FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )} />
                                                                </div>
                                                                <div><h4 className="font-semibold mb-2">Nettoyage</h4>
                                                                    {renderDateField(maintenanceForm, "cleaningDate", "Date de Nettoyage")}
                                                                    <FormField control={maintenanceForm.control} name="cleaningSignature" render={({ field }) => (
                                                                        <FormItem><FormLabel>Signature/Nom</FormLabel>
                                                                            <FormControl><Input placeholder="Par qui ?" {...field} value={field.value || ''} /></FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )} />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2"><h4 className="font-semibold mb-2">Changement d'Huile</h4>
                                                                {renderDateField(maintenanceForm, "changeDate", "Date de Changement")}
                                                                <FormField control={maintenanceForm.control} name="changeSignature" render={({ field }) => (
                                                                    <FormItem><FormLabel>Signature/Nom</FormLabel>
                                                                        <FormControl><Input placeholder="Par qui ?" {...field} value={field.value || ''} /></FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )} />
                                                            </div>
                                                            <DialogFooter>
                                                                <Button type="submit" disabled={isLoading}>
                                                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingMaintenanceEntry ? 'Modifier' : 'Ajouter'}
                                                                </Button>
                                                            </DialogFooter>
                                                        </form>
                                                    </Form>
                                                </DialogContent>
                                            </Dialog>
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {/* DÉBUT DE LA LOGIQUE D'AFFICHAGE CONDITIONNEL POUR MOBILE */}
                                    {isLoading && maintenanceLog.length === 0 ? (
                                        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin"/></div>
                                    ) : maintenanceLog.length === 0 ? (
                                        <p className="text-center text-muted-foreground py-6">Aucune entrée de maintenance pour ce mois.</p>
                                    ) : !isMobile ? (
                                        <div className="overflow-x-auto border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[120px]">Date d'Utilisation</TableHead>
                                                        <TableHead>Filtration</TableHead>
                                                        <TableHead>Signature Filtre</TableHead>
                                                        <TableHead>Nettoyage</TableHead>
                                                        <TableHead>Signature Nettoyage</TableHead>
                                                        <TableHead>Changement d'Huile</TableHead>
                                                        <TableHead>Signature Changement</TableHead>
                                                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {maintenanceLog.map(entry => (
                                                        <TableRow key={entry.id}>
                                                            <TableCell className="font-medium">{format(parseISO(entry.useDate), 'dd/MM/yyyy')}</TableCell>
                                                            <TableCell>{entry.filterDate ? format(parseISO(entry.filterDate), 'dd/MM/yy') : <Check className="h-4 w-4 text-muted-foreground mx-auto" />}</TableCell>
                                                            <TableCell>{entry.filterSignature || '-'}</TableCell>
                                                            <TableCell>{entry.cleaningDate ? format(parseISO(entry.cleaningDate), 'dd/MM/yy') : <Check className="h-4 w-4 text-muted-foreground mx-auto" />}</TableCell>
                                                            <TableCell>{entry.cleaningSignature || '-'}</TableCell>
                                                            <TableCell>{entry.changeDate ? format(parseISO(entry.changeDate), 'dd/MM/yy') : <Check className="h-4 w-4 text-muted-foreground mx-auto" />}</TableCell>
                                                            <TableCell>{entry.changeSignature || '-'}</TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button variant="ghost" size="sm" onClick={() => handleOpenMaintenanceDialog(entry)}><Edit2 className="h-4 w-4" /></Button>
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild><Button variant="ghost" size="sm" disabled={isLoading}><Trash2 className="h-4 w-4 text-red-500" /></Button></AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader><AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                                                                            <AlertDialogDescription>Ceci supprimera définitivement l'entrée de maintenance du {format(parseISO(entry.useDate), 'dd/MM/yyyy')}.</AlertDialogDescription></AlertDialogHeader>
                                                                            <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => handleDeleteMaintenanceEntry(entry.id)}>Supprimer</AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <p className="text-center text-muted-foreground py-6">Le tableau est masqué sur mobile. Utilisez le bouton 'Ajouter Maintenance' pour saisir les données.</p>
                                    )}
                                    {/* FIN DE LA LOGIQUE D'AFFICHAGE CONDITIONNEL POUR MOBILE */}
                                </CardContent>
                                <CardFooter className="flex flex-wrap justify-end gap-2 pt-4">
                                    <Button onClick={() => generatePdf('maintenance')} disabled={isGeneratingPdf || isLoading || maintenanceLog.length === 0}><FileText className="mr-2 h-4 w-4"/>Générer PDF</Button>
                                    {maintenanceLog.length > 0 && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" disabled={isLoading}><Trash2 className="mr-2 h-4 w-4"/>Vider le mois</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Vider l'Historique Maintenance</AlertDialogTitle>
                                                    <AlertDialogDescription>Êtes-vous sûr de vouloir **supprimer toutes les entrées de maintenance** pour le mois de **{format(selectedDate, 'MMMM yyyy', { locale: fr })}** ? Cette action est irréversible.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteAllForMonth('maintenance')} disabled={isLoading}>
                                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Supprimer Tout'}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </CardFooter>
                            </Card>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
