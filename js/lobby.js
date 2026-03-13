
const { loadProfile, saveProfile, resetProfile, expNeed } = window.STORE;
const { CLASSES, CLASS_BASE } = window.GAME_DATA;

const el = (id)=>document.getElementById(id);

let profile = loadProfile();

function className(id){
  return CLASSES.find(c=>c.id===id)?.name || "-";
}

function updateProfileUI(){
  el("pClass").textContent = profile.classId ? className(profile.classId) : "-";
  el("pLv").textContent = profile.level;
  el("pGold").textContent = profile.gold;
  el("pFloor").textContent = profile.floor;

  const need = expNeed(profile.level+1);
  const curNeed = expNeed(profile.level);
  const span = Math.max(1, need - curNeed);
  const cur = Math.max(0, profile.exp - curNeed);
  el("expTxt").textContent = `${cur} / ${span}`;
  el("expBar").style.width = `${Math.min(100, (cur/span)*100)}%`;

  el("btnEnter").disabled = !profile.classId;
}

function buildClassGrid(){
  const wrap = el("classGrid");
  wrap.innerHTML = "";
  for(const c of CLASSES){
    const card = document.createElement("div");
    card.className = "card";
    card.style.padding = "12px";
    card.style.cursor = "pointer";
    card.style.borderColor = (profile.classId===c.id) ? "rgba(255,204,51,.45)" : "rgba(255,255,255,.12)";
    card.innerHTML = `
      <div style="font-weight:900;">${c.name}</div>
      <div class="small" style="margin-top:4px;">${c.role} • ${c.desc}</div>
    `;
    card.onclick = ()=>{
      profile.classId = c.id;
      // reset base stats on first pick
      const base = CLASS_BASE[c.id];
      profile.stats = { hp: base.hp, mp: base.mp };
      saveProfile(profile);
      buildClassGrid();
      updateProfileUI();
    };
    wrap.appendChild(card);
  }
}

el("btnEnter").onclick = ()=>{
  saveProfile(profile);
  location.href = "./battle.html";
};

el("btnReset").onclick = ()=>{
  if(confirm("Reset save?")){ resetProfile(); profile = loadProfile(); buildClassGrid(); updateProfileUI(); }
};

buildClassGrid();
updateProfileUI();
