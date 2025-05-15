
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
export interface PmsTaskDefinition { 
  id: string;
  name: string;
}

export interface PmsZone { // Can also represent an "Equipment"
  id: string;
  name: string;
  tasks?: PmsTaskDefinition[]; // Optional, as not all PMS categories use tasks (e.g., temperature)
  
  // Fields specific to Temperature Monitoring Equipment
  equipmentType?: 'refrigerator' | 'freezer';
  targetTempMin?: number;
  targetTempMax?: number;
  toleranceTempMin?: number;
  toleranceTempMax?: number;
  // Note: Rejection zones are derived
}

// Defines the structure for PMS configurations, keyed by category (e.g., 'kitchenCleaning')
export interface PmsConfigurations {
  [categoryKey: string]: PmsZone[];
}

export const PMS_KITCHEN_CLEANING_KEY = 'kitchenCleaning_v1';
export const PMS_RESTAURANT_CLEANING_KEY = 'restaurantCleaning_v1';
export const PMS_TEMPERATURE_MONITORING_KEY = 'temperatureMonitoring_v1'; 

export const PMS_CONFIG_STORAGE_KEY = 'pms_module_configurations_v4';
    
