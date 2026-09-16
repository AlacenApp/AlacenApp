/**
 * Products & Inventory Management
 * Gestión de catálogo de mercadería, insumos, alertas de stock, categorías y proveedor habitual.
 */

class ProductManager {
    static UNITS = ['u.', 'kg', 'g', 'l', 'ml', 'm', 'caja', 'paq.', 'docena'];

    static getFilteredProducts({ searchTerm = '', category = '', stockFilter = 'all', supplier = '', period = '' } = {}) {
        let products = StorageManager.getProducts();

        // Calcular inventario inicial del mes y compras a la fecha para cada producto
        let initialInv = {};
        let purchasesByProduct = {};

        const targetPeriod = period || (typeof App !== 'undefined' && App.activePeriod ? App.activePeriod : new Date().toISOString().slice(0, 7));

        if (targetPeriod) {
            const periodData = StorageManager.getPeriodData(targetPeriod);
            initialInv = periodData.initialInventory || {};

            const allPurchases = StorageManager.getPurchases();
            const monthPurchases = allPurchases.filter(p => p.date && p.date.startsWith(targetPeriod));

            monthPurchases.forEach(purch => {
                (purch.items || []).forEach(it => {
                    if (it.productId) {
                        purchasesByProduct[it.productId] = (purchasesByProduct[it.productId] || 0) + Number(it.quantity || 0);
                    }
                });
            });
        }

        // Enriquecer cada producto con métricas de stock del mes
        products = products.map(p => {
            const initQty = Number(initialInv[p.id]?.qty || 0);
            const purchQty = Number((purchasesByProduct[p.id] || 0).toFixed(3));
            const calculatedStock = Number((initQty + purchQty).toFixed(3));

            return {
                ...p,
                initialMonthStock: initQty,
                monthPurchasesQty: purchQty,
                currentStock: calculatedStock
            };
        });

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            products = products.filter(p => 
                (p.name && p.name.toLowerCase().includes(term)) ||
                (p.code && p.code.toLowerCase().includes(term)) ||
                (p.category && p.category.toLowerCase().includes(term)) ||
                (p.supplierName && p.supplierName.toLowerCase().includes(term))
            );
        }

        if (category) {
            products = products.filter(p => p.category === category);
        }

        if (supplier) {
            products = products.filter(p => p.supplierName === supplier || p.supplierId === supplier);
        }

        if (stockFilter === 'low') {
            products = products.filter(p => (p.currentStock || 0) <= (p.minStock || 0) && (p.currentStock || 0) > 0);
        } else if (stockFilter === 'out') {
            products = products.filter(p => (p.currentStock || 0) <= 0);
        } else if (stockFilter === 'normal') {
            products = products.filter(p => (p.currentStock || 0) > (p.minStock || 0));
        }

