const NS = 'jemimas-asking';

export function saveLocal(key, obj){
  try{
    localStorage.setItem(`${NS}:${key}`, JSON.stringify(obj));
  }catch{}
}
export function loadLocal(key){
  try{
    const v = localStorage.getItem(`${NS}:${key}`);
    return v ? JSON.parse(v) : null;
  }catch{ return null; }
}