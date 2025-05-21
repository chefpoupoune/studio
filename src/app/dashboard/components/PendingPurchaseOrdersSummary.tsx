
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, AlertCircle, Loader2 } from "lucide-react";
import type { PurchaseOrder } from '@/app/dashboard/inventory/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PURCHASE_ORDERS_STORAGE_KEY = 'inventory_purchase_orders';

export default function PendingPurchaseOrdersSummary() {
  const [pendingOrders, setPendingOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      setIsLoading(true);
      try {
        const storedOrders = localStorage.getItem(PURCHASE_ORDERS_STORAGE_KEY);
        if (storedOrders) {
          const allOrders: PurchaseOrder[] = JSON.parse(storedOrders).map((order: any) => ({
            ...order,
            date: new Date(order.date),
            status: order.status || 'pending', 
          }));
          const filteredPending = allOrders.filter(order => order.status === 'pending');
          setPendingOrders(filteredPending.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } else {
          setPendingOrders([]);
        }
      } catch (e) {
        console.error("Error loading purchase orders from localStorage for summary:", e);
        setPendingOrders([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isClient]);

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
          Suivi des commandes en attente de réception.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        {pendingOrders.length > 0 ? (
          <ScrollArea className="h-[200px] sm:h-[220px] pr-3">
            <ul className="space-y-2 text-sm">
              {pendingOrders.slice(0, 5).map((order) => ( 
                <li key={order.id} className="p-2 border rounded-md bg-card/60 hover:bg-muted/30">
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate pr-2" title={order.orderNumber}>
                      N°: {order.orderNumber}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(order.date), "dd/MM/yy", { locale: fr })}
                    </span>
                  </div>
                   <div className="text-xs text-muted-foreground mt-0.5 flex justify-between items-center">
                      <span>{order.items.length} article{order.items.length > 1 ? 's' : ''}</span>
                       <Badge variant="secondary" className="text-xs">En attente</Badge>
                  </div>
                </li>
              ))}
              {pendingOrders.length > 5 && <li className="text-xs text-muted-foreground text-center pt-1">... et {pendingOrders.length - 5} autre(s).</li>}
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
