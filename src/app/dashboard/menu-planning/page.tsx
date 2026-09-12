'use client';

import { BookOpenText, CalendarDays, ClipboardCheck, Thermometer, FileText as FileTextIcon, Loader2, Trash2, ShieldAlert, CookingPot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getDaysInMonth, format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getFrenchPublicHolidays } from '@/lib/holiday-utils';
import type { DailyMenu, MenuField, StoredMenuThemeValue } from './types';
import { initialMenuItem, frenchDays } from './types';
import MenuPlanningTable from './components/menu-planning-table';
import WeeklyOrderSheets from './components/weekly-order-sheets';
import TemperatureSheet from './components/temperature-sheet';
import RecipeManagement, { Recipe, RecipeCategory } from './components/recipe-management';
import RecipePickerModal from './components/recipe-picker-modal';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, loadPdfLayoutSettingsFromFirestore, hexToRgb } from '@/lib/pdf-settings';

import { MENU_WEEKEND_HEX, MENU_HOLIDAY_WEEKDAY_HEX, MENU_HOLIDAY_WEEKEND_HEX } from '@/config/colors';
import useIsMobile from '@/hooks/use-mobile';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useUser } from '@/hooks/use-user';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentYear, i), "MMMM", { locale: fr }),
}));

const allMenuPlanningTabs = [
  { value: "planning", label: "Planification Mensuelle", Icon: CalendarDays },
  { value: "recipes", label: "Recettes", Icon: CookingPot, permissionId: 'menuPlanning_recipes' },
  { value: "order-sheets", label: "Fiches de Commande", Icon: ClipboardCheck },
  { value: "temperature-sheets", label: "Fiches de Température", Icon: Thermometer, permissionId: 'menuPlanning_temperatureSheet' },
];

