
import { supabase } from '../supabase.js';
import { requireAdmin, logoutAdmin } from './guard.js';

const $ = (selector) => document.querySelector(selector);

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
  if (!value) return 'Sin fecha indicada';

  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function statusLabel(status) {
  const labels = {
    pending: 'Pendiente',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    cancelled: 'Cancelada'
  };

  return labels[status] || status;
}

function showError(message) {
  $('#dashboard-message').textContent = message;
}

async function loadStats() {
  const statuses = ['pending', 'approved', 'rejected'];

  const { count: total, error: totalError } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true });

  if (totalError) throw totalError;

  $('#stat-total').textContent = total ?? 0;

  for (const status of statuses) {
    const { count, error } = await supabase
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);

    if (error) throw error;

    const element = {
      pending: '#stat-pending',
      approved: '#stat-approved',
      rejected: '#stat-rejected'
    }[status];

    $(element).textContent = count ?? 0;
  }
}

async function loadPending() {
  const { data, error } = await supabase
    .from('visits')
    .select('id, title, category, preferred_date, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(6);

  if (error) throw error;

  const container = $('#pending-list');

  if (!data.length) {
    container.innerHTML =
      '<p class="empty-state">¡Todo al día! No tienes citas pendientes.</p>';
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Solicitud</th>
          <th>Categoría</th>
          <th>Fecha solicitada</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${data.map(visit => `
          <tr>
            <td><strong>${escapeHTML(visit.title)}</strong></td>
            <td>${escapeHTML(visit.category)}</td>
            <td>${formatDate(visit.preferred_date)}</td>
            <td>
              <a class="table-link"
                 href="visit-details.html?id=${encodeURIComponent(visit.id)}">
                Revisar
              </a>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function loadUpcoming() {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('visits')
    .select('id, title, scheduled_start, scheduled_end')
    .eq('status', 'approved')
    .not('scheduled_start', 'is', null)
    .gte('scheduled_start', now)
    .order('scheduled_start', { ascending: true })
    .limit(5);

  if (error) throw error;

  const container = $('#upcoming-list');

  if (!data.length) {
    container.innerHTML =
      '<p class="empty-state">Todavía no hay citas futuras programadas.</p>';
    return;
  }

  container.innerHTML = `
    <div class="upcoming-list">
      ${data.map(visit => `
        <a class="upcoming-item"
           href="visit-details.html?id=${encodeURIComponent(visit.id)}">
          <div>
            <strong>${escapeHTML(visit.title)}</strong>
            <small>${formatDate(visit.scheduled_start)}</small>
          </div>
          <span>${new Date(visit.scheduled_start).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          })}</span>
        </a>
      `).join('')}
    </div>
  `;
}

async function init() {
  const session = await requireAdmin();
  if (!session) return;

  $('#admin-name').textContent =
    session.profile.display_name || session.profile.username || 'Administrador';

  $('#logout-button').addEventListener('click', logoutAdmin);

  try {
    await Promise.all([
      loadStats(),
      loadPending(),
      loadUpcoming()
    ]);
  } catch (error) {
    console.error(error);
    showError('No se han podido cargar los datos. Comprueba las políticas RLS de Supabase.');
  }
}

init();
