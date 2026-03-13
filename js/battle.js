
const { loadProfile, saveProfile, expNeed } = window.STORE;
const { CLASSES, CLASS_BASE, SKILLS, enemyForFloor } = window.GAME_DATA;
const ROC = window.ROC;

const el = (id)=>document.getElementById(id);
const logEl = el("log");

function log(msg, cls=""){
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = msg;
  logEl.prepend(d);
}

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function fmt(n){ return Math.round(n); }

function className(id){ return CLASSES.find(c=>c.id===id)?.name || "-"; }

// --- Status system (simple)
function tickDots(target){
  if(!target.status) return 0;
  let total = 0;
  for(const s of target.status){
    if(!s.dotPct) continue;
    const dmg = Math.max(1, Math.round(target.hpMax * s.dotPct));
    target.hp = clamp(target.hp - dmg, 0, target.hpMax);
    total += dmg;
    log(`${target.side} suffers ${s.id.toUpperCase()} DOT -${dmg}`, "bad");
  }
  return total;
}

function decTimers(entity){
  // status
  if(entity.status){
    entity.status.forEach(s=> s.turns--);
    entity.status = entity.status.filter(s=> s.turns>0);
  }
  // buffs
  if(entity.buffs){
    entity.buffs.forEach(b=> b.turns--);
    entity.buffs = entity.buffs.filter(b=> b.turns>0);
  }
  if(entity.debuffs){
    entity.debuffs.forEach(b=> b.turns--);
    entity.debuffs = entity.debuffs.filter(b=> b.turns>0);
  }
}

function hasStatus(entity, id){
  return (entity.status||[]).some(s=>s.id===id);
}

function getBuff(entity, key){
  let v = 0;
  (entity.buffs||[]).forEach(b=>{ if(b[key]) v += b[key]; });
  (entity.debuffs||[]).forEach(b=>{ if(b[key]) v += b[key]; });
  return v;
}

function addStatus(entity, st, source=""){
  if(!st) return;
  const chance = st.chance ?? 1.0;
  if(Math.random() > chance) return;
  entity.status = entity.status || [];
  entity.status.push({ ...st });
  log(`${entity.side} is afflicted: ${st.id.toUpperCase()} (${st.turns}t)`, "bad");
}

function addBuff(entity, buff){
  if(!buff) return;
  entity.buffs = entity.buffs || [];
  entity.buffs.push({ ...buff });
  log(`${entity.side} gains BUFF (${buff.turns}t)`, "good");
}

function addDebuff(entity, debuff){
  if(!debuff) return;
  entity.debuffs = entity.debuffs || [];
  entity.debuffs.push({ ...debuff });
  log(`${entity.side} gets DEBUFF (${debuff.turns}t)`, "bad");
}

function cleanseOne(entity){
  if(entity.status && entity.status.length){
    const removed = entity.status.shift();
    log(`${entity.side} cleansed ${removed.id.toUpperCase()}`, "good");
  } else {
    log(`${entity.side} has nothing to cleanse`, "muted");
  }
}

// --- Battle state
let profile = loadProfile();
if(!profile.classId){
  location.href = "./index.html";
}

const base = CLASS_BASE[profile.classId];
const lv = profile.level;

function scaleStat(x){ return Math.round(x * (1 + (lv-1)*0.06)); }

const player = {
  side:"Player",
  classId: profile.classId,
  level: lv,
  hpMax: scaleStat(base.hp),
  mpMax: scaleStat(base.mp),
  hp: scaleStat(base.hp),
  mp: scaleStat(base.mp),
  atk: scaleStat(base.atk),
  def: scaleStat(base.def),
  crit: base.crit,
  buffs: [], debuffs: [], status: [],
};

let enemy = enemyForFloor(profile.floor);
enemy.side = "Enemy";
enemy.buffs = []; enemy.debuffs = []; enemy.status = [];

let turn = 1;
let playerActed = false;
let battleOver = false;

