
export interface DailyCounts {
  lundi?: number | string;
  mardi?: number | string;
  mercredi?: number | string;
  jeudi?: number | string;
  vendredi?: number | string;
}

// Row identifiers for the state object, derived from the image
export type PicnicRowKey = 
  | 'gatien' | 'cedric' | 'dominique' | 'maxime_l' | 'nicolas' 
  | 'maxime_h' | 'philipe' | 'plus' | 'autre' 
  | 'nb_bagette' | 'nb_bagette_esat' | 'total_glaciere';

export type PicnicWeekData = Record<PicnicRowKey, DailyCounts>;

export interface DisplayRowConfig {
  id: PicnicRowKey | 'total_esat' | 'total_global'; // Include calculated rows for display mapping
  label: string;
  bgColor: string;
  textColor: string;
  isInputRow: boolean; // True if this row takes direct input
  isESATContributor?: boolean; // True if this row's values contribute to "total ESAT"
  isTotalContributor?: boolean; // True if this row's values contribute to "TOTAL" (global total)
}
