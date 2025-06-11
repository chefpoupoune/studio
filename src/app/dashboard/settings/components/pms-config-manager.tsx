
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { PmsZone, PmsTaskDefinition, PmsConfigurations, PmsEquipmentDefinition } from '../types';
import { 
  PMS_KITCHEN_CLEANING_KEY, 
  PMS_RESTAURANT_CLEANING_KEY, 
  PMS_TEMPERATURE_MONITORING_KEY,
} from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Edit2, Trash2, ShieldAlert, ClipboardEdit, SprayCan, Sparkles, Thermometer, Flame, Loader2 } from 'lucide-react'; 
import { useForm, Controller } from 'react-hook-form';
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
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore'; // Removed collection, getDocs as they are not directly used for main save/load anymore here.

const FIRESTORE_COLLECTION_NAME = "pmsConfigurations";
const FIRESTORE_DOCUMENT_ID = "mainConfig";

const baseZoneSchema = z.object({
  name: z.string().min(1, "Le nom de la zone/équipement est requis."),
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
  message: "Tol. 1 T° Min doit être ≤ Tol. 1 T° Max.", path: ['tolerance1TempMin']
})
.refine(data => data.tolerance2TempMin === undefined || data.tolerance2TempMax === undefined || data.tolerance2TempMin <= data.tolerance2TempMax, {
  message: "Tol. 2 T° Min doit être ≤ Tol. 2 T° Max.", path: ['tolerance2TempMin']
});

type ZoneFormData = z.infer<typeof baseZoneSchema>;
type TemperatureEquipmentFormData = z.infer<typeof temperatureEquipmentSchema>;

