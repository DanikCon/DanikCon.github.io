/*
  Slither Arena — Construct 3 JS runtime (GamePush + Playgama integration v0.17)
  ---------------------------------------------------------------
  All game logic, bots, UI and platform calls live in this file.
  Runs from Construct 3's Scripts folder in DOM mode (Use worker = Auto).

  External adapter contract (optional):
  globalThis.SlitherPlatformAdapter = {
    platform: 'gamepush' | 'playgama' | 'local',
    loadProgress: async () => progressObject | null,
    saveProgress: async (progressObject) => void,
    showRewarded: async (reason) => boolean,
    showInterstitial: async () => boolean,
    setBannerVisible: async (visible) => void,
    purchaseSkin: async (sku) => boolean,
    onGameplayStart: async () => void,
    onGameplayStop: async () => void,
    onPauseChanged: async (paused) => void
  };

  Platform SDK strategy:
  - GamePush uses the configured Construct addon when it is present, then its direct SDK fallback.
  - Playgama uses Bridge storage/ads and converts paid skin cards into reward-video unlocks.
  - LocalStorage remains a non-destructive fallback for Construct Preview and offline sessions.
*/

const CFG = Object.freeze({
  WORLD_SIZE: 5400,
  FOOD_TARGET: 124,
  FOOD_HARD_CAP: 185,
  FOOD_SPAWN_INTERVAL: .62,
  FOOD_SPAWN_BATCH: 2,
  FOOD_LIFE_MIN: 22,
  FOOD_LIFE_MAX: 36,
  DEATH_FOOD_LIFE_MIN: 16,
  DEATH_FOOD_LIFE_MAX: 29,
  BOOST_FOOD_LIFE_MIN: 3.5,
  BOOST_FOOD_LIFE_MAX: 5.2,
  // A loot pile records the high-value food dropped by one defeated snake.
  // It lets nearby bots make a clear, local decision instead of scanning every firefly equally.
  LOOT_PILE_TTL: 31,
  LOOT_ALERT_RADIUS: 1420,
  LOOT_TRACK_LIMIT: 10,
  BOT_COUNT: 28,
  BOT_SECTOR_COUNT: 14,
  START_MASS: 30,
  MAX_DT: 0.04,
  INTERSTITIAL_COOLDOWN_SECONDS: 180,
  REVIVE_INVULNERABILITY_SECONDS: 4,
  BANNER_MODE: "menu-only", // no banner in an active match
  DEBUG_FAKE_ADS: false,
  DEBUG_FAKE_PURCHASES: false,
  SAVE_KEY: "slither_arena_progress_v1"
});

const PLATFORM_SDK = Object.freeze({
  GAMEPUSH_PROJECT_ID: 29063,
  // Public token is intentionally client-side. Do not put a GamePush private key in this project.
  GAMEPUSH_PUBLIC_TOKEN: "Bf2XibKx6MhHfeWqWgUx2fPiaYzMtdTX",
  PLAYGAMA_CONFIG_PATH: "playgama-bridge-config.json",
  SDK_WAIT_MS: 5200,
  STORAGE_KEY: "slither_progress",
  // Product tags must match the GamePush dashboard exactly.
  STORE_PRICE_LABELS: Object.freeze({
    yandex: "29 ЯН",
    vk: "4 голоса",
    ok: "26 ОК",
    gamepush: "29",
    local: "29 ЯН"
  })
});

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const distSq = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const pointSegmentDistanceSq = (px, py, ax, ay, bx, by) => {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq < .00001) return distSq(px, py, ax, ay);
  const t = clamp((apx * abx + apy * aby) / lengthSq, 0, 1);
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return dx * dx + dy * dy;
};
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (items) => items[(Math.random() * items.length) | 0];
const chance = (probability) => Math.random() < probability;
const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const normalizeAngle = (angle) => {
  while (angle > Math.PI) angle -= TAU;
  while (angle < -Math.PI) angle += TAU;
  return angle;
};
const turnToward = (from, to, maxStep) => {
  const delta = normalizeAngle(to - from);
  return from + clamp(delta, -maxStep, maxStep);
};
const dot2 = (ax, ay, bx, by) => ax * bx + ay * by;
const cross2 = (ax, ay, bx, by) => ax * by - ay * bx;
const hash32 = (text) => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const SKINS = Object.freeze([
  { id: "mint", name: "Мятная", primary: "#63e6be", secondary: "#d3f9d8", accent: "#46d39c", pattern: "solid", kind: "default", unlocked: true },
  { id: "berry", name: "Ягодная", primary: "#da77f2", secondary: "#f8c0ff", accent: "#a94cc4", pattern: "stripe", kind: "free" },
  { id: "ocean", name: "Океан", primary: "#4dabf7", secondary: "#a5d8ff", accent: "#1971c2", pattern: "wave", kind: "free" },
  { id: "lemon", name: "Лимон", primary: "#ffd43b", secondary: "#fff3bf", accent: "#f08c00", pattern: "dots", kind: "free" },
  { id: "coral", name: "Коралл", primary: "#ff8787", secondary: "#ffe3e3", accent: "#e8590c", pattern: "bands", kind: "free" },
  { id: "sakura", name: "Сакура", primary: "#f783ac", secondary: "#fff0f6", accent: "#d6336c", pattern: "petals", kind: "free" },
  { id: "jade", name: "Нефрит", primary: "#51cf66", secondary: "#d3f9d8", accent: "#2b8a3e", pattern: "scales", kind: "free" },

  { id: "prism", name: "Призма", primary: "#f06595", secondary: "#e599f7", accent: "#9775fa", pattern: "prism", kind: "reward" },
  { id: "ember", name: "Искра", primary: "#ff922b", secondary: "#fff4e6", accent: "#e8590c", pattern: "ember", kind: "reward" },
  { id: "starlight", name: "Звёздная пыль", primary: "#748ffc", secondary: "#e5dbff", accent: "#b197fc", pattern: "galaxy", kind: "reward" },
  { id: "toxic", name: "Токсин", primary: "#94d82d", secondary: "#e9fac8", accent: "#5c940d", pattern: "chevron", kind: "reward" },
  { id: "moth", name: "Лунная бабочка", primary: "#b197fc", secondary: "#f3f0ff", accent: "#eebefa", pattern: "moth", kind: "reward" },
  { id: "nebula", name: "Туманность", primary: "#845ef7", secondary: "#d0bfff", accent: "#74c0fc", pattern: "nebula", kind: "reward" },

  { id: "royal", name: "Королевская", primary: "#5f3dc4", secondary: "#d0bfff", accent: "#ffd43b", pattern: "crown", kind: "purchase", sku: "skin_royal", priceLabel: "29" },
  { id: "neon", name: "Неон", primary: "#20c997", secondary: "#e6fcf5", accent: "#63e6be", pattern: "neon", kind: "purchase", sku: "skin_neon", priceLabel: "29" },
  { id: "gold", name: "Солнечный", primary: "#fcc419", secondary: "#fff3bf", accent: "#ff922b", pattern: "spark", kind: "purchase", sku: "skin_gold", priceLabel: "29" },
  { id: "crystal", name: "Кристалл", primary: "#74c0fc", secondary: "#e7f5ff", accent: "#b197fc", pattern: "crystal", kind: "purchase", sku: "skin_crystal", priceLabel: "29" },
  { id: "dragon", name: "Дракон", primary: "#ff6b6b", secondary: "#ffe3e3", accent: "#ffd43b", pattern: "dragon", kind: "purchase", sku: "skin_dragon", priceLabel: "29" },
  { id: "lava", name: "Лава", primary: "#e8590c", secondary: "#ffd8a8", accent: "#ffd43b", pattern: "lava", kind: "purchase", sku: "skin_lava", priceLabel: "29" },

  { id: "cobalt", name: "Кобальт", primary: "#339af0", secondary: "#d0ebff", accent: "#1864ab", pattern: "scales", kind: "score", requiredScore: 100 },
  { id: "tiger", name: "Тигр", primary: "#ff922b", secondary: "#fff3bf", accent: "#212529", pattern: "tiger", kind: "score", requiredScore: 250 },
  { id: "aurora", name: "Аврора", primary: "#38d9a9", secondary: "#d0bfff", accent: "#74c0fc", pattern: "aurora", kind: "score", requiredScore: 500 },
  { id: "comet", name: "Комета", primary: "#e599f7", secondary: "#f3d9fa", accent: "#74c0fc", pattern: "neon", kind: "score", requiredScore: 1000 },
  { id: "void", name: "Бездна", primary: "#343a40", secondary: "#adb5bd", accent: "#845ef7", pattern: "galaxy", kind: "score", requiredScore: 2000 },
  { id: "legend", name: "Легенда", primary: "#ffd43b", secondary: "#fff9db", accent: "#ff6b6b", pattern: "crown", kind: "score", requiredScore: 3500 },
  { id: "phoenix", name: "Феникс", primary: "#ff6b6b", secondary: "#fff4e6", accent: "#ffd43b", pattern: "lava", kind: "score", requiredScore: 5000 },
  { id: "titan", name: "Титан", primary: "#495057", secondary: "#dee2e6", accent: "#74c0fc", pattern: "crystal", kind: "score", requiredScore: 8000 },
  { id: "celestial", name: "Небесный", primary: "#74c0fc", secondary: "#ffffff", accent: "#ffe066", pattern: "nebula", kind: "score", requiredScore: 12000 },

  { id: "astral", name: "Астрал", primary: "#9775fa", secondary: "#f3f0ff", accent: "#74c0fc", pattern: "galaxy", kind: "league", requiredStars: 12 },
  { id: "oracle", name: "Оракул", primary: "#ffd43b", secondary: "#fff9db", accent: "#da77f2", pattern: "prism", kind: "league", requiredStars: 28 },
  { id: "afterglow", name: "Послесвечение", primary: "#ff8cc8", secondary: "#fff0f8", accent: "#ffd43b", pattern: "aurora", kind: "streak", requiredStreak: 3 },
  { id: "tactician", name: "Тактик", primary: "#4dabf7", secondary: "#e7f5ff", accent: "#63e6be", pattern: "crystal", kind: "duel", requiredDuels: 12 }
]);

function getSkin(skinId) {
  return SKINS.find((skin) => skin.id === skinId) ?? SKINS[0];
}

function defaultProgress() {
  return {
    version: 8,
    bestMass: 0,
    selectedSkin: "mint",
    touchControl: "touch",
    unlockedSkins: ["mint"],
    purchaseSkins: [],
    rewardClaims: 0,
    totalMatches: 0,
    totalFood: 0,
    totalKills: 0,
    dailyDate: "",
    dailyProgress: 0,
    dailyClaimed: false,
    missionDate: "",
    missionProgress: {},
    missionClaimed: [],
    missionStreak: 0,
    lastMissionCompletionDate: "",
    leagueStars: 0
  };
}

function sanitizeProgress(raw) {
  const fallback = defaultProgress();
  if (!raw || typeof raw !== "object") return fallback;
  const allowed = new Set(SKINS.map((skin) => skin.id));
  const unlocked = Array.isArray(raw.unlockedSkins)
    ? raw.unlockedSkins.filter((id) => allowed.has(id))
    : [];
  if (!unlocked.includes("mint")) unlocked.unshift("mint");
  const selectedSkin = unlocked.includes(raw.selectedSkin) ? raw.selectedSkin : "mint";
  return {
    version: 8,
    bestMass: Math.max(0, Number(raw.bestMass) || 0),
    selectedSkin,
    touchControl: raw.touchControl === "joystick" ? "joystick" : "touch",
    unlockedSkins: [...new Set(unlocked)],
    purchaseSkins: Array.isArray(raw.purchaseSkins) ? raw.purchaseSkins.filter((id) => allowed.has(id)) : [],
    rewardClaims: Math.max(0, Number(raw.rewardClaims) || 0),
    totalMatches: Math.max(0, Number(raw.totalMatches) || 0),
    totalFood: Math.max(0, Number(raw.totalFood) || 0),
    totalKills: Math.max(0, Math.floor(Number(raw.totalKills) || 0)),
    dailyDate: typeof raw.dailyDate === "string" ? raw.dailyDate : "",
    dailyProgress: Math.max(0, Number(raw.dailyProgress) || 0),
    dailyClaimed: !!raw.dailyClaimed,
    missionDate: typeof raw.missionDate === "string" ? raw.missionDate : "",
    missionProgress: raw.missionProgress && typeof raw.missionProgress === "object"
      ? Object.fromEntries(Object.entries(raw.missionProgress).filter(([key, value]) => typeof key === "string" && Number.isFinite(Number(value))).map(([key, value]) => [key, Math.max(0, Number(value) || 0)]))
      : {},
    missionClaimed: Array.isArray(raw.missionClaimed) ? [...new Set(raw.missionClaimed.filter((id) => typeof id === "string"))] : [],
    missionStreak: Math.max(0, Math.floor(Number(raw.missionStreak) || 0)),
    lastMissionCompletionDate: typeof raw.lastMissionCompletionDate === "string" ? raw.lastMissionCompletionDate : "",
    leagueStars: Math.max(0, Math.floor(Number(raw.leagueStars) || 0))
  };
}

function localDayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dailyDefinition(dayKey = localDayKey()) {
  const variants = [
    { type: "food", goal: 36, reward: 2, label: "Собери 36 огней" },
    { type: "mass", goal: 110, reward: 3, label: "Дорасти до веса 110" },
    { type: "survive", goal: 95, reward: 3, label: "Продержись 95 секунд" },
    { type: "food", goal: 70, reward: 3, label: "Собери 70 огней" },
    { type: "mass", goal: 180, reward: 4, label: "Дорасти до веса 180" }
  ];
  return variants[hash32(`daily:${dayKey}`) % variants.length];
}

function shiftDayKey(dayKey, offsetDays) {
  const [year, month, day] = String(dayKey).split("-").map(Number);
  const date = new Date(year || 2000, Math.max(0, (month || 1) - 1), day || 1);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function missionDefinitions(dayKey = localDayKey()) {
  // Three small contracts create a clear "one more match" rhythm without demanding online services.
  const sets = [
    [
      { id: "food", type: "food", goal: 42, reward: 1, label: "Собери 42 огня" },
      { id: "mass", type: "mass", goal: 115, reward: 1, label: "Дорасти до веса 115" },
      { id: "survive", type: "survive", goal: 78, reward: 2, label: "Продержись 78 секунд" }
    ],
    [
      { id: "food", type: "food", goal: 58, reward: 1, label: "Собери 58 огней" },
      { id: "mass", type: "mass", goal: 145, reward: 2, label: "Дорасти до веса 145" },
      { id: "duel", type: "duel", goal: 1, reward: 2, label: "Победи 1 соперника" }
    ],
    [
      { id: "food", type: "food", goal: 35, reward: 1, label: "Собери 35 огней" },
      { id: "survive", type: "survive", goal: 105, reward: 2, label: "Продержись 105 секунд" },
      { id: "duel", type: "duel", goal: 2, reward: 2, label: "Победи 2 соперников" }
    ],
    [
      { id: "mass", type: "mass", goal: 180, reward: 2, label: "Дорасти до веса 180" },
      { id: "food", type: "food", goal: 50, reward: 1, label: "Собери 50 огней" },
      { id: "survive", type: "survive", goal: 124, reward: 2, label: "Продержись 124 секунды" }
    ]
  ];
  return sets[hash32(`contracts:${dayKey}`) % sets.length];
}

const LEAGUE_TIERS = Object.freeze([
  { name: "Новичок", min: 0, next: 8 },
  { name: "Бронза", min: 8, next: 20 },
  { name: "Серебро", min: 20, next: 38 },
  { name: "Золото", min: 38, next: 65 },
  { name: "Платина", min: 65, next: 100 },
  { name: "Легенда", min: 100, next: null }
]);

class PlatformBridge {
  constructor(runtime) {
    this.runtime = runtime;
    this.adapter = globalThis.SlitherPlatformAdapter ?? null;
    this.gp = null;
    this.pg = null;
    this.platform = this.normalizePlatform(
      this.adapter?.platform ?? globalThis.SLITHER_PLATFORM ?? this.getForcedPlatform() ?? this.detectPlatform()
    );
    this.bannerVisible = false;
    this.initialized = false;
    this.initializing = null;
    this.products = [];
    this.gpLoadedDirectly = false;
  }

  normalizePlatform(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    if (!raw) return "local";
    if (raw.includes("playgama")) return "playgama";
    if (raw.includes("yandex") || raw === "ya") return "yandex";
    if (raw === "vk" || raw.includes("vkontakte")) return "vk";
    if (raw === "ok" || raw.includes("odnoklassniki")) return "ok";
    if (raw.includes("gamepush") || raw.includes("eponesh")) return "gamepush";
    if (raw.includes("local") || raw.includes("mock") || raw === "none") return "local";
    return raw;
  }

  getForcedPlatform() {
    try {
      const params = new URLSearchParams(globalThis.location?.search ?? "");
      // slither_platform is useful when a social platform opens the game from a neutral host
      // such as GitHub Pages. GamePush itself still verifies the actual platform at startup.
      return params.get("slither_platform")
        ?? params.get("slitherPlatform")
        ?? params.get("gp_platform")
        ?? params.get("_platform")
        ?? null;
    } catch (_error) {
      return null;
    }
  }

  getEmbeddedHostHint() {
    // In VK/OK the game document keeps its own hostname (for example GitHub Pages),
    // so location.hostname alone cannot identify the parent platform. document.referrer
    // remains available in normal iframe launches and makes the SDK bootstrap reliable.
    const candidates = [];
    try { candidates.push(globalThis.location?.hostname ?? ""); } catch (_error) { /* no-op */ }
    try { candidates.push(new URL(globalThis.document?.referrer ?? "").hostname); } catch (_error) { /* no-op */ }
    try {
      const params = new URLSearchParams(globalThis.location?.search ?? "");
      if (params.has("api_id") || params.has("vk_app_id") || params.has("vk_user_id")) candidates.push("vk");
      if (params.has("application_key") || params.has("ok_app_id") || params.has("logged_user_id")) candidates.push("ok");
    } catch (_error) { /* no-op */ }
    const joined = candidates.join(" ").toLowerCase();
    if (joined.includes("playgama")) return "playgama";
    if (joined.includes("yandex")) return "yandex";
    if (joined.includes("vk.com") || joined.includes("vk.ru") || joined.includes("vkontakte") || joined === "vk") return "vk";
    if (joined.includes("ok.ru") || joined.includes("odnoklassniki") || joined === "ok") return "ok";
    if (joined.includes("gamepush") || joined.includes("eponesh")) return "gamepush";
    return null;
  }

  getGamePush() {
    return this.gp
      ?? this.runtime?.GamePush
      ?? this.runtime?.GameScore
      ?? globalThis.gp
      ?? globalThis.GamePush
      ?? null;
  }

  getPlaygama() {
    return this.pg ?? globalThis.bridge ?? globalThis.playgamaBridge ?? null;
  }

  detectPlatform() {
    const forced = this.getForcedPlatform();
    if (forced) return this.normalizePlatform(forced);
    const hint = this.getEmbeddedHostHint();
    if (hint) return this.normalizePlatform(hint);
    const pgId = this.getPlaygama()?.platform?.id;
    if (pgId && String(pgId).toLowerCase() !== "mock") return this.normalizePlatform(pgId);
    const gpType = this.getGamePush()?.platform?.type;
    if (gpType && String(gpType).toLowerCase() !== "none") return this.normalizePlatform(gpType);
    return this.getGamePush() ? "gamepush" : "local";
  }

  shouldBootstrapGamePush() {
    if (this.isPlaygama) return false;
    if (this.getGamePush()) return true;
    const forced = this.normalizePlatform(this.getForcedPlatform());
    if (forced !== "local") return true;
    const hint = this.normalizePlatform(this.getEmbeddedHostHint());
    return ["yandex", "vk", "ok", "gamepush"].includes(hint);
  }

  get isPlaygama() {
    return this.platform === "playgama";
  }

  get isGamePushPlatform() {
    return ["yandex", "vk", "ok", "gamepush"].includes(this.platform);
  }

  get supportsPurchases() {
    // Playgama deliberately converts shop purchases into rewarded-video unlocks.
    return !this.isPlaygama;
  }

  getPriceLabel(_skin) {
    return PLATFORM_SDK.STORE_PRICE_LABELS[this.platform]
      ?? PLATFORM_SDK.STORE_PRICE_LABELS.gamepush;
  }

  async initialize() {
    if (this.initialized) return true;
    if (this.initializing) return this.initializing;
    this.initializing = this._initialize();
    try {
      await this.initializing;
      this.initialized = true;
      return true;
    } catch (error) {
      console.warn("[SlitherArena] Platform SDK initialization failed; local mode stays active.", error);
      return false;
    } finally {
      this.initializing = null;
    }
  }

  async _initialize() {
    try {
      await this.adapter?.initialize?.();
    } catch (error) {
      console.warn("[SlitherArena] External adapter initialization failed.", error);
    }

    this.platform = this.normalizePlatform(this.adapter?.platform ?? globalThis.SLITHER_PLATFORM ?? this.getForcedPlatform() ?? this.detectPlatform());
    if (this.isPlaygama) {
      this.pg = await this.initPlaygama();
    } else if (this.shouldBootstrapGamePush()) {
      this.gp = await this.initGamePush();
      const resolved = this.normalizePlatform(this.gp?.platform?.type);
      if (resolved && resolved !== "local" && resolved !== "gamepush") this.platform = resolved;
    } else {
      // Preview may already have an addon-provided SDK even when the hostname is neutral.
      this.gp = this.getGamePush();
      this.pg = this.getPlaygama();
      if (this.pg?.isInitialized && this.normalizePlatform(this.pg.platform?.id) === "playgama") {
        this.platform = "playgama";
      } else if (this.gp && this.normalizePlatform(this.gp.platform?.type) !== "local") {
        this.platform = this.normalizePlatform(this.gp.platform?.type);
      }
    }

    if (this.gp && this.isGamePushPlatform) {
      await this.waitForGamePushPlayer(this.gp);
      if (this.gpLoadedDirectly) {
        try { await this.gp.gameStart?.(); } catch (_error) { /* GamePush may already have started the session. */ }
      }
      try {
        const fetched = await this.gp.payments?.fetchProducts?.();
        this.products = fetched?.products ?? [];
      } catch (error) {
        // Products can be unavailable in Preview or before the dashboard is configured.
        console.warn("[SlitherArena] GamePush products are not available yet.", error);
      }
    }

    if (this.pg?.platform?.sendMessage && this.pg?.PLATFORM_MESSAGE?.GAME_READY) {
      try {
        await this.pg.platform.sendMessage(this.pg.PLATFORM_MESSAGE.GAME_READY);
      } catch (_error) {
        // A neutral/test host does not necessarily implement platform messages.
      }
    }
  }

  async waitFor(test, timeout = PLATFORM_SDK.SDK_WAIT_MS, interval = 60) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      const result = test();
      if (result) return result;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    return null;
  }

  async waitForGamePushPlayer(gp) {
    if (!gp?.player?.on || gp.player.isReady === true) return;
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try { gp.player.off?.("ready", finish); } catch (_error) { /* no-op */ }
        resolve();
      };
      try { gp.player.on("ready", finish); } catch (_error) { finish(); }
      setTimeout(finish, 4200);
    });
  }

  async initGamePush() {
    let gp = this.getGamePush();
    if (gp) return gp;

    // When the Construct plugin is actually present in a project, let it own bootstrap.
    const addonLoaded = !!globalThis.C3?.Plugins?.Eponesh_GameScore;
    if (addonLoaded) {
      gp = await this.waitFor(() => this.getGamePush(), PLATFORM_SDK.SDK_WAIT_MS);
      if (gp) return gp;
      // Do not assume the plugin object was placed in the layout: direct bootstrap below
      // keeps pure-JS event-sheet projects functional as well.
    }

    if (!this.shouldBootstrapGamePush() || !globalThis.document?.head) return null;
    const callbackName = `__slitherGamePushInit_${Math.random().toString(36).slice(2)}`;
    const query = `gamepush.js?projectId=${encodeURIComponent(PLATFORM_SDK.GAMEPUSH_PROJECT_ID)}&publicToken=${encodeURIComponent(PLATFORM_SDK.GAMEPUSH_PUBLIC_TOKEN)}&callback=${callbackName}`;
    const origins = [
      "https://gs.eponesh.com/sdk/",
      "https://s3.gamepush.com/files/gs/sdk/",
      "https://s3.eponesh.com/files/gs/sdk/",
      "https://gamepush.com/sdk/"
    ];
    let lastError = null;
    try {
      for (const origin of origins) {
        const src = `${origin}${query}`;
        try {
          gp = await new Promise((resolve, reject) => {
            let settled = false;
            let timeoutId = 0;
            const finish = (value, error) => {
              if (settled) return;
              settled = true;
              if (timeoutId) clearTimeout(timeoutId);
              if (value) resolve(value); else reject(error ?? new Error("GamePush returned an empty SDK instance"));
            };
            const existing = document.querySelector(`script[data-slither-gamepush-src="${origin}"]`);
            globalThis[callbackName] = (sdk) => {
              Promise.resolve(sdk?.ready).then(() => {
                this.gp = sdk;
                finish(sdk);
              }).catch((error) => finish(null, error));
            };
            if (existing) {
              this.waitFor(() => this.getGamePush(), 1500).then((sdk) => finish(sdk, new Error("Existing GamePush SDK did not become ready")));
              return;
            }
            const script = document.createElement("script");
            script.async = true;
            script.dataset.slitherGamepush = String(PLATFORM_SDK.GAMEPUSH_PROJECT_ID);
            script.dataset.slitherGamepushSrc = origin;
            script.src = src;
            script.onerror = () => finish(null, new Error(`GamePush SDK script could not be loaded from ${origin}`));
            document.head.appendChild(script);
            timeoutId = setTimeout(() => finish(null, new Error(`GamePush SDK initialization timed out for ${origin}`)), Math.min(PLATFORM_SDK.SDK_WAIT_MS, 2600));
          });
          if (gp) break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!gp) throw lastError ?? new Error("All GamePush SDK sources failed");
    } finally {
      try { delete globalThis[callbackName]; } catch (_error) { globalThis[callbackName] = undefined; }
    }
    this.gpLoadedDirectly = true;
    console.info(`[SlitherArena] GamePush ready: ${this.normalizePlatform(gp?.platform?.type)}`);
    return gp;
  }

  async initPlaygama() {
    let bridge = this.getPlaygama();
    const addonLoaded = !!globalThis.C3?.Plugins?.PlaygamaBridge;
    if (!bridge && addonLoaded) bridge = await this.waitFor(() => this.getPlaygama());

    if (!bridge && globalThis.document?.head) {
      bridge = await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-slither-playgama="1"]');
        if (existing) {
          this.waitFor(() => this.getPlaygama()).then((sdk) => sdk ? resolve(sdk) : reject(new Error("Playgama Bridge did not become ready")));
          return;
        }
        const script = document.createElement("script");
        script.async = true;
        script.dataset.slitherPlaygama = "1";
        script.src = "https://bridge.playgama.com/v1/stable/playgama-bridge.js";
        script.onload = () => this.waitFor(() => this.getPlaygama()).then(resolve);
        script.onerror = () => reject(new Error("Playgama Bridge script could not be loaded"));
        document.head.appendChild(script);
        setTimeout(() => reject(new Error("Playgama Bridge initialization timed out")), PLATFORM_SDK.SDK_WAIT_MS);
      });
    }
    if (!bridge) return null;
    bridge.engine = "construct";
    if (!bridge.isInitialized) {
      await bridge.initialize?.({ configFilePath: `./${PLATFORM_SDK.PLAYGAMA_CONFIG_PATH}` });
    }
    return bridge;
  }

  parseProgress(raw) {
    if (!raw) return null;
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch (_error) { return null; }
    }
    if (typeof raw === "object") return raw;
    return null;
  }

  async loadProgress() {
    const local = this.readLocal();
    await this.initialize();
    try {
      if (this.adapter?.loadProgress) {
        return sanitizeProgress((await this.adapter.loadProgress()) ?? local);
      }
      if (this.isPlaygama && this.pg?.storage?.get) {
        const values = await this.pg.storage.get([PLATFORM_SDK.STORAGE_KEY], "platform_internal");
        const saved = this.parseProgress(Array.isArray(values) ? values[0] : values?.[PLATFORM_SDK.STORAGE_KEY]);
        if (saved) return sanitizeProgress(saved);
      }
      if (this.gp?.player?.get) {
        const saved = this.parseProgress(this.gp.player.get(PLATFORM_SDK.STORAGE_KEY));
        if (saved) return sanitizeProgress(saved);
      }
    } catch (error) {
      console.warn("[SlitherArena] Cloud progress load failed; local progress is used.", error);
    }
    return sanitizeProgress(local);
  }

  async saveProgress(progress) {
    const clean = sanitizeProgress(progress);
    this.writeLocal(clean);
    await this.initialize();
    try {
      if (this.adapter?.saveProgress) {
        await this.adapter.saveProgress(clean);
        return true;
      }
      if (this.isPlaygama && this.pg?.storage?.set) {
        await this.pg.storage.set([PLATFORM_SDK.STORAGE_KEY], [JSON.stringify(clean)], "platform_internal");
        return true;
      }
      if (this.gp?.player?.set && this.gp?.player?.sync) {
        this.gp.player.set(PLATFORM_SDK.STORAGE_KEY, JSON.stringify(clean));
        await this.gp.player.sync({ storage: "cloud" });
        return true;
      }
    } catch (error) {
      console.warn("[SlitherArena] Cloud progress save failed; local copy kept.", error);
    }
    return false;
  }

  readLocal() {
    try {
      return JSON.parse(globalThis.localStorage?.getItem(CFG.SAVE_KEY) ?? "null");
    } catch (_error) {
      return null;
    }
  }

  writeLocal(progress) {
    try {
      globalThis.localStorage?.setItem(CFG.SAVE_KEY, JSON.stringify(progress));
    } catch (_error) {
      // Storage can be unavailable in a privacy-restricted iframe; gameplay still continues.
    }
  }

  isState(state, constant, word) {
    if (constant !== undefined && state === constant) return true;
    return String(state ?? "").toLowerCase().includes(word);
  }

  async showPlaygamaAd(kind, placement) {
    const bridge = this.pg ?? this.getPlaygama();
    const ads = bridge?.advertisement;
    if (!ads) return false;
    const eventName = kind === "rewarded" ? "rewarded_state_changed" : "interstitial_state_changed";
    const constants = kind === "rewarded" ? bridge.REWARDED_STATE : bridge.INTERSTITIAL_STATE;
    const show = kind === "rewarded" ? ads.showRewarded : ads.showInterstitial;
    if (typeof show !== "function") return false;

    return new Promise((resolve) => {
      let settled = false;
      let timeoutId = 0;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        try { ads.off?.(eventName, onState); } catch (_error) { /* no-op */ }
        resolve(value);
      };
      const onState = (state) => {
        if (kind === "rewarded" && this.isState(state, constants?.REWARDED, "rewarded")) {
          finish(true);
          return;
        }
        if (this.isState(state, constants?.FAILED, "failed")) finish(false);
        if (this.isState(state, constants?.CLOSED, "closed")) finish(kind !== "rewarded" ? true : false);
      };
      try {
        ads.on?.(eventName, onState);
        const result = show.call(ads, placement);
        Promise.resolve(result).then((value) => {
          if (value === true || value?.rewarded === true || value?.success === true) finish(true);
        }).catch(() => finish(false));
      } catch (error) {
        console.warn("[SlitherArena] Playgama ad call failed.", error);
        finish(false);
      }
      timeoutId = setTimeout(() => finish(false), 65000);
    });
  }

  async showRewarded(reason) {
    await this.initialize();
    try {
      if (this.adapter?.showRewarded) return (await this.adapter.showRewarded(reason)) === true;
      if (this.isPlaygama) return await this.showPlaygamaAd("rewarded", `slither_${reason}`);
      const gp = this.gp ?? this.getGamePush();
      if (gp?.ads?.showRewardedVideo) {
        const result = await gp.ads.showRewardedVideo({ showRewardedFailedOverlay: true });
        return result === true || result?.success === true || result?.rewarded === true;
      }
      if (CFG.DEBUG_FAKE_ADS) return globalThis.confirm?.("Тестовый rewarded-ролик завершён. Выдать награду?") === true;
    } catch (error) {
      console.warn("[SlitherArena] Rewarded ad failed.", error);
    }
    return false;
  }

  async showInterstitial() {
    await this.initialize();
    try {
      if (this.adapter?.showInterstitial) return (await this.adapter.showInterstitial()) === true;
      if (this.isPlaygama) return await this.showPlaygamaAd("interstitial", "slither_gameover");
      const gp = this.gp ?? this.getGamePush();
      if (gp?.ads?.showFullscreen) {
        if (gp.ads.isFullscreenAvailable === false) return false;
        const result = await gp.ads.showFullscreen({ showCountdownOverlay: true });
        return result === true || result?.success === true || result === undefined;
      }
    } catch (error) {
      console.warn("[SlitherArena] Interstitial ad failed.", error);
    }
    return false;
  }

  async setBannerVisible(visible) {
    if (this.bannerVisible === visible) return;
    this.bannerVisible = visible;
    // Keep Playgama banner disabled: the game is optimised for phone UI and gameplay has no safe banner area.
    if (this.isPlaygama) return;
    try {
      if (this.adapter?.setBannerVisible) {
        await this.adapter.setBannerVisible(visible);
        return;
      }
      const gp = this.gp ?? this.getGamePush();
      if (gp?.ads) {
        if (visible) await gp.ads.showSticky?.();
        else await gp.ads.closeSticky?.();
      }
    } catch (error) {
      console.warn("[SlitherArena] Banner update failed.", error);
    }
  }

  async purchaseSkin(sku) {
    await this.initialize();
    if (!this.supportsPurchases) return false;
    try {
      if (this.adapter?.purchaseSkin) return (await this.adapter.purchaseSkin(sku)) === true;
      const gp = this.gp ?? this.getGamePush();
      if (gp?.payments?.purchase) {
        const receipt = await gp.payments.purchase({ tag: sku });
        if (receipt === true || receipt?.success === true || receipt?.purchase || receipt?.product) return true;
        const own = gp.payments.has?.({ tag: sku }) ?? gp.payments.has?.(sku);
        return own === true;
      }
      if (CFG.DEBUG_FAKE_PURCHASES) return globalThis.confirm?.(`Тестовая покупка ${sku}: подтвердить?`) === true;
    } catch (error) {
      console.warn("[SlitherArena] Purchase failed.", error);
    }
    return false;
  }

  async gameplayStart() {
    await this.initialize();
    try {
      await this.adapter?.onGameplayStart?.();
      await (this.gp ?? this.getGamePush())?.gameplayStart?.();
      const bridge = this.pg ?? this.getPlaygama();
      if (this.isPlaygama && bridge?.platform?.sendMessage && bridge?.PLATFORM_MESSAGE?.GAMEPLAY_STARTED) {
        await bridge.platform.sendMessage(bridge.PLATFORM_MESSAGE.GAMEPLAY_STARTED);
      }
    } catch (error) {
      console.warn("[SlitherArena] gameplayStart failed.", error);
    }
  }

  async gameplayStop() {
    await this.initialize();
    try {
      await this.adapter?.onGameplayStop?.();
      await (this.gp ?? this.getGamePush())?.gameplayStop?.();
      const bridge = this.pg ?? this.getPlaygama();
      if (this.isPlaygama && bridge?.platform?.sendMessage && bridge?.PLATFORM_MESSAGE?.GAMEPLAY_STOPPED) {
        await bridge.platform.sendMessage(bridge.PLATFORM_MESSAGE.GAMEPLAY_STOPPED);
      }
    } catch (error) {
      console.warn("[SlitherArena] gameplayStop failed.", error);
    }
  }

  async pauseChanged(paused) {
    try {
      await this.adapter?.onPauseChanged?.(paused);
      const bridge = this.pg ?? this.getPlaygama();
      const message = paused ? bridge?.PLATFORM_MESSAGE?.LEVEL_PAUSED : bridge?.PLATFORM_MESSAGE?.LEVEL_RESUMED;
      if (this.isPlaygama && message) await bridge?.platform?.sendMessage?.(message);
    } catch (error) {
      console.warn("[SlitherArena] pauseChanged failed.", error);
    }
  }
}

