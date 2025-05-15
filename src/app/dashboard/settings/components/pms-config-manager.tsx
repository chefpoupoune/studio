
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { PmsZone, PmsTaskDefinition, PmsConfigurations } from '../types';
import { PMS_KITCHEN_CLEANING_KEY, PMS_RESTAURANT_CLEANING_KEY, PMS_TEMPERATURE_MONITORING_KEY, PMS_CONFIG_STORAGE_KEY } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Edit2, Trash2, ShieldAlert, ClipboardEdit, SprayCan, Sparkles, Thermometer } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const baseZoneSchema = z.object({
  name: z.string().min(1, "Le nom de la zone/équipement est requis."),
});

const temperatureEquipmentSchema = baseZoneSchema.extend({
  equipmentType: z.enum(['refrigerator', 'freezer']).optional(),
  targetTempMin: z.coerce.number().optional(),
  targetTempMax: z.coerce.number().optional(),
  toleranceTempMin: z.coerce.number().optional(),
  toleranceTempMax: z.coerce.number().optional(),
}).refine(data => {
    const { targetTempMin, targetTempMax, toleranceTempMin, toleranceTempMax } = data;
    if (targetTempMin !== undefined && targetTempMax !== undefined && targetTempMin > targetTempMax) {
        return false; // Target min cannot be greater than target max
    }
    if (toleranceTempMin !== undefined && toleranceTempMax !== undefined && toleranceTempMin > toleranceTempMax) {
        return false; // Tolerance min cannot be greater than tolerance max
    }
    if (targetTempMax !== undefined && toleranceTempMin !== undefined && targetTempMax >= toleranceTempMin) {
        // If both defined, target max must be less than tolerance min
        // And target min must be less than tolerance max (implicitly covered if ranges don't overlap weirdly)
        return false; 
    }
    return true;
}, {
    message: "Les plages de température cible/tolérance sont invalides ou se chevauchent incorrectement.",
    path: ['targetTempMin'] // Arbitrary path, form-level error
});


type ZoneFormData = z.infer<typeof baseZoneSchema>;
type TemperatureEquipmentFormData = z.infer<typeof temperatureEquipmentSchema>;


const taskSchema = z.object({
  name: z.string().min(1, "Le nom de la tâche est requis."),
});
type TaskFormData = z.infer<typeof taskSchema>;

