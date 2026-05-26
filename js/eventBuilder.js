import { state } from "./state.js";
import { escapeHtml } from "./utils.js";

const DEFAULTS = {
  clientName: "[CLIENT NAME]",
  status: "SCHEDULED",
  address: "[FULL ADDRESS]",

  company: "EHC",
  zone: "[ZONE]",
  frequency: "[weekly/bi-weekly/monthly/etc]",
  assignedTime: "0h 00m",
  authorizedTimeAdjustment: "+0m",
  requestedArrival: "0:00am",
  arrivalTime: "[from calendar start time]",
  workyardTime: "0m",

  givenPrice: "0",
  additionalExpense: "0",
  rateType: "Flat",
  tip: "0",
  paymentType: "[none]",
  cc: "[none]",
  paidAmount: "0",
  financeNotes: "[none]",

  accountManager: "[unassigned]",
  commission: "0",

  serviceType: "residential cleaning",
  entrance: "[none]",
  materialInfo: "standard supplies",
  instructions: "[none]",
  otherInfo: "[none]",
  phone: "[none]",
  qcNotes: "[none]",

  estimate: "[none]",
  contract: "[none]",
  invoice: "[none]",
  photos: "[none]"
};

function ensureEventBuilderDefaults() {
  if (!state.eventBuilder) {
    state.eventBuilder = {
      eventType: "job",

      fields: { ...DEFAULTS },

      workers: [
        {
          workerId: "",
          workerName: "",
          payType: "hourly",
          rate: "0.00",
          adjustment: "0"
        },

        {
          workerId: "",
          workerName: "",
          payType: "flat",
          rate: "0.00",
          adjustment: "0"
        }
      ],

      titleText: "",
      notesText: "",
      copyMessage: ""
    };
  }

  if (!state.eventBuilder.eventType) {
    state.eventBuilder.eventType = "job";
  }

  if (!state.eventBuilder.fields) {
    state.eventBuilder.fields = { ...DEFAULTS };
  }

  if (!state.eventBuilder.workers) {
    state.eventBuilder.workers = [];
  }
}

function clean(value) {
  return String(value ?? "").trim();
}

function valueOrDefault(value, fallback) {
  const text = clean(value);
  return text || fallback;
}

function getAllWorkers() {
  return Array.isArray(state.workers) ? state.workers : [];
}

function findWorkerById(workerId) {
  const search = clean(workerId).toLowerCase();

  return getAllWorkers().find((worker) => {
    const id =
      clean(worker.WorkerID || worker.workerId || worker.ID).toLowerCase();

    return id === search;
  });
}

function findWorkerByName(workerName) {
  const search = clean(workerName).toLowerCase();

  return getAllWorkers().find((worker) => {
    const name =
      clean(worker.WorkerName || worker.workerName || worker.Name).toLowerCase();

    return name === search;
  });
}

export function setEventBuilderField(key, value) {
  ensureEventBuilderDefaults();
  state.eventBuilder.fields[key] = value;
  state.eventBuilder.copyMessage = "";
  generateEventBuilderOutput();
}

export function setEventBuilderEventType(value) {
  ensureEventBuilderDefaults();

  state.eventBuilder.eventType = value;

  generateEventBuilderOutput();
}

export function setEventBuilderWorker(index, key, value) {
  ensureEventBuilderDefaults();

  const worker = state.eventBuilder.workers[index];
  if (!worker) return;

  worker[key] = value;

  delete worker.idNotFound;
  delete worker.nameNotFound;

  if (key === "workerId") {
    const matched = findWorkerById(value);

    if (matched) {
      worker.workerName =
        matched.WorkerName ||
        matched.workerName ||
        matched.Name ||
        "";
    } else if (clean(value)) {
      worker.idNotFound = true;
    }
  }

  if (key === "workerName") {
    const matched = findWorkerByName(value);

    if (matched) {
      worker.workerId =
        matched.WorkerID ||
        matched.workerId ||
        matched.ID ||
        "";
    } else if (clean(value)) {
      worker.nameNotFound = true;
    }
  }

  state.eventBuilder.copyMessage = "";
  generateEventBuilderOutput();
}

