
export type OvertimeRequestStatus = 'en_attente' | 'approuvee' | 'refusee';

export interface OvertimeRequest {
  id: string;
  employeeName: string; 
  requestDate: string; // ISO string
  status: OvertimeRequestStatus;
  // --- Fields from the form ---
  position?: string; // Poste occupé à l'IME
  prestationTypes?: PrestationType[]; // Entourer la prestation correspondante
  reason?: string; // Motif de la demande (renamed from reasonStub)

  // For overtime details
  overtimeDetails?: OvertimeDayDetail[];
  totalOvertimeHours?: string; // "X heures en plus de l'horaire prévu"

  // Approval details
  submittedLocation?: string; // Fait à
  submittedOnDate?: string; // Le: (date of submission/signature)
  managerNotes?: string; // For approval/refusal comments
}

export type PrestationType = 'hebergement' | 'educatif' | 'administratif' | 'logistique' | 'medico_psycho_sociale';

export const PRESTATION_TYPE_LABELS: Record<PrestationType, string> = {
  hebergement: "Hébergement",
  educatif: "Educatif",
  administratif: "Administratif",
  logistique: "Logistique",
  medico_psycho_sociale: "Médico-psycho-sociale",
};

export interface OvertimeDayDetail {
  id: string; // For list key
  date: string; // ISO string for the day of overtime
  morningStartTime?: string; // HH:mm
  morningEndTime?: string; // HH:mm
  afternoonStartTime?: string; // HH:mm
  afternoonEndTime?: string; // HH:mm
  // totalHoursForDay will be calculated
}

// Summary type for display, to be expanded as form grows
export interface OvertimeRequestStub {
  id: string;
  employeeName: string;
  requestDate: string; // ISO String
  status: OvertimeRequestStatus;
  reasonStub: string; 
  position?: string;
  prestationTypeNotes: string; // Now non-optional, will always be "logistique"
  overtimeDetailsNotes?: string; // Placeholder for "Détail des heures supplémentaires"
  totalOvertimeHours?: string; // Placeholder for "X heures en plus..."
}