export default function MenuPlanningPage() {
  const { user, isLoading: isLoadingUser } = useUser();
  const [isClient, setIsClient] = useState(false);

  const visibleTabs = useMemo(() => {
    if (!user) return [];
    const { permissions } = user;
    return allMenuPlanningTabs.filter(tab => {
      if (tab.permissionId) {
        return !!permissions[tab.permissionId as keyof typeof permissions];
      }
      return !!permissions.canAccessMenuPlanning;
    });
  }, [user]);

  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [monthlyNumberOfGuests, setMonthlyNumberOfGuests] = useState<number>(240);
  const [isPicnicMonth, setIsPicnicMonth] = useState<boolean>(false);
  const [menuData, setMenuData] = useState<DailyMenu[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingMonthData, setIsResettingMonthData] = useState(false);
  const [isGeneratingMonthlyPdf, setIsGeneratingMonthlyPdf] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('');
  
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ date: string; field: MenuField, category?: RecipeCategory } | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (visibleTabs.length > 0) {
      const hash = window.location.hash.replace('#', '');
      const tabFromHash = visibleTabs.find(tab => tab.value === hash);
      if (tabFromHash) {
        setActiveTab(tabFromHash.value);
      } else if (!visibleTabs.some(t => t.value === activeTab)) {
        setActiveTab(visibleTabs[0].value);
      }
    }
  }, [visibleTabs, activeTab]);

  const generateMonthData = useCallback((year: number, month: number): DailyMenu[] => {
    const daysInSelectedMonth = getDaysInMonth(new Date(year, month));
    const publicHolidaysForYear = getFrenchPublicHolidays(year);
    const holidayMap = new Map<string, string>();
    publicHolidaysForYear.forEach(h => holidayMap.set(format(h.date, 'yyyy-MM-dd'), h.name));

    return Array.from({ length: daysInSelectedMonth }, (_, dayIndex) => {
      const currentDate = startOfDay(new Date(year, month, dayIndex + 1));
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayOfWeek = currentDate.getDay();
      return {
        date: dateStr,
        dayName: frenchDays[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isHoliday: holidayMap.has(dateStr),
        holidayName: holidayMap.get(dateStr) || '', // Corrected: Use empty string instead of undefined
        ...initialMenuItem,
      };
    });
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
          const loadedMenuData = (firestoreData.menus as any[] || []).map(d => ({ ...initialMenuItem, ...d }));
          setMenuData(loadedMenuData);
          setMonthlyNumberOfGuests(firestoreData.monthlyNumberOfGuests ?? 240);
          setIsPicnicMonth(firestoreData.isPicnicMonth ?? false);
        } else {
          const freshData = generateMonthData(yearNum, monthNum);
          setMenuData(freshData);
          setMonthlyNumberOfGuests(240); // Default value
          setIsPicnicMonth(false);
        }
      } catch (error) {
        console.error("Error loading menu data:", error);
        toast({ title: "Erreur de chargement", variant: "destructive" });
        setMenuData(generateMonthData(yearNum, monthNum));
      } finally {
        setDataLoaded(true);
      }
    };
    loadMenuData();
  }, [selectedYear, selectedMonth, generateMonthData, getFirestoreDocId, toast]);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const q = query(collection(firestore, 'recipes'));
        const querySnapshot = await getDocs(q);
        const fetchedRecipes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
        setRecipes(fetchedRecipes);
      } catch (error) {
        console.error("Error fetching recipes:", error);
        toast({ title: "Erreur de chargement des recettes", variant: "destructive" });
      }
    };
    fetchRecipes();
  }, [toast]);

  const handleUpdateMenuEntry = useCallback((date: string, field: MenuField, value: StoredMenuThemeValue | boolean) => {
    setMenuData(prevData =>
      prevData.map(dayMenu =>
        dayMenu.date === date ? { ...dayMenu, [field]: value } : dayMenu
      )
    );
  }, []);

  const handleRecipeSearch = (date: string, field: MenuField, recipeName: string) => {
    const foundRecipe = recipes.find(recipe => recipe.name.toLowerCase() === recipeName.toLowerCase());
    if (foundRecipe) {
      handleUpdateMenuEntry(date, field, foundRecipe.name as StoredMenuThemeValue);
    }
  };

  const handleOpenRecipePicker = (date: string, field: MenuField, category?: RecipeCategory) => {
    setPickerTarget({ date, field, category });
    setIsPickerOpen(true);
  };

  const handleRecipeSelect = (recipe: Recipe) => {
    if (pickerTarget) {
      handleUpdateMenuEntry(pickerTarget.date, pickerTarget.field, recipe.name as StoredMenuThemeValue);
    }
    setIsPickerOpen(false);
  };

  const handleSaveMenu = useCallback(async () => {
    if (!dataLoaded || isSaving) return;
    setIsSaving(true);
    const docId = getFirestoreDocId();
    const docRef = doc(firestore, "menuPlanning", docId);

    const sanitizedMenuData = menuData.map(day => ({
        ...day,
        theme: day.theme || '',
        entree: day.entree || '',
        plat: day.plat || '',
        feculent: day.feculent || '',
        legume: day.legume || '',
        sauce: day.sauce || '',
        dessert: day.dessert || '',
        holidayName: day.holidayName || '', 
    }));

    try {
      await setDoc(docRef, { 
        menus: sanitizedMenuData, 
        monthlyNumberOfGuests, 
        isPicnicMonth 
      });
      toast({ title: "Menus sauvegardés" });
    } catch (error) {
      console.error("Error saving menu data:", error);
      toast({ title: "Erreur de sauvegarde", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
}, [menuData, monthlyNumberOfGuests, isPicnicMonth, dataLoaded, isSaving, getFirestoreDocId, toast]);

 const generateMonthlyPdf = async () => {
    setIsGeneratingMonthlyPdf(true);
    try {
        const defaultSettings = getPdfLayoutSettings();
        const customSettings = await loadPdfLayoutSettingsFromFirestore('menu_planning_monthly');

        const pdfSettings = {
            ...defaultSettings,
            ...customSettings,
            margins: {
                top: 40, right: 40, bottom: 40, left: 40, ...((customSettings || {}).margins || {}), 
            },
        };

        const doc = new jsPDF(pdfSettings.orientation, 'pt', pdfSettings.format) as jsPDFWithAutoTable;

        const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
        const title = `Planning des Menus - ${monthLabel} ${selectedYear}`;
        
        if (pdfSettings.logoUrl) {
            doc.addImage(pdfSettings.logoUrl, 'PNG', pdfSettings.margins.left, 40, 60, 60);
        }
        
        doc.setFontSize(18);
        doc.setTextColor(hexToRgb(pdfSettings.primaryColor).r, hexToRgb(pdfSettings.primaryColor).g, hexToRgb(pdfSettings.primaryColor).b);
        doc.text(title, doc.internal.pageSize.getWidth() / 2, 70, { align: 'center' });

        const tableColumns = [
            { header: 'Date', dataKey: 'date' },
            { header: 'Jour', dataKey: 'dayName' },
            { header: 'Thème', dataKey: 'theme' },
            { header: 'Entrée', dataKey: 'entree' },
            { header: 'Plat', dataKey: 'plat' },
            { header: 'Féculent', dataKey: 'feculent' },
            { header: 'Légume', dataKey: 'legume' },
            { header: 'Dessert', dataKey: 'dessert' },
        ];
        
        const tableRows = menuData.map(item => {
            const date = new Date(item.date + 'T00:00:00');
            const formattedDate = format(date, 'dd/MM', { locale: fr });
            
            return {
                ...item,
                date: formattedDate,
                dayName: item.holidayName ? `${item.dayName} (${item.holidayName})` : item.dayName,
            };
        });

        const BORDEAUX_COLOR = '#800020';

        doc.autoTable({
            columns: tableColumns,
            body: tableRows,
            startY: 90,
            theme: 'grid',
            headStyles: {
                fillColor: BORDEAUX_COLOR,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
            },
            styles: {
                cellPadding: 4,
                fontSize: 8,
                valign: 'middle',
                overflow: 'linebreak',
                lineColor: [0, 0, 0],
                lineWidth: 0.5,
            },
            didParseCell: (data) => {
                const day = data.row.raw as DailyMenu;
                if (data.section !== 'body' || !day) return;

                data.cell.styles.textColor = [0, 0, 0];

                const POISSON_COLOR = '#FFD1DC';
                const FETE_COLOR = '#FFDAB9';
                const VEGE_COLOR = '#C8E6C9';
                const FROID_COLOR = '#B3E5FC';
                const SAM_COLOR = '#FFFFE0';
                const FERIER_COLOR = '#A9A9A9';


                let fillColor: string | undefined = undefined;
                const theme = (day.theme || '').trim().toLowerCase();

                if (day.holidayName) {
                    fillColor = FETE_COLOR;
                } else {
                    if (theme === 'poisson') {
                        fillColor = POISSON_COLOR;
                    } else if (theme === 'végé' || theme === 'vege') {
                        fillColor = VEGE_COLOR;
                    } else if (theme === 'froid') {
                        fillColor = FROID_COLOR;
                    } else if (theme === 'sam') {
                        fillColor = SAM_COLOR;
                    } else if (theme === 'ferier') {
                      fillColor = FERIER_COLOR;
                  } else if (theme === 'fete') {
                    fillColor = FETE_COLOR;
                }
                }

                if (!fillColor) {
                    if (day.isHoliday) {
                        fillColor = day.isWeekend ? MENU_HOLIDAY_WEEKEND_HEX : MENU_HOLIDAY_WEEKDAY_HEX;
                    } else if (day.isWeekend) {
                        fillColor = MENU_WEEKEND_HEX;
                    }
                }

                if (fillColor) {
                    data.cell.styles.fillColor = fillColor;
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        });

        // --- Add Legend after the table ---
        const finalY = (doc as any).lastAutoTable.finalY;
        let legendY = finalY + 25;

        if (legendY > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage();
            legendY = pdfSettings.margins.top;
        }

        const POISSON_COLOR = '#FFD1DC';
        const FETE_COLOR = '#FFDAB9';
        const VEGE_COLOR = '#C8E6C9';
        const FROID_COLOR = '#B3E5FC';
        const SAM_COLOR = '#FFFFE0';
        const FERIER_COLOR = '#A9A9A9';

        const legendItems = [
            { text: 'Fête', color: FETE_COLOR },
            { text: 'SAM', color: SAM_COLOR },
            { text: 'Poisson', color: POISSON_COLOR },
            { text: 'Végé', color: VEGE_COLOR },
            { text: 'Froid', color: FROID_COLOR },
            { text: 'Weekend', color: MENU_WEEKEND_HEX },
            { text: 'Jour Férié', color: MENU_HOLIDAY_WEEKDAY_HEX },
            { text: 'Ferier', color: FERIER_COLOR },
        ];

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text("Légende :", pdfSettings.margins.left, legendY);

        legendY += 20;

        doc.setFontSize(9);
        const rectSize = 10;
        const itemPadding = 15;
        let currentX = pdfSettings.margins.left;

        legendItems.forEach(item => {
            const textWidth = doc.getStringUnitWidth(item.text) * 9;
            const itemWidth = rectSize + 5 + textWidth;

            if (currentX + itemWidth > doc.internal.pageSize.getWidth() - pdfSettings.margins.right) {
                legendY += 20;
                currentX = pdfSettings.margins.left;
            }

            doc.setFillColor(item.color);
            doc.rect(currentX, legendY - rectSize, rectSize, rectSize, 'F');
            doc.setDrawColor(0);
            doc.rect(currentX, legendY - rectSize, rectSize, rectSize, 'S');
            doc.setTextColor(0, 0, 0);
            doc.text(item.text, currentX + rectSize + 5, legendY);
            currentX += itemWidth + itemPadding;
        });

        const pageCount = (doc.internal as any).pages.length;
        doc.setFontSize(8);
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const text = `Page ${i} / ${pageCount}`;
            const textWidth = doc.getStringUnitWidth(text) * doc.getFontSize() / doc.internal.scaleFactor;
            doc.text(text, doc.internal.pageSize.getWidth() - pdfSettings.margins.right - textWidth, doc.internal.pageSize.getHeight() - 20);
        }

        doc.save(`planning_menus_${selectedYear}_${monthLabel}.pdf`);
        toast({ title: "PDF généré avec succès" });

    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ title: "Erreur lors de la génération du PDF", description: "Veuillez réessayer.", variant: "destructive" });
    } finally {
        setIsGeneratingMonthlyPdf(false);
    }
  };

  const handleResetMonthData = async () => {
    setIsResettingMonthData(true);
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    const freshData = generateMonthData(yearNum, monthNum);
    const docId = getFirestoreDocId();
    const docRef = doc(firestore, "menuPlanning", docId);

    try {
      await setDoc(docRef, { 
        menus: freshData, 
        monthlyNumberOfGuests: 240,
        isPicnicMonth: false,
      });
      
      setMenuData(freshData);
      setMonthlyNumberOfGuests(240);
      setIsPicnicMonth(false);
      
      toast({ 
        title: "Mois réinitialisé", 
        description: `Le planning pour ${months[monthNum].label} ${yearNum} a été réinitialisé.` 
      });
    } catch (error) {
      console.error("Error resetting month data:", error);
      toast({ 
        title: "Erreur lors de la réinitialisation",
        variant: "destructive" 
      });
    } finally {
      setIsResettingMonthData(false);
    }
  };

  if (!isClient || isLoadingUser) {
    return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin"/></div>;
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8 flex-grow flex items-center justify-center">
        <Alert variant="destructive" className="max-w-lg">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Accès non autorisé</AlertTitle>
          <AlertDescription>
            Vous n'avez pas les permissions nécessaires pour accéder à cette section. Veuillez contacter un administrateur.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const renderTabContent = (tabValue: string) => {
    switch(tabValue) {
      case 'planning':
        return <MenuPlanningTable menuData={menuData} onUpdateMenuEntry={handleUpdateMenuEntry} onSave={handleSaveMenu} onOpenRecipePicker={handleOpenRecipePicker} onRecipeSearch={handleRecipeSearch} />;
      case 'recipes':
        return <RecipeManagement />;
      case 'order-sheets':
        return <WeeklyOrderSheets year={parseInt(selectedYear)} month={parseInt(selectedMonth)} menuData={menuData} isLoading={!dataLoaded} monthlyNumberOfGuests={monthlyNumberOfGuests} isPicnicMonth={isPicnicMonth} />;
      case 'temperature-sheets':
        return <TemperatureSheet year={parseInt(selectedYear)} month={parseInt(selectedMonth)} menuData={menuData} isLoading={!dataLoaded} />;
      default:
        return null;
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <BookOpenText className="w-10 h-10 text-accent" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
            Planification des Menus
          </h1>
        </div>
      </div>
      <div className="mb-6 text-center sm:text-left"><CurrentDate /></div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Contrôles du Planning</CardTitle>
          <CardDescription>Sélectionnez la période et définissez les options pour le mois.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="month-select">Mois</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="month-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="year-select">Année</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger id="year-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="guest-count-input">Nombre de convives</Label>
              <Input
                id="guest-count-input"
                type="number"
                value={monthlyNumberOfGuests}
                onChange={(e) => setMonthlyNumberOfGuests(Number(e.target.value))}
                placeholder="Ex: 240"
              />
            </div>
            <div className="flex items-center space-x-2 pt-4 sm:pt-6">
                <Checkbox id="picnic-checkbox" checked={isPicnicMonth} onCheckedChange={(checked) => setIsPicnicMonth(checked as boolean)} />
                <Label htmlFor="picnic-checkbox" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Activer le menu Pique-Nique pour le mois
                </Label>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {activeTab === 'planning' && (
        <Card className="mb-6">
            <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Générer des documents ou réinitialiser les données pour le mois sélectionné.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                <Button onClick={generateMonthlyPdf} disabled={isGeneratingMonthlyPdf}>
                    {isGeneratingMonthlyPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileTextIcon className="mr-2 h-4 w-4" />} 
                    Générer PDF Mensuel
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isResettingMonthData}>
                            {isResettingMonthData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Réinitialiser le mois
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Êtes-vous sûr de vouloir réinitialiser ?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Cette action est irréversible. Toutes les données du planning pour le mois de {months[parseInt(selectedMonth)].label} {selectedYear} seront perdues et remplacées par un planning vide. Le nombre de convives sera également réinitialisé.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetMonthData}>Confirmer</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {isMobile ? (
          visibleTabs.length > 0 && <div className="mb-4">
            <Label htmlFor="mobile-menu-nav">Naviguer vers :</Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger id="mobile-menu-nav"><SelectValue /></SelectTrigger>
              <SelectContent>
                {visibleTabs.map(tab => (
                  <SelectItem key={tab.value} value={tab.value}>
                    <span className="flex items-center"><tab.Icon className="mr-2 h-4 w-4" />{tab.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          visibleTabs.length > 0 && <TabsList className="grid w-full mb-6 gap-2" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
            {visibleTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} asChild>
                <Button variant={activeTab === tab.value ? 'default' : 'outline'} className="w-full">
                  <tab.Icon className="mr-2 h-4 w-4" />
                  {tab.label}
                </Button>
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        
        {visibleTabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
             {activeTab === tab.value && renderTabContent(tab.value)}
          </TabsContent>
        ))}
      </Tabs>

      {/* La modale est maintenant ici, au niveau le plus haut */}
      <RecipePickerModal
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        categoryFilter={pickerTarget?.category}
        onSelectRecipe={handleRecipeSelect}
      />
    </div>
  );
}
