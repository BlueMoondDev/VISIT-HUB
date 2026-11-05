import { supabase } from '../supabase.js';

const $ = (selector) => document.querySelector(selector);

const calendarGrid = $('#calendar-grid');
const calendarMonth = $('#calendar-month');
const calendarMessage = $('#calendar-message');
const dialog = $('#calendar-dialog');

let currentDate = new Date();
let visits = [];
let visitsById = new Map();

const monthFormatter = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric'
});

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

function dateKey(year, month, day) {
  return [
    year,
    String(month + 1).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
}

function getVisitDate(visit) {
  if (visit.status === 'approved' && visit.scheduled_start) {
    const date = new Date(visit.scheduled_start);

    if (!Number.isNaN(date.getTime())) {
      return dateKey(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
    }
  }

  return visit.preferred_date;
}

function getVisitTime(visit) {
  if (visit.status === 'approved' && visit.scheduled_start) {
    const start = new Date(visit.scheduled_start);

    if (Number.isNaN(start.getTime())) return 'Horario pendiente';

    const startText = start.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });

    if (visit.scheduled_end) {
      const end = new Date(visit.scheduled_end);

      if (!Number.isNaN(end.getTime())) {
        const endText = end.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return `${startText} - ${endText}`;
      }
    }

    return startText;
  }

  return visit.preferred_time || 'Sin horario indicado';
}

function formatDate(dateString) {
  if (!dateString) return 'Sin fecha';

  const [year, month, day] = dateString.split('-').map(Number);

  if (!year || !month || !day) return 'Sin fecha';

  return dateFormatter.format(new Date(year, month - 1, day));
}

function getCategoryName(category) {
  const categories = {
    informatica: 'Informática',
    hardware: 'Hardware',
    software: 'Software',
    gaming: 'Gaming',
    otros: 'Otros'
  };

  return categories[category] || category || 'Sin categoría';
}

// COMPROBAR ADMINISTRADOR

async function checkAdmin() {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    window.location.href = '../login.html';
    return null;
  }

  const user = authData.user;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, display_name, username')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    window.location.href = '../user/dashboard.html';
    return null;
  }

  const adminName = $('#admin-name');

  if (adminName) {
    adminName.textContent =
      profile.display_name ||
      profile.username ||
      'Administrador';
  }

  return user;
}

// CARGAR CITAS

async function loadVisits() {
  calendarGrid.innerHTML =
    '<div class="calendar-loading">Cargando citas...</div>';

  calendarMessage.textContent = '';

  const { data, error } = await supabase
    .from('visits')
    .select(`
      id,
      user_id,
      title,
      category,
      reason,
      preferred_date,
      preferred_time,
      status,
      scheduled_start,
      scheduled_end,
      admin_response
    `)
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error cargando citas:', error);

    calendarGrid.innerHTML =
      '<div class="calendar-no-events">No se pudieron cargar las citas.</div>';

    calendarMessage.textContent = error.message;
    return;
  }

  const validVisits = (data || []).filter((visit) =>
    getVisitDate(visit)
  );

  const userIds = [...new Set(
    validVisits.map((visit) => visit.user_id).filter(Boolean)
  )];

  let profiles = [];

  if (userIds.length > 0) {
    const { data: profileData, error: usersError } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', userIds);

    if (usersError) {
      console.error('Error cargando usuarios:', usersError);
    } else {
      profiles = profileData || [];
    }
  }

  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile])
  );

  visits = validVisits.map((visit) => {
    const profile = profilesById.get(visit.user_id);

    return {
      ...visit,
      userName:
        profile?.display_name ||
        profile?.username ||
        'Usuario'
    };
  });

  visitsById = new Map(
    visits.map((visit) => [String(visit.id), visit])
  );

  renderCalendar();
}

