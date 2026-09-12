
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { BenefitEmployee, BenefitDailyStatusCode, FullMonthlyBenefitData } from '../types';
import { BENEFIT_STATUS_LEGEND } from '../types';

// Define the jsPDF extension for autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

// Define the structure for the data required by the PDF generator
export interface BenefitPdfData {
  selectedYear: string;
  selectedMonth: string;
  benefitData: FullMonthlyBenefitData;
  employeesToRender: BenefitEmployee[];
  daysInSelectedMonth: { dayNumber: number; dayLetter: string; isWeekend: boolean; }[];
  months: { value: string; label: string; }[];
}

export const generateBenefitPdf = async (data: BenefitPdfData) => {
  const {
    selectedYear,
    selectedMonth,
    benefitData,
    employeesToRender,
    daysInSelectedMonth,
    months,
  } = data;

  // Helper function to calculate totals, replicated from the original component
  const calculateTotal = (employeeId: string, type: 'planning' | 'repasPris'): number => {
    const employeeEntries = benefitData[employeeId];
    if (!employeeEntries) return 0;
    return Object.values(employeeEntries).reduce((sum, entry) => sum + (entry[type] === "X" ? 1 : 0), 0);
  };

  try {
    const pdfSettings = await getPdfLayoutSettings('benefits');
    const doc = new jsPDF({
      orientation: pdfSettings.orientation as any,
      unit: 'pt',
      format: pdfSettings.pageSize as any,
    }) as jsPDFWithAutoTable;

    doc.setFont(pdfSettings.fontFamily || 'helvetica');

    const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
    const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

    let tableStartY = pdfSettings.marginTop;
    const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;

    // Header
    const effectiveHeaderText = pdfSettings.headerText || (pdfSettings.logoUrl ? '{logo}' : '');
      if (effectiveHeaderText) {
          const headerRows = effectiveHeaderText.split('\n');
          doc.setFontSize(pdfSettings.headerFontSize);

          for (const row of headerRows) {
              const cells = row.split('|');
              if (cells.length === 0) continue;
              
              const cellWidth = pageContentWidth / cells.length;
              let maxHeightInRow = 0;
              
              cells.forEach(cell => {
                  const cellText = cell.trim();
                  if (cellText === '{logo}' && pdfSettings.logoUrl) {
                      maxHeightInRow = Math.max(maxHeightInRow, 40);
                  } else {
                      const textLines = doc.splitTextToSize(cellText, cellWidth - 8);
                      maxHeightInRow = Math.max(maxHeightInRow, (textLines.length * pdfSettings.headerFontSize * 0.8) + 8);
                  }
              });

              let currentX = pdfSettings.marginLeft;
              for (const cell of cells) {
                  const cellText = cell.trim();
                  doc.rect(currentX, tableStartY, cellWidth, maxHeightInRow, 'S');
                  
                  if (cellText === '{logo}' && pdfSettings.logoUrl) {
                      try {
                          const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                          const cellPadding = 8;
                          const aspectRatio = imgProps.width / imgProps.height;
                          let imgWidth = cellWidth - cellPadding;
                          let imgHeight = imgWidth / aspectRatio;
                          if (imgHeight > maxHeightInRow - cellPadding) {
                              imgHeight = maxHeightInRow - cellPadding;
                              imgWidth = imgHeight * aspectRatio;
                          }
                          const imgX = currentX + (cellWidth - imgWidth) / 2;
                          const imgY = tableStartY + (maxHeightInRow - imgHeight) / 2;
                          doc.addImage(pdfSettings.logoUrl, imgProps.fileType, imgX, imgY, imgWidth, imgHeight);
                      } catch (e) { 
                          console.error("Error adding logo to PDF header:", e);
                          doc.text('Logo', currentX + cellWidth / 2, tableStartY + maxHeightInRow / 2, { align: 'center', baseline: 'middle' });
                      }
                  } else {
                      doc.text(cellText, currentX + cellWidth / 2, tableStartY + maxHeightInRow / 2, { 
                          align: 'center', 
                          baseline: 'middle', 
                          maxWidth: cellWidth - 8 
                      });
                  }
                  currentX += cellWidth;
              }
              tableStartY += maxHeightInRow;
          }
          tableStartY += 10;
      }

    // Title
    const moduleDefaultTitle = `Suivi Avantages en Nature - ${monthLabel} ${selectedYear}`;
    let finalTitle = "";
    if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle) {
      finalTitle = pdfSettings.documentBaseTitle.trim();
    }
    if (pdfSettings.showModuleTitle) {
      finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
    }

    if (finalTitle) {
      doc.setFontSize(pdfSettings.documentTitleFontSize || 18);
      doc.text(finalTitle, doc.internal.pageSize.width / 2, tableStartY, { align: 'center', maxWidth: pageContentWidth }); 
      tableStartY += (pdfSettings.documentTitleFontSize || 18) * 0.7 + 10;
    }

    // Table
    const headStyles: any = { 
      fontStyle: 'bold',
      fontSize: pdfSettings.tableHeaderFontSize,
      font: pdfSettings.fontFamily,
      valign: 'middle',
      halign: 'center'
    };

    if (pdfSettings.primaryColor) {
      const primaryRgb = hexToRgb(pdfSettings.primaryColor);
      if (primaryRgb) {
        headStyles.fillColor = [primaryRgb.r, primaryRgb.g, primaryRgb.b];
        const brightness = (primaryRgb.r * 299 + primaryRgb.g * 587 + primaryRgb.b * 114) / 1000;
        headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
      }
    }

    const statusColorMapping: { [key: string]: string } = {
      'X': '#dcfce7',   // Green
      'ABS': '#ffedd5', // Orange
      'R': '#dbeafe',   // Blue
      'M': '#fef9c3',   // Yellow
      'F': '#e5e7eb',   // Gray
      'CP': '#f3e8ff'  // Purple
    };
    const weekendColorHex = '#f3f4f6';

    const head: any = [
        [{ content: 'Employé', rowSpan: 2, styles: { ...headStyles } }, { content: 'Type', rowSpan: 2, styles: { ...headStyles } }],
        []
      ];

      daysInSelectedMonth.forEach(day => {
        (head[0] as any[]).push({ content: day.dayNumber.toString(), styles: { ...headStyles } });
        const weekendHeaderStyle = day.isWeekend ? { fillColor: hexToRgb(weekendColorHex) ? [hexToRgb(weekendColorHex)!.r, hexToRgb(weekendColorHex)!.g, hexToRgb(weekendColorHex)!.b] : undefined } : {};
        (head[1] as any[]).push({ content: day.dayLetter, styles: { ...headStyles, fontSize: (pdfSettings.tableHeaderFontSize || 9) - 1, ...weekendHeaderStyle } });
      });
      (head[0] as any[]).push({ content: 'TOTAL', rowSpan: 2, styles: { ...headStyles } });

      const body = employeesToRender.flatMap(employee => {
        const planningRow: any[] = [{ content: employee.name, rowSpan: 2, styles: { valign: 'middle', fontStyle: 'bold'} }, 'Planning'];
        const repasPrisRow: any[] = ['Repas Pris'];

        daysInSelectedMonth.forEach(day => {
          const dateKey = `${selectedYear}-${(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-${day.dayNumber.toString().padStart(2, '0')}`;
          const entry = benefitData[employee.id]?.[dateKey] || { planning: "", repasPris: "" };

          const getCellStyle = (status: BenefitDailyStatusCode) => {
              const style: any = { halign: 'center', fontSize: pdfSettings.tableBodyFontSize };
              const statusColorHex = statusColorMapping[status];

              if (statusColorHex) {
                  const rgb = hexToRgb(statusColorHex);
                  if (rgb) {
                    style.fillColor = [rgb.r, rgb.g, rgb.b];
                  }
              } else if (day.isWeekend) {
                  const rgb = hexToRgb(weekendColorHex);
                   if (rgb) {
                    style.fillColor = [rgb.r, rgb.g, rgb.b];
                  }
              }
              return style;
          };

          planningRow.push({ content: entry.planning, styles: getCellStyle(entry.planning) });
          repasPrisRow.push({ content: entry.repasPris, styles: getCellStyle(entry.repasPris) });
        });

        planningRow.push({ content: calculateTotal(employee.id, 'planning'), styles: { halign: 'center', fontStyle: 'bold'} });
        repasPrisRow.push({ content: calculateTotal(employee.id, 'repasPris'), styles: { halign: 'center', fontStyle: 'bold'} });
        return [planningRow, repasPrisRow];
      });

    doc.autoTable({
        startY: tableStartY,
        head: head,
        body: body,
        theme: 'grid',
        margin: {
            left: pdfSettings.marginLeft,
            right: pdfSettings.marginRight,
            bottom: pdfSettings.marginBottom,
        },
        styles: { 
            fontSize: pdfSettings.tableBodyFontSize, 
            font: pdfSettings.fontFamily,
            cellPadding: 2,
            lineWidth: 0.1,
            lineColor: [0,0,0]
        },
        didDrawPage: (data) => {
          if (pdfSettings.footerText) {
            const pageCount = doc.internal.getNumberOfPages();
            let footerStr = pdfSettings.footerText
              .replace('{date}', generationDateFormatted)
              .replace('{pageNumber}', data.pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
            doc.setFontSize(pdfSettings.footerFontSize || 8);
            doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
          }
        },
      });

    // Legend
    let finalY = (doc as any).lastAutoTable.finalY || tableStartY;
      finalY += 20;

      const legendColorMapping: { [key: string]: string } = {
        'bg-green-100': statusColorMapping['X'],
        'bg-orange-100': statusColorMapping['ABS'],
        'bg-blue-100': statusColorMapping['R'],
        'bg-yellow-100': statusColorMapping['M'],
        'bg-gray-200': statusColorMapping['F'],
        'bg-purple-100': statusColorMapping['CP'],
        'border': '#9ca3af'
      };

      doc.setFontSize(pdfSettings.defaultFontSize || 10);
      doc.text('Légende :', pdfSettings.marginLeft, finalY);
      finalY += (pdfSettings.defaultFontSize || 10) + 5;

      const legendBoxSize = 10;
      const legendBoxMargin = 15;
      const legendTextMargin = 5;
      let legendX = pdfSettings.marginLeft;
      let legendY = finalY;

      BENEFIT_STATUS_LEGEND.forEach(item => {
        const colorClass = item.displayClass.split(' ').find(c => c.startsWith('bg-') || c === 'border');
        const itemTextWidth = doc.getTextWidth(item.label);
        const itemTotalWidth = legendBoxSize + legendTextMargin + itemTextWidth + legendBoxMargin;

        if (legendX + itemTotalWidth > pageContentWidth + pdfSettings.marginLeft) {
            legendX = pdfSettings.marginLeft;
            legendY += legendBoxSize + 8;
        }

        if (colorClass && legendColorMapping[colorClass]) {
          const rgb = hexToRgb(legendColorMapping[colorClass]);
          if(rgb) {
            doc.setFillColor(rgb.r, rgb.g, rgb.b);
            doc.rect(legendX, legendY, legendBoxSize, legendBoxSize, 'F');
          }
        } else {
           doc.rect(legendX, legendY, legendBoxSize, legendBoxSize, 'S');
        }
        
        doc.setFontSize(pdfSettings.tableBodyFontSize || 8);
        doc.text(item.label, legendX + legendBoxSize + legendTextMargin, legendY + legendBoxSize / 2, { verticalAlign: 'middle' });
        legendX += itemTotalWidth;
      });

    // Save the PDF
    doc.save(`Avantages_Nature_${monthLabel}_${selectedYear}.pdf`);
    
    return true; // Indicate success

  } catch (error) {
    console.error("Error generating benefit PDF:", error);
    throw error; // Rethrow to be caught by the calling component
  }
};
