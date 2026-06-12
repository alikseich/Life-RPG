// ==========================================
// 1. БАЗА ДАННЫХ, ПАМЯТЬ И ОБЛАЧНАЯ СИНХРОНИЗАЦИЯ
// ==========================================
const CLOUD_API_URL = "https://script.google.com/macros/s/AKfycbxJL--R48vxeY4Ve85iDjogUI8K4bdQidHjcZePwQxDWL7x9v5PgDZWzkCgJuc_rp9D2g/exec";

const DB_KEY = 'liferpg_nexus_state_v6';

const defaultState = {
    user: { name: "Андрей", globalLevel: 1, xp: 0, xpMax: 100, totalMins: 0 },
    currentInput: { skill: "Спорт", mins: 15 },
    skills: {
        "Спорт": { level: 1, xpEarned: 0, icon: "fa-dumbbell", mins: 0 },
        "Чтение книг": { level: 1, xpEarned: 0, icon: "fa-book-open", mins: 0 },
        "Английский язык": { level: 1, xpEarned: 0, icon: "fa-language", mins: 0 },
        "Вождение": { level: 1, xpEarned: 0, icon: "fa-car", mins: 0 },
        "Работа за ПК": { level: 1, xpEarned: 0, icon: "fa-desktop", mins: 0 },
    },
    history: [],
    activeTab: 'activity',
    historyFilter: 'actions'
};

let state = JSON.parse(localStorage.getItem(DB_KEY)) || defaultState;

function runMigrations() {
    if (state.user.name !== "Андрей") state.user.name = "Андрей";
    if (state.user.totalMins === undefined) state.user.totalMins = 0;
    for (let sk in state.skills) {
        if (state.skills[sk].mins === undefined) state.skills[sk].mins = 0;
    }
    // Жесткое удаление монет, так как экономика магазина упразднена
    if (state.user.coins !== undefined) delete state.user.coins;
    
    // Миграция старой истории в новый плоский формат для аналитики
    if (!Array.isArray(state.history) || (state.history.length > 0 && state.history[0].dateStr)) {
        let flatHistory = [];
        state.history.forEach(group => {
            if(group.items) {
                group.items.forEach(item => {
                    if (item.type === 'action') {
                        if(!item.timestamp) item.timestamp = Date.now();
                        flatHistory.push(item);
                    }
                });
            }
        });
        state.history = flatHistory;
    }
    if(!state.historyFilter) state.historyFilter = 'actions';
}
runMigrations();

// Автоматическая фоновая подгрузка из Google Drive
async function syncWithCloud() {
    try {
        let response = await fetch(CLOUD_API_URL);
        let cloudData = await response.json();
        
        // Сравнение времени: берем базу оттуда, где прогресс больше
        let localTime = state.user.totalMins || 0;
        let cloudTime = (cloudData && cloudData.user) ? (cloudData.user.totalMins || 0) : 0;
        
        if (cloudTime > localTime) {
            state = cloudData;
            runMigrations();
            localStorage.setItem(DB_KEY, JSON.stringify(state));
            console.log("☁️ Данные успешно подтянуты из облака");
            render(); 
        }
    } catch (error) {
        console.log("⚠️ Облако недоступно. Работа в офлайн-режиме.");
    }
}
syncWithCloud();

// Сохранение и отправка на сервер (С пробитием защиты Apple)
function saveState() {
    localStorage.setItem(DB_KEY, JSON.stringify(state));
    
    fetch(CLOUD_API_URL, {
        method: 'POST',
        mode: 'no-cors', // <-- ВОТ ЭТА КОМАНДА ПРОБИВАЕТ БЛОКИРОВКУ
        body: JSON.stringify(state),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' } 
    }).catch(e => console.log("⚠️ Ошибка сети"));
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
    
    const earnedXP = Math.floor(mins * 0.8); 
    
    state.user.totalMins += mins;
    state.user.xp += earnedXP;
    
    if (state.user.xp >= state.user.xpMax) {
        state.user.globalLevel += 1;
        state.user.xp = state.user.xp - state.user.xpMax;
        state.user.xpMax = state.user.globalLevel * 100;
        alert(`⚡ LEVEL UP!\nДостигнут Уровень ${state.user.globalLevel}.`);
    }

    if(!state.skills[skillName]) state.skills[skillName] = { level: 1, xpEarned: 0, icon: "fa-bolt", mins: 0 };
    state.skills[skillName].xpEarned += earnedXP;
    state.skills[skillName].mins += mins;
    
    if(state.skills[skillName].xpEarned >= 100) {
        state.skills[skillName].level += 1;
        state.skills[skillName].xpEarned -= 100;
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    state.history.unshift({
        type: "action",
        skill: skillName,
        icon: state.skills[skillName].icon,
        time: timeStr,
        mins: mins,
        xp: earnedXP,
        timestamp: now.getTime()
    });

    saveState();

    const feedback = document.getElementById('action-feedback');
    feedback.innerHTML = `Начислено: <strong>+${earnedXP} XP</strong>. Записано в облако.`;
    feedback.style.color = "#10B981";
    
    state.currentInput.mins = 15; 
    setTimeout(() => render(), 1500);
}

function switchTab(tabId) {
    if (tabId === 'shop') tabId = 'activity'; // На случай, если в кэше завис старый клик
    state.activeTab = tabId;
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('onclick').includes(tabId)) el.classList.add('active');
    });
    render();
}

