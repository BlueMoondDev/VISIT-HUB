import { supabase } from '../supabase.js';

const $ = (selector) => document.querySelector(selector);

const tableBody = $('#users-table-body');
const searchInput = $('#user-search');
const emptyState = $('#users-empty');
const userDialog = $('#user-dialog');

let users = [];
let userVisits = [];
let visitsByUser = new Map();

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

function formatDate(value) {
  if (!value) return 'Sin fecha';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Sin fecha';

  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

function getInitial(name) {
  return String(name || 'U').trim().charAt(0).toUpperCase();
}

function getStatusName(status) {
  const statuses = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada'
  };

  return statuses[status] || 'Desconocido';
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

function getVisitDate(visit) {
  if (visit.status === 'approved' && visit.scheduled_start) {
    return formatDate(visit.scheduled_start);
  }

  return formatDate(visit.preferred_date);
}

function getVisitTime(visit) {
  if (visit.status === 'approved' && visit.scheduled_start) {
    const start = new Date(visit.scheduled_start);

    if (Number.isNaN(start.getTime())) {
      return 'Horario pendiente';
    }

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

  return visit.preferred_time || 'Sin horario';
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

// CARGAR USUARIOS Y CITAS

async function loadUsers() {
  tableBody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-state">
        Cargando usuarios...
      </td>
    </tr>
  `;

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name, created_at')
    .eq('role', 'user')
    .order('created_at', { ascending: false });

  if (profileError) {
    console.error('Error cargando usuarios:', profileError);

    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          No se pudieron cargar los usuarios.
        </td>
      </tr>
    `;

    $('#users-message').textContent = profileError.message;
    return;
  }

  users = profileData || [];

  const userIds = users.map((user) => user.id);

  userVisits = [];
  visitsByUser = new Map();

  // Consultar las citas de los usuarios normales.
  if (userIds.length > 0) {
    const { data: visitData, error: visitsError } = await supabase
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
        created_at
      `)
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    if (visitsError) {
      console.error('Error cargando citas:', visitsError);
      $('#users-message').textContent =
        'Los usuarios se han cargado, pero no se pudieron consultar sus citas.';
    } else {
      userVisits = visitData || [];
    }
  }

  for (const visit of userVisits) {
    if (!visitsByUser.has(visit.user_id)) {
      visitsByUser.set(visit.user_id, []);
    }

    visitsByUser.get(visit.user_id).push(visit);
  }

  renderStats();
  renderUsers();
}

// ESTADÍSTICAS

function renderStats() {
  const totalVisits = userVisits.length;

  const activeUsers = users.filter(
    (user) => (visitsByUser.get(user.id) || []).length > 0
  ).length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const newUsers = users.filter((user) => {
    if (!user.created_at) return false;

    const createdAt = new Date(user.created_at);

    return !Number.isNaN(createdAt.getTime()) &&
      createdAt >= thirtyDaysAgo;
  }).length;

  $('#total-users').textContent = users.length;
  $('#total-user-visits').textContent = totalVisits;
  $('#active-users').textContent = activeUsers;
  $('#new-users').textContent = newUsers;
}

// DIBUJAR TABLA

function renderUsers() {
  const search = searchInput.value.trim().toLowerCase();

  const filteredUsers = users.filter((user) => {
    const name = user.display_name || '';
    const username = user.username || '';

    return name.toLowerCase().includes(search) ||
      username.toLowerCase().includes(search);
  });

  emptyState.hidden = filteredUsers.length > 0;

  if (filteredUsers.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          No hay resultados.
        </td>
      </tr>
    `;
  } else {
    tableBody.innerHTML = filteredUsers.map((user) => {
      const name = user.display_name || user.username || 'Usuario';
      const username = user.username
        ? `@${user.username}`
        : 'Sin username';

      const visits = visitsByUser.get(user.id) || [];
      const visitCount = visits.length;

      return `
        <tr>
          <td>
            <div class="user-cell">
              <div class="user-avatar">
                ${escapeHTML(getInitial(name))}
              </div>

              <div class="user-cell-info">
                <strong>${escapeHTML(name)}</strong>
                <small>Usuario de VisitHub</small>
              </div>
            </div>
          </td>

          <td>${escapeHTML(username)}</td>

          <td>${escapeHTML(formatDate(user.created_at))}</td>

          <td>
            <span class="user-visit-count">${visitCount}</span>
          </td>

          <td>
            <span class="user-activity ${visitCount > 0 ? 'active' : ''}">
              ${visitCount > 0 ? 'Con actividad' : 'Sin actividad'}
            </span>
          </td>

          <td>
            <button
              type="button"
              class="user-detail-button"
              data-user-id="${escapeHTML(user.id)}"
            >
              Ver ficha
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  $('#users-count').textContent =
    `Mostrando ${filteredUsers.length} de ${users.length} usuarios`;
}

// ABRIR FICHA

function openUserDetails(userId) {
  const user = users.find((item) => item.id === userId);

  if (!user) return;

  const name = user.display_name || user.username || 'Usuario';
  const username = user.username ? `@${user.username}` : 'Sin username';

  const visits = visitsByUser.get(user.id) || [];

  $('#dialog-avatar').textContent = getInitial(name);
  $('#dialog-name').textContent = name;
  $('#dialog-username').textContent = username;
  $('#dialog-created').textContent = formatDate(user.created_at);
  $('#dialog-visits-count').textContent = visits.length;

  renderUserHistory(visits);

  userDialog.showModal();
}

// HISTORIAL

function renderUserHistory(visits) {
  const history = $('#dialog-visits');

  if (visits.length === 0) {
    history.innerHTML = `
      <p class="empty-state">
        Este usuario todavía no ha solicitado ninguna cita.
      </p>
    `;

    return;
  }

  history.innerHTML = visits.map((visit) => `
    <article class="user-history-item">
      <div class="user-history-item-header">
        <strong>${escapeHTML(visit.title || 'Sin título')}</strong>

        <span class="history-status ${escapeHTML(visit.status)}">
          ${escapeHTML(getStatusName(visit.status))}
        </span>
      </div>

      <p>
        ${escapeHTML(getCategoryName(visit.category))}
        · ${escapeHTML(getVisitDate(visit))}
        · ${escapeHTML(getVisitTime(visit))}
      </p>

      <p>
        ${escapeHTML(visit.reason || 'Sin motivo indicado.')}
      </p>
    </article>
  `).join('');
}

// BUSCADOR

searchInput.addEventListener('input', renderUsers);

// CLIC EN VER FICHA

tableBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-user-id]');

  if (!button) return;

  openUserDetails(button.dataset.userId);
});

// CERRAR FICHA

$('#close-user-dialog').addEventListener('click', () => {
  userDialog.close();
});

$('#close-user-dialog-bottom').addEventListener('click', () => {
  userDialog.close();
});

userDialog.addEventListener('click', (event) => {
  if (event.target === userDialog) {
    userDialog.close();
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

  await loadUsers();
}

init();