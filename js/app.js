// ==========================================
// 1. INICIALIZACIÓN DE SUPABASE (ÁMBITO GLOBAL SEGURO)
// ==========================================
window.SUPABASE_URL = 'https://ayyieaupiltisnrabdzn.supabase.co';
window.SUPABASE_KEY = 'sb_publishable_xQgcJLM_vUCl6XFyjqxN8g_uufrwBgl';

if (!window.db) {
  window.db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
}
var db = window.db;

// ==========================================
// 2. FUNCIONES DE AUTENTICACIÓN Y ROLES (SUPABASE)
// ==========================================

window.botonLogin = async function() {
  const emailInput = document.getElementById('input-email');
  const passInput = document.getElementById('input-pass');

  if (!emailInput || !passInput) return;

  const email = emailInput.value.trim();
  const password = passInput.value.trim();

  if (!email || !password) {
    alert("Por favor completa correo y contraseña");
    return;
  }

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    alert("Error al iniciar sesión: " + error.message);
  }
};

window.cerrarSesion = async function() {
  const { error } = await db.auth.signOut();
  if (error) {
    console.error("Error al salir:", error.message);
  } else {
    const cajaLogin = document.getElementById('caja-login');
    const cajaApp = document.getElementById('caja-app');
    if (cajaLogin) cajaLogin.style.display = 'block';
    if (cajaApp) cajaApp.style.display = 'none';
  }
};

async function cargarLocalesDelUsuario() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return [];

  const { data: perfil, error: errorPerfil } = await db
    .from('Perfiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  if (errorPerfil) {
    console.error("Error al obtener perfil:", errorPerfil.message);
    return [];
  }

  const rolActual = perfil ? perfil.rol : 'MANAGER';
  let localesDisponibles = [];

  if (rolActual === 'SUPERADMIN') {
    const { data, error } = await db.from('Locales').select('*');
    if (error) console.error("Error al obtener locales:", error);
    localesDisponibles = data || [];
  } else {
    const { data, error } = await db
      .from('Usuarios_Locales')
      .select('local_id, Locales(*)')
      .eq('perfil_id', user.id);

    if (error) console.error("Error al obtener locales:", error);
    localesDisponibles = data ? data.map(item => item.Locales).filter(Boolean) : [];
  }

  const selector = document.getElementById('selectorLocales');
  if (selector) {
    if (localesDisponibles.length === 0) {
      selector.innerHTML = '<option value="">No tienes locales asignados</option>';
    } else {
      selector.innerHTML = localesDisponibles.map(local => 
        `<option value="${local.id}">${local.nombre_local}</option>`
      ).join('');
    }
  }

  return localesDisponibles;
}

// ==========================================
// 3. DETECTOR DE CAMBIO DE SESIÓN
// ==========================================

db.auth.onAuthStateChange((event, session) => {
  const cajaLogin = document.getElementById('caja-login');
  const cajaApp = document.getElementById('caja-app');

  if (session) {
    if (cajaLogin) cajaLogin.style.display = 'none';
    if (cajaApp) cajaApp.style.display = 'flex';
    
    cargarLocalesDelUsuario();
    if (typeof App !== 'undefined' && App.init) {
      App.init();
    }
  } else {
    if (cajaLogin) cajaLogin.style.display = 'block';
    if (cajaApp) cajaApp.style.display = 'none';
  }
});