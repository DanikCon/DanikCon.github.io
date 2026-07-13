/*
  Snake: King of the Arena — Construct 3 JS runtime (ads/reward/leaderboard/stability fixes v0.32)
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
  BANNER_MODE: "platform-policy", // Yandex sticky stays on; VK/OK sticky on desktop and mobile portrait only
  DEBUG_FAKE_ADS: false,
  DEBUG_FAKE_PURCHASES: false,
  SAVE_KEY: "slither_arena_progress_v1"
});

const PLATFORM_SDK = Object.freeze({
  GAMEPUSH_PROJECT_ID: 29063,
  // Public token is intentionally client-side. Do not put a GamePush private key in this project.
  GAMEPUSH_PUBLIC_TOKEN: "Bf2XibKx6MhHfeWqWgUx2fPiaYzMtdTX",
  PLAYGAMA_CONFIG_PATH: "playgama-bridge-config.json",
  // GamePush global leaderboard uses the built-in public numeric player field already present in the dashboard.
  // Live leaderboard must use the existing GamePush best_weight field.
  // The built-in score field is mirrored only for compatibility with default GamePush/Yandex tables.
  LEADERBOARD_FIELD: "best_weight",
  BEST_WEIGHT_FIELD: "score",
  LEADERBOARD_LIMIT: 10,
  // Official Yandex currency icon is read from the Yandex product SDK when available.
  // No fake currency icon is drawn when the platform does not provide one.
  YAN_ICON_URL: "",
  SDK_WAIT_MS: 5200,
  STORAGE_KEY: "slither_progress",
  // Direct public community URLs. They are opened from the click handler so no
  // platform-specific popup API is required for a simple subscription action.
  COMMUNITY_URLS: Object.freeze({
    vk: "https://vk.com/public162959143",
    ok: "https://ok.ru/group/70000042375809"
  }),
  // Product tags must match the GamePush dashboard exactly.
  STORE_PRICE_LABELS: Object.freeze({
    yandex: "29",
    vk: "4 голоса",
    ok: "26 ОК",
    gamepush: "29",
    local: "29 ЯН"
  })
});


const SUPPORTED_LANGUAGES = Object.freeze(["ru", "en", "tr", "pt"]);

/* All player-facing strings are deliberately kept in one compact dictionary. Platform language
   is taken from GamePush on Yandex/VK/OK and from Playgama Bridge on Playgama. */
const I18N = Object.freeze({
  ru: {
    loading: { title: "Готовим арену", subtitle: "Загружаем игру и проверяем рекламу." },
    hud: { weight: "Вес", best: "Лучший: {value}", rank: "Место #{rank} из {total}", ready: "Подготовка арены", result: "Итог забега", skins: "Скины", pause: "Меню паузы" },
    hint: { mouse: "Веди мышью • удерживай для ускорения", touch: "Веди пальцем • двойной тап и удержание — ускорение", joystick: "Тяни джойстик • второй палец — ускорение" },
    home: { brand: "Лига арены", title: "Змейка: Король Арены", subtitle: "Собирай свет, расти и перехитри других змеек.", daily: "Цель дня • +{reward} ★", complete: "готово", missions: "Задания дня • {done}/{total}", missionsHint: "Собери все — серия и +{stars} ★", dayStreak: "дн. серия", record: "Рекорд", skins: "Скины", league: "Лига", play: "Играть", tasks: "Задания", wardrobe: "Гардероб", rating: "Рейтинг", controls: "Управление: {mode}", touch: "Тач", joystick: "Джойстик", invite: "Пригласить друга", joinVk: "Подписаться VK", joinOk: "Подписаться OK" },
    gameover: { brand: "Забег завершён", title: "Попробуем ещё?", collision: "Столкновение", summary: "{reason}. Ты набрал {score} веса.", daily: "Цель дня • +{reward} ★", done: "выполнено", weight: "Вес", record: "Рекорд", place: "Место", revive: "▶ Продолжить после видео", reviveSpent: "Вторая попытка уже использована", newMatch: "Новый забег", menu: "В меню", randomSkin: "▶ Получить случайный скин за видео", tasks: "Задания дня" },
    missions: { brand: "Лига арены • ежедневная серия", title: "Задания дня", subtitle: "Выполни все три задания, чтобы продлить серию. Серии открывают редкие скины и дают звёзды Лиги.", streak: "Серия: {value} дн.", fullSet: "Полный набор: +{stars} ★", ready: "готово", completed: "Выполнено", progress: "Прогресс: {value}", anyRun: "В любых забегах", allRuns: "Во всех забегах", rewardReceived: "Награда получена", page: "{current} из {total}", play: "Играть и выполнять", back: "Назад" },
    controls: { brand: "Настройки телефона", title: "Управление", subtitle: "Выбери способ поворота. Тач: двойной тап и удержание. Джойстик: удерживай управление, а вторым пальцем нажми для ускорения.", note: "Выбор сохраняется. Во время игры джойстик появляется ровно там, где ты касаешься экрана.", touch: "Тач", touchDesc: "Веди пальцем по экрану — змейка поворачивает в сторону касания.", joystick: "Джойстик", joystickDesc: "Первый палец ведёт плавающий джойстик. Нажми вторым пальцем для ускорения.", back: "Назад" },
    shop: { brand: "Гардероб", title: "Скины", subtitle: "Нажми на карточку — под каждым скином указан способ открытия и цена.", page: "{current} из {total}", back: "Назад" },
    meta: { selected: "Выбрано", selectedText: "Этот скин уже на змейке", open: "Открыто", openText: "Нажми, чтобы выбрать", free: "Бесплатно", freeText: "Нажми, чтобы открыть", reward: "За видео-рекламу", rewardText: "Посмотри видео — откроется этот скин", rewardRandomText: "Откроется после просмотра видео", purchase: "Покупка", purchaseText: "Нажми, чтобы купить", record: "Рекорд: {value}", progress: "Прогресс: {current}/{goal}", league: "Лига: {value} ★", stars: "Звёзды: {current}/{goal}", streak: "Серия: {value} дн.", wins: "Победы: {value}", available: "Доступно", availableText: "Нажми, чтобы открыть" },
    leaderboard: { brand: "Глобальный рейтинг", title: "Топ 10 игроков по весу", subtitle: "Живые игроки с самым большим рекордом веса за один забег.", record: "Вес", loading: "Загружаем рейтинг…", unavailable: "Рейтинг появится после подключения GamePush и сохранения рекордов игроками.", yourPlace: "Твоё место: #{place}", refresh: "Обновить", back: "Назад", you: "Ты", player: "Игрок арены" },
    toast: { taskComplete: "Задание выполнено: +{reward} ★", allTasks: "Все задания дня выполнены • серия {streak} дн. • +2 ★", skinOpen: "Открыт скин: {name}", freeOpen: "Скин «{name}» открыт бесплатно.", allRewardOpen: "Все скины за видео уже открыты!", loadingVideo: "Загрузка видео…", watchFull: "Скин откроется после полного просмотра видео.", rewardNotCompleted: "Реклама не досмотрена — награда не выдана.", purchaseUnavailable: "Покупка недоступна на этой платформе.", openingPurchase: "Открываю покупку…", purchaseFailed: "Покупка не подтверждена.", skinOpened: "Скин «{name}» открыт.", inviteOpen: "Окно приглашения открыто.", inviteUnavailable: "Приглашения пока недоступны.", communityOpen: "Открылось сообщество игры.", communityUnavailable: "Сообщество пока не настроено.", reviveUnavailable: "Видео сейчас недоступно. Начни новый забег.", reviveDone: "Второй шанс: вес сохранён.", goalDone: "Цель дня выполнена: +{reward} ★ Лиги" },
    objective: { food: "Собери {count} огней", mass: "Дорасти до веса {count}", survive: "Продержись {count} секунд", duel: "Победи {count} соперников" },
    league: { rookie: "Новичок", bronze: "Бронза", silver: "Серебро", gold: "Золото", platinum: "Платина", legend: "Легенда" },
    skin: { mint: "Мятная", berry: "Ягодная", ocean: "Океан", lemon: "Лимон", coral: "Коралл", sakura: "Сакура", jade: "Нефрит", prism: "Призма", ember: "Искра", starlight: "Звёздная пыль", toxic: "Токсин", moth: "Лунная бабочка", nebula: "Туманность", royal: "Королевская", neon: "Неон", gold: "Солнечный", crystal: "Кристалл", dragon: "Дракон", lava: "Лава", cobalt: "Кобальт", tiger: "Тигр", aurora: "Аврора", comet: "Комета", void: "Бездна", legend: "Легенда", phoenix: "Феникс", titan: "Титан", celestial: "Небесный", astral: "Астрал", oracle: "Оракул", afterglow: "Послесвечение", tactician: "Тактик" },
    social: { inviteText: "Присоединяйся ко мне в игре «Змейка: Король Арены»!" },
    currency: { yandex: "", vk: "голоса", ok: "ОК" }, you: "Ты"
  },
  en: {
    loading: { title: "Preparing the arena", subtitle: "Loading the game and checking ads." },
    hud: { weight: "Weight", best: "Best: {value}", rank: "Place #{rank} of {total}", ready: "Preparing arena", result: "Run result", skins: "Skins", pause: "Pause menu" },
    hint: { mouse: "Move with mouse • hold to boost", touch: "Drag to steer • double-tap and hold to boost", joystick: "Drag the joystick • second finger boosts" },
    home: { brand: "Arena League", title: "Snake: King of the Arena", subtitle: "Collect light, grow, and outsmart other snakes.", daily: "Daily goal • +{reward} ★", complete: "complete", missions: "Daily tasks • {done}/{total}", missionsHint: "Finish all — streak and +{stars} ★", dayStreak: "day streak", record: "Record", skins: "Skins", league: "League", play: "Play", tasks: "Tasks", wardrobe: "Wardrobe", rating: "Leaderboard", controls: "Controls: {mode}", touch: "Touch", joystick: "Joystick", invite: "Invite a friend", joinVk: "Follow VK", joinOk: "Follow OK" },
    gameover: { brand: "Run complete", title: "Try again?", collision: "Collision", summary: "{reason}. You reached {score} weight.", daily: "Daily goal • +{reward} ★", done: "complete", weight: "Weight", record: "Record", place: "Place", revive: "▶ Continue after video", reviveSpent: "Second chance already used", newMatch: "New run", menu: "Menu", randomSkin: "▶ Get a random skin after video", tasks: "Daily tasks" },
    missions: { brand: "Arena League • daily streak", title: "Daily tasks", subtitle: "Finish all three tasks to extend your streak. Streaks unlock rare skins and League stars.", streak: "Streak: {value} day(s)", fullSet: "Full set: +{stars} ★", ready: "complete", completed: "Complete", progress: "Progress: {value}", anyRun: "Across all runs", allRuns: "Across all runs", rewardReceived: "Reward received", page: "{current} of {total}", play: "Play and complete", back: "Back" },
    controls: { brand: "Phone settings", title: "Controls", subtitle: "Choose how to steer. Touch: double-tap and hold. Joystick: hold the stick and tap with a second finger to boost.", note: "Your choice is saved. The joystick appears exactly where you touch the screen.", touch: "Touch", touchDesc: "Move your finger to steer toward the touch point.", joystick: "Joystick", joystickDesc: "The first finger controls a floating joystick. Tap with a second finger to boost.", back: "Back" },
    shop: { brand: "Wardrobe", title: "Skins", subtitle: "Tap a card — every skin shows its unlock method and price.", page: "{current} of {total}", back: "Back" },
    meta: { selected: "Selected", selectedText: "This skin is already equipped", open: "Unlocked", openText: "Tap to equip", free: "Free", freeText: "Tap to unlock", reward: "Rewarded video", rewardText: "Watch a video to unlock this skin", rewardRandomText: "Unlocks after a completed video", purchase: "Purchase", purchaseText: "Tap to buy", record: "Record: {value}", progress: "Progress: {current}/{goal}", league: "League: {value} ★", stars: "Stars: {current}/{goal}", streak: "Streak: {value} day(s)", wins: "Wins: {value}", available: "Available", availableText: "Tap to unlock" },
    leaderboard: { brand: "Global leaderboard", title: "Top 10 players by weight", subtitle: "Real players with the highest weight record in one run.", record: "Weight", loading: "Loading leaderboard…", unavailable: "The leaderboard appears after GamePush connects and players save records.", yourPlace: "Your place: #{place}", refresh: "Refresh", back: "Back", you: "You", player: "Arena player" },
    toast: { taskComplete: "Task complete: +{reward} ★", allTasks: "All daily tasks complete • streak {streak} day(s) • +2 ★", skinOpen: "Skin unlocked: {name}", freeOpen: "Skin “{name}” unlocked for free.", allRewardOpen: "All video skins are already unlocked!", loadingVideo: "Loading video…", watchFull: "This skin unlocks after the full video.", rewardNotCompleted: "The video was not finished — no reward was granted.", purchaseUnavailable: "Purchases are unavailable on this platform.", openingPurchase: "Opening purchase…", purchaseFailed: "Purchase was not confirmed.", skinOpened: "Skin “{name}” unlocked.", inviteOpen: "Invite window opened.", inviteUnavailable: "Invites are unavailable right now.", communityOpen: "Game community opened.", communityUnavailable: "Community is not configured yet.", reviveUnavailable: "Video is unavailable. Start a new run.", reviveDone: "Second chance: your weight is saved.", goalDone: "Daily goal complete: +{reward} League stars" },
    objective: { food: "Collect {count} lights", mass: "Reach weight {count}", survive: "Survive for {count} seconds", duel: "Defeat {count} opponent(s)" },
    league: { rookie: "Rookie", bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Platinum", legend: "Legend" },
    skin: { mint: "Mint", berry: "Berry", ocean: "Ocean", lemon: "Lemon", coral: "Coral", sakura: "Sakura", jade: "Jade", prism: "Prism", ember: "Ember", starlight: "Stardust", toxic: "Toxin", moth: "Moon Moth", nebula: "Nebula", royal: "Royal", neon: "Neon", gold: "Sun Gold", crystal: "Crystal", dragon: "Dragon", lava: "Lava", cobalt: "Cobalt", tiger: "Tiger", aurora: "Aurora", comet: "Comet", void: "Void", legend: "Legend", phoenix: "Phoenix", titan: "Titan", celestial: "Celestial", astral: "Astral", oracle: "Oracle", afterglow: "Afterglow", tactician: "Tactician" },
    social: { inviteText: "Join me in Snake: King of the Arena!" },
    currency: { yandex: "", vk: "VK votes", ok: "OK" }, you: "You"
  },
  tr: {
    loading: { title: "Arena hazırlanıyor", subtitle: "Oyun yükleniyor ve reklamlar kontrol ediliyor." },
    hud: { weight: "Ağırlık", best: "En iyi: {value}", rank: "Sıra #{rank} / {total}", ready: "Arena hazırlanıyor", result: "Tur sonucu", skins: "Görünümler", pause: "Duraklatma menüsü" },
    hint: { mouse: "Fareyle yönlendir • hızlanmak için basılı tut", touch: "Yönlendirmek için sürükle • hızlanmak için çift dokun ve basılı tut", joystick: "Joystick'i sürükle • ikinci parmak hızlandırır" },
    home: { brand: "Arena Ligi", title: "Yılan: Arenanın Kralı", subtitle: "Işık topla, büyü ve diğer yılanları alt et.", daily: "Günlük hedef • +{reward} ★", complete: "tamam", missions: "Günlük görevler • {done}/{total}", missionsHint: "Hepsini bitir — seri ve +{stars} ★", dayStreak: "gün serisi", record: "Rekor", skins: "Görünümler", league: "Lig", play: "Oyna", tasks: "Görevler", wardrobe: "Görünümler", rating: "Sıralama", controls: "Kontrol: {mode}", touch: "Dokunmatik", joystick: "Joystick", invite: "Arkadaşını davet et", joinVk: "VK'yi takip et", joinOk: "OK'yi takip et" },
    gameover: { brand: "Tur bitti", title: "Tekrar dene?", collision: "Çarpışma", summary: "{reason}. {score} ağırlığa ulaştın.", daily: "Günlük hedef • +{reward} ★", done: "tamam", weight: "Ağırlık", record: "Rekor", place: "Sıra", revive: "▶ Videodan sonra devam et", reviveSpent: "İkinci şans kullanıldı", newMatch: "Yeni tur", menu: "Menü", randomSkin: "▶ Videodan sonra rastgele görünüm", tasks: "Günlük görevler" },
    missions: { brand: "Arena Ligi • günlük seri", title: "Günlük görevler", subtitle: "Seriyi uzatmak için üç görevin hepsini tamamla. Seriler nadir görünümler ve Lig yıldızları açar.", streak: "Seri: {value} gün", fullSet: "Tam set: +{stars} ★", ready: "tamam", completed: "Tamamlandı", progress: "İlerleme: {value}", anyRun: "Tüm turlarda", allRuns: "Tüm turlarda", rewardReceived: "Ödül alındı", page: "{current} / {total}", play: "Oyna ve tamamla", back: "Geri" },
    controls: { brand: "Telefon ayarları", title: "Kontroller", subtitle: "Dönüş şeklini seç. Dokunmatik: çift dokun ve basılı tut. Joystick: çubuğu tut, hızlanmak için ikinci parmakla bas.", note: "Seçimin kaydedilir. Joystick ekrana dokunduğun yerde görünür.", touch: "Dokunmatik", touchDesc: "Yılan, dokunduğun yöne döner.", joystick: "Joystick", joystickDesc: "İlk parmak kayan joystick'i kontrol eder. İkinci parmak hızlandırır.", back: "Geri" },
    shop: { brand: "Görünümler", title: "Görünümler", subtitle: "Bir karta dokun — her görünümün açılma yöntemi ve fiyatı yazılıdır.", page: "{current} / {total}", back: "Geri" },
    meta: { selected: "Seçili", selectedText: "Bu görünüm takılı", open: "Açıldı", openText: "Kuşanmak için dokun", free: "Ücretsiz", freeText: "Açmak için dokun", reward: "Ödüllü reklam", rewardText: "Bu görünümü açmak için video izle", rewardRandomText: "Video tamamlanınca açılır", purchase: "Satın alma", purchaseText: "Satın almak için dokun", record: "Rekor: {value}", progress: "İlerleme: {current}/{goal}", league: "Lig: {value} ★", stars: "Yıldızlar: {current}/{goal}", streak: "Seri: {value} gün", wins: "Galibiyet: {value}", available: "Uygun", availableText: "Açmak için dokun" },
    leaderboard: { brand: "Küresel sıralama", title: "Ağırlığa göre ilk 10", subtitle: "Tek turda en yüksek ağırlık rekoruna sahip gerçek oyuncular.", record: "Ağırlık", loading: "Sıralama yükleniyor…", unavailable: "GamePush bağlanıp oyuncular rekorlarını kaydedince sıralama görünür.", yourPlace: "Sıran: #{place}", refresh: "Yenile", back: "Geri", you: "Sen", player: "Arena oyuncusu" },
    toast: { taskComplete: "Görev tamamlandı: +{reward} ★", allTasks: "Tüm görevler tamam • seri {streak} gün • +2 ★", skinOpen: "Görünüm açıldı: {name}", freeOpen: "“{name}” görünümü ücretsiz açıldı.", allRewardOpen: "Tüm video görünümleri zaten açık!", loadingVideo: "Video yükleniyor…", watchFull: "Bu görünüm tam video sonrası açılır.", rewardNotCompleted: "Reklam tamamlanmadı — ödül verilmedi.", purchaseUnavailable: "Bu platformda satın alma yok.", openingPurchase: "Satın alma açılıyor…", purchaseFailed: "Satın alma onaylanmadı.", skinOpened: "“{name}” görünümü açıldı.", inviteOpen: "Davet penceresi açıldı.", inviteUnavailable: "Davet şu anda kullanılamıyor.", communityOpen: "Oyun topluluğu açıldı.", communityUnavailable: "Topluluk henüz ayarlanmadı.", reviveUnavailable: "Video kullanılamıyor. Yeni tur başlat.", reviveDone: "İkinci şans: ağırlığın korundu.", goalDone: "Günlük hedef tamam: +{reward} Lig yıldızı" },
    objective: { food: "{count} ışık topla", mass: "{count} ağırlığa ulaş", survive: "{count} saniye hayatta kal", duel: "{count} rakibi yen" },
    league: { rookie: "Çaylak", bronze: "Bronz", silver: "Gümüş", gold: "Altın", platinum: "Platin", legend: "Efsane" },
    skin: { mint: "Nane", berry: "Böğürtlen", ocean: "Okyanus", lemon: "Limon", coral: "Mercan", sakura: "Sakura", jade: "Yeşim", prism: "Prizma", ember: "Kor", starlight: "Yıldız Tozu", toxic: "Toksin", moth: "Ay Güvesi", nebula: "Bulutsu", royal: "Kraliyet", neon: "Neon", gold: "Güneş Altını", crystal: "Kristal", dragon: "Ejderha", lava: "Lav", cobalt: "Kobalt", tiger: "Kaplan", aurora: "Aurora", comet: "Kuyruklu Yıldız", void: "Boşluk", legend: "Efsane", phoenix: "Anka", titan: "Titan", celestial: "Göksel", astral: "Astral", oracle: "Kâhin", afterglow: "Işıltı", tactician: "Taktikçi" },
    social: { inviteText: "Yılan: Arenanın Kralı oyununda bana katıl!" },
    currency: { yandex: "", vk: "VK oyu", ok: "OK" }, you: "Sen"
  },
  pt: {
    loading: { title: "Preparando a arena", subtitle: "Carregando o jogo e verificando anúncios." },
    hud: { weight: "Peso", best: "Recorde: {value}", rank: "Lugar #{rank} de {total}", ready: "Preparando a arena", result: "Resultado da partida", skins: "Visuais", pause: "Menu de pausa" },
    hint: { mouse: "Mova com o mouse • segure para acelerar", touch: "Arraste para virar • toque duas vezes e segure para acelerar", joystick: "Arraste o joystick • o segundo dedo acelera" },
    home: { brand: "Liga da arena", title: "Cobra: Rei da Arena", subtitle: "Colete luz, cresça e supere outras cobras.", daily: "Meta diária • +{reward} ★", complete: "concluída", missions: "Tarefas diárias • {done}/{total}", missionsHint: "Conclua todas — sequência e +{stars} ★", dayStreak: "dias seguidos", record: "Recorde", skins: "Visuais", league: "Liga", play: "Jogar", tasks: "Tarefas", wardrobe: "Visuais", rating: "Ranking", controls: "Controles: {mode}", touch: "Toque", joystick: "Joystick", invite: "Convidar amigo", joinVk: "Seguir VK", joinOk: "Seguir OK" },
    gameover: { brand: "Partida encerrada", title: "Tentar de novo?", collision: "Colisão", summary: "{reason}. Você alcançou {score} de peso.", daily: "Meta diária • +{reward} ★", done: "concluída", weight: "Peso", record: "Recorde", place: "Lugar", revive: "▶ Continuar após o vídeo", reviveSpent: "Segunda chance já usada", newMatch: "Nova partida", menu: "Menu", randomSkin: "▶ Ganhar visual aleatório após vídeo", tasks: "Tarefas diárias" },
    missions: { brand: "Liga da arena • sequência diária", title: "Tarefas diárias", subtitle: "Complete as três tarefas para manter sua sequência. Sequências desbloqueiam visuais raros e estrelas da Liga.", streak: "Sequência: {value} dia(s)", fullSet: "Conjunto completo: +{stars} ★", ready: "concluída", completed: "Concluída", progress: "Progresso: {value}", anyRun: "Em todas as partidas", allRuns: "Em todas as partidas", rewardReceived: "Recompensa recebida", page: "{current} de {total}", play: "Jogar e concluir", back: "Voltar" },
    controls: { brand: "Configurações do telefone", title: "Controles", subtitle: "Escolha como virar. Toque: toque duas vezes e segure. Joystick: segure o controle e toque com o segundo dedo para acelerar.", note: "Sua escolha é salva. O joystick aparece exatamente onde você toca na tela.", touch: "Toque", touchDesc: "Mova o dedo para virar na direção do toque.", joystick: "Joystick", joystickDesc: "O primeiro dedo controla o joystick flutuante. O segundo dedo acelera.", back: "Voltar" },
    shop: { brand: "Visuais", title: "Visuais", subtitle: "Toque no cartão — cada visual mostra como desbloquear e o preço.", page: "{current} de {total}", back: "Voltar" },
    meta: { selected: "Selecionado", selectedText: "Este visual já está equipado", open: "Desbloqueado", openText: "Toque para equipar", free: "Grátis", freeText: "Toque para desbloquear", reward: "Anúncio recompensado", rewardText: "Assista a um vídeo para desbloquear este visual", rewardRandomText: "Desbloqueia após o vídeo completo", purchase: "Comprar", purchaseText: "Toque para comprar", record: "Recorde: {value}", progress: "Progresso: {current}/{goal}", league: "Liga: {value} ★", stars: "Estrelas: {current}/{goal}", streak: "Sequência: {value} dia(s)", wins: "Vitórias: {value}", available: "Disponível", availableText: "Toque para desbloquear" },
    leaderboard: { brand: "Ranking global", title: "Top 10 por peso", subtitle: "Jogadores reais com o maior recorde de peso em uma partida.", record: "Peso", loading: "Carregando ranking…", unavailable: "O ranking aparece quando o GamePush conecta e os jogadores salvam recordes.", yourPlace: "Sua posição: #{place}", refresh: "Atualizar", back: "Voltar", you: "Você", player: "Jogador da arena" },
    toast: { taskComplete: "Tarefa concluída: +{reward} ★", allTasks: "Todas as tarefas concluídas • sequência de {streak} dia(s) • +2 ★", skinOpen: "Visual desbloqueado: {name}", freeOpen: "Visual “{name}” desbloqueado grátis.", allRewardOpen: "Todos os visuais por vídeo já foram desbloqueados!", loadingVideo: "Carregando vídeo…", watchFull: "Este visual desbloqueia após o vídeo completo.", rewardNotCompleted: "O vídeo não foi concluído — nenhuma recompensa foi concedida.", purchaseUnavailable: "Compras indisponíveis nesta plataforma.", openingPurchase: "Abrindo compra…", purchaseFailed: "A compra não foi confirmada.", skinOpened: "Visual “{name}” desbloqueado.", inviteOpen: "Janela de convite aberta.", inviteUnavailable: "Convites indisponíveis no momento.", communityOpen: "Comunidade do jogo aberta.", communityUnavailable: "A comunidade ainda não foi configurada.", reviveUnavailable: "Vídeo indisponível. Inicie uma nova partida.", reviveDone: "Segunda chance: seu peso foi salvo.", goalDone: "Meta diária concluída: +{reward} estrelas da Liga" },
    objective: { food: "Colete {count} luzes", mass: "Alcance o peso {count}", survive: "Sobreviva por {count} segundos", duel: "Derrote {count} oponente(s)" },
    league: { rookie: "Novato", bronze: "Bronze", silver: "Prata", gold: "Ouro", platinum: "Platina", legend: "Lenda" },
    skin: { mint: "Menta", berry: "Frutas vermelhas", ocean: "Oceano", lemon: "Limão", coral: "Coral", sakura: "Sakura", jade: "Jade", prism: "Prisma", ember: "Brasa", starlight: "Poeira estelar", toxic: "Toxina", moth: "Mariposa lunar", nebula: "Nebulosa", royal: "Real", neon: "Neon", gold: "Ouro solar", crystal: "Cristal", dragon: "Dragão", lava: "Lava", cobalt: "Cobalto", tiger: "Tigre", aurora: "Aurora", comet: "Cometa", void: "Vazio", legend: "Lenda", phoenix: "Fênix", titan: "Titã", celestial: "Celestial", astral: "Astral", oracle: "Oráculo", afterglow: "Pós-brilho", tactician: "Tático" },
    social: { inviteText: "Junte-se a mim em Cobra: Rei da Arena!" },
    currency: { yandex: "", vk: "votos VK", ok: "OK" }, you: "Você"
  }
});

function normalizeLanguageCode(value) {
  const raw = String(value ?? "").trim().toLowerCase().replace(/_/g, "-");
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("tr")) return "tr";
  if (raw.startsWith("pt")) return "pt";
  if (raw.startsWith("en")) return "en";
  return "en";
}

