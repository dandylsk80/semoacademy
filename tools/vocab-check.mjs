/* 배포 전 금지 어휘 검사 — 본사 마케팅 가이드 기준(학원 3곳 check.mjs 4번과 같은 사전 tools/vocab.mjs, hakwon1 에서 복사)
   워커를 로컬 import 해 사이트맵 전 URL + /llms.txt · /rss.xml · /robots.txt 를 렌더하고 본문 텍스트에서 금지·대체 어휘를 찾는다.
   실행: node tools/vocab-check.mjs   (1건이라도 있으면 종료 코드 1 → Actions 배포 중단) */
import fs from "node:fs";
import { scanText, htmlText } from "./vocab.mjs";
const SITE_ID = "semoacademy", ORIGIN = "https://semoacademy.com";
globalThis.fetch = async () => new Response("{}", { status: 200 });   /* 텔레그램·GAS·외부 요청 차단 */
globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };
const tmp = new URL("../.__vocab_worker.mjs", import.meta.url);
fs.copyFileSync(new URL("../" + SITE_ID + "_worker.js", import.meta.url), tmp);
let worker; try { worker = (await import(tmp.href)).default; } finally { fs.unlinkSync(tmp); }
const ctx = { waitUntil() {}, passThroughOnException() {} };
const get = async (u) => { const r = await worker.fetch(new Request(u, { headers: { "User-Agent": "Mozilla/5.0 (iPhone) Mobile vocab-check" } }), {}, ctx); return [r.status, await r.text()]; };
const locsOf = (x) => [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, ORIGIN));
let urls = locsOf((await get(ORIGIN + "/sitemap.xml"))[1]);
for (const s of urls.filter((u) => /\.xml$/.test(u))) urls.push(...locsOf((await get(s))[1]));
urls = [...new Set(urls.filter((u) => !/\.xml$/.test(u)))];
if (urls.length < 100) { console.error("사이트맵 URL " + urls.length + "개 — 렌더 실패로 본다"); process.exit(1); }
const extra = ["/llms.txt", "/rss.xml", "/robots.txt"].map((p) => ORIGIN + p);
const hits = []; let n = 0;
for (const u of urls.concat(extra)) {
  const [st, h] = await get(u); if (st !== 200) continue; n++;
  const text = /\.(txt|xml)$/.test(u) ? h.replace(/<[^>]+>/g, " ") : htmlText(h);
  const r = scanText(text, u);
  for (const x of r.forbid.concat(r.replace)) hits.push(u.replace(ORIGIN, "") + " «" + x.w + "» …" + x.ctx + "…");
}
const uniq = [...new Set(hits.map((h) => h.replace(/^\S+ /, "")))];
console.log("금지 어휘 검사: " + n + "쪽(llms·rss·robots 포함) · " + hits.length + "건 · 서로 다른 문장 " + uniq.length);
if (hits.length) { console.log(hits.slice(0, 20).join("\n")); process.exit(1); }
