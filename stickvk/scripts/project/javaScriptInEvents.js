

const scriptsInEvents = {

	async Game_Event1_Act3(runtime, localVars)
	{
		// Отправляем GameReady напрямую через ядро GamePush
		if (typeof gp !== 'undefined' && gp.app) {
		    gp.app.requestGameReady();
		    console.log("✅ GameReady отправлен скриптом!");
		}
	},

	async Game_Event2_Act1(runtime, localVars)
	{
// =====================================================================
// 🌍 СИСТЕМА ЛОКАЛИЗАЦИИ (СЛОВАРЬ)
// =====================================================================
if (!globalThis.currentLang) {
    // Берем первые две буквы языка системы
    const browserLang = navigator.language.slice(0, 2).toLowerCase(); 
    // Если язык не из нашего списка - ставим английский
    globalThis.currentLang = ['ru', 'en', 'tr', 'pt'].includes(browserLang) ? browserLang : 'en';
}

globalThis.i18n = {
    ru: {
        victoryTitle: "Уровень пройден",
        btnNext: "Дальше ➔",
        btnSkip: "Пропустить уровень",
        adsBadge: "РЕКЛАМА",
        hintTitle: "УПРАВЛЕНИЕ",
        hintMobile: "<b><</b> - бег влево. <b>></b> - бег вправо. <b>^</b> - прыжок. <b>^</b> + <b>^</b> - двойной прыжок.",
        hintPcRun: "<b>A / D</b> или <b>Стрелки</b> — Бег",
        hintPcJump: "<b>Пробел</b> или <b>Стрелка вверх</b> — Прыжок",
        hintPcDouble: "Прыгай дважды для двойного прыжка!",
        finalTitle: "ИГРА ПРОЙДЕНА!",
        finalDesc: "Ты прошёл все смертоносные ловушки и полностью завершил игру! Настоящий мастер!",
        btnRestartAll: "Начать заново",
        btnInvite: "Пригласить",
        btnSubscribe: "Подписаться"
    },
    en: {
        victoryTitle: "Level Cleared",
        btnNext: "Next ➔",
        btnSkip: "Skip Level",
        adsBadge: "AD",
        hintTitle: "CONTROLS",
        hintMobile: "<b><</b> - run left. <b>></b> - run right. <b>^</b> - jump. <b>^</b> + <b>^</b> - double jump.",
        hintPcRun: "<b>A / D</b> or <b>Arrows</b> — Run",
        hintPcJump: "<b>Space</b> or <b>Arrow Up</b> — Jump",
        hintPcDouble: "Jump twice for double jump!",
        finalTitle: "GAME CLEARED!",
        finalDesc: "You survived all the deadly traps and finished the game! A true master!",
        btnRestartAll: "Restart Game",
        btnInvite: "Invite",
        btnSubscribe: "Subscribe"
    },
    tr: {
        victoryTitle: "Bölüm Tamamlandı",
        btnNext: "İleri ➔",
        btnSkip: "Bölümü Geç",
        adsBadge: "REKLAM",
        hintTitle: "KONTROLLER",
        hintMobile: "<b><</b> - sola koş. <b>></b> - sağa koş. <b>^</b> - zıpla. <b>^</b> + <b>^</b> - çift zıplama.",
        hintPcRun: "<b>A / D</b> veya <b>Ok Tuşları</b> — Koşma",
        hintPcJump: "<b>Boşluk</b> veya <b>Yukarı Ok</b> — Zıplama",
        hintPcDouble: "Çift zıplamak için iki kez zıpla!",
        finalTitle: "OYUN TAMAMLANDI!",
        finalDesc: "Tüm ölümcül tuzaklardan kurtuldun ve oyunu bitirdin! Gerçek bir usta!",
        btnRestartAll: "Yeniden Başla",
        btnInvite: "Davet Et",
        btnSubscribe: "Abone Ol"
    },
    pt: {
        victoryTitle: "Nível Concluído",
        btnNext: "Próximo ➔",
        btnSkip: "Pular Nível",
        adsBadge: "ANÚNCIO",
        hintTitle: "CONTROLES",
        hintMobile: "<b><</b> - correr para esquerda. <b>></b> - correr para direita. <b>^</b> - pular. <b>^</b> + <b>^</b> - pulo duplo.",
        hintPcRun: "<b>A / D</b> ou <b>Setas</b> — Correr",
        hintPcJump: "<b>Espaço</b> ou <b>Seta para Cima</b> — Pular",
        hintPcDouble: "Pule duas vezes para um pulo duplo!",
        finalTitle: "JOGO CONCLUÍDO!",
        finalDesc: "Você sobreviveu a todas as armadilhas mortais e terminou o jogo! Um verdadeiro mestre!",
        btnRestartAll: "Recomeçar",
        btnInvite: "Convidar",
        btnSubscribe: "Inscrever-se"
    }
};

globalThis.t = (key) => {
    return globalThis.i18n[globalThis.currentLang][key] || globalThis.i18n['en'][key] || key;
};

// --- 0. УМНЫЙ СБРОС ПРИ СМЕНЕ УРОВНЯ ---
if (globalThis.currentLevelTracker !== runtime.layout.name) {
    globalThis.currentLevelTracker = runtime.layout.name;
    
    globalThis.isWaitingForUI = false; 
    globalThis.isEnteringPortal = false; 
    globalThis.isDead = false; 
    globalThis.deathCount = 0; 
    globalThis.lavaSpeed = 15;
    runtime.timeScale = 1; 

    // 🔥 БЕРЕМ ДАННЫЕ ПРЯМО С PLAYERBOX
    const collider = runtime.objects.PlayerBox ? runtime.objects.PlayerBox.getFirstInstance() : null;
    const player = runtime.objects.Player ? runtime.objects.Player.getFirstInstance() : null;

    if (collider) {
        // Ставим камеру ровно туда, где физически лежит PlayerBox на этом уровне
        runtime.layout.scrollTo(collider.x, collider.y);
        globalThis.camX = collider.x;
        globalThis.camY = collider.y;
        
        // Возвращаем управление
        if (collider.behaviors.Platform) {
            collider.behaviors.Platform.isEnabled = true;
        }

        // Подтягиваем визуального стикмена к коллайдеру
        if (player) {
            player.x = collider.x;
            player.y = collider.y;
            player.opacity = 1;
            player.width = collider.width;
            player.height = collider.height;
        }
    }

    const currentNum = parseInt(runtime.layout.name.toLowerCase().replace("lvl", "")) || 1;
    if ("MaxLevel" in runtime.globalVars && currentNum > runtime.globalVars.MaxLevel) {
        runtime.globalVars.MaxLevel = currentNum;
    }
    
    console.log(`🌍 Загружен ${runtime.layout.name} | Текущий MaxLevel: ${runtime.globalVars.MaxLevel} | Язык: ${globalThis.currentLang}`);
}

// --- ИММУНИТЕТ ОТ РЕКЛАМЫ (Реальное время) ---
if (globalThis.lastAdTime === undefined || globalThis.lastAdTime < 1000000000) {
    globalThis.lastAdTime = Date.now();
}
// ПРЕДОХРАНИТЕЛЬ ОТ СПАМА
if (globalThis.isDead || globalThis.isWaitingForUI) return;

const collider = runtime.objects.PlayerBox.getFirstInstance();
const player = runtime.objects.Player.getFirstInstance();
const deathZone = runtime.objects.DeathZone ? runtime.objects.DeathZone.getFirstInstance() : null;

if (!collider || !player) return;

const platform = collider.behaviors.Platform;
const dt60 = runtime.dt * 60;

if (globalThis.levelTimer === undefined) globalThis.levelTimer = 0;
globalThis.levelTimer += runtime.dt;

// =====================================================================
// 🎨 СИСТЕМА НЕОНОВЫХ ЦВЕТОВ
// =====================================================================
const neonColors = [
    [1, 0.2, 0.2], [0.2, 1, 0.2], [0.2, 0.5, 1], 
    [1, 1, 0.2], [1, 0.2, 1], [0.2, 1, 1], [1, 0.6, 0.1]
];

const pickNewColor = () => {
    let newCol;
    do {
        newCol = neonColors[Math.floor(Math.random() * neonColors.length)];
    } while (
        globalThis.playerColor && 
        newCol[0] === globalThis.playerColor[0] && 
        newCol[1] === globalThis.playerColor[1] && 
        newCol[2] === globalThis.playerColor[2]
    );
    return newCol;
};

// Если цвета нет (например, при первом запуске или после смерти) - выбираем новый
if (globalThis.playerColor === undefined) {
    globalThis.playerColor = pickNewColor(); 
}

// Красим персонажа только если он ЖИВ
if (!globalThis.isDead) {
    player.colorRgb = globalThis.playerColor;
}


// =====================================================================
// 🛑 СОСТОЯНИЕ 1: КИНЕМАТИКА ПОРТАЛА 🛑
// =====================================================================
// Добавили проверку: portalTriggered, чтобы исключить дублирование
if (!globalThis.isEnteringPortal && !globalThis.isWaitingForUI && runtime.objects.Portal) {
    for (const portal of runtime.objects.Portal.instances()) {
        if (collider.testOverlap(portal)) {
            // 🔥 ЖЕСТКИЙ ЗАМОК: меняем флаг сразу
            globalThis.isEnteringPortal = true;
            
            // Проверка, чтобы не плодить UI
            if (document.getElementById('victory-screen')) return; 
            
            c3_callFunction("GamePush.Analytics.Goal", ["finish_" + runtime.layout.name, 1]);
            globalThis.portalTimer = 0.5; 
            globalThis.portalX = portal.x;
            globalThis.portalY = portal.y;

            platform.isEnabled = false; 
            platform.vectorX = 0;
            platform.vectorY = 0;

            player.setAnimation("jump");
            
            if ("PlaySound" in runtime.globalVars) runtime.globalVars.PlaySound = "transition";
        }
    }
}

if (globalThis.isEnteringPortal) {
    globalThis.portalTimer -= runtime.dt; 

    player.x += (globalThis.portalX - player.x) * (0.1 * dt60);
    player.y += (globalThis.portalY - player.y) * (0.1 * dt60);

    globalThis.tilt += 0.5 * dt60;
    player.angle = globalThis.tilt;
    player.opacity = Math.max(0, player.opacity - runtime.dt * 1.5); 
    player.width = Math.max(0, player.width - player.width * (0.04 * dt60));
    player.height = Math.max(0, player.height - player.height * (0.04 * dt60));

    const layout = runtime.layout;
    if (globalThis.camX !== undefined && globalThis.camY !== undefined) {
        globalThis.camX += (globalThis.portalX - globalThis.camX) * (0.1 * dt60);
        globalThis.camY += (globalThis.portalY - globalThis.camY) * (0.1 * dt60);
        layout.scrollTo(Math.round(globalThis.camX), Math.round(globalThis.camY));
    }

    if (globalThis.portalTimer <= 0) {
        globalThis.isEnteringPortal = false; 
        globalThis.isWaitingForUI = true; 
        
        globalThis.camX = undefined; 
        globalThis.camY = undefined;
        globalThis.tilt = 0;
        
        const currentName = layout.name; 
        const currentNum = parseInt(currentName.toLowerCase().replace("lvl", "")) || 1;
        const nextLevelNum = currentNum + 1;

        // 🔥 ХАРДКОДИМ КОНЕЦ ИГРЫ НА 25 УРОВЕНЬ
        const TOTAL_LEVELS = 25; 

        if ("MaxLevel" in runtime.globalVars && nextLevelNum > runtime.globalVars.MaxLevel) {
            runtime.globalVars.MaxLevel = Math.min(nextLevelNum, TOTAL_LEVELS);
            if ("TriggerSave" in runtime.globalVars) {
                runtime.globalVars.TriggerSave = 1;
            }
        }
        
        globalThis.targetLevelName = "lvl" + nextLevelNum;

        if (!document.getElementById('victory-screen')) {
            const uiContainer = document.createElement('div');
            uiContainer.id = 'victory-screen';
            uiContainer.style.position = 'absolute';
            uiContainer.style.top = '0';
            uiContainer.style.left = '0';
            uiContainer.style.width = '100%';
            uiContainer.style.height = '100%';
            uiContainer.style.backgroundColor = 'rgba(5, 5, 10, 0.4)'; 
            uiContainer.style.display = 'flex';
            uiContainer.style.justifyContent = 'center';
            uiContainer.style.alignItems = 'center';
            uiContainer.style.zIndex = '9999';
            uiContainer.style.fontFamily = '"Segoe UI", Roboto, Helvetica, Arial, sans-serif';
            uiContainer.style.overflow = 'hidden'; 
            uiContainer.style.opacity = '0';
            uiContainer.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)';

            const isMobileUI = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // 🔀 РАЗВИЛКА: ЕСЛИ ЭТО КОНЕЦ ИГРЫ
            if (currentNum >= TOTAL_LEVELS) {
                // 🎆 ЭФФЕКТ ФЕЙЕРВЕРКА
                let fireworkHTML = '';
                const fwColors = ['#FF1493', '#00FFFF', '#FFD700', '#00FF00', '#FF4500', '#9400D3'];
                
                for (let f = 0; f < 5; f++) {
                    const centerX = 15 + Math.random() * 70; 
                    const centerY = 20 + Math.random() * 50; 
                    for (let i = 0; i < 30; i++) {
                        const angle = (i / 30) * Math.PI * 2;
                        const distance = 80 + Math.random() * 120;
                        const color = fwColors[Math.floor(Math.random() * fwColors.length)];
                        const delay = Math.random() * 0.5; 
                        
                        fireworkHTML += `<div style="
                            position: absolute; left: ${centerX}%; top: ${centerY}%;
                            width: 6px; height: 6px; background: ${color}; border-radius: 50%;
                            box-shadow: 0 0 10px ${color}, 0 0 20px ${color};
                            opacity: 0; pointer-events: none;
                            transform: translate(-50%, -50%);
                            animation: explode 1.8s cubic-bezier(0.1, 0.8, 0.3, 1) ${delay}s infinite;
                        "></div>`;
                    }
                }

                uiContainer.innerHTML = `
                    <style>
                        @keyframes explode { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 80% { opacity: 0.8; } 100% { transform: translate(calc(-50% + var(--mx)), calc(-50% + var(--my))) scale(0.1); opacity: 0; } }
                        @keyframes pulseGold { 0% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.4); filter: brightness(1); } 50% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.8); filter: brightness(1.2); } 100% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.4); filter: brightness(1); } }
                        .final-panel {
                            position: relative; z-index: 2;
                            background: linear-gradient(135deg, rgba(25, 25, 35, 0.95), rgba(10, 10, 15, 0.98));
                            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                            padding: 50px 60px; border-radius: 32px; text-align: center;
                            border: 2px solid #FFD700; box-shadow: 0 30px 60px rgba(0,0,0,0.6);
                            max-width: 450px; width: 85%;
                        }
                        .final-panel h1 { color: #FFD700; font-size: 38px; font-weight: 900; margin: 0 0 15px 0; letter-spacing: 2px; text-shadow: 0 0 20px rgba(255, 215, 0, 0.6); text-transform: uppercase; }
                        .final-panel p { color: #e0e0e0; font-size: 18px; margin: 0 0 35px 0; line-height: 1.5; }
                        .btn-restart-all {
                            padding: 16px 45px; font-size: 20px; font-weight: 800; color: #000000;
                            background: linear-gradient(180deg, #FFE600 0%, #FFB700 100%);
                            border: none; border-radius: 18px; cursor: pointer; text-transform: uppercase;
                            letter-spacing: 1px; transition: transform 0.1s;
                            animation: pulseGold 2s infinite ease-in-out;
                        }
                        .btn-restart-all:active { transform: scale(0.95); }
                    </style>
                    <div class="fw-layer" style="position: absolute; width: 100%; height: 100%; z-index: 1; pointer-events: none;">${fireworkHTML}</div>
                    <div class="final-panel">
                        <h1>${globalThis.t('finalTitle')}</h1>
                        <p>${globalThis.t('finalDesc')}</p>
                        <button id="btn-restart-game" class="btn-restart-all">${globalThis.t('btnRestartAll')}</button>
                    </div>
                `;

                document.body.appendChild(uiContainer);
                const sparks = uiContainer.querySelectorAll('.fw-layer div');
                sparks.forEach(spark => {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 100 + Math.random() * 150;
                    spark.style.setProperty('--mx', `${Math.cos(angle) * dist}px`);
                    spark.style.setProperty('--my', `${Math.sin(angle) * dist}px`);
                });

                requestAnimationFrame(() => uiContainer.style.opacity = '1');

                document.getElementById('btn-restart-game').onclick = () => {
                    uiContainer.style.opacity = '0';
                    
                    // 1. Сообщаем облаку, что прогресс сброшен
                    if ("MaxLevel" in runtime.globalVars) runtime.globalVars.MaxLevel = 1;
                    if ("TriggerSave" in runtime.globalVars) runtime.globalVars.TriggerSave = 1;

                    setTimeout(() => {
                        uiContainer.remove();
                        
                        // 2. ВРУБАЕМ "ГЛУШИЛКУ" ОБЛАКА
                        const jammer = setInterval(() => {
                            if ("MaxLevel" in runtime.globalVars) {
                                runtime.globalVars.MaxLevel = 1;
                            }
                        }, 10);
                        
                        // 3. Прыгаем на первый уровень
                        runtime.goToLayout("lvl1");
                        
                        // 4. Отключаем глушилку
                        setTimeout(() => {
                            clearInterval(jammer); 
                            
                            const collider = runtime.objects.PlayerBox?.getFirstInstance();
                            if (collider) {
                                runtime.layout.scrollTo(collider.x, collider.y);
                                globalThis.camX = collider.x;
                                globalThis.camY = collider.y;
                            } else {
                                runtime.layout.scrollTo(0, 0);
                            }
                        }, 1000);
                        
                    }, 400);
                };

            } else {
                // ==========================================
                // ➡️ ОБЫЧНЫЙ ЭКРАН ПОБЕДЫ (С КОНФЕТТИ И КНОПКАМИ)
                // ==========================================
                let confettiHTML = '';
                const colors = ['#FFC700', '#FF3D00', '#00E676', '#2979FF', '#D500F9'];
                for(let i = 0; i < 70; i++) {
                    const left = Math.random() * 100; 
                    const duration = 2.5 + Math.random() * 3; 
                    const delay = -(Math.random() * 5); 
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    const width = 6 + Math.random() * 8; 
                    const height = 12 + Math.random() * 15; 
                    
                    confettiHTML += `<div style="
                        position: absolute; left: ${left}%; width: ${width}px; height: ${height}px; 
                        background: ${color}; border-radius: 2px; opacity: 0.85; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        animation: fall ${duration}s linear ${delay}s infinite, spin ${duration/1.5}s ease-in-out ${delay}s infinite alternate;
                    "></div>`;
                }

                const starSvg = `<svg viewBox="0 0 24 24" width="50" height="50" style="filter: drop-shadow(0px 6px 8px rgba(0,0,0,0.3));"><path fill="url(#gold-grad)" d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" stroke="#FFE066" stroke-width="0.5"/><defs><linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFF275"/><stop offset="100%" stop-color="#F5A623"/></linearGradient></defs></svg>`;

                uiContainer.innerHTML = `
                    <style>
                        @keyframes fall { 0% { top: -10%; } 100% { top: 110%; } }
                        @keyframes spin { 0% { transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg); } 100% { transform: rotateX(360deg) rotateY(180deg) rotateZ(180deg); } }
                        @keyframes popIn3D { 0% { transform: perspective(1200px) rotateX(-25deg) translateY(60px) scale(0.7); opacity: 0; } 60% { transform: perspective(1200px) rotateX(10deg) translateY(-10px) scale(1.05); opacity: 1; } 100% { transform: perspective(1200px) rotateX(0deg) translateY(0) scale(1); opacity: 1; } }
                        @keyframes starPop { 0% { transform: scale(0) rotate(-60deg); opacity: 0; filter: blur(4px); } 60% { transform: scale(1.3) rotate(20deg); opacity: 1; filter: blur(0px); } 100% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0px); } }
                        .confetti-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
                        .victory-panel { position: relative; z-index: 1; background: linear-gradient(135deg, rgba(220, 230, 255, 0.15), rgba(255, 255, 255, 0.05)); backdrop-filter: blur(24px) saturate(150%); -webkit-backdrop-filter: blur(24px) saturate(150%); padding: 45px 70px; border-radius: 32px; border: 1px solid rgba(255, 255, 255, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.5); border-left: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 40px 80px rgba(0,0,0,0.4), inset 0 0 20px rgba(255,255,255,0.05); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 20px; animation: popIn3D 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                        .victory-panel h1 { color: #ffffff; margin: 0; font-size: 32px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; text-shadow: 0 5px 15px rgba(0,0,0,0.5); }
                        .stars-container { display: flex; gap: 15px; margin: 15px 0 25px 0; }
                        .star-wrap { opacity: 0; }
                        .star-1 { animation: starPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.3s forwards; }
                        .star-2 { animation: starPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.45s forwards; } 
                        .star-3 { animation: starPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.6s forwards; }
                        .star-2 svg { transform: translateY(-15px) scale(1.15); }
                        .btn-next { padding: 16px 50px; font-size: 20px; font-weight: 800; color: #ffffff; background: linear-gradient(180deg, #66D27A 0%, #43A054 100%); border: 1px solid rgba(255,255,255,0.3); border-radius: 18px; cursor: pointer; box-shadow: 0 6px 0 #2E7D32, 0 15px 25px rgba(67, 160, 84, 0.4); transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1); text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }
                        .btn-next:active { transform: translateY(6px) scale(0.97); box-shadow: 0 0 0 #2E7D32, 0 5px 10px rgba(67, 160, 84, 0.3); }
                        
                        /* 👇 СТИЛИ СОЦИАЛЬНЫХ КНОПОК 👇 */
                        .social-box { display: flex; gap: 12px; margin-top: 10px; }
                        .btn-social { padding: 12px 24px; font-size: 16px; font-weight: 800; color: #fff; border: none; border-radius: 14px; cursor: pointer; transition: transform 0.1s, box-shadow 0.1s; box-shadow: 0 6px 15px rgba(0,0,0,0.3); letter-spacing: 0.5px; }
                        .btn-social:active { transform: scale(0.95); box-shadow: 0 2px 5px rgba(0,0,0,0.3); }
                        .btn-invite { background: linear-gradient(135deg, #8E24AA, #5E35B1); }
                        .btn-vk { background: linear-gradient(135deg, #0077FF, #005CE6); }
                        .btn-ok { background: linear-gradient(135deg, #F58220, #D86A14); }

                        .mobile-mode { padding: 30px 40px !important; border-radius: 24px !important; gap: 15px !important; width: 85% !important; max-width: 320px !important; }
                        .mobile-mode h1 { font-size: 20px !important; }
                        .mobile-mode .stars-container { margin: 10px 0 10px 0 !important; gap: 10px !important; }
                        .mobile-mode .stars-container svg { width: 32px !important; height: 32px !important; }
                        .mobile-mode .btn-next { padding: 12px 30px !important; font-size: 16px !important; border-radius: 14px !important; }
                        .mobile-mode .btn-social { padding: 10px 16px !important; font-size: 14px !important; }
                    </style>
                    <div class="confetti-layer">${confettiHTML}</div>
                    <div class="victory-panel ${isMobileUI ? 'mobile-mode' : ''}">
                        <h1>${globalThis.t('victoryTitle')}</h1>
                        <div class="stars-container">
                            <div class="star-wrap star-1">${starSvg}</div>
                            <div class="star-wrap star-2">${starSvg}</div>
                            <div class="star-wrap star-3">${starSvg}</div>
                        </div>
                        <button id="btn-next-level" class="btn-next">${globalThis.t('btnNext')}</button>
                        
                        <!-- 👇 КОНТЕЙНЕР ДЛЯ НОВЫХ КНОПОК 👇 -->
                        <div id="social-container" class="social-box"></div>
                    </div>
                `;

                document.body.appendChild(uiContainer);

                requestAnimationFrame(() => {
                    uiContainer.style.opacity = '1';
                });

                // ==========================================
                // ⚙️ ЛОГИКА СОЦИАЛЬНЫХ КНОПОК (ВАЙБКОД)
                // ==========================================
                const socialContainer = document.getElementById('social-container');
                
                // Проверяем платформу GamePush
                const gpPlatform = typeof gp !== 'undefined' ? gp.platform.type : 'NONE';

                if (gpPlatform === 'VK' || gpPlatform === 'OK') {
                    socialContainer.innerHTML = `
                        <button id="btn-invite" class="btn-social btn-invite">🤝 ${globalThis.t('btnInvite')}</button>
                        <button id="btn-subscribe" class="btn-social ${gpPlatform === 'VK' ? 'btn-vk' : 'btn-ok'}">
                            ${gpPlatform === 'VK' ? 'VK' : 'OK'} ${globalThis.t('btnSubscribe')}
                        </button>
                    `;

                    document.getElementById('btn-invite').onclick = () => {
                        if (typeof gp !== 'undefined') gp.social.invite();
                    };

                    document.getElementById('btn-subscribe').onclick = () => {
                        // ВАЖНО: Впиши сюда свои реальные ID групп!
                        const myGroupId = gpPlatform === 'VK' ? '162959143' : '70000042375809';
                        if (typeof gp !== 'undefined') gp.social.joinCommunity({ groupId: myGroupId });
                    };
                }

                // ==========================================
                // ⚙️ СТАРЫЙ КЛИК ПО КНОПКЕ "ДАЛЬШЕ"
                // ==========================================
                const btnNext = document.getElementById('btn-next-level');

                btnNext.onclick = () => {
                    uiContainer.style.opacity = '0';
                    setTimeout(() => {
                        uiContainer.remove(); 
                        const timePassed = Date.now() - globalThis.lastAdTime;
                        if (timePassed > 180000) {
                            globalThis.lastAdTime = Date.now();
                            c3_callFunction("ShowFullscreenAd"); 
                        } else {
                            runtime.goToLayout(globalThis.targetLevelName);
                        }
                    }, 400); 
                };
            }
        }
    }
    return; 
}

// =====================================================================
// 🟢 СОСТОЯНИЕ 2: ОБЫЧНАЯ ИГРА 🟢
// =====================================================================

if (globalThis.lastVecY === undefined) globalThis.lastVecY = 0;
let onIce = false;

const oldY = collider.y;
collider.y += 1; 

if (runtime.objects.Ice) {
    for (const block of runtime.objects.Ice.instances()) {
        if (collider.testOverlap(block)) onIce = true;
    }
}

if (runtime.objects.Slime) {
    for (const block of runtime.objects.Slime.instances()) {
        if (block.origW === undefined) block.origW = block.width;
        if (block.origH === undefined) block.origH = block.height;

        if (collider.testOverlap(block) && globalThis.lastVecY > 50) {
            platform.vectorY = -1300; 
            block.height = block.origH * 0.4;
            block.width = block.origW * 1.4;
        }
        block.width += (block.origW - block.width) * (0.15 * dt60);
        block.height += (block.origH - block.height) * (0.15 * dt60);
    }
}

if (runtime.objects.Sand) {
    for (const sand of runtime.objects.Sand.instances()) {
        if (sand.origX === undefined) {
            sand.origX = sand.x;
            sand.isStepped = false;
            sand.timer = 0;
        }
        if (!sand.isStepped && collider.testOverlap(sand)) sand.isStepped = true;
        if (sand.isStepped) {
            sand.timer += runtime.dt;
            if (sand.timer < 0.5) {
                sand.x = sand.origX + Math.sin(sand.timer * 80) * 3;
            } else {
                sand.x = sand.origX; 
                sand.y += 500 * runtime.dt; 
                sand.opacity -= runtime.dt * 2; 
                if (sand.opacity <= 0) sand.destroy();
            }
        }
    }
}
collider.y = oldY; 

if (runtime.objects.Dispenser) {
    for (const disp of runtime.objects.Dispenser.instances()) {
        if (disp.origW === undefined) disp.origW = disp.width;
        if (disp.origH === undefined) disp.origH = disp.height;
        disp.width += (disp.origW - disp.width) * (0.15 * dt60);
        disp.height += (disp.origH - disp.height) * (0.15 * dt60);
    }

    if (runtime.objects.Arrow) {
        if (Math.floor(globalThis.levelTimer) % 2 === 0 && !globalThis.hasShotThisCycle) {
            globalThis.hasShotThisCycle = true;
            for (const disp of runtime.objects.Dispenser.instances()) {
                const myDir = (disp.instVars && disp.instVars.DirX !== undefined) ? disp.instVars.DirX : 1;
                const offset = ((disp.origW / 2) + 15) * myDir; 
                const arrow = runtime.objects.Arrow.createInstance(disp.layer.name, disp.x + offset, disp.y);
                arrow.myDirection = myDir; 
                arrow.isNewBorn = true; 
                arrow.angle = myDir === -1 ? Math.PI : 0;
                arrow.moveToBottom();
                disp.width = disp.origW * 1.4; 
                disp.height = disp.origH * 0.6;
            }
        } else if (Math.floor(globalThis.levelTimer) % 2 !== 0) {
            globalThis.hasShotThisCycle = false;
        }
    }
}

if (runtime.objects.Arrow) {
    const solids = [runtime.objects.PlatformsTilemap, runtime.objects.Ice, runtime.objects.Slime, runtime.objects.Sand];
    for (const arrow of runtime.objects.Arrow.instances()) {
        const flyDir = arrow.myDirection !== undefined ? arrow.myDirection : 1;
        arrow.x += flyDir * 400 * runtime.dt;
        if (arrow.isNewBorn) { arrow.isNewBorn = false; continue; }

        let arrowDestroyed = false;
        for (const solidObj of solids) {
            if (solidObj && !arrowDestroyed) {
                for (const block of solidObj.instances()) {
                    if (arrow.testOverlap(block)) { arrow.destroy(); arrowDestroyed = true; break; }
                }
            }
        }
        if (arrowDestroyed) continue; 

        if (!globalThis.isStunned && collider.testOverlap(arrow)) {
            globalThis.isStunned = true;
            globalThis.deathShake = 10; 
            platform.vectorY = -300; 
            platform.vectorX = flyDir * 500; 
            setTimeout(() => { globalThis.isStunned = false; }, 400);
            arrow.destroy();
            continue;
        }
        
        const layout = runtime.layout;
        if (arrow.x < -200 || arrow.x > layout.width + 200 || arrow.y < -200 || arrow.y > layout.height + 200) arrow.destroy();
    }
}

if (globalThis.isStunned === undefined) globalThis.isStunned = false;

if (!globalThis.isStunned && runtime.objects.Cactus) {
    for (const cactus of runtime.objects.Cactus.instances()) {
        if (collider.testOverlap(cactus)) {
            globalThis.isStunned = true;
            globalThis.deathShake = 15; 
            const knockDir = collider.x < cactus.x ? -1 : 1;
            platform.vectorY = -400; 
            platform.vectorX = knockDir * 600; 
            setTimeout(() => { globalThis.isStunned = false; }, 400);
            break; 
        }
    }
}

if (runtime.objects.Dynamite) {
    for (const tnt of runtime.objects.Dynamite.instances()) {
        if (!tnt.isIgnited && collider.testOverlap(tnt)) { tnt.isIgnited = true; tnt.igniteTimer = 0; }
        if (tnt.isIgnited) {
            tnt.igniteTimer += runtime.dt;
            const blinkSpeed = 20 + (tnt.igniteTimer * 40); 
            const isWhite = Math.sin(tnt.igniteTimer * blinkSpeed) > 0;
            if (tnt.instVars && tnt.instVars.FlashState !== undefined) tnt.instVars.FlashState = isWhite ? 1 : 0;
            else tnt.opacity = isWhite ? 1.0 : 0.4; 

            if (tnt.igniteTimer >= 0.7) {
                const dist = Math.hypot(collider.x - tnt.x, collider.y - tnt.y);
                if (dist < 250 && !globalThis.isDead) {
                    globalThis.isStunned = true;
                    globalThis.deathShake = 50; 
                    const sideDir = collider.x < tnt.x ? -1 : 1;
                    platform.vectorX = sideDir * 1100; 
                    platform.vectorY = -1200; 
                    setTimeout(() => { globalThis.isStunned = false; }, 600);
                }
                tnt.destroy();
            }
        }
    }
}

if (onIce) {
    platform.deceleration = 50;  
    platform.acceleration = 200; 
} else if (globalThis.isStunned) {
    platform.deceleration = 100; 
    platform.acceleration = 100;
} else {
    platform.deceleration = 5000; 
    platform.acceleration = 2500; 
}
globalThis.lastVecY = platform.vectorY;

let moveIntent = 0; 
const isJumpPressed = globalThis.keys["Space"] || globalThis.keys["KeyW"] || globalThis.keys["ArrowUp"];

if (!globalThis.isStunned) {
    if (globalThis.keys["KeyA"] || globalThis.keys["ArrowLeft"]) {
        platform.simulateControl("left");
        moveIntent = -1;
    }
    if (globalThis.keys["KeyD"] || globalThis.keys["ArrowRight"]) {
        platform.simulateControl("right");
        moveIntent = 1;
    }
    if (isJumpPressed && !globalThis.wasJumpPressed) platform.simulateControl("jump"); 
}
globalThis.wasJumpPressed = isJumpPressed; 

// --- ПРИВЯЗКА И АНИМАЦИИ ---
player.x = collider.x;
player.y = collider.y;

if (moveIntent === -1) runtime.globalVars.MirrorDir = 1; 
else if (moveIntent === 1) runtime.globalVars.MirrorDir = 0; 

if (!platform.isOnFloor) {
    if (platform.vectorY < 50) { if (player.animationName !== "jump") player.setAnimation("jump"); } 
    else { if (player.animationName !== "fall") player.setAnimation("fall"); }
} else {
    if (moveIntent !== 0) { if (player.animationName !== "run") player.setAnimation("run"); } 
    else { if (player.animationName !== "idle") player.setAnimation("idle"); }
}

if (globalThis.tilt === undefined) globalThis.tilt = 0;
globalThis.tilt += (moveIntent * 0.2 - globalThis.tilt) * (0.1 * dt60);
player.angle = globalThis.tilt;

// --- ИДЕАЛЬНАЯ КАМЕРА ---
if (globalThis.baseZoom === undefined) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    globalThis.baseZoom = isMobile ? 1.3 : 1.0; 
}

