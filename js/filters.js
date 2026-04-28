import { state } from "./state.js";
import { normalizeActiveValue } from "./utils.js";

export function getUniqueCalendars() {
  return [...new Set(
    state.eventsData
      .map((row) => String(row.CalendarName || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

export function getUniqueColumnValues(rows, key) {
  return [...new Set(
    rows.map((row) => String(row[key] || "").trim())
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

    return matchesSearch && matchesStartDate && matchesEndDate;
  });
}

function matchesSingleFilter(rowValueRaw, filterValueRaw) {
  const filterValue = String(filterValueRaw ?? "").trim();
  if (!filterValue) return true;

  const rowValue = String(rowValueRaw ?? "").trim();

  if (filterValue === "__BLANK__") {
    return rowValue === "";
  }

  if (filterValue === "__NONBLANK__") {
    return rowValue !== "";
  }

  return rowValue.toLowerCase().includes(filterValue.toLowerCase());
}

function matchesColumnFilters(row, filters) {
  const entries = Object.entries(filters || {}).filter(([, value]) => String(value ?? "").trim() !== "");
  if (!entries.length) return true;

  return entries.every(([key, filterValue]) => {
    if (key === "DriveTime") {
      const driveMinutes = String(row.DisplayDuration || "");
      return matchesSingleFilter(driveMinutes, filterValue);
    }

    if (key === "Alert") {
      const titleText = `${row.ClientName || ""} ${row.JobSequence || ""}`;
      return matchesSingleFilter(titleText, filterValue);
    }

    return matchesSingleFilter(row[key], filterValue);
  });
}

export function getFilteredRowsByTab() {
  const base = getBaseFilteredEvents();
  let rows = base;

  if (state.currentTab === "jobs") rows = base.filter(isJobEvent);
  else if (state.currentTab === "travel") rows = base.filter(isTravelEvent);

  const tabFilters = state.columnFilters[state.currentTab] || {};
  return rows.filter((row) => matchesColumnFilters(row, tabFilters));
}

export function getFilteredWorkers() {
  const workerSearch = document.getElementById("workerSearch");
  const workerActiveFilter = document.getElementById("workerActiveFilter");

  const searchValue = workerSearch ? workerSearch.value.toLowerCase().trim() : "";
  const activeValue = workerActiveFilter ? workerActiveFilter.value : "";

  const base = state.workers.filter((worker) => {
    const searchableText = JSON.stringify(worker).toLowerCase();
    const matchesSearch = !searchValue || searchableText.includes(searchValue);
    const isActive = normalizeActiveValue(worker.Active);

    const matchesActive =
      !activeValue ||
      (activeValue === "active" && isActive) ||
      (activeValue === "inactive" && !isActive);

    return matchesSearch && matchesActive;
  });

  const workerFilters = state.columnFilters.workers || {};
  return base.filter((worker) => matchesColumnFilters(worker, workerFilters));
}
