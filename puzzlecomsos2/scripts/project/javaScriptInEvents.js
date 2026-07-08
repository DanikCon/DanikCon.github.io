

const scriptsInEvents = {

	async Gameplay_Event19_Act2(runtime, localVars)
	{
		const layer = runtime.layout.getLayer("game"); 
		const planets = runtime.objects.ObjectMach.getPickedInstances();
		
		if (planets && planets.length > 0) {
		    const p = planets[0];
		    const [cssX, cssY] = layer.layerToCssPx(p.x, p.y);
		
		    // Ударная волна
		    if (window.rings) {
		        window.rings.push({ x: cssX, y: cssY, radius: 5, life: 1 });
		    }
		    
		    // ВСПЛЫВАЮЩИЕ ОЧКИ (Обновлено по твоей логике)
		    if (window.scores) {
		        // Формула: 8, 16, 32, 64, 128...
		        const pointsAmount = 8 * (2 ** p.animationFrame); 
		        
		        window.scores.push({ 
		            x: cssX, 
		            y: cssY, 
		            text: "+" + pointsAmount, 
		            life: 1.5, 
		            speed: 1.5 
		        });
		    }
		
		    // Искры
		    if (window.sparks) {
		        const colors = ['255, 165, 0', '255, 69, 0', '255, 215, 0', '100, 200, 255']; 
		        for (let i = 0; i < 40; i++) { 
		            const angle = Math.random() * Math.PI * 2;
		            const speed = 1 + Math.random() * 5; 
		            const randomColor = colors[Math.floor(Math.random() * colors.length)];
		            
		            window.sparks.push({
		                x: cssX,
		                y: cssY,
		                vx: Math.cos(angle) * speed,
		                vy: Math.sin(angle) * speed,
		                size: 1 + Math.random() * 2, 
		                life: 1,
		                color: randomColor
		            });
		        }
		    }
		}
	},

	async Gameplay_Event20_Act2(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	},

	async Gameplay_Event21_Act2(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	},

	async Gameplay_Event22_Act2(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	},

	async Gameplay_Event23_Act2(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	},

	async Gameplay_Event24_Act2(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	},

	async Gameplay_Event25_Act2(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	},

	async Gameplay_Event26_Act2(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	},

	async Gameplay_Event27_Act2(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	},

	async Gameplay_Event28_Act2(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	},

	async Gameplay_Event30_Act4(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	},

	async Gameplay_Event45_Act2(runtime, localVars)
	{
		try {
		    if (window.puzzle333ClearGameState) window.puzzle333ClearGameState();
		    else localStorage.removeItem('puzzle333_state_v4');
		} catch (err) {
		    console.warn('Не удалось очистить сохранение поля:', err);
		}
	},

	async Gameplay_Event51_Act3(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveRecord) window.puzzle333SaveRecord(runtime);
		    if (window.puzzle333ClearGameState) window.puzzle333ClearGameState();
		    else localStorage.removeItem('puzzle333_state_v4');
		} catch (err) {
		    console.warn('Не удалось очистить поле после проигрыша:', err);
		}
	},

	async Gameplay_Event55_Act4(runtime, localVars)
	{
		const layer = runtime.layout.getLayer("game");
		const bombs = runtime.objects.bombe.getPickedInstances(); 
		
		if (bombs && bombs.length > 0) {
		    const bomb = bombs[0];
		    const [cssX, cssY] = layer.layerToCssPx(bomb.x, bomb.y);
		
		    // 1. УДАРНАЯ ВОЛНА
		    if (window.rings) {
		        window.rings.push({ x: cssX, y: cssY, radius: 5, life: 1.0 }); 
		        window.rings.push({ x: cssX, y: cssY, radius: 20, life: 0.5 }); 
		    }
		
		    // 2. ВЗРЫВ (Теперь разлетаются "звездочкой")
		    if (window.sparks) {
		        const bombColors = ['255, 100, 0', '255, 200, 50', '255, 255, 100', '255, 255, 255'];
		        
		        for (let i = 0; i < 40; i++) { // Чуть увеличил количество для густоты
		            const angle = Math.random() * Math.PI * 2; // Разлет на все 360 градусов
		            
		            // ВЕРНУЛИ РЕЗКОСТЬ: теперь искры выстреливают в разные стороны
		            const speed = 4 + Math.random() * 6; 
		            const randomColor = bombColors[Math.floor(Math.random() * bombColors.length)];
		            
		            window.sparks.push({
		                x: cssX,
		                y: cssY,
		                vx: Math.cos(angle) * speed,
		                vy: Math.sin(angle) * speed,
		                size: 2 + Math.random() * 4, // Сделал чуть аккуратнее, чтобы был виден полет
		                life: 0.9, // Успеют разлететься лучами и красиво погаснуть
		                color: randomColor
		            });
		        }
		    }
		}
	},

	async Gameplay_Event55_Act9(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	},

	async Gameplay_Event70_Act1(runtime, localVars)
	{
		// Открываем группу только в отдельной вкладке/окне. Без fallback на текущую вкладку, чтобы не перекрывать игру.
		(() => {
		    const platform = String(runtime.globalVars.CurrentPlatform || '').toUpperCase();
		    const href = String(window.location.href || '').toLowerCase();
		    const isOK = platform.includes('OK') || href.includes('ok.ru') || href.includes('odnoklassniki');
		    const url = isOK ? 'https://ok.ru/group/70000042375809' : 'https://vk.com/public162959143';
		
		    try {
		        const popup = window.open('', '_blank');
		        if (popup) {
		            popup.opener = null;
		            popup.location = url;
		            return;
		        }
		    } catch (err) {
		        console.warn('window.open не сработал:', err);
		    }
		
		    try {
		        const a = document.createElement('a');
		        a.href = url;
		        a.target = '_blank';
		        a.rel = 'noopener noreferrer';
		        a.style.display = 'none';
		        document.body.appendChild(a);
		        a.click();
		        a.remove();
		    } catch (err) {
		        console.warn('Не удалось открыть группу в новой вкладке:', err);
		    }
		})();
	},

	async Gameplay_Event77_Act2(runtime, localVars)
	{
		try {
		    if (window.puzzle333ClearGameState) window.puzzle333ClearGameState();
		    else localStorage.removeItem('puzzle333_state_v4');
		} catch (err) {
		    console.warn('Не удалось очистить сохранение поля:', err);
		}
	},

	async Gameplay_Event82_Act1(runtime, localVars)
	{
// Оптимизированный FX-слой: один canvas и один animation loop даже после Restart layout.
if (window.c3FxAnimId) cancelAnimationFrame(window.c3FxAnimId);
if (window.c3FxResizeHandler) window.removeEventListener('resize', window.c3FxResizeHandler);
const oldFxCanvas = document.getElementById('c3-fx-canvas');
if (oldFxCanvas) oldFxCanvas.remove();

const fxCanvas = document.createElement('canvas');
fxCanvas.id = 'c3-fx-canvas';
fxCanvas.width = window.innerWidth;
fxCanvas.height = window.innerHeight;
fxCanvas.style.position = 'absolute';
fxCanvas.style.top = '0';
fxCanvas.style.left = '0';
fxCanvas.style.pointerEvents = 'none';
fxCanvas.style.zIndex = '999';
document.body.appendChild(fxCanvas);

const ctx = fxCanvas.getContext('2d', { alpha: true });
window.sparks = window.sparks || [];
window.comets = window.comets || [];
window.rings = window.rings || [];
window.sparks.length = 0;
window.comets.length = 0;
window.rings.length = 0;

function renderFX() {
    ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

    // Кометы ограничены по количеству, чтобы не разгонять нагрузку на слабых устройствах.
    if (window.comets.length < 8 && Math.random() < 0.004) {
        window.comets.push({
            x: Math.random() * window.innerWidth,
            y: -50,
            vx: 4 + Math.random() * 5,
            vy: 6 + Math.random() * 7,
            opacity: 0.1 + Math.random() * 0.25
        });
    }

    for (let i = window.comets.length - 1; i >= 0; i--) {
        const c = window.comets[i];
        const tailX = c.x - (c.vx * 10);
        const tailY = c.y - (c.vy * 10);
        const grad = ctx.createLinearGradient(c.x, c.y, tailX, tailY);
        grad.addColorStop(0, `rgba(150, 220, 255, ${c.opacity})`);
        grad.addColorStop(1, 'rgba(150, 220, 255, 0)');
        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        c.x += c.vx;
        c.y += c.vy;
        if (c.y > window.innerHeight + 200 || c.x > window.innerWidth + 200) window.comets.splice(i, 1);
    }

    if (window.rings.length > 10) window.rings.splice(0, window.rings.length - 10);
    for (let i = window.rings.length - 1; i >= 0; i--) {
        const r = window.rings[i];
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 215, 0, ${r.life})`;
        ctx.lineWidth = 2 + (r.life * 4);
        ctx.stroke();
        r.radius += 5;
        r.life -= 0.05;
        if (r.life <= 0) window.rings.splice(i, 1);
    }

    if (window.sparks.length > 140) window.sparks.splice(0, window.sparks.length - 140);
    for (let i = window.sparks.length - 1; i >= 0; i--) {
        const p = window.sparks[i];
        ctx.fillStyle = `rgba(${p.color}, ${p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 0.03;
        if (p.life <= 0) window.sparks.splice(i, 1);
    }

    window.c3FxAnimId = requestAnimationFrame(renderFX);
}
renderFX();

window.c3FxResizeHandler = () => {
    fxCanvas.width = window.innerWidth;
    fxCanvas.height = window.innerHeight;
};
window.addEventListener('resize', window.c3FxResizeHandler);
	},

	async Gameplay_Event83_Act2(runtime, localVars)
	{
// 1. УБИВАЕМ СТАРЫЕ ТАЙМЕРЫ
// Если мы перезапустили уровень, а таймер еще жив - отменяем его
if (window.mySyncTimer) {
    clearInterval(window.mySyncTimer);
}

// 2. ИЩЕМ СТАРЫЕ ЭЛЕМЕНТЫ ПЛАШКИ (чтобы не плодить их десятками)
let banner = document.getElementById('c3-save-banner');
let syncIcon = document.getElementById('c3-sync-icon');

// 3. СОЗДАЕМ, ТОЛЬКО ЕСЛИ ИХ НЕТ
if (!banner) {
    // Делаем плашку и даем ей "бейджик" (id), чтобы найти при рестарте
    banner = document.createElement('div');
    banner.id = 'c3-save-banner'; 
    banner.innerHTML = "☁️ Сохранение рекорда...";
    
    // Адаптация под мобилки
    const isMobile = window.innerWidth < 600;
    banner.style.padding = isMobile ? '6px 12px' : '10px 20px';
    banner.style.fontSize = isMobile ? '12px' : '16px';
    
    // Стили
    banner.style.position = 'absolute';
    banner.style.top = '20px';
    banner.style.right = '-300px';
    banner.style.background = 'rgba(255, 255, 255, 0.1)';
    banner.style.backdropFilter = 'blur(10px)';
    banner.style.webkitBackdropFilter = 'blur(10px)';
    banner.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    banner.style.borderRadius = '16px';
    banner.style.color = 'white';
    banner.style.fontFamily = 'Arial, sans-serif';
    banner.style.fontWeight = 'bold';
    banner.style.transition = 'right 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
    banner.style.zIndex = '1000';
    banner.style.pointerEvents = 'none';
    document.body.appendChild(banner);
}

if (!syncIcon) {
    // Делаем иконку и тоже даем ей id
    syncIcon = document.createElement('div');
    syncIcon.id = 'c3-sync-icon'; 
    syncIcon.innerHTML = "🔄";
    syncIcon.style.position = 'absolute';
    syncIcon.style.top = '25px';
    syncIcon.style.right = '20px';
    syncIcon.style.fontSize = '24px';
    syncIcon.style.opacity = '0';
    syncIcon.style.transition = 'opacity 0.3s ease';
    syncIcon.style.zIndex = '1001';
    syncIcon.style.pointerEvents = 'none';
    document.body.appendChild(syncIcon);
}
// --- ВРАЩЕНИЕ (ВОЗВРАЩАЕМ ПАМЯТЬ БРАУЗЕРУ) ---
// Ищем, есть ли уже наши правила анимации
let style = document.getElementById('c3-spin-style');

// Если правил нет — создаем их
if (!style) {
    style = document.createElement('style');
    style.id = 'c3-spin-style'; // Вешаем бейджик, чтобы потом найти
    style.innerHTML = `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin-anim { animation: spin 1s linear infinite; }
    `;
    document.head.appendChild(style);
}
// (Анимация вращения уже висит в стилях игры, дублировать не нужно)

// 4. СТАРТОВАЯ АНИМАЦИЯ ПРИ ЗАПУСКЕ УРОВНЯ
setTimeout(() => {
    banner.style.right = '60px';
    syncIcon.style.opacity = '1';
    syncIcon.classList.add('spin-anim');
    
    setTimeout(() => {
        banner.style.right = '-300px';
        syncIcon.style.opacity = '0';
        setTimeout(() => syncIcon.classList.remove('spin-anim'), 300);
    }, 3000);
}, 500);

// 5. Индикатор облачной синхронизации рекорда
// Записываем его в window.mySyncTimer, чтобы найти и убить при рестарте
window.mySyncTimer = setInterval(() => {
    syncIcon.style.opacity = '1';
    syncIcon.classList.add('spin-anim');
    
    setTimeout(() => {
        syncIcon.style.opacity = '0';
        setTimeout(() => syncIcon.classList.remove('spin-anim'), 300);
    }, 2000);
}, 30000);
	},

	async Gameplay_Event83_Act3(runtime, localVars)
	{
		// Надежное определение платформы для VK/OK и fallback для Web.
		let platformName = 'UNKNOWN';
		try {
		    if (typeof gp !== 'undefined' && gp.platform) {
		        platformName = String(gp.platform.type || gp.platform.name || '').toUpperCase();
		    }
		} catch (err) {
		    console.warn('Не удалось получить платформу GamePush:', err);
		}
		if (!platformName || platformName === 'UNKNOWN') {
		    const url = window.location.href.toLowerCase();
		    if (url.includes('ok.ru') || url.includes('odnoklassniki')) platformName = 'OK';
		    else if (url.includes('vk.com') || url.includes('vk_client')) platformName = 'VK';
		}
		runtime.globalVars.CurrentPlatform = platformName;
		console.log('Игра запущена на площадке:', platformName);
	},

	async Gameplay_Event83_Act4(runtime, localVars)
	{
		// 1. Указываем браузеру, какую картинку поставить на самый задний план
		// ВАЖНО: замени 'space_bg.jpg' на точное имя твоего файла из папки Files!
		document.body.style.backgroundImage = "url('backg.png')";
		
		// 2. Говорим картинке: "Растянись так, чтобы закрыть весь экран без пустот"
		document.body.style.backgroundSize = "cover";
		
		// 3. Выравниваем картинку ровно по центру
		document.body.style.backgroundPosition = "center";
		
		// 4. Картинка не должна повторяться плиткой, если вдруг экран слишком огромный
		document.body.style.backgroundRepeat = "no-repeat";
		
		// 5. На всякий случай задаем темно-космический цвет фона (если картинка будет грузиться долю секунды)
		document.body.style.backgroundColor = "#0b0b1a";
	},

	async Gameplay_Event83_Act5(runtime, localVars)
	{
		// Кастомное безопасное сохранение прогресса: шарики + текущий счет + локальный рекорд.
		// Не использует System Save/Load, поэтому не восстанавливает битый runtime-сейв Construct.
		(function () {
		    const STATE_KEY = "puzzle333_state_v4";
		    const RECORD_KEY = "puzzle333_record_v1";
		
		    window.puzzle333StateKey = STATE_KEY;
		    window.puzzle333RecordKey = RECORD_KEY;
		    window.puzzle333Runtime = runtime;
		
		    function toNumber(value, fallback = 0) {
		        const n = Number(value);
		        return Number.isFinite(n) ? n : fallback;
		    }
		
		    function clampInt(value, min = 0, max = 999999999) {
		        return Math.max(min, Math.min(max, Math.floor(toNumber(value, 0))));
		    }
		
		    function layerVisible(rt, name) {
		        try {
		            const layer = rt.layout.getLayer(name);
		            return !!(layer && layer.isVisible);
		        } catch (_) {
		            return false;
		        }
		    }
		
		    function readGpRecord() {
		        try {
		            if (typeof gp !== "undefined" && gp.player && typeof gp.player.get === "function") {
		                return clampInt(gp.player.get("hscore"));
		            }
		        } catch (_) {}
		        return 0;
		    }
		
		    window.puzzle333SaveRecord = function (rt) {
		        try {
		            if (!rt || !rt.globalVars) return;
		            const best = Math.max(
		                clampInt(rt.globalVars.bestscore),
		                clampInt(rt.globalVars.score),
		                readGpRecord(),
		                clampInt(localStorage.getItem(RECORD_KEY))
		            );
		            rt.globalVars.bestscore = best;
		            localStorage.setItem(RECORD_KEY, String(best));
		        } catch (err) {
		            console.warn("Не удалось сохранить локальный рекорд:", err);
		        }
		    };
		
		    window.puzzle333ClearGameState = function () {
		        try {
		            localStorage.removeItem(STATE_KEY);
		        } catch (err) {
		            console.warn("Не удалось очистить сохранение поля:", err);
		        }
		    };
		
		    window.puzzle333SaveState = function (rt) {
		        try {
		            if (!rt || !rt.objects || !rt.globalVars) return;
		
		            window.puzzle333SaveRecord(rt);
		
		            // На экране проигрыша или рекламы не сохраняем поле, иначе можно записать промежуточное/битое состояние.
		            if (layerVisible(rt, "lose") || layerVisible(rt, "ads")) return;
		
		            const objectClass = rt.objects.ObjectMach;
		            if (!objectClass || typeof objectClass.getAllInstances !== "function") return;
		
		            const balls = objectClass.getAllInstances()
		                .filter(inst => {
		                    if (!inst) return false;
		                    const x = toNumber(inst.x, NaN);
		                    const y = toNumber(inst.y, NaN);
		                    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
		                    // Отсекаем служебный/шаблонный шар за пределами поля.
		                    if (y < -200 || y > 2600 || x < -500 || x > 1600) return false;
		                    if (inst.instVars && inst.instVars.destroyed === true) return false;
		                    return true;
		                })
		                .slice(0, 120)
		                .map(inst => ({
		                    x: Math.round(toNumber(inst.x) * 100) / 100,
		                    y: Math.round(toNumber(inst.y) * 100) / 100,
		                    angle: Math.round(toNumber(inst.angle) * 10000) / 10000,
		                    frame: clampInt(inst.animationFrame, 0, 50)
		                }));
		
		            // Если счет уже есть, а шариков почему-то нет — это похоже на промежуточный/битый кадр. Такой сейв не пишем.
		            if (balls.length === 0 && clampInt(rt.globalVars.score) > 0) return;
		
		            const naklad = rt.objects.naklad && rt.objects.naklad.getFirstInstance
		                ? rt.objects.naklad.getFirstInstance()
		                : null;
		
		            const state = {
		                v: 4,
		                savedAt: Date.now(),
		                score: clampInt(rt.globalVars.score),
		                bestscore: clampInt(rt.globalVars.bestscore),
		                bomb: clampInt(rt.globalVars.bomb, 0, 1),
		                nakladFrame: naklad ? clampInt(naklad.animationFrame, 0, 50) : 0,
		                balls
		            };
		
		            localStorage.setItem(STATE_KEY, JSON.stringify(state));
		        } catch (err) {
		            console.warn("Не удалось сохранить поле:", err);
		        }
		    };
		
		    function restoreState() {
		        try {
		            const localRecord = clampInt(localStorage.getItem(RECORD_KEY));
		            if (localRecord > clampInt(runtime.globalVars.bestscore)) {
		                runtime.globalVars.bestscore = localRecord;
		            }
		
		            const raw = localStorage.getItem(STATE_KEY);
		            if (!raw) return;
		
		            const state = JSON.parse(raw);
		            if (!state || state.v !== 4 || !Array.isArray(state.balls)) return;
		
		            const ballsToRestore = state.balls
		                .filter(b => b && Number.isFinite(Number(b.x)) && Number.isFinite(Number(b.y)))
		                .slice(0, 120);
		
		            if (ballsToRestore.length === 0 && clampInt(state.score) > 0) {
		                localStorage.removeItem(STATE_KEY);
		                return;
		            }
		
		            // Удаляем только реальные шарики на поле. Служебные экземпляры далеко за полем не трогаем.
		            if (runtime.objects.ObjectMach && runtime.objects.ObjectMach.getAllInstances) {
		                for (const inst of runtime.objects.ObjectMach.getAllInstances()) {
		                    if (inst && toNumber(inst.y, 99999) < 3000) inst.destroy();
		                }
		            }
		            if (runtime.objects.bombe && runtime.objects.bombe.getAllInstances) {
		                for (const inst of runtime.objects.bombe.getAllInstances()) {
		                    if (inst && toNumber(inst.y, 99999) < 3000) inst.destroy();
		                }
		            }
		            if (runtime.objects.boomo && runtime.objects.boomo.getAllInstances) {
		                for (const inst of runtime.objects.boomo.getAllInstances()) {
		                    if (inst && toNumber(inst.y, 99999) < 3000) inst.destroy();
		                }
		            }
		
		            if (runtime.objects.ObjectMach && runtime.objects.ObjectMach.createInstance) {
		                for (const b of ballsToRestore) {
		                    const inst = runtime.objects.ObjectMach.createInstance("game", toNumber(b.x), toNumber(b.y));
		                    inst.angle = toNumber(b.angle);
		                    inst.animationFrame = clampInt(b.frame, 0, 50);
		                    if (inst.instVars && Object.prototype.hasOwnProperty.call(inst.instVars, "destroyed")) {
		                        inst.instVars.destroyed = false;
		                    }
		                }
		            }
		
		            const naklad = runtime.objects.naklad && runtime.objects.naklad.getFirstInstance
		                ? runtime.objects.naklad.getFirstInstance()
		                : null;
		            if (naklad) naklad.animationFrame = clampInt(state.nakladFrame, 0, 50);
		
		            runtime.globalVars.score = clampInt(state.score);
		            runtime.globalVars.bestscore = Math.max(
		                clampInt(state.bestscore),
		                clampInt(runtime.globalVars.bestscore),
		                readGpRecord(),
		                localRecord
		            );
		            runtime.globalVars.bomb = clampInt(state.bomb, 0, 1);
		            runtime.globalVars.createbom = 0;
		            runtime.globalVars.timer = 3;
		            runtime.globalVars.create = true;
		            runtime.globalVars.restart = 0;
		
		            console.log("Восстановлено поле:", ballsToRestore.length, "шариков, score=", runtime.globalVars.score);
		        } catch (err) {
		            console.warn("Битое сохранение поля удалено:", err);
		            try { localStorage.removeItem(STATE_KEY); } catch (_) {}
		        }
		    }
		
		    restoreState();
		
		    // Один набор обработчиков на вкладку. При рестарте уровня только обновляем runtime.
		    if (!window.puzzle333StateListenersRegistered) {
		        document.addEventListener("visibilitychange", () => {
		            if (document.hidden && window.puzzle333Runtime) {
		                window.puzzle333SaveState(window.puzzle333Runtime);
		            }
		        });
		        window.addEventListener("pagehide", () => {
		            if (window.puzzle333Runtime) window.puzzle333SaveState(window.puzzle333Runtime);
		        });
		        window.addEventListener("beforeunload", () => {
		            if (window.puzzle333Runtime) window.puzzle333SaveState(window.puzzle333Runtime);
		        });
		        window.addEventListener("blur", () => {
		            if (window.puzzle333Runtime) window.puzzle333SaveState(window.puzzle333Runtime);
		        });
		        window.puzzle333StateListenersRegistered = true;
		    }
		
		    if (window.puzzle333StateInterval) clearInterval(window.puzzle333StateInterval);
		    window.puzzle333StateInterval = setInterval(() => {
		        if (window.puzzle333Runtime) window.puzzle333SaveState(window.puzzle333Runtime);
		    }, 5000);
		})();
	},

	async Gameplay_Event83_Act6(runtime, localVars)
	{
		// Страховка на случай, если GamePush сам сообщает о mute/unmute во время рекламы.
		try {
		    if (!window.puzzle333SoundHooksInstalled && typeof gp !== 'undefined' && gp.sounds && typeof gp.sounds.on === 'function') {
		        window.puzzle333SoundHooksInstalled = true;
		        const holdMute = () => { try { runtime.globalVars.adMuteHold = 1; } catch (_) {} };
		        const releaseMute = () => { try { runtime.globalVars.adMuteHold = 0; } catch (_) {} };
		        gp.sounds.on('mute', holdMute);
		        gp.sounds.on('mute:sfx', holdMute);
		        gp.sounds.on('mute:music', holdMute);
		        gp.sounds.on('unmute', releaseMute);
		        gp.sounds.on('unmute:sfx', releaseMute);
		        gp.sounds.on('unmute:music', releaseMute);
		    }
		} catch (err) {
		    console.warn('Не удалось подключить GamePush sound hooks:', err);
		}
	},

	async Gameplay_Event84_Act1(runtime, localVars)
	{
		try {
		    if (window.puzzle333SaveState) window.puzzle333SaveState(runtime);
		} catch (err) {
		    console.warn('Не удалось выполнить быстрое сохранение:', err);
		}
	}
};

globalThis.C3.JavaScriptInEvents = scriptsInEvents;