export function addEventBuilderWorker() {
  ensureEventBuilderDefaults();
  state.eventBuilder.workers.push({
    workerId: "",
    workerName: "",
    payType: "hourly",
    rate: "0.00",
    adjustment: "0"
  });
  generateEventBuilderOutput();
}

export function removeEventBuilderWorker(index) {
  ensureEventBuilderDefaults();
  state.eventBuilder.workers.splice(index, 1);
  generateEventBuilderOutput();
}

function buildTitle() {
  const f = state.eventBuilder.fields;
  return `${valueOrDefault(f.clientName, "[CLIENT NAME]")} | ${valueOrDefault(f.status, "SCHEDULED")}`;
}

function buildWorkerLines() {
  ensureEventBuilderDefaults();

  if (!state.eventBuilder.workers.length) {
    return "1 | [WORKER_ID] | [WORKER_NAME] | hourly | 0.00 | 0";
  }

  return state.eventBuilder.workers.map((worker, index) => {
    return [
      index + 1,
      valueOrDefault(worker.workerId, "[WORKER_ID]"),
      valueOrDefault(worker.workerName, "[WORKER_NAME]"),
      valueOrDefault(worker.payType, "hourly"),
      valueOrDefault(worker.rate, "0.00"),
      valueOrDefault(worker.adjustment, "0")
    ].join(" | ");
  }).join("\n");
}

function buildNotes() {
  const f = state.eventBuilder.fields;

  return `CLIENT SECTION
| CLIENT: ${valueOrDefault(f.clientName, "[CLIENT NAME]")} |
| STATUS: ${valueOrDefault(f.status, "SCHEDULED")} |
| ADDRESS: ${valueOrDefault(f.address, "[FULL ADDRESS]")} |

SCHEDULING SECTION
| COMPANY: ${valueOrDefault(f.company, "EHC")} |
| ZONE: ${valueOrDefault(f.zone, "[ZONE]")} |
| FREQUENCY: ${valueOrDefault(f.frequency, "[weekly/bi-weekly/monthly/etc]")} |
| ASSIGNED TIME: ${valueOrDefault(f.assignedTime, "0h 00m")} |
| AUTHORIZED TIME ADJUSTMENT: ${valueOrDefault(f.authorizedTimeAdjustment, "+0m")} |
| REQUESTED TIME: ${valueOrDefault(f.requestedArrival, "0:00am")} |
| ARRIVAL TIME: ${valueOrDefault(f.arrivalTime, "[from calendar start time]")} |
| WORKYARD TIME: ${valueOrDefault(f.workyardTime, "0m")} |

FINANCE SECTION
| GIVEN PRICE: ${valueOrDefault(f.givenPrice, "0")} |
| ADDITIONAL EXPENSE: ${valueOrDefault(f.additionalExpense, "0")} |
| RATE TYPE: ${valueOrDefault(f.rateType, "Flat")} |
| TIP: ${valueOrDefault(f.tip, "0")} |
| PAYMENT TYPE: ${valueOrDefault(f.paymentType, "[none]")} |
| CC: ${valueOrDefault(f.cc, "[none]")} |
| PAID AMOUNT: ${valueOrDefault(f.paidAmount, "0")} |
| FINANCE NOTES: ${valueOrDefault(f.financeNotes, "[none]")} |

SALES SECTION
| ACCOUNT MANAGER: ${valueOrDefault(f.accountManager, "[unassigned]")} |
| COMMISSION: ${valueOrDefault(f.commission, "0")} |

QUALITY CONTROL SECTION
| SERVICE TYPE: ${valueOrDefault(f.serviceType, "residential cleaning")} |
| ENTRANCE: ${valueOrDefault(f.entrance, "[none]")} |
| MATERIAL INFO: ${valueOrDefault(f.materialInfo, "standard supplies")} |
| INSTRUCTIONS: ${valueOrDefault(f.instructions, "[none]")} |
| OTHER INFO: ${valueOrDefault(f.otherInfo, "[none]")} |
| PHONE: ${valueOrDefault(f.phone, "[none]")} |
| QC NOTES: ${valueOrDefault(f.qcNotes, "[none]")} |

WORKER SECTION
${buildWorkerLines()}

LINKS SECTION
| ESTIMATE: ${valueOrDefault(f.estimate, "[none]")} |
| CONTRACT: ${valueOrDefault(f.contract, "[none]")} |
| INVOICE: ${valueOrDefault(f.invoice, "[none]")} |
| PHOTOS: ${valueOrDefault(f.photos, "[none]")} |`;
}

