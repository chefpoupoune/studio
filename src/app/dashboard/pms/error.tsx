
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";

export default function PmsErrorPage({
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
          className="lucide lucide-shield-alert"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-destructive">
        Une erreur est survenue dans la section PMS.
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
