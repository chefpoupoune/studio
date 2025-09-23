"use client";

import PmsReports from "./components/PmsReports";

const FinDuMoisPage = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Ça y est, le mois est fini !  Il est l'heure de la Paperasse ! </h1>
      <PmsReports />
    </div>
  );
};

export default FinDuMoisPage;
