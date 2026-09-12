import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function openPdfInNewTab(pdfBlob: Blob, fileName: string) {
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getInitials(name: string): string {
  if (!name) return '';
  const words = name.split(' ').filter(Boolean);
  if (words.length === 0) return '';
  const firstInitial = words[0][0];
  const lastInitial = words.length > 1 ? words[words.length - 1][0] : '';
  return (firstInitial + lastInitial).toUpperCase();
}
