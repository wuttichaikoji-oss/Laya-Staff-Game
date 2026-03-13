
// Simple local save (offline-first)
const KEY = "laya_tower_rpg_profile_v01";

function defaultProfile(){
  return {
    createdAt: Date.now(),
    classId: null,
    name: "Player",
    level: 1,
    exp: 0,
    gold: 0,
    floor: 1,
    stats: { hp: 100, mp: 50 },
    lastSeen: Date.now(),
  };
}

function expNeed(lv){
  // simple curve
  if(lv<=1) return 0;
  return Math.floor(80*lv*lv*0.55);
}

function loadProfile(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return defaultProfile();
    const p = JSON.parse(raw);
    return { ...defaultProfile(), ...p };
  }catch(e){
    return defaultProfile();
  }
}

function saveProfile(p){
  p.lastSeen = Date.now();
  localStorage.setItem(KEY, JSON.stringify(p));
}

function resetProfile(){
  localStorage.removeItem(KEY);
}

window.STORE = { KEY, loadProfile, saveProfile, resetProfile, expNeed };
