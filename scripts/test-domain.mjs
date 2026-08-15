import assert from 'node:assert/strict';
import * as D from '../domain.js';
import { CONFIG } from '../variant-config.js';

assert.equal(CONFIG.hasAmount,false);
assert.equal(CONFIG.hasStage,false);

const evidence="The school form is due on the 17th. I thought Ahmed sent it, but he said he only filled it in. We still need the passport copy and there is no submission confirmation.";
const base={
  matter:{title:'School registration',category:'school_admin',amountMinor:null,currency:'',counterparty:'Ahmed',stage:'SUBMITTED',amountEvidenceQuote:'',counterpartyEvidenceQuote:'Ahmed',stageEvidenceQuote:'sent it'},
  currentState:{status:'RESOLVED',summary:'Registration is not confirmed.',ownerType:'COUNTERPARTY',ownerLabel:'Ahmed',expectedDate:null,nextAction:'Get passport copy and confirm submission.',ownerEvidenceQuote:'Ahmed',expectedDateEvidenceQuote:'',resolutionEvidenceQuote:''},
  facts:[{kind:'observation',status:'USER_PROVIDED',text:'Passport copy is still needed.',evidenceQuote:'still need the passport copy'}],
  actors:[{name:'Ahmed',role:'household member',evidenceQuote:'Ahmed'}],
  events:[],commitments:[],decisions:[],uncertainties:[],contradictions:[],missingConfirmations:['Submission confirmation'],dependencies:[],resolutionCriteria:['School confirms receipt of the completed registration'],provenance:[{statement:'Passport copy remains outstanding.',evidenceQuote:'still need the passport copy'}]
};
const c=D.validateCandidate(base,[evidence]);
assert.equal(c.currentState.status,D.STATES.UNCONFIRMED,'unsupported resolution must be downgraded');
assert.equal(c.matter.stage,'UNKNOWN','household variant must not invent/use opportunity stages');
assert.equal(c.matter.amountMinor,null,'household variant has no amount projection');
assert.ok(c.uncertainties.some(x=>/Resolution is not confirmed/.test(x.text)));
assert.equal(c.facts.length,1);
assert.equal(c.provenance.length,1);

const resolvedEvidence='The school emailed: registration received and complete.';
const resolved=D.validateCandidate({
  ...base,
  matter:{...base.matter,stage:'UNKNOWN',stageEvidenceQuote:''},
  currentState:{...base.currentState,status:'RESOLVED',summary:'Registration received and complete.',resolutionEvidenceQuote:'registration received and complete'},
  facts:[{kind:'event',status:'EVIDENCED',text:'School confirmed receipt and completion.',evidenceQuote:'registration received and complete'}],
  actors:[],uncertainties:[],missingConfirmations:[],provenance:[{statement:'Registration completed.',evidenceQuote:'registration received and complete'}]
},[resolvedEvidence]);
assert.equal(resolved.currentState.status,D.STATES.RESOLVED,'explicit completion evidence may resolve a thread');
console.log('Household LCE domain invariant tests passed.');
