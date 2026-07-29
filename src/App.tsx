import { HashRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { CoursePage } from "@/pages/CoursePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { FingeringPage } from "@/pages/FingeringPage";
import { HymnLibraryPage } from "@/pages/HymnLibraryPage";
import { PracticePage } from "@/pages/PracticePage";
import { RecordsPage } from "@/pages/RecordsPage";
import { ServiceSetPage } from "@/pages/ServiceSetPage";

export default function App() {
  return (
    <HashRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/course" element={<CoursePage />} />
          <Route path="/fingering" element={<FingeringPage />} />
          <Route path="/hymns" element={<HymnLibraryPage />} />
          <Route path="/practice/:hymnKey" element={<PracticePage />} />
          <Route path="/service-set" element={<ServiceSetPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="*" element={<HymnLibraryPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
