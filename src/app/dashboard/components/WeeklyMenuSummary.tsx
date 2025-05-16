
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays, AlertCircle } from "lucide-react";
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DailyMenu } from '@/app/dashboard/menu-planning/types'; // Assurez-vous que le chemin est correct

export default function WeeklyMenuSummary() {
  const [weeklyMenu, setWeeklyMenu] = useState<DailyMenu[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [currentWeekInfo, setCurrentWeekInfo] = useState({ start: '', end: '' });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-indexed
      
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      setCurrentWeekInfo({
        start: format(weekStart, "dd MMMM", { locale: fr }),
        end: format(weekEnd, "dd MMMM yyyy", { locale: fr }),
      });

      const menuKey = `menu_planning_${currentYear}_${currentMonth}`;
      const storedMenuData = localStorage.getItem(menuKey);
      
      let fullMonthMenu: DailyMenu[] = [];
      if (storedMenuData) {
        try {
          fullMonthMenu = JSON.parse(storedMenuData);
        } catch (e) {
          console.error("Failed to parse menu data from localStorage", e);
          fullMonthMenu = [];
        }
      }

      const currentWeekStartStr = format(weekStart, 'yyyy-MM-dd');
      const currentWeekEndStr = format(weekEnd, 'yyyy-MM-dd');

      const itemsForCurrentWeek = fullMonthMenu.filter(item => {
        // item.date est déjà au format 'yyyy-MM-dd'
        const itemDateStr = item.date;
        return itemDateStr >= currentWeekStartStr && itemDateStr <= currentWeekEndStr && item.plat && item.plat.trim() !== '';
      });
      setWeeklyMenu(itemsForCurrentWeek);
    }
  }, [isClient]);

  const displayedItems = useMemo(() => {
    return weeklyMenu
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Trier par date
      .slice(0, 4); // Afficher jusqu'à 4 jours
  }, [weeklyMenu]);

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Menu de la Semaine
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          Aperçu du {currentWeekInfo.start} au {currentWeekInfo.end}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        {displayedItems.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {displayedItems.map((item) => (
              <li key={item.date} className="flex">
                <span className="font-medium w-20 shrink-0 capitalize">
                  {format(parseISO(item.date), "EEEE", { locale: fr })}:
                </span>
                <span className="text-muted-foreground truncate" title={item.plat}>{item.plat}</span>
              </li>
            ))}
            {weeklyMenu.length > 4 && <li className="text-xs text-muted-foreground text-center pt-1">... et plus.</li>}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2">
             <AlertCircle className="w-4 h-4"/> Aucun menu planifié pour cette semaine.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
