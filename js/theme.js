(() => {
  const STORAGE_KEY = 'visithub-appearance-v1';
  const themes = ['azul', 'lavanda', 'verde', 'rosa', 'turquesa'];
  const defaults = { mode: 'light', color: 'azul' };
  let settings = { ...defaults };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    settings.mode = saved.mode === 'dark' ? 'dark' : 'light';
    settings.color = themes.includes(saved.color) ? saved.color : 'azul';
  } catch (_) {}

  function apply() {
    const html = document.documentElement;
    html.dataset.theme = settings.mode;
    html.dataset.color = settings.color;
    html.style.colorScheme = settings.mode;
    document.querySelectorAll('[data-theme-mode]').forEach(button => {
      const active = button.dataset.themeMode === settings.mode;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-theme-color]').forEach(button => {
      const active = button.dataset.themeColor === settings.color;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
    });
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (_) {}
    apply();
  }

  function mountControls() {
    document.querySelectorAll('.theme-controls').forEach(panel => {
      panel.querySelectorAll('[data-theme-mode]').forEach(button => {
        button.addEventListener('click', () => {
          settings.mode = button.dataset.themeMode === 'dark' ? 'dark' : 'light';
          save();
        });
      });
      panel.querySelectorAll('[data-theme-color]').forEach(button => {
        button.addEventListener('click', () => {
          if (themes.includes(button.dataset.themeColor)) {
            settings.color = button.dataset.themeColor;
            save();
          }
        });
      });
    });
    apply();
  }

  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountControls, { once: true });
  else mountControls();
})();
