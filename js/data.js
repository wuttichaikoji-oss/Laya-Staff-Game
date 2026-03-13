
// Laya Tower RPG (Clean v0.1) — Data
const CLASSES = [
  { id:"striker", name:"Striker", role:"DPS", desc:"โจมตีหนัก คริติคอลสูง" },
  { id:"arcanist", name:"Arcanist", role:"Mage", desc:"เวทธาตุ + สถานะผิดปกติ" },
  { id:"support", name:"Support", role:"Support", desc:"บัพ/ฮีล/ป้องกันทีม" },
  { id:"server_knight", name:"Server Knight", role:"Tank", desc:"อึด ถึก มีโล่" },
  { id:"host_ranger", name:"Host Ranger", role:"Ranger", desc:"ไว หลบเก่ง ยิงรัว" },
  { id:"bar_alchemist", name:"Bar Alchemist", role:"Debuffer", desc:"พิษ/ระเบิด/ป่วนศัตรู" },
  { id:"steward_guardian", name:"Steward Guardian", role:"Guardian", desc:"แทงค์+ซัพผสม ปลอดภัย" },
];

// Turn-based stats baseline (LV scales later)
const CLASS_BASE = {
  striker:         { hp: 110, mp: 40,  atk: 18, def: 6,  crit: 0.18 },
  arcanist:        { hp: 90,  mp: 70,  atk: 10, def: 4,  crit: 0.08 },
  support:         { hp: 100, mp: 65,  atk: 9,  def: 6,  crit: 0.07 },
  server_knight:   { hp: 140, mp: 40,  atk: 14, def: 10, crit: 0.10 },
  host_ranger:     { hp: 105, mp: 50,  atk: 15, def: 6,  crit: 0.15 },
  bar_alchemist:   { hp: 98,  mp: 60,  atk: 12, def: 5,  crit: 0.10 },
  steward_guardian:{ hp: 125, mp: 45,  atk: 13, def: 8,  crit: 0.10 },
};

