"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UpdateStockFromExcel from './update-stock-from-excel';
import AddPurchaseOrderFromExcel from './add-purchase-order-from-excel';
import type { Product, PurchaseOrderItem } from '../types';

interface StockUpdate {
  reference: string;
  quantityToAdd: number;
  productName?: string;
}

interface ExcelActionsPageProps {
  products: Product[];
  onUpdateStock: (updates: StockUpdate[]) => void;
  onAddPurchaseOrder: (items: PurchaseOrderItem[]) => void;
}

export default function ExcelActionsPage({ products, onUpdateStock, onAddPurchaseOrder }: ExcelActionsPageProps) {
  return (
    <Tabs defaultValue="update_stock" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="update_stock">Mise à Jour des Stocks</TabsTrigger>
        <TabsTrigger value="add_po">Créer un Bon de Commande</TabsTrigger>
      </TabsList>
      <TabsContent value="update_stock">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Mise à Jour des Stocks par Excel</CardTitle>
            <CardDescription>
              Importez un fichier Excel pour mettre à jour les quantités de stock de plusieurs produits en une seule fois.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpdateStockFromExcel onUpdateStock={onUpdateStock} />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="add_po">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Créer un Bon de Commande par Excel</CardTitle>
            <CardDescription>
              Importez un fichier Excel pour générer un nouveau bon de commande avec plusieurs articles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddPurchaseOrderFromExcel products={products} onAddPurchaseOrder={onAddPurchaseOrder} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
