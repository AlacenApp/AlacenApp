/**
 * Storage & Data Manager
 * Manejo de persistencia local en localStorage, exportación/importación,
 * categorías, proveedores, órdenes de compra, pagos y control de usuarios (RBAC).
 */

const STORAGE_KEYS = {
    PRODUCTS: 'control_stock_products_v1',
    PURCHASES: 'control_stock_purchases_v1',
    PURCHASE_ORDERS: 'control_stock_purchase_orders_v1',
    MONTHLY_INVENTORY: 'control_stock_monthly_inv_v1',
    INVENTORY_SNAPSHOTS: 'control_stock_inv_snapshots_v1',
    SUPPLIERS: 'control_stock_suppliers_v2',
    SETTINGS: 'control_stock_settings_v1',
    CATEGORIES: 'control_stock_categories_v2',
    USERS: 'control_stock_users_v1',
    ACTIVE_USER: 'control_stock_active_user_v1'
};

const DEFAULT_SETTINGS = {
    businessName: 'Mi Negocio / Control de Stock',
    currency: '$',
    alertLowStock: true,
    defaultCostMode: 'net',
    defaultIvaRate: 21,
    defaultIibbRate: 0,
    requireLogin: true
};

const DEFAULT_USERS = [
    {
        id: 'u_admin',
        name: 'Lucas (Dueño / Administrador)',
        username: 'admin',
        pin: '1234',
        role: 'admin', // Acceso total
        permissions: ['all'],
        active: true,
        avatarColor: 'bg-indigo-600'
    },
    {
        id: 'u_compras',
        name: 'Encargado de Compras',
        username: 'compras',
        pin: '2222',
        role: 'compras',
        permissions: ['dashboard', 'compras-nueva', 'ordenes-compra', 'proveedores', 'productos', 'compras-historial', 'evolucion-compras'],
        active: true,
        avatarColor: 'bg-emerald-600'
    },
    {
        id: 'u_deposito',
        name: 'Operario de Depósito',
        username: 'deposito',
        pin: '3333',
        role: 'deposito',
        permissions: ['inventarios', 'productos'],
        active: true,
        avatarColor: 'bg-amber-600'
    }
];

const DEFAULT_CATEGORIES = [
    { id: 'cat_1', name: 'Materia Prima / Insumos', description: 'Insumos básicos para elaboración' },
    { id: 'cat_2', name: 'Mercadería para Reventa', description: 'Productos terminados para comercializar' },
    { id: 'cat_3', name: 'Envases y Embalaje', description: 'Cajas, bolsas y envoltorios' },
    { id: 'cat_4', name: 'Lácteos y Frescos', description: 'Productos refrigerados y perecederos' },
    { id: 'cat_5', name: 'Secos y Almacén', description: 'Harinas, azúcares y no perecederos' },
    { id: 'cat_6', name: 'Limpieza y Varios', description: 'Artículos de higiene y mantenimiento' }
];

const DEFAULT_SUPPLIERS = [
    {
        id: 'sup_1',
        name: 'Molinos del Plata',
        cuit: '30-71029384-9',
        category: 'Molinería e Insumos Secos',
        phone: '011-4567-8900',
        email: 'ventas@molinosdelplata.com',
        address: 'Av. Corrientes 1420, CABA',
        contactPerson: 'Carlos Gómez',
        paymentMethods: 'Transferencia Bancaria a 15 días, Cheque',
        notes: 'Entrega los días martes y jueves.'
    },
    {
        id: 'sup_2',
        name: 'Distribuidora Central',
        cuit: '30-65498712-4',
        category: 'Distribuidora Mayorista',
        phone: '011-4321-7654',
        email: 'pedidos@distribuidoracentral.com',
        address: 'Ruta 8 Km 45, Buenos Aires',
        contactPerson: 'Mariana Pérez',
        paymentMethods: 'Efectivo contra entrega, Transferencia',
        notes: 'Pedido mínimo $50.000.'
    },
    {
        id: 'sup_3',
        name: 'Lácteos del Valle',
        cuit: '30-58963214-7',
        category: 'Lácteos y Refrigerados',
        phone: '0223-4987654',
        email: 'comercial@lacteosdelvalle.com',
        address: 'Parque Industrial Mar del Plata',
        contactPerson: 'Esteban Rossi',
        paymentMethods: 'Cuenta Corriente a 30 días, Transferencia',
        notes: 'Requiere cámara de frío al recibir.'
    },
    {
        id: 'sup_4',
        name: 'Envases Express',
        cuit: '30-78451236-1',
        category: 'Packaging y Descartables',
        phone: '011-5555-1234',
        email: 'info@envasesexpress.com',
        address: 'Av. Belgrano 2300, Avellaneda',
        contactPerson: 'Laura Silva',
        paymentMethods: 'Efectivo, Tarjeta de Crédito, Transferencia',
        notes: 'Venta por bulto cerrado.'
    }
];

