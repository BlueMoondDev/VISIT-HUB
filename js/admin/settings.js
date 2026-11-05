
import { supabase } from "../supabase.js";

const telegramInput = document.getElementById("telegram-chat-id");
const emailInput = document.getElementById("notification-email");
const saveButton = document.getElementById("save-settings");
const message = document.getElementById("settings-message");
const logoutButton = document.getElementById("logout-button");
const adminName = document.getElementById("admin-name");

let currentUser = null;

function showMessage(text, type = "") {
    message.textContent = text;
    message.className = type;
}

async function checkAdmin() {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = "../login.html";
        return false;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, display_name, username")
        .eq("id", user.id)
        .single();

    if (profileError || profile?.role !== "admin") {
        console.error("Error verificando administrador:", profileError);
        window.location.href = "../login.html";
        return false;
    }

    currentUser = user;

    adminName.textContent =
        profile.display_name || profile.username || "Administrador";

    return true;
}

async function loadSettings() {
    showMessage("Cargando configuración...");

    const { data, error } = await supabase
        .from("notification_settings")
        .select("telegram_chat_id, notification_email")
        .eq("id", 1)
        .maybeSingle();

    if (error) {
        console.error("Error cargando configuración:", error);
        showMessage("Error al cargar la configuración.", "error");
        return;
    }

    telegramInput.value = data?.telegram_chat_id || "";
    emailInput.value = data?.notification_email || "";

    showMessage("");
}

async function saveSettings() {
    if (!currentUser) {
        showMessage("No se ha podido verificar tu sesión.", "error");
        return;
    }

    const telegramChatId = telegramInput.value.trim();
    const notificationEmail = emailInput.value.trim();

    if (notificationEmail && !emailInput.checkValidity()) {
        showMessage("Introduce un correo electrónico válido.", "error");
        emailInput.focus();
        return;
    }

    saveButton.disabled = true;
    showMessage("Guardando configuración...");

    try {
        const { data, error } = await supabase
            .from("notification_settings")
            .upsert({
                id: 1,
                telegram_chat_id: telegramChatId || null,
                notification_email: notificationEmail || null,
                updated_at: new Date().toISOString(),
                updated_by: currentUser.id
            }, {
                onConflict: "id"
            })
            .select("id, telegram_chat_id, notification_email, updated_at")
            .single();

        if (error) {
            console.error("Error de Supabase al guardar:", error);
            showMessage(`Error al guardar: ${error.message}`, "error");
            return;
        }

        // Comprobamos que Supabase ha devuelto los datos guardados.
        telegramInput.value = data.telegram_chat_id || "";
        emailInput.value = data.notification_email || "";

        console.log("Configuración guardada:", data);

        showMessage("Configuración guardada correctamente.", "success");

    } catch (error) {
        console.error("Error inesperado:", error);
        showMessage("Ha ocurrido un error inesperado.", "error");

    } finally {
        saveButton.disabled = false;
    }
}

saveButton.addEventListener("click", saveSettings);

logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "../login.html";
});

async function init() {
    const isAdmin = await checkAdmin();

    if (!isAdmin) return;

    await loadSettings();
}

init();
