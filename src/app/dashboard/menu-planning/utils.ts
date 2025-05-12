
"use client";

import { format, startOfWeek, endOfWeek, addWeeks, isSameMonth, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DailyMenu } from './types';

export interface WeekData {
  weekNumberInMonth: number;
  startDate: Date;
  endDate: Date;
  menus: DailyMenu[];
}

export function groupMenusByWeek(year: number, month: number, allMenusForMonth: DailyMenu[]): WeekData[] {
  const weeks: WeekData[] = [];
  if (!allMenusForMonth || allMenusForMonth.length === 0) return weeks;

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let currentIterationDate = startOfWeek(firstDayOfMonth, { locale: fr, weekStartsOn: 1 });
  let weekCounter = 1;

  while (currentIterationDate <= lastDayOfMonth) {
    const weekStartDate = currentIterationDate < firstDayOfMonth ? firstDayOfMonth : currentIterationDate;
    let weekEndDate = endOfWeek(currentIterationDate, { locale: fr, weekStartsOn: 1 });
    weekEndDate = weekEndDate > lastDayOfMonth ? lastDayOfMonth : weekEndDate;

    const weekMenus = allMenusForMonth.filter(menu => {
      const menuDate = parseISO(menu.date); // Dates from menuData are strings
      return menuDate >= weekStartDate && menuDate <= weekEndDate && isSameMonth(menuDate, firstDayOfMonth);
    });
    
    if (weekStartDate <= lastDayOfMonth && weekEndDate >= firstDayOfMonth) {
        weeks.push({
            weekNumberInMonth: weekCounter,
            startDate: weekStartDate,
            endDate: weekEndDate,
            menus: weekMenus,
        });
        weekCounter++;
    }
    currentIterationDate = addWeeks(currentIterationDate, 1);
  }
  return weeks;
}
