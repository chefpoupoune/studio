'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { DailyMenu } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Loader2, CalendarRange, AlertCircle, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { groupMenusByWeek, type WeekData } from '../utils';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { PdfLayoutSettings } from '@/app/dashboard/settings/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { Recipe, Ingredient, IngredientCategory, ingredientCategories } from './recipe-management';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

interface WeeklyOrderSheetsProps {
  year: number;
  month: number; // 0-indexed
  menuData: DailyMenu[];
  isLoading: boolean;
  monthlyNumberOfGuests: number;
  isPicnicMonth: boolean;
}

interface ConsolidatedIngredient {
  name: string;
  totalQuantity: number;
  unit: string;
  category: IngredientCategory;
}

type CategorizedIngredients = Record<IngredientCategory, ConsolidatedIngredient[]>;

const ingredientCategoryOrder: IngredientCategory[] = ['Fruits et Légumes', 'Frais', 'Surgelé', 'Viande', 'Sec', 'Autres'];

const transformIngredientsForTableView = (ingredients: ConsolidatedIngredient[], picnicIngredients: ConsolidatedIngredient[] = []) => {
    const categorized = ingredients.reduce((acc, ing) => {
        const category = ing.category || 'Autres';
        if (!acc[category]) acc[category] = [];
        acc[category].push(ing);
        return acc;
    }, {} as CategorizedIngredients);

    const categorizedPicnic = picnicIngredients.reduce((acc, ing) => {
        const category = ing.category || 'Autres';
        if (!acc[category]) acc[category] = [];
        acc[category].push(ing);
        return acc;
    }, {} as CategorizedIngredients);

    let maxLength = Math.max(...ingredientCategoryOrder.map(cat => categorized[cat]?.length || 0));
    if (picnicIngredients.length > 0) {
        maxLength = Math.max(maxLength, 30);
    } else {
        maxLength = Math.max(maxLength, 20);
    }

    const tableRows = [];
    for (let i = 0; i < maxLength; i++) {
        const row: Record<string, string> = {};
        ingredientCategoryOrder.forEach(category => {
            const ingredient = categorized[category]?.[i];
            row[`${category}_name`] = ingredient ? ingredient.name : '';
            row[`${category}_qtd`] = ingredient ? `${ingredient.totalQuantity.toFixed(2)} ${ingredient.unit}` : '';
        });
        tableRows.push(row);
    }
    
    if (picnicIngredients.length > 0) {
        for (let i = 0; i < 10; i++) {
            const picnicRowIndex = 20 + i;
            const row = tableRows[picnicRowIndex];
            ingredientCategoryOrder.forEach(category => {
                const picnicIngredient = categorizedPicnic[category]?.[i];
                if (picnicIngredient) {
                    row[`${category}_name`] = picnicIngredient.name;
                    row[`${category}_qtd`] = `${picnicIngredient.totalQuantity.toFixed(2)} ${picnicIngredient.unit}`;
                } else if (row[`${category}_name`] === '') {
                    row[`${category}_name`] = ''
                    row[`${category}_qtd`] = ''
                }
            });
        }
    }

    return tableRows;
};

