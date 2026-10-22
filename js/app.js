/* =====================================================================
   app.js · Interfaz del tablero interno (index.html)
   ===================================================================== */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let cfg = leerConfig();
  let vista = "resumen";
  let semana = null;
  let contexto = {};
  let origen = {};
  let graficos = {};
  let repActual = null;
  let temporizador = null;

  const TITULOS = {
    resumen: "Resumen de la red", evolucion: "Evolución de indicadores", aliados: "Expediente del aliado",
    matriz: "Matriz de calidad", agente: "Agente IA", reportes: "Reportes y entregables", config: "Configuración",
  };

  /* ---------------- utilidades ---------------- */
  function toast(msg, ms = 2800) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("ver");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("ver"), ms);
  }
  const filtro = () => ({ region: $("#f-region").value, servicio: $("#f-servicio").value, frecuencia: $("#f-frecuencia").value });
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const chip = (e, t) => `<span class="chip ${e || "gris"}">${esc(t)}</span>`;
  const dot = e => `<span class="dot ${e || "gris"}" title="${e || "sin dato"}"></span>`;
  const nombreInd = k => Motor.metas().indicadores[k]?.nombre || k;

  function grafico(id, config) {
    if (graficos[id]) graficos[id].destroy();
    const ctx = document.getElementById(id);
    if (!ctx || typeof Chart === "undefined") return;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.color = css("--ink-2");
    Chart.defaults.borderColor = css("--chart-grid");
    graficos[id] = new Chart(ctx, config);
  }
  function descargar(nombre, contenido, tipo) {
    const b = new Blob([contenido], { type: tipo });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function aplicarTema() {
    if (cfg.tema) document.documentElement.setAttribute("data-theme", cfg.tema);
    else document.documentElement.removeAttribute("data-theme");
  }

  /* ---------------- carga ---------------- */
  async function cargarDatos(silencioso = false) {
    try {
      const d = await Datos.cargarTodo(cfg);
      Motor.cargar(d);
      origen = d.origen;
      poblarFiltros();
      render();
      if (!silencioso) toast("Datos actualizados");
    } catch (e) {
      console.error(e);
      $("#sub-vista").textContent = "No fue posible cargar los datos: " + e.message;
      toast("Error cargando datos: " + e.message, 5000);
    }
  }

  function poblarFiltros() {
    const sems = Motor.semanas();
    const prevSem = $("#f-semana").value;
    $("#f-semana").innerHTML = [...sems].reverse().map(s => `<option value="${s}">${s} · ${Reportes.rango(s)}</option>`).join("");
    semana = sems.includes(prevSem) ? prevSem : sems[sems.length - 1];
    $("#f-semana").value = semana;
    const op = Motor.opciones();
    const llenar = (sel, arr, todos) => {
      const v = $(sel).value;
      $(sel).innerHTML = `<option value="">${todos}</option>` + arr.map(x => `<option>${esc(x)}</option>`).join("");
      if (arr.includes(v)) $(sel).value = v;
    };
    llenar("#f-region", op.regiones, "Todas las regiones");
    llenar("#f-servicio", op.servicios, "Todos los servicios");
    const provs = Motor.proveedores().slice().sort((a, b) => a.razon_social.localeCompare(b.razon_social));
    ["#exp-aliado", "#rep-aliado", "#rep-exp-aliado"].forEach(sel => {
      const v = $(sel).value;
      $(sel).innerHTML = provs.map(p => `<option value="${p.nit}">${esc(p.razon_social)}</option>`).join("");
      if (v && provs.some(p => p.nit === v)) $(sel).value = v;
    });
    const v2 = $("#ev-aliado").value;
    $("#ev-aliado").innerHTML = `<option value="">Comparar con un aliado…</option>` + provs.map(p => `<option value="${p.nit}">${esc(p.razon_social)}</option>`).join("");
    $("#ev-aliado").value = v2;
    const vi = $("#ev-ind").value;
    $("#ev-ind").innerHTML = Motor.claves().map(k => `<option value="${k}">${esc(nombreInd(k))}</option>`).join("");
    $("#ev-ind").value = vi || "oportunidad";
    const meses = Reportes.meses();
    $("#rep-mes").innerHTML = Object.keys(meses).reverse().map(m => `<option value="${m}">${Reportes.nombreMes(m)}${meses[m].length < 4 ? " (parcial)" : ""}</option>`).join("");
  }

  /* ---------------- navegación ---------------- */
  function irA(v) {
    vista = v;
    $$("#nav button").forEach(b => b.classList.toggle("activo", b.dataset.vista === v));
    $$(".vista").forEach(s => s.classList.toggle("activa", s.id === "v-" + v));
    $("#titulo-vista").textContent = TITULOS[v];
    render();
    window.scrollTo({ top: 0 });
  }

  function render() {
    if (!Motor.semanas().length) return;
    semana = $("#f-semana").value;
    const r = Motor.resultado([semana], filtro());
    $("#sub-vista").textContent = `${semana} (${Reportes.rango(semana)}) · ${Motor.fmtNum(r.servicios)} servicios · ${Motor.filtrarProvs(filtro()).length} aliados`;
    const o = Object.values(origen);
    $("#txt-origen").textContent = "Datos: " + [...new Set(o)].join(", ");
    actualizarEstadoIA();
    ({ resumen: vResumen, evolucion: vEvolucion, aliados: vAliados, matriz: vMatriz, agente: vAgente, reportes: () => {}, config: vConfig })[vista]();
  }

  function actualizarEstadoIA() {
    const ok = !!cfg.apiKey;
    $("#punto-ia").className = "punto " + (ok ? "ok" : "no");
    $("#txt-ia").textContent = ok ? "IA: " + cfg.modelo : "IA sin configurar";
  }

  /* ================= RESUMEN ================= */
  function vResumen() {
    const f = filtro();
    const prev = Motor.semanasHasta(semana, 2, false).slice(-1)[0];
    const r = Motor.resultado([semana], f);
    const rp = prev ? Motor.resultado([prev], f) : null;
    $("#kpis").innerHTML = `<div class="kpi" data-ind="servicios"><div class="kpi-nombre">Servicios prestados</div><div class="kpi-valor">${Motor.fmtNum(r.servicios)}</div>
      <div class="kpi-meta"><span>${Motor.filtrarProvs(f).length} aliados</span>${rp ? `<span>${varTxt(r.servicios, rp.servicios)}</span>` : ""}</div></div>` +
      Motor.claves().map(k => {
        const m = Motor.metas().indicadores[k];
        const d = rp && r.ind[k] !== null && rp.ind[k] !== null ? r.ind[k] - rp.ind[k] : null;
        const mejor = d === null ? null : m.sentido === "mayor" ? d > 0 : d < 0;
        return `<button class="kpi ${r.est[k] || ""}" data-ind="${k}" title="Ver evolución">
          <div class="kpi-nombre">${esc(m.nombre)}</div>
          <div class="kpi-valor">${Motor.fmt(r.ind[k], k)}</div>
          <div class="kpi-meta"><span>Meta ${Motor.fmt(m.meta, k)}</span>${d === null ? "" : `<span class="${Math.abs(d) < 1e-9 ? "" : mejor ? "var-mejor" : "var-peor"}">${d > 0 ? "▲" : d < 0 ? "▼" : "="} ${Motor.fmt(Math.abs(d), k, false)}</span>`}</div></button>`;
      }).join("");
    $$("#kpis .kpi").forEach(b => b.addEventListener("click", () => {
      if (b.dataset.ind !== "servicios") { $("#ev-ind").value = b.dataset.ind; irA("evolucion"); }
    }));

    // alertas
    const sev = $("#f-sev").value;
    const al = Motor.alertas(semana, f).filter(a => !sev || a.severidad === sev);
    $("#lista-alertas").innerHTML = al.length ? al.slice(0, 40).map(a => `
      <div class="alerta"><span class="sev ${a.severidad}">${a.severidad}</span>
      <div><b>${esc(a.aliado)}</b> · <span style="color:var(--ink-3)">${esc(a.tipo)}</span><p>${esc(a.detalle)}</p></div>
      <div class="meta-al">${esc(a.lider)}<br>Frecuencia ${esc(a.frecuencia)}<br><a href="#" data-nit="${a.nit}">Expediente →</a></div></div>`).join("")
      : `<div class="vacio">Sin alertas para los filtros seleccionados.</div>`;
    $$("#lista-alertas a[data-nit]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); abrirExpediente(a.dataset.nit); }));

    // IDA red
    const cat = Motor.categoria(r.ida);
    $("#ida-red").textContent = r.ida ?? "—";
    $("#cat-red").innerHTML = chip(cat.color, cat.nombre);
    const sems = Motor.semanasHasta(semana, 12);
    grafico("g-ida", {
      type: "line",
      data: { labels: sems.map(s => s.split("-")[1]), datasets: [{ data: sems.map(s => Motor.resultado([s], f).ida), borderColor: css("--chart-1"), backgroundColor: css("--chart-1") + "22", fill: true, tension: .3, pointRadius: 3 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } },
    });
    const tab = Motor.tablaAliados(semana, f);
    const cats = Motor.metas().categorias;
    $("#dist-cat").innerHTML = cats.map(c => {
      const n = tab.filter(t => t.cat.nombre === c.nombre && !t.volumenBajo).length;
      return `<div style="display:flex;justify-content:space-between;align-items:center">${chip(c.color, c.nombre)}<b class="num">${n}</b></div>`;
    }).join("") + `<div style="display:flex;justify-content:space-between;align-items:center">${chip("gris", "Volumen bajo")}<b class="num">${tab.filter(t => t.volumenBajo).length}</b></div>`;

    // ranking
    const ks = Motor.claves();
    $("#t-ranking").innerHTML = `<tr><th>Aliado</th><th>Servicio</th><th>Frec.</th><th class="num">Servicios</th><th class="num">IDA</th><th>Categoría</th>${ks.map(k => `<th class="celda-sem" title="${esc(nombreInd(k))}">${abrev(k)}</th>`).join("")}</tr>` +
      tab.map(t => `<tr class="clic" data-nit="${t.prov.nit}"><td><b>${esc(t.prov.razon_social)}</b><br><small style="color:var(--ink-3)">${esc(t.prov.ciudades.join(", "))}</small></td>
      <td>${esc(t.prov.servicio)}</td><td>${esc(t.prov.frecuencia)}</td><td class="num">${Motor.fmtNum(t.servicios)}</td>
      <td class="num"><b>${t.ida ?? "—"}</b> ${t.idaPrevio !== null && t.ida !== null ? `<small class="${t.ida > t.idaPrevio ? "var-mejor" : t.ida < t.idaPrevio ? "var-peor" : ""}">${t.ida > t.idaPrevio ? "▲" : t.ida < t.idaPrevio ? "▼" : "="}</small>` : ""}</td>
      <td>${t.volumenBajo ? chip("gris", "Volumen bajo") : chip(t.cat.color, t.cat.nombre)}</td>
      ${ks.map(k => `<td class="celda-sem" title="${esc(nombreInd(k))}: ${Motor.fmt(t.ind[k], k)}">${dot(t.est[k])}</td>`).join("")}</tr>`).join("");
    $$("#t-ranking tr.clic").forEach(tr => tr.addEventListener("click", () => abrirExpediente(tr.dataset.nit)));
  }
  function varTxt(a, b) { if (!b) return ""; const v = (a - b) / b * 100; return `${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(1).replace(".", ",")} %`; }
  function abrev(k) {
    return { oportunidad: "Oport.", tiempo_llegada: "T. lleg.", satisfaccion: "Satisf.", insatisfechos: "Insatisf.", reclamaciones: "Reclam.",
      responsabilidad: "Resp.", cancelaciones: "Cancel.", rechazo: "Rechazo", incumplimientos: "Matriz" }[k] || k;
  }

  /* ================= EVOLUCIÓN ================= */
  function vEvolucion() {
    const f = filtro();
    const k = $("#ev-ind").value || "oportunidad";
    const n = +$("#ev-n").value;
    const sems = Motor.semanasHasta(semana, n);
    const m = Motor.metas().indicadores[k];
    const nit = $("#ev-aliado").value;
    $("#ev-titulo").textContent = `${m.nombre} · semana a semana`;
    const ds = [
      { label: "Red", data: Motor.serie(k, f, sems), borderColor: css("--chart-1"), backgroundColor: css("--chart-1"), tension: .25, borderWidth: 2.5, pointRadius: 3 },
      { label: "Meta", data: sems.map(() => m.meta), borderColor: css("--verde"), borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 },
      { label: "Umbral", data: sems.map(() => m.umbral), borderColor: css("--rojo"), borderDash: [2, 4], pointRadius: 0, borderWidth: 1.5 },
    ];
    if (nit) ds.splice(1, 0, { label: Motor.proveedor(nit).razon_social, data: Motor.serie(k, { nit }, sems), borderColor: css("--chart-3"), backgroundColor: css("--chart-3"), tension: .25, borderWidth: 2.5, pointRadius: 3 });
    grafico("g-evol", {
      type: "line", data: { labels: sems, datasets: ds },
      options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${Motor.fmt(c.parsed.y, k)}` } }, legend: { labels: { boxWidth: 14 } } } },
    });
    const ult = Motor.semanasHasta(semana, Math.min(n, 12));
    $("#t-mapa").innerHTML = `<tr><th>Aliado</th>${ult.map(s => `<th class="celda-sem">${s.split("-")[1]}</th>`).join("")}</tr>` +
      Motor.filtrarProvs(f).map(p => `<tr class="clic" data-nit="${p.nit}"><td><b>${esc(p.razon_social)}</b></td>${ult.map(s => {
        const r = Motor.resultado([s], { nit: p.nit });
        const v = r.ind[k];
        const e = r.servicios < Motor.metas().volumen_minimo ? "gris" : Motor.estado(k, v) || "gris";
        return `<td><span class="c ${e}" title="${s} · ${r.servicios} servicios">${Motor.fmt(v, k, false)}</span></td>`;
      }).join("")}</tr>`).join("");
    $$("#t-mapa tr.clic").forEach(tr => tr.addEventListener("click", () => abrirExpediente(tr.dataset.nit)));
  }

  /* ================= ALIADOS / EXPEDIENTE ================= */
  function abrirExpediente(nit) { $("#exp-aliado").value = nit; irA("aliados"); }

  function vAliados() {
    const nit = $("#exp-aliado").value || Motor.proveedores()[0].nit;
    const p = Motor.proveedor(nit);
    const r = Motor.resultado([semana], { nit });
    const cat = Motor.categoria(r.ida);
    const med = Motor.medidaSugerida(nit, semana);
    const al = Motor.alertas(semana, { nit }).filter(a => a.severidad !== "Informativa");
    const critica = med.regla && /suspensi|termina/i.test(med.regla.medida);
    $("#exp-cuerpo").innerHTML = `
      <div class="rejilla r-3-1">
        <div class="ficha">
          <div><small>NIT</small><b>${esc(p.nit)}</b></div><div><small>Servicio</small><b>${esc(p.servicio)}</b></div>
          <div><small>Ciudades</small><b>${esc(p.ciudades.join(", "))}</b></div><div><small>Frecuencia</small><b>${esc(p.frecuencia)}</b></div>
          <div><small>Región</small><b>${esc(p.region)}</b></div><div><small>Líder regional</small><b>${esc(p.lider_regional)}</b></div>
          <div><small>Servicios semana</small><b class="num">${Motor.fmtNum(r.servicios)}</b></div><div><small>Estado</small><b>${esc(p.estado || "activo")}</b></div>
        </div>
        <div><small style="color:var(--ink-3)">IDA ${semana}</small><div style="display:flex;gap:10px;align-items:baseline"><span class="ida-grande num">${r.ida ?? "—"}</span>${r.servicios < Motor.metas().volumen_minimo ? chip("gris", "Volumen bajo") : chip(cat.color, cat.nombre)}</div></div>
      </div>
      ${al.length ? `<h3 style="margin:16px 0 8px;font-size:14px">Alertas de la semana</h3><div class="alertas">${al.map(a => `<div class="alerta"><span class="sev ${a.severidad}">${a.severidad}</span><div><b>${esc(a.tipo)}</b><p>${esc(a.detalle)}</p></div><div></div></div>`).join("")}</div>` : ""}
      <h3 style="margin:16px 0 8px;font-size:14px">Medida sugerida por la matriz</h3>
      <div class="medida ${critica ? "critica" : ""}">${med.regla ? `<b>${esc(med.regla.medida)}</b><br><small>${esc(med.regla.condicion)} · En ${Motor.metas().alertas.ventana_matriz_dias} días: ${med.conteo.critica} crítica(s), ${med.conteo.grave} grave(s), ${med.conteo.leve} leve(s). <b>Propuesta sujeta a debido proceso.</b></small>` : "Sin medida aplicable en la ventana."}</div>
      <div id="exp-ia-resp" class="msg ia oculto" style="max-width:none;margin-top:14px"></div>`;

    const sems = Motor.semanasHasta(semana, 12);
    grafico("g-exp-ida", {
      type: "line",
      data: { labels: sems.map(s => s.split("-")[1]), datasets: [
        { label: p.razon_social, data: sems.map(s => Motor.resultado([s], { nit }).ida), borderColor: css("--chart-3"), backgroundColor: css("--chart-3"), tension: .3, pointRadius: 3 },
        { label: "Red", data: sems.map(s => Motor.resultado([s], {}).ida), borderColor: css("--ink-3"), borderDash: [5, 4], pointRadius: 0, tension: .3 }] },
      options: { maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } }, plugins: { legend: { labels: { boxWidth: 14 } } } },
    });
    const s8 = Motor.semanasHasta(semana, 8);
    $("#t-exp-mapa").innerHTML = `<tr><th>Indicador</th>${s8.map(s => `<th class="celda-sem">${s.split("-")[1]}</th>`).join("")}</tr>` +
      Motor.claves().map(k => `<tr><td>${esc(nombreInd(k))}</td>${s8.map(s => { const v = Motor.resultado([s], { nit }).ind[k]; return `<td><span class="c ${Motor.estado(k, v) || "gris"}">${Motor.fmt(v, k, false)}</span></td>`; }).join("")}</tr>`).join("");
    $("#t-exp-incs").innerHTML = med.lista.length ? `<tr><th>Fecha</th><th>Semana</th><th>Servicio</th><th>Ciudad</th><th>Tipo</th><th>Gravedad</th><th>Estado</th><th>Descripción</th></tr>` +
      med.lista.slice().reverse().map(i => `<tr><td>${esc(i.fecha)}</td><td>${esc(i.semana)}</td><td>${esc(i.servicio_id)}</td><td>${esc(i.ciudad)}</td><td>${esc(i.tipo)}</td><td>${chip(i.gravedad === "critica" ? "rojo" : i.gravedad === "grave" ? "amarillo" : "gris", i.gravedad)}</td><td>${esc(i.estado)}</td><td>${esc(i.descripcion)}</td></tr>`).join("")
      : `<tr><td class="vacio">Sin novedades en la ventana.</td></tr>`;
  }

  /* ================= MATRIZ ================= */
  function vMatriz() {
    const f = filtro();
    const n = +$("#mz-periodo").value;
    const sems = Motor.semanasHasta(semana, n);
    const g = $("#mz-grav").value;
    const rm = Motor.resumenMatriz(sems, f);
    const lista = rm.lista.filter(i => !g || i.gravedad === g).sort((a, b) => b.fecha.localeCompare(a.fecha));
    $("#mz-desc").textContent = `${rm.lista.length} novedades en ${sems.length} semana(s) · ${sems[0]} a ${sems[sems.length - 1]}`;
    const tipos = Object.entries(rm.porTipo).sort((a, b) => b[1] - a[1]);
    grafico("g-mz-tipo", {
      type: "bar", data: { labels: tipos.map(t => t[0]), datasets: [{ data: tipos.map(t => t[1]), backgroundColor: css("--chart-1"), borderRadius: 4 }] },
      options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { precision: 0 } } } },
    });
    const s12 = Motor.semanasHasta(semana, 12);
    const porSem = gr => s12.map(s => Motor.resumenMatriz([s], f).porGrav[gr] || 0);
    grafico("g-mz-sem", {
      type: "bar", data: { labels: s12.map(s => s.split("-")[1]), datasets: [
        { label: "Leve", data: porSem("leve"), backgroundColor: css("--ink-3") },
        { label: "Grave", data: porSem("grave"), backgroundColor: css("--accent") },
        { label: "Crítica", data: porSem("critica"), backgroundColor: css("--rojo") }] },
      options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } }, plugins: { legend: { labels: { boxWidth: 12 } } } },
    });
    $("#t-matriz").innerHTML = lista.length ? `<tr><th>Fecha</th><th>Aliado</th><th>Ciudad</th><th>Servicio</th><th>Tipo</th><th>Gravedad</th><th>Estado</th><th>Responsable</th></tr>` +
      lista.map(i => { const p = Motor.proveedor(i.nit) || {}; return `<tr class="clic" data-nit="${i.nit}"><td>${esc(i.fecha)}</td><td>${esc(p.razon_social || i.nit)}</td><td>${esc(i.ciudad)}</td><td>${esc(i.servicio_id)}</td><td>${esc(i.tipo)}</td><td>${chip(i.gravedad === "critica" ? "rojo" : i.gravedad === "grave" ? "amarillo" : "gris", i.gravedad)}</td><td>${esc(i.estado)}</td><td>${esc(p.lider_regional || "")}</td></tr>`; }).join("")
      : `<tr><td class="vacio">Sin novedades para los filtros.</td></tr>`;
    $$("#t-matriz tr.clic").forEach(tr => tr.addEventListener("click", () => abrirExpediente(tr.dataset.nit)));
  }

  /* ================= AGENTE ================= */
  let atajosListos = false;
  function vAgente() {
    if (!atajosListos) {
      $("#chat-atajos").innerHTML = Agente.ATAJOS.map((a, i) => `<button class="btn peque" data-i="${i}">${esc(a.t)}</button>`).join("");
      $$("#chat-atajos button").forEach(b => b.addEventListener("click", () => enviarChat(Agente.ATAJOS[b.dataset.i].p)));
      atajosListos = true;
    }
    if (!$("#chat-mensajes").children.length) {
      msgSistema(cfg.apiKey
        ? `Hola. Trabajo con la semana <b>${semana}</b> y los filtros activos. Pregúntame o usa un atajo.`
        : `Para conversar con el agente, configura tu API key de Gemini en <a href="#" id="ir-config">Configuración</a>. El tablero, las alertas y los reportes funcionan sin ella.`);
      const a = $("#ir-config"); if (a) a.addEventListener("click", e => { e.preventDefault(); irA("config"); });
    }
  }
  function msgSistema(html) { const d = document.createElement("div"); d.className = "msg sistema"; d.innerHTML = html; $("#chat-mensajes").appendChild(d); }
  function md(t) { return DOMPurify.sanitize(marked.parse(t)); }
  function agregarMsg(rol, contenido, esHTML = false) {
    const d = document.createElement("div");
    d.className = "msg " + rol;
    if (esHTML) d.innerHTML = contenido; else d.textContent = contenido;
    $("#chat-mensajes").appendChild(d);
    $("#chat-mensajes").scrollTop = $("#chat-mensajes").scrollHeight;
    return d;
  }
  async function enviarChat(texto) {
    texto = (texto || $("#chat-txt").value).trim();
    if (!texto) return;
    if (window.MODO_ARTEFACTO) { toast("El chat se habilita al abrir el proyecto desde GitHub Pages o tu computador", 4000); return; }
    if (!cfg.apiKey) { toast("Configura la API key de Gemini primero"); irA("config"); return; }
    $("#chat-txt").value = "";
    agregarMsg("yo", texto);
    const espera = agregarMsg("ia", `<span class="escribiendo"><i></i><i></i><i></i></span>`, true);
    $("#chat-enviar").disabled = true;
    try {
      const r = await Agente.preguntar(texto, { semana, filtro: filtro(), cfg });
      espera.innerHTML = md(r.texto) + `<div style="margin-top:8px;display:flex;gap:6px" class="no-imprimir"><button class="btn peque" data-copiar>Copiar</button></div>`;
      espera.querySelector("[data-copiar]").addEventListener("click", () => { navigator.clipboard.writeText(r.texto).then(() => toast("Copiado")); });
    } catch (e) {
      espera.innerHTML = `<b>No fue posible obtener respuesta.</b><br>${esc(e.message)}`;
    } finally {
      $("#chat-enviar").disabled = false;
      $("#chat-mensajes").scrollTop = $("#chat-mensajes").scrollHeight;
    }
  }

  /* ================= REPORTES ================= */
  function mostrarReporte(rep, tipo) {
    repActual = { ...rep, tipo };
    $("#rep-visor").classList.remove("oculto");
    $("#rep-titulo").textContent = rep.titulo;
    $("#rep-desc").textContent = rep.asunto || "";
    $("#rep-frame").srcdoc = rep.html;
    $("#rep-ia").disabled = !cfg.apiKey;
    $("#rep-ia").title = cfg.apiKey ? "Gemini redacta una lectura ejecutiva con base en los datos" : "Configura la API key para usar esta opción";
    $("#rep-visor").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function generar(tipo) {
    const f = filtro();
    if (tipo === "semanal") mostrarReporte(Reportes.semanal(semana, f), tipo);
    if (tipo === "mensual") mostrarReporte(Reportes.mensualAliado($("#rep-aliado").value, $("#rep-mes").value), tipo);
    if (tipo === "presentacion") mostrarReporte(Reportes.presentacion(semana, f), tipo);
    if (tipo === "expediente") mostrarReporte(Reportes.expediente($("#rep-exp-aliado").value, semana), tipo);
    if (tipo === "mensual-todos") {
      const mes = $("#rep-mes").value;
      const partes = Motor.filtrarProvs(f).map(p => Reportes.mensualAliado(p.nit, mes));
      const cuerpo = partes.map(x => x.html.match(/<body>([\s\S]*)<\/body>/)[1]).join(`<div style="page-break-after:always;height:24px"></div>`);
      mostrarReporte({ titulo: `Informes mensuales · ${Reportes.nombreMes(mes)} (${partes.length} aliados)`, asunto: "Un informe por aliado; imprime o descarga para enviar por separado.",
        html: partes[0].html.replace(/<body>[\s\S]*<\/body>/, `<body>${cuerpo}</body>`), texto: "" }, tipo);
    }
  }
  async function enriquecerIA() {
    if (!repActual || !cfg.apiKey) return;
    const instr = {
      semanal: "Redacta la LECTURA DEL AGENTE para el reporte semanal del equipo: 1 párrafo de conclusión y 3 a 5 viñetas con los hallazgos más relevantes y su accionable (responsable y plazo). Máximo 180 palabras. Solo cifras del bloque.",
      mensual: `Redacta un párrafo cordial y profesional (máx. 120 palabras) dirigido al aliado ${Motor.proveedor($("#rep-aliado").value)?.razon_social} sobre su desempeño del mes, reconociendo fortalezas y señalando con respeto las brechas. No menciones a otros aliados ni datos de otros aliados.`,
      presentacion: "Redacta el MENSAJE CLAVE para el comité gerencial en 3 viñetas ejecutivas (máximo 60 palabras en total) con resultado, riesgo principal y decisión requerida.",
      expediente: `Redacta el análisis del expediente del aliado ${Motor.proveedor($("#rep-exp-aliado").value)?.razon_social}: causa probable según los datos, relación entre indicadores y matriz, y recomendación (como propuesta). Máximo 160 palabras.`,
    }[repActual.tipo];
    if (!instr) { toast("Este reporte no admite lectura del agente"); return; }
    const filtroUsado = repActual.tipo === "mensual" ? { nit: $("#rep-aliado").value } : repActual.tipo === "expediente" ? { nit: $("#rep-exp-aliado").value } : filtro();
    $("#rep-ia").disabled = true; $("#rep-ia").textContent = "Redactando…";
    try {
      const t = await Agente.redactar(instr, { semana, filtro: filtroUsado, cfg });
      const bloque = `<div style="border:1px solid #e1e6e2;border-left:5px solid #0b5a3c;border-radius:8px;padding:12px 16px;margin:16px 0;background:#f7faf8;font-size:14px;line-height:1.5"><div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b7771;margin-bottom:4px">Lectura del agente</div>${md(t)}</div>`;
      repActual.html = repActual.html.replace(/<div id="bloque-ia">[\s\S]*?<\/div><!--fin-ia-->|<div id="bloque-ia"><\/div>/, `<div id="bloque-ia">${bloque}</div><!--fin-ia-->`);
      $("#rep-frame").srcdoc = repActual.html;
      toast("Lectura del agente agregada");
    } catch (e) { toast(e.message, 5000); }
    finally { $("#rep-ia").disabled = false; $("#rep-ia").textContent = "✨ Agregar lectura del agente"; }
  }
  async function copiarReporte() {
    const html = repActual.html;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([repActual.texto || repActual.titulo], { type: "text/plain" }) })]);
      toast("Copiado. Pégalo en el cuerpo del correo (Ctrl+V).");
    } catch {
      const doc = $("#rep-frame").contentDocument;
      const rango = doc.createRange(); rango.selectNodeContents(doc.body);
      const sel = doc.getSelection(); sel.removeAllRanges(); sel.addRange(rango);
      doc.execCommand("copy"); sel.removeAllRanges();
      toast("Copiado. Pégalo en el cuerpo del correo (Ctrl+V).");
    }
  }

  /* ================= CONFIGURACIÓN ================= */
  function vConfig() {
    $("#cfg-key").value = cfg.apiKey || "";
    $("#cfg-recordar").checked = cfg.recordar;
    $("#cfg-modelo").value = cfg.modelo;
    $("#cfg-temp").value = String(cfg.temperatura).replace(".", ",");
    $("#cfg-url-ind").value = cfg.urlIndicadores || "";
    $("#cfg-url-inc").value = cfg.urlIncumplimientos || "";
    $("#cfg-refresco").value = String(cfg.refrescoMin || 0);
    $("#cfg-tema").value = cfg.tema || "";
    if (!$("#lista-modelos").children.length) $("#lista-modelos").innerHTML = CONFIG_DEFECTO.modelosSugeridos.map(m => `<option value="${m}">`).join("");
    $("#cfg-origen").textContent = "Origen actual → " + Object.entries(origen).map(([k, v]) => `${k}: ${v}`).join(" · ");
    $("#cfg-contexto").innerHTML = `<table><tr><th>Archivo</th><th class="num">Caracteres</th><th>Pendientes [COMPLETAR]</th></tr>${Datos.ARCHIVOS_CONTEXTO.map(f => {
      const t = contexto[f] || ""; const p = (t.match(/\[COMPLETAR/g) || []).length;
      return `<tr><td><code>contexto/${f}</code></td><td class="num">${t.length.toLocaleString("es-CO")}</td><td>${p ? chip("amarillo", p + " por completar") : chip("verde", "Completo")}</td></tr>`;
    }).join("")}</table>`;
  }
  function leerFormIA() {
    cfg.apiKey = $("#cfg-key").value.trim();
    cfg.recordar = $("#cfg-recordar").checked;
    cfg.modelo = $("#cfg-modelo").value.trim() || CONFIG_DEFECTO.modelo;
    const t = parseFloat($("#cfg-temp").value.replace(",", "."));
    cfg.temperatura = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : CONFIG_DEFECTO.temperatura;
  }
  async function leerArchivo(input) {
    const f = input.files[0];
    return f ? await f.text() : null;
  }
  function programarRefresco() {
    clearInterval(temporizador);
    if (cfg.refrescoMin > 0) temporizador = setInterval(() => cargarDatos(true), cfg.refrescoMin * 60000);
  }

  /* ================= EVENTOS ================= */
  function enlazar() {
    $$("#nav button").forEach(b => b.addEventListener("click", () => irA(b.dataset.vista)));
    ["#f-semana", "#f-region", "#f-servicio", "#f-frecuencia"].forEach(s => $(s).addEventListener("change", render));
    $("#f-sev").addEventListener("change", vResumen);
    ["#ev-ind", "#ev-aliado", "#ev-n"].forEach(s => $(s).addEventListener("change", vEvolucion));
    $("#exp-aliado").addEventListener("change", vAliados);
    ["#mz-periodo", "#mz-grav"].forEach(s => $(s).addEventListener("change", vMatriz));
    $("#btn-recargar").addEventListener("click", () => cargarDatos());

    $("#exp-informe").addEventListener("click", () => { $("#rep-exp-aliado").value = $("#exp-aliado").value; irA("reportes"); generar("expediente"); });
    $("#exp-ia").addEventListener("click", async () => {
      if (!cfg.apiKey) { toast("Configura la API key de Gemini"); irA("config"); return; }
      const nit = $("#exp-aliado").value; const p = Motor.proveedor(nit);
      const box = $("#exp-ia-resp"); box.classList.remove("oculto"); box.innerHTML = `<span class="escribiendo"><i></i><i></i><i></i></span>`;
      try {
        const t = await Agente.redactar(`Analiza el desempeño del aliado ${p.razon_social} (NIT ${nit}) usando el formato de respuesta estándar: conclusión, semáforo, hallazgos cruzando indicadores con la matriz, accionables con responsable y plazo, y la medida que corresponde según escalamiento (como propuesta).`, { semana, filtro: { nit }, cfg });
        box.innerHTML = md(t);
      } catch (e) { box.textContent = e.message; }
    });

    $("#chat-enviar").addEventListener("click", () => enviarChat());
    $("#chat-txt").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarChat(); } });
    $("#chat-limpiar").addEventListener("click", () => { Agente.limpiar(); $("#chat-mensajes").innerHTML = ""; vAgente(); });

    $$("[data-rep]").forEach(b => b.addEventListener("click", () => generar(b.dataset.rep)));
    $$("[data-csv]").forEach(b => b.addEventListener("click", () => {
      const t = b.dataset.csv, f = filtro();
      const c = t === "alertas" ? Reportes.alertasCSV(semana, f) : t === "bitacora" ? Reportes.bitacoraCSV(semana, f) : Reportes.indicadoresCSV(semana, f);
      descargar(`${t}_${semana}.csv`, c, "text/csv;charset=utf-8");
    }));
    $("#mz-csv").addEventListener("click", () => descargar(`bitacora_${semana}.csv`, Reportes.bitacoraCSV(semana, filtro()), "text/csv;charset=utf-8"));
    $("#rep-ia").addEventListener("click", enriquecerIA);
    $("#rep-copiar").addEventListener("click", copiarReporte);
    $("#rep-descargar").addEventListener("click", () => descargar(repActual.titulo.replace(/[^\wáéíóúñ ·-]/gi, "").replace(/\s+/g, "_") + ".html", repActual.html, "text/html;charset=utf-8"));
    $("#rep-imprimir").addEventListener("click", () => $("#rep-frame").contentWindow.print());
    $("#rep-correo").addEventListener("click", () => {
      const cuerpo = (repActual.texto ? repActual.texto + "\n\n" : "") + "[Pega aquí el reporte con Ctrl+V después de usar «Copiar para correo»]";
      location.href = `mailto:${encodeURIComponent(repActual.destino || "")}?subject=${encodeURIComponent(repActual.asunto || repActual.titulo)}&body=${encodeURIComponent(cuerpo)}`;
    });

    $("#cfg-guardar").addEventListener("click", () => { leerFormIA(); guardarConfig(cfg); actualizarEstadoIA(); toast("Configuración guardada"); });
    $("#cfg-borrar").addEventListener("click", () => { cfg.apiKey = ""; cfg.recordar = false; guardarConfig(cfg); vConfig(); actualizarEstadoIA(); toast("API key eliminada de este navegador"); });
    $("#cfg-probar").addEventListener("click", async () => {
      leerFormIA();
      try {
        toast("Probando conexión…");
        const r = await Gemini.generar({ apiKey: cfg.apiKey, modelo: cfg.modelo, sistema: "Responde solo con la palabra: listo", mensajes: [{ rol: "yo", texto: "Prueba" }], maxTokens: 20 });
        guardarConfig(cfg); actualizarEstadoIA();
        toast(`Conexión correcta con ${cfg.modelo} (${r.texto.trim().slice(0, 20)})`);
      } catch (e) { toast(e.message, 6000); }
    });
    $("#cfg-detectar").addEventListener("click", async () => {
      leerFormIA();
      try {
        const ms = await Gemini.listarModelos(cfg.apiKey);
        $("#lista-modelos").innerHTML = ms.map(m => `<option value="${m}">`).join("");
        toast(`${ms.length} modelos disponibles. Escribe o elige uno en el campo Modelo.`, 4000);
      } catch (e) { toast(e.message, 6000); }
    });
    $("#cfg-fuentes").addEventListener("click", async () => {
      const pares = [["#up-ind", "indicadores"], ["#up-inc", "incumplimientos"], ["#up-prov", "proveedores"], ["#up-metas", "metas"]];
      for (const [sel, nombre] of pares) {
        const t = await leerArchivo($(sel));
        if (t !== null) {
          try { Datos.Sesion.set("subido:" + nombre, /json$/.test($(sel).files[0].name) ? JSON.parse(t) : t); }
          catch { toast(`El archivo de ${nombre} no es válido`, 5000); return; }
        }
      }
      cfg.urlIndicadores = $("#cfg-url-ind").value.trim();
      cfg.urlIncumplimientos = $("#cfg-url-inc").value.trim();
      cfg.refrescoMin = +$("#cfg-refresco").value;
      guardarConfig(cfg); programarRefresco();
      await cargarDatos();
    });
    $("#cfg-restablecer").addEventListener("click", async () => {
      ["indicadores", "incumplimientos", "proveedores", "metas"].forEach(n => Datos.Sesion.del("subido:" + n));
      cfg.urlIndicadores = ""; cfg.urlIncumplimientos = ""; guardarConfig(cfg);
      ["#up-ind", "#up-inc", "#up-prov", "#up-metas"].forEach(s => ($(s).value = ""));
      await cargarDatos();
    });
    $("#cfg-ver-prompt").addEventListener("click", () => {
      const pre = $("#cfg-prompt");
      pre.textContent = Agente.instruccionSistema() + "\n\n──────── EJEMPLO DE DATOS ENVIADOS ────────\n" + Agente.bloqueDatos(semana, filtro());
      pre.classList.toggle("oculto");
    });
    $("#cfg-tema").addEventListener("change", () => { cfg.tema = $("#cfg-tema").value; guardarConfig(cfg); aplicarTema(); render(); });
    if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => render());
  }

  /* ================= INICIO ================= */
  /** Vista publicada como enlace de solo consulta (sin IA, impresión ni descargas) */
  function modoEnlace() {
    if (!window.MODO_ARTEFACTO) return;
    ["#rep-imprimir", "#rep-descargar", "#rep-correo", "#rep-ia", "#mz-csv"].forEach(s => $(s)?.classList.add("oculto"));
    $$("[data-csv]").forEach(b => b.closest(".tarjeta")?.classList.add("oculto"));
    const aviso = `<div class="aviso" style="margin-bottom:12px"><b>Vista de demostración por enlace.</b> Aquí funcionan el tablero, las alertas, los reportes y el portal.
      El chat con Gemini, la impresión a PDF y las descargas se habilitan cuando el proyecto se abre desde GitHub Pages o desde tu computador.</div>`;
    $("#v-agente").insertAdjacentHTML("afterbegin", aviso);
    $("#v-config").insertAdjacentHTML("afterbegin", aviso);
    $("#v-reportes").insertAdjacentHTML("afterbegin", aviso);
    $("#chat-txt").disabled = true; $("#chat-enviar").disabled = true;
    $("#v-config .tarjeta").classList.add("oculto");
  }

  async function iniciar() {
    aplicarTema();
    enlazar();
    contexto = await Datos.cargarContexto();
    Agente.setContexto(contexto);
    await cargarDatos(true);
    modoEnlace();
    programarRefresco();
    const h = location.hash.replace("#", "");
    if (TITULOS[h]) irA(h);
  }
  iniciar();
})();
