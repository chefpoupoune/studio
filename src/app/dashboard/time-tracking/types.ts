
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

export type ScheduleTemplateType = 'without_saturday' | 'with_saturday'; // This type might become less relevant if we allow dynamic creation

export interface WeeklyWorkSchedule {
  id: string; // Unique ID for each template
  name: string; // User-defined name for the template
  includesSaturday: boolean; // Defines if the schedule is L-V or L-S
  days: DailyScheduleEntry[];
  weeklyTotal: string; // Calculated, e.g., "37:30"
  applicationNotes?: string; // Notes for when this template typically applies
}