        return products.sort((a, b) => a.name.localeCompare(b.name));
    }

    static saveProductFromForm(formData) {
        let supplierName = (formData.supplierName || '').trim();
        let supplierId = formData.supplierId || '';

        // Si se seleccionó por ID, sincronizar nombre
        if (supplierId) {
            const sup = StorageManager.getSupplierById(supplierId);
            if (sup) supplierName = sup.name;
        } else if (supplierName) {
            const sup = StorageManager.getSupplierByName(supplierName);
            if (sup) supplierId = sup.id;
        }

        // Proveedor Secundario
        let secondarySupplierName = (formData.secondarySupplierName || '').trim();
        let secondarySupplierId = formData.secondarySupplierId || '';
        if (secondarySupplierId) {
            const supSec = StorageManager.getSupplierById(secondarySupplierId);
            if (supSec) secondarySupplierName = supSec.name;
        } else if (secondarySupplierName) {
            const supSec = StorageManager.getSupplierByName(secondarySupplierName);
            if (supSec) secondarySupplierId = supSec.id;
        }

        const product = {
            id: formData.id || undefined,
            code: (formData.code || '').trim().toUpperCase(),
            name: (formData.name || '').trim(),
            category: (formData.category || 'Materia Prima / Insumos').trim(),
            unit: formData.unit || 'u.',
            currentStock: Number(formData.currentStock || 0),
            minStock: Number(formData.minStock || 0),
            costPrice: Number(formData.costPrice || 0),
            salePrice: Number(formData.salePrice || 0),
            supplierId: supplierId,
            supplierName: supplierName,
            secondarySupplierId: secondarySupplierId,
            secondarySupplierName: secondarySupplierName,
            notes: (formData.notes || '').trim()
        };

        if (!product.name) {
            throw new Error('El nombre del insumo o producto es obligatorio.');
        }

        if (!product.code) {
            const initials = product.name.slice(0, 3).toUpperCase();
            product.code = `${initials}-${Math.floor(100 + Math.random() * 900)}`;
        }

        return StorageManager.saveProduct(product);
    }

    /**
     * Obtiene los insumos asociados a un proveedor específico:
     * 1. Aquellos que tienen asignado a este proveedor como habitual o secundario.
     * 2. Aquellos que históricamente se le hayan comprado a este proveedor.
     */
    static getProductsForSupplier(supplierIdentifier) {
        if (!supplierIdentifier) return [];

        const products = StorageManager.getProducts();
        const purchases = StorageManager.getPurchases();
        const supplier = StorageManager.getSupplierById(supplierIdentifier) || StorageManager.getSupplierByName(supplierIdentifier);
        const supName = supplier ? supplier.name.toLowerCase() : supplierIdentifier.toLowerCase();
        const supId = supplier ? supplier.id : '';

        // 1. Insumos asignados directamente en el catálogo (habitual o secundario)
        const assignedIds = new Set();
        products.forEach(p => {
            if ((p.supplierId && p.supplierId === supId) || (p.supplierName && p.supplierName.toLowerCase() === supName)) {
                assignedIds.add(p.id);
            }
            if ((p.secondarySupplierId && p.secondarySupplierId === supId) || (p.secondarySupplierName && p.secondarySupplierName.toLowerCase() === supName)) {
                assignedIds.add(p.id);
            }
        });

        // 2. Insumos comprados a este proveedor en el historial
        purchases.forEach(purch => {
            if ((purch.supplier && purch.supplier.toLowerCase() === supName) || (purch.supplierId && purch.supplierId === supId)) {
                (purch.items || []).forEach(it => {
                    if (it.productId) assignedIds.add(it.productId);
                });
            }
        });

        // Retornar lista de productos con métricas de stock
        return products.filter(p => assignedIds.has(p.id)).map(p => {
            const stock = p.currentStock || 0;
            const min = p.minStock || 0;
            const isLow = stock <= min;
            // Cantidad sugerida para reponer hasta el stock mínimo (o 2 veces el stock mínimo)
            const suggestedQty = isLow ? Math.max(1, Math.ceil(min * 1.5 - stock)) : 0;

            return {
                ...p,
                isLow,
                suggestedQty
            };
        });
    }

    static quickStockAdjust(productId, adjustmentQty, type, reason) {
        const product = StorageManager.getProductById(productId);
        if (!product) throw new Error('Producto no encontrado.');

        const qty = Number(adjustmentQty);
        if (isNaN(qty) || qty <= 0) throw new Error('Ingresa una cantidad válida mayor a 0.');

        let finalDelta = qty;
        if (type === 'salida' || type === 'baja') {
            finalDelta = -qty;
        }

        const updated = StorageManager.adjustProductStock(productId, finalDelta, reason);
        return updated;
    }

    static exportProductsToCSV(period = '') {
        const activePeriod = period || (typeof App !== 'undefined' && App.activePeriod ? App.activePeriod : new Date().toISOString().slice(0, 7));
        const products = this.getFilteredProducts({ period: activePeriod });
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        let csv = `LISTADO DE INSUMOS Y MERCADERIA - ${settings.businessName}\r\n`;
        csv += `Período: ${activePeriod} | Fecha reporte: ${new Date().toLocaleDateString()}\r\n\r\n`;

        const headers = ['Codigo', 'Nombre/Descripcion', 'Categoria', 'Proveedor Habitual', 'Unidad', 'Stock Inicial (II)', 'Compras Mes', 'Stock Actual Total', 'Stock Minimo', 'Costo Unitario ($)', 'Precio Venta ($)', 'Valor Total Stock ($)', 'Estado'];
        csv += headers.map(h => `"${h}"`).join(';') + '\r\n';

        products.forEach(p => {
            const initStock = p.initialMonthStock || 0;
            const purchStock = p.monthPurchasesQty || 0;
            const stock = p.currentStock || 0;
            const min = p.minStock || 0;
            const cost = p.costPrice || 0;
            const totalVal = Number((stock * cost).toFixed(2));
            
            let status = 'Normal';
            if (stock <= 0) status = 'Agotado';
            else if (stock <= min) status = 'Bajo Stock';

            const row = [
                p.code,
                p.name,
                p.category,
                p.supplierName || 'Sin asignar',
                p.unit,
                initStock,
                purchStock,
                stock,
                min,
                cost,
                p.salePrice || 0,
                totalVal,
                status
            ];
            csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + '\r\n';
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Productos_Stock_${activePeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Parsea texto delimitado (CSV con punto y coma o coma, o TSV tabulado copiado de Excel)
     */
    static parseDelimitedText(text) {
        if (!text || !text.trim()) return [];
        const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return [];

        // Detectar delimitador inspeccionando la primera línea
        const firstLine = lines[0];
        let delimiter = ';';
        if (firstLine.includes('\t')) {
            delimiter = '\t';
        } else if (firstLine.includes(';') && !firstLine.includes(',')) {
            delimiter = ';';
        } else if (firstLine.includes(',') && !firstLine.includes(';')) {
            delimiter = ',';
        } else if (firstLine.includes(';')) {
            delimiter = ';';
        } else if (firstLine.includes(',')) {
            delimiter = ',';
        }

        const parseLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"' || char === "'") {
                    if (inQuotes && line[i + 1] === char) {
                        current += char;
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === delimiter && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        const parsedRows = lines.map(parseLine);
        return parsedRows;
    }

    /**
     * Descarga plantilla CSV de ejemplo para importar Insumos
     */
    static downloadProductsTemplate() {
        const headers = ['Nombre', 'Codigo', 'Categoria', 'Proveedor', 'Unidad', 'StockActual', 'StockMinimo', 'CostoNeto', 'PrecioVenta', 'Notas'];
        const examples = [
            ['Harina 000 25kg', 'HAR-001', 'Secos y Almacén', 'Molinos del Plata', 'kg', '150', '50', '850.50', '0', 'Bolsa cerrada'],
            ['Levadura Fresca', 'LEV-002', 'Lácteos y Frescos', 'Distribuidora Central', 'kg', '20', '10', '1200.00', '0', 'Refrigerar a 4C'],
            ['Cajas Packaging 20x20', 'ENV-010', 'Envases y Embalaje', 'Envases Express', 'u.', '500', '100', '145.00', '0', 'Bulto de 100u'],
            ['Queso Muzzarella', 'MZ-005', 'Lácteos y Frescos', 'Lácteos del Valle', 'kg', '45', '15', '4500.00', '0', 'Barra 3kg']
        ];

        let csv = headers.join(';') + '\r\n';
        examples.forEach(row => {
            csv += row.map(v => `"${v}"`).join(';') + '\r\n';
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Plantilla_Importar_Insumos.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Descarga plantilla CSV de ejemplo para importar Proveedores
     */
    static downloadSuppliersTemplate() {
        const headers = ['Nombre', 'CUIT', 'Rubro', 'Telefono', 'Email', 'Direccion', 'Contacto', 'FormasDePago', 'Notas'];
        const examples = [
            ['Molinos del Plata', '30-71029384-9', 'Molinería e Insumos Secos', '011-4567-8900', 'ventas@molinos.com', 'Av. Corrientes 1420, CABA', 'Carlos Gómez', 'Transferencia 15 días, Cheque', 'Entrega martes y jueves'],
            ['Distribuidora Central', '30-65498712-4', 'Distribuidora Mayorista', '011-4321-7654', 'pedidos@central.com', 'Ruta 8 Km 45', 'Mariana Pérez', 'Efectivo contra entrega', 'Pedido mínimo $50.000']
        ];

        let csv = headers.join(';') + '\r\n';
        examples.forEach(row => {
            csv += row.map(v => `"${v}"`).join(';') + '\r\n';
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Plantilla_Importar_Proveedores.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Importa insumos y auto-registra proveedores y categorías nuevos
     */
    static importProductsFromMatrix(rows, { updateExisting = true } = {}) {
        if (!rows || rows.length < 2) {
            throw new Error('El archivo o texto no contiene suficientes filas (se requiere encabezado y al menos 1 registro).');
        }

        const rawHeaders = rows[0].map(h => (h || '').toString().toLowerCase().trim());

        // Mapeo flexible de nombres de columna
        const colMap = {
            name: rawHeaders.findIndex(h => h.includes('nombre') || h.includes('insumo') || h.includes('descripcion') || h.includes('producto') || h === 'item'),
            code: rawHeaders.findIndex(h => h.includes('cod') || h.includes('sku') || h.includes('id')),
            category: rawHeaders.findIndex(h => h.includes('cat') || h.includes('rubro') || h.includes('grupo')),
            supplier: rawHeaders.findIndex(h => h.includes('prov') || h.includes('proveedor') || h.includes('vendor')),
            unit: rawHeaders.findIndex(h => h.includes('unidad') || h.includes('unid') || h === 'u' || h === 'medida'),
            stock: rawHeaders.findIndex(h => (h.includes('stock') && !h.includes('min')) || h.includes('cant') || h.includes('actual') || h.includes('existencia')),
            minStock: rawHeaders.findIndex(h => h.includes('min') || h.includes('critico') || h.includes('alerta')),
            costPrice: rawHeaders.findIndex(h => h.includes('costo') || h.includes('compra') || h.includes('neto') || h === 'precio' || h === 'cost'),
            salePrice: rawHeaders.findIndex(h => h.includes('venta') || h.includes('pvp')),
            notes: rawHeaders.findIndex(h => h.includes('nota') || h.includes('obs') || h.includes('detalle'))
        };

        if (colMap.name === -1) {
            throw new Error('No se encontró la columna de Nombre del insumo (ej: "Nombre", "Insumo" o "Descripcion").');
        }

        const stats = {
            totalRows: rows.length - 1,
            created: 0,
            updated: 0,
            skipped: 0,
            suppliersCreated: 0,
            categoriesCreated: 0,
            errors: []
        };

        const existingProducts = StorageManager.getProducts();
        const existingSuppliers = StorageManager.getSuppliers();
        const existingCategories = StorageManager.getCategories();

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || row.every(c => !c || !c.trim())) continue;

            const name = (colMap.name !== -1 && row[colMap.name]) ? row[colMap.name].trim() : '';
            if (!name) {
                stats.skipped++;
                continue;
            }

            const rawCode = (colMap.code !== -1 && row[colMap.code]) ? row[colMap.code].trim().toUpperCase() : '';
            const rawCat = (colMap.category !== -1 && row[colMap.category]) ? row[colMap.category].trim() : 'Materia Prima / Insumos';
            const rawSupplier = (colMap.supplier !== -1 && row[colMap.supplier]) ? row[colMap.supplier].trim() : '';
            const rawUnit = (colMap.unit !== -1 && row[colMap.unit]) ? row[colMap.unit].trim() : 'u.';
            
            const parseNum = (val, fallback = 0) => {
                if (!val) return fallback;
                const clean = val.toString().replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '.');
                const n = parseFloat(clean);
                return isNaN(n) ? fallback : n;
            };

            const stock = colMap.stock !== -1 ? parseNum(row[colMap.stock], 0) : 0;
            const minStock = colMap.minStock !== -1 ? parseNum(row[colMap.minStock], 0) : 0;
            const costPrice = colMap.costPrice !== -1 ? parseNum(row[colMap.costPrice], 0) : 0;
            const salePrice = colMap.salePrice !== -1 ? parseNum(row[colMap.salePrice], 0) : 0;
            const notes = (colMap.notes !== -1 && row[colMap.notes]) ? row[colMap.notes].trim() : '';

            // 1. Auto-crear proveedor si viene indicado y no existe
            let supplierId = '';
            let supplierName = '';
            if (rawSupplier) {
                const foundSup = existingSuppliers.find(s => s.name.toLowerCase() === rawSupplier.toLowerCase());
                if (foundSup) {
                    supplierId = foundSup.id;
                    supplierName = foundSup.name;
                } else {
                    // Crear nuevo proveedor automáticamente
                    const newSup = StorageManager.saveSupplier({
                        name: rawSupplier,
                        category: rawCat || 'General',
                        notes: 'Creado automáticamente desde importación de insumos'
                    });
                    const newlyCreated = StorageManager.getSupplierByName(rawSupplier);
                    if (newlyCreated) {
                        supplierId = newlyCreated.id;
                        supplierName = newlyCreated.name;
                        existingSuppliers.push(newlyCreated);
                    } else {
                        supplierName = rawSupplier;
                    }
                    stats.suppliersCreated++;
                }
            }

            // 2. Auto-crear categoría si no existe
            if (rawCat && !existingCategories.some(c => c.name.toLowerCase() === rawCat.toLowerCase())) {
                StorageManager.saveCategory({ name: rawCat, description: 'Creada en importación' });
                existingCategories.push({ name: rawCat });
                stats.categoriesCreated++;
            }

            // 3. Buscar si el insumo ya existe por código o nombre
            const existingIdx = existingProducts.findIndex(p => 
                (rawCode && p.code && p.code.toLowerCase() === rawCode.toLowerCase()) ||
                (p.name && p.name.toLowerCase() === name.toLowerCase())
            );

            if (existingIdx >= 0) {
                if (updateExisting) {
                    const existing = existingProducts[existingIdx];
                    existingProducts[existingIdx] = {
                        ...existing,
                        name: name,
                        category: rawCat || existing.category,
                        unit: rawUnit || existing.unit,
                        currentStock: stock !== 0 ? stock : existing.currentStock,
                        minStock: minStock !== 0 ? minStock : existing.minStock,
                        costPrice: costPrice > 0 ? costPrice : existing.costPrice,
                        salePrice: salePrice > 0 ? salePrice : existing.salePrice,
                        supplierName: supplierName || existing.supplierName,
                        supplierId: supplierId || existing.supplierId,
                        notes: notes || existing.notes,
                        updatedAt: new Date().toISOString()
                    };
                    stats.updated++;
                } else {
                    stats.skipped++;
                }
            } else {
                // Generar código si no viene
                let finalCode = rawCode;
                if (!finalCode) {
                    const initials = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'INS');
                    finalCode = `${initials}-${Math.floor(100 + Math.random() * 900)}`;
                }

                existingProducts.push({
                    id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    code: finalCode,
                    name: name,
                    category: rawCat,
                    unit: rawUnit,
                    currentStock: stock,
                    minStock: minStock,
                    costPrice: costPrice,
                    salePrice: salePrice,
                    supplierName: supplierName,
                    supplierId: supplierId,
                    notes: notes,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                stats.created++;
            }
        }

        StorageManager.saveProducts(existingProducts);
        return stats;
    }

    /**
     * Importa proveedores desde matriz de filas
     */
    static importSuppliersFromMatrix(rows, { updateExisting = true } = {}) {
        if (!rows || rows.length < 2) {
            throw new Error('El archivo o texto no contiene suficientes filas.');
        }

        const rawHeaders = rows[0].map(h => (h || '').toString().toLowerCase().trim());
        const colMap = {
            name: rawHeaders.findIndex(h => h.includes('nombre') || h.includes('razon') || h.includes('proveedor') || h === 'empresa'),
            cuit: rawHeaders.findIndex(h => h.includes('cuit') || h.includes('rut') || h.includes('identificacion') || h.includes('tax')),
            category: rawHeaders.findIndex(h => h.includes('rubro') || h.includes('cat') || h.includes('actividad')),
            phone: rawHeaders.findIndex(h => h.includes('tel') || h.includes('cel') || h.includes('phone') || h.includes('whatsapp')),
            email: rawHeaders.findIndex(h => h.includes('mail') || h.includes('correo')),
            address: rawHeaders.findIndex(h => h.includes('direcc') || h.includes('domicilio') || h.includes('calle')),
            contactPerson: rawHeaders.findIndex(h => h.includes('contact') || h.includes('atencion') || h.includes('vendedor')),
            paymentMethods: rawHeaders.findIndex(h => h.includes('pago') || h.includes('condicion') || h.includes('plazo')),
            notes: rawHeaders.findIndex(h => h.includes('nota') || h.includes('obs'))
        };

        if (colMap.name === -1) {
            throw new Error('No se encontró la columna con el Nombre o Razón Social del proveedor.');
        }

        const stats = {
            totalRows: rows.length - 1,
            created: 0,
            updated: 0,
            skipped: 0
        };

        const existingSuppliers = StorageManager.getSuppliers();

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || row.every(c => !c || !c.trim())) continue;

            const name = (colMap.name !== -1 && row[colMap.name]) ? row[colMap.name].trim() : '';
            if (!name) {
                stats.skipped++;
                continue;
            }

            const cuit = (colMap.cuit !== -1 && row[colMap.cuit]) ? row[colMap.cuit].trim() : '';
            const category = (colMap.category !== -1 && row[colMap.category]) ? row[colMap.category].trim() : 'General';
            const phone = (colMap.phone !== -1 && row[colMap.phone]) ? row[colMap.phone].trim() : '';
            const email = (colMap.email !== -1 && row[colMap.email]) ? row[colMap.email].trim() : '';
            const address = (colMap.address !== -1 && row[colMap.address]) ? row[colMap.address].trim() : '';
            const contactPerson = (colMap.contactPerson !== -1 && row[colMap.contactPerson]) ? row[colMap.contactPerson].trim() : '';
            const paymentMethods = (colMap.paymentMethods !== -1 && row[colMap.paymentMethods]) ? row[colMap.paymentMethods].trim() : 'A convenir';
            const notes = (colMap.notes !== -1 && row[colMap.notes]) ? row[colMap.notes].trim() : '';

            const existingIdx = existingSuppliers.findIndex(s => s.name.toLowerCase() === name.toLowerCase());

            if (existingIdx >= 0) {
                if (updateExisting) {
                    existingSuppliers[existingIdx] = {
                        ...existingSuppliers[existingIdx],
                        cuit: cuit || existingSuppliers[existingIdx].cuit,
                        category: category || existingSuppliers[existingIdx].category,
                        phone: phone || existingSuppliers[existingIdx].phone,
                        email: email || existingSuppliers[existingIdx].email,
                        address: address || existingSuppliers[existingIdx].address,
                        contactPerson: contactPerson || existingSuppliers[existingIdx].contactPerson,
                        paymentMethods: paymentMethods || existingSuppliers[existingIdx].paymentMethods,
                        notes: notes || existingSuppliers[existingIdx].notes,
                        updatedAt: new Date().toISOString()
                    };
                    stats.updated++;
                } else {
                    stats.skipped++;
                }
            } else {
                existingSuppliers.push({
                    id: 'sup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    name,
                    cuit,
                    category,
                    phone,
                    email,
                    address,
                    contactPerson,
                    paymentMethods,
                    notes,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                stats.created++;
            }
        }

        StorageManager.saveSuppliers(existingSuppliers);
        return stats;
    }

    /**
     * Descarga plantilla CSV de ejemplo para importar Inventarios / Conteos Físicos
     */
    static downloadInventoryTemplate() {
        const headers = ['Codigo', 'Nombre', 'Cantidad', 'CostoUnitario'];
        const examples = [
            ['HAR-001', 'Harina 000 25kg', '120', '850.50'],
            ['LEV-002', 'Levadura Fresca', '18', '1200.00'],
            ['ENV-010', 'Cajas Packaging 20x20', '450', '145.00'],
            ['MZ-005', 'Queso Muzzarella', '38', '4500.00']
        ];

        let csv = headers.join(';') + '\r\n';
        examples.forEach(row => {
            csv += row.map(v => `"${v}"`).join(';') + '\r\n';
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Plantilla_Importar_Inventario.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Importa conteo de inventario (II, IF o Snapshot) desde matriz de filas
     */
    static importInventoryFromMatrix(rows, { targetType = 'inicial', targetPeriod = '', snapshotName = '', snapshotDate = '' } = {}) {
        if (!rows || rows.length < 2) {
            throw new Error('El archivo o texto no contiene suficientes filas.');
        }

        const rawHeaders = rows[0].map(h => (h || '').toString().toLowerCase().trim());
        const colMap = {
            code: rawHeaders.findIndex(h => h.includes('cod') || h.includes('sku') || h.includes('id')),
            name: rawHeaders.findIndex(h => h.includes('nombre') || h.includes('insumo') || h.includes('descripcion') || h.includes('item') || h.includes('producto')),
            qty: rawHeaders.findIndex(h => h.includes('cant') || h.includes('stock') || h.includes('conteo') || h.includes('fisico') || h.includes('unid')),
            cost: rawHeaders.findIndex(h => h.includes('cost') || h.includes('unitario') || h.includes('precio') || h.includes('neto'))
        };

        if (colMap.qty === -1) {
            throw new Error('No se encontró la columna de Cantidad o Conteo en el archivo.');
        }
        if (colMap.code === -1 && colMap.name === -1) {
            throw new Error('Se requiere al menos una columna de "Codigo" o "Nombre" para identificar los insumos.');
        }

        const stats = {
            totalRows: rows.length - 1,
            counted: 0,
            productsCreated: 0,
            skipped: 0
        };

        const existingProducts = StorageManager.getProducts();

        const parseNum = (val, fallback = 0) => {
            if (val === undefined || val === null || val === '') return null;
            const clean = val.toString().replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '.');
            const n = parseFloat(clean);
            return isNaN(n) ? fallback : n;
        };

        // Mapa acumulador por productId: { qty, unitCost }
        const countsByProductId = {};

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || row.every(c => !c || !c.trim())) continue;

            const code = colMap.code !== -1 && row[colMap.code] ? row[colMap.code].trim().toUpperCase() : '';
            const name = colMap.name !== -1 && row[colMap.name] ? row[colMap.name].trim() : '';
            const qtyVal = parseNum(row[colMap.qty], null);
            const costVal = colMap.cost !== -1 ? parseNum(row[colMap.cost], 0) : 0;

            if (qtyVal === null) {
                stats.skipped++;
                continue;
            }

            // Buscar insumo existente
            let product = null;
            if (code) {
                product = existingProducts.find(p => p.code && p.code.toUpperCase() === code);
            }
            if (!product && name) {
                product = existingProducts.find(p => p.name && p.name.toLowerCase() === name.toLowerCase());
            }

            // Si no existe, crearlo automáticamente para no perder el conteo
            if (!product) {
                const finalCode = code || (name ? `${name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'INS')}-${Math.floor(100 + Math.random() * 900)}` : `INS-${Date.now().toString().slice(-4)}`);
                const finalName = name || `Insumo ${finalCode}`;
                
                product = {
                    id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    code: finalCode,
                    name: finalName,
                    category: 'Materia Prima / Insumos',
                    unit: 'u.',
                    currentStock: qtyVal,
                    minStock: 0,
                    costPrice: costVal || 0,
                    salePrice: 0,
                    supplierName: '',
                    notes: 'Creado automáticamente desde importación de inventario',
                    createdAt: new Date().toISOString()
                };
                existingProducts.push(product);
                StorageManager.saveProduct(product);
                stats.productsCreated++;
            }

            countsByProductId[product.id] = {
                qty: qtyVal,
                unitCost: costVal > 0 ? costVal : (product.costPrice || 0)
            };
            stats.counted++;
        }

        // Aplicar según targetType
        if (targetType === 'inicial') {
            const periodData = StorageManager.getPeriodData(targetPeriod);
            const currentInitial = periodData.initialInventory || {};
            Object.keys(countsByProductId).forEach(pId => {
                currentInitial[pId] = {
                    qty: countsByProductId[pId].qty,
                    unitCost: countsByProductId[pId].unitCost
                };
            });
            CMVManager.saveInitialInventory(targetPeriod, currentInitial);
        } else if (targetType === 'final') {
            const periodData = StorageManager.getPeriodData(targetPeriod);
            const currentFinal = periodData.finalInventory || {};
            Object.keys(countsByProductId).forEach(pId => {
                currentFinal[pId] = {
                    qty: countsByProductId[pId].qty
                };
            });
            CMVManager.saveFinalInventory(targetPeriod, currentFinal);
        } else if (targetType === 'snapshot') {
            const snap = {
                name: snapshotName.trim() || `Conteo Importado ${snapshotDate || new Date().toISOString().slice(0, 10)}`,
                date: snapshotDate || new Date().toISOString().slice(0, 10),
                notes: 'Importado masivamente desde Excel/CSV',
                items: countsByProductId
            };
            StorageManager.saveSnapshot(snap);
        }

        return stats;
    }
}

