
import { getDaysInMonth, startOfMonth, addDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';

export interface DayData {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  dayName: string;
  isWeekend: boolean;
}

export function getMonthDays(year: number, month: number): DayData[] {
  const daysInMonth = getDaysInMonth(new Date(year, month));
  const firstDay = startOfMonth(new Date(year, month));
  const daysArray: DayData[] = [];

  for (let i = 0; i < daysInMonth; i++) {
    const currentDate = addDays(firstDay, i);
    const dayOfWeek = currentDate.getDay();
    daysArray.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      dayOfMonth: i + 1,
      dayName: format(currentDate, 'EEEE', { locale: fr }),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }
  return daysArray;
}
