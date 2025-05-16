
"use client";

import React, { useState, useCallback } from 'react';
import type { Task, TaskStatus, StatusLogEntry } from '../types';
import { TASK_STATUSES, taskStatusLabels } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { PlusCircle, Edit2, Trash2, History, CalendarIcon as LucideCalendarIcon, ListFilter } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const taskFormSchema = z.object({
  title: z.string().min(1, "Le titre est requis.").max(100, "Le titre ne peut excéder 100 caractères."),
  description: z.string().min(1, "La description est requise.").max(1000, "La description ne peut excéder 1000 caractères."),
});
type TaskFormData = z.infer<typeof taskFormSchema>;

const statusUpdateSchema = z.object({
  newStatus: z.custom<TaskStatus>((val) => TASK_STATUSES.includes(val as TaskStatus), "Statut invalide."),
  appointmentDate: z.date().optional().nullable(),
  notes: z.string().max(500, "Les notes ne peuvent excéder 500 caractères.").optional(),
}).refine(data => {
  if (data.newStatus === 'rendez_vous' && !data.appointmentDate) {
    return false;
  }
  return true;
}, {
  message: "La date de rendez-vous est requise pour le statut 'Rendez-vous'.",
  path: ['appointmentDate'],
});
type StatusUpdateFormData = z.infer<typeof statusUpdateSchema>;

interface ManageTasksProps {
  tasks: Task[];
  onAddTask: (taskData: TaskFormData) => void;
  onUpdateTask: (taskId: string, taskData: TaskFormData) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskStatus: (taskId: string, statusData: StatusUpdateFormData) => void;
}

