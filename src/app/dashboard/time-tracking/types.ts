
export interface BrigadeMember {
  id: string;
  name: string;
  role: string; // e.g., "Chef de Cuisine", "Second", "Cuisinier", "Plongeur"
}

export interface TimeEntry {
  id: string;
  memberId: string;
  memberName: string; // Denormalized for easier display
  date: Date;
  hours: number; // Always positive
  type: 'addition' | 'deduction'; // Type of time entry
  reason: string;
}

// New types for Weekly Work Schedules
export interface DailyScheduleEntry {
  dayName: string;
  morningStartTime: string;
  morningEndTime: string;
  afternoonStartTime: string;
  afternoonEndTime: string;
  plannedTotal: string; // Calculated, e.g., "07:30"
}

export type ScheduleTemplateType = 'without_saturday' | 'with_saturday';

export interface WeeklyWorkSchedule {
  id: ScheduleTemplateType;
  name: string;
  days: DailyScheduleEntry[];
  weeklyTotal: string; // Calculated, e.g., "37:30"
}