const currentSpeedX = platform.vectorX; 
const maxSpeed = platform.maxSpeed;
const layout = runtime.layout;

const speedMultiplier = Math.max(0.9, 1.0 - (Math.abs(currentSpeedX) / maxSpeed) * 0.1);
layout.scale = layout.scale + ((globalThis.baseZoom * speedMultiplier) - layout.scale) * ((Math.abs(currentSpeedX) < 10 ? 0.08 : 0.01) * dt60);

const targetCamX = collider.x + (currentSpeedX / maxSpeed) * 200;
const targetCamY = collider.y - 50; 

if (globalThis.camX === undefined) globalThis.camX = collider.x;
if (globalThis.camY === undefined) globalThis.camY = collider.y;

globalThis.camX += (targetCamX - globalThis.camX) * (0.1 * dt60); 
globalThis.camY += (targetCamY - globalThis.camY) * (0.1 * dt60);

if (deathZone) globalThis.camY = Math.min(globalThis.camY, deathZone.y - 150); 
layout.scrollTo(Math.round(globalThis.camX), Math.round(globalThis.camY));

const currentName = layout.name; 
const currentNum = parseInt(currentName.toLowerCase().replace("lvl", "")) || 1;

// --- СМЕРТЬ В ПРОПАСТИ ---
if (collider.y > (deathZone ? deathZone.y : layout.height + 200) && !globalThis.isDead) {
    globalThis.isDead = true; 
    globalThis.playerColor = undefined;
    
    if (globalThis.deathCount === undefined) globalThis.deathCount = 0;
    globalThis.deathCount += 1;
    console.log("💀 Смерть в пропасти! Всего падений на уровне:", globalThis.deathCount);

    c3_callFunction("GamePush.Analytics.Goal", ["death_" + runtime.layout.name, 1]);
    
    globalThis.deathShake = 15; 
    platform.isEnabled = false; 
    
    if ("PlaySound" in runtime.globalVars) runtime.globalVars.PlaySound = "transition";

    const abyssVFX = setInterval(() => {
        player.y += 8;          
        player.angle += 0.3;    
        player.opacity -= 0.04; 
        player.width *= 0.94;   
        player.height *= 0.94;
        
        globalThis.camY += 6;
        layout.scrollTo(Math.round(globalThis.camX), Math.round(globalThis.camY));
    }, 30);

    setTimeout(() => {
        clearInterval(abyssVFX); 
        
        globalThis.camX = undefined; 
        globalThis.camY = undefined; 
        globalThis.tilt = 0; 
        globalThis.deathShake = 0;
        
        runtime.goToLayout(layout.name); 
        
        setTimeout(() => { globalThis.isDead = false; }, 50);
    }, 700); 
}

