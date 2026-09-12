export default async function run(page, ui) {
  await page.waitForFunction(() => !!window.__cabina, { timeout: 15000, polling: 150 });
  await page.waitForFunction(() => document.getElementById('cargando')?.hidden === true, { timeout: 20000, polling: 150 });
  await page.waitForTimeout(400);
  const info = await page.evaluate(async () => {
    const c = window.__cabina;
    const t = c.estado();
    const bancos = t.bancos.map(b => ({
      nombre: b.nombre,
      sonidos: b.listaSonidos().map(s => ({ nombre: s.nombre, origen: s.origen, duracionMs: s.duracionMs })),
    }));
    let sndId = null;
    for (const b of t.bancos) for (const s of b.listaSonidos()) if (s.nombre === 'Air Horn') sndId = s.id;
    const blob = await c.repositorio.leerAudio(sndId);
    const cabecera = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    return { bancos, tipoBlobAirHorn: blob.type, tamanoBlobAirHorn: blob.size, cabeceraHex: Array.from(cabecera).map(b=>b.toString(16).padStart(2,'0')).join(' ') };
  });
  return info;
}
