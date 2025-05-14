
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, Construction } from "lucide-react";

export default function KitchenCleaningMonitoring() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Construction className="w-6 h-6 text-primary"/>
          Suivi Nettoyage Cuisine
        </CardTitle>
        <CardDescription>
          Gestion des protocoles et enregistrements de nettoyage pour la cuisine.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-muted-foreground/20 rounded-lg bg-card/50 min-h-[200px]">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Fonctionnalité en cours de développement.
          </p>
          <p className="text-sm text-muted-foreground/80 mt-2">
            Ici, vous pourrez gérer les checklists de nettoyage spécifiques à la cuisine.
            Vous pourrez définir des tâches, des fréquences, et suivre leur exécution.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
