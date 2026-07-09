/* ==========================================================================
   DentalCore — Capa de acceso a la API
   ========================================================================== */

// TODO: al desplegar el backend en Render, reemplaza esta URL por la real,
// por ejemplo: "https://dentalcore-api.onrender.com"
const API_BASE_URL = "https://dentalcore-v3cv.onrender.com";

const TOKEN_KEY = "dentalcore_token";

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

/** Redirige al login si no hay sesión activa. Se llama al inicio de cada página protegida. */
function requireAuth() {
  if (!getToken()) {
    window.location.href = "index.html";
  }
}

async function apiRequest(path, { method = "GET", body = null, query = null, auth = true } = {}) {
  let url = API_BASE_URL + path;
  if (query) {
    const cleaned = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""));
    const params = new URLSearchParams(cleaned);
    const qs = params.toString();
    if (qs) url += "?" + qs;
  }

  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new Error("No fue posible conectar con el servidor. Verifica que el backend esté corriendo.");
  }

  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.endsWith("index.html") && window.location.pathname !== "/") {
      window.location.href = "index.html";
    }
    throw new Error("Sesión inválida o expirada. Inicia sesión de nuevo.");
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = text; }
  }

  if (!res.ok) {
    const message = (data && (data.message || data.error || data.detail)) || `Error ${res.status}`;
    throw new Error(message);
  }

  return data;
}

const Api = {
  // ---- Auth ----
  login: (email, password) =>
    apiRequest("/users/login", { method: "POST", body: { email, password }, auth: false }),

  // ---- Pacientes ----
  getPatients: (name) => apiRequest("/patients", { query: { name } }),
  createPatient: (patient) => apiRequest("/patients", { method: "POST", body: patient }),
  updatePatient: (id, patient) => apiRequest(`/patients/${id}`, { method: "PUT", body: patient }),
  inactivatePatient: (id) => apiRequest(`/patients/${id}/inactivate`, { method: "PATCH" }),

  // ---- Citas ----
  getAppointments: (date) => apiRequest("/appointments", { query: { date } }),
  createAppointment: (appointment) => apiRequest("/appointments", { method: "POST", body: appointment }),
  updateAppointmentStatus: (id, status) =>
    apiRequest(`/appointments/${id}/status`, { method: "PATCH", query: { status } }),

  // ---- Pagos ----
  createPayment: (payment) => apiRequest("/payments", { method: "POST", body: payment }),
  addPaymentAmount: (id, mount) => apiRequest(`/payments/${id}/amount`, { method: "PUT", query: { mount } }),
  getPaymentsByPatient: (patientId) => apiRequest(`/payments/patient/${patientId}`),
  getPaymentTransactions: (paymentId) => apiRequest(`/payments/${paymentId}/transactions`),

  // ---- Dashboard ----
  getDashboardSummary: () => apiRequest("/dashboard/summary"),
};
