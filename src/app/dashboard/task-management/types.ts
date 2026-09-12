
export const TASK_STATUSES = [
  "mr_dufay_prevenue",
  "devis_demander",
  "da_devis_envoye",
  "commande_passe",
  "en_attente",
  "rendez_vous",
  "termine",
  "annule",
] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

export const taskStatusLabels: Record<TaskStatus, string> = {
  mr_dufay_prevenue: "Mr dufay prevenue",
  devis_demander: "Devis demander",
  da_devis_envoye: "DA + devis envoyé",
  commande_passe: "Commande passé",
  en_attente: "En Attente",
  rendez_vous: "Rendez-vous",
  termine: "Terminer",
  annule: "Annuler",
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
