
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";

export default function CostManagementErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center space-y-6 p-4 text-center">
      <div
        className="rounded-full bg-destructive/20 p-4 text-destructive"
        aria-hidden="true"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="48" 
          height="48" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="lucide lucide-receipt-text" // Using a relevant icon for cost/receipts
        >
          <path d="M4 2v20l4-4 4 4 4-4 4 4V2Z"/>
          <path d="M9 7H7"/>
          <path d="M16 7h-2"/>
          <path d="M16 11h-2"/>
          <path d="M11 11H9"/>
          <path d="M11 15H9"/>
          <path d="M16 15h-2"/>
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-destructive">
        Une erreur est survenue dans la section Gestion des Coûts.
      </h1>
      <p className="text-lg text-muted-foreground">
        Nous sommes désolés, quelque chose s&apos;est mal passé. Vous pouvez essayer de recharger la page ou de revenir au tableau de bord.
      </p>
      <p className="text-sm text-muted-foreground">
        Détail de l&apos;erreur : {error.message}
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()} variant="destructive">
          Réessayer
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Retour au Tableau de Bord</Link>
        </Button>
      </div>
    </div>
  );
}
