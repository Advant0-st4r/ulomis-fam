import { getSettings } from '@netlify/identity';
import { db,json } from './_server.mjs';
import { LLM_RUNTIME } from './_llm.mjs';

export default async function(req){
  if(req.method!=='GET')return json({error:'method_not_allowed'},405);
  let databaseReachable=false,identityConfigured=false;
  try{const d=db();await d.sql`SELECT 1 AS ok`;databaseReachable=true}catch(e){console.error('db_health',e)}
  try{await getSettings();identityConfigured=true}catch{}
  const openAIKeyConfigured=!!Netlify.env.get('OPENAI_API_KEY');
  const ok=databaseReachable&&identityConfigured&&openAIKeyConfigured;
  return json({
    ok,
    checks:{
      databaseReachable,
      identityConfigured,
      openAIKeyConfigured,
      openAIModel:Netlify.env.get('OPENAI_RECONSTRUCTION_MODEL')||'gpt-5.6-luna',
      llmAttempts:LLM_RUNTIME.MAX_ATTEMPTS,
      llmAttemptTimeoutMs:LLM_RUNTIME.ATTEMPT_TIMEOUT_MS,
      llmMaxOutputTokens:LLM_RUNTIME.MAX_OUTPUT_TOKENS,
      providerResponseStorage:false
    },
    requiredHumanSetup:identityConfigured?[]:['Enable Netlify Identity in Project configuration → Identity'],
    requiredEnvironment:['OPENAI_API_KEY'],
    optionalEnvironment:['OPENAI_RECONSTRUCTION_MODEL']
  },ok?200:500)
}
