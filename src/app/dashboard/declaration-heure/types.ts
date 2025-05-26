
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

  employeeSignatureDate?: string; 
  directManagerSignatureDate?: string; 
  directorSignatureDate?: string; 

  approvalStatus?: 'pending' | 'accepted' | 'rejected'; 
  rejectionReason?: string;
  // compensationType?: 'recovery' | 'payment' | null; // Removed field
  decisionDate?: string; 
}

// Kept for potential compatibility with list display if not immediately updated elsewhere
export interface OvertimeRequestStub {
  id: string;
  employeeName: string;
  requestDate: string; // ISO string
  reasonStub: string;
  position?: string;
  prestationTypeNotes?: string;
  overtimeDetailsNotes?: string;
  totalOvertimeHours?: string;
  status?: OvertimeRequestStatus; // Simple status for display
  approvalStatus?: 'pending' | 'accepted' | 'rejected'; // More detailed status
}