// Skills: 4 per class (v0.1). Numbers are "real" for prototype.
const SKILLS = {
  striker: [
    { id:"atk", name:"Attack", type:"physical", element:"Neutral", mp:0,  power:1.00, desc:"โจมตีปกติ" },
    { id:"heavy", name:"Heavy Strike", type:"physical", element:"Neutral", mp:8,  power:1.55, desc:"ตีหนัก โอกาสคริ +10%" , meta:{ critBonus:0.10 } },
    { id:"bleed", name:"Bleed Cut", type:"physical", element:"Neutral", mp:10, power:1.10, desc:"ติด Bleed 3 เทิร์น", meta:{ status:{ id:"bleed", turns:3, dotPct:0.08 } } },
    { id:"focus", name:"Focus", type:"support", element:"Neutral", mp:10, power:0.0, desc:"บัพ ATK +25% 3 เทิร์น", meta:{ buff:{ atkPct:25, turns:3 } } },
  ],
  arcanist: [
    { id:"atk", name:"Magic Bolt", type:"magic", element:"Neutral", mp:0,  power:1.00, desc:"เวทพื้นฐาน" },
    { id:"fire", name:"Flame Rune", type:"magic", element:"Fire", mp:12, power:1.45, desc:"ไฟแรง ติด Burn 3 เทิร์น", meta:{ status:{ id:"burn", turns:3, dotPct:0.10 } } },
    { id:"ice", name:"Frost Seal", type:"magic", element:"Water", mp:12, power:1.20, desc:"น้ำแข็ง มีโอกาส Stun 1 เทิร์น", meta:{ status:{ id:"stun", turns:1, chance:0.25 } } },
    { id:"shock", name:"Storm Mark", type:"magic", element:"Wind", mp:14, power:1.25, desc:"ลมแรง ทำให้ DEF -20% 3 เทิร์น", meta:{ debuff:{ defPct:-20, turns:3 } } },
  ],
  support: [
    { id:"atk", name:"Light Tap", type:"magic", element:"Holy", mp:0,  power:0.95, desc:"โจมตีเบา" },
    { id:"heal", name:"Warm Blessing", type:"support", element:"Holy", mp:12, power:0.0, desc:"ฮีล 28% HP สูงสุด", meta:{ healPct:0.28 } },
    { id:"guard", name:"Shield Hymn", type:"support", element:"Holy", mp:12, power:0.0, desc:"ลดดาเมจที่ได้รับ 25% 3 เทิร์น", meta:{ buff:{ dmgRedPct:25, turns:3 } } },
    { id:"imbue", name:"Imbue Holy", type:"support", element:"Holy", mp:10, power:0.0, desc:"ทำให้โจมตี physical ติด Holy 3 เทิร์น", meta:{ buff:{ imbue:"Holy", turns:3 } } },
  ],
  server_knight: [
    { id:"atk", name:"Shield Bash", type:"physical", element:"Neutral", mp:0,  power:1.00, desc:"ตีด้วยโล่" },
    { id:"taunt", name:"Taunt", type:"support", element:"Neutral", mp:8,  power:0.0, desc:"ลด ATK ศัตรู 20% 3 เทิร์น", meta:{ debuff:{ atkPct:-20, turns:3 } } },
    { id:"fort", name:"Fortify", type:"support", element:"Neutral", mp:10, power:0.0, desc:"DEF +30% 3 เทิร์น", meta:{ buff:{ defPct:30, turns:3 } } },
    { id:"smite", name:"Knight Smite", type:"physical", element:"Earth", mp:12, power:1.35, desc:"ธาตุดิน มีโอกาส Stun 1 เทิร์น", meta:{ status:{ id:"stun", turns:1, chance:0.15 } } },
  ],
  host_ranger: [
    { id:"atk", name:"Quick Shot", type:"physical", element:"Neutral", mp:0,  power:0.95, desc:"ยิงไว" },
    { id:"double", name:"Double Tap", type:"physical", element:"Neutral", mp:10, power:0.85, desc:"ยิง 2 ครั้ง (พลังต่อครั้ง)", meta:{ hits:2 } },
    { id:"poison", name:"Poison Tip", type:"physical", element:"Poison", mp:12, power:1.05, desc:"ติด Poison 4 เทิร์น", meta:{ status:{ id:"poison", turns:4, dotPct:0.09 } } },
    { id:"evasion", name:"Evasion Stance", type:"support", element:"Neutral", mp:10, power:0.0, desc:"ลดโอกาสโดน 20% 3 เทิร์น", meta:{ buff:{ evadePct:20, turns:3 } } },
  ],
  bar_alchemist: [
    { id:"atk", name:"Mixer Hit", type:"physical", element:"Neutral", mp:0,  power:1.00, desc:"โจมตีปกติ" },
    { id:"acid", name:"Acid Splash", type:"magic", element:"Poison", mp:12, power:1.25, desc:"พิษกัดกร่อน DEF -25% 3 เทิร์น", meta:{ debuff:{ defPct:-25, turns:3 } } },
    { id:"toxin", name:"Toxin Cloud", type:"magic", element:"Poison", mp:14, power:1.05, desc:"ติด Poison 5 เทิร์น", meta:{ status:{ id:"poison", turns:5, dotPct:0.10 } } },
    { id:"brew", name:"Brew Boost", type:"support", element:"Neutral", mp:10, power:0.0, desc:"ATK +18% & Crit +8% 3 เทิร์น", meta:{ buff:{ atkPct:18, critPct:8, turns:3 } } },
  ],
  steward_guardian: [
    { id:"atk", name:"Guard Slash", type:"physical", element:"Neutral", mp:0,  power:1.00, desc:"โจมตีปกติ" },
    { id:"ward", name:"Ward", type:"support", element:"Neutral", mp:10, power:0.0, desc:"ลดดาเมจ 18% 4 เทิร์น", meta:{ buff:{ dmgRedPct:18, turns:4 } } },
    { id:"cleanse", name:"Cleanse", type:"support", element:"Holy", mp:12, power:0.0, desc:"ล้างสถานะเสีย 1 อย่าง + ฮีล 15%", meta:{ cleanse:true, healPct:0.15 } },
    { id:"holy", name:"Holy Thrust", type:"physical", element:"Holy", mp:12, power:1.25, desc:"แทงศักดิ์สิทธิ์", meta:{} },
  ],
};

const ELEMENTS = ["Neutral","Water","Earth","Fire","Wind","Poison","Holy","Shadow","Ghost","Undead"];

function randPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function enemyForFloor(floor){
  const tier = floor <= 3 ? 1 : floor <= 6 ? 2 : 3;
  const isMini = (floor % 5 === 0) && (floor % 10 !== 0);
  const isBoss = (floor % 10 === 0);

  const defLv = isBoss ? Math.min(4, tier+1) : isMini ? Math.min(4, tier) : tier;
  const element = (isBoss || isMini) ? randPick(ELEMENTS.slice(1)) : randPick(ELEMENTS);

  const baseHP = 85 + floor*14 + (isMini?80:0) + (isBoss?160:0);
  const baseATK = 10 + floor*2 + (isMini?6:0) + (isBoss?12:0);
  const baseDEF = 4 + Math.floor(floor/3) + (isBoss?3:0);

  return {
    name: isBoss ? `Boss F${floor}` : isMini ? `Mini-Boss F${floor}` : `Monster F${floor}`,
    floor,
    element,
    defLv,
    hpMax: baseHP,
    hp: baseHP,
    atk: baseATK,
    def: baseDEF,
    type: isBoss ? "boss" : isMini ? "miniBoss" : "normal",
  };
}

window.GAME_DATA = { CLASSES, CLASS_BASE, SKILLS, enemyForFloor, ELEMENTS };
