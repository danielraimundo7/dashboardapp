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

    const text = String(row.AssignedTime || "").trim();
    if (!text) return sum;
    return sum + 0;
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

function buildMapsUrlFromStops(stops) {
  if (!stops || stops.length < 2) return "";

  const encodedStops = stops.map((stop) => encodeURIComponent(stop.address));
  return `https://www.google.com/maps/dir/${encodedStops.join("/")}`;
}

function buildRouteStopsCopy(calendarName, date, stops) {
  const lines = [
    `Calendar: ${calendarName}`,
    `Date: ${date}`,
    "",
    "Route Stops:"
  ];

  stops.forEach((stop, index) => {
    lines.push(`${index + 1}. ${stop.clientName ? stop.clientName + " — " : ""}${stop.address}`);
  });

  return lines.join("\n");
}

function buildRouteTemplateCopy(calendarName, date, stops) {
  const lines = [
    `Calendar: ${calendarName}`,
    `Date: ${date}`,
    "",
    "Route Stops:"
  ];

  stops.forEach((stop, index) => {
    lines.push(`${index + 1}. ${stop.address}`);
  });

  lines.push("");
  lines.push("Miles:");
  lines.push("Drive Time:");
  lines.push("Notes:");

  return lines.join("\n");
}

export function setRouteBuilderCalendar(value) {
  state.routeBuilder.calendarName = value;
}

export function setRouteBuilderDate(value) {
  state.routeBuilder.date = value;
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
    .filter(isJobEvent)
    .filter((row) => String(row.CalendarName || "").trim() === calendarName)
    .filter((row) => String(row.Date || "").trim() === date)
    .filter((row) => String(row.Address || "").trim() !== "")
    .sort((a, b) => {
      const timeA = String(a.RequestedTime || "");
      const timeB = String(b.RequestedTime || "");
      return timeA.localeCompare(timeB);
    })
    .map((row) => ({
      clientName: String(row.ClientName || "").trim(),
      address: String(row.Address || "").trim(),
      requestedTime: String(row.RequestedTime || "").trim()
    }));

  state.routeBuilder.stops = stops;
  state.routeBuilder.mapsUrl = buildMapsUrlFromStops(stops);
  state.routeBuilder.copyMessage = stops.length ? "" : "No job stops found for that calendar and date.";
}

export async function copyRouteStops() {
  const text = buildRouteStopsCopy(
    state.routeBuilder.calendarName,
    state.routeBuilder.date,
    state.routeBuilder.stops
  );

  try {
    await navigator.clipboard.writeText(text);
    state.routeBuilder.copyMessage = "Route stops copied.";
  } catch (_) {
    state.routeBuilder.copyMessage = "Copy failed.";
  }
}

export async function copyRouteTemplate() {
  const text = buildRouteTemplateCopy(
    state.routeBuilder.calendarName,
    state.routeBuilder.date,
    state.routeBuilder.stops
  );

  try {
    await navigator.clipboard.writeText(text);
    state.routeBuilder.copyMessage = "Route template copied.";
  } catch (_) {
    state.routeBuilder.copyMessage = "Copy failed.";
  }
}

function renderTravelRouteBuilder() {
  const calendars = getUniqueCalendars();
  const selectedCalendar = state.routeBuilder.calendarName || "";
  const selectedDate = state.routeBuilder.date || "";
  const stops = state.routeBuilder.stops || [];
  const mapsUrl = state.routeBuilder.mapsUrl || "";
  const copyMessage = state.routeBuilder.copyMessage || "";

  return `
    <div class="panel">
      <div class="panel-header">
        <h3 class="text-xl font-semibold">Route Builder</h3>
      </div>
      <div class="panel-body space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            class="column-filter-select"
            onchange="window.setRouteBuilderCalendar(this.value)"
          >
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

        <div class="flex flex-wrap gap-2">
          <button
            class="secondary-btn"
            type="button"
            onclick="window.openBuiltRouteInMaps()"
            ${mapsUrl ? "" : "disabled"}
          >
            Open in Google Maps
          </button>

          <button
            class="secondary-btn"
            type="button"
            onclick="window.copyBuiltRouteStops()"
            ${stops.length ? "" : "disabled"}
          >
            Copy Stops
          </button>

          <button
            class="secondary-btn"
            type="button"
            onclick="window.copyBuiltRouteTemplate()"
            ${stops.length ? "" : "disabled"}
          >
            Copy Route Template
          </button>
        </div>

        ${
          copyMessage
            ? `<div class="success-box">${escapeHtml(copyMessage)}</div>`
            : ""
        }

        <div class="detail-section-card">
          <div class="detail-section-title">Built Stops</div>
          ${
            stops.length
              ? `
                <div class="space-y-2">
                  ${stops.map((stop, index) => `
                    <div class="border rounded-xl p-3 bg-white">
                      <div class="font-medium">${index + 1}. ${escapeHtml(stop.clientName || "No client name")}</div>
                      <div class="text-sm text-slate-600">${escapeHtml(stop.address)}</div>
                      <div class="text-sm text-slate-500">${escapeHtml(stop.requestedTime)}</div>
                    </div>
                  `).join("")}
                </div>
              `
              : `<div class="text-slate-500">No route built yet.</div>`
          }
        </div>
      </div>
    </div>
  `;
}

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