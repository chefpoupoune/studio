
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, ThermometerSnowflake, Construction } from "lucide-react";

export default function ColdChainMonitoring() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThermometerSnowflake className="w-6 h-6 text-primary"/>
          Suivi de la Liaison Froide
        </CardTitle>
        <CardDescription>
          Enregistrement et suivi des températures lors du transport et de la réception de produits froids ou surgelés.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-muted-foreground/20 rounded-lg bg-card/50 min-h-[200px]">
          <Construction className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Fonctionnalité en cours de développement.
          </p>
          <p className="text-sm text-muted-foreground/80 mt-2">
            Cette section permettra de documenter les contrôles de température des produits durant les étapes de la liaison froide.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
