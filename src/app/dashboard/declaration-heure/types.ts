
export type OvertimeRequestStatus = 'en_attente' | 'approuvee' | 'refusee'; // For initial simple display
export type ScheduleChangeRequestStatus = 'en_attente' | 'approuvee' | 'refusee';
export type AbsenceRequestStatus = 'en_attente' | 'approuvee' | 'refusee'; // Added for consistency

export type PrestationType = 'hebergement' | 'educatif' | 'administratif' | 'logistique' | 'medico_psycho_sociale' | 'autres';

export const PRESTATION_TYPE_LABELS: Record<PrestationType, string> = {
  hebergement: "Hébergement",
  educatif: "Educatif",
  administratif: "Administratif",
  logistique: "Logistique",
  medico_psycho_sociale: "Médico-psycho-sociale",
  autres: "Autres, précisez",
};

export interface OvertimeDayDetail {
  id: string;
  date: string; // ISO string yyyy-MM-dd for storage
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

export interface OvertimeRequest {
  id: string;
  employeeName: string;
  brigadeMemberId: string;
  requestDate: string; // ISO string for creation date
  updatedAt?: string; // ISO string for last update
  
  position?: string; 
  
  prestationTypes?: PrestationType[]; 
  prestationTypeAutresDetail?: string;

  reasonStub: string; 

  overtimeDetails?: OvertimeDayDetail[];
  totalOvertimeHours?: string; 

  employeeSignatureDate?: string | null; 
  directManagerSignatureDate?: string | null; 
  directorSignatureDate?: string | null; 

  approvalStatus?: 'pending' | 'accepted' | 'rejected'; 
  // For simpler display, map to OvertimeRequestStatus when needed
  // approvalStatus: 'pending' -> 'en_attente'
  rejectionReason?: string;
  // compensationType?: 'recovery' | 'payment'; // Removed as per user request
  decisionDate?: string | null; 
}

export interface ScheduleChangeDayDetail {
  id: string;
  date: string; // ISO string yyyy-MM-dd for storage
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

export interface ScheduleChangeRequest {
  id: string;
  employeeName: string;
  brigadeMemberId: string;
  requestDate: string; // ISO string for creation date
  updatedAt?: string; // ISO string for last update
  
  position?: string; 
  
  prestationTypes?: PrestationType[]; 
  prestationTypeAutresDetail?: string;

  reasonStub: string; 

  scheduleChangeDetails?: ScheduleChangeDayDetail[];
  // No total hours needed for schedule change? Or perhaps total diff? Let's keep it simple for now.

  employeeSignatureDate?: string | null; 
  directManagerSignatureDate?: string | null; 
  directorSignatureDate?: string | null; 

  approvalStatus?: 'pending' | 'accepted' | 'rejected'; 
  // For simpler display, map to ScheduleChangeRequestStatus when needed
  // approvalStatus: 'pending' -> 'en_attente'
  rejectionReason?: string;
  decisionDate?: string | null; 
}

// Types for Absence Requests
export interface AbsenceRequest {
  id: string;
  employeeName: string;
  brigadeMemberId: string;
  requestDate: string; // ISO string for creation date
  updatedAt?: string; // ISO string for last update

  position?: string; 
  
  hoursPerDay?: number; 
  totalAbsenceHours?: number; 

  startDate: string; // ISO string yyyy-MM-dd
  endDate: string; // ISO string yyyy-MM-dd
  
  numberOfDays?: number; // Calculated
  reason?: string;

  prestationTypes?: PrestationType[]; // Added
  prestationTypeAutresDetail?: string; // Added
  
  employeeSignatureDate?: string | null; 
  directManagerSignatureDate?: string | null; 
  directorSignatureDate?: string | null; 

  approvalStatus?: 'pending' | 'accepted' | 'rejected'; 
  // For simpler display, map to AbsenceRequestStatus when needed
  // approvalStatus: 'pending' -> 'en_attente'
  rejectionReason?: string; 
  decisionDate?: string | null; 
}

export interface AppNotification {
  id: string; // Firestore document ID
  userId: string; // The ID of the user (brigade member) this notification is for
  title: string;
  message: string;
  link?: string; // Optional link to navigate to on click (e.g., '/dashboard/declaration-heure')
  createdAt: string; // ISO String
  isRead: boolean;
}
