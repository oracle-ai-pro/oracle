    // Состояние приложения
    const CoreState = {
    activeAgent: 'Oracle Main',
    chatMode: 'normal',
    isScreensaverActive: false,
    screensaverTimer: null,
    screensaverTimeoutMins: 5,
    isStreaming: false,
    isFirstMsgInSession: true,
    isTempChat: false,
savedChatHTML: null,
savedWelcomeHTML: null,
isSplitView: false,
splitOrientation: 'horizontal',   // 'horizontal' | 'vertical'
splitRatio: 0.5,
splitSwapped: false,
genTimer: null
};


// ===== CORE STATE & SESSIONS =====
let chatSessions = {};
try {
    chatSessions = JSON.parse(localStorage.getItem('oracle_chat_sessions') || '{}') || {};
} catch(e) { chatSessions = {}; }

let storyBooks = {};
try {
    storyBooks = JSON.parse(localStorage.getItem('oracle_story_books') || '{}') || {};
} catch(e) { storyBooks = {}; }

let currentSessionId = localStorage.getItem('oracle_current_session') || null;
let currentStoryId = localStorage.getItem('oracle_current_story') || null;

function showSection(sectionId) {
    document.querySelectorAll('.setting-section').forEach(el => {
        el.style.display = 'none';
    });
    const target = document.getElementById('section-' + sectionId);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.sidebar-menu .nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById('btn-sec-' + sectionId);
    if (activeBtn) activeBtn.classList.add('active');

    // Mobile: drill into section
    if (window.matchMedia('(max-width: 767px)').matches) {
        const titles = {
            general: 'Персонализация',
            user: 'О вас',
            limits: 'Лимиты',
            system: 'Сонный Режим',
            security: 'Безопасность',
            notifications: 'Уведомления',
            'public-links': 'Публичные ссылки',
            'api-keys': 'Сторонние API',
            about: 'О проекте'
        };
        const screen = document.getElementById('screen-settings');
        const titleEl = document.getElementById('settings-mobile-title');
        if (screen) screen.classList.add('settings-drill');
        if (titleEl) titleEl.textContent = titles[sectionId] || 'Настройки';
    }
}

function settingsMobileBack() {
    const screen = document.getElementById('screen-settings');
    if (screen) screen.classList.remove('settings-drill');
    // optional: keep last section in DOM but hidden behind menu list
}

function renderSidebarChats() {
    const list = document.getElementById('chats-list');
    if (!list) return;
    list.innerHTML = '';
    
    const ids = Object.keys(chatSessions);
    if (ids.length === 0) {
        // default session
        if (!currentSessionId) {
            currentSessionId = 'session_' + Date.now();
            chatSessions[currentSessionId] = { title: 'Новый чат', html: '' };
            localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
            localStorage.setItem('oracle_current_session', currentSessionId);
        }
    }

    Object.keys(chatSessions).forEach(id => {
        const item = document.createElement('div');
        item.className = 'chat-item-node' + (id === currentSessionId ? ' active-session' : '');
        item.dataset.sessionId = id;
        item.dataset.itemType = 'chat';
        item.oncontextmenu = (e) => showContextMenu(e, item, 'chat');
        item.onclick = () => loadChatSession(id);
        item.innerHTML = `
            <span class="chat-title">${chatSessions[id].title || 'Новый чат'}</span>
            <span class="material-symbols-rounded" style="font-size:16px;color:var(--on-surface-variant);">chat</span>
        `;
        list.appendChild(item);
    });
}

function loadChatSession(id) {
    if (!chatSessions[id]) return;
    currentSessionId = id;
    localStorage.setItem('oracle_current_session', id);
    
    const chatFlow = document.getElementById('chat-flow');
    const welcome = document.getElementById('welcome-block');
    if (chatFlow) {
        chatFlow.innerHTML = chatSessions[id].html || '';
        if (welcome) {
            if (chatFlow.children.length > 0) welcome.classList.add('hidden');
            else welcome.classList.remove('hidden');
        }
    }
    renderSidebarChats();
    switchScreen('chat');
}

function createNewChatSession() {
    const id = 'session_' + Date.now();
    chatSessions[id] = { title: 'Новый чат', html: '' };
    currentSessionId = id;
    CoreState.isFirstMsgInSession = true;
    localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
    localStorage.setItem('oracle_current_session', id);
    
    const chatFlow = document.getElementById('chat-flow');
    const welcome = document.getElementById('welcome-block');
    if (chatFlow) chatFlow.innerHTML = '';
    if (welcome) welcome.classList.remove('hidden');
    
    renderSidebarChats();
    document.getElementById('sidebar-archive')?.classList.remove('open');
    switchScreen('chat');
    showToast('Новый чат создан', 'success');
}

function openStoryBook(id) {
    if (!storyBooks[id]) return;
    currentStoryId = id;
    localStorage.setItem('oracle_current_story', id);
    const editor = document.getElementById('editor');
    const empty = document.getElementById('reader-empty-state');
    const workspace = document.getElementById('reader-workspace');
    const titleEl = document.getElementById('current-story-title-display');
    if (editor) editor.innerHTML = storyBooks[id].content || '';
    if (empty) empty.style.display = 'none';
    if (workspace) workspace.style.display = 'block';
    if (titleEl) titleEl.textContent = storyBooks[id].title || 'История';
    switchScreen('reader');
}


function toggleTempChat() {
    if (CoreState.isTempChat) {
        exitTempChat();
    } else {
        enterTempChat();
    }
}

function enterTempChat() {
    // Сохраняем текущее состояние обычного чата
    const chatFlow = document.getElementById('chat-flow');
    const welcomeBlock = document.getElementById('welcome-block');
    
    CoreState.savedChatHTML = chatFlow ? chatFlow.innerHTML : '';
    CoreState.savedWelcomeHTML = welcomeBlock ? welcomeBlock.innerHTML : '';

    // Очищаем чат для временного режима
    if (chatFlow) chatFlow.innerHTML = '';
    if (welcomeBlock) {
        welcomeBlock.classList.remove('hidden');
        const greeting = document.getElementById('welcome-greeting');
        const subtext = document.getElementById('welcome-subtext');
        if (greeting) greeting.textContent = 'Зашли случайно?';
        if (subtext) subtext.textContent = 'Это временный чат. Всё, что вы напишете здесь, исчезнет после выхода. Ничего не сохранится в истории.';
    }

    CoreState.isTempChat = true;
    document.body.classList.add('temp-chat-mode');
    
    const btn = document.getElementById('temp-chat-btn');
    if (btn) btn.classList.add('active');

    showToast('Временный чат активирован. История не сохраняется.', 'warning');
}

function exitTempChat() {
    const chatFlow = document.getElementById('chat-flow');
    const welcomeBlock = document.getElementById('welcome-block');

    // Возвращаем обычный чат
    if (chatFlow) chatFlow.innerHTML = CoreState.savedChatHTML || '';
    if (welcomeBlock) {
        welcomeBlock.innerHTML = CoreState.savedWelcomeHTML || '';
        // Если в обычном чате уже были сообщения — прячем приветствие
        if (CoreState.savedChatHTML && CoreState.savedChatHTML.trim() !== '') {
            welcomeBlock.classList.add('hidden');
            updateWelcomeAmbient();
        } else {
            welcomeBlock.classList.remove('hidden');
        }
    }

    CoreState.isTempChat = false;
    CoreState.savedChatHTML = null;
    CoreState.savedWelcomeHTML = null;
    document.body.classList.remove('temp-chat-mode');

    const btn = document.getElementById('temp-chat-btn');
    if (btn) btn.classList.remove('active');

    showToast('Обычный чат восстановлен.', 'success');
}
    let modalCallback = null;
    let modalMode = 'alert';

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
        }[ch]));
    }
// ===================== SPLIT VIEW =====================

function enterSplitView() {
    if (CoreState.isSplitView) return;

    CoreState.isSplitView = true;
    document.body.classList.add('split-mode', CoreState.splitOrientation);

    // Переносим экраны в панели
    const leftPane = document.getElementById('split-pane-left');
    const rightPane = document.getElementById('split-pane-right');
    const chatScreen = document.getElementById('screen-chat');
    const readerScreen = document.getElementById('screen-reader');

    if (!CoreState.splitSwapped) {
        leftPane.appendChild(chatScreen);
        rightPane.appendChild(readerScreen);
    } else {
        leftPane.appendChild(readerScreen);
        rightPane.appendChild(chatScreen);
    }

    // Показываем оба
    chatScreen.classList.add('active-screen');
    readerScreen.classList.add('active-screen');

    updateSplitHeader();
    applySplitRatio();
    initSplitResizer();

    // Скрываем обычный input если нужно (он останется внизу)
    showToast('Split View активирован', 'success');
}

function exitSplitView() {
    if (!CoreState.isSplitView) return;

    CoreState.isSplitView = false;
    document.body.classList.remove('split-mode', 'horizontal', 'vertical');

    // Возвращаем экраны обратно в контейнер
    const container = document.querySelector('.oracle-container');
    const chatScreen = document.getElementById('screen-chat');
    const readerScreen = document.getElementById('screen-reader');

    // Ставим обратно в нужном порядке
    container.insertBefore(chatScreen, document.getElementById('main-input-box'));
    container.insertBefore(readerScreen, document.getElementById('main-input-box'));

    // Оставляем активным только Chat
    readerScreen.classList.remove('active-screen');
    chatScreen.classList.add('active-screen');
    document.getElementById('btn-tab-chat')?.classList.add('active');
    document.getElementById('btn-tab-reader')?.classList.remove('active');

    // Закрываем меню
    document.getElementById('split-menu')?.classList.remove('open');

    showToast('Вышли из Split View', 'success');
}

function updateSplitHeader() {
    const chatNameEl = document.getElementById('split-chat-name');
    const storyNameEl = document.getElementById('split-story-name');

    // Название текущего чата
    const activeChat = document.querySelector('.chat-item-node.active-session .chat-title');
    if (chatNameEl) {
        chatNameEl.textContent = activeChat ? activeChat.textContent : 'Новый чат';
    }

    // Название текущей истории
    if (storyNameEl) {
        if (currentStoryId && storyBooks[currentStoryId]) {
            storyNameEl.textContent = storyBooks[currentStoryId].title || 'История';
        } else {
            storyNameEl.textContent = 'Нет истории';
        }
    }

    // Текст кнопки ориентации
    const orientLabel = document.getElementById('split-orient-label');
    if (orientLabel) {
        orientLabel.textContent = CoreState.splitOrientation === 'horizontal' 
            ? 'Вертикальный Split' 
            : 'Горизонтальный Split';
    }
}

function toggleSplitOrientation() {
    const isHorizontal = CoreState.splitOrientation === 'horizontal';
    CoreState.splitOrientation = isHorizontal ? 'vertical' : 'horizontal';

    document.body.classList.remove('horizontal', 'vertical');
    document.body.classList.add(CoreState.splitOrientation);

    applySplitRatio();
    updateSplitHeader();
    document.getElementById('split-menu')?.classList.remove('open');
}

function swapSplitSides() {
    CoreState.splitSwapped = !CoreState.splitSwapped;

    const leftPane = document.getElementById('split-pane-left');
    const rightPane = document.getElementById('split-pane-right');
    const chatScreen = document.getElementById('screen-chat');
    const readerScreen = document.getElementById('screen-reader');

    // Очищаем и переставляем
    leftPane.innerHTML = '';
    rightPane.innerHTML = '';

    if (!CoreState.splitSwapped) {
        leftPane.appendChild(chatScreen);
        rightPane.appendChild(readerScreen);
    } else {
        leftPane.appendChild(readerScreen);
        rightPane.appendChild(chatScreen);
    }

    document.getElementById('split-menu')?.classList.remove('open');
    showToast('Стороны поменяны', 'success');
}

function closeSplitSide(side) {
    // Пока просто выходим из split (можно доработать позже)
    exitSplitView();
    if (side === 'left') {
        // Можно оставить только правую, но пока выходим полностью
    }
    document.getElementById('split-menu')?.classList.remove('open');
}

function toggleSplitMenu(e) {
    e?.stopPropagation();
    const menu = document.getElementById('split-menu');
    if (menu) menu.classList.toggle('open');
}

function applySplitRatio() {
    const left = document.getElementById('split-pane-left');
    const right = document.getElementById('split-pane-right');
    if (!left || !right) return;

    const ratio = CoreState.splitRatio;

    if (CoreState.splitOrientation === 'horizontal') {
        left.style.width = `${ratio * 100}%`;
        left.style.height = '100%';
        right.style.width = `${(1 - ratio) * 100}%`;
        right.style.height = '100%';
    } else {
        left.style.height = `${ratio * 100}%`;
        left.style.width = '100%';
        right.style.height = `${(1 - ratio) * 100}%`;
        right.style.width = '100%';
    }
}

function initSplitResizer() {
    const resizer = document.getElementById('split-resizer');
    if (!resizer) return;

    let isDragging = false;

    const onStart = (e) => {
        isDragging = true;
        resizer.classList.add('dragging');
        document.body.style.userSelect = 'none';
        e.preventDefault();
    };

    const onMove = (e) => {
        if (!isDragging) return;

        const panes = document.getElementById('split-panes');
        const rect = panes.getBoundingClientRect();
        let ratio;

        if (CoreState.splitOrientation === 'horizontal') {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            ratio = (clientX - rect.left) / rect.width;
        } else {
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            ratio = (clientY - rect.top) / rect.height;
        }

        // Ограничения
        ratio = Math.max(0.2, Math.min(0.8, ratio));
        CoreState.splitRatio = ratio;
        applySplitRatio();
        if (typeof syncSplitInputWidths === 'function') syncSplitInputWidths();
    };

    const onEnd = () => {
        isDragging = false;
        resizer.classList.remove('dragging');
        document.body.style.userSelect = '';
    };

    resizer.addEventListener('mousedown', onStart);
    resizer.addEventListener('touchstart', onStart, { passive: false });

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
}

