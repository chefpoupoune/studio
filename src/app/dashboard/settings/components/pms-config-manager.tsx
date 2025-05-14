
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { PmsZone, PmsCriterion, PmsConfigurations } from '../types';
import { PMS_KITCHEN_CLEANING_KEY, PMS_CONFIG_STORAGE_KEY } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Edit2, Trash2, ListChecks, ShieldAlert, ClipboardEdit } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const zoneSchema = z.object({
  name: z.string().min(1, "Le nom de la zone est requis."),
});
type ZoneFormData = z.infer<typeof zoneSchema>;

const criterionSchema = z.object({
  name: z.string().min(1, "Le nom du critère est requis."),
});
type CriterionFormData = z.infer<typeof criterionSchema>;

export default function PmsConfigManager() {
  const [pmsConfigs, setPmsConfigs] = useState<PmsConfigurations>({});
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false);
  const [isCriterionDialogOpen, setIsCriterionDialogOpen] = useState(false);
  
  const [editingZone, setEditingZone] = useState<PmsZone | null>(null);
  const [currentZoneForCriterion, setCurrentZoneForCriterion] = useState<PmsZone | null>(null);
  const [editingCriterion, setEditingCriterion] = useState<PmsCriterion | null>(null);

  const { toast } = useToast();

  const zoneForm = useForm<ZoneFormData>({ resolver: zodResolver(zoneSchema), defaultValues: { name: '' } });
  const criterionForm = useForm<CriterionFormData>({ resolver: zodResolver(criterionSchema), defaultValues: { name: '' } });
  
  const kitchenCleaningZones = pmsConfigs[PMS_KITCHEN_CLEANING_KEY] || [];

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(PMS_CONFIG_STORAGE_KEY);
      if (storedData) {
        setPmsConfigs(JSON.parse(storedData));
      } else {
        // Initialize with empty kitchen cleaning config if nothing is stored
        setPmsConfigs({ [PMS_KITCHEN_CLEANING_KEY]: [] });
      }
    } catch (error) {
      console.error("Error loading PMS configs:", error);
      setPmsConfigs({ [PMS_KITCHEN_CLEANING_KEY]: [] });
      toast({ title: "Erreur de chargement", description: "Configurations PMS corrompues.", variant: "destructive" });
    }
  }, [toast]);

  const saveConfigs = useCallback((updatedConfigs: PmsConfigurations) => {
    setPmsConfigs(updatedConfigs);
    localStorage.setItem(PMS_CONFIG_STORAGE_KEY, JSON.stringify(updatedConfigs));
  }, []);

  // Zone Handlers
  const handleOpenZoneDialog = (zone?: PmsZone) => {
    setEditingZone(zone || null);
    zoneForm.reset(zone ? { name: zone.name } : { name: '' });
    setIsZoneDialogOpen(true);
  };

  const handleZoneSubmit = (data: ZoneFormData) => {
    const currentZones = pmsConfigs[PMS_KITCHEN_CLEANING_KEY] || [];
    if (editingZone) {
      const updatedZones = currentZones.map(z => z.id === editingZone.id ? { ...z, ...data } : z);
      saveConfigs({ ...pmsConfigs, [PMS_KITCHEN_CLEANING_KEY]: updatedZones });
      toast({ title: "Zone Modifiée", description: `La zone "${data.name}" a été mise à jour.` });
    } else {
      const newZone: PmsZone = { ...data, id: `zone_${Date.now()}`, criteria: [] };
      saveConfigs({ ...pmsConfigs, [PMS_KITCHEN_CLEANING_KEY]: [...currentZones, newZone] });
      toast({ title: "Zone Ajoutée", description: `La zone "${data.name}" a été ajoutée.` });
    }
    setIsZoneDialogOpen(false);
  };

  const handleDeleteZone = (zoneId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette zone et tous ses critères ?")) {
      const currentZones = pmsConfigs[PMS_KITCHEN_CLEANING_KEY] || [];
      const updatedZones = currentZones.filter(z => z.id !== zoneId);
      saveConfigs({ ...pmsConfigs, [PMS_KITCHEN_CLEANING_KEY]: updatedZones });
      toast({ title: "Zone Supprimée", variant: "destructive" });
    }
  };

  // Criterion Handlers
  const handleOpenCriterionDialog = (zone: PmsZone, criterion?: PmsCriterion) => {
    setCurrentZoneForCriterion(zone);
    setEditingCriterion(criterion || null);
    criterionForm.reset(criterion ? { name: criterion.name } : { name: '' });
    setIsCriterionDialogOpen(true);
  };

  const handleCriterionSubmit = (data: CriterionFormData) => {
    if (!currentZoneForCriterion) return;
    const currentZones = pmsConfigs[PMS_KITCHEN_CLEANING_KEY] || [];
    
    const updatedZones = currentZones.map(z => {
      if (z.id === currentZoneForCriterion.id) {
        let updatedCriteria: PmsCriterion[];
        if (editingCriterion) {
          updatedCriteria = z.criteria.map(c => c.id === editingCriterion.id ? { ...c, ...data } : c);
          toast({ title: "Critère Modifié", description: `Le critère "${data.name}" a été mis à jour.` });
        } else {
          const newCriterion: PmsCriterion = { ...data, id: `crit_${Date.now()}` };
          updatedCriteria = [...z.criteria, newCriterion];
          toast({ title: "Critère Ajouté", description: `Le critère "${data.name}" a été ajouté à la zone ${z.name}.` });
        }
        return { ...z, criteria: updatedCriteria };
      }
      return z;
    });
    saveConfigs({ ...pmsConfigs, [PMS_KITCHEN_CLEANING_KEY]: updatedZones });
    setIsCriterionDialogOpen(false);
  };

  const handleDeleteCriterion = (zoneId: string, criterionId: string) => {
     if (confirm("Êtes-vous sûr de vouloir supprimer ce critère ?")) {
      const currentZones = pmsConfigs[PMS_KITCHEN_CLEANING_KEY] || [];
      const updatedZones = currentZones.map(z => {
        if (z.id === zoneId) {
          return { ...z, criteria: z.criteria.filter(c => c.id !== criterionId) };
        }
        return z;
      });
      saveConfigs({ ...pmsConfigs, [PMS_KITCHEN_CLEANING_KEY]: updatedZones });
      toast({ title: "Critère Supprimé", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Kitchen Cleaning Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardEdit className="w-5 h-5 text-primary"/>
            Configuration du Suivi Nettoyage Cuisine
          </CardTitle>
          <CardDescription>Gérez les zones de nettoyage et leurs critères spécifiques pour la cuisine.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Button onClick={() => handleOpenZoneDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une Zone
            </Button>
          </div>

          {kitchenCleaningZones.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucune zone de nettoyage définie pour la cuisine.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {kitchenCleaningZones.map(zone => (
                <AccordionItem value={zone.id} key={zone.id}>
                  <AccordionTrigger>
                    <div className="flex justify-between items-center w-full pr-2">
                      <span className="font-medium">{zone.name}</span>
                      <div className="space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenZoneDialog(zone);}} className="h-7 w-7">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone.id);}} className="h-7 w-7 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pl-4 pr-2">
                    <div className="mb-3">
                      <Button variant="outline" size="sm" onClick={() => handleOpenCriterionDialog(zone)}>
                        <PlusCircle className="mr-2 h-3 w-3" /> Ajouter Critère à "{zone.name}"
                      </Button>
                    </div>
                    {zone.criteria.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Aucun critère défini pour cette zone.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {zone.criteria.map(criterion => (
                          <li key={criterion.id} className="flex justify-between items-center p-1.5 rounded hover:bg-muted/50 text-sm">
                            <span>{criterion.name}</span>
                            <div className="space-x-1">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenCriterionDialog(zone, criterion)} className="h-6 w-6">
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteCriterion(zone.id, criterion.id)} className="h-6 w-6 hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
      
      {/* Dialog for Zone */}
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingZone ? "Modifier la Zone" : "Nouvelle Zone de Nettoyage"}</DialogTitle>
          </DialogHeader>
          <Form {...zoneForm}>
            <form onSubmit={zoneForm.handleSubmit(handleZoneSubmit)} className="space-y-4 py-4">
              <FormField control={zoneForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la Zone</FormLabel>
                  <FormControl><Input placeholder="Ex: Plans de travail" {...field} /></FormControl>
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

      {/* Dialog for Criterion */}
      <Dialog open={isCriterionDialogOpen} onOpenChange={setIsCriterionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCriterion ? "Modifier le Critère" : "Nouveau Critère de Nettoyage"}</DialogTitle>
            {currentZoneForCriterion && <CardDescription>Pour la zone: {currentZoneForCriterion.name}</CardDescription>}
          </DialogHeader>
          <Form {...criterionForm}>
            <form onSubmit={criterionForm.handleSubmit(handleCriterionSubmit)} className="space-y-4 py-4">
              <FormField control={criterionForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du Critère/Tâche</FormLabel>
                  <FormControl><Input placeholder="Ex: Nettoyage et désinfection" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                <Button type="submit">{editingCriterion ? "Enregistrer" : "Ajouter"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Placeholder for other PMS categories */}
      <Card className="opacity-50 cursor-not-allowed">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-muted-foreground"/>
                Configuration Suivi Nettoyage Restaurant
            </CardTitle>
            <CardDescription>Gérez les zones et critères pour le nettoyage du restaurant (Bientôt disponible).</CardDescription>
        </CardHeader>
      </Card>
       <Card className="opacity-50 cursor-not-allowed">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-muted-foreground"/>
                Configuration Autres Modules PMS
            </CardTitle>
            <CardDescription>Définitions pour le suivi des températures, des livraisons, etc. (Bientôt disponible).</CardDescription>
        </CardHeader>
      </Card>

    </div>
  );
}

