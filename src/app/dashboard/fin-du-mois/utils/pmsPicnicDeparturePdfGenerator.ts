
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings } from '@/lib/pdf-settings';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import type { PicnicDepartureEntry } from '../../pms/types';
import JSZip from 'jszip';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const fetchPicnicDepartureEntriesForMonth = async (selectedDate: Date): Promise<PicnicDepartureEntry[]> => {
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
    
    try {
        const formsCollectionRef = collection(firestore, "pmsPicnicDepartureForms");
        const q = query(formsCollectionRef, 
            where("orderReceivedDate", ">=", Timestamp.fromDate(start)),
            where("orderReceivedDate", "<=", Timestamp.fromDate(end)),
            orderBy("orderReceivedDate", "desc")
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                entryCreationDate: (data.entryCreationDate as Timestamp).toDate().toISOString(),
                orderReceivedDate: (data.orderReceivedDate as Timestamp).toDate().toISOString(),
            } as PicnicDepartureEntry;
        });
    } catch (error) {
        console.error("Error loading picnic departure forms for month:", error);
        return [];
    }
};

const drawSingleFormPage = async (doc: jsPDFWithAutoTable, entry: PicnicDepartureEntry) => {
    const pdfSettings = await getPdfLayoutSettings('pms_picnic_departure_form');
    doc.setFont(pdfSettings.fontFamily || 'helvetica');
    const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

    // --- DESSIN MANUEL DE L'EN-TÊTE, TITRE ET PIED DE PAGE ---
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

    const moduleDefaultTitle = `Fiche d'Enlèvement Pique-Nique - ${entry.clientName}`;
    let finalTitle = pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle ? pdfSettings.documentBaseTitle.trim() : "";
    if (pdfSettings.showModuleTitle) finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
    if (finalTitle) {
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text(finalTitle, doc.internal.pageSize.width / 2, currentY + pdfSettings.documentTitleFontSize, { align: 'center' });
        currentY += pdfSettings.documentTitleFontSize + 15;
    } else {
        currentY += 10;
    }

    const drawFooter = () => {
        if (pdfSettings.footerText) {
            const footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', '1').replace('{totalPages}', '1');
            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(footerStr, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2), { align: 'center' });
        }
    };
    // --- FIN DU DESSIN MANUEL ---

    // --- Contenu de la fiche ---
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const paragraph1 = "Ce Repas a été préparé en respectant scrupuleusement les règles d'hygiène en vigueur. Les repas sont stockés en réfrigération positive à 3° en attente d'enlèvement.";
    const paragraph2 = "Afin de conserver cette commande, il est impératif de le garder stocké en glacière, avec pains de glace ou plaques eutectiques.";
    const paragraph3 = "L'établissement décline toute responsabilité après enlèvement de ce repas.";
    
    doc.text(doc.splitTextToSize(paragraph1, pageContentWidth), pdfSettings.marginLeft, currentY);
    currentY += doc.getTextDimensions(doc.splitTextToSize(paragraph1, pageContentWidth)).h + 10;
    doc.text(doc.splitTextToSize(paragraph2, pageContentWidth), pdfSettings.marginLeft, currentY);
    currentY += doc.getTextDimensions(doc.splitTextToSize(paragraph2, pageContentWidth)).h + 10;
    doc.text(doc.splitTextToSize(paragraph3, pageContentWidth), pdfSettings.marginLeft, currentY);
    currentY += doc.getTextDimensions(doc.splitTextToSize(paragraph3, pageContentWidth)).h + 25;

    const orderDateStr = isValid(parseISO(entry.orderReceivedDate)) ? format(parseISO(entry.orderReceivedDate), "dd/MM/yyyy", { locale: fr }) : "Date Invalide";
    
    let detailsY = currentY;
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("Commande reçue le:", pdfSettings.marginLeft, detailsY);
    doc.setFont(undefined, 'normal');
    doc.text(orderDateStr, pdfSettings.marginLeft + 140, detailsY);
    detailsY += 20;

    doc.setFont(undefined, 'bold');
    doc.text("À:", pdfSettings.marginLeft, detailsY);
    doc.setFont(undefined, 'normal');
    doc.text(`${(entry.orderReceivedTime || 'N/A').replace(':', 'H')}`, pdfSettings.marginLeft + 140, detailsY);
    
    currentY = detailsY + 30;

    const signatureTableBody = [
      [{ content: `Le cuisinier\nMr Dernoncourt Julien`, styles: { halign: 'center', valign: 'top', minCellHeight: 80 } },
       { content: `Le client\n${entry.clientName}`, styles: { halign: 'center', valign: 'top', minCellHeight: 80 } }]
    ];
    doc.autoTable({
      startY: currentY, body: signatureTableBody, theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5, font: pdfSettings.fontFamily || 'helvetica' },
      margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
    });
    currentY = (doc as any).lastAutoTable.finalY + 20;

    let finalDetailsY = currentY;
    doc.setFont(undefined, 'bold');
    doc.text("Nombre de Pique-Niques:", pdfSettings.marginLeft, finalDetailsY);
    doc.setFont(undefined, 'normal');
    doc.text(`${entry.numberOfPicnics} PN`, pdfSettings.marginLeft + 150, finalDetailsY);
    finalDetailsY += 20;
    doc.setFont(undefined, 'bold');
    doc.text("T° de Départ:", pdfSettings.marginLeft, finalDetailsY);
    doc.setFont(undefined, 'normal');
    doc.text(`${entry.departureTemperature}°C`, pdfSettings.marginLeft + 150, finalDetailsY);

    drawFooter();
};

