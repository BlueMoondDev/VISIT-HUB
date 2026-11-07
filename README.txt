VISITHUB - FASE 1

Contenido:
- index.html: página principal.
- login.html / register.html: autenticación.
- js/supabase.js: cliente Supabase.
- js/auth.js: registro e inicio de sesión.
- css/global.css / css/auth.css: estilos.

INSTALACIÓN:
1. Descomprime la carpeta VisitHub_fase1.
2. Copia su contenido dentro de tu carpeta principal VisitHub, conservando las carpetas css y js.
3. Comprueba que js/supabase.js contiene tu Project URL y Publishable key.
4. Abre index.html con Live Server desde VS Code.

IMPORTANTE:
- No añadas nunca la Secret key al frontend.
- Si Supabase tiene activada la confirmación por correo, al registrarte tendrás que confirmar el email antes de iniciar sesión.
- El login redirige a dashboard.html, que construiremos en la siguiente fase. Por ahora todavía no existe.
- El trigger de perfiles debe leer los metadatos username y display_name que se envían en el registro.

APARIENCIA Y TEMAS
------------------
VisitHub incluye un selector global de apariencia en las barras laterales de las áreas privadas.
- Modos: claro y oscuro.
- Colores de acento: azul, lavanda, verde, rosa y turquesa.
- La selección se guarda en el navegador mediante localStorage y se mantiene al navegar entre páginas.

Archivos añadidos:
- js/theme.js: aplica y guarda las preferencias de apariencia.
- css/themes.css: paletas, controles y ajustes del modo oscuro.

No requiere cambios en Supabase ni nuevas columnas en la base de datos. La preferencia se guarda por navegador/dispositivo.
