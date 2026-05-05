import { state } from "./state.js";
import {
  escapeHtml,
  detailField,
  detailTextarea,
  durationToMinutesFromDisplay,
  formatCurrency,
  formatHours,
  renderLinkButtons,
  renderLinkCell,
  toNumber
} from "./utils.js";
import { renderCopyStatus } from "./copy.js";
import { getUniqueCalendars, isJobEvent } from "./filters.js";

/* =========================
   SUMMARY CARDS
========================= */

export function updateSummaryCardsForEvents(filteredRows) {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  const eventCount = filteredRows.length;
  const revenueTotal = filteredRows.reduce((sum, row) => sum + toNumber(row.GivenPrice), 0);

  const assignedTimeTotal = filteredRows.reduce((sum, row) => {
    const assignedDecimal = toNumber(row.AssignedTime);
    if (assignedDecimal != null) return sum + assignedDecimal;
    return sum;
  }, 0);

  const linkedDocsCount = filteredRows.reduce((sum, row) => {
    let c = 0;
    if (row.Contract) c += 1;
    if (row.Estimate) c += 1;
    if (row.Invoice) c += 1;
    if (row.Photos) c += 1;
    return sum + c;
  }, 0);

  if (countEl) countEl.innerText = eventCount;
  if (revenueEl) revenueEl.innerText = formatCurrency(revenueTotal);
  if (laborEl) laborEl.innerText = linkedDocsCount;
  if (assignedEl) assignedEl.innerText = formatHours(assignedTimeTotal);
}

export function getTravelMiles(row) {
  return toNumber(row.Miles);
}

export function getTravelMinutes(row) {
  return durationToMinutesFromDisplay(row.DisplayDuration || row.AssignedTime || "");
}

export function isTravelAlert(row) {
  return getTravelMiles(row) > 10 || getTravelMinutes(row) > 30;
}

export function getTravelAlertLabel(row) {
  const overMiles = getTravelMiles(row) > 10;
  const overMinutes = getTravelMinutes(row) > 30;

  if (overMiles && overMinutes) return "Over both";
  if (overMiles) return "Over 10 miles";
  if (overMinutes) return "Over 30 mins";
  return "Normal";
}

export function getTravelAlertBadgeClass(row) {
  return isTravelAlert(row) ? "badge-danger" : "badge-success";
}

export function updateSummaryCardsForTravel(filteredRows) {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  const eventCount = filteredRows.length;
  const totalMiles = filteredRows.reduce((sum, row) => sum + getTravelMiles(row), 0);
  const totalMinutes = filteredRows.reduce((sum, row) => sum + getTravelMinutes(row), 0);
  const alertCount = filteredRows.filter((row) => isTravelAlert(row)).length;

  if (countEl) countEl.innerText = eventCount;
  if (revenueEl) revenueEl.innerText = `${totalMiles.toFixed(2)} mi`;
  if (laborEl) laborEl.innerText = alertCount;
  if (assignedEl) assignedEl.innerText = `${totalMinutes.toFixed(2)} mins`;
}

/* =========================
   EVENTS / JOBS TABLES
========================= */

export function renderEventsTab(filteredRows) {
  renderEventsLikeTab(filteredRows, "Events", true, false);
}

export function renderJobsTab(filteredRows) {
  renderEventsLikeTab(filteredRows, "Jobs", false, true);
}

function getSelectedRowClass(row) {
  if (!state.selectedEvent) return "";
  return String(state.selectedEvent.EventId || "") === String(row.EventId || "")
    ? "bg-slate-100 ring-1 ring-slate-300"
    : "";
}

function buildSectionBlock(title, innerHtml) {
  return `
    <div class="detail-section-card">
      <div class="detail-section-title">${escapeHtml(title)}</div>
      <div class="grid grid-cols-1 gap-3">
        ${innerHtml}
      </div>
    </div>
  `;
}

function renderColumnFilterInput(tabName, key, placeholder = "Filter...") {
  const value = state.columnFilters?.[tabName]?.[key] || "";
  return `
    <input
      type="text"
      class="column-filter-input"
      value="${escapeHtml(value)}"
      placeholder="${escapeHtml(placeholder)}"
      data-filter-tab="${escapeHtml(tabName)}"
      data-filter-key="${escapeHtml(key)}"
      onfocus="window.rememberColumnFilterFocus('${tabName}', '${key}')"
      oninput="window.setColumnFilter('${tabName}', '${key}', this.value)"
      onclick="event.stopPropagation()"
    />
  `;
}

