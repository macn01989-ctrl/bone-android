import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const jsPath = path.join(root, 'recovery/good-apk-public/assets/index-1_-kxmKC.js');
const cssPath = path.join(root, 'recovery/good-apk-public/assets/index-Dvq-jbN8.css');

const ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/bots/chat/completions';
const ARK_BOT = 'bot-20250612194641-hvrdt';
const VOLC_DOC = 'https://www.volcengine.com/docs/82379/1541594?lang=zh';

const t = (s) => JSON.stringify(s);
const promptTemplate = [
  '\u641c\u7d22\u76ee\u6807\uff1a',
  '\u4e13\u8f91\u540d\uff1a__ALBUM__',
  '\u97f3\u4e50\u4eba\uff1a__ARTIST__',
  '',
  '\u4f60\u552f\u4e00\u9700\u8981\u641c\u7d22\u7684\u5173\u952e\u8bcd\u662f\uff1a__ARTIST__ __ALBUM__\u3002',
  '\u7981\u6b62\u641c\u7d22\u672c\u63d0\u793a\u8bcd\u4e2d\u7684\u89c4\u5219\u3001\u5b57\u6bb5\u540d\u3001\u8f93\u51fa\u683c\u5f0f\u6216\u5176\u4ed6\u6587\u5b57\u3002',
  '',
  '任务：你是一个非常严谨的世界级音乐评论家。请联网核对这张专辑，介绍中必须有专辑专业介绍，并整理成安卓软件可直接使用的 JSON。',
  '',
  '\u53c2\u8003 Apple Music \u5143\u6570\u636e\uff08\u53ea\u7528\u4e8e\u6838\u5bf9\uff0c\u4e0d\u8981\u539f\u6837\u8f93\u51fa\uff09\uff1a\u53d1\u884c\u65f6\u95f4 __RELEASE__\uff1b\u5e74\u4efd __YEAR__\uff1b\u6d41\u6d3e __GENRE__\uff1b\u66f2\u76ee\u6570\u91cf __TRACKS__\u3002',
  '',
  '\u53ea\u5141\u8bb8\u8f93\u51fa\u4e0b\u9762 2 \u4e2a\u5b57\u6bb5\uff1a',
  '{',
  '  "\u98ce\u683c": ["\u4e2d\u6587\u97f3\u4e50\u98ce\u683c1", "\u4e2d\u6587\u97f3\u4e50\u98ce\u683c2", "\u4e2d\u6587\u97f3\u4e50\u98ce\u683c3"],',
  '  "\u4ecb\u7ecd": "\u4e00\u6bb5\u4e2d\u6587\u4e13\u8f91\u4ecb\u7ecd"',
  '}',
  '',
  '\u4e25\u683c\u8981\u6c42\uff1a',
  '1. \u53ea\u8f93\u51fa JSON\uff0c\u4e0d\u8981\u8f93\u51fa\u4efb\u4f55 JSON \u4e4b\u5916\u7684\u6587\u5b57\u3002',
  '2. \u4e0d\u8981 Markdown\uff0c\u4e0d\u8981\u5217\u8868\uff0c\u4e0d\u8981\u6807\u9898\u3002',
  '3. \u4e0d\u8981\u8f93\u51fa\u4e13\u8f91\u540d\u3001\u97f3\u4e50\u4eba\u3001\u53d1\u884c\u65f6\u95f4\u3001\u66f2\u76ee\u3001\u5531\u7247\u516c\u53f8\u3001\u5236\u4f5c\u4eba\u3001\u8bed\u79cd\u3001\u6b4c\u66f2\u6570\u91cf\u7b49\u8d44\u6599\u5b57\u6bb5\u3002',
  '4. \u201c\u98ce\u683c\u201d\u53ea\u80fd\u586b\u5199\u97f3\u4e50\u672f\u8bed\u91cc\u9762\u7684\u98ce\u683c\uff0c\u4f8b\u5982\uff1a\u540e\u670b\u514b\u3001\u53e6\u7c7b\u6447\u6eda\u3001\u72ec\u7acb\u6447\u6eda\u3001\u5b9e\u9a8c\u6447\u6eda\u3001\u566a\u97f3\u6447\u6eda\u3001\u827a\u672f\u6447\u6eda\u3001\u8ff7\u5e7b\u6447\u6eda\u3001\u6c11\u8c23\u6447\u6eda\u3001\u786c\u6447\u6eda\u3001\u670b\u514b\u6447\u6eda\u3001\u7535\u5b50\u6447\u6eda\u3001\u534e\u8bed\u6447\u6eda\u3002',
  '5. \u201c\u98ce\u683c\u201d\u6700\u591a 4 \u4e2a\uff0c\u5fc5\u987b\u5168\u90e8\u662f\u4e2d\u6587\uff0c\u4e0d\u80fd\u51fa\u73b0\u82f1\u6587\u3002',
  '6. \u201c\u4ecb\u7ecd\u201d\u5199 520 \u5b57\uff0c\u4f7f\u7528\u81ea\u7136\u4e2d\u6587\uff0c\u9002\u5408\u4e13\u8f91\u63a8\u8350\u5361\u7247\u9605\u8bfb\uff0c\u4ecb\u7ecd\u4e2d\u5fc5\u987b\u6709\u5bf9\u4e13\u8f91\u4e2d\u6b4c\u66f2\u7684\u77ed\u8bc4\u6216\u8005\u4ecb\u7ecd\u3002',
  '7. \u4ecb\u7ecd\u53ef\u4ee5\u53c2\u8003\u8054\u7f51\u8d44\u6599\uff0c\u4f46\u5fc5\u987b\u6539\u5199\uff0c\u4e0d\u8981\u7167\u6284\u3002',
  '8. \u4ecb\u7ecd\u4e0d\u8981\u5199\u6210\u767e\u79d1\u8d44\u6599\u5806\u53e0\uff0c\u4e0d\u8981\u5199\u66f2\u76ee\u8868\u3002',
  '9. \u4fe1\u606f\u4e0d\u786e\u5b9a\u5c31\u5c11\u5199\uff0c\u4e0d\u8981\u7f16\u9020\u3002',
  '10. \u7b2c\u4e00\u4e2a\u5b57\u7b26\u5fc5\u987b\u662f {\u3002',
  '11. \u6700\u540e\u4e00\u4e2a\u5b57\u7b26\u5fc5\u987b\u662f }\u3002'
].join('\\n');

