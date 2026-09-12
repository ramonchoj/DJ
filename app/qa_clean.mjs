export default async function run(page, ui) {
  await page.evaluate(async () => { try { await indexedDB.deleteDatabase('cabina'); } catch {} });
  return { limpiado: true };
}
