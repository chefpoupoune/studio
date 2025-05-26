
"use client";

import Link from 'next/link';
import { FileClock } from 'lucide-react'; // Ou une autre icône pertinente
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import React from 'react';

export default function DeclarationHeurePage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
           <FileClock className="w-10 h-10 text-accent" />
           <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
             Déclaration d'Heures
           </h1>
        </div>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Module de Déclaration d'Heures</CardTitle>
          <CardDescription>
            Cette section permettra aux employés de déclarer leurs heures travaillées.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed border-muted-foreground/20 rounded-lg bg-card/50 min-h-[200px]">
            <FileClock className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              Fonctionnalité en cours de développement.
            </p>
            <p className="text-sm text-muted-foreground/80 mt-2">
              Revenez bientôt pour pouvoir déclarer vos heures ici.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
