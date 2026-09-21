// ==========================================
// 1. INICIALIZACIÓN DE SUPABASE (GLOBAL SEGURO)
// ==========================================
window.SUPABASE_URL = 'https://ayyieaupiltisnrabdzn.supabase.co';
window.SUPABASE_KEY = 'sb_publishable_xQgcJLM_vUCl6XFyjqxN8g_uufrwBgl';

if (!window.db && window.supabase) {
  window.db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
}
var db = window.db;

// ==========================================
// 2. OBJETO GLOBAL APP CON TODA LA LÓGICA
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

        this.navigate('dashboard');
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

    populateDropdowns: function() {
        if (typeof StorageManager === 'undefined') return;
        const suppliers = StorageManager.getSuppliers();
        const categories = StorageManager.getCategories();

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
            prodCatSelect.innerHTML = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        }

        const prodCatFilter = document.getElementById('prodCategoryFilter');
        if (prodCatFilter) {
            prodCatFilter.innerHTML = '<option value="">Todas las categorías</option>' +
                categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
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
    // DASHBOARD Y TABLAS
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

    renderProductsTable: function() {
        if (typeof StorageManager === 'undefined') return;
        const products = StorageManager.getProducts();
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) return;
        if (products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-slate-400">No hay insumos creados.</td></tr>`;
            return;
        }
        tbody.innerHTML = products.map(p => `
            <tr class="table-row-hover text-xs">
                <td class="py-2.5 px-3 font-mono font-bold">${p.code || '-'}</td>
                <td class="py-2.5 px-4 font-semibold text-slate-800">${p.name}</td>
                <td class="py-2.5 px-3 text-slate-500">${p.category || '-'}</td>
                <td class="py-2.5 px-3">${p.supplierName || 'Sin asignar'}</td>
                <td class="py-2.5 px-2 text-center font-medium">${p.unit || 'u.'}</td>
                <td class="py-2.5 px-3 text-right font-black">${p.currentStock || 0}</td>
                <td class="py-2.5 px-3 text-right text-slate-400">${p.minStock || 0}</td>
                <td class="py-2.5 px-3 text-right">$ ${(p.costPrice || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="py-2.5 px-3 text-right font-bold">$ ${((p.currentStock || 0) * (p.costPrice || 0)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">Normal</span></td>
                <td class="py-2.5 px-3 text-right">
                    <button onclick="App.openProductModal('${p.id}')" class="p-1 text-slate-400 hover:text-indigo-600"><i class="fa-solid fa-pen-to-square"></i></button>
                </td>
            </tr>
        `).join('');
    },

    renderPurchasesTable: function() {
        if (typeof StorageManager === 'undefined') return;
        const purchases = StorageManager.getPurchases();
        const tbody = document.getElementById('purchasesHistoryTableBody');
        if (!tbody) return;
        if (purchases.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">No hay facturas cargadas.</td></tr>`;
            return;
        }
        tbody.innerHTML = purchases.map(p => `
            <tr class="table-row-hover text-xs">
                <td class="py-2.5 px-3">${p.date || '-'}</td>
                <td class="py-2.5 px-3 font-mono font-bold">${p.invoiceNumber || 'S/N'}</td>
                <td class="py-2.5 px-4 font-semibold">${p.supplier || '-'}</td>
                <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">✓ Pagada</span></td>
                <td class="py-2.5 px-3">${p.paymentMethod || 'Efectivo'}</td>
                <td class="py-2.5 px-3 text-right">$ ${(p.netSubtotal || p.totalCost || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="py-2.5 px-3 text-right">$ ${(p.ivaAmount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="py-2.5 px-4 text-right font-black">$ ${(p.totalInvoice || p.totalCost || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="py-2.5 px-3 text-right">
                    <button onclick="App.openPaymentModal('${p.id}')" class="p-1 text-slate-400 hover:text-sky-600"><i class="fa-solid fa-eye"></i></button>
                </td>
            </tr>
        `).join('');
    },

    renderOCHistoryTable: function() {
        if (typeof StorageManager === 'undefined') return;
        const orders = StorageManager.getPurchaseOrders();
        const tbody = document.getElementById('ocHistoryTableBody');
        if (!tbody) return;
        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No hay órdenes de compra emitidas.</td></tr>`;
            return;
        }
        tbody.innerHTML = orders.map(o => `
            <tr class="table-row-hover text-xs">
                <td class="py-2.5 px-3">${o.date}</td>
                <td class="py-2.5 px-3 font-mono font-bold">${o.orderNumber || o.id}</td>
                <td class="py-2.5 px-4 font-semibold">${o.supplierName}</td>
                <td class="py-2.5 px-3">${(o.items || []).length} insumos</td>
                <td class="py-2.5 px-4 text-right font-black">$ ${(o.totalEstimated || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800">Pendiente</span></td>
                <td class="py-2.5 px-3 text-right">
                    <button onclick="StorageManager.deletePurchaseOrder('${o.id}'); App.renderOCHistoryTable();" class="p-1 text-slate-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            </tr>
        `).join('');
    },

    renderInventorySheets: function() {
        if (typeof CMVManager === 'undefined') return;
        const period = this.activePeriod;
        const cmvData = CMVManager.calculatePeriodCMV(period);
        const initialBody = document.getElementById('sheetInitialTableBody');
        if (initialBody) {
            if (cmvData.items.length === 0) {
                initialBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No hay insumos.</td></tr>`;
            } else {
                initialBody.innerHTML = cmvData.items.map(it => `
                    <tr class="text-xs">
                        <td class="py-2.5 px-3 font-mono">${it.code}</td>
                        <td class="py-2.5 px-4 font-semibold">${it.name}</td>
                        <td class="py-2.5 px-3 text-slate-500">${it.category}</td>
                        <td class="py-2.5 px-2 text-center font-bold">${it.unit}</td>
                        <td class="py-2.5 px-3 text-right"><input type="number" value="${it.initialQty || 0}" class="w-24 bg-white border rounded px-2 py-1 text-right"></td>
                        <td class="py-2.5 px-3 text-right"><input type="number" value="${it.initialUnitCost || 0}" class="w-24 bg-white border rounded px-2 py-1 text-right"></td>
                        <td class="py-2.5 px-4 text-right font-black">$ ${(it.initialQty * it.initialUnitCost).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `).join('');
            }
        }
    },

    renderCMVView: function() {
        if (typeof CMVManager === 'undefined') return;
        const cmvData = CMVManager.calculatePeriodCMV(this.activePeriod);
        const tbody = document.getElementById('cmvTableBody');
        if (!tbody) return;
        if (cmvData.items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-slate-400">No hay insumos para calcular CMV.</td></tr>`;
            return;
        }
        tbody.innerHTML = cmvData.items.map(it => `
            <tr class="table-row-hover text-xs">
                <td class="py-2.5 px-3 font-semibold">${it.name}</td>
                <td class="py-2.5 px-2 text-center">${it.unit}</td>
                <td class="py-2.5 px-3 text-right">${it.initialQty}</td>
                <td class="py-2.5 px-3 text-right text-sky-700 font-bold">${it.purchasedQty}</td>
                <td class="py-2.5 px-3 text-right font-medium">${it.availableQty}</td>
                <td class="py-2.5 px-3 text-right font-black text-amber-900">$ ${it.ppp.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="py-2.5 px-3 text-right">${it.hasFinalCount ? it.finalQty : '-'}</td>
                <td class="py-2.5 px-3 text-right font-bold text-indigo-700">${it.hasFinalCount ? it.usageQty : '-'}</td>
                <td class="py-2.5 px-3 text-right font-black text-emerald-800">${it.hasFinalCount ? '$ ' + it.cmvValue.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : '-'}</td>
                <td class="py-2.5 px-3 text-right text-slate-600">${it.hasFinalCount ? '$ ' + it.finalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : '-'}</td>
            </tr>
        `).join('');
    },

    renderEvolucionProveedor: function() {
        if (typeof StorageManager === 'undefined') return;
        const purchases = StorageManager.getPurchases();
        const tbody = document.getElementById('evolSupplierTableBody');
        if (!tbody) return;
        if (purchases.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">No hay compras registradas.</td></tr>`;
            return;
        }
        tbody.innerHTML = purchases.map(p => `
            <tr class="table-row-hover text-xs">
                <td class="py-2.5 px-3 font-mono">${p.date || '-'}</td>
                <td class="py-2.5 px-3 font-bold">${p.invoiceNumber || 'S/N'}</td>
                <td class="py-2.5 px-4 font-semibold">${p.supplier || '-'}</td>
                <td class="py-2.5 px-4 text-slate-500 truncate">${(p.items || []).length} insumos</td>
                <td class="py-2.5 px-3 text-center"><span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Pagada</span></td>
                <td class="py-2.5 px-3 text-right">$ ${(p.netSubtotal || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="py-2.5 px-3 text-right">-</td>
                <td class="py-2.5 px-4 text-right font-black">$ ${(p.totalInvoice || p.totalCost || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                <td class="py-2.5 px-2 text-center"><button onclick="App.openPaymentModal('${p.id}')" class="text-slate-400 hover:text-sky-600"><i class="fa-solid fa-eye"></i></button></td>
            </tr>
        `).join('');
    },

    renderUsersTable: function() {
        if (typeof StorageManager === 'undefined') return;
        const users = StorageManager.getUsers();
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;
        tbody.innerHTML = users.map(u => `
            <tr class="table-row-hover text-xs">
                <td class="py-2.5 px-3 font-bold">@${u.username}</td>
                <td class="py-2.5 px-3">${u.name}</td>
                <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-100 text-indigo-800">${u.role}</span></td>
                <td class="py-2.5 px-3 text-center font-mono">••••</td>
                <td class="py-2.5 px-3 text-right">
                    <button onclick="App.openUserModal('${u.id}')" class="p-1 text-slate-500 hover:text-indigo-600"><i class="fa-solid fa-pen-to-square"></i></button>
                </td>
            </tr>
        `).join('');
    },

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
    handleSaveProduct: function(e) { e.preventDefault(); this.closeProductModal(); },
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
// 3. FUNCIONES DE AUTENTICACIÓN SUPABASE
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