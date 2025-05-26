
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

export type AbsenceRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface AbsenceRequest {
  id: string;
  employeeName: string;
  position?: string; // To match overtime request
  requestDate: string; // ISO string for creation date
  updatedAt?: string; // ISO string for last update

  absenceType: AbsenceType;
  absenceTypeAutresDetail?: string; // If 'Autre' is selected
  
  startDate: string; // ISO string yyyy-MM-dd
  endDate: string; // ISO string yyyy-MM-dd
  
  // For half-day tracking - can be added later
  // startHalfDay?: 'matin' | 'apres_midi';
  // endHalfDay?: 'matin' | 'apres_midi';
  
  numberOfDays?: number; // Calculated or entered
  reason?: string;
  
  // Approver section - can be added later
  // comments?: string;
  // signedBy?: string;
  // signatureDate?: string;

  status: AbsenceRequestStatus;
}
