

const scriptsInEvents = {

	async Game_Event1_Act1(runtime, localVars)
	{
// Пасьянс «Косынка» — JavaScript Event Sheet для Construct 3.
// Версия: мгновенное обновление магазина после успешной покупки без ожидания cloud sync + полные подсказки.
(async () => {
  "use strict";

  if (window.__KOSYNKA_C3_MOUNTED__) return;
  window.__KOSYNKA_C3_MOUNTED__ = true;

  const CONFIG = {
    // This build keeps platform SDKs separate: GamePush for Yandex/VK/OK, Playgama Bridge for Playgama.
    buildTarget: "gamepush",
    gamePushProjectId: 29099,
    gamePushPublicToken: "ktTelyQkakIpNTz1HqxftQtpJWDDe8Bp",
    gamePushCloudField: "solitaire_save",
    gamePushBestScoreField: "solitaire_best_score", // Best score statistic kept in sync with the player profile.
    gamePushLegacyBestScoreField: "score", // Legacy score field kept in sync for compatibility.
    gamePushWinsField: "solitaire_wins", // Main field displayed and sorted in the leaderboard.
    gamePushBestTimeField: "solitaire_best_time",
    leaderboardLimit: 10,
    playgamaStorageKey: "solitaire_save",
    playgamaConfigFile: "playgama-bridge-config.json",
    products: {
      removeAds: "remove_ads",
      royalDeck: "deck_royal",
      noirDeck: "deck_noir",
      rubyDeck: "deck_ruby",
      goldDeck: "deck_gold",
      cosmosDeck: "deck_cosmos"
    },
    interstitialCooldownMs: 180000, // 3 minutes. The timer starts after startup/preloader and is not affected by rewarded ads.
    // Постоянные покупки привязываются только к авторизованному профилю площадки.
    purchaseRequiresAuthenticatedAccount: true,
    // «Убрать рекламу» отключает только принудительную рекламу: sticky + interstitial.
    // Rewarded остаётся добровольной рекламой для подсказок и колод.
    keepRewardedAfterNoAds: true,
    stickyCloseRetryMs: 450,
    hintStartBalance: 5,
    hintRewardAmount: 3,
    hintBalanceCap: 10,
    maxUndo: 80
  };

  const SAVE_KEY = "kosynka_c3_local_v3";
  const PREVIOUS_SAVE_KEY = "kosynka_c3_local_v2";
  const LEGACY_SAVE_KEY = "kosynka_c3_local_v1";
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUITS = [
    { key: "S", symbol: "♠", color: "black" },
    { key: "H", symbol: "♥", color: "red" },
    { key: "D", symbol: "♦", color: "red" },
    { key: "C", symbol: "♣", color: "black" }
  ];


  // Иконки интерфейса — inline SVG, а не emoji. Они выглядят одинаково в Chromium,
  // Safari, Android WebView и iOS, независимо от системного набора эмодзи.
  const UI_ICONS = Object.freeze({
    spade: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M12 2.2C7.7 6.8 4.3 9.2 4.3 12.8a5 5 0 0 0 8 4l-1.4 3.5H7.6v1.7h8.8v-1.7h-3.3l-1.4-3.5a5 5 0 0 0 8-4c0-3.6-3.4-6-8-10.6Z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z" fill="currentColor" stroke="none"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    cards: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4" width="11" height="15" rx="2"/><path d="M5 7v11a2 2 0 0 0 2 2h8M10 8h5M10 12h5"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 12v4M8.5 20h7M10 16h4"/></svg>',
    ranking: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V10M12 19V5M19 19v-7"/><path d="M3.5 20h17"/><circle cx="5" cy="8" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="3.2" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="10.2" r="1.6" fill="currentColor" stroke="none"/></svg>',
    help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M9.8 9.3a2.4 2.4 0 1 1 3.9 1.9c-1 .7-1.7 1.2-1.7 2.6M12 17.1h.01"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.2 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.2 2.2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-3.1v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2.2-2.2.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4.7v-3.1H5a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.2-2.2.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h3.1v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.2 2.2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V14h-.2a1.7 1.7 0 0 0-1.6 1Z"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 5 11l4 4M6 11h8a5 5 0 0 1 5 5v1"/></svg>',
    hint: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16h6M10 20h4M8.4 13.2A5.5 5.5 0 1 1 15.8 13c-.8.7-1.3 1.5-1.5 2.4h-4.6c-.2-.8-.6-1.6-1.3-2.2Z"/></svg>',
    autofinish: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M7 11l5-5 5 5M6 20h12"/></svg>',
    video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3v-4Z"/><path d="m8.7 9.5 3.8 2.5-3.8 2.5v-5Z" fill="currentColor" stroke="none"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8h.01"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>',
    rotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V4l-3 3 3 3V6a7 7 0 1 1-1.4 8.2M17 16v4l3-3-3-3v4a7 7 0 0 1-1.4-8.2"/></svg>',
    noads: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m6.4 6.4 11.2 11.2"/></svg>',
    recycle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 8.5A6.5 6.5 0 0 0 6.6 6.9M6.5 6.9V3.8M6.5 6.9h3.1M6.5 15.5a6.5 6.5 0 0 0 10.9 1.6M17.5 17.1v3.1M17.5 17.1h-3.1"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.2 4.2L19 6.5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8.2a3.5 3.5 0 0 1 7 0v2.3M12 14v2.1"/></svg>'
  });

  function uiIcon(name, extraClass = "") {
    const svg = UI_ICONS[name] || UI_ICONS.info;
    return `<span class="ui-icon${extraClass ? ` ${extraClass}` : ""}" aria-hidden="true">${svg}</span>`;
  }

  // «reward» — за просмотр rewarded-видео, «purchase» — покупка на GamePush-площадках,
  // «achievement» — награда за игровой прогресс. В Playgama purchase-колоды становятся reward.
  const DECKS = {
    classic: { titleKey: "classic", kind: "starter", theme: { tableA: "#0e6a4e", tableB: "#063629", accent: "#f4d374", backA: "#147d5c", backB: "#092e23", frontA: "#ffffff", frontB: "#e9f0ed" } },
    aurora: { titleKey: "aurora", kind: "reward", theme: { tableA: "#0f5670", tableB: "#1e2d64", accent: "#7fe7de", backA: "#1bb4b6", backB: "#39439a", frontA: "#f5ffff", frontB: "#dff2f3" } },
    sakura: { titleKey: "sakura", kind: "reward", theme: { tableA: "#87465e", tableB: "#3c2238", accent: "#ffd2dc", backA: "#ef8eaa", backB: "#7a3c75", frontA: "#fffafd", frontB: "#f9e6ee" } },
    ocean: { titleKey: "ocean", kind: "reward", theme: { tableA: "#0c557a", tableB: "#082941", accent: "#7ce2ff", backA: "#16a5ca", backB: "#07527f", frontA: "#f7fdff", frontB: "#dceff7" } },
    neon: { titleKey: "neon", kind: "reward", theme: { tableA: "#34235a", tableB: "#12172c", accent: "#d0ff65", backA: "#d15ae3", backB: "#4d3dc5", frontA: "#ffffff", frontB: "#e9e5ff" } },
    champion: { titleKey: "champion", kind: "achievement", achievement: "all", theme: { tableA: "#2d6f55", tableB: "#102c22", accent: "#f2dc8a", backA: "#d1a13d", backB: "#3d6c47", frontA: "#fffdf3", frontB: "#eee8cd" } },
    veteran: { titleKey: "veteran", kind: "achievement", achievement: "wins10", theme: { tableA: "#56416e", tableB: "#211b3e", accent: "#b6e1ff", backA: "#5484b6", backB: "#40306f", frontA: "#fbfcff", frontB: "#e7eafb" } },
    royal: { titleKey: "royal", kind: "purchase", product: "royalDeck", theme: { tableA: "#563f79", tableB: "#251b48", accent: "#f0ca78", backA: "#b56d94", backB: "#4b3588", frontA: "#fffdf8", frontB: "#f5ead7" } },
    noir: { titleKey: "noir", kind: "purchase", product: "noirDeck", theme: { tableA: "#434c54", tableB: "#171b22", accent: "#c6d3de", backA: "#303944", backB: "#11151b", frontA: "#ffffff", frontB: "#e8edf1" } },
    ruby: { titleKey: "ruby", kind: "purchase", product: "rubyDeck", theme: { tableA: "#7a2634", tableB: "#350f18", accent: "#ffcf6b", backA: "#de4f61", backB: "#8a213f", frontA: "#fffafa", frontB: "#f8e4e4" } },
    gold: { titleKey: "gold", kind: "purchase", product: "goldDeck", theme: { tableA: "#806520", tableB: "#3b2d0c", accent: "#fff0a5", backA: "#d9a22d", backB: "#875a10", frontA: "#fffdf5", frontB: "#f5e9be" } },
    cosmos: { titleKey: "cosmos", kind: "purchase", product: "cosmosDeck", theme: { tableA: "#1c356f", tableB: "#121231", accent: "#9ebfff", backA: "#563ec8", backB: "#141a64", frontA: "#f9fbff", frontB: "#e1e6ff" } }
  };

  const SUPPORTED_LOCALES = new Set(["ru", "en", "pt", "tr"]);
  const I18N = Object.freeze({
    ru: {
      brand:"Косынка", subtitle:"Классический пасьянс", score:"Счёт", moves:"Ходы", time:"Время", menu:"Меню", openMenu:"Открыть меню", undo:"Отменить", undoMove:"Отменить ход", hint:"Подсказка", autoFinish:"Автосбор", rotateTitle:"Поверните телефон вертикально", rotateText:"Косынка на телефоне играет только в портретном режиме.",
      sourceCard:"карта", sourceWaste:"верхняя карта из сброса", sourceFoundation:"верхняя карта базы", column:"колонка {column}", targetCard:"{card} в колонке {column}", targetEmpty:"пустую колонку {column}", card:"карту", moveDone:"Ход выполнен", movedFoundation:"Карта перенесена на базу", stockRecycled:"Колода собрана заново", noUndo:"Пока нечего отменять", undoDone:"Последний ход отменён", newGameStarted:"Новая партия началась", gameContinued:"Игра продолжена",
      hintFlip:"Откройте верхнюю карту в колонке {column}.", hintBest:"Лучший ход: перенесите {cards} на {target} — откроется закрытая карта.", hintSequence:"Соедините последовательность: перенесите {cards} на {target}.", hintFoundationReveal:"Перенесите {card} на базу — откроется закрытая карта.", hintFoundationSafeWaste:"Безопасно перенесите {card} из сброса на базу — освободится следующая карта.", hintFoundationSafe:"Безопасно перенесите {card} на базу.", hintFoundationRisk:"Ход возможен: перенесите {card} на базу. Лучше сначала проверьте другие варианты.", hintWasteFree:"Перенесите {card} из сброса на {target} — освободится следующая карта.", hintWaste:"Перенесите {card} из сброса на {target}.", hintStockMove:"Откройте следующую карту в колоде — появится доступный ход.", hintStock:"Откройте следующую карту в колоде: на столе сейчас нет более полезного хода.", hintRecycle:"Соберите сброс и продолжайте поиск хода.", hintFoundationBack:"Запасной вариант: верните {card} с базы на {target}.", hintNone:"Подходящего хода не найдено. Попробуйте открыть карту из колоды.",
      hintsTitle:"Подсказки", hintsCap:"У вас уже максимальный запас: <b>{cap}</b>. Используйте подсказку в партии, затем сможете пополнить запас.", hintsAvailable:"Доступно <b>{balance}</b> из {cap}. Подсказки сохраняются между партиями и устройствами.", hintsEmpty:"Бесплатные подсказки закончились. Посмотрите короткую рекламу и получите <b>+{amount}</b> подсказки.", hintsInfo:"Подсказка не выполняет ход за игрока: она только показывает самый полезный следующий шаг.", watchAdPlus:"Смотреть видео-рекламу — +{amount}", backToGame:"Вернуться к игре", notNow:"Не сейчас", hintsEnough:"Подсказок уже достаточно", openingAd:"Открываем рекламу…", adNoReward:"Реклама не досмотрена — награда не получена", hintsReceived:"Получено подсказок: +{amount}",
      autoNoneOpen:"Для автосбора пока нет доступных карт.", autoNoneClosed:"Автосбор переносит только безопасные карты — сначала открывайте рубашки.",
      wins:"<b>{count}</b> побед", streak:"<b>{count}</b> подряд", record:"Рекорд: <b>{count}</b>", bestTime:"Лучшее время: <b>{time}</b>", hintsStat:"Подсказки: <b>{count}</b>", menuIntro:"Классический пасьянс. Соберите все карты по мастям от туза до короля.", continueGame:"Продолжить игру", startGame:"Начать игру", newGame:"Новая игра", store:"Магазин", achievements:"Достижения", leaderboard:"Рейтинг", leaderboardInfo:"Топ-10 по общему количеству побед", leaderboardWins:"Победы", leaderboardUnavailable:"Рейтинг пока недоступен", howTo:"Как играть", settings:"Настройки", backMenu:"Назад в меню", inMenu:"В меню", achievementsOpen:"Открыто: <b>{count}</b> из {total}.",
      achFirstTitle:"Первый пасьянс", achFirstDesc:"Одержите первую победу.", achFiveTitle:"Мастер Косынки", achFiveDesc:"Выиграйте 5 партий.", achTenTitle:"За столом", achTenDesc:"Сыграйте 10 партий.", achStreakTitle:"На подъёме", achStreakDesc:"Выиграйте 3 партии подряд.", achFastTitle:"Быстрые руки", achFastDesc:"Выиграйте за 5 минут или быстрее.",
      deckClassic:"Классика", deckAurora:"Северное сияние", deckSakura:"Сакура", deckOcean:"Океан", deckNeon:"Неон", deckChampion:"Лавровый стол", deckVeteran:"Ветеран", deckRoyal:"Королевская ночь", deckNoir:"Нуар", deckRuby:"Рубин", deckGold:"Золотая масть", deckCosmos:"Космос", deckStarter:"Базовая колода", deckPremium:"Премиум-колода", deckUnlocked:"Открыто", deckSelected:"Выбрано", deckChoose:"Выбрать", deckWatchAd:"Смотреть видео-рекламу", deckWatchAdHint:"Откройте за видео-рекламу", deckAchievementAll:"Откройте все 5 достижений", deckAchievementWins10:"Выиграйте 10 партий", deckEarned:"Награда за достижение", storeVideo:"За видео", storeAchievements:"За достижения", storePurchases:"Покупки", noAds:"Без рекламы", noAdsDesc:"Убрать рекламу", bought:"Куплено", buy:"Купить", deckOpened:"Открыта тема «{title}»", deckBought:"Тема «{title}» куплена", achievementDeckOpened:"Открыта тема за достижение: <b>{names}</b>", rewardNotReceived:"Награда не получена", purchaseFailed:"Покупка не завершена", adsDisabled:"Баннер и полноэкранная реклама отключены. Видео за награды остаётся доступным.", purchaseUnavailable:"Покупки станут доступны после настройки товаров на площадке.", purchaseLoginTitle:"Войдите для покупки", purchaseLoginCopy:"Покупка привязывается к аккаунту площадки. Войдите через безопасное окно площадки — игра не запрашивает почту или платёжные данные.", purchaseLoginRestore:"После входа постоянные покупки восстановятся на этом аккаунте.", purchaseLoginAction:"Войти и продолжить", purchaseLoginCancel:"Не сейчас", purchaseLoginSuccess:"Вход выполнен. Открываем оплату…", purchaseLoginCancelled:"Вход не выполнен. Покупка отменена.", purchaseLoginUnavailable:"Вход на площадке сейчас недоступен. Попробуйте ещё раз позже.",
      howTitle:"Как играть", how1:"Перетаскивайте карты в колонках по убыванию, чередуя красные и чёрные масти.", how2:"На пустое место можно положить только короля.", how3:"Тузы и следующие карты собираются сверху справа по мастям.", how4:"Нажмите на карту, затем на место назначения — это работает и без перетаскивания.", how5:"Подсказка сначала ищет ход, который откроет закрытую карту, и не спешит убирать полезные карты на базу. В начале доступно 5 подсказок; после этого запас пополняется за добровольный просмотр рекламы.", understood:"Понятно", settingsTitle:"Настройки", drawNew:"Сдача в новых партиях", drawInfo:"Выбрано: {preferred}. Текущая партия остаётся с раздачей {running}. В режиме по три карты сброс показывается веером.", drawOne:"по одной карте", drawThree:"по три карты", change:"Сменить", saving:"Сохранение", autosave:"Игра сохраняется автоматически", nextDraw:"В следующих партиях: {draw}",
      endTitle:"Закончить партию?", endCopy:"Текущая раскладка будет закрыта. Начать её заново уже не получится.", end:"Закончить", winTitle:"Победа!", lostTitle:"Партия завершена", winCopy:"Все карты собраны. Счёт: <b>{score}</b>, время: <b>{time}</b>.", lostCopy:"Эта раскладка закрыта. Можно начать новую партию.", achievementOpened:"Открыто достижение: <b>{names}</b>", newRound:"Новая партия", close:"Закрыть", faceDown:"Закрытая карта", wasteTop:"Сброс, верхняя карта доступна", hintRemaining:"Подсказка, осталось {count}", hintsDepleted:"Подсказки закончились: посмотреть рекламу", hintsRemainTitle:"Осталось подсказок: {count}", hintsEmptyTitle:"Подсказки закончились. Реклама даст +{amount}.", drawOneAria:"Сдать одну карту", drawThreeAria:"Сдать три карты", recycleAria:"Собрать колоду", testConfirm:"Тестовый режим: {label}?"
    },
    en: {
      brand:"Klondike", subtitle:"Classic solitaire", score:"Score", moves:"Moves", time:"Time", menu:"Menu", openMenu:"Open menu", undo:"Undo", undoMove:"Undo move", hint:"Hint", autoFinish:"Auto-finish", rotateTitle:"Turn your phone upright", rotateText:"Klondike is played in portrait mode on phones.",
      sourceCard:"card", sourceWaste:"top waste card", sourceFoundation:"top foundation card", column:"column {column}", targetCard:"{card} in column {column}", targetEmpty:"empty column {column}", card:"card", moveDone:"Move completed", movedFoundation:"Card moved to the foundation", stockRecycled:"Stock recycled", noUndo:"Nothing to undo yet", undoDone:"Last move undone", newGameStarted:"New game started", gameContinued:"Game resumed",
      hintFlip:"Turn over the top card in column {column}.", hintBest:"Best move: move {cards} to {target} — it will reveal a face-down card.", hintSequence:"Build a sequence: move {cards} to {target}.", hintFoundationReveal:"Move {card} to the foundation — it will reveal a face-down card.", hintFoundationSafeWaste:"Safely move {card} from the waste to the foundation — the next card will be freed.", hintFoundationSafe:"Safely move {card} to the foundation.", hintFoundationRisk:"This move is possible: move {card} to the foundation. Check other options first.", hintWasteFree:"Move {card} from the waste to {target} — the next card will be freed.", hintWaste:"Move {card} from the waste to {target}.", hintStockMove:"Draw the next stock card — a move will become available.", hintStock:"Draw the next stock card: there is no more useful move on the table now.", hintRecycle:"Recycle the waste and keep looking for a move.", hintFoundationBack:"Fallback: move {card} back from the foundation to {target}.", hintNone:"No useful move found. Try drawing a card from the stock.",
      hintsTitle:"Hints", hintsCap:"You already have the maximum: <b>{cap}</b>. Use a hint in a game, then you can refill the balance.", hintsAvailable:"You have <b>{balance}</b> of {cap}. Hints are saved between games and devices.", hintsEmpty:"Free hints are over. Watch a short ad to get <b>+{amount}</b> hints.", hintsInfo:"A hint never makes a move for you: it only highlights the most useful next step.", watchAdPlus:"Watch video ad — +{amount}", backToGame:"Back to game", notNow:"Not now", hintsEnough:"You already have enough hints", openingAd:"Opening ad…", adNoReward:"The ad was not completed — no reward received", hintsReceived:"Hints received: +{amount}",
      autoNoneOpen:"There are no cards available for auto-finish yet.", autoNoneClosed:"Auto-finish moves only safe cards — reveal face-down cards first.",
      wins:"<b>{count}</b> wins", streak:"<b>{count}</b> streak", record:"Record: <b>{count}</b>", bestTime:"Best time: <b>{time}</b>", hintsStat:"Hints: <b>{count}</b>", menuIntro:"Classic solitaire. Build every suit from Ace through King.", continueGame:"Continue game", startGame:"Start game", newGame:"New game", store:"Store", achievements:"Achievements", leaderboard:"Leaderboard", leaderboardInfo:"Top 10 by total wins", leaderboardWins:"Wins", leaderboardUnavailable:"Leaderboard is not available right now", howTo:"How to play", settings:"Settings", backMenu:"Back to menu", inMenu:"Menu", achievementsOpen:"Unlocked: <b>{count}</b> of {total}.",
      achFirstTitle:"First solitaire", achFirstDesc:"Win your first game.", achFiveTitle:"Klondike master", achFiveDesc:"Win 5 games.", achTenTitle:"At the table", achTenDesc:"Play 10 games.", achStreakTitle:"On a roll", achStreakDesc:"Win 3 games in a row.", achFastTitle:"Quick hands", achFastDesc:"Win in 5 minutes or less.",
      deckClassic:"Classic", deckAurora:"Northern Lights", deckSakura:"Sakura", deckOcean:"Ocean", deckNeon:"Neon", deckChampion:"Laurel Table", deckVeteran:"Veteran", deckRoyal:"Royal Night", deckNoir:"Noir", deckRuby:"Ruby", deckGold:"Golden Suit", deckCosmos:"Cosmos", deckStarter:"Starter deck", deckPremium:"Premium deck", deckUnlocked:"Unlocked", deckSelected:"Selected", deckChoose:"Select", deckWatchAd:"Watch video ad", deckWatchAdHint:"Unlock by watching a video ad", deckAchievementAll:"Unlock all 5 achievements", deckAchievementWins10:"Win 10 games", deckEarned:"Achievement reward", storeVideo:"Videos", storeAchievements:"Achievements", storePurchases:"Purchases", noAds:"No ads", noAdsDesc:"Remove ads", bought:"Purchased", buy:"Buy", deckOpened:"Theme “{title}” unlocked", deckBought:"Theme “{title}” purchased", achievementDeckOpened:"Achievement theme unlocked: <b>{names}</b>", rewardNotReceived:"Reward not received", purchaseFailed:"Purchase was not completed", adsDisabled:"Banner and full-screen ads are disabled. Rewarded videos remain available.", purchaseUnavailable:"Purchases will be available after the products are configured on the platform.", purchaseLoginTitle:"Sign in to purchase", purchaseLoginCopy:"Purchases are tied to your platform account. Sign in through the secure platform window — the game never asks for your email or payment details.", purchaseLoginRestore:"Your permanent purchases will be restored on this account after sign-in.", purchaseLoginAction:"Sign in and continue", purchaseLoginCancel:"Not now", purchaseLoginSuccess:"Signed in. Opening payment…", purchaseLoginCancelled:"Sign-in was not completed. Purchase cancelled.", purchaseLoginUnavailable:"Sign-in is not available on the platform right now. Please try again later.",
      howTitle:"How to play", how1:"Build down in the tableau, alternating red and black cards.", how2:"Only a King can be placed in an empty column.", how3:"Build each foundation at the top right by suit, starting with an Ace.", how4:"Tap a card, then tap its destination — this also works without dragging.", how5:"Hints first look for moves that reveal face-down cards and avoid rushing useful cards to the foundation. You start with 5 hints; later, refill them by watching a voluntary ad.", understood:"Got it", settingsTitle:"Settings", drawNew:"Draw in new games", drawInfo:"Selected: {preferred}. The current game keeps {running}. In Draw 3, the waste is shown as a fan.", drawOne:"Draw 1", drawThree:"Draw 3", change:"Change", saving:"Save", autosave:"The game saves automatically", nextDraw:"New games will use: {draw}",
      endTitle:"End this game?", endCopy:"This layout will be closed and cannot be restarted.", end:"End game", winTitle:"You win!", lostTitle:"Game ended", winCopy:"All cards are collected. Score: <b>{score}</b>, time: <b>{time}</b>.", lostCopy:"This layout is closed. You can start a new game.", achievementOpened:"Achievement unlocked: <b>{names}</b>", newRound:"New game", close:"Close", faceDown:"Face-down card", wasteTop:"Waste, top card available", hintRemaining:"Hint, {count} remaining", hintsDepleted:"Hints are depleted: watch an ad", hintsRemainTitle:"Hints remaining: {count}", hintsEmptyTitle:"Hints are depleted. An ad gives +{amount}.", drawOneAria:"Draw one card", drawThreeAria:"Draw three cards", recycleAria:"Recycle stock", testConfirm:"Test mode: {label}?"
    },
    pt: {
      brand:"Paciência", subtitle:"Paciência clássica", score:"Pontos", moves:"Jogadas", time:"Tempo", menu:"Menu", openMenu:"Abrir menu", undo:"Desfazer", undoMove:"Desfazer jogada", hint:"Dica", autoFinish:"Autojuntar", rotateTitle:"Gire o telefone para a vertical", rotateText:"A Paciência é jogada no modo retrato em telefones.",
      sourceCard:"carta", sourceWaste:"carta do descarte", sourceFoundation:"carta do monte final", column:"coluna {column}", targetCard:"{card} na coluna {column}", targetEmpty:"coluna vazia {column}", card:"carta", moveDone:"Jogada concluída", movedFoundation:"Carta movida para o monte final", stockRecycled:"Baralho reciclado", noUndo:"Ainda não há nada para desfazer", undoDone:"Última jogada desfeita", newGameStarted:"Nova partida iniciada", gameContinued:"Partida retomada",
      hintFlip:"Vire a carta do topo da coluna {column}.", hintBest:"Melhor jogada: mova {cards} para {target} — uma carta fechada será revelada.", hintSequence:"Monte uma sequência: mova {cards} para {target}.", hintFoundationReveal:"Mova {card} para o monte final — uma carta fechada será revelada.", hintFoundationSafeWaste:"Mova {card} do descarte para o monte final com segurança — a próxima carta será liberada.", hintFoundationSafe:"Mova {card} para o monte final com segurança.", hintFoundationRisk:"A jogada é possível: mova {card} para o monte final. Confira outras opções antes.", hintWasteFree:"Mova {card} do descarte para {target} — a próxima carta será liberada.", hintWaste:"Mova {card} do descarte para {target}.", hintStockMove:"Compre a próxima carta — uma jogada ficará disponível.", hintStock:"Compre a próxima carta: não há uma jogada mais útil na mesa agora.", hintRecycle:"Recicle o descarte e continue procurando uma jogada.", hintFoundationBack:"Alternativa: devolva {card} do monte final para {target}.", hintNone:"Nenhuma jogada útil encontrada. Tente comprar uma carta.",
      hintsTitle:"Dicas", hintsCap:"Você já tem o máximo: <b>{cap}</b>. Use uma dica em uma partida e depois poderá recarregar.", hintsAvailable:"Você tem <b>{balance}</b> de {cap}. As dicas são salvas entre partidas e dispositivos.", hintsEmpty:"As dicas grátis acabaram. Assista a um anúncio curto e ganhe <b>+{amount}</b> dicas.", hintsInfo:"A dica não faz a jogada por você: ela só destaca o próximo passo mais útil.", watchAdPlus:"Assistir anúncio em vídeo — +{amount}", backToGame:"Voltar ao jogo", notNow:"Agora não", hintsEnough:"Você já tem dicas suficientes", openingAd:"Abrindo anúncio…", adNoReward:"O anúncio não foi concluído — nenhuma recompensa recebida", hintsReceived:"Dicas recebidas: +{amount}",
      autoNoneOpen:"Ainda não há cartas disponíveis para a coleta automática.", autoNoneClosed:"A coleta automática move apenas cartas seguras — revele as cartas fechadas primeiro.",
      wins:"<b>{count}</b> vitórias", streak:"<b>{count}</b> seguidas", record:"Recorde: <b>{count}</b>", bestTime:"Melhor tempo: <b>{time}</b>", hintsStat:"Dicas: <b>{count}</b>", menuIntro:"Paciência clássica. Monte todos os naipes do Ás ao Rei.", continueGame:"Continuar jogo", startGame:"Iniciar jogo", newGame:"Novo jogo", store:"Loja", achievements:"Conquistas", leaderboard:"Classificação", leaderboardInfo:"Top 10 por total de vitórias", leaderboardWins:"Vitórias", leaderboardUnavailable:"A classificação não está disponível agora", howTo:"Como jogar", settings:"Configurações", backMenu:"Voltar ao menu", inMenu:"Menu", achievementsOpen:"Desbloqueado: <b>{count}</b> de {total}.",
      achFirstTitle:"Primeira paciência", achFirstDesc:"Vença sua primeira partida.", achFiveTitle:"Mestre da Paciência", achFiveDesc:"Vença 5 partidas.", achTenTitle:"À mesa", achTenDesc:"Jogue 10 partidas.", achStreakTitle:"Em alta", achStreakDesc:"Vença 3 partidas seguidas.", achFastTitle:"Mãos rápidas", achFastDesc:"Vença em 5 minutos ou menos.",
      deckClassic:"Clássico", deckAurora:"Aurora Boreal", deckSakura:"Sakura", deckOcean:"Oceano", deckNeon:"Neon", deckChampion:"Mesa de Louros", deckVeteran:"Veterano", deckRoyal:"Noite Real", deckNoir:"Noir", deckRuby:"Rubi", deckGold:"Naipe Dourado", deckCosmos:"Cosmos", deckStarter:"Baralho inicial", deckPremium:"Baralho premium", deckUnlocked:"Desbloqueado", deckSelected:"Selecionado", deckChoose:"Selecionar", deckWatchAd:"Assistir anúncio em vídeo", deckWatchAdHint:"Desbloqueie assistindo a um anúncio em vídeo", deckAchievementAll:"Desbloqueie as 5 conquistas", deckAchievementWins10:"Vença 10 partidas", deckEarned:"Recompensa de conquista", storeVideo:"Vídeos", storeAchievements:"Conquistas", storePurchases:"Compras", noAds:"Sem anúncios", noAdsDesc:"Remover anúncios", bought:"Comprado", buy:"Comprar", deckOpened:"Tema “{title}” desbloqueado", deckBought:"Tema “{title}” comprado", achievementDeckOpened:"Tema de conquista desbloqueado: <b>{names}</b>", rewardNotReceived:"Recompensa não recebida", purchaseFailed:"Compra não concluída", adsDisabled:"O banner e os anúncios em tela cheia foram desativados. Vídeos com recompensa continuam disponíveis.", purchaseUnavailable:"As compras ficarão disponíveis após configurar os produtos na plataforma.", purchaseLoginTitle:"Entre para comprar", purchaseLoginCopy:"As compras ficam vinculadas à sua conta da plataforma. Entre pela janela segura da plataforma — o jogo nunca pede seu e-mail ou dados de pagamento.", purchaseLoginRestore:"Suas compras permanentes serão restauradas nesta conta após o login.", purchaseLoginAction:"Entrar e continuar", purchaseLoginCancel:"Agora não", purchaseLoginSuccess:"Login concluído. Abrindo pagamento…", purchaseLoginCancelled:"O login não foi concluído. Compra cancelada.", purchaseLoginUnavailable:"O login não está disponível na plataforma agora. Tente novamente mais tarde.",
      howTitle:"Como jogar", how1:"Monte em ordem decrescente no tableau, alternando cartas vermelhas e pretas.", how2:"Apenas um Rei pode ser colocado em uma coluna vazia.", how3:"Monte cada naipe no topo direito, começando pelo Ás.", how4:"Toque em uma carta e depois no destino — também funciona sem arrastar.", how5:"As dicas procuram primeiro jogadas que revelam cartas fechadas e evitam levar cartas úteis depressa demais ao monte final. Você começa com 5 dicas; depois, reponha vendo um anúncio voluntário.", understood:"Entendi", settingsTitle:"Configurações", drawNew:"Compra em novas partidas", drawInfo:"Selecionado: {preferred}. A partida atual mantém {running}. Em Compra 3, o descarte aparece em leque.", drawOne:"Comprar 1", drawThree:"Comprar 3", change:"Alterar", saving:"Salvamento", autosave:"O jogo é salvo automaticamente", nextDraw:"As próximas partidas usarão: {draw}",
      endTitle:"Encerrar esta partida?", endCopy:"Esta distribuição será fechada e não poderá ser reiniciada.", end:"Encerrar", winTitle:"Você venceu!", lostTitle:"Partida encerrada", winCopy:"Todas as cartas foram reunidas. Pontos: <b>{score}</b>, tempo: <b>{time}</b>.", lostCopy:"Esta distribuição foi fechada. Você pode iniciar uma nova partida.", achievementOpened:"Conquista desbloqueada: <b>{names}</b>", newRound:"Nova partida", close:"Fechar", faceDown:"Carta fechada", wasteTop:"Descarte, carta do topo disponível", hintRemaining:"Dica, restam {count}", hintsDepleted:"Dicas esgotadas: ver anúncio", hintsRemainTitle:"Dicas restantes: {count}", hintsEmptyTitle:"As dicas acabaram. Um anúncio dá +{amount}.", drawOneAria:"Comprar uma carta", drawThreeAria:"Comprar três cartas", recycleAria:"Reciclar baralho", testConfirm:"Modo de teste: {label}?"
    },
    tr: {
      brand:"Klondike", subtitle:"Klasik solitaire", score:"Puan", moves:"Hamleler", time:"Süre", menu:"Menü", openMenu:"Menüyü aç", undo:"Geri al", undoMove:"Hamleyi geri al", hint:"İpucu", autoFinish:"Oto Topla", rotateTitle:"Telefonu dikey çevirin", rotateText:"Klondike telefonlarda yalnızca dikey modda oynanır.",
      sourceCard:"kart", sourceWaste:"atık destesinin üst kartı", sourceFoundation:"temel destesinin üst kartı", column:"{column}. sütun", targetCard:"{column}. sütundaki {card}", targetEmpty:"{column}. boş sütun", card:"kart", moveDone:"Hamle tamamlandı", movedFoundation:"Kart temele taşındı", stockRecycled:"Deste yeniden toplandı", noUndo:"Geri alınacak hamle yok", undoDone:"Son hamle geri alındı", newGameStarted:"Yeni oyun başladı", gameContinued:"Oyun sürdürüldü",
      hintFlip:"{column}. sütundaki üst kartı açın.", hintBest:"En iyi hamle: {cards} destesini {target} üzerine taşıyın — kapalı bir kart açılacak.", hintSequence:"Bir sıra oluşturun: {cards} destesini {target} üzerine taşıyın.", hintFoundationReveal:"{card} kartını temele taşıyın — kapalı bir kart açılacak.", hintFoundationSafeWaste:"{card} kartını atık destesinden güvenle temele taşıyın — sonraki kart açılacak.", hintFoundationSafe:"{card} kartını güvenle temele taşıyın.", hintFoundationRisk:"Bu hamle mümkün: {card} kartını temele taşıyın. Önce diğer seçenekleri kontrol edin.", hintWasteFree:"{card} kartını atık destesinden {target} üzerine taşıyın — sonraki kart açılacak.", hintWaste:"{card} kartını atık destesinden {target} üzerine taşıyın.", hintStockMove:"Desteden sonraki kartı çekin — kullanılabilir bir hamle açılacak.", hintStock:"Desteden sonraki kartı çekin: masada şu anda daha yararlı bir hamle yok.", hintRecycle:"Atık destesini yeniden toplayın ve hamle aramaya devam edin.", hintFoundationBack:"Alternatif: {card} kartını temelden {target} üzerine geri taşıyın.", hintNone:"Yararlı bir hamle bulunamadı. Desteden kart çekmeyi deneyin.",
      hintsTitle:"İpuçları", hintsCap:"Zaten maksimum miktardasınız: <b>{cap}</b>. Oyunda bir ipucu kullanın, ardından miktarı yeniden doldurabilirsiniz.", hintsAvailable:"{cap} ipucundan <b>{balance}</b> tanesi var. İpuçları oyunlar ve cihazlar arasında saklanır.", hintsEmpty:"Ücretsiz ipuçları bitti. Kısa bir reklam izleyip <b>+{amount}</b> ipucu alın.", hintsInfo:"İpucu sizin yerinize hamle yapmaz: yalnızca en yararlı sonraki adımı gösterir.", watchAdPlus:"Video reklamı izle — +{amount}", backToGame:"Oyuna dön", notNow:"Şimdi değil", hintsEnough:"Zaten yeterli ipucunuz var", openingAd:"Reklam açılıyor…", adNoReward:"Reklam tamamlanmadı — ödül verilmedi", hintsReceived:"Alınan ipuçları: +{amount}",
      autoNoneOpen:"Otomatik toplama için henüz kullanılabilir kart yok.", autoNoneClosed:"Otomatik toplama yalnızca güvenli kartları taşır — önce kapalı kartları açın.",
      wins:"<b>{count}</b> galibiyet", streak:"<b>{count}</b> seri", record:"Rekor: <b>{count}</b>", bestTime:"En iyi süre: <b>{time}</b>", hintsStat:"İpuçları: <b>{count}</b>", menuIntro:"Klasik solitaire. Tüm serileri As'tan Papaz'a kadar tamamlayın.", continueGame:"Oyuna devam et", startGame:"Oyunu başlat", newGame:"Yeni oyun", store:"Mağaza", achievements:"Başarımlar", leaderboard:"Sıralama", leaderboardInfo:"Toplam galibiyete göre ilk 10", leaderboardWins:"Galibiyet", leaderboardUnavailable:"Sıralama şu anda kullanılamıyor", howTo:"Nasıl oynanır", settings:"Ayarlar", backMenu:"Menüye dön", inMenu:"Menü", achievementsOpen:"Açılan: <b>{count}</b> / {total}.",
      achFirstTitle:"İlk solitaire", achFirstDesc:"İlk oyununuzu kazanın.", achFiveTitle:"Klondike ustası", achFiveDesc:"5 oyun kazanın.", achTenTitle:"Masada", achTenDesc:"10 oyun oynayın.", achStreakTitle:"Seride", achStreakDesc:"Art arda 3 oyun kazanın.", achFastTitle:"Hızlı eller", achFastDesc:"5 dakika veya daha kısa sürede kazanın.",
      deckClassic:"Klasik", deckAurora:"Kuzey Işıkları", deckSakura:"Sakura", deckOcean:"Okyanus", deckNeon:"Neon", deckChampion:"Defne Masası", deckVeteran:"Usta Oyuncu", deckRoyal:"Kraliyet Gecesi", deckNoir:"Noir", deckRuby:"Yakut", deckGold:"Altın Seri", deckCosmos:"Kozmos", deckStarter:"Başlangıç destesi", deckPremium:"Premium deste", deckUnlocked:"Açıldı", deckSelected:"Seçili", deckChoose:"Seç", deckWatchAd:"Video reklamı izle", deckWatchAdHint:"Video reklamı izleyerek aç", deckAchievementAll:"Tüm 5 başarımı açın", deckAchievementWins10:"10 oyun kazanın", deckEarned:"Başarım ödülü", storeVideo:"Videolar", storeAchievements:"Başarımlar", storePurchases:"Satın alımlar", noAds:"Reklamsız", noAdsDesc:"Reklamları kaldır", bought:"Satın alındı", buy:"Satın al", deckOpened:"“{title}” teması açıldı", deckBought:"“{title}” teması satın alındı", achievementDeckOpened:"Başarım teması açıldı: <b>{names}</b>", rewardNotReceived:"Ödül alınamadı", purchaseFailed:"Satın alma tamamlanmadı", adsDisabled:"Banner ve tam ekran reklamlar kapatıldı. Ödüllü videolar kullanılabilir kalır.", purchaseUnavailable:"Satın alımlar, ürünler platformda yapılandırıldıktan sonra kullanılabilir.", purchaseLoginTitle:"Satın almak için giriş yapın", purchaseLoginCopy:"Satın alımlar platform hesabınıza bağlanır. Güvenli platform penceresinden giriş yapın — oyun e-posta veya ödeme bilgisi istemez.", purchaseLoginRestore:"Kalıcı satın alımlarınız giriş yaptıktan sonra bu hesapta geri yüklenir.", purchaseLoginAction:"Giriş yap ve devam et", purchaseLoginCancel:"Şimdi değil", purchaseLoginSuccess:"Giriş yapıldı. Ödeme açılıyor…", purchaseLoginCancelled:"Giriş tamamlanmadı. Satın alma iptal edildi.", purchaseLoginUnavailable:"Giriş şu anda platformda kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
      howTitle:"Nasıl oynanır", how1:"Tabloda kırmızı ve siyah kartları dönüşümlü kullanarak azalan sırada dizin.", how2:"Boş bir sütuna yalnızca Papaz konabilir.", how3:"Sağ üstteki temelleri As ile başlayarak her seri için tamamlayın.", how4:"Bir karta, ardından hedefe dokunun — sürüklemeden de çalışır.", how5:"İpuçları önce kapalı kartları açan hamleleri arar ve yararlı kartları temele taşımakta acele etmez. Başta 5 ipucunuz vardır; sonra gönüllü reklam izleyerek yenileyin.", understood:"Anladım", settingsTitle:"Ayarlar", drawNew:"Yeni oyunlarda çekiş", drawInfo:"Seçilen: {preferred}. Mevcut oyun {running} düzenini korur. Üçlü çekişte atık deste yelpaze olarak görünür.", drawOne:"1 çek", drawThree:"3 çek", change:"Değiştir", saving:"Kayıt", autosave:"Oyun otomatik olarak kaydedilir", nextDraw:"Yeni oyunlarda kullanılacak: {draw}",
      endTitle:"Bu oyun bitsin mi?", endCopy:"Bu dağılım kapatılacak ve yeniden başlatılamayacak.", end:"Oyunu bitir", winTitle:"Kazandınız!", lostTitle:"Oyun bitti", winCopy:"Tüm kartlar toplandı. Puan: <b>{score}</b>, süre: <b>{time}</b>.", lostCopy:"Bu dağılım kapatıldı. Yeni bir oyun başlatabilirsiniz.", achievementOpened:"Başarım açıldı: <b>{names}</b>", newRound:"Yeni oyun", close:"Kapat", faceDown:"Kapalı kart", wasteTop:"Atık destesi, üst kart kullanılabilir", hintRemaining:"İpucu, {count} kaldı", hintsDepleted:"İpuçları bitti: reklam izle", hintsRemainTitle:"Kalan ipuçları: {count}", hintsEmptyTitle:"İpuçları bitti. Reklam +{amount} verir.", drawOneAria:"Bir kart çek", drawThreeAria:"Üç kart çek", recycleAria:"Desteyi yeniden topla", testConfirm:"Test modu: {label}?"
    }
  });

  let locale = "ru";
  function normalizeLocale(value) {
    const raw = String(value || "").trim().toLowerCase().replace(/_/g, "-");
    const base = raw.split("-")[0];
    return SUPPORTED_LOCALES.has(base) ? base : "en";
  }
  function t(key, vars = {}) {
    const dictionary = I18N[locale] || I18N.en;
    const fallback = I18N.en[key] ?? I18N.ru[key] ?? key;
    const value = dictionary[key] ?? fallback;
    return String(value).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) => String(vars[name] ?? ""));
  }
  function setLocale(value) {
    locale = normalizeLocale(value);
    document.documentElement.lang = locale;
    document.documentElement.dir = "ltr";
    if (app) {
      app.lang = locale;
      app.dataset.locale = locale;
    }
  }
  function deckTitle(id) {
    const deck = DECKS[id];
    return deck ? t(`deck${deck.titleKey.charAt(0).toUpperCase()}${deck.titleKey.slice(1)}`) : t("deckClassic");
  }

  const deepCopy = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Небольшая система визуальных эффектов. Логика пасьянса не зависит от анимаций:
  // даже на медленном устройстве ход выполняется сразу, анимация лишь догоняет состояние.
  const cardEffects = {
    deal: new Map(),
    draw: new Set(),
    flip: new Set()
  };
  let effectCleanupTimer = null;
  let pendingFlights = [];
  const pendingFlightIds = new Set();
  let flightFrame = 0;
  let layoutMetrics = { cardWidth: 83, cardHeight: 120, tableauHeight: 360, dragHeight: 134, portrait: false, compact: false, compactLandscape: false, viewportWidth: 1280, viewportHeight: 720 };

  function cardIds(cards) {
    return (Array.isArray(cards) ? cards : [cards])
      .map(card => typeof card === "string" ? card : card?.id)
      .filter(Boolean);
  }

  function markCardEffect(kind, cards) {
    const ids = cardIds(cards);
    if (kind === "deal") ids.forEach((id, index) => cardEffects.deal.set(id, index));
    else if (cardEffects[kind]) ids.forEach(id => cardEffects[kind].add(id));
  }

  // Флаги эффектов должны попасть в DOM ровно на один рендер.
  // Раньше они жили до 1.75 секунды: при быстром нажатии на колоду полный render()
  // пересоздавал все карты с классом .deal-in, и стартовая раздача проигрывалась заново.
  // Теперь класс остаётся на уже созданном DOM-элементе до конца анимации, но флаг
  // сразу расходуется — следующий рендер не может перезапустить эту же анимацию.
  function clearCardEffectsSoon() {
    const dealCount = cardEffects.deal.size;
    const drawCount = cardEffects.draw.size;
    const flipCount = cardEffects.flip.size;
    if (!dealCount && !drawCount && !flipCount) return;

    const delay = dealCount ? Math.min(1750, 580 + dealCount * 36) : 700;
    cardEffects.deal.clear();
    cardEffects.draw.clear();
    cardEffects.flip.clear();

    clearTimeout(effectCleanupTimer);
    effectCleanupTimer = setTimeout(() => {
      app?.querySelectorAll(".deal-in,.draw-in,.flip-in").forEach(node => {
        node.classList.remove("deal-in", "draw-in", "flip-in");
      });
    }, delay);
  }

  function cardEffectClasses(card) {
    const classes = [];
    if (cardEffects.deal.has(card.id)) classes.push("deal-in");
    if (cardEffects.draw.has(card.id)) classes.push("draw-in");
    if (cardEffects.flip.has(card.id)) classes.push("flip-in");
    return classes.join(" ");
  }

  function findCardElement(cardId) {
    if (!app || !cardId) return null;
    return Array.from(app.querySelectorAll(".card[data-card-id]")).find(node => node.dataset.cardId === cardId) || null;
  }

  function queueMoveFlight(cards) {
    if (!app || !Array.isArray(cards) || !cards.length) return;
    const captured = cards.map(card => {
      const node = findCardElement(card.id);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return { id: card.id, from: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } };
    }).filter(Boolean);
    if (!captured.length) return;
    captured.forEach(flight => pendingFlightIds.add(flight.id));
    pendingFlights.push(captured);
  }

  function revealFlightTarget(target, cardId, clone = null) {
    pendingFlightIds.delete(cardId);
    if (!target) {
      clone?.remove();
      return;
    }
    // The real card is revealed under the moving copy first; the copy disappears one paint later.
    target.style.transition = "none";
    target.style.opacity = "1";
    target.classList.remove("flight-target");
    requestAnimationFrame(() => {
      clone?.remove();
      target.style.removeProperty("transition");
      target.style.removeProperty("opacity");
    });
  }

  function settleFlightLanding(target, cardId, clone, mainAnimation = null) {
    if (!target || !clone) {
      revealFlightTarget(target, cardId, clone);
      return;
    }

    // A tableau stack can receive its final fractional --stack-y after the flight has already started.
    // Before swapping the animated copy for the real card, compare their *current* screen rectangles.
    // Any tiny mismatch is eased over a few frames instead of appearing as a 1–3 px landing jump.
    requestAnimationFrame(() => {
      if (!target.isConnected || !clone.isConnected) {
        revealFlightTarget(target, cardId, clone);
        return;
      }

      if (layoutMetrics?.tableauHeight && layoutMetrics?.cardHeight) {
        layoutTableauStacks(layoutMetrics.tableauHeight, layoutMetrics.cardHeight, layoutMetrics.compact);
      }

      const current = clone.getBoundingClientRect();
      const finalRect = target.getBoundingClientRect();
      if (!current.width || !current.height || !finalRect.width || !finalRect.height) {
        revealFlightTarget(target, cardId, clone);
        return;
      }

      const dx = finalRect.left - current.left;
      const dy = finalRect.top - current.top;
      const scaleX = finalRect.width / Math.max(1, current.width);
      const scaleY = finalRect.height / Math.max(1, current.height);
      const needsSettle = Math.abs(dx) > 0.35 || Math.abs(dy) > 0.35 || Math.abs(scaleX - 1) > 0.004 || Math.abs(scaleY - 1) > 0.004;

      if (!needsSettle) {
        revealFlightTarget(target, cardId, clone);
        return;
      }

      if (mainAnimation) {
        mainAnimation.onfinish = null;
        mainAnimation.oncancel = null;
        try { mainAnimation.cancel(); } catch (_) { /* already finished */ }
      }

      // Freeze the copy exactly where the previous animation visually ended, then softly correct
      // only the sub-pixel/few-pixel difference to the final DOM position.
      Object.assign(clone.style, {
        left: `${current.left}px`,
        top: `${current.top}px`,
        width: `${current.width}px`,
        height: `${current.height}px`,
        transform: "none",
        transformOrigin: "0 0",
        filter: "none"
      });

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        revealFlightTarget(target, cardId, clone);
      };
      const settleAnimation = clone.animate([
        { transform: "translate3d(0,0,0) scale(1,1)", opacity: 1 },
        { transform: `translate3d(${dx}px,${dy}px,0) scale(${scaleX},${scaleY})`, opacity: 1 }
      ], { duration: 90, easing: "cubic-bezier(.22,.8,.25,1)", fill: "forwards" });
      settleAnimation.onfinish = finish;
      settleAnimation.oncancel = finish;
    });
  }

  async function waitForCardFlight(cardId, timeoutMs = 900) {
    if (!cardId) return;
    const started = performance.now();
    while (pendingFlightIds.has(cardId) && performance.now() - started < timeoutMs) {
      await sleep(18);
    }
  }

  function playPendingFlights() {
    if (!app || !pendingFlights.length) return;
    cancelAnimationFrame(flightFrame);
    // Let the destination DOM receive its stack metrics before measuring the landing rectangle.
    flightFrame = requestAnimationFrame(() => {
      const batches = pendingFlights.splice(0);
      const fx = app.querySelector("#k-fx");
      if (!fx) {
        batches.flat().forEach(flight => revealFlightTarget(findCardElement(flight.id), flight.id));
        return;
      }
      batches.flat().forEach((flight, index) => {
        const target = findCardElement(flight.id);
        if (!target) {
          pendingFlightIds.delete(flight.id);
          return;
        }
        const to = target.getBoundingClientRect();
        if (!to.width || !to.height) {
          revealFlightTarget(target, flight.id);
          return;
        }
        const clone = target.cloneNode(true);
        clone.classList.remove("tableau-card", "selected", "pulse", "drag-source", "flight-target", "deal-in", "draw-in", "flip-in", "arrival");
        clone.classList.add("flight-card");
        clone.removeAttribute("aria-label");
        Object.assign(clone.style, {
          position: "fixed",
          inset: "auto",
          left: `${flight.from.left}px`,
          top: `${flight.from.top}px`,
          width: `${flight.from.width}px`,
          height: `${flight.from.height}px`,
          opacity: "1",
          zIndex: String(120 + index),
          filter: "none"
        });
        fx.appendChild(clone);
        target.classList.add("flight-target");
        const dx = to.left - flight.from.left;
        const dy = to.top - flight.from.top;
        const scaleX = to.width / Math.max(1, flight.from.width);
        const scaleY = to.height / Math.max(1, flight.from.height);
        clone.style.transformOrigin = "0 0";
        const duration = 250 + Math.min(index, 5) * 24;
        let cleaned = false;
        const animation = clone.animate([
          { transform: "translate3d(0,0,0) rotate(-1.5deg) scale(.985)", opacity: .98 },
          { transform: `translate3d(${dx}px,${dy}px,0) scale(${scaleX},${scaleY}) rotate(0deg)`, opacity: 1 }
        ], { duration, easing: "cubic-bezier(.2,.82,.2,1)", fill: "forwards" });
        animation.onfinish = () => {
          if (cleaned) return;
          cleaned = true;
          settleFlightLanding(target, flight.id, clone, animation);
        };
        animation.oncancel = () => {
          if (cleaned) return;
          cleaned = true;
          revealFlightTarget(target, flight.id, clone);
        };
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function suitInfo(card) {
    return SUITS.find(suit => suit.key === card?.suit) || SUITS[0];
  }

  function cardColor(card) {
    return suitInfo(card).color;
  }

  function rankLabel(rank) {
    return RANKS[rank - 1] || "?";
  }

  function cardText(card) {
    const suit = suitInfo(card);
    return `${rankLabel(card.rank)}${suit.symbol}`;
  }

  function makeDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ id: `${suit.key}${rank}`, suit: suit.key, rank, faceUp: false });
      }
    }
    return deck;
  }

  function shuffle(cards) {
    const shuffled = cards.slice();
    for (let index = shuffled.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
  }

  function localRead() {
    for (const key of [SAVE_KEY, PREVIOUS_SAVE_KEY, LEGACY_SAVE_KEY]) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      } catch (error) {
        console.warn("[Kosynka] Не удалось прочитать локальное сохранение", error);
      }
    }
    return null;
  }

  function localWrite(payload) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("[Kosynka] Не удалось записать локальное сохранение", error);
    }
  }

  function injectScript(src, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(script => script.src === src);
      if (existing) {
        resolve(existing);
        return;
      }
      const script = document.createElement("script");
      const timer = setTimeout(() => reject(new Error(`SDK timeout: ${src}`)), timeoutMs);
      script.async = true;
      script.src = src;
      script.onload = () => {
        clearTimeout(timer);
        resolve(script);
      };
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`SDK load error: ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  const platform = {
    kind: "local",
    gp: null,
    bridge: null,
    gamePushPlatform: "unknown",
    commerceProducts: new Map(),
    commerceProductsById: new Map(),
    purchasedProducts: new Set(),
    pendingPurchaseTags: new Set(),
    commerceLoaded: false,
    stickyGuardBound: false,
    purchaseEventsBound: false,
    stickyCloseQueued: false,
    gameReadySent: false,

    resolveGamePushPlatform() {
      const query = new URLSearchParams(location.search || "");
      const candidates = [
        window.__KOSYNKA_PLATFORM__,
        query.get("_platform"), query.get("platform"),
        this.gp?.platform?.type, this.gp?.platform?.id, this.gp?.platform?.name,
        this.gp?.environment?.platform, this.gp?.player?.platform
      ];
      const raw = candidates.map(value => String(value || "").toLowerCase()).find(Boolean) || "";
      if (/(yandex|yan|yagames)/.test(raw)) return "yandex";
      if (/(^|[^a-z])vk([^a-z]|$)|vkontakte/.test(raw)) return "vk";
      if (/(^|[^a-z])ok([^a-z]|$)|odnoklassniki/.test(raw)) return "ok";
      return "unknown";
    },

    getStickyPlacement() {
      const platformId = this.gamePushPlatform || "unknown";
      const viewport = typeof getViewportMetrics === "function" ? getViewportMetrics() : { phoneLike: false, portrait: false };
      if (platformId === "yandex") return viewport.phoneLike || viewport.portrait ? "bottom" : "right";
      if (platformId === "vk" || platformId === "ok") return "top";
      return "bottom";
    },

    async init() {
      if (CONFIG.buildTarget === "playgama") {
        if (await this.initPlaygama()) return;
        this.kind = "local";
        return;
      }
      if (CONFIG.buildTarget === "gamepush") {
        if (await this.initGamePush()) return;
        this.kind = "local";
        return;
      }
      this.kind = "local";
    },

    async initPlaygama() {
      try {
        if (!window.bridge) await injectScript("https://bridge.playgama.com/v1/stable/playgama-bridge.js");
        if (!window.bridge || typeof window.bridge.initialize !== "function") return false;
        window.bridge.engine = "construct";
        if (!window.bridge.isInitialized) {
          await window.bridge.initialize();
        }
        this.bridge = window.bridge;
        this.kind = "playgama";
        this.bridge.advertisement?.setMinimumDelayBetweenInterstitial?.(Math.round(CONFIG.interstitialCooldownMs / 1000));
        return true;
      } catch (error) {
        console.warn("[Kosynka] Playgama unavailable; local storage is active", error);
        return false;
      }
    },

    findExistingGamePush() {
      const candidates = [window.gp, window.GamePush, window.GameScore, window.gamepush];
      try {
        if (typeof runtime !== "undefined") candidates.push(runtime.GamePush, runtime.GameScore);
      } catch (_) { /* The local Preview does not expose the Construct runtime variable. */ }
      return candidates.find(candidate => candidate && (candidate.player || candidate.ads || candidate.payments)) || null;
    },

    async waitForGamePushReady(gp) {
      const ready = gp?.player?.ready ?? gp?.ready;
      if (typeof ready === "function") return ready.call(gp.player || gp);
      if (ready && typeof ready.then === "function") return ready;
      return Promise.resolve();
    },

    async initGamePush() {
      try {
        const existing = this.findExistingGamePush();
        if (existing) {
          await this.waitForGamePushReady(existing);
          this.gp = existing;
          this.kind = "gamepush";
          this.gamePushPlatform = this.resolveGamePushPlatform();
          this.bindStickyEntitlementGuard();
          this.bindPurchaseEvents();
          await this.refreshCommerce();
          return true;
        }
        if (!CONFIG.gamePushProjectId || !CONFIG.gamePushPublicToken) return false;
        const callbackName = `__kosynkaGPReady_${Date.now()}_${Math.floor(Math.random() * 99999)}`;
        const gp = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("GamePush initialization timeout")), 15000);
          window[callbackName] = instance => {
            clearTimeout(timer);
            try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
            resolve(instance);
          };
          const sdk = document.createElement("script");
          sdk.async = true;
          sdk.src = `https://gamepush.com/sdk/game-score.js?projectId=${encodeURIComponent(CONFIG.gamePushProjectId)}&publicToken=${encodeURIComponent(CONFIG.gamePushPublicToken)}&callback=${encodeURIComponent(callbackName)}`;
          sdk.onerror = () => { clearTimeout(timer); reject(new Error("GamePush SDK load error")); };
          document.head.appendChild(sdk);
        });
        await this.waitForGamePushReady(gp);
        this.gp = gp;
        this.kind = "gamepush";
        this.gamePushPlatform = this.resolveGamePushPlatform();
        this.bindStickyEntitlementGuard();
        this.bindPurchaseEvents();
        await this.refreshCommerce();
        return true;
      } catch (error) {
        console.warn("[Kosynka] GamePush unavailable; local storage is active", error);
        return false;
      }
    },

    async getLanguage() {
      const read = async value => {
        try { return typeof value === "function" ? await value() : await value; } catch (_) { return null; }
      };
      if (this.kind === "playgama") {
        const language = await read(this.bridge?.platform?.language);
        if (language) return language;
      }
      if (this.kind === "gamepush") {
        const language = await read(this.gp?.language);
        if (language) return language;
      }
      return navigator.languages?.[0] || navigator.language || "en";
    },

    async getGamePushField(key) {
      const player = this.gp?.player;
      if (!player) return null;
      try {
        const getter = player.get || player.getField;
        if (typeof getter === "function") {
          const value = getter.call(player, key);
          return value && typeof value.then === "function" ? await value : value;
        }
      } catch (_) { /* Use the SDK field cache below. */ }
      return player.fields?.[key] ?? player.data?.[key] ?? null;
    },

    async load() {
      let raw = null;
      try {
        if (this.kind === "playgama" && this.bridge?.storage?.get) {
          const values = await this.bridge.storage.get([CONFIG.playgamaStorageKey], "platform_internal");
          raw = Array.isArray(values) ? values[0] : null;
        } else if (this.kind === "gamepush") {
          raw = await this.getGamePushField(CONFIG.gamePushCloudField);
        }
      } catch (error) {
        console.warn("[Kosynka] Cloud save load failed", error);
      }
      if (raw && typeof raw === "object") return raw;
      if (typeof raw === "string" && raw.length) {
        try { return JSON.parse(raw); } catch (_) { /* Use the local copy below. */ }
      }
      return localRead();
    },

    async save(payload) {
      localWrite(payload);
      const text = JSON.stringify(payload);
      try {
        if (this.kind === "playgama" && this.bridge?.storage?.set) {
          await this.bridge.storage.set([CONFIG.playgamaStorageKey], [text], "platform_internal");
        } else if (this.kind === "gamepush" && this.gp?.player?.set) {
          const p = payload?.profile || {};
          this.gp.player.set(CONFIG.gamePushCloudField, text);
          const bestScore = Math.max(0, Math.floor(Number(p.bestScore) || 0));
          this.gp.player.set(CONFIG.gamePushBestScoreField, bestScore);
          if (CONFIG.gamePushLegacyBestScoreField && CONFIG.gamePushLegacyBestScoreField !== CONFIG.gamePushBestScoreField) {
            this.gp.player.set(CONFIG.gamePushLegacyBestScoreField, bestScore);
          }
          this.gp.player.set(CONFIG.gamePushWinsField, Math.max(0, Math.floor(Number(p.wins) || 0)));
          this.gp.player.set(CONFIG.gamePushBestTimeField, Math.max(0, Math.floor(Number(p.bestWinSeconds) || 0)));
          await this.gp.player.sync?.({ storage: "cloud" });
        }
      } catch (error) {
        console.warn("[Kosynka] Save sync failed", error);
      }
    },

    productTagFrom(value) {
      if (typeof value === "string") return value;
      if (!value || typeof value !== "object") return "";
      return String(value.tag || value.productTag || value.product?.tag || "");
    },

    productIdFrom(value) {
      if (!value || typeof value !== "object") return "";
      const id = value.productId ?? value.product?.id ?? value.id;
      return id === undefined || id === null ? "" : String(id);
    },

    resolvePurchaseTag(...values) {
      // GamePush JS normally emits { product, purchase }, while a platform/plugin wrapper may
      // expose Product, PlayerPurchase, tag, id or a nested payload. Normalize all known shapes.
      const knownTags = new Set(Object.values(CONFIG.products));
      const queue = [...values];
      const seen = new Set();
      while (queue.length) {
        const value = queue.shift();
        if (value === undefined || value === null) continue;
        if (typeof value === "string" || typeof value === "number") {
          const text = String(value);
          if (knownTags.has(text) || this.commerceProducts.has(text)) return text;
          const mappedTag = this.productTagFrom(this.commerceProductsById.get(text));
          if (mappedTag) return mappedTag;
          continue;
        }
        if (typeof value !== "object" || seen.has(value)) continue;
        seen.add(value);
        const directTag = value.tag ?? value.productTag;
        if (directTag !== undefined && directTag !== null) {
          const text = String(directTag);
          if (knownTags.has(text) || this.commerceProducts.has(text)) return text;
        }
        const id = value.productId ?? value.id;
        if (id !== undefined && id !== null) {
          const mappedTag = this.productTagFrom(this.commerceProductsById.get(String(id)));
          if (mappedTag) return mappedTag;
        }
        for (const key of ["product", "purchase", "data", "result", "detail"]) {
          if (value[key] !== undefined && value[key] !== null) queue.push(value[key]);
        }
      }
      return "";
    },

    async refreshCommerce({ preserveSession = true, forceFetch = false } = {}) {
      if (this.kind !== "gamepush" || !this.gp?.payments) return false;
      try {
        const payments = this.gp.payments;
        // Keep purchases confirmed in this session even when payments.purchases is a stale startup cache.
        const sessionConfirmed = preserveSession ? new Set(this.purchasedProducts) : new Set();
        let products = Array.isArray(payments.products) ? payments.products : null;
        let purchases = Array.isArray(payments.purchases) ? payments.purchases : null;
        // GamePush normally preloads both lists. After a checkout we deliberately force the legacy
        // fetchProducts request because it is the only SDK refresh call that returns playerPurchases;
        // this lets the UI confirm a purchase without requiring a full page reload.
        if ((forceFetch || !products || !purchases) && typeof payments.fetchProducts === "function") {
          const data = await payments.fetchProducts();
          const fetchedProducts = Array.isArray(data) ? data : (data?.products || data?.items || null);
          const fetchedPurchases = Array.isArray(data?.playerPurchases) ? data.playerPurchases
            : Array.isArray(data?.purchases) ? data.purchases : null;
          if (fetchedProducts) products = fetchedProducts;
          if (fetchedPurchases) purchases = fetchedPurchases;
        }
        products = products || [];
        purchases = purchases || [];

        this.commerceProducts.clear();
        this.commerceProductsById.clear();
        for (const product of products) {
          const tag = this.productTagFrom(product);
          const id = this.productIdFrom(product);
          if (tag) this.commerceProducts.set(tag, product);
          if (id) this.commerceProductsById.set(id, product);
        }

        this.purchasedProducts.clear();
        for (const item of purchases) {
          let tag = this.resolvePurchaseTag(item);
          if (!tag) {
            const product = this.commerceProductsById.get(this.productIdFrom(item));
            tag = this.productTagFrom(product);
          }
          if (tag) this.purchasedProducts.add(tag);
        }
        for (const tag of sessionConfirmed) this.purchasedProducts.add(tag);
        this.commerceLoaded = true;
        return true;
      } catch (error) {
        console.warn("[Kosynka] Product catalogue unavailable", error);
        return false;
      }
    },

    hasPurchase(productTag) {
      if (!productTag) return false;
      try {
        if (this.kind === "gamepush" && typeof this.gp?.payments?.has === "function") {
          if (this.gp.payments.has(productTag)) return true;
        }
      } catch (_) { /* Fall back to the normalized purchase cache. */ }
      return this.purchasedProducts.has(productTag);
    },

    async confirmPurchase(productTag) {
      if (this.hasPurchase(productTag)) return true;
      const delays = [0, 220, 600, 1200, 2200];
      for (const delay of delays) {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        await this.refreshCommerce({ preserveSession: true, forceFetch: true });
        if (this.hasPurchase(productTag)) return true;
      }
      return false;
    },

    async reconcilePendingPurchases() {
      if (this.kind !== "gamepush" || !this.pendingPurchaseTags.size) return;
      try {
        await this.refreshCommerce({ preserveSession: true, forceFetch: true });
        for (const tag of [...this.pendingPurchaseTags]) {
          if (!this.hasPurchase(tag)) continue;
          this.pendingPurchaseTags.delete(tag);
          await handlePlatformPurchaseSuccess(tag);
        }
      } catch (error) {
        console.warn("[Kosynka] Pending purchase reconciliation failed", error);
      }
    },

    async syncEntitlements(targetProfile) {
      if (this.kind !== "gamepush" || !targetProfile) return false;
      await this.refreshCommerce();
      let changed = false;
      const productToSkin = {
        [CONFIG.products.royalDeck]: "royal",
        [CONFIG.products.noirDeck]: "noir",
        [CONFIG.products.rubyDeck]: "ruby",
        [CONFIG.products.goldDeck]: "gold",
        [CONFIG.products.cosmosDeck]: "cosmos"
      };
      for (const [tag, skin] of Object.entries(productToSkin)) {
        if (this.hasPurchase(tag) && !targetProfile.unlockedSkins.includes(skin)) {
          targetProfile.unlockedSkins.push(skin);
          changed = true;
        }
      }
      if (this.hasPurchase(CONFIG.products.removeAds) && !targetProfile.noAds) {
        targetProfile.noAds = true;
        changed = true;
      }
      if (targetProfile.noAds && unlockRewardSkinsForNoAds(targetProfile).length) changed = true;
      return changed;
    },

    getProduct(productTag) {
      return this.kind === "gamepush" ? (this.commerceProducts.get(productTag) || null) : null;
    },

    getProductName(productTag, fallback = "") {
      const name = this.getProduct(productTag)?.name;
      return name === undefined || name === null || name === "" ? fallback : String(name);
    },

    getProductPriceHtml(productTag) {
      if (this.kind !== "gamepush") return "";
      const product = this.getProduct(productTag);
      if (!product) return "";
      const rawAmount = product.price;
      const rawCurrency = product.currencySymbol || product.currency || "";
      if (rawAmount === undefined || rawAmount === null || rawAmount === "") return "";
      const amount = escapeHtml(String(rawAmount));
      const currency = rawCurrency ? `<span class="store-currency">${escapeHtml(String(rawCurrency))}</span>` : "";
      return `<span class="store-price"><b>${amount}</b>${currency}</span>`;
    },

    findNativeYandexAdv() {
      // GamePush normally owns the Yandex SDK. This is a best-effort fallback only when
      // an already-initialized native Yandex SDK is exposed by the host page. We never
      // create a second YaGames SDK instance from the game.
      const candidates = [window.ysdk, window.yaSdk, window.YaSDK, window.__ysdk, window.YandexGamesSDK];
      for (const candidate of candidates) {
        if (candidate?.adv && typeof candidate.adv.hideBannerAdv === "function") return candidate.adv;
      }
      return null;
    },

    bindPurchaseEvents() {
      if (this.purchaseEventsBound || this.kind !== "gamepush" || typeof this.gp?.payments?.on !== "function") return;
      this.gp.payments.on("purchase", (...args) => {
        const tag = this.resolvePurchaseTag(...args);
        if (!tag) {
          console.warn("[Kosynka] Purchase event received, but product tag could not be resolved", ...args);
          return;
        }
        this.pendingPurchaseTags.delete(tag);
        this.purchasedProducts.add(tag);
        Promise.resolve(handlePlatformPurchaseSuccess(tag)).catch(error =>
          console.warn("[Kosynka] Immediate purchase entitlement update failed", error)
        );
      });
      this.purchaseEventsBound = true;
    },

    bindStickyEntitlementGuard() {
      if (this.stickyGuardBound || this.kind !== "gamepush" || typeof this.gp?.ads?.on !== "function") return;
      const closeWhenOwned = () => {
        if (!profile?.noAds || this.stickyCloseQueued) return;
        this.stickyCloseQueued = true;
        setBannerReserve(false);
        Promise.resolve().then(async () => {
          try { await this.hideBanner("sticky-event"); }
          finally { this.stickyCloseQueued = false; }
        });
      };
      this.gp.ads.on("sticky:start", closeWhenOwned);
      this.gp.ads.on("sticky:render", closeWhenOwned);
      this.gp.ads.on("sticky:refresh", closeWhenOwned);
      this.stickyGuardBound = true;
    },

    async showBanner() {
      // A buyer never asks the SDK to show the sticky banner; if a platform auto-started it,
      // enforceNoAdsSticky immediately closes it again. Rewarded advertising is not affected.
      if (profile?.noAds) {
        await this.enforceNoAdsSticky();
        return false;
      }
      try {
        if (this.kind === "playgama" && this.bridge?.advertisement?.showBanner) {
          await this.bridge.advertisement.showBanner("bottom", "solitaire_bottom");
          return true;
        }
        if (this.kind === "gamepush" && this.gp?.ads?.showSticky) {
          if (this.gp.ads.isStickyAvailable === false) return false;
          await this.gp.ads.showSticky();
          return true;
        }
      } catch (error) {
        console.warn("[Kosynka] Banner unavailable", error);
      }
      return false;
    },

    async hideBanner(reason = "manual") {
      let closed = false;
      try {
        if (this.kind === "playgama" && this.bridge?.advertisement?.hideBanner) {
          const result = await this.bridge.advertisement.hideBanner();
          closed = result !== false;
        }
        if (this.kind === "gamepush" && this.gp?.ads?.closeSticky) {
          // GamePush implements closeSticky() on Yandex, VK and OK. It is the primary path.
          const result = await this.gp.ads.closeSticky();
          closed = closed || result !== false;
        }
        if (this.kind === "gamepush" && this.gamePushPlatform === "yandex") {
          // The native fallback is useful only on a host that exposes an already-created ysdk.
          const nativeAdv = this.findNativeYandexAdv();
          if (nativeAdv) {
            const state = await nativeAdv.hideBannerAdv();
            closed = closed || state?.stickyAdvIsShowing === false;
          }
        }
      } catch (error) {
        console.warn(`[Kosynka] Banner close failed (${reason})`, error);
      }
      return closed;
    },

    async enforceNoAdsSticky() {
      if (!profile?.noAds) return false;
      setBannerReserve(false);
      await this.hideBanner("no-ads-entitlement");
      // Some webviews restore platform banners when visibility changes. Retry once shortly
      // afterwards without touching rewarded-video availability.
      window.setTimeout(() => {
        if (profile?.noAds) this.hideBanner("no-ads-retry");
      }, CONFIG.stickyCloseRetryMs);
      return true;
    },

    async showPreloaderIfYandex() {
      // Construct plugin auto-preloader is disabled. We invoke it ourselves only on Yandex,
      // because the same GamePush project is also exported to VK and OK.
      if (this.kind !== "gamepush" || this.gamePushPlatform !== "yandex") return false;
      if (!this.gp?.ads?.showPreloader || this.gp.ads.isPreloaderAvailable === false) return false;
      try {
        const result = await this.gp.ads.showPreloader();
        return result !== false;
      } catch (error) {
        console.warn("[Kosynka] Yandex preloader unavailable", error);
        return false;
      }
    },

    async sendGameReadyIfYandex() {
      // Yandex LoadingAPI.ready() must be sent only when loading/preloader is over and
      // the player can already interact with the game. GamePush maps gameStart() to
      // the platform-specific Game Ready call.
      if (this.gameReadySent || this.kind !== "gamepush" || this.gamePushPlatform !== "yandex") return false;
      if (typeof this.gp?.gameStart !== "function") {
        console.warn("[Kosynka] Yandex Game Ready unavailable: gp.gameStart() is missing");
        return false;
      }
      try {
        // Let the first rendered UI frame reach the browser before notifying Yandex.
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await Promise.resolve(this.gp.gameStart());
        this.gameReadySent = true;
        console.info("[Kosynka] Yandex Game Ready sent");
        return true;
      } catch (error) {
        console.warn("[Kosynka] Yandex Game Ready failed", error);
        return false;
      }
    },

    async showInterstitial(placement) {
      try {
        if (this.kind === "playgama" && this.bridge?.advertisement?.showInterstitial) {
          const result = await this.bridge.advertisement.showInterstitial(placement);
          return result !== false;
        }
        if (this.kind === "gamepush" && this.gp?.ads?.showFullscreen) {
          if (this.gp.ads.isFullscreenAvailable === false) return false;
          const result = await this.gp.ads.showFullscreen();
          return result !== false;
        }
      } catch (error) {
        console.warn("[Kosynka] Interstitial unavailable", error);
      }
      return false;
    },

    async showRewarded(placement, testRewardLabel = t("deckWatchAd")) {
      try {
        if (this.kind === "playgama" && this.bridge?.advertisement?.showRewarded) {
          const result = await this.bridge.advertisement.showRewarded(placement);
          return result !== false;
        }
        if (this.kind === "gamepush" && this.gp?.ads?.showRewardedVideo) {
          if (this.gp.ads.isRewardedAvailable === false) return false;
          return Boolean(await this.gp.ads.showRewardedVideo({ showFailedOverlay: true }));
        }
      } catch (error) {
        console.warn("[Kosynka] Rewarded video unavailable", error);
      }
      // Browser confirm is useful only in local Construct Preview. On a real platform it can
      // mask an SDK failure and leave the interaction flow in an unexpected state.
      return this.kind === "local" ? window.confirm(t("testConfirm", { label: testRewardLabel })) : false;
    },

    canOpenLeaderboard() {
      return this.kind === "gamepush" && (
        typeof this.gp?.leaderboard?.fetch === "function" ||
        typeof this.gp?.leaderboard?.open === "function"
      );
    },

    async fetchWinsLeaderboard() {
      if (this.kind !== "gamepush" || typeof this.gp?.leaderboard?.fetch !== "function") return null;
      try {
        // Use GamePush data API instead of the SDK overlay. This avoids platform/webview cases
        // where leaderboard.open() silently fails to paint an overlay, and guarantees that the
        // visible rating is sorted by the player's total wins field: solitaire_wins.
        return await this.gp.leaderboard.fetch({
          orderBy: [CONFIG.gamePushWinsField],
          order: "DESC",
          limit: CONFIG.leaderboardLimit,
          withMe: "last",
          showNearest: 2,
          includeFields: [CONFIG.gamePushWinsField]
        });
      } catch (error) {
        console.warn("[Kosynka] Leaderboard fetch unavailable", error);
        return null;
      }
    },

    async isGamePushLoggedIn() {
      if (this.kind !== "gamepush" || !this.gp?.player) return false;
      try {
        const raw = this.gp.player.isLoggedIn;
        const value = typeof raw === "function" ? raw.call(this.gp.player) : raw;
        return Boolean(value && typeof value.then === "function" ? await value : value);
      } catch (_) {
        return false;
      }
    },

    async requiresLoginForPurchase() {
      if (!CONFIG.purchaseRequiresAuthenticatedAccount || this.kind !== "gamepush") return false;
      return !(await this.isGamePushLoggedIn());
    },

    async loginForPurchase() {
      if (this.kind !== "gamepush" || !this.gp?.player?.login) return { ok: false, code: "unavailable" };
      if (await this.isGamePushLoggedIn()) return { ok: true, code: "already" };
      try {
        // Called directly from the player's click. GamePush opens the native/platform login UI.
        const result = await this.gp.player.login();
        await this.waitForGamePushReady(this.gp);
        const loggedIn = await this.isGamePushLoggedIn();
        const success = loggedIn || result === true || result?.success === true || result?.status === "success";
        if (!success) return { ok: false, code: "cancelled" };
        // The account context changed: rebuild permanent purchases from the newly logged-in account.
        this.pendingPurchaseTags.clear();
        await this.refreshCommerce({ preserveSession: false, forceFetch: true });
        return { ok: true, code: "success" };
      } catch (error) {
        console.warn("[Kosynka] Login for purchase failed", error);
        return { ok: false, code: "unavailable" };
      }
    },

    async purchase(productTag) {
      try {
        if (this.kind === "playgama") return { ok: false, code: "unavailable" };
        if (this.kind === "gamepush" && this.gp?.payments?.purchase) {
          if (await this.requiresLoginForPurchase()) return { ok: false, code: "login_required" };
          if (this.gp.payments.isAvailable === false) return { ok: false, code: "unavailable" };

          // Mark before opening the native checkout. If the platform suspends the JS promise,
          // focus/visibility recovery will force-refresh purchases and apply the entitlement.
          this.pendingPurchaseTags.add(productTag);
          const purchaseCall = this.gp.payments.purchase({ tag: productTag });
          const isPromisePurchase = Boolean(purchaseCall && typeof purchaseCall.then === "function");
          const result = isPromisePurchase ? await purchaseCall : purchaseCall;
          const status = String(result?.status || result?.state || "").toLowerCase();
          const explicitFailure = result === false || result?.success === false ||
            ["cancelled", "canceled", "failed", "error", "rejected"].includes(status);
          if (explicitFailure) {
            this.pendingPurchaseTags.delete(productTag);
            return { ok: false, code: status.includes("cancel") ? "cancelled" : "unavailable" };
          }

          const resolvedTag = this.resolvePurchaseTag(result);
          const explicitSuccess = result === true || result?.success === true || Boolean(resolvedTag || result?.product || result?.purchase);
          // The official GamePush flow grants permanent entitlements immediately after an awaited
          // purchase call completes. Some platform adapters fulfill the Promise with no payload, so
          // a fulfilled Promise itself is a success signal unless an explicit failure was returned.
          if (explicitSuccess || isPromisePurchase) {
            this.pendingPurchaseTags.delete(productTag);
            this.purchasedProducts.add(resolvedTag || productTag);
            this.purchasedProducts.add(productTag);
            return { ok: true, code: "success", productTag: resolvedTag || productTag, result };
          }

          // A non-Promise engine/plugin wrapper may be fire-and-forget. In that case we still require
          // a real SDK purchase event/cache confirmation rather than unlocking merely on button press.
          const confirmed = await this.confirmPurchase(productTag);
          if (confirmed) {
            this.pendingPurchaseTags.delete(productTag);
            this.purchasedProducts.add(productTag);
            return { ok: true, code: "success", productTag, result };
          }
          return { ok: false, code: "pending" };
        }
      } catch (error) {
        console.warn("[Kosynka] Purchase unfinished", error);
        // Keep a pending tag: if the platform completed payment but interrupted the promise,
        // returning focus to the game will reconcile it against the server-side purchase list.
        return { ok: false, code: "pending" };
      }
      alert(t("purchaseUnavailable"));
      return { ok: false, code: "unavailable" };
    }
  };

  let app = null;
  let game = null;
  let profile = null;
  let history = [];
  let selection = null;
  let drag = null;
  let saveTimer = null;
  let timerInterval = null;
  // Fullscreen timing is session-only. Cloud/local saves must never make a fresh launch immediately eligible.
  let nextInterstitialEligibleAt = Number.POSITIVE_INFINITY;
  let interstitialAttemptInFlight = false;
  let interactionLocked = false;
  let interactionLockToken = 0;
  let suppressClicksUntil = 0;
  let layoutFrame = 0;
  let viewportReflowTimer = null;
  let viewportSettleTimers = [];
  let viewportReflowId = 0;
  let viewportReflowing = false;
  let lastViewportSignature = "";
  let viewportObserver = null;
  let hasSavedGame = false;
  let shopTab = "reward";
  // Зарезервированная область внизу включается только после успешного показа настоящего sticky-баннера.
  // В Preview, без подключённой площадки и после покупки «Без рекламы» нижняя полоса не занимает место.
  let bannerReserveActive = false;

  function finishExternalInteraction(token = null) {
    if (token !== null && token !== interactionLockToken) return;
    // A focus/visibility recovery invalidates the old pending SDK call. If it resolves later,
    // its finally block must not unlock a newer platform interaction.
    if (token === null) interactionLockToken += 1;
    interactionLocked = false;
    if (drag) clearDragVisual();
    try { window.getSelection?.()?.removeAllRanges?.(); } catch (_) {}
    suppressClicksUntil = Date.now() + 220;
    if (app) {
      app.querySelectorAll(".hint-source,.hint-target").forEach(node => node.classList.remove("hint-source", "hint-target"));
      requestViewportReflow(false);
    }
    resumeGameClock();
  }

  async function runExternalInteraction(task, fallbackValue = false) {
    if (interactionLocked) return fallbackValue;
    const token = ++interactionLockToken;
    // Do not count time spent in a platform ad/login/payment overlay as gameplay time.
    pauseGameClock();
    interactionLocked = true;
    if (drag) clearDragVisual();
    try {
      return await task();
    } catch (error) {
      console.warn("[Kosynka] External platform interaction failed", error);
      return fallbackValue;
    } finally {
      finishExternalInteraction(token);
    }
  }

  function defaultProfile() {
    return {
      skin: "classic",
      unlockedSkins: ["classic"],
      noAds: false,
      games: 0,
      wins: 0,
      winStreak: 0,
      bestScore: 0,
      bestWinSeconds: 0,
      preferredDrawCount: 1,
      achievements: [],
      lastInterstitialAt: 0,
      hintCount: 0,
      hintBalance: CONFIG.hintStartBalance
    };
  }

  function validProfile(raw) {
    const base = defaultProfile();
    if (!raw || typeof raw !== "object") return base;
    const merged = { ...base, ...raw };
    merged.unlockedSkins = Array.isArray(merged.unlockedSkins) ? merged.unlockedSkins.filter(id => DECKS[id]) : ["classic"];
    if (!merged.unlockedSkins.includes("classic")) merged.unlockedSkins.unshift("classic");
    if (!DECKS[merged.skin] || !merged.unlockedSkins.includes(merged.skin)) merged.skin = "classic";
    merged.games = Math.max(0, Number(merged.games) || 0);
    merged.wins = Math.max(0, Number(merged.wins) || 0);
    merged.winStreak = Math.max(0, Number(merged.winStreak) || 0);
    merged.bestScore = Math.max(0, Number(merged.bestScore) || 0);
    merged.bestWinSeconds = Math.max(0, Number(merged.bestWinSeconds) || 0);
    merged.preferredDrawCount = merged.preferredDrawCount === 3 ? 3 : 1;
    merged.hintCount = Math.max(0, Number(merged.hintCount) || 0);
    // Старые сохранения не имели баланса. Всем существующим игрокам выдаём стартовый набор,
    // вместо того чтобы трактовать старый счётчик использований как количество подсказок.
    const hasStoredHintBalance = Object.prototype.hasOwnProperty.call(raw, "hintBalance");
    merged.hintBalance = hasStoredHintBalance
      ? clamp(Math.floor(Number(merged.hintBalance) || 0), 0, CONFIG.hintBalanceCap)
      : CONFIG.hintStartBalance;
    merged.achievements = Array.isArray(merged.achievements) ? merged.achievements.filter(id => ACHIEVEMENTS.some(item => item.id === id)) : [];
    return merged;
  }

  function getHintBalance() {
    if (!profile) return 0;
    return clamp(Math.floor(Number(profile.hintBalance) || 0), 0, CONFIG.hintBalanceCap);
  }

  function setHintBalance(value) {
    if (!profile) return 0;
    profile.hintBalance = clamp(Math.floor(Number(value) || 0), 0, CONFIG.hintBalanceCap);
    return profile.hintBalance;
  }

  // Проект поддерживает обе ориентации. Геометрия стола пересчитывается по фактическому viewport,
  // поэтому на телефоне не показывается отдельная заглушка поворота устройства.
  function isPhoneUserAgent() {
    const ua = navigator.userAgent || "";
    return /Android.*Mobile|iPhone|iPod|Windows Phone|IEMobile|Opera Mini/i.test(ua);
  }

  function getViewportMetrics() {
    const visual = window.visualViewport;
    const useVisualViewport = Boolean(visual && Math.abs(Number(visual.scale || 1) - 1) < 0.02);
    const width = Math.max(1, Math.round((useVisualViewport ? visual.width : window.innerWidth) || document.documentElement.clientWidth || 1));
    const height = Math.max(1, Math.round((useVisualViewport ? visual.height : window.innerHeight) || document.documentElement.clientHeight || 1));
    const portrait = height >= width;
    const coarsePointer = Boolean(window.matchMedia?.("(pointer: coarse)")?.matches);
    const phoneLike = isPhoneUserAgent() || (coarsePointer && Math.min(width, height) <= 700);
    const rotationBlocked = false;
    // Планшеты и ПК по-прежнему адаптируются к любому размеру. Для квадратных и узких
    // окон ПК включается компактная шапка, но сам стол остаётся семиколоночным.
    const desktopNarrow = !phoneLike && (width <= 1060 || width / Math.max(1, height) < 1.22);
    // Отдельные брейкпоинты нужны именно для ПК: браузер может стать очень узким,
    // но устройство всё ещё не является телефоном. В таком окне шапка/низ уменьшаются
    // раньше, чем карта или кнопка смогут выйти за край viewport.
    const desktopTight = !phoneLike && width <= 760;
    const desktopVeryTight = !phoneLike && width <= 520;
    const compactLandscape = !portrait && !rotationBlocked && height <= 560;
    const compact = portrait || compactLandscape || desktopNarrow || desktopTight;
    return { width, height, portrait, phoneLike, rotationBlocked, desktopNarrow, desktopTight, desktopVeryTight, compactLandscape, compact };
  }

  function syncViewportVariables() {
    if (!app) return getViewportMetrics();
    const metrics = getViewportMetrics();
    app.style.setProperty("--viewport-w", `${metrics.width}px`);
    app.style.setProperty("--viewport-h", `${metrics.height}px`);
    app.classList.toggle("k-portrait", metrics.portrait);
    app.classList.toggle("k-phone-landscape", metrics.rotationBlocked);
    app.classList.toggle("k-desktop-narrow", metrics.desktopNarrow);
    app.classList.toggle("k-desktop-tight", metrics.desktopTight);
    app.classList.toggle("k-desktop-very-tight", metrics.desktopVeryTight);
    app.classList.toggle("k-compact-landscape", metrics.compactLandscape);
    // Yandex uses a right sticky on desktop; on a phone it falls back to a bottom reserve.
    // Re-apply only the layout reservation; do not open/close the external banner on resize.
    if (bannerReserveActive) applyBannerReserve();
    // Сбрасываем измеренный резерв перед пересчётом: CSS выбирает подходящую базу,
    // затем updateLayoutMetrics уточняет реальную высоту нижней панели.
    app.style.removeProperty("--controls-h");
    app.dataset.layout = metrics.rotationBlocked
      ? "phone-landscape-locked"
      : metrics.portrait ? "portrait" : metrics.compactLandscape ? "compact-landscape" : metrics.desktopVeryTight ? "desktop-very-tight" : metrics.desktopTight ? "desktop-tight" : metrics.desktopNarrow ? "desktop-narrow" : "landscape";
    return metrics;
  }

  function applyBannerReserve() {
    if (!app) return;
    // Sticky ads are overlays. Never carve out a fake bottom/top/right safe zone for them:
    // the previous right-side reserve also left part of the game visible outside modal backdrop.
    app.classList.remove("has-platform-banner");
    app.dataset.bannerPlacement = "overlay";
    app.style.setProperty("--ad-reserve-h", "0px");
    app.style.setProperty("--ad-reserve-top", "0px");
    app.style.setProperty("--ad-reserve-w", "0px");
  }

  function setBannerReserve(active) {
    bannerReserveActive = Boolean(active && !profile?.noAds);
    applyBannerReserve();
    scheduleLayoutMetrics();
  }

  function clearVisualEffectsForViewportChange() {
    cancelAnimationFrame(flightFrame);
    flightFrame = 0;
    pendingFlights = [];
    pendingFlightIds.clear();
    clearTimeout(effectCleanupTimer);
    effectCleanupTimer = null;
    cardEffects.deal.clear();
    cardEffects.draw.clear();
    cardEffects.flip.clear();
    if (!app) return;
    app.querySelector("#k-fx")?.replaceChildren();
    app.querySelectorAll(".deal-in,.draw-in,.flip-in,.arrival").forEach(node => {
      node.classList.remove("deal-in", "draw-in", "flip-in", "arrival");
    });
    app.querySelectorAll(".flight-target").forEach(node => node.classList.remove("flight-target"));
  }

  function clearViewportSettleTimers() {
    clearTimeout(viewportReflowTimer);
    viewportReflowTimer = null;
    viewportSettleTimers.forEach(timer => clearTimeout(timer));
    viewportSettleTimers = [];
  }

  function requestViewportReflow(force = false) {
    if (!app) return;
    const metrics = getViewportMetrics();
    const signature = `${metrics.width}x${metrics.height}:${metrics.portrait ? "p" : "l"}`;
    if (!force && signature === lastViewportSignature) {
      // ResizeObserver и visualViewport нередко сообщают один и тот же финальный размер.
      // Во время уже запущенного reflow повторный запуск только создавал бы лишние layout-проходы.
      if (!viewportReflowing) scheduleLayoutMetrics();
      return;
    }
    lastViewportSignature = signature;
    const reflowId = ++viewportReflowId;
    viewportReflowing = true;
    clearViewportSettleTimers();

    // Нельзя оставлять под пальцем старый drag-слепок при смене геометрии: он мог оказаться
    // в другой колонке после поворота. Ход не теряется, отменяется только его визуальное перетаскивание.
    if (drag) {
      clearDragVisual();
      suppressClicksUntil = Date.now() + 180;
    }
    clearVisualEffectsForViewportChange();
    app.classList.add("is-reflowing");
    syncViewportVariables();

    const settle = () => {
      if (reflowId !== viewportReflowId || !app) return;
      const current = syncViewportVariables();
      updateLayoutMetrics();
    };

    // Два последовательных кадра закрывают обычный поворот, короткие таймеры — Safari и WebView,
    // где CSS media-query и visualViewport доходят с задержкой.
    requestAnimationFrame(() => {
      if (reflowId !== viewportReflowId) return;
      settle();
      requestAnimationFrame(settle);
    });
    [70, 165].forEach(delay => {
      viewportSettleTimers.push(setTimeout(settle, delay));
    });
    viewportReflowTimer = setTimeout(() => {
      if (reflowId !== viewportReflowId || !app) return;
      settle();
      viewportReflowing = false;
      app.classList.remove("is-reflowing");
    }, 280);
  }

  function bindViewportLayoutEvents() {
    const request = () => requestViewportReflow(false);
    window.addEventListener("resize", request, { passive: true });
    window.addEventListener("orientationchange", () => {
      requestViewportReflow(true);
      // На iOS orientationchange приходит до фактической смены CSS viewport.
      setTimeout(() => requestViewportReflow(true), 110);
    }, { passive: true });
    window.visualViewport?.addEventListener("resize", request, { passive: true });
    if (typeof ResizeObserver === "function") {
      viewportObserver = new ResizeObserver(() => requestViewportReflow(false));
      const shell = app?.querySelector(".k-app");
      if (shell) viewportObserver.observe(shell);
    }
  }

  const ACHIEVEMENTS = [
    { id: "first-win", titleKey: "achFirstTitle", descriptionKey: "achFirstDesc", done: profile => profile.wins >= 1 },
    { id: "five-wins", titleKey: "achFiveTitle", descriptionKey: "achFiveDesc", done: profile => profile.wins >= 5 },
    { id: "ten-games", titleKey: "achTenTitle", descriptionKey: "achTenDesc", done: profile => profile.games >= 10 },
    { id: "streak-three", titleKey: "achStreakTitle", descriptionKey: "achStreakDesc", done: profile => profile.winStreak >= 3 },
    { id: "fast-win", titleKey: "achFastTitle", descriptionKey: "achFastDesc", done: profile => profile.bestWinSeconds > 0 && profile.bestWinSeconds <= 300 }
  ];

  function achievementTitle(item) { return t(item?.titleKey || "achFirstTitle"); }
  function achievementDescription(item) { return t(item?.descriptionKey || "achFirstDesc"); }

  function refreshAchievements() {
    if (!profile) return [];
    const known = new Set(profile.achievements || []);
    const unlocked = [];
    for (const item of ACHIEVEMENTS) {
      if (item.done(profile) && !known.has(item.id)) {
        known.add(item.id);
        unlocked.push(item);
      }
    }
    profile.achievements = [...known];
    return unlocked;
  }

  function achievementCount() {
    return (profile?.achievements || []).filter(id => ACHIEVEMENTS.some(item => item.id === id)).length;
  }

  function deckAccessKind(deck) {
    if (!deck) return "starter";
    // Playgama does not use purchases. The five premium themes are rewarded-video themes there.
    return platform?.kind === "playgama" && deck.kind === "purchase" ? "reward" : deck.kind;
  }

  function achievementDeckRequirement(deck) {
    return deck?.achievement === "all" ? t("deckAchievementAll") : t("deckAchievementWins10");
  }

  function isAchievementDeckEarned(deck) {
    if (!deck || deck.kind !== "achievement" || !profile) return false;
    if (deck.achievement === "all") return achievementCount() >= ACHIEVEMENTS.length;
    return profile.wins >= 10;
  }

  function refreshAchievementDecks() {
    if (!profile) return [];
    const unlocked = [];
    for (const [id, deck] of Object.entries(DECKS)) {
      if (deck.kind !== "achievement" || !isAchievementDeckEarned(deck) || profile.unlockedSkins.includes(id)) continue;
      profile.unlockedSkins.push(id);
      unlocked.push(id);
    }
    return unlocked;
  }

  function unlockRewardSkinsForNoAds(targetProfile = profile) {
    if (!targetProfile?.noAds || !Array.isArray(targetProfile.unlockedSkins)) return [];
    const unlocked = [];
    for (const [id, deck] of Object.entries(DECKS)) {
      if (storeDeckAccess(deck) !== "reward" || targetProfile.unlockedSkins.includes(id)) continue;
      targetProfile.unlockedSkins.push(id);
      unlocked.push(id);
    }
    return unlocked;
  }

  function refreshProgression() {
    const achievements = refreshAchievements();
    const decks = refreshAchievementDecks();
    return { achievements, decks };
  }

  function newGameState() {
    const deck = shuffle(makeDeck());
    const tableaus = Array.from({ length: 7 }, () => []);
    for (let pile = 0; pile < 7; pile++) {
      for (let index = 0; index <= pile; index++) {
        const card = deck.pop();
        card.faceUp = index === pile;
        tableaus[pile].push(card);
      }
    }
    return {
      version: 3,
      stock: deck,
      waste: [],
      foundations: [[], [], [], []],
      tableaus,
      score: 0,
      moves: 0,
      elapsed: 0,
      startedAt: Date.now(),
      finished: false,
      outcome: null,
      drawCount: profile?.preferredDrawCount === 3 ? 3 : 1
    };
  }

  function normalizeCard(card) {
    if (!card || !SUITS.some(suit => suit.key === card.suit) || !Number.isInteger(card.rank) || card.rank < 1 || card.rank > 13) return null;
    return { id: card.id || `${card.suit}${card.rank}`, suit: card.suit, rank: card.rank, faceUp: Boolean(card.faceUp) };
  }

  function normalizePile(value) {
    if (!Array.isArray(value)) return [];
    return value.map(normalizeCard).filter(Boolean);
  }

  function foundationIndexForSuit(suit) {
    return SUITS.findIndex(item => item.key === suit);
  }

  function normalizeFoundations(value) {
    // Saves from v1.13 allowed a suit to begin in any empty base. v1.14 remaps
    // those piles once into the matching placeholder without losing cards.
    const grouped = Object.fromEntries(SUITS.map(item => [item.key, []]));
    const source = Array.isArray(value) ? value.slice(0, 4) : [];
    source.flatMap(normalizePile).forEach(card => {
      if (grouped[card.suit]) grouped[card.suit].push({ ...card, faceUp: true });
    });
    return SUITS.map(suit => grouped[suit.key]
      .sort((left, right) => left.rank - right.rank)
      .filter((card, index) => card.rank === index + 1));
  }

  function normalizeGame(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.stock) || !Array.isArray(raw.tableaus)) return null;
    const normalized = {
      version: 3,
      stock: normalizePile(raw.stock),
      waste: normalizePile(raw.waste),
      foundations: normalizeFoundations(raw.foundations),
      tableaus: Array.isArray(raw.tableaus) ? raw.tableaus.slice(0, 7).map(normalizePile) : [],
      score: Number(raw.score) || 0,
      moves: Number(raw.moves) || 0,
      elapsed: Math.max(0, Number(raw.elapsed) || 0),
      startedAt: Date.now(),
      finished: Boolean(raw.finished),
      outcome: raw.outcome === "won" || raw.outcome === "lost" ? raw.outcome : null,
      drawCount: raw.drawCount === 3 ? 3 : 1
    };
    while (normalized.tableaus.length < 7) normalized.tableaus.push([]);
    return normalized;
  }

  function getElapsed() {
    if (!game) return 0;
    const stored = Math.max(0, Math.floor(Number(game.elapsed) || 0));
    if (game.finished) return stored;
    const startedAt = Number(game.startedAt) || 0;
    // startedAt === 0 means the active round is intentionally paused (menu/modal,
    // hidden tab or an external platform overlay). In that state elapsed is frozen.
    if (!startedAt) return stored;
    return stored + Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  }

  function isModalOpen() {
    return Boolean(app?.querySelector("#k-modal")?.classList.contains("open"));
  }

  function updateClockText() {
    const clock = app?.querySelector("#k-time");
    if (clock) clock.textContent = formatTime(getElapsed());
  }

  function pauseGameClock() {
    if (!game || game.finished) return;
    const startedAt = Number(game.startedAt) || 0;
    if (!startedAt) return;
    game.elapsed = getElapsed();
    game.startedAt = 0;
    updateClockText();
  }

  function resumeGameClock() {
    if (!game || game.finished) return;
    if (document.visibilityState === "hidden" || interactionLocked || isModalOpen()) return;
    if (!(Number(game.startedAt) > 0)) game.startedAt = Date.now();
    updateClockText();
  }

  // Важно: время нужно снять до выставления finished. Иначе getElapsed() вернёт
  // старое сохранённое значение (для новой партии обычно 00:00) и рекорд не запишется.
  function freezeGame(outcome) {
    if (!game) return 0;
    const elapsed = getElapsed();
    game.elapsed = elapsed;
    game.startedAt = 0;
    game.finished = true;
    game.outcome = outcome;
    return elapsed;
  }

  function snapshot() {
    return deepCopy({
      stock: game.stock,
      waste: game.waste,
      foundations: game.foundations,
      tableaus: game.tableaus,
      score: game.score,
      moves: game.moves,
      elapsed: getElapsed(),
      drawCount: game.drawCount,
      finished: game.finished,
      outcome: game.outcome
    });
  }

  function restoreSnapshot(data) {
    game.stock = normalizePile(data.stock);
    game.waste = normalizePile(data.waste);
    game.foundations = normalizeFoundations(data.foundations);
    game.tableaus = Array.isArray(data.tableaus) ? data.tableaus.slice(0, 7).map(normalizePile) : Array.from({ length: 7 }, () => []);
    while (game.tableaus.length < 7) game.tableaus.push([]);
    game.score = Number(data.score) || 0;
    game.moves = Number(data.moves) || 0;
    game.elapsed = Math.max(0, Number(data.elapsed) || 0);
    game.startedAt = Date.now();
    game.drawCount = data.drawCount === 3 ? 3 : 1;
    game.finished = Boolean(data.finished);
    game.outcome = data.outcome || null;
  }

  function pushHistory() {
    history.push(snapshot());
    if (history.length > CONFIG.maxUndo) history.shift();
  }

  function getTop(pile) {
    return pile?.length ? pile[pile.length - 1] : null;
  }

  function sameOrigin(first, second) {
    return first && second && first.zone === second.zone && first.pile === second.pile && first.index === second.index;
  }

  function getSourceCards(origin) {
    if (!origin || !game) return [];
    if (origin.zone === "tableau") {
      const pile = game.tableaus[origin.pile];
      if (!pile || origin.index < 0 || origin.index >= pile.length || !pile[origin.index].faceUp) return [];
      return pile.slice(origin.index);
    }
    if (origin.zone === "waste") {
      const card = getTop(game.waste);
      return card ? [card] : [];
    }
    if (origin.zone === "foundation") {
      const card = getTop(game.foundations[origin.pile]);
      return card ? [card] : [];
    }
    return [];
  }

  function removeSourceCards(origin, count) {
    if (origin.zone === "tableau") return game.tableaus[origin.pile].splice(origin.index, count);
    if (origin.zone === "waste") return game.waste.splice(game.waste.length - count, count);
    if (origin.zone === "foundation") return game.foundations[origin.pile].splice(game.foundations[origin.pile].length - count, count);
    return [];
  }

  function revealTopTableau(pileIndex) {
    const top = getTop(game.tableaus[pileIndex]);
    if (top && !top.faceUp) {
      top.faceUp = true;
      markCardEffect("flip", top);
      game.score += 5;
      return true;
    }
    return false;
  }

  function canPlaceOnTableau(card, destination) {
    const top = getTop(destination);
    if (!top) return card.rank === 13;
    return top.faceUp && card.rank === top.rank - 1 && cardColor(card) !== cardColor(top);
  }

  function canPlaceOnFoundation(card, foundation, foundationIndex) {
    if (!card || !Number.isInteger(foundationIndex)) return false;
    // Each of the four visible foundation placeholders owns exactly one suit.
    // Example: an Ace of hearts can only start the pile marked with a heart.
    if (SUITS[foundationIndex]?.key !== card.suit) return false;
    const top = getTop(foundation);
    if (!top) return card.rank === 1;
    return top.suit === card.suit && card.rank === top.rank + 1;
  }

  function isValidFaceUpRun(cards) {
    if (!cards.length || !cards[0].faceUp) return false;
    for (let index = 0; index < cards.length - 1; index++) {
      if (!cards[index].faceUp || !cards[index + 1].faceUp) return false;
      if (cards[index].rank !== cards[index + 1].rank + 1) return false;
      if (cardColor(cards[index]) === cardColor(cards[index + 1])) return false;
    }
    return true;
  }

  function sourceName(origin) {
    if (!origin) return t("sourceCard");
    if (origin.zone === "waste") return t("sourceWaste");
    if (origin.zone === "foundation") return t("sourceFoundation");
    return t("column", { column: origin.pile + 1 });
  }

  function foundationRanksBySuit() {
    const ranks = Object.fromEntries(SUITS.map(suit => [suit.key, 0]));
    game.foundations.forEach(pile => {
      const top = getTop(pile);
      if (top) ranks[top.suit] = top.rank;
    });
    return ranks;
  }

  // Не отправляем на базу любую первую попавшуюся карту: так игрок не застрянет,
  // когда нужная карта понадобится для чередования цветов в колонках.
  function isSafeFoundationMove(card) {
    if (!card || card.rank <= 2) return true;
    const ranks = foundationRanksBySuit();
    const oppositeSuits = SUITS.filter(suit => suit.color !== cardColor(card));
    return oppositeSuits.every(suit => (ranks[suit.key] || 0) >= card.rank - 1);
  }

  function exposesFaceDownCard(origin) {
    if (!origin || origin.zone !== "tableau") return false;
    const pile = game.tableaus[origin.pile] || [];
    return origin.index > 0 && !pile[origin.index - 1]?.faceUp;
  }

  function tableauTargetLabel(pileIndex) {
    const top = getTop(game.tableaus[pileIndex]);
    return top
      ? t("targetCard", { card: cardText(top), column: pileIndex + 1 })
      : t("targetEmpty", { column: pileIndex + 1 });
  }

  function cardsRunText(cards) {
    if (!cards?.length) return t("card");
    return cards.length === 1 ? cardText(cards[0]) : `${cardText(cards[0])}–${cardText(cards[cards.length - 1])}`;
  }

  function originKey(origin) {
    return `${origin?.zone || ""}:${origin?.pile ?? ""}:${origin?.index ?? ""}`;
  }

  function destinationKey(destination) {
    return `${destination?.zone || ""}:${destination?.pile ?? ""}`;
  }

  function getFoundationDestination(card) {
    if (!card) return -1;
    const index = foundationIndexForSuit(card.suit);
    if (index < 0) return -1;
    return canPlaceOnFoundation(card, game.foundations[index], index) ? index : -1;
  }

  function hasTableauDestination(card, excludedPile = -1) {
    if (!card) return false;
    return game.tableaus.some((pile, pileIndex) => pileIndex !== excludedPile && canPlaceOnTableau(card, pile));
  }

  function topWasteWouldBecomeUseful() {
    const next = game.waste[game.waste.length - 2];
    if (!next) return false;
    return getFoundationDestination(next) >= 0 || hasTableauDestination(next);
  }

  function previewStockCard() {
    if (!game?.stock?.length) return null;
    const amount = Math.min(game.drawCount, game.stock.length);
    return game.stock[game.stock.length - amount] || null;
  }

  function previewStockHasMove() {
    const card = previewStockCard();
    return Boolean(card && (getFoundationDestination(card) >= 0 || hasTableauDestination(card)));
  }

  function allTableauCardsFaceUp() {
    return game.tableaus.every(pile => pile.every(card => card.faceUp));
  }

  function makeMove(origin, destination) {
    if (interactionLocked || viewportReflowing || !game || game.finished || !origin || !destination) return false;
    const cards = getSourceCards(origin);
    if (!cards.length || !isValidFaceUpRun(cards)) return false;

    if (destination.zone === "tableau") {
      if (origin.zone === "tableau" && origin.pile === destination.pile) return false;
      if (!canPlaceOnTableau(cards[0], game.tableaus[destination.pile])) return false;
      pushHistory();
      queueMoveFlight(cards);
      const moved = removeSourceCards(origin, cards.length);
      game.tableaus[destination.pile].push(...moved);
      if (origin.zone === "tableau") revealTopTableau(origin.pile);
      game.moves++;
      if (origin.zone === "waste") game.score += 5;
      selection = null;
      afterGameChange();
      return true;
    }

    if (destination.zone === "foundation") {
      if (cards.length !== 1) return false;
      if (!canPlaceOnFoundation(cards[0], game.foundations[destination.pile], destination.pile)) return false;
      pushHistory();
      queueMoveFlight(cards);
      const moved = removeSourceCards(origin, 1)[0];
      game.foundations[destination.pile].push(moved);
      if (origin.zone === "tableau") revealTopTableau(origin.pile);
      game.moves++;
      game.score += origin.zone === "foundation" ? -15 : 10;
      selection = null;
      afterGameChange();
      return true;
    }

    return false;
  }

  function autoMove(origin, quiet = false) {
    const cards = getSourceCards(origin);
    if (cards.length !== 1 || !cards[0].faceUp) return false;
    for (let pile = 0; pile < 4; pile++) {
      if (canPlaceOnFoundation(cards[0], game.foundations[pile], pile)) {
        const moved = makeMove(origin, { zone: "foundation", pile });
        if (moved && !quiet) toast(t("movedFoundation"));
        return moved;
      }
    }
    return false;
  }

  function drawFromStock() {
    if (interactionLocked || viewportReflowing || !game || game.finished) return;

    clearHintMarks();
    clearSelectionVisual();

    // Строгая транзакция Draw 1 / Draw 3. splice + reverse сохраняет тот же порядок,
    // что и последовательные pop(), но не создаёт промежуточных перерисовок и меньше
    // нагружает слабые мобильные устройства.
    if (game.stock.length > 0) {
      pushHistory();
      const drawCount = game.drawCount === 3 ? 3 : 1;
      const amount = Math.min(drawCount, game.stock.length);
      const stockBefore = game.stock.length;
      const drawn = game.stock.splice(Math.max(0, stockBefore - amount), amount).reverse();

      if (drawn.length !== amount || game.stock.length !== stockBefore - amount) {
        console.warn("[Kosynka] Некорректная сдача колоды, ход отменён");
        restoreSnapshot(history.pop());
        render();
        return;
      }

      drawn.forEach(card => { card.faceUp = true; });
      game.waste.push(...drawn);
      markCardEffect("draw", drawn);
      game.moves++;

      // Взятие карты не меняет стол, базы или размеры раскладки. Рисуем только HUD,
      // левую колоду и сброс: это исключает повторную раздачу и убирает микрофризы.
      renderStockChange();
      scheduleSave();
      return;
    }

    // Пересдача доступна только после полного опустошения левой колоды.
    if (game.waste.length > 0) {
      pushHistory();
      game.stock = game.waste.splice(0).reverse().map(card => ({ ...card, faceUp: false }));
      game.moves++;
      game.score = Math.max(0, game.score - (game.drawCount === 1 ? 100 : 20));
      toast(t("stockRecycled"));
      renderStockChange();
      scheduleSave();
    }
  }

  function flipTableauCard(pileIndex) {
    const top = getTop(game.tableaus[pileIndex]);
    if (!top || top.faceUp || game.finished) return false;
    pushHistory();
    top.faceUp = true;
    markCardEffect("flip", top);
    game.score += 5;
    game.moves++;
    selection = null;
    afterGameChange();
    return true;
  }

  function findHintCandidates() {
    const candidates = [];
    const seen = new Set();
    const add = candidate => {
      if (!candidate) return;
      const key = candidate.key || `${candidate.kind}:${originKey(candidate.origin)}>${destinationKey(candidate.destination)}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({ ...candidate, key });
    };

    // Build the complete list of movable face-up tableau runs once. This list is also
    // used by the coverage guard at the end, so every legal tableau move is represented.
    const tableauOrigins = [];
    for (let pile = 0; pile < 7; pile++) {
      const tableau = game.tableaus[pile];
      tableau.forEach((card, index) => {
        if (!card.faceUp) return;
        const origin = { zone: "tableau", pile, index };
        const cards = getSourceCards(origin);
        if (cards.length && isValidFaceUpRun(cards)) tableauOrigins.push({ origin, cards });
      });
    }

    // Turning an exposed face-down card is always the highest-value hint: it reveals
    // new information and cannot make the position worse.
    for (let pile = 0; pile < 7; pile++) {
      const top = getTop(game.tableaus[pile]);
      if (top && !top.faceUp) {
        add({ kind: "flip", pile, priority: 16000, key: `flip:${pile}`, message: t("hintFlip", { column: pile + 1 }) });
      }
    }

    // All legal tableau -> tableau moves, including King runs into empty columns.
    // Earlier versions intentionally omitted some non-revealing King-to-space moves;
    // that made the hint system incomplete in edge positions.
    for (const { origin, cards } of tableauOrigins) {
      for (let pile = 0; pile < 7; pile++) {
        if (pile === origin.pile || !canPlaceOnTableau(cards[0], game.tableaus[pile])) continue;
        const opensHidden = exposesFaceDownCard(origin);
        const targetTop = getTop(game.tableaus[pile]);
        const isEmptyKingMove = !targetTop && cards[0].rank === 13;
        const movesWholePile = origin.index === 0;
        let priority;
        let message;
        if (opensHidden) {
          priority = 15100 + Math.min(60, cards.length * 8);
          message = t("hintBest", { cards: cardsRunText(cards), target: tableauTargetLabel(pile) });
        } else if (isEmptyKingMove) {
          // Moving an entire King pile from one empty-capable column to another is legal
          // but usually does not progress the game, so keep it as a last-resort hint.
          priority = movesWholePile ? 4300 : 8350;
          message = t("hintSequence", { cards: cardsRunText(cards), target: tableauTargetLabel(pile) });
        } else {
          priority = 10100 + Math.min(120, cards.length * 10);
          message = t("hintSequence", { cards: cardsRunText(cards), target: tableauTargetLabel(pile) });
        }
        add({ kind: "move", origin, destination: { zone: "tableau", pile }, priority, message });
      }
    }

    const wasteTop = getTop(game.waste);

    // Waste -> tableau. Playing the waste is valuable because it exposes another stock
    // card; if that next card is immediately playable, raise the priority further.
    if (wasteTop) {
      for (let pile = 0; pile < 7; pile++) {
        if (!canPlaceOnTableau(wasteTop, game.tableaus[pile])) continue;
        const freesUsefulWaste = topWasteWouldBecomeUseful();
        add({
          kind: "move",
          origin: { zone: "waste", pile: 0 },
          destination: { zone: "tableau", pile },
          priority: freesUsefulWaste ? 13750 : 11450,
          message: freesUsefulWaste
            ? t("hintWasteFree", { card: cardText(wasteTop), target: tableauTargetLabel(pile) })
            : t("hintWaste", { card: cardText(wasteTop), target: tableauTargetLabel(pile) })
        });
      }
    }

    // Waste/tableau -> foundation. Safe moves outrank blind stock cycling, while risky
    // foundation moves remain available as hints instead of being hidden forever.
    const foundationOrigins = [];
    if (wasteTop) foundationOrigins.push({ origin: { zone: "waste", pile: 0 }, card: wasteTop });
    for (let pile = 0; pile < 7; pile++) {
      const top = getTop(game.tableaus[pile]);
      if (top?.faceUp) foundationOrigins.push({ origin: { zone: "tableau", pile, index: game.tableaus[pile].length - 1 }, card: top });
    }
    for (const { origin, card } of foundationOrigins) {
      const pile = getFoundationDestination(card);
      if (pile < 0) continue;
      const opensHidden = exposesFaceDownCard(origin);
      const safe = isSafeFoundationMove(card);
      const freesWaste = origin.zone === "waste" && topWasteWouldBecomeUseful();
      if (opensHidden) {
        add({
          kind: "move",
          origin,
          destination: { zone: "foundation", pile },
          priority: 14950,
          message: t("hintFoundationReveal", { card: cardText(card) })
        });
      } else if (safe) {
        add({
          kind: "move",
          origin,
          destination: { zone: "foundation", pile },
          priority: 12100 + (freesWaste ? 850 : 0),
          message: freesWaste
            ? t("hintFoundationSafeWaste", { card: cardText(card) })
            : t("hintFoundationSafe", { card: cardText(card) })
        });
      } else {
        add({
          kind: "move",
          origin,
          destination: { zone: "foundation", pile },
          priority: 8750,
          message: t("hintFoundationRisk", { card: cardText(card) })
        });
      }
    }

    // A foundation card sometimes has to be worried back to the tableau. Previously
    // this hint had lower priority than an endlessly recyclable stock, so it could never
    // surface. Detect a useful two-step unlock and promote it above stock cycling.
    const foundationBackUnlocksProgress = (card, targetPile) => {
      const virtualTarget = [card];
      if (wasteTop && canPlaceOnTableau(wasteTop, virtualTarget)) return true;
      for (const { origin, cards } of tableauOrigins) {
        if (origin.pile === targetPile || !cards.length) continue;
        if (canPlaceOnTableau(cards[0], virtualTarget) && exposesFaceDownCard(origin)) return true;
      }
      return false;
    };

    for (let from = 0; from < 4; from++) {
      const card = getTop(game.foundations[from]);
      if (!card) continue;
      for (let pile = 0; pile < 7; pile++) {
        if (!canPlaceOnTableau(card, game.tableaus[pile])) continue;
        const unlocksProgress = foundationBackUnlocksProgress(card, pile);
        add({
          kind: "move",
          origin: { zone: "foundation", pile: from },
          destination: { zone: "tableau", pile },
          priority: unlocksProgress ? 10900 : 3700,
          message: t("hintFoundationBack", { card: cardText(card), target: tableauTargetLabel(pile) })
        });
      }
    }

    // Stock actions come after concrete productive moves. This prevents the hint from
    // telling the player to draw/recycle forever while a legal useful move already exists.
    if (game.stock.length) {
      add({
        kind: "stock",
        priority: previewStockHasMove() ? 9050 : 7600,
        key: "stock",
        message: previewStockHasMove() ? t("hintStockMove") : t("hintStock")
      });
    } else if (game.waste.length) {
      add({ kind: "recycle", priority: 7100, key: "recycle", message: t("hintRecycle") });
    }

    // Coverage guard: enumerate every move accepted by makeMove() and add a low-priority
    // fallback if a future heuristic branch forgets it. This makes the Hint button complete
    // for the current rule set: tableau, waste, foundations, spaces and worrying-back.
    for (const { origin, cards } of tableauOrigins) {
      for (let pile = 0; pile < 7; pile++) {
        if (pile === origin.pile || !canPlaceOnTableau(cards[0], game.tableaus[pile])) continue;
        add({
          kind: "move",
          origin,
          destination: { zone: "tableau", pile },
          priority: 1200,
          message: t("hintSequence", { cards: cardsRunText(cards), target: tableauTargetLabel(pile) })
        });
      }
      if (cards.length === 1) {
        const pile = getFoundationDestination(cards[0]);
        if (pile >= 0) add({
          kind: "move",
          origin,
          destination: { zone: "foundation", pile },
          priority: 1100,
          message: t("hintFoundationRisk", { card: cardText(cards[0]) })
        });
      }
    }

    if (wasteTop) {
      const foundationPile = getFoundationDestination(wasteTop);
      if (foundationPile >= 0) add({
        kind: "move",
        origin: { zone: "waste", pile: 0 },
        destination: { zone: "foundation", pile: foundationPile },
        priority: 1100,
        message: t("hintFoundationRisk", { card: cardText(wasteTop) })
      });
      for (let pile = 0; pile < 7; pile++) {
        if (!canPlaceOnTableau(wasteTop, game.tableaus[pile])) continue;
        add({
          kind: "move",
          origin: { zone: "waste", pile: 0 },
          destination: { zone: "tableau", pile },
          priority: 1100,
          message: t("hintWaste", { card: cardText(wasteTop), target: tableauTargetLabel(pile) })
        });
      }
    }

    for (let from = 0; from < 4; from++) {
      const card = getTop(game.foundations[from]);
      if (!card) continue;
      for (let pile = 0; pile < 7; pile++) {
        if (!canPlaceOnTableau(card, game.tableaus[pile])) continue;
        add({
          kind: "move",
          origin: { zone: "foundation", pile: from },
          destination: { zone: "tableau", pile },
          priority: 1000,
          message: t("hintFoundationBack", { card: cardText(card), target: tableauTargetLabel(pile) })
        });
      }
    }

    return candidates.sort((first, second) => second.priority - first.priority || first.key.localeCompare(second.key));
  }

  function findHint() {
    return findHintCandidates()[0] || null;
  }

  function selectorForOrigin(origin) {
    if (origin.zone === "waste") return `[data-zone="waste"] .card:last-child`;
    if (origin.zone === "foundation") return `[data-zone="foundation"][data-pile="${origin.pile}"] .card:last-child`;
    return `[data-zone="tableau"][data-pile="${origin.pile}"] .card[data-index="${origin.index}"]`;
  }

  function clearHintMarks() {
    app?.querySelectorAll(".hint-source,.hint-target").forEach(node => node.classList.remove("hint-source", "hint-target"));
  }

  // При взятии карты из левой колоды таблица больше не перерисовывается целиком.
  // Поэтому убираем визуальное выделение напрямую, а не полагаемся на полный render().
  function refreshTapTargets(origin = null) {
    // Tap-to-move stays enabled, but selecting a card must not reveal valid destinations.
    // The dedicated Hint button is the only mechanic that highlights recommended/available moves.
    if (!app) return;
    app.querySelectorAll(".tap-target").forEach(node => node.classList.remove("tap-target"));
  }

  function setSelectionVisual(origin = null) {
    selection = origin;
    app?.querySelectorAll(".selected").forEach(node => node.classList.remove("selected"));
    refreshTapTargets(origin);
    if (!origin) return;
    app?.querySelector(selectorForOrigin(origin))?.classList.add("selected");
  }

  function clearSelectionVisual() {
    setSelectionVisual(null);
  }

  function pulse(selector) {
    const node = app?.querySelector(selector);
    if (!node) return;
    node.classList.add("pulse");
    setTimeout(() => node.classList.remove("pulse"), 780);
  }

  function showHintRefillModal() {
    const balance = getHintBalance();
    const amount = CONFIG.hintRewardAmount;
    const cap = CONFIG.hintBalanceCap;
    const atCap = balance >= cap;
    const copy = atCap
      ? t("hintsCap", { cap })
      : balance > 0
        ? t("hintsAvailable", { balance, cap })
        : t("hintsEmpty", { amount });
    showModal(t("hintsTitle"), `
      <p class="modal-lead">${copy}</p>
      <div class="reward-note"><span class="reward-note-icon">${uiIcon("info")}</span><span>${t("hintsInfo")}</span></div>
      <button class="modal-btn accent full reward-text-action" data-action="reward-hints" ${atCap ? "disabled" : ""}><span>${t("watchAdPlus", { amount })}</span></button>
      <button class="modal-btn secondary full" data-action="close-modal">${balance > 0 ? t("backToGame") : t("notNow")}</button>
    `);
  }

  async function rewardHints() {
    if (!profile || interactionLocked) return;
    const current = getHintBalance();
    if (current >= CONFIG.hintBalanceCap) {
      toast(t("hintsEnough"));
      return;
    }
    toast(t("openingAd"));
    const rewarded = await runExternalInteraction(
      () => platform.showRewarded("hints_refill", t("watchAdPlus", { amount: CONFIG.hintRewardAmount })),
      false
    );
    if (!rewarded) {
      toast(t("adNoReward"));
      return;
    }
    const before = getHintBalance();
    const after = setHintBalance(before + CONFIG.hintRewardAmount);
    const received = after - before;
    renderHud();
    scheduleSave();
    closeModal(true);
    toast(t("hintsReceived", { amount: received }));
  }

  function showHint() {
    if (interactionLocked || viewportReflowing || !game || game.finished) return;
    clearHintMarks();
    const hint = findHint();
    if (!hint) {
      toast(t("hintNone"));
      return;
    }
    if (getHintBalance() <= 0) {
      showHintRefillModal();
      return;
    }

    // Списываем только за действительно показанный практический ход. Если ходов нет,
    // игрок не теряет подсказку и не получает навязчивое предложение рекламы.
    setHintBalance(getHintBalance() - 1);
    profile.hintCount = (profile.hintCount || 0) + 1;
    clearSelectionVisual();
    renderHud();
    if (hint.kind === "flip") {
      const pile = app.querySelector(`[data-zone="tableau"][data-pile="${hint.pile}"]`);
      pile?.classList.add("hint-target");
      toast(hint.message);
      scheduleSave();
      return;
    }
    if (hint.kind === "stock" || hint.kind === "recycle") {
      const stock = app.querySelector("#k-stock .pile");
      stock?.classList.add("hint-target");
      toast(hint.message);
      scheduleSave();
      return;
    }
    const source = app.querySelector(selectorForOrigin(hint.origin));
    const target = app.querySelector(`[data-zone="${hint.destination.zone}"][data-pile="${hint.destination.pile}"]`);
    source?.classList.add("hint-source");
    target?.classList.add("hint-target");
    toast(hint.message);
    scheduleSave();
  }

  function undo() {
    if (interactionLocked || !history.length) {
      toast(t("noUndo"));
      return;
    }
    clearDragVisual();
    restoreSnapshot(history.pop());
    selection = null;
    toast(t("undoDone"));
    afterGameChange(false);
  }

  async function startFreshGame() {
    if (interactionLocked || !profile) return;
    // Abandoning an already started, unfinished deal breaks a consecutive-win streak.
    // Starting the next deal from a finished win does not.
    const abandonsUnfinishedGame = Boolean(game && !game.finished && hasSavedGame);
    // Fullscreen is requested only at this logical break. The 180-second session gate prevents an ad on an early New game press.
    // The timer starts after startup/preloader and is never restored from an old save.
    await runExternalInteraction(() => maybeShowInterstitial("new_game"), false);
    clearDragVisual();
    if (abandonsUnfinishedGame) profile.winStreak = 0;
    game = newGameState();
    markCardEffect("deal", game.tableaus.flat());
    profile.games = (profile.games || 0) + 1;
    refreshProgression();
    history = [];
    selection = null;
    hasSavedGame = true;
    closeModal(true);
    afterGameChange();
    toast(t("newGameStarted"));
  }

  function askToEndGame() {
    if (!game || game.finished) return;
    showModal(t("endTitle"), `
      <p class="modal-lead">${t("endCopy")}</p>
      <div class="modal-grid">
        <button class="modal-btn warning" data-action="confirm-end">${t("end")}</button>
        <button class="modal-btn secondary" data-action="close-modal">${t("continueGame")}</button>
      </div>
    `);
  }

  function endGame() {
    if (!game || game.finished) return;
    freezeGame("lost");
    profile.winStreak = 0;
    refreshProgression();
    selection = null;
    closeModal(true);
    render();
    // Финальный результат пишется сразу: игрок может закрыть приложение прямо из окна результата.
    void saveNow();
    showResultModal(false);
  }

  function checkWin() {
    if (!game || game.finished) return false;
    const count = game.foundations.reduce((sum, pile) => sum + pile.length, 0);
    if (count !== 52) return false;

    const finalSeconds = freezeGame("won");
    profile.wins = (profile.wins || 0) + 1;
    profile.winStreak = (profile.winStreak || 0) + 1;
    profile.bestScore = Math.max(profile.bestScore || 0, game.score || 0);
    if (!profile.bestWinSeconds || finalSeconds < profile.bestWinSeconds) profile.bestWinSeconds = finalSeconds;
    const progression = refreshProgression();
    render();
    // Записываем сразу и в local storage, и в адаптер площадки; delayed save здесь недостаточен.
    void saveNow();
    setTimeout(() => {
      showResultModal(true, progression);
    }, 240);
    return true;
  }

  function findAutoFoundationMove() {
    if (!game || game.finished) return null;
    const noHiddenCards = allTableauCardsFaceUp();
    const candidates = [];
    const add = (origin, card) => {
      const pile = getFoundationDestination(card);
      if (pile < 0) return;
      const opensHidden = exposesFaceDownCard(origin);
      // До открытия всех рубашек автосбор берёт только безопасные карты или ход,
      // который немедленно открывает новую карту. Ручной двойной клик остаётся свободным.
      if (!noHiddenCards && !opensHidden && !isSafeFoundationMove(card)) return;
      candidates.push({ origin, destination: { zone: "foundation", pile }, opensHidden, safe: isSafeFoundationMove(card), rank: card.rank });
    };
    const waste = getTop(game.waste);
    if (waste) add({ zone: "waste", pile: 0 }, waste);
    for (let pile = 0; pile < 7; pile++) {
      const card = getTop(game.tableaus[pile]);
      if (card?.faceUp) add({ zone: "tableau", pile, index: game.tableaus[pile].length - 1 }, card);
    }
    candidates.sort((a, b) => Number(b.opensHidden) - Number(a.opensHidden) || Number(b.safe) - Number(a.safe) || a.rank - b.rank);
    return candidates[0] || null;
  }

  async function autoFinish() {
    if (!game || game.finished || interactionLocked) return;
    let movedAny = false;
    let guard = 0;
    interactionLocked = true;
    try {
      while (guard < 160 && !game.finished) {
        const move = findAutoFoundationMove();
        if (!move) break;
        // Unlock only for the internal move itself; player input remains locked between animated steps.
        // Wait for each exact card to finish its flight before starting the next auto-finish move.
        // Overlapping flights could replace hidden foundation targets and make collected cards vanish temporarily.
        const movingCardId = getSourceCards(move.origin)[0]?.id || "";
        interactionLocked = false;
        const moved = makeMove(move.origin, move.destination);
        interactionLocked = true;
        if (!moved) break;
        movedAny = true;
        guard++;
        await waitForCardFlight(movingCardId);
        await sleep(28);
      }
    } finally {
      interactionLocked = false;
    }
    if (!movedAny && !game.finished) {
      toast(allTableauCardsFaceUp()
        ? t("autoNoneOpen")
        : t("autoNoneClosed"));
    }
  }

  function buildPayload() {
    const savedGame = deepCopy(game);
    savedGame.elapsed = getElapsed();
    savedGame.startedAt = 0;
    return {
      schema: 3,
      savedAt: Date.now(),
      game: savedGame,
      profile: deepCopy(profile)
    };
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(), 260);
  }

  async function saveNow() {
    if (!game || !profile) return;
    const payload = buildPayload();
    localWrite(payload);
    await platform.save(payload);
  }

  function armInterstitialTimer() {
    nextInterstitialEligibleAt = Date.now() + CONFIG.interstitialCooldownMs;
  }

  async function maybeShowInterstitial(placement) {
    if (!profile || profile.noAds || interstitialAttemptInFlight) return false;
    const now = Date.now();
    if (now < nextInterstitialEligibleAt) return false;

    interstitialAttemptInFlight = true;
    try {
      const shown = await platform.showInterstitial(`solitaire_${placement}`);
      if (shown) {
        // Start the next 180-second cycle only after a fullscreen was actually shown.
        armInterstitialTimer();
        profile.lastInterstitialAt = Date.now();
        scheduleSave();
      }
      return Boolean(shown);
    } finally {
      interstitialAttemptInFlight = false;
    }
  }

  function afterGameChange(save = true) {
    if (!game) return;
    const won = checkWin();
    if (!won) render();
    if (save) scheduleSave();
  }

  function progressSummaryHtml() {
    const bestTime = profile?.bestWinSeconds ? formatTime(profile.bestWinSeconds) : "—";
    return `<div class="progress-summary">
      <span>${t("wins", { count: profile?.wins || 0 })}</span>
      <span>${t("streak", { count: profile?.winStreak || 0 })}</span>
      <span>${t("record", { count: profile?.bestScore || 0 })}</span>
      <span>${t("bestTime", { time: bestTime })}</span>
      <span>${t("hintsStat", { count: getHintBalance() })}</span>
    </div>`;
  }

  function showMainMenu() {
    clearDragVisual();
    const canContinue = hasSavedGame && game && !game.finished;
    showModal(t("brand"), `
      <div class="menu-hero"><span class="menu-card">${uiIcon("spade", "menu-spade")}</span><p>${t("menuIntro")}</p></div>
      ${progressSummaryHtml()}
      <div class="menu-actions">
        ${canContinue ? `<button class="modal-btn accent full" data-action="continue-game">${uiIcon("play", "button-icon")}<span>${t("continueGame")}</span></button>` : `<button class="modal-btn accent full" data-action="new-game">${uiIcon("play", "button-icon")}<span>${t("startGame")}</span></button>`}
        ${canContinue ? `<button class="modal-btn full" data-action="new-game">${uiIcon("plus", "button-icon")}<span>${t("newGame")}</span></button>` : ""}
        <div class="modal-grid menu-grid">
          <button class="modal-btn secondary" data-action="store">${uiIcon("cards", "button-icon")}<span>${t("store")}</span></button>
          <button class="modal-btn secondary" data-action="achievements">${uiIcon("trophy", "button-icon")}<span>${t("achievements")} ${achievementCount()}/${ACHIEVEMENTS.length}</span></button>
          ${platform.canOpenLeaderboard() ? `<button class="modal-btn secondary" data-action="leaderboard" title="${escapeHtml(t("leaderboardInfo"))}">${uiIcon("ranking", "button-icon")}<span>${t("leaderboard")}</span></button>` : ""}
          <button class="modal-btn secondary" data-action="how-to">${uiIcon("help", "button-icon")}<span>${t("howTo")}</span></button>
          <button class="modal-btn secondary" data-action="settings">${uiIcon("settings", "button-icon")}<span>${t("settings")}</span></button>
        </div>
      </div>
    `, true);
  }

  function leaderboardWinsFromPlayer(player) {
    if (!player || typeof player !== "object") return 0;
    const field = CONFIG.gamePushWinsField;
    const value = player[field] ?? player.fields?.[field] ?? player.data?.[field] ?? 0;
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  function leaderboardRowsHtml(result) {
    // Players with zero wins are not participants in the visible rating.
    // Filter before applying the Top-10 limit so an appended "me" row with 0 wins is never shown.
    const rows = (Array.isArray(result?.players) ? result.players : [])
      .filter(player => leaderboardWinsFromPlayer(player) > 0);
    if (!rows.length) return `<div class="achievement-row"><div><strong>${escapeHtml(t("leaderboardUnavailable"))}</strong></div></div>`;
    return rows.slice(0, CONFIG.leaderboardLimit).map((player, index) => {
      const position = Math.max(1, Math.floor(Number(player?.position) || index + 1));
      const name = String(player?.name || `#${position}`);
      const wins = leaderboardWinsFromPlayer(player);
      return `<div class="achievement-row"><span class="achievement-mark">${position}</span><div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(t("leaderboardWins"))}: <b>${wins}</b></small></div></div>`;
    }).join("");
  }

  async function openLeaderboard() {
    if (interactionLocked) return;
    // Open our modal immediately so the button always reacts, even if the platform request is slow.
    showModal(t("leaderboard"), `
      <p class="modal-lead">${t("leaderboardInfo")}</p>
      <div id="k-leaderboard-content" class="achievement-list">
        <div class="achievement-row"><div><strong>…</strong></div></div>
      </div>
      <button class="modal-btn secondary full" data-action="menu">${t("backMenu")}</button>
    `, true);

    if (!platform.canOpenLeaderboard()) {
      const content = app?.querySelector("#k-leaderboard-content");
      if (content) content.innerHTML = `<div class="achievement-row"><div><strong>${escapeHtml(t("leaderboardUnavailable"))}</strong></div></div>`;
      return;
    }

    let timer = 0;
    try {
      const timeout = new Promise(resolve => {
        timer = window.setTimeout(() => resolve(null), 8000);
      });
      const result = await Promise.race([platform.fetchWinsLeaderboard(), timeout]);
      const content = app?.querySelector("#k-leaderboard-content");
      if (!content) return;
      content.innerHTML = result
        ? leaderboardRowsHtml(result)
        : `<div class="achievement-row"><div><strong>${escapeHtml(t("leaderboardUnavailable"))}</strong></div></div>`;
    } catch (error) {
      console.warn("[Kosynka] Leaderboard render failed", error);
      const content = app?.querySelector("#k-leaderboard-content");
      if (content) content.innerHTML = `<div class="achievement-row"><div><strong>${escapeHtml(t("leaderboardUnavailable"))}</strong></div></div>`;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function showAchievements() {
    refreshProgression();
    const owned = new Set(profile.achievements || []);
    const rows = ACHIEVEMENTS.map(item => {
      const done = owned.has(item.id);
      return `<div class="achievement-row ${done ? "done" : ""}"><span class="achievement-mark">${uiIcon(done ? "check" : "lock", "achievement-icon")}</span><div><strong>${escapeHtml(achievementTitle(item))}</strong><small>${escapeHtml(achievementDescription(item))}</small></div></div>`;
    }).join("");
    showModal(t("achievements"), `
      <p class="modal-lead">${t("achievementsOpen", { count: achievementCount(), total: ACHIEVEMENTS.length })}</p>
      <div class="achievement-list">${rows}</div>
      <button class="modal-btn secondary full" data-action="menu">${t("backMenu")}</button>
    `);
  }

  function continueGame() {
    clearDragVisual();
    selection = null;
    closeModal(true);
    render();
    scheduleSave();
    toast(t("gameContinued"));
  }

  function deckPreviewVars(theme) {
    // Значения берутся из той же палитры, что и игра, поэтому витрина не может
    // показать устаревший или «чужой» цвет колоды.
    return [
      `--deck-table-a:${theme.tableA}`,
      `--deck-table-b:${theme.tableB}`,
      `--deck-accent:${theme.accent}`,
      `--deck-back-a:${theme.backA}`,
      `--deck-back-b:${theme.backB}`,
      `--deck-front-a:${theme.frontA}`,
      `--deck-front-b:${theme.frontB}`
    ].join(";");
  }

  function deckPreviewHtml(deck, id) {
    const title = escapeHtml(deckTitle(id));
    return `<div class="deck-preview" style="${deckPreviewVars(deck.theme)}" role="img" aria-label="${title}">
      <span class="deck-preview-glow"></span>
      <span class="deck-mini-card deck-mini-back"><span class="deck-mini-pattern"></span></span>
      <span class="deck-mini-card deck-mini-face"><span class="deck-mini-rank">A</span>${uiIcon("spade", "deck-mini-suit")}</span>
      <span class="deck-preview-accent"></span>
    </div>`;
  }

  function storeDeckAccess(deck) {
    const access = deckAccessKind(deck);
    // Playgama has no purchase flow: every otherwise paid deck is a rewarded unlock there.
    return platform.kind === "playgama" && access === "purchase" ? "reward" : access;
  }

  function purchaseLabel(productTag) {
    const price = platform.getProductPriceHtml(productTag);
    return price ? `<span class="purchase-cta"><span class="purchase-verb">${escapeHtml(t("buy"))}</span>${price}</span>` : escapeHtml(t("buy"));
  }

  function deckDescription(id, deck, isOwned) {
    if (isOwned) return t("deckUnlocked");
    const access = storeDeckAccess(deck);
    if (access === "reward") return t("deckWatchAdHint");
    if (access === "achievement") return achievementDeckRequirement(deck);
    if (access === "starter") return t("deckStarter");
    return t("deckPremium");
  }

  function deckTile(id) {
    const deck = DECKS[id];
    const isOwned = profile.unlockedSkins.includes(id);
    const isActive = profile.skin === id;
    const access = storeDeckAccess(deck);
    const productTag = deck?.product ? CONFIG.products[deck.product] : "";
    let action = "";
    if (isActive) action = `<button class="deck-action muted" disabled>${t("deckSelected")}</button>`;
    else if (isOwned) action = `<button class="deck-action" data-action="select-skin" data-skin="${id}">${t("deckChoose")}</button>`;
    else if (access === "reward") action = `<button class="deck-action reward-text-action" data-action="reward-skin" data-skin="${id}">${t("deckWatchAd")}</button>`;
    else if (access === "achievement") action = `<button class="deck-action muted" disabled>${escapeHtml(achievementDeckRequirement(deck))}</button>`;
    else action = `<button class="deck-action purchase-action" data-action="buy-skin" data-skin="${id}">${purchaseLabel(productTag)}</button>`;
    const displayTitle = access === "purchase" ? platform.getProductName(productTag, deckTitle(id)) : deckTitle(id);
    return `<article class="deck-tile deck-${id}${isActive ? " is-active" : ""}">
      ${deckPreviewHtml(deck, id)}
      <div class="deck-copy"><strong>${escapeHtml(displayTitle)}</strong><small>${escapeHtml(deckDescription(id, deck, isOwned))}</small></div>
      ${action}
    </article>`;
  }

  function openStore(tab = shopTab) {
    const rewardBase = ["classic", "aurora", "sakura", "ocean", "neon"];
    const paid = ["royal", "noir", "ruby", "gold", "cosmos"];
    const achievement = ["champion", "veteran"];
    const rewardIds = platform.kind === "playgama" ? [...rewardBase, ...paid] : rewardBase;
    const allowedTabs = platform.kind === "playgama" ? ["reward", "achievement"] : ["reward", "achievement", "purchase"];
    shopTab = allowedTabs.includes(tab) ? tab : "reward";
    const ids = shopTab === "reward" ? rewardIds : shopTab === "achievement" ? achievement : paid;
    const tiles = ids.map(deckTile).join("");
    const noAdsProductName = platform.getProductName(CONFIG.products.removeAds, t("noAds"));
    const noAds = shopTab === "purchase"
      ? `<article class="deck-tile deck-noads"><div class="deck-preview noads">${uiIcon("noads", "deck-noads-icon")}</div><div class="deck-copy"><strong>${escapeHtml(noAdsProductName)}</strong><small>${t("noAdsDesc")}</small></div>${profile.noAds ? `<button class="deck-action muted" disabled>${t("bought")}</button>` : `<button class="deck-action purchase-action noads-purchase-action" data-action="buy-noads">${purchaseLabel(CONFIG.products.removeAds)}</button>`}</article>`
      : "";
    showModal(t("store"), `
      <div class="shop-tabs">
        <button class="shop-tab ${shopTab === "reward" ? "active" : ""}" data-action="shop-tab" data-tab="reward">${t("storeVideo")}</button>
        <button class="shop-tab ${shopTab === "achievement" ? "active" : ""}" data-action="shop-tab" data-tab="achievement">${t("storeAchievements")}</button>
        ${platform.kind === "playgama" ? "" : `<button class="shop-tab ${shopTab === "purchase" ? "active" : ""}" data-action="shop-tab" data-tab="purchase">${t("storePurchases")}</button>`}
      </div>
      <div class="deck-grid">${tiles}${noAds}</div>
      <button class="modal-btn secondary full" data-action="menu">${t("backMenu")}</button>
    `);
  }

  async function rewardSkin(id) {
    const deck = DECKS[id];
    if (!deck || storeDeckAccess(deck) !== "reward") return;
    toast(t("openingAd"));
    const rewarded = await runExternalInteraction(() => platform.showRewarded(`deck_${id}`, t("deckWatchAd")), false);
    if (!rewarded) {
      toast(t("rewardNotReceived"));
      return;
    }
    if (!profile.unlockedSkins.includes(id)) profile.unlockedSkins.push(id);
    profile.skin = id;
    applySkin();
    refreshProgression();
    scheduleSave();
    openStore("reward");
    toast(t("deckOpened", { title: deckTitle(id) }));
  }

  function showPurchaseLogin(purchaseKind, skinId = "") {
    const safeKind = purchaseKind === "noads" ? "noads" : "skin";
    const safeSkin = safeKind === "skin" && DECKS[skinId] ? skinId : "";
    showModal(t("purchaseLoginTitle"), `
      <p class="modal-lead">${escapeHtml(t("purchaseLoginCopy"))}</p>
      <div class="reward-note"><span class="reward-note-icon">${uiIcon("info")}</span><span>${escapeHtml(t("purchaseLoginRestore"))}</span></div>
      <button class="modal-btn accent full" data-action="login-for-purchase" data-purchase-kind="${safeKind}"${safeSkin ? ` data-skin="${safeSkin}"` : ""}>${t("purchaseLoginAction")}</button>
      <button class="modal-btn secondary full" data-action="close-modal">${t("purchaseLoginCancel")}</button>
    `);
  }

  async function loginForPendingPurchase(purchaseKind, skinId = "") {
    const login = await runExternalInteraction(
      () => platform.loginForPurchase(),
      { ok: false, code: "unavailable" }
    );
    if (!login?.ok) {
      toast(login?.code === "cancelled" ? t("purchaseLoginCancelled") : t("purchaseLoginUnavailable"));
      return;
    }
    // Keep the active guest game in memory, restore account entitlements and immediately persist the combined state.
    await platform.syncEntitlements(profile);
    unlockRewardSkinsForNoAds(profile);
    if (profile.noAds) await platform.enforceNoAdsSticky();
    await saveNow();
    toast(t("purchaseLoginSuccess"));
    closeModal(true);
    if (purchaseKind === "skin" && skinId) await purchaseSkin(skinId);
    else if (purchaseKind === "noads") await purchaseNoAds();
  }

  function purchasedSkinFromTag(productTag) {
    const mapping = {
      [CONFIG.products.royalDeck]: "royal",
      [CONFIG.products.noirDeck]: "noir",
      [CONFIG.products.rubyDeck]: "ruby",
      [CONFIG.products.goldDeck]: "gold",
      [CONFIG.products.cosmosDeck]: "cosmos"
    };
    return mapping[productTag] || "";
  }

  async function handlePlatformPurchaseSuccess(productTag) {
    if (!profile || !productTag) return;
    platform.purchasedProducts.add(productTag);
    let changed = false;
    const skinId = purchasedSkinFromTag(productTag);
    if (skinId) {
      if (!profile.unlockedSkins.includes(skinId)) {
        profile.unlockedSkins.push(skinId);
        changed = true;
      }
      // A directly purchased deck becomes active immediately, matching the normal checkout flow.
      if (profile.skin !== skinId) {
        profile.skin = skinId;
        changed = true;
      }
      applySkin();
    } else if (productTag === CONFIG.products.removeAds) {
      if (!profile.noAds) {
        profile.noAds = true;
        changed = true;
      }
      if (unlockRewardSkinsForNoAds(profile).length) changed = true;
      nextInterstitialEligibleAt = Number.POSITIVE_INFINITY;
      // Update layout immediately. Closing a platform sticky may take time and must never block
      // the purchased state from appearing in the store.
      setBannerReserve(false);
      Promise.resolve(platform.enforceNoAdsSticky()).catch(error =>
        console.warn("[Kosynka] No-ads sticky cleanup failed", error)
      );
    }
    refreshProgression();

    // CRITICAL: render the entitlement before any cloud sync. On VK/OK/Yandex the player.sync()
    // request can finish noticeably later than the checkout. Previously the old shop stayed on
    // screen until that await completed, which looked exactly like the purchase required a reload.
    if (shopTab === "purchase" && app?.querySelector("#k-modal.open")) openStore("purchase");

    // Persist a local snapshot synchronously, then sync the platform profile in the background.
    // The UI must not depend on the network/cache catching up.
    const payload = buildPayload();
    localWrite(payload);
    if (changed) {
      Promise.resolve(platform.save(payload)).catch(error =>
        console.warn("[Kosynka] Purchase entitlement background sync failed", error)
      );
    } else {
      scheduleSave();
    }
  }

  async function purchaseSkin(id) {
    const deck = DECKS[id];
    if (platform.kind === "playgama" && deck) return rewardSkin(id);
    const productTag = deck?.product ? CONFIG.products[deck.product] : "";
    if (!productTag) return;
    const purchase = await runExternalInteraction(
      () => platform.purchase(productTag),
      { ok: false, code: "unavailable" }
    );
    if (purchase?.code === "login_required") {
      showPurchaseLogin("skin", id);
      return;
    }
    if (!purchase?.ok) {
      if (purchase?.code !== "pending") toast(t("purchaseFailed"));
      return;
    }
    await handlePlatformPurchaseSuccess(productTag);
    openStore("purchase");
    toast(t("deckBought", { title: deckTitle(id) }));
  }

  async function purchaseNoAds() {
    if (platform.kind === "playgama") return;
    const purchase = await runExternalInteraction(
      () => platform.purchase(CONFIG.products.removeAds),
      { ok: false, code: "unavailable" }
    );
    if (purchase?.code === "login_required") {
      showPurchaseLogin("noads");
      return;
    }
    if (!purchase?.ok) {
      if (purchase?.code !== "pending") toast(t("purchaseFailed"));
      return;
    }
    await handlePlatformPurchaseSuccess(CONFIG.products.removeAds);
    openStore("purchase");
    toast(t("adsDisabled"));
  }

  function showHowTo() {
    showModal(t("howTitle"), `
      <div class="rules-list">
        <p><b>1.</b> ${t("how1")}</p>
        <p><b>2.</b> ${t("how2")}</p>
        <p><b>3.</b> ${t("how3")}</p>
        <p><b>4.</b> ${t("how4")}</p>
        <p><b>5.</b> ${t("how5")}</p>
      </div>
      <button class="modal-btn secondary full" data-action="menu">${t("understood")}</button>
    `);
  }

  function showSettings() {
    const preferred = profile.preferredDrawCount === 3 ? 3 : 1;
    const running = game.drawCount === 3 ? 3 : 1;
    const preferredText = preferred === 1 ? t("drawOne") : t("drawThree");
    const runningText = running === 1 ? t("drawOne") : t("drawThree");
    showModal(t("settingsTitle"), `
      <div class="setting-row">
        <div><strong>${t("drawNew")}</strong><small>${t("drawInfo", { preferred: preferredText, running: runningText })}</small></div>
        <button class="deck-action" data-action="toggle-draw">${t("change")}</button>
      </div>
      <div class="setting-row"><div><strong>${t("saving")}</strong><small>${t("autosave")}</small></div></div>
      <button class="modal-btn secondary full" data-action="menu">${t("backMenu")}</button>
    `);
  }

  function toggleDraw() {
    profile.preferredDrawCount = profile.preferredDrawCount === 1 ? 3 : 1;
    scheduleSave();
    toast(t("nextDraw", { draw: profile.preferredDrawCount === 1 ? t("drawOne") : t("drawThree") }));
    showSettings();
  }

  function showResultModal(won, progression = { achievements: [], decks: [] }) {
    const title = won ? t("winTitle") : t("lostTitle");
    const message = won
      ? t("winCopy", { score: game.score, time: formatTime(game.elapsed) })
      : t("lostCopy");
    const achievements = progression?.achievements || [];
    const decks = progression?.decks || [];
    const rewards = [
      won && achievements.length ? `<p class="achievement-unlock">${t("achievementOpened", { names: escapeHtml(achievements.map(achievementTitle).join(", ")) })}</p>` : "",
      won && decks.length ? `<p class="achievement-unlock">${t("achievementDeckOpened", { names: escapeHtml(decks.map(deckTitle).join(", ")) })}</p>` : ""
    ].join("");
    showModal(title, `
      <p class="modal-lead">${message}</p>${rewards}
      <button class="modal-btn accent full" data-action="new-game">${t("newRound")}</button>
      <button class="modal-btn secondary full" data-action="menu">${t("inMenu")}</button>
    `);
  }

  function showModal(title, content, locked = false) {
    const modal = app?.querySelector("#k-modal");
    if (!modal) return;
    // The gameplay timer measures active play only. Any in-game menu or modal pauses it.
    pauseGameClock();
    modal.innerHTML = `<div class="modal-backdrop"></div><section class="modal-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <h2>${escapeHtml(title)}</h2>
      <div class="modal-content">${content}</div>
      ${locked ? "" : `<button class="modal-close" aria-label="${escapeHtml(t("close"))}" data-action="close-modal">${uiIcon("close")}</button>`}
    </section>`;
    modal.dataset.locked = locked ? "1" : "0";
    modal.classList.add("open");
  }

  function closeModal(force = false) {
    const modal = app?.querySelector("#k-modal");
    if (!modal || (!force && modal.dataset.locked === "1")) return;
    modal.classList.remove("open");
    modal.dataset.locked = "0";
    modal.innerHTML = "";
    resumeGameClock();
  }

  function toast(message) {
    const host = app?.querySelector("#k-toast");
    if (!host) return;
    host.textContent = message;
    host.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => host.classList.remove("show"), 2300);
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function cardHtml(card, origin, extraClass = "", extraStyles = []) {
    const suit = suitInfo(card);
    const selected = selection && origin && sameOrigin(selection, origin) ? "selected" : "";
    const effects = cardEffectClasses(card);
    const flightTarget = pendingFlightIds.has(card.id) ? "flight-target" : "";
    const styles = [];
    if (origin?.zone === "tableau") styles.push(`--stack-index:${origin.index}`);
    if (cardEffects.deal.has(card.id)) styles.push(`--deal-delay:${Math.min(900, cardEffects.deal.get(card.id) * 34)}ms`);
    if (Array.isArray(extraStyles)) styles.push(...extraStyles.filter(Boolean));
    const inlineStyle = styles.length ? ` style="${styles.join(";")}"` : "";
    const attributes = `data-card-id="${card.id}" data-zone="${origin?.zone || ""}" data-pile="${origin?.pile ?? ""}" data-index="${origin?.index ?? ""}"`;
    if (!card.faceUp) return `<div class="card back ${flightTarget} ${effects} ${extraClass}" ${attributes}${inlineStyle} aria-label="${escapeHtml(t("faceDown"))}"></div>`;
    const color = suit.color || "black";
    return `<div class="card face ${color} ${selected} ${flightTarget} ${effects} ${extraClass}" ${attributes}${inlineStyle} aria-label="${cardText(card)}">
      <span class="corner top"><b>${rankLabel(card.rank)}</b><i>${suit.symbol}</i></span>
      <span class="pip">${suit.symbol}</span>
      <span class="corner bottom"><b>${rankLabel(card.rank)}</b><i>${suit.symbol}</i></span>
    </div>`;
  }

  function foundationHtml(pile, index) {
    const top = getTop(pile);
    const suit = SUITS[index];
    if (!top) return `<div class="pile foundation empty foundation-${suit.key.toLowerCase()}" data-zone="foundation" data-pile="${index}" aria-label="${escapeHtml(suit.symbol)}"><span class="foundation-mark">${suit.symbol}</span></div>`;
    // Keep the previous top card visible while a new card is flying in. The incoming real card
    // is hidden until landing, so without this underlay an occupied foundation briefly looked empty.
    const previous = pendingFlightIds.has(top.id) && pile.length > 1 ? pile[pile.length - 2] : null;
    const underlay = previous ? cardHtml(previous, null, "foundation-underlay") : "";
    return `<div class="pile foundation foundation-${suit.key.toLowerCase()}" data-zone="foundation" data-pile="${index}">${underlay}${cardHtml(top, { zone: "foundation", pile: index }, "foundation-incoming")}</div>`;
  }

  function tableauHtml(pile, pileIndex) {
    const cards = pile.map((card, index) => cardHtml(card, { zone: "tableau", pile: pileIndex, index }, "tableau-card")).join("");
    return `<div class="pile tableau ${pile.length ? "" : "empty"}" data-zone="tableau" data-pile="${pileIndex}">${cards || `<span class="empty-mark">K</span>`}</div>`;
  }

  // В Draw 3 видно все три последние карты сброса, как в классической Косынке.
  // Нажимать и перетаскивать можно только верхнюю — две нижние показаны как часть веера.
  function wasteHtml() {
    const visibleCount = game.drawCount === 3 ? Math.min(3, game.waste.length) : Math.min(1, game.waste.length);
    if (!visibleCount) return `<div class="pile waste empty" data-zone="waste" data-pile="0"><span class="empty-mark">♣</span></div>`;
    const cards = game.waste.slice(-visibleCount);
    // Размер известен после последнего layout pass. Не читаем clientWidth здесь:
    // на каждом быстром клике это вызывало forced reflow всего игрового поля.
    const pileWidth = Math.max(36, layoutMetrics.cardWidth || (layoutMetrics.cardHeight * .69));
    const fanStep = visibleCount > 1 ? clamp(Math.round(pileWidth * .12), 5, 13) : 0;
    const html = cards.map((card, index) => {
      const isTop = index === cards.length - 1;
      const x = index * fanStep;
      const origin = isTop ? { zone: "waste", pile: 0 } : { zone: "waste-preview", pile: 0 };
      const className = `waste-card ${isTop ? "waste-top" : "waste-preview"}`;
      return cardHtml(card, origin, className, [`--waste-x:${x}px`, `--waste-z:${index + 1}`]);
    }).join("");
    return `<div class="pile waste waste-fan" data-zone="waste" data-pile="0" aria-label="${escapeHtml(t("wasteTop"))}">${html}</div>`;
  }

  function renderHud() {
    if (!app || !game) return;
    const score = app.querySelector("#k-score");
    const moves = app.querySelector("#k-moves");
    const time = app.querySelector("#k-time");
    const undo = app.querySelector("#k-undo");
    const hintButton = app.querySelector("#k-hint");
    const hintCount = app.querySelector("#k-hint-count");
    const balance = getHintBalance();
    if (score) score.textContent = String(game.score);
    if (moves) moves.textContent = String(game.moves);
    if (time) time.textContent = formatTime(getElapsed());
    if (undo) undo.disabled = !history.length;
    if (hintCount) hintCount.textContent = String(balance);
    if (hintButton) {
      hintButton.classList.toggle("hint-empty", balance <= 0);
      hintButton.setAttribute("aria-label", balance > 0 ? t("hintRemaining", { count: balance }) : t("hintsDepleted"));
      hintButton.title = balance > 0 ? t("hintsRemainTitle", { count: balance }) : t("hintsEmptyTitle", { amount: CONFIG.hintRewardAmount });
    }
  }

  function stockHtml() {
    const drawLabel = game.drawCount === 3 ? t("drawThreeAria") : t("drawOneAria");
    return `<div class="pile stock ${game.stock.length ? "has-cards" : "empty"}" data-zone="stock" aria-label="${escapeHtml(game.stock.length ? drawLabel : t("recycleAria"))}" data-draw-count="${game.drawCount}">
      ${game.stock.length ? `<div class="card back" aria-hidden="true"></div>` : `<span class="recycle">${uiIcon("recycle")}</span>`}
      <span class="pile-count">${game.stock.length || (game.waste.length ? "↻" : "")}</span>
    </div>`;
  }

  function renderStockAndWaste() {
    const stock = app?.querySelector("#k-stock");
    const waste = app?.querySelector("#k-waste");
    if (stock) stock.innerHTML = stockHtml();
    if (waste) waste.innerHTML = wasteHtml();
  }

  // Быстрый путь для обычной сдачи: не пересоздаёт 52 карточных DOM-элемента стола.
  function renderStockChange() {
    if (!app || !game) return;
    renderHud();
    renderStockAndWaste();
    clearCardEffectsSoon();
  }

  function render() {
    if (!app || !game) return;
    renderHud();
    renderStockAndWaste();
    app.querySelector("#k-foundations").innerHTML = game.foundations.map(foundationHtml).join("");
    app.querySelector("#k-tableaus").innerHTML = game.tableaus.map(tableauHtml).join("");
    scheduleLayoutMetrics();
    clearCardEffectsSoon();
    playPendingFlights();
  }

  function parseHexColor(value) {
    const hex = String(value || "").trim().replace(/^#/, "");
    const expanded = hex.length === 3 ? hex.split("").map(part => part + part).join("") : hex;
    if (!/^[0-9a-f]{6}$/i.test(expanded)) return [0, 0, 0];
    return [
      parseInt(expanded.slice(0, 2), 16),
      parseInt(expanded.slice(2, 4), 16),
      parseInt(expanded.slice(4, 6), 16)
    ];
  }

  function blendHex(left, right, rightWeight = .5) {
    const [lr, lg, lb] = parseHexColor(left);
    const [rr, rg, rb] = parseHexColor(right);
    const weight = clamp(Number(rightWeight) || 0, 0, 1);
    const component = (first, second) => Math.round(first + (second - first) * weight).toString(16).padStart(2, "0");
    return `#${component(lr, rr)}${component(lg, rg)}${component(lb, rb)}`;
  }

  function setMetaColor(doc, name, color) {
    if (!doc?.head) return;
    const selector = `meta[name="${name}"]`;
    let metas = Array.from(doc.head.querySelectorAll(selector));
    if (!metas.length) {
      const meta = doc.createElement("meta");
      meta.name = name;
      doc.head.appendChild(meta);
      metas = [meta];
    }
    metas.forEach(meta => meta.setAttribute("content", color));
  }

  // Обновляет всё, что имеет право менять сама игра: document, WebView и same-origin оболочку.
  // В Construct Preview игра находится внутри чужой страницы view.construct.net: её зелёный
  // статус/навигационный бар принадлежит хосту и специально не трогается из iframe.
  function syncBrowserChrome(theme, chrome) {
    const browserColor = chrome["--chrome-top-a"] || theme.tableA;
    const documents = [document];
    try {
      if (window.top && window.top !== window && window.top.location.origin === window.location.origin) {
        documents.push(window.top.document);
      }
    } catch (_) {
      // Cross-origin iframe: менять document хоста запрещено браузером.
    }

    Array.from(new Set(documents)).forEach(doc => {
      const html = doc.documentElement;
      const body = doc.body;
      if (html) {
        html.style.backgroundColor = theme.tableB;
        html.style.colorScheme = "dark";
      }
      if (body) {
        body.style.backgroundColor = theme.tableB;
        body.style.colorScheme = "dark";
      }
      // Android Chrome/WebView и Chromium-based оболочки читают эти значения сразу после смены темы.
      setMetaColor(doc, "theme-color", browserColor);
      setMetaColor(doc, "msapplication-TileColor", browserColor);
      setMetaColor(doc, "msapplication-navbutton-color", browserColor);
      // iOS применяет произвольный цвет браузерных панелей только к самостоятельной странице/PWA.
      // В режиме added-to-home-screen прозрачный статус-бар показывает цвет корня игры.
      setMetaColor(doc, "apple-mobile-web-app-status-bar-style", "black-translucent");
    });

    // Нативные оболочки и собственный same-origin launcher могут подписаться на это сообщение.
    // Для публичных платформ это безопасно: сообщение не содержит персональных данных.
    try {
      window.parent?.postMessage({
        type: "kosynka-theme-change",
        skin: profile?.skin || "classic",
        color: browserColor,
        background: theme.tableB,
        accent: theme.accent
      }, "*");
    } catch (_) {}
  }

  // Шапка, нижняя панель, safe-area и поддерживаемые браузерные панели получают оттенки выбранной темы.
  function applySkin() {
    if (!app || !profile) return;
    const deck = DECKS[profile.skin] || DECKS.classic;
    const theme = deck.theme;
    app.dataset.skin = profile.skin;
    for (const [name, value] of Object.entries(theme)) app.style.setProperty(`--${name}`, value);

    const chrome = {
      "--chrome-top-a": blendHex(theme.tableA, "#ffffff", .10),
      "--chrome-top-b": blendHex(theme.tableA, theme.tableB, .52),
      "--chrome-bottom-a": blendHex(theme.tableA, theme.tableB, .63),
      "--chrome-bottom-b": blendHex(theme.tableB, "#000000", .18),
      "--chrome-line": blendHex(theme.accent, "#ffffff", .35),
      "--chrome-ink": blendHex(theme.tableB, "#000000", .42)
    };
    for (const [name, value] of Object.entries(chrome)) app.style.setProperty(name, value);
    syncBrowserChrome(theme, chrome);
  }

  function scheduleLayoutMetrics() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(updateLayoutMetrics);
  }

  function stackStepsForPile(pile, available, cardHeight, compact) {
    if (pile.length <= 1) return [];
    const closedDesired = clamp(cardHeight * (compact ? 0.12 : 0.14), compact ? 5 : 8, compact ? 15 : 24);
    const faceDesired = clamp(cardHeight * (compact ? 0.22 : 0.26), compact ? 9 : 13, compact ? 24 : 36);
    const closedMin = compact ? 2.2 : 3.4;
    const faceMin = compact ? 4.2 : 6.0;
    const desired = pile.slice(0, -1).map(card => card.faceUp ? faceDesired : closedDesired);
    const minimum = pile.slice(0, -1).map(card => card.faceUp ? faceMin : closedMin);
    const totalDesired = desired.reduce((sum, value) => sum + value, 0);
    const totalMinimum = minimum.reduce((sum, value) => sum + value, 0);
    if (totalDesired <= available) return desired;
    if (totalMinimum >= available) {
      const even = Math.max(1.2, available / Math.max(1, pile.length - 1));
      return desired.map(() => even);
    }
    const scale = (available - totalMinimum) / Math.max(.0001, totalDesired - totalMinimum);
    return desired.map((value, index) => minimum[index] + (value - minimum[index]) * scale);
  }

  function layoutTableauStacks(tableauHeight, cardHeight, compact) {
    if (!app || !game) return;
    const available = Math.max(0, tableauHeight - cardHeight - 1);
    game.tableaus.forEach((pile, pileIndex) => {
      const holder = app.querySelector(`[data-zone="tableau"][data-pile="${pileIndex}"]`);
      if (!holder) return;
      const nodes = Array.from(holder.querySelectorAll(".tableau-card"));
      const steps = stackStepsForPile(pile, available, cardHeight, compact);
      let offset = 0;
      nodes.forEach((node, index) => {
        node.style.setProperty("--stack-y", `${offset.toFixed(2)}px`);
        node.style.zIndex = String(index + 1);
        offset += steps[index] || 0;
      });
    });
  }

  function dragStepsForCards(cards, dragHeight, compact) {
    if (!cards || cards.length <= 1) return [];
    const viewport = getViewportMetrics();
    const available = Math.min(viewport.height * (compact ? .48 : .58), dragHeight * (compact ? 1.55 : 1.95));
    return stackStepsForPile(cards, available, dragHeight, compact);
  }

  function renderDragStack(cards) {
    const visual = app?.querySelector("#k-drag");
    if (!visual) return;
    const dragHeight = layoutMetrics.dragHeight || parseFloat(getComputedStyle(app).getPropertyValue("--drag-h")) || 134;
    visual.innerHTML = cards.map((card, index) => cardHtml(card, { zone: "drag", pile: 0, index }, "drag-card drag-stack-card")).join("");
    const steps = dragStepsForCards(cards, dragHeight, layoutMetrics.compact);
    let offset = 0;
    Array.from(visual.querySelectorAll(".drag-stack-card")).forEach((node, index) => {
      node.style.setProperty("--drag-stack-y", `${offset.toFixed(2)}px`);
      node.style.zIndex = String(index + 1);
      offset += steps[index] || 0;
    });
    visual.style.height = `${dragHeight + offset}px`;
  }

  function syncControlReserve() {
    const controls = app?.querySelector(".k-bottom");
    if (!controls) return 0;
    const height = Math.ceil(controls.getBoundingClientRect().height || 0);
    if (height > 0) app.style.setProperty("--controls-h", `${height}px`);
    return height;
  }

  function updateLayoutMetrics() {
    if (!app || !game) return;
    const wrap = app.querySelector(".k-board-wrap");
    const board = app.querySelector(".k-board");
    const topRow = app.querySelector(".top-row");
    if (!wrap || !board || !topRow) return;
    const viewport = syncViewportVariables();
    if (viewport.rotationBlocked) return;

    // Нижняя панель является третьей строкой grid и физически занимает своё место.
    // Это измерение теперь нужно только toast/drag-геометрии, а не для ручного
    // вычитания высоты из игрового поля.
    syncControlReserve();

    const wrapWidth = Math.max(1, wrap.clientWidth);
    const wrapHeight = Math.max(1, wrap.clientHeight);
    const boardHeightBeforeSizing = Math.max(1, board.clientHeight || wrapHeight);
    const compact = viewport.compact;
    const gap = viewport.desktopVeryTight
      ? clamp(Math.round(wrapWidth * 0.008), 1, 4)
      : compact
        ? clamp(Math.round(wrapWidth * 0.0105), 3, 7)
        : clamp(Math.round(wrapWidth * 0.0105), 6, 16);
    const sidePadding = viewport.desktopVeryTight
      ? clamp(Math.round(wrapWidth * 0.008), 2, 6)
      : compact ? clamp(Math.round(wrapWidth * 0.012), 4, 10) : clamp(Math.round(wrapWidth * 0.022), 12, 48);
    const usableWidth = Math.max(1, wrapWidth - sidePadding * 2);

    // Размер карты ограничивается шириной И высотой доступного игрового поля.
    // Отдельный vertical cap не даёт верхнему ряду разрастись так, чтобы
    // семь колонок ушли под нижнюю панель в низком/узком desktop-окне.
    const rowGapEstimate = parseFloat(getComputedStyle(board).rowGap) || (compact ? 8 : 12);
    const heightFactor = compact ? (viewport.desktopTight ? 0.31 : viewport.desktopNarrow ? 0.34 : 0.30) : 0.37;
    const capByWrap = clamp(
      wrapHeight * heightFactor,
      compact ? 54 : 72,
      compact ? (viewport.phoneLike ? 182 : 210) : 236
    );
    const reservedTableauHeight = Math.min(
      compact ? 72 : 110,
      Math.max(compact ? 36 : 56, boardHeightBeforeSizing * (compact ? 0.38 : 0.42))
    );
    const capByBoard = Math.max(
      compact ? 34 : 48,
      boardHeightBeforeSizing - rowGapEstimate - reservedTableauHeight
    );
    const maxCardHeight = Math.min(capByWrap, capByBoard);
    const maxCardWidthByHeight = maxCardHeight * 0.69;
    const boardWidthByHeight = maxCardWidthByHeight * 7 + gap * 6;
    const rawBoardWidth = Math.min(usableWidth, boardWidthByHeight);
    const minCardWidth = viewport.desktopVeryTight ? 16 : viewport.desktopTight ? 20 : 22;
    const cardWidth = Math.max(minCardWidth, (rawBoardWidth - gap * 6) / 7);
    const boardWidth = cardWidth * 7 + gap * 6;
    const cardHeight = cardWidth / 0.69;

    board.style.setProperty("--board-w", `${Math.max(1, boardWidth)}px`);
    board.style.setProperty("--pile-gap", `${gap}px`);
    board.style.setProperty("--card-h", `${cardHeight}px`);

    // Высоту верхнего ряда читаем после установки ширины. Важно: board теперь
    // ограничен своей grid-строкой, поэтому tableauHeight всегда находится выше footer.
    const boardHeight = Math.max(1, board.clientHeight);
    const topRowHeight = Math.max(1, topRow.getBoundingClientRect().height);
    const rowGap = parseFloat(getComputedStyle(board).rowGap) || (compact ? 8 : 12);
    const tableauHeight = Math.max(1, boardHeight - topRowHeight - rowGap);
    const dragWidth = Math.max(34, Math.min(cardWidth, compact ? 76 : 132));
    const dragHeight = dragWidth / 0.69;

    board.style.setProperty("--tableau-h", `${tableauHeight}px`);
    app.style.setProperty("--drag-w", `${dragWidth}px`);
    app.style.setProperty("--drag-h", `${dragHeight}px`);
    layoutMetrics = {
      cardWidth, cardHeight, tableauHeight, dragHeight,
      portrait: viewport.portrait,
      compact,
      compactLandscape: viewport.compactLandscape,
      desktopTight: viewport.desktopTight,
      desktopVeryTight: viewport.desktopVeryTight,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height
    };
    layoutTableauStacks(tableauHeight, cardHeight, compact);
  }

  function buildApp() {
    document.getElementById("kosynka-c3-root")?.remove();
    document.getElementById("kosynka-c3-style")?.remove();

    const style = document.createElement("style");
    style.id = "kosynka-c3-style";
    style.textContent = `
      html,body{margin:0!important;width:100%!important;height:100%!important;min-height:100%!important;overflow:hidden!important;overscroll-behavior:none!important;background:#073528!important}
      #kosynka-c3-root,#kosynka-c3-root *{box-sizing:border-box;-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;-webkit-tap-highlight-color:transparent}#kosynka-c3-root svg,#kosynka-c3-root img{-webkit-user-drag:none}#kosynka-c3-root{--tableA:#0e6a4e;--tableB:#063629;--accent:#f4d374;--backA:#147d5c;--backB:#092e23;--frontA:#fff;--frontB:#e9f0ed;--chrome-top-a:#146c53;--chrome-top-b:#083f30;--chrome-bottom-a:#084230;--chrome-bottom-b:#042b21;--chrome-line:rgba(255,255,255,.18);--chrome-ink:#06261d;--drag-w:92px;--drag-h:134px;--viewport-w:100vw;--viewport-h:100dvh;--ad-reserve-h:0px;--ad-reserve-top:0px;--ad-reserve-w:0px;--controls-h:calc(52px + env(safe-area-inset-bottom));position:fixed!important;inset:0!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;z-index:2147483000!important;color:#f6fbf8;font-family:Inter,Segoe UI,Arial,sans-serif;overflow:hidden!important;touch-action:manipulation;background:var(--tableB)}#kosynka-c3-root .modal-card{touch-action:pan-y}
      .ui-icon{display:inline-grid;place-items:center;flex:0 0 auto;width:1em;height:1em;line-height:0;vertical-align:-.13em}.ui-icon svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      /* Нижняя панель — третья строка grid. Она всегда занимает реальную высоту,
         поэтому игровой стол не может уйти под кнопки в узком окне ПК или WebView. */
      .k-app{width:100%;height:100%;min-width:0;min-height:0;max-width:100%;max-height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;padding:0!important;overflow:hidden;background:radial-gradient(115% 75% at 50% -15%,color-mix(in srgb,var(--tableA) 88%,white 12%),var(--tableA) 48%,var(--tableB));}
      .k-top{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:9px clamp(10px,2.1vw,24px);border-bottom:1px solid var(--chrome-line);background:linear-gradient(112deg,var(--chrome-top-a),var(--chrome-top-b));backdrop-filter:blur(12px)}
      /* Sticky banners are overlays. Never reserve bottom/top/right layout space in any orientation. */
      #kosynka-c3-root,#kosynka-c3-root.has-platform-banner{--ad-reserve-h:0px!important;--ad-reserve-top:0px!important;--ad-reserve-w:0px!important}.reward-text-action{gap:0!important}
      /* Узкие, квадратные и уменьшенные окна ПК получают плотную шапку, не теряя семь колонок стола. */
      #kosynka-c3-root.k-desktop-narrow{--controls-h:calc(46px + env(safe-area-inset-bottom))}#kosynka-c3-root.k-desktop-narrow .k-top{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"brand menu" "stats stats";gap:6px;padding:7px clamp(8px,1.5vw,14px)}
      #kosynka-c3-root.k-desktop-narrow .k-brand{grid-area:brand;font-size:17px}#kosynka-c3-root.k-desktop-narrow .k-brand small{display:none}#kosynka-c3-root.k-desktop-narrow .statbar{grid-area:stats;gap:5px;justify-content:stretch}#kosynka-c3-root.k-desktop-narrow .stat{flex:1;min-width:0;padding:4px 5px}#kosynka-c3-root.k-desktop-narrow .menu-btn{grid-area:menu;min-height:32px;padding:6px 9px;font-size:11px}#kosynka-c3-root.k-desktop-narrow .k-board-wrap{padding:7px clamp(4px,1vw,10px) 3px}#kosynka-c3-root.k-desktop-narrow .k-bottom{gap:5px;padding:6px clamp(5px,1vw,10px) calc(6px + env(safe-area-inset-bottom))}#kosynka-c3-root.k-desktop-narrow .action-btn{min-height:34px;padding:6px 4px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      /* Браузер на ПК можно сузить сильнее, чем телефон: вводим ещё две безопасные ступени.
         Все элементы имеют min-width:0, а кнопки сохраняют доступный SVG и aria-label. */
      #kosynka-c3-root.k-desktop-tight{--controls-h:42px}#kosynka-c3-root.k-desktop-tight .k-top{gap:5px;padding:6px 7px}#kosynka-c3-root.k-desktop-tight .k-brand{font-size:15px;gap:6px}#kosynka-c3-root.k-desktop-tight .logo{width:28px;height:28px;border-radius:8px}#kosynka-c3-root.k-desktop-tight .statbar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}#kosynka-c3-root.k-desktop-tight .stat{min-width:0;padding:3px 4px;border-radius:8px}#kosynka-c3-root.k-desktop-tight .stat label{font-size:8px}#kosynka-c3-root.k-desktop-tight .stat b{font-size:11px}#kosynka-c3-root.k-desktop-tight .menu-btn{min-height:30px;padding:5px 7px;font-size:10px}#kosynka-c3-root.k-desktop-tight .k-board-wrap{padding:5px 3px 2px}#kosynka-c3-root.k-desktop-tight .k-board{gap:7px}#kosynka-c3-root.k-desktop-tight .k-bottom{gap:4px;padding:4px 4px}#kosynka-c3-root.k-desktop-tight .action-btn{min-height:32px;padding:5px 3px;font-size:9px}#kosynka-c3-root.k-desktop-tight .hint-badge{min-width:17px;height:17px;margin-left:2px;padding:0 4px;font-size:9px}
      #kosynka-c3-root.k-desktop-very-tight{--controls-h:38px}#kosynka-c3-root.k-desktop-very-tight .k-top{padding:5px 5px;gap:4px}#kosynka-c3-root.k-desktop-very-tight .k-brand{font-size:14px}#kosynka-c3-root.k-desktop-very-tight .brand-name small{display:none}#kosynka-c3-root.k-desktop-very-tight .statbar{gap:3px}#kosynka-c3-root.k-desktop-very-tight .stat{padding:2px 2px;border-radius:7px}#kosynka-c3-root.k-desktop-very-tight .stat label{font-size:7px}#kosynka-c3-root.k-desktop-very-tight .stat b{font-size:10px}#kosynka-c3-root.k-desktop-very-tight .menu-btn{min-width:30px;padding:6px}#kosynka-c3-root.k-desktop-very-tight .menu-label,#kosynka-c3-root.k-desktop-very-tight .action-label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}#kosynka-c3-root.k-desktop-very-tight .k-bottom{padding:3px;gap:3px}#kosynka-c3-root.k-desktop-very-tight .action-btn{min-height:30px;padding:5px 3px;font-size:12px;overflow:visible}#kosynka-c3-root.k-desktop-very-tight .action-btn .ico{margin:0}#kosynka-c3-root.k-desktop-very-tight .hint-badge{position:absolute;right:3px;top:2px;min-width:14px;height:14px;padding:0 3px;font-size:8px}
      /* Fallback для браузеров, где Screen Orientation API недоступен: телефон в landscape не получает сжатый стол. */
      .rotate-lock{display:none;position:fixed;inset:0;z-index:250;place-items:center;padding:max(20px,env(safe-area-inset-top)) 24px max(20px,env(safe-area-inset-bottom));background:radial-gradient(80% 110% at 50% 0%,color-mix(in srgb,var(--tableA) 70%,white 8%),var(--tableB));text-align:center}
      .rotate-card{width:min(360px,92vw);padding:24px 22px;border:1px solid rgba(255,255,255,.22);border-radius:20px;background:rgba(4,23,18,.72);box-shadow:0 22px 60px rgba(0,0,0,.35);backdrop-filter:blur(14px)}.rotate-icon{display:grid;place-items:center;width:52px;height:52px;margin:0 auto 14px;border-radius:16px;background:var(--accent);color:#18372e;font-size:28px;font-weight:900}.rotate-card strong,.rotate-card span{display:block}.rotate-card strong{font-size:20px}.rotate-card span{margin-top:7px;font-size:13px;line-height:1.4;opacity:.82}
      #kosynka-c3-root.k-phone-landscape .k-app,#kosynka-c3-root.k-phone-landscape #k-toast,#kosynka-c3-root.k-phone-landscape #k-fx,#kosynka-c3-root.k-phone-landscape #k-drag{visibility:hidden;pointer-events:none}#kosynka-c3-root.k-phone-landscape .rotate-lock{display:grid}

      .k-brand{display:flex;align-items:center;gap:8px;min-width:0;font-weight:850;font-size:clamp(16px,2vw,23px);line-height:1}.brand-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.k-brand small{display:block;margin-top:5px;font-size:10px;font-weight:600;letter-spacing:.04em;opacity:.72}.logo{display:grid;place-items:center;flex:0 0 auto;width:33px;height:33px;border-radius:10px;background:linear-gradient(145deg,var(--accent),#f9edba);color:#26392e;box-shadow:inset 0 0 0 1px rgba(0,0,0,.13)}.logo .ui-icon{width:18px;height:18px}
      .statbar{display:flex;justify-content:center;gap:7px;min-width:0}.stat{min-width:64px;padding:5px 8px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(255,255,255,.075);text-align:center}.stat label{display:block;font-size:9px;letter-spacing:.04em;opacity:.68}.stat b{display:block;margin-top:2px;font-size:13px}.menu-btn,.action-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:0;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.13);color:#f8fffb;border-radius:11px;min-height:36px;padding:8px 11px;font-size:12px;font-weight:800;cursor:pointer;transition:transform .15s,background .15s}.menu-btn:hover,.action-btn:hover:not(:disabled){transform:translateY(-1px);background:rgba(255,255,255,.2)}.menu-btn{white-space:nowrap}.menu-btn .ui-icon,.action-btn .ui-icon{width:1.08em;height:1.08em}.action-btn:disabled{opacity:.38;cursor:default}.action-btn.hint-empty{border-color:color-mix(in srgb,var(--accent) 68%,rgba(255,255,255,.22));background:color-mix(in srgb,var(--accent) 18%,rgba(255,255,255,.13))}.hint-badge{display:inline-grid;place-items:center;min-width:20px;height:20px;margin-left:1px;padding:0 5px;border-radius:999px;background:rgba(0,0,0,.24);font-size:11px;line-height:1}.hint-empty .hint-badge{background:var(--accent);color:#17352c}
      .k-board-wrap{grid-row:2;min-width:0;min-height:0;overflow:hidden;display:grid;place-items:stretch center;padding:clamp(7px,1.2vw,14px) clamp(4px,2vw,28px) 5px}.k-board{width:var(--board-w,100%);max-width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr);gap:12px}.top-row,.tableau-area{min-width:0;max-width:100%;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:var(--pile-gap,10px)}.tableau-area{min-height:0;overflow:hidden}.stock-area{grid-column:span 2;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--pile-gap,10px);min-width:0;max-width:100%}.top-spacer{grid-column:span 1;min-width:0}.foundation-area{grid-column:span 4;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--pile-gap,10px);min-width:0;max-width:100%}.stock-area>div{min-width:0}.top-row{padding-top:8px}
      .pile{position:relative;width:100%;aspect-ratio:.69/1;border-radius:clamp(6px,.75vw,10px);background:rgba(0,0,0,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}.pile.empty{background:rgba(0,0,0,.12)}.foundation-mark,.empty-mark{position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.28);font-size:clamp(18px,3.4vw,39px);font-weight:800}.empty-mark{font-size:clamp(14px,2.3vw,24px)}
      .tableau{height:var(--tableau-h,360px);min-height:0;aspect-ratio:auto;border-radius:clamp(6px,.75vw,10px);overflow:hidden;background:transparent;box-shadow:none}.tableau:not(.empty){background:transparent;box-shadow:none}.tableau.empty{background:color-mix(in srgb,var(--tableB) 42%,transparent);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}.card{position:absolute;inset:0;width:100%;height:100%;border-radius:clamp(6px,.75vw,10px);user-select:none;-webkit-user-select:none;touch-action:none;box-shadow:0 3px 8px rgba(0,0,0,.31),inset 0 0 0 1px rgba(0,0,0,.13);transition:opacity .18s ease,filter .18s ease,transform .18s cubic-bezier(.2,.8,.2,1)}.card.face{background:linear-gradient(145deg,var(--frontA),var(--frontB));color:#182322;overflow:hidden}.card.face.red{color:#bd3546}.card.back{background:repeating-linear-gradient(45deg,rgba(255,255,255,.16) 0 2px,transparent 2px 6px),linear-gradient(135deg,var(--backA),var(--backB));border:3px solid #fff7ea;box-shadow:0 3px 8px rgba(0,0,0,.36),inset 0 0 0 2px rgba(255,255,255,.35)}.card.back:after{content:"";position:absolute;inset:7px;border:1px solid rgba(255,255,255,.48);border-radius:4px}.card.selected{filter:drop-shadow(0 0 10px var(--accent));transform:translateY(-4px) scale(1.01)}.card.drag-source{opacity:.28!important;filter:saturate(.72) brightness(.9)!important;transform:none!important;transition:opacity .12s ease!important;pointer-events:none}.pile.tap-target{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--accent) 74%,transparent),0 0 12px color-mix(in srgb,var(--accent) 28%,transparent);transition:box-shadow .16s ease}.card.pulse,.pile.pulse{animation:kPulse .78s ease both}.card.hint-source{animation:kHintSource 1.05s ease-in-out infinite;filter:drop-shadow(0 0 13px var(--accent))}.pile.hint-target{animation:kHintTarget 1.05s ease-in-out infinite;box-shadow:inset 0 0 0 2px var(--accent),0 0 16px color-mix(in srgb,var(--accent) 56%,transparent)}.card.arrival{animation:kArrival .38s cubic-bezier(.2,.9,.3,1)}.card.deal-in{animation:kDealIn .42s cubic-bezier(.22,.84,.28,1) both;animation-delay:var(--deal-delay,0ms)}.card.draw-in{animation:kDrawIn .33s cubic-bezier(.2,.88,.25,1) both}.card.flip-in{animation:kFlipIn .34s cubic-bezier(.2,.84,.3,1) both}.waste{overflow:visible}.waste-card{inset:auto auto auto var(--waste-x,0px);width:100%;height:100%;z-index:var(--waste-z,1);will-change:transform,opacity}.waste-preview{pointer-events:none;filter:brightness(.93)}.waste-top{cursor:pointer}@keyframes kPulse{0%,100%{filter:none}45%{filter:drop-shadow(0 0 16px var(--accent));transform:translateY(-5px)}}@keyframes kHintSource{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-7px) scale(1.015)}}@keyframes kHintTarget{0%,100%{filter:brightness(1)}50%{filter:brightness(1.18)}}@keyframes kArrival{0%{filter:brightness(1.34);transform:scale(.95)}100%{filter:brightness(1);transform:scale(1)}}@keyframes kDealIn{0%{opacity:0;transform:translate(-120px,-150px) rotate(-5deg) scale(.76)}65%{opacity:1}100%{opacity:1;transform:translate(0,0) rotate(0) scale(1)}}@keyframes kDrawIn{0%{opacity:.12;transform:translate(-62%,0) rotate(-4deg) scale(.9)}100%{opacity:1;transform:translate(0,0) rotate(0) scale(1)}}@keyframes kFlipIn{0%{opacity:.25;transform:perspective(700px) rotateY(82deg) scale(.94)}100%{opacity:1;transform:perspective(700px) rotateY(0) scale(1)}}.foundation-underlay{pointer-events:none;z-index:1}.foundation-incoming{z-index:2}.card.flight-target{opacity:0!important;transition:none!important}
      .tableau-card{inset:auto 0 auto 0;top:var(--stack-y,calc(var(--stack-index,0) * 30px));height:var(--card-h,140px);z-index:var(--stack-index,0)}.corner{position:absolute;display:grid;justify-items:center;line-height:.9;font-size:clamp(9px,1.35vw,19px);font-weight:850}.corner i{font-size:.86em;font-style:normal}.corner.top{top:6%;left:8%}.corner.bottom{right:8%;bottom:6%;transform:rotate(180deg)}.pip{position:absolute;inset:0;display:grid;place-items:center;font-size:clamp(25px,5vw,65px);line-height:1}.pile-count{position:absolute;right:7px;bottom:5px;z-index:2;font-size:10px;color:rgba(255,255,255,.78)}.recycle{position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.78);font-size:clamp(24px,4vw,42px)}
      .k-bottom{position:relative;grid-row:3;align-self:stretch;left:auto;right:auto;bottom:auto;z-index:35;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;min-height:var(--controls-h);padding:7px clamp(8px,2vw,20px) calc(7px + env(safe-area-inset-bottom));border-top:1px solid var(--chrome-line);background:linear-gradient(112deg,var(--chrome-bottom-a),var(--chrome-bottom-b));box-shadow:0 -7px 20px rgba(0,0,0,.13);backdrop-filter:blur(12px)}.action-btn{width:100%;padding:8px 6px}.action-btn .ico{margin-right:4px;font-size:15px;vertical-align:-1px}
      #k-toast{position:fixed;z-index:50;left:calc((100% - var(--ad-reserve-w,0px))/2);bottom:calc(var(--ad-reserve-h,0px) + var(--controls-h) + 8px);transform:translate(-50%,16px);opacity:0;pointer-events:none;max-width:min(90vw,480px);padding:9px 13px;border:1px solid rgba(255,255,255,.2);border-radius:11px;background:rgba(5,22,17,.92);color:#fff;text-align:center;font-size:13px;transition:.22s}.show{transform:translate(-50%,0)!important;opacity:1!important}
      #k-modal{position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;padding:clamp(10px,3vw,26px);overflow:hidden}#k-modal.open{display:flex}.modal-backdrop{position:absolute;inset:0;background:rgba(0,8,6,.66);backdrop-filter:blur(8px)}.modal-card{position:relative;width:min(530px,100%);max-height:calc(var(--viewport-h,100dvh) - 20px);overflow:auto;overscroll-behavior:contain;scrollbar-width:none;padding:clamp(17px,3vw,25px);border:1px solid rgba(255,255,255,.21);border-radius:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--tableA) 85%,#1e3d34),var(--tableB));box-shadow:0 20px 54px rgba(0,0,0,.48)}.modal-card::-webkit-scrollbar{display:none}.modal-card h2{margin:0 32px 10px 0;font-size:clamp(22px,4.5vw,28px)}.modal-lead{margin:0 0 17px;line-height:1.45;opacity:.93}.modal-close{position:absolute;right:13px;top:12px;display:grid;place-items:center;width:33px;height:33px;border:1px solid rgba(255,255,255,.22);border-radius:9px;background:rgba(255,255,255,.1);color:white;cursor:pointer}.modal-close .ui-icon{width:18px;height:18px}.modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.modal-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:0;border:0;border-radius:11px;min-height:42px;padding:10px 12px;background:rgba(255,255,255,.16);color:#fff;font-size:13px;font-weight:850;cursor:pointer}.modal-btn .button-icon{width:1.08em;height:1.08em}.modal-btn.accent{background:var(--accent);color:#17352c}.modal-btn.secondary{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.10)}.modal-btn.warning{background:#d35b5e;color:#fff}.modal-btn.full{width:100%;margin-top:8px}.modal-btn:disabled{opacity:.54;cursor:default}.reward-note{display:flex;gap:10px;align-items:flex-start;margin:2px 0 8px;padding:10px 11px;border:1px solid rgba(255,255,255,.15);border-radius:11px;background:rgba(255,255,255,.07);font-size:12px;line-height:1.38;opacity:.91}.reward-note-icon{display:grid;place-items:center;flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#17352c;font-weight:900}.reward-note-icon .ui-icon{width:13px;height:13px}.menu-hero{display:flex;gap:13px;align-items:center;margin:3px 0 13px}.menu-hero p{margin:0;line-height:1.42;opacity:.9}.menu-card{display:grid;place-items:center;flex:0 0 auto;width:58px;height:76px;border:2px solid white;border-radius:10px;background:linear-gradient(145deg,var(--backA),var(--backB));color:white;box-shadow:inset 0 0 0 2px rgba(255,255,255,.25)}.menu-card .ui-icon{width:31px;height:31px}
      .shop-tabs{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:10px}.shop-tab{border:1px solid rgba(255,255,255,.17);border-radius:10px;padding:9px;background:rgba(255,255,255,.075);color:#fff;font-weight:800;cursor:pointer}.shop-tab.active{background:var(--accent);color:#18362c;border-color:transparent}.deck-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.deck-tile{min-width:0;display:grid;grid-template-columns:72px minmax(0,1fr);grid-template-rows:auto auto;align-items:center;gap:5px 9px;padding:8px;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:rgba(255,255,255,.07)}.deck-tile.is-active{border-color:var(--accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 36%,transparent)}.deck-preview{position:relative;grid-row:span 2;width:72px;height:54px;overflow:hidden;border:1px solid color-mix(in srgb,var(--deck-accent,#fff) 68%,rgba(255,255,255,.15));border-radius:10px;background:linear-gradient(145deg,var(--deck-table-a,var(--tableA)),var(--deck-table-b,var(--tableB)));box-shadow:inset 0 0 0 1px rgba(255,255,255,.11),0 3px 8px rgba(0,0,0,.19)}.deck-preview-glow{position:absolute;inset:-22% -10% auto;height:76%;background:radial-gradient(ellipse at center,color-mix(in srgb,var(--deck-accent,#fff) 28%,transparent),transparent 70%);pointer-events:none}.deck-mini-card{position:absolute;display:grid;overflow:hidden;border-radius:6px;box-shadow:0 2px 4px rgba(0,0,0,.28)}.deck-mini-back{left:8px;bottom:7px;width:31px;height:41px;border:2px solid #fff8ea;background:repeating-linear-gradient(45deg,rgba(255,255,255,.24) 0 2px,transparent 2px 5px),linear-gradient(135deg,var(--deck-back-a,var(--backA)),var(--deck-back-b,var(--backB)))}.deck-mini-pattern{position:absolute;inset:4px;border:1px solid rgba(255,255,255,.52);border-radius:3px}.deck-mini-face{right:8px;top:6px;width:31px;height:41px;padding:3px;background:linear-gradient(145deg,var(--deck-front-a,#fff),var(--deck-front-b,#f1f1f1));color:#1d2928;border:1px solid rgba(0,0,0,.14);place-content:start}.deck-mini-rank{font-size:10px;font-weight:900;line-height:1}.deck-mini-face .deck-mini-suit{position:absolute;right:4px;bottom:4px;width:12px;height:12px;color:#182322}.deck-preview-accent{position:absolute;right:0;bottom:0;left:0;height:4px;background:var(--deck-accent,var(--accent))}.deck-copy{min-width:0}.deck-copy strong,.deck-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.deck-copy strong{font-size:12px}.deck-copy small{margin-top:2px;font-size:10px;opacity:.73}.deck-action{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:0;border:0;border-radius:8px;padding:7px 7px;background:var(--accent);color:#18372e;font-size:10px;line-height:1.12;text-align:center;font-weight:850;cursor:pointer;white-space:normal}.store-price{display:inline-flex;align-items:center;justify-content:center;gap:3px;white-space:nowrap;font-weight:900}.store-price b{font:inherit}.store-currency{font-size:.88em;letter-spacing:-.01em}.purchase-action{overflow:hidden;padding-left:4px;padding-right:4px}.purchase-cta{display:grid;grid-auto-flow:row;place-items:center;gap:2px;min-width:0;max-width:100%;line-height:1.02}.purchase-verb{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.purchase-action .store-price{max-width:100%;min-width:0;font-size:.92em;white-space:normal;flex-wrap:wrap;column-gap:2px;row-gap:0;line-height:1.02}.purchase-action .store-currency{overflow-wrap:anywhere}.deck-action .ui-icon{width:1em;height:1em}.deck-action.muted{background:rgba(255,255,255,.14);color:#fff;cursor:default}.deck-noads .deck-preview{display:grid;place-items:center;background:linear-gradient(145deg,#f6c565,#a96119);color:#42270e}.deck-noads .deck-preview .deck-noads-icon{width:27px;height:27px}.deck-noads .deck-preview:before,.deck-noads .deck-preview:after{content:none}.setting-row{display:flex;align-items:center;gap:12px;padding:11px;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:rgba(255,255,255,.065)}.setting-row+ .setting-row{margin-top:8px}.setting-row>div{flex:1}.setting-row small{display:block;margin-top:3px;font-size:12px;opacity:.72}.rules-list p{display:flex;gap:9px;margin:0 0 10px;line-height:1.4}.rules-list b{color:var(--accent)}.progress-summary{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:0 0 12px}.progress-summary span{padding:8px 9px;border:1px solid rgba(255,255,255,.14);border-radius:10px;background:rgba(255,255,255,.065);font-size:12px;line-height:1.25}.progress-summary b{color:var(--accent)}.menu-grid{margin-top:8px}.achievement-list{display:grid;gap:7px}.achievement-row{display:flex;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.14);border-radius:11px;background:rgba(255,255,255,.06);opacity:.78}.achievement-row.done{opacity:1;background:rgba(255,255,255,.1)}.achievement-mark{display:grid;place-items:center;flex:0 0 auto;width:26px;height:26px;border:1px solid rgba(255,255,255,.28);border-radius:50%;font-weight:900}.achievement-row.done .achievement-mark{background:var(--accent);color:#18372e;border-color:transparent}.achievement-mark .ui-icon{width:14px;height:14px}.achievement-row strong,.achievement-row small{display:block}.achievement-row strong{font-size:13px}.achievement-row small{margin-top:2px;font-size:11px;opacity:.77}.achievement-unlock{margin:0 0 14px;padding:10px;border:1px solid rgba(255,255,255,.2);border-radius:11px;background:rgba(255,255,255,.1);line-height:1.35}.achievement-unlock b{color:var(--accent)}
      #k-fx{position:fixed;inset:0;z-index:72;pointer-events:none;overflow:visible}.flight-card{pointer-events:none!important;filter:none;will-change:transform,opacity}#k-drag{position:fixed;z-index:100;left:0;top:0;width:var(--drag-w);height:var(--drag-h);display:block;visibility:hidden;opacity:0;pointer-events:none;transform:translate3d(-200vw,-200vh,0) translate(-28%,-18%) rotate(2deg);overflow:visible;will-change:transform;backface-visibility:hidden;-webkit-backface-visibility:hidden;contain:layout style}#k-drag .drag-stack-card{position:absolute!important;inset:auto 0 auto 0!important;top:var(--drag-stack-y,0px)!important;width:100%!important;height:var(--drag-h)!important;transform:none!important;transition:none!important;backface-visibility:hidden;-webkit-backface-visibility:hidden}
      @media (orientation:portrait){#kosynka-c3-root{--controls-h:calc(46px + env(safe-area-inset-bottom))}.k-top{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"brand menu" "stats stats";gap:6px;padding:7px 8px}.k-brand{grid-area:brand;font-size:16px}.k-brand small{display:none}.logo{width:29px;height:29px;border-radius:9px}.statbar{grid-area:stats;gap:5px;justify-content:stretch}.stat{flex:1;min-width:0;padding:4px 5px}.stat label{font-size:8px}.stat b{font-size:12px}.menu-btn{grid-area:menu;min-height:31px;padding:6px 9px;font-size:11px}.k-board-wrap{padding:7px 4px 3px}.k-board{gap:9px}.k-bottom{gap:4px;padding:6px 5px calc(6px + env(safe-area-inset-bottom))}.action-btn{min-height:34px;padding:6px 3px;font-size:10px}.action-btn .ico{font-size:13px;margin-right:2px}#k-toast{bottom:calc(var(--ad-reserve-h,0px) + var(--controls-h) + 6px);font-size:12px}.modal-card{border-radius:15px;padding:16px}.modal-card h2{font-size:22px;margin-bottom:8px}.modal-btn{min-height:39px}.deck-grid{gap:6px}.deck-tile{grid-template-columns:56px minmax(0,1fr);gap:4px 6px;padding:6px}.deck-preview{width:56px;height:44px;border-radius:8px}.deck-mini-back{left:6px;bottom:5px;width:25px;height:33px}.deck-mini-face{right:6px;top:5px;width:25px;height:33px}.deck-mini-rank{font-size:8px}.deck-mini-face .deck-mini-suit{width:10px;height:10px;right:3px;bottom:3px}.deck-copy strong{font-size:10px}.deck-copy small{font-size:8px}.deck-action{padding:6px 4px;font-size:9px}.purchase-action{padding:5px 3px;font-size:8px}.noads-purchase-action{font-size:7.7px}.menu-card{width:48px;height:63px;font-size:26px}.menu-hero{gap:10px}.menu-hero p{font-size:13px}.rules-list p{font-size:12px;margin-bottom:7px}.setting-row{padding:9px;font-size:12px}.setting-row small{font-size:10px}.modal-grid{gap:7px}.progress-summary{gap:5px;margin-bottom:9px}.progress-summary span{padding:6px 7px;font-size:10px}.achievement-row{gap:8px;padding:8px}.achievement-mark{width:23px;height:23px}.achievement-row strong{font-size:12px}.achievement-row small{font-size:10px}}
      /* Никаких горизонтальных полос в WebView/iframe: таблица и кнопки всегда ограничены viewport. */
      #kosynka-c3-root .k-top,#kosynka-c3-root .k-bottom,#kosynka-c3-root .statbar,#kosynka-c3-root .action-btn,#kosynka-c3-root .menu-btn{min-width:0;max-width:100%}
      #kosynka-c3-root .k-app,#kosynka-c3-root .k-board-wrap,#kosynka-c3-root .k-board,#kosynka-c3-root .top-row,#kosynka-c3-root .tableau-area{max-height:100%;min-height:0}
      #kosynka-c3-root.k-desktop-tight .top-row,#kosynka-c3-root.k-desktop-tight .tableau-area{gap:var(--pile-gap,4px)}
      #kosynka-c3-root.k-desktop-very-tight .modal-grid{grid-template-columns:1fr}.deck-tile{overflow:hidden}
      #kosynka-c3-root.is-reflowing{cursor:progress}#kosynka-c3-root.is-reflowing .card,#kosynka-c3-root.is-reflowing .pile,#kosynka-c3-root.is-reflowing .action-btn,#kosynka-c3-root.is-reflowing .menu-btn{transition:none!important;animation:none!important}
      @media (max-width:360px){.k-top{padding-left:5px;padding-right:5px}.k-brand{gap:5px;font-size:14px}.logo{width:26px;height:26px}.menu-btn{padding-left:7px;padding-right:7px}.k-board-wrap{padding-left:2px;padding-right:2px}.k-bottom{padding-left:3px;padding-right:3px}.action-btn{font-size:9px}.modal-card{padding:12px}.modal-grid{grid-template-columns:1fr}.deck-grid{grid-template-columns:1fr}.purchase-action{font-size:9px}.noads-purchase-action{font-size:8.5px}.progress-summary{grid-template-columns:1fr 1fr}}
      @media (max-height:430px){.brand-name small,.menu-label{display:none}.k-top{padding-top:4px;padding-bottom:4px}.k-bottom{padding-top:3px}.modal-card{padding:10px}.modal-card h2{font-size:19px}.modal-lead{font-size:11px}}
      @media (orientation:landscape) and (max-height:560px){#kosynka-c3-root{--controls-h:calc(38px + env(safe-area-inset-bottom))}.k-app{padding-bottom:var(--ad-reserve-h,0px)}.k-top{gap:7px;padding:5px 9px}.k-brand{gap:6px;font-size:15px}.k-brand small{display:none}.logo{width:28px;height:28px;border-radius:8px}.statbar{gap:4px}.stat{min-width:54px;padding:3px 5px;border-radius:8px}.stat label{font-size:8px}.stat b{margin-top:1px;font-size:11px}.menu-btn{min-height:30px;padding:5px 8px;font-size:10px}.k-board-wrap{padding:4px 8px 2px}.k-board{gap:6px}.k-bottom{gap:5px;padding:4px 8px calc(4px + env(safe-area-inset-bottom))}.action-btn{min-height:30px;padding:5px 4px;font-size:9px}.action-btn .ico{font-size:12px;margin-right:2px}.hint-badge{min-width:17px;height:17px;margin-left:3px;padding:0 4px;font-size:9px}#k-toast{bottom:calc(var(--ad-reserve-h,0px) + var(--controls-h) + 5px);padding:7px 10px;font-size:11px}.modal-card{max-height:calc(var(--viewport-h,100dvh) - 12px);padding:12px;border-radius:12px}.modal-card h2{font-size:20px;margin-bottom:7px}.modal-lead{margin-bottom:9px;font-size:12px}.modal-btn{min-height:34px;padding:7px 9px;font-size:11px}.reward-note{padding:7px 8px;font-size:10px}.menu-card{width:38px;height:50px;font-size:22px}.menu-hero{gap:8px;margin-bottom:8px}.menu-hero p{font-size:11px}.rules-list p{font-size:11px;margin-bottom:5px}.setting-row{padding:7px;font-size:11px}.setting-row small{font-size:9px}.deck-grid{gap:5px}.deck-tile{grid-template-columns:48px minmax(0,1fr);gap:3px 5px;padding:5px}.deck-preview{width:48px;height:38px;border-radius:7px}.deck-mini-back{left:5px;bottom:4px;width:21px;height:29px}.deck-mini-face{right:5px;top:4px;width:21px;height:29px}.deck-mini-rank{font-size:7px}.deck-mini-face .deck-mini-suit{width:8px;height:8px;right:2px;bottom:2px}.deck-copy strong{font-size:9px}.deck-copy small{font-size:8px}.deck-action{padding:5px 4px;font-size:8px}.progress-summary{gap:4px;margin-bottom:7px}.progress-summary span{padding:5px 6px;font-size:9px}.achievement-row{padding:6px;gap:6px}.achievement-mark{width:20px;height:20px}.achievement-row strong{font-size:10px}.achievement-row small{font-size:9px}}
    `;
    document.head.appendChild(style);

    app = document.createElement("div");
    app.id = "kosynka-c3-root";
    app.lang = locale;
    app.dataset.locale = locale;
    app.innerHTML = `
      <main class="k-app">
        <header class="k-top">
          <div class="k-brand"><span class="logo">${uiIcon("spade", "brand-spade")}</span><span class="brand-name">${t("brand")}<small>${t("subtitle")}</small></span></div>
          <div class="statbar">
            <div class="stat"><label>${t("score")}</label><b id="k-score">0</b></div>
            <div class="stat"><label>${t("moves")}</label><b id="k-moves">0</b></div>
            <div class="stat"><label>${t("time")}</label><b id="k-time">00:00</b></div>
          </div>
          <button class="menu-btn" data-action="menu" aria-label="${escapeHtml(t("openMenu"))}" title="${escapeHtml(t("menu"))}">${uiIcon("menu", "button-icon")}<span class="menu-label">${t("menu")}</span></button>
        </header>
        <div class="k-board-wrap"><section class="k-board">
          <div class="top-row">
            <div class="stock-area"><div id="k-stock"></div><div id="k-waste"></div></div>
            <div class="top-spacer" aria-hidden="true"></div>
            <div class="foundation-area" id="k-foundations"></div>
          </div>
          <div class="tableau-area" id="k-tableaus"></div>
        </section></div>
        <footer class="k-bottom">
          <button class="action-btn" id="k-undo" data-action="undo" aria-label="${escapeHtml(t("undoMove"))}" title="${escapeHtml(t("undoMove"))}"><span class="ico">${uiIcon("undo")}</span><span class="action-label">${t("undo")}</span></button>
          <button class="action-btn" id="k-hint" data-action="hint" aria-label="${escapeHtml(t("hint"))}" title="${escapeHtml(t("hint"))}"><span class="ico">${uiIcon("hint")}</span><span class="action-label">${t("hint")}</span><span class="hint-badge" id="k-hint-count">5</span></button>
          <button class="action-btn" data-action="autofinish" aria-label="${escapeHtml(t("autoFinish"))}" title="${escapeHtml(t("autoFinish"))}"><span class="ico">${uiIcon("autofinish")}</span><span class="action-label">${t("autoFinish")}</span></button>
        </footer>
      </main>
      <div id="k-toast" role="status"></div>
      <div id="k-fx" aria-hidden="true"></div>
      <div id="k-modal"></div>
      <div id="k-drag"></div>`;
    document.body.appendChild(app);
  }

  function originFromElement(element) {
    const card = element?.closest?.(".card");
    if (!card) return null;
    const zone = card.dataset.zone;
    if (!zone || !["tableau", "waste", "foundation"].includes(zone)) return null;
    const origin = { zone, pile: Number(card.dataset.pile || 0) };
    if (zone === "tableau") origin.index = Number(card.dataset.index);
    return origin;
  }

  function destinationFromPoint(x, y) {
    const element = document.elementFromPoint(x, y);
    const pile = element?.closest?.(".pile");
    if (!pile) return null;
    const zone = pile.dataset.zone;
    if (zone !== "tableau" && zone !== "foundation") return null;
    return { zone, pile: Number(pile.dataset.pile || 0) };
  }

  function handleCardClick(origin) {
    clearHintMarks();
    if (interactionLocked || viewportReflowing || !game || game.finished) return;
    const cards = getSourceCards(origin);
    if (!cards.length) {
      if (origin.zone === "tableau") flipTableauCard(origin.pile);
      return;
    }
    if (selection && sameOrigin(selection, origin)) {
      clearSelectionVisual();
      return;
    }
    if (selection) {
      const target = origin.zone === "foundation"
        ? { zone: "foundation", pile: origin.pile }
        : { zone: "tableau", pile: origin.pile };
      if (makeMove(selection, target)) {
        toast(t("moveDone"));
        return;
      }
    }
    setSelectionVisual(origin);
  }

  function handlePileClick(pile) {
    clearHintMarks();
    if (interactionLocked || viewportReflowing || !pile || !game) return;
    const zone = pile.dataset.zone;
    if (zone === "stock") {
      drawFromStock();
      return;
    }
    if (selection && (zone === "tableau" || zone === "foundation")) {
      if (makeMove(selection, { zone, pile: Number(pile.dataset.pile || 0) })) {
        toast(t("moveDone"));
      }
    }
  }

  function markDragSource(origin) {
    if (!app) return;
    if (origin.zone === "tableau") {
      app.querySelectorAll(`[data-zone="tableau"][data-pile="${origin.pile}"] .card`).forEach(card => {
        if (Number(card.dataset.index) >= origin.index) card.classList.add("drag-source");
      });
      return;
    }
    app.querySelector(selectorForOrigin(origin))?.classList.add("drag-source");
  }

  function clearDragVisual() {
    const currentDrag = drag;
    if (currentDrag?.sourceHideFrame) cancelAnimationFrame(currentDrag.sourceHideFrame);
    const visual = app?.querySelector("#k-drag");
    if (visual) {
      // The drag layer stays composited between drags; hiding it avoids a display:none -> block paint flash.
      visual.style.visibility = "hidden";
      visual.style.opacity = "0";
      visual.style.transform = "translate3d(-200vw,-200vh,0) translate(-28%,-18%) rotate(2deg)";
      visual.style.height = "var(--drag-h)";
      visual.innerHTML = "";
    }
    app?.querySelectorAll(".drag-source").forEach(node => node.classList.remove("drag-source"));
    drag = null;
  }

  function beginDrag(event, origin) {
    clearHintMarks();
    const cards = getSourceCards(origin);
    if (!cards.length) return;
    drag = {
      pointerId: event.pointerId,
      origin,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      sourceHideFrame: 0
    };
    // Prepare the drag stack while it is hidden/off-screen so the first visible drag frame is already painted.
    renderDragStack(cards);
    try { event.target?.setPointerCapture?.(event.pointerId); } catch (_) { /* Pointer capture is optional. */ }
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const visual = app?.querySelector("#k-drag");
    if (!visual) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    const transform = `translate3d(${event.clientX}px,${event.clientY}px,0) translate(-28%,-18%) rotate(2deg)`;
    if (!drag.active && distance >= 7) {
      drag.active = true;
      // Show and position the already-rendered clone first. Hide the original only on the next paint.
      // This removes the one-frame gap that looked like the card was blinking on drag start.
      visual.style.transform = transform;
      visual.style.visibility = "visible";
      visual.style.opacity = "1";
      const pointerId = drag.pointerId;
      drag.sourceHideFrame = requestAnimationFrame(() => {
        if (!drag || !drag.active || drag.pointerId !== pointerId) return;
        markDragSource(drag.origin);
        drag.sourceHideFrame = 0;
      });
    }
    if (!drag.active) return;
    event.preventDefault();
    visual.style.transform = transform;
  }

  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const current = drag;
    const wasActive = current.active;
    if (current.sourceHideFrame) cancelAnimationFrame(current.sourceHideFrame);
    if (!wasActive) {
      clearDragVisual();
      return;
    }
    suppressClicksUntil = Date.now() + 260;
    const target = event.type === "pointercancel" ? null : destinationFromPoint(event.clientX, event.clientY);
    // Keep the drag clone visible while a successful move is committed/rendered. Clearing it before makeMove()
    // briefly revealed the source card again and caused a second flash at drop time.
    if (target && makeMove(current.origin, target)) {
      clearDragVisual();
      toast(t("moveDone"));
      return;
    }
    clearDragVisual();
    clearSelectionVisual();
  }

  function bindEvents() {
    const preventNativeInteraction = event => event.preventDefault();
    app.addEventListener("contextmenu", preventNativeInteraction);
    app.addEventListener("selectstart", preventNativeInteraction);
    app.addEventListener("dragstart", preventNativeInteraction);
    app.addEventListener("gesturestart", preventNativeInteraction, { passive: false });
    app.addEventListener("gesturechange", preventNativeInteraction, { passive: false });
    app.addEventListener("gestureend", preventNativeInteraction, { passive: false });

    app.addEventListener("click", async event => {
      if (Date.now() < suppressClicksUntil) return;
      const button = event.target.closest("button[data-action]");
      if (button) {
        const action = button.dataset.action;
        if (action === "undo") undo();
        else if (action === "hint") showHint();
        else if (action === "reward-hints") await rewardHints();
        else if (action === "autofinish") await autoFinish();
        else if (action === "menu") showMainMenu();
        else if (action === "store") openStore();
        else if (action === "achievements") showAchievements();
        else if (action === "leaderboard") await openLeaderboard();
        else if (action === "settings") showSettings();
        else if (action === "how-to") showHowTo();
        else if (action === "new-game") await startFreshGame();
        else if (action === "continue-game") continueGame();
        else if (action === "close-modal") closeModal();
        else if (action === "confirm-end") endGame();
        else if (action === "abandon") askToEndGame();
        else if (action === "toggle-draw") toggleDraw();
        else if (action === "shop-tab") openStore(button.dataset.tab);
        else if (action === "select-skin") {
          profile.skin = button.dataset.skin;
          applySkin();
          scheduleSave();
          openStore(shopTab);
        } else if (action === "reward-skin") await rewardSkin(button.dataset.skin);
        else if (action === "buy-skin") await purchaseSkin(button.dataset.skin);
        else if (action === "buy-noads") await purchaseNoAds();
        else if (action === "login-for-purchase") await loginForPendingPurchase(button.dataset.purchaseKind, button.dataset.skin || "");
        return;
      }

      const card = event.target.closest(".card");
      const origin = originFromElement(card);
      if (origin) {
        handleCardClick(origin);
        return;
      }
      const pile = event.target.closest(".pile");
      if (pile) handlePileClick(pile);
    });

    app.addEventListener("dblclick", event => {
      const origin = originFromElement(event.target);
      if (origin) autoMove(origin);
    });

    app.addEventListener("pointerdown", event => {
      if (interactionLocked || viewportReflowing || !game || game.finished) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const origin = originFromElement(event.target);
      if (origin) beginDrag(event, origin);
    });
    app.addEventListener("pointermove", moveDrag, { passive: false });
    window.addEventListener("pointerup", finishDrag, true);
    window.addEventListener("pointercancel", finishDrag, true);
    window.addEventListener("blur", () => {
      pauseGameClock();
      if (drag) {
        clearDragVisual();
        render();
      }
    });
    bindViewportLayoutEvents();

    const recoverAfterPlatformUi = () => {
      if (profile?.noAds) platform.enforceNoAdsSticky();
      if (platform.kind === "gamepush" && platform.pendingPurchaseTags?.size) {
        platform.reconcilePendingPurchases();
      }
      const adStillPlaying = Boolean(platform.kind === "gamepush" && (platform.gp?.ads?.isRewardedPlaying || platform.gp?.ads?.isFullscreenPlaying));
      if (interactionLocked && !adStillPlaying) finishExternalInteraction();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        pauseGameClock();
        saveNow();
      } else {
        recoverAfterPlatformUi();
        resumeGameClock();
      }
    });
    window.addEventListener("focus", () => {
      recoverAfterPlatformUi();
      resumeGameClock();
    });
    window.addEventListener("pagehide", () => {
      pauseGameClock();
      if (game && profile) localWrite(buildPayload());
    });
  }

  async function bootstrap() {
    await platform.init();
    setLocale(await platform.getLanguage());
    buildApp();
    bindEvents();

    const saved = await platform.load();
    profile = validProfile(saved?.profile);
    const entitlementsChanged = await platform.syncEntitlements(profile);
    const noAdsSkinsChanged = unlockRewardSkinsForNoAds(profile).length > 0;
    if (entitlementsChanged || noAdsSkinsChanged) localWrite({ schema: 3, savedAt: Date.now(), game: saved?.game || null, profile: deepCopy(profile) });
    refreshProgression();
    const savedGame = normalizeGame(saved?.game);
    game = savedGame || newGameState();
    hasSavedGame = Boolean(savedGame && !savedGame.finished);

    // Preloader is intentionally Yandex-only. VK/OK must not receive a startup preloader from this build.
    if (!profile.noAds) await platform.showPreloaderIfYandex();
    // The first fullscreen can become eligible only 180 seconds after startup/preloader completes.
    armInterstitialTimer();

    applySkin();
    syncViewportVariables();
    render();
    requestViewportReflow(true);
    // Send Game Ready only after Yandex preloader is closed and the real interactive UI is rendered.
    await platform.sendGameReadyIfYandex();
    if (!profile.noAds) {
      const bannerShown = await platform.showBanner();
      setBannerReserve(bannerShown);
    } else {
      // Important for Yandex: a sticky can be auto-started before our save is restored.
      await platform.enforceNoAdsSticky();
      setBannerReserve(false);
    }

    timerInterval = setInterval(() => {
      if (!game?.finished) {
        const clock = app?.querySelector("#k-time");
        if (clock) clock.textContent = formatTime(getElapsed());
      }
    }, 1000);

    showMainMenu();
  }

  try {
    await bootstrap();
  } catch (error) {
    console.error("[Kosynka] Ошибка запуска", error);
    clearInterval(timerInterval);
    viewportObserver?.disconnect?.();
    clearViewportSettleTimers();
    document.getElementById("kosynka-c3-root")?.remove();
    document.getElementById("kosynka-c3-style")?.remove();
    window.__KOSYNKA_C3_MOUNTED__ = false;
  }
})();
	}
};

globalThis.C3.JavaScriptInEvents = scriptsInEvents;
