
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import JSZip from 'jszip';
import { format, getYear, getMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { getMonthDays } from '../utils';
import type { PmsEquipmentDefinition, MonthlyTempGridLog, PmsConfigurations } from '../types';
import { PMS_TEMPERATURE_MONITORING_KEY } from '@/app/dashboard/settings/types';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const getEquipmentZoneInfo = (temp: number, currentConfig: PmsEquipmentDefinition): { label: string; pdfColor?: [number, number, number] } => {
    const parse = (val: any): number | undefined => val !== undefined && val !== null && !isNaN(parseFloat(val)) ? parseFloat(val) : undefined;
    
    const targetMin = parse(currentConfig.targetTempMin), targetMax = parse(currentConfig.targetTempMax);
    const tol1Min = parse(currentConfig.tolerance1TempMin), tol1Max = parse(currentConfig.tolerance1TempMax);
    const tol2Min = parse(currentConfig.tolerance2TempMin), tol2Max = parse(currentConfig.tolerance2TempMax);

    if (targetMin !== undefined && targetMax !== undefined && temp >= targetMin && temp <= targetMax) return { label: "Cible", pdfColor: [200, 230, 201] }; 
    if (tol1Min !== undefined && tol1Max !== undefined && temp >= tol1Min && temp <= tol1Max) return { label: "Tol. 1", pdfColor: [173, 216, 230] }; 
    if (tol2Min !== undefined && tol2Max !== undefined && temp >= tol2Min && temp <= tol2Max) return { label: "Tol. 2", pdfColor: [254, 249, 195] }; 
    return { label: "Rejet", pdfColor: [254, 202, 202] }; 
};

export const generateSingleEquipmentPdf = async (
    equipmentConfig: PmsEquipmentDefinition, 
    equipmentRecords: MonthlyTempGridLog, 
    selectedDate: Date
): Promise<{ filename: string; data: Blob } | null> => {
    
    const year = getYear(selectedDate);
    const month = getMonth(selectedDate);
    const monthDays = getMonthDays(year, month);
    const monthLabel = format(selectedDate, "MMMM", { locale: fr });

    try {
      const pdfSettings = await getPdfLayoutSettings('pms_temperature_monitoring_monthly');
      const doc = new jsPDF({ orientation: pdfSettings.orientation as any || 'landscape', unit: 'pt', format: pdfSettings.pageSize as any || 'a4' }) as jsPDFWithAutoTable;
      
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
          currentY += 15;
      }

      // --- NOM DE L'ÉQUIPEMENT (Ajouté) ---
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`Enceinte Réfrigérée : ${equipmentConfig.name}`, doc.internal.pageSize.width / 2, currentY, { align: 'center' });
        currentY += 14 + 10; // Hauteur de la police + marge
        doc.setFont(undefined, 'normal'); // Réinitialiser le style de la police


      const moduleDefaultTitle = `Relevé des Températures - ${monthLabel} ${year}`;
      let finalTitle = pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle ? pdfSettings.documentBaseTitle.trim() : "";
      if (pdfSettings.showModuleTitle) finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
      if (finalTitle) {
          doc.setFontSize(pdfSettings.documentTitleFontSize);
          doc.text(finalTitle, doc.internal.pageSize.width / 2, currentY, { align: 'center' });
          currentY += pdfSettings.documentTitleFontSize + 15;
      } else {
          currentY += 10;
      }

      const contentStartY = currentY;

      // --- TABLEAU PRINCIPAL ---
      doc.autoTable({
        startY: contentStartY,
        head: (() => {
            const headStyles: any = { fontStyle: 'bold', fontSize: 6.5, halign: 'center', valign: 'middle', cellPadding: 0.5 };
            if (pdfSettings.primaryColor) {
                const rgb = hexToRgb(pdfSettings.primaryColor);
                if (rgb) { headStyles.fillColor = [rgb.r, rgb.g, rgb.b]; headStyles.textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 125 ? [0,0,0] : [255,255,255]; }
            }
            return [[ 
                { content: 'T°C / Zone', styles: headStyles },
                ...monthDays.map(day => ({
                    content: `${day.dayOfMonth}\n${day.dayName.substring(0, 1)}`,
                    styles: { ...headStyles, fillColor: day.isWeekend ? [230, 230, 230] : headStyles.fillColor, textColor: day.isWeekend ? [100, 100, 100] : headStyles.textColor }
                }))
            ]];
        })(),
        body: (() => {
            const tempRows = equipmentConfig.equipmentType === 'refrigerator'
                ? Array.from({ length: 12 - (-5) + 1 }, (_, i) => 12 - i)
                : Array.from({ length: -10 - (-25) + 1 }, (_, i) => -10 - i);
            
            const bodyRows = tempRows.map(temp => {
                const zoneInfo = getEquipmentZoneInfo(temp, equipmentConfig);
                return [
                    { content: `${temp}°C\n(${zoneInfo.label})`, styles: { fontStyle: 'bold', fontSize: 5.5, fillColor: zoneInfo.pdfColor, valign: 'middle', halign: 'center' } },
                    ...monthDays.map(day => {
                        const record = equipmentRecords[day.date];
                        const isOutOfOrder = record?.isOutOfOrder;
                        const isSelected = record?.markedTemp === temp;
                        const styles = { 
                            halign: 'center', 
                            minCellHeight: 10,
                            fillColor: isOutOfOrder ? [230, 230, 230] : (isSelected ? zoneInfo.pdfColor : (day.isWeekend ? [240, 240, 240] : [255, 255, 255]))
                        };
                        return { content: isOutOfOrder ? '' : (isSelected ? 'X' : ''), styles: styles };
                    })
                ];
            });

            const footerRowStyles = { fontSize: 5.5, fontStyle: 'italic', halign: 'center', cellPadding: 0.5, minCellHeight: 10 };
            bodyRows.push(
                [{ content: 'Heure', styles: { ...footerRowStyles, fontStyle: 'bold' } }, ...monthDays.map(day => {
                    const record = equipmentRecords[day.date];
                    if (record?.isOutOfOrder) {
                        return { content: 'EN PANNE', styles: {...footerRowStyles, fontStyle: 'bold', fillColor: [230, 230, 230], valign: 'middle'} };
                    }
                    return { content: record?.time || '-', styles: footerRowStyles };
                })],
                [{ content: 'Opérateur', styles: { ...footerRowStyles, fontStyle: 'bold' } }, ...monthDays.map(day => {
                     const record = equipmentRecords[day.date];
                     if (record?.isOutOfOrder) {
                        return { content: '', styles: {...footerRowStyles, fillColor: [230, 230, 230]} };
                    }
                     return { content: record?.operator || '-', styles: footerRowStyles };
                })]
            );
            return bodyRows;
        })(),
        theme: 'grid',
        styles: { fontSize: 6.5, cellPadding: 0.5, valign: 'middle', font: pdfSettings.fontFamily },
        columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, ...Object.fromEntries(monthDays.map((_, i) => [i + 1, { cellWidth: (doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight - 60) / monthDays.length, halign: 'center' }])) },
        margin: { right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
        didDrawPage: (data: any) => {
            // --- PIED DE PAGE ---
            if (pdfSettings.footerText) {
                doc.setFontSize(pdfSettings.footerFontSize);
                doc.text(
                    pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', doc.internal.getNumberOfPages().toString()),
                    doc.internal.pageSize.width / 2,
                    doc.internal.pageSize.height - (pdfSettings.marginBottom / 2),
                    { align: 'center' }
                );
            }
        },
      });

      const filename = `Releve_Temperature_${equipmentConfig.name.replace(/\s/g, '_')}_${monthLabel}_${year}.pdf`;
      
      return {
        filename,
        data: doc.output('blob')
      };

    } catch (error) {
      console.error(`Error in generateSingleEquipmentPdf for ${equipmentConfig.name}:`, error);
      return null;
    }
};

