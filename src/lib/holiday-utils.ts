
import { addDays, setDate, setMonth, setYear, startOfDay } from 'date-fns';

/**
 * Calculates the date of Easter Sunday for a given year.
 * Uses the Anonymous Gregorian algorithm.
 * @param year The year for which to calculate Easter.
 * @returns The Date object for Easter Sunday.
 */
export function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // Month (1 = January, ..., 12 = December)
  const day = ((h + l - 7 * m + 114) % 31) + 1; // Day of the month
  return startOfDay(new Date(year, month - 1, day));
}

export interface PublicHoliday {
  date: Date;
  name: string;
}

/**
 * Calculates French public holidays for a given year.
 * @param year The year for which to calculate public holidays.
 * @returns An array of PublicHoliday objects.
 */
export function getFrenchPublicHolidays(year: number): PublicHoliday[] {
  const easterSunday = getEaster(year);
  const holidays: PublicHoliday[] = [];

  // Nouvel An
  holidays.push({ date: startOfDay(setMonth(setDate(new Date(year, 0, 1), 1), 0)), name: "Nouvel An" });

  // Lundi de Pâques
  holidays.push({ date: addDays(easterSunday, 1), name: "Lundi de Pâques" });

  // Fête du Travail
  holidays.push({ date: startOfDay(setMonth(setDate(new Date(year, 0, 1), 1), 4)), name: "Fête du Travail" });

  // Victoire 1945
  holidays.push({ date: startOfDay(setMonth(setDate(new Date(year, 0, 1), 8), 4)), name: "Victoire 1945" });

  // Ascension
  holidays.push({ date: addDays(easterSunday, 39), name: "Ascension" });

  // Lundi de Pentecôte
  // Pentecost Sunday is 49 days after Easter Sunday
  // Whit Monday (Pentecost Monday) is 50 days after Easter Sunday
  holidays.push({ date: addDays(easterSunday, 50), name: "Lundi de Pentecôte" });
  
  // Fête Nationale
  holidays.push({ date: startOfDay(setMonth(setDate(new Date(year, 0, 1), 14), 6)), name: "Fête Nationale" });

  // Assomption
  holidays.push({ date: startOfDay(setMonth(setDate(new Date(year, 0, 1), 15), 7)), name: "Assomption" });

  // Toussaint
  holidays.push({ date: startOfDay(setMonth(setDate(new Date(year, 0, 1), 1), 10)), name: "Toussaint" });

  // Armistice 1918
  holidays.push({ date: startOfDay(setMonth(setDate(new Date(year, 0, 1), 11), 10)), name: "Armistice 1918" });

  // Noël
  holidays.push({ date: startOfDay(setMonth(setDate(new Date(year, 0, 1), 25), 11)), name: "Noël" });
  
  return holidays;
}
