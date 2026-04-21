import { useState } from "react";
import BudgetDashboardPage from "./BudgetDashboardPage";
import BudgetPlanPage from "./BudgetPlanPage";
import BudgetProgressPage from "./BudgetProgressPage";
import BudgetRealizationPage from "./BudgetRealizationPage";
import BudgetWarningPage from "./BudgetWarningPage";
import { usePrefersDarkMode } from "../hooks/usePrefersDarkMode";
import {
  getOutlinedButtonStyle,
  getPanelStyle,
  getPrimaryButtonStyle,
} from "../lib/controlStyles";

export default function BudgetingPage() {
  const prefersDarkMode = usePrefersDarkMode();
  const [activeSection, setActiveSection] = useState("dashboard");

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
          Dashboard
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
          Rencana
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
          Realisasi
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
          Progress
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("warning")}
          style={
            activeSection === "warning"
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
          Warning
        </button>
      </section>

      {activeSection === "dashboard" ? <BudgetDashboardPage /> : null}
      {activeSection === "plan" ? <BudgetPlanPage /> : null}
      {activeSection === "progress" ? <BudgetProgressPage /> : null}
      {activeSection === "realization" ? <BudgetRealizationPage /> : null}
      {activeSection === "warning" ? <BudgetWarningPage /> : null}
    </div>
  );
}
