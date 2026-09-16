/**
 * Purchases & Orders Manager
 * Carga de compras con impuestos, gestión de estado de pago (pagada/pendiente)
 * y generación de Órdenes de Compra (OC).
 */

class PurchaseManager {
    static getFilteredPurchases({ month = '', supplier = '', searchTerm = '', paymentStatus = 'all' } = {}) {
        let purchases = StorageManager.getPurchases();

        if (month) {
            purchases = purchases.filter(p => p.date && p.date.startsWith(month));
        }

        if (supplier) {
            purchases = purchases.filter(p => p.supplier && p.supplier.toLowerCase().includes(supplier.toLowerCase()));
        }

        if (paymentStatus && paymentStatus !== 'all') {
            purchases = purchases.filter(p => (p.paymentStatus || 'pagada') === paymentStatus);
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            purchases = purchases.filter(p => 
                (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(term)) ||
                (p.supplier && p.supplier.toLowerCase().includes(term)) ||
                (p.notes && p.notes.toLowerCase().includes(term)) ||
                (p.items && p.items.some(it => it.productName.toLowerCase().includes(term)))
            );
        }

        return purchases.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    }

    static registerPurchase(purchaseData) {
        if (!purchaseData.items || purchaseData.items.length === 0) {
            throw new Error('Debes agregar al menos un insumo o producto a la compra.');
        }

        let calculatedNet = 0;
        let totalDiscount = 0;
        for (let item of purchaseData.items) {
            if (!item.productId) throw new Error('Todos los renglones deben tener un producto seleccionado.');
            if (isNaN(item.quantity) || item.quantity <= 0) throw new Error(`Cantidad inválida para ${item.productName}.`);
            if (isNaN(item.unitCost) || item.unitCost < 0) throw new Error(`Costo unitario inválido para ${item.productName}.`);
            
            const gross = Number((item.quantity * item.unitCost).toFixed(2));
            const discVal = Number(item.discountAmount || (item.discountPercent ? gross * (item.discountPercent / 100) : 0));
            item.discountPercent = Number(item.discountPercent || 0);
            item.discountAmount = Number(discVal.toFixed(2));
            item.subtotal = Math.max(0, Number((gross - discVal).toFixed(2)));
            calculatedNet += item.subtotal;
            totalDiscount += item.discountAmount;
        }

        purchaseData.netSubtotal = Number(calculatedNet.toFixed(2));
        purchaseData.totalDiscount = Number(totalDiscount.toFixed(2));
        
        const ivaRate = Number(purchaseData.ivaRate || 0);
        const ivaAmount = (purchaseData.ivaAmount !== undefined && purchaseData.ivaAmount !== null)
            ? Number(purchaseData.ivaAmount)
            : Number((calculatedNet * (ivaRate / 100)).toFixed(2));

        const iibbAmount = Number(purchaseData.iibbAmount || 0);
        const ivaPerception = Number(purchaseData.ivaPerception || 0);
        const otherTaxes = Number(purchaseData.otherTaxes || 0);

        purchaseData.ivaAmount = ivaAmount;
        purchaseData.totalInvoice = Number((calculatedNet + ivaAmount + iibbAmount + ivaPerception + otherTaxes).toFixed(2));
        purchaseData.totalCost = purchaseData.totalInvoice;

        return StorageManager.addPurchase(purchaseData);
    }

    static exportPurchasesToCSV(monthFilter = '', paymentStatusFilter = 'all') {
        const purchases = this.getFilteredPurchases({ month: monthFilter, paymentStatus: paymentStatusFilter });
        const settings = StorageManager.getSettings();
        const curr = settings.currency || '$';

        let csv = `REGISTRO DE FACTURAS Y ESTADO DE PAGOS - ${settings.businessName}\r\n`;
        if (monthFilter) csv += `Periodo: ${monthFilter}\r\n`;
        csv += `Generado el: ${new Date().toLocaleDateString()}\r\n\r\n`;

        const headers = [
            'ID Compra',
            'Fecha Factura',
            'Nro Comprobante',
            'Proveedor',
            'Estado Pago',
            'Fecha Pago',
            'Medio Pago',
            'Renglones',
            'Subtotal Neto ($)',
            'Alicuota IVA (%)',
            'Monto IVA ($)',
            'Percep. IIBB ($)',
            'Percep. IVA ($)',
            'Otros Tributos ($)',
            'TOTAL FACTURA ($)',
            'Observaciones'
        ];
        csv += headers.map(h => `"${h}"`).join(';') + '\r\n';

        purchases.forEach(p => {
            const row = [
                p.id,
                p.date,
                p.invoiceNumber || 'S/N',
                p.supplier,
                (p.paymentStatus === 'pendiente' ? 'Pendiente de Pago' : 'Pagada'),
                p.paymentDate || '-',
                p.paymentMethod || 'Efectivo',
                (p.items || []).length,
                p.netSubtotal || p.totalCost,
                p.ivaRate || 0,
                p.ivaAmount || 0,
                p.iibbAmount || 0,
                p.ivaPerception || 0,
                p.otherTaxes || 0,
                p.totalInvoice || p.totalCost,
                p.notes || ''
            ];
            csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + '\r\n';
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Facturas_Pagos_${monthFilter || 'Historico'}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
