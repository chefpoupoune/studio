
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, NotebookPen, ChefHat } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

const NOTEPAD_COLLECTION = "dashboardWidgets";
const CHEF_NOTEPAD_DOC_ID = "chefNotepad";

export default function ChefNotepad() {
  const [noteContent, setNoteContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedManually, setLastSavedManually] = useState<Date | null>(null);
  const { toast } = useToast();

  const loadNote = useCallback(async () => {
    setIsLoading(true);
    const docRef = doc(firestore, NOTEPAD_COLLECTION, CHEF_NOTEPAD_DOC_ID);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setNoteContent(data.content || '');
        if (data.updatedAt instanceof Timestamp) {
          // We'll only track manual saves for display now
          // setLastSavedManually(data.updatedAt.toDate()); 
        }
      } else {
        setNoteContent(''); 
        setLastSavedManually(null);
      }
    } catch (error) {
      console.error("Error loading chef's notepad from Firestore:", error);
      toast({ title: "Erreur de chargement du Pense-bête", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNoteContent(event.target.value);
  };

  const handleManualSave = async () => {
    if (isSaving || isLoading) return;
    setIsSaving(true);
    const docRef = doc(firestore, NOTEPAD_COLLECTION, CHEF_NOTEPAD_DOC_ID);
    const now = new Date();
    try {
      await setDoc(docRef, { content: noteContent, updatedAt: Timestamp.fromDate(now) }, { merge: true });
      setLastSavedManually(now);
      toast({ title: "Pense-bête Sauvegardé", description: "Vos notes ont été enregistrées." });
    } catch (error) {
      console.error("Error manually saving chef's notepad to Firestore:", error);
      toast({ title: "Erreur de Sauvegarde Manuelle", variant: "destructive" });
    }
    setIsSaving(false);
  };

  return (
    <Card className="shadow-lg col-span-1 md:col-span-2 flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-primary" />
            Pense-bête du Chef
          </CardTitle>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <CardDescription className="text-xs">
          Utilisez le bouton ci-dessous pour sauvegarder vos notes.
          {lastSavedManually && ` Dernière sauvegarde: ${lastSavedManually.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Textarea
            value={noteContent}
            onChange={handleTextChange}
            placeholder="Écrivez vos notes ici..."
            className="min-h-[150px] h-full text-sm bg-card-foreground/5 dark:bg-card-foreground/5 focus:ring-primary"
            rows={6}
          />
        )}
      </CardContent>
      <CardFooter className="pt-4 border-t flex justify-end">
        <Button onClick={handleManualSave} disabled={isSaving || isLoading} size="icon" aria-label="Sauvegarder Manuellement">
          {(isSaving && !isLoading) ? ( 
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ChefHat className="h-4 w-4" />
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