class StorageManager {
    static get(key, fallback = []) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : fallback;
        } catch (e) {
            console.error(`Error al leer ${key} de localStorage:`, e);
            return fallback;
        }
    }

    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Error al guardar ${key} en localStorage:`, e);
            alert('Atención: El almacenamiento local está lleno o bloqueado.');
            return false;
        }
    }

    // --- GESTIÓN DE USUARIOS Y CONTROL DE ACCESOS (RBAC) ---
    static getUsers() {
        return this.get(STORAGE_KEYS.USERS, DEFAULT_USERS);
    }

    static saveUsers(users) {
        return this.set(STORAGE_KEYS.USERS, users);
    }

    static getUserById(id) {
        return this.getUsers().find(u => u.id === id) || null;
    }

    static getUserByUsername(username) {
        if (!username) return null;
        return this.getUsers().find(u => u.username.toLowerCase() === username.toLowerCase().trim()) || null;
    }

    static saveUser(userData) {
        let users = this.getUsers();
        if (userData.id) {
            const idx = users.findIndex(u => u.id === userData.id);
            if (idx >= 0) {
                users[idx] = { ...users[idx], ...userData, updatedAt: new Date().toISOString() };
            }
        } else {
            const colors = ['bg-indigo-600', 'bg-emerald-600', 'bg-amber-600', 'bg-sky-600', 'bg-purple-600', 'bg-rose-600'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];

            users.push({
                ...userData,
                id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                active: true,
                avatarColor: userData.avatarColor || randomColor,
                createdAt: new Date().toISOString()
            });
        }
        this.saveUsers(users);
        return users;
    }

    static deleteUser(userId) {
        let users = this.getUsers();
        if (users.length <= 1) {
            throw new Error('No puedes eliminar el único usuario del sistema.');
        }
        const user = users.find(u => u.id === userId);
        if (user && user.role === 'admin') {
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                throw new Error('Debe haber al menos un usuario Administrador en el sistema.');
            }
        }
        users = users.filter(u => u.id !== userId);
        this.saveUsers(users);
        return true;
    }

    static getActiveUser() {
        let user = this.get(STORAGE_KEYS.ACTIVE_USER, null);
        if (!user) {
            const users = this.getUsers();
            user = users[0] || DEFAULT_USERS[0];
            this.setActiveUser(user);
        }
        return user;
    }

    static setActiveUser(user) {
        return this.set(STORAGE_KEYS.ACTIVE_USER, user);
    }

    static hasPermission(user, moduleKey) {
        if (!user) return false;
        if (user.role === 'admin' || (user.permissions && user.permissions.includes('all'))) {
            return true;
        }
        if (user.role === 'compras' && moduleKey === 'evolucion-compras') {
            return true;
        }
        if (!user.permissions || !Array.isArray(user.permissions)) {
            return false;
        }
        return user.permissions.includes(moduleKey);
    }

    // --- CATEGORÍAS (CRUD COMPLETO) ---
    static getCategories() {
        let cats = this.get(STORAGE_KEYS.CATEGORIES, null);
        if (!cats) {
            cats = DEFAULT_CATEGORIES;
            this.saveCategories(cats);
        }
        return cats;
    }

    static saveCategories(categories) {
        return this.set(STORAGE_KEYS.CATEGORIES, categories);
    }

    static saveCategory(categoryData) {
        let categories = this.getCategories();
        if (categoryData.id) {
            const idx = categories.findIndex(c => c.id === categoryData.id);
            if (idx >= 0) {
                const oldName = categories[idx].name;
                categories[idx] = { ...categories[idx], ...categoryData };
                
                if (oldName !== categoryData.name) {
                    let prods = this.getProducts();
                    prods.forEach(p => {
                        if (p.category === oldName) p.category = categoryData.name;
                    });
                    this.saveProducts(prods);
                }
            }
        } else {
            categories.push({
                id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                name: categoryData.name.trim(),
                description: (categoryData.description || '').trim()
            });
        }
        this.saveCategories(categories);
        return categories;
    }

    static deleteCategory(categoryId) {
        let categories = this.getCategories();
        const cat = categories.find(c => c.id === categoryId);
        if (!cat) return false;

        const prods = this.getProducts();
        const hasProducts = prods.some(p => p.category === cat.name);
        if (hasProducts) {
            throw new Error(`No se puede eliminar la categoría "${cat.name}" porque tiene insumos asignados. Reasigna los insumos primero.`);
        }

        categories = categories.filter(c => c.id !== categoryId);
        this.saveCategories(categories);
        return true;
    }

    // --- PROVEEDORES (CRUD COMPLETO) ---
    static getSuppliers() {
        let sups = this.get(STORAGE_KEYS.SUPPLIERS, null);
        if (!sups) {
            sups = DEFAULT_SUPPLIERS;
            this.saveSuppliers(sups);
        }
        return sups;
    }

    static saveSuppliers(suppliers) {
        return this.set(STORAGE_KEYS.SUPPLIERS, suppliers);
    }

    static getSupplierById(id) {
        return this.getSuppliers().find(s => s.id === id) || null;
    }

    static getSupplierByName(name) {
        if (!name) return null;
        return this.getSuppliers().find(s => s.name.toLowerCase() === name.toLowerCase().trim()) || null;
    }

    static saveSupplier(supplierData) {
        let suppliers = this.getSuppliers();
        if (supplierData.id) {
            const idx = suppliers.findIndex(s => s.id === supplierData.id);
            if (idx >= 0) {
                const oldName = suppliers[idx].name;
                suppliers[idx] = { ...suppliers[idx], ...supplierData, updatedAt: new Date().toISOString() };

                if (oldName !== supplierData.name) {
                    let prods = this.getProducts();
                    prods.forEach(p => {
                        if (p.supplierName === oldName || p.supplierId === supplierData.id) {
                            p.supplierName = supplierData.name;
                        }
                    });
                    this.saveProducts(prods);
                }
            }
        } else {
            suppliers.push({
                ...supplierData,
                id: 'sup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                createdAt: new Date().toISOString()
            });
        }
        this.saveSuppliers(suppliers);
        return suppliers;
    }

    static deleteSupplier(supplierId) {
        let suppliers = this.getSuppliers();
        suppliers = suppliers.filter(s => s.id !== supplierId);
        this.saveSuppliers(suppliers);
        return true;
    }

    static addSupplierIfNotExists(name) {
        if (!name || !name.trim()) return;
        const suppliers = this.getSuppliers();
        if (!suppliers.some(s => s.name.toLowerCase() === name.toLowerCase().trim())) {
            this.saveSupplier({
                name: name.trim(),
                cuit: '',
                category: 'General',
                phone: '',
                email: '',
                address: '',
                contactPerson: '',
                paymentMethods: 'A convenir',
                notes: ''
            });
        }
    }

    // --- PRODUCTOS / INSUMOS CON PROVEEDOR OPCIONAL ---
    static getProducts() {
        return this.get(STORAGE_KEYS.PRODUCTS, []);
    }

    static saveProducts(products) {
        return this.set(STORAGE_KEYS.PRODUCTS, products);
    }

    static getProductById(id) {
        const products = this.getProducts();
        return products.find(p => p.id === id) || null;
    }

    static saveProduct(product) {
        const products = this.getProducts();
        const index = products.findIndex(p => p.id === product.id);
        if (index >= 0) {
            products[index] = { ...products[index], ...product, updatedAt: new Date().toISOString() };
        } else {
            products.push({
                ...product,
                id: product.id || 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
        this.saveProducts(products);
        return products;
    }

    static deleteProduct(id) {
        let products = this.getProducts();
        products = products.filter(p => p.id !== id);
        this.saveProducts(products);
        return products;
    }

    static adjustProductStock(id, qtyChange, reason = 'Ajuste manual') {
        const products = this.getProducts();
        const product = products.find(p => p.id === id);
        if (product) {
            product.currentStock = Number(((product.currentStock || 0) + Number(qtyChange)).toFixed(3));
            product.updatedAt = new Date().toISOString();
            this.saveProducts(products);
        }
        return product;
    }

    // --- FACTURAS DE COMPRA Y ESTADO DE PAGO ---
    static getPurchases() {
        return this.get(STORAGE_KEYS.PURCHASES, []);
    }

    static savePurchases(purchases) {
        return this.set(STORAGE_KEYS.PURCHASES, purchases);
    }

    static addPurchase(purchaseData) {
        const purchases = this.getPurchases();
        
        const netSubtotal = Number(purchaseData.netSubtotal || 0);
        const ivaRate = Number(purchaseData.ivaRate || 0);
        const ivaAmount = Number(purchaseData.ivaAmount || 0);
        const iibbRate = Number(purchaseData.iibbRate || 0);
        const iibbAmount = Number(purchaseData.iibbAmount || 0);
        const ivaPerception = Number(purchaseData.ivaPerception || 0);
        const otherTaxes = Number(purchaseData.otherTaxes || 0);
        const totalInvoice = Number(purchaseData.totalInvoice || (netSubtotal + ivaAmount + iibbAmount + ivaPerception + otherTaxes));
        const costMode = purchaseData.costMode || 'net';

        const paymentStatus = purchaseData.paymentStatus || 'pagada';
        const paymentDate = paymentStatus === 'pagada' ? (purchaseData.paymentDate || purchaseData.date) : '';
        const paymentMethod = purchaseData.paymentMethod || 'Efectivo';

        const newPurchase = {
            id: 'compra_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            date: purchaseData.date || new Date().toISOString().split('T')[0],
            invoiceNumber: purchaseData.invoiceNumber || 'S/N',
            supplier: purchaseData.supplier || 'Proveedor General',
            supplierId: purchaseData.supplierId || '',
            paymentMethod: paymentMethod,
            paymentStatus: paymentStatus,
            paymentDate: paymentDate,
            notes: purchaseData.notes || '',
            items: purchaseData.items || [],
            
            netSubtotal: Number(netSubtotal.toFixed(2)),
            ivaRate: ivaRate,
            ivaAmount: Number(ivaAmount.toFixed(2)),
            iibbRate: iibbRate,
            iibbAmount: Number(iibbAmount.toFixed(2)),
            ivaPerception: Number(ivaPerception.toFixed(2)),
            otherTaxes: Number(otherTaxes.toFixed(2)),
            totalCost: Number(totalInvoice.toFixed(2)),
            totalInvoice: Number(totalInvoice.toFixed(2)),
            costMode: costMode,

            createdAt: new Date().toISOString()
        };

        purchases.unshift(newPurchase);
        this.savePurchases(purchases);

        const taxMultiplier = (costMode === 'gross' && netSubtotal > 0) ? (totalInvoice / netSubtotal) : 1;
        const products = this.getProducts();
        newPurchase.items.forEach(item => {
            const prod = products.find(p => p.id === item.productId);
            if (prod) {
                prod.currentStock = Number(((prod.currentStock || 0) + Number(item.quantity)).toFixed(3));
                if (purchaseData.updateCostPrices && item.unitCost > 0) {
                    prod.costPrice = Number((item.unitCost * taxMultiplier).toFixed(2));
                }
                if (!prod.supplierName && newPurchase.supplier) {
                    prod.supplierName = newPurchase.supplier;
                }
                prod.updatedAt = new Date().toISOString();
            }
        });
        this.saveProducts(products);

        if (newPurchase.supplier && newPurchase.supplier.trim()) {
            this.addSupplierIfNotExists(newPurchase.supplier.trim());
        }

        return newPurchase;
    }

    static updatePurchase(id, purchaseData) {
        let purchases = this.getPurchases();
        const index = purchases.findIndex(p => p.id === id);
        if (index === -1) throw new Error('Factura no encontrada para actualizar.');

        const oldPurchase = purchases[index];
        const products = this.getProducts();

        // 1. Revertir el stock de los renglones anteriores
        if (oldPurchase.items && Array.isArray(oldPurchase.items)) {
            oldPurchase.items.forEach(oldItem => {
                const prod = products.find(p => p.id === oldItem.productId);
                if (prod) {
                    prod.currentStock = Number(((prod.currentStock || 0) - Number(oldItem.quantity)).toFixed(3));
                }
            });
        }

        const netSubtotal = Number(purchaseData.netSubtotal || 0);
        const ivaRate = Number(purchaseData.ivaRate || 0);
        const ivaAmount = Number(purchaseData.ivaAmount || 0);
        const iibbRate = Number(purchaseData.iibbRate || 0);
        const iibbAmount = Number(purchaseData.iibbAmount || 0);
        const ivaPerception = Number(purchaseData.ivaPerception || 0);
        const otherTaxes = Number(purchaseData.otherTaxes || 0);
        const totalInvoice = Number(purchaseData.totalInvoice || (netSubtotal + ivaAmount + iibbAmount + ivaPerception + otherTaxes));
        const costMode = purchaseData.costMode || 'net';

        const paymentStatus = purchaseData.paymentStatus || 'pagada';
        const paymentDate = paymentStatus === 'pagada' ? (purchaseData.paymentDate || purchaseData.date) : '';
        const paymentMethod = purchaseData.paymentMethod || 'Efectivo';

        const updatedPurchase = {
            ...oldPurchase,
            date: purchaseData.date || oldPurchase.date,
            invoiceNumber: purchaseData.invoiceNumber || 'S/N',
            supplier: purchaseData.supplier || oldPurchase.supplier,
            supplierId: purchaseData.supplierId || oldPurchase.supplierId,
            paymentMethod: paymentMethod,
            paymentStatus: paymentStatus,
            paymentDate: paymentDate,
            notes: purchaseData.notes !== undefined ? purchaseData.notes : oldPurchase.notes,
            items: purchaseData.items || [],

            netSubtotal: Number(netSubtotal.toFixed(2)),
            ivaRate: ivaRate,
            ivaAmount: Number(ivaAmount.toFixed(2)),
            iibbRate: iibbRate,
            iibbAmount: Number(iibbAmount.toFixed(2)),
            ivaPerception: Number(ivaPerception.toFixed(2)),
            otherTaxes: Number(otherTaxes.toFixed(2)),
            totalCost: Number(totalInvoice.toFixed(2)),
            totalInvoice: Number(totalInvoice.toFixed(2)),
            costMode: costMode,

            updatedAt: new Date().toISOString()
        };

        purchases[index] = updatedPurchase;
        this.savePurchases(purchases);

        // 2. Aplicar el stock y precios de los nuevos renglones
        const taxMultiplier = (costMode === 'gross' && netSubtotal > 0) ? (totalInvoice / netSubtotal) : 1;
        updatedPurchase.items.forEach(item => {
            const prod = products.find(p => p.id === item.productId);
            if (prod) {
                prod.currentStock = Number(((prod.currentStock || 0) + Number(item.quantity)).toFixed(3));
                if (purchaseData.updateCostPrices && item.unitCost > 0) {
                    prod.costPrice = Number((item.unitCost * taxMultiplier).toFixed(2));
                }
                if (!prod.supplierName && updatedPurchase.supplier) {
                    prod.supplierName = updatedPurchase.supplier;
                }
                prod.updatedAt = new Date().toISOString();
            }
        });
        this.saveProducts(products);

        if (updatedPurchase.supplier && updatedPurchase.supplier.trim()) {
            this.addSupplierIfNotExists(updatedPurchase.supplier.trim());
        }

        return updatedPurchase;
    }

    static updatePurchasePayment(id, { paymentStatus, paymentDate, paymentMethod, notes }) {
        let purchases = this.getPurchases();
        const purchase = purchases.find(p => p.id === id);
        if (!purchase) return false;

        purchase.paymentStatus = paymentStatus;
        purchase.paymentDate = paymentStatus === 'pagada' ? (paymentDate || new Date().toISOString().split('T')[0]) : '';
        if (paymentMethod) purchase.paymentMethod = paymentMethod;
        if (notes !== undefined) purchase.notes = notes;
        purchase.updatedAt = new Date().toISOString();

        this.savePurchases(purchases);
        return purchase;
    }

    static deletePurchase(id, revertStock = true) {
        let purchases = this.getPurchases();
        const purchase = purchases.find(p => p.id === id);
        if (!purchase) return false;

        if (revertStock && purchase.items) {
            const products = this.getProducts();
            purchase.items.forEach(item => {
                const prod = products.find(p => p.id === item.productId);
                if (prod) {
                    prod.currentStock = Number(((prod.currentStock || 0) - Number(item.quantity)).toFixed(3));
                }
            });
            this.saveProducts(products);
        }

        purchases = purchases.filter(p => p.id !== id);
        this.savePurchases(purchases);
        return true;
    }

    // --- ÓRDENES DE COMPRA (OC) ---
    static getPurchaseOrders() {
        return this.get(STORAGE_KEYS.PURCHASE_ORDERS, []);
    }

    static savePurchaseOrders(orders) {
        return this.set(STORAGE_KEYS.PURCHASE_ORDERS, orders);
    }

    static savePurchaseOrder(orderData) {
        let orders = this.getPurchaseOrders();
        if (orderData.id) {
            const idx = orders.findIndex(o => o.id === orderData.id);
            if (idx >= 0) {
                orders[idx] = { ...orders[idx], ...orderData, updatedAt: new Date().toISOString() };
            }
        } else {
            const newOrder = {
                ...orderData,
                id: 'OC-' + Date.now().toString().slice(-6),
                orderNumber: orderData.orderNumber || 'OC-' + Math.floor(1000 + Math.random() * 9000),
                status: orderData.status || 'pendiente',
                createdAt: new Date().toISOString()
            };
            orders.unshift(newOrder);
            orderData = newOrder;
        }
        this.savePurchaseOrders(orders);
        return orderData;
    }

    static deletePurchaseOrder(id) {
        let orders = this.getPurchaseOrders();
        orders = orders.filter(o => o.id !== id);
        this.savePurchaseOrders(orders);
        return true;
    }

    static updatePurchaseOrderStatus(id, status) {
        let orders = this.getPurchaseOrders();
        const order = orders.find(o => o.id === id);
        if (order) {
            order.status = status;
            order.updatedAt = new Date().toISOString();
            this.savePurchaseOrders(orders);
        }
        return order;
    }

    // --- INVENTARIOS MENSUALES Y CMV ---
    static getMonthlyInventories() {
        return this.get(STORAGE_KEYS.MONTHLY_INVENTORY, {});
    }

    static saveMonthlyInventories(data) {
        return this.set(STORAGE_KEYS.MONTHLY_INVENTORY, data);
    }

    static getPeriodData(period) {
        const all = this.getMonthlyInventories();
        if (!all[period]) {
            all[period] = {
                period: period,
                status: 'open',
                initialInventory: {},
                finalInventory: {},
                notes: '',
                updatedAt: new Date().toISOString()
            };
            this.saveMonthlyInventories(all);
        }
        return all[period];
    }

    static savePeriodData(period, data) {
        const all = this.getMonthlyInventories();
        all[period] = {
            ...(all[period] || {}),
            ...data,
            period: period,
            updatedAt: new Date().toISOString()
        };
        this.saveMonthlyInventories(all);
        return all[period];
    }

    // --- SNAPSHOTS DE INVENTARIO (conteos físicos con fecha libre) ---
    static getSnapshots() {
        return this.get(STORAGE_KEYS.INVENTORY_SNAPSHOTS, []);
    }

    static saveSnapshots(snapshots) {
        return this.set(STORAGE_KEYS.INVENTORY_SNAPSHOTS, snapshots);
    }

    static getSnapshotById(id) {
        return this.getSnapshots().find(s => s.id === id) || null;
    }

    static saveSnapshot(snapData) {
        let snapshots = this.getSnapshots();
        if (snapData.id) {
            const idx = snapshots.findIndex(s => s.id === snapData.id);
            if (idx >= 0) {
                snapshots[idx] = { ...snapshots[idx], ...snapData, updatedAt: new Date().toISOString() };
            } else {
                snapshots.unshift({ ...snapData, updatedAt: new Date().toISOString() });
            }
        } else {
            const activeUser = this.getActiveUser();
            const newSnap = {
                ...snapData,
                id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: activeUser ? activeUser.name : 'Sistema'
            };
            snapshots.unshift(newSnap);
            this.saveSnapshots(snapshots);
            return newSnap;
        }
        this.saveSnapshots(snapshots);
        return snapData;
    }

    static deleteSnapshot(id) {
        let snapshots = this.getSnapshots();
        snapshots = snapshots.filter(s => s.id !== id);
        this.saveSnapshots(snapshots);
        return true;
    }


    static getSettings() {
        return this.get(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    }

    static saveSettings(settings) {
        return this.set(STORAGE_KEYS.SETTINGS, { ...DEFAULT_SETTINGS, ...settings });
    }

    // --- BACKUP & RESTORE ---
    static exportAllDataAsJSON() {
        const backup = {
            exportDate: new Date().toISOString(),
            version: '5.0',
            settings: this.getSettings(),
            users: this.getUsers(),
            categories: this.getCategories(),
            suppliers: this.getSuppliers(),
            products: this.getProducts(),
            purchases: this.getPurchases(),
            purchaseOrders: this.getPurchaseOrders(),
            monthlyInventories: this.getMonthlyInventories(),
            inventorySnapshots: this.getSnapshots()
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_control_stock_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    static importDataFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.products && !data.purchases && !data.suppliers) {
                throw new Error('Formato de archivo de respaldo no válido.');
            }
            if (data.settings) this.saveSettings(data.settings);
            if (data.users) this.saveUsers(data.users);
            if (data.categories) this.saveCategories(data.categories);
            if (data.suppliers) this.saveSuppliers(data.suppliers);
            if (data.products) this.saveProducts(data.products);
            if (data.purchases) this.savePurchases(data.purchases);
            if (data.purchaseOrders) this.savePurchaseOrders(data.purchaseOrders);
            if (data.monthlyInventories) this.saveMonthlyInventories(data.monthlyInventories);
            if (data.inventorySnapshots) this.saveSnapshots(data.inventorySnapshots);
            return { success: true, countProducts: (data.products || []).length, countPurchases: (data.purchases || []).length };
        } catch (e) {
            console.error(e);
            return { success: false, error: e.message };
        }
    }

    // --- GENERAR DATOS DE DEMOSTRACIÓN COMPLETOS ---
    static loadDemoData() {
        const demoSuppliers = DEFAULT_SUPPLIERS;
        const demoCategories = DEFAULT_CATEGORIES;
        const demoUsers = DEFAULT_USERS;
        
        const demoProducts = [
            { id: 'p1', code: 'INS-001', name: 'Harina 0000', category: 'Secos y Almacén', unit: 'kg', currentStock: 85, minStock: 30, costPrice: 950, salePrice: 0, supplierId: 'sup_1', supplierName: 'Molinos del Plata' },
            { id: 'p2', code: 'INS-002', name: 'Azúcar Común', category: 'Secos y Almacén', unit: 'kg', currentStock: 42, minStock: 25, costPrice: 1100, salePrice: 0, supplierId: 'sup_1', supplierName: 'Molinos del Plata' },
            { id: 'p3', code: 'INS-003', name: 'Leche Entera', category: 'Lácteos y Frescos', unit: 'l', currentStock: 12, minStock: 20, costPrice: 1250, salePrice: 0, supplierId: 'sup_3', supplierName: 'Lácteos del Valle' },
            { id: 'p4', code: 'INS-004', name: 'Huevos Grado A', category: 'Lácteos y Frescos', unit: 'u.', currentStock: 180, minStock: 60, costPrice: 160, salePrice: 0, supplierId: 'sup_3', supplierName: 'Lácteos del Valle' },
            { id: 'p5', code: 'INS-005', name: 'Manteca Calidad Extra', category: 'Lácteos y Frescos', unit: 'kg', currentStock: 8, minStock: 15, costPrice: 6200, salePrice: 0, supplierId: 'sup_3', supplierName: 'Lácteos del Valle' },
            { id: 'p6', code: 'INS-006', name: 'Levadura Fresca', category: 'Materia Prima / Insumos', unit: 'kg', currentStock: 4.5, minStock: 5, costPrice: 3800, salePrice: 0, supplierId: 'sup_2', supplierName: 'Distribuidora Central' },
            { id: 'p7', code: 'ENV-001', name: 'Bolsas Kraft Medianas', category: 'Envases y Embalaje', unit: 'u.', currentStock: 350, minStock: 100, costPrice: 85, salePrice: 0, supplierId: 'sup_4', supplierName: 'Envases Express' },
            { id: 'p8', code: 'INS-007', name: 'Esencia de Vainilla', category: 'Secos y Almacén', unit: 'l', currentStock: 3.2, minStock: 2, costPrice: 4500, salePrice: 0, supplierId: '', supplierName: '' }
        ];

        const now = new Date();
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const curDateStr = (day) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        const demoPurchases = [
            {
                id: 'comp_demo_1',
                date: curDateStr(3),
                invoiceNumber: 'FC-A 0001-0004512',
                supplier: 'Molinos del Plata',
                supplierId: 'sup_1',
                paymentMethod: 'Transferencia Bancaria',
                paymentStatus: 'pagada',
                paymentDate: curDateStr(4),
                notes: 'Bolsas de harina y azúcar - Pagado por transferencia',
                items: [
                    { productId: 'p1', productName: 'Harina 0000', unit: 'kg', quantity: 100, unitCost: 950, subtotal: 95000 },
                    { productId: 'p2', productName: 'Azúcar Común', unit: 'kg', quantity: 50, unitCost: 1100, subtotal: 55000 }
                ],
                netSubtotal: 150000,
                ivaRate: 21,
                ivaAmount: 31500,
                iibbRate: 3,
                iibbAmount: 4500,
                ivaPerception: 2250,
                otherTaxes: 0,
                totalCost: 188250,
                totalInvoice: 188250,
                costMode: 'net',
                createdAt: new Date().toISOString()
            },
            {
                id: 'comp_demo_2',
                date: curDateStr(10),
                invoiceNumber: 'FC-A 0005-0012984',
                supplier: 'Lácteos del Valle',
                supplierId: 'sup_3',
                paymentMethod: 'Cuenta Corriente / A Pagar',
                paymentStatus: 'pendiente',
                paymentDate: '',
                notes: 'Entrega semanal refrigerada - Vencimiento a fin de mes',
                items: [
                    { productId: 'p3', productName: 'Leche Entera', unit: 'l', quantity: 60, unitCost: 1250, subtotal: 75000 },
                    { productId: 'p4', productName: 'Huevos Grado A', unit: 'u.', quantity: 360, unitCost: 160, subtotal: 57600 },
                    { productId: 'p5', productName: 'Manteca Calidad Extra', unit: 'kg', quantity: 20, unitCost: 6200, subtotal: 124000 }
                ],
                netSubtotal: 256600,
                ivaRate: 21,
                ivaAmount: 53886,
                iibbRate: 2.5,
                iibbAmount: 6415,
                ivaPerception: 3849,
                otherTaxes: 0,
                totalCost: 320750,
                totalInvoice: 320750,
                costMode: 'net',
                createdAt: new Date().toISOString()
            }
        ];

        const demoOrders = [
            {
                id: 'OC-001',
                orderNumber: 'OC-1001',
                date: curDateStr(15),
                supplierId: 'sup_3',
                supplierName: 'Lácteos del Valle',
                status: 'pendiente',
                notes: 'Reposición urgente de manteca y leche',
                items: [
                    { productId: 'p3', productName: 'Leche Entera', unit: 'l', currentStock: 12, minStock: 20, quantity: 50, estimatedCost: 1250, subtotal: 62500 },
                    { productId: 'p5', productName: 'Manteca Calidad Extra', unit: 'kg', currentStock: 8, minStock: 15, quantity: 15, estimatedCost: 6200, subtotal: 93000 }
                ],
                totalEstimated: 155500,
                createdAt: new Date().toISOString()
            }
        ];

        const demoMonthly = {};
        demoMonthly[currentPeriod] = {
            period: currentPeriod,
            status: 'open',
            notes: 'Período en curso - Registro regular de consumos',
            initialInventory: {
                'p1': { qty: 25, unitCost: 900 },
                'p2': { qty: 15, unitCost: 1050 },
                'p3': { qty: 10, unitCost: 1200 },
                'p4': { qty: 60, unitCost: 150 },
                'p5': { qty: 5, unitCost: 6000 },
                'p6': { qty: 6, unitCost: 3600 },
                'p7': { qty: 150, unitCost: 80 },
                'p8': { qty: 2, unitCost: 4200 }
            },
            finalInventory: {
                'p1': { qty: 40 },
                'p2': { qty: 23 },
                'p3': { qty: 25 },
                'p4': { qty: 120 },
                'p5': { qty: 13 },
                'p6': { qty: 3 },
                'p7': { qty: 210 },
                'p8': { qty: 1.8 }
            },
            updatedAt: new Date().toISOString()
        };

        this.saveCategories(demoCategories);
        this.saveSuppliers(demoSuppliers);
        this.saveUsers(demoUsers);
        this.setActiveUser(demoUsers[0]);
        this.saveProducts(demoProducts);
        this.savePurchases(demoPurchases);
        this.savePurchaseOrders(demoOrders);
        this.saveMonthlyInventories(demoMonthly);
        this.saveSettings(DEFAULT_SETTINGS);

        return true;
    }
}
