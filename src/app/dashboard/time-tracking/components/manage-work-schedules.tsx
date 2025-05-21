
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { WeeklyWorkSchedule, DailyScheduleEntry, ScheduleTemplateType } from '../types';
import { calculateDailyPlannedTotal, timeToMinutes, minutesToTime } from '../utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DAYS_WITHOUT_SATURDAY: string[] = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"];
const DAYS_WITH_SATURDAY: string[] = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
const WORK_SCHEDULE_TEMPLATES_KEY = "time_tracking_work_schedule_templates_v1";

const createInitialDailyEntry = (dayName: string): DailyScheduleEntry => ({
  dayName,
  morningStartTime: "",
  morningEndTime: "",
  afternoonStartTime: "",
  afternoonEndTime: "",
  plannedTotal: "00:00",
});

const createInitialSchedule = (id: ScheduleTemplateType, name: string, days: string[]): WeeklyWorkSchedule => ({
  id,
  name,
  days: days.map(createInitialDailyEntry),
  weeklyTotal: "00:00",
});

export default function ManageWorkSchedules() {
  const [scheduleWithoutSaturday, setScheduleWithoutSaturday] = useState<WeeklyWorkSchedule>(
    () => createInitialSchedule('without_saturday', "Semaine type (Lundi-Vendredi)", DAYS_WITHOUT_SATURDAY)
  );
  const [scheduleWithSaturday, setScheduleWithSaturday] = useState<WeeklyWorkSchedule>(
    () => createInitialSchedule('with_saturday', "Semaine type (Lundi-Samedi)", DAYS_WITH_SATURDAY)
  );
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        const storedTemplates = localStorage.getItem(WORK_SCHEDULE_TEMPLATES_KEY);
        if (storedTemplates) {
          const parsed = JSON.parse(storedTemplates) as { without_saturday?: WeeklyWorkSchedule, with_saturday?: WeeklyWorkSchedule };
          if (parsed.without_saturday) setScheduleWithoutSaturday(parsed.without_saturday);
          if (parsed.with_saturday) setScheduleWithSaturday(parsed.with_saturday);
        }
      } catch (e) {
        console.error("Error loading work schedule templates:", e);
        toast({ title: "Erreur de chargement des modèles", variant: "destructive" });
      }
    }
  }, [isClient, toast]);

  const updateScheduleEntry = (
    templateType: ScheduleTemplateType,
    dayIndex: number,
    field: keyof Omit<DailyScheduleEntry, 'dayName' | 'plannedTotal'>,
    value: string
  ) => {
    const setter = templateType === 'without_saturday' ? setScheduleWithoutSaturday : setScheduleWithSaturday;
    setter(prevSchedule => {
      const newDays = prevSchedule.days.map((day, i) => {
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
      return { ...prevSchedule, days: newDays, weeklyTotal: minutesToTime(totalWeeklyMinutes) };
    });
  };
  
  const handleSaveTemplates = () => {
    if (!isClient) return;
    localStorage.setItem(WORK_SCHEDULE_TEMPLATES_KEY, JSON.stringify({
      without_saturday: scheduleWithoutSaturday,
      with_saturday: scheduleWithSaturday,
    }));
    toast({ title: "Modèles d'Horaires Sauvegardés", description: "Vos modifications ont été enregistrées localement." });
  };

  const renderScheduleTable = (schedule: WeeklyWorkSchedule, templateType: ScheduleTemplateType) => {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>{schedule.name}</CardTitle>
          <CardDescription>Définissez les horaires pour une semaine type {templateType === 'with_saturday' ? "incluant le samedi" : "sans le samedi"}.</CardDescription>
        </CardHeader>
        <CardContent>
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
                          onChange={(e) => updateScheduleEntry(templateType, dayIndex, field, e.target.value)}
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
    );
  };

  if (!isClient) {
    return <div className="flex justify-center items-center p-8"><AlertCircle className="w-5 h-5 mr-2"/>Chargement des modèles d'horaires...</div>;
  }

  return (
    <div className="space-y-8">
      {renderScheduleTable(scheduleWithoutSaturday, 'without_saturday')}
      {renderScheduleTable(scheduleWithSaturday, 'with_saturday')}
      <div className="flex justify-end mt-6">
        <Button onClick={handleSaveTemplates} size="lg">
          <Save className="mr-2 h-5 w-5" /> Sauvegarder les Modèles
        </Button>
      </div>
    </div>
  );
}
