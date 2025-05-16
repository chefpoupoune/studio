
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function OngoingTasksSummary() {
  // Placeholder data - replace with actual data fetching and logic
  const ongoingTasks = [
    { id: "1", title: "Réparation fuite évier cuisine", status: "En cours" },
    { id: "2", title: "Contrôle extincteurs", status: "Rendez-vous" },
    { id: "3", title: "Nettoyage hotte", status: "Mr Dufay prévenue" },
    // ... add more tasks or a message if no tasks
  ];

  const highPriorityTasksCount = ongoingTasks.filter(task => task.status === "En cours" || task.status === "Rendez-vous").length;

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Tâches en Cours
          </CardTitle>
          {highPriorityTasksCount > 0 && (
             <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5"/> {highPriorityTasksCount} Urgente(s)
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Suivi rapide des problèmes et tâches actives.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        {ongoingTasks.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {ongoingTasks.slice(0, 4).map((task) => ( // Show first 4 tasks
              <li key={task.id} className="flex justify-between items-center">
                <span className="truncate pr-2" title={task.title}>{task.title}</span>
                <Badge variant={task.status === "En cours" ? "warning" : task.status === "Rendez-vous" ? "info" : "secondary"} className="text-xs whitespace-nowrap">
                  {task.status}
                </Badge>
              </li>
            ))}
             {ongoingTasks.length > 4 && <li className="text-xs text-muted-foreground text-center pt-1">... et plus.</li>}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune tâche en cours actuellement.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
