import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const jsPath = path.join(root, 'recovery/good-apk-public/assets/index-1_-kxmKC.js');

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) {
    throw new Error(`Cannot locate ${label}`);
  }
  return source.replace(oldText, newText);
}

let js = fs.readFileSync(jsPath, 'utf8');

js = replaceOnce(
  js,
  'async function Dn(e){if(!e.apiKey.trim()||!e.model.trim())return null;if(w.isNativePlatform()){let e=await wn();if(e)return e}if(xt){let e=xt;return xt=null,e}return null}',
  'async function Dn(e){if(!e.apiKey.trim()||!e.model.trim())return null;w.isNativePlatform()&&Ht(e);if(w.isNativePlatform()){let t=await wn();if(t)return t}if(xt){let t=xt;return xt=null,t}try{return await Tn(e)}catch{return null}}',
  'album page live Apple fallback route',
);

js = replaceOnce(
  js,
  'let o={...a,timestamp:t};u(e=>{let n=e.map(e=>e.timestamp===t?o:e);return n.some(e=>e.timestamp===t)||(n=[o,...e.filter(e=>e.albumTitle!==o.albumTitle)]),lr(ar,n),n})',
  'let o={...a,timestamp:t};m(e=>!e||e.timestamp!==t?e:o),u(e=>{let n=e.map(e=>e.timestamp===t?o:e);return n.some(e=>e.timestamp===t)||(n=[o,...e.filter(e=>e.albumTitle!==o.albumTitle)]),lr(ar,n),n})',
  'favorites selected album background intro update',
);

js = replaceOnce(
  js,
  'function It(e){try{let t=JSON.parse(e??`[]`);return Array.isArray(t)?t.filter(e=>e&&typeof e.applePoolItemId==`string`&&typeof e.applePoolCandidateId==`string`&&typeof e.albumTitle==`string`&&typeof e.albumArtist==`string`&&typeof e.originalArtworkUrl==`string`):[]}catch{return[]}}',
  'function It(e){try{let t=JSON.parse(e??`[]`);return Array.isArray(t)?t.filter(e=>e&&typeof e.applePoolItemId==`string`&&typeof e.applePoolCandidateId==`string`&&typeof e.albumTitle==`string`&&typeof e.albumArtist==`string`&&typeof e.originalArtworkUrl==`string`&&!(Array.isArray(e.styleTags)&&e.styleTags.includes(`风格待补`))&&!String(e.detail?.fullIntro||e.albumIntro||``).includes(`模型整理暂时不可用`)):[]}catch{return[]}}',
  'discard native apple pool fallback placeholders',
);

fs.writeFileSync(jsPath, js, 'utf8');

console.log('patched live Apple album route and favorites intro return');
