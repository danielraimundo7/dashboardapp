import { state } from "./state.js";
import { formatDateTimeFriendly } from "./utils.js";

export const API_BASE_URL =
  "https://script.google.com/macros/s/AKfycbwz401Ii47fb86kB-eo93tirJmGpbHFS2jEonIn6yuFjNqu5rxjQiPvUTOzDkvAvoPR/exec";

export async function loadDashboardMetaFromApi() {
  const url = `${API_BASE_URL}?action=getDashboardMeta&_=${Date.now()}`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading dashboard metadata.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to load dashboard metadata.");
  }

  state.dashboardMeta = result.data || { lastSyncIso: "" };
  updateLastSyncText();
}

export function updateLastSyncText() {
  const el = document.getElementById("lastSyncText");
  if (!el) return;

  if (!state.dashboardMeta.lastSyncIso) {
    el.innerText = "Not available";
    return;
  }

  el.innerText = formatDateTimeFriendly(state.dashboardMeta.lastSyncIso);
}

export async function loadEventsFromApi() {
  const url = `${API_BASE_URL}?action=getJobs&_=${Date.now()}`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading Events.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to load Events data.");
  }

  state.eventsData = Array.isArray(result.data) ? result.data : [];
  state.eventsLoadedFromApi = true;
}

export async function loadWorkersFromApi() {
  const url = `${API_BASE_URL}?action=getWorkers&_=${Date.now()}`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading Workers.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to load Workers data.");
  }

  state.workers = Array.isArray(result.data) ? result.data : [];
  state.workersLoadedFromApi = true;

  if (!state.selectedWorker && state.workers.length > 0) {
    state.selectedWorker = state.workers[0];
  }
}

export async function loadJobsPerWorkerFromApi() {
  const url = `${API_BASE_URL}?action=getJobsPerWorker&_=${Date.now()}`;
  const response = await fetch(url, { method: "GET", cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading JobsPerWorker.`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to load JobsPerWorker data.");
  }

  state.jobsPerWorker = Array.isArray(result.data) ? result.data : [];
  state.jobsPerWorkerLoadedFromApi = true;
}
