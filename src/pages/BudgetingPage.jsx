import { useState } from "react";
import BudgetDashboardPage from "./BudgetDashboardPage";
import BudgetPlanPage from "./BudgetPlanPage";
import BudgetRealizationPage from "./BudgetRealizationPage";
import BudgetRakListPage from "./BudgetRakListPage";
import BudgetTrackingPage from "./BudgetTrackingPage";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";
import {
  getOutlinedButtonStyle,
  getPanelStyle,
  getPrimaryButtonStyle,
} from "../lib/controlStyles";

export default function BudgetingPage() {
  const prefersDarkMode = usePrefersDarkMode();
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
      <section
        style={{
          ...getPanelStyle({ padding: 16, borderRadius: 12 }),
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSection("dashboard")}
          style={
            activeSection === "dashboard"
              ? getPrimaryButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  height: 38,
                  size: "sm",
                })
              : getOutlinedButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  height: 38,
                  size: "sm",
                })
          }
        >
          Ringkasan Anggaran
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("rak-list")}
          style={
            activeSection === "rak-list"
              ? getPrimaryButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  height: 38,
                  size: "sm",
                })
              : getOutlinedButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  height: 38,
                  size: "sm",
                })
          }
        >
          Versi RAK
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("plan")}
          style={
            activeSection === "plan"
              ? getPrimaryButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  height: 38,
                  size: "sm",
                })
              : getOutlinedButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  height: 38,
                  size: "sm",
                })
          }
        >
          Rencana Anggaran
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("realization")}
          style={
            activeSection === "realization"
              ? getPrimaryButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  height: 38,
                  size: "sm",
                })
              : getOutlinedButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  height: 38,
                  size: "sm",
                })
          }
        >
          Realisasi Anggaran
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("progress")}
          style={
            activeSection === "progress"
              ? getPrimaryButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  height: 38,
                  size: "sm",
                })
              : getOutlinedButtonStyle(prefersDarkMode, {
                  isEnabled: true,
                  height: 38,
                  size: "sm",
                })
          }
        >
          Monitoring Anggaran
        </button>
      </section>

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
