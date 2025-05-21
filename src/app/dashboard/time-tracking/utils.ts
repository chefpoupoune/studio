
"use client";

/**
 * Converts a time string "HH:MM" to total minutes.
 * @param timeStr The time string in "HH:MM" format.
 * @returns Total minutes, or 0 if the format is invalid.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) {
    return 0;
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
}

/**
 * Converts total minutes to a time string "HH:MM".
 * @param totalMinutes The total minutes.
 * @returns Time string in "HH:MM" format.
 */
export function minutesToTime(totalMinutes: number): string {
  if (isNaN(totalMinutes) || totalMinutes < 0) {
    return "00:00";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Calculates the duration in minutes between two "HH:MM" time strings.
 * @param startTimeStr Start time string.
 * @param endTimeStr End time string.
 * @returns Duration in minutes, or 0 if times are invalid or end is before start.
 */
export function calculateDurationInMinutes(startTimeStr: string, endTimeStr: string): number {
  const startMinutes = timeToMinutes(startTimeStr);
  const endMinutes = timeToMinutes(endTimeStr);

  if (startMinutes === 0 && endMinutes === 0 && (!startTimeStr || !endTimeStr)) { // Both empty or invalid means no duration
    return 0;
  }
  if (startMinutes === 0 || endMinutes === 0) { // One is empty/invalid, consider duration as 0
    return 0;
  }


  if (endMinutes < startMinutes) { //Handles overnight or invalid entries simply
    return 0; 
  }
  return endMinutes - startMinutes;
}

/**
 * Calculates the total planned hours for a day from morning and afternoon shifts.
 * @param entry The daily schedule entry.
 * @returns Total planned time in "HH:MM" format.
 */
export function calculateDailyPlannedTotal(
  morningStartTime: string,
  morningEndTime: string,
  afternoonStartTime: string,
  afternoonEndTime: string
): string {
  const morningDuration = calculateDurationInMinutes(morningStartTime, morningEndTime);
  const afternoonDuration = calculateDurationInMinutes(afternoonStartTime, afternoonEndTime);
  const totalMinutes = morningDuration + afternoonDuration;
  return minutesToTime(totalMinutes);
}
