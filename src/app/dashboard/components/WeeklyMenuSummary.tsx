
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, AlertCircle } from "lucide-react";
import { format, startOfWeek, endOfWeek, parseISO, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DailyMenu, MenuField, MenuThemeIdentifier, StoredMenuThemeValue } from '@/app/dashboard/menu-planning/types';
import { menuThemeStyles, MENU_THEME_OPTIONS_FOR_SELECT } from '@/app/dashboard/menu-planning/types';
import { cn } from '@/lib/utils';

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
      
      const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Sunday
      setCurrentWeekInfo({
        start: format(weekStart, "dd MMMM", { locale: fr }),
        end: format(weekEnd, "dd MMMM yyyy", { locale: fr }),
      });

      // Attempt to load current month's menu
      const currentMonthMenuKey = `menu_planning_${currentYear}_${currentMonth}`;
      let fullMonthMenu: DailyMenu[] = [];
      const storedCurrentMonthMenuData = localStorage.getItem(currentMonthMenuKey);
      if (storedCurrentMonthMenuData) {
        try {
          fullMonthMenu = JSON.parse(storedCurrentMonthMenuData);
        } catch (e) {
          console.error("Failed to parse current month menu data from localStorage", e);
        }
      }

      // If week spans across two months, attempt to load next month's menu too
      if (weekEnd.getMonth() !== currentMonth) {
        const nextMonth = (currentMonth + 1) % 12;
        const yearForNextMonth = nextMonth === 0 ? currentYear + 1 : currentYear;
        const nextMonthMenuKey = `menu_planning_${yearForNextMonth}_${nextMonth}`;
        const storedNextMonthMenuData = localStorage.getItem(nextMonthMenuKey);
        if (storedNextMonthMenuData) {
          try {
            const nextMonthParsed = JSON.parse(storedNextMonthMenuData);
            fullMonthMenu = fullMonthMenu.concat(nextMonthParsed);
          } catch (e) {
            console.error("Failed to parse next month menu data from localStorage", e);
          }
        }
      }
      
      const currentWeekStartStr = format(weekStart, 'yyyy-MM-dd');
      const currentWeekEndStr = format(weekEnd, 'yyyy-MM-dd');

      const itemsForCurrentWeek = fullMonthMenu.filter(item => {
        if (!item || !item.date) return false;
        try {
            const itemDate = parseISO(item.date);
            if (!isValid(itemDate)) return false;
            const itemDateStr = format(itemDate, 'yyyy-MM-dd');
            const hasContent = mealPartOrder.some(part => item[part] && String(item[part]).trim() !== '');
            return itemDateStr >= currentWeekStartStr && itemDateStr <= currentWeekEndStr && hasContent;
        } catch (e) {
            console.warn(`Skipping invalid date in menu data: ${item.date}`, e);
            return false;
        }
      });
      setWeeklyMenu(itemsForCurrentWeek);
    }
  }, [isClient]);
  
  const isValid = (date: Date) => !isNaN(date.getTime());

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
          <ScrollArea className="h-[220px] sm:h-[240px] pr-3">
            <ul className="space-y-2">
              {displayedItems.map((item) => (
                <li key={item.date} className="text-sm border-b pb-3 last:border-b-0 last:pb-0 mb-2 last:mb-0">
                  <p className="font-semibold text-base capitalize mb-1.5 text-primary">
                    {format(parseISO(item.date), "EEEE dd", { locale: fr })}
                    {item.theme && item.theme !== '' && (
                        <span className={cn(
                            "ml-2 text-xs font-medium px-1.5 py-0.5 rounded-sm",
                            menuThemeStyles[item.theme as MenuThemeIdentifier] || 'bg-muted text-muted-foreground'
                        )}>
                            {MENU_THEME_OPTIONS_FOR_SELECT.find(opt => opt.value === item.theme)?.label || item.theme}
                        </span>
                    )}
                  </p>
                  <ul className="space-y-0.5 text-xs pl-3 list-disc list-outside marker:text-primary/70">
                    {mealPartOrder.map(part => {
                      const mealContent = item[part];
                      if (mealContent && String(mealContent).trim() !== '') {
                        return (
                          <li key={part}>
                            <span className="font-medium text-foreground/90">{mealPartLabels[part]}:</span>
                            <span className="text-muted-foreground ml-1">{String(mealContent)}</span>
                          </li>
                        );
                      }
                      return null;
                    })}
                  </ul>
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
