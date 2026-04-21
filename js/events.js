import { state } from "./state.js";
import {
  escapeHtml,
  detailField,
  detailTextarea,
  durationToHoursFromDisplay,
  durationToMinutesFromDisplay,
  formatCurrency,
  formatHours,
  renderLinkButtons,
  renderLinkCell,
  toNumber
} from "./utils.js";
import { renderCopyStatus } from "./copy.js";

export function updateSummaryCardsForEvents(filteredRows) {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  const eventCount = filteredRows.length;
  const revenueTotal = filteredRows.reduce((sum, row) => sum + toNumber(row.GivenPrice), 0);
  const assignedTimeTotal = filteredRows.reduce((sum, row) => sum + durationToHoursFromDisplay(row.DisplayDuration), 0);
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
  return durationToMinutesFromDisplay(row.DisplayDuration);
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
    <div class="border rounded-2xl p-4 bg-slate-50">
      <div class="text-sm font-semibold tracking-wide text-slate-700 mb-3">${escapeHtml(title)}</div>
      <div class="grid grid-cols-1 gap-3">
        ${innerHtml}
      </div>
    </div>
  `;
}

function renderEventDetailModal(selected, showCopyButton) {
  if (!selected || !state.eventDetailOpen) return "";

  return `
    <div class="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border">
        <div class="flex items-center justify-between px-6 py-4 border-b bg-white">
          <div>
            <h3 class="text-2xl font-semibold">Event Detail</h3>
            <p class="text-sm text-slate-500 mt-1">${escapeHtml(selected.ClientName || "")} — ${escapeHtml(selected.ServiceType || "")}</p>
          </div>
          <div class="flex items-center gap-2">
            ${showCopyButton ? `<button class="primary-btn" onclick="window.copySelectedJobForWorkers()" type="button">Copy for Workers</button>` : ""}
            <button
              class="secondary-btn"
              onclick="window.closeEventDetail()"
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        <div class="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${detailField("Date", selected.Date)}
            ${detailField("Calendar Name", selected.CalendarName)}
            ${detailField("Event Type", selected.EventType)}
            ${detailField("Client Name", selected.ClientName)}
            ${detailField("Zone", selected.Zone)}
            ${detailField("Display Duration", selected.DisplayDuration)}
            ${detailField("Company", selected.Company)}
            ${detailField("Arrival Time", selected.ArrivalTime)}
            ${detailField("Job Sequence", selected.JobSequence)}
            ${detailField("Address", selected.Address)}
          </div>

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
            ${detailField("Frequency", selected.Frequency)}
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

          <div class="border rounded-2xl p-4 bg-slate-50">
            <div class="text-sm font-semibold tracking-wide text-slate-700 mb-3">LINKS SECTION</div>
            ${renderLinkButtons(selected)}
          </div>

          ${showCopyButton ? renderCopyStatus() : ""}
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
              <button class="secondary-btn" onclick="window.clearFilters()" type="button">Clear Filters</button>
              <button class="secondary-btn" onclick="window.refreshEvents()" type="button">Refresh ${escapeHtml(heading)}</button>
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
                  <th>AdditionalExpense</th>
                  <th>RateType</th>
                  <th>Tip</th>
                  <th>PaymentType</th>
                  <th>CC</th>
                  <th>PayStatus</th>
                  <th>PaidAmount</th>
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
                    ? `<tr><td colspan="${showEventType ? 26 : 25}" class="text-center text-slate-500">No rows matched your filters.</td></tr>`
                    : filteredRows.map((row, index) => `
                      <tr class="clickable-row ${getSelectedRowClass(row)}" onclick="window.selectEventByFilteredIndex(${index})">
                        <td>${escapeHtml(row.Date)}</td>
                        <td>${escapeHtml(row.CalendarName)}</td>
                        ${showEventType ? `<td><span class="badge badge-neutral">${escapeHtml(row.EventType)}</span></td>` : ""}
                        <td>${escapeHtml(row.ClientName)}</td>
                        <td>${escapeHtml(row.Zone)}</td>
                        <td>${escapeHtml(row.DisplayDuration)}</td>
                        <td>${escapeHtml(row.Company)}</td>
                        <td>${escapeHtml(row.ArrivalTime)}</td>
                        <td>${escapeHtml(row.JobSequence)}</td>
                        <td>${escapeHtml(row.Address)}</td>
                        <td>${escapeHtml(row.Frequency)}</td>
                        <td>${escapeHtml(row.GivenPrice)}</td>
                        <td>${escapeHtml(row.AdditionalExpense)}</td>
                        <td>${escapeHtml(row.RateType)}</td>
                        <td>${escapeHtml(row.Tip)}</td>
                        <td>${escapeHtml(row.PaymentType)}</td>
                        <td>${escapeHtml(row.CC)}</td>
                        <td>${escapeHtml(row.PayStatus)}</td>
                        <td>${escapeHtml(row.PaidAmount)}</td>
                        <td>${escapeHtml(row.ServiceType)}</td>
                        <td>${escapeHtml(row.Phone)}</td>
                        <td>${renderLinkCell(row.Contract)}</td>
                        <td>${renderLinkCell(row.Estimate)}</td>
                        <td>${renderLinkCell(row.Invoice)}</td>
                        <td>${renderLinkCell(row.Photos)}</td>
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

export function renderTravelTab(filteredRows) {
  const content = document.getElementById("content");
  if (!content) return;

  const selected = state.selectedEvent || filteredRows[0] || null;

  content.innerHTML = `
    <div class="space-y-6">
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
              <button class="secondary-btn" onclick="window.clearFilters()" type="button">Clear Filters</button>
              <button class="secondary-btn" onclick="window.refreshEvents()" type="button">Refresh Travel</button>
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
                      <tr class="clickable-row ${getSelectedRowClass(row)}" onclick="window.selectEventByFilteredIndex(${index})">
                        <td>${escapeHtml(row.Date)}</td>
                        <td>${escapeHtml(row.CalendarName)}</td>
                        <td>${escapeHtml(row.ClientName)}</td>
                        <td>${escapeHtml(row.DisplayDuration)}</td>
                        <td>${escapeHtml(row.ArrivalTime)}</td>
                        <td>${escapeHtml(row.Address)}</td>
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
            <div class="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-4">
              <div class="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border">
                <div class="flex items-center justify-between px-6 py-4 border-b bg-white">
                  <div>
                    <h3 class="text-2xl font-semibold">Travel Detail</h3>
                    <p class="text-sm text-slate-500 mt-1">${escapeHtml(selected.ClientName || "")}</p>
                  </div>
                  <button class="secondary-btn" onclick="window.closeEventDetail()" type="button">Close</button>
                </div>
                <div class="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-4">
                  ${detailField("Date", selected.Date)}
                  ${detailField("Calendar Name", selected.CalendarName)}
                  ${detailField("Client Name", selected.ClientName)}
                  ${detailField("Display Duration", selected.DisplayDuration)}
                  ${detailField("Arrival Time", selected.ArrivalTime)}
                  ${detailField("Address", selected.Address)}
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