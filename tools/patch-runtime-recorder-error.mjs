import fs from 'node:fs';

const target = 'recovery/good-apk-public/assets/index-1_-kxmKC.js';
let source = fs.readFileSync(target, 'utf8');

const from =
  '}catch{y(`语音转文字暂时失败了，原录音仍然保留。`),g(!1),C(``),k(!0)}}';
const to =
  '}catch(e){let s=e instanceof Error&&e.message?e.message:String(e||`未知错误`);y(`语音转文字失败：${s}`),g(!1),C(``),k(!0)}}';

if (!source.includes(from)) {
  throw new Error('Recorder ASR error patch target not found');
}

source = source.replace(from, to);
fs.writeFileSync(target, source);
console.log('patched recorder ASR full error display');
