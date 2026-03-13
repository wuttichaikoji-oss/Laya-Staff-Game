const el = (id)=>document.getElementById(id);

let user = null;
let itemSets = null;
let itemSetIndex = new Map();
let sortMode = "rarity"; // rarity or slot

const rarityOrder = { L:4, E:3, R:2, C:1 };


function essenceYieldForItem(it){
  // Yield based on rarity + upgrade
  const base = it.rarity==="L" ? 8 : it.rarity==="E" ? 5 : it.rarity==="R" ? 3 : 1;
  const u = Number(it.upgrade||0);
  return base + Math.floor(u/2);
}

function priceForItem(it){
  // Sell price (simple): rarity base * (1 + dropFloor/25) * (1 + upgrade*0.5)
  const base = it.rarity==="L" ? 250 : it.rarity==="E" ? 140 : it.rarity==="R" ? 70 : 25;
  const f = Math.max(1, Math.min(100, Number(it.dropFloor || 1)));
  const u = Number(it.upgrade || 0);
  return Math.round(base * (1 + f/25) * (1 + u*0.5));
}

function maxUpgradeForRarity(r){
  // keep manageable
  return r==="L" ? 8 : r==="E" ? 6 : r==="R" ? 5 : 3;
}

function upgradeCostGold(it){
  const u = Number(it.upgrade || 0);
  const base = it.rarity==="L" ? 220 : it.rarity==="E" ? 140 : it.rarity==="R" ? 80 : 40;
  return Math.round(base * (u+1) * (1 + (Number(it.dropFloor||1)/40)));
}

function upgradeCostEssence(it){
  const u = Number(it.upgrade || 0);
  const base = it.rarity==="L" ? 3 : it.rarity==="E" ? 2 : it.rarity==="R" ? 1 : 1;
  return base + Math.floor(u/2);
}

function applyUpgradeStats(it){
  // Increment stats slightly per upgrade (directly stores increased stats)
  const u = Number(it.upgrade || 0);
  const stepAtk = it.rarity==="L" ? 2 : it.rarity==="E" ? 2 : it.rarity==="R" ? 1 : 1;
  const stepHp  = it.rarity==="L" ? 2 : it.rarity==="E" ? 2 : it.rarity==="R" ? 1 : 1;

  if(it.slot==="weapon" || it.slot==="relic"){
    it.atkPct = Number(it.atkPct||0) + stepAtk;
  }else if(it.slot==="armor"){
    it.hpPct = Number(it.hpPct||0) + stepHp;
  }
  it.upgrade = u + 1;
  return it;
}




async function loadSets(){
  if(itemSets) return;
  const res = await fetch("./assets/game/item-sets.json");
  itemSets = await res.json();
  itemSetIndex = new Map();
  ((itemSets && itemSets.sets) ? itemSets.sets : []).forEach(s=> itemSetIndex.set(s.id, s));
}
function setName(setId){
  if(!setId) return "-";
  return itemSetIndex.get(setId)?.name || setId;
}

function rarityLabel(r){
  return r === "L" ? "Legend" : r === "E" ? "Epic" : r === "R" ? "Rare" : "Common";
}
function slotLabel(s){
  return s === "weapon" ? "Weapon" : s === "armor" ? "Armor" : "Relic";
}
function fmtStats(it){
  const parts = [];
  if(it.atkPct) parts.push(`ATK +${it.atkPct}%`);
  if(it.hpPct) parts.push(`HP +${it.hpPct}%`);
  if(it.imbue) parts.push(`Imbue ${it.imbue}`);
  if(it.setId) parts.push(`Set ${setName(it.setId)}`);
  return parts.length ? parts.join(" • ") : "-";
}

function equipCard(slot, item, onClick){
  const div = document.createElement("div");
  div.className = "equip-card" + (item ? ` rarity-${item.rarity}` : "");
  div.innerHTML = `
    <div class="small" style="opacity:.85;">${slotLabel(slot)}</div>
    <div style="font-weight:900; margin-top:6px;">${item ? item.name : "— none —"}</div>
    <div class="small" style="margin-top:6px; opacity:.85;">${item ? `${rarityLabel(item.rarity)} • +${item.upgrade||0} • ${fmtStats(item)}` : ""}</div>
    <button class="btn secondary" style="margin-top:10px; width:100%;">${item ? "Unequip" : "Equip"}</button>
  `;
  div.querySelector("button").onclick = onClick;
  return div;
}

async function load(){
  await initFirebase();
  user = await requireAuth("login.html");
  await loadSets();

  render();
}

async function getGame(){
  const ref = db().collection("game_profiles").doc(user.uid);
  const snap = await ref.get();
  if(!snap.exists) return null;
  return snap.data();
}

function findItemById(inv, id){
  if(!id) return null;
  return (inv || []).find(x => x.id === id) || null;
}