function renderColumnFilterSelect(tabName, key, options, includeBlankOptions = true) {
  const value = state.columnFilters?.[tabName]?.[key] || "";
  return `
    <select
      class="column-filter-select"
      data-filter-tab="${escapeHtml(tabName)}"
      data-filter-key="${escapeHtml(key)}"
      onfocus="window.rememberColumnFilterFocus('${tabName}', '${key}')"
      onchange="window.setColumnFilter('${tabName}', '${key}', this.value)"
      onclick="event.stopPropagation()"
    >
      <option value="" ${value === "" ? "selected" : ""}>All</option>
      ${includeBlankOptions ? `
        <option value="__BLANK__" ${value === "__BLANK__" ? "selected" : ""}>Blank</option>
        <option value="__NONBLANK__" ${value === "__NONBLANK__" ? "selected" : ""}>Non-blank</option>
      ` : ""}
      ${options.map((opt) => `
        <option value="${escapeHtml(opt)}" ${value === opt ? "selected" : ""}>${escapeHtml(opt)}</option>
      `).join("")}
    </select>
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

function renderEventDetailModal(selected, showCopyButton) {
  if (!selected || !state.eventDetailOpen) return "";

  return `
    <div class="event-modal-backdrop">
      <div class="event-modal-card">
        <div class="event-modal-header">
          <div>
            <h3 class="text-2xl font-semibold">Event Detail</h3>
            <p class="text-sm text-slate-500 mt-1">${escapeHtml(selected.ClientName || "")} — ${escapeHtml(selected.Status || "")}</p>
          </div>
          <div class="flex items-center gap-2">
            ${showCopyButton ? `<button class="primary-btn" onclick="window.copySelectedJobForWorkers()" type="button">Copy for Workers</button>` : ""}
            <button class="secondary-btn" onclick="window.closeEventDetail()" type="button">Close</button>
          </div>
        </div>

        <div class="event-modal-body space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${detailField("Date", selected.Date)}
            ${detailField("Calendar Name", selected.CalendarName)}
            ${detailField("Event Type", selected.EventType)}
            ${detailField("Status", selected.Status)}
            ${detailField("Client Name", selected.ClientName)}
            ${detailField("Address", selected.Address)}
          </div>

          ${buildSectionBlock("SCHEDULING SECTION", `
            ${detailField("Company", selected.Company)}
            ${detailField("Zone", selected.Zone)}
            ${detailField("Frequency", selected.Frequency)}
            ${detailField("Assigned Time", selected.AssignedTime)}
            ${detailField("Requested Time", selected.RequestedTime)}
            ${detailField("Workyard Time", selected.WorkyardTime)}
          `)}

          ${buildSectionBlock("FINANCE SECTION", `
            ${detailField("Given Price", selected.GivenPrice)}
            ${detailField("Additional Expense", selected.AdditionalExpense)}
            ${detailField("Rate Type", selected.RateType)}
            ${detailField("Tip", selected.Tip)}
            ${detailField("Payment Type", selected.PaymentType)}
            ${detailTextarea("Finance Notes", selected.FinanceNotes)}
            ${detailField("CC", selected.CC)}
            ${detailField("Pay Status", selected.PayStatus)}
            ${detailField("Paid Amount", selected.PaidAmount)}
          `)}

          ${buildSectionBlock("SALES SECTION", `
            ${detailField("Account Manager", selected.AccountManager)}
            ${detailField("Commission", selected.Commission)}
          `)}

          ${buildSectionBlock("QUALITY CONTROL SECTION", `
            ${detailField("Service Type", selected.ServiceType)}
            ${detailField("Entrance", selected.Entrance)}
            ${detailField("Material Info", selected.MaterialInfo)}
            ${detailTextarea("Instructions", selected.Instructions)}
            ${detailTextarea("Other Info", selected.OtherInfo)}
            ${detailField("Phone", selected.Phone)}
            ${detailTextarea("QC Notes", selected.QcNotes)}
          `)}

          ${buildSectionBlock("WORKER SECTION", `
            ${detailTextarea("Worker Info", selected.WorkerInfo)}
          `)}

          <div class="detail-section-card">
            <div class="detail-section-title">LINKS SECTION</div>
            ${renderLinkButtons(selected)}
          </div>

          ${showCopyButton ? renderCopyStatus() : ""}
          ${detailField("Job Link", selected.JobLink)}
          ${detailField("Event ID", selected.EventId)}
        </div>
      </div>
    </div>
  `;
}

export function renderEventsLikeTab(filteredRows, heading, showEventType, showCopyButton) {
  const content = document.getElementById("content");
  if (!content) return;

  const selected = state.selectedEvent || filteredRows[0] || null;
  const tabName = heading.toLowerCase();

  const calendarOptions = getUniqueCalendars();
  const eventTypeOptions = ["job", "travel"];
  const statusOptions = [...new Set(filteredRows.map(r => String(r.Status || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const companyOptions = [...new Set(filteredRows.map(r => String(r.Company || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const zoneOptions = [...new Set(filteredRows.map(r => String(r.Zone || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const rateTypeOptions = [...new Set(filteredRows.map(r => String(r.RateType || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const paymentTypeOptions = [...new Set(filteredRows.map(r => String(r.PaymentType || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const payStatusOptions = [...new Set(filteredRows.map(r => String(r.PayStatus || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  content.innerHTML = `
    <div class="space-y-6">
      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 class="text-2xl font-semibold">${escapeHtml(heading)}</h2>
              <p class="text-sm text-slate-500">
                Live data pulled from the Google Sheets tab named Jobs.
              </p>
              <p class="text-sm text-slate-500 mt-1">
                Total API rows: <strong>${state.eventsData.length}</strong> |
                Filtered rows: <strong>${filteredRows.length}</strong>
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="secondary-btn" onclick="window.clearColumnFilters('${tabName}')" type="button">Clear Column Filters</button>
              <button class="secondary-btn" onclick="window.clearFilters()" type="button">Clear Filters</button>
              <button class="secondary-btn" onclick="window.refreshEvents()" type="button">Refresh ${escapeHtml(heading)}</button>
            </div>
          </div>
        </div>

        <div class="panel-body">
          <div class="table-scroll-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>CalendarName</th>
                  ${showEventType ? "<th>EventType</th>" : ""}
                  <th>Status</th>
                  <th>ClientName</th>
                  <th>Address</th>
                  <th>Company</th>
                  <th>Zone</th>
                  <th>Frequency</th>
                  <th>AssignedTime</th>
                  <th>RequestedTime</th>
                  <th>WorkyardTime</th>
                  <th>GivenPrice</th>
                  <th>RateType</th>
                  <th>PaymentType</th>
                  <th>PayStatus</th>
                  <th>ServiceType</th>
                  <th>Phone</th>
                  <th>Contract</th>
                  <th>Estimate</th>
                  <th>Invoice</th>
                  <th>Photos</th>
                  <th>JobLink</th>
                  <th>EventId</th>
                </tr>
                <tr>
                  <th>${renderColumnFilterInput(tabName, "Date")}</th>
                  <th>${renderColumnFilterSelect(tabName, "CalendarName", calendarOptions)}</th>
                  ${showEventType ? `<th>${renderColumnFilterSelect(tabName, "EventType", eventTypeOptions, false)}</th>` : ""}
                  <th>${renderColumnFilterSelect(tabName, "Status", statusOptions)}</th>
                  <th>${renderColumnFilterInput(tabName, "ClientName")}</th>
                  <th>${renderColumnFilterInput(tabName, "Address")}</th>
                  <th>${renderColumnFilterSelect(tabName, "Company", companyOptions)}</th>
                  <th>${renderColumnFilterSelect(tabName, "Zone", zoneOptions)}</th>
                  <th>${renderColumnFilterInput(tabName, "Frequency")}</th>
                  <th>${renderColumnFilterInput(tabName, "AssignedTime")}</th>
                  <th>${renderColumnFilterInput(tabName, "RequestedTime")}</th>
                  <th>${renderColumnFilterInput(tabName, "WorkyardTime")}</th>
                  <th>${renderColumnFilterInput(tabName, "GivenPrice")}</th>
                  <th>${renderColumnFilterSelect(tabName, "RateType", rateTypeOptions)}</th>
                  <th>${renderColumnFilterSelect(tabName, "PaymentType", paymentTypeOptions)}</th>
                  <th>${renderColumnFilterSelect(tabName, "PayStatus", payStatusOptions)}</th>
                  <th>${renderColumnFilterInput(tabName, "ServiceType")}</th>
                  <th>${renderColumnFilterInput(tabName, "Phone")}</th>
                  <th>${renderColumnFilterInput(tabName, "Contract")}</th>
                  <th>${renderColumnFilterInput(tabName, "Estimate")}</th>
                  <th>${renderColumnFilterInput(tabName, "Invoice")}</th>
                  <th>${renderColumnFilterInput(tabName, "Photos")}</th>
                  <th>${renderColumnFilterInput(tabName, "JobLink")}</th>
                  <th>${renderColumnFilterInput(tabName, "EventId")}</th>
                </tr>
              </thead>
              <tbody>
                ${
                  filteredRows.length === 0
                    ? `<tr><td colspan="${showEventType ? 24 : 23}" class="text-center text-slate-500">No rows matched your filters.</td></tr>`
                    : filteredRows.map((row, index) => `
                      <tr class="clickable-row ${getSelectedRowClass(row)}" onclick="window.selectEventByFilteredIndex(${index})">
                        <td>${escapeHtml(row.Date)}</td>
                        <td>${escapeHtml(row.CalendarName)}</td>
                        ${showEventType ? `<td><span class="badge badge-neutral">${escapeHtml(row.EventType)}</span></td>` : ""}
                        <td>${renderStatusBadge(row.Status)}</td>
                        <td>${escapeHtml(row.ClientName)}</td>
                        <td>${escapeHtml(row.Address)}</td>
                        <td>${escapeHtml(row.Company)}</td>
                        <td>${escapeHtml(row.Zone)}</td>
                        <td>${escapeHtml(row.Frequency)}</td>
                        <td>${escapeHtml(row.AssignedTime)}</td>
                        <td>${escapeHtml(row.RequestedTime)}</td>
                        <td>${escapeHtml(row.WorkyardTime)}</td>
                        <td>${escapeHtml(row.GivenPrice)}</td>
                        <td>${escapeHtml(row.RateType)}</td>
                        <td>${escapeHtml(row.PaymentType)}</td>
                        <td>${escapeHtml(row.PayStatus)}</td>
                        <td>${escapeHtml(row.ServiceType)}</td>
                        <td>${escapeHtml(row.Phone)}</td>
                        <td>${renderLinkCell(row.Contract)}</td>
                        <td>${renderLinkCell(row.Estimate)}</td>
                        <td>${renderLinkCell(row.Invoice)}</td>
                        <td>${renderLinkCell(row.Photos)}</td>
                        <td>${renderLinkCell(row.JobLink)}</td>
                        <td>${escapeHtml(row.EventId)}</td>
                      </tr>
                    `).join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${renderEventDetailModal(selected, showCopyButton)}
    </div>
  `;
}

/* =========================
   ROUTE BUILDER
========================= */

function buildMapsUrlFromStops(stops) {
  if (!stops || stops.length < 2) return "";
  const encodedStops = stops.map((stop) => encodeURIComponent(stop.address));
  return `https://www.google.com/maps/dir/${encodedStops.join("/")}`;
}

function getSelectedRouteStops() {
  const ids = state.routeBuilder.selectedStopEventIds || [];
  const selected = (state.routeBuilder.stops || []).filter((stop) => ids.includes(stop.eventId));

  return selected.length ? selected : [];
}

function refreshRouteBuilderMapsUrl() {
  const selectedStops = getSelectedRouteStops();
  state.routeBuilder.mapsUrl = buildMapsUrlFromStops(selectedStops);
}

function buildRouteStopsCopy(calendarName, date, stops) {
  const selectedIds = state.routeBuilder.selectedStopEventIds || [];

  const lines = [
    `Calendar: ${calendarName}`,
    `Date: ${date}`,
    "",
    "Route Stops:"
  ];

  stops.forEach((stop, index) => {
    const selectedMark = selectedIds.includes(stop.eventId) ? "[SELECTED]" : "[NOT SELECTED]";
    lines.push(`${selectedMark} ${index + 1}. ${stop.clientName ? stop.clientName + " — " : ""}${stop.address}`);
  });

  return lines.join("\n");
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand("copy");
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  } finally {
    document.body.removeChild(textarea);
  }
}

