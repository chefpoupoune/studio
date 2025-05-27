
import type { PdfLayoutSettings } from '@/app/dashboard/settings/types';
import { DEFAULT_APP_PRIMARY_COLOR } from '@/config/colors';

export const PDF_LAYOUT_CONFIGS_KEY = "pdf_layout_configurations_v2";
export const GENERAL_CONFIG_KEY = "_general_pdf_config_";

export const DEFAULT_LOGO_URL = '';
export const DEFAULT_HEADER_TEXT = '';
export const DEFAULT_FOOTER_TEXT = 'Généré le {date} - Page {pageNumber}/{totalPages}';
export const DEFAULT_MARGIN = 30; 
export const DEFAULT_FONT_SIZE = 10;

export const DEFAULT_FONT_FAMILY: NonNullable<PdfLayoutSettings['fontFamily']> = 'helvetica';
export const DEFAULT_DOCUMENT_TITLE_FONT_SIZE = 18; // New default
export const DEFAULT_HEADER_FONT_SIZE = 10; // Adjusted default for custom header table
export const DEFAULT_FOOTER_FONT_SIZE = 8;
export const DEFAULT_TABLE_HEADER_FONT_SIZE = 9;
export const DEFAULT_TABLE_BODY_FONT_SIZE = 8;
export const DEFAULT_ORIENTATION: NonNullable<PdfLayoutSettings['orientation']> = 'portrait';
export const DEFAULT_PAGE_SIZE: NonNullable<PdfLayoutSettings['pageSize']> = 'a4';


const DEFAULT_SETTINGS: Required<PdfLayoutSettings> = {
  logoUrl: DEFAULT_LOGO_URL,
  primaryColor: DEFAULT_APP_PRIMARY_COLOR,
  headerText: DEFAULT_HEADER_TEXT,
  footerText: DEFAULT_FOOTER_TEXT,
  marginTop: DEFAULT_MARGIN,
  marginRight: DEFAULT_MARGIN,
  marginBottom: DEFAULT_MARGIN,
  marginLeft: DEFAULT_MARGIN,
  defaultFontSize: DEFAULT_FONT_SIZE,
  fontFamily: DEFAULT_FONT_FAMILY,
  documentTitleFontSize: DEFAULT_DOCUMENT_TITLE_FONT_SIZE, // New
  headerFontSize: DEFAULT_HEADER_FONT_SIZE,
  footerFontSize: DEFAULT_FOOTER_FONT_SIZE,
  tableHeaderFontSize: DEFAULT_TABLE_HEADER_FONT_SIZE,
  tableBodyFontSize: DEFAULT_TABLE_BODY_FONT_SIZE,
  orientation: DEFAULT_ORIENTATION,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}

export function getPdfLayoutSettings(pdfTypeKey: string, allConfigsParam?: Record<string, Partial<PdfLayoutSettings>>): Required<PdfLayoutSettings> {
  let configsToUse: Record<string, Partial<PdfLayoutSettings>>;

  if (allConfigsParam !== undefined) { 
    configsToUse = allConfigsParam;
  } else if (typeof window !== 'undefined' && window.localStorage) { 
    try {
      const storedConfigs = localStorage.getItem(PDF_LAYOUT_CONFIGS_KEY);
      configsToUse = storedConfigs ? JSON.parse(storedConfigs) : {};
    } catch (error) {
      console.error("Error reading PDF layout configs from localStorage in getPdfLayoutSettings:", error);
      configsToUse = {};
    }
  } else { 
    configsToUse = {};
  }

  const generalConfig = configsToUse[GENERAL_CONFIG_KEY] || {};
  const specificConfig = configsToUse[pdfTypeKey] || {};

  return {
    logoUrl: specificConfig.logoUrl ?? generalConfig.logoUrl ?? DEFAULT_SETTINGS.logoUrl,
    primaryColor: specificConfig.primaryColor ?? generalConfig.primaryColor ?? DEFAULT_SETTINGS.primaryColor,
    headerText: specificConfig.headerText ?? generalConfig.headerText ?? DEFAULT_SETTINGS.headerText,
    footerText: specificConfig.footerText ?? generalConfig.footerText ?? DEFAULT_SETTINGS.footerText,
    marginTop: specificConfig.marginTop ?? generalConfig.marginTop ?? DEFAULT_SETTINGS.marginTop,
    marginRight: specificConfig.marginRight ?? generalConfig.marginRight ?? DEFAULT_SETTINGS.marginRight,
    marginBottom: specificConfig.marginBottom ?? generalConfig.marginBottom ?? DEFAULT_SETTINGS.marginBottom,
    marginLeft: specificConfig.marginLeft ?? generalConfig.marginLeft ?? DEFAULT_SETTINGS.marginLeft,
    defaultFontSize: specificConfig.defaultFontSize ?? generalConfig.defaultFontSize ?? DEFAULT_SETTINGS.defaultFontSize,
    fontFamily: specificConfig.fontFamily ?? generalConfig.fontFamily ?? DEFAULT_SETTINGS.fontFamily,
    documentTitleFontSize: specificConfig.documentTitleFontSize ?? generalConfig.documentTitleFontSize ?? DEFAULT_SETTINGS.documentTitleFontSize, // New
    headerFontSize: specificConfig.headerFontSize ?? generalConfig.headerFontSize ?? DEFAULT_SETTINGS.headerFontSize,
    footerFontSize: specificConfig.footerFontSize ?? generalConfig.footerFontSize ?? DEFAULT_SETTINGS.footerFontSize,
    tableHeaderFontSize: specificConfig.tableHeaderFontSize ?? generalConfig.tableHeaderFontSize ?? DEFAULT_SETTINGS.tableHeaderFontSize,
    tableBodyFontSize: specificConfig.tableBodyFontSize ?? generalConfig.tableBodyFontSize ?? DEFAULT_SETTINGS.tableBodyFontSize,
    orientation: specificConfig.orientation ?? generalConfig.orientation ?? DEFAULT_SETTINGS.orientation,
    pageSize: specificConfig.pageSize ?? generalConfig.pageSize ?? DEFAULT_SETTINGS.pageSize,
  };
}