const taskSchema = z.object({
  name: z.string().min(1, "Le nom de la tâche/point de contrôle est requis."),
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<ZoneFormData | TemperatureEquipmentFormData>({
    // Resolver set dynamically
  });
  const taskForm = useForm<TaskFormData>({ resolver: zodResolver(taskSchema), defaultValues: { name: '' } });
  
  const initialConfigsStructure: PmsConfigurations = {
    [PMS_KITCHEN_CLEANING_KEY]: [],
    [PMS_RESTAURANT_CLEANING_KEY]: [],
    [PMS_TEMPERATURE_MONITORING_KEY]: [],
  };

  useEffect(() => {
    const loadConfigsFromFirestore = async () => {
      setIsLoading(true);
      const docRef = doc(firestore, FIRESTORE_COLLECTION_NAME, FIRESTORE_DOCUMENT_ID);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const firestoreData = docSnap.data() as PmsConfigurations;
          const loadedConfigs = { ...initialConfigsStructure };
          Object.keys(initialConfigsStructure).forEach(key => {
            if (firestoreData[key]) {
              loadedConfigs[key] = firestoreData[key];
            }
          });
          setPmsConfigs(loadedConfigs);
        } else {
          // If doc doesn't exist, initialize it with the default structure
          await setDoc(docRef, initialConfigsStructure);
          setPmsConfigs(initialConfigsStructure);
        }
      } catch (error) {
        console.error("Error loading PMS configs from Firestore:", error);
        setPmsConfigs(initialConfigsStructure); // Fallback to initial structure on error
        toast({ title: "Erreur de chargement", description: "Configurations PMS corrompues ou non trouvées. Initialisation.", variant: "destructive" });
      }
      setIsLoading(false);
    };
    loadConfigsFromFirestore();
  }, [toast]); // Removed initialConfigsStructure from deps as it's stable


  useEffect(() => {
    if (isZoneDialogOpen) {
        const resolver = currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY 
            ? zodResolver(temperatureEquipmentSchema) 
            : zodResolver(baseZoneSchema);
        
        let defaultValues: any = { name: editingZone?.name || '' };
        if (currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY) {
            if (editingZone) {
                defaultValues = {
                    name: editingZone.name || '',
                    equipmentType: (editingZone as PmsEquipmentDefinition).equipmentType || 'refrigerator',
                    targetTempMin: (editingZone as PmsEquipmentDefinition).targetTempMin ?? undefined,
                    targetTempMax: (editingZone as PmsEquipmentDefinition).targetTempMax ?? undefined,
                    tolerance1TempMin: (editingZone as PmsEquipmentDefinition).tolerance1TempMin ?? undefined,
                    tolerance1TempMax: (editingZone as PmsEquipmentDefinition).tolerance1TempMax ?? undefined,
                    tolerance2TempMin: (editingZone as PmsEquipmentDefinition).tolerance2TempMin ?? undefined,
                    tolerance2TempMax: (editingZone as PmsEquipmentDefinition).tolerance2TempMax ?? undefined,
                };
            } else {
                 defaultValues = {
                    name: '',
                    equipmentType: 'refrigerator',
                    targetTempMin: undefined, targetTempMax: undefined,
                    tolerance1TempMin: undefined, tolerance1TempMax: undefined,
                    tolerance2TempMin: undefined, tolerance2TempMax: undefined,
                 };
            }
        }
        
        form.reset(defaultValues, { resolver } as any);
    }
  }, [isZoneDialogOpen, currentCategoryKey, editingZone, form]);

  const saveConfigsToFirestore = useCallback(async (configsToSave: PmsConfigurations) => {
    if (isSaving) return Promise.reject(new Error("Sauvegarde déjà en cours."));
    setIsSaving(true);
    const docRef = doc(firestore, FIRESTORE_COLLECTION_NAME, FIRESTORE_DOCUMENT_ID);
    try {
      await setDoc(docRef, configsToSave);
      window.dispatchEvent(new CustomEvent('pmsConfigUpdated'));
      return Promise.resolve();
    } catch (error) {
      console.error("Error saving PMS configs to Firestore:", error);
      toast({ title: "Erreur de Sauvegarde", description: "Impossible d'enregistrer les configurations PMS.", variant: "destructive"});
      return Promise.reject(error);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, toast]);

  const handleOpenZoneDialog = (categoryKey: string, zone?: PmsZone) => {
    setCurrentCategoryKey(categoryKey);
    setEditingZone(zone || null);
    setIsZoneDialogOpen(true);
  };

  const handleZoneSubmit = (data: ZoneFormData | TemperatureEquipmentFormData) => {
    if (!currentCategoryKey) return;
    const originalPmsConfigs = JSON.parse(JSON.stringify(pmsConfigs)); // Deep copy for rollback
    const currentItems = originalPmsConfigs[currentCategoryKey] || []; 
    const itemLabel = currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone";
    
    let updatedItemData: PmsZone;
    let newItems: PmsZone[];

    if (editingZone) {
      updatedItemData = { ...editingZone, name: data.name, id: editingZone.id, tasks: editingZone.tasks || [] };
       if (currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY) {
        const tempData = data as TemperatureEquipmentFormData;
        updatedItemData = {
            ...updatedItemData,
            equipmentType: tempData.equipmentType,
            targetTempMin: tempData.targetTempMin,
            targetTempMax: tempData.targetTempMax,
            tolerance1TempMin: tempData.tolerance1TempMin,
            tolerance1TempMax: tempData.tolerance1TempMax,
            tolerance2TempMin: tempData.tolerance2TempMin,
            tolerance2TempMax: tempData.tolerance2TempMax,
        } as PmsEquipmentDefinition;
      }
      newItems = currentItems.map(item => item.id === editingZone.id ? updatedItemData : item);
    } else {
      const newItemId = `${currentCategoryKey}_item_${Date.now()}`;
      let baseNewItem: PmsZone = { name: data.name, id: newItemId, tasks: [] };

       if (currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY) {
        const tempData = data as TemperatureEquipmentFormData;
        updatedItemData = { 
          ...baseNewItem, 
          equipmentType: tempData.equipmentType,
          targetTempMin: tempData.targetTempMin,
          targetTempMax: tempData.targetTempMax,
          tolerance1TempMin: tempData.tolerance1TempMin,
          tolerance1TempMax: tempData.tolerance1TempMax,
          tolerance2TempMin: tempData.tolerance2TempMin,
          tolerance2TempMax: tempData.tolerance2TempMax,
        } as PmsEquipmentDefinition;
      } else {
        updatedItemData = { ...baseNewItem };
      }
      newItems = [...currentItems, updatedItemData];
    }
    
    const newConfigs = { ...originalPmsConfigs, [currentCategoryKey]: newItems };
    setPmsConfigs(newConfigs); // Optimistic update

    saveConfigsToFirestore(newConfigs)
        .then(() => {
            toast({ title: `${itemLabel} ${editingZone ? "Modifié(e)" : "Ajouté(e)"}`, description: `Le/La ${itemLabel.toLowerCase()} "${data.name}" a été ${editingZone ? "mis(e) à jour." : "ajouté(e)."}` });
        })
        .catch(() => {
            setPmsConfigs(originalPmsConfigs); // Rollback
            toast({ title: "Erreur", description: `Échec de la sauvegarde pour ${itemLabel.toLowerCase()} "${data.name}".`, variant: "destructive" });
        });
    setIsZoneDialogOpen(false);
  };

  const handleDeleteZone = (categoryKey: string, itemId: string, itemName: string) => {
    const originalPmsConfigs = JSON.parse(JSON.stringify(pmsConfigs));
    const currentItems = originalPmsConfigs[categoryKey] || [];
    const updatedItems = currentItems.filter(item => item.id !== itemId);
    const newConfigs = { ...originalPmsConfigs, [categoryKey]: updatedItems };
    
    setPmsConfigs(newConfigs); // Optimistic update

    saveConfigsToFirestore(newConfigs)
      .then(() => {
        toast({ title: `${categoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone"} Supprimé(e)`, description: `L'élément "${itemName}" a été supprimé.`, variant: "destructive" });
      })
      .catch((error) => {
        setPmsConfigs(originalPmsConfigs); // Rollback
        console.error("Error deleting zone/equipment, UI rolled back:", error);
        toast({ title: "Erreur de Suppression", description: "La suppression a échoué, l'élément a été restauré.", variant: "destructive"});
      });
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
    
    const originalPmsConfigs = JSON.parse(JSON.stringify(pmsConfigs));
    const currentItems = originalPmsConfigs[currentCategoryKey] || [];
    let zoneFoundAndUpdated = false;
    
    const updatedItems = currentItems.map(item => {
      if (item.id === currentZoneForTask.id) {
        zoneFoundAndUpdated = true;
        let updatedTasks: PmsTaskDefinition[];
        if (editingTask) {
          updatedTasks = (item.tasks || []).map(t => t.id === editingTask.id ? { ...t, ...data } : t);
        } else {
          const newTask: PmsTaskDefinition = { ...data, id: `${currentCategoryKey}_task_${Date.now()}` };
          updatedTasks = [...(item.tasks || []), newTask];
        }
        return { ...item, tasks: updatedTasks };
      }
      return item;
    });

    if (!zoneFoundAndUpdated) {
      console.warn("Zone not found for task update:", currentZoneForTask.id);
      return;
    }

    const newConfigs = { ...originalPmsConfigs, [currentCategoryKey]: updatedItems };
    setPmsConfigs(newConfigs); // Optimistic update

    saveConfigsToFirestore(newConfigs)
      .then(() => {
        toast({ title: `Tâche ${editingTask ? "Modifiée" : "Ajoutée"}`, description: `L'élément "${data.name}" a été ${editingTask ? "mis à jour." : `ajouté(e) à ${currentZoneForTask.name}`}.` });
      })
      .catch(() => {
        setPmsConfigs(originalPmsConfigs); // Rollback
         toast({ title: "Erreur", description: `Échec de la sauvegarde pour la tâche "${data.name}".`, variant: "destructive" });
      });
    setIsTaskDialogOpen(false);
  };

  const handleDeleteTask = (categoryKey: string, zoneId: string, taskId: string, taskName: string) => {
    const originalPmsConfigs = JSON.parse(JSON.stringify(pmsConfigs));
    const currentItems = originalPmsConfigs[categoryKey] || [];
    let zoneFoundAndUpdated = false;

    const updatedItems = currentItems.map(item => {
      if (item.id === zoneId) {
        zoneFoundAndUpdated = true;
        return { ...item, tasks: (item.tasks || []).filter(t => t.id !== taskId) };
      }
      return item;
    });

    if (!zoneFoundAndUpdated) {
      console.warn("Zone not found for task deletion:", zoneId);
      return;
    }

    const newConfigs = { ...originalPmsConfigs, [categoryKey]: updatedItems };
    setPmsConfigs(newConfigs); // Optimistic update

    saveConfigsToFirestore(newConfigs)
      .then(() => {
        toast({ title: "Tâche Supprimée", description: `L'élément "${taskName}" a été supprimé.`, variant: "destructive" });
      })
      .catch((error) => {
        setPmsConfigs(originalPmsConfigs); // Rollback
        console.error("Error deleting task, UI rolled back:", error);
        toast({ title: "Erreur de Suppression", description: "La suppression de la tâche a échoué, l'élément a été restauré.", variant: "destructive"});
      });
  };

  const getTemperatureSummary = (item: PmsEquipmentDefinition): string => {
    const parts: string[] = [];
    if (item.targetTempMin !== undefined && item.targetTempMax !== undefined) {
      parts.push(`Cible: ${item.targetTempMin}-${item.targetTempMax}°C`);
    } else if (item.targetTempMin !== undefined) {
      parts.push(`Cible: ≥${item.targetTempMin}°C`);
    } else if (item.targetTempMax !== undefined) {
      parts.push(`Cible: ≤${item.targetTempMax}°C`);
    }

    if (item.tolerance1TempMin !== undefined && item.tolerance1TempMax !== undefined) {
      parts.push(`Tol.1: ${item.tolerance1TempMin}-${item.tolerance1TempMax}°C`);
    }
    if (item.tolerance2TempMin !== undefined && item.tolerance2TempMax !== undefined) {
      parts.push(`Tol.2: ${item.tolerance2TempMin}-${item.tolerance2TempMax}°C`);
    }
    return parts.join(' / ');
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
          <CardDescription>Gérez les {itemLabel.toLowerCase()}s {showTasksForThisCategory ? `et leurs ${taskItemLabel.toLowerCase()}s associés` : ''} pour {categoryLabel.toLowerCase()}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Button onClick={() => handleOpenZoneDialog(categoryKey)} disabled={isLoading || isSaving}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter {itemLabel === "Zone" ? "une" : "un"} {itemLabel.toLowerCase()}
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
                      <div className="flex flex-col">
                        <span>
                          {item.name}
                          {categoryKey === PMS_TEMPERATURE_MONITORING_KEY && (item as PmsEquipmentDefinition).equipmentType && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({(item as PmsEquipmentDefinition).equipmentType === 'freezer' ? 'Congélateur' : 'Réfrigérateur'})
                            </span>
                          )}
                        </span>
                        {categoryKey === PMS_TEMPERATURE_MONITORING_KEY && (
                            <span className="text-xs text-muted-foreground/80 font-normal mt-0.5">
                                {getTemperatureSummary(item as PmsEquipmentDefinition)}
                            </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <div className="pl-2 pr-2 space-x-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenZoneDialog(categoryKey, item);}} className="h-7 w-7" disabled={isLoading || isSaving}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="h-7 w-7 hover:text-destructive" disabled={isLoading || isSaving}>
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
                            <AlertDialogAction onClick={() => handleDeleteZone(categoryKey, item.id, item.name)} disabled={isLoading || isSaving}>
                              {(isLoading || isSaving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {showTasksForThisCategory && (item.tasks || []).length > 0 && (
                    <AccordionContent className="pl-6 pr-2 pt-0 pb-3">
                      <div className="mb-2 mt-1">
                        <Button variant="outline" size="xs" onClick={() => handleOpenTaskDialog(categoryKey, item)} disabled={isLoading || isSaving}>
                          <PlusCircle className="mr-1.5 h-3 w-3" /> Ajouter {taskItemLabel}
                        </Button>
                      </div>
                        <ul className="space-y-1">
                          {(item.tasks || []).map(task => (
                            <li key={task.id} className="flex justify-between items-center p-1.5 rounded hover:bg-muted/30 text-sm">
                              <span>{task.name}</span>
                              <div className="space-x-0.5">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenTaskDialog(categoryKey, item, task)} className="h-6 w-6" disabled={isLoading || isSaving}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" disabled={isLoading || isSaving}>
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
                                      <AlertDialogAction onClick={() => handleDeleteTask(categoryKey, item.id, task.id, task.name)} disabled={isLoading || isSaving}>
                                        {(isLoading || isSaving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Supprimer {taskItemLabel}
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
                          <Button variant="outline" size="xs" onClick={() => handleOpenTaskDialog(categoryKey, item)} disabled={isLoading || isSaving}>
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
  
  if (isLoading && Object.keys(pmsConfigs).length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader><CardTitle>Configuration PMS</CardTitle></CardHeader>
        <CardContent className="flex justify-center items-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2"/> Chargement des configurations PMS...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {renderCategoryConfig(PMS_KITCHEN_CLEANING_KEY, "Suivi Nettoyage Cuisine", SprayCan, "Zone", "Tâche")}
      {renderCategoryConfig(PMS_RESTAURANT_CLEANING_KEY, "Suivi Nettoyage Restaurant", Sparkles, "Zone", "Tâche")}
      {renderCategoryConfig(PMS_TEMPERATURE_MONITORING_KEY, "Suivi des Températures", Thermometer, "Équipement")}
      
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent className="sm:max-w-lg md:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingZone ? "Modifier" : "Nouvel"} {currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone"}</DialogTitle>
            {currentCategoryKey && <CardDescription>Pour: {
                currentCategoryKey === PMS_KITCHEN_CLEANING_KEY ? "Nettoyage Cuisine" : 
                currentCategoryKey === PMS_RESTAURANT_CLEANING_KEY ? "Nettoyage Restaurant" :
                currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Suivi des Températures" : ""
            }</CardDescription>}
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleZoneSubmit)} className="space-y-4 py-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de l'{currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Équipement" : "Zone"}</FormLabel>
                  <FormControl><Input placeholder={
                      currentCategoryKey === PMS_TEMPERATURE_MONITORING_KEY ? "Ex: Frigo Positif Cuisine" : 
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
                      <Select 
                        onValueChange={field.onChange} 
                        value={(field.value as string) || 'refrigerator'} 
                        defaultValue={(field.value as string) || 'refrigerator'}
                       >
                        <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="refrigerator">Réfrigérateur</SelectItem>
                          <SelectItem value="freezer">Congélateur</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="targetTempMin" render={({ field }) => (
                      <FormItem><FormLabel>Cible T° Min (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: 0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="targetTempMax" render={({ field }) => (
                      <FormItem><FormLabel>Cible T° Max (°C)</FormLabel><FormControl><Input type="number" placeholder="Ex: 4" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="tolerance1TempMin" render={({ field }) => (
                      <FormItem><FormLabel>Tolérance 1 T° Min (°C)</FormLabel><FormControl><Input type="number" placeholder="Optionnel" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="tolerance1TempMax" render={({ field }) => (
                      <FormItem><FormLabel>Tolérance 1 T° Max (°C)</FormLabel><FormControl><Input type="number" placeholder="Optionnel" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="tolerance2TempMin" render={({ field }) => (
                      <FormItem><FormLabel>Tolérance 2 T° Min (°C)</FormLabel><FormControl><Input type="number" placeholder="Optionnel" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="tolerance2TempMax" render={({ field }) => (
                      <FormItem><FormLabel>Tolérance 2 T° Max (°C)</FormLabel><FormControl><Input type="number" placeholder="Optionnel" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                   <p className="text-xs text-muted-foreground">Laissez les champs de température vides si vous souhaitez utiliser les valeurs par défaut de l'application ou si une tolérance n'est pas applicable.</p>
                </>
              )}

              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                <Button type="submit" disabled={isSaving}>{(isSaving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingZone ? "Enregistrer" : "Ajouter"}</Button>
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
                    <FormControl><Input placeholder={"Ex: Nettoyage et désinfection"} {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )} />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit" disabled={isSaving}>{(isSaving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingTask ? "Enregistrer" : "Ajouter"}</Button>
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

