import { state } from "./state.js";
import { escapeHtml, formatDateTimeFriendly } from "./utils.js";

function toDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getElapsedText(startValue, endValue = "") {
  const start = toDate(startValue);
  if (!start) return "-";

  const end = endValue ? toDate(endValue) : new Date();
  if (!end) return "-";

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return "-";

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function hasClockInGps(row) {
  return row.ClockInLatitude && row.ClockInLongitude;
}

function hasClockOutGps(row) {
  return row.ClockOutLatitude && row.ClockOutLongitude;
}

function hasAnyGps(row) {
  return hasClockInGps(row) || hasClockOutGps(row);
}

function getStatusBadge(status) {
  const normalized = String(status || "").toUpperCase();
  const cls = normalized === "OPEN" ? "badge-success" : "badge-neutral";
  return `<span class="badge ${cls}">${escapeHtml(status || "")}</span>`;
}

function getFilteredTimeEntries() {
  const searchInput = document.getElementById("search");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const startDate = startDateInput ? startDateInput.value : "";
  const endDate = endDateInput ? endDateInput.value : "";

  return state.timeEntries.filter((row) => {
    const text = JSON.stringify(row).toLowerCase();
    const matchesSearch = !search || text.includes(search);

    const rowDate = String(row.SessionDate || row.Date || "").trim();
    const matchesStart = !startDate || (rowDate && rowDate >= startDate);
    const matchesEnd = !endDate || (rowDate && rowDate <= endDate);

    return matchesSearch && matchesStart && matchesEnd;
  });
}

export function updateSummaryCardsForTimeEntries(filteredRows) {
  const countEl = document.getElementById("jobCount");
  const revenueEl = document.getElementById("revenueTotal");
  const laborEl = document.getElementById("laborTotal");
  const assignedEl = document.getElementById("assignedTimeTotal");

  const openCount = filteredRows.filter((row) => String(row.Status || "").toUpperCase() === "OPEN").length;
  const gpsCount = filteredRows.filter(hasAnyGps).length;

  if (countEl) countEl.innerText = filteredRows.length;
  if (revenueEl) revenueEl.innerText = `${openCount} open`;
  if (laborEl) laborEl.innerText = `${gpsCount} GPS`;
  if (assignedEl) assignedEl.innerText = "-";
}

function renderLiveClockedIn(openRows) {
  return `
    <div class="panel">
      <div class="panel-header">
        <h2 class="text-2xl font-semibold">Live Clocked In</h2>
        <p class="text-sm text-slate-500">Workers currently clocked in.</p>
      </div>
      <div class="panel-body">
        ${
          openRows.length === 0
            ? `<div class="blank-state-box">No workers are currently clocked in.</div>`
            : `
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                ${openRows.map((row, index) => `
                  <div class="live-clock-card">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="font-bold text-lg">${escapeHtml(row.WorkerName)}</div>
                        <div class="text-sm text-slate-500">${escapeHtml(row.WorkerID)}</div>
                      </div>
                      ${getStatusBadge(row.Status)}
                    </div>

                    <div class="mt-4">
                      <div class="font-semibold">${escapeHtml(row.ClientName)}</div>
                      <div class="text-sm text-slate-600">${escapeHtml(row.Address)}</div>
                    </div>

                    <div class="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <div class="stat-label">Clocked In</div>
                        <div class="font-semibold">${escapeHtml(formatDateTimeFriendly(row.ClockInTime))}</div>
                      </div>
                      <div>
                        <div class="stat-label">Elapsed</div>
                        <div class="font-semibold">${escapeHtml(getElapsedText(row.ClockInTime))}</div>
                      </div>
                    </div>

                    <div class="mt-4 flex flex-wrap gap-2">
                      <button
                        class="secondary-btn"
                        type="button"
                        onclick="window.openTimeEntryMapByOpenIndex(${index})"
                        ${hasAnyGps(row) ? "" : "disabled"}
                      >
                        View Map
                      </button>
                    </div>
                  </div>
                `).join("")}
              </div>
            `
        }
      </div>
    </div>
  `;
}

function renderTimeEntriesTable(filteredRows) {
  return `
    <div class="panel">
      <div class="panel-header">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-2xl font-semibold">All Time Entries</h2>
            <p class="text-sm text-slate-500">
              Total rows: <strong>${state.timeEntries.length}</strong> |
              Filtered rows: <strong>${filteredRows.length}</strong>
            </p>
          </div>
          <button class="secondary-btn" onclick="window.refreshTimeEntries()" type="button">
            Refresh Time Entries
          </button>
        </div>
      </div>

      <div class="panel-body">
        <div class="table-scroll-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Worker</th>
                <th>Client</th>
                <th>Address</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Elapsed</th>
                <th>Total Minutes</th>
                <th>GPS</th>
                <th>Map</th>
              </tr>
            </thead>
            <tbody>
              ${
                filteredRows.length === 0
                  ? `<tr><td colspan="10" class="text-center text-slate-500">No time entries found.</td></tr>`
                  : filteredRows.map((row, index) => `
                    <tr>
                      <td>${getStatusBadge(row.Status)}</td>
                      <td>${escapeHtml(row.WorkerName)}<br><span class="text-xs text-slate-500">${escapeHtml(row.WorkerID)}</span></td>
                      <td>${escapeHtml(row.ClientName)}</td>
                      <td>${escapeHtml(row.Address)}</td>
                      <td>${escapeHtml(formatDateTimeFriendly(row.ClockInTime))}</td>
                      <td>${row.ClockOutTime ? escapeHtml(formatDateTimeFriendly(row.ClockOutTime)) : "-"}</td>
                      <td>${escapeHtml(getElapsedText(row.ClockInTime, row.ClockOutTime))}</td>
                      <td>${escapeHtml(row.TotalMinutes || "")}</td>
                      <td>
                        ${hasClockInGps(row) ? `<span class="badge badge-success">In GPS</span>` : `<span class="badge badge-danger">No In GPS</span>`}
                        ${hasClockOutGps(row) ? `<span class="badge badge-success">Out GPS</span>` : ""}
                      </td>
                      <td>
                        <button
                          class="secondary-btn"
                          type="button"
                          onclick="window.openTimeEntryMapByFilteredIndex(${index})"
                          ${hasAnyGps(row) ? "" : "disabled"}
                        >
                          Map
                        </button>
                      </td>
                    </tr>
                  `).join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderMapModal() {
  if (!state.timeEntryMapOpen || !state.selectedTimeEntry) return "";

  const row = state.selectedTimeEntry;

  return `
    <div class="event-modal-backdrop">
      <div class="event-modal-card">
        <div class="event-modal-header">
          <div>
            <h3 class="text-2xl font-semibold">Clock Location Map</h3>
            <p class="text-sm text-slate-500 mt-1">
              ${escapeHtml(row.WorkerName)} — ${escapeHtml(row.ClientName)}
            </p>
          </div>
          <button class="secondary-btn" onclick="window.closeTimeEntryMap()" type="button">Close</button>
        </div>

        <div class="event-modal-body">
          <div class="mb-4">
            <div class="font-semibold">${escapeHtml(row.Address)}</div>
            <div class="text-sm text-slate-500">
              Clock In: ${escapeHtml(formatDateTimeFriendly(row.ClockInTime))}
              ${row.ClockOutTime ? ` | Clock Out: ${escapeHtml(formatDateTimeFriendly(row.ClockOutTime))}` : ""}
            </div>
          </div>

          <div id="timeEntryLeafletMap" class="leaflet-map"></div>
        </div>
      </div>
    </div>
  `;
}

function initLeafletMap(row) {
  const el = document.getElementById("timeEntryLeafletMap");
  if (!el || !window.L) return;

  const points = [];

  if (hasClockInGps(row)) {
    points.push({
      label: "Clock In",
      lat: Number(row.ClockInLatitude),
      lng: Number(row.ClockInLongitude),
      accuracy: row.ClockInAccuracyMeters,
      time: row.ClockInTime
    });
  }

  if (hasClockOutGps(row)) {
    points.push({
      label: "Clock Out",
      lat: Number(row.ClockOutLatitude),
      lng: Number(row.ClockOutLongitude),
      accuracy: row.ClockOutAccuracyMeters,
      time: row.ClockOutTime
    });
  }

  const validPoints = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!validPoints.length) return;

  const map = L.map(el);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const bounds = [];

  validPoints.forEach((point) => {
    const latLng = [point.lat, point.lng];
    bounds.push(latLng);

    L.marker(latLng)
      .addTo(map)
      .bindPopup(`
        <strong>${escapeHtml(point.label)}</strong><br>
        ${escapeHtml(formatDateTimeFriendly(point.time))}<br>
        Accuracy: ${escapeHtml(point.accuracy || "-")} meters
      `);

    if (point.accuracy) {
      L.circle(latLng, {
        radius: Number(point.accuracy),
        weight: 1,
        fillOpacity: 0.08
      }).addTo(map);
    }
  });

  if (validPoints.length > 1) {
    L.polyline(bounds).addTo(map);
    map.fitBounds(bounds, { padding: [40, 40] });
  } else {
    map.setView(bounds[0], 16);
  }

  setTimeout(() => map.invalidateSize(), 150);
}

export function renderTimeEntriesTab() {
  const content = document.getElementById("content");
  if (!content) return;

  const filteredRows = getFilteredTimeEntries();
  const openRows = state.timeEntries.filter((row) => String(row.Status || "").toUpperCase() === "OPEN");

  updateSummaryCardsForTimeEntries(filteredRows);

  content.innerHTML = `
    <div class="space-y-6">
      ${renderLiveClockedIn(openRows)}
      ${renderTimeEntriesTable(filteredRows)}
      ${renderMapModal()}
    </div>
  `;

  if (state.timeEntryMapOpen && state.selectedTimeEntry) {
    requestAnimationFrame(() => initLeafletMap(state.selectedTimeEntry));
  }
}

export function openTimeEntryMap(row) {
  state.selectedTimeEntry = row;
  state.timeEntryMapOpen = true;
}

export function closeTimeEntryMap() {
  state.selectedTimeEntry = null;
  state.timeEntryMapOpen = false;
}