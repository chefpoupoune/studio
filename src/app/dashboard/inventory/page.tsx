
"use client";

import Link from 'next/link';
import { PackagePlusIcon, ListOrderedIcon, ShoppingCartIcon, HistoryIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManageProducts from './components/manage-products';
import ManageStockMovements from './components/manage-stock-movements';
import GenerateInventory from './components/generate-inventory';
import GeneratePurchaseOrder from './components/generate-purchase-order';
import type { Product, StockMovement, PurchaseOrder, PurchaseOrderItem } from './types';
import React, { useState, useEffect, useCallback } from 'react';
import { CurrentDate } from '@/components/current-date';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const PRODUCTS_STORAGE_KEY = 'inventory_products';
const STOCK_MOVEMENTS_STORAGE_KEY = 'inventory_stock_movements';
const PURCHASE_ORDERS_STORAGE_KEY = 'inventory_purchase_orders';

const initialProducts: Product[] = [
  { id: 'prod_1', name: 'Détergent Multi-Surfaces', reference: 'DMS001', quantity: 50 },
  { id: 'prod_2', name: 'Lingettes Désinfectantes Pro', reference: 'LDP002', quantity: 100 },
  { id: 'prod_3', name: 'Sacs Poubelle Renforcés 50L', reference: 'SPR050', quantity: 200 },
  { id: 'prod_4', name: 'Liquide Vaisselle Écologique', reference: 'LVE004', quantity: 30 },
];

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient) {
      try {
        const storedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
        if (storedProducts) {
          setProducts(JSON.parse(storedProducts));
        } else {
          setProducts(initialProducts); 
        }

        const storedMovements = localStorage.getItem(STOCK_MOVEMENTS_STORAGE_KEY);
        if (storedMovements) setStockMovements(JSON.parse(storedMovements).map((m: StockMovement) => ({...m, date: new Date(m.date)})));
        
        const storedOrders = localStorage.getItem(PURCHASE_ORDERS_STORAGE_KEY);
        if (storedOrders) setPurchaseOrders(JSON.parse(storedOrders).map((o: PurchaseOrder) => ({...o, date: new Date(o.date), status: o.status || 'pending'})));

      } catch (e) {
        console.error("Error loading data from localStorage", e);
        localStorage.removeItem(PRODUCTS_STORAGE_KEY);
        localStorage.removeItem(STOCK_MOVEMENTS_STORAGE_KEY);
        localStorage.removeItem(PURCHASE_ORDERS_STORAGE_KEY);
        setProducts(initialProducts); 
        toast({ title: "Erreur de chargement des données d'inventaire", variant: "destructive" });
      }
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    }
  }, [products, isClient]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(stockMovements));
    }
  }, [stockMovements, isClient]);
  
  useEffect(() => {
    if (isClient) {
      localStorage.setItem(PURCHASE_ORDERS_STORAGE_KEY, JSON.stringify(purchaseOrders));
    }
  }, [purchaseOrders, isClient]);


  const addProduct = useCallback((product: Omit<Product, 'id'>) => {
    setProducts(prev => [...prev, { ...product, id: `prod_${Date.now()}` }].sort((a, b) => a.name.localeCompare(b.name)));
    toast({ title: "Produit ajouté", description: `${product.name} a été ajouté avec succès.` });
  }, [toast]);

  const updateProduct = useCallback((updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p).sort((a, b) => a.name.localeCompare(b.name)));
    toast({ title: "Produit modifié", description: `${updatedProduct.name} a été mis à jour.` });
  }, [toast]);
  
  const deleteProduct = useCallback((productId: string) => {
    const productName = products.find(p => p.id === productId)?.name || "Le produit";
    setProducts(prev => prev.filter(p => p.id !== productId));
    toast({ title: "Produit supprimé", description: `${productName} a été supprimé.`, variant: "destructive" });
  }, [products, toast]);

  const addStockMovement = useCallback((movement: Omit<StockMovement, 'id' | 'date' | 'productName'>) => {
    const product = products.find(p => p.id === movement.productId);
    if (!product) {
      toast({ title: "Erreur", description: "Produit non trouvé pour le mouvement de stock.", variant: "destructive" });
      return;
    }

    let newQuantity = product.quantity;
    if (movement.type === 'entry') {
      newQuantity += movement.quantity;
    } else {
      if (product.quantity < movement.quantity) {
        toast({ title: "Stock Insuffisant", description: `Impossible de sortir ${movement.quantity} de ${product.name}. Stock actuel: ${product.quantity}.`, variant: "destructive" });
        return;
      }
      newQuantity -= movement.quantity;
    }
    
    setProducts(prev => prev.map(p => p.id === movement.productId ? { ...p, quantity: newQuantity } : p).sort((a, b) => a.name.localeCompare(b.name)));
    setStockMovements(prev => [
        { ...movement, id: `sm_${Date.now()}`, date: new Date(), productName: product.name },
         ...prev
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    toast({ title: "Mouvement de stock enregistré", description: `${movement.quantity} ${product.name} (${movement.type === 'entry' ? 'entrée' : 'sortie'}).` });
  }, [products, toast]);

  const handleDeleteAllStockMovements = useCallback(() => {
    setStockMovements([]);
    toast({ title: "Historique des Mouvements Supprimé", description: "Tous les mouvements de stock ont été effacés.", variant: "destructive" });
  }, [toast]);

  const addPurchaseOrder = useCallback((orderItems: PurchaseOrderItem[]) => {
    const newOrder: PurchaseOrder = {
      id: `po_${Date.now()}`,
      date: new Date(),
      orderNumber: `BC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-4)}`,
      items: orderItems.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          ...item,
          productName: product?.name || 'Produit Inconnu',
          reference: product?.reference || 'N/A'
        };
      }),
      status: 'pending',
    };
    setPurchaseOrders(prev => [newOrder, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    toast({ title: "Bon de commande créé", description: `Le bon de commande ${newOrder.orderNumber} a été généré.` });
  }, [products, toast]);

  const deletePurchaseOrder = useCallback((orderId: string) => {
    const orderNumber = purchaseOrders.find(po => po.id === orderId)?.orderNumber || "Le bon de commande";
    setPurchaseOrders(prev => prev.filter(po => po.id !== orderId));
    toast({ title: "Bon de Commande Supprimé", description: `Le bon de commande N° ${orderNumber} a été supprimé.`, variant: "destructive" });
  }, [purchaseOrders, toast]);

  const handleReceivePurchaseOrder = useCallback((orderId: string) => {
    const order = purchaseOrders.find(po => po.id === orderId);
    if (!order || order.status === 'received') {
      toast({ title: "Erreur", description: "Bon de commande non trouvé ou déjà reçu.", variant: "destructive"});
      return;
    }

    // Update product quantities
    let updatedProducts = [...products];
    order.items.forEach(item => {
      updatedProducts = updatedProducts.map(p => {
        if (p.id === item.productId) {
          return { ...p, quantity: p.quantity + item.quantity };
        }
        return p;
      });
    });
    setProducts(updatedProducts.sort((a,b) => a.name.localeCompare(b.name)));

    // Update PO status
    setPurchaseOrders(prev => 
      prev.map(po => 
        po.id === orderId ? { ...po, status: 'received', receivedDate: new Date().toISOString() } : po
      ).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
    toast({ title: "Bon de Commande Reçu", description: `Le bon de commande ${order.orderNumber} a été marqué comme reçu et les stocks mis à jour.`});
  }, [purchaseOrders, products, toast]);


  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Chargement de la gestion des stocks...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
           <PackagePlusIcon className="w-10 h-10 text-accent" />
           <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
             Gestion des Stocks Entretien
           </h1>
        </div>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6 bg-card p-1 rounded-lg">
          <TabsTrigger value="products" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <PackagePlusIcon className="mr-1 sm:mr-2 h-4 w-4" /> Gestion Produits
          </TabsTrigger>
          <TabsTrigger value="movements" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <HistoryIcon className="mr-1 sm:mr-2 h-4 w-4" /> Mouvements Stock
          </TabsTrigger>
          <TabsTrigger value="inventory" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ListOrderedIcon className="mr-1 sm:mr-2 h-4 w-4" /> Inventaire
          </TabsTrigger>
          <TabsTrigger value="purchase-orders" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ShoppingCartIcon className="mr-1 sm:mr-2 h-4 w-4" /> Bons de Commande
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ManageProducts
            products={products}
            onAddProduct={addProduct}
            onUpdateProduct={updateProduct}
            onDeleteProduct={deleteProduct}
          />
        </TabsContent>
        <TabsContent value="movements">
          <ManageStockMovements
            products={products}
            stockMovements={stockMovements}
            onAddStockMovement={addStockMovement}
            onDeleteAllStockMovements={handleDeleteAllStockMovements}
          />
        </TabsContent>
        <TabsContent value="inventory">
          <GenerateInventory products={products} />
        </TabsContent>
        <TabsContent value="purchase-orders">
          <GeneratePurchaseOrder 
            products={products} 
            purchaseOrders={purchaseOrders}
            onAddPurchaseOrder={addPurchaseOrder}
            onDeletePurchaseOrder={deletePurchaseOrder} 
            onReceivePurchaseOrder={handleReceivePurchaseOrder}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
