
import React, { useMemo, useState } from 'react';
import type { DailyMenu } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Loader2, CalendarRange, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { groupMenusByWeek, type WeekData } from '../utils';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

interface WeeklyOrderSheetsProps {
  year: number;
  month: number; // 0-indexed
  menuData: DailyMenu[];
  isLoading: boolean;
}

const drawWeekSheetOnPdf = (doc: jsPDFWithAutoTable, week: WeekData, weekIndex: number, pdfSettings: any) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = pdfSettings.marginTop;
    doc.setFont(pdfSettings.fontFamily);

    // Section En-tête et Titre du Document
    if (pdfSettings.headerText) {
        const headerRows = pdfSettings.headerText.split('\n').map(rowText => rowText.split('|').map(cellText => cellText.trim()));
        const headerTableBody = headerRows.map(row => row.map(cell => cell === '{logo}' ? '' : cell));
        doc.autoTable({
            body: headerTableBody, startY: currentY, theme: 'plain',
            styles: { fontSize: pdfSettings.headerFontSize, cellPadding: 1, font: pdfSettings.fontFamily },
            columnStyles: { 0: { cellWidth: 'auto'} },
            margin: { top: pdfSettings.marginTop, left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
            didDrawCell: (data) => {
                if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image') && headerRows[data.row.index][data.column.index] === '{logo}') {
                    try {
                        const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                        const formatType = imgProps.fileType.toUpperCase();
                        const cellPadding = 2;
                        let imgWidth = data.cell.width - 2 * cellPadding;
                        let imgHeight = data.cell.height - 2 * cellPadding;
                        const imgAspectRatio = imgProps.width / imgProps.height;
                        if (imgAspectRatio > (data.cell.width / data.cell.height)) {
                            imgHeight = imgWidth / imgAspectRatio;
                        } else {
                            imgWidth = imgHeight * imgAspectRatio;
                        }
                        const imgX = data.cell.x + (data.cell.width - imgWidth) / 2;
                        const imgY = data.cell.y + (data.cell.height - imgHeight) / 2;
                        doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, imgHeight);
                    } catch (e) { console.error("Error drawing logo in PDF header table:", e); }
                }
            },
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    const moduleDefaultTitle = "Fiche de Commande Cuisine";
    let finalTitle = pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle ? pdfSettings.documentBaseTitle.trim() : "";
    if (pdfSettings.showModuleTitle) {
        finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
    }
    if (finalTitle) {
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text(finalTitle, pageWidth / 2, currentY + 5, { align: 'center' });
        currentY += (pdfSettings.documentTitleFontSize || 14) + 5;
    }

    doc.setFontSize(pdfSettings.defaultFontSize);
    doc.text(`Semaine du: ${format(week.startDate, "dd/MM/yyyy", { locale: fr })}  Au: ${format(week.endDate, "dd/MM/yyyy", { locale: fr })}`, pdfSettings.marginLeft, currentY + 10);
    currentY += (pdfSettings.defaultFontSize * 1.2) + 10;

    // Tableaux des Menus et Catégories
    const weeklyMenuHeader = [['Date', 'Jour', 'Entrée', 'Plat', 'Féculent', 'Légume', 'Sauce', 'Dessert']];
    const weeklyMenuBody = week.menus.map(menu => [
        format(parseISO(menu.date), 'dd/MM', { locale: fr }), menu.dayName,
        menu.entree || '-', menu.plat || '-', menu.feculent || '-',
        menu.legume || '-', menu.sauce || '-', menu.dessert || '-',
    ]);

    doc.autoTable({
        startY: currentY, head: weeklyMenuHeader, body: weeklyMenuBody, theme: 'grid',
        headStyles: { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, halign: 'center', fillColor: hexToRgb(pdfSettings.tableHeaderColor), textColor: hexToRgb(pdfSettings.tableHeaderTextColor) },
        styles: { fontSize: pdfSettings.tableBodyFontSize, cellPadding: 2, valign: 'middle', font: pdfSettings.fontFamily, lineWidth: 0.1, lineColor: [0, 0, 0], minCellHeight: 20, textColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 40 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 'auto' }, 4: { cellWidth: 'auto' }, 5: { cellWidth: 'auto' }, 6: { cellWidth: 'auto' }, 7: { cellWidth: 'auto' } },
        margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
        didDrawPage: (data) => {
            const pageCount = doc.internal.getNumberOfPages();
            if (pdfSettings.footerText) {
                let footerStr = pdfSettings.footerText
                    .replace('{date}', format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr }))
                    .replace('{pageNumber}', String(data.pageNumber))
                    .replace('{totalPages}', String(pageCount));
                doc.setFontSize(pdfSettings.footerFontSize);
                doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.getHeight() - (pdfSettings.marginBottom / 2));
            }
        }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;

    const categoriesHeader = [['Fruits et Légumes', 'QTD', 'Frais', 'QTD', 'Surgeler', 'QTD', 'Viande', 'QTD', 'Sec', 'QTD', 'Autres', 'QTD']];
    const categoriesBody = Array(26).fill(Array(12).fill(' '));
    doc.autoTable({
        startY: currentY, head: categoriesHeader, body: categoriesBody, theme: 'grid',
        headStyles: { fontStyle: 'bold', fontSize: 10, halign: 'center', fillColor: [109, 7, 26] },
        columnStyles: {
            0: { fillColor: [200, 230, 201], cellWidth: 150 }, 1: { fillColor: [200, 230, 201], cellWidth: 50 },
            2: { fillColor: [173, 216, 230], cellWidth: 150 }, 3: { fillColor: [173, 216, 230], cellWidth: 50 },
            4: { fillColor: [173, 216, 230], cellWidth: 150 }, 5: { fillColor: [173, 216, 230], cellWidth: 50 },
            6: { fillColor: [255, 192, 203], cellWidth: 150 }, 7: { fillColor: [255, 192, 203], cellWidth: 50 },
            8: { fillColor: [220, 220, 220], cellWidth: 150 }, 9: { fillColor: [220, 220, 220], cellWidth: 50 },
            10: { fillColor: [220, 220, 220], cellWidth: 100 }, 11: { fillColor: [220, 220, 220], cellWidth: 50 },
        },
        styles: { cellPadding: 2, minCellHeight: 20, fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily, lineWidth: 0.1, lineColor: [0, 0, 0] },
        tableWidth: 'auto',
        margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
    });
};

