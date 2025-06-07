
// Informations pour chaque fournisseur
export interface CostEntry {
  id: string;
  fournisseur: string;
  ht: number;
  tva: number;
  avoir: number;
}

// Informations pour chaque jour du mois (coefficients)
export interface DailyCoefficientEntry {
  day: number; // 1 à 31
  imp: number | "";
  saj: number | "";
  ime: number | "";
  esat: number | "";
  repasPlus: number | "";
  nous: number | "";
  pn: number | ""; 
  pnEsat: number | ""; 
}


export const months = [
  { value: "0", label: "Janvier" }, { value: "1", label: "Février" }, { value: "2", label: "Mars" },
  { value: "3", label: "Avril" }, { value: "4", label: "Mai" }, { value: "5", label: "Juin" },
  { value: "6", label: "Juillet" }, { value: "7", label: "Août" }, { value: "8", label: "Septembre" },
  { value: "9", label: "Octobre" }, { value: "10", label: "Novembre" }, { value: "11", label: "Décembre" }
];

export const currentYear = new Date().getFullYear();
export const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);


export interface MonthlySummary {
  month: string;
  monthIndex: number;
  totalHt: number;
  totalTva: number;
  totalAvoir: number;
  emarket: number; 
  fraisFonctionnement: number;
  fraisGestion: number;
  manualEmarket?: number; 
  manualFraisFonctionnement?: number; 
  manualFraisGestion?: number; 
  totalEffectifSum: number; // Somme de PN + PN ESAT du tableau journalier
  prixDeRevient: number;
  totalLigne: number; 
  dataFound: boolean; 
  hasManualAdjustments?: boolean;
}

// Types for Pique-Nique / Salade Cost Analysis
export type MealTypePN = 'picnic' | 'salad';

export interface IngredientPN {
  id: string;
  name: string;
  unit: string; 
  unitPrice: number; 
  quantityPerMeal: number; 
}

// Types for Occasional Meal Cost Analysis
export type OccasionalMealPartType = 'starter' | 'main' | 'dessert';

export interface IngredientOccasional {
  id: string;
  name: string;
  unit: string; 
  unitPrice: number; 
  quantityPerSingleMeal: number; 
}