// Закрытие меню при клике вне
document.addEventListener('click', (e) => {
    const menu = document.getElementById('split-menu');
    const btn = document.getElementById('split-menu-btn');
    if (menu && menu.classList.contains('open') && !menu.contains(e.target) && !btn?.contains(e.target)) {
        menu.classList.remove('open');
    }
});

    function showToast(message, type = 'info', duration = 2800) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `core-toast ${type}`;
        const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info';
        toast.innerHTML = `<span class="material-symbols-rounded">${icon}</span><span></span>`;
        toast.querySelector('span:last-child').textContent = message;
        container.appendChild(toast);
        window.setTimeout(() => {
            toast.classList.add('out');
            window.setTimeout(() => toast.remove(), 220);
        }, duration);
    }

    function showCustomModal(title, text, isPrompt = false, defaultValue = '', callback = null) {
        const modal = document.getElementById('custom-modal');
        const titleEl = document.getElementById('custom-modal-title');
        const textEl = document.getElementById('custom-modal-text');
        const inputBox = document.getElementById('custom-modal-input-container');
        const inputEl = document.getElementById('custom-modal-input');
        const cancelBtn = document.getElementById('custom-modal-cancel');
        const okBtn = document.getElementById('custom-modal-ok');
        if (!modal || !titleEl || !textEl || !inputBox || !inputEl || !cancelBtn || !okBtn) return;

        modalCallback = typeof callback === 'function' ? callback : null;
        modalMode = isPrompt ? 'prompt' : (callback ? 'confirm' : 'alert');

        titleEl.textContent = title || 'Уведомление';
        textEl.innerHTML = text || '';
        inputBox.style.display = isPrompt ? 'block' : 'none';
        inputEl.value = isPrompt ? String(defaultValue ?? '') : '';
        cancelBtn.style.display = (isPrompt || callback) ? 'inline-flex' : 'none';
        okBtn.textContent = isPrompt ? 'Готово' : (callback ? 'Подтвердить' : 'OK');

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        window.setTimeout(() => {
            if (isPrompt) inputEl.focus();
            else okBtn.focus();
        }, 0);
    }

    function closeCustomModal(result) {
        const modal = document.getElementById('custom-modal');
        const inputEl = document.getElementById('custom-modal-input');
        const inputBox = document.getElementById('custom-modal-input-container');
        if (!modal) return;

        const callback = modalCallback;
        const value = inputEl ? inputEl.value : '';
        const wasPrompt = inputBox && inputBox.style.display !== 'none';

        modal.classList.remove('active');
        document.body.style.overflow = '';
        modalCallback = null;

        if (callback) {
            callback(result ? (wasPrompt ? value : true) : false);
        }
    }

    function handleModalBackdrop(event) {
        if (event.target && event.target.id === 'custom-modal') {
            if (modalMode === 'alert') closeCustomModal(true);
            else closeCustomModal(false);
        }
    }

    function toggleTimeoutMenu(event) {
        if (event) event.stopPropagation();
        const picker = document.getElementById('screensaver-timeout-picker');
        if (picker) picker.classList.toggle('open');
        document.getElementById('screensaver-style-picker')?.classList.remove('open');
    }

    function selectScreensaverTimeout(value) {
        const safeValue = [5, 10, 15, 20].includes(Number(value)) ? Number(value) : 5;
        updateScreensaverTimeout(safeValue);
        const picker = document.getElementById('screensaver-timeout-picker');
        if (picker) {
            picker.classList.remove('open');
            picker.querySelectorAll('.custom-select-option').forEach(option => {
                option.classList.toggle('active', Number(option.dataset.value) === safeValue);
            });
        }
    }

    function updateTimeoutPickerUI(value) {
        const safeValue = [5, 10, 15, 20].includes(Number(value)) ? Number(value) : 5;
        const label = document.getElementById('screensaver-timeout-label');
        if (label) label.textContent = `${safeValue} минут`;
        const picker = document.getElementById('screensaver-timeout-picker');
        if (picker) picker.querySelectorAll('.custom-select-option').forEach(option => {
            option.classList.toggle('active', Number(option.dataset.value) === safeValue);
        });
    }

    document.addEventListener('keydown', event => {
        const modal = document.getElementById('custom-modal');
        if (modal && modal.classList.contains('active')) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeCustomModal(false);
            } else if (event.key === 'Enter' && document.activeElement?.id === 'custom-modal-input') {
                event.preventDefault();
                closeCustomModal(true);
            }
        }
    });

    function toggleGroup(groupId) {
        const content = document.getElementById(`${groupId}-list`);
        const arrow = document.getElementById(`arrow-${groupId}`);
        if (!content) return;
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        if (arrow) {
            arrow.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
        }
    }

    function switchChatMode(mode) {
        CoreState.chatMode = mode;

        const btnNormal = document.getElementById('btn-mode-normal');
        const btnOracle = document.getElementById('btn-mode-oracle');
        const btnProject = document.getElementById('btn-mode-project');
        const btnCoding = document.getElementById('btn-mode-coding');

        if (!btnNormal || !btnOracle) return;

        btnNormal.classList.remove('active');
        btnOracle.classList.remove('active');

        if (mode === 'oracle') {
            btnOracle.classList.add('active');
            if (btnProject) btnProject.classList.remove('hidden');
            if (btnCoding) btnCoding.classList.remove('hidden');
        } else {
            btnNormal.classList.add('active');
            if (btnProject) btnProject.classList.add('hidden');
            if (btnCoding) btnCoding.classList.add('hidden');
        }
    }

    function setChatMode(mode) {
        switchChatMode(mode);

        const chatFlow = document.getElementById('chat-flow');
        const welcomeBlock = document.getElementById('welcome-block');

        if (mode === 'oracle') {
            CoreState.activeAgent = 'Oracle Notepad (AI Chat Mode)';
            if (welcomeBlock) welcomeBlock.classList.add('hidden');
            if (chatFlow) {
                chatFlow.innerHTML += `
                    <div class="msg ai-msg" style="border-left: 3px solid var(--primary); font-style: italic; opacity:0.9;">
                        <span class="material-symbols-rounded" style="font-size:16px; vertical-align:middle; margin-right:5px;">auto_awesome</span>
                        Система: AI Chat Mode активирован. Панели Проекта и Кодинга добавлены в панель.
                    </div>
                `;
            }
        } else {
            CoreState.activeAgent = 'Oracle Main';
            if (chatFlow) {
                chatFlow.innerHTML += `
                    <div class="msg ai-msg" style="font-style: italic; opacity:0.7;">
                        Система: Возврат в режим Normal Chat. Дополнительные панели скрыты.
                    </div>
                `;
            }
        }

        const screenChat = document.getElementById('screen-chat');
        if (screenChat) {
            screenChat.scrollTop = screenChat.scrollHeight;
        }
    }

    function openProjectPanel() {
        showCustomModal(
            'Информация о Проекте',
            '<div style="text-align: left; padding: 12px; background: var(--surface-variant); border-radius: 12px; line-height: 1.6; font-size: 13px;">' +
                '<div><strong>Текущий проект:</strong> Project Alpha</div>' +
                '<div><strong>Локация:</strong> Мир 1 / Комната 1</div>' +
                '<div><strong>Статус:</strong> Синхронизировано</div>' +
            '</div>'
        );
    }

    function openCodingPanel() {
        showCustomModal(
            'Кодинг Панель',
            '<div style="text-align: left; padding: 12px; background: #000; border-radius: 12px; font-family: monospace; color: #32d74b; font-size: 12px; line-height: 1.5;">' +
                '<div>> code_editor --init</div>' +
                '<div>> Загрузка модулей... [OK]</div>' +
                '<div>> Редактор кода готов к работе.</div>' +
            '</div>'
        );
    }

    // --- КАЛЕНДАРЬ ИИ ---
    let currentCalDate = new Date();
    let reminders = loadReminders();

    function loadReminders() {
        try {
            const raw = JSON.parse(localStorage.getItem('oracle_reminders') || '[]');
            return Array.isArray(raw) ? raw.filter(item => item && item.date && item.text) : [];
        } catch (e) {
            localStorage.removeItem('oracle_reminders');
            return [];
        }
    }

    function saveReminders() {
        localStorage.setItem('oracle_reminders', JSON.stringify(reminders));
    }

    function dateKey(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function renderCalendar() {
    const grid = document.getElementById('calendar-days-grid');
    const title = document.getElementById('calendar-month-title');
    if (!grid || !title) return;

    const monthNames = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    
    title.textContent = `${monthNames[month]} ${year}`;

    // Первый день месяца (0 = Вс, 1 = Пн ...)
    const firstDay = new Date(year, month, 1).getDay();
    // Делаем понедельник первым (Пн = 0)
    const offset = (firstDay + 6) % 7;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    grid.innerHTML = '';

    // Пустые ячейки в начале
    for (let i = 0; i < offset; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        cellDate.setHours(0, 0, 0, 0);
        
        const key = dateKey(year, month, day);
        const dayReminders = reminders.filter(r => r.date === key);
        const isToday = cellDate.getTime() === today.getTime();
        const isPast = cellDate < today;

        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = `chat-card calendar-day${isToday ? ' calendar-day-today' : ''}${dayReminders.length ? ' has-reminder' : ''}${isPast ? ' past-day' : ''}`;
        
        cell.innerHTML = `
            <span class="calendar-day-number">${day}</span>
            ${dayReminders.length ? '<span class="calendar-day-dot"></span>' : ''}
        `;

        if (isPast) {
            cell.title = 'Нельзя создать напоминание на прошедший день';
            cell.disabled = true;
        } else {
            cell.title = dayReminders.length ? `${dayReminders.length} напомин.` : 'Добавить план / напоминание';
            cell.addEventListener('click', () => addCalendarReminder(key));
        }

        grid.appendChild(cell);
    }

    renderReminders();
}
function changeOracleThemeBW() {
    const isLight = document.body.classList.contains('light-theme');
    
    // В светлой теме — чёрный, в тёмной — белый
    const primary = isLight ? '#1a1a1a' : '#f0f0f0';
    const container = isLight ? '#e8e8e8' : '#2a2a2a';
    const variant = isLight ? '#f5f5f5' : '#1a1a1a';

    const theme = { primary, container, variant, isBW: true };
    localStorage.setItem('oracle_matte_theme', JSON.stringify(theme));
    
    applyVisualTheme();
    showToast(isLight ? 'Ч/Б: чёрный' : 'Ч/Б: белый', 'success');
}
    function changeMonth(dir) {
        const next = new Date(currentCalDate.getFullYear(), currentCalDate.getMonth() + Number(dir), 1);
        if (!Number.isNaN(next.getTime())) {
            currentCalDate = next;
            renderCalendar();
        }
    }

    function addCalendarReminder(key) {
        openPlanModal({ dateKey: key, mode: 'create' });
    }

    function renderReminders() {
        const list = document.getElementById('reminders-list');
        if (!list) return;
        list.innerHTML = '';
        if (!reminders.length) {
            list.innerHTML = '<div style="color:var(--on-surface-variant);font-size:13px;padding:12px;">Нет активных планов</div>';
            return;
        }
        // Sort by date + time
        const sorted = [...reminders].sort((a, b) => {
            const da = (a.date || '') + (a.time || '');
            const db = (b.date || '') + (b.time || '');
            return da.localeCompare(db);
        });
        sorted.forEach(r => {
            const card = document.createElement('div');
            card.className = 'chat-card calendar-reminder';
            card.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:600;font-size:13px;">${r.text}</div>
                    <small>${r.date}${r.time ? ' · ' + r.time : ''}</small>
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="icon-btn" title="Изменить" onclick="editReminder('${r.id}')">
                        <span class="material-symbols-rounded" style="font-size:18px;">edit</span>
                    </button>
                    <button class="icon-btn" title="Удалить" onclick="deleteReminder('${r.id}')">
                        <span class="material-symbols-rounded" style="font-size:18px;color:#ff5252;">delete</span>
                    </button>
                </div>
            `;
            list.appendChild(card);
        });
    }

    function editReminder(id) {
        const r = reminders.find(x => x.id === id);
        if (!r) return;
        openPlanModal({ mode: 'edit', reminder: r });
    }

    function deleteReminder(id) {
        reminders = reminders.filter(x => x.id !== id);
        saveReminders();
        renderCalendar();
        showToast('Удалено', 'success');
    }

    let currentContextNode = null;

    function switchScreen(screenName) {
        if (typeof settingsMobileResetOnLeave === "function") settingsMobileResetOnLeave(screenName);
        // sync custom nav active state
        setTimeout(() => {
            document.querySelectorAll('.glass-nav .nav-item').forEach(b => b.classList.remove('active'));
            const map = { chat:'chat', reader:'reader', settings:'settings', calendar:'calendar' };
            const id = map[screenName] || screenName;
            document.getElementById('btn-tab-' + id)?.classList.add('active');
        }, 0);
        document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active-screen'));
        document.querySelectorAll('.glass-nav .nav-item').forEach(t => t.classList.remove('active'));
        
        const targetScreen = document.getElementById(`screen-${screenName}`);
        const targetBtn = document.getElementById(`btn-tab-${screenName}`);
        const subNav = document.getElementById('sub-nav-chat');
        
        if (targetScreen) targetScreen.classList.add('active-screen');
        if (targetBtn) targetBtn.classList.add('active');
        
        if (subNav) {
            subNav.style.display = (screenName === 'chat') ? 'flex' : 'none';
        }

        const sidebar = document.getElementById('sidebar-archive');
        if (sidebar) sidebar.classList.remove('open');
        if (screenName === 'calendar') renderCalendar();
    }

    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar-archive');
        if (sidebar) sidebar.classList.toggle('open');
    }

    function toggleCompactNav() {
        document.body.classList.toggle('compact-nav-mode');
        const isCompact = document.body.classList.contains('compact-nav-mode');
        localStorage.setItem('oracle_compact_nav', isCompact);
        
        const btn = document.getElementById('compact-nav-toggle-btn');
        if (btn) {
            if (isCompact) {
                btn.innerText = "ВЫКЛЮЧИТЬ";
                btn.style.background = "var(--primary-container)";
                btn.style.color = "var(--primary)";
            } else {
                btn.innerText = "ВКЛЮЧИТЬ";
                btn.style.background = "var(--surface-variant)";
                btn.style.color = "var(--on-surface)";
            }
        }
    }

        function showContextMenu(e, element, type) {
        e.preventDefault();
        e.stopPropagation();
        currentContextNode = element;
        if (element) {
            window._ctxItemType = type || element.dataset.itemType || (element.dataset.storyId ? 'story' : 'chat');
            window._ctxSessionId = element.dataset.sessionId || null;
            window._ctxStoryId = element.dataset.storyId || null;
        }
        const menu = document.getElementById('context-menu');
        if (!menu) return;
        const branch = document.getElementById('cm-branch-opt');
        const share = document.getElementById('cm-share-opt');
        const snOpt = document.getElementById('cm-sidenotes-opt');
        const isStory = window._ctxItemType === 'story';
        if (branch) branch.style.display = isStory ? 'none' : '';
        if (snOpt) snOpt.style.display = (type === 'chat') ? 'flex' : 'none';
        if (share) share.style.display = isStory ? 'none' : '';
        menu.style.display = 'block';
        let x = e.pageX;
        let y = e.pageY;
        if (x + 160 > window.innerWidth) x = window.innerWidth - 170;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    }

    function cmRename() {
        if (!currentContextNode) return;
        const titleEl = currentContextNode.querySelector('.chat-title') || currentContextNode.querySelector('span');
        const isStory = window._ctxItemType === 'story' || currentContextNode.dataset.itemType === 'story';
        const promptTitle = isStory ? 'Переименовать историю' : 'Переименовать чат';
        showCustomModal(promptTitle, 'Новое название:', true, titleEl ? titleEl.innerText : '', (newName) => {
            if (!newName || typeof newName !== 'string' || !newName.trim()) return;
            const name = newName.trim();
            if (titleEl) titleEl.innerText = name;
            if (isStory) {
                const sid = currentContextNode.dataset.storyId || window._ctxStoryId;
                if (sid && storyBooks[sid]) {
                    storyBooks[sid].title = name;
                    localStorage.setItem('oracle_story_books', JSON.stringify(storyBooks));
                    const disp = document.getElementById('current-story-title-display');
                    if (disp && sid === currentStoryId) disp.textContent = name;
                    renderSidebarStories();
                    if (typeof fillSplitStoryMenu === 'function') fillSplitStoryMenu();
                }
            } else {
                const cid = currentContextNode.dataset.sessionId || window._ctxSessionId;
                // fallback by title match then update
                let id = cid;
                if (!id || !chatSessions[id]) {
                    const old = titleEl ? titleEl.innerText : '';
                    id = Object.keys(chatSessions).find(k => chatSessions[k].title === old) || currentSessionId;
                }
                // we already set titleEl — use name
                if (id && chatSessions[id]) {
                    chatSessions[id].title = name;
                    localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
                    renderSidebarChats();
                }
            }
            showToast('Переименовано', 'success');
        });
    }

    function cmBranch() {
        if (!currentContextNode) return;
        const titleEl = currentContextNode.querySelector('.chat-title');
        const currentTitle = titleEl ? titleEl.innerText : 'Чат';
        
        const newBranchId = 'session_branch_' + Date.now();
        chatSessions[newBranchId] = { 
            title: `${currentTitle} (Ветвь)`, 
            html: document.getElementById('chat-flow')?.innerHTML || '' 
        };
        
        localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
        renderSidebarChats();
        showCustomModal("Ветвление", `Создана новая ветка: "${currentTitle} (Ветвь)"`);
    }

    function cmDelete() {
        if (!currentContextNode) return;
        const titleEl = currentContextNode.querySelector('.chat-title') || currentContextNode.querySelector('span');
        const name = titleEl ? titleEl.innerText : 'элемент';
        const isStory = window._ctxItemType === 'story' || currentContextNode.dataset.itemType === 'story';
        showCustomModal('Удаление', isStory
            ? `Удалить «${name}» навсегда?`
            : `Удалить «${name}» навсегда? Публичные ссылки на этот чат тоже будут удалены.`, false, '', (confirmDelete) => {
            if (!confirmDelete || !currentContextNode) return;
            if (isStory) {
                const sid = currentContextNode.dataset.storyId || window._ctxStoryId;
                if (sid && storyBooks[sid]) {
                    delete storyBooks[sid];
                    localStorage.setItem('oracle_story_books', JSON.stringify(storyBooks));
                    if (currentStoryId === sid) {
                        currentStoryId = null;
                        localStorage.removeItem('oracle_current_story');
                        const editor = document.getElementById('editor');
                        if (editor) editor.innerHTML = '';
                        const empty = document.getElementById('reader-empty-state');
                        const workspace = document.getElementById('reader-workspace');
                        if (empty) empty.style.display = '';
                        if (workspace) workspace.style.display = 'none';
                    }
                    renderSidebarStories();
                    if (typeof fillSplitStoryMenu === 'function') fillSplitStoryMenu();
                }
            } else {
                let sessionId = currentContextNode.dataset.sessionId || window._ctxSessionId;
                if (!sessionId) {
                    sessionId = Object.keys(chatSessions).find(k => chatSessions[k].title === name);
                }
                if (sessionId && chatSessions[sessionId]) {
                    delete chatSessions[sessionId];
                    try { cleanupSharesForSession(sessionId); } catch(e) {}
                    localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
                    if (currentSessionId === sessionId) {
                        currentSessionId = Object.keys(chatSessions)[0] || null;
                        if (currentSessionId) loadChatSession(currentSessionId);
                    }
                    renderSidebarChats();
                }
            }
            currentContextNode = null;
            document.getElementById('context-menu').style.display = 'none';
            showToast('Удалено', 'success');
        });
    }

       function handleInput(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';

    const expandBtn = document.getElementById('expand-btn');
    const sendBtn = document.getElementById('send-btn');
    const voiceBtn = document.getElementById('voice-btn');
    const liveBtn = document.getElementById('live-chat-btn');

    const hasText = textarea.value.trim().length > 0;

    // Кнопка расширения — всегда видна
    expandBtn?.classList.remove('hidden');

    if (hasText) {
        sendBtn?.classList.add('visible');
        liveBtn?.classList.add('hidden');
        voiceBtn?.classList.add('hidden');
    } else {
        sendBtn?.classList.remove('visible');
        liveBtn?.classList.remove('hidden');
        voiceBtn?.classList.remove('hidden');
    }
}
function toggleFsFontMenu(event) {
    event?.stopPropagation();
    const picker = document.getElementById('fs-font-size-picker');
    if (picker) picker.classList.toggle('open');
}

function selectFsFontSize(size) {
    const label = document.getElementById('fs-font-size-label');
    if (label) label.textContent = size;

    // Подсветка активного
    document.querySelectorAll('#fs-font-size-picker .custom-select-option').forEach(opt => {
        opt.classList.toggle('active', Number(opt.dataset.value) === size);
    });

    // Применяем размер
    fsChangeFontSize(size);

    // Закрываем меню
    document.getElementById('fs-font-size-picker')?.classList.remove('open');
}

// Закрытие при клике вне
document.addEventListener('click', (e) => {
    const picker = document.getElementById('fs-font-size-picker');
    if (picker && !picker.contains(e.target)) {
        picker.classList.remove('open');
    }
});

    function toggleFullscreen() {
        const box = document.getElementById('main-input-box');
        const icon = document.getElementById('expand-icon');
        const textarea = document.getElementById('user-input');
        if (!box || !textarea) return;
        
        box.classList.toggle('fullscreen-mode');
        if (box.classList.contains('fullscreen-mode')) {
            if (icon) icon.innerText = 'close_fullscreen';
            textarea.style.height = '70%'; 
            box.style.height = '80vh';
        } else {
            if (icon) icon.innerText = 'open_in_full';
            box.style.height = 'auto';
            handleInput(textarea);
        }
    }

    function createUserBubbleElement(text) {
        const bubble = document.createElement('div');
        bubble.className = 'msg user-msg user-bubble';

        const textNode = document.createElement('span');
        textNode.className = 'bubble-text';
        textNode.textContent = text;
        bubble.appendChild(textNode);

        const actions = document.createElement('div');
        actions.className = 'bubble-actions';

        actions.innerHTML = `
            <button class="icon-btn" onclick="copyBubbleText(this)" title="Копировать">
                <span class="material-symbols-rounded">content_copy</span>
            </button>
            <button class="icon-btn" onclick="editBubbleText(this)" title="Изменить">
                <span class="material-symbols-rounded">edit</span>
            </button>
        `;

        bubble.appendChild(actions);
        return bubble;
    }

    function copyBubbleText(btn) {
        const bubble = btn.closest('.user-bubble');
        const text = bubble.querySelector('.bubble-text').textContent;
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => showToast('Сообщение скопировано.', 'success')).catch(() => showToast('Не удалось скопировать.', 'error')); else showToast('Буфер обмена недоступен.', 'warning');
    }

    function editBubbleText(btn) {
        const bubble = btn.closest('.user-bubble');
        const textNode = bubble.querySelector('.bubble-text');
        
        showCustomModal("Редактирование", "Измените текст сообщения:", true, textNode.textContent, (newText) => {
            if (newText && typeof newText === 'string' && newText.trim() !== "") {
                textNode.textContent = newText.trim();
                const chatFlow = document.getElementById('chat-flow');
                if (chatFlow) localStorage.setItem('oracle_chat_history', chatFlow.innerHTML);
            }
        });
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'ru-RU';
        recognition.interimResults = true; 
        recognition.onresult = function(event) {
            let transcript = Array.from(event.results).map(result => result[0].transcript).join('');
            const input = document.getElementById('user-input');
            if (input) {
                input.value = transcript; 
                handleInput(input); 
            }
        };
        recognition.onstart = function() { 
            const btn = document.getElementById('voice-btn');
            if (btn) btn.classList.add('recording'); 
        };
        recognition.onend = function() { 
            const btn = document.getElementById('voice-btn');
            if (btn) btn.classList.remove('recording'); 
        };
    }
    
    function startVoice() {
        if (recognition) { 
            try { recognition.start(); } catch(e) { recognition.stop(); } 
        } else { 
            showCustomModal("Ошибка", "Голосовой ввод не поддерживается вашим браузером."); 
        }
    }

    function trackMessageUsage() {
        try {
            let now = Date.now();
            let timestamps = JSON.parse(localStorage.getItem('oracle_message_timestamps') || '[]');
            timestamps.push(now);
            const weekAgo = now - (168 * 60 * 60 * 1000);
            timestamps = timestamps.filter(t => t > weekAgo);
            localStorage.setItem('oracle_message_timestamps', JSON.stringify(timestamps));
            // simple counters for limits UI
            const used24 = Number(localStorage.getItem('oracle_limit_24h') || 0) + 1;
            const used168 = Number(localStorage.getItem('oracle_limit_168h') || 0) + 1;
            localStorage.setItem('oracle_limit_24h', String(used24));
            localStorage.setItem('oracle_limit_168h', String(used168));
            if (typeof updateLimitsUI === 'function') updateLimitsUI();
        } catch (e) {
            console.warn('trackMessageUsage', e);
        }
    }

    function updateLimitsUI() {
    // Простая имитация использования (можно заменить на реальные данные)
    const used24 = Number(localStorage.getItem('oracle_limit_24h') || 0);
    const used168 = Number(localStorage.getItem('oracle_limit_168h') || 0);
    const max24 = 100;
    const max168 = 700;

    const pct24 = Math.min(100, Math.round((used24 / max24) * 100));
    const pct168 = Math.min(100, Math.round((used168 / max168) * 100));

    const count24 = document.getElementById('limit-24h-count');
    const bar24 = document.getElementById('limit-24h-bar');
    const count168 = document.getElementById('limit-168h-count');
    const bar168 = document.getElementById('limit-168h-bar');

    if (count24) count24.textContent = pct24 + ' %';
    if (bar24) bar24.style.width = pct24 + '%';
    if (count168) count168.textContent = pct168 + ' %';
    if (bar168) bar168.style.width = pct168 + '%';

    // Следующий сброс текущего лимита (каждые 3 часа: :00 :15 :30 :45 → упростим до ближайшего :00/:15/:30/:45)
    const now = new Date();
    const minutes = now.getMinutes();
    const slots = [0, 15, 30, 45, 60];
    let nextMin = slots.find(s => s > minutes) ?? 60;
    let nextHour = now.getHours();
    if (nextMin === 60) {
        nextMin = 0;
        nextHour = (nextHour + 1) % 24;
    }
    const reset24El = document.getElementById('reset-24h-timer');
    if (reset24El) {
        reset24El.textContent = String(nextHour).padStart(2, '0') + ':' + String(nextMin).padStart(2, '0');
    }

    // Недельный сброс — всегда в 00:30 ближайшего понедельника (пасхалка)
    const day = now.getDay(); // 0 = Вс
    const daysUntilMonday = (8 - day) % 7 || 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 30, 0, 0);
    const reset168El = document.getElementById('reset-168h-timer');
    if (reset168El) {
        const d = String(nextMonday.getDate()).padStart(2, '0');
        const m = String(nextMonday.getMonth() + 1).padStart(2, '0');
        const y = nextMonday.getFullYear();
        reset168El.textContent = `${d}/${m}/${y}`;
    }

    // "Обновлено ..."
    const updatedEl = document.getElementById('limits-updated-ago');
    if (updatedEl) {
        updatedEl.textContent = 'только что';
    }
}

        
function getSavedMatteTheme() {
    try {
        const raw = JSON.parse(localStorage.getItem('oracle_matte_theme') || '{}');
        if (raw && raw.primary) return raw;
    } catch (e) {}
    return {
        primary: '#adc6ff',
        container: '#254487',
        variant: '#1f202e',
        isBW: false
    };
}

function applyVisualTheme() {
    const target = document.body;
    const isLight = target.classList.contains('light-theme');
    const isTrueBlack = target.classList.contains('true-black-theme');
    
    let theme = getSavedMatteTheme();

    // Адаптивный Ч/Б
    if (theme.isBW) {
        if (isLight) {
            theme = {
                primary: '#1a1a1a',
                container: '#e8e8e8',
                variant: '#f0f0f0',
                isBW: true
            };
        } else {
            theme = {
                primary: '#f0f0f0',
                container: '#2a2a2a',
                variant: '#1a1a1a',
                isBW: true
            };
        }
    }

    // СВЕТЛАЯ ТЕМА (акценты как в 2.6)
    if (isLight) {
        target.classList.remove('true-black-theme');
        target.style.setProperty('--bg', '#f4f5fa');
        target.style.setProperty('--surface', '#ffffff');
        target.style.setProperty('--surface-variant', theme.isBW ? (theme.variant || '#f0f0f0') : '#f3f4f6');
        target.style.setProperty('--on-surface', '#1a1b26');
        target.style.setProperty('--on-surface-variant', '#575a6c');
        target.style.setProperty('--primary', theme.primary);
        target.style.setProperty('--primary-container', theme.isBW ? (theme.container || '#e8e8e8') : (theme.primary + '26'));
        target.style.setProperty('--secondary', theme.primary);
        target.style.setProperty('--border', '#d0d3de');
        target.style.setProperty('--grad', theme.isBW
            ? `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primary} 100%)`
            : `linear-gradient(90deg, ${theme.primary} 0%, #a855f7 100%)`);
        target.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.82)');
        // bubble follows accent unless custom saved
        if (!localStorage.getItem('oracle_bubble_color')) {
        }
        return;
    }

    // TRUE BLACK
    if (isTrueBlack) {
        target.style.setProperty('--bg', '#000000');
        target.style.setProperty('--surface', '#0a0a0a');
        target.style.setProperty('--surface-variant', '#141414');
        target.style.setProperty('--on-surface', '#ffffff');
        target.style.setProperty('--on-surface-variant', '#a0a0a0');
        target.style.setProperty('--primary', theme.primary);
        target.style.setProperty('--primary-container', '#1c1c1c');
        target.style.setProperty('--secondary', theme.primary);
        target.style.setProperty('--border', '#222222');
        target.style.setProperty('--grad', `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primary} 100%)`);
        target.style.setProperty('--glass-bg', 'rgba(10, 10, 10, 0.85)');
        return;
    }

    // ОБЫЧНАЯ ТЁМНАЯ ТЕМА (акценты как в 2.6, Ч/Б без градиента к #e8bbf1)
    target.style.removeProperty('--bg');
    target.style.removeProperty('--surface');
    target.style.removeProperty('--surface-variant');
    target.style.removeProperty('--on-surface');
    target.style.removeProperty('--on-surface-variant');
    target.style.removeProperty('--primary');
    target.style.removeProperty('--primary-container');
    target.style.removeProperty('--secondary');
    target.style.removeProperty('--border');
    target.style.removeProperty('--grad');
    target.style.removeProperty('--glass-bg');

    target.style.setProperty('--primary', theme.primary);
    target.style.setProperty('--primary-container', theme.container);
    target.style.setProperty('--surface-variant', theme.variant);
    target.style.setProperty('--secondary', theme.primary);
    if (theme.isBW) {
        target.style.setProperty('--grad', `linear-gradient(90deg, ${theme.primary} 0%, ${theme.primary} 100%)`);
    } else {
        target.style.setProperty('--grad', `linear-gradient(90deg, ${theme.primary} 0%, #e8bbf1 100%)`);
    }
    if (!localStorage.getItem('oracle_bubble_color')) {
    }
}

function changeOracleTheme(primary, container, variant) {
        const theme = {
            primary: /^#[0-9a-f]{6}$/i.test(primary) ? primary : '#adc6ff',
            container: /^#[0-9a-f]{6}$/i.test(container) ? container : '#254487',
            variant: /^#[0-9a-f]{6}$/i.test(variant) ? variant : '#1f202e'
        };
        localStorage.setItem('oracle_matte_theme', JSON.stringify(theme));
        applyVisualTheme();
    }

        // --- ИСПРАВЛЕНИЯ СОХРАНЕНИЯ ПРОФИЛЯ ---
    function saveUserProfile() {
        const name = document.getElementById('user-profile-name').value;
        const role = document.getElementById('user-profile-role').value;
        const instr = document.getElementById('user-profile-instructions').value;
        localStorage.setItem('oracle_user_profile', JSON.stringify({name, role, instr}));
        
        const welcomeGreeting = document.getElementById('welcome-greeting');
        if (welcomeGreeting) {
            welcomeGreeting.innerText = name ? `Привет, ${name}!` : `Привет! Как твои дела?`;
        }
    }

    function setPillowMode(isActive) {
        const btn = document.getElementById('pillow-toggle-btn');
        const themeControls = document.getElementById('theme-color-controls');
        if (isActive) {
            // remember theme before pillow
            if (sessionStorage.getItem('oracle_pillow_saved_theme') == null) {
                sessionStorage.setItem('oracle_pillow_saved_theme', JSON.stringify({
                    light: document.body.classList.contains('light-theme'),
                    trueBlack: document.body.classList.contains('true-black-theme')
                }));
            }
            // light → True Black; accents muted via CSS
            document.body.classList.remove('light-theme');
            document.body.classList.add('true-black-theme');
            document.body.classList.add('pillow-mode');
            if (typeof applyVisualTheme === 'function') applyVisualTheme();
            if (btn) { btn.innerText = "ВЫКЛЮЧИТЬ"; btn.style.background = "var(--primary-container)"; btn.style.color = "var(--primary)"; }
            if (themeControls) themeControls.classList.add('disabled-by-pillow');
            localStorage.setItem('oracle_pillow_mode', 'true');
            localStorage.setItem('oracle_light_theme', 'false');
            localStorage.setItem('oracle_true_black', 'true');
        } else {
            document.body.classList.remove('pillow-mode');
            // restore previous theme
            try {
                const saved = JSON.parse(sessionStorage.getItem('oracle_pillow_saved_theme') || 'null');
                if (saved) {
                    document.body.classList.toggle('light-theme', !!saved.light);
                    document.body.classList.toggle('true-black-theme', !!saved.trueBlack && !saved.light);
                    localStorage.setItem('oracle_light_theme', saved.light ? 'true' : 'false');
                    localStorage.setItem('oracle_true_black', (!saved.light && saved.trueBlack) ? 'true' : 'false');
                }
            } catch (e) {}
            sessionStorage.removeItem('oracle_pillow_saved_theme');
            if (typeof applyVisualTheme === 'function') applyVisualTheme();
            if (btn) { btn.innerText = "ВКЛЮЧИТЬ"; btn.style.background = "var(--surface-variant)"; btn.style.color = "var(--on-surface)"; }
            if (themeControls) themeControls.classList.remove('disabled-by-pillow');
            localStorage.setItem('oracle_pillow_mode', 'false');
        }
    }

    function togglePillowMode() { setPillowMode(!document.body.classList.contains('pillow-mode')); }

    function setNoRgbMode(isActive) {
        const btn = document.getElementById('no-rgb-toggle-btn');
        if (isActive) {
            document.body.classList.add('no-rgb');
            if (btn) { btn.innerText = "ВЫКЛЮЧИТЬ"; btn.style.background = "var(--primary-container)"; btn.style.color = "var(--primary)"; }
            localStorage.setItem('oracle_no_rgb', 'true');
        } else {
            document.body.classList.remove('no-rgb');
            if (btn) { btn.innerText = "ВКЛЮЧИТЬ"; btn.style.background = "var(--surface-variant)"; btn.style.color = "var(--on-surface)"; }
            localStorage.setItem('oracle_no_rgb', 'false');
        }
    }

    function toggleNoRgbMode() {
        setNoRgbMode(!document.body.classList.contains('no-rgb'));
    }

    function setScreensaverFeature(isEnabled) {
        const btn = document.getElementById('screensaver-toggle-btn');
        const box = document.getElementById('screensaver-config-box');
        if (isEnabled) {
            if (btn) { btn.innerText = "ВЫКЛЮЧИТЬ"; btn.style.background = "var(--primary-container)"; btn.style.color = "var(--primary)"; }
            if (box) box.style.display = "block";
            localStorage.setItem('oracle_screensaver_enabled', 'true');
            resetScreensaverTimer();
        } else {
            if (btn) { btn.innerText = "ВКЛЮЧИТЬ"; btn.style.background = "var(--surface-variant)"; btn.style.color = "var(--on-surface)"; }
            if (box) box.style.display = "none";
            localStorage.setItem('oracle_screensaver_enabled', 'false');
            clearTimeout(CoreState.screensaverTimer);
        }
    }

    function toggleScreensaverFeature() {
        const isEnabled = localStorage.getItem('oracle_screensaver_enabled') === 'true';
        setScreensaverFeature(!isEnabled);
    }

    function updateScreensaverTimeout(val) {
        const safe = [5, 10, 15, 20].includes(Number(val)) ? Number(val) : 5;
        CoreState.screensaverTimeoutMins = safe;
        localStorage.setItem('oracle_screensaver_timeout', String(safe));
        updateTimeoutPickerUI(safe);
        resetScreensaverTimer();
        showToast(`Заставка: ${safe} минут.`, 'success');
    }

    function resetScreensaverTimer() {
        clearTimeout(CoreState.screensaverTimer);
        if (localStorage.getItem('oracle_screensaver_enabled') !== 'true') return;

        const timeoutMs = CoreState.screensaverTimeoutMins * 60 * 1000;
        CoreState.screensaverTimer = setTimeout(triggerScreensaverNow, timeoutMs);
    }

    function triggerScreensaverNow() {
        CoreState.isScreensaverActive = true;
        const style = (typeof resolveScreensaverStyle === 'function') ? resolveScreensaverStyle() : 'rainbow';
        if (typeof applyScreensaverStyle === 'function') applyScreensaverStyle(style);
        const overlay = document.getElementById('screensaver-overlay');
        if (overlay) overlay.style.display = 'block';
    }

    function dismissScreensaver() {
        if (!CoreState.isScreensaverActive) return;
        CoreState.isScreensaverActive = false;
        const overlay = document.getElementById('screensaver-overlay');
        if (overlay) overlay.style.display = 'none';
        resetScreensaverTimer();
    }

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
        window.addEventListener(evt, () => {
            if (!CoreState.isScreensaverActive) {
                resetScreensaverTimer();
            }
        });
    });

    function setGenerating(isGen) {
        CoreState.isStreaming = isGen;
        const sendBtn = document.getElementById('send-btn');
        const liveBtn = document.getElementById('live-chat-btn');
        const voiceBtn = document.getElementById('voice-btn');
        const stopBtn = document.getElementById('stop-gen-btn');

        if (isGen) {
            sendBtn?.classList.remove('visible');
            liveBtn?.classList.add('hidden');
            voiceBtn?.classList.add('hidden');
            stopBtn?.classList.remove('hidden');
            stopBtn?.classList.add('visible');
        } else {
            stopBtn?.classList.add('hidden');
            stopBtn?.classList.remove('visible');
            const input = document.getElementById('user-input');
            if (input) handleInput(input);
        }
    }

    function stopGeneration() {
        if (CoreState.genTimer) {
            clearTimeout(CoreState.genTimer);
            CoreState.genTimer = null;
        }
        setGenerating(false);
        showToast('Генерация остановлена', 'warning');
    }

    
