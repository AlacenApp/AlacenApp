// ==========================================
// 1. INICIALIZACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://ayyieaupiltisnrabdzn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xQgcJLM_vUCl6XFyjqxN8g_uufrwBgl';

// Usamos 'db' para evitar el choque de nombres con la librería
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// ==========================================
// 2. FUNCIONES DE AUTENTICACIÓN
// ==========================================

async function registrarUsuario(email, password) {
  const { data, error } = await db.auth.signUp({
    email: email,
    password: password,
  });

  if (error) {
    alert("Error al registrar: " + error.message);
    console.error(error);
  } else {
    alert("¡Usuario registrado con éxito! Revisa tu correo o inicia sesión.");
    console.log("Usuario creado:", data);
  }
}

async function iniciarSesion(email, password) {
  const { data, error } = await db.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    alert("Error al iniciar sesión: " + error.message);
    console.error(error);
  } else {
    alert("¡Sesión iniciada correctamente!");
    console.log("Datos de sesión:", data);
  }
}

async function cerrarSesion() {
  const { error } = await db.auth.signOut();
  if (error) console.error("Error al salir:", error.message);
  else alert("Sesión cerrada");
}


// ==========================================
// 3. OBTENER LOCALES SEGÚN EL ROL DEL USUARIO
// ==========================================

