
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { WeeklyWorkSchedule, DailyScheduleEntry } from '../types';
import { calculateDailyPlannedTotal, timeToMinutes, minutesToTime } from '../utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, PlusCircle, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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

const DAYS_OF_WEEK: string[] = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"];
const WORK_SCHEDULE_CUSTOM_TEMPLATES_KEY = "time_tracking_custom_schedule_templates_v2";

const createInitialDailyEntry = (dayName: string): DailyScheduleEntry => ({
  dayName,
  morningStartTime: "",
  morningEndTime: "",
  afternoonStartTime: "",
  afternoonEndTime: "",
  plannedTotal: "00:00",
});

const templateFormSchema = z.object({
  name: z.string().min(1, "Le nom du modèle est requis."),
  includesSaturday: z.boolean().default(false),
});
type TemplateFormData = z.infer<typeof templateFormSchema>;

export default function ManageWorkSchedules() {
  const [scheduleTemplates, setScheduleTemplates] = useState<WeeklyWorkSchedule[]>([]);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WeeklyWorkSchedule | null>(null);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  const templateForm = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: { name: '', includesSaturday: false },
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        const storedTemplates = localStorage.getItem(WORK_SCHEDULE_CUSTOM_TEMPLATES_KEY);
        if (storedTemplates) {
          setScheduleTemplates(JSON.parse(storedTemplates));
        } else {
          setScheduleTemplates([]); // Start with no templates by default
        }
      } catch (e) {
        console.error("Error loading custom work schedule templates:", e);
        toast({ title: "Erreur de chargement des modèles d'horaires", variant: "destructive" });
        setScheduleTemplates([]);
      }
    }
  }, [isClient, toast]);

  const updateScheduleEntry = (
    templateId: string,
    dayIndex: number,
    field: keyof Omit<DailyScheduleEntry, 'dayName' | 'plannedTotal'>,
    value: string
  ) => {
    setScheduleTemplates(prevTemplates =>
      prevTemplates.map(template => {
        if (template.id === templateId) {
          const newDays = template.days.map((day, i) => {
            if (i === dayIndex) {
              const updatedDay = { ...day, [field]: value };
              const newPlannedTotal = calculateDailyPlannedTotal(
                updatedDay.morningStartTime,
                updatedDay.morningEndTime,
                updatedDay.afternoonStartTime,
                updatedDay.afternoonEndTime
              );
              return { ...updatedDay, plannedTotal: newPlannedTotal };
            }
            return day;
          });
          const totalWeeklyMinutes = newDays.reduce((acc, day) => acc + timeToMinutes(day.plannedTotal), 0);
          return { ...template, days: newDays, weeklyTotal: minutesToTime(totalWeeklyMinutes) };
        }
        return template;
      })
    );
  };

  const handleApplicationNotesChange = (templateId: string, notes: string) => {
    setScheduleTemplates(prevTemplates =>
      prevTemplates.map(template =>
        template.id === templateId ? { ...template, applicationNotes: notes } : template
      )
    );
  };

  const handleSaveAllTemplates = () => {
    if (!isClient) return;
    localStorage.setItem(WORK_SCHEDULE_CUSTOM_TEMPLATES_KEY, JSON.stringify(scheduleTemplates));
    toast({ title: "Modèles d'Horaires Sauvegardés", description: "Vos modifications ont été enregistrées localement." });
  };

  const handleOpenTemplateForm = (template?: WeeklyWorkSchedule) => {
    setEditingTemplate(template || null);
    if (template) {
      templateForm.reset({ name: template.name, includesSaturday: template.includesSaturday });
    } else {
      templateForm.reset({ name: '', includesSaturday: false });
    }
    setIsTemplateFormOpen(true);
  };

  const handleTemplateFormSubmit = (data: TemplateFormData) => {
    if (editingTemplate) {
      // If includesSaturday changed, we need to regenerate the days array
      const daysToUse = data.includesSaturday ? DAYS_OF_WEEK.slice(0, 6) : DAYS_OF_WEEK.slice(0, 5);
      const existingDaysData = editingTemplate.includesSaturday === data.includesSaturday ? editingTemplate.days : daysToUse.map(dayName => createInitialDailyEntry(dayName));

      setScheduleTemplates(prev => prev.map(t =>
        t.id === editingTemplate.id ? { 
          ...t, 
          name: data.name, 
          includesSaturday: data.includesSaturday,
          days: existingDaysData.filter(d => daysToUse.includes(d.dayName)), // ensure correct days
          // weeklyTotal will be recalculated by updateScheduleEntry if times change
        } : t
      ));
      toast({ title: "Modèle Modifié", description: `Le modèle "${data.name}" a été mis à jour.` });
    } else {
      const days = data.includesSaturday ? DAYS_OF_WEEK.slice(0, 6) : DAYS_OF_WEEK.slice(0, 5);
      const newTemplate: WeeklyWorkSchedule = {
        id: `schedule_template_${Date.now()}`,
        name: data.name,
        includesSaturday: data.includesSaturday,
        days: days.map(dayName => createInitialDailyEntry(dayName)),
        weeklyTotal: "00:00",
        applicationNotes: "",
      };
      setScheduleTemplates(prev => [...prev, newTemplate]);
      toast({ title: "Modèle Créé", description: `Le modèle "${data.name}" a été créé.` });
    }
    setIsTemplateFormOpen(false);
  };

  const handleDeleteTemplate = (templateId: string, templateName: string) => {
    setScheduleTemplates(prev => prev.filter(t => t.id !== templateId));
    toast({ title: "Modèle Supprimé", description: `Le modèle "${templateName}" a été supprimé.`, variant: "destructive" });
  };


  if (!isClient) {
    return <div className="flex justify-center items-center p-8">Chargement des modèles d'horaires...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Vos Modèles d'Horaires Hebdomadaires</h2>
        <Dialog open={isTemplateFormOpen} onOpenChange={setIsTemplateFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenTemplateForm()}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un Modèle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Modifier le Modèle" : "Nouveau Modèle d'Horaire"}</DialogTitle>
            </DialogHeader>
            <Form {...templateForm}>
              <form onSubmit={templateForm.handleSubmit(handleTemplateFormSubmit)} className="space-y-4 py-4">
                <FormField control={templateForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du Modèle</FormLabel>
                    <FormControl><Input placeholder="Ex: Haute Saison (L-S)" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={templateForm.control} name="includesSaturday" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
                     <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">Inclure le Samedi ?</FormLabel>
                    </div>
                  </FormItem>
                )} />
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                  <Button type="submit">{editingTemplate ? "Enregistrer" : "Créer Modèle"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {scheduleTemplates.length === 0 && (
        <p className="text-muted-foreground text-center py-6">Aucun modèle d'horaire créé. Cliquez sur "Ajouter un Modèle" pour commencer.</p>
      )}

      {scheduleTemplates.map((schedule) => (
        <Card key={schedule.id} className="shadow-md">
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle>{schedule.name}</CardTitle>
                    <CardDescription>
                        Modèle d'horaires hebdomadaires {schedule.includesSaturday ? "(Lundi-Samedi)" : "(Lundi-Vendredi)"}.
                    </CardDescription>
                </div>
                <div className="space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenTemplateForm(schedule)} className="h-8 w-8">
                        <Edit2 className="h-4 w-4"/>
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer le modèle "{schedule.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                Cette action est irréversible.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTemplate(schedule.id, schedule.name)}>
                                Supprimer
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label htmlFor={`application-notes-${schedule.id}`} className="text-sm font-medium">
                Période d'application type (notes) :
              </Label>
              <Input
                id={`application-notes-${schedule.id}`}
                type="text"
                value={schedule.applicationNotes || ""}
                onChange={(e) => handleApplicationNotesChange(schedule.id, e.target.value)}
                placeholder="Ex: Septembre à Mai, sauf jours fériés"
                className="mt-1"
              />
            </div>
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Jour</TableHead>
                    <TableHead>Début matin</TableHead>
                    <TableHead>Fin matin</TableHead>
                    <TableHead>Début après-midi</TableHead>
                    <TableHead>Fin après-midi</TableHead>
                    <TableHead>Total prévu</TableHead>
                    <TableHead>Pause 20'</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.days.map((day, dayIndex) => (
                    <TableRow key={day.dayName}>
                      <TableCell className="font-medium">{day.dayName}</TableCell>
                      {(['morningStartTime', 'morningEndTime', 'afternoonStartTime', 'afternoonEndTime'] as const).map(field => (
                        <TableCell key={field} className="p-1">
                          <Input
                            type="time"
                            value={day[field]}
                            onChange={(e) => updateScheduleEntry(schedule.id, dayIndex, field, e.target.value)}
                            className="h-8 text-sm w-28"
                          />
                        </TableCell>
                      ))}
                      <TableCell className="font-semibold text-center bg-green-100 dark:bg-green-800/30">
                        {day.plannedTotal}
                      </TableCell>
                      <TableCell className="text-center">-</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/80">
                    <TableCell colSpan={5} className="text-right font-bold">TOTAL SEMAINE</TableCell>
                    <TableCell className="font-extrabold text-center text-lg text-primary bg-blue-100 dark:bg-blue-800/40">
                      {schedule.weeklyTotal}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {scheduleTemplates.length > 0 && (
        <div className="flex justify-end mt-6">
            <Button onClick={handleSaveAllTemplates} size="lg">
            <Save className="mr-2 h-5 w-5" /> Sauvegarder Tous les Modèles
            </Button>
        </div>
      )}
    </div>
  );
}