async function disassembleItem(itemId){
  const ref = db().collection("game_profiles").doc(user.uid);

  await db().runTransaction(async (tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists) throw new Error("No profile");
    const g = snap.data();
    const inv = Array.isArray(g.inventory) ? g.inventory : [];
    const eq = g.equipped || { weapon:null, armor:null, relic:null };
    const mats = g.materials || { essence:0 };

    const it = inv.find(x=>x.id===itemId);
    if(!it) return;

    if(eq.weapon===itemId || eq.armor===itemId || eq.relic===itemId){
      throw new Error("Item is equipped. Unequip first.");
    }

    const gain = essenceYieldForItem(it);
    const newInv = inv.filter(x=>x.id!==itemId);

    tx.set(ref, {
      materials: { ...mats, essence: Number(mats.essence||0) + gain },
      inventory: newInv,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge:true });
  });

  toast("Disassembled (+Essence)", "info");
  render();
}

async function sellItem(itemId){
  const ref = db().collection("game_profiles").doc(user.uid);

  await db().runTransaction(async (tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists) throw new Error("No profile");
    const g = snap.data();
    const inv = Array.isArray(g.inventory) ? g.inventory : [];
    const eq = g.equipped || { weapon:null, armor:null, relic:null };

    const it = inv.find(x=>x.id===itemId);
    if(!it) return;

    // prevent selling equipped item
    if(eq.weapon===itemId || eq.armor===itemId || eq.relic===itemId){
      throw new Error("Item is equipped. Unequip first.");
    }

    const goldGain = priceForItem(it);
    const newInv = inv.filter(x=>x.id!==itemId);

    tx.set(ref, {
      gold: Number(g.gold||0) + goldGain,
      inventory: newInv,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge:true });
  });

  toast("Sold item", "info");
  render();
}

async function upgradeItem(itemId){
  const ref = db().collection("game_profiles").doc(user.uid);

  await db().runTransaction(async (tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists) throw new Error("No profile");
    const g = snap.data();
    const inv = Array.isArray(g.inventory) ? g.inventory : [];
    const mats = g.materials || { essence:0 };

    const idx = inv.findIndex(x=>x.id===itemId);
    if(idx < 0) return;

    const it = { ...inv[idx] };
    const maxU = maxUpgradeForRarity(it.rarity);
    const curU = Number(it.upgrade||0);
    if(curU >= maxU) throw new Error("Max upgrade");

    const goldCost = upgradeCostGold(it);
    const essCost = upgradeCostEssence(it);

    const gold = Number(g.gold||0);
    const essence = Number(mats.essence||0);

    if(gold < goldCost) throw new Error("Not enough gold");
    if(essence < essCost) throw new Error("Not enough essence");

    const upgraded = applyUpgradeStats(it);

    const newInv = inv.slice();
    newInv[idx] = upgraded;

    tx.set(ref, {
      gold: gold - goldCost,
      materials: { ...mats, essence: essence - essCost },
      inventory: newInv,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge:true });
  });

  toast("Upgraded!", "info");
  render();
}

async function setEquipped(slot, itemId){
  const ref = db().collection("game_profiles").doc(user.uid);
  await ref.set({
    equipped: { [slot]: itemId || null },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge:true });
  toast("Saved", "info");
  render();
}

async function unequip(slot){
  await setEquipped(slot, null);
}

async function equip(slot, itemId){
  await setEquipped(slot, itemId);
}

function renderItemCard(it, equipped){
  const div = document.createElement("div");
  div.className = "inv-card";
  const isEquipped = equipped && Object.values(equipped).includes(it.id);

  div.classList.add(`rarity-${it.rarity}`);
  div.innerHTML = `
    <div class="row" style="justify-content:space-between; align-items:flex-start; gap:10px;">
      <div>
        <div style="font-weight:900;">${it.name}</div>
        <div class="small" style="opacity:.85; margin-top:4px;">${slotLabel(it.slot)} • ${rarityLabel(it.rarity)}</div>
        <div class="small" style="opacity:.85; margin-top:6px;">${fmtStats(it)}</div>
      </div>
      <div class="pill rarity ${it.rarity}">${it.rarity}</div>
    </div>
    <div class="row" style="gap:8px; margin-top:10px; flex-wrap:wrap;">
  <button class="btn ${it.slot==='weapon'?'':'secondary'}" data-act="equipW">Equip Weapon</button>
  <button class="btn ${it.slot==='armor'?'':'secondary'}" data-act="equipA">Equip Armor</button>
  <button class="btn ${it.slot==='relic'?'':'secondary'}" data-act="equipR">Equip Relic</button>
  <button class="btn secondary" data-act="upgrade">Upgrade</button>
  <button class="btn secondary" data-act="disassemble">Disassemble</button>
  <button class="btn danger" data-act="sell">Sell</button>
  ${isEquipped ? '<span class="badge" style="margin-left:auto;">Equipped</span>' : ''}
</div>
<div class="mini-stats">
  <span class="tag">+${it.upgrade||0}</span>
  <span class="tag">Sell: ${priceForItem(it)}g</span>
  <span class="tag">Dis: +${essenceYieldForItem(it)}e</span>
  <span class="tag">Upg: ${upgradeCostGold(it)}g + ${upgradeCostEssence(it)}e</span>
</div>
  `;

  div.querySelector('[data-act="equipW"]').onclick = ()=> equip("weapon", it.slot==="weapon"?it.id:null);
  div.querySelector('[data-act="equipA"]').onclick = ()=> equip("armor", it.slot==="armor"?it.id:null);
  div.querySelector('[data-act="equipR"]').onclick = ()=> equip("relic", it.slot==="relic"?it.id:null);
  div.querySelector('[data-act="sell"]').onclick = async ()=>{ try{ await sellItem(it.id); }catch(err){ toast(err.message, 'danger'); } };
  div.querySelector('[data-act="disassemble"]').onclick = async ()=>{ try{ await disassembleItem(it.id); }catch(err){ toast(err.message, 'danger'); } };
  div.querySelector('[data-act="upgrade"]').onclick = async ()=>{ try{ await upgradeItem(it.id); }catch(err){ toast(err.message, 'danger'); } };

  return div;
}

