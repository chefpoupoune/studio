
export interface PdfLayoutSettings {
  logoUrl?: string;
  primaryColor?: string; // e.g., hex code like #RRGGBB
  headerText?: string;   // Text for the PDF header
  footerText?: string;   // Text for the PDF footer, can include placeholders like {pageNumber}, {totalPages}, {date}
  marginTop?: number;    // Margin top in points
  marginRight?: number;  // Margin right in points
  marginBottom?: number; // Margin bottom in points
  marginLeft?: number;   // Margin left in points
  defaultFontSize?: number; // Default font size in points
}

// Types for PMS Configuration
// Aligned with PmsTaskDefinition from pms/types.ts
export interface PmsTaskDefinition { 
  id: string;
  name: string;
}

export interface PmsZone {
  id: string;
  name: string;
  tasks: PmsTaskDefinition[]; // Renamed from criteria
}

// Defines the structure for PMS configurations, keyed by category (e.g., 'kitchenCleaning')
export interface PmsConfigurations {
  [categoryKey: string]: PmsZone[];
}

export const PMS_KITCHEN_CLEANING_KEY = 'kitchenCleaning_v1';
export const PMS_RESTAURANT_CLEANING_KEY = 'restaurantCleaning_v1';
// Incremented version due to structure change (criteria -> tasks)
export const PMS_CONFIG_STORAGE_KEY = 'pms_module_configurations_v3'; 

