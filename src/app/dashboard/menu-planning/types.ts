
// Actual theme identifiers, cannot be empty string
export type MenuThemeIdentifier = 'froid' | 'vege' | 'sam' | 'poisson' | 'fete';

// Value used in SelectItem for "no theme" option. This MUST be a non-empty string.
export const NO_THEME_SELECT_VALUE = "_aucun_theme_";

// Type for the theme property in the data model (DailyMenu, MenuItem)
// An empty string ('') means no theme is set.
export type StoredMenuThemeValue = MenuThemeIdentifier | '';

// Options array for populating the Select component
export const MENU_THEME_OPTIONS_FOR_SELECT: { value: MenuThemeIdentifier | typeof NO_THEME_SELECT_VALUE; label: string }[] = [
  { value: NO_THEME_SELECT_VALUE, label: 'Aucun Thème' },
  { value: 'froid', label: 'Froid' },
  { value: 'vege', label: 'Végétarien' },
  { value: 'sam', label: 'Spécial SAM' },
  { value: 'poisson', label: 'Poisson' },
  { value: 'fete', label: 'Fête' },
];

// Styles map uses the actual theme identifiers. It does not include '' or NO_THEME_SELECT_VALUE.
export const menuThemeStyles: Record<MenuThemeIdentifier, string> = {
  froid: 'bg-blue-100 dark:bg-blue-800/30 text-blue-800 dark:text-blue-200',
  vege: 'bg-green-100 dark:bg-green-800/30 text-green-800 dark:text-green-200',
  sam: 'bg-yellow-100 dark:bg-yellow-800/30 text-yellow-800 dark:text-yellow-200',
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
  theme: StoredMenuThemeValue; // Data model stores '' for "no theme"
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
  theme: '', // Initially no theme (represented by an empty string in data)
};

export const frenchDays = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const frenchMonths = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];
