
"use client";

import { format, startOfWeek, endOfWeek, addWeeks, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DailyMenu } from './types';

export interface WeekData {
  weekNumberInMonth: number;
  startDate: Date;
  endDate: Date;
  menus: DailyMenu[];
}

// Helper function to parse a YYYY-MM-DD string as a local date.
function parseDateAsLocal(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    // Create a date in the local timezone.
    return new Date(year, month - 1, day);
}

export function groupMenusByWeek(year: number, month: number, allMenusForMonth: DailyMenu[]): WeekData[] {
  const weeks: WeekData[] = [];
  if (!allMenusForMonth) {
    return weeks;
  }

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let currentWeekStart = startOfWeek(firstDayOfMonth, { locale: fr, weekStartsOn: 1 });
  let weekCounter = 1;

  while (currentWeekStart <= lastDayOfMonth) {
    const currentWeekEnd = endOfWeek(currentWeekStart, { locale: fr, weekStartsOn: 1 });

    const weekMenus = allMenusForMonth.filter(menu => {
      const menuDate = parseDateAsLocal(menu.date);
      // Only include menus that are in the current month
      return isSameMonth(menuDate, firstDayOfMonth) && 
             menuDate >= currentWeekStart && 
             menuDate <= currentWeekEnd;
    });

    // Add week if it overlaps with the current month
    if (currentWeekStart <= lastDayOfMonth && currentWeekEnd >= firstDayOfMonth) {
        weeks.push({
            weekNumberInMonth: weekCounter,
            startDate: currentWeekStart, // Use the real week start
            endDate: currentWeekEnd,       // Use the real week end
            menus: weekMenus,
        });
        weekCounter++;
    }

    currentWeekStart = addWeeks(currentWeekStart, 1);
  }
  return weeks;
}
