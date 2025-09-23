
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, getDaysInMonth, startOfMonth, addDays, getYear, getMonth, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

// --- INTERFACES & TYPES ---
interface jsPDFWithAutoTable extends jsPDF { autoTable: (options: any) => jsPDFWithAutoTable; lastAutoTable?: { finalY: number }; }
export interface PdfLayoutSettings { /* ... définition ... */ }
export interface PmsEquipmentDefinition { /* ... */ }
export interface MonthlyTempGridLog { /* ... */ }
export interface PmsZoneWithTasksDefinition { /* ... */ }
export interface SimplifiedMonthlyCleaningRecord { /* ... */ }
export interface ReceptionLogEntry { /* ... */ }
export interface TempChangeLogEntry { /* ... */ }
export interface PicnicLogEntry { /* ... */ }
export interface DefrostingLogEntry { /* ... */ }

// Nouveau type pour l'huile de friture
export interface FryerOilLogEntry {
    id: string;
    date: string; // ISO
    fryerName: string;
    oilAnalysis: string;
    action: 'Filtrée' | 'Changée' | 'N/A';
    operator: string;
}

// Nouveau type pour la liaison froide
export interface ColdChainLogEntry {
    id: string;
    productName: string;
    productionDate: string; // ISO
    coolingEndDate: string; // ISO
    labelingCompliance: 'Conforme' | 'Non-conforme' | 'N/A';
    operator: string;
}

const monthsArray = Array.from({ length: 12 }, (_, i) => ({ value: i.toString(), label: format(new Date(2000, i), "MMMM", { locale: fr }) }));
const hexToRgb = (hex: string): [number, number, number] | null => { /* ... */ return null; };
const addFooter = (doc: jsPDFWithAutoTable, settings: Required<PdfLayoutSettings>) => { /* ... */ };

// --- MODULES PDF EXISTANTS ---
export const generateTemperatureMonitoringPdf = async (...args: any[]): Promise<Blob> => new Blob();
export const generateCombinedTemperatureMonitoringPdf = async (...args: any[]): Promise<Blob> => new Blob();
export const generateKitchenCleaningPdf = async (...args: any[]): Promise<Blob> => new Blob();
export const generateCombinedKitchenCleaningPdf = async (...args: any[]): Promise<Blob> => new Blob();
export const generateRestaurantCleaningPdf = async (...args: any[]): Promise<Blob> => new Blob();
export const generateCombinedRestaurantCleaningPdf = async (...args: any[]): Promise<Blob> => new Blob();
export const generateReceptionMonitoringPdf = async (...args: any[]): Promise<Blob> => new Blob();
export const generateTempChangeMonitoringPdf = async (...args: any[]): Promise<Blob> => new Blob();
export const generatePicnicMonitoringPdf = async (...args: any[]): Promise<Blob> => new Blob();
export const generateDefrostingMonitoringPdf = async (...args: any[]): Promise<Blob> => new Blob();

// --- MODULE: SUIVI HUILES DE FRITURE ---
export const generateFryerOilMonitoringPdf = async (entries: FryerOilLogEntry[], year: string, month: string, pdfSettings: Required<PdfLayoutSettings>): Promise<Blob> => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }) as jsPDFWithAutoTable;
  const monthLabel = monthsArray.find(m => m.value === month)?.label || '';
  const title = `Suivi des Huiles de Friture - ${monthLabel} ${year}`;
  // ... (Header, Title, etc.)

  if (entries.length === 0) {
    doc.text("Aucun contrôle d'huile de friture enregistré pour ce mois.", doc.internal.pageSize.getWidth() / 2, 100, { align: 'center' });
  } else {
    const head = [['Date', 'Friteuse', 'Analyse Huile', 'Action', 'Opérateur']];
    const body = entries.map(e => [
      format(new Date(e.date), 'dd/MM/yy'),
      e.fryerName,
      e.oilAnalysis,
      e.action,
      e.operator
    ]);
    doc.autoTable({ head, body, startY: 80, theme: 'grid' });
  }

  addFooter(doc, pdfSettings as Required<PdfLayoutSettings>);
  return doc.output('blob');
};

// --- MODULE: LIAISON FROIDE ---
export const generateColdChainMonitoringPdf = async (entries: ColdChainLogEntry[], year: string, month: string, pdfSettings: Required<PdfLayoutSettings>): Promise<Blob> => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }) as jsPDFWithAutoTable;
  const monthLabel = monthsArray.find(m => m.value === month)?.label || '';
  const title = `Suivi de Liaison Froide - ${monthLabel} ${year}`;
  // ... (Header, Title, etc.)

  if (entries.length === 0) {
    doc.text("Aucun suivi de liaison froide enregistré pour ce mois.", doc.internal.pageSize.getWidth() / 2, 100, { align: 'center' });
  } else {
    const head = [['Produit', 'Date Production', 'Refroidissement OK', 'Etiquetage Conforme', 'Opérateur']];
    const body = entries.map(e => [
      e.productName,
      format(new Date(e.productionDate), 'dd/MM/yy'),
      format(new Date(e.coolingEndDate), 'dd/MM/yy HH:mm'),
      e.labelingCompliance,
      e.operator
    ]);
    doc.autoTable({ head, body, startY: 80, theme: 'grid' });
  }

  addFooter(doc, pdfSettings as Required<PdfLayoutSettings>);
  return doc.output('blob');
};