export function generateEventBuilderOutput() {
  ensureEventBuilderDefaults();
  state.eventBuilder.titleText = buildTitle();
  state.eventBuilder.notesText = buildNotes();
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    state.eventBuilder.copyMessage = `${label} copied.`;
  } catch (_) {
    state.eventBuilder.copyMessage = `Could not copy ${label}.`;
  }
}

export async function copyEventBuilderTitle() {
  generateEventBuilderOutput();
  await copyText(state.eventBuilder.titleText, "Title");
}

export async function copyEventBuilderNotes() {
  generateEventBuilderOutput();
  await copyText(state.eventBuilder.notesText, "Notes");
}

export async function copyEventBuilderBoth() {
  generateEventBuilderOutput();
  await copyText(`TITLE:\n${state.eventBuilder.titleText}\n\nNOTES:\n${state.eventBuilder.notesText}`, "Title and notes");
}

function renderInput(key, label, type = "text") {
  const value = state.eventBuilder.fields[key] || "";

  return `
    <div>
      <div class="stat-label">${escapeHtml(label)}</div>
      <input
        type="${escapeHtml(type)}"
        class="column-filter-input"
        value="${escapeHtml(value)}"
        oninput="window.setEventBuilderFieldAndRender('${escapeHtml(key)}', this.value)"
      />
    </div>
  `;
}

function renderTextarea(key, label) {
  const value = state.eventBuilder.fields[key] || "";

  return `
    <div>
      <div class="stat-label">${escapeHtml(label)}</div>
      <textarea
        class="toolbar-textarea"
        oninput="window.setEventBuilderFieldAndRender('${escapeHtml(key)}', this.value)"
      >${escapeHtml(value)}</textarea>
    </div>
  `;
}

function renderSelect(key, label, options) {
  const value = state.eventBuilder.fields[key] || "";

  return `
    <div>
      <div class="stat-label">${escapeHtml(label)}</div>
      <select
        class="column-filter-select"
        onchange="window.setEventBuilderFieldAndRender('${escapeHtml(key)}', this.value)"
      >
        ${options.map((option) => `
          <option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>
            ${escapeHtml(option)}
          </option>
        `).join("")}
      </select>
    </div>
  `;
}