let js = fs.readFileSync(jsPath, 'utf8');

js = js.replace(
  'albumIntro:{enabled:!1,interfaceType:`openai-chat`,baseUrl:``,apiKey:``,model:``,timeoutMs:3e4}',
  `albumIntro:{enabled:!1,interfaceType:"ark-bot-chat",baseUrl:${t(ARK_URL)},apiKey:"",model:${t(ARK_BOT)},timeoutMs:6e4,provider:"volcengine"}`
);
js = js.replace('albumIntroModel:`deepseek-ai/DeepSeek-V4-Pro`', `albumIntroModel:${t(ARK_BOT)}`);

js = js.replace(
  'function _n(e){let t=e.trim().replace(/^```json\\s*/i,``).replace(/\\s*```$/,``);try{let e=JSON.parse(t);return e&&typeof e==`object`?e:null}catch{return null}}',
  'function _n(e){let t=e.trim().replace(/^```json\\s*/i,"").replace(/\\s*```$/,""),n=t.indexOf("{"),r=t.lastIndexOf("}");n>=0&&r>n&&(t=t.slice(n,r+1));try{let e=JSON.parse(t);return e&&typeof e=="object"?e:null}catch{return null}}'
);

const bnStart = js.indexOf('async function bn');
const bnEnd = js.indexOf('function xn', bnStart);
if (bnStart < 0 || bnEnd < 0) throw new Error('Cannot locate bn/xn boundary.');
const newBn = `async function bn(e,t,n,r){let i=rn(t);if(!t?.collectionId||!i)return null;let a=t.collectionName??e.name,o=t.artistName??e.artist,s=t.releaseDate&&Number(t.releaseDate.slice(0,4))||null,c=${t(promptTemplate)}.replaceAll("__ALBUM__",a).replaceAll("__ARTIST__",o).replaceAll("__RELEASE__",t.releaseDate??"").replaceAll("__YEAR__",s??"").replaceAll("__GENRE__",t.primaryGenreName??"").replaceAll("__TRACKS__",t.trackCount??""),l=JSON.stringify({model:n.model||${t(ARK_BOT)},temperature:.25,messages:[{role:"user",content:c}]}),u=w.isNativePlatform()?await Bn.postJson({url:n.baseUrl||${t(ARK_URL)},apiKey:n.apiKey,body:l,timeoutMs:n.timeoutMs||6e4}).then(e=>{if(e.status<200||e.status>=300)throw Error("album intro api "+e.status+": "+(e.body||""));return JSON.parse(e.body||"{}")}):await fetch(n.baseUrl||${t(ARK_URL)},{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+n.apiKey},body:l,signal:r}).then(async e=>{let t=await e.text();if(!e.ok)throw Error("album intro api "+e.status+": "+t);return JSON.parse(t||"{}")}),d=_n(u.choices?.[0]?.message?.content??"");if(!d)return null;let f=typeof d["\\u4ecb\\u7ecd"]=="string"?d["\\u4ecb\\u7ecd"].trim():typeof d.fullIntro=="string"?d.fullIntro.trim():"",p=vn(d["\\u98ce\\u683c"]??d.styleTags);if(!f)return null;return{id:"live-album-"+e.id,albumTitle:a,albumArtist:o,artworkUrl:i,originalArtworkUrl:i,albumIntro:f,collection:"apple-music",styleTags:p,releaseDate:t.releaseDate??"",releaseYear:s,label:"",trackCount:t.trackCount??null,notableTracks:[],detail:{introTitle:"",shortIntro:"",fullIntro:f,listeningMoment:"",whyKeep:"",basicFacts:o+"\\u300a"+a+"\\u300b\\uff0cApple Music \\u63d0\\u4f9b\\u53d1\\u884c\\u4e0e\\u5c01\\u9762\\u4fe1\\u606f\\u3002",soundCharacteristics:p,artistContext:"",receptionContext:""},timestamp:Date.now()}}`;
js = js.slice(0, bnStart) + newBn + js.slice(bnEnd);

