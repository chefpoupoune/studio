
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CalendarCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const TASKS_COLLECTION = "chefTasks";

interface Task {
  id: string;
  text: string;
  completed: boolean;
  endDate?: Date; // Optional endDate
}

export default function DailyPlanningSummary() {
  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const handleCompleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(firestore, TASKS_COLLECTION, taskId));
      toast({ title: "Tâche accomplie !", description: "La tâche a été marquée comme terminée et supprimée du planning." });
    } catch (error) {
      console.error("Error completing task:", error);
      toast({ title: "Erreur", description: "Impossible de terminer la tâche.", variant: "destructive" });
    }
  };

  const loadDailyTasks = useCallback(() => {
    const today = new Date();
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const q = query(
      collection(firestore, TASKS_COLLECTION),
      where("startDate", "<=", Timestamp.fromDate(endOfToday)),
      orderBy("startDate", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const todayDate = new Date(new Date().setHours(0, 0, 0, 0));

      const fetchedTasks: Task[] = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text,
            completed: data.completed,
            startDate: data.startDate?.toDate(),
            endDate: data.endDate?.toDate(),
          };
        })
        .filter(task => {
          if (!task.startDate || !task.endDate || task.completed) {
            return false;
          }
          const taskEndDate = new Date(task.endDate);
          taskEndDate.setHours(0, 0, 0, 0);
          return todayDate <= taskEndDate;
        });

      setDailyTasks(fetchedTasks);
      setIsLoading(false);
    }, (error) => {
      console.error("Error loading daily tasks:", error);
      toast({ title: "Erreur", description: "Impossible de charger le planning.", variant: "destructive" });
      setIsLoading(false);
    });

    return unsubscribe;
  }, [toast]);


  useEffect(() => {
    const unsubscribe = loadDailyTasks();
    return () => unsubscribe();
  }, [loadDailyTasks]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-primary" />
            <CardTitle className="text-xl">Planning du Jour</CardTitle>
        </div>
        <CardDescription>{format(new Date(), "eeee d MMMM yyyy", { locale: fr })}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : dailyTasks.length > 0 ? (
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
            {dailyTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                 <div className="flex items-center gap-3">
                   <Checkbox id={task.id} onCheckedChange={() => handleCompleteTask(task.id)} />
                   <label htmlFor={task.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                     {task.text}
                   </label>
                 </div>
                 {task.endDate && (
                   <span className="text-xs text-muted-foreground font-medium">
                     {format(task.endDate, "d MMMM", { locale: fr })}
                   </span>
                 )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune tâche de planning pour aujourd'hui.</p>
        )}
      </CardContent>
    </Card>
  );
}
