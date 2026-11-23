import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
process.loadEnvFile('.env.local');
const ref='vojietqeyfkrfisxcsrs', url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, secret=process.env.SUPABASE_SECRET_KEY;
if(url!=='https://'+ref+'.supabase.co'||!key||!secret||!(/^(sb_secret_|eyJ)/.test(secret)))throw Error('Isolated preview credentials are incomplete.');
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const profile=await db.from('profiles').select('id',{count:'exact',head:true});
if(profile.error)throw Error('Preview server key verification failed: '+profile.error.code);
const users=await db.auth.admin.listUsers();if(users.error)throw Error('Preview Auth admin verification failed.');
const buckets=await db.storage.listBuckets();if(buckets.error)throw Error('Preview Storage verification failed.');
console.log(JSON.stringify({project:ref,profileCount:profile.count,authUsers:users.data.users.length,privateBucket:buckets.data.some(b=>b.id==='ticket-attachments'&&!b.public)}));
if(process.argv.includes('--seed')){
 const file='.vercel/preview-accounts.json';
 const accounts=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[
  ['admin','Preview Admin','support_agent'],['worker','Preview Backend','support_agent'],['qa','QA Representative','department_member'],['qa-peer','QA Peer','department_member'],['call','Call Center Representative','call_center'],['b2b','B2B Representative','business_development'],['schools','Schools Representative','june_schools'],['manager','Preview Manager','manager']
 ].map(([handle,name,role])=>({email:'preview-'+handle+'@example.test',name,role,password:randomBytes(18).toString('base64url')}));
 // Persist fixture passwords locally before calls so an interrupted run can resume.
 writeFileSync(file,JSON.stringify(accounts,null,2),{mode:0o600});
 for(const a of accounts){let user=users.data.users.find(u=>u.email===a.email);if(!user){const made=await db.auth.admin.createUser({email:a.email,password:a.password,email_confirm:true,app_metadata:{role:a.role,full_name:a.name}});if(made.error)throw Error('Fixture Auth account creation failed: '+made.error.code);user=made.data.user;}
 const saved=await db.from('profiles').update({role:a.role,full_name:a.name}).eq('id',user.id);if(saved.error)throw Error('Fixture profile setup failed.');a.id=user.id;
 }
 writeFileSync(file,JSON.stringify(accounts,null,2),{mode:0o600});console.log('Synthetic preview accounts prepared; passwords remain in ignored local file.');
}