export const generatePicnicDepartureArchive = async (selectedDate: Date): Promise<Blob> => {
    const entries = await fetchPicnicDepartureEntriesForMonth(selectedDate);
    const zip = new JSZip();
    const pdfSettings = await getPdfLayoutSettings('pms_picnic_departure_form');

    if (entries.length === 0) {
        // Générer une page PDF propre même s'il n'y a pas de données
        const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' }) as jsPDFWithAutoTable;
        const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
        let currentY = pdfSettings.marginTop;
        const monthYearTitle = format(selectedDate, 'MMMM yyyy', { locale: fr });
        doc.setFontSize(18);
        doc.text(`Suivi des Paniers-Repas (PN) - ${monthYearTitle}`, doc.internal.pageSize.width / 2, currentY, { align: 'center' });
        currentY += 60;
        doc.setFontSize(14);
        doc.setTextColor(150);
        doc.text("Aucune donnée enregistrée pour ce mois.", doc.internal.pageSize.width / 2, currentY, { align: 'center' });
        if (pdfSettings.footerText) {
            const footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', '1').replace('{totalPages}', '1');
            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(footerStr, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2), { align: 'center' });
        }
        zip.file("Aucune Donnée.pdf", doc.output('blob'));
    } else {
        for (const entry of entries) {
            const doc = new jsPDF({ 
                unit: 'pt', 
                format: pdfSettings.pageSize as any || 'a4',
                orientation: pdfSettings.orientation as any || 'portrait',
            }) as jsPDFWithAutoTable;
            
            await drawSingleFormPage(doc, entry);

            // Créer un nom de dossier propre pour le client
            const clientFolder = entry.clientName.replace(/[\/:*?"<>|\s\.]+/g, '_');
            
            const fileName = `Fiche_PN_${entry.clientName.replace(/\s+/g, '_')}_${format(parseISO(entry.orderReceivedDate), "yyyy-MM-dd")}.pdf`;
            
            // Ajouter le fichier au sous-dossier du client dans le ZIP
            zip.file(`${clientFolder}/${fileName}`, doc.output('blob'));
        }
    }

    return zip.generateAsync({ type: "blob" });
};
