/* ==========================================================================
   DentalCore — Utilidades de interfaz compartidas
   ========================================================================== */

const NAV_ITEMS = [
  { href: "dashboard.html", icon: "bi-grid-1x2-fill", label: "Dashboard", key: "dashboard" },
  { href: "agenda.html", icon: "bi-calendar3", label: "Agenda", key: "agenda" },
  { href: "pacientes.html", icon: "bi-people-fill", label: "Pacientes", key: "pacientes" },
  { href: "pagos.html", icon: "bi-cash-coin", label: "Pagos", key: "pagos" },
];

function renderShell(activeKey, pageTitle) {
  const sidebar = document.getElementById("sidebar");
  const topbar = document.getElementById("topbar");
  if (!sidebar || !topbar) return;

  sidebar.innerHTML = `
    <div class="brand">
      <span class="brand-mark">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
          <path d="M12 2.2c-2.1 0-3.5.95-4.6.95-1.15 0-2.1-.65-2.85-.65-.55 0-.95.45-.95 1.05 0 2.15.75 4.2.95 6.4.3 2.35.65 5.75 2.3 7.55.5.55 1.05.5 1.4-.15.75-1.4.95-3.75 1.5-5.3.3-.85.85-1.25 2.25-1.25s1.95.4 2.25 1.25c.55 1.55.75 3.9 1.5 5.3.35.65.9.7 1.4.15 1.65-1.8 2-5.2 2.3-7.55.2-2.2.95-4.25.95-6.4 0-.6-.4-1.05-.95-1.05-.75 0-1.7.65-2.85.65-1.1 0-2.5-.95-4.6-.95Z"/>
        </svg>
      </span>
      <span class="brand-text">DentalCore</span>
    </div>
    <nav class="side-nav">
      ${NAV_ITEMS.map(item => `
        <a href="${item.href}" class="side-nav-item ${item.key === activeKey ? "active" : ""}" title="${item.label}">
          <i class="bi ${item.icon}"></i><span>${item.label}</span>
        </a>`).join("")}
    </nav>
    <button class="logout-btn" id="logoutBtn" type="button" title="Cerrar sesión">
      <i class="bi bi-box-arrow-left"></i><span>Cerrar sesión</span>
    </button>
  `;

  topbar.innerHTML = `
    <h1>${pageTitle}</h1>
    <div class="topbar-date" id="topbarDate"></div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearToken();
    window.location.href = "index.html";
  });

  const dateEl = document.getElementById("topbarDate");
  if (dateEl) {
    const today = new Date();
    const label = today.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    dateEl.textContent = label;
  }
}

function ensureToastContainer() {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = "success") {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `app-toast ${type}`;
  const icon = type === "error" ? "bi-exclamation-triangle-fill" : "bi-check-circle-fill";
  toast.innerHTML = `<i class="bi ${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

const STATUS_LABELS = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  ATTENDED: "Atendida",
  CANCELLED: "Cancelada",
  PARTIAL: "Parcial",
  PAID: "Pagado",
};

function statusBadge(status) {
  const label = STATUS_LABELS[status] || status;
  return `<span class="status-badge status-${status.toLowerCase()}">${label}</span>`;
}

function formatCOP(value) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":");
  const date = new Date();
  date.setHours(+h, +m, 0, 0);
  return date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTimeDisplay(isoDateTime) {
  if (!isoDateTime) return "—";
  const truncated = isoDateTime.replace(/(\.\d{3})\d+$/, "$1");
  const date = new Date(truncated);
  if (isNaN(date.getTime())) return isoDateTime;
  return date.toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("");
}

/* ==========================================================================
   Selectores de fecha (día/mes/año) y hora por franjas
   Reemplazan los inputs nativos type="date"/type="time" para que el estilo
   sea consistente en todos los navegadores y más rápido de usar.
   ========================================================================== */
const MONTHS_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function buildDateSelectGroup(containerId, { minYear, maxYear, yearOrder = "desc" } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const years = [];
  if (yearOrder === "desc") {
    for (let y = maxYear; y >= minYear; y--) years.push(y);
  } else {
    for (let y = minYear; y <= maxYear; y++) years.push(y);
  }

  container.innerHTML = `
    <select class="form-select date-select" data-part="day" aria-label="Día">
      <option value="">Día</option>
      ${Array.from({ length: 31 }, (_, i) => i + 1).map(d => `<option value="${d}">${d}</option>`).join("")}
    </select>
    <select class="form-select date-select" data-part="month" aria-label="Mes">
      <option value="">Mes</option>
      ${MONTHS_ES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("")}
    </select>
    <select class="form-select date-select" data-part="year" aria-label="Año">
      <option value="">Año</option>
      ${years.map(y => `<option value="${y}">${y}</option>`).join("")}
    </select>
  `;

  const daySelect = container.querySelector('[data-part="day"]');
  const monthSelect = container.querySelector('[data-part="month"]');
  const yearSelect = container.querySelector('[data-part="year"]');

  function refreshDays() {
    const month = Number(monthSelect.value);
    const year = Number(yearSelect.value) || new Date().getFullYear();
    const max = month ? daysInMonth(month, year) : 31;
    const current = Number(daySelect.value);
    daySelect.innerHTML = `<option value="">Día</option>` +
      Array.from({ length: max }, (_, i) => i + 1)
        .map(d => `<option value="${d}" ${d === current ? "selected" : ""}>${d}</option>`).join("");
  }
  monthSelect.addEventListener("change", refreshDays);
  yearSelect.addEventListener("change", refreshDays);
}

function getDateSelectValue(containerId) {
  const container = document.getElementById(containerId);
  const day = container.querySelector('[data-part="day"]').value;
  const month = container.querySelector('[data-part="month"]').value;
  const year = container.querySelector('[data-part="year"]').value;
  if (!day || !month || !year) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function setDateSelectValue(containerId, isoDate) {
  const container = document.getElementById(containerId);
  if (!container || !isoDate) return;
  const [year, month, day] = isoDate.split("-");
  container.querySelector('[data-part="year"]').value = String(Number(year));
  container.querySelector('[data-part="month"]').value = String(Number(month));
  container.querySelector('[data-part="month"]').dispatchEvent(new Event("change"));
  container.querySelector('[data-part="day"]').value = String(Number(day));
}

function clearDateSelectValue(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll("select").forEach(s => { s.value = ""; });
}

function buildTimeSlotSelect(selectId, { startHour = 7, endHour = 19, stepMinutes = 30 } = {}) {
  const select = document.getElementById(selectId);
  if (!select) return;
  let options = `<option value="">Selecciona una hora…</option>`;
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      if (h === endHour && m > 0) break;
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      options += `<option value="${value}">${formatTimeDisplay(value)}</option>`;
    }
  }
  select.innerHTML = options;
}

function setButtonLoading(btn, loading, loadingText = "Guardando…") {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${loadingText}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
  }
}