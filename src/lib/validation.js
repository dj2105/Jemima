export function validateGeminiKey(k){
  // Env-first: empty is allowed ONLY if an env key exists (handled in KeyRoom logic).
  if (!k) return false;
  // Basic pattern check for Google AI keys (len >= 20). We allow others (gsk_*, etc.) as well.
  if (k.startsWith('AIza') || k.startsWith('gsk_') || k.length >= 20) return true;
  return false;
}

export function validateJSON(txt, emptyIsOk){
  if (!txt || txt.trim() === '') return !!emptyIsOk;
  try{ JSON.parse(txt); return true; }catch{ return false; }
}

export function validateFirestoreConfig(txt){
  // Accept env string JSON or pasted JSON
  if (!txt || txt.trim() === '') return false;
  try{
    const cfg = typeof txt === 'string' ? JSON.parse(txt) : txt;
    const req = ['apiKey','authDomain','projectId','appId'];
    return req.every(k => cfg && typeof cfg[k] === 'string' && cfg[k].length > 0);
  }catch{ return false; }
}

export function defaultCodeFormatJSON(){
  return { type:'alnum4', exclude:['O','0'] };
}