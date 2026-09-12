
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { SimplifiedTaskRecord, SimplifiedMonthlyKitchenCleaningRecord, PmsZoneWithTasksDefinition, PmsConfigurations } from '@/app/dashboard/pms/types';
import { PMS_KITCHEN_CLEANING_KEY, PMS_RESTAURANT_CLEANING_KEY } from '@/app/dashboard/settings/types';
import { getMonthDays, type DayData } from '@/app/dashboard/pms/utils';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

// Fonction interne pour générer un PDF pour une zone, avec le style EXACT des modules PMS
const generatePdfWithCorrectStyle = async (
    zoneData: PmsZoneWithTasksDefinition,
    records: SimplifiedMonthlyKitchenCleaningRecord,
    monthData: DayData[],
    year: string,
    monthLabel: string,
    pdfSettingsKey: 'pms_kitchen_cleaning_monthly' | 'pms_restaurant_cleaning_monthly',
    titlePrefix: string
): Promise<{ filename: string, data: Blob } | null> => {

    const getRecord = (date: string, zoneId: string, taskId: string): SimplifiedTaskRecord => {
        const recordKey = `${date}_${zoneId}_${taskId}`;
        return records[recordKey] || { status: '', operator: '' };
    };

    try {
        const pdfSettings = await getPdfLayoutSettings(pdfSettingsKey);
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: pdfSettings.pageSize as any }) as jsPDFWithAutoTable;

        let tableStartY = pdfSettings.marginTop;
        const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;

        // --- En-tête (Logique complète avec logo, comme dans les modules) ---
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
                            doc.text('Logo', currentX + cellWidth / 2, tableStartY + maxHeightInRow / 2, { align: 'center', baseline: 'middle' });
                        }
                    } else {
                        doc.text(cellText, currentX + cellWidth / 2, tableStartY + maxHeightInRow / 2, { align: 'center', baseline: 'middle', maxWidth: cellWidth - 8 });
                    }
                    currentX += cellWidth;
                }
                tableStartY += maxHeightInRow;
            }
            tableStartY += 10;
        }

        // --- NOM DE LA ZONE (Ajouté comme demandé) ---
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`Zone : ${zoneData.name}`, doc.internal.pageSize.width / 2, tableStartY, { align: 'center' });
        tableStartY += 14 + 5; // Hauteur de la police + marge
        doc.setFont(undefined, 'normal'); // Réinitialiser le style de la police


        // --- Titre (Logique modifiée pour ne plus inclure la zone) ---
        const moduleDefaultTitle = `${monthLabel} ${year}`;
        let finalTitle = pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle ? pdfSettings.documentBaseTitle.trim() : "";
        if (pdfSettings.showModuleTitle) {
            finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
        }
        if(finalTitle) {
            doc.setFontSize(pdfSettings.documentTitleFontSize);
            doc.text(finalTitle, doc.internal.pageSize.width / 2, tableStartY, { align: 'center' });
            tableStartY += pdfSettings.documentTitleFontSize + 5;
        }

        // --- Tableau (Structure exacte de votre image) ---
        const headStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, valign: 'middle', halign: 'center' };
        let primaryRgbColor = null; // Variable pour garder la couleur
        if (pdfSettings.primaryColor) {
            const rgb = hexToRgb(pdfSettings.primaryColor);
            if(rgb) {
                primaryRgbColor = [rgb.r, rgb.g, rgb.b];
                headStyles.fillColor = primaryRgbColor;
                headStyles.textColor = ((rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000) > 125 ? [0,0,0] : [255,255,255];
            }
        }

        const headRow1: any[] = [{ content: 'Date', rowSpan: 2 }, { content: 'Jour', rowSpan: 2 }];
        const headRow2: any[] = [];
        zoneData.tasks.forEach(task => {
            headRow1.push({ content: task.name, colSpan: 2 });
            headRow2.push('Fait?');
            headRow2.push('Par?');
        });

        const body = monthData.map(day => {
            const row: any[] = [day.dayOfMonth.toString(), day.dayName];
            zoneData.tasks.forEach(task => {
                const record = getRecord(day.date, zoneData.id, task.id);
                row.push({ content: record.status === 'fait' ? 'X' : '-', styles: { halign: 'center' } });
                row.push({ content: record.operator ? record.operator.split(' ').map(n=>n[0]).join('').toUpperCase() : '-', styles: { halign: 'center' } });
            });
            return row;
        });

        doc.autoTable({
            startY: tableStartY,
            head: [headRow1, headRow2],
            body: body,
            theme: 'grid',
            headStyles,
            styles: { fontSize: pdfSettings.tableBodyFontSize, cellPadding: 2, font: pdfSettings.fontFamily, lineWidth: 0.1, lineColor: [0, 0, 0] },
            didParseCell: (data) => {
                // Appliquer le style week-end uniquement sur le corps du tableau
                if (data.section === 'body' && data.row.index !== undefined && monthData[data.row.index]?.isWeekend) {
                    data.cell.styles.fillColor = '#f3f4f6';
                }
                // Forcer la couleur de l'en-tête pour toutes les cellules de l'en-tête
                if (data.section === 'head' && primaryRgbColor) {
                    data.cell.styles.fillColor = primaryRgbColor;
                }
            },
            margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom },
        });

        const filename = `${titlePrefix.replace(/\s/g, '_')}_${zoneData.name.replace(/\s/g, '_')}_${monthLabel}_${year}.pdf`;
        return { filename, data: doc.output('blob') };

    } catch (error) {
        console.error(`Erreur lors de la génération du PDF pour ${zoneData.name}:`, error);
        return null;
    }
};


