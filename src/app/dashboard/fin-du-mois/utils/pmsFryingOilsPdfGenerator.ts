
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO, isValid, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

// --- Type Definitions ---
export type LedTpmStatus = 'lt_20' | '20_24' | 'gt_24' | '';

export interface FryerMaintenanceLogEntry {
  id: string;
  useDate: string; // ISO String
  filterDate?: string | null;
  filterSignature?: string;
  cleaningDate?: string | null;
  cleaningSignature?: string;
  changeDate?: string | null;
  changeSignature?: string;
}

export interface FryerOilTpmLogEntry {
  id: string;
  date: string; // ISO String
  operator?: string;
  fryerIdentifier: string;
  ledTpmStatus?: LedTpmStatus;
  tpmPercentage?: string;
}

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

// --- Data Fetching Functions ---

const getMaintenanceData = async (date: Date): Promise<FryerMaintenanceLogEntry[]> => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const q = query(
        collection(firestore, "pmsFryerMaintenanceLog"),
        where("useDate", ">=", Timestamp.fromDate(start)),
        where("useDate", "<=", Timestamp.fromDate(end)),
        orderBy("useDate", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            useDate: (data.useDate as Timestamp).toDate().toISOString(),
            filterDate: data.filterDate ? (data.filterDate as Timestamp).toDate().toISOString() : null,
            cleaningDate: data.cleaningDate ? (data.cleaningDate as Timestamp).toDate().toISOString() : null,
            changeDate: data.changeDate ? (data.changeDate as Timestamp).toDate().toISOString() : null,
        } as FryerMaintenanceLogEntry;
    });
};

const getTpmData = async (date: Date): Promise<FryerOilTpmLogEntry[]> => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const q = query(
        collection(firestore, "pmsFryerOilTpmLog"),
        where("date", ">=", Timestamp.fromDate(start)),
        where("date", "<=", Timestamp.fromDate(end)),
        orderBy("date", "asc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            date: (data.date as Timestamp).toDate().toISOString(),
        } as FryerOilTpmLogEntry;
    });
};


// --- PDF Generation Engine ---

