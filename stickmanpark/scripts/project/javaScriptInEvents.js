

const scriptsInEvents = {

	async Game_Event3_Act3(runtime, localVars)
	{
		// Отправляем GameReady напрямую через ядро GamePush
		if (typeof gp !== 'undefined' && gp.app) {
		    gp.app.requestGameReady();
		    console.log("✅ GameReady отправлен скриптом!");
		}
	},

	async Game_Event4_Act1(runtime, localVars)
	{
// =====================================================================
// 🌍 СИСТЕМА ЛОКАЛИЗАЦИИ (СЛОВАРЬ)
// =====================================================================
if (!globalThis.currentLang) {
    const browserLang = navigator.language.slice(0, 2).toLowerCase(); 
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
        runtime.layout.scrollTo(collider.x, collider.y);
        globalThis.camX = collider.x;
        globalThis.camY = collider.y;
        
        if (collider.behaviors.Platform) {
            collider.behaviors.Platform.isEnabled = true;
        }

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

if (globalThis.playerColor === undefined) {
    globalThis.playerColor = pickNewColor(); 
}

if (!globalThis.isDead) {
    player.colorRgb = globalThis.playerColor;
}

// =====================================================================
// 🛑 СОСТОЯНИЕ 1: КИНЕМАТИКА ПОРТАЛА 🛑
// =====================================================================
if (!globalThis.isEnteringPortal && !globalThis.isWaitingForUI && runtime.objects.Portal) {
    for (const portal of runtime.objects.Portal.instances()) {
        if (collider.testOverlap(portal)) {
            globalThis.isEnteringPortal = true;
            
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

            if (currentNum >= TOTAL_LEVELS) {
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
                    
                    if ("MaxLevel" in runtime.globalVars) runtime.globalVars.MaxLevel = 1;
                    if ("TriggerSave" in runtime.globalVars) runtime.globalVars.TriggerSave = 1;

                    setTimeout(() => {
                        uiContainer.remove();
                        const jammer = setInterval(() => {
                            if ("MaxLevel" in runtime.globalVars) runtime.globalVars.MaxLevel = 1;
                        }, 10);
                        
                        runtime.goToLayout("lvl1");
                        
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
                        
                        <!-- 👇 КОНТЕЙНЕР ДЛЯ КНОПОК 👇 -->
                        <div id="social-container" class="social-box"></div>
                    </div>
                `;

                document.body.appendChild(uiContainer);

                requestAnimationFrame(() => {
                    uiContainer.style.opacity = '1';
                });

                // ==========================================
                // ⚙️ ЛОГИКА СОЦИАЛЬНЫХ КНОПОК (БРОНЕБОЙНАЯ)
                // ==========================================
                // ==========================================
                // ⚙️ ЛОГИКА СОЦИАЛЬНЫХ КНОПОК (ГИБРИДНЫЙ ПОДХОД)
                // ==========================================
                // Получаем платформу из переменной, которую мы установили выше
const gpPlatform = runtime.globalVars.CurrentPlatform; 

const socialContainer = document.getElementById('social-container');

if (socialContainer) {
    // Выбираем текст и стиль в зависимости от платформы
    const btnText = (gpPlatform === 'OK') ? 'OK ' + globalThis.t('btnSubscribe') : 'VK ' + globalThis.t('btnSubscribe');
    const btnClass = (gpPlatform === 'OK') ? 'btn-ok' : 'btn-vk';

    socialContainer.innerHTML = `
        <button id="btn-invite" class="btn-social btn-invite" style="pointer-events: auto; position: relative; z-index: 10000;">
            🤝 ${globalThis.t('btnInvite')}
        </button>
        <button id="btn-subscribe" class="btn-social ${btnClass}" style="pointer-events: auto; position: relative; z-index: 10000;">
            ${btnText}
        </button>
    `;

    // Привязываем события
    document.getElementById('btn-invite').onclick = () => {
        runtime.callFunction("GamePush_Invite");
    };

    document.getElementById('btn-subscribe').onclick = () => {
        // Ссылки теперь можно тоже менять динамически, если нужно
        const groupUrl = (gpPlatform === 'OK') 
            ? 'https://ok.ru/group/70000042375809' 
            : 'https://vk.com/club162959143';
        runtime.callFunction("GamePush_Subscribe", [groupUrl]);
    };
}

                // ==========================================
                // ⚙️ КЛИК ПО КНОПКЕ "ДАЛЬШЕ"
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
        skipBtn.style.top = 'max(16px, env(safe-area-inset-top))';
        skipBtn.style.left = 'clamp(92px, 14vw, 136px)';
        skipBtn.style.zIndex = '9998';
        skipBtn.style.background = 'linear-gradient(135deg, rgba(40, 40, 50, 0.8), rgba(20, 20, 25, 0.9))';
        skipBtn.style.backdropFilter = 'blur(12px)';
        skipBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        skipBtn.style.color = '#ffffff';
        skipBtn.style.padding = '10px 16px'; 
        skipBtn.style.borderRadius = '20px';
        skipBtn.style.fontFamily = '"Segoe UI", sans-serif';
        skipBtn.style.fontSize = 'clamp(12px, 2.8vw, 15px)'; 
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

	async Game_Event5_Act1(runtime, localVars)
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

	async Game_Event10(runtime, localVars)
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

	async Game_Event14_Act3(runtime, localVars)
	{
		// Проверяем, есть ли тут робот Playgama
		if (typeof instantGamesBridge !== 'undefined') {
		    // Кидаем ему фейковое сохранение, чтобы он поставил зеленую галочку
		    instantGamesBridge.storage.set('bot_test', 'ok')
		        .catch(e => console.log("Роботу всё равно"));
		}
	},

	async Game_Event16_Act1(runtime, localVars)
	{
globalThis.stickmanAdPlaying = true;
if (globalThis.StickmanMainMenu) globalThis.StickmanMainMenu.setAdLayerState(true);
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

	async Game_Event17_Act1(runtime, localVars)
	{
globalThis.stickmanAdPlaying = true;
if (globalThis.StickmanMainMenu) globalThis.StickmanMainMenu.setAdLayerState(true);
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

	async Game_Event19_Act1(runtime, localVars)
	{
		globalThis.stickmanAdPlaying = false;
		if (globalThis.StickmanMainMenu) globalThis.StickmanMainMenu.setAdLayerState(false);
		runtime.goToLayout(globalThis.targetLevelName);
	},

	async Game_Event20_Act1(runtime, localVars)
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
		                let savedMuted = false;
		                try { savedMuted = localStorage.getItem("stickman_sound_muted") === "1"; } catch(e) {}
		                globalThis.gameAudioMuted = !!savedMuted;
		                this.track.muted = !!globalThis.gameAudioMuted;
		                this.track.volume = globalThis.gameAudioMuted ? 0 : 0.4;
		                this.isReady = true;
		            } catch (err) {
		                console.error("❌ ОШИБКА: Не могу загрузить трек.", err);
		            }
		        },
		
		        // Функция воспроизведения
		        play: function() {
		            if (globalThis.gameAudioMuted) {
		                this.pause();
		                return;
		            }
		            if (this.track) {
		                this.track.play().then(() => {
		                    console.log("▶️ Музыка пошла!");
		                }).catch(e => {
		                    console.warn("🔇 Браузер заблокировал звук. Ждем клика пользователя.", e);
		                });
		            }
		        },
		
		        // Функция паузы
		        applyMuteState: function() {
		            if (!this.track) return;
		            this.track.muted = !!globalThis.gameAudioMuted;
		            this.track.volume = globalThis.gameAudioMuted ? 0 : 0.4;
		            if (globalThis.gameAudioMuted) this.track.pause();
		        },
		
		        setMuted: function(muted) {
		            globalThis.gameAudioMuted = !!muted;
		            try { localStorage.setItem("stickman_sound_muted", globalThis.gameAudioMuted ? "1" : "0"); } catch(e) {}
		            this.applyMuteState();
		        },
		
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

	async Game_Event21_Act1(runtime, localVars)
	{
		globalThis.stickmanAdPlaying = true;
		if (globalThis.StickmanMainMenu) globalThis.StickmanMainMenu.setAdLayerState(true);
		if (globalThis.MusicManager) globalThis.MusicManager.pause();
	},

	async Game_Event21_Act2(runtime, localVars)
	{
		runtime.timeScale = 0;
	},

	async Game_Event22_Act1(runtime, localVars)
	{
		globalThis.stickmanAdPlaying = true;
		if (globalThis.StickmanMainMenu) globalThis.StickmanMainMenu.setAdLayerState(true);
		runtime.timeScale = 1;
	},

	async Game_Event23_Act1(runtime, localVars)
	{
		globalThis.stickmanAdPlaying = true;
		if (globalThis.StickmanMainMenu) globalThis.StickmanMainMenu.setAdLayerState(true);
		if (globalThis.MusicManager) globalThis.MusicManager.pause();
	},

	async Game_Event24_Act1(runtime, localVars)
	{
		globalThis.stickmanAdPlaying = true;
		if (globalThis.StickmanMainMenu) globalThis.StickmanMainMenu.setAdLayerState(true);
		if (globalThis.MusicManager) globalThis.MusicManager.pause();
	},

	async Game_Event24_Act2(runtime, localVars)
	{
		runtime.timeScale = 0;
	},

	async Game_Event25_Act1(runtime, localVars)
	{

	},

	async Game_Event26_Act1(runtime, localVars)
	{
		globalThis.stickmanAdPlaying = false;
		if (globalThis.StickmanMainMenu) globalThis.StickmanMainMenu.setAdLayerState(false);
		if (globalThis.MusicManager) globalThis.MusicManager.play();
	},

	async Game_Event26_Act2(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.applyMuteState();
	},

	async Game_Event27_Act1(runtime, localVars)
	{
		globalThis.stickmanAdPlaying = false;
		if (globalThis.StickmanMainMenu) globalThis.StickmanMainMenu.setAdLayerState(false);
		if (globalThis.MusicManager) globalThis.MusicManager.play();
	},

	async Game_Event27_Act2(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.applyMuteState();
	},

	async Game_Event28_Act1(runtime, localVars)
	{
		globalThis.stickmanAdPlaying = false;
		if (globalThis.StickmanMainMenu) globalThis.StickmanMainMenu.setAdLayerState(false);
		if (globalThis.MusicManager) globalThis.MusicManager.play();
	},

	async Game_Event28_Act2(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.applyMuteState();
	},

	async Game_Event31_Act1(runtime, localVars)
	{
		globalThis.stickmanAdPlaying = false;
		if (globalThis.StickmanMainMenu) globalThis.StickmanMainMenu.setAdLayerState(false);
		// Внутри события "On rewarded video close" в твоем Event Sheet:
		const skipBtn = document.getElementById('skip-level-btn');
		if (skipBtn) {
		    skipBtn.style.display = 'flex'; // или 'block', смотря какой стиль у тебя был
		}
	},

	async Game_Event31_Act2(runtime, localVars)
	{
		runtime.timeScale = 1;
		if (globalThis.MusicManager) globalThis.MusicManager.applyMuteState();
	},

	async Game_Event32_Act1(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.pause();
	},

	async Game_Event32_Act2(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.applyMuteState();
	},

	async Game_Event33_Act1(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.play();
	},

	async Game_Event33_Act2(runtime, localVars)
	{
		if (globalThis.MusicManager) globalThis.MusicManager.applyMuteState();
	},

	async Game_Event37_Act1(runtime, localVars)
	{
// === СТАРТОВОЕ МЕНЮ + АДАПТИВ + SVG-КНОПКИ ДЛЯ VK/OK ===
if (!globalThis.StickmanMainMenu) {
    globalThis.StickmanMainMenu = {
        initialized: false,
        opened: false,
        firstOpenDone: false,
        runtime: null,
        elements: {},
        iconSrc: "data:image/png;base64,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",
        langData: {
            ru: {
                play: "Играть",
                continue: "Продолжить",
                title: "Стикман Паркур",
                subtitle: "Мир Крафта",
                desc: "Прыгай по платформам, избегай ловушек и доберись до портала.",
                controlsPcTitle: "Управление на ПК",
                controlsMobileTitle: "Управление на телефоне",
                pc: "A / D или стрелки — бег. Пробел или ↑ — прыжок.",
                mobile: "Экранные кнопки ← → — бег. Кнопка ↑ — прыжок.",
                double: "Двойной прыжок: нажми прыжок два раза.",
                invite: "Пригласить друга",
                subscribeVK: "VK Подписаться",
                subscribeOK: "OK Подписаться",
                level: "Текущий уровень",
                menu: "Меню",
                sound: "Звук"
            },
            en: {
                play: "Play",
                continue: "Continue",
                title: "Stickman Parkour",
                subtitle: "Craft World",
                desc: "Jump across platforms, avoid traps and reach the portal.",
                controlsPcTitle: "PC controls",
                controlsMobileTitle: "Mobile controls",
                pc: "A / D or arrows — run. Space or ↑ — jump.",
                mobile: "On-screen ← → buttons — run. ↑ button — jump.",
                double: "Double jump: press jump twice.",
                invite: "Invite friend",
                subscribeVK: "VK Subscribe",
                subscribeOK: "OK Subscribe",
                level: "Current level",
                menu: "Menu",
                sound: "Sound"
            },
            tr: {
                play: "Oyna",
                continue: "Devam et",
                title: "Stickman Parkur",
                subtitle: "Craft Dünyası",
                desc: "Platformlardan zıpla, tuzaklardan kaç ve portala ulaş.",
                controlsPcTitle: "PC kontrolleri",
                controlsMobileTitle: "Mobil kontroller",
                pc: "A / D veya oklar — koş. Space veya ↑ — zıpla.",
                mobile: "Ekrandaki ← → düğmeleri — koş. ↑ düğmesi — zıpla.",
                double: "Çift zıplama: zıplamaya iki kez bas.",
                invite: "Arkadaş davet et",
                subscribeVK: "VK Abone ol",
                subscribeOK: "OK Abone ol",
                level: "Geçerli bölüm",
                menu: "Menü",
                sound: "Ses"
            },
            pt: {
                play: "Jogar",
                continue: "Continuar",
                title: "Stickman Parkour",
                subtitle: "Mundo Craft",
                desc: "Salte pelas plataformas, evite armadilhas e chegue ao portal.",
                controlsPcTitle: "Controles no PC",
                controlsMobileTitle: "Controles no celular",
                pc: "A / D ou setas — correr. Espaço ou ↑ — pular.",
                mobile: "Botões ← → na tela — correr. Botão ↑ — pular.",
                double: "Pulo duplo: pressione pular duas vezes.",
                invite: "Convidar amigo",
                subscribeVK: "VK Inscrever-se",
                subscribeOK: "OK Inscrever-se",
                level: "Nível atual",
                menu: "Menu",
                sound: "Som"
            }
        },
        svgIcon(name) {
            const common = 'width="25" height="25" viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
            if (name === "menu") return `<svg ${common}><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`;
            if (name === "play") return `<svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>`;
            if (name === "soundOn") return `<svg ${common}><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path d="M16 8.5c1 1 1.5 2.1 1.5 3.5S17 14.5 16 15.5M18.5 6c1.8 1.7 2.7 3.7 2.7 6s-.9 4.3-2.7 6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>`;
            if (name === "soundOff") return `<svg ${common}><path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor"/><path d="M17 9l4 4m0-4l-4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
            if (name === "invite") return `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 2c-4 0-6.5 2-6.5 4.8V20h10.2a6.3 6.3 0 0 1-.2-1.5c0-2.1 1.1-4 2.7-5.1A12 12 0 0 0 9.5 13Z" fill="currentColor"/><path d="M18.5 14v7m-3.5-3.5h7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
            if (name === "vk") return `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.3 7.2c.1 6.2 3.2 9.9 8.7 9.9h.3v-3.6c2 .2 3.5 1.7 4.1 3.6h3.3c-.8-2.8-2.8-4.4-4-5 .9-.5 2.7-2.3 3.1-4.9h-3c-.5 1.9-2.1 3.6-3.5 3.8V7.2h-3v6.6C7.8 13.4 6 11.4 5.9 7.2H3.3Z" fill="currentColor"/></svg>`;
            if (name === "ok") return `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2.3a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Zm4.8 7.4c-.5-.8-1.5-1-2.3-.5a5 5 0 0 1-5 0c-.8-.5-1.8-.3-2.3.5-.5.8-.2 1.8.6 2.3.8.5 1.6.8 2.5 1l-2.2 2.2a1.6 1.6 0 0 0 2.3 2.3L12 19.9l1.6 1.6a1.6 1.6 0 0 0 2.3-2.3L13.7 17c.9-.2 1.7-.5 2.5-1 .8-.5 1.1-1.5.6-2.3Z" fill="currentColor"/></svg>`;
            return "";
        },
        withIcon(icon, text) {
            return `<span class="stickman-btn-content"><span class="stickman-btn-icon">${this.svgIcon(icon)}</span><span class="stickman-btn-label">${text}</span></span>`;
        },
        text(key) {
            const lang = (globalThis.currentLang || (navigator.language || "ru").slice(0, 2)).toLowerCase();
            const pack = this.langData[lang] || this.langData.ru;
            return pack[key] || this.langData.ru[key] || key;
        },
        isMobileDevice() {
            try {
                return (navigator.maxTouchPoints && navigator.maxTouchPoints > 1) || /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent || "") || Math.min(window.innerWidth, window.innerHeight) < 700;
            } catch(e) {
                return false;
            }
        },
        platform(rt) {
            try { return (rt.globalVars && rt.globalVars.CurrentPlatform) === "OK" ? "OK" : "VK"; }
            catch(e) { return "VK"; }
        },
        currentLevelName(rt) {
            try {
                const name = rt.layout && rt.layout.name ? rt.layout.name : "lvl1";
                return name.startsWith("lvl") ? name.replace("lvl", "") : name;
            } catch(e) { return "1"; }
        },
        init(rt) {
            this.runtime = rt;
            if (this.initialized) return;
            this.initialized = true;

            try {
                globalThis.gameAudioMuted = localStorage.getItem("stickman_sound_muted") === "1";
            } catch(e) {
                globalThis.gameAudioMuted = false;
            }

            const css = document.createElement("style");
            css.id = "stickman-main-menu-style";
            css.textContent = `
                #stickman-top-ui { position: fixed; top: max(12px, env(safe-area-inset-top)); left: 14px; right: 14px; z-index: 9997; display: flex; justify-content: space-between; align-items: center; pointer-events: none; font-family: Arial, sans-serif; }
                .stickman-float-btn { pointer-events: auto; width: 54px; height: 54px; min-width: 54px; padding: 0; border: 2px solid rgba(255,255,255,.18); border-radius: 16px; color: #fff; background: rgba(0,0,0,.34); box-shadow: 0 4px 10px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.12); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); cursor: pointer; font-size: 22px; font-weight: 900; text-shadow: 0 2px 4px rgba(0,0,0,.55); touch-action: manipulation; user-select: none; -webkit-user-select: none; display: inline-flex; align-items: center; justify-content: center; opacity: .88; }
                .stickman-float-btn svg { display: block; width: 25px; height: 25px; }
                .stickman-float-btn:active { transform: scale(.94); background: rgba(0,0,0,.48); }
                #stickman-menu-overlay { position: fixed; inset: 0; z-index: 20000; display: none; align-items: center; justify-content: center; padding: max(8px, env(safe-area-inset-top)) 8px max(8px, env(safe-area-inset-bottom)); box-sizing: border-box; background: radial-gradient(circle at 50% 15%, rgba(0,255,255,.14), rgba(0,0,0,.62) 48%, rgba(0,0,0,.80) 100%); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); font-family: Arial, sans-serif; pointer-events: auto; overflow: hidden; }
                .stickman-menu-card { width: min(560px, calc(100vw - 18px)); max-height: none; overflow: hidden; color: #fff; text-align: center; border-radius: clamp(20px, 4vw, 34px); padding: clamp(12px, 2.9vmin, 30px); box-sizing: border-box; background: linear-gradient(135deg, rgba(255,255,255,.20), rgba(255,255,255,.06)); border: 1px solid rgba(255,255,255,.28); border-top-color: rgba(255,255,255,.55); border-left-color: rgba(255,255,255,.42); box-shadow: 0 38px 90px rgba(0,0,0,.58), inset 0 0 30px rgba(255,255,255,.06); backdrop-filter: blur(26px) saturate(165%); -webkit-backdrop-filter: blur(26px) saturate(165%); animation: stickmanMenuPop .34s cubic-bezier(.16,1,.3,1); transform-origin: center center; }
                @keyframes stickmanMenuPop { from { opacity: 0; transform: translateY(16px) scale(.94); } to { opacity: 1; transform: translateY(0) scale(1); } }
                .stickman-menu-logo { display: inline-flex; width: clamp(56px, 15vmin, 106px); height: clamp(56px, 15vmin, 106px); align-items: center; justify-content: center; margin-bottom: clamp(4px, 1.4vmin, 10px); border-radius: clamp(18px, 4vmin, 32px); overflow: hidden; background: linear-gradient(135deg, rgba(255,255,255,.28), rgba(255,255,255,.08)); box-shadow: 0 16px 38px rgba(255,117,24,.36), inset 0 0 20px rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.35); }
                .stickman-menu-logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
                .stickman-menu-fallback { font-size: 48px; line-height: 1; }
                .stickman-menu-card h1 { margin: 0; font-size: clamp(24px, 5.2vmin, 52px); line-height: .95; letter-spacing: 1px; font-weight: 1000; text-transform: uppercase; text-shadow: 0 8px 22px rgba(0,0,0,.52); }
                .stickman-menu-card h2 { margin: clamp(3px, 1vmin, 6px) 0 clamp(7px, 1.7vmin, 14px); font-size: clamp(14px, 2.9vmin, 27px); color: #00ffff; letter-spacing: clamp(1px, .5vmin, 3px); text-transform: uppercase; text-shadow: 0 0 18px rgba(0,255,255,.55); }
                .stickman-menu-desc { margin: 0 auto clamp(8px, 1.7vmin, 16px); max-width: 480px; color: rgba(255,255,255,.86); font-size: clamp(12px, 2vmin, 16px); line-height: 1.25; }
                .stickman-menu-grid { display: grid; grid-template-columns: 1fr; gap: clamp(7px, 1.5vmin, 14px); margin: clamp(8px, 1.8vmin, 16px) 0; text-align: left; }
                .stickman-menu-box { padding: clamp(10px, 2vmin, 16px); border-radius: clamp(14px, 3vmin, 22px); background: rgba(0,0,0,.30); border: 1px solid rgba(255,255,255,.14); box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }
                .stickman-menu-box b { display: block; margin-bottom: clamp(5px, 1vmin, 8px); color: #fff; font-size: clamp(12px, 2vmin, 15px); text-transform: uppercase; letter-spacing: .8px; }
                .stickman-menu-box p { margin: clamp(3px, .8vmin, 7px) 0; color: rgba(255,255,255,.82); font-size: clamp(11px, 1.9vmin, 15px); line-height: 1.2; }
                .stickman-menu-actions { display: grid; gap: clamp(7px, 1.5vmin, 12px); margin-top: clamp(8px, 1.8vmin, 18px); }
                .stickman-menu-row { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(7px, 1.5vmin, 12px); }
                .stickman-menu-btn { min-height: clamp(42px, 7vmin, 54px); border: 0; border-radius: clamp(14px, 2.8vmin, 18px); padding: clamp(8px, 1.7vmin, 12px) clamp(10px, 2.3vmin, 18px); color: #fff; font-size: clamp(12px, 2vmin, 16px); font-weight: 900; cursor: pointer; letter-spacing: .3px; box-shadow: 0 8px 0 rgba(0,0,0,.25), 0 18px 35px rgba(0,0,0,.22); text-shadow: 0 2px 5px rgba(0,0,0,.35); transition: transform .12s ease, box-shadow .12s ease, filter .12s ease; touch-action: manipulation; user-select: none; -webkit-user-select: none; pointer-events: auto; }
                .stickman-btn-content { display: inline-flex; align-items: center; justify-content: center; gap: 9px; width: 100%; line-height: 1; vertical-align: middle; }
                .stickman-btn-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 22px; height: 22px; }
                .stickman-btn-content svg { flex: 0 0 auto; display: block; width: 20px; height: 20px; }
                .stickman-btn-label { display: inline-block; line-height: 1; position: relative; top: -1px; white-space: nowrap; }
                .stickman-menu-btn:active { transform: translateY(6px) scale(.98); box-shadow: 0 2px 0 rgba(0,0,0,.22), 0 8px 16px rgba(0,0,0,.18); }
                .stickman-primary { min-height: clamp(48px, 7.8vmin, 62px); font-size: clamp(15px, 2.6vmin, 20px); background: linear-gradient(180deg, #5cff7f, #1da54d); }
                .stickman-purple { background: linear-gradient(135deg, #a340ff, #5e35b1); }
                .stickman-vk { background: linear-gradient(135deg, #4da3ff, #1677f2); }
                .stickman-ok { background: linear-gradient(135deg, #ff9f2e, #f06d13); }
                .stickman-level-pill { display: inline-flex; align-items: center; gap: 8px; margin-top: clamp(7px, 1.5vmin, 13px); padding: clamp(5px, 1.1vmin, 8px) clamp(9px, 1.9vmin, 14px); border-radius: 999px; color: rgba(255,255,255,.86); background: rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.12); font-size: clamp(10px, 1.7vmin, 13px); }
                @media (max-width: 640px) { .stickman-menu-row { grid-template-columns: 1fr; } .stickman-float-btn { width: 48px; min-width: 48px; height: 48px; border-radius: 15px; } }
                @media (max-height: 620px) { .stickman-menu-logo { width: clamp(46px, 12vmin, 70px); height: clamp(46px, 12vmin, 70px); } .stickman-menu-card h1 { font-size: clamp(22px, 4.7vmin, 38px); } .stickman-menu-desc { display: none; } .stickman-level-pill { display: none; } }
                @media (max-height: 500px) { .stickman-menu-box p { margin: 2px 0; } .stickman-menu-actions { margin-top: 6px; } }
            `;
            document.head.appendChild(css);

            const top = document.createElement("div");
            top.id = "stickman-top-ui";
            top.innerHTML = `
                <button type="button" id="stickman-open-menu" class="stickman-float-btn" aria-label="Menu"></button>
                <button type="button" id="stickman-quick-sound" class="stickman-float-btn" aria-label="Sound"></button>
            `;
            document.body.appendChild(top);

            const logoHtml = this.iconSrc
                ? `<img alt="Stickman" src="${this.iconSrc}">`
                : `<span class="stickman-menu-fallback">S</span>`;

            const overlay = document.createElement("div");
            overlay.id = "stickman-menu-overlay";
            overlay.innerHTML = `
                <div class="stickman-menu-card" role="dialog" aria-modal="true">
                    <div class="stickman-menu-logo">${logoHtml}</div>
                    <h1 id="stickman-menu-title"></h1>
                    <h2 id="stickman-menu-subtitle"></h2>
                    <p class="stickman-menu-desc" id="stickman-menu-desc"></p>
                    <div class="stickman-menu-grid">
                        <div class="stickman-menu-box">
                            <b id="stickman-controls-title"></b>
                            <p id="stickman-controls-line-1"></p>
                            <p id="stickman-controls-line-2"></p>
                        </div>
                    </div>
                    <div class="stickman-menu-actions">
                        <button type="button" id="stickman-play-btn" class="stickman-menu-btn stickman-primary"></button>
                        <div class="stickman-menu-row">
                            <button type="button" id="stickman-invite-btn" class="stickman-menu-btn stickman-purple"></button>
                            <button type="button" id="stickman-subscribe-btn" class="stickman-menu-btn"></button>
                        </div>
                    </div>
                    <div class="stickman-level-pill" id="stickman-level-pill"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            this.elements = {
                top, overlay,
                card: overlay.querySelector(".stickman-menu-card"),
                open: document.getElementById("stickman-open-menu"),
                quickSound: document.getElementById("stickman-quick-sound"),
                play: document.getElementById("stickman-play-btn"),
                invite: document.getElementById("stickman-invite-btn"),
                subscribe: document.getElementById("stickman-subscribe-btn")
            };

            const stop = (ev) => {
                if (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
                }
            };

            const card = overlay.querySelector(".stickman-menu-card");
            ["pointerdown", "pointerup", "touchstart", "touchend", "mousedown", "mouseup", "click"].forEach(type => {
                card.addEventListener(type, (ev) => ev.stopPropagation(), false);
                top.addEventListener(type, (ev) => ev.stopPropagation(), false);
            });
            overlay.addEventListener("click", (ev) => ev.stopPropagation(), false);

            const bindButton = (btn, handler) => {
                if (!btn) return;
                let lastRun = 0;
                const run = (ev) => {
                    stop(ev);
                    const now = Date.now();
                    if (now - lastRun < 220) return;
                    lastRun = now;
                    handler(ev);
                };
                btn.addEventListener("pointerup", run, false);
                btn.addEventListener("click", run, false);
                btn.addEventListener("touchend", run, false);
            };

            bindButton(this.elements.open, () => this.openMenu(rt));
            bindButton(this.elements.quickSound, () => this.toggleSound(rt));
            bindButton(this.elements.play, () => this.closeMenu(rt));
            bindButton(this.elements.invite, () => {
                try { rt.callFunction("GamePush_Invite"); }
                catch(e) { console.warn("Invite is unavailable", e); }
            });
            bindButton(this.elements.subscribe, () => {
                const platform = this.platform(rt);
                const groupUrl = platform === "OK" ? "https://ok.ru/group/70000042375809" : "https://vk.com/club162959143";
                try { rt.callFunction("GamePush_Subscribe", [groupUrl]); }
                catch(e) { window.open(groupUrl, "_blank"); }
            });

            const refit = () => {
                this.fitToScreen();
                requestAnimationFrame(() => this.fitToScreen());
            };
            window.addEventListener("resize", refit, { passive: true });
            window.addEventListener("orientationchange", refit, { passive: true });
            if (window.visualViewport) window.visualViewport.addEventListener("resize", refit, { passive: true });
            const logoImg = overlay.querySelector(".stickman-menu-logo img");
            if (logoImg) logoImg.addEventListener("load", refit, { once: true });

            this.render(rt);
            this.applyAudio(rt);
            this.setAdLayerState(!!globalThis.stickmanAdPlaying);
            this.fitToScreen();
        },
        fitToScreen() {
            const card = this.elements && this.elements.card;
            if (!card) return;
            const vw = (window.visualViewport && window.visualViewport.width) || window.innerWidth || document.documentElement.clientWidth || 360;
            const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight || document.documentElement.clientHeight || 640;
            card.style.transform = "scale(1)";
            card.style.transformOrigin = "center center";
            const rect = card.getBoundingClientRect();
            const neededW = Math.max(card.scrollWidth, rect.width, 1);
            const neededH = Math.max(card.scrollHeight, rect.height, 1);
            const margin = Math.max(6, Math.min(18, vw * 0.025));
            const availableW = Math.max(220, vw - margin * 2);
            const availableH = Math.max(220, vh - margin * 2);
            const scale = Math.min(1, availableW / neededW, availableH / neededH);
            card.style.transform = "scale(" + Math.max(0.56, scale).toFixed(3) + ")";
        },
        render(rt) {
            const $ = (id) => document.getElementById(id);
            if (!$("stickman-menu-title")) return;
            const platform = this.platform(rt);
            const isOK = platform === "OK";
            const isMobile = this.isMobileDevice();

            $("stickman-menu-title").textContent = this.text("title");
            $("stickman-menu-subtitle").textContent = this.text("subtitle");
            $("stickman-menu-desc").textContent = this.text("desc");
            $("stickman-controls-title").textContent = isMobile ? this.text("controlsMobileTitle") : this.text("controlsPcTitle");
            $("stickman-controls-line-1").textContent = isMobile ? this.text("mobile") : this.text("pc");
            $("stickman-controls-line-2").textContent = this.text("double");

            if (this.elements.play) this.elements.play.innerHTML = this.withIcon("play", this.firstOpenDone ? this.text("continue") : this.text("play"));
            if (this.elements.invite) this.elements.invite.innerHTML = this.withIcon("invite", this.text("invite"));
            if (this.elements.subscribe) {
                this.elements.subscribe.textContent = isOK ? this.text("subscribeOK") : this.text("subscribeVK");
                this.elements.subscribe.classList.remove("stickman-vk", "stickman-ok", "stickman-orange");
                this.elements.subscribe.classList.add(isOK ? "stickman-ok" : "stickman-vk");
            }
            if (this.elements.open) {
                this.elements.open.title = this.text("menu");
                this.elements.open.innerHTML = this.svgIcon("menu");
            }
            if (this.elements.quickSound) this.elements.quickSound.title = this.text("sound");
            $("stickman-level-pill").textContent = this.text("level") + ": " + this.currentLevelName(rt);
            this.applyAudio(rt);
            this.setAdLayerState(!!globalThis.stickmanAdPlaying);
            this.fitToScreen();
        },
        applyAudio(rt) {
            const muted = !!globalThis.gameAudioMuted;
            try { if (rt.globalVars) rt.globalVars.SoundEnabled = muted ? 0 : 1; } catch(e) {}
            try { if (globalThis.MusicManager) globalThis.MusicManager.applyMuteState(); } catch(e) {}
            if (this.elements.quickSound) this.elements.quickSound.innerHTML = this.svgIcon(muted ? "soundOff" : "soundOn");
        },
        toggleSound(rt) {
            globalThis.gameAudioMuted = !globalThis.gameAudioMuted;
            try { localStorage.setItem("stickman_sound_muted", globalThis.gameAudioMuted ? "1" : "0"); } catch(e) {}
            this.applyAudio(rt);
            if (!globalThis.gameAudioMuted && globalThis.MusicManager) {
                try { globalThis.MusicManager.play(); } catch(e) {}
            }
        },
        setAdLayerState(isAdPlaying) {
            globalThis.stickmanAdPlaying = !!isAdPlaying;
            const top = this.elements && this.elements.top;
            if (!top) return;
            // Как у мобильных кнопок управления: не скрываем, а только кладём ниже рекламного слоя.
            // В обычной игре кнопки видимы и кликабельны; во время рекламы рекламный контейнер перекроет их сверху.
            if (globalThis.stickmanAdPlaying) {
                top.style.zIndex = "5";
            } else {
                top.style.zIndex = "9997";
            }
            top.style.opacity = "1";
            top.style.visibility = "visible";
            top.style.pointerEvents = "none";
        },
        openMenu(rt) {
            this.runtime = rt;
            this.opened = true;
            this.render(rt);
            this.elements.overlay.style.display = "flex";
            this.fitToScreen();
            requestAnimationFrame(() => this.fitToScreen());
            try { rt.timeScale = 0; } catch(e) {}
        },
        closeMenu(rt) {
            this.runtime = rt;
            this.opened = false;
            this.firstOpenDone = true;
            this.elements.overlay.style.display = "none";
            if (this.elements.card) this.elements.card.style.transform = "scale(1)";
            try { rt.timeScale = 1; } catch(e) {}
            this.render(rt);
            if (!globalThis.gameAudioMuted && globalThis.MusicManager) {
                try { globalThis.MusicManager.play(); } catch(e) {}
            }
        },
        tick(rt) {
            this.init(rt);
            this.render(rt);
            if (!this.firstOpenDone) this.openMenu(rt);
            if (this.opened) {
                try { rt.timeScale = 0; } catch(e) {}
            }
        }
    };
}

globalThis.StickmanMainMenu.tick(runtime);
	}
};

globalThis.C3.JavaScriptInEvents = scriptsInEvents;
