import { state } from "./state.js";
import { escapeHtml, toNumber } from "./utils.js";
import { createWorkerReportSpreadsheet } from "./api.js";


const REPORT_COLUMNS = [
  {
    key: "worker",
    label: "Worker",
    defaultSelected: true,
    totalType: null,
    affectsTotalPay: false
  },

  {
    key: "calendarName",
    label: "Calendar",
    defaultSelected: true,
    totalType: null,
    affectsTotalPay: false
  },

  {
    key: "client",
    label: "Client",
    defaultSelected: true,
    totalType: null,
    affectsTotalPay: false
  },

  {
    key: "date",
    label: "Date",
    defaultSelected: true,
    totalType: null,
    affectsTotalPay: false
  },

  {
    key: "dayOfWeek",
    label: "Day",
    defaultSelected: true,
    totalType: null,
    affectsTotalPay: false
  },

  {
    key: "rateType",
    label: "Pay Type",
    defaultSelected: true,
    totalType: null,
    affectsTotalPay: false
  },

  {
    key: "payout",
    label: "Payout",
    defaultSelected: true,
    totalType: "currency",
    affectsTotalPay: true
  },

  {
    key: "timeAssigned",
    label: "Time Assigned",
    defaultSelected: true,
    totalType: null,
    affectsTotalPay: false
  },

  {
    key: "assignedHours",
    label: "Assigned",
    defaultSelected: true,
    totalType: "number",
    affectsTotalPay: false
  },

  {
    key: "authorizedHours",
    label: "Authorized",
    defaultSelected: true,
    totalType: "number",
    affectsTotalPay: false
  },

  {
    key: "averagePayPerHour",
    label: "Avg Pay/Hr",
    defaultSelected: true,
    totalType: "currency",
    affectsTotalPay: false
  },

  {
    key: "pendingOvertime",
    label: "Pending OT",
    defaultSelected: true,
    totalType: "number",
    affectsTotalPay: false
  },

  {
    key: "otPay",
    label: "OT Pay",
    defaultSelected: true,
    totalType: "currency",
    affectsTotalPay: true
  },

  {
    key: "bonus",
    label: "Bonus",
    defaultSelected: true,
    totalType: "currency",
    affectsTotalPay: true
  },

  {
    key: "miles",
    label: "Miles",
    defaultSelected: false,
    totalType: "number",
    affectsTotalPay: false
  },

  {
    key: "milePay",
    label: "Mile Pay",
    defaultSelected: false,
    totalType: "currency",
    affectsTotalPay: true
  },

  {
    key: "driveOverageHours",
    label: "Drive Overage",
    defaultSelected: false,
    totalType: "number",
    affectsTotalPay: false
  },

  {
    key: "driveOveragePay",
    label: "Drive OT Pay",
    defaultSelected: false,
    totalType: "currency",
    affectsTotalPay: true
  },

  {
    key: "liability",
    label: "Liability",
    defaultSelected: false,
    totalType: "currency",
    affectsTotalPay: false
  },

  {
    key: "totalPay",
    label: "Total Pay",
    defaultSelected: true,
    totalType: "currency",
    affectsTotalPay: false
  }
];

function getDefaultReportColumnKeys() {
  return REPORT_COLUMNS
    .filter((column) => column.defaultSelected)
    .map((column) => column.key);
}

function getSelectedReportColumnKeys() {
  if (
    Array.isArray(state.reports.selectedColumns) &&
    state.reports.selectedColumns.length > 0
  ) {
    return state.reports.selectedColumns;
  }

  return getDefaultReportColumnKeys();
}

function getSelectedReportColumns() {
  const selectedKeys = new Set(getSelectedReportColumnKeys());

  return REPORT_COLUMNS.filter((column) =>
    selectedKeys.has(column.key)
  );
}

export function toggleReportColumn(key) {
  const defaultKeys = getDefaultReportColumnKeys();

  if (
    !Array.isArray(state.reports.selectedColumns) ||
    state.reports.selectedColumns.length === 0
  ) {
    state.reports.selectedColumns = [...defaultKeys];
  }

  if (state.reports.selectedColumns.includes(key)) {
    state.reports.selectedColumns =
      state.reports.selectedColumns.filter((columnKey) => columnKey !== key);
  } else {
    state.reports.selectedColumns = [
      ...state.reports.selectedColumns,
      key
    ];
  }

  state.reports.generatedReports = [];
  state.reports.message = "";
}

