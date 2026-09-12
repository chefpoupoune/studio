
import * as XLSX from 'xlsx';
import { StoredPicnicMenuTemplate, PICNIC_MENU_DAY_KEYS, PICNIC_MENU_DAYS_LABELS } from '../types';

export const generatePicnicMenuExcel = (templates: StoredPicnicMenuTemplate[], monthLabel: string) => {
  const wb = XLSX.utils.book_new();

  templates.forEach((template, index) => {
    const wsData: any[][] = [];
    const weekNumber = index + 1;
    
    // Header row with day labels
    const header = PICNIC_MENU_DAY_KEYS.map(dayKey => PICNIC_MENU_DAYS_LABELS[dayKey]);
    wsData.push(header);

    // Menu items rows
    const numRows = template.days.lundi.length;
    for (let i = 0; i < numRows; i++) {
      const row: string[] = [];
      PICNIC_MENU_DAY_KEYS.forEach(dayKey => {
        row.push(template.days[dayKey][i] || '');
      });
      wsData.push(row);
    }

    // Add weekly note
    wsData.push([]); // spacer
    wsData.push(["Note de la semaine:", template.weeklyNote]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, `Semaine ${weekNumber}`);
  });

  XLSX.writeFile(wb, `Menu_Pique_Nique_${monthLabel}.xlsx`);
};