function renderWorkerRow(worker, index) {
  return `
    <div class="detail-section-card">
      <div class="flex items-center justify-between gap-3 mb-3">
        <h4 class="font-semibold">Worker ${index + 1}</h4>

        <button
          class="secondary-btn"
          type="button"
          onclick="window.removeEventBuilderWorkerAndRender(${index})"
        >
          Remove
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">

        <div>
          <input
  id="eventBuilderWorkerId_${index}"
  list="eventBuilderWorkerIds"
  class="column-filter-input"
  value="${escapeHtml(worker.workerId || "")}"
  placeholder="Worker ID"
  oninput="window.setEventBuilderWorkerAndRender(${index}, 'workerId', this.value); document.getElementById('eventBuilderWorkerName_${index}').value = window.getEventBuilderWorkerName(${index});
document.getElementById('eventBuilderWorkerIdWarning_${index}').style.display =
  window.getEventBuilderWorkerIdNotFound(${index}) ? 'block' : 'none';"
/>

          <div
  id="eventBuilderWorkerIdWarning_${index}"
  class="text-xs text-red-500 mt-1"
  style="${worker.idNotFound ? "" : "display:none;"}"
>
  ID not found
</div>
        </div>

        <div>
          <input
  id="eventBuilderWorkerName_${index}"
  list="eventBuilderWorkerNames"
  class="column-filter-input"
  value="${escapeHtml(worker.workerName || "")}"
  placeholder="Worker Name"
  oninput="window.setEventBuilderWorkerAndRender(${index}, 'workerName', this.value); document.getElementById('eventBuilderWorkerId_${index}').value = window.getEventBuilderWorkerId(${index});
document.getElementById('eventBuilderWorkerNameWarning_${index}').style.display =
  window.getEventBuilderWorkerNameNotFound(${index}) ? 'block' : 'none';"
/>

          <div
  id="eventBuilderWorkerNameWarning_${index}"
  class="text-xs text-red-500 mt-1"
  style="${worker.nameNotFound ? "" : "display:none;"}"
>
  Name not found
</div>
        </div>

        <select
          class="column-filter-select"
          onchange="window.setEventBuilderWorkerAndRender(${index}, 'payType', this.value)"
        >
          <option value="hourly" ${worker.payType === "hourly" ? "selected" : ""}>
            hourly
          </option>

          <option value="flat" ${worker.payType === "flat" ? "selected" : ""}>
            flat
          </option>
        </select>

        <input
          class="column-filter-input"
          value="${escapeHtml(worker.rate || "")}"
          placeholder="Rate / Flat"
          oninput="window.setEventBuilderWorkerAndRender(${index}, 'rate', this.value)"
        />

        <input
          class="column-filter-input"
          value="${escapeHtml(worker.adjustment || "")}"
          placeholder="Adjustment"
          oninput="window.setEventBuilderWorkerAndRender(${index}, 'adjustment', this.value)"
        />
      </div>
    </div>
  `;
}