function updateUI(){
  el("plName").textContent = profile.name || "Player";
  el("plClass").textContent = className(profile.classId);
  el("plLv").textContent = player.level;
  el("plEl").textContent = "Neutral";

  el("plHpTxt").textContent = `${player.hp}/${player.hpMax}`;
  el("plHpBar").style.width = `${(player.hp/player.hpMax)*100}%`;
  el("plMpTxt").textContent = `${player.mp}/${player.mpMax}`;
  el("plMpBar").style.width = `${(player.mp/player.mpMax)*100}%`;

  el("enName").textContent = enemy.name;
  el("enFloor").textContent = enemy.floor;
  el("enDefLv").textContent = enemy.defLv;
  el("enEl").textContent = enemy.element;
  el("enHpTxt").textContent = `${enemy.hp}/${enemy.hpMax}`;
  el("enHpBar").style.width = `${(enemy.hp/enemy.hpMax)*100}%`;

  el("turnNo").textContent = turn;
  el("pGold2").textContent = profile.gold;

  // Buff badges
  const pb = [];
  const atkB = getBuff(player,"atkPct");
  const defB = getBuff(player,"defPct");
  const dmgRed = getBuff(player,"dmgRedPct");
  const imb = (player.buffs||[]).find(b=>b.imbue)?.imbue;
  if(atkB) pb.push(`ATK ${atkB>0?"+":""}${atkB}%`);
  if(defB) pb.push(`DEF ${defB>0?"+":""}${defB}%`);
  if(dmgRed) pb.push(`RED ${dmgRed}%`);
  if(imb) pb.push(`IMBUE ${imb}`);
  el("plBuffs").textContent = pb.length?pb.join(" • "):"No buffs";

  const ps = (player.status||[]).map(s=>`${s.id.toUpperCase()} ${s.turns}t`);
  if(ps.length){ el("plDebuffs").style.display="inline-flex"; el("plDebuffs").textContent = ps.join(" • "); }
  else { el("plDebuffs").style.display="none"; }

  const eb = [];
  const eatk = getBuff(enemy,"atkPct");
  const edef = getBuff(enemy,"defPct");
  if(eatk) eb.push(`ATK ${eatk>0?"+":""}${eatk}%`);
  if(edef) eb.push(`DEF ${edef>0?"+":""}${edef}%`);
  el("enBuffs").textContent = eb.length?eb.join(" • "):"No buffs";

  const es = (enemy.status||[]).map(s=>`${s.id.toUpperCase()} ${s.turns}t`);
  if(es.length){ el("enDebuffs").style.display="inline-flex"; el("enDebuffs").textContent = es.join(" • "); }
  else { el("enDebuffs").style.display="none"; }

  el("btnEnd").disabled = !playerActed || battleOver;
}

function calcDamage(attacker, defender, skill, hitIndex=1){
  const atkPct = getBuff(attacker,"atkPct");
  const defPct = getBuff(defender,"defPct");
  const defenderDef = Math.max(0, defender.def * (1 + defPct/100));
  const baseAtk = attacker.atk * (1 + atkPct/100);

  const raw = Math.max(1, (baseAtk * skill.power) - defenderDef);
  // element for physical: can be imbued
  let atkEl = skill.element || "Neutral";
  if(skill.type === "physical"){
    const imb = (attacker.buffs||[]).find(b=>b.imbue)?.imbue;
    if(imb) atkEl = imb;
  }
  const beforeElement = raw;

  const after = ROC.applyElement(beforeElement, atkEl, defender.element, defender.defLv, 0);
  let dmg = Math.round(after);

  // crit
  const critBonus = skill.meta?.critBonus || 0;
  const critPctBonus = getBuff(attacker,"critPct")/100;
  const critChance = Math.min(0.75, attacker.crit + critBonus + critPctBonus);
  const isCrit = Math.random() < critChance;
  if(isCrit && dmg>0) dmg = Math.round(dmg*1.6);

  // damage reduction buff
  const dmgRed = getBuff(defender,"dmgRedPct");
  if(dmgRed && dmg>0) dmg = Math.max(1, Math.round(dmg * (1 - dmgRed/100)));

  const tag = (dmg===0) ? "0%" : (isCrit ? "CRIT" : "");
  return { dmg, atkEl, isCrit, tag };
}

function spendMP(cost){
  player.mp = clamp(player.mp - cost, 0, player.mpMax);
}

function applyHeal(pct){
  const amount = Math.max(1, Math.round(player.hpMax * pct));
  player.hp = clamp(player.hp + amount, 0, player.hpMax);
  log(`Player heals +${amount}`, "good");
}

function doPlayerSkill(skill){
  if(battleOver) return;
  if(playerActed) return;

  if(skill.mp > player.mp){
    log("Not enough MP!", "bad");
    return;
  }

  // stun check
  if(hasStatus(player,"stun")){
    log("Player is STUNNED and cannot act!", "bad");
    playerActed = true;
    return;
  }

  spendMP(skill.mp);

  // Support skills
  if(skill.type === "support"){
    if(skill.meta?.cleanse) cleanseOne(player);
    if(skill.meta?.healPct) applyHeal(skill.meta.healPct);
    if(skill.meta?.buff) addBuff(player, skill.meta.buff);
    if(skill.meta?.debuff) addDebuff(enemy, skill.meta.debuff);
    if(skill.meta?.status) addStatus(enemy, skill.meta.status);
    playerActed = true;
    updateUI();
    return;
  }

  // Damage skills
  const hits = skill.meta?.hits || 1;
  for(let i=1;i<=hits;i++){
    const r = calcDamage(player, enemy, skill, i);
    enemy.hp = clamp(enemy.hp - r.dmg, 0, enemy.hpMax);

    const extra = r.tag ? ` (${r.tag})` : "";
    log(`Player uses ${skill.name} → ${enemy.element} -${r.dmg}${extra}`, r.dmg>0 ? "good" : "muted");

    if(skill.meta?.status) addStatus(enemy, skill.meta.status);
    if(skill.meta?.debuff) addDebuff(enemy, skill.meta.debuff);

    if(enemy.hp<=0) break;
  }

  playerActed = true;
  updateUI();
}

