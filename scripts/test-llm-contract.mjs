import assert from 'node:assert/strict';
import { structuredResponse, LlmError, LLM_RUNTIME } from '../netlify/functions/_llm.mjs';

assert.equal(LLM_RUNTIME.MAX_ATTEMPTS,2);
assert.equal(LLM_RUNTIME.ATTEMPT_TIMEOUT_MS,12000);
assert.equal(LLM_RUNTIME.MAX_OUTPUT_TOKENS,1400);

const originalFetch=globalThis.fetch;
try{
  let calls=0, lastPayload=null;
  globalThis.fetch=async (_url,init)=>{
    calls+=1;lastPayload=JSON.parse(init.body);
    if(calls===1)return new Response(JSON.stringify({error:{message:'temporary'}}),{status:503,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({output_text:'{"ok":true}',usage:{input_tokens:10,output_tokens:5,total_tokens:15}}),{status:200,headers:{'content-type':'application/json','x-request-id':'req_test'}});
  };
  const result=await structuredResponse({apiKey:'test',model:'gpt-5.6-luna',input:'x',schema:{type:'object'},safetyIdentifier:'safe'});
  assert.equal(calls,2,'503 must retry once');
  assert.equal(result.text,'{"ok":true}');
  assert.equal(result.attempts,2);
  assert.equal(lastPayload.store,false,'provider response storage must be disabled');
  assert.equal(lastPayload.reasoning.effort,'none','reconstruction model must use no reasoning for latency');
  assert.equal(lastPayload.max_output_tokens,LLM_RUNTIME.MAX_OUTPUT_TOKENS);

  calls=0;
  globalThis.fetch=async()=>{calls+=1;throw Object.assign(new Error('aborted'),{name:'AbortError'})};
  await assert.rejects(()=>structuredResponse({apiKey:'test',model:'gpt-5.6-luna',input:'x',schema:{type:'object'}}),e=>e instanceof LlmError&&e.kind==='timeout');
  assert.equal(calls,1,'timeout must fail fast and must not be synchronously retried');

  calls=0;
  globalThis.fetch=async()=>{calls+=1;return new Response(JSON.stringify({error:{message:'bad key'}}),{status:401,headers:{'content-type':'application/json'}})};
  await assert.rejects(()=>structuredResponse({apiKey:'bad',model:'gpt-5.6-luna',input:'x',schema:{type:'object'}}),e=>e instanceof LlmError&&e.kind==='provider_auth');
  assert.equal(calls,1,'non-transient provider auth failure must not retry');
}finally{globalThis.fetch=originalFetch}
console.log('LLM boundary + latency/retry contract tests passed.');