export default function ManageTasks({ tasks, onAddTask, onUpdateTask, onDeleteTask, onUpdateTaskStatus }: ManageTasksProps) {
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isStatusUpdateOpen, setIsStatusUpdateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForStatusUpdate, setTaskForStatusUpdate] = useState<Task | null>(null);
  const [taskForHistory, setTaskForHistory] = useState<Task | null>(null);

  const { toast } = useToast();

  const taskForm = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { title: '', description: '' },
  });

  const statusUpdateForm = useForm<StatusUpdateFormData>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: { newStatus: TASK_STATUSES[0], appointmentDate: null, notes: '' },
  });

  const handleOpenTaskForm = (task?: Task) => {
    setEditingTask(task || null);
    if (task) {
      taskForm.reset({ title: task.title, description: task.description });
    } else {
      taskForm.reset({ title: '', description: '' });
    }
    setIsTaskFormOpen(true);
  };

  const handleTaskFormSubmit = (data: TaskFormData) => {
    if (editingTask) {
      onUpdateTask(editingTask.id, data);
    } else {
      onAddTask(data);
    }
    setIsTaskFormOpen(false);
  };

  const handleOpenStatusUpdate = (task: Task) => {
    setTaskForStatusUpdate(task);
    statusUpdateForm.reset({
      newStatus: task.currentStatus,
      appointmentDate: task.appointmentDate ? new Date(task.appointmentDate) : null,
      notes: '',
    });
    setIsStatusUpdateOpen(true);
  };

  const handleStatusUpdateSubmit = (data: StatusUpdateFormData) => {
    if (taskForStatusUpdate) {
      onUpdateTaskStatus(taskForStatusUpdate.id, data);
    }
    setIsStatusUpdateOpen(false);
  };
  
  const handleOpenHistory = (task: Task) => {
    setTaskForHistory(task);
    setIsHistoryOpen(true);
  };
  
  const getStatusBadgeVariant = (status: TaskStatus) => {
    switch (status) {
      case 'termine': return 'default'; 
      case 'annule': return 'destructive';
      case 'en_cours': return 'secondary'; 
      case 'rendez_vous': return 'outline'; 
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogTrigger asChild>
          <Button onClick={() => handleOpenTaskForm()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une Tâche/Problème
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Modifier la Tâche' : 'Nouvelle Tâche/Problème'}</DialogTitle>
          </DialogHeader>
          <Form {...taskForm}>
            <form onSubmit={taskForm.handleSubmit(handleTaskFormSubmit)} className="space-y-4 py-4">
              <FormField control={taskForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre</FormLabel>
                  <FormControl><Input placeholder="Ex: Réparation fuite évier cuisine" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={taskForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea placeholder="Détails de la tâche ou du problème..." {...field} rows={4} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                <Button type="submit">{editingTask ? 'Enregistrer' : 'Ajouter'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusUpdateOpen} onOpenChange={setIsStatusUpdateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mettre à jour le Statut</DialogTitle>
            <CardDescription>Pour: {taskForStatusUpdate?.title}</CardDescription>
          </DialogHeader>
          <Form {...statusUpdateForm}>
            <form onSubmit={statusUpdateForm.handleSubmit(handleStatusUpdateSubmit)} className="space-y-4 py-4">
              <FormField control={statusUpdateForm.control} name="newStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nouveau Statut</FormLabel>
                  <Select onValueChange={(value) => {
                      field.onChange(value as TaskStatus);
                      if (value !== 'rendez_vous') {
                        statusUpdateForm.setValue('appointmentDate', null);
                      }
                    }} 
                    defaultValue={field.value}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Choisir un statut" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {TASK_STATUSES.map(status => (
                        <SelectItem key={status} value={status}>{taskStatusLabels[status]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {statusUpdateForm.watch('newStatus') === 'rendez_vous' && (
                <FormField control={statusUpdateForm.control} name="appointmentDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date du Rendez-vous</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(new Date(field.value), "PPP", { locale: fr }) : <span>Choisir une date</span>}
                            <LucideCalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value ? new Date(field.value) : undefined} onSelect={field.onChange} initialFocus locale={fr} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={statusUpdateForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optionnel)</FormLabel>
                  <FormControl><Textarea placeholder="Ajouter des notes sur ce changement de statut..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                <Button type="submit">Mettre à jour Statut</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

       <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Historique pour: {taskForHistory?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4 my-4">
            {taskForHistory && taskForHistory.statusHistory.length > 0 ? (
              <ul className="space-y-4">
                {taskForHistory.statusHistory.slice().reverse().map((log, index) => ( 
                  <li key={index} className="p-3 border rounded-md bg-muted/50">
                    <p className="font-semibold">{taskStatusLabels[log.status]}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.date), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                    {log.notes && <p className="text-sm mt-1 italic">Notes: {log.notes}</p>}
                     {log.status === 'rendez_vous' && taskForHistory.appointmentDate && index === 0 && ( 
                        <p className="text-sm mt-1">
                            Date RDV: {format(new Date(taskForHistory.appointmentDate), "dd MMMM yyyy", { locale: fr })}
                        </p>
                     )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucun historique pour cette tâche.</p>
            )}
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Fermer</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {tasks.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">Aucune tâche ou problème enregistré. Commencez par en ajouter.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map(task => (
            <Card key={task.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl mb-1">{task.title}</CardTitle>
                   <Badge variant={getStatusBadgeVariant(task.currentStatus)} className="ml-auto whitespace-nowrap">
                    {taskStatusLabels[task.currentStatus]}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Créé le: {format(new Date(task.createdAt), "dd/MM/yy HH:mm", { locale: fr })} | 
                  Modifié le: {format(new Date(task.updatedAt), "dd/MM/yy HH:mm", { locale: fr })}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-3">
                <ScrollArea className="h-[100px] pr-3">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                </ScrollArea>
                {task.currentStatus === 'rendez_vous' && task.appointmentDate && (
                  <p className="text-sm font-semibold text-primary">
                    Rendez-vous le: {format(new Date(task.appointmentDate), "dd MMMM yyyy", { locale: fr })}
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 justify-end pt-4 border-t">
                <Button variant="ghost" size="sm" onClick={() => handleOpenHistory(task)} title="Voir l'historique">
                  <History className="h-4 w-4" /> <span className="sr-only sm:not-sr-only sm:ml-1">Historique</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenStatusUpdate(task)} title="Mettre à jour le statut">
                  <ListFilter className="h-4 w-4" /> <span className="sr-only sm:not-sr-only sm:ml-1">Statut</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenTaskForm(task)} title="Modifier">
                  <Edit2 className="h-4 w-4" /> <span className="sr-only sm:not-sr-only sm:ml-1">Modifier</span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" title="Supprimer">
                      <Trash2 className="h-4 w-4" /> <span className="sr-only sm:not-sr-only sm:ml-1">Supprimer</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer cette tâche ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. La tâche "{task.title}" et son historique seront supprimés.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDeleteTask(task.id)}>
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