const brStart = js.indexOf('async function Br');
const brEnd = js.indexOf('async function Vr', brStart);
if (brStart < 0 || brEnd < 0) throw new Error('Cannot locate Br/Vr boundary.');
const oldBr = js.slice(brStart, brEnd);
const newBr = oldBr + `async function AlbumArkCheck(e){let t=JSON.stringify({model:e.model||${t(ARK_BOT)},messages:[{role:"user",content:"\\u641c\\u7d22\\u76ee\\u6807\\uff1a\\n\\u4e13\\u8f91\\u540d\\uff1aBackspacer\\n\\u97f3\\u4e50\\u4eba\\uff1aPearl Jam\\n\\n\\u4f60\\u552f\\u4e00\\u9700\\u8981\\u641c\\u7d22\\u7684\\u5173\\u952e\\u8bcd\\u662f\\uff1aPearl Jam Backspacer\\u3002\\n\\u53ea\\u8fd4\\u56de JSON\\uff1a{\\\\\\"\\u98ce\\u683c\\\\\\":[\\\\\\"\\u6447\\u6eda\\\\\\"],\\\\\\"\\u4ecb\\u7ecd\\\\\\":\\\\\\"\\u8fd9\\u662f\\u4e00\\u6bb5\\u7528\\u4e8e\\u8fde\\u901a\\u6027\\u68c0\\u67e5\\u7684\\u4e2d\\u6587\\u4e13\\u8f91\\u4ecb\\u7ecd\\u3002\\\\\\"}"}],temperature:0});let n=e.timeoutMs||3e4;if(w.isNativePlatform()){let r=await Bn.postJson({url:e.baseUrl||${t(ARK_URL)},apiKey:e.apiKey,body:t,timeoutMs:n});if(r.status<200||r.status>=300)throw Error(zr(r.status,r.body));return JSON.parse(r.body||"{}")}let r=await fetch(e.baseUrl||${t(ARK_URL)},{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+e.apiKey},body:t,signal:AbortSignal.timeout(n)}),i=await r.text();if(!r.ok)throw Error(zr(r.status,i));return JSON.parse(i||"{}")}`;
js = js.slice(0, brStart) + newBr + js.slice(brEnd);

js = js.replace(
  'let e=await Re(),t={apiKey:e.api.speechToText.apiKey,model:e.albumIntroModel,timeoutMs:e.api.albumIntro?.timeoutMs||45e3};',
  'let e=await Re(),t={apiKey:e.api.albumIntro.apiKey,model:e.api.albumIntro.model||e.albumIntroModel,baseUrl:e.api.albumIntro.baseUrl,timeoutMs:e.api.albumIntro?.timeoutMs||6e4};'
);
js = js.replace(
  'liveConfig:{apiKey:n.api.speechToText.apiKey,model:n.albumIntroModel}',
  'liveConfig:{apiKey:n.api.albumIntro.apiKey,model:n.api.albumIntro.model||n.albumIntroModel,baseUrl:n.api.albumIntro.baseUrl,timeoutMs:n.api.albumIntro.timeoutMs}'
);

