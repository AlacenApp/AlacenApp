// ==========================================
// MÓDULO PROVEEDORES (SUPABASE)
// ==========================================
window.SupplierManager = {

  // Obtener proveedores del local activo
  async getSuppliers() {
    const selector = document.getElementById('selectorLocales');
    const localId = selector ? selector.value : null;
    if (!localId) return [];

    const parsedLocalId = isNaN(parseInt(localId, 10)) ? localId : parseInt(localId, 10);

    const { data, error } = await db
      .from('Proveedores')
      .select('*')
      .eq('local_id', parsedLocalId)
      .order('nombre', { ascending: true });

    if (error) {
      console.error("Error Supabase (getSuppliers):", error.message);
      return [];
    }

    return data.map(item => ({
      id: item.id,
      name: item.nombre,
      cuit: item.cuit || '',
      category: item.rubro || '',
      phone: item.telefono || '',
      email: item.email || '',
      paymentMethods: item.condicion_pago || 'A convenir',
      contactPerson: item.contacto || '',
      local_id: item.local_id
    }));
  },

  // Guardar o Actualizar Proveedor
  async saveSupplier(supplierData) {
    const selector = document.getElementById('selectorLocales');
    const localId = selector ? selector.value : null;

    if (!localId) throw new Error("No hay un local activo seleccionado.");

    const parsedLocalId = isNaN(parseInt(localId, 10)) ? localId : parseInt(localId, 10);

    const payload = {
      nombre: supplierData.name,
      cuit: supplierData.cuit || '',
      rubro: supplierData.category || '',
      telefono: supplierData.phone || '',
      email: supplierData.email || '',
      condicion_pago: supplierData.paymentMethods || 'A convenir',
      contacto: supplierData.contactPerson || '',
      local_id: parsedLocalId
    };

    if (supplierData.id && supplierData.id.trim() !== '') {
      const { data, error } = await db
        .from('Proveedores')
        .update(payload)
        .eq('id', supplierData.id)
        .select();

      if (error) throw new Error("Error al actualizar proveedor: " + error.message);
      return data ? data[0] : null;
    } else {
      const { data, error } = await db
        .from('Proveedores')
        .insert([payload])
        .select();

      if (error) throw new Error("Error al crear proveedor: " + error.message);
      return data ? data[0] : null;
    }
  },

  // Eliminar Proveedor
  async deleteSupplier(id) {
    const { error } = await db.from('Proveedores').delete().eq('id', id);
    if (error) throw new Error("Error al eliminar proveedor: " + error.message);
  }
};