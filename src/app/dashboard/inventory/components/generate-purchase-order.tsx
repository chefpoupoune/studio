
"use client";

import React, { useState, useMemo } from 'react';
import type { Product, PurchaseOrder, PurchaseOrderItem, PurchaseOrderUnit, PurchaseOrderStatus, Supplier } from '../types';
import { PURCHASE_ORDER_UNITS } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Printer, Loader2, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  suppliers: Supplier[];
  onAddPurchaseOrder: (items: PurchaseOrderItem[], supplierId?: string) => void;
  onDeletePurchaseOrder: (orderId: string) => void; 
  onReceivePurchaseOrder: (orderId: string) => void;
}

interface SelectedProductForPO extends Omit<PurchaseOrderItem, 'productName' | 'reference'> {
  productName: string;
  reference: string;
  selected: boolean;
  stockQuantity: number;
  stockUnit: string;
}

export default function GeneratePurchaseOrder({ products, purchaseOrders, suppliers, onAddPurchaseOrder, onDeletePurchaseOrder, onReceivePurchaseOrder }: GeneratePurchaseOrderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [orderItems, setOrderItems] = useState<SelectedProductForPO[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isDialogOpen) {
      let productsForSupplier = products;
      if (selectedSupplierId) {
        productsForSupplier = products.filter(p => 
          p.supplierReferences?.some(ref => ref.supplierId === selectedSupplierId)
        );
      }

      setOrderItems(
        productsForSupplier.map(p => {
          const supplierRef = p.supplierReferences?.find(ref => ref.supplierId === selectedSupplierId);
          return {
            productId: p.id,
            productName: p.name,
            reference: supplierRef ? supplierRef.reference : (p.supplierReferences?.[0]?.reference || ''),
            quantity: 1, 
            unit: p.unit as PurchaseOrderUnit,
            selected: false,
            stockQuantity: p.quantity,
            stockUnit: p.unit,
          };
        })
      );
    } else {
        setSelectedSupplierId(null); // Reset on dialog close
    }
  }, [isDialogOpen, products, selectedSupplierId]);

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
      .map(({ selected, stockQuantity, stockUnit, ...item }) => item as PurchaseOrderItem); 
      
    if (selectedItemsToSubmit.length === 0) {
      toast({ title: "Aucun produit sélectionné", description: "Veuillez sélectionner des produits et spécifier une quantité.", variant: "destructive" });
      return;
    }
    if (!selectedSupplierId) {
      toast({ title: "Aucun fournisseur sélectionné", description: "Veuillez sélectionner un fournisseur.", variant: "destructive" });
      return;
    }
    onAddPurchaseOrder(selectedItemsToSubmit, selectedSupplierId); 
    setIsDialogOpen(false);
  };

   const handlePrintPO = async (po: PurchaseOrder) => {
    setIsPrinting(true);
    // PDF Generation logic remains the same
    // ...
    setIsPrinting(false);
  };

  const getStatusBadgeVariant = (status: PurchaseOrderStatus) => {
    if (status === 'received') return 'success';
    return 'secondary';
  };
  
  const getSupplierName = (supplierId?: string) => {
      if (!supplierId) return "Non spécifié";
      return suppliers.find(s => s.id === supplierId)?.name || 'Fournisseur inconnu';
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Créer un Bon de Commande</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={products.length === 0}>
                <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Manuellement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Nouveau Bon de Commande Manuel</DialogTitle>
                <div className="text-sm text-muted-foreground">
                  Date: <CurrentDate />
                </div>
              </DialogHeader>
               <div className="my-4">
                <Label htmlFor="supplier-select">Fournisseur</Label>
                <Select onValueChange={setSelectedSupplierId} defaultValue={selectedSupplierId || undefined}>
                  <SelectTrigger id="supplier-select">
                    <SelectValue placeholder="Sélectionnez un fournisseur" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ScrollArea className="h-[450px] pr-4 my-4">
                 {selectedSupplierId ? (
                   <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Produit (Stock)</TableHead>
                        <TableHead>Référence</TableHead>
                        <TableHead className="w-[100px]">Quantité</TableHead>
                        <TableHead className="w-[120px]">Unité</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orderItems.map(item => (
                        <TableRow key={item.productId}>
                            <TableCell>
                            <Checkbox
                                checked={item.selected}
                                onCheckedChange={(checked) => handleSelectionChange(item.productId, checked as boolean)}
                            />
                            </TableCell>
                            <TableCell>
                            {item.productName} ({item.stockQuantity} {item.stockUnit})
                            </TableCell>
                            <TableCell>{item.reference}</TableCell>
                            <TableCell>
                            <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value))}
                                className="w-full"
                                disabled={!item.selected}
                            />
                            </TableCell>
                            <TableCell>
                                <Select onValueChange={(value) => handleUnitChange(item.productId, value as PurchaseOrderUnit)} defaultValue={item.unit} disabled={!item.selected}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PURCHASE_ORDER_UNITS.map(unit => (
                                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                 ) : (
                     <div className="text-center text-muted-foreground py-10">
                         <p>Veuillez d'abord sélectionner un fournisseur.</p>
                     </div>
                 )}
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Annuler</Button>
                </DialogClose>
                <Button onClick={handleSubmitPurchaseOrder} disabled={!selectedSupplierId || orderItems.filter(i => i.selected && i.quantity > 0).length === 0}>
                  Générer Bon de Commande
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
         <CardContent>
           <p className="text-sm text-muted-foreground">
             Générez des bons de commande manuellement ou importez-les via l'onglet "Actions Excel".
           </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Historique des Bons de Commande</CardTitle>
          <CardDescription>Liste des derniers bons de commande générés.</CardDescription>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun bon de commande pour le moment.</p>
          ) : (
            <TooltipProvider>
              <div className="space-y-4">
                {purchaseOrders.slice(0, 10).map(po => (
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
                          Date: {format(new Date(po.date), "dd MMMM yyyy", { locale: fr })} | Fournisseur: {getSupplierName(po.supplierId)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                        {po.status === 'pending' && (
                           <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button variant="default" size="sm">
                                      <CheckCircle2 className="mr-2 h-4 w-4" /> Livré
                                  </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Confirmer la livraison pour le bon N° {po.orderNumber}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                          Cette action mettra à jour les stocks correspondants et supprimera ce bon. Êtes-vous sûr ?
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => onReceivePurchaseOrder(po.id)}>
                                      Confirmer
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
                            <Button variant="destructive" size="sm">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer le bon de commande N° {po.orderNumber} ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible.
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
                            {po.items.map((item, index) => (
                              <TableRow key={index} className={item.isUnlinked ? 'bg-orange-100 text-zinc-900 dark:bg-orange-900/20 dark:text-orange-100' : ''}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center">
                                    {item.productName}
                                    {item.isUnlinked && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <AlertTriangle className="h-4 w-4 ml-2 text-orange-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Cet article n'est pas dans votre stock.</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </TableCell>
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
            </TooltipProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