function getWorkerId(worker) {
  return String(worker.WorkerID || worker.workerId || worker.ID || worker.id || "").trim();
}

function getWorkerName(worker) {
  return String(worker.Name || worker.WorkerName || worker.name || "").trim();
}

function getWorkerRate(worker) {
  return String(worker.BaseRate || worker.Rate || worker.rate || "").trim();
}

function getWorkerTransportation(worker) {
  return String(worker.Transportation || worker.Role || worker.role || "").trim();
}

function buildWorkerOptionValue(worker) {
  const id = getWorkerId(worker);
  const name = getWorkerName(worker);
  if (id && name) return `${name} | ${id}`;
  return name || id;
}

function findWorkerBySearchValue(value) {
  const search = String(value || "").trim().toLowerCase();
  if (!search) return null;

  return (state.workers || []).find((worker) => {
    const id = getWorkerId(worker).toLowerCase();
    const name = getWorkerName(worker).toLowerCase();
    const option = buildWorkerOptionValue(worker).toLowerCase();

    return (
      search === id ||
      search === name ||
      search === option ||
      option.includes(search)
    );
  }) || null;
}

function isPickupDropoffStop(stop) {
  const text = [
    stop.clientName,
    stop.address,
    stop.eventType,
    stop.serviceType,
    stop.status
  ].join(" ").toLowerCase();

  return (
    text.includes("pickup") ||
    text.includes("pick up") ||
    text.includes("dropoff") ||
    text.includes("drop off") ||
    text.includes("travel")
  );
}

