const el = (id)=>document.getElementById(id);

let user = null;
let itemSets = null;
let itemSetIndex = new Map();

function setName(id){
  if(!id) return "—";
  return itemSetIndex.get(id)?.name || id;
}

function bonusText(b){
  if(!b) return "-";
  const parts = [];
  if(b.atkPct) parts.push(`ATK +${b.atkPct}%`);
  if(b.hpPct) parts.push(`HP +${b.hpPct}%`);
  if(b.imbue) parts.push(`Imbue ${b.imbue}`);
  if(b.antiZeroMinPct) parts.push(`Anti-0% Min ${b.antiZeroMinPct}%`);
  return parts.join(" • ") || "-";
}

async function loadSets(){
  const res = await fetch("./assets/game/item-sets.json");
  itemSets = await res.json();
  itemSetIndex = new Map();
  ((itemSets && itemSets.sets) ? itemSets.sets : []).forEach(s=> itemSetIndex.set(s.id, s));
}

async function load(){
  await initFirebase();
  user = await requireAuth("login.html");
  await loadSets();
  await render();
}

async function getGame(){
  const ref = db().collection("game_profiles").doc(user.uid);
  const snap = await ref.get();
  if(!snap.exists) return null;
  return snap.data();
}

function findItem(inv, id){
  if(!id) return null;
  return (inv||[]).find(x=>x.id===id) || null;
}

function computeActiveSet(game){
  const inv = Array.isArray(game.inventory) ? game.inventory : [];
  const eq = game.equipped || { weapon:null, armor:null, relic:null };
  const w = findItem(inv, eq.weapon);
  const a = findItem(inv, eq.armor);
  const r = findItem(inv, eq.relic);

  let pieces = 0;
  let setId = null;

  if(w?.setId){ pieces += 1; setId = w.setId; }
  if(a?.setId && (!setId || a.setId === setId)){ pieces += 1; setId = setId || a.setId; } else if(a?.setId) { setId = null; }
  if(r?.setId && setId && r.setId === setId){ pieces += 1; } else if(r?.setId && !setId) { setId = null; }

  // only active when all three match
  const active = (w && a && r && w.setId && a.setId && r.setId && w.setId===a.setId && w.setId===r.setId) ? w.setId : null;
  return { activeSetId: active, piecesEquipped: pieces };
}

function ownedCounts(game){
  const inv = Array.isArray(game.inventory) ? game.inventory : [];
  // setId -> {weapon, armor, relic, total}
  const map = new Map();

  for(const it of inv){
    if(!it.setId) continue;
    if(!map.has(it.setId)) map.set(it.setId, { weapon:0, armor:0, relic:0, total:0 });
    const s = map.get(it.setId);
    if(it.slot==="weapon") s.weapon += 1;
    else if(it.slot==="armor") s.armor += 1;
    else if(it.slot==="relic") s.relic += 1;
    s.total += 1;
  }
  return map;
}

function canComplete(counts){
  return counts.weapon > 0 && counts.armor > 0 && counts.relic > 0;
}

function setCard(setObj, counts, isActive){
  const div = document.createElement("div");
  div.className = "set-card " + (isActive ? "active" : "");
  div.classList.add("rarity-" + (isActive ? "L" : "C")); // just a nice frame when active
  const c = counts || {weapon:0, armor:0, relic:0, total:0};

  div.innerHTML = `
    <div class="row" style="justify-content:space-between; align-items:flex-start; gap:10px;">
      <div>
        <div style="font-weight:900;">${setObj.name}</div>
        <div class="small" style="opacity:.85; margin-top:4px;">${setObj.desc || ""}</div>
      </div>
      <div class="pill">${isActive ? "ACTIVE" : "SET"}</div>
    </div>

    <div class="mini-stats">
      <span class="tag">Weapon: ${c.weapon}</span>
      <span class="tag">Armor: ${c.armor}</span>
      <span class="tag">Relic: ${c.relic}</span>
      <span class="tag">Total: ${c.total}</span>
      <span class="tag">${canComplete(c) ? "✅ Can Complete" : "—"}</span>
    </div>

    <div class="small" style="opacity:.9; margin-top:10px;"><b>Bonus 2pc:</b> ${bonusText(setObj.bonus2)}</div>
    <div class="small" style="opacity:.9; margin-top:6px;"><b>Bonus 3pc:</b> ${bonusText(setObj.bonus3)}</div>
  `;

  return div;
}


