const API_BASE_URL =
  "https://script.google.com/macros/s/AKfycbwz401Ii47fb86kB-eo93tirJmGpbHFS2jEonIn6yuFjNqu5rxjQiPvUTOzDkvAvoPR/exec";

let currentTab = "jobs";
let currentView = "main"; // "main" | "workerProfile"

let jobs = [];
let workers = [];
let jobsPerWorker = [];

let selectedJob = null;
let selectedWorker = null;

let jobsLoadedFromApi = false;
let workersLoadedFromApi = false;
let jobsPerWorkerLoadedFromApi = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeActiveValue(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "active" || v === "1" || v === "☑" || v === "✅";
}

function getActiveBadgeClass(isActive) {
  return isActive ? "badge-success" : "badge-danger";
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

  const activeTabLabel = document.getElementById("activeTabLabel");
  if (activeTabLabel) {
    activeTabLabel.innerText = tab.charAt(0).toUpperCase() + tab.slice(1);
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

  render();
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
    primaryCountLabel.innerText = currentTab === "workers" ? "Workers" : "Jobs";
  }
}

async function loadJobsFromApi() {
  const url = `${API_BASE_URL}?action=getJobs&_=${Date.now()}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
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

  populateCalendarFilter();

  if (!selectedJob && jobs.length > 0) {
    selectedJob = jobs[0];
  }
}

async function loadWorkersFromApi() {
  const url = `${API_BASE_URL}?action=getWorkers&_=${Date.now()}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
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
    cache: "no-store",
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

function populateCalendarFilter() {
  const calendarSelect = document.getElementById("calendarFilter");
  if (!calendarSelect) return;

  const currentValue = calendarSelect.value;

  const uniqueCalendars = [...new Set(
    jobs
      .map((job) => job.CalendarName || "")
      .filter((name) => name.trim() !== "")
  )].sort((a, b) => a.localeCompare(b));

  calendarSelect.innerHTML = `<option value="">All Calendars</option>`;

  uniqueCalendars.forEach((calendarName) => {
    const option = document.createElement("option");
    option.value = calendarName;
    option.textContent = calendarName;
    calendarSelect.appendChild(option);
  });

  calendarSelect.value = uniqueCalendars.includes(currentValue) ? currentValue : "";
}

async function refreshJobs() {
  try {
    jobsLoadedFromApi = false;
    jobs = [];
    selectedJob = null;

    renderLoadingState("Jobs");

    await loadJobsFromApi();
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

    await loadWorkersFromApi();
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
  refreshJobs();
}

function renderLoadingState(label) {
  const apiStatus = document.getElementById("apiStatus");
  if (apiStatus) {
    apiStatus.innerText = "Loading...";
  }

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
  if (apiStatus) {
    apiStatus.innerText = "Error";
  }

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
  const calendarFilter = document.getElementById("calendarFilter");

  const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const startDateValue = startDateInput ? startDateInput.value : "";
  const endDateValue = endDateInput ? endDateInput.value : "";
  const calendarValue = calendarFilter ? calendarFilter.value : "";

  return jobs.filter((job) => {
    const matchesSearch =
      !searchValue || JSON.stringify(job).toLowerCase().includes(searchValue);

    const jobDate = job.Date || "";

    const matchesStartDate =
      !startDateValue || (jobDate && jobDate >= startDateValue);

    const matchesEndDate =
      !endDateValue || (jobDate && jobDate <= endDateValue);

    const matchesCalendar =
      !calendarValue || (job.CalendarName || "") === calendarValue;

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

function render() {
  toggleFilterGroups();

  const apiStatus = document.getElementById("apiStatus");
  if (apiStatus) {
    apiStatus.innerText =
      currentTab === "workers"
        ? (workersLoadedFromApi ? "Yes" : "No")
        : (jobsLoadedFromApi ? "Yes" : "No");
  }

  if (currentTab === "workers") {
    const filteredWorkers = getFilteredWorkers();

    const countEl = document.getElementById("jobCount");
    if (countEl) {
      countEl.innerText = filteredWorkers.length;
    }

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

  const filteredJobs = getFilteredJobs();

  const countEl = document.getElementById("jobCount");
  if (countEl) {
    countEl.innerText = filteredJobs.length;
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
              <button class="secondary-btn" onclick="clearFilters()">Clear Filters</button>
              <button class="secondary-btn" onclick="refreshJobs()">Refresh Jobs</button>
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
                </tr>
              </thead>
              <tbody>
                ${
                  filteredJobs.length === 0
                    ? `
                      <tr>
                        <td colspan="26" class="text-center text-slate-500">
                          No jobs matched your filters.
                        </td>
                      </tr>
                    `
                    : filteredJobs
                        .map(
                          (job, index) => `
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
                      </tr>
                    `
                        )
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
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Selected Job
                  </p>
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
                </div>
              `
              : `
                <div class="text-slate-500">No job selected.</div>
              `
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
              <button class="secondary-btn" onclick="clearFilters()">Clear Filters</button>
              <button class="secondary-btn" onclick="refreshWorkers()">Refresh Workers</button>
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
                        .map(
                          (worker, index) => `
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
                    `
                        )
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
            ${
              selected
                ? `<button class="primary-btn" onclick="openWorkerProfile()">View Profile</button>`
                : ""
            }
          </div>
        </div>

        <div class="panel-body space-y-4">
          ${
            selected
              ? `
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Selected Worker
                  </p>
                  <p class="mt-1 text-base font-semibold">
                    ${escapeHtml(selected.Name)}
                  </p>
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
              : `
                <div class="text-slate-500">No worker selected.</div>
              `
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
          <button class="secondary-btn mt-4" onclick="closeWorkerProfile()">Back to Workers</button>
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
              <p class="text-sm text-slate-500 mt-2">Worker Profile View</p>
            </div>

            <div class="flex gap-2">
              <button class="secondary-btn" onclick="closeWorkerProfile()">Back to Workers</button>
            </div>
          </div>
        </div>

        <div class="panel-body">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="panel">
              <div class="panel-header">
                <h3 class="text-lg font-semibold">Profile Information</h3>
              </div>
              <div class="panel-body grid grid-cols-1 gap-3">
                ${detailField("WorkerID", selectedWorker.WorkerID)}
                ${detailField("Name", selectedWorker.Name)}
                ${detailField("Role", selectedWorker.Role)}
                ${detailField("BaseRate", selectedWorker.BaseRate)}
                ${detailField("#", selectedWorker["#"])}
                ${detailField("DriverRate", selectedWorker.DriverRate)}
                ${detailField("Active", isActive ? "Active" : "Inactive")}
              </div>
            </div>

            <div class="panel">
              <div class="panel-header">
                <h3 class="text-lg font-semibold">Quick Summary</h3>
              </div>
              <div class="panel-body grid grid-cols-1 gap-4">
                <div class="stat-card">Worker ID: ${escapeHtml(selectedWorker.WorkerID || "")}</div>
                <div class="stat-card">Role: ${escapeHtml(selectedWorker.Role || "")}</div>
                <div class="stat-card">Base Rate: ${escapeHtml(selectedWorker.BaseRate || "")}</div>
                <div class="stat-card">Driver Rate: ${escapeHtml(selectedWorker.DriverRate || "")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 class="text-xl font-semibold">Jobs Performed</h3>
              <p class="text-sm text-slate-500 mt-1">
                Jobs tied to WorkerID <strong>${escapeHtml(selectedWorker.WorkerID || "")}</strong>
              </p>
            </div>
            <div class="text-sm text-slate-500">
              Total rows: <strong>${workerJobs.length}</strong>
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
                        <td colspan="16" class="text-center text-slate-500">
                          No JobsPerWorker rows found for this worker yet.
                        </td>
                      </tr>
                    `
                    : workerJobs
                        .map(
                          (row) => `
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
                        <td title="${escapeHtml(row.WorkerZone)}">${escapeHtml(row.WorkerZone)}</td>
                        <td title="${escapeHtml(row.ServiceType)}">${escapeHtml(row.ServiceType)}</td>
                        <td title="${escapeHtml(row.EventId)}">${escapeHtml(row.EventId)}</td>
                      </tr>
                    `
                        )
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
  const calendarFilter = document.getElementById("calendarFilter");

  const workerSearch = document.getElementById("workerSearch");
  const workerActiveFilter = document.getElementById("workerActiveFilter");

  if (searchInput) searchInput.value = "";
  if (startDateInput) startDateInput.value = "";
  if (endDateInput) endDateInput.value = "";
  if (calendarFilter) calendarFilter.value = "";

  if (workerSearch) workerSearch.value = "";
  if (workerActiveFilter) workerActiveFilter.value = "";

  render();
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("search");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  const calendarFilter = document.getElementById("calendarFilter");

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

  if (calendarFilter) {
    calendarFilter.addEventListener("change", render);
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
  refreshJobs();
});