function getUrlLanguageOverride() {
  try {
    const params = new URLSearchParams(globalThis.location?.search ?? "");
    for (const key of ["lang", "language", "locale", "gp_language", "gamepush_language", "yandex_lang"]) {
      const value = params.get(key);
      if (value) return normalizeLanguageCode(value);
    }
  } catch (_error) { /* no-op */ }
  return "";
}

function isCaptureMode() {
  try {
    const params = new URLSearchParams(globalThis.location?.search ?? "");
    for (const key of ["capture", "clean", "screenshot", "record", "video", "noads"]) {
      if (!params.has(key)) continue;
      const value = String(params.get(key) ?? "1").trim().toLowerCase();
      if (!["0", "false", "off", "no"].includes(value)) return true;
    }
  } catch (_error) { /* no-op */ }
  return false;
}

function getStartupLanguageHint() {
  // URL override is a deliberate Preview/capture shortcut, e.g. ?lang=ru&capture=1.
  // It must win over SDK/browser language so screenshots can be made in every locale.
  const forcedLanguage = getUrlLanguageOverride();
  if (forcedLanguage) return forcedLanguage;
  return normalizeLanguageCode(
    globalThis.document?.documentElement?.lang
    ?? globalThis.navigator?.language
    ?? globalThis.navigator?.languages?.[0]
  );
}
function getI18nValue(language, path) {
  const read = (source) => String(path).split(".").reduce((value, key) => value && typeof value === "object" ? value[key] : undefined, source);
  return read(I18N[language]) ?? read(I18N.en) ?? read(I18N.ru) ?? path;
}
function formatI18n(template, values = {}) {
  return String(template).replace(/\{([\w]+)\}/g, (_match, key) => values[key] ?? `{${key}}`);
}

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
    version: 10,
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
    version: 10,
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
  { name: "Новичок", nameKey: "league.rookie", min: 0, next: 8 },
  { name: "Бронза", nameKey: "league.bronze", min: 8, next: 20 },
  { name: "Серебро", nameKey: "league.silver", min: 20, next: 38 },
  { name: "Золото", nameKey: "league.gold", min: 38, next: 65 },
  { name: "Платина", nameKey: "league.platinum", min: 65, next: 100 },
  { name: "Легенда", nameKey: "league.legend", min: 100, next: null }
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
    this.bannerRequestedVisible = false;
    // Sticky SDK calls are serialized. VK/OK can dispatch viewport resize events while
    // showSticky() is still resolving; without a queue a late close can race the show.
    this.bannerTask = Promise.resolve(false);
    this.initialized = false;
    this.initializing = null;
    this.products = [];
    this.productByTag = new Map();
    this.yanCurrencyIconUrl = PLATFORM_SDK.YAN_ICON_URL;
    this.yanCurrencyCode = "";
    this.yandexCatalogPromise = null;
    this.gpLoadedDirectly = false;
    // Preview/capture mode is for clean screenshots/video: no sticky, preloader,
    // fullscreen or rewarded ads, while still letting ?lang=ru/en/tr/pt force locale.
    this.captureMode = isCaptureMode();
    // A Yandex preloader can only be requested once, before the first menu is opened.
    this.preloaderRequested = false;
    // Playgama storage calls must never overlap. The SDK recommends waiting for a
    // previous storage operation before issuing the next one.
    this.playgamaSaveChain = Promise.resolve();
    this.playgamaReadySignaled = false;
    this.playgamaSaveCount = 0;
    // Reward ads need an explicit completion signal. UI uses this outcome to explain
    // why a skin/revive was not granted when a player closes a video early.
    this.lastRewardOutcome = "idle";
    this.lastInterstitialOutcome = "idle";
    this.rewardAdPromise = null;
    // Monotonic token prevents late SDK promise resolutions from granting a reward
    // after the player closed/skipped a VK/OK rewarded overlay or returned to the page.
    this.rewardAdToken = 0;
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

  get isSocialPlatform() {
    // These two platforms provide native invite/community dialogs through GamePush.
    return this.platform === "vk" || this.platform === "ok";
  }

  get supportsPurchases() {
    // Playgama deliberately converts shop purchases into rewarded-video unlocks.
    return !this.isPlaygama;
  }

  getProductKeys(product = null) {
    return [
      product?.tag,
      product?.id,
      product?.productId,
      product?.productID,
      product?.sku,
      product?.product?.tag,
      product?.product?.id,
      product?.product?.productID,
      product?.platformData?.id,
      product?.platformData?.productID,
      product?.platformData?.productId,
      product?.yandex?.id
    ].map((value) => String(value ?? "").trim()).filter(Boolean);
  }

  getProductForSkin(skin = null) {
    if (!skin?.sku) return null;
    return this.productByTag?.get?.(skin.sku) ?? this.productByTag?.get?.(skin.id) ?? null;
  }

  normalizeProductsList(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.products)) return payload.products;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.list)) return payload.list;
    if (payload?.products && typeof payload.products === "object") return Object.values(payload.products);
    return [];
  }

  registerProducts(payload) {
    const products = this.normalizeProductsList(payload);
    if (!products.length) return [];
    for (const product of products) {
      for (const key of this.getProductKeys(product)) this.productByTag.set(key, product);
      const currencyIcon = this.extractYandexCurrencyIcon(product);
      if (currencyIcon) this.yanCurrencyIconUrl = currencyIcon;
      const currencyCode = this.extractYandexCurrencyCode(product);
      if (currencyCode) this.yanCurrencyCode = currencyCode;
    }
    this.products = products;
    return products;
  }

  extractYandexCurrencyIcon(product = null) {
    if (this.platform !== "yandex") return "";
    const candidates = [];
    try {
      if (typeof product?.getPriceCurrencyImage === "function") {
        candidates.push(product.getPriceCurrencyImage("svg"));
        candidates.push(product.getPriceCurrencyImage("medium"));
        candidates.push(product.getPriceCurrencyImage("small"));
      }
    } catch (_error) {
      // Some wrappers expose the product as plain JSON without Yandex methods.
    }
    candidates.push(
      product?.priceCurrencyImage,
      product?.priceCurrencyImageSmall,
      product?.priceCurrencyImageMedium,
      product?.currencyImage,
      product?.currencyIcon,
      product?.currencyIconUrl,
      product?.platformData?.priceCurrencyImage,
      product?.platformData?.currencyIconUrl,
      product?.product?.priceCurrencyImage,
      product?.product?.currencyIconUrl,
      product?.yandex?.priceCurrencyImage,
      this.yanCurrencyIconUrl,
      PLATFORM_SDK.YAN_ICON_URL
    );
    for (const value of candidates) {
      const url = String(value ?? "").trim();
      if (/^(https?:|data:image\/|blob:)/i.test(url)) return url;
    }
    return "";
  }

  extractYandexCurrencyCode(product = null) {
    if (this.platform !== "yandex") return "";
    const price = String(product?.price ?? product?.platformData?.price ?? "").trim();
    const parsedFromPrice = price.match(/[A-Za-zА-Яа-яЁё₽$€¥₸]+\s*$/u)?.[0]?.trim();
    const candidates = [
      product?.priceCurrencyCode,
      product?.currencyCode,
      product?.currency,
      product?.platformData?.priceCurrencyCode,
      product?.platformData?.currencyCode,
      product?.product?.priceCurrencyCode,
      product?.product?.currencyCode,
      product?.yandex?.priceCurrencyCode,
      parsedFromPrice,
      this.yanCurrencyCode
    ];
    for (const value of candidates) {
      const code = String(value ?? "").trim();
      if (code) return code;
    }
    return "";
  }

  getYandexCurrencyIconUrl(skin = null) {
    return this.extractYandexCurrencyIcon(this.getProductForSkin(skin));
  }

  getYandexCurrencyCode(skin = null) {
    return this.extractYandexCurrencyCode(this.getProductForSkin(skin));
  }

  getProductTitle(skin = null) {
    const product = this.getProductForSkin(skin);
    return String(product?.title ?? product?.name ?? product?.product?.title ?? product?.product?.name ?? product?.platformData?.title ?? product?.yandex?.title ?? "").trim();
  }

  async loadYandexCatalogProducts() {
    if (this.platform !== "yandex") return [];
    if (this.yandexCatalogPromise) return this.yandexCatalogPromise;
    this.yandexCatalogPromise = (async () => {
      try {
        let ysdk = globalThis.ysdk ?? globalThis.YandexGamesSDK ?? null;
        if (!ysdk?.payments?.getCatalog && typeof globalThis.YaGames?.init === "function") {
          ysdk = await Promise.race([
            globalThis.YaGames.init(),
            new Promise((resolve) => setTimeout(() => resolve(null), 2500))
          ]);
        }
        let payments = ysdk?.payments ?? null;
        if (!payments?.getCatalog && typeof ysdk?.getPayments === "function") {
          payments = await Promise.race([
            ysdk.getPayments({ signed: false }),
            new Promise((resolve) => setTimeout(() => resolve(null), 2500))
          ]);
        }
        if (!payments?.getCatalog) return [];
        const catalog = await payments.getCatalog();
        return this.registerProducts(catalog);
      } catch (error) {
        console.warn("[SlitherArena] Yandex catalog currency metadata is not available yet.", error);
        return [];
      }
    })();
    return this.yandexCatalogPromise;
  }

  getPriceLabel(skin = null) {
    // Keep platform prices readable in every supported language. On Yandex the
    // price value, currency code and icon are read from IProduct when available.
    const product = this.getProductForSkin(skin);
    if (this.platform === "yandex") {
      const priceValue = product?.priceValue ?? product?.price_value ?? product?.product?.priceValue ?? product?.platformData?.priceValue;
      if (priceValue) return String(priceValue);
      const price = String(product?.price ?? product?.product?.price ?? product?.platformData?.price ?? "").trim();
      if (price) return price.replace(/[A-Za-zА-Яа-яЁё₽$€¥₸]+\s*$/u, "").trim() || price;
      return PLATFORM_SDK.STORE_PRICE_LABELS.yandex;
    }
    if (this.platform === "vk") return `4 ${getI18nValue(this.getLanguage(), "currency.vk")}`;
    if (this.platform === "ok") return `26 ${getI18nValue(this.getLanguage(), "currency.ok")}`;
    return PLATFORM_SDK.STORE_PRICE_LABELS.gamepush;
  }

  getLanguage() {
    // Explicit Preview/capture locale override wins over GamePush/Yandex/VK/OK.
    const forcedLanguage = getUrlLanguageOverride();
    if (forcedLanguage) return forcedLanguage;
    // Use platform SDK data first. Browser language remains a fallback for local Preview.
    const pg = this.pg ?? this.getPlaygama();
    if (this.isPlaygama) return normalizeLanguageCode(pg?.platform?.language ?? pg?.language ?? globalThis.navigator?.language);
    const gp = this.gp ?? this.getGamePush();
    return normalizeLanguageCode(
      // gp.language is the documented GamePush ISO 639-1 language source.
      gp?.language
      ?? gp?.platform?.language
      ?? gp?.application?.language
      ?? gp?.app?.language
      ?? globalThis.document?.documentElement?.lang
      ?? globalThis.navigator?.language
    );
  }

  async updateBestMassLeaderboard(bestMass) {
    const value = Math.max(0, Math.floor(Number(bestMass) || 0));
    if (!this.isGamePushPlatform || value <= 0) return false;
    await this.initialize();
    const gp = this.gp ?? this.getGamePush();
    if (!gp?.player?.set || !gp?.player?.sync) return false;
    try {
      await this.waitForGamePushPlayer(gp);
      const leaderboardField = PLATFORM_SDK.LEADERBOARD_FIELD; // best_weight
      const mirrorField = PLATFORM_SDK.BEST_WEIGHT_FIELD;      // score mirror
      const currentScore = Number(gp.player.get?.(leaderboardField) ?? gp.player.score ?? 0) || 0;
      const currentMirror = Number(gp.player.get?.(mirrorField) ?? 0) || 0;
      if (value <= currentScore && value <= currentMirror) return true;
      let updated = false;
      if (value > currentScore) {
        try { gp.player.set(leaderboardField, value); updated = true; } catch (error) { console.warn("[SlitherArena] best_weight field is not writable yet.", error); }
        try { gp.player.score = Math.max(Number(gp.player.score || 0), value); } catch (_error) { /* readonly in some SDKs */ }
      }
      if (value > currentMirror) {
        try { gp.player.set(mirrorField, value); updated = true; } catch (_error) { /* best_weight may be absent in some test builds */ }
      }
      if (updated) {
        await gp.player.sync({ storage: "cloud", override: true });
        console.info("[SlitherArena] GamePush best_weight synced:", value);
      }
      return true;
    } catch (error) {
      console.warn("[SlitherArena] Live leaderboard best_weight sync failed.", error);
      return false;
    }
  }

  async fetchBestMassLeaderboard(limit = PLATFORM_SDK.LEADERBOARD_LIMIT) {
    if (!this.isGamePushPlatform) return null;
    await this.initialize();
    const gp = this.gp ?? this.getGamePush();
    if (!gp?.leaderboard?.fetch) return null;
    try {
      await this.waitForGamePushPlayer(gp);
      const field = PLATFORM_SDK.LEADERBOARD_FIELD;       // best_weight
      const mirrorField = PLATFORM_SDK.BEST_WEIGHT_FIELD; // score mirror
      const safeLimit = clamp(Math.floor(limit) || PLATFORM_SDK.LEADERBOARD_LIMIT, 1, PLATFORM_SDK.LEADERBOARD_LIMIT);
      const fetchBy = async (orderField) => await gp.leaderboard.fetch({
        orderBy: [orderField],
        order: "DESC",
        limit: safeLimit,
        includeFields: [field, mirrorField],
        displayFields: [field],
        withMe: "last",
        showNearest: 0
      });
      let result = await fetchBy(field);
      const countPlayers = (item) => (Array.isArray(item?.topPlayers) ? item.topPlayers.length : 0) + (Array.isArray(item?.players) ? item.players.length : 0);
      if (!countPlayers(result) && mirrorField !== field) {
        try {
          const fallback = await fetchBy(mirrorField);
          if (countPlayers(fallback)) result = fallback;
        } catch (_error) { /* keep score result */ }
      }
      if (gp.leaderboard.fetchPlayerRating) {
        try {
          const rating = await gp.leaderboard.fetchPlayerRating({ orderBy: [field], order: "DESC", includeFields: [field, mirrorField], showNearest: 0 });
          if (rating?.player) result = { ...(result ?? {}), player: rating.player };
          if (Array.isArray(rating?.abovePlayers)) result = { ...(result ?? {}), abovePlayers: rating.abovePlayers };
          if (Array.isArray(rating?.belowPlayers)) result = { ...(result ?? {}), belowPlayers: rating.belowPlayers };
        } catch (_error) { /* player rating is optional */ }
      }
      return result ?? null;
    } catch (error) {
      console.warn("[SlitherArena] Live leaderboard fetch failed.", error);
      return null;
    }
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

    if (this.gp && this.platform === "yandex") {
      // GamePush maps this to Yandex Games' preloader placement. It must happen only
      // before the first playable menu, not on later returns to the main menu.
      await this.showYandexPreloader();
      // Sticky is requested only after the first menu is visible. This avoids two
      // ad requests firing at the same instant with the preloader on Yandex.
    }

    if (this.gp && this.isGamePushPlatform) {
      await this.waitForGamePushPlayer(this.gp);
      if (this.gpLoadedDirectly) {
        try { await this.gp.gameStart?.(); } catch (_error) { /* GamePush may already have started the session. */ }
      }
      try {
        const fetched = await this.gp.payments?.fetchProducts?.();
        this.registerProducts(fetched);
      } catch (error) {
        // Products can be unavailable in Preview or before the dashboard is configured.
        console.warn("[SlitherArena] GamePush products are not available yet.", error);
      }
      // Yandex moderation requires the portal currency metadata to be determined
      // automatically from IProduct: priceCurrencyCode and getPriceCurrencyImage().
      await this.loadYandexCatalogProducts();
    }

    // Playgama GAME_READY is deliberately sent later, after the first saved progress
    // has been loaded and the player can interact with the visible main menu.
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
    if (!gp?.player) return;
    // GamePush exposes a ready Promise in current SDKs. Keep an event fallback for
    // older addon builds so the score is never sent before the player model exists.
    try {
      if (gp.player.ready && typeof gp.player.ready.then === "function") {
        await Promise.race([
          gp.player.ready,
          new Promise((resolve) => setTimeout(resolve, 4200))
        ]);
        return;
      }
    } catch (_error) {
      // Continue to the event fallback below.
    }
    if (!gp.player.on || gp.player.isReady === true) return;
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

  getPlaygamaStorageType() {
    const bridge = this.pg ?? this.getPlaygama();
    const storage = bridge?.storage;
    const internal = bridge?.STORAGE_TYPE?.PLATFORM_INTERNAL ?? "platform_internal";
    const fallback = storage?.defaultType ?? null;
    try {
      if (storage?.isAvailable?.(internal) === true) return internal;
    } catch (_error) {
      // Some embedded test hosts do not expose an availability check. Use the
      // SDK default in that case; the write itself still reports a useful result.
    }
    return fallback || internal;
  }

  async loadPlaygamaProgress() {
    const bridge = this.pg ?? this.getPlaygama();
    const storage = bridge?.storage;
    if (!storage?.get) return null;
    const preferred = this.getPlaygamaStorageType();
    const read = async (type) => {
      const value = await storage.get(PLATFORM_SDK.STORAGE_KEY, type);
      const raw = Array.isArray(value) ? value[0] : value?.[PLATFORM_SDK.STORAGE_KEY] ?? value;
      return this.parseProgress(raw);
    };
    try {
      const saved = await read(preferred);
      if (saved) return saved;
    } catch (error) {
      console.warn("[SlitherArena] Playgama progress read failed for the preferred storage.", error);
    }
    // Guest/test sessions can expose only local storage. Keep the cloud attempt first,
    // then use the SDK-supported local fallback rather than falling back outside Bridge.
    if (preferred !== "local_storage") {
      try { return await read("local_storage"); } catch (_error) { /* local fallback unavailable */ }
    }
    return null;
  }

  async savePlaygamaProgress(clean) {
    const bridge = this.pg ?? this.getPlaygama();
    const storage = bridge?.storage;
    if (!storage?.set) return false;
    const payload = JSON.stringify(clean);
    const preferred = this.getPlaygamaStorageType();
    const write = async () => {
      try {
        // Use the documented single-key signature. Besides being easier to inspect in
        // Playgama QA, it guarantees a genuine Bridge storage.set save event.
        await storage.set(PLATFORM_SDK.STORAGE_KEY, payload, preferred);
        this.playgamaSaveCount += 1;
        console.info("[SlitherArena] Playgama save event completed.", { key: PLATFORM_SDK.STORAGE_KEY, storage: preferred, count: this.playgamaSaveCount });
        return true;
      } catch (primaryError) {
        if (preferred === "local_storage") throw primaryError;
        // Platform-internal storage can be unavailable to an unauthorised QA guest.
        // Still write through Bridge so the player keeps progress and QA observes the call.
        await storage.set(PLATFORM_SDK.STORAGE_KEY, payload, "local_storage");
        this.playgamaSaveCount += 1;
        console.info("[SlitherArena] Playgama save event completed via local fallback.", { key: PLATFORM_SDK.STORAGE_KEY, count: this.playgamaSaveCount });
        return true;
      }
    };
    this.playgamaSaveChain = this.playgamaSaveChain.catch(() => false).then(write);
    try {
      return await this.playgamaSaveChain;
    } catch (error) {
      console.warn("[SlitherArena] Playgama progress save failed.", error);
      return false;
    }
  }

  async signalPlaygamaGameReady() {
    if (!this.isPlaygama || this.playgamaReadySignaled) return false;
    const bridge = this.pg ?? this.getPlaygama();
    const send = bridge?.platform?.sendMessage;
    if (typeof send !== "function") return false;
    const message = bridge?.PLATFORM_MESSAGE?.GAME_READY ?? "game_ready";
    try {
      await send.call(bridge.platform, message);
      this.playgamaReadySignaled = true;
      console.info("[SlitherArena] Playgama GAME_READY sent after progress bootstrap.");
      return true;
    } catch (error) {
      console.warn("[SlitherArena] Playgama GAME_READY failed.", error);
      return false;
    }
  }

  parseProgress(raw) {
    if (!raw) return null;
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch (_error) { return null; }
    }
    if (typeof raw === "object") return raw;
    return null;
  }

  readGamePushProgressFields() {
    const player = this.gp?.player;
    if (!player?.get) return null;
    const get = (key) => {
      try { return player.get(key); } catch (_error) { return undefined; }
    };
    const parseJson = (value, fallback) => {
      if (value == null || value === "") return fallback;
      if (typeof value === "object") return value;
      try { return JSON.parse(String(value)); } catch (_error) { return fallback; }
    };
    const mirroredKeys = [
      "best_weight", "score", "selected_skin", "daily_date", "daily_progress", "daily_claimed",
      "mission_date", "mission_streak", "last_mission_completion_date", "league_stars",
      "mission_progress_json", "mission_claimed_json", "unlocked_skins_json", "purchase_skins_json"
    ];
    if (!mirroredKeys.some((key) => get(key) !== undefined && get(key) !== null && get(key) !== "")) return null;
    const mirrored = {
      bestMass: Math.max(Number(get(PLATFORM_SDK.LEADERBOARD_FIELD) || 0) || 0, Number(get(PLATFORM_SDK.BEST_WEIGHT_FIELD) || 0) || 0),
      selectedSkin: get("selected_skin") || undefined,
      dailyDate: get("daily_date") || "",
      dailyProgress: Number(get("daily_progress") || 0),
      dailyClaimed: get("daily_claimed") === true || get("daily_claimed") === "true" || get("daily_claimed") === 1 || get("daily_claimed") === "1",
      missionDate: get("mission_date") || "",
      missionProgress: parseJson(get("mission_progress_json"), {}),
      missionClaimed: parseJson(get("mission_claimed_json"), []),
      missionStreak: Number(get("mission_streak") || 0),
      lastMissionCompletionDate: get("last_mission_completion_date") || "",
      leagueStars: Number(get("league_stars") || 0),
      unlockedSkins: parseJson(get("unlocked_skins_json"), undefined),
      purchaseSkins: parseJson(get("purchase_skins_json"), undefined),
      rewardClaims: Number(get("reward_claims") || 0),
      totalMatches: Number(get("total_matches") || 0),
      totalFood: Number(get("total_food") || 0),
      totalKills: Number(get("total_kills") || 0)
    };
    for (const key of Object.keys(mirrored)) {
      if (mirrored[key] === undefined) delete mirrored[key];
    }
    return mirrored;
  }

  async loadProgress() {
    const local = this.readLocal();
    await this.initialize();
    try {
      if (this.adapter?.loadProgress) {
        return sanitizeProgress((await this.adapter.loadProgress()) ?? local);
      }
      if (this.isPlaygama) {
        const saved = await this.loadPlaygamaProgress();
        if (saved) return sanitizeProgress(saved);
      }
      if (this.gp?.player?.get) {
        const saved = this.parseProgress(this.gp.player.get(PLATFORM_SDK.STORAGE_KEY));
        if (saved) return sanitizeProgress(saved);
        const mirrored = this.readGamePushProgressFields();
        if (mirrored) return sanitizeProgress({ ...(local ?? {}), ...mirrored });
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
      if (this.isPlaygama) {
        return await this.savePlaygamaProgress(clean);
      }
      if (this.gp?.player?.set && this.gp?.player?.sync) {
        try {
          this.gp.player.set(PLATFORM_SDK.STORAGE_KEY, JSON.stringify(clean));
        } catch (error) {
          // If the custom slither_progress field was not created in GamePush yet,
          // keep saving the individual mirrors below instead of aborting the whole sync.
          console.warn("[SlitherArena] Main GamePush progress field is unavailable; syncing mirror fields only.", error);
        }
        // Mirror the readable fields shown in the GamePush player dashboard.
        // Without this, only slither_progress changes and best_weight / league_stars / total_kills can remain at 0.
        const best = Math.max(0, Math.floor(Number(clean.bestMass) || 0));
        const currentBest = Math.max(Number(this.gp.player.get?.(PLATFORM_SDK.LEADERBOARD_FIELD) || 0) || 0, Number(this.gp.player.get?.(PLATFORM_SDK.BEST_WEIGHT_FIELD) || 0) || 0);
        const storedBest = Math.max(best, currentBest);
        try { this.gp.player.set(PLATFORM_SDK.LEADERBOARD_FIELD, storedBest); } catch (_error) { /* dashboard field may be absent in local tests */ }
        try { this.gp.player.set(PLATFORM_SDK.BEST_WEIGHT_FIELD, storedBest); } catch (_error) { /* default score can be readonly on some wrappers */ }
        try { this.gp.player.score = Math.max(Number(this.gp.player.score || 0), storedBest); } catch (_error) { /* readonly in some SDKs */ }
        try { this.gp.player.set("league_stars", Math.max(0, Math.floor(Number(clean.leagueStars) || 0))); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("total_kills", Math.max(0, Math.floor(Number(clean.totalKills) || 0))); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("selected_skin", String(clean.selectedSkin || "mint")); } catch (_error) { /* optional field */ }
        // Optional readable mirrors. The full source of truth is still slither_progress,
        // but these fields make daily streaks, daily tasks and League stars inspectable
        // in the GamePush player dashboard and recoverable if a custom field is missing.
        try { this.gp.player.set("daily_date", String(clean.dailyDate || "")); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("daily_progress", Math.max(0, Math.floor(Number(clean.dailyProgress) || 0))); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("daily_claimed", !!clean.dailyClaimed); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("mission_date", String(clean.missionDate || "")); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("mission_streak", Math.max(0, Math.floor(Number(clean.missionStreak) || 0))); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("last_mission_completion_date", String(clean.lastMissionCompletionDate || "")); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("mission_progress_json", JSON.stringify(clean.missionProgress || {})); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("mission_claimed_json", JSON.stringify(clean.missionClaimed || [])); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("unlocked_skins_json", JSON.stringify(clean.unlockedSkins || [])); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("purchase_skins_json", JSON.stringify(clean.purchaseSkins || [])); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("reward_claims", Math.max(0, Math.floor(Number(clean.rewardClaims) || 0))); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("total_matches", Math.max(0, Math.floor(Number(clean.totalMatches) || 0))); } catch (_error) { /* optional field */ }
        try { this.gp.player.set("total_food", Math.max(0, Math.floor(Number(clean.totalFood) || 0))); } catch (_error) { /* optional field */ }
        await this.gp.player.sync({ storage: "cloud", override: true });
        console.info("[SlitherArena] GamePush cloud fields synced.", { best_weight: storedBest });
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

  readAdFlag(ads, ...keys) {
    for (const key of keys) {
      if (!ads || !(key in ads)) continue;
      try {
        const value = ads[key];
        return typeof value === "function" ? value.call(ads) : value;
      } catch (_error) {
        // Keep probing other aliases from older wrappers/addons.
      }
    }
    return undefined;
  }

  isState(state, constant, word) {
    if (constant !== undefined && state === constant) return true;
    return String(state ?? "").toLowerCase().includes(word);
  }

  setAdOutcome(kind, outcome) {
    if (kind === "rewarded") this.lastRewardOutcome = outcome;
    else this.lastInterstitialOutcome = outcome;
  }

  cancelRewardedAd(outcome = "closed") {
    // In social webviews a skipped rewarded placement can still resolve its promise later.
    // Advancing the token makes that late resolution harmless for skin/revive flows.
    this.rewardAdToken += 1;
    this.rewardAdPromise = null;
    this.setAdOutcome("rewarded", outcome);
  }

  isStrictRewardPlatform() {
    return this.platform === "vk" || this.platform === "ok";
  }

  inferRewardOutcome(value, fallback = "failed") {
    if (value === true || value?.success === true || value?.rewarded === true || value?.state === "rewarded") return "completed";
    // GamePush and embedded webviews use slightly different wording for a dismissed
    // rewarded placement. Treat all close/cancel/skip variants as an unfinished view.
    let raw = "";
    try { raw = typeof value === "string" ? value : JSON.stringify(value ?? ""); } catch (_error) { raw = String(value ?? ""); }
    return /(closed|close|cancel|skip|abort|dismiss)/i.test(raw) ? "closed" : fallback;
  }

  async showPlaygamaAd(kind, placement) {
    const bridge = this.pg ?? this.getPlaygama();
    const ads = bridge?.advertisement;
    if (!ads) {
      this.setAdOutcome(kind, "unavailable");
      return false;
    }
    const eventName = kind === "rewarded" ? "rewarded_state_changed" : "interstitial_state_changed";
    const constants = kind === "rewarded" ? bridge.REWARDED_STATE : bridge.INTERSTITIAL_STATE;
    const show = kind === "rewarded" ? ads.showRewarded : ads.showInterstitial;
    if (typeof show !== "function") {
      this.setAdOutcome(kind, "unavailable");
      return false;
    }

    this.setAdOutcome(kind, "showing");
    return new Promise((resolve) => {
      let settled = false;
      let timeoutId = 0;
      const finish = (outcome) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        try { ads.off?.(eventName, onState); } catch (_error) { /* no-op */ }
        this.setAdOutcome(kind, outcome);
        // A closed interstitial is still a successfully displayed interstitial.
        resolve(kind === "rewarded" ? outcome === "completed" : outcome === "completed" || outcome === "closed");
      };
      const onState = (state) => {
        if (kind === "rewarded" && this.isState(state, constants?.REWARDED, "rewarded")) {
          finish("completed");
          return;
        }
        if (this.isState(state, constants?.FAILED, "failed")) { finish("failed"); return; }
        if (this.isState(state, constants?.CLOSED, "closed")) { finish("closed"); }
      };
      try {
        ads.on?.(eventName, onState);
        const result = show.call(ads, placement);
        Promise.resolve(result).then((value) => {
          if (value === true || value?.rewarded === true || value?.success === true) finish("completed");
          // Some Bridge versions resolve an object for an early close without firing
          // a second state event; preserve that signal for the reward UI.
          else if (value && this.inferRewardOutcome(value, "failed") === "closed") finish("closed");
        }).catch((error) => finish(kind === "rewarded" ? this.inferRewardOutcome(error, "failed") : "failed"));
      } catch (error) {
        console.warn("[SlitherArena] Playgama ad call failed.", error);
        finish("failed");
      }
      timeoutId = setTimeout(() => finish("failed"), 65000);
    });
  }

  async showGamePushRewarded(gp) {
    const ads = gp?.ads;
    // GamePush docs use showRewardedVideo(); keep showRewarded as a fallback for
    // older addon builds that exposed that alias.
    const show = ads?.showRewardedVideo ?? ads?.showRewarded;
    if (typeof show !== "function") {
      this.setAdOutcome("rewarded", "unavailable");
      return false;
    }
    const available = this.readAdFlag(ads, "isRewardedAvailable", "isRewardedVideoAvailable", "IsRewardedAvailable");
    if (available === false) {
      this.setAdOutcome("rewarded", "unavailable");
      return false;
    }

    const strictCompletion = this.isStrictRewardPlatform();
    return await new Promise((resolve) => {
      let settled = false;
      let rewardReceived = false;
      let closeSeen = false;
      let timeoutId = 0;
      const subscriptions = [
        ["rewarded:reward", onReward],
        ["rewarded:finish", onReward],
        ["rewarded:close", onClose],
        ["rewarded:error", onError],
        // The generic events are present in the JS SDK docs and help with older wrappers.
        ["reward", onReward],
        ["close", onGenericClose],
        ["error", onError]
      ];
      const cleanup = () => {
        for (const [event, handler] of subscriptions) {
          try { ads.off?.(event, handler); } catch (_error) { /* no-op */ }
        }
        if (timeoutId) clearTimeout(timeoutId);
      };
      const finish = (outcome) => {
        if (settled) return;
        settled = true;
        cleanup();
        this.setAdOutcome("rewarded", outcome);
        resolve(outcome === "completed");
      };
      function onReward() {
        rewardReceived = true;
        // VK/OK are strict: reward only on the real rewarded event, not on a truthy
        // showRewardedVideo() promise that can also happen after a skipped overlay.
        if (strictCompletion) finish("completed");
      }
      function onClose(success) {
        closeSeen = true;
        if (strictCompletion) {
          // Some VK/OK wrappers emit close before reward. Wait one tick for a real
          // rewarded:reward event, but never treat close(success=true) itself as reward.
          if (rewardReceived) finish("completed");
          else setTimeout(() => { if (!settled) finish(rewardReceived ? "completed" : "closed"); }, 350);
          return;
        }
        finish(success === true || rewardReceived ? "completed" : "closed");
      }
      function onGenericClose(success) {
        // Do not let an unrelated sticky/fullscreen close complete a rewarded flow.
        if (rewardReceived || success === false) onClose(success);
      }
      function onError(error) {
        finish(thisRef.inferRewardOutcome(error, "failed"));
      }
      const thisRef = this;
      try {
        for (const [event, handler] of subscriptions) {
          try { ads.on?.(event, handler); } catch (_error) { /* optional alias */ }
        }
        const result = show.call(ads, { showFailedOverlay: true });
        Promise.resolve(result).then((value) => {
          if (settled) return;
          const explicitReward = value?.rewarded === true || value?.state === "rewarded" || value?.state === "completed" || value?.type === "rewarded:reward";
          if (strictCompletion) {
            if (rewardReceived || explicitReward) finish("completed");
            else if (value && this.inferRewardOutcome(value, "") === "closed") finish("closed");
            // Ignore a bare true/success on VK/OK: skipped videos can resolve truthy.
            return;
          }
          if (value === true || value?.success === true || explicitReward) {
            finish("completed");
          } else if (value && this.inferRewardOutcome(value, "failed") === "closed") {
            finish("closed");
          } else if (value !== undefined) {
            // Some GamePush builds resolve before the rewarded:reward event.
            setTimeout(() => {
              if (!settled && !closeSeen) finish(rewardReceived ? "completed" : "closed");
            }, 300);
          }
        }).catch((error) => finish(this.inferRewardOutcome(error, "closed")));
      } catch (error) {
        console.warn("[SlitherArena] GamePush rewarded ad call failed.", error);
        finish(this.inferRewardOutcome(error, "failed"));
      }
      timeoutId = setTimeout(() => finish(rewardReceived ? "completed" : "closed"), strictCompletion ? 90000 : 90000);
    });
  }

  promiseWithTimeout(promise, timeoutMs, timeoutValue) {
    return Promise.race([
      Promise.resolve(promise),
      new Promise((resolve) => setTimeout(() => resolve(timeoutValue), timeoutMs))
    ]);
  }

  promiseWithAdCloseFallback(promise, timeoutMs, timeoutValue, ads = null) {
    // Some VK/OK webviews return control to the page after an interstitial but never
    // resolve the GamePush promise. Treat explicit fullscreen/interstitial close events,
    // focus/visibility returning, or the watchdog timeout as a closed interstitial.
    const startedAt = Date.now();
    return Promise.race([
      Promise.resolve(promise),
      new Promise((resolve) => {
        let finished = false;
        let fallbackTimer = 0;
        const adEvents = ["fullscreen:close", "fullscreen:finish", "interstitial:close", "interstitial:finish", "ads:close"];
        const cleanup = () => {
          globalThis.removeEventListener?.("focus", onResume, true);
          globalThis.removeEventListener?.("pageshow", onResume, true);
          globalThis.document?.removeEventListener?.("visibilitychange", onResume, true);
          for (const event of adEvents) {
            try { ads?.off?.(event, onAdClose); } catch (_error) { /* optional event */ }
          }
          if (fallbackTimer) clearTimeout(fallbackTimer);
        };
        const finish = (value) => {
          if (finished) return;
          finished = true;
          cleanup();
          resolve(value);
        };
        const onAdClose = () => finish({ success: true, closedByAdEvent: true });
        const onResume = () => {
          if (Date.now() - startedAt < 500) return;
          if (globalThis.document?.visibilityState && globalThis.document.visibilityState !== "visible") return;
          setTimeout(() => finish({ success: true, closedByResume: true }), 180);
        };
        for (const event of adEvents) {
          try { ads?.on?.(event, onAdClose); } catch (_error) { /* optional event */ }
        }
        globalThis.addEventListener?.("focus", onResume, true);
        globalThis.addEventListener?.("pageshow", onResume, true);
        globalThis.document?.addEventListener?.("visibilitychange", onResume, true);
        fallbackTimer = setTimeout(() => finish(timeoutValue), timeoutMs);
      })
    ]);
  }

  async showRewarded(reason) {
    if (this.captureMode || isCaptureMode()) {
      this.setAdOutcome("rewarded", "disabled");
      return false;
    }
    await this.initialize();
    if (this.rewardAdPromise) {
      this.setAdOutcome("rewarded", "showing");
      return false;
    }
    const token = ++this.rewardAdToken;
    this.setAdOutcome("rewarded", "showing");
    const pending = (async () => {
      try {
        if (this.adapter?.showRewarded) {
          const result = await this.promiseWithTimeout(this.adapter.showRewarded(reason), 75000, { state: "closed", timeout: true });
          const outcome = this.inferRewardOutcome(result, result === false ? "closed" : "failed");
          this.setAdOutcome("rewarded", outcome);
          return outcome === "completed";
        }
        if (this.isPlaygama) return await this.showPlaygamaAd("rewarded", `slither_${reason}`);
        const gp = this.gp ?? this.getGamePush();
        if (gp?.ads?.showRewarded || gp?.ads?.showRewardedVideo) {
          return await this.showGamePushRewarded(gp);
        }
        if (CFG.DEBUG_FAKE_ADS) {
          const complete = globalThis.confirm?.("Тестовый rewarded-ролик завершён. Выдать награду?") === true;
          this.setAdOutcome("rewarded", complete ? "completed" : "closed");
          return complete;
        }
        this.setAdOutcome("rewarded", "unavailable");
      } catch (error) {
        console.warn("[SlitherArena] Rewarded ad failed.", error);
        this.setAdOutcome("rewarded", this.inferRewardOutcome(error, "failed"));
      }
      return false;
    })();
    this.rewardAdPromise = pending;
    try {
      const completed = await pending;
      if (token !== this.rewardAdToken) {
        this.setAdOutcome("rewarded", "closed");
        return false;
      }
      return completed === true && this.lastRewardOutcome === "completed";
    } finally {
      if (token === this.rewardAdToken) {
        this.rewardAdPromise = null;
        if (this.lastRewardOutcome === "showing") this.setAdOutcome("rewarded", "closed");
      }
    }
  }

  async showInterstitial() {
    if (this.captureMode || isCaptureMode()) {
      this.setAdOutcome("interstitial", "disabled");
      return false;
    }
    await this.initialize();
    this.setAdOutcome("interstitial", "showing");
    try {
      if (this.adapter?.showInterstitial) {
        const result = await this.adapter.showInterstitial();
        const outcome = result === false ? "failed" : "closed";
        this.setAdOutcome("interstitial", outcome);
        return result === true;
      }
      if (this.isPlaygama) return await this.showPlaygamaAd("interstitial", "slither_gameover");
      const gp = this.gp ?? this.getGamePush();
      if (gp?.ads?.showFullscreen) {
        const available = this.readAdFlag(gp.ads, "isFullscreenAvailable", "IsFullscreenAvailable");
        if (available === false) {
          this.setAdOutcome("interstitial", "unavailable");
          return false;
        }
        const result = await this.promiseWithAdCloseFallback(gp.ads.showFullscreen({ showCountdownOverlay: true }), this.isStrictRewardPlatform() ? 12000 : 20000, { success: true, timeout: true }, gp.ads);
        const shown = result === true || result?.success === true || result === undefined || result?.closedByResume === true || result?.timeout === true;
        this.setAdOutcome("interstitial", shown ? "closed" : "failed");
        return shown;
      }
      this.setAdOutcome("interstitial", "unavailable");
    } catch (error) {
      console.warn("[SlitherArena] Interstitial ad failed.", error);
      this.setAdOutcome("interstitial", "failed");
    }
    return false;
  }

  async showYandexPreloader() {
    if (this.captureMode || isCaptureMode()) return false;
    if (this.preloaderRequested || this.platform !== "yandex") return false;
    this.preloaderRequested = true;
    try {
      const gp = this.gp ?? this.getGamePush();
      if (!gp?.ads?.showPreloader) return false;
      const result = await gp.ads.showPreloader();
      return result === true || result === undefined || result?.success === true;
    } catch (error) {
      // A preloader can be unavailable in Preview/draft without breaking the game launch.
      console.warn("[SlitherArena] Yandex preloader was not shown.", error);
      return false;
    }
  }

  getViewportSize() {
    const viewport = globalThis.visualViewport;
    return {
      width: Math.max(1, Math.round(viewport?.width ?? globalThis.innerWidth ?? 1)),
      height: Math.max(1, Math.round(viewport?.height ?? globalThis.innerHeight ?? 1))
    };
  }

  isPhoneLikeDevice() {
    const nav = globalThis.navigator;
    const ua = String(nav?.userAgent ?? "").toLowerCase();
    if (typeof nav?.userAgentData?.mobile === "boolean") return nav.userAgentData.mobile;
    if (/iphone|ipod|windows phone/.test(ua)) return true;
    if (/android/.test(ua)) return /mobile/.test(ua);
    if (/ipad|tablet/.test(ua)) return false;

    // Fallback for embedded social webviews with a reduced/generic user agent.
    // Use physical screen dimensions: unlike visualViewport, they do not shrink when
    // the native sticky banner reserves its 50-110px area.
    const screenWidth = Number(globalThis.screen?.width ?? 0);
    const screenHeight = Number(globalThis.screen?.height ?? 0);
    const coarse = !!globalThis.matchMedia?.("(pointer: coarse)")?.matches || (nav?.maxTouchPoints ?? 0) > 0;
    return coarse && Math.min(screenWidth || Infinity, screenHeight || Infinity) <= 620;
  }

  isPhysicalPortrait() {
    const orientationType = String(globalThis.screen?.orientation?.type ?? "").toLowerCase();
    if (orientationType.startsWith("portrait")) return true;
    if (orientationType.startsWith("landscape")) return false;

    const legacyOrientation = Number(globalThis.orientation);
    if (Number.isFinite(legacyOrientation)) return Math.abs(legacyOrientation) !== 90;

    const screenWidth = Number(globalThis.screen?.width ?? 0);
    const screenHeight = Number(globalThis.screen?.height ?? 0);
    if (screenWidth > 0 && screenHeight > 0 && screenWidth !== screenHeight) return screenHeight > screenWidth;

    // Last-resort fallback only. This value can be affected by a native ad, so all
    // stable device-orientation signals above take precedence.
    const { width, height } = this.getViewportSize();
    return height >= width;
  }

  shouldShowSocialSticky() {
    // VK/OK: show sticky on desktop/tablet windows and on phones only in portrait.
    // Crucially, orientation is based on the physical screen, not visualViewport.
    // The latter shrinks when the banner renders and previously caused show -> resize
    // -> landscape mis-detection -> closeSticky() after about one second.
    if (this.platform !== "vk" && this.platform !== "ok") return false;
    if (!this.isPhoneLikeDevice()) return true;
    return this.isPhysicalPortrait();
  }

  getDesiredBannerVisibility(visible = this.bannerRequestedVisible) {
    if (this.captureMode || isCaptureMode()) return false;
    if (this.platform === "yandex") return true;
    if (this.isPlaygama) return false;
    if (this.platform === "vk" || this.platform === "ok") return !!visible && this.shouldShowSocialSticky();
    return false;
  }

  syncBannerSafeArea(desired) {
    try {
      const root = globalThis.document?.getElementById?.("slither-arena-root");
      root?.classList?.toggle?.("sa-sticky-safe", !!desired && (this.platform === "vk" || this.platform === "ok"));
    } catch (_error) {
      // Styling is best-effort only; ad visibility must not depend on DOM access.
    }
  }

  async refreshBannerForViewport() {
    return await this.setBannerVisible(this.bannerRequestedVisible);
  }

  async setBannerVisible(visible) {
    // Policy by platform:
    // - Yandex: sticky stays visible for the whole session. We never close it from UI flows.
    // - VK/OK: sticky is requested on non-game screens for PC/tablet and phone portrait.
    // - VK/OK phone landscape: sticky is closed so it cannot overlap the horizontal layout.
    // - Playgama/local/unknown platforms: sticky remains disabled.
    this.bannerRequestedVisible = !!visible;

    // Serialize show/close. Social SDKs may resize the iframe before showSticky()
    // resolves, and screen transitions may request the opposite state meanwhile.
    this.bannerTask = this.bannerTask.catch(() => false).then(async () => {
      const desired = this.getDesiredBannerVisibility(this.bannerRequestedVisible);
      this.syncBannerSafeArea(desired);
      if (this.bannerVisible === desired) return desired;

      try {
        if (this.adapter?.setBannerVisible && (this.platform === "yandex" || this.platform === "vk" || this.platform === "ok")) {
          await this.adapter.setBannerVisible(desired);
          this.bannerVisible = desired;
          return desired;
        }

        const gp = this.gp ?? this.getGamePush();
        if (!gp?.ads) {
          this.bannerVisible = false;
          return false;
        }

        if (desired) {
          const available = this.readAdFlag(gp.ads, "isStickyAvailable", "IsStickyAvailable");
          if (available === false || typeof gp.ads.showSticky !== "function") {
            this.bannerVisible = false;
            return false;
          }
          await gp.ads.showSticky();
        } else {
          if (typeof gp.ads.closeSticky === "function") await gp.ads.closeSticky();
        }

        this.bannerVisible = desired;
        return desired;
      } catch (error) {
        // Preserve the last confirmed state. A failed show must not make later calls
        // believe that a banner is already visible.
        if (desired) this.bannerVisible = false;
        console.warn("[SlitherArena] Banner update failed.", error);
        return false;
      }
    });

    return await this.bannerTask;
  }

  async inviteFriends() {
    await this.initialize();
    if (!this.isSocialPlatform) return false;
    try {
      const socials = (this.gp ?? this.getGamePush())?.socials;
      if (typeof socials?.invite !== "function") return false;
      const result = await socials.invite({ text: getI18nValue(this.getLanguage(), 'social.inviteText') });
      // The platform may report the result through the social event rather than a return value.
      return result !== false && result?.success !== false;
    } catch (error) {
      console.warn("[SlitherArena] Social invite failed.", error);
      return false;
    }
  }

  getCommunityUrl() {
    return PLATFORM_SDK.COMMUNITY_URLS[this.platform] ?? "";
  }

  openCommunityUrl() {
    const url = this.getCommunityUrl();
    if (!url) return false;
    try {
      // Called directly from the button tap. Do NOT fall back to location.assign:
      // VK/OK mobile webviews can open a new tab but still return null from window.open;
      // navigating the current tab afterwards replaces the running game with the group.
      if (typeof globalThis.open === "function") {
        const opened = globalThis.open(url, "_blank");
        if (opened) {
          try { opened.opener = null; } catch (_error) { /* cross-window guard */ }
        }
        return true;
      }
      const doc = globalThis.document;
      if (doc?.createElement) {
        const link = doc.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.position = "fixed";
        link.style.left = "-9999px";
        link.style.top = "-9999px";
        doc.body?.appendChild(link);
        link.click();
        setTimeout(() => link.remove(), 0);
        return true;
      }
    } catch (error) {
      console.warn("[SlitherArena] Could not open community URL.", error);
    }
    return false;
  }

  async joinCommunity() {
    // Explicit URLs are intentional: VK and OK subscription flows do not depend
    // on optional GamePush social configuration. When a URL exists, only open a
    // second tab and keep the first tab with the game intact.
    if (this.getCommunityUrl()) {
      this.openCommunityUrl();
      return true;
    }
    await this.initialize();
    if (!this.isSocialPlatform) return false;
    try {
      const socials = (this.gp ?? this.getGamePush())?.socials;
      if (typeof socials?.joinCommunity !== "function") return false;
      const result = await socials.joinCommunity();
      return result !== false && result?.success !== false;
    } catch (error) {
      console.warn("[SlitherArena] Community join failed.", error);
      return false;
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
    this.language = getStartupLanguageHint();
    this.leaderboardCache = null;
    this.leaderboardLoading = false;
    this.rewardSkinBusy = false;
    this.shopNavLockUntil = 0;
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
    this.postDeathActionPending = false;
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
    this.menuAmbientTime = 0;
    this.menuCritters = this.createMenuCritters();
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
    this.setLanguage(getStartupLanguageHint());
    this.bindInput();
    this.resize();
    this.applyPlatformUi();
    this.updateControlHint();
    const handleViewportResize = () => {
      this.resize();
      this.applyPlatformUi();
      this.updateControlHint();
      void this.bridge.refreshBannerForViewport();
      requestAnimationFrame(() => this.fitOverlayPanel(true));
    };
    globalThis.addEventListener?.("resize", handleViewportResize);
    globalThis.visualViewport?.addEventListener?.("resize", handleViewportResize);
    this.runtime?.addEventListener?.("resize", handleViewportResize);
    const restoreUiAfterExternalOverlay = () => {
      if (globalThis.document?.visibilityState && globalThis.document.visibilityState !== "visible") return;
      requestAnimationFrame(() => {
        this.resize();
        if (this.mode === "shop") {
          this.renderSkinPreviews();
          if (this.rewardSkinBusy && this.bridge.lastRewardOutcome === "showing") {
            this.rewardSkinBusy = false;
            this.bridge.cancelRewardedAd?.("closed");
            this.toast(this.t("toast.rewardNotCompleted"));
            this.showShop(this.shopPage);
          }
        }
        this.fitOverlayPanel(true);
      });
    };
    globalThis.document?.addEventListener?.("visibilitychange", restoreUiAfterExternalOverlay);
    globalThis.addEventListener?.("pageshow", restoreUiAfterExternalOverlay);

    // Render a neutral boot shell instantly, then show the first real menu only after
    // the platform language is known. This prevents a visible wrong-language flash.
    this.progress = sanitizeProgress(this.bridge.readLocal() ?? defaultProgress());
    this.ensureDailyProgress();
    this.ensureMissionProgress();
    this.syncUi();
    this.showBootShell();
    this.loop(performance.now());

    void (async () => {
      const initialized = await this.bridge.initialize();
      this.setLanguage(this.bridge.getLanguage());
      this.applyPlatformUi();
      if (!initialized) {
        if (!this.running && this.mode === "boot") this.showMenu();
        return;
      }
      const cloud = await this.bridge.loadProgress();
      // Avoid replacing a match that has already started while the SDK was initializing.
      if (!this.running && (this.mode === "menu" || this.mode === "boot")) {
        this.progress = cloud;
        this.ensureDailyProgress();
        this.ensureMissionProgress();
        this.syncUi();
        this.showMenu();
      }
      // Playgama QA waits for a real Bridge storage event. Persist the fully loaded
      // progress once on boot, then signal GAME_READY only after the interactive menu is visible.
      if (this.bridge.isPlaygama) await this.bridge.saveProgress(this.progress);
      await this.bridge.signalPlaygamaGameReady();
    })();
  }

  createDom() {
    document.getElementById("slither-arena-root")?.remove();
    this.root = document.createElement("div");
    this.root.id = "slither-arena-root";
    this.root.innerHTML = `
      <style>
        #slither-arena-root { position:fixed; inset:0; z-index:2147482000; overflow:hidden; touch-action:none; overscroll-behavior:none; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; -webkit-user-drag:none; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#f8fbff; }
        #slither-arena-root * { box-sizing:border-box; user-select:none; -webkit-user-select:none; -webkit-touch-callout:none; -webkit-user-drag:none; }
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
        #slither-arena-root.sa-sticky-safe .sa-overlay { padding-bottom:max(66px,calc(env(safe-area-inset-bottom) + 58px)); }
        #slither-arena-root.sa-sticky-safe .sa-panel { max-height:calc(100dvh - 78px) !important; }
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
        @media (max-width:620px) { .sa-top { gap:8px; } .sa-hud-card { min-width:132px; padding:9px 11px; border-radius:15px; } .sa-score-row strong { font-size:24px; } #sa-hud-shop { display:none !important; } .sa-panel { border-radius:23px; } .sa-stat { padding:9px; } .sa-stat strong { font-size:18px; } .sa-bottom { bottom:8px; } .sa-hint { font-size:11px; padding:8px 11px; } }
        @media (pointer:coarse) and (max-width:700px), (pointer:coarse) and (max-height:620px) { #sa-hud-shop { display:none !important; } }

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
        .sa-skin.selected .sa-skin-preview-wrap::before { content:"✓"; position:absolute; left:7px; bottom:6px; z-index:5; padding:3px 5px; border-radius:6px; background:rgba(23,122,177,.78); color:#e8fbff; font-size:8px; font-weight:900; letter-spacing:.08em; }
        /* Loading a rewarded video must not remove the card's snake preview. */
        .sa-skin { position:relative; }
        .sa-skin.sa-reward-loading { cursor:wait; opacity:.78; }
        .sa-skin.sa-reward-loading::before { content:attr(data-busy-label); position:absolute; z-index:20; inset:0; display:grid; place-items:center; padding:12px; border-radius:inherit; background:rgba(5,12,23,.66); color:#f4f9ff; font-size:12px; font-weight:900; text-align:center; text-shadow:0 1px 2px rgba(0,0,0,.5); pointer-events:none; }
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


        /* v0.18: platform controls use only inline SVG and inherit the system UI font.
           No remote fonts, emoji sprites or platform-specific image assets are required. */
        .sa-loading-panel { width:min(350px,calc(100vw - 28px)); text-align:center; overflow:hidden !important; }
        .sa-loading-orb { width:62px; height:62px; margin:0 auto 15px; border:2px solid rgba(181,228,255,.33); border-top-color:#76d6ff; border-radius:50%; box-shadow:0 0 30px rgba(101,182,255,.22); animation:sa-spin .92s linear infinite; }
        .sa-loading-panel .sa-subtitle { margin:8px 0 0; }
        @keyframes sa-spin { to { transform:rotate(360deg); } }

        .sa-menu-actions .sa-social-btn { display:flex; align-items:center; justify-content:center; gap:7px; background:linear-gradient(145deg,rgba(79,111,179,.22),rgba(22,35,59,.92)); border:1px solid rgba(141,194,255,.24); box-shadow:inset 0 1px rgba(255,255,255,.11),0 8px 18px rgba(0,0,0,.14); }
        .sa-social-btn svg { width:17px; height:17px; flex:0 0 auto; fill:none; stroke:#dff4ff; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
        .sa-social-btn .sa-social-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sa-yandex-currency { display:inline-flex; align-items:center; gap:5px; margin-left:2px; vertical-align:middle; white-space:nowrap; }
        .sa-yandex-currency .sa-yan-icon { width:18px; height:18px; flex:0 0 auto; vertical-align:-4px; object-fit:contain; filter:drop-shadow(0 1px 2px rgba(0,0,0,.22)); }
        .sa-yan-css-badge { width:18px; height:18px; flex:0 0 18px; display:inline-grid; place-items:center; transform:rotate(-9deg); border-radius:5px; background:linear-gradient(135deg,#ffd64f,#ff9b1a); color:#9b3d00; font-size:13px; font-weight:1000; line-height:1; box-shadow:0 1px 0 rgba(255,255,255,.45) inset,0 2px 5px rgba(0,0,0,.22); }
        .sa-currency-price { white-space:nowrap; }
        .sa-currency-code { white-space:nowrap; font-weight:900; opacity:.92; }

        /* Rich portrait layout: more information is visible when vertical room exists.
           Landscape keeps controls compact instead of clipping them. */
        @media (pointer:coarse) and (orientation:portrait) and (min-height:620px) {
          .sa-menu-panel { padding:15px !important; }
          .sa-menu-panel .sa-menu-hero { min-height:72px; }
          .sa-menu-panel .sa-menu-progress { gap:9px; }
          .sa-menu-panel .sa-mission-teaser, .sa-menu-panel .sa-stat-row { display:grid !important; }
          .sa-menu-panel .sa-menu-actions { grid-template-rows:repeat(4,42px) !important; }
          .sa-menu-panel .sa-menu-actions .sa-social-btn { min-height:42px; font-size:11px; }
        }
        @media (pointer:coarse) and (orientation:portrait) and (max-height:619px) {
          .sa-menu-panel .sa-menu-actions { grid-template-rows:repeat(4,39px) !important; }
          .sa-menu-panel .sa-menu-actions .sa-social-btn { min-height:39px; font-size:10px; padding:7px 8px; }
        }
        @media (pointer:coarse) and (orientation:landscape) and (max-height:620px) {
          /* VK/OK add two social actions. Three explicit rows prevent implicit-grid overflow. */
          .sa-menu-panel .sa-menu-actions { grid-template-columns:repeat(3,minmax(0,1fr)) !important; grid-template-rows:repeat(3,39px) !important; }
          .sa-menu-panel .sa-menu-actions .sa-play { grid-column:span 3 !important; grid-row:auto !important; }
          .sa-menu-panel .sa-menu-actions .sa-controls-btn { grid-column:auto !important; }
          .sa-menu-panel .sa-menu-actions .sa-social-btn { min-height:39px; padding:7px 8px; font-size:10px; }
          .sa-menu-panel .sa-menu-actions .sa-social-btn .sa-social-label { font-size:10px; }
        }
        @media (pointer:coarse) and (orientation:landscape) and (max-height:470px) {
          .sa-menu-panel .sa-menu-actions { grid-template-columns:repeat(3,minmax(0,1fr)) !important; grid-template-rows:39px repeat(2,35px) !important; gap:5px !important; }
          .sa-menu-panel .sa-menu-actions .sa-play { grid-column:span 3 !important; }
          .sa-menu-panel .sa-menu-actions .sa-btn { min-height:35px; padding:6px 7px; font-size:10px; }
          .sa-menu-panel .sa-menu-actions .sa-social-btn { min-height:35px; padding:6px; }
          .sa-menu-panel .sa-menu-actions .sa-social-btn .sa-social-label { display:none; }
          .sa-menu-panel .sa-menu-actions .sa-social-btn svg { width:18px; height:18px; }
        }


        /* v0.19: universal viewport fitting. Construct embeds can expose a visual viewport
           shorter than their CSS frame (notably Safari, VK and OK). Panels now measure their
           full content and scale down as one unit instead of clipping a lower section. */
        .sa-overlay > .sa-panel {
          --sa-fit-scale:1;
          transform:scale(var(--sa-fit-scale));
          transform-origin:center center;
          will-change:transform;
        }
        .sa-overlay {
          padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));
        }
        .sa-panel.sa-auto-fit { box-shadow:0 18px 62px rgba(0,0,0,.50),inset 0 1px rgba(255,255,255,.10); }

        /* Keep compact panels comfortably inside the frame rather than filling it edge-to-edge. */
        @media (pointer:coarse) {
          .sa-panel,
          .sa-menu-panel,
          .sa-missions-panel,
          .sa-controls-panel,
          .sa-shop-panel,
          .sa-gameover-panel {
            width:min(500px,calc(100vw - 28px)) !important;
            height:auto !important;
            max-height:none !important;
          }
          .sa-menu-panel, .sa-missions-panel, .sa-controls-panel, .sa-shop-panel, .sa-gameover-panel {
            min-height:0 !important;
          }
          .sa-missions-panel.sa-missions-phone {
            width:min(500px,calc(100vw - 28px)) !important;
            height:auto !important;
            max-height:none !important;
          }
          /* The game HUD remains useful on phones: rank is no longer hidden. */
          .sa-rank {
            display:block !important;
            max-width:142px;
            margin-top:4px;
            overflow:hidden;
            color:#dbe7f8;
            font-size:9px;
            line-height:1.15;
            font-weight:800;
            white-space:nowrap;
            text-overflow:ellipsis;
          }
          .sa-hud-card { min-width:136px !important; }

          /* Mobile mission pages use an explicit natural card height; the panel fitter
             then shrinks the complete page if the host visual viewport is unusually short. */
          .sa-missions-panel.sa-missions-phone .sa-mission-grid {
            flex:0 0 auto !important;
            height:176px !important;
            min-height:176px !important;
            margin:8px 0 7px !important;
          }
          .sa-missions-panel.sa-missions-phone .sa-mission-card {
            height:176px !important;
            min-height:176px !important;
            overflow:visible !important;
          }
          .sa-missions-panel.sa-missions-phone .sa-mission-footer { overflow:visible !important; }
        }
        @media (pointer:coarse) and (orientation:portrait) and (min-height:700px) {
          .sa-missions-panel.sa-missions-phone .sa-mission-grid,
          .sa-missions-panel.sa-missions-phone .sa-mission-card {
            height:198px !important;
            min-height:198px !important;
          }
        }
        @media (pointer:coarse) and (orientation:landscape) {
          .sa-panel,
          .sa-menu-panel,
          .sa-missions-panel,
          .sa-controls-panel,
          .sa-shop-panel,
          .sa-gameover-panel {
            width:min(440px,calc(100vw - 32px)) !important;
          }
          .sa-missions-panel.sa-missions-phone {
            width:min(440px,calc(100vw - 32px)) !important;
            height:auto !important;
            max-height:none !important;
          }
          .sa-missions-panel.sa-missions-phone .sa-mission-grid,
          .sa-missions-panel.sa-missions-phone .sa-mission-card {
            height:138px !important;
            min-height:138px !important;
          }
        }
        @media (pointer:fine) and (max-height:720px) {
          .sa-panel, .sa-menu-panel, .sa-missions-panel, .sa-controls-panel, .sa-shop-panel, .sa-gameover-panel {
            width:min(488px,calc(100vw - 36px)) !important;
            max-height:none !important;
          }
        }




        /* v0.20: one responsive rule set for every host. Legacy compact rules used
           display:none at short heights; this final layer keeps every important item,
           lets the panel take its natural height, then fitOverlayPanel scales it as a unit. */
        .sa-overlay { overflow:hidden !important; align-items:center !important; justify-content:center !important; }
        .sa-overlay > .sa-panel,
        .sa-overlay > .sa-menu-panel,
        .sa-overlay > .sa-missions-panel,
        .sa-overlay > .sa-controls-panel,
        .sa-overlay > .sa-shop-panel,
        .sa-overlay > .sa-gameover-panel,
        .sa-overlay > .sa-leaderboard-panel {
          width:min(548px,calc(100vw - 28px)) !important;
          height:auto !important;
          min-height:0 !important;
          max-height:none !important;
          overflow:visible !important;
        }
        .sa-menu-panel .sa-subtitle,
        .sa-menu-panel .sa-mission-teaser,
        .sa-menu-panel .sa-stat-row,
        .sa-menu-panel .sa-league-kicker,
        .sa-missions-panel .sa-brand,
        .sa-missions-panel .sa-subtitle,
        .sa-shop-panel .sa-brand,
        .sa-shop-panel .sa-subtitle,
        .sa-controls-panel .sa-brand,
        .sa-controls-panel .sa-subtitle,
        .sa-controls-panel .sa-control-note { display:block !important; }
        .sa-menu-panel .sa-mission-teaser { display:flex !important; }
        .sa-menu-panel .sa-stat-row { display:grid !important; }
        .sa-menu-panel .sa-menu-actions { margin-top:10px !important; }
        .sa-menu-actions .sa-rating-btn { display:flex; align-items:center; justify-content:center; gap:7px; }
        .sa-rating-btn svg { width:17px; height:17px; fill:none; stroke:#dff4ff; stroke-width:1.85; stroke-linejoin:round; }
        .sa-lock-badge svg,.sa-owned-badge svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
        .sa-mission-mark svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; vertical-align:middle; }
        .sa-skin-name { white-space:normal !important; overflow:visible !important; text-overflow:clip !important; min-height:1.05em; }
        .sa-skin-meta em { white-space:normal !important; overflow:visible !important; text-overflow:clip !important; }
        .sa-leaderboard-panel { width:min(480px,calc(100vw - 28px)) !important; }
        .sa-leaderboard-head { position:relative; display:flex; align-items:center; justify-content:space-between; margin:8px 0 6px; color:#9cb2cf; font-size:10px; font-weight:900; letter-spacing:.09em; }
        .sa-leaderboard-list { position:relative; display:grid; gap:6px; margin:8px 0; }
        .sa-leaderboard-row { display:grid; grid-template-columns:42px minmax(0,1fr) auto; align-items:center; gap:9px; min-height:35px; padding:8px 10px; border:1px solid rgba(255,255,255,.10); border-radius:12px; background:rgba(255,255,255,.045); }
        .sa-leaderboard-row:nth-child(1) { border-color:rgba(255,212,59,.45); background:linear-gradient(110deg,rgba(255,212,59,.16),rgba(255,255,255,.04)); }
        .sa-leaderboard-row:nth-child(2) { border-color:rgba(203,214,232,.34); }
        .sa-leaderboard-row:nth-child(3) { border-color:rgba(229,160,107,.34); }
        .sa-leaderboard-row.me { border-color:rgba(99,230,190,.50); background:rgba(70,211,156,.12); }
        .sa-leaderboard-place { color:#9edaff; font-size:12px; font-weight:900; }
        .sa-leaderboard-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#f6fbff; font-size:13px; font-weight:850; }
        .sa-leaderboard-row strong { color:#f9eaa1; font-size:13px; }
        .sa-leaderboard-empty { position:relative; min-height:100px; display:grid; place-items:center; padding:18px; border:1px dashed rgba(142,214,255,.23); border-radius:15px; color:#bdcbe0; text-align:center; font-size:13px; font-weight:750; }
        .sa-leaderboard-me { position:relative; margin:8px 0 0; color:#b7f7df; font-size:12px; font-weight:850; text-align:center; }
        @media (max-height:650px) {
          .sa-overlay > .sa-panel { padding:14px 16px !important; border-radius:22px; }
          .sa-menu-panel .sa-menu-emblem { display:none !important; }
          .sa-menu-panel .sa-menu-hero { display:block !important; }
          .sa-menu-panel .sa-subtitle { margin:5px 0 0 !important; font-size:11px !important; }
          .sa-menu-panel .sa-menu-progress { margin-top:7px !important; gap:7px !important; }
          .sa-menu-panel .sa-mission-teaser { margin-top:7px !important; padding:8px 9px !important; }
          .sa-menu-panel .sa-stat-row { margin-top:7px !important; }
          .sa-menu-panel .sa-stat { min-height:44px !important; padding:7px !important; }
          .sa-menu-panel .sa-stat strong { font-size:15px !important; }
          .sa-menu-panel .sa-menu-actions { margin-top:8px !important; }
          .sa-menu-actions .sa-btn { min-height:37px !important; padding:8px !important; font-size:11px !important; }
          .sa-missions-panel .sa-subtitle { margin:5px 0 7px !important; font-size:11px !important; }
          .sa-missions-panel .sa-mission-grid { min-height:0 !important; height:auto !important; margin:8px 0 !important; }
          .sa-missions-panel .sa-mission-card { min-height:118px !important; height:auto !important; }
          .sa-missions-panel .sa-mission-teaser { margin:6px 0 0 !important; }
          .sa-leaderboard-row { min-height:31px; padding:6px 8px; }
        }
        @media (max-width:540px) {
          .sa-overlay { padding:10px !important; }
          .sa-overlay > .sa-panel { width:calc(100vw - 20px) !important; }
          .sa-menu-panel .sa-title { font-size:clamp(27px,9vw,37px) !important; }
          .sa-menu-panel .sa-menu-actions { grid-template-columns:repeat(2,minmax(0,1fr)) !important; grid-template-rows:none !important; }
          .sa-menu-panel .sa-menu-actions .sa-play { grid-column:span 2 !important; grid-row:auto !important; }
          .sa-menu-panel .sa-menu-actions .sa-btn { min-height:40px !important; }
          .sa-menu-panel .sa-menu-actions .sa-social-btn { min-height:40px !important; }
          .sa-stat small { font-size:8px !important; }
          .sa-stat strong { font-size:15px !important; }
          .sa-mission-head strong { white-space:normal !important; }
          .sa-mission-footer { gap:5px !important; }
          .sa-leaderboard-row { grid-template-columns:34px minmax(0,1fr) auto; gap:6px; }
        }
        @media (orientation:landscape) and (max-height:620px) {
          .sa-overlay > .sa-panel { width:min(520px,calc(100vw - 24px)) !important; }
          .sa-menu-panel .sa-menu-actions { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
          .sa-menu-panel .sa-menu-actions .sa-play { grid-column:span 3 !important; }
        }

        /* v0.20.1: never discard menu information to make a short host frame fit.
           The panel fitter scales the whole card; all league, record, skins and rating
           controls remain in the DOM in portrait, landscape and narrow embeds. */
        .sa-menu-panel .sa-menu-copy,
        .sa-menu-panel .sa-menu-progress,
        .sa-menu-panel .sa-league-card,
        .sa-menu-panel .sa-mission-teaser,
        .sa-menu-panel .sa-stat-row,
        .sa-menu-panel .sa-stat,
        .sa-menu-panel .sa-menu-actions,
        .sa-menu-panel .sa-rating-btn,
        .sa-menu-panel .sa-menu-hero { display:flex !important; }
        .sa-menu-panel .sa-menu-copy,
        .sa-menu-panel .sa-menu-progress { flex-direction:column !important; }
        .sa-menu-panel .sa-league-card { display:grid !important; }
        .sa-menu-panel .sa-stat-row { display:grid !important; }
        .sa-menu-panel .sa-menu-actions { display:grid !important; }
        .sa-menu-panel .sa-mission-teaser { display:flex !important; }
        .sa-menu-panel .sa-menu-hero { align-items:flex-start !important; }
        .sa-menu-panel .sa-menu-emblem { display:block !important; }
        .sa-menu-panel .sa-subtitle,
        .sa-menu-panel .sa-league-kicker { display:block !important; }
        .sa-menu-panel .sa-stat { min-width:0; }
        .sa-menu-panel .sa-stat small,
        .sa-menu-panel .sa-stat strong { white-space:normal !important; overflow:visible !important; text-overflow:clip !important; }
        @media (max-height:650px) {
          .sa-menu-panel .sa-menu-emblem { display:none !important; }
          .sa-menu-panel .sa-menu-actions { grid-template-columns:repeat(3,minmax(0,1fr)) !important; grid-template-rows:auto !important; }
          .sa-menu-panel .sa-menu-actions .sa-play { grid-column:span 3 !important; }
          .sa-menu-panel .sa-menu-actions .sa-btn { min-height:34px !important; }
        }
        @media (max-width:430px) {
          .sa-menu-panel .sa-menu-actions { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
          .sa-menu-panel .sa-menu-actions .sa-play { grid-column:span 2 !important; }
          .sa-menu-panel .sa-stat-row { grid-template-columns:repeat(3,minmax(0,1fr)) !important; }
          .sa-menu-panel .sa-stat { padding:6px !important; }
          .sa-menu-panel .sa-stat small { font-size:7px !important; }
          .sa-menu-panel .sa-stat strong { font-size:13px !important; }
        }


        /* v0.21: language-safe responsive layer.
           Every menu action stays visible. Text wraps instead of being silently clipped;
           the existing panel fitter scales the complete card for very short embeds. */
        #slither-arena-root [data-action],
        #slither-arena-root .sa-btn,
        #slither-arena-root .sa-skin,
        #slither-arena-root .sa-stat,
        #slither-arena-root .sa-mission-card,
        #slither-arena-root .sa-league-card { min-width:0; }
        #slither-arena-root .sa-btn,
        #slither-arena-root .sa-btn > span,
        #slither-arena-root .sa-social-label,
        #slither-arena-root .sa-stat small,
        #slither-arena-root .sa-stat strong,
        #slither-arena-root .sa-league-row span,
        #slither-arena-root .sa-mission-head strong,
        #slither-arena-root .sa-mission-head span,
        #slither-arena-root .sa-mission-card p,
        #slither-arena-root .sa-mission-footer span,
        #slither-arena-root .sa-subtitle,
        #slither-arena-root .sa-skin-name,
        #slither-arena-root .sa-skin-meta,
        #slither-arena-root .sa-skin-meta em {
          min-width:0;
          white-space:normal !important;
          overflow-wrap:anywhere;
          word-break:normal;
          text-overflow:clip !important;
        }
        #slither-arena-root .sa-menu-panel .sa-menu-actions {
          display:grid !important;
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          grid-auto-rows:minmax(40px,auto) !important;
          gap:7px !important;
        }
        #slither-arena-root .sa-menu-panel .sa-menu-actions .sa-play { grid-column:1 / -1 !important; }
        #slither-arena-root .sa-menu-panel .sa-menu-actions .sa-btn {
          display:flex !important;
          align-items:center;
          justify-content:center;
          gap:6px;
          min-height:40px !important;
          padding:8px 9px !important;
          line-height:1.08;
          text-align:center;
        }
        #slither-arena-root .sa-menu-panel .sa-menu-actions .sa-rating-btn svg,
        #slither-arena-root .sa-menu-panel .sa-menu-actions .sa-social-btn svg { flex:0 0 auto; }
        #slither-arena-root .sa-menu-panel .sa-menu-actions .sa-social-label { display:inline !important; }
        #slither-arena-root .sa-menu-panel .sa-stat-row {
          display:grid !important;
          grid-template-columns:repeat(3,minmax(0,1fr)) !important;
          gap:7px !important;
        }
        #slither-arena-root .sa-menu-panel .sa-stat { min-height:48px !important; padding:7px 8px !important; }
        #slither-arena-root .sa-menu-panel .sa-stat small { display:block; min-height:1.1em; font-size:9px !important; line-height:1.05; }
        #slither-arena-root .sa-menu-panel .sa-stat strong { display:block; margin-top:3px; font-size:clamp(13px,2.3vw,17px) !important; line-height:1.02; }
        #slither-arena-root .sa-menu-panel .sa-league-row { align-items:flex-start !important; gap:5px 10px !important; }
        #slither-arena-root .sa-menu-panel .sa-league-row span { line-height:1.1 !important; }
        #slither-arena-root .sa-panel .sa-title { overflow-wrap:anywhere; }
        #slither-arena-root[data-language="tr"] .sa-menu-panel .sa-menu-actions .sa-btn,
        #slither-arena-root[data-language="pt"] .sa-menu-panel .sa-menu-actions .sa-btn { font-size:11px !important; letter-spacing:-.012em; }
        #slither-arena-root[data-language="tr"] .sa-menu-panel .sa-subtitle,
        #slither-arena-root[data-language="pt"] .sa-menu-panel .sa-subtitle { font-size:12px !important; }
        #slither-arena-root .sa-leaderboard-panel .sa-title,
        #slither-arena-root .sa-leaderboard-panel .sa-subtitle,
        #slither-arena-root .sa-leaderboard-empty { overflow-wrap:anywhere; }
        #slither-arena-root .sa-leaderboard-row { min-width:0; }
        #slither-arena-root .sa-leaderboard-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap !important; }

        /* Short landscape embeds keep the complete menu: compact cards plus whole-panel fit,
           not display:none. The static record/skins/league row is always retained. */
        @media (orientation:landscape) and (max-height:620px) {
          #slither-arena-root .sa-overlay > .sa-menu-panel { width:min(500px,calc(100vw - 18px)) !important; padding:12px 14px !important; }
          #slither-arena-root .sa-menu-panel .sa-menu-emblem { display:none !important; }
          #slither-arena-root .sa-menu-panel .sa-menu-hero { display:block !important; }
          #slither-arena-root .sa-menu-panel .sa-brand { margin-bottom:2px !important; font-size:9px !important; }
          #slither-arena-root .sa-menu-panel .sa-title { margin-bottom:3px !important; font-size:clamp(25px,5vw,31px) !important; }
          #slither-arena-root .sa-menu-panel .sa-subtitle { margin:0 !important; font-size:10px !important; line-height:1.22 !important; }
          #slither-arena-root .sa-menu-panel .sa-menu-progress { margin-top:7px !important; gap:6px !important; }
          #slither-arena-root .sa-menu-panel .sa-league-card { padding:8px 9px !important; }
          #slither-arena-root .sa-menu-panel .sa-mission-teaser { margin-top:6px !important; padding:7px 9px !important; }
          #slither-arena-root .sa-menu-panel .sa-stat-row { margin-top:6px !important; }
          #slither-arena-root .sa-menu-panel .sa-stat { min-height:40px !important; padding:6px !important; }
          #slither-arena-root .sa-menu-panel .sa-stat small { font-size:7px !important; }
          #slither-arena-root .sa-menu-panel .sa-stat strong { margin-top:2px !important; font-size:12px !important; }
          #slither-arena-root .sa-menu-panel .sa-menu-actions { margin-top:7px !important; grid-auto-rows:minmax(33px,auto) !important; gap:5px !important; }
          #slither-arena-root .sa-menu-panel .sa-menu-actions .sa-btn { min-height:33px !important; padding:6px 7px !important; font-size:10px !important; }
          #slither-arena-root .sa-menu-panel .sa-menu-actions .sa-social-btn { min-height:33px !important; }
        }
        @media (max-width:360px) {
          #slither-arena-root .sa-overlay > .sa-panel { width:calc(100vw - 14px) !important; padding:12px !important; }
          #slither-arena-root .sa-menu-panel .sa-menu-actions { gap:5px !important; }
          #slither-arena-root .sa-menu-panel .sa-menu-actions .sa-btn { font-size:10px !important; }
          #slither-arena-root .sa-menu-panel .sa-stat { padding:5px !important; }
          #slither-arena-root .sa-menu-panel .sa-stat small { font-size:7px !important; }
        }
        @media (pointer:coarse) and (orientation:portrait) and (min-height:650px) {
          #slither-arena-root .sa-menu-panel .sa-menu-actions { grid-auto-rows:minmax(43px,auto) !important; }
          #slither-arena-root .sa-menu-panel .sa-menu-actions .sa-btn { min-height:43px !important; font-size:12px !important; }
          #slither-arena-root .sa-menu-panel .sa-stat { min-height:54px !important; padding:9px !important; }
          #slither-arena-root .sa-menu-panel .sa-stat small { font-size:10px !important; }
          #slither-arena-root .sa-menu-panel .sa-stat strong { font-size:17px !important; }
        }
        @media (max-width:440px) {
          #slither-arena-root .sa-controls-panel .sa-control-layout { grid-template-columns:1fr !important; }
          #slither-arena-root .sa-controls-panel .sa-control-card { min-height:0 !important; }
          #slither-arena-root .sa-shop-panel .sa-shop-grid { grid-template-columns:1fr !important; }
          #slither-arena-root .sa-gameover-actions .sa-btn { white-space:normal !important; }
        }

        /* v0.22: the v0.20 compact visibility layer keeps every menu statistic as a
           flex item. Give each card an explicit vertical stack. Without flex-direction,
           translated labels and their values sit on the same baseline in English and
           can appear to overlap on narrow embeds. */
        #slither-arena-root .sa-menu-panel .sa-stat {
          display:flex !important;
          flex-direction:column !important;
          align-items:flex-start !important;
          justify-content:flex-start !important;
          gap:3px !important;
          min-width:0 !important;
          height:auto !important;
        }
        #slither-arena-root .sa-menu-panel .sa-stat small,
        #slither-arena-root .sa-menu-panel .sa-stat strong {
          display:block !important;
          flex:0 0 auto !important;
          width:100%;
          min-width:0;
          margin:0 !important;
        }
        #slither-arena-root .sa-menu-panel .sa-stat small {
          line-height:1.08 !important;
        }
        #slither-arena-root .sa-menu-panel .sa-stat strong {
          line-height:1.04 !important;
          font-variant-numeric:tabular-nums;
        }



        /* v0.24: reserve a real, separate lane for the emblem. Long localized titles
           never run under the icon; on compact frames the emblem hides rather than crowding text. */
        #slither-arena-root .sa-menu-panel { width:min(680px,calc(100vw - 28px)) !important; }
        #slither-arena-root .sa-menu-panel .sa-menu-hero {
          display:grid !important;
          grid-template-columns:minmax(0,1fr) 72px !important;
          column-gap:clamp(24px,4vw,38px) !important;
          align-items:start !important;
        }
        #slither-arena-root .sa-menu-panel .sa-menu-copy { min-width:0 !important; }
        #slither-arena-root .sa-menu-panel .sa-menu-copy .sa-title {
          max-width:100% !important;
          overflow-wrap:anywhere !important;
          text-wrap:balance;
        }
        #slither-arena-root .sa-menu-panel .sa-menu-emblem {
          display:block !important;
          justify-self:end !important;
          align-self:start !important;
          flex:none !important;
          width:64px !important;
          height:64px !important;
          min-width:64px !important;
          margin:0 !important;
        }
        @media (max-width:680px) {
          #slither-arena-root .sa-menu-panel .sa-menu-hero { grid-template-columns:minmax(0,1fr) 58px !important; column-gap:17px !important; }
          #slither-arena-root .sa-menu-panel .sa-menu-emblem { width:54px !important; height:54px !important; min-width:54px !important; }
        }
        @media (max-width:560px), (orientation:landscape) and (max-height:620px) {
          #slither-arena-root .sa-menu-panel .sa-menu-hero { display:block !important; }
          #slither-arena-root .sa-menu-panel .sa-menu-emblem { display:none !important; }
        }

        /* v0.30: missions footer is a real two-button row, so Back cannot slide below
           the mission card on VK/OK mobile webviews or short portrait screens. */
        #slither-arena-root .sa-mission-actions {
          position:relative;
          display:grid !important;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:8px;
          margin-top:8px;
        }
        #slither-arena-root .sa-mission-actions .sa-btn {
          margin:0 !important;
          min-height:38px !important;
          padding:8px 10px !important;
          white-space:normal !important;
        }
        #slither-arena-root .sa-missions-phone .sa-mission-actions {
          flex:0 0 auto !important;
          margin-top:6px !important;
        }
        @media (orientation:landscape) and (max-height:620px) {
          #slither-arena-root .sa-mission-actions { gap:6px; margin-top:6px; }
          #slither-arena-root .sa-mission-actions .sa-btn { min-height:32px !important; padding:6px 8px !important; font-size:10px !important; }
        }

        /* v0.32: technical stabilization only. Keep original menu labels/adaptation,
           prevent text selection/long-press callouts, and keep Wardrobe inside the card. */
        #slither-arena-root,
        #slither-arena-root * {
          -webkit-user-select:none !important;
          user-select:none !important;
          -webkit-touch-callout:none !important;
          -webkit-user-drag:none !important;
        }
        #slither-arena-root img,
        #slither-arena-root canvas,
        #slither-arena-root svg { -webkit-user-drag:none !important; user-drag:none !important; }
        #slither-arena-root .sa-overlay > .sa-panel,
        #slither-arena-root .sa-overlay > .sa-menu-panel,
        #slither-arena-root .sa-overlay > .sa-shop-panel,
        #slither-arena-root .sa-overlay > .sa-missions-panel,
        #slither-arena-root .sa-overlay > .sa-controls-panel,
        #slither-arena-root .sa-overlay > .sa-gameover-panel {
          overflow:hidden !important;
        }
        @media (pointer:coarse) and (max-width:700px) {
          #slither-arena-root .sa-shop-panel {
            width:calc(100vw - 16px) !important;
            padding:12px !important;
            overflow:hidden !important;
          }
          #slither-arena-root .sa-shop-panel .sa-brand { display:block !important; margin-bottom:2px !important; font-size:8px !important; }
          #slither-arena-root .sa-shop-panel .sa-title { font-size:clamp(25px,7vw,31px) !important; line-height:1 !important; }
          #slither-arena-root .sa-shop-panel .sa-shop-grid {
            display:grid !important;
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
            grid-template-rows:repeat(2,minmax(132px,1fr)) !important;
            grid-auto-rows:minmax(132px,auto) !important;
            gap:7px !important;
            margin:8px 0 !important;
            align-content:stretch !important;
            min-height:0 !important;
          }
          #slither-arena-root .sa-shop-panel .sa-skin {
            display:flex !important;
            flex-direction:column !important;
            min-height:132px !important;
            height:auto !important;
            padding:6px !important;
            border-radius:15px !important;
            overflow:hidden !important;
            contain:layout paint !important;
          }
          #slither-arena-root .sa-shop-panel .sa-skin-preview-wrap {
            flex:0 0 56px !important;
            height:56px !important;
            min-height:56px !important;
            border-radius:11px !important;
          }
          #slither-arena-root .sa-shop-panel .sa-skin-preview {
            height:56px !important;
            min-height:56px !important;
            max-height:56px !important;
            border-radius:11px !important;
          }
          #slither-arena-root .sa-shop-panel .sa-skin-info { padding:5px 1px 0 !important; overflow:hidden !important; }
          #slither-arena-root .sa-shop-panel .sa-skin-name {
            margin:0 !important;
            font-size:12px !important;
            line-height:1.08 !important;
            white-space:nowrap !important;
            overflow:hidden !important;
            text-overflow:ellipsis !important;
          }
          #slither-arena-root .sa-shop-panel .sa-skin-meta { margin:3px 0 0 !important; font-size:9px !important; line-height:1.12 !important; overflow:hidden !important; }
          #slither-arena-root .sa-shop-panel .sa-skin-meta b { font-size:8px !important; line-height:1.05 !important; white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; }
          #slither-arena-root .sa-shop-panel .sa-skin-meta em { display:block !important; max-height:2.25em !important; overflow:hidden !important; white-space:normal !important; }
          #slither-arena-root .sa-shop-panel .sa-lock-badge { right:6px !important; top:6px !important; width:24px !important; height:24px !important; }
          #slither-arena-root .sa-shop-panel .sa-owned-badge { right:6px !important; top:6px !important; width:23px !important; height:23px !important; }
          #slither-arena-root .sa-shop-panel .sa-shop-nav {
            display:grid !important;
            grid-template-columns:40px minmax(0,1fr) 40px !important;
            gap:7px !important;
            margin:0 !important;
          }
          #slither-arena-root .sa-shop-panel .sa-page-btn { height:36px !important; min-height:36px !important; padding:0 !important; font-size:22px !important; }
          #slither-arena-root .sa-shop-panel .sa-page-label { font-size:11px !important; }
          #slither-arena-root .sa-shop-panel .sa-shop-back { margin-top:7px !important; min-height:36px !important; padding:7px 10px !important; }
        }
        @media (pointer:coarse) and (orientation:landscape) and (max-height:620px) {
          #slither-arena-root .sa-shop-panel .sa-shop-grid {
            grid-template-columns:repeat(2,minmax(0,1fr)) !important;
            grid-template-rows:repeat(1,minmax(118px,auto)) !important;
          }
          #slither-arena-root .sa-shop-panel .sa-skin { min-height:118px !important; }
          #slither-arena-root .sa-shop-panel .sa-skin-preview-wrap,
          #slither-arena-root .sa-shop-panel .sa-skin-preview { height:48px !important; min-height:48px !important; max-height:48px !important; }
        }


        /* v0.33: keep the full "Управление: Тач/Джойстик" row as a normal footer
           inside the menu card. It is outside the action grid, so VK/OK social
           buttons cannot push it through the rounded panel border. */
        #slither-arena-root .sa-menu-panel .sa-menu-control-row {
          display:flex !important;
          align-items:center !important;
          justify-content:center !important;
          width:100% !important;
          min-height:42px !important;
          margin:8px 0 0 !important;
          padding:9px 12px !important;
          border-radius:14px !important;
          line-height:1.08 !important;
          white-space:normal !important;
          overflow:hidden !important;
          text-overflow:clip !important;
        }
        #slither-arena-root .sa-menu-panel { padding-bottom:clamp(14px,3vw,20px) !important; }
        @media (pointer:coarse) and (max-height:700px) {
          #slither-arena-root .sa-menu-panel .sa-menu-control-row {
            min-height:38px !important;
            margin-top:7px !important;
            padding:7px 10px !important;
            font-size:11px !important;
          }
        }


        /* v0.34: keep the Controls button inside the visible menu action grid.
           It shares the last row with the VK/OK subscribe button instead of
           sitting as a footer that can be clipped by VK mobile browser chrome. */
        #slither-arena-root .sa-menu-panel .sa-menu-actions .sa-controls-btn {
          grid-column:auto !important;
          min-height:42px !important;
          margin:0 !important;
          white-space:normal !important;
        }
        #slither-arena-root .sa-menu-panel .sa-menu-control-row {
          display:none !important;
        }
      </style>
      <div class="sa-shell">
        <canvas id="sa-canvas" aria-label="Snake: King of the Arena"></canvas>
        <div id="sa-joystick" class="sa-joystick" aria-hidden="true"><div class="sa-joystick-ring"></div><div class="sa-joystick-knob"></div></div>
        <div class="sa-top">
          <div class="sa-hud-card">
            <span class="sa-hud-label" id="sa-weight-label">Вес</span>
            <div class="sa-score-row"><strong id="sa-score">0</strong><span id="sa-best">Лучший: 0</span></div>
            <span class="sa-rank" id="sa-rank">Подготовка арены</span>
          </div>
          <div class="sa-controls">
            <button class="sa-icon-btn" id="sa-hud-shop" data-action="shop" aria-label="Скины">Скины</button>
            <button class="sa-icon-btn compact sa-pause-btn" id="sa-hud-pause" data-action="pause" aria-label="Меню паузы"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="5" height="5" rx="1.5"></rect><rect x="14" y="5" width="5" height="5" rx="1.5"></rect><rect x="5" y="14" width="5" height="5" rx="1.5"></rect><rect x="14" y="14" width="5" height="5" rx="1.5"></rect></svg></button>
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
    this.root.addEventListener("click", (event) => { void this.handleClick(event); });
    const preventNativeGesture = (event) => {
      event.preventDefault?.();
    };
    for (const type of ["contextmenu", "selectstart", "dragstart"]) {
      this.root.addEventListener(type, preventNativeGesture, { capture: true });
    }
    const preventGameTouch = (event) => {
      if (this.mode !== "game") return;
      if (event.target?.closest?.("[data-action]")) return;
      event.preventDefault?.();
    };
    this.root.addEventListener("touchstart", preventGameTouch, { passive: false, capture: true });
    this.root.addEventListener("touchmove", preventGameTouch, { passive: false, capture: true });
    this.root.addEventListener("gesturestart", preventNativeGesture, { passive: false, capture: true });
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

  fitOverlayPanel(renderPreviews = false) {
    const overlay = this.ui?.overlay;
    const panel = overlay?.querySelector?.(".sa-panel");
    if (!overlay || !panel || !overlay.classList.contains("visible")) return;

    // Measure the unscaled layout. The prior implementation hid overflow inside
    // a fixed-height card, which could cut off tasks in iframes with a short visual viewport.
    panel.style.setProperty("--sa-fit-scale", "1");
    if (renderPreviews) this.renderSkinPreviews();

    const bounds = overlay.getBoundingClientRect();
    const reserve = 20;
    const availableWidth = Math.max(1, bounds.width - reserve);
    const availableHeight = Math.max(1, bounds.height - reserve);
    // scrollHeight captures the full content even where a legacy panel rule used overflow:hidden.
    const rawWidth = Math.max(panel.offsetWidth || 0, panel.scrollWidth || 0, 1);
    const rawHeight = Math.max(panel.offsetHeight || 0, panel.scrollHeight || 0, 1);
    const scale = clamp(Math.min(1, availableWidth / rawWidth, availableHeight / rawHeight), .45, 1);
    panel.style.setProperty("--sa-fit-scale", scale.toFixed(4));
    panel.classList.toggle("sa-auto-fit", scale < .997);
  }

  applyPlatformUi() {
    if (!this.root) return;
    const width = this.root.clientWidth || globalThis.innerWidth || 1;
    const height = this.root.clientHeight || globalThis.innerHeight || 1;
    this.root.dataset.platform = this.bridge.platform;
    this.root.classList.toggle("sa-touch-portrait", this.isTouchInputEnvironment() && height >= width);
    this.root.classList.toggle("sa-touch-landscape", this.isTouchInputEnvironment() && width > height);
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

  t(path, values = {}) {
    return formatI18n(getI18nValue(this.language, path), values);
  }

  setLanguage(language) {
    const next = normalizeLanguageCode(language);
    this.language = SUPPORTED_LANGUAGES.includes(next) ? next : "en";
    if (this.root) {
      this.root.lang = this.language === "pt" ? "pt-BR" : this.language;
      this.root.dataset.language = this.language;
    }
    this.refreshStaticUi();
  }

  refreshStaticUi() {
    if (!this.root) return;
    const weight = this.root.querySelector("#sa-weight-label");
    const shop = this.root.querySelector("#sa-hud-shop");
    const pause = this.root.querySelector("#sa-hud-pause");
    if (weight) weight.textContent = this.t("hud.weight");
    if (shop) { shop.textContent = this.t("hud.skins"); shop.setAttribute("aria-label", this.t("hud.skins")); }
    if (pause) pause.setAttribute("aria-label", this.t("hud.pause"));
    this.syncUi();
  }

  getSkinTitle(skin) {
    return this.t(`skin.${skin?.id ?? "mint"}`);
  }

  getSkinDisplayTitle(skin) {
    return this.bridge.platform === "yandex" && this.getSkinUnlockKind(skin) === "purchase"
      ? (this.bridge.getProductTitle(skin) || this.getSkinTitle(skin))
      : this.getSkinTitle(skin);
  }

  getLeagueName(league) {
    return this.t(league?.nameKey ?? "league.rookie");
  }

  getObjectiveLabel(objective) {
    if (!objective) return "";
    return this.t(`objective.${objective.type}`, { count: objective.goal });
  }

  getLocalizedDeathReason(reason) {
    return this.language === "ru" ? String(reason ?? this.t("gameover.collision")) : this.t("gameover.collision");
  }

  isShortViewport() {
    const height = this.root?.clientHeight ?? globalThis.innerHeight ?? 720;
    const width = this.root?.clientWidth ?? globalThis.innerWidth ?? 1280;
    return height <= 650 || width <= 720;
  }

  getTouchControlMode() {
    return this.progress?.touchControl === "joystick" ? "joystick" : "touch";
  }

  updateControlHint() {
    if (!this.ui?.hint) return;
    if (!this.isTouchInputEnvironment()) {
      this.ui.hint.textContent = this.t("hint.mouse");
      return;
    }
    this.ui.hint.textContent = this.getTouchControlMode() === "joystick"
      ? this.t("hint.joystick")
      : this.t("hint.touch");
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
      name: this.t("you"),
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
    // Record the session start so Playgama gets a real Bridge storage.set event even
    // in an endless arena where there is no traditional "level completed" moment.
    if (this.bridge.isPlaygama) void this.persistProgress();
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
    this.menuAmbientTime += dt;
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

    const saveInterval = this.bridge.isPlaygama ? 12 : 30;
    if (this.saveClock > saveInterval) {
      this.saveClock = 0;
      void this.persistProgress();
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
    // The fullscreen ad is intentionally deferred. It can only be considered after
    // the player sees the result screen and explicitly chooses a next action.
    this.mode = "over";
    this.showGameOver();
  }

  async tryDeferredInterstitial() {
    const due = this.isInterstitialDue() && !this.interstitialPending;
    if (!due) return false;
    this.interstitialPending = true;
    // Pause both simulation and platform lifecycle while the native/fullscreen layer is open.
    // At game-over this is mostly defensive; it also keeps the method safe if a future
    // placement is triggered from an active match.
    const wasRunning = this.running;
    const wasPaused = this.paused;
    const wasMode = this.mode;
    this.pointer.boosting = false;
    this.running = false;
    this.paused = true;
    await this.bridge.pauseChanged(true);
    try {
      const watchdogMs = (this.bridge.platform === "vk" || this.bridge.platform === "ok") ? 14000 : 24000;
      const shown = await Promise.race([
        this.bridge.showInterstitial(),
        new Promise((resolve) => setTimeout(() => resolve(false), watchdogMs))
      ]);
      if (shown) this.playSecondsSinceInterstitial = 0;
      return shown;
    } finally {
      // The next action will normally start a new run or open menu. Restore a live
      // match only when this method is ever called before a result screen exists.
      if (wasRunning && wasMode === "game" && this.mode === "game") {
        this.running = true;
        this.paused = wasPaused;
        await this.bridge.pauseChanged(wasPaused);
      } else {
        this.paused = false;
        await this.bridge.pauseChanged(false);
      }
      this.interstitialPending = false;
    }
  }

  async continueAfterGameOver(destination) {
    if (this.mode !== "over") return;
    if (this.postDeathActionPending) return;
    this.postDeathActionPending = true;
    try {
      // Natural break: the result remains on screen until the player chooses
      // New run or Menu. Buttons are deliberately not disabled: in VK/OK webviews a
      // fullscreen layer can fail to resolve, and a disabled-looking result screen
      // feels broken. The pending flag still prevents double execution.
      try {
        await this.tryDeferredInterstitial();
      } catch (error) {
        console.warn("[SlitherArena] Deferred interstitial did not finish cleanly; continuing with the selected action.", error);
      }
      this.postDeathActionPending = false;
      if (destination === "restart") await this.beginMatch();
      else this.showMenu();
    } catch (error) {
      console.warn("[SlitherArena] Post-game action failed; restoring the result screen.", error);
      this.postDeathActionPending = false;
      this.mode = "over";
      this.showGameOver();
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
      button.textContent = this.t("toast.loadingVideo");
    }
    const rewarded = await this.bridge.showRewarded("revive");
    if (!rewarded) {
      this.toast(this.bridge.lastRewardOutcome === "closed" ? this.t("toast.rewardNotCompleted") : this.t("toast.reviveUnavailable"));
      if (button) {
        button.disabled = false;
        button.textContent = this.t("gameover.revive");
      }
      return;
    }
    const snapshot = this.deathSnapshot;
    this.reviveUsed = true;
    this.toast(this.t("toast.reviveDone"));
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
    this.toast(this.t("toast.goalDone", { reward: challenge.reward }));
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
    this.toast(this.t("toast.taskComplete", { reward: mission.reward }));
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
    this.toast(this.t("toast.allTasks", { streak: this.progress.missionStreak }));
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
    if (newlyUnlocked.length && notify) this.toast(this.t("toast.skinOpen", { name: newlyUnlocked.map((skin) => this.getSkinTitle(skin)).join(", ") }));
    return newlyUnlocked;
  }

  async unlockFreeSkin(skin) {
    if (skin.kind !== "free" || this.progress.unlockedSkins.includes(skin.id)) return;
    this.progress.unlockedSkins.push(skin.id);
    this.progress.selectedSkin = skin.id;
    await this.persistProgress();
    this.toast(this.t("toast.freeOpen", { name: this.getSkinTitle(skin) }));
    this.showShop();
  }

  getSkinUnlockKind(skin) {
    // Playgama has no IAP in this release: every formerly paid skin is an exact rewarded-video unlock.
    return this.bridge.isPlaygama && skin.kind === "purchase" ? "reward" : skin.kind;
  }

  getSkinMeta(skin, owned, selected) {
    if (selected) return { tag: this.t("meta.selected"), text: this.t("meta.selectedText") };
    if (owned) return { tag: this.t("meta.open"), text: this.t("meta.openText") };
    const unlockKind = this.getSkinUnlockKind(skin);
    if (unlockKind === "default" || unlockKind === "free") return { tag: this.t("meta.free"), text: this.t("meta.freeText") };
    if (unlockKind === "reward") {
      // Every reward card grants the skin displayed on that card. This also applies
      // to Playgama, where former purchases are converted into exact video rewards.
      return { tag: this.t("meta.reward"), text: this.t("meta.rewardText") };
    }
    if (unlockKind === "purchase") {
      return { tag: this.t("meta.purchase"), price: this.bridge.getPriceLabel(skin), currency: this.bridge.platform === "yandex" ? "yandex" : this.bridge.platform, currencyCode: this.bridge.getYandexCurrencyCode(skin), skin, text: this.t("meta.purchaseText") };
    }
    if (unlockKind === "score") {
      const current = Math.floor(this.progress.bestMass);
      return { tag: this.t("meta.record", { value: skin.requiredScore }), text: this.t("meta.progress", { current: Math.min(current, skin.requiredScore), goal: skin.requiredScore }) };
    }
    if (unlockKind === "league") {
      const current = this.progress.leagueStars;
      return { tag: this.t("meta.league", { value: skin.requiredStars }), text: this.t("meta.stars", { current: Math.min(current, skin.requiredStars), goal: skin.requiredStars }) };
    }
    if (unlockKind === "streak") {
      const current = this.progress.missionStreak;
      return { tag: this.t("meta.streak", { value: skin.requiredStreak }), text: this.t("meta.streak", { value: `${Math.min(current, skin.requiredStreak)}/${skin.requiredStreak}` }) };
    }
    if (unlockKind === "duel") {
      const current = this.progress.totalKills;
      return { tag: this.t("meta.wins", { value: skin.requiredDuels }), text: this.t("meta.progress", { current: Math.min(current, skin.requiredDuels), goal: skin.requiredDuels }) };
    }
    return { tag: this.t("meta.available"), text: this.t("meta.availableText") };
  }

  formatSkinMetaTag(meta) {
    const tag = this.escapeHtml(meta.tag ?? "");
    if (!meta.price) return tag;
    if (meta.currency === "yandex") {
      const icon = this.bridge.getYandexCurrencyIconUrl?.(meta.skin) || "";
      const rawCode = String(meta.currencyCode || this.bridge.getYandexCurrencyCode?.(meta.skin) || "").trim();
      // Do not draw a fake currency icon. Keep the real currency code
      // returned by the platform, for example RUB, and show the icon only
      // when Yandex SDK returns getPriceCurrencyImage().
      const code = rawCode;
      const codeLabel = code ? `<span class="sa-currency-code">${this.escapeHtml(code)}</span>` : "";
      const iconAlt = code || "ЯН";
      const badge = icon ? `<img class="sa-yan-icon" src="${this.escapeHtml(icon)}" alt="${this.escapeHtml(iconAlt)}" decoding="async">` : "";
      return `${tag} <span class="sa-yandex-currency"><span class="sa-currency-price">${this.escapeHtml(meta.price)}</span>${codeLabel}${badge}</span>`;
    }
    return `${tag} • <span class="sa-currency-price">${this.escapeHtml(meta.price)}</span>`;
  }

  async claimRewardSkin(requestedSkin = null) {
    if (this.rewardSkinBusy) {
      this.toast(this.t("toast.loadingVideo"));
      return;
    }
    const unlocked = new Set(this.progress.unlockedSkins);
    const exactSkin = requestedSkin && !unlocked.has(requestedSkin.id) ? requestedSkin : null;
    const rewards = SKINS.filter((skin) => this.getSkinUnlockKind(skin) === "reward" && !unlocked.has(skin.id));
    if (!exactSkin && !rewards.length) {
      this.toast(this.t("toast.allRewardOpen"));
      return;
    }
    // Store the current page so a native ad return restores the exact same card layout.
    const returnPage = this.shopPage;
    const skin = exactSkin ?? pick(rewards);
    const selector = `[data-action="reward-skin-specific"][data-skin="${skin.id}"]`;
    const button = this.ui.overlay.querySelector(selector);
    const resetButton = () => {
      if (!button) return;
      button.disabled = false;
      button.classList.remove("sa-reward-loading");
      button.removeAttribute("aria-busy");
      delete button.dataset.busyLabel;
    };
    if (button) {
      // Do not replace textContent on the whole card: it removes the preview canvas and
      // makes the snake icon disappear when the rewarded overlay is opened or closed.
      button.disabled = true;
      button.classList.add("sa-reward-loading");
      button.setAttribute("aria-busy", "true");
      button.dataset.busyLabel = this.t("toast.loadingVideo");
    }
    this.rewardSkinBusy = true;
    let rewarded = false;
    try {
      rewarded = await this.bridge.showRewarded(`skin_${skin.id}`);
    } catch (error) {
      console.warn("[SlitherArena] Reward skin flow failed.", error);
      this.bridge.setAdOutcome("rewarded", "failed");
    } finally {
      this.rewardSkinBusy = false;
      this.bridge.rewardAdPromise = null;
    }
    if (!rewarded) {
      resetButton();
      this.toast(this.bridge.lastRewardOutcome === "closed" ? this.t("toast.rewardNotCompleted") : this.t("toast.watchFull"));
      // Native SDK overlays can reset canvas backing stores on iOS/webviews. Render the
      // same page again, restoring every skin preview and its lock/check overlay.
      this.showShop(returnPage);
      return;
    }
    if (!this.progress.unlockedSkins.includes(skin.id)) this.progress.unlockedSkins.push(skin.id);
    this.progress.selectedSkin = skin.id;
    this.progress.rewardClaims += 1;
    await this.persistProgress();
    this.toast(this.t("toast.skinOpen", { name: this.getSkinTitle(skin) }));
    this.showShop(returnPage);
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
      this.toast(this.t("toast.purchaseUnavailable"));
      return;
    }
    this.toast(this.t("toast.openingPurchase"));
    const success = await this.bridge.purchaseSkin(skin.sku);
    if (!success) {
      this.toast(this.t("toast.purchaseFailed"));
      return;
    }
    this.progress.unlockedSkins.push(skin.id);
    this.progress.purchaseSkins.push(skin.id);
    this.progress.selectedSkin = skin.id;
    await this.persistProgress();
    this.toast(this.t("toast.skinOpened", { name: this.getSkinTitle(skin) }));
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
    // Save and rating fields are updated together so the GamePush dashboard does not stay at zero.
    await this.bridge.updateBestMassLeaderboard(this.progress.bestMass);
  }

  showBootShell() {
    this.root?.classList.add("sa-menu-active");
    this.running = false;
    this.mode = "boot";
    this.screen = "boot";
    // Do not render translated menu copy until GamePush/Yandex/VK/OK reports
    // the real platform language. This prevents the visible EN -> RU/TR/PT flicker.
    this.showOverlay(`
      <div class="sa-loading-orb" aria-hidden="true"></div>
    `, "sa-loading-panel sa-loading-minimal");
  }

  showLoadingScreen() {
    this.root?.classList.add("sa-menu-active");
    this.running = false;
    this.mode = "boot";
    this.screen = "boot";
    this.showOverlay(`
      <div class="sa-loading-orb" aria-hidden="true"></div>
      <p class="sa-brand">${this.t("home.title")}</p>
      <h1 class="sa-title">${this.t("loading.title")}</h1>
      <p class="sa-subtitle">${this.t("loading.subtitle")}</p>
    `, "sa-loading-panel");
  }

  getInlineSvg(kind) {
    const icons = {
      invite: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"></circle><path d="M3.8 19c.65-3.05 2.35-4.6 5.2-4.6S13.55 15.95 14.2 19"></path><path d="M17.5 8.2v6.2M14.4 11.3h6.2"></path></svg>',
      community: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.1 5.2h7.5a3.1 3.1 0 0 1 3.1 3.1v10.5H9.2a3.1 3.1 0 0 0-3.1 3.1V8.3a3.1 3.1 0 0 1 3.1-3.1Z"></path><path d="M10.1 12h6.2M13.2 8.9v6.2"></path></svg>',
      yandex: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#ffcc00"></circle><path d="M7.1 6.2h5.7c2.8 0 4.4 1.25 4.4 3.55 0 1.84-1.1 3.06-2.85 3.46l3.1 4.63h-3.15l-2.65-4.24H9.8v4.24H7.1V6.2Zm2.7 2.22v3.02h2.75c1.1 0 1.85-.45 1.85-1.5 0-1.04-.75-1.54-1.85-1.54H9.8Z" fill="#111827"></path></svg>',
      leaderboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20v-7h4v7H5Zm5 0V4h4v16h-4Zm5 0v-10h4v10h-4Z"></path></svg>',
      lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7.8a4 4 0 0 1 8 0V10"></path></svg>',
      check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5"></path></svg>'
    };
    return icons[kind] ?? "";
  }

  showMenu() {
    this.unlockScoreSkins(false);
    this.root?.classList.add("sa-menu-active");
    this.applyPlatformUi();
    this.updateControlHint();
    this.running = false;
    this.mode = "menu";
    this.screen = "menu";
    if (this.bridge.platform === "yandex") {
      setTimeout(() => {
        if (["menu", "shop", "leaderboard", "missions", "controls"].includes(this.mode)) {
          void this.bridge.setBannerVisible(true);
        }
      }, 900);
    } else {
      this.bridge.setBannerVisible(CFG.BANNER_MODE !== "off");
    }
    const daily = this.getDailyChallenge();
    const league = this.getLeagueState();
    const missions = this.getMissionSummary();
    const dailyProgress = Math.min(100, Math.round(this.progress.dailyProgress / daily.goal * 100));
    const leagueProgress = Math.round(league.fraction * 100);
    const controlLabel = this.getTouchControlMode() === "joystick" ? this.t("home.joystick") : this.t("home.touch");
    const mobileControlsButton = this.isTouchInputEnvironment()
      ? `<button class="sa-btn secondary sa-controls-btn" data-action="controls">${this.t("home.controls", { mode: controlLabel })}</button>`
      : "";
    const socialButtons = this.bridge.isSocialPlatform
      ? `<button class="sa-btn secondary sa-social-btn" data-action="invite" aria-label="${this.escapeHtml(this.t("home.invite"))}">${this.getInlineSvg("invite")}<span class="sa-social-label">${this.escapeHtml(this.t("home.invite"))}</span></button>
         <button class="sa-btn secondary sa-social-btn" data-action="community" aria-label="${this.escapeHtml(this.bridge.platform === "vk" ? this.t("home.joinVk") : this.t("home.joinOk"))}">${this.getInlineSvg("community")}<span class="sa-social-label">${this.escapeHtml(this.bridge.platform === "vk" ? this.t("home.joinVk") : this.t("home.joinOk"))}</span></button>`
      : "";
    this.showOverlay(`
      <div class="sa-menu-hero">
        <div class="sa-menu-copy">
          <p class="sa-brand">${this.t("home.brand")}</p>
          <h1 class="sa-title">${this.t("home.title")}</h1>
          <p class="sa-subtitle">${this.t("home.subtitle")}</p>
        </div>
        <div class="sa-menu-emblem" aria-hidden="true"><span></span></div>
      </div>
      <div class="sa-menu-progress">
        <div class="sa-league-card">
          <span class="sa-league-kicker">${this.t("home.daily", { reward: daily.reward })}</span>
          <strong class="sa-league-title">${this.escapeHtml(this.getObjectiveLabel(daily))}</strong>
          <div class="sa-progress-bar"><i style="width:${dailyProgress}%"></i></div>
          <div class="sa-league-row"><span>${this.getDailyProgressText()}${this.progress.dailyClaimed ? ` • ${this.t("home.complete")}` : ""}</span><span>${this.escapeHtml(this.getLeagueName(league))} • ${league.stars} ★</span></div>
          <div class="sa-progress-bar"><i style="width:${leagueProgress}%"></i></div>
        </div>
        <button type="button" class="sa-mission-teaser sa-menu-mission-button" data-action="missions"><div><strong>${this.t("home.missions", { done: missions.completed, total: missions.total })}</strong><span>${this.t("home.missionsHint", { stars: missions.totalStars })}</span></div><div class="sa-mission-mini">${missions.streak}<br>${this.t("home.dayStreak")}</div></button>
      </div>
      <div class="sa-stat-row sa-menu-stats">
        <div class="sa-stat"><small>${this.t("home.record")}</small><strong>${Math.floor(this.progress.bestMass)}</strong></div>
        <div class="sa-stat"><small>${this.t("home.skins")}</small><strong>${this.progress.unlockedSkins.length}/${SKINS.length}</strong></div>
        <div class="sa-stat"><small>${this.t("home.league")}</small><strong>${this.escapeHtml(this.getLeagueName(league))}</strong></div>
      </div>
      <div class="sa-menu-actions">
        <button class="sa-btn sa-play" data-action="play">${this.t("home.play")}</button>
        <button class="sa-btn secondary" data-action="missions">${this.t("home.tasks")}</button>
        <button class="sa-btn secondary" data-action="shop">${this.t("home.wardrobe")}</button>
        ${this.bridge.isGamePushPlatform ? `<button class="sa-btn secondary sa-rating-btn" data-action="leaderboard">${this.getInlineSvg("leaderboard")}<span>${this.t("home.rating")}</span></button>` : ""}
        ${socialButtons}
        ${mobileControlsButton}
      </div>
    `, "sa-menu-panel");
  }

  showGameOver() {
    this.root?.classList.remove("sa-menu-active");
    const snapshot = this.deathSnapshot ?? { mass: 0, reason: this.t("gameover.collision") };
    const canRevive = !this.reviveUsed;
    // Rewarded skins stay in the Wardrobe only; the defeat screen is kept focused on revive and next-run actions.
    const daily = this.getDailyChallenge();
    const league = this.getLeagueState();
    const phone = this.isPhoneLayout();
    const dailyText = this.getObjectiveLabel(daily);
    const compactDaily = `<div class="sa-gameover-daily"><span>${this.t("gameover.daily", { reward: daily.reward })}</span><strong>${this.escapeHtml(dailyText)}</strong><small>${this.getDailyProgressText()}${this.progress.dailyClaimed ? ` • ${this.t("gameover.done")}` : ""}</small></div>`;
    const fullDaily = `<div class="sa-league-card"><span class="sa-league-kicker">${this.t("gameover.daily", { reward: daily.reward })}</span><strong class="sa-league-title">${this.escapeHtml(dailyText)}</strong><div class="sa-league-row"><span>${this.getDailyProgressText()}${this.progress.dailyClaimed ? ` • ${this.t("gameover.done")}` : ""}</span><span>${this.escapeHtml(this.getLeagueName(league))} • ${league.stars} ★</span></div></div>`;
    const reviveButton = canRevive
      ? `<button class="sa-btn video sa-primary" data-action="revive">${this.t("gameover.revive")}</button>`
      : `<button class="sa-btn disabled sa-primary" disabled>${this.t("gameover.reviveSpent")}</button>`;
    const desktopExtras = !phone
      ? `<button class="sa-btn secondary" data-action="missions">${this.t("gameover.tasks")}</button>`
      : "";
    this.showOverlay(`
      <p class="sa-brand">${this.t("gameover.brand")}</p>
      <h1 class="sa-title">${this.t("gameover.title")}</h1>
      <p class="sa-subtitle">${this.escapeHtml(this.t("gameover.summary", { reason: this.getLocalizedDeathReason(snapshot.reason), score: Math.floor(snapshot.mass) }))}</p>
      ${phone ? compactDaily : fullDaily}
      <div class="sa-stat-row sa-gameover-stats">
        <div class="sa-stat"><small>${this.t("gameover.weight")}</small><strong>${Math.floor(snapshot.mass)}</strong></div>
        <div class="sa-stat"><small>${this.t("gameover.record")}</small><strong>${Math.floor(this.progress.bestMass)}</strong></div>
        <div class="sa-stat"><small>${this.t("gameover.place")}</small><strong>${this.getLastRankLabel()}</strong></div>
      </div>
      <div class="sa-gameover-actions">
        ${reviveButton}
        <button class="sa-btn secondary" data-action="restart">${this.t("gameover.newMatch")}</button>
        <button class="sa-btn secondary" data-action="menu">${this.t("gameover.menu")}</button>
        ${desktopExtras}
      </div>
    `, "sa-gameover-panel");
  }

  showMissions(page = 0) {
    this.root?.classList.remove("sa-menu-active");
    this.running = false;
    this.mode = "missions";
    this.bridge.setBannerVisible(CFG.BANNER_MODE !== "off");
    const summary = this.getMissionSummary();
    // Short landscape embeds and phones use one natural-height card, then the entire panel scales.
    const usePager = this.isPhoneLayout() || this.isShortViewport();
    const pageCount = summary.missions.length;
    this.missionPage = clamp(Number(page) || 0, 0, Math.max(0, pageCount - 1));
    const missionsToShow = usePager ? [summary.missions[this.missionPage]] : summary.missions;
    const cards = missionsToShow.map((mission) => {
      const complete = this.progress.missionClaimed.includes(mission.id);
      const current = this.getMissionProgressText(mission);
      const pct = Math.min(100, Math.round(this.getMissionValue(mission) / mission.goal * 100));
      return `<div class="sa-mission-card ${complete ? "complete" : ""}">
        <span class="sa-mission-mark">${complete ? this.getInlineSvg("check") : "✦"}</span>
        <div class="sa-mission-head"><strong>${this.escapeHtml(this.getObjectiveLabel(mission))}</strong><span>+${mission.reward} ★</span></div>
        <p>${complete ? this.t("missions.completed") : this.t("missions.progress", { value: current })}</p>
        <div class="sa-progress-bar"><i style="width:${pct}%"></i></div>
        <div class="sa-mission-footer"><span>${current}</span><span>${complete ? this.t("missions.rewardReceived") : (usePager ? this.t("missions.allRuns") : this.t("missions.anyRun"))}</span></div>
      </div>`;
    }).join("");
    const pager = usePager ? `<div class="sa-mission-pager"><button class="sa-btn secondary" data-action="mission-prev" ${this.missionPage <= 0 ? "disabled" : ""} aria-label="Previous">‹</button><span>${this.t("missions.page", { current: this.missionPage + 1, total: pageCount })}</span><button class="sa-btn secondary" data-action="mission-next" ${this.missionPage >= pageCount - 1 ? "disabled" : ""} aria-label="Next">›</button></div>` : "";
    this.showOverlay(`
      <p class="sa-brand">${this.t("missions.brand")}</p>
      <h1 class="sa-title">${this.t("missions.title")}</h1>
      <p class="sa-subtitle">${this.t("missions.subtitle")}</p>
      <div class="sa-mission-teaser"><div><strong>${this.t("missions.streak", { value: summary.streak })}</strong><span>${this.t("missions.fullSet", { stars: summary.totalStars })}</span></div><div class="sa-mission-mini">${summary.completed}/${summary.total}<br>${this.t("missions.ready")}</div></div>
      <div class="sa-mission-grid">${cards}</div>${pager}
      <div class="sa-mission-actions">
        <button class="sa-btn" data-action="play">${this.t("missions.play")}</button>
        <button class="sa-btn secondary" data-action="missions-back">${this.t("missions.back")}</button>
      </div>
    `, `sa-missions-panel${usePager ? " sa-missions-phone" : ""}`);
  }

  showControls() {
    // The controls screen is a menu-only screen. A delayed touch/click or a slow
    // cloud-save callback must never be able to replace an active match.
    if (this.running || this.mode === "game") return;
    if (!this.isTouchInputEnvironment()) {
      this.showMenu();
      return;
    }
    this.root?.classList.remove("sa-menu-active");
    this.running = false;
    this.mode = "controls";
    this.bridge.setBannerVisible(CFG.BANNER_MODE !== "off");
    const selected = this.getTouchControlMode();
    const card = (mode, title, description) => `
      <button type="button" class="sa-control-card ${selected === mode ? "selected" : ""}" data-action="control-mode" data-control="${mode}">
        <span class="sa-control-check">${selected === mode ? "✓" : ""}</span>
        <span class="sa-control-demo ${mode === "joystick" ? "joystick" : ""}"><i class="sa-demo-snake"></i>${mode === "joystick" ? '<i class="sa-demo-pad"></i>' : '<i class="sa-demo-target"></i>'}<i class="sa-demo-arrow"></i></span>
        <strong>${title}</strong><span>${description}</span>
      </button>`;
    this.showOverlay(`
      <p class="sa-brand">${this.t("controls.brand")}</p>
      <h1 class="sa-title">${this.t("controls.title")}</h1>
      <p class="sa-subtitle">${this.t("controls.subtitle")}</p>
      <p class="sa-control-note">${this.t("controls.note")}</p>
      <div class="sa-control-layout">
        ${card("touch", this.t("controls.touch"), this.t("controls.touchDesc"))}
        ${card("joystick", this.t("controls.joystick"), this.t("controls.joystickDesc"))}
      </div>
      <button class="sa-btn secondary" data-action="controls-back">${this.t("controls.back")}</button>
    `, "sa-controls-panel");
  }

  async setTouchControl(mode) {
    this.progress.touchControl = mode === "joystick" ? "joystick" : "touch";
    this.hideFloatingJoystick();
    this.updateControlHint();

    // Refresh immediately while the player is still on the controls screen.
    // Previously showControls() ran after awaiting cloud persistence; on a slow
    // VK/OK connection it could finish after the player had already started a
    // match and unexpectedly open the controls window over gameplay.
    if (this.mode === "controls" && !this.running) this.showControls();
    await this.persistProgress();
  }

  showShop(page = this.shopPage) {
    this.root?.classList.remove("sa-menu-active");
    this.unlockScoreSkins(false);
    this.running = false;
    this.mode = "shop";
    this.bridge.setBannerVisible(CFG.BANNER_MODE !== "off");
    const allSkins = SKINS;
    const perPage = this.isTinyPhoneLayout() ? 2 : 4;
    const pageCount = Math.max(1, Math.ceil(allSkins.length / perPage));
    const requestedPage = Number(page);
    this.shopPage = clamp(Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 0, 0, pageCount - 1);
    const visible = allSkins.slice(this.shopPage * perPage, this.shopPage * perPage + perPage);
    const cards = visible.map((skin) => {
      const owned = this.progress.unlockedSkins.includes(skin.id);
      const selected = this.progress.selectedSkin === skin.id;
      const meta = this.getSkinMeta(skin, owned, selected);
      const skinTitle = this.getSkinDisplayTitle(skin);
      let action = `data-action="select-skin" data-skin="${skin.id}"`;
      let disabled = "";
      const unlockKind = this.getSkinUnlockKind(skin);
      if (!owned && unlockKind === "free") action = `data-action="free-skin" data-skin="${skin.id}"`;
      else if (!owned && unlockKind === "purchase") action = `data-action="purchase-skin" data-skin="${skin.id}"`;
      else if (!owned && unlockKind === "reward") action = `data-action="reward-skin-specific" data-skin="${skin.id}"`;
      else if (!owned && ["score", "league", "streak", "duel"].includes(skin.kind)) { disabled = "disabled"; action = ""; }
      const statusBadge = owned ? `<span class="sa-owned-badge" aria-hidden="true">${this.getInlineSvg("check")}</span>` : `<span class="sa-lock-badge" aria-label="Locked">${this.getInlineSvg("lock")}</span>`;
      return `
        <button type="button" class="sa-skin ${owned ? "" : "locked"} ${selected ? "selected" : ""}" ${action} ${disabled}>
          <span class="sa-skin-preview-wrap"><canvas class="sa-skin-preview" data-skin-preview="${skin.id}" aria-label="${this.escapeHtml(skinTitle)}"></canvas>${statusBadge}</span>
          <span class="sa-skin-info"><span class="sa-skin-name">${this.escapeHtml(skinTitle)}</span><span class="sa-skin-meta"><b>${this.formatSkinMetaTag(meta)}</b><em>${this.escapeHtml(meta.text)}</em></span></span>
        </button>`;
    }).join("");
    this.showOverlay(`
      <p class="sa-brand">${this.t("shop.brand")}</p>
      <h1 class="sa-title">${this.t("shop.title")}</h1>
      <p class="sa-subtitle">${this.t("shop.subtitle")}</p>
      <div class="sa-shop-grid">${cards}</div>
      <div class="sa-shop-nav">
        <button type="button" class="sa-btn secondary sa-page-btn" data-action="shop-prev" data-page="${this.shopPage - 1}" ${this.shopPage <= 0 ? "disabled" : ""} aria-label="Предыдущая страница">‹</button>
        <span class="sa-page-label">${this.t("shop.page", { current: this.shopPage + 1, total: pageCount })}</span>
        <button type="button" class="sa-btn secondary sa-page-btn" data-action="shop-next" data-page="${this.shopPage + 1}" ${this.shopPage >= pageCount - 1 ? "disabled" : ""} aria-label="Следующая страница">›</button>
      </div>
      <button type="button" class="sa-btn secondary sa-shop-back" data-action="back">${this.t("shop.back")}</button>
    `, "sa-shop-panel");
  }

  makeEmptyLeaderboard() {
    // Never fabricate bot names in the global table. Outside a real GamePush platform
    // the ranking is intentionally empty instead of looking like an online leaderboard.
    return { players: [], current: null, live: false };
  }

  normalizeLeaderboard(result) {
    if (!result) return this.makeEmptyLeaderboard();
    const gp = this.bridge.gp ?? this.bridge.getGamePush?.();
    const myId = String(gp?.player?.id ?? "");
    const combined = [];
    const pushUnique = (items) => {
      for (const item of items || []) {
        const key = String(item?.id ?? item?.name ?? item?.nickname ?? combined.length);
        if (combined.some((other) => String(other?.id ?? other?.name ?? other?.nickname ?? "") === key)) continue;
        combined.push(item);
      }
    };
    pushUnique(Array.isArray(result.topPlayers) ? result.topPlayers : []);
    pushUnique(Array.isArray(result.players) ? result.players : []);
    pushUnique(Array.isArray(result.abovePlayers) ? result.abovePlayers : []);
    if (result.player) pushUnique([result.player]);
    pushUnique(Array.isArray(result.belowPlayers) ? result.belowPlayers : []);

    const extractScore = (player) => Math.floor(Number(
      player?.[PLATFORM_SDK.LEADERBOARD_FIELD]
      ?? player?.fields?.[PLATFORM_SDK.LEADERBOARD_FIELD]
      ?? player?.score
      ?? player?.fields?.score
      ?? player?.[PLATFORM_SDK.BEST_WEIGHT_FIELD]
      ?? player?.fields?.[PLATFORM_SDK.BEST_WEIGHT_FIELD]
      ?? player?.best_weight
      ?? player?.fields?.best_weight
      ?? player?.value
      ?? 0
    ) || 0);

    let players = combined
      .map((player, index) => ({
        id: player.id ?? null,
        position: Number(player.position) || index + 1,
        name: player.name || player.nickname || this.t("leaderboard.player"),
        best_mass: extractScore(player),
        avatar: player.avatar || "",
        me: myId !== "" && String(player.id ?? "") === myId
      }))
      .filter((player) => player.best_mass > 0)
      .sort((a, b) => b.best_mass - a.best_mass)
      .slice(0, PLATFORM_SDK.LEADERBOARD_LIMIT);

    const ownScore = Math.floor(Number(
      gp?.player?.get?.(PLATFORM_SDK.LEADERBOARD_FIELD)
      ?? gp?.player?.score
      ?? gp?.player?.get?.(PLATFORM_SDK.BEST_WEIGHT_FIELD)
      ?? this.progress.bestMass
      ?? 0
    ) || 0);
    const current = Number(result.player?.position ?? result.currentPlayer?.position ?? players.find((player) => player.me)?.position ?? 0) || null;
    if (ownScore > 0 && myId && !players.some((player) => player.me)) {
      players.push({
        id: myId,
        position: current || players.length + 1,
        name: gp?.player?.name || this.t("leaderboard.you"),
        best_mass: ownScore,
        avatar: gp?.player?.avatar || "",
        me: true
      });
      players = players.sort((a, b) => b.best_mass - a.best_mass).slice(0, PLATFORM_SDK.LEADERBOARD_LIMIT);
    }
    return { players, current, live: true };
  }

  renderLeaderboardPanel() {
    const data = this.leaderboardCache;
    const rows = data?.players ?? [];
    const list = this.leaderboardLoading
      ? `<div class="sa-leaderboard-empty">${this.t("leaderboard.loading")}</div>`
      : rows.length
        ? `<div class="sa-leaderboard-list">${rows.map((player, index) => `<div class="sa-leaderboard-row ${player.me ? "me" : ""}"><span class="sa-leaderboard-place">#${player.position || index + 1}</span><span class="sa-leaderboard-name" title="${this.escapeHtml(player.name || this.t("leaderboard.player"))}">${this.escapeHtml(player.name || this.t("leaderboard.player"))}</span><strong>${Math.floor(player.best_mass || 0)}</strong></div>`).join("")}</div>`
        : `<div class="sa-leaderboard-empty">${this.t("leaderboard.unavailable")}</div>`;
    const myPlace = data?.current ? `<p class="sa-leaderboard-me">${this.t("leaderboard.yourPlace", { place: data.current })}</p>` : "";
    this.showOverlay(`
      <p class="sa-brand">${this.t("leaderboard.brand")}</p>
      <h1 class="sa-title">${this.t("leaderboard.title")}</h1>
      <p class="sa-subtitle">${this.t("leaderboard.subtitle")}</p>
      <div class="sa-leaderboard-head"><span>${this.t("leaderboard.record")}</span><span>TOP 10</span></div>
      ${list}
      ${myPlace}
      <button class="sa-btn" data-action="leaderboard-refresh">${this.t("leaderboard.refresh")}</button>
      <button class="sa-btn secondary" data-action="leaderboard-back">${this.t("leaderboard.back")}</button>
    `, "sa-leaderboard-panel");
  }

  async showLeaderboard(refresh = true) {
    this.root?.classList.remove("sa-menu-active");
    this.running = false;
    this.mode = "leaderboard";
    this.bridge.setBannerVisible(CFG.BANNER_MODE !== "off");
    if (!refresh && this.leaderboardCache) {
      this.renderLeaderboardPanel();
      return;
    }
    this.leaderboardLoading = true;
    this.renderLeaderboardPanel();
    let response = null;
    if (this.bridge.isGamePushPlatform) {
      // Make the current player's latest real record visible before reading the top.
      if (this.progress.bestMass > 0) {
        await this.bridge.updateBestMassLeaderboard(this.progress.bestMass);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      response = await this.bridge.fetchBestMassLeaderboard(PLATFORM_SDK.LEADERBOARD_LIMIT);
    }
    this.leaderboardCache = response ? this.normalizeLeaderboard(response) : this.makeEmptyLeaderboard();
    this.leaderboardLoading = false;
    if (this.mode === "leaderboard") this.renderLeaderboardPanel();
  }

  getPauseCopy() {
    const copy = {
      ru: { brand: "Пауза", title: "Игра остановлена", subtitle: "Продолжай, когда будешь готов.", resume: "Продолжить" },
      en: { brand: "Pause", title: "Game paused", subtitle: "Resume whenever you are ready.", resume: "Resume" },
      tr: { brand: "Duraklatıldı", title: "Oyun duraklatıldı", subtitle: "Hazır olduğunda devam et.", resume: "Devam et" },
      pt: { brand: "Pausa", title: "Jogo pausado", subtitle: "Continue quando estiver pronto.", resume: "Continuar" }
    };
    return copy[this.language] ?? copy.en;
  }

  showPause() {
    this.root?.classList.remove("sa-menu-active");
    const copy = this.getPauseCopy();
    this.showOverlay(`
      <p class="sa-brand">${copy.brand}</p>
      <h1 class="sa-title">${copy.title}</h1>
      <p class="sa-subtitle">${copy.subtitle}</p>
      <button class="sa-btn" data-action="resume">${copy.resume}</button>
      <button class="sa-btn secondary" data-action="restart">${this.t("gameover.newMatch")}</button>
      <button class="sa-btn secondary" data-action="menu">${this.t("gameover.menu")}</button>
    `, "sa-pause-panel");
  }

  showOverlay(html, panelClass = "") {
    this.ui.overlay.innerHTML = `<div class="sa-panel ${panelClass}">${html}</div>`;
    this.ui.overlay.classList.add("visible");
    // Let layout settle before measuring. A second frame covers Safari/iframe visual viewport updates.
    requestAnimationFrame(() => {
      this.fitOverlayPanel(true);
      requestAnimationFrame(() => this.fitOverlayPanel(false));
    });
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

  async handleClick(event) {
    const element = event.target.closest?.("[data-action]");
    if (!element || element.disabled) return;
    const action = element.dataset.action;
    const skin = getSkin(element.dataset.skin);
    if (action === "play") { await this.beginMatch(); return; }
    if (action === "restart") {
      if (this.mode === "over") await this.continueAfterGameOver("restart");
      else await this.beginMatch();
      return;
    }
    if (action === "menu") {
      if (this.mode === "over") await this.continueAfterGameOver("menu");
      else this.showMenu();
      return;
    }
    if (action === "missions") this.showMissions(0);
    if (action === "leaderboard") this.showLeaderboard(true);
    if (action === "leaderboard-refresh") this.showLeaderboard(true);
    if (action === "leaderboard-back") this.showMenu();
    if (action === "missions-back") this.showMenu();
    if (action === "mission-prev") this.showMissions(this.missionPage - 1);
    if (action === "mission-next") this.showMissions(this.missionPage + 1);
    if (action === "controls") {
      event.preventDefault?.();
      event.stopPropagation?.();
      if (this.mode === "menu" && !this.running && this.ui.overlay.classList.contains("visible")) this.showControls();
      return;
    }
    if (action === "controls-back") {
      if (this.mode === "controls" && !this.running) this.showMenu();
      return;
    }
    if (action === "control-mode") {
      if (this.mode === "controls" && !this.running) void this.setTouchControl(element.dataset.control);
      return;
    }
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
    if (action === "shop-prev" || action === "shop-next") {
      event.preventDefault?.();
      event.stopPropagation?.();
      const now = performance.now?.() ?? Date.now();
      if (now < this.shopNavLockUntil) return;
      this.shopNavLockUntil = now + 260;
      const targetPage = Number(element.dataset.page);
      this.showShop(Number.isFinite(targetPage) ? targetPage : this.shopPage + (action === "shop-next" ? 1 : -1));
      return;
    }
    if (action === "resume") this.setPaused(false);
    if (action === "revive") this.revive();
    if (action === "reward-skin") this.claimRewardSkin();
    if (action === "reward-skin-specific") this.claimRewardSkin(skin);
    if (action === "free-skin") this.unlockFreeSkin(skin);
    if (action === "purchase-skin") this.purchaseSkin(skin);
    if (action === "select-skin") this.selectSkin(skin);
    if (action === "invite") this.inviteFriends();
    if (action === "community") this.joinCommunity();
  }

  async inviteFriends() {
    const success = await this.bridge.inviteFriends();
    this.toast(success ? this.t("toast.inviteOpen") : this.t("toast.inviteUnavailable"));
  }

  async joinCommunity() {
    const success = await this.bridge.joinCommunity();
    this.toast(success ? this.t("toast.communityOpen") : this.t("toast.communityUnavailable"));
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
    this.ui.best.textContent = this.t("hud.best", { value: Math.floor(this.progress.bestMass) });
    const alive = this.snakes.filter((snake) => snake.alive).sort((a, b) => b.mass - a.mass);
    const rank = Math.max(1, alive.findIndex((snake) => snake.human) + 1);
    this.ui.rank.textContent = this.player?.alive
      ? this.t("hud.rank", { rank, total: alive.length })
      : this.t("hud.result");
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

  createMenuCritters() {
    const palette = [
      ["#6be7d0", "#bfffe7"], ["#b98aff", "#f3c5ff"], ["#74c0fc", "#d7ecff"],
      ["#ffd43b", "#fff0a3"], ["#ff8c8c", "#ffd1d1"], ["#845ef7", "#d8c7ff"]
    ];
    return Array.from({ length: 8 }, (_, index) => {
      const seed = hash32(`menu-critter:${index}`);
      const colors = palette[seed % palette.length];
      return {
        direction: seed & 1 ? 1 : -1,
        lane: .08 + ((seed >>> 3) & 1023) / 1023 * .84,
        phase: ((seed >>> 13) & 1023) / 1023 * 1000,
        speed: 12 + ((seed >>> 23) & 31) * .62,
        sway: 9 + ((seed >>> 17) & 31) * .78,
        radius: 4 + ((seed >>> 27) & 7) * .88,
        segments: 11 + ((seed >>> 8) & 7),
        alpha: .08 + ((seed >>> 20) & 7) * .015,
        depth: (seed >>> 28) & 3,
        primary: colors[0],
        secondary: colors[1]
      };
    }).sort((a, b) => a.depth - b.depth);
  }

  shouldDrawMenuLife() {
    return !this.running && ["boot", "menu", "missions", "controls", "shop", "leaderboard", "over"].includes(this.mode);
  }

  drawMenuLife(width, height, dpr) {
    if (!this.shouldDrawMenuLife()) return;
    const ctx = this.ctx;
    const time = this.menuAmbientTime;
    const trace = (points) => {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const point = points[i];
        const next = points[i + 1];
        ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) * .5, (point.y + next.y) * .5);
      }
      const tail = points.at(-1);
      ctx.lineTo(tail.x, tail.y);
    };
    ctx.save();
    for (const critter of this.menuCritters) {
      const margin = 120 * dpr;
      const travel = width + margin * 2;
      const raw = (time * critter.speed * dpr + critter.phase * dpr) % travel;
      const headX = critter.direction > 0 ? -margin + raw : width + margin - raw;
      const wave = Math.sin(time * .38 + critter.phase * .018) * critter.sway * dpr;
      const headY = height * critter.lane + wave;
      const gap = (critter.radius * 2.35 + 3) * dpr;
      const points = [];
      for (let i = 0; i < critter.segments; i++) {
        const x = headX - critter.direction * i * gap;
        const y = headY + Math.sin(time * .86 + critter.phase * .012 - i * .55) * critter.sway * dpr;
        points.push({ x, y });
      }
      const bodyRadius = critter.radius * dpr;
      ctx.globalAlpha = critter.alpha;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = critter.primary;
      ctx.shadowColor = critter.primary;
      ctx.shadowBlur = bodyRadius * 3.4;
      ctx.lineWidth = bodyRadius * 1.7;
      ctx.beginPath(); trace(points); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = critter.alpha * .82;
      ctx.strokeStyle = critter.secondary;
      ctx.lineWidth = Math.max(1, bodyRadius * .46);
      ctx.setLineDash([Math.max(3, bodyRadius * .8), Math.max(3, bodyRadius * .52)]);
      ctx.lineDashOffset = -time * critter.speed * .45;
      ctx.beginPath(); trace(points); ctx.stroke();
      ctx.setLineDash([]);
      const head = points[0];
      ctx.globalAlpha = critter.alpha * 1.45;
      ctx.fillStyle = critter.secondary;
      ctx.shadowColor = critter.primary;
      ctx.shadowBlur = bodyRadius * 3;
      ctx.beginPath(); ctx.arc(head.x, head.y, bodyRadius * .72, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
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

    // Menu-only background life: lightweight decorative snakes move behind every menu panel.
    // They have no collision, AI, food or state updates, so they do not affect match performance.
    this.drawMenuLife(width, height, dpr);

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
      fallback.textContent = `Snake: King of the Arena startup error:\n${error?.stack ?? error}`;
      fallback.style.cssText = "position:fixed;z-index:2147483647;inset:0;margin:0;padding:16px;background:#111;color:#fff;white-space:pre-wrap";
      document.body.appendChild(fallback);
    });
  });
});
