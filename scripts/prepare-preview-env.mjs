// Retrieve only the disposable project's keys through the logged-in official CLI.
// No keys are printed. .env.local and .vercel are ignored by Git.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const ref = 'vojietqeyfkrfisxcsrs';
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'supabase@3.3.0', 'projects', 'api-keys', '--remote=' + ref, '--reveal', '--output', 'json'], {encoding:'utf8', shell:process.platform === 'win32', maxBuffer:2*1024*1024});
if (result.status !== 0) { console.error('Supabase CLI authentication is required. Run: npx --yes supabase@3.3.0 login'); process.exit(1); }
let payload;
try { payload=JSON.parse(result.stdout); } catch { console.error('CLI did not return the expected JSON key inventory. No credentials printed.'); process.exit(1); }
const list=Array.isArray(payload)?payload:(payload.keys??payload.api_keys??payload.data??[]);
const value = k => k?.api_key??k?.key??k?.value;
const publishable=list.find(k=>!k.disabled && k.type==='publishable')??list.find(k=>!k.disabled && k.name==='anon');
const secret=list.find(k=>!k.disabled && k.type==='secret')??list.find(k=>!k.disabled && k.name==='service_role');
if(!value(publishable)||!value(secret)){console.error('A publishable and server key are both required. No credentials printed.');process.exit(1);}
for(const k of [publishable,secret]) { const v=value(k); if(!/^[A-Za-z0-9_.-]+$/.test(v)||v.includes('***'))throw Error('Unexpected key format'); if(v.startsWith('eyJ')&&JSON.parse(Buffer.from(v.split('.')[1],'base64url')).ref!==ref)throw Error('Wrong project key'); }
const vars={NEXT_PUBLIC_SUPABASE_URL:'https://'+ref+'.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:value(publishable),SUPABASE_SECRET_KEY:value(secret),NEXT_PUBLIC_APP_ENV:'preview',CRM_EXTERNAL_DELIVERY_DISABLED:'true',CRM_PREVIEW_PROJECT_REF:ref,N8N_API_KEY:'preview-disabled'};
writeFileSync('.env.local',Object.entries(vars).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{mode:0o600});
console.log('Isolated preview configuration written to ignored .env.local. Keys were not displayed.');
