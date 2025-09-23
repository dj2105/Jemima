export function validateGeminiKey(s){ return typeof s==="string" ? s.trim().length>8 : false; }
export function validateJSON(s,emptyOK=false){ if(!s||!s.trim()) return !!emptyOK; try{ JSON.parse(s); return true; }catch{ return false; } }
export function validateFirestoreConfig(s){ if(!s) return false; try{ const o=typeof s==="string"?JSON.parse(s):s; return !!o.apiKey; }catch{ return false; } }
export function defaultCodeFormatJSON(){ return { type:"alnum4", exclude:["O","0"] }; }