
"use client";

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ManageTasks from './components/manage-tasks';
import type { Task, TaskStatus, StatusLogEntry } from './types';
import { TASK_STATUSES } from './types';
import React, { useState, useEffect, useCallback } from 'react';
import { CurrentDate } from '@/components/current-date';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { firestore } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
  // serverTimestamp, // Not strictly necessary if we set updatedAt client-side before save
} from 'firebase/firestore';

// Removed TASK_STORAGE_KEY as data will come from Firestore

export default function TaskManagementPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!isClient) return;
    setIsLoading(true);
    try {
      const tasksCollectionRef = collection(firestore, 'taskManagementTasks');
      const q = query(tasksCollectionRef, orderBy('updatedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const tasksList = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(data.createdAt),
          updatedAt: (data.updatedAt as Timestamp)?.toDate ? (data.updatedAt as Timestamp).toDate() : new Date(data.updatedAt),
          appointmentDate: data.appointmentDate && (data.appointmentDate as Timestamp)?.toDate ? (data.appointmentDate as Timestamp).toDate() : null,
          statusHistory: (data.statusHistory || []).map((log: any) => ({
            ...log,
            date: (log.date as Timestamp)?.toDate ? (log.date as Timestamp).toDate() : new Date(log.date),
          })),
        } as Task;
      });
      setTasks(tasksList);
      console.log("Tasks fetched from Firestore:", tasksList.length);
    } catch (e) {
      console.error("Error fetching tasks from Firestore:", e);
      setTasks([]);
      toast({ title: "Erreur de chargement des tâches", description: "Les tâches n'ont pu être chargées depuis la base de données.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient) {
      fetchTasks();
    }
  }, [isClient, fetchTasks]);

  const handleAddTask = useCallback(async (taskData: { title: string; description: string }) => {
    if (!isClient) return;
    const now = new Date();
    const newTaskFirestoreData = {
      ...taskData,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      currentStatus: 'mr_dufay_prevenue' as TaskStatus,
      statusHistory: [{ status: 'mr_dufay_prevenue' as TaskStatus, date: Timestamp.fromDate(now), notes: 'Tâche créée.' }],
      appointmentDate: null,
    };
    try {
      await addDoc(collection(firestore, 'taskManagementTasks'), newTaskFirestoreData);
      fetchTasks();
      window.dispatchEvent(new CustomEvent('taskManagementTasksUpdated'));
      toast({ title: "Tâche Ajoutée", description: `La tâche "${taskData.title}" a été créée.` });
    } catch (e) {
      console.error("Error adding task to Firestore:", e);
      toast({ title: "Erreur d'ajout de tâche", variant: "destructive" });
    }
  }, [isClient, toast, fetchTasks]);

  const handleUpdateTask = useCallback(async (taskId: string, taskData: { title: string; description: string }) => {
    if (!isClient) return;
    const taskDocRef = doc(firestore, 'taskManagementTasks', taskId);
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    const dataToSave = {
      title: taskData.title,
      description: taskData.description,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    try {
      await setDoc(taskDocRef, dataToSave, { merge: true }); // Use merge:true to only update specified fields
      fetchTasks();
      window.dispatchEvent(new CustomEvent('taskManagementTasksUpdated'));
      toast({ title: "Tâche Modifiée", description: "Les détails de la tâche ont été mis à jour." });
    } catch (e) {
      console.error("Error updating task in Firestore:", e);
      toast({ title: "Erreur de modification de tâche", variant: "destructive" });
    }
  }, [isClient, tasks, toast, fetchTasks]);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    if (!isClient) return;
    const taskTitle = tasks.find(t => t.id === taskId)?.title || "La tâche";
    try {
      await deleteDoc(doc(firestore, 'taskManagementTasks', taskId));
      fetchTasks();
      window.dispatchEvent(new CustomEvent('taskManagementTasksUpdated'));
      toast({ title: "Tâche Supprimée", description: `La tâche "${taskTitle}" a été supprimée.`, variant: "destructive" });
    } catch (e) {
      console.error("Error deleting task from Firestore:", e);
      toast({ title: "Erreur de suppression de tâche", variant: "destructive" });
    }
  }, [isClient, tasks, toast, fetchTasks]);

  const handleUpdateTaskStatus = useCallback(async (
    taskId: string,
    statusData: { newStatus: TaskStatus; appointmentDate?: Date | null; notes?: string }
  ) => {
    if (!isClient) return;
    const taskDocRef = doc(firestore, 'taskManagementTasks', taskId);
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    const newStatusEntry: Omit<StatusLogEntry, 'date'> & { date: Timestamp } = {
      status: statusData.newStatus,
      date: Timestamp.fromDate(new Date()),
      notes: statusData.notes,
    };

    const updatedStatusHistory = [...taskToUpdate.statusHistory.map(log => ({...log, date: Timestamp.fromDate(new Date(log.date))})), newStatusEntry];

    const dataToSave = {
      currentStatus: statusData.newStatus,
      appointmentDate: statusData.newStatus === 'rendez_vous' && statusData.appointmentDate ? Timestamp.fromDate(statusData.appointmentDate) : null,
      statusHistory: updatedStatusHistory,
      updatedAt: Timestamp.fromDate(new Date()),
    };

    try {
      await setDoc(taskDocRef, dataToSave, { merge: true }); // Use merge:true
      fetchTasks();
      window.dispatchEvent(new CustomEvent('taskManagementTasksUpdated'));
      toast({ title: "Statut Mis à Jour", description: `Le statut de "${taskToUpdate.title}" est maintenant "${statusData.newStatus}".` });
    } catch (e) {
      console.error("Error updating task status in Firestore:", e);
      toast({ title: "Erreur de mise à jour du statut", variant: "destructive" });
    }
  }, [isClient, tasks, toast, fetchTasks]);


  if (!isClient || isLoading) {
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
