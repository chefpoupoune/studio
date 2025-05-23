
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';

const PRODUCTS_STORAGE_KEY = 'inventory_products';
const STOCK_MOVEMENTS_STORAGE_KEY = 'inventory_stock_movements';
const PURCHASE_ORDERS_STORAGE_KEY = 'inventory_purchase_orders';

const initialProducts: Product[] = [
  { id: 'prod_1', name: 'Détergent Multi-Surfaces', reference: 'DMS001', quantity: 50 },
  { id: 'prod_2', name: 'Lingettes Désinfectantes Pro', reference: 'LDP002', quantity: 100 },
  { id: 'prod_3', name: 'Sacs Poubelle Renforcés 50L', reference: 'SPR050', quantity: 200 },
  { id: 'prod_4', name: 'Liquide Vaisselle Écologique', reference: 'LVE004', quantity: 30 },
];

interface InventoryTab {
  value: string;
  label: string;
  Icon: React.ElementType;
  component: React.ReactNode;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // New state
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const inventoryTabsConfig: InventoryTab[] = [
    { value: "products", label: "Gestion Produits", Icon: PackagePlusIcon, component: <ManageProducts products={products} onAddProduct={addProduct} onUpdateProduct={updateProduct} onDeleteProduct={deleteProduct} /> },
    { value: "movements", label: "Mouvements Stock", Icon: HistoryIcon, component: <ManageStockMovements products={products} stockMovements={stockMovements} onAddStockMovement={addStockMovement} onDeleteAllStockMovements={handleDeleteAllStockMovements} /> },
    { value: "inventory", label: "Inventaire", Icon: ListOrderedIcon, component: <GenerateInventory products={products} /> },
    { value: "purchase-orders", label: "Bons de Commande", Icon: ShoppingCartIcon, component: <GeneratePurchaseOrder products={products} purchaseOrders={purchaseOrders} onAddPurchaseOrder={addPurchaseOrder} onDeletePurchaseOrder={deletePurchaseOrder} onReceivePurchaseOrder={handleReceivePurchaseOrder}/> },
  ];
  const [activeTab, setActiveTab] = useState(inventoryTabsConfig[0].value);


  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient) {
      console.log("InventoryPage: Attempting to load data from localStorage.");
      try {
        const storedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
        if (storedProducts) {
          console.log("InventoryPage: Found stored products.");
          setProducts(JSON.parse(storedProducts));
        } else {
          console.log("InventoryPage: No stored products found, using initialProducts.");
          setProducts(initialProducts); 
        }

        const storedMovements = localStorage.getItem(STOCK_MOVEMENTS_STORAGE_KEY);
        if (storedMovements) {
          console.log("InventoryPage: Found stored movements.");
          setStockMovements(JSON.parse(storedMovements).map((m: StockMovement) => ({...m, date: new Date(m.date)})));
        } else {
          console.log("InventoryPage: No stored movements found, defaulting to empty array.");
          setStockMovements([]);
        }
        
        const storedOrders = localStorage.getItem(PURCHASE_ORDERS_STORAGE_KEY);
        if (storedOrders) {
          console.log("InventoryPage: Found stored orders.");
          setPurchaseOrders(JSON.parse(storedOrders).map((o: PurchaseOrder) => ({...o, date: new Date(o.date), status: o.status || 'pending'})));
        } else {
          console.log("InventoryPage: No stored orders found, defaulting to empty array.");
          setPurchaseOrders([]);
        }

      } catch (e) {
        console.error("InventoryPage: Error loading data from localStorage", e);
        localStorage.removeItem(PRODUCTS_STORAGE_KEY);
        localStorage.removeItem(STOCK_MOVEMENTS_STORAGE_KEY);
        localStorage.removeItem(PURCHASE_ORDERS_STORAGE_KEY);
        setProducts(initialProducts); 
        setStockMovements([]);
        setPurchaseOrders([]);
        toast({ title: "Erreur de chargement des données d'inventaire", description: "Les données ont été réinitialisées aux valeurs par défaut.", variant: "destructive" });
      } finally {
        setDataLoaded(true);
        console.log("InventoryPage: Data loading complete, dataLoaded set to true.");
      }
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient && dataLoaded) {
      console.log("InventoryPage: Saving products to localStorage", products);
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    }
  }, [products, isClient, dataLoaded]);

  useEffect(() => {
    if (isClient && dataLoaded) {
      console.log("InventoryPage: Saving stock movements to localStorage", stockMovements);
      localStorage.setItem(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(stockMovements));
    }
  }, [stockMovements, isClient, dataLoaded]);
  
  useEffect(() => {
    if (isClient && dataLoaded) {
      console.log("InventoryPage: Saving purchase orders to localStorage", purchaseOrders);
      localStorage.setItem(PURCHASE_ORDERS_STORAGE_KEY, JSON.stringify(purchaseOrders));
    }
  }, [purchaseOrders, isClient, dataLoaded]);


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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {isMobile ? (
          <div className="mb-4">
            <Label htmlFor="mobile-inventory-nav-select" className="text-sm font-medium">Naviguer vers :</Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger id="mobile-inventory-nav-select" className="w-full mt-1">
                <SelectValue placeholder="Choisir une section..." />
              </SelectTrigger>
              <SelectContent>
                {inventoryTabsConfig.map(tab => (
                  <SelectItem key={tab.value} value={tab.value} className="text-sm">
                    <span className="flex items-center">
                      <tab.Icon className="mr-2 h-4 w-4" />
                      {tab.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-4 mb-6 bg-card p-1 rounded-lg">
            {inventoryTabsConfig.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1">
                <tab.Icon className="mr-1 sm:mr-2 h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        
        {inventoryTabsConfig.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.component}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

