import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings } from '@/lib/pdf-settings';
import { DailyWaste, WasteData, EffectifData } from '../types';
import { getWeekId } from '@/lib/time-utils';

interface jsPDFWithAutoTable extends jsPDF {
    autoTable: (options: any) => jsPDF;
}

export const generateFoodWastePdf = async (
    dailyWastes: DailyWaste[],
    totalWaste: { [K in keyof WasteData]: number },
    totalEffectifs: { [K in keyof EffectifData]: number },
    avgWastePerPerson: { [K in keyof EffectifData]: number }
) => {
    try {
        const pdfSettings = await getPdfLayoutSettings('food_waste_weekly');
        const doc = new jsPDF({
            orientation: pdfSettings.orientation as any || 'landscape',
            unit: 'pt',
            format: pdfSettings.pageSize as any || 'a4'
        }) as jsPDFWithAutoTable;

        const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;
        let currentY = pdfSettings.marginTop;

        const weekId = getWeekId(new Date());
        const weekNumber = weekId.split('-W')[1];

        // --- Title ---
        doc.setFont(pdfSettings.fontFamily, 'bold');
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text("Fiche de Gaspillage Alimentaire", pageContentWidth / 2, currentY, { align: 'center' });
        currentY += pdfSettings.documentTitleFontSize;
        
        doc.setFont(pdfSettings.fontFamily, 'normal');
        doc.setFontSize(pdfSettings.defaultFontSize);
        const generationDateFormatted = format(new Date(), "dd MMMM yyyy", { locale: fr });
        doc.text(`Semaine pesé des dechets - Généré le ${generationDateFormatted}`, pageContentWidth / 2, currentY, { align: 'center' });
        currentY += pdfSettings.defaultFontSize * 2;

        // --- Daily Waste Tables ---
        dailyWastes.forEach((dailyWaste, index) => {
            if (currentY > doc.internal.pageSize.height - 250) { // Add new page if not enough space
                doc.addPage();
                currentY = pdfSettings.marginTop;
            }

            const tableBody = [];
            const clients: Array<keyof EffectifData> = ['marmouset', 'saj', 'ime', 'esat1', 'esat2', 'esat3'];

            clients.forEach(client => {
                const waste = dailyWaste.waste[client] || 0;
                const effectif = dailyWaste.effectifs[client] || 0;
                const avg = effectif > 0 ? (waste / effectif).toFixed(3).replace('.', ',') : '-';
                tableBody.push([
                    client.charAt(0).toUpperCase() + client.slice(1),
                    effectif ? effectif.toString() : '',
                    waste.toFixed(2).replace('.', ','),
                    avg
                ]);
            });

            // Add 'Autre' row
            const autreEffectif = dailyWaste.effectifs.autre;
            const autreWaste = dailyWaste.waste.autre || 0;
            const autreAvg = (autreEffectif && autreEffectif > 0) ? (autreWaste / autreEffectif).toFixed(3).replace('.', ',') : '-';
            tableBody.push([
                dailyWaste.autre_label || 'Autre',
                autreEffectif ? autreEffectif.toString() : '',
                autreWaste.toFixed(2).replace('.', ','),
                autreAvg
            ]);

            const autre2Effectif = dailyWaste.effectifs.autre2;
            const autre2Waste = dailyWaste.waste.autre2 || 0;
            const autre2Avg = (autre2Effectif && autre2Effectif > 0) ? (autre2Waste / autre2Effectif).toFixed(3).replace('.', ',') : '-';
            tableBody.push([
                dailyWaste.autre2_label || 'Autre 2',
                autre2Effectif ? autre2Effectif.toString() : '',
                autre2Waste.toFixed(2).replace('.', ','),
                autre2Avg
            ]);

            const dailyTotalWaste = Object.values(dailyWaste.waste).reduce((s, c) => s + (c || 0), 0);
            const dailyTotalEffectifs = Object.values(dailyWaste.effectifs).reduce((s, c) => s + (c || 0), 0);
            const dailyWasteForAvg = dailyTotalWaste - (dailyWaste.waste.autre || 0) - (dailyWaste.waste.autre2 || 0);
            const dailyAvg = dailyTotalEffectifs > 0 ? (dailyWasteForAvg / dailyTotalEffectifs) : 0;


            autoTable(doc, {
                head: [[`${dailyWaste.day} - ${dailyWaste.menu.replace(/\n/g, ' | ')}`]],
                body: [],
                startY: currentY,
                theme: 'plain',
                styles: { fontSize: 11, fontStyle: 'bold' }
            });
            currentY = (doc as any).lastAutoTable.finalY;

            autoTable(doc, {
                head: [['Client', 'Effectif', 'Gaspillage (KG)', 'Moy / Pers (KG)']],
                body: tableBody,
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: pdfSettings.primaryColor, textColor: '#FFFFFF', fontStyle: 'bold', halign: 'center' },
                foot: [[
                    'Total du jour',
                    dailyTotalEffectifs.toString(),
                    dailyTotalWaste.toFixed(2).replace('.', ',') + ' KG',
                    dailyAvg.toFixed(3).replace('.', ',') + ' KG'
                ]],
                footStyles: { fillColor: pdfSettings.primaryColor, textColor: '#FFFFFF', fontStyle: 'bold' },
                columnStyles: {
                    0: { halign: 'left' },
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right' },
                }
            });
            currentY = (doc as any).lastAutoTable.finalY + 20;
        });

        // --- Weekly Summary Table ---
        if (currentY > doc.internal.pageSize.height - 200) { // Add new page if not enough space
            doc.addPage();
            currentY = pdfSettings.marginTop;
        }

        doc.setFont(pdfSettings.fontFamily, 'bold');
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text("Bilan de la Semaine", pageContentWidth / 2, currentY, { align: 'center' });
        currentY += pdfSettings.documentTitleFontSize * 1.5;

        const summaryKeys: Array<keyof EffectifData> = ['marmouset', 'saj', 'ime', 'esat1', 'esat2', 'esat3', 'autre', 'autre2'];

        const summaryBody = summaryKeys.map(key => {
            const waste = totalWaste[key] || 0;
            const effectif = totalEffectifs[key];
            const avg = (effectif && effectif > 0) ? (waste / effectif).toFixed(3).replace('.', ',') + ' KG' : '-';
            let label = key.charAt(0).toUpperCase() + key.slice(1);
            if (key === 'autre') label = 'Autre';
            if (key === 'autre2') label = 'Autre 2';

            return [
                label,
                waste.toFixed(2).replace('.', ',') + ' KG',
                effectif ? effectif.toString() : '',
                avg
            ];
        });

        const grandTotalWaste = Object.values(totalWaste).reduce((s, c) => s + c, 0);
        const grandTotalEffectifs = Object.values(totalEffectifs).reduce((s, c) => s + c, 0);
        
        const grandTotalWasteForAvg = (Object.keys(totalWaste) as Array<keyof WasteData>).reduce((acc, key) => {
            const effectifKey = key as keyof EffectifData;
            if (totalEffectifs[effectifKey] && totalEffectifs[effectifKey]! > 0) {
                return acc + (totalWaste[key] || 0);
            }
            return acc;
        }, 0);
        
        const grandTotalAvg = grandTotalEffectifs > 0 ? grandTotalWasteForAvg / grandTotalEffectifs : 0;

        autoTable(doc, {
            head: [['Client', 'Gaspillage Total', 'Effectif Cumulé', 'Moy / Pers']],
            body: summaryBody,
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: pdfSettings.primaryColor, textColor: '#FFFFFF', fontStyle: 'bold', halign: 'center' },
            foot: [['Total Global', grandTotalWaste.toFixed(2).replace('.', ',') + ' KG', grandTotalEffectifs.toString(), grandTotalAvg.toFixed(3).replace('.', ',') + ' KG']],
            footStyles: { fillColor: pdfSettings.primaryColor, textColor: '#FFFFFF', fontStyle: 'bold' },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right' },
            }
        });

        doc.save(`gaspillage-alimentaire-${weekId}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
    }
};