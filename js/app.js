// ==========================================
// 1. CONFIGURACIÓN Y CLIENTE SUPABASE
// ==========================================
window.SUPABASE_URL = 'https://ayyieaupiltisnrabdzn.supabase.co';
window.SUPABASE_KEY = 'sb_publishable_xQgcJLM_vUCl6XFyjqxN8g_uufrwBgl';

if (!window.db && window.supabase) {
  window.db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
}
var db = window.db;

// ==========================================
// 2. FUNCIONES DE AUTENTICACIÓN Y SESIÓN
// ==========================================
window.botonLogin = async function() {
  try {
    var emailInput = document.getElementById('input-email');
    var passInput = document.getElementById('input-pass');
    if (!emailInput || !passInput) return;

    var email = emailInput.value.trim();
    var password = passInput.value.trim();
    if (!email || !password) {
      alert("Por favor completa correo y contraseña");
      return;
    }

    if (!window.db || !window.db.auth) {
      alert("Error: El cliente de Supabase no se cargó correctamente.");
      return;
    }

    var res = await window.db.auth.signInWithPassword({ email: email, password: password });
    if (res.error) {
      alert("Error al ingresar: " + res.error.message);
    }
  } catch (err) {
    console.error("Error en login:", err);
    alert("Ocurrió un error al ingresar: " + (err.message || err));
  }
};

window.cerrarSesion = async function() {
  try {
    if (window.db && window.db.auth) {
      await window.db.auth.signOut();
    }
  } catch (e) {
    console.error("Error al salir:", e);
  } finally {
    var cajaLogin = document.getElementById('caja-login');
    var cajaApp = document.getElementById('caja-app');
    if (cajaLogin) cajaLogin.style.display = 'block';
    if (cajaApp) cajaApp.style.display = 'none';
  }
};

