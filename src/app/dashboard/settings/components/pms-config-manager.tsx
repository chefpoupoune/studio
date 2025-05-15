
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { PmsZone, PmsTaskDefinition, PmsConfigurations } from '../types';
import { PMS_KITCHEN_CLEANING_KEY, PMS_RESTAURANT_CLEANING_KEY, PMS_TEMPERATURE_MONITORING_KEY, PMS_CONFIG_STORAGE_KEY } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Edit2, Trash2, ShieldAlert, ClipboardEdit, SprayCan, Sparkles, Thermometer } from 'lucide-react'; // Added Thermometer
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const zoneSchema = z.object({
  name: z.string().min(1, "Le nom de la zone/équipement est requis."),
});
type ZoneFormData = z.infer<typeof zoneSchema>;

const taskSchema = z.object({
  name: z.string().min(1, "Le nom de la tâche est requis."),
});
type TaskFormData = z.infer<typeof taskSchema>;

export default function PmsConfigManager() {
  const [pmsConfigs, setPmsConfigs] = useState<PmsConfigurations>({});
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  
  const [currentCategoryKey, setCurrentCategoryKey] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState<PmsZone | null>(null);
  const [currentZoneForTask, setCurrentZoneForTask] = useState<PmsZone | null>(null);
  const [editingTask, setEditingTask] = useState<PmsTaskDefinition | null>(null);

  const { toast } = useToast();

  const zoneForm = useForm<ZoneFormData>({ resolver: zodResolver(zoneSchema), defaultValues: { name: '' } });
  const taskForm = useForm<TaskFormData>({ resolver: zodResolver(taskSchema), defaultValues: { name: '' } });
  
  useEffect(() => {
    try {
      const storedData = localStorage.getItem(PMS_CONFIG_STORAGE_KEY);
      if (storedData) {
        setPmsConfigs(JSON.parse(storedData));
      } else {
        // Initialize with empty arrays for known keys
        setPmsConfigs({ 
            [PMS_KITCHEN_CLEANING_KEY]: [], 
            [PMS_RESTAURANT_CLEANING_KEY]: [],
            [PMS_TEMPERATURE_MONITORING_KEY]: [] 
        });
      }
    } catch (error) {
      console.error("Error loading PMS configs:", error);
      setPmsConfigs({ 
          [PMS_KITCHEN_CLEANING_KEY]: [], 
          [PMS_RESTAURANT_CLEANING_KEY]: [],
          [PMS_TEMPERATURE_MONITORING_KEY]: [] 
      });
      toast({ title: "Erreur de chargement", description: "Configurations PMS corrompues.", variant: "destructive" });
    }
  }, [toast]);

  const saveConfigs = useCallback((updatedConfigs: PmsConfigurations) => {
    setPmsConfigs(updatedConfigs);
    localStorage.setItem(PMS_CONFIG_STORAGE_KEY, JSON.stringify(updatedConfigs));
  }, []);

  // Zone Handlers
  const handleOpenZoneDialog = (categoryKey: string, zone?: PmsZone) => {
    setCurrentCategoryKey(categoryKey);
    setEditingZone(zone || null);
    zoneForm.reset(zone ? { name: zone.name } : { name: '' });
    setIsZoneDialogOpen(true);
  };

  const handleZoneSubmit = (data: ZoneFormData) => {
    if (!currentCategoryKey) return;
    const currentZones = pmsConfigs[currentCategoryKey] || [];
    const zoneLabel = currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone";
    if (editingZone) {
      const updatedZones = currentZones.map(z => z.id === editingZone.id ? { ...z, ...data } : z);
      saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedZones });
      toast({ title: `${zoneLabel} Modifié(e)`, description: `Le/La ${zoneLabel.toLowerCase()} "${data.name}" a été mis(e) à jour.` });
    } else {
      const newZone: PmsZone = { ...data, id: `${currentCategoryKey}_zone_${Date.now()}`, tasks: [] };
      saveConfigs({ ...pmsConfigs, [currentCategoryKey]: [...currentZones, newZone] });
      toast({ title: `${zoneLabel} Ajouté(e)`, description: `Le/La ${zoneLabel.toLowerCase()} "${data.name}" a été ajouté(e).` });
    }
    setIsZoneDialogOpen(false);
  };

  const handleDeleteZone = (categoryKey: string, zoneId: string) => {
    const zoneLabel = currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "cet équipement" : "cette zone";
    const taskLabel = currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "ses enregistrements" : "ses tâches";
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${zoneLabel} et tous ${taskLabel} associés ?`)) {
      const currentZones = pmsConfigs[categoryKey] || [];
      const updatedZones = currentZones.filter(z => z.id !== zoneId);
      saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedZones });
      toast({ title: `${currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone"} Supprimé(e)`, variant: "destructive" });
    }
  };

  // Task Handlers
  const handleOpenTaskDialog = (categoryKey: string, zone: PmsZone, task?: PmsTaskDefinition) => {
    setCurrentCategoryKey(categoryKey);
    setCurrentZoneForTask(zone);
    setEditingTask(task || null);
    taskForm.reset(task ? { name: task.name } : { name: '' });
    setIsTaskDialogOpen(true);
  };

  const handleTaskSubmit = (data: TaskFormData) => {
    if (!currentCategoryKey || !currentZoneForTask) return;
    const currentZones = pmsConfigs[currentCategoryKey] || [];
    
    const updatedZones = currentZones.map(z => {
      if (z.id === currentZoneForTask.id) {
        let updatedTasks: PmsTaskDefinition[];
        if (editingTask) {
          updatedTasks = z.tasks.map(t => t.id === editingTask.id ? { ...t, ...data } : t);
          toast({ title: "Tâche Modifiée", description: `La tâche "${data.name}" a été mise à jour.` });
        } else {
          const newTask: PmsTaskDefinition = { ...data, id: `${currentCategoryKey}_task_${Date.now()}` };
          updatedTasks = [...z.tasks, newTask];
          toast({ title: "Tâche Ajoutée", description: `La tâche "${data.name}" a été ajoutée à la zone ${z.name}.` });
        }
        return { ...z, tasks: updatedTasks };
      }
      return z;
    });
    saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedZones });
    setIsTaskDialogOpen(false);
  };

  const handleDeleteTask = (categoryKey: string, zoneId: string, taskId: string) => {
     if (confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?")) {
      const currentZones = pmsConfigs[categoryKey] || [];
      const updatedZones = currentZones.map(z => {
        if (z.id === zoneId) {
          return { ...z, tasks: z.tasks.filter(t => t.id !== taskId) };
        }
        return z;
      });
      saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedZones });
      toast({ title: "Tâche Supprimée", variant: "destructive" });
    }
  };

  const renderCategoryConfig = (categoryKey: string, categoryLabel: string, IconComponent: React.ElementType, itemLabel: string = "Zone", taskItemLabel: string = "Tâche") => {
    const itemsForCategory = pmsConfigs[categoryKey] || []; // items can be zones or equipments
    const showTasks = categoryKey !== PMS_TEMPERATURE_MONITORING_KEY; // Don't show tasks for temperature monitoring

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconComponent className="w-5 h-5 text-primary"/>
            {categoryLabel}
          </CardTitle>
          <CardDescription>Gérez les {itemLabel.toLowerCase()}s {showTasks ? `et leurs ${taskItemLabel.toLowerCase()}s associées` : ''} pour {categoryLabel.toLowerCase()}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Button onClick={() => handleOpenZoneDialog(categoryKey)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter {itemLabel === "Zone" ? "une" : "un"} {itemLabel.toLowerCase()}
            </Button>
          </div>

          {itemsForCategory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucun(e) {itemLabel.toLowerCase()} défini(e) pour {categoryLabel.toLowerCase()}.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {itemsForCategory.map(item => ( // item is a PmsZone (can be an equipment)
                <AccordionItem value={item.id} key={item.id} className="group/item">
                  <div className="flex items-center py-0">
                    <AccordionTrigger className="flex-grow py-4 text-left">
                      {item.name}
                    </AccordionTrigger>
                    <div className="pl-2 pr-2 space-x-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenZoneDialog(categoryKey, item)} className="h-7 w-7">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteZone(categoryKey, item.id)} className="h-7 w-7 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {showTasks && (
                    <AccordionContent className="pl-4 pr-2">
                      <div className="mb-3">
                        <Button variant="outline" size="sm" onClick={() => handleOpenTaskDialog(categoryKey, item)}>
                          <PlusCircle className="mr-2 h-3 w-3" /> Ajouter {taskItemLabel}
                        </Button>
                      </div>
                      {item.tasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Aucune {taskItemLabel.toLowerCase()} définie pour cet(te) {itemLabel.toLowerCase()}.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {item.tasks.map(task => (
                            <li key={task.id} className="flex justify-between items-center p-1.5 rounded hover:bg-muted/50 text-sm">
                              <span>{task.name}</span>
                              <div className="space-x-1">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenTaskDialog(categoryKey, item, task)} className="h-6 w-6">
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(categoryKey, item.id, task.id)} className="h-6 w-6 hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </AccordionContent>
                  )}
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {renderCategoryConfig(PMS_KITCHEN_CLEANING_KEY, "Suivi Nettoyage Cuisine", SprayCan, "Zone", "Tâche de Nettoyage")}
      {renderCategoryConfig(PMS_RESTAURANT_CLEANING_KEY, "Suivi Nettoyage Restaurant", Sparkles, "Zone", "Tâche de Nettoyage")}
      {renderCategoryConfig(PMS_TEMPERATURE_MONITORING_KEY, "Suivi des Températures", Thermometer, "Équipement")}
      
      {/* Dialog for Zone/Equipment */}
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingZone ? "Modifier" : "Nouvel"} {currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone"}</DialogTitle>
            {currentCategoryKey && <CardDescription>Pour: {
                currentCategoryKey === PMS_KITCHEN_CLEANING_KEY ? "Nettoyage Cuisine" : 
                currentCategoryKey === PMS_RESTAURANT_CLEANING_KEY ? "Nettoyage Restaurant" :
                "Suivi des Températures"
            }</CardDescription>}
          </DialogHeader>
          <Form {...zoneForm}>
            <form onSubmit={zoneForm.handleSubmit(handleZoneSubmit)} className="space-y-4 py-4">
              <FormField control={zoneForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de l' {currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone"}</FormLabel>
                  <FormControl><Input placeholder={currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Ex: Frigo Positif Cuisine" : "Ex: Plans de travail"} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                <Button type="submit">{editingZone ? "Enregistrer" : "Ajouter"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Task */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Modifier la Tâche" : "Nouvelle Tâche"}</DialogTitle>
            {currentZoneForTask && <CardDescription>Pour: {currentZoneForTask.name}</CardDescription>}
          </DialogHeader>
          <Form {...taskForm}>
            <form onSubmit={taskForm.handleSubmit(handleTaskSubmit)} className="space-y-4 py-4">
              <FormField control={taskForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la Tâche</FormLabel>
                  <FormControl><Input placeholder="Ex: Nettoyage et désinfection" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                <Button type="submit">{editingTask ? "Enregistrer" : "Ajouter"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

       <Card className="opacity-50 cursor-not-allowed">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-muted-foreground"/>
                Configuration Autres Modules PMS
            </CardTitle>
            <CardDescription>Définitions pour le suivi des livraisons, etc. (Bientôt disponible).</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
