
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";

export default function TimeTrackingErrorPage({
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
          className="lucide lucide-alarm-clock-off" // Using a different icon for variety
        >
          <path d="M19.94 14A8 8 0 0 0 10 5.25m-1.26 8.2A8 8 0 0 0 14 19.94"/>
          <path d="M12 6v6l4 2"/>
          <path d="M22 2 2 22"/>
          <path d="M6.38 18.7A8.01 8.01 0 0 0 12 20a8 8 0 0 0 7.28-5.5"/>
          <path d="M19.31 18.83a11.5 11.5 0 0 1-15.18-12M4 5L2 7"/>
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-destructive">
        Une erreur est survenue dans la section Suivi des Heures.
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
