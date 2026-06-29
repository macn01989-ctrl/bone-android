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

js = replaceOnce(
  js,
  'albumIntro:{...Pe.api.albumIntro,...t.api?.albumIntro,enabled:!!t.api?.albumIntro?.apiKey?.trim()||!!t.api?.albumIntro?.enabled}',
  `albumIntro:{...Pe.api.albumIntro,...t.api?.albumIntro,enabled:!!t.api?.albumIntro?.apiKey?.trim()||!!t.api?.albumIntro?.enabled,interfaceType:"ark-bot-chat",baseUrl:"${arkUrl}",model:typeof t.api?.albumIntro?.model==\`string\`&&t.api.albumIntro.model.trim().startsWith("bot-")?t.api.albumIntro.model.trim():typeof t.albumIntroModel==\`string\`&&t.albumIntroModel.trim().startsWith("bot-")?t.albumIntroModel.trim():Pe.api.albumIntro.model,timeoutMs:t.api?.albumIntro?.timeoutMs||Pe.api.albumIntro.timeoutMs,provider:"volcengine"}`,
  'album intro cached settings normalization',
);

js = js.replaceAll(
  `baseUrl:e.api.albumIntro.baseUrl`,
  `baseUrl:"${arkUrl}"`,
);
js = js.replaceAll(
  `baseUrl:e.api.albumIntro.baseUrl||"${arkUrl}"`,
  `baseUrl:"${arkUrl}"`,
);
js = js.replaceAll(
  `baseUrl:n.api.albumIntro.baseUrl`,
  `baseUrl:"${arkUrl}"`,
);

const nonStreamBody = `JSON.stringify({model:n.model||"${arkBot}",temperature:.25,messages:[{role:"user",content:c}]})`;
const streamBody = `JSON.stringify({model:n.model||"${arkBot}",stream:!0,stream_options:{include_usage:!0},temperature:.25,messages:[{role:"user",content:c}]})`;
if (js.includes(nonStreamBody)) js = js.replace(nonStreamBody, streamBody);
if (!js.includes(streamBody)) throw new Error('Album intro request is not stream:true');

fs.writeFileSync(jsPath, js, 'utf8');

let css = fs.readFileSync(cssPath, 'utf8');
const equalInsetMarker = '/* bone detail frame equal inset 20260628 */';
const equalInsetPatch =
  `${equalInsetMarker}.recommend-front{box-sizing:border-box!important;padding-top:0!important}` +
  `.recommend-back{box-sizing:border-box!important;padding-top:70px!important;gap:10px!important}` +
  `.recommend-album-detail,.recommend-episodes-section-front,.recommend-platforms-section{box-sizing:border-box!important;width:calc(100% - 24px)!important;height:calc(100% - 24px)!important;max-height:calc(100% - 24px)!important;margin:12px!important;padding:20px!important}` +
  `.recommend-album-detail,.recommend-episodes-section-front,.recommend-platforms-section{overflow-y:auto!important;-webkit-overflow-scrolling:touch}` +
  `.recommend-episodes-section-front::-webkit-scrollbar,.recommend-platforms-section::-webkit-scrollbar,.recommend-album-detail::-webkit-scrollbar{display:none}`;

const markerIndex = css.indexOf(equalInsetMarker);
if (markerIndex >= 0) {
  const nextMarkerIndex = css.indexOf('/*', markerIndex + equalInsetMarker.length);
  css = css.slice(0, markerIndex) + equalInsetPatch + (nextMarkerIndex >= 0 ? css.slice(nextMarkerIndex) : '');
} else {
  css += equalInsetPatch;
}

fs.writeFileSync(cssPath, css, 'utf8');

console.log('patched album intro URL lock, stream:true, and recommendation card frame');
