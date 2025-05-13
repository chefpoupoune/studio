
import type { PdfLayoutSettings } from '@/app/dashboard/settings/types';
import { DEFAULT_APP_PRIMARY_COLOR } from '@/config/colors';

export const PDF_LAYOUT_CONFIGS_KEY = "pdf_layout_configurations";
export const GENERAL_CONFIG_KEY = "_general_pdf_config_";

const DEFAULT_SETTINGS: Required<PdfLayoutSettings> = {
  logoUrl: '',
  primaryColor: DEFAULT_APP_PRIMARY_COLOR,
  headerText: '',
  footerText: 'Généré le {date} - Page {pageNumber}/{totalPages}',
};

// Helper to convert hex to RGB array for jsPDF fillColor
export function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}

export function getPdfLayoutSettings(pdfTypeKey: string): Required<PdfLayoutSettings> {
  let allConfigs: Record<string, Partial<PdfLayoutSettings>> = {};
  
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedConfigs = localStorage.getItem(PDF_LAYOUT_CONFIGS_KEY);
      if (storedConfigs) {
        allConfigs = JSON.parse(storedConfigs);
      }
    } catch (error) {
      console.error("Error reading PDF layout configs from localStorage:", error);
    }
  }

  const generalConfig = allConfigs[GENERAL_CONFIG_KEY] || {};
  const specificConfig = allConfigs[pdfTypeKey] || {};

  return {
    logoUrl: specificConfig.logoUrl ?? generalConfig.logoUrl ?? DEFAULT_SETTINGS.logoUrl,
    primaryColor: specificConfig.primaryColor ?? generalConfig.primaryColor ?? DEFAULT_SETTINGS.primaryColor,
    headerText: specificConfig.headerText ?? generalConfig.headerText ?? DEFAULT_SETTINGS.headerText,
    footerText: specificConfig.footerText ?? generalConfig.footerText ?? DEFAULT_SETTINGS.footerText,
  };
}
