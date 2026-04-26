import { useState } from "react";
import BudgetDashboardPage from "./BudgetDashboardPage";
import BudgetPlanPage from "./BudgetPlanPage";
import BudgetRealizationPage from "./BudgetRealizationPage";
import BudgetRakListPage from "./BudgetRakListPage";
import BudgetTrackingPage from "./BudgetTrackingPage";
import { getPageTitleStyle } from "../lib/controlStyles";

const BUDGET_SECTIONS = [
  { key: "dashboard", label: "Ringkasan" },
  { key: "rak-list", label: "Versi RAK" },
  { key: "plan", label: "Rencana" },
  { key: "realization", label: "Realisasi" },
  { key: "progress", label: "Monitoring" },
];

export default function BudgetingPage() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [selectedRakVersionIdForDetail, setSelectedRakVersionIdForDetail] = useState("");

  function handleOpenVersionDetail(version) {
    if (!version?.id) {
      return;
    }

    setSelectedRakVersionIdForDetail(version.id);
    setActiveSection("plan");
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <h1 style={{ ...getPageTitleStyle(), margin: 0 }}>ANGGARAN</h1>
        <div
          style={{
            width: "1.5px",
            height: 28,
            backgroundColor: "var(--border-strong)",
            display: "block",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {BUDGET_SECTIONS.map((section) => {
            const isActive = activeSection === section.key;

            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`sub-page-button ${
                  isActive ? "sub-page-button--active" : "sub-page-button--inactive"
                }`}
                style={{
                  borderBottom: isActive
                    ? "2px solid var(--btn-primary-bg)"
                    : "2px solid transparent",
                  lineHeight: 1.5,
                }}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeSection === "dashboard" ? <BudgetDashboardPage /> : null}
      {activeSection === "rak-list" ? (
        <BudgetRakListPage onOpenVersionDetail={handleOpenVersionDetail} />
      ) : null}
      {activeSection === "plan" ? (
        <BudgetPlanPage forcedRakVersionId={selectedRakVersionIdForDetail} />
      ) : null}
      {activeSection === "progress" ? <BudgetTrackingPage /> : null}
      {activeSection === "realization" ? <BudgetRealizationPage /> : null}
    </div>
  );
}
