export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function toNumber(value) {
  const cleaned = String(value ?? "").replace(/[$,% ,]/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function round2(value) {
  return Math.round((value || 0) * 100) / 100;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value || 0);
}

export function formatHours(value) {
  return `${(value || 0).toFixed(2)} hrs`;
}

export function formatDateTimeFriendly(isoString) {
  if (!isoString) return "Not available";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;

  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function normalizeActiveValue(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "active" || v === "1" || v === "☑" || v === "✅";
}

export function getActiveBadgeClass(isActive) {
  return isActive ? "badge-success" : "badge-danger";
}

export function extractHrefOrUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const hrefMatch = text.match(/href\s*=\s*["']([^"']+)["']/i);
  if (hrefMatch && hrefMatch[1]) return hrefMatch[1];

  const urlMatch = text.match(/https?:\/\/[^\s<>"']+/i);
  if (urlMatch && urlMatch[0]) return urlMatch[0];

  return "";
}

export function renderLinkCell(value) {
  const url = extractHrefOrUrl(value);
  if (!url) return "";
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">Open</a>`;
}

export function renderLinkButtons(row) {
  const links = [
    { label: "Contract", value: extractHrefOrUrl(row.Contract) },
    { label: "Estimate", value: extractHrefOrUrl(row.Estimate) },
    { label: "Invoice", value: extractHrefOrUrl(row.Invoice) },
    { label: "Photos", value: extractHrefOrUrl(row.Photos) }
  ].filter((item) => item.value);

  if (!links.length) return `<div class="text-slate-500">No links available.</div>`;

  return `
    <div class="flex flex-wrap gap-2">
      ${links.map((item) => `
        <a
          href="${escapeHtml(item.value)}"
          target="_blank"
          rel="noopener noreferrer"
          class="secondary-btn"
        >${escapeHtml(item.label)}</a>
      `).join("")}
    </div>
  `;
}

export function durationToHoursFromDisplay(display) {
  const text = String(display || "").toLowerCase();
  let totalMinutes = 0;

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hoursMatch) totalMinutes += parseFloat(hoursMatch[1]) * 60;

  const minutesMatch = text.match(/(\d+(?:\.\d+)?)\s*m/);
  if (minutesMatch) totalMinutes += parseFloat(minutesMatch[1]);

  return round2(totalMinutes / 60);
}

export function durationToMinutesFromDisplay(display) {
  const text = String(display || "").toLowerCase();
  let totalMinutes = 0;

  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hoursMatch) totalMinutes += parseFloat(hoursMatch[1]) * 60;

  const minutesMatch = text.match(/(\d+(?:\.\d+)?)\s*m/);
  if (minutesMatch) totalMinutes += parseFloat(minutesMatch[1]);

  return round2(totalMinutes);
}

export function detailField(label, value) {
  return `
    <div>
      <label class="block text-sm font-medium mb-1">${escapeHtml(label)}</label>
      <input class="toolbar-input" value="${escapeHtml(value || "")}" disabled />
    </div>
  `;
}

export function detailTextarea(label, value) {
  return `
    <div>
      <label class="block text-sm font-medium mb-1">${escapeHtml(label)}</label>
      <textarea class="toolbar-textarea" rows="3" disabled>${escapeHtml(value || "")}</textarea>
    </div>
  `;
}