function enemyAct(){
  if(battleOver) return;

  // enemy DOT tick at start of its turn
  tickDots(enemy);

  if(enemy.hp<=0) return;

  if(hasStatus(enemy,"stun")){
    log("Enemy is STUNNED and skips turn!", "good");
    return;
  }

  // enemy basic attack (elemental) with small chance to poison/burn on higher floors
  const skill = { name:"Enemy Attack", type:"physical", element: enemy.element, mp:0, power:1.0, meta:{} };
  const r = calcDamage(enemy, player, skill);
  player.hp = clamp(player.hp - r.dmg, 0, player.hpMax);
  const extra = r.tag ? ` (${r.tag})` : "";
  log(`Enemy attacks → Player -${r.dmg}${extra}`, "bad");

  // status chance
  const chance = enemy.type==="boss" ? 0.25 : enemy.type==="miniBoss" ? 0.18 : 0.10;
  if(Math.random() < chance){
    const st = (enemy.element==="Poison") ? { id:"poison", turns:3, dotPct:0.08 } :
               (enemy.element==="Fire") ? { id:"burn", turns:2, dotPct:0.09 } :
               (enemy.element==="Water") ? { id:"stun", turns:1, chance:0.25 } :
               null;
    if(st) addStatus(player, st);
  }

  updateUI();
}

function checkEnd(){
  if(battleOver) return;

  if(player.hp<=0){
    battleOver = true;
    log("❌ You are defeated. Back to Lobby.", "bad");
    setTimeout(()=>location.href="./index.html", 900);
    return;
  }
  if(enemy.hp<=0){
    battleOver = true;
    const expGain = 20 + enemy.floor*10 + (enemy.type==="miniBoss"?30:0) + (enemy.type==="boss"?80:0);
    const goldGain = 10 + enemy.floor*6 + (enemy.type==="miniBoss"?25:0) + (enemy.type==="boss"?60:0);

    profile.exp += expGain;
    profile.gold += goldGain;

    log(`🏆 Victory! +${expGain} EXP +${goldGain} Gold`, "good");

    // Level up
    while(profile.exp >= expNeed(profile.level+1)){
      profile.level += 1;
      log(`⬆️ Level Up! LV ${profile.level}`, "good");
    }

    profile.floor = Math.min(10, profile.floor + 1);
    saveProfile(profile);

    el("btnNext").style.display = "inline-flex";
    el("btnEnd").disabled = true;
    return;
  }
}

function endTurn(){
  if(battleOver) return;
  if(!playerActed) return;

  // tick DOT on player at start of enemy turn
  tickDots(player);

  // enemy acts
  enemyAct();

  // decrease timers after full round
  decTimers(player);
  decTimers(enemy);

  turn += 1;
  playerActed = false;

  updateUI();
  checkEnd();
}

function nextFloor(){
  battleOver = false;
  playerActed = false;
  turn = 1;
  // restore a bit each floor
  player.hp = clamp(player.hp + Math.round(player.hpMax*0.22), 1, player.hpMax);
  player.mp = clamp(player.mp + Math.round(player.mpMax*0.35), 0, player.mpMax);
  // clear stun only
  player.status = (player.status||[]).filter(s=>s.id!=="stun");

  enemy = enemyForFloor(profile.floor);
  enemy.side="Enemy"; enemy.buffs=[]; enemy.debuffs=[]; enemy.status=[];

  log(`--- Enter Floor ${enemy.floor} (${enemy.type}) ---`, "muted");
  el("btnNext").style.display="none";
  updateUI();
}

function renderSkills(){
  const wrap = el("skillBar");
  wrap.innerHTML = "";
  const list = SKILLS[profile.classId] || [];
  list.forEach(sk=>{
    const box = document.createElement("div");
    box.className = "skill";
    const disabled = battleOver || playerActed || sk.mp > player.mp || (hasStatus(player,"stun") && !playerActed);
    box.innerHTML = `
      <div class="row" style="justify-content:space-between;">
        <div class="name">${sk.name}</div>
        <span class="badge">${sk.element}</span>
      </div>
      <div class="meta">
        <span>MP ${sk.mp}</span>
        <span>${sk.type}</span>
        <span>x${sk.power.toFixed(2)}</span>
      </div>
      <div class="desc">${sk.desc}</div>
      <button class="btn ${sk.id==='atk'?'primary':''}" style="width:100%; margin-top:10px;" ${disabled?"disabled":""}>
        Use
      </button>
    `;
    box.querySelector("button").onclick = ()=>{
      doPlayerSkill(sk);
      renderSkills();
      checkEnd();
      updateUI();
      el("btnEnd").disabled = !playerActed || battleOver;
    };
    wrap.appendChild(box);
  });
}

el("btnEnd").onclick = ()=>{ endTurn(); renderSkills(); };
el("btnNext").onclick = ()=>{ nextFloor(); renderSkills(); };

// start
log(`--- Enter Floor ${enemy.floor} (${enemy.type}) ---`, "muted");
updateUI();
renderSkills();
