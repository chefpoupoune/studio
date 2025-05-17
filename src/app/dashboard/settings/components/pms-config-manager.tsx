
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { PmsZone, PmsTaskDefinition, PmsConfigurations } from '../types';
import { 
  PMS_KITCHEN_CLEANING_KEY, 
  PMS_RESTAURANT_CLEANING_KEY, 
  PMS_TEMPERATURE_MONITORING_KEY, 
  PMS_FRYER_OIL_MONITORING_KEY, // Import new key
  PMS_CONFIG_STORAGE_KEY 
} from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Edit2, Trash2, ShieldAlert, ClipboardEdit, SprayCan, Sparkles, Thermometer, Flame } from 'lucide-react'; // Added Flame
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const baseZoneSchema = z.object({
  name: z.string().min(1, "Le nom de la zone/équipement/friteuse est requis."),
});

const temperatureEquipmentSchema = baseZoneSchema.extend({
  equipmentType: z.enum(['refrigerator', 'freezer']).default('refrigerator'),
  targetTempMin: z.coerce.number().optional(),
  targetTempMax: z.coerce.number().optional(),
  tolerance1TempMin: z.coerce.number().optional(),
  tolerance1TempMax: z.coerce.number().optional(),
  tolerance2TempMin: z.coerce.number().optional(),
  tolerance2TempMax: z.coerce.number().optional(),
})
.refine(data => data.targetTempMin === undefined || data.targetTempMax === undefined || data.targetTempMin <= data.targetTempMax, {
  message: "Cible T° Min doit être ≤ Cible T° Max.", path: ['targetTempMin']
})
.refine(data => data.tolerance1TempMin === undefined || data.tolerance1TempMax === undefined || data.tolerance1TempMin <= data.tolerance1TempMax, {
  message: "Tolérance 1 T° Min doit être ≤ Tolérance 1 T° Max.", path: ['tolerance1TempMin']
})
.refine(data => data.tolerance2TempMin === undefined || data.tolerance2TempMax === undefined || data.tolerance2TempMin <= data.tolerance2TempMax, {
  message: "Tolérance 2 T° Min doit être ≤ Tolérance 2 T° Max.", path: ['tolerance2TempMin']
});

type ZoneFormData = z.infer<typeof baseZoneSchema>;
type TemperatureEquipmentFormData = z.infer<typeof temperatureEquipmentSchema>;

