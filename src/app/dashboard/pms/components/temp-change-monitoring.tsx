
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, ArrowDownUp, Construction } from "lucide-react";

export default function TempChangeMonitoring() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownUp className="w-6 h-6 text-primary"/>
          Suivi Baisse / Remise en Température
        </CardTitle>
        <CardDescription>
          Enregistrement des processus de refroidissement rapide et de remise en température des plats.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-muted-foreground/20 rounded-lg bg-card/50 min-h-[200px]">
          <Construction className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Fonctionnalité en cours de développement.
          </p>
          <p className="text-sm text-muted-foreground/80 mt-2">
            Cette section permettra de documenter les temps et températures lors du refroidissement ou de la remise en température des aliments.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
