
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function UserManagement() {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-6 h-6 text-primary"/>
          Gestion des Utilisateurs
        </CardTitle>
        <CardDescription>
          Créez et gérez les comptes utilisateurs de l'application.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <AlertTitle className="text-amber-700 dark:text-amber-500 font-semibold">Fonctionnalité en cours de développement</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-600">
              La gestion avancée des utilisateurs (création, rôles, mots de passe sécurisés) est en cours de développement.
              Actuellement, seul le compte "chef" avec le mot de passe "000" est fonctionnel pour la démonstration.
            </AlertDescription>
        </Alert>
        
        <div className="mt-6 p-6 border rounded-lg bg-card/50">
            <h3 className="text-lg font-semibold text-foreground mb-3">Prochaines Étapes :</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Permettre au compte "chef" de créer de nouveaux utilisateurs (nom d'utilisateur, mot de passe initial).</li>
                <li>Mettre en place un système de stockage sécurisé des identifiants (hors localStorage pour les mots de passe).</li>
                <li>Définir des rôles et permissions pour les utilisateurs.</li>
                <li>Adapter le système de connexion pour gérer plusieurs comptes.</li>
            </ul>
        </div>
      </CardContent>
    </Card>
  );
}
