
"use client";

import Link from 'next/link';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ManageTasks from './components/manage-tasks';
import type { Task, TaskStatus, StatusLogEntry } from './types';
import { TASK_STATUSES } from './types';
import React, { useState, useEffect, useCallback } from 'react';
import { CurrentDate } from '@/components/current-date';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const initialTasks: Task[] = [
  {
    id: 'task_1',
    title: 'Vérification extincteurs',
    description: 'Contrôle annuel des extincteurs par la société SecuriFeu. Vérifier dates et plombs.',
    createdAt: new Date(new Date().setDate(new Date().getDate() - 10)),
    updatedAt: new Date(new Date().setDate(new Date().getDate() - 2)),
    currentStatus: 'en_cours',
    statusHistory: [
      { status: 'mr_dufay_prevenue', date: new Date(new Date().setDate(new Date().getDate() - 10)) },
      { status: 'devis_fait', date: new Date(new Date().setDate(new Date().getDate() - 8)) },
      { status: 'devis_envoye', date: new Date(new Date().setDate(new Date().getDate() - 7)) },
      { status: 'devis_signature', date: new Date(new Date().setDate(new Date().getDate() - 5)) },
      { status: 'en_cours', date: new Date(new Date().setDate(new Date().getDate() - 2)), notes: "Technicien sur place." },
    ],
    appointmentDate: null,
  },
  {
    id: 'task_2',
    title: 'Problème évacuation plonge',
    description: 'L\'eau s\'écoule mal au niveau de la plonge principale. Suspicions de bouchon.',
    createdAt: new Date(new Date().setDate(new Date().getDate() - 5)),
    updatedAt: new Date(new Date().setDate(new Date().getDate() - 1)),
    currentStatus: 'rendez_vous',
    statusHistory: [
      { status: 'mr_dufay_prevenue', date: new Date(new Date().setDate(new Date().getDate() - 5)), notes: 'Signalé par le chef de partie.' },
      { status: 'rendez_vous', date: new Date(new Date().setDate(new Date().getDate() - 1)), notes: 'Plombier vient demain matin.' },
    ],
    appointmentDate: new Date(new Date().setDate(new Date().getDate() + 1)),
  },
];

export default function TaskManagementPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        const storedTasks = localStorage.getItem('task_management_tasks');
        if (storedTasks) {
          const parsedTasks = JSON.parse(storedTasks).map((task: any) => ({
            ...task,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
            appointmentDate: task.appointmentDate ? new Date(task.appointmentDate) : null,
            statusHistory: task.statusHistory.map((log: any) => ({
              ...log,
              date: new Date(log.date),
            })),
          }));
          setTasks(parsedTasks);
        } else {
          setTasks(initialTasks); // Load initial if nothing in localStorage
        }
      } catch (e) {
        console.error("Error loading tasks from localStorage", e);
        localStorage.removeItem('task_management_tasks');
        setTasks(initialTasks);
        toast({ title: "Erreur de chargement", description: "Les données des tâches n'ont pu être chargées, réinitialisation aux valeurs par défaut.", variant: "destructive" });
      }
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('task_management_tasks', JSON.stringify(tasks));
    }
  }, [tasks, isClient]);

  const handleAddTask = useCallback((taskData: { title: string; description: string }) => {
    const newTask: Task = {
      id: `task_${Date.now()}`,
      ...taskData,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentStatus: 'mr_dufay_prevenue', // Default status
      statusHistory: [{ status: 'mr_dufay_prevenue', date: new Date(), notes: 'Tâche créée.' }],
      appointmentDate: null,
    };
    setTasks(prev => [newTask, ...prev].sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    toast({ title: "Tâche Ajoutée", description: `La tâche "${newTask.title}" a été créée.` });
  }, [toast]);

  const handleUpdateTask = useCallback((taskId: string, taskData: { title: string; description: string }) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, ...taskData, updatedAt: new Date() } 
        : task
    ).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    toast({ title: "Tâche Modifiée", description: "Les détails de la tâche ont été mis à jour." });
  }, [toast]);

  const handleDeleteTask = useCallback((taskId: string) => {
    const taskTitle = tasks.find(t => t.id === taskId)?.title || "La tâche";
    setTasks(prev => prev.filter(task => task.id !== taskId));
    toast({ title: "Tâche Supprimée", description: `La tâche "${taskTitle}" a été supprimée.`, variant: "destructive" });
  }, [tasks, toast]);

  const handleUpdateTaskStatus = useCallback((
    taskId: string, 
    statusData: { newStatus: TaskStatus; appointmentDate?: Date | null; notes?: string }
  ) => {
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        const newStatusEntry: StatusLogEntry = {
          status: statusData.newStatus,
          date: new Date(),
          notes: statusData.notes,
        };
        return {
          ...task,
          currentStatus: statusData.newStatus,
          appointmentDate: statusData.newStatus === 'rendez_vous' ? statusData.appointmentDate : null,
          statusHistory: [...task.statusHistory, newStatusEntry],
          updatedAt: new Date(),
        };
      }
      return task;
    }).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    
    const task = tasks.find(t => t.id === taskId);
    if (task) {
       toast({ title: "Statut Mis à Jour", description: `Le statut de "${task.title}" est maintenant "${statusData.newStatus}".` });
    }
  }, [tasks, toast]);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Chargement de la gestion des tâches...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
           <ClipboardList className="w-10 h-10 text-accent" />
           <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
             Gestion des Tâches & Problèmes
           </h1>
        </div>
        <Link href="/dashboard" passHref>
          <Button variant="outline" size="sm" className="group w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Retour au Tableau de Bord
          </Button>
        </Link>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Suivi des Évènements</CardTitle>
          <CardDescription>
            Ajoutez, modifiez, supprimez des tâches ou problèmes, et suivez leur avancement. 
            Les tâches sont triées par date de dernière modification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManageTasks
            tasks={tasks}
            onAddTask={handleAddTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskStatus={handleUpdateTaskStatus}
          />
        </CardContent>
      </Card>
    </div>
  );
}

