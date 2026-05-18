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

import {
  renderFinanceTab,
  setFinanceFilter,
  clearFinanceFilters
} from "./finance.js";

import { destroyCharts, renderEventsCharts } from "./charts.js";

import {
  renderEventsTab,
  renderJobsTab,
  renderTravelTab,
  updateSummaryCardsForEvents,
  updateSummaryCardsForTravel,
  setRouteBuilderCalendar,
  setRouteBuilderDate,
  setTravelRouteMode,
  toggleRouteStopSelection,
  buildRouteForSelectedCalendarAndDate,
  copyRouteStops,
  copyRouteTemplate,
  setTravelLogWorkerName,
  setTravelLogWorkerId,
  setTravelLogWorkerRole,
  setTravelLogHourlyRate,
  setTravelLogMileageRate,
  setTravelTotalMiles,
  setTravelTotalDriveMinutes,
  setTravelFreeMinutesPerLeg,
  selectTravelLogWorkerFromSearch,
  copyTravelLogTitle,
  copyTravelLogBody,
  generateTravelLogForRouteBuilder,
  copyTravelLog
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

import {
  renderReportsTab,
  setReportsWeekStartDate,
  setReportsSelectedWorkerId,
  generateWeeklyReports
} from "./reports.js";



import { copySelectedJobForWorkers } from "./copy.js";

import {
  renderFieldMapTab,
  setFieldMapDate,
  showFieldMapOpenOnly,
  showFieldMapToday
} from "./fieldMap.js";

import {
  renderEventBuilderTab,
  setEventBuilderField,
  setEventBuilderEventType,
  setEventBuilderWorker,
  addEventBuilderWorker,
  removeEventBuilderWorker,
  copyEventBuilderTitle,
  copyEventBuilderNotes,
  copyEventBuilderBoth
} from "./eventBuilder.js";


function setEventBuilderEventTypeAndRender(value) {
  setEventBuilderEventType(value);
  render();
}

function setEventBuilderFieldAndRender(key, value) {
  setEventBuilderField(key, value);
}

function setEventBuilderWorkerAndRender(index, key, value) {
  setEventBuilderWorker(index, key, value);
}

function addEventBuilderWorkerAndRender() {
  addEventBuilderWorker();
  render();
}

function removeEventBuilderWorkerAndRender(index) {
  removeEventBuilderWorker(index);
  render();
}

async function copyEventBuilderTitleAndRender() {
  await copyEventBuilderTitle();
  render();
}

async function copyEventBuilderNotesAndRender() {
  await copyEventBuilderNotes();
  render();
}

async function copyEventBuilderBothAndRender() {
  await copyEventBuilderBoth();
  render();
}

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

function updateSummaryCardsForReports() {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  const reports = state.reports.generatedReports || [];
  const rowCount = reports.reduce((sum, report) => sum + report.rows.length, 0);
  const totalPay = reports.reduce((sum, report) => sum + Number(report.totals.totalPay || 0), 0);
  const totalWorked = reports.reduce((sum, report) => sum + Number(report.totals.workedHours || 0), 0);
  const totalAssigned = reports.reduce((sum, report) => sum + Number(report.totals.assignedHours || 0), 0);

  if (countEl) countEl.innerText = rowCount;
  if (revenueEl) revenueEl.innerText = totalPay.toLocaleString("en-US", { style: "currency", currency: "USD" });
  if (laborEl) laborEl.innerText = totalWorked.toFixed(2);
  if (assignedEl) assignedEl.innerText = totalAssigned.toFixed(2);
}

function applyChartsVisibility() {
  const chartsShell = document.getElementById("dashboardChartsShell");
  const charts = document.getElementById("dashboardCharts");
  const btn = document.getElementById("toggleChartsBtn");

  const shouldShowShell =
    ["events", "jobs", "travel"].includes(state.currentTab) &&
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

  const showEventFilters =
    ["events", "jobs", "travel", "timeEntries"].includes(state.currentTab) &&
    state.currentView === "main";

  if (eventFilters) eventFilters.classList.toggle("hidden", !showEventFilters);

  if (workersFilters) {
    workersFilters.classList.toggle(
      "hidden",
      state.currentTab !== "workers" || state.currentView !== "main"
    );
  }

  if (primaryCountLabel) {
    if (state.currentTab === "workers") primaryCountLabel.innerText = "Workers";
    else if (state.currentTab === "travel") primaryCountLabel.innerText = "Travel";
    else if (state.currentTab === "jobs") primaryCountLabel.innerText = "Jobs";
    else if (state.currentTab === "sales") primaryCountLabel.innerText = "Sales";
    else if (state.currentTab === "timeEntries") primaryCountLabel.innerText = "Time Entries";
    else if (state.currentTab === "reports") primaryCountLabel.innerText = "Report Rows";
    else primaryCountLabel.innerText = "Events";
  }

  applyChartsVisibility();
}

function restoreColumnFilterFocus() {
  if (!state.activeColumnFilterInput) return;

  requestAnimationFrame(() => {
    const selector = `[data-filter-tab="${state.activeColumnFilterInput.tab}"][data-filter-key="${state.activeColumnFilterInput.key}"]`;
    const input = document.querySelector(selector);
    if (!input) return;

    input.focus();

    const valueLength = String(input.value || "").length;
    try {
      input.setSelectionRange(valueLength, valueLength);
    } catch (_) {}

    const wrap = document.querySelector(".table-scroll-wrap");
    if (wrap) wrap.scrollLeft = state.tableScrollLeft || 0;
  });
}

export function render() {
  toggleFilterGroups();

  const apiStatus = document.getElementById("apiStatus");

  if (state.currentTab === "timeEntries") {
    if (apiStatus) apiStatus.innerText = state.timeEntriesLoadedFromApi ? "Yes" : "No";
    destroyCharts();
    renderTimeEntriesTab();
    return;
  }

  if (state.currentTab === "reports") {
    if (apiStatus) {
      apiStatus.innerText =
        state.workersLoadedFromApi && state.jobsPerWorkerLoadedFromApi && state.timeEntriesLoadedFromApi
          ? "Yes"
          : "No";
    }

    updateSummaryCardsForReports();
    destroyCharts();
    renderReportsTab();
    return;
  }

if (state.currentTab === "finance") {
  if (apiStatus) apiStatus.innerText = state.eventsLoadedFromApi ? "Yes" : "No";

  destroyCharts();
  renderFinanceTab();
  return;
}

if (state.currentTab === "fieldMap") {
  if (apiStatus) {
    apiStatus.innerText = state.timeEntriesLoadedFromApi ? "Yes" : "No";
  }

  destroyCharts();
  renderFieldMapTab();
  return;
}


if (state.currentTab === "eventBuilder") {
  if (apiStatus) apiStatus.innerText = "Builder";

  destroyCharts();
  renderEventBuilderTab();
  return;
}


  if (state.currentTab === "workers") {
    if (apiStatus) apiStatus.innerText = state.workersLoadedFromApi ? "Yes" : "No";

    const filteredWorkers = getFilteredWorkers();
    updateSummaryCardsForWorkers(filteredWorkers);
    destroyCharts();

    if (state.currentView === "workerProfile") renderWorkerProfileView();
    else renderWorkersTab(filteredWorkers);

    restoreColumnFilterFocus();
    return;
  }

  if (state.currentTab === "sales") {
    if (apiStatus) apiStatus.innerText = "N/A";
    updateSummaryCardsForSales();
    destroyCharts();
    renderSalesTab();
    return;
  }

  if (apiStatus) apiStatus.innerText = state.eventsLoadedFromApi ? "Yes" : "No";

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

  restoreColumnFilterFocus();
}

async function refreshEvents() {
  try {
    state.eventsLoadedFromApi = false;
    state.eventsData = [];
    state.selectedEvent = null;
    state.copyStatusMessage = "";
    state.eventDetailOpen = false;

    renderLoadingState("Events");

    const requests = [
      loadEventsFromApi(),
      loadDashboardMetaFromApi()
    ];

    if (!state.workersLoadedFromApi) {
      requests.push(loadWorkersFromApi());
    }

    await Promise.all(requests);

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

    await Promise.all([
      loadWorkersFromApi(),
      loadDashboardMetaFromApi()
    ]);

    render();
  } catch (error) {
    console.error("Error loading Workers:", error);
    renderErrorState(error.message || "Unknown error while loading Workers.");
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
    console.error("Error loading Time Entries:", error);
    renderErrorState(error.message || "Unknown error while loading Time Entries.");
  }
}

async function refreshReports() {
  try {
    renderLoadingState("Reports");

    const requests = [loadDashboardMetaFromApi()];

    if (!state.workersLoadedFromApi) {
      requests.push(loadWorkersFromApi());
    }

    if (!state.jobsPerWorkerLoadedFromApi) {
      requests.push(loadJobsPerWorkerFromApi());
    }

    if (!state.timeEntriesLoadedFromApi) {
      requests.push(loadTimeEntriesFromApi());
    }

    await Promise.all(requests);

    render();
  } catch (error) {
    console.error("Error loading Reports:", error);
    renderErrorState(error.message || "Unknown error while loading Reports.");
  }
}

function setTab(tab, event) {
  state.currentTab = tab;
  state.currentView = "main";
  state.copyStatusMessage = "";
  state.eventDetailOpen = false;
  state.timeEntryMapOpen = false;
  state.activeColumnFilterInput = null;

  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (event && event.target) {
    event.target.classList.add("active");
  }

  toggleFilterGroups();

  if (["events", "jobs", "travel", "finance"].includes(tab) && !state.eventsLoadedFromApi) {
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

  if (tab === "fieldMap" && !state.timeEntriesLoadedFromApi) {
  refreshTimeEntries();
  return;
}

  if (tab === "reports") {
    const needsReportsData =
      !state.workersLoadedFromApi ||
      !state.jobsPerWorkerLoadedFromApi ||
      !state.timeEntriesLoadedFromApi;

    if (needsReportsData) {
      refreshReports();
      return;
    }
  }

  if (tab === "eventBuilder" && !state.workersLoadedFromApi) {
  refreshWorkers();
  return;
}
  

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

  if (state.currentTab === "timeEntries") {
    refreshTimeEntries();
    return;
  }

  if (state.currentTab === "reports") {
    state.workersLoadedFromApi = false;
    state.jobsPerWorkerLoadedFromApi = false;
    state.timeEntriesLoadedFromApi = false;
    refreshReports();
    return;
  }

  if (state.currentTab === "sales") {
    render();
    return;
  }

  refreshEvents();
}

function toggleChartsVisibility() {
  state.chartsMinimized = !state.chartsMinimized;
  applyChartsVisibility();
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

  render();
}

function setColumnFilter(tabName, key, value) {
  if (!state.columnFilters[tabName]) state.columnFilters[tabName] = {};
  state.columnFilters[tabName][key] = value;
  render();
}

function rememberColumnFilterFocus(tabName, key) {
  const wrap = document.querySelector(".table-scroll-wrap");
  if (wrap) state.tableScrollLeft = wrap.scrollLeft;

  state.activeColumnFilterInput = { tab: tabName, key };
}

function clearColumnFilters(tabName) {
  state.columnFilters[tabName] = {};
  state.activeColumnFilterInput = null;
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

/* =========================
   ROUTE BUILDER / TRAVEL LOG
========================= */

function setRouteBuilderCalendarValue(value) {
  setRouteBuilderCalendar(value);
}

function setRouteBuilderDateValue(value) {
  setRouteBuilderDate(value);
}

function setTravelRouteModeValue(value) {
  setTravelRouteMode(value);
  render();
}

function toggleRouteStopSelectionValue(eventId) {
  toggleRouteStopSelection(eventId);
  render();
}

function buildRouteAndRender() {
  buildRouteForSelectedCalendarAndDate();
  render();
}

function openBuiltRouteInMaps() {
  if (!state.routeBuilder.mapsUrl) return;
  window.open(state.routeBuilder.mapsUrl, "_blank", "noopener,noreferrer");
}

async function copyBuiltRouteStops() {
  await copyRouteStops();
  render();
}

async function copyBuiltRouteTemplate() {
  await copyRouteTemplate();
  render();
}

function setTravelLogWorkerNameValue(value) {
  setTravelLogWorkerName(value);
}

function setTravelLogWorkerIdValue(value) {
  setTravelLogWorkerId(value);
}

function setTravelLogWorkerRoleValue(value) {
  setTravelLogWorkerRole(value);
}

function setTravelLogHourlyRateValue(value) {
  setTravelLogHourlyRate(value);
}

function setTravelLogMileageRateValue(value) {
  setTravelLogMileageRate(value);
}

function setTravelTotalMilesValue(value) {
  setTravelTotalMiles(value);
  render();
}

function setTravelTotalDriveMinutesValue(value) {
  setTravelTotalDriveMinutes(value);
  render();
}

function setTravelFreeMinutesPerLegValue(value) {
  setTravelFreeMinutesPerLeg(value);
  render();
}

function selectTravelLogWorkerFromSearchValue(value) {
  selectTravelLogWorkerFromSearch(value);
  render();
}

function generateTravelLogAndRender() {
  generateTravelLogForRouteBuilder();
  render();
}

async function copyTravelLogAndRender() {
  await copyTravelLog();
  render();
}

async function copyTravelLogTitleAndRender() {
  await copyTravelLogTitle();
  render();
}

async function copyTravelLogBodyAndRender() {
  await copyTravelLogBody();
  render();
}

/* =========================
   REPORTS
========================= */

function setReportsWeekStartDateValue(value) {
  setReportsWeekStartDate(value);
  render();
}

function setReportsSelectedWorkerIdValue(value) {
  setReportsSelectedWorkerId(value);
  render();
}

function generateWeeklyReportsAndRender() {
  generateWeeklyReports();
  render();
}


function setFinanceFilterAndRender(key, value) {
  setFinanceFilter(key, value);
  render();
}

function clearFinanceFiltersAndRender() {
  clearFinanceFilters();
  render();
}

function setFieldMapDateAndRender(value) {
  setFieldMapDate(value);
  render();
}

function showFieldMapOpenOnlyAndRender() {
  showFieldMapOpenOnly();
  render();
}

function showFieldMapTodayAndRender() {
  showFieldMapToday();
  render();
}

/* =========================
   TIME ENTRY MAP
========================= */

window.openTimeEntryMapByFilteredIndex = (index) => {
  const searchInput = document.getElementById("search");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const startDate = startDateInput ? startDateInput.value : "";
  const endDate = endDateInput ? endDateInput.value : "";

  const filteredRows = state.timeEntries.filter((row) => {
    const text = JSON.stringify(row).toLowerCase();
    const matchesSearch = !search || text.includes(search);

    const rowDate = String(row.SessionDate || row.Date || "").trim();
    const matchesStart = !startDate || (rowDate && rowDate >= startDate);
    const matchesEnd = !endDate || (rowDate && rowDate <= endDate);

    return matchesSearch && matchesStart && matchesEnd;
  });

  openTimeEntryMap(filteredRows[index]);
  render();
};

window.openTimeEntryMapByOpenIndex = (index) => {
  const openRows = state.timeEntries.filter(
    (row) => String(row.Status || "").toUpperCase() === "OPEN"
  );

  openTimeEntryMap(openRows[index]);
  render();
};

window.closeTimeEntryMap = () => {
  closeTimeEntryMap();
  render();
};

/* =========================
   WINDOW FUNCTIONS
========================= */
window.setEventBuilderFieldAndRender = setEventBuilderFieldAndRender;
window.setEventBuilderWorkerAndRender = setEventBuilderWorkerAndRender;

window.addEventBuilderWorkerAndRender = addEventBuilderWorkerAndRender;
window.removeEventBuilderWorkerAndRender = removeEventBuilderWorkerAndRender;

window.copyEventBuilderTitleAndRender = copyEventBuilderTitleAndRender;
window.copyEventBuilderNotesAndRender = copyEventBuilderNotesAndRender;
window.copyEventBuilderBothAndRender = copyEventBuilderBothAndRender;

window.getEventBuilderWorkerId = (index) => {
  return state.eventBuilder?.workers?.[index]?.workerId || "";
};

window.getEventBuilderWorkerName = (index) => {
  return state.eventBuilder?.workers?.[index]?.workerName || "";
};

window.getEventBuilderWorkerIdNotFound = (index) => {
  return !!state.eventBuilder?.workers?.[index]?.idNotFound;
};

window.getEventBuilderWorkerNameNotFound = (index) => {
  return !!state.eventBuilder?.workers?.[index]?.nameNotFound;
};

window.setEventBuilderEventType = setEventBuilderEventTypeAndRender;


window.openJobFromTimeEntry = (eventId) => {
  const match = state.eventsData.find(
    (e) => String(e.EventId) === String(eventId)
  );

  if (!match) return;

  state.currentTab = "jobs";
  state.selectedEvent = match;
  state.eventDetailOpen = true;

  render();
};

window.setTab = setTab;
window.toggleChartsVisibility = toggleChartsVisibility;
window.clearFilters = clearFilters;
window.setColumnFilter = setColumnFilter;
window.rememberColumnFilterFocus = rememberColumnFilterFocus;
window.clearColumnFilters = clearColumnFilters;

window.selectEventByFilteredIndex = selectEventByFilteredIndex;
window.closeEventDetail = closeEventDetail;

window.selectWorkerByFilteredIndex = selectWorkerByFilteredIndex;
window.openWorkerProfile = openWorkerProfile;
window.closeWorkerProfile = closeWorkerProfile;

window.refreshCurrentTab = refreshCurrentTab;
window.refreshEvents = refreshEvents;
window.refreshWorkers = refreshWorkers;
window.refreshTimeEntries = refreshTimeEntries;
window.refreshReports = refreshReports;

window.copySelectedJobForWorkers = () => copySelectedJobForWorkers(render);

window.setRouteBuilderCalendar = setRouteBuilderCalendarValue;
window.setRouteBuilderDate = setRouteBuilderDateValue;
window.setTravelRouteMode = setTravelRouteModeValue;
window.toggleRouteStopSelection = toggleRouteStopSelectionValue;
window.buildRouteAndRender = buildRouteAndRender;
window.openBuiltRouteInMaps = openBuiltRouteInMaps;
window.copyBuiltRouteStops = copyBuiltRouteStops;
window.copyBuiltRouteTemplate = copyBuiltRouteTemplate;

window.setTravelLogWorkerName = setTravelLogWorkerNameValue;
window.setTravelLogWorkerId = setTravelLogWorkerIdValue;
window.setTravelLogWorkerRole = setTravelLogWorkerRoleValue;
window.setTravelLogHourlyRate = setTravelLogHourlyRateValue;
window.setTravelLogMileageRate = setTravelLogMileageRateValue;

window.setTravelTotalMiles = setTravelTotalMilesValue;
window.setTravelTotalDriveMinutes = setTravelTotalDriveMinutesValue;
window.setTravelFreeMinutesPerLeg = setTravelFreeMinutesPerLegValue;

window.selectTravelLogWorkerFromSearch = selectTravelLogWorkerFromSearchValue;

window.generateTravelLogAndRender = generateTravelLogAndRender;
window.copyTravelLogAndRender = copyTravelLogAndRender;
window.copyTravelLogTitleAndRender = copyTravelLogTitleAndRender;
window.copyTravelLogBodyAndRender = copyTravelLogBodyAndRender;

window.setReportsWeekStartDate = setReportsWeekStartDateValue;
window.setReportsSelectedWorkerId = setReportsSelectedWorkerIdValue;
window.generateWeeklyReportsAndRender = generateWeeklyReportsAndRender;

window.setFinanceFilterAndRender = setFinanceFilterAndRender;
window.clearFinanceFiltersAndRender = clearFinanceFiltersAndRender;


window.setFieldMapDateAndRender = setFieldMapDateAndRender;
window.showFieldMapOpenOnlyAndRender = showFieldMapOpenOnlyAndRender;
window.showFieldMapTodayAndRender = showFieldMapTodayAndRender;

/* =========================
   INIT
========================= */

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