// ===== AI RENDER: Markdown + Code windows + Image viewer =====
function escapeAiHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function detectCodeLang(lang) {
    const l = (lang || '').toLowerCase().trim();
    const map = {
        js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
        py: 'Python', python: 'Python', html: 'HTML', css: 'CSS', json: 'JSON',
        bash: 'Bash', sh: 'Shell', shell: 'Shell', sql: 'SQL', md: 'Markdown',
        xml: 'XML', java: 'Java', c: 'C', cpp: 'C++', go: 'Go', rust: 'Rust',
        text: 'Text', plain: 'Text', txt: 'Text'
    };
    return map[l] || (l ? l.toUpperCase() : 'Code');
}
function renderAiMarkdown(raw) {
    if (raw == null) return '';
    let text = String(raw);
    // extract fenced code blocks first
    const blocks = [];
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        const i = blocks.length;
        blocks.push({ lang: lang || 'text', code: code.replace(/\n$/, '') });
        return `\n%%CODEBLOCK_${i}%%\n`;
    });
    // images ![alt](url) or direct image urls on own line
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
        return `<figure class="ai-figure"><img class="ai-gen-image" src="${escapeAiHtml(url)}" alt="${escapeAiHtml(alt || 'AI image')}" loading="lazy" onclick="openAiImageViewer(this.src, this.alt)"/><figcaption>${escapeAiHtml(alt || '')}</figcaption></figure>`;
    });
    text = text.replace(/(^|\n)(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg)(?:\?\S*)?)/gi, (_, p, url) => {
        return `${p}<figure class="ai-figure"><img class="ai-gen-image" src="${escapeAiHtml(url)}" alt="AI image" loading="lazy" onclick="openAiImageViewer(this.src, 'AI image')"/></figure>`;
    });
    // inline code
    text = text.replace(/`([^`\n]+)`/g, (_, c) => `<code class="ai-inline-code">${escapeAiHtml(c)}</code>`);
    // bold / italic
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    // links [text](url)
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a class="ai-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // headings
    text = text.replace(/^### (.+)$/gm, '<h4 class="ai-h">$1</h4>');
    text = text.replace(/^## (.+)$/gm, '<h3 class="ai-h">$1</h3>');
    text = text.replace(/^# (.+)$/gm, '<h2 class="ai-h">$1</h2>');
    // lists
    text = text.replace(/^(?:- |\* )(.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul class="ai-ul">${m}</ul>`);
    // paragraphs: split by double newline
    const parts = text.split(/\n{2,}/).map(chunk => {
        chunk = chunk.trim();
        if (!chunk) return '';
        if (chunk.startsWith('<figure') || chunk.startsWith('<h') || chunk.startsWith('<ul') || chunk.startsWith('%%CODEBLOCK_')) return chunk;
        return `<p class="ai-p">${chunk.replace(/\n/g, '<br>')}</p>`;
    });
    let html = parts.join('\n');
    // restore code blocks as windows
    html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => {
        const b = blocks[Number(i)];
        if (!b) return '';
        const langLabel = detectCodeLang(b.lang);
        const id = 'code_' + Math.random().toString(36).slice(2, 9);
        return `<div class="ai-code-window" data-lang="${escapeAiHtml(b.lang)}">
            <div class="ai-code-toolbar">
                <span class="ai-code-lang">${escapeAiHtml(langLabel)}</span>
                <button type="button" class="ai-code-copy" onclick="copyAiCodeBlock(this)" title="Копировать">
                    <span class="material-symbols-rounded">content_copy</span>
                    <span class="ai-copy-label">Копировать</span>
                </button>
            </div>
            <pre class="ai-code-pre" id="${id}"><code>${escapeAiHtml(b.code)}</code></pre>
        </div>`;
    });
    return html;
}
function copyAiCodeBlock(btn) {
    const win = btn.closest('.ai-code-window');
    const code = win?.querySelector('pre code')?.textContent || '';
    const label = btn.querySelector('.ai-copy-label');
    const done = () => {
        if (label) label.textContent = 'Скопировано';
        btn.classList.add('copied');
        setTimeout(() => {
            if (label) label.textContent = 'Копировать';
            btn.classList.remove('copied');
        }, 1600);
    };
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(code).then(done).catch(() => showToast('Не удалось скопировать', 'error'));
    } else {
        showToast('Буфер недоступен', 'warning');
    }
}
function openAiImageViewer(src, alt) {
    let ov = document.getElementById('ai-image-viewer');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'ai-image-viewer';
        ov.className = 'ai-image-viewer';
        ov.innerHTML = `
            <button type="button" class="ai-iv-close" onclick="closeAiImageViewer()" aria-label="Закрыть">
                <span class="material-symbols-rounded">close</span>
            </button>
            <img id="ai-iv-img" alt="" />
            <div class="ai-iv-caption" id="ai-iv-caption"></div>
            <div class="ai-iv-actions">
                <a id="ai-iv-open" class="ai-iv-btn" target="_blank" rel="noopener noreferrer">Открыть оригинал</a>
                <button type="button" class="ai-iv-btn" onclick="closeAiImageViewer()">Закрыть</button>
            </div>`;
        ov.addEventListener('click', (e) => { if (e.target === ov) closeAiImageViewer(); });
        document.body.appendChild(ov);
    }
    const img = document.getElementById('ai-iv-img');
    const cap = document.getElementById('ai-iv-caption');
    const open = document.getElementById('ai-iv-open');
    if (img) { img.src = src; img.alt = alt || ''; }
    if (cap) cap.textContent = alt || '';
    if (open) open.href = src;
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeAiImageViewer() {
    const ov = document.getElementById('ai-image-viewer');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAiImageViewer();
});

function createAiMessageElement(content) {
    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'msg ai-msg';
    const body = document.createElement('div');
    body.className = 'ai-md-body';
    // if already HTML-ish from system, detect
    if (typeof content === 'string' && content.includes('<') && content.includes('>') && !content.includes('```')) {
        // trusted internal HTML fragments only for our system notes — still prefer text
        body.innerHTML = renderAiMarkdown(content.replace(/<[^>]+>/g, ''));
    } else {
        body.innerHTML = renderAiMarkdown(content);
    }
    aiMsgDiv.appendChild(body);
    return aiMsgDiv;
}

/** Demo helper: simulate rich AI reply for testing */
window.__demoAiRichReply = function() {
    const sample = `Вот пример ответа **Intify** с разметкой.

### Код JavaScript
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
console.log(greet('Core Node'));
\`\`\`

### Python
\`\`\`python
def hello(name: str) -> str:
    return f"Hello, {name}!"
print(hello("Oracle"))
\`\`\`

### HTML / CSS
\`\`\`html
<div class="card">Привет</div>
\`\`\`
\`\`\`css
.card { padding: 12px; border-radius: 12px; }
\`\`\`

Картинка (пример URL):
![Demo](https://picsum.photos/640/360)

Инлайн код: \`const x = 1\`.`;
    const flow = document.getElementById('chat-flow');
    if (!flow) return;
    document.getElementById('welcome-block')?.classList.add('hidden');
    flow.appendChild(createAiMessageElement(sample));
    if (typeof enhanceAiMessageActions === 'function') {
        flow.querySelectorAll('.ai-msg').forEach(el => enhanceAiMessageActions(el));
    }
    showToast('Demo rich AI message', 'success');
};


function sendMsg() {
        // dock input immediately so slide-down starts with first send
        document.body.classList.remove('chat-empty');

        if (CoreState.isStreaming) return;

        const input = document.getElementById('user-input');
        if (!input) return;

        const msg = input.value.trim();
        const chatFlow = document.getElementById('chat-flow');
        const screenChat = document.getElementById('screen-chat');

        if (!msg || !chatFlow) return;

        // Не считаем сообщения во временном режиме
        if (!CoreState.isTempChat) {
            trackMessageUsage();
        }

        // Первое сообщение в сессии → переименовываем чат
        if (CoreState.isFirstMsgInSession && !CoreState.isTempChat) {
            const activeChatTitle = document.querySelector('.chat-item-node.active-session .chat-title');
            if (activeChatTitle) {
                activeChatTitle.innerText = msg;
            }
            if (currentSessionId && chatSessions[currentSessionId]) {
                chatSessions[currentSessionId].title = msg;
                localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
            }
            CoreState.isFirstMsgInSession = false;
        }

        // Добавляем сообщение пользователя
        const userBubble = createUserBubbleElement(msg);
        chatFlow.appendChild(userBubble);

        input.value = "";
        handleInput(input);

        const welcome = document.getElementById('welcome-block');
        if (welcome) welcome.classList.add('hidden');

        const mainBox = document.getElementById('main-input-box');
        if (mainBox && mainBox.classList.contains('fullscreen-mode')) {
            toggleFullscreen();
        }

        if (screenChat) screenChat.scrollTop = screenChat.scrollHeight;

        // Сохраняем только если НЕ временный чат
        if (!CoreState.isTempChat) {
            if (currentSessionId && chatSessions[currentSessionId]) {
                chatSessions[currentSessionId].html = chatFlow.innerHTML;
                localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
            }
            localStorage.setItem('oracle_chat_history', chatFlow.innerHTML);
        }

        // Ответ: встроенный mock ИЛИ сторонний API
        setGenerating(true);
        CoreState._lastApiUserMsg = msg;
        const runReply = async () => {
            if (!CoreState.isStreaming) return;
            try {
                const result = await resolveAiResponse(msg);
                if (!CoreState.isStreaming) return;
                if (!result.ok) {
                    appendAiApiError(result.error || 'Ошибка API', msg);
                } else {
                    const aiMsgDiv = createAiMessageElement(result.text);
                    if (result.external) aiMsgDiv.classList.add('ai-external');
                    chatFlow.appendChild(aiMsgDiv);
                    if (typeof enhanceAiMessageActions === 'function') enhanceAiMessageActions(aiMsgDiv);
                }
            } catch (e) {
                appendAiApiError(e.message || String(e), msg);
            }
            if (screenChat) screenChat.scrollTop = screenChat.scrollHeight;
            if (!CoreState.isTempChat) {
                if (currentSessionId && chatSessions[currentSessionId]) {
                    chatSessions[currentSessionId].html = chatFlow.innerHTML;
                    localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
                }
                localStorage.setItem('oracle_chat_history', chatFlow.innerHTML);
            }
            setGenerating(false);
            CoreState.genTimer = null;
        };
        // slight delay for thinking anim
        CoreState.genTimer = setTimeout(() => { runReply(); }, 350);
    }

    function updatePillowIntensity(val) {
        const display = document.getElementById('pillow-intensity-val');
        if (display) display.innerText = val + '%';
        document.documentElement.style.setProperty('--pillow-brightness', val / 100);
        localStorage.setItem('oracle_pillow_intensity', val);
    }

    function savePillowSchedule() {
        const scheduleCb = document.getElementById('pillow-schedule-cb');
        const timeStart = document.getElementById('pillow-time-start');
        const timeEnd = document.getElementById('pillow-time-end');
        
        if (scheduleCb) localStorage.setItem('oracle_pillow_schedule_enabled', scheduleCb.checked);
        if (timeStart) localStorage.setItem('oracle_pillow_start', timeStart.value);
        if (timeEnd) localStorage.setItem('oracle_pillow_end', timeEnd.value);
        checkPillowSchedule();
    }

    function checkPillowSchedule() {
        if (localStorage.getItem('oracle_pillow_schedule_enabled') !== 'true') return;
        const start = localStorage.getItem('oracle_pillow_start') || '23:00';
        const end = localStorage.getItem('oracle_pillow_end') || '07:00';
        const now = new Date();
        const currentString = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        
        let shouldBeOn = (start < end) ? (currentString >= start && currentString < end) : (currentString >= start || currentString < end);
        const isCurrentlyOn = document.body.classList.contains('pillow-mode');
        
        if (shouldBeOn && !isCurrentlyOn) setPillowMode(true);
        else if (!shouldBeOn && isCurrentlyOn) setPillowMode(false);
    }

    window.addEventListener('DOMContentLoaded', () => {
        // Дефолт: светлая тема, если пользователь ещё ничего не выбирал
        const hasThemePref = localStorage.getItem('oracle_light_theme') !== null || localStorage.getItem('oracle_true_black') !== null;
        let savedLight, savedBlack;
        if (!hasThemePref) {
            savedLight = true;
            savedBlack = false;
            localStorage.setItem('oracle_light_theme', 'true');
            localStorage.setItem('oracle_true_black', 'false');
        } else {
            savedLight = localStorage.getItem('oracle_light_theme') === 'true';
            savedBlack = localStorage.getItem('oracle_true_black') === 'true';
        }
        document.body.classList.toggle('light-theme', savedLight);
        document.body.classList.toggle('true-black-theme', !savedLight && savedBlack);
        applyVisualTheme();
        
        if (localStorage.getItem('oracle_compact_nav') === 'true') {
            document.body.classList.add('compact-nav-mode');
            const btn = document.getElementById('compact-nav-toggle-btn');
            if (btn) {
                btn.innerText = "ВЫКЛЮЧИТЬ";
                btn.style.background = "var(--primary-container)";
                btn.style.color = "var(--primary)";
            }
        }

        const subNav = document.getElementById('sub-nav-chat');
        if (subNav) subNav.style.display = 'flex';

        renderSidebarChats();
        renderCalendar();

        const savedChat = localStorage.getItem('oracle_chat_history');
        if (savedChat) {
            const chatFlow = document.getElementById('chat-flow');
            if (chatFlow) { 
                chatFlow.innerHTML = savedChat; 
                if (chatFlow.children.length > 0 && document.getElementById('welcome-block')) {
                    document.getElementById('welcome-block').classList.add('hidden');
                }
            }
        }

        const savedStory = localStorage.getItem('oracle_story_active');
        if (savedStory) {
            const editor = document.getElementById('editor');
            if (editor) editor.innerHTML = savedStory;
        }

        applyVisualTheme();

        let profile = {}; try { profile = JSON.parse(localStorage.getItem('oracle_user_profile') || '{}') || {}; } catch(e) { profile = {}; }
        if (document.getElementById('user-profile-name')) document.getElementById('user-profile-name').value = profile.name || '';
        if (document.getElementById('user-profile-role')) document.getElementById('user-profile-role').value = profile.role || '';
        if (document.getElementById('user-profile-instructions')) document.getElementById('user-profile-instructions').value = profile.instr || '';
        
        if (profile.name && document.getElementById('welcome-greeting')) {
            document.getElementById('welcome-greeting').innerText = `Привет, ${profile.name}!`;
        }

        const savedIntensity = localStorage.getItem('oracle_pillow_intensity') || 80;
        const intensitySlider = document.getElementById('pillow-intensity-slider');
        if (intensitySlider) intensitySlider.value = savedIntensity;
        updatePillowIntensity(savedIntensity);

        const scheduleCb = document.getElementById('pillow-schedule-cb');
        if (scheduleCb) scheduleCb.checked = localStorage.getItem('oracle_pillow_schedule_enabled') === 'true';
        const timeStart = document.getElementById('pillow-time-start');
        if (timeStart) timeStart.value = localStorage.getItem('oracle_pillow_start') || '23:00';
        const timeEnd = document.getElementById('pillow-time-end');
        if (timeEnd) timeEnd.value = localStorage.getItem('oracle_pillow_end') || '07:00';
        if (localStorage.getItem('oracle_pillow_mode') === 'true') setPillowMode(true);
        if (localStorage.getItem('oracle_no_rgb') === 'true') setNoRgbMode(true);

        const savedSsTimeout = Number(localStorage.getItem('oracle_screensaver_timeout') || '5');
        CoreState.screensaverTimeoutMins = [5, 10, 15, 20].includes(savedSsTimeout) ? savedSsTimeout : 5;
        updateTimeoutPickerUI(CoreState.screensaverTimeoutMins);
        if (localStorage.getItem('oracle_screensaver_enabled') === 'true') setScreensaverFeature(true);
        if (typeof refreshScreensaverStyleUI === 'function') refreshScreensaverStyleUI();
        renderCalendar();

        setInterval(checkPillowSchedule, 60000); 
        checkPillowSchedule();

        updateLimitsUI();

        const userInput = document.getElementById('user-input');
        if (userInput) {
            userInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) { 
                    e.preventDefault(); 
                    sendMsg(); 
                }
            });
        }

        document.addEventListener('click', (e) => {
            // old agent menu removed – plus-menu is handled separately
            
            const ctxMenu = document.getElementById('context-menu');
            if (ctxMenu && !ctxMenu.contains(e.target)) ctxMenu.style.display = 'none';

            const timeoutPicker = document.getElementById('screensaver-timeout-picker');
            if (timeoutPicker && !timeoutPicker.contains(e.target)) timeoutPicker.classList.remove('open');

            const sidebar = document.getElementById('sidebar-archive');
            const burgerBtn = document.getElementById('burger-menu-btn');
            if (sidebar && sidebar.classList.contains('open') && !document.body.classList.contains('sidebar-docked') && !sidebar.contains(e.target) && burgerBtn && !burgerBtn.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    });

    // --- ИСПРАВЛЕНИЯ ПРИКРЕПЛЕНИЯ ФАЙЛОВ ---
        function handleAttachClick() {
        const isAccepted = localStorage.getItem('oracle_file_terms_accepted') === 'true';

        if (isAccepted) {
            document.getElementById('file-input').click();
        } else {
            showCustomModal(
                'Контент и авторские права',
                'Убедитесь, что загружаемые файлы принадлежат вам или у вас есть разрешение на их использование. ' +
                'Запрещено загружать и генерировать контент, нарушающий права третьих лиц, а также содержащий оскорбления, ' +
                'призывы к насилию или вредоносные материалы.<br><br>' +
                '<small style="opacity: 0.7;">Нажимая «Принять», вы соглашаетесь с Политикой конфиденциальности Core Node 2.6.1 Master.</small>',
                false, 
                '', 
                (confirmed) => {
                    if (confirmed) {
                        localStorage.setItem('oracle_file_terms_accepted', 'true');
                        document.getElementById('file-input').click();
                    }
                }
            );
        }
    }

    function openSplitSelector() {
    // Закрываем сайдбар
    document.getElementById('sidebar-archive')?.classList.remove('open');

    // Заполняем список чатов
    const chatSelect = document.getElementById('split-select-chat');
    if (chatSelect) {
        chatSelect.innerHTML = '';
        Object.keys(chatSessions).forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = chatSessions[id].title || 'Новый чат';
            if (id === currentSessionId) opt.selected = true;
            chatSelect.appendChild(opt);
        });

        // Если чатов нет — добавляем текущий
        if (Object.keys(chatSessions).length === 0) {
            const opt = document.createElement('option');
            opt.value = currentSessionId || 'default';
            opt.textContent = 'Текущий чат';
            chatSelect.appendChild(opt);
        }
    }

    // Заполняем список историй
    const storySelect = document.getElementById('split-select-story');
    if (storySelect) {
        storySelect.innerHTML = '';
        
        // Опция "Без истории"
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '— Без истории —';
        storySelect.appendChild(emptyOpt);

        Object.keys(storyBooks).forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = storyBooks[id].title || 'Без названия';
            if (id === currentStoryId) opt.selected = true;
            storySelect.appendChild(opt);
        });
    }

    document.getElementById('split-selector-modal')?.classList.add('active');
}

function closeSplitSelector() {
    document.getElementById('split-selector-modal')?.classList.remove('active');
}

function confirmSplitView() {
    const chatId = document.getElementById('split-select-chat')?.value;
    const storyId = document.getElementById('split-select-story')?.value;

    // Загружаем выбранный чат
    if (chatId && chatId !== currentSessionId) {
        loadChatSession(chatId);
    }

    // Загружаем выбранную историю
    if (storyId) {
        openStoryBook(storyId);
    }

    closeSplitSelector();
    enterSplitView();
}
function togglePlusMenu() {
    const menu = document.getElementById('plus-menu');
    if (!menu) return;
    menu.classList.toggle('open');
}

function closePlusMenu() {
    document.getElementById('plus-menu')?.classList.remove('open');
}

// Закрытие при клике вне
document.addEventListener('click', (e) => {
    const plusBtn = document.getElementById('agent-plus-btn');
    const menu = document.getElementById('plus-menu');
    
    if (menu && menu.classList.contains('open') && 
        !menu.contains(e.target) && 
        !plusBtn?.contains(e.target)) {
        closePlusMenu();
    }
});

// Обновляем selectAgent, чтобы закрывал меню
function selectAgent(agentName) {
    CoreState.activeAgent = agentName;
    
    document.querySelectorAll('.agent-option').forEach(opt => opt.classList.remove('active'));
    
    if (agentName === 'Oracle Main') document.getElementById('opt-oracle')?.classList.add('active');
    if (agentName === 'Worldpack AI') document.getElementById('opt-worldpack')?.classList.add('active');
    if (agentName === 'Модель: Fast') document.getElementById('opt-fast')?.classList.add('active');
    
    closePlusMenu();

    const chatFlow = document.getElementById('chat-flow');
    const welcomeBlock = document.getElementById('welcome-block');
    if (welcomeBlock) welcomeBlock.classList.add('hidden');
    
    if (chatFlow) {
        chatFlow.innerHTML += `<div class="msg ai-msg" style="border-left: 3px solid var(--primary); font-style: italic; opacity:0.8;">Система: подключен профиль [${agentName}]</div>`;
        const screenChat = document.getElementById('screen-chat');
        if (screenChat) screenChat.scrollTop = screenChat.scrollHeight;
    }
}
function startLiveChat() {
    const phrases = [
        "Что делаешь?",
        "Как дела?",
        "Расскажи что-нибудь",
        "Есть идеи?",
        "Чем занят?",
        "Что нового?",
        "Помоги с задачей",
        "Давай поговорим"
    ];
    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
    
    const msgEl = document.getElementById('live-user-msg');
    if (msgEl) msgEl.textContent = randomPhrase;

    const modal = document.getElementById('live-chat-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeLiveChatModal() {
    const modal = document.getElementById('live-chat-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Privacy modal handlers
function handlePrivacyAccept() {
    localStorage.setItem('oracle_file_terms_accepted', 'true');
    document.getElementById('copyright-modal')?.classList.remove('active');
    document.getElementById('file-input')?.click();
}

function handlePrivacyReject() {
    document.getElementById('copyright-modal')?.classList.remove('active');
    showToast('Загрузка файлов отменена', 'warning');
}

// ===== FULLSCREEN INPUT + FLOATING FORMAT =====

function isMobileOrTablet() {
    return window.innerWidth <= 900 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function openFullscreenInput() {
    const modal = document.getElementById('fullscreen-input-modal');
    const mainInput = document.getElementById('user-input');
    const fsInput = document.getElementById('fs-user-input');

    if (!modal || !mainInput || !fsInput) return;

    fsInput.value = mainInput.value;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => fsInput.focus(), 50);
}

function closeFullscreenInput() {
    const modal = document.getElementById('fullscreen-input-modal');
    const mainInput = document.getElementById('user-input');
    const fsInput = document.getElementById('fs-user-input');

    if (!modal) return;

    // Синхронизируем текст обратно
    if (mainInput && fsInput) {
        mainInput.value = fsInput.value;
        handleInput(mainInput);
    }

    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function sendFromFullscreen() {
    const mainInput = document.getElementById('user-input');
    const fsInput = document.getElementById('fs-user-input');

    if (mainInput && fsInput) {
        mainInput.value = fsInput.value;
    }

    closeFullscreenInput();
    sendMsg();
}

function fsFormat(command) {
    document.execCommand(command, false, null);
}

function fsChangeFontSize(size) {
    document.execCommand('fontSize', false, '7'); // временный размер
    const fonts = document.querySelectorAll('font[size="7"]');
    fonts.forEach(el => {
        el.removeAttribute('size');
        el.style.fontSize = size + 'px';
    });
}

// Открытие по двойному тапу / фокусу на мобильных
document.addEventListener('DOMContentLoaded', () => {
    const mainInput = document.getElementById('user-input');
    if (!mainInput) return;

    // На мобильных — открываем fullscreen при фокусе
    mainInput.addEventListener('focus', () => {
        if (isMobileOrTablet()) {
            openFullscreenInput();
        }
    });

    // На ПК — показываем floating menu при выделении текста
    mainInput.addEventListener('mouseup', showFloatingMenu);
    mainInput.addEventListener('keyup', showFloatingMenu);
});

function showFloatingMenu() {
    if (isMobileOrTablet()) return;

    const menu = document.getElementById('floating-format-menu');
    const selection = window.getSelection();

    if (!menu || !selection || selection.isCollapsed || selection.toString().trim() === '') {
        menu?.classList.remove('visible');
        return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    menu.style.left = (rect.left + window.scrollX + rect.width / 2 - 70) + 'px';
    menu.style.top = (rect.top + window.scrollY - 45) + 'px';
    menu.classList.add('visible');
}

// Прячем floating menu при клике вне
document.addEventListener('mousedown', (e) => {
    const menu = document.getElementById('floating-format-menu');
    if (menu && !menu.contains(e.target)) {
        menu.classList.remove('visible');
    }
});


// ===== НАВИГАЦИЯ И ПЕРСОНАЛИЗАЦИЯ =====
function setNavPosition(pos) {
    document.body.classList.remove('nav-top', 'nav-bottom', 'nav-side');
    document.body.classList.add('nav-' + pos);
    localStorage.setItem('oracle_nav_position', pos);

    // Обновляем кнопки
    document.querySelectorAll('.nav-pos-btn').forEach(btn => {
        const active = btn.dataset.pos === pos;
        btn.classList.toggle('active', active);
        btn.style.background = active ? 'var(--primary-container)' : 'var(--surface-variant)';
        btn.style.color = active ? 'var(--primary)' : 'var(--on-surface)';
    });

    // «Слиять с концами» недоступен при боковом меню
    const flushBtn = document.getElementById('flush-nav-toggle-btn');
    if (flushBtn) {
        if (pos === 'side') {
            flushBtn.disabled = true;
            flushBtn.style.opacity = '0.4';
            flushBtn.style.pointerEvents = 'none';
        } else {
            flushBtn.disabled = false;
            flushBtn.style.opacity = '1';
            flushBtn.style.pointerEvents = 'auto';
        }
    }

    showToast('Навигация: ' + (pos === 'top' ? 'вверху' : pos === 'bottom' ? 'внизу' : 'в боковом меню'), 'success');
}

function toggleFlushNav() {
    const isFlush = document.body.classList.toggle('nav-flush');
    localStorage.setItem('oracle_nav_flush', isFlush ? 'true' : 'false');
    const btn = document.getElementById('flush-nav-toggle-btn');
    if (btn) {
        btn.innerText = isFlush ? 'ВЫКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ';
        btn.style.background = isFlush ? 'var(--primary-container)' : 'var(--surface-variant)';
        btn.style.color = isFlush ? 'var(--primary)' : 'var(--on-surface)';
    }
}

function toggleAnimations() {
    const disabled = document.body.classList.toggle('no-animations');
    localStorage.setItem('oracle_no_animations', disabled ? 'true' : 'false');
    const btn = document.getElementById('anim-toggle-btn');
    if (btn) {
        btn.innerText = disabled ? 'ВЫКЛЮЧЕНО' : 'ВКЛЮЧЕНО';
        btn.style.background = disabled ? 'var(--surface-variant)' : 'var(--primary-container)';
        btn.style.color = disabled ? 'var(--on-surface)' : 'var(--primary)';
    }
}

function setThemeMode(mode) {
    document.body.classList.remove('light-theme', 'true-black-theme');
    if (mode === 'light') {
        document.body.classList.add('light-theme');
        localStorage.setItem('oracle_light_theme', 'true');
        localStorage.setItem('oracle_true_black', 'false');
    } else if (mode === 'trueblack') {
        document.body.classList.add('true-black-theme');
        localStorage.setItem('oracle_light_theme', 'false');
        localStorage.setItem('oracle_true_black', 'true');
    } else {
        localStorage.setItem('oracle_light_theme', 'false');
        localStorage.setItem('oracle_true_black', 'false');
    }
    applyVisualTheme();
    updateThemeButtons(mode);
    showToast('Тема: ' + (mode === 'light' ? 'Светлая' : mode === 'trueblack' ? 'True Black' : 'Тёмная'), 'success');
}

function updateThemeButtons(mode) {
    ['light', 'dark', 'trueblack'].forEach(m => {
        const btn = document.getElementById('theme-btn-' + (m === 'trueblack' ? 'black' : m));
        if (!btn) return;
        const active = (m === mode) || (m === 'dark' && mode === 'dark');
        btn.style.background = active ? 'var(--primary-container)' : 'var(--surface-variant)';
        btn.style.color = active ? 'var(--primary)' : 'var(--on-surface)';
        btn.style.borderColor = active ? 'var(--primary)' : 'var(--border)';
    });
}


// ===== NAV CONTEXT MENU =====
function showNavContextMenu(e) {
    e.preventDefault();
    const menu = document.getElementById('nav-context-menu');
    if (!menu) return;
    menu.classList.add('open');
    menu.style.left = Math.min(e.clientX, window.innerWidth - 220) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 160) + 'px';
    const moveBtn = document.getElementById('nav-ctx-move');
    const isBottom = document.body.classList.contains('nav-bottom');
    if (moveBtn) moveBtn.innerHTML = isBottom
        ? '<span class="material-symbols-rounded">swap_vert</span> Переместить вверх'
        : '<span class="material-symbols-rounded">swap_vert</span> Переместить вниз';
}

function navCtxCompact() {
    toggleCompactNav();
    document.getElementById('nav-context-menu')?.classList.remove('open');
}
function navCtxMove() {
    const isBottom = document.body.classList.contains('nav-bottom');
    setNavPosition(isBottom ? 'top' : 'bottom');
    document.getElementById('nav-context-menu')?.classList.remove('open');
}
function navCtxFlush() {
    toggleFlushNav();
    document.getElementById('nav-context-menu')?.classList.remove('open');
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('nav-context-menu');
    if (menu && !menu.contains(e.target)) menu.classList.remove('open');
});

// ===== ONBOARDING TIPS =====
function startOnboarding() {
    if (localStorage.getItem('oracle_onboarding_done') === 'true') return;
    const tips = [
        { title: 'Live Chat', text: 'Кнопка рядом с микрофоном — скоро живой диалог с ИИ.', sel: '#live-chat-btn' },
        { title: 'Расширенная Персонализация', text: 'Навигация сверху/снизу, темы и анимации — в Settings → Персонализация.', sel: '#btn-tab-settings' },
        { title: 'Точные Лимиты', text: 'Прозрачные лимиты использования в разделе Лимиты.', sel: '#btn-tab-settings' },
        { title: 'Вкладка «О вас»', text: 'Имя, роль и инструкции для ИИ — персональный профиль.', sel: '#btn-tab-settings' }
    ];
    let i = 0;
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;

    function showTip() {
        overlay.innerHTML = '';
        if (i >= tips.length) {
            localStorage.setItem('oracle_onboarding_done', 'true');
            return;
        }
        const tip = tips[i];
        const el = document.querySelector(tip.sel);
        const rect = el ? el.getBoundingClientRect() : { top: 80, left: 80, width: 40, height: 40 };
        const div = document.createElement('div');
        div.className = 'onboard-tip';
        div.style.top = (rect.bottom + 12) + 'px';
        div.style.left = Math.min(rect.left, window.innerWidth - 240) + 'px';
        div.innerHTML = `<strong>${tip.title}</strong><p>${tip.text}</p><button type="button">Далее</button>`;
        div.querySelector('button').onclick = () => { i++; showTip(); };
        overlay.appendChild(div);
    }
    setTimeout(showTip, 800);
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(startOnboarding, 600);
});


// ===== FILE LIBRARY + MEMORY (1GB) =====
const MEMORY_LIMIT_MB = 1024;
const ATTACH_LIMIT = 20; // per hour

function loadFileLibrary() {
    try {
        return JSON.parse(localStorage.getItem('oracle_file_library') || '[]') || [];
    } catch(e) { return []; }
}
function saveFileLibrary(list) {
    localStorage.setItem('oracle_file_library', JSON.stringify(list));
    updateMemoryUI();
    renderLibraryFiles();
}
function getLibrarySizeMB() {
    const list = loadFileLibrary();
    return list.reduce((s, f) => s + (f.sizeMB || 0), 0);
}
function updateMemoryUI() {
    const used = getLibrarySizeMB();
    const pct = Math.min(100, (used / MEMORY_LIMIT_MB) * 100);
    const label = document.getElementById('memory-used-label');
    const bar = document.getElementById('memory-bar');
    if (label) label.textContent = `${used.toFixed(1)} МБ / ${MEMORY_LIMIT_MB} МБ`;
    if (bar) {
        bar.style.width = pct + '%';
        bar.style.background = pct > 90 ? '#ff5252' : 'var(--primary)';
    }
}
function renderLibraryFiles() {
    const box = document.getElementById('library-files');
    if (!box) return;
    const list = loadFileLibrary();
    if (!list.length) {
        box.innerHTML = '<div style="font-size:12px;color:var(--on-surface-variant);padding:8px;">Файлов пока нет</div>';
        return;
    }
    box.innerHTML = list.map((f, idx) => `
        <div class="library-file-row" data-idx="${idx}">
            <div class="library-file-info">
                <div class="library-file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
                <div class="library-file-meta">${(f.sizeMB||0).toFixed(2)} МБ</div>
            </div>
            <div class="library-file-actions">
                <button class="lib-act-btn" title="Переименовать" onclick="renameLibraryFile(${idx})"><span class="material-symbols-rounded" style="font-size:18px;">edit</span></button>
                <button class="lib-act-btn" title="Чат с файлом" onclick="openChatWithFile(${idx})"><span class="material-symbols-rounded" style="font-size:18px;">chat</span></button>
                <button class="lib-act-btn danger" title="Удалить" onclick="deleteLibraryFile(${idx})"><span class="material-symbols-rounded" style="font-size:18px;">delete</span></button>
                <button class="lib-act-btn lib-more-btn" title="Ещё" onclick="showLibraryFileMenu(event, ${idx})"><span class="material-symbols-rounded" style="font-size:18px;">more_vert</span></button>
            </div>
        </div>
    `).join('');
}

function renameLibraryFile(idx) {
    const list = loadFileLibrary();
    if (!list[idx]) return;
    showCustomModal('Переименовать файл', 'Новое имя файла', true, list[idx].name, (val) => {
        if (!val || !String(val).trim()) return;
        list[idx].name = String(val).trim();
        saveFileLibrary(list);
        showToast('Файл переименован', 'success');
    });
}

function openChatWithFile(idx) {
    const list = loadFileLibrary();
    if (!list[idx]) return;
    const f = list[idx];
    createNewChatSession();
    const input = document.getElementById('user-input');
    if (input) {
        input.value = `Файл: ${f.name}\n\nПроанализируй этот файл / ответь по его содержимому.`;
        handleInput(input);
    }
    document.getElementById('sidebar-archive')?.classList.remove('open');
    showToast('Чат с файлом открыт. Отправь сообщение.', 'success');
}

function deleteLibraryFile(idx) {
    const list = loadFileLibrary();
    if (!list[idx]) return;
    showCustomModal(
        'Удалить файл?',
        '<b>Внимание:</b> ИИ может путаться в деталях, если вы удалите файл и не отправите новый документ, код или вложение. Продолжить удаление «' + escapeHtml(list[idx].name) + '»?',
        false, '',
        (ok) => {
            if (!ok) return;
            list.splice(idx, 1);
            saveFileLibrary(list);
            showToast('Файл удалён', 'success');
        }
    );
}

function showLibraryFileMenu(e, idx) {
    e.stopPropagation();
    showCustomModal('Файл', 'Выберите действие', false, '', null);
    // Simple mobile actions via sequential modals alternative:
    const list = loadFileLibrary();
    if (!list[idx]) return;
    const name = list[idx].name;
    showCustomModal(name, `
        <div style="display:flex;flex-direction:column;gap:8px;">
            <button class="modal-btn modal-btn-accept" style="width:100%;" onclick="closeCustomModal(true); renameLibraryFile(${idx})">Переименовать</button>
            <button class="modal-btn modal-btn-accept" style="width:100%;" onclick="closeCustomModal(true); openChatWithFile(${idx})">Открыть чат с файлом</button>
            <button class="modal-btn modal-btn-reject" style="width:100%;border-color:#ff5252;color:#ff5252;" onclick="closeCustomModal(true); deleteLibraryFile(${idx})">Удалить</button>
        </div>
    `);
}
function clearFileLibrary() {
    showCustomModal('Очистить память', 'Удалить все файлы из библиотеки?', false, '', (ok) => {
        if (ok) {
            saveFileLibrary([]);
            showToast('Память очищена', 'success');
        }
    });
}
function canAttachFile(sizeMB) {
    if (getLibrarySizeMB() + sizeMB > MEMORY_LIMIT_MB) {
        showCustomModal('Память заполнена', 'Очистите память ИИ (Библиотека файлов), чтобы продолжить прикреплять файлы. Лимит: 1 ГБ.');
        return false;
    }
    const usage = getAttachUsage();
    if (usage.count >= ATTACH_LIMIT) {
        showToast('Лимит вложений исчерпан. Подождите сброса.', 'warning');
        return false;
    }
    return true;
}
function getAttachUsage() {
    try {
        const raw = JSON.parse(localStorage.getItem('oracle_attach_usage') || '{}');
        const now = Date.now();
        if (!raw.ts || now - raw.ts > 3600000) {
            return { count: 0, ts: now };
        }
        return raw;
    } catch(e) { return { count: 0, ts: Date.now() }; }
}
function trackAttach() {
    const u = getAttachUsage();
    u.count = (u.count || 0) + 1;
    if (!u.ts) u.ts = Date.now();
    localStorage.setItem('oracle_attach_usage', JSON.stringify(u));
    updateAttachLimitUI();
}
function updateAttachLimitUI() {
    const u = getAttachUsage();
    const countEl = document.getElementById('limit-attach-count');
    const bar = document.getElementById('limit-attach-bar');
    const timer = document.getElementById('reset-attach-timer');
    if (countEl) countEl.textContent = `${u.count} / ${ATTACH_LIMIT}`;
    if (bar) bar.style.width = Math.min(100, (u.count / ATTACH_LIMIT) * 100) + '%';
    if (timer) {
        const left = Math.max(0, 3600000 - (Date.now() - (u.ts || Date.now())));
        timer.textContent = Math.ceil(left / 60000) + ' мин';
    }
    // Hide attach if limit reached
    const attachItems = document.querySelectorAll('.plus-menu-item');
    attachItems.forEach(btn => {
        if (btn.textContent.includes('Прикрепить')) {
            btn.style.display = u.count >= ATTACH_LIMIT ? 'none' : '';
        }
    });
}

function handleFileUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const sizeMB = file.size / (1024 * 1024);
        if (!canAttachFile(sizeMB)) {
            input.value = '';
            return;
        }
        const list = loadFileLibrary();
        list.push({ name: file.name, sizeMB: sizeMB, added: Date.now() });
        saveFileLibrary(list);
        trackAttach();
        showToast(`Файл добавлен: ${file.name}`, 'success');
        input.value = '';
    }
}

