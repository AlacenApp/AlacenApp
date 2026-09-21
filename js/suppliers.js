// ==========================================
// MÓDULO PROVEEDORES (FILTRADO STRICTO POR LOCAL)
// ==========================================
window.SupplierManager = {

  // Obtener solo los proveedores pertenecientes al local seleccionado
  async getSuppliers() {
    const localId = window.App ? window.App.getLocalId() : null;
    if (!localId) return [];

    const { data, error } = await db
      .from('Proveedores')
      .select('*')
      .eq('local_id', localId)
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

  // Guardar vinculando obligatoriamente el local activo
  async saveSupplier(supplierData) {
    const localId = window.App ? window.App.getLocalId() : null;

    if (!localId) throw new Error("No hay un local activo seleccionado.");

    const payload = {
      nombre: supplierData.name,
      cuit: supplierData.cuit || '',
      rubro: supplierData.category || '',
      telefono: supplierData.phone || '',
      email: supplierData.email || '',
      condicion_pago: supplierData.paymentMethods || 'A convenir',
      contacto: supplierData.contactPerson || '',
      local_id: localId
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