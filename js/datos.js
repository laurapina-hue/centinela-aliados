/* =====================================================================
   datos.js · Carga de datos y contexto
   Orden de prioridad:
     1. Archivos subidos por la usuaria en Configuración (solo esta sesión)
     2. URL configurada (Google Sheets publicado como CSV / Apps Script)
     3. Archivos del repositorio: data/*.csv, data/*.json, contexto/*.md
     4. Copia embebida (js/embebido.js) — permite abrir index.html con doble clic
   ===================================================================== */
const Datos = (() => {
  const ARCHIVOS_CONTEXTO = [
    "00_master_prompt.md", "01_negocio_ecosistema.md", "02_indicadores_kpi.md",
    "03_ans_contratos.md", "04_matriz_calidad.md", "05_entregables.md", "06_gemelo_digital.md",
  ];
  let origen = {};

  /** Parser CSV (RFC 4180: comillas, comas y saltos dentro de comillas; detecta ; o ,) */
  function parseCSV(txt) {
    txt = txt.replace(/^﻿/, "");
    const sep = (txt.split("\n")[0].match(/;/g) || []).length > (txt.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    const filas = [];
    let fila = [], campo = "", q = false;
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (q) {
        if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') q = false;
        else campo += c;
      } else if (c === '"') q = true;
      else if (c === sep) { fila.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && txt[i + 1] === "\n") i++;
        fila.push(campo); campo = "";
        if (fila.some(x => x !== "")) filas.push(fila);
        fila = [];
      } else campo += c;
    }
    fila.push(campo);
    if (fila.some(x => x !== "")) filas.push(fila);
    const cab = filas.shift().map(h => h.trim().toLowerCase());
    return filas.map(f => Object.fromEntries(cab.map((h, i) => [h, (f[i] ?? "").trim()])));
  }

  const esLocal = () => typeof location !== "undefined" && location.protocol === "file:";

  async function traer(url, tipo = "text") {
    if (esLocal() && !/^https?:/.test(url)) throw new Error("Archivo local: se usa la copia embebida");
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return tipo === "json" ? r.json() : r.text();
  }

  const E = () => (typeof window !== "undefined" && window.EMBEBIDO) || null;

  async function obtener(nombre, rutaRepo, urlExterna, tipo) {
    const subido = Sesion.get("subido:" + nombre);
    if (subido) { origen[nombre] = "archivo cargado"; return subido; }
    if (urlExterna) {
      try { const v = await traer(urlExterna, tipo); origen[nombre] = "fuente en línea"; return v; }
      catch (e) { console.warn("Fuente externa no disponible", e); }
    }
    try { const v = await traer(rutaRepo, tipo); origen[nombre] = "repositorio"; return v; }
    catch (e) {
      const emb = E();
      if (emb && emb.datos[nombre] !== undefined) { origen[nombre] = "copia embebida"; return emb.datos[nombre]; }
      throw new Error("No se pudo cargar " + nombre);
    }
  }

  async function cargarTodo(cfg) {
    origen = {};
    const [indTxt, incTxt, provJson, metasJson] = await Promise.all([
      obtener("indicadores", "data/indicadores_semanales.csv", cfg.urlIndicadores, "text"),
      obtener("incumplimientos", "data/incumplimientos.csv", cfg.urlIncumplimientos, "text"),
      obtener("proveedores", "data/proveedores.json", null, "json"),
      obtener("metas", "data/metas.json", null, "json"),
    ]);
    const prov = typeof provJson === "string" ? JSON.parse(provJson) : provJson;
    const metas = typeof metasJson === "string" ? JSON.parse(metasJson) : metasJson;
    return {
      filas: parseCSV(indTxt),
      incs: parseCSV(incTxt),
      provs: prov.proveedores || prov,
      metas,
      origen: { ...origen },
    };
  }

  async function cargarContexto() {
    const out = {};
    for (const f of ARCHIVOS_CONTEXTO) {
      try { out[f] = await traer("contexto/" + f); }
      catch { const emb = E(); out[f] = emb ? emb.contexto[f] || "" : ""; }
    }
    return out;
  }

  /** Almacenamiento seguro (puede no existir en algunos navegadores) */
  const Sesion = {
    mem: {},
    get(k) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : this.mem[k]; } catch { return this.mem[k]; } },
    set(k, v) { this.mem[k] = v; try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { delete this.mem[k]; try { sessionStorage.removeItem(k); } catch {} },
  };

  return { parseCSV, cargarTodo, cargarContexto, Sesion, ARCHIVOS_CONTEXTO };
})();
if (typeof module !== "undefined") module.exports = Datos;
