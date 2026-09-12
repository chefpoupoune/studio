
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, NotebookPen, ChefHat, Calendar as CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp, collection, addDoc, query, where, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Firestore Collections
const NOTEPAD_COLLECTION = "dashboardWidgets";
const CHEF_NOTEPAD_DOC_ID = "chefNotepad";
const TASKS_COLLECTION = "chefTasks";

interface Task {
  id: string;
  text: string;
  dueDate: Date | null;
  completed: boolean;
}

export default function ChefOrganizer() {
  const [noteContent, setNoteContent] = useState<string>('');
  const [isLoadingNote, setIsLoadingNote] = useState(true);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  const { toast } = useToast();

  // Notepad Logic
  const loadNote = useCallback(async () => {
    setIsLoadingNote(true);
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
    setIsLoadingNote(false);
  }, [toast]);

  const handleSaveNote = async () => {
    if (isSavingNote) return;
    setIsSavingNote(true);
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
    setIsSavingNote(false);
  };

  // Task/Planning Logic
  const loadTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    const q = query(collection(firestore, TASKS_COLLECTION), orderBy("dueDate", "asc"));
    try {
      const querySnapshot = await getDocs(q);
      const fetchedTasks: Task[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        text: doc.data().text,
        dueDate: doc.data().dueDate ? doc.data().dueDate.toDate() : null,
        completed: doc.data().completed,
      }));
      setTasks(fetchedTasks.filter(task => !task.completed));
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast({ title: "Erreur de chargement du planning", variant: "destructive" });
    }
    setIsLoadingTasks(false);
  }, [toast]);

  const handleAddTask = async () => {
    if (!newTaskText.trim()) {
      toast({ title: "Le texte de la tâche ne peut pas être vide", variant: "destructive" });
      return;
    }
    try {
      await addDoc(collection(firestore, TASKS_COLLECTION), {
        text: newTaskText,
        dueDate: newTaskDueDate ? Timestamp.fromDate(newTaskDueDate) : null,
        completed: false,
        createdAt: Timestamp.now(),
      });
      setNewTaskText("");
      setNewTaskDueDate(null);
      toast({ title: "Tâche ajoutée avec succès" });
      loadTasks(); // Refresh tasks
    } catch (error) {
      console.error("Error adding task:", error);
      toast({ title: "Erreur lors de l'ajout de la tâche", variant: "destructive" });
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      // For simplicity, we'll delete the task when it's "completed"
      await deleteDoc(doc(firestore, TASKS_COLLECTION, task.id));
      toast({ title: "Tâche terminée et archivée!" });
      loadTasks(); // Refresh tasks
    } catch (error) {
      console.error("Error toggling task:", error);
      toast({ title: "Erreur lors de la mise à jour de la tâche", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadNote();
    loadTasks();
  }, [loadNote, loadTasks]);

  return (
    <Card className="shadow-lg flex flex-col h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <ChefHat className="w-6 h-6 text-primary" />
                <CardTitle className="text-xl">
                    Organiseur du Chef
                </CardTitle>
            </div>
            <CardDescription className="text-xs mt-1">
                Pense-bête, planning et rappels.
            </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <Tabs defaultValue="planning">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="planning">Planning & Rappels</TabsTrigger>
            <TabsTrigger value="notepad">Pense-bête</TabsTrigger>
          </TabsList>
          
          {/* PLANNING TAB */}
          <TabsContent value="planning" className="pt-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Nouvelle tâche ou rappel..." 
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className="w-[180px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newTaskDueDate ? format(newTaskDueDate, "PPP", { locale: fr }) : <span>Pas d'échéance</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={newTaskDueDate || undefined}
                      onSelect={(date) => setNewTaskDueDate(date || null)}
                      initialFocus
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
                <Button onClick={handleAddTask} size="icon"><PlusCircle className="h-5 w-5"/></Button>
              </div>
              <div className="mt-4 border-t pt-4">
                <h3 className="text-md font-semibold mb-2">Tâches à venir</h3>
                {isLoadingTasks ? (
                  <div className="flex justify-center items-center h-24">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : tasks.length > 0 ? (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                    {tasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Checkbox id={task.id} onCheckedChange={() => handleToggleTask(task)} />
                          <label htmlFor={task.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {task.text}
                          </label>
                        </div>
                        {task.dueDate && (
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                            {format(task.dueDate, "d MMM", { locale: fr })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune tâche pour le moment.</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* NOTEPAD TAB */}
          <TabsContent value="notepad" className="pt-4">
            <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-2">
                    <CardDescription>
                        {lastSaved && `Dernière sauvegarde: ${lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                    </CardDescription>
                    <Button onClick={handleSaveNote} disabled={isSavingNote} size="sm" variant="ghost">
                        {isSavingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder"}
                    </Button>
                </div>
                {isLoadingNote ? (
                    <div className="flex justify-center items-center flex-grow">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <Textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Écrivez vos notes ici..."
                        className="min-h-[300px] h-full text-sm bg-card-foreground/5 dark:bg-card-foreground/5"
                    />
                )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
