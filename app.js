// ==========================================
// 1. БАЗА ДАННЫХ И ПАМЯТЬ СИСТЕМЫ
// ==========================================
const DB_KEY = 'liferpg_nexus_state_v5';

const defaultState = {
    user: { name: "Андрей", globalLevel: 1, xp: 0, xpMax: 100, coins: 0 },
    currentInput: { skill: "Спорт", mins: 15 },
    skills: {
        "Спорт": { level: 1, xpEarned: 0, icon: "fa-dumbbell" },
        "Чтение книг": { level: 1, xpEarned: 0, icon: "fa-book-open" },
        "Английский язык": { level: 1, xpEarned: 0, icon: "fa-language" },
        "Вождение": { level: 1, xpEarned: 0, icon: "fa-car" },
        "Работа за ПК": { level: 1, xpEarned: 0, icon: "fa-desktop" },
    },
    history: [
        { id: 1, dateStr: "Системный лог", items: [
            { type: "action", skill: "Инициализация системы", icon: "fa-power-off", time: "00:00", mins: 0, xp: 0, theme: "color-blue" }
        ]}
    ],
    activeTab: 'activity'
};

// Загрузка памяти при старте
let state = JSON.parse(localStorage.getItem(DB_KEY)) || defaultState;

// Если в старой базе было старое имя, принудительно обновляем под Андрея
if (state.user.name !== "Андрей") {
    state.user.name = "Андрей";
}

// Функция жесткого сохранения прогресса
function saveState() {
    localStorage.setItem(DB_KEY, JSON.stringify(state));
}

// ==========================================
// 2. БИЗНЕС-ЛОГИКА (CORE GAMEPLAY)
// ==========================================

function updateTime(delta) {
    let newMins = state.currentInput.mins + delta;
    if (newMins >= 0 && newMins <= 600) {
        state.currentInput.mins = newMins;
        render();
    }
}

function commitAction() {
    const mins = state.currentInput.mins;
    if (mins <= 0) return;

    const skillName = document.getElementById('skill-selector').value;
    state.currentInput.skill = skillName;
    
    // Формула генерации XP (Математика Архитектора)
    const earnedXP = Math.floor(mins * 0.8); 
    
    // ЭКОНОМИЧЕСКАЯ РЕФОРМА: Монеты даются сразу и прямо пропорционально опыту (1 XP = 1 Монета)
    state.user.coins += earnedXP;

    // Вектор 1: Прогресс Глобального уровня
    state.user.xp += earnedXP;
    if (state.user.xp >= state.user.xpMax) {
        state.user.globalLevel += 1;
        state.user.xp = state.user.xp - state.user.xpMax;
        state.user.xpMax = state.user.globalLevel * 100; // Усложнение прогрессии
        state.user.coins += 100; // Дополнительный бонус за левелап сохранен
        alert(`⚡ LEVEL UP!\nДостигнут Уровень ${state.user.globalLevel}. Награда: +100 бонусных монет!`);
    }

    // Вектор 2: Локальный навык
    if(!state.skills[skillName]) state.skills[skillName] = { level: 1, xpEarned: 0, icon: "fa-bolt" };
    state.skills[skillName].xpEarned += earnedXP;
    
    if(state.skills[skillName].xpEarned >= 100) {
        state.skills[skillName].level += 1;
        state.skills[skillName].xpEarned = 0;
        state.user.coins += 25; // Дополнительный бонус за уровень навыка
    }

    // Запись в Журнал
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newRecord = {
        type: "action", skill: skillName, icon: state.skills[skillName].icon,
        time: timeStr, mins: mins, xp: earnedXP, theme: "color-blue"
    };

    if(state.history[0].dateStr !== "Сегодня") {
        state.history.unshift({ id: Date.now(), dateStr: "Сегодня", items: [] });
    }
    state.history[0].items.unshift(newRecord);

    // СОХРАНЕНИЕ ПАМЯТИ
    saveState();

    const feedback = document.getElementById('action-feedback');
    feedback.innerHTML = `Начислено: <strong>+${earnedXP} XP</strong> & <strong>+${earnedXP} Монет</strong> мгновенно!`;
    feedback.style.color = "#10B981";
    
    state.currentInput.mins = 15; // Возврат таймера
    setTimeout(() => render(), 1500);
}