function getTravelLegCount() {
  return Math.max(getSelectedRouteStops().length - 1, 0);
}

function getTravelSummaryValues() {
  const totalMiles = Number(state.routeBuilder.travelTotalMiles || 0);
  const totalDriveMinutes = Number(state.routeBuilder.travelTotalDriveMinutes || 0);
  const freeMinutesPerLeg = Number(state.routeBuilder.travelFreeMinutesPerLeg || 25);
  const legCount = getTravelLegCount();

  const totalFreeMinutes = legCount * freeMinutesPerLeg;
  const payableMinutes = Math.max(totalDriveMinutes - totalFreeMinutes, 0);

  return {
    totalMiles,
    totalDriveMinutes,
    freeMinutesPerLeg,
    legCount,
    totalFreeMinutes,
    payableMinutes
  };
}

function buildTravelEventTitle() {
  const calendarName = state.routeBuilder.calendarName || "";
  const date = state.routeBuilder.date || "";
  const workerName = state.routeBuilder.travelLogWorkerName || "Worker";

  return `TRAVEL LOG | ${workerName} | ${calendarName} | ${date}`;
}

function buildTravelEventBody() {
  const calendarName = state.routeBuilder.calendarName || "";
  const date = state.routeBuilder.date || "";
  const allStops = state.routeBuilder.stops || [];
  const selectedStops = getSelectedRouteStops();
  const summary = getTravelSummaryValues();

  const workerName = state.routeBuilder.travelLogWorkerName || "";
  const workerId = state.routeBuilder.travelLogWorkerId || "";
  const workerRole = state.routeBuilder.travelLogWorkerRole || state.routeBuilder.travelRouteMode || "";
  const hourlyRate = state.routeBuilder.travelLogHourlyRate || "";
  const mileageRate = state.routeBuilder.travelLogMileageRate || "0.70";

  const lines = [];

  lines.push("EVENT_TYPE: TRAVEL_LOG");
  lines.push("TRAVEL_LOG_VERSION: 3");
  lines.push(`CALENDAR_NAME: ${calendarName}`);
  lines.push(`SERVICE_DATE: ${date}`);
  lines.push(`ROUTE_MODE: ${state.routeBuilder.travelRouteMode || ""}`);
  lines.push(`WORKER_ID: ${workerId}`);
  lines.push(`WORKER_NAME: ${workerName}`);
  lines.push(`WORKER_ROLE: ${workerRole}`);
  lines.push(`HOURLY_RATE: ${hourlyRate}`);
  lines.push(`MILEAGE_RATE: ${mileageRate}`);
  lines.push("");
  lines.push("ALL BUILT STOPS:");

  allStops.forEach((stop, index) => {
    const selected = (state.routeBuilder.selectedStopEventIds || []).includes(stop.eventId);
    lines.push(`${selected ? "[SELECTED]" : "[NOT SELECTED]"} ${index + 1}. ${stop.clientName || "No client"} | ${stop.requestedTime || ""} | ${stop.address || ""}`);
  });

  lines.push("");
  lines.push("SELECTED ROUTE STOPS:");

  selectedStops.forEach((stop, index) => {
    lines.push(`${index + 1}. ${stop.clientName || "No client"} | ${stop.requestedTime || ""} | ${stop.address || ""}`);
  });

  lines.push("");
  lines.push("TRAVEL LEGS:");

  if (selectedStops.length < 2) {
    lines.push("No travel legs found. At least two selected stops are needed.");
  } else {
    for (let i = 0; i < selectedStops.length - 1; i++) {
      const from = selectedStops[i];
      const to = selectedStops[i + 1];

      lines.push("");
      lines.push(`LEG ${i + 1}`);
      lines.push(`FROM_CLIENT: ${from.clientName || ""}`);
      lines.push(`FROM_TIME: ${from.requestedTime || ""}`);
      lines.push(`FROM_ADDRESS: ${from.address || ""}`);
      lines.push(`TO_CLIENT: ${to.clientName || ""}`);
      lines.push(`TO_TIME: ${to.requestedTime || ""}`);
      lines.push(`TO_ADDRESS: ${to.address || ""}`);
    }
  }

  lines.push("");
  lines.push("SUMMARY");
  lines.push(`LEG_COUNT: ${summary.legCount}`);
  lines.push(`TOTAL_MILES: ${summary.totalMiles}`);
  lines.push(`TOTAL_DRIVE_TIME_MINUTES: ${summary.totalDriveMinutes}`);
  lines.push(`FREE_MINUTES_PER_LEG: ${summary.freeMinutesPerLeg}`);
  lines.push(`TOTAL_FREE_MINUTES: ${summary.totalFreeMinutes}`);
  lines.push(`PAYABLE_DRIVE_MINUTES: ${summary.payableMinutes}`);
  lines.push("");
  lines.push("FORMULA:");
  lines.push("PAYABLE_DRIVE_MINUTES = MAX(TOTAL_DRIVE_TIME_MINUTES - (FREE_MINUTES_PER_LEG × LEG_COUNT), 0)");
  lines.push("");
  lines.push("INSTRUCTIONS:");
  lines.push("Use this event as the travel/payroll holder for the worker's route.");
  lines.push("Current rule: 25 non-payable minutes are allotted per selected leg. Only the remaining total minutes are payable.");

  return lines.join("\n");
}

