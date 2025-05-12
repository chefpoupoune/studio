
"use client";

import React, { useMemo, useState } from 'react';
import type { DailyMenu } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Loader2, CalendarRange, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, startOfWeek, endOfWeek, addWeeks, isSameMonth, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

interface WeekData {
  weekNumberInMonth: number;
  startDate: Date;
  endDate: Date;
  menus: DailyMenu[];
}

interface WeeklyOrderSheetsProps {
  year: number;
  month: number; // 0-indexed
  menuData: DailyMenu[];
  isLoading: boolean;
}

function groupMenusByWeek(year: number, month: number, allMenusForMonth: DailyMenu[]): WeekData[] {
  const weeks: WeekData[] = [];
  if (!allMenusForMonth || allMenusForMonth.length === 0) return weeks;

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let currentIterationDate = startOfWeek(firstDayOfMonth, { locale: fr, weekStartsOn: 1 });
  let weekCounter = 1;

  while (currentIterationDate <= lastDayOfMonth) {
    const weekStartDate = currentIterationDate < firstDayOfMonth ? firstDayOfMonth : currentIterationDate;
    let weekEndDate = endOfWeek(currentIterationDate, { locale: fr, weekStartsOn: 1 });
    weekEndDate = weekEndDate > lastDayOfMonth ? lastDayOfMonth : weekEndDate;

    const weekMenus = allMenusForMonth.filter(menu => {
      const menuDate = parseISO(menu.date); // Dates from menuData are strings
      return menuDate >= weekStartDate && menuDate <= weekEndDate && isSameMonth(menuDate, firstDayOfMonth);
    });
    
    // Only add the week if its range (start or end) overlaps with the current month
     if (weekStartDate <= lastDayOfMonth && weekEndDate >= firstDayOfMonth) {
        weeks.push({
            weekNumberInMonth: weekCounter,
            startDate: weekStartDate,
            endDate: weekEndDate,
            menus: weekMenus,
        });
        weekCounter++;
    }
    currentIterationDate = addWeeks(currentIterationDate, 1);
  }
  return weeks;
}

export default function WeeklyOrderSheets({ year, month, menuData, isLoading }: WeeklyOrderSheetsProps) {
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<number | null>(null); // Store week index being generated

  const weeklyGroupedMenus = useMemo(() => {
    return groupMenusByWeek(year, month, menuData);
  }, [year, month, menuData]);

  const generatePdfForWeek = (week: WeekData, weekIndex: number) => {
    if (week.menus.length === 0) {
      toast({
        title: "Aucun Menu Planifié",
        description: `Aucun menu n'est planifié pour la semaine du ${format(week.startDate, "dd/MM", { locale: fr })} au ${format(week.endDate, "dd/MM", { locale: fr })}.`,
        variant: "destructive",
      });
      return;
    }
    setIsGeneratingPdf(weekIndex);

    try {
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const monthName = format(new Date(year, month), "MMMM yyyy", { locale: fr });
      const weekLabel = `Semaine ${week.weekNumberInMonth}: du ${format(week.startDate, "dd LLLL", { locale: fr })} au ${format(week.endDate, "dd LLLL yyyy", { locale: fr })}`;
      
      doc.setFontSize(16);
      doc.text("Fiche de Commande Cuisine", 14, 20);
      doc.setFontSize(12);
      doc.text(monthName, 14, 28);
      doc.setFontSize(10);
      doc.text(weekLabel, 14, 34);
      doc.text(`Généré le: ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`, doc.internal.pageSize.width - 14, 20, { align: 'right'});


      const head = [['Date', 'Jour', 'Entrée', 'Plat', 'Féculent', 'Légume', 'Sauce', 'Dessert']];
      const body = week.menus.map(menu => [
        format(parseISO(menu.date), "dd/MM", { locale: fr }),
        menu.dayName,
        menu.entree,
        menu.plat,
        menu.feculent,
        menu.legume,
        menu.sauce,
        menu.dessert,
      ]);

      doc.autoTable({
        startY: 45,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133] }, // Example header color
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(10);
          doc.text(`Page ${data.pageNumber} sur ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
      });
      
      doc.save(`Fiche_Commande_${format(week.startDate, "yyyy-MM-dd")}_${format(week.endDate, "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF Généré", description: `Fiche de commande pour ${weekLabel} téléchargée.` });
    } catch (error) {
      console.error("Error generating PDF for week:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Chargement des données hebdomadaires...</span>
      </div>
    );
  }

  if (weeklyGroupedMenus.length === 0) {
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
    <div className="space-y-6">
      {weeklyGroupedMenus.map((week, index) => (
        <Card key={index} className="shadow-md">
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
              <CardTitle>
                Semaine {week.weekNumberInMonth}: {format(week.startDate, "dd LLLL", { locale: fr })} - {format(week.endDate, "dd LLLL yyyy", { locale: fr })}
              </CardTitle>
              <CardDescription>{week.menus.length} jour{week.menus.length > 1 ? 's' : ''} avec menu planifié cette semaine.</CardDescription>
            </div>
            <Button 
              onClick={() => generatePdfForWeek(week, index)} 
              disabled={isGeneratingPdf === index || week.menus.length === 0}
              size="sm"
            >
              {isGeneratingPdf === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Générer PDF
            </Button>
          </CardHeader>
          <CardContent>
            {week.menus.length > 0 ? (
              <div className="overflow-x-auto border rounded-md max-h-[300px]">
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
                    {week.menus.map(menu => (
                      <TableRow key={menu.date}>
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
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground flex items-center justify-center gap-2">
                <AlertCircle className="w-5 h-5" /> Aucun menu planifié pour cette semaine.
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

