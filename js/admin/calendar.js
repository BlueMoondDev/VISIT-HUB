
import { supabase } from '../supabase.js';

const $ = (selector) => document.querySelector(selector);

const calendarGrid = $('#calendar-grid');
const calendarMonth = $('#calendar-month');
const calendarMessage = $('#calendar-message');
const dialog = $('#calendar-dialog');

const eventDialog = $('#event-dialog');
const categoryDialog = $('#category-dialog');

let currentDate = new Date();
let currentAdmin = null;

let visits = [];
let visitsById = new Map();

let events = [];
let eventsById = new Map();

let categories = [];
let categoriesById = new Map();

const monthFormatter = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric'
});

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

// ==========================================
// UTILIDADES
// ==========================================

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

function formatDate(dateString) {
  if (!dateString) return 'Sin fecha';

  const [year, month, day] = dateString.split('-').map(Number);

  if (!year || !month || !day) return 'Sin fecha';

  return dateFormatter.format(new Date(year, month - 1, day));
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

function getEventTime(event) {
  if (!event.start_time) return 'Sin horario';

  const start = event.start_time.slice(0, 5);

  if (!event.end_time) return start;

  return `${start} - ${event.end_time.slice(0, 5)}`;
}

function getCategoryName(category) {
  const names = {
    informatica: 'Informática',
    hardware: 'Hardware',
    software: 'Software',
    gaming: 'Gaming',
    otros: 'Otros'
  };

  return names[category] || category || 'Sin categoría';
}

function showMessage(message, isError = false) {
  calendarMessage.textContent = message;
  calendarMessage.style.color = isError ? '#c85b65' : '';
}

function showFormMessage(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? '#c85b65' : '';
}

// ==========================================
// COMPROBAR ADMINISTRADOR
// ==========================================

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

// ==========================================
// CARGAR CITAS
// ==========================================

async function loadVisits() {
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
    showMessage('No se pudieron cargar las citas: ' + error.message, true);
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
}

// ==========================================
// CARGAR CATEGORÍAS
// ==========================================

async function loadCategories() {
  const { data, error } = await supabase
    .from('admin_event_categories')
    .select('id, name, color')
    .eq('admin_id', currentAdmin.id)
    .order('name');

  if (error) {
    console.error('Error cargando categorías:', error);
    showMessage('Error cargando categorías: ' + error.message, true);
    return;
  }

  categories = data || [];

  categoriesById = new Map(
    categories.map((category) => [String(category.id), category])
  );

  renderCategorySelect();
  renderCategoryList();
}

function renderCategorySelect() {
  const select = $('#event-category');
  const previousValue = select.value;

  select.innerHTML = `
    <option value="">Selecciona una categoría</option>
    ${categories.map((category) => `
      <option value="${escapeHTML(category.id)}">
        ${escapeHTML(category.name)}
      </option>
    `).join('')}
  `;

  if (categoriesById.has(previousValue)) {
    select.value = previousValue;
  }
}

function renderCategoryList() {
  const list = $('#category-list');

  if (categories.length === 0) {
    list.innerHTML = `
      <p class="category-empty">
        Todavía no tienes categorías. ¡Crea la primera!
      </p>
    `;
    return;
  }

  list.innerHTML = categories.map((category) => `
    <div class="category-item">
      <div class="category-item-info">
        <span
          class="category-color-dot"
          style="background:${escapeHTML(category.color)}"
        ></span>

        <span class="category-item-name">
          ${escapeHTML(category.name)}
        </span>
      </div>

      <div class="category-item-actions">
        <button
          type="button"
          data-edit-category="${escapeHTML(category.id)}"
        >Editar</button>

        <button
          type="button"
          data-delete-category="${escapeHTML(category.id)}"
        >Eliminar</button>
      </div>
    </div>
  `).join('');
}

// ==========================================
// CREAR Y GESTIONAR CATEGORÍAS
// ==========================================

$('#category-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = $('#category-name').value.trim();
  const color = $('#category-color').value;
  const message = $('#category-message');

  if (!name) {
    showFormMessage(message, 'Escribe un nombre.', true);
    return;
  }

  const { error } = await supabase
    .from('admin_event_categories')
    .insert({
      admin_id: currentAdmin.id,
      name,
      color
    });

  if (error) {
    console.error('Error creando categoría:', error);

    showFormMessage(
      message,
      error.code === '23505'
        ? 'Ya existe una categoría con ese nombre.'
        : 'No se pudo crear: ' + error.message,
      true
    );

    return;
  }

  $('#category-name').value = '';
  $('#category-color').value = '#79AEE8';

  showFormMessage(message, 'Categoría creada correctamente.');

  await loadCategories();
});