function buildFullTravelLogPreview() {
  return [
    "COPY EVENT TITLE:",
    buildTravelEventTitle(),
    "",
    "COPY EVENT BODY / NOTES:",
    buildTravelEventBody()
  ].join("\n");
}

export function setRouteBuilderCalendar(value) {
  state.routeBuilder.calendarName = value;
}

export function setRouteBuilderDate(value) {
  state.routeBuilder.date = value;
}

export function setTravelRouteMode(value) {
  const mode = value === "Passenger" ? "Passenger" : "Driver";
  state.routeBuilder.travelRouteMode = mode;
  state.routeBuilder.travelLogWorkerRole = mode;

  const stops = state.routeBuilder.stops || [];

  if (mode === "Driver") {
    state.routeBuilder.selectedStopEventIds = stops.map((stop) => stop.eventId);
  } else {
    state.routeBuilder.selectedStopEventIds = stops
      .filter((stop) => !isPickupDropoffStop(stop))
      .map((stop) => stop.eventId);
  }

  refreshRouteBuilderMapsUrl();
  state.routeBuilder.travelPayableMinutes = getTravelSummaryValues().payableMinutes;
  state.routeBuilder.travelLogText = "";
}

export function toggleRouteStopSelection(eventId) {
  const id = String(eventId || "").trim();
  if (!id) return;

  const current = state.routeBuilder.selectedStopEventIds || [];

  if (current.includes(id)) {
    state.routeBuilder.selectedStopEventIds = current.filter((x) => x !== id);
  } else {
    state.routeBuilder.selectedStopEventIds = [...current, id];
  }

  refreshRouteBuilderMapsUrl();
  state.routeBuilder.travelPayableMinutes = getTravelSummaryValues().payableMinutes;
  state.routeBuilder.travelLogText = "";
}

export function setTravelLogWorkerName(value) {
  state.routeBuilder.travelLogWorkerName = value;
}

export function setTravelLogWorkerId(value) {
  state.routeBuilder.travelLogWorkerId = value;
}

export function setTravelLogWorkerRole(value) {
  setTravelRouteMode(value);
}

export function setTravelLogHourlyRate(value) {
  state.routeBuilder.travelLogHourlyRate = value;
}

export function setTravelLogMileageRate(value) {
  state.routeBuilder.travelLogMileageRate = value;
}

export function setTravelTotalMiles(value) {
  state.routeBuilder.travelTotalMiles = value;
  state.routeBuilder.travelPayableMinutes = getTravelSummaryValues().payableMinutes;
}

export function setTravelTotalDriveMinutes(value) {
  state.routeBuilder.travelTotalDriveMinutes = value;
  state.routeBuilder.travelPayableMinutes = getTravelSummaryValues().payableMinutes;
}

export function setTravelFreeMinutesPerLeg(value) {
  state.routeBuilder.travelFreeMinutesPerLeg = value || 25;
  state.routeBuilder.travelPayableMinutes = getTravelSummaryValues().payableMinutes;
}

export function selectTravelLogWorkerFromSearch(value) {
  state.routeBuilder.travelLogWorkerSearch = value;

  const worker = findWorkerBySearchValue(value);
  if (!worker) return;

  state.routeBuilder.travelLogWorkerName = getWorkerName(worker);
  state.routeBuilder.travelLogWorkerId = getWorkerId(worker);

  const transportation = getWorkerTransportation(worker);
  if (transportation) {
    const clean = transportation.toLowerCase();
    if (clean.includes("passenger")) {
      setTravelRouteMode("Passenger");
    } else if (clean.includes("driver")) {
      setTravelRouteMode("Driver");
    }
  }

  const rate = getWorkerRate(worker);
  if (rate) {
    state.routeBuilder.travelLogHourlyRate = rate;
  }
}

