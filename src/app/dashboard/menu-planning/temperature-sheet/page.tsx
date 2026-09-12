'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Thermometer } from 'lucide-react';
import { format, getDaysInMonth, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { getFrenchPublicHolidays } from '@/lib/holiday-utils';

import TemperatureSheet from '../components/temperature-sheet';
import type { DailyMenu } from '../types';
import { initialMenuItem } from '../types';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentYear, i), "MMMM", { locale: fr }),
}));

export default function TemperatureSheetPage() {
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [menuData, setMenuData] = useState<DailyMenu[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const { toast } = useToast();

  const frenchDays = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];


  const generateMonthData = useCallback((year: number, month: number): DailyMenu[] => {
    const daysInSelectedMonth = getDaysInMonth(new Date(year, month));
    const publicHolidaysForYear = getFrenchPublicHolidays(year);
    
    const holidayMap = new Map<string, string>();
    publicHolidaysForYear.forEach(h => {
      holidayMap.set(format(h.date, 'yyyy-MM-dd'), h.name);
    });

    const data: DailyMenu[] = [];
    for (let day = 1; day <= daysInSelectedMonth; day++) {
      const currentDate = startOfDay(new Date(year, month, day));
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayOfWeek = currentDate.getDay();
      
      data.push({
        date: dateStr,
        dayName: frenchDays[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isHoliday: holidayMap.has(dateStr),
        holidayName: holidayMap.get(dateStr) || undefined, 
        ...initialMenuItem, 
      });
    }
    return data;
  }, []);

  const getFirestoreDocId = useCallback(() => `menu_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    const loadMenuData = async () => {
      setDataLoaded(false);
      const docId = getFirestoreDocId();
      const docRef = doc(firestore, "menuPlanning", docId);
      const yearNum = parseInt(selectedYear, 10);
      const monthNum = parseInt(selectedMonth, 10);

      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const firestoreData = docSnap.data();
          const loadedMenuData = (firestoreData.menus as any[] || []).map((d: any) => ({
             ...initialMenuItem, 
             ...d,
             date: d.date, 
             theme: d.theme || '', 
             entree: d.entree || '',
             plat: d.plat || '',
             feculent: d.feculent || '',
             legume: d.legume || '',
             sauce: d.sauce || '',
             dessert: d.dessert || '',
             holidayName: d.holidayName || undefined,
          }));
          
          const expectedDays = getDaysInMonth(new Date(yearNum, monthNum));
          const firstDayLoadedDate = loadedMenuData.length > 0 ? loadedMenuData[0].date : null;
          const expectedFirstDayPrefix = `${yearNum}-${(monthNum + 1).toString().padStart(2, '0')}`;

            if (loadedMenuData.length === expectedDays && firstDayLoadedDate && firstDayLoadedDate.startsWith(expectedFirstDayPrefix)) {
                setMenuData(loadedMenuData);
            } else {
                console.warn(`Data mismatch for ${docId}. Expected ${expectedDays} days starting with ${expectedFirstDayPrefix}, got ${loadedMenuData.length} days starting with ${firstDayLoadedDate}. Regenerating.`);
                const freshData = generateMonthData(yearNum, monthNum);
                setMenuData(freshData);
                
                const sanitizedFreshData = freshData.map(dayMenu => ({
                  ...dayMenu,
                  entree: dayMenu.entree || '',
                  plat: dayMenu.plat || '',
                  feculent: dayMenu.feculent || '',
                  legume: dayMenu.legume || '',
                  sauce: dayMenu.sauce || '',
                  dessert: dayMenu.dessert || '',
                  theme: dayMenu.theme || '',
                  holidayName: dayMenu.holidayName || null, 
                }));
                await setDoc(docRef, { menus: sanitizedFreshData });
                 window.dispatchEvent(new CustomEvent('menuDataUpdatedInFirestore'));
                 console.log("Dispatched menuDataUpdatedInFirestore event after regenerating and saving month data.");
            }
        } else {
          const freshData = generateMonthData(yearNum, monthNum);
          setMenuData(freshData);
          const sanitizedFreshData = freshData.map(dayMenu => ({
            ...dayMenu,
            entree: dayMenu.entree || '',
            plat: dayMenu.plat || '',
            feculent: dayMenu.feculent || '',
            legume: dayMenu.legume || '',
            sauce: dayMenu.sauce || '',
            dessert: dayMenu.dessert || '',
            theme: dayMenu.theme || '',
            holidayName: dayMenu.holidayName || null, 
          }));
          await setDoc(docRef, { menus: sanitizedFreshData });
          window.dispatchEvent(new CustomEvent('menuDataUpdatedInFirestore'));
          console.log("Dispatched menuDataUpdatedInFirestore event after creating new month data.");
          toast({ title: "Nouveau mois initialisé", description: `Les données pour ${months[monthNum].label} ${yearNum} ont été créées.`});
        }
      } catch (error) {
        console.error("Error loading menu data from Firestore:", error);
        toast({ title: "Erreur de chargement des menus", description: "Impossible de charger les données. Utilisation des données par défaut.", variant: "destructive"});
        setMenuData(generateMonthData(yearNum, monthNum));
      }
      setDataLoaded(true);
    };

    loadMenuData();
  }, [selectedYear, selectedMonth, generateMonthData, getFirestoreDocId, toast]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Thermometer className="w-6 h-6 text-primary" />
          Fiches de Température Hebdomadaires
        </CardTitle>
        <CardDescription>
          Consultez et remplissez les fiches de température pour chaque semaine du mois sélectionné, basées sur les plats planifiés (issus de Firestore).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
                <Label htmlFor="year-select-planning">Année</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger id="year-select-planning">
                    <SelectValue placeholder="Sélectionner une année" />
                </SelectTrigger>
                <SelectContent>
                    {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="month-select-planning">Mois</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="month-select-planning">
                    <SelectValue placeholder="Sélectionter un mois" />
                </SelectTrigger>
                <SelectContent>
                    {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
        </div>

        {!dataLoaded ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Chargement des fiches de température...</span>
          </div>
        ) : (
          <TemperatureSheet
            year={parseInt(selectedYear)}
            month={parseInt(selectedMonth)}
            menuData={menuData}
            isLoading={!dataLoaded}
          />
        )}
      </CardContent>
    </Card>
  );
}
