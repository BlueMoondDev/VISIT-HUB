
import { supabase } from '../supabase.js';

const $ = (selector) => document.querySelector(selector);

const calendarDays = $('#calendar-days');
const monthTitle = $('#calendar-month');
const appointmentsList = $('#appointments-list');
const dialog = $('#calendar-dialog');

let visits = [];
let currentDate = new Date();
let selectedDate = null;

const statusNames = {
    pending: 'Pendiente',
    approved: 'Confirmada',
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

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function formatDate(value) {
    if (!value) return 'No especificada';

    const date = new Date(`${value}T00:00:00`);

    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('es-ES');
}

function formatTime(value) {
    if (!value) return 'Sin horario';

    return value.slice(0, 5);
}

function getVisitDate(visit) {
    if (visit.status === 'approved' && visit.scheduled_start) {
        return dateKey(new Date(visit.scheduled_start));
    }

    if (visit.status === 'pending' && visit.preferred_date) {
        return visit.preferred_date;
    }

    return null;
}

function getVisitTime(visit) {
    if (visit.status === 'approved' && visit.scheduled_start) {
        return new Date(visit.scheduled_start).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    return formatTime(visit.preferred_time);
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
        $('#calendar-message').textContent = 'No se pudo comprobar tu perfil.';
        return null;
    }

    if (profile.role !== 'user') {
        window.location.href = '../admin/dashboard.html';
        return null;
    }

    $('#user-name').textContent =
        profile.display_name || profile.username || 'Usuario';

    return user;
}

async function loadVisits(user) {
    calendarDays.innerHTML = `
        <div class="calendar-loading">Cargando calendario...</div>
    `;

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
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        $('#calendar-message').textContent =
            'No se pudieron cargar tus citas.';
        calendarDays.innerHTML = '';
        appointmentsList.innerHTML = '';
        return;
    }

    visits = data || [];

    renderCalendar();
    renderAppointments();
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthTitle.textContent = currentDate.toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric'
    });

    const firstDay = new Date(year, month, 1);
    const startDay = (firstDay.getDay() + 6) % 7;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

    const todayKey = dateKey(new Date());

    calendarDays.innerHTML = '';

    for (let i = 0; i < totalCells; i++) {
        const dayDate = new Date(year, month, 1 - startDay + i);
        const key = dateKey(dayDate);

        const isCurrentMonth = dayDate.getMonth() === month;
        const isToday = key === todayKey;
        const isSelected = key === selectedDate;

        const dayVisits = visits.filter(
            visit => getVisitDate(visit) === key
        );

        const cell = document.createElement('div');

        cell.className = 'calendar-day';

        if (!isCurrentMonth) cell.classList.add('other-month');
        if (isToday) cell.classList.add('today');
        if (isSelected) cell.classList.add('selected');

        const eventsHTML = dayVisits.map(visit => `
            <button
                type="button"
                class="calendar-event ${escapeHTML(visit.status)}"
                data-id="${escapeHTML(visit.id)}"
                title="${escapeHTML(visit.title)}"
            >
                ${escapeHTML(getVisitTime(visit))} · ${escapeHTML(visit.title)}
            </button>
        `).join('');

        cell.innerHTML = `
            <span class="day-number">${dayDate.getDate()}</span>
            <div class="calendar-events">
                ${eventsHTML}
            </div>
        `;

        cell.addEventListener('click', event => {
            const button = event.target.closest('.calendar-event');

            if (button) {
                event.stopPropagation();
                openDetails(button.dataset.id);
                return;
            }

            selectedDate = key;
            renderCalendar();
        });

        calendarDays.appendChild(cell);
    }
}

function renderAppointments() {
    const todayKey = dateKey(new Date());

    const upcoming = visits
        .filter(visit => {
            const date = getVisitDate(visit);
            return date && date >= todayKey;
        })
        .sort((a, b) => {
            return getVisitDate(a).localeCompare(getVisitDate(b));
        });

    if (!upcoming.length) {
        appointmentsList.innerHTML = `
            <div class="appointment-empty">
                No tienes citas próximas.
            </div>
        `;
        return;
    }

    appointmentsList.innerHTML = upcoming.map(visit => `
        <article class="appointment-card">
            <div class="appointment-info">
                <h3>${escapeHTML(visit.title || 'Sin título')}</h3>
                <p>
                    ${escapeHTML(formatDate(getVisitDate(visit)))} ·
                    ${escapeHTML(getVisitTime(visit))}
                </p>
                <p>
                    ${escapeHTML(categoryNames[visit.category] || visit.category || '—')}
                </p>
            </div>

            <span class="status-pill status-${escapeHTML(visit.status)}">
                ${escapeHTML(statusNames[visit.status])}
            </span>
        </article>
    `).join('');

    appointmentsList.querySelectorAll('.appointment-card').forEach((card, index) => {
        card.style.cursor = 'pointer';

        card.addEventListener('click', () => {
            openDetails(upcoming[index].id);
        });
    });
}

function openDetails(id) {
    const visit = visits.find(
        item => String(item.id) === String(id)
    );

    if (!visit) return;

    $('#calendar-detail-title').textContent =
        visit.title || 'Sin título';

    $('#calendar-detail-category').textContent =
        categoryNames[visit.category] || visit.category || '—';

    $('#calendar-detail-status').textContent =
        statusNames[visit.status] || visit.status;

    $('#calendar-detail-preferred-date').textContent =
        formatDate(visit.preferred_date);

    $('#calendar-detail-preferred-time').textContent =
        formatTime(visit.preferred_time);

    $('#calendar-detail-reason').textContent =
        visit.reason || 'Sin descripción.';

    $('#calendar-detail-response').textContent =
        visit.admin_response || 'Sin respuesta todavía.';

    if (visit.status === 'approved' && visit.scheduled_start) {
        const start = new Date(visit.scheduled_start);

        $('#calendar-detail-date').textContent =
            start.toLocaleDateString('es-ES');

        $('#calendar-detail-time').textContent =
            start.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit'
            });

        if (visit.scheduled_end) {
            const end = new Date(visit.scheduled_end);

            $('#calendar-detail-time').textContent +=
                ' - ' + end.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
        }
    } else {
        $('#calendar-detail-date').textContent = 'Pendiente de asignación';
        $('#calendar-detail-time').textContent = 'Pendiente de asignación';
    }

    dialog.showModal();
}

// Navegación entre meses

$('#prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    selectedDate = null;
    renderCalendar();
});

$('#next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    selectedDate = null;
    renderCalendar();
});

$('#today-button').addEventListener('click', () => {
    currentDate = new Date();
    selectedDate = dateKey(currentDate);
    renderCalendar();
});

// Cerrar detalles

$('#close-calendar-dialog').addEventListener('click', () => {
    dialog.close();
});

$('#close-calendar-detail').addEventListener('click', () => {
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
