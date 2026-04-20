const API_BASE_URL =
  "https://script.google.com/macros/s/AKfycbwz401Ii47fb86kB-eo93tirJmGpbHFS2jEonIn6yuFjNqu5rxjQiPvUTOzDkvAvoPR/exec";

let currentTab = "events";
let currentView = "main";

let eventsData = [];
let workers = [];
let jobsPerWorker = [];

let selectedEvent = null;
let selectedWorker = null;

let eventsLoadedFromApi = false;
let workersLoadedFromApi = false;
let jobsPerWorkerLoadedFromApi = false;
let dashboardMeta = { lastSyncIso: "" };

let revenueLaborChart = null;
let assignedTimeChart = null;
let selectedCalendars = new Set();
let chartsMinimized = false;
let copyStatusMessage = "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toNumber(value) {
  const cleaned = String(value ?? "").replace(/[$,% ,]/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function round2(value) {
  return Math.round((value || 0) * 100) / 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value || 0);
}

function formatHours(value) {
  return `${(value || 0).toFixed(2)} hrs`;
}

function formatDateTimeFriendly(isoString) {
  if (!isoString) return "Not available";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;

  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function normalizeActiveValue(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "active" || v === "1" || v === "☑" || v === "✅";
}

function getActiveBadgeClass(isActive) {
  return isActive ? "badge-success" : "badge-danger";
}

function extractHrefOrUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const hrefMatch = text.match(/href\s*=\s*["']([^"']+)["']/i);
  if (hrefMatch && hrefMatch[1]) return hrefMatch[1];

  const urlMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  if (urlMatch && urlMatch[0]) return urlMatch[0];

  return "";
}

function renderLinkButtons(row) {
  const links = [
    { label: "Contract", value: extractHrefOrUrl(row.Contract) },
    { label: "Estimate", value: extractHrefOrUrl(row.Estimate) },
    { label: "Invoice", value: extractHrefOrUrl(row.Invoice) },
    { label: "Photos", value: extractHrefOrUrl(row.Photos) }
  ].filter((item) => item.value);

  if (!links.length) return `<div class="text-slate-500">No links available.</div>`;

  return `
    <div class="flex flex-wrap gap-2">
      ${links.map((item) => `
        <a
          href="${escapeHtml(item.value)}"
          target="_blank"
          rel="noopener noreferrer"
          class="secondary-btn"
        >${escapeHtml(item.label)}</a>
      `).join("")}
    </div>
  `;
}

function renderLinkCell(value) {
  const url = extractHrefOrUrl(value);
  if (!url) return "";
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">Open</a>`;
}

