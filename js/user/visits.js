
import { supabase } from '../supabase.js';

const $ = (selector) => document.querySelector(selector);

const tableBody = $('#visits-table-body');
const message = $('#visits-message');
const dialog = $('#visit-dialog');

let visits = [];
let activeStatus = 'all';
let selectedVisit = null;

const statusNames = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada'
};

const categoryNames = {
    informatica: 'Informática',
    hardware: 'Hardware',
    software: 'Software',
    gaming: 'Gaming',
    otros: 'Otros'
};

function escapeHTML(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[char]);
}

function formatDate(value) {
    if (!value) return 'No especificada';

    const date = new Date(`${value}T00:00:00`);

    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('es-ES');
}

function formatDateTime(value) {
    if (!value) return '—';

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? '—'
        : date.toLocaleString('es-ES');
}

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? '#b96e6e' : '';
}

async function checkUser() {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = '../login.html';
        return null;
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, username, display_name')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error(profileError);
        showMessage('No se pudo comprobar tu perfil.', true);
        return null;
    }

    if (profile.role !== 'user') {
        window.location.href = '../admin/dashboard.html';
        return null;
    }

    const userName = profile.display_name || profile.username || 'Usuario';

    const nameElement = $('#user-name');

    if (nameElement) {
        nameElement.textContent = userName;
    }

    return user;
}

async function loadVisits(user) {
    showMessage('Cargando tus solicitudes...');

    const { data, error } = await supabase
        .from('visits')
        .select(`
            id,
            title,
            category,
            reason,
            preferred_date,
            preferred_time,
            status,
            scheduled_start,
            scheduled_end,
            admin_response,
            created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        showMessage('No se pudieron cargar tus solicitudes.', true);
        return;
    }

    visits = data || [];

    updateStats();
    renderVisits();
}

function updateStats() {
    $('#total-count').textContent = visits.length;

    $('#pending-count').textContent =
        visits.filter(v => v.status === 'pending').length;

    $('#approved-count').textContent =
        visits.filter(v => v.status === 'approved').length;

    $('#rejected-count').textContent =
        visits.filter(v => v.status === 'rejected').length;
}

function renderVisits() {
    const search = $('#search-visits').value.trim().toLowerCase();

    const filtered = visits.filter(visit => {
        const matchesStatus =
            activeStatus === 'all' || visit.status === activeStatus;

        const matchesSearch =
            (visit.title || '').toLowerCase().includes(search) ||
            (visit.reason || '').toLowerCase().includes(search);

        return matchesStatus && matchesSearch;
    });

    tableBody.innerHTML = '';

    if (!filtered.length) {
        showMessage(
            visits.length
                ? 'No hay solicitudes que coincidan con tu búsqueda.'
                : 'Todavía no has enviado ninguna solicitud.'
        );
        return;
    }

    showMessage(`${filtered.length} solicitud(es) encontradas.`);

    for (const visit of filtered) {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>
                <span class="visit-title">
                    ${escapeHTML(visit.title || 'Sin título')}
                </span>
                <span class="visit-subtitle">
                    ID: ${escapeHTML(visit.id)}
                </span>
            </td>

            <td>
                ${escapeHTML(categoryNames[visit.category] || visit.category || '—')}
            </td>

            <td>
                ${escapeHTML(formatDate(visit.preferred_date))}
            </td>

            <td>
                <span class="status-pill status-${escapeHTML(visit.status)}">
                    ${escapeHTML(statusNames[visit.status] || visit.status)}
                </span>
            </td>

            <td>
                <button
                    type="button"
                    class="view-button"
                    data-id="${escapeHTML(visit.id)}"
                >
                    Ver detalles
                </button>
            </td>
        `;

        tableBody.appendChild(row);
    }
}

function openDetails(id) {
    selectedVisit = visits.find(
        visit => String(visit.id) === String(id)
    );

    if (!selectedVisit) return;

    const visit = selectedVisit;

    $('#detail-title').textContent = visit.title || 'Sin título';

    $('#detail-category').textContent =
        categoryNames[visit.category] || visit.category || '—';

    $('#detail-status').textContent =
        statusNames[visit.status] || visit.status;

    $('#detail-date').textContent =
        formatDate(visit.preferred_date);

    $('#detail-time').textContent =
        visit.preferred_time || 'No especificada';

    $('#detail-reason').textContent =
        visit.reason || 'Sin descripción.';

    $('#detail-response').textContent =
        visit.admin_response || 'Sin respuesta todavía.';

    if (visit.scheduled_start) {
        const scheduledStart = new Date(visit.scheduled_start);

        $('#detail-scheduled-date').textContent =
            scheduledStart.toLocaleDateString('es-ES');

        $('#detail-scheduled-time').textContent =
            scheduledStart.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit'
            });
    } else {
        $('#detail-scheduled-date').textContent = 'Sin asignar';
        $('#detail-scheduled-time').textContent = 'Sin asignar';
    }

    dialog.showModal();
}

// Filtros

document.querySelectorAll('.filter-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.filter-button').forEach(item => {
            item.classList.remove('active');
        });

        button.classList.add('active');

        activeStatus = button.dataset.status;

        renderVisits();
    });
});

// Búsqueda

$('#search-visits').addEventListener('input', renderVisits);

// Abrir detalles

tableBody.addEventListener('click', event => {
    const button = event.target.closest('.view-button');

    if (button) {
        openDetails(button.dataset.id);
    }
});

// Cerrar ventana

$('#close-dialog').addEventListener('click', () => {
    dialog.close();
});

$('#close-detail-button').addEventListener('click', () => {
    dialog.close();
});

dialog.addEventListener('click', event => {
    if (event.target === dialog) {
        dialog.close();
    }
});

// Cerrar sesión

$('#logout-button').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '../login.html';
});

// Inicio

const user = await checkUser();

if (user) {
    await loadVisits(user);
}
