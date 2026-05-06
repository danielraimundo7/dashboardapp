import { state } from "./state.js";
import {
  escapeHtml,
  detailField,
  formatCurrency,
  getActiveBadgeClass,
  normalizeActiveValue
} from "./utils.js";

export function getSelectedWorkerJobs() {
  if (!state.selectedWorker) return [];
  const workerId = String(state.selectedWorker.WorkerID || "").trim();
  if (!workerId) return [];

  return state.jobsPerWorker
    .filter((row) => String(row.WorkerID || "").trim() === workerId)
    .filter((row) => String(row.EventType || "").trim().toLowerCase() !== "travel")
    .sort((a, b) => {
      const dateA = String(a.Date || "");
      const dateB = String(b.Date || "");
      if (dateA !== dateB) return dateB.localeCompare(dateA);

      const timeA = String(a.RequestedTime || "");
      const timeB = String(b.RequestedTime || "");
      return timeA.localeCompare(timeB);
    });
}

export function calculateJobPay(row) {
  const assigned = Number(row.AssignedTimeDecimal || 0);
  const rate = Number(row.Rate || 0);
  return assigned * rate;
}

function getSelectedWorkerRowClass(worker) {
  if (!state.selectedWorker) return "";
  return String(state.selectedWorker.WorkerID || "") === String(worker.WorkerID || "")
    ? "bg-slate-100 ring-1 ring-slate-300"
    : "";
}

function renderWorkerColumnFilterInput(key, placeholder = "Filter...") {
  const value = state.columnFilters?.workers?.[key] || "";
  return `
    <input
      type="text"
      class="column-filter-input"
      value="${escapeHtml(value)}"
      placeholder="${escapeHtml(placeholder)}"
      oninput="window.setColumnFilter('workers', '${key}', this.value)"
      onclick="event.stopPropagation()"
    />
  `;
}

function renderStatusBadge(status) {
  const normalized = String(status || "").trim().toUpperCase();

  let cls = "badge-neutral";
  if (normalized === "CANCELED") cls = "badge-danger";
  else if (normalized === "COMPLETED") cls = "badge-success";
  else if (normalized === "TENTATIVE") cls = "badge-warning";

  return `<span class="badge ${cls}">${escapeHtml(status || "")}</span>`;
}