function getUniqueCalendars() {
  return [...new Set(
    eventsData
      .map((row) => String(row.CalendarName || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

function isTravelEvent(row) {
  const explicitType = String(row.EventType || "").trim().toLowerCase();
  if (explicitType === "travel") return true;
  if (explicitType === "job") return false;

  const titleText = `${row.ClientName || ""} ${row.JobSequence || ""}`.toLowerCase();
  return /\b(pickup|dropoff|travel)\b/.test(titleText);
}

function isJobEvent(row) {
  return !isTravelEvent(row);
}

function setTab(tab, event) {
  currentTab = tab;
  currentView = "main";
  copyStatusMessage = "";

  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (event && event.target) {
    event.target.classList.add("active");
  }

  toggleFilterGroups();

  if ((tab === "events" || tab === "jobs" || tab === "travel") && !eventsLoadedFromApi) {
    refreshEvents();
    return;
  }

  if (tab === "workers" && !workersLoadedFromApi) {
    refreshWorkers();
    return;
  }

  render();
}

function toggleChartsVisibility() {
  chartsMinimized = !chartsMinimized;
  applyChartsVisibility();

  if ((currentTab === "events" || currentTab === "jobs" || currentTab === "travel") && currentView === "main") {
    render();
  }
}

function applyChartsVisibility() {
  const chartsShell = document.getElementById("dashboardChartsShell");
  const charts = document.getElementById("dashboardCharts");
  const btn = document.getElementById("toggleChartsBtn");

  const shouldShowShell =
    (currentTab === "events" || currentTab === "jobs" || currentTab === "travel") &&
    currentView === "main";

  if (chartsShell) {
    chartsShell.classList.toggle("hidden", !shouldShowShell);
  }

  if (charts) {
    charts.classList.toggle("hidden", !shouldShowShell || chartsMinimized);
  }

  if (btn) {
    btn.innerText = chartsMinimized ? "Show Graphs" : "Hide Graphs";
  }

  if (!shouldShowShell || chartsMinimized) {
    destroyCharts();
  }
}

function toggleFilterGroups() {
  const eventFilters = document.getElementById("eventFilters");
  const workersFilters = document.getElementById("workersFilters");
  const primaryCountLabel = document.getElementById("primaryCountLabel");

  const showEventFilters = ["events", "jobs", "travel"].includes(currentTab) && currentView === "main";

  if (eventFilters) {
    eventFilters.classList.toggle("hidden", !showEventFilters);
  }

  if (workersFilters) {
    workersFilters.classList.toggle("hidden", currentTab !== "workers" || currentView !== "main");
  }

  if (primaryCountLabel) {
    if (currentTab === "workers") {
      primaryCountLabel.innerText = "Workers";
    } else if (currentTab === "travel") {
      primaryCountLabel.innerText = "Travel";
    } else if (currentTab === "jobs") {
      primaryCountLabel.innerText = "Jobs";
    } else if (currentTab === "sales") {
      primaryCountLabel.innerText = "Sales";
    } else {
      primaryCountLabel.innerText = "Events";
    }
  }

  applyChartsVisibility();
}

async function loadDashboardMetaFromApi() {
  const url = `${API_BASE_URL}?action=getDashboardMeta&_=${Date.now()}`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading dashboard metadata.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to load dashboard metadata.");
  }

  dashboardMeta = result.data || { lastSyncIso: "" };
  updateLastSyncText();
}

function updateLastSyncText() {
  const el = document.getElementById("lastSyncText");
  if (!el) return;

  if (!dashboardMeta.lastSyncIso) {
    el.innerText = "Not available";
    return;
  }

  el.innerText = formatDateTimeFriendly(dashboardMeta.lastSyncIso);
}

async function loadEventsFromApi() {
  const url = `${API_BASE_URL}?action=getJobs&_=${Date.now()}`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading Events.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to load Events data.");
  }

  eventsData = Array.isArray(result.data) ? result.data : [];
  eventsLoadedFromApi = true;

  initializeCalendarSelection();
  renderCalendarChecklist();
  updateCalendarButtonLabel();

  if (!selectedEvent && eventsData.length > 0) {
    selectedEvent = eventsData[0];
  }
}

async function loadWorkersFromApi() {
  const url = `${API_BASE_URL}?action=getWorkers&_=${Date.now()}`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading Workers.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to load Workers data.");
  }

  workers = Array.isArray(result.data) ? result.data : [];
  workersLoadedFromApi = true;

  if (!selectedWorker && workers.length > 0) {
    selectedWorker = workers[0];
  }
}

async function loadJobsPerWorkerFromApi() {
  const url = `${API_BASE_URL}?action=getJobsPerWorker&_=${Date.now()}`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading JobsPerWorker.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to load JobsPerWorker data.");
  }

  jobsPerWorker = Array.isArray(result.data) ? result.data : [];
  jobsPerWorkerLoadedFromApi = true;
}

function initializeCalendarSelection() {
  const calendars = getUniqueCalendars();

  if (selectedCalendars.size === 0) {
    calendars.forEach((name) => selectedCalendars.add(name));
    return;
  }

  const validCalendars = new Set(calendars);
  selectedCalendars = new Set([...selectedCalendars].filter((name) => validCalendars.has(name)));

  if (selectedCalendars.size === 0) {
    calendars.forEach((name) => selectedCalendars.add(name));
  }
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
          value="${escapeHtml(calendar)}"
          ${selectedCalendars.has(calendar) ? "checked" : ""}
          onchange="toggleCalendarSelection(this.value, this.checked)"
        />
        <span>${escapeHtml(calendar)}</span>
      </label>
    `)
    .join("");
}

function updateCalendarButtonLabel() {
  const btn = document.getElementById("calendarDropdownButton");
  if (!btn) return;

  const total = getUniqueCalendars().length;
  const selected = selectedCalendars.size;

  if (selected === 0) {
    btn.innerText = "Calendars (0)";
  } else if (selected === total) {
    btn.innerText = "All Calendars";
  } else if (selected === 1) {
    btn.innerText = [...selectedCalendars][0];
  } else {
    btn.innerText = `Calendars (${selected})`;
  }
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
  if (isChecked) selectedCalendars.add(calendarName);
  else selectedCalendars.delete(calendarName);

  updateCalendarButtonLabel();
  render();
}

function selectAllCalendars() {
  getUniqueCalendars().forEach((name) => selectedCalendars.add(name));
  renderCalendarChecklist();
  updateCalendarButtonLabel();
  render();
}

function clearCalendarSelection() {
  selectedCalendars.clear();
  renderCalendarChecklist();
  updateCalendarButtonLabel();
  render();
}

async function refreshEvents() {
  try {
    eventsLoadedFromApi = false;
    eventsData = [];
    selectedEvent = null;
    copyStatusMessage = "";

    renderLoadingState("Events");

    await Promise.all([loadEventsFromApi(), loadDashboardMetaFromApi()]);
    render();
  } catch (error) {
    console.error("Error loading Events:", error);
    renderErrorState(error.message || "Unknown error while loading Events.");
  }
}

async function refreshWorkers() {
  try {
    workersLoadedFromApi = false;
    workers = [];
    selectedWorker = null;

    renderLoadingState("Workers");

    await Promise.all([loadWorkersFromApi(), loadDashboardMetaFromApi()]);
    render();
  } catch (error) {
    console.error("Error loading Workers:", error);
    renderErrorState(error.message || "Unknown error while loading Workers.");
  }
}

function refreshCurrentTab() {
  if (currentTab === "workers") {
    if (currentView === "workerProfile") {
      jobsPerWorkerLoadedFromApi = false;
      jobsPerWorker = [];
    }
    refreshWorkers();
    return;
  }

  if (currentTab === "sales") {
    render();
    return;
  }

  refreshEvents();
}

function renderLoadingState(label) {
  const apiStatus = document.getElementById("apiStatus");
  if (apiStatus) apiStatus.innerText = "Loading...";

  const content = document.getElementById("content");
  if (content) {
    content.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h2 class="text-2xl font-semibold">${escapeHtml(label)}</h2>
        </div>
        <div class="panel-body">
          <div class="success-box">Loading ${escapeHtml(label)} data from Apps Script...</div>
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
            <span class="text-sm">${escapeHtml(message)}</span>
          </div>
        </div>
      </div>
    `;
  }
}

