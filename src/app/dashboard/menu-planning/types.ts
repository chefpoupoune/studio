
export type MenuThemeValue = 'froid' | 'vege' | 'sam' | 'poisson' | 'fete' | '';

export const MENU_THEMES: { value: MenuThemeValue; label: string }[] = [
  { value: '', label: 'Aucun Thème' },
  { value: 'froid', label: 'Froid' },
  { value: 'vege', label: 'Végétarien' },
  { value: 'sam', label: 'Spécial SAM' },
  { value: 'poisson', label: 'Poisson' },
  { value: 'fete', label: 'Fête' },
];

export const menuThemeStyles: Record<Exclude<MenuThemeValue, ''>, string> = {
  froid: 'bg-blue-100 dark:bg-blue-800/30 text-blue-800 dark:text-blue-200',
  vege: 'bg-green-100 dark:bg-green-800/30 text-green-800 dark:text-green-200',
  sam: 'bg-yellow-100 dark:bg-yellow-800/30 text-yellow-800 dark:text-yellow-200', // Note: same base as holiday, but can be different text color or specifics
  poisson: 'bg-pink-100 dark:bg-pink-800/30 text-pink-800 dark:text-pink-200',
  fete: 'bg-orange-100 dark:bg-orange-800/30 text-orange-800 dark:text-orange-200',
};


export interface MenuItem {
  entree: string;
  plat: string;
  feculent: string;
  legume: string;
  sauce: string;
  dessert: string;
  theme?: MenuThemeValue;
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
  theme: '',
};

export const frenchDays = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const frenchMonths = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

