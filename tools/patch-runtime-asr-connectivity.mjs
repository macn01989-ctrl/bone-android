import fs from 'node:fs';

const target = 'recovery/good-apk-public/assets/index-1_-kxmKC.js';
let source = fs.readFileSync(target, 'utf8');

const from =
  'async function Vr(e,t){await Hr(qr(.35),{apiKey:e,model:t,fileName:`bone-connectivity-test.wav`,timeoutMs:9e4})}';
const to =
  'async function Vr(e,t){let n=await fetch(`/assets/asr-connectivity-test.wav`).then(e=>e.blob()).catch(()=>qr(1.2));await Hr(n,{apiKey:e,model:t,fileName:`bone-connectivity-test.wav`,mimeType:`audio/wav`,timeoutMs:9e4})}';

if (!source.includes(from)) {
  throw new Error('ASR connectivity runtime patch target not found');
}

source = source.replace(from, to);
fs.writeFileSync(target, source);
console.log('patched ASR connectivity runtime test audio');