const taskSchema = z.object({
  name: z.string().min(1, "Le nom de la tâche/critère est requis."),
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
  
  const form = useForm<ZoneFormData | TemperatureEquipmentFormData>({
    // Resolver set dynamically
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
            [PMS_TEMPERATURE_MONITORING_KEY]: [],
            [PMS_FRYER_OIL_MONITORING_KEY]: [], // Initialize new category
        });
      }
    } catch (error) {
      console.error("Error loading PMS configs:", error);
      setPmsConfigs({ 
          [PMS_KITCHEN_CLEANING_KEY]: [], 
          [PMS_RESTAURANT_CLEANING_KEY]: [],
          [PMS_TEMPERATURE_MONITORING_KEY]: [],
          [PMS_FRYER_OIL_MONITORING_KEY]: [], // Initialize new category
      });
      toast({ title: "Erreur de chargement", description: "Configurations PMS corrompues.", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (isZoneDialogOpen) {
        const resolver = currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY 
            ? zodResolver(temperatureEquipmentSchema) 
            : zodResolver(baseZoneSchema);
        
        let defaultValues: any = { name: editingZone?.name || '' };
        if (currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY && editingZone) {
            defaultValues = {
                name: editingZone.name || '',
                equipmentType: editingZone.equipmentType || 'refrigerator',
                targetTempMin: editingZone.targetTempMin,
                targetTempMax: editingZone.targetTempMax,
                tolerance1TempMin: editingZone.tolerance1TempMin,
                tolerance1TempMax: editingZone.tolerance1TempMax,
                tolerance2TempMin: editingZone.tolerance2TempMin,
                tolerance2TempMax: editingZone.tolerance2TempMax,
            };
        } else if (currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY && !editingZone) {
             defaultValues = {
                name: '',
                equipmentType: 'refrigerator',
             };
        }
        
        form.reset(defaultValues, { resolver } as any);
    }
  }, [isZoneDialogOpen, currentCategoryKey, editingZone, form]);

  const saveConfigs = useCallback((updatedConfigs: PmsConfigurations) => {
    setPmsConfigs(updatedConfigs);
    localStorage.setItem(PMS_CONFIG_STORAGE_KEY, JSON.stringify(updatedConfigs));
  }, []);

  const handleOpenZoneDialog = (categoryKey: string, zone?: PmsZone) => {
    setCurrentCategoryKey(categoryKey);
    setEditingZone(zone || null);
    setIsZoneDialogOpen(true);
  };

  const handleZoneSubmit = (data: ZoneFormData | TemperatureEquipmentFormData) => {
    if (!currentCategoryKey) return;
    const currentItems = pmsConfigs[currentCategoryKey] || []; 
    const itemLabel = currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : 
                      currentCategoryKey === PMS_FRYER_OIL_MONITORING_KEY ? "Friteuse" : "Zone";
    
    let updatedItemData: PmsZone;

    if (editingZone) {
      updatedItemData = { ...editingZone, name: data.name, id: editingZone.id, tasks: editingZone.tasks || [] };
       if (currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY) {
        const tempData = data as TemperatureEquipmentFormData;
        updatedItemData.equipmentType = tempData.equipmentType;
        updatedItemData.targetTempMin = tempData.targetTempMin;
        updatedItemData.targetTempMax = tempData.targetTempMax;
        updatedItemData.tolerance1TempMin = tempData.tolerance1TempMin;
        updatedItemData.tolerance1TempMax = tempData.tolerance1TempMax;
        updatedItemData.tolerance2TempMin = tempData.tolerance2TempMin;
        updatedItemData.tolerance2TempMax = tempData.tolerance2TempMax;
      }
      const updatedItems = currentItems.map(item => item.id === editingZone.id ? updatedItemData : item);
      saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedItems });
      toast({ title: `${itemLabel} Modifié(e)`, description: `Le/La ${itemLabel.toLowerCase()} "${data.name}" a été mis(e) à jour.` });
    } else {
      const baseNewItem: Omit<PmsZone, 'id' | 'tasks'> & { tasks?: PmsTaskDefinition[] } = { name: data.name, tasks: [] };
       if (currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY) {
        const tempData = data as TemperatureEquipmentFormData;
        updatedItemData = { 
          ...baseNewItem, 
          id: `${currentCategoryKey}_item_${Date.now()}`,
          equipmentType: tempData.equipmentType,
          targetTempMin: tempData.targetTempMin,
          targetTempMax: tempData.targetTempMax,
          tolerance1TempMin: tempData.tolerance1TempMin,
          tolerance1TempMax: tempData.tolerance1TempMax,
          tolerance2TempMin: tempData.tolerance2TempMin,
          tolerance2TempMax: tempData.tolerance2TempMax,
        };
      } else {
        updatedItemData = { ...baseNewItem, id: `${currentCategoryKey}_item_${Date.now()}`, tasks: [] };
      }
      saveConfigs({ ...pmsConfigs, [currentCategoryKey]: [...currentItems, updatedItemData] });
      toast({ title: `${itemLabel} Ajouté(e)`, description: `Le/La ${itemLabel.toLowerCase()} "${data.name}" a été ajouté(e).` });
    }
    setIsZoneDialogOpen(false);
  };

  const handleDeleteZone = (categoryKey: string, itemId: string, itemName: string) => {
    const itemLabelSingular = categoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "cet équipement" : 
                               categoryKey === PMS_FRYER_OIL_MONITORING_KEY ? "cette friteuse" : "cette zone";
    const itemLabelPlural = categoryKey === PMS_TEMPERATURE_MONITORING_KEY || categoryKey === PMS_FRYER_OIL_MONITORING_KEY ? "ses configurations" : "ses tâches";
    
    const currentItems = pmsConfigs[categoryKey] || [];
    const updatedItems = currentItems.filter(item => item.id !== itemId);
    saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedItems });
    toast({ title: `${categoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : categoryKey === PMS_FRYER_OIL_MONITORING_KEY ? "Friteuse" : "Zone"} Supprimé(e)`, description: `L'élément "${itemName}" a été supprimé.`, variant: "destructive" });
  };

  const handleOpenTaskDialog = (categoryKey: string, zone: PmsZone, task?: PmsTaskDefinition) => {
    setCurrentCategoryKey(categoryKey); 
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
          toast({ title: "Tâche/Critère Modifié(e)", description: `L'élément "${data.name}" a été mis à jour.` });
        } else {
          const newTask: PmsTaskDefinition = { ...data, id: `${currentCategoryKey}_task_${Date.now()}` };
          updatedTasks = [...(item.tasks || []), newTask];
          toast({ title: "Tâche/Critère Ajouté(e)", description: `L'élément "${data.name}" a été ajouté(e) à ${item.name}.` });
        }
        return { ...item, tasks: updatedTasks };
      }
      return item;
    });
    saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedItems });
    setIsTaskDialogOpen(false);
  };

  const handleDeleteTask = (categoryKey: string, zoneId: string, taskId: string, taskName: string) => {
    const currentItems = pmsConfigs[categoryKey] || [];
    const updatedItems = currentItems.map(item => {
      if (item.id === zoneId) {
        return { ...item, tasks: (item.tasks || []).filter(t => t.id !== taskId) };
      }
      return item;
    });
    saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedItems });
    toast({ title: "Tâche/Critère Supprimé(e)", description: `L'élément "${taskName}" a été supprimé.`, variant: "destructive" });
  };

  const renderCategoryConfig = (categoryKey: string, categoryLabel: string, IconComponent: React.ElementType, itemLabel: string = "Zone", taskItemLabel: string = "Tâche/Critère") => {
    const itemsForCategory = pmsConfigs[categoryKey] || [];
    const showTasksForThisCategory = categoryKey !== PMS_TEMPERATURE_MONITORING_KEY;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconComponent className="w-5 h-5 text-primary"/>
            {categoryLabel}
          </CardTitle>
          <CardDescription>Gérez les {itemLabel.toLowerCase()}s {showTasksForThisCategory ? `et leurs ${taskItemLabel.toLowerCase()}s associés` : ''} pour {categoryLabel.toLowerCase()}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Button onClick={() => handleOpenZoneDialog(categoryKey)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter {itemLabel === "Zone" || itemLabel === "Friteuse" ? "une" : "un"} {itemLabel.toLowerCase()}
            </Button>
          </div>

          {itemsForCategory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucun(e) {itemLabel.toLowerCase()} défini(e) pour {categoryLabel.toLowerCase()}.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {itemsForCategory.map(item => (
                <AccordionItem value={item.id} key={item.id} className="group/item border-b">
                  <div className="flex items-center justify-between py-1 hover:bg-muted/20">
                    <AccordionTrigger className="flex-grow py-3 px-2 text-left">
                      {item.name}
                      {categoryKey === PMS_TEMPERATURE_MONITORING_KEY && item.equipmentType && (
                        <span className="text-xs text-muted-foreground ml-2">({item.equipmentType === 'freezer' ? 'Congélateur' : 'Réfrigérateur'})</span>
                      )}
                       {categoryKey === PMS_TEMPERATURE_MONITORING_KEY && (
                        <span className="text-xs text-muted-foreground ml-2 italic">
                            (Cible: {item.targetTempMin ?? 'N/A'} à {item.targetTempMax ?? 'N/A'}°C
                            { (item.tolerance1TempMin !== undefined || item.tolerance1TempMax !== undefined) && 
                                `, Tol.1: ${item.tolerance1TempMin ?? 'N/A'} à ${item.tolerance1TempMax ?? 'N/A'}°C`
                            }
                            { (item.tolerance2TempMin !== undefined || item.tolerance2TempMax !== undefined) && 
                                `, Tol.2: ${item.tolerance2TempMin ?? 'N/A'} à ${item.tolerance2TempMax ?? 'N/A'}°C`
                            })
                        </span>
                      )}
                    </AccordionTrigger>
                    <div className="pl-2 pr-2 space-x-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenZoneDialog(categoryKey, item);}} className="h-7 w-7">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="h-7 w-7 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer "{item.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible et supprimera l'élément ainsi que tous ses {taskItemLabel.toLowerCase()}s associés (le cas échéant).
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteZone(categoryKey, item.id, item.name)}>
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {showTasksForThisCategory && (item.tasks || []).length > 0 && (
                    <AccordionContent className="pl-6 pr-2 pt-0 pb-3">
                      <div className="mb-2 mt-1">
                        <Button variant="outline" size="xs" onClick={() => handleOpenTaskDialog(categoryKey, item)}>
                          <PlusCircle className="mr-1.5 h-3 w-3" /> Ajouter {taskItemLabel}
                        </Button>
                      </div>
                        <ul className="space-y-1">
                          {(item.tasks || []).map(task => (
                            <li key={task.id} className="flex justify-between items-center p-1.5 rounded hover:bg-muted/30 text-sm">
                              <span>{task.name}</span>
                              <div className="space-x-0.5">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenTaskDialog(categoryKey, item, task)} className="h-6 w-6">
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer "{task.name}"?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Cette action est irréversible.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteTask(categoryKey, item.id, task.id, task.name)}>
                                        Supprimer {taskItemLabel}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </li>
                          ))}
                        </ul>
                    </AccordionContent>
                  )}
                   {showTasksForThisCategory && (!item.tasks || item.tasks.length === 0) && (
                     <AccordionContent className="pl-6 pr-2 pt-0 pb-3">
                       <div className="mb-2 mt-1">
                          <Button variant="outline" size="xs" onClick={() => handleOpenTaskDialog(categoryKey, item)}>
                            <PlusCircle className="mr-1.5 h-3 w-3" /> Ajouter {taskItemLabel}
                          </Button>
                        </div>
                       <p className="text-xs text-muted-foreground py-1">Aucun(e) {taskItemLabel.toLowerCase()} défini(e) pour cet(te) {itemLabel.toLowerCase()}.</p>
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
      {renderCategoryConfig(PMS_FRYER_OIL_MONITORING_KEY, "Suivi des Huiles de Friteuse", Flame, "Friteuse", "Point de Contrôle")}
      
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingZone ? "Modifier" : "Nouvel"} {currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : currentCategoryKey === PMS_FRYER_OIL_MONITORING_KEY ? "Friteuse" : "Zone"}</DialogTitle>
            {currentCategoryKey && <CardDescription>Pour: {
                currentCategoryKey === PMS_KITCHEN_CLEANING_KEY ? "Nettoyage Cuisine" : 
                currentCategoryKey === PMS_RESTAURANT_CLEANING_KEY ? "Nettoyage Restaurant" :
                currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Suivi des Températures" :
                currentCategoryKey === PMS_FRYER_OIL_MONITORING_KEY ? "Suivi des Huiles de Friteuse" : ""
            }</CardDescription>}
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleZoneSubmit)} className="space-y-4 py-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de l' {currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : currentCategoryKey === PMS_FRYER_OIL_MONITORING_KEY ? "Friteuse" : "Zone"}</FormLabel>
                  <FormControl><Input placeholder={
                      currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Ex: Frigo Positif Cuisine" : 
                      currentCategoryKey === PMS_FRYER_OIL_MONITORING_KEY ? "Ex: Friteuse 1" : 
                      "Ex: Plans de travail"
                    } {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY && (
                <>
                  <FormField control={form.control} name="equipmentType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type d'Équipement</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value as string || 'refrigerator'} defaultValue={field.value as string || 'refrigerator'}>
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
                      <FormItem><FormLabel>Cible T° Min (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: 0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="targetTempMax" render={({ field }) => (
                      <FormItem><FormLabel>Cible T° Max (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: 4" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="tolerance1TempMin" render={({ field }) => (
                      <FormItem><FormLabel>Tolérance 1 T° Min (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: -2" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="tolerance1TempMax" render={({ field }) => (
                      <FormItem><FormLabel>Tolérance 1 T° Max (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: -1" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                   <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="tolerance2TempMin" render={({ field }) => (
                      <FormItem><FormLabel>Tolérance 2 T° Min (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: 5" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="tolerance2TempMax" render={({ field }) => (
                      <FormItem><FormLabel>Tolérance 2 T° Max (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: 7" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                   <p className="text-xs text-muted-foreground">Laissez les champs de température vides si vous souhaitez utiliser les valeurs par défaut de l'application. Les plages de tolérance sont optionnelles.</p>
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
                <DialogTitle>{editingTask ? "Modifier la Tâche/Critère" : "Nouvelle Tâche/Critère"}</DialogTitle>
                {currentZoneForTask && <CardDescription>Pour: {currentZoneForTask.name}</CardDescription>}
            </DialogHeader>
            <Form {...taskForm}>
                <form onSubmit={taskForm.handleSubmit(handleTaskSubmit)} className="space-y-4 py-4">
                <FormField control={taskForm.control} name="name" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nom de la Tâche/Critère</FormLabel>
                    <FormControl><Input placeholder={
                        currentCategoryKey === PMS_FRYER_OIL_MONITORING_KEY ? "Ex: Testeur d'huile" :
                        "Ex: Nettoyage et désinfection"
                        } {...field} />
                    </FormControl>
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

