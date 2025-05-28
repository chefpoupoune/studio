
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList, AlertCircle, MessageSquare } from "lucide-react"; // Added MessageSquare
import { Badge } from "@/components/ui/badge";
import type { Task, TaskStatus, StatusLogEntry } from '@/app/dashboard/task-management/types';
import { taskStatusLabels } from '@/app/dashboard/task-management/types';
import { ScrollArea } from '@/components/ui/scroll-area'; // Added ScrollArea

const TASK_STORAGE_KEY = 'task_management_tasks';

export default function OngoingTasksSummary() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        const storedTasks = localStorage.getItem(TASK_STORAGE_KEY);
        if (storedTasks) {
          const parsedTasks: Task[] = JSON.parse(storedTasks).map((task: any) => ({
            ...task,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
            appointmentDate: task.appointmentDate ? new Date(task.appointmentDate) : null,
            statusHistory: (Array.isArray(task.statusHistory) ? task.statusHistory : []).map((log: any) => ({
              ...log,
              date: new Date(log.date),
            })),
          }));
          setAllTasks(parsedTasks);
        } else {
          setAllTasks([]);
        }
      } catch (e) {
        console.error("Error loading tasks from localStorage for summary:", e);
        setAllTasks([]);
      }
    }
  }, [isClient]);

  const ongoingTasks = useMemo(() => {
    return allTasks.filter(task => !['termine', 'annule'].includes(task.currentStatus))
                   .sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [allTasks]);

  const activeTasksCount = useMemo(() => { // Renamed from highPriorityTasksCount for clarity
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


  if (!isClient) {
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
                <p className="text-sm text-muted-foreground">Chargement...</p>
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
          Suivi rapide des problèmes et tâches actives.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        {ongoingTasks.length > 0 ? (
          <ScrollArea className="h-[220px] sm:h-[240px] pr-3">
            <ul className="space-y-2.5">
              {ongoingTasks.slice(0, 4).map((task) => {
                const lastStatusEntry = task.statusHistory.length > 0 ? task.statusHistory[task.statusHistory.length - 1] : null;
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
                    {task.currentStatus === 'rendez_vous' && task.appointmentDate && (
                       <p className="text-xs text-primary/80 mt-1">
                         RDV: {new Date(task.appointmentDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                       </p>
                    )}
                  </li>
                );
              })}
              {ongoingTasks.length > 4 && <li className="text-xs text-muted-foreground text-center pt-1">... et {ongoingTasks.length - 4} autre(s).</li>}
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
