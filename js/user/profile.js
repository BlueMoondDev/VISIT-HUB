
import { supabase } from '../supabase.js';

// Elementos HTML
const profileForm = document.querySelector('#profile-form');
const displayNameInput = document.querySelector('#display-name');
const usernameInput = document.querySelector('#username');
const emailInput = document.querySelector('#email');
const createdAtInput = document.querySelector('#created-at');

const profileDisplayName = document.querySelector('#profile-display-name');
const profileUsername = document.querySelector('#profile-username');
const profileAvatar = document.querySelector('#profile-avatar');
const sidebarUserName = document.querySelector('#user-name');

const profileMessage = document.querySelector('#profile-message');
const saveButton = document.querySelector('#save-profile');
const resetButton = document.querySelector('#reset-profile');
const logoutButton = document.querySelector('#logout-button');

let originalDisplayName = '';


// Mostrar mensajes
function showMessage(message, type) {
    profileMessage.textContent = message;
    profileMessage.className = `profile-message ${type}`;
}


// Actualizar la información visual
function updateProfileDisplay(name, username) {
    const finalName = name || username || 'Usuario';

    profileDisplayName.textContent = finalName;
    profileUsername.textContent = `@${username || 'usuario'}`;
    profileAvatar.textContent = finalName.charAt(0).toUpperCase();
    sidebarUserName.textContent = finalName;
}


// Cargar perfil
async function loadProfile() {
    try {
        const { data: { user }, error: authError } =
            await supabase.auth.getUser();

        if (authError || !user) {
            window.location.href = '../index.html';
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('username, display_name, role, created_at')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Error al cargar el perfil:', profileError);
            showMessage('No se pudo cargar la información del perfil.', 'error');
            return;
        }

        // Evitar que los administradores entren en esta página
        if (profile.role === 'admin') {
            window.location.href = '../admin/dashboard.html';
            return;
        }

        // Guardar los datos originales
        originalDisplayName = profile.display_name || '';

        // Rellenar formulario
        displayNameInput.value = originalDisplayName;
        usernameInput.value = profile.username || '';
        emailInput.value = user.email || '';

        // Formatear fecha
        if (profile.created_at) {
            createdAtInput.value = new Date(profile.created_at)
                .toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                });
        } else {
            createdAtInput.value = 'No disponible';
        }

        updateProfileDisplay(
            profile.display_name,
            profile.username
        );

    } catch (error) {
        console.error('Error inesperado:', error);
        showMessage('Ha ocurrido un error al cargar tu perfil.', 'error');
    }
}


// Guardar cambios
async function saveProfile(event) {
    event.preventDefault();

    const newDisplayName = displayNameInput.value.trim();

    if (!newDisplayName) {
        showMessage('El nombre visible no puede estar vacío.', 'error');
        return;
    }

    if (newDisplayName.length > 60) {
        showMessage('El nombre visible no puede superar los 60 caracteres.', 'error');
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Guardando...';

    try {
        const { data: { user }, error: authError } =
            await supabase.auth.getUser();

        if (authError || !user) {
            showMessage('Tu sesión ha caducado. Vuelve a iniciar sesión.', 'error');
            return;
        }

        const { error } = await supabase
            .from('profiles')
            .update({
                display_name: newDisplayName
            })
            .eq('id', user.id);

        if (error) {
            console.error('Error al guardar:', error);
            showMessage('No se pudieron guardar los cambios.', 'error');
            return;
        }

        originalDisplayName = newDisplayName;

        updateProfileDisplay(
            newDisplayName,
            usernameInput.value
        );

        showMessage('¡Tu perfil se ha actualizado correctamente!', 'success');

    } catch (error) {
        console.error('Error inesperado:', error);
        showMessage('Ha ocurrido un error al guardar los cambios.', 'error');

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Guardar cambios';
    }
}


// Descartar cambios
function resetProfile() {
    displayNameInput.value = originalDisplayName;

    showMessage('', '');

    profileMessage.style.display = 'none';
}


// Cerrar sesión
async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error('Error al cerrar sesión:', error);
        showMessage('No se pudo cerrar la sesión.', 'error');
        return;
    }

    window.location.href = '../index.html';
}


// Eventos
profileForm.addEventListener('submit', saveProfile);
resetButton.addEventListener('click', resetProfile);
logoutButton.addEventListener('click', logout);


// Inicializar página
loadProfile();
