
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
