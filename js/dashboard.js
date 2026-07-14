requireAuth();
renderShell("dashboard", "Dashboard");

const STATUS_DOT_COLOR = {
  PENDING: "var(--status-pending)",
  CONFIRMED: "var(--status-confirmed)",
  ATTENDED: "var(--status-attended)",
  CANCELLED: "var(--status-cancelled)",
};

function mondayOf(d) {
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  const m = new Date(d);
  m.setDate(d.getDate() - day);
  m.setHours(0, 0, 0, 0);
  return m;
}

function buildEarningsCaption(period, refDate) {
  const now = new Date();

  if (period === "WEEKLY") {
    const isCurrent = mondayOf(refDate).getTime() === mondayOf(now).getTime();
    return isCurrent ? "Recaudado esta semana" : "Recaudado la semana seleccionada";
  }

  if (period === "MONTHLY") {
    const isCurrent = refDate.getMonth() === now.getMonth() && refDate.getFullYear() === now.getFullYear();
    if (isCurrent) return "Recaudado este mes";
    const monthName = MONTHS_ES[refDate.getMonth()].toLowerCase();
    const sameYear = refDate.getFullYear() === now.getFullYear();
    return sameYear ? `Recaudado en ${monthName}` : `Recaudado en ${monthName} de ${refDate.getFullYear()}`;
  }

  if (period === "YEARLY") {
    const isCurrent = refDate.getFullYear() === now.getFullYear();
    return isCurrent ? "Recaudado este año" : `Recaudado en el año ${refDate.getFullYear()}`;
  }

  return "Recaudado";
}

let currentPeriod = "WEEKLY";
let referenceDate = new Date(); // ancla usada para calcular a qué semana/mes/año navegar

function shiftReferenceDate(period, direction) {
  const d = new Date(referenceDate);
  if (period === "WEEKLY") d.setDate(d.getDate() + 7 * direction);
  else if (period === "MONTHLY") d.setMonth(d.getMonth() + direction);
  else if (period === "YEARLY") d.setFullYear(d.getFullYear() + direction);
  referenceDate = d;
}

function referenceDateISO() {
  const pad = (n) => String(n).padStart(2, "0");
  return `${referenceDate.getFullYear()}-${pad(referenceDate.getMonth() + 1)}-${pad(referenceDate.getDate())}`;
}

// ---- Selector de Mes / Año (solo se usa cuando el periodo es MONTHLY) ----
const monthSelect = document.getElementById("earningsMonthSelect");
const yearSelect = document.getElementById("earningsYearSelect");

function populateMonthYearPicker() {
  monthSelect.innerHTML = MONTHS_ES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
  const nowYear = new Date().getFullYear();
  const years = [];
  for (let y = nowYear + 1; y >= nowYear - 5; y--) years.push(y);
  yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
}
populateMonthYearPicker();

function syncMonthYearPicker() {
  monthSelect.value = String(referenceDate.getMonth() + 1);
  yearSelect.value = String(referenceDate.getFullYear());
}

monthSelect.addEventListener("change", () => {
  referenceDate = new Date(Number(yearSelect.value), Number(monthSelect.value) - 1, 1);
  loadEarnings();
});
yearSelect.addEventListener("change", () => {
  referenceDate = new Date(Number(yearSelect.value), Number(monthSelect.value) - 1, 1);
  loadEarnings();
});

// ---- Selector de Año (solo se usa cuando el periodo es YEARLY) ----
const yearOnlySelect = document.getElementById("earningsYearOnlySelect");

function populateYearOnlyPicker() {
  const nowYear = new Date().getFullYear();
  const years = [];
  for (let y = nowYear + 1; y >= nowYear - 10; y--) years.push(y);
  yearOnlySelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
}
populateYearOnlyPicker();

function syncYearOnlyPicker() {
  yearOnlySelect.value = String(referenceDate.getFullYear());
}

yearOnlySelect.addEventListener("change", () => {
  referenceDate = new Date(Number(yearOnlySelect.value), 0, 1);
  loadEarnings();
});

function updateEarningsNavMode() {
  const isMonthly = currentPeriod === "MONTHLY";
  const isYearly = currentPeriod === "YEARLY";
  const isWeekly = currentPeriod === "WEEKLY";

  document.getElementById("earningsMonthPicker").style.display = isMonthly ? "flex" : "none";
  document.getElementById("earningsYearOnlyPicker").style.display = isYearly ? "flex" : "none";
  document.getElementById("earningsRange").style.display = isWeekly ? "inline" : "none";
  document.getElementById("earningsPrevBtn").style.display = isWeekly ? "inline-flex" : "none";
  document.getElementById("earningsNextBtn").style.display = isWeekly ? "inline-flex" : "none";

  if (isMonthly) syncMonthYearPicker();
  if (isYearly) syncYearOnlyPicker();
}

