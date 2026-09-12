
import { getWeek, format, addDays } from 'date-fns';

// Helper function to get the Monday of a specific ISO week.
function getDateOfISOWeek(weekId: string): Date {
    try {
        const [year, week] = weekId.split('-').map(Number);
        if (isNaN(year) || isNaN(week)) throw new Error("Invalid weekId format");
        
        // Create a date in the target year, then find the Monday of the target week.
        const d = new Date(year, 0, 1 + (week - 1) * 7);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
        return new Date(d.setDate(diff));
    } catch (e) {
        console.error(`[getDateOfISOWeek] Failed to parse weekId: ${weekId}`, e);
        return new Date(); // Fallback to current date
    }
}

/**
 * Generates a unique week identifier from a date (e.g., "2024-23").
 * Uses ISO 8601 week numbering, starting on a Monday.
 * @param date The date to get the week ID for.
 */
export function getWeekId(date: Date): string {
  try {
    const weekNumber = getWeek(date, { weekStartsOn: 1 });
    return `${date.getFullYear()}-${weekNumber}`;
  } catch(e) {
      console.error("[getWeekId] Failed to generate Week ID from date:", date, e);
      // Fallback for safety
      const weekNumber = Math.ceil(new Date().getDate() / 7);
      return `${new Date().getFullYear()}-${weekNumber}`;
  }
}

/**
 * Returns a display string for a week's date range (Monday to Friday) from a weekId.
 * @param weekId The week identifier ("YYYY-WW").
 * @returns A string like "DD/MM au DD/MM".
 */
export function getWeekDateRange(weekId: string): string {
  if (!weekId || !weekId.includes('-')) {
    return "Semaine invalide";
  }
  try {
    const monday = getDateOfISOWeek(weekId);
    const friday = addDays(monday, 4);
    return `${format(monday, 'dd/MM')} au ${format(friday, 'dd/MM')}`;
  } catch (e) {
    console.error(`[getWeekDateRange] Failed to generate date range for weekId: ${weekId}`, e);
    return "Plage de dates indisponible";
  }
}

/**
 * Formats a decimal hour value into a string like "Xh Ymin".
 * Handles positive and negative values correctly.
 * @param decimalHours The decimal hour value.
 */
export function formatHours(decimalHours: number): string {
  if (isNaN(decimalHours)) {
    return "0h";
  }

  const hours = Math.trunc(decimalHours); // Use trunc to get the integer part (-7.5 -> -7)
  const minutes = Math.round(Math.abs(decimalHours - hours) * 60);

  // Handle rounding cases where minutes become 60
  if (minutes === 60) {
    const newHours = hours + (decimalHours > 0 ? 1 : -1);
    return `${newHours}h`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${minutes}min`;
}
