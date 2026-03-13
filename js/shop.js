const el = (id)=>document.getElementById(id);

let user = null;
let itemSets = null;
let itemSetIndex = new Map();

function log(msg){
  const wrap = el("shopLog");
  if(!wrap) return;
  const div = document.createElement("div");
  div.textContent = msg;
  wrap.prepend(div);
}

function rollChance(p){ return Math.random() < p; }

function rarityPickChest(highest, epic=false){
  // Based on highest floor
  const t = Math.max(1, Math.min(100, Number(highest||1)));
  const r = Math.random()*100;

  if(epic){
    // R/E/L
    if(r < 5) return "L";
    if(r < 45) return "E";
    return "R";
  }

  // normal chest C/R/E
  const eBonus = Math.min(18, Math.floor(t/8)); // higher floor => more epic chance
  if(r < (6 + eBonus)) return "E";
  if(r < (35 + Math.floor(t/6))) return "R";
  return "C";
}

function rollSlot(){
  const r = Math.random()*100;
  if(r < 40) return "weapon";
  if(r < 75) return "armor";
  return "relic";
}

function randomElement(){
  const els = ["Fire","Water","Wind","Earth","Poison","Holy","Shadow","Ghost","Undead"];
  return els[Math.floor(Math.random()*els.length)];
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

function scaledStat(base, floor, rarity){
  const mult = rarity==="L" ? 1.8 : rarity==="E" ? 1.45 : rarity==="R" ? 1.2 : 1.0;
  const f = Math.min(100, Math.max(1, floor));
  return Math.round((base + (f/12)) * mult);
}


function ownedCountsBySet(inv){
  const map = new Map();
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
  let goldAdd = 0, essenceAdd = 0;
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
  }
  return { collections, badges, goldAdd, essenceAdd };
}

function newItem(highest, rarity){
  const slot = rollSlot();
  const id = `it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const floor = Math.max(1, Math.min(100, Number(highest||1)));
  const setId = randomSetId();
  const item = { id, slot, rarity, name: makeItemName(slot, rarity), setId, dropFloor: floor, upgrade: 0, createdAt: Date.now() };

  if(slot === "weapon"){
    item.atkPct = scaledStat(3, floor, rarity);
    const imbueChance = rarity==="L" ? 0.85 : rarity==="E" ? 0.6 : rarity==="R" ? 0.35 : 0.15;
    if(rollChance(imbueChance)) item.imbue = randomElement();
  }else if(slot === "armor"){
    item.hpPct = scaledStat(3, floor, rarity);
  }else{
    item.atkPct = scaledStat(2, floor, rarity);
    if(rarity==="L" && rollChance(0.5)) item.imbue = randomElement();
  }
  return item;
}

async function load(){
  await initFirebase();
  user = await requireAuth("login.html");
  await loadSets();
  await refresh();
  wire();
}


async function loadSets(){
  if(itemSets) return;
  const res = await fetch("./assets/game/item-sets.json");
  itemSets = await res.json();
  itemSetIndex = new Map();
  ((itemSets && itemSets.sets) ? itemSets.sets : []).forEach(s=> itemSetIndex.set(s.id, s));
}
function randomSetId(){
  const ids = Array.from(itemSetIndex.keys());
  if(!ids.length) return null;
  return ids[Math.floor(Math.random()*ids.length)];
}

async function getGame(){
  const ref = db().collection("game_profiles").doc(user.uid);
  const snap = await ref.get();
  if(!snap.exists) return null;
  return snap.data();
}

async function refresh(){
  const g = await getGame();
  if(!g) return;
  el("shopGold").textContent = Number(g.gold||0);
  el("shopEssence").textContent = Number((g.materials||{}).essence||0);
}

async function buyEssence(qty, cost){
  const ref = db().collection("game_profiles").doc(user.uid);
  await db().runTransaction(async (tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists) throw new Error("No profile");
    const g = snap.data();
    const gold = Number(g.gold||0);
    if(gold < cost) throw new Error("Not enough gold");
    const mats = g.materials || { essence:0 };
    tx.set(ref, {
      gold: gold - cost,
      materials: { ...mats, essence: Number(mats.essence||0) + qty },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge:true });
  });
  toast("Purchased essence", "info");
  log(`Buy: Essence x${qty} for ${cost}g`);
  await refresh();
}

async function buyChest(cost, epic=false){
  const ref = db().collection("game_profiles").doc(user.uid);
  await db().runTransaction(async (tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists) throw new Error("No profile");
    const g = snap.data();
    const gold = Number(g.gold||0);
    if(gold < cost) throw new Error("Not enough gold");

    const inv = Array.isArray(g.inventory) ? g.inventory : [];
    const highest = Number(g.floorHighest || 1);
    const rarity = rarityPickChest(highest, epic);
    inv.push(newItem(highest, rarity));

    const col = applyCollectionRewards(g, inv);
    const mats0 = g.materials || { essence:0 };

    tx.set(ref, {
      gold: (gold - cost) + col.goldAdd,
      inventory: inv,
      materials: { ...mats0, essence: Number(mats0.essence||0) + col.essenceAdd },
      collections: col.collections,
      badges: col.badges,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge:true });
  });
  toast("Purchased chest", "info");
  log(`Buy: ${epic?'Epic Chest':'Mystery Chest'} for ${cost}g`);
  await refresh();
}

function wire(){
  el("buyEss1").onclick = async ()=>{ try{ await buyEssence(1, 120); }catch(e){ toast(e.message,"danger"); } };
  el("buyEss5").onclick = async ()=>{ try{ await buyEssence(5, 550); }catch(e){ toast(e.message,"danger"); } };
  el("buyChest").onclick = async ()=>{ try{ await buyChest(400, false); }catch(e){ toast(e.message,"danger"); } };
  el("buyEpicChest").onclick = async ()=>{ try{ await buyChest(900, true); }catch(e){ toast(e.message,"danger"); } };
}

load();