class SlitherArena {
  constructor(runtime) {
    this.runtime = runtime;
    this.bridge = new PlatformBridge(runtime);
    this.progress = defaultProgress();
    this.root = null;
    this.canvas = null;
    this.ctx = null;
    this.ui = {};
    this.camera = { x: 0, y: 0, zoom: 1 };
    // Keep one source of truth for the actual backing-store pixel ratio.
    // Some phones report DPR=3+, while the canvas is intentionally capped at 2.
    this.dpr = 1;
    this.pointer = {
      angle: 0,
      boosting: false,
      active: false,
      lastTouchTapAt: 0,
      lastTouchX: 0,
      lastTouchY: 0,
      touchBoostHold: false,
      // In joystick mode the steering finger stays independent from the boost finger.
      pointerId: null,
      boostPointerId: null,
      joystickActive: false,
      joystickAnchorX: 0,
      joystickAnchorY: 0,
      joystickKnobX: 0,
      joystickKnobY: 0
    };
    this.keys = new Set();
    this.mode = "boot";
    this.running = false;
    this.paused = false;
    this.lastFrame = 0;
    this.elapsed = 0;
    this.playSecondsSinceInterstitial = 0;
    this.interstitialPending = false;
    this.reviveUsed = false;
    this.deathSnapshot = null;
    this.player = null;
    this.snakes = [];
    this.food = [];
    this.foodSpawnClock = 0;
    this.nextFoodId = 1;
    // Temporary high-value areas created when a snake dies. Bots can claim and contest them.
    this.lootPiles = [];
    this.nextLootPileId = 1;
    this.nextSnakeId = 1;
    this.respawnQueue = [];
    // Short-lived death echoes make a defeated rival dissolve into food instead of visually popping out.
    this.deathEchoes = [];
    this.collisionClock = 0;
    this.saveClock = 0;
    this.fps = 60;
    this.fpsClock = 0;
    this.fpsFrames = 0;
    this.seed = Math.random() * 99999;
    this.resumeAfterShop = false;
    this.ambientDots = Array.from({ length: 120 }, (_, index) => {
      const seed = hash32(`ambient:${index}`);
      return {
        x: ((seed & 1023) / 1023) * CFG.WORLD_SIZE - CFG.WORLD_SIZE / 2,
        y: (((seed >>> 10) & 1023) / 1023) * CFG.WORLD_SIZE - CFG.WORLD_SIZE / 2,
        r: 0.8 + ((seed >>> 20) & 15) / 12,
        phase: ((seed >>> 4) & 255) / 255 * TAU,
        hue: ["#74c0fc", "#b2f2bb", "#d0bfff", "#ffd8a8"][seed % 4]
      };
    });
    // Tiny fireflies are cosmetic only: they make quiet regions feel inhabited without adding collision work.
    this.fireflies = Array.from({ length: 66 }, (_, index) => {
      const seed = hash32(`firefly:${index}`);
      return {
        x: ((seed & 2047) / 2047) * CFG.WORLD_SIZE - CFG.WORLD_SIZE / 2,
        y: (((seed >>> 11) & 2047) / 2047) * CFG.WORLD_SIZE - CFG.WORLD_SIZE / 2,
        r: 1 + ((seed >>> 22) & 7) * .13,
        phase: ((seed >>> 3) & 255) / 255 * TAU,
        drift: .30 + ((seed >>> 19) & 31) / 42,
        hue: ["#b2f2bb", "#74c0fc", "#ffd6a5", "#eebefa"][seed % 4]
      };
    });
    this.shopPage = 0;
    this.missionPage = 0;
    this.matchStats = { seconds: 0, food: 0, peakMass: 0, kills: 0 };
    this.dailySecondAccumulator = 0;
    this.missionSecondAccumulator = 0;
    this.energyBeacons = Array.from({ length: 24 }, (_, index) => {
      const seed = hash32(`beacon:${index}`);
      return {
        x: ((seed & 2047) / 2047) * CFG.WORLD_SIZE - CFG.WORLD_SIZE / 2,
        y: (((seed >>> 11) & 2047) / 2047) * CFG.WORLD_SIZE - CFG.WORLD_SIZE / 2,
        phase: ((seed >>> 4) & 255) / 255 * TAU,
        hue: ["#74c0fc", "#b2f2bb", "#eebefa", "#ffe066"][seed % 4]
      };
    });
  }

  async start() {
    this.createDom();
    this.bindInput();
    this.resize();
    this.updateControlHint();
    globalThis.addEventListener?.("resize", () => { this.resize(); this.updateControlHint(); });
    this.runtime?.addEventListener?.("resize", () => { this.resize(); this.updateControlHint(); });

    // Render the local menu immediately. A blocked third-party SDK must never leave the
    // player on a blank loading screen inside VK/OK or during a slow social-platform launch.
    this.progress = sanitizeProgress(this.bridge.readLocal() ?? defaultProgress());
    this.ensureDailyProgress();
    this.ensureMissionProgress();
    this.syncUi();
    this.showMenu();
    this.loop(performance.now());

    void (async () => {
      const initialized = await this.bridge.initialize();
      if (!initialized) return;
      const cloud = await this.bridge.loadProgress();
      // Avoid replacing a match that has already started while the SDK was initializing.
      if (!this.running && this.screen === "menu") {
        this.progress = cloud;
        this.ensureDailyProgress();
        this.ensureMissionProgress();
        this.syncUi();
        this.showMenu();
      }
    })();
  }

