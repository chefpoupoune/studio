
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";

export default function SettingsErrorPage({
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
          className="lucide lucide-settings-2"
        >
          <path d="M20 7h-9"/>
          <path d="M14 17H5"/>
          <circle cx="17" cy="17" r="3"/>
          <circle cx="7" cy="7" r="3"/>
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-destructive">
        Une erreur est survenue dans la section Paramètres.
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
