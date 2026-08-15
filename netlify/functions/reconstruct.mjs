import { createHash, randomUUID } from 'node:crypto';
import { CONFIG } from '../../variant-config.js';
import * as D from '../../domain.js';
import { json,currentUser,ownedItem,rowToDomain,logEvent,recentAiCount } from './_server.mjs';
import { structuredResponse, LlmError, LLM_RUNTIME } from './_llm.mjs';

const PROMPT_VERSION='household-reconstruct-v3-fast';
const CANDIDATE_SCHEMA={type:'object',additionalProperties:false,properties:{matter:{type:'object',additionalProperties:false,properties:{title:{type:'string'},category:{type:'string',enum:Object.keys(CONFIG.categories)},amountMinor:{type:['integer','null']},currency:{type:'string'},counterparty:{type:'string'},stage:{type:'string',enum:D.STAGES},amountEvidenceQuote:{type:'string'},counterpartyEvidenceQuote:{type:'string'},stageEvidenceQuote:{type:'string'}},required:['title','category','amountMinor','currency','counterparty','stage','amountEvidenceQuote','counterpartyEvidenceQuote','stageEvidenceQuote']},currentState:{type:'object',additionalProperties:false,properties:{status:{type:'string',enum:Object.values(D.STATES)},summary:{type:'string'},ownerType:{type:'string',enum:D.OWNERS},ownerLabel:{type:'string'},expectedDate:{type:['string','null']},nextAction:{type:'string'},ownerEvidenceQuote:{type:'string'},expectedDateEvidenceQuote:{type:'string'},resolutionEvidenceQuote:{type:'string'}},required:['status','summary','ownerType','ownerLabel','expectedDate','nextAction','ownerEvidenceQuote','expectedDateEvidenceQuote','resolutionEvidenceQuote']},facts:{type:'array',items:{type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:['claim','event','commitment','decision','observation']},status:{type:'string',enum:['USER_PROVIDED','EVIDENCED']},text:{type:'string'},evidenceQuote:{type:'string'}},required:['kind','status','text','evidenceQuote']}},actors:{type:'array',items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},role:{type:'string'},evidenceQuote:{type:'string'}},required:['name','role','evidenceQuote']}},events:{type:'array',items:{type:'object',additionalProperties:false,properties:{kind:{type:'string'},description:{type:'string'},date:{type:['string','null']},evidenceQuote:{type:'string'}},required:['kind','description','date','evidenceQuote']}},commitments:{type:'array',items:{type:'object',additionalProperties:false,properties:{actor:{type:'string'},text:{type:'string'},expectedDate:{type:['string','null']},evidenceQuote:{type:'string'}},required:['actor','text','expectedDate','evidenceQuote']}},decisions:{type:'array',items:{type:'object',additionalProperties:false,properties:{description:{type:'string'},evidenceQuote:{type:'string'}},required:['description','evidenceQuote']}},uncertainties:{type:'array',items:{type:'object',additionalProperties:false,properties:{text:{type:'string'},reason:{type:'string'}},required:['text','reason']}},contradictions:{type:'array',items:{type:'object',additionalProperties:false,properties:{text:{type:'string'},evidenceQuoteA:{type:'string'},evidenceQuoteB:{type:'string'}},required:['text','evidenceQuoteA','evidenceQuoteB']}},missingConfirmations:{type:'array',items:{type:'string'}},dependencies:{type:'array',items:{type:'object',additionalProperties:false,properties:{from:{type:'string'},to:{type:'string'},relation:{type:'string'}},required:['from','to','relation']}},resolutionCriteria:{type:'array',items:{type:'string'}},provenance:{type:'array',items:{type:'object',additionalProperties:false,properties:{statement:{type:'string'},evidenceQuote:{type:'string'}},required:['statement','evidenceQuote']}}},required:['matter','currentState','facts','actors','events','commitments','decisions','uncertainties','contradictions','missingConfirmations','dependencies','resolutionCriteria','provenance']};
function evidenceTexts(previous,raw){return [...(previous?.evidence||[]).map(x=>x?.value||'').filter(Boolean),raw].slice(-12)}
function prompt({raw,previous,correction,surfaceCategoryHint}){const prior=previous?JSON.stringify(previous.canonicalState):'none';return `MODE: ${previous?'UPDATE EXISTING THREAD':'NEW THREAD'}\nACCEPTED PRIOR STATE:\n${prior}\nUSER CORRECTION:\n${correction?JSON.stringify(correction):'none'}\nSURFACE HINT (navigation only, never evidence):\n${surfaceCategoryHint||'none'}\nNEW RAW EVIDENCE:\n${raw}\nReconstruct candidate current reality. Unsupported assumptions belong in uncertainty.`}
function publicError(error,requestId){
  if(error instanceof LlmError){
    if(error.kind==='timeout')return json({error:'model_timeout',message:'Ulomis could not finish that reconstruction quickly enough. Nothing was saved; retry is safe.',requestId},504);
    if(error.kind==='rate_limit')return json({error:'model_rate_limit',message:'The reconstruction service is temporarily busy. Nothing was saved. Try again shortly.',requestId},503);
    if(error.kind==='provider_auth')return json({error:'model_configuration_error',message:'The reconstruction service is not configured correctly.',requestId},500);
    if(error.kind==='refusal')return json({error:'reconstruction_unavailable',message:'Ulomis could not reconstruct that input. Try describing only the household situation and relevant evidence.',requestId},422);
    return json({error:'reconstruction_failed',message:'Ulomis could not complete the reconstruction. Nothing was saved. Try again.',requestId},error.status||502);
  }
  return json({error:'reconstruction_failed',message:'Ulomis could not complete the reconstruction. Nothing was saved. Try again.',requestId},502);
}
function logAsync(context,promise){try{if(context?.waitUntil)context.waitUntil(promise.catch(()=>{}));else promise.catch(()=>{})}catch{}}

