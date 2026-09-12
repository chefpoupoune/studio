
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import type { PdfLayoutSettings} from '@/app/dashboard/settings/types';
import { DEFAULT_APP_PRIMARY_COLOR} from '@/config/colors';


export const PDF_LAYOUT_CONFIGS_KEY = "pdf_layout_configurations_v2";
const FIRESTORE_DOCUMENT_ID ="all_configs";
export const GENERAL_CONFIG_KEY ="_general_pdf_config_";

export const DEFAULT_LOGO_URL = '';
export const DEFAULT_LOGO_WIDTH = 30; // Default width in %
export const DEFAULT_HEADER_TEXT = '';
export const DEFAULT_FOOTER_TEXT= 'Généré le {date} - Page {pageNumber}/{totalPages}';
export const DEFAULT_PAGE_SIZE = 'a4';
export const DEFAULT_ORIENTATION = 'portrait'; 
export const DEFAULT_FONT_FAMILY = 'helvetica';
export const DEFAULT_FONT_SIZE = 10;
export const DEFAULT_DOCUMENT_TITLE_FONT_SIZE = 16;
export const DEFAULT_HEADER_FONT_SIZE = 10;
export const DEFAULT_TABLE_HEADER_FONT_SIZE = 10;
export const DEFAULT_BODY_FONT_SIZE = 9;
export const DEFAULT_MARGIN = 30;
export const DEFAULT_SHOW_DOCUMENT_BASE_TITLE = true;
export const DEFAULT_DOCUMENT_BASE_TITLE = "";
export const DEFAULT_SHOW_MODULE_TITLE = true;
export const DEFAULT_FOOTER_FONT_SIZE = 8;
export const DEFAULT_TABLE_BODY_FONT_SIZE = 8;



let cachedConfigs : Record<string, Partial<PdfLayoutSettings>> | null = null;

export const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ?{
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r:0,g:0,b:0};
      
};

export async function getPdfLayoutSettings(configKey: string=GENERAL_CONFIG_KEY): Promise<PdfLayoutSettings> {
const configs = await loadPdfLayoutSettingsFromFirestore();
const generalSettings = configs[GENERAL_CONFIG_KEY] || {};
const specificSettings = configs[configKey] || {};


return {
  logoUrl: specificSettings.logoUrl ?? generalSettings.logoUrl ?? DEFAULT_LOGO_URL,
  logoWidth: specificSettings.logoWidth ?? generalSettings.logoWidth ?? DEFAULT_LOGO_WIDTH,
  headerText: specificSettings.headerText ?? generalSettings.headerText ?? DEFAULT_HEADER_TEXT,
  footerText: specificSettings.footerText ?? generalSettings.footerText ?? DEFAULT_FOOTER_TEXT,
  primaryColor: specificSettings.primaryColor ?? generalSettings.primaryColor ?? DEFAULT_APP_PRIMARY_COLOR,
  pageSize: specificSettings.pageSize ?? generalSettings.pageSize ?? DEFAULT_PAGE_SIZE,
  orientation: specificSettings.orientation ?? generalSettings.orientation ?? DEFAULT_ORIENTATION,
  fontFamily: specificSettings.fontFamily ?? generalSettings.fontFamily ?? DEFAULT_FONT_FAMILY,
  defaultFontSize: specificSettings.defaultFontSize ?? generalSettings.defaultFontSize ?? DEFAULT_BODY_FONT_SIZE,
  documentTitleFontSize: specificSettings.documentTitleFontSize ?? generalSettings.documentTitleFontSize ?? DEFAULT_DOCUMENT_TITLE_FONT_SIZE, 
  headerFontSize: specificSettings.headerFontSize ?? generalSettings.headerFontSize ?? DEFAULT_HEADER_FONT_SIZE,
  footerFontSize: specificSettings.footerFontSize ?? generalSettings.footerFontSize ?? DEFAULT_FOOTER_FONT_SIZE,
  tableHeaderFontSize: specificSettings.tableHeaderFontSize ?? generalSettings.tableHeaderFontSize ?? DEFAULT_HEADER_FONT_SIZE,
  tableBodyFontSize: specificSettings.tableBodyFontSize ?? generalSettings.tableBodyFontSize ?? DEFAULT_TABLE_BODY_FONT_SIZE,
  marginTop: specificSettings.marginTop ?? generalSettings.marginTop ?? DEFAULT_MARGIN,
  marginBottom: specificSettings.marginBottom ?? generalSettings.marginBottom ?? DEFAULT_MARGIN,
  marginLeft: specificSettings.marginLeft ?? generalSettings.marginLeft ?? DEFAULT_MARGIN,
  marginRight: specificSettings.marginRight ?? generalSettings.marginRight ?? DEFAULT_MARGIN,
  showDocumentBaseTitle: specificSettings.showDocumentBaseTitle ?? generalSettings.showDocumentBaseTitle ?? DEFAULT_SHOW_DOCUMENT_BASE_TITLE,
  documentBaseTitle: specificSettings.documentBaseTitle ?? generalSettings.documentBaseTitle ?? DEFAULT_DOCUMENT_BASE_TITLE,
  showModuleTitle: specificSettings.showModuleTitle ?? generalSettings.showModuleTitle ?? DEFAULT_SHOW_MODULE_TITLE,

 };

}

export async function loadPdfLayoutSettingsFromFirestore() : Promise<Record<string,Partial<PdfLayoutSettings>>> {
  if (cachedConfigs) { 
      return cachedConfigs;
  }

  try { 
    const docRef = doc(firestore, PDF_LAYOUT_CONFIGS_KEY,FIRESTORE_DOCUMENT_ID );
    const docSnap = await getDoc (docRef);
    if (docSnap.exists()) {
      cachedConfigs = docSnap.data() as Record<string, Partial<PdfLayoutSettings>>;
        return cachedConfigs;
    } else {
        return {};
    } 

  } catch (error) {
    console.error("Error loading PDF layout settings from Firestore:", error);
    return {};
  }  
  
}

export async function savePdfLayoutSettingsToFirestore(configs: Record<string, Partial<PdfLayoutSettings>>): Promise<void> {
  try {
    const docRef = doc(firestore, PDF_LAYOUT_CONFIGS_KEY, FIRESTORE_DOCUMENT_ID);
    await setDoc(docRef, configs);
    cachedConfigs = null;
  } catch (error) {
    console.error("Error saving PDF layout settings to Firestore:", error);
    throw error;
  }
}
