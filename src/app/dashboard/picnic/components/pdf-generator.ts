import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { StoredPicnicMenuTemplate, PICNIC_MENU_DAY_KEYS, PICNIC_MENU_DAYS_LABELS, PICNIC_MENU_MONTHS, NUM_PICNIC_ITEM_SLOTS } from "../types";
import { getPdfLayoutSettings, hexToRgb } from "@/lib/pdf-settings";

const PDF_CONFIG_KEY = 'picnic_menu';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const generatePicnicMenuPDF = async (
  monthlyTemplates: StoredPicnicMenuTemplate[],
  month: string
) => {
  const pdfSettings = await getPdfLayoutSettings(PDF_CONFIG_KEY);
  
  const doc = new jsPDF({
    orientation: pdfSettings.orientation as any,
    unit: "pt",
    format: pdfSettings.pageSize as any,
  }) as jsPDFWithAutoTable;

  const monthLabel = PICNIC_MENU_MONTHS.find((m) => m.value.toString() === month)?.label || month;
  const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

  const drawFooter = (data: any, pageNumber: number, pageCount: number) => {
      if (pdfSettings.footerText) {
          let footerStr = pdfSettings.footerText
              .replace('{date}', generationDateFormatted)
              .replace('{pageNumber}', pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
          doc.setFontSize(pdfSettings.footerFontSize);
          doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
      }
  };

  let totalPages = 1;
  const pageHeight = doc.internal.pageSize.getHeight();

  // Pre-calculate total pages
  let yPosForPaging = pdfSettings.marginTop;
  monthlyTemplates.forEach((template, index) => {
      if (index > 0) yPosForPaging += 20; // Space before title
      const estimatedTableHeight = 120; // Rough estimate
      yPosForPaging += estimatedTableHeight;
      if (template.weeklyNote) yPosForPaging += 30; // Space for note
      if (yPosForPaging > pageHeight - pdfSettings.marginBottom) {
          totalPages++;
          yPosForPaging = pdfSettings.marginTop;
      }
  });

  let currentPage = 1;
  let yPos = pdfSettings.marginTop;

  // Header for all pages
  const drawHeader = () => {
    const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;
    yPos = pdfSettings.marginTop;
    
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
              doc.rect(currentX, yPos, cellWidth, maxHeightInRow, 'S');

              if (cellText === '{logo}' && pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
                  try {
                      const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                      const formatType = imgProps.fileType.toUpperCase();
                      const desiredImgHeight = Math.min(maxHeightInRow - 6, 40);
                      const imgWidth = (imgProps.width * desiredImgHeight) / imgProps.height;
                      const imgX = currentX + (cellWidth - imgWidth) / 2;
                      const imgY = yPos + (maxHeightInRow - desiredImgHeight) / 2;
                      doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, desiredImgHeight);
                  } catch (e) { console.error("Error adding logo to PDF header:", e); }
              } else {
                  doc.text(cellText, currentX + 3, yPos + pdfSettings.headerFontSize * 0.8, { maxWidth: cellWidth - 6, align: 'left' });
              }
              currentX += cellWidth;
          }
          yPos += maxHeightInRow;
      }
      yPos += 10;
    }
  };

  drawHeader();

  const moduleDefaultTitle = `Modèles Pique Nique - ${monthLabel}`;
  let finalTitle = "";
  if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle && pdfSettings.documentBaseTitle.trim() !== "") {
    finalTitle = pdfSettings.documentBaseTitle.trim();
  }
  if (pdfSettings.showModuleTitle) {
    finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
  }
  if (finalTitle) {
    doc.setFontSize(pdfSettings.documentTitleFontSize);
    doc.text(finalTitle, doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
    yPos += pdfSettings.documentTitleFontSize;
  }

  const headStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, valign: 'middle' };
  if (pdfSettings.primaryColor) {
      const primaryRgb = hexToRgb(pdfSettings.primaryColor);
      if(primaryRgb) {
          headStyles.fillColor = [primaryRgb.r, primaryRgb.g, primaryRgb.b];
          const brightness = (primaryRgb.r * 299 + primaryRgb.g * 587 + primaryRgb.b * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
      }
  }

  for (const [index, template] of monthlyTemplates.entries()) {
    const tableHeight = (NUM_PICNIC_ITEM_SLOTS + 1) * (pdfSettings.tableBodyFontSize + 8) + 20;
    const noteHeight = template.weeklyNote ? 40 : 0;
    const sectionHeight = tableHeight + noteHeight + 30;

    if (yPos + sectionHeight > pageHeight - pdfSettings.marginBottom && index > 0) {
      drawFooter(null, currentPage, totalPages);
      doc.addPage();
      currentPage++;
      drawHeader();
    }

    yPos += 20;
    doc.setFontSize(pdfSettings.defaultFontSize);
    doc.text(`Semaine Modèle ${index + 1}`, pdfSettings.marginLeft, yPos);
    yPos += 15;

    const tableData = Array.from({ length: NUM_PICNIC_ITEM_SLOTS }).map((_, rowIndex) => {
      return PICNIC_MENU_DAY_KEYS.map(
        (dayKey) => template.days[dayKey]?.[rowIndex] || ""
      );
    });

    doc.autoTable({
      startY: yPos,
      head: [PICNIC_MENU_DAY_KEYS.map((dayKey) => PICNIC_MENU_DAYS_LABELS[dayKey])],
      body: tableData,
      theme: 'grid',
      headStyles: headStyles,
      styles: {
        font: pdfSettings.fontFamily,
        fontSize: pdfSettings.tableBodyFontSize,
        cellPadding: 4,
      },
      margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
    });
    
    yPos = (doc as any).lastAutoTable.finalY;

    if (template.weeklyNote) {
        yPos += 15;
        doc.setFont(pdfSettings.fontFamily, 'bold');
        doc.setFontSize(pdfSettings.defaultFontSize - 1);
        doc.text('Note pour ce modèle:', pdfSettings.marginLeft, yPos);
        yPos += pdfSettings.defaultFontSize;
        doc.setFont(pdfSettings.fontFamily, 'normal');
        doc.text(template.weeklyNote, pdfSettings.marginLeft, yPos, { maxWidth: doc.internal.pageSize.getWidth() - pdfSettings.marginLeft - pdfSettings.marginRight });
        yPos += 15;
    }
  }

  drawFooter(null, currentPage, totalPages);
  doc.save(`menu-pique-nique-${monthLabel}.pdf`);
};
