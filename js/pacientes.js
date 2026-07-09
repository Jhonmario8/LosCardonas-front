requireAuth();
renderShell("pacientes", "Pacientes");

const patientModalEl = document.getElementById("patientModal");
const patientModal = new bootstrap.Modal(patientModalEl);
const inactivateModalEl = document.getElementById("inactivateModal");
const inactivateModal = new bootstrap.Modal(inactivateModalEl);

let currentPatients = [];
let patientToInactivate = null;
let searchDebounce = null;

const CURRENT_YEAR = new Date().getFullYear();
buildDateSelectGroup("pBirthGroup", { minYear: CURRENT_YEAR - 100, maxYear: CURRENT_YEAR, yearOrder: "desc" });

async function loadPatients(name) {
  const container = document.getElementById("patientsContainer");
  container.innerHTML = `
    <div class="empty-state"><i class="bi bi-hourglass-split"></i><div class="empty-title">Cargando pacientes…</div></div>`;
  try {
    const patients = await Api.getPatients(name);
    currentPatients = patients || [];
    renderPatients(currentPatients);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state"><i class="bi bi-wifi-off"></i>
        <div class="empty-title">No se pudo cargar la lista de pacientes</div>
        <div>${escapeHtml(err.message || "")}</div>
      </div>`;
    showToast(err.message || "Error al cargar pacientes", "error");
  }
}

function renderPatients(patients) {
  const container = document.getElementById("patientsContainer");
  if (!patients.length) {
    container.innerHTML = `
      <div class="card-surface empty-state">
        <i class="bi bi-person-x"></i>
        <div class="empty-title">No se encontraron pacientes</div>
        <div>Intenta con otro nombre o registra uno nuevo.</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Paciente</th><th>Documento</th><th>Teléfono</th><th>Correo</th><th>Notas</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${patients.map(p => `
            <tr>
              <td><strong>${escapeHtml(p.name)}</strong></td>
              <td class="cell-mono">${escapeHtml(p.identificationNumber)}</td>
              <td class="cell-mono">${escapeHtml(p.phoneNumber)}</td>
              <td class="cell-muted">${escapeHtml(p.email || "—")}</td>
              <td class="cell-muted">${escapeHtml(truncate(p.notes, 40))}</td>
              <td>
                <div class="row-actions">
                  <button class="icon-btn" title="Editar" onclick="openEditPatient(${p.id})"><i class="bi bi-pencil"></i></button>
                  <button class="icon-btn" title="Agendar cita" onclick="goToAgendaFor(${p.id})"><i class="bi bi-calendar-plus"></i></button>
                  <button class="icon-btn danger" title="Inactivar" onclick="askInactivate(${p.id})"><i class="bi bi-person-dash"></i></button>
                </div>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function truncate(text, max) {
  if (!text) return "—";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function goToAgendaFor(patientId) {
  sessionStorage.setItem("dentalcore_preselect_patient", patientId);
  window.location.href = "agenda.html";
}

// ---- Buscar ----
document.getElementById("searchInput").addEventListener("input", (e) => {
  clearTimeout(searchDebounce);
  const value = e.target.value.trim();
  searchDebounce = setTimeout(() => loadPatients(value), 350);
});

// ---- Crear / editar ----
document.getElementById("newPatientBtn").addEventListener("click", () => {
  document.getElementById("patientForm").reset();
  document.getElementById("patientId").value = "";
  clearDateSelectValue("pBirthGroup");
  document.getElementById("patientModalTitle").textContent = "Nuevo paciente";
  patientModal.show();
});

function openEditPatient(id) {
  const p = currentPatients.find(x => x.id === id);
  if (!p) return;
  document.getElementById("patientId").value = p.id;
  document.getElementById("pName").value = p.name || "";
  document.getElementById("pDoc").value = p.identificationNumber || "";
  document.getElementById("pPhone").value = p.phoneNumber || "";
  document.getElementById("pEmail").value = p.email || "";
  clearDateSelectValue("pBirthGroup");
  if (p.birthDate) setDateSelectValue("pBirthGroup", p.birthDate);
  document.getElementById("pNotes").value = p.notes || "";
  document.getElementById("patientModalTitle").textContent = "Editar paciente";
  patientModal.show();
}

document.getElementById("patientForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("patientId").value;
  const payload = {
    name: document.getElementById("pName").value.trim(),
    identificationNumber: document.getElementById("pDoc").value.trim(),
    phoneNumber: document.getElementById("pPhone").value.trim(),
    email: document.getElementById("pEmail").value.trim(),
    birthDate: getDateSelectValue("pBirthGroup"),
    notes: document.getElementById("pNotes").value.trim(),
  };

  const btn = document.getElementById("patientSaveBtn");
  setButtonLoading(btn, true);
  try {
    if (id) {
      await Api.updatePatient(id, payload);
      showToast("Paciente actualizado correctamente");
    } else {
      await Api.createPatient(payload);
      showToast("Paciente registrado correctamente");
    }
    patientModal.hide();
    loadPatients(document.getElementById("searchInput").value.trim());
  } catch (err) {
    showToast(err.message || "No se pudo guardar el paciente", "error");
  } finally {
    setButtonLoading(btn, false);
  }
});

// ---- Inactivar ----
function askInactivate(id) {
  const p = currentPatients.find(x => x.id === id);
  if (!p) return;
  patientToInactivate = p;
  document.getElementById("inactivateName").textContent = p.name;
  inactivateModal.show();
}

document.getElementById("confirmInactivateBtn").addEventListener("click", async () => {
  if (!patientToInactivate) return;
  const btn = document.getElementById("confirmInactivateBtn");
  setButtonLoading(btn, true, "Inactivando…");
  try {
    await Api.inactivatePatient(patientToInactivate.id);
    showToast(`${patientToInactivate.name} fue inactivado`);
    inactivateModal.hide();
    loadPatients(document.getElementById("searchInput").value.trim());
  } catch (err) {
    showToast(err.message || "No se pudo inactivar el paciente", "error");
  } finally {
    setButtonLoading(btn, false);
  }
});

loadPatients();
