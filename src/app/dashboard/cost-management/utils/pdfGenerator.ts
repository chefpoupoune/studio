
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb, loadPdfLayoutSettingsFromFirestore } from '@/lib/pdf-settings';
import type { CostEntry, DailyCoefficientEntry } from '../types';

// Define the jsPDF extension for autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

// Define the structure for the data required by the PDF generator
interface MonthlyCostPdfData {
  selectedMonth: string;
  selectedYear: string;
  costData: CostEntry[];
  dailyCoeffData: DailyCoefficientEntry[];
  supplierTotals: { totalHt: number; totalTva: number; totalAvoir: number; };
  dailyCoeffTotals: any; // Consider creating a more specific type for this
  grandTotalGlobalJourValue: number;
  prixDeRevientMensuel: number;
  daysInMonthArray: { dayOfMonth: number; dayName: string; }[];
  months: { value: string; label: string; }[];
}

export const generateMonthlyCostPdf = async (data: MonthlyCostPdfData) => {
  const {
    selectedMonth,
    selectedYear,
    costData,
    dailyCoeffData,
    supplierTotals,
    dailyCoeffTotals,
    grandTotalGlobalJourValue,
    prixDeRevientMensuel,
    daysInMonthArray,
    months,
  } = data;

  try {
    const allConfigs = await loadPdfLayoutSettingsFromFirestore();
    const pdfSettings = await getPdfLayoutSettings('monthly_cost', allConfigs);

    const doc = new jsPDF({
      orientation: pdfSettings.orientation,
      unit: 'pt',
      format: pdfSettings.pageSize,
    }) as jsPDFWithAutoTable;

    doc.setFont(pdfSettings.fontFamily || 'helvetica');
    const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
    const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
    const yearLabel = selectedYear;

    let currentY = pdfSettings.marginTop;
    const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;

    // Header
    if (pdfSettings.headerText) {
        const headerRows = pdfSettings.headerText.split('\n');
        doc.setFontSize(pdfSettings.headerFontSize);

        for (const row of headerRows) {
            const cells = row.split('|');
            if (cells.length === 0) continue;
            
            const cellWidth = pageContentWidth / cells.length;
            let maxHeightInRow = 0;
            
            cells.forEach(cell => {
                const cellText = cell.trim();
                if (cellText === '{logo}' && pdfSettings.logoUrl) {
                    maxHeightInRow = Math.max(maxHeightInRow, 30);
                } else {
                    const textLines = doc.splitTextToSize(cellText, cellWidth - 6);
                    const textHeight = textLines.length * pdfSettings.headerFontSize * 0.7;
                    maxHeightInRow = Math.max(maxHeightInRow, textHeight);
                }
            });
            maxHeightInRow += 6;

            let currentX = pdfSettings.marginLeft;
            for (const cell of cells) {
                const cellText = cell.trim();
                doc.rect(currentX, currentY, cellWidth, maxHeightInRow, 'S');

                if (cellText === '{logo}' && pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
                    try {
                        const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                        const formatType = imgProps.fileType.toUpperCase();
                        const desiredImgHeight = Math.min(maxHeightInRow - 6, 40);
                        const imgWidth = (imgProps.width * desiredImgHeight) / imgProps.height;
                        const imgX = currentX + (cellWidth - imgWidth) / 2;
                        const imgY = currentY + (maxHeightInRow - desiredImgHeight) / 2;
                        doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, desiredImgHeight);
                    } catch (e) {
                        console.error("Error adding logo to PDF header cell:", e);
                        doc.text("Logo", currentX + 3, currentY + pdfSettings.headerFontSize);
                    }
                } else {
                    doc.text(cellText, currentX + 3, currentY + pdfSettings.headerFontSize * 0.8, {
                        maxWidth: cellWidth - 6,
                        align: 'left'
                    });
                }
                currentX += cellWidth;
            }
            currentY += maxHeightInRow;
        }
        currentY += 10;
    }

    // Title
    const moduleDefaultTitle = `Fiche de Coût de Revient Mensuel - ${monthLabel} ${yearLabel}`;
    let finalTitle = "";
    if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle && pdfSettings.documentBaseTitle.trim() !== "") {
        finalTitle = pdfSettings.documentBaseTitle.trim();
    }
    if (pdfSettings.showModuleTitle) {
        if (finalTitle) {
            finalTitle += ` - ${moduleDefaultTitle}`;
        } else {
            finalTitle = moduleDefaultTitle;
        }
    }
    
    if(finalTitle) {
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text(finalTitle, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
        currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;
    }

    const tableHeadStyles: any = {
      fontStyle: 'bold',
      fontSize: pdfSettings.tableHeaderFontSize,
      halign: 'center',
      valign: 'middle',
    };
    const tableBodyStyles: any = { fontSize: pdfSettings.tableBodyFontSize, valign: 'middle' };
    const darkFooterCellStyles = { fontStyle: 'bold', fillColor: [45, 55, 72], textColor: [255, 255, 255] };

    if (pdfSettings.primaryColor) {
      const primaryRgb = hexToRgb(pdfSettings.primaryColor);
      if (primaryRgb) {
        tableHeadStyles.fillColor = [primaryRgb.r, primaryRgb.g, primaryRgb.b];
        const brightness = (primaryRgb.r * 299 + primaryRgb.g * 587 + primaryRgb.b * 114) / 1000;
        tableHeadStyles.textColor = brightness > 125 ? [0, 0, 0] : [255, 255, 255];
      }
    } else {
      tableHeadStyles.fillColor = [200, 200, 200];
      tableHeadStyles.textColor = [0, 0, 0];
    }
    
    // Supplier Table
    doc.setFontSize(pdfSettings.defaultFontSize + 2);
    doc.setFont(undefined, 'bold');
    const titleText1 = "Tableau des Fournisseurs";
    doc.text(titleText1, pdfSettings.marginLeft, currentY);
    const textWidth1 = doc.getTextDimensions(titleText1).w;
    doc.setLineWidth(0.5);
    doc.line(pdfSettings.marginLeft, currentY + 2, pdfSettings.marginLeft + textWidth1, currentY + 2);
    doc.setFont(undefined, 'normal');
    currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 3;

    const supplierTableHead = [['Fournisseur', 'HT (€)', 'TVA (€)', 'Avoir (€)']];
    const supplierTableBody = costData.map(row => [
      row.fournisseur,
      row.ht.toFixed(2),
      row.tva.toFixed(2),
      row.avoir.toFixed(2),
    ]);
    const supplierTableFoot = [[
      { content: 'Total Fournisseurs', styles: { ...darkFooterCellStyles, halign: 'right' } },
      { content: supplierTotals.totalHt.toFixed(2), styles: { ...darkFooterCellStyles, halign: 'right' } },
      { content: supplierTotals.totalTva.toFixed(2), styles: { ...darkFooterCellStyles, halign: 'right' } },
      { content: supplierTotals.totalAvoir.toFixed(2), styles: { ...darkFooterCellStyles, halign: 'right' } },
    ]];

    doc.autoTable({
      head: supplierTableHead,
      body: supplierTableBody,
      foot: supplierTableFoot,
      startY: currentY,
      theme: 'grid',
      headStyles: tableHeadStyles,
      styles: { ...tableBodyStyles, halign: 'left' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
      tableWidth: 'auto',
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;

    // Daily Coefficients Table
    doc.setFontSize(pdfSettings.defaultFontSize + 2);
    doc.setFont(undefined, 'bold');
    const titleText2 = "Tableau des Coefficients et Quantités Journaliers";
    doc.text(titleText2, pdfSettings.marginLeft, currentY);
    const textWidth2 = doc.getTextDimensions(titleText2).w;
    doc.setLineWidth(0.5);
    doc.line(pdfSettings.marginLeft, currentY + 2, pdfSettings.marginLeft + textWidth2, currentY + 2);
    doc.setFont(undefined, 'normal');
    currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 3;

    const dailyCoeffTableHead = [['Jour', 'IMP', 'SAJ', 'IME', 'ESAT', 'Repas ++', 'Nous', 'Total Coeff.', 'PN', 'PN ESAT', 'Total PN', 'TOTAL GLOBAL JOUR.']];
    const dailyCoeffTableBody = dailyCoeffData.map((entry, dayIndex) => {
        const dayInfo = daysInMonthArray[dayIndex];
        return [
            `${dayInfo.dayOfMonth} - ${dayInfo.dayName.substring(0,3)}`,
            entry.imp === "" ? "0" : Number(entry.imp).toFixed(0),
            entry.saj === "" ? "0" : Number(entry.saj).toFixed(0),
            entry.ime === "" ? "0" : Number(entry.ime).toFixed(0),
            entry.esat === "" ? "0" : Number(entry.esat).toFixed(0),
            entry.repasPlus === "" ? "0" : Number(entry.repasPlus).toFixed(0),
            entry.nous === "" ? "0" : Number(entry.nous).toFixed(0),
            { content: dailyCoeffTotals.totalCoeffJour[dayIndex].toFixed(0), styles: { fontStyle: 'bold' } },
            entry.pn === "" ? "0" : Number(entry.pn).toFixed(0),
            entry.pnEsat === "" ? "0" : Number(entry.pnEsat).toFixed(0),
            { content: dailyCoeffTotals.totalPnJour[dayIndex].toFixed(0), styles: { fontStyle: 'bold' } },
            { content: dailyCoeffTotals.totalGlobalJour[dayIndex].toFixed(0), styles: { fontStyle: 'bold' } },
        ]
    });
    const dailyCoeffTableFoot = [[
        { content: 'Total Mois', styles: { ...darkFooterCellStyles, halign: 'right'} },
        { content: dailyCoeffTotals.imp.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
        { content: dailyCoeffTotals.saj.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
        { content: dailyCoeffTotals.ime.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
        { content: dailyCoeffTotals.esat.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
        { content: dailyCoeffTotals.repasPlus.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
        { content: dailyCoeffTotals.nous.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
        { content: (dailyCoeffTotals.totalCoeffJour.reduce((s: number,v: number) => s+v,0)).toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center' } },
        { content: dailyCoeffTotals.pn.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
        { content: dailyCoeffTotals.pnEsat.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
        { content: (dailyCoeffTotals.totalPnJour.reduce((s: number,v: number) => s+v,0)).toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center' } },
        { content: grandTotalGlobalJourValue.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center' } },
    ]];

    doc.autoTable({
        head: dailyCoeffTableHead, body: dailyCoeffTableBody, foot: dailyCoeffTableFoot,
        startY: currentY, theme: 'grid',
        headStyles: {...tableHeadStyles, fontSize: 7, cellPadding: 1}, 
        styles: {...tableBodyStyles, fontSize: 6.5, cellPadding: 0.5, halign: 'center'}, 
        footStyles: { ...tableHeadStyles, fontSize: 7, cellPadding: 1, halign: 'center', fillColor: darkFooterCellStyles.fillColor, textColor: darkFooterCellStyles.textColor },
        columnStyles: { 
            0: { halign: 'left', cellWidth: 35, fontStyle: 'bold' }, 
            7: { fontStyle: 'bold', fillColor: [227, 242, 253] }, // Total Coeff.
            10: { fontStyle: 'bold', fillColor: [232, 245, 233] }, // Total PN
            11: { fontStyle: 'bold', fillColor: [253, 237, 237] }  // TOTAL GLOBAL JOUR
        },
        margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
        pageBreak: 'avoid',
        didDrawPage: (data) => {
            const pageCount = doc.internal.getNumberOfPages();
            if (pdfSettings.footerText) {
                let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
                doc.setFontSize(pdfSettings.footerFontSize);
                doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
            }
        },
    });
    currentY = (doc as any).lastAutoTable.finalY + 20;

    // Final Summary
    doc.setFontSize(pdfSettings.defaultFontSize + 2);
    doc.setFont(undefined, 'bold');
    doc.text("Calcul du Prix de Revient Mensuel", pdfSettings.marginLeft, currentY);
    doc.setFont(undefined, 'normal');
    currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 15;

    const coutMatierePrem = supplierTotals.totalHt - supplierTotals.totalAvoir;

    const drawUnderlinedTitle = (title: string, value: string, y: number) => {
        doc.setFontSize(pdfSettings.defaultFontSize);
        doc.setFont(undefined, 'normal');
        const titleText = `${title}:`;
        const titleWidth = doc.getTextDimensions(titleText).w;
        doc.text(titleText, pdfSettings.marginLeft, y);
        doc.setLineWidth(0.5);
        doc.line(pdfSettings.marginLeft, y + 2, pdfSettings.marginLeft + titleWidth, y + 2);
        doc.setFont(undefined, 'bold');
        doc.text(value, pdfSettings.marginLeft + titleWidth + 5, y);
        doc.setFont(undefined, 'normal');
        return y + pdfSettings.defaultFontSize * 0.7 + 12;
    };

    currentY = drawUnderlinedTitle(
        "Coût Matière Première (Total HT Fournisseurs - Total Avoir Fournisseurs)",
        `${coutMatierePrem.toFixed(2)} €`,
        currentY
    );
    currentY = drawUnderlinedTitle(
        "Total du Mois ",
        `${grandTotalGlobalJourValue.toFixed(2)}`,
        currentY
    );
    currentY += 10;

    doc.setFontSize(pdfSettings.defaultFontSize + 2);
    doc.setFont(undefined, 'bold');
    const prixRevientText = `Prix de Revient du Mois:`;
    const prixRevientWidth = doc.getTextDimensions(prixRevientText).w;
    doc.text(prixRevientText, pdfSettings.marginLeft, currentY);
    doc.setLineWidth(0.5);
    doc.line(pdfSettings.marginLeft, currentY + 2, pdfSettings.marginLeft + prixRevientWidth, currentY + 2);
    doc.text(`${prixDeRevientMensuel.toFixed(2)} €`, pdfSettings.marginLeft + prixRevientWidth + 10, currentY);
    doc.setFont(undefined, 'normal');

    // Save the PDF
    doc.save(`Cout_Revient_Mensuel_${monthLabel}_${yearLabel}.pdf`);
    
    return true; // Indicate success
  } catch (error) {
    console.error("Error generating PDF:", error);
    // You might want to throw the error or return an error object
    // to be handled by the calling component (e.g., to show a toast)
    throw error;
  }
};
