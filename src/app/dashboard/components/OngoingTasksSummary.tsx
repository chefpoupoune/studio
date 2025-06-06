
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList, AlertCircle, MessageSquare, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Task, TaskStatus } from '@/app/dashboard/task-management/types';
import { taskStatusLabels } from '@/app/dashboard/task-management/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { firestore } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, isValid, parseISO } from 'date-fns'; 
import { fr } from 'date-fns/locale'; 

export default function OngoingTasksSummary() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchOngoingTasks = useCallback(async () => {
    if (!isClient) return;
    console.log("OngoingTasksSummary: Attempting to fetch tasks...");
    setIsLoading(true);
    try {
      const tasksCollectionRef = collection(firestore, 'taskManagementTasks');
      const q = query(
        tasksCollectionRef,
        orderBy('updatedAt', 'desc'),
        limit(30) // Fetch 30 most recently updated tasks
      );
      const querySnapshot = await getDocs(q);
      let mappedTasks: Task[] = [];

      querySnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        try {
          const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date());
          const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date());
          const appointmentDate = data.appointmentDate instanceof Timestamp 
            ? data.appointmentDate.toDate() 
            : (data.appointmentDate && typeof data.appointmentDate === 'string' && isValid(parseISO(data.appointmentDate))) 
              ? parseISO(data.appointmentDate) 
              : data.appointmentDate && typeof data.appointmentDate.seconds === 'number' // Handle Firestore Timestamp-like objects
                ? new Date(data.appointmentDate.seconds * 1000)
                : null;
          
          const statusHistory = (data.statusHistory || []).map((log: any) => ({
            status: log.status || 'en_cours', // Default status if missing
            date: log.date instanceof Timestamp 
              ? log.date.toDate() 
              : (log.date && typeof log.date.seconds === 'number') 
                ? new Date(log.date.seconds * 1000) 
                : (log.date ? new Date(log.date) : new Date()),
            notes: log.notes || undefined,
          }));

          mappedTasks.push({
            id: docSnap.id,
            title: data.title || "Titre Manquant",
            description: data.description || "Description Manquante",
            createdAt,
            updatedAt,
            currentStatus: (data.currentStatus as TaskStatus) || 'en_cours',
            statusHistory,
            appointmentDate,
          } as Task);
        } catch (mapError: any) {
          console.error(`OngoingTasksSummary: Error mapping document ${docSnap.id}. Data:`, data, 'Error:', mapError.message, mapError.stack);
          toast({ title: `Erreur Traitement Tâche ${docSnap.id}`, description: `Impossible de traiter une tâche. Détails: ${mapError.message}`, variant: "destructive" });
          // Continue with other tasks
        }
      });
      
      // Client-side filter for ongoing tasks
      const ongoingTasksList = mappedTasks.filter(task => !['termine', 'annule'].includes(task.currentStatus));
      
      setAllTasks(ongoingTasksList);
      console.log("OngoingTasksSummary: Tasks fetched and filtered successfully:", ongoingTasksList.length);
    } catch (e: any) {
      console.error("OngoingTasksSummary: Error loading tasks from Firestore:", e.message, e.stack, e);
      setAllTasks([]);
      toast({ title: "Erreur chargement Tâches (Résumé)", description: `${e.message || 'Détails dans la console.'} Code: ${e.code || 'N/A'}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient) {
      fetchOngoingTasks(); 

      const handleTasksUpdated = () => {
        console.log("OngoingTasksSummary: taskManagementTasksUpdated event received. Re-fetching tasks.");
        fetchOngoingTasks();
      };
      window.addEventListener('taskManagementTasksUpdated', handleTasksUpdated);
      
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log("OngoingTasksSummary: Tab became visible, re-fetching tasks.");
          fetchOngoingTasks();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('taskManagementTasksUpdated', handleTasksUpdated);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isClient, fetchOngoingTasks]);

  const ongoingTasks = allTasks; 

  const activeTasksCount = useMemo(() => {
    return ongoingTasks.filter(task => ['en_cours', 'rendez_vous', 'mr_dufay_prevenue', 'devis_fait', 'devis_envoye', 'devis_signature'].includes(task.currentStatus)).length;
  }, [ongoingTasks]);
  
  const getStatusBadgeVariant = (status: TaskStatus): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" => {
    switch (status) {
      case 'termine': return 'success';
      case 'annule': return 'destructive';
      case 'en_cours': return 'warning';
      case 'rendez_vous': return 'info';
      case 'mr_dufay_prevenue':
      case 'devis_fait':
      case 'devis_envoye':
      case 'devis_signature':
        return 'secondary';
      default: return 'outline';
    }
  };

  if (!isClient || isLoading) {
    return (
        <Card className="shadow-lg h-full flex flex-col">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    Tâches en Cours
                </CardTitle>
                </div>
                <CardDescription className="text-xs">
                Chargement du suivi des tâches...
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow pt-2 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Tâches en Cours
          </CardTitle>
          {activeTasksCount > 0 && (
             <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5"/> {activeTasksCount} Active(s)
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Suivi rapide des problèmes et tâches actives. (Max. 5 affichées)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        {ongoingTasks.length > 0 ? (
          <ScrollArea className="h-[220px] sm:h-[240px] pr-3">
            <ul className="space-y-2.5">
              {ongoingTasks.slice(0, 5).map((task) => { 
                // Get the last entry from statusHistory, if available
                const lastStatusEntry = task.statusHistory && task.statusHistory.length > 0 
                  ? task.statusHistory[task.statusHistory.length - 1] 
                  : null;
                const lastNotes = lastStatusEntry?.notes;
                return (
                  <li key={task.id} className="p-2 border rounded-md bg-card/60 hover:bg-muted/30 text-sm">
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="font-medium truncate pr-2" title={task.title}>{task.title}</span>
                      <Badge 
                          variant={getStatusBadgeVariant(task.currentStatus)} 
                          className="text-xs whitespace-nowrap"
                      >
                        {taskStatusLabels[task.currentStatus] || task.currentStatus}
                      </Badge>
                    </div>
                    {lastNotes && (
                      <div className="mt-1 text-xs text-muted-foreground/90 flex items-start gap-1">
                        <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <p className="truncate" title={lastNotes}>
                          Obs: {lastNotes}
                        </p>
                      </div>
                    )}
                    {task.currentStatus === 'rendez_vous' && task.appointmentDate && isValid(new Date(task.appointmentDate)) && (
                       <p className="text-xs text-primary/80 mt-1">
                         RDV: {format(new Date(task.appointmentDate), "dd/MM/yyyy", { locale: fr })}
                       </p>
                    )}
                  </li>
                );
              })}
              {ongoingTasks.length > 5 && <li className="text-xs text-muted-foreground text-center pt-1">... et {ongoingTasks.length - 5} autre(s).</li>}
            </ul>
          </ScrollArea>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4 h-full flex flex-col items-center justify-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground/70 mb-2"/>
            <p>Aucune tâche en cours actuellement.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

