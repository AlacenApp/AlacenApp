// ==========================================
// MÓDULO INSUMOS Y CATEGORÍAS (SUPABASE)
// ==========================================
window.ProductManager = {

  // Cargar insumos del local seleccionado
  async getProducts() {
    const localId = document.getElementById('selectorLocales')?.value;
    if (!localId) return [];

    const { data, error } = await db
      .from('Insumos')
      .select('*')
      .eq('local_id', localId)
      .order('nombre', { ascending: true });

    if (error) {
      console.error("Error al obtener insumos:", error.message);
      return [];
    }

    return data.map(item => ({
      id: item.id,
      code: item.codigo,
      name: item.nombre,
      category: item.categoria,
      unit: item.unidad,
      currentStock: parseFloat(item.stock_actual) || 0,
      minStock: parseFloat(item.stock_minimo) || 0,
      costPrice: parseFloat(item.precio_costo) || 0,
      salePrice: parseFloat(item.precio_venta) || 0,
      local_id: item.local_id
    }));
  },

  // Guardar o Actualizar Insumo
  async saveProduct(productData) {
    const localId = document.getElementById('selectorLocales')?.value;
    if (!localId) throw new Error("Debes seleccionar un local activo");

    const payload = {
      codigo: productData.code || '',
      nombre: productData.name,
      categoria: productData.category || 'Materia Prima',
      unidad: productData.unit || 'kg',
      stock_actual: parseFloat(productData.currentStock) || 0,
      stock_minimo: parseFloat(productData.minStock) || 0,
      precio_costo: parseFloat(productData.costPrice) || 0,
      precio_venta: parseFloat(productData.salePrice) || 0,
      local_id: localId
    };

    if (productData.id) payload.id = productData.id;

    const { data, error } = await db
      .from('Insumos')
      .upsert(payload)
      .select();

    if (error) throw new Error("Error al guardar insumo: " + error.message);
    return data[0];
  },

  // Eliminar Insumo
  async deleteProduct(id) {
    const { error } = await db.from('Insumos').delete().eq('id', id);
    if (error) throw new Error("Error al eliminar insumo: " + error.message);
  },

  // Cargar Categorías del local
  async getCategories() {
    const localId = document.getElementById('selectorLocales')?.value;
    if (!localId) return [];

    const { data, error } = await db
      .from('Categorias')
      .select('*')
      .eq('local_id', localId)
      .order('nombre', { ascending: true });

    if (error) {
      console.error("Error al obtener categorías:", error.message);
      return [];
    }
    return data;
  },

  // Guardar Categoría
  async saveCategory(categoryData) {
    const localId = document.getElementById('selectorLocales')?.value;
    if (!localId) throw new Error("Debes seleccionar un local activo");

    const payload = {
      nombre: categoryData.name,
      descripcion: categoryData.description || '',
      local_id: localId
    };

    if (categoryData.id) payload.id = categoryData.id;

    const { data, error } = await db
      .from('Categorias')
      .upsert(payload)
      .select();

    if (error) throw new Error("Error al guardar categoría: " + error.message);
    return data[0];
  },

  // Eliminar Categoría
  async deleteCategory(id) {
    const { error } = await db.from('Categorias').delete().eq('id', id);
    if (error) throw new Error("Error al eliminar categoría: " + error.message);
  }
};