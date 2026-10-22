/* =====================================================================
   reportes.js · Generación de entregables (HTML listo para correo,
   impresión o PDF). Funciona sin IA; la IA solo agrega el bloque de
   "lectura del agente" cuando hay API key.
   ===================================================================== */
const Reportes = (() => {
  const C = { verde: "#1c8c4e", verdeBg: "#e3f4ea", amarillo: "#9a6f00", amarilloBg: "#fdf3d4", rojo: "#c63d3d", rojoBg: "#fbe4e2",
    gris: "#6b7771", grisBg: "#eef0ef", marca: "#0b5a3c", acento: "#e9b100", tinta: "#15211b", linea: "#e1e6e2" };
  const ICON = { verde: "🟢", amarillo: "🟡", rojo: "🔴" };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  /* ---------- utilidades de formato ---------- */
  function chip(estado, texto) {
    const bg = { verde: C.verdeBg, amarillo: C.amarilloBg, rojo: C.rojoBg }[estado] || C.grisBg;
    const fg = { verde: C.verde, amarillo: C.amarillo, rojo: C.rojo }[estado] || C.gris;
    return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;background:${bg};color:${fg};font-weight:600;font-size:12px;white-space:nowrap">${esc(texto)}</span>`;
  }
  const th = t => `<th style="text-align:left;padding:7px 9px;border-bottom:2px solid ${C.linea};font-size:11px;color:${C.gris};text-transform:uppercase;letter-spacing:.04em">${t}</th>`;
  const td = (t, extra = "") => `<td style="padding:7px 9px;border-bottom:1px solid ${C.linea};font-size:13px;${extra}">${t}</td>`;
  const tabla = (cab, filas) => `<table style="width:100%;border-collapse:collapse;margin:8px 0 16px">${cab.length ? `<tr>${cab.map(th).join("")}</tr>` : ""}${filas.join("")}</table>`;
  const h2 = t => `<h2 style="font-size:16px;color:${C.marca};margin:22px 0 6px;border-bottom:2px solid ${C.acento};padding-bottom:4px">${t}</h2>`;

  function variacion(k, act, prev) {
    if (act === null || prev === null || prev === undefined) return "—";
    const m = Motor.metas().indicadores[k];
    const d = act - prev;
    const mejor = m.sentido === "mayor" ? d > 0 : d < 0;
    const color = Math.abs(d) < 1e-9 ? C.gris : mejor ? C.verde : C.rojo;
    const signo = d > 0 ? "+" : "";
    return `<span style="color:${color};font-weight:600">${signo}${Motor.fmt(d, k, false)}</span>`;
  }

  function envolver(titulo, cuerpo, { ancho = 760 } = {}) {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title>
<style>body{margin:0;background:#f4f6f3;font-family:Arial,Helvetica,sans-serif;color:${C.tinta}} @media print{body{background:#fff}.np{display:none}}</style></head>
<body><div style="max-width:${ancho}px;margin:0 auto;background:#fff;padding:28px 32px">${cuerpo}</div></body></html>`;
  }
  function encabezado(titulo, subtitulo) {
    return `<div style="border-left:6px solid ${C.acento};padding:4px 0 4px 14px;margin-bottom:18px">
<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${C.gris}">Relacionamiento de Aliados · Línea Autos</div>
<h1 style="font-size:22px;margin:4px 0 2px;color:${C.marca}">${esc(titulo)}</h1>
<div style="font-size:13px;color:${C.gris}">${esc(subtitulo)}</div></div>`;
  }
  const bloqueIA = () => `<div id="bloque-ia"></div>`;
  const pie = () => `<p style="font-size:11px;color:${C.gris};margin-top:26px;border-top:1px solid ${C.linea};padding-top:10px">Generado automáticamente por Centinela de Aliados el ${new Date().toLocaleString("es-CO")} con base exclusiva en las bases de datos cargadas. Las medidas son propuestas sujetas a debido proceso.</p>`;

  /* ---------- semanas y meses ---------- */
  function mesDeSemana(sem) {
    const { lunes } = Motor.finSemana(sem);
    const jueves = new Date(lunes); jueves.setUTCDate(lunes.getUTCDate() + 3);
    return `${jueves.getUTCFullYear()}-${String(jueves.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  function meses() {
    const m = {};
    Motor.semanas().forEach(s => { const k = mesDeSemana(s); (m[k] = m[k] || []).push(s); });
    return m;
  }
  function nombreMes(k) { const [y, m] = k.split("-"); return `${MESES[+m - 1]} ${y}`; }
  function rango(sem) {
    const { lunes, domingo } = Motor.finSemana(sem);
    const f = d => d.toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
    return `${f(lunes)} – ${f(domingo)}`;
  }

  /* ---------- mini gráfico SVG (sin dependencias) ---------- */
  function sparkSVG(valores, k, { w = 560, h = 150, etiquetas = [] } = {}) {
    const m = Motor.metas().indicadores[k];
    const vals = valores.map(v => (v === null ? null : v));
    const pool = vals.filter(v => v !== null).concat([m.meta, m.umbral]);
    let min = Math.min(...pool), max = Math.max(...pool);
    const pad = (max - min) * 0.15 || 1; min -= pad; max += pad;
    const x = i => 34 + (i * (w - 50)) / Math.max(1, vals.length - 1);
    const y = v => 10 + (h - 34) * (1 - (v - min) / (max - min));
    const pts = vals.map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");
    const linea = (v, col, dash) => `<line x1="34" x2="${w - 16}" y1="${y(v)}" y2="${y(v)}" stroke="${col}" stroke-width="1" stroke-dasharray="${dash}"/><text x="${w - 14}" y="${y(v) + 4}" font-size="10" fill="${col}">${Motor.fmt(v, k, false)}</text>`;
    const puntos = vals.map((v, i) => v === null ? "" : `<circle cx="${x(i)}" cy="${y(v)}" r="3.2" fill="${{ verde: C.verde, amarillo: C.acento, rojo: C.rojo }[Motor.estado(k, v)]}"/>`).join("");
    const labs = etiquetas.map((t, i) => (i % Math.ceil(etiquetas.length / 8) === 0 || i === etiquetas.length - 1) ? `<text x="${x(i)}" y="${h - 6}" font-size="10" fill="${C.gris}" text-anchor="middle">${esc(t)}</text>` : "").join("");
    return `<svg viewBox="0 0 ${w + 20} ${h}" width="100%" style="max-width:${w + 20}px" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(m.nombre)}">
${linea(m.meta, C.verde, "4 3")}${linea(m.umbral, C.rojo, "2 3")}
<polyline points="${pts}" fill="none" stroke="${C.marca}" stroke-width="2.2"/>${puntos}${labs}</svg>`;
  }

  /* =====================================================================
     C1 · Reporte semanal para el equipo
     ===================================================================== */
  function semanal(semana, filtro = {}) {
    const prev = Motor.semanasHasta(semana, 2, false).slice(-1)[0];
    const r = Motor.resultado([semana], filtro);
    const rp = prev ? Motor.resultado([prev], filtro) : null;
    const al = Motor.alertas(semana, filtro).filter(a => a.severidad !== "Informativa");
    const tab = Motor.tablaAliados(semana, filtro).filter(t => !t.volumenBajo);
    const rojos = Motor.claves().filter(k => r.est[k] === "rojo").map(k => Motor.metas().indicadores[k].nombre);
    const titular = `La red cerró ${semana} con IDA ${r.ida ?? "—"} (${Motor.categoria(r.ida).nombre}), ${Motor.fmtNum(r.servicios)} servicios y ${al.filter(a => a.severidad === "Crítica").length} alertas críticas.` +
      (rojos.length ? ` Indicadores de red en rojo: ${rojos.join(", ")}.` : " Ningún indicador de red está en rojo.");

    const filasRed = Motor.claves().map(k => {
      const m = Motor.metas().indicadores[k];
      return `<tr>${td(m.nombre)}${td(chip(r.est[k], (ICON[r.est[k]] || "") + " " + Motor.fmt(r.ind[k], k)))}${td(Motor.fmt(m.meta, k), "color:#6b7771")}${td(variacion(k, r.ind[k], rp?.ind[k]))}</tr>`;
    });
    const filasAl = al.slice(0, 8).map((a, i) => `<tr>${td(i + 1)}${td(chip(a.severidad === "Media" ? "amarillo" : "rojo", a.severidad))}${td(`<b>${esc(a.aliado)}</b><br><span style="color:#6b7771;font-size:12px">${esc(a.tipo)} · ${esc(a.lider)}</span>`)}${td(esc(a.detalle))}</tr>`);
    const peores = tab.slice(0, 3), mejores = [...tab].reverse().slice(0, 3);
    const filaRank = t => `<tr>${td(esc(t.prov.razon_social))}${td(esc(t.prov.servicio))}${td(`<b>${t.ida ?? "—"}</b>`)}${td(chip(t.cat.color, t.cat.nombre))}</tr>`;
    const acciones = accionables(al);

    const cuerpo = `${encabezado(`Reporte semanal de indicadores · ${semana}`, `${rango(semana)} · ${descFiltro(filtro)}`)}
<div style="background:${C.grisBg};padding:12px 14px;border-radius:8px;font-size:14px"><b>Titular:</b> ${esc(titular)}</div>
${bloqueIA()}
${h2("1. Semáforo de la red")}${tabla(["Indicador", "Resultado", "Meta", "Var. vs " + (prev || "—")], filasRed)}
${h2("2. Alertas priorizadas")}${al.length ? tabla(["#", "Severidad", "Aliado", "Detalle"], filasAl) : "<p>Sin alertas relevantes esta semana.</p>"}
${h2("3. Aliados con menor y mayor IDA")}
${tabla(["Aliado", "Servicio", "IDA", "Categoría"], [...peores.map(filaRank), `<tr><td colspan="4" style="padding:2px"></td></tr>`, ...mejores.map(filaRank)])}
${h2("4. Accionables sugeridos para la semana")}
${tabla(["Acción", "Responsable sugerido", "Plazo"], acciones.map(a => `<tr>${td(esc(a.accion))}${td(esc(a.resp))}${td(esc(a.plazo))}</tr>`))}
${pie()}`;
    return { titulo: `Reporte semanal ${semana}`, html: envolver(`Reporte semanal ${semana}`, cuerpo), texto: titular,
      asunto: `Indicadores red de aliados · ${semana} · IDA ${r.ida ?? "—"}` };
  }

  function accionables(al) {
    const out = [], visto = new Set();
    al.forEach(a => {
      const key = a.nit + a.tipo;
      if (visto.has(key) || out.length >= 8) return;
      visto.add(key);
      let accion, plazo = "Esta semana";
      if (a.tipo.startsWith("Matriz")) { accion = `Abrir proceso de descargos a ${a.aliado} por novedad crítica y validar evidencia del servicio.`; plazo = "48 horas"; }
      else if (a.tipo === "Racha en rojo") accion = `Reunión de seguimiento con ${a.aliado}: plan de mejora con compromisos semanales sobre ${Motor.metas().indicadores[a.indicador]?.nombre.toLowerCase()}.`;
      else if (a.tipo === "Deterioro sostenido") accion = `Revisar con supervisión la causa del deterioro de ${a.aliado} (disponibilidad, zonas, turnos).`;
      else if (a.tipo === "Comportamiento atípico") accion = `Validar con supervisión si el atípico de ${a.aliado} es operativo o de registro.`;
      else accion = `Retroalimentar a ${a.aliado} sobre ${Motor.metas().indicadores[a.indicador]?.nombre.toLowerCase() || a.indicador} y solicitar acción correctiva.`;
      out.push({ accion, resp: a.lider, plazo });
    });
    if (!out.length) out.push({ accion: "Mantener seguimiento rutinario; sin desviaciones relevantes.", resp: "Líderes regionales", plazo: "—" });
    return out;
  }

  function descFiltro(f) {
    const p = [];
    if (f.region) p.push("Región " + f.region);
    if (f.servicio) p.push(f.servicio);
    if (f.frecuencia) p.push("Frecuencia " + f.frecuencia);
    return p.length ? p.join(" · ") : "Red nacional";
  }

  /* =====================================================================
     A3 · Informe mensual para un aliado (solo sus datos)
     ===================================================================== */
  function mensualAliado(nit, mesKey) {
    const p = Motor.proveedor(nit);
    const sems = meses()[mesKey] || [];
    const r = Motor.resultado(sems, { nit });
    const red = Motor.resultado(sems, {});
    const incs = Motor.incumplimientos().filter(i => i.nit === nit && sems.includes(i.semana));
    const fort = Motor.claves().filter(k => r.est[k] === "verde" && Motor.metas().indicadores[k].peso > 0);
    const mej = Motor.claves().filter(k => r.est[k] && r.est[k] !== "verde");
    const cat = Motor.categoria(r.ida);
    const filas = Motor.claves().map(k => {
      const m = Motor.metas().indicadores[k];
      return `<tr>${td(m.nombre)}${td(chip(r.est[k], Motor.fmt(r.ind[k], k)))}${td(Motor.fmt(m.meta, k), "color:#6b7771")}${td(Motor.fmt(red.ind[k], k), "color:#6b7771")}</tr>`;
    });
    const porTipo = {};
    incs.forEach(i => (porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1));

    const cuerpo = `${encabezado(`Resultados de desempeño · ${nombreMes(mesKey)}`, `${p.razon_social} · NIT ${p.nit} · ${p.servicio}`)}
<p>Estimado aliado:</p>
<p>Agradecemos su compromiso con la atención de nuestros asegurados. Compartimos los resultados de su operación durante <b>${nombreMes(mesKey)}</b> (${sems[0] || ""} a ${sems.slice(-1)[0] || ""}), con el fin de reconocer lo que funciona bien y acordar oportunidades de mejora.</p>
<div style="display:flex;gap:16px;flex-wrap:wrap;margin:14px 0">
 <div style="flex:1;min-width:150px;background:${C.grisBg};padding:12px;border-radius:8px"><div style="font-size:12px;color:${C.gris}">Servicios prestados</div><div style="font-size:24px;font-weight:700">${Motor.fmtNum(r.servicios)}</div></div>
 <div style="flex:1;min-width:150px;background:${C.grisBg};padding:12px;border-radius:8px"><div style="font-size:12px;color:${C.gris}">Índice de desempeño (IDA)</div><div style="font-size:24px;font-weight:700">${r.ida ?? "—"} <span style="font-size:13px">${chip(cat.color, cat.nombre)}</span></div></div>
 <div style="flex:1;min-width:150px;background:${C.grisBg};padding:12px;border-radius:8px"><div style="font-size:12px;color:${C.gris}">Novedades en matriz de calidad</div><div style="font-size:24px;font-weight:700">${incs.length}</div></div>
</div>
${h2("Sus resultados frente a la meta")}
${tabla(["Indicador", "Su resultado", "Meta", "Promedio red*"], filas)}
<p style="font-size:11px;color:${C.gris};margin-top:-8px">*Promedio agregado de la red de aliados, sin identificar a otros aliados.</p>
${bloqueIA()}
${h2("Fortalezas")}<p>${fort.length ? "Cumple la meta en: " + fort.map(k => Motor.metas().indicadores[k].nombre.toLowerCase()).join(", ") + ". ¡Gracias por este resultado!" : "Este mes no se alcanzó la meta en los indicadores principales."}</p>
${h2("Oportunidades de mejora")}${mej.length ? `<ul>${mej.map(k => `<li><b>${Motor.metas().indicadores[k].nombre}:</b> ${Motor.fmt(r.ind[k], k)} frente a una meta de ${Motor.fmt(Motor.metas().indicadores[k].meta, k)}.</li>`).join("")}</ul>` : "<p>No se identifican brechas frente a la meta.</p>"}
${incs.length ? `<p>Novedades registradas en la matriz de calidad: ${Object.entries(porTipo).map(([t, n]) => `${t} (${n})`).join(", ")}.</p>` : ""}
${h2("Compromisos")}
<p>${mej.length ? "Le solicitamos enviar, dentro de los próximos cinco (5) días hábiles, las acciones que implementará para cerrar las brechas señaladas. Su líder regional programará una sesión de seguimiento." : "Lo invitamos a mantener estas buenas prácticas. Su líder regional estará atento a cualquier necesidad."}</p>
<p>Cordialmente,<br><b>Relacionamiento de Aliados · Línea Autos</b><br><span style="color:${C.gris}">Contacto: ${esc(p.lider_regional)} · ${esc(p.correo_lider || "")}</span></p>
${pie()}`;
    return { titulo: `Informe ${p.razon_social} ${nombreMes(mesKey)}`, html: envolver("Informe mensual", cuerpo), destino: p.correo_aliado,
      asunto: `Resultados de desempeño ${nombreMes(mesKey)} · ${p.razon_social}`,
      texto: `Resultados ${nombreMes(mesKey)} · ${p.razon_social}: IDA ${r.ida ?? "—"} (${cat.nombre}), ${r.servicios} servicios, ${incs.length} novedades en matriz.` };
  }

  /* =====================================================================
     B1 + B3 · Expediente del aliado y propuesta de medida
     ===================================================================== */
  function expediente(nit, semana) {
    const p = Motor.proveedor(nit);
    const sems = Motor.semanasHasta(semana, 12);
    const r = Motor.resultado([semana], { nit });
    const cat = Motor.categoria(r.ida);
    const med = Motor.medidaSugerida(nit, semana);
    const graf = ["oportunidad", "insatisfechos", "reclamaciones"].map(k =>
      `<div style="margin-bottom:10px"><b style="font-size:13px">${Motor.metas().indicadores[k].nombre}</b>${sparkSVG(Motor.serie(k, { nit }, sems), k, { etiquetas: sems.map(s => s.split("-")[1]) })}</div>`).join("");
    const mapa = Motor.claves().map(k => `<tr>${td(Motor.metas().indicadores[k].nombre, "white-space:nowrap")}${sems.slice(-8).map(s => {
      const v = Motor.resultado([s], { nit }).ind[k]; const e = Motor.estado(k, v);
      return td(Motor.fmt(v, k, false), `text-align:center;background:${{ verde: C.verdeBg, amarillo: C.amarilloBg, rojo: C.rojoBg }[e] || "#fff"};color:${{ verde: C.verde, amarillo: C.amarillo, rojo: C.rojo }[e] || C.gris}`);
    }).join("")}</tr>`);
    const filasInc = med.lista.slice().reverse().map(i => `<tr>${td(i.fecha)}${td(esc(i.servicio_id))}${td(esc(i.tipo))}${td(chip(i.gravedad === "critica" ? "rojo" : i.gravedad === "grave" ? "amarillo" : "gris", i.gravedad))}${td(esc(i.estado))}</tr>`);

    const cuerpo = `${encabezado(`Expediente del aliado`, `${p.razon_social} · NIT ${p.nit} · corte ${semana}`)}
${tabla([], [
      `<tr>${td("<b>Servicio</b>")}${td(esc(p.servicio))}${td("<b>Ciudades</b>")}${td(esc(p.ciudades.join(", ")))}</tr>`,
      `<tr>${td("<b>Frecuencia</b>")}${td(esc(p.frecuencia))}${td("<b>Región / líder</b>")}${td(esc(p.region + " · " + p.lider_regional))}</tr>`,
      `<tr>${td("<b>IDA semana</b>")}${td(`<b style="font-size:18px">${r.ida ?? "—"}</b> ${chip(cat.color, cat.nombre)}`)}${td("<b>Servicios semana</b>")}${td(Motor.fmtNum(r.servicios))}</tr>`])}
${bloqueIA()}
${h2("Evolución (12 semanas)")}${graf}
${h2("Mapa de calor · últimas 8 semanas")}${tabla(["Indicador", ...sems.slice(-8).map(s => s.split("-")[1])], mapa)}
${h2(`Matriz de calidad · últimos ${Motor.metas().alertas.ventana_matriz_dias} días`)}
<p>Leves: <b>${med.conteo.leve}</b> · Graves: <b>${med.conteo.grave}</b> · Críticas: <b>${med.conteo.critica}</b></p>
${med.lista.length ? tabla(["Fecha", "Servicio", "Tipo", "Gravedad", "Estado"], filasInc) : "<p>Sin novedades en la ventana.</p>"}
${propuestaHTML(p, med, semana)}
${pie()}`;
    return { titulo: `Expediente ${p.razon_social}`, html: envolver("Expediente " + p.razon_social, cuerpo), asunto: `Expediente ${p.razon_social} · ${semana}`, texto: "" };
  }

  function propuestaHTML(p, med, semana) {
    if (!med.regla) return h2("Medida sugerida") + "<p>No aplica medida según la regla de escalamiento.</p>";
    const critica = /suspensi|termina/i.test(med.regla.medida);
    return `${h2("Propuesta de medida (B3)")}
<div style="border-left:4px solid ${critica ? C.rojo : C.acento};background:${critica ? C.rojoBg : C.amarilloBg};padding:12px 14px;border-radius:0 8px 8px 0">
<div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:${critica ? C.rojo : C.amarillo}">PROPUESTA — SUJETA A DEBIDO PROCESO Y REVISIÓN DE JURÍDICO</div>
<p style="margin:6px 0"><b>Medida propuesta:</b> ${esc(med.regla.medida)}</p>
<p style="margin:6px 0"><b>Regla de escalamiento aplicable:</b> ${esc(med.regla.condicion)}</p>
<p style="margin:6px 0"><b>Hechos (ventana al cierre de ${semana}):</b> ${med.conteo.critica} crítica(s), ${med.conteo.grave} grave(s), ${med.conteo.leve} leve(s). Frecuencia del aliado: ${esc(p.frecuencia)}.</p>
<p style="margin:6px 0"><b>Siguiente paso sugerido:</b> notificar hallazgos con evidencia, otorgar plazo de descargos y registrar la decisión en el expediente.</p></div>`;
  }

  /* =====================================================================
     C2 · Presentación gerencial (diapositivas 16:9 imprimibles a PDF)
     ===================================================================== */
  function presentacion(semana, filtro = {}) {
    const sems = Motor.semanasHasta(semana, 12);
    const r = Motor.resultado([semana], filtro);
    const r4 = Motor.resultado(Motor.semanasHasta(semana, 4), filtro);
    const al = Motor.alertas(semana, filtro).filter(a => a.severidad !== "Informativa");
    const tab = Motor.tablaAliados(semana, filtro);
    const porCat = {};
    tab.forEach(t => { const c = t.volumenBajo ? "Volumen bajo" : t.cat.nombre; porCat[c] = (porCat[c] || []).concat(t.prov.razon_social); });
    const crit = al.filter(a => a.severidad === "Crítica");
    const acc = accionables(al);
    const slide = (titulo, contenido, n) => `<section class="s"><div class="sc"><div class="kick">Relacionamiento de Aliados · Autos · ${semana}</div><h2>${titulo}</h2>${contenido}</div><div class="pn">${n}</div></section>`;
    const kp = k => `<div class="k ${r.est[k] || ""}"><small>${Motor.metas().indicadores[k].nombre}</small><b>${Motor.fmt(r.ind[k], k)}</b><span>Meta ${Motor.fmt(Motor.metas().indicadores[k].meta, k)} · 4 sem: ${Motor.fmt(r4.ind[k], k)}</span></div>`;
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comité · ${semana}</title><style>
@page{size:13.333in 7.5in;margin:0} *{box-sizing:border-box} body{margin:0;background:#2b2f2d;font-family:Arial,Helvetica,sans-serif;color:${C.tinta}}
.s{width:13.333in;height:7.5in;margin:20px auto;background:#fff;position:relative;page-break-after:always;overflow:hidden}
.sc{padding:.55in .7in} .kick{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${C.gris}} h2{font-size:34px;color:${C.marca};margin:8px 0 22px;border-bottom:4px solid ${C.acento};padding-bottom:10px;display:inline-block}
.pn{position:absolute;right:.5in;bottom:.35in;color:${C.gris};font-size:13px}
.portada{background:${C.marca};color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 1in}
.portada h1{font-size:52px;margin:0 0 12px} .portada p{font-size:22px;opacity:.85;margin:0} .portada .bar{width:120px;height:8px;background:${C.acento};margin-bottom:28px}
.msg{font-size:30px;line-height:1.35;max-width:11in} .ks{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.k{border:1px solid ${C.linea};border-left:8px solid ${C.grisBg};border-radius:10px;padding:14px 16px} .k.verde{border-left-color:${C.verde}} .k.amarillo{border-left-color:${C.acento}} .k.rojo{border-left-color:${C.rojo}}
.k small{display:block;color:${C.gris};font-size:14px} .k b{display:block;font-size:30px;margin:4px 0} .k span{font-size:12px;color:${C.gris}}
table{width:100%;border-collapse:collapse;font-size:16px} td,th{padding:9px 10px;border-bottom:1px solid ${C.linea};text-align:left} th{color:${C.gris};font-size:13px;text-transform:uppercase}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:28px} .cat{border-radius:10px;padding:14px 16px;margin-bottom:10px;background:${C.grisBg}} .cat b{font-size:18px}
ul{font-size:20px;line-height:1.5} @media print{body{background:#fff}.s{margin:0}}
</style></head><body>
<section class="s portada"><div class="bar"></div><h1>Resultados red de aliados</h1><p>Comité gerencial · ${semana} (${rango(semana)}) · ${descFiltro(filtro)}</p></section>
${slide("Mensaje clave", `<p class="msg">La red cerró <b>${semana}</b> con un IDA de <b>${r.ida ?? "—"}</b> (${Motor.categoria(r.ida).nombre}) sobre <b>${Motor.fmtNum(r.servicios)}</b> servicios. Se identifican <b>${crit.length}</b> alertas críticas y <b>${tab.filter(t => t.cat.nombre === "Crítico" && !t.volumenBajo).length}</b> aliado(s) en categoría crítica.</p><div id="bloque-ia"></div>`, 2)}
${slide("Resultados de la red vs. meta", `<div class="ks">${Motor.claves().filter(k => Motor.metas().indicadores[k].peso > 0).map(kp).join("")}</div>`, 3)}
${slide("Evolución 12 semanas", `<div class="g2"><div><b>Oportunidad de llegada</b>${sparkSVG(Motor.serie("oportunidad", filtro, sems), "oportunidad", { etiquetas: sems.map(s => s.split("-")[1]), h: 220 })}</div><div><b>Tasa de insatisfechos</b>${sparkSVG(Motor.serie("insatisfechos", filtro, sems), "insatisfechos", { etiquetas: sems.map(s => s.split("-")[1]), h: 220 })}</div><div><b>Reclamaciones x 1.000</b>${sparkSVG(Motor.serie("reclamaciones", filtro, sems), "reclamaciones", { etiquetas: sems.map(s => s.split("-")[1]), h: 220 })}</div><div><b>Incumplimientos matriz x 100</b>${sparkSVG(Motor.serie("incumplimientos", filtro, sems), "incumplimientos", { etiquetas: sems.map(s => s.split("-")[1]), h: 220 })}</div></div>`, 4)}
${slide("Aliados por categoría de desempeño", `<div class="g2">${Motor.metas().categorias.concat(porCat["Volumen bajo"] ? [{ nombre: "Volumen bajo", color: "gris" }] : []).map(c => `<div class="cat" style="border-left:8px solid ${{ verde: C.verde, amarillo: C.acento, rojo: C.rojo }[c.color] || C.gris}"><b>${c.nombre}</b> (${(porCat[c.nombre] || []).length})<br><span style="font-size:15px">${(porCat[c.nombre] || []).join(" · ") || "—"}</span></div>`).join("")}</div>`, 5)}
${slide("Riesgos y casos críticos", al.length ? `<table><tr><th>Severidad</th><th>Aliado</th><th>Hallazgo</th></tr>${al.slice(0, 7).map(a => `<tr><td>${a.severidad}</td><td><b>${esc(a.aliado)}</b></td><td>${esc(a.detalle)}</td></tr>`).join("")}</table>` : "<p class='msg'>Sin riesgos relevantes.</p>", 6)}
${slide("Plan de acción y decisiones requeridas", `<table><tr><th>Acción</th><th>Responsable</th><th>Plazo</th></tr>${acc.map(a => `<tr><td>${esc(a.accion)}</td><td>${esc(a.resp)}</td><td>${esc(a.plazo)}</td></tr>`).join("")}</table>`, 7)}
</body></html>`;
    return { titulo: `Presentación comité ${semana}`, html, asunto: `Presentación comité · ${semana}`, texto: "" };
  }

  /* =====================================================================
     Exportaciones CSV
     ===================================================================== */
  function csv(filas) {
    const c = v => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return "﻿" + filas.map(f => f.map(c).join(";")).join("\n");
  }
  function alertasCSV(semana, filtro) {
    const al = Motor.alertas(semana, filtro);
    return csv([["semana", "severidad", "tipo", "nit", "aliado", "frecuencia", "lider_regional", "indicador", "detalle"],
      ...al.map(a => [a.semana, a.severidad, a.tipo, a.nit, a.aliado, a.frecuencia, a.lider, a.indicador, a.detalle])]);
  }
  function bitacoraCSV(semana, filtro) {
    const nits = new Set(Motor.filtrarProvs(filtro).map(p => p.nit));
    const l = Motor.incumplimientos().filter(i => i.semana === semana && nits.has(i.nit));
    return csv([["fecha", "aliado", "nit", "ciudad", "servicio", "tipo_novedad", "gravedad", "accion_inmediata", "responsable", "estado"],
      ...l.map(i => { const p = Motor.proveedor(i.nit) || {}; return [i.fecha, p.razon_social, i.nit, i.ciudad, i.servicio_id, i.tipo, i.gravedad, i.medida || "", p.lider_regional, i.estado]; })]);
  }
  function indicadoresCSV(semana, filtro) {
    const k = Motor.claves();
    return csv([["semana", "nit", "aliado", "servicios", ...k, "IDA", "categoria"],
      ...Motor.tablaAliados(semana, filtro).map(t => [semana, t.prov.nit, t.prov.razon_social, t.servicios, ...k.map(x => t.ind[x] === null ? "" : t.ind[x].toFixed(2).replace(".", ",")), t.ida, t.cat.nombre])]);
  }

  return { semanal, mensualAliado, expediente, presentacion, alertasCSV, bitacoraCSV, indicadoresCSV, meses, nombreMes, sparkSVG, rango, mesDeSemana };
})();
