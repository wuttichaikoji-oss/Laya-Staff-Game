const el = (id)=>document.getElementById(id);

let user = null;
let rows = [];

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}

async function load(){
  await initFirebase();
  user = await requireAuth("login.html");
  await fetchRows();
  render();
  el("lbMode").onchange = render;
}

async function fetchRows(){
  const snap = await db().collection("leaderboards").limit(200).get();
  rows = snap.docs.map(d=>({ uid:d.id, ...d.data() }));
}

function metricLabel(mode){
  if(mode==="floorHighest") return "Highest Floor";
  if(mode==="towerClears") return "Tower Clears";
  return "Sets Completed";
}

function metricValue(r, mode){
  if(mode==="floorHighest") return Number(r.floorHighest||0);
  if(mode==="towerClears") return Number(r.towerClears||0);
  return Number(r.setsCompleted||0);
}

function render(){
  const mode = el("lbMode").value;
  el("lbMetric").textContent = metricLabel(mode);

  const sorted = rows.slice().sort((a,b)=> metricValue(b,mode) - metricValue(a,mode) || String(a.name||"").localeCompare(String(b.name||"")));

  const body = el("lbRows");
  body.innerHTML = "";
  if(sorted.length===0){
    body.innerHTML = "<tr><td colspan='4' class='small'>ยังไม่มีข้อมูล</td></tr>";
    return;
  }

  sorted.forEach((r, i)=>{
    body.insertAdjacentHTML("beforeend", `
      <tr>
        <td><b>${i+1}</b></td>
        <td>${escapeHtml(r.name||"-")}</td>
        <td>${escapeHtml(r.title||"")}</td>
        <td><b>${metricValue(r,mode)}</b></td>
      </tr>
    `);
  });
}

load();
