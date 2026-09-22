// ==========================================
// MÓDULO COMPRAS Y FACTURACIÓN (SUPABASE)
// ==========================================
window.PurchaseManager = {

  // Obtener facturas de compra del local activo
  async getPurchases() {
    const localId = window.App ? window.App.getLocalId() : null;
    if (!localId) return [];

    const { data, error } = await db
      .from('Compras')
      .select('*, Compras_Detalle(*)')
      .eq('local_id', localId)
      .order('fecha', { ascending: false });

    if (error) {
      console.error("Error Supabase (getPurchases):", error.message);
      return [];
    }

    return data.map(p => ({
      id: p.id,
      date: p.fecha,
      supplierId: p.proveedor_id,
      supplier: p.proveedor_nombre || 'Sin Proveedor',
      invoiceNumber: p.numero_factura || 'S/N',
      paymentStatus: p.estado_pago || 'pagada',
      paymentMethod: p.metodo_pago || 'Efectivo',
      paymentDate: p.fecha_pago || p.fecha,
      netSubtotal: parseFloat(p.subtotal_neto) || 0,
      ivaAmount: parseFloat(p.monto_iva) || 0,
      iibbAmount: parseFloat(p.monto_iibb) || 0,
      otherTaxes: parseFloat(p.otros_impuestos) || 0,
      totalInvoice: parseFloat(p.total_factura) || 0,
      notes: p.notas || '',
      items: (p.Compras_Detalle || []).map(d => ({
        productId: d.insumo_id,
        productName: d.insumo_nombre,
        qty: parseFloat(d.cantidad) || 0,
        cost: parseFloat(d.costo_unitario_neto) || 0,
        discountVal: parseFloat(d.descuento_valor) || 0,
        subtotal: parseFloat(d.subtotal_neto) || 0
      }))
    }));
  },

  // Registrar compra, renglones y actualizar stock en Supabase
  async savePurchase(purchaseData) {
    const localId = window.App ? window.App.getLocalId() : null;
    if (!localId) throw new Error("No hay un local activo seleccionado.");

    // 1. Guardar la cabecera de la factura
    const payloadHeader = {
      fecha: purchaseData.date,
      proveedor_id: purchaseData.supplierId || null,
      proveedor_nombre: purchaseData.supplierName || 'Sin Proveedor',
      numero_factura: purchaseData.invoiceNumber || '',
      estado_pago: purchaseData.paymentStatus || 'pagada',
      metodo_pago: purchaseData.paymentMethod || 'Efectivo',
      fecha_pago: purchaseData.paymentDate || purchaseData.date,
      subtotal_neto: parseFloat(purchaseData.netSubtotal) || 0,
      monto_iva: parseFloat(purchaseData.ivaAmount) || 0,
      monto_iibb: parseFloat(purchaseData.iibbAmount) || 0,
      otros_impuestos: parseFloat(purchaseData.otherTaxes) || 0,
      total_factura: parseFloat(purchaseData.totalInvoice) || 0,
      notas: purchaseData.notes || '',
      local_id: localId
    };

    const { data: header, error: headerErr } = await db
      .from('Compras')
      .insert([payloadHeader])
      .select();

    if (headerErr) throw new Error("Error al guardar encabezado de compra: " + headerErr.message);

    const purchaseId = header[0].id;

    // 2. Insertar renglones e incrementar stock de insumos
    if (purchaseData.items && purchaseData.items.length > 0) {
      const payloadDetails = purchaseData.items.map(item => ({
        compra_id: purchaseId,
        insumo_id: item.productId || null,
        insumo_nombre: item.productName || '',
        cantidad: parseFloat(item.qty) || 0,
        costo_unitario_neto: parseFloat(item.cost) || 0,
        descuento_valor: parseFloat(item.discountVal) || 0,
        subtotal_neto: parseFloat(item.subtotal) || 0
      }));

      const { error: detailErr } = await db.from('Compras_Detalle').insert(payloadDetails);
      if (detailErr) throw new Error("Error al guardar ítems de la compra: " + detailErr.message);

      // 3. Actualizar stock y costo de referencia para cada insumo
      for (const item of purchaseData.items) {
        if (!item.productId) continue;

        // Consultar stock actual
        const { data: prodData } = await db
          .from('Insumos')
          .select('stock_actual')
          .eq('id', item.productId)
          .maybeSingle();

        const stockActual = prodData ? parseFloat(prodData.stock_actual) || 0 : 0;
        const nuevoStock = stockActual + (parseFloat(item.qty) || 0);
        const nuevoCosto = parseFloat(item.cost) || 0;

        await db
          .from('Insumos')
          .update({
            stock_actual: nuevoStock,
            precio_costo: nuevoCosto > 0 ? nuevoCosto : undefined
          })
          .eq('id', item.productId);
      }
    }

    return header[0];
  },

  // Eliminar Factura de Compra
  async deletePurchase(id) {
    const { error } = await db.from('Compras').delete().eq('id', id);
    if (error) throw new Error("Error al eliminar la compra: " + error.message);
  }
};