const drawWeekSheetOnPdf = (
    doc: jsPDFWithAutoTable, 
    week: WeekData, 
    ingredients: ConsolidatedIngredient[], 
    picnicIngredients: ConsolidatedIngredient[],
    pdfSettings: PdfLayoutSettings, 
    allRecipeNames: Set<string>
) => {

            //config tableau 1//

    const menuTableLayout = {
        rowHeight: 15,
        columnWidths: [55, 65, 150, 200, 130, 200, 110, 150, 150],
        bodyTextColor: [0, 0, 0]
    };
            //config tabeleau 2//

    const ingredientsTableLayout = {
        rowHeight: 20,
        bodyTextColor: [0, 0, 0]
    };

    const drawFooter = (data: any) => {
        const pageCount = doc.internal.getNumberOfPages();
        if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText
                .replace('{date}', format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr }))
                .replace('{pageNumber}', String(data.pageNumber))
                .replace('{totalPages}', String(pageCount));
            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.getHeight() - (pdfSettings.marginBottom / 2));
        }
    };

    let currentY = pdfSettings.marginTop;
    doc.setFont(pdfSettings.fontFamily);
    doc.setFontSize(pdfSettings.defaultFontSize);
    doc.text(`Semaine du: ${format(week.startDate, "dd/MM/yyyy", { locale: fr })}  Au: ${format(week.endDate, "dd/MM/yyyy", { locale: fr })}`, pdfSettings.marginLeft, currentY);
    currentY += (pdfSettings.defaultFontSize * 1.2) + 5;

    const primaryHeadStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, halign: 'center', valign: 'middle' };
    if (pdfSettings.primaryColor) {
        const primaryRgb = hexToRgb(pdfSettings.primaryColor);
        if(primaryRgb) {
            primaryHeadStyles.fillColor = [primaryRgb.r, primaryRgb.g, primaryRgb.b];
            const brightness = (primaryRgb.r * 299 + primaryRgb.g * 587 + primaryRgb.b * 114) / 1000;
            primaryHeadStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
    }

    const weeklyMenuBody = week.menus.map(menu => [
        format(parseISO(menu.date), 'dd/MM', { locale: fr }), menu.dayName, menu.entree || '-', menu.plat || '-', 
        menu.feculent || '-', menu.legume || '-', menu.sauce || '-', menu.fromage || '-', menu.dessert || '-',
    ]);

    const menuColumnIndexes = [2, 3, 4, 5, 6, 7, 8];

    doc.autoTable({
        startY: currentY, 
        head: [['Date', 'Jour', 'Entrée', 'Plat', 'Féculent', 'Légume', 'Sauce', 'Fromage', 'Dessert']],
        body: weeklyMenuBody, 
        theme: 'grid', 
        headStyles: primaryHeadStyles,
        styles: { 
            fontSize: pdfSettings.tableBodyFontSize, 
            cellPadding: 2, 
            valign: 'middle', 
            font: pdfSettings.fontFamily, 
            lineWidth: 0.1, 
            lineColor: [0, 0, 0], 
            textColor: menuTableLayout.bodyTextColor,
            minCellHeight: menuTableLayout.rowHeight 
        },
        columnStyles: menuTableLayout.columnWidths.reduce((acc, width, index) => {
            acc[index] = { cellWidth: width };
            return acc;
        }, {} as {[key: number]: {cellWidth: number | 'auto'}}),
        didParseCell: (data) => {
            const cellText = data.cell.text?.[0];
            if (data.row.section === 'body' && typeof cellText === 'string' && cellText.trim() !== '-' && menuColumnIndexes.includes(data.column.index)) {
                if (allRecipeNames.has(cellText.toLowerCase())) {
                    data.cell.styles.fillColor = '#FFFF99';
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        },
        margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom + 10 },
        didDrawPage: drawFooter,
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;

    if (ingredients.length > 0) {
        doc.setFontSize(pdfSettings.documentTitleFontSize - 2); 
        doc.text("Liste de Courses Consolidée", pdfSettings.marginLeft, currentY);
        currentY += (pdfSettings.documentTitleFontSize - 2) + 5;

        const tableData = transformIngredientsForTableView(ingredients, picnicIngredients);
        const headers = ingredientCategoryOrder.flatMap(cat => [cat, 'QTD']);
        const body = tableData.map(row => ingredientCategoryOrder.flatMap(cat => [row[`${cat}_name`], row[`${cat}_qtd`]]));

        const categoryColors: { [key in IngredientCategory]?: [number, number, number] } = {
            'Fruits et Légumes': [217, 234, 211], 'Frais': [208, 224, 227],
            'Surgelé': [201, 218, 248], 'Viande': [244, 204, 204],
            'Sec': [230, 230, 230], 'Autres': [255, 242, 204]
        };
        
        const ingredientsHeadStyles = { ...primaryHeadStyles, fontSize: 8 };

        doc.autoTable({
            startY: currentY,
            head: [headers],
            body: body,
            theme: 'grid',
            headStyles: ingredientsHeadStyles,
            styles: {
                fontSize: 7,
                cellPadding: 2,
                valign: 'middle',
                font: pdfSettings.fontFamily,
                lineWidth: 0.1,
                lineColor: [0, 0, 0],
                textColor: ingredientsTableLayout.bodyTextColor,
                minCellHeight: ingredientsTableLayout.rowHeight
            },
            columnStyles: {
                0: { cellWidth: 150 }, 1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 150 }, 3: { cellWidth: 40, halign: 'center' },
                4: { cellWidth: 150 }, 5: { cellWidth: 40, halign: 'center' },
                6: { cellWidth: 150 }, 7: { cellWidth: 40, halign: 'center' },
                8: { cellWidth: 150 }, 9: { cellWidth: 40, halign: 'center' },
                10: { cellWidth: 150 }, 11: { cellWidth: 40, halign: 'center' },
            },
            didParseCell: (data) => {
                if (data.row.section === 'body') {
                    const categoryName = ingredientCategoryOrder[Math.floor(data.column.index / 2)];
                    const categoryColor = categoryColors[categoryName];
                    if (categoryColor) {
                        data.cell.styles.fillColor = categoryColor;
                    }
                     if (picnicIngredients.length > 0 && data.row.index >= 20) {
                        data.cell.styles.lineColor = [255, 0, 0]; // Rouge
                        data.cell.styles.lineWidth = 0.5;
                    }
                }
            },
            margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom + 10 },
            didDrawPage: drawFooter,
        });
    }
};

export default function WeeklyOrderSheets({ year, month, menuData, isLoading, monthlyNumberOfGuests, isPicnicMonth }: WeeklyOrderSheetsProps) {
    const { toast } = useToast();
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<number | null>(null);
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [consolidatedIngredients, setConsolidatedIngredients] = useState<Map<number, ConsolidatedIngredient[]>>(new Map());
    const [picnicIngredients, setPicnicIngredients] = useState<ConsolidatedIngredient[]>([]);
    const [allRecipeNames, setAllRecipeNames] = useState<Set<string>>(new Set());
    const [isCalculating, setIsCalculating] = useState(false);

    const weeklyGroupedMenus = useMemo(() => {
        return groupMenusByWeek(year, month, menuData);
    }, [year, month, menuData]);

    useEffect(() => {
        const calculateIngredients = async () => {
            if (weeklyGroupedMenus.length === 0) {
                setConsolidatedIngredients(new Map());
                setAllRecipeNames(new Set());
                return;
            }
            if (monthlyNumberOfGuests <= 0) {
                 setConsolidatedIngredients(new Map());
                 return;
            }

            setIsCalculating(true);
            try {
                const recipesSnapshot = await getDocs(collection(firestore, 'recipes'));
                const allRecipes = recipesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
                setAllRecipeNames(new Set(allRecipes.map(r => r.name.toLowerCase())));
                const recipeMap = new Map(allRecipes.map(recipe => [recipe.name.toLowerCase(), recipe]));
                const newConsolidatedMap = new Map<number, ConsolidatedIngredient[]>();

                if (isPicnicMonth) {
                    const picnicRecipeQuery = query(collection(firestore, 'recipes'), where("name", "==", "PN"));
                    const picnicRecipeSnapshot = await getDocs(picnicRecipeQuery);
                    if (!picnicRecipeSnapshot.empty) {
                        const picnicRecipeDoc = picnicRecipeSnapshot.docs[0];
                        const picnicRecipe = { id: picnicRecipeDoc.id, ...picnicRecipeDoc.data() } as Recipe;
                        if (picnicRecipe.ingredients && picnicRecipe.numberOfGuests > 0) {
                            const factor = monthlyNumberOfGuests / picnicRecipe.numberOfGuests;
                            const calculatedPicnicIngredients = picnicRecipe.ingredients.map(ing => ({
                                name: ing.name,
                                totalQuantity: (ing.quantity || 0) * factor,
                                unit: ing.unit,
                                category: ing.category || 'Autres'
                            }));
                            setPicnicIngredients(calculatedPicnicIngredients);
                        }
                    }
                } else {
                    setPicnicIngredients([]);
                }

                for (const [weekIndex, week] of weeklyGroupedMenus.entries()) {
                    const weeklyIngredients: Record<string, ConsolidatedIngredient> = {};
                    for (const menu of week.menus) {
                        const mealFields: (keyof DailyMenu)[] = ['entree', 'plat', 'feculent', 'legume', 'sauce', 'fromage', 'dessert'];
                        for (const field of mealFields) {
                            const recipeName = menu[field];
                            if (typeof recipeName === 'string' && recipeName) {
                                const recipe = recipeMap.get(recipeName.toLowerCase());
                                if (recipe && recipe.numberOfGuests > 0) {
                                    const factor = monthlyNumberOfGuests / recipe.numberOfGuests;
                                    for (const ingredient of recipe.ingredients) {
                                        if (!ingredient.name) continue;
                                        const key = `${ingredient.name.toLowerCase()}_${ingredient.unit.toLowerCase()}`;
                                        if (!weeklyIngredients[key]) {
                                            weeklyIngredients[key] = { 
                                                name: ingredient.name, 
                                                totalQuantity: 0, 
                                                unit: ingredient.unit, 
                                                category: ingredient.category || 'Autres' 
                                            };
                                        }
                                        weeklyIngredients[key].totalQuantity += (ingredient.quantity || 0) * factor;
                                    }
                                }
                            }
                        }
                    }
                    const sortedIngredients = Object.values(weeklyIngredients).sort((a, b) => a.name.localeCompare(b.name));
                    newConsolidatedMap.set(weekIndex, sortedIngredients);
                }
                setConsolidatedIngredients(newConsolidatedMap);
            } catch (error) {
                console.error("Error calculating ingredients:", error);
                toast({ title: "Erreur de Calcul", description: "Impossible de calculer la liste des ingrédients.", variant: "destructive" });
            } finally {
                setIsCalculating(false);
            }
        };
        calculateIngredients();
    }, [weeklyGroupedMenus, monthlyNumberOfGuests, isPicnicMonth, toast]);

    const generatePdfForWeek = async (week: WeekData, weekIndex: number) => {
        setIsGeneratingPdf(weekIndex);
        try {
            const pdfSettings = await getPdfLayoutSettings('weekly_order_sheet');
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'pt',
                format: pdfSettings.pageSize as any
            }) as jsPDFWithAutoTable;
            
            const ingredientsForWeek = consolidatedIngredients.get(weekIndex) || [];
            drawWeekSheetOnPdf(doc, week, ingredientsForWeek, picnicIngredients, pdfSettings, allRecipeNames);

            doc.save(`Fiche_Commande_Semaine_${week.weekNumberInMonth}.pdf`);
            toast({ title: "PDF Fiche de Commande Généré", description: `La fiche pour la Semaine ${week.weekNumberInMonth} a été téléchargée.` });
        } catch (e: any) {
            console.error('Error during single PDF generation:', e);
            toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${e.message || 'Erreur inconnue'}.`, variant: "destructive" });
        } finally {
            setIsGeneratingPdf(null);
        }
    };
    
    const generateAllPdfsForMonth = async () => {
        if (weeklyGroupedMenus.length === 0) return;
        setIsGeneratingAll(true);
        try {
            const pdfSettings = await getPdfLayoutSettings('weekly_order_sheet');
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'pt',
                format: pdfSettings.pageSize as any
            }) as jsPDFWithAutoTable;

            weeklyGroupedMenus.forEach((week, index) => {
                if (index > 0) doc.addPage(pdfSettings.pageSize as any, 'landscape');
                const ingredientsForWeek = consolidatedIngredients.get(index) || [];
                drawWeekSheetOnPdf(doc, week, ingredientsForWeek, picnicIngredients, pdfSettings, allRecipeNames);
            });

            const monthName = format(new Date(year, month), "MMMM_yyyy", { locale: fr });
            doc.save(`Fiches_Commandes_${monthName}.pdf`);
            toast({ title: "PDFs Mensuels Générés", description: `Toutes les fiches pour ${format(new Date(year, month), "MMMM yyyy", { locale: fr })} ont été téléchargées.` });
        } catch (e: any) {
            console.error('Error during monthly PDF generation:', e);
            toast({ title: "Erreur PDF", description: `La génération du PDF mensuel a échoué: ${e.message || 'Erreur inconnue'}.`, variant: "destructive" });
        } finally {
            setIsGeneratingAll(false);
        }
    };

    if (isLoading) return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="ml-2 text-muted-foreground">Chargement...</span></div>;
    if (weeklyGroupedMenus.length === 0 && !isLoading) return <div className="text-center py-10"><CalendarRange className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">Aucune semaine à afficher.</p></div>;


    return (
        <>
            <div className="mb-4 flex justify-end">
                <Button onClick={generateAllPdfsForMonth} disabled={isGeneratingAll || isLoading || weeklyGroupedMenus.length === 0} size="sm">
                    {isGeneratingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />} Générer Fiches du Mois
                </Button>
            </div>
            <div className="space-y-8">
                {weeklyGroupedMenus.map((week, index) => {
                    const ingredientsForWeek = consolidatedIngredients.get(index) || [];
                    const tableData = transformIngredientsForTableView(ingredientsForWeek, isPicnicMonth ? picnicIngredients : []);
                    const categoryHeaderStyles: Record<string, string> = {
                        'Fruits et Légumes': 'bg-green-100', 'Frais': 'bg-blue-100',
                        'Surgelé': 'bg-sky-100', 'Viande': 'bg-red-100',
                        'Sec': 'bg-gray-200', 'Autres': 'bg-yellow-100'
                    };

                    return (
                        <Card key={week.weekNumberInMonth || index} className="shadow-md">
                            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <CardTitle>Semaine {week.weekNumberInMonth}: {format(week.startDate, "dd LLLL", { locale: fr })} - {format(week.endDate, "dd LLLL yyyy", { locale: fr })}</CardTitle>
                                <Button onClick={() => generatePdfForWeek(week, index)} disabled={isGeneratingPdf === index || isGeneratingAll} size="sm">
                                    {isGeneratingPdf === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />} PDF Commande
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {week.menus && week.menus.length > 0 ? (
                                    <div className="overflow-x-auto border rounded-md">
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Jour</TableHead><TableHead>Entrée</TableHead><TableHead>Plat</TableHead><TableHead>Féculent</TableHead><TableHead>Légume</TableHead><TableHead>Sauce</TableHead><TableHead>Fromage</TableHead><TableHead>Dessert</TableHead></TableRow></TableHeader>
                                            <TableBody>{week.menus.map((menu, i) => (<TableRow key={i}><TableCell>{format(parseISO(menu.date), "dd/MM")}</TableCell><TableCell>{menu.dayName}</TableCell><TableCell>{menu.entree || '-'}</TableCell><TableCell>{menu.plat || '-'}</TableCell><TableCell>{menu.feculent || '-'}</TableCell><TableCell>{menu.legume || '-'}</TableCell><TableCell>{menu.sauce || '-'}</TableCell><TableCell>{menu.fromage || '-'}</TableCell><TableCell>{menu.dessert || '-'}</TableCell></TableRow>))}</TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="text-center py-6"><AlertCircle className="w-5 h-5 inline-block mr-2"/>Aucun menu planifié.</div>
                                )}

                                {(isCalculating && !consolidatedIngredients.has(index)) ? (
                                     <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary"/><span className="ml-2">Calcul des ingrédients...</span></div>
                                ) : (ingredientsForWeek.length > 0 || (isPicnicMonth && picnicIngredients.length > 0)) ? (
                                    <div className="overflow-x-auto">
                                        <h4 className="text-lg font-semibold my-4 flex items-center"><ShoppingCart className="mr-2 h-5 w-5"/>Liste de courses </h4>
                                        <Table className='border-collapse border border-gray-300'>
                                            <TableHeader>
                                                <TableRow>
                                                    {ingredientCategoryOrder.map(category => (
                                                        <React.Fragment key={category}>
                                                            <TableHead className={`w-40 border border-gray-300 ${categoryHeaderStyles[category]}`}>{category}</TableHead>
                                                            <TableHead className={`w-24 border border-gray-300 ${categoryHeaderStyles[category]}`}>QTD</TableHead>
                                                        </React.Fragment>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {tableData.map((row, rowIndex) => (
                                                    <TableRow key={rowIndex} className={isPicnicMonth && rowIndex >= 20 ? 'border-2 border-red-500' : ''}>
                                                        {ingredientCategoryOrder.map(category => (
                                                            <React.Fragment key={category}>
                                                                <TableCell className="border border-gray-200 text-xs p-1">{row[`${category}_name`]}</TableCell>
                                                                <TableCell className="border border-gray-200 text-xs p-1">{row[`${category}_qtd`]}</TableCell>
                                                            </React.Fragment>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : !isCalculating && (
                                    <div className="text-center py-6"><ShoppingCart className="w-5 h-5 inline-block mr-2" />Aucun ingrédient à commander.</div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </>
    );
}
