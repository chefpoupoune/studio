
"use client";

import type { DailyMenu, MenuField, MenuThemeValue } from '../types';
import { MENU_THEMES, menuThemeStyles } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface MenuPlanningTableProps {
  year: number;
  month: number;
  menuData: DailyMenu[];
  onUpdateMenuEntry: (date: string, field: MenuField, value: string) => void;
}

export default function MenuPlanningTable({ menuData, onUpdateMenuEntry }: MenuPlanningTableProps) {
  if (!menuData || menuData.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Aucun menu à afficher pour ce mois.</p>;
  }

  const handleInputChange = (date: string, field: MenuField, value: string) => {
    onUpdateMenuEntry(date, field, value);
  };

  const getRowClass = (dayMenu: DailyMenu): string => {
    const themeClass = dayMenu.theme && dayMenu.theme !== '' ? menuThemeStyles[dayMenu.theme] : '';

    if (themeClass) {
      return themeClass;
    }
    if (dayMenu.isHoliday) {
      return dayMenu.isWeekend 
        ? 'bg-yellow-200 dark:bg-yellow-800/50 text-yellow-900 dark:text-yellow-100' // Holiday on Weekend
        : 'bg-yellow-100 dark:bg-yellow-700/40 text-yellow-800 dark:text-yellow-200'; // Holiday on Weekday
    }
    if (dayMenu.isWeekend) {
      return 'bg-muted/30'; // Weekend only
    }
    return ''; // Default
  };

  return (
    <div className="overflow-x-auto border rounded-md shadow-sm">
      <Table className="min-w-full">
        <TableHeader className="bg-muted/50 sticky top-0 z-10">
          <TableRow>
            <TableHead className="w-[150px] min-w-[150px] sticky left-0 bg-muted/50 z-20">Date</TableHead>
            <TableHead className="w-[120px] min-w-[120px]">Jour</TableHead>
            <TableHead className="w-[180px] min-w-[180px]">Thème</TableHead>
            <TableHead className="w-[200px] min-w-[200px]">Entrée</TableHead>
            <TableHead className="w-[200px] min-w-[200px]">Plat</TableHead>
            <TableHead className="w-[200px] min-w-[200px]">Féculent</TableHead>
            <TableHead className="w-[200px] min-w-[200px]">Légume</TableHead>
            <TableHead className="w-[200px] min-w-[200px]">Sauce</TableHead>
            <TableHead className="w-[200px] min-w-[200px]">Dessert</TableHead>
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
                getRowClass(dayMenu) ? '' : 'bg-card' // Ensure sticky cell matches row if themed, else default
                // This logic might need to be more sophisticated if rowClass itself sets bg-card or similar
              )}>
                {dayMenu.date.split('-')[2]} {/* Show only day number */}
                {dayMenu.isHoliday && dayMenu.holidayName && (
                   <span className="block text-xs truncate" title={dayMenu.holidayName}>
                       {dayMenu.holidayName}
                   </span>
                )}
              </TableCell>
              <TableCell>{dayMenu.dayName}</TableCell>
              <TableCell className="p-1">
                <Select
                  value={dayMenu.theme || ''}
                  onValueChange={(value) => handleInputChange(dayMenu.date, 'theme', value as MenuThemeValue)}
                >
                  <SelectTrigger className="text-xs min-h-[60px] h-auto py-1 bg-background/70 focus:bg-background">
                    <SelectValue placeholder="Thème" />
                  </SelectTrigger>
                  <SelectContent>
                    {MENU_THEMES.map(themeOption => (
                      <SelectItem key={themeOption.value} value={themeOption.value} className="text-xs">
                        {themeOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              {(['entree', 'plat', 'feculent', 'legume', 'sauce', 'dessert'] as Exclude<MenuField, 'theme'>[]).map((field) => (
                <TableCell key={field} className="p-1">
                  <Textarea
                    value={dayMenu[field]}
                    onChange={(e) => handleInputChange(dayMenu.date, field, e.target.value)}
                    placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                    className="text-xs min-h-[60px] resize-none bg-background/70 focus:bg-background"
                    rows={3}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
