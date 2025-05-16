
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Task, TaskStatus } from '@/app/dashboard/task-management/types'; // Ensure Task type is imported
import { taskStatusLabels } from '@/app/dashboard/task-management/types';

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
            statusHistory: task.statusHistory.map((log: any) => ({
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
    return allTasks.filter(task => !['termine', 'annule'].includes(task.currentStatus));
  }, [allTasks]);

  const highPriorityTasksCount = useMemo(() => {
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
    // Or a more specific loader for this component
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
          {highPriorityTasksCount > 0 && (
             <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5"/> {highPriorityTasksCount} Active(s)
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Suivi rapide des problèmes et tâches actives.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        {ongoingTasks.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {ongoingTasks.slice(0, 4).map((task) => ( 
              <li key={task.id} className="flex justify-between items-center">
                <span className="truncate pr-2" title={task.title}>{task.title}</span>
                <Badge 
                    variant={getStatusBadgeVariant(task.currentStatus)} 
                    className="text-xs whitespace-nowrap"
                >
                  {taskStatusLabels[task.currentStatus] || task.currentStatus}
                </Badge>
              </li>
            ))}
             {ongoingTasks.length > 4 && <li className="text-xs text-muted-foreground text-center pt-1">... et {ongoingTasks.length - 4} autre(s).</li>}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune tâche en cours actuellement.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
