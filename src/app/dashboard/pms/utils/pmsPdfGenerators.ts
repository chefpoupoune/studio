
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO, getYear, getMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { groupMenusByWeek } from '../../menu-planning/utils';
import type { DailyMenu, MenuField } from '../../menu-planning/types';
import { initialMenuItem } from '../../menu-planning/types';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const mealPartsOrder: MenuField[] = ['entree', 'plat', 'feculent', 'legume', 'sauce', 'dessert'];

const mealPartDisplayNames: Record<MenuField, string> = {
  entree: "Entrée",
  plat: "Plat Principal",
  feculent: "Féculent",
  legume: "Légume",
  sauce: "Sauce",
  dessert: "Dessert",
  theme: "Thème" 
};

const getMenuDataForMonth = async (date: Date): Promise<DailyMenu[]> => {
    const year = getYear(date);
    const month = getMonth(date);
    const docId = `menu_${year}_${month}`;
    const docRef = doc(firestore, "menuPlanning", docId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            return (firestoreData.menus as any[] || []).map(d => ({ ...initialMenuItem, ...d }));
        } else {
            return [];
        }
    } catch (error) {
        console.error(`Error fetching menu document ${docId}:`, error);
        return [];
    }
};

const getTemperatureLogData = async (date: Date) => {
    const year = getYear(date);
    const month = getMonth(date);
    const docId = `temps_${year}_${month}`;
    const docRef = doc(firestore, "menuTemperatureLogs", docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
};

export const generateTemperatureMonitoringPdf = async (selectedDate: Date): Promise<Blob | null> => {
    const year = getYear(selectedDate);
    const month = getMonth(selectedDate);
    
    const menuData = await getMenuDataForMonth(selectedDate);
    const tempLogs = await getTemperatureLogData(selectedDate);

    if (menuData.length === 0) {
        console.log("No menu data found for the selected month.");
        return null;
    }

    const weeklyGroupedMenus = groupMenusByWeek(year, month, menuData);
    if (weeklyGroupedMenus.length === 0 || weeklyGroupedMenus.every(week => week.menus.length === 0)) {
        console.log("Menu data found, but grouping by week resulted in empty data.");
        return null;
    }

    const pdfSettings = await getPdfLayoutSettings('temperature_sheet_monthly');
    const doc = new jsPDF({ orientation: pdfSettings.orientation as any, unit: 'pt', format: pdfSettings.pageSize as any }) as jsPDFWithAutoTable;
    const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
    doc.setFont(pdfSettings.fontFamily);

    const drawPageStructure = (pageNumber: number, totalPages: number) => {
        let currentY = pdfSettings.marginTop;
        const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;
        
        // --- EN-TÊTE --- 
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

        // --- TITRE --- 
        const monthYearStr = format(new Date(year, month), "MMMM yyyy", { locale: fr });
        const moduleDefaultTitle = `Fiche de Température Mensuelle - ${monthYearStr}`;
        let finalTitle = pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle ? pdfSettings.documentBaseTitle.trim() : "";
        if (pdfSettings.showModuleTitle) finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
        if (finalTitle) {
            doc.setFontSize(pdfSettings.documentTitleFontSize);
            doc.text(finalTitle, doc.internal.pageSize.width / 2, currentY + pdfSettings.documentTitleFontSize, { align: 'center' });
            currentY += pdfSettings.documentTitleFontSize + 15;
        } else {
            currentY += 10;
        }
        
        // --- PIED DE PAGE --- 
        if (pdfSettings.footerText) {
            const footerStr = pdfSettings.footerText
                .replace('{date}', generationDateFormatted)
                .replace('{pageNumber}', pageNumber.toString())
                .replace('{totalPages}', totalPages.toString());
            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(footerStr, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2), { align: 'center' });
        }

        return currentY; // Retourne la position de départ pour le contenu
    };

    const mealItemTemperatures = tempLogs?.mealItemTemperatures || {};
    const dailyLogData = tempLogs?.dailyLogData || {};
    const menuChangeComments = tempLogs?.menuChangeComments || {};

    weeklyGroupedMenus.forEach((week, weekIndex) => {
        if (week.menus.length === 0) return;

        if (weekIndex > 0) {
            doc.addPage();
        }

        const contentStartY = drawPageStructure(weekIndex + 1, weeklyGroupedMenus.length);
        let currentY = contentStartY;

        const headStyles: any = { 
            fontSize: pdfSettings.tableHeaderFontSize, 
            fontStyle: 'bold',
            valign: 'middle',
            halign: 'center',
            fillColor: hexToRgb(pdfSettings.primaryColor) ? [hexToRgb(pdfSettings.primaryColor)!.r, hexToRgb(pdfSettings.primaryColor)!.g, hexToRgb(pdfSettings.primaryColor)!.b] : [220, 220, 220],
            textColor: [255, 255, 255]
        };
        
        const weekTitle = `Semaine ${week.weekNumberInMonth}: ${format(week.startDate, "dd LLLL", { locale: fr })} - ${format(week.endDate, "dd LLLL yyyy", { locale: fr })}`;
        doc.setFontSize(pdfSettings.defaultFontSize + 2);
        doc.text(weekTitle, pdfSettings.marginLeft, currentY);
        currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 10;

        const head = [['Jour', 'Plat Concerné (Type: Nom)', 'Modifications', 'Temp. 1er Serv. (°C)', 'Temp. 2ème Serv. (°C)', 'Temp. 3ème Serv. (°C)', 'Personnel']];
        const body: any[][] = [];

        week.menus.forEach(menu => {
          const dailyInputs = dailyLogData[menu.date] || {};
          const presentMealParts = mealPartsOrder.filter(mpKey => mpKey !== 'theme' && menu[mpKey] && String(menu[mpKey]).trim() !== "");
          if (presentMealParts.length === 0) return;

          presentMealParts.forEach((mealPartKey, mealPartIndex) => {
            const itemTempKey = `${menu.date}_${mealPartKey}`;
            const itemTempInputs = mealItemTemperatures[itemTempKey] || {};
            const menuComment = menuChangeComments[itemTempKey] || {};
            const row: any[] = [];

            if (mealPartIndex === 0) {
              let dayDisplay = format(parseISO(menu.date), "E dd/MM", { locale: fr });
              if (menu.isHoliday && menu.holidayName) dayDisplay += `\n(${menu.holidayName})`;
              row.push({ content: dayDisplay, rowSpan: presentMealParts.length, styles: { valign: 'middle', halign: 'center' } });
            }
            
            row.push({ content: `${mealPartDisplayNames[mealPartKey]}: ${menu[mealPartKey] || '-'}`, styles: { valign: 'middle', cellWidth: 'wrap', fontSize: pdfSettings.tableBodyFontSize - 1 } });
            row.push({ content: menuComment.comment || '-', styles: { halign: 'center', valign: 'middle', cellWidth: 'auto', fontSize: pdfSettings.tableBodyFontSize - 1 } });
            row.push({ content: itemTempInputs.tempService1 || '-', styles: { halign: 'center', valign: 'middle' } });
            row.push({ content: itemTempInputs.tempService2 || '-', styles: { halign: 'center', valign: 'middle' } });
            row.push({ content: itemTempInputs.tempService3 || '-', styles: { halign: 'center', valign: 'middle' } });

            if (mealPartIndex === 0) {
              row.push({ content: dailyInputs.personnel || '-', rowSpan: presentMealParts.length, styles: { halign: 'center', valign: 'middle' } });
            }
            body.push(row);
          });
        });
        
        if (body.length > 0) {
            doc.autoTable({
                head: head,
                body: body,
                startY: currentY,
                theme: 'grid',
                headStyles: headStyles,
                styles: { fontSize: pdfSettings.tableBodyFontSize, cellPadding: 1.5, valign: 'middle', minCellHeight: 20 },
                columnStyles: {
                    0: { cellWidth: 45, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 70, halign: 'center' }, 3: { cellWidth: 40, halign: 'center' }, 4: { cellWidth: 40, halign: 'center' }, 5: { cellWidth: 40, halign: 'center' }, 6: { cellWidth: 45, halign: 'center' }, 
                },
                margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom + 20 },
            });
        } else {
            doc.setFontSize(pdfSettings.defaultFontSize);
            doc.text("Aucun relevé de température pour cette semaine.", pdfSettings.marginLeft, currentY, { textColor: 'rgb(100,100,100)' });
        }
    });
      
    return doc.output('blob');
};
