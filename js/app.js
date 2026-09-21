// ==========================================
// 1. INICIALIZACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://ayyieaupiltisnrabdzn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xQgcJLM_vUCl6XFyjqxN8g_uufrwBgl';

// Cliente de Supabase inicializado una sola vez
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. FUNCIONES DE AUTENTICACIÓN
// ==========================================

// Función para el botón "Ingresar" del HTML
async function botonLogin() {
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
}

// Función para cerrar sesión
async function cerrarSesion() {
  const { error } = await db.auth.signOut();
  if (error) {
    console.error("Error al salir:", error.message);
  } else {
    const cajaLogin = document.getElementById('caja-login');
    const cajaApp = document.getElementById('caja-app');
    if (cajaLogin) cajaLogin.style.display = 'block';
    if (cajaApp) cajaApp.style.display = 'none';
  }
}

// Función auxiliar para registrar nuevos usuarios
async function registrarUsuario(email, password) {
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) {
    alert("Error al registrar: " + error.message);
  } else {
    alert("¡Usuario registrado con éxito!");
  }
}

// ==========================================
// 3. CONSULTA DE LOCALES Y RBAC EN SUPABASE
// ==========================================

async function cargarLocalesDelUsuario() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return [];

  // Consultar rol del usuario en la tabla Perfiles
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

  // Pintar los locales en el <select> del HTML
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
// 4. LÓGICA DE INTERFAZ LOCAL (OBJETO APP)
// ==========================================

const App = {
    currentView: 'dashboard',
    activePeriod: '',
    inventorySubTab: 'inicial',
    evolucionTab: 'proveedor',
    supplierPurchasesChart: null,
    productPriceChart: null,
    pendingProductForPurchase: false,
    activeUser: null,
    sidebarHidden: false,
    _selectedSecondarySupplierIds: [],

    init() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        
        this.activePeriod = `${yyyy}-${mm}`;
        
        const dateStr = today.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        const dateBadge = document.getElementById('currentDateBadge');
        if (dateBadge) dateBadge.textContent = dateStr;

        const purchaseDateInput = document.getElementById('purchaseDate');
        if (purchaseDateInput) purchaseDateInput.value = `${yyyy}-${mm}-${dd}`;

        const purchasePaymentDateInput = document.getElementById('purchasePaymentDate');
        if (purchasePaymentDateInput) purchasePaymentDateInput.value = `${yyyy}-${mm}-${dd}`;

        const cmvPeriodInput = document.getElementById('cmvPeriodInput');
        if (cmvPeriodInput) cmvPeriodInput.value = this.activePeriod;

        const invPeriodInput = document.getElementById('invPeriodInput');
        if (invPeriodInput) invPeriodInput.value = this.activePeriod;

        const purchasesMonthFilter = document.getElementById('purchasesMonthFilter');
        if (purchasesMonthFilter) purchasesMonthFilter.value = this.activePeriod;

        if (typeof StorageManager !== 'undefined') {
            const products = StorageManager.getProducts();
            if (!products || products.length === 0) {
                StorageManager.loadDemoData();
            }
            this.activeUser = StorageManager.getActiveUser();
            this.applyUserPermissions();
        }

        this.populateDropdowns();
        this.updateHeaderBusinessInfo();

        this.sidebarHidden = localStorage.getItem('sidebar_hidden') === 'true';
        this._applySidebarState(false);
    },

    updateHeaderBusinessInfo() {
        if (typeof StorageManager === 'undefined') return;
        const settings = StorageManager.getSettings();
        const headerName = document.getElementById('headerBusinessName');
        if (headerName) headerName.textContent = settings.businessName || 'Control de Stock & CMV';
    },

    toggleSidebar() {
        this.sidebarHidden = !this.sidebarHidden;
        localStorage.setItem('sidebar_hidden', this.sidebarHidden);
        this._applySidebarState(true);
    },

    _applySidebarState(animate) {
        const sidebar = document.getElementById('appSidebar');
        if (!sidebar) return;
        if (this.sidebarHidden) {
            sidebar.style.width = '0';
            sidebar.style.minWidth = '0';
            sidebar.style.padding = '0';
            sidebar.style.overflow = 'hidden';
        } else {
            sidebar.style.width = '';
            sidebar.style.minWidth = '';
            sidebar.style.padding = '';
            sidebar.style.overflow = '';
        }
    },

    applyUserPermissions() {
        if (typeof StorageManager === 'undefined') return;
        if (!this.activeUser) {
            this.activeUser = StorageManager.getActiveUser();
        }
        const user = this.activeUser;
        if (!user) return;

        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        if (sidebarName) sidebarName.textContent = user.name || 'Usuario';
        if (sidebarAvatar && user.name) {
            sidebarAvatar.textContent = user.name.charAt(0).toUpperCase();
        }
    },

    populateDropdowns() {
        if (typeof StorageManager === 'undefined') return;
        const suppliers = StorageManager.getSuppliers();
        const categories = StorageManager.getCategories();

        const purchaseSupSelect = document.getElementById('purchaseSupplierSelect');
        if (purchaseSupSelect) {
            purchaseSupSelect.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' +
                suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }
    }
};

// ==========================================
// 5. ESCUCHAR CAMBIOS DE SESIÓN (LOGIN/LOGOUT)
// ==========================================

db.auth.onAuthStateChange((event, session) => {
  const cajaLogin = document.getElementById('caja-login');
  const cajaApp = document.getElementById('caja-app');

  if (session) {
    // Usuario logueado
    if (cajaLogin) cajaLogin.style.display = 'none';
    if (cajaApp) cajaApp.style.display = 'flex';
    
    // Cargar locales desde Supabase
    cargarLocalesDelUsuario();

    // Inicializar módulo UI
    App.init();
  } else {
    // Sin usuario activo
    if (cajaLogin) cajaLogin.style.display = 'block';
    if (cajaApp) cajaApp.style.display = 'none';
  }
});