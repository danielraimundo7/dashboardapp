import { state } from "./state.js";

export function buildWorkerCopyText(row) {
  const lines = [];

  const addLine = (label, value) => {
    const text = String(value || "").trim();
    if (!text) return;
    lines.push(`${label}: ${text}`);
  };

  addLine("Client", row.ClientName);
  addLine("Address", row.Address);
  addLine("Arrival time", row.ArrivalTime);
  addLine("Estimated time", row.DisplayDuration);
  addLine("Service type", row.ServiceType);
  addLine("Entrance", row.Entrance);
  addLine("Material info", row.MaterialInfo);
  addLine("Instructions", row.Instructions);

  return lines.join("\n");
}

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

export async function copySelectedJobForWorkers(onDone) {
  if (!state.selectedEvent || state.currentTab !== "jobs") return;

  const text = buildWorkerCopyText(state.selectedEvent);

  if (!text) {
    state.copyStatusMessage = "Nothing to copy.";
    onDone();
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopyText(text);
    }

    state.copyStatusMessage = "Copied for WhatsApp.";
    onDone();

    window.setTimeout(() => {
      state.copyStatusMessage = "";
      onDone();
    }, 2000);
  } catch (error) {
    console.error("Clipboard copy failed:", error);
    state.copyStatusMessage = "Copy failed.";
    onDone();
  }
}

export function renderCopyStatus() {
  if (!state.copyStatusMessage) return "";
  return `<div class="success-box mt-3">${state.copyStatusMessage}</div>`;
}