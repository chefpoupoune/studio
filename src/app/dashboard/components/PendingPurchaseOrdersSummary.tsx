
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react'; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, AlertCircle, Loader2 } from "lucide-react";
import type { PurchaseOrder, PurchaseOrderItem } from '@/app/dashboard/inventory/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { firestore } from '@/lib/firebase'; 
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore'; 
import { useToast } from '@/hooks/use-toast'; 

export default function PendingPurchaseOrdersSummary() {
  const [pendingOrders, setPendingOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast(); 

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchPendingOrders = useCallback(async () => {
    if (!isClient) return;
    console.log("PendingPurchaseOrdersSummary: Attempting to fetch orders...");
    setIsLoading(true);
    try {
      const ordersCollectionRef = collection(firestore, 'inventoryPurchaseOrders');
      const q = query(
        ordersCollectionRef,
        where('status', '==', 'pending'),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log("PendingPurchaseOrdersSummary: No pending purchase orders found.");
        setPendingOrders([]);
      } else {
        const ordersList = querySnapshot.docs.map((docSnap, index) => {
          const data = docSnap.data();
          let order: PurchaseOrder | null = null;
          try {
            let orderDate = new Date(); 
            if (data?.date instanceof Timestamp) {
              orderDate = data.date.toDate();
            } else if (data?.date && typeof data.date === 'object' && data.date._seconds !== undefined) { // Handle Firestore Timestamp-like objects if not properly casted
              orderDate = new Date(data.date._seconds * 1000);
            } else if (data?.date && typeof data.date === 'string') {
              const parsed = new Date(data.date);
              if (!isNaN(parsed.getTime())) {
                orderDate = parsed;
              } else {
                console.warn(`PendingPurchaseOrdersSummary: Order ${docSnap.id} has an invalid date string format: ${data.date}. Falling back to current date.`);
              }
            } else {
               console.warn(`PendingPurchaseOrdersSummary: Order ${docSnap.id} is missing a date or has an unexpected date type. Falling back to current date. Data.date:`, data?.date);
            }
            
            let receivedDateString: string | undefined = undefined;
            if (data?.receivedDate) {
                if (data.receivedDate instanceof Timestamp) {
                    receivedDateString = data.receivedDate.toDate().toISOString();
                } else if (typeof data.receivedDate === 'string' && !isNaN(new Date(data.receivedDate).getTime())) {
                    receivedDateString = new Date(data.receivedDate).toISOString();
                } else if (typeof data.receivedDate === 'object' && data.receivedDate._seconds !== undefined) { 
                     receivedDateString = new Date(data.receivedDate._seconds * 1000).toISOString();
                } else {
                    console.warn(`PendingPurchaseOrdersSummary: Order ${docSnap.id} has an invalid receivedDate format. Type: ${typeof data.receivedDate}, Value:`, data.receivedDate);
                }
            }

            const items: PurchaseOrderItem[] = Array.isArray(data?.items) ? data.items.map((item: any, itemIndex: number) => ({
              productId: item?.productId || `unknown_item_${docSnap.id}_${itemIndex}`,
              productName: typeof item?.productName === 'string' ? item.productName : 'Produit inconnu',
              reference: typeof item?.reference === 'string' ? item.reference : 'N/A',
              quantity: typeof item?.quantity === 'number' && !isNaN(item.quantity) ? item.quantity : 0,
              unit: typeof item?.unit === 'string' ? item.unit : 'unité',
            })) : [];

            order = {
              id: docSnap.id,
              orderNumber: typeof data?.orderNumber === 'string' ? data.orderNumber : `BC_INCONNU_${docSnap.id.substring(0,5)}`,
              date: orderDate,
              items: items,
              status: typeof data?.status === 'string' ? data.status as PurchaseOrder['status'] : 'pending',
              receivedDate: receivedDateString,
            };
            return order;
          } catch (mapError: any) {
            console.error(`PendingPurchaseOrdersSummary: Error mapping document ${docSnap.id}. Data:`, data, 'Error:', mapError.message, mapError.stack);
            toast({ title: `Erreur Traitement Bon ${docSnap.id}`, description: `Impossible de traiter un bon de commande. Détails: ${mapError.message}`, variant: "destructive" });
            return null; // Skip this problematic document
          }
        }).filter(Boolean) as PurchaseOrder[]; // Filter out nulls from problematic documents
        setPendingOrders(ordersList);
        console.log("PendingPurchaseOrdersSummary: Orders fetched and mapped successfully:", ordersList.length);
      }
    } catch (e: any) {
      console.error("PendingPurchaseOrdersSummary: Error loading pending purchase orders from Firestore:", e.message, e.stack, e);
      setPendingOrders([]); // Reset on error
      toast({ 
        title: "Erreur Chargement Bons de Commande (Résumé)", 
        description: `Impossible de récupérer les bons de commande. ${e.code ? `Code: ${e.code}. ` : ''}Vérifiez les règles Firestore et les index. Détails dans la console.`, 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient) {
      fetchPendingOrders(); 

      const handleInventoryUpdate = () => {
        console.log("PendingPurchaseOrdersSummary: inventoryPurchaseOrdersUpdated event received. Re-fetching orders.");
        fetchPendingOrders();
      };
      window.addEventListener('inventoryPurchaseOrdersUpdated', handleInventoryUpdate);
      
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log("PendingPurchaseOrdersSummary: Tab became visible, re-fetching orders.");
          fetchPendingOrders();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('inventoryPurchaseOrdersUpdated', handleInventoryUpdate);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isClient, fetchPendingOrders]);


  if (!isClient || isLoading) {
    return (
        <Card className="shadow-lg h-full flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-primary" />
                    Bons de Commande en Attente
                </CardTitle>
                <CardDescription className="text-xs">
                Chargement des commandes en attente...
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow pt-2 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Bons de Commande en Attente
          </CardTitle>
          {pendingOrders.length > 0 && (
             <Badge variant="warning" className="text-sm">
                {pendingOrders.length}
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Suivi des commandes en attente de réception. (Max. 3 affichées)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        {pendingOrders.length > 0 ? (
          <ScrollArea className="h-[220px] sm:h-[240px] pr-3"> 
            <ul className="space-y-3 text-sm"> 
              {pendingOrders.slice(0, 3).map((order) => (
                <li key={order.id} className="p-2.5 border rounded-md bg-card/60 hover:bg-muted/30">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium truncate pr-2 text-foreground" title={order.orderNumber}>
                      N°: {order.orderNumber}
                    </span>
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">En attente</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Date: {order.date instanceof Date && !isNaN(order.date.getTime()) ? format(order.date, "dd/MM/yy", { locale: fr }) : "Date Invalide"}
                  </p>
                   
                  {order.items && order.items.length > 0 && (
                    <div className="mt-1.5 text-xs">
                      <p className="font-semibold text-foreground/90 mb-0.5">Aperçu articles :</p>
                      <ul className="list-disc list-inside pl-3 space-y-0.5 text-muted-foreground">
                        {order.items.slice(0, 2).map((item, itemIdx) => ( 
                          <li key={item.productId || `item-${order.id}-${itemIdx}`} className="text-xs">
                            {item.productName || 'Article inconnu'} - {item.quantity || 0} {item.unit || 'unité'}
                          </li>
                        ))}
                        {order.items.length > 2 && (
                          <li className="text-xs italic">... et {order.items.length - 2} autre(s)</li>
                        )}
                      </ul>
                    </div>
                  )}
                   {(!order.items || order.items.length === 0) && (
                     <p className="text-xs italic text-muted-foreground/70 mt-1.5">Aucun article spécifié.</p>
                   )}
                </li>
              ))}
              {pendingOrders.length > 3 && <li className="text-xs text-muted-foreground text-center pt-1">... et {pendingOrders.length - 3} autre(s).</li>}
            </ul>
          </ScrollArea>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4 h-full flex flex-col items-center justify-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground/70 mb-2"/>
            <p>Aucun bon de commande en attente actuellement.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