// ===== DOCK SIDEBAR =====
function toggleSidebarDock() {
    const docked = document.body.classList.toggle('sidebar-docked');
    localStorage.setItem('oracle_sidebar_docked', docked ? 'true' : 'false');
    const label = document.getElementById('dock-toggle-label');
    if (label) label.textContent = docked ? 'Скрыть боковое меню' : 'Закрепить меню';
    if (docked) {
        document.getElementById('sidebar-archive')?.classList.add('open');
    }
}

// ===== SECURITY TOGGLES =====
function toggleLockScreen() {
    const on = localStorage.getItem('oracle_lock_screen') === 'true';
    localStorage.setItem('oracle_lock_screen', on ? 'false' : 'true');
    const btn = document.getElementById('lock-screen-btn');
    if (btn) {
        btn.innerText = !on ? 'ВЫКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ';
        btn.style.background = !on ? 'var(--primary-container)' : 'var(--surface-variant)';
        btn.style.color = !on ? 'var(--primary)' : 'var(--on-surface)';
    }
    showToast(!on ? 'Блокировка экрана включена' : 'Блокировка выключена', 'success');
}
function toggleHideHistory() {
    const on = localStorage.getItem('oracle_hide_history') === 'true';
    localStorage.setItem('oracle_hide_history', on ? 'false' : 'true');
    const btn = document.getElementById('hide-history-btn');
    if (btn) {
        btn.innerText = !on ? 'ВЫКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ';
        btn.style.background = !on ? 'var(--primary-container)' : 'var(--surface-variant)';
        btn.style.color = !on ? 'var(--primary)' : 'var(--on-surface)';
    }
    document.getElementById('chats-list')?.classList.toggle('hidden', !on);
    showToast(!on ? 'История скрыта' : 'История видна', 'success');
}
function clearAllLocalData() {
    showCustomModal('Удалить всё?', 'Будут удалены чаты, истории, файлы и настройки. Это необратимо.', false, '', (ok) => {
        if (!ok) return;
        const keep = ['oracle_onboarding_done'];
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith('oracle_') && !keep.includes(k)) localStorage.removeItem(k);
        });
        showToast('Данные очищены. Перезагрузите страницу.', 'warning');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateMemoryUI();
    renderLibraryFiles();
    updateAttachLimitUI();
    if (localStorage.getItem('oracle_sidebar_docked') === 'true') {
        document.body.classList.add('sidebar-docked');
        document.getElementById('sidebar-archive')?.classList.add('open');
        const label = document.getElementById('dock-toggle-label');
        if (label) label.textContent = 'Скрыть боковое меню';
    }
});


// ===== CONSENT + SHARED CHATS =====
let pendingPublicImport = null;
let lastShareId = null;

function acceptConsent(mode) {
    localStorage.setItem('oracle_consent', mode);
    document.getElementById('consent-modal')?.classList.remove('active');
    // 2/2 tip about shared chats
    if (localStorage.getItem('oracle_share_tip_seen') !== 'true') {
        setTimeout(() => {
            document.getElementById('share-tip-modal')?.classList.add('active');
        }, 400);
    }
}

function closeShareTip() {
    localStorage.setItem('oracle_share_tip_seen', 'true');
    document.getElementById('share-tip-modal')?.classList.remove('active');
}


// ===== PUBLIC LINKS MANAGEMENT =====
function buildPublicShareUrl(shareId, payload) {
    try {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify({
            id: shareId,
            title: (payload && payload.title) || 'Чат',
            html: (payload && payload.html) || ''
        }))));
        const url = new URL(window.location.href);
        url.searchParams.set('public-chat', shareId);
        url.hash = 'share=' + encoded;
        return url.toString();
    } catch (e) {
        return window.location.origin + window.location.pathname + '?public-chat=' + shareId;
    }
}

function getActivePublicShares() {
    const shares = loadShares();
    const blocked = (() => { try { return JSON.parse(localStorage.getItem('oracle_blocked_shares') || '[]'); } catch(e) { return []; } })();
    return Object.keys(shares)
        .map(id => {
            const s = shares[id];
            if (!s || s.blocked || blocked.includes(id)) return null;
            // drop if linked chat was deleted
            if (s.sessionId && chatSessions && !chatSessions[s.sessionId]) return null;
            return { id, ...s };
        })
        .filter(Boolean)
        .sort((a, b) => (b.created || 0) - (a.created || 0));
}

function renderPublicLinksList() {
    const list = document.getElementById('public-links-list');
    const empty = document.getElementById('public-links-empty');
    if (!list) return;
    const items = getActivePublicShares();
    list.innerHTML = '';
    if (!items.length) {
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';
    items.forEach(s => {
        const card = document.createElement('div');
        card.className = 'public-link-card';
        const date = s.created ? new Date(s.created).toLocaleString('ru-RU') : '—';
        card.innerHTML = `
            <div class="public-link-info">
                <div class="public-link-title">${escapeHtml(s.title || 'Чат')}</div>
                <div class="public-link-meta">${escapeHtml(date)} · ${escapeHtml(s.id)}</div>
            </div>
            <div class="public-link-actions">
                <button type="button" class="icon-btn" title="Перейти в чат" onclick="goToSharedChat('${s.id}')">
                    <span class="material-symbols-rounded">chat</span>
                </button>
                <button type="button" class="icon-btn" title="Копировать ссылку" onclick="copyPublicLinkById('${s.id}')">
                    <span class="material-symbols-rounded">content_copy</span>
                </button>
                <button type="button" class="icon-btn danger-icon" title="Удалить ссылку" onclick="deletePublicLink('${s.id}')">
                    <span class="material-symbols-rounded">link_off</span>
                </button>
            </div>`;
        list.appendChild(card);
    });
}

function goToSharedChat(shareId) {
    const shares = loadShares();
    const s = shares[shareId];
    if (!s) { showToast('Ссылка не найдена', 'error'); return; }
    if (s.sessionId && chatSessions[s.sessionId] && typeof loadChatSession === 'function') {
        loadChatSession(s.sessionId);
        document.getElementById('sidebar-archive')?.classList.remove('open');
        showToast('Открыт чат: ' + (s.title || ''), 'success');
        return;
    }
    // fallback: open html snapshot in current flow
    if (s.html && typeof switchScreen === 'function') {
        switchScreen('chat');
        const flow = document.getElementById('chat-flow');
        const welcome = document.getElementById('welcome-block');
        if (welcome) welcome.classList.add('hidden');
        if (flow) flow.innerHTML = s.html;
        showToast('Снимок чата (оригинал удалён из списка)', 'warning');
    }
}

function copyPublicLinkById(shareId) {
    const shares = loadShares();
    const s = shares[shareId];
    if (!s) { showToast('Ссылка не найдена', 'error'); return; }
    const link = buildPublicShareUrl(shareId, s);
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).then(() => showToast('Ссылка скопирована', 'success'))
            .catch(() => showToast('Не удалось скопировать', 'error'));
    } else {
        showToast(link, 'info', 5000);
    }
}

function deletePublicLink(shareId) {
    showCustomModal(
        'Удалить ссылку?',
        'Чат останется в истории. Публичный доступ по этой ссылке будет закрыт.',
        false, '',
        (ok) => {
            if (!ok) return;
            const shares = loadShares();
            if (shares[shareId]) {
                delete shares[shareId];
                saveShares(shares);
            }
            try {
                const blocked = JSON.parse(localStorage.getItem('oracle_blocked_shares') || '[]');
                if (!blocked.includes(shareId)) {
                    blocked.push(shareId);
                    localStorage.setItem('oracle_blocked_shares', JSON.stringify(blocked));
                }
            } catch (e) {}
            renderPublicLinksList();
            showToast('Ссылка удалена', 'warning');
        }
    );
}

function deleteAllPublicLinks() {
    const items = getActivePublicShares();
    if (!items.length) {
        showToast('Нет ссылок для удаления', 'info');
        return;
    }
    showCustomModal(
        'Удалить все ссылки?',
        'Все публичные ссылки будут удалены. Чаты в истории сохранятся.',
        false, '',
        (ok) => {
            if (!ok) return;
            const shares = loadShares();
            const blocked = (() => { try { return JSON.parse(localStorage.getItem('oracle_blocked_shares') || '[]'); } catch(e) { return []; } })();
            Object.keys(shares).forEach(id => {
                delete shares[id];
                if (!blocked.includes(id)) blocked.push(id);
            });
            saveShares(shares);
            localStorage.setItem('oracle_blocked_shares', JSON.stringify(blocked));
            renderPublicLinksList();
            showToast('Все ссылки удалены', 'warning');
        }
    );
}

/** При удалении чата — чистим связанные публичные ссылки */
function cleanupSharesForSession(sessionId) {
    if (!sessionId) return;
    const shares = loadShares();
    let changed = false;
    Object.keys(shares).forEach(id => {
        if (shares[id] && shares[id].sessionId === sessionId) {
            delete shares[id];
            changed = true;
        }
    });
    if (changed) {
        saveShares(shares);
        try { renderPublicLinksList(); } catch (e) {}
    }
}

const _showSectionBase = typeof showSection === 'function' ? showSection : null;
if (_showSectionBase && !window._publicLinksShowPatched) {
    window._publicLinksShowPatched = true;
    window.showSection = function(sectionId) {
        _showSectionBase(sectionId);
        if (sectionId === 'public-links') renderPublicLinksList();
    };
}


function loadShares() {
    try { return JSON.parse(localStorage.getItem('oracle_shares') || '{}') || {}; }
    catch(e) { return {}; }
}
function saveShares(map) {
    localStorage.setItem('oracle_shares', JSON.stringify(map));
}

function cmShare() {
    document.getElementById('context-menu').style.display = 'none';
    // target session from context menu state
    const sessionId = window._ctxSessionId || currentSessionId;
    if (!sessionId || !chatSessions[sessionId]) {
        showToast('Чат не найден', 'error');
        return;
    }
    const chat = chatSessions[sessionId];
    const shareId = 'sh_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const payload = {
        id: shareId,
        sessionId: sessionId,
        title: chat.title || 'Чат',
        html: chat.html || '',
        created: Date.now(),
        blocked: false
    };
    const shares = loadShares();
    shares[shareId] = payload;
    saveShares(shares);
    lastShareId = shareId;

    // Embed compact payload in hash for cross-browser import (experimental)
    let link;
    try {
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify({
            id: shareId,
            title: payload.title,
            html: payload.html
        }))));
        const url = new URL(window.location.href);
        url.searchParams.set('public-chat', shareId);
        url.hash = 'share=' + encoded;
        link = url.toString();
    } catch (e) {
        link = window.location.origin + window.location.pathname + '?public-chat=' + shareId;
    }

    const input = document.getElementById('share-link-input');
    if (input) input.value = link;
    document.getElementById('share-result-modal')?.classList.add('active');
    try { renderPublicLinksList(); } catch (e) {}
}

function copyShareLink() {
    const input = document.getElementById('share-link-input');
    if (!input) return;
    navigator.clipboard?.writeText(input.value).then(() => {
        showToast('Ссылка скопирована', 'success');
    }).catch(() => {
        input.select();
        document.execCommand('copy');
        showToast('Ссылка скопирована', 'success');
    });
}

function blockShareLink() {
    if (!lastShareId) return;
    showCustomModal(
        'Заблокировать ссылку?',
        'Отменить блокировку будет нельзя. У тех, кто откроет ссылку, появится ошибка доступа.',
        false, '',
        (ok) => {
            if (!ok) return;
            const shares = loadShares();
            if (shares[lastShareId]) {
                shares[lastShareId].blocked = true;
                saveShares(shares);
            }
            // global block list (for id-only checks on this device)
            const blocked = JSON.parse(localStorage.getItem('oracle_blocked_shares') || '[]');
            if (!blocked.includes(lastShareId)) blocked.push(lastShareId);
            localStorage.setItem('oracle_blocked_shares', JSON.stringify(blocked));
            showToast('Ссылка заблокирована навсегда', 'warning');
            closeShareResult();
        }
    );
}

function closeShareResult() {
    document.getElementById('share-result-modal')?.classList.remove('active');
}

function closePublicChatModal() {
    document.getElementById('public-chat-modal')?.classList.remove('active');
    pendingPublicImport = null;
    // clean URL
    try {
        const url = new URL(window.location.href);
        url.searchParams.delete('public-chat');
        url.hash = '';
        history.replaceState({}, '', url.toString());
    } catch(e) {}
}

function confirmImportPublicChat() {
    if (!pendingPublicImport) return;
    const id = 'session_' + Date.now();
    chatSessions[id] = {
        title: (pendingPublicImport.title || 'Совместный чат') + ' (импорт)',
        html: pendingPublicImport.html || ''
    };
    currentSessionId = id;
    localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
    localStorage.setItem('oracle_current_session', id);
    const chatFlow = document.getElementById('chat-flow');
    const welcome = document.getElementById('welcome-block');
    if (chatFlow) chatFlow.innerHTML = chatSessions[id].html || '';
    if (welcome) {
        if (chatFlow && chatFlow.children.length) welcome.classList.add('hidden');
        else welcome.classList.remove('hidden');
    }
    renderSidebarChats();
    switchScreen('chat');
    closePublicChatModal();
    showToast('Чат добавлен', 'success');
}

function checkPublicChatLink() {
    try {
        const url = new URL(window.location.href);
        const shareId = url.searchParams.get('public-chat');
        if (!shareId) return;

        const blocked = JSON.parse(localStorage.getItem('oracle_blocked_shares') || '[]');
        const shares = loadShares();
        if (blocked.includes(shareId) || (shares[shareId] && shares[shareId].blocked)) {
            document.getElementById('public-chat-title').textContent = 'Доступ ограничен';
            document.getElementById('public-chat-text').textContent = 'Автор чата ограничил доступ по этой ссылке.';
            document.getElementById('public-chat-progress').style.display = 'none';
            document.getElementById('public-chat-actions').style.display = 'flex';
            document.getElementById('public-chat-ok').style.display = 'none';
            document.getElementById('public-chat-modal')?.classList.add('active');
            return;
        }

        const modal = document.getElementById('public-chat-modal');
        const title = document.getElementById('public-chat-title');
        const text = document.getElementById('public-chat-text');
        const progress = document.getElementById('public-chat-progress');
        const bar = document.getElementById('public-chat-bar');
        const actions = document.getElementById('public-chat-actions');
        const okBtn = document.getElementById('public-chat-ok');

        title.textContent = 'Добавление чата и загрузка';
        text.textContent = 'Загрузка может занять пару секунд…';
        progress.style.display = 'block';
        bar.style.width = '15%';
        actions.style.display = 'none';
        okBtn.style.display = '';
        modal?.classList.add('active');

        setTimeout(() => { bar.style.width = '55%'; }, 200);
        setTimeout(() => { bar.style.width = '85%'; }, 500);

        setTimeout(() => {
            let data = null;
            // from local shares
            if (shares[shareId] && !shares[shareId].blocked) {
                data = shares[shareId];
            }
            // from hash payload
            if (!data && url.hash.startsWith('#share=')) {
                try {
                    const raw = decodeURIComponent(escape(atob(url.hash.slice(7))));
                    data = JSON.parse(raw);
                } catch(e) {}
            }
            if (!data) {
                title.textContent = 'Не удалось загрузить';
                text.textContent = 'Ссылка недействительна или автор ограничил доступ.';
                progress.style.display = 'none';
                actions.style.display = 'flex';
                okBtn.style.display = 'none';
                return;
            }
            pendingPublicImport = data;
            bar.style.width = '100%';
            title.textContent = 'Чат готов';
            text.textContent = '«' + (data.title || 'Чат') + '» — добавить в архив?';
            actions.style.display = 'flex';
        }, 900);
    } catch(e) {
        console.warn(e);
    }
}

// Hook context menu to remember session id
const _origShowContextMenu = typeof showContextMenu === 'function' ? showContextMenu : null;

// Patch: capture session when opening context menu on chat items
document.addEventListener('contextmenu', (e) => {
    const node = e.target.closest('.chat-item-node');
    if (!node) return;
    const title = node.querySelector('.chat-title')?.textContent;
    const id = Object.keys(chatSessions).find(k => chatSessions[k].title === title) || currentSessionId;
    window._ctxSessionId = id;
}, true);

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('oracle_consent')) {
        document.getElementById('consent-modal')?.classList.add('active');
    }
    checkPublicChatLink();
});


// ===== WELCOME AMBIENT =====
function updateWelcomeAmbient() {
    const ambient = document.getElementById('welcome-ambient');
    const welcome = document.getElementById('welcome-block');
    const chatFlow = document.getElementById('chat-flow');
    if (!ambient) return;
    const hasMessages = chatFlow && chatFlow.children.length > 0;
    const welcomeHidden = welcome && welcome.classList.contains('hidden');
    if (hasMessages || welcomeHidden || CoreState.isTempChat) {
        ambient.classList.add('hidden-ambient');
    } else {
        ambient.classList.remove('hidden-ambient');
    }
}

// call after send and on load
const _ambientHook = () => updateWelcomeAmbient();
document.addEventListener('DOMContentLoaded', () => {
    updateWelcomeAmbient();
    // observe chat-flow child list
    const chatFlow = document.getElementById('chat-flow');
    if (chatFlow && typeof MutationObserver !== 'undefined') {
        new MutationObserver(updateWelcomeAmbient).observe(chatFlow, { childList: true });
    }
});


// ===== MOBILE COMPACT INPUT =====
function setupMobileCompactInput() {
    const box = document.getElementById('main-input-box');
    const input = document.getElementById('user-input');
    if (!box || !input) return;

    const isTouch = window.matchMedia('(max-width: 768px), (hover: none)').matches;
    if (!isTouch) {
        box.classList.remove('input-compact');
        return;
    }

    box.classList.add('input-compact');

    const expand = () => box.classList.add('input-expanded');
    const collapse = () => {
        if (!input.value.trim() && document.activeElement !== input) {
            box.classList.remove('input-expanded');
            input.style.height = '';
        }
    };

    input.addEventListener('focus', expand);
    input.addEventListener('blur', () => setTimeout(collapse, 150));
    input.addEventListener('input', () => {
        if (input.value.trim()) expand();
    });
}
document.addEventListener('DOMContentLoaded', setupMobileCompactInput);
window.addEventListener('resize', setupMobileCompactInput);

function settingsMobileResetOnLeave(screenId) {
    if (screenId !== 'settings') {
        document.getElementById('screen-settings')?.classList.remove('settings-drill');
    }
}


// ===== CUSTOM NAV TABS =====
const NAV_TAB_META = {
    chat:     { label: 'Chat', icon: 'chat_bubble', locked: true },
    reader:   { label: 'Reader', icon: 'auto_stories' },
    library:  { label: 'Библиотека', icon: 'folder_open' },
    calendar: { label: 'Планы', icon: 'calendar_month' },
    settings: { label: 'Settings', icon: 'settings' }
};

