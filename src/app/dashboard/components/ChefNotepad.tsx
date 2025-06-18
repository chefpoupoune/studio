
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Save, NotebookPen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

const NOTEPAD_COLLECTION = "dashboardWidgets";
const CHEF_NOTEPAD_DOC_ID = "chefNotepad";

export default function ChefNotepad() {
  const [noteContent, setNoteContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
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
          setLastSaved(data.updatedAt.toDate());
        }
      } else {
        setNoteContent(''); // No existing note
        setLastSaved(null);
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

  const saveNote = useCallback(async (contentToSave: string) => {
    if (isSaving) return;
    setIsSaving(true);
    const docRef = doc(firestore, NOTEPAD_COLLECTION, CHEF_NOTEPAD_DOC_ID);
    const now = new Date();
    try {
      await setDoc(docRef, { content: contentToSave, updatedAt: Timestamp.fromDate(now) }, { merge: true });
      setLastSaved(now);
    } catch (error) {
      console.error("Error saving chef's notepad to Firestore:", error);
      toast({ title: "Erreur de sauvegarde du Pense-bête", variant: "destructive" });
    }
    setIsSaving(false);
  }, [toast, isSaving]);

  useEffect(() => {
    if (isLoading) return; // Don't save while initial load is happening

    const handler = setTimeout(() => {
      if (noteContent !== undefined) { // Ensure noteContent is not undefined before saving
        saveNote(noteContent);
      }
    }, 1500); // Debounce time: 1.5 seconds

    return () => {
      clearTimeout(handler);
    };
  }, [noteContent, saveNote, isLoading]);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNoteContent(event.target.value);
  };

  return (
    <Card className="shadow-lg col-span-1 md:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-primary" />
            Pense-bête du Chef
          </CardTitle>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <CardDescription className="text-xs">
          Vos notes sont sauvegardées automatiquement.
          {lastSaved && ` Dernière sauvegarde: ${lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Textarea
            value={noteContent}
            onChange={handleTextChange}
            placeholder="Écrivez vos notes ici..."
            className="min-h-[150px] text-sm bg-card-foreground/5 dark:bg-card-foreground/5 focus:ring-primary"
            rows={6}
          />
        )}
      </CardContent>
    </Card>
  );
}
