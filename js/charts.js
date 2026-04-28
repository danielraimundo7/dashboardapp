import { state } from "./state.js";
import { toNumber, durationToHoursFromDisplay } from "./utils.js";

export function destroyCharts() {
  if (state.revenueLaborChart) {
    state.revenueLaborChart.destroy();
    state.revenueLaborChart = null;
  }

  if (state.assignedTimeChart) {
    state.assignedTimeChart.destroy();
    state.assignedTimeChart = null;
  }
}

export function buildMetricsByDate(filteredRows) {
  const grouped = {};

  filteredRows.forEach((row) => {
    const date = String(row.Date || "");
    if (!date) return;

    if (!grouped[date]) {
      grouped[date] = {
        revenue: 0,
        docs: 0,
        assignedTime: 0
      };
    }

    grouped[date].revenue += toNumber(row.GivenPrice);
    grouped[date].assignedTime += durationToHoursFromDisplay(row.DisplayDuration);

    if (row.Contract) grouped[date].docs += 1;
    if (row.Estimate) grouped[date].docs += 1;
    if (row.Invoice) grouped[date].docs += 1;
    if (row.Photos) grouped[date].docs += 1;
  });

  const labels = Object.keys(grouped).sort();

  return {
    labels,
    revenue: labels.map((d) => grouped[d].revenue),
    docs: labels.map((d) => grouped[d].docs),
    assignedTime: labels.map((d) => grouped[d].assignedTime)
  };
}

export function renderEventsCharts(filteredRows) {
  const revenueCanvas = document.getElementById("revenueLaborChart");
  const assignedCanvas = document.getElementById("assignedTimeChart");
  if (!revenueCanvas || !assignedCanvas) return;

  destroyCharts();

  const metrics = buildMetricsByDate(filteredRows);

  state.revenueLaborChart = new Chart(revenueCanvas, {
    type: "bar",
    data: {
      labels: metrics.labels,
      datasets: [
        { label: "Revenue", data: metrics.revenue },
        { label: "Linked Docs", data: metrics.docs }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  state.assignedTimeChart = new Chart(assignedCanvas, {
    type: "line",
    data: {
      labels: metrics.labels,
      datasets: [{ label: "Assigned Time (hrs)", data: metrics.assignedTime }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
