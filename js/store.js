/* Modelo de datos, cálculos y persistencia de NOTAK. Sin dependencias de DOM salvo localStorage. */
const Store = (() => {
  const KEY = "notak.v2", SEC = "notak.sec";
  const PIN_HASH = "32f21c92c2e53ded41cdc10057763ff3c4ada7e3e6e0d62eb34a506848367bfc"; // notak:1159
  const TIPOS = [
    { id: "Ordinaria", txt: "Ordinaria", desc: "Primera convocatoria del curso" },
    { id: "Extraordinaria", txt: "Extraordinaria", desc: "Recuperación (julio / septiembre)" },
    { id: "Gracia", txt: "Gracia / Tribunal", desc: "Convocatoria de gracia o ante tribunal" },
    { id: "Adelantada", txt: "Adelantada", desc: "Convocatoria adelantada (diciembre…)" },
    { id: "Mejora", txt: "Mejora de nota", desc: "Para subir la nota de una asignatura aprobada" }
  ];
  const RES = { curso: "En curso", ap: "Aprobada", su: "Suspendida", np: "No presentado" };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const num = s => { if (s === null || s === undefined) return null; const t = String(s).trim().replace(",", "."); if (t === "") return null; const n = parseFloat(t); return isNaN(n) ? null : n; };
  const r2 = n => Math.round(n * 100) / 100;
  const fmt = n => n === null || n === undefined || isNaN(n) ? "–" : (Math.round(n * 100) / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 });
  const cursoDe = (f = new Date()) => { const y = f.getFullYear(), a = f.getMonth() >= 8 ? y : y - 1; return a + "-" + String((a + 1) % 100).padStart(2, "0"); };
  const siguienteCurso = c => { const a = parseInt(c, 10) + 1; return a + "-" + String((a + 1) % 100).padStart(2, "0"); };

  /* —— cálculos —— */
  const media = i => r2(i.ev.reduce((s, e) => s + (e.v || 0) * (e.p || 0) / 100, 0));
  const pesoTotal = i => r2(i.ev.reduce((s, e) => s + (e.p || 0), 0));
  const intsDe = (S, id) => S.ints.filter(i => i.a === id).sort((a, b) => a.cur === b.cur ? orden(a) - orden(b) : (a.cur < b.cur ? -1 : 1));
  const orden = i => ["Adelantada", "Ordinaria", "Extraordinaria", "Gracia", "Mejora"].indexOf(i.conv);
  const usadas = (S, id) => S.ints.filter(i => i.a === id && (i.res === "ap" || i.res === "su")).length;
  const estadoAsig = (S, a) => {
    const l = intsDe(S, a.id);
    if (l.some(i => i.res === "ap")) return "ap";
    if (l.length && l[l.length - 1].res === "curso") return "curso";
    if (l.some(i => i.res === "su")) return "su";
    return "sin";
  };
  const notaFinal = (S, a) => { const l = intsDe(S, a.id).filter(i => i.res === "ap"); return l.length ? Math.max(...l.map(media)) : null; };
  const ultimaMedia = (S, a) => { const l = intsDe(S, a.id).filter(i => i.ev.length); return l.length ? media(l[l.length - 1]) : null; };
  const necesaria = i => {
    const hecho = i.ev.filter(e => e.v !== null && e.v !== undefined);
    const rem = r2(100 - hecho.reduce((s, e) => s + (e.p || 0), 0)), acc = media(i);
    if (rem <= 0.0001) return { tipo: "completa", acc };
    const n = (5 - acc) / (rem / 100);
    return { tipo: n <= 0 ? "ya" : n > 10 ? "imposible" : "ok", n: r2(Math.max(n, 0)), rem, acc };
  };
  const resumen = S => {
    const r = { total: 0, logrados: 0, ap: 0, curso: 0, su: 0, sin: 0, n: S.asig.length, media: null, mediaSimple: null, finales: [] };
    let sp = 0, sc = 0, ss = 0;
    for (const a of S.asig) {
      r.total += a.c; const e = estadoAsig(S, a); r[e]++;
      if (e === "ap") { r.logrados += a.c; const nf = notaFinal(S, a); r.finales.push({ a, nf }); sp += nf * a.c; sc += a.c; ss += nf; }
    }
    if (sc) { r.media = r2(sp / sc); r.mediaSimple = r2(ss / r.finales.length); }
    return r;
  };

  /* —— estado y persistencia —— */
  const vacio = () => ({ v: 2, rev: 1, asig: [], ints: [], ev: [], cfg: { tema: "auto", auto: 5 } });
  const normalizar = o => {
    const S = vacio();
    if (!o || !Array.isArray(o.asig)) throw new Error("El archivo no tiene el formato de NOTAK");
    S.asig = o.asig.map((a, k) => ({ id: String(a.id || uid("a")), n: String(a.n || a.nombre || "Asignatura " + (k + 1)), c: num(a.c ?? a.creditos) ?? 6, y: Math.min(6, Math.max(1, parseInt(a.y ?? a.curso, 10) || 1)) }));
    const ids = new Set(S.asig.map(a => a.id));
    S.ints = (o.ints || []).filter(i => ids.has(i.a)).map(i => ({
      id: String(i.id || uid("i")), a: i.a, cur: String(i.cur || cursoDe()), conv: TIPOS.some(t => t.id === i.conv) ? i.conv : "Ordinaria",
      ev: (i.ev || []).map(e => ({ n: String(e.n ?? ""), v: num(e.v), p: num(e.p) })), res: RES[i.res] ? i.res : "curso",
      com: String(i.com || ""), fecha: i.fecha || "", hora: i.hora || "", lugar: i.lugar || ""
    }));
    S.ev = (o.ev || []).filter(e => e && e.f).map(e => ({ id: String(e.id || uid("e")), f: e.f, h: e.h || "", t: String(e.t || "Evento"), k: e.k || "otro" }));
    if (o.cfg) S.cfg = { tema: o.cfg.tema || "auto", auto: o.cfg.auto ?? 5 };
    return S;
  };
  const cargar = () => { try { const t = localStorage.getItem(KEY); if (t) return normalizar(JSON.parse(t)); } catch (e) {} return vacio(); };
  const guardar = S => { try { S.rev++; localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; } };
  const borrarTodo = () => { try { localStorage.removeItem(KEY); } catch (e) {} };

  /* —— seguridad (PIN) —— */
  const hashPin = p => sha256("notak:" + p);
  const sec = () => { try { const s = JSON.parse(localStorage.getItem(SEC)); if (s && s.h) return s; } catch (e) {} return { h: PIN_HASH, len: 4, fails: 0, until: 0 }; };
  const setSec = s => { try { localStorage.setItem(SEC, JSON.stringify(s)); } catch (e) {} };

  /* —— importación —— */
  const emojiRes = v => v === "✅" ? "ap" : v === "❌" ? "su" : (typeof v === "string" && /^n\.?\s?p/i.test(v)) ? "np" : null;
  const etiqueta = (s, k) => { if (typeof s !== "string" || !s.trim()) return "Nota " + k; s = s.trim(); return s.length <= 3 ? s.toUpperCase() : s[0].toUpperCase() + s.slice(1).toLowerCase(); };
  async function importarXlsx(buf) {
    const hojas = await XlsxLite.abrir(buf);
    const h = hojas.find(x => /^notas$/i.test(x.nombre)) || hojas[0];
    if (!h) throw new Error("El Excel no tiene hojas");
    const S = vacio(), cur = cursoDe();
    for (let r = 4; r <= 90; r++) {
      const nombre = h.get(r, 2);
      if (typeof nombre !== "string" || !nombre.trim() || r % 2 !== 0) continue;
      const c = num(h.get(r, 1)); if (c === null) continue;
      const nom = nombre.trim().toLowerCase().replace(/(^|[\s.(])([a-zñáéíóú]+)/g, (m, a, w) => a + (["de", "del", "y", "la", "el", "en", "a", "e"].includes(w) && a === " " ? w : w[0].toUpperCase() + w.slice(1)));
      const a = { id: "a" + (S.asig.length + 1), n: nom, c, y: r < 17 ? 1 : r < 35 ? 2 : r < 55 ? 3 : 4 };
      S.asig.push(a);
      const ev = []; let k = 0;
      for (let col = 4; col <= 21; col += 2) {
        const v = h.get(r, col), p = h.get(r, col + 1);
        if (v === null && p === null) continue;
        k++; ev.push({ n: etiqueta(h.get(r - 1, col), k), v: typeof v === "number" ? v : null, p: typeof p === "number" ? p : 0 });
      }
      const yo = emojiRes(h.get(r, 25)), ye = emojiRes(h.get(r, 26));
      if (ev.length || yo) S.ints.push({ id: uid("i"), a: a.id, cur, conv: "Ordinaria", ev, res: yo || "curso", com: "", fecha: "", hora: "", lugar: "" });
      if (yo !== "ap" && (ye === "ap" || ye === "su")) S.ints.push({ id: uid("i"), a: a.id, cur, conv: "Extraordinaria", ev: [], res: ye, com: "", fecha: "", hora: "", lugar: "" });
    }
    if (!S.asig.length) throw new Error("No he encontrado asignaturas en la hoja «" + h.nombre + "»");
    return S;
  }
  const importarJSON = txt => normalizar(JSON.parse(txt));
  async function importarArchivo(file) {
    const buf = await file.arrayBuffer();
    if (new Uint8Array(buf, 0, 2).join() === "80,75") return importarXlsx(buf);
    return importarJSON(new TextDecoder().decode(buf));
  }

  /* —— exportación —— */
  const aJSON = S => JSON.stringify(S, null, 1);
  const aCSV = S => {
    const q = x => '"' + String(x ?? "").replace(/"/g, '""') + '"';
    const f = ["Asignatura", "Créditos", "Curso del grado", "Convocatoria", "Curso académico", "Fecha examen", "Resultado", "Media"];
    const rows = [f.map(q).join(";")];
    for (const a of S.asig) { const l = intsDe(S, a.id); if (!l.length) rows.push([a.n, a.c, a.y, "", "", "", "Sin cursar", ""].map(q).join(";")); for (const i of l) rows.push([a.n, a.c, a.y, (TIPOS.find(t => t.id === i.conv) || {}).txt, i.cur, i.fecha, RES[i.res], i.ev.length ? String(media(i)).replace(".", ",") : ""].map(q).join(";")); }
    return "﻿" + rows.join("\r\n");
  };
  const demo = () => {
    const c = cursoDe(), p = siguienteCurso(c).slice(0, 0) || "";
    const prev = (parseInt(c, 10) - 1) + "-" + c.slice(2, 4);
    const S = vacio(); const E = (n, v, p) => ({ n, v, p });
    S.asig = [{ id: "a1", n: "Cálculo I", c: 9, y: 1 }, { id: "a2", n: "Física General", c: 9, y: 1 }, { id: "a3", n: "Programación", c: 6, y: 1 }, { id: "a4", n: "Álgebra Lineal", c: 6, y: 2 }, { id: "a5", n: "Estadística", c: 6, y: 2 }];
    const ISO = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
    S.ints = [
      { id: "i1", a: "a1", cur: prev, conv: "Ordinaria", ev: [E("Parcial 1", 6.5, 30), E("Parcial 2", 7, 30), E("Final", 6.8, 40)], res: "ap", com: "", fecha: "", hora: "", lugar: "" },
      { id: "i2", a: "a2", cur: prev, conv: "Ordinaria", ev: [E("Parcial 1", 3.2, 30), E("Parcial 2", 4, 30), E("Final", 3.5, 40)], res: "su", com: "Repasar dinámica", fecha: "", hora: "", lugar: "" },
      { id: "i3", a: "a2", cur: c, conv: "Ordinaria", ev: [E("Parcial 1", 5.5, 30), E("Parcial 2", null, 30), E("Final", null, 40)], res: "curso", com: "", fecha: ISO(12), hora: "09:00", lugar: "Aula 2.1" },
      { id: "i4", a: "a3", cur: c, conv: "Ordinaria", ev: [E("Práctica", 8, 40), E("Examen", 6.4, 60)], res: "ap", com: "", fecha: "", hora: "", lugar: "" },
      { id: "i5", a: "a4", cur: c, conv: "Ordinaria", ev: [E("Test", 7, 20), E("Examen", null, 80)], res: "curso", com: "", fecha: ISO(5), hora: "16:00", lugar: "Aula Magna" },
      { id: "i6", a: "a5", cur: c, conv: "Ordinaria", ev: [], res: "curso", com: "", fecha: ISO(26), hora: "10:30", lugar: "Lab 3" }
    ];
    S.ev = [{ id: "e1", f: ISO(2), h: "18:00", t: "Tutoría de Álgebra", k: "otro" }, { id: "e2", f: ISO(9), h: "", t: "Entrega de la práctica", k: "entrega" }];
    return S;
  };
  return { TIPOS, RES, uid, num, r2, fmt, cursoDe, siguienteCurso, media, pesoTotal, intsDe, usadas, estadoAsig, notaFinal, ultimaMedia, necesaria, resumen, vacio, normalizar, cargar, guardar, borrarTodo, hashPin, sec, setSec, importarArchivo, importarXlsx, importarJSON, aJSON, aCSV, demo, PIN_HASH };
})();
if (typeof module !== "undefined") module.exports = Store;
