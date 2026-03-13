const el = (id)=>document.getElementById(id);

let user = null;
let questDef = null;
let todayKey = null;
let weekKey = null;

function pad2(n){ return String(n).padStart(2,"0"); }
function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function isoWeekKey(d=new Date()){
  // ISO week number
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}

function metricValue(stats, scope, field){
  if(!stats) return 0;
  if(scope === "daily") return Number((stats.daily||{})[field] || 0);
  return Number((stats.weekly||{})[field] || 0);
}

function rewardText(r){
  const parts = [];
  if(r.gold) parts.push(`${r.gold}g`);
  if(r.essence) parts.push(`${r.essence}e`);
  return parts.join(" + ") || "-";
}

function isClaimed(game, scope, key, questId){
  const qc = game.questClaims || {};
  const m = (qc[scope] || {})[key] || {};
  return !!m[questId];
}

async function loadDefs(){
  const res = await fetch("./assets/game/quests.json");
  questDef = await res.json();
}

async function load(){
  await initFirebase();
  user = await requireAuth("login.html");
  await loadDefs();
  todayKey = todayStr();
  weekKey = isoWeekKey();

  await render();
}

async function getGame(){
  const ref = db().collection("game_profiles").doc(user.uid);
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

function questCard(q, scope, key, progress, claimed, onClaim){
  const target = Number(q.metric.target || 0);
  const pct = target ? Math.min(1, progress/target) : 0;
  const done = progress >= target;

  const div = document.createElement("div");
  div.className = "quest-card" + (done ? " done" : "") + (claimed ? " claimed" : "");
  div.innerHTML = `
    <div class="row" style="justify-content:space-between; align-items:flex-start; gap:10px;">
      <div>
        <div style="font-weight:900;">${q.title}</div>
        <div class="small" style="opacity:.85; margin-top:4px;">${q.desc}</div>
      </div>
      <div class="pill">${scope.toUpperCase()}</div>
    </div>

    <div class="small" style="opacity:.9; margin-top:10px;">Progress: <b>${progress}</b> / ${target}</div>
    <div class="progress" style="margin-top:8px;">
      <div class="progress-bar" style="width:${pct*100}%"></div>
    </div>

    <div class="row" style="gap:10px; align-items:center; margin-top:10px; flex-wrap:wrap;">
      <span class="pill">Reward: <b>${rewardText(q.reward||{})}</b></span>
      <button class="btn ${done && !claimed ? "" : "secondary"}" style="margin-left:auto;" ${done && !claimed ? "" : "disabled"}>
        ${claimed ? "Claimed" : (done ? "Claim" : "Not Ready")}
      </button>
    </div>
  `;
  div.querySelector("button").onclick = onClaim;
  return div;
}

async function claim(scope, questId){
  const key = scope === "daily" ? todayKey : weekKey;
  const ref = db().collection("game_profiles").doc(user.uid);

  await db().runTransaction(async (tx)=>{
    const snap = await tx.get(ref);
    if(!snap.exists) throw new Error("No profile");
    const g = snap.data();

    // determine progress
    const stats = g.stats || {};
    const q = (scope === "daily" ? (questDef.daily||[]) : (questDef.weekly||[])).find(x=>x.id===questId);
    if(!q) throw new Error("Quest missing");

    const progress = metricValue(stats, scope, q.metric.field);
    const target = Number(q.metric.target || 0);
    if(progress < target) throw new Error("Not completed");

    const qc = g.questClaims || {};
    const scopeMap = qc[scope] || {};
    const keyMap = scopeMap[key] || {};
    if(keyMap[questId]) throw new Error("Already claimed");

    const reward = q.reward || {};
    const mats0 = g.materials || { essence:0 };

    // write claim
    keyMap[questId] = true;
    scopeMap[key] = keyMap;
    qc[scope] = scopeMap;

    tx.set(ref, {
      gold: Number(g.gold||0) + Number(reward.gold||0),
      materials: { ...mats0, essence: Number(mats0.essence||0) + Number(reward.essence||0) },
      questClaims: qc,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge:true });
  });

  toast("Claimed!", "info");
  await render();
}

async function render(){
  const g = await getGame();
  if(!g) return;

  el("qGold").textContent = Number(g.gold||0);
  el("qEss").textContent = Number((g.materials||{}).essence||0);
  el("qDate").textContent = todayKey;
  el("qWeek").textContent = weekKey;

  const stats = g.stats || {};
  // ensure correct bucket existence in display (battle updates bucket)
  const dailyList = el("dailyList");
  const weeklyList = el("weeklyList");
  dailyList.innerHTML = "";
  weeklyList.innerHTML = "";

  (questDef.daily||[]).forEach(q=>{
    const p = metricValue(stats, "daily", q.metric.field);
    const claimed = isClaimed(g, "daily", todayKey, q.id);
    dailyList.appendChild(questCard(q, "daily", todayKey, p, claimed, ()=>claim("daily", q.id)));
  });

  (questDef.weekly||[]).forEach(q=>{
    const p = metricValue(stats, "weekly", q.metric.field);
    const claimed = isClaimed(g, "weekly", weekKey, q.id);
    weeklyList.appendChild(questCard(q, "weekly", weekKey, p, claimed, ()=>claim("weekly", q.id)));
  });
}

load();
