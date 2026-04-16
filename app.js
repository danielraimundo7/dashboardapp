const API_BASE_URL =
  "https://script.google.com/macros/s/AKfycbwz401Ii47fb86kB-eo93tirJmGpbHFS2jEonIn6yuFjNqu5rxjQiPvUTOzDkvAvoPR/exec";

let currentTab = "jobs";
let currentView = "main";

let jobs = [];
let workers = [];
let jobsPerWorker = [];

let selectedJob = null;
let selectedWorker = null;

let jobsLoadedFromApi = false;
let workersLoadedFromApi = false;
let jobsPerWorkerLoadedFromApi = false;
let dashboardMeta = { lastSyncIso: "" };

let revenueLaborChart = null;
let assignedTimeChart = null;
let selectedCalendars = new Set();
let chartsMinimized = false;

let payrollSelectedWorkerId = "";
let payrollSelectedWeekStart = "";

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

function getUniqueCalendars() {
  return [...new Set(
    jobs
      .map((job) => String(job.CalendarName || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

function setTab(tab, event) {
  currentTab = tab;
  currentView = "main";

  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (event && event.target) {
    event.target.classList.add("active");
  }

  toggleFilterGroups();

  if (tab === "jobs" && !jobsLoadedFromApi) {
    refreshJobs();
    return;
  }

  if (tab === "workers" && !workersLoadedFromApi) {
    refreshWorkers();
    return;
  }

  if (tab === "payroll" && !workersLoadedFromApi) {
    refreshWorkers();
    return;
  }

  render();
}

function toggleChartsVisibility() {
  chartsMinimized = !chartsMinimized;
  applyChartsVisibility();

  if (currentTab === "jobs" && currentView === "main") {
    render();
  }
}

function applyChartsVisibility() {
  const chartsShell = document.getElementById("dashboardChartsShell");
  const charts = document.getElementById("dashboardCharts");
  const btn = document.getElementById("toggleChartsBtn");

  const shouldShowShell = currentTab === "jobs" && currentView === "main";

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
  const jobsFilters = document.getElementById("jobsFilters");
  const workersFilters = document.getElementById("workersFilters");
  const primaryCountLabel = document.getElementById("primaryCountLabel");

  if (jobsFilters) {
    jobsFilters.classList.toggle("hidden", currentTab !== "jobs" || currentView !== "main");
  }

  if (workersFilters) {
    workersFilters.classList.toggle("hidden", currentTab !== "workers" || currentView !== "main");
  }

  if (primaryCountLabel) {
    if (currentTab === "workers") {
      primaryCountLabel.innerText = "Workers";
    } else if (currentTab === "mileage") {
      primaryCountLabel.innerText = "Mileage";
    } else if (currentTab === "payroll") {
      primaryCountLabel.innerText = "Payroll";
    } else {
      primaryCountLabel.innerText = "Jobs";
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

async function loadJobsFromApi() {
  const url = `${API_BASE_URL}?action=getJobs&_=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading Jobs.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to load Jobs data.");
  }

  jobs = Array.isArray(result.data) ? result.data : [];
  jobsLoadedFromApi = true;

  initializeCalendarSelection();
  renderCalendarChecklist();
  updateCalendarButtonLabel();

  if (!selectedJob && jobs.length > 0) {
    selectedJob = jobs[0];
  }
}

async function loadWorkersFromApi() {
  const url = `${API_BASE_URL}?action=getWorkers&_=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

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
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store"
  });

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
  selectedCalendars = new Set(
    [...selectedCalendars].filter((name) => validCalendars.has(name))
  );

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
  if (isChecked) {
    selectedCalendars.add(calendarName);
  } else {
    selectedCalendars.delete(calendarName);
  }

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

async function refreshJobs() {
  try {
    jobsLoadedFromApi = false;
    jobs = [];
    selectedJob = null;

    renderLoadingState("Jobs");

    await Promise.all([
      loadJobsFromApi(),
      loadDashboardMetaFromApi()
    ]);

    render();
  } catch (error) {
    console.error("Error loading Jobs:", error);
    renderErrorState(error.message || "Unknown error while loading Jobs.");
  }
}

async function refreshWorkers() {
  try {
    workersLoadedFromApi = false;
    workers = [];
    selectedWorker = null;

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

function refreshCurrentTab() {
  if (currentTab === "workers") {
    if (currentView === "workerProfile") {
      jobsPerWorkerLoadedFromApi = false;
      jobsPerWorker = [];
    }
    refreshWorkers();
    return;
  }

  if (currentTab === "payroll") {
    if (!workersLoadedFromApi) {
      refreshWorkers();
      return;
    }
    render();
    return;
  }

  if (currentTab === "mileage") {
    render();
    return;
  }

  refreshJobs();
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

function getFilteredJobs() {
  const searchInput = document.getElementById("search");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const startDateValue = startDateInput ? startDateInput.value : "";
  const endDateValue = endDateInput ? endDateInput.value : "";

  return jobs.filter((job) => {
    const matchesSearch =
      !searchValue || JSON.stringify(job).toLowerCase().includes(searchValue);

    const jobDate = job.Date || "";

    const matchesStartDate =
      !startDateValue || (jobDate && jobDate >= startDateValue);

    const matchesEndDate =
      !endDateValue || (jobDate && jobDate <= endDateValue);

    const matchesCalendar =
      selectedCalendars.size === 0
        ? true
        : selectedCalendars.has(String(job.CalendarName || "").trim());

    return matchesSearch && matchesStartDate && matchesEndDate && matchesCalendar;
  });
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

function round2(value) {
  return Math.round((value || 0) * 100) / 100;
}

function getSundayForDate(input) {
  const d = new Date(`${input}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday;
}

function formatDateYmd(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return "";
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateFriendly(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getPayrollWeekRange(weekStartStr) {
  const sunday = getSundayForDate(weekStartStr);
  if (!sunday) return null;

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  return {
    start: formatDateYmd(sunday),
    end: formatDateYmd(saturday)
  };
}

function getCurrentPayrollWeekStart() {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  return formatDateYmd(sunday);
}

function ensurePayrollDefaults() {
  if (!payrollSelectedWeekStart) {
    payrollSelectedWeekStart = getCurrentPayrollWeekStart();
  }
}

function getPayrollWorkerOptions() {
  return [...workers]
    .sort((a, b) => String(a.Name || "").localeCompare(String(b.Name || "")));
}

function getPayrollRowsForWeek() {
  ensurePayrollDefaults();

  const range = getPayrollWeekRange(payrollSelectedWeekStart);
  if (!range) return [];

  const workerFilter = String(payrollSelectedWorkerId || "").trim();

  return jobsPerWorker.filter((row) => {
    const rowDate = String(row.Date || "").trim();
    if (!rowDate) return false;
    if (rowDate < range.start || rowDate > range.end) return false;

    if (workerFilter && String(row.WorkerID || "").trim() !== workerFilter) {
      return false;
    }

    return true;
  });
}

function buildPayrollSummary(rows) {
  const totalAssignedHours = rows.reduce((sum, row) => sum + toNumber(row.AssignedTime), 0);
  const totalLaborPay = rows.reduce((sum, row) => sum + calculateJobPay(row), 0);

  const uniqueWorkers = new Set(
    rows.map((row) => String(row.WorkerID || "").trim()).filter(Boolean)
  ).size;

  return {
    jobs: rows.length,
    workers: uniqueWorkers,
    assignedHours: totalAssignedHours,
    laborPay: totalLaborPay
  };
}

function onPayrollWeekChange(value) {
  payrollSelectedWeekStart = value;
  render();
}

function onPayrollWorkerChange(value) {
  payrollSelectedWorkerId = value;
  render();
}

function updateSummaryCardsForJobs(filteredJobs) {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  const houseCount = filteredJobs.length;
  const revenueTotal = filteredJobs.reduce((sum, row) => sum + toNumber(row.GivenPrice), 0);
  const laborTotal = filteredJobs.reduce((sum, row) => sum + toNumber(row.LaborCosts), 0);
  const assignedTimeTotal = filteredJobs.reduce((sum, row) => sum + toNumber(row.AssignedTime), 0);

  if (countEl) countEl.innerText = houseCount;
  if (revenueEl) revenueEl.innerText = formatCurrency(revenueTotal);
  if (laborEl) laborEl.innerText = formatCurrency(laborTotal);
  if (assignedEl) assignedEl.innerText = formatHours(assignedTimeTotal);
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

function updateSummaryCardsForMileage() {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  if (countEl) countEl.innerText = "-";
  if (revenueEl) revenueEl.innerText = "-";
  if (laborEl) laborEl.innerText = "-";
  if (assignedEl) assignedEl.innerText = "-";
}

function updateSummaryCardsForPayroll(summary) {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  if (countEl) countEl.innerText = summary.jobs;
  if (revenueEl) revenueEl.innerText = formatCurrency(summary.laborPay);
  if (laborEl) laborEl.innerText = `${summary.workers}`;
  if (assignedEl) assignedEl.innerText = formatHours(summary.assignedHours);
}

function buildJobsMetricsByDate(filteredJobs) {
  const grouped = {};

  filteredJobs.forEach((row) => {
    const date = String(row.Date || "");
    if (!date) return;

    if (!grouped[date]) {
      grouped[date] = {
        revenue: 0,
        labor: 0,
        assignedTime: 0,
        houses: 0
      };
    }

    grouped[date].revenue += toNumber(row.GivenPrice);
    grouped[date].labor += toNumber(row.LaborCosts);
    grouped[date].assignedTime += toNumber(row.AssignedTime);
    grouped[date].houses += 1;
  });

  const labels = Object.keys(grouped).sort();

  return {
    labels,
    revenue: labels.map((d) => grouped[d].revenue),
    labor: labels.map((d) => grouped[d].labor),
    assignedTime: labels.map((d) => grouped[d].assignedTime),
    houses: labels.map((d) => grouped[d].houses)
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

function renderJobsCharts(filteredJobs) {
  const revenueCanvas = document.getElementById("revenueLaborChart");
  const assignedCanvas = document.getElementById("assignedTimeChart");
  if (!revenueCanvas || !assignedCanvas) return;

  destroyCharts();

  const metrics = buildJobsMetricsByDate(filteredJobs);

  revenueLaborChart = new Chart(revenueCanvas, {
    type: "bar",
    data: {
      labels: metrics.labels,
      datasets: [
        {
          label: "Revenue",
          data: metrics.revenue
        },
        {
          label: "Labor Cost",
          data: metrics.labor
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  assignedTimeChart = new Chart(assignedCanvas, {
    type: "line",
    data: {
      labels: metrics.labels,
      datasets: [
        {
          label: "Assigned Time (hrs)",
          data: metrics.assignedTime
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function hideChartsForWorkers() {
  destroyCharts();
}

function render() {
  toggleFilterGroups();

  const apiStatus = document.getElementById("apiStatus");
  if (apiStatus) {
    if (currentTab === "workers") {
      apiStatus.innerText = workersLoadedFromApi ? "Yes" : "No";
    } else if (currentTab === "mileage" || currentTab === "payroll") {
      apiStatus.innerText = currentTab === "payroll" ? (workersLoadedFromApi ? "Yes" : "No") : "N/A";
    } else {
      apiStatus.innerText = jobsLoadedFromApi ? "Yes" : "No";
    }
  }

  if (currentTab === "mileage") {
    destroyCharts();
    updateSummaryCardsForMileage();
    renderMileageTab();
    return;
  }

  if (currentTab === "payroll") {
    destroyCharts();
    ensurePayrollDefaults();
    const payrollRows = getPayrollRowsForWeek();
    const payrollSummary = buildPayrollSummary(payrollRows);
    updateSummaryCardsForPayroll(payrollSummary);
    renderPayrollTab(payrollRows, payrollSummary);
    return;
  }

  if (currentTab === "workers") {
    const filteredWorkers = getFilteredWorkers();
    updateSummaryCardsForWorkers(filteredWorkers);
    hideChartsForWorkers();

    if (selectedWorker) {
      const stillExists = filteredWorkers.some(
        (worker) => String(worker.WorkerID || "") === String(selectedWorker.WorkerID || "")
      );
      if (!stillExists) {
        selectedWorker = filteredWorkers[0] || null;
      }
    } else {
      selectedWorker = filteredWorkers[0] || null;
    }

    if (currentView === "workerProfile") {
      renderWorkerProfileView();
    } else {
      renderWorkersTab(filteredWorkers);
    }
    return;
  }

  renderCalendarChecklist();
  updateCalendarButtonLabel();

  const filteredJobs = getFilteredJobs();
  updateSummaryCardsForJobs(filteredJobs);

  if (!chartsMinimized && filteredJobs.length > 0) {
    renderJobsCharts(filteredJobs);
  } else {
    destroyCharts();
  }

  if (selectedJob) {
    const stillExists = filteredJobs.some(
      (job) => String(job.EventId || "") === String(selectedJob.EventId || "")
    );
    if (!stillExists) {
      selectedJob = filteredJobs[0] || null;
    }
  } else {
    selectedJob = filteredJobs[0] || null;
  }

  renderJobsTab(filteredJobs);
}

function renderJobsTab(filteredJobs) {
  const content = document.getElementById("content");
  if (!content) return;

  const selected = selectedJob || filteredJobs[0] || null;

  content.innerHTML = `
    <div class="jobs-layout">
      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 class="text-2xl font-semibold">Jobs</h2>
              <p class="text-sm text-slate-500">
                Live data pulled from the Google Sheets tab named Jobs.
              </p>
              <p class="text-sm text-slate-500 mt-1">
                Total API rows: <strong>${jobs.length}</strong> |
                Filtered rows: <strong>${filteredJobs.length}</strong>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="secondary-btn" onclick="clearFilters()" type="button">Clear Filters</button>
              <button class="secondary-btn" onclick="refreshJobs()" type="button">Refresh Jobs</button>
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
                  <th>Frequency</th>
                  <th>Zone</th>
                  <th>DisplayDuration</th>
                  <th>ArrivalTime</th>
                  <th>Company</th>
                  <th>Address</th>
                  <th>GivenPrice</th>
                  <th>RateType</th>
                  <th>PaymentType</th>
                  <th>AssignedTime</th>
                  <th>WorkerCount</th>
                  <th>ServiceType</th>
                  <th>Entrance</th>
                  <th>KeyInfo</th>
                  <th>MaterialInfo</th>
                  <th>Instructions</th>
                  <th>Notes</th>
                  <th>EventId</th>
                  <th>WorkerInfo</th>
                  <th>LaborCosts</th>
                  <th>LaborCosts + Expense</th>
                  <th>Gross Profit</th>
                  <th>ProfitMargin</th>
                  <th>PDF link</th>
                </tr>
              </thead>
              <tbody>
                ${
                  filteredJobs.length === 0
                    ? `
                      <tr>
                        <td colspan="27" class="text-center text-slate-500">
                          No jobs matched your filters.
                        </td>
                      </tr>
                    `
                    : filteredJobs
                        .map((job, index) => `
                          <tr class="clickable-row" onclick="selectJobByFilteredIndex(${index})">
                            <td title="${escapeHtml(job.Date)}">${escapeHtml(job.Date)}</td>
                            <td title="${escapeHtml(job.CalendarName)}">${escapeHtml(job.CalendarName)}</td>
                            <td title="${escapeHtml(job.ClientName)}">${escapeHtml(job.ClientName)}</td>
                            <td title="${escapeHtml(job.Frequency)}">${escapeHtml(job.Frequency)}</td>
                            <td title="${escapeHtml(job.Zone)}">${escapeHtml(job.Zone)}</td>
                            <td title="${escapeHtml(job.DisplayDuration)}">${escapeHtml(job.DisplayDuration)}</td>
                            <td title="${escapeHtml(job.ArrivalTime)}">${escapeHtml(job.ArrivalTime)}</td>
                            <td title="${escapeHtml(job.Company)}">${escapeHtml(job.Company)}</td>
                            <td title="${escapeHtml(job.Address)}">${escapeHtml(job.Address)}</td>
                            <td title="${escapeHtml(job.GivenPrice)}">${escapeHtml(job.GivenPrice)}</td>
                            <td title="${escapeHtml(job.RateType)}">${escapeHtml(job.RateType)}</td>
                            <td title="${escapeHtml(job.PaymentType)}">${escapeHtml(job.PaymentType)}</td>
                            <td title="${escapeHtml(job.AssignedTime)}">${escapeHtml(job.AssignedTime)}</td>
                            <td title="${escapeHtml(job.WorkerCount)}">${escapeHtml(job.WorkerCount)}</td>
                            <td title="${escapeHtml(job.ServiceType)}">${escapeHtml(job.ServiceType)}</td>
                            <td title="${escapeHtml(job.Entrance)}">${escapeHtml(job.Entrance)}</td>
                            <td title="${escapeHtml(job.KeyInfo)}">${escapeHtml(job.KeyInfo)}</td>
                            <td title="${escapeHtml(job.MaterialInfo)}">${escapeHtml(job.MaterialInfo)}</td>
                            <td title="${escapeHtml(job.Instructions)}">${escapeHtml(job.Instructions)}</td>
                            <td title="${escapeHtml(job.Notes)}">${escapeHtml(job.Notes)}</td>
                            <td title="${escapeHtml(job.EventId)}">${escapeHtml(job.EventId)}</td>
                            <td title="${escapeHtml(job.WorkerInfo)}">${escapeHtml(job.WorkerInfo)}</td>
                            <td title="${escapeHtml(job.LaborCosts)}">${escapeHtml(job.LaborCosts)}</td>
                            <td title="${escapeHtml(job["LaborCosts + Expense"])}">${escapeHtml(job["LaborCosts + Expense"])}</td>
                            <td title="${escapeHtml(job["Gross Profit"])}">${escapeHtml(job["Gross Profit"])}</td>
                            <td title="${escapeHtml(job.ProfitMargin)}"><span class="badge badge-neutral">${escapeHtml(job.ProfitMargin)}</span></td>
                            <td>
                              ${
                                job["PDF link"]
                                  ? `<a href="${escapeHtml(job["PDF link"])}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">Open PDF</a>`
                                  : ""
                              }
                            </td>
                          </tr>
                        `)
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3 class="text-lg font-semibold">Job Detail</h3>
        </div>

        <div class="panel-body space-y-4">
          ${
            selected
              ? `
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Job</p>
                  <p class="mt-1 text-base font-semibold">
                    ${escapeHtml(selected.ClientName)} — ${escapeHtml(selected.ServiceType)}
                  </p>
                </div>

                <div class="grid grid-cols-1 gap-3">
                  ${detailField("Date", selected.Date)}
                  ${detailField("CalendarName", selected.CalendarName)}
                  ${detailField("ClientName", selected.ClientName)}
                  ${detailField("Frequency", selected.Frequency)}
                  ${detailField("Zone", selected.Zone)}
                  ${detailField("DisplayDuration", selected.DisplayDuration)}
                  ${detailField("ArrivalTime", selected.ArrivalTime)}
                  ${detailField("Company", selected.Company)}
                  ${detailField("Address", selected.Address)}
                  ${detailField("GivenPrice", selected.GivenPrice)}
                  ${detailField("RateType", selected.RateType)}
                  ${detailField("PaymentType", selected.PaymentType)}
                  ${detailField("AssignedTime", selected.AssignedTime)}
                  ${detailField("WorkerCount", selected.WorkerCount)}
                  ${detailField("ServiceType", selected.ServiceType)}
                  ${detailField("Entrance", selected.Entrance)}
                  ${detailTextarea("KeyInfo", selected.KeyInfo)}
                  ${detailTextarea("MaterialInfo", selected.MaterialInfo)}
                  ${detailTextarea("Instructions", selected.Instructions)}
                  ${detailTextarea("Notes", selected.Notes)}
                  ${detailField("EventId", selected.EventId)}
                  ${detailTextarea("WorkerInfo", selected.WorkerInfo)}
                  ${detailField("LaborCosts", selected.LaborCosts)}
                  ${detailField("LaborCosts + Expense", selected["LaborCosts + Expense"])}
                  ${detailField("Gross Profit", selected["Gross Profit"])}
                  ${detailField("ProfitMargin", selected.ProfitMargin)}
                  ${
                    selected["PDF link"]
                      ? `<div><a href="${escapeHtml(selected["PDF link"])}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">Open Estimate PDF</a></div>`
                      : ""
                  }
                </div>
              `
              : `<div class="text-slate-500">No job selected.</div>`
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
              <p class="text-sm text-slate-500">
                Live data pulled from the Google Sheets tab named Workers.
              </p>
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
                    ? `
                      <tr>
                        <td colspan="7" class="text-center text-slate-500">
                          No workers matched your filters.
                        </td>
                      </tr>
                    `
                    : filteredWorkers
                        .map((worker, index) => `
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
                        `)
                        .join("")
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
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Worker</p>
                  <p class="mt-1 text-base font-semibold">${escapeHtml(selected.Name)}</p>
                </div>

                <div class="grid grid-cols-1 gap-3">
                  ${detailField("WorkerID", selected.WorkerID)}
                  ${detailField("Name", selected.Name)}
                  ${detailField("Role", selected.Role)}
                  ${detailField("BaseRate", selected.BaseRate)}
                  ${detailField("#", selected["#"])}
                  ${detailField("DriverRate", selected.DriverRate)}
                  ${detailField("Active", normalizeActiveValue(selected.Active) ? "Active" : "Inactive")}
                </div>
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
                <span class="badge ${getActiveBadgeClass(isActive)}">
                  ${isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p class="text-sm text-slate-500 mt-2">
                Worker profile with job history from JobsPerWorker.
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
              <div class="stat-label">Jobs Found</div>
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
          <h3 class="text-xl font-semibold">Jobs Performed</h3>
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
                    ? `
                      <tr>
                        <td colspan="17" class="text-center text-slate-500">
                          No jobs found for this worker.
                        </td>
                      </tr>
                    `
                    : workerJobs
                        .map((row) => `
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
                        `)
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMileageTab() {
  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-2xl font-semibold">Mileage</h2>
            <p class="text-sm text-slate-500">
              This section is intentionally blank for now while we plan the mileage workflow.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="secondary-btn" onclick="render()" type="button">Refresh View</button>
          </div>
        </div>
      </div>

      <div class="panel-body">
        <div class="success-box mb-4">
          Mileage tab created successfully. Backend/API logic will be added later.
        </div>

        <div class="blank-state-box">
          <h3 class="text-lg font-semibold mb-2">Coming Soon</h3>
          <p class="text-slate-600">
            Later, this page can hold mileage reports, drive-time summaries, route legs,
            map-based travel calculations, and payroll-related travel exports.
          </p>
        </div>
      </div>
    </div>
  `;
}

function renderPayrollTab(payrollRows, payrollSummary) {
  const content = document.getElementById("content");
  if (!content) return;

  ensurePayrollDefaults();
  const range = getPayrollWeekRange(payrollSelectedWeekStart);
  const workerOptions = getPayrollWorkerOptions();

  content.innerHTML = `
    <div class="space-y-6">
      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 class="text-2xl font-semibold">Payroll</h2>
              <p class="text-sm text-slate-500">
                Weekly payroll shell locked to Sunday–Saturday.
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="secondary-btn" onclick="render()" type="button">Refresh View</button>
            </div>
          </div>
        </div>

        <div class="panel-body">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Payroll Week Start (Sunday)</label>
              <input
                type="date"
                class="toolbar-input"
                value="${escapeHtml(payrollSelectedWeekStart)}"
                onchange="onPayrollWeekChange(this.value)"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Worker</label>
              <select class="toolbar-select" onchange="onPayrollWorkerChange(this.value)">
                <option value="">All Workers</option>
                ${workerOptions
                  .map((worker) => `
                    <option
                      value="${escapeHtml(worker.WorkerID || "")}"
                      ${String(payrollSelectedWorkerId) === String(worker.WorkerID || "") ? "selected" : ""}
                    >
                      ${escapeHtml(worker.Name || "")}
                    </option>
                  `)
                  .join("")}
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Payroll Week End (Saturday)</label>
              <input
                class="toolbar-input"
                value="${escapeHtml(range ? range.end : "")}"
                disabled
              />
            </div>
          </div>

          <div class="mt-4 success-box">
            Current payroll week:
            <strong>${escapeHtml(range ? `${formatDateFriendly(range.start)} → ${formatDateFriendly(range.end)}` : "Not available")}</strong>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="stat-card">
          <div class="stat-label">Jobs In Week</div>
          <div class="stat-value text-lg">${payrollSummary.jobs}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Workers Included</div>
          <div class="stat-value text-lg">${payrollSummary.workers}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Assigned Hours</div>
          <div class="stat-value text-lg">${formatHours(payrollSummary.assignedHours)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Labor Pay</div>
          <div class="stat-value text-lg">${formatCurrency(payrollSummary.laborPay)}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3 class="text-xl font-semibold">Weekly Payroll Rows</h3>
        </div>

        <div class="panel-body">
          <div class="success-box mb-4">
            This is the weekly payroll shell. Mileage, drive compensation, overtime,
            bonuses, and other adjustments can be added next.
          </div>

          <div class="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Worker</th>
                  <th>WorkerID</th>
                  <th>Client</th>
                  <th>Company</th>
                  <th>Arrival</th>
                  <th>AssignedTime</th>
                  <th>Rate</th>
                  <th>Labor Pay</th>
                  <th>Role</th>
                  <th>ServiceType</th>
                </tr>
              </thead>
              <tbody>
                ${
                  payrollRows.length === 0
                    ? `
                      <tr>
                        <td colspan="11" class="text-center text-slate-500">
                          No payroll rows found for this Sunday–Saturday week.
                        </td>
                      </tr>
                    `
                    : payrollRows
                        .sort((a, b) => {
                          const dateCompare = String(a.Date || "").localeCompare(String(b.Date || ""));
                          if (dateCompare !== 0) return dateCompare;
                          return String(a.WorkerName || "").localeCompare(String(b.WorkerName || ""));
                        })
                        .map((row) => `
                          <tr>
                            <td title="${escapeHtml(row.Date)}">${escapeHtml(row.Date)}</td>
                            <td title="${escapeHtml(row.WorkerName)}">${escapeHtml(row.WorkerName)}</td>
                            <td title="${escapeHtml(row.WorkerID)}">${escapeHtml(row.WorkerID)}</td>
                            <td title="${escapeHtml(row.ClientName)}">${escapeHtml(row.ClientName)}</td>
                            <td title="${escapeHtml(row.Company)}">${escapeHtml(row.Company)}</td>
                            <td title="${escapeHtml(row.ArrivalTime)}">${escapeHtml(row.ArrivalTime)}</td>
                            <td title="${escapeHtml(row.AssignedTime)}">${escapeHtml(row.AssignedTime)}</td>
                            <td title="${escapeHtml(row.Rate)}">${escapeHtml(row.Rate)}</td>
                            <td title="${escapeHtml(formatCurrency(calculateJobPay(row)))}">${escapeHtml(formatCurrency(calculateJobPay(row)))}</td>
                            <td title="${escapeHtml(row.Role)}">${escapeHtml(row.Role)}</td>
                            <td title="${escapeHtml(row.ServiceType)}">${escapeHtml(row.ServiceType)}</td>
                          </tr>
                        `)
                        .join("")
                }
              </tbody>
            </table>
          </div>
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

function selectJobByFilteredIndex(index) {
  const filteredJobs = getFilteredJobs();
  selectedJob = filteredJobs[index] || null;
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

  if (currentTab === "jobs") {
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

  refreshJobs();
});