async function cargarLocalesDelUsuario() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) {
    console.log("No hay ningún usuario autenticado.");
    return;
  }

  const { data: perfil, error: errorPerfil } = await db
    .from('Perfiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  if (errorPerfil) {
    console.error("Error al obtener el perfil:", errorPerfil.message);
    return;
  }

  let localesDisponibles = [];

  if (perfil.rol === 'SUPERADMIN') {
    const { data, error } = await db.from('Locales').select('*');
    if (error) console.error(error);
    localesDisponibles = data;
  } else {
    const { data, error } = await db
      .from('Usuarios_Locales')
      .select('local_id, Locales(*)')
      .eq('perfil_id', user.id);

    if (error) console.error(error);
    localesDisponibles = data ? data.map(item => item.Locales) : [];
  }

  console.log(`Rol detectado: ${perfil.rol}`);
  console.log("Locales a los que tiene acceso:", localesDisponibles);

  alert(`Bienvenido. Rol: ${perfil.rol}\nTienes acceso a ${localesDisponibles.length} local(es).`);
  return localesDisponibles;
}
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

        // Cargar datos demo iniciales si no existen
        const products = StorageManager.getProducts();
        if (!products || products.length === 0) {
            StorageManager.loadDemoData();
        }

        // Cargar usuario activo y aplicar permisos
        this.activeUser = StorageManager.getActiveUser();
        this.applyUserPermissions();

        this.populateDropdowns();
        this.updateHeaderBusinessInfo();

        // Restaurar estado del sidebar
        this.sidebarHidden = localStorage.getItem('sidebar_hidden') === 'true';
        this._applySidebarState(false);

        // Cerrar dropdown de proveedores secundarios al hacer click fuera
        document.addEventListener('click', (e) => {
            const container = document.getElementById('secSuppliersDropdownContainer');
            const menu = document.getElementById('secSuppliersMenu');
            if (container && menu && !container.contains(e.target)) {
                menu.classList.add('hidden');
                const chevron = document.getElementById('secSuppliersChevron');
                if (chevron) chevron.classList.remove('rotate-180');
            }
        });

        // Si el usuario no tiene permiso al dashboard inicial, ir a su primera vista permitida
        if (!StorageManager.hasPermission(this.activeUser, 'dashboard')) {
            const firstAllowed = this.getFirstAllowedView();
            this.navigate(firstAllowed);
        } else {
            this.navigate('dashboard');
        }
    },

    updateHeaderBusinessInfo() {
        const settings = StorageManager.getSettings();
        const headerName = document.getElementById('headerBusinessName');
        if (headerName) headerName.textContent = settings.businessName || 'Control de Stock & CMV';
    },

    // ==========================================
    // SIDEBAR COLAPSABLE
    // ==========================================
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
        if (!this.activeUser) {
            this.activeUser = StorageManager.getActiveUser();
        }

        const user = this.activeUser;
        const roleNames = {
            'admin': 'Administrador',
            'compras': 'Compras',
            'deposito': 'Depósito',
            'custom': 'Personalizado'
        };

        // 1. Actualizar datos en Barra Superior
        const topbarName = document.getElementById('topbarUserName');
        if (topbarName) topbarName.textContent = user.name.split(' ')[0] + ` (${roleNames[user.role] || user.role})`;

        // 2. Actualizar datos en Sidebar
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarAvatar = document.getElementById('sidebarUserAvatar');
        const sidebarRole = document.getElementById('sidebarUserRoleBadge');

        if (sidebarName) sidebarName.textContent = user.name;
        if (sidebarAvatar) {
            sidebarAvatar.textContent = user.name.charAt(0).toUpperCase();
            sidebarAvatar.className = `w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow ${user.avatarColor || 'bg-indigo-600'}`;
        }
        if (sidebarRole) {
            sidebarRole.textContent = roleNames[user.role] || user.role;
        }

        // 3. Filtrar botones de navegación según permisos
        const navBtns = document.querySelectorAll('.nav-btn[data-perm]');
        navBtns.forEach(btn => {
            const perm = btn.getAttribute('data-perm');
            if (StorageManager.hasPermission(user, perm)) {
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        });

        // 4. Control de visibilidad del grupo Proveedores
        const provGroup = document.getElementById('nav-proveedores-group');
        if (provGroup) {
            const hasAnyProvPerm = StorageManager.hasPermission(user, 'ordenes-compra') ||
                                   StorageManager.hasPermission(user, 'proveedores') ||
                                   StorageManager.hasPermission(user, 'compras-historial');
            if (hasAnyProvPerm) {
                provGroup.classList.remove('hidden');
            } else {
                provGroup.classList.add('hidden');
            }
        }
    },

    getFirstAllowedView() {
        const order = ['dashboard', 'compras-nueva', 'proveedores', 'ordenes-compra', 'compras-historial', 'productos', 'inventarios', 'cmv', 'evolucion-compras', 'ajustes'];
        for (let v of order) {
            if (StorageManager.hasPermission(this.activeUser, v)) {
                return v;
            }
        }
        return 'dashboard';
    },

    openLoginSwitcher() {
        const users = StorageManager.getUsers();
        const container = document.getElementById('loginUserCardsContainer');
        const currentUserId = this.activeUser?.id;

        container.innerHTML = users.map(u => {
            const isSelected = u.id === currentUserId;
            const roleLabels = { 'admin': 'Admin', 'compras': 'Compras', 'deposito': 'Depósito', 'custom': 'Personalizado' };

            return `
                <button type="button" onclick="App.selectLoginUser('${u.id}')" class="login-user-card p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${isSelected ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}" data-user-id="${u.id}">
                    <div class="w-10 h-10 rounded-full ${u.avatarColor || 'bg-indigo-600'} text-white flex items-center justify-center font-bold text-sm shadow">
                        ${u.name.charAt(0).toUpperCase()}
                    </div>
                    <span class="text-xs font-bold text-slate-800 truncate max-w-full">${u.name.split(' ')[0]}</span>
                    <span class="text-[10px] text-slate-400">${roleLabels[u.role] || u.role}</span>
                </button>
            `;
        }).join('');

        this.selectLoginUser(currentUserId || users[0].id);

        const cancelBtn = document.getElementById('loginCancelBtn');
        if (cancelBtn) cancelBtn.classList.remove('hidden');

        document.getElementById('loginModal').classList.remove('hidden');
    },

    closeLoginSwitcher() {
        document.getElementById('loginModal').classList.add('hidden');
    },

    selectLoginUser(userId) {
        document.getElementById('loginSelectedUserId').value = userId;
        const pinInput = document.getElementById('loginPinInput');
        pinInput.value = '';
        pinInput.focus();

        const cards = document.querySelectorAll('.login-user-card');
        cards.forEach(c => {
            if (c.getAttribute('data-user-id') === userId) {
                c.classList.add('border-indigo-600', 'bg-indigo-50/70', 'ring-2', 'ring-indigo-500');
                c.classList.remove('border-slate-200');
            } else {
                c.classList.remove('border-indigo-600', 'bg-indigo-50/70', 'ring-2', 'ring-indigo-500');
                c.classList.add('border-slate-200');
            }
        });
    },

    handleLoginSubmit(event) {
        event.preventDefault();
        const userId = document.getElementById('loginSelectedUserId').value;
        const pin = document.getElementById('loginPinInput').value.trim();

        const user = StorageManager.getUserById(userId);
        if (!user) {
            this.showToast('Usuario no encontrado', 'error');
            return;
        }

        if (user.pin && user.pin !== pin) {
            this.showToast('PIN incorrecto. Inténtalo nuevamente.', 'error');
            document.getElementById('loginPinInput').value = '';
            document.getElementById('loginPinInput').focus();
            return;
        }

        StorageManager.setActiveUser(user);
        this.activeUser = user;
        this.applyUserPermissions();
        this.closeLoginSwitcher();
        this.showToast(`¡Bienvenido/a, ${user.name}! Sesión iniciada con éxito.`, 'success');

        // Si la vista actual no está permitida para este usuario, redirigir
        if (!StorageManager.hasPermission(this.activeUser, this.currentView)) {
            const first = this.getFirstAllowedView();
            this.navigate(first);
        }
    },

    // --- ADMINISTRACIÓN DE USUARIOS (CRUD EN AJUSTES) ---
    renderUsersTable() {
        const users = StorageManager.getUsers();
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        const roleBadges = {
            'admin': '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-100 text-indigo-800">👑 Administrador</span>',
            'compras': '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">🛒 Compras</span>',
            'deposito': '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800">📦 Depósito</span>',
            'custom': '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-200 text-slate-700">⚙️ Personalizado</span>'
        };

        tbody.innerHTML = users.map(u => `
            <tr class="table-row-hover text-xs">
                <td class="py-2.5 px-3 font-mono font-bold text-slate-700 flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full ${u.avatarColor || 'bg-indigo-600'} text-white flex items-center justify-center text-[10px] font-bold">
                        ${u.name.charAt(0).toUpperCase()}
                    </span>
                    <span>@${u.username}</span>
                </td>
                <td class="py-2.5 px-3 font-semibold text-slate-800">${u.name}</td>
                <td class="py-2.5 px-3 text-center">${roleBadges[u.role] || u.role}</td>
                <td class="py-2.5 px-3 text-center font-mono font-bold text-slate-400">••••</td>
                <td class="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                    <button onclick="App.openUserModal('${u.id}')" class="p-1.5 text-slate-500 hover:text-indigo-600 rounded" title="Editar usuario">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    ${u.id !== this.activeUser?.id ? `
                        <button onclick="App.deleteUser('${u.id}')" class="p-1.5 text-slate-400 hover:text-red-600 rounded" title="Eliminar usuario">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    ` : '<span class="text-[10px] text-slate-400 italic">Sesión activa</span>'}
                </td>
            </tr>
        `).join('');
    },

    openUserModal(userId = null) {
        const form = document.getElementById('userForm');
        form.reset();

        document.querySelectorAll('.usr-perm-check').forEach(cb => cb.checked = false);

        if (userId) {
            const u = StorageManager.getUserById(userId);
            if (u) {
                document.getElementById('userModalTitle').innerHTML = '<i class="fa-solid fa-user-gear text-indigo-400"></i> Editar Usuario';
                document.getElementById('usrFormId').value = u.id;
                document.getElementById('usrFormName').value = u.name;
                document.getElementById('usrFormUsername').value = u.username;
                document.getElementById('usrFormPin').value = u.pin || '';
                document.getElementById('usrFormRole').value = u.role;

                this.handleUserRoleChange(u.role);
                if (u.role === 'custom' && u.permissions) {
                    document.querySelectorAll('.usr-perm-check').forEach(cb => {
                        cb.checked = u.permissions.includes(cb.value);
                    });
                }
            }
        } else {
            document.getElementById('userModalTitle').innerHTML = '<i class="fa-solid fa-user-gear text-indigo-400"></i> Nuevo Usuario';
            document.getElementById('usrFormId').value = '';
            document.getElementById('usrFormRole').value = 'compras';
            this.handleUserRoleChange('compras');
        }

        document.getElementById('userModal').classList.remove('hidden');
    },

    closeUserModal() {
        document.getElementById('userModal').classList.add('hidden');
    },

    handleUserRoleChange(role) {
        const box = document.getElementById('usrCustomPermissionsBox');
        if (role === 'custom') {
            box.classList.remove('hidden');
        } else {
            box.classList.add('hidden');
        }
    },

    handleSaveUser(event) {
        event.preventDefault();
        try {
            const id = document.getElementById('usrFormId').value || undefined;
            const name = document.getElementById('usrFormName').value.trim();
            const username = document.getElementById('usrFormUsername').value.trim().toLowerCase();
            const pin = document.getElementById('usrFormPin').value.trim();
            const role = document.getElementById('usrFormRole').value;

            // Validar unicidad de username si es nuevo
            const existing = StorageManager.getUserByUsername(username);
            if (existing && existing.id !== id) {
                this.showToast(`El nombre de usuario "${username}" ya está registrado.`, 'warning');
                return;
            }

            let permissions = [];
            if (role === 'admin') {
                permissions = ['all'];
            } else if (role === 'compras') {
                permissions = ['dashboard', 'compras-nueva', 'ordenes-compra', 'proveedores', 'productos', 'compras-historial'];
            } else if (role === 'deposito') {
                permissions = ['inventarios', 'productos'];
            } else {
                document.querySelectorAll('.usr-perm-check:checked').forEach(cb => {
                    permissions.push(cb.value);
                });
            }

            const userData = {
                id,
                name,
                username,
                pin,
                role,
                permissions
            };

            StorageManager.saveUser(userData);
            this.closeUserModal();
            this.showToast(`Usuario "${name}" guardado con éxito.`, 'success');
            this.renderUsersTable();

            // Si se editó el usuario activo actual, refrescar permisos
            if (this.activeUser && this.activeUser.id === id) {
                this.activeUser = StorageManager.getUserById(id);
                this.applyUserPermissions();
            }
        } catch (e) {
            console.error(e);
            this.showToast(e.message || 'Error al guardar usuario', 'error');
        }
    },

    deleteUser(userId) {
        try {
            const u = StorageManager.getUserById(userId);
            if (!confirm(`¿Estás seguro de eliminar al usuario "${u?.name}"?`)) return;

            StorageManager.deleteUser(userId);
            this.showToast('Usuario eliminado.', 'info');
            this.renderUsersTable();
        } catch (e) {
            alert(e.message);
        }
    },

    // ==========================================
    // NAVEGACIÓN Y CONTROL DE PERMISOS
    // ==========================================
    populateDropdowns() {
        const suppliers = StorageManager.getSuppliers();
        const categories = StorageManager.getCategories();

        // 1. Selector de proveedores en Nueva Compra
        const purchaseSupSelect = document.getElementById('purchaseSupplierSelect');
        if (purchaseSupSelect) {
            const currentVal = purchaseSupSelect.value;
            purchaseSupSelect.innerHTML = '<option value="">-- Seleccionar Proveedor --</option>' +
                suppliers.map(s => `<option value="${s.id}">${s.name} ${s.category ? `(${s.category})` : ''}</option>`).join('');
            purchaseSupSelect.value = currentVal;
        }

        // 2. Selector de proveedores en Órdenes de Compra
        const ocSupSelect = document.getElementById('ocSupplierSelect');
        if (ocSupSelect) {
            const currentVal = ocSupSelect.value;
            ocSupSelect.innerHTML = '<option value="">-- Elige un proveedor para pedir mercadería --</option>' +
                suppliers.map(s => `<option value="${s.id}">${s.name} ${s.category ? `(${s.category})` : ''}</option>`).join('');
            ocSupSelect.value = currentVal;
        }

        // 3. Selector de proveedores en Modal Insumo (Habitual y Secundario)
        const prodSupSelect = document.getElementById('prodFormSupplierSelect');
        if (prodSupSelect) {
            const currentVal = prodSupSelect.value;
            prodSupSelect.innerHTML = '<option value="">-- Sin proveedor asignado --</option>' +
                suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            prodSupSelect.value = currentVal;
        }

        const prodSecSupSelect = document.getElementById('prodFormSecondarySupplierSelect');
        if (prodSecSupSelect) {
            const currentVal = prodSecSupSelect.value;
            prodSecSupSelect.innerHTML = '<option value="">-- Sin proveedor secundario --</option>' +
                suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            prodSecSupSelect.value = currentVal;
        }

        // Multi-select secundarios (nuevo)
        this.renderSecondarySuppliersChecklist();

        // 4. Selector de categorías en Modal Insumo
        const prodCatSelect = document.getElementById('prodFormCategorySelect');
        if (prodCatSelect) {
            const currentVal = prodCatSelect.value;
            prodCatSelect.innerHTML = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            prodCatSelect.value = currentVal;
        }

        // 5. Filtro de categorías en productos
        const prodCatFilter = document.getElementById('prodCategoryFilter');
        if (prodCatFilter) {
            const currentVal = prodCatFilter.value;
            prodCatFilter.innerHTML = '<option value="">Todas las categorías</option>' +
                categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            prodCatFilter.value = currentVal;
        }

        // 6. Selectores en Evolución de Compras
        this.populateEvolucionDropdowns();
    },

    navigate(viewId, params = {}) {
        // Verificar permiso de acceso para el usuario activo
        if (!StorageManager.hasPermission(this.activeUser, viewId)) {
            this.showToast('Acceso Restringido: Tu perfil de usuario no tiene autorización para acceder a este módulo.', 'warning');
            return;
        }

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

        // Manejo de estado expandido del menú Proveedores
        const isProvSubmenu = ['ordenes-compra', 'proveedores', 'compras-historial'].includes(viewId);
        const provToggle = document.getElementById('nav-proveedores-toggle');
        if (isProvSubmenu) {
            this.toggleProveedoresNavMenu(true);
            if (provToggle) {
                provToggle.classList.add('text-teal-300', 'bg-slate-800/60');
                provToggle.classList.remove('text-slate-300');
            }
        } else {
            if (provToggle) {
                provToggle.classList.remove('text-teal-300', 'bg-slate-800/60');
                provToggle.classList.add('text-slate-300');
            }
        }

        const titles = {
            'dashboard': { title: 'Panel Principal', sub: 'Resumen operativo, compras recientes y cuentas a pagar' },
            'compras-nueva': { title: 'Cargar Factura / Gasto', sub: 'Liquidación impositiva (Neto, IVA, IIBB, Percepciones) y estado de pago' },
            'ordenes-compra': { title: 'Órdenes de Compra a Proveedores', sub: 'Sugerencias de reposición por stock bajo y emisión de pedidos' },
            'proveedores': { title: 'Directorio de Proveedores', sub: 'Fichas comerciales, datos fiscales y formas de pago' },
            'inventarios': { title: 'Carga de Inventarios (II / IF)', sub: 'Planillas de conteo físico para inicio y cierre mensual' },
            'cmv': { title: 'Control de CMV Mensual', sub: 'Inventario inicial, compras, conteo final y costo de mercadería vendida (PPP)' },
            'productos': { title: 'Insumos y Categorías', sub: 'Catálogo de existencias, stock de seguridad y proveedor habitual' },
            'compras-historial': { title: 'Historial de Facturas y Pagos', sub: 'Registro de facturas, cuentas a pagar y control de cancelaciones' },
            'evolucion-compras': { title: 'Evolución de Compras y Precios', sub: 'Historial de compras por proveedor y evolución histórica de costos por insumo' },
            'ajustes': { title: 'Configuración y Respaldo', sub: 'Control de usuarios y permisos (RBAC), régimen impositivo y copias de seguridad' }
        };

        const pageTitle = document.getElementById('pageTitle');
        const pageSubtitle = document.getElementById('pageSubtitle');
        if (pageTitle && titles[viewId]) pageTitle.textContent = titles[viewId].title;
        if (pageSubtitle && titles[viewId]) pageSubtitle.textContent = titles[viewId].sub;

        if (viewId === 'dashboard') {
            this.renderDashboard();
        } else if (viewId === 'compras-nueva') {
            if (params.editPurchaseId) {
                this.editPurchase(params.editPurchaseId);
            } else if (params.reset || document.getElementById('purchaseItemsTableBody').children.length === 0 || document.getElementById('purchaseEditId')?.value) {
                this.resetPurchaseForm();
            }
            if (params.prefilledOrder) {
                this.prefillPurchaseFromOrder(params.prefilledOrder);
            }
        } else if (viewId === 'ordenes-compra') {
            this.renderOCHistoryTable();
            if (params.supplierId) {
                const supSelect = document.getElementById('ocSupplierSelect');
                if (supSelect) {
                    supSelect.value = params.supplierId;
                    this.handleOCSupplierSelected(params.supplierId);
                }
            }
        } else if (viewId === 'proveedores') {
            this.renderSuppliersView();
        } else if (viewId === 'inventarios') {
            this.renderInventorySheets();
        } else if (viewId === 'cmv') {
            this.renderCMVView();
        } else if (viewId === 'productos') {
            if (params.filter) {
                const filterEl = document.getElementById('prodStockFilter');
                if (filterEl) filterEl.value = params.filter;
            }
            this.renderProductsTable();
        } else if (viewId === 'compras-historial') {
            this.renderPurchasesTable();
        } else if (viewId === 'evolucion-compras') {
            this.renderEvolucionComprasView(params);
        } else if (viewId === 'ajustes') {
            this.renderSettings();
            this.renderUsersTable();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        const bgColors = {
            success: 'bg-emerald-600 text-white',
            error: 'bg-red-600 text-white',
            warning: 'bg-amber-500 text-white',
            info: 'bg-sky-600 text-white'
        };
        const icons = {
            success: 'fa-circle-check',
            error: 'fa-circle-xmark',
            warning: 'fa-triangle-exclamation',
            info: 'fa-circle-info'
        };

        toast.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-semibold transform transition-all duration-300 translate-y-2 opacity-0 ${bgColors[type] || bgColors.success}`;
        toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.success} text-base"></i><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    // ==========================================
    // MÓDULO DASHBOARD
    // ==========================================
    renderDashboard() {
        const products = StorageManager.getProducts();
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        const totalProducts = products.length;
        const lowStockProducts = products.filter(p => (p.currentStock || 0) <= (p.minStock || 0));
        
        let totalStockValuation = 0;
        products.forEach(p => {
            totalStockValuation += (p.currentStock || 0) * (p.costPrice || 0);
        });

        const dashStockValEl = document.getElementById('dashTotalStockValue');
        if (dashStockValEl) dashStockValEl.textContent = `${curr} ${totalStockValuation.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        const cmvData = CMVManager.calculatePeriodCMV(this.activePeriod);
        const purchases = StorageManager.getPurchases().filter(p => p.date && p.date.startsWith(this.activePeriod));
        
        document.getElementById('dashMonthPurchases').textContent = `${curr} ${cmvData.totalPurchasesValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('dashMonthPurchasesCount').textContent = `${purchases.length} facturas en el mes`;

        // Cuentas a Pagar
        const allPurchases = StorageManager.getPurchases();
        const pendingPurchases = allPurchases.filter(p => (p.paymentStatus || 'pagada') === 'pendiente');
        const pendingTotalAmount = pendingPurchases.reduce((sum, p) => sum + (p.totalInvoice || p.totalCost || 0), 0);

        document.getElementById('dashPendingPayments').textContent = `${curr} ${pendingTotalAmount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('dashPendingPaymentsCount').textContent = `${pendingPurchases.length} facturas pendientes de pago`;

        // Badge en el menú lateral para alertar facturas pendientes
        const badgePending = document.getElementById('badgePendingCount');
        if (badgePending) {
            if (pendingPurchases.length > 0 && StorageManager.hasPermission(this.activeUser, 'compras-historial')) {
                badgePending.textContent = `${pendingPurchases.length} a pagar`;
                badgePending.classList.remove('hidden');
            } else {
                badgePending.classList.add('hidden');
            }
        }

        // Tabla de Stock Bajo
        const lowTable = document.getElementById('dashLowStockTable');
        if (lowStockProducts.length === 0) {
            lowTable.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400">¡Excelente! No hay insumos en stock crítico.</td></tr>`;
        } else {
            lowTable.innerHTML = lowStockProducts.slice(0, 5).map(p => `
                <tr class="table-row-hover">
                    <td class="py-2.5 px-4 font-medium text-slate-800">
                        <div>${p.name}</div>
                        <span class="text-[10px] text-slate-400">${p.code} &bull; ${p.category}</span>
                    </td>
                    <td class="py-2.5 px-3 text-slate-600 font-medium">
                        ${p.supplierName || '<span class="text-slate-400 italic">Sin asignar</span>'}
                    </td>
                    <td class="py-2.5 px-3 font-black ${p.currentStock <= 0 ? 'text-red-600' : 'text-amber-600'}">
                        ${p.currentStock} ${p.unit} <span class="text-[10px] font-normal text-slate-400 block">mín: ${p.minStock}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right">
                        ${(p.supplierId || p.supplierName) && StorageManager.hasPermission(this.activeUser, 'ordenes-compra') ? `
                            <button onclick="App.navigate('ordenes-compra', { supplierId: '${p.supplierId || p.supplierName}' })" class="text-[11px] font-bold bg-amber-50 text-amber-800 px-2 py-1 rounded border border-amber-200 hover:bg-amber-100">Pedir</button>
                        ` : `
                            <button onclick="App.openQuickAdjustModal('${p.id}')" class="text-[11px] font-semibold text-sky-600 hover:text-sky-800">Ajustar</button>
                        `}
                    </td>
                </tr>
            `).join('');
        }

        // Tabla de Últimas Facturas
        const recentPurchases = allPurchases.slice(0, 5);
        const recentTable = document.getElementById('dashRecentPurchasesTable');
        if (recentPurchases.length === 0) {
            recentTable.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400">No hay facturas registradas aún.</td></tr>`;
        } else {
            recentTable.innerHTML = recentPurchases.map(p => {
                const isPaid = (p.paymentStatus || 'pagada') === 'pagada';
                const statusBadge = isPaid
                    ? '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">✓ Pagada</span>'
                    : '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-red-100 text-red-700">⏳ A Pagar</span>';

                return `
                    <tr class="table-row-hover cursor-pointer" onclick="App.viewPurchaseDetail('${p.id}')">
                        <td class="py-2.5 px-4 text-slate-600">${p.date}</td>
                        <td class="py-2.5 px-4 font-medium text-slate-800">${p.supplier}</td>
                        <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                        <td class="py-2.5 px-4 text-right font-black text-slate-900">${curr} ${(p.totalInvoice || p.totalCost).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `;
            }).join('');
        }
    },

    // ==========================================
    // MÓDULO CARGA DE FACTURAS CON IMPUESTOS
    // ==========================================
    resetPurchaseForm() {
        const form = document.getElementById('purchaseForm');
        if (form) form.reset();

        const editIdEl = document.getElementById('purchaseEditId');
        if (editIdEl) editIdEl.value = '';

        const banner = document.getElementById('purchaseEditBanner');
        if (banner) banner.classList.add('hidden');

        const titleEl = document.getElementById('purchaseFormTitle');
        if (titleEl) titleEl.textContent = 'Carga de Factura / Gasto con Impuestos';

        const iconEl = document.getElementById('purchaseFormIcon');
        if (iconEl) iconEl.className = 'fa-solid fa-cart-shopping text-emerald-400';

        const submitBtnText = document.getElementById('purchaseSubmitBtnText');
        if (submitBtnText) submitBtnText.textContent = 'Guardar Factura / Gasto e Incrementar Stock';

        const submitBtnIcon = document.getElementById('purchaseSubmitBtnIcon');
        if (submitBtnIcon) submitBtnIcon.className = 'fa-solid fa-check';

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        document.getElementById('purchaseDate').value = todayStr;
        const purchasePaymentDateInput = document.getElementById('purchasePaymentDate');
        if (purchasePaymentDateInput) purchasePaymentDateInput.value = todayStr;
        document.getElementById('purchasePaymentStatus').value = 'pagada';
        document.getElementById('purchasePaymentMethod').value = 'Efectivo';

        const settings = StorageManager.getSettings();
        document.getElementById('taxIvaRate').value = settings.defaultIvaRate || '21';
        document.getElementById('purchaseCostMode').value = settings.defaultCostMode || 'net';

        this.populateDropdowns();

        const tbody = document.getElementById('purchaseItemsTableBody');
        tbody.innerHTML = '';
        this.addPurchaseRow();
        this.calculatePurchaseTotals();
    },

    editPurchase(purchaseId) {
        const purchase = StorageManager.getPurchases().find(p => p.id === purchaseId);
        if (!purchase) {
            this.showToast('No se encontró la factura a editar.', 'error');
            return;
        }

        this.closePurchaseDetailModal();
        this.navigate('compras-nueva');

        const editIdEl = document.getElementById('purchaseEditId');
        if (editIdEl) editIdEl.value = purchase.id;

        const banner = document.getElementById('purchaseEditBanner');
        const bannerText = document.getElementById('purchaseEditBannerText');
        if (banner) banner.classList.remove('hidden');
        if (bannerText) bannerText.textContent = `Modo Edición: Modificando Factura Nº ${purchase.invoiceNumber || 'S/N'} (${purchase.supplier || ''})`;

        const titleEl = document.getElementById('purchaseFormTitle');
        if (titleEl) titleEl.textContent = `Editar Factura Nº ${purchase.invoiceNumber || 'S/N'}`;

        const iconEl = document.getElementById('purchaseFormIcon');
        if (iconEl) iconEl.className = 'fa-solid fa-pen-to-square text-amber-400';

        const submitBtnText = document.getElementById('purchaseSubmitBtnText');
        if (submitBtnText) submitBtnText.textContent = 'Guardar Cambios de Factura';

        const submitBtnIcon = document.getElementById('purchaseSubmitBtnIcon');
        if (submitBtnIcon) submitBtnIcon.className = 'fa-solid fa-floppy-disk';

        document.getElementById('purchaseDate').value = purchase.date || '';
        document.getElementById('purchaseInvoice').value = purchase.invoiceNumber || '';
        document.getElementById('purchasePaymentStatus').value = purchase.paymentStatus || 'pagada';
        document.getElementById('purchasePaymentMethod').value = purchase.paymentMethod || 'Efectivo';
        const purchasePaymentDateInput = document.getElementById('purchasePaymentDate');
        if (purchasePaymentDateInput) {
            purchasePaymentDateInput.value = purchase.paymentDate || (purchase.paymentStatus === 'pagada' ? (purchase.date || '') : '');
        }
        document.getElementById('purchaseNotes').value = purchase.notes || '';
        document.getElementById('purchaseCostMode').value = purchase.costMode || 'net';

        this.populateDropdowns();

        const supSelect = document.getElementById('purchaseSupplierSelect');
        if (purchase.supplierId) {
            supSelect.value = purchase.supplierId;
        } else {
            const sup = StorageManager.getSuppliers().find(s => s.name.toLowerCase() === (purchase.supplier || '').toLowerCase());
            if (sup) supSelect.value = sup.id;
        }

        const tbody = document.getElementById('purchaseItemsTableBody');
        tbody.innerHTML = '';

        if (purchase.items && purchase.items.length > 0) {
            purchase.items.forEach(it => {
                this.addPurchaseRow(
                    it.productId,
                    it.quantity,
                    it.unitCost,
                    it.discountPercent || 0,
                    it.discountAmount || 0
                );
            });
        } else {
            this.addPurchaseRow();
        }

        document.getElementById('taxIvaRate').value = purchase.ivaRate !== undefined ? purchase.ivaRate : '21';
        document.getElementById('taxIvaAmount').value = purchase.ivaAmount || 0;
        document.getElementById('taxIibbRate').value = purchase.iibbRate || 0;
        document.getElementById('taxIibbAmount').value = purchase.iibbAmount || 0;
        document.getElementById('taxIvaPerception').value = purchase.ivaPerception || 0;
        document.getElementById('taxOtherTaxes').value = purchase.otherTaxes || 0;

        this.calculatePurchaseTotals();
        this.showToast(`Editando factura ${purchase.invoiceNumber || ''}`, 'info');
    },

    cancelPurchaseEdit() {
        this.resetPurchaseForm();
        if (StorageManager.hasPermission(this.activeUser, 'compras-historial')) {
            this.navigate('compras-historial');
        }
    },

    editPurchaseFromDetail() {
        if (this._currentDetailPurchaseId) {
            this.editPurchase(this._currentDetailPurchaseId);
        }
    },

    openNewPurchase() {
        this.navigate('compras-nueva', { reset: true });
    },

    handlePurchaseSupplierChange(supId) {
        if (supId) {
            const sup = StorageManager.getSupplierById(supId);
            if (sup && sup.paymentMethods) {
                if (sup.paymentMethods.toLowerCase().includes('corriente') || sup.paymentMethods.toLowerCase().includes('30')) {
                    document.getElementById('purchasePaymentStatus').value = 'pendiente';
                    document.getElementById('purchasePaymentMethod').value = 'Cuenta Corriente / A Pagar';
                }
            }
        }
        this.refreshPurchaseRowsProductDropdowns(supId);
    },

    refreshPurchaseRowsProductDropdowns(supId) {
        let products = [];
        if (supId) {
            products = ProductManager.getProductsForSupplier(supId);
        } else {
            products = StorageManager.getProducts();
        }

        const rows = document.querySelectorAll('.purchase-item-row');
        rows.forEach(row => {
            const select = row.querySelector('.row-product-select');
            const currentSelectedId = select.value;

            let optionsHtml = '<option value="">-- Seleccionar Insumo --</option>';
            if (supId && products.length === 0) {
                optionsHtml = '<option value="">-- Sin insumos vinculados a este proveedor --</option>';
            }

            let found = false;
            products.forEach(p => {
                const isSelected = (p.id === currentSelectedId);
                if (isSelected) found = true;
                optionsHtml += `<option value="${p.id}" data-unit="${p.unit}" data-cost="${p.costPrice || 0}" ${isSelected ? 'selected' : ''}>${p.name} (${p.code})</option>`;
            });

            select.innerHTML = optionsHtml;
            if (!found && currentSelectedId) {
                select.value = '';
                row.querySelector('.row-unit-badge').textContent = 'u.';
                row.querySelector('.row-cost-input').value = '0';
            }
        });

        this.calculatePurchaseTotals();
    },

    handlePurchaseDateChange(newDate) {
        const payDateInput = document.getElementById('purchasePaymentDate');
        const payStatus = document.getElementById('purchasePaymentStatus')?.value;
        if (payDateInput && payStatus === 'pagada') {
            if (!payDateInput.value) {
                payDateInput.value = newDate;
            }
        }
    },

    handlePurchasePaymentStatusChange(status) {
        const payDateInput = document.getElementById('purchasePaymentDate');
        const invoiceDate = document.getElementById('purchaseDate')?.value;
        if (status === 'pendiente') {
            document.getElementById('purchasePaymentMethod').value = 'Cuenta Corriente / A Pagar';
            if (payDateInput) payDateInput.value = '';
        } else {
            document.getElementById('purchasePaymentMethod').value = 'Efectivo';
            if (payDateInput && !payDateInput.value) {
                payDateInput.value = invoiceDate || new Date().toISOString().split('T')[0];
            }
        }
    },

    addPurchaseRow(defaultProductId = '', defaultQty = 1, defaultCost = 0, defaultDiscountPct = 0, defaultDiscountVal = 0, autoFocus = false) {
        const tbody = document.getElementById('purchaseItemsTableBody');
        const supSelect = document.getElementById('purchaseSupplierSelect');
        const selectedSupplierId = supSelect ? supSelect.value : '';

        let products = [];
        if (selectedSupplierId) {
            products = ProductManager.getProductsForSupplier(selectedSupplierId);
        } else {
            products = StorageManager.getProducts();
        }

        const row = document.createElement('tr');
        row.className = 'purchase-item-row';

        let optionsHtml = '<option value="">-- Seleccionar Insumo --</option>';
        if (selectedSupplierId && products.length === 0) {
            optionsHtml = '<option value="">-- Sin insumos vinculados a este proveedor --</option>';
        }

        products.forEach(p => {
            const selected = (p.id === defaultProductId) ? 'selected' : '';
            optionsHtml += `<option value="${p.id}" data-unit="${p.unit}" data-cost="${p.costPrice || 0}" ${selected}>${p.name} (${p.code})</option>`;
        });

        row.innerHTML = `
            <td class="py-2 px-2.5">
                <select required onchange="App.updatePurchaseRowProduct(this)" class="row-product-select w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none">
                    ${optionsHtml}
                </select>
            </td>
            <td class="py-2 px-2 text-center text-slate-500 font-bold row-unit-badge">
                u.
            </td>
            <td class="py-2 px-2">
                <input type="number" step="any" min="0.001" required value="${defaultQty}" oninput="App.calculatePurchaseTotals(this, 'qty')" class="row-qty-input w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none">
            </td>
            <td class="py-2 px-2">
                <input type="number" step="any" min="0" required value="${defaultCost}" oninput="App.calculatePurchaseTotals(this, 'cost')" class="row-cost-input w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none">
            </td>
            <td class="py-2 px-2">
                <div class="flex items-center gap-1">
                    <div class="relative flex-1 min-w-0" title="Descuento en porcentaje (%)">
                        <input type="number" step="any" min="0" max="100" placeholder="0" value="${defaultDiscountPct || ''}" oninput="App.updateRowDiscountPct(this)" class="row-discount-pct w-full bg-amber-50/50 border border-amber-300 rounded-lg pl-1.5 pr-4 py-1.5 text-xs font-bold text-amber-800 text-right focus:ring-2 focus:ring-amber-500 focus:outline-none">
                        <span class="absolute right-1 top-1.5 text-[10px] text-amber-600 font-bold pointer-events-none">%</span>
                    </div>
                    <div class="relative flex-1 min-w-0" title="Descuento en monto fijo ($)">
                        <input type="number" step="any" min="0" placeholder="0" value="${defaultDiscountVal || ''}" oninput="App.updateRowDiscountVal(this)" class="row-discount-val w-full bg-amber-50/50 border border-amber-300 rounded-lg pl-1.5 pr-4 py-1.5 text-xs font-bold text-amber-800 text-right focus:ring-2 focus:ring-amber-500 focus:outline-none">
                        <span class="absolute right-1 top-1.5 text-[10px] text-amber-600 font-bold pointer-events-none">$</span>
                    </div>
                </div>
            </td>
            <td class="py-2 px-3 text-right font-black text-slate-800 row-subtotal">
                $ 0.00
            </td>
            <td class="py-2 px-2 text-center">
                <button type="button" onclick="App.removePurchaseRow(this)" class="text-slate-400 hover:text-red-600 transition-colors p-1" title="Quitar renglón">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;

        tbody.appendChild(row);

        if (defaultProductId) {
            const selectEl = row.querySelector('.row-product-select');
            this.updatePurchaseRowProduct(selectEl);
        }

        this.calculatePurchaseTotals();

        if (autoFocus) {
            const selectEl = row.querySelector('.row-product-select');
            if (selectEl) {
                setTimeout(() => {
                    selectEl.focus();
                    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
            }
        }

        return row;
    },

    handlePurchaseFormKeydown(event) {
        if (event.key === 'Enter') {
            // Permitir salto de línea normal si está escribiendo notas en textarea
            if (event.target.tagName === 'TEXTAREA') return;

            // Si está directamente enfocado en el botón de guardar, permitir el submit
            if (event.target.type === 'submit' || event.target.id === 'purchaseSubmitBtn' || event.target.closest('#purchaseSubmitBtn')) return;

            // Si está en el selector de insumo (.row-product-select), abrir el listado de insumos al presionar ENTER
            if (event.target.classList.contains('row-product-select')) {
                event.preventDefault();
                event.stopPropagation();
                try {
                    if (typeof event.target.showPicker === 'function') {
                        event.target.showPicker();
                        return;
                    }
                } catch (e) {
                    console.warn(e);
                }
                return;
            }

            // Si está en el selector de proveedor, abrir listado de proveedores
            if (event.target.id === 'purchaseSupplierSelect') {
                event.preventDefault();
                event.stopPropagation();
                try {
                    if (typeof event.target.showPicker === 'function') {
                        event.target.showPicker();
                        return;
                    }
                } catch (e) {}
                return;
            }

            // Si está en el número de factura, saltar al selector del primer renglón y abrirlo
            if (event.target.id === 'purchaseInvoice') {
                event.preventDefault();
                event.stopPropagation();
                const firstRowSelect = document.querySelector('#purchaseItemsTableBody .row-product-select');
                if (firstRowSelect) {
                    firstRowSelect.focus();
                    try {
                        if (typeof firstRowSelect.showPicker === 'function') {
                            firstRowSelect.showPicker();
                        }
                    } catch (e) {}
                } else {
                    this.addPurchaseRow('', 1, 0, 0, 0, true);
                }
                return;
            }

            // En los demás campos (Cantidad, Costo, Descuentos, etc.), ENTER crea un nuevo renglón de compra
            event.preventDefault();
            event.stopPropagation();

            // Agregar nuevo renglón de compra y enfocar su selector de insumo
            this.addPurchaseRow('', 1, 0, 0, 0, true);
        }
    },

    handlePurchaseHeaderKeydown(event) {
        this.handlePurchaseFormKeydown(event);
    },

    handlePurchaseRowKeydown(event) {
        this.handlePurchaseFormKeydown(event);
    },

    removePurchaseRow(btn) {
        const tbody = document.getElementById('purchaseItemsTableBody');
        if (tbody.children.length <= 1) {
            this.showToast('La factura debe tener al menos un renglón de insumo.', 'warning');
            return;
        }
        btn.closest('tr').remove();
        this.calculatePurchaseTotals();
    },

    updatePurchaseRowProduct(selectEl) {
        const row = selectEl.closest('tr');
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const unitBadge = row.querySelector('.row-unit-badge');
        const costInput = row.querySelector('.row-cost-input');

        if (selectedOption && selectedOption.value) {
            const unit = selectedOption.getAttribute('data-unit') || 'u.';
            const refCost = parseFloat(selectedOption.getAttribute('data-cost')) || 0;
            unitBadge.textContent = unit;
            
            if (parseFloat(costInput.value) === 0 && refCost > 0) {
                costInput.value = refCost;
            }

            // Al elegir un insumo, pasar el foco automáticamente al campo de Cantidad
            const qtyInput = row.querySelector('.row-qty-input');
            if (qtyInput) {
                setTimeout(() => {
                    qtyInput.focus();
                    qtyInput.select();
                }, 50);
            }
        } else {
            unitBadge.textContent = 'u.';
        }
        this.calculatePurchaseTotals();
    },

    updateRowDiscountPct(inputEl) {
        const row = inputEl.closest('tr');
        const qty = parseFloat(row.querySelector('.row-qty-input').value) || 0;
        const cost = parseFloat(row.querySelector('.row-cost-input').value) || 0;
        const gross = qty * cost;

        const pct = parseFloat(inputEl.value) || 0;
        const valInput = row.querySelector('.row-discount-val');
        if (pct > 0 && gross > 0) {
            const val = Number((gross * (pct / 100)).toFixed(2));
            valInput.value = val;
        } else {
            valInput.value = '';
        }
        this.calculatePurchaseTotals();
    },

    updateRowDiscountVal(inputEl) {
        const row = inputEl.closest('tr');
        const qty = parseFloat(row.querySelector('.row-qty-input').value) || 0;
        const cost = parseFloat(row.querySelector('.row-cost-input').value) || 0;
        const gross = qty * cost;

        const val = parseFloat(inputEl.value) || 0;
        const pctInput = row.querySelector('.row-discount-pct');
        if (val > 0 && gross > 0) {
            const pct = Number(((val / gross) * 100).toFixed(2));
            pctInput.value = pct;
        } else {
            pctInput.value = '';
        }
        this.calculatePurchaseTotals();
    },

    calculatePurchaseTotals(changedEl = null, type = '') {
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';
        const rows = document.querySelectorAll('.purchase-item-row');

        let grossSubtotal = 0;
        let totalDiscounts = 0;
        let netSubtotal = 0;

        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.row-qty-input').value) || 0;
            const cost = parseFloat(row.querySelector('.row-cost-input').value) || 0;
            const gross = Number((qty * cost).toFixed(2));
            grossSubtotal += gross;

            const pctInput = row.querySelector('.row-discount-pct');
            const valInput = row.querySelector('.row-discount-val');
            
            let discount = 0;
            if (type === 'qty' || type === 'cost') {
                const pct = parseFloat(pctInput?.value) || 0;
                if (pct > 0 && gross > 0) {
                    discount = Number((gross * (pct / 100)).toFixed(2));
                    if (valInput) valInput.value = discount;
                } else if (valInput && parseFloat(valInput.value) > 0) {
                    discount = Math.min(gross, parseFloat(valInput.value) || 0);
                }
            } else {
                discount = parseFloat(valInput?.value) || 0;
                if (discount > gross) discount = gross;
            }

            totalDiscounts += discount;
            const subtotal = Math.max(0, Number((gross - discount).toFixed(2)));
            netSubtotal += subtotal;

            row.querySelector('.row-subtotal').textContent = `${curr} ${subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        });

        netSubtotal = Number(netSubtotal.toFixed(2));
        grossSubtotal = Number(grossSubtotal.toFixed(2));
        totalDiscounts = Number(totalDiscounts.toFixed(2));

        const grossEl = document.getElementById('footerGrossSubtotal');
        if (grossEl) grossEl.textContent = `${curr} ${grossSubtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        const discountRow = document.getElementById('footerDiscountRow');
        const discountAmountEl = document.getElementById('footerDiscountAmount');
        if (discountRow && discountAmountEl) {
            if (totalDiscounts > 0) {
                discountRow.classList.remove('hidden');
                discountAmountEl.textContent = `- ${curr} ${totalDiscounts.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
            } else {
                discountRow.classList.add('hidden');
            }
        }

        document.getElementById('taxNetSubtotal').value = netSubtotal;
        document.getElementById('footerNetSubtotal').textContent = `${curr} ${netSubtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        this.recalculateTaxesFromRate();
    },

    recalculateTaxesFromRate() {
        const net = parseFloat(document.getElementById('taxNetSubtotal').value) || 0;
        const rate = parseFloat(document.getElementById('taxIvaRate').value) || 0;
        const ivaAmount = Number((net * (rate / 100)).toFixed(2));

        document.getElementById('taxIvaAmount').value = ivaAmount;
        this.recalculateIibbFromRate();
    },

    recalculateIibbFromRate() {
        const net = parseFloat(document.getElementById('taxNetSubtotal').value) || 0;
        const rateInput = document.getElementById('taxIibbRate').value.trim();
        
        if (rateInput !== '') {
            const rate = parseFloat(rateInput) || 0;
            const iibbAmount = Number((net * (rate / 100)).toFixed(2));
            document.getElementById('taxIibbAmount').value = iibbAmount;
        }

        this.recalculateTotalInvoiceFromInputs();
    },

    recalculateTotalInvoiceFromInputs() {
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        const net = parseFloat(document.getElementById('taxNetSubtotal').value) || 0;
        const iva = parseFloat(document.getElementById('taxIvaAmount').value) || 0;
        const iibb = parseFloat(document.getElementById('taxIibbAmount').value) || 0;
        const ivaPercep = parseFloat(document.getElementById('taxIvaPerception').value) || 0;
        const other = parseFloat(document.getElementById('taxOtherTaxes').value) || 0;

        const totalTaxes = Number((iva + iibb + ivaPercep + other).toFixed(2));
        const totalInvoice = Number((net + totalTaxes).toFixed(2));

        document.getElementById('footerTotalTaxes').textContent = `${curr} ${totalTaxes.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('purchaseTotalAmount').textContent = `${curr} ${totalInvoice.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    },

    handleSavePurchase(event) {
        event.preventDefault();
        try {
            const supSelect = document.getElementById('purchaseSupplierSelect');
            const supplierId = supSelect.value;
            const supplierName = supSelect.options[supSelect.selectedIndex]?.text?.split(' (')[0] || '';

            if (!supplierId && !supplierName) {
                this.showToast('Por favor selecciona un proveedor.', 'warning');
                return;
            }

            const rows = document.querySelectorAll('.purchase-item-row');
            const items = [];

            rows.forEach(row => {
                const select = row.querySelector('.row-product-select');
                const productId = select.value;
                const productName = select.options[select.selectedIndex]?.text?.split(' (')[0] || '';
                const unit = row.querySelector('.row-unit-badge').textContent.trim();
                const quantity = parseFloat(row.querySelector('.row-qty-input').value) || 0;
                const unitCost = parseFloat(row.querySelector('.row-cost-input').value) || 0;
                const discountPercent = parseFloat(row.querySelector('.row-discount-pct')?.value) || 0;
                const discountAmount = parseFloat(row.querySelector('.row-discount-val')?.value) || 0;
                const gross = Number((quantity * unitCost).toFixed(2));
                const subtotal = Math.max(0, Number((gross - discountAmount).toFixed(2)));

                if (productId && quantity > 0) {
                    items.push({
                        productId,
                        productName,
                        unit,
                        quantity,
                        unitCost,
                        discountPercent,
                        discountAmount,
                        subtotal
                    });
                }
            });

            if (items.length === 0) {
                this.showToast('Selecciona al menos un insumo con cantidad mayor a 0.', 'warning');
                return;
            }

            const netSubtotal = parseFloat(document.getElementById('taxNetSubtotal').value) || 0;
            const ivaRate = parseFloat(document.getElementById('taxIvaRate').value) || 0;
            const ivaAmount = parseFloat(document.getElementById('taxIvaAmount').value) || 0;
            const iibbRate = parseFloat(document.getElementById('taxIibbRate').value) || 0;
            const iibbAmount = parseFloat(document.getElementById('taxIibbAmount').value) || 0;
            const ivaPerception = parseFloat(document.getElementById('taxIvaPerception').value) || 0;
            const otherTaxes = parseFloat(document.getElementById('taxOtherTaxes').value) || 0;
            const costMode = document.getElementById('purchaseCostMode').value || 'net';

            const paymentStatus = document.getElementById('purchasePaymentStatus').value;
            const paymentMethod = document.getElementById('purchasePaymentMethod').value;
            const purchaseDate = document.getElementById('purchaseDate').value;
            const paymentDateInput = document.getElementById('purchasePaymentDate')?.value || '';
            const paymentDate = paymentStatus === 'pagada'
                ? (paymentDateInput || purchaseDate)
                : (paymentDateInput || '');

            const purchaseData = {
                date: purchaseDate,
                supplierId: supplierId,
                supplier: supplierName,
                invoiceNumber: document.getElementById('purchaseInvoice').value.trim(),
                paymentStatus: paymentStatus,
                paymentDate: paymentDate,
                paymentMethod: paymentMethod,
                notes: document.getElementById('purchaseNotes').value.trim(),
                updateCostPrices: document.getElementById('purchaseUpdateCost').checked,
                costMode: costMode,
                netSubtotal: netSubtotal,
                ivaRate: ivaRate,
                ivaAmount: ivaAmount,
                iibbRate: iibbRate,
                iibbAmount: iibbAmount,
                ivaPerception: ivaPerception,
                otherTaxes: otherTaxes,
                totalInvoice: Number((netSubtotal + ivaAmount + iibbAmount + ivaPerception + otherTaxes).toFixed(2)),
                items: items
            };

            const editId = document.getElementById('purchaseEditId')?.value;
            if (editId) {
                const updated = PurchaseManager.updatePurchase(editId, purchaseData);
                this.showToast(`¡Factura ${updated.invoiceNumber || 'S/N'} actualizada con éxito! Stock recalculado.`, 'success');
                this.resetPurchaseForm();
                this.populateDropdowns();
                if (StorageManager.hasPermission(this.activeUser, 'compras-historial')) {
                    this.navigate('compras-historial');
                }
                return;
            }

            const saved = PurchaseManager.registerPurchase(purchaseData);
            this.showToast(`¡Factura ${saved.invoiceNumber} registrada con éxito! Total: $${saved.totalInvoice}. Stock actualizado.`, 'success');

            this.populateDropdowns();
            if (StorageManager.hasPermission(this.activeUser, 'compras-historial')) {
                this.navigate('compras-historial');
            } else {
                this.resetPurchaseForm();
            }
        } catch (e) {
            console.error(e);
            this.showToast(e.message || 'Error al registrar la factura', 'error');
        }
    },

    prefillPurchaseFromOrder(order) {
        this.resetPurchaseForm();
        if (order.supplierId) {
            const supSelect = document.getElementById('purchaseSupplierSelect');
            supSelect.value = order.supplierId;
        }

        const tbody = document.getElementById('purchaseItemsTableBody');
        tbody.innerHTML = '';

        (order.items || []).forEach(it => {
            this.addPurchaseRow(it.productId, it.quantity, it.estimatedCost);
        });

        document.getElementById('purchaseNotes').value = `Origen: Orden de Compra Nº ${order.orderNumber}. ${order.notes || ''}`;
        this.showToast(`Datos transferidos desde la Orden de Compra ${order.orderNumber}. Completa el Nº de Factura para registrar.`, 'info');
    },

    // ==========================================
    // MÓDULO ÓRDENES DE COMPRA (OC)
    // ==========================================
    handleOCSupplierSelected(supplierId) {
        const infoBox = document.getElementById('ocSupplierInfoBox');
        const tbody = document.getElementById('ocItemsTableBody');

        if (!supplierId) {
            infoBox.innerHTML = '<span class="text-slate-400 italic">Selecciona un proveedor arriba para ver sus insumos habituales y formas de pago.</span>';
            tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-slate-400">Selecciona un proveedor arriba para listar sus insumos.</td></tr>';
            document.getElementById('ocGrandTotal').textContent = '$ 0.00';
            return;
        }

        const supplier = StorageManager.getSupplierById(supplierId);
        if (supplier) {
            infoBox.innerHTML = `
                <div class="bg-white p-2.5 rounded-lg border border-amber-200">
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold text-slate-800">
                        <span><i class="fa-solid fa-building text-amber-600"></i> ${supplier.name}</span>
                        ${supplier.cuit ? `<span>CUIT: ${supplier.cuit}</span>` : ''}
                        ${supplier.phone ? `<span><i class="fa-solid fa-phone text-slate-400"></i> ${supplier.phone}</span>` : ''}
                        ${supplier.email ? `<span><i class="fa-solid fa-envelope text-slate-400"></i> ${supplier.email}</span>` : ''}
                    </div>
                    <div class="text-[11px] text-slate-500 mt-1">
                        <strong>Condiciones de Pago:</strong> ${supplier.paymentMethods || 'A convenir'} &bull; <em>${supplier.notes || ''}</em>
                    </div>
                </div>
            `;
        }

        const products = ProductManager.getProductsForSupplier(supplierId);
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        if (products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="py-8 text-center text-slate-400">
                        No hay insumos asignados ni compras previas con este proveedor.<br>
                        <button type="button" onclick="App.addCustomProductToOC()" class="mt-2 text-xs text-sky-600 hover:underline font-bold">+ Agregar insumo del catálogo a este pedido</button>
                    </td>
                </tr>
            `;
            document.getElementById('ocGrandTotal').textContent = `${curr} 0.00`;
            return;
        }

        tbody.innerHTML = products.map(p => {
            const stock = p.currentStock || 0;
            const min = p.minStock || 0;
            const isLow = stock <= min;
            const cost = p.costPrice || 0;
            const orderQty = p.suggestedQty || 0;
            const subtotal = Number((orderQty * cost).toFixed(2));

            return `
                <tr class="table-row-hover text-xs oc-item-row" data-prod-id="${p.id}" data-prod-name="${p.name}" data-unit="${p.unit}">
                    <td class="py-2.5 px-3 font-mono font-bold text-slate-700">${p.code}</td>
                    <td class="py-2.5 px-4 font-semibold text-slate-800">
                        <div>${p.name}</div>
                        <span class="text-[10px] text-slate-400">${p.category}</span>
                    </td>
                    <td class="py-2.5 px-2 text-center text-slate-600 font-bold">${p.unit}</td>
                    <td class="py-2.5 px-3 text-right font-black ${isLow ? 'text-red-600 bg-red-50/50' : 'text-slate-700'}">
                        ${stock} ${isLow ? '<span class="text-[10px] text-red-500 font-normal block">¡Bajo stock!</span>' : ''}
                    </td>
                    <td class="py-2.5 px-3 text-right text-slate-400">${min}</td>
                    <td class="py-2.5 px-3 text-right bg-amber-50/70">
                        <input type="number" step="any" min="0" value="${orderQty}" oninput="App.recalculateOCRow(this)" class="oc-order-qty w-28 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-right text-xs font-black text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none">
                    </td>
                    <td class="py-2.5 px-3 text-right">
                        <input type="number" step="any" min="0" value="${cost}" oninput="App.recalculateOCRow(this)" class="oc-order-cost w-28 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-right text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none">
                    </td>
                    <td class="py-2.5 px-4 text-right font-black text-slate-900 oc-row-subtotal">
                        ${curr} ${subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </td>
                    <td class="py-2.5 px-2 text-center">
                        <button type="button" onclick="this.closest('tr').remove(); App.calculateOCTotals();" class="text-slate-400 hover:text-red-600 p-1" title="Quitar de este pedido">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        this.calculateOCTotals();
    },

    recalculateOCRow(inputEl) {
        const row = inputEl.closest('tr');
        const qty = parseFloat(row.querySelector('.oc-order-qty').value) || 0;
        const cost = parseFloat(row.querySelector('.oc-order-cost').value) || 0;
        const subtotal = Number((qty * cost).toFixed(2));

        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        row.querySelector('.oc-row-subtotal').textContent = `${curr} ${subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        this.calculateOCTotals();
    },

    calculateOCTotals() {
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';
        const rows = document.querySelectorAll('.oc-item-row');

        let grandTotal = 0;
        rows.forEach(r => {
            const qty = parseFloat(r.querySelector('.oc-order-qty').value) || 0;
            const cost = parseFloat(r.querySelector('.oc-order-cost').value) || 0;
            grandTotal += qty * cost;
        });

        document.getElementById('ocGrandTotal').textContent = `${curr} ${grandTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    },

    addCustomProductToOC() {
        const products = StorageManager.getProducts();
        const prodName = prompt('Ingresa el nombre o código del insumo que deseas añadir a la orden:');
        if (!prodName) return;

        const prod = products.find(p => p.name.toLowerCase().includes(prodName.toLowerCase().trim()) || p.code.toLowerCase() === prodName.toLowerCase().trim());
        if (!prod) {
            alert('No se encontró ningún insumo con ese nombre o código.');
            return;
        }

        const tbody = document.getElementById('ocItemsTableBody');
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        const row = document.createElement('tr');
        row.className = 'table-row-hover text-xs oc-item-row';
        row.setAttribute('data-prod-id', prod.id);
        row.setAttribute('data-prod-name', prod.name);
        row.setAttribute('data-unit', prod.unit);

        row.innerHTML = `
            <td class="py-2.5 px-3 font-mono font-bold text-slate-700">${prod.code}</td>
            <td class="py-2.5 px-4 font-semibold text-slate-800">
                <div>${prod.name}</div>
                <span class="text-[10px] text-slate-400">${prod.category}</span>
            </td>
            <td class="py-2.5 px-2 text-center text-slate-600 font-bold">${prod.unit}</td>
            <td class="py-2.5 px-3 text-right font-black text-slate-700">${prod.currentStock || 0}</td>
            <td class="py-2.5 px-3 text-right text-slate-400">${prod.minStock || 0}</td>
            <td class="py-2.5 px-3 text-right bg-amber-50/70">
                <input type="number" step="any" min="0" value="10" oninput="App.recalculateOCRow(this)" class="oc-order-qty w-28 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-right text-xs font-black text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none">
            </td>
            <td class="py-2.5 px-3 text-right">
                <input type="number" step="any" min="0" value="${prod.costPrice || 0}" oninput="App.recalculateOCRow(this)" class="oc-order-cost w-28 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-right text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none">
            </td>
            <td class="py-2.5 px-4 text-right font-black text-slate-900 oc-row-subtotal">
                ${curr} ${(10 * (prod.costPrice || 0)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </td>
            <td class="py-2.5 px-2 text-center">
                <button type="button" onclick="this.closest('tr').remove(); App.calculateOCTotals();" class="text-slate-400 hover:text-red-600 p-1">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;

        tbody.appendChild(row);
        this.calculateOCTotals();
    },

    saveCurrentPurchaseOrder() {
        const supSelect = document.getElementById('ocSupplierSelect');
        const supplierId = supSelect.value;
        if (!supplierId) {
            this.showToast('Selecciona un proveedor para emitir la Orden de Compra.', 'warning');
            return;
        }

        const supplier = StorageManager.getSupplierById(supplierId);
        const rows = document.querySelectorAll('.oc-item-row');
        const items = [];

        rows.forEach(r => {
            const qty = parseFloat(r.querySelector('.oc-order-qty').value) || 0;
            const cost = parseFloat(r.querySelector('.oc-order-cost').value) || 0;
            if (qty > 0) {
                items.push({
                    productId: r.getAttribute('data-prod-id'),
                    productName: r.getAttribute('data-prod-name'),
                    unit: r.getAttribute('data-unit'),
                    quantity: qty,
                    estimatedCost: cost,
                    subtotal: Number((qty * cost).toFixed(2))
                });
            }
        });

        if (items.length === 0) {
            this.showToast('Ingresa al menos un insumo con cantidad a pedir mayor a 0.', 'warning');
            return;
        }

        const totalEst = items.reduce((sum, it) => sum + it.subtotal, 0);

        const orderData = {
            date: new Date().toISOString().split('T')[0],
            supplierId: supplier.id,
            supplierName: supplier.name,
            notes: document.getElementById('ocNotes').value.trim(),
            items: items,
            totalEstimated: Number(totalEst.toFixed(2)),
            status: 'pendiente'
        };

        const saved = StorageManager.savePurchaseOrder(orderData);
        this.showToast(`¡Orden de Compra ${saved.orderNumber} guardada con éxito!`, 'success');
        this.renderOCHistoryTable();
    },

    printCurrentPurchaseOrder() {
        const supSelect = document.getElementById('ocSupplierSelect');
        const supplierId = supSelect.value;
        if (!supplierId) {
            this.showToast('Selecciona un proveedor primero.', 'warning');
            return;
        }

        const supplier = StorageManager.getSupplierById(supplierId);
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';
        const rows = document.querySelectorAll('.oc-item-row');

        const items = [];
        rows.forEach(r => {
            const qty = parseFloat(r.querySelector('.oc-order-qty').value) || 0;
            const cost = parseFloat(r.querySelector('.oc-order-cost').value) || 0;
            if (qty > 0) {
                items.push({
                    name: r.getAttribute('data-prod-name'),
                    unit: r.getAttribute('data-unit'),
                    quantity: qty,
                    cost: cost,
                    subtotal: Number((qty * cost).toFixed(2))
                });
            }
        });

        if (items.length === 0) {
            this.showToast('La orden no tiene insumos con cantidad a pedir.', 'warning');
            return;
        }

        const total = items.reduce((sum, i) => sum + i.subtotal, 0);

        const printWin = window.open('', '_blank');
        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Orden de Compra - ${supplier.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; font-size: 13px; margin: 30px; color: #222; }
                    .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
                    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
                    th { background: #f1f5f9; font-weight: bold; }
                    .total-box { margin-top: 20px; text-align: right; font-size: 16px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1 style="margin:0 0 5px 0; font-size:22px;">${settings.businessName}</h1>
                        <p style="margin:0; color:#64748b;">SOLICITUD Y ORDEN DE COMPRA</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="margin:0; font-weight:bold;">Fecha: ${new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div class="info-box">
                    <p style="margin:0 0 4px 0;"><strong>Señores:</strong> ${supplier.name}</p>
                    ${supplier.cuit ? `<p style="margin:0 0 4px 0;"><strong>CUIT:</strong> ${supplier.cuit}</p>` : ''}
                    ${supplier.phone ? `<p style="margin:0 0 4px 0;"><strong>Teléfono:</strong> ${supplier.phone}</p>` : ''}
                    <p style="margin:0;"><strong>Condición de Pago Acordada:</strong> ${supplier.paymentMethods || 'A convenir'}</p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%">Insumo / Descripción</th>
                            <th style="width: 10%; text-align:center">Unidad</th>
                            <th style="width: 15%; text-align:right">Cantidad Solicitada</th>
                            <th style="width: 15%; text-align:right">Precio Est. ($)</th>
                            <th style="width: 10%; text-align:right">Subtotal ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(it => `
                            <tr>
                                <td><strong>${it.name}</strong></td>
                                <td style="text-align:center">${it.unit}</td>
                                <td style="text-align:right; font-weight:bold;">${it.quantity}</td>
                                <td style="text-align:right">${curr} ${it.cost.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                                <td style="text-align:right; font-weight:bold;">${curr} ${it.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="total-box">
                    TOTAL ESTIMADO DEL PEDIDO: ${curr} ${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </div>

                <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 11px; color: #64748b;">
                    <p>Observaciones: ${document.getElementById('ocNotes').value || 'Por favor confirmar recepción y plazo de entrega estimado.'}</p>
                </div>
            </body>
            </html>
        `);
        printWin.document.close();
        printWin.focus();
        printWin.print();
    },

    renderOCHistoryTable() {
        const orders = StorageManager.getPurchaseOrders();
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';
        const tbody = document.getElementById('ocHistoryTableBody');

        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No hay órdenes de compra emitidas todavía.</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.map(o => {
            let statusBadge = '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800">Pendiente</span>';
            if (o.status === 'recibida') {
                statusBadge = '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">✓ Recibida (Facturada)</span>';
            } else if (o.status === 'cancelada') {
                statusBadge = '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-200 text-slate-600">Cancelada</span>';
            }

            return `
                <tr class="table-row-hover text-xs">
                    <td class="py-2.5 px-3 text-slate-600">${o.date}</td>
                    <td class="py-2.5 px-3 font-mono font-bold text-slate-800">${o.orderNumber || o.id}</td>
                    <td class="py-2.5 px-4 font-semibold text-slate-800">${o.supplierName}</td>
                    <td class="py-2.5 px-3 text-slate-600">${(o.items || []).length} insumos</td>
                    <td class="py-2.5 px-4 text-right font-black text-slate-900">${curr} ${Number(o.totalEstimated || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                    <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                    <td class="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        ${o.status !== 'recibida' && StorageManager.hasPermission(this.activeUser, 'compras-nueva') ? `
                            <button onclick="App.convertOrderToPurchase('${o.id}')" class="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded text-[11px] font-bold" title="Cargar como factura de compra al recibir">
                                <i class="fa-solid fa-cart-arrow-down"></i> Recibir
                            </button>
                        ` : ''}
                        <button onclick="StorageManager.deletePurchaseOrder('${o.id}'); App.renderOCHistoryTable();" class="p-1 text-slate-400 hover:text-red-600" title="Eliminar orden">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    convertOrderToPurchase(orderId) {
        const orders = StorageManager.getPurchaseOrders();
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        if (confirm(`¿Convertir la Orden ${order.orderNumber} en Factura de Compra? Se pre-llenará el formulario de compra con los insumos solicitados.`)) {
            StorageManager.updatePurchaseOrderStatus(orderId, 'recibida');
            this.navigate('compras-nueva', { prefilledOrder: order });
        }
    },

    // ==========================================
    // MÓDULO PROVEEDORES
    // ==========================================
    renderSuppliersView() {
        const search = (document.getElementById('supplierSearchInput')?.value || '').toLowerCase().trim();
        let suppliers = StorageManager.getSuppliers();
        const products = StorageManager.getProducts();

        const badgeEl = document.getElementById('suppliersTotalBadge');
        if (badgeEl) badgeEl.textContent = `${suppliers.length} ${suppliers.length === 1 ? 'proveedor' : 'proveedores'}`;

        if (search) {
            suppliers = suppliers.filter(s =>
                s.name.toLowerCase().includes(search) ||
                (s.category && s.category.toLowerCase().includes(search)) ||
                (s.cuit && s.cuit.includes(search)) ||
                (s.contactPerson && s.contactPerson.toLowerCase().includes(search)) ||
                (s.phone && s.phone.toLowerCase().includes(search)) ||
                (s.email && s.email.toLowerCase().includes(search))
            );
        }

        const tbody = document.getElementById('suppliersTableBody');
        const grid = document.getElementById('suppliersCardGrid');
        const container = tbody || grid;
        if (!container) return;

        if (suppliers.length === 0) {
            container.innerHTML = `<tr><td colspan="8" class="py-12 text-center text-slate-400">No se encontraron proveedores${search ? ' que coincidan con la búsqueda' : ''}.</td></tr>`;
            return;
        }

        container.innerHTML = suppliers.map(s => {
            const linkedCount = products.filter(p => {
                if (p.supplierId === s.id) return true;
                if (p.supplier && p.supplier.toLowerCase() === s.name.toLowerCase()) return true;
                // Multi-select: array de secundarios
                if (Array.isArray(p.secondarySupplierIds) && p.secondarySupplierIds.includes(s.id)) return true;
                // Retrocompat: string legacy
                if (p.secondarySupplierId === s.id) return true;
                return false;
            }).length;

            const phoneHtml = s.phone
                ? `<a href="tel:${s.phone}" class="hover:text-teal-600 font-mono text-slate-700 whitespace-nowrap flex items-center gap-1.5"><i class="fa-solid fa-phone text-slate-400 text-[10px]"></i> ${s.phone}</a>`
                : '<span class="text-slate-300">-</span>';

            const emailHtml = s.email
                ? `<a href="mailto:${s.email}" class="hover:text-teal-600 text-slate-700 truncate max-w-[170px] inline-flex items-center gap-1.5" title="${s.email}"><i class="fa-solid fa-envelope text-slate-400 text-[10px]"></i> ${s.email}</a>`
                : '<span class="text-slate-300">-</span>';

            const contactHtml = s.contactPerson || s.address
                ? `<div>
                    ${s.contactPerson ? `<div class="font-medium text-slate-800 flex items-center gap-1"><i class="fa-solid fa-user text-slate-400 text-[10px]"></i> ${s.contactPerson}</div>` : ''}
                    ${s.address ? `<div class="text-[11px] text-slate-400 flex items-center gap-1 truncate max-w-[200px]" title="${s.address}"><i class="fa-solid fa-location-dot text-slate-300 text-[10px]"></i> ${s.address}</div>` : ''}
                   </div>`
                : '<span class="text-slate-300">-</span>';

            const paymentHtml = s.paymentMethods
                ? `<span class="inline-flex items-center gap-1 text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[11px]"><i class="fa-solid fa-wallet text-slate-400 text-[10px]"></i> ${s.paymentMethods}</span>`
                : '<span class="text-slate-400 text-[11px]">A convenir</span>';

            return `
                <tr class="table-row-hover text-xs">
                    <td class="py-3 px-4">
                        <div class="font-bold text-slate-900 text-sm">${s.name}</div>
                        <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">${s.category || 'General'}</span>
                            ${s.notes ? `<span class="text-[10px] text-slate-400 italic truncate max-w-[220px]" title="${s.notes}"><i class="fa-regular fa-comment-dots text-slate-300"></i> ${s.notes}</span>` : ''}
                        </div>
                    </td>
                    <td class="py-3 px-3 font-mono font-medium text-slate-700">
                        ${s.cuit || '<span class="text-slate-300">-</span>'}
                    </td>
                    <td class="py-3 px-3">
                        ${contactHtml}
                    </td>
                    <td class="py-3 px-3">
                        ${phoneHtml}
                    </td>
                    <td class="py-3 px-3">
                        ${emailHtml}
                    </td>
                    <td class="py-3 px-3">
                        ${paymentHtml}
                    </td>
                    <td class="py-3 px-2 text-center">
                        <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${linkedCount > 0 ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-slate-100 text-slate-400'}" title="${linkedCount} insumos vinculados">
                            ${linkedCount}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        ${StorageManager.hasPermission(this.activeUser, 'ordenes-compra') ? `
                            <button onclick="App.navigate('ordenes-compra', { supplierId: '${s.id}' })" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-xs font-bold transition-colors inline-flex items-center gap-1" title="Generar Orden de Compra">
                                <i class="fa-solid fa-file-invoice"></i>
                                <span class="hidden xl:inline"> OC</span>
                            </button>
                        ` : ''}
                        <button onclick="App.navigate('evolucion-compras', { supplierId: '${s.id}' })" class="p-1.5 text-slate-500 hover:text-sky-600 rounded transition-colors" title="Ver Historial y Evolución de Compras">
                            <i class="fa-solid fa-chart-line"></i>
                        </button>
                        <button onclick="App.openSupplierModal('${s.id}')" class="p-1.5 text-slate-500 hover:text-teal-600 rounded transition-colors" title="Editar proveedor">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="App.deleteSupplier('${s.id}')" class="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors" title="Eliminar proveedor">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    exportSuppliersToCSV() {
        const suppliers = StorageManager.getSuppliers();
        const settings = StorageManager.getSettings();
        const products = StorageManager.getProducts();

        let csv = `DIRECTORIO DE PROVEEDORES - ${settings.businessName}\r\n`;
        csv += `Generado el: ${new Date().toLocaleDateString()}\r\n\r\n`;
        csv += 'Nombre;Rubro;CUIT;Contacto;Telefono;Email;Direccion;CondicionPago;InsumosAsociados;Observaciones\r\n';

        suppliers.forEach(s => {
            const linkedCount = products.filter(p => p.supplierId === s.id || p.secondarySupplierId === s.id || (p.supplier && p.supplier.toLowerCase() === s.name.toLowerCase())).length;
            csv += `"${s.name || ''}";"${s.category || ''}";"${s.cuit || ''}";"${s.contactPerson || ''}";"${s.phone || ''}";"${s.email || ''}";"${s.address || ''}";"${s.paymentMethods || ''}";"${linkedCount}";"${(s.notes || '').replace(/"/g, '""')}"\r\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Directorio_Proveedores_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    openSupplierModal(supplierId = null) {
        const form = document.getElementById('supplierForm');
        form.reset();

        if (supplierId) {
            const s = StorageManager.getSupplierById(supplierId);
            if (s) {
                document.getElementById('supplierModalTitle').innerHTML = '<i class="fa-solid fa-truck-field text-teal-400"></i> Editar Proveedor';
                document.getElementById('supFormId').value = s.id;
                document.getElementById('supFormName').value = s.name;
                document.getElementById('supFormCuit').value = s.cuit || '';
                document.getElementById('supFormCategory').value = s.category || '';
                document.getElementById('supFormPhone').value = s.phone || '';
                document.getElementById('supFormEmail').value = s.email || '';
                document.getElementById('supFormAddress').value = s.address || '';
                document.getElementById('supFormContact').value = s.contactPerson || '';
                document.getElementById('supFormPaymentMethods').value = s.paymentMethods || '';
                document.getElementById('supFormNotes').value = s.notes || '';
            }
        } else {
            document.getElementById('supplierModalTitle').innerHTML = '<i class="fa-solid fa-truck-field text-teal-400"></i> Nuevo Proveedor';
            document.getElementById('supFormId').value = '';
        }

        document.getElementById('supplierModal').classList.remove('hidden');
    },

    closeSupplierModal() {
        document.getElementById('supplierModal').classList.add('hidden');
    },

    handleSaveSupplier(event) {
        event.preventDefault();
        try {
            const data = {
                id: document.getElementById('supFormId').value || undefined,
                name: document.getElementById('supFormName').value.trim(),
                cuit: document.getElementById('supFormCuit').value.trim(),
                category: document.getElementById('supFormCategory').value.trim() || 'General',
                phone: document.getElementById('supFormPhone').value.trim(),
                email: document.getElementById('supFormEmail').value.trim(),
                address: document.getElementById('supFormAddress').value.trim(),
                contactPerson: document.getElementById('supFormContact').value.trim(),
                paymentMethods: document.getElementById('supFormPaymentMethods').value.trim() || 'A convenir',
                notes: document.getElementById('supFormNotes').value.trim()
            };

            StorageManager.saveSupplier(data);
            this.closeSupplierModal();
            this.populateDropdowns();
            this.showToast(`Proveedor "${data.name}" guardado con éxito.`, 'success');
            this.renderSuppliersView();
        } catch (e) {
            console.error(e);
            this.showToast(e.message || 'Error al guardar proveedor', 'error');
        }
    },

    deleteSupplier(id) {
        const sup = StorageManager.getSupplierById(id);
        if (!confirm(`¿Estás seguro de eliminar al proveedor "${sup?.name || ''}"?`)) return;

        StorageManager.deleteSupplier(id);
        this.showToast('Proveedor eliminado.', 'info');
        this.populateDropdowns();
        this.renderSuppliersView();
    },

    // ==========================================
    // MÓDULO GESTIÓN DE CATEGORÍAS
    // ==========================================
    openCategoryManagerModal() {
        this.resetCategoryForm();
        this.renderCategoryList();
        document.getElementById('categoryManagerModal').classList.remove('hidden');
    },

    closeCategoryManagerModal() {
        document.getElementById('categoryManagerModal').classList.add('hidden');
    },

    renderCategoryList() {
        const cats = StorageManager.getCategories();
        const container = document.getElementById('categoryListContainer');

        if (cats.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-slate-400">No hay categorías registradas.</div>';
            return;
        }

        container.innerHTML = cats.map(c => `
            <div class="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                <div>
                    <strong class="text-slate-800">${c.name}</strong>
                    ${c.description ? `<p class="text-[11px] text-slate-400">${c.description}</p>` : ''}
                </div>
                <div class="space-x-1">
                    <button type="button" onclick="App.editCategory('${c.id}')" class="p-1 text-slate-400 hover:text-indigo-600" title="Editar nombre">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" onclick="App.deleteCategory('${c.id}')" class="p-1 text-slate-400 hover:text-red-600" title="Eliminar categoría">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    resetCategoryForm() {
        document.getElementById('catFormId').value = '';
        document.getElementById('catFormName').value = '';
        document.getElementById('catFormDesc').value = '';
        document.getElementById('catFormTitle').textContent = 'Nueva Categoría';
        document.getElementById('catFormSubmitBtn').textContent = '+ Agregar Categoría';
        document.getElementById('catFormCancelBtn').classList.add('hidden');
    },

    editCategory(id) {
        const cats = StorageManager.getCategories();
        const cat = cats.find(c => c.id === id);
        if (!cat) return;

        document.getElementById('catFormId').value = cat.id;
        document.getElementById('catFormName').value = cat.name;
        document.getElementById('catFormDesc').value = cat.description || '';
        document.getElementById('catFormTitle').textContent = 'Editar Categoría';
        document.getElementById('catFormSubmitBtn').textContent = 'Guardar Cambios';
        document.getElementById('catFormCancelBtn').classList.remove('hidden');
    },

    handleSaveCategory(event) {
        event.preventDefault();
        try {
            const id = document.getElementById('catFormId').value || undefined;
            const name = document.getElementById('catFormName').value.trim();
            const description = document.getElementById('catFormDesc').value.trim();

            if (!name) return;

            StorageManager.saveCategory({ id, name, description });
            this.resetCategoryForm();
            this.renderCategoryList();
            this.populateDropdowns();
            this.showToast(`Categoría "${name}" guardada.`, 'success');

            if (this.currentView === 'productos') this.renderProductsTable();
        } catch (e) {
            console.error(e);
            this.showToast(e.message || 'Error al guardar categoría', 'error');
        }
    },

    deleteCategory(id) {
        try {
            if (!confirm('¿Deseas eliminar esta categoría?')) return;
            StorageManager.deleteCategory(id);
            this.renderCategoryList();
            this.populateDropdowns();
            this.showToast('Categoría eliminada.', 'info');
            if (this.currentView === 'productos') this.renderProductsTable();
        } catch (e) {
            alert(e.message);
        }
    },

    // ==========================================
    // MÓDULO REGISTRO / MODIFICACIÓN DE PAGO DE FACTURAS
    // ==========================================
    openPaymentModal(purchaseId) {
        const purchase = StorageManager.getPurchases().find(p => p.id === purchaseId);
        if (!purchase) return;

        const curr = StorageManager.getSettings().currency || '$';

        document.getElementById('payModalPurchaseId').value = purchase.id;
        document.getElementById('payModalInvoice').textContent = purchase.invoiceNumber || 'S/N';
        document.getElementById('payModalSupplier').textContent = purchase.supplier;
        document.getElementById('payModalTotal').textContent = `${curr} ${(purchase.totalInvoice || purchase.totalCost).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        const status = purchase.paymentStatus || 'pagada';
        document.getElementById('payModalStatus').value = status;
        document.getElementById('payModalDate').value = purchase.paymentDate || new Date().toISOString().split('T')[0];
        document.getElementById('payModalMethod').value = purchase.paymentMethod || 'Efectivo';
        document.getElementById('payModalNotes').value = purchase.notes || '';

        this.handlePayModalStatusChange(status);
        document.getElementById('paymentModal').classList.remove('hidden');
    },

    closePaymentModal() {
        document.getElementById('paymentModal').classList.add('hidden');
    },

    handlePayModalStatusChange(status) {
        const dateBox = document.getElementById('payModalDateBox');
        if (status === 'pendiente') {
            dateBox.classList.add('hidden');
        } else {
            dateBox.classList.remove('hidden');
        }
    },

    handleSavePayment(event) {
        event.preventDefault();
        try {
            const pId = document.getElementById('payModalPurchaseId').value;
            const status = document.getElementById('payModalStatus').value;
            const date = document.getElementById('payModalDate').value;
            const method = document.getElementById('payModalMethod').value;
            const notes = document.getElementById('payModalNotes').value.trim();

            StorageManager.updatePurchasePayment(pId, {
                paymentStatus: status,
                paymentDate: date,
                paymentMethod: method,
                notes: notes
            });

            this.closePaymentModal();
            this.showToast('Estado de pago actualizado correctamente.', 'success');
            this.renderPurchasesTable();
            if (this.currentView === 'dashboard') this.renderDashboard();
        } catch (e) {
            console.error(e);
            this.showToast('Error al actualizar pago', 'error');
        }
    },

    // ==========================================
    // MÓDULO CARGA DEDICADA DE INVENTARIOS (II / IF)
    // ==========================================
    setInventorySubTab(tab) {
        this.inventorySubTab = tab;

        const btnIni   = document.getElementById('subtab-btn-inicial');
        const btnFin   = document.getElementById('subtab-btn-final');
        const btnSnap  = document.getElementById('subtab-btn-snapshots');
        const contIni  = document.getElementById('subtab-content-inicial');
        const contFin  = document.getElementById('subtab-content-final');
        const contSnap = document.getElementById('subtab-content-snapshots');

        const activeClass   = 'px-4 py-2 rounded-lg text-xs font-bold transition-all bg-white text-slate-800 shadow-sm';
        const inactiveClass = 'px-4 py-2 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-800';

        btnIni.className  = tab === 'inicial'    ? activeClass : inactiveClass;
        btnFin.className  = tab === 'final'      ? activeClass : inactiveClass;
        btnSnap.className = tab === 'snapshots'  ? activeClass : inactiveClass;

        contIni.classList.toggle ('hidden', tab !== 'inicial');
        contFin.classList.toggle ('hidden', tab !== 'final');
        contSnap.classList.toggle('hidden', tab !== 'snapshots');

        if (tab === 'snapshots') {
            this.renderSnapshotsTable();
        } else {
            this.renderInventorySheets();
        }
    },

    // ==========================================
    // GESTIÓN DE SNAPSHOTS (CONTEOS CON FECHA LIBRE)
    // ==========================================
    renderSnapshotsTable() {
        const snapshots = StorageManager.getSnapshots();
        const tbody = document.getElementById('snapshotsTableBody');
        if (!tbody) return;

        if (!snapshots || snapshots.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">No hay conteos registrados. Hacé clic en "Nuevo Conteo" para empezar.</td></tr>`;
            return;
        }

        const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));

        tbody.innerHTML = sorted.map(snap => {
            const itemCount = Object.keys(snap.items || {}).filter(k => snap.items[k].qty !== '' && snap.items[k].qty !== null).length;
            const dateStr   = snap.date ? new Date(snap.date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

            return `
                <tr class="table-row-hover text-xs">
                    <td class="py-3 px-4">
                        <div class="font-bold text-slate-800">${snap.name || 'Sin nombre'}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">ID: ${snap.id}</div>
                    </td>
                    <td class="py-3 px-3">
                        <span class="inline-flex items-center gap-1 bg-violet-100 text-violet-800 px-2 py-0.5 rounded font-semibold">
                            <i class="fa-solid fa-calendar-day text-[10px]"></i>
                            ${dateStr}
                        </span>
                    </td>
                    <td class="py-3 px-3 text-center">
                        <span class="font-bold ${itemCount > 0 ? 'text-emerald-700' : 'text-slate-400'}">${itemCount}</span>
                        <span class="text-slate-400"> ítems</span>
                    </td>
                    <td class="py-3 px-3 text-slate-500">${snap.notes || '-'}</td>
                    <td class="py-3 px-3 text-slate-500">${snap.createdBy || '-'}</td>
                    <td class="py-3 px-3 text-right">
                        <div class="flex items-center gap-1.5 justify-end">
                            <button onclick="App.openSnapshotModal('${snap.id}')" class="inline-flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
                                <i class="fa-solid fa-pen-to-square"></i> Editar
                            </button>
                            <button onclick="App.deleteSnapshot('${snap.id}')" class="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    openSnapshotModal(snapId = null) {
        const modal    = document.getElementById('snapshotModal');
        const title    = document.getElementById('snapshotModalTitle');
        const nameInp  = document.getElementById('snapName');
        const dateInp  = document.getElementById('snapDate');
        const notesInp = document.getElementById('snapNotes');
        const editId   = document.getElementById('snapEditId');

        const today = new Date().toISOString().split('T')[0];
        let existingItems = {};

        if (snapId) {
            const snap = StorageManager.getSnapshotById(snapId);
            if (!snap) { this.showToast('Conteo no encontrado.', 'error'); return; }
            title.textContent     = 'Editar Conteo: ' + snap.name;
            nameInp.value         = snap.name || '';
            dateInp.value         = snap.date || today;
            notesInp.value        = snap.notes || '';
            editId.value          = snap.id;
            existingItems         = snap.items || {};
        } else {
            title.textContent = 'Nuevo Conteo Físico';
            nameInp.value     = '';
            dateInp.value     = today;
            notesInp.value    = '';
            editId.value      = '';
        }

        // Rellenar grilla de productos
        const products = StorageManager.getProducts();
        const tbody    = document.getElementById('snapshotProductsBody');
        tbody.innerHTML = products.map(prod => {
            const existing = existingItems[prod.id];
            const qty = existing && existing.qty !== '' && existing.qty !== null ? existing.qty : '';
            return `
                <tr class="text-xs snap-prod-row" data-prod-id="${prod.id}">
                    <td class="py-2.5 px-3 font-mono font-bold text-slate-500">${prod.code || ''}</td>
                    <td class="py-2.5 px-4 font-semibold text-slate-800">${prod.name}</td>
                    <td class="py-2.5 px-3 text-slate-500">${prod.category || '-'}</td>
                    <td class="py-2.5 px-2 text-center font-bold text-slate-600">${prod.unit || 'u.'}</td>
                    <td class="py-2.5 px-3 bg-violet-50/40">
                        <input type="number" step="any" min="0" value="${qty}" placeholder="—"
                            class="snap-qty-input w-32 bg-white border border-violet-200 rounded-lg px-2.5 py-1 text-right text-xs font-bold focus:ring-2 focus:ring-violet-500 focus:outline-none">
                    </td>
                </tr>
            `;
        }).join('');

        modal.classList.remove('hidden');
    },

    closeSnapshotModal() {
        document.getElementById('snapshotModal').classList.add('hidden');
    },

    saveSnapshot() {
        const name  = document.getElementById('snapName').value.trim();
        const date  = document.getElementById('snapDate').value;
        const notes = document.getElementById('snapNotes').value.trim();
        const editId = document.getElementById('snapEditId').value;

        if (!name)  { this.showToast('Por favor ingresá un nombre para el conteo.', 'warning'); return; }
        if (!date)  { this.showToast('Por favor seleccioná una fecha.', 'warning'); return; }

        const rows = document.querySelectorAll('.snap-prod-row');
        const items = {};
        rows.forEach(row => {
            const pId  = row.getAttribute('data-prod-id');
            const val  = row.querySelector('.snap-qty-input').value.trim();
            if (val !== '') {
                items[pId] = { qty: parseFloat(val) };
            }
        });

        const snapData = { name, date, notes, items };
        if (editId) snapData.id = editId;

        StorageManager.saveSnapshot(snapData);
        this.closeSnapshotModal();
        this.showToast(`Conteo "${name}" guardado con éxito.`, 'success');

        // Refrescar tabla si estamos en la pestaña snapshots
        if (this.inventorySubTab === 'snapshots') this.renderSnapshotsTable();

        // Refrescar selectores en CMV por período
        this.populateRangeSnapshots();
    },

    deleteSnapshot(snapId) {
        const snap = StorageManager.getSnapshotById(snapId);
        if (!snap) return;
        if (!confirm(`¿Eliminar el conteo "${snap.name}" del ${snap.date}? Esta acción no se puede deshacer.`)) return;
        StorageManager.deleteSnapshot(snapId);
        this.showToast('Conteo eliminado.', 'success');
        this.renderSnapshotsTable();
        this.populateRangeSnapshots();
    },

    // ==========================================
    // CMV TABS (MENSUAL / PERÍODO LIBRE)
    // ==========================================
    setCMVTab(tab) {
        const btnMensual  = document.getElementById('cmvtab-btn-mensual');
        const btnPeriodo  = document.getElementById('cmvtab-btn-periodo');
        const contMensual = document.getElementById('cmvtab-content-mensual');
        const contPeriodo = document.getElementById('cmvtab-content-periodo');

        const activeClass   = 'px-4 py-2 rounded-lg text-xs font-bold transition-all bg-white text-slate-800 shadow-sm';
        const inactiveClass = 'px-4 py-2 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-800';

        btnMensual.className  = tab === 'mensual' ? activeClass : inactiveClass;
        btnPeriodo.className  = tab === 'periodo' ? activeClass : inactiveClass;
        contMensual.classList.toggle('hidden', tab !== 'mensual');
        contPeriodo.classList.toggle('hidden', tab !== 'periodo');

        if (tab === 'periodo') {
            this.populateRangeSnapshots();
        }
    },

    populateRangeSnapshots() {
        const snapshots = StorageManager.getSnapshots();
        const sorted    = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));

        const buildOptions = (selId) => {
            const sel = document.getElementById(selId);
            if (!sel) return;
            const current = sel.value;
            sel.innerHTML = `<option value="">-- Seleccionar conteo --</option>`;
            sorted.forEach(snap => {
                const dateStr = snap.date ? new Date(snap.date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
                const opt = document.createElement('option');
                opt.value = snap.id;
                opt.textContent = `${dateStr} — ${snap.name}`;
                if (snap.id === current) opt.selected = true;
                sel.appendChild(opt);
            });
        };

        buildOptions('rangeSnapInitial');
        buildOptions('rangeSnapFinal');

        if (snapshots.length === 0) {
            const info = document.getElementById('rangeCMVInfo');
            if (info) info.textContent = 'Aún no hay conteos. Creá conteos desde Inventarios → Conteos con Fecha.';
        }
    },

    calculateRangeCMV() {
        const initId  = document.getElementById('rangeSnapInitial').value;
        const finalId = document.getElementById('rangeSnapFinal').value;
        const infoEl  = document.getElementById('rangeCMVInfo');
        const resultDiv = document.getElementById('rangeCMVResult');

        if (!initId || !finalId) {
            if (infoEl) infoEl.textContent = 'Seleccioná ambos conteos para calcular.';
            return;
        }
        if (initId === finalId) {
            if (infoEl) infoEl.textContent = '⚠️ El conteo inicial y final no pueden ser el mismo.';
            return;
        }

        const cmvData = CMVManager.calculateRangeCMV(initId, finalId);

        if (cmvData.error) {
            if (infoEl) infoEl.textContent = '⚠️ ' + cmvData.error;
            return;
        }

        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';
        const fmt  = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2 });

        // Label info
        if (infoEl) infoEl.textContent = '';
        const labelEl = document.getElementById('rangeCMVPeriodLabel');
        if (labelEl) {
            labelEl.innerHTML = `
                <strong>Período:</strong> ${cmvData.dateFrom} al ${cmvData.dateTo} &nbsp;|&nbsp;
                <strong>Conteo Inicial:</strong> ${cmvData.initialSnapshot.name} &nbsp;|&nbsp;
                <strong>Conteo Final:</strong> ${cmvData.finalSnapshot.name} &nbsp;|&nbsp;
                <strong>Facturas encerradas:</strong> ${cmvData.purchaseCount}
            `;
        }

        // KPIs
        document.getElementById('rangeSummaryInitial').textContent    = `${curr} ${fmt(cmvData.totalInitialValue)}`;
        document.getElementById('rangeSummaryPurchases').textContent  = `${curr} ${fmt(cmvData.totalPurchasesValue)}`;
        document.getElementById('rangeSummaryAvailable').textContent  = `${curr} ${fmt(cmvData.totalAvailableValue)}`;
        document.getElementById('rangeSummaryFinal').textContent      = `${curr} ${fmt(cmvData.totalFinalValue)}`;
        document.getElementById('rangeSummaryTotal').textContent      = `${curr} ${fmt(cmvData.totalCMV)}`;
        document.getElementById('rangePurchaseCount').textContent     = `${cmvData.purchaseCount} facturas incluidas`;

        // Tabla detallada
        const tbody = document.getElementById('rangeCMVTableBody');
        tbody.innerHTML = cmvData.items.map(it => {
            const finalCountDisplay = it.hasFinalCount
                ? `<span class="font-bold text-slate-800">${it.finalQty}</span>`
                : `<span class="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-semibold">Sin conteo</span>`;

            const usageClass    = it.isNegativeUsage ? 'text-red-600 font-black' : 'font-bold text-indigo-700';
            const warningBadge  = it.isNegativeUsage ? `<span title="El conteo final supera lo disponible" class="cursor-pointer ml-1 text-red-500"><i class="fa-solid fa-triangle-exclamation"></i></span>` : '';

            return `
                <tr class="table-row-hover text-xs">
                    <td class="py-2.5 px-3 font-semibold text-slate-800">
                        <div>${it.name}</div>
                        <span class="text-[10px] text-slate-400">${it.code} &bull; ${it.category}</span>
                    </td>
                    <td class="py-2.5 px-2 text-center text-slate-500 font-medium">${it.unit}</td>
                    <td class="py-2.5 px-3 text-right bg-slate-50">
                        <div class="font-medium text-slate-700">${it.initialQty}</div>
                        <span class="text-[10px] text-slate-400">@ ${curr}${it.initialUnitCost}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right bg-sky-50/50">
                        <div class="font-bold text-sky-800">${it.purchasedQty}</div>
                        <span class="text-[10px] text-slate-500">${curr}${fmt(it.purchasedCost)}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right font-medium text-slate-700">
                        <div>${it.availableQty}</div>
                        <span class="text-[10px] text-slate-400">${curr}${fmt(it.availableValue)}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right bg-amber-50/70 font-black text-amber-900">
                        ${curr} ${fmt(it.ppp)}
                    </td>
                    <td class="py-2.5 px-3 text-right bg-emerald-50/40">
                        ${finalCountDisplay}
                    </td>
                    <td class="py-2.5 px-3 text-right ${usageClass}">
                        ${it.hasFinalCount ? it.usageQty : '-'} ${it.unit} ${warningBadge}
                    </td>
                    <td class="py-2.5 px-3 text-right bg-emerald-100/50 font-black text-emerald-800">
                        ${it.hasFinalCount ? `${curr} ${fmt(it.cmvValue)}` : '-'}
                    </td>
                    <td class="py-2.5 px-3 text-right text-slate-600">
                        ${it.hasFinalCount ? `${curr} ${fmt(it.finalValue)}` : '-'}
                    </td>
                </tr>
            `;
        }).join('');

        // Mostrar resultado
        resultDiv.classList.remove('hidden');

        // Guardar IDs actuales para exportar
        this._lastRangeInitId  = initId;
        this._lastRangeFinalId = finalId;
    },

    exportRangeCMV() {
        if (!this._lastRangeInitId || !this._lastRangeFinalId) {
            this.showToast('Primero calculá el CMV por período antes de exportar.', 'warning');
            return;
        }
        CMVManager.exportRangeCMVToCSV(this._lastRangeInitId, this._lastRangeFinalId);
    },

    renderInventorySheets() {
        const period = this.activePeriod;
        const invInput = document.getElementById('invPeriodInput');
        if (invInput) invInput.value = period;

        const cmvData = CMVManager.calculatePeriodCMV(period);
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        // 1. Rellenar Planilla Inventario Inicial (II)
        const initialBody = document.getElementById('sheetInitialTableBody');
        let initialGrandTotal = 0;

        if (cmvData.items.length === 0) {
            initialBody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No hay insumos creados. Agrega insumos para iniciar.</td></tr>`;
        } else {
            initialBody.innerHTML = cmvData.items.map(it => {
                const subtotal = Number((it.initialQty * it.initialUnitCost).toFixed(2));
                initialGrandTotal += subtotal;

                return `
                    <tr class="table-row-hover text-xs sheet-init-row" data-prod-id="${it.productId}">
                        <td class="py-2.5 px-3 font-mono font-bold text-slate-600">${it.code}</td>
                        <td class="py-2.5 px-4 font-semibold text-slate-800">${it.name}</td>
                        <td class="py-2.5 px-3 text-slate-500">${it.category}</td>
                        <td class="py-2.5 px-2 text-center text-slate-600 font-bold">${it.unit}</td>
                        <td class="py-2.5 px-3 text-right bg-sky-50/40">
                            <input type="number" step="any" min="0" value="${it.initialQty || 0}" oninput="App.recalculateSheetInitialRow(this)" class="sheet-init-qty w-32 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-right text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none">
                        </td>
                        <td class="py-2.5 px-3 text-right bg-slate-50/50">
                            <input type="number" step="any" min="0" value="${it.initialUnitCost || 0}" oninput="App.recalculateSheetInitialRow(this)" class="sheet-init-cost w-32 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-right text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none">
                        </td>
                        <td class="py-2.5 px-4 text-right font-black text-slate-800 sheet-init-subtotal">
                            ${curr} ${subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </td>
                    </tr>
                `;
            }).join('');
        }
        document.getElementById('sheetInitialGrandTotal').textContent = `${curr} ${initialGrandTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        // 2. Rellenar Planilla Conteo Físico Final (IF)
        const finalBody = document.getElementById('sheetFinalTableBody');
        if (cmvData.items.length === 0) {
            finalBody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">No hay insumos creados. Agrega insumos para iniciar.</td></tr>`;
        } else {
            finalBody.innerHTML = cmvData.items.map(it => {
                const finalVal = it.hasFinalCount ? it.finalQty : '';
                const usage = it.hasFinalCount ? it.usageQty : (it.availableQty);
                const isNegative = it.hasFinalCount && it.usageQty < 0;

                let statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Pendiente</span>';
                if (it.hasFinalCount) {
                    if (isNegative) {
                        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800" title="El conteo final es mayor al disponible"><i class="fa-solid fa-triangle-exclamation"></i> Sobrante</span>';
                    } else {
                        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ Contado</span>';
                    }
                }

                return `
                    <tr class="table-row-hover text-xs sheet-final-row" data-prod-id="${it.productId}" data-available="${it.availableQty}">
                        <td class="py-2.5 px-3 font-mono font-bold text-slate-600">${it.code}</td>
                        <td class="py-2.5 px-4 font-semibold text-slate-800">${it.name}</td>
                        <td class="py-2.5 px-2 text-center text-slate-600 font-bold">${it.unit}</td>
                        <td class="py-2.5 px-3 text-right text-slate-500">${it.initialQty}</td>
                        <td class="py-2.5 px-3 text-right text-sky-700 font-bold">${it.purchasedQty}</td>
                        <td class="py-2.5 px-3 text-right font-black text-indigo-900 bg-indigo-50/50">${it.availableQty}</td>
                        <td class="py-2.5 px-3 text-right bg-emerald-50/50">
                            <input type="number" step="any" min="0" value="${finalVal}" placeholder="${it.availableQty}" oninput="App.recalculateSheetFinalRow(this)" class="sheet-final-input w-32 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-right text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                        </td>
                        <td class="py-2.5 px-3 text-right font-bold sheet-final-usage ${isNegative ? 'text-red-600' : 'text-indigo-700'}">
                            ${it.hasFinalCount ? it.usageQty : '-'} ${it.unit}
                        </td>
                        <td class="py-2.5 px-3 text-center sheet-final-status">
                            ${statusBadge}
                        </td>
                    </tr>
                `;
            }).join('');
        }
    },

    recalculateSheetInitialRow(inputEl) {
        const row = inputEl.closest('tr');
        const qty = parseFloat(row.querySelector('.sheet-init-qty').value) || 0;
        const cost = parseFloat(row.querySelector('.sheet-init-cost').value) || 0;
        const subtotal = Number((qty * cost).toFixed(2));

        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        row.querySelector('.sheet-init-subtotal').textContent = `${curr} ${subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        let grandTotal = 0;
        document.querySelectorAll('.sheet-init-row').forEach(r => {
            const q = parseFloat(r.querySelector('.sheet-init-qty').value) || 0;
            const c = parseFloat(r.querySelector('.sheet-init-cost').value) || 0;
            grandTotal += q * c;
        });
        document.getElementById('sheetInitialGrandTotal').textContent = `${curr} ${grandTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    },

    recalculateSheetFinalRow(inputEl) {
        const row = inputEl.closest('tr');
        const available = parseFloat(row.getAttribute('data-available')) || 0;
        const val = inputEl.value.trim();

        const usageEl = row.querySelector('.sheet-final-usage');
        const statusEl = row.querySelector('.sheet-final-status');

        if (val === '') {
            usageEl.textContent = '-';
            usageEl.className = 'py-2.5 px-3 text-right font-bold sheet-final-usage text-indigo-700';
            statusEl.innerHTML = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Pendiente</span>';
        } else {
            const count = parseFloat(val) || 0;
            const usage = Number((available - count).toFixed(3));
            const isNegative = usage < 0;

            usageEl.textContent = `${usage}`;
            if (isNegative) {
                usageEl.className = 'py-2.5 px-3 text-right font-black sheet-final-usage text-red-600';
                statusEl.innerHTML = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800"><i class="fa-solid fa-triangle-exclamation"></i> Sobrante</span>';
            } else {
                usageEl.className = 'py-2.5 px-3 text-right font-bold sheet-final-usage text-indigo-700';
                statusEl.innerHTML = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">✓ Contado</span>';
            }
        }
    },

    saveSheetInitialInventory() {
        const rows = document.querySelectorAll('.sheet-init-row');
        const initMap = {};

        rows.forEach(r => {
            const pId = r.getAttribute('data-prod-id');
            const qty = parseFloat(r.querySelector('.sheet-init-qty').value) || 0;
            const cost = parseFloat(r.querySelector('.sheet-init-cost').value) || 0;
            initMap[pId] = { qty, unitCost: cost };
        });

        CMVManager.saveInitialInventory(this.activePeriod, initMap);
        this.showToast('¡Inventario Inicial guardado con éxito!', 'success');
        this.renderInventorySheets();
    },

    saveSheetFinalInventory() {
        const rows = document.querySelectorAll('.sheet-final-row');
        const finalMap = {};

        rows.forEach(r => {
            const pId = r.getAttribute('data-prod-id');
            const val = r.querySelector('.sheet-final-input').value.trim();
            if (val !== '') {
                finalMap[pId] = { qty: parseFloat(val) || 0 };
            }
        });

        CMVManager.saveFinalInventory(this.activePeriod, finalMap);
        this.showToast('¡Conteo de Inventario Final guardado y CMV calculado!', 'success');
        if (StorageManager.hasPermission(this.activeUser, 'cmv')) {
            this.navigate('cmv');
        }
    },

    printBlankCountSheet() {
        const cmvData = CMVManager.calculatePeriodCMV(this.activePeriod);
        const settings = StorageManager.getSettings();

        const printWin = window.open('', '_blank');
        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Hoja de Conteo de Inventario Físico - ${this.activePeriod}</title>
                <style>
                    body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
                    h2, h3 { margin: 0 0 5px 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #999; padding: 8px; text-align: left; }
                    th { background: #f0f0f0; }
                </style>
            </head>
            <body>
                <h2>${settings.businessName}</h2>
                <h3>PLANILLA DE CONTEO FÍSICO DE INVENTARIO - PERÍODO ${this.activePeriod}</h3>
                <p>Fecha de toma física: _____ / _____ / 2026 &nbsp;&nbsp;&nbsp;&nbsp; Responsable: _____________________________</p>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 10%">Código</th>
                            <th style="width: 40%">Insumo / Mercadería</th>
                            <th style="width: 15%">Categoría</th>
                            <th style="width: 10%; text-align: center">Unidad</th>
                            <th style="width: 25%; text-align: center">CONTEO FÍSICO REAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cmvData.items.map(it => `
                            <tr>
                                <td>${it.code}</td>
                                <td><strong>${it.name}</strong></td>
                                <td>${it.category}</td>
                                <td style="text-align: center">${it.unit}</td>
                                <td></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `);
        printWin.document.close();
        printWin.focus();
        printWin.print();
    },

    // ==========================================
    // MÓDULO CONTROL CMV MENSUAL
    // ==========================================
    handlePeriodChange(newPeriod) {
        if (!newPeriod) return;
        this.activePeriod = newPeriod;
        const invInput = document.getElementById('invPeriodInput');
        if (invInput) invInput.value = newPeriod;
        const cmvInput = document.getElementById('cmvPeriodInput');
        if (cmvInput) cmvInput.value = newPeriod;

        if (this.currentView === 'inventarios') {
            this.renderInventorySheets();
        } else {
            this.renderCMVView();
        }
    },

    changePeriod(delta) {
        const [yearStr, monthStr] = this.activePeriod.split('-');
        let year = parseInt(yearStr, 10);
        let month = parseInt(monthStr, 10) + delta;

        if (month > 12) {
            month = 1;
            year += 1;
        } else if (month < 1) {
            month = 12;
            year -= 1;
        }

        this.activePeriod = `${year}-${String(month).padStart(2, '0')}`;
        this.handlePeriodChange(this.activePeriod);
    },

    renderCMVView() {
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';
        const cmvData = CMVManager.calculatePeriodCMV(this.activePeriod);

        const periodBadge = document.getElementById('cmvPeriodBadge');
        if (cmvData.status === 'closed') {
            periodBadge.textContent = 'Período Cerrado';
            periodBadge.className = 'text-xs px-2.5 py-1 rounded-full font-bold bg-slate-200 text-slate-700';
        } else {
            periodBadge.textContent = 'Período Abierto';
            periodBadge.className = 'text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800';
        }

        document.getElementById('cmvSummaryInitial').textContent = `${curr} ${cmvData.totalInitialValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('cmvSummaryPurchases').textContent = `${curr} ${cmvData.totalPurchasesValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('cmvSummaryAvailable').textContent = `${curr} ${cmvData.totalAvailableValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('cmvSummaryFinal').textContent = `${curr} ${cmvData.totalFinalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('cmvSummaryTotal').textContent = `${curr} ${cmvData.totalCMV.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        document.getElementById('eqII').textContent = `${curr} ${cmvData.totalInitialValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('eqC').textContent = `${curr} ${cmvData.totalPurchasesValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('eqIF').textContent = `${curr} ${cmvData.totalFinalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('eqCMV').textContent = `${curr} ${cmvData.totalCMV.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        const tbody = document.getElementById('cmvTableBody');
        if (cmvData.items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-slate-400">No hay insumos registrados para calcular el CMV.</td></tr>`;
            return;
        }

        tbody.innerHTML = cmvData.items.map(it => {
            const finalCountDisplay = it.hasFinalCount
                ? `<span class="font-bold text-slate-800">${it.finalQty}</span>`
                : `<span class="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-semibold">Sin conteo</span>`;

            const usageClass = it.isNegativeUsage ? 'text-red-600 font-black' : 'font-bold text-indigo-700';
            const warningBadge = it.isNegativeUsage ? `<span title="El conteo final supera lo disponible (posible compra omitida)" class="cursor-pointer ml-1 text-red-500"><i class="fa-solid fa-triangle-exclamation"></i></span>` : '';

            return `
                <tr class="table-row-hover text-xs">
                    <td class="py-2.5 px-3 font-semibold text-slate-800">
                        <div>${it.name}</div>
                        <span class="text-[10px] text-slate-400">${it.code} &bull; ${it.category}</span>
                    </td>
                    <td class="py-2.5 px-2 text-center text-slate-500 font-medium">${it.unit}</td>
                    <td class="py-2.5 px-3 text-right bg-slate-50">
                        <div class="font-medium text-slate-700">${it.initialQty}</div>
                        <span class="text-[10px] text-slate-400">@ ${curr}${it.initialUnitCost}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right bg-sky-50/50">
                        <div class="font-bold text-sky-800">${it.purchasedQty}</div>
                        <span class="text-[10px] text-slate-500">${curr}${it.purchasedCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right font-medium text-slate-700">
                        <div>${it.availableQty}</div>
                        <span class="text-[10px] text-slate-400">${curr}${it.availableValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right bg-amber-50/70 font-black text-amber-900">
                        ${curr} ${it.ppp.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </td>
                    <td class="py-2.5 px-3 text-right bg-emerald-50/40">
                        ${finalCountDisplay}
                    </td>
                    <td class="py-2.5 px-3 text-right ${usageClass}">
                        ${it.hasFinalCount ? it.usageQty : '-'} ${it.unit} ${warningBadge}
                    </td>
                    <td class="py-2.5 px-3 text-right bg-emerald-100/50 font-black text-emerald-800">
                        ${it.hasFinalCount ? `${curr} ${it.cmvValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td class="py-2.5 px-3 text-right text-slate-600">
                        ${it.hasFinalCount ? `${curr} ${it.finalValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                </tr>
            `;
        }).join('');
    },

    filterCMVTable() {
        const query = (document.getElementById('cmvSearchInput').value || '').toLowerCase();
        const rows = document.querySelectorAll('#cmvTableBody tr');
        rows.forEach(r => {
            const text = r.textContent.toLowerCase();
            r.style.display = text.includes(query) ? '' : 'none';
        });
    },

    rollForwardInitialInventory() {
        if (!confirm(`¿Deseas transferir el Inventario Final del mes anterior como Inventario Inicial para el período ${this.activePeriod}?`)) {
            return;
        }
        const res = CMVManager.rollForwardFromPreviousMonth(this.activePeriod);
        if (res.success) {
            this.showToast(res.message, 'success');
            if (this.currentView === 'inventarios') this.renderInventorySheets();
            if (this.currentView === 'cmv') this.renderCMVView();
        } else {
            this.showToast(res.message, 'warning');
        }
    },

    exportCMV() {
        CMVManager.exportCMVToCSV(this.activePeriod);
    },

    // ==========================================
    // MÓDULO PRODUCTOS / INSUMOS
    // ==========================================
    renderProductsTable() {
        const searchTerm = document.getElementById('prodSearchInput')?.value || '';
        const category = document.getElementById('prodCategoryFilter')?.value || '';
        const stockFilter = document.getElementById('prodStockFilter')?.value || 'all';
        const period = this.activePeriod || new Date().toISOString().slice(0, 7);

        const products = ProductManager.getFilteredProducts({ searchTerm, category, stockFilter, period });
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        const badgeEl = document.getElementById('prodPeriodBadge');
        if (badgeEl) {
            const [y, m] = period.split('-');
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, 1);
            const monthName = dateObj.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            badgeEl.textContent = `Mes: ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;
        }

        const tbody = document.getElementById('productsTableBody');
        if (products.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-slate-400">No se encontraron insumos con los filtros seleccionados.</td></tr>`;
            return;
        }

        tbody.innerHTML = products.map(p => {
            const stock = p.currentStock || 0;
            const initStock = p.initialMonthStock || 0;
            const purchStock = p.monthPurchasesQty || 0;
            const min = p.minStock || 0;
            const cost = p.costPrice || 0;
            const totalVal = Number((stock * cost).toFixed(2));

            let statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">Normal</span>';
            if (stock <= 0) {
                statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-red-100 text-red-800">Agotado</span>';
            } else if (stock <= min) {
                statusBadge = '<span class="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-100 text-amber-800">Bajo Stock</span>';
            }

            return `
                <tr class="table-row-hover text-xs">
                    <td class="py-2.5 px-3 font-mono font-bold text-slate-700">${p.code}</td>
                    <td class="py-2.5 px-4 font-semibold text-slate-800">${p.name}</td>
                    <td class="py-2.5 px-3 text-slate-500">${p.category}</td>
                    <td class="py-2.5 px-3 text-slate-600 font-medium">
                        ${p.supplierName ? `<span class="bg-slate-100 px-2 py-0.5 rounded text-slate-700 block truncate" title="Habitual: ${p.supplierName}">${p.supplierName}</span>` : '<span class="text-slate-400 italic">Sin asignar</span>'}
                        ${(() => {
                            const secNames = Array.isArray(p.secondarySupplierNames) && p.secondarySupplierNames.length > 0
                                ? p.secondarySupplierNames
                                : (p.secondarySupplierName ? [p.secondarySupplierName] : []);
                            return secNames.map(n => `<span class="text-[10px] text-slate-500 block truncate mt-0.5" title="Secundario: ${n}"><i class="fa-solid fa-angles-right text-[8px] text-slate-400"></i> ${n}</span>`).join('');
                        })()}
                    </td>
                    <td class="py-2.5 px-2 text-center text-slate-600 font-medium">${p.unit}</td>
                    <td class="py-2.5 px-3 text-right">
                        <div class="font-black ${stock <= min ? 'text-amber-600' : 'text-slate-800'} text-xs">${stock}</div>
                        <span class="text-[10px] text-slate-400 font-normal block leading-tight" title="Stock Inicial del mes: ${initStock} + Compras acumuladas del mes: ${purchStock}">
                            II: ${initStock} + C: ${purchStock}
                        </span>
                    </td>
                    <td class="py-2.5 px-3 text-right text-slate-400">${min}</td>
                    <td class="py-2.5 px-3 text-right text-slate-600">${curr} ${cost.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                    <td class="py-2.5 px-3 text-right font-bold text-slate-800">${curr} ${totalVal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                    <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                    <td class="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button onclick="App.openQuickAdjustModal('${p.id}')" class="p-1.5 text-slate-400 hover:text-sky-600 rounded" title="Ajuste rápido de stock">
                            <i class="fa-solid fa-arrows-up-down"></i>
                        </button>
                        <button onclick="App.openProductModal('${p.id}')" class="p-1.5 text-slate-400 hover:text-indigo-600 rounded" title="Editar insumo">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="App.deleteProduct('${p.id}')" class="p-1.5 text-slate-400 hover:text-red-600 rounded" title="Eliminar insumo">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // ==========================================
    // MULTI-SELECT PROVEEDORES SECUNDARIOS
    // ==========================================

    /** Abre/cierra el menú desplegable de secundarios */
    toggleSecondarySuppliersDropdown() {
        const menu = document.getElementById('secSuppliersMenu');
        const chevron = document.getElementById('secSuppliersChevron');
        if (!menu) return;
        const isHidden = menu.classList.toggle('hidden');
        if (chevron) chevron.classList.toggle('rotate-180', !isHidden);
    },

    /** Renderiza los checkboxes en el menú, excluyendo al proveedor habitual */
    renderSecondarySuppliersChecklist(excludeId = '') {
        const list = document.getElementById('secSuppliersCheckList');
        if (!list) return;
        const suppliers = StorageManager.getSuppliers();
        const available = suppliers.filter(s => s.id !== excludeId);

        if (available.length === 0) {
            list.innerHTML = '<p class="text-[11px] text-slate-400 px-1 py-2">No hay proveedores disponibles.</p>';
            return;
        }

        list.innerHTML = available.map(s => {
            const checked = this._selectedSecondarySupplierIds.includes(s.id) ? 'checked' : '';
            return `<label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-teal-50 cursor-pointer text-xs text-slate-700">
                <input type="checkbox" class="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    value="${s.id}" ${checked}
                    onchange="App.toggleSecondarySupplier('${s.id}', this.checked)">
                <span>${s.name}</span>
            </label>`;
        }).join('');
    },

    /** Agrega o quita un proveedor del array de seleccionados */
    toggleSecondarySupplier(supId, checked) {
        if (checked) {
            if (!this._selectedSecondarySupplierIds.includes(supId)) {
                this._selectedSecondarySupplierIds.push(supId);
            }
        } else {
            this._selectedSecondarySupplierIds = this._selectedSecondarySupplierIds.filter(id => id !== supId);
        }
        this.renderSecondarySupplierChips();
    },

    /** Elimina un proveedor secundario (desde el chip) */
    removeSecondarySupplier(supId) {
        this._selectedSecondarySupplierIds = this._selectedSecondarySupplierIds.filter(id => id !== supId);
        this.renderSecondarySupplierChips();
        this.renderSecondarySuppliersChecklist(document.getElementById('prodFormSupplierSelect')?.value || '');
    },

    /** Limpia todos los proveedores secundarios seleccionados */
    clearSecondarySuppliers() {
        this._selectedSecondarySupplierIds = [];
        this.renderSecondarySupplierChips();
        this.renderSecondarySuppliersChecklist(document.getElementById('prodFormSupplierSelect')?.value || '');
    },

    /** Renderiza los chips/badges de seleccionados y actualiza el botón y badge contador */
    renderSecondarySupplierChips() {
        const chipsContainer = document.getElementById('secSuppliersSelectedChips');
        const btnLabel = document.getElementById('secSuppliersBtnLabel');
        const countBadge = document.getElementById('prodFormSecondaryCountBadge');
        if (!chipsContainer) return;

        const count = this._selectedSecondarySupplierIds.length;
        const suppliers = StorageManager.getSuppliers();

        // Chips
        chipsContainer.innerHTML = this._selectedSecondarySupplierIds.map(id => {
            const sup = suppliers.find(s => s.id === id);
            if (!sup) return '';
            return `<span class="inline-flex items-center gap-1 bg-teal-100 text-teal-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                ${sup.name}
                <button type="button" onclick="App.removeSecondarySupplier('${id}')" class="text-teal-600 hover:text-teal-900 font-bold leading-none">&times;</button>
            </span>`;
        }).join('');

        // Botón label
        if (btnLabel) {
            btnLabel.textContent = count === 0 ? 'Seleccionar proveedores secundarios...' : `${count} proveedor${count > 1 ? 'es' : ''} seleccionado${count > 1 ? 's' : ''}`;
        }

        // Badge contador
        if (countBadge) {
            if (count > 0) {
                countBadge.textContent = `${count} seleccionado${count > 1 ? 's' : ''}`;
                countBadge.classList.remove('hidden');
            } else {
                countBadge.classList.add('hidden');
            }
        }
    },

    /** Llamado cuando cambia el proveedor habitual: re-renderiza lista excluyéndolo */
    handleProductHabitualSupplierChange(supId) {
        // Si el habitual estaba en secundarios, lo quitamos
        if (supId && this._selectedSecondarySupplierIds.includes(supId)) {
            this._selectedSecondarySupplierIds = this._selectedSecondarySupplierIds.filter(id => id !== supId);
            this.renderSecondarySupplierChips();
        }
        this.renderSecondarySuppliersChecklist(supId);
    },

    openProductModal(productId = null, fromPurchase = false) {
        this.pendingProductForPurchase = fromPurchase;
        const form = document.getElementById('productForm');
        form.reset();

        this.populateDropdowns();

        if (productId) {
            const p = StorageManager.getProductById(productId);
            if (p) {
                document.getElementById('productModalTitle').textContent = 'Editar Insumo / Mercadería';
                document.getElementById('prodFormId').value = p.id;
                document.getElementById('prodFormCode').value = p.code || '';
                document.getElementById('prodFormName').value = p.name;
                document.getElementById('prodFormCategorySelect').value = p.category || 'Materia Prima / Insumos';
                document.getElementById('prodFormSupplierSelect').value = p.supplierId || '';
                document.getElementById('prodFormUnit').value = p.unit || 'kg';
                document.getElementById('prodFormStock').value = p.currentStock || 0;
                document.getElementById('prodFormMinStock').value = p.minStock || 0;
                document.getElementById('prodFormCost').value = p.costPrice || 0;
                document.getElementById('prodFormSale').value = p.salePrice || 0;

                // Cargar proveedores secundarios (retrocompat: puede ser array o string legacy)
                if (Array.isArray(p.secondarySupplierIds) && p.secondarySupplierIds.length > 0) {
                    this._selectedSecondarySupplierIds = [...p.secondarySupplierIds];
                } else if (p.secondarySupplierId) {
                    this._selectedSecondarySupplierIds = [p.secondarySupplierId];
                } else {
                    this._selectedSecondarySupplierIds = [];
                }
            }
        } else {
            document.getElementById('productModalTitle').textContent = 'Nuevo Insumo / Mercadería';
            document.getElementById('prodFormId').value = '';
            document.getElementById('prodFormStock').value = '0';
            document.getElementById('prodFormMinStock').value = '10';
            document.getElementById('prodFormSupplierSelect').value = '';
            this._selectedSecondarySupplierIds = [];

            if (fromPurchase) {
                const activePurchaseSupId = document.getElementById('purchaseSupplierSelect')?.value;
                if (activePurchaseSupId) {
                    document.getElementById('prodFormSupplierSelect').value = activePurchaseSupId;
                }
            }
        }

        // Renderizar chips y checklist con el habitual actual excluido
        const currentHabitualId = document.getElementById('prodFormSupplierSelect')?.value || '';
        this.renderSecondarySuppliersChecklist(currentHabitualId);
        this.renderSecondarySupplierChips();

        document.getElementById('productModal').classList.remove('hidden');
    },

    closeProductModal() {
        document.getElementById('productModal').classList.add('hidden');
    },

    handleSaveProduct(event) {
        event.preventDefault();
        try {
            const supSelect = document.getElementById('prodFormSupplierSelect');
            const supplierId = supSelect.value;
            const supplierName = supplierId ? (supSelect.options[supSelect.selectedIndex]?.text || '') : '';

            // Multi-select secundarios: usar el array en memoria
            const allSuppliers = StorageManager.getSuppliers();
            const secondarySupplierIds = [...this._selectedSecondarySupplierIds];
            const secondarySupplierNames = secondarySupplierIds.map(id => {
                const s = allSuppliers.find(x => x.id === id);
                return s ? s.name : '';
            }).filter(Boolean);

            const formData = {
                id: document.getElementById('prodFormId').value || undefined,
                code: document.getElementById('prodFormCode').value,
                name: document.getElementById('prodFormName').value,
                category: document.getElementById('prodFormCategorySelect').value,
                supplierId: supplierId,
                supplierName: supplierName,
                secondarySupplierIds: secondarySupplierIds,
                secondarySupplierNames: secondarySupplierNames,
                unit: document.getElementById('prodFormUnit').value,
                currentStock: document.getElementById('prodFormStock').value,
                minStock: document.getElementById('prodFormMinStock').value,
                costPrice: document.getElementById('prodFormCost').value,
                salePrice: document.getElementById('prodFormSale').value
            };

            const updatedProducts = ProductManager.saveProductFromForm(formData);
            const savedItem = updatedProducts.find(p => p.name === formData.name);

            this.closeProductModal();
            this.showToast(`Insumo "${formData.name}" guardado exitosamente.`, 'success');

            if (this.pendingProductForPurchase && savedItem) {
                const activeSupId = document.getElementById('purchaseSupplierSelect')?.value || '';
                this.refreshPurchaseRowsProductDropdowns(activeSupId);
                this.addPurchaseRow(savedItem.id, 1, savedItem.costPrice);
                this.pendingProductForPurchase = false;
            } else {
                this.renderProductsTable();
                if (this.currentView === 'dashboard') this.renderDashboard();
            }
        } catch (e) {
            console.error(e);
            this.showToast(e.message || 'Error al guardar insumo', 'error');
        }
    },

    deleteProduct(id) {
        const prod = StorageManager.getProductById(id);
        if (!confirm(`¿Estás seguro de eliminar "${prod?.name || 'este producto'}"? Esta acción no se puede deshacer.`)) {
            return;
        }
        StorageManager.deleteProduct(id);
        this.showToast('Insumo eliminado del catálogo.', 'info');
        this.renderProductsTable();
    },

    openQuickAdjustModal(productId) {
        const p = StorageManager.getProductById(productId);
        if (!p) return;

        document.getElementById('adjustProdId').value = p.id;
        document.getElementById('adjustProdName').textContent = p.name;
        document.getElementById('adjustProdCurrentStock').textContent = `${p.currentStock || 0} ${p.unit}`;
        document.getElementById('adjustQty').value = '';
        document.getElementById('adjustReason').value = '';

        document.getElementById('quickAdjustModal').classList.remove('hidden');
    },

    closeQuickAdjustModal() {
        document.getElementById('quickAdjustModal').classList.add('hidden');
    },

    handleQuickAdjust(event) {
        event.preventDefault();
        try {
            const productId = document.getElementById('adjustProdId').value;
            const type = document.getElementById('adjustType').value;
            const qty = document.getElementById('adjustQty').value;
            const reason = document.getElementById('adjustReason').value || 'Ajuste manual rápido';

            const updated = ProductManager.quickStockAdjust(productId, qty, type, reason);
            this.closeQuickAdjustModal();
            this.showToast(`Stock de "${updated.name}" actualizado a ${updated.currentStock} ${updated.unit}`, 'success');

            if (this.currentView === 'productos') this.renderProductsTable();
            if (this.currentView === 'dashboard') this.renderDashboard();
        } catch (e) {
            console.error(e);
            this.showToast(e.message || 'Error al ajustar stock', 'error');
        }
    },

    // ==========================================
    // MÓDULO HISTORIAL DE FACTURAS Y ESTADO DE PAGOS
    // ==========================================
    renderPurchasesTable() {
        const month = document.getElementById('purchasesMonthFilter')?.value || '';
        const paymentStatus = document.getElementById('purchasesPaymentFilter')?.value || 'all';
        const searchTerm = document.getElementById('purchasesSearchInput')?.value || '';

        const purchases = PurchaseManager.getFilteredPurchases({ month, paymentStatus, searchTerm });
        const allMonthPurchases = StorageManager.getPurchases().filter(p => !month || (p.date && p.date.startsWith(month)));

        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        let totalAll = 0;
        let totalPaid = 0;
        let totalPending = 0;

        allMonthPurchases.forEach(p => {
            const tot = Number(p.totalInvoice || p.totalCost || 0);
            totalAll += tot;
            if (p.paymentStatus === 'pendiente') {
                totalPending += tot;
            } else {
                totalPaid += tot;
            }
        });

        document.getElementById('histTotalPurchases').textContent = `${curr} ${totalAll.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('histTotalPaid').textContent = `${curr} ${totalPaid.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        document.getElementById('histTotalPending').textContent = `${curr} ${totalPending.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        const tbody = document.getElementById('purchasesHistoryTableBody');
        if (purchases.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">No hay facturas con los filtros seleccionados.</td></tr>`;
            return;
        }

        tbody.innerHTML = purchases.map(p => {
            const net = p.netSubtotal || p.totalCost;
            const iva = p.ivaAmount || 0;
            const total = p.totalInvoice || p.totalCost;
            const isPaid = (p.paymentStatus || 'pagada') === 'pagada';

            const statusBadge = isPaid
                ? '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">✓ Pagada</span>'
                : '<span class="px-2 py-0.5 rounded font-bold text-[10px] bg-red-100 text-red-700">⏳ A Pagar</span>';

            const paymentInfo = isPaid
                ? `<div class="font-medium text-slate-700">${p.paymentDate || p.date}</div><span class="text-[10px] text-slate-400">${p.paymentMethod || 'Efectivo'}</span>`
                : `<span class="text-amber-600 text-[11px] font-semibold">${p.paymentMethod || 'Cta. Cte.'}</span>`;

            return `
                <tr class="table-row-hover text-xs">
                    <td class="py-2.5 px-3 text-slate-700 font-medium">${p.date}</td>
                    <td class="py-2.5 px-3 font-mono font-bold text-slate-800">${p.invoiceNumber || 'S/N'}</td>
                    <td class="py-2.5 px-4 font-semibold text-slate-800">${p.supplier}</td>
                    <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                    <td class="py-2.5 px-3">${paymentInfo}</td>
                    <td class="py-2.5 px-3 text-right font-medium text-slate-700">${curr} ${net.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                    <td class="py-2.5 px-3 text-right text-slate-600">${curr} ${iva.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                    <td class="py-2.5 px-4 text-right font-black text-slate-900 text-sm">${curr} ${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                    <td class="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button onclick="App.openPaymentModal('${p.id}')" class="p-1.5 text-slate-500 hover:text-emerald-600 rounded" title="Editar estado de pago / Cancelar deuda">
                            <i class="fa-solid fa-money-bill-transfer"></i>
                        </button>
                        <button onclick="App.editPurchase('${p.id}')" class="p-1.5 text-slate-500 hover:text-amber-600 rounded" title="Editar factura completa">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="App.viewPurchaseDetail('${p.id}')" class="p-1.5 text-slate-500 hover:text-sky-600 rounded" title="Ver liquidación impositiva">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button onclick="App.deletePurchase('${p.id}')" class="p-1.5 text-slate-400 hover:text-red-600 rounded" title="Eliminar factura">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    viewPurchaseDetail(purchaseId) {
        this._currentDetailPurchaseId = purchaseId;
        const purchase = StorageManager.getPurchases().find(p => p.id === purchaseId);
        if (!purchase) return;

        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        const net = purchase.netSubtotal || purchase.totalCost;
        const iva = purchase.ivaAmount || 0;
        const iibb = purchase.iibbAmount || 0;
        const ivaPercep = purchase.ivaPerception || 0;
        const other = purchase.otherTaxes || 0;
        const total = purchase.totalInvoice || purchase.totalCost;
        const isPaid = (purchase.paymentStatus || 'pagada') === 'pagada';

        const content = document.getElementById('purchaseDetailContent');
        content.innerHTML = `
            <div class="border-b border-slate-200 pb-4 flex justify-between items-start">
                <div>
                    <h2 class="text-base font-black text-slate-800">${settings.businessName}</h2>
                    <p class="text-xs text-slate-500">Comprobante y Liquidación Impositiva de Factura</p>
                </div>
                <div class="text-right font-mono">
                    <span class="text-xs text-slate-400 block">Nº Factura:</span>
                    <span class="text-sm font-black text-slate-800">${purchase.invoiceNumber || 'S/N'}</span>
                </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                    <span class="text-slate-400 block">Proveedor:</span>
                    <strong class="text-slate-800">${purchase.supplier}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block">Fecha de Factura:</span>
                    <strong class="text-slate-800">${purchase.date}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block">Estado de Pago:</span>
                    <strong class="${isPaid ? 'text-emerald-700' : 'text-red-600'}">${isPaid ? '✓ Pagada' : '⏳ Pendiente (A Pagar)'}</strong>
                </div>
                <div>
                    <span class="text-slate-400 block">Forma / Fecha Pago:</span>
                    <strong class="text-slate-800">${purchase.paymentMethod} ${purchase.paymentDate ? `(${purchase.paymentDate})` : ''}</strong>
                </div>
            </div>

            <div>
                <h4 class="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Desglose de Mercadería (Neto)</h4>
                <table class="w-full text-left text-xs border-collapse">
                    <thead class="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                            <th class="py-2 px-3">Insumo</th>
                            <th class="py-2 px-2 text-center">Unidad</th>
                            <th class="py-2 px-3 text-right">Cantidad</th>
                            <th class="py-2 px-3 text-right">Costo Neto ($)</th>
                            <th class="py-2 px-3 text-right">Subtotal Neto ($)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${(purchase.items || []).map(it => `
                            <tr>
                                <td class="py-2 px-3 font-medium text-slate-800">${it.productName}</td>
                                <td class="py-2 px-2 text-center text-slate-500">${it.unit}</td>
                                <td class="py-2 px-3 text-right font-bold text-slate-800">${it.quantity}</td>
                                <td class="py-2 px-3 text-right text-slate-600">${curr} ${Number(it.unitCost).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                                <td class="py-2 px-3 text-right font-black text-slate-800">${curr} ${Number(it.subtotal).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h5 class="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">Liquidación Impositiva</h5>
                <div class="flex justify-between text-xs text-slate-600">
                    <span>Subtotal Neto Gravado:</span>
                    <strong class="font-mono">${curr} ${net.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div class="flex justify-between text-xs text-slate-600">
                    <span>IVA (${purchase.ivaRate || 0}%):</span>
                    <strong class="font-mono">${curr} ${iva.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div class="flex justify-between text-xs text-slate-600">
                    <span>Percepción Ingresos Brutos (IIBB):</span>
                    <strong class="font-mono">${curr} ${iibb.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div class="flex justify-between text-xs text-slate-600">
                    <span>Percepción de IVA:</span>
                    <strong class="font-mono">${curr} ${ivaPercep.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div class="flex justify-between text-xs text-slate-600">
                    <span>Otros Impuestos y Tributos:</span>
                    <strong class="font-mono">${curr} ${other.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div class="flex justify-between text-sm font-bold text-slate-800 pt-2 border-t border-slate-200">
                    <span>TOTAL FACTURA:</span>
                    <strong class="font-mono text-base text-emerald-700">${curr} ${total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</strong>
                </div>
            </div>
        `;

        document.getElementById('purchaseDetailModal').classList.remove('hidden');
    },

    closePurchaseDetailModal() {
        document.getElementById('purchaseDetailModal').classList.add('hidden');
    },

    deletePurchase(id) {
        if (!confirm('¿Deseas anular y eliminar esta factura? El stock de los productos comprados se revertirá automáticamente.')) {
            return;
        }
        StorageManager.deletePurchase(id, true);
        this.showToast('Factura eliminada y stock revertido.', 'info');
        this.renderPurchasesTable();
    },

    exportPurchases() {
        const month = document.getElementById('purchasesMonthFilter')?.value || '';
        const status = document.getElementById('purchasesPaymentFilter')?.value || 'all';
        PurchaseManager.exportPurchasesToCSV(month, status);
    },

    // ==========================================
    // MÓDULO EVOLUCIÓN DE COMPRAS Y PRECIOS
    // ==========================================
    switchEvolucionTab(tab) {
        this.evolucionTab = tab;
        const btnProv = document.getElementById('tabEvolProveedor');
        const btnIns = document.getElementById('tabEvolInsumo');
        const subProv = document.getElementById('subtabEvolProveedor');
        const subIns = document.getElementById('subtabEvolInsumo');

        if (tab === 'proveedor') {
            if (btnProv) btnProv.className = 'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all bg-white text-slate-800 shadow-sm';
            if (btnIns) btnIns.className = 'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900';
            if (subProv) subProv.classList.remove('hidden');
            if (subIns) subIns.classList.add('hidden');
            this.renderEvolucionProveedor();
        } else {
            if (btnIns) btnIns.className = 'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all bg-white text-slate-800 shadow-sm';
            if (btnProv) btnProv.className = 'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900';
            if (subIns) subIns.classList.remove('hidden');
            if (subProv) subProv.classList.add('hidden');
            this.renderEvolucionInsumo();
        }
    },

    renderEvolucionComprasView(params = {}) {
        this.populateEvolucionDropdowns();
        if (params.tab) {
            this.switchEvolucionTab(params.tab);
        } else {
            this.switchEvolucionTab(this.evolucionTab || 'proveedor');
        }
    },

    populateEvolucionDropdowns() {
        const suppliers = StorageManager.getSuppliers();
        const products = StorageManager.getProducts();

        // 1. Selector de Proveedor en Pestaña Proveedor
        const supSelect = document.getElementById('evolSupplierSelect');
        if (supSelect) {
            const curVal = supSelect.value;
            supSelect.innerHTML = '<option value="">-- Todos los Proveedores --</option>' +
                suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            supSelect.value = curVal;
        }

        // 2. Selector de Insumo en Pestaña Insumos
        const prodSelect = document.getElementById('evolProductSelect');
        if (prodSelect) {
            const curVal = prodSelect.value;
            prodSelect.innerHTML = products.map(p => `<option value="${p.id}">${p.name} (${p.code})</option>`).join('');
            if (curVal && products.some(p => p.id === curVal)) {
                prodSelect.value = curVal;
            } else if (products.length > 0) {
                prodSelect.value = products[0].id;
            }
        }

        // 3. Filtro opcional de Proveedor en Pestaña Insumos
        const prodSupFilter = document.getElementById('evolProdSupplierFilter');
        if (prodSupFilter) {
            const curVal = prodSupFilter.value;
            prodSupFilter.innerHTML = '<option value="">-- Todos los Proveedores --</option>' +
                suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            prodSupFilter.value = curVal;
        }
    },

    renderEvolucionProveedor() {
        const supSelect = document.getElementById('evolSupplierSelect');
        const selectedSupId = supSelect?.value || '';
        const dateFrom = document.getElementById('evolDateFrom')?.value || '';
        const dateTo = document.getElementById('evolDateTo')?.value || '';

        let purchases = StorageManager.getPurchases();
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        // Filtrar por proveedor
        if (selectedSupId) {
            const sup = StorageManager.getSupplierById(selectedSupId);
            const supName = sup ? sup.name.toLowerCase() : '';
            purchases = purchases.filter(p => (p.supplierId && p.supplierId === selectedSupId) || (p.supplier && p.supplier.toLowerCase() === supName));
        }

        // Filtrar por rango de fechas
        if (dateFrom) {
            purchases = purchases.filter(p => p.date >= dateFrom);
        }
        if (dateTo) {
            purchases = purchases.filter(p => p.date <= dateTo);
        }

        // Ordenar por fecha descendente para la tabla
        purchases.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

        // Calcular KPIs
        let totalPurchased = 0;
        let invoiceCount = purchases.length;
        const uniqueItemsSet = new Set();

        purchases.forEach(p => {
            totalPurchased += (p.totalInvoice || p.totalCost || p.netSubtotal || 0);
            (p.items || []).forEach(it => {
                if (it.productId) uniqueItemsSet.add(it.productId);
                else if (it.productName) uniqueItemsSet.add(it.productName);
            });
        });

        const avgPurchase = invoiceCount > 0 ? (totalPurchased / invoiceCount) : 0;

        const kpiTotalEl = document.getElementById('kpiEvolSupTotal');
        if (kpiTotalEl) kpiTotalEl.textContent = `${curr} ${totalPurchased.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        const kpiCountEl = document.getElementById('kpiEvolSupCount');
        if (kpiCountEl) kpiCountEl.textContent = invoiceCount;
        const kpiAvgEl = document.getElementById('kpiEvolSupAverage');
        if (kpiAvgEl) kpiAvgEl.textContent = `${curr} ${avgPurchase.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        const kpiUniqueEl = document.getElementById('kpiEvolSupUniqueItems');
        if (kpiUniqueEl) kpiUniqueEl.textContent = uniqueItemsSet.size;

        // Renderizar tabla
        const tbody = document.getElementById('evolSupplierTableBody');
        const rowCountEl = document.getElementById('evolSupplierRowCount');
        if (rowCountEl) rowCountEl.textContent = `${invoiceCount} facturas encontradas`;

        if (!tbody) return;

        if (purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="py-8 text-center text-slate-400">No se registran compras para el proveedor o período seleccionado.</td></tr>';
        } else {
            tbody.innerHTML = purchases.map(p => {
                const itemsSummary = (p.items || []).map(it => `${it.productName} (${it.quantity} ${it.unit || 'u.'})`).join(', ');
                const isPaid = (p.paymentStatus || 'pagada') === 'pagada';
                const statusBadge = isPaid
                    ? '<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Pagada</span>'
                    : '<span class="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">⏳ Pendiente</span>';

                let rowDiscountTotal = 0;
                (p.items || []).forEach(it => {
                    rowDiscountTotal += (it.discountAmount || 0);
                });

                return `
                    <tr class="table-row-hover text-xs">
                        <td class="py-2.5 px-3 font-mono font-medium text-slate-700">${p.date || '-'}</td>
                        <td class="py-2.5 px-3 font-semibold text-slate-800">${p.invoiceNumber || 'S/N'}</td>
                        <td class="py-2.5 px-4 font-bold text-slate-700">${p.supplier || '-'}</td>
                        <td class="py-2.5 px-4 text-slate-500 max-w-xs truncate" title="${itemsSummary}">${itemsSummary || '-'}</td>
                        <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                        <td class="py-2.5 px-3 text-right font-medium text-slate-600">${curr} ${(p.netSubtotal || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td class="py-2.5 px-3 text-right text-amber-600 font-semibold">${rowDiscountTotal > 0 ? `- ${curr} ${rowDiscountTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '-'}</td>
                        <td class="py-2.5 px-4 text-right font-black text-slate-900">${curr} ${(p.totalInvoice || p.totalCost || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                        <td class="py-2.5 px-2 text-center">
                            <button onclick="App.openPaymentModal('${p.id}')" class="text-slate-400 hover:text-sky-600 p-1" title="Ver comprobante y pago">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Renderizar Gráfico de Evolución Mensual
        this.renderSupplierPurchasesChart(purchases);
    },

    renderSupplierPurchasesChart(purchases) {
        const canvas = document.getElementById('supplierPurchasesChart');
        if (!canvas) return;

        // Agrupar por mes (YYYY-MM) cronológicamente
        const monthlyTotals = {};
        purchases.forEach(p => {
            if (!p.date) return;
            const month = p.date.substring(0, 7);
            const total = (p.totalInvoice || p.totalCost || p.netSubtotal || 0);
            monthlyTotals[month] = (monthlyTotals[month] || 0) + total;
        });

        const sortedMonths = Object.keys(monthlyTotals).sort();
        const labels = sortedMonths.map(m => {
            const [y, mm] = m.split('-');
            const d = new Date(parseInt(y), parseInt(mm) - 1, 1);
            return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        });
        const dataValues = sortedMonths.map(m => Number(monthlyTotals[m].toFixed(2)));

        if (this.supplierPurchasesChart) {
            this.supplierPurchasesChart.destroy();
        }

        if (typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        this.supplierPurchasesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['Sin datos'],
                datasets: [{
                    label: 'Total Facturado ($)',
                    data: dataValues.length > 0 ? dataValues : [0],
                    backgroundColor: 'rgba(13, 148, 136, 0.75)',
                    borderColor: 'rgb(13, 148, 136)',
                    borderWidth: 1.5,
                    borderRadius: 6,
                    maxBarThickness: 45
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ` $ ${ctx.parsed.y.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(val) {
                                return '$ ' + val.toLocaleString('es-ES');
                            },
                            font: { size: 10 }
                        },
                        grid: { color: 'rgba(226, 232, 240, 0.6)' }
                    },
                    x: {
                        ticks: { font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            }
        });
    },

    renderEvolucionInsumo() {
        const prodSelect = document.getElementById('evolProductSelect');
        const selectedProdId = prodSelect?.value || '';
        const supFilter = document.getElementById('evolProdSupplierFilter')?.value || '';
        const dateFrom = document.getElementById('evolProdDateFrom')?.value || '';

        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        if (!selectedProdId) {
            return;
        }

        const product = StorageManager.getProductById(selectedProdId);
        const prodLabel = document.getElementById('evolProdChartLabel');
        if (prodLabel && product) {
            prodLabel.textContent = `${product.name} (Unidad: ${product.unit || 'u.'})`;
        }

        // Buscar todas las compras que contengan este insumo
        const purchases = StorageManager.getPurchases();
        const itemPurchases = [];

        purchases.forEach(p => {
            if (dateFrom && p.date < dateFrom) return;
            if (supFilter) {
                const sup = StorageManager.getSupplierById(supFilter);
                const supName = sup ? sup.name.toLowerCase() : '';
                if (p.supplierId !== supFilter && (!p.supplier || p.supplier.toLowerCase() !== supName)) {
                    return;
                }
            }

            (p.items || []).forEach(it => {
                if (it.productId === selectedProdId || (product && it.productName && it.productName.toLowerCase() === product.name.toLowerCase())) {
                    const grossCost = it.unitCost || 0;
                    const subtotal = it.subtotal || (it.quantity * grossCost);
                    // Costo unitario neto real pagado con descuento
                    const netUnitCost = it.quantity > 0 ? Number((subtotal / it.quantity).toFixed(2)) : grossCost;

                    itemPurchases.push({
                        date: p.date || p.createdAt?.slice(0, 10) || '',
                        invoiceNumber: p.invoiceNumber || 'S/N',
                        supplier: p.supplier || 'Proveedor',
                        supplierId: p.supplierId || '',
                        quantity: it.quantity || 0,
                        unit: it.unit || product?.unit || 'u.',
                        grossCost: grossCost,
                        discountPercent: it.discountPercent || 0,
                        discountAmount: it.discountAmount || 0,
                        netUnitCost: netUnitCost,
                        subtotal: subtotal
                    });
                }
            });
        });

        // Ordenar cronológicamente (más antiguo primero) para calcular variaciones y gráfico
        itemPurchases.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calcular variación % respecto a la compra anterior
        for (let i = 0; i < itemPurchases.length; i++) {
            if (i === 0) {
                itemPurchases[i].varPercent = 0;
                itemPurchases[i].hasPrevious = false;
            } else {
                const prevCost = itemPurchases[i - 1].netUnitCost;
                const curCost = itemPurchases[i].netUnitCost;
                if (prevCost > 0) {
                    itemPurchases[i].varPercent = Number((((curCost - prevCost) / prevCost) * 100).toFixed(1));
                } else {
                    itemPurchases[i].varPercent = 0;
                }
                itemPurchases[i].hasPrevious = true;
            }
        }

        // Calcular KPIs
        let lastPrice = product?.costPrice || 0;
        let lastDate = 'Catálogo actual';
        let minPrice = lastPrice;
        let maxPrice = lastPrice;
        let totalVariation = 0;

        if (itemPurchases.length > 0) {
            const lastItem = itemPurchases[itemPurchases.length - 1];
            lastPrice = lastItem.netUnitCost;
            lastDate = lastItem.date;

            const allPrices = itemPurchases.map(it => it.netUnitCost).filter(pr => pr > 0);
            if (allPrices.length > 0) {
                minPrice = Math.min(...allPrices);
                maxPrice = Math.max(...allPrices);
                const firstPrice = allPrices[0];
                if (firstPrice > 0) {
                    totalVariation = Number((((lastPrice - firstPrice) / firstPrice) * 100).toFixed(1));
                }
            }
        }

        const lastPriceEl = document.getElementById('kpiEvolProdLastPrice');
        if (lastPriceEl) lastPriceEl.textContent = `${curr} ${lastPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        const lastDateEl = document.getElementById('kpiEvolProdLastDate');
        if (lastDateEl) lastDateEl.textContent = lastDate ? `Última: ${lastDate}` : 'Sin compras registradas';
        const minPriceEl = document.getElementById('kpiEvolProdMinPrice');
        if (minPriceEl) minPriceEl.textContent = `${curr} ${minPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        const maxPriceEl = document.getElementById('kpiEvolProdMaxPrice');
        if (maxPriceEl) maxPriceEl.textContent = `${curr} ${maxPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

        const varEl = document.getElementById('kpiEvolProdVariation');
        if (varEl) {
            const varSign = totalVariation > 0 ? `+${totalVariation}%` : `${totalVariation}%`;
            varEl.textContent = varSign;
            if (totalVariation > 0) {
                varEl.className = 'text-2xl font-black text-red-600 mt-1';
            } else if (totalVariation < 0) {
                varEl.className = 'text-2xl font-black text-emerald-600 mt-1';
            } else {
                varEl.className = 'text-2xl font-black text-slate-800 mt-1';
            }
        }

        // Renderizar tabla (orden inverso para mostrar las compras más recientes primero)
        const displayList = [...itemPurchases].reverse();
        const tbody = document.getElementById('evolProdTableBody');
        const rowCountEl = document.getElementById('evolProdRowCount');
        if (rowCountEl) rowCountEl.textContent = `${displayList.length} compras registradas`;

        if (tbody) {
            if (displayList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-slate-400">No se han registrado compras para el insumo "${product?.name || ''}" con los filtros actuales.</td></tr>`;
            } else {
                tbody.innerHTML = displayList.map(it => {
                    let varBadge = '<span class="text-slate-400">-</span>';
                    if (it.hasPrevious) {
                        if (it.varPercent > 0) {
                            varBadge = `<span class="inline-flex items-center gap-1 font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-[11px]"><i class="fa-solid fa-arrow-trend-up"></i> +${it.varPercent}%</span>`;
                        } else if (it.varPercent < 0) {
                            varBadge = `<span class="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]"><i class="fa-solid fa-arrow-trend-down"></i> ${it.varPercent}%</span>`;
                        } else {
                            varBadge = '<span class="font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">0.0%</span>';
                        }
                    }

                    let discLabel = '-';
                    if (it.discountAmount > 0 || it.discountPercent > 0) {
                        discLabel = `<span class="text-amber-700 font-semibold">${it.discountPercent > 0 ? `${it.discountPercent}% ` : ''}${it.discountAmount > 0 ? `(-$${it.discountAmount})` : ''}</span>`;
                    }

                    return `
                        <tr class="table-row-hover text-xs">
                            <td class="py-2.5 px-3 font-mono font-medium text-slate-700">${it.date}</td>
                            <td class="py-2.5 px-4 font-bold text-slate-800">${it.supplier}</td>
                            <td class="py-2.5 px-3 font-semibold text-slate-600">${it.invoiceNumber}</td>
                            <td class="py-2.5 px-3 text-right font-bold text-slate-800">${it.quantity}</td>
                            <td class="py-2.5 px-2 text-center text-slate-500">${it.unit}</td>
                            <td class="py-2.5 px-3 text-right text-slate-500">${curr} ${it.grossCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                            <td class="py-2.5 px-3 text-right">${discLabel}</td>
                            <td class="py-2.5 px-3 text-right font-black text-sky-700">${curr} ${it.netUnitCost.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                            <td class="py-2.5 px-3 text-right font-bold text-slate-800">${curr} ${it.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                            <td class="py-2.5 px-3 text-center">${varBadge}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Renderizar Gráfico de Línea de Evolución de Precios
        this.renderProductPriceChart(itemPurchases, product);
    },

    renderProductPriceChart(itemPurchases, product) {
        const canvas = document.getElementById('productPriceEvolutionChart');
        if (!canvas) return;

        if (this.productPriceChart) {
            this.productPriceChart.destroy();
        }

        if (typeof Chart === 'undefined') return;

        const labels = itemPurchases.map(it => `${it.date} (${it.supplier.split(' ')[0]})`);
        const dataValues = itemPurchases.map(it => it.netUnitCost);

        const ctx = canvas.getContext('2d');
        this.productPriceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length > 0 ? labels : ['Sin compras'],
                datasets: [{
                    label: `Costo Unitario Neto (${product?.unit || 'u.'})`,
                    data: dataValues.length > 0 ? dataValues : [product?.costPrice || 0],
                    borderColor: 'rgb(2, 132, 199)',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.25,
                    pointBackgroundColor: 'rgb(2, 132, 199)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ` Costo Unit.: $ ${ctx.parsed.y.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(val) {
                                return '$ ' + val.toLocaleString('es-ES');
                            },
                            font: { size: 10 }
                        },
                        grid: { color: 'rgba(226, 232, 240, 0.6)' }
                    },
                    x: {
                        ticks: { font: { size: 10 } },
                        grid: { display: false }
                    }
                }
            }
        });
    },

    resetEvolucionProveedorFilters() {
        const s = document.getElementById('evolSupplierSelect');
        if (s) s.value = '';
        const df = document.getElementById('evolDateFrom');
        if (df) df.value = '';
        const dt = document.getElementById('evolDateTo');
        if (dt) dt.value = '';
        this.renderEvolucionProveedor();
    },

    exportEvolucionProveedorToCSV() {
        const supSelect = document.getElementById('evolSupplierSelect');
        const selectedSupId = supSelect?.value || '';
        const dateFrom = document.getElementById('evolDateFrom')?.value || '';
        const dateTo = document.getElementById('evolDateTo')?.value || '';

        let purchases = StorageManager.getPurchases();
        const settings = StorageManager.getSettings();

        if (selectedSupId) {
            const sup = StorageManager.getSupplierById(selectedSupId);
            const supName = sup ? sup.name.toLowerCase() : '';
            purchases = purchases.filter(p => (p.supplierId && p.supplierId === selectedSupId) || (p.supplier && p.supplier.toLowerCase() === supName));
        }
        if (dateFrom) purchases = purchases.filter(p => p.date >= dateFrom);
        if (dateTo) purchases = purchases.filter(p => p.date <= dateTo);

        purchases.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

        let csv = `HISTORIAL DE COMPRAS POR PROVEEDOR - ${settings.businessName}\r\n`;
        csv += `Generado el: ${new Date().toLocaleDateString()}\r\n\r\n`;
        csv += 'Fecha;Factura;Proveedor;Renglones;EstadoPago;SubtotalNeto;TotalFactura\r\n';

        purchases.forEach(p => {
            const itemsSummary = (p.items || []).map(it => `${it.productName} (${it.quantity} ${it.unit})`).join(' | ');
            csv += `"${p.date || ''}";"${p.invoiceNumber || ''}";"${p.supplier || ''}";"${itemsSummary}";"${p.paymentStatus || 'pagada'}";"${p.netSubtotal || 0}";"${p.totalInvoice || p.totalCost || 0}"\r\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Evolucion_Compras_Proveedor_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    exportEvolucionInsumoToCSV() {
        const prodSelect = document.getElementById('evolProductSelect');
        const selectedProdId = prodSelect?.value || '';
        const supFilter = document.getElementById('evolProdSupplierFilter')?.value || '';
        const dateFrom = document.getElementById('evolProdDateFrom')?.value || '';

        const product = StorageManager.getProductById(selectedProdId);
        if (!product) return;

        const purchases = StorageManager.getPurchases();
        const rows = [];

        purchases.forEach(p => {
            if (dateFrom && p.date < dateFrom) return;
            if (supFilter) {
                const sup = StorageManager.getSupplierById(supFilter);
                const supName = sup ? sup.name.toLowerCase() : '';
                if (p.supplierId !== supFilter && (!p.supplier || p.supplier.toLowerCase() !== supName)) return;
            }

            (p.items || []).forEach(it => {
                if (it.productId === selectedProdId || (it.productName && it.productName.toLowerCase() === product.name.toLowerCase())) {
                    const grossCost = it.unitCost || 0;
                    const subtotal = it.subtotal || (it.quantity * grossCost);
                    const netUnitCost = it.quantity > 0 ? Number((subtotal / it.quantity).toFixed(2)) : grossCost;
                    rows.push({
                        date: p.date || '',
                        supplier: p.supplier || '',
                        invoice: p.invoiceNumber || '',
                        quantity: it.quantity || 0,
                        unit: it.unit || product.unit || 'u.',
                        grossCost: grossCost,
                        discountPercent: it.discountPercent || 0,
                        discountAmount: it.discountAmount || 0,
                        netUnitCost: netUnitCost,
                        subtotal: subtotal
                    });
                }
            });
        });

        rows.sort((a, b) => new Date(b.date) - new Date(a.date));

        let csv = `EVOLUCION DE PRECIOS - INSUMO: ${product.name} (${product.code})\r\n`;
        csv += `Generado el: ${new Date().toLocaleDateString()}\r\n\r\n`;
        csv += 'Fecha;Proveedor;Factura;Cantidad;Unidad;CostoLista;DescuentoPct;DescuentoMonto;CostoNetoUnitario;Subtotal\r\n';

        rows.forEach(r => {
            csv += `"${r.date}";"${r.supplier}";"${r.invoice}";"${r.quantity}";"${r.unit}";"${r.grossCost}";"${r.discountPercent}%";"${r.discountAmount}";"${r.netUnitCost}";"${r.subtotal}"\r\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Evolucion_Precios_${product.code}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ==========================================
    // MÓDULO CONFIGURACIÓN Y BACKUPS
    // ==========================================
    renderSettings() {
        const settings = StorageManager.getSettings();
        document.getElementById('settingBusinessName').value = settings.businessName || '';
        document.getElementById('settingCurrency').value = settings.currency || '$';
        document.getElementById('settingDefaultIva').value = settings.defaultIvaRate || '21';
    },

    saveSettings(event) {
        event.preventDefault();
        const settings = {
            businessName: document.getElementById('settingBusinessName').value.trim() || 'Mi Negocio',
            currency: document.getElementById('settingCurrency').value.trim() || '$',
            defaultIvaRate: parseFloat(document.getElementById('settingDefaultIva').value) || 21
        };
        StorageManager.saveSettings(settings);
        this.updateHeaderBusinessInfo();
        this.showToast('Configuración actualizada.', 'success');
    },

    handleImportBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const res = StorageManager.importDataFromJSON(e.target.result);
            if (res.success) {
                this.showToast(`¡Copia restaurada con éxito! (${res.countProducts} insumos, ${res.countPurchases} facturas).`, 'success');
                this.init();
            } else {
                this.showToast(res.error || 'Error al restaurar archivo.', 'error');
            }
        };
        reader.readAsText(file);
    },

    loadDemoData() {
        if (confirm('¿Cargar datos de prueba? Se añadirán usuarios con diferentes roles, proveedores, insumos vinculados, órdenes de compra y facturas con estado de pago.')) {
            StorageManager.loadDemoData();
            this.init();
            this.showToast('¡Datos de demostración cargados con éxito!', 'success');
        }
    },

    clearAllData() {
        if (confirm('¡PELIGRO! ¿Estás seguro de borrar todos los insumos, compras, proveedores y órdenes? Esta acción no se puede deshacer.')) {
            localStorage.clear();
            this.showToast('Todos los datos han sido borrados.', 'info');
            this.init();
        }
    },

    // ==========================================
    // ASISTENTE DE IMPORTACIÓN MASIVA (EXCEL / CSV)
    // ==========================================
    activeImportTab: 'insumos',
    parsedImportRows: [],

    openImportModal(tab = 'insumos', subTarget = 'inicial') {
        const modal = document.getElementById('importModal');
        if (!modal) return;

        this.switchImportTab(tab, subTarget);
        this.clearImportData();
        modal.classList.remove('hidden');
    },

    closeImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) modal.classList.add('hidden');
    },

    handleImportInvTargetChange() {
        const selectedRadio = document.querySelector('input[name="importInvTargetRadio"]:checked');
        const target = selectedRadio ? selectedRadio.value : 'inicial';
        const periodWrapper = document.getElementById('importInvPeriodWrapper');
        const snapshotWrapper = document.getElementById('importInvSnapshotWrapper');

        if (target === 'snapshot') {
            if (periodWrapper) periodWrapper.classList.add('hidden');
            if (snapshotWrapper) snapshotWrapper.classList.remove('hidden');
        } else {
            if (periodWrapper) periodWrapper.classList.remove('hidden');
            if (snapshotWrapper) snapshotWrapper.classList.add('hidden');
        }
    },

    switchImportTab(tab, subTarget = 'inicial') {
        this.activeImportTab = tab;

        const btnInsumos = document.getElementById('importTabBtnInsumos');
        const btnProveedores = document.getElementById('importTabBtnProveedores');
        const btnInventarios = document.getElementById('importTabBtnInventarios');
        const invConfigPanel = document.getElementById('importInventoryConfigPanel');
        const hintEl = document.getElementById('importColumnsHint');
        const btnTemplate = document.getElementById('btnDownloadTemplate');

        const activeClass = 'px-4 py-2 border-b-2 border-emerald-600 text-emerald-700 font-bold text-xs flex items-center gap-2 transition-colors whitespace-nowrap';
        const inactiveClass = 'px-4 py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-xs flex items-center gap-2 transition-colors whitespace-nowrap';

        if (btnInsumos) btnInsumos.className = tab === 'insumos' ? activeClass : inactiveClass;
        if (btnProveedores) btnProveedores.className = tab === 'proveedores' ? activeClass : inactiveClass;
        if (btnInventarios) btnInventarios.className = tab === 'inventarios' ? activeClass : inactiveClass;

        if (tab === 'inventarios') {
            if (invConfigPanel) invConfigPanel.classList.remove('hidden');

            const radio = document.querySelector(`input[name="importInvTargetRadio"][value="${subTarget}"]`);
            if (radio) radio.checked = true;

            const periodInput = document.getElementById('importInvPeriodInput');
            if (periodInput) periodInput.value = this.activePeriod || new Date().toISOString().slice(0, 7);

            const snapDateInput = document.getElementById('importInvSnapshotDate');
            if (snapDateInput) snapDateInput.value = new Date().toISOString().slice(0, 10);
            const snapNameInput = document.getElementById('importInvSnapshotName');
            if (snapNameInput && !snapNameInput.value) {
                snapNameInput.value = `Conteo Importado ${new Date().toLocaleDateString('es-ES')}`;
            }

            this.handleImportInvTargetChange();

            if (hintEl) {
                hintEl.innerHTML = `
                    <span class="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-sky-200">Codigo</span>, 
                    <span class="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-sky-200">Nombre</span>, 
                    <span class="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-sky-200">Cantidad</span>, 
                    <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">CostoUnitario (opcional)</span>
                `;
            }
            if (btnTemplate) btnTemplate.innerHTML = `<i class="fa-solid fa-file-arrow-down"></i><span>Plantilla Inventario (.csv)</span>`;
        } else {
            if (invConfigPanel) invConfigPanel.classList.add('hidden');

            if (tab === 'insumos') {
                if (hintEl) {
                    hintEl.innerHTML = `
                        <span class="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-sky-200">Nombre</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">Codigo</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">Categoria</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">Proveedor</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">Unidad</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">StockActual</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">StockMinimo</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">CostoNeto</span>
                    `;
                }
                if (btnTemplate) btnTemplate.innerHTML = `<i class="fa-solid fa-file-arrow-down"></i><span>Plantilla Insumos (.csv)</span>`;
            } else {
                if (hintEl) {
                    hintEl.innerHTML = `
                        <span class="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-sky-200">Nombre</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">CUIT</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">Rubro</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">Telefono</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">Email</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">Direccion</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">Contacto</span>, 
                        <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-sky-200">FormasDePago</span>
                    `;
                }
                if (btnTemplate) btnTemplate.innerHTML = `<i class="fa-solid fa-file-arrow-down"></i><span>Plantilla Proveedores (.csv)</span>`;
            }
        }

        if (this.parsedImportRows && this.parsedImportRows.length > 0) {
            this.renderImportPreview();
        }
    },

    downloadImportTemplate() {
        if (this.activeImportTab === 'insumos') {
            ProductManager.downloadProductsTemplate();
        } else if (this.activeImportTab === 'proveedores') {
            ProductManager.downloadSuppliersTemplate();
        } else if (this.activeImportTab === 'inventarios') {
            ProductManager.downloadInventoryTemplate();
        }
    },

    handleImportFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const nameLabel = document.getElementById('importSelectedFileName');
        if (nameLabel) nameLabel.textContent = `Archivo: ${file.name}`;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            this.parsedImportRows = ProductManager.parseDelimitedText(content);
            this.renderImportPreview();
        };
        reader.readAsText(file);
    },

    handleImportPasteInput() {
        const textarea = document.getElementById('importPasteTextarea');
        if (!textarea) return;
        const text = textarea.value;
        this.parsedImportRows = ProductManager.parseDelimitedText(text);
        this.renderImportPreview();
    },

    renderImportPreview() {
        const rows = this.parsedImportRows;
        const previewContainer = document.getElementById('importPreviewContainer');
        const countSpan = document.getElementById('importPreviewCount');
        const thead = document.getElementById('importPreviewThead');
        const tbody = document.getElementById('importPreviewTbody');
        const btnExecute = document.getElementById('btnExecuteImport');
        const statusMsg = document.getElementById('importStatusMessage');

        if (!rows || rows.length < 2) {
            if (previewContainer) previewContainer.classList.add('hidden');
            if (btnExecute) btnExecute.disabled = true;
            if (statusMsg) statusMsg.textContent = rows.length === 1 ? 'Se detectó solo el encabezado. Agrega filas con datos.' : '';
            return;
        }

        const headers = rows[0];
        const dataRows = rows.slice(1, 6);
        const totalCount = rows.length - 1;

        if (countSpan) countSpan.textContent = totalCount;

        if (thead) {
            thead.innerHTML = `<tr>${headers.map(h => `<th class="py-2.5 px-3 whitespace-nowrap bg-slate-100 text-slate-700 font-bold">${h || '-'}</th>`).join('')}</tr>`;
        }

        if (tbody) {
            tbody.innerHTML = dataRows.map(row => {
                return `<tr class="hover:bg-slate-50">${row.map(cell => `<td class="py-2 px-3 whitespace-nowrap text-slate-700 font-medium">${cell || '<span class="text-slate-300">-</span>'}</td>`).join('')}</tr>`;
            }).join('');
        }

        if (previewContainer) previewContainer.classList.remove('hidden');
        if (btnExecute) btnExecute.disabled = false;
        if (statusMsg) statusMsg.innerHTML = `<span class="text-emerald-700 font-bold">✓ ${totalCount} filas listas para procesar.</span>`;
    },

    clearImportData() {
        this.parsedImportRows = [];
        const fileInput = document.getElementById('importFileInput');
        if (fileInput) fileInput.value = '';
        const nameLabel = document.getElementById('importSelectedFileName');
        if (nameLabel) nameLabel.textContent = '';
        const textarea = document.getElementById('importPasteTextarea');
        if (textarea) textarea.value = '';
        const previewContainer = document.getElementById('importPreviewContainer');
        if (previewContainer) previewContainer.classList.add('hidden');
        const btnExecute = document.getElementById('btnExecuteImport');
        if (btnExecute) btnExecute.disabled = true;
        const statusMsg = document.getElementById('importStatusMessage');
        if (statusMsg) statusMsg.textContent = '';
    },

    executeImport() {
        if (!this.parsedImportRows || this.parsedImportRows.length < 2) {
            this.showToast('No hay datos para importar.', 'warning');
            return;
        }

        const updateExisting = document.getElementById('importUpdateExistingCheck')?.checked ?? true;

        try {
            if (this.activeImportTab === 'insumos') {
                const stats = ProductManager.importProductsFromMatrix(this.parsedImportRows, { updateExisting });
                
                let message = `¡Importación completada! ${stats.created} creados, ${stats.updated} actualizados.`;
                if (stats.suppliersCreated > 0) {
                    message += ` (${stats.suppliersCreated} proveedores nuevos registrados).`;
                }
                this.showToast(message, 'success');
            } else if (this.activeImportTab === 'proveedores') {
                const stats = ProductManager.importSuppliersFromMatrix(this.parsedImportRows, { updateExisting });
                this.showToast(`¡Proveedores importados! ${stats.created} creados, ${stats.updated} actualizados.`, 'success');
            } else if (this.activeImportTab === 'inventarios') {
                const selectedRadio = document.querySelector('input[name="importInvTargetRadio"]:checked');
                const targetType = selectedRadio ? selectedRadio.value : 'inicial';
                const targetPeriod = document.getElementById('importInvPeriodInput')?.value || this.activePeriod;
                const snapshotName = document.getElementById('importInvSnapshotName')?.value || '';
                const snapshotDate = document.getElementById('importInvSnapshotDate')?.value || '';

                const stats = ProductManager.importInventoryFromMatrix(this.parsedImportRows, {
                    targetType,
                    targetPeriod,
                    snapshotName,
                    snapshotDate
                });

                const targetLabels = {
                    'inicial': `Inventario Inicial (${targetPeriod})`,
                    'final': `Conteo Final (${targetPeriod})`,
                    'snapshot': `Conteo con Fecha (${snapshotDate})`
                };

                let message = `¡Inventario importado a ${targetLabels[targetType] || targetType}! Se cargaron ${stats.counted} insumos.`;
                if (stats.productsCreated > 0) {
                    message += ` (${stats.productsCreated} insumos nuevos dados de alta en catálogo).`;
                }
                this.showToast(message, 'success');
            }

            this.closeImportModal();
            this.populateDropdowns();
            this.renderProductsTable();
            this.renderSuppliersView();
            if (this.currentView === 'dashboard') this.renderDashboard();
            if (this.currentView === 'inventarios') this.renderInventorySheets();
            if (this.currentView === 'cmv') this.renderCMVView();
        } catch (err) {
            console.error(err);
            this.showToast(err.message || 'Error durante la importación.', 'error');
        }
    }
};
