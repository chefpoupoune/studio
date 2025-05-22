
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { Product, StockMovement } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRightLeft, PlusCircle, Trash2, FileText, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const stockMovementSchema = z.object({
  productId: z.string().min(1, "Veuillez sélectionner un produit."),
  type: z.enum(['entry', 'exit'], { required_error: "Veuillez sélectionner un type de mouvement." }),
  quantity: z.coerce.number().min(1, "La quantité doit être d'au moins 1."),
  notes: z.string().optional(),
});

type StockMovementFormData = z.infer<typeof stockMovementSchema>;

interface ManageStockMovementsProps {
  products: Product[];
  stockMovements: StockMovement[];
  onAddStockMovement: (movement: Omit<StockMovement, 'id' | 'date' | 'productName'>) => void;
  onDeleteAllStockMovements: () => void;
}

const currentFullYear = new Date().getFullYear();
const yearsArray = Array.from({ length: 10 }, (_, i) => currentFullYear - 5 + i);
const monthsArray = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(), // 0-indexed
  label: format(new Date(currentFullYear, i), "MMMM", { locale: fr }),
}));


export default function ManageStockMovements({ products, stockMovements, onAddStockMovement, onDeleteAllStockMovements }: ManageStockMovementsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  
  const [selectedYearForPdf, setSelectedYearForPdf] = useState<string>(currentFullYear.toString());
  const [selectedMonthForPdf, setSelectedMonthForPdf] = useState<string>(new Date().getMonth().toString()); // 0-indexed
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);


  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const form = useForm<StockMovementFormData>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: {
      productId: '',
      type: 'entry',
      quantity: 1,
      notes: '',
    },
  });

  const onSubmit = (data: StockMovementFormData) => {
    onAddStockMovement(data);
    form.reset();
    setIsDialogOpen(false);
  };

  const filteredStockMovements = useMemo(() => {
    if (!stockMovements || !isClient) return []; // Ensure stockMovements is not undefined and client is ready
    return stockMovements.filter(movement => {
      const movementDate = new Date(movement.date); // Ensure date is a Date object
      return movementDate.getFullYear().toString() === selectedYearForPdf &&
             movementDate.getMonth().toString() === selectedMonthForPdf;
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort most recent first
  }, [stockMovements, selectedYearForPdf, selectedMonthForPdf, isClient]);

  const generateMonthlyPdf = () => {
    if (filteredStockMovements.length === 0) {
      toast({ title: "Aucune Donnée", description: "Aucun mouvement de stock pour le mois sélectionné.", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const pdfSettings = getPdfLayoutSettings('inventory_stock_movements_monthly');
      const doc = new jsPDF({
        orientation: pdfSettings.orientation,
        unit: 'pt',
        format: pdfSettings.pageSize
      }) as jsPDFWithAutoTable;
      doc.setFont(pdfSettings.fontFamily);
      
      const monthLabel = monthsArray.find(m => m.value === selectedMonthForPdf)?.label || '';
      const titleText = `Historique des Mouvements de Stock - ${monthLabel} ${selectedYearForPdf}`;
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = pdfSettings.marginTop;

      // Header
      if (pdfSettings.headerText) {
        const headerRows = pdfSettings.headerText.split('\n').map(rowText => rowText.split('|').map(cellText => cellText.trim()));
        const headerTableBody = headerRows.map(row => row.map(cell => cell === '{logo}' ? '' : cell));
        doc.autoTable({
          body: headerTableBody, startY: currentY, theme: 'plain',
          styles: { fontSize: pdfSettings.headerFontSize, cellPadding: 1, font: pdfSettings.fontFamily },
          columnStyles: { 0: { cellWidth: 'auto'} },
          margin: { top: pdfSettings.marginTop, left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
          didDrawCell: (data) => {
            if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image') && headerRows[data.row.index][data.column.index] === '{logo}') {
              try {
                const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                const formatType = imgProps.fileType.toUpperCase();
                doc.addImage(pdfSettings.logoUrl, formatType, data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4);
              } catch (e) { console.error("Error adding logo to PDF header table:", e); }
            }
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;
      } else if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
        try {
          const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
          const formatType = imgProps.fileType.toUpperCase();
          const imgHeight = 30;
          const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
          doc.addImage(pdfSettings.logoUrl, formatType, pdfSettings.marginLeft, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 5;
        } catch(e) { console.error("Error adding standalone logo to PDF:", e); }
      }

      doc.setFontSize(pdfSettings.headerFontSize + 2);
      doc.text(titleText, pdfSettings.marginLeft, currentY);
      currentY += (pdfSettings.headerFontSize + 2) * 0.7 + 5;
      doc.setFontSize(pdfSettings.defaultFontSize);
      doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize + 5;

      const headStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, halign: 'center' };
      if (pdfSettings.primaryColor) {
        const rgb = hexToRgb(pdfSettings.primaryColor);
        if (rgb) {
          headStyles.fillColor = rgb;
          const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      const body = filteredStockMovements.map(movement => [
        format(new Date(movement.date), "dd/MM/yyyy HH:mm", { locale: fr }),
        movement.productName,
        movement.type === 'entry' ? 'Entrée' : 'Sortie',
        movement.quantity.toString(),
        movement.notes || 'N/A',
      ]);

      doc.autoTable({
        startY: currentY,
        head: [['Date', 'Produit', 'Type', 'Quantité', 'Notes']],
        body: body,
        theme: 'grid',
        headStyles: headStyles,
        styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
        margin: { top: pdfSettings.marginTop, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText
              .replace('{date}', generationDateFormatted)
              .replace('{pageNumber}', data.pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
          }
        }
      });

      doc.save(`Mouvements_Stock_${monthLabel}_${selectedYearForPdf}.pdf`);
      toast({ title: "PDF Mensuel Généré", description: "L'historique des mouvements de stock pour le mois sélectionné a été téléchargé." });

    } catch (error) {
      console.error("Error generating monthly stock PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF mensuel a échoué.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary"/>
                Enregistrer un Mouvement de Stock
            </CardTitle>
            <CardDescription>Enregistrez ici les entrées et sorties de produits.</CardDescription>
          </div>
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Mouvement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nouveau Mouvement de Stock</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produit</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={products.length === 0}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un produit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products.length > 0 ? products.map(product => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} (Réf: {product.reference}) - Stock: {product.quantity}
                              </SelectItem>
                            )) : <SelectItem value="disabled" disabled>Aucun produit disponible</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Type de Mouvement</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl><RadioGroupItem value="entry" /></FormControl>
                              <FormLabel className="font-normal">Entrée</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl><RadioGroupItem value="exit" /></FormControl>
                              <FormLabel className="font-normal">Sortie</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantité</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optionnel)</FormLabel>
                        <FormControl><Textarea placeholder="Ex: Réception fournisseur, Utilisation interne..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                     <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit" disabled={products.length === 0}>Enregistrer Mouvement</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground">
             {products.length === 0 ? "Veuillez d'abord ajouter des produits dans l'onglet 'Gestion Produits'." :
              "Enregistrez ici les entrées et sorties de produits pour maintenir votre inventaire à jour."
             }
           </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Historique des Mouvements</CardTitle>
          <CardDescription>Liste des mouvements de stock enregistrés pour la période sélectionnée.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end mb-4">
            <div>
              <Label htmlFor="year-select-history">Année</Label>
              <Select value={selectedYearForPdf} onValueChange={setSelectedYearForPdf}>
                <SelectTrigger id="year-select-history"><SelectValue placeholder="Année" /></SelectTrigger>
                <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="month-select-history">Mois</Label>
              <Select value={selectedMonthForPdf} onValueChange={setSelectedMonthForPdf}>
                <SelectTrigger id="month-select-history"><SelectValue placeholder="Mois" /></SelectTrigger>
                <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={generateMonthlyPdf} disabled={isGeneratingPdf || filteredStockMovements.length === 0} className="w-full sm:w-auto">
                {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF du Mois
            </Button>
          </div>

          {filteredStockMovements.length === 0 ? (
             <p className="text-muted-foreground text-center py-8">Aucun mouvement de stock pour {monthsArray.find(m => m.value === selectedMonthForPdf)?.label} {selectedYearForPdf}.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md max-h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStockMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{format(new Date(movement.date), "dd/MM/yyyy HH:mm", { locale: fr })}</TableCell>
                      <TableCell className="font-medium">{movement.productName}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${movement.type === 'entry' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {movement.type === 'entry' ? 'Entrée' : 'Sortie'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{movement.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{movement.notes || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {stockMovements.length > 0 && (
          <CardFooter className="flex justify-end pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer Tout l'Historique (Global)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer TOUT l'historique des mouvements ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible et supprimera tous les mouvements de stock enregistrés, toutes périodes confondues.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onDeleteAllStockMovements}>
                    Supprimer Tout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

    