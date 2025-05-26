
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
  // compensationType removed
  decisionDate?: string | null; 
}

// Types for Absence Requests
export const ABSENCE_TYPES = ['CP', 'RTT', 'Maladie', 'Formation', 'Sans_Solde', 'Autre'] as const;
export type AbsenceType = typeof ABSENCE_TYPES[number];

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  CP: "Congé Payé",
  RTT: "RTT",
  Maladie: "Maladie / Arrêt de travail",
  Formation: "Formation",
  Sans_Solde: "Congé Sans Solde",
  Autre: "Autre (à préciser)",
};

// Retaining original AbsenceRequestStatus for simplicity, could be unified with OvertimeRequest's approvalStatus later if needed.
// For now, AbsenceRequest will also use 'pending', 'accepted', 'rejected' like OvertimeRequest.
// export type AbsenceRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface AbsenceRequest {
  id: string;
  employeeName: string;
  requestDate: string; // ISO string for creation date
  updatedAt?: string; // ISO string for last update

  position?: string; // Added
  
  absenceType: AbsenceType;
  absenceTypeAutresDetail?: string; // If 'Autre' is selected, Added
  
  startDate: string; // ISO string yyyy-MM-dd
  endDate: string; // ISO string yyyy-MM-dd
  
  numberOfDays?: number; // Calculated, Added
  reason?: string;
  
  employeeSignatureDate?: string | null; // Added
  directManagerSignatureDate?: string | null; // Added
  directorSignatureDate?: string | null; // Added

  approvalStatus?: 'pending' | 'accepted' | 'rejected'; // Added, replacing old 'status'
  rejectionReason?: string; // Added
  decisionDate?: string | null; // Added

  // Old status field, to be phased out or mapped if needed from old data.
  // status: AbsenceRequestStatus; 
}
