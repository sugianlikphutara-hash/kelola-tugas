import { getTableCellCompactTypography } from "../../lib/controlStyles";

const FILTER_SELECT_HEIGHT = 41;
const FILTER_GRID_CONFIG = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", // Dipersempit agar muat 4 kolom sebaris
  gap: 12,
  alignItems: "stretch",
  flex: "1 1 auto", // Menyesuaikan lebar dinamis bersama wrapper
};
const FILTER_CONTAINER_CONFIG = {
  display: "flex",
  gap: 16,
  alignItems: "flex-start", // Menjaga agar sejajar meski tombol beda tinggi
  flexWrap: "wrap", // Pada layar HP akan tetap turun dengan rapi
};
const FILTER_BUTTON_GROUP_CONFIG = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap", // Membiarkan tombol teratur jika layar mengecil
  alignItems: "stretch",
  paddingBottom: 2,
};

export default function DailySubTaskFilterBar({
  dailySubActivityFilter,
  setDailySubActivityFilter,
  dailySubActivityOptions,
  dailyActionPlanFilter,
  setDailyActionPlanFilter,
  dailyActionPlanOptions,
  dailyAssigneeFilter,
  setDailyAssigneeFilter,
  dailyAssigneeOptions,
  dailyReviewStatusFilter,
  setDailyReviewStatusFilter,
  dailyReviewStatusOptions,
  onResetFilters,
  isResetEnabled,
  onExpandAll,
  isExpandEnabled,
  onCollapseAll,
  isCollapseEnabled,
}) {

  return (
    <div style={FILTER_CONTAINER_CONFIG}>
      <div style={FILTER_GRID_CONFIG}>
        <select
          value={dailySubActivityFilter}
          onChange={(event) => setDailySubActivityFilter(event.target.value)}
          className="filter-select"
          style={{ height: FILTER_SELECT_HEIGHT }}
          aria-label="Filter Sub Kegiatan"
        >
          <option value="ALL">Semua Sub Kegiatan</option>
          {dailySubActivityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          value={dailyActionPlanFilter}
          onChange={(event) => setDailyActionPlanFilter(event.target.value)}
          className="filter-select"
          style={{ height: FILTER_SELECT_HEIGHT }}
          aria-label="Filter Rencana Aksi"
        >
          <option value="ALL">Semua Rencana Aksi</option>
          {dailyActionPlanOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          value={dailyAssigneeFilter}
          onChange={(event) => setDailyAssigneeFilter(event.target.value)}
          className="filter-select"
          style={{ height: FILTER_SELECT_HEIGHT }}
          aria-label="Filter Pelaksana"
        >
          <option value="ALL">Semua Pelaksana</option>
          {dailyAssigneeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          value={dailyReviewStatusFilter}
          onChange={(event) => setDailyReviewStatusFilter(event.target.value)}
          className="filter-select"
          style={{ height: FILTER_SELECT_HEIGHT }}
          aria-label="Filter Status Pemeriksaan"
        >
          <option value="ALL">Semua Status Pemeriksaan</option>
          {dailyReviewStatusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div style={FILTER_BUTTON_GROUP_CONFIG}>
        <button
          type="button"
          className={`btn-specific-action ${isResetEnabled ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
          onClick={onResetFilters}
          disabled={!isResetEnabled}
          style={{
            height: FILTER_SELECT_HEIGHT,
            ...getTableCellCompactTypography({ fontSize: 13, fontWeight: 600 }),
            padding: "8px 12px",
          }}
        >
          Reset Filter
        </button>

        <button
          type="button"
          className={`btn-specific-action ${isExpandEnabled ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
          onClick={onExpandAll}
          disabled={!isExpandEnabled}
          style={{
            height: FILTER_SELECT_HEIGHT,
            ...getTableCellCompactTypography({ fontSize: 13, fontWeight: 600 }),
            padding: "8px 12px",
          }}
        >
          Expand All
        </button>

        <button
          type="button"
          className={`btn-specific-action ${isCollapseEnabled ? "btn-specific-action-enabled" : "btn-specific-action-disabled"}`}
          onClick={onCollapseAll}
          disabled={!isCollapseEnabled}
          style={{
            height: FILTER_SELECT_HEIGHT,
            ...getTableCellCompactTypography({ fontSize: 13, fontWeight: 600 }),
            padding: "8px 12px",
          }}
        >
          Collapse All
        </button>
      </div>
    </div>
  );
}
