// ==========================================
// MÓDULO INSUMOS Y CATEGORÍAS (SUPABASE REAL-TIME)
// ==========================================
window.ProductManager = {

  // Cargar insumos del local seleccionado
  async getProducts() {
    const selector = document.getElementById('selectorLocales');
    const localId = selector ? selector.value : null;
    if (!localId) return [];

    const parsedLocalId = isNaN(parseInt(localId, 10)) ? localId : parseInt(localId, 10);

    const { data, error } = await db
      .from('Insumos')
      .select('*')
      .eq('local_id', parsedLocalId)
      .order('nombre', { ascending: true });

    if (error) {
      console.error("Error Supabase (getProducts):", error.message);
      return [];
    }

    return data.map(item => ({
      id: item.id,
      code: item.codigo || '',
      name: item.nombre,
      category: item.categoria || 'Materia Prima',
      unit: item.unidad || 'kg',
      currentStock: parseFloat(item.stock_actual) || 0,
      minStock: parseFloat(item.stock_minimo) || 0,
      costPrice: parseFloat(item.precio_costo) || 0,
      salePrice: parseFloat(item.precio_venta) || 0,
      local_id: item.local_id
    }));
  },

  // Guardar (Insertar nuevo o Actualizar existente)
  async saveProduct(productData) {
    const selector = document.getElementById('selectorLocales');
    const localId = selector ? selector.value : null;
    
    if (!localId) {
      throw new Error("No hay un local activo seleccionado en el panel lateral.");
    }

    const parsedLocalId = isNaN(parseInt(localId, 10)) ? localId : parseInt(localId, 10);

    const payload = {
      codigo: productData.code || '',
      nombre: productData.name,
      categoria: productData.category || 'Materia Prima',
      unidad: productData.unit || 'kg',
      stock_actual: parseFloat(productData.currentStock) || 0,
      stock_minimo: parseFloat(productData.minStock) || 0,
      precio_costo: parseFloat(productData.costPrice) || 0,
      precio_venta: parseFloat(productData.salePrice) || 0,
      local_id: parsedLocalId
    };

    if (productData.id && productData.id.trim() !== '') {
      // EDITAR INSUMO EXISTENTE
      const { data, error } = await db
        .from('Insumos')
        .update(payload)
        .eq('id', productData.id)
        .select();

      if (error) throw new Error("Error al actualizar insumo: " + error.message);
      return data ? data[0] : null;
    } else {
      // CREAR NUEVO INSUMO
      const { data, error } = await db
        .from('Insumos')
        .insert([payload])
        .select();

      if (error) throw new Error("Error al crear insumo: " + error.message);
      return data ? data[0] : null;
    }
  },

  // Eliminar Insumo
  async deleteProduct(id) {
    const { error } = await db.from('Insumos').delete().eq('id', id);
    if (error) throw new Error("Error al eliminar insumo: " + error.message);
  },

  // Cargar Categorías
  async getCategories() {
    const selector = document.getElementById('selectorLocales');
    const localId = selector ? selector.value : null;
    if (!localId) return [];

    const parsedLocalId = isNaN(parseInt(localId, 10)) ? localId : parseInt(localId, 10);

    const { data, error } = await db
      .from('Categorias')
      .select('*')
      .eq('local_id', parsedLocalId)
      .order('nombre', { ascending: true });

    if (error) {
      console.error("Error Supabase (getCategories):", error.message);
      return [];
    }
    return data || [];
  },

  // Guardar Categoría
  async saveCategory(categoryData) {
    const selector = document.getElementById('selectorLocales');
    const localId = selector ? selector.value : null;
    if (!localId) throw new Error("No hay un local activo seleccionado.");

    const parsedLocalId = isNaN(parseInt(localId, 10)) ? localId : parseInt(localId, 10);

    const payload = {
      nombre: categoryData.name,
      descripcion: categoryData.description || '',
      local_id: parsedLocalId
    };

    if (categoryData.id && categoryData.id.trim() !== '') {
      const { data, error } = await db
        .from('Categorias')
        .update(payload)
        .eq('id', categoryData.id)
        .select();
      if (error) throw new Error("Error al actualizar categoría: " + error.message);
      return data[0];
    } else {
      const { data, error } = await db
        .from('Categorias')
        .insert([payload])
        .select();
      if (error) throw new Error("Error al crear categoría: " + error.message);
      return data[0];
    }
  }
};