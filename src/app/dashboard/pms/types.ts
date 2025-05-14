
export interface PmsTaskDefinition {
  id: string;
  name: string;
}

export interface PmsZoneWithTasksDefinition {
  id: string;
  name: string;
  tasks: PmsTaskDefinition[];
}

export interface SimplifiedTaskRecord {
  status: 'fait' | 'non_fait' | 'na' | '';
  operator: string;
  notes: string;
}

// The key will be something like "YYYY-MM-DD_zoneId_taskId"
export interface SimplifiedMonthlyKitchenCleaningRecord {
  [date_zoneId_taskId: string]: SimplifiedTaskRecord;
}

export const NO_STATUS_SELECT_VALUE = "_aucun_statut_";


// --- Potentially for later, more complex PMS settings ---
export interface PmsTask {
  id: string;
  name: string;
}

export interface PmsZone {
  id: string;
  name: string;
  tasks: PmsTask[]; 
}

export interface DailyCleaningRecordData {
  status?: 'fait' | 'non_fait' | 'na' | ''; 
  operator?: string; 
  notes?: string;    
}

export interface DailyZoneCleaningStatus {
  [zoneId: string]: {
    [taskId: string]: DailyCleaningRecordData; 
  };
}

export interface MonthlyCleaningRecord {
  [date: string]: DailyZoneCleaningStatus; 
}