function getNavTabs() {
    try {
        const raw = JSON.parse(localStorage.getItem('oracle_nav_tabs') || 'null');
        if (Array.isArray(raw) && raw.length === 3 && raw[0] === 'chat') {
            const rest = raw.slice(1).filter(t => t !== 'chat' && NAV_TAB_META[t]);
            // unique
            const slot2 = rest[0] || 'reader';
            let slot3 = rest[1] || 'settings';
            if (slot3 === slot2) slot3 = (slot2 === 'settings' ? 'reader' : 'settings');
            return ['chat', slot2, slot3];
        }
    } catch(e) {}
    return ['chat', 'reader', 'settings'];
}

function saveNavTabs(tabs) {
    localStorage.setItem('oracle_nav_tabs', JSON.stringify(tabs));
    renderMainNav();
    renderSidebarFallbacks();
    fillNavSlotSelects();
}

function saveNavTabsFromUI() {
    const s2 = document.getElementById('nav-slot-2')?.value || 'reader';
    let s3 = document.getElementById('nav-slot-3')?.value || 'settings';
    if (s3 === s2) {
        const opts = ['reader','library','calendar','settings'].filter(x => x !== s2);
        s3 = opts[0];
    }
    saveNavTabs(['chat', s2, s3]);
    showToast('Навигация обновлена', 'success');
}

function fillNavSlotSelects() {
    const tabs = getNavTabs();
    const options = [
        { v: 'reader', t: 'Reader' },
        { v: 'library', t: 'Библиотека файлов' },
        { v: 'calendar', t: 'Календарь и планы' },
        { v: 'settings', t: 'Settings' }
    ];
    ['nav-slot-2','nav-slot-3'].forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = tabs[i + 1];
        el.innerHTML = options.map(o => `<option value="${o.v}" ${o.v===current?'selected':''}>${o.t}</option>`).join('');
    });
}

function renderMainNav() {
    const nav = document.querySelector('.glass-nav');
    if (!nav) return;
    // keep contextmenu handler via attribute already on nav
    const tabs = getNavTabs();
    nav.innerHTML = tabs.map(id => {
        const m = NAV_TAB_META[id];
        if (!m) return '';
        return `<button class="nav-item" id="btn-tab-${id}" data-tab="${id}" onclick="navGo('${id}')">
            <span class="material-symbols-rounded">${m.icon}</span>
            <span class="nav-text">${m.label}</span>
        </button>`;
    }).join('');
    // restore active
    const active = document.querySelector('.app-screen.active-screen');
    let screen = 'chat';
    if (active && active.id) screen = active.id.replace('screen-', '');
    if (screen === 'calendar') screen = 'calendar';
    const btn = document.getElementById('btn-tab-' + (screen === 'calendar' ? 'calendar' : screen));
    document.querySelectorAll('.glass-nav .nav-item').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else document.getElementById('btn-tab-chat')?.classList.add('active');
}

function navGo(tabId) {
    if (tabId === 'chat') switchScreen('chat');
    else if (tabId === 'reader') switchScreen('reader');
    else if (tabId === 'settings') switchScreen('settings');
    else if (tabId === 'calendar') switchScreen('calendar');
    else if (tabId === 'library') {
        switchScreen('library');
        if (typeof refreshLibraryUI === 'function') refreshLibraryUI();
    }
    document.querySelectorAll('.glass-nav .nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-tab-' + tabId)?.classList.add('active');
}

function renderSidebarFallbacks() {
    const box = document.getElementById('sidebar-fallbacks');
    if (!box) return;
    const tabs = getNavTabs();
    const inNav = new Set(tabs);
    const items = [];
    if (!inNav.has('reader')) {
        items.push(`<button type="button" class="sidebar-fallback-btn" onclick="switchScreen('reader'); document.getElementById('sidebar-archive')?.classList.remove('open');"><span class="material-symbols-rounded">auto_stories</span> Reader</button>`);
    }
    if (!inNav.has('calendar')) {
        items.push(`<button type="button" class="sidebar-fallback-btn" onclick="switchScreen('calendar'); document.getElementById('sidebar-archive')?.classList.remove('open');"><span class="material-symbols-rounded">calendar_month</span> Планы и календарь</button>`);
    }
    if (!inNav.has('library')) {
        items.push(`<button type="button" class="sidebar-fallback-btn" onclick="switchScreen('library'); document.getElementById('sidebar-archive')?.classList.remove('open'); if(typeof refreshLibraryUI==='function')refreshLibraryUI();"><span class="material-symbols-rounded">folder_open</span> Библиотека файлов</button>`);
    }
    if (!inNav.has('settings')) {
        items.push(`<button type="button" class="sidebar-fallback-btn" onclick="switchScreen('settings'); document.getElementById('sidebar-archive')?.classList.remove('open');"><span class="material-symbols-rounded">settings</span> Settings</button>`);
    }
    box.innerHTML = items.join('');
    box.style.display = items.length ? 'flex' : 'none';
}

// ===== READER TOUR =====
const READER_TOUR = [
    { title: 'Новый Reader', text: 'Здесь живут ваши истории. Пока история не выбрана — показан только быстрый старт, без пустого редактора.' },
    { title: 'Архив историй', text: 'Откройте боковое меню → «Истории». ПКМ по книге: переименовать, удалить. «+» создаёт новую.' },
    { title: 'Редактор', text: 'После выбора книги появятся панель форматирования, вкладки и автосохранение в браузере.' },
    { title: 'Совет', text: 'Reader можно убрать из нижней/верхней навигации в Персонализации — тогда он останется в боковом меню.' }
];
let readerTourStep = 0;

function startReaderTour() {
    readerTourStep = 0;
    const modal = document.getElementById('reader-tour-modal');
    if (!modal) return;
    document.getElementById('reader-tour-title').textContent = READER_TOUR[0].title;
    document.getElementById('reader-tour-text').textContent = READER_TOUR[0].text;
    document.getElementById('reader-tour-next').textContent = 'Далее';
    modal.classList.add('active');
}

function nextReaderTour() {
    readerTourStep++;
    if (readerTourStep >= READER_TOUR.length) {
        closeReaderTour();
        localStorage.setItem('oracle_reader_tour_done', 'true');
        showToast('Обучение Reader завершено', 'success');
        return;
    }
    const step = READER_TOUR[readerTourStep];
    document.getElementById('reader-tour-title').textContent = step.title;
    document.getElementById('reader-tour-text').textContent = step.text;
    document.getElementById('reader-tour-next').textContent =
        readerTourStep === READER_TOUR.length - 1 ? 'Готово' : 'Далее';
}

function closeReaderTour() {
    document.getElementById('reader-tour-modal')?.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    renderMainNav();
    renderSidebarFallbacks();
    fillNavSlotSelects();
});

function createNewStoryBook(e) {
    if (e) e.stopPropagation();
    showCustomModal('Новая история', 'Название книги', true, 'Без названия', (name) => {
        if (!name) return;
        const id = 'story_' + Date.now();
        storyBooks[id] = { title: String(name).trim() || 'Без названия', content: '' };
        localStorage.setItem('oracle_story_books', JSON.stringify(storyBooks));
        if (typeof renderSidebarStories === 'function') renderSidebarStories();
        openStoryBook(id);
        showToast('История создана', 'success');
    });
}

// ===== ORACLE NOTEPAD + SPLIT MODES =====
CoreState.splitMode = CoreState.splitMode || 'chat-reader';
CoreState.splitStoryId = CoreState.splitStoryId || null;
CoreState.notepadProjectId = localStorage.getItem('oracle_active_project_id') || null;

const NP_PROJECTS_KEY = 'oracle_projects_list';
const NP_ACTIVE_KEY = 'oracle_active_project_id';
const NP_DRAFT_KEY = 'oracle_notepad_code';

function readNotepadProjects() {
    try {
        const arr = JSON.parse(localStorage.getItem(NP_PROJECTS_KEY) || '[]');
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}
function writeNotepadProjects(list) {
    localStorage.setItem(NP_PROJECTS_KEY, JSON.stringify(list));
}
function getNotepadStorageKey(id) {
    return id ? `oracle_notepad_storage_${id}` : NP_DRAFT_KEY;
}
function readNotepadProjectState(id) {
    try {
        const raw = localStorage.getItem(getNotepadStorageKey(id));
        if (!raw) return null;
        if (!id) return { code: raw };
        return JSON.parse(raw);
    } catch (e) { return null; }
}
function writeNotepadProjectState(id, code, extra) {
    if (!id) {
        localStorage.setItem(NP_DRAFT_KEY, code || '');
        return;
    }
    let prev = {};
    try { prev = JSON.parse(localStorage.getItem(getNotepadStorageKey(id)) || '{}') || {}; } catch (e) {}
    const state = Object.assign({}, prev, extra || {}, { code: code || '' });
    localStorage.setItem(getNotepadStorageKey(id), JSON.stringify(state));
}
function updateNpProjectLabel() {
    const lab = document.getElementById('np-active-project-label');
    const projects = readNotepadProjects();
    const id = CoreState.notepadProjectId;
    const p = projects.find(x => x.id === id);
    if (lab) lab.textContent = p ? (p.name || p.id) : (id ? id : 'Draft');
    const splitLab = document.getElementById('split-np-project-label');
    if (splitLab) splitLab.textContent = p ? (p.name || p.id) : 'Авто / Draft';
}
function renderNotepadProjectsSidebar() {
    const list = document.getElementById('np-projects-list');
    if (!list) return;
    const projects = readNotepadProjects();
    list.innerHTML = '';
    if (!projects.length) {
        list.innerHTML = '<div style="font-size:11px;color:var(--on-surface-variant);padding:6px 4px;line-height:1.4;">Нет проектов Oracle Notepad. Создайте «+» или сохраните код в Split — появится здесь.</div>';
        return;
    }
    const active = CoreState.notepadProjectId || localStorage.getItem(NP_ACTIVE_KEY);
    projects.forEach(p => {
        const item = document.createElement('div');
        item.className = 'chat-item-node' + (p.id === active ? ' active-session' : '');
        item.dataset.projectId = p.id;
        item.innerHTML = `
            <div class="np-proj-row">
                <span class="chat-title">${escapeHtml(p.name || p.id)}</span>
                <span class="material-symbols-rounded" style="font-size:16px;color:var(--primary);">code</span>
            </div>
            <div class="np-proj-meta">${escapeHtml(p.id)}</div>`;
        item.onclick = () => openNotepadProject(p.id, { openSplit: false });
        item.oncontextmenu = (e) => {
            e.preventDefault();
            showCustomModal('Проект Notepad', escapeHtml(p.name || p.id), false, '', null);
        };
        list.appendChild(item);
    });
}
function openNotepadProject(id, opts) {
    opts = opts || {};
    CoreState.notepadProjectId = id || null;
    if (id) localStorage.setItem(NP_ACTIVE_KEY, id);
    const st = readNotepadProjectState(id);
    const el = document.getElementById('notepad-code');
    if (el) el.value = (st && (st.code != null ? st.code : st)) || '';
    updateNpProjectLabel();
    renderNotepadProjectsSidebar();
    if (opts.openSplit || CoreState.isSplitView) {
        if (!CoreState.isSplitView && typeof enterSplitViewWithMode === 'function') {
            enterSplitViewWithMode('chat-notepad');
        }
    } else {
        // show notepad screen alone optional
        const np = document.getElementById('screen-notepad');
        if (np && !CoreState.isSplitView) {
            document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active-screen'));
            np.classList.add('active-screen');
        }
    }
    showToast('Проект: ' + (id || 'Draft'), 'success');
}
function createNotepadProjectFromCore() {
    showCustomModal('Новый Coding Project', 'Название проекта', true, 'Project ' + (readNotepadProjects().length + 1), (name) => {
        if (!name) return;
        const id = 'np_' + Date.now().toString(36);
        const list = readNotepadProjects();
        list.unshift({ id, name: String(name).trim() || id });
        writeNotepadProjects(list);
        const code = document.getElementById('notepad-code')?.value || '';
        writeNotepadProjectState(id, code, { metaName: name, updatedAt: Date.now() });
        openNotepadProject(id, { openSplit: true });
        showToast('Проект создан', 'success');
    });
}
function openNotepadProjectPicker() {
    const projects = readNotepadProjects();
    if (!projects.length) {
        showToast('Нет проектов — нажмите + в боковом меню', 'warning');
        return;
    }
    // simple cycle via modal list text
    const names = projects.map((p, i) => `${i + 1}. ${p.name || p.id}`).join('\n');
    showCustomModal('Выбрать проект', 'Введите номер:\n' + escapeHtml(names), true, '1', (val) => {
        const n = parseInt(val, 10);
        if (!n || n < 1 || n > projects.length) return;
        openNotepadProject(projects[n - 1].id, {});
    });
}

function loadNotepadCode() {
    const el = document.getElementById('notepad-code');
    if (!el) return;
    const id = CoreState.notepadProjectId || localStorage.getItem(NP_ACTIVE_KEY);
    CoreState.notepadProjectId = id;
    const st = readNotepadProjectState(id);
    if (st && (st.code != null || typeof st === 'string')) {
        el.value = st.code != null ? st.code : (typeof st === 'string' ? st : '');
    } else {
        el.value = localStorage.getItem(NP_DRAFT_KEY) || '';
    }
    if (!el.dataset.npBound) {
        el.dataset.npBound = '1';
        el.addEventListener('input', () => {
            clearTimeout(window._npSaveT);
            window._npSaveT = setTimeout(() => saveNotepadCode(true), 600);
        });
    }
    updateNpProjectLabel();
    renderNotepadProjectsSidebar();
}
function saveNotepadCode(silent) {
    const el = document.getElementById('notepad-code');
    if (!el) return;
    let id = CoreState.notepadProjectId || localStorage.getItem(NP_ACTIVE_KEY);
    // auto-create project from split draft if empty list and has code
    if (!id && el.value.trim()) {
        const list = readNotepadProjects();
        if (!list.length) {
            id = 'np_' + Date.now().toString(36);
            list.unshift({ id, name: 'Split Draft', source: 'core-node', updatedAt: Date.now() });
            writeNotepadProjects(list);
            CoreState.notepadProjectId = id;
            localStorage.setItem(NP_ACTIVE_KEY, id);
        }
    }
    writeNotepadProjectState(id, el.value, {
        updatedAt: Date.now(),
        source: 'core-node',
        // совместимость с Oracle Notepad (oracle-ai-pro.github.io/oracle-notepad)
        metaName: (readNotepadProjects().find(p => p.id === id) || {}).name || ''
    });
    localStorage.setItem(NP_DRAFT_KEY, el.value);
    // обновить метку времени в списке проектов
    if (id) {
        const list = readNotepadProjects();
        const i = list.findIndex(p => p.id === id);
        if (i >= 0) {
            list[i].updatedAt = Date.now();
            writeNotepadProjects(list);
        }
    }
    try {
        localStorage.setItem('oracle_notepad_sync_pulse', String(Date.now()));
    } catch (e) {}
    updateNpProjectLabel();
    renderNotepadProjectsSidebar();
    if (!silent) showToast('Автосохранено' + (id ? ' · проект' : ' · draft'), 'success');
}

/** Полный пакет проектов для импорта/экспорта (общие ключи с Notepad) */
function exportNotepadProjectsPack() {
    const projects = readNotepadProjects();
    const pack = {
        version: 1,
        app: 'oracle-notepad',
        site: 'https://oracle-ai-pro.github.io/oracle-notepad',
        exportedAt: Date.now(),
        activeId: localStorage.getItem(NP_ACTIVE_KEY) || CoreState.notepadProjectId || null,
        projects: projects.map(p => {
            const st = readNotepadProjectState(p.id) || {};
            return {
                id: p.id,
                name: p.name || p.id,
                updatedAt: p.updatedAt || st.updatedAt || null,
                state: st
            };
        }),
        draft: localStorage.getItem(NP_DRAFT_KEY) || ''
    };
    return pack;
}
function importNotepadProjectsPack(pack, mode) {
    mode = mode || 'merge'; // merge | replace
    if (!pack || typeof pack !== 'object') throw new Error('Неверный пакет');
    let projects = mode === 'replace' ? [] : readNotepadProjects();
    const byId = {};
    projects.forEach(p => { byId[p.id] = p; });
    const incoming = Array.isArray(pack.projects) ? pack.projects : [];
    incoming.forEach(item => {
        if (!item || !item.id) return;
        byId[item.id] = {
            id: item.id,
            name: item.name || item.id,
            updatedAt: item.updatedAt || Date.now(),
            source: item.source || 'import'
        };
        if (item.state && typeof item.state === 'object') {
            writeNotepadProjectState(item.id, item.state.code || '', item.state);
        } else if (typeof item.code === 'string') {
            writeNotepadProjectState(item.id, item.code, { updatedAt: Date.now() });
        }
    });
    projects = Object.values(byId);
    writeNotepadProjects(projects);
    if (pack.draft != null && pack.draft !== '') {
        localStorage.setItem(NP_DRAFT_KEY, String(pack.draft));
    }
    if (pack.activeId) {
        CoreState.notepadProjectId = pack.activeId;
        localStorage.setItem(NP_ACTIVE_KEY, pack.activeId);
    }
    loadNotepadCode();
    renderNotepadProjectsSidebar();
    return projects.length;
}
function downloadNotepadProjectsPack() {
    const pack = exportNotepadProjectsPack();
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oracle-notepad-projects.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Экспорт: oracle-notepad-projects.json', 'success');
}
function promptImportNotepadProjects() {
    showCustomModal(
        'Импорт проектов Notepad',
        'Вставьте JSON из Oracle Notepad (или файл экспорта). Ключи: oracle_projects_list + oracle_notepad_storage_*.',
        true,
        '',
        (raw) => {
            if (!raw || !String(raw).trim()) return;
            try {
                const pack = JSON.parse(String(raw).trim());
                const n = importNotepadProjectsPack(pack, 'merge');
                showToast('Импортировано проектов: ' + n, 'success');
            } catch (e) {
                showToast('Ошибка JSON: ' + (e.message || e), 'error');
            }
        }
    );
}
function startNotepadAutosave() {
    // периодический бэкап каждые 30с
    clearInterval(window._npAutoIv);
    window._npAutoIv = setInterval(() => {
        const el = document.getElementById('notepad-code');
        if (!el) return;
        if (document.hidden) return;
        saveNotepadCode(true);
    }, 30000);
    window.addEventListener('beforeunload', () => {
        try { saveNotepadCode(true); } catch (e) {}
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            try { saveNotepadCode(true); } catch (e) {}
        } else {
            renderNotepadProjectsSidebar();
            loadNotepadCode();
        }
    });
}
function clearNotepadCode() {
    showCustomModal('Очистить Notepad?', 'Код будет удалён из редактора.', false, '', (ok) => {
        if (!ok) return;
        const el = document.getElementById('notepad-code');
        if (el) el.value = '';
        writeNotepadProjectState(CoreState.notepadProjectId, '');
        localStorage.removeItem(NP_DRAFT_KEY);
        showToast('Notepad очищен', 'warning');
    });
}
function insertNotepadToken(tok) {
    const el = document.getElementById('notepad-code');
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    el.value = el.value.slice(0, s) + tok + el.value.slice(e);
    el.selectionStart = el.selectionEnd = s + tok.length;
    el.focus();
    el.dispatchEvent(new Event('input'));
}

function fillSplitNpProjectMenu() {
    const menu = document.getElementById('split-np-project-menu');
    if (!menu) return;
    const projects = readNotepadProjects();
    menu.innerHTML = '';
    const add = (id, label) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'custom-select-option' + ((CoreState.notepadProjectId || null) === id ? ' active' : '');
        b.textContent = label;
        b.onclick = () => {
            CoreState.notepadProjectId = id;
            if (id) localStorage.setItem(NP_ACTIVE_KEY, id);
            else localStorage.removeItem(NP_ACTIVE_KEY);
            openNotepadProject(id, {});
            document.getElementById('split-np-project-picker')?.classList.remove('open');
            updateNpProjectLabel();
        };
        menu.appendChild(b);
    };
    add(null, 'Draft (без проекта)');
    projects.forEach(p => add(p.id, p.name || p.id));
}
function toggleSplitNpProjectMenu(e) {
    e?.stopPropagation();
    fillSplitNpProjectMenu();
    document.getElementById('split-np-project-picker')?.classList.toggle('open');
}

function selectSplitMode(mode) {
    CoreState.splitMode = mode || 'chat-reader';
    document.querySelectorAll('.split-mode-card').forEach(c => {
        c.classList.toggle('active', c.dataset.mode === CoreState.splitMode);
    });
    const wrap = document.getElementById('split-story-pick-wrap');
    if (wrap) wrap.style.display = CoreState.splitMode === 'chat-reader' ? 'block' : 'none';
    const npWrap = document.getElementById('split-np-project-wrap');
    if (npWrap) npWrap.style.display = CoreState.splitMode === 'chat-notepad' ? 'block' : 'none';
    if (CoreState.splitMode === 'chat-notepad') fillSplitNpProjectMenu();
    const chatWrap = document.getElementById('split-chat-pick-wrap');
    if (chatWrap) chatWrap.style.display = CoreState.splitMode === 'chat-chat' ? 'block' : 'none';
    if (CoreState.splitMode === 'chat-chat') fillSplitChatMenu();
    const mobileHint = document.querySelector('.split-dual-mobile-hint');
    if (mobileHint) mobileHint.style.display = (window.matchMedia('(max-width:767px)').matches && CoreState.splitMode === 'chat-chat') ? 'block' : 'none';
}

function toggleSplitStoryMenu(e) {
    e?.stopPropagation();
    document.getElementById('split-story-picker')?.classList.toggle('open');
}
function pickSplitStory(id, title) {
    CoreState.splitStoryId = id;
    const lab = document.getElementById('split-story-label');
    if (lab) lab.textContent = title || 'Авто';
    document.getElementById('split-story-picker')?.classList.remove('open');
}
function fillSplitStoryMenu() {
    const menu = document.getElementById('split-story-menu');
    if (!menu) return;
    const books = storyBooks || {};
    let html = `<button type="button" class="custom-select-option" onclick="pickSplitStory(null,'Авто')">Авто / текущая</button>`;
    Object.keys(books).forEach(id => {
        const t = books[id].title || 'История';
        html += `<button type="button" class="custom-select-option" onclick="pickSplitStory('${id}', '${String(t).replace(/'/g,"\\'")}')">${escapeHtml(t)}</button>`;
    });
    menu.innerHTML = html;
}

// Override confirmSplitView / enterSplitView lightly
const _enterSplitViewBase = typeof enterSplitView === 'function' ? enterSplitView : null;

window.confirmSplitView = function() {
    closeSplitSelector();
    enterSplitViewWithMode(CoreState.splitMode || 'chat-reader');
};

window.openSplitSelector = function() {
    fillSplitStoryMenu();
    selectSplitMode(CoreState.splitMode || 'chat-reader');
    document.getElementById('split-selector-modal')?.classList.add('active');
};
window.closeSplitSelector = function() {
    document.getElementById('split-selector-modal')?.classList.remove('active');
};



// ===== DUAL CHAT SPLIT =====
CoreState.splitChatBId = CoreState.splitChatBId || null;

function isMobileSplit() {
    return window.matchMedia('(max-width: 767px)').matches;
}
function toggleSplitChatMenu(e) {
    e?.stopPropagation();
    document.getElementById('split-chat-picker')?.classList.toggle('open');
    document.getElementById('split-story-picker')?.classList.remove('open');
}
function fillSplitChatMenu() {
    const menu = document.getElementById('split-chat-menu');
    if (!menu) return;
    let html = `<button type="button" class="custom-select-option" onclick="pickSplitChatB(null,'Новый / черновик')">Новый / черновик</button>`;
    Object.keys(chatSessions || {}).forEach(id => {
        if (id === currentSessionId) return;
        const t = (chatSessions[id] && chatSessions[id].title) || 'Чат';
        html += `<button type="button" class="custom-select-option" onclick="pickSplitChatB('${id}', '${String(t).replace(/'/g, "\\'")}')">${escapeHtml(t)}</button>`;
    });
    menu.innerHTML = html;
}
function pickSplitChatB(id, title) {
    CoreState.splitChatBId = id;
    const lab = document.getElementById('split-chat-label');
    if (lab) lab.textContent = title || 'Новый / черновик';
    document.getElementById('split-chat-picker')?.classList.remove('open');
}
function ensureSplitInputB() {
    let box = document.getElementById('split-input-b');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'split-input-b';
    box.className = 'glass-input-box split-input-b';
    box.innerHTML = `
        <textarea id="user-input-b" rows="1" placeholder="Сообщение во второй чат..."></textarea>
        <div class="split-b-bar">
            <button type="button" class="send-btn-b" id="send-btn-b" onclick="sendMsgToChatB()" title="Отправить в чат B" oncontextmenu="showSendAllCtx(event)">
                <span class="material-symbols-rounded" style="font-size:18px;">send</span>
            </button>
        </div>`;
    document.querySelector('.oracle-container')?.appendChild(box);
    const ta = box.querySelector('#user-input-b');
    if (ta) {
        ta.addEventListener('input', () => {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 100) + 'px';
        });
        ta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsgToChatB(); }
        });
    }
    return box;
}
function setSplitDualInputs(on) {
    document.body.classList.toggle('split-dual-chat', !!on);
    const b = ensureSplitInputB();
    if (on && !isMobileSplit()) {
        b.style.display = 'flex';
        syncSplitInputWidths();
    } else {
        b.style.display = 'none';
    }
}
function syncSplitInputWidths() {
    const ratio = CoreState.splitRatio || 0.5;
    document.documentElement.style.setProperty('--split-left', (ratio * 100) + '%');
    document.documentElement.style.setProperty('--split-right', ((1 - ratio) * 100) + '%');
}
function loadChatBSession(id) {
    const flow = document.getElementById('chat-flow-b');
    if (!flow) return;
    if (id && chatSessions[id]) {
        flow.innerHTML = chatSessions[id].html || '';
        CoreState.splitChatBId = id;
    } else {
        flow.innerHTML = '';
        CoreState.splitChatBId = null;
    }
}
function appendToChatB(role, text) {
    const flow = document.getElementById('chat-flow-b');
    if (!flow) return;
    if (role === 'user') {
        flow.insertAdjacentHTML('beforeend', `<div class="msg user-msg user-bubble"><div class="bubble-text">${escapeHtml(text)}</div></div>`);
    } else {
        {
            const el = createAiMessageElement(text);
            flow.appendChild(el);
            if (typeof enhanceAiMessageActions === 'function') enhanceAiMessageActions(el);
        }
    }
    flow.scrollTop = flow.scrollHeight;
    // persist if linked session
    if (CoreState.splitChatBId && chatSessions[CoreState.splitChatBId]) {
        chatSessions[CoreState.splitChatBId].html = flow.innerHTML;
        localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
    }
}
function sendMsgToChatB() {
    const ta = document.getElementById('user-input-b');
    const text = (ta?.value || '').trim();
    if (!text) return;
    if (ta) { ta.value = ''; ta.style.height = 'auto'; }
    appendToChatB('user', text);
    // local stub reply (same spirit as main mock AI)
    setTimeout(() => {
        appendToChatB('ai', 'Чат B: запрос получен — «' + text.slice(0, 80) + (text.length > 80 ? '…' : '') + '».');
    }, 400);
}
function sendMsgToAllSplitChats() {
    document.getElementById('send-all-ctx').style.display = 'none';
    if (!(CoreState.isSplitView && CoreState.splitMode === 'chat-chat')) {
        showToast('Только в режиме Два чата', 'info');
        return;
    }
    const main = document.getElementById('user-input');
    const text = (main?.value || document.getElementById('user-input-b')?.value || '').trim();
    if (!text) { showToast('Пустое сообщение', 'warning'); return; }
    if (main) main.value = text;
    if (typeof sendMsg === 'function') sendMsg();
    const tb = document.getElementById('user-input-b');
    if (tb) { tb.value = text; sendMsgToChatB(); }
    if (main) main.value = '';
    showToast('Отправлено в оба чата', 'success');
}
function showSendAllCtx(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!(CoreState.isSplitView && CoreState.splitMode === 'chat-chat')) return;
    const m = document.getElementById('send-all-ctx');
    if (!m) return;
    m.style.display = 'block';
    m.style.left = Math.min(e.clientX, window.innerWidth - 220) + 'px';
    m.style.top = Math.min(e.clientY, window.innerHeight - 60) + 'px';
}
document.addEventListener('click', () => {
    const m = document.getElementById('send-all-ctx');
    if (m) m.style.display = 'none';
});
document.addEventListener('DOMContentLoaded', () => {
    const send = document.getElementById('send-btn');
    if (send && !send.dataset.splitCtx) {
        send.dataset.splitCtx = '1';
        send.addEventListener('contextmenu', showSendAllCtx);
    }
});

