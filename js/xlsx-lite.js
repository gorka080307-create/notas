/* Lector mínimo de .xlsx sin librerías: descomprime el zip con DecompressionStream y lee las hojas.
   Devuelve [{ nombre, get(fila, columna) }] con filas y columnas desde 1. */
const XlsxLite = (() => {
  const dec = new TextDecoder();
  async function inflar(u8) {
    const ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter();
    w.write(u8); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  function zip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error("No es un archivo .xlsx válido");
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lh = dv.getUint32(p + 42, true);
      const nombre = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      const ini = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true);
      out[nombre] = { metodo, datos: u8.subarray(ini, ini + cs) };
      p += 46 + nl + el + cl;
    }
    return out;
  }
  const leer = async (z, nombre) => { const f = z[nombre]; if (!f) return null; return dec.decode(f.metodo === 0 ? f.datos : await inflar(f.datos)); };
  const xml = s => new DOMParser().parseFromString(s, "application/xml");
  const colNum = ref => { let n = 0; for (const ch of ref.replace(/[0-9]/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n; };

  async function abrir(buf) {
    const z = zip(buf);
    const wb = xml(await leer(z, "xl/workbook.xml"));
    const rels = xml(await leer(z, "xl/_rels/workbook.xml.rels"));
    const dest = {};
    rels.querySelectorAll("Relationship").forEach(r => { let t = r.getAttribute("Target"); t = t.startsWith("/") ? t.slice(1) : "xl/" + t; dest[r.getAttribute("Id")] = t; });
    const sstTxt = await leer(z, "xl/sharedStrings.xml");
    const sst = sstTxt ? [...xml(sstTxt).querySelectorAll("si")].map(si => [...si.querySelectorAll("t")].map(t => t.textContent).join("")) : [];
    const hojas = [];
    for (const s of wb.querySelectorAll("sheet")) {
      const id = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
      const txt = await leer(z, dest[id]); if (!txt) continue;
      const celdas = new Map();
      xml(txt).querySelectorAll("c").forEach(c => {
        const ref = c.getAttribute("r"), t = c.getAttribute("t"), v = c.querySelector("v");
        let val = null;
        if (t === "inlineStr") val = [...c.querySelectorAll("t")].map(x => x.textContent).join("");
        else if (v) val = t === "s" ? sst[+v.textContent] : t === "str" ? v.textContent : t === "b" ? v.textContent === "1" : t === "e" ? null : parseFloat(v.textContent);
        if (val === null || val === "" || (typeof val === "number" && isNaN(val))) return;
        celdas.set(+ref.replace(/[A-Z]/g, "") * 1000 + colNum(ref), val);
      });
      hojas.push({ nombre: s.getAttribute("name"), get: (f, c) => { const v = celdas.get(f * 1000 + c); return v === undefined ? null : v; } });
    }
    return hojas;
  }
  return { abrir };
})();
