import { applyElement } from "./element-table-roc.js";

const el = (id) => document.getElementById(id);
const q = (sel) => document.querySelector(sel);

const player = el("player");
const enemy = el("enemy");
const arena = el("arena");
const logEl = el("log");

let __USER = null;

let hpP = 100;
let HP_MAX = 100;
let equipBonus = { atkPct:0, hpPct:0, imbue:null };

let towerData = null;
let spriteMap = null;
let skillSpec = null;
let itemSets = null;
let itemSetIndex = new Map();
let skillIndex = new Map();

let currentFloor = 10;
let enemies = [];
let targetIndex = 0;

let cooldowns = new Map();
let buffs = { damageBonusPct:0, damageBonusTurns:0, imbueElement:null, imbueTurns:0 };
let autoNext = true;

const DEFAULT_LOADOUTS = {
  striker: ["s_power_swing","s_double_hit","s_armor_break","s_smash_finisher"],
  arcanist: ["a_weakness_mark","a_cold_brew","a_hangover_hex","a_chain_reaction"],
  support: ["p_first_aid","p_encourage","p_barrier","p_miracle_service"],
  server_knight: ["s_quick_step","s_double_hit","s_execution","util_neutral_strike"],
  host_ranger: ["h_redirect","p_cleanse","p_guard_chant","util_scan"],
  bar_alchemist: ["b_flaming_shot","b_icy_tonic","b_mixology","a_smoke_screen"],
  steward_guardian: ["g_sanitize_shield","p_cleanse","p_guard_chant","p_barrier"]
};

// --- Items / Inventory ---
const RARITY_ORDER = { L:4, E:3, R:2, C:1 };

function rarityLabel(r){ return r==="L"?"Legend":r==="E"?"Epic":r==="R"?"Rare":"Common"; }

function rollChance(p){ return Math.random() < p; }

function rollRarity(floorType){
  const r = Math.random()*100;
  if(floorType==="boss"){
    if(r < 10) return "L";
    if(r < 45) return "E";
    return "R";
  }
  if(floorType==="miniBoss"){
    if(r < 1) return "L";
    if(r < 10) return "E";
    if(r < 45) return "R";
    return "C";
  }
  // normal
  if(r < 2) return "E";
  if(r < 20) return "R";
  return "C";
}

function rollSlot(){
  const r = Math.random()*100;
  if(r < 40) return "weapon";
  if(r < 75) return "armor";
  return "relic";
}

function scaledStat(base, floor, rarity){
  const mult = rarity==="L" ? 1.8 : rarity==="E" ? 1.45 : rarity==="R" ? 1.2 : 1.0;
  const f = Math.min(100, Math.max(1, floor));
  return Math.round((base + (f/12)) * mult);
}

function randomElement(){
  const els = ["Fire","Water","Wind","Earth","Poison","Holy","Shadow","Ghost","Undead","Neutral"];
  // prefer elemental for imbue; avoid Neutral too often
  const pick = els[Math.floor(Math.random()*(els.length-1))];
  return pick;
}


function randomSetId(){
  const ids = Array.from(itemSetIndex.keys());
  if(!ids.length) return null;
  return ids[Math.floor(Math.random()*ids.length)];
}

function makeItemName(slot, rarity){
  const pool = {
    weapon: ["Steak Knife","Tray Blade","Coffee Staff","Shaker Wand","Service Saber"],
    armor: ["Apron Armor","Non-slip Shoes","Service Vest","Heatproof Gloves","Bar Guard"],
    relic: ["VIP Badge","Checklist Charm","Reservation Token","Lucky Coin","Element Charm"]
  };
  const pre = rarity==="L" ? "Mythic" : rarity==="E" ? "Epic" : rarity==="R" ? "Rare" : "Common";
  const base = pool[slot][Math.floor(Math.random()*pool[slot].length)];
  return `${pre} ${base}`;
}

