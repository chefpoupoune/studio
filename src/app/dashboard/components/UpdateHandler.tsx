
"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Clé pour stocker le timestamp de la version dans le localStorage du navigateur
const APP_VERSION_TIMESTAMP_KEY = "app_version_timestamp";

export function UpdateHandler() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [newTimestamp, setNewTimestamp] = useState<Timestamp | null>(null);

  useEffect(() => {
    // Mise en place de l'écouteur Firestore sur le document de statut
    const unsubscribe = onSnapshot(doc(firestore, "app_status", "latest_update"), (snapshot) => {
      if (!snapshot.exists()) {
        // Le document n'existe pas encore, ne rien faire.
        return;
      }
      
      const serverTimestamp = snapshot.data()?.update_timestamp as Timestamp;
      if (!serverTimestamp) {
        // Le champ de timestamp est manquant, ne rien faire.
        return;
      }
      
      // Stocker le dernier timestamp reçu du serveur
      setNewTimestamp(serverTimestamp);

      const localTimestampStr = localStorage.getItem(APP_VERSION_TIMESTAMP_KEY);

      if (localTimestampStr) {
        // Une version est déjà enregistrée localement, comparons-les.
        const localTimestamp = parseInt(localTimestampStr, 10);
        if (serverTimestamp.toMillis() > localTimestamp) {
          // La version du serveur est plus récente, une mise à jour est requise.
          setUpdateRequired(true);
        }
      } else {
        // C'est la première fois que l'utilisateur charge l'application avec cette fonctionnalité.
        // On enregistre la version actuelle pour éviter une alerte de mise à jour immédiate.
        localStorage.setItem(APP_VERSION_TIMESTAMP_KEY, serverTimestamp.toMillis().toString());
      }
    });

    // Nettoyage de l'écouteur lorsque le composant est démonté
    return () => unsubscribe();
  }, []); // Le tableau de dépendances vide assure que l'effet ne s'exécute qu'une fois.

  const handleUpdateAndReload = () => {
    if (newTimestamp) {
      // Avant de recharger, on met à jour le localStorage avec le nouveau timestamp.
      // Cela évite que la boîte de dialogue ne réapparaisse juste après l'actualisation.
      localStorage.setItem(APP_VERSION_TIMESTAMP_KEY, newTimestamp.toMillis().toString());
    }
    // Forcer un rechargement complet de la page.
    window.location.reload();
  };

  return (
    <AlertDialog open={updateRequired}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mise à Jour Requise</AlertDialogTitle>
          <AlertDialogDescription>
            Une nouvelle version de l'application est disponible. Veuillez cliquer sur le bouton pour actualiser.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleUpdateAndReload}>
            Actualiser
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
