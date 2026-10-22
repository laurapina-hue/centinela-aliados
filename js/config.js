/* =====================================================================
   config.js · Configuración por defecto y almacenamiento local seguro
   ⚠️ No escribas aquí la API key: este archivo se publica en GitHub.
   ===================================================================== */
const CONFIG_DEFECTO = {
  modelo: "gemini-2.5-flash",          // modelo de la capa gratuita; usa «Detectar modelos» si cambia
  modelosSugeridos: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"],
  temperatura: 0.2,                    // baja = respuestas más precisas y consistentes
  urlIndicadores: "",                  // opcional: CSV en línea (Google Sheets / Apps Script)
  urlIncumplimientos: "",
  refrescoMin: 0,                      // actualización automática del tablero (minutos)
  // Portal de aliados en modo seguro: URL del Apps Script publicado como aplicación web
  // (ver automatizacion/README.md). Si está vacío, el portal usa los archivos de data/ (solo demo).
  urlApiPortal: "",
  tema: "",
};

const Almacen = {
  get(k, def = null) {
    try { const v = localStorage.getItem("centinela:" + k); return v === null ? def : JSON.parse(v); } catch { return def; }
  },
  set(k, v) { try { localStorage.setItem("centinela:" + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem("centinela:" + k); } catch {} },
};

function leerConfig() {
  const c = { ...CONFIG_DEFECTO, ...(Almacen.get("config", {})) };
  // La key: primero la recordada (localStorage), si no, la de la sesión
  let key = Almacen.get("apiKey", "");
  if (!key) { try { key = JSON.parse(sessionStorage.getItem("centinela:apiKey") || '""'); } catch { key = ""; } }
  c.apiKey = key;
  c.recordar = !!Almacen.get("apiKey", "");
  return c;
}

function guardarConfig(c) {
  const { apiKey, recordar, modelosSugeridos, ...resto } = c;
  Almacen.set("config", resto);
  if (recordar) { Almacen.set("apiKey", apiKey); try { sessionStorage.removeItem("centinela:apiKey"); } catch {} }
  else { Almacen.del("apiKey"); try { sessionStorage.setItem("centinela:apiKey", JSON.stringify(apiKey)); } catch {} }
}