  createDom() {
    document.getElementById("slither-arena-root")?.remove();
    this.root = document.createElement("div");
    this.root.id = "slither-arena-root";
    this.root.innerHTML = `
      <style>
        #slither-arena-root { position:fixed; inset:0; z-index:2147482000; overflow:hidden; touch-action:none; user-select:none; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#f8fbff; }
        #slither-arena-root * { box-sizing:border-box; }
        .sa-shell { position:absolute; inset:0; overflow:hidden; background:#09111e; }
        #sa-canvas { position:absolute; inset:0; display:block; width:100%; height:100%; cursor:crosshair; }
        .sa-top { position:absolute; left:clamp(10px,2.2vw,28px); right:clamp(10px,2.2vw,28px); top:clamp(10px,2.2vw,22px); display:flex; align-items:flex-start; justify-content:space-between; gap:12px; pointer-events:none; }
        .sa-hud-card { min-width:174px; padding:11px 14px; border:1px solid rgba(255,255,255,.14); border-radius:18px; background:linear-gradient(135deg,rgba(17,31,52,.82),rgba(8,16,29,.70)); box-shadow:0 16px 42px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.08); backdrop-filter:blur(14px) saturate(1.25); }
        .sa-hud-label { display:block; color:#b8c7dd; font-size:10px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
        .sa-score-row { display:flex; align-items:baseline; gap:10px; margin-top:2px; }
        .sa-score-row strong { font-size:clamp(25px,4vw,34px); line-height:1; letter-spacing:-.055em; }
        .sa-score-row span { color:#bcd1ec; font-size:12px; font-weight:750; }
        .sa-rank { display:block; margin-top:6px; color:#dbe7f8; font-size:12px; font-weight:700; }
        .sa-controls { display:flex; gap:8px; pointer-events:auto; }
        .sa-icon-btn,.sa-btn,.sa-skin { border:0; color:#fff; cursor:pointer; font:inherit; -webkit-tap-highlight-color:transparent; }
        .sa-icon-btn { height:44px; min-width:44px; padding:0 13px; border:1px solid rgba(255,255,255,.14); border-radius:14px; background:rgba(12,22,38,.82); box-shadow:0 12px 30px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.07); font-weight:850; font-size:14px; transition:transform .15s ease,background .15s ease; }
        .sa-icon-btn.compact { width:44px; padding:0; font-size:20px; }
        .sa-icon-btn:active,.sa-btn:active,.sa-skin:active { transform:translateY(1px) scale(.985); }
        .sa-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:clamp(12px,3vw,28px); background:radial-gradient(circle at 50% 25%,rgba(34,55,92,.36),rgba(4,8,15,.72) 65%); opacity:0; visibility:hidden; pointer-events:none; transition:opacity .2s ease,visibility .2s ease; }
        .sa-overlay.visible { opacity:1; visibility:visible; pointer-events:auto; }
        .sa-panel { position:relative; width:min(522px,100%); max-height:calc(100vh - 28px); overflow:auto; padding:clamp(20px,4vw,32px); border:1px solid rgba(255,255,255,.14); border-radius:28px; background:linear-gradient(145deg,rgba(27,42,68,.96),rgba(10,18,32,.98) 68%); box-shadow:0 28px 85px rgba(0,0,0,.52),inset 0 1px rgba(255,255,255,.10); scrollbar-width:none; }
        .sa-panel::-webkit-scrollbar { width:0; height:0; }
        .sa-panel::before { content:""; position:absolute; width:250px; height:250px; right:-135px; top:-150px; border-radius:50%; background:radial-gradient(circle,rgba(100,149,237,.25),transparent 68%); pointer-events:none; }
        .sa-brand { position:relative; margin:0 0 6px; color:#8ed6ff; font-size:11px; font-weight:900; letter-spacing:.18em; text-transform:uppercase; }
        .sa-title { position:relative; margin:0; font-size:clamp(32px,7vw,52px); line-height:.96; letter-spacing:-.065em; }
        .sa-subtitle { position:relative; margin:12px 0 20px; color:#c6d4e8; font-size:15px; line-height:1.42; }
        .sa-btn { position:relative; display:block; width:100%; padding:15px 17px; margin-top:10px; border-radius:16px; background:linear-gradient(135deg,#38bdf8,#5b73f0 58%,#845ef7); box-shadow:0 12px 26px rgba(64,116,245,.28),inset 0 1px rgba(255,255,255,.25); font-size:16px; font-weight:900; transition:transform .14s ease,filter .14s ease; }
        .sa-btn:hover,.sa-icon-btn:hover { filter:brightness(1.08); }
        .sa-btn.secondary { background:rgba(255,255,255,.075); box-shadow:inset 0 1px rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.13); }
        .sa-btn.video { background:linear-gradient(135deg,#ff9f1c,#ff6b6b); box-shadow:0 12px 26px rgba(255,107,107,.24),inset 0 1px rgba(255,255,255,.25); }
        .sa-btn.disabled,.sa-btn:disabled { opacity:.42; cursor:not-allowed; filter:grayscale(.7); }
        .sa-stat-row { position:relative; display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin:18px 0 2px; }
        .sa-stat { padding:11px; min-height:64px; border:1px solid rgba(255,255,255,.08); border-radius:15px; background:rgba(255,255,255,.055); }
        .sa-stat small { display:block; color:#a9bbd3; font-size:10px; font-weight:750; text-transform:uppercase; letter-spacing:.08em; }
        .sa-stat strong { display:block; margin-top:3px; font-size:20px; letter-spacing:-.04em; }
        .sa-feature-preview { position:relative; display:block; width:100%; height:132px; margin:16px 0 6px; border:1px solid rgba(255,255,255,.10); border-radius:19px; background:rgba(4,10,20,.32); }
        .sa-shop-grid { position:relative; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:16px; min-width:0; }
        .sa-skin { min-width:0; min-height:183px; overflow:hidden; contain:layout paint; padding:9px; border:1px solid rgba(255,255,255,.11); border-radius:18px; background:rgba(255,255,255,.045); text-align:left; transition:transform .15s ease,background .15s ease,border-color .15s ease; }
        .sa-skin:hover { background:rgba(255,255,255,.085); }
        .sa-skin.selected { border-color:#85d7ff; box-shadow:0 0 0 2px rgba(133,215,255,.25),0 10px 25px rgba(37,171,255,.12); background:rgba(68,170,246,.12); }
        .sa-skin.locked { opacity:.90; }
        .sa-skin-preview { display:block !important; box-sizing:border-box !important; inline-size:100% !important; width:100% !important; max-inline-size:100% !important; max-width:100% !important; block-size:82px !important; height:82px !important; min-width:0 !important; border-radius:12px; background:rgba(5,11,21,.36); clip-path:inset(0 round 12px); }
        .sa-skin-name { display:block; min-width:0; margin:8px 3px 0; font-weight:900; font-size:14px; }
        .sa-skin-meta { display:block; min-width:0; margin:4px 3px 1px; color:#b6c7dd; font-size:11px; font-weight:650; line-height:1.28; }
        .sa-skin-meta b { display:block; color:#f5f9ff; font-size:10px; font-weight:900; letter-spacing:.045em; text-transform:uppercase; }
        .sa-skin-meta em { display:block; margin-top:2px; color:#b6c7dd; font-style:normal; }
        .sa-bottom { position:absolute; left:12px; right:12px; bottom:14px; display:flex; justify-content:center; pointer-events:none; }
        .sa-hint { padding:9px 13px; border:1px solid rgba(255,255,255,.10); border-radius:999px; background:rgba(8,16,29,.66); box-shadow:0 8px 25px rgba(0,0,0,.2); color:#d2deee; font-size:12px; font-weight:650; backdrop-filter:blur(9px); }
        .sa-toast { position:absolute; left:50%; top:86px; max-width:min(420px,calc(100vw - 24px)); transform:translate(-50%,-10px); opacity:0; pointer-events:none; padding:11px 14px; border:1px solid rgba(255,255,255,.13); border-radius:14px; background:rgba(10,20,35,.93); box-shadow:0 14px 38px rgba(0,0,0,.35); transition:opacity .18s ease,transform .18s ease; color:#f4f8ff; font-size:14px; font-weight:800; text-align:center; }
        .sa-toast.visible { opacity:1; transform:translate(-50%,0); }
        /* The shop is paginated, so menu panels do not need visual scroll bars. */
        .sa-panel { overflow:hidden !important; scrollbar-width:none; }
        .sa-panel::-webkit-scrollbar { width:0; height:0; display:none; }
        .sa-pause-btn { display:grid; place-items:center; border-radius:15px; background:linear-gradient(145deg,rgba(34,58,93,.96),rgba(10,20,36,.94)); }
        .sa-pause-btn svg { width:20px; height:20px; filter:drop-shadow(0 2px 4px rgba(0,0,0,.35)); }
        .sa-pause-btn rect { fill:#edf7ff; }
        .sa-shop-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:14px 0 11px; }
        .sa-skin { display:grid; grid-template-rows:76px minmax(0,1fr); min-height:157px; padding:8px; overflow:hidden; contain:paint; }
        .sa-skin-preview { inline-size:100% !important; width:100% !important; max-inline-size:100% !important; max-width:100% !important; block-size:76px !important; height:76px !important; min-width:0 !important; }
        .sa-skin-info { display:block; min-width:0; padding:6px 3px 1px; overflow:hidden; }
        .sa-skin-name { display:block; margin:0; overflow:hidden; color:#f7fbff; font-weight:900; font-size:14px; line-height:1.12; text-overflow:ellipsis; white-space:nowrap; }
        .sa-skin-meta { display:block; margin:4px 0 0; color:#b6c7dd; font-size:10px; font-weight:650; line-height:1.23; }
        .sa-skin-meta b { display:block; color:#f5f9ff; font-size:10px; font-weight:900; letter-spacing:.045em; text-transform:uppercase; }
        .sa-skin-meta em { display:block; margin-top:2px; color:#b6c7dd; font-style:normal; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sa-shop-nav { display:grid; grid-template-columns:46px minmax(0,1fr) 46px; align-items:center; gap:9px; margin-top:4px; }
        .sa-shop-nav .sa-page-btn { height:42px; padding:0; margin:0; border-radius:13px; font-size:25px; line-height:1; }
        .sa-page-label { display:block; color:#b9c9de; font-size:12px; font-weight:800; text-align:center; }
        .sa-shop-back { margin-top:10px; }
        @media (max-width:620px) {
          .sa-shop-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:12px; }
          .sa-skin { grid-template-rows:72px minmax(0,1fr); min-height:150px; padding:7px; border-radius:16px; }
          .sa-skin-preview { block-size:72px !important; height:72px !important; }
          .sa-skin-name { font-size:13px; }
          .sa-skin-meta { font-size:9px; }
          .sa-skin-meta b { font-size:9px; }
        }
        @media (max-height:720px) {
          .sa-panel { padding:18px 20px; }
          .sa-title { font-size:34px; }
          .sa-subtitle { margin:8px 0 12px; font-size:13px; }
          .sa-skin { min-height:138px; grid-template-rows:64px minmax(0,1fr); }
          .sa-skin-preview { block-size:64px !important; height:64px !important; }
          .sa-skin-meta em { display:none; }
        }
        @media (max-width:620px) { .sa-top { gap:8px; } .sa-hud-card { min-width:132px; padding:9px 11px; border-radius:15px; } .sa-score-row strong { font-size:24px; } .sa-icon-btn:not(.compact) { width:44px; padding:0; font-size:0; } .sa-icon-btn:not(.compact)::after { content:"✦"; font-size:19px; } .sa-panel { border-radius:23px; } .sa-stat { padding:9px; } .sa-stat strong { font-size:18px; } .sa-bottom { bottom:8px; } .sa-hint { font-size:11px; padding:8px 11px; } }

        /* v0.6: shop cards keep the unlock text inside every card at all viewport heights. */
        .sa-shop-panel { width:min(548px,100%); max-height:calc(100vh - 16px); padding:16px; overflow:hidden !important; }
        .sa-shop-panel .sa-brand { margin-bottom:4px; }
        .sa-shop-panel .sa-title { font-size:clamp(30px,6vw,42px); }
        .sa-shop-panel .sa-subtitle { margin:7px 0 10px; font-size:12px; line-height:1.32; }
        .sa-shop-grid { display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin:0 0 9px !important; }
        .sa-skin { display:flex !important; flex-direction:column; justify-content:flex-start; min-height:142px !important; padding:7px !important; overflow:hidden !important; border-radius:17px; contain:paint; }
        .sa-skin-preview-wrap { position:relative; display:block; flex:0 0 64px; height:64px; min-height:64px; overflow:hidden; border-radius:12px; }
        .sa-skin-preview { display:block !important; width:100% !important; min-width:0 !important; max-width:100% !important; height:64px !important; min-height:64px !important; max-height:64px !important; border-radius:12px; }
        .sa-skin-info { position:relative; z-index:2; display:block !important; flex:1 1 auto; min-height:0; padding:6px 2px 0 !important; overflow:visible !important; }
        .sa-skin-name { display:block !important; overflow:hidden; margin:0 !important; color:#f7fbff; font-size:13px !important; font-weight:900; line-height:1.05; text-overflow:ellipsis; white-space:nowrap; }
        .sa-skin-meta { display:block !important; margin:4px 0 0 !important; color:#b6c7dd; font-size:10px !important; font-weight:700; line-height:1.15; }
        .sa-skin-meta b { display:block !important; color:#f5f9ff; font-size:10px !important; font-weight:900; letter-spacing:.035em; text-transform:uppercase; white-space:nowrap; }
        .sa-skin-meta em { display:block !important; margin-top:2px; color:#b6c7dd; font-size:9px; font-style:normal; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sa-lock-badge { position:absolute; z-index:4; right:7px; top:7px; display:grid; place-items:center; width:27px; height:27px; border:1px solid rgba(255,255,255,.28); border-radius:10px; background:rgba(5,12,23,.78); box-shadow:0 6px 18px rgba(0,0,0,.35); color:#fff; font-size:14px; }
        .sa-owned-badge { position:absolute; z-index:4; right:7px; top:7px; display:grid; place-items:center; width:25px; height:25px; border-radius:50%; background:rgba(71,220,158,.18); border:1px solid rgba(151,255,208,.42); color:#c9ffe3; font-size:13px; font-weight:900; }
        .sa-skin.locked .sa-skin-preview { filter:saturate(.72) brightness(.76); }
        .sa-skin.locked .sa-skin-preview-wrap::after { content:""; position:absolute; inset:0; z-index:3; background:linear-gradient(135deg,rgba(7,12,23,.04),rgba(7,12,23,.38)); pointer-events:none; }
        .sa-skin.selected .sa-skin-preview-wrap::before { content:"ВЫБРАНО"; position:absolute; left:7px; bottom:6px; z-index:5; padding:3px 5px; border-radius:6px; background:rgba(23,122,177,.78); color:#e8fbff; font-size:8px; font-weight:900; letter-spacing:.08em; }
        .sa-shop-nav { grid-template-columns:42px minmax(0,1fr) 42px; gap:8px; margin-top:0; }
        .sa-shop-nav .sa-page-btn { height:37px; border-radius:12px; font-size:24px; }
        .sa-shop-back { margin-top:8px; padding:11px 14px; border-radius:14px; }
        .sa-pause-btn { background:linear-gradient(145deg,rgba(67,99,144,.98),rgba(15,27,48,.96)); }
        .sa-pause-btn svg { width:21px; height:21px; }
        .sa-pause-btn rect { fill:#edf7ff; }
        .sa-pause-btn path { fill:#edf7ff; }
        .sa-league-card { position:relative; display:grid; gap:7px; margin:16px 0 2px; padding:12px; border:1px solid rgba(138,211,255,.19); border-radius:16px; background:linear-gradient(135deg,rgba(69,107,168,.20),rgba(38,22,94,.17)); box-shadow:inset 0 1px rgba(255,255,255,.09); }
        .sa-league-kicker { color:#8ed6ff; font-size:10px; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
        .sa-league-title { color:#f6fbff; font-size:14px; font-weight:900; }
        .sa-league-row { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#c8d7ea; font-size:11px; font-weight:750; }
        .sa-progress-bar { height:7px; overflow:hidden; border-radius:999px; background:rgba(255,255,255,.10); }
        .sa-progress-bar > i { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#67e8f9,#818cf8,#c084fc); box-shadow:0 0 13px rgba(129,140,248,.65); }
        @media (max-height:640px) { .sa-shop-panel { padding:13px; } .sa-shop-panel .sa-brand { font-size:10px; } .sa-shop-panel .sa-title { font-size:31px; } .sa-shop-panel .sa-subtitle { margin:5px 0 7px; font-size:11px; } .sa-skin { min-height:132px !important; padding:6px !important; } .sa-skin-preview-wrap,.sa-skin-preview { height:58px !important; min-height:58px !important; max-height:58px !important; flex-basis:58px; } .sa-skin-info { padding-top:5px !important; } .sa-skin-meta em { display:block !important; } .sa-shop-back { margin-top:6px; padding:9px 12px; } }
        .sa-mission-teaser { position:relative; display:flex; align-items:center; justify-content:space-between; gap:12px; margin:10px 0 2px; padding:11px 12px; border:1px solid rgba(195,154,255,.22); border-radius:16px; background:linear-gradient(135deg,rgba(103,76,187,.19),rgba(33,79,137,.16)); }
        .sa-mission-teaser strong { display:block; color:#fbf8ff; font-size:13px; }
        .sa-mission-teaser span { display:block; margin-top:2px; color:#cdbde9; font-size:11px; font-weight:750; }
        .sa-mission-mini { min-width:76px; padding:7px 9px; border:1px solid rgba(255,255,255,.14); border-radius:12px; background:rgba(10,15,34,.38); color:#f5efff; font-size:11px; font-weight:900; text-align:center; }
        .sa-mission-grid { position:relative; display:grid; gap:10px; margin:14px 0 8px; }
        .sa-mission-card { position:relative; min-height:90px; padding:13px 14px 12px 48px; border:1px solid rgba(255,255,255,.12); border-radius:17px; background:rgba(255,255,255,.05); overflow:hidden; }
        .sa-mission-card.complete { border-color:rgba(128,255,204,.36); background:linear-gradient(135deg,rgba(54,197,147,.17),rgba(32,76,118,.14)); }
        .sa-mission-mark { position:absolute; left:13px; top:15px; display:grid; place-items:center; width:25px; height:25px; border:1px solid rgba(255,255,255,.20); border-radius:9px; background:rgba(6,13,25,.45); color:#cbd9ee; font-size:13px; font-weight:900; }
        .sa-mission-card.complete .sa-mission-mark { color:#b9ffd9; border-color:rgba(130,255,206,.46); background:rgba(46,197,137,.18); }
        .sa-mission-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; }
        .sa-mission-head strong { color:#f6fbff; font-size:14px; }
        .sa-mission-head span { color:#9deed2; font-size:12px; font-weight:900; white-space:nowrap; }
        .sa-mission-card p { margin:6px 0 7px; color:#bac9df; font-size:11px; font-weight:700; }
        .sa-mission-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#c8d7ea; font-size:11px; font-weight:800; }

        /* v0.9: responsive menu. The home screen is intentionally a compact dashboard, not a tall feed. */
        .sa-menu-panel { width:min(520px,100%) !important; max-height:calc(100dvh - 16px) !important; min-height:0; padding:clamp(14px,2.8vw,22px) !important; overflow:hidden !important; }
        .sa-menu-hero { position:relative; display:grid; grid-template-columns:minmax(0,1fr) 126px; align-items:center; gap:12px; min-height:82px; }
        .sa-menu-copy { min-width:0; }
        .sa-menu-panel .sa-brand { margin:0 0 5px; }
        .sa-menu-panel .sa-title { font-size:clamp(31px,6.2vw,45px); }
        .sa-menu-panel .sa-subtitle { margin:7px 0 0; font-size:13px; line-height:1.28; }
        .sa-menu-preview { display:block !important; width:126px !important; min-width:0 !important; max-width:126px !important; height:82px !important; min-height:82px !important; max-height:82px !important; border:1px solid rgba(255,255,255,.11); border-radius:16px; background:rgba(4,10,20,.32); clip-path:inset(0 round 16px); }
        .sa-menu-progress { position:relative; display:grid; gap:8px; margin-top:10px; }
        .sa-menu-panel .sa-league-card { margin:0; padding:10px 11px; gap:5px; border-radius:15px; }
        .sa-menu-panel .sa-league-kicker { font-size:9px; }
        .sa-menu-panel .sa-league-title { font-size:13px; }
        .sa-menu-panel .sa-league-row { font-size:10px; }
        .sa-menu-panel .sa-mission-teaser { margin:0; min-height:0; padding:9px 10px; border-radius:14px; }
        .sa-menu-panel .sa-mission-teaser strong { font-size:12px; }
        .sa-menu-panel .sa-mission-teaser span { font-size:10px; }
        .sa-menu-panel .sa-mission-mini { min-width:64px; padding:5px 7px; border-radius:10px; font-size:10px; }
        .sa-menu-panel .sa-stat-row { margin:8px 0 0; gap:7px; }
        .sa-menu-panel .sa-stat { min-height:49px; padding:8px; border-radius:13px; }
        .sa-menu-panel .sa-stat small { font-size:9px; }
        .sa-menu-panel .sa-stat strong { margin-top:2px; font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sa-menu-actions { position:relative; display:grid; grid-template-columns:minmax(0,1.18fr) minmax(0,1fr); grid-template-rows:repeat(2,minmax(40px,auto)); gap:8px; margin-top:9px; }
        .sa-menu-actions .sa-btn { min-width:0; height:100%; margin:0; padding:10px 11px; border-radius:14px; font-size:13px; line-height:1.05; }
        .sa-menu-actions .sa-play { grid-row:span 2; font-size:16px; }
        @media (max-width:440px) {
          .sa-menu-hero { grid-template-columns:minmax(0,1fr) 104px; gap:9px; }
          .sa-menu-preview { width:104px !important; max-width:104px !important; height:72px !important; min-height:72px !important; max-height:72px !important; }
          .sa-menu-actions { grid-template-columns:1fr 1fr; grid-template-rows:auto auto; }
          .sa-menu-actions .sa-play { grid-column:span 2; grid-row:auto; min-height:44px; }
        }
        @media (max-height:710px) {
          .sa-menu-panel { padding:14px 16px !important; }
          .sa-menu-preview { height:68px !important; min-height:68px !important; max-height:68px !important; }
          .sa-menu-hero { min-height:68px; }
          .sa-menu-panel .sa-subtitle { font-size:12px; }
          .sa-menu-panel .sa-mission-teaser { padding:7px 9px; }
          .sa-menu-panel .sa-stat { min-height:43px; padding:6px 7px; }
          .sa-menu-panel .sa-stat strong { font-size:15px; }
        }
        @media (max-height:610px) {
          .sa-menu-panel { padding:12px 14px !important; }
          .sa-menu-preview { display:none !important; }
          .sa-menu-hero { grid-template-columns:1fr; min-height:0; }
          .sa-menu-panel .sa-title { font-size:31px; }
          .sa-menu-panel .sa-subtitle { margin-top:5px; font-size:11px; }
          .sa-menu-panel .sa-mission-teaser { display:none; }
          .sa-menu-panel .sa-stat-row { margin-top:6px; }
          .sa-menu-actions { margin-top:7px; }
        }
        @media (orientation:landscape) and (max-height:520px) {
          .sa-menu-panel .sa-league-card { padding:7px 9px; }
          .sa-menu-panel .sa-league-kicker { display:none; }
          .sa-menu-panel .sa-stat-row { display:none; }
          .sa-menu-actions .sa-btn { min-height:37px; padding:8px 10px; }
        }


        /* v0.10: phone-first menu. The home header uses a CSS emblem rather than
           a high-DPI canvas, so it cannot overlap the title or be repainted in the wrong grid cell. */
        .sa-overlay { padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left)); }
        .sa-menu-panel { width:min(520px,calc(100vw - 16px)) !important; max-height:calc(100dvh - 16px) !important; display:flex !important; flex-direction:column; gap:0; padding:clamp(13px,3.2vw,22px) !important; overflow:hidden !important; }
        .sa-menu-hero { display:flex !important; align-items:flex-start; justify-content:space-between; gap:12px; min-height:0 !important; }
        .sa-menu-copy { flex:1 1 auto; min-width:0; }
        .sa-menu-panel .sa-title { white-space:nowrap; font-size:clamp(28px,8.4vw,43px); letter-spacing:-.06em; }
        .sa-menu-panel .sa-subtitle { max-width:360px; }
        .sa-menu-emblem { position:relative; flex:0 0 64px; width:64px; height:64px; margin-top:1px; overflow:hidden; border:1px solid rgba(142,214,255,.28); border-radius:18px; background:radial-gradient(circle at 72% 24%,rgba(198,153,255,.48),transparent 20%),linear-gradient(145deg,rgba(62,100,164,.60),rgba(8,18,35,.82)); box-shadow:inset 0 1px rgba(255,255,255,.18),0 10px 24px rgba(0,0,0,.20); }
        .sa-menu-emblem::before { content:""; position:absolute; left:8px; top:28px; width:49px; height:14px; border-radius:999px; background:linear-gradient(90deg,#6be7d0,#b98aff 58%,#ef82f7); box-shadow:0 0 13px rgba(182,129,255,.65),inset 0 2px rgba(255,255,255,.45); transform:rotate(-17deg); }
        .sa-menu-emblem span { position:absolute; right:7px; top:18px; width:19px; height:19px; border-radius:50%; background:radial-gradient(circle at 34% 30%,#fff 0 9%,#f7d1ff 10% 22%,#d36df4 23% 100%); box-shadow:0 0 12px rgba(226,129,255,.75); }
        .sa-menu-emblem span::after { content:""; position:absolute; right:4px; top:7px; width:3px; height:3px; border-radius:50%; background:#203048; }
        .sa-menu-actions { margin-top:9px; }
        @media (max-width:400px) {
          .sa-menu-panel { width:calc(100vw - 12px) !important; padding:12px !important; }
          .sa-menu-hero { gap:9px; }
          .sa-menu-emblem { flex-basis:54px; width:54px; height:54px; border-radius:16px; }
          .sa-menu-emblem::before { left:6px; top:24px; width:42px; height:12px; }
          .sa-menu-emblem span { right:5px; top:16px; width:17px; height:17px; }
          .sa-menu-panel .sa-title { font-size:clamp(26px,8.2vw,34px); }
          .sa-menu-panel .sa-subtitle { font-size:12px; }
        }
        @media (max-height:650px) {
          .sa-menu-panel { padding:11px 13px !important; }
          .sa-menu-emblem { display:none; }
          .sa-menu-panel .sa-subtitle { display:none; }
          .sa-menu-panel .sa-menu-hero { min-height:0; }
          .sa-menu-progress { margin-top:7px; gap:6px; }
          .sa-menu-panel .sa-league-card { padding:8px 9px; }
          .sa-menu-panel .sa-mission-teaser { padding:7px 9px; }
          .sa-menu-panel .sa-stat-row { margin-top:6px; }
          .sa-menu-actions { margin-top:7px; }
        }
        @media (max-height:510px) {
          .sa-menu-panel .sa-brand { font-size:9px; }
          .sa-menu-panel .sa-title { font-size:29px; }
          .sa-menu-panel .sa-mission-teaser, .sa-menu-panel .sa-stat-row { display:none; }
          .sa-menu-panel .sa-league-card { padding:7px 8px; gap:4px; }
          .sa-menu-panel .sa-league-kicker { display:none; }
          .sa-menu-panel .sa-league-title { font-size:12px; }
          .sa-menu-actions .sa-btn { min-height:38px; padding:9px; }
        }
        @media (orientation:landscape) and (max-height:520px) {
          .sa-menu-panel { width:min(600px,calc(100vw - 16px)) !important; }
          .sa-menu-hero { display:block !important; }
          .sa-menu-panel .sa-brand { margin-bottom:2px; }
          .sa-menu-panel .sa-title { font-size:30px; }
        }
        .sa-menu-active .sa-top, .sa-menu-active .sa-bottom { opacity:0; visibility:hidden; pointer-events:none; }
        @media (pointer:coarse) and (max-width:620px) {
          .sa-top { left:8px; right:8px; top:8px; }
          .sa-hud-card { min-width:122px; padding:8px 10px; border-radius:14px; }
          .sa-rank { display:none; }
          .sa-icon-btn { height:40px; min-width:40px; border-radius:13px; }
          .sa-bottom { left:8px; right:8px; bottom:max(8px, env(safe-area-inset-bottom)); }
          .sa-hint { max-width:calc(100vw - 16px); text-align:center; font-size:10px; padding:7px 10px; }
        }


        /* v0.11: phones use compact, deliberate screens rather than tall feeds. */
        .sa-joystick { position:absolute; z-index:9; width:124px; height:124px; margin:-62px 0 0 -62px; pointer-events:none; opacity:0; transform:scale(.76); transition:opacity .12s ease,transform .12s ease; }
        .sa-joystick.visible { opacity:1; transform:scale(1); }
        .sa-joystick-ring { position:absolute; inset:6px; border:2px solid rgba(196,227,255,.36); border-radius:50%; background:radial-gradient(circle,rgba(52,92,148,.18),rgba(8,17,32,.46)); box-shadow:inset 0 0 28px rgba(110,184,255,.18),0 10px 32px rgba(0,0,0,.28); backdrop-filter:blur(6px); }
        .sa-joystick-ring::before,.sa-joystick-ring::after { content:""; position:absolute; left:50%; top:50%; background:rgba(210,235,255,.18); transform:translate(-50%,-50%); }
        .sa-joystick-ring::before { width:1px; height:72%; }
        .sa-joystick-ring::after { width:72%; height:1px; }
        .sa-joystick-knob { position:absolute; left:50%; top:50%; width:54px; height:54px; margin:-27px; border:1px solid rgba(240,251,255,.72); border-radius:50%; background:radial-gradient(circle at 35% 28%,#f5fbff 0 8%,#9bd7ff 9% 32%,#667eea 33% 100%); box-shadow:0 7px 20px rgba(67,112,255,.5),inset 0 1px rgba(255,255,255,.6); transition:transform .045s linear; }
        .sa-control-layout { position:relative; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; margin:12px 0 10px; }
        .sa-control-card { position:relative; min-height:172px; padding:12px; overflow:hidden; border:1px solid rgba(255,255,255,.13); border-radius:18px; background:rgba(255,255,255,.045); color:#f8fbff; text-align:left; }
        .sa-control-card.selected { border-color:#86dcff; background:linear-gradient(145deg,rgba(46,146,214,.21),rgba(95,72,196,.15)); box-shadow:0 0 0 2px rgba(133,215,255,.17),0 12px 28px rgba(25,113,194,.12); }
        .sa-control-card strong { position:relative; display:block; margin-top:7px; font-size:15px; font-weight:900; }
        .sa-control-card span { position:relative; display:block; margin-top:4px; color:#c7d5e8; font-size:11px; font-weight:700; line-height:1.3; }
        .sa-control-card .sa-control-check { position:absolute; right:10px; top:10px; display:grid; place-items:center; width:24px; height:24px; border:1px solid rgba(255,255,255,.22); border-radius:9px; background:rgba(6,13,25,.46); color:#d4f7ff; font-size:13px; font-weight:900; }
        .sa-control-demo { position:relative; display:block; width:100%; height:79px; overflow:hidden; border:1px solid rgba(145,214,255,.12); border-radius:13px; background:linear-gradient(145deg,rgba(9,25,47,.86),rgba(5,12,25,.92)); }
        .sa-control-demo .sa-demo-snake { position:absolute; left:13px; top:41px; width:78px; height:18px; border-radius:999px; background:linear-gradient(90deg,#6be7d0,#a8f1e1); box-shadow:0 0 13px rgba(99,230,190,.45),inset 0 2px rgba(255,255,255,.52); transform:rotate(-17deg); }
        .sa-control-demo .sa-demo-snake::after { content:""; position:absolute; right:-8px; top:-3px; width:24px; height:24px; border-radius:50%; background:radial-gradient(circle at 36% 30%,#fff 0 9%,#cbfff3 10% 26%,#56d6bc 27% 100%); }
        .sa-control-demo .sa-demo-target { position:absolute; right:17px; top:15px; width:31px; height:31px; border:2px solid rgba(182,220,255,.55); border-radius:50%; box-shadow:0 0 16px rgba(125,174,255,.36); }
        .sa-control-demo .sa-demo-target::before { content:""; position:absolute; left:50%; top:50%; width:7px; height:7px; border-radius:50%; background:#e9f7ff; transform:translate(-50%,-50%); }
        .sa-control-demo .sa-demo-arrow { position:absolute; right:27px; top:44px; width:32px; height:2px; background:#9fdcff; transform:rotate(138deg); transform-origin:right center; box-shadow:0 0 8px rgba(126,203,255,.72); }
        .sa-control-demo.joystick .sa-demo-pad { position:absolute; right:13px; bottom:10px; width:48px; height:48px; border:2px solid rgba(190,228,255,.42); border-radius:50%; background:rgba(65,112,184,.18); }
        .sa-control-demo.joystick .sa-demo-pad::before { content:""; position:absolute; left:11px; top:7px; width:21px; height:21px; border:1px solid rgba(255,255,255,.64); border-radius:50%; background:radial-gradient(circle at 35% 28%,#fff,#91cafc 38%,#6979e7 100%); box-shadow:0 4px 10px rgba(78,117,235,.48); }
        .sa-control-demo.joystick .sa-demo-arrow { right:42px; top:30px; width:27px; transform:rotate(-136deg); }
        .sa-control-note { position:relative; margin:0 0 7px; padding:9px 10px; border:1px solid rgba(138,211,255,.16); border-radius:13px; background:rgba(93,70,178,.12); color:#c8d9ef; font-size:11px; font-weight:750; line-height:1.35; }
        .sa-menu-mission-button { width:100%; border:0; color:inherit; font:inherit; text-align:left; cursor:pointer; -webkit-tap-highlight-color:transparent; }
        .sa-menu-mission-button:active { transform:translateY(1px); }
        .sa-menu-actions .sa-controls-btn { background:rgba(255,255,255,.055); }
        .sa-mission-pager { display:grid; grid-template-columns:42px minmax(0,1fr) 42px; align-items:center; gap:8px; margin:10px 0 0; }
        .sa-mission-pager .sa-btn { height:38px; margin:0; padding:0; border-radius:12px; font-size:22px; line-height:1; }
        .sa-mission-pager span { color:#b9c9de; font-size:11px; font-weight:800; text-align:center; }

        @media (pointer:coarse) and (max-width:700px) {
          .sa-overlay { align-items:center; padding:max(6px,env(safe-area-inset-top)) max(6px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left)); }
          .sa-panel { width:calc(100vw - 12px) !important; max-height:calc(100dvh - 12px) !important; min-height:0 !important; padding:12px !important; border-radius:21px; }
          .sa-title { font-size:clamp(29px,9vw,38px); }
          .sa-subtitle { margin:6px 0 9px; font-size:12px; line-height:1.30; }
          .sa-menu-panel { display:flex !important; flex-direction:column; width:calc(100vw - 12px) !important; height:calc(100dvh - 12px) !important; max-height:none !important; padding:12px !important; }
          .sa-menu-panel .sa-menu-hero { flex:0 0 auto; }
          .sa-menu-panel .sa-menu-progress { flex:0 0 auto; }
          .sa-menu-panel .sa-menu-actions { flex:0 0 auto; margin-top:auto; grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-rows:repeat(3,42px); gap:7px; }
          .sa-menu-panel .sa-menu-actions .sa-play { grid-column:span 2; grid-row:auto; min-height:42px; }
          .sa-menu-panel .sa-menu-actions .sa-btn { min-height:42px; padding:8px 9px; font-size:12px; }
          .sa-menu-panel .sa-menu-actions .sa-controls-btn { grid-column:span 2; }
          .sa-menu-panel .sa-menu-progress { margin-top:8px; gap:7px; }
          .sa-menu-panel .sa-league-card { padding:9px 10px; gap:4px; }
          .sa-menu-panel .sa-mission-teaser { padding:8px 9px; }
          .sa-menu-panel .sa-stat-row { margin:7px 0 0; }
          .sa-menu-panel .sa-stat { min-height:44px; padding:7px; }
          .sa-menu-panel .sa-stat strong { font-size:15px; }
          .sa-missions-panel { display:flex; flex-direction:column; height:calc(100dvh - 12px); max-height:none !important; }
          .sa-missions-panel .sa-mission-grid { flex:1 1 auto; min-height:0; margin:8px 0; }
          .sa-missions-panel .sa-mission-card { min-height:0; padding:11px 11px 10px 43px; border-radius:15px; }
          .sa-missions-panel .sa-mission-mark { left:10px; top:12px; }
          .sa-missions-panel .sa-mission-card p { margin:4px 0 6px; }
          .sa-missions-panel .sa-btn { padding:11px 12px; }
          .sa-controls-panel { display:flex; flex-direction:column; height:calc(100dvh - 12px); max-height:none !important; }
          .sa-controls-panel .sa-control-layout { flex:1 1 auto; min-height:0; margin:9px 0; }
          .sa-control-card { min-height:0; padding:9px; border-radius:16px; }
          .sa-control-demo { height:66px; }
          .sa-control-card strong { margin-top:6px; font-size:13px; }
          .sa-control-card span { font-size:10px; }
          .sa-control-note { margin-bottom:6px; padding:8px 9px; font-size:10px; }
          .sa-shop-panel { height:calc(100dvh - 12px); max-height:none !important; display:flex; flex-direction:column; }
          .sa-shop-panel .sa-shop-grid { flex:1 1 auto; min-height:0; align-content:stretch; }
          .sa-shop-panel .sa-shop-nav, .sa-shop-panel .sa-shop-back { flex:0 0 auto; }
        }
        @media (pointer:coarse) and (max-width:700px) and (max-height:620px) {
          .sa-menu-panel .sa-brand { font-size:9px; }
          .sa-menu-panel .sa-title { font-size:29px; }
          .sa-menu-panel .sa-subtitle, .sa-menu-panel .sa-mission-teaser, .sa-menu-panel .sa-stat-row { display:none; }
          .sa-menu-panel .sa-league-card { margin-top:4px; padding:8px 9px; }
          .sa-menu-panel .sa-league-kicker { display:none; }
          .sa-menu-panel .sa-league-title { font-size:12px; }
          .sa-menu-panel .sa-league-row { font-size:9px; }
          .sa-menu-panel .sa-menu-actions { grid-template-rows:repeat(3,39px); }
          .sa-menu-panel .sa-menu-actions .sa-btn { min-height:39px; }
          .sa-missions-panel .sa-brand, .sa-missions-panel .sa-subtitle { display:none; }
          .sa-missions-panel .sa-title { font-size:28px; }
          .sa-missions-panel .sa-mission-teaser { margin:5px 0 0; padding:7px 8px; }
          .sa-missions-panel .sa-mission-card { min-height:0; }
          .sa-shop-panel .sa-brand { font-size:9px; }
          .sa-shop-panel .sa-title { font-size:28px; }
          .sa-shop-panel .sa-subtitle { display:none; }
          .sa-shop-panel .sa-skin { min-height:116px !important; }
          .sa-shop-panel .sa-skin-preview-wrap,.sa-shop-panel .sa-skin-preview { height:50px !important; min-height:50px !important; max-height:50px !important; flex-basis:50px; }
          .sa-shop-panel .sa-skin-info { padding-top:4px !important; }
          .sa-shop-panel .sa-skin-meta em { display:none !important; }
          .sa-controls-panel .sa-brand { font-size:9px; }
          .sa-controls-panel .sa-title { font-size:28px; }
          .sa-controls-panel .sa-subtitle { display:none; }
          .sa-controls-panel .sa-control-note { display:none; }
          .sa-controls-panel .sa-control-demo { height:54px; }
        }
        @media (orientation:landscape) and (pointer:coarse) and (max-height:520px) {
          .sa-menu-panel { width:min(650px,calc(100vw - 12px)) !important; }
          .sa-menu-panel .sa-menu-hero { display:flex !important; }
          .sa-menu-panel .sa-menu-emblem { display:none; }
          .sa-menu-panel .sa-menu-actions { grid-template-columns:repeat(4,minmax(0,1fr)); grid-template-rows:42px; }
          .sa-menu-panel .sa-menu-actions .sa-play, .sa-menu-panel .sa-menu-actions .sa-controls-btn { grid-column:auto; }
          .sa-menu-panel .sa-menu-actions .sa-btn { min-height:42px; }
          .sa-missions-panel,.sa-controls-panel,.sa-shop-panel { width:min(650px,calc(100vw - 12px)) !important; }
        }

        @media (orientation:landscape) and (pointer:coarse) and (max-height:620px) {
          .sa-overlay { align-items:center; padding:6px; }
          .sa-missions-panel,.sa-controls-panel,.sa-shop-panel { width:min(650px,calc(100vw - 12px)) !important; height:calc(100dvh - 12px) !important; max-height:none !important; }
          .sa-missions-panel { display:flex; flex-direction:column; padding:11px 14px !important; }
          .sa-missions-panel .sa-brand,.sa-missions-panel .sa-subtitle { display:none; }
          .sa-missions-panel .sa-title { margin:0; font-size:30px; }
          .sa-missions-panel .sa-mission-teaser { margin:6px 0 0; padding:7px 9px; }
          .sa-missions-panel .sa-mission-teaser strong { font-size:12px; }
          .sa-missions-panel .sa-mission-teaser span { font-size:10px; }
          .sa-missions-panel .sa-mission-grid { flex:1 1 auto; min-height:0; margin:8px 0; }
          .sa-missions-panel .sa-mission-card { min-height:0; padding:10px 12px 9px 43px; }
          .sa-missions-panel .sa-mission-mark { left:10px; top:11px; }
          .sa-missions-panel .sa-mission-card p { margin:4px 0 5px; }
          .sa-missions-panel .sa-btn { margin-top:6px; padding:8px 11px; }
          .sa-controls-panel { display:flex; flex-direction:column; padding:11px 14px !important; }
          .sa-controls-panel .sa-brand,.sa-controls-panel .sa-subtitle,.sa-controls-panel .sa-control-note { display:none; }
          .sa-controls-panel .sa-title { font-size:30px; }
          .sa-controls-panel .sa-control-layout { flex:1 1 auto; min-height:0; margin:7px 0; }
          .sa-controls-panel .sa-control-card { min-height:0; padding:8px; }
          .sa-controls-panel .sa-control-demo { height:52px; }
          .sa-controls-panel .sa-control-card strong { margin-top:4px; font-size:13px; }
          .sa-controls-panel .sa-control-card span { font-size:10px; }
          .sa-controls-panel .sa-btn { margin-top:6px; padding:8px 11px; }
          .sa-shop-panel { padding:11px 14px !important; display:flex; flex-direction:column; }
          .sa-shop-panel .sa-brand,.sa-shop-panel .sa-subtitle { display:none; }
          .sa-shop-panel .sa-title { font-size:30px; }
          .sa-shop-panel .sa-shop-grid { flex:1 1 auto; min-height:0; margin:6px 0 !important; }
          .sa-shop-panel .sa-skin { min-height:106px !important; }
          .sa-shop-panel .sa-skin-preview-wrap,.sa-shop-panel .sa-skin-preview { height:47px !important; min-height:47px !important; max-height:47px !important; flex-basis:47px; }
          .sa-shop-panel .sa-skin-info { padding-top:4px !important; }
          .sa-shop-panel .sa-skin-meta em { display:none !important; }
          .sa-shop-panel .sa-shop-back { margin-top:6px; padding:8px 11px; }
        }


        /* v0.12: full mobile UI audit. Every overlay uses the visual viewport and has a compact,
           paged structure rather than relying on hidden overflow or browser scroll bars. */
        .sa-gameover-panel { width:min(500px,100%); }
        .sa-gameover-daily { position:relative; display:grid; gap:2px; margin:11px 0 0; padding:10px 11px; border:1px solid rgba(138,211,255,.18); border-radius:15px; background:linear-gradient(135deg,rgba(53,103,161,.20),rgba(55,33,107,.18)); }
        .sa-gameover-daily span { color:#90d9ff; font-size:10px; font-weight:900; letter-spacing:.06em; text-transform:uppercase; }
        .sa-gameover-daily strong { color:#f6fbff; font-size:13px; line-height:1.18; }
        .sa-gameover-daily small { color:#c9d8eb; font-size:10px; font-weight:750; }
        .sa-gameover-actions { position:relative; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:10px; }
        .sa-gameover-actions .sa-btn { min-width:0; margin:0; }
        .sa-gameover-actions .sa-primary { grid-column:1 / -1; }

        @media (pointer:coarse) and (max-width:700px) {
          .sa-overlay { align-items:center; padding:max(6px,env(safe-area-inset-top)) max(6px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-left)); }
          .sa-panel { width:calc(100vw - 12px) !important; height:calc(100dvh - 12px) !important; max-height:none !important; min-height:0 !important; padding:12px !important; overflow:hidden !important; border-radius:20px; }
          .sa-panel::before { display:none; }
          .sa-panel .sa-brand { margin:0 0 4px; font-size:9px; }
          .sa-panel .sa-title { margin:0; font-size:clamp(27px,8.4vw,36px); line-height:.98; }
          .sa-panel .sa-subtitle { margin:6px 0 8px; font-size:11px; line-height:1.28; }
          .sa-btn { min-height:42px; padding:9px 10px; font-size:12px; }

          /* Menu: preserve the dashboard but never rely on a crop below the fold. */
          .sa-menu-panel { display:flex !important; flex-direction:column; }
          .sa-menu-panel .sa-menu-actions { flex:0 0 auto; margin-top:auto; }

          /* Game over: essential information and exactly three reachable actions. */
          .sa-gameover-panel { display:flex !important; flex-direction:column; }
          .sa-gameover-panel .sa-subtitle { max-width:100%; }
          .sa-gameover-panel .sa-gameover-daily { flex:0 0 auto; margin-top:6px; padding:8px 9px; border-radius:13px; }
          .sa-gameover-panel .sa-gameover-daily strong { font-size:12px; }
          .sa-gameover-panel .sa-gameover-stats { flex:0 0 auto; margin:8px 0 0; gap:7px; }
          .sa-gameover-panel .sa-stat { min-height:48px; padding:7px; border-radius:13px; }
          .sa-gameover-panel .sa-stat small { font-size:8px; }
          .sa-gameover-panel .sa-stat strong { margin-top:1px; font-size:15px; }
          .sa-gameover-panel .sa-gameover-actions { flex:0 0 auto; margin-top:auto; gap:7px; }
          .sa-gameover-panel .sa-gameover-actions .sa-btn { min-height:40px; padding:8px 8px; }

          /* Missions are always a single, fully visible card per phone page. */
          .sa-missions-panel { display:flex !important; flex-direction:column; }
          .sa-missions-panel .sa-brand, .sa-missions-panel .sa-subtitle { display:none; }
          .sa-missions-panel .sa-title { flex:0 0 auto; font-size:29px; }
          .sa-missions-panel .sa-mission-teaser { flex:0 0 auto; margin:6px 0 0; padding:8px 9px; border-radius:13px; }
          .sa-missions-panel .sa-mission-teaser strong { font-size:12px; }
          .sa-missions-panel .sa-mission-teaser span { font-size:10px; }
          .sa-missions-panel .sa-mission-mini { min-width:60px; padding:5px 7px; font-size:10px; }
          .sa-missions-panel .sa-mission-grid { display:flex; flex:1 1 auto; min-height:0; margin:8px 0 7px; }
          .sa-missions-panel .sa-mission-card { display:flex; flex:1 1 auto; flex-direction:column; min-height:0; height:100%; padding:11px 11px 10px 42px; border-radius:15px; }
          .sa-missions-panel .sa-mission-mark { left:10px; top:11px; width:23px; height:23px; }
          .sa-missions-panel .sa-mission-head strong { font-size:13px; }
          .sa-missions-panel .sa-mission-card p { margin:5px 0 7px; font-size:10px; }
          .sa-missions-panel .sa-mission-footer { margin-top:auto; font-size:10px; }
          .sa-missions-panel .sa-mission-pager { flex:0 0 auto; margin:0 0 6px; }
          .sa-missions-panel > .sa-btn { flex:0 0 auto; margin-top:6px; min-height:39px; }

          /* Settings: two visual choices remain visible without a long explanatory feed. */
          .sa-controls-panel { display:flex !important; flex-direction:column; }
          .sa-controls-panel .sa-subtitle { display:none; }
          .sa-controls-panel .sa-title { font-size:29px; }
          .sa-controls-panel .sa-control-note { flex:0 0 auto; margin:5px 0 6px; padding:7px 8px; font-size:10px; }
          .sa-controls-panel .sa-control-layout { flex:1 1 auto; min-height:0; margin:0 0 7px; gap:8px; }
          .sa-controls-panel .sa-control-card { min-height:0; padding:8px; border-radius:15px; }
          .sa-controls-panel .sa-control-demo { height:58px; }
          .sa-controls-panel .sa-control-card strong { margin-top:5px; font-size:12px; }
          .sa-controls-panel .sa-control-card span { margin-top:3px; font-size:9px; line-height:1.25; }
          .sa-controls-panel > .sa-btn { flex:0 0 auto; margin-top:0; }

          /* Shop stays paged; controls and navigation get a fixed, always-visible footer. */
          .sa-shop-panel { display:flex !important; flex-direction:column; }
          .sa-shop-panel .sa-subtitle { margin:5px 0 7px; font-size:10px; }
          .sa-shop-panel .sa-shop-grid { flex:1 1 auto; min-height:0; align-content:stretch; }
          .sa-shop-panel .sa-shop-nav, .sa-shop-panel .sa-shop-back { flex:0 0 auto; }

          .sa-pause-panel { width:min(390px,calc(100vw - 12px)) !important; height:auto !important; max-height:calc(100dvh - 12px) !important; display:block !important; }
          .sa-pause-panel .sa-subtitle { margin-bottom:10px; }
        }

        @media (orientation:landscape) and (pointer:coarse) and (max-height:620px) {
          .sa-panel::before { display:none; }
        }

        @media (orientation:landscape) and (pointer:coarse) and (max-height:620px) {
          .sa-gameover-panel { width:min(500px,calc(100vw - 12px)) !important; height:calc(100dvh - 12px) !important; max-height:none !important; display:flex !important; flex-direction:column; padding:10px 13px !important; }
          .sa-gameover-panel .sa-brand { display:none; }
          .sa-gameover-panel .sa-title { font-size:26px; }
          .sa-gameover-panel .sa-subtitle { margin:3px 0 5px; font-size:10px; }
          .sa-gameover-panel .sa-gameover-daily { margin:0; padding:6px 8px; }
          .sa-gameover-panel .sa-gameover-daily span { font-size:8px; }
          .sa-gameover-panel .sa-gameover-daily strong { font-size:11px; }
          .sa-gameover-panel .sa-gameover-daily small { font-size:9px; }
          .sa-gameover-panel .sa-gameover-stats { margin:6px 0 0; }
          .sa-gameover-panel .sa-stat { min-height:42px; padding:5px 7px; }
          .sa-gameover-panel .sa-stat small { font-size:8px; }
          .sa-gameover-panel .sa-stat strong { font-size:14px; }
          .sa-gameover-panel .sa-gameover-actions { margin-top:auto; gap:6px; }
          .sa-gameover-panel .sa-gameover-actions .sa-btn { min-height:34px; padding:7px 8px; font-size:10px; }
        }

        @media (pointer:coarse) and (max-width:360px) {
          .sa-menu-panel .sa-menu-emblem { display:none !important; }
          .sa-menu-panel .sa-menu-hero { display:block !important; }
          .sa-menu-panel .sa-title { white-space:normal; font-size:clamp(25px,8vw,31px); }
        }

        @media (pointer:coarse) and (max-width:700px) and (max-height:560px) {
          .sa-panel { padding:10px !important; border-radius:18px; }
          .sa-panel .sa-title { font-size:27px; }
          .sa-gameover-panel .sa-brand { display:none; }
          .sa-gameover-panel .sa-title { font-size:27px; }
          .sa-gameover-panel .sa-subtitle { margin:4px 0 6px; font-size:10px; }
          .sa-gameover-panel .sa-gameover-daily { margin-top:0; padding:7px 8px; }
          .sa-gameover-panel .sa-gameover-daily span { font-size:8px; }
          .sa-gameover-panel .sa-gameover-daily strong { font-size:11px; }
          .sa-gameover-panel .sa-gameover-daily small { font-size:9px; }
          .sa-gameover-panel .sa-gameover-stats { margin-top:6px; }
          .sa-gameover-panel .sa-stat { min-height:44px; padding:6px; }
          .sa-gameover-panel .sa-gameover-actions .sa-btn { min-height:37px; font-size:11px; }

          .sa-missions-panel .sa-title { font-size:26px; }
          .sa-missions-panel .sa-mission-teaser { padding:6px 8px; }
          .sa-missions-panel .sa-mission-grid { margin:6px 0; }
          .sa-missions-panel .sa-mission-card { padding:9px 10px 8px 39px; }
          .sa-missions-panel .sa-mission-mark { left:9px; top:9px; }
          .sa-missions-panel > .sa-btn { min-height:35px; margin-top:4px; }

          .sa-controls-panel .sa-brand, .sa-controls-panel .sa-control-note { display:none; }
          .sa-controls-panel .sa-title { font-size:26px; }
          .sa-controls-panel .sa-control-demo { height:47px; }
          .sa-controls-panel .sa-control-card span { font-size:8px; }

          .sa-shop-panel .sa-brand { display:none; }
          .sa-shop-panel .sa-title { font-size:26px; }
          .sa-shop-panel .sa-subtitle { display:none; }
        }

        /* v0.13: mission cards have a fixed, readable compact rhythm on phones.
           The help strip is desktop-only so it never covers the lower arena on touch devices. */
        @media (pointer:coarse) {
          .sa-bottom { display:none !important; }
        }
        @media (pointer:coarse) and (max-width:700px) {
          .sa-missions-panel .sa-mission-grid {
            flex:0 0 auto !important;
            height:clamp(154px, 36dvh, 218px) !important;
            min-height:0 !important;
            margin:8px 0 7px !important;
          }
          .sa-missions-panel .sa-mission-card {
            display:flex !important;
            flex-direction:column !important;
            height:100% !important;
            min-height:0 !important;
            padding:11px 12px 10px 43px !important;
            overflow:hidden !important;
          }
          .sa-missions-panel .sa-mission-head {
            align-items:flex-start !important;
            gap:7px !important;
          }
          .sa-missions-panel .sa-mission-head strong {
            min-width:0 !important;
            flex:1 1 auto !important;
            overflow-wrap:anywhere !important;
            white-space:normal !important;
            line-height:1.14 !important;
          }
          .sa-missions-panel .sa-mission-head span {
            flex:0 0 auto !important;
            white-space:nowrap !important;
            font-size:11px !important;
          }
          .sa-missions-panel .sa-mission-card p {
            display:block !important;
            min-height:14px !important;
            margin:5px 0 6px !important;
            overflow-wrap:anywhere !important;
            white-space:normal !important;
            line-height:1.22 !important;
          }
          .sa-missions-panel .sa-mission-footer {
            display:flex !important;
            flex-wrap:wrap !important;
            align-items:flex-end !important;
            gap:2px 8px !important;
            margin-top:auto !important;
            line-height:1.15 !important;
          }
          .sa-missions-panel .sa-mission-footer span:last-child {
            margin-left:auto !important;
            max-width:58% !important;
            text-align:right !important;
            overflow-wrap:anywhere !important;
            white-space:normal !important;
          }
          .sa-missions-panel .sa-progress-bar { flex:0 0 auto; }
        }
        @media (pointer:coarse) and (max-width:700px) and (max-height:560px) {
          .sa-missions-panel .sa-mission-grid { height:clamp(132px, 34dvh, 174px) !important; margin:6px 0 !important; }
          .sa-missions-panel .sa-mission-card { padding:9px 10px 8px 39px !important; }
          .sa-missions-panel .sa-mission-head strong { font-size:12px !important; }
          .sa-missions-panel .sa-mission-card p, .sa-missions-panel .sa-mission-footer { font-size:9px !important; }
          .sa-missions-panel .sa-mission-footer span:last-child { max-width:54% !important; }
        }

        /* v0.14: JS marks the actual phone mission screen. This avoids the landscape case
           where a phone is wide in CSS pixels but still only has a short usable height. */
        .sa-missions-panel.sa-missions-phone {
          display:flex !important;
          flex-direction:column !important;
          width:min(520px,calc(100vw - 12px)) !important;
          height:calc(100dvh - 12px) !important;
          max-height:none !important;
          min-height:0 !important;
          padding:clamp(10px,2.4vw,16px) !important;
          overflow:hidden !important;
        }
        .sa-missions-phone .sa-brand,
        .sa-missions-phone .sa-subtitle { display:none !important; }
        .sa-missions-phone .sa-title { flex:0 0 auto !important; margin:0 !important; font-size:clamp(27px,5vw,35px) !important; line-height:1.02 !important; }
        .sa-missions-phone .sa-mission-teaser { flex:0 0 auto !important; margin:7px 0 0 !important; padding:8px 10px !important; border-radius:14px !important; }
        .sa-missions-phone .sa-mission-grid {
          display:flex !important;
          flex:1 1 auto !important;
          min-height:0 !important;
          height:auto !important;
          margin:8px 0 7px !important;
          overflow:visible !important;
        }
        .sa-missions-phone .sa-mission-card {
          display:flex !important;
          flex:1 1 auto !important;
          flex-direction:column !important;
          min-height:0 !important;
          height:100% !important;
          padding:11px 12px 10px 43px !important;
          overflow:visible !important;
        }
        .sa-missions-phone .sa-mission-head { align-items:flex-start !important; gap:7px !important; }
        .sa-missions-phone .sa-mission-head strong { min-width:0 !important; flex:1 1 auto !important; white-space:normal !important; overflow-wrap:anywhere !important; line-height:1.15 !important; }
        .sa-missions-phone .sa-mission-head span { flex:0 0 auto !important; white-space:nowrap !important; }
        .sa-missions-phone .sa-mission-card p { display:block !important; margin:6px 0 7px !important; white-space:normal !important; overflow-wrap:anywhere !important; }
        .sa-missions-phone .sa-mission-footer { display:flex !important; flex-wrap:wrap !important; align-items:flex-end !important; gap:3px 8px !important; margin-top:auto !important; }
        .sa-missions-phone .sa-mission-footer span:last-child { margin-left:auto !important; max-width:58% !important; white-space:normal !important; overflow-wrap:anywhere !important; text-align:right !important; }
        .sa-missions-phone .sa-mission-pager { flex:0 0 auto !important; margin:0 0 6px !important; }
        .sa-missions-phone > .sa-btn { flex:0 0 auto !important; min-height:40px !important; margin-top:6px !important; }
        @media (pointer:coarse) and (orientation:landscape) and (max-height:720px) {
          .sa-missions-panel.sa-missions-phone { width:min(500px,calc(100vw - 12px)) !important; padding:9px 12px !important; }
          .sa-missions-phone .sa-title { font-size:27px !important; }
          .sa-missions-phone .sa-mission-teaser { margin-top:5px !important; padding:6px 8px !important; }
          .sa-missions-phone .sa-mission-teaser strong { font-size:11px !important; }
          .sa-missions-phone .sa-mission-teaser span { font-size:9px !important; }
          .sa-missions-phone .sa-mission-mini { min-width:55px !important; padding:4px 6px !important; font-size:9px !important; }
          .sa-missions-phone .sa-mission-grid { margin:5px 0 !important; }
          .sa-missions-phone .sa-mission-card { padding:8px 10px 8px 39px !important; }
          .sa-missions-phone .sa-mission-mark { left:8px !important; top:9px !important; width:22px !important; height:22px !important; }
          .sa-missions-phone .sa-mission-head strong { font-size:12px !important; }
          .sa-missions-phone .sa-mission-head span { font-size:10px !important; }
          .sa-missions-phone .sa-mission-card p,
          .sa-missions-phone .sa-mission-footer { font-size:9px !important; }
          .sa-missions-phone .sa-mission-pager { margin-bottom:4px !important; }
          .sa-missions-phone > .sa-btn { min-height:34px !important; margin-top:4px !important; padding:7px 9px !important; font-size:11px !important; }
        }


      </style>
      <div class="sa-shell">
        <canvas id="sa-canvas" aria-label="Slither Arena"></canvas>
        <div id="sa-joystick" class="sa-joystick" aria-hidden="true"><div class="sa-joystick-ring"></div><div class="sa-joystick-knob"></div></div>
        <div class="sa-top">
          <div class="sa-hud-card">
            <span class="sa-hud-label">Вес</span>
            <div class="sa-score-row"><strong id="sa-score">0</strong><span id="sa-best">Лучший: 0</span></div>
            <span class="sa-rank" id="sa-rank">Подготовка арены</span>
          </div>
          <div class="sa-controls">
            <button class="sa-icon-btn" data-action="shop" aria-label="Скины">Скины</button>
            <button class="sa-icon-btn compact sa-pause-btn" data-action="pause" aria-label="Меню паузы"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="5" height="5" rx="1.5"></rect><rect x="14" y="5" width="5" height="5" rx="1.5"></rect><rect x="5" y="14" width="5" height="5" rx="1.5"></rect><rect x="14" y="14" width="5" height="5" rx="1.5"></rect></svg></button>
          </div>
        </div>
        <div class="sa-bottom"><div class="sa-hint" id="sa-hint">Веди пальцем или мышью • удерживай для ускорения</div></div>
        <div class="sa-toast" id="sa-toast"></div>
        <div class="sa-overlay" id="sa-overlay"></div>
      </div>`;
    document.body.appendChild(this.root);
    this.canvas = this.root.querySelector("#sa-canvas");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.ui = {
      overlay: this.root.querySelector("#sa-overlay"),
      score: this.root.querySelector("#sa-score"),
      best: this.root.querySelector("#sa-best"),
      rank: this.root.querySelector("#sa-rank"),
      hint: this.root.querySelector("#sa-hint"),
      toast: this.root.querySelector("#sa-toast"),
      joystick: this.root.querySelector("#sa-joystick"),
      joystickKnob: this.root.querySelector("#sa-joystick .sa-joystick-knob")
    };
    this.root.addEventListener("click", (event) => this.handleClick(event));
  }

