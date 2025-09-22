// Default format: 4 chars, uppercase A–Z / digits, excluding 0 and O
const DEFAULT = { type: 'alnum4', exclude: ['O','0'] };

export function defaultConfig(){ return { ...DEFAULT }; }

export function getCodeConfig(json){
  if (!json) return defaultConfig();
  try{
    const obj = JSON.parse(json);
    if (obj && obj.type) return obj;
    return defaultConfig();
  }catch{ return defaultConfig(); }
}

export function generateCode(cfg = DEFAULT){
  if ((cfg.type || 'alnum4') === 'alnum4'){
    const excludeSet = new Set((cfg.exclude || ['O','0']).map(String));
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      .split('')
      .filter(c => !excludeSet.has(c));
    // Ensure unique chars (your rule): never same char more than once
    let code = '';
    while (code.length < 4){
      const c = alphabet[Math.floor(Math.random() * alphabet.length)];
      if (!code.includes(c)) code += c;
    }
    return code;
  }
  // Future: word-pair, etc.
  return 'ABCD';
}

export function validateCodeInput(val){
  if (!val || val.length !== 4) return false;
  if (/[oO0]/.test(val)) return false;
  return /^[A-Z1-9]{4}$/.test(val); // 1–9 allowed; 0 excluded by pattern
}