export function selectAllReportColumns() {
  state.reports.selectedColumns = REPORT_COLUMNS.map((column) => column.key);
  state.reports.generatedReports = [];
  state.reports.message = "";
}

export function resetDefaultReportColumns() {
  state.reports.selectedColumns = [];
  state.reports.generatedReports = [];
  state.reports.message = "";
}









function formatCurrency(value) {
  const n = Number(value || 0);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

function formatNumber(value, decimals = 2) {
  const n = Number(value || 0);
  return n.toFixed(decimals);
}

function parseDateOnly(value) {
  if (!value) return null;

  const text = String(value).trim();

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateInput(date) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDayName(dateText) {
  const d = parseDateOnly(dateText);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function getWorkerId(worker) {
  return String(worker.WorkerID || worker.workerId || worker.ID || "").trim();
}

function getWorkerName(worker) {
  return String(worker.Name || worker.WorkerName || worker.name || "").trim();
}

function getWorkerBaseRate(worker) {
  return toNumber(worker.BaseRate || worker.Rate || worker.rate) || 0;
}

function getJobWorkerId(row) {
  return String(row.WorkerID || "").trim();
}

function getJobDate(row) {
  return String(row.Date || "").trim();
}

function getJobClient(row) {
  return String(row.ClientName || "").trim();
}

function getJobAssignedHours(row) {
  return toNumber(row.AssignedTimeDecimal || row.AssignedTime) || 0;
}

function getJobRate(row) {
  return toNumber(row.Rate) || 0;
}

function getJobPayType(row) {
  return String(row.Role || row.RateType || "").trim().toLowerCase();
}

function getAuthorizedAssignedHours(row) {
  const assignedHours = getJobAssignedHours(row);

  const adjustmentText = String(row.AuthorizedTimeAdjustment || "").trim();

  const adjustmentMatch = adjustmentText.match(/([+-]?\d+)/);
  const adjustmentMinutes = adjustmentMatch
    ? Number(adjustmentMatch[1])
    : 0;

  return assignedHours + (adjustmentMinutes / 60);
}

function getWorkedMinutesForJob(workerId, eventId) {
  return (state.timeEntries || [])
    .filter((entry) => String(entry.WorkerID || "").trim() === workerId)
    .filter((entry) => String(entry.EventId || "").trim() === String(eventId || "").trim())
    .filter((entry) => String(entry.Status || "").toUpperCase() === "CLOSED")
    .reduce((sum, entry) => sum + (toNumber(entry.TotalMinutes) || 0), 0);
}

function getWorkedHoursForJob(workerId, eventId) {
  return getWorkedMinutesForJob(workerId, eventId) / 60;
}

function getPayableWorkedHours(row, workerId) {
  const workedHours = getWorkedHoursForJob(workerId, row.EventId);
  const authorizedHours = getAuthorizedAssignedHours(row);

  if (!workedHours) return 0;

  return Math.min(workedHours, authorizedHours);
}

function getWorkerAdjustment(row) {
  return Number(row.WorkerZone || 0);
}

function getJobPayout(row, workerId) {
  const payType = getJobPayType(row);
  const rate = getJobRate(row);
  const adjustment = getWorkerAdjustment(row);

  if (payType === "flat") {
    return rate + adjustment;
  }

  if (payType === "hourly") {
    const payableWorkedHours = getPayableWorkedHours(row, workerId);
    return (payableWorkedHours * rate) + adjustment;
  }

  return adjustment;
}

function getWeekRange() {
  const start = parseDateOnly(state.reports.weekStartDate);
  if (!start) return null;

  return {
    start,
    end: addDays(start, 6),
    startText: formatDateInput(start),
    endText: formatDateInput(addDays(start, 6))
  };
}

function rowIsInWeek(row, week) {
  const d = parseDateOnly(getJobDate(row));
  if (!d || !week) return false;
  return d >= week.start && d <= week.end;
}

function getRelevantWorkers() {
  const selectedWorkerId = String(state.reports.selectedWorkerId || "").trim();

  if (selectedWorkerId) {
    return (state.workers || []).filter((worker) => getWorkerId(worker) === selectedWorkerId);
  }

  const workerIdsInJobs = new Set(
    (state.jobsPerWorker || [])
      .map((row) => getJobWorkerId(row))
      .filter(Boolean)
  );

  return (state.workers || []).filter((worker) => workerIdsInJobs.has(getWorkerId(worker)));
}

function parseReportTimeToMinutes(value) {
  const text = String(value || "").trim();

  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return 0;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();

  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}



function buildWorkerReport(worker, week) {
  const workerId = getWorkerId(worker);
  const workerName = getWorkerName(worker);
  const fallbackBaseRate = getWorkerBaseRate(worker);

  const rows = (state.jobsPerWorker || [])
    .filter((row) => getJobWorkerId(row) === workerId)
    .filter((row) => rowIsInWeek(row, week))
    .sort((a, b) => {
  const dateCompare = String(a.Date || "").localeCompare(String(b.Date || ""));
  if (dateCompare !== 0) return dateCompare;

  return parseReportTimeToMinutes(a.StartTime || a.RequestedTime || "") -
    parseReportTimeToMinutes(b.StartTime || b.RequestedTime || "");
})
    .map((row) => {
      const originalAssignedHours = getJobAssignedHours(row);
      const assignedHours = getAuthorizedAssignedHours(row);
      const authorizedHours = assignedHours;

      const workedHours = 0;
      const payableWorkedHours = assignedHours;

      const baseRate = getJobRate(row) || fallbackBaseRate;
      let payout = 0;

        if (getJobPayType(row).includes("flat")) {
          payout = baseRate + getWorkerAdjustment(row);
        } else if (getJobPayType(row).includes("hourly")) {
          payout = assignedHours * baseRate + getWorkerAdjustment(row);
        }

      const averagePayPerHour =
        assignedHours > 0 ? payout / assignedHours : 0;

      return {
        worker: workerName,
        workerId,
        calendarName: String(row.CalendarName || "").trim(),
        client: getJobClient(row),
        date: getJobDate(row),
        dayOfWeek: getDayName(getJobDate(row)),
        rateType: getJobPayType(row),
        tip: 0,
        payout,
        timeAssigned: String(row.AssignedTime || ""),
        assignedHours,
        authorizedHours,
        workedTime: "",
        workedHours: assignedHours,
        payableWorkedHours: assignedHours,
        baseRate,
        averagePayPerHour,
        miles: "",
        milePay: "",
        driveOverageHours: "",
        driveOveragePay: "",
        liability: 0,
        pendingOvertime: 0,
        otPay: 0,
        bonus: 0,
        totalPay: payout
      };
    });

  const totals = rows.reduce((acc, row) => {
    acc.payout += row.payout;
    acc.assignedHours += row.assignedHours;
    acc.authorizedHours += row.authorizedHours;
    acc.workedHours += row.workedHours;
    acc.payableWorkedHours += row.payableWorkedHours;
    acc.miles += row.miles;
    acc.milePay += row.milePay;
    acc.driveOverageHours += row.driveOverageHours;
    acc.driveOveragePay += row.driveOveragePay;
    acc.liability += row.liability;
    acc.pendingOvertime += row.pendingOvertime;
    acc.otPay += row.otPay;
    acc.bonus += row.bonus;
    acc.totalPay += row.totalPay;
    return acc;
  }, {
    payout: 0,
    assignedHours: 0,
    authorizedHours: 0,
    workedHours: 0,
    payableWorkedHours: 0,
    miles: "",
    milePay: "",
    driveOverageHours: "",
    driveOveragePay: "",
    liability: 0,
    pendingOvertime: 0,
    otPay: 0,
    bonus: 0,
    totalPay: 0
  });

  totals.averagePayPerHour =
  totals.assignedHours > 0 ? totals.payout / totals.assignedHours : 0;

totals.pendingOvertime = Math.max(totals.assignedHours - 40, 0);

totals.otPay =
  totals.pendingOvertime > 0
    ? totals.pendingOvertime * totals.averagePayPerHour * 1.5
    : 0;

totals.totalPay = totals.payout + totals.otPay;

  return {
    workerId,
    workerName,
    weekStart: week.startText,
    weekEnd: week.endText,
    rows,
    totals
  };
}

export function setReportsWeekStartDate(value) {
  state.reports.weekStartDate = value;
  state.reports.generatedReports = [];
  state.reports.message = "";
}

export function setReportsSelectedWorkerId(value) {
  state.reports.selectedWorkerId = value;
  state.reports.generatedReports = [];
  state.reports.message = "";
}

export function generateWeeklyReports() {
  const week = getWeekRange();

  if (!week) {
    state.reports.generatedReports = [];
    state.reports.message = "Please select a Sunday week start date.";
    return;
  }

  const workers = getRelevantWorkers();

  const reports = workers
    .map((worker) => buildWorkerReport(worker, week))
    .filter((report) => report.rows.length > 0);

  state.reports.generatedReports = reports;
  state.reports.message = reports.length
    ? `Generated ${reports.length} report(s) for ${week.startText} to ${week.endText}.`
    : "No report rows found for that week.";
}

function renderReportColumnSelector() {
  const selectedKeys = new Set(getSelectedReportColumnKeys());

  return `
    <div class="detail-section-card">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div>
          <h3 class="text-lg font-semibold">Report Columns</h3>
          <p class="text-sm text-slate-500">
            Select which columns should be included in the report, CSV, and Google Sheet.
          </p>
        </div>

        <div class="flex gap-2">
          <button
            class="secondary-btn"
            type="button"
            onclick="window.selectAllReportColumnsAndRender()"
          >
            Select All
          </button>

          <button
            class="secondary-btn"
            type="button"
            onclick="window.resetDefaultReportColumnsAndRender()"
          >
            Reset Default
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        ${REPORT_COLUMNS.map((column) => `
          <label class="flex items-center gap-2 text-sm bg-slate-50 border rounded-lg px-3 py-2">
            <input
              type="checkbox"
              ${selectedKeys.has(column.key) ? "checked" : ""}
              onchange="window.toggleReportColumnAndRender('${column.key}')"
            />
            <span>${escapeHtml(column.label)}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `;
}








function buildWorkerOptions() {
  return (state.workers || [])
    .filter((worker) => getWorkerId(worker) || getWorkerName(worker))
    .sort((a, b) => getWorkerName(a).localeCompare(getWorkerName(b)))
    .map((worker) => {
      const id = getWorkerId(worker);
      const name = getWorkerName(worker);
      return `
        <option value="${escapeHtml(id)}" ${state.reports.selectedWorkerId === id ? "selected" : ""}>
          ${escapeHtml(name)}${id ? ` (${escapeHtml(id)})` : ""}
        </option>
      `;
    })
    .join("");
}

function formatReportCell(value, column) {
  if (value === "" || value == null) return "";

  if (column.totalType === "currency") {
    return formatCurrency(value);
  }

  if (column.totalType === "number") {
    return formatNumber(value, 2);
  }

  return escapeHtml(value);
}

function renderReportTable(report) {
  const columns = getSelectedReportColumns();

  return `
    <div class="detail-section-card no-break">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4 report-header no-break">
        <div>
          <h3 class="text-xl font-semibold">${escapeHtml(report.workerName)}</h3>
          <p class="text-sm text-slate-500">
            ${escapeHtml(report.workerId)} · ${escapeHtml(report.weekStart)} to ${escapeHtml(report.weekEnd)}
          </p>
        </div>

        <button class="secondary-btn no-print" type="button" onclick="window.print()">
          Print / Save PDF
        </button>
      </div>

      <div class="table-scroll-wrap">
        <table class="report-table">
          <thead>
            <tr>
              ${columns.map((column) => `
                <th>${escapeHtml(column.label)}</th>
              `).join("")}
            </tr>
          </thead>

          <tbody>
            ${report.rows.map((row) => `
              <tr>
                ${columns.map((column) => `
                  <td>${formatReportCell(row[column.key], column)}</td>
                `).join("")}
              </tr>
            `).join("")}

            <tr class="font-semibold bg-slate-100">
              ${columns.map((column, index) => {
                if (index === 0) {
                  return `<td>Totals</td>`;
                }

                if (!column.totalType) {
                  return `<td></td>`;
                }

                return `
                  <td>${formatReportCell(report.totals[column.key], column)}</td>
                `;
              }).join("")}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildReportsCsv() {
  const reports = state.reports.generatedReports || [];
  const columns = getSelectedReportColumns();

  const rows = [];

  rows.push(columns.map((column) => column.label));

  reports.forEach((report) => {
    report.rows.forEach((row) => {
      rows.push(
        columns.map((column) => row[column.key] ?? "")
      );
    });

    rows.push(
      columns.map((column, index) => {
        if (index === 0) return "Totals";
        if (!column.totalType) return "";
        return report.totals[column.key] ?? "";
      })
    );

    rows.push([]);
  });

  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

export function copyReportsCsv() {
  const csv = buildReportsCsv();

  navigator.clipboard.writeText(csv);

  state.reports.message = "CSV copied to clipboard.";
}

export function downloadReportsCsv() {
  const csv = buildReportsCsv();

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  const week = state.reports.weekStartDate || "reports";

  link.href = url;
  link.download = `weekly_reports_${week}.csv`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}




export async function createReportsGoogleSheet() {
  const reports = state.reports.generatedReports || [];

  if (!reports.length) {
    state.reports.message = "Generate reports before creating a Google Sheet.";
    return;
  }

  const weekLabel = state.reports.weekStartDate || "reports";

 const selectedColumns = getSelectedReportColumns();

const result = await createWorkerReportSpreadsheet({
  weekLabel,
  columns: selectedColumns,
  reports
});

  if (!result.success) {
    throw new Error(result.error || "Could not create Google Sheet.");
  }

  state.reports.message = "Google Sheet created successfully.";

  window.open(result.url, "_blank", "noopener,noreferrer");
}







export function renderReportsTab() {
  const content = document.getElementById("content");
  if (!content) return;

  content.innerHTML = `
    <div class="space-y-6">
      <div class="panel">
        <div class="panel-header">
          <h2 class="text-2xl font-semibold">Reports</h2>
          <p class="text-sm text-slate-500">
            Generate weekly payroll reports from Sunday through Saturday.
          </p>
        </div>

        <div class="panel-body space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div class="stat-label">Week Start Date</div>
              <input
                type="date"
                class="column-filter-input"
                value="${escapeHtml(state.reports.weekStartDate || "")}"
                onchange="window.setReportsWeekStartDate(this.value)"
              />
              <p class="text-xs text-slate-500 mt-1">Select the Sunday of the payroll week.</p>
            </div>

            <div>
              <div class="stat-label">Worker</div>
              <select
                class="column-filter-select"
                onchange="window.setReportsSelectedWorkerId(this.value)"
              >
                <option value="">All Workers</option>
                ${buildWorkerOptions()}
              </select>
            </div>

            <div class="flex items-end gap-2">
              <button
                class="primary-btn"
                type="button"
                onclick="window.generateWeeklyReportsAndRender()"
              >
                Generate Reports
              </button>

              <button
                class="secondary-btn"
                type="button"
                onclick="window.copyReportsCsv()"
              >
                Copy CSV
              </button>

              <button
                class="secondary-btn"
                type="button"
                onclick="window.downloadReportsCsv()"
              >
                Download CSV
              </button>

              <button
                class="secondary-btn"
                type="button"
                onclick="window.createReportsGoogleSheetAndRender()"
              >
                Create Google Sheet
              </button>
              </div>
            </div>

          ${renderReportColumnSelector()}
          ${state.reports.message ? `<div class="success-box">${escapeHtml(state.reports.message)}</div>` : ""}
        </div>
      </div>

      ${
        state.reports.generatedReports.length
          ? state.reports.generatedReports.map(renderReportTable).join("")
          : `<div class="blank-state-box">No reports generated yet.</div>`
      }
    </div>
  `;
}