export function renderWorkersTab(filteredWorkers) {
  const content = document.getElementById("content");
  if (!content) return;

  const selected = state.selectedWorker || filteredWorkers[0] || null;

  content.innerHTML = `
    <div class="jobs-layout">
      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 class="text-2xl font-semibold">Workers</h2>
              <p class="text-sm text-slate-500">Jobs · Availability · Payroll · Clocked Time</p>
              <p class="text-sm text-slate-500 mt-1">
                Total API rows: <strong>${state.workers.length}</strong> |
                Filtered rows: <strong>${filteredWorkers.length}</strong>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="secondary-btn" onclick="window.clearColumnFilters('workers')" type="button">Clear Column Filters</button>
              <button class="secondary-btn" onclick="window.clearFilters()" type="button">Clear Filters</button>
              <button class="secondary-btn" onclick="window.refreshWorkers()" type="button">Refresh Workers</button>
            </div>
          </div>
        </div>

        <div class="panel-body">
          <div class="table-scroll-wrap">
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
                <tr>
                  <th>${renderWorkerColumnFilterInput("WorkerID")}</th>
                  <th>${renderWorkerColumnFilterInput("Name")}</th>
                  <th>${renderWorkerColumnFilterInput("Role")}</th>
                  <th>${renderWorkerColumnFilterInput("BaseRate")}</th>
                  <th>${renderWorkerColumnFilterInput("#")}</th>
                  <th>${renderWorkerColumnFilterInput("DriverRate")}</th>
                  <th>${renderWorkerColumnFilterInput("Active")}</th>
                </tr>
              </thead>
              <tbody>
                ${
                  filteredWorkers.length === 0
                    ? `<tr><td colspan="7" class="text-center text-slate-500">No workers matched your filters.</td></tr>`
                    : filteredWorkers.map((worker, index) => `
                      <tr class="clickable-row ${getSelectedWorkerRowClass(worker)}" onclick="window.selectWorkerByFilteredIndex(${index})">
                        <td>${escapeHtml(worker.WorkerID)}</td>
                        <td>${escapeHtml(worker.Name)}</td>
                        <td>${escapeHtml(worker.Role)}</td>
                        <td>${escapeHtml(worker.BaseRate)}</td>
                        <td>${escapeHtml(worker["#"])}</td>
                        <td>${escapeHtml(worker.DriverRate)}</td>
                        <td>
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
            ${selected ? `<button class="primary-btn" onclick="window.openWorkerProfile()" type="button">View Profile</button>` : ""}
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

export function renderWorkerProfileView() {
  const content = document.getElementById("content");
  if (!content) return;

  if (!state.selectedWorker) {
    content.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h2 class="text-2xl font-semibold">Worker Profile</h2>
        </div>
        <div class="panel-body">
          <p class="text-slate-500">No worker selected.</p>
          <button class="secondary-btn mt-4" onclick="window.closeWorkerProfile()" type="button">Back to Workers</button>
        </div>
      </div>
    `;
    return;
  }

  const isActive = normalizeActiveValue(state.selectedWorker.Active);
  const workerJobs = getSelectedWorkerJobs();

  content.innerHTML = `
    <div class="space-y-6">
      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="flex items-center gap-3 flex-wrap">
                <h2 class="text-3xl font-semibold">${escapeHtml(state.selectedWorker.Name)}</h2>
                <span class="badge ${getActiveBadgeClass(isActive)}">${isActive ? "Active" : "Inactive"}</span>
              </div>
              <p class="text-sm text-slate-500 mt-2">
                Jobs · Availability · Payroll · Clocked Time
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="secondary-btn" onclick="window.closeWorkerProfile()" type="button">Back to Workers</button>
            </div>
          </div>
        </div>

        <div class="panel-body">
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div class="stat-card">
              <div class="stat-label">Worker ID</div>
              <div class="stat-value text-lg">${escapeHtml(state.selectedWorker.WorkerID || "-")}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Role</div>
              <div class="stat-value text-lg">${escapeHtml(state.selectedWorker.Role || "-")}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Base Rate</div>
              <div class="stat-value text-lg">${escapeHtml(state.selectedWorker.BaseRate || "-")}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Job Rows Found</div>
              <div class="stat-value text-lg">${workerJobs.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3 class="text-xl font-semibold">Jobs</h3>
        </div>

        <div class="panel-body">
          <div class="table-scroll-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>CalendarName</th>
                  <th>ClientName</th>
                  <th>Company</th>
                  <th>Zone</th>
                  <th>RequestedTime</th>
                  <th>AssignedTime</th>
                  <th>Address</th>
                  <th>RateType</th>
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
                    ? `<tr><td colspan="16" class="text-center text-slate-500">No jobs found for this worker.</td></tr>`
                    : workerJobs.map((row) => `
                      <tr>
                        <td>${escapeHtml(row.Date)}</td>
                        <td>${renderStatusBadge(row.Status)}</td>
                        <td>${escapeHtml(row.CalendarName)}</td>
                        <td>${escapeHtml(row.ClientName)}</td>
                        <td>${escapeHtml(row.Company)}</td>
                        <td>${escapeHtml(row.Zone)}</td>
                        <td>${escapeHtml(row.RequestedTime)}</td>
                        <td>${escapeHtml(row.AssignedTime)}</td>
                        <td>${escapeHtml(row.Address)}</td>
                        <td>${escapeHtml(row.RateType)}</td>
                        <td>${escapeHtml(row.Role)}</td>
                        <td>${escapeHtml(row.Rate)}</td>
                        <td>${escapeHtml(formatCurrency(calculateJobPay(row)))}</td>
                        <td>${escapeHtml(row.WorkerZone)}</td>
                        <td>${escapeHtml(row.ServiceType)}</td>
                        <td>${escapeHtml(row.EventId)}</td>
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