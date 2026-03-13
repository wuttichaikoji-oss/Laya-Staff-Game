/* Laya Staff Task PWA service worker */
const CACHE_NAME = "laya-staff-task-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./staff.html",
  "./manager.html",
  "./upload.html",
  "./checklist.html",
  "./js/element-table-roc.js",
  "./js/battle.js",
  "./battle.html",
  "./js/game.js",
  "./game.html",
  "./assets/game/quests.json",
  "./js/leaderboard.js",
  "./leaderboard.html",
  "./js/quests.js",
  "./quests.html",
  "./js/inventory.js",
  "./inventory.html",
  "./js/shop.js",
  "./shop.html",
  "./js/sets.js",
  "./sets.html",
  "./js/badges.js",
  "./badges.html",
  "./css/style.css",
  "./assets/favicon.svg",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./assets/monsters/minibosses/checklist_reaper_mini.png",
  "./assets/monsters/minibosses/double_charge_incident.png",
  "./assets/monsters/minibosses/last_minute_change.png",
  "./assets/monsters/minibosses/rolling_trolley.png",
  "./assets/monsters/minibosses/napkin_count.png",
  "./assets/monsters/minibosses/hangover_king.png",
  "./assets/monsters/minibosses/glassware_breaker.png",
  "./assets/monsters/minibosses/double_booking.png",
  "./assets/monsters/minibosses/coffee_spill.png",
  "./assets/monsters/minibosses/missing_spoon.png",
  "./assets/monsters/bosses/grand_audit.png",
  "./assets/monsters/bosses/complaint_queen.png",
  "./assets/monsters/bosses/banquet_overlord.png",
  "./assets/monsters/bosses/storage_guardian.png",
  "./assets/monsters/bosses/mangrove_critic.png",
  "./assets/monsters/bosses/mixology_master.png",
  "./assets/monsters/bosses/station_commander.png",
  "./assets/monsters/bosses/vip_entrance.png",
  "./assets/monsters/bosses/buffet_hydra.png",
  "./assets/monsters/bosses/morning_rush.png",
  "./assets/monsters/common/phone_ring.png",
  "./assets/monsters/common/box_mimic.png",
  "./assets/monsters/common/detail_wraith.png",
  "./assets/monsters/common/ice_tonic.png",
  "./assets/monsters/common/hangover_slime.png",
  "./assets/monsters/common/glass_shard.png",
  "./assets/monsters/common/booking_phantom.png",
  "./assets/monsters/common/baby_chair_golem.png",
  "./assets/monsters/common/coffee_gremlin.png",
  "./assets/monsters/common/cutlery_imp.png",
  "./assets/monsters/common/tray_runner.png",
  "./assets/monsters/common/dustling.png",
  "./assets/game/monster-sprites.json",
  "./assets/game/item-sets.json",
  "./assets/game/laya-skill-spec-v2.json",
  "./assets/game/tower-monsters-1-100.json",
  "./assets/monsters/boss_demon.png",
  "./assets/battle/bg_meadow_castle.png",
  "./assets/characters/steward_guardian.png",
  "./assets/characters_mirror/steward_guardian.png",
  "./assets/characters/bar_alchemist.png",
  "./assets/characters_mirror/bar_alchemist.png",
  "./assets/characters/host_ranger.png",
  "./assets/characters_mirror/host_ranger.png",
  "./assets/characters/server_knight.png",
  "./assets/characters_mirror/server_knight.png",
  "./assets/characters/support.png",
  "./assets/characters_mirror/support.png",
  "./assets/characters/arcanist.png",
  "./assets/characters_mirror/arcanist.png",
  "./assets/characters/striker.png",
  "./assets/characters_mirror/striker.png",
  "./js/auth.js",
  "./js/checklist.js",
  "./js/firebase-config.js",
  "./js/firebase-init.js",
  "./js/manager.js",
  "./js/staff.js",
  "./js/upload.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Don't cache Firebase/Google API calls
  if (url.hostname.includes("googleapis.com") ||
      url.hostname.includes("firebaseapp.com") ||
      url.hostname.includes("firebasestorage.googleapis.com") ||
      url.hostname.includes("firestore.googleapis.com") ||
      url.hostname.includes("gstatic.com")) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
