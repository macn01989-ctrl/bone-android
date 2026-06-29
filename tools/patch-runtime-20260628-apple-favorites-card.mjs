import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const jsPath = path.join(root, 'recovery/good-apk-public/assets/index-1_-kxmKC.js');
const cssPath = path.join(root, 'recovery/good-apk-public/assets/index-Dvq-jbN8.css');
const arkUrl = 'https://ark.cn-beijing.volces.com/api/v3/bots/chat/completions';
const arkBot = 'bot-20250612194641-hvrdt';

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) {
    throw new Error(`Cannot locate ${label}`);
  }
  return source.replace(oldText, newText);
}

let js = fs.readFileSync(jsPath, 'utf8');

const albumIntroNonStream = `JSON.stringify({model:n.model||"${arkBot}",temperature:.25,messages:[{role:"user",content:c}]})`;
const albumIntroStream = `JSON.stringify({model:n.model||"${arkBot}",stream:!0,stream_options:{include_usage:!0},temperature:.25,messages:[{role:"user",content:c}]})`;
if (js.includes(albumIntroNonStream)) {
  js = js.replace(albumIntroNonStream, albumIntroStream);
} else if (!js.includes(albumIntroStream)) {
  throw new Error('Cannot locate album intro stream request');
}

js = js.replaceAll(
  `Bn.postJson({url:n.baseUrl||"${arkUrl}",apiKey:h,body:l,timeoutMs:n.timeoutMs||6e4})`,
  `Bn.postJson({url:"${arkUrl}",apiKey:h,body:l,timeoutMs:n.timeoutMs||6e4})`
);
js = js.replaceAll(
  `fetch(n.baseUrl||"${arkUrl}",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+h},body:l,signal:r})`,
  `fetch("${arkUrl}",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+h},body:l,signal:r})`
);

const manualFallbackText = `c||(c=xn(s,o));return c?{...c,id:\`manual-album-\${o.collectionId}\`,artworkUrl:r||c.artworkUrl,originalArtworkUrl:c.originalArtworkUrl||rn(o),timestamp:Date.now()}:null`;
const manualModelOnlyText = `return c?{...c,id:\`manual-album-\${o.collectionId}\`,artworkUrl:r||c.artworkUrl,originalArtworkUrl:c.originalArtworkUrl||rn(o),timestamp:Date.now()}:null`;
if (js.includes(manualFallbackText)) {
  js = js.replace(manualFallbackText, manualModelOnlyText);
} else if (!js.includes(manualModelOnlyText)) {
  throw new Error('Cannot locate manual album model-only update');
}

const albumArkStart = js.indexOf('async function AlbumArkCheck');
const albumArkEnd = js.indexOf('async function Vr', albumArkStart);
if (albumArkStart < 0 || albumArkEnd < 0) {
  throw new Error('Cannot locate AlbumArkCheck boundary');
}
const newAlbumArkCheck = `async function AlbumArkCheck(e){let a=String(e.apiKey||"").trim().replace(/^['"]|['"]$/g,"").replace(/^Bearer\\s+/i,""),t=JSON.stringify({model:e.model||"${arkBot}",stream:!0,stream_options:{include_usage:!0},messages:[{role:"user",content:"\\u641c\\u7d22\\u76ee\\u6807\\uff1a\\n\\u4e13\\u8f91\\u540d\\uff1aBackspacer\\n\\u97f3\\u4e50\\u4eba\\uff1aPearl Jam\\n\\n\\u4f60\\u552f\\u4e00\\u9700\\u8981\\u641c\\u7d22\\u7684\\u5173\\u952e\\u8bcd\\u662f\\uff1aPearl Jam Backspacer\\u3002\\n\\u53ea\\u8fd4\\u56de JSON\\uff1a{\\\\\\"\\u98ce\\u683c\\\\\\":[\\\\\\"\\u6447\\u6eda\\\\\\"],\\\\\\"\\u4ecb\\u7ecd\\\\\\":\\\\\\"\\u8fd9\\u662f\\u4e00\\u6bb5\\u7528\\u4e8e\\u8fde\\u901a\\u6027\\u68c0\\u67e5\\u7684\\u4e2d\\u6587\\u4e13\\u8f91\\u4ecb\\u7ecd\\u3002\\\\\\"}"}],temperature:0});let n=e.timeoutMs||3e4;if(w.isNativePlatform()){let r=await Bn.postJson({url:"${arkUrl}",apiKey:a,body:t,timeoutMs:n});if(r.status<200||r.status>=300)throw Error(zr(r.status,r.body));return r.body||""}let r=await fetch("${arkUrl}",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+a},body:t,signal:AbortSignal.timeout(n)}),i=await r.text();if(!r.ok)throw Error(zr(r.status,i));return i||""}`;
js = js.slice(0, albumArkStart) + newAlbumArkCheck + js.slice(albumArkEnd);

