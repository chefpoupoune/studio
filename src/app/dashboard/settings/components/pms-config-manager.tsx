
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { PmsZone, PmsCriterion, PmsConfigurations } from '../types';
import { PMS_KITCHEN_CLEANING_KEY, PMS_RESTAURANT_CLEANING_KEY, PMS_CONFIG_STORAGE_KEY } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Edit2, Trash2, ListChecks, ShieldAlert, ClipboardEdit, SprayCan, Sparkles } from 'lucide-react';
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
  
  const [currentCategoryKey, setCurrentCategoryKey] = useState<string | null>(null);
  const [editingZone, setEditingZone] = useState<PmsZone | null>(null);
  const [currentZoneForCriterion, setCurrentZoneForCriterion] = useState<PmsZone | null>(null);
  const [editingCriterion, setEditingCriterion] = useState<PmsCriterion | null>(null);

  const { toast } = useToast();

  const zoneForm = useForm<ZoneFormData>({ resolver: zodResolver(zoneSchema), defaultValues: { name: '' } });
  const criterionForm = useForm<CriterionFormData>({ resolver: zodResolver(criterionSchema), defaultValues: { name: '' } });
  
  useEffect(() => {
    try {
      const storedData = localStorage.getItem(PMS_CONFIG_STORAGE_KEY);
      if (storedData) {
        setPmsConfigs(JSON.parse(storedData));
      } else {
        setPmsConfigs({ [PMS_KITCHEN_CLEANING_KEY]: [], [PMS_RESTAURANT_CLEANING_KEY]: [] });
      }
    } catch (error) {
      console.error("Error loading PMS configs:", error);
      setPmsConfigs({ [PMS_KITCHEN_CLEANING_KEY]: [], [PMS_RESTAURANT_CLEANING_KEY]: [] });
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
    if (editingZone) {
      const updatedZones = currentZones.map(z => z.id === editingZone.id ? { ...z, ...data } : z);
      saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedZones });
      toast({ title: "Zone Modifiée", description: `La zone "${data.name}" a été mise à jour.` });
    } else {
      const newZone: PmsZone = { ...data, id: `${currentCategoryKey}_zone_${Date.now()}`, criteria: [] };
      saveConfigs({ ...pmsConfigs, [currentCategoryKey]: [...currentZones, newZone] });
      toast({ title: "Zone Ajoutée", description: `La zone "${data.name}" a été ajoutée.` });
    }
    setIsZoneDialogOpen(false);
  };

  const handleDeleteZone = (categoryKey: string, zoneId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette zone et tous ses critères ?")) {
      const currentZones = pmsConfigs[categoryKey] || [];
      const updatedZones = currentZones.filter(z => z.id !== zoneId);
      saveConfigs({ ...pmsConfigs, [categoryKey]: updatedZones });
      toast({ title: "Zone Supprimée", variant: "destructive" });
    }
  };

  // Criterion Handlers
  const handleOpenCriterionDialog = (categoryKey: string, zone: PmsZone, criterion?: PmsCriterion) => {
    setCurrentCategoryKey(categoryKey);
    setCurrentZoneForCriterion(zone);
    setEditingCriterion(criterion || null);
    criterionForm.reset(criterion ? { name: criterion.name } : { name: '' });
    setIsCriterionDialogOpen(true);
  };

  const handleCriterionSubmit = (data: CriterionFormData) => {
    if (!currentCategoryKey || !currentZoneForCriterion) return;
    const currentZones = pmsConfigs[currentCategoryKey] || [];
    
    const updatedZones = currentZones.map(z => {
      if (z.id === currentZoneForCriterion.id) {
        let updatedCriteria: PmsCriterion[];
        if (editingCriterion) {
          updatedCriteria = z.criteria.map(c => c.id === editingCriterion.id ? { ...c, ...data } : c);
          toast({ title: "Critère Modifié", description: `Le critère "${data.name}" a été mis à jour.` });
        } else {
          const newCriterion: PmsCriterion = { ...data, id: `${currentCategoryKey}_crit_${Date.now()}` };
          updatedCriteria = [...z.criteria, newCriterion];
          toast({ title: "Critère Ajouté", description: `Le critère "${data.name}" a été ajouté à la zone ${z.name}.` });
        }
        return { ...z, criteria: updatedCriteria };
      }
      return z;
    });
    saveConfigs({ ...pmsConfigs, [currentCategoryKey]: updatedZones });
    setIsCriterionDialogOpen(false);
  };

  const handleDeleteCriterion = (categoryKey: string, zoneId: string, criterionId: string) => {
     if (confirm("Êtes-vous sûr de vouloir supprimer ce critère ?")) {
      const currentZones = pmsConfigs[categoryKey] || [];
      const updatedZones = currentZones.map(z => {
        if (z.id === zoneId) {
          return { ...z, criteria: z.criteria.filter(c => c.id !== criterionId) };
        }
        return z;
      });
      saveConfigs({ ...pmsConfigs, [categoryKey]: updatedZones });
      toast({ title: "Critère Supprimé", variant: "destructive" });
    }
  };

  const renderCategoryConfig = (categoryKey: string, categoryLabel: string, IconComponent: React.ElementType) => {
    const zonesForCategory = pmsConfigs[categoryKey] || [];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconComponent className="w-5 h-5 text-primary"/>
            {categoryLabel}
          </CardTitle>
          <CardDescription>Gérez les zones et critères pour {categoryLabel.toLowerCase()}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Button onClick={() => handleOpenZoneDialog(categoryKey)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une Zone à {categoryLabel}
            </Button>
          </div>

          {zonesForCategory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucune zone définie pour {categoryLabel.toLowerCase()}.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {zonesForCategory.map(zone => (
                <AccordionItem value={zone.id} key={zone.id} className="group/item">
                  <div className="flex items-center py-0">
                    <AccordionTrigger className="flex-grow py-4 text-left">
                      {zone.name}
                    </AccordionTrigger>
                    <div className="pl-2 pr-2 space-x-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenZoneDialog(categoryKey, zone)} className="h-7 w-7">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteZone(categoryKey, zone.id)} className="h-7 w-7 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <AccordionContent className="pl-4 pr-2">
                    <div className="mb-3">
                      <Button variant="outline" size="sm" onClick={() => handleOpenCriterionDialog(categoryKey, zone)}>
                        <PlusCircle className="mr-2 h-3 w-3" /> Ajouter Critère
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
                              <Button variant="ghost" size="icon" onClick={() => handleOpenCriterionDialog(categoryKey, zone, criterion)} className="h-6 w-6">
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteCriterion(categoryKey, zone.id, criterion.id)} className="h-6 w-6 hover:text-destructive">
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
    );
  }

  return (
    <div className="space-y-6">
      {renderCategoryConfig(PMS_KITCHEN_CLEANING_KEY, "Suivi Nettoyage Cuisine", SprayCan)}
      {renderCategoryConfig(PMS_RESTAURANT_CLEANING_KEY, "Suivi Nettoyage Restaurant", Sparkles)}
      
      {/* Dialog for Zone */}
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingZone ? "Modifier la Zone" : "Nouvelle Zone"}</DialogTitle>
            {currentCategoryKey && <CardDescription>Pour: {currentCategoryKey === PMS_KITCHEN_CLEANING_KEY ? "Nettoyage Cuisine" : "Nettoyage Restaurant"}</CardDescription>}
          </DialogHeader>
          <Form {...zoneForm}>
            <form onSubmit={zoneForm.handleSubmit(handleZoneSubmit)} className="space-y-4 py-4">
              <FormField control={zoneForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom de la Zone</FormLabel>
                  <FormControl><Input placeholder="Ex: Plans de travail / Salle Principale" {...field} /></FormControl>
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
