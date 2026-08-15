import { CONFIG } from '../../variant-config.js';
import { json,currentUser,logEvent } from './_server.mjs';

const ALLOWED_EVENTS=new Set([
  'landing_opened','return_visit','recognition_category_selected','natural_input_started','real_thread_submitted',
  'reconstruction_corrected','reconstruction_not_useful','forgotten_thread_recognized','forgotten_thread_not_recognized',
  'next_step_clear_yes','next_step_clear_partial','next_step_clear_no','second_thread_created','three_threads_created',
  'five_threads_created','share_artifact_generated','share_completed','referred_user_arrived','account_gate_after_value',
  'account_created_after_value','new_evidence_added','state_delta_generated','thread_resolved','matter_deleted','data_exported'
]);

export default async function(req){
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  let b={};try{b=await req.json()}catch{return json({error:'invalid_json'},400)}
  const name=String(b.name||'').trim();
  if(!ALLOWED_EVENTS.has(name))return json({error:'event_not_allowed'},400);
  const user=await currentUser();
  const sessionId=String(b.sessionId||'').slice(0,120)||null;
  const meta=b.meta&&typeof b.meta==='object'?{source:String(b.meta.source||'browser').slice(0,40),answer:b.meta.answer==null?null:String(b.meta.answer).slice(0,120)}:{};
  await logEvent({userId:user?.id||null,sessionId,name,category:Object.hasOwn(CONFIG.categories,String(b.category||''))?String(b.category):null,milestone:b.milestone?String(b.milestone).slice(0,120):null,referralId:b.referralId?String(b.referralId).slice(0,160):null,meta});
  return json({ok:true});
}