export const generateFryingOilsPdf = async (selectedDate: Date): Promise<Blob> => {
    const maintenanceData = await getMaintenanceData(selectedDate);
    const tpmData = await getTpmData(selectedDate);
    const settingsKey = 'pms_fryer_oil_overall_monitoring';
    const pdfSettings = await getPdfLayoutSettings(settingsKey);
    const monthYearTitle = format(selectedDate, 'MMMM yyyy', { locale: fr });
    const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' }) as jsPDFWithAutoTable;
    doc.deletePage(1);

    if (maintenanceData.length === 0 && tpmData.length === 0) {
        doc.addPage();
        doc.setFontSize(18);
        doc.text(`Suivi des Huiles de Friture - ${monthYearTitle}`, doc.internal.pageSize.width / 2, 60, { align: 'center' });
        doc.setFontSize(14);
        doc.setTextColor(150);
        doc.text("Aucune donnée enregistrée pour ce mois.", doc.internal.pageSize.width / 2, 120, { align: 'center' });
        return doc.output('blob');
    }

    const drawHeader = (doc, settings) => {
        let currentY = settings.marginTop;
        const pageContentWidth = doc.internal.pageSize.width - settings.marginLeft - settings.marginRight;
        const effectiveHeaderText = settings.headerText || (settings.logoUrl ? '{logo}' : '');

        if (effectiveHeaderText) {
            const headerRows = effectiveHeaderText.split('\n');
            doc.setFontSize(settings.headerFontSize);
            for (const row of headerRows) {
                const cells = row.split('|');
                if (cells.length === 0) continue;
                let maxHeightInRow = 0;
                const cellWidth = pageContentWidth / cells.length;
                cells.forEach(cell => {
                    const cellText = cell.trim();
                    if (cellText === '{logo}' && settings.logoUrl) {
                        maxHeightInRow = Math.max(maxHeightInRow, 30);
                    } else {
                        const textLines = doc.splitTextToSize(cellText, cellWidth - 6);
                        maxHeightInRow = Math.max(maxHeightInRow, (textLines.length * settings.headerFontSize * 0.7) + 6);
                    }
                });

                let currentX = settings.marginLeft;
                for (const cell of cells) {
                    const cellText = cell.trim();
                    doc.rect(currentX, currentY, cellWidth, maxHeightInRow, 'S');
                    if (cellText === '{logo}' && settings.logoUrl) {
                        try {
                            const imgProps = doc.getImageProperties(settings.logoUrl);
                            const imgHeight = Math.min(maxHeightInRow - 6, 40);
                            const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                            doc.addImage(settings.logoUrl, imgProps.fileType, currentX + (cellWidth - imgWidth) / 2, currentY + (maxHeightInRow - imgHeight) / 2, imgWidth, imgHeight);
                        } catch (e) { console.error("Error adding logo to PDF.", e); }
                    } else if (cellText !== '{logo}') {
                        doc.text(cellText, currentX + (cellWidth / 2), currentY + (maxHeightInRow / 2), { align: 'center', baseline: 'middle', maxWidth: cellWidth - 6 });
                    }
                    currentX += cellWidth;
                }
                currentY += maxHeightInRow;
            }
            return currentY + 10;
        }
        return currentY;
    };

    const drawTitle = (doc, settings, moduleTitle, currentY) => {
        let finalTitle = settings.showDocumentBaseTitle && settings.documentBaseTitle ? settings.documentBaseTitle.trim() : "";
        if (settings.showModuleTitle) {
            finalTitle = finalTitle ? `${finalTitle} - ${moduleTitle}` : moduleTitle;
        }
        if (finalTitle) {
            doc.setFontSize(settings.documentTitleFontSize);
            doc.text(finalTitle, doc.internal.pageSize.width / 2, currentY, { align: 'center' });
            return currentY + settings.documentTitleFontSize + 5;
        }
        return currentY;
    };

    const drawFooter = (doc, settings, pageNumber, totalPages) => {
        if (settings.footerText) {
            const footerStr = settings.footerText
                .replace('{date}', generationDateFormatted)
                .replace('{pageNumber}', String(pageNumber))
                .replace('{totalPages}', String(totalPages));
            doc.setFontSize(settings.footerFontSize);
            doc.text(footerStr, settings.marginLeft, doc.internal.pageSize.height - (settings.marginBottom / 2));
        }
    };

    // Page 1: Maintenance Data
    if (maintenanceData.length > 0) {
        doc.addPage('a4', 'landscape');
        const moduleTitle = `Suivi de Maintenance des Friteuses - ${monthYearTitle}`;

        const headStyles: any = { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 8, cellPadding: 2 };
        if (pdfSettings.primaryColor) {
            const rgb = hexToRgb(pdfSettings.primaryColor);
            if (rgb) { headStyles.fillColor = pdfSettings.primaryColor; headStyles.textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 125 ? '#000' : '#FFF'; }
        }
        const subHeadStyles = { ...headStyles, fillColor: '#f3f4f6', textColor: '#000' };

        doc.autoTable({
            head: [
                [{ content: "Date d'Utilisation", rowSpan: 2, styles: headStyles }, { content: "Filtration", colSpan: 2, styles: headStyles }, { content: "Nettoyage", colSpan: 2, styles: headStyles }, { content: "Changement", colSpan: 2, styles: headStyles }],
                [{ content: "Date", styles: subHeadStyles }, { content: "Par", styles: subHeadStyles }, { content: "Date", styles: subHeadStyles }, { content: "Par", styles: subHeadStyles }, { content: "Date", styles: subHeadStyles }, { content: "Par", styles: subHeadStyles }]
            ],
            body: maintenanceData.map(e => [
                isValid(parseISO(e.useDate)) ? format(parseISO(e.useDate), "dd/MM/yyyy") : '-',
                e.filterDate && isValid(parseISO(e.filterDate)) ? format(parseISO(e.filterDate), "dd/MM/yy") : '-', e.filterSignature || '-',
                e.cleaningDate && isValid(parseISO(e.cleaningDate)) ? format(parseISO(e.cleaningDate), "dd/MM/yy") : '-', e.cleaningSignature || '-',
                e.changeDate && isValid(parseISO(e.changeDate)) ? format(parseISO(e.changeDate), "dd/MM/yy") : '-', e.changeSignature || '-',
            ]),
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center' },
            margin: { top: pdfSettings.marginTop + 80 },
            didDrawPage: (data) => {
                let headerY = drawHeader(doc, pdfSettings);
                drawTitle(doc, pdfSettings, moduleTitle, headerY);
            },
        });
    }

    // Page 2: TPM Data
    if (tpmData.length > 0) {
        doc.addPage('a4', 'portrait');
        const moduleTitle = `Suivi des Huiles (Contrôle TPM) - ${monthYearTitle}`;

        const headStyles: any = { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 9, cellPadding: 3 };
        if (pdfSettings.primaryColor) {
            const rgb = hexToRgb(pdfSettings.primaryColor);
            if (rgb) { headStyles.fillColor = pdfSettings.primaryColor; headStyles.textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 125 ? '#000' : '#FFF'; }
        }

        doc.autoTable({
            head: [["Date", "Opérateur", "Friteuse N°", "Statut LED", "% TPM"]],
            body: tpmData.map(e => {
                let statusStyle: any = { halign: 'center' };
                let statusText = '-';
                if (e.ledTpmStatus === 'lt_20') { statusStyle.fillColor = '#bbf7d0'; statusText = 'Conservation'; }
                else if (e.ledTpmStatus === '20_24') { statusStyle.fillColor = '#fef08a'; statusText = 'Surveillance'; }
                else if (e.ledTpmStatus === 'gt_24') { statusStyle.fillColor = '#fecaca'; statusText = 'Changement'; }
                
                return [
                    isValid(parseISO(e.date)) ? format(parseISO(e.date), "dd/MM/yyyy") : '-',
                    e.operator || '-', e.fryerIdentifier,
                    { content: statusText, styles: statusStyle },
                    e.tpmPercentage ? `${e.tpmPercentage}%` : '-',
                ];
            }),
            theme: 'grid',
            headStyles: headStyles,
            styles: { fontSize: 9, cellPadding: 3, valign: 'middle', halign: 'center' },
            margin: { top: pdfSettings.marginTop + 80 },
            didDrawPage: (data) => {
                let headerY = drawHeader(doc, pdfSettings);
                drawTitle(doc, pdfSettings, moduleTitle, headerY);
            },
        });
    }

    // Final Footer Pass
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(doc, pdfSettings, i, totalPages);
    }

    return doc.output('blob');
};
