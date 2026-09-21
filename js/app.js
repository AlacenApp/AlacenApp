// ==========================================
// 1. SUPABASE Y VARIABLES GLOBALES
// ==========================================
window.SUPABASE_URL = 'https://ayyieaupiltisnrabdzn.supabase.co';
window.SUPABASE_KEY = 'sb_publishable_xQgcJLM_vUCl6XFyjqxN8g_uufrwBgl';

if (!window.db) {
  window.db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
}
var db = window.db;

// ==========================================
// 2. OBJETO GLOBAL APP (Disponible para onclick)
// ==========================================
window.App = {
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
        
        const dateBadge = document.getElementById('currentDateBadge');
        if (dateBadge) {
            dateBadge.textContent = today.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        }

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
        this.renderDashboard();
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

    toggleProveedoresNavMenu(forceState = null) {
        const submenu = document.getElementById('nav-proveedores-submenu');
        const chevron = document.getElementById('nav-proveedores-chevron');
        if (!submenu) return;
        const willOpen = forceState !== null ? forceState : submenu.classList.contains('hidden');
        if (willOpen) {
            submenu.classList.remove('hidden');
            if (chevron) chevron.classList.add('rotate-180');
        } else {
            submenu.classList.add('hidden');
            if (chevron) chevron.classList.remove('rotate-180');
        }
    },

    applyUserPermissions() {
        if (typeof StorageManager === 'undefined') return;
        if (!this.activeUser) this.activeUser = StorageManager.getActiveUser();
        const user = this.activeUser;
        if (!user) return;

        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        if (sidebarName) sidebarName.textContent = user.name || 'Usuario';
        if (sidebarAvatar && user.name) sidebarAvatar.textContent = user.name.charAt(0).toUpperCase();
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
    },

    navigate(viewId, params = {}) {
        this.currentView = viewId;
        const views = document.querySelectorAll('main > section');
        views.forEach(v => v.classList.add('hidden'));

        const targetView = document.getElementById(`view-${viewId}`);
        if (targetView) targetView.classList.remove('hidden');

        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.classList.remove('bg-sky-600', 'text-white', 'shadow-sm');
            btn.classList.add('text-slate-300');
        });
        const activeNavBtn = document.getElementById(`nav-${viewId}`);
        if (activeNavBtn) {
            activeNavBtn.classList.remove('text-slate-300');
            activeNavBtn.classList.add('bg-sky-600', 'text-white', 'shadow-sm');
        }

        if (viewId === 'dashboard') this.renderDashboard();
        else if (viewId === 'compras-nueva') this.resetPurchaseForm();
        else if (viewId === 'proveedores') this.renderSuppliersView();
        else if (viewId === 'inventarios') this.renderInventorySheets();
        else if (viewId === 'cmv') this.renderCMVView();
        else if (viewId === 'productos') this.renderProductsTable();
        else if (viewId === 'compras-historial') this.renderPurchasesTable();
        else if (viewId === 'evolucion-compras') this.renderEvolucionProveedor();
        else if (viewId === 'ajustes') this.renderUsersTable();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-xl text-xs font-semibold bg-emerald-600 text-white`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    renderDashboard() {
        if (typeof StorageManager === 'undefined') return;
        const products = StorageManager.getProducts();
        let totalVal = 0;
        products.forEach(p => totalVal += (p.currentStock || 0) * (p.costPrice || 0));
        const el = document.getElementById('dashTotalStockValue');
        if (el) el.textContent = `$ ${totalVal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    },

    resetPurchaseForm() {},
    renderSuppliersView() {},
    renderInventorySheets() {},
    renderCMVView() {},
    renderProductsTable() {},
    renderPurchasesTable() {},
    renderEvolucionProveedor() {},
    renderUsersTable() {},
    loadDemoData() {
        if (typeof StorageManager !== 'undefined') {
            StorageManager.loadDemoData();
            this.init();
        }
    }
};

var App = window.App;

// ==========================================
// 3. FUNCIONES DE AUTENTICACIÓN Y SESIÓN
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
  if (error) alert("Error al iniciar sesión: " + error.message);
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

  const { data: perfil } = await db.from('Perfiles').select('rol').eq('id', user.id).maybeSingle();
  const rolActual = perfil ? perfil.rol : 'MANAGER';
  let localesDisponibles = [];

  if (rolActual === 'SUPERADMIN') {
    const { data } = await db.from('Locales').select('*');
    localesDisponibles = data || [];
  } else {
    const { data } = await db.from('Usuarios_Locales').select('local_id, Locales(*)').eq('perfil_id', user.id);
    localesDisponibles = data ? data.map(item => item.Locales).filter(Boolean) : [];
  }

  const selector = document.getElementById('selectorLocales');
  if (selector) {
    if (localesDisponibles.length === 0) {
      selector.innerHTML = '<option value="">No tienes locales asignados</option>';
    } else {
      selector.innerHTML = localesDisponibles.map(local => `<option value="${local.id}">${local.nombre_local}</option>`).join('');
    }
  }
  return localesDisponibles;
}

db.auth.onAuthStateChange((event, session) => {
  const cajaLogin = document.getElementById('caja-login');
  const cajaApp = document.getElementById('caja-app');

  if (session) {
    if (cajaLogin) cajaLogin.style.display = 'none';
    if (cajaApp) cajaApp.style.display = 'flex';
    cargarLocalesDelUsuario();
    if (window.App && typeof window.App.init === 'function') {
      window.App.init();
    }
  } else {
    if (cajaLogin) cajaLogin.style.display = 'block';
    if (cajaApp) cajaApp.style.display = 'none';
  }
});