// ==========================================
// 3. OBJETO PRINCIPAL DE LA APLICACIÓN (App)
// ==========================================
window.App = {
    currentView: 'dashboard',
    activePeriod: '',
    inventorySubTab: 'inicial',
    evolucionTab: 'proveedor',
    activeUser: null,
    sidebarHidden: false,
    _isAddingRow: false,

    init: function() {
        var today = new Date();
        var yyyy = today.getFullYear();
        var mm = String(today.getMonth() + 1).padStart(2, '0');
        var dd = String(today.getDate()).padStart(2, '0');
        
        this.activePeriod = yyyy + '-' + mm;
        
        var dateBadge = document.getElementById('currentDateBadge');
        if (dateBadge) {
            dateBadge.textContent = today.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        }

        var purchaseDateInput = document.getElementById('purchaseDate');
        if (purchaseDateInput) purchaseDateInput.value = yyyy + '-' + mm + '-' + dd;

        var purchasePaymentDateInput = document.getElementById('purchasePaymentDate');
        if (purchasePaymentDateInput) purchasePaymentDateInput.value = yyyy + '-' + mm + '-' + dd;

        var cmvPeriodInput = document.getElementById('cmvPeriodInput');
        if (cmvPeriodInput) cmvPeriodInput.value = this.activePeriod;

        var invPeriodInput = document.getElementById('invPeriodInput');
        if (invPeriodInput) invPeriodInput.value = this.activePeriod;

        var purchasesMonthFilter = document.getElementById('purchasesMonthFilter');
        if (purchasesMonthFilter) purchasesMonthFilter.value = this.activePeriod;

        this.sidebarHidden = localStorage.getItem('sidebar_hidden') === 'true';
        this._applySidebarState(false);

        this.populateDropdowns();
        this.updateHeaderBusinessInfo();
        this.renderDashboard();
    },

    getLocalId: function() {
        var selector = document.getElementById('selectorLocales');
        if (!selector || !selector.value) return null;
        var val = parseInt(selector.value, 10);
        return isNaN(val) ? selector.value : val;
    },

    renderCurrentView: async function() {
        if (this.currentView === 'productos') { await this.renderProductsTable(); } 
        else if (this.currentView === 'proveedores') { await this.renderSuppliersView(); } 
        else if (this.currentView === 'compras-nueva') { this.resetPurchaseForm(); } 
        else if (this.currentView === 'compras-historial') { await this.renderPurchasesTable(); } 
        else if (this.currentView === 'dashboard') { this.renderDashboard(); }
    },

    updateHeaderBusinessInfo: function() {
        if (typeof StorageManager === 'undefined') return;
        var settings = StorageManager.getSettings();
        var headerName = document.getElementById('headerBusinessName');
        if (headerName) headerName.textContent = settings.businessName || 'Control de Stock & CMV';
    },

    toggleSidebar: function() {
        this.sidebarHidden = !this.sidebarHidden;
        localStorage.setItem('sidebar_hidden', this.sidebarHidden);
        this._applySidebarState(true);
    },

    _applySidebarState: function(animate) {
        var sidebar = document.getElementById('appSidebar');
        if (!sidebar) return;
        if (this.sidebarHidden) {
            sidebar.style.width = '0'; sidebar.style.minWidth = '0'; sidebar.style.padding = '0'; sidebar.style.overflow = 'hidden';
        } else {
            sidebar.style.width = ''; sidebar.style.minWidth = ''; sidebar.style.padding = ''; sidebar.style.overflow = '';
        }
    },

    toggleProveedoresNavMenu: function(forceState) {
        if (forceState === undefined) forceState = null;
        var submenu = document.getElementById('nav-proveedores-submenu');
        var chevron = document.getElementById('nav-proveedores-chevron');
        if (!submenu) return;
        var willOpen = forceState !== null ? forceState : submenu.classList.contains('hidden');
        if (willOpen) {
            submenu.classList.remove('hidden');
            if (chevron) chevron.classList.add('rotate-180');
        } else {
            submenu.classList.add('hidden');
            if (chevron) chevron.classList.remove('rotate-180');
        }
    },

    populateDropdowns: async function() {
        var suppliers = [];
        var categories = [];

        if (typeof SupplierManager !== 'undefined' && SupplierManager.getSuppliers) { suppliers = await SupplierManager.getSuppliers(); }
        if (typeof ProductManager !== 'undefined' && ProductManager.getCategories) { categories = await ProductManager.getCategories(); }

        var purchaseSupSelect = document.getElementById('purchaseSupplierSelect');
        if (purchaseSupSelect) {
            purchaseSupSelect.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' +
                suppliers.map(function(s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('');
        }

        var prodSupSelect = document.getElementById('prodFormSupplierSelect');
        if (prodSupSelect) {
            prodSupSelect.innerHTML = '<option value="">-- Sin proveedor --</option>' +
                suppliers.map(function(s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('');
        }

        var prodCatSelect = document.getElementById('prodFormCategorySelect');
        if (prodCatSelect) {
            prodCatSelect.innerHTML = categories.length > 0
                ? categories.map(function(c) { return '<option value="' + c.nombre + '">' + c.nombre + '</option>'; }).join('')
                : '<option value="Materia Prima">Materia Prima</option>';
        }
    },

    navigate: async function(viewId, params) {
        if (!params) params = {};
        this.currentView = viewId;
        var views = document.querySelectorAll('main > section');
        views.forEach(function(v) { v.classList.add('hidden'); });

        var targetView = document.getElementById('view-' + viewId);
        if (targetView) targetView.classList.remove('hidden');

        var navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(function(btn) {
            btn.classList.remove('bg-sky-600', 'text-white', 'shadow-sm');
            btn.classList.add('text-slate-300');
        });
        var activeNavBtn = document.getElementById('nav-' + viewId);
        if (activeNavBtn) {
            activeNavBtn.classList.remove('text-slate-300');
            activeNavBtn.classList.add('bg-sky-600', 'text-white', 'shadow-sm');
        }

        var titles = {
            'dashboard': { title: 'Panel Principal', sub: 'Resumen operativo y estado general del inventario' },
            'compras-nueva': { title: 'Cargar Factura / Gasto', sub: 'Liquidación impositiva y estado de pago' },
            'proveedores': { title: 'Directorio de Proveedores', sub: 'Fichas comerciales y datos fiscales' },
            'productos': { title: 'Insumos y Categorías', sub: 'Catálogo de existencias y costos' },
            'compras-historial': { title: 'Historial de Pagos', sub: 'Registro de facturas y cuentas a pagar' }
        };

        var pageTitle = document.getElementById('pageTitle');
        var pageSubtitle = document.getElementById('pageSubtitle');
        if (pageTitle && titles[viewId]) pageTitle.textContent = titles[viewId].title;
        if (pageSubtitle && titles[viewId]) pageSubtitle.textContent = titles[viewId].sub;

        await this.renderCurrentView();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showToast: function(message, type) {
        if (!type) type = 'success';
        var container = document.getElementById('toastContainer');
        if (!container) return;
        var toast = document.createElement('div');
        toast.className = 'pointer-events-auto px-4 py-3 rounded-xl shadow-xl text-xs font-semibold bg-emerald-600 text-white';
        toast.innerHTML = '<span>' + message + '</span>';
        container.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 3000);
    },

    renderDashboard: function() {
        var dashStockValEl = document.getElementById('dashTotalStockValue');
        if (dashStockValEl) dashStockValEl.textContent = '$ 0.00';
    },

    // ==========================================
    // MÓDULO INSUMOS
    // ==========================================
    renderProductsTable: async function() {
        var tbody = document.getElementById('productsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="11" class="py-8 text-center text-slate-400">Cargando insumos desde Supabase...</td></tr>';
        
        var products = [];
        if (typeof ProductManager !== 'undefined' && ProductManager.getProducts) {
            products = await ProductManager.getProducts();
        }

        var searchInput = document.getElementById('prodSearchInput');
        var filterVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (filterVal) {
            products = products.filter(function(p) {
                return p.name.toLowerCase().includes(filterVal) || (p.code && p.code.toLowerCase().includes(filterVal));
            });
        }

        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="py-8 text-center text-slate-400">No hay insumos para este local.</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(function(p) {
            return '<tr class="table-row-hover text-xs">' +
                '<td class="py-2.5 px-3 font-mono font-bold">' + (p.code || '-') + '</td>' +
                '<td class="py-2.5 px-4 font-semibold text-slate-800">' + p.name + '</td>' +
                '<td class="py-2.5 px-3 text-slate-500">' + (p.category || '-') + '</td>' +
                '<td class="py-2.5 px-3">Principal</td>' +
                '<td class="py-2.5 px-2 text-center font-medium">' + (p.unit || 'u.') + '</td>' +
                '<td class="py-2.5 px-3 text-right font-black">' + p.currentStock + '</td>' +
                '<td class="py-2.5 px-3 text-right text-slate-400">' + p.minStock + '</td>' +
                '<td class="py-2.5 px-3 text-right">$ ' + (p.costPrice || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '</td>' +
                '<td class="py-2.5 px-3 text-right font-bold">$ ' + ((p.currentStock || 0) * (p.costPrice || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '</td>' +
                '<td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">Normal</span></td>' +
                '<td class="py-2.5 px-3 text-right">' +
                    '<button onclick="App.openProductModal(\'' + p.id + '\')" class="p-1 text-slate-400 hover:text-indigo-600" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button> ' +
                    '<button onclick="App.deleteProductFromDb(\'' + p.id + '\')" class="p-1 text-slate-400 hover:text-red-600" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>' +
                '</td>' +
            '</tr>';
        }).join('');
    },

    openProductModal: async function(productId) {
        var form = document.getElementById('productForm');
        if (form) form.reset();

        document.getElementById('prodFormId').value = productId || '';
        document.getElementById('productModalTitle').textContent = productId ? 'Editar Insumo' : 'Nuevo Insumo / Mercadería';
        await this.populateDropdowns();

        if (productId) {
            var products = await ProductManager.getProducts();
            var p = products.find(function(item) { return item.id === productId; });
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
        var modal = document.getElementById('productModal');
        if (modal) modal.classList.remove('hidden');
    },

    closeProductModal: function() {
        var modal = document.getElementById('productModal');
        if (modal) modal.classList.add('hidden');
    },

    handleSaveProduct: async function(event) {
        event.preventDefault();
        try {
            var nameInput = document.getElementById('prodFormName');
            if (!nameInput || !nameInput.value.trim()) { alert("Por favor ingresa un nombre."); return; }

            var formData = {
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
            this.showToast('¡Insumo guardado en Supabase!', 'success');
            await this.renderProductsTable();
        } catch (e) { alert(e.message || "Error al guardar insumo"); }
    },

    deleteProductFromDb: async function(id) {
        if (!confirm('¿Deseas eliminar este insumo de Supabase?')) return;
        try {
            await ProductManager.deleteProduct(id);
            this.showToast('Insumo eliminado', 'info');
            await this.renderProductsTable();
        } catch (e) { alert(e.message); }
    },

    // ==========================================
    // MÓDULO PROVEEDORES
    // ==========================================
    renderSuppliersView: async function() {
        var tbody = document.getElementById('suppliersTableBody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-400">Cargando proveedores desde Supabase...</td></tr>';
        
        var suppliers = [];
        if (typeof SupplierManager !== 'undefined' && SupplierManager.getSuppliers) {
            suppliers = await SupplierManager.getSuppliers();
        }

        var searchInput = document.getElementById('supplierSearchInput');
        var filterVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (filterVal) {
            suppliers = suppliers.filter(function(s) {
                return s.name.toLowerCase().includes(filterVal) || (s.cuit && s.cuit.includes(filterVal));
            });
        }

        var badge = document.getElementById('suppliersTotalBadge');
        if (badge) badge.textContent = suppliers.length + ' proveedores';

        if (suppliers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-400">No hay proveedores para este local.</td></tr>';
            return;
        }

        tbody.innerHTML = suppliers.map(function(s) {
            return '<tr class="table-row-hover text-xs">' +
                '<td class="py-3 px-4 font-bold text-slate-900">' + s.name + '</td>' +
                '<td class="py-3 px-3 font-mono">' + (s.cuit || '-') + '</td>' +
                '<td class="py-3 px-3">' + (s.contactPerson || '-') + '</td>' +
                '<td class="py-3 px-3">' + (s.phone || '-') + '</td>' +
                '<td class="py-3 px-3">' + (s.email || '-') + '</td>' +
                '<td class="py-3 px-3">' + (s.paymentMethods || '-') + '</td>' +
                '<td class="py-3 px-2 text-center">--</td>' +
                '<td class="py-3 px-4 text-right">' +
                    '<button onclick="App.openSupplierModal(\'' + s.id + '\')" class="p-1 text-slate-500 hover:text-teal-600" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button> ' +
                    '<button onclick="App.deleteSupplierFromDb(\'' + s.id + '\')" class="p-1 text-slate-400 hover:text-red-600" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>' +
                '</td>' +
            '</tr>';
        }).join('');
    },

    openSupplierModal: async function(supplierId) {
        var form = document.getElementById('supplierForm');
        if (form) form.reset();

        document.getElementById('supFormId').value = supplierId || '';
        document.getElementById('supplierModalTitle').textContent = supplierId ? 'Editar Proveedor' : 'Nuevo Proveedor';

        if (supplierId) {
            var suppliers = await SupplierManager.getSuppliers();
            var s = suppliers.find(function(item) { return item.id === supplierId; });
            if (s) {
                document.getElementById('supFormName').value = s.name || '';
                document.getElementById('supFormCuit').value = s.cuit || '';
                document.getElementById('supFormCategory').value = s.category || '';
                document.getElementById('supFormPhone').value = s.phone || '';
                document.getElementById('supFormEmail').value = s.email || '';
            }
        }
        var modal = document.getElementById('supplierModal');
        if (modal) modal.classList.remove('hidden');
    },

    closeSupplierModal: function() {
        var modal = document.getElementById('supplierModal');
        if (modal) modal.classList.add('hidden');
    },

    handleSaveSupplier: async function(event) {
        event.preventDefault();
        try {
            var nameInput = document.getElementById('supFormName');
            if (!nameInput || !nameInput.value.trim()) { alert("Por favor ingresa un nombre."); return; }

            var formData = {
                id: document.getElementById('supFormId').value || undefined,
                name: nameInput.value.trim(),
                cuit: document.getElementById('supFormCuit').value.trim(),
                category: document.getElementById('supFormCategory').value.trim(),
                phone: document.getElementById('supFormPhone').value.trim(),
                email: document.getElementById('supFormEmail').value.trim()
            };

            await SupplierManager.saveSupplier(formData);
            this.closeSupplierModal();
            this.showToast('¡Proveedor guardado en Supabase!', 'success');
            await this.renderSuppliersView();
        } catch (e) { alert(e.message || "Error al guardar proveedor"); }
    },

    deleteSupplierFromDb: async function(id) {
        if (!confirm('¿Deseas eliminar este proveedor de Supabase?')) return;
        try {
            await SupplierManager.deleteSupplier(id);
            this.showToast('Proveedor eliminado', 'info');
            await this.renderSuppliersView();
        } catch (e) { alert(e.message); }
    },

    // ==========================================
    // MÓDULO COMPRAS - TECLADO Y CÁLCULOS
    // ==========================================

    handlePurchaseFormKeydown: function(e) {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
            e.preventDefault();
            e.stopPropagation();
        }
    },

    handlePurchaseRowKeydown: function(e) {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
            e.preventDefault();
            e.stopPropagation();
        }
    },

    handlePurchaseDateChange: function(val) {},
    handlePurchaseSupplierChange: function(val) {},
    handlePurchasePaymentStatusChange: function(val) {},
    cancelPurchaseEdit: function() {},

    handleRowKeydown: function(e, element, type) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();

            var row = element.closest('tr');
            if (!row) return;
            var tbody = row.parentElement;
            
            if (type === 'select') {
                if (!element.value) {
                    if (typeof element.showPicker === 'function') {
                        try { 
                            element.showPicker(); 
                        } catch(err) {
                            var q1 = row.querySelector('.row-qty-input');
                            if (q1) { q1.focus(); q1.select(); }
                        }
                    }
                } else {
                    var q2 = row.querySelector('.row-qty-input');
                    if (q2) { q2.focus(); q2.select(); }
                }
            } 
            else if (type === 'qty') {
                var cost = row.querySelector('.row-cost-input');
                if (cost) { cost.focus(); cost.select(); }
            }
            else if (type === 'cost' || type === 'desc') {
                var isLastRow = (row === tbody.lastElementChild);
                if (isLastRow) {
                    App.addPurchaseRow('', 1, 0, 0, 0, true);
                } else {
                    var nextRow = row.nextElementSibling;
                    if (nextRow) {
                        var nextSelect = nextRow.querySelector('.row-product-select');
                        if (nextSelect) { nextSelect.focus(); }
                    }
                }
            }
        }
    },

    resetPurchaseForm: function() {
        var form = document.getElementById('purchaseForm');
        if (form) form.reset();

        var today = new Date().toISOString().split('T')[0];
        var pDate = document.getElementById('purchaseDate');
        if (pDate) pDate.value = today;

        var pPayDate = document.getElementById('purchasePaymentDate');
        if (pPayDate) pPayDate.value = today;

        var tbody = document.getElementById('purchaseItemsTableBody');
        if (tbody) {
            tbody.innerHTML = '';
            this.addPurchaseRow('', 1, 0, 0, 0, false);
        }

        var editId = document.getElementById('purchaseEditId');
        if (editId) editId.value = '';

        var banner = document.getElementById('purchaseEditBanner');
        if (banner) banner.classList.add('hidden');

        this.calculatePurchaseTotals();
    },

    addPurchaseRow: function(defaultProductId, defaultQty, defaultCost, defaultDiscount, defaultDiscountRate, autoFocus) {
        if (this._isAddingRow) return;
        this._isAddingRow = true;
        var self = this;
        setTimeout(function() { self._isAddingRow = false; }, 150);

        if (defaultProductId === undefined) defaultProductId = '';
        if (defaultQty === undefined) defaultQty = 1;
        if (defaultCost === undefined) defaultCost = 0;
        if (autoFocus === undefined) autoFocus = true;

        var tbody = document.getElementById('purchaseItemsTableBody');
        if (!tbody) return;

        var row = document.createElement('tr');
        row.className = 'purchase-item-row table-row-hover text-xs';

        row.innerHTML = 
            '<td class="py-2 px-2.5">' +
                '<select required onchange="App.updatePurchaseRowProduct(this)" onkeydown="App.handleRowKeydown(event, this, \'select\')" class="row-product-select w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs">' +
                    '<option value="">Cargando insumos...</option>' +
                '</select>' +
            '</td>' +
            '<td class="py-2 px-2 text-center text-slate-500 font-bold row-unit">u.</td>' +
            '<td class="py-2 px-2">' +
                '<input type="number" step="any" min="0" value="' + defaultQty + '" oninput="App.calculatePurchaseTotals()" onkeydown="App.handleRowKeydown(event, this, \'qty\')" class="row-qty-input w-full bg-slate-50 border rounded-lg px-2 py-1.5 text-xs">' +
            '</td>' +
            '<td class="py-2 px-2">' +
                '<input type="number" step="any" min="0" value="' + defaultCost + '" oninput="App.calculatePurchaseTotals()" onkeydown="App.handleRowKeydown(event, this, \'cost\')" class="row-cost-input w-full bg-slate-50 border rounded-lg px-2 py-1.5 text-xs">' +
            '</td>' +
            '<td class="py-2 px-2">' +
                '<input type="number" step="any" min="0" value="0" oninput="App.calculatePurchaseTotals()" onkeydown="App.handleRowKeydown(event, this, \'desc\')" class="row-discount-val w-full bg-slate-50 border rounded-lg px-2 py-1.5 text-xs">' +
            '</td>' +
            '<td class="py-2 px-3 text-right font-black text-slate-800 row-subtotal">$ 0.00</td>' +
            '<td class="py-2 px-2 text-center">' +
                '<button type="button" onclick="App.removePurchaseRow(this)" class="text-slate-400 hover:text-red-600" title="Eliminar renglón"><i class="fa-solid fa-trash-can"></i></button>' +
            '</td>';

        tbody.appendChild(row);
        this.calculatePurchaseTotals();
        
        if (autoFocus) {
            setTimeout(function() {
                var newSelect = row.querySelector('.row-product-select');
                if (newSelect) newSelect.focus();
            }, 15);
        }

        this._populateRowProducts(row, defaultProductId);
    },

    _populateRowProducts: async function(row, defaultProductId) {
        var select = row.querySelector('.row-product-select');
        if (!select) return;

        var products = [];
        try {
            if (typeof ProductManager !== 'undefined' && ProductManager.getProducts) {
                products = await ProductManager.getProducts();
            }
        } catch (e) { }

        if (products && products.length > 0) {
            var optionsHtml = '<option value="">-- Seleccionar Insumo --</option>' + products.map(function(p) {
                var selected = (p.id === defaultProductId) ? 'selected' : '';
                return '<option value="' + p.id + '" data-cost="' + (p.costPrice || 0) + '" data-unit="' + (p.unit || 'u.') + '" ' + selected + '>' + p.name + '</option>';
            }).join('');
            if (select.value === '') select.innerHTML = optionsHtml;
        } else {
            select.innerHTML = '<option value="">-- Sin insumos creados --</option>';
        }
    },

    updatePurchaseRowProduct: function(selectEl) {
        var row = selectEl.closest('tr');
        if (!row) return;

        var selectedOption = selectEl.options[selectEl.selectedIndex];
        if (selectedOption && selectedOption.value) {
            var cost = selectedOption.getAttribute('data-cost') || 0;
            var unit = selectedOption.getAttribute('data-unit') || 'u.';
            
            var costInput = row.querySelector('.row-cost-input');
            if (costInput && (!costInput.value || parseFloat(costInput.value) === 0)) {
                costInput.value = cost;
            }
            var unitTd = row.querySelector('.row-unit');
            if (unitTd) unitTd.textContent = unit;
        }
        this.calculatePurchaseTotals();
    },

    removePurchaseRow: function(btn) {
        if (!btn) return;
        var row = btn.closest ? btn.closest('tr') : null;
        if (row) {
            row.remove();
            this.calculatePurchaseTotals();
        }
    },

    // ====================================================
    // CÁLCULO DE TOTALES DE LA FACTURA (IDs EXACTOS DEL HTML)
    // ====================================================

    calculatePurchaseTotals: function() {
        var rows = document.querySelectorAll('.purchase-item-row');
        var netSubtotal = 0;
        var grossSubtotal = 0;
        var totalDiscount = 0;

        rows.forEach(function(row) {
            var qty = parseFloat(row.querySelector('.row-qty-input')?.value) || 0;
            var cost = parseFloat(row.querySelector('.row-cost-input')?.value) || 0;
            var desc = parseFloat(row.querySelector('.row-discount-val')?.value) || 0;

            var rowGross = qty * cost;
            var rowNet = Math.max(0, rowGross - desc);

            var subtotalEl = row.querySelector('.row-subtotal');
            if (subtotalEl) {
                subtotalEl.textContent = '$ ' + rowNet.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }

            grossSubtotal += rowGross;
            totalDiscount += desc;
            netSubtotal += rowNet;
        });

        // 1. Escribir Subtotal Neto Gravado en el input
        var taxNetInput = document.getElementById('taxNetSubtotal');
        if (taxNetInput) taxNetInput.value = netSubtotal.toFixed(2);

        // 2. Calcular IVA
        var ivaRateSelect = document.getElementById('taxIvaRate');
        var ivaRate = ivaRateSelect ? (parseFloat(ivaRateSelect.value) || 0) : 21;
        var ivaAmount = (netSubtotal * ivaRate) / 100;
        var ivaAmountInput = document.getElementById('taxIvaAmount');
        if (ivaAmountInput) ivaAmountInput.value = ivaAmount.toFixed(2);

        // 3. Calcular IIBB
        var iibbRateInput = document.getElementById('taxIibbRate');
        var iibbRate = iibbRateInput ? (parseFloat(iibbRateInput.value) || 0) : 0;
        var iibbAmount = (netSubtotal * iibbRate) / 100;
        var iibbAmountInput = document.getElementById('taxIibbAmount');
        if (iibbAmountInput) iibbAmountInput.value = iibbAmount.toFixed(2);

        // 4. Percepciones e Impuestos adicionales
        var ivaPerception = parseFloat(document.getElementById('taxIvaPerception')?.value) || 0;
        var otherTaxes = parseFloat(document.getElementById('taxOtherTaxes')?.value) || 0;

        var totalTaxes = ivaAmount + iibbAmount + ivaPerception + otherTaxes;
        var totalInvoice = netSubtotal + totalTaxes;

        // 5. Actualizar los textos del Footer
        var grossEl = document.getElementById('footerGrossSubtotal');
        if (grossEl) grossEl.textContent = '$ ' + grossSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        var discRow = document.getElementById('footerDiscountRow');
        var discEl = document.getElementById('footerDiscountAmount');
        if (discRow && discEl) {
            if (totalDiscount > 0) {
                discRow.classList.remove('hidden');
                discEl.textContent = '- $ ' + totalDiscount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else {
                discRow.classList.add('hidden');
            }
        }

        var netEl = document.getElementById('footerNetSubtotal');
        if (netEl) netEl.textContent = '$ ' + netSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        var taxesEl = document.getElementById('footerTotalTaxes');
        if (taxesEl) taxesEl.textContent = '$ ' + totalTaxes.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        var totalEl = document.getElementById('purchaseTotalAmount');
        if (totalEl) totalEl.textContent = '$ ' + totalInvoice.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    recalculateTaxesFromRate: function() {
        var netSubtotal = parseFloat(document.getElementById('taxNetSubtotal')?.value) || 0;
        var ivaRate = parseFloat(document.getElementById('taxIvaRate')?.value) || 0;
        var ivaAmount = (netSubtotal * ivaRate) / 100;
        
        var ivaInput = document.getElementById('taxIvaAmount');
        if (ivaInput) ivaInput.value = ivaAmount.toFixed(2);

        this.recalculateTotalInvoiceFromInputs();
    },

    recalculateIibbFromRate: function() {
        var netSubtotal = parseFloat(document.getElementById('taxNetSubtotal')?.value) || 0;
        var iibbRate = parseFloat(document.getElementById('taxIibbRate')?.value) || 0;
        var iibbAmount = (netSubtotal * iibbRate) / 100;

        var iibbInput = document.getElementById('taxIibbAmount');
        if (iibbInput) iibbInput.value = iibbAmount.toFixed(2);

        this.recalculateTotalInvoiceFromInputs();
    },

    recalculateTotalInvoiceFromInputs: function() {
        var netSubtotal = parseFloat(document.getElementById('taxNetSubtotal')?.value) || 0;
        var ivaAmount = parseFloat(document.getElementById('taxIvaAmount')?.value) || 0;
        var iibbAmount = parseFloat(document.getElementById('taxIibbAmount')?.value) || 0;
        var ivaPerception = parseFloat(document.getElementById('taxIvaPerception')?.value) || 0;
        var otherTaxes = parseFloat(document.getElementById('taxOtherTaxes')?.value) || 0;

        var totalTaxes = ivaAmount + iibbAmount + ivaPerception + otherTaxes;
        var totalInvoice = netSubtotal + totalTaxes;

        var netEl = document.getElementById('footerNetSubtotal');
        if (netEl) netEl.textContent = '$ ' + netSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        var taxesEl = document.getElementById('footerTotalTaxes');
        if (taxesEl) taxesEl.textContent = '$ ' + totalTaxes.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        var totalEl = document.getElementById('purchaseTotalAmount');
        if (totalEl) totalEl.textContent = '$ ' + totalInvoice.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    handleSavePurchase: async function(event) {
        if (event) event.preventDefault();

        try {
            var supplierSelect = document.getElementById('purchaseSupplierSelect');
            var supplierId = supplierSelect ? supplierSelect.value : '';
            var supplierName = (supplierSelect && supplierSelect.selectedIndex >= 0) ? supplierSelect.options[supplierSelect.selectedIndex].text : 'Sin Proveedor';

            var pDateEl = document.getElementById('purchaseDate');
            var purchaseDate = pDateEl ? pDateEl.value : new Date().toISOString().split('T')[0];

            var invNumEl = document.getElementById('purchaseInvoice');
            var invoiceNum = invNumEl ? invNumEl.value : 'S/N';

            var pStatusEl = document.getElementById('purchasePaymentStatus');
            var paymentStatus = pStatusEl ? pStatusEl.value : 'pagada';

            var pMethodEl = document.getElementById('purchasePaymentMethod');
            var paymentMethod = pMethodEl ? pMethodEl.value : 'Efectivo';

            var pPayDateEl = document.getElementById('purchasePaymentDate');
            var paymentDate = pPayDateEl ? pPayDateEl.value : purchaseDate;

            var rows = document.querySelectorAll('.purchase-item-row');
            var items = [];
            var calcNetSubtotal = 0;

            rows.forEach(function(row) {
                var select = row.querySelector('.row-product-select');
                var productId = select ? select.value : '';
                var productName = (select && select.selectedIndex >= 0) ? select.options[select.selectedIndex].text : '';
                
                var qty = parseFloat(row.querySelector('.row-qty-input')?.value) || 0;
                var cost = parseFloat(row.querySelector('.row-cost-input')?.value) || 0;
                var discountVal = parseFloat(row.querySelector('.row-discount-val')?.value) || 0;
                
                var subtotal = Math.max(0, (qty * cost) - discountVal);
                calcNetSubtotal += subtotal;

                if (productId && qty > 0) {
                    items.push({ productId: productId, productName: productName, qty: qty, cost: cost, discountVal: discountVal, subtotal: subtotal });
                }
            });

            if (items.length === 0) {
                alert("Debes seleccionar al menos un insumo con cantidad mayor a 0.");
                return;
            }

            var ivaAmount = parseFloat(document.getElementById('taxIvaAmount')?.value) || 0;
            var iibbAmount = parseFloat(document.getElementById('taxIibbAmount')?.value) || 0;
            var ivaPerception = parseFloat(document.getElementById('taxIvaPerception')?.value) || 0;
            var otherTaxes = parseFloat(document.getElementById('taxOtherTaxes')?.value) || 0;

            var sumOthers = ivaPerception + otherTaxes;
            var totalInvoice = calcNetSubtotal + ivaAmount + iibbAmount + sumOthers;

            var notesEl = document.getElementById('purchaseNotes');
            var notes = notesEl ? notesEl.value : '';

            var purchaseData = {
                date: purchaseDate,
                supplierId: supplierId,
                supplierName: supplierName,
                invoiceNumber: invoiceNum,
                paymentStatus: paymentStatus,
                paymentMethod: paymentMethod,
                paymentDate: paymentDate,
                netSubtotal: calcNetSubtotal,
                ivaAmount: ivaAmount,
                iibbAmount: iibbAmount,
                otherTaxes: sumOthers,
                totalInvoice: totalInvoice,
                notes: notes,
                items: items
            };

            await PurchaseManager.savePurchase(purchaseData);
            this.showToast('¡Factura guardada y stock actualizado!', 'success');
            this.resetPurchaseForm();
            await this.navigate('compras-historial');
        } catch (e) {
            alert(e.message || "Error al guardar la compra");
        }
    },

    renderPurchasesTable: async function() {
        var tbody = document.getElementById('purchasesHistoryTableBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-slate-400">Cargando facturas desde Supabase...</td></tr>';

        var purchases = [];
        if (typeof PurchaseManager !== 'undefined' && PurchaseManager.getPurchases) {
            purchases = await PurchaseManager.getPurchases();
        }

        if (purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-slate-400">No hay facturas cargadas para este local.</td></tr>';
            return;
        }

        tbody.innerHTML = purchases.map(function(p) {
            return '<tr class="table-row-hover text-xs">' +
                '<td class="py-2.5 px-3">' + (p.date || '-') + '</td>' +
                '<td class="py-2.5 px-3 font-mono font-bold">' + (p.invoiceNumber || 'S/N') + '</td>' +
                '<td class="py-2.5 px-4 font-semibold">' + (p.supplier || '-') + '</td>' +
                '<td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">✓ ' + p.paymentStatus + '</span></td>' +
                '<td class="py-2.5 px-3">' + (p.paymentMethod || 'Efectivo') + '</td>' +
                '<td class="py-2.5 px-3 text-right">$ ' + (p.netSubtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '</td>' +
                '<td class="py-2.5 px-3 text-right">$ ' + (p.ivaAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '</td>' +
                '<td class="py-2.5 px-4 text-right font-black">$ ' + (p.totalInvoice || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '</td>' +
                '<td class="py-2.5 px-3 text-right">' +
                    '<button onclick="App.deletePurchaseFromDb(\'' + p.id + '\')" class="p-1 text-slate-400 hover:text-red-600" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>' +
                '</td>' +
            '</tr>';
        }).join('');
    },

    deletePurchaseFromDb: async function(id) {
        if (!confirm('¿Deseas eliminar esta compra de Supabase?')) return;
        try {
            await PurchaseManager.deletePurchase(id);
            this.showToast('Compra eliminada', 'info');
            await this.renderPurchasesTable();
        } catch (e) {
            alert(e.message);
        }
    },

    // Métodos auxiliares y modales secundarios
    renderOCHistoryTable: function() {},
    renderInventorySheets: function() {},
    renderCMVView: function() {},
    renderEvolucionProveedor: function() {},
    renderUsersTable: function() {},
    openUserModal: function() { var m = document.getElementById('userModal'); if(m) m.classList.remove('hidden'); },
    closeUserModal: function() { var m = document.getElementById('userModal'); if(m) m.classList.add('hidden'); },
    openSnapshotModal: function() { var m = document.getElementById('snapshotModal'); if(m) m.classList.remove('hidden'); },
    closeSnapshotModal: function() { var m = document.getElementById('snapshotModal'); if(m) m.classList.add('hidden'); },
    openCategoryManagerModal: function() { var m = document.getElementById('categoryManagerModal'); if(m) m.classList.remove('hidden'); },
    closeCategoryManagerModal: function() { var m = document.getElementById('categoryManagerModal'); if(m) m.classList.add('hidden'); },
    openPaymentModal: function() { var m = document.getElementById('paymentModal'); if(m) m.classList.remove('hidden'); },
    closePaymentModal: function() { var m = document.getElementById('paymentModal'); if(m) m.classList.add('hidden'); },
    openImportModal: function() { var m = document.getElementById('importModal'); if(m) m.classList.remove('hidden'); },
    closeImportModal: function() { var m = document.getElementById('importModal'); if(m) m.classList.add('hidden'); },
    handleSaveUser: function(e) { e.preventDefault(); this.closeUserModal(); },
    handleSavePayment: function(e) { e.preventDefault(); this.closePaymentModal(); },
    handleSaveCategory: function(e) { e.preventDefault(); this.closeCategoryManagerModal(); },
    saveSettings: function(e) { e.preventDefault(); this.showToast('Configuración guardada'); },
    setInventorySubTab: function(tab) {},
    switchEvolucionTab: function(tab) {},
    changePeriod: function(delta) {},
    handlePeriodChange: function(val) {},
    loadDemoData: function() { this.showToast('Datos de prueba cargados'); }
};

window.App = window.App;

// ==========================================
// 4. CARGA DE LOCALES Y DETECTOR DE SESIÓN
// ==========================================
async function cargarLocalesDelUsuario() {
  try {
    if (!window.db || !window.db.auth) return [];
    var authRes = await window.db.auth.getUser();
    var user = authRes && authRes.data ? authRes.data.user : null;
    if (!user) return [];

    var localesDisponibles = [];

    try {
      var perfilRes = await window.db.from('Perfiles').select('rol').eq('id', user.id).maybeSingle();
      var perfil = perfilRes ? perfilRes.data : null;
      var rolActual = perfil ? perfil.rol : 'SUPERADMIN';

      if (rolActual === 'SUPERADMIN') {
        var locRes = await window.db.from('Locales').select('*').order('id', { ascending: true });
        localesDisponibles = locRes && locRes.data ? locRes.data : [];
      } else {
        var relRes = await window.db.from('Usuarios_Locales').select('local_id, Locales(*)').eq('perfil_id', user.id);
        if (relRes && relRes.data) {
          localesDisponibles = relRes.data.map(function(item) { return item.Locales; }).filter(Boolean);
        }
      }
    } catch (e) { console.warn("Cargando locales generales...", e); }

    if (!localesDisponibles || localesDisponibles.length === 0) {
      var allLocRes = await window.db.from('Locales').select('*').order('id', { ascending: true });
      localesDisponibles = allLocRes && allLocRes.data ? allLocRes.data : [];
    }

    var selector = document.getElementById('selectorLocales');
    if (selector) {
      if (localesDisponibles.length === 0) {
        selector.innerHTML = '<option value="">Sin locales en BD</option>';
      } else {
        selector.innerHTML = localesDisponibles.map(function(local) {
          return '<option value="' + local.id + '">' + local.nombre_local + '</option>';
        }).join('');
        selector.value = localesDisponibles[0].id;
      }

      var nuevoSelector = selector.cloneNode(true);
      if (selector.parentNode) selector.parentNode.replaceChild(nuevoSelector, selector);

      nuevoSelector.addEventListener('change', async function() {
        if (window.App) {
          await window.App.populateDropdowns();
          await window.App.renderCurrentView();
        }
      });
    }

    if (window.App) {
      await window.App.populateDropdowns();
      await window.App.renderCurrentView();
    }

    return localesDisponibles;
  } catch (err) { console.error("Error al cargar locales:", err); }
}

if (window.db && window.db.auth) {
  window.db.auth.onAuthStateChange(function(event, session) {
    var cajaLogin = document.getElementById('caja-login');
    var cajaApp = document.getElementById('caja-app');

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