'use client';

import type { DailyMenu, MenuField, StoredMenuThemeValue, MenuThemeIdentifier } from '../types';
import type { RecipeCategory } from './recipe-management';
import { MENU_THEME_OPTIONS_FOR_SELECT, NO_THEME_SELECT_VALUE, menuThemeStyles } from '../types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Save, BookOpen } from 'lucide-react';

interface MenuPlanningTableProps {
  menuData: DailyMenu[];
  onUpdateMenuEntry: (date: string, field: MenuField, value: StoredMenuThemeValue) => void;
  onOpenRecipePicker: (date: string, field: MenuField, category?: RecipeCategory) => void; // Prop pour ouvrir le picker
  onRecipeSearch: (date: string, field: MenuField, recipeName: string) => void;
  disabled?: boolean;
  onSave?: () => void;
}

export default function MenuPlanningTable({ menuData, onUpdateMenuEntry, onOpenRecipePicker, onRecipeSearch, disabled = false, onSave }: MenuPlanningTableProps) {
  
  if (!menuData || menuData.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Aucun menu à afficher pour ce mois.</p>;
  }

  const handleInputChange = (date: string, field: MenuField, value: StoredMenuThemeValue) => {
    onUpdateMenuEntry(date, field, value);
  };

  const handleInputBlur = (date: string, field: MenuField, value: string) => {
    if (value.trim()) {
      onRecipeSearch(date, field, value.trim());
    }
  };

  const getRowClass = (dayMenu: DailyMenu): string => {
    const themeClass = dayMenu.theme && dayMenu.theme !== '' && menuThemeStyles[dayMenu.theme as MenuThemeIdentifier]
      ? menuThemeStyles[dayMenu.theme as MenuThemeIdentifier]
      : '';

    if (themeClass) {
      return themeClass;
    }
    if (dayMenu.isHoliday) {
      return dayMenu.isWeekend 
        ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100'
        : 'bg-yellow-100 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-200';
    }
    if (dayMenu.isWeekend) {
      return 'bg-muted';
    }
    return '';
  };

  return (
    <>
      <div className="p-4 flex justify-end">
        <Button onClick={onSave} disabled={disabled || !onSave} size="sm">
          <Save className="mr-2 h-4 w-4" /> Sauvegarder
        </Button>
      </div>
      <div className="overflow-x-auto border rounded-md shadow-sm">
        <Table>
          <TableHeader className="bg-card sticky top-0 z-30">
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-20">Date</TableHead>
              <TableHead>Jour</TableHead>
              <TableHead>Thème</TableHead>
              <TableHead>Entrée</TableHead>
              <TableHead>Plat</TableHead>
              <TableHead>Féculent</TableHead>
              <TableHead>Légume</TableHead>
              <TableHead>Sauce</TableHead>
              <TableHead>Fromage</TableHead>
              <TableHead>Dessert</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {menuData.map((dayMenu) => (
              <TableRow
                key={dayMenu.date}
                className={cn(getRowClass(dayMenu))}
              >
                <TableCell className={cn(
                  "font-medium sticky left-0 z-10 group-hover:bg-muted/60 transition-colors",
                  getRowClass(dayMenu) || 'bg-card'
                )}>
                  {dayMenu.date.split('-')[2]}
                  {dayMenu.isHoliday && dayMenu.holidayName && (
                     <span className="block text-xs truncate" title={dayMenu.holidayName}>
                         {dayMenu.holidayName}
                     </span>
                  )}
                </TableCell>
                <TableCell>{dayMenu.dayName}</TableCell>
                <TableCell className="p-1">
                  <Select
                    value={dayMenu.theme === '' ? NO_THEME_SELECT_VALUE : dayMenu.theme}
                    onValueChange={(valueFromSelect) => {
                      const valueToStore: StoredMenuThemeValue = valueFromSelect === NO_THEME_SELECT_VALUE ? '' : valueFromSelect as MenuThemeIdentifier;
                      handleInputChange(dayMenu.date, 'theme', valueToStore);
                    }}
                  >
                    <SelectTrigger className="text-xs min-h-[60px] h-auto py-1 bg-background/70 focus:bg-background">
                      <SelectValue placeholder="Thème" />
                    </SelectTrigger>
                    <SelectContent>
                      {MENU_THEME_OPTIONS_FOR_SELECT.map(themeOption => (
                        <SelectItem key={themeOption.value} value={themeOption.value} className="text-xs">
                          {themeOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                {(['entree', 'plat', 'feculent', 'legume', 'sauce', 'fromage', 'dessert'] as Exclude<MenuField, 'theme'>[]).map((field) => {
                  const categoryMap: Record<string, RecipeCategory> = {
                    entree: 'Entrée',
                    plat: 'Plat',
                    feculent: 'Féculent',
                    legume: 'Légumes',
                    sauce: 'Sauce',
                    fromage: 'Fromage',
                    dessert: 'Dessert',
                  };

                  return (
                    <TableCell key={field} className="p-1 align-top">
                      <div className="relative">
                        <Textarea
                          value={dayMenu[field]}
                          onChange={(e) => handleInputChange(dayMenu.date, field, e.target.value)}
                          onBlur={(e) => handleInputBlur(dayMenu.date, field, e.target.value)}
                          placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                          className="text-xs min-h-[80px] resize-none bg-background/70 focus:bg-background pr-8"
                          rows={3}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => {
                            onOpenRecipePicker(dayMenu.date, field, categoryMap[field]);
                          }}
                        >
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* La modale est maintenant gérée par la page parente */}
    </>
  );
}