// Fonction principale exportée qui utilise le générateur stylisé
export const generateCombinedCleaningPlanPdfs = async (selectedDate: Date): Promise<Blob | null> => {
    const zip = new JSZip();
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const monthLabel = format(selectedDate, "MMMM", { locale: fr });
    const monthData = getMonthDays(year, month);
    let hasContent = false;

    // 1. Récupérer la configuration
    const configRef = doc(firestore, "pmsConfigurations", "mainConfig");
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
        console.error("Document de configuration 'mainConfig' introuvable.");
        return null; // Retourne null si la config n'existe pas
    }
    const pmsConfigs = configSnap.data() as PmsConfigurations;
    const kitchenZones = pmsConfigs[PMS_KITCHEN_CLEANING_KEY] || [];
    const restaurantZones = pmsConfigs[PMS_RESTAURANT_CLEANING_KEY] || [];

    // 2. Récupérer les enregistrements pour les deux modules
    const kitchenRecordsId = `records_${year}_${month}`;
    const restaurantRecordsId = `records_${year}_${month}`;
    const kitchenDocRef = doc(firestore, "pmsKitchenCleaningRecords", kitchenRecordsId);
    const restaurantDocRef = doc(firestore, "pmsRestaurantCleaningRecords", restaurantRecordsId);
    const [kitchenSnap, restaurantSnap] = await Promise.all([getDoc(kitchenDocRef), getDoc(restaurantDocRef)]);
    const allRecords = {
        ...(kitchenSnap.exists() ? kitchenSnap.data() : {}),
        ...(restaurantSnap.exists() ? restaurantSnap.data() : {}),
    };

    // 3. Générer les PDF pour la Cuisine
    if (kitchenZones.length > 0) {
        const kitchenFolder = zip.folder("Plans de Nettoyage Cuisine");
        for (const zone of kitchenZones) {
            const pdfOutput = await generatePdfWithCorrectStyle(zone, allRecords, monthData, year.toString(), monthLabel, 'pms_kitchen_cleaning_monthly', 'Cuisine');
            if (pdfOutput) {
                kitchenFolder?.file(pdfOutput.filename, pdfOutput.data);
                hasContent = true;
            }
        }
    }

    // 4. Générer les PDF pour le Restaurant
    if (restaurantZones.length > 0) {
        const restaurantFolder = zip.folder("Plans de Nettoyage Restaurant");
        for (const zone of restaurantZones) {
            const pdfOutput = await generatePdfWithCorrectStyle(zone, allRecords, monthData, year.toString(), monthLabel, 'pms_restaurant_cleaning_monthly', 'Restaurant');
            if (pdfOutput) {
                restaurantFolder?.file(pdfOutput.filename, pdfOutput.data);
                hasContent = true;
            }
        }
    }

    // Si aucun PDF n'a été généré, retourner null
    if (!hasContent) {
        return null;
    }

    return zip.generateAsync({ type: "blob" });
};