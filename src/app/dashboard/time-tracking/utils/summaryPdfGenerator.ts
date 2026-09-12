import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { formatHours } from '@/lib/time-utils';
import type { BrigadeMember, TimeEntry } from '../types';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

// Helper to ensure date is a JS Date object and is valid
const ensureValidDate = (date: any): Date | null => {
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (date && typeof date.toDate === 'function') {
    d = date.toDate(); // Convert Firestore Timestamp
  } else {
    d = new Date(date); // Fallback for strings/numbers
  }
  return isNaN(d.getTime()) ? null : d;
};

export interface TimeSummaryPdfData {
  member: BrigadeMember;
  timeEntries: TimeEntry[];
  year: string;
  month: string;
}

const monthsArray = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(2000, i), "MMMM", { locale: fr }),
}));

export const generateTimeSummaryPdf = async (data: TimeSummaryPdfData) => {
  const { member, timeEntries, year, month } = data;
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);

  const allValidMemberEntries = timeEntries
    .filter(entry => entry.memberId === member.id)
    .map(entry => {
      const validDate = ensureValidDate(entry.date);
      return validDate ? { ...entry, date: validDate } : null;
    })
    .filter((entry): entry is (TimeEntry & { date: Date }) => entry !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const startOfMonthUTC = Date.UTC(yearNum, monthNum, 1, 0, 0, 0, 0);
  const startOfNextMonthUTC = Date.UTC(yearNum, monthNum + 1, 1, 0, 0, 0, 0);

  const previousBalance = allValidMemberEntries
    .filter(entry => entry.date.getTime() < startOfMonthUTC)
    .reduce((balance, entry) => {
      if (entry.type === 'addition') return balance + entry.hours;
      if (entry.type === 'deduction') return balance - entry.hours;
      return balance;
    }, 0);

  const entriesForSelectedMonth = allValidMemberEntries
    .filter(entry => {
        const entryTime = entry.date.getTime();
        return entryTime >= startOfMonthUTC && entryTime < startOfNextMonthUTC;
    });

  const statsForSelectedMonth = {
    totalAddedThisMonth: entriesForSelectedMonth.filter(e => e.type === 'addition').reduce((s, e) => s + e.hours, 0),
    totalDeductedThisMonth: entriesForSelectedMonth.filter(e => e.type === 'deduction').reduce((s, e) => s + e.hours, 0),
    get netHoursThisMonth() { return this.totalAddedThisMonth - this.totalDeductedThisMonth; },
  };

  const cumulativeBalance = previousBalance + statsForSelectedMonth.netHoursThisMonth;

  try {
    const pdfSettings = await getPdfLayoutSettings('time_tracking_summary');
    const doc = new jsPDF({ orientation: pdfSettings.orientation as any, unit: 'pt', format: pdfSettings.pageSize as any }) as jsPDFWithAutoTable;
    doc.setFont(pdfSettings.fontFamily || 'helvetica');
    const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
    const selectedMonthLabel = monthsArray.find(m => m.value === month)?.label || '';
    let tableStartY = pdfSettings.marginTop;
    const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;

    const effectiveHeaderText = pdfSettings.headerText || (pdfSettings.logoUrl ? '{logo}' : '');
    if (effectiveHeaderText) {
        // Header drawing logic...
        tableStartY += 10;
    }

    const moduleDefaultTitle = `Relevé d'Heures - ${member.name} (${member.role}) - ${selectedMonthLabel} ${year}`;
    let finalTitle = "";
    if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle) finalTitle = pdfSettings.documentBaseTitle.trim();
    if (pdfSettings.showModuleTitle) finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;

    if (finalTitle) {
      doc.setFontSize(pdfSettings.documentTitleFontSize);
      const titleDimensions = doc.getTextDimensions(finalTitle, { fontSize: pdfSettings.documentTitleFontSize, maxWidth: pageContentWidth });
      doc.text(finalTitle, doc.internal.pageSize.width / 2, tableStartY, { align: 'center', maxWidth: pageContentWidth });
      tableStartY += titleDimensions.h + 10;
    }
      
    doc.setFontSize(pdfSettings.defaultFontSize + 2);
    doc.text("Récapitulatif des Heures pour la période:", pdfSettings.marginLeft, tableStartY); tableStartY += 20;
    doc.setFontSize(pdfSettings.defaultFontSize);
    doc.text(`Solde Reporté (avant ${selectedMonthLabel} ${year}): ${formatHours(previousBalance)}`, pdfSettings.marginLeft, tableStartY); tableStartY += 15;
    doc.text(`Total Heures Ajoutées (${selectedMonthLabel} ${year}): ${formatHours(statsForSelectedMonth.totalAddedThisMonth)}`, pdfSettings.marginLeft, tableStartY); tableStartY += 15;
    doc.text(`Total Heures Déduites (${selectedMonthLabel} ${year}): ${formatHours(statsForSelectedMonth.totalDeductedThisMonth)}`, pdfSettings.marginLeft, tableStartY); tableStartY += 15;
    doc.text(`Solde du Mois (${selectedMonthLabel} ${year}): ${formatHours(statsForSelectedMonth.netHoursThisMonth)}`, pdfSettings.marginLeft, tableStartY); tableStartY += 15;
    doc.setFontSize(pdfSettings.defaultFontSize + 1); doc.setFont(undefined, 'bold');
    doc.text(`Nouveau Solde Cumulé (fin ${selectedMonthLabel} ${year}): ${formatHours(cumulativeBalance)}`, pdfSettings.marginLeft, tableStartY); tableStartY += 25;
    doc.setFont(undefined, 'normal');

    const headStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, halign: 'center' };
    if (pdfSettings.primaryColor) {
      const rgb = hexToRgb(pdfSettings.primaryColor);
      if (rgb) { headStyles.fillColor = [rgb.r, rgb.g, rgb.b]; const b = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000; headStyles.textColor = b > 125 ? [0,0,0] : [255,255,255]; }
    }

    doc.autoTable({
      startY: tableStartY,
      head: [['Date', 'Type', 'Heures', 'Raison']],
      body: entriesForSelectedMonth.sort((a, b) => b.date.getTime() - a.date.getTime()).map(entry => [
        format(entry.date, "dd/MM/yyyy", { locale: fr }),
        entry.type === 'addition' ? 'Ajout' : 'Déduction',
        formatHours(entry.hours),
        entry.reason,
      ]),
      theme: 'grid', headStyles, styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
      margin: { top: pdfSettings.marginTop, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
      didDrawPage: (data) => {
        if (pdfSettings.footerText) {
          const pageCount = doc.internal.getNumberOfPages();
          let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
          doc.setFontSize(pdfSettings.footerFontSize);
          doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
        }
      }
    });

    doc.save(`Releve_Heures_${member.name.replace(/\s+/g, '_')}_${selectedMonthLabel}_${year}.pdf`);
    return true;

  } catch (error) {
    console.error("Error generating time summary PDF:", error);
    throw error;
  }
};