function getBaseFilteredEvents() {
  const searchInput = document.getElementById("search");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const startDateValue = startDateInput ? startDateInput.value : "";
  const endDateValue = endDateInput ? endDateInput.value : "";

  return eventsData.filter((row) => {
    const matchesSearch = !searchValue || JSON.stringify(row).toLowerCase().includes(searchValue);
    const rowDate = row.Date || "";

    const matchesStartDate = !startDateValue || (rowDate && rowDate >= startDateValue);
    const matchesEndDate = !endDateValue || (rowDate && rowDate <= endDateValue);

    const matchesCalendar =
      selectedCalendars.size === 0
        ? true
        : selectedCalendars.has(String(row.CalendarName || "").trim());

    return matchesSearch && matchesStartDate && matchesEndDate && matchesCalendar;
  });
}

function getFilteredRowsByTab() {
  const base = getBaseFilteredEvents();

  if (currentTab === "jobs") return base.filter(isJobEvent);
  if (currentTab === "travel") return base.filter(isTravelEvent);

  return base;
}

function getFilteredWorkers() {
  const workerSearch = document.getElementById("workerSearch");
  const workerActiveFilter = document.getElementById("workerActiveFilter");

  const searchValue = workerSearch ? workerSearch.value.toLowerCase().trim() : "";
  const activeValue = workerActiveFilter ? workerActiveFilter.value : "";

  return workers.filter((worker) => {
    const searchableText = JSON.stringify(worker).toLowerCase();
    const matchesSearch = !searchValue || searchableText.includes(searchValue);
    const isActive = normalizeActiveValue(worker.Active);

    const matchesActive =
      !activeValue ||
      (activeValue === "active" && isActive) ||
      (activeValue === "inactive" && !isActive);

    return matchesSearch && matchesActive;
  });
}

function getSelectedWorkerJobs() {
  if (!selectedWorker) return [];
  const workerId = String(selectedWorker.WorkerID || "").trim();
  if (!workerId) return [];

  return jobsPerWorker
    .filter((row) => String(row.WorkerID || "").trim() === workerId)
    .filter((row) => String(row.EventType || "").trim().toLowerCase() !== "travel")
    .sort((a, b) => {
      const dateA = String(a.Date || "");
      const dateB = String(b.Date || "");
      if (dateA !== dateB) return dateB.localeCompare(dateA);

      const timeA = String(a.ArrivalTime || "");
      const timeB = String(b.ArrivalTime || "");
      return timeA.localeCompare(timeB);
    });
}

function calculateJobPay(row) {
  return round2(toNumber(row.AssignedTime) * toNumber(row.Rate));
}

function updateSummaryCardsForEvents(filteredRows) {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  const eventCount = filteredRows.length;
  const revenueTotal = filteredRows.reduce((sum, row) => sum + toNumber(row.GivenPrice), 0);
  const assignedTimeTotal = filteredRows.reduce((sum, row) => sum + durationToHoursFromDisplay(row.DisplayDuration), 0);
  const linkedDocsCount = filteredRows.reduce((sum, row) => {
    let c = 0;
    if (extractHrefOrUrl(row.Contract)) c += 1;
    if (extractHrefOrUrl(row.Estimate)) c += 1;
    if (extractHrefOrUrl(row.Invoice)) c += 1;
    if (extractHrefOrUrl(row.Photos)) c += 1;
    return sum + c;
  }, 0);

  if (countEl) countEl.innerText = eventCount;
  if (revenueEl) revenueEl.innerText = formatCurrency(revenueTotal);
  if (laborEl) laborEl.innerText = linkedDocsCount;
  if (assignedEl) assignedEl.innerText = formatHours(assignedTimeTotal);
}

function updateSummaryCardsForTravel(filteredRows) {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  const eventCount = filteredRows.length;
  const totalMiles = filteredRows.reduce((sum, row) => sum + getTravelMiles(row), 0);
  const totalMinutes = filteredRows.reduce((sum, row) => sum + getTravelMinutes(row), 0);
  const alertCount = filteredRows.filter((row) => isTravelAlert(row)).length;

  if (countEl) countEl.innerText = eventCount;
  if (revenueEl) revenueEl.innerText = `${round2(totalMiles)} mi`;
  if (laborEl) laborEl.innerText = alertCount;
  if (assignedEl) assignedEl.innerText = `${round2(totalMinutes)} mins`;
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

function durationToHoursFromDisplay(display) {
  const text = String(display || "").toLowerCase();
  let totalMinutes = 0;

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hoursMatch) totalMinutes += parseFloat(hoursMatch[1]) * 60;

  const minutesMatch = text.match(/(\d+(?:\.\d+)?)\s*m/);
  if (minutesMatch) totalMinutes += parseFloat(minutesMatch[1]);

  return round2(totalMinutes / 60);
}

function durationToMinutesFromDisplay(display) {
  const text = String(display || "").toLowerCase();
  let totalMinutes = 0;

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hoursMatch) totalMinutes += parseFloat(hoursMatch[1]) * 60;

  const minutesMatch = text.match(/(\d+(?:\.\d+)?)\s*m/);
  if (minutesMatch) totalMinutes += parseFloat(minutesMatch[1]);

  return round2(totalMinutes);
}

function getTravelMiles(row) {
  return toNumber(row.Miles);
}

function getTravelMinutes(row) {
  return durationToMinutesFromDisplay(row.DisplayDuration);
}