export function buildRouteForSelectedCalendarAndDate() {
  const calendarName = String(state.routeBuilder.calendarName || "").trim();
  const date = String(state.routeBuilder.date || "").trim();

  if (!calendarName || !date) {
    state.routeBuilder.stops = [];
    state.routeBuilder.mapsUrl = "";
    state.routeBuilder.copyMessage = "Select a calendar and date first.";
    return;
  }

  const stops = state.eventsData
    .filter((row) => String(row.CalendarName || "").trim() === calendarName)
    .filter((row) => String(row.Date || "").trim() === date)
    .filter((row) => String(row.Address || "").trim() !== "")
    .sort((a, b) => String(a.RequestedTime || "").localeCompare(String(b.RequestedTime || "")))
    .map((row, index) => ({
      clientName: String(row.ClientName || "").trim(),
      address: String(row.Address || "").trim(),
      requestedTime: String(row.RequestedTime || "").trim(),
      eventId: String(row.EventId || "").trim() || `stop-${index}`,
      eventType: String(row.EventType || "").trim(),
      serviceType: String(row.ServiceType || "").trim(),
      status: String(row.Status || "").trim(),
      isJob: isJobEvent(row)
    }));

  state.routeBuilder.stops = stops;

  if ((state.routeBuilder.travelRouteMode || "Driver") === "Passenger") {
    state.routeBuilder.selectedStopEventIds = stops
      .filter((stop) => !isPickupDropoffStop(stop))
      .map((stop) => stop.eventId);
  } else {
    state.routeBuilder.selectedStopEventIds = stops.map((stop) => stop.eventId);
  }

  refreshRouteBuilderMapsUrl();

  state.routeBuilder.copyMessage = stops.length ? "" : "No stops found for that calendar and date.";
  state.routeBuilder.travelLogText = "";
  state.routeBuilder.travelPayableMinutes = getTravelSummaryValues().payableMinutes;
}

export function generateTravelLogForRouteBuilder() {
  const selectedStops = getSelectedRouteStops();

  if (selectedStops.length < 2) {
    state.routeBuilder.copyMessage = "At least two selected stops are needed to generate a travel log.";
    state.routeBuilder.travelLogText = "";
    return;
  }

  state.routeBuilder.travelLogText = buildFullTravelLogPreview();
  state.routeBuilder.copyMessage = "Travel log generated.";
}

export async function copyTravelLogTitle() {
  try {
    await copyTextToClipboard(buildTravelEventTitle());
    state.routeBuilder.copyMessage = "Event title copied.";
  } catch (_) {
    state.routeBuilder.copyMessage = "Copy failed. Use the preview box and copy manually.";
  }
}

export async function copyTravelLogBody() {
  try {
    await copyTextToClipboard(buildTravelEventBody());
    state.routeBuilder.copyMessage = "Event body copied.";
  } catch (_) {
    state.routeBuilder.copyMessage = "Copy failed. Use the preview box and copy manually.";
  }
}

export async function copyTravelLog() {
  try {
    await copyTextToClipboard(buildTravelEventBody());
    state.routeBuilder.travelLogText = buildFullTravelLogPreview();
    state.routeBuilder.copyMessage = "Event body copied. Paste it into the calendar event description.";
  } catch (_) {
    state.routeBuilder.copyMessage = "Copy failed. Use the preview box and copy manually.";
  }
}

export async function copyRouteStops() {
  const text = buildRouteStopsCopy(
    state.routeBuilder.calendarName,
    state.routeBuilder.date,
    state.routeBuilder.stops
  );

  try {
    await copyTextToClipboard(text);
    state.routeBuilder.copyMessage = "Route stops copied.";
  } catch (_) {
    state.routeBuilder.copyMessage = "Copy failed. Use the preview box and copy manually.";
  }
}

export async function copyRouteTemplate() {
  const text = buildFullTravelLogPreview();

  try {
    await copyTextToClipboard(text);
    state.routeBuilder.copyMessage = "Travel template copied.";
  } catch (_) {
    state.routeBuilder.copyMessage = "Copy failed. Use the preview box and copy manually.";
  }
}

