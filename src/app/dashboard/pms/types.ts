
export interface PmsTaskDefinition {
  id: string;
  name: string;
}

export interface PmsZoneWithTasksDefinition { // Used by monitoring components
  id: string;
  name: string;
  tasks: PmsTaskDefinition[];
}

// For Cleaning Records
export interface SimplifiedTaskRecord {
  status: 'fait' | 'non_fait' | 'na' | '';
  operator: string;
}

// The key will be something like "YYYY-MM-DD_zoneId_taskId"
export interface SimplifiedMonthlyKitchenCleaningRecord {
  [date_zoneId_taskId: string]: SimplifiedTaskRecord;
}

// Key for Restaurant Cleaning, can reuse SimplifiedMonthlyKitchenCleaningRecord as structure is same
export type SimplifiedMonthlyRestaurantCleaningRecord = SimplifiedMonthlyKitchenCleaningRecord;


// For Temperature Records
export interface DailyTemperatureRecord {
  temperature?: string; 
  time?: string;       // HH:mm format
  operator?: string;
}

// The key will be something like "YYYY-MM-DD_equipmentId"
export interface MonthlyTemperatureLog {
  [date_equipmentId: string]: DailyTemperatureRecord;
}


export const NO_STATUS_SELECT_VALUE = "_aucun_statut_";

// --- Potentially for later, more complex PMS settings ---
// export interface PmsTask {
//   id: string;
//   name: string;
// }

// export interface PmsZone {
//   id: string;
//   name: string;
//   tasks: PmsTask[]; 
// }

// export interface DailyCleaningRecordData {
//   status?: 'fait' | 'non_fait' | 'na' | ''; 
//   operator?: string; 
// }

// export interface DailyZoneCleaningStatus {
//   [zoneId: string]: {
//     [taskId: string]: DailyCleaningRecordData; 
//   };
// }

// export interface MonthlyCleaningRecord {
//   [date: string]: DailyZoneCleaningStatus; 
// }