async function loadEarnings() {
  const totalEl = document.getElementById("earningsTotal");
  const captionEl = document.getElementById("earningsCaption");
  const rangeEl = document.getElementById("earningsRange");
  captionEl.textContent = "Cargando…";
  try {
    const earnings = await Api.getEarnings(currentPeriod, referenceDateISO());
    totalEl.textContent = formatCOP(earnings.totalCollected);
    rangeEl.textContent = `${formatDateDisplay(earnings.startDate)} – ${formatDateDisplay(earnings.endDate)}`;
    captionEl.textContent = buildEarningsCaption(currentPeriod, referenceDate);
  } catch (err) {
    totalEl.textContent = "—";
    captionEl.textContent = "No se pudo cargar";
    rangeEl.textContent = "—";
    showToast(err.message || "No se pudo cargar el reporte de ganancias", "error");
  }
}

document.querySelectorAll("#periodToggle button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#periodToggle button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentPeriod = btn.dataset.period;
    referenceDate = new Date();
    updateEarningsNavMode();
    loadEarnings();
  });
});

document.getElementById("earningsPrevBtn").addEventListener("click", () => {
  shiftReferenceDate(currentPeriod, -1);
  loadEarnings();
});
document.getElementById("earningsNextBtn").addEventListener("click", () => {
  shiftReferenceDate(currentPeriod, 1);
  loadEarnings();
});
document.getElementById("earningsTodayBtn").addEventListener("click", () => {
  referenceDate = new Date();
  if (currentPeriod === "MONTHLY") syncMonthYearPicker();
  if (currentPeriod === "YEARLY") syncYearOnlyPicker();
  loadEarnings();
});

async function loadDashboard() {
  try {
    const [summary, appointments, patients] = await Promise.all([
      Api.getDashboardSummary(),
      Api.getAppointments(todayISO()),
      Api.getPatients(),
    ]);

    const patientMap = new Map((patients || []).map(p => [p.id, p.name]));

    document.getElementById("statTotalCitas").textContent = summary.totalAppointmentsToday ?? 0;
    document.getElementById("statRecaudado").textContent = formatCOP(summary.totalCollectedToday);

    const breakdown = summary.appointmentsByStatus || {};
    const breakdownEl = document.getElementById("statusBreakdown");
    const order = ["PENDING", "CONFIRMED", "ATTENDED", "CANCELLED"];
    breakdownEl.innerHTML = order
      .filter(st => breakdown[st] !== undefined)
      .map(st => `
        <span class="status-mini">
          <span class="dot" style="background:${STATUS_DOT_COLOR[st]}"></span>
          ${STATUS_LABELS[st]}: <strong>${breakdown[st]}</strong>
        </span>`).join("") || `<span class="status-mini">Sin citas registradas hoy</span>`;

    renderQuickAgenda(appointments || [], patientMap);

    document.getElementById("loadingState").style.display = "none";
    document.getElementById("dashboardContent").style.display = "block";
  } catch (err) {
    showToast(err.message || "No se pudo cargar el dashboard", "error");
    document.getElementById("loadingState").innerHTML = `
      <i class="bi bi-wifi-off"></i>
      <div class="empty-title">No se pudo cargar el resumen</div>
      <div>${escapeHtml(err.message || "")}</div>`;
  }
}

function renderQuickAgenda(appointments, patientMap) {
  const container = document.getElementById("quickAgenda");
  if (!appointments.length) {
    container.innerHTML = `
      <div class="card-surface empty-state">
        <i class="bi bi-calendar2-check"></i>
        <div class="empty-title">No hay citas agendadas para hoy</div>
        <div>Puedes agendar una nueva desde la sección Agenda.</div>
      </div>`;
    return;
  }

  const sorted = [...appointments].sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
  container.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Hora</th><th>Paciente</th><th>Tratamiento</th><th>Estado</th></tr></thead>
        <tbody>
          ${sorted.slice(0, 6).map(a => `
            <tr>
              <td class="cell-mono">${formatTimeDisplay(a.appointmentTime)}</td>
              <td>${escapeHtml(patientMap.get(a.patientId) || `Paciente #${a.patientId}`)}</td>
              <td class="cell-muted">${escapeHtml(a.treatment)}</td>
              <td>${statusBadge(a.status)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

updateEarningsNavMode();
loadDashboard();
loadEarnings();