function enterSplitViewWithMode(mode) {
    mode = mode || 'chat-reader';
    if (mode === 'chat-chat' && isMobileSplit()) {
        showToast('Два чата на телефоне недоступны', 'warning');
        mode = 'chat-reader';
    }
    CoreState.splitMode = mode;
    CoreState.isSplitView = true;
    document.body.classList.add('split-mode', CoreState.splitOrientation || 'horizontal');
    document.body.classList.remove('split-dual-chat');

    const leftPane = document.getElementById('split-pane-left');
    const rightPane = document.getElementById('split-pane-right');
    const chatScreen = document.getElementById('screen-chat');
    const readerScreen = document.getElementById('screen-reader');
    const notepadScreen = document.getElementById('screen-notepad');
    if (!leftPane || !rightPane || !chatScreen) return;

    let second = document.getElementById('screen-chat-b');
    if (!second) {
        second = document.createElement('main');
        second.id = 'screen-chat-b';
        second.className = 'app-screen';
        second.innerHTML = '<div class="section-title" id="chat-b-title">Второй чат</div><div id="chat-flow-b" class="chat-flow-box"></div>';
        document.querySelector('.oracle-container')?.appendChild(second);
    }

    // Detach all candidates so nothing overlaps outside panes
    [chatScreen, readerScreen, notepadScreen, second].forEach(el => {
        if (el && el.parentNode) el.parentNode.removeChild(el);
        el?.classList.remove('active-screen');
    });
    leftPane.innerHTML = '';
    rightPane.innerHTML = '';

    chatScreen.classList.add('active-screen');
    leftPane.appendChild(chatScreen);

    if (mode === 'chat-notepad' && notepadScreen) {
        notepadScreen.classList.add('active-screen');
        rightPane.appendChild(notepadScreen);
        loadNotepadCode();
        fillSplitNpProjectMenu();
        if (typeof loadNotepadCode === 'function') loadNotepadCode();
        const sn = document.getElementById('split-story-name');
        if (sn) sn.textContent = 'Notepad';
        // park others back in container (hidden)
        const box = document.querySelector('.oracle-container');
        if (readerScreen) box?.appendChild(readerScreen);
        box?.appendChild(second);
    } else if (mode === 'chat-chat') {
        second.classList.add('active-screen');
        rightPane.appendChild(second);
        loadChatBSession(CoreState.splitChatBId);
        const titleB = document.getElementById('chat-b-title');
        const lab = (CoreState.splitChatBId && chatSessions[CoreState.splitChatBId])
            ? (chatSessions[CoreState.splitChatBId].title || 'Чат B')
            : 'Черновик B';
        if (titleB) titleB.textContent = lab;
        const sn = document.getElementById('split-story-name');
        if (sn) sn.textContent = lab;
        const box = document.querySelector('.oracle-container');
        if (readerScreen) box?.appendChild(readerScreen);
        if (notepadScreen) box?.appendChild(notepadScreen);
        setSplitDualInputs(true);
        ensureSplitInputB();
        syncSplitInputWidths();
    } else if (mode === 'chat-sidenotes') {
        const snScreen = ensureSideNotesScreen();
        snScreen.classList.add('active-screen');
        rightPane.appendChild(snScreen);
        renderSideNotesPanel(CoreState.sideNotesSessionId || currentSessionId);
        const sn = document.getElementById('split-story-name');
        if (sn) sn.textContent = 'Side Notes';
        const box = document.querySelector('.oracle-container');
        if (readerScreen) box?.appendChild(readerScreen);
        if (notepadScreen) box?.appendChild(notepadScreen);
        box?.appendChild(second);
        setSplitDualInputs(false);
    } else {
        if (CoreState.splitStoryId && storyBooks[CoreState.splitStoryId] && typeof openStoryBook === 'function') {
            openStoryBook(CoreState.splitStoryId);
        }
        if (readerScreen) {
            readerScreen.classList.add('active-screen');
            rightPane.appendChild(readerScreen);
        }
        const box = document.querySelector('.oracle-container');
        if (notepadScreen) box?.appendChild(notepadScreen);
        box?.appendChild(second);
        if (typeof updateSplitHeader === 'function') updateSplitHeader();
    }

    if (typeof applySplitRatio === 'function') applySplitRatio();
    if (typeof initSplitResizer === 'function') initSplitResizer();
    const cn = document.getElementById('split-chat-name');
    if (cn) cn.textContent = 'Chat';
    if (mode !== 'chat-chat') setSplitDualInputs(false);
    else { setSplitDualInputs(true); syncSplitInputWidths(); }
    showToast('Split: ' + (mode === 'chat-notepad' ? 'Chat + Notepad' : mode === 'chat-chat' ? 'Два чата' : mode === 'chat-sidenotes' ? 'Side Notes' : 'Chat + История'), 'success');
}


// patch exitSplitView to restore notepad
const _exitSplit = typeof exitSplitView === 'function' ? exitSplitView : null;
window.exitSplitView = function() {
    setSplitDualInputs(false);
    document.body.classList.remove('split-dual-chat');
    const ib = document.getElementById('split-input-b');
    if (ib) ib.style.display = 'none';
    persistSideNotesEditor();
    const sns = document.getElementById('screen-sidenotes');
    if (sns) {
        sns.classList.remove('active-screen');
        document.querySelector('.oracle-container')?.appendChild(sns);
    }

    const container = document.querySelector('.oracle-container');
    const notepadScreen = document.getElementById('screen-notepad');
    const second = document.getElementById('screen-chat-b');
    if (_exitSplit) _exitSplit();
    else {
        CoreState.isSplitView = false;
        document.body.classList.remove('split-mode', 'horizontal', 'vertical');
    }
    if (notepadScreen && container) {
        notepadScreen.classList.remove('active-screen');
        const input = document.getElementById('main-input-box');
        if (input) container.insertBefore(notepadScreen, input);
        else container.appendChild(notepadScreen);
    }
    if (second) second.classList.remove('active-screen');
};

document.addEventListener('DOMContentLoaded', loadNotepadCode);

document.addEventListener('click', (e) => {
    const p = document.getElementById('split-story-picker');
    if (p && p.classList.contains('open') && !p.contains(e.target)) p.classList.remove('open');
});


// ===== CHAT EMPTY: centered input =====
function updateChatEmptyState() {
    const chatFlow = document.getElementById('chat-flow');
    const hasMsgs = !!(chatFlow && chatFlow.querySelector('.msg, .user-msg, .ai-msg, .user-bubble'));
    const temp = document.body.classList.contains('temp-chat-mode');
    // empty if no messages
    if (hasMsgs) {
        document.body.classList.remove('chat-empty');
    } else {
        document.body.classList.add('chat-empty');
    }
    if (typeof updateWelcomeAmbient === 'function') updateWelcomeAmbient();
}

document.addEventListener('DOMContentLoaded', () => {
    updateChatEmptyState();
    const chatFlow = document.getElementById('chat-flow');
    if (chatFlow && typeof MutationObserver !== 'undefined') {
        new MutationObserver(() => updateChatEmptyState()).observe(chatFlow, { childList: true, subtree: true });
    }
});

// call after session load / new chat
const _origLoadChatSession = typeof loadChatSession === 'function' ? loadChatSession : null;
if (_origLoadChatSession) {
    window.loadChatSession = function(id) {
        _origLoadChatSession(id);
        setTimeout(updateChatEmptyState, 0);
    };
}
const _origCreateNew = typeof createNewChatSession === 'function' ? createNewChatSession : null;
if (_origCreateNew) {
    window.createNewChatSession = function() {
        _origCreateNew();
        setTimeout(updateChatEmptyState, 0);
    };
}

// ===== LIBRARY FULL TAB =====
const TEXT_EXTS = new Set(['txt','md','html','htm','css','js','mjs','cjs','json','svg','xml','csv','ts','tsx','jsx','py','rs','go','java','c','cpp','h','hpp','yaml','yml','toml','ini','log','sql','sh','bash','env','rtf']);
let libraryFilter = 'all';
let editingFileId = null;

