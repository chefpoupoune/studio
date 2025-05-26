
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

// This interface will be used for the detailed form and storage
export interface OvertimeRequest {
  id: string;
  employeeName: string;
  requestDate: string; // ISO string for creation date
  
  // Employee section
  position?: string; 
  
  // Prestation correspondante
  prestationTypes?: PrestationType[]; 
  prestationTypeAutresDetail?: string;

  // Motif
  reasonStub: string; // Main reason

  // Hours detail
  overtimeDetails?: OvertimeDayDetail[];
  totalOvertimeHours?: string; // "X heures en plus de l'horaire prévu"

  // Signatures (placeholders for now)
  employeeSignatureDate?: string; // ISO string
  directManagerSignatureDate?: string; // ISO string
  directorSignatureDate?: string; // ISO string

  // Cadre réservé à la Direction
  approvalStatus?: 'pending' | 'accepted' | 'rejected'; // More specific status
  rejectionReason?: string;
  compensationType?: 'recovery' | 'payment';
  decisionDate?: string; // ISO string

  // Fallback for simple list display if approvalStatus is not set
  status?: OvertimeRequestStatus;
}

// Simplified stub for initial list display, can be derived from OvertimeRequest
export interface OvertimeRequestStub {
  id: string;
  employeeName: string;
  requestDate: string; // ISO String
  status: OvertimeRequestStatus; // 'en_attente', 'approuvee', 'refusee' (can map from approvalStatus)
  reasonStub: string;
  position?: string;
  // These were specific to the old structure, may not be needed if listing only uses approvalStatus
  prestationTypeNotes?: string; 
  overtimeDetailsNotes?: string;
  totalOvertimeHours?: string; 
  overtimeDetails?: OvertimeDayDetail[]; 
  approvalStatus?: 'pending' | 'accepted' | 'rejected';
}