function buyReward(itemName, cost) {
    if (state.user.coins >= cost) {
        state.user.coins -= cost;
        
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        if(state.history[0].dateStr !== "Сегодня") {
            state.history.unshift({ id: Date.now(), dateStr: "Сегодня", items: [] });
        }
        
        state.history[0].items.unshift({
            type: "shop", name: itemName,
            icon: itemName === "Кальян" ? "fa-smoking" : (itemName === "Сладкое" ? "fa-candy-cane" : "fa-umbrella-beach"),
            time: timeStr, cost: cost, theme: "color-gold"
        });

        // СОХРАНЕНИЕ ПАМЯТИ
        saveState();
        alert(`✅ Покупка успешна: ${itemName}.`);
        render();
    } else {
        alert("❌ Недостаточно монет. Заработайте очки на вкладке Активность.");
    }
}

// Защищенный скрипт навигации (Без багов на Safari)
function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('onclick').includes(tabId)) el.classList.add('active');
    });
    render();
}

// ==========================================
// 3. РЕНДЕРИНГ ИНТЕРФЕЙСА (VIEW)
// ==========================================

function getProgressPct() { return Math.min(100, (state.user.xp / state.user.xpMax) * 100); }
function formatTime(mins) { return `${mins} мин = ${Math.floor(mins/60)}ч ${mins%60}мин`; }

function render() {
    const root = document.getElementById('view-root');
    switch(state.activeTab) {
        case 'activity': root.innerHTML = renderActivity(); break;
        case 'shop': root.innerHTML = renderShop(); break;
        case 'history': root.innerHTML = renderHistory(); break;
        case 'progress': root.innerHTML = renderProgress(); break;
    }
}

function renderActivity() {
    const opts = Object.keys(state.skills).map(sk => `<option value="${sk}" ${state.currentInput.skill === sk ? 'selected' : ''}>${sk}</option>`).join('');
    return `
        <div class="header-top">
            <div class="user-profile">
                <div class="avatar">👨‍💻</div><h1 class="title-h1" style="margin:0;">Привет, ${state.user.name}!</h1>
            </div>
            <div class="wallet-btn"><i class="fa-solid fa-wallet"></i></div>
        </div>
        <div class="neu-card">
            <div class="level-header"><span>Общий Уровень: <strong>${state.user.globalLevel}</strong></span><span><strong>${state.user.coins}</strong> <i class="fa-solid fa-coins coin-icon"></i></span></div>
            <div class="progress-track"><div class="progress-fill" style="width: ${getProgressPct()}%"></div></div>
            <div class="level-stats"><span>${Math.round(getProgressPct())}%</span><span>${state.user.xp} / ${state.user.xpMax} XP</span></div>
        </div>
        <h2 class="title-h1">Запись активности</h2>
        <div class="input-wrap">
            <label class="input-label">Категория активности (Кликабельно)</label>
            <select id="skill-selector" class="neu-select" onchange="state.currentInput.skill = this.value">${opts}</select>
        </div>
        <div class="input-wrap">
            <label class="input-label">Затраченное время (мин)</label>
            <div class="time-input-group">
                <button class="time-btn" onclick="updateTime(-5)"><i class="fa-solid fa-minus"></i></button>
                <div class="time-value">${state.currentInput.mins}</div>
                <button class="time-btn" onclick="updateTime(5)"><i class="fa-solid fa-plus"></i></button>
                <div class="time-suffix">МИН <i class="fa-regular fa-clock"></i></div>
            </div>
        </div>
        <div class="hint-text">${formatTime(state.currentInput.mins)} | Начислим XP и Монеты</div>
        <button class="btn-primary" onclick="commitAction()"><i class="fa-solid fa-check-circle"></i> Выполнил!</button>
        <div id="action-feedback" class="hint-text" style="margin-top:16px;"></div>
    `;
}

