'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { DefrostingEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, Loader2, Snowflake, CalendarIcon as LucideCalendarIcon, Clock, Thermometer, User, FileDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { firestore } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc, query, orderBy, Timestamp, updateDoc,where, writeBatch } from 'firebase/firestore';
import useMobile from '@/hooks/use-mobile';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// --- Schémas de Validation ---

// Schéma complet pour le bureau (création/édition)
const desktopSchema = z.object({
    id: z.string().optional(),
    productName: z.string().min(1, "Nom du produit requis."),
    quantity: z.string().min(1, "Quantité requise."),
    defrostStartDate: z.date({ required_error: "Date de début requise." }),
    defrostStartTime: z.string().regex(/^([01][0-9]|2[0-3]):([0-5][0-9])$/, "Format HH:MM requis."),
    tempOnRemoval: z.string().optional(),
    initialsStart: z.string().min(1, "Initiales requises."),
    useDate: z.date().optional().nullable(),
    useTime: z.string().regex(/^([01][0-9]|2[0-3]):([0-5][0-9])$/, { message: "Format HH:MM requis." }).optional().or(z.literal('')),
    tempOnUse: z.string().optional(),
    initialsEnd: z.string().optional(),
});

// Schéma pour le démarrage rapide sur mobile
const mobileStartSchema = z.object({
    productName: z.string().min(1, "Nom du produit requis."),
    quantity: z.string().min(1, "Quantité requise."),
});

// Schéma pour la finalisation sur mobile
const mobileFinishSchema = z.object({
    tempOnUse: z.string().min(1, "Température requise."),
});

// --- Types de Données ---
type DesktopFormData = z.infer<typeof desktopSchema>;
type MobileStartFormData = z.infer<typeof mobileStartSchema>;
type MobileFinishFormData = z.infer<typeof mobileFinishSchema>;

const FIRESTORE_COLLECTION = 'pmsDefrostingLog';
const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

const getInitials = (name: string | null): string => {
    if (!name || typeof name !== 'string') return 'N/A';
    const nameParts = name.trim().split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return 'N/A';
    if (nameParts.length > 1) return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
    return nameParts[0].substring(0, 2).toUpperCase();
};

