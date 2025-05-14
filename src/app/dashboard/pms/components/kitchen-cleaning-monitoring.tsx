
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, CheckSquare, Eraser, Info } from 'lucide-react';
import { format, parseISO, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CleaningTask {
  id: string;
  name: string;
  area: string;
  frequency: 'daily'; // Pour l'instant, focus sur le quotidien
}

// Tâches de nettoyage quotidiennes prédéfinies pour la cuisine
const dailyKitchenTasks: CleaningTask[] = [
  { id: 'kc_task_1', name: 'Nettoyage et désinfection des plans de travail', area: 'Surfaces Hautes', frequency: 'daily' },
  { id: 'kc_task_2', name: 'Nettoyage des sols (balayage et lavage)', area: 'Sols', frequency: 'daily' },
  { id: 'kc_task_3', name: 'Nettoyage des éviers, plonge et robinetterie', area: 'Zone Plonge', frequency: 'daily' },
  { id: 'kc_task_4', name: 'Vidage et nettoyage des poubelles (cuisine)', area: 'Gestion Déchets', frequency: 'daily' },
  { id: 'kc_task_5', name: 'Nettoyage extérieur du four et des fourneaux', area: 'Equipements Cuisson', frequency: 'daily' },
  { id: 'kc_task_6', name: 'Nettoyage des grilles et filtres de hotte (si nécessaire)', area: 'Ventilation', frequency: 'daily' },
  { id: 'kc_task_7', name: 'Contrôle et nettoyage intérieur du réfrigérateur/chambre froide', area: 'Stockage Froid', frequency: 'daily' },
  { id: 'kc_task_8', name: 'Nettoyage de la trancheuse (si utilisée)', area: 'Petit Equipement', frequency: 'daily' },
  { id: 'kc_task_9', name: 'Rangement et organisation générale', area: 'Général', frequency: 'daily' },
];

interface TaskLogEntry {
  completed: boolean;
  completedBy: string;
  notes: string;
}

type DailyCleaningLog = Record<string, TaskLogEntry>; // Key: taskId

export default function KitchenCleaningMonitoring() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [dailyLog, setDailyLog] = useState<DailyCleaningLog>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const getLocalStorageKey = useCallback((date: Date) => {
    return `pms_kitchen_cleaning_log_${format(date, 'yyyy-MM-dd')}`;
  }, []);

  // Load log from localStorage
  useEffect(() => {
    setIsLoading(true);
    const dateKey = getLocalStorageKey(selectedDate);
    try {
      const storedLog = localStorage.getItem(dateKey);
      if (storedLog) {
        setDailyLog(JSON.parse(storedLog));
      } else {
        // Initialize with default empty state for all tasks if no log found
        const initialLog: DailyCleaningLog = {};
        dailyKitchenTasks.forEach(task => {
          initialLog[task.id] = { completed: false, completedBy: '', notes: '' };
        });
        setDailyLog(initialLog);
      }
    } catch (error) {
        console.error("Error loading kitchen cleaning log:", error);
        toast({ title: "Erreur de chargement", description: "Les données de nettoyage n'ont pu être chargées.", variant: "destructive" });
        const initialLog: DailyCleaningLog = {};
        dailyKitchenTasks.forEach(task => {
          initialLog[task.id] = { completed: false, completedBy: '', notes: '' };
        });
        setDailyLog(initialLog);
    }
    setIsLoading(false);
  }, [selectedDate, getLocalStorageKey, toast]);

  // Save log to localStorage
  useEffect(() => {
    if (!isLoading) { // Only save if not initially loading to prevent overwriting
      const dateKey = getLocalStorageKey(selectedDate);
      localStorage.setItem(dateKey, JSON.stringify(dailyLog));
    }
  }, [dailyLog, selectedDate, getLocalStorageKey, isLoading]);

  const handleTaskChange = (taskId: string, field: keyof TaskLogEntry, value: string | boolean) => {
    setDailyLog(prevLog => ({
      ...prevLog,
      [taskId]: {
        ...(prevLog[taskId] || { completed: false, completedBy: '', notes: '' }), // Ensure task entry exists
        [field]: value,
      },
    }));
  };
  
  const handleClearDayLog = () => {
     if (confirm(`Êtes-vous sûr de vouloir effacer tous les enregistrements pour le ${format(selectedDate, "dd/MM/yyyy", { locale: fr })} ? Cette action est irréversible.`)) {
        const initialLog: DailyCleaningLog = {};
        dailyKitchenTasks.forEach(task => {
          initialLog[task.id] = { completed: false, completedBy: '', notes: '' };
        });
        setDailyLog(initialLog);
        toast({ title: "Données Effacées", description: `Les enregistrements du ${format(selectedDate, "dd/MM/yyyy", { locale: fr })} ont été réinitialisés.` });
     }
  };

  if (isLoading && !dailyLog) { // Add check for dailyLog to prevent premature render
    return <p>Chargement des données de nettoyage...</p>;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
                <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-6 h-6 text-primary"/>
                Suivi Quotidien du Nettoyage Cuisine
                </CardTitle>
                <CardDescription>
                Enregistrez les tâches de nettoyage effectuées pour la date sélectionnée.
                </CardDescription>
            </div>
            <Button variant="destructive" onClick={handleClearDayLog} size="sm" className="w-full sm:w-auto">
                <Eraser className="mr-2 h-4 w-4" /> Effacer Jour Actuel
            </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="cleaning-date">Date du suivi</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full sm:w-[280px] justify-start text-left font-normal mt-1",
                  !selectedDate && "text-muted-foreground"
                )}
                id="cleaning-date"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP", { locale: fr }) : <span>Choisir une date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                initialFocus
                locale={fr}
              />
            </PopoverContent>
          </Popover>
        </div>

        {dailyKitchenTasks.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                <Info className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                    Aucune tâche de nettoyage n'est configurée pour le moment.
                </p>
            </div>
        ) : (
            <div className="overflow-x-auto border rounded-md">
            <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                    <TableHead className="w-[50px] text-center">Fait</TableHead>
                    <TableHead>Tâche</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead className="w-[150px]">Réalisé par</TableHead>
                    <TableHead className="w-[250px]">Observations</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {dailyKitchenTasks.map((task) => {
                    const logEntry = dailyLog[task.id] || { completed: false, completedBy: '', notes: '' };
                    return (
                    <TableRow key={task.id}>
                        <TableCell className="text-center">
                        <Checkbox
                            checked={logEntry.completed}
                            onCheckedChange={(checked) => handleTaskChange(task.id, 'completed', !!checked)}
                            aria-label={`Marquer ${task.name} comme complétée`}
                        />
                        </TableCell>
                        <TableCell className="font-medium">{task.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{task.area}</TableCell>
                        <TableCell>
                        <Input
                            type="text"
                            placeholder="Initiales"
                            value={logEntry.completedBy}
                            onChange={(e) => handleTaskChange(task.id, 'completedBy', e.target.value)}
                            className="h-8 text-xs"
                            disabled={!logEntry.completed}
                        />
                        </TableCell>
                        <TableCell>
                        <Textarea
                            placeholder="Notes..."
                            value={logEntry.notes}
                            onChange={(e) => handleTaskChange(task.id, 'notes', e.target.value)}
                            className="h-16 text-xs resize-none" // Adjusted height and added resize-none
                            disabled={!logEntry.completed}
                        />
                        </TableCell>
                    </TableRow>
                    );
                })}
                </TableBody>
            </Table>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
