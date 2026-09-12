
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';
import type { TempChangeEntry } from '../types';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const fetchTempChangeEntriesForMonth = async (selectedDate: Date): Promise<TempChangeEntry[]> => {
    try {
        const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
        const entriesCollectionRef = collection(firestore, 'pmsTempChangeLog');
        const q = query(entriesCollectionRef, where("coolingDate", ">=", Timestamp.fromDate(startOfMonth)), where("coolingDate", "<=", Timestamp.fromDate(endOfMonth)), orderBy("coolingDate", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return { id: docSnap.id, ...data, coolingDate: (data.coolingDate as Timestamp).toDate().toISOString(), reheatingDate: data.reheatingDate ? (data.reheatingDate as Timestamp).toDate().toISOString() : null } as TempChangeEntry;
        });
    } catch (error) {
        console.error("Error loading temp change entries for PDF generation:", error);
        return [];
    }
};

export const generateTempChangeMonitoringPdfForMonth = async (selectedDate: Date): Promise<Blob | null> => {
    const entries = await fetchTempChangeEntriesForMonth(selectedDate);

    try {
        const pdfSettings = await getPdfLayoutSettings('pms_temp_change_monitoring');
        const doc = new jsPDF({ orientation: pdfSettings.orientation as any || 'landscape', unit: 'pt', format: pdfSettings.pageSize as any || 'a4' }) as jsPDFWithAutoTable;
        
        const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

        let currentY = pdfSettings.marginTop;
        const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;
        
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
                        maxHeightInRow = Math.max(maxHeightInRow, 30);
                    } else {
                        const textLines = doc.splitTextToSize(cellText, cellWidth - 6);
                        maxHeightInRow = Math.max(maxHeightInRow, (textLines.length * pdfSettings.headerFontSize * 0.7) + 6);
                    }
                });

                let currentX = pdfSettings.marginLeft;
                for (const cell of cells) {
                    const cellText = cell.trim();
                    doc.rect(currentX, currentY, cellWidth, maxHeightInRow, 'S');
                    if (cellText === '{logo}' && pdfSettings.logoUrl) {
                        try {
                            const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                            const formatType = imgProps.fileType.toUpperCase();
                            const desiredImgHeight = Math.min(maxHeightInRow - 6, 40);
                            const imgWidth = (imgProps.width * desiredImgHeight) / imgProps.height;
                            const imgX = currentX + (cellWidth - imgWidth) / 2;
                            const imgY = currentY + (maxHeightInRow - desiredImgHeight) / 2;
                            doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, desiredImgHeight);
                        } catch (e) { console.error("Erreur d'ajout du logo.", e); }
                    } else if (cellText !== '{logo}') {
                        doc.text(cellText, currentX + (cellWidth / 2), currentY + (maxHeightInRow / 2), { align: 'center', baseline: 'middle', maxWidth: cellWidth - 6 });
                    }
                    currentX += cellWidth;  
                }
                currentY += maxHeightInRow;
            }
            currentY += 10;
        }

        const monthYearTitle = format(selectedDate, 'MMMM yyyy', { locale: fr });
        const moduleDefaultTitle = `Suivi Baisse / Remise en Température - ${monthYearTitle}`;
        let finalTitle = "";
        if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle) {
            finalTitle = pdfSettings.documentBaseTitle.trim();
        }
        if (pdfSettings.showModuleTitle) {
            finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
        }
        if (finalTitle) {
            doc.setFontSize(pdfSettings.documentTitleFontSize);
            doc.text(finalTitle, doc.internal.pageSize.width / 2, currentY, { align: 'center' });
            currentY += pdfSettings.documentTitleFontSize + 5;
        }

        const baseHeadStyles = { fontSize: 7, fontStyle: 'bold', halign: 'center', valign: 'middle', cellPadding: 1, textColor: [0, 0, 0] };
        
        const mainHeadStyles = { ...baseHeadStyles };
        if (pdfSettings.primaryColor) {
            const rgb = hexToRgb(pdfSettings.primaryColor);
            if (rgb) {
                mainHeadStyles.fillColor = [rgb.r, rgb.g, rgb.b];
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                mainHeadStyles.textColor = brightness > 125 ? [0, 0, 0] : [255, 255, 255];
            }
        }
        
        const orangeHeadStyle = { ...baseHeadStyles, fillColor: '#fed7aa' };
        const blueHeadStyle = { ...baseHeadStyles, fillColor: '#bfdbfe' };
        
        const orangeBodyStyle = { fillColor: '#fed7aa' };
        const blueBodyStyle = { fillColor: '#bfdbfe' };

        const head: any[] = [
            [
                { content: 'Date', rowSpan: 2, styles: mainHeadStyles }, { content: 'Produit', rowSpan: 2, styles: mainHeadStyles }, { content: 'Qté', rowSpan: 2, styles: mainHeadStyles }, { content: 'T° Départ', rowSpan: 2, styles: mainHeadStyles },
                { content: 'REFROIDISSEMENT RAPIDE', colSpan: 4, styles: mainHeadStyles },
                { content: 'REMISE EN TEMPERATURE', colSpan: 6, styles: mainHeadStyles },
            ],
            [
                { content: 'P. chauds\nHeure', styles: orangeHeadStyle },
                { content: 'P. froids\nHeure', styles: blueHeadStyle }, { content: 'P. froids\nT°', styles: blueHeadStyle },
                { content: 'Visa', styles: mainHeadStyles }, { content: 'Date', styles: mainHeadStyles },
                { content: 'P. froids\nHeure', styles: blueHeadStyle }, { content: 'P. froids\nT°', styles: blueHeadStyle },
                { content: 'P. chauds\nHeure', styles: orangeHeadStyle }, { content: 'P. chauds\nT°', styles: orangeHeadStyle },
                { content: 'Visa', styles: mainHeadStyles },
            ]
        ];

        const body = entries.map(entry => {
            const reheatingPart = entry.servedCold
                ? [{ content: 'Servi Froid', colSpan: 6, styles: { halign: 'center', fontStyle: 'bold' } }]
                : [
                    entry.reheatingDate ? format(parseISO(entry.reheatingDate), "dd/MM/yy", { locale: fr }) : '-',
                    { content: entry.reheatingColdProductTime || '-', styles: blueBodyStyle },
                    { content: entry.reheatingColdProductTemp || '-', styles: blueBodyStyle },
                    { content: entry.reheatingHotProductTime || '-', styles: orangeBodyStyle },
                    { content: entry.reheatingHotProductTemp || '-', styles: orangeBodyStyle },
                    entry.reheatingVisa || '-',
                ];

            return [
                format(parseISO(entry.coolingDate), "dd/MM/yy", { locale: fr }),
                entry.productName + (entry.cooledWithWater ? ' (eau)' : ''),
                entry.quantity,
                entry.coolingStartProductTemp ? `${entry.coolingStartProductTemp}°C` : '-',
                { content: entry.coolingHotProductTime || '-', styles: orangeBodyStyle },
                { content: entry.coolingColdProductTime || '-', styles: blueBodyStyle },
                { content: entry.coolingColdProductTemp || '-', styles: blueBodyStyle },
                entry.coolingVisa || '-',
                ...reheatingPart,
            ];
        });

        doc.autoTable({
            head: head, body: body, startY: currentY, theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1, valign: 'middle', halign: 'center', textColor: [0,0,0] },
            columnStyles: { 1: { halign: 'left' } },
            margin: { top: pdfSettings.marginTop, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
            didDrawPage: (data) => {
                const pageCount = doc.internal.getNumberOfPages();
                if (pdfSettings.footerText) {
                    let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
                    doc.setFontSize(pdfSettings.footerFontSize);
                    doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
                }
            },
        });
        
        return doc.output('blob');

    } catch (error) {
        console.error("Error generating PDF:", error);
        return null;
    }
};

export const generateTempChangeMonitoringPdf = async (selectedDate: Date): Promise<Blob | null> => {
    return await generateTempChangeMonitoringPdfForMonth(selectedDate);
}
