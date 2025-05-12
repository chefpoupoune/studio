
"use client";

import React, { useState, useMemo } from 'react';
import type { Product, PurchaseOrder, PurchaseOrderItem } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, ShoppingBag, Printer, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CurrentDate } from '@/components/current-date'; 
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

interface GeneratePurchaseOrderProps {
  products: Product[];
  purchaseOrders: PurchaseOrder[];
  onAddPurchaseOrder: (items: PurchaseOrderItem[]) => void;
}

interface SelectedProductForPO extends PurchaseOrderItem {
  selected: boolean;
}

export default function GeneratePurchaseOrder({ products, purchaseOrders, onAddPurchaseOrder }: GeneratePurchaseOrderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<SelectedProductForPO[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isDialogOpen) {
      setOrderItems(
        products.map(p => ({
          productId: p.id,
          productName: p.name,
          reference: p.reference,
          quantity: 1, 
          selected: false,
        }))
      );
    }
  }, [isDialogOpen, products]);

  const handleQuantityChange = (productId: string, quantity: number) => {
    setOrderItems(prevItems =>
      prevItems.map(item =>
        item.productId === productId ? { ...item, quantity: Math.max(0, quantity) } : item
      )
    );
  };

  const handleSelectionChange = (productId: string, selected: boolean) => {
    setOrderItems(prevItems =>
      prevItems.map(item =>
        item.productId === productId ? { ...item, selected } : item
      )
    );
  };

  const handleSubmitPurchaseOrder = () => {
    const selectedItems = orderItems.filter(item => item.selected && item.quantity > 0);
    if (selectedItems.length === 0) {
      toast({ title: "Aucun produit sélectionné", description: "Veuillez sélectionner des produits et spécifier une quantité.", variant: "destructive" });
      return;
    }
    onAddPurchaseOrder(selectedItems.map(({selected, ...item}) => item)); 
    setIsDialogOpen(false);
  };

  const handlePrintPO = (po: PurchaseOrder) => {
    setIsPrinting(true);
    try {
      const pdfSettings = getPdfLayoutSettings('purchase_order');
      const doc = new jsPDF() as jsPDFWithAutoTable;
      const generationDateFormatted = format(new Date(po.date), "dd MMMM yyyy", { locale: fr }); // Use PO date
      const printDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });


      let currentY = 15;
      if (pdfSettings.headerText) {
        doc.setFontSize(10);
        doc.text(pdfSettings.headerText, 14, currentY);
        currentY += 10;
      }

      // Add Logo URL if available
      if (pdfSettings.logoUrl) {
        doc.setFontSize(8); 
        doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY);
        currentY += 5; 
      }

      doc.setFontSize(18);
      doc.text("Bon de Commande Produit Cuisine Brebières", 14, currentY); // Static title from original code
      currentY += 8;
      doc.setFontSize(10);
      doc.text(`Date de commande: ${generationDateFormatted}`, 14, currentY);
      currentY += 5;
      doc.text(`Numéro de commande: ${po.orderNumber}`, 14, currentY);
      currentY += 5;
      doc.text(`Imprimé le: ${printDateFormatted}`, 14, currentY);
      currentY += 7;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number] } = {};
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      const body = po.items.map(item => [
        item.productName,
        item.reference,
        item.quantity.toString(),
      ]);

      doc.autoTable({
        startY: currentY,
        head: [['Produit', 'Référence', 'Quantité']],
        body: body,
        theme: 'grid',
        headStyles: headStyles,
        columnStyles: { 2: { halign: 'right' } },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText
              .replace('{date}', printDateFormatted) // Use print date for footer
              .replace('{pageNumber}', data.pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
            doc.setFontSize(9);
            doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        }
      });
      doc.save(`Bon_Commande_${po.orderNumber}.pdf`);
      toast({ title: "PDF de Bon de Commande Généré", description: `Le bon de commande ${po.orderNumber} a été téléchargé.` });
    } catch (error) {
      console.error("Error generating purchase order PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Créer un Bon de Commande</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={products.length === 0}>
                <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Bon de Commande
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nouveau Bon de Commande</DialogTitle>
                <div className="text-sm text-muted-foreground">
                  Date: <CurrentDate /> <br/>
                  Objet: Commande produit cuisine Brebières
                </div>
              </DialogHeader>
              {products.length === 0 ? (
                 <p className="text-muted-foreground text-center py-8">Aucun produit disponible pour créer un bon de commande. Veuillez d'abord ajouter des produits.</p>
              ) : (
                <ScrollArea className="h-[400px] pr-4 my-4">
                  <div className="space-y-4">
                    {orderItems.map((item) => (
                      <div key={item.productId} className="flex items-center justify-between p-3 border rounded-md bg-card hover:bg-muted/50">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`select-${item.productId}`}
                            checked={item.selected}
                            onCheckedChange={(checked) => handleSelectionChange(item.productId, !!checked)}
                          />
                          <Label htmlFor={`select-${item.productId}`} className="flex flex-col">
                            <span className="font-medium text-foreground">{item.productName}</span>
                            <span className="text-xs text-muted-foreground">Réf: {item.reference}</span>
                          </Label>
                        </div>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value, 10))}
                          className="w-20 h-8 text-sm"
                          min="0"
                          disabled={!item.selected}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Annuler</Button>
                </DialogClose>
                <Button onClick={handleSubmitPurchaseOrder} disabled={products.length === 0 || orderItems.filter(i => i.selected && i.quantity > 0).length === 0}>
                  Générer Bon de Commande
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
         <CardContent>
           <p className="text-sm text-muted-foreground">
             {products.length === 0 
               ? "Ajoutez des produits à votre inventaire avant de pouvoir créer un bon de commande."
               : "Créez ici vos bons de commande pour réapprovisionner vos stocks."
             }
           </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Historique des Bons de Commande</CardTitle>
          <CardDescription>Liste des 10 derniers bons de commande générés.</CardDescription>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun bon de commande généré.</p>
          ) : (
            <div className="space-y-4">
              {purchaseOrders.slice(0,10).map(po => (
                <Card key={po.id} className="bg-muted/30">
                  <CardHeader className="flex flex-row justify-between items-start pb-2">
                    <div>
                      <CardTitle className="text-lg">Commande N°: {po.orderNumber}</CardTitle>
                      <CardDescription>Date: {format(new Date(po.date), "dd MMMM yyyy", { locale: fr })}</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handlePrintPO(po)} disabled={isPrinting}>
                       {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Printer className="mr-2 h-4 w-4" />} 
                      Imprimer
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produit</TableHead>
                            <TableHead>Référence</TableHead>
                            <TableHead className="text-right">Quantité</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {po.items.map(item => (
                            <TableRow key={item.productId}>
                              <TableCell>{item.productName}</TableCell>
                              <TableCell>{item.reference}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    