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

/* ==========================================================================
   Mensajes de error legibles
   Prioridad al armar el mensaje: mapa por contexto+status > mensaje del
   backend (si trae uno útil) > mensaje genérico por código HTTP.
   ========================================================================== */

const STATUS_FALLBACK = {
  400: "Los datos enviados no son válidos. Revisa los campos e intenta de nuevo.",
  401: "No autorizado. Inicia sesión de nuevo.",
  403: "No tienes permisos para realizar esta acción.",
  404: "No se encontró lo que buscabas.",
  409: "La operación no se pudo completar por un conflicto con los datos existentes.",
  500: "Ocurrió un error inesperado en el servidor. Intenta de nuevo.",
};

const CONTEXT_MESSAGES = {
  login: {
    400: "Credenciales incorrectas. Verifica tu correo y contraseña.",
    401: "Credenciales incorrectas. Verifica tu correo y contraseña.",
  },
  patients: {
    404: "No se encontró el paciente.",
  },
  patientCreate: {
    400: "Revisa los datos del paciente: hay campos inválidos o incompletos.",
    409: "Ya existe un paciente activo con ese teléfono o documento.",
  },
  patientUpdate: {
    400: "Revisa los datos del paciente: hay campos inválidos o incompletos.",
    404: "No se encontró el paciente que intentas editar.",
    409: "Ese teléfono o documento ya pertenece a otro paciente activo.",
  },
  patientInactivate: {
    404: "No se encontró el paciente.",
    409: "Este paciente ya estaba inactivo.",
  },
  appointments: {
    400: "La fecha ingresada no es válida.",
  },
  appointmentCreate: {
    400: "Revisa la fecha, hora o el tratamiento: hay datos inválidos.",
    404: "El paciente seleccionado no existe o está inactivo.",
    409: "Ya existe una cita agendada en esa fecha y hora.",
  },
  appointmentStatus: {
    404: "La cita no fue encontrada.",
    409: "No es posible cambiar la cita a ese estado.",
  },
  paymentCreate: {
    400: "El valor pagado no puede ser mayor al valor del tratamiento, o los datos son inválidos.",
    404: "La cita asociada a este pago no fue encontrada.",
  },
  paymentAmount: {
    400: "El valor del abono no es válido.",
    404: "El pago no fue encontrado.",
  },
  payments: {
    404: "No se encontró información de pagos para este paciente.",
  },
  paymentTransactions: {
    404: "No se encontraron abonos para este pago.",
  },
  dashboard: {
    500: "No se pudo generar el resumen del día.",
  },
};

function buildErrorMessage(status, context, data) {
  const contextual = (context && CONTEXT_MESSAGES[context] && CONTEXT_MESSAGES[context][status]) || null;
  if (contextual) return contextual;

  const backendMsg = data && typeof data === "object" ? (data.message || data.detail) : null;
  if (backendMsg && typeof backendMsg === "string") return backendMsg;

  return STATUS_FALLBACK[status] || `Ocurrió un error (código ${status}).`;
}

async function apiRequest(path, { method = "GET", body = null, query = null, auth = true, context = null } = {}) {
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

  // Sesión expirada/ inválida en una petición que SÍ requería token.
  // (El login también puede devolver 401, pero por credenciales incorrectas,
  // no por sesión expirada — por eso solo se maneja aquí cuando auth=true.)
  if (res.status === 401 && auth) {
    clearToken();
    const onLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname === "/";
    if (!onLoginPage) {
      setTimeout(() => { window.location.href = "index.html"; }, 1200);
    }
    throw new Error("Tu sesión expiró. Inicia sesión de nuevo.");
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = text; }
  }

  if (!res.ok) {
    throw new Error(buildErrorMessage(res.status, context, data));
  }

  return data;
}

const Api = {
  // ---- Auth ----
  login: (username, password) =>
    apiRequest("/users/login", { method: "POST", body: { username, password }, auth: false, context: "login" }),

  // ---- Pacientes ----
  getPatients: (name) => apiRequest("/patients", { query: { name }, context: "patients" }),
  createPatient: (patient) => apiRequest("/patients", { method: "POST", body: patient, context: "patientCreate" }),
  updatePatient: (id, patient) => apiRequest(`/patients/${id}`, { method: "PUT", body: patient, context: "patientUpdate" }),
  inactivatePatient: (id) => apiRequest(`/patients/${id}/inactivate`, { method: "PATCH", context: "patientInactivate" }),

  // ---- Citas ----
  getAppointments: (date) => apiRequest("/appointments", { query: { date }, context: "appointments" }),
  createAppointment: (appointment) => apiRequest("/appointments", { method: "POST", body: appointment, context: "appointmentCreate" }),
  updateAppointmentStatus: (id, status) =>
    apiRequest(`/appointments/${id}/status`, { method: "PATCH", query: { status }, context: "appointmentStatus" }),

  // ---- Pagos ----
  createPayment: (payment) => apiRequest("/payments", { method: "POST", body: payment, context: "paymentCreate" }),
  addPaymentAmount: (id, mount) => apiRequest(`/payments/${id}/amount`, { method: "PUT", query: { mount }, context: "paymentAmount" }),
  getPaymentsByPatient: (patientId) => apiRequest(`/payments/patient/${patientId}`, { context: "payments" }),
  getPaymentTransactions: (paymentId) => apiRequest(`/payments/${paymentId}/transactions`, { context: "paymentTransactions" }),

  // ---- Dashboard ----
  getDashboardSummary: () => apiRequest("/dashboard/summary", { context: "dashboard" }),
};