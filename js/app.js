/* NOTAK · interfaz. Estado en memoria (S), persistido por Store. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const { fmt, num } = Store;
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
  const ISO = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fechaLarga = d => d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const ICON = {
    inicio: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>', notas: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', stats: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    set: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

  let S = Store.cargar();
  let ui = { vista: "inicio", sel: null, int: null, q: "", calM: null, calSel: null, filtro: "todas", pinBuf: "" };
  let saveT = null, inact = null;

  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { if (!Store.guardar(S)) toast("No he podido guardar (almacenamiento bloqueado)"); }, 250); };
  const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2600); };
  const asig = id => S.asig.find(a => a.id === id);
  const tipoTxt = id => (Store.TIPOS.find(t => t.id === id) || { txt: id }).txt;
  const estChip = e => `<span class="chip c-${e}">${{ ap: "Aprobada", curso: "En curso", su: "Suspendida", sin: "Sin cursar" }[e]}</span>`;
  const resChip = r => `<span class="chip c-${r}">${Store.RES[r]}</span>`;
  const colorEst = e => ({ ap: "var(--ok)", curso: "var(--cur)", su: "var(--bad)", sin: "var(--np)" }[e]);

  /* ───────────── tema ───────────── */
  function aplicarTema() { const t = S.cfg.tema; if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t === "oscuro" ? "dark" : "light"); }

  /* ───────────── reloj ───────────── */
  function tick() {
    const n = new Date(), hm = n.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }), ss = String(n.getSeconds()).padStart(2, "0");
    $$("[data-clock]").forEach(e => { e.innerHTML = e.dataset.clock === "s" ? `${hm}<small>${ss}</small>` : hm; });
    $$("[data-date]").forEach(e => { e.textContent = fechaLarga(n); });
  }
  setInterval(tick, 1000);

  /* ───────────── bloqueo ───────────── */
  const PADS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  function iniciarBloqueo() {
    $("#pad").innerHTML = PADS.map(k => k === "" ? "<span></span>" : `<button type="button" data-k="${k}" class="${k === "⌫" ? "ghost" : ""}" aria-label="${k === "⌫" ? "Borrar" : k}">${k}</button>`).join("");
    $("#pad").onclick = e => { const b = e.target.closest("button"); if (b) teclaPin(b.dataset.k); };
    document.addEventListener("keydown", e => {
      if ($("#lock").hidden) return;
      if (/^\d$/.test(e.key)) teclaPin(e.key); else if (e.key === "Backspace") teclaPin("⌫");
    });
    pintarPuntos();
  }
  const pintarPuntos = () => { const len = Store.sec().len; $("#dots").innerHTML = Array.from({ length: len }, (_, i) => `<i class="${i < ui.pinBuf.length ? "on" : ""}"></i>`).join(""); };
  function bloqueado() { const s = Store.sec(); return s.until > Date.now() ? Math.ceil((s.until - Date.now()) / 1000) : 0; }
  function mensajeBloqueo(txt, err) { const m = $("#lockMsg"); m.textContent = txt; m.classList.toggle("err", !!err); }
  function teclaPin(k) {
    const w = bloqueado(); if (w) { mensajeBloqueo(`Demasiados intentos. Espera ${w} s`, true); return; }
    const s = Store.sec();
    if (k === "⌫") ui.pinBuf = ui.pinBuf.slice(0, -1); else if (ui.pinBuf.length < s.len) ui.pinBuf += k;
    pintarPuntos();
    if (ui.pinBuf.length === s.len) {
      if (Store.hashPin(ui.pinBuf) === s.h) { s.fails = 0; s.until = 0; Store.setSec(s); desbloquear(); }
      else {
        s.fails = (s.fails || 0) + 1; if (s.fails % 5 === 0) s.until = Date.now() + Math.min(300, 15 * 2 ** (s.fails / 5 - 1)) * 1000; Store.setSec(s);
        const d = $("#dots"); d.classList.remove("shake"); void d.offsetWidth; d.classList.add("shake");
        mensajeBloqueo(s.until > Date.now() ? "Demasiados intentos. Espera un momento" : "Código incorrecto", true);
        setTimeout(() => { ui.pinBuf = ""; pintarPuntos(); }, 350);
      }
    }
  }
  function desbloquear() {
    try { sessionStorage.setItem("notak.ok", "1"); } catch (e) {}
    ui.pinBuf = ""; $("#lock").hidden = true; $("#app").hidden = false; mensajeBloqueo("Introduce el código"); pintarPuntos();
    ruta(); armarInactividad(); tick();
  }
  function bloquear() {
    try { sessionStorage.removeItem("notak.ok"); } catch (e) {}
    clearTimeout(inact); ui.pinBuf = ""; pintarPuntos(); mensajeBloqueo("Introduce el código");
    $("#modal").hidden = true; $("#app").hidden = true; $("#lock").hidden = false; tick();
  }
  function armarInactividad() {
    clearTimeout(inact); const min = +S.cfg.auto; if (!min || $("#app").hidden) return;
    inact = setTimeout(bloquear, min * 60000);
  }
  ["pointerdown", "keydown", "wheel"].forEach(ev => document.addEventListener(ev, () => { if (!$("#app").hidden) armarInactividad(); }, { passive: true }));

  /* ───────────── navegación ───────────── */
  const NAV = [["inicio", "Inicio", "inicio"], ["notas", "Asignaturas", "notas"], ["calendario", "Calendario", "cal"], ["estadisticas", "Estadísticas", "stats"], ["ajustes", "Ajustes", "set"]];
  function pintarLateral() {
    $("#side").innerHTML = `<div class="brand"><b>N</b>NOTAK</div>` +
      NAV.map(([id, t, ic]) => `<button class="nav ${ui.vista === id ? "on" : ""}" data-go="${id}">${icon(ic)}<span>${t}</span></button>`).join("") +
      `<div class="sp"></div><button class="nav" data-act="bloquear">${icon("lock")}<span>Bloquear</span></button><div class="mini num" data-clock="m"></div>`;
  }
  function ruta() {
    const h = location.hash.replace(/^#\/?/, "").split("/");
    ui.vista = NAV.some(n => n[0] === h[0]) ? h[0] : "inicio";
    if (ui.vista === "notas" && h[1] && asig(h[1])) { ui.sel = h[1]; ui.vistaNotas = "detail"; } else if (ui.vista === "notas") { ui.vistaNotas = ui.vistaNotas || "list"; if (!h[1]) ui.vistaNotas = window.innerWidth > 760 && ui.sel ? "detail" : "list"; }
    render();
  }
  const ir = (r) => { if (location.hash === "#/" + r) ruta(); else location.hash = "#/" + r; };
  window.addEventListener("hashchange", () => { if (!$("#app").hidden) ruta(); });

  function render() {
    pintarLateral();
    const m = $("#main");
    m.innerHTML = { inicio: vInicio, notas: vNotas, calendario: vCalendario, estadisticas: vEstadisticas, ajustes: vAjustes }[ui.vista]();
    if (ui.vista === "notas") postNotas();
    tick();
  }

  /* ───────────── helpers de calendario ───────────── */
  function eventosDia(f) {
    const out = [];
    for (const i of S.ints) { const a = asig(i.a); if (!a) continue; const evf = i.ev.filter(e => e.f === f);
      evf.forEach(e => out.push({ k: "x", t: "Examen · " + a.n, h: i.hora, lugar: i.lugar, a: a.id, i: i.id, sub: e.n + " · " + tipoTxt(i.conv) }));
      if (i.fecha === f && !evf.length) out.push({ k: "x", t: "Examen · " + a.n, h: i.hora, lugar: i.lugar, a: a.id, i: i.id, sub: tipoTxt(i.conv) }); }
    for (const e of S.ev) if (e.f === f) out.push({ k: e.k === "entrega" ? "x" : "e", t: e.t, h: e.h, id: e.id, sub: e.k === "entrega" ? "Entrega" : "Evento" });
    return out.sort((a, b) => (a.h || "99").localeCompare(b.h || "99"));
  }
  function proximos(n = 6) {
    const hoy = ISO(new Date()), set = [];
    for (const i of S.ints) { const a = asig(i.a); if (!a) continue; const evf = i.ev.filter(e => e.f && e.f >= hoy);
      evf.forEach(e => set.push({ f: e.f, h: i.hora, t: a.n, sub: e.n + " · " + tipoTxt(i.conv) + (i.lugar ? " · " + i.lugar : ""), a: a.id, k: "x" }));
      if (i.fecha && i.fecha >= hoy && !i.ev.some(e => e.f === i.fecha)) set.push({ f: i.fecha, h: i.hora, t: a.n, sub: tipoTxt(i.conv) + (i.lugar ? " · " + i.lugar : ""), a: a.id, k: "x" }); }
    for (const e of S.ev) if (e.f >= hoy) set.push({ f: e.f, h: e.h, t: e.t, sub: e.k === "entrega" ? "Entrega" : "Evento", k: "e" });
    return set.sort((a, b) => (a.f + (a.h || "")).localeCompare(b.f + (b.h || ""))).slice(0, n);
  }
  const relativo = f => { const d = Math.round((parse(f) - parse(ISO(new Date()))) / 864e5); return d === 0 ? "hoy" : d === 1 ? "mañana" : "en " + d + " días"; };
  function mesHTML(y, m, { big = false, mini = false } = {}) {
    const primero = new Date(y, m, 1), off = (primero.getDay() + 6) % 7, hoy = ISO(new Date());
    let h = DIAS.map(d => `<div class="wd">${d}</div>`).join("");
    for (let k = 0; k < 42; k++) {
      const d = new Date(y, m, 1 - off + k); if (k >= 35 && d.getMonth() !== m) break;
      const f = ISO(d), ev = eventosDia(f), fuera = d.getMonth() !== m;
      const cls = ["day", fuera ? "out" : "", (d.getDay() === 0 || d.getDay() === 6) ? "we" : "", f === hoy ? "today" : "", f === ui.calSel && !mini ? "sel" : ""].join(" ");
      const cuerpo = big ? ev.slice(0, 3).map(e => `<em class="ev ${e.k}" style="font-style:normal">${esc((e.h ? e.h + " " : "") + e.t.replace("Examen · ", ""))}</em>`).join("") + (ev.length > 3 ? `<em class="ev" style="font-style:normal">+${ev.length - 3}</em>` : "")
        : `<div class="dot">${ev.slice(0, 3).map(e => `<i class="${e.k}"></i>`).join("")}</div>`;
      h += `<button class="${cls}" data-dia="${f}" aria-label="${f}"><span>${d.getDate()}</span>${cuerpo}</button>`;
    }
    return `<div class="cal ${big ? "big" : ""}">${h}</div>`;
  }
  const mesActual = () => { if (!ui.calM) { const n = new Date(); ui.calM = [n.getFullYear(), n.getMonth()]; } return ui.calM; };

  /* ───────────── INICIO ───────────── */
  function vInicio() {
    const r = Store.resumen(S), n = new Date(), prox = proximos(5), curso = Store.cursoDe();
    if (!S.asig.length) return `<div class="page"><div class="hero"><div class="clock"><div class="t" data-clock="s"></div><div class="d" data-date></div><div class="k">Curso ${curso}</div></div>
      <div class="card empty"><h2>Empieza por tus notas</h2><p>Sube tu Excel o un archivo de copia de seguridad y NOTAK montará las asignaturas, las convocatorias y las medias.</p>
      <p><button class="btn pri" data-act="subir">Subir archivo</button> <button class="btn" data-act="demo">Ver con datos de ejemplo</button></p><p class="small muted">También puedes ir a Asignaturas y añadirlas a mano.</p></div></div></div>`;
    const curs = S.asig.filter(a => Store.estadoAsig(S, a) === "curso");
    const pct = r.total ? r.logrados / r.total : 0, C = 2 * Math.PI * 52;
    return `<div class="page">
      <div class="hero">
        <div class="clock"><div class="t" data-clock="s"></div><div class="d" data-date></div><div class="k">Curso ${curso} · ${curs.length} asignatura${curs.length === 1 ? "" : "s"} en curso</div></div>
        <div class="card"><div class="cal-h"><h2>${MESES[n.getMonth()]} ${n.getFullYear()}</h2><button class="btn sm ghost" data-go="calendario">Abrir</button></div>${mesHTML(n.getFullYear(), n.getMonth(), { mini: true })}</div>
      </div>
      <div class="grid g4" style="margin-bottom:16px">
        <div class="card stat"><b>${r.media === null ? "–" : fmt(r.media)}</b><span>Nota media (ponderada)</span></div>
        <div class="card stat"><b>${r.logrados}<small class="muted" style="font-size:15px;font-weight:500"> / ${r.total}</small></b><span>Créditos superados</span></div>
        <div class="card stat"><b>${r.ap}</b><span>Asignaturas aprobadas de ${r.n}</span></div>
        <div class="card stat"><b>${r.su}</b><span>Pendientes tras suspender</span></div>
      </div>
      <div class="grid g2">
        <div class="card"><h3>Próximos exámenes y eventos</h3>${prox.length ? prox.map(p => { const d = parse(p.f); return `<div class="row"><div class="datebox"><b>${d.getDate()}</b><span>${MESES[d.getMonth()].slice(0, 3)}</span></div><div class="grow"><div class="t">${p.a ? `<button class="link" data-open="${p.a}">${esc(p.t)}</button>` : esc(p.t)}</div><div class="small muted">${p.h ? p.h + " · " : ""}${esc(p.sub)}</div></div><span class="small muted">${relativo(p.f)}</span></div>`; }).join("") : `<p class="muted">Nada a la vista. Añade fechas de examen a tus convocatorias o crea eventos en el calendario.</p>`}</div>
        <div class="card"><h3>En curso</h3>${curs.length ? curs.slice(0, 6).map(a => { const l = Store.intsDe(S, a.id), i = l[l.length - 1], nec = Store.necesaria(i); return `<div class="row"><div class="grow"><div class="t"><button class="link" data-open="${a.id}">${esc(a.n)}</button></div><div class="small muted">${nec.tipo === "ok" ? `Necesitas un ${fmt(nec.n)} en el ${fmt(nec.rem)} % restante` : nec.tipo === "ya" ? "Ya tienes el 5 asegurado" : nec.tipo === "imposible" ? "Ya no llegas al 5 con lo que queda" : "Evaluación completa"}</div></div><b class="num">${fmt(Store.media(i))}</b></div>`; }).join("") : `<p class="muted">No hay asignaturas en curso.</p>`}</div>
        <div class="card" style="display:flex;gap:20px;align-items:center"><div class="ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" cx="60" cy="60" r="52" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg><div class="c"><div><b class="num">${Math.round(pct * 100)}%</b><span class="small muted">del grado</span></div></div></div>
          <div><h3 style="margin-bottom:6px">Progreso</h3><p style="margin:0" class="muted">${r.total - r.logrados} créditos por superar.<br>${r.curso} en curso, ${r.su} suspendida${r.su === 1 ? "" : "s"}, ${r.sin} sin cursar.</p></div></div>
        <div class="card"><h3>Acceso rápido</h3><p style="display:flex;gap:8px;flex-wrap:wrap;margin:0"><button class="btn pri" data-go="notas">Ver asignaturas</button><button class="btn" data-go="estadisticas">Estadísticas</button><button class="btn" data-act="bloquear">Bloquear ahora</button></p></div>
      </div></div>`;
  }

  /* ───────────── ASIGNATURAS ───────────── */
  const filtroAsig = () => {
    const q = ui.q.trim().toLowerCase();
    return S.asig.filter(a => (!q || a.n.toLowerCase().includes(q)) && (ui.filtro === "todas" || Store.estadoAsig(S, a) === ui.filtro));
  };
  function listaHTML() {
    const l = filtroAsig(); if (!l.length) return `<p class="muted" style="padding:14px">${S.asig.length ? "Sin resultados." : "Aún no hay asignaturas."}</p>`;
    let h = "", y = 0;
    for (const a of [...l].sort((a, b) => a.y - b.y)) {
      if (a.y !== y) { y = a.y; h += `<div class="grp">${y}º curso</div>`; }
      const e = Store.estadoAsig(S, a), nf = e === "ap" ? Store.notaFinal(S, a) : Store.ultimaMedia(S, a), us = Store.usadas(S, a.id);
      h += `<button class="it ${ui.sel === a.id ? "on" : ""}" data-sel="${a.id}"><span class="dotc" style="background:${colorEst(e)}"></span><span class="nm">${esc(a.n)}<div class="sub">${a.c} cr · ${us} convoc. usada${us === 1 ? "" : "s"}</div></span><span class="md">${nf === null ? "" : fmt(nf)}</span></button>`;
    }
    return h;
  }
  function vNotas() {
    const filtros = [["todas", "Todas"], ["curso", "En curso"], ["ap", "Aprobadas"], ["su", "Suspendidas"]];
    return `<div class="split" data-v="${ui.vistaNotas || "list"}"><aside class="lst"><div class="lst-h"><div class="top"><h2>Asignaturas</h2><button class="btn pri sm" data-act="nueva-asig">+ Nueva</button></div>
      <input type="text" id="q" placeholder="Buscar…" value="${esc(ui.q)}" autocomplete="off"><select id="flt" aria-label="Filtrar">${filtros.map(([v, t]) => `<option value="${v}" ${ui.filtro === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="lst-b" id="lista">${listaHTML()}</div></aside><section class="det" id="det">${detalleHTML()}</section></div>`;
  }
  function postNotas() {
    $("#q").oninput = e => { ui.q = e.target.value; $("#lista").innerHTML = listaHTML(); };
    $("#flt").onchange = e => { ui.filtro = e.target.value; $("#lista").innerHTML = listaHTML(); };
  }
  function intActual(a) {
    const l = Store.intsDe(S, a.id); if (!l.length) return null;
    return l.find(i => i.id === ui.int) || l[l.length - 1];
  }
  function detalleHTML() {
    const a = asig(ui.sel);
    if (!a) return `<div class="empty" style="padding-top:20vh"><h2>Selecciona una asignatura</h2><p>Aquí verás las notas de cada convocatoria, la calculadora y el historial.</p></div>`;
    const l = Store.intsDe(S, a.id), cur = intActual(a), e = Store.estadoAsig(S, a), nf = Store.notaFinal(S, a), us = Store.usadas(S, a.id);
    return `<div class="det-in"><button class="btn sm ghost back" data-act="volver">‹ Asignaturas</button>
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><h1>${esc(a.n)}</h1><div class="muted">${a.c} créditos · ${a.y}º curso · ${estChip(e)}${nf !== null ? ` · Nota final <b>${fmt(nf)}</b>` : ""} · ${us} convocatoria${us === 1 ? "" : "s"} usada${us === 1 ? "" : "s"}</div></div>
      <div style="display:flex;gap:6px;align-items:flex-start"><button class="btn sm" data-act="editar-asig">Editar</button><button class="btn sm bad" data-act="borrar-asig">Eliminar</button></div></div>
      <div class="tabs">${l.map(i => `<button class="tab ${cur && cur.id === i.id ? "on" : ""}" data-int="${i.id}"><span class="dotc" style="background:${colorEst(i.res === "ap" ? "ap" : i.res === "su" ? "su" : i.res === "curso" ? "curso" : "sin")}"></span>${esc(i.cur)} · ${esc(tipoTxt(i.conv))}</button>`).join("")}<button class="btn sm" data-act="nueva-int">+ Convocatoria</button></div>
      ${cur ? intHTML(a, cur) : `<div class="card empty"><h2>Sin convocatorias</h2><p>Añade una para empezar a apuntar notas. Puedes crear tantas como necesites: ordinaria, extraordinaria, gracia, adelantada o mejora.</p></div>`}</div>`;
  }
  function intHTML(a, i) {
    return `<div class="meta">
      <label class="f"><span>Tipo</span><select data-f="conv">${Store.TIPOS.map(t => `<option value="${t.id}" ${i.conv === t.id ? "selected" : ""}>${t.txt}</option>`).join("")}</select></label>
      <label class="f"><span>Curso académico</span><input type="text" data-f="cur" value="${esc(i.cur)}" placeholder="2025-26"></label>
      <label class="f"><span>Resultado</span><select data-f="res">${Object.entries(Store.RES).map(([k, v]) => `<option value="${k}" ${i.res === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <div class="f"><span>Fecha del examen</span><div style="margin-top:4px">${fechaBtn('data-f="fecha"', i.fecha, "i")}</div></div>
      <label class="f"><span>Hora</span><input type="time" data-f="hora" value="${esc(i.hora || "")}"></label>
      <label class="f"><span>Lugar</span><input type="text" data-f="lugar" value="${esc(i.lugar || "")}" placeholder="Aula…"></label></div>
      <div class="tw"><table class="ev"><thead><tr><th>Evaluación</th><th class="r" style="width:100px">Nota</th><th class="r" style="width:100px">Peso %</th><th style="width:140px">Fecha</th><th class="r" style="width:90px">Aporta</th><th style="width:34px"></th></tr></thead><tbody>
      ${i.ev.map((e, k) => `<tr data-k="${k}"><td><input type="text" data-e="n" value="${esc(e.n)}" aria-label="Nombre"></td><td><input type="number" step="any" min="0" max="10" data-e="v" value="${e.v ?? ""}" aria-label="Nota"></td><td><input type="number" step="any" min="0" max="100" data-e="p" value="${e.p ?? ""}" aria-label="Peso"></td><td>${fechaBtn('data-e="f" aria-label="Fecha"', e.f, "e:" + k)}</td><td class="apo">${fmt((e.v || 0) * (e.p || 0) / 100)}</td><td><button class="btn sm ghost" data-del-ev="${k}" aria-label="Quitar">✕</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted" style="padding:14px">Sin evaluaciones. Añade la primera.</td></tr>`}
      </tbody><tfoot id="tot">${totHTML(i)}</tfoot></table></div>
      <p style="margin:10px 0 0"><button class="btn sm" data-act="nueva-ev">+ Evaluación</button> ${i.ev.length === 0 ? "" : `<button class="btn sm ghost" data-act="igualar">Repartir pesos por igual</button>`}</p>
      <div id="calc">${calcHTML(i)}</div>
      <label class="f" style="margin-top:14px"><span>Comentarios</span><textarea data-f="com" rows="3" placeholder="Qué falló, qué repasar…">${esc(i.com || "")}</textarea></label>
      <p style="margin-top:12px"><button class="btn sm bad" data-act="borrar-int">Eliminar esta convocatoria</button></p>`;
  }
  const totHTML = i => { const p = Store.pesoTotal(i); return `<tr><td>Media de la convocatoria</td><td></td><td class="r num" style="${p > 100.001 ? "color:var(--bad)" : ""}">${fmt(p)}</td><td></td><td class="apo" style="color:var(--fg)">${fmt(Store.media(i))}</td><td></td></tr>`; };
  function calcHTML(i) {
    if (!i.ev.length) return "";
    const p = Store.pesoTotal(i), n = Store.necesaria(i);
    if (p > 100.001) return `<div class="calc bad">Los pesos suman <b>${fmt(p)} %</b>: se pasan del 100 %.</div>`;
    if (n.tipo === "completa") return `<div class="calc ${n.acc >= 5 ? "ok" : "bad"}">Evaluación completa. Media final <b>${fmt(n.acc)}</b> ${n.acc >= 5 ? "· aprobada" : "· por debajo del 5"}.</div>`;
    if (n.tipo === "ya") return `<div class="calc ok">Llevas <b>${fmt(n.acc)}</b> acumulado: el 5 ya está asegurado aunque saques 0 en el ${fmt(n.rem)} % restante.</div>`;
    if (n.tipo === "imposible") return `<div class="calc bad">Con <b>${fmt(n.acc)}</b> acumulado, ni con un 10 en el ${fmt(n.rem)} % restante llegas al 5.</div>`;
    return `<div class="calc">Para aprobar necesitas un <b>${fmt(n.n)}</b> de media en el ${fmt(n.rem)} % pendiente (llevas ${fmt(n.acc)}).</div>`;
  }
  function refrescarDerivados() {
    const a = asig(ui.sel), i = a && intActual(a); if (!i) return;
    $("#tot").innerHTML = totHTML(i); $("#calc").innerHTML = calcHTML(i);
    $$("#det tbody tr[data-k]").forEach(tr => { const e = i.ev[+tr.dataset.k]; if (e) $(".apo", tr).textContent = fmt((e.v || 0) * (e.p || 0) / 100); });
    $("#lista").innerHTML = listaHTML();
  }
  function reDetalle() { $("#det").innerHTML = detalleHTML(); $("#lista").innerHTML = listaHTML(); }

  document.addEventListener("input", e => {
    const t = e.target, a = asig(ui.sel); if (!a || ui.vista !== "notas") return;
    const i = intActual(a); if (!i) return;
    if (t.dataset.e === "f") return;
    if (t.dataset.e) { const row = t.closest("tr"), ev = i.ev[+row.dataset.k]; ev[t.dataset.e] = ["n", "f"].includes(t.dataset.e) ? t.value : num(t.value); save(); refrescarDerivados(); }
    else if (t.dataset.f && ["cur", "lugar", "com"].includes(t.dataset.f)) { i[t.dataset.f] = t.value; save(); if (t.dataset.f === "cur") $$(".tab.on").forEach(b => b.lastChild.textContent = ` ${i.cur} · ${tipoTxt(i.conv)}`.replace(/^ /, "")); }
  });
  document.addEventListener("change", e => {
    const t = e.target, a = asig(ui.sel); if (!a || ui.vista !== "notas") return;
    const i = intActual(a); if (!i) return;
    if (t.dataset.e === "f") { i.ev[+t.closest("tr").dataset.k].f = t.value; save(); return reDetalle(); }
    if (!t.dataset.f) return;
    const f = t.dataset.f; if (["cur", "lugar", "com"].includes(f)) return;
    i[f] = t.value; save(); if (f === "conv" || f === "res" || f === "fecha") reDetalle(); else $("#lista").innerHTML = listaHTML();
  });

  /* ───────────── CALENDARIO ───────────── */
  function vCalendario() {
    const [y, m] = mesActual(), sel = ui.calSel || ISO(new Date()), evs = eventosDia(sel);
    return `<div class="page"><div class="ph"><h1>Calendario</h1><div style="display:flex;gap:6px"><button class="btn" data-act="mes-prev" aria-label="Mes anterior">‹</button><button class="btn" data-act="mes-hoy">Hoy</button><button class="btn" data-act="mes-next" aria-label="Mes siguiente">›</button></div></div>
      <div class="cal-wrap"><div class="card"><div class="cal-h"><h2>${MESES[m]} ${y}</h2></div>${mesHTML(y, m, { big: true })}</div>
      <div class="card"><h3>${fechaLarga(parse(sel))}</h3>${evs.length ? evs.map(e => `<div class="row"><div class="grow"><div class="t">${e.a ? `<button class="link" data-open="${e.a}">${esc(e.t)}</button>` : esc(e.t)}</div><div class="small muted">${e.h ? e.h + " · " : ""}${esc(e.sub || "")}${e.lugar ? " · " + esc(e.lugar) : ""}</div></div>${e.id ? `<button class="btn sm ghost" data-del-evento="${e.id}" aria-label="Borrar">✕</button>` : ""}</div>`).join("") : `<p class="muted">Sin nada este día.</p>`}
        <p><button class="btn pri" data-act="nuevo-evento">+ Añadir evento</button></p><p class="small muted">Las fechas de examen se toman de cada convocatoria (pestaña Asignaturas).</p></div></div></div>`;
  }

  /* ───────────── ESTADÍSTICAS ───────────── */
  function vEstadisticas() {
    const r = Store.resumen(S); if (!r.finales.length && !S.asig.length) return `<div class="page"><div class="ph"><h1>Estadísticas</h1></div><div class="card empty"><h2>Sin datos todavía</h2><p>Importa tus notas desde Ajustes.</p></div></div>`;
    const fin = [...r.finales].sort((a, b) => b.nf - a.nf);
    const cubos = [[5, 6], [6, 7], [7, 8], [8, 9], [9, 10.01]].map(([a, b]) => ({ t: a + "–" + (b > 10 ? 10 : b), n: fin.filter(f => f.nf >= a && f.nf < b).length }));
    const mx = Math.max(1, ...cubos.map(c => c.n));
    const porCurso = [1, 2, 3, 4, 5, 6].map(y => { const l = S.asig.filter(a => a.y === y); if (!l.length) return null; const ap = l.filter(a => Store.estadoAsig(S, a) === "ap"); return { y, tot: l.reduce((s, a) => s + a.c, 0), ok: ap.reduce((s, a) => s + a.c, 0) }; }).filter(Boolean);
    const tipos = Store.TIPOS.map(t => ({ t: t.txt, n: S.ints.filter(i => i.conv === t.id && (i.res === "ap" || i.res === "su")).length, ap: S.ints.filter(i => i.conv === t.id && i.res === "ap").length })).filter(x => x.n);
    const acad = {}; S.ints.filter(i => i.res === "ap" || i.res === "su").forEach(i => { (acad[i.cur] ||= { ap: 0, su: 0 })[i.res]++; });
    return `<div class="page"><div class="ph"><h1>Estadísticas</h1></div>
      <div class="grid g4" style="margin-bottom:16px"><div class="card stat"><b>${r.media === null ? "–" : fmt(r.media)}</b><span>Media ponderada por créditos</span></div><div class="card stat"><b>${r.mediaSimple === null ? "–" : fmt(r.mediaSimple)}</b><span>Media simple</span></div><div class="card stat"><b>${fin.length ? fmt(fin[0].nf) : "–"}</b><span>${fin.length ? esc(fin[0].a.n) : "Mejor nota"}</span></div><div class="card stat"><b>${S.ints.filter(i => i.res === "su").length}</b><span>Convocatorias suspendidas</span></div></div>
      <div class="grid g2"><div class="card"><h3>Notas finales</h3>${fin.length ? fin.map(f => `<div class="hb"><span class="l" title="${esc(f.a.n)}">${esc(f.a.n)}</span><div class="bar"><i style="width:${f.nf * 10}%"></i></div><b>${fmt(f.nf)}</b></div>`).join("") : `<p class="muted">Aún no hay asignaturas aprobadas.</p>`}</div>
      <div style="display:grid;gap:16px;align-content:start"><div class="card"><h3>Distribución de notas</h3><div class="cols">${cubos.map(c => `<div><b>${c.n}</b><i style="height:${c.n / mx * 100}%"></i>${c.t}</div>`).join("")}</div></div>
      <div class="card"><h3>Créditos por curso</h3>${porCurso.map(c => `<div class="hb"><span class="l">${c.y}º curso</span><div class="bar"><i style="width:${c.ok / c.tot * 100}%"></i></div><b>${c.ok}/${c.tot}</b></div>`).join("")}</div></div>
      <div class="card"><h3>Convocatorias por tipo</h3>${tipos.length ? tipos.map(t => `<div class="row"><div class="grow t">${t.t}</div><span class="small muted">${t.ap} aprobadas de ${t.n}</span></div>`).join("") : `<p class="muted">Sin convocatorias cerradas.</p>`}</div>
      <div class="card"><h3>Por curso académico</h3>${Object.keys(acad).sort().reverse().map(c => `<div class="row"><div class="grow t">${esc(c)}</div><span class="chip c-ap">${acad[c].ap} aprobadas</span><span class="chip c-su">${acad[c].su} suspendidas</span></div>`).join("") || `<p class="muted">Sin datos.</p>`}</div></div></div>`;
  }

  /* ───────────── AJUSTES ───────────── */
  function vAjustes() {
    const s = Store.sec();
    return `<div class="page"><div class="ph"><h1>Ajustes</h1></div><div class="set">
      <div class="card"><h3>Importar notas</h3><div class="drop" id="drop"><p style="margin:0 0 10px"><b>Arrastra aquí tu archivo</b> o elige uno</p><p class="small muted" style="margin:0 0 12px">Admite el Excel <b>NOTAK.xlsx</b> (hoja «Notas») y las copias de seguridad <b>.json</b> de NOTAK.</p><button class="btn pri" data-act="subir">Elegir archivo…</button></div>
        <input type="file" id="file" accept=".xlsx,.json,application/json" hidden></div>
      <div class="card"><h3>Seguridad</h3><div class="line"><div><b>Código de acceso</b><div class="small muted">Barrera de acceso en este navegador (${s.len} dígitos).</div></div><button class="btn" data-act="cambiar-pin">Cambiar código</button></div>
        <div class="line"><div><b>Bloqueo automático</b><div class="small muted">Tras un rato sin tocar nada.</div></div><select id="auto" style="width:auto">${[[0, "Nunca"], [1, "1 minuto"], [5, "5 minutos"], [15, "15 minutos"], [30, "30 minutos"]].map(([v, t]) => `<option value="${v}" ${+S.cfg.auto === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="line"><div><b>Bloquear ahora</b></div><button class="btn" data-act="bloquear">Bloquear</button></div></div>
      <div class="card"><h3>Apariencia</h3><div class="line"><div><b>Tema</b></div><select id="tema" style="width:auto">${[["auto", "Automático"], ["claro", "Claro"], ["oscuro", "Oscuro"]].map(([v, t]) => `<option value="${v}" ${S.cfg.tema === v ? "selected" : ""}>${t}</option>`).join("")}</select></div></div>
      <div class="card"><h3>Datos</h3><p class="muted" style="margin-top:0">Todo se guarda solo en este navegador. Haz copias de vez en cuando.</p>
        <div class="line"><div><b>Copia de seguridad (.json)</b><div class="small muted">Se puede volver a subir aquí.</div></div><button class="btn" data-act="exp-json">Descargar</button></div>
        <div class="line"><div><b>Tabla de convocatorias (.csv)</b><div class="small muted">Para abrir en Excel.</div></div><button class="btn" data-act="exp-csv">Descargar</button></div>
        <div class="line"><div><b>Borrar todos los datos</b><div class="small muted">No afecta al código de acceso.</div></div><button class="btn bad" data-act="reset">Borrar…</button></div></div>
      <p class="small muted">NOTAK · ${S.asig.length} asignaturas · ${S.ints.length} convocatorias</p></div></div>`;
  }
  document.addEventListener("change", e => {
    if (e.target.id === "auto") { S.cfg.auto = +e.target.value; save(); armarInactividad(); toast("Bloqueo automático actualizado"); }
    if (e.target.id === "tema") { S.cfg.tema = e.target.value; save(); aplicarTema(); }
    if (e.target.id === "file" && e.target.files[0]) importar(e.target.files[0]);
  });
  document.addEventListener("dragover", e => { const d = e.target.closest("#drop"); if (d) { e.preventDefault(); d.classList.add("over"); } });
  document.addEventListener("dragleave", e => { const d = e.target.closest("#drop"); if (d) d.classList.remove("over"); });
  document.addEventListener("drop", e => { const d = e.target.closest("#drop"); if (d) { e.preventDefault(); d.classList.remove("over"); if (e.dataTransfer.files[0]) importar(e.dataTransfer.files[0]); } });

  async function importar(file) {
    let N; try { N = await Store.importarArchivo(file); } catch (err) { toast("No he podido leer el archivo (" + (err && err.message || err) + ")"); return; }
    const aplicar = () => { N.cfg = S.cfg; S = N; Store.guardar(S); ui.sel = null; ui.int = null; toast(`Importadas ${N.asig.length} asignaturas y ${N.ints.length} convocatorias`); ir("notas"); };
    if (!S.asig.length) aplicar(); else modal("Importar archivo", `<p>El archivo trae <b>${N.asig.length}</b> asignaturas y <b>${N.ints.length}</b> convocatorias. Ahora tienes ${S.asig.length} asignaturas.</p><p class="muted">Importar sustituye lo que hay ahora. Descarga antes una copia si no quieres perderlo.</p>`, [{ t: "Cancelar" }, { t: "Reemplazar todo", c: "pri", fn: aplicar }]);
  }
  function descargar(nombre, texto, tipo) {
    const b = new Blob([texto], { type: tipo }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ───────────── modales ───────────── */
  function modal(titulo, cuerpo, acciones, onOpen) {
    const m = $("#modal"); m.hidden = false;
    m.innerHTML = `<div class="mbox" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><h2>${esc(titulo)}</h2><div class="fs">${cuerpo}</div><div class="acts">${acciones.map((a, k) => `<button class="btn ${a.c || ""}" data-m="${k}">${esc(a.t)}</button>`).join("")}</div></div>`;
    const cerrar = () => { m.hidden = true; m.innerHTML = ""; };
    m.onclick = e => {
      if (e.target === m) return cerrar();
      const b = e.target.closest("[data-m]"); if (!b) return;
      const a = acciones[+b.dataset.m]; if (a.fn && a.fn($(".mbox")) === false) return; cerrar();
    };
    const f = $("input,select", m); if (f) f.focus();
    if (onOpen) onOpen($(".mbox"));
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) { $("#modal").hidden = true; } if (e.key === "Enter" && !$("#modal").hidden && e.target.tagName === "INPUT") { const p = $("#modal .btn.pri"); if (p) p.click(); } });
  const val = (r, n) => $(`[name=${n}]`, r).value;
  const fechaBtn = (attrs, v, extra = "") => v
    ? `<span class="fd"><input type="date" ${attrs} value="${esc(v)}"><button class="btn sm ghost" data-clearf="${esc(extra)}" aria-label="Quitar fecha">✕</button></span>`
    : `<button type="button" class="btn sm ghost" data-addf='${attrs.replace(/'/g, "&#39;")}'>+ Añadir fecha</button>`;
  const campo = (n, t, v = "", tipo = "text", extra = "") => `<label class="f"><span>${t}</span><input type="${tipo}" name="${n}" value="${esc(v)}" ${extra}></label>`;

  function dlgAsig(a) {
    modal(a ? "Editar asignatura" : "Nueva asignatura", `${campo("n", "Nombre", a ? a.n : "")}${campo("c", "Créditos", a ? a.c : 6, "number", 'min="0" step="any"')}
      <label class="f"><span>Curso del grado</span><select name="y">${[1, 2, 3, 4, 5, 6].map(y => `<option value="${y}" ${(a ? a.y : 1) === y ? "selected" : ""}>${y}º</option>`).join("")}</select></label>`,
      [{ t: "Cancelar" }, { t: "Guardar", c: "pri", fn: r => {
        const n = val(r, "n").trim(); if (!n) { toast("Pon un nombre"); return false; }
        const d = { n, c: num(val(r, "c")) ?? 6, y: +val(r, "y") };
        if (a) Object.assign(a, d); else { const x = { id: Store.uid("a"), ...d }; S.asig.push(x); ui.sel = x.id; ui.vistaNotas = "detail"; }
        save(); render();
      } }]);
  }
  function dlgInt() {
    const a = asig(ui.sel); if (!a) return;
    const l = Store.intsDe(S, a.id), u = l[l.length - 1], cc = Store.cursoDe();
    let cur = cc, conv = "Ordinaria";
    if (u) { if (u.conv === "Ordinaria" && u.cur >= cc) { cur = u.cur; conv = "Extraordinaria"; } else { cur = u.cur < cc ? cc : Store.siguienteCurso(u.cur); } }
    modal("Nueva convocatoria · " + a.n, `<label class="f"><span>Tipo</span><select name="conv">${Store.TIPOS.map(t => `<option value="${t.id}" ${conv === t.id ? "selected" : ""}>${t.txt} — ${t.desc}</option>`).join("")}</select></label>
      ${campo("cur", "Curso académico", cur)}${campo("fecha", "Fecha del examen (opcional)", "", "date")}
      <label class="f"><span>Evaluaciones</span><select name="copia"><option value="1">Copiar la estructura de la anterior (sin notas)</option><option value="0">Empezar vacía</option></select></label>`,
      [{ t: "Cancelar" }, { t: "Crear", c: "pri", fn: r => {
        const base = l.filter(x => x.ev.length).pop();
        const ev = val(r, "copia") === "1" && base ? base.ev.map(e => ({ n: e.n, v: null, p: e.p, f: "" })) : [{ n: "Nota 1", v: null, p: 100 }];
        const i = { id: Store.uid("i"), a: a.id, cur: val(r, "cur").trim() || cc, conv: val(r, "conv"), ev, res: "curso", com: "", fecha: val(r, "fecha"), hora: "", lugar: "" };
        S.ints.push(i); ui.int = i.id; save(); reDetalle(); toast("Convocatoria creada");
      } }]);
  }
  function dlgEvento() {
    const f = ui.calClick || "";
    modal("Nuevo evento", `${campo("t", "Título", "")}${campo("f", "Fecha", f, "date")}${campo("h", "Hora (opcional)", "", "time")}<label class="f"><span>Tipo</span><select name="k"><option value="otro">Evento</option><option value="entrega">Entrega</option></select></label>`,
      [{ t: "Cancelar" }, { t: "Añadir", c: "pri", fn: r => {
        const t = val(r, "t").trim(), d = val(r, "f"); if (!t || !d) { toast(!t ? "Pon un título" : "Elige una fecha para el evento"); return false; }
        S.ev.push({ id: Store.uid("e"), f: d, h: val(r, "h"), t, k: val(r, "k") }); ui.calSel = d; save(); render();
      } }]);
  }
  function dlgPin() {
    modal("Cambiar código", `${campo("a", "Código actual", "", "password", 'inputmode="numeric" autocomplete="off"')}${campo("n", "Código nuevo (4 a 8 dígitos)", "", "password", 'inputmode="numeric" autocomplete="off"')}${campo("n2", "Repite el código nuevo", "", "password", 'inputmode="numeric" autocomplete="off"')}`,
      [{ t: "Cancelar" }, { t: "Cambiar", c: "pri", fn: r => {
        const s = Store.sec(), a = val(r, "a"), n = val(r, "n");
        if (Store.hashPin(a) !== s.h) { toast("El código actual no es correcto"); return false; }
        if (!/^\d{4,8}$/.test(n)) { toast("El nuevo código debe tener de 4 a 8 dígitos"); return false; }
        if (n !== val(r, "n2")) { toast("Los códigos nuevos no coinciden"); return false; }
        Store.setSec({ h: Store.hashPin(n), len: n.length, fails: 0, until: 0 }); pintarPuntos(); toast("Código cambiado");
      } }]);
  }

  /* ───────────── eventos globales ───────────── */
  document.addEventListener("click", e => {
    const t = e.target.closest("button,[data-dia]"); if (!t) return;
    const D = t.dataset;
    if (D.addf !== undefined) { const h = document.createElement("div"); h.innerHTML = `<input type="date" ${D.addf}>`; const inp = h.firstChild; t.replaceWith(inp); inp.focus(); try { inp.showPicker(); } catch (er) {} return; }
    if (D.clearf !== undefined) { const a0 = asig(ui.sel), i0 = a0 && intActual(a0); if (i0) { if (D.clearf === "i") i0.fecha = ""; else i0.ev[+D.clearf.slice(2)].f = ""; save(); reDetalle(); } return; }
    if (D.go) return ir(D.go);
    if (D.open) { ui.sel = D.open; ui.int = null; ui.vistaNotas = "detail"; return ir("notas/" + D.open); }
    if (D.sel) { ui.sel = D.sel; ui.int = null; ui.vistaNotas = "detail"; $("#det").innerHTML = detalleHTML(); $("#lista").innerHTML = listaHTML(); $(".split").dataset.v = "detail"; return; }
    if (D.int) { ui.int = D.int; return reDetalle(); }
    if (D.dia) { ui.calClick = D.dia; if (ui.vista === "calendario") { ui.calSel = D.dia; const d = parse(D.dia); ui.calM = [d.getFullYear(), d.getMonth()]; return render(); } ui.calSel = D.dia; return ir("calendario"); }
    if (D.delEv !== undefined) { const a = asig(ui.sel), i = intActual(a); i.ev.splice(+D.delEv, 1); save(); return reDetalle(); }
    if (D.delEvento) { S.ev = S.ev.filter(x => x.id !== D.delEvento); save(); return render(); }
    const act = D.act; if (!act) return;
    const a = asig(ui.sel), i = a && intActual(a);
    switch (act) {
      case "bloquear": return bloquear();
      case "volver": ui.vistaNotas = "list"; $(".split").dataset.v = "list"; return;
      case "nueva-asig": return dlgAsig();
      case "editar-asig": return dlgAsig(a);
      case "borrar-asig": return modal("Eliminar asignatura", `<p>Se borrará <b>${esc(a.n)}</b> con todas sus convocatorias.</p>`, [{ t: "Cancelar" }, { t: "Eliminar", c: "bad", fn: () => { S.ints = S.ints.filter(x => x.a !== a.id); S.asig = S.asig.filter(x => x.id !== a.id); ui.sel = null; ui.vistaNotas = "list"; save(); render(); } }]);
      case "nueva-int": return dlgInt();
      case "borrar-int": return modal("Eliminar convocatoria", `<p>¿Eliminar la convocatoria <b>${esc(i.cur)} · ${esc(tipoTxt(i.conv))}</b>?</p>`, [{ t: "Cancelar" }, { t: "Eliminar", c: "bad", fn: () => { S.ints = S.ints.filter(x => x.id !== i.id); ui.int = null; save(); reDetalle(); } }]);
      case "nueva-ev": i.ev.push({ n: "Nota " + (i.ev.length + 1), v: null, p: 0, f: "" }); save(); reDetalle(); return $$("#det tbody tr:last-child input")[0]?.select();
      case "igualar": { const p = Math.round(10000 / i.ev.length) / 100; i.ev.forEach(e => e.p = p); save(); return reDetalle(); }
      case "mes-prev": case "mes-next": { const [y, m] = mesActual(), d = new Date(y, m + (act === "mes-next" ? 1 : -1), 1); ui.calM = [d.getFullYear(), d.getMonth()]; return render(); }
      case "mes-hoy": ui.calM = null; ui.calSel = ISO(new Date()); ui.calClick = null; return render();
      case "nuevo-evento": return dlgEvento();
      case "subir": { let f = $("#file"); if (!f) { f = document.createElement("input"); f.type = "file"; f.id = "file"; f.accept = ".xlsx,.json,application/json"; f.hidden = true; document.body.appendChild(f); } return f.click(); }
      case "demo": S = Store.demo(); Store.guardar(S); toast("Datos de ejemplo cargados"); return render();
      case "cambiar-pin": return dlgPin();
      case "exp-json": descargar("notak-copia-" + ISO(new Date()) + ".json", Store.aJSON(S), "application/json"); return toast("Copia descargada");
      case "exp-csv": descargar("notak-convocatorias-" + ISO(new Date()) + ".csv", Store.aCSV(S), "text/csv;charset=utf-8"); return toast("CSV descargado");
      case "reset": return modal("Borrar todos los datos", `<p>Se eliminarán todas las asignaturas, convocatorias y eventos de este navegador. No se puede deshacer.</p>`, [{ t: "Cancelar" }, { t: "Borrar todo", c: "bad", fn: () => { const c = S.cfg; S = Store.vacio(); S.cfg = c; Store.guardar(S); ui.sel = null; toast("Datos borrados"); render(); } }]);
    }
  });

  /* ───────────── arranque ───────────── */
  aplicarTema(); iniciarBloqueo(); tick();
  let ok = false; try { ok = sessionStorage.getItem("notak.ok") === "1"; } catch (e) {}
  if (ok) desbloquear();
  window.__notak = { get S() { return S; } };
})();
