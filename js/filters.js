import { state } from "./state.js";

export function getUniqueCalendars() {
  return [...new Set(
    state.eventsData
      .map((row) => String(row.CalendarName || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

export function isTravelEvent(row) {
  const explicitType = String(row.EventType || "").trim().toLowerCase();
  if (explicitType === "travel") return true;
  if (explicitType === "job") return false;

  const titleText = `${row.ClientName || ""} ${row.JobSequence || ""}`.toLowerCase();
  return /\b(pickup|dropoff|travel)\b/.test(titleText);
}

export function isJobEvent(row) {
  return !isTravelEvent(row);
}

export function initializeCalendarSelection() {
  const calendars = getUniqueCalendars();

  if (state.selectedCalendars.size === 0) {
    calendars.forEach((name) => state.selectedCalendars.add(name));
    return;
  }

  const validCalendars = new Set(calendars);
  state.selectedCalendars = new Set(
    [...state.selectedCalendars].filter((name) => validCalendars.has(name))
  );

  if (state.selectedCalendars.size === 0) {
    calendars.forEach((name) => state.selectedCalendars.add(name));
  }
}

export function getBaseFilteredEvents() {
  const searchInput = document.getElementById("search");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  const searchValue = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const startDateValue = startDateInput ? startDateInput.value : "";
  const endDateValue = endDateInput ? endDateInput.value : "";

  return state.eventsData.filter((row) => {
    const matchesSearch = !searchValue || JSON.stringify(row).toLowerCase().includes(searchValue);
    const rowDate = row.Date || "";

    const matchesStartDate = !startDateValue || (rowDate && rowDate >= startDateValue);
    const matchesEndDate = !endDateValue || (rowDate && rowDate <= endDateValue);

    const matchesCalendar =
      state.selectedCalendars.size === 0
        ? true
        : state.selectedCalendars.has(String(row.CalendarName || "").trim());

    return matchesSearch && matchesStartDate && matchesEndDate && matchesCalendar;
  });
}

export function getFilteredRowsByTab() {
  const base = getBaseFilteredEvents();

  if (state.currentTab === "jobs") return base.filter(isJobEvent);
  if (state.currentTab === "travel") return base.filter(isTravelEvent);

  return base;
}

export function getFilteredWorkers() {
  const workerSearch = document.getElementById("workerSearch");
  const workerActiveFilter = document.getElementById("workerActiveFilter");

  const searchValue = workerSearch ? workerSearch.value.toLowerCase().trim() : "";
  const activeValue = workerActiveFilter ? workerActiveFilter.value : "";

  return state.workers.filter((worker) => {
    const searchableText = JSON.stringify(worker).toLowerCase();
    const matchesSearch = !searchValue || searchableText.includes(searchValue);
    const isActive = String(worker.Active || "").toLowerCase().includes("active") || String(worker.Active || "").toLowerCase() === "true";

    const matchesActive =
      !activeValue ||
      (activeValue === "active" && isActive) ||
      (activeValue === "inactive" && !isActive);

    return matchesSearch && matchesActive;
  });
}