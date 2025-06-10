
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Thermometer as ThermometerIcon, AlertCircle } from 'lucide-react'; // Added AlertCircle

export default function TemperatureMonitoring() {
  // This component is reset.
  // We will rebuild it based on new user requirements.

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThermometerIcon className="w-6 h-6 text-primary"/>
          Suivi des Températures (Nouveau)
        </CardTitle>
        <CardDescription>
          Cette section est en cours de redéfinition.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-muted-foreground/20 rounded-lg bg-card/50 min-h-[200px]">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
                Le module de suivi des températures est prêt à être configuré selon vos besoins.
            </p>
            <p className="text-sm text-muted-foreground/80 mt-2">
                Veuillez décrire comment vous souhaitez que ce tableau fonctionne.
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
