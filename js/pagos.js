requireAuth();
renderShell("pagos", "Pagos");

const amountModal = new bootstrap.Modal(document.getElementById("amountModal"));

let searchDebounce = null;
let currentPatient = null;
let currentPayments = [];
let selectedPaymentForAmount = null;

const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  const value = searchInput.value.trim();
  searchDebounce = setTimeout(() => {
    if (value) searchPatients(value);
    else loadDefaultPatients();
  }, 350);
});

async function loadDefaultPatients() {
  const resultsEl = document.getElementById("searchResults");
  try {
    const patients = await Api.getPatients();
    renderPatientList(patients.slice(0, 8), "Pacientes registrados");
  } catch (err) {
    resultsEl.innerHTML = `<p class="cell-muted">No se pudo cargar la lista de pacientes.</p>`;
  }
}

async function searchPatients(name) {
  try {
    const patients = await Api.getPatients(name);
    if (!patients.length) {
      document.getElementById("searchResults").innerHTML = `<p class="cell-muted">No se encontraron pacientes con ese nombre.</p>`;
      return;
    }
    renderPatientList(patients, null);
  } catch (err) {
    showToast(err.message || "Error al buscar pacientes", "error");
  }
}

function renderPatientList(patients, headerText) {
  const resultsEl = document.getElementById("searchResults");
  if (!patients.length) {
    resultsEl.innerHTML = `<p class="cell-muted">No hay pacientes registrados todavía.</p>`;
    return;
  }
  resultsEl.innerHTML = `
    ${headerText ? `<div class="cell-muted" style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">${headerText}</div>` : ""}
    <div class="data-table-wrap">
      <table class="data-table">
        <tbody>
          ${patients.map(p => `
            <tr style="cursor:pointer" onclick="selectPatient(${p.id}, '${escapeHtml(p.name).replace(/'/g, "\\'")}')">
              <td><strong>${escapeHtml(p.name)}</strong></td>
              <td class="cell-mono">${escapeHtml(p.identificationNumber)}</td>
              <td class="cell-muted">${escapeHtml(p.phoneNumber)}</td>
              <td style="text-align:right;"><i class="bi bi-chevron-right cell-muted"></i></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function selectPatient(id, name) {
  currentPatient = { id, name };
  document.getElementById("panelPatientName").textContent = name;
  document.getElementById("paymentsPanel").style.display = "block";
  document.getElementById("paymentsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  await loadPaymentHistory(id);
}

async function loadPaymentHistory(patientId) {
  const container = document.getElementById("paymentsHistory");
  container.innerHTML = `<div class="empty-state"><i class="bi bi-hourglass-split"></i><div class="empty-title">Cargando historial…</div></div>`;
  try {
    const history = await Api.getPaymentsByPatient(patientId);
    currentPayments = history.payments || [];
    document.getElementById("panelPendingBalance").textContent = formatCOP(history.totalPendingBalance);
    renderPaymentHistory(currentPayments);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state"><i class="bi bi-wifi-off"></i>
        <div class="empty-title">No se pudo cargar el historial</div>
        <div>${escapeHtml(err.message || "")}</div>
      </div>`;
    showToast(err.message || "Error al cargar el historial de pagos", "error");
  }
}

function renderPaymentHistory(payments) {
  const container = document.getElementById("paymentsHistory");
  if (!payments.length) {
    container.innerHTML = `
      <div class="card-surface empty-state">
        <i class="bi bi-receipt"></i>
        <div class="empty-title">Este paciente aún no tiene pagos registrados</div>
        <div>Los pagos se registran desde una cita en la Agenda.</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>Cita</th><th>Valor tratamiento</th><th>Valor pagado</th><th>Saldo</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          ${payments.map(p => `
            <tr>
              <td class="cell-muted">#${p.appointmentId}</td>
              <td class="cell-mono">${formatCOP(p.treatmentCost)}</td>
              <td class="cell-mono">${formatCOP(p.amountPaid)}</td>
              <td class="cell-mono">${formatCOP(p.balance)}</td>
              <td>${statusBadge(p.status)}</td>
              <td>
                <div class="row-actions" style="justify-content:flex-start;">
                  <button class="btn-mini subtle" onclick="toggleTransactions(${p.id})" id="txToggle-${p.id}">
                    <i class="bi bi-clock-history me-1"></i>Ver abonos
                  </button>
                  ${p.status !== "PAID"
                    ? `<button class="btn-mini" onclick="openAmountModal(${p.id})"><i class="bi bi-plus-circle me-1"></i>Abono</button>`
                    : ""}
                </div>
              </td>
            </tr>
            <tr id="txRow-${p.id}" style="display:none;">
              <td colspan="6" style="background:var(--color-surface-alt); padding:0;">
                <div id="txContainer-${p.id}" style="padding:12px 18px;"></div>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

// ---- Historial de abonos (transacciones) por pago ----
async function toggleTransactions(paymentId) {
  const row = document.getElementById(`txRow-${paymentId}`);
  const container = document.getElementById(`txContainer-${paymentId}`);
  const toggleBtn = document.getElementById(`txToggle-${paymentId}`);
  const isHidden = row.style.display === "none";

  if (!isHidden) {
    row.style.display = "none";
    toggleBtn.innerHTML = `<i class="bi bi-clock-history me-1"></i>Ver abonos`;
    return;
  }

  row.style.display = "table-row";
  toggleBtn.innerHTML = `<i class="bi bi-chevron-up me-1"></i>Ocultar abonos`;
  container.innerHTML = `<span class="cell-muted">Cargando abonos…</span>`;

  try {
    const transactions = await Api.getPaymentTransactions(paymentId);
    if (!transactions.length) {
      container.innerHTML = `<span class="cell-muted">Aún no se han registrado abonos para este pago.</span>`;
      return;
    }
    const sorted = [...transactions].sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${sorted.map(t => `
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px;">
            <span class="cell-muted"><i class="bi bi-arrow-down-circle text-success me-1"></i>${formatDateTimeDisplay(t.transactionDate)}</span>
            <span class="cell-mono">${formatCOP(t.amount)}</span>
          </div>`).join("")}
      </div>`;
  } catch (err) {
    container.innerHTML = `<span class="cell-muted">No se pudo cargar el historial de abonos.</span>`;
    showToast(err.message || "Error al cargar los abonos", "error");
  }
}

// ---- Registrar abono ----
function openAmountModal(paymentId) {
  const payment = currentPayments.find(p => p.id === paymentId);
  if (!payment) return;
  selectedPaymentForAmount = payment;
  document.getElementById("amountCurrentBalance").textContent = formatCOP(payment.balance);
  document.getElementById("amountForm").reset();
  document.getElementById("amountInput").max = payment.balance;
  amountModal.show();
}

document.getElementById("amountForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedPaymentForAmount) return;
  const abono = Number(document.getElementById("amountInput").value);

  if (abono <= 0) {
    showToast("El abono debe ser mayor a cero", "error");
    return;
  }
  if (abono > selectedPaymentForAmount.balance) {
    showToast(`El abono no puede superar el saldo pendiente (${formatCOP(selectedPaymentForAmount.balance)})`, "error");
    return;
  }

  const btn = document.getElementById("amountSaveBtn");
  setButtonLoading(btn, true, "Registrando…");
  try {
    await Api.addPaymentAmount(selectedPaymentForAmount.id, abono);
    showToast("Abono registrado correctamente");
    amountModal.hide();
    loadPaymentHistory(currentPatient.id);
  } catch (err) {
    showToast(err.message || "No se pudo registrar el abono", "error");
  } finally {
    setButtonLoading(btn, false);
  }
});

// ---- Init ----
loadDefaultPatients();
