import { state } from "./state.js";
import { escapeHtml, toNumber } from "./utils.js";

function formatCurrency(value) {
  const n = Number(value || 0);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

function cleanText(value) {
  return String(value || "").trim();
}

function getFinanceRows() {
  return (state.eventsData || []).map((row) => {
    const givenPrice = toNumber(row.GivenPrice) || 0;
    const additionalExpense = toNumber(row.AdditionalExpense) || 0;
    const tip = toNumber(row.Tip) || 0;
    const paidAmount = toNumber(row.PaidAmount) || 0;

    const totalCharge = givenPrice + additionalExpense + tip;
    const balanceDue = totalCharge - paidAmount;

    return {
      date: cleanText(row.Date),
      calendarName: cleanText(row.CalendarName),
      clientName: cleanText(row.ClientName),
      company: cleanText(row.Company),
      status: cleanText(row.Status),
      givenPrice,
      additionalExpense,
      tip,
      totalCharge,
      paidAmount,
      balanceDue,
      paymentType: cleanText(row.PaymentType),
      payStatus: cleanText(row.PayStatus),
      financeNotes: cleanText(row.FinanceNotes),
      eventId: cleanText(row.EventId)
    };
  });
}

function getFinanceFilterValue(key) {
  return state.finance?.filters?.[key] || "";
}

export function setFinanceFilter(key, value) {
  if (!state.finance) {
    state.finance = { filters: {} };
  }

  if (!state.finance.filters) {
    state.finance.filters = {};
  }

  state.finance.filters[key] = value;
}

export function clearFinanceFilters() {
  if (!state.finance) {
    state.finance = { filters: {} };
  }

  state.finance.filters = {};
}

function matchesFinanceFilters(row) {
  const search = getFinanceFilterValue("search").toLowerCase();
  const startDate = getFinanceFilterValue("startDate");
  const endDate = getFinanceFilterValue("endDate");
  const company = getFinanceFilterValue("company");
  const calendarName = getFinanceFilterValue("calendarName");
  const payStatus = getFinanceFilterValue("payStatus");
  const paymentType = getFinanceFilterValue("paymentType");
  const balanceOnly = getFinanceFilterValue("balanceOnly");

  const searchableText = [
    row.clientName,
    row.calendarName,
    row.company,
    row.status,
    row.paymentType,
    row.payStatus,
    row.financeNotes,
    row.eventId
  ].join(" ").toLowerCase();

  if (search && !searchableText.includes(search)) return false;
  if (startDate && row.date < startDate) return false;
  if (endDate && row.date > endDate) return false;
  if (company && row.company !== company) return false;
  if (calendarName && row.calendarName !== calendarName) return false;
  if (payStatus && row.payStatus !== payStatus) return false;
  if (paymentType && row.paymentType !== paymentType) return false;
  if (balanceOnly === "yes" && row.balanceDue <= 0) return false;

  return true;
}

function getFilteredFinanceRows() {
  return getFinanceRows().filter(matchesFinanceFilters);
}

function getUniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function getFinanceSummary(rows) {
  return rows.reduce((acc, row) => {
    acc.totalCharges += row.totalCharge;
    acc.totalPaid += row.paidAmount;
    acc.totalBalance += row.balanceDue > 0 ? row.balanceDue : 0;

    if (row.balanceDue > 0) {
      acc.unpaidCount += 1;
    }

    if (!row.payStatus) {
      acc.noPayStatusCount += 1;
    }

    return acc;
  }, {
    totalCharges: 0,
    totalPaid: 0,
    totalBalance: 0,
    unpaidCount: 0,
    noPayStatusCount: 0
  });
}

function renderFinanceFilterInput(key, placeholder, type = "text") {
  return `
    <input
      type="${escapeHtml(type)}"
      class="column-filter-input"
      placeholder="${escapeHtml(placeholder)}"
      value="${escapeHtml(getFinanceFilterValue(key))}"
      onchange="window.setFinanceFilterAndRender('${escapeHtml(key)}', this.value)"
    />
  `;
}

function renderFinanceFilterSelect(key, options, label = "All") {
  const value = getFinanceFilterValue(key);

  return `
    <select
      class="column-filter-select"
      onchange="window.setFinanceFilterAndRender('${escapeHtml(key)}', this.value)"
    >
      <option value="">${escapeHtml(label)}</option>
      ${options.map((option) => `
        <option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>
          ${escapeHtml(option)}
        </option>
      `).join("")}
    </select>
  `;
}

function getBalanceBadge(row) {
  if (row.balanceDue > 0) {
    return `<span class="badge badge-danger">${formatCurrency(row.balanceDue)}</span>`;
  }

  if (row.totalCharge > 0 && row.balanceDue <= 0) {
    return `<span class="badge badge-success">$0.00</span>`;
  }

  return `<span class="badge badge-neutral">$0.00</span>`;
}

function renderFinanceTable(rows) {
  return `
    <div class="detail-section-card">
      <div class="table-scroll-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Calendar</th>
              <th>Client</th>
              <th>Company</th>
              <th>Status</th>
              <th>Given Price</th>
              <th>Additional Expense</th>
              <th>Tip</th>
              <th>Total Charge</th>
              <th>Paid Amount</th>
              <th>Balance Due</th>
              <th>Payment Type</th>
              <th>Pay Status</th>
              <th>Finance Notes</th>
              <th>Event ID</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.date)}</td>
                    <td>${escapeHtml(row.calendarName)}</td>
                    <td>${escapeHtml(row.clientName)}</td>
                    <td>${escapeHtml(row.company)}</td>
                    <td>${escapeHtml(row.status)}</td>
                    <td>${formatCurrency(row.givenPrice)}</td>
                    <td>${formatCurrency(row.additionalExpense)}</td>
                    <td>${formatCurrency(row.tip)}</td>
                    <td>${formatCurrency(row.totalCharge)}</td>
                    <td>${formatCurrency(row.paidAmount)}</td>
                    <td>${getBalanceBadge(row)}</td>
                    <td>${escapeHtml(row.paymentType)}</td>
                    <td>${escapeHtml(row.payStatus)}</td>
                    <td>${escapeHtml(row.financeNotes)}</td>
                    <td>${escapeHtml(row.eventId)}</td>
                  </tr>
                `).join("")
                : `<tr><td colspan="15" class="text-center text-slate-500">No finance rows found.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderFinanceTab() {
  const content = document.getElementById("content");
  if (!content) return;

  const allRows = getFinanceRows();
  const filteredRows = getFilteredFinanceRows();
  const summary = getFinanceSummary(filteredRows);

  const companies = getUniqueValues(allRows, "company");
  const calendars = getUniqueValues(allRows, "calendarName");
  const payStatuses = getUniqueValues(allRows, "payStatus");
  const paymentTypes = getUniqueValues(allRows, "paymentType");

  content.innerHTML = `
    <div class="space-y-6">
      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 class="text-2xl font-semibold">Finance</h2>
              <p class="text-sm text-slate-500">
                Track charges, payments, unpaid balances, payment types, and finance notes.
              </p>
            </div>

            <button class="secondary-btn" type="button" onclick="window.clearFinanceFiltersAndRender()">
              Clear Finance Filters
            </button>
          </div>
        </div>

        <div class="panel-body space-y-5">
          <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div class="stat-card">
              <div class="stat-label">Total Charges</div>
              <div class="stat-value">${formatCurrency(summary.totalCharges)}</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Total Paid</div>
              <div class="stat-value">${formatCurrency(summary.totalPaid)}</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Balance Due</div>
              <div class="stat-value">${formatCurrency(summary.totalBalance)}</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">Unpaid Jobs</div>
              <div class="stat-value">${summary.unpaidCount}</div>
            </div>

            <div class="stat-card">
              <div class="stat-label">No Pay Status</div>
              <div class="stat-value">${summary.noPayStatusCount}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-4">
            ${renderFinanceFilterInput("search", "Search client, notes, event...")}
            ${renderFinanceFilterInput("startDate", "Start date", "date")}
            ${renderFinanceFilterInput("endDate", "End date", "date")}
            ${renderFinanceFilterSelect("company", companies, "All Companies")}
            ${renderFinanceFilterSelect("calendarName", calendars, "All Calendars")}
            ${renderFinanceFilterSelect("payStatus", payStatuses, "All Pay Statuses")}
            ${renderFinanceFilterSelect("paymentType", paymentTypes, "All Payment Types")}

            <select
              class="column-filter-select"
              onchange="window.setFinanceFilterAndRender('balanceOnly', this.value)"
            >
              <option value="">All Balances</option>
              <option value="yes" ${getFinanceFilterValue("balanceOnly") === "yes" ? "selected" : ""}>
                Balance Due Only
              </option>
            </select>
          </div>

          <div class="text-sm text-slate-500">
            Showing <strong>${filteredRows.length}</strong> of <strong>${allRows.length}</strong> finance rows.
          </div>
        </div>
      </div>

      ${renderFinanceTable(filteredRows)}
    </div>
  `;
}