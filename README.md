# Los Cardonas — Frontend

Interfaz web del sistema de gestión del consultorio odontológico Los Cardonas. Consume la API REST de **[DentalCore](https://github.com/Jhonmario8/DentalCore)**.

> **Privacidad de datos.** Esta interfaz se construyó para el consultorio de una familiar, que aún no abre operación. Por eso **no hay demo pública, cuenta de prueba ni credenciales** en este repositorio. Este README no contiene datos reales, y cualquier captura que se agregue debe tomarse con datos ficticios.

## Páginas

| Página | Archivo | Qué hace |
|---|---|---|
| **Login** | `index.html` | Inicio de sesión con usuario y contraseña. Guarda el JWT en `sessionStorage`. |
| **Dashboard** | `dashboard.html` | Citas de hoy por estado, total recaudado hoy, agenda rápida del día e ingresos por semana, mes o año, con navegación entre periodos. |
| **Agenda** | `agenda.html` | Línea de tiempo de las citas de un día, con marcador de "ahora". Permite agendar citas (buscando al paciente por nombre o documento), confirmar, marcar atendida, cancelar y registrar el pago de una cita. |
| **Pacientes** | `pacientes.html` | Listado y búsqueda por nombre, alta y edición de pacientes, inactivación y acceso directo para agendarle una cita. |
| **Pagos** | `pagos.html` | Buscar un paciente y ver su historial de pagos con el saldo pendiente, el detalle de abonos de cada pago y el registro de nuevos abonos. |

## Stack

- **HTML5 + JavaScript plano** (sin framework ni build: cada página carga sus scripts directamente).
- **Bootstrap 5.3.3** y **Bootstrap Icons 1.11.3**, desde cdnjs.
- **Google Fonts**: Space Grotesk, Inter e IBM Plex Mono.
- CSS propio en `css/styles.css`.

## Estructura

```
├── index.html          # Login
├── dashboard.html
├── agenda.html
├── pacientes.html
├── pagos.html
├── css/
│   └── styles.css
└── js/
    ├── api.js          # URL base, manejo del token, fetch con mensajes de error legibles y el objeto Api con todos los endpoints
    ├── ui.js           # Sidebar/topbar, toasts, badges de estado, formato de moneda/fechas, selectores de fecha y hora
    ├── dashboard.js
    ├── agenda.js
    ├── pacientes.js
    └── pagos.js
```

Todas las páginas protegidas llaman a `requireAuth()` al cargar: sin token, redirigen al login. Si la API responde 401, se borra el token y se vuelve al login.

## Cómo ejecutarlo en local

> ⚠️ **Apunta siempre a un backend local con una base de datos local y vacía, nunca al backend de producción.**

1. Levanta el backend DentalCore en local, siguiendo su README (por defecto en `http://localhost:8080`).
2. En `js/api.js`, cambia `API_BASE_URL` para que apunte a tu backend local:

   ```js
   const API_BASE_URL = "http://localhost:8080";
   ```

   El valor que está en el repositorio apunta al backend desplegado. **No hagas commit** de este cambio, a menos que sea eso lo que quieres desplegar.

3. Sirve la carpeta con cualquier servidor estático en el **puerto 5500**, que es el origen que el backend permite por CORS en local. Por ejemplo, con la extensión *Live Server* de VS Code, o con:

   ```bash
   npx serve -l 5500 .
   ```

4. Abre `http://localhost:5500/index.html`. Crea un usuario de prueba en tu backend local (`POST /users`) e inicia sesión con él.

## Capturas

> Pendiente. Las capturas deben tomarse **contra un backend local con datos ficticios** (por ejemplo "Paciente de Ejemplo", teléfono `3000000000`), nunca desde la instalación del consultorio.

| Pantalla | Qué mostrar (con datos ficticios) |
|---|---|
| ![Login](docs/screenshots/login.png) | Pantalla de login vacía. |
| ![Dashboard](docs/screenshots/dashboard.png) | Dashboard con algunas citas de ejemplo en distintos estados y un total recaudado inventado. |
| ![Agenda](docs/screenshots/agenda.png) | Agenda de un día con 3–4 citas ficticias y el marcador "AHORA". |
| ![Pacientes](docs/screenshots/pacientes.png) | Listado con 3–4 pacientes de ejemplo. |
| ![Pagos](docs/screenshots/pagos.png) | Historial de un paciente de ejemplo con un pago parcial y sus abonos desplegados. |

## Privacidad

- No hay demo pública ni credenciales en este repositorio.
- El código no contiene datos de pacientes. Todo lo que se muestra viene de la API en tiempo de ejecución.
- El token de sesión se guarda en `sessionStorage`, así que se pierde al cerrar la pestaña.
