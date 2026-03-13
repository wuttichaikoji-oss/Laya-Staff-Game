const el = (id)=>document.getElementById(id);

let user = null;

function badgeCard(name, active, onSet){
  const div = document.createElement("div");
  div.className = "badge-card" + (active ? " active" : "");
  div.innerHTML = `
    <div class="row" style="justify-content:space-between; align-items:flex-start; gap:10px;">
      <div>
        <div style="font-weight:900;">${name}</div>
        <div class="small" style="opacity:.85; margin-top:6px;">Title: ${name}</div>
      </div>
      <div class="pill">${active ? "ACTIVE" : "BADGE"}</div>
    </div>

    <button class="btn ${active ? 'secondary' : ''}" style="margin-top:10px; width:100%;">
      ${active ? "Selected" : "Set as Title"}
    </button>
  `;

  div.querySelector("button").onclick = onSet;
  return div;
}

async function load(){
  await initFirebase();
  user = await requireAuth("login.html");
  await render();
  wire();
}

async function getGame(){
  const ref = db().collection("game_profiles").doc(user.uid);
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

async function setTitle(title){
  await db().collection("game_profiles").doc(user.uid).set({
    title: title || "",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge:true });
  toast("Title updated", "info");
  await render();
}

async function render(){
  const g = await getGame();
  const title = (g && g.title) ? String(g.title) : "";
  el("curTitle").textContent = title ? title : "—";

  const badges = (g && Array.isArray(g.badges)) ? g.badges : [];
  el("badgeCount").textContent = badges.length;

  const list = el("badgeList");
  list.innerHTML = "";
  if(badges.length === 0){
    list.innerHTML = "<div class='small'>ยังไม่มี Badge (ลองสะสมเซ็ตให้ครบ)</div>";
    return;
  }

  badges.slice().sort((a,b)=> String(a).localeCompare(String(b))).forEach(name=>{
    list.appendChild(badgeCard(name, title===name, ()=> setTitle(name)));
  });
}

function wire(){
  el("btnClearTitle").onclick = ()=> setTitle("");
}

load();
