import { state } from "./state.js";
import { escapeHtml, toNumber } from "./utils.js";

let fieldMapInstance = null;
let fieldMapMarkers = [];

function cleanText(value) {
  return String(value || "").trim();
}

function getTodayDateInput() {
  const d = new Date();
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return local.toISOString().slice(0, 10);
}

function ensureFieldMapDefaults() {
  if (!state.fieldMap) {
    state.fieldMap = {
      selectedWorkerId: "",
      selectedDate: "",
      showOpenOnly: false
    };
  }

  if (!state.fieldMap.selectedDate) {
    state.fieldMap.selectedDate = getTodayDateInput();
  }

  if (typeof state.fieldMap.showOpenOnly !== "boolean") {
    state.fieldMap.showOpenOnly = false;
  }
}

function parseDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getDateOnlyFromValue(value) {
  const d = parseDateTime(value);
  if (!d) return cleanText(value).slice(0, 10);

  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return local.toISOString().slice(0, 10);
}

function getEntryServiceDate(entry) {
  return (
    cleanText(entry.SessionDate) ||
    cleanText(entry.Date) ||
    getDateOnlyFromValue(entry.ClockInTime) ||
    getDateOnlyFromValue(entry.ClockOutTime)
  );
}

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function formatDateTime(value) {
  const d = parseDateTime(value);
  if (!d) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getEntryLastActionTime(entry) {
  const status = cleanText(entry.Status).toUpperCase();

  if (status === "OPEN") {
    return parseDateTime(entry.ClockInTime);
  }

  return parseDateTime(entry.ClockOutTime) || parseDateTime(entry.ClockInTime);
}

function getEntryLat(entry) {
  const status = cleanText(entry.Status).toUpperCase();

  if (status === "OPEN") {
    return toNumber(entry.ClockInLatitude);
  }

  return toNumber(entry.ClockOutLatitude) || toNumber(entry.ClockInLatitude);
}

function getEntryLng(entry) {
  const status = cleanText(entry.Status).toUpperCase();

  if (status === "OPEN") {
    return toNumber(entry.ClockInLongitude);
  }

  return toNumber(entry.ClockOutLongitude) || toNumber(entry.ClockInLongitude);
}

function getFilteredFieldMapEntries() {
  ensureFieldMapDefaults();

  const selectedDate = cleanText(state.fieldMap.selectedDate);
  const showOpenOnly = Boolean(state.fieldMap.showOpenOnly);

  let rows = state.timeEntries || [];

  if (showOpenOnly) {
    return rows
      .filter((entry) => cleanText(entry.Status).toUpperCase() === "OPEN")
      .sort((a, b) => {
        const aTime = getEntryLastActionTime(a);
        const bTime = getEntryLastActionTime(b);
        return (bTime?.getTime() || 0) - (aTime?.getTime() || 0);
      });
  }

  rows = rows.filter((entry) => getEntryServiceDate(entry) === selectedDate);

  const byWorker = new Map();

  rows.forEach((entry) => {
    const workerId = cleanText(entry.WorkerID);
    if (!workerId) return;

    const actionTime = getEntryLastActionTime(entry);
    if (!actionTime) return;

    const existing = byWorker.get(workerId);
    const existingTime = existing ? getEntryLastActionTime(existing) : null;

    if (!existing || !existingTime || actionTime > existingTime) {
      byWorker.set(workerId, entry);
    }
  });

  return [...byWorker.values()].sort((a, b) => {
    const nameA = cleanText(a.WorkerName).toLowerCase();
    const nameB = cleanText(b.WorkerName).toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

function parseAssignedMinutes(entry) {
  const raw = cleanText(entry.AssignedTime);
  const numeric = toNumber(raw);

  if (numeric && numeric > 0) {
    if (numeric <= 24) return Math.round(numeric * 60);
    return Math.round(numeric);
  }

  let total = 0;
  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minuteMatch = raw.match(/(\d+(?:\.\d+)?)\s*m/i);

  if (hourMatch) total += Number(hourMatch[1]) * 60;
  if (minuteMatch) total += Number(minuteMatch[1]);

  return Math.round(total);
}

function getEntryAlert(entry) {
  const status = cleanText(entry.Status).toUpperCase();
  const lat = getEntryLat(entry);
  const lng = getEntryLng(entry);
  const now = new Date();

  if (!lat || !lng) {
    return {
      icon: "🟡",
      label: "Missing GPS",
      className: "badge-warning",
      message: "No usable GPS location was captured."
    };
  }

  if (status === "OPEN") {
    const clockIn = parseDateTime(entry.ClockInTime);
    const openMinutes = minutesBetween(clockIn, now);
    const assignedMinutes = parseAssignedMinutes(entry);

    if (assignedMinutes && openMinutes > assignedMinutes + 30) {
      return {
        icon: "🔴",
        label: "Open Too Long",
        className: "badge-danger",
        message: `Open for ${openMinutes} minutes. Assigned time is about ${assignedMinutes} minutes.`
      };
    }

    return {
      icon: "🟢",
      label: "Clocked In",
      className: "badge-success",
      message: `Currently clocked in for ${openMinutes} minutes.`
    };
  }

  if (status === "CLOSED") {
    return {
      icon: "⚪",
      label: "Clocked Out",
      className: "badge-neutral",
      message: "Most recent entry is closed."
    };
  }

  return {
    icon: "🟡",
    label: status || "Unknown",
    className: "badge-warning",
    message: "Status needs review."
  };
}

function getGoogleMapsSearchUrl(address) {
  if (!address) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function getGoogleMapsPointUrl(lat, lng) {
  if (!lat || !lng) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function getMarkerPopupHtml(entry) {
  const status = cleanText(entry.Status).toUpperCase();
  const lat = getEntryLat(entry);
  const lng = getEntryLng(entry);
  const alert = getEntryAlert(entry);

  const locationUrl = getGoogleMapsPointUrl(lat, lng);
  const addressUrl = getGoogleMapsSearchUrl(cleanText(entry.Address));

  const timeLabel = status === "OPEN" ? "Clocked In" : "Last Clocked Out";
  const timeValue = status === "OPEN" ? entry.ClockInTime : entry.ClockOutTime || entry.ClockInTime;

  return `
    <div style="min-width:260px">
      <div style="font-weight:700;font-size:15px;margin-bottom:4px;">
        ${alert.icon} ${escapeHtml(entry.WorkerName || "Unknown Worker")}
      </div>

      <div style="font-size:12px;color:#475569;margin-bottom:8px;">
        ${escapeHtml(entry.WorkerID || "")}
      </div>

      <div style="margin-bottom:6px;">
        <strong>Status:</strong> ${escapeHtml(status)}
      </div>

      <div style="margin-bottom:6px;">
        <strong>Alert:</strong> ${escapeHtml(alert.label)}
      </div>

      <div style="margin-bottom:6px;">
        <strong>${escapeHtml(timeLabel)}:</strong> ${escapeHtml(formatDateTime(timeValue))}
      </div>

      <div style="margin-bottom:6px;">
        <strong>Service Date:</strong> ${escapeHtml(getEntryServiceDate(entry))}
      </div>

      <div style="margin-bottom:6px;">
        <strong>Client:</strong> ${escapeHtml(entry.ClientName || "")}
      </div>

      <div style="margin-bottom:6px;">
        <strong>Address:</strong><br/>
        ${escapeHtml(entry.Address || "")}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        ${locationUrl ? `<a href="${locationUrl}" target="_blank" rel="noopener noreferrer">Open GPS</a>` : ""}
        ${addressUrl ? `<a href="${addressUrl}" target="_blank" rel="noopener noreferrer">Open Address</a>` : ""}
      </div>
    </div>
  `;
}

function clearFieldMapMarkers() {
  fieldMapMarkers.forEach((marker) => {
    if (fieldMapInstance) {
      fieldMapInstance.removeLayer(marker);
    }
  });

  fieldMapMarkers = [];
}

function initializeFieldMap(entries) {
  const mapEl = document.getElementById("fieldMapCanvas");
  if (!mapEl || typeof L === "undefined") return;

  if (!fieldMapInstance) {
    fieldMapInstance = L.map("fieldMapCanvas").setView([37.5407, -77.4360], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(fieldMapInstance);
  }

  setTimeout(() => {
    fieldMapInstance.invalidateSize();
  }, 50);

  clearFieldMapMarkers();

  const points = [];

  entries.forEach((entry) => {
    const lat = getEntryLat(entry);
    const lng = getEntryLng(entry);
    if (!lat || !lng) return;

    const alert = getEntryAlert(entry);

    const marker = L.marker([lat, lng]).addTo(fieldMapInstance);
    marker.bindPopup(getMarkerPopupHtml(entry));
    marker.bindTooltip(`${alert.icon} ${entry.WorkerName || entry.WorkerID || "Worker"}`);

    fieldMapMarkers.push(marker);
    points.push([lat, lng]);
  });

  if (points.length === 1) {
    fieldMapInstance.setView(points[0], 13);
  } else if (points.length > 1) {
    fieldMapInstance.fitBounds(points, { padding: [40, 40] });
  }
}

function renderWorkerStatusCard(entry) {
  const status = cleanText(entry.Status).toUpperCase();
  const alert = getEntryAlert(entry);
  const lat = getEntryLat(entry);
  const lng = getEntryLng(entry);

  const timeLabel = status === "OPEN" ? "Clock In" : "Last Out";
  const timeValue = status === "OPEN" ? entry.ClockInTime : entry.ClockOutTime || entry.ClockInTime;

  return `
    <div class="detail-section-card no-break">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="font-semibold text-lg">
            ${alert.icon} ${escapeHtml(entry.WorkerName || "Unknown Worker")}
          </div>
          <div class="text-sm text-slate-500">${escapeHtml(entry.WorkerID || "")}</div>
        </div>

        <span class="badge ${escapeHtml(alert.className)}">${escapeHtml(alert.label)}</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm">
        <div>
          <div class="stat-label">Status</div>
          <div>${escapeHtml(status)}</div>
        </div>

        <div>
          <div class="stat-label">${escapeHtml(timeLabel)}</div>
          <div>${escapeHtml(formatDateTime(timeValue))}</div>
        </div>

        <div>
          <div class="stat-label">Service Date</div>
          <div>${escapeHtml(getEntryServiceDate(entry))}</div>
        </div>

        <div>
          <div class="stat-label">Client</div>
          <div>${escapeHtml(entry.ClientName || "")}</div>
        </div>

        <div>
          <div class="stat-label">Calendar</div>
          <div>${escapeHtml(entry.CalendarName || "")}</div>
        </div>

        <div>
          <div class="stat-label">Assigned Time</div>
          <div>${escapeHtml(entry.AssignedTime || "")}</div>
        </div>

        <div class="md:col-span-2">
          <div class="stat-label">Address</div>
          <div>${escapeHtml(entry.Address || "")}</div>
        </div>

        <div class="md:col-span-2">
          <div class="stat-label">Alert Message</div>
          <div>${escapeHtml(alert.message)}</div>
        </div>

        <div>
          <div class="stat-label">GPS</div>
          <div>${lat && lng ? `${lat}, ${lng}` : "Missing"}</div>
        </div>

        <div>
          <div class="stat-label">Location Status</div>
          <div>${escapeHtml(entry.LocationStatus || "")}</div>
        </div>
      </div>
    </div>
  `;
}

export function setFieldMapDate(value) {
  ensureFieldMapDefaults();
  state.fieldMap.selectedDate = value || getTodayDateInput();
  state.fieldMap.showOpenOnly = false;
}

export function showFieldMapOpenOnly() {
  ensureFieldMapDefaults();
  state.fieldMap.showOpenOnly = true;
}

export function showFieldMapToday() {
  ensureFieldMapDefaults();
  state.fieldMap.selectedDate = getTodayDateInput();
  state.fieldMap.showOpenOnly = false;
}

export function renderFieldMapTab() {
  const content = document.getElementById("content");
  if (!content) return;

  ensureFieldMapDefaults();

  const entries = getFilteredFieldMapEntries();

  const openCount = entries.filter((entry) => cleanText(entry.Status).toUpperCase() === "OPEN").length;
  const missingGpsCount = entries.filter((entry) => {
    const lat = getEntryLat(entry);
    const lng = getEntryLng(entry);
    return !lat || !lng;
  }).length;

  const alertCount = entries.filter((entry) => {
    const alert = getEntryAlert(entry);
    return ["Open Too Long", "Missing GPS"].includes(alert.label);
  }).length;

  const modeLabel = state.fieldMap.showOpenOnly
    ? "All currently open jobs"
    : `Worker status for ${state.fieldMap.selectedDate}`;

  content.innerHTML = `
    <div class="space-y-6">
      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 class="text-2xl font-semibold">Field Map</h2>
              <p class="text-sm text-slate-500">
                ${escapeHtml(modeLabel)}
              </p>
            </div>

            <button class="secondary-btn" type="button" onclick="window.refreshTimeEntries()">
              Refresh Time Entries
            </button>
          </div>
        </div>

        <div class="panel-body space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div class="stat-label">Date</div>
              <input
                type="date"
                class="column-filter-input"
                value="${escapeHtml(state.fieldMap.selectedDate || getTodayDateInput())}"
                onchange="window.setFieldMapDateAndRender(this.value)"
              />
            </div>

            <div class="flex items-end">
              <button class="secondary-btn w-full" type="button" onclick="window.showFieldMapTodayAndRender()">
                Today
              </button>
            </div>

            <div class="flex items-end">
              <button class="secondary-btn w-full" type="button" onclick="window.showFieldMapOpenOnlyAndRender()">
                Show All Open Jobs
              </button>
            </div>

            <div class="flex items-end">
              <div class="success-box w-full">
                ${escapeHtml(modeLabel)}
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="stat-card">
              <div class="stat-label">Workers / Entries Shown</div>
              <div class="stat-value">${entries.length}</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Currently Clocked In</div>
              <div class="stat-value">${openCount}</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Missing GPS</div>
              <div class="stat-value">${missingGpsCount}</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Needs Review</div>
              <div class="stat-value">${alertCount}</div>
            </div>
          </div>

          <div id="fieldMapCanvas" class="field-map-canvas"></div>

          <div class="text-sm text-slate-500">
            Date mode shows the most recent status per worker for that date. Open mode shows all currently open jobs regardless of date.
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        ${
          entries.length
            ? entries.map(renderWorkerStatusCard).join("")
            : `<div class="blank-state-box">No worker statuses found for this view.</div>`
        }
      </div>
    </div>
  `;

  initializeFieldMap(entries);
}