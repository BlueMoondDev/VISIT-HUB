import { supabase } from '../supabase.js';

const $ = (selector) => document.querySelector(selector);

const visitId = new URLSearchParams(window.location.search).get('id');

let currentUser = null;
let currentVisit = null;

function setMessage(message, type = '') {
  const element = $('#action-message');
  element.textContent = message;
  element.className = `action-message ${type}`;
}

function formatDate(value) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function formatDateTime(value) {
  if (!value) return 'Sin asignar';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Sin asignar';

  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTime(value) {
  if (!value) return 'Sin horario';

  return String(value).slice(0, 5);
}

function toLocalDateTimeInput(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 16);
}

function getStatusName(status) {
  const statuses = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada'
  };

  return statuses[status] || status;
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

// COMPROBAR ACCESO ADMINISTRATIVO

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

  $('#admin-name').textContent =
    profile.display_name ||
    profile.username ||
    'Administrador';

  return user;
}

// CARGAR VISITA Y USUARIO

async function loadVisit() {
  if (!visitId) {
    throw new Error('No se ha indicado el identificador de la visita.');
  }

  const { data: visit, error } = await supabase
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
      admin_response,
      reviewed_at,
      created_at
    `)
    .eq('id', visitId)
    .single();

  if (error) throw error;

  currentVisit = visit;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('id', visit.user_id)
    .single();

  if (profileError) {
    console.error('No se pudo cargar el perfil:', profileError);
  }

  renderVisit(visit, profile);
}

// MOSTRAR INFORMACIÓN

function renderVisit(visit, profile) {
  $('#visit-title').textContent = visit.title || 'Visita sin título';

  $('#visit-subtitle').textContent =
    `Solicitud registrada el ${formatDate(visit.created_at)}`;

  const status = $('#visit-status');
  status.textContent = getStatusName(visit.status);
  status.className = `status-badge ${visit.status}`;

  $('#visit-category').textContent =
    getCategoryName(visit.category);

  $('#visit-created').textContent =
    formatDateTime(visit.created_at);

  $('#visit-preferred-date').textContent =
    formatDate(visit.preferred_date);

  $('#visit-preferred-time').textContent =
    formatTime(visit.preferred_time);

  $('#visit-reason').textContent =
    visit.reason || 'No se ha indicado ningún motivo.';

  $('#user-name').textContent =
    profile?.display_name || 'Sin nombre';

  $('#user-username').textContent =
    profile?.username ? `@${profile.username}` : 'Sin username';

  $('#user-id').textContent = visit.user_id || 'No disponible';

  $('#admin-response').value = visit.admin_response || '';

  $('#scheduled-start').value =
    toLocalDateTimeInput(visit.scheduled_start);

  $('#scheduled-end').value =
    toLocalDateTimeInput(visit.scheduled_end);

  $('#summary-status').textContent = getStatusName(visit.status);

  $('#summary-date').textContent =
    formatDateTime(visit.scheduled_start);

  $('#summary-time').textContent =
    visit.scheduled_start
      ? `${formatTime(new Date(visit.scheduled_start).toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit'
        }))} - ${formatTime(new Date(visit.scheduled_end).toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit'
        }))}`
      : 'Sin asignar';

  $('#summary-reviewed').textContent =
    formatDateTime(visit.reviewed_at);

  const isPending = visit.status === 'pending';

  $('#pending-actions').hidden = !isPending;
  $('#scheduled-fields').hidden = !isPending;

  $('#visit-content').hidden = false;
}

// APROBAR VISITA

async function approveVisit() {
  if (currentVisit.status !== 'pending') return;

  const startValue = $('#scheduled-start').value;
  const endValue = $('#scheduled-end').value;

  if (!startValue || !endValue) {
    setMessage('Debes indicar el inicio y el final de la visita.', 'error');
    return;
  }

  const start = new Date(startValue);
  const end = new Date(endValue);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    setMessage('El horario de finalización debe ser posterior al inicio.', 'error');
    return;
  }

  const button = $('#approve-button');
  button.disabled = true;
  setMessage('Guardando aprobación...');

  const { error } = await supabase
    .from('visits')
    .update({
      status: 'approved',
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      admin_response: $('#admin-response').value.trim() || null,
      reviewed_by: currentUser.id,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', currentVisit.id)
    .eq('status', 'pending');

  button.disabled = false;

  if (error) {
    console.error(error);
    setMessage('No se pudo aprobar la visita: ' + error.message, 'error');
    return;
  }

  alert('La visita se ha aprobado correctamente.');
  window.location.href = 'visits.html';
}

// RECHAZAR VISITA

async function rejectVisit() {
  if (currentVisit.status !== 'pending') return;

  const confirmed = confirm(
    '¿Seguro que quieres rechazar esta solicitud?'
  );

  if (!confirmed) return;

  const button = $('#reject-button');
  button.disabled = true;
  setMessage('Guardando rechazo...');

  const { error } = await supabase
    .from('visits')
    .update({
      status: 'rejected',
      admin_response: $('#admin-response').value.trim() || null,
      reviewed_by: currentUser.id,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', currentVisit.id)
    .eq('status', 'pending');

  button.disabled = false;

  if (error) {
    console.error(error);
    setMessage('No se pudo rechazar la visita: ' + error.message, 'error');
    return;
  }

  alert('La solicitud se ha rechazado.');
  window.location.href = 'visits.html';
}

// ELIMINAR VISITA

async function deleteVisit() {
  const confirmed = confirm(
    '¿Seguro que quieres eliminar esta visita? Esta acción no se puede deshacer.'
  );

  if (!confirmed) return;

  const button = $('#delete-button');
  button.disabled = true;
  setMessage('Eliminando visita...');

  const { error } = await supabase
    .from('visits')
    .delete()
    .eq('id', currentVisit.id);

  button.disabled = false;

  if (error) {
    console.error(error);
    setMessage('No se pudo eliminar la visita: ' + error.message, 'error');
    return;
  }

  alert('La visita se ha eliminado.');
  window.location.href = 'visits.html';
}

// EVENTOS

$('#approve-button').addEventListener('click', approveVisit);
$('#reject-button').addEventListener('click', rejectVisit);
$('#delete-button').addEventListener('click', deleteVisit);

$('#logout-button').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert('No se pudo cerrar la sesión.');
    return;
  }

  window.location.href = '../login.html';
});

// INICIO

async function init() {
  try {
    currentUser = await checkAdmin();

    if (!currentUser) return;

    await loadVisit();
  } catch (error) {
    console.error('Error cargando el detalle:', error);

    $('#detail-error').textContent =
      error.message || 'No se pudo cargar la visita.';

    $('#detail-error').hidden = false;
    $('#visit-title').textContent = 'No se pudo cargar la visita';
  }
}

init();