function isTextFileName(name) {
    const ext = String(name || '').split('.').pop().toLowerCase();
    return TEXT_EXTS.has(ext);
}
function setLibraryFilter(f) {
    libraryFilter = f || 'all';
    document.querySelectorAll('.lib-filter').forEach(b => b.classList.toggle('active', b.dataset.filter === libraryFilter));
    renderLibraryScreen();
}
function getFileLibrary() {
    try {
        if (typeof loadFileLibrary === 'function') return loadFileLibrary() || [];
        return JSON.parse(localStorage.getItem('oracle_file_library') || '[]') || [];
    } catch(e) { return []; }
}
function setFileLibrary(list) {
    localStorage.setItem('oracle_file_library', JSON.stringify(list || []));
    if (typeof saveFileLibrary === 'function') { try { saveFileLibrary(list); } catch(e) {} }
}
function syncLibraryMemoryLabels() {
    const src = document.getElementById('memory-used-label');
    const bar = document.getElementById('memory-bar');
    const lab = document.getElementById('library-screen-memory-label');
    const bar2 = document.getElementById('library-screen-memory-bar');
    if (src && lab) lab.textContent = src.textContent;
    if (bar && bar2) bar2.style.width = bar.style.width || '0%';
}
function refreshLibraryUI() {
    if (typeof updateMemoryUI === 'function') updateMemoryUI();
    if (typeof renderLibraryFiles === 'function') renderLibraryFiles();
    renderLibraryScreen();
    syncLibraryMemoryLabels();
}
function renderLibraryScreen() {
    const box = document.getElementById('library-screen-files');
    const empty = document.getElementById('library-screen-empty');
    if (!box) return;
    let files = getFileLibrary();
    if (libraryFilter === 'text') files = files.filter(f => isTextFileName(f.name));
    if (libraryFilter === 'other') files = files.filter(f => !isTextFileName(f.name));
    box.innerHTML = '';
    if (!files.length) {
        if (empty) empty.style.display = 'block';
        syncLibraryMemoryLabels();
        return;
    }
    if (empty) empty.style.display = 'none';
    files.forEach(f => {
        const row = document.createElement('div');
        row.className = 'library-file-row';
        const text = isTextFileName(f.name);
        const id = String(f.id).replace(/'/g, '');
        row.innerHTML = `
            <div class="library-file-info">
                <div class="library-file-name">${escapeHtml(f.name || 'file')}</div>
                <div class="library-file-meta">${(f.sizeMB != null ? f.sizeMB : 0)} МБ${f.sessionId ? ' · чат' : ''}</div>
            </div>
            <div class="library-file-actions">
                ${text ? `<button type="button" class="lib-act-btn" title="Редактировать" onclick="openFileEditor('${id}')"><span class="material-symbols-rounded">edit</span></button>` : ''}
                <button type="button" class="lib-act-btn" title="В чат" onclick="attachLibraryFileToChat('${id}')"><span class="material-symbols-rounded">add_link</span></button>
                <button type="button" class="lib-act-btn danger" title="Удалить" onclick="deleteLibraryFile('${id}', true)"><span class="material-symbols-rounded">delete</span></button>
            </div>`;
        box.appendChild(row);
    });
    syncLibraryMemoryLabels();
}
function openFileEditor(fileId) {
    const files = getFileLibrary();
    const f = files.find(x => String(x.id) === String(fileId));
    if (!f) { showToast('Файл не найден', 'error'); return; }
    if (!isTextFileName(f.name)) { showToast('Только текстовые файлы', 'warning'); return; }
    editingFileId = f.id;
    document.getElementById('file-editor-title').textContent = f.name || 'Файл';
    document.getElementById('file-editor-meta').textContent = 'Сохранение только в библиотеке браузера';
    document.getElementById('file-editor-textarea').value = f.content || f.text || '';
    document.getElementById('file-editor-modal')?.classList.add('active');
}
function closeFileEditor() {
    editingFileId = null;
    document.getElementById('file-editor-modal')?.classList.remove('active');
}
function saveFileEditor() {
    if (editingFileId == null) return;
    const content = document.getElementById('file-editor-textarea')?.value ?? '';
    const files = getFileLibrary();
    const i = files.findIndex(x => String(x.id) === String(editingFileId));
    if (i < 0) { showToast('Файл не найден', 'error'); return; }
    const bytes = new Blob([content]).size;
    files[i].content = content;
    files[i].text = content;
    files[i].sizeMB = Math.max(0.001, +(bytes / (1024 * 1024)).toFixed(3));
    files[i].updatedAt = Date.now();
    setFileLibrary(files);
    closeFileEditor();
    refreshLibraryUI();
    showToast('Файл сохранён в библиотеке', 'success');
}
function openAttachFromLibrary() {
    try {
        if (typeof canSendMessage === 'function' && canSendMessage() === false) {
            showToast('Лимит запросов исчерпан — из библиотеки тоже нельзя', 'warning');
            return;
        }
    } catch(e) {}
    const list = document.getElementById('attach-from-lib-list');
    if (!list) return;
    const files = getFileLibrary();
    if (!files.length) {
        list.innerHTML = '<div style="font-size:13px;color:var(--on-surface-variant);padding:12px;">Библиотека пуста</div>';
    } else {
        list.innerHTML = files.map(f => {
            const id = String(f.id).replace(/'/g, '');
            return `<button type="button" class="plus-menu-item" style="border:1px solid var(--border);" onclick="attachLibraryFileToChat('${id}'); closeAttachFromLib();">
                <span class="material-symbols-rounded">${isTextFileName(f.name)?'description':'draft'}</span>
                <span style="text-align:left;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(f.name||'file')}</span>
            </button>`;
        }).join('');
    }
    document.getElementById('attach-from-lib-modal')?.classList.add('active');
}
function closeAttachFromLib() {
    document.getElementById('attach-from-lib-modal')?.classList.remove('active');
}
function attachLibraryFileToChat(fileId) {
    const files = getFileLibrary();
    const f = files.find(x => String(x.id) === String(fileId));
    if (!f) { showToast('Файл не найден', 'error'); return; }
    try { if (typeof trackMessageUsage === 'function') trackMessageUsage(); } catch(e) {}
    const sid = typeof currentSessionId !== 'undefined' ? currentSessionId : null;
    if (sid) {
        const all = getFileLibrary();
        const i = all.findIndex(x => String(x.id) === String(fileId));
        if (i >= 0) { all[i].sessionId = sid; setFileLibrary(all); }
    }
    const input = document.getElementById('user-input');
    const tag = `[Файл из библиотеки: ${f.name}]`;
    if (input) {
        input.value = (input.value ? input.value + '\\n' : '') + tag;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof handleInput === 'function') handleInput(input);
    }
    showToast('Прикреплено: ' + (f.name || ''), 'success');
    switchScreen('chat');
}
function deleteLibraryFile(fileId, confirmFirst) {
    const run = () => {
        let files = getFileLibrary().filter(x => String(x.id) !== String(fileId));
        setFileLibrary(files);
        refreshLibraryUI();
        showToast('Файл удалён', 'success');
    };
    if (confirmFirst) {
        showCustomModal('Удалить файл?', 'Файл будет удалён из библиотеки. ИИ может путаться в деталях без повторной отправки документа.', false, '', (ok) => { if (ok) run(); });
    } else run();
}

// switchScreen must show library
const _switchScreenLib = typeof switchScreen === 'function' ? switchScreen : null;
if (_switchScreenLib) {
    window.switchScreen = function(id) {
        _switchScreenLib(id);
        if (id === 'library' && typeof refreshLibraryUI === 'function') refreshLibraryUI();
        // ensure screen-library gets active if base switch only knows chat/reader/settings
        const lib = document.getElementById('screen-library');
        if (id === 'library' && lib) {
            document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active-screen'));
            lib.classList.add('active-screen');
            document.body.classList.remove('chat-active');
            const input = document.getElementById('main-input-box');
            if (input) input.style.display = 'none';
        } else if (id === 'chat') {
            const input = document.getElementById('main-input-box');
            if (input) input.style.display = '';
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof refreshLibraryUI === 'function') refreshLibraryUI();
});


// ===== SIMPLER PLANS =====
let planNotifyMins = 10;
let planColor = '';

function togglePlanNotifyMenu(e) {
    e?.stopPropagation();
    document.getElementById('plan-notify-picker')?.classList.toggle('open');
}
function pickPlanNotify(mins, label) {
    planNotifyMins = Math.min(120, Math.max(0, Number(mins) || 0));
    const lab = document.getElementById('plan-notify-label');
    if (lab) lab.textContent = label || (planNotifyMins + ' мин');
    document.getElementById('plan-notify-picker')?.classList.remove('open');
    document.querySelectorAll('#plan-notify-menu .custom-select-option').forEach(o => o.classList.remove('active'));
}
function pickPlanColor(btn) {
    document.querySelectorAll('#plan-color-swatches .color-swatch').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    planColor = btn.dataset.color || '';
}
function addPlanFromForm() {
    const title = (document.getElementById('plan-title')?.value || '').trim();
    const dt = document.getElementById('plan-datetime')?.value;
    if (!title) { showToast('Укажите название', 'warning'); return; }
    if (!dt) { showToast('Укажите дату и время', 'warning'); return; }
    const d = new Date(dt);
    if (isNaN(d.getTime())) { showToast('Некорректная дата', 'error'); return; }
    const now = new Date();
    const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // allow today and future; block past days for new reminders
    if (dayOnly < today0) {
        showToast('На прошедшие дни напоминания нельзя', 'warning');
        return;
    }
    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    const id = 'rem_' + Date.now();
    reminders.push({
        id,
        date: key,
        time: timeStr,
        text: title,
        title,
        notifyBefore: planNotifyMins,
        color: planColor || '',
        notified: false
    });
    saveReminders();
    renderCalendar();
    renderRemindersList();
    document.getElementById('plan-title').value = '';
    showToast('Напоминание добавлено', 'success');
    schedulePlanNotifications();
}

// enhance calendar cells with color
const _renderCalOrig = typeof renderCalendar === 'function' ? renderCalendar : null;
if (_renderCalOrig) {
    // leave original; color applied in list and via has-color after render
}

function renderRemindersList() {
    const list = document.getElementById('reminders-list');
    if (!list) return;
    if (!reminders.length) {
        list.innerHTML = '<div style="font-size:13px;color:var(--on-surface-variant);padding:8px;">Пока нет активных планов</div>';
        return;
    }
    const sorted = [...reminders].sort((a,b) => String(a.date+a.time).localeCompare(String(b.date+b.time)));
    list.innerHTML = sorted.map(r => {
        const col = r.color ? `<span class="reminder-color-dot" style="background:${r.color}"></span>` : '';
        return `<div class="chat-card" style="padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div>
                <div style="font-weight:600;font-size:13px;">${col} ${escapeHtml(r.title || r.text || '')}</div>
                <div style="font-size:11px;color:var(--on-surface-variant);margin-top:4px;">${r.date} · ${r.time || '--:--'} · за ${r.notifyBefore ?? 10} мин</div>
            </div>
            <div style="display:flex;gap:4px;">
                <button class="icon-btn" onclick="editReminder('${r.id}')" title="Изменить"><span class="material-symbols-rounded" style="font-size:18px;">edit</span></button>
                <button class="icon-btn" onclick="deleteReminder('${r.id}')" title="Удалить"><span class="material-symbols-rounded" style="font-size:18px;">delete</span></button>
            </div>
        </div>`;
    }).join('');
}

function schedulePlanNotifications() {
    if (localStorage.getItem('oracle_notif_master') !== 'true') return;
    if (localStorage.getItem('oracle_notif_plans') !== 'true') return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    // lightweight check interval already possible via setInterval once
}
setInterval(() => {
    try {
        if (localStorage.getItem('oracle_notif_master') !== 'true') return;
        if (localStorage.getItem('oracle_notif_plans') !== 'true') return;
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const now = Date.now();
        reminders.forEach(r => {
            if (r.notified) return;
            const [y,m,d] = (r.date || '').split('-').map(Number);
            const [hh,mm] = (r.time || '09:00').split(':').map(Number);
            if (!y) return;
            const target = new Date(y, m-1, d, hh||0, mm||0).getTime();
            const fireAt = target - (Number(r.notifyBefore)||0) * 60000;
            if (now >= fireAt && now < target + 60000) {
                r.notified = true;
                saveReminders();
                new Notification('План: ' + (r.title || r.text || ''), { body: `Событие в ${r.time || ''}`, silent: false });
            }
        });
    } catch(e) {}
}, 30000);

// ===== AI ACTION BAR =====
function buildAiActions(text) {
    const safe = String(text || '').replace(/`/g, '\\`').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `<div class="ai-actions">
        <button type="button" class="ai-act-btn" title="Копировать" onclick="copyAiText(this)"><span class="material-symbols-rounded">content_copy</span></button>
        <button type="button" class="ai-act-btn ai-act-like" title="Нравится" onclick="rateAi(this,1)"><span class="material-symbols-rounded">thumb_up</span></button>
        <button type="button" class="ai-act-btn ai-act-dislike" title="Не нравится" onclick="rateAi(this,0)"><span class="material-symbols-rounded">thumb_down</span></button>
        <button type="button" class="ai-act-btn" title="Повторить" onclick="retryLastUser()"><span class="material-symbols-rounded">refresh</span></button>
        <button type="button" class="ai-act-btn" title="Прочесть вслух" onclick="speakAi(this)"><span class="material-symbols-rounded">volume_up</span></button>
        <button type="button" class="ai-act-btn" title="Ветка в новом чате" onclick="branchFromAi(this)"><span class="material-symbols-rounded">call_split</span></button>
    </div>`;
}
function copyAiText(btn) {
    const msg = btn.closest('.msg');
    const t = msg?.innerText || '';
    navigator.clipboard?.writeText(t).then(() => showToast('Скопировано', 'success')).catch(() => showToast('Не удалось', 'error'));
}
function rateAi(btn, v) {
    showToast(v ? 'Спасибо за оценку' : 'Учтём', 'success');
}
function speakAi(btn) {
    const msg = btn.closest('.msg');
    const t = msg?.cloneNode(true);
    t?.querySelector('.ai-actions')?.remove();
    const text = t?.innerText || '';
    if (!window.speechSynthesis) { showToast('Синтез речи недоступен', 'warning'); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
}
function branchFromAi(btn) {
    const msg = btn.closest('.msg');
    const t = msg?.cloneNode(true);
    t?.querySelector('.ai-actions')?.remove();
    createNewChatSession();
    const flow = document.getElementById('chat-flow');
    if (flow) {
        flow.innerHTML += `<div class="msg ai-msg system-note">Ветка от предыдущего ответа</div>`;
        flow.innerHTML += `<div class="msg ai-msg">${t?.innerHTML || ''}</div>`;
    }
    showToast('Новая ветка', 'success');
}
function retryLastUser() {
    const users = document.querySelectorAll('.msg.user-msg, .user-bubble');
    const last = users[users.length - 1];
    if (!last) return;
    const text = last.querySelector('.bubble-text')?.innerText || last.innerText || '';
    const input = document.getElementById('user-input');
    if (input) { input.value = text.trim(); handleInput(input); sendMsg(); }
}

// Patch AI message creation to include actions — override end of streaming append
const _aiAppendHook = true;

// ===== SAVE TEMP CHAT =====
function showTempChatCtx(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!CoreState.isTempChat) {
        showToast('Сначала включите временный чат', 'info');
        return;
    }
    const m = document.getElementById('temp-ctx-menu');
    if (!m) return;
    m.style.display = 'block';
    m.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
    m.style.top = Math.min(e.clientY, window.innerHeight - 80) + 'px';
}
document.addEventListener('click', () => {
    const m = document.getElementById('temp-ctx-menu');
    if (m) m.style.display = 'none';
});
function openSaveTempModal() {
    document.getElementById('temp-ctx-menu').style.display = 'none';
    if (!CoreState.isTempChat) return;
    document.getElementById('save-temp-modal')?.classList.add('active');
}
function closeSaveTempModal() {
    document.getElementById('save-temp-modal')?.classList.remove('active');
}
function confirmSaveTempChat() {
    const mode = document.querySelector('input[name="temp-save-mode"]:checked')?.value || 'with';
    const chatFlow = document.getElementById('chat-flow');
    const html = chatFlow ? chatFlow.innerHTML : '';
    const id = 'session_' + Date.now();
    chatSessions[id] = {
        title: 'Из временного',
        html,
        personalization: mode === 'with'
    };
    currentSessionId = id;
    localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
    localStorage.setItem('oracle_current_session', id);
    CoreState.isTempChat = false;
    document.body.classList.remove('temp-chat-mode');
    document.getElementById('temp-chat-btn')?.classList.remove('active');
    CoreState.savedChatHTML = null;
    if (typeof renderSidebarChats === 'function') renderSidebarChats();
    closeSaveTempModal();
    showToast(mode === 'with' ? 'Сохранено с персонализацией' : 'Сохранено без персонализации', 'success');
}

// ===== PIN / SECURITY =====
let pinModalMode = 'set'; // set | change | unlock
function openSetPinModal() {
    const has = !!localStorage.getItem('oracle_pin_hash');
    pinModalMode = has ? 'change' : 'set';
    document.getElementById('pin-modal-title').textContent = has ? 'Изменить PIN' : 'Создать PIN';
    document.getElementById('pin-modal-text').textContent = has
        ? 'Введите текущий PIN, затем новый во втором поле.'
        : 'Придумайте PIN (мин. 4). Если забудете — только сброс данных Core Node.';
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-input-2').style.display = 'block';
    document.getElementById('pin-input-2').value = '';
    document.getElementById('pin-input').placeholder = has ? 'Текущий PIN' : 'Новый PIN';
    const note = document.getElementById('pin-local-note');
    if (note) note.style.display = 'none';
    document.getElementById('pin-cancel-btn') && (document.getElementById('pin-cancel-btn').style.display = 'inline-flex');
    document.getElementById('pin-reset-btn') && (document.getElementById('pin-reset-btn').style.display = 'none');
    document.getElementById('pin-modal')?.classList.remove('pin-unlock-mode');
    document.body.classList.remove('pin-locked');
    document.getElementById('pin-modal')?.classList.add('active');
}

function closePinModal() {
    if (pinModalMode === 'unlock') {
        showToast('Нужен PIN или сброс данных', 'warning');
        return;
    }
    document.getElementById('pin-modal')?.classList.remove('active', 'pin-unlock-mode');
    document.body.classList.remove('pin-locked');
}
function simpleHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return 'h' + h;
}
function submitPinModal() {
    const a = document.getElementById('pin-input')?.value || '';
    const b = document.getElementById('pin-input-2')?.value || '';
    if (pinModalMode === 'set') {
        if (a.length < 4) { showToast('Минимум 4 символа', 'warning'); return; }
        if (a !== b) { showToast('PIN не совпадает', 'error'); return; }
        localStorage.setItem('oracle_pin_hash', simpleHash(a));
        closePinModal();
        updatePinStatusUI();
        showToast('PIN сохранён', 'success');
        return;
    }
    if (pinModalMode === 'change') {
        const cur = localStorage.getItem('oracle_pin_hash');
        if (simpleHash(a) !== cur) { showToast('Неверный текущий PIN', 'error'); return; }
        if (b.length < 4) { showToast('Новый PIN: минимум 4', 'warning'); return; }
        // second field is new pin in change mode
        localStorage.setItem('oracle_pin_hash', simpleHash(b));
        closePinModal();
        updatePinStatusUI();
        showToast('PIN изменён', 'success');
        return;
    }
    if (pinModalMode === 'unlock') {
        if (simpleHash(a) === localStorage.getItem('oracle_pin_hash')) {
            sessionStorage.setItem('oracle_pin_ok', '1');
            pinModalMode = 'set'; // allow close
            document.getElementById('pin-modal')?.classList.remove('active', 'pin-unlock-mode');
            document.body.classList.remove('pin-locked');
            showToast('Доступ разрешён', 'success');
        } else showToast('Неверный PIN', 'error');
        return;
    }
}
function updatePinStatusUI() {
    const has = !!localStorage.getItem('oracle_pin_hash');
    const el = document.getElementById('pin-status-label');
    if (el) el.textContent = has ? 'PIN задан' : 'Пароль не задан';
    ['oracle_pin_on_entry','oracle_pin_on_screensaver','oracle_safe_search'].forEach((k,i) => {
        const ids = ['pin-on-entry-btn','pin-on-screensaver-btn','safe-search-btn'];
        syncToggleBtn(ids[i], localStorage.getItem(k) === 'true');
    });
}
function togglePinFlag(key, btnId) {
    const on = localStorage.getItem(key) !== 'true';
    localStorage.setItem(key, on ? 'true' : 'false');
    syncToggleBtn(btnId, on);
    showToast(on ? 'Включено' : 'Выключено', 'success');
}
function syncToggleBtn(id, on) {
    const b = document.getElementById(id);
    if (!b) return;
    b.innerText = on ? 'ВКЛ' : 'ВЫКЛ';
    b.style.background = on ? 'var(--primary-container)' : 'var(--surface-variant)';
    b.style.color = on ? 'var(--primary)' : 'var(--on-surface)';
}
function maybeAskPinOnEntry() {
    if (localStorage.getItem('oracle_pin_on_entry') !== 'true') return;
    if (!localStorage.getItem('oracle_pin_hash')) return;
    if (sessionStorage.getItem('oracle_pin_ok') === '1') return;
    pinModalMode = 'unlock';
    const title = document.getElementById('pin-modal-title');
    const text = document.getElementById('pin-modal-text');
    if (title) title.textContent = 'Вход';
    if (text) text.textContent = 'Введите PIN, чтобы открыть Core Node';
    const i2 = document.getElementById('pin-input-2');
    if (i2) i2.style.display = 'none';
    const inp = document.getElementById('pin-input');
    if (inp) { inp.value = ''; inp.placeholder = 'PIN'; }
    const modal = document.getElementById('pin-modal');
    const cancel = document.getElementById('pin-cancel-btn');
    const reset = document.getElementById('pin-reset-btn');
    const note = document.getElementById('pin-local-note');
    if (modal) modal.classList.add('pin-unlock-mode');
    if (cancel) cancel.style.display = 'none';
    if (reset) reset.style.display = 'inline-flex';
    if (note) note.style.display = 'block';
    document.body.classList.add('pin-locked');
    modal?.classList.add('active');
    setTimeout(() => inp?.focus(), 80);
}

// ===== NOTIFICATIONS SETTINGS =====
function toggleNotifFlag(key, btnId) {
    if (key === 'oracle_notif_plans' && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        showToast('Сначала разрешите уведомления сайта', 'warning');
        return;
    }
    const on = localStorage.getItem(key) !== 'true';
    localStorage.setItem(key, on ? 'true' : 'false');
    syncToggleBtn(btnId, on);
}
function toggleNotifMaster() {
    const on = localStorage.getItem('oracle_notif_master') !== 'true';
    localStorage.setItem('oracle_notif_master', on ? 'true' : 'false');
    syncToggleBtn('notif-master-btn', on);
    if (on) {
        ['oracle_notif_plans','oracle_notif_limits','oracle_notif_toasts'].forEach((k,i) => {
            localStorage.setItem(k, 'true');
            syncToggleBtn(['notif-plans-btn','notif-limits-btn','notif-toasts-btn'][i], true);
        });
    } else {
        ['oracle_notif_plans','oracle_notif_limits','oracle_notif_toasts'].forEach((k,i) => {
            localStorage.setItem(k, 'false');
            syncToggleBtn(['notif-plans-btn','notif-limits-btn','notif-toasts-btn'][i], false);
        });
    }
}
function requestBrowserNotifyPermission() {
    if (typeof Notification === 'undefined') {
        showToast('Браузер не поддерживает Notification API', 'error');
        return;
    }
    Notification.requestPermission().then(p => {
        const hint = document.getElementById('notif-plans-hint');
        if (hint) hint.textContent = p === 'granted' ? 'Разрешение получено' : (p === 'denied' ? 'Запрещено в браузере' : 'Ожидание разрешения');
        showToast(p === 'granted' ? 'Уведомления разрешены' : 'Разрешение не выдано', p === 'granted' ? 'success' : 'warning');
    });
}
function refreshNotifUI() {
    syncToggleBtn('notif-master-btn', localStorage.getItem('oracle_notif_master') === 'true');
    syncToggleBtn('notif-plans-btn', localStorage.getItem('oracle_notif_plans') === 'true');
    syncToggleBtn('notif-limits-btn', localStorage.getItem('oracle_notif_limits') === 'true');
    const toastsOn = localStorage.getItem('oracle_notif_toasts') !== 'false';
    if (localStorage.getItem('oracle_notif_toasts') == null) localStorage.setItem('oracle_notif_toasts', 'true');
    syncToggleBtn('notif-toasts-btn', toastsOn);
    const hint = document.getElementById('notif-plans-hint');
    if (hint && typeof Notification !== 'undefined') {
        hint.textContent = Notification.permission === 'granted' ? 'Разрешение получено' :
            Notification.permission === 'denied' ? 'Отключено в браузере — тумблер недоступен' : 'Требуется разрешение браузера';
    }
}

// titles for mobile settings
const _showSectionTitles = typeof showSection === 'function';
if (_showSectionTitles) {
    const _ss = showSection;
    window.showSection = function(sectionId) {
        _ss(sectionId);
        if (sectionId === 'notifications') refreshNotifUI();
        if (sectionId === 'security') updatePinStatusUI();
        const titleEl = document.getElementById('settings-mobile-title');
        if (titleEl && sectionId === 'notifications') titleEl.textContent = 'Уведомления';
    };
}

document.addEventListener('DOMContentLoaded', () => {
    updatePinStatusUI();
    refreshNotifUI();
    maybeAskPinOnEntry();
    if (typeof renderRemindersList === 'function') renderRemindersList();
    // default datetime min = now
    const dt = document.getElementById('plan-datetime');
    if (dt) {
        const n = new Date();
        n.setMinutes(n.getMinutes() - n.getTimezoneOffset());
        dt.min = n.toISOString().slice(0,16);
    }
});

// Inject AI actions when ai messages are appended without them
(function patchAiActionsObserver() {
    document.addEventListener('DOMContentLoaded', () => {
        const flow = document.getElementById('chat-flow');
        if (!flow || !window.MutationObserver) return;
        new MutationObserver((muts) => {
            muts.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    if (node.classList?.contains('ai-msg') && !node.querySelector('.ai-actions')) {
                        node.insertAdjacentHTML('beforeend', buildAiActions());
                    }
                    node.querySelectorAll?.('.ai-msg').forEach(el => {
                        if (!el.querySelector('.ai-actions')) el.insertAdjacentHTML('beforeend', buildAiActions());
                    });
                });
            });
        }).observe(flow, { childList: true, subtree: true });
    });
})();

// ===== ATTACHMENT CHIPS =====
let pendingAttachments = [];

function renderAttachChips() {
    const box = document.getElementById('attach-chips');
    const inputBox = document.getElementById('main-input-box');
    if (!box) return;
    if (!pendingAttachments.length) {
        box.style.display = 'none';
        box.innerHTML = '';
        document.body.classList.remove('has-attachments');
        return;
    }
    document.body.classList.add('has-attachments');
    box.style.display = 'flex';
    box.innerHTML = pendingAttachments.map((f, i) => `
        <div class="attach-chip" title="${escapeHtml(f.name || 'file')}">
            <span class="material-symbols-rounded">draft</span>
            <span class="chip-name">${escapeHtml(f.name || 'файл')}</span>
            <button type="button" class="chip-x" onclick="removePendingAttach(${i})" aria-label="Убрать">
                <span class="material-symbols-rounded" style="font-size:16px;">close</span>
            </button>
        </div>
    `).join('');
}
function removePendingAttach(idx) {
    pendingAttachments.splice(idx, 1);
    renderAttachChips();
}
function clearPendingAttaches() {
    pendingAttachments = [];
    renderAttachChips();
}

const _handleFileUploadOrig = typeof handleFileUpload === 'function' ? handleFileUpload : null;
window.handleFileUpload = function(input) {
    const files = input?.files ? Array.from(input.files) : [];
    files.forEach(file => {
        pendingAttachments.push({
            id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
            name: file.name,
            size: file.size,
            type: file.type,
            file
        });
        // also try library path if original exists
        if (_handleFileUploadOrig) {
            try {
                const dt = new DataTransfer();
                dt.items.add(file);
                const fake = { files: dt.files, value: '' };
                // call original for library storage without wiping our chips
                _handleFileUploadOrig({ files: dt.files, value: '' });
            } catch (e) {}
        }
    });
    if (input) input.value = '';
    renderAttachChips();
    showToast(files.length ? ('Файл: ' + files[0].name) : 'Файл', 'success');
};

// After send, clear chips
const _sendMsgChips = typeof sendMsg === 'function' ? sendMsg : null;
if (_sendMsgChips) {
    window.sendMsg = function() {
        const result = _sendMsgChips.apply(this, arguments);
        // clear after short delay so message can reference names
        setTimeout(() => clearPendingAttaches(), 50);
        return result;
    };
}

function updateInputLayoutFromText() {
    const input = document.getElementById('user-input');
    const box = document.getElementById('main-input-box');
    if (!input || !box) return;
    const lines = (input.value || '').split('\n').length;
    const tall = lines > 2 || (input.value || '').length > 120;
    box.classList.toggle('input-tall', tall && document.body.classList.contains('chat-empty'));
    // auto height
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
}
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input');
    const box = document.getElementById('main-input-box');
    if (input) {
        input.addEventListener('input', updateInputLayoutFromText);
        input.addEventListener('focus', () => box?.classList.add('input-expanded'));
        input.addEventListener('blur', () => {
            if (!(input.value || '').trim()) box?.classList.remove('input-expanded');
        });
    }
});

function openResetPinConfirm() {
    document.getElementById('reset-pin-modal')?.classList.add('active');
}
function closeResetPinConfirm() {
    document.getElementById('reset-pin-modal')?.classList.remove('active');
}
function confirmResetPinAndData() {
    const keep = ['oracle_consent', 'oracle_onboarding_done'];
    Object.keys(localStorage).forEach(k => {
        if (k.startsWith('oracle_') && !keep.includes(k)) localStorage.removeItem(k);
    });
    sessionStorage.clear();
    closeResetPinConfirm();
    closePinModal();
    showToast('Данные сброшены. Перезагрузка…', 'warning');
    setTimeout(() => location.reload(), 800);
}
// show reset only in unlock mode
// also when opening unlock manually
// ===== PLAN MODAL =====
let planModalState = { mode: 'create', editId: null, notify: 10, color: '' };

function openPlanModal(opts) {
    opts = opts || {};
    planModalState.mode = opts.mode || 'create';
    planModalState.editId = opts.reminder ? opts.reminder.id : null;
    planModalState.notify = opts.reminder ? (opts.reminder.notifyBefore ?? 10) : 10;
    planModalState.color = opts.reminder ? (opts.reminder.color || '') : '';

    const titleEl = document.getElementById('plan-modal-title');
    if (titleEl) titleEl.textContent = planModalState.mode === 'edit' ? 'Изменить напоминание' : 'Новое напоминание';

    const name = document.getElementById('plan-modal-title-input');
    const dt = document.getElementById('plan-modal-datetime');
    if (name) name.value = opts.reminder ? (opts.reminder.title || opts.reminder.text || '') : '';

    if (dt) {
        let d;
        if (opts.reminder && opts.reminder.date) {
            const [y,m,day] = opts.reminder.date.split('-').map(Number);
            const [hh,mm] = (opts.reminder.time || '09:00').split(':').map(Number);
            d = new Date(y, m-1, day, hh||9, mm||0);
        } else if (opts.dateKey) {
            const [y,m,day] = opts.dateKey.split('-').map(Number);
            d = new Date(y, m-1, day, 9, 0);
        } else {
            d = new Date();
            d.setMinutes(d.getMinutes() + 30);
        }
        const local = new Date(d.getTime() - d.getTimezoneOffset()*60000);
        dt.value = local.toISOString().slice(0, 16);
        const minD = new Date();
        minD.setMinutes(minD.getMinutes() - minD.getTimezoneOffset());
        dt.min = minD.toISOString().slice(0, 16);
    }

    const labels = {0:'В момент',5:'5 минут',10:'10 минут',15:'15 минут',20:'20 минут',30:'30 минут',60:'1 час',90:'1.5 часа',120:'2 часа'};
    const lab = document.getElementById('plan-modal-notify-label');
    if (lab) lab.textContent = labels[planModalState.notify] || (planModalState.notify + ' мин');

    document.querySelectorAll('#plan-modal-colors .color-swatch').forEach(b => {
        b.classList.toggle('active', (b.dataset.color || '') === (planModalState.color || ''));
    });

    document.getElementById('plan-modal')?.classList.add('active');
    setTimeout(() => name?.focus(), 50);
}
function closePlanModal() {
    document.getElementById('plan-modal')?.classList.remove('active');
    document.getElementById('plan-modal-notify-picker')?.classList.remove('open');
}
function togglePlanModalNotify(e) {
    e?.stopPropagation();
    document.getElementById('plan-modal-notify-picker')?.classList.toggle('open');
}
function pickPlanModalNotify(mins, label) {
    planModalState.notify = Math.min(120, Math.max(0, Number(mins)||0));
    const lab = document.getElementById('plan-modal-notify-label');
    if (lab) lab.textContent = label || (planModalState.notify + ' мин');
    document.getElementById('plan-modal-notify-picker')?.classList.remove('open');
}
function pickPlanModalColor(btn) {
    document.querySelectorAll('#plan-modal-colors .color-swatch').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    planModalState.color = btn.dataset.color || '';
}
function submitPlanModal() {
    const title = (document.getElementById('plan-modal-title-input')?.value || '').trim();
    const dtVal = document.getElementById('plan-modal-datetime')?.value;
    if (!title) { showToast('Укажите название', 'warning'); return; }
    if (!dtVal) { showToast('Укажите дату и время', 'warning'); return; }
    const d = new Date(dtVal);
    if (isNaN(d.getTime())) { showToast('Некорректная дата', 'error'); return; }
    const today0 = new Date(); today0.setHours(0,0,0,0);
    const day0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day0 < today0) { showToast('На прошедшие дни нельзя', 'warning'); return; }

    const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    const timeStr = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');

    if (planModalState.mode === 'edit' && planModalState.editId) {
        const r = reminders.find(x => x.id === planModalState.editId);
        if (r) {
            r.title = title; r.text = title; r.date = key; r.time = timeStr;
            r.notifyBefore = planModalState.notify; r.color = planModalState.color; r.notified = false;
        }
        showToast('Напоминание обновлено', 'success');
    } else {
        reminders.push({
            id: 'rem_' + Date.now(),
            date: key, time: timeStr, text: title, title,
            notifyBefore: planModalState.notify, color: planModalState.color || '', notified: false
        });
        showToast('Напоминание добавлено', 'success');
    }
    saveReminders();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderReminders === 'function') renderReminders();
    if (typeof renderRemindersList === 'function') renderRemindersList();
    closePlanModal();
}
document.addEventListener('click', (e) => {
    const p = document.getElementById('plan-modal-notify-picker');
    if (p && p.classList.contains('open') && !p.contains(e.target)) p.classList.remove('open');
});

function handlePinBackdrop(e) {
    if (e.target && e.target.id === 'pin-modal') {
        if (pinModalMode === 'unlock') return;
        closePinModal();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const pinIn = document.getElementById('pin-input');
    if (pinIn) {
        pinIn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); submitPinModal(); }
        });
    }
});


// ===== SIDEBAR STORIES (localStorage oracle_story_books) =====
function renderSidebarStories() {
    const list = document.getElementById('stories-list');
    if (!list) return;
    list.innerHTML = '';
    const ids = Object.keys(storyBooks || {});
    if (!ids.length) {
        list.innerHTML = '<div style="font-size:12px;color:var(--on-surface-variant);padding:8px 4px;">Нет историй — нажмите +</div>';
        return;
    }
    ids.forEach(id => {
        const book = storyBooks[id] || {};
        const item = document.createElement('div');
        item.className = 'chat-item-node' + (id === currentStoryId ? ' active-session' : '');
        item.dataset.storyId = id;
        item.dataset.itemType = 'story';
        item.onclick = () => openStoryBook(id);
        item.oncontextmenu = (e) => showContextMenu(e, item, 'story');
        item.innerHTML = `
            <span class="chat-title">${escapeHtml(book.title || 'Без названия')}</span>
            <span class="material-symbols-rounded" style="font-size:16px;color:var(--on-surface-variant);">auto_stories</span>
        `;
        list.appendChild(item);
    });
}

function saveCurrentStoryContent() {
    if (!currentStoryId || !storyBooks[currentStoryId]) return;
    const editor = document.getElementById('editor');
    if (!editor) return;
    storyBooks[currentStoryId].content = editor.innerHTML;
    localStorage.setItem('oracle_story_books', JSON.stringify(storyBooks));
}

function setupStoryEditorAutosave() {
    const editor = document.getElementById('editor');
    if (!editor || editor.dataset.autosaveBound === '1') return;
    editor.dataset.autosaveBound = '1';
    let t = null;
    const schedule = () => {
        clearTimeout(t);
        t = setTimeout(() => {
            saveCurrentStoryContent();
        }, 500);
    };
    editor.addEventListener('input', schedule);
    editor.addEventListener('blur', () => saveCurrentStoryContent());
}

// enhance openStoryBook to refresh sidebar highlight
const _openStoryBookBase = openStoryBook;
window.openStoryBook = function(id) {
    saveCurrentStoryContent();
    _openStoryBookBase(id);
    renderSidebarStories();
    setupStoryEditorAutosave();
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        storyBooks = JSON.parse(localStorage.getItem('oracle_story_books') || '{}') || {};
    } catch (e) { storyBooks = {}; }
    renderSidebarStories();
    setupStoryEditorAutosave();
    if (currentStoryId && storyBooks[currentStoryId]) {
        // don't force switch screen, just ensure list shows active
        renderSidebarStories();
    }
});



// ===== SCREENSAVER STYLE =====
function getScreensaverStylePref() {
    const v = localStorage.getItem('oracle_screensaver_style') || 'random';
    return ['random', 'rainbow', 'cyan'].includes(v) ? v : 'random';
}
function resolveScreensaverStyle() {
    const pref = getScreensaverStylePref();
    if (pref === 'random') {
        return Math.random() < 0.5 ? 'rainbow' : 'cyan';
    }
    return pref;
}
function applyScreensaverStyle(style) {
    const overlay = document.getElementById('screensaver-overlay');
    if (!overlay) return;
    overlay.classList.remove('ss-style-rainbow', 'ss-style-cyan');
    overlay.classList.add(style === 'cyan' ? 'ss-style-cyan' : 'ss-style-rainbow');
}
function toggleScreensaverStyleMenu(event) {
    if (event) event.stopPropagation();
    const picker = document.getElementById('screensaver-style-picker');
    if (picker) picker.classList.toggle('open');
    document.getElementById('screensaver-timeout-picker')?.classList.remove('open');
}
function selectScreensaverStyle(value) {
    const safe = ['random', 'rainbow', 'cyan'].includes(value) ? value : 'random';
    localStorage.setItem('oracle_screensaver_style', safe);
    const labels = { random: 'Рандом', rainbow: 'Радужные пузыри', cyan: 'True Black Cyan' };
    const label = document.getElementById('screensaver-style-label');
    if (label) label.textContent = labels[safe] || 'Рандом';
    const menu = document.getElementById('screensaver-style-menu');
    if (menu) {
        menu.querySelectorAll('.custom-select-option').forEach(o => {
            o.classList.toggle('active', o.dataset.value === safe);
        });
    }
    document.getElementById('screensaver-style-picker')?.classList.remove('open');
    showToast('Заставка: ' + (labels[safe] || safe), 'success');
}
function refreshScreensaverStyleUI() {
    const safe = getScreensaverStylePref();
    const labels = { random: 'Рандом', rainbow: 'Радужные пузыри', cyan: 'True Black Cyan' };
    const label = document.getElementById('screensaver-style-label');
    if (label) label.textContent = labels[safe] || 'Рандом';
    const menu = document.getElementById('screensaver-style-menu');
    if (menu) {
        menu.querySelectorAll('.custom-select-option').forEach(o => {
            o.classList.toggle('active', o.dataset.value === safe);
        });
    }
}

// ===== IDLE DIM (30 min default) =====
CoreState.idleDimTimer = null;
CoreState.idleDimMins = Number(localStorage.getItem('oracle_idle_dim_mins') || 30);

function resetIdleDimTimer() {
    clearTimeout(CoreState.idleDimTimer);
    if (document.body.classList.contains('idle-dimmed')) {
        document.body.classList.remove('idle-dimmed');
    }
    // don't dim while screensaver is showing
    const mins = CoreState.idleDimMins > 0 ? CoreState.idleDimMins : 30;
    CoreState.idleDimTimer = setTimeout(() => {
        if (CoreState.isScreensaverActive) return;
        document.body.classList.add('idle-dimmed');
    }, mins * 60 * 1000);
}

['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'pointerdown'].forEach(evt => {
    window.addEventListener(evt, () => {
        if (document.body.classList.contains('idle-dimmed') || CoreState.idleDimTimer) {
            resetIdleDimTimer();
        }
    }, { passive: true });
});

document.addEventListener('DOMContentLoaded', () => {
    resetIdleDimTimer();
});


// ===== SIDE NOTES (per chat) =====
function getSideNotesMap() {
    try { return JSON.parse(localStorage.getItem('oracle_side_notes') || '{}') || {}; }
    catch (e) { return {}; }
}
function saveSideNotesMap(map) {
    localStorage.setItem('oracle_side_notes', JSON.stringify(map));
}
function getSideNotesForChat(sessionId) {
    const map = getSideNotesMap();
    const id = sessionId || currentSessionId || 'default';
    return map[id] || { text: '', ai: [] };
}
function setSideNotesForChat(sessionId, data) {
    const map = getSideNotesMap();
    const id = sessionId || currentSessionId || 'default';
    map[id] = data;
    saveSideNotesMap(map);
}
function ensureSideNotesScreen() {
    let el = document.getElementById('screen-sidenotes');
    if (el) return el;
    el = document.createElement('main');
    el.id = 'screen-sidenotes';
    el.className = 'app-screen';
    el.innerHTML = `
        <div class="sidenotes-head">
            <h3><span class="material-symbols-rounded">sticky_note_2</span> Side Notes</h3>
            <button type="button" class="icon-btn" onclick="clearCurrentSideNotes()" title="Очистить"><span class="material-symbols-rounded">delete</span></button>
        </div>
        <div class="sidenotes-meta" id="sidenotes-chat-label">Чат: —</div>
        <textarea id="sidenotes-editor" placeholder="Заметки к этому чату… Editable. ИИ тоже может дописывать контекст сюда."></textarea>
        <div class="sidenotes-ai-log" id="sidenotes-ai-log"></div>
    `;
    document.querySelector('.oracle-container')?.appendChild(el);
    const ed = el.querySelector('#sidenotes-editor');
    if (ed && !ed.dataset.bound) {
        ed.dataset.bound = '1';
        let t = null;
        ed.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => persistSideNotesEditor(), 400);
        });
    }
    return el;
}
function persistSideNotesEditor() {
    const id = CoreState.sideNotesSessionId || currentSessionId;
    if (!id) return;
    const ed = document.getElementById('sidenotes-editor');
    const data = getSideNotesForChat(id);
    data.text = ed ? ed.value : '';
    setSideNotesForChat(id, data);
}
function renderSideNotesPanel(sessionId) {
    ensureSideNotesScreen();
    const id = sessionId || currentSessionId;
    CoreState.sideNotesSessionId = id;
    const data = getSideNotesForChat(id);
    const ed = document.getElementById('sidenotes-editor');
    const lab = document.getElementById('sidenotes-chat-label');
    const log = document.getElementById('sidenotes-ai-log');
    if (ed) ed.value = data.text || '';
    const title = (id && chatSessions[id] && chatSessions[id].title) || 'Текущий чат';
    if (lab) lab.textContent = 'Чат: ' + title + ' · Editable';
    if (log) {
        const ai = data.ai || [];
        log.innerHTML = ai.length
            ? ai.slice(-8).map(x => `<div class="sn-ai"><b>ИИ:</b> ${escapeHtml(x)}</div>`).join('')
            : '<div class="sn-ai" style="opacity:0.6">Контекст от ИИ появится здесь</div>';
    }
}
function clearCurrentSideNotes() {
    const id = CoreState.sideNotesSessionId || currentSessionId;
    if (!id) return;
    showCustomModal('Очистить Side Notes?', 'Заметки этого чата будут удалены.', false, '', (ok) => {
        if (!ok) return;
        setSideNotesForChat(id, { text: '', ai: [] });
        renderSideNotesPanel(id);
        showToast('Side Notes очищены', 'warning');
    });
}
/** ИИ / система дописывает контекст в Side Notes чата */
function appendAiSideNote(text, sessionId) {
    const id = sessionId || currentSessionId || CoreState.sideNotesSessionId;
    if (!id || !text) return;
    const data = getSideNotesForChat(id);
    data.ai = data.ai || [];
    data.ai.push(String(text).slice(0, 500));
    if (data.ai.length > 40) data.ai = data.ai.slice(-40);
    // also mirror into editable text as a dated line
    const line = '\n— ИИ: ' + String(text).slice(0, 200);
    data.text = (data.text || '') + line;
    setSideNotesForChat(id, data);
    if (CoreState.sideNotesSessionId === id) renderSideNotesPanel(id);
}
function cmSideNotesFromChat() {
    document.getElementById('context-menu').style.display = 'none';
    const el = window._ctxEl;
    const id = el?.dataset?.sessionId || currentSessionId;
    if (!id) { showToast('Нет чата', 'warning'); return; }
    CoreState.sideNotesSessionId = id;
    // open split chat + side notes
    CoreState.splitMode = 'chat-sidenotes';
    if (typeof enterSplitViewWithMode === 'function') {
        enterSplitViewWithMode('chat-sidenotes');
        // if opening from another session, still show notes of that chat
        renderSideNotesPanel(id);
        if (id !== currentSessionId && typeof loadChatSession === 'function') {
            // keep current chat in left; notes are for selected id
        }
        showToast('Side Notes from This Chat', 'success');
    } else {
        renderSideNotesPanel(id);
        switchScreen('chat');
    }
}


// AI may leave context in Side Notes of active chat after a reply
const _sendMsgSideNotes = typeof sendMsg === 'function' ? sendMsg : null;
if (_sendMsgSideNotes && !window._snSendPatched) {
    window._snSendPatched = true;
    window.sendMsg = function() {
        const input = document.getElementById('user-input');
        const q = (input && input.value || '').trim();
        const result = _sendMsgSideNotes.apply(this, arguments);
        if (q && currentSessionId) {
            // lightweight context line — ИИ «оставляет» заметку
            setTimeout(() => {
                appendAiSideNote('Контекст: пользователь спросил «' + q.slice(0, 120) + (q.length > 120 ? '…' : '') + '»', currentSessionId);
            }, 900);
        }
        return result;
    };
}

window.addEventListener('storage', (e) => {
    if (e.key === 'oracle_projects_list' || (e.key && e.key.startsWith('oracle_notepad_storage_'))) {
        renderNotepadProjectsSidebar();
        updateNpProjectLabel();
    }
});

document.addEventListener('DOMContentLoaded', () => { try { startNotepadAutosave(); } catch(e) {} });


// ===== CUSTOM API KEYS + THINKING ANIM =====
const API_KEYS_STATE_KEY = 'oracle_custom_api';
const API_IMPORT_PROMPT = "Ты помогаешь мне импортировать контекст из одного ИИ-помощника в другого. Твоя задача – проанализировать наши предыдущие чаты и обобщить информацию обо мне.\nВ ответе не должно быть местоимений первого лица (я, мой, мне, мое, меня) и второго лица (ты, твой, тебе, твое, тебя). Называй человека, информацию о котором ты изучил, \"пользователь\" или используй нейтральные обращения.\nПо возможности сохраняй слова пользователя без изменений, особенно в инструкциях и описаниях предпочтений.\nКатегории (указывай сведения в том же порядке):\n1. Демографическая информация: предпочитаемые имена, профессия, образование и место жительства.\n2. Интересы и предпочтения: не просто собственность или разовые покупки пользователя, а то, с чем он часто взаимодействует.\n3. Отношения: подтвержденные и постоянные.\n4. Мероприятия, проекты и планы по датам: список недавних важных дел.\n5. Инструкции: правила, которые я прошу тебя соблюдать, например что нужно и нельзя делать, а также исправления в твоем поведении. Включи правила только из сохраненных записей, а не из чатов.\nФормат.\nСоздай разделы для каждой указанной выше категории. Постарайся включить точные цитаты из моих запросов, которые подтверждают сведения. Для каждого пункта используй приведенный ниже формат.\n* Пользователя зовут <имя>.\n    * Доказательство: пользователь сказал \"Зови меня <имя>\". Дата: [ДД.ММ.ГГГГ].\nРезультат:\n- Укажи в ответе ТОЛЬКО запрошенную информацию без слов-паразитов, вводного текста и подписей.\nВ конце добавь \"Импортировано из <название>\", подставив вместо названия ChatGPT, Claude, Grok или другой ИИ. Это должно быть последнее предложение в тексте.";

function loadCustomApiState() {
    try { return JSON.parse(localStorage.getItem(API_KEYS_STATE_KEY) || '{}') || {}; }
    catch (e) { return {}; }
}
function saveCustomApiState(partial) {
    const s = Object.assign(loadCustomApiState(), partial);
    localStorage.setItem(API_KEYS_STATE_KEY, JSON.stringify(s));
    return s;
}
function refreshApiKeysUI() {
    const s = loadCustomApiState();
    const btn = document.getElementById('api-keys-toggle-btn');
    const panel = document.getElementById('api-keys-panel');
    const on = !!s.enabled;
    if (btn) {
        btn.textContent = on ? 'ВКЛ' : 'ВЫКЛ';
        btn.style.background = on ? 'var(--primary-container)' : 'var(--surface-variant)';
        btn.style.color = on ? 'var(--primary)' : 'var(--on-surface)';
    }
    if (panel) panel.style.display = on ? 'block' : 'none';
    document.querySelectorAll('.api-provider-card').forEach(c => {
        c.classList.toggle('active', c.dataset.provider === (s.provider || ''));
    });
    const inp = document.getElementById('api-key-input');
    if (inp && s.key) inp.value = s.key;
    const promptEl = document.getElementById('api-import-prompt');
    if (promptEl && !promptEl.value) promptEl.value = API_IMPORT_PROMPT;
    const ctx = document.getElementById('api-import-context');
    if (ctx && s.importedContext) ctx.value = s.importedContext;
}
function toggleCustomApiKeys() {
    const s = loadCustomApiState();
    if (s.enabled) {
        saveCustomApiState({ enabled: false });
        refreshApiKeysUI();
        showToast('Встроенная модель Core Node снова активна', 'info');
        return;
    }
    document.getElementById('api-keys-confirm-modal')?.classList.add('active');
}
function cancelEnableCustomApi() {
    document.getElementById('api-keys-confirm-modal')?.classList.remove('active');
}
function confirmEnableCustomApi() {
    document.getElementById('api-keys-confirm-modal')?.classList.remove('active');
    saveCustomApiState({ enabled: true });
    refreshApiKeysUI();
    showToast('Сторонние API включены', 'success');
}
function selectApiProvider(provider) {
    saveCustomApiState({ provider });
    document.querySelectorAll('.api-provider-card').forEach(c => {
        c.classList.toggle('active', c.dataset.provider === provider);
    });
}
function toggleApiKeyVisibility() {
    const inp = document.getElementById('api-key-input');
    const icon = document.getElementById('api-key-vis-icon');
    if (!inp) return;
    if (inp.type === 'password') {
        inp.type = 'text';
        if (icon) icon.textContent = 'visibility_off';
    } else {
        inp.type = 'password';
        if (icon) icon.textContent = 'visibility';
    }
}
function validateProviderKey(provider, key) {
    const k = String(key || '').trim();
    if (!k || k.length < 10) return { ok: false, error: 'Ключ слишком короткий' };
    const p = (provider || '').toLowerCase();
    // Google Gemini: new Auth keys "AQ." / "AQ" and legacy "AIza"
    if (p === 'gemini') {
        if (/^(AQ\.?|AIza)/i.test(k)) return { ok: true, kind: k.toUpperCase().startsWith('AQ') ? 'google_auth' : 'google_standard' };
        return { ok: false, error: 'Ключ Gemini должен начинаться с AQ. (новый Auth Key) или AIza (legacy)' };
    }
    if (p === 'openai') {
        if (/^sk-/i.test(k) || /^sk-proj-/i.test(k)) return { ok: true, kind: 'openai' };
        return { ok: false, error: 'Ключ ChatGPT обычно начинается с sk-' };
    }
    if (p === 'claude') {
        if (/^sk-ant-/i.test(k)) return { ok: true, kind: 'anthropic' };
        // allow generic if user pastes other format
        if (k.length >= 20) return { ok: true, kind: 'anthropic_generic' };
        return { ok: false, error: 'Ключ Claude обычно начинается с sk-ant-' };
    }
    if (p === 'grok') {
        if (/^xai-/i.test(k) || k.length >= 20) return { ok: true, kind: 'xai' };
        return { ok: false, error: 'Вставьте ключ Grok (xAI)' };
    }
    // custom
    if (k.length >= 12) return { ok: true, kind: 'custom' };
    return { ok: false, error: 'Некорректный ключ' };
}
function saveApiKey() {
    const key = (document.getElementById('api-key-input')?.value || '').trim();
    const s = loadCustomApiState();
    if (!s.provider) {
        showToast('Сначала выберите провайдера', 'warning');
        return;
    }
    const v = validateProviderKey(s.provider, key);
    if (!v.ok) {
        showToast(v.error, 'error');
        return;
    }
    saveCustomApiState({ key, keyKind: v.kind, keySavedAt: Date.now(), enabled: true, lastKeyError: null });
    localStorage.setItem('oracle_limits_mode', 'external_api');
    document.getElementById('api-key-ok-modal')?.classList.add('active');
    refreshApiKeysUI();
}
function copyApiImportPrompt() {
    const t = document.getElementById('api-import-prompt')?.value || API_IMPORT_PROMPT;
    navigator.clipboard?.writeText(t).then(() => showToast('Запрос скопирован', 'success'))
        .catch(() => showToast('Не удалось скопировать', 'error'));
}
function saveImportedContext() {
    const text = (document.getElementById('api-import-context')?.value || '').trim();
    if (!text) { showToast('Вставьте текст контекста', 'warning'); return; }
    saveCustomApiState({ importedContext: text, importedAt: Date.now() });
    localStorage.setItem('oracle_imported_ai_context', text);
    showToast('Контекст сохранён', 'success');
}
function handleApiZipImport(input) {
    const file = input?.files?.[0];
    const status = document.getElementById('api-zip-status');
    if (!file) return;
    const max = 2 * 1024 * 1024 * 1024;
    if (file.size > max) {
        if (status) status.textContent = 'Файл больше 2 ГБ';
        showToast('ZIP не должен превышать 2 ГБ', 'error');
        input.value = '';
        return;
    }
    if (status) status.textContent = 'Читаем ' + file.name + '…';
    saveCustomApiState({ zipImport: { name: file.name, size: file.size, at: Date.now() } });
    if (status) status.textContent = 'ZIP принят: ' + file.name + ' (' + Math.round(file.size/1024/1024) + ' МБ). Метаданные сохранены.';
    showToast('ZIP зарегистрирован', 'success');
    input.value = '';
}

function setThinkingStyle(style) {
    const s = ['dots', 'ring', 'off'].includes(style) ? style : 'dots';
    localStorage.setItem('oracle_thinking_style', s);
    document.querySelectorAll('.think-style-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.style === s);
    });
    document.body.classList.toggle('thinking-style-off', s === 'off');
    showToast('Анимация: ' + ({ dots: 'Две точки', ring: 'Обводка', off: 'Выкл' }[s]), 'success');
}
function getThinkingStyle() {
    const s = localStorage.getItem('oracle_thinking_style') || 'dots';
    return ['dots', 'ring', 'off'].includes(s) ? s : 'dots';
}
function ensureThinkingIndicator() {
    let el = document.getElementById('ai-thinking-indicator');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'ai-thinking-indicator';
    el.innerHTML = '<div class="think-anim dots" id="think-anim-node"><span class="td"></span><span class="td"></span></div><span class="think-label">Модель думает…</span>';
    const flow = document.getElementById('chat-flow');
    if (flow && flow.parentNode) flow.parentNode.insertBefore(el, flow.nextSibling);
    else document.getElementById('screen-chat')?.appendChild(el);
    return el;
}
function showThinkingIndicator(show) {
    const style = getThinkingStyle();
    if (style === 'off') {
        document.getElementById('ai-thinking-indicator')?.classList.remove('visible');
        return;
    }
    const el = ensureThinkingIndicator();
    const anim = document.getElementById('think-anim-node');
    if (anim) {
        anim.className = 'think-anim ' + (style === 'ring' ? 'ring' : 'dots');
        if (style === 'dots') anim.innerHTML = '<span class="td"></span><span class="td"></span>';
        else anim.innerHTML = '';
    }
    el.classList.toggle('visible', !!show);
    if (show) {
        const screen = document.getElementById('screen-chat');
        if (screen) screen.scrollTop = screen.scrollHeight;
    }
}

(function patchSetGenerating() {
    if (window._thinkGenPatched) return;
    const tryPatch = () => {
        if (typeof setGenerating !== 'function') return false;
        if (window._thinkGenPatched) return true;
        window._thinkGenPatched = true;
        const orig = setGenerating;
        window.setGenerating = function(isGen) {
            orig(isGen);
            showThinkingIndicator(!!isGen);
        };
        return true;
    };
    if (!tryPatch()) {
        document.addEventListener('DOMContentLoaded', tryPatch);
        setTimeout(tryPatch, 0);
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    try {
        refreshApiKeysUI();
        const st = getThinkingStyle();
        document.querySelectorAll('.think-style-btn').forEach(b => b.classList.toggle('active', b.dataset.style === st));
        document.body.classList.toggle('thinking-style-off', st === 'off');
        const promptEl = document.getElementById('api-import-prompt');
        if (promptEl) promptEl.value = API_IMPORT_PROMPT;
    } catch (e) {}
});

(function patchShowSectionApi() {
    const wrap = () => {
        if (typeof window.showSection !== 'function' || window._apiKeysShowPatched2) return;
        window._apiKeysShowPatched2 = true;
        const prev = window.showSection;
        window.showSection = function(id) {
            prev(id);
            if (id === 'api-keys') refreshApiKeysUI();
            if (id === 'public-links' && typeof renderPublicLinksList === 'function') renderPublicLinksList();
        };
    };
    wrap();
    document.addEventListener('DOMContentLoaded', wrap);
})();


// ===== External API call + key error with Retry =====
function appendAiApiError(message, retryMsg) {
    const chatFlow = document.getElementById('chat-flow');
    if (!chatFlow) return;
    const wrap = document.createElement('div');
    wrap.className = 'msg ai-msg ai-api-error';
    const safe = String(message || 'Ошибка API ключа');
    wrap.innerHTML = `
        <div class="ai-error-card">
            <div class="ai-error-icon"><span class="material-symbols-rounded">error</span></div>
            <div class="ai-error-body">
                <div class="ai-error-title">Ошибка ключа / API</div>
                <div class="ai-error-text">${escapeAiHtml(safe)}</div>
                <button type="button" class="ai-retry-btn" onclick="retryLastApiRequest(this)">
                    <span class="material-symbols-rounded">refresh</span> Повторить
                </button>
            </div>
        </div>`;
    if (retryMsg) wrap.dataset.retryMsg = retryMsg;
    chatFlow.appendChild(wrap);
    const screenChat = document.getElementById('screen-chat');
    if (screenChat) screenChat.scrollTop = screenChat.scrollHeight;
    if (!CoreState.isTempChat) {
        if (currentSessionId && chatSessions[currentSessionId]) {
            chatSessions[currentSessionId].html = chatFlow.innerHTML;
            localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
        }
        localStorage.setItem('oracle_chat_history', chatFlow.innerHTML);
    }
}
function retryLastApiRequest(btn) {
    const wrap = btn?.closest('.ai-api-error');
    const msg = wrap?.dataset?.retryMsg || CoreState._lastApiUserMsg || '';
    if (!msg) {
        showToast('Нет сообщения для повтора', 'warning');
        return;
    }
    wrap?.remove();
    const input = document.getElementById('user-input');
    if (input) {
        input.value = msg;
        if (typeof handleInput === 'function') handleInput(input);
    }
    if (typeof sendMsg === 'function') sendMsg();
}

async function callExternalProvider(userMsg) {
    const s = loadCustomApiState();
    if (!s.enabled || !s.key || !s.provider) {
        return { ok: false, error: 'Сторонний API не настроен', code: 'not_configured' };
    }
    const v = validateProviderKey(s.provider, s.key);
    if (!v.ok) {
        return { ok: false, error: v.error, code: 'invalid_key' };
    }
    const provider = s.provider;
    const key = s.key.trim();
    const context = s.importedContext ? ('\n\n[Контекст пользователя]\n' + s.importedContext.slice(0, 4000)) : '';
    const prompt = userMsg + context;

    try {
        if (provider === 'gemini') {
            // Support both legacy AIza and new Auth keys AQ.
            const model = 'gemini-2.0-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': key
                },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }]
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const errMsg = data?.error?.message || data?.error?.status || ('HTTP ' + res.status);
                const isKey = res.status === 400 || res.status === 401 || res.status === 403 ||
                    /API key|invalid|unauth|permission|credential/i.test(String(errMsg));
                return {
                    ok: false,
                    error: isKey
                        ? ('Ключ отклонён: ' + errMsg + (String(key).toUpperCase().startsWith('AQ')
                            ? ' (новый Auth Key AQ. — убедитесь, что endpoint/SDK поддерживает Auth keys)'
                            : ''))
                        : String(errMsg),
                    code: isKey ? 'invalid_key' : 'api_error'
                };
            }
            const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
            if (!text) return { ok: false, error: 'Пустой ответ Gemini', code: 'empty' };
            return { ok: true, text };
        }

        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + key
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const errMsg = data?.error?.message || ('HTTP ' + res.status);
                const isKey = res.status === 401 || res.status === 403 || /api key|incorrect|invalid/i.test(String(errMsg));
                return { ok: false, error: errMsg, code: isKey ? 'invalid_key' : 'api_error' };
            }
            const text = data?.choices?.[0]?.message?.content || '';
            if (!text) return { ok: false, error: 'Пустой ответ OpenAI', code: 'empty' };
            return { ok: true, text };
        }

        if (provider === 'claude') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-haiku-20241022',
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const errMsg = data?.error?.message || ('HTTP ' + res.status);
                const isKey = res.status === 401 || res.status === 403 || /api.?key|auth/i.test(String(errMsg));
                return { ok: false, error: errMsg, code: isKey ? 'invalid_key' : 'api_error' };
            }
            const text = (data?.content || []).map(c => c.text).filter(Boolean).join('\n');
            if (!text) return { ok: false, error: 'Пустой ответ Claude', code: 'empty' };
            return { ok: true, text };
        }

        if (provider === 'grok') {
            const res = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + key
                },
                body: JSON.stringify({
                    model: 'grok-2-latest',
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const errMsg = data?.error?.message || ('HTTP ' + res.status);
                const isKey = res.status === 401 || res.status === 403;
                return { ok: false, error: errMsg, code: isKey ? 'invalid_key' : 'api_error' };
            }
            const text = data?.choices?.[0]?.message?.content || '';
            if (!text) return { ok: false, error: 'Пустой ответ Grok', code: 'empty' };
            return { ok: true, text };
        }

        return { ok: false, error: 'Провайдер «' + provider + '» пока без прямого endpoint. Выберите Gemini / ChatGPT / Claude / Grok.', code: 'unsupported' };
    } catch (e) {
        return { ok: false, error: 'Сеть: ' + (e.message || e), code: 'network' };
    }
}

async function resolveAiResponse(msg) {
    const s = loadCustomApiState();
    if (s.enabled && s.key) {
        CoreState._lastApiUserMsg = msg;
        const result = await callExternalProvider(msg);
        if (result.ok) return { ok: true, text: result.text, external: true };
        saveCustomApiState({ lastKeyError: result.error, lastKeyErrorAt: Date.now() });
        return { ok: false, error: result.error, code: result.code };
    }
    // built-in mock
    let response = '';
    const lowerMsg = msg.toLowerCase();
    if (CoreState.activeAgent === 'Worldpack AI') {
        response = '[Worldpack Node]: Анализ запущен. Конфигурация модулей в норме.';
    } else if (CoreState.activeAgent === 'Модель: Fast') {
        response = '⚡ Быстрый ответ: **' + msg + '**. Запрос обработан мгновенно.';
    } else if (/код|code|javascript|python|html|css|markdown|фото|картинк|image|пример/i.test(msg)) {
        response = 'Вот оформленный ответ с **Markdown**, кодом и медиа.\n\n' +
            '### JavaScript\n```javascript\nfunction demo() {\n  return \'Core Node 2.6 PRO\';\n}\nconsole.log(demo());\n```\n\n' +
            '### Python\n```python\ndef demo() -> str:\n    return \'Oracle\'\nprint(demo())\n```\n\n' +
            '### HTML\n```html\n<section class="hero">Привет</section>\n```\n\n' +
            '### CSS\n```css\n.hero { padding: 16px; border-radius: 12px; }\n```\n\n' +
            'Инлайн: `const ok = true`.\n\n' +
            '![Сгенерированное фото](https://picsum.photos/seed/corenode/720/400)';
    } else if (lowerMsg.includes('привет')) {
        response = 'Приветствую! Системы **Ядра** активированы и готовы к работе.';
    } else if (lowerMsg.includes('статус')) {
        response = 'Все модули Штаба ЛМСХ функционируют в **нормальном** режиме.';
    } else if (lowerMsg.includes('кто ты')) {
        response = 'Я **Oracle AI v2.6 PRO** — центральное интеллектуальное ядро. Ожидаю распоряжений.';
    } else {
        response = 'Принято: «' + msg + '».\n\nСинхронизация с базой знаний прошла успешно. Напишите *код* или *фото*, чтобы увидеть rich-ответ.';
    }
    return { ok: true, text: response, external: false };
}


// ===== PRE-LAUNCH POLISH (20 Sep) =====
CoreState.apiAbort = null;

function updateApiStatusChip() {
    const chip = document.getElementById('api-status-chip');
    const text = document.getElementById('api-status-chip-text');
    const banner = document.getElementById('limits-external-banner');
    let s = {};
    try { s = loadCustomApiState(); } catch (e) {}
    const on = !!(s.enabled && s.key);
    if (chip) {
        chip.style.display = on ? 'inline-flex' : 'none';
        if (text) {
            const names = { openai: 'ChatGPT', gemini: 'Gemini', claude: 'Claude', grok: 'Grok', custom: 'Custom' };
            text.textContent = on ? (names[s.provider] || 'API') + ' · ON' : 'API';
        }
    }
    if (banner) banner.style.display = on ? 'flex' : 'none';
    // soft dim core limits when external
    document.querySelectorAll('#section-limits .chat-card, #section-limits .limit-bar-wrap').forEach(el => {
        if (el.id === 'limits-external-banner') return;
        el.style.opacity = on ? '0.45' : '';
        el.style.pointerEvents = on ? 'none' : '';
    });
}

const _stopGenBase = typeof stopGeneration === 'function' ? stopGeneration : null;
if (_stopGenBase && !window._stopAbortPatched) {
    window._stopAbortPatched = true;
    window.stopGeneration = function() {
        try {
            if (CoreState.apiAbort) {
                CoreState.apiAbort.abort();
                CoreState.apiAbort = null;
            }
        } catch (e) {}
        _stopGenBase();
        showThinkingIndicator(false);
        showToast('Генерация остановлена', 'info');
    };
}

// wrap callExternalProvider to use AbortController
const _callExtOrig = typeof callExternalProvider === 'function' ? callExternalProvider : null;
if (_callExtOrig && !window._callAbortPatched) {
    window._callAbortPatched = true;
    window.callExternalProvider = async function(userMsg) {
        const ctrl = new AbortController();
        CoreState.apiAbort = ctrl;
        // monkey-patch fetch temporarily is heavy — pass signal via internal
        CoreState._apiSignal = ctrl.signal;
        try {
            return await _callExtOrig(userMsg);
        } finally {
            if (CoreState.apiAbort === ctrl) CoreState.apiAbort = null;
            CoreState._apiSignal = null;
        }
    };
}

// Patch fetch inside gemini/openai by using global signal when present
const _origFetch = window.fetch.bind(window);
window.fetch = function(input, init) {
    init = init || {};
    if (CoreState._apiSignal && !init.signal) {
        init = Object.assign({}, init, { signal: CoreState._apiSignal });
    }
    return _origFetch(input, init);
};

// refresh chip when API state changes
const _saveApiState = typeof saveCustomApiState === 'function' ? saveCustomApiState : null;
if (_saveApiState && !window._saveApiChipPatched) {
    window._saveApiChipPatched = true;
    window.saveCustomApiState = function(partial) {
        const r = _saveApiState(partial);
        try { updateApiStatusChip(); } catch (e) {}
        return r;
    };
}

// Extended onboarding tips
(function extendOnboarding() {
    const tipsExtra = [
        { title: 'Сторонние API', text: 'Подключите Gemini (ключ AQ.), ChatGPT, Claude или Grok в Настройки → Сторонние API.', sel: '#btn-sec-api-keys' },
        { title: 'Публичные ссылки', text: 'Все шаринги чатов — в Настройки → Публичные ссылки.', sel: '#btn-sec-public-links' },
        { title: 'Markdown и код', text: 'Ответы ИИ поддерживают Markdown, окна кода и просмотр фото.', sel: '#btn-tab-chat' }
    ];
    // if startOnboarding exists and tips array is inline, we inject via storage flag one-time soft toast instead
    if (localStorage.getItem('oracle_pro_tips_20260920') !== 'true') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (localStorage.getItem('oracle_pro_tips_20260920') === 'true') return;
                localStorage.setItem('oracle_pro_tips_20260920', 'true');
                showToast('Core Node 2.6 PRO · 20 сентября — Сторонние API, Markdown, публичные ссылки', 'success', 4500);
            }, 2200);
        });
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    try { updateApiStatusChip(); } catch (e) {}
});

