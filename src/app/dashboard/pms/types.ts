
export interface PmsTask {
  id: string;
  name: string;
}

export interface PmsZone {
  id: string;
  name: string;
  tasks: PmsTask[]; // Tâches/critères spécifiques à cette zone
}

export interface DailyCleaningRecordData {
  status?: 'fait' | 'non_fait' | 'na' | ''; // Statut de la tâche/zone pour le jour
  operator?: string; // Initiales de l'opérateur
  notes?: string;    // Notes additionnelles
}

export interface DailyZoneCleaningStatus {
  [zoneId: string]: {
    [taskId: string]: DailyCleaningRecordData; // Statut par tâche dans la zone
    // Ou si on veut un statut global pour la zone pour simplifier au début:
    // globalStatus?: DailyCleaningRecordData; 
  };
}


export interface MonthlyCleaningRecord {
  [date: string]: DailyZoneCleaningStatus; // YYYY-MM-DD -> ZoneID -> TaskID -> Status
}

// Pour le formulaire simplifié de cette étape
export interface SimplifiedDailyZoneRecord {
  status: 'fait' | 'non_fait' | 'na' | '';
  operator: string;
  notes: string;
}

export interface SimplifiedMonthlyKitchenCleaningRecord {
  [date_zoneId: string]: SimplifiedDailyZoneRecord; // e.g., "2024-07-15_zone_plan_travail"
}
