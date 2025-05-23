
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
  | 'nb_bagette' | 'nb_faluche' | 'total_glaciere';

export type PicnicWeekData = Record<PicnicRowKey, DailyCounts>;

export interface DisplayRowConfig {
  id: PicnicRowKey | 'total_global'; 
  label: string;
  bgColor: string;
  textColor: string;
  isInputRow: boolean; 
  isTotalContributor?: boolean; 
}

// New type for the second table (Client Picnic Orders)
export type BreadChoice = 'baguette' | 'faluche' | 'none';

export interface ClientPicnicOrder {
  id: string;
  clientName: string;
  nbPn: string; // Kept as string to allow empty input, convert to number on use
  observation: string;
  breadChoice: BreadChoice; 
}
