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

        // Evita enviar el formulario accidentalmente al presionar Enter en toda la app
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
                if (e.target.closest('form')) { e.preventDefault(); }
            }
        });

        // Recalcular automáticamente si el usuario escribe en cualquier input de la vista compras
        document.addEventListener('input', function(e) {
            if (App.currentView === 'compras-nueva' && e.target.tagName === 'INPUT') {
                App.calculatePurchaseTotals();
            }
        });
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
            'dashboard': { title: 'Panel Principal', sub: 'Resumen operativo' },
            'compras-nueva': { title: 'Cargar Factura / Gasto', sub: 'Liquidación impositiva y carga de stock' },
            'proveedores': { title: 'Proveedores', sub: 'Fichas comerciales' },
            'productos': { title: 'Insumos', sub: 'Catálogo de existencias' },
            'compras-historial': { title: 'Historial', sub: 'Registro de facturas' }
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
        tbody.innerHTML = '<tr><td colspan="11" class="py-8 text-center text-slate-400">Cargando insumos...</td></tr>';
        
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
            tbody.innerHTML = '<tr><td colspan="11" class="py-8 text-center text-slate-400">No hay insumos.</td></tr>';
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
                '<td class="py-2.5 px-3 text-right">$ ' + p.costPrice.toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '</td>' +
                '<td class="py-2.5 px-3 text-right font-bold">$ ' + (p.currentStock * p.costPrice).toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '</td>' +
                '<td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">Normal</span></td>' +
                '<td class="py-2.5 px-3 text-right">' +
                    '<button onclick="App.openProductModal(\'' + p.id + '\')" class="p-1 text-slate-400 hover:text-indigo-600"><i class="fa-solid fa-pen-to-square"></i></button> ' +
                    '<button onclick="App.deleteProductFromDb(\'' + p.id + '\')" class="p-1 text-slate-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>' +
                '</td></tr>';
        }).join('');
    },

    openProductModal: async function(productId) {
        var form = document.getElementById('productForm');
        if (form) form.reset();
        document.getElementById('prodFormId').value = productId || '';
        document.getElementById('productModalTitle').textContent = productId ? 'Editar Insumo' : 'Nuevo Insumo';
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
            if (!nameInput || !nameInput.value.trim()) { alert("Ingresa un nombre."); return; }
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
            this.showToast('¡Insumo guardado!', 'success');
            await this.renderProductsTable();
        } catch (e) { alert(e.message); }
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
        tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-400">Cargando proveedores...</td></tr>';
        
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
            tbody.innerHTML = '<tr><td colspan="8" class="py-8 text-center text-slate-400">No hay proveedores.</td></tr>';
            return;
        }

        tbody.innerHTML = suppliers.map(function(s) {
            return '<tr class="table-row-hover text-xs">' +
                '<td class="py-3 px-4 font-bold text-slate-900">' + s.name + '</td>' +
                '<td class="py-3 px-3 font-mono">' + (s.cuit || '-') + '</td>' +
                '<td class="py-3 px-3">' + (s.contactPerson || '-') + '</td>' +
                '<td class="py-3 px-3">' + (s.phone || '-') + '</td>' +
                '<td class="py-3 px-3">' + (s.email || '-') + '</td>' +
                '<td class="py-3 px-3">' + s.paymentMethods + '</td>' +
                '<td class="py-3 px-2 text-center">--</td>' +
                '<td class="py-3 px-4 text-right">' +
                    '<button onclick="App.openSupplierModal(\'' + s.id + '\')" class="p-1 text-slate-500 hover:text-teal-600"><i class="fa-solid fa-pen-to-square"></i></button> ' +
                    '<button onclick="App.deleteSupplierFromDb(\'' + s.id + '\')" class="p-1 text-slate-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>' +
                '</td></tr>';
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
            if (!nameInput || !nameInput.value.trim()) { alert("Ingresa un nombre."); return; }
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
            this.showToast('¡Proveedor guardado!', 'success');
            await this.renderSuppliersView();
        } catch (e) { alert(e.message); }
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
    // MÓDULO COMPRAS - TECLADO Y CÁLCULOS ROBUSTOS
    // ==========================================

    // Navegación secuencial exacta sin robar foco al tipear
    handleRowKeydown: function(e, element, type) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();

            var row = element.closest('tr');
            if (!row) return;
            var tbody = row.parentElement;
            
            if (type === 'select') {
                if (!element.value) {
                    // Si está vacío, intentar abrir lista
                    if (typeof element.showPicker === 'function') {
                        try { element.showPicker(); } catch(err) {
                            row.querySelector('.row-qty-input')?.focus();
                        }
                    }
                } else {
                    // Si tiene valor, saltar a cantidad
                    var qty = row.querySelector('.row-qty-input');
                    if (qty) { qty.focus(); qty.select(); }
                }
            } 
            else if (type === 'qty') {
                var cost = row.querySelector('.row-cost-input');
                if (cost) { cost.focus(); cost.select(); }
            }
            else if (type === 'cost' || type === 'desc') {
                var isLastRow = (row === tbody.lastElementChild);
                if (isLastRow) {
                    App.addPurchaseRow('', 1, 0, true);
                } else {
                    var nextRow = row.nextElementSibling;
                    if (nextRow) {
                        nextRow.querySelector('.row-product-select')?.focus();
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

        var tbody = document.getElementById('purchaseItemsTableBody') || 
                    document.getElementById('purchaseItemsBody') ||
                    document.getElementById('purchaseTableBody');
        if (tbody) {
            tbody.innerHTML = '';
            this.addPurchaseRow('', 1, 0, false);
        }

        this.calculatePurchaseTotals();
    },

    addPurchaseRow: function(defaultProductId, defaultQty, defaultCost, autoFocus) {
        if (this._isAddingRow) return;
        this._isAddingRow = true;
        
        try {
            if (defaultProductId === undefined) defaultProductId = '';
            if (defaultQty === undefined) defaultQty = 1;
            if (defaultCost === undefined) defaultCost = 0;
            if (autoFocus === undefined) autoFocus = true;

            var tbody = document.getElementById('purchaseItemsTableBody') || 
                        document.getElementById('purchaseItemsBody') ||
                        document.getElementById('purchaseTableBody');
            if (!tbody) return;

            var row = document.createElement('tr');
            row.className = 'purchase-item-row table-row-hover text-xs';

            row.innerHTML = 
                '<td class="py-2 px-2.5">' +
                    '<select required onchange="App.updatePurchaseRowProduct(this)" onkeydown="App.handleRowKeydown(event, this, \'select\')" class="row-product-select w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs">' +
                        '<option value="">Buscando insumos...</option>' +
                    '</select>' +
                '</td>' +
                '<td class="py-2 px-2 text-center text-slate-500 font-bold row-unit">u.</td>' +
                '<td class="py-2 px-2">' +
                    '<input type="number" step="any" min="0" value="' + defaultQty + '" onkeydown="App.handleRowKeydown(event, this, \'qty\')" class="row-qty-input w-full bg-slate-50 border rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-sky-500">' +
                '</td>' +
                '<td class="py-2 px-2">' +
                    '<input type="number" step="any" min="0" value="' + defaultCost + '" onkeydown="App.handleRowKeydown(event, this, \'cost\')" class="row-cost-input w-full bg-slate-50 border rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-sky-500">' +
                '</td>' +
                '<td class="py-2 px-2">' +
                    '<input type="number" step="any" min="0" value="0" onkeydown="App.handleRowKeydown(event, this, \'desc\')" class="row-discount-val w-full bg-slate-50 border rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-sky-500">' +
                '</td>' +
                '<td class="py-2 px-3 text-right font-black text-slate-800 row-subtotal">$ 0.00</td>' +
                '<td class="py-2 px-2 text-center">' +
                    '<button type="button" onclick="App.removePurchaseRow(this)" class="text-slate-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>' +
                '</td>';

            tbody.appendChild(row);
            this.calculatePurchaseTotals();
            
            if (autoFocus) {
                setTimeout(function() {
                    var ns = row.querySelector('.row-product-select');
                    if (ns) ns.focus();
                }, 10);
            }

            this._populateRowProducts(row, defaultProductId);
        } finally {
            setTimeout(() => { this._isAddingRow = false; }, 150);
        }
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
            var optionsHtml = '<option value="">-- Buscar / Seleccionar --</option>' + products.map(function(p) {
                var selected = (p.id === defaultProductId) ? 'selected' : '';
                return '<option value="' + p.id + '" data-cost="' + (p.costPrice || 0) + '" data-unit="' + (p.unit || 'u.') + '" ' + selected + '>' + p.name + '</option>';
            }).join('');
            if (select.value === '') select.innerHTML = optionsHtml;
        } else {
            select.innerHTML = '<option value="">-- Sin insumos --</option>';
        }
    },

    // Actualiza valores PERO NO ROBA EL FOCO para que el usuario pueda escribir/buscar con teclado
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

    // BUSCADOR UNIVERSAL DE ELEMENTOS DE TOTALES (Ignora diferencias de nombres en tu HTML)
    calculatePurchaseTotals: function() {
        var rows = document.querySelectorAll('.purchase-item-row');
        var netSubtotal = 0;

        // 1. Calcular cada renglón
        rows.forEach(function(row) {
            var qty = parseFloat(row.querySelector('.row-qty-input')?.value) || 0;
            var cost = parseFloat(row.querySelector('.row-cost-input')?.value) || 0;
            var desc = parseFloat(row.querySelector('.row-discount-val')?.value) || 0;

            var rowSub = Math.max(0, (qty * cost) - desc);
            var subtotalEl = row.querySelector('.row-subtotal');
            if (subtotalEl) {
                subtotalEl.textContent = '$ ' + rowSub.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            netSubtotal += rowSub;
        });

        // 2. Extraer Valores Limpios
        var val = function(ids) {
            for(var i=0; i<ids.length; i++) {
                var el = document.getElementById(ids[i]);
                if(el) {
                    var raw = el.tagName === 'INPUT' || el.tagName === 'SELECT' ? el.value : el.textContent;
                    var str = String(raw).replace(/\$/g, '').replace(/\s/g, '');
                    if(str.includes(',') && str.includes('.')) str = str.replace(/\./g, '').replace(',', '.');
                    else if(str.includes(',')) str = str.replace(',', '.');
                    str = str.replace(/[^0-9.-]/g, '');
                    return parseFloat(str) || 0;
                }
            }
            return 0;
        };

        // 3. Escribir Resultados Formateados
        var setVal = function(ids, num) {
            for(var i=0; i<ids.length; i++) {
                var el = document.getElementById(ids[i]);
                if(el) {
                    if(el.tagName === 'INPUT') el.value = num.toFixed(2);
                    else el.textContent = '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            }
        };

        // Obtener tasas e impuestos que el usuario tipeó manualmente
        var ivaRate = val(['purchaseIvaRate', 'tasaIva', 'ivaRate', 'tasa_iva']);
        var iibbRate = val(['purchaseIibbRate', 'tasaIibb', 'iibbRate', 'tasa_iibb']);
        var otherTaxes = val(['purchaseOtherTaxes', 'otrosImpuestos', 'percepciones', 'purchasePercepciones', 'otros_impuestos', 'percepcionIva', 'percepcionIibb']);

        // Calcular importes de impuestos
        var ivaAmount = (netSubtotal * ivaRate) / 100;
        var iibbAmount = (netSubtotal * iibbRate) / 100;

        // Escribir a la pantalla en todos los casilleros posibles que tengas
        setVal(['purchaseSubtotalNet', 'subtotalNeto', 'subtotal', 'subtotal_neto', 'subtotalNetoGravado', 'netoGravado'], netSubtotal);
        setVal(['purchaseIvaAmount', 'montoIva', 'ivaAmount', 'monto_iva'], ivaAmount);
        setVal(['purchaseIibbAmount', 'montoIibb', 'iibbAmount', 'monto_iibb'], iibbAmount);

        var totalInvoice = netSubtotal + ivaAmount + iibbAmount + otherTaxes;
        setVal(['purchaseTotalInvoice', 'totalFactura', 'total', 'total_factura'], totalInvoice);
    },

    handleSavePurchase: async function(event) {
        if (event) event.preventDefault();

        try {
            var supplierSelect = document.getElementById('purchaseSupplierSelect');
            var supplierId = supplierSelect ? supplierSelect.value : '';
            var supplierName = (supplierSelect && supplierSelect.selectedIndex >= 0) ? supplierSelect.options[supplierSelect.selectedIndex].text : 'Sin Proveedor';

            var pDateEl = document.getElementById('purchaseDate');
            var purchaseDate = pDateEl ? pDateEl.value : new Date().toISOString().split('T')[0];

            var invNumEl = document.getElementById('purchaseInvoiceNum');
            var invoiceNum = invNumEl ? invNumEl.value : 'S/N';

            var pStatusEl = document.getElementById('purchasePaymentStatus');
            var paymentStatus = pStatusEl ? pStatusEl.value : 'pagada';

            var pMethodEl = document.getElementById('purchasePaymentMethod');
            var paymentMethod = pMethodEl ? pMethodEl.value : 'Efectivo';

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

            var val = function(ids) {
                for(var i=0; i<ids.length; i++) {
                    var el = document.getElementById(ids[i]);
                    if(el) {
                        var raw = el.tagName === 'INPUT' || el.tagName === 'SELECT' ? el.value : el.textContent;
                        var str = String(raw).replace(/\$/g, '').replace(/\s/g, '');
                        if(str.includes(',') && str.includes('.')) str = str.replace(/\./g, '').replace(',', '.');
                        else if(str.includes(',')) str = str.replace(',', '.');
                        str = str.replace(/[^0-9.-]/g, '');
                        return parseFloat(str) || 0;
                    }
                }
                return 0;
            };

            var ivaRate = val(['purchaseIvaRate', 'tasaIva', 'ivaRate', 'tasa_iva']) || 21;
            var iibbRate = val(['purchaseIibbRate', 'tasaIibb', 'iibbRate', 'tasa_iibb']) || 0;
            var otherTaxes = val(['purchaseOtherTaxes', 'otrosImpuestos', 'percepciones', 'purchasePercepciones', 'otros_impuestos']) || 0;

            var ivaAmount = (calcNetSubtotal * ivaRate) / 100;
            var iibbAmount = (calcNetSubtotal * iibbRate) / 100;
            var totalInvoice = calcNetSubtotal + ivaAmount + iibbAmount + otherTaxes;

            var notesEl = document.getElementById('purchaseNotes');
            var notes = notesEl ? notesEl.value : '';

            var purchaseData = {
                date: purchaseDate,
                supplierId: supplierId,
                supplierName: supplierName,
                invoiceNumber: invoiceNum,
                paymentStatus: paymentStatus,
                paymentMethod: paymentMethod,
                paymentDate: purchaseDate,
                netSubtotal: calcNetSubtotal,
                ivaAmount: ivaAmount,
                iibbAmount: iibbAmount,
                otherTaxes: otherTaxes,
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
        tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-slate-400">Cargando facturas...</td></tr>';

        var purchases = [];
        if (typeof PurchaseManager !== 'undefined' && PurchaseManager.getPurchases) {
            purchases = await PurchaseManager.getPurchases();
        }

        if (purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-slate-400">No hay facturas cargadas.</td></tr>';
            return;
        }

        tbody.innerHTML = purchases.map(function(p) {
            return '<tr class="table-row-hover text-xs">' +
                '<td class="py-2.5 px-3">' + (p.date || '-') + '</td>' +
                '<td class="py-2.5 px-3 font-mono font-bold">' + (p.invoiceNumber || 'S/N') + '</td>' +
                '<td class="py-2.5 px-4 font-semibold">' + (p.supplier || '-') + '</td>' +
                '<td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">✓ ' + p.paymentStatus + '</span></td>' +
                '<td class="py-2.5 px-3">' + (p.paymentMethod || 'Efectivo') + '</td>' +
                '<td class="py-2.5 px-3 text-right">$ ' + p.netSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '</td>' +
                '<td class="py-2.5 px-3 text-right">$ ' + p.ivaAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '</td>' +
                '<td class="py-2.5 px-4 text-right font-black">$ ' + p.totalInvoice.toLocaleString('es-AR', { minimumFractionDigits: 2 }) + '</td>' +
                '<td class="py-2.5 px-3 text-right">' +
                    '<button onclick="App.deletePurchaseFromDb(\'' + p.id + '\')" class="p-1 text-slate-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>' +
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

    renderOCHistoryTable: function() {}, renderInventorySheets: function() {}, renderCMVView: function() {}, renderEvolucionProveedor: function() {}, renderUsersTable: function() {},
    openUserModal: function() {}, closeUserModal: function() {}, openSnapshotModal: function() {}, closeSnapshotModal: function() {}, openCategoryManagerModal: function() {}, closeCategoryManagerModal: function() {}, openPaymentModal: function() {}, closePaymentModal: function() {}, openImportModal: function() {}, closeImportModal: function() {}
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