export default function DefrostingMonitoring() {
    const [entries, setEntries] = useState<DefrostingEntry[]>([]);
    const [isDesktopDialogOpen, setIsDesktopDialogOpen] = useState(false);
    const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<DefrostingEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const isMobile = useMobile();
    const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());


    useEffect(() => {
        if (typeof window !== "undefined") {
            setLoggedInUsername(localStorage.getItem(LOGGED_IN_USERNAME_KEY));
        }
    }, []);

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

    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const userInitials = useMemo(() => getInitials(loggedInUsername), [loggedInUsername]);

    // --- Instances de Formulaires ---
    const desktopForm = useForm<DesktopFormData>({ resolver: zodResolver(desktopSchema) });
    const mobileStartForm = useForm<MobileStartFormData>({ resolver: zodResolver(mobileStartSchema), defaultValues: { productName: '', quantity: '' } });
    const mobileFinishForm = useForm<MobileFinishFormData>({ resolver: zodResolver(mobileFinishSchema), defaultValues: { tempOnUse: '' } });

    const fetchDefrostingEntries = useCallback(async () => {
    setIsLoading(true);
    try {
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

        const q = query(
            collection(firestore, FIRESTORE_COLLECTION),
            where("defrostStartDate", ">=", Timestamp.fromDate(startOfMonth)),
            where("defrostStartDate", "<=", Timestamp.fromDate(endOfMonth)),
            orderBy("defrostStartDate", "desc")
        );
        const querySnapshot = await getDocs(q);
        const loadedEntries = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                defrostStartDate: (data.defrostStartDate as Timestamp).toDate().toISOString(),
                useDate: data.useDate ? (data.useDate as Timestamp).toDate().toISOString() : null,
            } as DefrostingEntry;
        });
        setEntries(loadedEntries);
    } catch (error) {
        console.error("Error loading entries:", error);
        toast({ title: "Erreur de chargement", description: "Vérifiez les index Firestore (voir console du navigateur).", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
}, [toast, selectedDate]);

    useEffect(() => {
        fetchDefrostingEntries();
    }, [fetchDefrostingEntries]);

    // --- Gestionnaires d'événements ---

    const handleOpenDesktopDialog = (entry?: DefrostingEntry) => {
        setEditingEntry(entry || null);
        desktopForm.reset(entry ? {
            ...entry,
            defrostStartDate: entry.defrostStartDate ? parseISO(entry.defrostStartDate) : new Date(),
            defrostStartTime: entry.defrostStartTime || format(new Date(), 'HH:mm'),
            useDate: entry.useDate ? parseISO(entry.useDate) : null,
            useTime: entry.useTime || '',
            initialsStart: entry.initialsStart || userInitials,
        } : {
            defrostStartDate: new Date(),
            defrostStartTime: format(new Date(), 'HH:mm'),
            productName: '',
            quantity: '',
            tempOnRemoval: '-18°C',
            initialsStart: userInitials,
            useDate: null, useTime: '', tempOnUse: '', initialsEnd: ''
        });
        setIsDesktopDialogOpen(true);
    };

    const handleOpenFinishDialog = (entry: DefrostingEntry) => {
        setEditingEntry(entry);
        mobileFinishForm.reset({ tempOnUse: '' });
        setIsFinishDialogOpen(true);
    };

    const handleStartDefrosting = async (data: MobileStartFormData) => {
        setIsLoading(true);
        try {
            await addDoc(collection(firestore, FIRESTORE_COLLECTION), {
                ...data,
                defrostStartDate: Timestamp.fromDate(new Date()),
                defrostStartTime: format(new Date(), 'HH:mm'),
                tempOnRemoval: '-18°C',
                initialsStart: userInitials,
                useDate: null, useTime: null, tempOnUse: null, initialsEnd: null,
            });
            toast({ title: "Décongélation Démarrée", description: `${data.productName} a été ajouté.` });
            mobileStartForm.reset();
            fetchDefrostingEntries();
        } catch (error) {
            console.error("Error starting defrosting:", error);
            toast({ title: "Erreur", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinishDefrosting = async (data: MobileFinishFormData) => {
        if (!editingEntry) return;
        setIsLoading(true);
        try {
            const entryDocRef = doc(firestore, FIRESTORE_COLLECTION, editingEntry.id);
            await updateDoc(entryDocRef, {
                useDate: Timestamp.fromDate(new Date()),
                useTime: format(new Date(), 'HH:mm'),
                tempOnUse: data.tempOnUse,
                initialsEnd: userInitials,
            });
            toast({ title: "Décongélation Terminée", description: `${editingEntry.productName} a été finalisé.` });
            fetchDefrostingEntries();
            setIsFinishDialogOpen(false);
            setEditingEntry(null);
        } catch (error) {
            console.error("Error finishing defrosting:", error);
            toast({ title: "Erreur de mise à jour", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDesktopFormSubmit = async (data: DesktopFormData) => {
        setIsLoading(true);
        const { id, ...dataToSave } = data;
        const entryDataForFirestore = {
            ...dataToSave,
            defrostStartDate: Timestamp.fromDate(data.defrostStartDate),
            useDate: data.useDate ? Timestamp.fromDate(data.useDate) : null,
        };

        try {
            if (editingEntry) {
                const entryDocRef = doc(firestore, FIRESTORE_COLLECTION, editingEntry.id);
                await setDoc(entryDocRef, entryDataForFirestore);
                toast({ title: "Enregistrement Modifié" });
            } else {
                await addDoc(collection(firestore, FIRESTORE_COLLECTION), entryDataForFirestore);
                toast({ title: "Enregistrement Ajouté" });
            }
            fetchDefrostingEntries();
            setIsDesktopDialogOpen(false);
        } catch (error) {
            console.error("Error saving entry:", error);
            toast({ title: "Erreur de Sauvegarde", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };
const handleDeleteAllForMonth = async () => {
    setIsLoading(true);
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

    try {
        const q = query(
            collection(firestore, FIRESTORE_COLLECTION),
            where("defrostStartDate", ">=", Timestamp.fromDate(startOfMonth)),
            where("defrostStartDate", "<=", Timestamp.fromDate(endOfMonth))
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

        fetchDefrostingEntries();
        toast({
            title: "Enregistrements Supprimés",
            description: `L'historique pour ${format(selectedDate, 'MMMM yyyy', { locale: fr })} a été vidé.`,
            variant: "destructive"
        });
    } catch (error) {
        console.error("Error deleting month's entries:", error);
        toast({ title: "Erreur de Suppression", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
};

    const handleDeleteEntry = async (entryId: string) => {
        setIsLoading(true);
        try {
            await deleteDoc(doc(firestore, FIRESTORE_COLLECTION, entryId));
            toast({ title: "Enregistrement Supprimé", variant: "destructive" });
            fetchDefrostingEntries();
        } catch (error) {
            console.error("Error deleting entry:", error);
            toast({ title: "Erreur de Suppression", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    
      const generatePdf = async () => {
        if (entries.length === 0) {
            toast({ title: "Aucune Donnée", description: "Il n'y a aucun enregistrement à exporter." });
            return;
        }
        setIsGeneratingPdf(true);
        try {
            const pdfSettings = await getPdfLayoutSettings('pms_defrosting_monitoring');
            const doc = new jsPDF({
                orientation: pdfSettings.orientation as any || 'landscape',
                unit: 'pt',
                format: pdfSettings.pageSize as any || 'a4',
            }) as any;

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
            const moduleDefaultTitle = `Suivi de Décongélation - ${monthYearTitle}`;
            let finalTitle = pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle ? pdfSettings.documentBaseTitle.trim() : "";
            if (pdfSettings.showModuleTitle) {
                finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
            }
            if (finalTitle) {
                doc.setFontSize(pdfSettings.documentTitleFontSize);
                doc.text(finalTitle, doc.internal.pageSize.width / 2, currentY, { align: 'center' });
                currentY += pdfSettings.documentTitleFontSize + 5;
            }
            
            // --- STYLES & STRUCTURE DU TABLEAU ---
            const headStyles = {
                fontStyle: 'bold', halign: 'center', valign: 'middle',
                fontSize: 8, cellPadding: 2,
            };
            
            if (pdfSettings.primaryColor) {
                const rgb = hexToRgb(pdfSettings.primaryColor);
                if (rgb) {
                    (headStyles as any).fillColor = pdfSettings.primaryColor;
                    (headStyles as any).textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 125 ? '#000000' : '#FFFFFF';
                }
            }

            const head = [["Date", "Produit", "Qté", "T° Sortie", "H. Sortie", "Initiales", "Date Util.", "H. Util.", "T° Util.", "Initiales Fin"]];
            
            const body = entries.map(entry => [
                entry.defrostStartDate ? format(parseISO(entry.defrostStartDate), "dd/MM/yy") : '',
                entry.productName,
                entry.quantity,
                entry.tempOnRemoval || '°C',
                entry.defrostStartTime || '',
                entry.initialsStart || '',
                entry.useDate ? format(parseISO(entry.useDate), "dd/MM/yy") : '-',
                entry.useTime || '-',
                entry.tempOnUse || '-°C',
                entry.initialsEnd || '-',
            ]);

            doc.autoTable({
                head, body, startY: currentY, theme: 'grid',
                headStyles: headStyles,
                styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center' },
                columnStyles: { 1: { halign: 'left' } },
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
                },
            });

            const fileName = `Suivi_Decongelation_${format(selectedDate, 'yyyy-MM')}.pdf`;
            doc.save(fileName);
            toast({ title: "PDF Généré", description: `Le fichier "${fileName}" a été téléchargé.` });

        } catch (error) {
            console.error("Erreur lors de la génération du PDF:", error);
            toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
        } finally {
            setIsGeneratingPdf(false);
        }
    };



    
    const ongoingEntries = useMemo(() => entries.filter(e => !e.useDate), [entries]);

    // --- Rendu conditionnel Mobile / Bureau ---

    if (isMobile) {
        return (
            <div className="space-y-4">
                {/* === Démarrer une Décongélation (Mobile) === */}
                <Card className="shadow-lg">
                    <CardHeader><CardTitle className="flex items-center gap-2"><PlusCircle className="w-6 h-6 text-primary" /> Démarrer une Décongélation</CardTitle></CardHeader>
                    <CardContent>
                        <Form {...mobileStartForm}>
                            <form onSubmit={mobileStartForm.handleSubmit(handleStartDefrosting)} className="space-y-4">
                                <FormField control={mobileStartForm.control} name="productName" render={({ field }) => (
                                    <FormItem><FormLabel>Nom du Produit</FormLabel><FormControl><Input placeholder="Ex: Filet de Saumon" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={mobileStartForm.control} name="quantity" render={({ field }) => (
                                    <FormItem><FormLabel>Quantité</FormLabel><FormControl><Input placeholder="Ex: 2 kg" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground text-center">
                                    <div className="flex items-center justify-center gap-1 bg-slate-100 p-2 rounded-md"><Thermometer className="h-4 w-4" />-18°C</div>
                                    <div className="flex items-center justify-center gap-1 bg-slate-100 p-2 rounded-md"><Clock className="h-4 w-4" />{format(new Date(), 'HH:mm')}</div>
                                    <div className="flex items-center justify-center gap-1 bg-slate-100 p-2 rounded-md"><User className="h-4 w-4" />{userInitials}</div>
                                </div>
                                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Démarrer</Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                {/* === Produits en Décongélation (Mobile) === */}
                <Card className="shadow-lg">
                    <CardHeader><CardTitle className="flex items-center gap-2"><Snowflake className="w-6 h-6 text-primary animate-pulse" /> Produits en Décongélation</CardTitle></CardHeader>
                    <CardContent>
                        {isLoading && ongoingEntries.length === 0 ? <div className="flex justify-center items-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
                            : ongoingEntries.length === 0 ? <p className="text-muted-foreground text-center py-4">Aucun produit en cours.</p>
                            : (
                                <ul className="space-y-3">
                                    {ongoingEntries.map(entry => (
                                        <li key={entry.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                            <div>
                                                <p className="font-bold">{entry.productName} <span className="font-normal text-muted-foreground">({entry.quantity})</span></p>
                                                <p className="text-sm text-muted-foreground">Démarré le {format(parseISO(entry.defrostStartDate), "dd/MM 'à' HH:mm", { locale: fr })}</p>
                                            </div>
                                            <Button size="sm" onClick={() => handleOpenFinishDialog(entry)}>Terminer</Button>
                                        </li>
                                    ))}
                                </ul>
                            )
                        }
                    </CardContent>
                </Card>

                {/* === Dialogue pour Terminer la Décongélation (Mobile) === */}
                <Dialog open={isFinishDialogOpen} onOpenChange={setIsFinishDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Terminer la Décongélation</DialogTitle>
                            <DialogDescription>{editingEntry?.productName}</DialogDescription>
                        </DialogHeader>
                        <Form {...mobileFinishForm}>
                            <form onSubmit={mobileFinishForm.handleSubmit(handleFinishDefrosting)} className="space-y-4">
                                <FormField control={mobileFinishForm.control} name="tempOnUse" render={({ field }) => (
                                    <FormItem><FormLabel>Température à cœur finale</FormLabel><FormControl><Input placeholder="Ex: 3°C" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground text-center">
                                    <div className="flex items-center justify-center gap-1 bg-slate-100 p-2 rounded-md"><Clock className="h-4 w-4" />{format(new Date(), 'HH:mm')}</div>
                                    <div className="flex items-center justify-center gap-1 bg-slate-100 p-2 rounded-md"><User className="h-4 w-4" />{userInitials}</div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsFinishDialogOpen(false)}>Annuler</Button>
                                    <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Valider</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // --- Rendu pour le Bureau ---
    return (
        <Card className="shadow-lg">
            <CardHeader className="flex-col sm:flex-row sm:items-start sm:justify-between space-y-2 sm:space-y-0">
    <div>
        <CardTitle className="flex items-center gap-2">
            <Snowflake className="w-6 h-6 text-primary" /> Suivi de Décongélation
        </CardTitle>
        <CardDescription>
            Suivi complet de la décongélation des produits, du début à la fin.
        </CardDescription>
    </div>

    <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
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
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button onClick={generatePdf} variant="outline" disabled={isGeneratingPdf || isLoading || entries.length === 0} className="w-full">
                {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                PDF
            </Button>
            <Dialog open={isDesktopDialogOpen} onOpenChange={setIsDesktopDialogOpen}>
                <DialogTrigger asChild>
                    <Button onClick={() => handleOpenDesktopDialog()} className="w-full"><PlusCircle className="mr-2 h-4 w-4" /> Ajouter</Button>
                </DialogTrigger>
                 <DialogContent className="sm:max-w-2xl md:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{editingEntry ? 'Modifier' : 'Ajouter'} un Enregistrement</DialogTitle>
                        <DialogDescription>
                            Remplissez ou modifiez les informations de suivi de la décongélation.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...desktopForm}>
                        <form onSubmit={desktopForm.handleSubmit(handleDesktopFormSubmit)} className="space-y-6 py-4">
                            <div className="space-y-4 rounded-md border p-4">
                                <h3 className="text-base font-semibold">Début de Décongélation</h3>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormField control={desktopForm.control} name="productName" render={({ field }) => (
                                        <FormItem><FormLabel>Nom du Produit</FormLabel><FormControl><Input placeholder="Ex: Filet de Saumon" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={desktopForm.control} name="quantity" render={({ field }) => (
                                        <FormItem><FormLabel>Quantité</FormLabel><FormControl><Input placeholder="Ex: 2 kg" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={desktopForm.control} name="defrostStartDate" render={({ field }) => (
                                        <FormItem className="flex flex-col pt-2"><FormLabel>Date de Début</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><LucideCalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, 'PPP', { locale: fr }) : <span>Choisir une date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={desktopForm.control} name="defrostStartTime" render={({ field }) => (
                                       <FormItem><FormLabel>Heure de Début</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                     <FormField control={desktopForm.control} name="tempOnRemoval" render={({ field }) => (
                                       <FormItem><FormLabel>T° de Sortie Congélateur</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={desktopForm.control} name="initialsStart" render={({ field }) => (
                                        <FormItem><FormLabel>Initiales (Début)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                            </div>

                            <div className="space-y-4 rounded-md border p-4">
                                 <h3 className="text-base font-semibold">Fin de Décongélation</h3>
                                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormField control={desktopForm.control} name="useDate" render={({ field }) => (
                                        <FormItem className="flex flex-col pt-2"><FormLabel>Date d'Utilisation</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><LucideCalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, 'PPP', { locale: fr }) : <span>Choisir une date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} disabled={(date) => date < (desktopForm.getValues("defrostStartDate") || new Date(0))} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={desktopForm.control} name="useTime" render={({ field }) => (
                                       <FormItem><FormLabel>Heure d'Utilisation</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={desktopForm.control} name="tempOnUse" render={({ field }) => (
                                       <FormItem><FormLabel>T° à Cœur à l'Utilisation</FormLabel><FormControl><Input placeholder="Ex: 3°C" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={desktopForm.control} name="initialsEnd" render={({ field }) => (
                                        <FormItem><FormLabel>Initiales (Fin)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                 </div>
                            </div>
                            
                            <DialogFooter>
                                <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                                <Button type="submit" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingEntry ? 'Enregistrer' : 'Ajouter'}</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    </div>
</CardHeader>
            <CardContent>
                <CardFooter className="flex justify-end pt-4">
    {entries.length > 0 && (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isLoading}>
                    <Trash2 className="mr-2 h-4 w-4" /> Supprimer le mois
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{`Confirmer la suppression pour ${format(selectedDate, 'MMMM yyyy', { locale: fr })} ?`}</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action est irréversible et supprimera tous les enregistrements pour le mois sélectionné.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAllForMonth} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmer
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )}
</CardFooter>

                {isLoading && entries.length === 0 ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Chargement...</div>
                    : !isLoading && entries.length === 0 ? <p className="text-center py-8">Aucun enregistrement.</p>
                    : (
                        <div className="overflow-x-auto rounded-lg border">
                            <Table id="defrosting-table">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Produit</TableHead>
                                        <TableHead>Quantité</TableHead>
                                        <TableHead>T° Sortie</TableHead>
                                        <TableHead>Heure Sortie</TableHead>
                                        <TableHead>Initial Dém.</TableHead>
                                        <TableHead>Date Util.</TableHead>
                                        <TableHead>Heure Util.</TableHead>
                                        <TableHead>T° Util.</TableHead>
                                        <TableHead>Visa Fin</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {entries.map(entry => (
                                        <TableRow key={entry.id}>
                                            <TableCell className="font-medium">{entry.defrostStartDate ? format(parseISO(entry.defrostStartDate), "dd/MM/yy") : ''}</TableCell>
                                            <TableCell>{entry.productName}</TableCell>
                                            <TableCell>{entry.quantity}</TableCell>
                                            <TableCell>{entry.tempOnRemoval}</TableCell>
                                            <TableCell>{entry.defrostStartTime}</TableCell>
                                            <TableCell>{entry.initialsStart}</TableCell>
                                            <TableCell>{entry.useDate ? format(parseISO(entry.useDate), "dd/MM/yy") : '-'}</TableCell>
                                            <TableCell>{entry.useTime || '-'}</TableCell>
                                            <TableCell>{entry.tempOnUse || '-'}</TableCell>
                                            <TableCell>{entry.initialsEnd || '-'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <Button variant="outline" size="icon" onClick={() => handleOpenDesktopDialog(entry)} className="h-7 w-7"><Edit2 className="h-4 w-4" /></Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="ml-2 h-7 w-7"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Supprimer l'enregistrement ?</AlertDialogTitle><AlertDialogDescription>Êtes-vous sûr de vouloir supprimer l'entrée pour "{entry.productName}" ? Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteEntry(entry.id)}>Supprimer</AlertDialogAction>
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
                    )
                }
            </CardContent>
        </Card>
    );
}
