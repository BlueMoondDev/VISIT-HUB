import { supabase } from "../supabase.js";

export async function requireAdmin() {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    window.location.replace("../login.html");
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, role")
    .eq("id", authData.user.id)
    .single();

  if (error || !profile) {
    await supabase.auth.signOut();
    window.location.replace("../login.html");
    return null;
  }

  if (profile.role !== "admin") {
    window.location.replace("../user/dashboard.html");
    return null;
  }

  return {
    user: authData.user,
    profile,
  };
}

export async function logoutAdmin() {
  await supabase.auth.signOut();
  window.location.replace("../login.html");
}
