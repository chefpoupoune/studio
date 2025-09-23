
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Truck, Construction } from "lucide-react";
import { LOGGED_IN_USER_PERMISSIONS_KEY } from '@/app/dashboard/settings/components/user-management';

export default function ReceptionMonitoring() {
  const [isSuperviseur, setIsSuperviseur] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const permissionsString = localStorage.getItem(LOGGED_IN_USER_PERMISSIONS_KEY);
      if (permissionsString) {
        const permissions = JSON.parse(permissionsString);
        setIsSuperviseur(permissions.role === 'superviseur');
      }
    }
  }, []);

  return (
    <Card className="shadow-lg w-full max-w-4xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-4">
          <Truck className="w-8 h-8 text-primary"/>
          <div>
            <CardTitle className="text-xl md:text-2xl">
              Suivi de Réception des Marchandises
            </CardTitle>
            <CardDescription className="hidden md:block">
              Contrôle et enregistrement des réceptions de marchandises.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          className="flex flex-col items-center justify-center text-center p-6 md:p-10 border-2 border-dashed border-muted-foreground/20 rounded-lg bg-card/50 min-h-[200px]" 
          aria-disabled={isSuperviseur}
        >
          <Construction className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground mb-4" />
          <p className="text-base md:text-lg font-medium text-muted-foreground">
            Fonctionnalité en cours de développement.
          </p>
          <p className="text-xs md:text-sm text-muted-foreground/80 mt-2 max-w-prose">
            Cette section vous permettra de documenter les contrôles à réception des livraisons (températures, DLC, état des produits, etc.).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
