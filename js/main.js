import { state } from "./state.js";
import {
  loadDashboardMetaFromApi,
  loadEventsFromApi,
  loadWorkersFromApi,
  loadJobsPerWorkerFromApi,
  updateLastSyncText
} from "./api.js";
import {
  getUniqueCalendars,
  initializeCalendarSelection,
  getFilteredRowsByTab,
  getFilteredWorkers
} from "./filters.js";
import { destroyCharts, renderEventsCharts } from "./charts.js";
import {
  renderEventsTab,
  renderJobsTab,
  renderTravelTab,
  updateSummaryCardsForEvents,
  updateSummaryCardsForTravel
} from "./events.js";
import { renderWorkersTab, renderWorkerProfileView } from "./workers.js";
import { copySelectedJobForWorkers } from "./copy.js";

function renderLoadingState(label) {
  const apiStatus = document.getElementById("apiStatus");
  if (apiStatus) apiStatus.innerText = "Loading...";

  const content = document.getElementById("content");
  if (content) {
    content.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h2 class="text-2xl font-semibold">${label}</h2>
        </div>
        <div class="panel-body">
          <div class="success-box">Loading ${label} data from Apps Script...</div>
        </div>
      </div>
    `;
  }
}

function renderErrorState(message) {
  const apiStatus = document.getElementById("apiStatus");
  if (apiStatus) apiStatus.innerText = "Error";

  const content = document.getElementById("content");
  if (content) {
    content.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h2 class="text-2xl font-semibold">Error</h2>
        </div>
        <div class="panel-body">
          <div class="error-box">
            <span class="text-sm">${message}</span>
          </div>
        </div>
      </div>
    `;
  }
}

function applyChartsVisibility() {
  const chartsShell = document.getElementById("dashboardChartsShell");
  const charts = document.getElementById("dashboardCharts");
  const btn = document.getElementById("toggleChartsBtn");

  const shouldShowShell =
    (state.currentTab === "events" || state.currentTab === "jobs" || state.currentTab === "travel") &&
    state.currentView === "main";

  if (chartsShell) chartsShell.classList.toggle("hidden", !shouldShowShell);
  if (charts) charts.classList.toggle("hidden", !shouldShowShell || state.chartsMinimized);
  if (btn) btn.innerText = state.chartsMinimized ? "Show Graphs" : "Hide Graphs";

  if (!shouldShowShell || state.chartsMinimized) destroyCharts();
}

function toggleFilterGroups() {
  const eventFilters = document.getElementById("eventFilters");
  const workersFilters = document.getElementById("workersFilters");
  const primaryCountLabel = document.getElementById("primaryCountLabel");

  const showEventFilters = ["events", "jobs", "travel"].includes(state.currentTab) && state.currentView === "main";

  if (eventFilters) eventFilters.classList.toggle("hidden", !showEventFilters);
  if (workersFilters) workersFilters.classList.toggle("hidden", state.currentTab !== "workers" || state.currentView !== "main");

  if (primaryCountLabel) {
    if (state.currentTab === "workers") primaryCountLabel.innerText = "Workers";
    else if (state.currentTab === "travel") primaryCountLabel.innerText = "Travel";
    else if (state.currentTab === "jobs") primaryCountLabel.innerText = "Jobs";
    else if (state.currentTab === "sales") primaryCountLabel.innerText = "Sales";
    else primaryCountLabel.innerText = "Events";
  }

  applyChartsVisibility();
}

function renderCalendarChecklist() {
  const container = document.getElementById("calendarMultiSelect");
  if (!container) return;

  const calendars = getUniqueCalendars();

  container.innerHTML = calendars
    .map((calendar) => `
      <label class="dropdown-item">
        <input
          type="checkbox"
          value="${calendar}"
          ${state.selectedCalendars.has(calendar) ? "checked" : ""}
          onchange="window.toggleCalendarSelection(this.value, this.checked)"
        />
        <span>${calendar}</span>
      </label>
    `)
    .join("");
}

function updateCalendarButtonLabel() {
  const btn = document.getElementById("calendarDropdownButton");
  if (!btn) return;

  const total = getUniqueCalendars().length;
  const selected = state.selectedCalendars.size;

  if (selected === 0) btn.innerText = "Calendars (0)";
  else if (selected === total) btn.innerText = "All Calendars";
  else if (selected === 1) btn.innerText = [...state.selectedCalendars][0];
  else btn.innerText = `Calendars (${selected})`;
}

