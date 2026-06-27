import fs from 'node:fs';

const target = 'recovery/good-apk-public/assets/index-1_-kxmKC.js';
let source = fs.readFileSync(target, 'utf8');

const replacements = [
  [
    'let r=await fetch(Pn,{method:`POST`,headers:{Authorization:`Bearer ${t.apiKey}`},body:n,signal:AbortSignal.timeout(t.timeoutMs)});if(!r.ok)throw Error(`speech api ${r.status}`);return r.json()}',
    'let r=await fetch(Pn,{method:`POST`,headers:{Authorization:`Bearer ${t.apiKey}`},body:n,signal:AbortSignal.timeout(t.timeoutMs)}),i=await r.text();if(!r.ok)throw Error(`speech api ${r.status}: ${i}`);return JSON.parse(i||`{}`)}',
  ],
  [
    'if(r.status<200||r.status>=300)throw Error(`speech api ${r.status}`);return JSON.parse(r.body||`{}`)}',
    'if(r.status<200||r.status>=300)throw Error(`speech api ${r.status}: ${r.body||``}`);return JSON.parse(r.body||`{}`)}',
  ],
];

let changed = 0;
for (const [from, to] of replacements) {
  if (!source.includes(from)) {
    throw new Error(`Runtime speech-error patch target not found: ${from.slice(0, 80)}`);
  }
  source = source.replace(from, to);
  changed += 1;
}

fs.writeFileSync(target, source);
console.log(`patched runtime speech errors: ${changed}`);
