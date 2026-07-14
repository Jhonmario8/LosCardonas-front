requireAuth();
renderShell("dashboard", "Dashboard");

const STATUS_DOT_COLOR = {
  PENDING: "var(--status-pending)",
  CONFIRMED: "var(--status-confirmed)",
  ATTENDED: "var(--status-attended)",
  CANCELLED: "var(--status-cancelled)",
};

const PERIOD_LABELS = { WEEKLY: "esta semana", MONTHLY: "este mes", YEARLY: "este año" };

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

async function loadEarnings() {
  const totalEl = document.getElementById("earningsTotal");
  const captionEl = document.getElementById("earningsCaption");
  const rangeEl = document.getElementById("earningsRange");
  captionEl.textContent = "Cargando…";
  try {
    const earnings = await Api.getEarnings(currentPeriod, referenceDateISO());
    totalEl.textContent = formatCOP(earnings.totalCollected);
    rangeEl.textContent = `${formatDateDisplay(earnings.startDate)} – ${formatDateDisplay(earnings.endDate)}`;
    captionEl.textContent = `Recaudado ${PERIOD_LABELS[currentPeriod]}`;
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

loadDashboard();
loadEarnings();