async function render(){
  const game = await getGame();
  if(!game){
    el("invList").innerHTML = "<div class='small'>ยังไม่มีโปรไฟล์เกม</div>";
    return;
  }

  const inv = Array.isArray(game.inventory) ? game.inventory : [];
  const mats = game.materials || { essence:0 };
  const gold = Number(game.gold || 0);
  const ess = Number(mats.essence || 0);
  const gEl = document.getElementById('invGold');
  const eEl = document.getElementById('invEssence');
  if(gEl) gEl.textContent = gold;
  if(eEl) eEl.textContent = ess;
  const equipped = game.equipped || { weapon:null, armor:null, relic:null };

  // Equip summary
  const equipWrap = el("equipSummary");
  equipWrap.innerHTML = "";

  const w = findItemById(inv, equipped.weapon);
  const a = findItemById(inv, equipped.armor);
  const r = findItemById(inv, equipped.relic);

  // best set among equipped pieces (2pc/3pc)
  const counts = new Map();
  [w,a,r].forEach(it=>{ if(it?.setId) counts.set(it.setId, (counts.get(it.setId)||0)+1); });
  let bestSet = null; let bestCnt = 0;
  for(const [sid,c] of counts.entries()){ if(c>bestCnt){ bestCnt=c; bestSet=sid; } }
  const setId = (bestSet && bestCnt>=2) ? bestSet : null;
  const setTier = (bestCnt>=3) ? 3 : (bestCnt>=2 ? 2 : 0);
  const setBox = document.createElement('div');
  setBox.className = 'small';
  setBox.style.marginTop = '10px';
  setBox.style.opacity = '.9';
  setBox.innerHTML = setId ? `✅ <b>Set Bonus Active:</b> ${setName(setId)} (${setTier}pc)` : `Set Bonus: ใส่ไอเทม 2 ชิ้นขึ้นไปเป็นเซ็ตเดียวกันเพื่อรับโบนัส`;

  equipWrap.appendChild(equipCard("weapon", w, ()=> w ? unequip("weapon") : toast("เลือกไอเทมจากด้านล่าง", "info")));
  equipWrap.appendChild(equipCard("armor", a, ()=> a ? unequip("armor") : toast("เลือกไอเทมจากด้านล่าง", "info")));
  equipWrap.appendChild(equipCard("relic", r, ()=> r ? unequip("relic") : toast("เลือกไอเทมจากด้านล่าง", "info")));
  equipWrap.parentElement.appendChild(setBox);

  // Filter + sort
  const slot = el("filterSlot").value;
  let items = inv.slice();

  if(slot !== "all") items = items.filter(x=>x.slot===slot);

  if(sortMode === "rarity"){
    items.sort((x,y)=> (rarityOrder[y.rarity]-rarityOrder[x.rarity]) || x.slot.localeCompare(y.slot) || x.name.localeCompare(y.name));
  }else{
    items.sort((x,y)=> x.slot.localeCompare(y.slot) || (rarityOrder[y.rarity]-rarityOrder[x.rarity]) || x.name.localeCompare(y.name));
  }

  const wrap = el("invList");
  wrap.innerHTML = "";
  if(items.length === 0){
    wrap.innerHTML = "<div class='small'>ยังไม่มีไอเทม (ลองไปไต่หอแล้วเคลียร์ชั้น)</div>";
    return;
  }
  for(const it of items){
    wrap.appendChild(renderItemCard(it, equipped));
  }
}

el("filterSlot").onchange = render;
el("btnSort").onclick = ()=>{
  sortMode = (sortMode === "rarity") ? "slot" : "rarity";
  el("btnSort").textContent = sortMode === "rarity" ? "Sort: Rarity" : "Sort: Slot";
  render();
};

load();
