import { state } from "./state.js";
import { escapeHtml, toNumber } from "./utils.js";
import { createWorkerReportSpreadsheet } from "./api.js";

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
      const assignedHours = getJobAssignedHours(row);
      const authorizedHours = getAuthorizedAssignedHours(row);
      const workedHours = getWorkedHoursForJob(workerId, row.EventId);
      const payableWorkedHours = getPayableWorkedHours(row, workerId);
      const baseRate = getJobRate(row) || fallbackBaseRate;
      const payout = getJobPayout(row, workerId);
      const averagePayPerHour = workedHours > 0 ? payout / workedHours : 0;

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
        workedTime: workedHours ? `${formatNumber(workedHours, 2)}h` : "",
        workedHours,
        payableWorkedHours,
        baseRate,
        averagePayPerHour,
        miles: 0,
        milePay: 0,
        driveOverageHours: 0,
        driveOveragePay: 0,
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
    miles: 0,
    milePay: 0,
    driveOverageHours: 0,
    driveOveragePay: 0,
    liability: 0,
    pendingOvertime: 0,
    otPay: 0,
    bonus: 0,
    totalPay: 0
  });

  totals.averagePayPerHour = totals.workedHours > 0
    ? totals.payout / totals.workedHours
    : 0;

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

function renderReportTable(report) {
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
              <th>Worker</th>
              <th>Calendar</th>
              <th>Client</th>
              <th>Date</th>
              <th>Day</th>
              <th>Pay Type</th>
              <th>Tip</th>
              <th>Payout</th>
              <th>Time Assigned</th>
              <th>Assigned</th>
              <th>Authorized</th>
              <th>Worked Time</th>
              <th>Worked</th>
              <th>Payable Worked</th>
              <th>Base Rate / Flat</th>
              <th>Avg Pay/Hr</th>
              <th>Miles</th>
              <th>Mile Pay</th>
              <th>Drive Overage</th>
              <th>Drive OT Pay</th>
              <th>Liability</th>
              <th>Pending OT</th>
              <th>OT Pay</th>
              <th>Bonus</th>
              <th>Total Pay</th>
            </tr>
          </thead>
          <tbody>
            ${report.rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.worker)}</td>
                <td>${escapeHtml(row.calendarName)}</td>
                <td>${escapeHtml(row.client)}</td>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.dayOfWeek)}</td>
                <td>${escapeHtml(row.rateType)}</td>
                <td>${formatCurrency(row.tip)}</td>
                <td>${formatCurrency(row.payout)}</td>
                <td>${escapeHtml(row.timeAssigned)}</td>
                <td>${formatNumber(row.assignedHours, 2)}</td>
                <td>${formatNumber(row.authorizedHours, 2)}</td>
                <td>${escapeHtml(row.workedTime)}</td>
                <td>${formatNumber(row.workedHours, 2)}</td>
                <td>${formatNumber(row.payableWorkedHours, 2)}</td>
                <td>${formatCurrency(row.baseRate)}</td>
                <td>${formatCurrency(row.averagePayPerHour)}</td>
                <td>${formatNumber(row.miles, 1)}</td>
                <td>${formatCurrency(row.milePay)}</td>
                <td>${formatNumber(row.driveOverageHours, 2)}</td>
                <td>${formatCurrency(row.driveOveragePay)}</td>
                <td>${formatCurrency(row.liability)}</td>
                <td>${formatNumber(row.pendingOvertime, 2)}</td>
                <td>${formatCurrency(row.otPay)}</td>
                <td>${formatCurrency(row.bonus)}</td>
                <td>${formatCurrency(row.totalPay)}</td>
              </tr>
            `).join("")}

            <tr class="font-semibold bg-slate-100">
              <td colspan="7">Totals</td>
              <td>${formatCurrency(report.totals.payout)}</td>
              <td></td>
              <td>${formatNumber(report.totals.assignedHours, 2)}</td>
              <td>${formatNumber(report.totals.authorizedHours, 2)}</td>
              <td></td>
              <td>${formatNumber(report.totals.workedHours, 2)}</td>
              <td>${formatNumber(report.totals.payableWorkedHours, 2)}</td>
              <td></td>
              <td>${formatCurrency(report.totals.averagePayPerHour)}</td>
              <td>${formatNumber(report.totals.miles, 1)}</td>
              <td>${formatCurrency(report.totals.milePay)}</td>
              <td>${formatNumber(report.totals.driveOverageHours, 2)}</td>
              <td>${formatCurrency(report.totals.driveOveragePay)}</td>
              <td>${formatCurrency(report.totals.liability)}</td>
              <td>${formatNumber(report.totals.pendingOvertime, 2)}</td>
              <td>${formatCurrency(report.totals.otPay)}</td>
              <td>${formatCurrency(report.totals.bonus)}</td>
              <td>${formatCurrency(report.totals.totalPay)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}


function buildReportsCsv() {
  const reports = state.reports.generatedReports || [];

  const rows = [];

  rows.push([
    "Worker",
    "Worker ID",
    "Calendar",
    "Client",
    "Date",
    "Day",
    "Pay Type",
    "Payout",
    "Assigned Hours",
    "Authorized Hours",
    "Worked Hours",
    "Payable Worked Hours",
    "Base Rate",
    "Avg Pay/Hr",
    "Total Pay"
  ]);

  reports.forEach((report) => {
    report.rows.forEach((row) => {
      rows.push([
        row.worker,
        row.workerId,
        row.calendarName,
        row.client,
        row.date,
        row.dayOfWeek,
        row.rateType,
        row.payout,
        row.assignedHours,
        row.authorizedHours,
        row.workedHours,
        row.payableWorkedHours,
        row.baseRate,
        row.averagePayPerHour,
        row.totalPay
      ]);
    });
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

  const result = await createWorkerReportSpreadsheet({
    weekLabel,
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