$('#category-list').addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit-category]');
  const deleteButton = event.target.closest('[data-delete-category]');

  if (editButton) {
    const category = categoriesById.get(editButton.dataset.editCategory);

    if (!category) return;

    const newName = prompt('Nuevo nombre:', category.name);

    if (newName === null) return;

    const name = newName.trim();

    if (!name) {
      alert('El nombre no puede estar vacío.');
      return;
    }

    const newColor = prompt(
      'Nuevo color hexadecimal (ejemplo: #79AEE8):',
      category.color
    );

    if (newColor === null) return;

    if (!/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
      alert('El color no tiene un formato válido.');
      return;
    }

    const { error } = await supabase
      .from('admin_event_categories')
      .update({ name, color: newColor })
      .eq('id', category.id)
      .eq('admin_id', currentAdmin.id);

    if (error) {
      alert('No se pudo actualizar la categoría: ' + error.message);
      return;
    }

    await loadCategories();
    await loadEvents();
    return;
  }

  if (deleteButton) {
    const category = categoriesById.get(deleteButton.dataset.deleteCategory);

    if (!category) return;

    if (!confirm(`¿Eliminar la categoría "${category.name}"?`)) return;

    const { error } = await supabase
      .from('admin_event_categories')
      .delete()
      .eq('id', category.id)
      .eq('admin_id', currentAdmin.id);

    if (error) {
      alert(
        'No se pudo eliminar. Comprueba si todavía tiene eventos asociados.\n\n' +
        error.message
      );
      return;
    }

    await loadCategories();
    await loadEvents();
  }
});

// ==========================================
// CARGAR EVENTOS PERSONALES
// ==========================================

async function loadEvents() {
  const { data, error } = await supabase
    .from('admin_events')
    .select(`
      id,
      title,
      description,
      category_id,
      event_date,
      start_time,
      end_time
    `)
    .eq('admin_id', currentAdmin.id)
    .order('event_date');

  if (error) {
    console.error('Error cargando eventos:', error);
    showMessage('Error cargando eventos: ' + error.message, true);
    return;
  }

  events = (data || []).map((event) => ({
    ...event,
    category: categoriesById.get(String(event.category_id)) || null
  }));

  eventsById = new Map(
    events.map((event) => [String(event.id), event])
  );
}