function isTravelAlert(row) {
  return getTravelMiles(row) > 10 || getTravelMinutes(row) > 30;
}

function getTravelAlertLabel(row) {
  const overMiles = getTravelMiles(row) > 10;
  const overMinutes = getTravelMinutes(row) > 30;

  if (overMiles && overMinutes) return "Over both";
  if (overMiles) return "Over 10 miles";
  if (overMinutes) return "Over 30 mins";
  return "Normal";
}

function getTravelAlertBadgeClass(row) {
  return isTravelAlert(row) ? "badge-danger" : "badge-success";
}

function buildMetricsByDate(filteredRows) {
  const grouped = {};

  filteredRows.forEach((row) => {
    const date = String(row.Date || "");
    if (!date) return;

    if (!grouped[date]) {
      grouped[date] = {
        revenue: 0,
        docs: 0,
        assignedTime: 0,
        count: 0
      };
    }

    grouped[date].revenue += toNumber(row.GivenPrice);
    grouped[date].assignedTime += durationToHoursFromDisplay(row.DisplayDuration);
    grouped[date].count += 1;

    if (extractHrefOrUrl(row.Contract)) grouped[date].docs += 1;
    if (extractHrefOrUrl(row.Estimate)) grouped[date].docs += 1;
    if (extractHrefOrUrl(row.Invoice)) grouped[date].docs += 1;
    if (extractHrefOrUrl(row.Photos)) grouped[date].docs += 1;
  });

  const labels = Object.keys(grouped).sort();

  return {
    labels,
    revenue: labels.map((d) => grouped[d].revenue),
    docs: labels.map((d) => grouped[d].docs),
    assignedTime: labels.map((d) => grouped[d].assignedTime),
    count: labels.map((d) => grouped[d].count)
  };
}

function destroyCharts() {
  if (revenueLaborChart) {
    revenueLaborChart.destroy();
    revenueLaborChart = null;
  }

  if (assignedTimeChart) {
    assignedTimeChart.destroy();
    assignedTimeChart = null;
  }
}