function setHistoryFilter(val) {
    state.historyFilter = val;
    saveState();
    render();
}

// ==========================================
// 3. АНАЛИТИКА (АГРЕГАТОР ИСТОРИИ)
// ==========================================

function getWeekKey(dateObj) {
    const d = new Date(dateObj);
    d.setHours(0,0,0,0);
    const day = d.getDay() || 7; 
    d.setDate(d.getDate() - day + 1);
    
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    
    const fmt = (dt) => dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    return `Неделя (${fmt(d)} - ${fmt(end)})`;
}

function aggregateHistory(period) {
    let groups = {};
    
    state.history.forEach(item => {
        let d = new Date(item.timestamp);
        let key = "Неизвестно";
        
        if (period === 'days') {
            key = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        } else if (period === 'weeks') {
            key = getWeekKey(d);
        } else if (period === 'months') {
            key = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        }

        if (!groups[key]) {
            groups[key] = { xp: 0, mins: 0, skills: {} };
        }
        
        groups[key].xp += item.xp;
        groups[key].mins += item.mins;
        
        if (!groups[key].skills[item.skill]) {
            groups[key].skills[item.skill] = { mins: 0, icon: item.icon };
        }
        groups[key].skills[item.skill].mins += item.mins;
    });

    return groups;
}

// ==========================================
// 4. РЕНДЕРИНГ ИНТЕРФЕЙСА (VIEW)
// ==========================================

function getProgressPct() { return Math.min(100, (state.user.xp / state.user.xpMax) * 100); }
function formatTime(mins) { return `${mins} мин = ${Math.floor(mins/60)}ч ${mins%60}мин`; }
function formatTimeShort(mins) { return `${Math.floor(mins/60)}ч ${mins%60}м`; }

function render() {
    const root = document.getElementById('view-root');
    switch(state.activeTab) {
        case 'activity': root.innerHTML = renderActivity(); break;
        case 'history': root.innerHTML = renderHistory(); break;
        case 'progress': root.innerHTML = renderProgress(); break;
        default: root.innerHTML = renderActivity(); break;
    }
}

function renderActivity() {
    const opts = Object.keys(state.skills).map(sk => `<option value="${sk}" ${state.currentInput.skill === sk ? 'selected' : ''}>${sk}</option>`).join('');
    return `
        <div class="header-top">
            <div class="user-profile">
                <div class="avatar">👨‍💻</div><h1 class="title-h1" style="margin:0;">Привет, ${state.user.name}!</h1>
            </div>
        </div>
        <div class="neu-card">
            <div class="level-header"><span>Общий Уровень: <strong>${state.user.globalLevel}</strong></span></div>
            <div class="progress-track"><div class="progress-fill" style="width: ${getProgressPct()}%"></div></div>
            <div class="level-stats"><span>${Math.round(getProgressPct())}%</span><span>${state.user.xp} / ${state.user.xpMax} XP</span></div>
        </div>
        <h2 class="title-h1">Запись активности</h2>
        <div class="input-wrap">
            <label class="input-label">Категория активности</label>
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
        <div class="hint-text">${formatTime(state.currentInput.mins)}</div>
        <button class="btn-primary" onclick="commitAction()"><i class="fa-solid fa-check-circle"></i> Зафиксировать!</button>
        <div id="action-feedback" class="hint-text" style="margin-top:16px;"></div>
    `;
}

