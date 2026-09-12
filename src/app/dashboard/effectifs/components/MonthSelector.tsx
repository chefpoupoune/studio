'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function MonthSelector({ currentDate, onDateChange }: { currentDate: Date, onDateChange: (date: Date) => void }) {
  const handlePrevMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  return (
    <div className="flex items-center justify-center space-x-4 bg-card shadow-sm p-2 rounded-lg">
      <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <span className="text-xl font-semibold w-48 text-center">
        {format(currentDate, 'MMMM yyyy', { locale: fr })}
      </span>
      <Button variant="ghost" size="icon" onClick={handleNextMonth}>
        <ChevronRight className="h-6 w-6" />
      </Button>
    </div>
  );
}