js = js.replace(
  'onChange:t=>{let n=t.target.value,i=n.trim().length>0;r({...e,api:{...e.api,speechToText:{...e.api.speechToText,apiKey:n,enabled:i},albumIntro:{...e.api.albumIntro,apiKey:n,enabled:i}}})}',
  'onChange:t=>{let n=t.target.value,i=n.trim().length>0;r({...e,api:{...e.api,speechToText:{...e.api.speechToText,apiKey:n,enabled:i}}})}'
);
js = js.replace(
  /onClick:\(\)=>void r\(\{\.\.\.e,api:\{\.\.\.e\.api,speechToText:\{\.\.\.e\.api\.speechToText,apiKey:``,enabled:!1\},albumIntro:\{\.\.\.e\.api\.albumIntro,apiKey:``,enabled:!1\}\}\},`[^`]*`\)/,
  'onClick:()=>void r({...e,api:{...e.api,speechToText:{...e.api.speechToText,apiKey:``,enabled:!1}}},`API Key 已清空`)'
);

const settingAnchor = js.indexOf('let x=Array.from(new Set([e.polishModel');
const sStart = js.indexOf('S=async()=>{', settingAnchor);
const sBodyStart = sStart + 'S=async()=>{'.length;
const sEnd = js.indexOf('},C=async()=>', sBodyStart);
if (settingAnchor < 0 || sStart < 0 || sEnd < 0) throw new Error('Cannot locate settings connectivity check.');
const newSBody = `let t=e.api.speechToText.apiKey.trim(),v=e.api.albumIntro.apiKey.trim();if(!t){a("\\u8bf7\\u5148\\u586b\\u5199 SiliconFlow API Key");return}if(!v){a("\\u8bf7\\u5148\\u586b\\u5199\\u706b\\u5c71\\u65b9\\u821f API Key");return}f(!0),m([]);let n=e.api.speechToText.model||In,r=e.polishModel||Ln,i=e.api.albumIntro.model||e.albumIntroModel||${t(ARK_BOT)},o=[],s=async(e,t)=>{try{await t(),o.push({label:e,ok:!0,message:"\\u53ef\\u7528"})}catch(t){o.push({label:e,ok:!1,message:t instanceof Error&&t.message?t.message:"\\u8bf7\\u6c42\\u5931\\u8d25"})}m([...o])};await s("\\u8bed\\u97f3\\u8f6c\\u6587\\u5b57 \\u00b7 "+n,()=>Vr(t,n)),await s("\\u6587\\u672c\\u6da6\\u8272 \\u00b7 "+r,()=>Br(t,r,"\\u4f60\\u662f\\u8fde\\u901a\\u6027\\u6d4b\\u8bd5\\u52a9\\u624b\\u3002\\u8bf7\\u53ea\\u56de\\u590d OK\\u3002","\\u6d4b\\u8bd5")),await s("\\u4e13\\u8f91\\u6574\\u7406 \\u00b7 "+i,()=>AlbumArkCheck({apiKey:v,model:i,baseUrl:e.api.albumIntro.baseUrl,timeoutMs:e.api.albumIntro.timeoutMs||6e4}));let c=o.filter(e=>!e.ok).length;a(c?"\\u6a21\\u578b\\u68c0\\u67e5\\u5b8c\\u6210\\uff1a"+c+" \\u9879\\u5931\\u8d25":"\\u4e09\\u4e2a\\u6a21\\u578b\\u90fd\\u80fd\\u8fd0\\u884c"),f(!1)`;
js = js.slice(0, sBodyStart) + newSBody + js.slice(sEnd);

const albumSelectIdx = js.indexOf('value:e.albumIntroModel', settingAnchor);
if (albumSelectIdx >= 0) {
  const rmStart = js.lastIndexOf(',(0,G.jsxs)(`label`', albumSelectIdx);
  const rmEnd = js.indexOf(']})]}),(0,G.jsxs)(`div`,{className:`model-connectivity-panel`', albumSelectIdx);
  if (rmStart >= 0 && rmEnd >= 0) js = js.slice(0, rmStart) + js.slice(rmEnd);
}

const connectivityNeedle = '),(0,G.jsxs)(`div`,{className:`model-connectivity-panel`,children:[';
if (!js.includes('settings-volcano-subcard') && js.includes(connectivityNeedle)) {
  const volcanoCard = `),(0,G.jsxs)("div",{className:"settings-volcano-subcard",children:[(0,G.jsxs)("div",{className:"settings-volcano-head",children:[(0,G.jsx)("h3",{children:"\\u706b\\u5c71\\u65b9\\u821f \\u00b7 \\u4e13\\u8f91\\u6574\\u7406"}),(0,G.jsxs)("p",{children:["\\u4e13\\u8f91\\u4ecb\\u7ecd\\u4e0e\\u98ce\\u683c\\u6807\\u7b7e\\u4f7f\\u7528\\u706b\\u5c71\\u8054\\u7f51 Bot\\u3002\\u5148\\u5728\\u706b\\u5c71\\u65b9\\u821f\\u83b7\\u53d6 API Key \\u5e76\\u786e\\u8ba4 Bot \\u914d\\u7f6e\\uff1a",(0,G.jsx)("a",{href:${t(VOLC_DOC)},target:"_blank",rel:"noreferrer",children:" \\u83b7\\u53d6\\u706b\\u5c71 API Key"})]})]}),(0,G.jsxs)("label",{className:"settings-modern-field api-key-field",children:[(0,G.jsx)("span",{children:"\\u706b\\u5c71\\u65b9\\u821f API Key"}),(0,G.jsxs)("div",{className:"api-key-control-row",children:[(0,G.jsx)("input",{type:"password",value:e.api.albumIntro.apiKey,onChange:t=>{let n=t.target.value,i=n.trim().length>0;r({...e,api:{...e.api,albumIntro:{...e.api.albumIntro,apiKey:n,enabled:i,baseUrl:e.api.albumIntro.baseUrl||${t(ARK_URL)},model:e.api.albumIntro.model||${t(ARK_BOT)}}})},placeholder:"\\u586b\\u5165\\u706b\\u5c71\\u65b9\\u821f API Key",autoComplete:"off",spellCheck:!1}),(0,G.jsx)("button",{className:"api-key-action",type:"button",onClick:()=>{let t=e.api.albumIntro.apiKey.trim();if(!t){a("\\u6ca1\\u6709\\u53ef\\u590d\\u5236\\u7684\\u706b\\u5c71 API Key");return}Or(t).then(()=>a("\\u5df2\\u590d\\u5236"))},children:"\\u590d\\u5236"}),(0,G.jsx)("button",{className:"api-key-action danger",type:"button",onClick:()=>void r({...e,api:{...e.api,albumIntro:{...e.api.albumIntro,apiKey:"",enabled:!1}}},"\\u706b\\u5c71 API Key \\u5df2\\u6e05\\u7a7a"),children:"\\u6e05\\u7a7a"})]})]}),(0,G.jsxs)("label",{className:"settings-modern-field",children:[(0,G.jsx)("span",{children:"\\u706b\\u5c71 Bot ID"}),(0,G.jsx)("input",{value:e.api.albumIntro.model||e.albumIntroModel||${t(ARK_BOT)},onChange:t=>void r({...e,albumIntroModel:t.target.value,api:{...e.api,albumIntro:{...e.api.albumIntro,model:t.target.value,baseUrl:e.api.albumIntro.baseUrl||${t(ARK_URL)}}}},"\\u706b\\u5c71 Bot ID \\u5df2\\u4fdd\\u5b58"),placeholder:${t(ARK_BOT)},spellCheck:!1})]})]})`;
  js = js.replace(connectivityNeedle, volcanoCard + connectivityNeedle);
}

fs.writeFileSync(jsPath, js, 'utf8');

let css = fs.readFileSync(cssPath, 'utf8');
const marker = '/* bone volcengine album + recommendation detail frame */';
const cssPatch = `${marker}.settings-volcano-subcard{background:#fff;border:2px solid #000;border-radius:16px;padding:14px;box-shadow:4px 4px #000;display:flex;flex-direction:column;gap:12px}.settings-volcano-head h3{margin:0;color:#000;font-size:17px;font-weight:950}.settings-volcano-head p{margin:6px 0 0;color:#000000a3;font-size:13px;font-weight:750;line-height:1.45}.settings-volcano-head a{color:#d1232a;font-weight:950}.recommend-album-detail,.recommend-episodes-section-front,.recommend-platforms-section{background:rgba(255,255,255,.13)!important;border:2px solid rgba(255,255,255,.62)!important;border-radius:24px!important;box-shadow:inset 0 10px 18px rgba(255,255,255,.16),inset 0 -14px 22px rgba(0,0,0,.22),0 10px 22px rgba(0,0,0,.2)!important;width:calc(100% - 36px)!important;margin:18px!important}.recommend-album-detail{height:auto!important;max-height:min(76svh,calc(var(--rpx)*1080))!important}.recommend-episodes-section-front,.recommend-platforms-section{max-height:min(76svh,calc(var(--rpx)*1080))!important;overflow-y:auto!important}.recommend-episodes-section-front::-webkit-scrollbar,.recommend-platforms-section::-webkit-scrollbar,.recommend-album-detail::-webkit-scrollbar{display:none}`;
if (!css.includes(marker)) css += cssPatch;
fs.writeFileSync(cssPath, css, 'utf8');

console.log('patched Volcengine Ark album intro, settings split, and recommendation detail frames');
