
export const TASK_STATUSES = [
  "mr_dufay_prevenue",
  "devis_fait",
  "devis_envoye",
  "en_cours",
  "devis_signature",
  "rendez_vous",
  "termine",
  "annule",
] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

export const taskStatusLabels: Record<TaskStatus, string> = {
  mr_dufay_prevenue: "Mr Dufay prévenue",
  devis_fait: "Devis fait",
  devis_envoye: "Devis envoyé",
  en_cours: "En cours",
  devis_signature: "Devis parti en signature",
  rendez_vous: "Rendez-vous",
  termine: "Terminé",
  annule: "Annulé",
};

export interface StatusLogEntry {
  status: TaskStatus;
  date: Date;
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  currentStatus: TaskStatus;
  statusHistory: StatusLogEntry[];
  appointmentDate?: Date | null;
}
