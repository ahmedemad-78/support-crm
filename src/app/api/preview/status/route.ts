import {createAdminClient} from '@/lib/supabase/admin';
import {PREVIEW_PROJECT_REF,previewPublicConfig} from '@/lib/supabase/environment';

export async function GET(){
  try{
    previewPublicConfig();
    const db=createAdminClient();
    const result=await db.from('profiles').select('id',{count:'exact',head:true});
    if(result.error)throw new Error('Preview backend unavailable');
    return Response.json({environment:'preview',projectRef:PREVIEW_PROJECT_REF,databaseReady:true,externalDelivery:'disabled'},{headers:{'Cache-Control':'no-store'}});
  }catch{
    return Response.json({environment:'preview',databaseReady:false},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
