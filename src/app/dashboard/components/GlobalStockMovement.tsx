'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { firestore } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  setDoc,
  query,
  orderBy,
  writeBatch,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import type { Product, StockMovement } from '@/app/dashboard/inventory/types';
import NewStockMovementForm from '@/app/dashboard/components/NewStockMovementForm';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface GlobalStockMovementProps {
  onFormSubmit: () => void;
}

export default function GlobalStockMovement({ onFormSubmit }: GlobalStockMovementProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const productsCollectionRef = collection(firestore, 'inventoryProducts');
      const q = query(productsCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const productsList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        if (data.reference && !data.references) {
          data.references = [data.reference];
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
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

    const newMovementFirestore: Omit<StockMovement, 'id'> & { date: Timestamp } = {
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
      // Dispatch event to notify other components (like inventory page) to refresh
      window.dispatchEvent(new CustomEvent('stockUpdated'));
      toast({ title: "Mouvement enregistré", description: `${movementData.quantity} ${product.name} (${movementData.type === 'entry' ? 'entrée' : 'sortie'}).` });
      onFormSubmit(); // Close the dialog
    } catch (e) {
      console.error("Error adding stock movement: ", e);
      toast({ title: "Erreur enregistrement mouvement", variant: "destructive" });
    }
  }, [products, toast, onFormSubmit]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Chargement des produits...</p>
      </div>
    );
  }

  return (
    <NewStockMovementForm
      products={products}
      onAddStockMovement={addStockMovement}
      onFormSubmit={onFormSubmit}
    />
  );
}
