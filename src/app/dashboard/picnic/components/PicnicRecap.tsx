"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function PicnicRecap() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Récapitulatif Pique Nique</CardTitle>
        <CardDescription>
          Fonctionnalité pour visualiser un récapitulatif des pique-niques.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-muted-foreground/20 rounded-lg bg-card/50 min-h-[200px]">
          <Construction className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Fonctionnalité en cours de développement.
          </p>
          <p className="text-sm text-muted-foreground/80 mt-2">
            Cette section affichera un résumé des commandes de pique-niques.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

    