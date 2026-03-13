let __GP_USER = null;
let __GP_PROFILE = null;
let __GP_GAME = null;

// Level table (ปรับได้ง่าย)
// EXP จาก Staff Points มักโตเรื่อย ๆ -> ใช้ตารางแบบไต่ขึ้นชัด ๆ
const LEVEL_TABLE = [
  { level: 1, req: 0 },
  { level: 2, req: 20 },
  { level: 3, req: 50 },
  { level: 4, req: 90 },
  { level: 5, req: 140 },
  { level: 6, req: 200 },
  { level: 7, req: 270 },
  { level: 8, req: 350 },
  { level: 9, req: 440 },
  { level: 10, req: 540 },
  { level: 11, req: 650 },
  { level: 12, req: 770 },
  { level: 13, req: 900 },
  { level: 14, req: 1040 },
  { level: 15, req: 1190 },
  { level: 16, req: 1350 },
  { level: 17, req: 1520 },
  { level: 18, req: 1700 },
  { level: 19, req: 1890 },
  { level: 20, req: 2090 }
];

function levelFromExp(exp){
  const x = Number(exp || 0);
  let cur = LEVEL_TABLE[0];
  for(const row of LEVEL_TABLE){
    if(x >= row.req) cur = row;
    else break;
  }
  const next = LEVEL_TABLE.find(r => r.level === cur.level + 1) || null;
  return { level: cur.level, curReq: cur.req, nextReq: next?.req ?? null };
}

// ได้ 1 skill point ทุก 2 เลเวล (L2, L4, L6,...)
function totalSkillPoints(level){
  return Math.floor(Number(level || 1) / 2);
}

