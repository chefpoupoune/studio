
"use client";

import Link from 'next/link';
import { PackagePlusIcon, ListOrderedIcon, ShoppingCartIcon, HistoryIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManageProducts from './components/manage-products';
import ManageStockMovements from './components/manage-stock-movements';
import GenerateInventory from './components/generate-inventory';
import GeneratePurchaseOrder from './components/generate-purchase-order';
import type { Product, StockMovement, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from './types';
import React, { useState, useEffect, useCallback } from 'react';
import { CurrentDate } from '@/components/current-date';
import { useToast } from '@/hooks/use-toast';
import { format, Timestamp } from 'date-fns'; // Timestamp for Firestore
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { firestore } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy,
  writeBatch
} from 'firebase/firestore';

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
  
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingMovements, setIsLoadingMovements] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch Products from Firestore
  const fetchProducts = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingProducts(true);
    try {
      const productsCollectionRef = collection(firestore, 'inventoryProducts');
      const q = query(productsCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const productsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsList);
      console.log("InventoryPage: Products fetched from Firestore:", productsList.length);
    } catch (error) {
      console.error("InventoryPage: Error fetching products from Firestore:", error);
      toast({ title: "Erreur de chargement des produits", variant: "destructive" });
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [isClient, toast]);

  // Fetch Stock Movements from Firestore
  const fetchStockMovements = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingMovements(true);
    try {
      const movementsCollectionRef = collection(firestore, 'inventoryStockMovements');
      const q = query(movementsCollectionRef, orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      const movementsList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: (data.date as any).toDate ? (data.date as any).toDate() : new Date(data.date) // Handle Firestore Timestamp
        } as StockMovement;
      });
      setStockMovements(movementsList);
      console.log("InventoryPage: Stock movements fetched from Firestore:", movementsList.length);
    } catch (error) {
      console.error("InventoryPage: Error fetching stock movements from Firestore:", error);
      toast({ title: "Erreur de chargement des mouvements de stock", variant: "destructive" });
      setStockMovements([]);
    } finally {
      setIsLoadingMovements(false);
    }
  }, [isClient, toast]);

  // Fetch Purchase Orders from Firestore
  const fetchPurchaseOrders = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingOrders(true);
    try {
      const ordersCollectionRef = collection(firestore, 'inventoryPurchaseOrders');
      const q = query(ordersCollectionRef, orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      const ordersList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: (data.date as any).toDate ? (data.date as any).toDate() : new Date(data.date), // Handle Firestore Timestamp
          status: data.status || 'pending' 
        } as PurchaseOrder;
      });
      setPurchaseOrders(ordersList);
      console.log("InventoryPage: Purchase orders fetched from Firestore:", ordersList.length);
    } catch (error) {
      console.error("InventoryPage: Error fetching purchase orders from Firestore:", error);
      toast({ title: "Erreur de chargement des bons de commande", variant: "destructive" });
      setPurchaseOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [isClient, toast]);
  
  useEffect(() => {
    if (isClient) {
      fetchProducts();
      fetchStockMovements();
      fetchPurchaseOrders();
    }
  }, [isClient, fetchProducts, fetchStockMovements, fetchPurchaseOrders]);

  const addProduct = useCallback(async (productData: Omit<Product, 'id'>) => {
    try {
      const docRef = await addDoc(collection(firestore, "inventoryProducts"), productData);
      // No need to sort client-side if Firestore query already sorts or if order is not critical after add
      // For consistency, re-fetch or add optimistically with correct sorting logic
      fetchProducts(); // Re-fetch to get sorted list with new ID
      toast({ title: "Produit ajouté", description: `${productData.name} a été ajouté à Firestore.` });
    } catch (e) {
      console.error("Error adding product to Firestore: ", e);
      toast({ title: "Erreur d'ajout", variant: "destructive" });
    }
  }, [toast, fetchProducts]);

  const updateProduct = useCallback(async (updatedProduct: Product) => {
    try {
      const productDocRef = doc(firestore, "inventoryProducts", updatedProduct.id);
      const { id, ...dataToSave } = updatedProduct;
      await setDoc(productDocRef, dataToSave);
      fetchProducts(); // Re-fetch
      toast({ title: "Produit modifié", description: `${updatedProduct.name} a été mis à jour dans Firestore.` });
    } catch (e) {
      console.error("Error updating product in Firestore: ", e);
      toast({ title: "Erreur de modification", variant: "destructive" });
    }
  }, [toast, fetchProducts]);
  
  const deleteProduct = useCallback(async (productId: string) => {
    const productName = products.find(p => p.id === productId)?.name || "Le produit";
    try {
      await deleteDoc(doc(firestore, "inventoryProducts", productId));
      fetchProducts(); // Re-fetch
      toast({ title: "Produit supprimé", description: `${productName} a été supprimé de Firestore.`, variant: "destructive" });
    } catch (e) {
      console.error("Error deleting product from Firestore: ", e);
      toast({ title: "Erreur de suppression", variant: "destructive" });
    }
  }, [products, toast, fetchProducts]);

  const addStockMovement = useCallback(async (movementData: Omit<StockMovement, 'id' | 'date' | 'productName'>) => {
    const product = products.find(p => p.id === movementData.productId);
    if (!product) {
      toast({ title: "Erreur", description: "Produit non trouvé.", variant: "destructive" });
      return;
    }

    let newQuantity = product.quantity;
    if (movementData.type === 'entry') {
      newQuantity += movementData.quantity;
    } else {
      if (product.quantity < movementData.quantity) {
        toast({ title: "Stock Insuffisant", variant: "destructive" });
        return;
      }
      newQuantity -= movementData.quantity;
    }
    
    const newMovement: Omit<StockMovement, 'id'> = { 
      ...movementData, 
      date: new Date(), // Will be converted to Firestore Timestamp
      productName: product.name 
    };

    const batch = writeBatch(firestore);
    const productDocRef = doc(firestore, "inventoryProducts", product.id);
    batch.update(productDocRef, { quantity: newQuantity });
    const movementDocRef = doc(collection(firestore, "inventoryStockMovements")); // Auto-generate ID
    batch.set(movementDocRef, newMovement);

    try {
      await batch.commit();
      fetchProducts();
      fetchStockMovements();
      toast({ title: "Mouvement de stock enregistré", description: `${movementData.quantity} ${product.name} (${movementData.type === 'entry' ? 'entrée' : 'sortie'}) enregistré dans Firestore.` });
    } catch (e) {
      console.error("Error adding stock movement and updating product in Firestore: ", e);
      toast({ title: "Erreur lors de l'enregistrement du mouvement", variant: "destructive" });
    }
  }, [products, toast, fetchProducts, fetchStockMovements]);

  const handleDeleteAllStockMovements = useCallback(async () => {
    try {
      const movementsCollectionRef = collection(firestore, 'inventoryStockMovements');
      const querySnapshot = await getDocs(movementsCollectionRef);
      const batch = writeBatch(firestore);
      querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      fetchStockMovements(); // Re-fetch to update UI
      toast({ title: "Historique des Mouvements Supprimé", description: "Tous les mouvements de stock ont été effacés de Firestore.", variant: "destructive" });
    } catch (e) {
      console.error("Error deleting all stock movements from Firestore:", e);
      toast({ title: "Erreur de suppression de l'historique", variant: "destructive"});
    }
  }, [toast, fetchStockMovements]);

  const addPurchaseOrder = useCallback(async (orderItems: PurchaseOrderItem[]) => {
    const productDetails = orderItems.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        ...item,
        productName: product?.name || 'Produit Inconnu',
        reference: product?.reference || 'N/A'
      };
    });
    const newOrder: Omit<PurchaseOrder, 'id'> = {
      date: new Date(), // Will be converted to Firestore Timestamp
      orderNumber: `BC-${format(new Date(), "yyyyMMdd")}-${Date.now().toString().slice(-4)}`,
      items: productDetails,
      status: 'pending' as PurchaseOrderStatus,
    };
    try {
      await addDoc(collection(firestore, "inventoryPurchaseOrders"), newOrder);
      fetchPurchaseOrders(); // Re-fetch
      toast({ title: "Bon de commande créé", description: `Le bon de commande ${newOrder.orderNumber} a été généré dans Firestore.` });
    } catch (e) {
      console.error("Error adding purchase order to Firestore: ", e);
      toast({ title: "Erreur de création du bon de commande", variant: "destructive" });
    }
  }, [products, toast, fetchPurchaseOrders]);

  const deletePurchaseOrder = useCallback(async (orderId: string) => {
    const orderNumber = purchaseOrders.find(po => po.id === orderId)?.orderNumber || "Le bon de commande";
    try {
      await deleteDoc(doc(firestore, "inventoryPurchaseOrders", orderId));
      fetchPurchaseOrders(); // Re-fetch
      toast({ title: "Bon de Commande Supprimé", description: `Le bon de commande N° ${orderNumber} a été supprimé de Firestore.`, variant: "destructive" });
    } catch (e) {
      console.error("Error deleting purchase order from Firestore: ", e);
      toast({ title: "Erreur de suppression", variant: "destructive" });
    }
  }, [purchaseOrders, toast, fetchPurchaseOrders]);

  const handleReceivePurchaseOrder = useCallback(async (orderId: string) => {
    const order = purchaseOrders.find(po => po.id === orderId);
    if (!order || order.status === 'received') {
      toast({ title: "Erreur", description: "Bon de commande non trouvé ou déjà reçu.", variant: "destructive"});
      return;
    }

    const batch = writeBatch(firestore);
    // Update product quantities
    order.items.forEach(item => {
      const productDocRef = doc(firestore, "inventoryProducts", item.productId);
      const product = products.find(p => p.id === item.productId);
      if (product) {
        batch.update(productDocRef, { quantity: product.quantity + item.quantity });
      }
    });
    // Update PO status
    const orderDocRef = doc(firestore, "inventoryPurchaseOrders", orderId);
    batch.update(orderDocRef, { status: 'received', receivedDate: new Date().toISOString() }); // Store as ISO string

    try {
      await batch.commit();
      fetchProducts();
      fetchPurchaseOrders();
      toast({ title: "Bon de Commande Reçu", description: `Le bon de commande ${order.orderNumber} a été marqué comme reçu et les stocks mis à jour dans Firestore.`});
    } catch (e) {
      console.error("Error receiving purchase order in Firestore: ", e);
      toast({ title: "Erreur lors de la réception", variant: "destructive" });
    }
  }, [purchaseOrders, products, toast, fetchProducts, fetchPurchaseOrders]);

  const inventoryTabsConfig: InventoryTab[] = [
    { value: "products", label: "Gestion Produits", Icon: PackagePlusIcon, component: <ManageProducts products={products} onAddProduct={addProduct} onUpdateProduct={updateProduct} onDeleteProduct={deleteProduct} /> },
    { value: "movements", label: "Mouvements Stock", Icon: HistoryIcon, component: <ManageStockMovements products={products} stockMovements={stockMovements} onAddStockMovement={addStockMovement} onDeleteAllStockMovements={handleDeleteAllStockMovements} /> },
    { value: "inventory", label: "Inventaire", Icon: ListOrderedIcon, component: <GenerateInventory products={products} /> },
    { value: "purchase-orders", label: "Bons de Commande", Icon: ShoppingCartIcon, component: <GeneratePurchaseOrder products={products} purchaseOrders={purchaseOrders} onAddPurchaseOrder={addPurchaseOrder} onDeletePurchaseOrder={deletePurchaseOrder} onReceivePurchaseOrder={handleReceivePurchaseOrder}/> },
  ];
  const [activeTab, setActiveTab] = useState(inventoryTabsConfig[0].value);

  if (!isClient || isLoadingProducts || isLoadingMovements || isLoadingOrders) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground ml-3">Chargement de la gestion des stocks...</p>
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
    

    