
export interface PdfLayoutSettings {
  logoUrl?: string;
  primaryColor?: string; // e.g., hex code like #RRGGBB
  headerText?: string;   // Text for the PDF header
  footerText?: string;   // Text for the PDF footer, can include placeholders like {pageNumber}, {totalPages}, {date}
}