const oldAddBranch = 'let t=Date.now();if(S===`album`){let r={albumTitle:e,albumArtist:E.trim()||`未知艺术家`};if(sr(r)){F(`这张专辑不在 Bone 的推荐收藏范围内`);return}L(!0),F(``);let i=null;try{let e=await Re(),t={apiKey:e.api.albumIntro.apiKey,model:e.api.albumIntro.model||e.albumIntroModel,baseUrl:e.api.albumIntro.baseUrl,timeoutMs:e.api.albumIntro?.timeoutMs||6e4};i=await manualAlbumFromApple(r.albumTitle,r.albumArtist,t,O===`local`?A:``)}catch{}finally{L(!1)}if(i&&sr(i)){F(`这张专辑不在 Bone 的推荐收藏范围内`);return}let a=i?{...i,timestamp:t}:{...r,artworkUrl:A||rr,albumIntro:`《${e}》的介绍暂时没有生成成功。可以稍后重新添加，或检查设置页的硅基流动 API 与专辑整理模型。`,styleTags:[],timestamp:t};u(e=>{let n=[a,...e.filter(e=>e.albumTitle!==a.albumTitle)];return lr(ar,n),n})}else{';
const newAddBranch = 'let t=Date.now();if(S===`album`){let r={albumTitle:e,albumArtist:E.trim()||`未知艺术家`};if(sr(r)){F(`这张专辑不在 Bone 的推荐收藏范围内`);return}F(``);let i={...r,artworkUrl:A||rr,albumIntro:`《${e}》的介绍正在后台整理，稍后点开这张卡片就能看到更新。`,styleTags:[],timestamp:t};u(e=>{let n=[i,...e.filter(e=>e.albumTitle!==i.albumTitle)];return lr(ar,n),n}),re(),n(`专辑已添加，介绍后台整理中`),(async()=>{try{let e=await Re(),n={apiKey:e.api.albumIntro.apiKey,model:e.api.albumIntro.model||e.albumIntroModel,baseUrl:e.api.albumIntro.baseUrl,timeoutMs:e.api.albumIntro?.timeoutMs||6e4},a=await manualAlbumFromApple(r.albumTitle,r.albumArtist,n,O===`local`?A:``);if(!a||sr(a))return;let o={...a,timestamp:t};u(e=>{let n=e.map(e=>e.timestamp===t?o:e);return n.some(e=>e.timestamp===t)||(n=[o,...e.filter(e=>e.albumTitle!==o.albumTitle)]),lr(ar,n),n})}catch{}})();return}else{';
js = replaceOnce(js, oldAddBranch, newAddBranch, 'favorites album immediate add branch');

js = replaceOnce(
  js,
  'children:I?`搜索中…`:M?`确认`:S===`album`?`添加专辑`:`添加播客`',
  'children:I?`搜索中…`:M?`收藏`:S===`album`?`添加专辑`:`添加播客`',
  'favorites confirm button text'
);

fs.writeFileSync(jsPath, js, 'utf8');

let css = fs.readFileSync(cssPath, 'utf8');
const cssMarker = '/* bone detail frame width 20260628 */';
const cssPatch = `${cssMarker}.recommend-album-detail,.recommend-episodes-section-front,.recommend-platforms-section{box-sizing:border-box!important;width:calc(100% - 24px)!important;margin:12px!important;padding:20px!important}.recommend-album-detail{padding:20px 18px 28px!important}.recommend-episodes-section-front,.recommend-platforms-section{padding:20px!important}`;
if (!css.includes(cssMarker)) {
  css += cssPatch;
}
const equalInsetMarker = '/* bone detail frame equal inset 20260628 */';
const equalInsetPatch = `${equalInsetMarker}.recommend-front{box-sizing:border-box!important;padding-top:0!important}.recommend-back{box-sizing:border-box!important;padding-top:70px!important;gap:10px!important}.recommend-album-detail,.recommend-episodes-section-front,.recommend-platforms-section{box-sizing:border-box!important;width:calc(100% - 24px)!important;height:calc(100% - 24px)!important;max-height:calc(100% - 24px)!important;margin:12px!important;padding:20px!important}.recommend-album-detail,.recommend-episodes-section-front,.recommend-platforms-section{overflow-y:auto!important;-webkit-overflow-scrolling:touch}.recommend-episodes-section-front::-webkit-scrollbar,.recommend-platforms-section::-webkit-scrollbar,.recommend-album-detail::-webkit-scrollbar{display:none}`;
if (!css.includes(equalInsetMarker)) {
  css += equalInsetPatch;
}
fs.writeFileSync(cssPath, css, 'utf8');

const coverName = '1001_Einsturzende_Neubauten_Kollaps_1981.jpg';
const coverUrl = `/recommendations/album-covers/1001/${coverName}`;
const assetRoots = [
  path.join(root, 'recovery/good-apk-public'),
  path.join(root, 'public'),
  path.join(root, 'android/app/src/main/assets/public')
];

for (const assetRoot of assetRoots) {
  const coverDir = path.join(assetRoot, 'recommendations/album-covers/1001');
  if (fs.existsSync(coverDir)) {
    const source = fs.readdirSync(coverDir).find((name) => /Kollaps_1981\.jpg$/i.test(name));
    const dest = path.join(coverDir, coverName);
    if (source && !fs.existsSync(dest)) {
      fs.copyFileSync(path.join(coverDir, source), dest);
    }
  }

  const catalogPath = path.join(assetRoot, 'recommendations/album-catalog.json');
  if (fs.existsSync(catalogPath)) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    let changed = false;
    for (const album of catalog) {
      if (album.albumTitle === 'Kollaps' && /Neubauten/i.test(album.albumArtist || '')) {
        if (album.artworkUrl !== coverUrl) {
          album.artworkUrl = coverUrl;
          changed = true;
        }
      }
    }
    if (changed) {
      fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    }
  }
}

console.log('patched apple album generation, favorites immediate add, card width, and Kollaps cover');
