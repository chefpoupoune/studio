
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, AlertCircle, Loader2 } from "lucide-react"; // Added Loader2
import { format, startOfWeek, endOfWeek, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DailyMenu, MenuField, MenuThemeIdentifier, StoredMenuThemeValue, MenuItem } from '@/app/dashboard/menu-planning/types'; // Added MenuItem
import { menuThemeStyles, MENU_THEME_OPTIONS_FOR_SELECT, initialMenuItem } from '@/app/dashboard/menu-planning/types'; // Added initialMenuItem
import { cn } from '@/lib/utils';
import { firestore } from '@/lib/firebase'; // Added Firestore
import { doc, getDoc } from 'firebase/firestore'; // Added Firestore getDoc
import { useToast } from '@/hooks/use-toast'; // Added useToast

const mealPartLabels: Record<Exclude<MenuField, 'theme'>, string> = {
  entree: "Entrée",
  plat: "Plat",
  feculent: "Féculent",
  legume: "Légume",
  sauce: "Sauce",
  dessert: "Dessert",
};
const mealPartOrder: Exclude<MenuField, 'theme'>[] = ['entree', 'plat', 'feculent', 'legume', 'sauce', 'dessert'];


export default function WeeklyMenuSummary() {
  const [weeklyMenu, setWeeklyMenu] = useState<DailyMenu[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [currentWeekInfo, setCurrentWeekInfo] = useState({ start: '', end: '' });
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const fetchMenuSummaryData = async () => {
        setIsLoadingSummary(true);
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed

        const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 }); // Sunday
        setCurrentWeekInfo({
          start: format(weekStart, "dd MMMM", { locale: fr }),
          end: format(weekEnd, "dd MMMM yyyy", { locale: fr }),
        });

        let fullMonthMenu: DailyMenu[] = [];

        const fetchMonthDataFromFirestore = async (year: number, month: number): Promise<DailyMenu[]> => {
          const firestoreDocId = `menu_${year}_${month}`; // Firestore key format
          const docRef = doc(firestore, "menuPlanning", firestoreDocId);
          try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const firestoreData = docSnap.data();
              const loadedMenus = (firestoreData.menus as any[] || []).map((d: any) => ({
                ...initialMenuItem,
                ...d,
                date: d.date, 
                theme: d.theme || '',
                holidayName: d.holidayName || undefined,
                // Ensure all meal parts are strings, defaulting to empty if undefined/null from Firestore
                entree: d.entree || '',
                plat: d.plat || '',
                feculent: d.feculent || '',
                legume: d.legume || '',
                sauce: d.sauce || '',
                dessert: d.dessert || '',
              }));
              return loadedMenus;
            }
          } catch (e) {
            console.error(`Failed to fetch menu data for ${month + 1}/${year} from Firestore:`, e);
            toast({ title: `Erreur chargement menus ${month + 1}/${year}`, variant: "destructive" });
          }
          return [];
        };

        fullMonthMenu = await fetchMonthDataFromFirestore(currentYear, currentMonth);

        if (weekEnd.getMonth() !== currentMonth) {
          const nextMonthIndex = (currentMonth + 1) % 12;
          const yearForNextMonth = nextMonthIndex === 0 ? currentYear + 1 : currentYear;
          const nextMonthMenus = await fetchMonthDataFromFirestore(yearForNextMonth, nextMonthIndex);
          fullMonthMenu = fullMonthMenu.concat(nextMonthMenus);
        }
        
        const currentWeekStartStr = format(weekStart, 'yyyy-MM-dd');
        const currentWeekEndStr = format(weekEnd, 'yyyy-MM-dd');

        const itemsForCurrentWeek = fullMonthMenu.filter(item => {
          if (!item || !item.date) return false;
          try {
              const itemDateStr = item.date; 
              const hasContent = mealPartOrder.some(part => item[part] && String(item[part]).trim() !== '');
              return itemDateStr >= currentWeekStartStr && itemDateStr <= currentWeekEndStr && hasContent;
          } catch (e) {
              console.warn(`Skipping invalid date or item processing error in menu summary: ${item.date}`, e);
              return false;
          }
        });
        setWeeklyMenu(itemsForCurrentWeek);
        setIsLoadingSummary(false);
      };

      fetchMenuSummaryData();

      const handleMenuDataUpdated = () => {
        console.log("WeeklyMenuSummary: menuDataUpdatedInFirestore event received. Re-fetching summary.");
        fetchMenuSummaryData();
      };
      window.addEventListener('menuDataUpdatedInFirestore', handleMenuDataUpdated);

      return () => {
        window.removeEventListener('menuDataUpdatedInFirestore', handleMenuDataUpdated);
      };
    }
  }, [isClient, toast]);
  
  const isValidDate = (date: Date) => !isNaN(date.getTime());

  const displayedItems = useMemo(() => {
    return weeklyMenu
      .sort((a, b) => {
        // Ensure dates are valid before attempting to get time
        const dateA = parseISO(a.date);
        const dateB = parseISO(b.date);
        if (!isValidDate(dateA) || !isValidDate(dateB)) return 0;
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 3); 
  }, [weeklyMenu]);

  if (!isClient || isLoadingSummary) {
    return (
      <Card className="shadow-lg h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Menu de la Semaine
            </CardTitle>
          </div>
           <CardDescription className="text-xs">
             Chargement des menus...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow pt-2 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Menu de la Semaine
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          Aperçu du {currentWeekInfo.start} au {currentWeekInfo.end}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        {displayedItems.length > 0 ? (
          <ScrollArea className="h-[220px] sm:h-[240px] pr-3">
            <ul className="space-y-2">
              {displayedItems.map((item) => (
                <li key={item.date} className="text-sm border-b pb-3 last:border-b-0 last:pb-0 mb-2 last:mb-0">
                  <p className="font-semibold text-base capitalize mb-1.5 text-foreground dark:text-white underline">
                    {isValidDate(parseISO(item.date)) ? format(parseISO(item.date), "EEEE dd", { locale: fr }) : "Date invalide"}
                    {item.theme && item.theme !== '' && (
                        <span className={cn(
                            "ml-2 text-xs font-medium px-1.5 py-0.5 rounded-sm no-underline", 
                            menuThemeStyles[item.theme as MenuThemeIdentifier] || 'bg-muted text-muted-foreground'
                        )}>
                            {MENU_THEME_OPTIONS_FOR_SELECT.find(opt => opt.value === item.theme)?.label || item.theme}
                        </span>
                    )}
                  </p>
                  <ul className="space-y-0.5 text-xs pl-3 list-disc list-outside marker:text-primary/70">
                    {mealPartOrder.map(part => {
                      const mealContent = item[part];
                      if (mealContent && String(mealContent).trim() !== '') {
                        return (
                          <li key={part}>
                            <span className="font-medium text-foreground/90">{mealPartLabels[part]}:</span>
                            <span className="text-muted-foreground ml-1">{String(mealContent)}</span>
                          </li>
                        );
                      }
                      return null;
                    })}
                  </ul>
                </li>
              ))}
              {weeklyMenu.length > 3 && <li className="text-xs text-muted-foreground text-center pt-2">... et {weeklyMenu.length - 3} autre(s) jour(s) planifié(s).</li>}
            </ul>
          </ScrollArea>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4 h-full flex flex-col items-center justify-center">
             <AlertCircle className="w-10 h-10 text-muted-foreground/70 mb-2"/>
             <p>Aucun menu planifié pour cette semaine.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    