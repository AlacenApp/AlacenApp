window.PurchaseManager = window.PurchaseManager || {};

window.PurchaseManager.savePurchase = async function(purchaseData) {
  if (!window.db) throw new Error("No hay conexión con Supabase");

  // 1. Obtener ID del local activo
  var localId = window.App && window.App.getLocalId ? window.App.getLocalId() : null;

  // 2. Insertar Encabezado de Compra
  var insertHeader = {
    fecha: purchaseData.date,
    proveedor_id: purchaseData.supplierId || null,
    nombre_proveedor: purchaseData.supplierName,
    numero_factura: purchaseData.invoiceNumber,
    estado_pago: purchaseData.paymentStatus,
    medio_pago: purchaseData.paymentMethod,
    fecha_pago: purchaseData.paymentDate,
    subtotal_neto: purchaseData.netSubtotal,
    monto_iva: purchaseData.ivaAmount,
    monto_iibb: purchaseData.iibbAmount,
    otros_impuestos: purchaseData.otherTaxes,
    total_factura: purchaseData.totalInvoice,
    notas: purchaseData.notes,
    local_id: localId
  };

  var resHeader = await window.db.from('Compras').insert([insertHeader]).select().single();
  if (resHeader.error) {
    throw new Error("Error al guardar encabezado de compra: " + resHeader.error.message);
  }

  var compraId = resHeader.data.id;

  // 3. Insertar Detalle de Renglones
  var detalleRows = purchaseData.items.map(function(item) {
    return {
      compra_id: compraId,
      producto_id: item.productId,
      nombre_producto: item.productName,
      cantidad: item.qty,
      costo_unitario: item.cost,
      descuento: item.discountVal || 0,
      subtotal: item.subtotal
    };
  });

  var resDetalle = await window.db.from('Compras_Detalle').insert(detalleRows);
  if (resDetalle.error) {
    throw new Error("Error al guardar ítems de la compra: " + resDetalle.error.message);
  }

  // 4. Incrementar Stock y Actualizar Costo de Referencia en la tabla Insumos
  var updateCostFlag = document.getElementById('purchaseUpdateCost')?.checked ?? true;

  for (var i = 0; i < purchaseData.items.length; i++) {
    var item = purchaseData.items[i];
    if (!item.productId) continue;

    // A. Consultar el stock y costo actual del insumo
    var tableName = 'Insumos';
    var prodRes = await window.db.from(tableName).select('current_stock, cost_price').eq('id', item.productId).maybeSingle();

    // Reintentar con tabla 'Productos' en caso de discrepancia de nombre en BD
    if (prodRes.error && prodRes.error.code === 'PGRST204') {
      tableName = 'Productos';
      prodRes = await window.db.from(tableName).select('current_stock, cost_price').eq('id', item.productId).maybeSingle();
    }

    if (prodRes.data) {
      var stockActual = parseFloat(prodRes.data.current_stock) || 0;
      var cantidadComprada = parseFloat(item.qty) || 0;
      var nuevoStock = stockActual + cantidadComprada;

      var updatePayload = {
        current_stock: nuevoStock
      };

      // Si el check de "Actualizar precio de costo en catálogo" está activo
      if (updateCostFlag && parseFloat(item.cost) > 0) {
        updatePayload.cost_price = parseFloat(item.cost);
      }

      var updateRes = await window.db.from(tableName).update(updatePayload).eq('id', item.productId);
      if (updateRes.error) {
        console.warn("Error al actualizar stock para el insumo " + item.productId + ": " + updateRes.error.message);
      }
    }
  }

  return resHeader.data;
};

window.PurchaseManager.getPurchases = async function() {
  if (!window.db) return [];
  var localId = window.App && window.App.getLocalId ? window.App.getLocalId() : null;

  var query = window.db.from('Compras').select('*').order('created_at', { ascending: false });
  if (localId) {
    query = query.eq('local_id', localId);
  }

  var res = await query;
  if (res.error) {
    console.error("Error al obtener historial de compras:", res.error);
    return [];
  }

  return (res.data || []).map(function(p) {
    return {
      id: p.id,
      date: p.fecha,
      supplier: p.nombre_proveedor,
      invoiceNumber: p.numero_factura,
      paymentStatus: p.estado_pago,
      paymentMethod: p.medio_pago,
      netSubtotal: p.subtotal_neto || 0,
      ivaAmount: p.monto_iva || 0,
      totalInvoice: p.total_factura || 0
    };
  });
};

window.PurchaseManager.deletePurchase = async function(id) {
  if (!window.db) throw new Error("No hay conexión con Supabase");

  // Opcional: Eliminar primero detalle de compras
  await window.db.from('Compras_Detalle').delete().eq('compra_id', id);
  var res = await window.db.from('Compras').delete().eq('id', id);
  
  if (res.error) {
    throw new Error("Error al eliminar compra: " + res.error.message);
  }
  return true;
};