function renderShop() {
    return `
        <div class="shop-header"><h1>Магазин Наград</h1><div class="coin-badge"><span>${state.user.coins}</span><i class="fa-solid fa-coins coin-icon"></i></div></div>
        <div class="shop-grid">
            <div class="shop-item-card">
                <div class="item-img img-hookah">💨</div><div class="badge-tag">БЕЗ КУЛДАУНА</div>
                <div class="item-title">Кальян</div><div class="item-desc">Премиум табак. Без ограничений.</div>
                <button class="btn-buy" onclick="buyReward('Кальян', 800)">Купить за 800 <i class="fa-solid fa-coins" style="color:var(--gold)"></i></button>
            </div>
            <div class="shop-item-card">
                <div class="item-img img-sweets">🍬</div><div class="item-title" style="margin-top:8px">Сладкое</div>
                <div class="item-desc">Набор десертов. Без чувства вины.</div>
                <button class="btn-buy" onclick="buyReward('Сладкое', 150)">Купить за 150 <i class="fa-solid fa-coins" style="color:var(--gold)"></i></button>
            </div>
            <div class="shop-item-card full-width">
                <div class="item-img img-relax">🏝️</div>
                <div style="flex:1">
                    <div class="item-title">ОТДЫХ</div><div class="item-desc">Целый день полной свободы без рутины.</div>
                    <button class="btn-buy" onclick="buyReward('Отдых', 1500)">Купить за 1500 <i class="fa-solid fa-coins" style="color:var(--gold)"></i></button>
                </div>
            </div>
        </div>
    `;
}

function renderHistory() {
    let html = `<h1 class="title-h1" style="text-align:center">Журнал аудита</h1>`;
    state.history.forEach(group => {
        html += `<div class="date-header">${group.dateStr}</div>`;
        group.items.forEach(item => {
            if(item.type === 'action') {
                html += `<div class="history-card ${item.theme}"><div class="history-top"><div class="history-title-wrap"><div class="history-icon" style="color:var(--primary-blue)"><i class="fa-solid ${item.icon}"></i></div><div><div class="history-title">${item.skill}</div><div class="history-desc">Выполнение</div></div></div><div class="history-time">${item.time}</div></div><div class="history-bottom"><span>Затрачено: <span class="history-val">${item.mins} минут</span></span><span class="history-gain gain-xp">+${item.xp} XP / +${item.xp} Монет</span></div></div>`;
            } else {
                html += `<div class="history-card ${item.theme}"><div class="history-top"><div class="history-title-wrap"><div class="history-icon" style="color:var(--gold)"><i class="fa-solid ${item.icon}"></i></div><div><div class="history-title">${item.name}</div><div class="history-desc">Покупка</div></div></div><div class="history-time">${item.time}</div></div><div class="history-bottom"><span>Списание</span><span class="history-gain gain-coins">-${item.cost} Монет</span></div></div>`;
            }
        });
    });
    return html;
}

function renderProgress() {
    let html = `<h1 class="title-h1" style="text-align:center; font-size:16px;">ПРОГРЕСС И АНАЛИТИКА</h1><div class="skills-grid"><div class="skill-card global"><div class="skill-header"><span class="skill-name">Общий Уровень 🥇</span></div><div class="skill-lvl">Lvl ${state.user.globalLevel}</div><div class="progress-track"><div class="progress-fill" style="width: ${getProgressPct()}%"></div></div></div>`;
    
    const colors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
    let i = 0;
    for(let sk in state.skills) {
        let p = state.skills[sk];
        let c = colors[i % colors.length];
        html += `<div class="skill-card"><div class="skill-header"><span class="skill-name" style="font-size:10px;"><i class="fa-solid ${p.icon}" style="color:${c}"></i> ${sk}</span><span class="skill-lvl text-muted" style="margin:0">Lvl ${p.level}</span></div><div class="progress-track" style="height:4px"><div class="progress-fill" style="width:${p.xpEarned}%; background:${c}"></div></div></div>`;
        i++;
    }
    html += `</div>`;
    return html;
}

// Запуск интерфейса
window.onload = () => { render(); };

// ==========================================
// 4. ИНТЕГРАЦИЯ PWA (ДЛЯ УСТАНОВКИ НА IPHONE)
// ==========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/life-rpg/sw.js')
    .then(() => console.log("LifeRPG Nexus Core Active"));
}
