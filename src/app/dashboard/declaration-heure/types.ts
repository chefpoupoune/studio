
export type OvertimeRequestStatus = 'en_attente' | 'approuvee' | 'refusee';

export interface OvertimeDayDetail {
  id: string; // For react-hook-form useFieldArray key
  date: string; // ISO string for storage
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

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
  overtimeDetails?: OvertimeDayDetail[]; // Changed from overtimeDetailsNotes
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


// Summary type for display, to be expanded as form grows
export interface OvertimeRequestStub {
  id: string;
  employeeName: string;
  requestDate: string; // ISO String
  status: OvertimeRequestStatus;
  reasonStub: string;
  position?: string;
  prestationTypeNotes: string; // Always "logistique"
  overtimeDetails?: OvertimeDayDetail[]; // Changed from overtimeDetailsNotes
  totalOvertimeHours?: string; // Placeholder for "X heures en plus..."
}