async function ensureGameProfile(uid, staff){
  const ref = db().collection("game_profiles").doc(uid);
  const snap = await ref.get();
  if(snap.exists) return snap.data();

  const data = {
    staffID: staff?.staffID || "",
    name: staff?.name || "",
    department: staff?.department || "",
    class: "",

    floorHighest: 1,
    floorCurrent: 1,

    skillPointsSpent: 0,
    skillsUnlocked: {},     // { skillId: rank }
    skillsEquipped: [],     // ["util_scan", ...]
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

  await ref.set(data, { merge: true });
  return data;
}

async function saveGameProfile(patch){
  if(!__GP_USER) return;
  const ref = db().collection("game_profiles").doc(__GP_USER.uid);
  await ref.set({
    ...patch,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}



function populateEquipUI(cls, equipped, playerLevel){
  const s1 = el("equipSlot1"), s2 = el("equipSlot2"), s3 = el("equipSlot3"), s4 = el("equipSlot4");
  const hint = el("equipHint");
  if(!s1 || !s2 || !s3 || !s4) return;

  const allowed = allowedSkillIdsForClass(cls);
  const lvl = Number(playerLevel||1);
  const opts = allowed.map(id=>{
    const s = skillIndex.get(id);
    const req = s ? requiredLevelForSkill(s) : 1;
    const locked = lvl < req;
    const label = s ? `${s.name} • ${s.element} • T${s.tier}${locked ? `  (Unlock Lv${req})` : ''}` : id;
    return { id, label, locked };
  });

  function fill(select, selectedId){
    select.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— empty —";
    select.appendChild(empty);

    for(const o of opts){
      const op = document.createElement("option");
      op.value = o.id;
      op.textContent = o.label;
      if(o.locked) op.disabled = true;
      if(selectedId && selectedId === o.id) op.selected = true;
      select.appendChild(op);
    }
  }

  const eq = Array.isArray(equipped) ? equipped : [];
  fill(s1, eq[0]||"");
  fill(s2, eq[1]||"");
  fill(s3, eq[2]||"");
  fill(s4, eq[3]||"");

  if(hint){
    hint.textContent = `Allowed skills: ${allowed.length} (Utility + class lines).`;
  }
}

function readEquippedFromUI(){
  const ids = [el("equipSlot1")?.value, el("equipSlot2")?.value, el("equipSlot3")?.value, el("equipSlot4")?.value]
    .map(v=> (v||"").trim())
    .filter(v=>!!v);

  // remove duplicates while preserving order
  const seen = new Set();
  const unique = [];
  for(const id of ids){
    if(!seen.has(id)){ seen.add(id); unique.push(id); }
  }
  // pad to 4 with empty slots (optional)
  return unique.slice(0,4);
}


function renderEquippedSummary(game){
  const box = document.getElementById("equippedSummary");
  if(!box) return;

  const inv = Array.isArray(game.inventory) ? game.inventory : [];
  const eq = game.equipped || { weapon:null, armor:null, relic:null };
  const find = (id)=> inv.find(x=>x.id===id) || null;

  const w = find(eq.weapon);
  const a = find(eq.armor);
  const r = find(eq.relic);

  const counts = new Map();
  [w,a,r].forEach(it=>{ if(it?.setId) counts.set(it.setId, (counts.get(it.setId)||0)+1); });
  let bestSet=null, bestCnt=0;
  for(const [sid,c] of counts.entries()){ if(c>bestCnt){ bestCnt=c; bestSet=sid; } }
  const setId = (bestSet && bestCnt>=2) ? bestSet : null;
  const setTier = (bestCnt>=3) ? 3 : (bestCnt>=2 ? 2 : 0);

  const slots = [
    ["weapon","Weapon", w],
    ["armor","Armor", a],
    ["relic","Relic", r],
  ];

  box.innerHTML = "";
  slots.forEach(([k,label,it])=>{
    const div = document.createElement("div");
    div.className = "equip-mini" + (it ? ` rarity-${it.rarity}` : "");
    const stats = it ? ((it.atkPct?`ATK+${it.atkPct}% `:"") + (it.hpPct?`HP+${it.hpPct}% `:"") + (it.imbue?`Imbue ${it.imbue}`:"") + (it.setId?` • ${setName(it.setId)}`:"")).trim() : "";
    div.innerHTML = `
      <div class="small" style="opacity:.85;">${label}</div>
      <div style="font-weight:900; margin-top:4px;">${it ? `${it.name} +${it.upgrade||0}` : "— none —"}</div>
      <div class="small" style="opacity:.85; margin-top:4px;">${stats}</div>
    `;
    box.appendChild(div);
  });

  // set bonus hint (render below if available)
  // avatar frame
  const av = document.getElementById("gpAvatar");
  if(av){
    const cls = (game.class || "striker").trim() || "striker";
    av.style.backgroundImage = `url('./assets/characters/${cls}.png')`;
    av.classList.remove('frame-2','frame-3');
    if(setTier === 2) av.classList.add('frame-2');
    if(setTier === 3) av.classList.add('frame-3');
  }

  const hint = document.getElementById("setBonusHint");
  if(hint){
    hint.innerHTML = setId ? `✅ <b>Set Bonus Active:</b> ${setName(setId)} (${setTier}pc)` : `Set Bonus: ใส่ไอเทม 2 ชิ้นขึ้นไปเป็นเซ็ตเดียวกัน`;
  }
}


function renderClassGrid(selectedClass, locked){
  const wrap = document.getElementById("gpClassGrid");
  const preview = document.getElementById("gpClassPreview");
  if(!wrap) return;

  const classes = [
    ["striker","Striker"],
    ["arcanist","Arcanist"],
    ["support","Support"],
    ["server_knight","Server Knight"],
    ["host_ranger","Host Ranger"],
    ["bar_alchemist","Bar Alchemist"],
    ["steward_guardian","Steward Guardian"],
  ];

  // preview
  if(preview){
    const cls = selectedClass || "striker";
    preview.style.backgroundImage = `url('./assets/characters/${cls}.png')`;
  }

  wrap.innerHTML = "";
  classes.forEach(([key,label])=>{
    const card = document.createElement("div");
    card.className = "class-card" + (key===selectedClass ? " active" : "");
    card.innerHTML = `
      <div class="img" style="background-image:url('./assets/characters/${key}.png')"></div>
      <div class="label">${label}</div>
    `;
    card.onclick = ()=>{
      // if locked, require manager pin
      if(locked && !requireManagerPin()){
        toast("PIN ไม่ถูกต้อง", "danger");
        return;
      }
      const sel = document.getElementById("gpClass");
      if(sel) sel.value = key;
      // update preview + highlight
      renderClassGrid(key, locked);
    };
    wrap.appendChild(card);
  });
}

function setText(id, value){
  const node = el(id);
  if(node) node.textContent = value;
}

function setHtml(id, value){
  const node = el(id);
  if(node) node.innerHTML = value;
}

function normalizeClassLabel(v){
  if(!v) return "-";
  const map = {
    striker: "Striker",
    arcanist: "Arcanist",
    support: "Support",
    server_knight: "Server Knight",
    host_ranger: "Host Ranger",
    bar_alchemist: "Bar Alchemist",
    steward_guardian: "Steward Guardian"
  };
  return map[v] || v;
}



function requiredLevelForTier(tier){
  // Simple RPG gating
  // T1: Lv1, T2: Lv3, T3: Lv6, T4: Lv10
  const t = Number(tier||1);
  if(t <= 1) return 1;
  if(t === 2) return 3;
  if(t === 3) return 6;
  return 10;
}

function requiredLevelForSkillId(skillId){
  // Special-case: Imbue should unlock a bit earlier
  if((skillId||"").startsWith("util_imbue_")) return 2;
  return null; // derive from tier
}

function requiredLevelForSkill(skill){
  if(!skill) return 1;
  const sp = requiredLevelForSkillId(skill.id);
  if(sp != null) return sp;
  return requiredLevelForTier(skill.tier);
}

function isSkillUnlockedByLevel(skillId, playerLevel){
  const s = skillIndex.get(skillId);
  if(!s) return false;
  const req = requiredLevelForSkill(s);
  return Number(playerLevel||1) >= req;
}

function allowedSkillIdsForClass(cls){
  // allow Utility always + class-specific lines
  const allowLines = new Set(["Utility"]);
  const c = (cls||"").trim();

  if(c === "striker") allowLines.add("Striker");
  else if(c === "arcanist") allowLines.add("Arcanist");
  else if(c === "support") allowLines.add("Support");
  else if(c === "server_knight"){ allowLines.add("Striker"); allowLines.add("Support"); }
  else if(c === "host_ranger"){ allowLines.add("Host Ranger"); allowLines.add("Support"); }
  else if(c === "bar_alchemist"){ allowLines.add("Bar Alchemist"); allowLines.add("Arcanist"); }
  else if(c === "steward_guardian"){ allowLines.add("Steward Guardian"); allowLines.add("Support"); }
  else allowLines.add("Striker");

  const ids = [];
  for(const s of (skillSpec?.skills || [])){
    if(allowLines.has(s.line)) ids.push(s.id);
  }
  return ids;
}

function defaultLoadoutForClass(cls){
  const map = {
    striker: ["s_power_swing","s_double_hit","s_armor_break","s_smash_finisher"],
    arcanist: ["a_weakness_mark","a_cold_brew","a_hangover_hex","a_chain_reaction"],
    support: ["p_first_aid","p_encourage","p_barrier","p_miracle_service"],
    server_knight: ["s_quick_step","s_double_hit","s_execution","util_neutral_strike"],
    host_ranger: ["h_redirect","p_cleanse","p_guard_chant","util_scan"],
    bar_alchemist: ["b_flaming_shot","b_icy_tonic","b_mixology","a_smoke_screen"],
    steward_guardian: ["g_sanitize_shield","p_cleanse","p_guard_chant","p_barrier"]
  };
  return map[(cls||"").trim()] || map.striker;
}

function buildBattleUrl(){
  const cls = (el("gpClass")?.value || __GP_GAME?.class || "").trim();
  const floor = Number(__GP_GAME?.floorCurrent || 1);
  const u = new URL(window.location.href);
  u.pathname = u.pathname.replace(/\/[^\/]*$/, "/battle.html");
  u.searchParams.set("class", cls || "striker");
  u.searchParams.set("floor", String(floor));
  return u.toString();
}

function render(){
  const staff = __GP_PROFILE || {};
  const game = __GP_GAME || {};

  setText("gpName", staff.name || "-");
  setText("gpTitle", (game.title || "") ? `🏷️ ${game.title}` : "—");
  setText("gpStaffID", staff.staffID ? `Staff ID: ${staff.staffID}` : "Staff ID: -");
  setText("gpDept", staff.department || "-");

  const staffExp = Number(staff.points || 0);
  const towerExp = Number(game.towerExp || 0);
  const exp = staffExp + towerExp;
  setText("gpExpStaff", staffExp);
  setText("gpExpTower", towerExp);
  setText("gpGold", Number(game.gold || 0));
  setText("gpEssence", Number((game.materials||{}).essence || 0));
  renderEquippedSummary(game);
  const { level, curReq, nextReq } = levelFromExp(exp);

  setText("gpExp", exp);
  setText("gpLevel", level);

  // Persist computed level/totalExp to keep Battle consistent
  if(currentUser){
    db().collection("game_profiles").doc(currentUser.uid).set({ level, totalExp, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true }).catch(()=>{});
  }


  const pct = nextReq ? Math.max(0, Math.min(1, (exp - curReq) / (nextReq - curReq))) : 1;
  const bar = el("gpExpBar");
  if(bar) bar.style.width = Math.round(pct * 100) + "%";

  setText("gpExpNext", nextReq ? `Next Lv: ${nextReq} EXP (อีก ${Math.max(0, nextReq-exp)} EXP)` : "MAX Level");

  const spTotal = totalSkillPoints(level);
  const spSpent = Number(game.skillPointsSpent || 0);
  const spAvail = Math.max(0, spTotal - spSpent);

  setText("gpSpTotal", spTotal);
  setText("gpSpSpent", spSpent);
  setText("gpSpAvail", spAvail);

  setText("gpFloorHigh", String(game.floorHighest || 1));
  setText("gpFloorCur", String(game.floorCurrent || 1));

  const sel = el("gpClass");
  const btnSave = el("btnSaveClass");
  const btnChange = el("btnChangeClass");
  const hint = el("gpClassHint");

  // set selector value
  if(sel){
    sel.value = (game.class || "").trim();
  }

  if(!game.class){
    if(btnSave) btnSave.style.display = "inline-flex";
    if(btnChange) btnChange.style.display = "none";
    if(hint) hint.textContent = "เลือกครั้งแรกแล้วกด Save";
    if(sel) sel.disabled = false;
  }else{
    if(btnSave) btnSave.style.display = "none";
    if(btnChange) btnChange.style.display = "inline-flex";
    if(hint) hint.textContent = `Current: ${normalizeClassLabel(game.class)} (เปลี่ยนได้ด้วย PIN ผู้จัดการ)`;
    if(sel) sel.disabled = true;
  }


  // class preview + grid (lock if already selected)
  const lockedClass = !!(game.class || "").trim();
  const selectedClass = (sel && sel.value) ? sel.value : (game.class || "striker");
  renderClassGrid(selectedClass || "striker", lockedClass);

  if(sel && !lockedClass){
    sel.onchange = ()=> renderClassGrid(sel.value || "striker", false);
  }

  const goBtn = el("btnGoTower");
  if(goBtn){
    goBtn.disabled = !((game.class || "").trim());
    goBtn.textContent = goBtn.disabled ? "Choose class first" : "Go to Tower";
  }
}


async function loadItemSets(){
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

async function loadSkillSpec(){
  if(skillSpec) return;
  const res = await fetch("./assets/game/laya-skill-spec-v2.json");
  skillSpec = await res.json();
  skillIndex = new Map();
  (skillSpec.skills || []).forEach(s => skillIndex.set(s.id, s));
}

async function loadGameProfilePage(){
  const user = await requireAuth();
  __GP_USER = user;

  __GP_PROFILE = await getProfile(user.uid);
  if(!__GP_PROFILE){
    toast("ไม่พบโปรไฟล์พนักงานใน collection staff (ให้ Manager ตรวจ staff UID ให้ถูก)", "danger");
    return;
  }

  __GP_GAME = await ensureGameProfile(user.uid, __GP_PROFILE);

  // wire buttons
  el("btnSaveClass").onclick = async ()=>{
    const cls = (el("gpClass").value || "").trim();
    if(!cls){
      toast("กรุณาเลือก class ก่อน", "danger");
      return;
    }
    await saveGameProfile({ class: cls, skillsEquipped: ["util_scan","util_neutral_strike"] });
    __GP_GAME.class = cls;
    toast("บันทึก Class สำเร็จ ✅", "info");
    render();

  // Equip UI wiring
  await loadSkillSpec();
  await loadItemSets();

  const refreshEquip = async ()=>{
    const snap = await db().collection("game_profiles").doc(currentUser.uid).get();
    const game = snap.exists ? snap.data() : {};
    const cls = (game.class || el("gpClass")?.value || "striker").trim();
    const lvl = Number(game.level || 1);
    const fallback = defaultLoadoutForClass(cls).filter(id=>isSkillUnlockedByLevel(id, lvl)).slice(0,4);
    const equipped = (game.skillsEquipped && game.skillsEquipped.length) ? game.skillsEquipped : fallback;
    populateEquipUI(cls, equipped, lvl);
  };

  // First fill
  await refreshEquip();

  // When class changes (before lock), update available skills list
  const clsSel = el("gpClass");
  if(clsSel){
    clsSel.onchange = async ()=>{
      const cls = clsSel.value || "striker";
      populateEquipUI(cls, defaultLoadoutForClass(cls), 1);
    };
  }

  const btnSaveEquip = el("btnSaveEquip");
  if(btnSaveEquip){
    btnSaveEquip.onclick = async ()=>{
      try{
        const ids = readEquippedFromUI();
        // validate unlock-by-level
        const snap = await db().collection("game_profiles").doc(currentUser.uid).get();
        const gameNow = snap.exists ? snap.data() : {};
        const lvl = Number(gameNow.level || 1);
        for(const id of ids){
          if(!isSkillUnlockedByLevel(id, lvl)){
            toast(`Skill locked by level: ${id} (Lv${lvl})`, "danger");
            return;
          }
        }
        await db().collection("game_profiles").doc(currentUser.uid).set({
          skillsEquipped: ids,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge:true });
        toast("Saved equipped skills", "info");
      }catch(err){
        console.error(err);
        toast("Save failed: " + err.message, "danger");
      }
    };
  }

  const btnEquipDefault = el("btnEquipDefault");
  if(btnEquipDefault){
    btnEquipDefault.onclick = async ()=>{
      const cls = (el("gpClass")?.value || "striker").trim();
      const snap = await db().collection("game_profiles").doc(currentUser.uid).get();
      const gameNow = snap.exists ? snap.data() : {};
      const lvl = Number(gameNow.level || 1);
      const defRaw = defaultLoadoutForClass(cls);
      const def = defRaw.filter(id=>isSkillUnlockedByLevel(id, lvl)).slice(0,4);
      populateEquipUI(cls, def, lvl);
      try{
        await db().collection("game_profiles").doc(currentUser.uid).set({
          skillsEquipped: def,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge:true });
        toast("Set default loadout", "info");
      }catch(err){
        console.error(err);
        toast("Save failed: " + err.message, "danger");
      }
    };
  }

  };

  el("btnChangeClass").onclick = async ()=>{
    if(!requireManagerPin()){
      toast("PIN ไม่ถูกต้อง", "danger");
      return;
    }
    // allow change
    el("gpClass").disabled = false;
    el("btnSaveClass").style.display = "inline-flex";
    el("btnChangeClass").style.display = "none";
    el("gpClassHint").textContent = "เลือก class ใหม่แล้วกด Save";
    __GP_GAME.class = ""; // temp to let save
    await saveGameProfile({ class: "" });
  };

  el("btnGoTower").onclick = ()=>{
    window.location.href = buildBattleUrl();
  };

  el("btnRefresh").onclick = async ()=>{
    __GP_PROFILE = await getProfile(user.uid);
    __GP_GAME = await db().collection("game_profiles").doc(user.uid).get().then(s=>s.data());
    toast("Refreshed ✅", "info");
    render();
  };

  render();
}
