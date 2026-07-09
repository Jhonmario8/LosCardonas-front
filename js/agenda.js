requireAuth();
renderShell("agenda", "Agenda");

const appointmentModal = new bootstrap.Modal(document.getElementById("appointmentModal"));
const paymentModal = new bootstrap.Modal(document.getElementById("paymentModal"));

const VALID_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ATTENDED", "CANCELLED"],
  ATTENDED: [],
  CANCELLED: [],
};

const TRANSITION_LABEL = {
  CONFIRMED: { text: "Confirmar", icon: "bi-check2" },
  ATTENDED: { text: "Marcar atendida", icon: "bi-check2-circle" },
  CANCELLED: { text: "Cancelar", icon: "bi-x-lg" },
};

let patientsCache = [];
let patientMap = new Map();
let currentAppointments = [];
let selectedAppointmentForPayment = null;

const dateInput = document.getElementById("agendaDate");
dateInput.value = todayISO();

async function loadPatientsCache() {
  try {
    patientsCache = await Api.getPatients();
    patientMap = new Map(patientsCache.map(p => [p.id, p.name]));
  } catch (err) {
    showToast("No se pudo cargar la lista de pacientes", "error");
  }
}

async function loadAgenda(date) {
  const container = document.getElementById("agendaContainer");
  container.innerHTML = `<div class="empty-state"><i class="bi bi-hourglass-split"></i><div class="empty-title">Cargando agenda…</div></div>`;
  try {
    const appointments = await Api.getAppointments(date);
    currentAppointments = (appointments || []).sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));
    renderAgenda(currentAppointments, date);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state"><i class="bi bi-wifi-off"></i>
        <div class="empty-title">No se pudo cargar la agenda</div>
        <div>${escapeHtml(err.message || "")}</div>
      </div>`;
    showToast(err.message || "Error al cargar la agenda", "error");
  }
}

function renderAgenda(appointments, date) {
  const container = document.getElementById("agendaContainer");
  if (!appointments.length) {
    container.innerHTML = `
      <div class="card-surface empty-state">
        <i class="bi bi-calendar2-x"></i>
        <div class="empty-title">No hay citas para este día</div>
        <div>Usa "Nueva cita" para agendar la primera.</div>
      </div>`;
    return;
  }

  const isToday = date === todayISO();
  const nowStr = new Date().toTimeString().slice(0, 8);
  let nowMarkerInserted = false;

  let html = `<div class="timeline">`;
  appointments.forEach((a) => {
    if (isToday && !nowMarkerInserted && a.appointmentTime >= nowStr) {
      html += nowMarker();
      nowMarkerInserted = true;
    }
    html += appointmentCard(a);
  });
  if (isToday && !nowMarkerInserted) html += nowMarker();
  html += `</div>`;
  container.innerHTML = html;
}

function nowMarker() {
  const now = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  return `<div class="timeline-now"><span class="now-label">AHORA · ${now}</span></div>`;
}

function appointmentCard(a) {
  const patientName = patientMap.get(a.patientId) || `Paciente #${a.patientId}`;
  const transitions = VALID_TRANSITIONS[a.status] || [];
  const actionButtons = transitions.map(next => {
    const meta = TRANSITION_LABEL[next];
    const cls = next === "CANCELLED" ? "danger" : "";
    return `<button class="btn-mini ${cls}" onclick="changeStatus(${a.id}, '${next}')"><i class="bi ${meta.icon} me-1"></i>${meta.text}</button>`;
  }).join("");

  const paymentBtn = (a.status === "CONFIRMED" || a.status === "ATTENDED")
    ? `<button class="btn-mini subtle" onclick="openPaymentModal(${a.id})"><i class="bi bi-cash-coin me-1"></i>Registrar pago</button>`
    : "";

  return `
    <div class="timeline-item st-${a.status.toLowerCase()}">
      <div class="appt-card">
        <div class="appt-time">${formatTimeDisplay(a.appointmentTime)}</div>
        <div class="appt-main">
          <span class="appt-patient">${escapeHtml(patientName)}</span>
          <span class="appt-treatment">${escapeHtml(a.treatment)}</span>
        </div>
        ${statusBadge(a.status)}
        <div class="appt-actions">${actionButtons}${paymentBtn}</div>
      </div>
    </div>`;
}

// ---- Buscador de paciente (nombre o documento) ----
const aPatientSearch = document.getElementById("aPatientSearch");
const aPatientHidden = document.getElementById("aPatient");
const aPatientResults = document.getElementById("aPatientResults");
const aPatientSelected = document.getElementById("aPatientSelected");
const aPatientSelectedName = document.getElementById("aPatientSelectedName");

function filterPatients(query) {
  const q = query.trim().toLowerCase();
  if (!q) return patientsCache.slice(0, 8);
  return patientsCache
    .filter(p => p.name.toLowerCase().includes(q) || (p.identificationNumber || "").includes(q))
    .slice(0, 8);
}

function renderPatientResults(list) {
  if (!list.length) {
    aPatientResults.innerHTML = `<div class="patient-picker-empty">No se encontraron pacientes.</div>`;
  } else {
    aPatientResults.innerHTML = list.map(p => `
      <div class="patient-picker-item" data-id="${p.id}" data-name="${escapeHtml(p.name)}">
        <span>${escapeHtml(p.name)}</span>
        <span class="doc">${escapeHtml(p.identificationNumber)}</span>
      </div>`).join("");
  }
  aPatientResults.classList.add("show");
}

aPatientSearch.addEventListener("focus", () => renderPatientResults(filterPatients(aPatientSearch.value)));
aPatientSearch.addEventListener("input", () => renderPatientResults(filterPatients(aPatientSearch.value)));

