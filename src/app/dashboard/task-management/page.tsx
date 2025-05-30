
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
  serverTimestamp,
} from 'firebase/firestore';

// Removed initialTasks as data will come from Firestore

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
      setTasks([]); // Fallback to empty or handle differently
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
    const newTask FirestoreData = {
      ...taskData,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      currentStatus: 'mr_dufay_prevenue' as TaskStatus,
      statusHistory: [{ status: 'mr_dufay_prevenue' as TaskStatus, date: Timestamp.fromDate(now), notes: 'Tâche créée.' }],
      appointmentDate: null,
    };
    try {
      const docRef = await addDoc(collection(firestore, 'taskManagementTasks'), newTaskFirestoreData);
      // Optimistically update UI or re-fetch
      // For simplicity, re-fetch after add
      fetchTasks();
      window.dispatchEvent(new CustomEvent('taskManagementTasksUpdated'));
      toast({ title: "Tâche Ajoutée", description: `La tâche "${taskData.title}" a été créée dans Firestore.` });
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

    const updatedData = {
      ...taskToUpdate, // Keep existing fields not being edited
      title: taskData.title,
      description: taskData.description,
      updatedAt: Timestamp.fromDate(new Date()),
      // Convert existing dates back to Timestamps if necessary, but setDoc should handle it
      createdAt: Timestamp.fromDate(new Date(taskToUpdate.createdAt)),
      appointmentDate: taskToUpdate.appointmentDate ? Timestamp.fromDate(new Date(taskToUpdate.appointmentDate)) : null,
      statusHistory: taskToUpdate.statusHistory.map(log => ({
        ...log,
        date: Timestamp.fromDate(new Date(log.date)),
      })),
    };
    // Remove id from data to save as it's the document ID
    const { id, ...dataToSave } = updatedData;


    try {
      await setDoc(taskDocRef, dataToSave);
      fetchTasks();
      window.dispatchEvent(new CustomEvent('taskManagementTasksUpdated'));
      toast({ title: "Tâche Modifiée", description: "Les détails de la tâche ont été mis à jour dans Firestore." });
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
      toast({ title: "Tâche Supprimée", description: `La tâche "${taskTitle}" a été supprimée de Firestore.`, variant: "destructive" });
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

    const updatedData = {
      ...taskToUpdate,
      currentStatus: statusData.newStatus,
      appointmentDate: statusData.newStatus === 'rendez_vous' && statusData.appointmentDate ? Timestamp.fromDate(statusData.appointmentDate) : null,
      statusHistory: [...taskToUpdate.statusHistory.map(log => ({...log, date: Timestamp.fromDate(new Date(log.date))})), newStatusEntry],
      updatedAt: Timestamp.fromDate(new Date()),
      createdAt: Timestamp.fromDate(new Date(taskToUpdate.createdAt)), // Ensure createdAt remains a Timestamp
    };
     // Remove id from data to save as it's the document ID
    const { id, ...dataToSave } = updatedData;

    try {
      await setDoc(taskDocRef, dataToSave);
      fetchTasks();
      window.dispatchEvent(new CustomEvent('taskManagementTasksUpdated'));
      toast({ title: "Statut Mis à Jour", description: `Le statut de "${taskToUpdate.title}" est maintenant "${statusData.newStatus}" dans Firestore.` });
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
