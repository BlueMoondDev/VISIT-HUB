
import { supabase } from '../supabase.js';

const $ = (selector) => document.querySelector(selector);

const tableBody = $('#visits-table-body');
const message = $('#visits-message');
const dialog = $('#visit-dialog');

let visits = [];
let profiles = {};
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
  return String(value).replace(/[&<>"']/g, (char) => ({
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

async function checkAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    window.location.href = '../login.html';
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    window.location.href = '../user/dashboard.html';
    return null;
  }

  return user;
}

async function loadVisits() {
  showMessage('Cargando solicitudes...');

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
      admin_response,
      reviewed_by,
      reviewed_at,
      created_at
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    showMessage('No se pudieron cargar las solicitudes. Comprueba los permisos de Supabase.', true);
    return;
  }

  visits = data || [];

  const userIds = [...new Set(visits.map(visit => visit.user_id).filter(Boolean))];

  profiles = {};

  if (userIds.length) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', userIds);

    if (profileError) {
      console.error(profileError);
    } else {
      for (const profile of profileData || []) {
        profiles[profile.id] = profile;
      }
    }
  }

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
    const profile = profiles[visit.user_id];
    const username = profile?.display_name || profile?.username || '';

    const matchesStatus =
      activeStatus === 'all' || visit.status === activeStatus;

    const matchesSearch =
      (visit.title || '').toLowerCase().includes(search) ||
      username.toLowerCase().includes(search);

    return matchesStatus && matchesSearch;
  });

  tableBody.innerHTML = '';

  if (!filtered.length) {
    showMessage(
      visits.length
        ? 'No hay solicitudes que coincidan con la búsqueda.'
        : 'Todavía no se han recibido solicitudes.'
    );
    return;
  }

  showMessage(`${filtered.length} solicitud(es) encontradas.`);

  for (const visit of filtered) {
    const profile = profiles[visit.user_id];
    const username =
      profile?.display_name ||
      profile?.username ||
      'Usuario';

    const row = document.createElement('tr');

    row.innerHTML = `
      <td>
        <span class="visit-title">${escapeHTML(visit.title)}</span>
        <span class="visit-subtitle">ID: ${escapeHTML(visit.id)}</span>
      </td>

      <td>${escapeHTML(username)}</td>

      <td>${escapeHTML(categoryNames[visit.category] || visit.category || '—')}</td>

      <td>${escapeHTML(formatDate(visit.preferred_date))}</td>

      <td>
        <span class="status-pill status-${escapeHTML(visit.status)}">
          ${escapeHTML(statusNames[visit.status] || visit.status)}
        </span>
      </td>

      <td>
        <button class="view-button" data-id="${escapeHTML(visit.id)}">
          Ver detalles
        </button>
      </td>
    `;

    tableBody.appendChild(row);
  }
}

function openDetails(id) {
  selectedVisit = visits.find(visit => String(visit.id) === String(id));

  if (!selectedVisit) return;

  const visit = selectedVisit;
  const profile = profiles[visit.user_id];

  $('#detail-title').textContent = visit.title || 'Sin título';
  $('#detail-user').textContent =
    profile?.display_name || profile?.username || 'Usuario';
  $('#detail-category').textContent =
    categoryNames[visit.category] || visit.category || '—';
  $('#detail-date').textContent = formatDate(visit.preferred_date);
  $('#detail-time').textContent = visit.preferred_time || 'No especificada';
  $('#detail-status').textContent = statusNames[visit.status] || visit.status;
  $('#detail-created').textContent = formatDateTime(visit.created_at);
  $('#detail-reason').textContent = visit.reason || 'Sin descripción.';
  $('#detail-response').textContent =
    visit.admin_response || 'Sin respuesta todavía.';

  const isPending = visit.status === 'pending';

  $('#approve-button').hidden = !isPending;
  $('#reject-button').hidden = !isPending;

  dialog.showModal();
}

async function updateVisitStatus(status) {
  if (!selectedVisit) return;

  const user = await getCurrentAdmin();

  if (!user) return;

  const confirmation = status === 'approved'
    ? '¿Quieres aprobar esta solicitud?'
    : '¿Quieres rechazar esta solicitud?';

  if (!window.confirm(confirmation)) return;

  setActionsDisabled(true);

  const { error } = await supabase
    .from('visits')
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', selectedVisit.id)
    .eq('status', 'pending');

  setActionsDisabled(false);

  if (error) {
    console.error(error);
    alert('No se pudo actualizar la solicitud. Comprueba los permisos.');
    return;
  }

  dialog.close();
  selectedVisit = null;

  await loadVisits();
}

async function deleteVisit() {
  console.log('FUNCIÓN DELETEVISIT EJECUTADA');
  console.log('Solicitud seleccionada:', selectedVisit);

  if (!selectedVisit) {
    alert('No hay ninguna solicitud seleccionada.');
    return;
  }

  const visitId = selectedVisit.id;

  const confirmation = window.confirm(
    '¿Seguro que quieres eliminar esta solicitud? Esta acción no se puede deshacer.'
  );

  if (!confirmation) return;

  setActionsDisabled(true);

  try {
    const { data, error } = await supabase
      .from('visits')
      .delete()
      .eq('id', visitId)
      .select('id');

    if (error) {
      console.error('Error al eliminar:', error);
      alert(`Error al eliminar: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      alert('No se ha eliminado ninguna solicitud. Revisa los permisos de Supabase.');
      return;
    }

    dialog.close();
    selectedVisit = null;

    await loadVisits();

    alert('Solicitud eliminada correctamente.');

  } catch (error) {
    console.error(error);
    alert('Ha ocurrido un error inesperado al eliminar.');

  } finally {
    setActionsDisabled(false);
  }
}

async function getCurrentAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return null;

  return user;
}

function setActionsDisabled(disabled) {
  document.querySelectorAll('.dialog-actions button').forEach(button => {
    button.disabled = disabled;
  });
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

// Acciones
$('#approve-button').addEventListener('click', () => {
  updateVisitStatus('approved');
});

$('#reject-button').addEventListener('click', () => {
  updateVisitStatus('rejected');
});

$('#delete-button').addEventListener('click', deleteVisit);

$('#close-dialog').addEventListener('click', () => {
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
const admin = await checkAdmin();

if (admin) {
  await loadVisits();
}
