
"use client";

import { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Rocket } from "lucide-react";

export function ApplicationUpdateManager() {
  const [isConfirming, setIsConfirming] = useState(false);
  const { toast } = useToast();

  const handleForceUpdate = async () => {
    setIsConfirming(false);
    try {
      await setDoc(doc(firestore, "app_status", "latest_update"), {
        update_timestamp: serverTimestamp(),
      });
      toast({
        title: "Signal envoyé",
        description:
          "Tous les utilisateurs actifs seront invités à actualiser leur application.",
      });
    } catch (error) {
      console.error("Error forcing update:", error);
      toast({
        title: "Erreur",
        description:
          "Impossible d'envoyer le signal de mise à jour. Veuillez vérifier la console pour plus de détails.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Contrôle de l'application</CardTitle>
          <CardDescription>
            Actions de maintenance et de gestion globale de l'application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <p className="text-sm text-muted-foreground">
              Déclenchez une notification pour tous les utilisateurs connectés
              afin de les inciter à recharger l'application. Utile après une
              mise à jour importante pour s'assurer que tout le monde dispose de
              la dernière version.
            </p>
            <Button onClick={() => setIsConfirming(true)}>
              <Rocket className="mr-2 h-4 w-4" />
              Forcer l'actualisation pour tous
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action enverra une notification à **tous** les utilisateurs
              actifs pour leur demander de rafraîchir leur page. Êtes-vous sûr
              de vouloir continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleForceUpdate}>
              Oui, envoyer le signal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