export const generateEquipmentTemperatureArchive = async (selectedDate: Date): Promise<Blob | null> => {
    const year = getYear(selectedDate);
    const month = getMonth(selectedDate);
    
    const pmsSettingsDocRef = doc(firestore, "pmsConfigurations", "mainConfig");
    let equipmentList: PmsEquipmentDefinition[] = [];
    try {
        const pmsSettingsSnap = await getDoc(pmsSettingsDocRef);
        if (pmsSettingsSnap.exists()) {
            const pmsSettings = pmsSettingsSnap.data() as PmsConfigurations;
            equipmentList = (pmsSettings[PMS_TEMPERATURE_MONITORING_KEY] || []) as PmsEquipmentDefinition[];
        }
    } catch (error) {
        console.error("Error loading PMS equipment configurations for PDF generation:", error);
        return null;
    }

    if (equipmentList.length === 0) {
        console.log("No equipment configured for temperature monitoring.");
        return null;
    }

    const zip = new JSZip();
    const monthLabel = format(selectedDate, "MMMM", { locale: fr });
    const folderName = `Relevés Températures Équipements - ${monthLabel} ${year}`;
    const folder = zip.folder(folderName);

    if (!folder) {
        console.error("Failed to create a folder in JSZip.");
        return null;
    }

    for (const equipment of equipmentList) {
        const docId = `tempGridLog_${equipment.id}_${year}_${month}`;
        const docRef = doc(firestore, "pmsTemperatureGridLogs", docId);
        try {
            const docSnap = await getDoc(docRef);
            const equipmentRecords = docSnap.exists() ? (docSnap.data() as MonthlyTempGridLog) : {};
            
            const pdfOutput = await generateSingleEquipmentPdf(equipment, equipmentRecords, selectedDate);
            if (pdfOutput) {
                folder.file(pdfOutput.filename, pdfOutput.data, { binary: true });
            }
        } catch (error) {
            console.error(`Failed to load records or generate PDF for ${equipment.name}`, error);
        }
    }

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        return zipBlob;
    } catch(e) {
        console.error("Error generating temperature ZIP blob:", e);
        return null;
    }
};