  bindInput() {
    const rectForPointer = () => this.canvas.getBoundingClientRect();
    const setDirectionFromClient = (clientX, clientY) => {
      const rect = rectForPointer();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      if (Math.hypot(dx, dy) > 8) {
        this.pointer.angle = Math.atan2(dy, dx);
        this.pointer.active = true;
      }
    };

    const endTouch = (event = null) => {
      if (event?.pointerType === "touch") {
        // A second finger only controls boost in joystick mode. Releasing it must not close the joystick.
        if (event.pointerId === this.pointer.boostPointerId) {
          this.pointer.boostPointerId = null;
          this.pointer.boosting = false;
          return;
        }
        if (this.pointer.pointerId !== null && event.pointerId !== this.pointer.pointerId) return;
        this.pointer.boosting = false;
        this.pointer.touchBoostHold = false;
        this.pointer.pointerId = null;
        this.pointer.boostPointerId = null;
        this.hideFloatingJoystick();
        return;
      }
      this.pointer.boosting = false;
      this.pointer.touchBoostHold = false;
    };

    const beginPrimaryTouch = (event) => {
      const mode = this.getTouchControlMode();
      this.pointer.pointerId = event.pointerId;
      this.pointer.boostPointerId = null;
      if (mode === "joystick") {
        // Steering starts with the first finger. Boost is deliberately mapped to a second finger.
        this.pointer.touchBoostHold = false;
        this.pointer.boosting = false;
        this.startFloatingJoystick(event.clientX, event.clientY);
        return;
      }
      const now = performance.now();
      const closeToPreviousTap = Math.hypot(event.clientX - this.pointer.lastTouchX, event.clientY - this.pointer.lastTouchY) < 58;
      const isDoubleTap = now - this.pointer.lastTouchTapAt < 290 && closeToPreviousTap;
      this.pointer.lastTouchTapAt = now;
      this.pointer.lastTouchX = event.clientX;
      this.pointer.lastTouchY = event.clientY;
      this.pointer.touchBoostHold = isDoubleTap;
      this.pointer.boosting = isDoubleTap;
      setDirectionFromClient(event.clientX, event.clientY);
      // No mobile boost toast: it covers play space during an action that is already visible from the snake glow.
    };

    this.canvas.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") {
        if (this.pointer.pointerId !== event.pointerId) return;
        if (this.getTouchControlMode() === "joystick") this.updateFloatingJoystick(event.clientX, event.clientY);
        else setDirectionFromClient(event.clientX, event.clientY);
        event.preventDefault?.();
        return;
      }
      setDirectionFromClient(event.clientX, event.clientY);
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      try { this.canvas.setPointerCapture?.(event.pointerId); } catch (_) { /* no capture needed */ }
      this.pointer.active = true;
      if (event.pointerType === "touch") {
        const mode = this.getTouchControlMode();
        if (mode === "joystick" && this.pointer.pointerId !== null && this.pointer.pointerId !== event.pointerId) {
          // Pressing a second finger while the floating joystick is held gives a clear mobile boost action.
          this.pointer.boostPointerId = event.pointerId;
          this.pointer.touchBoostHold = false;
          this.pointer.boosting = this.mode === "game" && (this.player?.mass ?? 0) > 23;
          // Second-finger boost is intentionally silent on phones.
          event.preventDefault?.();
          return;
        }
        if (this.pointer.pointerId !== null && this.pointer.pointerId !== event.pointerId) return;
        beginPrimaryTouch(event);
        event.preventDefault?.();
      } else {
        this.pointer.touchBoostHold = false;
        this.pointer.boosting = true;
        setDirectionFromClient(event.clientX, event.clientY);
      }
      if (this.mode === "menu") this.beginMatch();
    });
    this.canvas.addEventListener("pointerup", endTouch);
    this.canvas.addEventListener("pointercancel", endTouch);
    this.canvas.addEventListener("lostpointercapture", endTouch);
    globalThis.addEventListener("keydown", (event) => {
      this.keys.add(event.code);
      if (event.code === "Space") this.pointer.boosting = true;
      if (event.code === "Escape") this.togglePause();
    });
    globalThis.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
      if (event.code === "Space") this.pointer.boosting = false;
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.running) this.setPaused(true);
    });
  }

  startFloatingJoystick(clientX, clientY) {
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect) return;
    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;
    const x = clamp(rawX, 68, Math.max(68, rect.width - 68));
    const y = clamp(rawY, 68, Math.max(68, rect.height - 68));
    this.pointer.joystickActive = true;
    this.pointer.joystickAnchorX = rawX;
    this.pointer.joystickAnchorY = rawY;
    this.pointer.joystickKnobX = 0;
    this.pointer.joystickKnobY = 0;
    if (this.ui.joystick) {
      this.ui.joystick.style.left = `${x}px`;
      this.ui.joystick.style.top = `${y}px`;
      this.ui.joystick.classList.add("visible");
    }
    this.updateFloatingJoystick(clientX, clientY);
  }

  updateFloatingJoystick(clientX, clientY) {
    if (!this.pointer.joystickActive) return;
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect) return;
    const dx = clientX - rect.left - this.pointer.joystickAnchorX;
    const dy = clientY - rect.top - this.pointer.joystickAnchorY;
    const length = Math.hypot(dx, dy);
    const maxDistance = 38;
    const factor = length > maxDistance ? maxDistance / length : 1;
    const knobX = dx * factor;
    const knobY = dy * factor;
    this.pointer.joystickKnobX = knobX;
    this.pointer.joystickKnobY = knobY;
    if (length > 7) {
      this.pointer.angle = Math.atan2(dy, dx);
      this.pointer.active = true;
    }
    if (this.ui.joystickKnob) this.ui.joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
  }

  hideFloatingJoystick() {
    this.pointer.joystickActive = false;
    if (this.ui?.joystick) this.ui.joystick.classList.remove("visible");
    if (this.ui?.joystickKnob) this.ui.joystickKnob.style.transform = "translate(0,0)";
  }

  resize() {
    if (!this.canvas) return;
    this.dpr = clamp(globalThis.devicePixelRatio || 1, 1, 2);
    const width = Math.max(1, Math.floor(this.root.clientWidth * this.dpr));
    const height = Math.max(1, Math.floor(this.root.clientHeight * this.dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  isTouchOrCompactViewport() {
    const coarse = !!globalThis.matchMedia?.("(pointer: coarse)")?.matches || (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
    const width = this.root?.clientWidth ?? globalThis.innerWidth ?? 1280;
    const height = this.root?.clientHeight ?? globalThis.innerHeight ?? 720;
    return coarse || Math.min(width, height) <= 620 || width <= 640;
  }

  isTouchInputEnvironment() {
    return !!globalThis.matchMedia?.("(pointer: coarse)")?.matches || (globalThis.navigator?.maxTouchPoints ?? 0) > 0;
  }

  isPhoneLayout() {
    const width = this.root?.clientWidth ?? globalThis.innerWidth ?? 1280;
    const height = this.root?.clientHeight ?? globalThis.innerHeight ?? 720;
    // A phone rotated sideways can be wider than 700px, but still needs the compact flow.
    return this.isTouchInputEnvironment() && (width <= 700 || height <= 620);
  }

  isTinyPhoneLayout() {
    const height = this.root?.clientHeight ?? globalThis.innerHeight ?? 720;
    return this.isPhoneLayout() && height <= 620;
  }

  getTouchControlMode() {
    return this.progress?.touchControl === "joystick" ? "joystick" : "touch";
  }

  updateControlHint() {
    if (!this.ui?.hint) return;
    if (!this.isTouchInputEnvironment()) {
      this.ui.hint.textContent = "Веди мышью • удерживай для ускорения";
      return;
    }
    this.ui.hint.textContent = this.getTouchControlMode() === "joystick"
      ? "Тяни джойстик • второй палец — ускорение"
      : "Веди пальцем • двойной тап и удержание — ускорение";
  }

  getCameraTargetZoom() {
    const compact = this.isTouchOrCompactViewport();
    const width = this.root?.clientWidth ?? 1280;
    const height = this.root?.clientHeight ?? 720;
    const portrait = height >= width;
    const mass = this.player?.mass ?? CFG.START_MASS;
    // A compact viewport needs a little more arena in view, especially in portrait.
    const base = compact ? (portrait ? .79 : .85) : 1.10;
    const min = compact ? .54 : .68;
    const max = compact ? (portrait ? .81 : .87) : 1.02;
    const massDivisor = compact ? 760 : 520;
    return clamp(base - mass / massDivisor, min, max);
  }

  async beginMatch(reviveSnapshot = null) {
    this.root?.classList.remove("sa-menu-active");
    this.hideOverlay();
    this.running = true;
    this.paused = false;
    this.mode = "game";
    this.elapsed = 0;
    this.collisionClock = 0;
    this.respawnQueue = [];
    this.deathEchoes = [];
    this.food = [];
    this.foodSpawnClock = 0;
    this.lootPiles = [];
    this.nextLootPileId = 1;
    this.snakes = [];
    this.reviveUsed = reviveSnapshot ? true : false;
    this.deathSnapshot = null;
    this.seed = Math.random() * 99999;
    this.resumeAfterShop = false;
    this.pointer.boosting = false;
    this.pointer.touchBoostHold = false;
    this.pointer.pointerId = null;
    this.pointer.boostPointerId = null;
    this.hideFloatingJoystick();
    this.ensureDailyProgress();
    this.ensureMissionProgress();
    this.matchStats = { seconds: 0, food: 0, peakMass: reviveSnapshot?.mass ?? CFG.START_MASS, kills: 0 };
    this.dailySecondAccumulator = 0;
    this.missionSecondAccumulator = 0;

    const playerMass = reviveSnapshot?.mass ?? CFG.START_MASS;
    this.player = this.createSnake({
      id: "player",
      name: "Ты",
      human: true,
      x: reviveSnapshot?.x ?? rand(-300, 300),
      y: reviveSnapshot?.y ?? rand(-300, 300),
      angle: reviveSnapshot?.angle ?? rand(-Math.PI, Math.PI),
      mass: playerMass,
      skinId: reviveSnapshot?.skinId ?? this.progress.selectedSkin,
      invulnerable: reviveSnapshot ? CFG.REVIVE_INVULNERABILITY_SECONDS : 1.4
    });
    this.snakes.push(this.player);
    for (let index = 0; index < CFG.BOT_COUNT; index++) this.spawnBot(index);
    // Keep the arena readable on mobile: a small spread plus a few contested pockets.
    for (let index = 0; index < CFG.FOOD_TARGET - 18; index++) this.spawnFood();
    // Bright local pockets pull rival bots into skirmishes in several different sectors, not around the player.
    for (let index = 0; index < 6; index++) {
      const pocket = this.getSectorSpawn(index * 3 + 2, .86);
      this.spawnFoodCluster(pocket.x + rand(-140, 140), pocket.y + rand(-140, 140), 4);
    }
    // Seven small sector caches let bots build mass where they patrol. They are spread out,
    // expire normally and stay far below the hard food cap, so the arena does not become cluttered.
    for (let index = 0; index < CFG.BOT_SECTOR_COUNT; index += 2) {
      const pocket = this.getSectorSpawn(index, .92);
      this.spawnFoodCluster(pocket.x + rand(-90, 90), pocket.y + rand(-90, 90), 3);
    }
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.camera.zoom = this.getCameraTargetZoom();
    this.progress.totalMatches += 1;
    this.syncUi();
    this.updateControlHint();
    await this.bridge.setBannerVisible(false);
    await this.bridge.gameplayStart();
  }

  createSnake(options = {}) {
    const isHuman = !!options.human;
    const traitSeed = hash32(`${options.id ?? this.nextSnakeId}:${Math.random()}`);
    const traitRand = (shift) => ((traitSeed >>> shift) & 255) / 255;
    const skinId = options.skinId ?? pick(SKINS).id;
    const archetypeRoll = traitRand(20);
    const archetype = isHuman
      ? "human"
      : archetypeRoll < .26 ? "охотник"
        : archetypeRoll < .52 ? "ловец"
          : archetypeRoll < .76 ? "дуэлянт"
            : "собиратель";
    const snake = {
      id: options.id ?? `bot-${this.nextSnakeId++}`,
      name: options.name ?? `Игрок ${this.nextSnakeId}`,
      human: isHuman,
      x: options.x ?? rand(-CFG.WORLD_SIZE * .38, CFG.WORLD_SIZE * .38),
      y: options.y ?? rand(-CFG.WORLD_SIZE * .38, CFG.WORLD_SIZE * .38),
      angle: options.angle ?? rand(-Math.PI, Math.PI),
      desiredAngle: options.angle ?? 0,
      mass: options.mass ?? rand(24, 58),
      skinId,
      trail: [],
      trailDistance: 0,
      trailSpacing: 6.8,
      trailAdjustAccumulator: 0,
      // Fractional value used for rendering. The final tail segment can extend smoothly instead of popping.
      tailRenderCount: null,
      tailTargetCount: null,
      tailTrimAccumulator: 0,
      speed: 0,
      boosting: false,
      alive: true,
      invulnerable: options.invulnerable ?? 0,
      // Starts below 1 only for off-screen respawns. It is visual-only; gameplay remains fair via invulnerability.
      entryAlpha: options.entryAlpha ?? 1,
      glow: 0,
      brain: {
        mode: "wander",
        archetype,
        targetX: options.x ?? 0,
        targetY: options.y ?? 0,
        targetFoodId: -1,
        targetSnakeId: null,
        targetLockFor: 0,
        lootPileId: null,
        lootInterestUntil: -999,
        lootX: options.x ?? 0,
        lootY: options.y ?? 0,
        lootContestUntil: -999,
        decisionIn: rand(.05, .4),
        panicIn: 0,
        wanderPhase: rand(-Math.PI, Math.PI),
        confidence: rand(.35, .95),
        mistakeIn: rand(3, 8),
        oversteer: 0,
        lastDanger: 9999,
        orbitSide: traitSeed & 1 ? 1 : -1,
        orbitRadius: 0,
        planPhase: rand(0, TAU),
        recentTargetMass: 0,
        commitUntil: 0,
        maneuverUntil: 0,
        roamUntil: 0,
        roamX: options.x ?? 0,
        roamY: options.y ?? 0,
        routeSide: traitSeed & 2 ? 1 : -1,
        encircleUntil: 0,
        encircleRadius: 0,
        lastEncircleAt: -999,
        lastTargetChangeAt: -999,
        targetClass: "none",
        lastCourseRisk: 0,
        yieldUntil: 0,
        encircleTargetId: null,
        encircleStartedAt: -999,
        encircleLastAt: -999,
        encircleTurns: 0,
        encircleCenterX: options.x ?? 0,
        encircleCenterY: options.y ?? 0,
        encircleSealed: false,
        playerPursuitUntil: 0,
        lastTrafficAt: -999,
        homeX: options.homeX ?? options.x ?? 0,
        homeY: options.homeY ?? options.y ?? 0,
        territoryRadius: options.territoryRadius ?? rand(720, 1040),
        sectorIndex: options.sectorIndex ?? -1,
        patrolPhase: rand(-Math.PI, Math.PI),
        pursuitUntil: 0,
        retreatUntil: 0,
        lastSeenPlayerAt: -999,
        playerInterestUntil: -999,
        playerAttackCooldownUntil: -999,
        attackCooldownUntil: -999,
        attackStyle: "cutoff",
        attackStyleUntil: -999,
        feintUntil: -999,
        feintX: options.x ?? 0,
        feintY: options.y ?? 0,
        encircleStage: "none",
        encircleAnchorX: options.x ?? 0,
        encircleAnchorY: options.y ?? 0,
        encircleLastOrbitAngle: 0,
        encircleGapAngle: 0,
        encircleEscapeWindowUntil: -999,
        lastEngagementAt: -999,
        duelTargetId: null,
        duelStage: "none",
        duelPhaseUntil: -999,
        sideCutUntil: -999,
        sideCutSide: traitSeed & 4 ? 1 : -1,
        lastSideCutAt: -999,
        counterTurnUntil: -999,
        duelBaitUntil: -999,
        flankUntil: -999,
        flankSide: traitSeed & 8 ? 1 : -1,
        flankTargetId: null,
        flankRole: "none",
        lastPincerAt: -999,
        targetAngleSeen: options.angle ?? 0,
        targetTurnAt: -999,
        microFeintUntil: -999,
        growthTarget: (options.mass ?? 70) + rand(55, 130),
        feedFocusUntil: -999
      },
      traits: {
        aggression: isHuman ? 0 : lerp(.12, .91, traitRand(0)),
        greed: isHuman ? 0 : lerp(.25, .98, traitRand(8)),
        caution: isHuman ? 0 : lerp(.2, .96, traitRand(16)),
        precision: isHuman ? 0 : lerp(.35, .96, traitRand(24)),
        reaction: isHuman ? 0 : lerp(.14, .62, traitRand(4)),
        showOff: isHuman ? 0 : lerp(.02, .48, traitRand(12)),
        trapper: isHuman ? 0 : lerp(.08, .96, traitRand(6)),
        rivalry: isHuman ? 0 : lerp(.25, .96, traitRand(14)),
        playerFocus: isHuman ? 0 : lerp(.01, .20, traitRand(22))
      }
    };
    if (!isHuman) {
      if (archetype === "охотник") snake.traits.aggression = clamp(snake.traits.aggression + .16, 0, 1);
      if (archetype === "ловец") snake.traits.trapper = clamp(snake.traits.trapper + .22, 0, 1);
      if (archetype === "дуэлянт") snake.traits.rivalry = clamp(snake.traits.rivalry + .2, 0, 1);
      if (archetype === "собиратель") snake.traits.greed = clamp(snake.traits.greed + .18, 0, 1);
    }
    snake.trailSpacing = clamp(5.5 + Math.sqrt(snake.mass) * .13, 6.1, 8.1);
    snake.tailTargetCount = this.getTailPointTarget(snake);
    snake.tailRenderCount = snake.tailTargetCount;
    const initialTail = this.getTailPointCount(snake);
    for (let index = 0; index < initialTail; index++) {
      snake.trail.push({
        x: snake.x - Math.cos(snake.angle) * index * snake.trailSpacing,
        y: snake.y - Math.sin(snake.angle) * index * snake.trailSpacing
      });
    }
    return snake;
  }

  getViewportWorldBounds(padding = 0) {
    const dpr = clamp(globalThis.devicePixelRatio || 1, 1, 2);
    const scale = Math.max(.0001, this.camera.zoom * dpr);
    const halfWidth = this.canvas ? this.canvas.width / (2 * scale) : 640;
    const halfHeight = this.canvas ? this.canvas.height / (2 * scale) : 360;
    return {
      left: this.camera.x - halfWidth - padding,
      right: this.camera.x + halfWidth + padding,
      top: this.camera.y - halfHeight - padding,
      bottom: this.camera.y + halfHeight + padding,
      halfWidth,
      halfHeight
    };
  }

  isWorldPointVisible(x, y, padding = 0) {
    const view = this.getViewportWorldBounds(padding);
    return x >= view.left && x <= view.right && y >= view.top && y <= view.bottom;
  }

  chooseHiddenRespawn(index, fallback) {
    // A rival must never materialize inside the current camera. First try its home sectors,
    // then sample distant lanes around the player. This removes the visible disappear/reappear effect.
    if (!this.player?.alive) return fallback;
    const baseView = this.getViewportWorldBounds(0);
    const minDistance = Math.hypot(baseView.halfWidth, baseView.halfHeight) + 620;
    const half = CFG.WORLD_SIZE * .43;
    const isClear = (candidate) => {
      if (this.isWorldPointVisible(candidate.x, candidate.y, 500)) return false;
      if (dist(candidate.x, candidate.y, this.player.x, this.player.y) < minDistance) return false;
      for (const snake of this.snakes) {
        if (!snake.alive || snake.human) continue;
        if (dist(candidate.x, candidate.y, snake.x, snake.y) < 440) return false;
      }
      return true;
    };
    for (let attempt = 0; attempt < 22; attempt++) {
      const sectorIndex = index + attempt * 5 + Math.floor(rand(0, CFG.BOT_SECTOR_COUNT));
      const candidate = this.getSectorSpawn(sectorIndex, attempt < 11 ? 1 : .92);
      candidate.x = clamp(candidate.x + rand(-135, 135), -half, half);
      candidate.y = clamp(candidate.y + rand(-135, 135), -half, half);
      if (isClear(candidate)) return candidate;
    }
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = rand(0, TAU);
      const range = rand(minDistance, minDistance + 720);
      const candidate = {
        x: clamp(this.player.x + Math.cos(angle) * range, -half, half),
        y: clamp(this.player.y + Math.sin(angle) * range, -half, half),
        angle,
        sector: ((Math.round(angle / TAU * CFG.BOT_SECTOR_COUNT) % CFG.BOT_SECTOR_COUNT) + CFG.BOT_SECTOR_COUNT) % CFG.BOT_SECTOR_COUNT
      };
      if (isClear(candidate)) return candidate;
    }
    return fallback;
  }

  getSectorSpawn(index = 0, radiusScale = 1) {
    const sector = ((index % CFG.BOT_SECTOR_COUNT) + CFG.BOT_SECTOR_COUNT) % CFG.BOT_SECTOR_COUNT;
    const ring = Math.floor(Math.max(0, index) / CFG.BOT_SECTOR_COUNT);
    const angle = sector / CFG.BOT_SECTOR_COUNT * TAU + (ring % 2 ? Math.PI / CFG.BOT_SECTOR_COUNT : 0);
    const baseRadius = CFG.WORLD_SIZE * (ring % 2 ? .355 : .435) * radiusScale;
    const radius = baseRadius + rand(-125, 125);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle, sector };
  }

  spawnBot(index = 0, options = {}) {
    // Every bot belongs to a local sector. One nearby scout creates occasional player pressure,
    // while the rest remain distributed across the map rather than forming a player-centred swarm.
    const isRespawn = !!options.respawn;
    const isScout = index === 0 && !isRespawn;
    const isWarden = index === 3 || index === 10;
    let spawn = this.getSectorSpawn(index);
    if (isRespawn) spawn = this.chooseHiddenRespawn(index, spawn);
    if (isScout) {
      const a = rand(0, TAU);
      const r = rand(760, 980);
      spawn.x = Math.cos(a) * r;
      spawn.y = Math.sin(a) * r;
      spawn.angle = a;
    }
    const titles = ["Maks", "Лиса", "Zed", "Raven", "Кекс", "Nova", "Pixel", "Змей", "Астра", "Byte", "Бобёр", "Карма", "Nika", "Volt", "Сова", "Mira", "Fox", "Lumen"];
    const tierRoll = Math.random();
    // Fresh matches begin with readable, short-to-medium bodies. Wardens and elite bots still
    // have an early advantage, but must eat before they can close a full encirclement.
    const mass = isWarden ? rand(150, 190) : isScout ? rand(48, 68) : tierRoll < .035 ? rand(94, 136) : tierRoll < .25 ? rand(52, 82) : rand(24, 54);
    const bot = this.createSnake({
      id: `bot-${this.nextSnakeId++}`,
      name: `${pick(titles)}${(index + 1) % 6 ? "" : "_pro"}`,
      x: spawn.x,
      y: spawn.y,
      angle: spawn.angle + (chance(.5) ? Math.PI / 2 : -Math.PI / 2) + rand(-.32, .32),
      mass,
      skinId: pick(SKINS).id,
      homeX: spawn.x,
      homeY: spawn.y,
      sectorIndex: spawn.sector,
      territoryRadius: rand(600, 820),
      invulnerable: isRespawn ? 1.25 : 0,
      entryAlpha: isRespawn ? 0 : 1
    });
    if (isScout) {
      bot.brain.archetype = "охотник";
      bot.traits.aggression = Math.max(bot.traits.aggression, .76);
      bot.traits.playerFocus = Math.max(bot.traits.playerFocus, .36);
      bot.brain.territoryRadius = 900;
    }
    if (isWarden) {
      bot.brain.archetype = "ловец";
      bot.traits.trapper = Math.max(bot.traits.trapper, .92);
      bot.traits.aggression = Math.max(bot.traits.aggression, .58);
      bot.traits.caution = Math.max(bot.traits.caution, .68);
    }
    this.snakes.push(bot);
    return bot;
  }

  getLengthMass(snake) {
    // Starts stay compact. After the soft cap, most new mass is converted into body width,
    // so leaders can feel powerful without filling the arena with a rope-like tail.
    const softLengthMass = 220;
    const baseLengthMass = Math.min(snake.mass, softLengthMass);
    const overflow = Math.max(0, snake.mass - softLengthMass);
    return Math.min(baseLengthMass + Math.sqrt(overflow) * 7.0, 310);
  }

  getTailPointCap(snake) {
    // A grown trapper still has enough body for a real encirclement, but no snake starts huge.
    return snake.mass >= 220 ? 260 : 220;
  }

  getTailPointTarget(snake) {
    return clamp(10 + this.getLengthMass(snake) * .56, 16, this.getTailPointCap(snake));
  }

  getTailPointCount(snake) {
    return clamp(Math.ceil(this.getTailPointTarget(snake)), 18, this.getTailPointCap(snake));
  }

  getSnakeRadius(snake) {
    const softLengthMass = 250;
    const lengthMass = Math.min(snake.mass, softLengthMass);
    const bulkMass = Math.max(0, snake.mass - softLengthMass);
    // Growth after the tail soft-cap is shown as a thicker, heavier body instead of a rope-like tail.
    return clamp(9 + Math.sqrt(lengthMass) * 1.15 + Math.sqrt(bulkMass) * .63, 14, 35);
  }

  getBaseSpeed(snake) {
    return clamp(168 - Math.sqrt(snake.mass) * 3.1, 120, 150);
  }

  getLootPile(pileId) {
    if (!pileId) return null;
    return this.lootPiles.find((pile) => pile.id === pileId) ?? null;
  }

  updateLootPiles() {
    if (!this.lootPiles.length) return;
    const remaining = new Map();
    for (const food of this.food) {
      if (!food?.pileId) continue;
      remaining.set(food.pileId, (remaining.get(food.pileId) ?? 0) + food.value);
    }
    const active = new Set();
    this.lootPiles = this.lootPiles.filter((pile) => {
      pile.remainingValue = remaining.get(pile.id) ?? 0;
      const exists = pile.remainingValue > .16 && this.elapsed < pile.expiresAt;
      if (exists) active.add(pile.id);
      return exists;
    });
    for (const snake of this.snakes) {
      const brain = snake?.brain;
      if (!brain?.lootPileId || active.has(brain.lootPileId)) continue;
      brain.lootPileId = null;
      brain.lootInterestUntil = -999;
      if (brain.mode === "loot") brain.mode = "wander";
    }
  }

  alertBotsToLoot(pile) {
    // Only the closest few rivals are alerted. This produces a believable skirmish rather than a map-wide swarm.
    const candidates = this.snakes
      .filter((snake) => snake?.alive && !snake.human && snake.mass > 20)
      .map((snake) => ({ snake, distance: dist(snake.x, snake.y, pile.x, pile.y) }))
      .filter((entry) => entry.distance <= CFG.LOOT_ALERT_RADIUS)
      .sort((left, right) => left.distance - right.distance);
    const slots = clamp(Math.ceil(pile.totalValue / 7), 2, 5);
    for (const { snake, distance } of candidates.slice(0, slots)) {
      const brain = snake.brain;
      const activeTacticalMove = ["encircle", "escape-ring", "trapped", "sidecut", "counterturn"].includes(brain.mode);
      if (activeTacticalMove && distance > 360) continue;
      brain.lootPileId = pile.id;
      brain.lootX = pile.x;
      brain.lootY = pile.y;
      brain.lootInterestUntil = this.elapsed + clamp(2.5 + pile.totalValue * .10 - distance / 920, 2.4, 8.6);
      brain.targetFoodId = -1;
      // A nearby kill is more important than stale wandering or a long-range chase.
      if (!activeTacticalMove) {
        brain.targetLockFor = 0;
        brain.targetSnakeId = null;
        brain.decisionIn = Math.min(brain.decisionIn, .035);
      }
    }
  }

  registerDeathLoot(snake, killer, trail, chunks, value) {
    const pile = {
      id: `loot-${this.nextLootPileId++}`,
      x: snake.x,
      y: snake.y,
      totalValue: 0,
      remainingValue: 0,
      createdAt: this.elapsed,
      expiresAt: this.elapsed + CFG.LOOT_PILE_TTL,
      killerId: killer?.id ?? null,
      victimId: snake.id
    };
    let weightedX = 0;
    let weightedY = 0;
    for (let index = 0; index < chunks; index++) {
      const point = trail[Math.floor(index / chunks * Math.max(1, trail.length - 1))] ?? { x: snake.x, y: snake.y };
      const food = this.spawnFood(
        point.x + rand(-13, 13),
        point.y + rand(-13, 13),
        value * rand(.78, 1.18),
        getSkin(snake.skinId).primary,
        rand(CFG.DEATH_FOOD_LIFE_MIN, CFG.DEATH_FOOD_LIFE_MAX),
        "death",
        pile.id
      );
      pile.totalValue += food.value;
      weightedX += food.x * food.value;
      weightedY += food.y * food.value;
    }
    pile.remainingValue = pile.totalValue;
    if (pile.totalValue > .01) {
      pile.x = weightedX / pile.totalValue;
      pile.y = weightedY / pile.totalValue;
    }
    this.lootPiles.push(pile);
    while (this.lootPiles.length > CFG.LOOT_TRACK_LIMIT) this.lootPiles.shift();
    this.alertBotsToLoot(pile);
    return pile;
  }

  spawnFood(x = null, y = null, value = null, color = null, life = null, source = "ambient", pileId = null) {
    const half = CFG.WORLD_SIZE * .46;
    if (this.food.length >= CFG.FOOD_HARD_CAP) this.food.shift();
    const ttl = life ?? rand(CFG.FOOD_LIFE_MIN, CFG.FOOD_LIFE_MAX);
    const food = {
      id: this.nextFoodId++,
      x: x ?? rand(-half, half),
      y: y ?? rand(-half, half),
      value: value ?? rand(.50, 1.30),
      radius: rand(2.45, 4.6),
      color: color ?? pick(["#ffe066", "#74c0fc", "#b2f2bb", "#faa2c1", "#d0bfff", "#ffd8a8"]),
      pulse: rand(0, TAU),
      shimmer: rand(0, TAU),
      age: 0,
      ttl,
      source,
      pileId
    };
    this.food.push(food);
    return food;
  }

  spawnFoodCluster(x, y, amount = 6) {
    const color = pick(["#ffe066", "#74c0fc", "#b2f2bb", "#faa2c1", "#d0bfff", "#ffd8a8"]);
    for (let index = 0; index < amount; index++) {
      const angle = rand(0, TAU);
      const radius = Math.sqrt(Math.random()) * rand(22, 84);
      this.spawnFood(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, rand(.78, 1.65), color, rand(18, 30), "cluster");
    }
  }

  loop(now) {
    const rawDt = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60;
    const dt = clamp(rawDt, 0, CFG.MAX_DT);
    this.lastFrame = now;
    this.fpsClock += dt;
    this.fpsFrames += 1;
    if (this.fpsClock > .8) {
      this.fps = Math.round(this.fpsFrames / this.fpsClock);
      this.fpsClock = 0;
      this.fpsFrames = 0;
    }
    if (this.running && !this.paused) this.update(dt);
    this.draw();
    requestAnimationFrame((time) => this.loop(time));
  }

  update(dt) {
    this.elapsed += dt;
    this.playSecondsSinceInterstitial += dt;
    this.collisionClock += dt;
    this.saveClock += dt;
    this.updateKeyboardDirection();
    this.updatePlayer(dt);
    this.updateBots(dt);
    this.updateDeathEchoes(dt);
    this.updateFood(dt);
    this.updateDailyChallenge(dt);
    this.updateMissionContracts(dt);
    this.updateRespawns(dt);

    if (this.collisionClock >= .085) {
      this.collisionClock = 0;
      this.resolveCollisions();
    }

    this.foodSpawnClock += dt;
    if (this.food.length < CFG.FOOD_TARGET && this.foodSpawnClock >= CFG.FOOD_SPAWN_INTERVAL) {
      this.foodSpawnClock = 0;
      const missing = Math.min(CFG.FOOD_SPAWN_BATCH, CFG.FOOD_TARGET - this.food.length);
      for (let index = 0; index < missing; index++) this.spawnFood();
    }

    if (this.player?.alive) {
      const follow = clamp(dt * 5.2, 0, 1);
      this.camera.x = lerp(this.camera.x, this.player.x, follow);
      this.camera.y = lerp(this.camera.y, this.player.y, follow);
      this.camera.zoom = lerp(this.camera.zoom, this.getCameraTargetZoom(), clamp(dt * 2.5, 0, 1));
    }

    if (this.saveClock > 30) {
      this.saveClock = 0;
      this.persistProgress();
    }
    this.syncUi();
  }

  updateKeyboardDirection() {
    if (!this.player?.alive) return;
    let dx = 0;
    let dy = 0;
    if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) dx -= 1;
    if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) dx += 1;
    if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) dy -= 1;
    if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) dy += 1;
    if (dx || dy) {
      this.pointer.angle = Math.atan2(dy, dx);
      this.pointer.active = true;
    }
  }

  updatePlayer(dt) {
    if (!this.player?.alive) return;
    this.player.desiredAngle = this.pointer.active ? this.pointer.angle : this.player.angle;
    this.player.boosting = this.pointer.boosting && this.player.mass > 23;
    this.stepSnake(this.player, dt);
    if (this.player.boosting) {
      // Boost always burns more mass than can be recovered from its fading trail.
      this.player.mass = Math.max(18, this.player.mass - dt * .88);
      if (chance(dt * 6.4)) {
        const tail = this.player.trail[this.player.trail.length - 1];
        if (tail) this.spawnFood(tail.x + rand(-5, 5), tail.y + rand(-5, 5), .055, "#b2f2bb", rand(CFG.BOOST_FOOD_LIFE_MIN, CFG.BOOST_FOOD_LIFE_MAX), "boost");
      }
    }
    this.matchStats.peakMass = Math.max(this.matchStats.peakMass, this.player.mass);
  }

  updateBots(dt) {
    for (const bot of this.snakes) {
      if (bot.human || !bot.alive) continue;
      const brain = bot.brain;
      bot.entryAlpha = Math.min(1, (bot.entryAlpha ?? 1) + dt * 1.4);
      brain.decisionIn -= dt;
      brain.mistakeIn -= dt;
      brain.targetLockFor = Math.max(0, brain.targetLockFor - dt);
      this.observePlayer(bot);
      if (brain.decisionIn <= 0) {
        this.decideBot(bot);
        // Tactical plans are revisited often, but an intent remains locked long enough to look deliberate.
        const tactical = ["cutoff", "duel", "sidecut", "counterturn", "shadow", "feint", "encircle", "escape-ring", "trapped", "evade", "escape", "retreat"].includes(brain.mode);
        brain.decisionIn = tactical
          ? clamp(.075 + (1 - bot.traits.reaction) * .07 + rand(.015, .055), .07, .17)
          : clamp(.10 + bot.traits.reaction * .08 + rand(.02, .10), .10, .24);
      }
      // Reflex turn: when a body suddenly enters the next few metres, react this frame instead of waiting
      // for the next high-level decision. It is still a real turn, not collision immunity.
      const tacticalTarget = ["encircle", "duel", "sidecut", "counterturn", "feint"].includes(brain.mode)
        ? (brain.encircleTargetId ?? brain.targetSnakeId)
        : null;
      const reflex = this.getImmediateBodyThreat(bot, 230 + this.getSnakeRadius(bot) * 2.1, tacticalTarget);
      if (reflex && reflex.urgency > .11 && !(brain.mode === "sidecut" && brain.sideCutUntil > this.elapsed)) {
        const escape = normalizeAngle(reflex.angle + (reflex.side || brain.routeSide) * (1.18 + bot.traits.caution * .34));
        bot.desiredAngle = this.chooseSafeHeading(bot, escape, 300, "evade");
        brain.mode = "evade";
        brain.yieldUntil = this.elapsed + .20;
        bot.boosting = false;
      }
      this.stepSnake(bot, dt);
      if (bot.boosting) bot.mass = Math.max(18, bot.mass - dt * (.26 + bot.traits.showOff * .18));
    }
  }

  observePlayer(bot) {
    const player = this.player;
    if (!player?.alive || player.invulnerable > 0) return;
    const brain = bot.brain;
    const distance = dist(bot.x, bot.y, player.x, player.y);
    const sectorReach = Math.max(760, brain.territoryRadius * 1.18);
    if (distance > sectorReach) return;

    // Bots only remember a player they have actually approached in their local area.
    // This prevents a global bee-line while still allowing a nearby rival to stay interested.
    brain.lastSeenPlayerAt = this.elapsed;
    const massEdge = (bot.mass - player.mass) / Math.max(24, bot.mass);
    const personality = bot.brain.archetype === "охотник" ? .9 : bot.traits.aggression * .55 + bot.traits.playerFocus;
    const interest = clamp(.75 + personality + Math.max(0, massEdge) * .9, .7, 2.8);
    brain.playerInterestUntil = Math.max(brain.playerInterestUntil, this.elapsed + interest);
  }

  decideBot(bot) {
    const brain = bot.brain;
    const traits = bot.traits;
    const radius = this.getSnakeRadius(bot);
    const edgeDistance = CFG.WORLD_SIZE / 2 - Math.max(Math.abs(bot.x), Math.abs(bot.y));
    const danger = this.senseBodyDanger(bot, 640 + traits.caution * 310, brain.mode === "encircle" ? brain.encircleTargetId : null);
    const traffic = this.senseHeadTraffic(bot, 560 + traits.reaction * 210);
    brain.lastDanger = danger.distance;
    bot.boosting = false;

    const immediateEnclosure = this.getActiveEnclosure(bot);
    if (immediateEnclosure) {
      this.planEscapeEnclosure(bot, immediateEnclosure);
      return;
    }

    // Read an opponent's sudden side cut before it becomes a body collision. This is the small
    // "human reaction" that makes duels resolve with swerves instead of identical circles.
    const cutter = this.findSideCutThreat(bot);
    if (cutter) {
      this.planCounterTurn(bot, cutter);
      return;
    }

    // Stay with a short tactical commitment when the prey remains visible. This is what makes
    // a hunter look like it is finishing a move instead of constantly re-rolling its intentions.
    const committedTarget = this.snakes.find((snake) => snake.alive && snake.id === brain.targetSnakeId && snake.invulnerable <= 0);
    if (committedTarget && brain.mode === "sidecut" && brain.sideCutUntil > this.elapsed) {
      const duel = this.getHeadOnDuel(bot, committedTarget, dist(bot.x, bot.y, committedTarget.x, committedTarget.y));
      if (duel) {
        this.planHeadOnDuel(bot, committedTarget, duel);
        return;
      }
    }
    if (committedTarget && brain.mode === "counterturn" && brain.counterTurnUntil > this.elapsed) {
      this.planCounterTurn(bot, committedTarget);
      return;
    }
    if (committedTarget && brain.targetLockFor > .22 && ["cutoff", "pressure", "duel", "sidecut", "counterturn", "shadow", "feint"].includes(brain.mode)) {
      const d = dist(bot.x, bot.y, committedTarget.x, committedTarget.y);
      if (d < 1040 && this.elapsed >= brain.attackCooldownUntil) {
        this.planAttack(bot, committedTarget, d);
        return;
      }
    }

    // A player who sees a lane close does not recalculate a new personality every tenth of a second.
    if (brain.mode === "yield" && brain.yieldUntil > this.elapsed) {
      this.setBotHeading(bot, bot.desiredAngle, 360, "evade");
      return;
    }
    const wallWarning = 360 + radius * 2.2 + Math.max(0, bot.speed || this.getBaseSpeed(bot)) * .55;
    if (edgeDistance < wallWarning) {
      brain.mode = "escape";
      const centerAngle = angleTo(bot.x, bot.y, -bot.x * .52, -bot.y * .52);
      this.setBotHeading(bot, centerAngle, 680, "escape");
      bot.boosting = edgeDistance < 190 && bot.mass > 30 && brain.lastCourseRisk < 17;
      brain.commitUntil = this.elapsed + .88;
      return;
    }
    if (danger.urgency > .32 || danger.distance < radius * 3.18 + 34) {
      brain.mode = "evade";
      const escapeAngle = normalizeAngle(danger.angle + (danger.side || brain.routeSide) * (1.02 + traits.caution * .46));
      this.setBotHeading(bot, escapeAngle, 520, "evade");
      bot.boosting = danger.urgency > .76 && bot.mass > 32;
      brain.commitUntil = this.elapsed + .34;
      return;
    }
    if (traffic.urgency > .36 && brain.mode !== "encircle" && brain.mode !== "duel" && brain.mode !== "sidecut" && brain.mode !== "counterturn" && brain.mode !== "feint" && !this.hasViableHeadOn(bot)) {
      brain.mode = "yield";
      brain.yieldUntil = this.elapsed + rand(.58, 1.08);
      brain.lastTrafficAt = this.elapsed;
      const side = traffic.side || brain.routeSide;
      const yieldAngle = normalizeAngle(traffic.angle + side * (1.17 + traits.caution * .22));
      this.setBotHeading(bot, yieldAngle, 390, "evade");
      return;
    }

    const predator = this.findDominantThreat(bot);
    if (predator) {
      this.planRetreat(bot, predator);
      return;
    }

    // A fresh death pile is a local event: nearby snakes visibly race to it. Bold rivals may also
    // challenge another snake already feeding there, which creates a readable food skirmish.
    const loot = this.pickLootOpportunity(bot);
    if (loot) {
      const contestant = this.pickLootContestTarget(bot, loot);
      if (contestant) this.planLootContest(bot, contestant, loot);
      else this.planLoot(bot, loot);
      return;
    }

    const forage = this.pickFoodTarget(bot);
    if (this.shouldPrioritizeForage(bot, forage)) {
      this.planFoodRun(bot, forage);
      return;
    }

    const target = this.pickCombatTarget(bot);
    if (target) {
      brain.targetSnakeId = target.id;
      brain.recentTargetMass = target.mass;
      const distance = dist(bot.x, bot.y, target.x, target.y);
      const duel = this.getHeadOnDuel(bot, target, distance);
      if (duel && this.planHeadOnDuel(bot, target, duel)) return;
      if (this.tryPlanPincer(bot, target, distance)) return;
      const canEncircle = this.canEncircle(bot, target, distance);
      if (brain.mode === "encircle" && brain.encircleTargetId === target.id && brain.encircleUntil > this.elapsed) {
        this.planEncircle(bot, target, false);
        return;
      }
      if (canEncircle) {
        this.planEncircle(bot, target, true);
        return;
      }
      this.planAttack(bot, target, distance);
      return;
    }

    const food = forage ?? this.pickFoodTarget(bot);
    if (food) {
      this.planFoodRun(bot, food);
      return;
    }

    this.planRoam(bot);
  }

  getHeadOnDuel(bot, target, distance = dist(bot.x, bot.y, target.x, target.y)) {
    if (!target?.alive || target.id === bot.id || target.invulnerable > 0) return null;
    if (distance < 64 || distance > 520) return null;
    const line = angleTo(bot.x, bot.y, target.x, target.y);
    const botToward = Math.cos(normalizeAngle(bot.angle - line));
    const targetToward = Math.cos(normalizeAngle(target.angle - (line + Math.PI)));
    const opposing = Math.cos(normalizeAngle(bot.angle - target.angle));
    const botAlignment = Math.abs(Math.sin(normalizeAngle(bot.angle - line)));
    const targetAlignment = Math.abs(Math.sin(normalizeAngle(target.angle - (line + Math.PI))));
    if (botToward < .50 || targetToward < .46 || opposing > -.42) return null;
    if (botAlignment > .72 || targetAlignment > .76) return null;
    return {
      line,
      distance,
      botToward,
      targetToward,
      closing: clamp((botToward + targetToward) * .5, 0, 1)
    };
  }

  hasViableHeadOn(bot) {
    for (const other of this.snakes) {
      if (!other.alive || other.id === bot.id) continue;
      if (this.getHeadOnDuel(bot, other, dist(bot.x, bot.y, other.x, other.y))) return true;
    }
    return false;
  }

  findSideCutThreat(bot) {
    let best = null;
    let bestDistance = Infinity;
    for (const other of this.snakes) {
      if (!other.alive || other.id === bot.id || other.brain?.mode !== "sidecut") continue;
      if (other.brain.targetSnakeId !== bot.id || other.brain.sideCutUntil <= this.elapsed) continue;
      const distance = dist(bot.x, bot.y, other.x, other.y);
      if (distance < 360 && distance < bestDistance) { best = other; bestDistance = distance; }
    }
    return best;
  }

  planCounterTurn(bot, cutter) {
    const brain = bot.brain;
    const distance = dist(bot.x, bot.y, cutter.x, cutter.y);
    const cutterSide = cutter.brain?.sideCutSide || brain.routeSide;
    const escapeSide = -cutterSide;
    const direct = normalizeAngle(bot.angle + escapeSide * (1.12 + bot.traits.reaction * .34));
    brain.mode = "counterturn";
    brain.targetSnakeId = cutter.id;
    brain.targetClass = cutter.human ? "player" : "rival";
    brain.counterTurnUntil = Math.max(brain.counterTurnUntil, this.elapsed + .34 + bot.traits.reaction * .16);
    brain.duelStage = "escape";
    this.setBotHeading(bot, direct, clamp(distance * .78, 170, 340), "evade");
    bot.boosting = bot.mass > 30 && distance < 190 && brain.lastCourseRisk < 16;
  }

  planHeadOnDuel(bot, target, duel) {
    const brain = bot.brain;
    const traits = bot.traits;
    const ownRadius = this.getSnakeRadius(bot);
    const targetRadius = this.getSnakeRadius(target);
    const distance = duel.distance;
    const massLead = (bot.mass - target.mass) / Math.max(26, bot.mass);

    if (brain.mode === "sidecut" && brain.sideCutUntil > this.elapsed && brain.targetSnakeId === target.id) {
      // The kill attempt is a deliberately sharp ninety-degree peel. It leaves a fresh body line
      // across the opponent's old lane rather than aiming a head straight at a head.
      const turn = normalizeAngle(bot.angle + brain.sideCutSide * (1.28 + traits.precision * .28));
      brain.mode = "sidecut";
      brain.targetClass = target.human ? "player" : "rival";
      brain.targetSnakeId = target.id;
      bot.desiredAngle = this.chooseSafeHeading(bot, turn, 210, "duel");
      bot.boosting = false;
      return true;
    }

    if (brain.duelTargetId !== target.id || this.elapsed > brain.duelPhaseUntil) {
      brain.duelTargetId = target.id;
      brain.duelStage = "bait";
      brain.duelPhaseUntil = this.elapsed + rand(.72, 1.35) + traits.precision * .28;
      brain.duelBaitUntil = this.elapsed + rand(.24, .48);
      // A better duellist reads the rival's last chosen turn and deliberately uses the less expected side.
      const targetTurn = normalizeAngle((target.desiredAngle ?? target.angle) - target.angle);
      const readsTurn = Math.abs(targetTurn) > .10 && chance(.42 + traits.precision * .34);
      brain.sideCutSide = readsTurn ? (targetTurn > 0 ? -1 : 1) : (chance(.5) ? 1 : -1);
    }

    const safeTrigger = 172 + ownRadius + targetRadius + traits.precision * 38;
    const braveEnough = massLead > -.08 || (brain.archetype === "дуэлянт" && massLead > -.19 && traits.aggression > .56);
    const sideCutReady = this.elapsed - brain.lastSideCutAt > 2.85 + (1 - traits.precision) * 1.15;
    if (braveEnough && sideCutReady && distance <= safeTrigger && duel.closing > .66 && brain.duelStage !== "sidecut") {
      brain.mode = "sidecut";
      brain.duelStage = "sidecut";
      brain.targetClass = target.human ? "player" : "rival";
      brain.targetSnakeId = target.id;
      brain.sideCutUntil = this.elapsed + .36 + traits.precision * .16;
      brain.lastSideCutAt = this.elapsed;
      const turn = normalizeAngle(bot.angle + brain.sideCutSide * (1.34 + traits.precision * .28));
      bot.desiredAngle = this.chooseSafeHeading(bot, turn, 190, "duel");
      bot.boosting = false;
      return true;
    }

    // Before the cut, sit just outside the collision lane. The opponent sees a tempting head-on race,
    // while the duellist retains room to peel sharply at a non-obvious instant.
    const gap = ownRadius + targetRadius + 40;
    const baitDistance = clamp(distance * .56, 78, 154);
    const side = brain.sideCutSide;
    const aimX = target.x + Math.cos(target.angle) * baitDistance + Math.cos(target.angle + side * Math.PI / 2) * gap;
    const aimY = target.y + Math.sin(target.angle) * baitDistance + Math.sin(target.angle + side * Math.PI / 2) * gap;
    brain.mode = "duel";
    brain.targetClass = target.human ? "player" : "rival";
    brain.targetSnakeId = target.id;
    brain.targetX = aimX;
    brain.targetY = aimY;
    this.setBotHeading(bot, angleTo(bot.x, bot.y, aimX, aimY), clamp(distance * .74, 190, 440), "duel");
    bot.boosting = distance > 250 && traits.aggression > .72 && massLead > .02 && brain.lastCourseRisk < 14 && chance(.018 + traits.precision * .036);
    return true;
  }

  findDominantThreat(bot) {
    let best = null;
    let bestScore = 0;
    for (const other of this.snakes) {
      if (!other.alive || other.id === bot.id || other.invulnerable > 0) continue;
      if (other.mass < bot.mass * 1.18) continue;
      const distance = dist(bot.x, bot.y, other.x, other.y);
      if (distance > 780) continue;
      const towardBot = Math.cos(normalizeAngle(other.angle - angleTo(other.x, other.y, bot.x, bot.y)));
      const threat = (other.mass / Math.max(1, bot.mass) - 1) * 90 + (1 - distance / 780) * 46 + Math.max(0, towardBot) * 18;
      if (threat > bestScore) { bestScore = threat; best = other; }
    }
    return bestScore > 28 ? best : null;
  }

  planRetreat(bot, predator) {
    const brain = bot.brain;
    const away = angleTo(predator.x, predator.y, bot.x, bot.y);
    const home = angleTo(bot.x, bot.y, brain.homeX, brain.homeY);
    const retreatAngle = normalizeAngle(away * .72 + home * .28);
    brain.mode = "retreat";
    brain.targetClass = predator.human ? "player" : "rival";
    brain.targetSnakeId = null;
    brain.retreatUntil = this.elapsed + rand(1.3, 2.5);
    this.setBotHeading(bot, retreatAngle + brain.routeSide * .18, 620, "evade");
    bot.boosting = bot.mass > 30 && brain.lastCourseRisk < 16;
  }

  setBotHeading(bot, preferredAngle, lookAhead = 420, intent = "roam") {
    const brain = bot.brain;
    const heading = this.chooseSafeHeading(bot, preferredAngle, lookAhead, intent);
    bot.desiredAngle = heading;
    brain.targetX = bot.x + Math.cos(preferredAngle) * lookAhead;
    brain.targetY = bot.y + Math.sin(preferredAngle) * lookAhead;
    return heading;
  }

  chooseSafeHeading(bot, preferredAngle, lookAhead = 420, intent = "roam") {
    const offsets = intent === "evade"
      ? [0, -.25, .25, -.52, .52, -.82, .82, -1.12, 1.12]
      : intent === "encircle"
        ? [0, -.11, .11, -.24, .24, -.43, .43, -.68, .68, -.95, .95]
        : [0, -.14, .14, -.30, .30, -.54, .54, -.82, .82, -1.12, 1.12];
    let bestAngle = preferredAngle;
    let bestScore = -Infinity;
    const riskWeight = intent === "duel" ? 1.08 : intent === "encircle" ? 1.30 : intent === "feint" ? 1.22 : 1.55;
    for (const offset of offsets) {
      const angle = preferredAngle + offset;
      const risk = this.scoreCourse(bot, angle, lookAhead);
      const edgeRisk = this.scoreBoundaryRisk(bot, angle, lookAhead);
      const steeringCost = Math.abs(offset) * (intent === "evade" ? 9 : intent === "encircle" ? 11 : 18);
      const score = 120 - risk * riskWeight - edgeRisk * 1.72 - steeringCost;
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
        bot.brain.lastCourseRisk = risk;
      }
    }
    return bestAngle;
  }

  scoreBoundaryRisk(bot, angle, lookAhead) {
    const half = CFG.WORLD_SIZE * .5 - 95;
    const x = bot.x + Math.cos(angle) * lookAhead;
    const y = bot.y + Math.sin(angle) * lookAhead;
    const overflow = Math.max(0, Math.abs(x) - half) + Math.max(0, Math.abs(y) - half);
    return overflow * .6;
  }

  scoreCourse(bot, angle, lookAhead) {
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);
    const sideX = -fy;
    const sideY = fx;
    const ownRadius = this.getSnakeRadius(bot);
    let risk = 0;
    for (const other of this.snakes) {
      if (!other.alive || other.id === bot.id) continue;
      // Opposing heads are treated as moving hazards. This is what stops bot-vs-bot ramming.
      const headDx = other.x - bot.x;
      const headDy = other.y - bot.y;
      const headForward = dot2(headDx, headDy, fx, fy);
      if (headForward > -ownRadius && headForward < lookAhead * 1.08) {
        const headLateral = Math.abs(dot2(headDx, headDy, sideX, sideY));
        const headDistance = Math.hypot(headDx, headDy);
        const toward = Math.cos(normalizeAngle(other.angle - angleTo(other.x, other.y, bot.x, bot.y)));
        const clearance = ownRadius + this.getSnakeRadius(other) + 24;
        if (headLateral < clearance * 2.45 && toward > -.28) {
          risk += (1 - clamp(headLateral / (clearance * 2.45), 0, 1)) * (1 - clamp(headDistance / Math.max(1, lookAhead), 0, 1) * .48) * 152;
        }
      }
      const bodyRadius = this.getSnakeRadius(other) * .57;
      const stride = Math.max(2, Math.floor(other.trail.length / 32));
      const start = other.human ? 3 : 4;
      for (let index = start; index < other.trail.length; index += stride) {
        const point = other.trail[index];
        const dx = point.x - bot.x;
        const dy = point.y - bot.y;
        const forward = dot2(dx, dy, fx, fy);
        if (forward < -ownRadius || forward > lookAhead) continue;
        const lateral = Math.abs(dot2(dx, dy, sideX, sideY));
        const clearance = ownRadius + bodyRadius + 16;
        if (lateral < clearance * 1.55) {
          const proximity = 1 - lateral / (clearance * 1.55);
          const soon = 1 - clamp(forward / lookAhead, 0, 1) * .68;
          risk += proximity * soon * 126;
        }
      }
    }
    return risk;
  }

  getImmediateBodyThreat(bot, maxRange, ignoreSnakeId = null) {
    const fx = Math.cos(bot.angle);
    const fy = Math.sin(bot.angle);
    const ownRadius = this.getSnakeRadius(bot);
    let best = null;
    let bestUrgency = 0;
    for (const other of this.snakes) {
      if (!other.alive || other.id === bot.id || other.id === ignoreSnakeId) continue;
      const bodyRadius = this.getSnakeRadius(other) * .53;
      const stride = Math.max(3, Math.floor(other.trail.length / 20));
      const start = other.human ? 2 : 3;
      for (let index = start; index < other.trail.length; index += stride) {
        const point = other.trail[index];
        const dx = point.x - bot.x;
        const dy = point.y - bot.y;
        const distance = Math.hypot(dx, dy);
        if (distance > maxRange || distance < .001) continue;
        const forward = dot2(dx, dy, fx, fy) / distance;
        if (forward < -.18) continue;
        const lateral = Math.abs(cross2(fx, fy, dx, dy));
        const clearance = ownRadius + bodyRadius + 24;
        const corridor = clamp(1 - lateral / (clearance * 1.85 + distance * .18), 0, 1);
        const near = clamp(1 - distance / maxRange, 0, 1);
        const urgency = corridor * near * clamp((forward + .1) / 1.1, 0, 1);
        if (urgency > bestUrgency) {
          bestUrgency = urgency;
          best = { urgency, angle: Math.atan2(dy, dx), side: normalizeAngle(Math.atan2(dy, dx) - bot.angle) >= 0 ? -1 : 1 };
        }
      }
    }
    return best;
  }

  senseBodyDanger(bot, maxRange, ignoreSnakeId = null) {
    const fx = Math.cos(bot.angle);
    const fy = Math.sin(bot.angle);
    const ownRadius = this.getSnakeRadius(bot);
    let best = { distance: Infinity, urgency: 0, angle: bot.angle, side: bot.brain.routeSide, x: bot.x, y: bot.y };
    for (const other of this.snakes) {
      if (!other.alive || other.id === bot.id || other.id === ignoreSnakeId) continue;
      const stride = Math.max(2, Math.floor(other.trail.length / 28));
      const start = other.human ? 3 : 4; // heads are handled by tactics, bodies by collision avoidance
      const bodyRadius = this.getSnakeRadius(other) * .58;
      for (let index = start; index < other.trail.length; index += stride) {
        const point = other.trail[index];
        const dx = point.x - bot.x;
        const dy = point.y - bot.y;
        const distance = Math.hypot(dx, dy);
        if (distance > maxRange) continue;
        const a = Math.atan2(dy, dx);
        const forward = dot2(dx, dy, fx, fy) / Math.max(1, distance);
        const lateral = Math.abs(cross2(fx, fy, dx, dy));
        const clearance = ownRadius + bodyRadius + 18;
        const proximity = clamp(1 - distance / Math.max(1, maxRange), 0, 1);
        const front = clamp((forward + .18) / 1.18, 0, 1);
        // Only a body in the future travel corridor is an immediate steering threat.
        // A nearby snake to the side remains a tactical target instead of forcing an unnecessary escape.
        const corridorWidth = clearance * 1.35 + distance * .22;
        const corridor = clamp(1 - lateral / Math.max(1, corridorWidth), 0, 1);
        const emergency = clamp(1 - distance / Math.max(1, clearance * 2.45), 0, 1);
        const urgency = Math.max(emergency, proximity * front * corridor);
        if (urgency > best.urgency || (Math.abs(urgency - best.urgency) < .01 && distance < best.distance)) {
          best = {
            distance,
            urgency,
            angle: a,
            side: normalizeAngle(a - bot.angle) >= 0 ? -1 : 1,
            x: point.x,
            y: point.y
          };
        }
      }
    }
    return best;
  }

  senseHeadTraffic(bot, maxRange) {
    const fx = Math.cos(bot.angle);
    const fy = Math.sin(bot.angle);
    const ownRadius = this.getSnakeRadius(bot);
    let best = { distance: Infinity, urgency: 0, angle: bot.angle, side: bot.brain.routeSide, x: bot.x, y: bot.y };
    for (const other of this.snakes) {
      if (!other.alive || other.id === bot.id) continue;
      const dx = other.x - bot.x;
      const dy = other.y - bot.y;
      const distance = Math.hypot(dx, dy);
      if (distance > maxRange || distance < .001) continue;
      const toOther = Math.atan2(dy, dx);
      const ownFacing = Math.cos(normalizeAngle(bot.angle - toOther));
      const otherFacing = Math.cos(normalizeAngle(other.angle - (toOther + Math.PI)));
      const lateral = Math.abs(cross2(fx, fy, dx, dy));
      const clearance = ownRadius + this.getSnakeRadius(other) + 30;
      const closing = clamp((ownFacing + .18) * .62 + (otherFacing + .14) * .48, 0, 1);
      const corridor = clamp(1 - lateral / Math.max(1, clearance * 2.3), 0, 1);
      const near = clamp(1 - distance / Math.max(1, maxRange), 0, 1);
      const emergency = clamp(1 - distance / Math.max(1, clearance * 2.25), 0, 1);
      const urgency = Math.max(emergency, near * corridor * closing);
      if (urgency > best.urgency || (Math.abs(urgency - best.urgency) < .01 && distance < best.distance)) {
        best = { distance, urgency, angle: toOther, side: normalizeAngle(toOther - bot.angle) >= 0 ? -1 : 1, x: other.x, y: other.y };
      }
    }
    return best;
  }

  chooseAttackStyle(bot, target, distance) {
    const brain = bot.brain;
    const traits = bot.traits;
    const massLead = (bot.mass - target.mass) / Math.max(24, bot.mass);
    const targetFacing = Math.cos(normalizeAngle(target.angle - angleTo(target.x, target.y, bot.x, bot.y)));

    if (brain.archetype === "ловец" && massLead > .30 && distance > 150 && distance < 520) return "ring";
    if (distance < 265 && targetFacing > -.04) return "headbait";
    if (target.boosting && massLead > -.04) return "shadow";
    if (traits.aggression > .64 && massLead > .04 && chance(.46)) return "feint";
    if (brain.archetype === "дуэлянт" && distance < 470) return "headbait";
    return chance(.38 + traits.precision * .26) ? "cutoff" : "shadow";
  }

  planAttack(bot, target, distance) {
    const brain = bot.brain;
    const traits = bot.traits;
    const ownRadius = this.getSnakeRadius(bot);
    const targetRadius = this.getSnakeRadius(target);
    const directAngle = angleTo(bot.x, bot.y, target.x, target.y);
    const targetFacingBot = Math.cos(normalizeAngle(target.angle - angleTo(target.x, target.y, bot.x, bot.y)));
    const massLead = (bot.mass - target.mass) / Math.max(26, bot.mass);
    const headOn = this.getHeadOnDuel(bot, target, distance);
    if (headOn && this.planHeadOnDuel(bot, target, headOn)) return;

    // One pursuit plan stays active for a moment. The bot only changes side when its current lane
    // gets unsafe, which makes its movement read as intentional rather than twitchy.
    if (this.elapsed > brain.maneuverUntil) {
      if (chance(.12 + (1 - traits.precision) * .10)) brain.routeSide *= -1;
      brain.maneuverUntil = this.elapsed + rand(2.1, 4.3) + traits.precision * .9;
    }
    if (this.elapsed > brain.attackStyleUntil) {
      brain.attackStyle = this.chooseAttackStyle(bot, target, distance);
      brain.attackStyleUntil = this.elapsed + rand(1.55, 3.25) + traits.precision * .70;
      if (brain.attackStyle === "feint") {
        brain.feintUntil = this.elapsed + rand(.42, .86);
        const pre = this.predictSnake(target, .55);
        const feintLane = ownRadius + targetRadius * 1.85 + 56;
        brain.feintX = pre.x + Math.cos(target.angle + brain.routeSide * Math.PI / 2) * feintLane - Math.cos(target.angle) * 58;
        brain.feintY = pre.y + Math.sin(target.angle + brain.routeSide * Math.PI / 2) * feintLane - Math.sin(target.angle) * 58;
      }
    }

    // A trapper tries a ring before a normal intercept only when it has enough length and a real advantage.
    if (brain.attackStyle === "ring" && this.canEncircle(bot, target, distance)) {
      this.planEncircle(bot, target, true);
      return;
    }

    const leadSeconds = clamp(distance / Math.max(178, this.getBaseSpeed(bot) + (target.boosting ? 78 : 44)), .35, 1.95);
    const predicted = this.predictSnake(target, leadSeconds);
    const lane = ownRadius + targetRadius * 1.58 + 36;
    let aimX = predicted.x;
    let aimY = predicted.y;
    let intent = "cutoff";
    let mode = "cutoff";

    if (brain.attackStyle === "headbait" || (distance < 238 && targetFacingBot > .05)) {
      // Never charge a head directly. Slide to the projected side and invite the other snake to over-turn.
      const gap = ownRadius + targetRadius + 44;
      aimX = target.x + Math.cos(target.angle) * (72 + target.speed * .18) + Math.cos(target.angle + brain.routeSide * Math.PI / 2) * gap;
      aimY = target.y + Math.sin(target.angle) * (72 + target.speed * .18) + Math.sin(target.angle + brain.routeSide * Math.PI / 2) * gap;
      mode = "duel";
      intent = "duel";
    } else if (brain.attackStyle === "shadow") {
      // Match the prey's direction just outside its blind side, then cut in only if the lane stays safe.
      const shadowBehind = 84 + targetRadius * 2.1;
      aimX = predicted.x - Math.cos(target.angle) * shadowBehind + Math.cos(target.angle + brain.routeSide * Math.PI / 2) * lane * .92;
      aimY = predicted.y - Math.sin(target.angle) * shadowBehind + Math.sin(target.angle + brain.routeSide * Math.PI / 2) * lane * .92;
      mode = "shadow";
      intent = "duel";
    } else if (brain.attackStyle === "feint" && this.elapsed < brain.feintUntil) {
      // A short fake turn makes the later intercept much less mechanical.
      aimX = brain.feintX;
      aimY = brain.feintY;
      mode = "feint";
      intent = "feint";
    } else {
      // A standard, predictive body cut: aim ahead and off the side instead of at the current head.
      aimX = predicted.x + Math.cos(target.angle + brain.routeSide * Math.PI / 2) * lane;
      aimY = predicted.y + Math.sin(target.angle + brain.routeSide * Math.PI / 2) * lane;
      const preferred = angleTo(bot.x, bot.y, aimX, aimY);
      const directed = Math.cos(normalizeAngle(preferred - directAngle));
      mode = distance > 590 || directed > .32 ? "cutoff" : "pressure";
    }

    const preferred = angleTo(bot.x, bot.y, aimX, aimY);
    brain.mode = mode;
    brain.targetClass = target.human ? "player" : "rival";
    brain.targetX = aimX;
    brain.targetY = aimY;
    this.setBotHeading(bot, preferred, clamp(distance * .75, 260, 680), intent);

    const clearCourse = brain.lastCourseRisk < 18;
    const canBurst = clearCourse && bot.mass > 32 && massLead > .07 && distance > 290 && distance < 880;
    bot.boosting = canBurst && (brain.attackStyle === "cutoff" || brain.attackStyle === "shadow")
      && chance(.012 + traits.aggression * .062 + (target.boosting ? .048 : 0));
    if (target.human && (mode === "cutoff" || mode === "pressure" || mode === "duel")) {
      brain.lastEngagementAt = this.elapsed;
    }
  }

  getPincerPartner(bot, target) {
    let best = null;
    let bestScore = -Infinity;
    for (const ally of this.snakes) {
      if (!ally.alive || ally.human || ally.id === bot.id || ally.id === target.id) continue;
      const d = dist(bot.x, bot.y, ally.x, ally.y);
      if (d > 620) continue;
      const allyBrain = ally.brain;
      // Do not hijack a real duel or an active ring. A pincer is a short local opportunity.
      if (["encircle", "duel", "sidecut", "escape-ring", "trapped"].includes(allyBrain.mode)) continue;
      if (ally.mass < target.mass * .66 || ally.mass > target.mass * 1.72) continue;
      const targetDistance = dist(ally.x, ally.y, target.x, target.y);
      if (targetDistance > 760) continue;
      const directional = Math.cos(normalizeAngle(ally.angle - angleTo(ally.x, ally.y, target.x, target.y)));
      const score = (1 - d / 620) * 38 + (1 - targetDistance / 760) * 30 + directional * 12 + ally.traits.rivalry * 11;
      if (score > bestScore) { bestScore = score; best = ally; }
    }
    return bestScore > 30 ? best : null;
  }

  observeTargetTurn(bot, target) {
    const brain = bot.brain;
    const previous = Number.isFinite(brain.targetAngleSeen) ? brain.targetAngleSeen : target.angle;
    const delta = Math.abs(normalizeAngle(target.angle - previous));
    if (delta > .34) brain.targetTurnAt = this.elapsed;
    brain.targetAngleSeen = target.angle;
    return this.elapsed - brain.targetTurnAt < .62;
  }

  tryPlanPincer(bot, target, distance) {
    const brain = bot.brain;
    const traits = bot.traits;
    if (distance > 760 || distance < 145) return false;
    if (target.mass > bot.mass * 1.08 || bot.mass < 42) return false;
    if (this.elapsed < brain.flankUntil && brain.flankTargetId === target.id) {
      this.planPincer(bot, target, null);
      return true;
    }
    if (this.elapsed - brain.lastPincerAt < 9.5) return false;
    if (traits.aggression < .48 && traits.rivalry < .62) return false;
    const partner = this.getPincerPartner(bot, target);
    if (!partner) return false;
    const nearSameLane = Math.abs(normalizeAngle(angleTo(bot.x, bot.y, target.x, target.y) - angleTo(partner.x, partner.y, target.x, target.y))) < .55;
    if (nearSameLane) return false;
    const turnsHard = this.observeTargetTurn(bot, target);
    const skill = traits.precision * .32 + traits.rivalry * .22 + (brain.archetype === "охотник" ? .14 : 0);
    if (!turnsHard && !chance(.035 + skill * .10)) return false;
    const sideByPosition = Math.sign(cross2(Math.cos(target.angle), Math.sin(target.angle), bot.x - target.x, bot.y - target.y)) || brain.routeSide;
    brain.flankSide = sideByPosition;
    brain.flankTargetId = target.id;
    brain.flankRole = "close";
    brain.flankUntil = this.elapsed + rand(1.25, 2.35) + traits.precision * .55;
    brain.lastPincerAt = this.elapsed;
    this.planPincer(bot, target, partner);
    return true;
  }

  planPincer(bot, target, partner = null) {
    const brain = bot.brain;
    const ownRadius = this.getSnakeRadius(bot);
    const targetRadius = this.getSnakeRadius(target);
    const distance = dist(bot.x, bot.y, target.x, target.y);
    const lead = this.predictSnake(target, clamp(distance / 360, .28, 1.12));
    const side = brain.flankSide || brain.routeSide || 1;
    const spacing = ownRadius + targetRadius * 1.55 + 46;
    // The flank is an offset intercept, not a straight charge. With an ally on another
    // side it reads as two players closing a corridor while leaving an escape choice.
    const forward = target.angle;
    const lateral = forward + side * Math.PI / 2;
    const ahead = 70 + clamp(distance * .20, 25, 125);
    let aimX = lead.x + Math.cos(lateral) * spacing + Math.cos(forward) * ahead;
    let aimY = lead.y + Math.sin(lateral) * spacing + Math.sin(forward) * ahead;
    if (partner) {
      const allySide = Math.sign(cross2(Math.cos(target.angle), Math.sin(target.angle), partner.x - target.x, partner.y - target.y)) || -side;
      if (allySide === side) {
        aimX += Math.cos(forward) * 70;
        aimY += Math.sin(forward) * 70;
      }
    }
    brain.mode = "pincer";
    brain.targetClass = target.human ? "player" : "rival";
    brain.targetSnakeId = target.id;
    brain.targetX = aimX;
    brain.targetY = aimY;
    this.setBotHeading(bot, angleTo(bot.x, bot.y, aimX, aimY), clamp(distance * .72, 250, 620), "feint");
    const safeBurst = brain.lastCourseRisk < 14 && bot.mass > 34 && distance > 300 && distance < 690;
    bot.boosting = safeBurst && chance(.018 + bot.traits.precision * .042);
  }

  getSnakeBodyExtent(snake) {
    if (!snake?.trail?.length) return this.getSnakeRadius(snake);
    const stride = Math.max(1, Math.floor(snake.trail.length / 42));
    let reach = this.getSnakeRadius(snake);
    for (let index = 0; index < snake.trail.length; index += stride) {
      const point = snake.trail[index];
      reach = Math.max(reach, dist(snake.x, snake.y, point.x, point.y));
    }
    return reach + this.getSnakeRadius(snake) * .75;
  }

  getEncircleGeometry(bot, target) {
    const targetReach = this.getSnakeBodyExtent(target);
    const bodyLength = bot.trail.length * bot.trailSpacing;
    // The target's full visible body has to fit inside the loop, not merely its head radius.
    const minRadius = targetReach + this.getSnakeRadius(bot) * 2.15 + 42;
    // Keep enough spare length for the head-tail seam and gentle corrections while orbiting.
    const maxRadius = Math.max(0, (bodyLength - 72) / (TAU * .94));
    return { targetReach, bodyLength, minRadius, maxRadius };
  }

  canEncircle(bot, target, distance) {
    const brain = bot.brain;
    const traits = bot.traits;
    const edgeDistance = CFG.WORLD_SIZE / 2 - Math.max(Math.abs(bot.x), Math.abs(bot.y));
    if (this.elapsed - brain.lastEncircleAt < 11.0) return false;
    if (edgeDistance < 470) return false;
    if (traits.trapper < .40 || bot.mass < 82 || bot.mass < target.mass * 1.28) return false;
    if (target.mass > 132 && bot.mass < target.mass * 1.46) return false;
    const geometry = this.getEncircleGeometry(bot, target);
    if (distance < geometry.minRadius * .55 || distance > Math.min(780, geometry.maxRadius * 1.62)) return false;
    if (this.getTargetPressure(target, bot) > 0) return false;
    if (geometry.maxRadius < geometry.minRadius + 22) return false;

    // The chance is deliberately modest: a ring should feel like an earned move by a long, strong trapper,
    // not a behaviour every snake performs all the time.
    const archetypeBonus = brain.archetype === "ловец" ? .18 : brain.archetype === "охотник" ? .06 : 0;
    const advantage = clamp((bot.mass / Math.max(1, target.mass) - 1) * .18, 0, .16);
    const exposed = target.boosting ? .07 : 0;
    const playerSetup = target.human && brain.archetype === "ловец" && bot.mass > target.mass * 1.38 ? .055 : 0;
    return chance(.052 + archetypeBonus + traits.trapper * .070 + advantage + exposed + playerSetup);
  }

  planEncircle(bot, target, start) {
    const brain = bot.brain;
    const targetLead = this.predictSnake(target, clamp(dist(bot.x, bot.y, target.x, target.y) / 720, .20, .58));
    const geometry = this.getEncircleGeometry(bot, target);
    const bodyLength = geometry.bodyLength;
    const minRadius = geometry.minRadius;
    const maxRadius = geometry.maxRadius;

    if (maxRadius < minRadius + 12) {
      brain.mode = "pressure";
      brain.encircleStage = "none";
      this.planAttack(bot, target, dist(bot.x, bot.y, target.x, target.y));
      return;
    }

    if (start) {
      const initialDistance = Math.max(1, dist(bot.x, bot.y, targetLead.x, targetLead.y));
      brain.mode = "encircle";
      brain.targetClass = target.human ? "player" : "rival";
      brain.targetSnakeId = target.id;
      brain.encircleTargetId = target.id;
      brain.lastEncircleAt = this.elapsed;
      brain.encircleStartedAt = this.elapsed;
      brain.encircleLastAt = this.elapsed;
      brain.encircleTurns = 0;
      brain.encircleAnchorX = targetLead.x;
      brain.encircleAnchorY = targetLead.y;
      brain.encircleCenterX = targetLead.x;
      brain.encircleCenterY = targetLead.y;
      brain.encircleRadius = clamp(initialDistance * .96, minRadius + 12, maxRadius - 6);
      brain.encircleStage = initialDistance > brain.encircleRadius * 1.13 ? "approach" : "wrap";
      brain.encircleSealed = false;
      brain.routeSide = chance(.5) ? 1 : -1;
      brain.encircleLastOrbitAngle = Math.atan2(bot.y - brain.encircleCenterY, bot.x - brain.encircleCenterX);
      brain.encircleGapAngle = brain.encircleLastOrbitAngle;
      const wrapTime = TAU * brain.encircleRadius / Math.max(110, this.getBaseSpeed(bot));
      const settleTime = bodyLength / Math.max(110, this.getBaseSpeed(bot)) + 6.0;
      brain.encircleUntil = this.elapsed + clamp(Math.max(wrapTime * 1.45, settleTime), 16.0, 32.0);
    } else {
      const elapsed = Math.max(.01, this.elapsed - brain.encircleLastAt);
      brain.encircleLastAt = this.elapsed;
      const follow = brain.encircleTurns < TAU * .38 ? .26 : brain.encircleTurns < TAU * .82 ? .12 : .045;
      brain.encircleCenterX = lerp(brain.encircleCenterX, targetLead.x, clamp(elapsed * follow, 0, 1));
      brain.encircleCenterY = lerp(brain.encircleCenterY, targetLead.y, clamp(elapsed * follow, 0, 1));

      const orbitAngle = Math.atan2(bot.y - brain.encircleCenterY, bot.x - brain.encircleCenterX);
      const delta = normalizeAngle(orbitAngle - brain.encircleLastOrbitAngle);
      brain.encircleLastOrbitAngle = orbitAngle;
      // Count real angular progress around the target. This avoids a fake "closed ring" when a bot only wiggles nearby.
      const progress = delta * brain.routeSide;
      if (progress > -.08) brain.encircleTurns += Math.max(0, progress);
      if (brain.encircleTurns > TAU * .28) brain.encircleStage = "wrap";
      if (brain.encircleTurns > TAU * .82) brain.encircleStage = "seal";
      if (brain.encircleTurns > TAU * .94 && this.isEncircleLoopClosed(bot, brain)) {
        brain.encircleSealed = true;
        brain.encircleStage = "tighten";
      }
      if (brain.encircleSealed) {
        // A closed loop shrinks slowly. The trapped snake still has time to steer and react,
        // but standing still is no longer a safe option.
        brain.encircleRadius = Math.max(minRadius, brain.encircleRadius - elapsed * .92);
      }
    }

    const dx = bot.x - brain.encircleCenterX;
    const dy = bot.y - brain.encircleCenterY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const radial = Math.atan2(dy, dx);
    const radialBias = clamp((brain.encircleRadius - distance) / Math.max(1, brain.encircleRadius), -.62, .54);
    const tangent = radial + brain.routeSide * Math.PI / 2;
    const vx = Math.cos(tangent) + Math.cos(radial) * radialBias;
    const vy = Math.sin(tangent) + Math.sin(radial) * radialBias;
    const heading = Math.atan2(vy, vx);

    brain.targetX = brain.encircleCenterX + Math.cos(radial) * brain.encircleRadius;
    brain.targetY = brain.encircleCenterY + Math.sin(radial) * brain.encircleRadius;
    this.setBotHeading(bot, heading, clamp(brain.encircleRadius * 1.30, 250, 590), "encircle");

    const approaching = brain.encircleStage === "approach" && distance > brain.encircleRadius * 1.15;
    bot.boosting = approaching && bot.mass > 44 && brain.lastCourseRisk < 14 && chance(.055 + bot.traits.trapper * .045);
    const targetBrokeFree = dist(target.x, target.y, brain.encircleCenterX, brain.encircleCenterY) > brain.encircleRadius * 1.62 + 110;
    const maxRingDurationReached = this.elapsed - brain.encircleStartedAt > 44;
    if (brain.encircleSealed && !targetBrokeFree && !maxRingDurationReached) {
      // Once the body visibly closes, keep the pressure long enough for the target to make a real escape decision.
      brain.encircleUntil = Math.max(brain.encircleUntil, this.elapsed + 6.0);
    } else if (this.elapsed > brain.encircleUntil || targetBrokeFree || maxRingDurationReached) {
      brain.mode = "pressure";
      brain.encircleStage = "none";
      brain.encircleSealed = false;
      brain.lastEncircleAt = this.elapsed - 5.0;
    }
  }


  getRingCoverage(trapper, brain = trapper.brain) {
    const bins = 40;
    const covered = new Array(bins).fill(false);
    const minRadius = brain.encircleRadius * .62;
    const maxRadius = brain.encircleRadius * 1.42;
    const stride = Math.max(2, Math.floor(trapper.trail.length / 110));
    for (let index = 0; index < trapper.trail.length; index += stride) {
      const point = trapper.trail[index];
      const dx = point.x - brain.encircleCenterX;
      const dy = point.y - brain.encircleCenterY;
      const radius = Math.hypot(dx, dy);
      if (radius < minRadius || radius > maxRadius) continue;
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += TAU;
      covered[Math.floor(angle / TAU * bins) % bins] = true;
    }
    let filled = 0;
    let longestGap = 0;
    let run = 0;
    // Duplicate the ring walk so an empty gap spanning the 0-angle seam is measured correctly.
    for (let index = 0; index < bins * 2; index++) {
      if (covered[index % bins]) {
        filled += index < bins ? 1 : 0;
        longestGap = Math.max(longestGap, run);
        run = 0;
      } else {
        run += 1;
      }
    }
    longestGap = Math.max(longestGap, run);
    return { filled, longestGap, ratio: filled / bins };
  }

  isEncircleLoopClosed(trapper, brain = trapper.brain) {
    const tail = trapper.trail[trapper.trail.length - 1];
    if (!tail) return false;
    const gap = dist(trapper.x, trapper.y, tail.x, tail.y);
    const radius = this.getSnakeRadius(trapper);
    if (gap < radius * 4.6 + 54) return true;
    // A long snake can overlap its earlier arc before its literal tail returns to the head.
    // Angular coverage detects that visible closed loop and avoids waiting for an impossible head-tail kiss.
    if (brain.encircleTurns < TAU * .98) return false;
    const coverage = this.getRingCoverage(trapper, brain);
    return coverage.ratio >= .88 && coverage.longestGap <= 4;
  }

  getActiveEnclosure(target) {
    if (!target?.alive) return null;
    let best = null;
    for (const trapper of this.snakes) {
      if (!trapper.alive || trapper.human || trapper.id === target.id) continue;
      const brain = trapper.brain;
      if (brain.mode !== "encircle" || brain.encircleTargetId !== target.id || brain.encircleUntil <= this.elapsed) continue;
      const centerDistance = dist(target.x, target.y, brain.encircleCenterX, brain.encircleCenterY);
      if (centerDistance > brain.encircleRadius * 1.46 + 92) continue;
      if (!best || brain.encircleTurns > best.brain.encircleTurns) best = trapper;
    }
    return best;
  }

  getRingOpening(trapper) {
    const brain = trapper.brain;
    const tail = trapper.trail[trapper.trail.length - 1] ?? trapper.trail[0];
    const headA = Math.atan2(trapper.y - brain.encircleCenterY, trapper.x - brain.encircleCenterX);
    const tailA = Math.atan2(tail.y - brain.encircleCenterY, tail.x - brain.encircleCenterX);
    const hx = trapper.x - brain.encircleCenterX;
    const hy = trapper.y - brain.encircleCenterY;
    const tx = tail.x - brain.encircleCenterX;
    const ty = tail.y - brain.encircleCenterY;
    const gapX = (hx + tx) * .5;
    const gapY = (hy + ty) * .5;
    const gapAngle = Math.atan2(gapY, gapX);
    const gapWidth = dist(trapper.x, trapper.y, tail.x, tail.y);
    const closed = brain.encircleSealed || (brain.encircleTurns > TAU * .92 && this.isEncircleLoopClosed(trapper, brain));
    return {
      angle: Number.isFinite(gapAngle) ? gapAngle : headA,
      width: gapWidth,
      closed,
      x: brain.encircleCenterX + Math.cos(gapAngle) * brain.encircleRadius,
      y: brain.encircleCenterY + Math.sin(gapAngle) * brain.encircleRadius,
      headAngle: headA,
      tailAngle: tailA
    };
  }

  planEscapeEnclosure(bot, trapper) {
    const brain = bot.brain;
    const enemy = trapper.brain;
    const opening = this.getRingOpening(trapper);
    const centerX = enemy.encircleCenterX;
    const centerY = enemy.encircleCenterY;
    const ownAngle = Math.atan2(bot.y - centerY, bot.x - centerX);
    const ownRadius = Math.max(1, dist(bot.x, bot.y, centerX, centerY));
    const delta = normalizeAngle(opening.angle - ownAngle);
    const along = ownAngle + (delta >= 0 ? 1 : -1) * Math.PI / 2;
    const nearGap = Math.abs(delta) < .32 && ownRadius > enemy.encircleRadius * .55;
    let preferred;

    if (!opening.closed) {
      // Before the loop seals, a believable bot does not point blindly through the wall.
      // It first arcs along the inside and then bursts into the visible head-tail gap.
      preferred = nearGap ? angleTo(bot.x, bot.y, opening.x, opening.y) : along + delta * .30;
      bot.boosting = bot.mass > 28 && brain.lastCourseRisk < 19 && (nearGap || Math.abs(delta) < .74);
      brain.mode = "escape-ring";
    } else {
      // Once sealed, remain just inside the ring and shadow the seam. A closing circle is dangerous,
      // but the bot still looks for a gap instead of spinning randomly in the centre.
      const safeRadius = Math.max(28, enemy.encircleRadius - this.getSnakeRadius(bot) * 2.4 - 13);
      const radialError = clamp((safeRadius - ownRadius) / safeRadius, -.42, .42);
      const tangent = ownAngle + (delta >= 0 ? 1 : -1) * Math.PI / 2;
      const vx = Math.cos(tangent) + Math.cos(ownAngle) * radialError;
      const vy = Math.sin(tangent) + Math.sin(ownAngle) * radialError;
      preferred = Math.atan2(vy, vx) + delta * .15;
      bot.boosting = false;
      brain.mode = "trapped";
    }
    brain.targetSnakeId = trapper.id;
    brain.targetClass = "rival";
    this.setBotHeading(bot, preferred, clamp(enemy.encircleRadius * 1.12, 210, 500), "evade");
  }

  planRoam(bot) {
    const brain = bot.brain;
    const traits = bot.traits;
    const fromHome = dist(bot.x, bot.y, brain.homeX, brain.homeY);
    const nearRoamPoint = dist(bot.x, bot.y, brain.roamX, brain.roamY) < 120;
    if (fromHome > brain.territoryRadius * 1.25) {
      brain.mode = "return";
      brain.targetClass = "none";
      this.setBotHeading(bot, angleTo(bot.x, bot.y, brain.homeX, brain.homeY), 560, "roam");
      bot.boosting = fromHome > brain.territoryRadius * 1.55 && bot.mass > 32 && brain.lastCourseRisk < 18;
      return;
    }
    if (this.elapsed > brain.roamUntil || nearRoamPoint) {
      brain.patrolPhase += rand(.65, 1.45) * brain.routeSide;
      const ring = rand(.25, .88) * brain.territoryRadius;
      brain.roamX = clamp(brain.homeX + Math.cos(brain.patrolPhase) * ring + rand(-90, 90), -CFG.WORLD_SIZE * .44, CFG.WORLD_SIZE * .44);
      brain.roamY = clamp(brain.homeY + Math.sin(brain.patrolPhase * 1.17) * ring + rand(-90, 90), -CFG.WORLD_SIZE * .44, CFG.WORLD_SIZE * .44);
      brain.roamUntil = this.elapsed + rand(4.2, 8.6);
      if (chance(.24)) brain.routeSide *= -1;
    }
    brain.mode = "roam";
    brain.targetClass = "none";
    const sway = Math.sin(this.elapsed * (.36 + traits.showOff * .2) + brain.planPhase) * .08;
    this.setBotHeading(bot, angleTo(bot.x, bot.y, brain.roamX, brain.roamY) + sway, 520, "roam");
    bot.boosting = traits.showOff > .88 && chance(.006) && brain.lastCourseRisk < 10;
  }

  predictSnake(snake, seconds) {
    const speed = Math.max(72, snake.speed || this.getBaseSpeed(snake));
    return {
      x: snake.x + Math.cos(snake.angle) * speed * seconds,
      y: snake.y + Math.sin(snake.angle) * speed * seconds
    };
  }

  getTargetPressure(target, exceptBot = null) {
    let pressure = 0;
    for (const snake of this.snakes) {
      if (!snake.alive || snake.human || snake.id === exceptBot?.id) continue;
      if (snake.brain.targetSnakeId !== target.id) continue;
      if (["cutoff", "pressure", "duel", "encircle", "pincer", "flank"].includes(snake.brain.mode)) pressure += 1;
    }
    return pressure;
  }

  pickCombatTarget(bot) {
    const brain = bot.brain;
    const traits = bot.traits;
    const validCurrent = this.snakes.find((snake) => snake.alive && snake.id === brain.targetSnakeId && snake.invulnerable <= 0);
    const isValid = (target, keepCurrent = false) => {
      if (!target || !target.alive || target.id === bot.id || target.invulnerable > 0) return false;
      const distance = dist(bot.x, bot.y, target.x, target.y);
      if (distance > 1080) return false;
      const targetAtHome = dist(target.x, target.y, brain.homeX, brain.homeY);
      const pressure = this.getTargetPressure(target, bot);

      if (target.human) {
        const seenRecently = this.elapsed - brain.lastSeenPlayerAt < 3.2;
        const localReach = Math.max(770, brain.territoryRadius * 1.28);
        const allowedByCooldown = keepCurrent || this.elapsed >= brain.playerAttackCooldownUntil;
        if (!seenRecently || distance > localReach || !allowedByCooldown) return false;
        // One active enemy is enough to feel personal; more reads as a swarm.
        if (pressure > 0) return false;
      } else {
        if (targetAtHome > brain.territoryRadius * 1.40 && distance > 430) return false;
        if (pressure > 0) return false;
      }
      if (target.mass > bot.mass * 1.24 && !(brain.archetype === "дуэлянт" && distance < 300 && target.mass <= bot.mass * 1.10)) return false;
      return true;
    };

    if (validCurrent && brain.targetLockFor > 0 && isValid(validCurrent, true)) return validCurrent;

    let best = null;
    let bestScore = -Infinity;
    for (const target of this.snakes) {
      if (!isValid(target)) continue;
      const distance = dist(bot.x, bot.y, target.x, target.y);
      const massEdge = (bot.mass - target.mass) / Math.max(24, bot.mass);
      const targetAtHome = dist(target.x, target.y, brain.homeX, brain.homeY);
      const proximity = clamp(1 - distance / 1080, 0, 1) * 28;
      const territorial = clamp(1 - targetAtHome / Math.max(1, brain.territoryRadius * 1.28), 0, 1) * 18;
      const opportunity = target.boosting ? 13 : 0;
      const vulnerable = target.mass < bot.mass * .70 ? 13 : 0;
      const advantage = massEdge * 100;
      let score;
      if (target.human) {
        const hunterBonus = brain.archetype === "охотник" ? 22 : brain.archetype === "ловец" ? 11 : 0;
        const timeSeen = clamp((brain.playerInterestUntil - this.elapsed) / 2.8, 0, 1) * 14;
        const boldness = traits.aggression * 16 + traits.playerFocus * 24;
        const dangerTax = target.mass > bot.mass * 1.04 ? 30 : 0;
        score = -8 + hunterBonus + boldness + timeSeen + territorial + proximity + advantage + opportunity + vulnerable - dangerTax;
      } else {
        const rivalry = 20 + traits.rivalry * 27 + territorial + (target.mass > 54 ? 7 : 0);
        score = rivalry + proximity + advantage + opportunity + vulnerable + rand(-2.0, 2.0);
      }
      if (score > bestScore) { bestScore = score; best = target; }
    }

    const threshold = brain.archetype === "собиратель" ? 48 : brain.archetype === "охотник" ? 28 : 34;
    if (best && bestScore > threshold) {
      brain.targetSnakeId = best.id;
      brain.targetLockFor = rand(2.8, 5.4) + traits.precision * 1.8;
      brain.lastTargetChangeAt = this.elapsed;
      brain.attackStyle = this.chooseAttackStyle(bot, best, dist(bot.x, bot.y, best.x, best.y));
      brain.attackStyleUntil = this.elapsed + rand(1.55, 3.25) + traits.precision * .70;
      if (best.human) {
        brain.lastSeenPlayerAt = this.elapsed;
        brain.playerAttackCooldownUntil = this.elapsed + rand(6.5, 12.0);
        brain.lastEngagementAt = this.elapsed;
      }
      return best;
    }

    brain.targetSnakeId = null;
    brain.targetLockFor = 0;
    return null;
  }

  getBestFoodInPile(bot, pile) {
    let best = null;
    let bestScore = -Infinity;
    for (const food of this.food) {
      if (!food || food.pileId !== pile.id) continue;
      const distance = dist(bot.x, bot.y, food.x, food.y);
      const score = food.value * 28 - distance * .11;
      if (score > bestScore) { bestScore = score; best = food; }
    }
    return best;
  }

  pickLootOpportunity(bot) {
    const brain = bot.brain;
    const traits = bot.traits;
    let best = null;
    let bestScore = -Infinity;
    for (const pile of this.lootPiles) {
      if (!pile || pile.remainingValue <= .16 || this.elapsed >= pile.expiresAt) continue;
      const distance = dist(bot.x, bot.y, pile.x, pile.y);
      const committed = brain.lootPileId === pile.id && brain.lootInterestUntil > this.elapsed;
      const localReach = committed ? CFG.LOOT_ALERT_RADIUS : Math.min(CFG.LOOT_ALERT_RADIUS, brain.territoryRadius * 1.66 + 170);
      if (distance > localReach) continue;
      const food = this.getBestFoodInPile(bot, pile);
      if (!food) continue;
      const ownership = committed ? 34 : 0;
      const killBonus = pile.killerId === bot.id ? 12 : 0;
      const freshness = clamp((pile.expiresAt - this.elapsed) / CFG.LOOT_PILE_TTL, 0, 1) * 7;
      const contestBonus = this.countLootContenders(bot, pile) > 0 ? traits.aggression * 16 + traits.rivalry * 12 : 0;
      const safety = this.sampleFoodSafety(bot, food) * (0.42 + traits.caution * .28);
      const score = pile.remainingValue * (12 + traits.greed * 11)
        + food.value * 38
        + ownership + killBonus + freshness + contestBonus
        - distance * .085
        - safety * 18;
      if (score > bestScore) { bestScore = score; best = { pile, food, distance, score }; }
    }
    return bestScore > 35 ? best : null;
  }

  countLootContenders(bot, pile) {
    let count = 0;
    for (const other of this.snakes) {
      if (!other?.alive || other.id === bot.id) continue;
      const brain = other.brain;
      const nearPile = dist(other.x, other.y, pile.x, pile.y) < 250;
      if (brain?.lootPileId === pile.id || nearPile) count += 1;
    }
    return count;
  }

  pickLootContestTarget(bot, loot) {
    const pile = loot.pile;
    const traits = bot.traits;
    if (this.countLootContenders(bot, pile) <= 0) return null;
    const assertive = traits.aggression * .66 + traits.rivalry * .52 + (bot.brain.archetype === "охотник" ? .18 : 0);
    if (assertive < .62 || bot.mass < 30) return null;
    let best = null;
    let bestScore = -Infinity;
    for (const target of this.snakes) {
      if (!target?.alive || target.id === bot.id || target.invulnerable > 0) continue;
      const targetPileDistance = dist(target.x, target.y, pile.x, pile.y);
      const claimsLoot = target.brain?.lootPileId === pile.id || targetPileDistance < 240;
      if (!claimsLoot) continue;
      const distance = dist(bot.x, bot.y, target.x, target.y);
      if (distance > 620 || targetPileDistance > 360) continue;
      const massRatio = bot.mass / Math.max(1, target.mass);
      if (massRatio < .88) continue;
      const proximity = clamp(1 - distance / 620, 0, 1) * 34;
      const advantage = clamp(massRatio - 1, -.12, .7) * 46;
      const rivalBonus = target.human ? 4 : 14;
      const score = proximity + advantage + rivalBonus + pile.remainingValue * .65 + rand(-1.8, 1.8);
      if (score > bestScore) { bestScore = score; best = target; }
    }
    return bestScore > 39 ? best : null;
  }

  planLoot(bot, loot) {
    const brain = bot.brain;
    const { pile, food, distance } = loot;
    brain.mode = "loot";
    brain.targetClass = "loot";
    brain.targetSnakeId = null;
    brain.targetFoodId = food.id;
    brain.lootPileId = pile.id;
    brain.lootX = pile.x;
    brain.lootY = pile.y;
    brain.lootInterestUntil = Math.max(brain.lootInterestUntil, this.elapsed + 1.2 + bot.traits.greed * 1.45);
    this.setBotHeading(bot, angleTo(bot.x, bot.y, food.x, food.y), clamp(distance * .70, 180, 620), "collect");
    const clearSprint = brain.lastCourseRisk < 15 && bot.mass > 31 && distance > 280 && pile.remainingValue > 5.0;
    bot.boosting = clearSprint && (bot.traits.greed > .58 || pile.killerId === bot.id) && chance(.020 + bot.traits.greed * .048);
  }

  planLootContest(bot, target, loot) {
    const brain = bot.brain;
    const pile = loot.pile;
    brain.lootPileId = pile.id;
    brain.lootX = pile.x;
    brain.lootY = pile.y;
    brain.lootInterestUntil = Math.max(brain.lootInterestUntil, this.elapsed + 1.7);
    brain.lootContestUntil = this.elapsed + 1.3 + bot.traits.rivalry * 1.1;
    brain.targetSnakeId = target.id;
    brain.targetClass = "loot-rival";
    brain.targetLockFor = Math.max(brain.targetLockFor, 1.15 + bot.traits.precision * .9);
    const distance = dist(bot.x, bot.y, target.x, target.y);
    const duel = this.getHeadOnDuel(bot, target, distance);
    if (duel && this.planHeadOnDuel(bot, target, duel)) return;
    this.planAttack(bot, target, distance);
    // Preserve the loot context even though planAttack sets a generic rival class.
    brain.targetClass = "loot-rival";
  }

  shouldPrioritizeForage(bot, food) {
    if (!food) return false;
    const brain = bot.brain;
    const hungry = bot.mass < (brain.growthTarget ?? bot.mass + 60);
    const collector = brain.archetype === "собиратель";
    const valuable = food.source === "death" || food.value >= 1.25;
    const recentlyFought = this.elapsed - (brain.lastEngagementAt ?? -999) < .55;
    if (recentlyFought && !valuable) return false;
    return collector || (hungry && bot.traits.greed > .36) || (valuable && bot.traits.greed > .52);
  }

  planFoodRun(bot, food) {
    const brain = bot.brain;
    brain.mode = food.source === "death" ? "scavenge" : "collect";
    brain.targetFoodId = food.id;
    brain.targetClass = food.source === "death" ? "loot" : "food";
    brain.targetX = food.x;
    brain.targetY = food.y;
    brain.feedFocusUntil = this.elapsed + rand(.7, 1.45);
    const distance = dist(bot.x, bot.y, food.x, food.y);
    this.setBotHeading(bot, angleTo(bot.x, bot.y, food.x, food.y), clamp(distance * .78, 170, 600), "collect");
    const canSprint = distance > 260 && food.value > .95 && bot.mass > 28 && brain.lastCourseRisk < 15;
    bot.boosting = canSprint && chance(.012 + bot.traits.greed * .048);
  }

  pickFoodTarget(bot) {
    const traits = bot.traits;
    let best = null;
    let bestScore = -Infinity;
    const scanCount = Math.min(this.food.length, 85 + Math.floor(traits.greed * 75));
    const start = (hash32(`${bot.id}:${Math.floor(this.elapsed * 2)}`) % Math.max(1, this.food.length));
    for (let offset = 0; offset < scanCount; offset++) {
      const food = this.food[(start + offset * 7) % this.food.length];
      if (!food) continue;
      const distance = dist(bot.x, bot.y, food.x, food.y);
      if (distance > 980) continue;
      const atHome = dist(food.x, food.y, bot.brain.homeX, bot.brain.homeY);
      if (atHome > bot.brain.territoryRadius * 1.48 && distance > 360) continue;
      const safety = this.sampleFoodSafety(bot, food);
      const deathBonus = food.source === "death" ? 28 + traits.greed * 18 : 0;
      const score = food.value * (98 + traits.greed * 108) + deathBonus - distance * .092 - safety * (70 + traits.caution * 96) + rand(-3, 3);
      if (score > bestScore) { bestScore = score; best = food; }
    }
    return best;
  }

  sampleFoodSafety(bot, food) {
    let penalty = 0;
    const contestScale = food?.source === "death" ? .48 + bot.traits.caution * .20 : 1;
    for (const other of this.snakes) {
      if (!other.alive || other.id === bot.id) continue;
      const distance = dist(food.x, food.y, other.x, other.y);
      if (distance < 320) penalty += ((320 - distance) / 86) * contestScale;
    }
    return penalty;
  }

  stepSnake(snake, dt) {
    if (!snake.alive) return;
    snake.invulnerable = Math.max(0, snake.invulnerable - dt);
    const turnSpeed = snake.human ? 3.65 : 2.85 + snake.traits.precision * 2.10;
    snake.angle = turnToward(snake.angle, snake.desiredAngle, turnSpeed * dt);
    const baseSpeed = this.getBaseSpeed(snake) * (snake.human ? 1 : .94);
    const boost = snake.boosting ? 72 : 0;
    snake.speed = baseSpeed + boost;
    snake.x += Math.cos(snake.angle) * snake.speed * dt;
    snake.y += Math.sin(snake.angle) * snake.speed * dt;
    snake.glow = snake.boosting ? 1 : Math.max(0, snake.glow - dt * 3);

    const half = CFG.WORLD_SIZE * .5;
    if (Math.abs(snake.x) > half || Math.abs(snake.y) > half) {
      // The arena wall is lethal to bots and the player alike. Bots avoid it in decideBot;
      // they are not silently clamped back into the world anymore.
      this.killSnake(snake, null, "разбился о границу арены");
      return;
    }

    // A smoothed follower chain removes the visible tail snap caused by inserting and deleting history points.
    const spacing = clamp(5.4 + Math.sqrt(snake.mass) * .13, 6.0, 8.6);
    snake.trailSpacing = lerp(snake.trailSpacing || spacing, spacing, clamp(dt * 4.2, 0, 1));
    if (!snake.trail.length) snake.trail.push({ x: snake.x, y: snake.y });
    snake.trail[0].x = snake.x;
    snake.trail[0].y = snake.y;
    // The body target is fractional. Instead of adding a full segment every time mass crosses a threshold,
    // the visible tail tip travels through the last segment at a fixed, gentle speed.
    const targetTrail = this.getTailPointTarget(snake);
    snake.tailTargetCount = targetTrail;
    if (!Number.isFinite(snake.tailRenderCount)) snake.tailRenderCount = Math.min(snake.trail.length, targetTrail);
    const renderDelta = targetTrail - snake.tailRenderCount;
    const renderRate = renderDelta >= 0 ? 1.55 : 2.55;
    const renderStep = renderRate * dt * (1 + Math.min(.45, Math.abs(renderDelta) * .018));
    if (Math.abs(renderDelta) <= renderStep) snake.tailRenderCount = targetTrail;
    else snake.tailRenderCount += Math.sign(renderDelta) * renderStep;

    const requiredTrail = clamp(Math.ceil(snake.tailRenderCount), 18, this.getTailPointCap(snake));
    // There is always one real follower point ready for the fractional draw step.
    while (snake.trail.length < requiredTrail) {
      const tail = snake.trail[snake.trail.length - 1];
      const prev = snake.trail[snake.trail.length - 2] ?? { x: tail.x + Math.cos(snake.angle), y: tail.y + Math.sin(snake.angle) };
      let dx = tail.x - prev.x;
      let dy = tail.y - prev.y;
      let d = Math.hypot(dx, dy);
      if (d < .001) { dx = -Math.cos(snake.angle); dy = -Math.sin(snake.angle); d = 1; }
      snake.trail.push({ x: tail.x + dx / d * snake.trailSpacing, y: tail.y + dy / d * snake.trailSpacing });
    }
    // Trim only hidden spare points, and do it gradually so shrink effects are just as calm as growth.
    const spareLimit = Math.min(this.getTailPointCap(snake), Math.ceil(snake.tailRenderCount) + 1);
    if (snake.trail.length > spareLimit) {
      snake.tailTrimAccumulator = Math.min(2.2, (snake.tailTrimAccumulator || 0) + dt * 3.5);
      while (snake.tailTrimAccumulator >= 1 && snake.trail.length > spareLimit) {
        snake.tailTrimAccumulator -= 1;
        snake.trail.pop();
      }
    } else {
      snake.tailTrimAccumulator = 0;
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let index = 1; index < snake.trail.length; index++) {
        const previous = snake.trail[index - 1];
        const point = snake.trail[index];
        let dx = point.x - previous.x;
        let dy = point.y - previous.y;
        let d = Math.hypot(dx, dy);
        if (d < .001) { dx = -Math.cos(snake.angle); dy = -Math.sin(snake.angle); d = 1; }
        const targetX = previous.x + dx / d * snake.trailSpacing;
        const targetY = previous.y + dy / d * snake.trailSpacing;
        const response = 1 - Math.exp(-dt * (25 - index / Math.max(1, snake.trail.length) * 10));
        point.x = lerp(point.x, targetX, response);
        point.y = lerp(point.y, targetY, response);
      }
    }
  }

  updateDeathEchoes(dt) {
    for (let index = this.deathEchoes.length - 1; index >= 0; index--) {
      const echo = this.deathEchoes[index];
      echo.age += dt;
      if (echo.age >= echo.ttl) this.deathEchoes.splice(index, 1);
    }
  }

  updateFood(dt) {
    for (let index = this.food.length - 1; index >= 0; index--) {
      const food = this.food[index];
      food.pulse += dt * (1.1 + food.value);
      food.shimmer += dt * (1.6 + food.value * .7);
      food.age += dt;
      if (food.age >= food.ttl) this.food.splice(index, 1);
    }
    for (const snake of this.snakes) {
      if (!snake.alive) continue;
      const radius = this.getSnakeRadius(snake);
      for (let index = this.food.length - 1; index >= 0; index--) {
        const food = this.food[index];
        const eatRadius = radius + food.radius + 2;
        if (distSq(snake.x, snake.y, food.x, food.y) <= eatRadius * eatRadius) {
          snake.mass += food.value;
          if (snake.human) {
            this.progress.totalFood += 1;
            this.matchStats.food += 1;
            this.addDailyFood();
            this.addMissionProgress("food", 1);
          } else if (snake.brain && snake.mass >= (snake.brain.growthTarget ?? Infinity)) {
            // A completed feeding goal turns into the next, slightly harder target.
            snake.brain.growthTarget += rand(38, 92) + snake.mass * .04;
            snake.brain.feedFocusUntil = this.elapsed + rand(.45, 1.15);
          }
          this.food.splice(index, 1);
        }
      }
    }
    this.updateLootPiles();
  }

  updateRespawns(dt) {
    for (let index = this.respawnQueue.length - 1; index >= 0; index--) {
      const queued = this.respawnQueue[index];
      queued.delay -= dt;
      if (queued.delay <= 0) {
        this.respawnQueue.splice(index, 1);
        this.spawnBot(queued.index, { respawn: true });
      }
    }
  }

  resolveCollisions() {
    // Any head-to-body contact is lethal. We test against short tail capsules instead of
    // isolated points, so a fast head cannot slip through a gap between tail samples.
    for (const snake of this.snakes) {
      if (!snake.alive || snake.invulnerable > 0) continue;
      const headRadius = this.getSnakeRadius(snake) * .72;
      let killed = false;
      for (const other of this.snakes) {
        if (killed || !other.alive || other.id === snake.id || other.trail.length < 5) continue;
        const bodyRadius = this.getSnakeRadius(other) * .56;
        const hitRadius = headRadius + bodyRadius + 1.2;
        const stride = clamp(Math.floor(other.trail.length / 94), 1, 4);
        const start = 3; // the first points belong to the separate head-to-head duel rule
        for (let index = start; index < other.trail.length - 1; index += stride) {
          const from = other.trail[index];
          const to = other.trail[Math.min(other.trail.length - 1, index + stride)];
          if (pointSegmentDistanceSq(snake.x, snake.y, from.x, from.y, to.x, to.y) >= hitRadius * hitRadius) continue;
          this.killSnake(snake, other, `врезался в ${other.name}`);
          killed = true;
          break;
        }
      }
    }

    // Head-to-head contact is a real duel. The smaller snake loses; equal-sized opponents destroy each other.
    for (let a = 0; a < this.snakes.length; a++) {
      const left = this.snakes[a];
      if (!left?.alive || left.invulnerable > 0) continue;
      for (let b = a + 1; b < this.snakes.length; b++) {
        const right = this.snakes[b];
        if (!right?.alive || right.invulnerable > 0) continue;
        const hit = (this.getSnakeRadius(left) + this.getSnakeRadius(right)) * .46;
        if (distSq(left.x, left.y, right.x, right.y) > hit * hit) continue;
        // A true head-on/side-cut collision is lethal. Near-parallel heads instead peel away,
        // which prevents bots from dying while simply sharing a lane.
        const line = angleTo(left.x, left.y, right.x, right.y);
        const leftClosing = Math.cos(normalizeAngle(left.angle - line));
        const rightClosing = Math.cos(normalizeAngle(right.angle - (line + Math.PI)));
        if (leftClosing + rightClosing < .52) {
          const turn = normalizeAngle(line + (left.brain?.routeSide || 1) * Math.PI / 2);
          if (!left.human) { left.desiredAngle = turn; left.brain.mode = "yield"; left.brain.yieldUntil = this.elapsed + .45; }
          if (!right.human) { right.desiredAngle = normalizeAngle(turn + Math.PI); right.brain.mode = "yield"; right.brain.yieldUntil = this.elapsed + .45; }
          continue;
        }
        const difference = Math.abs(left.mass - right.mass) / Math.max(1, Math.max(left.mass, right.mass));
        if (difference < .12) {
          this.killSnake(left, right, `столкнулся лоб в лоб с ${right.name}`);
          this.killSnake(right, left, `столкнулся лоб в лоб с ${left.name}`);
        } else {
          const winner = left.mass > right.mass ? left : right;
          const loser = winner === left ? right : left;
          this.killSnake(loser, winner, `проиграл лобовую дуэль ${winner.name}`);
        }
      }
    }
  }

  async killSnake(snake, killer, reason) {
    if (!snake.alive) return;
    snake.alive = false;
    snake.boosting = false;
    const trail = snake.trail.slice(0);
    if (!snake.human && trail.length > 1) {
      this.deathEchoes.push({ trail, skinId: snake.skinId, mass: snake.mass, age: 0, ttl: .52 });
      if (this.deathEchoes.length > 8) this.deathEchoes.shift();
    }
    // A kill produces a satisfying, readable burst of loot. The pieces belong to one short-lived pile,
    // so nearby rivals can race for it and occasionally challenge one another for the reward.
    const chunks = clamp(Math.floor(snake.mass * .14 + 7), 10, 28);
    const value = clamp(snake.mass * .57 / chunks, .70, 3.0);
    this.registerDeathLoot(snake, killer, trail, chunks, value);

    if (!snake.human) {
      if (killer?.human) {
        this.progress.totalKills += 1;
        this.matchStats.kills += 1;
        this.addMissionProgress("duel", 1);
      }
      this.respawnQueue.push({ delay: rand(7.5, 13.0), index: snake.brain?.sectorIndex ?? this.respawnQueue.length });
      return;
    }

    this.running = false;
    this.mode = "death";
    await this.bridge.gameplayStop();
    this.deathSnapshot = {
      mass: Math.round(snake.mass * 10) / 10,
      skinId: snake.skinId,
      angle: snake.angle,
      x: 0,
      y: 0,
      reason: reason ?? "столкновение"
    };
    this.progress.bestMass = Math.max(this.progress.bestMass, snake.mass);
    this.unlockScoreSkins(true);
    await this.persistProgress();
    await this.tryDeathInterstitial();
    this.mode = "over";
    this.showGameOver();
  }

  async tryDeathInterstitial() {
    const due = this.isInterstitialDue() && !this.interstitialPending;
    if (!due) return;
    this.interstitialPending = true;
    try {
      const shown = await this.bridge.showInterstitial();
      if (shown) this.playSecondsSinceInterstitial = 0;
    } finally {
      this.interstitialPending = false;
    }
  }

  isInterstitialDue() {
    return this.playSecondsSinceInterstitial >= CFG.INTERSTITIAL_COOLDOWN_SECONDS;
  }

  async revive() {
    if (this.reviveUsed || !this.deathSnapshot) return;
    const button = this.ui.overlay.querySelector('[data-action="revive"]');
    if (button) {
      button.disabled = true;
      button.textContent = "Загрузка видео…";
    }
    const rewarded = await this.bridge.showRewarded("revive");
    if (!rewarded) {
      this.toast("Видео сейчас недоступно. Начни новый забег.");
      if (button) {
        button.disabled = false;
        button.textContent = "▶ Продолжить после видео";
      }
      return;
    }
    const snapshot = this.deathSnapshot;
    this.reviveUsed = true;
    this.toast("Второй шанс: вес сохранён.");
    await this.beginMatch(snapshot);
  }


  ensureDailyProgress() {
    const today = localDayKey();
    if (this.progress.dailyDate === today) return;
    this.progress.dailyDate = today;
    this.progress.dailyProgress = 0;
    this.progress.dailyClaimed = false;
  }

  getDailyChallenge() {
    this.ensureDailyProgress();
    return dailyDefinition(this.progress.dailyDate);
  }

  getLeagueState() {
    const stars = this.progress.leagueStars;
    const tier = LEAGUE_TIERS.findLast((item) => stars >= item.min) ?? LEAGUE_TIERS[0];
    const span = tier.next == null ? 1 : Math.max(1, tier.next - tier.min);
    const fraction = tier.next == null ? 1 : clamp((stars - tier.min) / span, 0, 1);
    return { ...tier, stars, fraction };
  }

  updateDailyChallenge(dt) {
    if (!this.player?.alive) return;
    const challenge = this.getDailyChallenge();
    this.matchStats.seconds += dt;
    if (challenge.type === "mass") {
      this.progress.dailyProgress = Math.max(this.progress.dailyProgress, Math.floor(this.matchStats.peakMass));
    } else if (challenge.type === "survive") {
      this.dailySecondAccumulator += dt;
      if (this.dailySecondAccumulator >= 1) {
        const whole = Math.floor(this.dailySecondAccumulator);
        this.dailySecondAccumulator -= whole;
        this.progress.dailyProgress += whole;
      }
    }
    this.tryCompleteDaily(challenge);
  }

  addDailyFood() {
    const challenge = this.getDailyChallenge();
    if (challenge.type !== "food") return;
    this.progress.dailyProgress += 1;
    this.tryCompleteDaily(challenge);
  }

  tryCompleteDaily(challenge = this.getDailyChallenge()) {
    if (this.progress.dailyClaimed || this.progress.dailyProgress < challenge.goal) return false;
    this.progress.dailyClaimed = true;
    this.progress.leagueStars += challenge.reward;
    this.toast(`Цель дня выполнена: +${challenge.reward} ★ Лиги`);
    return true;
  }

  getDailyProgressText() {
    const challenge = this.getDailyChallenge();
    const current = Math.min(challenge.goal, Math.floor(this.progress.dailyProgress));
    return `${current}/${challenge.goal}`;
  }

  ensureMissionProgress() {
    const today = localDayKey();
    if (this.progress.missionDate === today) return;
    this.progress.missionDate = today;
    this.progress.missionProgress = {};
    this.progress.missionClaimed = [];
  }

  getMissions() {
    this.ensureMissionProgress();
    return missionDefinitions(this.progress.missionDate);
  }

  getMissionValue(mission) {
    return Math.max(0, Number(this.progress.missionProgress?.[mission.id]) || 0);
  }

  getMissionSummary() {
    const missions = this.getMissions();
    const completed = missions.filter((mission) => this.progress.missionClaimed.includes(mission.id)).length;
    const totalStars = missions.reduce((sum, mission) => sum + mission.reward, 0) + 2;
    return { missions, completed, total: missions.length, totalStars, streak: this.progress.missionStreak };
  }

  updateMissionContracts(dt) {
    if (!this.player?.alive) return;
    const missions = this.getMissions();
    for (const mission of missions) {
      if (mission.type === "mass") {
        this.progress.missionProgress[mission.id] = Math.max(this.getMissionValue(mission), Math.floor(this.matchStats.peakMass));
      }
    }
    this.missionSecondAccumulator += dt;
    if (this.missionSecondAccumulator >= 1) {
      const whole = Math.floor(this.missionSecondAccumulator);
      this.missionSecondAccumulator -= whole;
      for (const mission of missions) {
        if (mission.type === "survive") this.progress.missionProgress[mission.id] = this.getMissionValue(mission) + whole;
      }
    }
    for (const mission of missions) this.tryCompleteMission(mission);
  }

  addMissionProgress(type, amount = 1) {
    const missions = this.getMissions();
    for (const mission of missions) {
      if (mission.type !== type) continue;
      this.progress.missionProgress[mission.id] = this.getMissionValue(mission) + amount;
      this.tryCompleteMission(mission);
    }
  }

  tryCompleteMission(mission) {
    if (this.progress.missionClaimed.includes(mission.id) || this.getMissionValue(mission) < mission.goal) return false;
    this.progress.missionClaimed.push(mission.id);
    this.progress.leagueStars += mission.reward;
    this.toast(`Задание выполнено: +${mission.reward} ★`);
    this.tryFinalizeMissions();
    return true;
  }

  tryFinalizeMissions() {
    const missions = this.getMissions();
    if (!missions.every((mission) => this.progress.missionClaimed.includes(mission.id))) return false;
    const today = this.progress.missionDate;
    if (this.progress.lastMissionCompletionDate === today) return true;
    const yesterday = shiftDayKey(today, -1);
    this.progress.missionStreak = this.progress.lastMissionCompletionDate === yesterday ? this.progress.missionStreak + 1 : 1;
    this.progress.lastMissionCompletionDate = today;
    this.progress.leagueStars += 2;
    this.unlockScoreSkins(true);
    this.toast(`Все задания дня выполнены • серия ${this.progress.missionStreak} дн. • +2 ★`);
    return true;
  }

  getMissionProgressText(mission) {
    return `${Math.min(mission.goal, Math.floor(this.getMissionValue(mission)))}/${mission.goal}`;
  }

  unlockScoreSkins(notify = false) {
    const newlyUnlocked = [];
    for (const skin of SKINS) {
      if (!["score", "league", "streak", "duel"].includes(skin.kind) || this.progress.unlockedSkins.includes(skin.id)) continue;
      const unlockedByScore = skin.kind === "score" && this.progress.bestMass >= skin.requiredScore;
      const unlockedByLeague = skin.kind === "league" && this.progress.leagueStars >= skin.requiredStars;
      const unlockedByStreak = skin.kind === "streak" && this.progress.missionStreak >= skin.requiredStreak;
      const unlockedByDuel = skin.kind === "duel" && this.progress.totalKills >= skin.requiredDuels;
      if (unlockedByScore || unlockedByLeague || unlockedByStreak || unlockedByDuel) {
        this.progress.unlockedSkins.push(skin.id);
        newlyUnlocked.push(skin);
      }
    }
    if (newlyUnlocked.length && notify) this.toast(`Открыт скин: ${newlyUnlocked.map((skin) => skin.name).join(", ")}`);
    return newlyUnlocked;
  }

  async unlockFreeSkin(skin) {
    if (skin.kind !== "free" || this.progress.unlockedSkins.includes(skin.id)) return;
    this.progress.unlockedSkins.push(skin.id);
    this.progress.selectedSkin = skin.id;
    await this.persistProgress();
    this.toast(`Скин «${skin.name}» открыт бесплатно.`);
    this.showShop();
  }

  getSkinUnlockKind(skin) {
    // Playgama has no IAP in this release: every formerly paid skin is an exact rewarded-video unlock.
    return this.bridge.isPlaygama && skin.kind === "purchase" ? "reward" : skin.kind;
  }

  getSkinMeta(skin, owned, selected) {
    if (selected) return { tag: "Выбрано", text: "Этот скин уже на змейке" };
    if (owned) return { tag: "Открыто", text: "Нажми, чтобы выбрать" };
    const unlockKind = this.getSkinUnlockKind(skin);
    if (unlockKind === "default" || unlockKind === "free") return { tag: "Бесплатно", text: "Нажми, чтобы открыть" };
    if (unlockKind === "reward") {
      return skin.kind === "purchase" && this.bridge.isPlaygama
        ? { tag: "За видео", text: "Посмотри видео — откроется этот скин" }
        : { tag: "За видео", text: "Откроется после просмотра" };
    }
    if (unlockKind === "purchase") return { tag: `Покупка • ${this.bridge.getPriceLabel(skin)}`.trim(), text: "Нажми, чтобы купить" };
    if (unlockKind === "score") {
      const current = Math.floor(this.progress.bestMass);
      return { tag: `Рекорд: ${skin.requiredScore}`, text: `Прогресс: ${Math.min(current, skin.requiredScore)}/${skin.requiredScore}` };
    }
    if (unlockKind === "league") {
      const current = this.progress.leagueStars;
      return { tag: `Лига: ${skin.requiredStars} ★`, text: `Звёзды: ${Math.min(current, skin.requiredStars)}/${skin.requiredStars}` };
    }
    if (unlockKind === "streak") {
      const current = this.progress.missionStreak;
      return { tag: `Серия: ${skin.requiredStreak} дня`, text: `Серия: ${Math.min(current, skin.requiredStreak)}/${skin.requiredStreak}` };
    }
    if (unlockKind === "duel") {
      const current = this.progress.totalKills;
      return { tag: `Победы: ${skin.requiredDuels}`, text: `Победы: ${Math.min(current, skin.requiredDuels)}/${skin.requiredDuels}` };
    }
    return { tag: "Доступно", text: "Нажми, чтобы открыть" };
  }

  async claimRewardSkin(requestedSkin = null) {
    const unlocked = new Set(this.progress.unlockedSkins);
    const exactSkin = requestedSkin && !unlocked.has(requestedSkin.id) ? requestedSkin : null;
    const rewards = SKINS.filter((skin) => this.getSkinUnlockKind(skin) === "reward" && !unlocked.has(skin.id));
    if (!exactSkin && !rewards.length) {
      this.toast("Все скины за видео уже открыты!");
      return;
    }
    const selector = exactSkin
      ? `[data-action="reward-skin-specific"][data-skin="${exactSkin.id}"]`
      : '[data-action="reward-skin"]';
    const button = this.ui.overlay.querySelector(selector);
    if (button) {
      button.disabled = true;
      button.textContent = "Загрузка видео…";
    }
    const rewarded = await this.bridge.showRewarded(exactSkin ? `skin_${exactSkin.id}` : "skin");
    if (!rewarded) {
      this.toast("Скин откроется после полного просмотра видео.");
      if (button) {
        button.disabled = false;
        button.textContent = exactSkin ? "▶ Открыть за видео" : "▶ Получить случайный скин за видео";
      }
      return;
    }
    const skin = exactSkin ?? pick(rewards);
    this.progress.unlockedSkins.push(skin.id);
    this.progress.selectedSkin = skin.id;
    this.progress.rewardClaims += 1;
    await this.persistProgress();
    this.toast(`Открыт скин: ${skin.name}`);
    this.showShop();
  }

  async purchaseSkin(skin) {
    if (this.progress.unlockedSkins.includes(skin.id)) {
      this.progress.selectedSkin = skin.id;
      await this.persistProgress();
      this.showShop();
      return;
    }
    if (this.bridge.isPlaygama) {
      await this.claimRewardSkin(skin);
      return;
    }
    if (!this.bridge.supportsPurchases) {
      this.toast("Покупка недоступна на этой платформе.");
      return;
    }
    this.toast("Открываю покупку…");
    const success = await this.bridge.purchaseSkin(skin.sku);
    if (!success) {
      this.toast("Покупка не подтверждена.");
      return;
    }
    this.progress.unlockedSkins.push(skin.id);
    this.progress.purchaseSkins.push(skin.id);
    this.progress.selectedSkin = skin.id;
    await this.persistProgress();
    this.toast(`Скин «${skin.name}» открыт.`);
    this.showShop();
  }

  async selectSkin(skin) {
    if (!this.progress.unlockedSkins.includes(skin.id)) return;
    this.progress.selectedSkin = skin.id;
    await this.persistProgress();
    this.showShop();
  }

  async persistProgress() {
    await this.bridge.saveProgress(this.progress);
  }

  showMenu() {
    this.unlockScoreSkins(false);
    this.root?.classList.add("sa-menu-active");
    this.updateControlHint();
    this.running = false;
    this.mode = "menu";
    this.bridge.setBannerVisible(CFG.BANNER_MODE === "menu-only");
    const daily = this.getDailyChallenge();
    const league = this.getLeagueState();
    const missions = this.getMissionSummary();
    const dailyProgress = Math.min(100, Math.round(this.progress.dailyProgress / daily.goal * 100));
    const leagueProgress = Math.round(league.fraction * 100);
    const controlLabel = this.getTouchControlMode() === "joystick" ? "Джойстик" : "Тач";
    const mobileControlsButton = this.isTouchInputEnvironment()
      ? `<button class="sa-btn secondary sa-controls-btn" data-action="controls">Управление: ${controlLabel}</button>`
      : "";
    this.showOverlay(`
      <div class="sa-menu-hero">
        <div class="sa-menu-copy">
          <p class="sa-brand">Лига арены • офлайн-сезон</p>
          <h1 class="sa-title">Slither Arena</h1>
          <p class="sa-subtitle">Собирай свет, расти и перехитри змеек с живыми стилями игры.</p>
        </div>
        <div class="sa-menu-emblem" aria-hidden="true"><span></span></div>
      </div>
      <div class="sa-menu-progress">
        <div class="sa-league-card">
          <span class="sa-league-kicker">Цель дня • +${daily.reward} ★</span>
          <strong class="sa-league-title">${this.escapeHtml(daily.label)}</strong>
          <div class="sa-progress-bar"><i style="width:${dailyProgress}%"></i></div>
          <div class="sa-league-row"><span>${this.getDailyProgressText()}${this.progress.dailyClaimed ? " • готово" : ""}</span><span>${this.escapeHtml(league.name)} • ${league.stars} ★</span></div>
          <div class="sa-progress-bar"><i style="width:${leagueProgress}%"></i></div>
        </div>
        <button type="button" class="sa-mission-teaser sa-menu-mission-button" data-action="missions"><div><strong>Задания дня • ${missions.completed}/${missions.total}</strong><span>Собери все — серия и +${missions.totalStars} ★</span></div><div class="sa-mission-mini">${missions.streak}<br>дн. серия</div></button>
      </div>
      <div class="sa-stat-row sa-menu-stats">
        <div class="sa-stat"><small>Рекорд</small><strong>${Math.floor(this.progress.bestMass)}</strong></div>
        <div class="sa-stat"><small>Скины</small><strong>${this.progress.unlockedSkins.length}/${SKINS.length}</strong></div>
        <div class="sa-stat"><small>Лига</small><strong>${this.escapeHtml(league.name)}</strong></div>
      </div>
      <div class="sa-menu-actions">
        <button class="sa-btn sa-play" data-action="play">Играть</button>
        <button class="sa-btn secondary" data-action="missions">Задания</button>
        <button class="sa-btn secondary" data-action="shop">Гардероб</button>
        ${mobileControlsButton}
      </div>
    `, "sa-menu-panel");
  }

  showGameOver() {
    this.root?.classList.remove("sa-menu-active");
    const snapshot = this.deathSnapshot ?? { mass: 0, reason: "столкновение" };
    const canRevive = !this.reviveUsed;
    const hasRewardSkin = SKINS.some((skin) => this.getSkinUnlockKind(skin) === "reward" && !this.progress.unlockedSkins.includes(skin.id));
    const daily = this.getDailyChallenge();
    const league = this.getLeagueState();
    const phone = this.isPhoneLayout();
    const compactDaily = `<div class="sa-gameover-daily"><span>Цель дня • +${daily.reward} ★</span><strong>${this.escapeHtml(daily.label)}</strong><small>${this.getDailyProgressText()}${this.progress.dailyClaimed ? " • выполнено" : ""}</small></div>`;
    const fullDaily = `<div class="sa-league-card"><span class="sa-league-kicker">Цель дня • +${daily.reward} ★</span><strong class="sa-league-title">${this.escapeHtml(daily.label)}</strong><div class="sa-league-row"><span>${this.getDailyProgressText()}${this.progress.dailyClaimed ? " • выполнено" : ""}</span><span>${this.escapeHtml(league.name)} • ${league.stars} ★</span></div></div>`;
    const reviveButton = canRevive
      ? '<button class="sa-btn video sa-primary" data-action="revive">▶ Продолжить после видео</button>'
      : '<button class="sa-btn disabled sa-primary" disabled>Вторая попытка уже использована</button>';
    const desktopExtras = !phone
      ? `${hasRewardSkin ? '<button class="sa-btn secondary" data-action="reward-skin">▶ Получить случайный скин за видео</button>' : ''}<button class="sa-btn secondary" data-action="missions">Задания дня</button>`
      : '';
    this.showOverlay(`
      <p class="sa-brand">Забег завершён</p>
      <h1 class="sa-title">Попробуем ещё?</h1>
      <p class="sa-subtitle">${this.escapeHtml(snapshot.reason)}. Ты набрал <b>${Math.floor(snapshot.mass)}</b> веса.</p>
      ${phone ? compactDaily : fullDaily}
      <div class="sa-stat-row sa-gameover-stats">
        <div class="sa-stat"><small>Вес</small><strong>${Math.floor(snapshot.mass)}</strong></div>
        <div class="sa-stat"><small>Рекорд</small><strong>${Math.floor(this.progress.bestMass)}</strong></div>
        <div class="sa-stat"><small>Место</small><strong>${this.getLastRankLabel()}</strong></div>
      </div>
      <div class="sa-gameover-actions">
        ${reviveButton}
        <button class="sa-btn secondary" data-action="restart">Новый забег</button>
        <button class="sa-btn secondary" data-action="menu">В меню</button>
        ${desktopExtras}
      </div>
    `, "sa-gameover-panel");
  }

  showMissions(page = 0) {
    this.root?.classList.remove("sa-menu-active");
    this.running = false;
    this.mode = "missions";
    this.bridge.setBannerVisible(CFG.BANNER_MODE === "menu-only");
    const summary = this.getMissionSummary();
    // One task per page on phones prevents a long mission sheet from being clipped.
    const usePager = this.isPhoneLayout();
    const pageCount = summary.missions.length;
    this.missionPage = clamp(Number(page) || 0, 0, Math.max(0, pageCount - 1));
    const missionsToShow = usePager ? [summary.missions[this.missionPage]] : summary.missions;
    const cards = missionsToShow.map((mission) => {
      const complete = this.progress.missionClaimed.includes(mission.id);
      const current = this.getMissionProgressText(mission);
      const pct = Math.min(100, Math.round(this.getMissionValue(mission) / mission.goal * 100));
      return `<div class="sa-mission-card ${complete ? "complete" : ""}">
        <span class="sa-mission-mark">${complete ? "✓" : "✦"}</span>
        <div class="sa-mission-head"><strong>${this.escapeHtml(mission.label)}</strong><span>+${mission.reward} ★</span></div>
        <p>${complete ? "Выполнено" : `Прогресс: ${current}`}</p>
        <div class="sa-progress-bar"><i style="width:${pct}%"></i></div>
        <div class="sa-mission-footer"><span>${current}</span><span>${complete ? "Награда получена" : (usePager ? "Во всех забегах" : "В любых забегах")}</span></div>
      </div>`;
    }).join("");
    const pager = usePager ? `<div class="sa-mission-pager"><button class="sa-btn secondary" data-action="mission-prev" ${this.missionPage <= 0 ? "disabled" : ""} aria-label="Предыдущее задание">‹</button><span>${this.missionPage + 1} из ${pageCount}</span><button class="sa-btn secondary" data-action="mission-next" ${this.missionPage >= pageCount - 1 ? "disabled" : ""} aria-label="Следующее задание">›</button></div>` : "";
    this.showOverlay(`
      <p class="sa-brand">Лига арены • ежедневная серия</p>
      <h1 class="sa-title">Задания дня</h1>
      <p class="sa-subtitle">Выполни все три задания, чтобы продлить серию. Серии открывают редкие скины и дают звёзды Лиги.</p>
      <div class="sa-mission-teaser"><div><strong>Серия: ${summary.streak} дн.</strong><span>Полный набор: +${summary.totalStars} ★</span></div><div class="sa-mission-mini">${summary.completed}/${summary.total}<br>готово</div></div>
      <div class="sa-mission-grid">${cards}</div>${pager}
      <button class="sa-btn" data-action="play">Играть и выполнять</button>
      <button class="sa-btn secondary" data-action="missions-back">Назад</button>
    `, `sa-missions-panel${usePager ? " sa-missions-phone" : ""}`);
  }

  showControls() {
    if (!this.isTouchInputEnvironment()) {
      this.showMenu();
      return;
    }
    this.root?.classList.remove("sa-menu-active");
    this.running = false;
    this.mode = "controls";
    this.bridge.setBannerVisible(CFG.BANNER_MODE === "menu-only");
    const selected = this.getTouchControlMode();
    const card = (mode, title, description) => `
      <button type="button" class="sa-control-card ${selected === mode ? "selected" : ""}" data-action="control-mode" data-control="${mode}">
        <span class="sa-control-check">${selected === mode ? "✓" : ""}</span>
        <span class="sa-control-demo ${mode === "joystick" ? "joystick" : ""}"><i class="sa-demo-snake"></i>${mode === "joystick" ? '<i class="sa-demo-pad"></i>' : '<i class="sa-demo-target"></i>'}<i class="sa-demo-arrow"></i></span>
        <strong>${title}</strong><span>${description}</span>
      </button>`;
    this.showOverlay(`
      <p class="sa-brand">Настройки телефона</p>
      <h1 class="sa-title">Управление</h1>
      <p class="sa-subtitle">Выбери способ поворота. Тач: двойной тап и удержание. Джойстик: удерживай управление, а вторым пальцем нажми для ускорения.</p>
      <p class="sa-control-note">Выбор сохраняется. Во время игры джойстик появляется ровно там, где ты касаешься экрана.</p>
      <div class="sa-control-layout">
        ${card("touch", "Тач", "Веди пальцем по экрану — змейка поворачивает в сторону касания.")}
        ${card("joystick", "Джойстик", "Первый палец ведёт плавающий джойстик. Нажми вторым пальцем для ускорения.")}
      </div>
      <button class="sa-btn secondary" data-action="controls-back">Назад</button>
    `, "sa-controls-panel");
  }

  async setTouchControl(mode) {
    this.progress.touchControl = mode === "joystick" ? "joystick" : "touch";
    this.hideFloatingJoystick();
    this.updateControlHint();
    await this.persistProgress();
    this.showControls();
  }

  showShop(page = this.shopPage) {
    this.root?.classList.remove("sa-menu-active");
    this.unlockScoreSkins(false);
    this.running = false;
    this.mode = "shop";
    this.bridge.setBannerVisible(CFG.BANNER_MODE === "menu-only");
    const allSkins = SKINS;
    const perPage = this.isTinyPhoneLayout() ? 2 : 4;
    const pageCount = Math.max(1, Math.ceil(allSkins.length / perPage));
    this.shopPage = clamp(Number(page) || 0, 0, pageCount - 1);
    const visible = allSkins.slice(this.shopPage * perPage, this.shopPage * perPage + perPage);
    const cards = visible.map((skin) => {
      const owned = this.progress.unlockedSkins.includes(skin.id);
      const selected = this.progress.selectedSkin === skin.id;
      const meta = this.getSkinMeta(skin, owned, selected);
      let action = `data-action="select-skin" data-skin="${skin.id}"`;
      let disabled = "";
      const unlockKind = this.getSkinUnlockKind(skin);
      if (!owned && unlockKind === "free") action = `data-action="free-skin" data-skin="${skin.id}"`;
      else if (!owned && unlockKind === "purchase") action = `data-action="purchase-skin" data-skin="${skin.id}"`;
      else if (!owned && unlockKind === "reward") action = skin.kind === "purchase"
        ? `data-action="reward-skin-specific" data-skin="${skin.id}"`
        : 'data-action="reward-skin"';
      else if (!owned && ["score", "league", "streak", "duel"].includes(skin.kind)) { disabled = "disabled"; action = ""; }
      const statusBadge = owned ? `<span class="sa-owned-badge" aria-hidden="true">✓</span>` : `<span class="sa-lock-badge" aria-label="Скин пока закрыт">🔒</span>`;
      return `
        <button type="button" class="sa-skin ${owned ? "" : "locked"} ${selected ? "selected" : ""}" ${action} ${disabled}>
          <span class="sa-skin-preview-wrap"><canvas class="sa-skin-preview" data-skin-preview="${skin.id}" aria-label="Предпросмотр скина ${this.escapeHtml(skin.name)}"></canvas>${statusBadge}</span>
          <span class="sa-skin-info"><span class="sa-skin-name">${this.escapeHtml(skin.name)}</span><span class="sa-skin-meta"><b>${this.escapeHtml(meta.tag)}</b><em>${this.escapeHtml(meta.text)}</em></span></span>
        </button>`;
    }).join("");
    this.showOverlay(`
      <p class="sa-brand">Гардероб</p>
      <h1 class="sa-title">Скины</h1>
      <p class="sa-subtitle">Нажми на карточку — под каждым скином указан способ открытия и цена.</p>
      <div class="sa-shop-grid">${cards}</div>
      <div class="sa-shop-nav">
        <button type="button" class="sa-btn secondary sa-page-btn" data-action="shop-prev" ${this.shopPage <= 0 ? "disabled" : ""} aria-label="Предыдущая страница">‹</button>
        <span class="sa-page-label">${this.shopPage + 1} из ${pageCount}</span>
        <button type="button" class="sa-btn secondary sa-page-btn" data-action="shop-next" ${this.shopPage >= pageCount - 1 ? "disabled" : ""} aria-label="Следующая страница">›</button>
      </div>
      <button type="button" class="sa-btn secondary sa-shop-back" data-action="back">Назад</button>
    `, "sa-shop-panel");
  }

  showPause() {
    this.root?.classList.remove("sa-menu-active");
    this.showOverlay(`
      <p class="sa-brand">Пауза</p>
      <h1 class="sa-title">Игра остановлена</h1>
      <p class="sa-subtitle">Продолжай, когда будешь готов.</p>
      <button class="sa-btn" data-action="resume">Продолжить</button>
      <button class="sa-btn secondary" data-action="restart">Новый забег</button>
      <button class="sa-btn secondary" data-action="menu">В меню</button>
    `, "sa-pause-panel");
  }

  showOverlay(html, panelClass = "") {
    this.ui.overlay.innerHTML = `<div class="sa-panel ${panelClass}">${html}</div>`;
    this.ui.overlay.classList.add("visible");
    requestAnimationFrame(() => this.renderSkinPreviews());
  }

  renderSkinPreviews() {
    if (!this.root) return;
    const dpr = clamp(globalThis.devicePixelRatio || 1, 1, 2);
    for (const canvas of this.root.querySelectorAll("[data-skin-preview]")) {
      const skin = getSkin(canvas.dataset.skinPreview);
      const rect = canvas.getBoundingClientRect();
      const card = canvas.closest(".sa-skin");
      const computed = globalThis.getComputedStyle?.(canvas);
      const fallbackWidth = card ? Math.max(88, card.clientWidth - 16) : Math.max(120, rect.width);
      const width = Math.max(80, Math.floor(Math.min(rect.width || fallbackWidth, fallbackWidth)));
      const height = Math.max(52, Math.floor(Number.parseFloat(computed?.height) || (card ? 76 : 132)));
      // CSS size is fixed in pixels while canvas.width/canvas.height are the high-DPI backing store.
      canvas.style.setProperty("width", `${width}px`, "important");
      canvas.style.setProperty("min-width", "0", "important");
      canvas.style.setProperty("max-width", `${width}px`, "important");
      canvas.style.setProperty("height", `${height}px`, "important");
      canvas.style.setProperty("display", "block", "important");
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, "#0f2138");
      bg.addColorStop(1, "#07111f");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,255,255,.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 18) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 0; y < height; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      const size = Math.min(width, height);
      const r = Math.max(8, size * .13);
      const points = [];
      for (let index = 0; index < 18; index++) {
        const t = index / 17;
        points.push({ x: width * (.16 + t * .63), y: height * (.62 - Math.sin(t * Math.PI * 1.15) * .18) });
      }
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (["neon", "ember", "nebula", "lava", "crystal"].includes(skin.pattern)) { ctx.shadowColor = skin.primary; ctx.shadowBlur = 10; }
      ctx.strokeStyle = skin.primary;
      ctx.lineWidth = r * 1.38;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length - 1; index++) {
        const p = points[index]; const next = points[index + 1];
        ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
      }
      ctx.lineTo(points.at(-1).x, points.at(-1).y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = skin.secondary;
      ctx.globalAlpha = .75;
      ctx.lineWidth = r * .42;
      if (["stripe", "bands", "prism", "ember", "tiger", "chevron", "aurora", "spark", "lava", "dragon", "crystal", "nebula"].includes(skin.pattern)) ctx.setLineDash([r * .58, r * .38]);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length - 1; index++) {
        const p = points[index]; const next = points[index + 1];
        ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
      }
      ctx.lineTo(points.at(-1).x, points.at(-1).y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      const head = points.at(-1);
      const hg = ctx.createRadialGradient(head.x - r*.25, head.y-r*.28, 1, head.x, head.y, r*.83);
      hg.addColorStop(0, skin.secondary); hg.addColorStop(1, skin.primary);
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(head.x, head.y, r*.83, 0, TAU); ctx.fill();
      if (skin.pattern === "crown") {
        ctx.fillStyle = "#ffd43b";
        ctx.beginPath(); ctx.moveTo(head.x-r*.42,head.y-r*.68); ctx.lineTo(head.x-r*.22,head.y-r*1.22); ctx.lineTo(head.x,head.y-r*.82); ctx.lineTo(head.x+r*.24,head.y-r*1.22); ctx.lineTo(head.x+r*.43,head.y-r*.68); ctx.closePath(); ctx.fill();
      }
      if (["scales", "petals", "galaxy", "chevron", "tiger", "spark", "moth", "nebula", "crystal"].includes(skin.pattern)) {
        ctx.fillStyle = skin.accent ?? skin.secondary;
        ctx.globalAlpha = .82;
        for (let index = 3; index < points.length - 2; index += 4) {
          const p = points[index];
          if (skin.pattern === "chevron" || skin.pattern === "tiger") {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(.22); ctx.fillRect(-r*.10, -r*.42, r*.20, r*.84); ctx.restore();
          } else {
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, r*.13), 0, TAU); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "rgba(255,255,255,.95)";
      for (const sign of [-1,1]) { ctx.beginPath(); ctx.arc(head.x+r*.20,head.y+sign*r*.28,r*.13,0,TAU); ctx.fill(); }
      ctx.restore();
    }
  }

  hideOverlay() {
    this.ui.overlay.classList.remove("visible");
    this.ui.overlay.innerHTML = "";
    this.hideFloatingJoystick();
  }

  async setPaused(value) {
    if (!this.running || this.paused === value) return;
    this.paused = value;
    await this.bridge.pauseChanged(value);
    if (value) this.showPause();
    else this.hideOverlay();
  }

  togglePause() {
    if (this.mode === "game" || this.paused) this.setPaused(!this.paused);
  }

  handleClick(event) {
    const element = event.target.closest?.("[data-action]");
    if (!element || element.disabled) return;
    const action = element.dataset.action;
    const skin = getSkin(element.dataset.skin);
    if (action === "play" || action === "restart") this.beginMatch();
    if (action === "menu") this.showMenu();
    if (action === "missions") this.showMissions(0);
    if (action === "missions-back") this.showMenu();
    if (action === "mission-prev") this.showMissions(this.missionPage - 1);
    if (action === "mission-next") this.showMissions(this.missionPage + 1);
    if (action === "controls") this.showControls();
    if (action === "controls-back") this.showMenu();
    if (action === "control-mode") this.setTouchControl(element.dataset.control);
    if (action === "shop") {
      if (this.mode === "game" && this.running) {
        this.resumeAfterShop = true;
        this.running = false;
        this.paused = true;
        this.bridge.pauseChanged(true);
      }
      this.showShop();
    }
    if (action === "back") {
      if (this.resumeAfterShop) this.resumeFromShop();
      else this.showMenu();
    }
    if (action === "pause") this.togglePause();
    if (action === "shop-prev") this.showShop(this.shopPage - 1);
    if (action === "shop-next") this.showShop(this.shopPage + 1);
    if (action === "resume") this.setPaused(false);
    if (action === "revive") this.revive();
    if (action === "reward-skin") this.claimRewardSkin();
    if (action === "reward-skin-specific") this.claimRewardSkin(skin);
    if (action === "free-skin") this.unlockFreeSkin(skin);
    if (action === "purchase-skin") this.purchaseSkin(skin);
    if (action === "select-skin") this.selectSkin(skin);
  }

  resumeFromShop() {
    this.resumeAfterShop = false;
    this.mode = "game";
    this.running = true;
    this.paused = false;
    this.hideOverlay();
    this.bridge.setBannerVisible(false);
    this.bridge.pauseChanged(false);
  }

  platformLabel() {
    const names = { local: "Тест", gamepush: "GamePush", playgama: "Playgama", yandex: "Yandex", vk: "VK", ok: "OK" };
    return names[this.bridge.platform] ?? this.bridge.platform;
  }

  getLastRankLabel() {
    const alive = this.snakes.filter((snake) => snake.alive).sort((a, b) => b.mass - a.mass);
    const snapshotMass = this.deathSnapshot?.mass ?? 0;
    return `#${Math.max(1, alive.filter((snake) => snake.mass > snapshotMass).length + 1)}`;
  }

  syncUi() {
    const score = this.player?.alive ? Math.floor(this.player.mass) : Math.floor(this.deathSnapshot?.mass ?? 0);
    this.ui.score.textContent = `${score}`;
    this.ui.best.textContent = `Лучший: ${Math.floor(this.progress.bestMass)}`;
    const alive = this.snakes.filter((snake) => snake.alive).sort((a, b) => b.mass - a.mass);
    const rank = Math.max(1, alive.findIndex((snake) => snake.human) + 1);
    this.ui.rank.textContent = this.player?.alive ? `Место #${rank} из ${alive.length}` : `Итог забега`;
  }

  toast(message) {
    this.ui.toast.textContent = message;
    this.ui.toast.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.ui.toast.classList.remove("visible"), 2500);
  }

  worldToScreen(x, y) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const scale = this.camera.zoom * this.dpr;
    return {
      x: (x - this.camera.x) * scale + width / 2,
      y: (y - this.camera.y) * scale + height / 2,
      scale
    };
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const dpr = this.dpr;
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#091a2c");
    background.addColorStop(.55, "#081323");
    background.addColorStop(1, "#050b15");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    const scale = this.camera.zoom * dpr;

    // Soft lights keep the empty arena alive without distracting from the bodies.
    ctx.save();
    for (const dot of this.ambientDots) {
      const point = this.worldToScreen(dot.x, dot.y);
      if (point.x < -20 || point.y < -20 || point.x > width + 20 || point.y > height + 20) continue;
      const pulse = .55 + Math.sin(this.elapsed * .8 + dot.phase) * .2;
      ctx.globalAlpha = .12 * pulse;
      ctx.fillStyle = dot.hue;
      ctx.beginPath();
      ctx.arc(point.x, point.y, dot.r * dpr * 1.9, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Wandering lights are a lightweight way to make the arena feel alive even in sparse sectors.
    ctx.save();
    for (const bug of this.fireflies) {
      const bx = bug.x + Math.cos(this.elapsed * bug.drift + bug.phase) * 18;
      const by = bug.y + Math.sin(this.elapsed * (bug.drift * .78) + bug.phase * 1.7) * 15;
      const point = this.worldToScreen(bx, by);
      if (point.x < -24 || point.y < -24 || point.x > width + 24 || point.y > height + 24) continue;
      const flicker = .35 + (Math.sin(this.elapsed * 3.4 + bug.phase) + 1) * .23;
      ctx.globalAlpha = flicker;
      ctx.fillStyle = bug.hue;
      ctx.shadowColor = bug.hue;
      ctx.shadowBlur = 7 * dpr;
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(1, bug.r * dpr), 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Larger energy beacons and starlets give distant parts of the map a living, inhabited feel.
    ctx.save();
    for (const beacon of this.energyBeacons) {
      const point = this.worldToScreen(beacon.x, beacon.y);
      if (point.x < -44 || point.y < -44 || point.x > width + 44 || point.y > height + 44) continue;
      const pulse = .65 + Math.sin(this.elapsed * 1.45 + beacon.phase) * .23;
      ctx.globalAlpha = .12 * pulse;
      ctx.strokeStyle = beacon.hue;
      ctx.lineWidth = Math.max(1, dpr);
      ctx.shadowColor = beacon.hue;
      ctx.shadowBlur = 12 * dpr;
      ctx.beginPath(); ctx.arc(point.x, point.y, 10 * dpr * pulse, 0, TAU); ctx.stroke();
      ctx.globalAlpha = .82 * pulse;
      ctx.fillStyle = beacon.hue;
      ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(1.5, 2.2 * dpr), 0, TAU); ctx.fill();
    }
    ctx.restore();

    const grid = 88 * scale;
    const origin = this.worldToScreen(0, 0);
    ctx.save();
    ctx.lineWidth = Math.max(1, dpr);
    ctx.strokeStyle = "rgba(173,216,255,.045)";
    ctx.beginPath();
    for (let x = origin.x % grid; x < width; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = origin.y % grid; y < height; y += grid) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();
    const half = CFG.WORLD_SIZE / 2;
    const topLeft = this.worldToScreen(-half, -half);
    const bottomRight = this.worldToScreen(half, half);
    ctx.strokeStyle = "rgba(132,198,255,.30)";
    ctx.lineWidth = 2 * dpr;
    ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    ctx.restore();

    for (const food of this.food) {
      const point = this.worldToScreen(food.x, food.y);
      const r = Math.max(1.8 * dpr, food.radius * scale * (1 + Math.sin(food.pulse) * .11));
      if (point.x < -22 || point.y < -22 || point.x > width + 22 || point.y > height + 22) continue;
      ctx.save();
      const fade = clamp((food.ttl - food.age) / 4, 0, 1);
      const shimmer = .62 + Math.sin(food.shimmer) * .24;
      const halo = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, r * 3.5);
      halo.addColorStop(0, food.color);
      halo.addColorStop(.32, food.color.replace?.("#", "#") ?? food.color);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = (.08 + fade * .19) * shimmer;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(point.x, point.y, r * 3.5, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = .32 + fade * .68;
      ctx.shadowColor = food.color;
      ctx.shadowBlur = 11 * dpr * fade;
      ctx.fillStyle = food.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, TAU);
      ctx.fill();
      if (food.value > 1.25 || (food.id % 11 === 0 && fade > .5)) {
        ctx.globalAlpha = fade * .72;
        ctx.strokeStyle = "rgba(255,255,255,.78)";
        ctx.lineWidth = Math.max(1, dpr * .75);
        const ray = r * (1.4 + Math.sin(food.shimmer) * .2);
        ctx.beginPath();
        ctx.moveTo(point.x - ray, point.y); ctx.lineTo(point.x + ray, point.y);
        ctx.moveTo(point.x, point.y - ray); ctx.lineTo(point.x, point.y + ray);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const echo of this.deathEchoes) this.drawDeathEcho(echo, scale);

    const drawOrder = this.snakes.filter((snake) => snake.alive).sort((a, b) => a.mass - b.mass);
    for (const snake of drawOrder) this.drawSnake(snake, scale);

    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .18, width / 2, height / 2, Math.max(width, height) * .7);
    vignette.addColorStop(.55, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,.34)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  getRenderedTrail(snake) {
    const source = snake?.trail ?? [];
    if (source.length < 2) return source;
    const count = clamp(Number(snake.tailRenderCount ?? source.length), 2, source.length);
    const whole = Math.floor(count);
    const fraction = count - whole;
    if (whole >= source.length || fraction < .002) return source.slice(0, Math.max(2, Math.min(source.length, whole)));
    const points = source.slice(0, Math.max(2, whole));
    const from = source[Math.max(0, whole - 1)];
    const to = source[Math.min(source.length - 1, whole)];
    points.push({ x: lerp(from.x, to.x, fraction), y: lerp(from.y, to.y, fraction) });
    return points;
  }

  traceSnakePath(ctx, points) {
    const first = this.worldToScreen(points[0].x, points[0].y);
    ctx.moveTo(first.x, first.y);
    if (points.length === 2) {
      const last = this.worldToScreen(points[1].x, points[1].y);
      ctx.lineTo(last.x, last.y);
      return;
    }
    for (let index = 1; index < points.length - 1; index++) {
      const point = this.worldToScreen(points[index].x, points[index].y);
      const next = this.worldToScreen(points[index + 1].x, points[index + 1].y);
      ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
    }
    const tail = this.worldToScreen(points[points.length - 1].x, points[points.length - 1].y);
    ctx.lineTo(tail.x, tail.y);
  }

  snakeTouchesViewport(snake, padding = 0) {
    if (!snake?.trail?.length) return false;
    const view = this.getViewportWorldBounds(padding);
    // The old head/tail-only cull missed a long body crossing the screen with both ends offscreen.
    // Sampling every segment is cheap at this bot count and prevents that visible pop-in.
    for (const point of snake.trail) {
      if (point.x >= view.left && point.x <= view.right && point.y >= view.top && point.y <= view.bottom) return true;
    }
    return false;
  }

  drawDeathEcho(echo, scale) {
    if (!echo?.trail || echo.trail.length < 2) return;
    const ctx = this.ctx;
    const skin = getSkin(echo.skinId);
    const remaining = clamp(1 - echo.age / echo.ttl, 0, 1);
    const baseRadius = this.getSnakeRadius({ mass: echo.mass }) * scale;
    if (!this.snakeTouchesViewport({ trail: echo.trail }, this.getSnakeRadius({ mass: echo.mass }) * 2 + 54 / Math.max(scale, .001))) return;
    ctx.save();
    ctx.globalAlpha = remaining * .38;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = skin.primary;
    ctx.shadowColor = skin.primary;
    ctx.shadowBlur = 11 * scale * remaining;
    ctx.lineWidth = baseRadius * 1.34;
    ctx.beginPath();
    this.traceSnakePath(ctx, echo.trail);
    ctx.stroke();
    ctx.restore();
  }

  drawSnake(snake, scale) {
    const ctx = this.ctx;
    const points = this.getRenderedTrail(snake);
    if (points.length < 2) return;
    const skin = getSkin(snake.skinId);
    const width = this.canvas.width;
    const height = this.canvas.height;
    const baseRadius = this.getSnakeRadius(snake) * scale;
    const worldPadding = this.getSnakeRadius(snake) * 2 + 54 / Math.max(scale, .001);
    if (!this.snakeTouchesViewport({ trail: points }, worldPadding)) return;

    ctx.save();
    ctx.globalAlpha = clamp(snake.entryAlpha ?? 1, 0, 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (snake.glow > 0 || ["neon", "ember", "nebula", "lava", "crystal"].includes(skin.pattern)) {
      ctx.shadowColor = skin.primary;
      ctx.shadowBlur = (["neon", "nebula"].includes(skin.pattern) ? 19 : 13) * scale;
    }
    ctx.lineWidth = baseRadius * 1.38;
    ctx.strokeStyle = skin.primary;
    ctx.beginPath();
    this.traceSnakePath(ctx, points);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.lineWidth = baseRadius * .43;
    ctx.strokeStyle = skin.secondary;
    ctx.globalAlpha = .72;
    if (["stripe", "bands", "prism", "ember", "tiger", "chevron", "aurora", "spark", "lava", "dragon", "crystal", "nebula"].includes(skin.pattern)) {
      ctx.setLineDash([Math.max(3, baseRadius * .62), Math.max(3, baseRadius * .46)]);
      ctx.lineDashOffset = -this.elapsed * snake.speed * .14 * scale;
    }
    ctx.beginPath();
    this.traceSnakePath(ctx, points);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (["dots", "wave", "scales", "petals", "galaxy", "moth", "nebula", "crystal"].includes(skin.pattern)) {
      const dotStride = skin.pattern === "dots" ? 6 : ["galaxy", "nebula"].includes(skin.pattern) ? 8 : 7;
      ctx.fillStyle = skin.accent ?? skin.secondary;
      ctx.globalAlpha = .72;
      for (let index = 4; index < points.length; index += dotStride) {
        const point = this.worldToScreen(points[index].x, points[index].y);
        const r = skin.pattern === "dots" ? baseRadius * .12 : skin.pattern === "scales" ? baseRadius * .15 : skin.pattern === "crystal" ? baseRadius * .12 : baseRadius * .09;
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(1.4, r), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    const head = this.worldToScreen(snake.x, snake.y);
    const headRadius = baseRadius * .83;
    const headGradient = ctx.createRadialGradient(head.x - headRadius * .25, head.y - headRadius * .3, headRadius * .1, head.x, head.y, headRadius);
    headGradient.addColorStop(0, snake.invulnerable > 0 && Math.sin(this.elapsed * 15) > 0 ? "#ffffff" : skin.secondary);
    headGradient.addColorStop(1, skin.primary);
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(head.x, head.y, headRadius, 0, TAU);
    ctx.fill();

    if (skin.pattern === "crown") {
      ctx.save();
      ctx.translate(head.x, head.y - headRadius * .88);
      ctx.fillStyle = "#ffd43b";
      ctx.beginPath();
      ctx.moveTo(-headRadius * .5, headRadius * .13);
      ctx.lineTo(-headRadius * .35, -headRadius * .52);
      ctx.lineTo(0, -headRadius * .05);
      ctx.lineTo(headRadius * .35, -headRadius * .52);
      ctx.lineTo(headRadius * .5, headRadius * .13);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (skin.pattern === "dragon" || skin.pattern === "crystal") {
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(snake.angle);
      ctx.fillStyle = skin.accent ?? skin.secondary;
      const spike = headRadius * (skin.pattern === "dragon" ? .62 : .50);
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-headRadius * .15, sign * headRadius * .50);
        ctx.lineTo(-headRadius * .68, sign * headRadius * .62);
        ctx.lineTo(-headRadius * .40, sign * headRadius * .05);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.fillStyle = "rgba(255,255,255,.91)";
    const eyeAngle = snake.angle;
    const eyeOffset = headRadius * .42;
    const eyeSpread = headRadius * .35;
    for (const sign of [-1, 1]) {
      const ex = head.x + Math.cos(eyeAngle) * eyeOffset + Math.cos(eyeAngle + sign * Math.PI / 2) * eyeSpread;
      const ey = head.y + Math.sin(eyeAngle) * eyeOffset + Math.sin(eyeAngle + sign * Math.PI / 2) * eyeSpread;
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(1, headRadius * .19), 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#0b1220";
      ctx.beginPath();
      ctx.arc(ex + Math.cos(eyeAngle) * headRadius * .05, ey + Math.sin(eyeAngle) * headRadius * .05, Math.max(1, headRadius * .085), 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.91)";
    }
    if (snake.human) {
      ctx.fillStyle = "rgba(245,250,255,.92)";
      ctx.font = `${Math.max(10, 11 * scale)}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(snake.name, head.x, head.y - headRadius - 8 * scale);
    }
    ctx.restore();
  }

  escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }
}

runOnStartup(async (runtime) => {
  runtime.addEventListener("beforeprojectstart", () => {
    const game = new SlitherArena(runtime);
    globalThis.SlitherArenaGame = game;
    game.start().catch((error) => {
      console.error("[SlitherArena] Startup failed", error);
      const fallback = document.createElement("pre");
      fallback.textContent = `Slither Arena startup error:\n${error?.stack ?? error}`;
      fallback.style.cssText = "position:fixed;z-index:2147483647;inset:0;margin:0;padding:16px;background:#111;color:#fff;white-space:pre-wrap";
      document.body.appendChild(fallback);
    });
  });
});
