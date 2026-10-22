/* =====================================================================
   motor.js · Motor de indicadores (sin IA, 100 % determinístico)
   Calcula indicadores, semáforo, Índice de Desempeño del Aliado (IDA),
   alertas, atípicos y medida sugerida por la matriz de calidad.
   Lo usan el tablero interno (index.html) y el portal de aliados.
   ===================================================================== */
const Motor = (() => {
  let D = { filas: [], incs: [], provs: [], metas: null, semanas: [] };

  const CAMPOS = ["servicios", "llegadas_a_tiempo", "minutos_llegada_total", "encuestas",
    "insatisfechos", "reclamaciones", "casos_responsabilidad", "cancelaciones_aliado",
    "asignaciones_ofrecidas", "asignaciones_rechazadas"];

  /* ---------- carga ---------- */
  function cargar({ filas, incs, provs, metas }) {
    D.filas = filas.map(f => {
      const o = { ...f };
      CAMPOS.forEach(c => (o[c] = Number(f[c]) || 0));
      return o;
    });
    D.incs = incs;
    D.provs = provs;
    D.metas = metas;
    D.semanas = [...new Set(D.filas.map(f => f.semana))].sort(compSemana);
    D.idxInc = {};
    D.incs.forEach(i => {
      const k = i.nit + "|" + i.semana;
      D.idxInc[k] = (D.idxInc[k] || 0) + 1;
    });
    D.provPorNit = Object.fromEntries(D.provs.map(p => [p.nit, p]));
  }

  function compSemana(a, b) {
    const [ya, wa] = a.split("-S").map(Number);
    const [yb, wb] = b.split("-S").map(Number);
    return ya - yb || wa - wb;
  }

  /* ---------- utilidades ---------- */
  const metas = () => D.metas;
  const semanas = () => D.semanas;
  const proveedores = () => D.provs;
  const proveedor = nit => D.provPorNit[nit];
  const incumplimientos = () => D.incs;
  const claves = () => Object.keys(D.metas.indicadores);

  function fmt(v, key, conUnidad = true) {
    if (v === null || v === undefined || Number.isNaN(v)) return "—";
    const m = D.metas.indicadores[key];
    const dec = m ? m.decimales : 0;
    const n = v.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (!conUnidad || !m) return n;
    if (m.unidad === "%") return n + " %";
    if (m.unidad === "min") return n + " min";
    return n;
  }
  const fmtNum = n => (n ?? 0).toLocaleString("es-CO");

  function filtrarProvs(filtro = {}) {
    return D.provs.filter(p =>
      (!filtro.region || p.region === filtro.region) &&
      (!filtro.servicio || p.servicio === filtro.servicio) &&
      (!filtro.frecuencia || p.frecuencia === filtro.frecuencia) &&
      (!filtro.nit || p.nit === filtro.nit));
  }

  /* ---------- cálculo ---------- */
  function sumar(filas) {
    const s = Object.fromEntries(CAMPOS.map(c => [c, 0]));
    s.incumplimientos = 0;
    filas.forEach(f => {
      CAMPOS.forEach(c => (s[c] += f[c]));
      s.incumplimientos += D.idxInc[f.nit + "|" + f.semana] || 0;
    });
    return s;
  }

  function indicadores(s) {
    const div = (a, b, k) => (b > 0 ? (a / b) * k : null);
    return {
      oportunidad: div(s.llegadas_a_tiempo, s.servicios, 100),
      tiempo_llegada: div(s.minutos_llegada_total, s.servicios, 1),
      satisfaccion: div(s.encuestas - s.insatisfechos, s.encuestas, 100),
      insatisfechos: div(s.insatisfechos, s.encuestas, 100),
      reclamaciones: div(s.reclamaciones, s.servicios, 1000),
      responsabilidad: div(s.casos_responsabilidad, s.servicios, 100),
      cancelaciones: div(s.cancelaciones_aliado, s.servicios, 100),
      rechazo: div(s.asignaciones_rechazadas, s.asignaciones_ofrecidas, 100),
      incumplimientos: div(s.incumplimientos, s.servicios, 100),
    };
  }

  /** Resultado agregado para un conjunto de semanas y un filtro de aliados */
  function resultado(semanasSel, filtro = {}) {
    const nits = new Set(filtrarProvs(filtro).map(p => p.nit));
    const set = new Set(Array.isArray(semanasSel) ? semanasSel : [semanasSel]);
    const filas = D.filas.filter(f => set.has(f.semana) && nits.has(f.nit));
    const s = sumar(filas);
    const ind = indicadores(s);
    const est = estados(ind);
    return { sumas: s, ind, est, ida: ida(est), servicios: s.servicios };
  }

  function estado(key, v) {
    if (v === null || v === undefined) return null;
    const m = D.metas.indicadores[key];
    if (m.sentido === "mayor") return v >= m.meta ? "verde" : v >= m.umbral ? "amarillo" : "rojo";
    return v <= m.meta ? "verde" : v <= m.umbral ? "amarillo" : "rojo";
  }
  function estados(ind) {
    return Object.fromEntries(claves().map(k => [k, estado(k, ind[k])]));
  }
  function ida(est) {
    let suma = 0, pesos = 0;
    const pts = { verde: 100, amarillo: 60, rojo: 0 };
    claves().forEach(k => {
      if (!est[k]) return;
      const p = D.metas.indicadores[k].peso || 0;
      suma += pts[est[k]] * p;
      pesos += p;
    });
    return pesos ? Math.round(suma / pesos) : null;
  }
  function categoria(v) {
    if (v === null) return { nombre: "Sin datos", color: "gris" };
    return [...D.metas.categorias].sort((a, b) => b.min - a.min).find(c => v >= c.min);
  }

  /** Serie semanal de un indicador (red filtrada o un aliado) */
  function serie(key, filtro = {}, sems = D.semanas) {
    return sems.map(s => resultado([s], filtro).ind[key]);
  }

  /** Semanas anteriores (incluida o no la actual) */
  function semanasHasta(semana, n, incluir = true) {
    const i = D.semanas.indexOf(semana);
    if (i < 0) return [];
    const fin = incluir ? i + 1 : i;
    return D.semanas.slice(Math.max(0, fin - n), fin);
  }

  function peor(key, actual, previo) {
    const m = D.metas.indicadores[key];
    return m.sentido === "mayor" ? actual < previo : actual > previo;
  }

  /* ---------- tabla por aliado ---------- */
  function tablaAliados(semana, filtro = {}) {
    const prev = semanasHasta(semana, 2, false).slice(-1)[0];
    return filtrarProvs(filtro).map(p => {
      const r = resultado([semana], { nit: p.nit });
      const rp = prev ? resultado([prev], { nit: p.nit }) : null;
      const hist = semanasHasta(semana, 4).map(s => resultado([s], { nit: p.nit }).ida);
      return { prov: p, ...r, idaPrevio: rp ? rp.ida : null, cat: categoria(r.ida), tendenciaIda: hist,
        volumenBajo: r.servicios < D.metas.volumen_minimo };
    }).sort((a, b) => (a.ida ?? 999) - (b.ida ?? 999));
  }

  /* ---------- alertas ---------- */
  const SEV = { "Crítica": 4, "Alta": 3, "Media": 2, "Informativa": 1 };
  const FREQ = { alta: 1.5, media: 1.2, baja: 1 };

  function alertas(semana, filtro = {}) {
    const A = D.metas.alertas;
    const out = [];
    filtrarProvs(filtro).forEach(p => {
      const f = { nit: p.nit };
      const actual = resultado([semana], f);
      const base = { nit: p.nit, aliado: p.razon_social, ciudad: p.ciudades.join(", "),
        frecuencia: p.frecuencia, lider: p.lider_regional, semana };
      const push = a => out.push({ ...base, ...a, prioridad: SEV[a.severidad] * 10 * (FREQ[p.frecuencia] || 1) });

      if (actual.servicios === 0) {
        push({ tipo: "Sin datos", severidad: "Informativa", indicador: "servicios",
          detalle: "No hay registros de servicios en la semana." });
        return;
      }
      const volBajo = actual.servicios < D.metas.volumen_minimo;
      const ventana = semanasHasta(semana, Math.max(A.racha_semanas_rojo, A.deterioro_semanas + 1));
      const histSem = semanasHasta(semana, A.historico_semanas + 1, true).slice(0, -1);

      if (!volBajo) {
        claves().forEach(k => {
          const m = D.metas.indicadores[k];
          const v = actual.ind[k];
          if (v === null || m.alerta === false) return;
          const nAntes = out.length;
          // racha
          const ult = semanasHasta(semana, A.racha_semanas_rojo).map(s => estado(k, resultado([s], f).ind[k]));
          const racha = ult.length === A.racha_semanas_rojo && ult.every(e => e === "rojo");
          if (racha) {
            push({ tipo: "Racha en rojo", severidad: "Crítica", indicador: k, valor: v, meta: m.meta,
              detalle: `${m.nombre} en rojo ${A.racha_semanas_rojo} semanas consecutivas (actual ${fmt(v, k)}; meta ${fmt(m.meta, k)}).` });
          } else if (actual.est[k] === "rojo") {
            push({ tipo: "Incumplimiento de meta", severidad: "Alta", indicador: k, valor: v, meta: m.meta,
              detalle: `${m.nombre}: ${fmt(v, k)} vs. meta ${fmt(m.meta, k)}.` });
          }
          // deterioro
          const vs = semanasHasta(semana, A.deterioro_semanas + 1).map(s => resultado([s], f).ind[k]);
          if (!racha && actual.est[k] !== "verde" && vs.length === A.deterioro_semanas + 1 && vs.every(x => x !== null) &&
              vs.slice(1).every((x, i) => peor(k, x, vs[i]))) {
            push({ tipo: "Deterioro sostenido", severidad: "Media", indicador: k, valor: v, meta: m.meta,
              detalle: `${m.nombre} empeora ${A.deterioro_semanas} semanas seguidas (${vs.map(x => fmt(x, k, false)).join(" → ")}).` });
          }
          // atípico
          const h = histSem.map(s => resultado([s], f)).filter(r => r.servicios >= D.metas.volumen_minimo).map(r => r.ind[k]).filter(x => x !== null);
          if (h.length >= A.historico_minimo) {
            const mu = h.reduce((a, b) => a + b, 0) / h.length;
            const sd = Math.sqrt(h.reduce((a, b) => a + (b - mu) ** 2, 0) / (h.length - 1));
            if (sd > 0) {
              const z = (v - mu) / sd;
              const malo = m.sentido === "mayor" ? z < -A.atipico_sigmas : z > A.atipico_sigmas;
              if (malo) {
                const txt = `promedio histórico ${fmt(mu, k)}, ${Math.abs(z).toFixed(1).replace(".", ",")} desviaciones`;
                if (out.length > nAntes) {
                  // ya hay alerta de este indicador: se enriquece en lugar de duplicar
                  const prev = out[out.length - 1];
                  prev.detalle += ` Atípico frente a su histórico (${txt}).`;
                  prev.atipico = true;
                } else {
                  push({ tipo: "Comportamiento atípico", severidad: "Media", indicador: k, valor: v, meta: m.meta, atipico: true,
                    detalle: `${m.nombre} en ${fmt(v, k)} (${txt}). Aún dentro del umbral, pero fuera de su patrón.` });
                }
              }
            }
          }
        });
      } else {
        push({ tipo: "Volumen bajo", severidad: "Informativa", indicador: "servicios", valor: actual.servicios,
          detalle: `Solo ${actual.servicios} servicios en la semana (mínimo ${D.metas.volumen_minimo}); sus porcentajes no generan alerta.` });
      }

      // matriz crítica
      const crit = D.incs.filter(i => i.nit === p.nit && i.semana === semana && i.gravedad === "critica");
      if (crit.length) {
        push({ tipo: "Matriz: incumplimiento crítico", severidad: "Crítica", indicador: "incumplimientos", valor: crit.length,
          detalle: `${crit.length} novedad(es) crítica(s): ${crit.map(c => `${c.tipo} (${c.servicio_id}, ${c.fecha})`).join("; ")}.` });
      }
      // volumen
      const hv = histSem.map(s => resultado([s], f).servicios).filter(x => x > 0);
      if (hv.length >= A.historico_minimo) {
        const mu = hv.reduce((a, b) => a + b, 0) / hv.length;
        const varr = (actual.servicios - mu) / mu;
        if (Math.abs(varr) > A.variacion_volumen) {
          push({ tipo: "Variación de volumen", severidad: "Informativa", indicador: "servicios", valor: actual.servicios,
            detalle: `${fmtNum(actual.servicios)} servicios vs. ${fmtNum(Math.round(mu))} de promedio (${varr > 0 ? "+" : ""}${Math.round(varr * 100)} %). Validar disponibilidad o registro.` });
        }
      }
    });
    return out.sort((a, b) => b.prioridad - a.prioridad);
  }

  /* ---------- matriz de calidad ---------- */
  function finSemana(semana) {
    const [y, w] = semana.split("-S").map(Number);
    // lunes ISO de la semana
    const ene4 = new Date(Date.UTC(y, 0, 4));
    const lunes = new Date(ene4);
    lunes.setUTCDate(ene4.getUTCDate() - ((ene4.getUTCDay() + 6) % 7) + (w - 1) * 7);
    const dom = new Date(lunes);
    dom.setUTCDate(lunes.getUTCDate() + 6);
    return { lunes, domingo: dom };
  }

  function incsVentana(nit, semana, dias = D.metas.alertas.ventana_matriz_dias) {
    const { domingo } = finSemana(semana);
    const desde = new Date(domingo);
    desde.setUTCDate(domingo.getUTCDate() - dias + 1);
    const d0 = desde.toISOString().slice(0, 10), d1 = domingo.toISOString().slice(0, 10);
    return D.incs.filter(i => i.nit === nit && i.fecha >= d0 && i.fecha <= d1);
  }

  function medidaSugerida(nit, semana) {
    const lista = incsVentana(nit, semana);
    const c = { leve: 0, grave: 0, critica: 0 };
    lista.forEach(i => (c[i.gravedad] = (c[i.gravedad] || 0) + 1));
    const regla = D.metas.escalamiento.find(r => c.critica >= r.criticas || c.grave >= r.graves || c.leve >= r.leves);
    return { conteo: c, total: lista.length, regla: regla || null, lista };
  }

  function resumenMatriz(semanasSel, filtro = {}) {
    const nits = new Set(filtrarProvs(filtro).map(p => p.nit));
    const set = new Set(semanasSel);
    const l = D.incs.filter(i => set.has(i.semana) && nits.has(i.nit));
    const porTipo = {}, porGrav = { leve: 0, grave: 0, critica: 0 };
    l.forEach(i => {
      porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1;
      porGrav[i.gravedad] = (porGrav[i.gravedad] || 0) + 1;
    });
    return { lista: l, porTipo, porGrav };
  }

  /* ---------- opciones de filtros ---------- */
  function opciones() {
    const u = k => [...new Set(D.provs.map(p => p[k]))].sort();
    return { regiones: u("region"), servicios: u("servicio"), frecuencias: ["alta", "media", "baja"] };
  }

  return { cargar, metas, semanas, proveedores, proveedor, incumplimientos, claves, fmt, fmtNum,
    resultado, estado, estados, ida, categoria, serie, semanasHasta, tablaAliados, alertas,
    medidaSugerida, incsVentana, resumenMatriz, opciones, filtrarProvs, finSemana, compSemana };
})();
if (typeof module !== "undefined") module.exports = Motor;