// ==========================================
// DIBUJAR CALENDARIO
// ==========================================

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  calendarMonth.textContent = monthFormatter.format(currentDate);

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const startingDay = (firstDay.getDay() + 6) % 7;

  const today = new Date();

  const todayKey = dateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const previousMonthDays = new Date(year, month, 0).getDate();

  let html = '';

  for (let i = 0; i < startingDay; i++) {
    const day = previousMonthDays - startingDay + i + 1;
    const date = new Date(year, month - 1, day);

    html += createDayHTML(
      day,
      dateKey(date.getFullYear(), date.getMonth(), day),
      true,
      todayKey
    );
  }

  for (let day = 1; day <= daysInMonth; day++) {
    html += createDayHTML(
      day,
      dateKey(year, month, day),
      false,
      todayKey
    );
  }

  const totalCells = startingDay + daysInMonth;
  const remainingCells = (7 - totalCells % 7) % 7;

  for (let day = 1; day <= remainingCells; day++) {
    const nextDate = new Date(year, month + 1, day);

    html += createDayHTML(
      day,
      dateKey(nextDate.getFullYear(), nextDate.getMonth(), day),
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

  const dayEvents = events.filter(
    (event) => event.event_date === key
  );

  const classes = ['calendar-day'];

  if (isOtherMonth) classes.push('other-month');
  if (key === todayKey) classes.push('today');

  const visitsHTML = dayVisits.map((visit) => {
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

  const eventsHTML = dayEvents.map((event) => {
    const color = /^#[0-9A-Fa-f]{6}$/.test(event.category?.color || '')
      ? event.category.color
      : '#79AEE8';

    return `
      <button
        type="button"
        class="calendar-event personal-event"
        style="--event-color:${color}"
        data-event-id="${escapeHTML(event.id)}"
        title="${escapeHTML(event.title)}"
      >
        <strong>${escapeHTML(event.title)}</strong>
        <small>${escapeHTML(getEventTime(event))}</small>
      </button>
    `;
  }).join('');

  return `
    <div class="${classes.join(' ')}">
      <div class="day-number">${day}</div>

      <div class="day-events">
        ${eventsHTML}
        ${visitsHTML}
        ${(!eventsHTML && !visitsHTML)
          ? '<span class="calendar-empty-day"></span>'
          : ''}
      </div>
    </div>
  `;
}

// ==========================================
// DETALLES DE CITAS
// ==========================================

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

// ==========================================
// CREAR Y EDITAR EVENTOS
// ==========================================

function resetEventForm() {
  $('#event-form').reset();

  $('#event-id').value = '';
  $('#event-dialog-title').textContent = 'Crear evento';
  $('#delete-event-button').hidden = true;

  $('#event-date').value = dateKey(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );

  $('#event-form-message').textContent = '';
}

function openCreateEvent() {
  resetEventForm();
  renderCategorySelect();

  if (categories.length === 0) {
    alert('Primero necesitas crear una categoría.');
    categoryDialog.showModal();
    return;
  }

  eventDialog.showModal();
}

function openEditEvent(event) {
  resetEventForm();
  renderCategorySelect();

  $('#event-id').value = event.id;
  $('#event-dialog-title').textContent = 'Editar evento';

  $('#event-title').value = event.title;
  $('#event-category').value = event.category_id;
  $('#event-date').value = event.event_date;
  $('#event-start').value = event.start_time || '';
  $('#event-end').value = event.end_time || '';
  $('#event-description').value = event.description || '';

  $('#delete-event-button').hidden = false;

  eventDialog.showModal();
}

$('#create-event-button').addEventListener('click', openCreateEvent);

$('#event-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const message = $('#event-form-message');

  const id = $('#event-id').value;
  const title = $('#event-title').value.trim();
  const categoryId = $('#event-category').value;
  const eventDate = $('#event-date').value;
  const startTime = $('#event-start').value || null;
  const endTime = $('#event-end').value || null;
  const description = $('#event-description').value.trim();

  if (!title || !categoryId || !eventDate) {
    showFormMessage(message, 'Completa los campos obligatorios.', true);
    return;
  }

  if (
    startTime &&
    endTime &&
    endTime <= startTime
  ) {
    showFormMessage(
      message,
      'La hora de finalización debe ser posterior a la de inicio.',
      true
    );
    return;
  }

  const eventData = {
    admin_id: currentAdmin.id,
    title,
    description: description || null,
    category_id: categoryId,
    event_date: eventDate,
    start_time: startTime,
    end_time: endTime
  };

  let result;

  if (id) {
    result = await supabase
      .from('admin_events')
      .update(eventData)
      .eq('id', id)
      .eq('admin_id', currentAdmin.id);
  } else {
    result = await supabase
      .from('admin_events')
      .insert(eventData);
  }

  if (result.error) {
    console.error('Error guardando evento:', result.error);

    showFormMessage(
      message,
      'No se pudo guardar el evento: ' + result.error.message,
      true
    );

    return;
  }

  eventDialog.close();

  await loadEvents();
  renderCalendar();

  showMessage(id ? 'Evento actualizado correctamente.' : 'Evento creado correctamente.');
});

// ==========================================
// ELIMINAR EVENTOS
// ==========================================

$('#delete-event-button').addEventListener('click', async () => {
  const id = $('#event-id').value;

  if (!id) return;

  const event = eventsById.get(String(id));

  if (!confirm(`¿Eliminar el evento "${event?.title || ''}"?`)) {
    return;
  }

  const { error } = await supabase
    .from('admin_events')
    .delete()
    .eq('id', id)
    .eq('admin_id', currentAdmin.id);

  if (error) {
    console.error('Error eliminando evento:', error);

    showFormMessage(
      $('#event-form-message'),
      'No se pudo eliminar: ' + error.message,
      true
    );

    return;
  }

  eventDialog.close();

  await loadEvents();
  renderCalendar();

  showMessage('Evento eliminado correctamente.');
});

// ==========================================
// ABRIR Y CERRAR VENTANAS
// ==========================================

$('#manage-categories-button').addEventListener('click', () => {
  eventDialog.close();
  $('#category-message').textContent = '';
  categoryDialog.showModal();
});

$('#close-event-dialog').addEventListener('click', () => {
  eventDialog.close();
});

$('#close-category-dialog').addEventListener('click', () => {
  categoryDialog.close();
});

eventDialog.addEventListener('click', (event) => {
  if (event.target === eventDialog) {
    eventDialog.close();
  }
});

categoryDialog.addEventListener('click', (event) => {
  if (event.target === categoryDialog) {
    categoryDialog.close();
  }
});

$('#create-event-button').addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

// ==========================================
// NAVEGACIÓN ENTRE MESES
// ==========================================

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

// ==========================================
// ABRIR CITAS Y EVENTOS
// ==========================================

calendarGrid.addEventListener('click', (event) => {
  const visitButton = event.target.closest('[data-visit-id]');
  const eventButton = event.target.closest('[data-event-id]');

  if (visitButton) {
    const visit = visitsById.get(visitButton.dataset.visitId);

    if (visit) openVisitDetails(visit);
    return;
  }

  if (eventButton) {
    const personalEvent = eventsById.get(eventButton.dataset.eventId);

    if (personalEvent) openEditEvent(personalEvent);
  }
});

// ==========================================
// CERRAR VENTANA DE CITAS
// ==========================================

$('#close-dialog').addEventListener('click', () => {
  dialog.close();
});

dialog.addEventListener('click', (event) => {
  if (event.target === dialog) {
    dialog.close();
  }
});

// ==========================================
// CERRAR SESIÓN
// ==========================================

$('#logout-button').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error cerrando sesión:', error);
    alert('No se pudo cerrar la sesión.');
    return;
  }

  window.location.href = '../login.html';
});

// ==========================================
// INICIAR CALENDARIO
// ==========================================

async function init() {
  calendarGrid.innerHTML =
    '<div class="calendar-loading">Cargando calendario...</div>';

  currentAdmin = await checkAdmin();

  if (!currentAdmin) return;

  await Promise.all([
    loadVisits(),
    loadCategories()
  ]);

  await loadEvents();

  renderCalendar();
}

init();
