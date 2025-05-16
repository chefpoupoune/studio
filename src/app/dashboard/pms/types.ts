
export interface PmsTaskDefinition {
  id: string;
  name: string;
}

export interface PmsZone { // Can also represent an "Equipment"
  id: string;
  name: string;
  tasks?: PmsTaskDefinition[]; 
  
  equipmentType?: 'refrigerator' | 'freezer';
  targetTempMin?: number;
  targetTempMax?: number;
  tolerance1TempMin?: number; 
  tolerance1TempMax?: number; 
  tolerance2TempMin?: number; 
  tolerance2TempMax?: number; 
}

export interface PmsConfigurations {
  [categoryKey: string]: PmsZone[];
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

// For Defrosting Monitoring
export interface DefrostingEntry {
  id: string;
  defrostStartDate: string; // ISO string (date only)
  defrostStartTime: string; // HH:mm
  productName: string;
  quantity: string;
  tempOnRemoval?: string; // e.g., "-18°C"
  initialsStart?: string; // Operator initials for starting defrost
  
  useDate?: string | null; // ISO string (date only, optional)
  useTime?: string | null; // HH:mm (optional)
  tempOnUse?: string | null; // e.g., "4°C" (optional)
  initialsEnd?: string | null; // Operator initials for end/use (optional)
}

// For Daily Cool Down Monitoring (Baisse en Température du Jour) - Part of Cold Chain
export interface DailyCoolDownEntry {
  id: string;
  productName: string;
  quantity: string;
  startTime?: string; // HH:mm
  startTemp?: string; // °C
  endTime?: string;   // HH:mm
  endTemp?: string;   // °C
  visa?: string;      // Initials
}

// For Daily Delivery Monitoring (Livraison du Jour) - Part of Cold Chain
export interface DailyDeliveryEntry {
  id: string;
  productName: string;
  quantity?: string;
  piecesOrPlats?: string;
  departureTime?: string; // HH:mm
  departureTemp?: string; // °C
  arrivalTime?: string;   // HH:mm
  arrivalTemp?: string;   // °C
  visaLivreur?: string;  // Initials
  visaClient?: string;   // Initials
}

export const NO_STATUS_SELECT_VALUE = "_aucun_statut_";
