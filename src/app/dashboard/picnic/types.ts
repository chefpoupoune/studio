
export interface PicnicRowDailyValues { // Renamed from DailyCounts
  lundi?: number | string;
  mardi?: number | string;
  mercredi?: number | string;
  jeudi?: number | string;
  vendredi?: number | string;
}

export interface PicnicRowData extends PicnicRowDailyValues {
  weeklyObservation?: string;
}

// Row identifiers for the state object, derived from the image
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
}

// New types for daily client picnic orders
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