async function claimMissingRewards(game){
  const inv = Array.isArray(game.inventory) ? game.inventory : [];
  const countsMap = ownedCounts(game);
  const collections = game.collections || {};

  // Detect missing claims
  const missing = [];
  for(const [sid,c] of countsMap.entries()){
    if(c.weapon>0 && c.armor>0 && c.relic>0 && !collections[sid]) missing.push(sid);
  }
  if(missing.length === 0) return;

  const ref = db().collection("game_profiles").doc(user.uid);
  await db().runTransaction(async (tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists) return;
    const g = snap.data();
    const inv2 = Array.isArray(g.inventory) ? g.inventory : [];
    const mats0 = g.materials || { essence:0 };
    const cols = g.collections || {};
    const badges = Array.isArray(g.badges) ? g.badges.slice() : [];

    let goldAdd=0, essAdd=0;

    for(const sid of missing){
      if(cols[sid]) continue;
      const setObj = itemSetIndex.get(sid);
      // re-check complete
      const cc = { weapon:0, armor:0, relic:0 };
      for(const it of inv2){
        if(it.setId !== sid) continue;
        if(it.slot==="weapon") cc.weapon += 1;
        else if(it.slot==="armor") cc.armor += 1;
        else if(it.slot==="relic") cc.relic += 1;
      }
      if(!(cc.weapon>0 && cc.armor>0 && cc.relic>0)) continue;

      const reward = setObj?.collectionReward || { gold:250, essence:1, badge:`${setObj?.name||sid} Collector` };
      goldAdd += Number(reward.gold||0);
      essAdd += Number(reward.essence||0);
      const badge = reward.badge;
      if(badge && !badges.includes(badge)) badges.push(badge);
      cols[sid] = { claimedAt: Date.now(), reward };
    }

    if(goldAdd>0 || essAdd>0){
      tx.set(ref, {
        gold: Number(g.gold||0) + goldAdd,
        materials: { ...mats0, essence: Number(mats0.essence||0) + essAdd },
        collections: cols,
        badges,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge:true });
    }
  });

  toast("Collection reward claimed!", "info");
}

async function render(){
  const game = await getGame();
  if(game) await claimMissingRewards(game);
  if(!game){
    el("setsGrid").innerHTML = "<div class='small'>ยังไม่มีโปรไฟล์เกม</div>";
    return;
  }

  const { activeSetId, piecesEquipped } = computeActiveSet(game);
  el("activeSetName").textContent = setName(activeSetId);
  el("activePieces").textContent = piecesEquipped;

  const countsMap = ownedCounts(game);

  const mode = el("filterOwned").value;
  const sets = (itemSets && itemSets.sets) ? itemSets.sets : [];

  const grid = el("setsGrid");
  grid.innerHTML = "";

  let shown = 0;
  for(const s of sets){
    const c = countsMap.get(s.id) || {weapon:0, armor:0, relic:0, total:0};
    if(mode === "owned" && c.total === 0) continue;
    if(mode === "complete" && !canComplete(c)) continue;

    grid.appendChild(setCard(s, c, s.id === activeSetId));
    shown += 1;
  }

  if(shown === 0){
    grid.innerHTML = "<div class='small'>ไม่มีเซ็ตที่ตรงกับตัวกรองนี้</div>";
  }
}

el("filterOwned").onchange = render;

load();
