
import { supabase } from './supabase.js';

const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');

function showMessage(message, type = 'error') {
  const element = document.querySelector('#form-message');
  if (!element) return;

  element.textContent = message;
  element.className = `form-message ${type}`;
}

function setFormLoading(form, loading, labelWhenLoading) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;

  if (loading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = labelWhenLoading;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Enviar';
  }
}

// Consulta el rol real guardado en Supabase.
async function getDashboardPath(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error('No se ha podido comprobar tu perfil. Comprueba que exista en Supabase.');
  }

  if (profile.role === 'admin') {
    return 'admin/dashboard.html';
  }

  if (profile.role === 'user') {
    return 'user/dashboard.html';
  }

  throw new Error('Tu cuenta no tiene un rol válido asignado.');
}

function getAuthError(message) {
  const text = message.toLowerCase();

  if (text.includes('invalid login credentials')) {
    return 'El correo o la contraseña no son correctos.';
  }

  if (text.includes('user already registered')) {
    return 'Ya existe una cuenta con ese correo.';
  }

  if (text.includes('password')) {
    return 'La contraseña no cumple los requisitos.';
  }

  if (text.includes('email')) {
    return 'Revisa que el correo electrónico sea válido.';
  }

  if (
    text.includes('duplicate key') ||
    text.includes('profiles_username_key')
  ) {
    return 'Ese nombre de usuario ya está en uso.';
  }

  return `No se ha podido completar la operación: ${message}`;
}

// INICIO DE SESIÓN
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    showMessage('');
    setFormLoading(loginForm, true, 'Entrando…');

    try {
      const formData = new FormData(loginForm);

      const email = String(formData.get('email')).trim();
      const password = String(formData.get('password'));

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      const destination = await getDashboardPath(data.user.id);

      window.location.href = destination;

    } catch (error) {
      showMessage(
        error.message.includes('perfil') ||
        error.message.includes('rol válido')
          ? error.message
          : getAuthError(error.message)
      );

      setFormLoading(loginForm, false);
    }
  });
}

// REGISTRO
if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    showMessage('');
    setFormLoading(registerForm, true, 'Creando cuenta…');

    try {
      const formData = new FormData(registerForm);

      const displayName = String(
        formData.get('display_name')
      ).trim();

      const username = String(
        formData.get('username')
      ).trim().toLowerCase();

      const email = String(formData.get('email')).trim();
      const password = String(formData.get('password'));

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: displayName
          }
        }
      });

      if (error) throw error;

      if (data.session) {
        showMessage('¡Cuenta creada! Redirigiendo…', 'success');

        // Toda cuenta nueva comienza como usuario normal.
        const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
        if (profileError || !profile) {
          showMessage('No se ha podido cargar tu perfil.');
          return;
        }
        
        if (profile.role === 'admin') {
          window.location.href = 'admin/dashboard.html';
        } else {
          window.location.href = 'user/dashboard.html';
        }
      } else {
        showMessage(
          'Cuenta creada. Revisa tu correo para confirmar el registro antes de iniciar sesión.',
          'success'
        );

        setFormLoading(registerForm, false);
      }

    } catch (error) {
      showMessage(getAuthError(error.message));
      setFormLoading(registerForm, false);
    }
  });
}
