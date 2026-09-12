"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PmsReports = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rapports PMS</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Ici se trouveront les rapports PMS pour le mois sélectionné.</p>
      </CardContent>
    </Card>
  );
};

export default PmsReports;
