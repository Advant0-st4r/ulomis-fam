import { randomUUID } from 'node:crypto';
import { CONFIG } from '../../variant-config.js';
import * as D from '../../domain.js';
import { json,currentUser,db,ownedItem,rowToDomain,logEvent } from './_server.mjs';

function evidenceTexts(previous,raw){return [...(previous?.evidence||[]).map(x=>x?.value||'').filter(Boolean),raw].slice(-12)}
async function byRequest(userId,requestId){const d=db();const rows=await d.sql`SELECT * FROM ulomis_threads WHERE user_id=${userId} AND variant=${CONFIG.code} AND last_request_id=${requestId} AND deleted_at IS NULL LIMIT 1`;return rows[0]||null}
function logAsync(context,promise){try{if(context?.waitUntil)context.waitUntil(promise.catch(()=>{}));else promise.catch(()=>{})}catch{}}

export default async function(req,context){
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  const user=await currentUser();
  if(!user)return json({error:'auth_required_to_save'},401);
  let body={};try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
  const requestId=String(body.requestId||`legacy_${randomUUID()}`).slice(0,160);
  const duplicate=await byRequest(user.id,requestId);
  if(duplicate)return json({item:rowToDomain(duplicate),delta:duplicate.last_delta||null,idempotentReplay:true});

  const raw=String(body.rawText||'').trim();
  if(raw.length<8||raw.length>6000)return json({error:'invalid_raw_text'},400);
  let previous=null;
  const id=body.threadId?String(body.threadId):randomUUID();
  if(body.threadId){
    const row=await ownedItem(user.id,id);
    if(!row)return json({error:'thread_not_found'},404);
    previous=rowToDomain(row);
    if(Number(body.expectedVersion)!==previous.version)return json({error:'version_conflict',currentVersion:previous.version},409);
  }
  const correction=body.correction&&typeof body.correction==='object'?{category:String(body.correction.category||''),note:String(body.correction.note||'').trim().slice(0,1000)}:null;
  let candidate;try{candidate=D.validateCandidate(body.candidate,evidenceTexts(previous,raw))}catch{return json({error:'candidate_failed_deterministic_validation'},422)}
  const now=new Date().toISOString(),version=(previous?.version||0)+1;
  const evidence=[...(previous?.evidence||[]),{id:`ev_${randomUUID()}`,type:'raw_text',value:raw,createdAt:now}].slice(-50);
  const delta=D.buildDelta(previous,candidate);
  const corrections=[...(previous?.corrections||[])];
  if(correction)corrections.push({id:`corr_${randomUUID()}`,...correction,createdAt:now,version});
  const history=[...(previous?.history||[]),{eventId:`evt_${randomUUID()}`,eventType:previous?'STATE_DELTA_ACCEPTED':'RECONSTRUCTION_ACCEPTED',occurredAt:now,beforeVersion:previous?.version||0,afterVersion:version,delta,requestId}].slice(-100);
  const p=D.canonicalProjection(candidate);
  const d=db(),client=await d.pool.connect();
  try{
    await client.query('BEGIN');
    let saved;
    if(previous){
      const q=await client.query(`UPDATE ulomis_threads SET category=$1,title=$2,counterparty_label=$3,amount_minor=$4,currency=$5,stage=$6,state=$7,next_actor=$8,attention_date=$9,next_action_text=$10,state_summary=$11,canonical_state=$12::jsonb,evidence=$13::jsonb,history=$14::jsonb,corrections=$15::jsonb,last_delta=$16::jsonb,source_text=$17,version=$18,resolved_at=$19,updated_at=$20,last_request_id=$21 WHERE id=$22::uuid AND user_id=$23 AND variant=$24 AND version=$25 AND deleted_at IS NULL RETURNING *`,[p.category,p.title,p.counterpartyLabel,p.amountMinor,p.currency||null,p.stage,p.state,p.nextActor,p.attentionDate,p.nextActionText,p.summary,JSON.stringify(candidate),JSON.stringify(evidence),JSON.stringify(history),JSON.stringify(corrections),JSON.stringify(delta),raw,version,p.state===D.STATES.RESOLVED?(previous.resolvedAt||now):null,now,requestId,id,user.id,CONFIG.code,previous.version]);
      if(!q.rows[0]){await client.query('ROLLBACK');return json({error:'version_conflict'},409)}
      saved=q.rows[0];
    }else{
      const q=await client.query(`INSERT INTO ulomis_threads(id,user_id,variant,category,title,counterparty_label,amount_minor,currency,stage,state,next_actor,attention_date,next_action_text,state_summary,canonical_state,evidence,history,corrections,last_delta,source_text,version,resolved_at,created_at,updated_at,last_request_id) VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19::jsonb,$20,$21,$22,$23,$24,$25) RETURNING *`,[id,user.id,CONFIG.code,p.category,p.title,p.counterpartyLabel,p.amountMinor,p.currency||null,p.stage,p.state,p.nextActor,p.attentionDate,p.nextActionText,p.summary,JSON.stringify(candidate),JSON.stringify(evidence),JSON.stringify(history),JSON.stringify(corrections),JSON.stringify(delta),raw,version,p.state===D.STATES.RESOLVED?now:null,now,now,requestId]);
      saved=q.rows[0];
    }
    await client.query('COMMIT');
    logAsync(context,logEvent({userId:user.id,name:'reconstruction_accepted',category:p.category,milestone:previous?'delta':'accepted',meta:{requestId}}));
    return json({item:rowToDomain(saved),delta,idempotentReplay:false});
  }catch(e){
    await client.query('ROLLBACK').catch(()=>{});
    if(e?.code==='23505'){
      const replay=await byRequest(user.id,requestId).catch(()=>null);
      if(replay)return json({item:rowToDomain(replay),delta:replay.last_delta||null,idempotentReplay:true});
    }
    console.error('accept_failed',{requestId,code:e?.code,message:e?.message});
    return json({error:'persist_failed',message:'Ulomis could not save the accepted state. Nothing was partially applied. Try again.'},500);
  }finally{client.release()}
}