function renderHistory() {
    let html = `<h1 class="title-h1" style="text-align:center; font-size: 20px;">История действий</h1>`;
    
    html += `
    <div class="history-controls">
        <select class="history-select" onchange="setHistoryFilter(this.value)">
            <option value="actions" ${state.historyFilter === 'actions' ? 'selected' : ''}>Список действий</option>
            <option value="days" ${state.historyFilter === 'days' ? 'selected' : ''}>Аналитика по Дням</option>
            <option value="weeks" ${state.historyFilter === 'weeks' ? 'selected' : ''}>Аналитика по Неделям</option>
            <option value="months" ${state.historyFilter === 'months' ? 'selected' : ''}>Аналитика по Месяцам</option>
        </select>
    </div>`;

    if (state.historyFilter === 'actions') {
        if(state.history.length === 0) return html + `<div style="text-align:center; color:gray; margin-top:40px;">История пуста</div>`;
        
        let lastDate = "";
        state.history.forEach(item => {
            let d = new Date(item.timestamp);
            let dStr = d.toLocaleDateString('ru-RU', {day:'numeric', month:'long'});
            if(dStr !== lastDate) {
                html += `<div class="date-header">${dStr}</div>`;
                lastDate = dStr;
            }
            html += `
            <div class="history-card">
                <div class="history-top">
                    <div class="history-title-wrap">
                        <div class="history-icon"><i class="fa-solid ${item.icon}"></i></div>
                        <div><div class="history-title">${item.skill}</div><div class="history-desc">Выполнение</div></div>
                    </div>
                    <div class="history-time">${item.time}</div>
                </div>
                <div class="history-bottom">
                    <span>Затрачено: <span class="history-val">${item.mins} минут</span></span>
                    <span class="gain-xp">+${item.xp} XP</span>
                </div>
            </div>`;
        });
    } else {
        const groups = aggregateHistory(state.historyFilter);
        const keys = Object.keys(groups); 
        
        if(keys.length === 0) return html + `<div style="text-align:center; color:gray; margin-top:40px;">Нет данных</div>`;

        keys.forEach(key => {
            const g = groups[key];
            html += `
            <div class="agg-card">
                <div class="agg-header">
                    <span class="agg-title">${key}</span>
                    <span class="agg-xp">+${g.xp} XP</span>
                </div>
                <div class="agg-total-time">Всего времени: <span style="color:var(--text-dark)">${formatTimeShort(g.mins)}</span></div>
                <div class="agg-skills-list">`;
            
            for(let sk in g.skills) {
                html += `
                    <div class="agg-skill-row">
                        <span class="agg-skill-name"><i class="fa-solid ${g.skills[sk].icon}"></i> ${sk}</span>
                        <span class="history-val">${formatTimeShort(g.skills[sk].mins)}</span>
                    </div>`;
            }
            html += `</div></div>`;
        });
    }

    return html;
}

function renderProgress() {
    let html = `
    <h1 class="title-h1" style="text-align:center; font-size:16px;">ПРОГРЕСС И АНАЛИТИКА</h1>
    <div class="skills-grid">
        <div class="skill-card global">
            <div class="skill-header"><span class="skill-name">Общий Уровень 🥇</span></div>
            <div class="skill-lvl">Lvl ${state.user.globalLevel}</div>
            <div class="progress-track"><div class="progress-fill" style="width: ${getProgressPct()}%"></div></div>
            <div style="font-size:12px; margin-top:8px; opacity:0.9;">Общее время развития: <strong style="color:#FFF;">${formatTimeShort(state.user.totalMins)}</strong></div>
        </div>`;
    
    const colors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
    let i = 0;
    for(let sk in state.skills) {
        let p = state.skills[sk];
        let c = colors[i % colors.length];
        html += `
        <div class="skill-card">
            <div class="skill-header">
                <span class="skill-name" style="font-size:10px;"><i class="fa-solid ${p.icon}" style="color:${c}"></i> ${sk}</span>
                <span class="skill-lvl text-muted" style="margin:0">Lvl ${p.level}</span>
            </div>
            <div class="progress-track" style="height:4px"><div class="progress-fill" style="width:${p.xpEarned}%; background:${c}"></div></div>
            <div class="text-muted" style="margin-top:8px; font-weight:500;">Время: <span style="color:var(--text-dark)">${formatTimeShort(p.mins)}</span></div>
        </div>`;
        i++;
    }
    html += `</div>`;
    return html;
}

window.onload = () => { render(); };

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/life-rpg/sw.js')
    .then(() => console.log("LifeRPG Nexus Core Active"));
}