// --- СМЕРТЬ ОТ ЛАВЫ ---
if (currentNum >= 21 && currentNum <= 25 && runtime.objects.Lava) {
    
    if (globalThis.lavaSpeed === undefined) globalThis.lavaSpeed = 20; 
    globalThis.lavaSpeed += 5 * runtime.dt; 

    for (const lava of runtime.objects.Lava.instances()) {
        if (!lava.isZOrderFixed) {
            lava.moveToTop();
            lava.isZOrderFixed = true;
        }
        if (runtime.timeScale === 0) continue;

        lava.y -= globalThis.lavaSpeed * runtime.dt;
        
        if (lava.origH === undefined) lava.origH = lava.height;
        lava.height = lava.origH + Math.sin(runtime.gameTime * 5 + lava.x) * 10;

        if (collider.testOverlap(lava) && !globalThis.isDead) {
            globalThis.isDead = true; 
            globalThis.playerColor = undefined;
            if (globalThis.deathCount === undefined) globalThis.deathCount = 0;
            globalThis.deathCount += 1;
            console.log("🔥 Испепелен в лаве! Скорость лавы была:", Math.round(globalThis.lavaSpeed));
            c3_callFunction("GamePush.Analytics.Goal", ["death_" + runtime.layout.name, 1]);
            
            globalThis.deathShake = 40; 
            platform.isEnabled = false; 
            
            player.colorRgb = [0.1, 0.1, 0.1]; 
            
            if ("PlaySound" in runtime.globalVars) runtime.globalVars.PlaySound = "transition";

            const deathVFX = setInterval(() => {
                player.y -= 3;          
                player.angle += 0.2;    
                player.opacity -= 0.03; 
                player.width *= 0.95;   
                player.height *= 0.95;
            }, 30);

            setTimeout(() => {
                clearInterval(deathVFX); 
                
                globalThis.camX = undefined; globalThis.camY = undefined; globalThis.tilt = 0; globalThis.deathShake = 0;
                
                globalThis.lavaSpeed = 15; 
                
                runtime.goToLayout(currentName); 
                setTimeout(() => { globalThis.isDead = false; }, 50);
            }, 1000); 
        }
    }
}
// =====================================================================
// 📺 ШАГ 2: КНОПКА СКИПА ЗА РЕКЛАМУ (ПОЯВЛЯЕТСЯ ПОСЛЕ 2 СМЕРТЕЙ)
// =====================================================================
if (globalThis.deathCount >= 2 && !globalThis.isWaitingForUI && !globalThis.isDead && currentNum < 25) {
    
    if (!document.getElementById('skip-level-btn')) {
        const skipBtn = document.createElement('button');
        skipBtn.id = 'skip-level-btn';
        
        skipBtn.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; height: 100%;">
                <span style="line-height: 1;">${globalThis.t('btnSkip')}</span>
                <span style="background: #FFD700; color: #000; font-size: 11px; font-weight: 900; padding: 4px 6px; border-radius: 6px; line-height: 1; letter-spacing: 1px; display: inline-block;">${globalThis.t('adsBadge')}</span>
            </div>
        `;
        
        skipBtn.style.position = 'absolute';
        skipBtn.style.top = '20px';
        skipBtn.style.left = '20px';
        skipBtn.style.zIndex = '9998';
        skipBtn.style.background = 'linear-gradient(135deg, rgba(40, 40, 50, 0.8), rgba(20, 20, 25, 0.9))';
        skipBtn.style.backdropFilter = 'blur(12px)';
        skipBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        skipBtn.style.color = '#ffffff';
        skipBtn.style.padding = '12px 20px'; 
        skipBtn.style.borderRadius = '20px';
        skipBtn.style.fontFamily = '"Segoe UI", sans-serif';
        skipBtn.style.fontSize = '15px'; 
        skipBtn.style.fontWeight = 'bold';
        skipBtn.style.cursor = 'pointer';
        skipBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        skipBtn.style.transition = 'transform 0.15s, background 0.2s'; 

        skipBtn.onmouseenter = () => skipBtn.style.background = 'linear-gradient(135deg, rgba(60, 60, 70, 0.9), rgba(30, 30, 40, 0.9))';
        skipBtn.onmouseleave = () => skipBtn.style.background = 'linear-gradient(135deg, rgba(40, 40, 50, 0.8), rgba(20, 20, 25, 0.9))';
        skipBtn.onmousedown = () => skipBtn.style.transform = 'scale(0.95)';
        skipBtn.onmouseup = () => skipBtn.style.transform = 'scale(1)';

        document.body.appendChild(skipBtn);

        skipBtn.animate([
            { boxShadow: '0 4px 15px rgba(0,0,0,0.3)', filter: 'brightness(1)' },
            { boxShadow: '0 0 20px rgba(255, 215, 0, 0.4)', filter: 'brightness(1.15)' },
            { boxShadow: '0 4px 15px rgba(0,0,0,0.3)', filter: 'brightness(1)' }
        ], {
            duration: 2000, 
            iterations: Infinity, 
            easing: 'ease-in-out'
        });

        skipBtn.onclick = () => {
            skipBtn.style.display = 'none';
            runtime.timeScale = 0;
            
            if ("IsRewardEarned" in runtime.globalVars) {
                runtime.globalVars.IsRewardEarned = 0; 
            }
            
            console.log("🚀 Реклама запущена, кнопка скрыта");
            runtime.callFunction("ShowRewardedAd");
        };
            
    }
} else {
    const skipBtn = document.getElementById('skip-level-btn');
    if (skipBtn) skipBtn.remove();
}
// --- ВИЗУАЛ ---
if (runtime.objects.Fireflies && globalThis.camX !== undefined) {
    const fireflies = runtime.objects.Fireflies.getFirstInstance();
    if (fireflies) { fireflies.x = globalThis.camX; fireflies.y = globalThis.camY; }
}

const isCaveLevel = (currentNum >= 16 && currentNum <= 20);
if (runtime.objects.DarkScreen) {
    const dark = runtime.objects.DarkScreen.getFirstInstance();
    if (dark) {
        dark.opacity = isCaveLevel ? 0.6 : 0; 
        if (isCaveLevel && globalThis.camX !== undefined) {
            dark.x = globalThis.camX; dark.y = globalThis.camY; dark.moveToBottom(); 
        }
    }
}

if (runtime.objects.LightGlow) {
    if (globalThis.playerLight) {
        let isLightStillAlive = false;
        for (const glow of runtime.objects.LightGlow.instances()) { if (glow === globalThis.playerLight) isLightStillAlive = true; }
        if (!isLightStillAlive) globalThis.playerLight = undefined; 
    }
    if (isCaveLevel && globalThis.playerLight === undefined) {
        for (const glow of runtime.objects.LightGlow.instances()) {
            if (Math.hypot(glow.x - player.x, glow.y - player.y) < 100) {
                globalThis.playerLight = glow; globalThis.playerLight.origW = glow.width; globalThis.playerLight.origH = glow.height; break;
            }
        }
    }
    for (const glow of runtime.objects.LightGlow.instances()) {
        if (isCaveLevel) {
            glow.opacity = 1; 
            if (glow.origW === undefined) { glow.origW = glow.width; glow.origH = glow.height; }
            if (glow === globalThis.playerLight) {
                glow.x = player.x; glow.y = player.y;
                const pulse = 1 + Math.sin(runtime.gameTime * 3) * 0.01;
                glow.width = glow.origW * pulse; glow.height = glow.origH * pulse;
            } else {
                const flicker = 1 + Math.sin(runtime.gameTime * 3 + glow.x) * 0.01 + Math.sin(runtime.gameTime * 5 + glow.y) * 0.015;
                glow.width = glow.origW * flicker; glow.height = glow.origH * flicker;
            }
        } else { glow.opacity = 0; }
    }
}
	},

	async Game_Event3_Act1(runtime, localVars)
	{
		// Создаем пустой "рюкзак" для хранения нажатых кнопок
		globalThis.keys = {};
		
		// Шпион, который слушает НАЖАТИЕ кнопки
		window.addEventListener("keydown", (e) => {
		    globalThis.keys[e.code] = true; 
		});
		
		// Шпион, который слушает ОТПУСКАНИЕ кнопки
		window.addEventListener("keyup", (e) => {
		    globalThis.keys[e.code] = false; 
		});
	},

	async Game_Event8(runtime, localVars)
	{
// === АВТОНОМНЫЙ МОДУЛЬ ВИДИМЫХ КНОПОК (ТОЛЬКО ДЛЯ МОБИЛОК) ===
if (!globalThis.mobileControlsAdded) {
    // 0. ПРОВЕРКА НА МОБИЛЬНОЕ УСТРОЙСТВО
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Если это ПК — скрипт тихо завершает работу, кнопки не создаются!
    if (!isMobile) {
        console.log("Запущено на ПК: экранные кнопки скрыты.");
    } else {
        globalThis.mobileControlsAdded = true;
        if (!globalThis.keys) globalThis.keys = {};

        const style = document.createElement("style");
        style.innerHTML = `
            * { -webkit-tap-highlight-color: transparent !important; user-select: none !important; outline: none; }
            html, body { touch-action: none !important; overflow: hidden !important; background-color: #000; }
        `;
        document.head.appendChild(style);

        const ui = document.createElement("div");
        ui.style.position = "absolute";
        ui.style.bottom = "0";
        ui.style.left = "0";
        ui.style.width = "100%";
        ui.style.height = "110px"; 
        ui.style.pointerEvents = "none";
        ui.style.zIndex = "9999";
        ui.style.display = "flex";
        ui.style.justifyContent = "space-between";
        ui.style.alignItems = "center";
        ui.style.padding = "0 20px"; 
        ui.style.boxSizing = "border-box";
        document.body.appendChild(ui);

        function createBtn(svgIcon, keyMap) {
            const btn = document.createElement("button");
            btn.innerHTML = svgIcon; 
            
            btn.style.width = "80px";  
            btn.style.height = "80px"; 
            btn.style.borderRadius = "50%";
            btn.style.backgroundColor = "rgba(0, 0, 0, 0.45)"; 
            btn.style.border = "2px solid rgba(255, 255, 255, 0.15)"; 
            btn.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.1)"; 
            btn.style.pointerEvents = "auto";
            btn.style.backdropFilter = "blur(8px)"; 
            btn.style.webkitBackdropFilter = "blur(8px)"; 
            
            btn.style.display = "flex";
            btn.style.justifyContent = "center";
            btn.style.alignItems = "center";
            
            btn.style.transition = "transform 0.05s ease, background-color 0.05s ease";
            btn.style.cursor = "pointer";

            const press = (e) => {
                e.preventDefault(); 
                e.stopPropagation(); 
                globalThis.keys[keyMap] = true;
                btn.style.backgroundColor = "rgba(255, 255, 255, 0.25)";
                btn.style.transform = "scale(0.9)"; 
            };
            const release = (e) => {
                e.preventDefault(); 
                e.stopPropagation();
                globalThis.keys[keyMap] = false;
                btn.style.backgroundColor = "rgba(0, 0, 0, 0.45)";
                btn.style.transform = "scale(1)"; 
            };

            btn.addEventListener("touchstart", press, {passive: false});
            btn.addEventListener("touchend", release, {passive: false});
            btn.addEventListener("touchcancel", release, {passive: false});
            
            btn.addEventListener("mousedown", press);
            btn.addEventListener("mouseup", release);
            btn.addEventListener("mouseleave", release);
            
            return btn;
        }

        const iconLeft = `<svg viewBox="0 0 24 24" width="40" height="40" stroke="rgba(255,255,255,0.85)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
        const iconRight = `<svg viewBox="0 0 24 24" width="40" height="40" stroke="rgba(255,255,255,0.85)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        const iconJump = `<svg viewBox="0 0 24 24" width="40" height="40" stroke="rgba(255,255,255,0.85)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;

        const leftGroup = document.createElement("div");
        leftGroup.style.display = "flex"; 
        leftGroup.style.gap = "20px"; 
        leftGroup.appendChild(createBtn(iconLeft, "KeyA"));
        leftGroup.appendChild(createBtn(iconRight, "KeyD"));
        
        ui.appendChild(leftGroup);
        ui.appendChild(createBtn(iconJump, "Space"));
        
        console.log("Управление для мобильных устройств успешно загружено!");
    }
}
	},

	async Game_Event12_Act3(runtime, localVars)
	{
		// Проверяем, есть ли тут робот Playgama
		if (typeof instantGamesBridge !== 'undefined') {
		    // Кидаем ему фейковое сохранение, чтобы он поставил зеленую галочку
		    instantGamesBridge.storage.set('bot_test', 'ok')
		        .catch(e => console.log("Роботу всё равно"));
		}
	},

	async Game_Event14_Act1(runtime, localVars)
	{
// === АВТОНОМНЫЙ МОДУЛЬ ОБУЧЕНИЯ (СЛИМ ДЛЯ МОБИЛ + ПРЕМИУМ ДЛЯ ПК) ===

// Проверяем, что подсказка еще не показывалась в этой сессии
if (!globalThis.tutorialShown) {
    
    // Проверяем, что мы находимся именно на первом уровне
    if (runtime.layout.name === "lvl1") {
        globalThis.tutorialShown = true;

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // 1. Создаем стеклянный контейнер
        const hint = document.createElement("div");
        hint.style.position = "absolute";
        
        // --- АДАПТИВНЫЙ ДИЗАЙН ---
        // На мобилке висит высоко сверху (8%), на ПК — твой вариант (15%)
        hint.style.top = isMobile ? "8%" : "15%"; 
        hint.style.left = "50%";
        hint.style.transform = "translate(-50%, -50%)";
        
        // Тонкая плашка для телефона, жирная для ПК
        hint.style.padding = isMobile ? "8px 15px" : "20px 40px";
        hint.style.width = isMobile ? "90%" : "auto"; 
        
        hint.style.backgroundColor = "rgba(0, 0, 0, 0.65)";
        hint.style.border = isMobile ? "1px solid rgba(255, 255, 255, 0.15)" : "2px solid rgba(255, 255, 255, 0.15)";
        hint.style.borderRadius = isMobile ? "10px" : "20px";
        hint.style.color = "#fff";
        hint.style.fontFamily = "Arial, sans-serif";
        hint.style.textAlign = "center";
        hint.style.boxShadow = isMobile ? "0 5px 15px rgba(0,0,0,0.4)" : "0 15px 35px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1)";
        hint.style.backdropFilter = "blur(12px)";
        hint.style.webkitBackdropFilter = "blur(12px)";
        hint.style.zIndex = "10000";
        hint.style.pointerEvents = "none"; 
        hint.style.transition = "opacity 0.6s ease, transform 0.6s ease";
        hint.style.opacity = "0"; 

        // 2. Генерируем текст в зависимости от устройства
        let hintText = "";
        if (isMobile) {
            // Ультра-компактный текст в 2 строчки для смартфона
            hintText = `
                <div style="font-size: 13px; line-height: 1.4; color: #ddd;">
                    <b style="color: #00ffff; font-size: 14px; text-shadow: 0 0 5px rgba(0, 255, 255, 0.5);">УПРАВЛЕНИЕ:</b><br>
                    <b><</b> - бег влево. <b>></b> - бег вправо. <b>^</b> - прыжок. <b>^</b> + <b>^</b> - двойной прыжок. 
                </div>
            `;
        } else {
            // Твой оригинальный текст для ПК
            hintText = `
                <h2 style="margin: 0 0 12px 0; font-size: 26px; color: #00ffff; text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);">УПРАВЛЕНИЕ</h2>
                <p style="margin: 8px 0; font-size: 18px; color: #ddd;"><b>A / D</b> или <b>Стрелки</b> — Бег</p>
                <p style="margin: 8px 0; font-size: 18px; color: #ddd;"><b>Пробел</b> или <b>Стрелка вверх</b> — Прыжок</p>
                <p style="margin: 8px 0; font-size: 18px; color: #ddd;">Прыгай дважды, для двойного прыжка!</p>
            `;
        }

        hint.innerHTML = hintText;
        document.body.appendChild(hint);

        // 3. Анимация плавного появления
        setTimeout(() => {
            hint.style.opacity = "1";
            // Мобилка мягко съезжает чуть вниз, ПК опускается как у тебя (-40%)
            hint.style.transform = isMobile ? "translate(-50%, -10%)" : "translate(-50%, -40%)"; 
        }, 100);

        // 4. Функция скрытия подсказки
        const hideHint = () => {
            if (hint.parentNode) {
                hint.style.opacity = "0";
                hint.style.transform = "translate(-50%, -50%)"; // Эффект ухода вверх
                setTimeout(() => hint.remove(), 600); // Удаляем из памяти
            }
            document.removeEventListener("keydown", hideHint);
            document.removeEventListener("touchstart", hideHint);
        };

        // Твои таймеры на 10 и 12 секунд
        setTimeout(() => {
            document.addEventListener("keydown", hideHint);
            document.addEventListener("touchstart", hideHint);
        }, 10000);

        setTimeout(hideHint, 12000);
    }
}
	},

	async Game_Event15_Act1(runtime, localVars)
	{
// =====================================================================
// 🌍 СИСТЕМА ЛОКАЛИЗАЦИИ (СЛОВАРЬ)
// =====================================================================
if (!globalThis.currentLang) {
    // Берем первые две буквы языка системы
    const browserLang = navigator.language.slice(0, 2).toLowerCase(); 
    // Если язык не из нашего списка - ставим английский
    globalThis.currentLang = ['ru', 'en', 'tr', 'pt'].includes(browserLang) ? browserLang : 'en';
}

globalThis.i18n = {
    ru: {
        victoryTitle: "Уровень пройден",
        btnNext: "Дальше ➔",
        btnSkip: "Пропустить уровень",
        adsBadge: "РЕКЛАМА",
        // Подсказки управления
        hintTitle: "УПРАВЛЕНИЕ",
        hintMobile: "<b><</b> - бег влево. <b>></b> - бег вправо. <b>^</b> - прыжок. <b>^</b> + <b>^</b> - двойной прыжок.",
        hintPcRun: "<b>A / D</b> или <b>Стрелки</b> — Бег",
        hintPcJump: "<b>Пробел</b> или <b>Стрелка вверх</b> — Прыжок",
        hintPcDouble: "Прыгай дважды для двойного прыжка!"
    },
    en: {
        victoryTitle: "Level Cleared",
        btnNext: "Next ➔",
        btnSkip: "Skip Level",
        adsBadge: "AD",
        // Подсказки управления
        hintTitle: "CONTROLS",
        hintMobile: "<b><</b> - run left. <b>></b> - run right. <b>^</b> - jump. <b>^</b> + <b>^</b> - double jump.",
        hintPcRun: "<b>A / D</b> or <b>Arrows</b> — Run",
        hintPcJump: "<b>Space</b> or <b>Arrow Up</b> — Jump",
        hintPcDouble: "Jump twice for double jump!"
    },
    tr: {
        victoryTitle: "Bölüm Tamamlandı",
        btnNext: "İleri ➔",
        btnSkip: "Bölümü Geç",
        adsBadge: "REKLAM",
        // Подсказки управления
        hintTitle: "KONTROLLER",
        hintMobile: "<b><</b> - sola koş. <b>></b> - sağa koş. <b>^</b> - zıpla. <b>^</b> + <b>^</b> - çift zıplama.",
        hintPcRun: "<b>A / D</b> veya <b>Ok Tuşları</b> — Koşma",
        hintPcJump: "<b>Boşluk</b> veya <b>Yukarı Ok</b> — Zıplama",
        hintPcDouble: "Çift zıplamak için iki kez zıpla!"
    },
    pt: {
        victoryTitle: "Nível Concluído",
        btnNext: "Próximo ➔",
        btnSkip: "Pular Nível",
        adsBadge: "ANÚNCIO",
        // Подсказки управления
        hintTitle: "CONTROLES",
        hintMobile: "<b><</b> - correr para esquerda. <b>></b> - correr para direita. <b>^</b> - pular. <b>^</b> + <b>^</b> - pulo duplo.",
        hintPcRun: "<b>A / D</b> ou <b>Setas</b> — Correr",
        hintPcJump: "<b>Espaço</b> ou <b>Seta para Cima</b> — Pular",
        hintPcDouble: "Pule duas vezes para um pulo duplo!"
    }
};

globalThis.t = (key) => {
    return globalThis.i18n[globalThis.currentLang][key] || globalThis.i18n['en'][key] || key;
};

// === АВТОНОМНЫЙ МОДУЛЬ ОБУЧЕНИЯ С ЛОКАЛИЗАЦИЕЙ ===
// === АВТОНОМНЫЙ МОДУЛЬ ОБУЧЕНИЯ С ЛОКАЛИЗАЦИЕЙ ===
if (!globalThis.tutorialShown && runtime.layout.name === "lvl1") {
    globalThis.tutorialShown = true;

    // 🔥 ФИКС: Ждем 500мс, чтобы плагины Яндекса/GamePush успели обновить язык
    setTimeout(() => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        const hint = document.createElement("div");
        hint.style.position = "absolute";
        hint.style.top = isMobile ? "8%" : "15%"; 
        hint.style.left = "50%";
        hint.style.transform = "translate(-50%, -50%)";
        hint.style.padding = isMobile ? "8px 15px" : "20px 40px";
        hint.style.width = isMobile ? "90%" : "auto"; 
        hint.style.backgroundColor = "rgba(0, 0, 0, 0.65)";
        hint.style.border = isMobile ? "1px solid rgba(255, 255, 255, 0.15)" : "2px solid rgba(255, 255, 255, 0.15)";
        hint.style.borderRadius = isMobile ? "10px" : "20px";
        hint.style.color = "#fff";
        hint.style.fontFamily = "Arial, sans-serif";
        hint.style.textAlign = "center";
        hint.style.boxShadow = isMobile ? "0 5px 15px rgba(0,0,0,0.4)" : "0 15px 35px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.1)";
        hint.style.backdropFilter = "blur(12px)";
        hint.style.webkitBackdropFilter = "blur(12px)";
        hint.style.zIndex = "10000";
        hint.style.pointerEvents = "none"; 
        hint.style.transition = "opacity 0.6s ease, transform 0.6s ease";
        hint.style.opacity = "0"; 

        // Теперь текст берется с правильным языком!
        let hintText = "";
        if (isMobile) {
            hintText = `
                <div style="font-size: 13px; line-height: 1.4; color: #ddd;">
                    <b style="color: #00ffff; font-size: 14px; text-shadow: 0 0 5px rgba(0, 255, 255, 0.5);">${globalThis.t('hintTitle')}:</b><br>
                    ${globalThis.t('hintMobile')}
                </div>
            `;
        } else {
            hintText = `
                <h2 style="margin: 0 0 12px 0; font-size: 26px; color: #00ffff; text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);">${globalThis.t('hintTitle')}</h2>
                <p style="margin: 8px 0; font-size: 18px; color: #ddd;">${globalThis.t('hintPcRun')}</p>
                <p style="margin: 8px 0; font-size: 18px; color: #ddd;">${globalThis.t('hintPcJump')}</p>
                <p style="margin: 8px 0; font-size: 18px; color: #ddd;">${globalThis.t('hintPcDouble')}</p>
            `;
        }

        hint.innerHTML = hintText;
        document.body.appendChild(hint);

        setTimeout(() => {
            hint.style.opacity = "1";
            hint.style.transform = isMobile ? "translate(-50%, -10%)" : "translate(-50%, -40%)"; 
        }, 100);

        const hideHint = () => {
            if (hint.parentNode) {
                hint.style.opacity = "0";
                hint.style.transform = "translate(-50%, -50%)"; 
                setTimeout(() => hint.remove(), 600); 
            }
            document.removeEventListener("keydown", hideHint);
            document.removeEventListener("touchstart", hideHint);
        };

        // Подсказка висит 10 секунд перед тем как исчезнуть
        setTimeout(() => {
            document.addEventListener("keydown", hideHint);
            document.addEventListener("touchstart", hideHint);
        }, 10000);

        setTimeout(hideHint, 12000);
        
    }, 500); // Закрываем наш новый таймер задержки
}
	},

	async Game_Event17_Act1(runtime, localVars)
	{
		runtime.goToLayout(globalThis.targetLevelName);
	},

	async Game_Event18_Act1(runtime, localVars)
	{
		// Проверяем, создавали ли мы уже плеер
		if (!globalThis.MusicManager) {
		    
		    globalThis.MusicManager = {
		        track: null,
		        isReady: false,
		
		        // Функция загрузки
		        load: async function(rt) {
		            if (this.isReady) return;
		            
		            try {
		                // 🔥 ИСПРАВЛЕНИЕ: правильное заклинание API Construct 3 — getMediaFileUrl
		                const url = await rt.assets.getMediaFileUrl("mus.webm");
		                console.log("🎵 Успех! Движок нашел файл по адресу:", url);
		                
		                this.track = new Audio(url);
		                this.track.loop = true; 
		                this.track.volume = 0.4; 
		                this.isReady = true;
		            } catch (err) {
		                console.error("❌ ОШИБКА: Не могу загрузить трек.", err);
		            }
		        },
		
		        // Функция воспроизведения
		        play: function() {
		            if (this.track) {
		                this.track.play().then(() => {
		                    console.log("▶️ Музыка пошла!");
		                }).catch(e => {
		                    console.warn("🔇 Браузер заблокировал звук. Ждем клика пользователя.", e);
		                });
		            }
		        },
		
		        // Функция паузы
		        pause: function() {
		            if (this.track) this.track.pause();
		        }
		    };
		
		    // Запускаем загрузку файла
		    globalThis.MusicManager.load(runtime);
		
		    // Слушаем обычный 'click' по всему документу — он надежнее всего разблокирует звук
		    document.addEventListener('click', () => {
		        console.log("🖱 Клик пойман! Пытаемся включить музыку...");
		        if (globalThis.MusicManager.isReady) {
		            globalThis.MusicManager.play();
		        } else {
		            console.log("⏳ Трек еще не успел загрузиться, кликни еще раз чуть позже.");
		        }
		    });
		}
	},

	async Game_Event19_Act1(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.pause();
	},

	async Game_Event19_Act2(runtime, localVars)
	{
		runtime.timeScale = 0;
	},

	async Game_Event20_Act1(runtime, localVars)
	{
		runtime.timeScale = 1;
		this.track.volume = 0.4;
	},

	async Game_Event21_Act1(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.pause();
	},

	async Game_Event22_Act1(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.pause();
	},

	async Game_Event22_Act2(runtime, localVars)
	{
		runtime.timeScale = 0;
	},

	async Game_Event23_Act1(runtime, localVars)
	{
		runtime.timeScale = 1;
		this.track.volume = 0.4;
	},

	async Game_Event24_Act1(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.play();
	},

	async Game_Event24_Act2(runtime, localVars)
	{
		this.track.volume = 0.4;
	},

	async Game_Event25_Act1(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.play();
	},

	async Game_Event25_Act2(runtime, localVars)
	{
		this.track.volume = 0.4;
	},

	async Game_Event26_Act1(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.play();
	},

	async Game_Event26_Act2(runtime, localVars)
	{
		this.track.volume = 0.4;
	},

	async Game_Event29_Act1(runtime, localVars)
	{
		// Внутри события "On rewarded video close" в твоем Event Sheet:
		const skipBtn = document.getElementById('skip-level-btn');
		if (skipBtn) {
		    skipBtn.style.display = 'flex'; // или 'block', смотря какой стиль у тебя был
		}
	},

	async Game_Event29_Act2(runtime, localVars)
	{
		runtime.timeScale = 1;
		this.track.volume = 0.4;
	},

	async Game_Event30_Act1(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.pause();
	},

	async Game_Event30_Act2(runtime, localVars)
	{
		this.track.volume = 0.4;
	},

	async Game_Event31_Act1(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.play();
	},

	async Game_Event31_Act2(runtime, localVars)
	{
		this.track.volume = 0.4;
	}
};

globalThis.C3.JavaScriptInEvents = scriptsInEvents;
