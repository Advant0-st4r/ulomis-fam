import { readFile, readdir, stat } from 'node:fs/promises';import path from 'node:path';
const root=process.cwd();
async function walk(d){const out=[];for(const n of await readdir(d)){if(['node_modules','dist','.git'].includes(n))continue;const p=path.join(d,n),s=await stat(p);if(s.isDirectory())out.push(...await walk(p));else out.push(p)}return out}
const files=await walk(root),texts=[];for(const f of files)if(/\.(js|mjs|json|toml|md|html|sql|webmanifest)$/.test(f)&&!f.endsWith('scripts/validate.mjs'))texts.push([f,await readFile(f,'utf8')]);const all=texts.map(x=>x[1]).join('\n');
const must=['@netlify/database','@netlify/identity','netlify/database/migrations','OPENAI_API_KEY','structuredResponse','store: false','last_request_id','model_timeout','promptVersion'];for(const m of must)if(!all.includes(m))throw new Error(`missing contract: ${m}`);
for(const bad of ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','supabase.co','createClient('])if(all.toLowerCase().includes(bad.toLowerCase()))throw new Error(`stale Supabase reference: ${bad}`);
if(/process\.env\.(OPENAI|SUPABASE)/.test(all))throw new Error('Netlify runtime secrets must use Netlify.env');
if(files.some(f=>f.endsWith('netlify/functions/config.js')||f.endsWith('netlify/functions/config.mjs')))throw new Error('config function should not exist');
if(!files.some(f=>f.includes('002_reconstruction_idempotency')&&f.endsWith('migration.sql')))throw new Error('idempotency migration missing');
console.log('Netlify-native Ulomis + production LLM contract valid.');