export function renderEventBuilderTab() {
  const content = document.getElementById("content");
  if (!content) return;

  ensureEventBuilderDefaults();
  generateEventBuilderOutput();

const workers = getAllWorkers();

const workerIdOptions = workers.map((worker) => {
  const id = worker.WorkerID || worker.workerId || worker.ID || "";
  return `<option value="${escapeHtml(id)}"></option>`;
}).join("");

const workerNameOptions = workers.map((worker) => {
  const name = worker.WorkerName || worker.workerName || worker.Name || "";
  return `<option value="${escapeHtml(name)}"></option>`;
}).join("");



  content.innerHTML = `
  <div class="space-y-6">

    <datalist id="eventBuilderWorkerIds">
      ${workerIdOptions}
    </datalist>

    <datalist id="eventBuilderWorkerNames">
      ${workerNameOptions}
    </datalist>

    <div class="panel">

  <div class="panel-header">
    <h2 class="text-2xl font-semibold">Event Builder</h2>

    <p class="text-sm text-slate-500">
      Fill in the fields below and copy/paste the generated title and notes into Google Calendar.
    </p>
  </div>

  <div class="panel-body space-y-6">

  <div class="detail-section-card">
    <div class="detail-section-title">
      Event Type
    </div>

    <select
      class="toolbar-select"
      onchange="window.setEventBuilderEventType(this.value)"
    >
      <option value="job"
        ${state.eventBuilder.eventType === "job" ? "selected" : ""}
      >
        Job
      </option>

      <option value="pickupDropoff"
        ${state.eventBuilder.eventType === "pickupDropoff" ? "selected" : ""}
      >
        Pick-up / Drop-off
      </option>

      <option value="travelLog"
        ${state.eventBuilder.eventType === "travelLog" ? "selected" : ""}
      >
        Travel Log
      </option>
    </select>
  </div>
          ${state.eventBuilder.copyMessage ? `<div class="success-box">${escapeHtml(state.eventBuilder.copyMessage)}</div>` : ""}

          <div class="detail-section-card">
            <h3 class="detail-section-title">Client / Title</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              ${renderInput("clientName", "Client Name")}
              ${renderSelect("status", "Status", ["SCHEDULED", "CANCELED", "CHARGED", "PAID", "DEPOSIT", "LATE CANCELLATION FEE", "INVOICE"])}
              ${renderInput("address", "Address")}
            </div>
          </div>

          <div class="detail-section-card">
            <h3 class="detail-section-title">Scheduling</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              ${renderSelect("company", "Company", ["EHC", "PC", "EHP", "EMS"])}
              ${renderInput("zone", "Zone")}
              ${renderInput("frequency", "Frequency")}
              ${renderInput("assignedTime", "Assigned Time")}
              ${renderInput("authorizedTimeAdjustment", "Authorized Time Adjustment")}
              ${renderInput("requestedArrival", "Requested Time")}
              ${renderInput("arrivalTime", "Arrival Time")}
              ${renderInput("workyardTime", "Workyard Time")}
            </div>
          </div>

          <div class="detail-section-card">
            <h3 class="detail-section-title">Finance</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              ${renderInput("givenPrice", "Given Price")}
              ${renderInput("additionalExpense", "Additional Expense")}
              ${renderSelect("rateType", "Rate Type", ["Flat", "Hourly"])}
              ${renderInput("tip", "Tip")}
              ${renderInput("paymentType", "Payment Type")}
              ${renderInput("cc", "CC")}
              ${renderInput("paidAmount", "Paid Amount")}
              ${renderInput("financeNotes", "Finance Notes")}
            </div>
          </div>

          <div class="detail-section-card">
            <h3 class="detail-section-title">Sales</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${renderInput("accountManager", "Account Manager")}
              ${renderInput("commission", "Commission")}
            </div>
          </div>

          <div class="detail-section-card">
            <h3 class="detail-section-title">Quality Control</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${renderInput("serviceType", "Service Type")}
              ${renderInput("entrance", "Entrance")}
              ${renderTextarea("materialInfo", "Material Info")}
              ${renderTextarea("instructions", "Instructions")}
              ${renderTextarea("otherInfo", "Other Info")}
              ${renderInput("phone", "Phone")}
              ${renderTextarea("qcNotes", "QC Notes")}
            </div>
          </div>

          <div class="detail-section-card">
            <div class="flex items-center justify-between mb-4">
              <h3 class="detail-section-title mb-0">Workers</h3>
              <button class="secondary-btn" type="button" onclick="window.addEventBuilderWorkerAndRender()">
                Add Worker
              </button>
            </div>

            <div class="space-y-4">
              ${state.eventBuilder.workers.map(renderWorkerRow).join("")}
            </div>
          </div>

          <div class="detail-section-card">
            <h3 class="detail-section-title">Links</h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              ${renderInput("estimate", "Estimate")}
              ${renderInput("contract", "Contract")}
              ${renderInput("invoice", "Invoice")}
              ${renderInput("photos", "Photos")}
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 class="text-xl font-semibold">Generated Calendar Content</h3>
              <p class="text-sm text-slate-500">Copy these into Google Calendar.</p>
            </div>

            <div class="flex gap-2 flex-wrap">
              <button class="secondary-btn" type="button" onclick="window.copyEventBuilderTitleAndRender()">Copy Title</button>
              <button class="secondary-btn" type="button" onclick="window.copyEventBuilderNotesAndRender()">Copy Notes</button>
              <button class="primary-btn" type="button" onclick="window.copyEventBuilderBothAndRender()">Copy Both</button>
            </div>
          </div>
        </div>

        <div class="panel-body space-y-4">
          <div>
            <div class="stat-label">Title</div>
            <textarea class="toolbar-textarea" readonly>${escapeHtml(state.eventBuilder.titleText)}</textarea>
          </div>

          <div>
            <div class="stat-label">Notes</div>
            <textarea class="toolbar-textarea" style="min-height:520px;" readonly>${escapeHtml(state.eventBuilder.notesText)}</textarea>
          </div>
        </div>
      </div>
    </div>
  `;
}