function renderTravelRouteBuilder() {
  const calendars = getUniqueCalendars();
  const selectedCalendar = state.routeBuilder.calendarName || "";
  const selectedDate = state.routeBuilder.date || "";
  const stops = state.routeBuilder.stops || [];
  const selectedIds = state.routeBuilder.selectedStopEventIds || [];
  const selectedStops = getSelectedRouteStops();
  const mapsUrl = state.routeBuilder.mapsUrl || "";
  const copyMessage = state.routeBuilder.copyMessage || "";
  const travelLogText = state.routeBuilder.travelLogText || "";
  const summary = getTravelSummaryValues();

  const workerOptions = (state.workers || [])
    .filter((worker) => getWorkerId(worker) || getWorkerName(worker))
    .map((worker) => buildWorkerOptionValue(worker));

  return `
    <div class="panel">
      <div class="panel-header">
        <h3 class="text-xl font-semibold">Route Builder / Travel Log Generator</h3>
        <p class="text-sm text-slate-500 mt-1">
          Build a route, paste total miles/time from Google Maps, then copy a payroll-ready calendar title and body.
        </p>
      </div>

      <div class="panel-body space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select class="column-filter-select" onchange="window.setRouteBuilderCalendar(this.value)">
            <option value="">Select calendar</option>
            ${calendars.map((name) => `
              <option value="${escapeHtml(name)}" ${selectedCalendar === name ? "selected" : ""}>${escapeHtml(name)}</option>
            `).join("")}
          </select>

          <input
            type="date"
            class="column-filter-input"
            value="${escapeHtml(selectedDate)}"
            onchange="window.setRouteBuilderDate(this.value)"
          />

          <button class="primary-btn" type="button" onclick="window.buildRouteAndRender()">
            Build Route
          </button>
        </div>

        <datalist id="workerTravelLogOptions">
          ${workerOptions.map((option) => `
            <option value="${escapeHtml(option)}"></option>
          `).join("")}
        </datalist>

        <div class="detail-section-card">
          <div class="detail-section-title">Travel Log Worker Info</div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div class="stat-label">Search Worker by Name or ID</div>
              <input
                class="column-filter-input"
                list="workerTravelLogOptions"
                placeholder="Type name or ID..."
                value="${escapeHtml(state.routeBuilder.travelLogWorkerSearch || "")}"
                onchange="window.selectTravelLogWorkerFromSearch(this.value)"
              />
            </div>

            <div>
              <div class="stat-label">Worker Name</div>
              <input
                class="column-filter-input"
                placeholder="Worker Name"
                value="${escapeHtml(state.routeBuilder.travelLogWorkerName || "")}"
                onchange="window.setTravelLogWorkerName(this.value)"
              />
            </div>

            <div>
              <div class="stat-label">Worker ID</div>
              <input
                class="column-filter-input"
                placeholder="Worker ID"
                value="${escapeHtml(state.routeBuilder.travelLogWorkerId || "")}"
                onchange="window.setTravelLogWorkerId(this.value)"
              />
            </div>

            <div>
              <div class="stat-label">Driver / Passenger</div>
              <select class="column-filter-select" onchange="window.setTravelRouteMode(this.value)">
                <option value="Driver" ${state.routeBuilder.travelRouteMode === "Driver" ? "selected" : ""}>Driver</option>
                <option value="Passenger" ${state.routeBuilder.travelRouteMode === "Passenger" ? "selected" : ""}>Passenger</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div class="stat-label">Hourly Rate</div>
              <input
                class="column-filter-input"
                placeholder="Hourly Rate"
                value="${escapeHtml(state.routeBuilder.travelLogHourlyRate || "")}"
                onchange="window.setTravelLogHourlyRate(this.value)"
              />
            </div>

            <div>
              <div class="stat-label">Mileage Rate</div>
              <input
                class="column-filter-input"
                placeholder="Mileage Rate"
                value="${escapeHtml(state.routeBuilder.travelLogMileageRate || "0.70")}"
                onchange="window.setTravelLogMileageRate(this.value)"
              />
            </div>
          </div>
        </div>

        <div class="detail-section-card">
          <div class="detail-section-title">Travel Summary Calculation</div>
          <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <div class="stat-label">Total Miles</div>
              <input
                class="column-filter-input"
                type="number"
                step="0.1"
                placeholder="Paste total miles"
                value="${escapeHtml(state.routeBuilder.travelTotalMiles || "")}"
                onchange="window.setTravelTotalMiles(this.value)"
              />
            </div>

            <div>
              <div class="stat-label">Total Drive Minutes</div>
              <input
                class="column-filter-input"
                type="number"
                step="1"
                placeholder="Paste total mins"
                value="${escapeHtml(state.routeBuilder.travelTotalDriveMinutes || "")}"
                onchange="window.setTravelTotalDriveMinutes(this.value)"
              />
            </div>

            <div>
              <div class="stat-label">Free Minutes / Leg</div>
              <input
                class="column-filter-input"
                type="number"
                step="1"
                value="${escapeHtml(String(state.routeBuilder.travelFreeMinutesPerLeg || 25))}"
                onchange="window.setTravelFreeMinutesPerLeg(this.value)"
              />
            </div>

            <div>
              <div class="stat-label">Selected Leg Count</div>
              <div class="stat-value">${summary.legCount}</div>
            </div>

            <div>
              <div class="stat-label">Payable Minutes</div>
              <div class="stat-value">${summary.payableMinutes}</div>
            </div>
          </div>

          <div class="text-sm text-slate-500 mt-4">
            Formula: Payable Minutes = MAX(Total Drive Minutes - (${summary.freeMinutesPerLeg} × ${summary.legCount}), 0)
          </div>
        </div>

        <div class="detail-section-card">
          <div class="detail-section-title">Copy Calendar Event</div>

          <div class="grid grid-cols-1 gap-4">
            <div>
              <div class="stat-label">Event Title</div>
              <input
                class="column-filter-input"
                readonly
                value="${escapeHtml(buildTravelEventTitle())}"
              />
            </div>

            <div class="flex flex-wrap gap-2">
              <button class="secondary-btn" type="button" onclick="window.copyTravelLogTitleAndRender()" ${selectedStops.length >= 2 ? "" : "disabled"}>
                Copy Event Title
              </button>

              <button class="secondary-btn" type="button" onclick="window.copyTravelLogBodyAndRender()" ${selectedStops.length >= 2 ? "" : "disabled"}>
                Copy Event Body
              </button>

              <button class="primary-btn" type="button" onclick="window.generateTravelLogAndRender()" ${selectedStops.length >= 2 ? "" : "disabled"}>
                Generate Preview
              </button>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button class="secondary-btn" type="button" onclick="window.openBuiltRouteInMaps()" ${mapsUrl ? "" : "disabled"}>
            Open Selected Route in Google Maps
          </button>

          <button class="secondary-btn" type="button" onclick="window.copyBuiltRouteStops()" ${stops.length ? "" : "disabled"}>
            Copy Stops
          </button>
        </div>

        ${copyMessage ? `<div class="success-box">${escapeHtml(copyMessage)}</div>` : ""}

        <div class="detail-section-card">
          <div class="detail-section-title">Built Stops</div>
          <p class="text-sm text-slate-500 mb-3">
            All stops are shown. Checked stops are used for the route, leg count, and travel log.
          </p>
          ${
            stops.length
              ? `
                <div class="space-y-2">
                  ${stops.map((stop, index) => {
                    const checked = selectedIds.includes(stop.eventId);
                    return `
                      <div class="border rounded-xl p-3 ${checked ? "bg-green-50 ring-1 ring-green-200" : "bg-white opacity-70"}">
                        <label class="flex gap-3 items-start cursor-pointer">
                          <input
                            type="checkbox"
                            class="mt-1"
                            ${checked ? "checked" : ""}
                            onchange="window.toggleRouteStopSelection('${escapeHtml(stop.eventId)}')"
                          />
                          <div>
                            <div class="font-medium">
                              ${index + 1}. ${escapeHtml(stop.clientName || "No client name")}
                              ${isPickupDropoffStop(stop) ? `<span class="badge badge-neutral ml-2">Pickup/Dropoff/Travel</span>` : ""}
                            </div>
                            <div class="text-sm text-slate-600">${escapeHtml(stop.address)}</div>
                            <div class="text-sm text-slate-500">${escapeHtml(stop.requestedTime)}</div>
                          </div>
                        </label>
                      </div>
                    `;
                  }).join("")}
                </div>
              `
              : `<div class="text-slate-500">No route built yet.</div>`
          }
        </div>

        <div class="detail-section-card">
          <div class="detail-section-title">Travel Log Preview</div>
          ${
            travelLogText
              ? `<textarea class="toolbar-textarea" rows="22" readonly>${escapeHtml(travelLogText)}</textarea>`
              : `<div class="text-slate-500">Generate a preview to view the copy-ready title and body.</div>`
          }
        </div>
      </div>
    </div>
  `;
}

