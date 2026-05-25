const API_URL = "https://script.google.com/macros/s/AKfycbwz401Ii47fb86kB-eo93tirJmGpbHFS2jEonIn6yuFjNqu5rxjQiPvUTOzDkvAvoPR/exec";
let portalWorkers = [];
let currentWorker = null;
let selectedScheduleDate = new Date();

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForApi(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date) {
  const today = getTodayDateString();
  const selected = formatDateForApi(date);

  if (selected === today) return "Today";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function updateDateControls() {
  const label = document.getElementById("scheduleDateLabel");
  if (label) label.innerText = formatDateLabel(selectedScheduleDate);
}




async function fetchApi(params) {
  const url = new URL(API_URL);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  return response.json();
}

function setMessage(message, type = "error") {
  const el = document.getElementById("loginMessage");
  if (!el) return;

  el.innerText = message || "";
  el.className =
    type === "success"
      ? "mt-4 text-sm text-green-600"
      : "mt-4 text-sm text-red-500";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function getClockStatusBadgeClass(clockStatus) {
  const status = String(clockStatus || "").toLowerCase();

  if (status === "clocked in") {
    return "bg-green-100 text-green-700";
  }

  if (status === "completed") {
    return "bg-blue-100 text-blue-700";
  }

  return "bg-gray-200 text-gray-700";
}

function formatJobPayout(job) {
  const rate = Number(job.rate || 0);
  const assignedDecimal = Number(job.assignedTimeDecimal || 0);
  const payType = String(job.rateType || "").toLowerCase();

  if (!rate) return "-";

  if (payType.includes("flat")) {
    return `$${rate.toFixed(0)}`;
  }

  if (assignedDecimal) {
    return `~$${(rate * assignedDecimal).toFixed(0)}`;
  }

  return `~$${rate.toFixed(0)}`;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `$${amount.toFixed(2)}`;
}


async function loadWorkerBalance() {
  if (!currentWorker) return;

  const dailyEl = document.getElementById("dailyBalanceDisplay");
  const weeklyEl = document.getElementById("weeklyBalanceDisplay");

  if (dailyEl) dailyEl.innerText = "Loading...";
  if (weeklyEl) weeklyEl.innerText = "Loading...";

  try {
    const result = await fetchApi({
  action: "getWorkerBalance",
  workerId: currentWorker.workerId,
  date: formatDateForApi(selectedScheduleDate)
});

console.log("BALANCE RESULT:", result);
console.log("BALANCE DATE:", formatDateForApi(selectedScheduleDate));
console.log("BALANCE WORKER:", currentWorker.workerId);

    if (!result.success) {
      throw new Error(result.error || "Could not load balance.");
    }

    if (dailyEl) dailyEl.innerText = formatMoney(result.dailyBalance);
    if (weeklyEl) weeklyEl.innerText = formatMoney(result.weeklyBalance);
  } catch (error) {
    if (dailyEl) dailyEl.innerText = "$0.00";
    if (weeklyEl) weeklyEl.innerText = "$0.00";
    console.error(error);
  }
}


async function loadPortalWorkers() {
  const workerSelect = document.getElementById("workerSelect");
  if (!workerSelect) return;

  workerSelect.innerHTML = `<option value="">Loading workers...</option>`;

  try {
    const result = await fetchApi({
      action: "getPortalWorkers"
    });

    if (!result.success) {
      throw new Error(result.error || "Could not load workers.");
    }

    portalWorkers = result.data || [];

    workerSelect.innerHTML = `
      <option value="">Select Worker</option>
      ${portalWorkers
        .map(
          (worker) => `
            <option value="${escapeHtml(worker.workerId)}">
              ${escapeHtml(worker.workerName)} — ${escapeHtml(worker.workerId)}
            </option>
          `
        )
        .join("")}
    `;
  } catch (error) {
    workerSelect.innerHTML = `<option value="">Could not load workers</option>`;
    setMessage(error.message || "Could not load workers.");
  }
}

async function loadWorkerSchedule() {
  if (!currentWorker) return;

  updateDateControls();
  await loadWorkerBalance();

  const jobsContainer = document.getElementById("jobsContainer");
  if (!jobsContainer) return;

  jobsContainer.innerHTML = `
    <div class="text-gray-500">
      Loading schedule...
    </div>
  `;

  try {
    const result = await fetchApi({
      action: "getWorkerSchedule",
      workerId: currentWorker.workerId,
      date: formatDateForApi(selectedScheduleDate)
    });

    if (!result.success) {
      throw new Error(result.error || "Could not load schedule.");
    }

    const jobs = result.jobs || [];

    if (jobs.length === 0) {
      jobsContainer.innerHTML = `
        <div class="job-card text-gray-500">
          No jobs found for this day.
        </div>
      `;
      return;
    }

    jobs.sort((a, b) => {
      const timeA = a.requestedTime24 || "";
      const timeB = b.requestedTime24 || "";
      return timeA.localeCompare(timeB);
    });

    jobsContainer.innerHTML = jobs
      .map(
        (job) => `
          <div class="job-card">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div>
                <div class="text-sm text-gray-500">
                  ${escapeHtml(job.requestedTime || "No time listed")}
                </div>

                <div class="text-lg font-bold">
                  ${escapeHtml(job.clientName || "Unnamed Job")}
                </div>

                <div class="text-sm text-gray-600 mt-1">
                  ${escapeHtml(job.address || "")}
                </div>
              </div>

              <div class="text-xs rounded-full px-3 py-1 font-semibold ${getClockStatusBadgeClass(job.clockStatus)}">
                ${escapeHtml(job.clockStatus || "Scheduled")}
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 text-sm text-gray-600 mb-4">
              <div>
                <strong>Company:</strong>
                ${escapeHtml(job.company || "-")}
              </div>

              <div>
                <strong>Assigned:</strong>
                ${escapeHtml(job.assignedTime || "-")}
              </div>

              <div>
                <strong>Payout:</strong>
                ${escapeHtml(formatJobPayout(job))}
              </div>  
            </div>

            <button
              class="primary-btn"
              onclick="window.openPortalJob('${escapeHtml(job.jobLink || "")}')"
            >
              Open Job
            </button>
          </div>
        `
      )
      .join("");

  } catch (error) {
    jobsContainer.innerHTML = `
      <div class="job-card text-red-500">
        ${escapeHtml(error.message || "Could not load schedule.")}
      </div>
    `;
  }
}






window.changeScheduleDate = async function (direction) {
  selectedScheduleDate.setDate(selectedScheduleDate.getDate() + direction);
  await loadWorkerSchedule();
};

window.goToTodaySchedule = async function () {
  selectedScheduleDate = new Date();
  await loadWorkerSchedule();
};



window.portalLogin = async function () {
  const workerSelect = document.getElementById("workerSelect");
  const pinInput = document.getElementById("pinInput");

  const workerId = workerSelect ? workerSelect.value : "";
  const pin = pinInput ? pinInput.value : "";

  if (!workerId) {
    setMessage("Please select your worker profile.");
    return;
  }

  if (!pin) {
    setMessage("Please enter your PIN.");
    return;
  }

  setMessage("Logging in...", "success");

  try {
    const result = await fetchApi({
      action: "workerPortalLogin",
      workerId,
      pin
    });

    if (!result.success) {
      throw new Error(result.error || "Login failed.");
    }

    currentWorker = result.worker;

    localStorage.setItem(
      "workerPortalUser",
      JSON.stringify(currentWorker)
    );

    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("scheduleSection").classList.remove("hidden");

    document.getElementById("workerNameDisplay").innerText =
      currentWorker.workerName || currentWorker.workerId;

    await loadWorkerSchedule();
  } catch (error) {
    setMessage(error.message || "Login failed.");
  }
};

window.portalLogout = function () {
  currentWorker = null;
  localStorage.removeItem("workerPortalUser");

  document.getElementById("scheduleSection").classList.add("hidden");
  document.getElementById("loginSection").classList.remove("hidden");

  const pinInput = document.getElementById("pinInput");
  if (pinInput) pinInput.value = "";

  setMessage("");
};

window.openPortalJob = function (jobLink) {
  if (!jobLink) {
    alert("No job link found for this job.");
    return;
  }

  const url = new URL(jobLink);
  url.searchParams.set("workerId", currentWorker.workerId);

  url.searchParams.set("fromPortal", "1");

  window.location.href = url.toString();
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadPortalWorkers();

  const savedUser = localStorage.getItem("workerPortalUser");

  if (savedUser) {
    try {
      currentWorker = JSON.parse(savedUser);

      document.getElementById("loginSection").classList.add("hidden");
      document.getElementById("scheduleSection").classList.remove("hidden");

      document.getElementById("workerNameDisplay").innerText =
        currentWorker.workerName || currentWorker.workerId;

      await loadWorkerSchedule();
    } catch (_) {
      localStorage.removeItem("workerPortalUser");
    }
  }
});
