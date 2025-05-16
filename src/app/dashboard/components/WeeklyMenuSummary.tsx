
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export default function WeeklyMenuSummary() {
  // Placeholder data - replace with actual data fetching and logic
  const weekStartDate = "Lundi 15 Juillet";
  const weekEndDate = "Dimanche 21 Juillet";

  const placeholderMenu = [
    { day: "Lundi", main: "Poulet rôti, Pommes de terre" },
    { day: "Mardi", main: "Saumon à l'aneth, Riz" },
    { day: "Mercredi", main: "Lasagnes végétariennes" },
    // ... add more days or a message if no menu
  ];

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Menu de la Semaine
          </CardTitle>
          {/* Optional: Add a link to the full menu planning page */}
          {/* <Link href="/dashboard/menu-planning" className="text-xs text-primary hover:underline">Voir plus</Link> */}
        </div>
        <CardDescription className="text-xs">
          Aperçu du {weekStartDate} au {weekEndDate}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        {placeholderMenu.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {placeholderMenu.slice(0, 4).map((item) => ( // Show first 4 items
              <li key={item.day} className="flex">
                <span className="font-medium w-20 shrink-0">{item.day}:</span>
                <span className="text-muted-foreground truncate" title={item.main}>{item.main}</span>
              </li>
            ))}
            {placeholderMenu.length > 4 && <li className="text-xs text-muted-foreground text-center pt-1">... et plus.</li>}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Le menu de la semaine sera affiché ici.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
