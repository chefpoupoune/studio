
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, NotebookPen } from 'lucide-react';
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
      }
    } catch (error) {
      console.error("Error loading notepad:", error);
      toast({ title: "Erreur de chargement du Pense-bête", variant: "destructive" });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  const handleSaveNote = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const docRef = doc(firestore, NOTEPAD_COLLECTION, CHEF_NOTEPAD_DOC_ID);
    const now = new Date();
    try {
      await setDoc(docRef, { content: noteContent, updatedAt: Timestamp.fromDate(now) }, { merge: true });
      setLastSaved(now);
      toast({ title: "Pense-bête Sauvegardé" });
    } catch (error) {
      console.error("Error saving note:", error);
      toast({ title: "Erreur de Sauvegarde", variant: "destructive" });
    }
    setIsSaving(false);
  };

  return (
    <Card className="shadow-lg flex flex-col h-full">
        <CardHeader>
            <div className="flex items-center gap-2">
                <NotebookPen className="w-6 h-6 text-primary" />
                <CardTitle className="text-xl">Pense-bête</CardTitle>
            </div>
            <CardDescription>
                {lastSaved ? `Dernière sauvegarde: ${lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Vos notes s\'enregistrent ici.'}
            </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col">
            {isLoading ? (
                <div className="flex justify-center items-center flex-grow">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <Textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Écrivez vos notes, idées, ou tout ce que vous avez en tête..."
                    className="flex-grow min-h-[200px] text-sm bg-card-foreground/5 dark:bg-card-foreground/5"
                />
            )}
             <Button onClick={handleSaveNote} disabled={isSaving} size="sm" className="mt-4 self-end">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder les notes"}
            </Button>
        </CardContent>
    </Card>
  );
}
