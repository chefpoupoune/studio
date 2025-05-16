
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { DailyCoolDownEntry, DailyDeliveryEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, FileText, Loader2, ArrowDownCircle, Truck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { cn } from '@/lib/utils';
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

const todayKey = format(new Date(), 'yyyy-MM-dd');
const COOLDOWN_LOG_STORAGE_KEY_PREFIX = "pms_cold_chain_cooldown_v2_"; // Versioned key
const DELIVERY_LOG_STORAGE_KEY_PREFIX = "pms_cold_chain_delivery_v2_"; 

// Schemas
const coolDownEntrySchema = z.object({
  productName: z.string().min(1, "Nom du produit requis."),
  quantity: z.string().min(1, "Quantité requise."),
  piecesOrPlats: z.string().optional(), // New field
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Format HH:MM requis." }).optional().or(z.literal('')),
  startTemp: z.string().optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Format HH:MM requis." }).optional().or(z.literal('')),
  endTemp: z.string().optional(),
  visa: z.string().optional(),
});
type CoolDownFormData = z.infer<typeof coolDownEntrySchema>;

const deliveryEntrySchema = z.object({
  productName: z.string().min(1, "Nom du plat/produit requis."),
  quantity: z.string().optional(),
  piecesOrPlats: z.string().optional(),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Format HH:MM requis." }).optional().or(z.literal('')),
  departureTemp: z.string().optional(),
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Format HH:MM requis." }).optional().or(z.literal('')),
  arrivalTemp: z.string().optional(),
  visaLivreur: z.string().optional(),
  visaClient: z.string().optional(),
});
type DeliveryFormData = z.infer<typeof deliveryEntrySchema>;


export default function ColdChainMonitoring() {
  const [coolDownEntries, setCoolDownEntries] = useState<DailyCoolDownEntry[]>([]);
  const [deliveryEntries, setDeliveryEntries] = useState<DailyDeliveryEntry[]>([]);
  
  const [isCoolDownDialogOpen, setIsCoolDownDialogOpen] = useState(false);
  const [editingCoolDownEntry, setEditingCoolDownEntry] = useState<DailyCoolDownEntry | null>(null);
  
  const [isDeliveryDialogOpen, setIsDeliveryDialogOpen] = useState(false);
  const [editingDeliveryEntry, setEditingDeliveryEntry] = useState<DailyDeliveryEntry | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const coolDownForm = useForm<CoolDownFormData>({ resolver: zodResolver(coolDownEntrySchema) });
  const deliveryForm = useForm<DeliveryFormData>({ resolver: zodResolver(deliveryEntrySchema) });

  const getCoolDownStorageKey = useCallback(() => `${COOLDOWN_LOG_STORAGE_KEY_PREFIX}${todayKey}`, []);
  const getDeliveryStorageKey = useCallback(() => `${DELIVERY_LOG_STORAGE_KEY_PREFIX}${todayKey}`, []);

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedCoolDown = localStorage.getItem(getCoolDownStorageKey());
      if (storedCoolDown) setCoolDownEntries(JSON.parse(storedCoolDown));
      else setCoolDownEntries([]);

      const storedDelivery = localStorage.getItem(getDeliveryStorageKey());
      if (storedDelivery) setDeliveryEntries(JSON.parse(storedDelivery));
      else setDeliveryEntries([]);

    } catch (error) {
      console.error("Error loading cold chain data:", error);
      toast({ title: "Erreur de chargement", description: "Données de liaison froide corrompues.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast, getCoolDownStorageKey, getDeliveryStorageKey]);

  useEffect(() => {
    if (!isLoading) localStorage.setItem(getCoolDownStorageKey(), JSON.stringify(coolDownEntries));
  }, [coolDownEntries, isLoading, getCoolDownStorageKey]);

  useEffect(() => {
    if (!isLoading) localStorage.setItem(getDeliveryStorageKey(), JSON.stringify(deliveryEntries));
  }, [deliveryEntries, isLoading, getDeliveryStorageKey]);

  const handleOpenCoolDownDialog = (entry?: DailyCoolDownEntry) => {
    setEditingCoolDownEntry(entry || null);
    coolDownForm.reset(entry || { productName: '', quantity: '', piecesOrPlats: '', startTime: '', startTemp: '', endTime: '', endTemp: '', visa: '' });
    setIsCoolDownDialogOpen(true);
  };

  const handleCoolDownFormSubmit = (data: CoolDownFormData) => {
    if (editingCoolDownEntry) {
      setCoolDownEntries(prev => prev.map(e => e.id === editingCoolDownEntry.id ? { ...editingCoolDownEntry, ...data } : e));
      toast({ title: "Modification Enregistrée", description: "L'entrée de baisse en température a été mise à jour." });
    } else {
      const newEntry: DailyCoolDownEntry = { ...data, id: `cd_${Date.now()}` };
      setCoolDownEntries(prev => [newEntry, ...prev]);
      toast({ title: "Nouvelle Entrée Ajoutée", description: "Baisse en température enregistrée." });
    }
    setIsCoolDownDialogOpen(false);
  };

  const handleDeleteCoolDownEntry = (entryId: string) => {
    setCoolDownEntries(prev => prev.filter(e => e.id !== entryId));
    toast({ title: "Entrée Supprimée", variant: "destructive" });
  };

  const handleOpenDeliveryDialog = (entry?: DailyDeliveryEntry) => {
    setEditingDeliveryEntry(entry || null);
    deliveryForm.reset(entry || { productName: '', quantity: '', piecesOrPlats: '', departureTime: '', departureTemp: '', arrivalTime: '', arrivalTemp: '', visaLivreur: '', visaClient: '' });
    setIsDeliveryDialogOpen(true);
  };

  const handleDeliveryFormSubmit = (data: DeliveryFormData) => {
    if (editingDeliveryEntry) {
      setDeliveryEntries(prev => prev.map(e => e.id === editingDeliveryEntry.id ? { ...editingDeliveryEntry, ...data } : e));
      toast({ title: "Modification Enregistrée", description: "L'entrée de livraison a été mise à jour." });
    } else {
      const newEntry: DailyDeliveryEntry = { ...data, id: `del_${Date.now()}` };
      setDeliveryEntries(prev => [newEntry, ...prev]);
      toast({ title: "Nouvelle Entrée Ajoutée", description: "Livraison enregistrée." });
    }
    setIsDeliveryDialogOpen(false);
  };

  const handleDeleteDeliveryEntry = (entryId: string) => {
    setDeliveryEntries(prev => prev.filter(e => e.id !== entryId));
    toast({ title: "Entrée Supprimée", variant: "destructive" });
  };
  
  const generatePdf = (dataType: 'cooldown' | 'delivery') => {
    setIsLoading(true);
    try {
      const isCooldown = dataType === 'cooldown';
      const dataToExport = isCooldown ? coolDownEntries : deliveryEntries;
      const title = isCooldown ? "Suivi Baisse en Température du Jour" : "Suivi Livraison du Jour";
      const filenameSuffix = isCooldown ? "Baisse_Temperature" : "Livraison";
      const settingsKey = isCooldown ? 'pms_cooldown_monitoring' : 'pms_delivery_monitoring';

      if(dataToExport.length === 0) {
        toast({title: "Aucune donnée", description: `Aucune donnée à exporter pour ${title.toLowerCase()}.`, variant: "destructive"});
        setIsLoading(false);
        return;
      }

      const pdfSettings = getPdfLayoutSettings(settingsKey); 
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) { doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10; }
      if (pdfSettings.logoUrl) { doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY); currentY += 5; }
      
      doc.setFontSize(16); doc.text(`${title} - ${format(new Date(), "dd/MM/yyyy", {locale: fr})}`, 14, currentY); currentY += 8;
      doc.setFontSize(10); doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY); currentY += 7;

      const baseHeadStyles: any = { fontSize: 9, fontStyle: 'bold', halign: 'center', valign: 'middle' };
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) baseHeadStyles.fillColor = primaryColorRgb;
        baseHeadStyles.textColor = (hexToRgb(pdfSettings.primaryColor)![0] * 299 + hexToRgb(pdfSettings.primaryColor)![1] * 587 + hexToRgb(pdfSettings.primaryColor)![2] * 114) / 1000 > 125 ? [0,0,0] : [255,255,255];
      }

      let head: any[], body: any[][], columnStyles: any = {}, cellStyles: any = {};
      
      const orangeBg = [239, 121, 40]; // Orange
      const blueBg = [155, 194, 230];   // Light Blue
      const greyBg = [200, 200, 200];   // Light Grey
      const whiteText: [number, number, number] = [255,255,255];
      const blackText: [number, number, number] = [0,0,0];

      const coloredHeadStyle = (bgColor: [number,number,number], textColor: [number,number,number]) => ({ ...baseHeadStyles, fillColor: bgColor, textColor: textColor, fontSize: 8 });


      if (isCooldown) {
        head = [
          [ 
            { content: 'Produits', rowSpan: 2, styles: baseHeadStyles }, 
            { content: 'Quantité', rowSpan: 2, styles: baseHeadStyles },
            { content: 'Pièces / Plats', rowSpan: 2, styles: baseHeadStyles },
            { content: 'Debut', colSpan: 2, styles: coloredHeadStyle(orangeBg, whiteText) },
            { content: 'Fin', colSpan: 2, styles: coloredHeadStyle(blueBg, blackText) },
            { content: 'VISA', colSpan: 1, styles: coloredHeadStyle(greyBg, blackText) }, // Adjusted colSpan
          ],
          [ 
            { content: 'heure', styles: coloredHeadStyle(orangeBg, whiteText) },
            { content: 'Temperature', styles: coloredHeadStyle(orangeBg, whiteText) },
            { content: 'heure', styles: coloredHeadStyle(blueBg, blackText) },
            { content: 'Temperature', styles: coloredHeadStyle(blueBg, blackText) },
            { content: 'Signature', styles: coloredHeadStyle(greyBg, blackText) },
          ]
        ];
        body = (dataToExport as DailyCoolDownEntry[]).map(e => [
            e.productName, 
            e.quantity, 
            e.piecesOrPlats || '-', 
            { content: e.startTime || '-', styles: { fillColor: orangeBg } }, 
            { content: e.startTemp || '-', styles: { fillColor: orangeBg } }, 
            { content: e.endTime || '-', styles: { fillColor: blueBg } }, 
            { content: e.endTemp || '-', styles: { fillColor: blueBg } }, 
            { content: e.visa || '-', styles: { fillColor: greyBg } }
        ]);
      } else { // Delivery
        const greenBg = [209, 250, 229]; const yellowBg = [254, 249, 195]; 
        head = [
          [ 
            { content: 'Produits', rowSpan: 2, styles: baseHeadStyles },
            { content: 'Quantité', rowSpan: 2, styles: baseHeadStyles },
            { content: 'Pièces / Plats', rowSpan: 2, styles: baseHeadStyles },
            { content: 'Départ', colSpan: 2, styles: coloredHeadStyle(greenBg, blackText) },
            { content: 'Arrivé', colSpan: 2, styles: coloredHeadStyle(yellowBg, blackText) },
            { content: 'VISA', colSpan: 2, styles: coloredHeadStyle(greyBg, blackText) }
          ],
          [ 
            { content: 'heure', styles: coloredHeadStyle(greenBg, blackText) },
            { content: 'Temperature', styles: coloredHeadStyle(greenBg, blackText) },
            { content: 'heure', styles: coloredHeadStyle(yellowBg, blackText) },
            { content: 'Temperature', styles: coloredHeadStyle(yellowBg, blackText) },
            { content: 'Livreur', styles: coloredHeadStyle(greyBg, blackText) },
            { content: 'Client', styles: coloredHeadStyle(greyBg, blackText) }
          ]
        ];
        body = (dataToExport as DailyDeliveryEntry[]).map(e => [
          e.productName, 
          e.quantity || '-', 
          e.piecesOrPlats || '-', 
          { content: e.departureTime || '-', styles: { fillColor: greenBg } }, 
          { content: e.departureTemp || '-', styles: { fillColor: greenBg } }, 
          { content: e.arrivalTime || '-', styles: { fillColor: yellowBg } }, 
          { content: e.arrivalTemp || '-', styles: { fillColor: yellowBg } }, 
          { content: e.visaLivreur || '-', styles: { fillColor: greyBg } }, 
          { content: e.visaClient || '-', styles: { fillColor: greyBg } }
        ]);
      }

      doc.autoTable({
        head, body, startY: currentY, theme: 'grid', 
        styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle', halign: 'center' },
        didDrawPage: (hookData) => { /* Footer logic */ }
      });
      doc.save(`Suivi_${filenameSuffix}_${todayKey}.pdf`);
      toast({ title: "PDF Généré", description: `Le PDF pour ${title.toLowerCase()} a été téléchargé.` });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const cellBgClasses = {
    debut: "bg-orange-400 text-white",
    fin: "bg-blue-300 text-black",
    visa: "bg-gray-200 text-black",
    depart: "bg-green-100 dark:bg-green-800/30",
    arrive: "bg-yellow-100 dark:bg-yellow-800/30",
  };


  return (
    <div className="space-y-6">
      {/* Baisse en Température */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2"><ArrowDownCircle className="w-6 h-6 text-primary"/>Baisse en Température du Jour</div>
            <Dialog open={isCoolDownDialogOpen} onOpenChange={setIsCoolDownDialogOpen}>
              <DialogTrigger asChild><Button onClick={() => handleOpenCoolDownDialog()}><PlusCircle className="mr-2 h-4 w-4"/>Ajouter Produit</Button></DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{editingCoolDownEntry ? "Modifier" : "Nouveau"} Produit en Refroidissement</DialogTitle></DialogHeader>
                <Form {...coolDownForm}>
                  <form onSubmit={coolDownForm.handleSubmit(handleCoolDownFormSubmit)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
                    <FormField control={coolDownForm.control} name="productName" render={({ field }) => (<FormItem><FormLabel>Nom du Produit</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-2 gap-3">
                        <FormField control={coolDownForm.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantité</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={coolDownForm.control} name="piecesOrPlats" render={({ field }) => (<FormItem><FormLabel>Pièces / Plats</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <h4 className="text-sm font-medium pt-1 text-center">Debut</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={coolDownForm.control} name="startTime" render={({ field }) => (<FormItem><FormLabel>Heure Début</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={coolDownForm.control} name="startTemp" render={({ field }) => (<FormItem><FormLabel>T° Début (°C)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <h4 className="text-sm font-medium pt-1 text-center">Fin</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={coolDownForm.control} name="endTime" render={({ field }) => (<FormItem><FormLabel>Heure Fin (&lt;2h)</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={coolDownForm.control} name="endTemp" render={({ field }) => (<FormItem><FormLabel>T° Fin (&lt;10°C)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <h4 className="text-sm font-medium pt-1 text-center">VISA</h4>
                    <FormField control={coolDownForm.control} name="visa" render={({ field }) => (<FormItem><FormLabel>Signature</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <DialogFooter className="pt-3"><DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose><Button type="submit">{editingCoolDownEntry ? "Enregistrer" : "Ajouter"}</Button></DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardTitle>
          <CardDescription>Suivi des produits mis en refroidissement rapide pour la journée en cours.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div> : coolDownEntries.length === 0 ? <p className="text-center text-muted-foreground">Aucun produit en refroidissement.</p> : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead rowSpan={2} className="text-center align-middle min-w-[150px]">Produits</TableHead>
                        <TableHead rowSpan={2} className="text-center align-middle min-w-[80px]">Quantité</TableHead>
                        <TableHead rowSpan={2} className="text-center align-middle min-w-[100px]">Pièces / Plats</TableHead>
                        <TableHead colSpan={2} className={cn("text-center", cellBgClasses.debut)}>Debut</TableHead>
                        <TableHead colSpan={2} className={cn("text-center", cellBgClasses.fin)}>Fin</TableHead>
                        <TableHead colSpan={1} className={cn("text-center", cellBgClasses.visa)}>VISA</TableHead>
                        <TableHead rowSpan={2} className="text-center align-middle min-w-[100px]">Actions</TableHead>
                    </TableRow>
                    <TableRow>
                        <TableHead className={cn("text-center", cellBgClasses.debut)}>heure</TableHead>
                        <TableHead className={cn("text-center", cellBgClasses.debut)}>Temperature</TableHead>
                        <TableHead className={cn("text-center", cellBgClasses.fin)}>heure</TableHead>
                        <TableHead className={cn("text-center", cellBgClasses.fin)}>Temperature</TableHead>
                        <TableHead className={cn("text-center", cellBgClasses.visa)}>Signature</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {coolDownEntries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>{e.productName}</TableCell>
                      <TableCell className="text-center">{e.quantity}</TableCell>
                      <TableCell className="text-center">{e.piecesOrPlats || '-'}</TableCell>
                      <TableCell className={cn("text-center", cellBgClasses.debut)}>{e.startTime || '-'}</TableCell>
                      <TableCell className={cn("text-center", cellBgClasses.debut)}>{e.startTemp || '-'}</TableCell>
                      <TableCell className={cn("text-center", cellBgClasses.fin)}>{e.endTime || '-'}</TableCell>
                      <TableCell className={cn("text-center", cellBgClasses.fin)}>{e.endTemp || '-'}</TableCell>
                      <TableCell className={cn("text-center", cellBgClasses.visa)}>{e.visa || '-'}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer "{e.productName}"?</AlertDialogTitle><AlertDialogDescription>Action irréversible.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteCoolDownEntry(e.id)}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                        <Button variant="outline" size="icon" onClick={() => handleOpenCoolDownDialog(e)} className="h-7 w-7"><Edit2 className="h-3.5 w-3.5"/></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {coolDownEntries.length > 0 && <div className="mt-4 flex justify-end"><Button onClick={() => generatePdf('cooldown')} size="sm" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<FileText className="mr-2 h-4 w-4"/>} Générer PDF</Button></div>}
        </CardContent>
      </Card>

      {/* Livraison du Jour */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Truck className="w-6 h-6 text-primary"/>Livraison du Jour</div>
            <Dialog open={isDeliveryDialogOpen} onOpenChange={setIsDeliveryDialogOpen}>
              <DialogTrigger asChild><Button onClick={() => handleOpenDeliveryDialog()}><PlusCircle className="mr-2 h-4 w-4"/>Ajouter Livraison</Button></DialogTrigger>
              <DialogContent className="sm:max-w-xl md:max-w-2xl">
                <DialogHeader><DialogTitle>{editingDeliveryEntry ? "Modifier" : "Nouvelle"} Livraison</DialogTitle></DialogHeader>
                <Form {...deliveryForm}>
                  <form onSubmit={deliveryForm.handleSubmit(handleDeliveryFormSubmit)} className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-2">
                    <FormField control={deliveryForm.control} name="productName" render={({ field }) => (<FormItem><FormLabel>Produit/Plat</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-2 gap-3">
                        <FormField control={deliveryForm.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantité</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={deliveryForm.control} name="piecesOrPlats" render={({ field }) => (<FormItem><FormLabel>Pièces / Plats</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <h4 className="text-sm font-medium pt-1 text-center">Départ</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={deliveryForm.control} name="departureTime" render={({ field }) => (<FormItem><FormLabel>Heure Départ</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={deliveryForm.control} name="departureTemp" render={({ field }) => (<FormItem><FormLabel>T° Départ (°C)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                     <h4 className="text-sm font-medium pt-1 text-center">Arrivé</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={deliveryForm.control} name="arrivalTime" render={({ field }) => (<FormItem><FormLabel>Heure Arrivée</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={deliveryForm.control} name="arrivalTemp" render={({ field }) => (<FormItem><FormLabel>T° Arrivée (°C)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <h4 className="text-sm font-medium pt-1 text-center">VISA</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField control={deliveryForm.control} name="visaLivreur" render={({ field }) => (<FormItem><FormLabel>Visa Livreur</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={deliveryForm.control} name="visaClient" render={({ field }) => (<FormItem><FormLabel>Visa Client</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <DialogFooter className="pt-3"><DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose><Button type="submit">{editingDeliveryEntry ? "Enregistrer" : "Ajouter"}</Button></DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardTitle>
          <CardDescription>Suivi des livraisons pour la journée en cours.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div> : deliveryEntries.length === 0 ? <p className="text-center text-muted-foreground">Aucune livraison enregistrée.</p> : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead rowSpan={2} className="text-center align-middle min-w-[150px]">Produits</TableHead>
                        <TableHead rowSpan={2} className="text-center align-middle min-w-[80px]">Quantité</TableHead>
                        <TableHead rowSpan={2} className="text-center align-middle min-w-[100px]">Pièces / Plats</TableHead>
                        <TableHead colSpan={2} className={cn("text-center", cellBgClasses.depart)}>Départ</TableHead>
                        <TableHead colSpan={2} className={cn("text-center", cellBgClasses.arrive)}>Arrivé</TableHead>
                        <TableHead colSpan={2} className={cn("text-center", cellBgClasses.visa)}>VISA</TableHead>
                        <TableHead rowSpan={2} className="text-center align-middle min-w-[100px]">Actions</TableHead>
                    </TableRow>
                    <TableRow>
                        <TableHead className={cn("text-center", cellBgClasses.depart)}>heure</TableHead>
                        <TableHead className={cn("text-center", cellBgClasses.depart)}>Temperature</TableHead>
                        <TableHead className={cn("text-center", cellBgClasses.arrive)}>heure</TableHead>
                        <TableHead className={cn("text-center", cellBgClasses.arrive)}>Temperature</TableHead>
                        <TableHead className={cn("text-center", cellBgClasses.visa)}>Livreur</TableHead>
                        <TableHead className={cn("text-center", cellBgClasses.visa)}>Client</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryEntries.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>{e.productName}</TableCell>
                      <TableCell className="text-center">{e.quantity || '-'}</TableCell>
                      <TableCell className="text-center">{e.piecesOrPlats || '-'}</TableCell>
                      <TableCell className={cn("text-center", cellBgClasses.depart)}>{e.departureTime || '-'}</TableCell>
                      <TableCell className={cn("text-center", cellBgClasses.depart)}>{e.departureTemp || '-'}</TableCell>
                      <TableCell className={cn("text-center", cellBgClasses.arrive)}>{e.arrivalTime || '-'}</TableCell>
                      <TableCell className={cn("text-center", cellBgClasses.arrive)}>{e.arrivalTemp || '-'}</TableCell>
                      <TableCell className={cn("text-center", cellBgClasses.visa)}>{e.visaLivreur || '-'}</TableCell>
                      <TableCell className={cn("text-center", cellBgClasses.visa)}>{e.visaClient || '-'}</TableCell>
                      <TableCell className="text-center space-x-1">
                        <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Supprimer livraison de "{e.productName}"?</AlertDialogTitle><AlertDialogDescription>Action irréversible.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteDeliveryEntry(e.id)}>Supprimer</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                        <Button variant="outline" size="icon" onClick={() => handleOpenDeliveryDialog(e)} className="h-7 w-7"><Edit2 className="h-3.5 w-3.5"/></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {deliveryEntries.length > 0 && <div className="mt-4 flex justify-end"><Button onClick={() => generatePdf('delivery')} size="sm" disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<FileText className="mr-2 h-4 w-4"/>} Générer PDF</Button></div>}
        </CardContent>
      </Card>
    </div>
  );
}

