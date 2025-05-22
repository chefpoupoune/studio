"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function PicnicMenu() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Menu Pique Nique</CardTitle>
        <CardDescription>
          Fonctionnalité pour définir le contenu des menus pique-nique.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-muted-foreground/20 rounded-lg bg-card/50 min-h-[200px]">
          <Construction className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            Fonctionnalité en cours de développement.
          </p>
          <p className="text-sm text-muted-foreground/80 mt-2">
            Vous pourrez ici composer les menus types pour les pique-niques.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

    