function renderEventsCharts(filteredRows) {
  const revenueCanvas = document.getElementById("revenueLaborChart");
  const assignedCanvas = document.getElementById("assignedTimeChart");
  if (!revenueCanvas || !assignedCanvas) return;

  destroyCharts();

  const metrics = buildMetricsByDate(filteredRows);

  revenueLaborChart = new Chart(revenueCanvas, {
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

  assignedTimeChart = new Chart(assignedCanvas, {
    type: "line",
    data: {
      labels: metrics.labels,
      datasets: [{ label: "Assigned Time (hrs)", data: metrics.assignedTime }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function buildWorkerCopyText(row) {
  const lines = [];

  const addLine = (label, value) => {
    const text = String(value || "").trim();
    if (!text) return;
    lines.push(`${label}: ${text}`);
  };

  addLine("Client", row.ClientName);
  addLine("Address", row.Address);
  addLine("Arrival time", row.ArrivalTime);
  addLine("Estimated time", row.DisplayDuration);
  addLine("Service type", row.ServiceType);
  addLine("Entrance", row.Entrance);
  addLine("Material info", row.MaterialInfo);
  addLine("Instructions", row.Instructions);

  return lines.join("\n");
}

async function copySelectedJobForWorkers() {
  if (!selectedEvent || currentTab !== "jobs") return;

  const text = buildWorkerCopyText(selectedEvent);

  if (!text) {
    copyStatusMessage = "Nothing to copy.";
    render();
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopyText(text);
    }

    copyStatusMessage = "Copied for WhatsApp.";
    render();
    window.setTimeout(() => {
      copyStatusMessage = "";
      render();
    }, 2000);
  } catch (error) {
    console.error("Clipboard copy failed:", error);
    copyStatusMessage = "Copy failed.";
    render();
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function renderCopyStatus() {
  if (!copyStatusMessage) return "";
  return `<div class="success-box mt-3">${escapeHtml(copyStatusMessage)}</div>`;
}

function render() {
  toggleFilterGroups();

  const apiStatus = document.getElementById("apiStatus");
  if (apiStatus) {
    if (currentTab === "workers") {
      apiStatus.innerText = workersLoadedFromApi ? "Yes" : "No";
    } else if (currentTab === "sales") {
      apiStatus.innerText = "N/A";
    } else {
      apiStatus.innerText = eventsLoadedFromApi ? "Yes" : "No";
    }
  }

  if (currentTab === "workers") {
    const filteredWorkers = getFilteredWorkers();
    updateSummaryCardsForWorkers(filteredWorkers);
    destroyCharts();

    if (selectedWorker) {
      const stillExists = filteredWorkers.some(
        (worker) => String(worker.WorkerID || "") === String(selectedWorker.WorkerID || "")
      );
      if (!stillExists) selectedWorker = filteredWorkers[0] || null;
    } else {
      selectedWorker = filteredWorkers[0] || null;
    }

    if (currentView === "workerProfile") renderWorkerProfileView();
    else renderWorkersTab(filteredWorkers);
    return;
  }

  if (currentTab === "sales") {
    updateSummaryCardsForSales();
    destroyCharts();
    renderSalesTab();
    return;
  }

  renderCalendarChecklist();
  updateCalendarButtonLabel();

  const filteredRows = getFilteredRowsByTab();

  if (currentTab === "travel") updateSummaryCardsForTravel(filteredRows);
  else updateSummaryCardsForEvents(filteredRows);

  if (!chartsMinimized && filteredRows.length > 0) {
    renderEventsCharts(filteredRows);
  } else {
    destroyCharts();
  }

  if (selectedEvent) {
    const stillExists = filteredRows.some(
      (row) => String(row.EventId || "") === String(selectedEvent.EventId || "")
    );
    if (!stillExists) selectedEvent = filteredRows[0] || null;
  } else {
    selectedEvent = filteredRows[0] || null;
  }

  if (currentTab === "travel") renderTravelTab(filteredRows);
  else if (currentTab === "jobs") renderJobsTab(filteredRows);
  else renderEventsTab(filteredRows);
}

function renderEventsTab(filteredRows) {
  renderEventsLikeTab(filteredRows, "Events", true, false);
}

function renderJobsTab(filteredRows) {
  renderEventsLikeTab(filteredRows, "Jobs", false, true);
}

function renderEventsLikeTab(filteredRows, heading, showEventType, showCopyButton) {
  const content = document.getElementById("content");
  if (!content) return;

  const selected = selectedEvent || filteredRows[0] || null;

  content.innerHTML = `
    <div class="jobs-layout">
      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 class="text-2xl font-semibold">${escapeHtml(heading)}</h2>
              <p class="text-sm text-slate-500">
                Live data pulled from the Google Sheets tab named Jobs.
              </p>
              <p class="text-sm text-slate-500 mt-1">
                Total API rows: <strong>${eventsData.length}</strong> |
                Filtered rows: <strong>${filteredRows.length}</strong>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="secondary-btn" onclick="clearFilters()" type="button">Clear Filters</button>
              <button class="secondary-btn" onclick="refreshEvents()" type="button">Refresh ${escapeHtml(heading)}</button>
            </div>
          </div>
        </div>

        <div class="panel-body">
          <div class="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>CalendarName</th>
                  ${showEventType ? "<th>EventType</th>" : ""}
                  <th>ClientName</th>
                  <th>Zone</th>
                  <th>DisplayDuration</th>
                  <th>Company</th>
                  <th>ArrivalTime</th>
                  <th>JobSequence</th>
                  <th>Address</th>
                  <th>Frequency</th>
                  <th>GivenPrice</th>
                  <th>RateType</th>
                  <th>PaymentType</th>
                  <th>ServiceType</th>
                  <th>Phone</th>
                  <th>Contract</th>
                  <th>Estimate</th>
                  <th>Invoice</th>
                  <th>Photos</th>
                  <th>EventId</th>
                </tr>
              </thead>
              <tbody>
                ${
                  filteredRows.length === 0
                    ? `<tr><td colspan="${showEventType ? 21 : 20}" class="text-center text-slate-500">No rows matched your filters.</td></tr>`
                    : filteredRows.map((row, index) => `
                      <tr class="clickable-row" onclick="selectEventByFilteredIndex(${index})">
                        <td title="${escapeHtml(row.Date)}">${escapeHtml(row.Date)}</td>
                        <td title="${escapeHtml(row.CalendarName)}">${escapeHtml(row.CalendarName)}</td>
                        ${showEventType ? `<td title="${escapeHtml(row.EventType)}"><span class="badge badge-neutral">${escapeHtml(row.EventType)}</span></td>` : ""}
                        <td title="${escapeHtml(row.ClientName)}">${escapeHtml(row.ClientName)}</td>
                        <td title="${escapeHtml(row.Zone)}">${escapeHtml(row.Zone)}</td>
                        <td title="${escapeHtml(row.DisplayDuration)}">${escapeHtml(row.DisplayDuration)}</td>
                        <td title="${escapeHtml(row.Company)}">${escapeHtml(row.Company)}</td>
                        <td title="${escapeHtml(row.ArrivalTime)}">${escapeHtml(row.ArrivalTime)}</td>
                        <td title="${escapeHtml(row.JobSequence)}">${escapeHtml(row.JobSequence)}</td>
                        <td title="${escapeHtml(row.Address)}">${escapeHtml(row.Address)}</td>
                        <td title="${escapeHtml(row.Frequency)}">${escapeHtml(row.Frequency)}</td>
                        <td title="${escapeHtml(row.GivenPrice)}">${escapeHtml(row.GivenPrice)}</td>
                        <td title="${escapeHtml(row.RateType)}">${escapeHtml(row.RateType)}</td>
                        <td title="${escapeHtml(row.PaymentType)}">${escapeHtml(row.PaymentType)}</td>
                        <td title="${escapeHtml(row.ServiceType)}">${escapeHtml(row.ServiceType)}</td>
                        <td title="${escapeHtml(row.Phone)}">${escapeHtml(row.Phone)}</td>
                        <td>${renderLinkCell(row.Contract)}</td>
                        <td>${renderLinkCell(row.Estimate)}</td>
                        <td>${renderLinkCell(row.Invoice)}</td>
                        <td>${renderLinkCell(row.Photos)}</td>
                        <td title="${escapeHtml(row.EventId)}">${escapeHtml(row.EventId)}</td>
                      </tr>
                    `).join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold">${escapeHtml(heading)} Detail</h3>
            ${showCopyButton && selected ? `<button class="primary-btn" onclick="copySelectedJobForWorkers()" type="button">Copy for Workers</button>` : ""}
          </div>
        </div>

        <div class="panel-body space-y-4">
          ${
            selected
              ? `
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected ${escapeHtml(heading.slice(0, -1) || "Row")}</p>
                  <p class="mt-1 text-base font-semibold">
                    ${escapeHtml(selected.ClientName)} — ${escapeHtml(selected.ServiceType)}
                  </p>
                </div>

                <div class="grid grid-cols-1 gap-3">
                  ${detailField("Date", selected.Date)}
                  ${detailField("CalendarName", selected.CalendarName)}
                  ${detailField("EventType", selected.EventType)}
                  ${detailField("ClientName", selected.ClientName)}
                  ${detailField("Zone", selected.Zone)}
                  ${detailField("DisplayDuration", selected.DisplayDuration)}
                  ${detailField("Company", selected.Company)}
                  ${detailField("ArrivalTime", selected.ArrivalTime)}
                  ${detailField("JobSequence", selected.JobSequence)}
                  ${detailField("Address", selected.Address)}
                  ${detailField("Frequency", selected.Frequency)}
                  ${detailField("GivenPrice", selected.GivenPrice)}
                  ${detailField("AdditionalExpense", selected.AdditionalExpense)}
                  ${detailField("RateType", selected.RateType)}
                  ${detailField("Tip", selected.Tip)}
                  ${detailField("PaymentType", selected.PaymentType)}
                  ${detailTextarea("FinanceNotes", selected.FinanceNotes)}
                  ${detailField("AccountManager", selected.AccountManager)}
                  ${detailField("Commission", selected.Commission)}
                  ${detailTextarea("QcNotes", selected.QcNotes)}
                  ${detailField("ServiceType", selected.ServiceType)}
                  ${detailField("Entrance", selected.Entrance)}
                  ${detailField("MaterialInfo", selected.MaterialInfo)}
                  ${detailTextarea("Instructions", selected.Instructions)}
                  ${detailTextarea("OtherInfo", selected.OtherInfo)}
                  ${detailField("Phone", selected.Phone)}
                  ${detailTextarea("WorkerInfo", selected.WorkerInfo)}
                  ${detailField("EventId", selected.EventId)}
                </div>

                ${showCopyButton ? renderCopyStatus() : ""}

                <div class="mt-4">
                  <label class="block text-sm font-medium mb-2">Links</label>
                  ${renderLinkButtons(selected)}
                </div>
              `
              : `<div class="text-slate-500">No row selected.</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderTravelTab(filteredRows) {
  const content = document.getElementById("content");
  if (!content) return;

  const selected = selectedEvent || filteredRows[0] || null;

  content.innerHTML = `
    <div class="jobs-layout">
      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 class="text-2xl font-semibold">Travel</h2>
              <p class="text-sm text-slate-500">Only pickup, dropoff, and travel events.</p>
              <p class="text-sm text-slate-500 mt-1">
                Total travel rows: <strong>${filteredRows.length}</strong>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="secondary-btn" onclick="clearFilters()" type="button">Clear Filters</button>
              <button class="secondary-btn" onclick="refreshEvents()" type="button">Refresh Travel</button>
            </div>
          </div>
        </div>

        <div class="panel-body">
          <div class="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>CalendarName</th>
                  <th>ClientName</th>
                  <th>DisplayDuration</th>
                  <th>ArrivalTime</th>
                  <th>Address</th>
                  <th>Miles</th>
                  <th>Drive Time</th>
                  <th>Alert</th>
                  <th>EventId</th>
                </tr>
              </thead>
              <tbody>
                ${
                  filteredRows.length === 0
                    ? `<tr><td colspan="10" class="text-center text-slate-500">No travel rows matched your filters.</td></tr>`
                    : filteredRows.map((row, index) => `
                      <tr class="clickable-row" onclick="selectEventByFilteredIndex(${index})">
                        <td title="${escapeHtml(row.Date)}">${escapeHtml(row.Date)}</td>
                        <td title="${escapeHtml(row.CalendarName)}">${escapeHtml(row.CalendarName)}</td>
                        <td title="${escapeHtml(row.ClientName)}">${escapeHtml(row.ClientName)}</td>
                        <td title="${escapeHtml(row.DisplayDuration)}">${escapeHtml(row.DisplayDuration)}</td>
                        <td title="${escapeHtml(row.ArrivalTime)}">${escapeHtml(row.ArrivalTime)}</td>
                        <td title="${escapeHtml(row.Address)}">${escapeHtml(row.Address)}</td>
                        <td title="${escapeHtml(String(getTravelMiles(row)))}">${escapeHtml(String(getTravelMiles(row)))}</td>
                        <td title="${escapeHtml(String(getTravelMinutes(row)))}">${escapeHtml(String(getTravelMinutes(row)))} mins</td>
                        <td><span class="badge ${getTravelAlertBadgeClass(row)}">${escapeHtml(getTravelAlertLabel(row))}</span></td>
                        <td title="${escapeHtml(row.EventId)}">${escapeHtml(row.EventId)}</td>
                      </tr>
                    `).join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3 class="text-lg font-semibold">Travel Detail</h3>
        </div>
        <div class="panel-body space-y-4">
          ${
            selected
              ? `
                ${detailField("Date", selected.Date)}
                ${detailField("CalendarName", selected.CalendarName)}
                ${detailField("ClientName", selected.ClientName)}
                ${detailField("DisplayDuration", selected.DisplayDuration)}
                ${detailField("ArrivalTime", selected.ArrivalTime)}
                ${detailField("Address", selected.Address)}
                ${detailField("Miles", getTravelMiles(selected))}
                ${detailField("Drive Time (mins)", `${getTravelMinutes(selected)}`)}
                ${detailField("Alert", getTravelAlertLabel(selected))}
                ${detailField("EventId", selected.EventId)}
              `
              : `<div class="text-slate-500">No travel row selected.</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderWorkersTab(filteredWorkers) {
  const content = document.getElementById("content");
  if (!content) return;

  const selected = selectedWorker || filteredWorkers[0] || null;

  content.innerHTML = `
    <div class="jobs-layout">
      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 class="text-2xl font-semibold">Workers</h2>
              <p class="text-sm text-slate-500">Jobs · Availability · Payroll · Clocked Time</p>
              <p class="text-sm text-slate-500 mt-1">
                Total API rows: <strong>${workers.length}</strong> |
                Filtered rows: <strong>${filteredWorkers.length}</strong>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="secondary-btn" onclick="clearFilters()" type="button">Clear Filters</button>
              <button class="secondary-btn" onclick="refreshWorkers()" type="button">Refresh Workers</button>
            </div>
          </div>
        </div>

        <div class="panel-body">
          <div class="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>WorkerID</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>BaseRate</th>
                  <th>#</th>
                  <th>DriverRate</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                ${
                  filteredWorkers.length === 0
                    ? `<tr><td colspan="7" class="text-center text-slate-500">No workers matched your filters.</td></tr>`
                    : filteredWorkers.map((worker, index) => `
                      <tr class="clickable-row" onclick="selectWorkerByFilteredIndex(${index})">
                        <td title="${escapeHtml(worker.WorkerID)}">${escapeHtml(worker.WorkerID)}</td>
                        <td title="${escapeHtml(worker.Name)}">${escapeHtml(worker.Name)}</td>
                        <td title="${escapeHtml(worker.Role)}">${escapeHtml(worker.Role)}</td>
                        <td title="${escapeHtml(worker.BaseRate)}">${escapeHtml(worker.BaseRate)}</td>
                        <td title="${escapeHtml(worker["#"])}">${escapeHtml(worker["#"])}</td>
                        <td title="${escapeHtml(worker.DriverRate)}">${escapeHtml(worker.DriverRate)}</td>
                        <td title="${escapeHtml(worker.Active)}">
                          <span class="badge ${getActiveBadgeClass(normalizeActiveValue(worker.Active))}">
                            ${normalizeActiveValue(worker.Active) ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    `).join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold">Worker Detail</h3>
            ${selected ? `<button class="primary-btn" onclick="openWorkerProfile()" type="button">View Profile</button>` : ""}
          </div>
        </div>

        <div class="panel-body space-y-4">
          ${
            selected
              ? `
                ${detailField("WorkerID", selected.WorkerID)}
                ${detailField("Name", selected.Name)}
                ${detailField("Role", selected.Role)}
                ${detailField("BaseRate", selected.BaseRate)}
                ${detailField("#", selected["#"])}
                ${detailField("DriverRate", selected.DriverRate)}
                ${detailField("Active", normalizeActiveValue(selected.Active) ? "Active" : "Inactive")}
              `
              : `<div class="text-slate-500">No worker selected.</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderWorkerProfileView() {
  const content = document.getElementById("content");
  if (!content) return;

  if (!selectedWorker) {
    content.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h2 class="text-2xl font-semibold">Worker Profile</h2>
        </div>
        <div class="panel-body">
          <p class="text-slate-500">No worker selected.</p>
          <button class="secondary-btn mt-4" onclick="closeWorkerProfile()" type="button">Back to Workers</button>
        </div>
      </div>
    `;
    return;
  }

  const isActive = normalizeActiveValue(selectedWorker.Active);
  const workerJobs = getSelectedWorkerJobs();

  content.innerHTML = `
    <div class="space-y-6">
      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="flex items-center gap-3 flex-wrap">
                <h2 class="text-3xl font-semibold">${escapeHtml(selectedWorker.Name)}</h2>
                <span class="badge ${getActiveBadgeClass(isActive)}">${isActive ? "Active" : "Inactive"}</span>
              </div>
              <p class="text-sm text-slate-500 mt-2">
                Jobs · Availability · Payroll · Clocked Time
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button class="secondary-btn" onclick="closeWorkerProfile()" type="button">Back to Workers</button>
            </div>
          </div>
        </div>

        <div class="panel-body">
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div class="stat-card">
              <div class="stat-label">Worker ID</div>
              <div class="stat-value text-lg">${escapeHtml(selectedWorker.WorkerID || "-")}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Role</div>
              <div class="stat-value text-lg">${escapeHtml(selectedWorker.Role || "-")}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Base Rate</div>
              <div class="stat-value text-lg">${escapeHtml(selectedWorker.BaseRate || "-")}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Job Rows Found</div>
              <div class="stat-value text-lg">${workerJobs.length}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            ${detailField("WorkerID", selectedWorker.WorkerID)}
            ${detailField("Name", selectedWorker.Name)}
            ${detailField("Role", selectedWorker.Role)}
            ${detailField("BaseRate", selectedWorker.BaseRate)}
            ${detailField("#", selectedWorker["#"])}
            ${detailField("DriverRate", selectedWorker.DriverRate)}
            ${detailField("Active", isActive ? "Active" : "Inactive")}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3 class="text-xl font-semibold">Jobs</h3>
        </div>

        <div class="panel-body">
          <div class="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>CalendarName</th>
                  <th>ClientName</th>
                  <th>JobSequence</th>
                  <th>Company</th>
                  <th>Zone</th>
                  <th>ArrivalTime</th>
                  <th>DisplayDuration</th>
                  <th>Address</th>
                  <th>RateType</th>
                  <th>AssignedTime</th>
                  <th>Role</th>
                  <th>Rate</th>
                  <th>Job Pay</th>
                  <th>WorkerZone</th>
                  <th>ServiceType</th>
                  <th>EventId</th>
                </tr>
              </thead>
              <tbody>
                ${
                  workerJobs.length === 0
                    ? `<tr><td colspan="17" class="text-center text-slate-500">No jobs found for this worker.</td></tr>`
                    : workerJobs.map((row) => `
                      <tr>
                        <td title="${escapeHtml(row.Date)}">${escapeHtml(row.Date)}</td>
                        <td title="${escapeHtml(row.CalendarName)}">${escapeHtml(row.CalendarName)}</td>
                        <td title="${escapeHtml(row.ClientName)}">${escapeHtml(row.ClientName)}</td>
                        <td title="${escapeHtml(row.JobSequence)}">${escapeHtml(row.JobSequence)}</td>
                        <td title="${escapeHtml(row.Company)}">${escapeHtml(row.Company)}</td>
                        <td title="${escapeHtml(row.Zone)}">${escapeHtml(row.Zone)}</td>
                        <td title="${escapeHtml(row.ArrivalTime)}">${escapeHtml(row.ArrivalTime)}</td>
                        <td title="${escapeHtml(row.DisplayDuration)}">${escapeHtml(row.DisplayDuration)}</td>
                        <td title="${escapeHtml(row.Address)}">${escapeHtml(row.Address)}</td>
                        <td title="${escapeHtml(row.RateType)}">${escapeHtml(row.RateType)}</td>
                        <td title="${escapeHtml(row.AssignedTime)}">${escapeHtml(row.AssignedTime)}</td>
                        <td title="${escapeHtml(row.Role)}">${escapeHtml(row.Role)}</td>
                        <td title="${escapeHtml(row.Rate)}">${escapeHtml(row.Rate)}</td>
                        <td title="${escapeHtml(formatCurrency(calculateJobPay(row)))}">${escapeHtml(formatCurrency(calculateJobPay(row)))}</td>
                        <td title="${escapeHtml(row.WorkerZone)}">${escapeHtml(row.WorkerZone)}</td>
                        <td title="${escapeHtml(row.ServiceType)}">${escapeHtml(row.ServiceType)}</td>
                        <td title="${escapeHtml(row.EventId)}">${escapeHtml(row.EventId)}</td>
                      </tr>
                    `).join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
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
        <div class="success-box mb-4">
          Sales tab created successfully.
        </div>
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

async function openWorkerProfile() {
  if (!selectedWorker) return;

  try {
    currentView = "workerProfile";
    toggleFilterGroups();
    renderLoadingState("Worker Profile");

    if (!jobsPerWorkerLoadedFromApi) {
      await loadJobsPerWorkerFromApi();
    }

    render();
  } catch (error) {
    console.error("Error loading worker profile:", error);
    renderErrorState(error.message || "Unknown error while loading Worker Profile.");
  }
}

function closeWorkerProfile() {
  currentView = "main";
  toggleFilterGroups();
  render();
}

function detailField(label, value) {
  return `
    <div>
      <label class="block text-sm font-medium mb-1">${escapeHtml(label)}</label>
      <input class="toolbar-input" value="${escapeHtml(value || "")}" disabled />
    </div>
  `;
}

function detailTextarea(label, value) {
  return `
    <div>
      <label class="block text-sm font-medium mb-1">${escapeHtml(label)}</label>
      <textarea class="toolbar-textarea" rows="3" disabled>${escapeHtml(value || "")}</textarea>
    </div>
  `;
}

function selectEventByFilteredIndex(index) {
  const filteredRows = getFilteredRowsByTab();
  selectedEvent = filteredRows[index] || null;
  copyStatusMessage = "";
  render();
}

function selectWorkerByFilteredIndex(index) {
  const filteredWorkers = getFilteredWorkers();
  selectedWorker = filteredWorkers[index] || null;
  render();
}

function clearFilters() {
  const searchInput = document.getElementById("search");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  const workerSearch = document.getElementById("workerSearch");
  const workerActiveFilter = document.getElementById("workerActiveFilter");

  if (searchInput) searchInput.value = "";
  if (startDateInput) startDateInput.value = "";
  if (endDateInput) endDateInput.value = "";
  if (workerSearch) workerSearch.value = "";
  if (workerActiveFilter) workerActiveFilter.value = "";

  if (["events", "jobs", "travel"].includes(currentTab)) {
    selectAllCalendars();
    return;
  }

  render();
}

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

  if (searchInput) {
    searchInput.value = "";
    searchInput.addEventListener("input", render);
  }

  if (startDateInput) {
    startDateInput.value = "";
    startDateInput.addEventListener("change", render);
  }

  if (endDateInput) {
    endDateInput.value = "";
    endDateInput.addEventListener("change", render);
  }

  if (workerSearch) {
    workerSearch.value = "";
    workerSearch.addEventListener("input", render);
  }

  if (workerActiveFilter) {
    workerActiveFilter.value = "";
    workerActiveFilter.addEventListener("change", render);
  }

  toggleFilterGroups();

  try {
    await loadDashboardMetaFromApi();
  } catch (error) {
    console.error("Could not load dashboard meta:", error);
    updateLastSyncText();
  }

  refreshEvents();
});
