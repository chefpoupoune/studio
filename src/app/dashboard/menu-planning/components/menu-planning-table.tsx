
"use client";

import type { DailyMenu, MenuField } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Using Textarea for more space
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

  return (
    <div className="overflow-x-auto border rounded-md shadow-sm">
      <Table className="min-w-full">
        <TableHeader className="bg-muted/50 sticky top-0 z-10">
          <TableRow>
            <TableHead className="w-[150px] min-w-[150px] sticky left-0 bg-muted/50 z-20">Date</TableHead>
            <TableHead className="w-[120px] min-w-[120px]">Jour</TableHead>
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
              className={cn(
                dayMenu.isWeekend && 'bg-muted/30', // Grey for weekends
                dayMenu.isHoliday && 'bg-yellow-100 dark:bg-yellow-700/30', // Yellow for holidays
                dayMenu.isHoliday && dayMenu.isWeekend && 'bg-yellow-200 dark:bg-yellow-600/40' // Darker yellow if weekend holiday
              )}
            >
              <TableCell className="font-medium sticky left-0 bg-card z-10 group-hover:bg-muted/50 transition-colors">
                {dayMenu.date.split('-')[2]} {/* Show only day number */}
                {dayMenu.isHoliday && dayMenu.holidayName && (
                   <span className="block text-xs text-amber-700 dark:text-amber-400 truncate" title={dayMenu.holidayName}>
                       {dayMenu.holidayName}
                   </span>
                )}
              </TableCell>
              <TableCell>{dayMenu.dayName}</TableCell>
              {(['entree', 'plat', 'feculent', 'legume', 'sauce', 'dessert'] as MenuField[]).map((field) => (
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
