/* 금지 어휘 검사 — 학원1·2·3 공통 (본사 마케팅 가이드 250624 + 제작 지시)
   모듈: import { scanText, scanData, FORBID, REPLACE } from "./tools/vocab.mjs"
   CLI : node tools/vocab.mjs data/centers.json      → 데이터 필드 안의 금지·대체 어휘 목록
         node tools/vocab.mjs --html <렌더된.html>    → 페이지 본문 검사(check.mjs 가 호출)
   종료 코드: 금지 어휘 1건 이상이면 1 (대체 필수 어휘는 경고만, --strict 면 1). */
import fs from "node:fs";

/* 사용 금지 — 검출되면 실패. 예외(exc)는 학교 이름 등 어쩔 수 없는 결합. */
export const FORBID = [
  { w: "과외" }, { w: "진로" }, { w: "진학" }, { w: "특목고" }, { w: "적성" }, { w: "검정고시" },
  { w: "성인", exc: /성인[가-힣]*(인증|지)/ }, { w: "유아" }, { w: "제2외국어" }, { w: "제 2외국어" },
  { w: "온라인수업" }, { w: "온라인 수업" }, { w: "방문수업" }, { w: "방문 수업" },
  { w: "최고" }, { w: "최대", exc: /최대한/ }, { w: "제일", exc: /제일[가-힣]/ }  /* 제일고·제일프라자·제일메디컬 같은 고유명사. "제일 좋은"은 띄어 써서 잡힌다 */, { w: "유일" }, { w: "일타" },
  { w: "100%" }, { w: "100 %" }, { w: "성적향상 보장" }, { w: "성적 향상 보장" }, { w: "향상 보장" }, { w: "보장" },
  { w: "타학원" }, { w: "타 학원" }, { w: "타학원 비교" }, { w: "학원 비교" },
  /* 본사 PDF 추가 항목 */
  { w: "상상코칭" }, { w: "e상상코칭" }, { w: "동화세상에듀코" }, { w: "어디서도 볼 수 없는" }, { w: "할인" }, { w: "무료", exc: /무료\s*주차/ },
];
/* 자유 서술문에서 금지 어휘가 든 토막만 떼어낸다(문장·항목 단위). 떼어낸 토막은 보고용으로 돌려준다. */
export function dropForbidden(text) {
  /* "1." 같은 번호 조각은 떼어 버리고 번호 머리는 지운다 */
  const parts = String(text || "").split(/\n|\s*\/\s*|;|★|•|,\s+|(?<=[.!]) |(?<=다\.)|(?:^|\s)(?=\d[.)]\s?)/).map(s => s.trim().replace(/^\d+[.)]\s*/, "")).filter(Boolean);
  const kept = [], dropped = [];
  for (const p of parts) (hits(p, FORBID, "").length ? dropped : kept).push(p);
  return { text: kept.join(" / "), dropped };
}
/* 대체 필수 어휘를 규칙대로 바꾼다. 바뀐 쌍을 돌려준다. */
export function applyReplace(text) {
  let t = String(text || ""); const changed = [];
  for (const { w, to, exc } of REPLACE) { if (exc && exc.test(t)) continue; if (t.includes(w)) { changed.push(`${w}→${to}`); t = t.split(w).join(to); } }
  return { text: t, changed };
}
/* 대체 필수 — 데이터·문장 풀에 남아 있으면 경고, 렌더 결과(--strict)에서는 실패 */
export const REPLACE = [
  /* 복합어를 먼저 둬야 "입시상담"이 "내신·수능 대비상담"으로 꼬이지 않는다 */
  { w: "입시컨설팅", to: "내신·수능 상담" }, { w: "입시상담", to: "내신·수능 상담" }, { w: "입시 상담", to: "내신·수능 상담" }, { w: "입시설명회", to: "내신·수능 설명회" },
  { w: "입시", to: "내신·수능 대비" },
  { w: "1:1", to: "소수정예·수준별 맞춤 지도" }, { w: "1 : 1", to: "소수정예·수준별 맞춤 지도" }, { w: "1대1", to: "밀착 지도" }, { w: "1대 1", to: "밀착 지도" }, { w: "일대일", to: "밀착 지도" },
  { w: "컨설팅", to: "상담·코칭상담" },
  { w: "종합학원", to: "보습학원" }, { w: "단과학원", to: "국영수 학원" }, { w: "공부방", to: "보습학원", exc: /공부방법/ }, { w: "교습소", to: "보습학원" },
  { w: "선행", to: "연계학습" },
];
/* 금액 표기 — 숫자+원/만원 은 0건이어야 한다(교습비는 드라이브 링크 버튼만). */
const MONEY = /\d[\d,]*\s*(만\s*원|원)(?![가-힣])/g;

function hits(text, list, field) {
  const out = [];
  for (const { w, exc } of list) {
    let i = text.indexOf(w);
    while (i >= 0) {
      const ctx = text.slice(Math.max(0, i - 12), i + w.length + 12).replace(/\s+/g, " ");
      if (!(exc && exc.test(text.slice(Math.max(0, i - 2), i + w.length + 6)))) out.push({ field, w, ctx });
      i = text.indexOf(w, i + w.length);
    }
  }
  return out;
}
export function scanText(text, field = "") {
  const t = String(text || "");
  const money = [...t.matchAll(MONEY)].map(m => ({ field, w: m[0], ctx: t.slice(Math.max(0, m.index - 10), m.index + m[0].length + 10).replace(/\s+/g, " ") }));
  return { forbid: hits(t, FORBID, field), replace: hits(t, REPLACE, field), money };
}
/* centers.json 의 사람이 쓴 자유 서술 필드만 검사한다(링크·주소·등록번호 제외). */
const FREE_FIELDS = ["name", "loc", "subjNote", "strength", "wkRaw", "wkTimeRaw", "openRaw"];
export function scanData(centers) {
  const all = { forbid: [], replace: [], money: [] };
  for (const c of centers) for (const f of FREE_FIELDS) {
    const r = scanText(c[f], `${c.slug}.${f}`);
    for (const k of Object.keys(all)) all[k].push(...r[k]);
  }
  return all;
}
/* HTML → 본문 텍스트(script/style 제거) */
/* 블록 경계에 ¶ 를 넣어 "…뒤 방문</li><h2>수업이…" 가 "방문 수업"으로 이어 붙지 않게 한다 */
export const htmlText = (html) => String(html).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<\/(p|li|h[1-6]|td|th|div|section|blockquote|summary|dt|dd|caption|title|span|a|b|small)>/gi, " ¶ ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2); const strict = a.includes("--strict");
  let r;
  if (a[0] === "--html") r = scanText(htmlText(fs.readFileSync(a[1], "utf8")), a[1]);
  else r = scanData(JSON.parse(fs.readFileSync(a[0] || "data/centers.json", "utf8")));
  const show = (k, label) => { console.log(`## ${label} ${r[k].length}건`); const byW = {}; r[k].forEach(h => (byW[h.w] = byW[h.w] || []).push(h)); for (const w in byW) { console.log(`- ${w} ×${byW[w].length}`); byW[w].slice(0, 6).forEach(h => console.log(`    ${h.field}: …${h.ctx}…`)); } };
  show("forbid", "사용 금지"); show("replace", "대체 필수"); show("money", "금액 표기");
  process.exit(r.forbid.length || r.money.length || (strict && r.replace.length) ? 1 : 0);
}
