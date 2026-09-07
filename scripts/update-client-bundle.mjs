import {readFile, writeFile} from 'node:fs/promises';

const path = new URL('../UPI-Party-3D.html', import.meta.url);
const networkPath = new URL('../network-client.js', import.meta.url);
let html = await readFile(path, 'utf8');

const replacements = [
  [
    'let z="https://upi-party-online.onrender.com",j=',
    'let z=globalThis.UPI_PARTY_NETWORK.SERVER_URL,j='
  ],
  [
    'R-P<80',
    'R-P<40'
  ]
];

for (const [before, after] of replacements) {
  const oldCount = html.split(before).length - 1;
  const newCount = html.split(after).length - 1;
  if (oldCount === 1) html = html.replace(before, after);
  else if (oldCount === 0 && newCount === 1) continue;
  else throw new Error(`Expected exactly one client bundle match for: ${before}`);
}

const networkClient=(await readFile(networkPath,'utf8')).replace(/<\/script/gi,'<\\/script').trim();
const embedded=/<script data-upi-network-client>[\s\S]*?<\/script>/;
if(!embedded.test(html))throw new Error('Missing embedded network client marker');
html=html.replace(embedded,`<script data-upi-network-client>\n${networkClient}\n</script>`);

await writeFile(path, html);
