

const scriptsInEvents = {

	async Gameplay_Event80_Act1(runtime, localVars)
	{
// Создаем свой собственный холст поверх игры
const fxCanvas = document.createElement('canvas');
fxCanvas.width = window.innerWidth;
fxCanvas.height = window.innerHeight;
fxCanvas.style.position = 'absolute';
fxCanvas.style.top = '0';
fxCanvas.style.left = '0';
fxCanvas.style.pointerEvents = 'none'; 
fxCanvas.style.zIndex = '999'; 
document.body.appendChild(fxCanvas);

const ctx = fxCanvas.getContext('2d');

// Глобальные массивы (убрали звезды и очки)
window.sparks = [];
window.comets = [];
window.rings = [];

// Главный цикл отрисовки
function renderFX() {
    ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);

    // 1. Кометы
    if (Math.random() < 0.005) { 
        window.comets.push({
            x: Math.random() * window.innerWidth,
            y: -50,
            vx: 4 + Math.random() * 6,
            vy: 6 + Math.random() * 8,
            opacity: 0.1 + Math.random() * 0.3
        });
    }
    for (let i = window.comets.length - 1; i >= 0; i--) {
        let c = window.comets[i];
        let tailX = c.x - (c.vx * 10);
        let tailY = c.y - (c.vy * 10);
        
        let grad = ctx.createLinearGradient(c.x, c.y, tailX, tailY);
        grad.addColorStop(0, `rgba(150, 220, 255, ${c.opacity})`); 
        grad.addColorStop(1, `rgba(150, 220, 255, 0)`); 
        
        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2 + Math.random();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        c.x += c.vx;
        c.y += c.vy;
        if (c.y > window.innerHeight + 200 || c.x > window.innerWidth + 200) window.comets.splice(i, 1);
    }

    // 2. Ударная волна
    for (let i = window.rings.length - 1; i >= 0; i--) {
        let r = window.rings[i];
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 215, 0, ${r.life})`; 
        ctx.lineWidth = 2 + (r.life * 4); 
        ctx.stroke();
        r.radius += 5;  
        r.life -= 0.04; 
        if(r.life <= 0) window.rings.splice(i, 1);
    }

    // 3. Искры
    for(let i = window.sparks.length - 1; i >= 0; i--) {
        let p = window.sparks[i];
        ctx.fillStyle = `rgba(${p.color}, ${p.life})`; 
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; 
        p.life -= 0.03; 
        if(p.life <= 0) window.sparks.splice(i, 1);
    }

    requestAnimationFrame(renderFX);
}
renderFX();

window.addEventListener('resize', () => {
    fxCanvas.width = window.innerWidth;
    fxCanvas.height = window.innerHeight;
});
	},

	async Gameplay_Event21_Act2(runtime, localVars)
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

	async Gameplay_Event58_Act5(runtime, localVars)
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

	async Gameplay_Event81_Act2(runtime, localVars)
	{
// 1. СОЗДАЕМ СТЕКЛЯННУЮ ПЛАШКУ 
const banner = document.createElement('div');
banner.innerHTML = "☁️ Сохранение в облако...";

// Накидываем стили (тот самый Glassmorphism)
banner.style.position = 'absolute';
banner.style.top = '20px';
banner.style.right = '-300px'; // Прячем за правой границей экрана
banner.style.padding = '10px 20px';
banner.style.background = 'rgba(255, 255, 255, 0.1)';
banner.style.backdropFilter = 'blur(10px)';
banner.style.webkitBackdropFilter = 'blur(10px)'; // Для поддержки Safari
banner.style.border = '1px solid rgba(255, 255, 255, 0.2)';
banner.style.borderRadius = '16px';
banner.style.color = 'white';
banner.style.fontFamily = 'Arial, sans-serif';
banner.style.fontWeight = 'bold';
banner.style.transition = 'right 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28)'; // Эффект упругого выезда
banner.style.zIndex = '1000';
banner.style.pointerEvents = 'none'; // Чтобы клики проходили сквозь плашку в игру

// 2. СОЗДАЕМ КРУЖОК СИНХРОНИЗАЦИИ
const syncIcon = document.createElement('div');
syncIcon.innerHTML = "🔄"; // Можно заменить на любую иконку
syncIcon.style.position = 'absolute';
syncIcon.style.top = '25px';
syncIcon.style.right = '20px';
syncIcon.style.fontSize = '24px';
syncIcon.style.opacity = '0'; // Скрыт по умолчанию
syncIcon.style.transition = 'opacity 0.3s ease';
syncIcon.style.zIndex = '1001';
syncIcon.style.pointerEvents = 'none';

// 3. ДОБАВЛЯЕМ АНИМАЦИЮ ВРАЩЕНИЯ (CSS)
// Создаем правило вращения на 360 градусов
const style = document.createElement('style');
style.innerHTML = `
    @keyframes spin { 100% { transform: rotate(360deg); } }
    .spin-anim { animation: spin 1s linear infinite; }
`;
document.head.appendChild(style);

// 4. ВЫВОДИМ ВСЁ ЭТО ПОВЕРХ ИГРЫ
document.body.appendChild(banner);
document.body.appendChild(syncIcon);

// --- 5. ЛОГИКА ВРЕМЕНИ (ТАЙМЕРЫ) ---

// Выводим стартовую плашку через полсекунды после запуска уровня
setTimeout(() => {
    banner.style.right = '60px'; // Выдвигаем плашку (освобождаем место для кружка справа)
    syncIcon.style.opacity = '1'; // Показываем кружок
    syncIcon.classList.add('spin-anim'); // Запускаем вращение
    
    // Прячем всё это дело обратно через 3 секунды
    setTimeout(() => {
        banner.style.right = '-300px';
        syncIcon.style.opacity = '0';
        
        // Ждем пока исчезнет, и только потом останавливаем вращение
        setTimeout(() => syncIcon.classList.remove('spin-anim'), 300); 
    }, 3000);
}, 500);

// Таймер на каждые 30 секунд (показываем только кружок)
setInterval(() => {
    syncIcon.style.opacity = '1';
    syncIcon.classList.add('spin-anim');
    
    // Прячем кружок через 2 секунды
    setTimeout(() => {
        syncIcon.style.opacity = '0';
        setTimeout(() => syncIcon.classList.remove('spin-anim'), 300);
    }, 2000);
    
}, 30000); // 30000 миллисекунд = 30 секунд
	},

	async Gameplay_Event81_Act3(runtime, localVars)
	{
		// 1. Создаем временную переменную. По умолчанию пусть будет 'UNKNOWN'
		let platformName = 'UNKNOWN';
		
		// 2. Проверяем, загрузился ли GamePush
		if (typeof gp !== 'undefined') {
		    // GamePush сам читает все скрытые данные и выдает готовый тег
		    // Для ВКонтакте это будет 'VK', для Одноклассников - 'OK', для Яндекса - 'YANDEX'
		    platformName = gp.platform.type;
		} else {
		    // ЗАПАСНОЙ ПЛАН (если GamePush вдруг отвалится, читаем адресную строку напрямую)
		    // ВК и ОК при запуске игры добавляют в ссылку специальные слова
		    const url = window.location.href;
		    if (url.includes('ok.ru') || url.includes('odnoklassniki')) {
		        platformName = 'OK';
		    } else if (url.includes('vk.com') || url.includes('vk_client')) {
		        platformName = 'VK';
		    }
		}
		
		// 3. Передаем найденное имя платформы в движок
		runtime.globalVars.CurrentPlatform = platformName;
		
		console.log("Игра запущена на площадке:", platformName);
	}
};

globalThis.C3.JavaScriptInEvents = scriptsInEvents;
