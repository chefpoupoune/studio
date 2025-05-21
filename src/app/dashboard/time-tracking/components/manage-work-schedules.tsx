
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { WeeklyWorkSchedule, DailyScheduleEntry, BrigadeMember } from '../types';
import { calculateDailyPlannedTotal, timeToMinutes, minutesToTime } from '../utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, PlusCircle, Edit2, Trash2, Filter, Lock } from "lucide-react"; // Added Lock
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { RubricId } from '@/app/dashboard/settings/components/user-management';

const DAYS_OF_WEEK: string[] = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"];

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

interface ManageWorkSchedulesProps {
  initialScheduleTemplates: WeeklyWorkSchedule[];
  brigadeMembers: BrigadeMember[];
  onScheduleTemplatesChange: (updatedTemplates: WeeklyWorkSchedule[]) => void;
  loggedInUsername: string | null;
  userPermissions: Partial<Record<RubricId, boolean>>;
}

const ALL_MODELS_FILTER_VALUE = "_ALL_MODELS_";

export default function ManageWorkSchedules({ 
  initialScheduleTemplates, 
  brigadeMembers, 
  onScheduleTemplatesChange,
  loggedInUsername,
  userPermissions
}: ManageWorkSchedulesProps) {
  const [scheduleTemplates, setScheduleTemplates] = useState<WeeklyWorkSchedule[]>(initialScheduleTemplates);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WeeklyWorkSchedule | null>(null);
  const [selectedMemberIdForFilter, setSelectedMemberIdForFilter] = useState<string>(ALL_MODELS_FILTER_VALUE);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setScheduleTemplates(initialScheduleTemplates);
  }, [initialScheduleTemplates]);

  const isChef = useMemo(() => loggedInUsername?.toLowerCase() === 'chef', [loggedInUsername]);
  const canUserViewOwnSchedules = useMemo(() => userPermissions?.canViewOwnSchedule === true, [userPermissions]);
  const canManageTemplates = useMemo(() => isChef, [isChef]); // Only Chef can manage templates globally

  const updateScheduleEntry = (
    templateId: string,
    dayIndex: number,
    field: keyof Omit<DailyScheduleEntry, 'dayName' | 'plannedTotal'>,
    value: string
  ) => {
    if (!canManageTemplates) return; // Prevent updates if not allowed
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
    if (!canManageTemplates) return; // Prevent updates if not allowed
    setScheduleTemplates(prevTemplates =>
      prevTemplates.map(template =>
        template.id === templateId ? { ...template, applicationNotes: notes } : template
      )
    );
  };

  const handleSaveAllTemplates = () => {
    if (!isClient || !canManageTemplates) return;
    onScheduleTemplatesChange(scheduleTemplates); 
    toast({ title: "Modèles d'Horaires Sauvegardés", description: "Vos modifications ont été enregistrées." });
  };

  const templateForm = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: { name: '', includesSaturday: false },
  });

  const handleOpenTemplateForm = (template?: WeeklyWorkSchedule) => {
    if (!canManageTemplates) return;
    setEditingTemplate(template || null);
    if (template) {
      templateForm.reset({ name: template.name, includesSaturday: template.includesSaturday });
    } else {
      templateForm.reset({ name: '', includesSaturday: false });
    }
    setIsTemplateFormOpen(true);
  };

  const handleTemplateFormSubmit = (data: TemplateFormData) => {
    if (!canManageTemplates) return;
    let updatedTemplates;
    if (editingTemplate) {
      updatedTemplates = scheduleTemplates.map(t => {
        if (t.id === editingTemplate.id) {
          const daysToUse = data.includesSaturday ? DAYS_OF_WEEK.slice(0, 6) : DAYS_OF_WEEK.slice(0, 5);
          const existingDaysData = t.includesSaturday === data.includesSaturday 
            ? t.days 
            : daysToUse.map(dayName => createInitialDailyEntry(dayName));
          
          const filteredDays = existingDaysData.filter(d => daysToUse.includes(d.dayName));
          daysToUse.forEach(dayName => {
            if (!filteredDays.find(d => d.dayName === dayName)) {
              filteredDays.push(createInitialDailyEntry(dayName));
            }
          });
          filteredDays.sort((a, b) => DAYS_OF_WEEK.indexOf(a.dayName) - DAYS_OF_WEEK.indexOf(b.dayName));

          const totalWeeklyMinutes = filteredDays.reduce((acc, day) => acc + timeToMinutes(day.plannedTotal), 0);

          return { 
            ...t, 
            name: data.name, 
            includesSaturday: data.includesSaturday,
            days: filteredDays,
            weeklyTotal: minutesToTime(totalWeeklyMinutes),
          };
        }
        return t;
      });
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
      updatedTemplates = [...scheduleTemplates, newTemplate];
      toast({ title: "Modèle Créé", description: `Le modèle "${data.name}" a été créé.` });
    }
    setScheduleTemplates(updatedTemplates);
    onScheduleTemplatesChange(updatedTemplates); 
    setIsTemplateFormOpen(false);
  };

  const handleDeleteTemplate = (templateId: string, templateName: string) => {
    if (!canManageTemplates) return;
    const updatedTemplates = scheduleTemplates.filter(t => t.id !== templateId);
    setScheduleTemplates(updatedTemplates);
    onScheduleTemplatesChange(updatedTemplates); 
    toast({ title: "Modèle Supprimé", description: `Le modèle "${templateName}" a été supprimé.`, variant: "destructive" });
  };

  const displayedScheduleTemplates = useMemo(() => {
    if (isChef) {
      if (selectedMemberIdForFilter === ALL_MODELS_FILTER_VALUE || !selectedMemberIdForFilter) {
        return scheduleTemplates;
      }
      const selectedMember = brigadeMembers.find(m => m.id === selectedMemberIdForFilter);
      if (!selectedMember || !selectedMember.assignedScheduleTemplateIds || selectedMember.assignedScheduleTemplateIds.length === 0) {
        return [];
      }
      return scheduleTemplates.filter(st => selectedMember.assignedScheduleTemplateIds?.includes(st.id));
    } else if (canUserViewOwnSchedules) {
      const currentUserBrigadeMember = brigadeMembers.find(bm => bm.name.toLowerCase() === loggedInUsername?.toLowerCase());
      if (!currentUserBrigadeMember || !currentUserBrigadeMember.assignedScheduleTemplateIds || currentUserBrigadeMember.assignedScheduleTemplateIds.length === 0) {
        return [];
      }
      return scheduleTemplates.filter(st => currentUserBrigadeMember.assignedScheduleTemplateIds?.includes(st.id));
    }
    return []; // Default to no templates if no permissions
  }, [scheduleTemplates, selectedMemberIdForFilter, brigadeMembers, isChef, canUserViewOwnSchedules, loggedInUsername]);


  if (!isClient) {
    return <div className="flex justify-center items-center p-8">Chargement des modèles d'horaires...</div>;
  }
  
  if (!isChef && !canUserViewOwnSchedules && userPermissions?.timeTracking_schedules) {
     return (
        <div className="text-muted-foreground text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm">
                Vous n'avez pas la permission de consulter les détails des modèles d'horaires.
            </p>
            <p className="text-xs text-muted-foreground/70">Contactez un administrateur pour obtenir les droits.</p>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {isChef && (
          <div className="w-full sm:w-auto sm:flex-grow">
            <Label htmlFor="member-filter-select" className="text-sm">Filtrer les modèles par employé assigné :</Label>
            <Select value={selectedMemberIdForFilter} onValueChange={setSelectedMemberIdForFilter}>
              <SelectTrigger id="member-filter-select" className="mt-1">
                <SelectValue placeholder="Filtrer par employé..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MODELS_FILTER_VALUE}>Afficher tous les modèles</SelectItem>
                {brigadeMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>{member.name} ({member.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {canManageTemplates && (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 self-end">
                <Dialog open={isTemplateFormOpen} onOpenChange={setIsTemplateFormOpen}>
                <DialogTrigger asChild>
                    <Button onClick={() => handleOpenTemplateForm()} className="w-full sm:w-auto">
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
                <Button onClick={handleSaveAllTemplates} className="w-full sm:w-auto">
                    <Save className="mr-2 h-4 w-4" /> Sauvegarder Modèles
                </Button>
            </div>
        )}
      </div>

      {scheduleTemplates.length === 0 && canManageTemplates ? (
        <p className="text-muted-foreground text-center py-6">Aucun modèle d'horaire créé. Cliquez sur "Ajouter un Modèle" pour commencer.</p>
      ) : displayedScheduleTemplates.length === 0 && isChef && selectedMemberIdForFilter !== ALL_MODELS_FILTER_VALUE ? (
         <p className="text-muted-foreground text-center py-6">
            Aucun modèle d'horaire assigné à {brigadeMembers.find(m => m.id === selectedMemberIdForFilter)?.name || 'cet employé'}.
            <br/>
            <Button variant="link" onClick={() => setSelectedMemberIdForFilter(ALL_MODELS_FILTER_VALUE)}>Voir tous les modèles</Button>
         </p>
      ): displayedScheduleTemplates.length === 0 && !isChef && canUserViewOwnSchedules ? (
         <p className="text-muted-foreground text-center py-6">
            Aucun modèle d'horaire ne vous est assigné.
         </p>
      ) : (
        displayedScheduleTemplates.map((schedule) => (
          <Card key={schedule.id} className="shadow-md">
            <CardHeader>
              <div className="flex justify-between items-start">
                  <div>
                      <CardTitle className="flex items-center gap-2">
                        {schedule.name}
                        {isChef && selectedMemberIdForFilter !== ALL_MODELS_FILTER_VALUE && brigadeMembers.find(m => m.id === selectedMemberIdForFilter) && (
                            <Badge variant="outline" className="text-xs font-normal">
                                Assigné à {brigadeMembers.find(m => m.id === selectedMemberIdForFilter)?.name}
                            </Badge>
                        )}
                        {!isChef && loggedInUsername && (
                             <Badge variant="outline" className="text-xs font-normal">
                                Assigné à vous ({loggedInUsername})
                            </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                          Modèle d'horaires hebdomadaires {schedule.includesSaturday ? "(Lundi-Samedi)" : "(Lundi-Vendredi)"}.
                      </CardDescription>
                  </div>
                  {canManageTemplates && (
                    <div className="space-x-1 flex-shrink-0">
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
                  )}
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
                  disabled={!canManageTemplates}
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
                              disabled={!canManageTemplates}
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
        ))
      )}
    </div>
  );
}

