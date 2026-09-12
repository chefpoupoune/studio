
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, PlusCircle, Trash2, Calendar as CalendarIcon, BellRing } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { firestore } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp, query } from 'firebase/firestore';
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const CHECKLIST_COLLECTION = "chefChecklist";

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate: Date | null;
}

export default function ChefReminders() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [newItemDueDate, setNewItemDueDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [notified, setNotified] = useState<string[]>([]);
  const [dueReminder, setDueReminder] = useState<ChecklistItem | null>(null);

  const checkDueReminders = useCallback((currentItems: ChecklistItem[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueItem = currentItems.find(item => {
      if (item.dueDate && !item.completed && !notified.includes(item.id)) {
        const dueDate = new Date(item.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() <= today.getTime();
      }
      return false;
    });

    if (dueItem) {
      setDueReminder(dueItem);
      setNotified(prev => [...prev, dueItem.id]);
    }
  }, [notified]);

  useEffect(() => {
    const q = query(collection(firestore, CHECKLIST_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const checklistItems = snapshot.docs.map(doc => ({
        id: doc.id,
        text: doc.data().text,
        completed: doc.data().completed,
        dueDate: doc.data().dueDate ? doc.data().dueDate.toDate() : null,
      } as ChecklistItem));
      setItems(checklistItems);
      if (isLoading) {
        checkDueReminders(checklistItems);
        setIsLoading(false);
      }
    }, (error) => {
      console.error("Error loading checklist:", error);
      toast({ title: "Erreur de chargement des rappels", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isLoading, checkDueReminders, toast]);

  const handleAddItem = async () => {
    if (newItemText.trim() === '') return;
    try {
      await addDoc(collection(firestore, CHECKLIST_COLLECTION), {
        text: newItemText,
        completed: false,
        dueDate: newItemDueDate ? Timestamp.fromDate(newItemDueDate) : null,
        createdAt: Timestamp.now(),
      });
      setNewItemText('');
      setNewItemDueDate(null);
      toast({ title: "Rappel ajouté" });
    } catch (error) {
      console.error("Error adding item:", error);
      toast({ title: "Erreur d'ajout du rappel", variant: "destructive" });
    }
  };

  const handleToggleItem = async (id: string, completed: boolean) => {
    const itemRef = doc(firestore, CHECKLIST_COLLECTION, id);
    try {
      await updateDoc(itemRef, { completed: !completed });
    } catch (error) {
      console.error("Error toggling item:", error);
      toast({ title: "Erreur de mise à jour du rappel", variant: "destructive" });
    }
  };

  const handleDeleteItem = async (id: string) => {
    const itemRef = doc(firestore, CHECKLIST_COLLECTION, id);
    try {
      await deleteDoc(itemRef);
      toast({ title: "Rappel supprimé" });
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({ title: "Erreur de suppression du rappel", variant: "destructive" });
    }
  };
  
  const handleTestNotification = () => {
    setDueReminder({
        id: 'test-notification',
        text: 'Ceci est un rappel de test pour vérifier la fonctionnalité de la popup.',
        completed: false,
        dueDate: new Date()
    });
  }

  return (
    <Card className="shadow-lg flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-xl">Rappels & Checklist</CardTitle>
        <CardDescription>Votre liste de tâches à ne pas oublier.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        <div className="flex items-center gap-2">
          <Input 
            placeholder="Nouveau rappel..." 
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="w-[180px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {newItemDueDate ? format(newItemDueDate, "PPP", { locale: fr }) : <span>Pas d'échéance</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                locale={fr}
                mode="single"
                selected={newItemDueDate || undefined}
                onSelect={(date) => setNewItemDueDate(date || null)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button onClick={handleAddItem}><PlusCircle className="h-5 w-5 mr-2"/>Ajouter</Button>
        </div>
        <div className="mt-4 border-t pt-4 flex-grow">
          {isLoading ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length > 0 ? (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-2">
                {items.map(item => {
                  const isOverdue = item.dueDate && !item.completed && new Date(item.dueDate) < new Date();
                  return (
                  <div key={item.id} className={`flex items-center justify-between p-2 rounded-md hover:bg-muted/50 ${isOverdue ? 'bg-destructive/10' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Checkbox id={`reminder-${item.id}`} checked={item.completed} onCheckedChange={() => handleToggleItem(item.id, item.completed)} />
                      <label htmlFor={`reminder-${item.id}`} className={`text-sm font-medium ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.text}
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.dueDate && (
                        <span className={`text-xs text-muted-foreground bg-secondary px-2 py-1 rounded ${isOverdue ? 'text-destructive font-semibold' : ''}`}>
                          {format(item.dueDate, "d MMM", { locale: fr })}
                        </span>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item.id)} className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )})}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun rappel pour le moment.</p>
          )}
        </div>
         <div className="mt-4 pt-4 border-t">
            <Button onClick={handleTestNotification} variant="secondary" className="w-full">
                <BellRing className="h-4 w-4 mr-2"/>
                Tester la Notification de Rappel
            </Button>
        </div>
        <AlertDialog open={!!dueReminder} onOpenChange={() => setDueReminder(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-bold text-destructive">Rappel Important !</AlertDialogTitle>
                    <AlertDialogDescription className="pt-4 text-lg text-foreground">
                        {dueReminder?.text}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setDueReminder(null)}>J'ai bien noté</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