aPatientResults.addEventListener("click", (e) => {
  const item = e.target.closest(".patient-picker-item");
  if (!item || !item.dataset.id) return;
  selectPatientForAppointment(item.dataset.id, item.dataset.name);
});

document.addEventListener("click", (e) => {
  if (!document.getElementById("aPatientPicker").contains(e.target)) {
    aPatientResults.classList.remove("show");
  }
});

function selectPatientForAppointment(id, name) {
  aPatientHidden.value = id;
  aPatientSearch.value = "";
  aPatientResults.classList.remove("show");
  aPatientSearch.style.display = "none";
  aPatientSelectedName.textContent = name;
  aPatientSelected.classList.add("show");
}

function clearPatientSelection() {
  aPatientHidden.value = "";
  aPatientSearch.value = "";
  aPatientSearch.style.display = "";
  aPatientSelected.classList.remove("show");
}

document.getElementById("aPatientClear").addEventListener("click", clearPatientSelection);


function reload() { loadAgenda(dateInput.value); }
dateInput.addEventListener("change", reload);
document.getElementById("todayBtn").addEventListener("click", () => { dateInput.value = todayISO(); reload(); });
document.getElementById("prevDayBtn").addEventListener("click", () => { shiftDate(-1); });
document.getElementById("nextDayBtn").addEventListener("click", () => { shiftDate(1); });

function shiftDate(days) {
  const d = new Date(dateInput.value + "T00:00:00");
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  dateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  reload();
}

// ---- Cambiar estado ----
async function changeStatus(id, status) {
  try {
    await Api.updateAppointmentStatus(id, status);
    showToast("Estado de la cita actualizado");
    reload();
  } catch (err) {
    showToast(err.message || "No se pudo actualizar el estado", "error");
  }
}

// ---- Nueva cita ----
document.getElementById("newAppointmentBtn").addEventListener("click", () => {
  document.getElementById("appointmentForm").reset();
  clearPatientSelection();
  setDateSelectValue("aDateGroup", dateInput.value);
  appointmentModal.show();
});

document.getElementById("quickToday").addEventListener("click", () => setDateSelectValue("aDateGroup", todayISO()));
document.getElementById("quickTomorrow").addEventListener("click", () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, "0");
  setDateSelectValue("aDateGroup", `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
});

document.getElementById("appointmentForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!aPatientHidden.value) {
    showToast("Selecciona un paciente de la lista", "error");
    return;
  }
  const appointmentDate = getDateSelectValue("aDateGroup");
  if (!appointmentDate) {
    showToast("Selecciona día, mes y año", "error");
    return;
  }
  const appointmentTime = document.getElementById("aTime").value;
  if (!appointmentTime) {
    showToast("Selecciona una hora", "error");
    return;
  }

  const payload = {
    patientId: Number(aPatientHidden.value),
    appointmentDate,
    appointmentTime,
    treatment: document.getElementById("aTreatment").value.trim(),
  };
  const btn = document.getElementById("appointmentSaveBtn");
  setButtonLoading(btn, true, "Agendando…");
  try {
    await Api.createAppointment(payload);
    showToast("Cita agendada correctamente");
    appointmentModal.hide();
    if (payload.appointmentDate !== dateInput.value) {
      dateInput.value = payload.appointmentDate;
    }
    reload();
  } catch (err) {
    showToast(err.message || "No se pudo agendar la cita", "error");
  } finally {
    setButtonLoading(btn, false);
  }
});

// ---- Registrar pago ----
function openPaymentModal(appointmentId) {
  const appt = currentAppointments.find(a => a.id === appointmentId);
  if (!appt) return;
  selectedAppointmentForPayment = appt;
  document.getElementById("paymentPatientName").textContent = patientMap.get(appt.patientId) || `Paciente #${appt.patientId}`;
  document.getElementById("paymentTreatmentName").textContent = appt.treatment;
  document.getElementById("paymentForm").reset();
  paymentModal.show();
}

document.getElementById("paymentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedAppointmentForPayment) return;
  const cost = Number(document.getElementById("payCost").value);
  const paid = Number(document.getElementById("payAmount").value);

  if (paid > cost) {
    showToast("El valor pagado no puede ser mayor al valor del tratamiento", "error");
    return;
  }

  const btn = document.getElementById("paymentSaveBtn");
  setButtonLoading(btn, true, "Registrando…");
  try {
    await Api.createPayment({
      appointmentId: selectedAppointmentForPayment.id,
      treatmentCost: cost,
      amountPaid: paid,
    });
    showToast("Pago registrado correctamente");
    paymentModal.hide();
  } catch (err) {
    showToast(err.message || "No se pudo registrar el pago", "error");
  } finally {
    setButtonLoading(btn, false);
  }
});

// ---- Init ----
(async function init() {
  const currentYear = new Date().getFullYear();
  buildDateSelectGroup("aDateGroup", { minYear: currentYear, maxYear: currentYear + 1, yearOrder: "asc" });
  buildTimeSlotSelect("aTime", { startHour: 7, endHour: 19, stepMinutes: 30 });

  await loadPatientsCache();

  const preselect = sessionStorage.getItem("dentalcore_preselect_patient");
  if (preselect) {
    sessionStorage.removeItem("dentalcore_preselect_patient");
    const patient = patientsCache.find(p => String(p.id) === String(preselect));
    document.getElementById("appointmentForm").reset();
    clearPatientSelection();
    setDateSelectValue("aDateGroup", dateInput.value);
    if (patient) selectPatientForAppointment(patient.id, patient.name);
    appointmentModal.show();
  }

  reload();
})();
