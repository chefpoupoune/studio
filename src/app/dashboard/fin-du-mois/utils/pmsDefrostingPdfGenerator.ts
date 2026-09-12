
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { DefrostingEntry } from '@/app/dashboard/pms/types';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const generateDefrostingMonitoringPdf = async (
    entries: DefrostingEntry[],
    selectedDate: Date
): Promise<Blob> => {

    const pdfSettings = await getPdfLayoutSettings('pms_defrosting_monitoring');
    const doc = new jsPDF({
        orientation: pdfSettings.orientation as any || 'landscape',
        unit: 'pt',
        format: pdfSettings.pageSize as any || 'a4',
    }) as jsPDFWithAutoTable;

    const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

    // --- DESSIN MANUEL DE L'EN-TÊTE ET DU TITRE ---
    let currentY = pdfSettings.marginTop;
    const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;

    const effectiveHeaderText = pdfSettings.headerText || (pdfSettings.logoUrl ? '{logo}' : '');
    if (effectiveHeaderText) {
        const headerRows = effectiveHeaderText.split('\n');
        doc.setFontSize(pdfSettings.headerFontSize);

        for (const row of headerRows) {
            const cells = row.split('|');
            if (cells.length === 0) continue;
            
            let maxHeightInRow = 0;
            const cellWidth = pageContentWidth / cells.length;
            
            cells.forEach(cell => {
                const cellText = cell.trim();
                if (cellText === '{logo}' && pdfSettings.logoUrl) {
                    maxHeightInRow = Math.max(maxHeightInRow, (pdfSettings.logoWidth || 40) + 6);
                } else {
                    maxHeightInRow = Math.max(maxHeightInRow, (doc.splitTextToSize(cellText, cellWidth - 6).length * pdfSettings.headerFontSize * 0.7) + 10);
                }
            });

            let currentX = pdfSettings.marginLeft;
            for (const cell of cells) {
                const cellText = cell.trim();
                doc.setDrawColor(0,0,0);
                doc.rect(currentX, currentY, cellWidth, maxHeightInRow, 'S');

                if (cellText === '{logo}' && pdfSettings.logoUrl) {
                    try {
                        const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                        const desiredLogoHeight = pdfSettings.logoWidth || 40;
                        const imgHeight = Math.min(maxHeightInRow - 6, desiredLogoHeight);
                        const imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                        doc.addImage(pdfSettings.logoUrl, imgProps.fileType, currentX + (cellWidth - imgWidth) / 2, currentY + (maxHeightInRow - imgHeight) / 2, imgWidth, imgHeight);
                    } catch (e) { console.error("Error drawing logo.", e); }
                } else if (cellText !== '{logo}') {
                    doc.text(cellText, currentX + cellWidth / 2, currentY + maxHeightInRow / 2, { align: 'center', baseline: 'middle', maxWidth: cellWidth - 6 });
                }
                currentX += cellWidth;
            }
            currentY += maxHeightInRow;
        }
    }

    const monthYearTitle = format(selectedDate, 'MMMM yyyy', { locale: fr });
    const moduleDefaultTitle = `Suivi de Décongélation - ${monthYearTitle}`;
    let finalTitle = pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle ? pdfSettings.documentBaseTitle.trim() : "";
    if (pdfSettings.showModuleTitle) {
        finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
    }
    if (finalTitle) {
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text(finalTitle, doc.internal.pageSize.width / 2, currentY + pdfSettings.documentTitleFontSize, { align: 'center' });
        currentY += pdfSettings.documentTitleFontSize + 15;
    } else {
        currentY += 10;
    }

    const contentStartY = currentY;

    const drawFooter = (data: any) => {
        if (pdfSettings.footerText) {
            const pageNum = data.pageNumber || doc.internal.getNumberOfPages();
            const totalPages = data.totalPages || doc.internal.getNumberOfPages();
            const footerStr = pdfSettings.footerText
                .replace('{date}', generationDateFormatted)
                .replace('{pageNumber}', pageNum.toString())
                .replace('{totalPages}', totalPages.toString());

            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(
                footerStr,
                doc.internal.pageSize.width / 2,
                doc.internal.pageSize.height - (pdfSettings.marginBottom / 2),
                { align: 'center' }
            );
        }
    };

    if (entries.length === 0) {
        const messageY = contentStartY + 40;
        doc.setFontSize(14);
        doc.setTextColor(150);
        doc.text("Aucune donnée enregistrée pour ce mois.", doc.internal.pageSize.width / 2, messageY, { align: 'center' });
        drawFooter({ pageNumber: 1, totalPages: 1 });
    } else {
        const headStyles: any = { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 8, cellPadding: 2 };
        if (pdfSettings.primaryColor) {
            const rgb = hexToRgb(pdfSettings.primaryColor);
            if (rgb) {
                headStyles.fillColor = pdfSettings.primaryColor;
                headStyles.textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 125 ? '#000000' : '#FFFFFF';
            }
        }

        const head = [["Date", "Produit", "Qté", "T° Sortie", "H. Sortie", "Initiales", "Date Util.", "H. Util.", "T° Util.", "Initiales Fin"]];
        const body = entries.map(entry => [
            entry.defrostStartDate ? format(parseISO(entry.defrostStartDate), "dd/MM/yy") : '',
            entry.productName, entry.quantity,
            entry.tempOnRemoval || '°C', entry.defrostStartTime || '', entry.initialsStart || '',
            entry.useDate ? format(parseISO(entry.useDate), "dd/MM/yy") : '-',
            entry.useTime || '-', entry.tempOnUse || '-°C', entry.initialsEnd || '-',
        ]);

        doc.autoTable({
            head, body, startY: contentStartY, theme: 'grid', headStyles: headStyles,
            styles: { fontSize: 8, cellPadding: 2, valign: 'middle', halign: 'center' },
            columnStyles: { 1: { halign: 'left' } },
            margin: { right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
            didDrawPage: (data: any) => {
                drawFooter(data);
            },
        });
    }

    return doc.output('blob');
};