export default function WeeklyOrderSheets({ year, month, menuData, isLoading }: WeeklyOrderSheetsProps) {
    const { toast } = useToast();
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<number | null>(null);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);

    const weeklyGroupedMenus = useMemo(() => {
        return groupMenusByWeek(year, month, menuData);
    }, [year, month, menuData]);

    const generatePdfForWeek = (week: WeekData, weekIndex: number) => {
        setIsGeneratingPdf(weekIndex);
        try {
            const pdfSettings = getPdfLayoutSettings('weekly_order_sheet');
            const doc = new jsPDF({
                orientation: pdfSettings.orientation,
                unit: 'pt',
                format: pdfSettings.pageSize
            }) as jsPDFWithAutoTable;
            
            drawWeekSheetOnPdf(doc, week, weekIndex, pdfSettings);

            doc.save(`Fiche_Commande_Semaine_${week.weekNumberInMonth}.pdf`);
            toast({ title: "PDF Fiche de Commande Généré", description: `La fiche pour la Semaine ${week.weekNumberInMonth} a été téléchargée.` });
        } catch (e: any) {
            console.error('Error during single PDF generation:', e);
            toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
        } finally {
            setIsGeneratingPdf(null);
        }
    };
    
    const generateAllPdfsForMonth = () => {
        if (weeklyGroupedMenus.length === 0) {
            toast({ title: "Aucune donnée", description: "Il n'y a aucune semaine avec des menus à imprimer.", variant: "default" });
            return;
        }
        setIsGeneratingAll(true);
        try {
            const pdfSettings = getPdfLayoutSettings('weekly_order_sheet');
            const doc = new jsPDF({
                orientation: pdfSettings.orientation,
                unit: 'pt',
                format: pdfSettings.pageSize
            }) as jsPDFWithAutoTable;

            weeklyGroupedMenus.forEach((week, index) => {
                if (index > 0) {
                    doc.addPage();
                }
                drawWeekSheetOnPdf(doc, week, index, pdfSettings);
            });

            const monthName = format(new Date(year, month), "MMMM_yyyy", { locale: fr });
            doc.save(`Fiches_Commandes_${monthName}.pdf`);
            toast({ title: "PDFs Mensuels Générés", description: `Toutes les fiches pour ${format(new Date(year, month), "MMMM yyyy", { locale: fr })} ont été téléchargées.` });
        } catch (e: any) {
            console.error('Error during monthly PDF generation:', e);
            toast({ title: "Erreur PDF", description: "La génération du PDF mensuel a échoué.", variant: "destructive" });
        } finally {
            setIsGeneratingAll(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Chargement des données...</span>
            </div>
        );
    }

    if (weeklyGroupedMenus.length === 0 && !isLoading) {
        return (
            <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                <CalendarRange className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                    Aucune semaine à afficher pour {format(new Date(year, month), "MMMM yyyy", { locale: fr })}.
                </p>
                <p className="text-xs text-muted-foreground/70">
                    Vérifiez que des menus sont planifiés pour ce mois dans l'onglet "Planification Mensuelle".
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="mb-4 flex justify-end">
                <Button
                    onClick={generateAllPdfsForMonth}
                    disabled={isGeneratingAll || isLoading || weeklyGroupedMenus.length === 0}
                    size="sm"
                >
                    {isGeneratingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Générer Fiches du Mois
                </Button>
            </div>
            <div className="space-y-6">
                {weeklyGroupedMenus.map((week, index) => (
                    <Card key={week.weekNumberInMonth || index} className="shadow-md">
                        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <CardTitle>
                                Semaine {week.weekNumberInMonth}: {format(week.startDate, "dd LLLL", { locale: fr })} - {format(week.endDate, "dd LLLL yyyy", { locale: fr })}
                            </CardTitle>
                            <Button
                                onClick={() => generatePdfForWeek(week, index)}
                                disabled={isGeneratingPdf === index || isGeneratingAll}
                                size="sm"
                            >
                                {isGeneratingPdf === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                PDF Commande Semaine
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {week.menus && week.menus.length > 0 ? (
                                <Table>
                                    <TableHeader className="sticky top-0 bg-muted/20">
                                        <TableRow>
                                            <TableHead className="w-[80px]">Date</TableHead>
                                            <TableHead className="w-[100px]">Jour</TableHead>
                                            <TableHead>Entrée</TableHead>
                                            <TableHead>Plat</TableHead>
                                            <TableHead>Féculent</TableHead>
                                            <TableHead>Légume</TableHead>
                                            <TableHead>Sauce</TableHead>
                                            <TableHead>Dessert</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {week.menus.map((menu, menuIndex) => (
                                            <TableRow key={menuIndex}>
                                                <TableCell>{format(parseISO(menu.date), "dd/MM", { locale: fr })}</TableCell>
                                                <TableCell>{menu.dayName}</TableCell>
                                                <TableCell className="truncate max-w-[150px] text-xs" title={menu.entree}>{menu.entree || "-"}</TableCell>
                                                <TableCell className="truncate max-w-[150px] text-xs" title={menu.plat}>{menu.plat || "-"}</TableCell>
                                                <TableCell className="truncate max-w-[150px] text-xs" title={menu.feculent}>{menu.feculent || "-"}</TableCell>
                                                <TableCell className="truncate max-w-[150px] text-xs" title={menu.legume}>{menu.legume || "-"}</TableCell>
                                                <TableCell className="truncate max-w-[150px] text-xs" title={menu.sauce}>{menu.sauce || "-"}</TableCell>
                                                <TableCell className="truncate max-w-[150px] text-xs" title={menu.dessert}>{menu.dessert || "-"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="text-center py-6 text-muted-foreground flex items-center justify-center gap-2">
                                    <AlertCircle className="w-5 h-5" /> Aucun menu planifié pour cette semaine. La fiche de commande sera vierge.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </>
    );
}