function renderSalesTab() {
  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h2 class="text-2xl font-semibold">Sales</h2>
      </div>
      <div class="panel-body">
        <div class="success-box mb-4">Sales tab created successfully.</div>
        <div class="blank-state-box">
          <h3 class="text-lg font-semibold mb-2">Coming Soon</h3>
          <p class="text-slate-600">
            Later, this page can hold booked revenue, serviced revenue, rep performance,
            commissions, and close-rate reporting.
          </p>
        </div>
      </div>
    </div>
  `;
}

function updateSummaryCardsForWorkers(filteredWorkers) {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  if (countEl) countEl.innerText = filteredWorkers.length;
  if (revenueEl) revenueEl.innerText = "-";
  if (laborEl) laborEl.innerText = "-";
  if (assignedEl) assignedEl.innerText = "-";
}

function updateSummaryCardsForSales() {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  if (countEl) countEl.innerText = "-";
  if (revenueEl) revenueEl.innerText = "-";
  if (laborEl) laborEl.innerText = "-";
  if (assignedEl) assignedEl.innerText = "-";
}

export function render() {
  toggleFilterGroups();

  const apiStatus = document.getElementById("apiStatus");
  if (apiStatus) {
    if (state.currentTab === "workers") apiStatus.innerText = state.workersLoadedFromApi ? "Yes" : "No";
    else if (state.currentTab === "sales") apiStatus.innerText = "N/A";
    else apiStatus.innerText = state.eventsLoadedFromApi ? "Yes" : "No";
  }

  if (state.currentTab === "workers") {
    const filteredWorkers = getFilteredWorkers();
    updateSummaryCardsForWorkers(filteredWorkers);
    destroyCharts();

    if (state.currentView === "workerProfile") renderWorkerProfileView();
    else renderWorkersTab(filteredWorkers);
    return;
  }

  if (state.currentTab === "sales") {
    updateSummaryCardsForSales();
    destroyCharts();
    renderSalesTab();
    return;
  }

  renderCalendarChecklist();
  updateCalendarButtonLabel();

  const filteredRows = getFilteredRowsByTab();

  if (state.currentTab === "travel") updateSummaryCardsForTravel(filteredRows);
  else updateSummaryCardsForEvents(filteredRows);

  if (!state.chartsMinimized && filteredRows.length > 0) renderEventsCharts(filteredRows);
  else destroyCharts();

  if (!state.selectedEvent && filteredRows.length > 0) {
    state.selectedEvent = filteredRows[0];
  }

  if (state.currentTab === "travel") renderTravelTab(filteredRows);
  else if (state.currentTab === "jobs") renderJobsTab(filteredRows);
  else renderEventsTab(filteredRows);
}

async function refreshEvents() {
  try {
    state.eventsLoadedFromApi = false;
    state.eventsData = [];
    state.selectedEvent = null;
    state.copyStatusMessage = "";
    state.eventDetailOpen = false;

    renderLoadingState("Events");
    await Promise.all([loadEventsFromApi(), loadDashboardMetaFromApi()]);
    initializeCalendarSelection();
    render();
  } catch (error) {
    console.error("Error loading Events:", error);
    renderErrorState(error.message || "Unknown error while loading Events.");
  }
}

async function refreshWorkers() {
  try {
    state.workersLoadedFromApi = false;
    state.workers = [];
    state.selectedWorker = null;

    renderLoadingState("Workers");
    await Promise.all([loadWorkersFromApi(), loadDashboardMetaFromApi()]);
    render();
  } catch (error) {
    console.error("Error loading Workers:", error);
    renderErrorState(error.message || "Unknown error while loading Workers.");
  }
}

function setTab(tab, event) {
  state.currentTab = tab;
  state.currentView = "main";
  state.copyStatusMessage = "";
  state.eventDetailOpen = false;

  document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
  if (event && event.target) event.target.classList.add("active");

  toggleFilterGroups();

  if ((tab === "events" || tab === "jobs" || tab === "travel") && !state.eventsLoadedFromApi) {
    refreshEvents();
    return;
  }

  if (tab === "workers" && !state.workersLoadedFromApi) {
    refreshWorkers();
    return;
  }

  render();
}

function toggleChartsVisibility() {
  state.chartsMinimized = !state.chartsMinimized;
  applyChartsVisibility();
  render();
}

function toggleCalendarDropdown() {
  const dropdown = document.getElementById("calendarDropdown");
  const button = document.getElementById("calendarDropdownButton");
  if (!dropdown || !button) return;

  const willOpen = dropdown.classList.contains("hidden");
  dropdown.classList.toggle("hidden");
  button.setAttribute("aria-expanded", String(willOpen));
}

function toggleCalendarSelection(calendarName, isChecked) {
  if (isChecked) state.selectedCalendars.add(calendarName);
  else state.selectedCalendars.delete(calendarName);

  updateCalendarButtonLabel();
  render();
}

function selectAllCalendars() {
  getUniqueCalendars().forEach((name) => state.selectedCalendars.add(name));
  renderCalendarChecklist();
  updateCalendarButtonLabel();
  render();
}

function clearCalendarSelection() {
  state.selectedCalendars.clear();
  renderCalendarChecklist();
  updateCalendarButtonLabel();
  render();
}

function clearFilters() {
  const ids = ["search", "startDate", "endDate", "workerSearch"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const workerActiveFilter = document.getElementById("workerActiveFilter");
  if (workerActiveFilter) workerActiveFilter.value = "";

  if (["events", "jobs", "travel"].includes(state.currentTab)) {
    selectAllCalendars();
    return;
  }

  render();
}

function selectEventByFilteredIndex(index) {
  const filteredRows = getFilteredRowsByTab();
  state.selectedEvent = filteredRows[index] || null;
  state.copyStatusMessage = "";
  state.eventDetailOpen = !!state.selectedEvent;
  render();
}

function closeEventDetail() {
  state.eventDetailOpen = false;
  state.copyStatusMessage = "";
  render();
}

function selectWorkerByFilteredIndex(index) {
  const filteredWorkers = getFilteredWorkers();
  state.selectedWorker = filteredWorkers[index] || null;
  render();
}

async function openWorkerProfile() {
  if (!state.selectedWorker) return;

  try {
    state.currentView = "workerProfile";
    toggleFilterGroups();
    renderLoadingState("Worker Profile");

    if (!state.jobsPerWorkerLoadedFromApi) {
      await loadJobsPerWorkerFromApi();
    }

    render();
  } catch (error) {
    console.error("Error loading worker profile:", error);
    renderErrorState(error.message || "Unknown error while loading Worker Profile.");
  }
}

function closeWorkerProfile() {
  state.currentView = "main";
  toggleFilterGroups();
  render();
}

function refreshCurrentTab() {
  if (state.currentTab === "workers") {
    if (state.currentView === "workerProfile") {
      state.jobsPerWorkerLoadedFromApi = false;
      state.jobsPerWorker = [];
    }
    refreshWorkers();
    return;
  }

  if (state.currentTab === "sales") {
    render();
    return;
  }

  refreshEvents();
}

window.setTab = setTab;
window.toggleChartsVisibility = toggleChartsVisibility;
window.toggleCalendarDropdown = toggleCalendarDropdown;
window.toggleCalendarSelection = toggleCalendarSelection;
window.selectAllCalendars = selectAllCalendars;
window.clearCalendarSelection = clearCalendarSelection;
window.clearFilters = clearFilters;
window.selectEventByFilteredIndex = selectEventByFilteredIndex;
window.closeEventDetail = closeEventDetail;
window.selectWorkerByFilteredIndex = selectWorkerByFilteredIndex;
window.openWorkerProfile = openWorkerProfile;
window.closeWorkerProfile = closeWorkerProfile;
window.refreshCurrentTab = refreshCurrentTab;
window.refreshEvents = refreshEvents;
window.refreshWorkers = refreshWorkers;
window.copySelectedJobForWorkers = () => copySelectedJobForWorkers(render);

document.addEventListener("click", function (e) {
  const dropdown = document.getElementById("calendarDropdown");
  const button = document.getElementById("calendarDropdownButton");

  if (!dropdown || !button) return;
  if (dropdown.classList.contains("hidden")) return;

  if (!dropdown.contains(e.target) && !button.contains(e.target)) {
    dropdown.classList.add("hidden");
    button.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const searchInput = document.getElementById("search");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  const workerSearch = document.getElementById("workerSearch");
  const workerActiveFilter = document.getElementById("workerActiveFilter");

  if (searchInput) searchInput.addEventListener("input", render);
  if (startDateInput) startDateInput.addEventListener("change", render);
  if (endDateInput) endDateInput.addEventListener("change", render);
  if (workerSearch) workerSearch.addEventListener("input", render);
  if (workerActiveFilter) workerActiveFilter.addEventListener("change", render);

  toggleFilterGroups();

  try {
    await loadDashboardMetaFromApi();
  } catch (error) {
    console.error("Could not load dashboard meta:", error);
    updateLastSyncText();
  }

  refreshEvents();
});