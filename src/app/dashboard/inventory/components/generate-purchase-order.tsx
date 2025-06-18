
"use client";

import React, { useState, useMemo } from 'react';
import type { Product, PurchaseOrder, PurchaseOrderItem, PurchaseOrderUnit, PurchaseOrderStatus } from '../types';
import { PURCHASE_ORDER_UNITS } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, ShoppingBag, Printer, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CurrentDate } from '@/components/current-date'; 
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

interface GeneratePurchaseOrderProps {
  products: Product[];
  purchaseOrders: PurchaseOrder[];
  onAddPurchaseOrder: (items: PurchaseOrderItem[]) => void;
  onDeletePurchaseOrder: (orderId: string) => void; 
  onReceivePurchaseOrder: (orderId: string) => void; // New prop
}

interface SelectedProductForPO extends Omit<PurchaseOrderItem, 'productName' | 'reference'> {
  productName: string;
  reference: string;
  selected: boolean;
}

export default function GeneratePurchaseOrder({ products, purchaseOrders, onAddPurchaseOrder, onDeletePurchaseOrder, onReceivePurchaseOrder }: GeneratePurchaseOrderProps) {
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
          unit: 'Piece' as PurchaseOrderUnit,
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

  const handleUnitChange = (productId: string, unit: PurchaseOrderUnit) => {
    setOrderItems(prevItems =>
      prevItems.map(item =>
        item.productId === productId ? { ...item, unit } : item
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
    const selectedItemsToSubmit = orderItems
      .filter(item => item.selected && item.quantity > 0)
      .map(({ selected, ...item }) => item as PurchaseOrderItem); 
      
    if (selectedItemsToSubmit.length === 0) {
      toast({ title: "Aucun produit sélectionné", description: "Veuillez sélectionner des produits et spécifier une quantité et une unité.", variant: "destructive" });
      return;
    }
    onAddPurchaseOrder(selectedItemsToSubmit); 
    setIsDialogOpen(false);
  };

  const handlePrintPO = (po: PurchaseOrder) => {
    setIsPrinting(true);
    try {
      const pdfSettings = getPdfLayoutSettings('purchase_order');
      const doc = new jsPDF({
        orientation: pdfSettings.orientation,
        unit: 'pt',
        format: pdfSettings.pageSize,
      }) as jsPDFWithAutoTable;
      doc.setFont(pdfSettings.fontFamily);
      
      const generationDateFormatted = format(new Date(po.date), "dd MMMM yyyy", { locale: fr }); 
      const printDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });


      let currentY = pdfSettings.marginTop;
      
      if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
        try {
            const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
            const format = imgProps.fileType.toUpperCase();
            const desiredHeight = 30; 
            const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
            doc.addImage(pdfSettings.logoUrl, format, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight);
            currentY += desiredHeight + 5;
        } catch(e: any) {
            console.error(`Error drawing logo in PDF: ${e.message || e}.`);
            doc.setFontSize(pdfSettings.defaultFontSize); doc.text(`[Logo Error]`, pdfSettings.marginLeft, currentY); currentY += pdfSettings.defaultFontSize + 5;
        }
      } else if (pdfSettings.logoUrl) {
         doc.setFontSize(pdfSettings.defaultFontSize); doc.text(`[Logo URL: ${pdfSettings.logoUrl}]`, pdfSettings.marginLeft, currentY); currentY += pdfSettings.defaultFontSize + 5;
      }

      if (pdfSettings.headerText) {
        const headerLines = pdfSettings.headerText.split('\n');
        doc.setFontSize(pdfSettings.headerFontSize);
        headerLines.forEach(line => {
            doc.text(line, pdfSettings.marginLeft, currentY);
            currentY += pdfSettings.headerFontSize * 0.7 + 2; 
        });
        currentY += 5;
      }

      const moduleDefaultTitle = `Bon de Commande N° ${po.orderNumber}`;
      let finalTitle = "";
      if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle && pdfSettings.documentBaseTitle.trim() !== "") {
        finalTitle = pdfSettings.documentBaseTitle.trim();
      }
      if (pdfSettings.showModuleTitle) {
        if (finalTitle) {
          finalTitle += ` - ${moduleDefaultTitle}`;
        } else {
          finalTitle = moduleDefaultTitle;
        }
      }

      if (finalTitle) {
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text(finalTitle, pdfSettings.marginLeft, currentY);
        currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;
      }
      
      doc.setFontSize(pdfSettings.defaultFontSize);
      doc.text(`Date de commande: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize + 2;
      doc.text(`Imprimé le: ${printDateFormatted}`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize + 5;


      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontStyle?: string, fontSize?: number } = { 
        fontStyle: 'bold',
        fontSize: pdfSettings.tableHeaderFontSize,
      };
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
        `${item.quantity} ${item.unit}`,
      ]);

      doc.autoTable({
        startY: currentY,
        head: [['Produit', 'Référence', 'Quantité']],
        body: body,
        theme: 'grid',
        headStyles: headStyles,
        styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
        columnStyles: { 2: { halign: 'right' } },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText
              .replace('{date}', printDateFormatted) 
              .replace('{pageNumber}', data.pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
          }
        },
        margin: { 
            top: pdfSettings.marginTop, 
            right: pdfSettings.marginRight, 
            bottom: pdfSettings.marginBottom, 
            left: pdfSettings.marginLeft 
        },
      });
      doc.save(`Bon_Commande_${po.orderNumber}.pdf`);
      toast({ title: "PDF de Bon de Commande Généré", description: `Le bon de commande ${po.orderNumber} a été téléchargé.` });
    } catch (error: any) {
      console.error("Error generating purchase order PDF:", error.message || error);
      toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${error.message || 'Erreur inconnue'}.`, variant: "destructive" });
    } finally {
      setIsPrinting(false);
    }
  };

  const getStatusBadgeVariant = (status: PurchaseOrderStatus) => {
    if (status === 'received') return 'success';
    return 'secondary';
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
            <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-3xl">
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
                <ScrollArea className="h-[450px] pr-4 my-4">
                  <div className="space-y-3">
                    {orderItems.map((item) => (
                      <div key={item.productId} className="flex items-center justify-between p-3 border rounded-md bg-card hover:bg-muted/50">
                        <div className="flex items-center space-x-3 flex-grow">
                          <Checkbox
                            id={`select-${item.productId}`}
                            checked={item.selected}
                            onCheckedChange={(checked) => handleSelectionChange(item.productId, !!checked)}
                          />
                          <Label htmlFor={`select-${item.productId}`} className="flex flex-col cursor-pointer">
                            <span className="font-medium text-foreground">{item.productName}</span>
                            <span className="text-xs text-muted-foreground">Réf: {item.reference}</span>
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value, 10))}
                            className="w-20 h-8 text-sm"
                            min="0"
                            disabled={!item.selected}
                          />
                          <Select 
                            value={item.unit} 
                            onValueChange={(value) => handleUnitChange(item.productId, value as PurchaseOrderUnit)}
                            disabled={!item.selected}
                          >
                            <SelectTrigger className="w-[100px] h-8 text-xs">
                              <SelectValue placeholder="Unité" />
                            </SelectTrigger>
                            <SelectContent>
                              {PURCHASE_ORDER_UNITS.map(unit => (
                                <SelectItem key={unit} value={unit} className="text-xs">{unit}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
                  <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">Commande N°: {po.orderNumber}</CardTitle>
                        <Badge variant={getStatusBadgeVariant(po.status)}>
                            {po.status === 'pending' ? 'En attente' : 'Reçu'}
                        </Badge>
                      </div>
                      <CardDescription>
                        Date: {format(new Date(po.date), "dd MMMM yyyy", { locale: fr })}
                        {po.status === 'received' && po.receivedDate && (
                            ` | Reçu le: ${format(new Date(po.receivedDate), "dd MMMM yyyy", { locale: fr })}`
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                      {po.status === 'pending' && (
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="default" size="sm" disabled={isPrinting}>
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Valider Réception
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmer la réception du Bon de Commande N° {po.orderNumber}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Cette action marquera la commande comme reçue et mettra à jour les stocks.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onReceivePurchaseOrder(po.id)}>
                                    Confirmer Réception
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                         </AlertDialog>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handlePrintPO(po)} disabled={isPrinting}>
                        {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Printer className="mr-2 h-4 w-4" />} 
                        Imprimer
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={isPrinting}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Supprimer
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ce bon de commande ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. Le bon de commande N° {po.orderNumber} sera définitivement supprimé.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeletePurchaseOrder(po.id)}>
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
                              <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
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
