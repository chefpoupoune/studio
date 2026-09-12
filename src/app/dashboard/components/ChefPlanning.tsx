
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Calendar as CalendarIcon, PlusCircle, Pencil, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { firestore } from '@/lib/firebase';
import { collection, addDoc, query, getDocs, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore';
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

const TASKS_COLLECTION = "chefTasks";

interface Task {
  id: string;
  text: string;
  startDate: Date | null;
  endDate: Date | null;
  completed: boolean;
}

export default function ChefPlanning() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskDateRange, setNewTaskDateRange] = useState<DateRange | undefined>(undefined);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const { toast } = useToast();

  // State for inline editing
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const [editingTaskDateRange, setEditingTaskDateRange] = useState<DateRange | undefined>(undefined);

  const loadTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    const q = query(collection(firestore, TASKS_COLLECTION));
    try {
      const querySnapshot = await getDocs(q);
      let fetchedTasks: Task[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const startDate = data.startDate?.toDate() ?? data.dueDate?.toDate() ?? null;
        const endDate = data.endDate?.toDate() ?? data.dueDate?.toDate() ?? null;
        return {
          id: doc.id,
          text: data.text,
          startDate: startDate,
          endDate: endDate,
          completed: data.completed,
        };
      });

      fetchedTasks.sort((a, b) => {
        if (a.startDate && b.startDate) return a.startDate.getTime() - b.startDate.getTime();
        if (a.startDate) return -1;
        if (b.startDate) return 1;
        return 0;
      });

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
        startDate: newTaskDateRange?.from ? Timestamp.fromDate(newTaskDateRange.from) : null,
        endDate: newTaskDateRange?.to ? Timestamp.fromDate(newTaskDateRange.to) : (newTaskDateRange?.from ? Timestamp.fromDate(newTaskDateRange.from) : null),
        completed: false,
        createdAt: Timestamp.now(),
      });
      setNewTaskText("");
      setNewTaskDateRange(undefined);
      toast({ title: "Tâche ajoutée avec succès" });
      loadTasks();
    } catch (error) {
      console.error("Error adding task:", error);
      toast({ title: "Erreur lors de l'ajout de la tâche", variant: "destructive" });
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      await deleteDoc(doc(firestore, TASKS_COLLECTION, task.id));
      toast({ title: "Tâche terminée et archivée!" });
      loadTasks();
    } catch (error) {
      console.error("Error toggling task:", error);
      toast({ title: "Erreur lors de la mise à jour de la tâche", variant: "destructive" });
    }
  };

  const handleEnterEditMode = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTaskText(task.text);
    setEditingTaskDateRange({ from: task.startDate || undefined, to: task.endDate || undefined });
  };

  const handleCancelEditMode = () => {
    setEditingTaskId(null);
    setEditingTaskText("");
    setEditingTaskDateRange(undefined);
  };

  const handleUpdateTask = async () => {
    if (!editingTaskId || !editingTaskText.trim()) return;
    
    const taskRef = doc(firestore, TASKS_COLLECTION, editingTaskId);
    try {
      await updateDoc(taskRef, {
        text: editingTaskText,
        startDate: editingTaskDateRange?.from ? Timestamp.fromDate(editingTaskDateRange.from) : null,
        endDate: editingTaskDateRange?.to ? Timestamp.fromDate(editingTaskDateRange.to) : (editingTaskDateRange?.from ? Timestamp.fromDate(editingTaskDateRange.from) : null),
      });
      toast({ title: "Tâche mise à jour" });
      handleCancelEditMode();
      loadTasks();
    } catch (error) {
      console.error("Error updating task:", error);
      toast({ title: "Erreur de mise à jour", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return (
    <Card className="shadow-lg flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-xl">Planning & Tâches</CardTitle>
        <CardDescription>Planifiez vos tâches et suivez les échéances.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Input 
            placeholder="Nouvelle tâche ou rappel..." 
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="w-[300px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {newTaskDateRange?.from ? (
                  newTaskDateRange.to ? (
                    <>
                      {format(newTaskDateRange.from, "PPP", { locale: fr })} - {format(newTaskDateRange.to, "PPP", { locale: fr })}
                    </>
                  ) : (
                    format(newTaskDateRange.from, "PPP", { locale: fr })
                  )
                ) : (
                  <span>Pas d'échéance</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                locale={fr}
                mode="range"
                selected={newTaskDateRange}
                onSelect={setNewTaskDateRange}
                initialFocus
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
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {tasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                  {editingTaskId === task.id ? (
                    // ---- EDITING VIEW ----
                    <div className="flex-grow flex items-center gap-2">
                        <Input value={editingTaskText} onChange={(e) => setEditingTaskText(e.target.value)} className="flex-grow"/>
                        <Popover>
                          <PopoverTrigger asChild>
                              <Button variant="outline" size="icon"><CalendarIcon className="h-4 w-4"/></Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                              <Calendar locale={fr} mode="range" selected={editingTaskDateRange} onSelect={setEditingTaskDateRange} initialFocus/>
                          </PopoverContent>
                        </Popover>
                        <Button size="icon" onClick={handleUpdateTask}><Check className="h-4 w-4 text-green-500"/></Button>
                        <Button size="icon" variant="ghost" onClick={handleCancelEditMode}><X className="h-4 w-4 text-red-500"/></Button>
                    </div>
                  ) : (
                    // ---- DISPLAY VIEW ----
                    <>
                      <div className="flex items-center gap-3 flex-grow">
                        <Checkbox id={task.id} onCheckedChange={() => handleToggleTask(task)} />
                        <label htmlFor={task.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {task.text}
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.startDate && (
                          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded whitespace-nowrap">
                            {format(task.startDate, "d MMM", { locale: fr })}
                            {task.endDate && format(task.startDate, 'yyyy-MM-dd') !== format(task.endDate, 'yyyy-MM-dd') ? ` - ${format(task.endDate, "d MMM", { locale: fr })}` : ''}
                          </span>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEnterEditMode(task)}>
                            <Pencil className="h-4 w-4 text-muted-foreground"/>
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune tâche pour le moment.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
