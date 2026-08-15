import { admin } from '@netlify/identity';
import { json,currentUser,db } from './_server.mjs';

export default async function(req){
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  const user=await currentUser();
  if(!user)return json({error:'auth_required'},401);
  const d=db(),client=await d.pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('DELETE FROM ulomis_events WHERE user_id=$1',[user.id]);
    await client.query('DELETE FROM ulomis_threads WHERE user_id=$1',[user.id]);
    await client.query('COMMIT');
    await admin.deleteUser(user.id);
    return json({ok:true});
  }catch(e){
    await client.query('ROLLBACK').catch(()=>{});
    console.error('delete_account_failed',e);
    return json({error:'delete_account_failed'},500);
  }finally{client.release()}
}
