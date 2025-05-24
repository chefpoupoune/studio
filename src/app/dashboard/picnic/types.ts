
export interface PicnicRowDailyValues {
  lundi?: number | string;
  mardi?: number | string;
  mercredi?: number | string;
  jeudi?: number | string;
  vendredi?: number | string;
}

export interface PicnicRowData extends PicnicRowDailyValues {
  weeklyObservation?: string;
}

export type PicnicRowKey =
  | 'gatien' | 'cedric' | 'dominique' | 'maxime_l' | 'nicolas'
  | 'maxime_h' | 'philipe' | 'plus' | 'autre'
  | 'nb_bagette' | 'nb_faluche' | 'total_glaciere';

export type PicnicWeekData = Record<PicnicRowKey, PicnicRowData>;


export interface DisplayRowConfig {
  id: PicnicRowKey | 'total_global';
  label: string;
  bgColor: string;
  textColor: string;
  isInputRow: boolean;
  isTotalContributor?: boolean;
  pdfBgColor?: [number, number, number];
}

export type BreadChoice = 'baguette' | 'faluche' | 'none';

export interface DailyClientPicnicData {
  nbPn: string; 
  breadChoice: BreadChoice;
}

export type DayOfWeekKey = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi';

export interface ClientPicnicOrder {
  id: string;
  clientName: string;
  observation?: string; 
  days: Record<DayOfWeekKey, DailyClientPicnicData>;
}

// New types for Picnic Menu Planning
export const PICNIC_MENU_MONTHS = [
  { value: 2, label: "Mars" }, { value: 3, label: "Avril" }, { value: 4, label: "Mai" },
  { value: 5, label: "Juin" }, { value: 6, label: "Juillet" }, { value: 7, label: "Août" },
  { value: 8, label: "Septembre" }, { value: 9, label: "Octobre" }, { value: 10, label: "Novembre" }
] as const;

export const PICNIC_MENU_DAYS_LABELS: Record<DayOfWeekKey, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
};

export const PICNIC_MENU_DAY_KEYS = Object.keys(PICNIC_MENU_DAYS_LABELS) as DayOfWeekKey[];

export const NUM_PICNIC_ITEM_SLOTS = 14; // Number of item rows per day in the table

// Represents the content of one of the 5 master weekly menu templates
export interface StoredPicnicMenuTemplate {
  days: Record<DayOfWeekKey, string[]>; // Menu items for each day (Lundi-Vendredi)
  weeklyNote?: string; // A general note for this weekly template
}

// This interface will be used in the component for display, combining StoredPicnicMenuTemplate with dynamic date info
export interface DisplayedPicnicMenuWeek extends StoredPicnicMenuTemplate {
  // Date-specific properties, calculated dynamically
  id: string; // Unique ID for the displayed week instance, e.g., "YYYY-MM-weekIndex"
  year: number;
  monthIndex: number;
  weekInMonth: number;
  startDate: string; // ISO string for Monday of the week
  dateRangeDisplay: string; // e.g., "04/03 au 08/03"
}
