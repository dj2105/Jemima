// /src/gemini.js
// STRICT JSON generation + verification with auto-repair (no fallbacks).
// Adds per-round generation: callGeminiQuestionsForRound(apiKey, userPrompt, roundNum, {repairRounds})

const MODEL = 'gemini-2.0-flash';
const MAX_OUTPUT_TOKENS = 4096;
const VERIFY_BATCH_SIZE = 8;

// ----------------------------- Core HTTP -----------------------------
function headers(apiKey) {
  return { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
}
function extractText(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map(p => p?.text).filter(Boolean).join('\n').trim();
}
function parseMaybeFencedJSON(text) {
  const m = /```json\s*([\s\S]*?)```/i.exec(text);
  const raw = (m ? m[1] : text).replace(/^\uFEFF/, '').replace(/```$/m, '').trim();
  return JSON.parse(raw);
}
async function post(apiKey, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  let res;
  try { res = await fetch(url, { method: 'POST', headers: headers(apiKey), body: JSON.stringify(body) }); }
  catch (e) { const err = new Error('Network error calling Gemini: ' + (e?.message || e)); err.stage = 'network'; throw err; }
  const ok = res.ok;
  let json = null, textRaw = '';
  try { json = await res.json(); } catch { textRaw = await res.text().catch(()=> ''); }
  if (!ok) { const err = new Error(`Gemini HTTP ${res.status}`); err.stage = 'http'; err.httpStatus = res.status; err.httpBody = json || textRaw || null; throw err; }
  const text = extractText(json);
  if (!text) { const err = new Error('Gemini returned empty content.'); err.stage = 'empty'; err.raw = json; throw err; }
  return { json, text };
}
async function callStrictJSON(apiKey, systemPreamble, userPrompt, genCfgOverride = {}) {
  const baseBody = {
    contents: [{ role: 'user', parts: [{ text: (systemPreamble || '').trim() + '\n\n' + (userPrompt || '').trim() }]}],
    generationConfig: { temperature: 0.5, topP: 0.9, candidateCount: 1, responseMimeType: 'application/json', maxOutputTokens: MAX_OUTPUT_TOKENS, ...genCfgOverride }
  };
  let first;
  try { first = await post(apiKey, baseBody); } catch (e) { throw e; }
  try { return { json: parseMaybeFencedJSON(first.text), rawText: first.text, raw: first.json }; }
  catch {
    const colder = { ...baseBody,
      contents: [{ role: 'user', parts: [{ text: `STRICT JSON ONLY. No markdown.\n\n${(systemPreamble||'').trim()}\n\n${(userPrompt||'').trim()}` }]}],
      generationConfig: { ...baseBody.generationConfig, temperature: 0.2, topP: 0.8 }
    };
    const second = await post(apiKey, colder);
    return { json: parseMaybeFencedJSON(second.text), rawText: second.text, raw: second.json };
  }
}

// ----------------------------- Helpers -----------------------------
function difficultyForRound(r) {
  return {1:'pub-quiz',2:'enthusiast',3:'deep detail',4:'specialist',5:'pin-point'}[Number(r)] || 'pub-quiz';
}
function compactQ(q) {
  const A = Array.isArray(q?.options) ? q.options.find(o => o?.key==='A') : null;
  const B = Array.isArray(q?.options) ? q.options.find(o => o?.key==='B') : null;
  return { id:String(q?.id||''), prompt:String(q?.prompt||''), A:String(A?.text||''), B:String(B?.text||''), correct:q?.correct };
}
function inflateQ(cq) {
  return { id:cq.id, prompt:cq.prompt, options:[{key:'A',text:cq.A},{key:'B',text:cq.B}], correct:cq.correct };
}

// ----------------------------- Verification -----------------------------
async function batchVerify(apiKey, batch) {
  const preamble = `
OUTPUT STRICT JSON ONLY.
Verify each question. Schema:
{"results":[{"i":0,"verdict":"pass"|"fail","reason":"string"}]}
Fail if: wrong correct, other not false, ambiguous, post-2024 dependent, or uncertain.`;
  const user = { items: batch.map((b,i)=>({i,round:b.round,difficulty:difficultyForRound(b.round),prompt:b.q.prompt,A:b.q.A,B:b.q.B,correct:b.q.correct})) };
  const {json} = await callStrictJSON(apiKey,preamble,JSON.stringify(user,null,2),{temperature:0.2,topP:0.8});
  return Array.isArray(json?.results)?json.results:[];
}
async function generateAlternates(apiKey, failedItems) {
  const preamble = `
OUTPUT STRICT JSON ONLY.
Generate replacements. Schema:
{"replacements":[{"id":"string","prompt":"string","A":"string","B":"string","correct":"A"|"B"}]}
Constraints: UK English; 80–140 char prompt; two options; plausible distractor; facts stable ≤2024.`;
  const user={requests:failedItems.map(f=>({round:f.round,difficulty:difficultyForRound(f.round),previous:{prompt:f.q.prompt,A:f.q.A,B:f.q.B}}))};
  const {json}=await callStrictJSON(apiKey,preamble,JSON.stringify(user,null,2),{temperature:0.6,topP:0.9});
  return Array.isArray(json?.replacements)?json.replacements:[];
}
async function verifyAndRepair(apiKey, rounds, repairRounds = 2) {
  let flat=[]; rounds.forEach((r,ri)=> (r.questions||[]).forEach((q,qi)=>flat.push({round:r.round,index:qi,q:compactQ(q)})));
  let rejected=[];

  for(let attempt=0; attempt<=repairRounds; attempt++){
    const verdicts=[];
    for(let i=0;i<flat.length;i+=VERIFY_BATCH_SIZE){
      const res=await batchVerify(apiKey,flat.slice(i,i+VERIFY_BATCH_SIZE));
      res.forEach(r=>{ verdicts[i+r.i]=r; });
    }
    const fails=verdicts.map((v,i)=>!v||v.verdict!=='pass'?i:null).filter(x=>x!==null);
    if(fails.length===0) break;

    if(attempt===repairRounds){
      const sample = fails.slice(0,6).map(i=>`R${flat[i].round} Q${flat[i].index+1}: ${verdicts[i]?.reason||'unverified'} — ${flat[i].q.prompt}`).join('\n');
      const err = new Error(`Verification failed after ${repairRounds} repairs.\n${sample}`);
      err.stage = 'verify-failed';
      err.rejected = fails.map(i=>({round:flat[i].round,index:flat[i].index,prompt:flat[i].q.prompt,reason:verdicts[i]?.reason||'unverified'}));
      throw err;
    }

    const failItems=fails.map(i=>flat[i]);
    rejected.push(...failItems.map(f=>({round:f.round,index:f.index,prompt:f.q.prompt,reason:verdicts[f.index]?.reason||'rejected'})));
    const reps=await generateAlternates(apiKey,failItems);
    reps.forEach((r,j)=>{
      if(r&&r.correct&&r.prompt&&r.A&&r.B){
        const newQ=inflateQ(r); const t=failItems[j];
        rounds[t.round-1].questions[t.index]=newQ;
        flat[fails[j]]={round:t.round,index:t.index,q:compactQ(newQ)};
      }
    });
  }

  return {rounds,rejected};
}

// ----------------------------- Public -----------------------------
export async function callGeminiQuestionsForRound(apiKey, userPrompt, roundNum, opts = {}) {
  const repairRounds = Math.max(0, Number(opts.repairRounds ?? 2));
  const preamble=`OUTPUT STRICT JSON ONLY.
Schema: {"round":${roundNum},"questions":[{"id":"string","prompt":"string","options":[{"key":"A","text":"string"},{"key":"B","text":"string"}],"correct":"A"|"B"}]}
Rules:
- Exactly 1 round ("round": ${roundNum}) with exactly 6 questions.
- Two choices (A/B); "correct" is "A" or "B".
- Prompt 80–140 chars; options ≤80 chars; similar style; British English.
- Difficulty: ${difficultyForRound(roundNum)}.
- Diverse subjects overall (you don't know others yet; still avoid clichés).
- Facts stable ≤2024; avoid 2025+ developments.`;
  const gen=await callStrictJSON(apiKey,preamble,userPrompt);
  const qArr = Array.isArray(gen?.json?.questions) ? gen.json.questions : [];
  if (qArr.length !== 6) { const err=new Error(`Round ${roundNum} generator returned ${qArr.length} questions (expected 6).`); err.stage='generate-shape'; err.rawText=gen.rawText; throw err; }
  const rounds = [{ round: roundNum, questions: qArr }];
  const { rounds: verified, rejected } = await verifyAndRepair(apiKey, rounds, repairRounds);
  return { json: { round: roundNum, questions: verified[0].questions }, rawText: gen.rawText, raw: gen.raw, rejected };
}

export async function callGeminiInterludesAndMaths(apiKey,userPrompt){
  const preamble=`OUTPUT STRICT JSON ONLY.
Schema: {"interludes":["string","string","string","string"],"maths":{"questions":[{"prompt":"string"},{"prompt":"string"}],"answers":[integer,integer]}}
Rules:
- 4 interludes, 1–3 sentences.
- 2 maths Qs, whole-number answers.
- Concise prompts (≤140 chars).`;
  return callStrictJSON(apiKey,preamble,userPrompt);
}
