
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


// For Temperature Records (Grid Style)
export interface DailyTemperatureRecord {
  markedTemperatureValue?: number; 
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
  vehicleObservations: string; 
  productTemperature?: string; 
  dlcDluo?: string;
  lotNumber?: string;
  packagingAspect?: string;
  quantity?: string;
  productLabeling?: string;
  refused: boolean;
  refusalReason?: string; 
  visa?: string; 
}

// For Temperature Change Monitoring (Cooling/Reheating)
export interface TempChangeEntry {
  id: string;
  coolingDate: string; // ISO string
  productName: string;
  quantity: string;
  // Cooling
  coolingHotProductTime?: string; // HH:mm
  coolingHotProductTemp?: string; // °C
  coolingColdProductTime?: string; // HH:mm
  coolingColdProductTemp?: string; // °C
  coolingVisa?: string; // Initials
  // Reheating
  reheatingDate?: string; // ISO string (can be different)
  reheatingColdProductTime?: string; // HH:mm
  reheatingColdProductTemp?: string; // °C
  reheatingHotProductTime?: string; // HH:mm
  reheatingHotProductTemp?: string; // °C
  reheatingVisa?: string; // Initials
}


export const NO_STATUS_SELECT_VALUE = "_aucun_statut_";
