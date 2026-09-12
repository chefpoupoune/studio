
"use client";

import { PackagePlusIcon, ListOrderedIcon, ShoppingCartIcon, HistoryIcon, Loader2, FileUp, Truck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManageProducts from './components/manage-products';
import ManageStockMovements from './components/manage-stock-movements';
import GenerateInventory from './components/generate-inventory';
import GeneratePurchaseOrder from './components/generate-purchase-order';
import ExcelActionsPage from './components/excel-actions-page';
import ManageSuppliers from './components/manage-suppliers'; // Import the new component
import type { Product, StockMovement, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Supplier } from './types'; // Import Supplier type
import React, { useState, useEffect, useCallback } from 'react';
import { CurrentDate } from '@/components/current-date';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import useIsMobile from '@/hooks/use-mobile';
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
  writeBatch,
  Timestamp,
  runTransaction,
  where
} from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InventoryTab {
  value: string;
  label: string;
  Icon: React.ElementType;
  component: React.ReactNode;
}

interface StockUpdate {
  reference: string;
  quantityToAdd: number;
  productName?: string;
}

interface NotFoundInfo {
    reference: string;
    productName?: string;
}

interface ImportSummary {
  updatedCount: number;
  notFoundReferences: NotFoundInfo[];
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]); // Add state for suppliers
  
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingMovements, setIsLoadingMovements] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true); // Add loading state for suppliers
  
  const [isClient, setIsClient] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Fetch Suppliers Function
  const fetchSuppliers = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingSuppliers(true);
    try {
      const suppliersCollectionRef = collection(firestore, 'inventorySuppliers');
      const q = query(suppliersCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const suppliersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setSuppliers(suppliersList);
    } catch (error) {
      console.error("Error fetching suppliers from Firestore:", error);
      toast({ title: "Erreur de chargement des fournisseurs", variant: "destructive" });
      setSuppliers([]);
    } finally {
      setIsLoadingSuppliers(false);
    }
  }, [isClient, toast]);

  const fetchProducts = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingProducts(true);
    try {
      const productsCollectionRef = collection(firestore, 'inventoryProducts');
      const q = query(productsCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const productsList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // This is a simple migration logic. A more robust solution might be needed.
        if (data.references && !data.supplierReferences) {
            data.supplierReferences = data.references.map((ref: string) => ({ supplierId: 'default', reference: ref }));
        }
        if (!data.subNames) {
            data.subNames = [];
        }
        return { id: doc.id, ...data } as Product;
      });
      setProducts(productsList as Product[]);
    } catch (error) {
      console.error("Error fetching products from Firestore:", error);
      toast({ title: "Erreur de chargement des produits", variant: "destructive" });
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [isClient, toast]);

  const fetchStockMovements = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingMovements(true);
    try {
      const movementsCollectionRef = collection(firestore, 'inventoryStockMovements');
      const q = query(movementsCollectionRef, orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      const movementsList = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return { 
          id: docSnap.id, 
          ...data,
          date: (data.date as Timestamp).toDate()
        } as StockMovement;
      });
      setStockMovements(movementsList);
    } catch (error) {
      console.error("Error fetching stock movements from Firestore:", error);
      toast({ title: "Erreur de chargement des mouvements", variant: "destructive" });
      setStockMovements([]);
    } finally {
      setIsLoadingMovements(false);
    }
  }, [isClient, toast]);

  const fetchPurchaseOrders = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingOrders(true);
    try {
      const ordersCollectionRef = collection(firestore, 'inventoryPurchaseOrders');
      const q = query(ordersCollectionRef, orderBy("date", "desc"));
      const querySnapshot = await getDocs(q);
      const ordersList = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return { 
          id: docSnap.id, 
          ...data,
          date: (data.date as Timestamp).toDate(),
          status: data.status || 'pending',
          receivedDate: data.receivedDate ? (data.receivedDate as Timestamp).toDate().toISOString() : undefined,
        } as PurchaseOrder;
      });
      setPurchaseOrders(ordersList);
    } catch (error) {
      console.error("Error fetching purchase orders from Firestore:", error);
      toast({ title: "Erreur de chargement des commandes", variant: "destructive" });
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
      fetchSuppliers(); // Fetch suppliers on client mount

      const handleStockUpdate = () => {
        fetchProducts();
        fetchStockMovements();
      };

      window.addEventListener('stockUpdated', handleStockUpdate);

      return () => {
        window.removeEventListener('stockUpdated', handleStockUpdate);
      };
    }
  }, [isClient, fetchProducts, fetchStockMovements, fetchPurchaseOrders, fetchSuppliers]);

  // CRUD functions for Suppliers
  const addSupplier = useCallback(async (supplierData: Omit<Supplier, 'id'>) => {
    try {
      await addDoc(collection(firestore, "inventorySuppliers"), supplierData);
      fetchSuppliers();
      toast({ title: "Fournisseur ajouté", description: `${supplierData.name} a été ajouté.` });
    } catch (e) {
      console.error("Error adding supplier: ", e);
      toast({ title: "Erreur d'ajout", variant: "destructive" });
    }
  }, [toast, fetchSuppliers]);

  const updateSupplier = useCallback(async (updatedSupplier: Supplier) => {
    try {
      const supplierDocRef = doc(firestore, "inventorySuppliers", updatedSupplier.id);
      const { id, ...dataToSave } = updatedSupplier;
      await setDoc(supplierDocRef, dataToSave, { merge: true });
      fetchSuppliers();
      toast({ title: "Fournisseur modifié", description: `${updatedSupplier.name} a été mis à jour.` });
    } catch (e) {
      console.error("Error updating supplier: ", e);
      toast({ title: "Erreur de modification", variant: "destructive" });
    }
  }, [toast, fetchSuppliers]);

  const deleteSupplier = useCallback(async (supplierId: string) => {
    const supplierName = suppliers.find(s => s.id === supplierId)?.name || "Le fournisseur";
    try {
      await deleteDoc(doc(firestore, "inventorySuppliers", supplierId));
      fetchSuppliers();
      toast({ title: "Fournisseur supprimé", description: `${supplierName} a été supprimé.`, variant: "destructive" });
    } catch (e) {
      console.error("Error deleting supplier: ", e);
      toast({ title: "Erreur de suppression", variant: "destructive" });
    }
  }, [suppliers, toast, fetchSuppliers]);


  useEffect(() => {
    if (products.length > 0 && purchaseOrders.length > 0) {
        const pendingOrders = purchaseOrders.filter(po => po.status === 'pending');
        let ordersToUpdate: PurchaseOrder[] = [];

        pendingOrders.forEach(order => {
            let hasChanged = false;
            const updatedItems = order.items.map(item => {
                if (item.isUnlinked && item.reference) {
                    const foundProduct = products.find(p => p.supplierReferences?.some(sr => sr.reference === item.reference));
                    if (foundProduct) {
                        hasChanged = true;
                        return { ...item, productId: foundProduct.id, productName: foundProduct.name, isUnlinked: false };
                    }
                }
                return item;
            });

            if (hasChanged) {
                ordersToUpdate.push({ ...order, items: updatedItems });
            }
        });

        if (ordersToUpdate.length > 0) {
            const batch = writeBatch(firestore);
            ordersToUpdate.forEach(order => {
                const orderRef = doc(firestore, "inventoryPurchaseOrders", order.id);
                const { id, ...orderData } = order;

                const cleanOrderData = { ...orderData };
                if (cleanOrderData.receivedDate === undefined) {
                    delete (cleanOrderData as Partial<PurchaseOrder>).receivedDate;
                }

                batch.update(orderRef, cleanOrderData);
            });

            batch.commit().then(() => {
                toast({ title: "Synchronisation réussie", description: "Certains articles ont été liés à votre stock." });
                fetchPurchaseOrders();
            }).catch(e => {
                console.error("Error syncing purchase orders: ", e);
                toast({ title: "Erreur de synchronisation", variant: "destructive" });
            });
        }
    }
  }, [products, purchaseOrders, toast, fetchPurchaseOrders]);

  const addProduct = useCallback(async (productData: Omit<Product, 'id'>) => {
    try {
      const dataToSave = { ...productData };
      if (dataToSave.family === undefined) {
        delete dataToSave.family;
      }
      await addDoc(collection(firestore, "inventoryProducts"), dataToSave);
      fetchProducts(); 
      toast({ title: "Produit ajouté", description: `${productData.name} a été ajouté.` });
    } catch (e) {
      console.error("Error adding product: ", e);
      toast({ title: "Erreur d'ajout", variant: "destructive" });
    }
  }, [toast, fetchProducts]);

  const addMultipleProducts = useCallback(async (productsData: Omit<Product, 'id'>[]) => {
    const batch = writeBatch(firestore);
    const productsCollectionRef = collection(firestore, "inventoryProducts");

    productsData.forEach(productData => {
      const docRef = doc(productsCollectionRef);
      const dataToSave = { ...productData };
      if (dataToSave.family === undefined) {
        delete dataToSave.family;
      }
      batch.set(docRef, dataToSave);
    });

    try {
      await batch.commit();
      fetchProducts();
      toast({ title: "Produits importés", description: `${productsData.length} produits ont été ajoutés.` });
    } catch (e) {
      console.error("Error adding multiple products: ", e);
      toast({ title: "Erreur d'importation", variant: "destructive" });
    }
  }, [toast, fetchProducts]);

  const updateProduct = useCallback(async (updatedProduct: Product) => {
    try {
      const productDocRef = doc(firestore, "inventoryProducts", updatedProduct.id);
      const { id, ...dataToSave } = updatedProduct;
      if (dataToSave.family === undefined) {
        delete (dataToSave as Partial<Product>).family;
      }
      await setDoc(productDocRef, dataToSave, { merge: true });
      fetchProducts(); 
      toast({ title: "Produit modifié", description: `${updatedProduct.name} a été mis à jour.` });
    } catch (e) {
      console.error("Error updating product: ", e);
      toast({ title: "Erreur de modification", variant: "destructive" });
    }
  }, [toast, fetchProducts]);
  
  const deleteProduct = useCallback(async (productId: string) => {
    const productName = products.find(p => p.id === productId)?.name || "Le produit";
    try {
      await deleteDoc(doc(firestore, "inventoryProducts", productId));
      fetchProducts(); 
      toast({ title: "Produit supprimé", description: `${productName} a été supprimé.`, variant: "destructive" });
    } catch (e) {
      console.error("Error deleting product: ", e);
      toast({ title: "Erreur de suppression", variant: "destructive" });
    }
  }, [products, toast, fetchProducts]);

  const handleUpdateAllProductsThreshold = useCallback(async () => {
    const batch = writeBatch(firestore);
    products.forEach(product => {
        const productRef = doc(firestore, "inventoryProducts", product.id);
        batch.update(productRef, { alertThreshold: 2 });
    });
    try {
        await batch.commit();
        fetchProducts();
        toast({ title: "Mise à jour réussie", description: "Le seuil d'alerte de tous les produits a été défini à 2." });
    } catch (e) {
        console.error("Error updating all products threshold: ", e);
        toast({ title: "Erreur de mise à jour", variant: "destructive" });
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
    
    const newMovementFirestore: Omit<StockMovement, 'id'> & {date: Timestamp} = { 
      ...movementData, 
      date: Timestamp.fromDate(new Date()), 
      productName: product.name 
    };

    const batch = writeBatch(firestore);
    const productDocRef = doc(firestore, "inventoryProducts", product.id);
    batch.update(productDocRef, { quantity: newQuantity });
    const movementDocRef = doc(collection(firestore, "inventoryStockMovements")); 
    batch.set(movementDocRef, newMovementFirestore);

    try {
      await batch.commit();
      fetchProducts();
      fetchStockMovements();
      toast({ title: "Mouvement enregistré", description: `${movementData.quantity} ${product.name} (${movementData.type === 'entry' ? 'entrée' : 'sortie'}).` });
    } catch (e) {
      console.error("Error adding stock movement: ", e);
      toast({ title: "Erreur enregistrement mouvement", variant: "destructive" });
    }
  }, [products, toast, fetchProducts, fetchStockMovements]);


const handleDeleteMovement = useCallback(async (movementId: string) => {
    try {
        await runTransaction(firestore, async (transaction) => {
            const movementDocRef = doc(firestore, "inventoryStockMovements", movementId);
            const movementDoc = await transaction.get(movementDocRef);

            if (!movementDoc.exists()) {
                throw new Error("Le mouvement n'existe pas.");
            }

            const movement = movementDoc.data() as StockMovement;
            const productDocRef = doc(firestore, "inventoryProducts", movement.productId);
            const productDoc = await transaction.get(productDocRef);

            if (!productDoc.exists()) {
                // If product doesn't exist, just delete the movement
                transaction.delete(movementDocRef);
                return;
            }

            const product = productDoc.data() as Product;
            let newQuantity = product.quantity;

            if (movement.type === 'entry') {
                // Reversing an entry means subtracting quantity
                newQuantity -= movement.quantity;
                if (newQuantity < 0) {
                    throw new Error(`La suppression de cette entrée créerait un stock négatif pour ${product.name}.`);
                }
            } else { // type === 'exit'
                // Reversing an exit means adding quantity back
                newQuantity += movement.quantity;
            }

            transaction.update(productDocRef, { quantity: newQuantity });
            transaction.delete(movementDocRef);
        });

        toast({ title: "Mouvement supprimé", description: "Le mouvement a été supprimé et le stock mis à jour." });
        // Refresh data
        await Promise.all([fetchProducts(), fetchStockMovements()]);
    } catch (error: any) {
        console.error("Erreur lors de la suppression du mouvement: ", error);
        toast({ title: "Erreur de suppression", description: error.message, variant: "destructive" });
    }
}, [toast, fetchProducts, fetchStockMovements]);

const handleDeleteSelectedMovements = useCallback(async (selectedMovements: StockMovement[]) => {
    if (selectedMovements.length === 0) return;

    try {
        await runTransaction(firestore, async (transaction) => {
            const stockAdjustments = new Map<string, number>();

            // First, calculate the net effect on each product's stock
            for (const movement of selectedMovements) {
                const currentAdjustment = stockAdjustments.get(movement.productId) || 0;
                if (movement.type === 'entry') {
                    stockAdjustments.set(movement.productId, currentAdjustment - movement.quantity);
                } else {
                    stockAdjustments.set(movement.productId, currentAdjustment + movement.quantity);
                }
            }

            // Check for potential negative stock and get current product data
            const productDocs = new Map<string, Product>();
            for (const [productId, adjustment] of stockAdjustments.entries()) {
                if (adjustment < 0) { // Only need to check if we are decreasing stock
                    const productDocRef = doc(firestore, "inventoryProducts", productId);
                    const productDoc = await transaction.get(productDocRef);
                    if (productDoc.exists()) {
                        const product = productDoc.data() as Product;
                        productDocs.set(productId, product);
                        if (product.quantity + adjustment < 0) {
                            throw new Error(`La suppression sélectionnée créerait un stock négatif pour ${product.name}.`);
                        }
                    }
                }
            }

            // If all checks pass, apply the changes
            for (const [productId, adjustment] of stockAdjustments.entries()) {
                const productDocRef = doc(firestore, "inventoryProducts", productId);
                const product = productDocs.get(productId);
                // We might not have fetched the product if we are only adding stock
                const currentQuantity = product ? product.quantity : (await transaction.get(productDocRef)).data()?.quantity;
                transaction.update(productDocRef, { quantity: currentQuantity + adjustment });
            }

            // Finally, delete all the selected movements
            for (const movement of selectedMovements) {
                const movementDocRef = doc(firestore, "inventoryStockMovements", movement.id);
                transaction.delete(movementDocRef);
            }
        });

        toast({ title: "Mouvements supprimés", description: `${selectedMovements.length} mouvements ont été supprimés.` });
        await Promise.all([fetchProducts(), fetchStockMovements()]);

    } catch (error: any) {
        console.error("Erreur lors de la suppression des mouvements: ", error);
        toast({ title: "Erreur de suppression", description: error.message, variant: "destructive" });
    }
}, [toast, fetchProducts, fetchStockMovements]);



 const handleUpdateStockFromExcel = useCallback(async (updates: StockUpdate[]) => {
    const batch = writeBatch(firestore);
    const movementsCollectionRef = collection(firestore, "inventoryStockMovements");
    let updatedCount = 0;
    const notFoundReferences: NotFoundInfo[] = [];

    for (const update of updates) {
        const product = products.find(p => p.supplierReferences?.some(sr => sr.reference === update.reference));

        if (product) {
            const productDocRef = doc(firestore, "inventoryProducts", product.id);
            const newQuantity = product.quantity + update.quantityToAdd;
            batch.update(productDocRef, { quantity: newQuantity });

            const movementDocRef = doc(movementsCollectionRef);
            const newMovement: Omit<StockMovement, 'id'> & {date: Timestamp} = {
                productId: product.id,
                productName: product.name,
                type: 'entry',
                quantity: update.quantityToAdd,
                date: Timestamp.fromDate(new Date()),
                notes: `Mise à jour par Excel (Réf: ${update.reference})`
            };
            batch.set(movementDocRef, newMovement);
            updatedCount++;
        } else {
            notFoundReferences.push({ reference: update.reference, productName: update.productName });
        }
    }

    try {
        await batch.commit();
        if (updatedCount > 0) {
            toast({ title: "Mise à jour réussie", description: `${updatedCount} produit(s) mis à jour.` });
            fetchProducts();
            fetchStockMovements();
        }

        if (notFoundReferences.length > 0 || updatedCount > 0) {
             setImportSummary({ updatedCount, notFoundReferences });
        }

    } catch (e) {
        console.error("Error updating stock from Excel: ", e);
        toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
}, [products, toast, fetchProducts, fetchStockMovements]);


  const handleDeleteAllStockMovements = useCallback(async () => {
    try {
      const movementsCollectionRef = collection(firestore, 'inventoryStockMovements');
      const querySnapshot = await getDocs(movementsCollectionRef);
      const batchDelete = writeBatch(firestore);
      querySnapshot.docs.forEach(doc => batchDelete.delete(doc.ref));
      await batchDelete.commit();
      fetchStockMovements(); 
      toast({ title: "Historique Mouvements Supprimé", variant: "destructive" });
    } catch (e) {
      console.error("Error deleting all stock movements:", e);
      toast({ title: "Erreur suppression historique", variant: "destructive"});
    }
  }, [toast, fetchStockMovements]);

  const handleDeleteMonthlyHistory = useCallback(async (year: string, month: string) => {
    try {
        const startDate = new Date(parseInt(year), parseInt(month), 1);
        const endDate = new Date(parseInt(year), parseInt(month) + 1, 0, 23, 59, 59);

        const movementsCollectionRef = collection(firestore, 'inventoryStockMovements');
        const q = query(
            movementsCollectionRef,
            where("date", ">=", Timestamp.fromDate(startDate)),
            where("date", "<=", Timestamp.fromDate(endDate))
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            toast({ title: "Aucun historique", description: "Il n'y a pas de mouvements à supprimer pour cette période." });
            return;
        }

        const batch = writeBatch(firestore);
        querySnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        toast({ title: "Historique du mois supprimé", description: `L'historique de ${format(startDate, 'MMMM yyyy', { locale: fr })} a été supprimé.` });
        fetchStockMovements();

    } catch (e) {
        console.error("Error deleting monthly history: ", e);
        toast({ title: "Erreur de suppression", description: "La suppression de l'historique a échoué.", variant: "destructive" });
    }
}, [toast, fetchStockMovements]);


  const addPurchaseOrder = useCallback(async (orderItems: PurchaseOrderItem[], supplierId?: string) => {
    const productDetails = orderItems.map(item => {
      if (item.isUnlinked) {
        return item;
      }
      const product = products.find(p => p.id === item.productId);
      const reference = product?.supplierReferences?.find(r => r.supplierId === supplierId)?.reference || product?.supplierReferences?.[0]?.reference || 'N/A';
      return {
        ...item,
        productName: product?.name || 'Produit Inconnu',
        reference: reference
      };
    });
    const newOrder: Omit<PurchaseOrder, 'id' | 'receivedDate'> & {date: Timestamp} = {
      date: Timestamp.fromDate(new Date()), 
      orderNumber: `BC-${format(new Date(), "yyyyMMdd")}-${Date.now().toString().slice(-4)}`,
      items: productDetails,
      status: 'pending' as PurchaseOrderStatus,
      supplierId: supplierId,
    };
    try {
      await addDoc(collection(firestore, "inventoryPurchaseOrders"), newOrder);
      fetchPurchaseOrders();
      toast({ title: "Bon de commande créé", description: `${newOrder.orderNumber} a été généré.` });
    } catch (e) {
      console.error("Error adding purchase order: ", e);
      toast({ title: "Erreur création bon de commande", variant: "destructive" });
    }
  }, [products, toast, fetchPurchaseOrders]);

  const deletePurchaseOrder = useCallback(async (orderId: string) => {
    const orderNumber = purchaseOrders.find(po => po.id === orderId)?.orderNumber || "Le bon";
    try {
      await deleteDoc(doc(firestore, "inventoryPurchaseOrders", orderId));
      fetchPurchaseOrders();
      toast({ title: "Bon de Commande Supprimé", description: `N° ${orderNumber} supprimé.`, variant: "destructive" });
    } catch (e) {
      console.error("Error deleting purchase order: ", e);
      toast({ title: "Erreur de suppression", variant: "destructive" });
    }
  }, [purchaseOrders, toast, fetchPurchaseOrders]);

  const handleReceiveAndClearPurchaseOrder = useCallback(async (orderId: string) => {
    const order = purchaseOrders.find(po => po.id === orderId);
     if (!order) return;

    const batchOp = writeBatch(firestore);

    for (const item of order.items) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const totalQuantityReceived = item.quantity * (product.quantityPerUnit || 1);
        const productDocRef = doc(firestore, "inventoryProducts", item.productId);
        batchOp.update(productDocRef, { quantity: product.quantity + totalQuantityReceived });

        const movementDocRef = doc(collection(firestore, "inventoryStockMovements"));
        const newMovement: Omit<StockMovement, 'id'> & {date: Timestamp} = {
          productId: item.productId,
          productName: product.name,
          type: 'entry',
          quantity: totalQuantityReceived,
          date: Timestamp.fromDate(new Date()),
          notes: `Réception et validation du BC N° ${order.orderNumber}`
        };
        batchOp.set(movementDocRef, newMovement);
      }
    }
    
    const orderDocRef = doc(firestore, "inventoryPurchaseOrders", orderId);
    batchOp.delete(orderDocRef);

    try {
      await batchOp.commit();
      fetchProducts();
      fetchPurchaseOrders();
      fetchStockMovements();
      toast({ title: "Bon de Commande Livré", description: `Le stock a été mis à jour et le bon de commande N° ${order.orderNumber} a été supprimé.`});
    } catch (e) {
      console.error("Error receiving and clearing purchase order: ", e);
      toast({ title: "Erreur lors de la livraison", variant: "destructive" });
    }
  }, [purchaseOrders, products, toast, fetchProducts, fetchPurchaseOrders, fetchStockMovements]);

  const inventoryTabsConfig: InventoryTab[] = [
    { value: "products", label: "Gestion Produits", Icon: PackagePlusIcon, component: <ManageProducts products={products} suppliers={suppliers} onAddProduct={addProduct} onUpdateProduct={updateProduct} onDeleteProduct={deleteProduct} onAddMultipleProducts={addMultipleProducts} onUpdateAllProductsThreshold={handleUpdateAllProductsThreshold} /> },
    { value: "suppliers", label: "Fournisseurs", Icon: Truck, component: <ManageSuppliers suppliers={suppliers} onAddSupplier={addSupplier} onUpdateSupplier={updateSupplier} onDeleteSupplier={deleteSupplier} /> },
    { value: "excel-actions", label: "Actions Excel", Icon: FileUp, component: <ExcelActionsPage products={products} onUpdateStock={handleUpdateStockFromExcel} onAddPurchaseOrder={addPurchaseOrder} /> },
    { value: "movements", label: "Mouvements Stock", Icon: HistoryIcon, component: <ManageStockMovements products={products} stockMovements={stockMovements} onAddStockMovement={addStockMovement} onDeleteAllStockMovements={handleDeleteAllStockMovements} onDeleteMovement={handleDeleteMovement} onDeleteSelectedMovements={handleDeleteSelectedMovements} onDeleteMonthlyHistory={handleDeleteMonthlyHistory}/> },
    { value: "inventory", label: "Inventaire", Icon: ListOrderedIcon, component: <GenerateInventory products={products} /> },
    { value: "purchase-orders", label: "Bons de Commande", Icon: ShoppingCartIcon, component: <GeneratePurchaseOrder products={products} purchaseOrders={purchaseOrders} suppliers={suppliers} onAddPurchaseOrder={addPurchaseOrder} onDeletePurchaseOrder={deletePurchaseOrder} onReceivePurchaseOrder={handleReceiveAndClearPurchaseOrder}/> },
  ];
  const [activeTab, setActiveTab] = useState(inventoryTabsConfig[0].value);

  useEffect(() => {
    setIsClient(true);
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const tabExists = inventoryTabsConfig.some(tab => tab.value === hash);
      if (tabExists) {
        setActiveTab(hash);
      }
    }
  }, [inventoryTabsConfig]);

  if (!isClient || isLoadingProducts || isLoadingMovements || isLoadingOrders || isLoadingSuppliers) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground ml-3">Chargement des stocks...</p>
      </div>
    );
  }

  return (
    <>
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
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 mb-6 bg-card p-1 rounded-lg">
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

        {importSummary && (
          <AlertDialog
              open={!!importSummary}
              onOpenChange={(isOpen) => !isOpen && setImportSummary(null)}
          >
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Rapport d'Importation Excel</AlertDialogTitle>
                      <AlertDialogDescription>
                          Le traitement de votre fichier est terminé.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="my-4 text-sm">
                      <p className="text-green-600 dark:text-green-400 font-medium">
                          <strong>{importSummary.updatedCount} produit(s)</strong> ont été mis à jour avec succès.
                      </p>
                      {importSummary.notFoundReferences.length > 0 && (
                          <div className="mt-4">
                              <p className="text-destructive font-medium">
                                  <strong>{importSummary.notFoundReferences.length} référence(s)</strong> n'ont pas été trouvées :
                              </p>
                              <div className="mt-2 p-2 bg-muted rounded-md max-h-40 overflow-y-auto">
                                  <ul className="list-disc pl-5 space-y-1">
                                      {importSummary.notFoundReferences.map((item, index) => (
                                          <li key={index} className="font-mono text-xs text-muted-foreground">
                                            {item.reference} ({item.productName || 'Nom non spécifié'})
                                          </li>
                                      ))}
                                  </ul>
                              </div>
                          </div>
                      )}
                  </div>
                  <AlertDialogFooter>
                      <AlertDialogAction onClick={() => setImportSummary(null)}>Fermer</AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
      )}
      </div>
    </>
  );
}
