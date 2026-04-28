import { state } from "./state.js";

import {
  loadDashboardMetaFromApi,
  loadEventsFromApi,
  loadWorkersFromApi,
  loadJobsPerWorkerFromApi,
  loadTimeEntriesFromApi,
  updateLastSyncText
} from "./api.js";

import {
  getFilteredRowsByTab,
  getFilteredWorkers,
  initializeCalendarSelection
} from "./filters.js";

import { destroyCharts, renderEventsCharts } from "./charts.js";

import {
  renderEventsTab,
  renderJobsTab,
  renderTravelTab,
  updateSummaryCardsForEvents,
  updateSummaryCardsForTravel,
  setRouteBuilderCalendar,
  setRouteBuilderDate,
  buildRouteForSelectedCalendarAndDate,
  copyRouteStops,
  copyRouteTemplate
} from "./events.js";

import {
  renderWorkersTab,
  renderWorkerProfileView
} from "./workers.js";

import {
  renderTimeEntriesTab,
  openTimeEntryMap,
  closeTimeEntryMap
} from "./timeEntries.js";

import { copySelectedJobForWorkers } from "./copy.js";

/* =========================
   LOADING / ERROR UI
========================= */

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
          <div class="success-box">Loading ${label} data...</div>
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
          <div class="error-box">${message}</div>
        </div>
      </div>
    `;
  }
}

/* =========================
   RENDER CORE
========================= */

export function render() {
  const apiStatus = document.getElementById("apiStatus");

  if (state.currentTab === "timeEntries") {
    if (apiStatus) apiStatus.innerText = state.timeEntriesLoadedFromApi ? "Yes" : "No";
    destroyCharts();
    renderTimeEntriesTab();
    return;
  }

  if (state.currentTab === "workers") {
    if (apiStatus) apiStatus.innerText = state.workersLoadedFromApi ? "Yes" : "No";

    const filteredWorkers = getFilteredWorkers();
    destroyCharts();

    if (state.currentView === "workerProfile") {
      renderWorkerProfileView();
    } else {
      renderWorkersTab(filteredWorkers);
    }
    return;
  }

  if (state.currentTab === "sales") {
    if (apiStatus) apiStatus.innerText = "N/A";
    destroyCharts();
    renderSalesTab();
    return;
  }

  if (apiStatus) apiStatus.innerText = state.eventsLoadedFromApi ? "Yes" : "No";

  const filteredRows = getFilteredRowsByTab();

  if (state.currentTab === "travel") {
    updateSummaryCardsForTravel(filteredRows);
  } else {
    updateSummaryCardsForEvents(filteredRows);
  }

  if (!state.chartsMinimized && filteredRows.length > 0) {
    renderEventsCharts(filteredRows);
  } else {
    destroyCharts();
  }

  if (!state.selectedEvent && filteredRows.length > 0) {
    state.selectedEvent = filteredRows[0];
  }

  if (state.currentTab === "travel") renderTravelTab(filteredRows);
  else if (state.currentTab === "jobs") renderJobsTab(filteredRows);
  else renderEventsTab(filteredRows);
}

/* =========================
   REFRESH FUNCTIONS
========================= */

async function refreshEvents() {
  try {
    state.eventsLoadedFromApi = false;
    state.eventsData = [];
    state.selectedEvent = null;

    renderLoadingState("Events");

    await Promise.all([
      loadEventsFromApi(),
      loadDashboardMetaFromApi()
    ]);

    initializeCalendarSelection();
    render();
  } catch (error) {
    renderErrorState(error.message);
  }
}

async function refreshWorkers() {
  try {
    state.workersLoadedFromApi = false;
    state.workers = [];

    renderLoadingState("Workers");

    await Promise.all([
      loadWorkersFromApi(),
      loadDashboardMetaFromApi()
    ]);

    render();
  } catch (error) {
    renderErrorState(error.message);
  }
}

async function refreshTimeEntries() {
  try {
    state.timeEntriesLoadedFromApi = false;
    state.timeEntries = [];
    state.selectedTimeEntry = null;
    state.timeEntryMapOpen = false;

    renderLoadingState("Time Entries");

    await Promise.all([
      loadTimeEntriesFromApi(),
      loadDashboardMetaFromApi()
    ]);

    render();
  } catch (error) {
    renderErrorState(error.message);
  }
}

/* =========================
   TAB SWITCHING
========================= */

function setTab(tab, event) {
  state.currentTab = tab;
  state.currentView = "main";

  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (event && event.target) {
    event.target.classList.add("active");
  }

  if ((tab === "events" || tab === "jobs" || tab === "travel") && !state.eventsLoadedFromApi) {
    refreshEvents();
    return;
  }

  if (tab === "workers" && !state.workersLoadedFromApi) {
    refreshWorkers();
    return;
  }

  if (tab === "timeEntries" && !state.timeEntriesLoadedFromApi) {
    refreshTimeEntries();
    return;
  }

  render();
}

/* =========================
   GLOBAL ACTIONS
========================= */

function clearFilters() {
  ["search", "startDate", "endDate", "workerSearch"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  render();
}

function toggleChartsVisibility() {
  state.chartsMinimized = !state.chartsMinimized;
  render();
}

/* =========================
   TIME ENTRY MAP HANDLERS
========================= */

window.openTimeEntryMapByFilteredIndex = (index) => {
  const rows = state.timeEntries;
  openTimeEntryMap(rows[index]);
  render();
};

window.openTimeEntryMapByOpenIndex = (index) => {
  const openRows = state.timeEntries.filter(
    (r) => String(r.Status).toUpperCase() === "OPEN"
  );
  openTimeEntryMap(openRows[index]);
  render();
};

window.closeTimeEntryMap = () => {
  closeTimeEntryMap();
  render();
};

/* =========================
   ROUTE BUILDER
========================= */

window.setRouteBuilderCalendar = (value) => {
  setRouteBuilderCalendar(value);
};

window.setRouteBuilderDate = (value) => {
  setRouteBuilderDate(value);
};

window.buildRouteAndRender = () => {
  buildRouteForSelectedCalendarAndDate();
  render();
};

window.openBuiltRouteInMaps = () => {
  if (state.routeBuilder.mapsUrl) {
    window.open(state.routeBuilder.mapsUrl, "_blank");
  }
};

window.copyBuiltRouteStops = async () => {
  await copyRouteStops();
  render();
};

window.copyBuiltRouteTemplate = async () => {
  await copyRouteTemplate();
  render();
};

/* =========================
   WORKER PROFILE
========================= */

window.openWorkerProfile = async () => {
  if (!state.selectedWorker) return;

  state.currentView = "workerProfile";

  if (!state.jobsPerWorkerLoadedFromApi) {
    await loadJobsPerWorkerFromApi();
  }

  render();
};

window.closeWorkerProfile = () => {
  state.currentView = "main";
  render();
};

/* =========================
   EXPORT GLOBALS
========================= */

window.setTab = setTab;
window.refreshCurrentTab = () => {
  if (state.currentTab === "workers") refreshWorkers();
  else if (state.currentTab === "timeEntries") refreshTimeEntries();
  else refreshEvents();
};

window.clearFilters = clearFilters;
window.toggleChartsVisibility = toggleChartsVisibility;
window.refreshEvents = refreshEvents;
window.refreshWorkers = refreshWorkers;
window.refreshTimeEntries = refreshTimeEntries;

window.copySelectedJobForWorkers = () => copySelectedJobForWorkers(render);

/* =========================
   INIT
========================= */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadDashboardMetaFromApi();
  } catch (e) {
    updateLastSyncText();
  }

  refreshEvents();
});
