// ============================================================
// BrandCraft - Lógica principal con Auth, Roles y Acceso
// ============================================================

const SUPABASE_URL = "https://evsphcaefebrytvdmveg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2c3BoY2FlZmVicnl0dmRtdmVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDU2MzE2MywiZXhwIjoyMTA2MTM5MTYzfQ.m8JsnueqUt6FSROP0M_-2fqYoT6xSNdMkPHHHC053TI";

// Cliente Supabase singleton
let _supabaseClient = null;
const getSupabaseClient = () => {
  if (_supabaseClient) return _supabaseClient;
  if (window.supabase && typeof window.supabase.createClient === "function") {
    _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return _supabaseClient;
  }
  return null;
};

const { createApp, ref, computed, onMounted, watch } = Vue;

const app = createApp({
  setup() {

    // ══════════════════════════════════════════════
    // 1. ESTADO REACTIVO
    // ══════════════════════════════════════════════
    const brands = ref([]);
    const currentBrandId = ref("");
    const activeTab = ref("overview");
    const isPortalMode = ref(false);
    const searchQuery = ref("");
    const searchFilter = ref("all");
    const cloudStatus = ref("connecting");
    let syncTimeout = null;

    // AUTH
    const currentUser = ref(null);       // { id, email, full_name, role }
    const authLoading = ref(true);        // spinner de carga inicial
    const loginEmail = ref("");
    const loginPassword = ref("");
    const loginError = ref("");
    const loginLoading = ref(false);
    const showLogin = ref(true);          // pantalla de login visible?

    // ADMIN: gestión de usuarios
    const usersList = ref([]);
    const brandAccessMap = ref({});       // { userId: [brandId, ...] }
    const newUserModal = ref({ isOpen: false, email: "", fullName: "", role: "viewer" });
    const adminError = ref("");
    const adminLoading = ref(false);

    // Spotlight
    const isSpotlightOpen = ref(false);
    const spotlightQuery = ref("");

    // Typography Tester
    const typeTesterText = ref("La identidad visual comunica sin palabras.");
    const typeTesterSize = ref(24);

    // Toast
    const toast = ref({ show: false, message: "", type: "success" });

    // Modales de marca
    const brandModal = ref({ isOpen: false, isEditing: false, data: { name: "", tagline: "", industry: "", website: "", summary: "", mission: "", vision: "", archetype: "" } });
    const colorModal = ref({ isOpen: false, isEditing: false, data: { id: "", name: "", category: "Primario", hex: "#0284c7", rgb: "rgb(2, 132, 199)", cmyk: "C:84 M:38 Y:0 K:0", pantone: "Pantone 2192 C", usage: "", isLight: false } });
    const procedureModal = ref({ isOpen: false, isEditing: false, data: { id: "", code: "", title: "", category: "", role: "", estimatedTime: "", summary: "", guidelines: "", tagsInput: "", checklistInput: "" } });
    const processModal = ref({ isOpen: false, isEditing: false, data: { id: "", code: "", title: "", category: "", owner: "", purpose: "", steps: [{ stepNumber: 1, title: "", responsible: "", input: "", output: "", duration: "", status: "Pendiente" }] } });
    const selectedProcessStep = ref(null);

    // ══════════════════════════════════════════════
    // 2. COMPUTED
    // ══════════════════════════════════════════════
    const isAdmin = computed(() => currentUser.value?.role === "admin");

    const availableBrands = computed(() => {
      if (isAdmin.value) return brands.value;
      const allowed = brandAccessMap.value[currentUser.value?.id] || [];
      const filtered = brands.value.filter(b => allowed.includes(b.id));
      return filtered.length > 0 ? filtered : (brands.value.length > 0 ? [brands.value[0]] : []);
    });

    const currentBrand = computed(() => {
      const list = availableBrands.value;
      return list.find(b => b.id === currentBrandId.value) || list[0] || null;
    });

    const stats = computed(() => {
      if (!currentBrand.value) return { colors: 0, sops: 0, procs: 0, sopProgress: 0 };
      const b = currentBrand.value;
      const total = b.procedures?.reduce((a, p) => a + (p.checklist?.length || 0), 0) || 0;
      const done  = b.procedures?.reduce((a, p) => a + (p.checklist?.filter(c => c.done).length || 0), 0) || 0;
      return {
        colors: b.colors?.length || 0,
        sops: b.procedures?.length || 0,
        procs: b.processes?.length || 0,
        sopProgress: total > 0 ? Math.round((done / total) * 100) : 0
      };
    });

    const searchResults = computed(() => {
      if (!currentBrand.value) return [];
      const q = (searchQuery.value || spotlightQuery.value || "").toLowerCase().trim();
      if (!q) return [];
      const b = currentBrand.value;
      const results = [];
      const add = (type, tab, title, subtitle, badgeColor) =>
        results.push({ type, tab, title, subtitle, badgeColor });

      if (["all", "colors"].includes(searchFilter.value)) {
        (b.colors || []).forEach(c => {
          if ([c.name, c.hex, c.category, c.usage].join(" ").toLowerCase().includes(q))
            add("Color", "colors", `${c.name} (${c.hex})`, c.usage || c.category, "bg-blue-100 text-blue-700");
        });
      }
      if (["all", "procedures"].includes(searchFilter.value)) {
        (b.procedures || []).forEach(p => {
          if ([p.title, p.code, p.role, ...(p.tags || [])].join(" ").toLowerCase().includes(q))
            add("Procedimiento", "procedures", `${p.code || ""}: ${p.title}`, `Rol: ${p.role || "—"}`, "bg-amber-100 text-amber-700");
        });
      }
      if (["all", "processes"].includes(searchFilter.value)) {
        (b.processes || []).forEach(p => {
          if ([p.title, p.owner, ...(p.steps || []).map(s => s.title)].join(" ").toLowerCase().includes(q))
            add("Proceso", "processes", `${p.code || ""}: ${p.title}`, `Owner: ${p.owner || "—"}`, "bg-emerald-100 text-emerald-700");
        });
      }
      if (["all", "identity"].includes(searchFilter.value) && b.identity) {
        if (b.identity.mission?.toLowerCase().includes(q)) add("Identidad", "identity", "Misión", b.identity.mission, "bg-purple-100 text-purple-700");
        if (b.identity.vision?.toLowerCase().includes(q)) add("Identidad", "identity", "Visión", b.identity.vision, "bg-purple-100 text-purple-700");
        (b.identity.values || []).forEach(v => {
          if ([v.title, v.desc].join(" ").toLowerCase().includes(q))
            add("Valor", "identity", v.title, v.desc, "bg-purple-100 text-purple-700");
        });
      }
      return results;
    });

    // ══════════════════════════════════════════════
    // 3. UTILIDADES
    // ══════════════════════════════════════════════
    const showToast = (message, type = "success") => {
      toast.value = { show: true, message, type };
      setTimeout(() => { toast.value.show = false; }, 3200);
    };

    const copyToClipboard = async (text, label = "Dato") => {
      try {
        await navigator.clipboard.writeText(text);
        showToast(`${label} copiado: "${text}"`, "success");
      } catch {
        const t = document.createElement("textarea");
        t.value = text; document.body.appendChild(t); t.select();
        document.execCommand("copy"); document.body.removeChild(t);
        showToast(`${label} copiado`, "success");
      }
    };

    const selectSearchResult = (item) => {
      activeTab.value = item.tab;
      isSpotlightOpen.value = false;
      spotlightQuery.value = "";
    };

    const hexToRgb = (hex) => {
      let c = hex.replace("#", "");
      if (c.length === 3) c = c.split("").map(x => x + x).join("");
      const n = parseInt(c, 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    const hexToCmyk = (hex) => {
      let c = hex.replace("#", "");
      if (c.length === 3) c = c.split("").map(x => x + x).join("");
      const n = parseInt(c, 16);
      let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const k = 1 - Math.max(r, g, b);
      if (k === 1) return "C:0 M:0 Y:0 K:100";
      return `C:${Math.round(((1-r-k)/(1-k))*100)} M:${Math.round(((1-g-k)/(1-k))*100)} Y:${Math.round(((1-b-k)/(1-k))*100)} K:${Math.round(k*100)}`;
    };
    const isLightColor = (hex) => {
      let c = hex.replace("#", "");
      if (c.length === 3) c = c.split("").map(x => x + x).join("");
      const n = parseInt(c, 16);
      return ((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114 > 155000;
    };
    const onColorHexInput = () => {
      const h = colorModal.value.data.hex;
      if (/^#[0-9A-Fa-f]{6}$/.test(h) || /^#[0-9A-Fa-f]{3}$/.test(h)) {
        colorModal.value.data.rgb = hexToRgb(h);
        colorModal.value.data.cmyk = hexToCmyk(h);
        colorModal.value.data.isLight = isLightColor(h);
      }
    };

    const toggleChecklistItem = (procedure, idx) => {
      if (procedure.checklist?.[idx]) {
        procedure.checklist[idx].done = !procedure.checklist[idx].done;
        saveToStorage();
      }
    };

    // ══════════════════════════════════════════════
    // 4. AUTH — Login, Logout, Sesión
    // ══════════════════════════════════════════════
    const loadUserProfile = async (user) => {
      const client = getSupabaseClient();
      if (!user) return null;
      const uid = user.id || user;

      if (client) {
        try {
          const { data, error } = await client.from("profiles").select("*").eq("id", uid).single();
          if (!error && data) return data;
        } catch(e) {}
      }

      if (user && user.user_metadata) {
        return {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata.full_name || (user.email ? user.email.split('@')[0] : "Usuario"),
          role: user.user_metadata.role || "viewer"
        };
      }
      return null;
    };

    const login = async () => {
      if (!loginEmail.value || !loginPassword.value) {
        loginError.value = "Ingresa tu correo y contraseña.";
        return;
      }
      loginLoading.value = true;
      loginError.value = "";
      const client = getSupabaseClient();
      if (!client) {
        loginError.value = "Sin conexión a la nube.";
        loginLoading.value = false;
        return;
      }
      const { data, error } = await client.auth.signInWithPassword({
        email: loginEmail.value.trim(),
        password: loginPassword.value
      });
      loginLoading.value = false;
      if (error) {
        loginError.value = "Credenciales incorrectas. Verifica correo y contraseña.";
        return;
      }
      const profile = await loadUserProfile(data.user);
      if (!profile) {
        loginError.value = "Tu perfil aún no está activado. Contacta al administrador.";
        await client.auth.signOut();
        return;
      }
      currentUser.value = { ...profile };
      showLogin.value = false;
      loginPassword.value = "";
      await loadFromSupabase();
      if (profile.role === "admin") await loadUsersAndAccess();
      showToast(`¡Bienvenido, ${profile.full_name || profile.email}!`, "success");
    };

    const logout = async () => {
      const client = getSupabaseClient();
      if (client) await client.auth.signOut();
      currentUser.value = null;
      brands.value = [];
      showLogin.value = true;
      loginEmail.value = "";
      loginPassword.value = "";
      loginError.value = "";
      activeTab.value = "overview";
    };

    const checkExistingSession = async () => {
      authLoading.value = true;
      const client = getSupabaseClient();
      if (!client) { authLoading.value = false; showLogin.value = true; return; }
      const { data: { session } } = await client.auth.getSession();
      if (session?.user) {
        const profile = await loadUserProfile(session.user);
        if (profile) {
          currentUser.value = { ...profile };
          showLogin.value = false;
          await loadFromSupabase();
          if (profile.role === "admin") await loadUsersAndAccess();
        } else {
          showLogin.value = true;
        }
      } else {
        showLogin.value = true;
      }
      authLoading.value = false;
    };

    // ══════════════════════════════════════════════
    // 5. ADMIN — Gestión de Usuarios y Accesos
    // ══════════════════════════════════════════════
    const loadUsersAndAccess = async () => {
      const client = getSupabaseClient();
      if (!client || !isAdmin.value) return;
      adminLoading.value = true;

      try {
        const { data: authData } = await client.auth.admin.listUsers();
        if (authData?.users && authData.users.length > 0) {
          usersList.value = authData.users.map(u => ({
            id: u.id,
            email: u.email,
            full_name: u.user_metadata?.full_name || u.email.split('@')[0],
            role: u.user_metadata?.role || "viewer",
            created_at: u.created_at
          }));
        } else {
          const { data: profiles } = await client.from("profiles").select("*").order("created_at");
          usersList.value = profiles || [];
        }

        const { data: accesses } = await client.from("brand_access").select("*");
        const map = {};
        if (accesses) {
          accesses.forEach(a => {
            if (!map[a.user_id]) map[a.user_id] = [];
            map[a.user_id].push(a.brand_id);
          });
        }
        const storedAccess = localStorage.getItem("brandcraft_user_access");
        if (storedAccess) {
          try {
            const parsed = JSON.parse(storedAccess);
            for (const k in parsed) {
              if (!map[k]) map[k] = parsed[k];
            }
          } catch(e) {}
        }
        brandAccessMap.value = map;
      } catch (err) {
        console.error("Error al cargar usuarios y accesos:", err);
      } finally {
        adminLoading.value = false;
      }
    };

    const openNewUserModal = () => {
      newUserModal.value = { isOpen: true, email: "", fullName: "", role: "viewer" };
      adminError.value = "";
    };

    const createUser = async () => {
      if (!newUserModal.value.email) { adminError.value = "El email es obligatorio."; return; }
      adminLoading.value = true;
      adminError.value = "";
      const client = getSupabaseClient();

      // Crear usuario via Admin API (service_role key lo permite)
      const { data, error } = await client.auth.admin.createUser({
        email: newUserModal.value.email,
        password: "BrandCraft2026!",  // contraseña temporal
        email_confirm: true,
        user_metadata: {
          full_name: newUserModal.value.fullName,
          role: newUserModal.value.role
        }
      });

      if (error) {
        adminError.value = "Error al crear usuario: " + error.message;
        adminLoading.value = false;
        return;
      }

      // Crear perfil manualmente si el trigger no lo hizo
      await client.from("profiles").upsert({
        id: data.user.id,
        email: newUserModal.value.email,
        full_name: newUserModal.value.fullName,
        role: newUserModal.value.role
      });

      adminLoading.value = false;
      newUserModal.value.isOpen = false;
      await loadUsersAndAccess();
      showToast(`Usuario ${newUserModal.value.email} creado. Contraseña temporal: BrandCraft2026!`, "success");
    };

    const toggleUserRole = async (user) => {
      const newRole = user.role === "admin" ? "viewer" : "admin";
      const client = getSupabaseClient();
      if (!client) return;
      await client.from("profiles").update({ role: newRole }).eq("id", user.id);
      user.role = newRole;
      showToast(`Rol de ${user.email} cambiado a ${newRole}`, "success");
    };

    const deleteUser = async (user) => {
      if (!confirm(`¿Eliminar al usuario "${user.email}"? Esta acción no se puede deshacer.`)) return;
      const client = getSupabaseClient();
      if (!client) return;
      await client.auth.admin.deleteUser(user.id);
      await loadUsersAndAccess();
      showToast(`Usuario ${user.email} eliminado`, "info");
    };

    const toggleBrandAccess = async (userId, brandId) => {
      const client = getSupabaseClient();
      if (!client) return;
      const current = brandAccessMap.value[userId] || [];
      const hasAccess = current.includes(brandId);
      if (hasAccess) {
        await client.from("brand_access").delete().eq("user_id", userId).eq("brand_id", brandId);
        brandAccessMap.value[userId] = current.filter(id => id !== brandId);
      } else {
        await client.from("brand_access").insert({ user_id: userId, brand_id: brandId });
        if (!brandAccessMap.value[userId]) brandAccessMap.value[userId] = [];
        brandAccessMap.value[userId].push(brandId);
      }
      showToast("Acceso de marca actualizado", "success");
    };

    const userHasBrandAccess = (userId, brandId) =>
      (brandAccessMap.value[userId] || []).includes(brandId);

    // ══════════════════════════════════════════════
    // 6. DATOS — Storage y Supabase
    // ══════════════════════════════════════════════
    const saveToStorage = () => {
      try {
        localStorage.setItem("brandcraft_brands", JSON.stringify(brands.value));
        if (currentBrandId.value) localStorage.setItem("brandcraft_current_id", currentBrandId.value);
      } catch (e) { console.error(e); }
    };

    const loadFromStorage = () => {
      const stored = localStorage.getItem("brandcraft_brands");
      if (stored) {
        brands.value = JSON.parse(stored);
      } else if (window.DEFAULT_BRANDS?.length > 0) {
        brands.value = JSON.parse(JSON.stringify(window.DEFAULT_BRANDS));
        saveToStorage();
      }
      const lastId = localStorage.getItem("brandcraft_current_id");
      if (lastId && brands.value.some(b => b.id === lastId)) currentBrandId.value = lastId;
      else if (brands.value.length > 0) currentBrandId.value = brands.value[0].id;
    };

    const mapSupabaseRow = (b) => ({
      id: b.id, name: b.name, tagline: b.tagline || "", industry: b.industry || "",
      website: b.website || "", status: b.status || "Activo", summary: b.summary || "",
      identity: b.identity || {}, logos: b.logos || [], logoRules: b.logo_rules || [],
      colors: b.colors || [], typography: b.typography || {},
      procedures: b.procedures || [], processes: b.processes || []
    });

    const loadFromSupabase = async () => {
      const client = getSupabaseClient();
      if (!client) { cloudStatus.value = "offline"; return; }
      cloudStatus.value = "syncing";
      try {
        const { data, error } = await client.from("brands").select("*").order("created_at");
        if (error) { cloudStatus.value = "error"; return; }
        if (data?.length > 0) {
          brands.value = data.map(mapSupabaseRow);
          if (!brands.value.some(b => b.id === currentBrandId.value))
            currentBrandId.value = brands.value[0]?.id || "";
          saveToStorage();
        } else if (isAdmin.value && brands.value.length > 0) {
          await syncAllBrandsToSupabase();
        }
        cloudStatus.value = "synced";
      } catch { cloudStatus.value = "offline"; }
    };

    const syncBrandToSupabase = async (brand) => {
      const client = getSupabaseClient();
      if (!client || !brand || !isAdmin.value) return;
      cloudStatus.value = "syncing";
      const { error } = await client.from("brands").upsert({
        id: brand.id, name: brand.name, tagline: brand.tagline, industry: brand.industry,
        website: brand.website, status: brand.status, summary: brand.summary,
        identity: brand.identity, logos: brand.logos, logo_rules: brand.logoRules,
        colors: brand.colors, typography: brand.typography,
        procedures: brand.procedures, processes: brand.processes,
        updated_at: new Date().toISOString()
      });
      cloudStatus.value = error ? "error" : "synced";
    };

    const syncAllBrandsToSupabase = async () => {
      if (!isAdmin.value) return;
      cloudStatus.value = "syncing";
      for (const b of brands.value) await syncBrandToSupabase(b);
      cloudStatus.value = "synced";
      showToast("Todos los manuales respaldados en Supabase", "success");
    };

    const deleteBrandFromSupabase = async (id) => {
      const client = getSupabaseClient();
      if (client && isAdmin.value) await client.from("brands").delete().eq("id", id);
    };

    const triggerCloudSync = () => {
      if (!isAdmin.value) return;
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        if (currentBrand.value) syncBrandToSupabase(currentBrand.value);
      }, 1200);
    };

    // ══════════════════════════════════════════════
    // 7. CRUD — Marcas, Colores, SOPs, Procesos
    // ══════════════════════════════════════════════
    const openNewBrandModal = () => brandModal.value = { isOpen: true, isEditing: false, data: { name: "", tagline: "", industry: "", website: "", summary: "", mission: "", vision: "", archetype: "El Creador" } };

    const openEditBrandModal = () => {
      if (!currentBrand.value) return;
      const b = currentBrand.value;
      brandModal.value = { isOpen: true, isEditing: true, data: { name: b.name, tagline: b.tagline || "", industry: b.industry || "", website: b.website || "", summary: b.summary || "", mission: b.identity?.mission || "", vision: b.identity?.vision || "", archetype: b.identity?.archetype || "" } };
    };

    const saveBrand = () => {
      const d = brandModal.value.data;
      if (!d.name.trim()) { alert("El nombre de la marca es obligatorio."); return; }
      if (brandModal.value.isEditing) {
        const b = currentBrand.value;
        Object.assign(b, { name: d.name, tagline: d.tagline, industry: d.industry, website: d.website, summary: d.summary });
        if (!b.identity) b.identity = {};
        Object.assign(b.identity, { mission: d.mission, vision: d.vision, archetype: d.archetype });
        showToast("Marca actualizada", "success");
      } else {
        const newId = "brand-" + Date.now();
        brands.value.push({
          id: newId, name: d.name, tagline: d.tagline, industry: d.industry, website: d.website,
          status: "Activo", summary: d.summary, createdDate: new Date().toISOString().split("T")[0],
          identity: { mission: d.mission, vision: d.vision, archetype: d.archetype, values: [], toneAndVoice: { weAre: [], weAreNot: [], attributes: [] } },
          logos: [], logoRules: [], colors: [], typography: { display: { name: "Space Grotesk", source: "Google Fonts", weights: "Bold (700)", usage: "Títulos principales.", sampleText: "Titular de Impacto" }, body: { name: "Plus Jakarta Sans", source: "Google Fonts", weights: "Regular (400), SemiBold (600)", usage: "Cuerpo y documentación.", sampleText: "Texto de lectura ágil." }, mono: { name: "JetBrains Mono", source: "Google Fonts", weights: "Regular (400)", usage: "Códigos y métricas.", sampleText: "COD: #2563eb" }, scale: [] }, procedures: [], processes: []
        });
        currentBrandId.value = newId;
        showToast("Nueva marca creada", "success");
      }
      saveToStorage();
      brandModal.value.isOpen = false;
    };

    const deleteCurrentBrand = () => {
      if (brands.value.length <= 1) { alert("No puedes eliminar la única marca activa."); return; }
      if (confirm(`¿Eliminar permanentemente "${currentBrand.value.name}"?`)) {
        const id = currentBrandId.value;
        const idx = brands.value.findIndex(b => b.id === id);
        brands.value.splice(idx, 1);
        currentBrandId.value = brands.value[0].id;
        saveToStorage();
        deleteBrandFromSupabase(id);
        showToast("Marca eliminada", "info");
      }
    };

    const openAddColorModal = () => { colorModal.value = { isOpen: true, isEditing: false, data: { id: "col-" + Date.now(), name: "", category: "Primario", hex: "#3b82f6", rgb: "rgb(59,130,246)", cmyk: "C:76 M:47 Y:0 K:4", pantone: "Pantone 2174 C", usage: "", isLight: false } }; onColorHexInput(); };
    const openEditColorModal = (c) => { colorModal.value = { isOpen: true, isEditing: true, data: { ...c } }; };
    const saveColor = () => {
      if (!colorModal.value.data.name || !colorModal.value.data.hex) { alert("Nombre y HEX requeridos."); return; }
      if (!currentBrand.value.colors) currentBrand.value.colors = [];
      if (colorModal.value.isEditing) {
        const idx = currentBrand.value.colors.findIndex(c => c.id === colorModal.value.data.id);
        if (idx !== -1) currentBrand.value.colors[idx] = { ...colorModal.value.data };
        showToast("Color actualizado", "success");
      } else {
        currentBrand.value.colors.push({ ...colorModal.value.data });
        showToast("Color añadido a la paleta", "success");
      }
      saveToStorage(); colorModal.value.isOpen = false;
    };
    const deleteColor = (id) => { if (confirm("¿Eliminar este color?")) { currentBrand.value.colors = currentBrand.value.colors.filter(c => c.id !== id); saveToStorage(); showToast("Color eliminado", "info"); } };

    const openAddProcedureModal = () => procedureModal.value = { isOpen: true, isEditing: false, data: { id: "sop-" + Date.now(), code: `SOP-${(currentBrand.value?.procedures?.length || 0) + 1}`, title: "", category: "General", role: "", estimatedTime: "30 min", summary: "", guidelines: "", tagsInput: "", checklistInput: "" } };
    const openEditProcedureModal = (sop) => procedureModal.value = { isOpen: true, isEditing: true, data: { id: sop.id, code: sop.code || "", title: sop.title, category: sop.category || "", role: sop.role || "", estimatedTime: sop.estimatedTime || "", summary: sop.summary || "", guidelines: sop.guidelines || "", tagsInput: (sop.tags || []).join(", "), checklistInput: (sop.checklist || []).map(c => c.text).join("\n") } };
    const saveProcedure = () => {
      const d = procedureModal.value.data;
      if (!d.title.trim()) { alert("El título es obligatorio."); return; }
      const tags = d.tagsInput.split(",").map(t => t.trim()).filter(Boolean);
      const checklist = d.checklistInput.split("\n").map(t => t.trim()).filter(Boolean).map(text => ({ text, done: false }));
      if (!currentBrand.value.procedures) currentBrand.value.procedures = [];
      if (procedureModal.value.isEditing) {
        const idx = currentBrand.value.procedures.findIndex(p => p.id === d.id);
        if (idx !== -1) {
          const old = currentBrand.value.procedures[idx];
          currentBrand.value.procedures[idx] = { ...old, code: d.code, title: d.title, category: d.category, role: d.role, estimatedTime: d.estimatedTime, summary: d.summary, guidelines: d.guidelines, tags, checklist: checklist.map(ni => old.checklist?.find(c => c.text === ni.text) || ni) };
        }
        showToast("Procedimiento actualizado", "success");
      } else {
        currentBrand.value.procedures.push({ id: d.id, code: d.code, title: d.title, category: d.category, role: d.role, estimatedTime: d.estimatedTime, summary: d.summary, guidelines: d.guidelines, tags, checklist });
        showToast("Procedimiento creado", "success");
      }
      saveToStorage(); procedureModal.value.isOpen = false;
    };
    const deleteProcedure = (id) => { if (confirm("¿Eliminar este procedimiento?")) { currentBrand.value.procedures = currentBrand.value.procedures.filter(p => p.id !== id); saveToStorage(); showToast("Procedimiento eliminado", "info"); } };

    const openAddProcessModal = () => processModal.value = { isOpen: true, isEditing: false, data: { id: "proc-" + Date.now(), code: `PROC-${(currentBrand.value?.processes?.length || 0) + 1}`, title: "", category: "Operaciones", owner: "", purpose: "", steps: [{ stepNumber: 1, title: "", responsible: "", input: "", output: "", duration: "1d", status: "Pendiente" }] } };
    const openEditProcessModal = (proc) => processModal.value = { isOpen: true, isEditing: true, data: JSON.parse(JSON.stringify(proc)) };
    const addStepToProcessModal = () => { const n = processModal.value.data.steps.length + 1; processModal.value.data.steps.push({ stepNumber: n, title: "", responsible: "", input: "", output: "", duration: "1d", status: "Pendiente" }); };
    const removeStepFromProcessModal = (idx) => { if (processModal.value.data.steps.length > 1) { processModal.value.data.steps.splice(idx, 1); processModal.value.data.steps.forEach((s, i) => s.stepNumber = i + 1); } };
    const saveProcess = () => {
      const d = processModal.value.data;
      if (!d.title.trim()) { alert("El título es obligatorio."); return; }
      if (!currentBrand.value.processes) currentBrand.value.processes = [];
      if (processModal.value.isEditing) {
        const idx = currentBrand.value.processes.findIndex(p => p.id === d.id);
        if (idx !== -1) currentBrand.value.processes[idx] = JSON.parse(JSON.stringify(d));
        showToast("Proceso actualizado", "success");
      } else {
        currentBrand.value.processes.push(JSON.parse(JSON.stringify(d)));
        showToast("Proceso creado", "success");
      }
      saveToStorage(); processModal.value.isOpen = false;
    };
    const deleteProcess = (id) => { if (confirm("¿Eliminar este proceso?")) { currentBrand.value.processes = currentBrand.value.processes.filter(p => p.id !== id); saveToStorage(); showToast("Proceso eliminado", "info"); } };

    const exportToJson = () => {
      const a = document.createElement("a");
      a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentBrand.value, null, 2));
      a.download = `${(currentBrand.value?.name || "marca").toLowerCase().replace(/\s+/g, "-")}-manual.json`;
      document.body.appendChild(a); a.click(); a.remove();
      showToast("Manual exportado como JSON", "success");
    };

    const exportAllBrandsJson = () => {
      const a = document.createElement("a");
      a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(brands.value, null, 2));
      a.download = "brandcraft-backup.json";
      document.body.appendChild(a); a.click(); a.remove();
      showToast("Backup completo exportado", "success");
    };

    const handleImportJson = (event) => {
      const file = event.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (Array.isArray(parsed)) { brands.value = parsed; if (parsed.length) currentBrandId.value = parsed[0].id; showToast(`${parsed.length} marcas importadas`, "success"); }
          else if (parsed?.id && parsed?.name) { const idx = brands.value.findIndex(b => b.id === parsed.id); idx !== -1 ? brands.value[idx] = parsed : brands.value.push(parsed); currentBrandId.value = parsed.id; showToast(`"${parsed.name}" importada`, "success"); }
          else alert("Formato JSON inválido.");
          saveToStorage();
        } catch (err) { alert("Error al leer el archivo: " + err.message); }
        event.target.value = "";
      };
      reader.readAsText(file);
    };

    const printManual = () => window.print();

    // ══════════════════════════════════════════════
    // 8. LIFECYCLE
    // ══════════════════════════════════════════════
    const handleGlobalKeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!showLogin.value) {
          isSpotlightOpen.value = !isSpotlightOpen.value;
          if (isSpotlightOpen.value) setTimeout(() => document.getElementById("spotlight-search-input")?.focus(), 50);
        }
      }
      if (e.key === "Escape") {
        isSpotlightOpen.value = false;
        brandModal.value.isOpen = false;
        colorModal.value.isOpen = false;
        procedureModal.value.isOpen = false;
        processModal.value.isOpen = false;
        newUserModal.value.isOpen = false;
        selectedProcessStep.value = null;
      }
    };

    onMounted(async () => {
      loadFromStorage();
      window.addEventListener("keydown", handleGlobalKeydown);
      await checkExistingSession();
    });

    watch(brands, () => {
      saveToStorage();
      triggerCloudSync();
    }, { deep: true });

    watch(currentBrandId, saveToStorage);

    watch(activeTab, (tab) => {
      if (tab === "admin" && isAdmin.value) loadUsersAndAccess();
    });

    return {
      // Estado
      brands, availableBrands, currentBrandId, currentBrand, activeTab, isPortalMode,
      searchQuery, searchFilter, cloudStatus,
      isSpotlightOpen, spotlightQuery, searchResults, stats,
      toast, typeTesterText, typeTesterSize,
      // Auth
      currentUser, isAdmin, authLoading, showLogin,
      loginEmail, loginPassword, loginError, loginLoading,
      // Admin
      usersList, brandAccessMap, newUserModal, adminError, adminLoading,
      // Modales
      brandModal, colorModal, procedureModal, processModal, selectedProcessStep,
      // Métodos auth
      login, logout,
      // Métodos admin
      openNewUserModal, createUser, toggleUserRole, deleteUser,
      toggleBrandAccess, userHasBrandAccess,
      // Métodos datos
      showToast, copyToClipboard, selectSearchResult, onColorHexInput,
      toggleChecklistItem, syncAllBrandsToSupabase,
      openNewBrandModal, openEditBrandModal, saveBrand, deleteCurrentBrand,
      openAddColorModal, openEditColorModal, saveColor, deleteColor,
      openAddProcedureModal, openEditProcedureModal, saveProcedure, deleteProcedure,
      openAddProcessModal, openEditProcessModal, addStepToProcessModal,
      removeStepFromProcessModal, saveProcess, deleteProcess,
      exportToJson, exportAllBrandsJson, handleImportJson, printManual
    };
  }
});

// Componente Icon reactivo para Lucide
app.component("icon", {
  props: { name: { type: String, required: true }, class: { type: String, default: "w-4 h-4" } },
  setup(props) {
    const svgHtml = computed(() => {
      if (!window.lucide?.icons) return "";
      const pascal = props.name.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
      const iconDef = window.lucide.icons[pascal];
      if (iconDef && window.lucide.createElement) {
        const el = window.lucide.createElement(iconDef);
        if (props.class) el.setAttribute("class", props.class);
        return el.outerHTML;
      }
      return "";
    });
    return () => Vue.h("span", { class: "inline-flex items-center justify-center shrink-0 " + (props.class || ""), innerHTML: svgHtml.value });
  }
});

app.mount("#app");