/* =========================
   TRAVEL TAB
========================= */

export function renderTravelTab(filteredRows) {
  const content = document.getElementById("content");
  if (!content) return;

  const selected = state.selectedEvent || filteredRows[0] || null;
  const tabName = "travel";
  const calendarOptions = getUniqueCalendars();
  const statusOptions = [...new Set(filteredRows.map(r => String(r.Status || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  content.innerHTML = `
    <div class="space-y-6">
      ${renderTravelRouteBuilder()}

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
              <button class="secondary-btn" onclick="window.clearColumnFilters('${tabName}')" type="button">Clear Column Filters</button>
              <button class="secondary-btn" onclick="window.clearFilters()" type="button">Clear Filters</button>
              <button class="secondary-btn" onclick="window.refreshEvents()" type="button">Refresh Travel</button>
            </div>
          </div>
        </div>

        <div class="panel-body">
          <div class="table-scroll-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>CalendarName</th>
                  <th>Status</th>
                  <th>ClientName</th>
                  <th>Address</th>
                  <th>RequestedTime</th>
                  <th>AssignedTime</th>
                  <th>Miles</th>
                  <th>Drive Time</th>
                  <th>Alert</th>
                  <th>EventId</th>
                </tr>
                <tr>
                  <th>${renderColumnFilterInput(tabName, "Date")}</th>
                  <th>${renderColumnFilterSelect(tabName, "CalendarName", calendarOptions)}</th>
                  <th>${renderColumnFilterSelect(tabName, "Status", statusOptions)}</th>
                  <th>${renderColumnFilterInput(tabName, "ClientName")}</th>
                  <th>${renderColumnFilterInput(tabName, "Address")}</th>
                  <th>${renderColumnFilterInput(tabName, "RequestedTime")}</th>
                  <th>${renderColumnFilterInput(tabName, "AssignedTime")}</th>
                  <th>${renderColumnFilterInput(tabName, "Miles")}</th>
                  <th>${renderColumnFilterInput(tabName, "DriveTime")}</th>
                  <th>${renderColumnFilterInput(tabName, "Alert")}</th>
                  <th>${renderColumnFilterInput(tabName, "EventId")}</th>
                </tr>
              </thead>
              <tbody>
                ${
                  filteredRows.length === 0
                    ? `<tr><td colspan="11" class="text-center text-slate-500">No travel rows matched your filters.</td></tr>`
                    : filteredRows.map((row, index) => `
                      <tr class="clickable-row ${getSelectedRowClass(row)}" onclick="window.selectEventByFilteredIndex(${index})">
                        <td>${escapeHtml(row.Date)}</td>
                        <td>${escapeHtml(row.CalendarName)}</td>
                        <td>${renderStatusBadge(row.Status)}</td>
                        <td>${escapeHtml(row.ClientName)}</td>
                        <td>${escapeHtml(row.Address)}</td>
                        <td>${escapeHtml(row.RequestedTime)}</td>
                        <td>${escapeHtml(row.AssignedTime)}</td>
                        <td>${escapeHtml(String(getTravelMiles(row)))}</td>
                        <td>${escapeHtml(String(getTravelMinutes(row)))} mins</td>
                        <td><span class="badge ${getTravelAlertBadgeClass(row)}">${escapeHtml(getTravelAlertLabel(row))}</span></td>
                        <td>${escapeHtml(row.EventId)}</td>
                      </tr>
                    `).join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${
        selected && state.eventDetailOpen
          ? `
            <div class="event-modal-backdrop">
              <div class="event-modal-card">
                <div class="event-modal-header">
                  <div>
                    <h3 class="text-2xl font-semibold">Travel Detail</h3>
                    <p class="text-sm text-slate-500 mt-1">${escapeHtml(selected.ClientName || "")}</p>
                  </div>
                  <button class="secondary-btn" onclick="window.closeEventDetail()" type="button">Close</button>
                </div>
                <div class="event-modal-body space-y-4">
                  ${detailField("Date", selected.Date)}
                  ${detailField("Calendar Name", selected.CalendarName)}
                  ${detailField("Status", selected.Status)}
                  ${detailField("Client Name", selected.ClientName)}
                  ${detailField("Address", selected.Address)}
                  ${detailField("Requested Time", selected.RequestedTime)}
                  ${detailField("Assigned Time", selected.AssignedTime)}
                  ${detailField("Miles", getTravelMiles(selected))}
                  ${detailField("Drive Time (mins)", `${getTravelMinutes(selected)}`)}
                  ${detailField("Alert", getTravelAlertLabel(selected))}
                  ${detailField("Event ID", selected.EventId)}
                </div>
              </div>
            </div>
          `
          : ""
      }
    </div>
  `;
}