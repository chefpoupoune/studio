
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, AlertCircle } from "lucide-react";
import { format, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DailyMenu, MenuField } from '@/app/dashboard/menu-planning/types';

const mealPartLabels: Record<Exclude<MenuField, 'theme'>, string> = {
  entree: "Entrée",
  plat: "Plat",
  feculent: "Féculent",
  legume: "Légume",
  sauce: "Sauce",
  dessert: "Dessert",
};
const mealPartOrder: Exclude<MenuField, 'theme'>[] = ['entree', 'plat', 'feculent', 'legume', 'sauce', 'dessert'];


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
        const itemDateStr = item.date;
        const hasContent = mealPartOrder.some(part => item[part] && item[part].trim() !== '');
        return itemDateStr >= currentWeekStartStr && itemDateStr <= currentWeekEndStr && hasContent;
      });
      setWeeklyMenu(itemsForCurrentWeek);
    }
  }, [isClient]);

  const displayedItems = useMemo(() => {
    return weeklyMenu
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3); // Display up to 3 days with full details
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
          <ScrollArea className="h-[220px] sm:h-[240px] pr-3"> {/* Adjusted height */}
            <ul className="space-y-3"> {/* Increased space-y */}
              {displayedItems.map((item) => (
                <li key={item.date} className="text-sm border-b pb-2 last:border-b-0">
                  <p className="font-semibold text-base capitalize mb-1">
                    {format(parseISO(item.date), "EEEE dd", { locale: fr })}
                  </p>
                  <div className="pl-2 space-y-0.5 text-xs">
                    {mealPartOrder.map(part => {
                      if (item[part] && item[part].trim() !== '') {
                        return (
                          <div key={part} className="flex">
                            <span className="font-medium w-20 shrink-0">{mealPartLabels[part]}:</span>
                            <span className="text-muted-foreground truncate" title={item[part]}>{item[part]}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </li>
              ))}
              {weeklyMenu.length > 3 && <li className="text-xs text-muted-foreground text-center pt-2">... et {weeklyMenu.length - 3} autre(s) jour(s) planifié(s).</li>}
            </ul>
          </ScrollArea>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4 h-full flex flex-col items-center justify-center">
             <AlertCircle className="w-10 h-10 text-muted-foreground/70 mb-2"/>
             <p>Aucun menu planifié pour cette semaine.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
