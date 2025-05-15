
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
  markedTemperatureValue?: number; // Storing the numerical value of the temperature marked
  time?: string;       // HH:mm format
  operator?: string;
}

// The key will be something like "YYYY-MM-DD_equipmentId"
export interface MonthlyTemperatureLog {
  [date_equipmentId: string]: DailyTemperatureRecord;
}

// For Reception Monitoring
export interface ReceptionEntry {
  id: string;
  dateTime: string; // ISO string for date and time
  supplierName: string;
  productNameControlled: string;
  vehicleObservations: string; // For "Véhicule: propreté température"
  productTemperature?: string; // T°C
  dlcDluo?: string;
  lotNumber?: string;
  packagingAspect?: string;
  quantity?: string;
  productLabeling?: string;
  refused: boolean;
  refusalReason?: string; // Optional, if refused is true
  visa?: string; // Initials
}


export const NO_STATUS_SELECT_VALUE = "_aucun_statut_";