export default async function(req,context){
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  const requestId=randomUUID();
  const started=Date.now();
  const key=Netlify.env.get('OPENAI_API_KEY');
  if(!key)return json({error:'missing_OPENAI_API_KEY',message:'The reconstruction service is not configured.',requestId},500);
  let body={};try{body=await req.json()}catch{return json({error:'invalid_json',requestId},400)}
  const raw=String(body.rawText||'').trim();
  if(raw.length<8||raw.length>6000)return json({error:'raw_text_must_be_8_to_6000_characters',requestId},400);
  const browserSessionId=String(body.sessionId||'').slice(0,120)||null;
  const user=await currentUser();
  const ip=String(context?.ip||'unknown');
  const day=new Date().toISOString().slice(0,10);
  const abuseKey=user?null:`guest_${createHash('sha256').update(`${CONFIG.code}:${day}:${ip}`).digest('hex').slice(0,40)}`;
  const sessionId=user?browserSessionId:abuseKey;
  let previous=null;
  if(body.threadId){if(!user)return json({error:'auth_required_for_update',requestId},401);const row=await ownedItem(user.id,String(body.threadId));if(!row)return json({error:'thread_not_found',requestId},404);previous=rowToDomain(row)}
  const correction=body.correction&&typeof body.correction==='object'?{category:String(body.correction.category||''),note:String(body.correction.note||'').trim().slice(0,1000)}:null;
  if(correction&&(!D.CORRECTION_CATEGORIES.includes(correction.category)||correction.note.length<2))return json({error:'invalid_correction',requestId},400);
  const hint=Object.hasOwn(CONFIG.categories,String(body.surfaceCategoryHint||''))?String(body.surfaceCategoryHint):null;
  const count=await recentAiCount(user?.id||null,sessionId);
  if(count>=20)return json({error:'reconstruction_rate_limit',message:'Too many reconstructions this hour. Try again later.',requestId},429);
  const model=Netlify.env.get('OPENAI_RECONSTRUCTION_MODEL')||'gpt-5.6-luna';
  await logEvent({userId:user?.id||null,sessionId,name:'ai_reconstruct',category:hint,milestone:previous?'update':'new',meta:{requestId,promptVersion:PROMPT_VERSION,model}}).catch(()=>{});
  const input=[{role:'system',content:CONFIG.systemPrompt},{role:'user',content:prompt({raw,previous,correction,surfaceCategoryHint:hint})}];
  const safetyIdentifier=createHash('sha256').update(String(user?.id||sessionId||requestId)).digest('hex').slice(0,64);
  try{
    const modelResult=await structuredResponse({apiKey:key,model,input,schema:CANDIDATE_SCHEMA,safetyIdentifier});
    let parsed;try{parsed=JSON.parse(modelResult.text)}catch{throw new LlmError('malformed_output','Model output was not valid JSON.',{status:502,attempts:modelResult.attempts,latencyMs:modelResult.latencyMs,providerRequestId:modelResult.providerRequestId})}
    let candidate;try{candidate=D.validateCandidate(parsed,evidenceTexts(previous,raw))}catch{throw new LlmError('semantic_invalid','Model output failed deterministic validation.',{status:502,attempts:modelResult.attempts,latencyMs:modelResult.latencyMs,providerRequestId:modelResult.providerRequestId})}
    const delta=D.buildDelta(previous,candidate);
    logAsync(context,logEvent({userId:user?.id||null,sessionId,name:'reconstruction_generated',category:candidate.matter.category,milestone:previous?'delta':'new',meta:{requestId,promptVersion:PROMPT_VERSION,model,latencyMs:modelResult.latencyMs,attempts:modelResult.attempts,inputTokens:modelResult.usage.inputTokens,outputTokens:modelResult.usage.outputTokens,status:'ok',schemaValid:true,domainValid:true}}));
    return json({candidate,delta,mode:previous?'update':'new',threadId:previous?.id||null,model,requestId});
  }catch(error){
    const failureClass=error instanceof LlmError?error.kind:'application';
    console.error('reconstruct_failed',{requestId,failureClass,message:error?.message});
    logAsync(context,logEvent({userId:user?.id||null,sessionId,name:'ai_reconstruct_failed',category:hint,milestone:previous?'update':'new',meta:{requestId,promptVersion:PROMPT_VERSION,model,latencyMs:Number(error?.latencyMs||Date.now()-started),attempts:Number(error?.attempts||1),failureClass,status:'failed'}}));
    return publicError(error,requestId);
  }
}

export { CANDIDATE_SCHEMA, PROMPT_VERSION, LLM_RUNTIME };
