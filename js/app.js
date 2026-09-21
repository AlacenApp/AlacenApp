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
// 2. OBJETO GLOBAL APP (COMPLETO)
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

    applyUserPermissions: function() {
        if (typeof StorageManager === 'undefined') return;
        if (!this.activeUser) this.activeUser = StorageManager.getActiveUser();
        const user = this.activeUser;
        if (!user) return;

        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        if (sidebarName) sidebarName.textContent = user.name || 'Usuario';
        if (sidebarAvatar && user.name) sidebarAvatar.textContent = user.name.charAt(0).toUpperCase();
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

        const ocSupSelect = document.getElementById('ocSupplierSelect');
        if (ocSupSelect) {
            ocSupSelect.innerHTML = '<option value="">-- Elige un proveedor --</option>' +
                suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        }

        const prodSupSelect = document.getElementById('prodFormSupplierSelect');
        if (prodSupSelect) {
            prodSupSelect.innerHTML = '<option value="">-- Sin proveedor asignado --</option>' +
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
        else if (viewId === 'compras-nueva') this.resetPurchaseForm();
        else if (viewId === 'ordenes-compra') this.renderOCHistoryTable();
        else if (viewId === 'proveedores') this.renderSuppliersView();
        else if (viewId === 'inventarios') this.renderInventorySheets();
        else if (viewId === 'cmv') this.renderCMVView();
        else if (viewId === 'productos') this.renderProductsTable();
        else if (viewId === 'compras-historial') this.renderPurchasesTable();
        else if (viewId === 'evolucion-compras') this.renderEvolucionProveedor();
        else if (viewId === 'ajustes') this.renderUsersTable();

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

    // ==========================================
    // CONTROLADORES DE TECLADO Y EVENTOS FORMULARIO
    // ==========================================
    handlePurchaseFormKeydown: function(event) {
        if (event.key === 'Enter') {
            if (event.target.tagName === 'TEXTAREA') return;
            if (event.target.type === 'submit' || event.target.id === 'purchaseSubmitBtn' || event.target.closest('#purchaseSubmitBtn')) return;
            event.preventDefault();
            this.addPurchaseRow();
        }
    },
    handlePurchaseHeaderKeydown: function(event) {
        this.handlePurchaseFormKeydown(event);
    },
    handlePurchaseRowKeydown: function(event) {
        this.handlePurchaseFormKeydown(event);
    },
    handlePurchaseDateChange: function(val) {},
    handlePurchaseSupplierChange: function(val) {},
    handlePurchasePaymentStatusChange: function(val) {},
    recalculateTaxesFromRate: function() {},
    recalculateTotalInvoiceFromInputs: function() {},
    recalculateIibbFromRate: function() {},
    updatePurchaseRowProduct: function(el) {},
    updateRowDiscountPct: function(el) {},
    updateRowDiscountVal: function(el) {},
    calculatePurchaseTotals: function() {},
    cancelPurchaseEdit: function() { this.resetPurchaseForm(); },
    editPurchaseFromDetail: function() {},
    closePurchaseDetailModal: function() { document.getElementById('purchaseDetailModal')?.classList.add('hidden'); },

    // ==========================================
    // RENDERIZADO Y TABLAS
    // ==========================================
    renderDashboard: function() {
        if (typeof StorageManager === 'undefined') return;
        const products = StorageManager.getProducts();
        let totalStockValuation = 0;
        products.forEach(p => {
            totalStockValuation += (p.currentStock || 0) * (p.costPrice || 0);
        });

        const dashStockValEl = document.getElementById('dashTotalStockValue');
        if (dashStockValEl) dashStockValEl.textContent = `$ ${totalStockValuation.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        const lowStockProducts = products.filter(p => (p.currentStock || 0) <= (p.minStock || 0));
        const lowTable = document.getElementById('dashLowStockTable');
        if (lowTable) {
            if (lowStockProducts.length === 0) {
                lowTable.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400">¡Excelente! No hay insumos en stock crítico.</td></tr>`;
            } else {
                lowTable.innerHTML = lowStockProducts.slice(0, 5).map(p => `
                    <tr class="table-row-hover text-xs">
                        <td class="py-2.5 px-4 font-medium text-slate-800">${p.name}</td>
                        <td class="py-2.5 px-3 text-slate-600">${p.supplierName || 'Sin asignar'}</td>
                        <td class="py-2.5 px-3 font-black text-amber-600">${p.currentStock} ${p.unit}</td>
                        <td class="py-2.5 px-3 text-right">
                            <button onclick="App.navigate('productos')" class="text-[11px] font-bold text-sky-600">Ver</button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    },

    resetPurchaseForm: function() {
        const form = document.getElementById('purchaseForm');
        if (form) form.reset();
        const tbody = document.getElementById('purchaseItemsTableBody');
        if (tbody) {
            tbody.innerHTML = '';
            this.addPurchaseRow();
        }
    },

    addPurchaseRow: function(defaultProductId, defaultQty, defaultCost) {
        if (defaultProductId === undefined) defaultProductId = '';
        if (defaultQty === undefined) defaultQty = 1;
        if (defaultCost === undefined) defaultCost = 0;

        const tbody = document.getElementById('purchaseItemsTableBody');
        if (!tbody) return;
        const products = typeof StorageManager !== 'undefined' ? StorageManager.getProducts() : [];

        const row = document.createElement('tr');
        row.className = 'purchase-item-row';
        row.innerHTML = `
            <td class="py-2 px-2.5">
                <select required class="row-product-select w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs">
                    <option value="">-- Seleccionar Insumo --</option>
                    ${products.map(p => `<option value="${p.id}" ${p.id === defaultProductId ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
            </td>
            <td class="py-2 px-2 text-center text-slate-500 font-bold">u.</td>
            <td class="py-2 px-2"><input type="number" step="any" value="${defaultQty}" class="row-qty-input w-full bg-slate-50 border rounded-lg px-2 py-1.5 text-xs"></td>
            <td class="py-2 px-2"><input type="number" step="any" value="${defaultCost}" class="row-cost-input w-full bg-slate-50 border rounded-lg px-2 py-1.5 text-xs"></td>
            <td class="py-2 px-2"><input type="number" step="any" placeholder="0" class="row-discount-val w-full bg-slate-50 border rounded-lg px-2 py-1.5 text-xs"></td>
            <td class="py-2 px-3 text-right font-black text-slate-800 row-subtotal">$ 0.00</td>
            <td class="py-2 px-2 text-center">
                <button type="button" onclick="App.removePurchaseRow(this)" class="text-slate-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    },

    removePurchaseRow: function(btn) {
        const row = btn.closest('tr');
        if (row) row.remove();
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
                    <button onclick="App.deleteProductFromDb('${p.id}')" class="p-1 text-slate-400 hover:text-red-600" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            </tr>
        `).join('');
    },

    handleSaveProduct: async function(event) {
        event.preventDefault();
        try {
            const formData = {
                id: document.getElementById('prodFormId').value || undefined,
                code: document.getElementById('prodFormCode').value,
                name: document.getElementById('prodFormName').value,
                category: document.getElementById('prodFormCategorySelect').value,
                unit: document.getElementById('prodFormUnit').value,
                currentStock: document.getElementById('prodFormStock').value,
                minStock: document.getElementById('prodFormMinStock').value,
                costPrice: document.getElementById('prodFormCost').value,
                salePrice: document.getElementById('prodFormSale').value
            };

            await ProductManager.saveProduct(formData);
            this.closeProductModal();
            this.showToast('Insumo guardado en Supabase', 'success');
            await this.renderProductsTable();
        } catch (e) {
            alert(e.message);
        }
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

    renderSuppliersView: function() {
        if (typeof StorageManager === 'undefined') return;
        const suppliers = StorageManager.getSuppliers();
        const tbody = document.getElementById('suppliersTableBody');
        if (!tbody) return;
        if (suppliers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">No hay proveedores registrados.</td></tr>`;
            return;
        }
        tbody.innerHTML = suppliers.map(s => `
            <tr class="table-row-hover text-xs">
                <td class="py-3 px-4 font-bold text-slate-900">${s.name}</td>
                <td class="py-3 px-3 font-mono">${s.cuit || '-'}</td>
                <td class="py-3 px-3">${s.contactPerson || '-'}</td>
                <td class="py-3 px-3">${s.phone || '-'}</td>
                <td class="py-3 px-3">${s.email || '-'}</td>
                <td class="py-3 px-3">${s.paymentMethods || 'A convenir'}</td>
                <td class="py-3 px-2 text-center">0</td>
                <td class="py-3 px-4 text-right">
                    <button onclick="App.openSupplierModal('${s.id}')" class="p-1 text-slate-500 hover:text-teal-600"><i class="fa-solid fa-pen-to-square"></i></button>
                </td>
            </tr>
        `).join('');
    },

    renderPurchasesTable: function() {},
    renderOCHistoryTable: function() {},
    renderInventorySheets: function() {},
    renderCMVView: function() {},
    renderEvolucionProveedor: function() {},
    renderUsersTable: function() {},

    // ==========================================
    // MODALES Y MANTENIMIENTO
    // ==========================================
    openProductModal: function(id) { document.getElementById('productModal')?.classList.remove('hidden'); },
    closeProductModal: function() { document.getElementById('productModal')?.classList.add('hidden'); },
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
    closeImportModal: function() { document.getElementById('importModal')?.classList.add('hidden'); },
    handleSaveSupplier: function(e) { e.preventDefault(); this.closeSupplierModal(); },
    handleSaveUser: function(e) { e.preventDefault(); this.closeUserModal(); },
    handleSavePayment: function(e) { e.preventDefault(); this.closePaymentModal(); },
    handleSaveCategory: function(e) { e.preventDefault(); this.closeCategoryManagerModal(); },
    handleSavePurchase: function(e) { e.preventDefault(); this.navigate('compras-historial'); },
    saveSettings: function(e) { e.preventDefault(); this.showToast('Configuración guardada'); },

    setInventorySubTab: function(tab) {
        this.inventorySubTab = tab;
        const contIni = document.getElementById('subtab-content-inicial');
        const contFin = document.getElementById('subtab-content-final');
        const contSnap = document.getElementById('subtab-content-snapshots');
        if (contIni) contIni.classList.toggle('hidden', tab !== 'inicial');
        if (contFin) contFin.classList.toggle('hidden', tab !== 'final');
        if (contSnap) contSnap.classList.toggle('hidden', tab !== 'snapshots');
        this.renderInventorySheets();
    },

    switchEvolucionTab: function(tab) {
        this.evolucionTab = tab;
        const subProv = document.getElementById('subtabEvolProveedor');
        const subIns = document.getElementById('subtabEvolInsumo');
        if (subProv) subProv.classList.toggle('hidden', tab !== 'proveedor');
        if (subIns) subIns.classList.toggle('hidden', tab !== 'insumo');
        if (tab === 'proveedor') this.renderEvolucionProveedor();
    },

    changePeriod: function(delta) {
        if (!this.activePeriod) return;
        const parts = this.activePeriod.split('-');
        let y = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10) + delta;
        if (m > 12) { m = 1; y += 1; }
        if (m < 1) { m = 12; y -= 1; }
        this.activePeriod = `${y}-${String(m).padStart(2, '0')}`;
        const cmvInp = document.getElementById('cmvPeriodInput');
        if (cmvInp) cmvInp.value = this.activePeriod;
        const invInp = document.getElementById('invPeriodInput');
        if (invInp) invInp.value = this.activePeriod;
        if (this.currentView === 'inventarios') this.renderInventorySheets();
        if (this.currentView === 'cmv') this.renderCMVView();
    },

    handlePeriodChange: function(val) {
        if (!val) return;
        this.activePeriod = val;
        if (this.currentView === 'inventarios') this.renderInventorySheets();
        if (this.currentView === 'cmv') this.renderCMVView();
    },

    loadDemoData: function() {
        if (typeof StorageManager !== 'undefined') {
            StorageManager.loadDemoData();
            this.init();
            this.showToast('Datos de prueba cargados con éxito');
        }
    }
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
      selector.value = localesDisponibles[0].id;
    }

    selector.onchange = () => {
      if (window.App && window.App.currentView === 'productos') {
        window.App.renderProductsTable();
      }
    };
  }

  if (window.App) {
    window.App.populateDropdowns();
    if (window.App.currentView === 'productos') {
      window.App.renderProductsTable();
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
// Renderizar lista de Insumos
App.renderProductsTable = async function() {
  const tbody = document.getElementById('productsTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-slate-400">Cargando insumos desde Supabase...</td></tr>`;

  const products = await ProductManager.getProducts();

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
        <button onclick="App.deleteProductFromDb('${p.id}')" class="p-1 text-slate-400 hover:text-red-600" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    </tr>
  `).join('');
};

// Guardar Insumo desde el Modal
App.handleSaveProduct = async function(event) {
  event.preventDefault();
  try {
    const formData = {
      id: document.getElementById('prodFormId').value || undefined,
      code: document.getElementById('prodFormCode').value,
      name: document.getElementById('prodFormName').value,
      category: document.getElementById('prodFormCategorySelect').value,
      unit: document.getElementById('prodFormUnit').value,
      currentStock: document.getElementById('prodFormStock').value,
      minStock: document.getElementById('prodFormMinStock').value,
      costPrice: document.getElementById('prodFormCost').value,
      salePrice: document.getElementById('prodFormSale').value
    };

    await ProductManager.saveProduct(formData);
    this.closeProductModal();
    this.showToast('Insumo guardado en Supabase', 'success');
    await this.renderProductsTable();
  } catch (e) {
    alert(e.message);
  }
};

// Eliminar Insumo
App.deleteProductFromDb = async function(id) {
  if (!confirm('¿Deseas eliminar este insumo de Supabase?')) return;
  try {
    await ProductManager.deleteProduct(id);
    this.showToast('Insumo eliminado', 'info');
    await this.renderProductsTable();
  } catch (e) {
    alert(e.message);
  }
};

// Cargar opciones del selector de Categorías
App.populateDropdowns = async function() {
  const categories = await ProductManager.getCategories();
  const prodCatSelect = document.getElementById('prodFormCategorySelect');
  if (prodCatSelect) {
    prodCatSelect.innerHTML = categories.length > 0 
      ? categories.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')
      : '<option value="Materia Prima">Materia Prima</option>';
  }
};