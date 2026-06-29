import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const jsPath = path.join(root, 'recovery/good-apk-public/assets/index-1_-kxmKC.js');
const cssPath = path.join(root, 'recovery/good-apk-public/assets/index-Dvq-jbN8.css');

let js = fs.readFileSync(jsPath, 'utf8');
const start = js.indexOf('async function bn');
const end = js.indexOf('function xn', start);
if (start < 0 || end < 0) {
  throw new Error('Cannot locate live Apple album intro function bn/xn boundary.');
}

const oldBn = js.slice(start, end);
const newBn = 'async function bn(e,t,n,r){let i=rn(t);if(!t?.collectionId||!i)return null;let a=t.collectionName??e.name,o=t.artistName??e.artist,s=t.releaseDate&&Number(t.releaseDate.slice(0,4))||null,c={albumTitle:a,artist:o,releaseDate:t.releaseDate??``,releaseYear:s,primaryGenre:t.primaryGenreName??``,trackCount:t.trackCount??null},l=JSON.stringify({model:n.model,temperature:.25,response_format:{type:`json_object`},messages:[{role:`system`,content:`你是一名严谨的中文音乐编辑。只根据用户提供的 Apple Music 元数据写专辑卡片资料；不要联网臆测、不要编造奖项、制作人、曲目或评价。所有说明使用自然中文，专名可保留原文。只输出 JSON 对象：{"introTitle":"不超过18字","shortIntro":"40-70字","fullIntro":"120-220字、分2段","whyKeep":"25-45字","styleTags":["中文风格1","中文风格2"]}。styleTags 为2到4个纯中文风格词；信息不足时少写事实、保持克制。`},{role:`user`,content:JSON.stringify(c)}]}),u=w.isNativePlatform()?await Bn.postJson({url:vt,apiKey:n.apiKey,body:l,timeoutMs:n.timeoutMs||45e3}).then(e=>{if(e.status<200||e.status>=300)throw Error(`album intro api ${e.status}: ${e.body||``}`);return JSON.parse(e.body||`{}`)}):await fetch(vt,{method:`POST`,headers:{"Content-Type":`application/json`,Authorization:`Bearer ${n.apiKey}`},body:l,signal:r}).then(async e=>{let t=await e.text();if(!e.ok)throw Error(`album intro api ${e.status}: ${t}`);return JSON.parse(t||`{}`)}),d=_n(u.choices?.[0]?.message?.content??``);if(!d)return null;let f=typeof d.shortIntro==`string`?d.shortIntro.trim():``,p=typeof d.fullIntro==`string`?d.fullIntro.trim():``;if(!f||!p)return null;let m=vn(d.styleTags);return{id:`live-album-${e.id}`,albumTitle:a,albumArtist:o,artworkUrl:i,originalArtworkUrl:i,albumIntro:f,collection:`apple-music`,styleTags:m,releaseDate:t.releaseDate??``,releaseYear:s,label:``,trackCount:t.trackCount??null,notableTracks:[],detail:{introTitle:typeof d.introTitle==`string`?d.introTitle.trim():a,shortIntro:f,fullIntro:p,listeningMoment:``,whyKeep:typeof d.whyKeep==`string`?d.whyKeep.trim():``,basicFacts:`${o}《${a}》，Apple Music 提供发行与封面信息。`,soundCharacteristics:m,artistContext:``,receptionContext:``},timestamp:Date.now()}}';
if (!oldBn.includes('await fetch(vt')) {
  throw new Error('Unexpected bn shape; refusing to patch.');
}
js = js.slice(0, start) + newBn + js.slice(end);

const wrongPrefetch = 'g=br(()=>{Ut(r),s(e=>e+1)},';
if (js.includes(wrongPrefetch)) {
  js = js.replace(wrongPrefetch, 'g=br(()=>{En(r),s(e=>e+1)},');
} else if (!js.includes('g=br(()=>{En(r),s(e=>e+1)},')) {
  throw new Error('Cannot locate album swipe prefetch callback.');
}

fs.writeFileSync(jsPath, js, 'utf8');

let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* bone apple album detail scroll hardening */';
const patchCss = `${marker}.recommend-album-detail{height:auto!important;max-height:min(76svh,calc(var(--rpx)*1080))!important;overflow-y:auto!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding-right:calc(var(--rpx)*24)!important}.recommend-album-detail::-webkit-scrollbar{display:none}`;
if (!css.includes(marker)) {
  css += patchCss;
}
fs.writeFileSync(cssPath, css, 'utf8');

console.log('patched runtime apple album native model call + album swipe prefetch + scroll hardening');