export default function PmsConfigManager() {
  const [pmsConfigs, setPmsConfigs] = useState<PmsConfigurations>({});
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  
  const [currentCategoryKey, setCurrentCategoryKey] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState<PmsZone | null>(null); // PmsZone can hold equipment data
  const [currentZoneForTask, setCurrentZoneForTask] = useState<PmsZone | null>(null);
  const [editingTask, setEditingTask] = useState<PmsTaskDefinition | null>(null);

  const { toast } = useToast();

  const form = useForm<ZoneFormData | TemperatureEquipmentFormData>({
    resolver: zodResolver(currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? temperatureEquipmentSchema : baseZoneSchema),
    defaultValues: { name: '' }, 
  });
  const taskForm = useForm<TaskFormData>({ resolver: zodResolver(taskSchema), defaultValues: { name: '' } });
  
  useEffect(() => {
    try {
      const storedData = localStorage.getItem(PMS_CONFIG_STORAGE_KEY);
      if (storedData) {
        setPmsConfigs(JSON.parse(storedData));
      } else {
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

  // Re-initialize form resolver when category changes
  useEffect(() => {
    form.reset(undefined, { keepValues: false }); // Clear previous form values
    form.setValue('name', editingZone?.name || ''); // Set name if editing
     if (currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY && editingZone) {
        form.setValue('equipmentType', editingZone.equipmentType || 'refrigerator');
        form.setValue('targetTempMin', editingZone.targetTempMin);
        form.setValue('targetTempMax', editingZone.targetTempMax);
        form.setValue('toleranceTempMin', editingZone.toleranceTempMin);
        form.setValue('toleranceTempMax', editingZone.toleranceTempMax);
    } else if (currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY) {
        form.setValue('equipmentType', 'refrigerator'); // Default for new temp equipment
    }

  }, [isZoneDialogOpen, currentCategoryKey, editingZone, form]);


  const saveConfigs = useCallback((updatedConfigs: PmsConfigurations) => {
    setPmsConfigs(updatedConfigs);
    localStorage.setItem(PMS_CONFIG_STORAGE_KEY, JSON.stringify(updatedConfigs));
  }, []);

  const handleOpenZoneDialog = (categoryKey: string, zone?: PmsZone) => {
    setCurrentCategoryKey(categoryKey);
    setEditingZone(zone || null);
    // Default values are set in the useEffect for form resolver change
    setIsZoneDialogOpen(true);
  };

  const handleZoneSubmit = (data: ZoneFormData | TemperatureEquipmentFormData) => {
    if (!currentCategoryKey) return;
    const currentItems = pmsConfigs[currentCategoryKey] || []; // items can be zones or equipments
    const itemLabel = currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone";
    
    let updatedItemData: PmsZone;

    if (editingZone) {
      updatedItemData = { ...editingZone, ...data };
      const updatedItems = currentItems.map(item => item.id === editingZone.id ? updatedItemData : item);
      saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedItems });
      toast({ title: `${itemLabel} Modifié(e)`, description: `Le/La ${itemLabel.toLowerCase()} "${data.name}" a été mis(e) à jour.` });
    } else {
      const baseNewItem: Omit<PmsZone, 'id' | 'tasks'> = { name: data.name };
       if (currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY) {
        const tempData = data as TemperatureEquipmentFormData;
        updatedItemData = { 
          ...baseNewItem, 
          id: `${currentCategoryKey}_item_${Date.now()}`,
          tasks: [], // Equipments don't have tasks in this context
          equipmentType: tempData.equipmentType,
          targetTempMin: tempData.targetTempMin,
          targetTempMax: tempData.targetTempMax,
          toleranceTempMin: tempData.toleranceTempMin,
          toleranceTempMax: tempData.toleranceTempMax,
        };
      } else {
        updatedItemData = { ...baseNewItem, id: `${currentCategoryKey}_item_${Date.now()}`, tasks: [] };
      }
      saveConfigs({ ...pmsConfigs, [currentCategoryKey]: [...currentItems, updatedItemData] });
      toast({ title: `${itemLabel} Ajouté(e)`, description: `Le/La ${itemLabel.toLowerCase()} "${data.name}" a été ajouté(e).` });
    }
    setIsZoneDialogOpen(false);
  };

  const handleDeleteZone = (categoryKey: string, itemId: string) => {
    const itemLabelSingular = categoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "cet équipement" : "cette zone";
    const itemLabelPlural = categoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "ses configurations" : "ses tâches";
    if (confirm(`Êtes-vous sûr de vouloir supprimer ${itemLabelSingular} et tous ${itemLabelPlural} associés ?`)) {
      const currentItems = pmsConfigs[categoryKey] || [];
      const updatedItems = currentItems.filter(item => item.id !== itemId);
      saveConfigs({ ...pmsConfigs, [categoryKey]: updatedItems });
      toast({ title: `${categoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone"} Supprimé(e)`, variant: "destructive" });
    }
  };

  // Task Handlers
  const handleOpenTaskDialog = (categoryKey: string, zone: PmsZone, task?: PmsTaskDefinition) => {
    setCurrentCategoryKey(categoryKey); // Keep category context
    setCurrentZoneForTask(zone);
    setEditingTask(task || null);
    taskForm.reset(task ? { name: task.name } : { name: '' });
    setIsTaskDialogOpen(true);
  };

  const handleTaskSubmit = (data: TaskFormData) => {
    if (!currentCategoryKey || !currentZoneForTask) return;
    const currentItems = pmsConfigs[currentCategoryKey] || [];
    
    const updatedItems = currentItems.map(item => {
      if (item.id === currentZoneForTask.id) {
        let updatedTasks: PmsTaskDefinition[];
        if (editingTask) {
          updatedTasks = (item.tasks || []).map(t => t.id === editingTask.id ? { ...t, ...data } : t);
          toast({ title: "Tâche Modifiée", description: `La tâche "${data.name}" a été mise à jour.` });
        } else {
          const newTask: PmsTaskDefinition = { ...data, id: `${currentCategoryKey}_task_${Date.now()}` };
          updatedTasks = [...(item.tasks || []), newTask];
          toast({ title: "Tâche Ajoutée", description: `La tâche "${data.name}" a été ajoutée à ${item.name}.` });
        }
        return { ...item, tasks: updatedTasks };
      }
      return item;
    });
    saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedItems });
    setIsTaskDialogOpen(false);
  };

  const handleDeleteTask = (categoryKey: string, zoneId: string, taskId: string) => {
     if (confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?")) {
      const currentItems = pmsConfigs[categoryKey] || [];
      const updatedItems = currentItems.map(item => {
        if (item.id === zoneId) {
          return { ...item, tasks: (item.tasks || []).filter(t => t.id !== taskId) };
        }
        return item;
      });
      saveConfigs({ ...pmsConfigs, [categoryKey]: updatedItems });
      toast({ title: "Tâche Supprimée", variant: "destructive" });
    }
  };

  const renderCategoryConfig = (categoryKey: string, categoryLabel: string, IconComponent: React.ElementType, itemLabel: string = "Zone", taskItemLabel: string = "Tâche") => {
    const itemsForCategory = pmsConfigs[categoryKey] || [];
    const showTasksForThisCategory = categoryKey !== PMS_TEMPERATURE_MONITORING_KEY;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconComponent className="w-5 h-5 text-primary"/>
            {categoryLabel}
          </CardTitle>
          <CardDescription>Gérez les {itemLabel.toLowerCase()}s {showTasksForThisCategory ? `et leurs ${taskItemLabel.toLowerCase()}s associées` : ''} pour {categoryLabel.toLowerCase()}.</CardDescription>
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
              {itemsForCategory.map(item => (
                <AccordionItem value={item.id} key={item.id} className="group/item">
                  <div className="flex items-center py-0">
                    <AccordionTrigger className="flex-grow py-4 text-left">
                      {item.name}
                      {categoryKey === PMS_TEMPERATURE_MONITORING_KEY && item.equipmentType && (
                        <span className="text-xs text-muted-foreground ml-2">({item.equipmentType === 'freezer' ? 'Congélateur' : 'Réfrigérateur'})</span>
                      )}
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
                  {showTasksForThisCategory && (item.tasks || []).length > 0 && (
                    <AccordionContent className="pl-4 pr-2">
                      <div className="mb-3">
                        <Button variant="outline" size="sm" onClick={() => handleOpenTaskDialog(categoryKey, item)}>
                          <PlusCircle className="mr-2 h-3 w-3" /> Ajouter {taskItemLabel}
                        </Button>
                      </div>
                        <ul className="space-y-1.5">
                          {(item.tasks || []).map(task => (
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
                    </AccordionContent>
                  )}
                   {showTasksForThisCategory && (!item.tasks || item.tasks.length === 0) && (
                     <AccordionContent className="pl-4 pr-2">
                       <div className="mb-3">
                          <Button variant="outline" size="sm" onClick={() => handleOpenTaskDialog(categoryKey, item)}>
                            <PlusCircle className="mr-2 h-3 w-3" /> Ajouter {taskItemLabel}
                          </Button>
                        </div>
                       <p className="text-xs text-muted-foreground py-2">Aucune {taskItemLabel.toLowerCase()} définie pour cet(te) {itemLabel.toLowerCase()}.</p>
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
      
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingZone ? "Modifier" : "Nouvel"} {currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone"}</DialogTitle>
            {currentCategoryKey && <CardDescription>Pour: {
                currentCategoryKey === PMS_KITCHEN_CLEANING_KEY ? "Nettoyage Cuisine" : 
                currentCategoryKey === PMS_RESTAURANT_CLEANING_KEY ? "Nettoyage Restaurant" :
                "Suivi des Températures"
            }</CardDescription>}
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleZoneSubmit)} className="space-y-4 py-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de l' {currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone"}</FormLabel>
                  <FormControl><Input placeholder={currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Ex: Frigo Positif Cuisine" : "Ex: Plans de travail"} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY && (
                <>
                  <FormField control={form.control} name="equipmentType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type d'Équipement</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || 'refrigerator'}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="refrigerator">Réfrigérateur</SelectItem>
                          <SelectItem value="freezer">Congélateur</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="targetTempMin" render={({ field }) => (
                      <FormItem><FormLabel>Cible T° Min (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: 0" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="targetTempMax" render={({ field }) => (
                      <FormItem><FormLabel>Cible T° Max (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: 4" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="toleranceTempMin" render={({ field }) => (
                      <FormItem><FormLabel>Tolérance T° Min (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: 5" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="toleranceTempMax" render={({ field }) => (
                      <FormItem><FormLabel>Tolérance T° Max (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: 7" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </>
              )}

              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                <Button type="submit">{editingZone ? "Enregistrer" : "Ajouter"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {currentCategoryKey !== PMS_TEMPERATURE_MONITORING_KEY && 
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
      }

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
