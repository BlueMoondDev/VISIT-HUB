
import { supabase } from "../supabase.js";

// Elementos del formulario
const form = document.getElementById("new-visit-form");
const titleInput = document.getElementById("title");
const categoryInput = document.getElementById("category");
const reasonInput = document.getElementById("reason");
const dateInput = document.getElementById("preferred-date");
const timeInput = document.getElementById("preferred-time");

const submitButton = document.getElementById("submit-button");
const message = document.getElementById("form-message");
const successPanel = document.getElementById("success-panel");

const logoutButton = document.getElementById("logout-button");
const userName = document.getElementById("user-name");

let currentUser = null;

// Categorías permitidas por la base de datos
const allowedCategories = [
    "informatica",
    "hardware",
    "software",
    "gaming",
    "otros"
];

// Mensajes
function showMessage(text, type = "") {
    message.textContent = text;
    message.className = type;
}

// Fecha local para evitar problemas de zona horaria
function getLocalDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// No permitir fechas anteriores a hoy
dateInput.min = getLocalDate();

// Comprobar sesión y permisos
async function checkUser() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = "../login.html";
        return false;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, display_name, username")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
        console.error("Error obteniendo perfil:", profileError);
        window.location.href = "../login.html";
        return false;
    }

    // Evitar que un administrador utilice el formulario de usuario
    if (profile.role === "admin") {
        window.location.href = "../admin/dashboard.html";
        return false;
    }

    if (profile.role !== "user") {
        window.location.href = "../login.html";
        return false;
    }

    currentUser = user;

    userName.textContent =
        profile.display_name ||
        profile.username ||
        "Usuario";

    return true;
}

// Crear solicitud
async function createVisit(event) {
    event.preventDefault();

    if (!currentUser) {
        showMessage("No se ha podido verificar tu sesión.", "error");
        return;
    }

    const title = titleInput.value.trim();
    const category = categoryInput.value;
    const reason = reasonInput.value.trim();
    const preferredDate = dateInput.value;
    const preferredTime = timeInput.value;

    // Validaciones
    if (!title || !category || !reason || !preferredDate || !preferredTime) {
        showMessage("Completa todos los campos antes de continuar.", "error");
        return;
    }

    if (title.length > 100) {
        showMessage("El título no puede superar los 100 caracteres.", "error");
        return;
    }

    if (reason.length > 2000) {
        showMessage("La descripción no puede superar los 2000 caracteres.", "error");
        return;
    }

    if (!allowedCategories.includes(category)) {
        showMessage("Selecciona una categoría válida.", "error");
        return;
    }

    if (preferredDate < getLocalDate()) {
        showMessage("No puedes seleccionar una fecha anterior a hoy.", "error");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Enviando solicitud...";

    showMessage("");

    try {
        const { error } = await supabase
            .from("visits")
            .insert({
                user_id: currentUser.id,
                title: title,
                category: category,
                reason: reason,
                preferred_date: preferredDate,
                preferred_time: preferredTime,
                status: "pending"
            });

        if (error) {
            console.error("Error creando solicitud:", error);
            showMessage(
                "No se ha podido enviar la solicitud: " + error.message,
                "error"
            );
            return;
        }

        // Mostrar confirmación
        form.hidden = true;
        successPanel.hidden = false;

    } catch (error) {
        console.error("Error inesperado:", error);

        showMessage(
            "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
            "error"
        );

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Enviar solicitud →";
    }
}

// Eventos
form.addEventListener("submit", createVisit);

logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "../login.html";
});

// Inicialización
async function init() {
    const isUser = await checkUser();

    if (!isUser) return;
}

init();
