import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const runtimePath = resolve(root, 'recovery/good-apk-public/assets/index-1_-kxmKC.js');

let code = readFileSync(runtimePath, 'utf8');

const helperNeedle =
  'async function hn(e,t=``){let n=e.trim(),r=t.trim();if(!n)return null;let i=await cn(n,r,6e3).catch(()=>null);return!i?.collectionId||!rn(i)?null:{albumTitle:i.collectionName??e,albumArtist:i.artistName??t,artworkUrl:rn(i)}}async function gn(e){';

const helperReplacement =
  'async function hn(e,t=``){let n=e.trim(),r=t.trim();if(!n)return null;let i=await cn(n,r,6e3).catch(()=>null);return!i?.collectionId||!rn(i)?null:{albumTitle:i.collectionName??e,albumArtist:i.artistName??t,artworkUrl:rn(i)}}async function manualAlbumFromApple(e,t,n,r=``){let i=e.trim(),a=t.trim();if(!i)return null;let o=await cn(i,a,8e3).catch(()=>null);if(!o?.collectionId||!rn(o))return null;let s={id:`manual-${o.collectionId||Date.now()}`,name:o.collectionName??i,artist:o.artistName??a},c=null;if(n?.apiKey?.trim()&&n?.model?.trim())c=await bn(s,o,n,AbortSignal.timeout(n.timeoutMs||45e3)).catch(()=>null);c||(c=xn(s,o));return c?{...c,id:`manual-album-${o.collectionId}`,artworkUrl:r||c.artworkUrl,originalArtworkUrl:c.originalArtworkUrl||rn(o),timestamp:Date.now()}:null}async function gn(e){';

if (!code.includes(helperReplacement)) {
  if (!code.includes(helperNeedle)) {
    throw new Error('manual album helper insertion point not found');
  }
  code = code.replace(helperNeedle, helperReplacement);
}

const addAlbumBranchPattern =
  /let t=Date\.now\(\);if\(S===`album`\)\{let n=\{albumTitle:e,albumArtist:E\.trim\(\)\|\|`[^`]*`\};if\(sr\(n\)\)\{F\(`[^`]*`\);return\}u\(r=>\{let i=\[\{\.\.\.n,artworkUrl:A\|\|rr,albumIntro:`[^`]*`,timestamp:t\},\.\.\.r\];return lr\(ar,i\),i\}\)\}else\{/;

const addAlbumBranchReplacement =
  'let t=Date.now();if(S===`album`){let r={albumTitle:e,albumArtist:E.trim()||`未知艺术家`};if(sr(r)){F(`这张专辑不在 Bone 的推荐收藏范围内`);return}L(!0),F(``);let i=null;try{let e=await Re(),t={apiKey:e.api.speechToText.apiKey,model:e.albumIntroModel,timeoutMs:e.api.albumIntro?.timeoutMs||45e3};i=await manualAlbumFromApple(r.albumTitle,r.albumArtist,t,O===`local`?A:``)}catch{}finally{L(!1)}if(i&&sr(i)){F(`这张专辑不在 Bone 的推荐收藏范围内`);return}let a=i?{...i,timestamp:t}:{...r,artworkUrl:A||rr,albumIntro:`《${e}》的介绍暂时没有生成成功。可以稍后重新添加，或检查设置页的硅基流动 API 与专辑整理模型。`,styleTags:[],timestamp:t};u(e=>{let n=[a,...e.filter(e=>e.albumTitle!==a.albumTitle)];return lr(ar,n),n})}else{';

if (!code.includes(addAlbumBranchReplacement)) {
  const next = code.replace(addAlbumBranchPattern, addAlbumBranchReplacement);
  if (next === code) {
    throw new Error('manual album add branch not found');
  }
  code = next;
}

writeFileSync(runtimePath, code, 'utf8');
console.log('patched manual album intro generation in runtime JS');