function rollDropItem(floor, floorType){
  const dropChance = floorType==="boss" ? 1.0 : (floorType==="miniBoss" ? 0.6 : 0.28);
  if(!rollChance(dropChance)) return null;

  const rarity = rollRarity(floorType);
  const slot = rollSlot();

  const id = `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const setId = randomSetId();
  const item = { id, slot, rarity, name: makeItemName(slot, rarity), setId, dropFloor: floor, upgrade: 0, createdAt: Date.now() };

  // stats
  if(slot === "weapon"){
    item.atkPct = scaledStat(3, floor, rarity);
    // imbue chance
    const imbueChance = rarity==="L" ? 0.85 : rarity==="E" ? 0.6 : rarity==="R" ? 0.35 : 0.15;
    if(rollChance(imbueChance)){
      item.imbue = randomElement();
    }
  } else if(slot === "armor"){
    item.hpPct = scaledStat(3, floor, rarity);
  } else {
    // relic
    item.atkPct = scaledStat(2, floor, rarity);
    if(rarity==="L" && rollChance(0.5)){
      item.imbue = randomElement(); // legendary relic can grant imbue aura
    }
  }
  return item;
}

function computeEquipmentBonus(game){
  const inv = Array.isArray(game.inventory) ? game.inventory : [];
  const eq = game.equipped || { weapon:null, armor:null, relic:null };
  const find = (id)=> inv.find(x=>x.id===id) || null;

  const w = find(eq.weapon);
  const a = find(eq.armor);
  const r = find(eq.relic);

  let atkPct = (w?.atkPct||0) + (r?.atkPct||0);
  let hpPct = (a?.hpPct||0);
  let imbue = (w?.imbue) || (r?.imbue) || null;

  let antiZeroMinPct = 0;

  // Determine best set among equipped pieces (2-piece or 3-piece)
  const counts = new Map(); // setId -> count
  [w,a,r].forEach(it=>{
    const sid = it?.setId;
    if(!sid) return;
    counts.set(sid, (counts.get(sid)||0) + 1);
  });

  let setId = null;
  let pieces = 0;
  for(const [sid,c] of counts.entries()){
    if(c > pieces){
      pieces = c; setId = sid;
    }
  }

  let setName = null;
  let setTier = 0; // 0 none, 2 = 2-piece, 3 = 3-piece
  if(setId && pieces >= 2){
    const s = itemSetIndex.get(setId);
    setName = s?.name || setId;
    const bonus = (pieces >= 3 ? (s?.bonus3||{}) : (s?.bonus2||{}));
    setTier = pieces >= 3 ? 3 : 2;

    atkPct += Number(bonus.atkPct||0);
    hpPct += Number(bonus.hpPct||0);
    if(!imbue && bonus.imbue) imbue = bonus.imbue;
    antiZeroMinPct = Number(bonus.antiZeroMinPct||0);
  }

  return { atkPct, hpPct, imbue, antiZeroMinPct, setId, setName, setTier, pieces };
}




function ownedCountsBySet(inv){
  const map = new Map(); // setId -> {weapon,armor,relic}
  for(const it of (inv||[])){
    if(!it.setId) continue;
    if(!map.has(it.setId)) map.set(it.setId, { weapon:0, armor:0, relic:0 });
    const c = map.get(it.setId);
    if(it.slot==="weapon") c.weapon += 1;
    else if(it.slot==="armor") c.armor += 1;
    else if(it.slot==="relic") c.relic += 1;
  }
  return map;
}

function applyCollectionRewards(game, inv){
  const collections = game.collections || {};
  const badges = Array.isArray(game.badges) ? game.badges.slice() : [];

  let goldAdd = 0;
  let essenceAdd = 0;
  const newly = [];

  const counts = ownedCountsBySet(inv);
  for(const [sid,c] of counts.entries()){
    const complete = c.weapon>0 && c.armor>0 && c.relic>0;
    if(!complete) continue;
    if(collections[sid]) continue;

    const set = itemSetIndex.get(sid);
    const reward = set?.collectionReward || { gold:250, essence:1, badge:`${set?.name||sid} Collector` };
    goldAdd += Number(reward.gold||0);
    essenceAdd += Number(reward.essence||0);
    const badge = reward.badge;
    if(badge && !badges.includes(badge)) badges.push(badge);

    collections[sid] = { claimedAt: Date.now(), reward };
    newly.push(set?.name || sid);
  }

  return { collections, badges, goldAdd, essenceAdd, newly };
}

function requiredLevelForTier(tier){
  const t = Number(tier||1);
  if(t <= 1) return 1;
  if(t === 2) return 3;
  if(t === 3) return 6;
  return 10;
}
function requiredLevelForSkillId(skillId){
  if((skillId||"").startsWith("util_imbue_")) return 2;
  return null;
}
function requiredLevelForSkill(skill){
  if(!skill) return 1;
  const sp = requiredLevelForSkillId(skill.id);
  if(sp != null) return sp;
  return requiredLevelForTier(skill.tier);
}
function isSkillUnlocked(skillId, playerLevel){
  const s = skillIndex.get(skillId);
  if(!s) return false;
  const req = requiredLevelForSkill(s);
  return Number(playerLevel||1) >= req;
}



let activeLoadout = DEFAULT_LOADOUTS.striker;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function rand(min, max){ return Math.random() * (max - min) + min; }

function setHpP(){ el("hpP").style.width = clamp(hpP,0,HP_MAX)/HP_MAX*100 + "%"; }
function setHpBarTarget(){
  const t = getTarget();
  if(!t){ el("hpE").style.width = "0%"; return; }
  el("hpE").style.width = clamp(t.hp/t.hpMax, 0, 1)*100 + "%";
}

function log(msg){
  const div = document.createElement("div");
  div.textContent = msg;
  logEl.prepend(div);
}

function floatText(x, y, text, kind="dmg"){
  const d = document.createElement("div");
  d.className = "float-text " + kind;
  d.textContent = text;
  d.style.left = x + "px";
  d.style.top = y + "px";
  arena.appendChild(d);
  d.animate([
    { transform:"translate(-50%,0) scale(1)", opacity:1 },
    { transform:`translate(-50%,-${rand(60,90)}px) scale(1.1)`, opacity:0 }
  ], { duration: 900, easing:"cubic-bezier(.2,.8,.2,1)" }).onfinish = ()=> d.remove();
}

function addEffect(targetEl, type){
  if(!type) return;
  const fx = document.createElement("div");
  fx.className = "fx " + type;
  targetEl.querySelector(".status-layer").appendChild(fx);
  setTimeout(()=>fx.remove(), 900);
}

function hitAnim(targetEl, isCrit=false){
  targetEl.classList.remove("hit","crit");
  void targetEl.offsetWidth;
  targetEl.classList.add("hit");
  if(isCrit) targetEl.classList.add("crit");
  setTimeout(()=> targetEl.classList.remove("hit","crit"), 350);
}

async function attackAnim(fromEl, toEl){
  const dir = fromEl.classList.contains("enemy") ? -1 : 1;
  await fromEl.animate([
    { transform:"translate(0,0) scale(1)" },
    { transform:`translate(${22*dir}px,-6px) scale(1.03)` },
    { transform:"translate(0,0) scale(1)" }
  ], { duration: 320, easing:"cubic-bezier(.2,.9,.2,1)" }).finished;
  hitAnim(toEl, false);
}

async function castAnim(fromEl){
  fromEl.classList.add("casting");
  await new Promise(r=>setTimeout(r, 420));
  fromEl.classList.remove("casting");
}

function centerOf(node){
  const r = node.getBoundingClientRect();
  const a = arena.getBoundingClientRect();
  return { x: (r.left + r.width/2) - a.left, y: (r.top + r.height/2) - a.top };
}

function computeDamage(base, atkEl, defEl, defLv){
  const buffMul = 1 + (buffs.damageBonusPct>0 ? buffs.damageBonusPct/100 : 0);
  const gearMul = 1 + (equipBonus.atkPct>0 ? equipBonus.atkPct/100 : 0);
  const raw = base*buffMul*gearMul;
  const final = Math.round(applyElement(raw, atkEl, defEl, defLv, 0));
  if(final === 0 && equipBonus.antiZeroMinPct && equipBonus.antiZeroMinPct > 0){
    return Math.max(1, Math.round(raw * (equipBonus.antiZeroMinPct/100)));
  }
  return final;
}

function getTarget(){ return enemies[targetIndex] || null; }

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}

function setEnemyVisual(t){
  const avatar = q("#enemy .unit-avatar");
  if(!t){ if(avatar) avatar.style.backgroundImage=""; el("enemyMeta").textContent="-"; return; }
  if(avatar) avatar.style.backgroundImage = `url('${t.spriteUrl}')`;
  el("enemyMeta").innerHTML = `<b>${escapeHtml(t.name)}</b><br><span class="badge">${escapeHtml(t.element)} Lv${t.elementLevel}</span>`;
}

function spriteForMonsterName(name, floorType){
  const mini = spriteMap.minibosses?.[name];
  if(mini) return `./assets/monsters/minibosses/${mini}.png`;
  const boss = spriteMap.bosses?.[name];
  if(boss) return `./assets/monsters/bosses/${boss}.png`;
  const common = spriteMap.common?.[name];
  if(common) return `./assets/monsters/common/${common}.png`;
  for(const r of (spriteMap.fallbackRules||[])){
    const re = new RegExp(r.match, "i");
    if(re.test(name)){
      return r.group === "bosses"
        ? `./assets/monsters/bosses/${r.use}.png`
        : `./assets/monsters/common/${r.use}.png`;
    }
  }
  return floorType==="boss" ? "./assets/monsters/bosses/grand_audit.png" : "./assets/monsters/common/dustling.png";
}

function renderEnemyList(){
  const wrap = el("enemyList");
  if(!wrap) return;
  wrap.innerHTML = "";
  enemies.forEach((m, idx)=>{
    const btn = document.createElement("button");
    btn.className = "chip" + (idx===targetIndex ? " active" : "");
    const hpPct = Math.round((m.hp/m.hpMax)*100);
    btn.innerHTML = `<span class="dot"></span><span class="txt">${escapeHtml(m.name)} <span style="opacity:.7;">(${hpPct}%)</span></span>`;
    btn.onclick = ()=>{ targetIndex=idx; renderEnemyList(); setEnemyVisual(getTarget()); setHpBarTarget(); };
    wrap.appendChild(btn);
  });
}

async function loadData(){
  const [towerRes, spriteRes, skillRes, setRes] = await Promise.all([
    fetch("./assets/game/tower-monsters-1-100.json"),
    fetch("./assets/game/monster-sprites.json"),
    fetch("./assets/game/laya-skill-spec-v2.json"),
    fetch("./assets/game/item-sets.json"),
  ]);
  towerData = await towerRes.json();
  spriteMap = await spriteRes.json();
  skillSpec = await skillRes.json();
  itemSets = await setRes.json();

  skillIndex = new Map();
  (skillSpec.skills||[]).forEach(s=>skillIndex.set(s.id, s));

  itemSetIndex = new Map();
  ((itemSets && itemSets.sets) ? itemSets.sets : []).forEach(s=> itemSetIndex.set(s.id, s));
}


function floorTypeOf(f){
  const floorObj = towerData?.floors?.[String(f)];
  return floorObj?.type || (f%10===0 ? "boss" : (f%10===5 ? "miniBoss" : "normal"));
}
function hpForMonster(floorType, elementLevel){
  const lv = Number(elementLevel||1);
  let base = 50 + lv*10;
  if(floorType==="miniBoss") base += 30;
  if(floorType==="boss") base += 75;
  return clamp(base, 40, 180);
}

function loadFloor(floor){
  currentFloor = clamp(Number(floor)||1, 1, 100);
  const floorObj = towerData?.floors?.[String(currentFloor)];
  const type = floorTypeOf(currentFloor);
  const mons = floorObj?.monsters || [];
  enemies = mons.map(m=>{
    const hpMax = hpForMonster(type, m.elementLevel);
    return { ...m, hpMax, hp: hpMax, spriteUrl: spriteForMonsterName(m.name, type) };
  });
  targetIndex=0;
  renderEnemyList();
  setEnemyVisual(getTarget());
  setHpBarTarget();
  el("floorLabel").textContent = String(currentFloor).padStart(2,"0");
  log(`Loaded Floor ${currentFloor} (${type})`);
}

function rewardForFloor(floor, type){
  const expBase = 5 + Math.floor(floor * 0.8);
  const goldBase = 10 + Math.floor(floor * 1.2);
  const mult = type==="boss" ? 2.0 : (type==="miniBoss" ? 1.5 : 1.0);
  return { exp: Math.round(expBase*mult), gold: Math.round(goldBase*mult) };
}

async function ensureGameProfile(uid){
  const ref = db().collection("game_profiles").doc(uid);
  const snap = await ref.get();
  if(snap.exists) return snap.data();
  const prof = await getProfile(uid);
  const data = {
    staffID: prof?.staffID || "",
    name: prof?.name || "",
    department: prof?.department || "",
    class: "",
    floorHighest: 1,
    floorCurrent: 1,
    skillsEquipped: [],
    towerExp: 0,
    gold: 0,
    inventory: [],
    equipped: { weapon: null, armor: null, relic: null },
    materials: { essence: 0 },
    collections: {},
    badges: [],
    title: "",
    stats: { daily: { key: "", clears:0, bossClears:0, miniClears:0 }, weekly: { key: "", clears:0, bossClears:0, miniClears:0 } },
    questClaims: { daily: {}, weekly: {} },
    towerClears: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  await ref.set(data, { merge:true });
  return data;
}

async function loadGameForBattle(){
  const ref = db().collection("game_profiles").doc(__USER.uid);
  const snap = await ref.get();
  const game = snap.exists ? snap.data() : await ensureGameProfile(__USER.uid);

  // class
  const url = new URLSearchParams(location.search);
  const qClass = (url.get("class")||"").trim();
  const cls = qClass || (game.class||"striker");
  if(el("playerClass")) el("playerClass").value = cls;

  // floor
  const qFloor = Number(url.get("floor")||"");
  const floor = (qFloor>=1 && qFloor<=100) ? qFloor : Number(game.floorCurrent||10);
  if(el("floor")) el("floor").value = floor;

  // loadout
  const lvl = Number(game.level || 1);
  const equippedRaw = (Array.isArray(game.skillsEquipped) && game.skillsEquipped.length) ? game.skillsEquipped : [];
  const equipped = equippedRaw.filter(id=>skillIndex.has(id) && isSkillUnlocked(id, lvl)).slice(0,4);
  const def = (DEFAULT_LOADOUTS[cls] || DEFAULT_LOADOUTS.striker).filter(id=>skillIndex.has(id) && isSkillUnlocked(id, lvl)).slice(0,4);
  activeLoadout = (equipped.length ? equipped : def);
  if(activeLoadout.length === 0){
    // fallback to at least Neutral Strike if everything is locked
    activeLoadout = ["util_neutral_strike"];
  }

  // equipment bonuses
  equipBonus = computeEquipmentBonus(game);
  HP_MAX = Math.round(100 * (1 + (equipBonus.hpPct>0 ? equipBonus.hpPct/100 : 0)));
  hpP = clamp(hpP, 0, HP_MAX);
  setHpP();

  return { game, cls, floor };
}

function applyPlayerSkin(){
  const cls = (el("playerClass")?.value || "striker").trim();
  const pEl = q("#player .unit-avatar");
  if(pEl) pEl.style.backgroundImage = `url('./assets/characters/${cls}.png')`;
}

function tickTurn(){
  for(const [k,v] of cooldowns.entries()) cooldowns.set(k, Math.max(0, v-1));
  if(buffs.damageBonusTurns>0){
    buffs.damageBonusTurns -= 1;
    if(buffs.damageBonusTurns<=0) buffs.damageBonusPct=0;
  }
  if(buffs.imbueTurns>0){
    buffs.imbueTurns -= 1;
    if(buffs.imbueTurns<=0) buffs.imbueElement=null;
  }
  renderSkillBar();
}

function skillReady(id){ return (cooldowns.get(id)||0) <= 0; }
function cdText(id){ const t=cooldowns.get(id)||0; return t>0?`CD ${t}`:""; }
function applyCd(skill){
  const cd = Array.isArray(skill.cooldownTurns) ? Number(skill.cooldownTurns[0]||0) : Number(skill.cooldownTurns||0);
  cooldowns.set(skill.id, cd);
}

function resolveAtkElement(skill){
  if(skill.id === "util_neutral_strike") return "Neutral";
  if(buffs.imbueElement && skill.type === "physical") return buffs.imbueElement;
  if(equipBonus.imbue && skill.type === "physical") return equipBonus.imbue;
  return skill.element || "Neutral";
}

function fxFor(elm){
  const map = { Fire:"fire", Water:"ice", Poison:"poison", Shadow:"arcane", Holy:"arcane", Wind:"arcane", Earth:"poison", Ghost:"arcane", Undead:"poison" };
  return map[elm] || null;
}

function multOf(skill){
  if(Array.isArray(skill.damageMultiplier)) return Number(skill.damageMultiplier[0]||0);
  if(skill.hits && skill.perHitMultiplier){
    const hits = Array.isArray(skill.hits) ? Number(skill.hits[0]) : Number(skill.hits);
    const per = Array.isArray(skill.perHitMultiplier) ? Number(skill.perHitMultiplier[0]) : Number(skill.perHitMultiplier);
    return hits*per;
  }
  return 0;
}

function baseOf(skill){
  if(skill.type === "magic") return 18;
  if(skill.type === "physical") return 20;
  return 0;
}

async function useSkill(id){
  const skill = skillIndex.get(id);
  if(!skill) return;
  if(!skillReady(id)){ toast("ยังติดคูลดาวน์", "danger"); return; }

  const t = getTarget();
  const p = centerOf(enemy);

  // Utility: Scan
  if(id === "util_scan"){
    if(t){ toast(`Enemy: ${t.element} Lv${t.elementLevel}`, "info"); log(`Scan: ${t.name} is ${t.element} Lv${t.elementLevel}`); }
    applyCd(skill); tickTurn(); return;
  }

  // Imbue
  if(id.startsWith("util_imbue_")){
    buffs.imbueElement = skill.element;
    buffs.imbueTurns = Array.isArray(skill.durationTurns) ? Math.round(skill.durationTurns[0]) : 2;
    toast(`Imbue: ${buffs.imbueElement} (${buffs.imbueTurns} turns)`, "info");
    log(`Imbue set to ${buffs.imbueElement}`);
    applyCd(skill); tickTurn(); return;
  }

  // Heal
  if(skill.type === "heal" || skill.type === "heal_cleanse" || skill.type === "heal_over_time"){
    const pct = Array.isArray(skill.healPctMaxHp) ? Number(skill.healPctMaxHp[0]) : 20;
    const heal = Math.round(HP_MAX*(pct/100));
    hpP = clamp(hpP + heal, 0, HP_MAX);
    setHpP();
    floatText(p.x-140, p.y-20, `+${heal}`, "status");
    addEffect(player, "arcane");
    log(`${skill.name}: heal +${heal}`);
    applyCd(skill); tickTurn(); return;
  }

  // Buff (simplified → convert to damage bonus)
  if(skill.type === "buff" || skill.type === "support" || skill.type === "shield" || skill.type === "utility"){
    const b = skill.finalDamageBonusPct ? (Array.isArray(skill.finalDamageBonusPct)?Number(skill.finalDamageBonusPct[0]):Number(skill.finalDamageBonusPct))
             : skill.atkBonusPct ? (Array.isArray(skill.atkBonusPct)?Number(skill.atkBonusPct[0]):Number(skill.atkBonusPct))
             : 0;
    if(b>0){
      buffs.damageBonusPct = b;
      buffs.damageBonusTurns = Array.isArray(skill.durationTurns) ? Number(skill.durationTurns[0]) : 3;
      toast(`Buff +${b}% (${buffs.damageBonusTurns} turns)`, "info");
      log(`${skill.name}: damage +${b}%`);
    }else{
      toast(`${skill.name} used`, "info");
      log(`${skill.name} used`);
    }
    addEffect(player, "arcane");
    applyCd(skill); tickTurn(); return;
  }

  if(!t){ toast("ไม่มีเป้าหมาย", "danger"); return; }

  const atkEl = resolveAtkElement(skill);
  const dmg = computeDamage(baseOf(skill)*multOf(skill), atkEl, t.element, t.elementLevel);

  if(skill.type === "magic") await castAnim(player); else await attackAnim(player, enemy);

  if(dmg === 0){
    floatText(p.x, p.y-10, "0", "zero");
    log(`${skill.name}: ineffective (0%)`);
  }else{
    floatText(p.x, p.y-10, `${dmg}`, "dmg");
    log(`${skill.name}: ${dmg} (${atkEl} → ${t.element} Lv${t.elementLevel})`);
    t.hp = clamp(t.hp - dmg, 0, t.hpMax);
  }

  addEffect(enemy, fxFor(atkEl));
  hitAnim(enemy, false);

  setHpBarTarget();
  renderEnemyList();

  applyCd(skill);
  tickTurn();

  if(t.hp <= 0){
    floatText(p.x, p.y+10, "KO", "status");
    log(`Defeated: ${t.name}`);
    enemies.splice(targetIndex, 1);
    if(targetIndex >= enemies.length) targetIndex = Math.max(0, enemies.length-1);
    renderEnemyList();
    setEnemyVisual(getTarget());
    setHpBarTarget();

    if(enemies.length === 0){
      await onFloorCleared();
    }
  }
}

function renderSkillBar(){
  const wrap = el("skillBar");
  if(!wrap) return;
  wrap.innerHTML = "";

  activeLoadout.forEach((id)=>{
    const s = skillIndex.get(id);
    if(!s) return;
    const btn = document.createElement("button");
    btn.className = "skill-btn";
    btn.disabled = !skillReady(id);
    const atkEl = resolveAtkElement(s);
    const cd = cdText(id);
    btn.innerHTML = `
      <div class="left">
        <div class="name">${escapeHtml(s.name)}</div>
        <div class="meta">${escapeHtml(s.line||"")} • T${s.tier}</div>
      </div>
      <div class="right"><span class="pill">${atkEl}${cd?` • ${cd}`:""}</span></div>
    `;
    btn.onclick = ()=> useSkill(id);
    wrap.appendChild(btn);
  });
}


function pad2(n){ return String(n).padStart(2,"0"); }
function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function isoWeekKey(d=new Date()){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}

async function onFloorCleared(){
  const type = floorTypeOf(currentFloor);
  const r = rewardForFloor(currentFloor, type);
  const todayKey = todayStr();
  const weekKey = isoWeekKey();

  await db().runTransaction(async (tx)=>{
    const ref = db().collection("game_profiles").doc(__USER.uid);
    const snap = await tx.get(ref);
    const g = snap.exists ? snap.data() : await ensureGameProfile(__USER.uid);

    const stats0 = g.stats || { daily:{key:'',clears:0,bossClears:0,miniClears:0}, weekly:{key:'',clears:0,bossClears:0,miniClears:0} };
    const dailyStats = { ...(stats0.daily||{}) };
    const weeklyStats = { ...(stats0.weekly||{}) };
    // reset buckets if key changed
    if(dailyStats.key !== todayKey){ dailyStats.key = todayKey; dailyStats.clears=0; dailyStats.bossClears=0; dailyStats.miniClears=0; }
    if(weeklyStats.key !== weekKey){ weeklyStats.key = weekKey; weeklyStats.clears=0; weeklyStats.bossClears=0; weeklyStats.miniClears=0; }
    // increment
    dailyStats.clears = Number(dailyStats.clears||0) + 1;
    weeklyStats.clears = Number(weeklyStats.clears||0) + 1;
    if(type === 'boss'){ dailyStats.bossClears = Number(dailyStats.bossClears||0) + 1; weeklyStats.bossClears = Number(weeklyStats.bossClears||0) + 1; }
    if(type === 'miniBoss'){ dailyStats.miniClears = Number(dailyStats.miniClears||0) + 1; weeklyStats.miniClears = Number(weeklyStats.miniClears||0) + 1; }


    const inv = Array.isArray(g.inventory) ? g.inventory : [];
    const dropped = rollDropItem(currentFloor, type);
  const essenceGain = (type === "boss") ? 2 : (type === "miniBoss" ? (Math.random() < 0.5 ? 1 : 0) : 0);
    if(dropped) inv.push(dropped);

    const col = applyCollectionRewards(g, inv);
    const mats0 = g.materials || { essence:0 };
    const essTotal = Number(mats0.essence||0) + essenceGain + col.essenceAdd;
    const goldTotal = Number(g.gold||0) + r.gold + col.goldAdd;


    tx.set(ref, {
      towerExp: Number(g.towerExp||0) + r.exp,
      gold: goldTotal,
      inventory: inv,
      materials: { ...mats0, essence: essTotal },
      collections: col.collections,
      badges: col.badges,
      floorHighest: Math.max(Number(g.floorHighest||1), currentFloor),
      floorCurrent: Math.max(Number(g.floorCurrent||1), Math.min(100,currentFloor+1)),
      towerClears: Number(g.towerClears||0) + 1,
      lastClearFloor: currentFloor,
      lastClearAt: firebase.firestore.FieldValue.serverTimestamp(),
      stats: { daily: dailyStats, weekly: weeklyStats },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge:true });

    // Leaderboard doc (read is not required)
    const lbRef = db().collection('leaderboards').doc(__USER.uid);
    const setsCompleted = g.collections ? Object.keys(g.collections).length : 0;
    tx.set(lbRef, {
      name: g.name || (g.staffID||''),
      title: g.title || '',
      floorHighest: Math.max(Number(g.floorHighest||1), currentFloor),
      towerClears: Number(g.towerClears||0) + 1,
      setsCompleted,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge:true });
  });

  toast(`🏆 Cleared F${currentFloor}! +${r.exp} EXP +${r.gold} Gold`, "info");
  log(`Rewards saved: +${r.exp} EXP +${r.gold} Gold`);

  if(autoNext){
    const next = Math.min(100, currentFloor + 1);
    el("floor").value = next;
    setTimeout(()=> loadFloor(next), 350);
  }
}

async function init(){
  setHpP();
  log("Initializing...");

  await initFirebase();
  __USER = await requireAuth("login.html");
  await loadData();

  const { cls, floor } = await loadGameForBattle();
  applyPlayerSkin();
  loadFloor(floor);

  el("btnLoadFloor").onclick = ()=> loadFloor(el("floor").value);
  el("playerClass").onchange = async ()=>{
    applyPlayerSkin();
    // when class changes manually, revert to defaults for that class (battle-only)
    const c = el("playerClass").value;
    activeLoadout = (DEFAULT_LOADOUTS[c] || DEFAULT_LOADOUTS.striker).slice(0,4);
    cooldowns = new Map();
    buffs = { damageBonusPct:0, damageBonusTurns:0, imbueElement:null, imbueTurns:0 };
    renderSkillBar();
  };

  el("btnAttack").onclick = ()=> useSkill(activeLoadout[0] || "util_neutral_strike");
  el("btnCast").onclick = ()=> useSkill(activeLoadout[1] || "a_weakness_mark");

  el("btnReset").onclick = ()=>{
    cooldowns = new Map();
    buffs = { damageBonusPct:0, damageBonusTurns:0, imbueElement:null, imbueTurns:0 };
    renderSkillBar();
    log("Reset cooldowns & buffs.");
    loadFloor(currentFloor);
  };

  const autoBtn = el("btnAutoNext");
  if(autoBtn){
    autoBtn.onclick = ()=>{
      autoNext = !autoNext;
      autoBtn.textContent = autoNext ? "Auto Next: ON" : "Auto Next: OFF";
    };
  }

  renderSkillBar();
  log("Ready.");
}

init();
