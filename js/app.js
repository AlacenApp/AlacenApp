// ==========================================
// 1. CLIENTE SUPABASE (GLOBAL)
// ==========================================
window.SUPABASE_URL = 'https://ayyieaupiltisnrabdzn.supabase.co';
window.SUPABASE_KEY = 'sb_publishable_xQgcJLM_vUCl6XFyjqxN8g_uufrwBgl';

if (!window.db && window.supabase) {
  window.db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
}
var db = window.db;

// ==========================================
// 2. OBJETO GLOBAL APP
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

    init: function() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        
        this.activePeriod = `${yyyy}-${mm}`;
        
        const dateBadge = document.getElementById('currentDateBadge');
        if (dateBadge) {
            dateBadge.textContent = today.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        }

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

        this.populateDropdowns();
        this.updateHeaderBusinessInfo();
        this.renderDashboard();
    },

    updateHeaderBusinessInfo: function() {
        if (typeof StorageManager === 'undefined') return;
        const settings = StorageManager.getSettings();
        const headerName = document.getElementById('headerBusinessName');
        if (headerName) headerName.textContent = settings.businessName || 'Control de Stock & CMV';
    },

    toggleSidebar: function() {
        this.sidebarHidden = !this.sidebarHidden;
        localStorage.setItem('sidebar_hidden', this.sidebarHidden);
        this._applySidebarState(true);
    },

    _applySidebarState: function(animate) {
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

    toggleProveedoresNavMenu: function(forceState) {
        if (forceState === undefined) forceState = null;
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

    populateDropdowns: async function() {
        let suppliers = [];
        let categories = [];

        if (typeof StorageManager !== 'undefined') {
            suppliers = StorageManager.getSuppliers();
        }

        if (typeof ProductManager !== 'undefined' && ProductManager.getCategories) {
            categories = await ProductManager.getCategories();
        }

        const purchaseSupSelect = document.getElementById('purchaseSupplierSelect');
        if (purchaseSupSelect) {
            purchaseSupSelect.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' +
                suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }

        const prodCatSelect = document.getElementById('prodFormCategorySelect');
        if (prodCatSelect) {
            prodCatSelect.innerHTML = categories.length > 0
                ? categories.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')
                : '<option value="Materia Prima">Materia Prima</option>';
        }

        const prodCatFilter = document.getElementById('prodCategoryFilter');
        if (prodCatFilter) {
            prodCatFilter.innerHTML = '<option value="">Todas las categorías</option>' +
                categories.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
        }
    },

    navigate: function(viewId, params) {
        if (!params) params = {};
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

        const titles = {
            'dashboard': { title: 'Panel Principal', sub: 'Resumen operativo y estado general del inventario' },
            'compras-nueva': { title: 'Cargar Factura / Gasto', sub: 'Liquidación impositiva y estado de pago' },
            'ordenes-compra': { title: 'Órdenes de Compra', sub: 'Sugerencias de reposición por stock bajo' },
            'proveedores': { title: 'Directorio de Proveedores', sub: 'Fichas comerciales y datos fiscales' },
            'inventarios': { title: 'Carga de Inventarios (II / IF)', sub: 'Planillas de conteo físico' },
            'cmv': { title: 'Control CMV Mensual', sub: 'Cálculo de costo de mercadería vendida' },
            'productos': { title: 'Insumos y Categorías', sub: 'Catálogo de existencias y costos' },
            'compras-historial': { title: 'Historial de Pagos', sub: 'Registro de facturas y cuentas a pagar' },
            'evolucion-compras': { title: 'Evolución de Compras', sub: 'Historial de costos por insumo' },
            'ajustes': { title: 'Configuración & Backups', sub: 'Control de usuarios y respaldos' }
        };

        const pageTitle = document.getElementById('pageTitle');
        const pageSubtitle = document.getElementById('pageSubtitle');
        if (pageTitle && titles[viewId]) pageTitle.textContent = titles[viewId].title;
        if (pageSubtitle && titles[viewId]) pageSubtitle.textContent = titles[viewId].sub;

        if (viewId === 'dashboard') this.renderDashboard();
        else if (viewId === 'productos') this.renderProductsTable();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showToast: function(message, type) {
        if (!type) type = 'success';
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-xl text-xs font-semibold bg-emerald-600 text-white`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    renderDashboard: function() {
        // Dashboard
    },

    // ==========================================
    // MÓDULO INSUMOS (ABRIR / GUARDAR / TABLA)
    // ==========================================
    openProductModal: async function(productId) {
        const form = document.getElementById('productForm');
        if (form) form.reset();
        
        document.getElementById('prodFormId').value = productId || '';
        document.getElementById('productModalTitle').textContent = productId ? 'Editar Insumo' : 'Nuevo Insumo / Mercadería';

        await this.populateDropdowns();

        if (productId) {
            const products = await ProductManager.getProducts();
            const p = products.find(item => item.id === productId);
            if (p) {
                document.getElementById('prodFormCode').value = p.code || '';
                document.getElementById('prodFormName').value = p.name || '';
                document.getElementById('prodFormCategorySelect').value = p.category || '';
                document.getElementById('prodFormUnit').value = p.unit || 'kg';
                document.getElementById('prodFormStock').value = p.currentStock || 0;
                document.getElementById('prodFormMinStock').value = p.minStock || 10;
                document.getElementById('prodFormCost').value = p.costPrice || 0;
                document.getElementById('prodFormSale').value = p.salePrice || 0;
            }
        }

        document.getElementById('productModal')?.classList.remove('hidden');
    },

    closeProductModal: function() {
        document.getElementById('productModal')?.classList.add('hidden');
    },

    handleSaveProduct: async function(event) {
        event.preventDefault();
        try {
            const nameInput = document.getElementById('prodFormName');
            if (!nameInput || !nameInput.value.trim()) {
                alert("Por favor ingresa un nombre para el insumo.");
                return;
            }

            const formData = {
                id: document.getElementById('prodFormId').value || undefined,
                code: document.getElementById('prodFormCode').value.trim(),
                name: nameInput.value.trim(),
                category: document.getElementById('prodFormCategorySelect').value,
                unit: document.getElementById('prodFormUnit').value,
                currentStock: document.getElementById('prodFormStock').value,
                minStock: document.getElementById('prodFormMinStock').value,
                costPrice: document.getElementById('prodFormCost').value,
                salePrice: document.getElementById('prodFormSale').value
            };

            await ProductManager.saveProduct(formData);
            this.closeProductModal();
            this.showToast('¡Insumo guardado con éxito en Supabase!', 'success');
            await this.renderProductsTable();
        } catch (e) {
            alert(e.message || "Error al guardar insumo");
            console.error(e);
        }
    },

    renderProductsTable: async function() {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;

        tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-slate-400">Cargando insumos desde Supabase...</td></tr>`;

        let products = [];
        if (typeof ProductManager !== 'undefined' && ProductManager.getProducts) {
            products = await ProductManager.getProducts();
        }

        if (products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-slate-400">No hay insumos creados para este local.</td></tr>`;
            return;
        }

        const curr = '$';
        tbody.innerHTML = products.map(p => `
            <tr class="table-row-hover text-xs">
                <td class="py-2.5 px-3 font-mono font-bold">${p.code || '-'}</td>
                <td class="py-2.5 px-4 font-semibold text-slate-800">${p.name}</td>
                <td class="py-2.5 px-3 text-slate-500">${p.category || '-'}</td>
                <td class="py-2.5 px-3">Principal</td>
                <td class="py-2.5 px-2 text-center font-medium">${p.unit || 'u.'}</td>
                <td class="py-2.5 px-3 text-right font-black">${p.currentStock}</td>
                <td class="py-2.5 px-3 text-right text-slate-400">${p.minStock}</td>
                <td class="py-2.5 px-3 text-right">${curr} ${p.costPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="py-2.5 px-3 text-right font-bold">${curr} ${(p.currentStock * p.costPrice).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">Normal</span></td>
                <td class="py-2.5 px-3 text-right">
                    <button onclick="App.openProductModal('${p.id}')" class="p-1 text-slate-400 hover:text-indigo-600" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="App.deleteProductFromDb('${p.id}')" class="p-1 text-slate-400 hover:text-red-600" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            </tr>
        `).join('');
    },

    deleteProductFromDb: async function(id) {
        if (!confirm('¿Deseas eliminar este insumo de Supabase?')) return;
        try {
            await ProductManager.deleteProduct(id);
            this.showToast('Insumo eliminado', 'info');
            await this.renderProductsTable();
        } catch (e) {
            alert(e.message);
        }
    },

    // Handlers secundarios de formulario
    handlePurchaseFormKeydown: function(e) {},
    handlePurchaseHeaderKeydown: function(e) {},
    handlePurchaseRowKeydown: function(e) {},
    resetPurchaseForm: function() {},
    renderSuppliersView: function() {},
    renderPurchasesTable: function() {},
    renderOCHistoryTable: function() {},
    renderInventorySheets: function() {},
    renderCMVView: function() {},
    renderEvolucionProveedor: function() {},
    renderUsersTable: function() {},
    openSupplierModal: function(id) { document.getElementById('supplierModal')?.classList.remove('hidden'); },
    closeSupplierModal: function() { document.getElementById('supplierModal')?.classList.add('hidden'); },
    openUserModal: function(id) { document.getElementById('userModal')?.classList.remove('hidden'); },
    closeUserModal: function() { document.getElementById('userModal')?.classList.add('hidden'); },
    openSnapshotModal: function() { document.getElementById('snapshotModal')?.classList.remove('hidden'); },
    closeSnapshotModal: function() { document.getElementById('snapshotModal')?.classList.add('hidden'); },
    openCategoryManagerModal: function() { document.getElementById('categoryManagerModal')?.classList.remove('hidden'); },
    closeCategoryManagerModal: function() { document.getElementById('categoryManagerModal')?.classList.add('hidden'); },
    openPaymentModal: function() { document.getElementById('paymentModal')?.classList.remove('hidden'); },
    closePaymentModal: function() { document.getElementById('paymentModal')?.classList.add('hidden'); },
    openImportModal: function() { document.getElementById('importModal')?.classList.remove('hidden'); },
    closeImportModal: function() { document.getElementById('importModal')?.classList.add('hidden'); }
};

window.App = window.App;

// ==========================================
// 3. FUNCIONES DE AUTENTICACIÓN
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

  let localesDisponibles = [];

  const { data: perfil } = await db.from('Perfiles').select('rol').eq('id', user.id).maybeSingle();
  const rolActual = perfil ? perfil.rol : 'SUPERADMIN';

  if (rolActual === 'SUPERADMIN') {
    const { data } = await db.from('Locales').select('*').order('id', { ascending: true });
    localesDisponibles = data || [];
  } else {
    const { data } = await db.from('Usuarios_Locales').select('local_id, Locales(*)').eq('perfil_id', user.id);
    localesDisponibles = data ? data.map(item => item.Locales).filter(Boolean) : [];
  }

  // Fallback si no hay relaciones específicas creadas aún
  if (localesDisponibles.length === 0) {
    const { data: todosLocales } = await db.from('Locales').select('*').order('id', { ascending: true });
    localesDisponibles = todosLocales || [];
  }

  const selector = document.getElementById('selectorLocales');
  if (selector) {
    if (localesDisponibles.length === 0) {
      selector.innerHTML = '<option value="">No hay locales creados en BD</option>';
    } else {
      selector.innerHTML = localesDisponibles.map(local => `<option value="${local.id}">${local.nombre_local}</option>`).join('');
      selector.value = localesDisponibles[0].id;
    }

    selector.onchange = async () => {
      if (window.App) {
        await window.App.populateDropdowns();
        if (window.App.currentView === 'productos') {
          await window.App.renderProductsTable();
        }
      }
    };
  }

  if (window.App) {
    await window.App.populateDropdowns();
    if (window.App.currentView === 'productos') {
      await window.App.renderProductsTable();
    }
  }

  return localesDisponibles;
}

// ==========================================
// 4. DETECTOR DE SESIÓN
// ==========================================
if (db && db.auth) {
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
}