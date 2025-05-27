
export type OvertimeRequestStatus = 'en_attente' | 'approuvee' | 'refusee'; // For initial simple display

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
  rejectionReason?: string;
  // compensationType?: 'recovery' | 'payment'; // Removed as per user request
  decisionDate?: string | null; 
}

// Types for Absence Requests
export interface AbsenceRequest {
  id: string;
  employeeName: string;
  requestDate: string; // ISO string for creation date
  updatedAt?: string; // ISO string for last update

  position?: string; 
  
  hoursPerDay?: number; 
  totalAbsenceHours?: number; // Added: Total calculated hours of absence

  startDate: string; // ISO string yyyy-MM-dd
  endDate: string; // ISO string yyyy-MM-dd
  
  numberOfDays?: number; // Calculated
  reason?: string;
  
  employeeSignatureDate?: string | null; 
  directManagerSignatureDate?: string | null; 
  directorSignatureDate?: string | null; 

  approvalStatus?: 'pending' | 'accepted' | 'rejected'; 
  rejectionReason?: string; 
  decisionDate?: string | null; 
}
