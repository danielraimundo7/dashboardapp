import { state } from "./state.js";

/* =========================
   BUILD WORKER COPY TEXT
========================= */
export function buildWorkerCopyText(row) {
  const lines = [];

  const addLine = (label, value) => {
    const text = String(value || "").trim();
    if (!text) return;
    lines.push(`${label}: ${text}`);
  };

  lines.push("🧹 JOB DETAILS");
  lines.push("");

  addLine("Client", row.ClientName);
  addLine("Address", row.Address);
  addLine("Arrival time", row.ArrivalTime || row.RequestedTime);
  addLine("Estimated time", row.DisplayDuration || row.AssignedTime);
  addLine("Service type", row.ServiceType);

  lines.push("");

  addLine("Entrance", row.Entrance);
  addLine("Material info", row.MaterialInfo);

  if (row.Instructions) {
    lines.push("");
    lines.push("Instructions:");
    lines.push(row.Instructions);
  }

  if (row.OtherInfo) {
    lines.push("");
    lines.push("Other Info:");
    lines.push(row.OtherInfo);
  }

  lines.push("");
  addLine("Clock-in link", row.JobLink);

  return lines.join("\n");
}

/* =========================
   FALLBACK COPY METHOD
========================= */
function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

/* =========================
   MAIN COPY FUNCTION
========================= */
export async function copySelectedJobForWorkers(onDone) {
  if (!state.selectedEvent || state.currentTab !== "jobs") return;

  const text = buildWorkerCopyText(state.selectedEvent);

  if (!text) {
    state.copyStatusMessage = "Nothing to copy.";
    if (onDone) onDone();
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopyText(text);
    }

    state.copyStatusMessage = "Copied for WhatsApp.";
    if (onDone) onDone();

    setTimeout(() => {
      state.copyStatusMessage = "";
      if (onDone) onDone();
    }, 2000);
  } catch (error) {
    console.error("Clipboard copy failed:", error);
    state.copyStatusMessage = "Copy failed.";
    if (onDone) onDone();
  }
}

/* =========================
   STATUS UI
========================= */
export function renderCopyStatus() {
  if (!state.copyStatusMessage) return "";
  return `<div class="success-box mt-3">${state.copyStatusMessage}</div>`;
}
