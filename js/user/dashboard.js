
import { supabase } from "../supabase.js";

const userName = document.getElementById("user-name");
const welcomeTitle = document.getElementById("welcome-title");
const logoutButton = document.getElementById("logout-button");

const pendingCount = document.getElementById("pending-count");
const approvedCount = document.getElementById("approved-count");
const rejectedCount = document.getElementById("rejected-count");
const totalCount = document.getElementById("total-count");

const nextVisitContent = document.getElementById("next-visit-content");
const recentVisitsContent = document.getElementById("recent-visits-content");
const dashboardMessage = document.getElementById("dashboard-message");

let currentUser = null;

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric"
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
});

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function formatDate(value) {
    if (!value) return "Fecha no especificada";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Fecha no disponible";
    }

    return dateFormatter.format(date);
}

function formatDateTime(value) {
    if (!value) return "Horario no especificado";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Horario no disponible";
    }

    return dateTimeFormatter.format(date);
}

function getStatusName(status) {
    const statuses = {
        pending: "Pendiente",
        approved: "Aprobada",
        rejected: "Rechazada",
        cancelled: "Cancelada"
    };

    return statuses[status] || "Desconocido";
}

function getStatusClass(status) {
    const classes = {
        pending: "status-pending",
        approved: "status-approved",
        rejected: "status-rejected",
        cancelled: "status-cancelled"
    };

    return classes[status] || "";
}

async function checkUser() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = "../login.html";
        return false;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, display_name, username")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
        console.error("Error obteniendo perfil:", profileError);
        window.location.href = "../login.html";
        return false;
    }

    if (profile.role === "admin") {
        window.location.href = "../admin/dashboard.html";
        return false;
    }

    if (profile.role !== "user") {
        window.location.href = "../login.html";
        return false;
    }

    currentUser = user;

    const displayName =
        profile.display_name || profile.username || "Usuario";

    userName.textContent = displayName;
    welcomeTitle.textContent = `¡Hola, ${displayName}!`;

    return true;
}

async function loadVisits() {
    const { data: visits, error } = await supabase
        .from("visits")
        .select(`
            id,
            title,
            category,
            preferred_date,
            preferred_time,
            status,
            scheduled_start,
            scheduled_end,
            created_at
        `)
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error cargando citas:", error);

        dashboardMessage.textContent =
            "No se pudieron cargar tus solicitudes. Inténtalo de nuevo.";

        nextVisitContent.innerHTML =
            '<p class="empty-text">No se pudo cargar la información.</p>';

        recentVisitsContent.innerHTML = "";

        return;
    }

    const allVisits = visits || [];

    // Estadísticas
    const pending = allVisits.filter(v => v.status === "pending").length;
    const approved = allVisits.filter(v => v.status === "approved").length;
    const rejected = allVisits.filter(v => v.status === "rejected").length;

    pendingCount.textContent = pending;
    approvedCount.textContent = approved;
    rejectedCount.textContent = rejected;
    totalCount.textContent = allVisits.length;

    renderNextVisit(allVisits);
    renderRecentVisits(allVisits);
}

function renderNextVisit(visits) {
    const now = Date.now();

    const upcomingVisits = visits
        .filter(visit => {
            if (visit.status !== "approved" || !visit.scheduled_start) {
                return false;
            }

            const start = new Date(visit.scheduled_start).getTime();

            return !Number.isNaN(start) && start >= now;
        })
        .sort((a, b) =>
            new Date(a.scheduled_start) - new Date(b.scheduled_start)
        );

    const nextVisit = upcomingVisits[0];

    if (!nextVisit) {
        nextVisitContent.innerHTML = `
            <p class="empty-text">
                Todavía no tienes ninguna visita confirmada próximamente.
            </p>
        `;
        return;
    }

    nextVisitContent.innerHTML = `
        <div class="next-visit-card">
            <h3>${escapeHTML(nextVisit.title)}</h3>

            <p>
                Categoría: ${escapeHTML(nextVisit.category)}
            </p>

            <p class="next-visit-date">
                ${escapeHTML(formatDateTime(nextVisit.scheduled_start))}
            </p>

            <a
                class="next-visit-link"
                href="visit-details.html?id=${encodeURIComponent(nextVisit.id)}"
            >
                Consultar detalles →
            </a>
        </div>
    `;
}

function renderRecentVisits(visits) {
    const recentVisits = visits.slice(0, 5);

    if (recentVisits.length === 0) {
        recentVisitsContent.innerHTML = `
            <p class="empty-text">
                Todavía no has realizado ninguna solicitud.
            </p>
        `;
        return;
    }

    recentVisitsContent.innerHTML = recentVisits.map(visit => `
        <div class="recent-visit">

            <div class="recent-visit-info">
                <h3>${escapeHTML(visit.title)}</h3>

                <p>
                    ${escapeHTML(formatDate(visit.created_at))}
                </p>
            </div>

            <span class="visit-status ${getStatusClass(visit.status)}">
                ${getStatusName(visit.status)}
            </span>

        </div>
    `).join("");
}

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error("Error cerrando sesión:", error);
        logoutButton.disabled = false;
        return;
    }

    window.location.href = "../login.html";
});

async function init() {
    const isValidUser = await checkUser();

    if (!isValidUser) return;

    await loadVisits();
}

init();