// when opening limits, refresh banner
(function patchLimitsSection() {
    const wrap = () => {
        if (typeof window.showSection !== 'function' || window._limitsBannerPatched) return;
        window._limitsBannerPatched = true;
        const prev = window.showSection;
        window.showSection = function(id) {
            prev(id);
            if (id === 'limits' || id === 'api-keys') {
                try { updateApiStatusChip(); } catch (e) {}
            }
        };
    };
    wrap();
    document.addEventListener('DOMContentLoaded', wrap);
})();



// ===== Fast Assistant bridge (shared keys + postMessage) =====
const FA_BRIDGE_CHANNEL = 'fast-assistant-core-node';
const FA_BRIDGE_KEYS = {
  sessions: 'oracle_chat_sessions',
  current: 'oracle_current_session',
  meta: 'oracle_fa_bridge_meta'
};

function mergeFaChatsIntoSessions(chatsObj) {
  if (!chatsObj || typeof chatsObj !== 'object') return 0;
  let n = 0;
  Object.keys(chatsObj).forEach(id => {
    const c = chatsObj[id];
    if (!c) return;
    const key = String(id).startsWith('session_') || String(id).startsWith('fa_')
      ? id
      : ('fa_' + id);
    chatSessions[key] = {
      title: c.title || 'Чат из Fast Assistant',
      html: c.html || '',
      updated: c.updated || Date.now(),
      source: c.source || 'fast-assistant'
    };
    n++;
  });
  if (n) {
    try { localStorage.setItem(FA_BRIDGE_KEYS.sessions, JSON.stringify(chatSessions)); } catch (e) {}
    if (typeof renderSidebarChats === 'function') renderSidebarChats();
  }
  return n;
}

function replyToFastAssistant(sourceWin, type, extra) {
  try {
    const target = sourceWin || window.opener;
    if (!target || target === window) return;
    target.postMessage(Object.assign({
      channel: FA_BRIDGE_CHANNEL,
      source: 'Core Node',
      type: type,
      timestamp: Date.now()
    }, extra || {}), '*');
  } catch (e) {}
}

window.addEventListener('message', function faBridgeOnMessage(e) {
  const d = e.data;
  if (!d || typeof d !== 'object' || d.channel !== FA_BRIDGE_CHANNEL) return;
  if (d.source === 'Core Node') return;

  if (d.type === 'hello' || d.type === 'ping') {
    replyToFastAssistant(e.source, 'core-ready', { version: '2.6 PRO' });
    replyToFastAssistant(e.source, 'core-pong', {});
    // same-origin: refresh from shared key
    try {
      const raw = localStorage.getItem(FA_BRIDGE_KEYS.sessions);
      if (raw) {
        chatSessions = JSON.parse(raw) || chatSessions;
        if (typeof renderSidebarChats === 'function') renderSidebarChats();
      }
    } catch (err) {}
    return;
  }

  if (d.type === 'import' && d.payload) {
    let n = 0;
    if (d.payload.chats) n = mergeFaChatsIntoSessions(d.payload.chats);
    if (d.payload.text && typeof addAI === 'function') {
      // optional system note
      try {
        if (typeof showToast === 'function') showToast('Импорт из Fast Assistant: ' + n + ' чат(ов)', 'success');
      } catch (err) {}
    } else if (typeof showToast === 'function') {
      showToast('Fast Assistant → Core Node: ' + n + ' чат(ов)', 'success');
    }
    replyToFastAssistant(e.source, 'import-ok', { count: n });
    return;
  }

  if (d.type === 'request' && d.text && typeof sendMsg === 'function') {
    // optional: inject into input
    const input = document.getElementById('user-input');
    if (input) {
      input.value = String(d.text);
      if (typeof handleInput === 'function') handleInput(input);
    }
  }
});

// Same-tab storage sync (FA and CN on same origin)
window.addEventListener('storage', function(e) {
  if (e.key !== FA_BRIDGE_KEYS.sessions || !e.newValue) return;
  try {
    chatSessions = JSON.parse(e.newValue) || chatSessions;
    if (typeof renderSidebarChats === 'function') renderSidebarChats();
  } catch (err) {}
});
