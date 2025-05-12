

export interface MenuItem {
  entree: string;
  plat: string;
  feculent: string;
  legume: string;
  sauce: string;
  dessert: string;
}

export interface DailyMenu extends MenuItem {
  date: string; // YYYY-MM-DD format
  dayName: string; // Full day name e.g., "Lundi"
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

export type MenuField = keyof MenuItem;

export const initialMenuItem: MenuItem = {
  entree: '',
  plat: '',
  feculent: '',
  legume: '',
  sauce: '',
  dessert: '',
};

export const frenchDays = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const frenchMonths = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

