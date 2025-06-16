
export interface PmsTaskDefinition {
  id: string;
  name: string;
}

export interface PmsZone { // Can also represent an "Equipment" or a "Control Point" or a "Supplier"
  id: string;
  name: string;
  tasks?: PmsTaskDefinition[]; // Renamed from criteria, can be "Verifications" for delivery, or empty for suppliers/equipment

  // Fields specific to Temperature Monitoring Equipment
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

export interface SimplifiedTaskRecord {
  status: 'fait' | 'non_fait' | 'na' | '';
  operator: string;
}

export interface SimplifiedMonthlyKitchenCleaningRecord {
  [date_itemId_taskId: string]: SimplifiedTaskRecord;
}

export type SimplifiedMonthlyRestaurantCleaningRecord = SimplifiedMonthlyKitchenCleaningRecord;
export type SimplifiedMonthlyFryerLog = SimplifiedMonthlyKitchenCleaningRecord;


// Updated for the new temperature grid component
export interface DailyTempGridLogEntry {
  markedTemp?: number | null; // The temp value marked, e.g., 3 for 3°C. Null if none.
  time?: string; // HH:MM
  operator?: string;
}

// Represents all records for a specific equipment for a specific month.
// Key is 'YYYY-MM-DD' string for the day.
export interface MonthlyTempGridLog {
  [date: string]: DailyTempGridLogEntry;
}


export interface ReceptionEntry {
  id: string;
  dateTime: string;
  supplierName: string;
  productNameControlled: string;
  vehicleObservations: string;
  productTemperature?: string;
  dlcDluo?: string;
  lotNumber?: string;
  packagingAspect?: string;
  quantity?: string;
  productLabeling?: 'conforme' | 'non_conforme' | ''; // Updated for Select
  refused: boolean;
  refusalReason?: string;
  visa?: string;
}

export interface TempChangeEntry {
  id: string;
  coolingDate: string;
  productName: string;
  quantity: string;
  coolingHotProductTime?: string;
  coolingHotProductTemp?: string;
  coolingColdProductTime?: string;
  coolingColdProductTemp?: string;
  coolingVisa?: string;
  reheatingDate?: string;
  reheatingColdProductTime?: string;
  reheatingColdProductTemp?: string;
  reheatingHotProductTime?: string;
  reheatingHotProductTemp?: string;
  reheatingVisa?: string;
}

export interface DefrostingEntry {
  id: string;
  defrostStartDate: string;
  defrostStartTime: string;
  productName: string;
  quantity: string;
  tempOnRemoval?: string;
  initialsStart?: string;
  useDate?: string | null;
  useTime?: string | null;
  tempOnUse?: string | null;
  initialsEnd?: string | null;
}

export interface DailyCoolDownEntry {
  id: string;
  productName: string;
  quantity: string;
  piecesOrPlats?: string;
  startTime?: string;
  startTemp?: string;
  endTime?: string;
  endTemp?: string;
  visa?: string;
}

export interface DailyDeliveryEntry {
  id: string;
  productName: string;
  quantity?: string;
  piecesOrPlats?: string;
  departureTime?: string;
  departureTemp?: string;
  arrivalTime?: string;
  arrivalTemp?: string;
  visaLivreur?: string;
  visaClient?: string;
}

export interface PicnicDepartureEntry {
  id: string;
  entryCreationDate: string; // ISO string, when the record was created/updated in the app
  orderReceivedDate: string; // Date (ISO string) from "Commande reçue le"
  orderReceivedTime: string; // HH:mm from "à ...H..."
  clientName: string;
  numberOfPicnics: number;
  departureTemperature: string;
}


export const NO_STATUS_SELECT_VALUE = "_aucun_statut_";
export const PMS_SUPPLIER_MANAGEMENT_KEY = 'supplierManagement_v1'; // Added for consistency with settings/types.ts

// Alias PmsZone for use as PmsEquipmentDefinition or PmsSupplierDefinition if structure is compatible
export type PmsEquipmentDefinition = PmsZone; 
export type PmsSupplierDefinition = PmsZone; 
export type PmsZoneWithTasksDefinition = PmsZone;