// DIBUJAR CALENDARIO

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  calendarMonth.textContent = monthFormatter.format(currentDate);

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // El calendario comienza en lunes.
  const startingDay = (firstDay.getDay() + 6) % 7;

  const today = new Date();
  const todayKey = dateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const previousMonthDays = new Date(year, month, 0).getDate();

  let html = '';

  // Días del mes anterior.
  for (let i = 0; i < startingDay; i++) {
    const day = previousMonthDays - startingDay + i + 1;

    html += createDayHTML(
      day,
      dateKey(
        new Date(year, month - 1, day).getFullYear(),
        new Date(year, month - 1, day).getMonth(),
        day
      ),
      true,
      todayKey
    );
  }

  // Días del mes actual.
  for (let day = 1; day <= daysInMonth; day++) {
    html += createDayHTML(
      day,
      dateKey(year, month, day),
      false,
      todayKey
    );
  }

  // Completar la última semana.
  const totalCells = startingDay + daysInMonth;
  const remainingCells = (7 - totalCells % 7) % 7;

  for (let day = 1; day <= remainingCells; day++) {
    const nextDate = new Date(year, month + 1, day);

    html += createDayHTML(
      day,
      dateKey(
        nextDate.getFullYear(),
        nextDate.getMonth(),
        nextDate.getDate()
      ),
      true,
      todayKey
    );
  }

  calendarGrid.innerHTML = html;
}

function createDayHTML(day, key, isOtherMonth, todayKey) {
  const dayVisits = visits.filter(
    (visit) => getVisitDate(visit) === key
  );

  const classes = ['calendar-day'];

  if (isOtherMonth) classes.push('other-month');
  if (key === todayKey) classes.push('today');

  const eventsHTML = dayVisits.map((visit) => {
    const status = visit.status === 'approved'
      ? 'approved'
      : 'pending';

    return `
      <button
        type="button"
        class="calendar-event ${status}"
        data-visit-id="${escapeHTML(visit.id)}"
        title="${escapeHTML(visit.title)}"
      >
        <strong>${escapeHTML(visit.title)}</strong>
        <small>${escapeHTML(getVisitTime(visit))}</small>
      </button>
    `;
  }).join('');

  return `
    <div class="${classes.join(' ')}">
      <div class="day-number">${day}</div>

      <div class="day-events">
        ${eventsHTML || '<span class="calendar-empty-day"></span>'}
      </div>
    </div>
  `;
}

// MOSTRAR DETALLES

function openVisitDetails(visit) {
  $('#dialog-title').textContent = visit.title || 'Sin título';

  $('#dialog-status').textContent =
    visit.status === 'approved' ? 'Aprobada' : 'Pendiente';

  $('#dialog-user').textContent = visit.userName;
  $('#dialog-category').textContent =
    getCategoryName(visit.category);

  $('#dialog-date').textContent =
    formatDate(getVisitDate(visit));

  $('#dialog-time').textContent =
    getVisitTime(visit);

  $('#dialog-reason').textContent =
    visit.reason || 'Sin motivo indicado.';

  $('#dialog-response').textContent =
    visit.admin_response || 'Sin respuesta.';

  dialog.showModal();
}

// NAVEGACIÓN ENTRE MESES

$('#previous-month').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

$('#next-month').addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

$('#today-button').addEventListener('click', () => {
  currentDate = new Date();
  renderCalendar();
});

// ABRIR CITAS

calendarGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-visit-id]');

  if (!button) return;

  const visit = visitsById.get(button.dataset.visitId);

  if (visit) {
    openVisitDetails(visit);
  }
});

// CERRAR VENTANA

$('#close-dialog').addEventListener('click', () => {
  dialog.close();
});

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) {
    dialog.close();
  }
});

// CERRAR SESIÓN

$('#logout-button').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error cerrando sesión:', error);
    alert('No se pudo cerrar la sesión.');
    return;
  }

  window.location.href = '../login.html';
});

// INICIAR

async function init() {
  const user = await checkAdmin();

  if (!user) return;

  await loadVisits();
}

init();