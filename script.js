/* emergency: never hang on splash */
(function(){
  function killSplash(){
    var el = document.getElementById('boot-splash');
    if(!el) return;
    el.classList.add('boot-done');
    el.style.opacity = '0';
    el.style.visibility = 'hidden';
    el.style.pointerEvents = 'none';
    try { el.remove(); } catch(e) { el.style.display = 'none'; }
  }
  setTimeout(killSplash, 2500);
  setTimeout(killSplash, 5000);
  window.addEventListener('load', function(){ setTimeout(killSplash, 400); });
  if(document.readyState === 'complete') setTimeout(killSplash, 400);
})();

/* ===== script block ===== */

/* PWA register — Core Node */
(function registerCoreNodePWA() {
  if (!('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then((reg) => {
        // soft update check
        try { reg.update(); } catch (e) {}
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              // new version ready — optional toast if app exposes showToast
              try {
                if (typeof showToast === 'function') {
                  showToast('Доступно обновление Core Node (PWA). Перезагрузите страницу.', 'info', 5000);
                }
              } catch (e) {}
            }
          });
        });
      })
      .catch(() => {});
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
})();

// Состояние приложения
    const CoreState = {
    activeAgent: 'Intify 2.5.4',
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
genTimer: null,
    isLiveChat: false,
    _liveRec: null
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
    sectionId = String(sectionId || 'general').trim().replace(/^section-/, '');
    var map = {
      personalization: 'general', appearance: 'general', theme: 'general',
      'o-vas': 'user', you: 'user', profile: 'user',
      safety: 'security', protect: 'security',
      apikeys: 'api-keys', api: 'api-keys',
      links: 'public-links', public: 'public-links',
      sidebar: 'sidebar-menu', menu: 'sidebar-menu',
      dev: 'developer', lang: 'language'
    };
    if (map[sectionId]) sectionId = map[sectionId];

    document.querySelectorAll('#settings-content .setting-section, .setting-section').forEach(function(el) {
      el.classList.remove('section-visible');
      el.style.setProperty('display', 'none', 'important');
      el.removeAttribute('hidden');
    });

    var target = document.getElementById('section-' + sectionId);
    if (!target) {
      target = document.getElementById('section-general');
      sectionId = 'general';
    }
    if (target) {
      target.style.setProperty('display', 'block', 'important');
      target.classList.add('section-visible');
      try { target.scrollTop = 0; } catch (e) {}
    }

    document.querySelectorAll('.settings-tabs .nav-item, #settings-tabs .nav-item, [id^="btn-sec-"], .settings-side-nav .nav-item').forEach(function(btn) {
      btn.classList.remove('active');
    });
    var activeBtn = document.getElementById('btn-sec-' + sectionId);
    if (activeBtn) activeBtn.classList.add('active');
    // also mark by data-section
    document.querySelectorAll('[data-section]').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-section') === sectionId);
    });

    try {
      if (location.hash.indexOf('#settings') === 0 || document.getElementById('screen-settings')?.classList.contains('active-screen')) {
        history.replaceState(null, '', '#settings_' + sectionId);
      }
    } catch (e) {}

    // mobile second pane
    try {
      var sc = document.getElementById('settings-content');
      if (sc) sc.classList.add('settings-pane-open');
      var list = document.getElementById('settings-tab-list');
      if (list && window.matchMedia('(max-width: 720px)').matches) {
        /* optional mobile drill-in */
      }
    } catch (e) {}
}
window.showSection = showSection;




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
            chatSessions[currentSessionId] = { title: 'Новый чат', html: '', mode: (localStorage.getItem('oracle_input_mode')||'chat') };
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
        const isTask = (chatSessions[id].mode === 'task');
        item.innerHTML = '<span class="chat-title">' + (chatSessions[id].title || 'Новый чат') + '</span>' +
            '<span class="material-symbols-rounded' + (isTask ? ' task-chat-ico' : '') + '" style="font-size:16px;">' +
            (isTask ? 'check_circle' : 'chat') + '</span>';
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
    // Lazy: не пишем в историю, пока нет первого сообщения
    currentSessionId = null;
    CoreState.isFirstMsgInSession = true;
    CoreState.pendingBlankChat = true;
    try { localStorage.removeItem('oracle_current_session'); } catch(e) {}
    const chatFlow = document.getElementById('chat-flow');
    const welcome = document.getElementById('welcome-block');
    if (chatFlow) chatFlow.innerHTML = '';
    if (welcome) welcome.classList.remove('hidden');
    if (typeof updateWelcomeAmbient === 'function') updateWelcomeAmbient();
    if (typeof updateChatEmptyState === 'function') updateChatEmptyState();
    if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
    else if (typeof renderSidebarChats === 'function') renderSidebarChats();
    document.getElementById('sidebar-archive')?.classList.remove('open');
    switchScreen('chat');
    /* welcome toast removed */
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
    if (titleEl) titleEl.textContent = storyBooks[id].title || 'Без названия';
    if (typeof switchScreen === 'function') switchScreen('reader');
    if (typeof readerOnStoryOpened === 'function') readerOnStoryOpened(id);
}

function toggleTempChat() {
    if (CoreState.isTempChat) {
        exitTempChat();
    } else {
        enterTempChat();
    }
}


function setTempPersona(mode, silent) {
    mode = (mode === 'without' || mode === 'without_persona') ? 'without' : 'with';
    if (CoreState.tempPersonaLocked && !silent) {
        if (typeof showToast === 'function') showToast('После первого сообщения сменить нельзя — создайте новый временный чат', 'warning');
        return;
    }
    if (!CoreState.isTempChat && !silent) {
        if (typeof showToast === 'function') showToast('Сначала включите временный чат', 'info');
        return;
    }
    CoreState.tempPersona = mode;
    try { localStorage.setItem('oracle_temp_persona_pref', mode); } catch (e) {}
    var chooser = document.getElementById('temp-persona-chooser');
    if (chooser) {
        chooser.hidden = false;
        chooser.querySelectorAll('.temp-persona-card').forEach(function(card) {
            var m = card.getAttribute('data-mode') || '';
            var on = (m === mode) || (mode === 'with' && m === 'with') || (mode === 'without' && (m === 'without' || m === 'without_persona'));
            card.classList.toggle('selected', on);
        });
    }
    if (!silent && typeof showToast === 'function') {
        showToast(mode === 'with' ? 'С персонализацией' : 'Без персонализации', 'info', 1600);
    }
}
window.setTempPersona = setTempPersona;

function enterTempChat() {
    const chatFlow = document.getElementById('chat-flow');
    const welcomeBlock = document.getElementById('welcome-block');

    CoreState.savedChatHTML = chatFlow ? chatFlow.innerHTML : '';
    CoreState.savedWelcomeHTML = welcomeBlock ? welcomeBlock.innerHTML : '';

    if (chatFlow) chatFlow.innerHTML = '';
    if (welcomeBlock) {
        welcomeBlock.classList.remove('hidden');
        const greeting = document.getElementById('welcome-greeting');
        const subtext = document.getElementById('welcome-subtext');
        if (greeting) greeting.textContent = 'Зашли случайно?';
        if (subtext) subtext.textContent = 'Это временный чат. Сообщения не пишутся в историю, пока вы сами не сохраните чат.';
    }

    CoreState.isTempChat = true;
    CoreState.tempPersonaLocked = false;
    CoreState.tempPersona = CoreState.tempPersona || 'with';
    CoreState.tempHasMessages = false;
    document.body.classList.add('temp-chat-mode');
    document.body.classList.remove('temp-chat-saved-ready');

    const chooser = document.getElementById('temp-persona-chooser');
    if (chooser) {
        chooser.hidden = false;
        chooser.style.display = '';
        chooser.removeAttribute('hidden');
    }
    try {
      var pref = localStorage.getItem('oracle_temp_persona_pref') || CoreState.tempPersona || 'with';
      if (typeof setTempPersona === 'function') setTempPersona(pref, true);
    } catch (e) {}
    // empty layout + "Новый чат" chrome must stay visible in temp mode
    try {
      document.body.classList.add('empty-chat');
      var chrome = document.getElementById('empty-chat-chrome');
      if (chrome) { chrome.hidden = false; chrome.style.display = 'flex'; }
      if (typeof syncEmptyChatLayout === 'function') syncEmptyChatLayout();
    } catch (e) {}
    if (typeof syncTempChatButton === 'function') syncTempChatButton();
    showToast('Временный чат. Выберите персонализацию до первого сообщения.', 'warning');
}

function exitTempChat() {
    const chatFlow = document.getElementById('chat-flow');
    const welcomeBlock = document.getElementById('welcome-block');
    const chooser = document.getElementById('temp-persona-chooser');
    if (chooser) chooser.hidden = true;

    if (chatFlow) chatFlow.innerHTML = CoreState.savedChatHTML || '';
    if (welcomeBlock) {
        // Don't wipe chooser node if it exists in DOM as sibling structure — restore text only if we saved HTML
        if (CoreState.savedWelcomeHTML) {
            // Prefer restoring greeting/subtext without destroying chooser if possible
            const g = document.getElementById('welcome-greeting');
            const s = document.getElementById('welcome-subtext');
            if (g) g.textContent = 'Привет! Как твои дела?';
            if (s) s.textContent = 'Готов к работе. Чем я могу помочь тебе сегодня?';
        }
        if (CoreState.savedChatHTML && CoreState.savedChatHTML.trim() !== '') {
            welcomeBlock.classList.add('hidden');
            if (typeof updateWelcomeAmbient === 'function') updateWelcomeAmbient();
        } else {
            welcomeBlock.classList.remove('hidden');
        }
    }

    CoreState.isTempChat = false;
    CoreState.tempPersonaLocked = false;
    CoreState.tempHasMessages = false;
    CoreState.savedChatHTML = null;
    CoreState.savedWelcomeHTML = null;
    document.body.classList.remove('temp-chat-mode', 'temp-chat-saved-ready');
    syncTempChatButton();
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
    showToast('Параллельный просмотр активирован', 'success');
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

    showToast('Вышли из Параллельный просмотр', 'success');
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
        if (typeof CoreState === 'object') CoreState.chatMode = mode || 'normal';
    }
    function setChatMode(mode) { switchChatMode(mode); }
    function openProjectPanel() {
        if (typeof showToast === 'function') showToast('Проекты — через Create a… в боковом меню', 'info');
    }
    function openCodingPanel() {
        if (typeof switchScreen === 'function') switchScreen('notepad');
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

        // body flags: input only on chat
        try {
          document.body.classList.toggle('on-chat-screen', screenName === 'chat');
          document.body.classList.toggle('on-settings-screen', screenName === 'settings');
          document.body.classList.toggle('on-skills-screen', screenName === 'skills');
          var box = document.getElementById('main-input-box');
          if (box) {
            if (screenName === 'chat') {
              box.style.display = 'flex';
              box.style.visibility = 'visible';
              box.classList.remove('hidden');
            } else {
              box.style.display = 'none';
            }
          }
        } catch (e) {}

        if (subNav) {
            subNav.style.display = (screenName === 'chat') ? 'flex' : 'none';
        }

        const sidebar = document.getElementById('sidebar-archive');
        if (sidebar) sidebar.classList.remove('open');
        if (screenName === 'calendar') renderCalendar();
        if (screenName === 'maps') {
            setTimeout(() => { if (typeof initCoreMaps === 'function') initCoreMaps(); }, 80);
        }
    }

    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar-archive');
        if (!sidebar) return;
        sidebar.classList.toggle('open');
        if (sidebar.classList.contains('open') && typeof renderUnifiedArchive === 'function') {
          try { renderUnifiedArchive(); } catch (e) { console.error(e); }
        }
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
        const snOpt = document.getElementById('cm-context-opt') || document.getElementById('cm-sidenotes-opt');
        if (snOpt) {
          const isChat = (window._ctxItemType === 'chat') || (currentContextNode && currentContextNode.dataset.itemType === 'chat');
          snOpt.style.display = isChat ? 'flex' : 'none';
        }
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
        let currentTitle = '';
        if (titleEl) {
          currentTitle = (titleEl.innerText || titleEl.textContent || '').trim();
          // strip icon ligatures like chat_bubble
          if (/^[a-z0-9_]+$/i.test(currentTitle) && currentTitle.includes('_')) currentTitle = '';
        }
        if (!currentTitle && currentContextNode) {
          currentTitle = currentContextNode.dataset.title || currentContextNode.getAttribute('data-title') || '';
        }
        if (!currentTitle && window._ctxSessionId && typeof chatSessions === 'object' && chatSessions[window._ctxSessionId]) {
          currentTitle = chatSessions[window._ctxSessionId].title || '';
        }
        showCustomModal(promptTitle, 'Новое название:', true, currentTitle || '', (newName) => {
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
        if (typeof showToast === 'function') showToast('Ветки — через проекты в боковом меню', 'info');
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
    textarea.style.height = Math.min(textarea.scrollHeight, 96) + 'px';

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
        const bubble = btn.closest('.msg-actions')?.previousElementSibling || btn.closest('.ai-msg, .user-msg, .msg');
        const text = (bubble?.innerText || bubble?.textContent || '').trim();
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => (window.showCopyFragmentToast||showToast)(text)).catch(() => showToast('Не удалось скопировать.', 'error')); else showToast('Буфер обмена недоступен.', 'warning');
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
    /* Serious palette: neutral UI, accent only for bubbles / send / mic / stop */
    const target = document.body;
    if (target.classList.contains('halloween-theme')) return;

    const isLight = target.classList.contains('light-theme');
    const isTrueBlack = target.classList.contains('true-black-theme');
    let theme = getSavedMatteTheme();

    // Accent color (user choice) — stored in matte theme primary
    let accent = theme.primary || '#adc6ff';
    if (theme.isBW) {
        accent = isLight ? '#1a1a1a' : '#f0f0f0';
    }
    if (theme.isRaspberry || (accent && (accent.toLowerCase() === '#e11d48' || accent.toLowerCase() === '#f43f5e'))) {
        accent = isLight ? '#F43F5E' : '#E11D48';
    }

    // Dark base level: #000000 | #050505 | #0f0f0f
    let darkBase = '#0f0f0f';
    try {
        const db = localStorage.getItem('oracle_dark_base');
        if (db === '#000000' || db === '#050505' || db === '#0f0f0f') darkBase = db;
        if (isTrueBlack) darkBase = localStorage.getItem('oracle_dark_base') || '#000000';
    } catch (e) {}

    // Subtle accent tint on background (toggle)
    let tintOn = true;
    try {
        const t = localStorage.getItem('oracle_accent_tint');
        if (t === '0') tintOn = false;
    } catch (e) {}

    function mixHex(a, b, w) {
        // simple mix toward accent, w = 0..1 how much accent
        try {
            const ah = a.replace('#','');
            const bh = b.replace('#','');
            const ar = parseInt(ah.slice(0,2),16), ag = parseInt(ah.slice(2,4),16), ab = parseInt(ah.slice(4,6),16);
            const br = parseInt(bh.slice(0,2),16), bg = parseInt(bh.slice(2,4),16), bb = parseInt(bh.slice(4,6),16);
            const r = Math.round(ar + (br-ar)*w);
            const g = Math.round(ag + (bg-ag)*w);
            const bl = Math.round(ab + (bb-ab)*w);
            return '#' + [r,g,bl].map(x => x.toString(16).padStart(2,'0')).join('');
        } catch (e) { return a; }
    }

    // Neutral chrome: black buttons in light, white in dark
    const chrome = isLight ? '#121212' : '#f2f2f2';
    const chromeMuted = isLight ? '#3a3a3a' : '#c8c8c8';
    const border = isLight ? '#d4d4d8' : '#2a2a2a';
    const surface = isLight ? '#ffffff' : mixHex(darkBase, '#1a1a1a', 0.35);
    const surfaceVar = isLight ? '#f0f0f2' : mixHex(darkBase, '#222222', 0.4);
    let bg = isLight ? '#f6f6f7' : darkBase;
    if (tintOn) {
        bg = isLight ? mixHex('#f6f6f7', accent, 0.04) : mixHex(darkBase, accent, 0.06);
    }

    target.style.setProperty('--bg', bg);
    target.style.setProperty('--surface', surface);
    target.style.setProperty('--surface-variant', surfaceVar);
    target.style.setProperty('--on-surface', isLight ? '#121212' : '#f2f2f2');
    target.style.setProperty('--on-surface-variant', isLight ? '#5c5c66' : '#9a9aa3');
    target.style.setProperty('--border', border);
    target.style.setProperty('--glass-bg', isLight ? 'rgba(255,255,255,0.94)' : 'rgba(10,10,10,0.94)');

    // Neutral "primary" for general UI (borders/old refs) — chrome, NOT accent theater
    target.style.setProperty('--primary', chrome);
    target.style.setProperty('--primary-container', isLight ? '#e8e8ea' : '#1c1c1c');
    target.style.setProperty('--secondary', chromeMuted);
    target.style.setProperty('--grad', `linear-gradient(90deg, ${chrome} 0%, ${chrome} 100%)`);

    // Accent tokens — bubbles / send / mic / stop only
    target.style.setProperty('--accent', accent);
    target.style.setProperty('--accent-soft', isLight ? accent + '22' : accent + '33');
    target.style.setProperty('--accent-container', isLight ? accent + '18' : accent + '28');

    // Sync toggle UI if present
    try {
        const tintEl = document.getElementById('toggle-accent-tint');
        if (tintEl) tintEl.checked = tintOn;
        document.querySelectorAll('.dark-base-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-base') === darkBase);
        });
    } catch (e) {}
}


function setAccentTint(on) {
    localStorage.setItem('oracle_accent_tint', on ? '1' : '0');
    applyVisualTheme();
    if (typeof showToast === 'function') showToast(on ? 'Оттенок акцента: вкл' : 'Оттенок акцента: выкл', 'info');
}
function setDarkBase(hex) {
    if (hex !== '#000000' && hex !== '#050505' && hex !== '#0f0f0f') hex = '#0f0f0f';
    localStorage.setItem('oracle_dark_base', hex);
    // True Black mode aligns with pure black choice
    if (hex === '#000000') document.body.classList.add('true-black-theme');
    else document.body.classList.remove('true-black-theme');
    applyVisualTheme();
    if (typeof showToast === 'function') showToast('Тёмный фон: ' + hex, 'success');
}

function changeOracleTheme(_p,_c,_v){ try{clearHalloweenIfThemeChange();}catch(e){} return _changeOracleThemeImpl(_p,_c,_v); }
function _changeOracleThemeImpl(primary, container, variant) {
        const theme = {
            primary: /^#[0-9a-f]{6}$/i.test(primary) ? primary : '#adc6ff',
            container: /^#[0-9a-f]{6}$/i.test(container) ? container : '#254487',
            variant: /^#[0-9a-f]{6}$/i.test(variant) ? variant : '#1f202e'
        };
        localStorage.setItem('oracle_matte_theme', JSON.stringify(theme));
        applyVisualTheme();
    }

        // --- ИСПРАВЛЕНИЯ СОХРАНЕНИЯ ПРОФИЛЯ ---

function changeOracleThemeRaspberry() {
    try { clearHalloweenIfThemeChange(); } catch (e) {}
    const isLight = document.body.classList.contains('light-theme');
    // Тёмная / True Black: #E11D48; светлая: чуть светлее
    const primary = isLight ? '#F43F5E' : '#E11D48';
    const container = isLight ? '#ffe4e6' : '#9f1239';
    const variant = isLight ? '#fff1f2' : '#4c0519';
    const theme = {
        primary: primary,
        container: container,
        variant: variant,
        isBW: false,
        isRaspberry: true
    };
    localStorage.setItem('oracle_matte_theme', JSON.stringify(theme));
    applyVisualTheme();
}

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
        // PIN после заставки
        if (localStorage.getItem('oracle_pin_on_screensaver') === 'true'
            && localStorage.getItem('oracle_pin_hash')
            && sessionStorage.getItem('oracle_pin_ok') !== '1') {
            if (typeof showPinUnlockModal === 'function') {
                showPinUnlockModal('После заставки', 'Введите PIN, чтобы продолжить');
            }
        }
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
            stopBtn?.classList.add('gen-active');
        } else {
            stopBtn?.classList.remove('gen-active');
            // In Live mode stop button stays as "end live"
            if (CoreState.isLiveChat) {
                stopBtn?.classList.remove('hidden');
                stopBtn?.classList.add('visible');
                liveBtn?.classList.add('hidden');
                voiceBtn?.classList.add('hidden');
            } else {
                stopBtn?.classList.add('hidden');
                stopBtn?.classList.remove('visible');
            }
            const input = document.getElementById('user-input');
            if (input) handleInput(input);
        }
    }

    function stopGeneration() {
        // Cancel pending timer / streaming
        if (CoreState.genTimer) {
            clearTimeout(CoreState.genTimer);
            CoreState.genTimer = null;
        }
        try {
            if (CoreState.apiAbort) {
                CoreState.apiAbort.abort();
                CoreState.apiAbort = null;
            }
        } catch (e) {}
        const wasStreaming = CoreState.isStreaming;
        CoreState.isStreaming = false;
        if (typeof showThinkingIndicator === 'function') showThinkingIndicator(false);

        // If generating → only stop generation; second click / live stop ends live
        if (wasStreaming) {
            setGenerating(false);
            showToast('Генерация остановлена', 'warning');
            return;
        }
        // Not generating: exit Live if active
        if (CoreState.isLiveChat && typeof stopLiveChat === 'function') {
            stopLiveChat();
            return;
        }
        setGenerating(false);
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
    var text = String(raw);
    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    if (typeof escapeAiHtml === 'function') esc = escapeAiHtml;

    // :::card Title \n body :::
    text = text.replace(/:::card\s*([^\n]*)\n([\s\S]*?):::/g, function(_, title, body) {
      return '<div class="ai-card"><div class="ai-card-title">' + esc(title.trim() || 'Заметка') + '</div><div>' + esc(body.trim()).replace(/\n/g,'<br>') + '</div></div>';
    });

    var blocks = [];
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, lang, code) {
      var i = blocks.length;
      blocks.push({ lang: lang || 'text', code: code.replace(/\n$/, '') });
      return '\n%%CODEBLOCK_' + i + '%%\n';
    });

    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, url) {
      return '<figure class="ai-figure"><img class="ai-gen-image" src="' + esc(url) + '" alt="' + esc(alt || '') + '" loading="lazy" onclick="typeof openAiImageViewer===\'function\'&&openAiImageViewer(this.src,this.alt)"/><figcaption>' + esc(alt || '') + '</figcaption></figure>';
    });

    text = text.replace(/`([^`\n]+)`/g, function(_, c) {
      return '<code class="ai-inline-code">' + esc(c) + '</code>';
    });

    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a class="ai-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    text = text.replace(/^### (.+)$/gm, '<h4 class="ai-h">$1</h4>');
    text = text.replace(/^## (.+)$/gm, '<h3 class="ai-h">$1</h3>');
    text = text.replace(/^# (.+)$/gm, '<h2 class="ai-h">$1</h2>');
    text = text.replace(/^---+$/gm, '<hr class="ai-hr"/>');

    text = text.replace(/(^> .+(?:\n> .+)*)/gm, function(block) {
      var inner = block.split('\n').map(function(l){ return l.replace(/^>\s?/, ''); }).join('<br>');
      return '<div class="ai-callout">' + inner + '</div>';
    });

    text = text.replace(/((?:^[\-\*] .+\n?)+)/gm, function(block) {
      if (block.indexOf('<ul') >= 0) return block;
      var items = block.trim().split('\n').filter(Boolean).map(function(l){
        return '<li>' + l.replace(/^[\-\*]\s+/, '') + '</li>';
      }).join('');
      return '<ul class="ai-ul">' + items + '</ul>';
    });

    text = text.replace(/((?:^\d+\. .+\n?)+)/gm, function(block) {
      var items = block.trim().split('\n').filter(Boolean).map(function(l){
        return '<li>' + l.replace(/^\d+\.\s+/, '') + '</li>';
      }).join('');
      return '<ol class="ai-ul">' + items + '</ol>';
    });

    text = text.replace(/(?:^\|.+\|\s*\n)(?:^\|[\s:\-|]+\|\s*\n)(?:^\|.+\|\s*\n?)+/gm, function(tbl) {
      var lines = tbl.trim().split('\n').filter(Boolean);
      if (lines.length < 2) return tbl;
      function split(line) {
        return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(function(c){ return c.trim(); });
      }
      var head = split(lines[0]);
      var body = lines.slice(2).map(split);
      var html = '<table class="ai-table"><thead><tr>' + head.map(function(h){ return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>';
      body.forEach(function(row) {
        html += '<tr>' + row.map(function(c){ return '<td>' + c + '</td>'; }).join('') + '</tr>';
      });
      return html + '</tbody></table>';
    });

    text = text.split(/\n{2,}/).map(function(para) {
      var p = para.trim();
      if (!p) return '';
      if (/^<(h[2-4]|ul|ol|div|table|pre|figure|hr)/.test(p)) return p;
      if (p.indexOf('%%CODEBLOCK_') >= 0) return p;
      return '<p class="ai-p">' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');

    text = text.replace(/%%CODEBLOCK_(\d+)%%/g, function(_, idx) {
      var b = blocks[Number(idx)];
      if (!b) return '';
      return '<div class="ai-code-wrap"><div class="ai-code-head"><span>' + esc(b.lang) + '</span><button type="button" class="icon-btn" style="width:28px;height:28px" onclick="navigator.clipboard.writeText(this.closest(\'.ai-code-wrap\').querySelector(\'code\').innerText);typeof showToast===\'function\'&&showToast(\'Скопировано\',\'success\')"><span class="material-symbols-rounded" style="font-size:16px">content_copy</span></button></div><pre class="ai-code-block"><code>' + esc(b.code) + '</code></pre></div>';
    });

    return text;
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
    const str = typeof content === 'string' ? content : String(content || '');
    // Trusted internal HTML (Halloween easter egg / meta footer)
    if (str.includes('ai-meta-foot') || str.includes('Kosmo Level · Halloween')) {
        body.innerHTML = str;
    } else if (str.includes('<') && str.includes('>') && !str.includes('```')) {
        body.innerHTML = renderAiMarkdown(str.replace(/<[^>]+>/g, ''));
    } else {
        body.innerHTML = renderAiMarkdown(str);
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
                    if (CoreState.isLiveChat && typeof speakLiveAiText === 'function') {
                        speakLiveAiText(result.text);
                    }
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
            if (CoreState.isLiveChat && typeof resumeLiveMicAfterReply === 'function') {
                setTimeout(resumeLiveMicAfterReply, 400);
            }
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
    // external-api requires key
    if (agentName === 'external-api' || agentName === 'Сторонний провайдер API') {
        const hasKey = !!(localStorage.getItem('oracle_custom_api_key') || localStorage.getItem('oracle_api_key') ||
            (localStorage.getItem('oracle_custom_api_enabled') === 'true'));
        if (!hasKey) {
            showToast?.('Подключите API ключ в настройках → Сторонние API', 'warning');
            return;
        }
        agentName = 'external-api';
    }
    CoreState.activeAgent = agentName;
    localStorage.setItem('oracle_active_agent', agentName);
    document.querySelectorAll('.agent-option').forEach(opt => opt.classList.remove('active'));
    if (agentName === 'Intify 2.5.4' || agentName === 'Oracle Main' || agentName === 'Worldpack AI' || agentName === 'Модель: Fast') {
        document.getElementById('opt-intify')?.classList.add('active');
        CoreState.activeAgent = 'Intify 2.5.4';
    }
    if (agentName === 'external-api') {
        document.getElementById('opt-external-api')?.classList.add('active');
    }
    syncExternalApiOptionUI();
    closePlusMenu();
    showToast?.('Модель: ' + (CoreState.activeAgent === 'external-api' ? 'Сторонний API' : CoreState.activeAgent), 'info', 1800);
}

function syncExternalApiOptionUI() {
    const desc = document.getElementById('opt-external-api-desc');
    const btn = document.getElementById('opt-external-api');
    const hasKey = !!(localStorage.getItem('oracle_custom_api_key') || localStorage.getItem('oracle_api_key') ||
        localStorage.getItem('oracle_custom_api_enabled') === 'true');
    const provider = localStorage.getItem('oracle_api_provider') || localStorage.getItem('oracle_custom_api_provider') || 'API';
    if (desc) {
        desc.textContent = hasKey
            ? ('Модель «' + provider + '», пока выбрана')
            : 'Подключите API ключ чтобы выбрать эту модель';
    }
    if (btn) {
        btn.classList.toggle('disabled', !hasKey);
        btn.style.opacity = hasKey ? '1' : '0.55';
        btn.style.pointerEvents = hasKey ? '' : 'none';
    }
}

function startLiveChat() {
    if (localStorage.getItem('oracle_live_privacy_ok') !== '1') {
        openLivePrivacyModal();
        return;
    }
    if (CoreState.isLiveChat) {
        // already on — treat as toggle off if idle
        if (!CoreState.isStreaming) stopLiveChat();
        return;
    }
    CoreState.isLiveChat = true;
    CoreState._liveSilenceTimer = null;
    CoreState._liveFinalBuf = '';
    CoreState._liveSending = false;
    document.body.classList.add('live-chat-active');
    document.getElementById('main-input-box')?.classList.add('live-mode');
    document.getElementById('live-chat-btn')?.classList.add('live-on');
    const livePanel = document.getElementById('live-session-panel');
    if (livePanel) { livePanel.hidden = false; livePanel.removeAttribute('hidden'); }
    const liveSub = document.getElementById('live-subtitles');
    if (liveSub) { liveSub.textContent = 'Слушаю…'; liveSub.hidden = false; }
    const liveIn0 = document.getElementById('live-user-input');
    if (liveIn0) liveIn0.value = '';
    const stopBtn = document.getElementById('stop-gen-btn');
    stopBtn?.classList.remove('hidden');
    stopBtn?.classList.add('visible');
    updateLiveModelChip();
    showToast('Live включён · пауза 2с → отправка · Стоп — выход', 'success', 3000);

    const input = document.getElementById('user-input');
    if (input) {
        if (!input.getAttribute('data-ph')) input.setAttribute('data-ph', input.placeholder || '');
        input.placeholder = 'Live · говорите… (2с тишины → отправка)';
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        showToast('Голос недоступен — можно печатать, Enter отправит', 'warning');
        return;
    }
    try {
        if (CoreState._liveRec) {
            try { CoreState._liveRec.onend = null; CoreState._liveRec.stop(); } catch (e) {}
        }
        const rec = new SR();
        CoreState._liveRec = rec;
        rec.lang = 'ru-RU';
        rec.continuous = true;
        rec.interimResults = true;

        const scheduleSilenceSend = () => {
            if (CoreState._liveSilenceTimer) clearTimeout(CoreState._liveSilenceTimer);
            CoreState._liveSilenceTimer = setTimeout(() => {
                if (!CoreState.isLiveChat || CoreState.isStreaming || CoreState._liveSending) return;
                const el = document.getElementById('user-input');
                const text = (el && el.value || '').trim();
                if (text.length < 2) return;
                CoreState._liveSending = true;
                CoreState._liveFinalBuf = '';
                try {
                    if (CoreState._liveRec) {
                        CoreState._liveRec.onend = null;
                        try { CoreState._liveRec.stop(); } catch (e) {}
                    }
                } catch (e) {}
                const subSend = document.getElementById('live-subtitles');
                if (subSend) subSend.textContent = 'Отправляю…';
                if (typeof sendMsg === 'function') sendMsg();
                setTimeout(() => {
                  const s2 = document.getElementById('live-subtitles');
                  if (s2 && CoreState.isLiveChat) s2.textContent = 'Слушаю…';
                  const li = document.getElementById('live-user-input');
                  if (li) li.value = '';
                }, 600);
                setTimeout(() => { CoreState._liveSending = false; }, 800);
            }, 2000);
        };

        rec.onresult = (ev) => {
            if (!CoreState.isLiveChat || CoreState.isStreaming) return;
            let interim = '';
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
                const tr = ev.results[i][0].transcript;
                if (ev.results[i].isFinal) CoreState._liveFinalBuf = (CoreState._liveFinalBuf || '') + tr + ' ';
                else interim += tr;
            }
            const spoken = ((CoreState._liveFinalBuf || '') + interim).trim();
            const el = document.getElementById('user-input');
            if (el) {
                el.value = spoken;
                if (typeof handleInput === 'function') handleInput(el);
            }
            const liveIn = document.getElementById('live-user-input');
            if (liveIn) liveIn.value = spoken;
            const sub = document.getElementById('live-subtitles');
            if (sub) {
                sub.textContent = spoken || 'Слушаю…';
                sub.hidden = false;
            }
            const panel = document.getElementById('live-session-panel');
            if (panel) { panel.hidden = false; panel.removeAttribute('hidden'); }
            scheduleSilenceSend();
        };
        rec.onerror = (ev) => {
            if (ev.error === 'aborted' || ev.error === 'no-speech') return;
            console.warn('live rec', ev.error);
        };
        rec.onend = () => {
            // restart only if still live and not streaming
            if (CoreState.isLiveChat && !CoreState.isStreaming && CoreState._liveRec === rec) {
                try { rec.start(); } catch (e) {}
            }
        };
        rec.start();
    } catch (e) {
        showToast('Микрофон: ' + (e.message || e), 'error');
    }
}

function stopLiveChat() {
    CoreState.isLiveChat = false;
    if (CoreState._liveSilenceTimer) {
        clearTimeout(CoreState._liveSilenceTimer);
        CoreState._liveSilenceTimer = null;
    }
    CoreState._liveFinalBuf = '';
    CoreState._liveSending = false;
    document.body.classList.remove('live-chat-active');
    document.getElementById('main-input-box')?.classList.remove('live-mode');
    document.getElementById('live-chat-btn')?.classList.remove('live-on');
    const livePanelStop = document.getElementById('live-session-panel');
    if (livePanelStop) livePanelStop.hidden = true;
    const liveSubStop = document.getElementById('live-subtitles');
    if (liveSubStop) liveSubStop.textContent = 'Слушаю…';
    const liveInStop = document.getElementById('live-user-input');
    if (liveInStop) liveInStop.value = '';
    try {
        if (CoreState._liveRec) {
            CoreState._liveRec.onend = null;
            CoreState._liveRec.onresult = null;
            CoreState._liveRec.stop();
        }
    } catch (e) {}
    CoreState._liveRec = null;
    try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
    const stopBtn = document.getElementById('stop-gen-btn');
    stopBtn?.classList.add('hidden');
    stopBtn?.classList.remove('visible');
    const input = document.getElementById('user-input');
    if (input) {
        input.placeholder = input.getAttribute('data-ph') || 'Спросите что-нибудь…';
        if (typeof handleInput === 'function') handleInput(input);
    }
    const chip = document.getElementById('live-model-chip');
    if (chip) chip.style.display = 'none';
    showToast('Live выключен', 'info');
}

function closeLiveChatModal() {
    document.getElementById('live-chat-modal')?.classList.remove('active');
    document.body.style.overflow = '';
}

function updateLiveModelChip() {
    let chip = document.getElementById('live-model-chip');
    if (!chip) {
        const bar = document.querySelector('.input-left-actions') || document.querySelector('.input-bottom-bar');
        if (!bar) return;
        chip = document.createElement('button');
        chip.type = 'button';
        chip.id = 'live-model-chip';
        chip.className = 'live-model-chip';
        chip.title = 'В Live — быстрая lite-модель';
        bar.appendChild(chip);
    }
    const s = typeof loadCustomApiState === 'function' ? loadCustomApiState() : {};
    const p = (s.provider || 'local');
    const labels = { gemini: 'Gemini Lite', openai: 'GPT mini', claude: 'Haiku', grok: 'Grok' };
    chip.textContent = 'Live · ' + (labels[p] || 'Assistant');
    chip.style.display = CoreState.isLiveChat ? 'inline-flex' : 'none';
}

function speakLiveAiText(text) {
    if (!CoreState.isLiveChat) return;
    if (!window.speechSynthesis) return;
    const plain = String(text || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#>*_`]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1200);
    if (!plain) return;
    try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(plain);
        u.lang = 'ru-RU';
        u.rate = 1.02;
        speechSynthesis.speak(u);
    } catch (e) {}
}

function resumeLiveMicAfterReply() {
    if (!CoreState.isLiveChat || CoreState.isStreaming) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
        if (CoreState._liveRec) {
            CoreState._liveRec.onend = null;
            try { CoreState._liveRec.stop(); } catch (e) {}
        }
        const rec = new SR();
        CoreState._liveRec = rec;
        rec.lang = 'ru-RU';
        rec.continuous = true;
        rec.interimResults = true;
        CoreState._liveFinalBuf = '';
        const scheduleSilenceSend = () => {
            if (CoreState._liveSilenceTimer) clearTimeout(CoreState._liveSilenceTimer);
            CoreState._liveSilenceTimer = setTimeout(() => {
                if (!CoreState.isLiveChat || CoreState.isStreaming || CoreState._liveSending) return;
                const el = document.getElementById('user-input');
                const text = (el && el.value || '').trim();
                if (text.length < 2) return;
                CoreState._liveSending = true;
                CoreState._liveFinalBuf = '';
                try {
                    if (CoreState._liveRec) {
                        CoreState._liveRec.onend = null;
                        try { CoreState._liveRec.stop(); } catch (e) {}
                    }
                } catch (e) {}
                if (typeof sendMsg === 'function') sendMsg();
                setTimeout(() => { CoreState._liveSending = false; }, 800);
            }, 2000);
        };
        rec.onresult = (ev) => {
            if (!CoreState.isLiveChat || CoreState.isStreaming) return;
            let interim = '';
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
                const tr = ev.results[i][0].transcript;
                if (ev.results[i].isFinal) CoreState._liveFinalBuf = (CoreState._liveFinalBuf || '') + tr + ' ';
                else interim += tr;
            }
            const el = document.getElementById('user-input');
            if (el) {
                el.value = ((CoreState._liveFinalBuf || '') + interim).trim();
                if (typeof handleInput === 'function') handleInput(el);
            }
            scheduleSilenceSend();
        };
        rec.onend = () => {
            if (CoreState.isLiveChat && !CoreState.isStreaming && CoreState._liveRec === rec) {
                try { rec.start(); } catch (e) {}
            }
        };
        rec.start();
    } catch (e) {}
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
    openExpandedInput();
}

function expFocusEditor() {
  const editor = document.getElementById('exp-user-editor');
  if (!editor) return null;
  editor.focus();
  return editor;
}
function expFormat(cmd) {
  const editor = expFocusEditor();
  if (!editor) return;
  try {
    // ensure selection stays inside editor
    const sel = window.getSelection();
    if (!sel.rangeCount || !editor.contains(sel.anchorNode)) {
      placeCaretEnd(editor);
    }
    document.execCommand(cmd, false, null);
  } catch (e) { console.warn('expFormat', cmd, e); }
  expSyncFromEditor();
}
function expClearFormat() {
  const editor = expFocusEditor();
  if (!editor) return;
  try {
    document.execCommand('removeFormat', false, null);
    document.execCommand('unlink', false, null);
    // also flatten font tags
    const plain = editor.innerText;
    // keep line breaks
    const html = (editor.innerText || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    editor.innerHTML = html || '';
    placeCaretEnd(editor);
  } catch (e) { console.warn('expClearFormat', e); }
  expSyncFromEditor();
}
function expSyncFromEditor() {
  const editor = document.getElementById('exp-user-editor');
  const mainInput = document.getElementById('user-input');
  if (!editor || !mainInput) return;
  mainInput.value = (editor.innerText || '').replace(/\u00a0/g, ' ');
  if (typeof handleInput === 'function') handleInput(mainInput);
}
function toggleExpSizeMenu(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const wrap = document.getElementById('exp-font-size-picker');
  if (!wrap) return;
  const open = wrap.classList.toggle('open');
  const menu = document.getElementById('exp-font-menu');
  if (menu) {
    menu.style.display = open ? 'flex' : 'none';
    // drop-up if no space below
    const rect = wrap.getBoundingClientRect();
    if (rect.top < 160) {
      menu.classList.remove('drop-up');
    } else {
      menu.classList.add('drop-up');
    }
  }
}
function selectExpFontSize(px) {
  const editor = expFocusEditor();
  if (!editor) return;
  const label = document.getElementById('exp-font-size-label');
  if (label) label.textContent = String(px);
  try {
    // execCommand fontSize only accepts 1-7; use span style instead
    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) {
      // apply as default style for typing
      editor.style.fontSize = px + 'px';
    } else {
      const range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) {
        editor.style.fontSize = px + 'px';
      } else {
        const span = document.createElement('span');
        span.style.fontSize = px + 'px';
        try {
          range.surroundContents(span);
        } catch (err) {
          // fallback extract
          const frag = range.extractContents();
          span.appendChild(frag);
          range.insertNode(span);
        }
        sel.removeAllRanges();
        const r2 = document.createRange();
        r2.selectNodeContents(span);
        r2.collapse(false);
        sel.addRange(r2);
      }
    }
  } catch (e) { console.warn('selectExpFontSize', e); }
  // close menu
  const wrap = document.getElementById('exp-font-size-picker');
  wrap?.classList.remove('open');
  const menu = document.getElementById('exp-font-menu');
  if (menu) menu.style.display = 'none';
  document.querySelectorAll('#exp-font-menu .custom-select-option').forEach(function(btn){
    btn.classList.toggle('active', btn.textContent.trim() === String(px));
  });
  expSyncFromEditor();
}
// close size menu on outside click
document.addEventListener('click', function(ev){
  const wrap = document.getElementById('exp-font-size-picker');
  if (!wrap || wrap.contains(ev.target)) return;
  wrap.classList.remove('open');
  const menu = document.getElementById('exp-font-menu');
  if (menu) menu.style.display = 'none';
});
// keyboard shortcuts when expanded
document.addEventListener('keydown', function(ev){
  if (!document.body.classList.contains('exp-input-open')) return;
  const editor = document.getElementById('exp-user-editor');
  if (!editor || !editor.contains(document.activeElement) && document.activeElement !== editor) return;
  if (!(ev.ctrlKey || ev.metaKey)) return;
  const k = ev.key.toLowerCase();
  if (k === 'b') { ev.preventDefault(); expFormat('bold'); }
  else if (k === 'i') { ev.preventDefault(); expFormat('italic'); }
  else if (k === 'u') { ev.preventDefault(); expFormat('underline'); }
});


function openExpandedInput() {
    const sheet = document.getElementById('expanded-input-sheet');
    const mainInput = document.getElementById('user-input');
    const editor = document.getElementById('exp-user-editor');
    if (!sheet || !mainInput || !editor) {
      // fallback: grow textarea
      if (mainInput) {
        mainInput.style.minHeight = '120px';
        mainInput.focus();
      }
      return;
    }
    editor.innerHTML = '';
    const plain = mainInput.value || '';
    editor.innerText = plain;
    // sync from contenteditable if main was empty but chips
    sheet.classList.add('active');
    document.body.classList.add('exp-input-open');
    setTimeout(() => { editor.focus(); placeCaretEnd(editor); }, 40);
}
function placeCaretEnd(el) {
  try {
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  } catch (e) {}
}
function closeFullscreenInput() { closeExpandedInput(); }
function closeExpandedInput() {
    const sheet = document.getElementById('expanded-input-sheet');
    const mainInput = document.getElementById('user-input');
    const editor = document.getElementById('exp-user-editor');
    if (mainInput && editor) {
        mainInput.value = (editor.innerText || '').replace(/\u00a0/g, ' ');
        if (typeof handleInput === 'function') handleInput(mainInput);
    }
    sheet?.classList.remove('active');
    document.body.classList.remove('exp-input-open');
}
function sendFromFullscreen() { sendFromExpanded(); }
function sendFromExpanded() {
    const mainInput = document.getElementById('user-input');
    const editor = document.getElementById('exp-user-editor');
    if (mainInput && editor) {
        mainInput.value = (editor.innerText || '').replace(/\u00a0/g, ' ');
    }
    closeExpandedInput();
    if (typeof sendMsg === 'function') sendMsg();
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

    // Мобильные: НЕ открываем расширенное поле автоматически (только по кнопке expand)
    // mainInput focus stays compact one-line

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
    e.stopPropagation();
    const menu = document.getElementById('nav-context-menu');
    if (!menu) return;
    const isBottom = document.body.classList.contains('nav-bottom');
    const isFlush = document.body.classList.contains('nav-flush');
    const isCompact = document.body.classList.contains('compact-nav-mode');
    const setLabel = (id, text) => {
        const el = document.getElementById(id);
        if (!el) return;
        const lab = el.querySelector('.nav-ctx-label');
        if (lab) lab.textContent = text;
        else {
            const icon = el.querySelector('.material-symbols-rounded');
            el.innerHTML = (icon ? icon.outerHTML + ' ' : '') + '<span class="nav-ctx-label">' + text + '</span>';
        }
    };
    setLabel('nav-ctx-compact', isCompact ? 'Сделать Просторнее' : 'Сделать Компактнее навигацию');
    setLabel('nav-ctx-move', isBottom ? 'Переместить вверх' : 'Переместить вниз');
    setLabel('nav-ctx-flush', isFlush ? 'Отлиять от концов' : 'Слиять с Концами');
    // extras: tabs not in main nav
    const extras = document.getElementById('nav-ctx-extras');
    const div = document.getElementById('nav-ctx-divider');
    const inNav = new Set(typeof getNavTabs === 'function' ? getNavTabs() : ['chat','reader','settings']);
    const extraTabs = [
        { id: 'library', label: 'Библиотека', icon: 'folder_open' },
        { id: 'calendar', label: 'Планы и календарь', icon: 'calendar_month' },
        { id: 'maps', label: 'Карты', icon: 'map' },
        { id: 'reader', label: 'Reader', icon: 'auto_stories' },
        { id: 'settings', label: 'Settings', icon: 'settings' }
    ].filter(t => !inNav.has(t.id));
    if (extras) {
        extras.innerHTML = extraTabs.map(t =>
            '<button type="button" class="nav-ctx-item nav-ctx-extra" data-tab="' + t.id + '">' +
            '<span class="material-symbols-rounded">' + t.icon + '</span> ' + t.label +
            ' <span class="setting-new-badge">НОВИНКА</span></button>'
        ).join('');
        extras.querySelectorAll('.nav-ctx-extra').forEach(btn => {
            btn.onclick = () => {
                menu.classList.remove('open');
                if (typeof navGo === 'function') navGo(btn.dataset.tab);
            };
        });
    }
    if (div) div.hidden = !extraTabs.length;
    menu.classList.add('open');
    const w = 280, h = 52 + (extraTabs.length + 3) * 40;
    let x = e.clientX, y = e.clientY;
    if (x + w > window.innerWidth) x = window.innerWidth - w - 8;
    if (y + h > window.innerHeight) y = Math.max(8, window.innerHeight - h - 8);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

function navCtxCompact() {
    toggleCompactNav();
    document.getElementById('nav-context-menu')?.classList.remove('open');
    showToast?.(document.body.classList.contains('compact-nav-mode') ? 'Компактная навигация' : 'Просторная навигация', 'success');
}
function navCtxMove() {
    const isBottom = document.body.classList.contains('nav-bottom');
    setNavPosition(isBottom ? 'top' : 'bottom');
    document.getElementById('nav-context-menu')?.classList.remove('open');
}
function navCtxFlush() {
    toggleFlushNav();
    document.getElementById('nav-context-menu')?.classList.remove('open');
    showToast?.(document.body.classList.contains('nav-flush') ? 'Слито с краями' : 'Отлеплено от краёв', 'success');
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('nav-context-menu');
    if (menu && !menu.contains(e.target)) menu.classList.remove('open');
});

// ===== ONBOARDING TIPS =====
const ONBOARDING_SLIDES = [
    { icon: 'auto_awesome', title: 'Новинки 14.10', text: 'Офлайн-режим для Планов и Reader, Карты в бете, @коннекторы, Later Generate, история ответов 1/2 и новый «Изменить» запрос.' },
    { icon: 'verified_user', title: 'Вы хозяин функций', text: 'Данные Core Node хранятся только у вас в браузере и не уходят третьим лицам без вашего согласия. Чаты, настройки, истории и файлы — локально. Рекламы не будет.' },
    { icon: 'extension', title: 'Side Core Node', text: 'Мини-ИИ в боковой панели браузера. Тема, акцент и API настраиваются там же. Скачайте расширение ZIP с официального сайта.', download: 'https://oracle-ai-pro.github.io/oracle/side-core-node.zip', downloadLabel: 'Скачать Side Core Node' },
    { icon: 'share', title: 'Новинка: Совместные чаты', text: 'ПКМ по чату → «Поделиться». Ссылка вида /public-chat/…. Вы управляете доступом и можете отозвать ссылку в любой момент.' },
    { icon: 'folder_open', title: 'Представляем Проекты с Чатами и файлами', text: 'Папки-проекты с жёсткими источниками, ветки чатов и файлы в одном дереве. Порядок вместо хаоса длинных списков.' }
];
let _onboardingIndex = 0;
let _onboardingTimer = null;
let _onboardingPreview = false;

function renderOnboardingSlide() {
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    const slides = ONBOARDING_SLIDES;
    const i = _onboardingIndex;
    const s = slides[i] || slides[0];
    const icon = document.getElementById('onboarding-icon');
    const title = document.getElementById('onboarding-title');
    const text = document.getElementById('onboarding-text');
    const bar = document.getElementById('onboarding-progress-bar');
    const dots = document.getElementById('onboarding-dots');
    const nextBtn = document.getElementById('onboarding-next-btn');
    if (icon) icon.textContent = s.icon;
    if (title) title.textContent = s.title;
    if (text) text.textContent = s.text;
    let extra = document.getElementById('onboarding-extra');
    if (!extra && text && text.parentElement) {
        extra = document.createElement('div');
        extra.id = 'onboarding-extra';
        extra.className = 'onboarding-extra';
        text.parentElement.insertBefore(extra, text.nextSibling);
    }
    if (extra) {
        if (s.download) {
            extra.innerHTML = '<a class="onboarding-download-btn" href="' + s.download + '" download target="_blank" rel="noopener">' +
                '<span class="material-symbols-rounded">download</span> ' + (s.downloadLabel || 'Скачать') + '</a>';
            extra.hidden = false;
        } else {
            extra.innerHTML = '';
            extra.hidden = true;
        }
    }
    if (bar) bar.style.width = (((i + 1) / slides.length) * 100) + '%';
    if (dots) {
        dots.innerHTML = slides.map((_, di) =>
            '<span class="onboarding-dot' + (di === i ? ' active' : '') + '"></span>'
        ).join('');
    }
    if (nextBtn) nextBtn.textContent = (i >= slides.length - 1) ? 'Готово' : 'Далее';
}

function startOnboarding(force) {
    if (!force && localStorage.getItem('oracle_onboarding_done') === 'true') return;
    _onboardingPreview = !!force;
    _onboardingIndex = 0;
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    overlay.hidden = false;
    overlay.classList.add('active');
    renderOnboardingSlide();
    clearInterval(_onboardingTimer);
    _onboardingTimer = setInterval(() => {
        if (_onboardingIndex < ONBOARDING_SLIDES.length - 1) {
            _onboardingIndex++;
            renderOnboardingSlide();
        } else {
            clearInterval(_onboardingTimer);
        }
    }, 5500);
}

function nextOnboarding() {
    if (_onboardingIndex >= ONBOARDING_SLIDES.length - 1) {
        finishOnboarding();
        return;
    }
    _onboardingIndex++;
    renderOnboardingSlide();
    clearInterval(_onboardingTimer);
    _onboardingTimer = setInterval(() => {
        if (_onboardingIndex < ONBOARDING_SLIDES.length - 1) {
            _onboardingIndex++;
            renderOnboardingSlide();
        } else clearInterval(_onboardingTimer);
    }, 5500);
}

function skipOnboarding() { finishOnboarding(); }

function finishOnboarding() {
    clearInterval(_onboardingTimer);
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.hidden = true;
    }
    if (!_onboardingPreview) {
        localStorage.setItem('oracle_onboarding_done', 'true');
        // Старые отдельные модалки заменены OOBE — помечаем всё просмотренным
        localStorage.setItem('oracle_consent', localStorage.getItem('oracle_consent') || 'all');
        localStorage.setItem('oracle_share_tip_seen', 'true');
        localStorage.setItem('oracle_tree_feature_seen_v1', 'true');
        localStorage.setItem('oracle_oct14_novelty', '1');
        localStorage.setItem('oracle_side_core_promo', '1');
    }
    _onboardingPreview = false;
    document.body.classList.remove('onboarding-open');
}

/** Консоль: previewOnboarding() — показать обучение снова */
window.previewOnboarding = function() {
    localStorage.removeItem('oracle_onboarding_done');
    startOnboarding(true);
};
window.startOnboarding = startOnboarding;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => startOnboarding(false), 700);
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
function syncSidebarDockUI() {
    const docked = document.body.classList.contains('sidebar-docked');
    const label = document.getElementById('dock-toggle-label');
    if (label) label.textContent = docked ? 'Скрыть боковое меню' : 'Закрепить меню';
    const icon = document.getElementById('sidebar-dock-icon');
    if (icon) icon.textContent = docked ? 'keep_off' : 'keep';
    const btn = document.getElementById('sidebar-dock-toggle');
    if (btn) btn.title = docked ? 'Открепить меню' : 'Закрепить меню';
}

function toggleSidebarDock() {
    const docked = document.body.classList.toggle('sidebar-docked');
    localStorage.setItem('oracle_sidebar_docked', docked ? 'true' : 'false');
    syncSidebarDockUI();
    if (docked) {
        document.getElementById('sidebar-archive')?.classList.add('open');
    }
}

/** Крестик: если меню закреплено — сначала открепляем и закрываем */
function toggleSidebarOrUndock() {
    if (document.body.classList.contains('sidebar-docked')) {
        document.body.classList.remove('sidebar-docked');
        localStorage.setItem('oracle_sidebar_docked', 'false');
        syncSidebarDockUI();
        document.getElementById('sidebar-archive')?.classList.remove('open');
        showToast?.('Меню откреплено', 'success');
        return;
    }
    if (typeof toggleSidebar === 'function') toggleSidebar();
}

/** Экстренный сброс закрепления (и для консоли: undockSidebar()) */
function undockSidebar() {
    document.body.classList.remove('sidebar-docked');
    localStorage.setItem('oracle_sidebar_docked', 'false');
    document.getElementById('sidebar-archive')?.classList.remove('open');
    syncSidebarDockUI();
    showToast?.('Боковое меню откреплено', 'success');
}
window.undockSidebar = undockSidebar;

// ===== SECURITY TOGGLES =====
let _lockScreenIdleTimer = null;
const LOCK_SCREEN_IDLE_MS = 5 * 60 * 1000; // 5 мин

function syncLockScreenBtn() {
    const on = localStorage.getItem('oracle_lock_screen') === 'true';
    const btn = document.getElementById('lock-screen-btn');
    if (btn) {
        btn.innerText = on ? 'ВЫКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ';
        btn.style.background = on ? 'var(--primary-container)' : 'var(--surface-variant)';
        btn.style.color = on ? 'var(--primary)' : 'var(--on-surface)';
    }
}
function resetLockScreenIdle() {
    clearTimeout(_lockScreenIdleTimer);
    if (localStorage.getItem('oracle_lock_screen') !== 'true') return;
    if (!localStorage.getItem('oracle_pin_hash')) return;
    if (document.body.classList.contains('pin-locked')) return;
    _lockScreenIdleTimer = setTimeout(() => {
        if (localStorage.getItem('oracle_lock_screen') !== 'true') return;
        if (!localStorage.getItem('oracle_pin_hash')) return;
        sessionStorage.removeItem('oracle_pin_ok');
        if (typeof showPinUnlockModal === 'function') showPinUnlockModal('Блокировка', 'Введите PIN — экран был неактивен 5 минут');
        else if (typeof maybeAskPinOnEntry === 'function') {
            // force unlock UI
            sessionStorage.removeItem('oracle_pin_ok');
            localStorage.setItem('oracle_pin_on_entry', 'true');
            maybeAskPinOnEntry();
        }
    }, LOCK_SCREEN_IDLE_MS);
}
function initLockScreenIdle() {
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
        window.addEventListener(evt, () => resetLockScreenIdle(), { passive: true });
    });
    resetLockScreenIdle();
}
function toggleLockScreen() {
    if (!localStorage.getItem('oracle_pin_hash')) {
        showToast('Сначала создайте PIN', 'warning');
        return;
    }
    const on = localStorage.getItem('oracle_lock_screen') === 'true';
    localStorage.setItem('oracle_lock_screen', on ? 'false' : 'true');
    syncLockScreenBtn();
    if (!on) resetLockScreenIdle();
    else clearTimeout(_lockScreenIdleTimer);
    showToast(!on ? 'Блокировка экрана: PIN через 5 мин бездействия' : 'Блокировка экрана выключена', 'success');
}

/** Раньше «Скрыть историю» → теперь: не показывать содержимое чатов без PIN */
function toggleHideHistory() {
    if (!localStorage.getItem('oracle_pin_hash')) {
        showToast('Сначала создайте PIN', 'warning');
        return;
    }
    const on = localStorage.getItem('oracle_pin_hide_content') === 'true';
    localStorage.setItem('oracle_pin_hide_content', on ? 'false' : 'true');
    // legacy key cleanup
    localStorage.removeItem('oracle_hide_history');
    const btn = document.getElementById('hide-history-btn');
    if (btn) {
        btn.innerText = !on ? 'ВЫКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ';
        btn.style.background = !on ? 'var(--primary-container)' : 'var(--surface-variant)';
        btn.style.color = !on ? 'var(--primary)' : 'var(--on-surface)';
    }
    applyPinContentLock();
    showToast(!on ? 'Содержимое чатов скрыто до ввода PIN' : 'Содержимое чатов видно', 'success');
}
function applyPinContentLock() {
    const need = localStorage.getItem('oracle_pin_hide_content') === 'true'
        && !!localStorage.getItem('oracle_pin_hash')
        && sessionStorage.getItem('oracle_pin_ok') !== '1';
    document.body.classList.toggle('pin-content-locked', need);
    if (need && typeof showPinUnlockModal === 'function' && !document.body.classList.contains('pin-locked')) {
        showPinUnlockModal('Содержимое скрыто', 'Введите PIN, чтобы увидеть сообщения');
    }
}
function syncHideContentBtn() {
    const on = localStorage.getItem('oracle_pin_hide_content') === 'true';
    const btn = document.getElementById('hide-history-btn');
    if (btn) {
        btn.innerText = on ? 'ВЫКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ';
        btn.style.background = on ? 'var(--primary-container)' : 'var(--surface-variant)';
        btn.style.color = on ? 'var(--primary)' : 'var(--on-surface)';
    }
}
function clearAllLocalData() {
    const doWipe = () => {
        showCustomModal('Удалить всё?', 'Будут удалены чаты, истории, файлы и настройки. Это необратимо.', false, '', (ok) => {
            if (!ok) return;
            const keep = ['oracle_onboarding_done', 'oracle_consent'];
            Object.keys(localStorage).forEach(k => {
                if (k.startsWith('oracle_') && !keep.includes(k)) localStorage.removeItem(k);
            });
            sessionStorage.clear();
            showToast('Данные очищены. Перезагрузите страницу.', 'warning');
            setTimeout(() => location.reload(), 900);
        });
    };
    // Серьёзная операция: если PIN есть — сначала подтвердить
    if (localStorage.getItem('oracle_pin_hash')) {
        requireCurrentPin('Очистка данных', 'Введите текущий PIN, чтобы удалить все локальные данные Core Node.', doWipe);
    } else {
        doWipe();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof updatePinStatusUI === 'function') updatePinStatusUI();
    updateMemoryUI();
    renderLibraryFiles();
    updateAttachLimitUI();
    if (localStorage.getItem('oracle_sidebar_docked') === 'true') {
        document.body.classList.add('sidebar-docked');
        document.getElementById('sidebar-archive')?.classList.add('open');
    }
    if (typeof syncSidebarDockUI === 'function') syncSidebarDockUI();
});

// ===== CONSENT + SHARED CHATS =====
let pendingPublicImport = null;
let lastShareId = null;

function acceptConsent(mode) {
    localStorage.setItem('oracle_consent', mode || 'all');
    localStorage.setItem('oracle_share_tip_seen', 'true');
    // Старые модалки удалены — всё покрывает onboarding OOBE
}
function closeShareTip() {
    localStorage.setItem('oracle_share_tip_seen', 'true');
}

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
    
/* deduped: earlier window.showSection removed */

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
    if (!localStorage.getItem('oracle_consent') && !localStorage.getItem('oracle_onboarding_done')) {
        /* consent modal removed — OOBE covers this */
        localStorage.setItem('oracle_consent', 'all');
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
    maps:     { label: 'Карты', icon: 'map' },
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
        const opts = ['reader','library','calendar','maps','settings'].filter(x => x !== s2);
        s3 = opts[0];
    }
    saveNavTabs(['chat', s2, s3]);
    showToast('Навигация обновлена', 'success');
}

const NAV_SLOT_OPTIONS = [
    { v: 'reader', t: 'Reader' },
    { v: 'library', t: 'Библиотека файлов' },
    { v: 'calendar', t: 'Календарь и планы' },
    { v: 'maps', t: 'Карты' },
    { v: 'settings', t: 'Settings' }
];

function fillNavSlotSelects() {
    const tabs = getNavTabs();
    ['2','3'].forEach((slot, i) => {
        const hidden = document.getElementById('nav-slot-' + slot);
        const label = document.getElementById('nav-slot-' + slot + '-label');
        const menu = document.getElementById('nav-slot-' + slot + '-menu');
        const current = tabs[i + 1] || (slot === '2' ? 'reader' : 'settings');
        if (hidden) hidden.value = current;
        const opt = NAV_SLOT_OPTIONS.find(o => o.v === current) || NAV_SLOT_OPTIONS[0];
        if (label) label.textContent = opt.t;
        if (menu) {
            menu.innerHTML = '';
            NAV_SLOT_OPTIONS.forEach(o => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'custom-select-option' + (o.v === current ? ' active' : '');
                btn.setAttribute('data-value', o.v);
                btn.textContent = o.t;
                btn.addEventListener('click', () => selectNavSlot(slot, o.v));
                menu.appendChild(btn);
            });
        }
    });
}

function toggleNavSlotMenu(e, slot) {
    e.preventDefault();
    e.stopPropagation();
    const wrap = document.getElementById('nav-slot-' + slot + '-wrap');
    document.querySelectorAll('.nav-slot-select.open').forEach(w => {
        if (w !== wrap) w.classList.remove('open');
    });
    wrap?.classList.toggle('open');
}

function selectNavSlot(slot, value) {
    const hidden = document.getElementById('nav-slot-' + slot);
    if (hidden) hidden.value = value;
    document.getElementById('nav-slot-' + slot + '-wrap')?.classList.remove('open');
    saveNavTabsFromUI();
    fillNavSlotSelects();
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-slot-select')) {
        document.querySelectorAll('.nav-slot-select.open').forEach(w => w.classList.remove('open'));
    }
});

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
    else if (tabId === 'maps') switchScreen('maps');
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
    box.innerHTML = '';
    box.hidden = true;
    box.style.display = 'none';
    // Доп. вкладки (Библиотека / Планы / Карты / …) — только в ПКМ по верхней навигации
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
    } else if (mode === 'chat-context' || mode === 'chat-sidenotes') {
        const ctxScreen = (typeof ensureContextSplitPane === 'function') ? ensureContextSplitPane() : null;
        if (ctxScreen) {
          ctxScreen.classList.add('active-screen');
          rightPane.appendChild(ctxScreen);
          if (typeof loadSplitContextEditor === 'function') loadSplitContextEditor();
        }
        const sn = document.getElementById('split-story-name');
        if (sn) sn.textContent = 'Контекст';
        const box = document.querySelector('.oracle-container');
        if (readerScreen) box?.appendChild(readerScreen);
        if (notepadScreen) box?.appendChild(notepadScreen);
        box?.appendChild(second);
        setSplitDualInputs(false);
        // phones: force vertical
        if (window.matchMedia('(max-width: 767px)').matches) {
          CoreState.splitOrientation = 'vertical';
          document.body.classList.remove('horizontal');
          document.body.classList.add('vertical');
        }
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
    showToast('Split: ' + (mode === 'chat-notepad' ? 'Chat + Notepad' : mode === 'chat-chat' ? 'Два чата' : mode === 'chat-context' || mode === 'chat-sidenotes' ? 'Контекст' : 'Chat + История'), 'success');
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
    // Backward compatibility: the older library menu passes an array index.
    if (typeof fileId === 'number' && confirmFirst === undefined) {
        const list = loadFileLibrary();
        if (!list[fileId]) return;
        showCustomModal(
            'Удалить файл?',
            '<b>Внимание:</b> ИИ может путаться в деталях, если вы удалите файл и не отправите новый документ, код или вложение. Продолжить удаление «' + escapeHtml(list[fileId].name) + '»?',
            false, '',
            (ok) => {
                if (!ok) return;
                list.splice(fileId, 1);
                saveFileLibrary(list);
                showToast('Файл удалён', 'success');
            }
        );
        return;
    }

    const run = () => {
        const files = getFileLibrary().filter(x => String(x.id) !== String(fileId));
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
    
/* deduped switchScreen wrap */

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
    try { requestNotificationPermissionForPlans().then(() => syncRemindersToServiceWorker()); } catch (e) {};
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
    const root = btn.closest('.ai-msg, .msg, .ai-bubble') || btn.parentElement;
    const t = (root?.innerText || '').trim();
    if (!t) { showToast('Нечего копировать', 'warning'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function() {
            if (typeof window.showCopyFragmentToast === 'function') window.showCopyFragmentToast(t);
            else showToast('Скопировано', 'success');
        }).catch(function() { showToast('Не удалось', 'error'); });
    } else {
        showToast('Буфер обмена недоступен', 'warning');
    }
}
let _aiFeedback = { btn: null, value: 0, reason: '' };

const FB_REASONS_UP = [
    'Точный ответ', 'Полезно', 'Хороший стиль', 'Быстро понял задачу', 'Другое'
];
const FB_REASONS_DOWN = [
    'Ошибка / неверно', 'Не по теме', 'Слишком длинно', 'Галлюцинация', 'Другое'
];

function rateAi(btn, v) {
    _aiFeedback = { btn: btn, value: v, reason: '' };
    const modal = document.getElementById('ai-feedback-modal');
    const icon = document.getElementById('ai-fb-icon');
    const title = document.getElementById('ai-fb-title');
    const box = document.getElementById('ai-fb-reasons');
    const custom = document.getElementById('ai-fb-custom');
    if (icon) icon.textContent = v ? 'thumb_up' : 'thumb_down';
    if (title) title.textContent = v ? 'Почему ответ понравился?' : 'Что не так с ответом?';
    if (custom) custom.value = '';
    if (box) {
        box.innerHTML = '';
        (v ? FB_REASONS_UP : FB_REASONS_DOWN).forEach(label => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'fb-reason-chip';
            b.textContent = label;
            b.onclick = () => {
                box.querySelectorAll('.fb-reason-chip').forEach(x => x.classList.remove('active'));
                b.classList.add('active');
                _aiFeedback.reason = label;
            };
            box.appendChild(b);
        });
    }
    if (modal) modal.classList.add('active');
    else showToast(v ? 'Спасибо за оценку' : 'Учтём', 'success');
}

function closeAiFeedbackModal(submit) {
    const modal = document.getElementById('ai-feedback-modal');
    const custom = document.getElementById('ai-fb-custom');
    if (submit) {
        const extra = (custom?.value || '').trim();
        if (extra) _aiFeedback.reason = extra;
        const v = _aiFeedback.value;
        const reason = _aiFeedback.reason || '';
        try {
            const key = 'oracle_ai_feedback_log';
            const log = JSON.parse(localStorage.getItem(key) || '[]');
            log.push({ at: Date.now(), like: !!v, reason, session: currentSessionId || null });
            localStorage.setItem(key, JSON.stringify(log.slice(-200)));
        } catch (e) {}
        const btn = _aiFeedback.btn;
        if (btn) {
            btn.classList.add('active');
            const bar = btn.closest('.ai-actions');
            bar?.querySelectorAll('.ai-act-like, .ai-act-dislike').forEach(b => {
                if (b !== btn) b.classList.remove('active');
            });
        }
        showToast(v ? (reason ? 'Спасибо · ' + reason : 'Спасибо, модель учтёт') : (reason ? 'Учтём · ' + reason : 'Учтём для обучения'), 'success');
    }
    modal?.classList.remove('active');
    _aiFeedback = { btn: null, value: 0, reason: '' };
}

function setLogoAnimNew(on) {
    localStorage.setItem('oracle_logo_anim_new', on ? '1' : '0');
    applyLogoAnimPref();
    if (typeof showToast === 'function') {
        showToast(on ? 'Новая анимация логотипа (бета)' : 'Классические блобы', 'success');
    }
}

function applyLogoAnimPref() {
    const on = localStorage.getItem('oracle_logo_anim_new') !== '0';
    document.body.classList.toggle('logo-anim-legacy', !on);
    const t = document.getElementById('toggle-logo-anim-new');
    if (t) t.checked = on;
    // try show image only if loaded
    const img = document.querySelector('.core-logo');
    const wrap = document.querySelector('.core-logo-wrap');
    if (img && wrap) {
        if (img.complete && img.naturalWidth > 0) wrap.classList.add('has-logo-img');
        else {
            img.onload = () => wrap.classList.add('has-logo-img');
            img.onerror = () => wrap.classList.remove('has-logo-img');
        }
    }
}

document.addEventListener('DOMContentLoaded', applyLogoAnimPref);
if (document.readyState !== 'loading') setTimeout(applyLogoAnimPref, 0);

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
    const chatFlow = document.getElementById('chat-flow');
    const html = chatFlow ? chatFlow.innerHTML : '';
    const id = 'session_' + Date.now();
    // Персонализация как у обычных чатов (профиль «О вас») — без выбора в модалке
    chatSessions[id] = {
        title: 'Из временного',
        html,
        updated: Date.now(),
        fromTemp: true
    };
    currentSessionId = id;
    localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
    localStorage.setItem('oracle_current_session', id);
    CoreState.isTempChat = false;
    CoreState.tempHasMessages = false;
    CoreState.tempPersonaLocked = false;
    document.body.classList.remove('temp-chat-mode', 'temp-chat-saved-ready');
    document.getElementById('temp-persona-chooser') && (document.getElementById('temp-persona-chooser').hidden = true);
    CoreState.savedChatHTML = null;
    syncTempChatButton();
    if (typeof renderSidebarChats === 'function') renderSidebarChats();
    if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
    closeSaveTempModal();
    showToast('Чат сохранён в историю', 'success');
}

// ===== PIN / SECURITY =====
let pinModalMode = 'set'; // set | change | unlock
function openSetPinModal() {
    const has = !!localStorage.getItem('oracle_pin_hash');
    pinModalMode = has ? 'change' : 'set';
    window._pinChangeStep = has ? 1 : 0; // 1=verify old, 2=enter new+confirm
    document.getElementById('pin-modal-title').textContent = has ? 'Изменить PIN' : 'Создать PIN';
    document.getElementById('pin-modal-text').textContent = has
        ? 'Сначала подтвердите текущий PIN.'
        : 'Придумайте PIN (мин. 4). Если забудете — только сброс данных Core Node.';
    const i1 = document.getElementById('pin-input');
    const i2 = document.getElementById('pin-input-2');
    if (i1) { i1.value = ''; i1.placeholder = has ? 'Текущий PIN' : 'Новый PIN'; }
    if (i2) {
        i2.value = '';
        i2.style.display = has ? 'none' : 'block';
        i2.placeholder = 'Повтор нового PIN';
    }
    const note = document.getElementById('pin-local-note');
    if (note) note.style.display = 'none';
    document.getElementById('pin-cancel-btn') && (document.getElementById('pin-cancel-btn').style.display = 'inline-flex');
    document.getElementById('pin-reset-btn') && (document.getElementById('pin-reset-btn').style.display = 'none');
    document.getElementById('pin-modal')?.classList.remove('pin-unlock-mode');
    document.body.classList.remove('pin-locked');
    document.getElementById('pin-modal')?.classList.add('active');
    setTimeout(() => i1?.focus(), 60);
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
        const step = window._pinChangeStep || 1;
        if (step === 1) {
            if (simpleHash(a) !== cur) { showToast('Неверный текущий PIN', 'error'); return; }
            // old PIN ok → ask for new + confirm
            window._pinChangeStep = 2;
            const i1 = document.getElementById('pin-input');
            const i2 = document.getElementById('pin-input-2');
            const t = document.getElementById('pin-modal-text');
            if (t) t.textContent = 'Введите новый PIN и повторите. Оставьте оба поля пустыми — чтобы удалить PIN.';
            if (i1) { i1.value = ''; i1.placeholder = 'Новый PIN'; }
            if (i2) { i2.style.display = 'block'; i2.value = ''; i2.placeholder = 'Повтор нового PIN'; }
            showToast('Текущий PIN подтверждён', 'success');
            setTimeout(() => i1?.focus(), 40);
            return;
        }
        // step 2: a = new, b = confirm; пустые оба поля = удалить PIN
        if (!a && !b) {
            localStorage.removeItem('oracle_pin_hash');
            window._pinChangeStep = 0;
            closePinModal();
            updatePinStatusUI();
            showToast('PIN удалён', 'success');
            return;
        }
        if (a.length < 4) { showToast('Новый PIN: минимум 4 (или оставьте пустым, чтобы удалить)', 'warning'); return; }
        if (a !== b) { showToast('PIN не совпадает', 'error'); return; }
        localStorage.setItem('oracle_pin_hash', simpleHash(a));
        window._pinChangeStep = 0;
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
            document.body.classList.remove('pin-content-locked');
            if (typeof applyPinContentLock === 'function') applyPinContentLock();
            if (typeof resetLockScreenIdle === 'function') resetLockScreenIdle();
            showToast('Доступ разрешён', 'success');
        } else showToast('Неверный PIN', 'error');
        return;
    }
}
function updatePinStatusUI() {
    const has = !!localStorage.getItem('oracle_pin_hash');
    const el = document.getElementById('pin-status-label');
    if (el) el.textContent = has ? 'PIN задан' : 'Пароль не задан';
    const delBtn = document.getElementById('delete-pin-btn');
    if (delBtn) delBtn.style.display = has ? 'block' : 'none';
    ['oracle_pin_on_entry','oracle_pin_on_screensaver','oracle_safe_search'].forEach((k,i) => {
        const ids = ['pin-on-entry-btn','pin-on-screensaver-btn','safe-search-btn'];
        syncToggleBtn(ids[i], localStorage.getItem(k) === 'true');
    });
    // backup email status
    const st = document.getElementById('backup-email-status');
    const inp = document.getElementById('backup-email-input');
    const masked = localStorage.getItem('oracle_backup_email_mask') || '';
    if (st) st.textContent = masked ? ('Сохранено: ' + masked) : 'Резервная почта не задана';
    if (inp && masked && !inp.value) inp.placeholder = masked;
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
function showPinUnlockModal(titleText, bodyText) {
    if (!localStorage.getItem('oracle_pin_hash')) return;
    pinModalMode = 'unlock';
    const title = document.getElementById('pin-modal-title');
    const textEl = document.getElementById('pin-modal-text');
    if (title) title.textContent = titleText || 'Вход';
    if (textEl) textEl.textContent = bodyText || 'Введите PIN, чтобы открыть Core Node';
    const i2 = document.getElementById('pin-input-2');
    if (i2) i2.style.display = 'none';
    const inp = document.getElementById('pin-input');
    if (inp) { inp.value = ''; inp.placeholder = 'PIN'; }
    const modal = document.getElementById('pin-modal');
    const cancel = document.getElementById('pin-cancel-btn');
    const reset = document.getElementById('pin-reset-btn');
    const forgot = document.getElementById('pin-forgot-btn');
    const note = document.getElementById('pin-local-note');
    if (modal) modal.classList.add('pin-unlock-mode');
    if (cancel) cancel.style.display = 'none';
    // Одна кнопка: восстановление если есть почта, иначе сброс данных
    if (reset) {
        reset.style.display = 'inline-flex';
        const hasMail = !!localStorage.getItem('oracle_backup_email_hash');
        reset.textContent = hasMail ? 'Забыл PIN' : 'Сброс данных';
        reset.onclick = function() {
            if (localStorage.getItem('oracle_backup_email_hash')) openForgotPinModal();
            else openResetPinConfirm();
        };
    }
    if (forgot) forgot.style.display = 'none';
    if (note) note.style.display = 'block';
    document.body.classList.add('pin-locked');
    modal?.classList.add('active');
    setTimeout(() => inp?.focus(), 80);
}
function maybeAskPinOnEntry() {
    if (localStorage.getItem('oracle_pin_on_entry') !== 'true') return;
    if (!localStorage.getItem('oracle_pin_hash')) return;
    if (sessionStorage.getItem('oracle_pin_ok') === '1') return;
    showPinUnlockModal('Вход', 'Введите PIN, чтобы открыть Core Node');
}
window.showPinUnlockModal = showPinUnlockModal;

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
    
/* deduped: earlier window.showSection removed */

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
    
/* deduped sendMsg wrap */

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

// ===== SERIOUS OPS + DELETE PIN + BACKUP EMAIL =====
window._seriousPinCb = null;

function requireCurrentPin(title, textMsg, onOk) {
    if (!localStorage.getItem('oracle_pin_hash')) {
        if (typeof onOk === 'function') onOk();
        return;
    }
    window._seriousPinCb = onOk;
    const modal = document.getElementById('serious-pin-modal');
    const t = document.getElementById('serious-pin-title');
    const d = document.getElementById('serious-pin-text');
    const inp = document.getElementById('serious-pin-input');
    if (t) t.textContent = title || 'Подтверждение';
    if (d) d.textContent = textMsg || 'Введите текущий PIN, чтобы продолжить.';
    if (inp) inp.value = '';
    modal?.classList.add('active');
    setTimeout(() => inp?.focus(), 60);
}
function closeSeriousPinModal() {
    document.getElementById('serious-pin-modal')?.classList.remove('active');
    window._seriousPinCb = null;
}
function submitSeriousPin() {
    const v = document.getElementById('serious-pin-input')?.value || '';
    const cur = localStorage.getItem('oracle_pin_hash');
    if (!cur || simpleHash(v) !== cur) {
        showToast('Неверный PIN', 'error');
        return;
    }
    const cb = window._seriousPinCb;
    closeSeriousPinModal();
    if (typeof cb === 'function') cb();
}

function openDeletePinModal() {
    if (!localStorage.getItem('oracle_pin_hash')) {
        showToast('PIN не задан', 'warning');
        return;
    }
    const inp = document.getElementById('delete-pin-input');
    if (inp) inp.value = '';
    document.getElementById('delete-pin-modal')?.classList.add('active');
    setTimeout(() => inp?.focus(), 60);
}
function closeDeletePinModal() {
    document.getElementById('delete-pin-modal')?.classList.remove('active');
}
function confirmDeletePin() {
    const v = document.getElementById('delete-pin-input')?.value || '';
    const cur = localStorage.getItem('oracle_pin_hash');
    if (!cur || simpleHash(v) !== cur) {
        showToast('Неверный текущий PIN', 'error');
        return;
    }
    localStorage.removeItem('oracle_pin_hash');
    closeDeletePinModal();
    updatePinStatusUI();
    showToast('PIN удалён', 'success');
}

function maskEmail(email) {
    const s = String(email || '').trim().toLowerCase();
    const at = s.indexOf('@');
    if (at < 1) return s ? '***' : '';
    const user = s.slice(0, at);
    const domain = s.slice(at);
    const vis = user.slice(0, Math.min(2, user.length));
    return vis + '***' + domain;
}
function saveBackupEmail() {
    const inp = document.getElementById('backup-email-input');
    const raw = (inp?.value || '').trim().toLowerCase();
    if (!raw) {
        requireCurrentPin('Удалить резервную почту', 'Введите PIN, чтобы удалить резервную почту.', () => {
            localStorage.removeItem('oracle_backup_email_hash');
            localStorage.removeItem('oracle_backup_email_mask');
            if (inp) inp.value = '';
            updatePinStatusUI();
            showToast('Резервная почта удалена', 'success');
        });
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        showToast('Некорректный email', 'warning');
        return;
    }
    const apply = () => {
        localStorage.setItem('oracle_backup_email_hash', simpleHash(raw));
        localStorage.setItem('oracle_backup_email_mask', maskEmail(raw));
        if (inp) inp.value = '';
        updatePinStatusUI();
        showToast('Резервная почта сохранена', 'success');
    };
    if (localStorage.getItem('oracle_pin_hash')) {
        requireCurrentPin('Резервная почта', 'Подтвердите PIN, чтобы сохранить резервный адрес.', apply);
    } else {
        apply();
    }
}

function getDeviceFingerprint() {
    const nav = navigator || {};
    return {
        ua: nav.userAgent || '',
        platform: nav.platform || '',
        lang: nav.language || '',
        languages: (nav.languages || []).join(', '),
        screen: (window.screen ? (screen.width + '×' + screen.height) : ''),
        tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || ''),
        when: new Date().toISOString(),
        host: location.host || ''
    };
}

function openForgotPinModal() {
    document.getElementById('pin-modal')?.classList.remove('active');
    const r = document.getElementById('forgot-pin-result');
    if (r) { r.style.display = 'none'; r.innerHTML = ''; }
    const e = document.getElementById('forgot-pin-email');
    if (e) e.value = '';
    document.getElementById('forgot-pin-modal')?.classList.add('active');
}
function closeForgotPinModal() {
    document.getElementById('forgot-pin-modal')?.classList.remove('active');
    if (document.body.classList.contains('pin-locked')) {
        document.getElementById('pin-modal')?.classList.add('active');
    }
}
function requestPinRecovery() {
    const email = (document.getElementById('forgot-pin-email')?.value || '').trim().toLowerCase();
    const hash = localStorage.getItem('oracle_backup_email_hash');
    if (!hash) {
        showToast('Резервная почта не настроена', 'warning');
        return;
    }
    if (simpleHash(email) !== hash) {
        showToast('Почта не совпадает с резервной', 'error');
        return;
    }
    const token = 'r' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    const device = getDeviceFingerprint();
    const payload = {
        token,
        created: Date.now(),
        expires: Date.now() + 30 * 60 * 1000,
        device
    };
    localStorage.setItem('oracle_recovery_pending', JSON.stringify(payload));
    const info = btoa(unescape(encodeURIComponent(JSON.stringify({
        platform: device.platform,
        screen: device.screen,
        tz: device.tz,
        lang: device.lang,
        when: device.when,
        host: device.host
    }))));
    const base = location.href.replace(/[^/]*$/, '');
    const link = base + 'confirm.html?t=' + encodeURIComponent(token) + '&info=' + encodeURIComponent(info);
    const box = document.getElementById('forgot-pin-result');
    if (box) {
        box.style.display = 'block';
        const safeLink = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        box.innerHTML = '<b>Ссылка восстановления (30 мин):</b><br><code style="word-break:break-all;font-size:11px;">' + safeLink + '</code>' +
            '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">' +
            '<button type="button" class="modal-btn modal-btn-accept" style="flex:1;" id="copy-recovery-link-btn">Копировать</button>' +
            '<a class="modal-btn modal-btn-reject" style="flex:1;text-align:center;text-decoration:none;" href="mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent('Core Node — подтверждение восстановления') + '&body=' + encodeURIComponent('Откройте ссылку на том же устройстве/браузере, где стоит Core Node:\n\n' + link + '\n\nСсылка действует 30 минут. PIN в письме не передаётся.') + '">Открыть mailto</a>' +
            '</div><p style="margin:10px 0 0;font-size:11px;">confirm.html без параметров пустой. С токеном — данные устройства и «Это я» / «Это не я» / «Удалённый сброс».</p>';
        setTimeout(() => {
            document.getElementById('copy-recovery-link-btn')?.addEventListener('click', () => {
                navigator.clipboard.writeText(link).then(() => showToast('Скопировано', 'success')).catch(() => showToast('Не удалось скопировать', 'error'));
            });
        }, 30);
    }
    showToast('Ссылка создана', 'success');
}

window.openDeletePinModal = openDeletePinModal;
window.closeDeletePinModal = closeDeletePinModal;
window.confirmDeletePin = confirmDeletePin;
window.requireCurrentPin = requireCurrentPin;
window.closeSeriousPinModal = closeSeriousPinModal;
window.submitSeriousPin = submitSeriousPin;
window.saveBackupEmail = saveBackupEmail;
window.openForgotPinModal = openForgotPinModal;
window.closeForgotPinModal = closeForgotPinModal;
window.requestPinRecovery = requestPinRecovery;

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

function saveCurrentStory() {
    if (typeof readerManualSave === 'function') return readerManualSave();
    return saveCurrentStoryContent();
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
    
/* deduped sendMsg wrap */

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
    try {
        window.dispatchEvent(new CustomEvent('oracle-bridge-sync', { detail: { api: s } }));
        localStorage.setItem('oracle_bridge_ping', String(Date.now()));
    } catch (e) {}
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
        
/* deduped: earlier window.showSection removed */

    };
    wrap();
    document.addEventListener('DOMContentLoaded', wrap);
})();

// ===== External API call + key error with Retry =====
function isApiBusyError(message) {
    const m = String(message || '').toLowerCase();
    return /high demand|try again later|rate limit|429|resource.?exhausted|overloaded|unavailable|capacity|quota|too many requests|временно|перегруз|займ/i.test(m);
}

function appendAiApiError(message, retryMsg) {
    const chatFlow = document.getElementById('chat-flow');
    if (!chatFlow) return;
    const wrap = document.createElement('div');
    wrap.className = 'msg ai-msg ai-api-error';
    const safe = String(message || 'Ошибка API ключа');
    const busy = isApiBusyError(safe);
    const deferBtn = busy ? `
                <button type="button" class="ai-defer-btn" onclick="deferApiGeneration(this)">
                    <span class="material-symbols-rounded">schedule</span> Отложить генерацию
                </button>` : '';
    wrap.innerHTML = `
        <div class="ai-error-card">
            <div class="ai-error-icon"><span class="material-symbols-rounded">error</span></div>
            <div class="ai-error-body">
                <div class="ai-error-title">Ошибка API</div>
                <div class="ai-error-text">${escapeAiHtml(safe)}</div>
                <div class="ai-error-actions">
                <button type="button" class="ai-retry-btn" onclick="retryLastApiRequest(this)">
                    <span class="material-symbols-rounded">refresh</span> Повторить
                </button>
                ${deferBtn}
                </div>
                <div class="ai-defer-hint" style="display:none;font-size:11px;margin-top:8px;color:var(--on-surface-variant);line-height:1.4;"></div>
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

let _deferApiTimer = null;
let _deferApiAbort = false;

function deferApiGeneration(btn) {
    const wrap = btn?.closest('.ai-api-error');
    const msg = wrap?.dataset?.retryMsg || CoreState._lastApiUserMsg || '';
    if (!msg) {
        showToast('Нет сообщения для отложенной генерации', 'warning');
        return;
    }
    if (_deferApiTimer) {
        showToast('Уже ждём освобождения модели', 'info');
        return;
    }
    _deferApiAbort = false;
    const hint = wrap?.querySelector('.ai-defer-hint');
    if (hint) {
        hint.style.display = 'block';
        hint.textContent = 'Ждём освобождения модели… Не закрывайте вкладку. Попытки каждые ~25 с.';
    }
    btn.disabled = true;
    btn.style.opacity = '0.6';
    showToast('Отложено: ждём, когда модель освободится', 'info', 3500);

    // Notification permission (optional)
    try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }
    } catch (e) {}

    let attempts = 0;
    const maxAttempts = 24; // ~10 min
    const delayMs = 25000;

    const tick = async () => {
        if (_deferApiAbort) return;
        attempts++;
        if (hint) hint.textContent = 'Попытка ' + attempts + '/' + maxAttempts + '… Не закрывайте вкладку.';
        try {
            if (typeof callExternalProvider === 'function') {
                const result = await callExternalProvider(msg);
                if (result && result.ok && result.text) {
                    _deferApiTimer = null;
                    wrap?.remove();
                    // inject as AI reply
                    const chatFlow = document.getElementById('chat-flow');
                    if (chatFlow) {
                        const div = document.createElement('div');
                        div.className = 'msg ai-msg';
                        div.innerHTML = '<div class="ai-bubble">' + (typeof escapeAiHtml === 'function' ? escapeAiHtml(result.text).replace(/\n/g, '<br>') : result.text) + '</div>';
                        chatFlow.appendChild(div);
                        const screenChat = document.getElementById('screen-chat');
                        if (screenChat) screenChat.scrollTop = screenChat.scrollHeight;
                    }
                    const note = 'Модель освободилась — ответ готов.';
                    showToast(note, 'success', 5000);
                    try {
                        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                            new Notification('Core Node', { body: note });
                        } else {
                            showToast?.(note, 'info');
                        }
                    } catch (e) {
                        try { showToast?.(note, 'info'); } catch (e2) {}
                    }
                    return;
                }
                if (result && !isApiBusyError(result.error || '')) {
                    // permanent error
                    _deferApiTimer = null;
                    if (hint) hint.textContent = 'Ошибка: ' + (result.error || 'не удалось');
                    showToast(result.error || 'Ошибка API', 'error');
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    return;
                }
            }
        } catch (e) {}
        if (attempts >= maxAttempts) {
            _deferApiTimer = null;
            if (hint) hint.textContent = 'Время ожидания истекло. Нажмите «Повторить».';
            btn.disabled = false;
            btn.style.opacity = '1';
            showToast('Модель всё ещё занята. Попробуйте позже.', 'warning', 4000);
            return;
        }
        _deferApiTimer = setTimeout(tick, delayMs);
    };
    _deferApiTimer = setTimeout(tick, 3000); // first try soon
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

function getProviderModel(provider, forLive) {
    const p = String(provider || '').toLowerCase();
    const live = forLive || (typeof CoreState !== 'undefined' && CoreState.isLiveChat);
    if (p === 'gemini') return live ? 'gemini-3.5-flash-lite' : 'gemini-3.8-flash';
    if (p === 'openai') return live ? 'gpt-4o-mini' : 'gpt-4o-mini';
    if (p === 'claude') return live ? 'claude-3-5-haiku-20241022' : 'claude-3-5-haiku-20241022';
    if (p === 'grok') return live ? 'grok-2-latest' : 'grok-2-latest';
    return 'gemini-2.0-flash-lite';
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
            const model = getProviderModel('gemini', CoreState.isLiveChat);
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
                    model: getProviderModel('openai', CoreState.isLiveChat),
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
                    model: getProviderModel('claude', CoreState.isLiveChat),
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
                    model: getProviderModel('grok', CoreState.isLiveChat),
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

/* ===== HALLOWEEN EASTER EGG (Core Node) ===== */
const HALLOWEEN_SOURCE = 'https://blogs-kosmo-level-595cd1.gitlab.io/post.html?id=0000008';
let _extWarnUrl = null;

function isHalloweenQuery(msg) { return false; }

function applyHalloweenTheme() {}

function halloweenEasterAnswer() { return ""; }

function openExternalWarn(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const a = e && e.currentTarget;
    _extWarnUrl = (a && a.getAttribute('data-ext-url')) || HALLOWEEN_SOURCE;
    document.getElementById('ext-warn-modal')?.classList.add('active');
    return false;
}
function closeExternalWarn() {
    document.getElementById('ext-warn-modal')?.classList.remove('active');
    _extWarnUrl = null;
}
function confirmExternalWarn() {
    const url = _extWarnUrl || HALLOWEEN_SOURCE;
    closeExternalWarn();
    window.open(url, '_blank', 'noopener,noreferrer');
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        if (localStorage.getItem('oracle_halloween_mode') === '1') {
            document.body.classList.add('halloween-mode');
        }
    } catch (e) {}
    const m = document.getElementById('ext-warn-modal');
    if (m) m.addEventListener('click', (e) => { if (e.target === m) closeExternalWarn(); });
});

async function resolveAiResponse(msg) {
    if (typeof isHalloweenQuery === 'function' && isHalloweenQuery(msg)) {
        return { ok: true, text: halloweenEasterAnswer(), external: false, halloween: true };
    }
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

/* stopGeneration already handles abort */
window._stopAbortPatched = true;

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
        /* PRO entry toast removed */
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
        
/* deduped: earlier window.showSection removed */

    };
    wrap();
    document.addEventListener('DOMContentLoaded', wrap);
})();
// FA bridge kept (import badges)

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

// ===== PROJECT TREE: folders → branches → chats + fixed sources =====
if (typeof escapeHtml !== 'function') {
    window.escapeHtml = function(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
        }[ch]));
    };
}

const TREE_KEY = 'oracle_project_tree_v2';
let projectTree = { folders: {} };
let currentFolderId = null;
let _moveChatId = null;

function loadProjectTree() {
    try {
        const raw = localStorage.getItem(TREE_KEY);
        if (raw) projectTree = JSON.parse(raw) || { folders: {} };
    } catch (e) { projectTree = { folders: {} }; }
    if (!projectTree.folders || typeof projectTree.folders !== 'object') projectTree.folders = {};
    // migrate old v1 tree once: keep only folder titles + flatten chat ids
    try {
        if (!localStorage.getItem('oracle_tree_v2_migrated')) {
            const old = localStorage.getItem('oracle_project_tree');
            if (old) {
                const o = JSON.parse(old);
                if (o && o.folders) {
                    Object.keys(o.folders).forEach(fid => {
                        const f = o.folders[fid];
                        const chatIds = [];
                        if (Array.isArray(f.chatIds)) chatIds.push(...f.chatIds);
                        if (f.branches) {
                            Object.values(f.branches).forEach(b => {
                                if (Array.isArray(b.chatIds)) chatIds.push(...b.chatIds);
                            });
                        }
                        projectTree.folders[fid] = {
                            title: f.title || 'Папка',
                            open: f.open !== false,
                            chatIds: [...new Set(chatIds)],
                            files: Array.isArray(f.files) ? f.files : []
                        };
                    });
                    saveProjectTree();
                }
            }
            localStorage.setItem('oracle_tree_v2_migrated', '1');
        }
    } catch (e) {}
}

function saveProjectTree() {
    try { localStorage.setItem(TREE_KEY, JSON.stringify(projectTree)); } catch (e) {}
}

function getLinkedChatIds() {
    const linked = new Set();
    Object.values(projectTree.folders || {}).forEach(f => {
        (f.chatIds || []).forEach(id => linked.add(id));
    });
    return linked;
}

function getOrphanChatIds() {
    const linked = getLinkedChatIds();
    return Object.keys(chatSessions || {}).filter(id => !linked.has(id));
}

function renderProjectTree() {
    const list = document.getElementById('chats-list');
    if (!list) return;
    loadProjectTree();
    try {
      var _folders = Object.keys((projectTree && projectTree.folders) || {}).map(function(fid) {
        var f = projectTree.folders[fid];
        if (!f) return null;
        return {
          id: fid,
          name: f.title || f.name || 'Проект',
          title: f.title || f.name || 'Проект',
          icon: f.icon || 'folder',
          color: f.color || '#8b5cf6',
          pinned: !!f.pinned,
          ts: f.created || f.ts || 0,
          chats: (f.chatIds || []).length
        };
      }).filter(Boolean);
      if (typeof paintSbProjects === 'function') paintSbProjects(_folders);
    } catch (_pe) {}
    list.innerHTML = '';

    const folderIds = Object.keys(projectTree.folders || {});
    const orphans = getOrphanChatIds();
    const hasAnything = folderIds.length > 0 || orphans.length > 0;

    if (!hasAnything) {
        list.innerHTML = `
            <div class="tree-empty-state">
                <span class="material-symbols-rounded">chat_bubble_outline</span>
                <div class="tree-empty-title">Создайте Первый Чат</div>
                <div class="tree-empty-sub">Кнопка «Чат» ниже или вверху меню. Папки — по желанию, через +</div>
                <button type="button" class="tree-empty-cta" onclick="createNewChatSession()">
                    <span class="material-symbols-rounded">edit_square</span> Новый чат
                </button>
            </div>`;
        return;
    }

    // Folders
    folderIds.forEach(fid => {
        const folder = projectTree.folders[fid];
        if (!folder) return;
        const fEl = document.createElement('div');
        fEl.className = 'tree-folder' + (folder.open === false ? ' collapsed' : '');
        fEl.dataset.folderId = fid;

        const head = document.createElement('div');
        head.className = 'tree-folder-head';
        const nChats = (folder.chatIds || []).filter(id => chatSessions[id]).length;
        const nFiles = (folder.files || []).length;
        head.innerHTML = `
            <span class="material-symbols-rounded tf-arrow">expand_more</span>
            <span class="material-symbols-rounded">folder</span>
            <span class="tree-branch-title">${escapeHtml(folder.title || 'Папка')}</span>
            <span class="tree-src-badge" title="Чаты и файлы">${nChats}·${nFiles}</span>`;
        head.onclick = () => {
            folder.open = folder.open === false;
            saveProjectTree();
            renderProjectTree();
        };
        head.oncontextmenu = (e) => {
            e.preventDefault();
            showFolderCtx(e, fid);
        };
        fEl.appendChild(head);

        const body = document.createElement('div');
        body.className = 'tree-folder-body';

        // chats in folder
        (folder.chatIds || []).forEach(cid => {
            const s = chatSessions[cid];
            if (!s) return;
            body.appendChild(buildSimpleChatItem(cid, s, fid));
        });

        // files in folder
        (folder.files || []).forEach((file, fi) => {
            const row = document.createElement('div');
            row.className = 'tree-chat-item tree-file-item';
            row.innerHTML = `<span class="material-symbols-rounded">draft</span><span class="tree-branch-title">${escapeHtml(file.name || 'Файл')}</span>`;
            row.title = 'Файл в папке';
            row.oncontextmenu = (e) => {
                e.preventDefault();
                showCustomModal('Убрать файл', 'Убрать файл из папки?', false, '', function(ok){
                    if (!ok) return;
                    folder.files.splice(fi, 1);
                    saveProjectTree();
                    renderProjectTree();
                });
            };
            body.appendChild(row);
        });

        if (!(folder.chatIds || []).length && !(folder.files || []).length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'font-size:11px;color:var(--on-surface-variant);padding:6px 8px;';
            empty.textContent = 'Пустая папка — перенесите чат (ПКМ) или добавьте файл';
            body.appendChild(empty);
        }

        const addChat = document.createElement('div');
        addChat.className = 'tree-chat-item';
        addChat.style.opacity = '0.75';
        addChat.innerHTML = `<span class="material-symbols-rounded">add</span><span>Чат в этой папке</span>`;
        addChat.onclick = () => createChatInFolder(fid);
        body.appendChild(addChat);

        fEl.appendChild(body);
        list.appendChild(fEl);
    });

    // Root chats (no folder)
    if (orphans.length) {
        const wrap = document.createElement('div');
        wrap.className = 'tree-orphan';
        if (folderIds.length) {
            wrap.innerHTML = '<div class="tree-orphan-label">Без папки</div>';
        }
        orphans.forEach(id => {
            const s = chatSessions[id];
            if (!s) return;
            wrap.appendChild(buildSimpleChatItem(id, s, null));
        });
        list.appendChild(wrap);
    }
}

function buildSimpleChatItem(id, session, folderId) {
    const item = document.createElement('div');
    item.className = 'tree-chat-item' + (id === currentSessionId ? ' active-session' : '');
    item.dataset.sessionId = id;
    item.dataset.itemType = 'chat';
    if (folderId) item.dataset.folderId = folderId;
    item.innerHTML = `<span class="material-symbols-rounded">chat</span><span class="tree-branch-title">${escapeHtml(session.title || 'Чат')}</span>`;
    item.onclick = () => {
        currentFolderId = folderId;
        loadChatSession(id);
        renderProjectTree();
    };
    item.oncontextmenu = (e) => {
        if (typeof showContextMenu === 'function') showContextMenu(e, item, 'chat');
        else {
            e.preventDefault();
            openMoveFolderModal(id);
        }
    };
    return item;
}

function createChatInFolder(folderId) {
    const id = 'session_' + Date.now();
    chatSessions[id] = { title: 'Новый чат', html: '', updated: Date.now() };
    try { localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions)); } catch (e) {}
    const folder = projectTree.folders[folderId];
    if (folder) {
        if (!folder.chatIds) folder.chatIds = [];
        folder.chatIds.push(id);
        folder.open = true;
        saveProjectTree();
    }
    currentFolderId = folderId;
    currentSessionId = id;
    if (typeof CoreState !== 'undefined') CoreState.isFirstMsgInSession = true;
    localStorage.setItem('oracle_current_session', id);
    const chatFlow = document.getElementById('chat-flow');
    const welcome = document.getElementById('welcome-block');
    if (chatFlow) chatFlow.innerHTML = '';
    if (welcome) welcome.classList.remove('hidden');
    renderProjectTree();
    if (typeof switchScreen === 'function') switchScreen('chat');
    if (typeof updateChatEmptyState === 'function') updateChatEmptyState();
    showToast('Чат создан в проекте', 'success');
}

function openCreateFolderModal() {
    // Old "Новая папка" removed
    if (typeof openCreateProjectModal === 'function') openCreateProjectModal();
    else showToast?.('Создание проекта недоступно', 'warning');
}

function closeTreeCreateModal() {
    document.getElementById('tree-create-modal')?.classList.remove('active');
}

function confirmTreeCreate() {
    try { document.getElementById('tree-create-modal')?.classList.remove('active'); } catch(e){}
    if (typeof openCreateProjectModal === 'function') openCreateProjectModal();
    else showToast?.('Используйте «Создать проект»', 'info');
}

function showFolderCtx(e, folderId) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    if (typeof showProjectMenu === 'function') {
        showProjectMenu(e || window.event, folderId);
        return;
    }
    window._ctxProjectId = folderId;
    if (typeof openProjectHome === 'function') openProjectHome(folderId);
}

function cmMoveToFolder() {
    const node = typeof currentContextNode !== 'undefined' ? currentContextNode : null;
    const id = node?.dataset?.sessionId || currentSessionId;
    document.getElementById('context-menu') && (document.getElementById('context-menu').style.display = 'none');
    if (!id) {
        showToast('Сначала выберите чат', 'warning');
        return;
    }
    openMoveFolderModal(id);
}

function openMoveFolderModal(chatId) {
    loadProjectTree();
    _moveChatId = chatId;
    const modal = document.getElementById('move-folder-modal');
    const list = document.getElementById('move-folder-list');
    if (!list) return;
    list.innerHTML = '';

    // option: no folder
    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'tree-mini-btn';
    noneBtn.style.cssText = 'width:100%;justify-content:flex-start;padding:12px 14px;';
    noneBtn.innerHTML = '<span class="material-symbols-rounded">folder_off</span> Без папки';
    noneBtn.onclick = () => moveChatToFolder(chatId, null);
    list.appendChild(noneBtn);

    const ids = Object.keys(projectTree.folders || {});
    if (!ids.length) {
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:12px;color:var(--on-surface-variant);padding:8px;';
        hint.textContent = 'Папок пока нет — создайте через + у «Чаты и папки».';
        list.appendChild(hint);
    }
    ids.forEach(fid => {
        const f = projectTree.folders[fid];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tree-mini-btn';
        btn.style.cssText = 'width:100%;justify-content:flex-start;padding:12px 14px;';
        btn.innerHTML = `<span class="material-symbols-rounded">folder</span> ${escapeHtml(f.title || 'Папка')}`;
        btn.onclick = () => moveChatToFolder(chatId, fid);
        list.appendChild(btn);
    });

    modal?.classList.add('active');
}

function closeMoveFolderModal() {
    document.getElementById('move-folder-modal')?.classList.remove('active');
    _moveChatId = null;
}

function moveChatToFolder(chatId, folderId) {
    loadProjectTree();
    // remove from all folders
    Object.values(projectTree.folders || {}).forEach(f => {
        if (!f.chatIds) return;
        f.chatIds = f.chatIds.filter(id => id !== chatId);
    });
    if (folderId && projectTree.folders[folderId]) {
        if (!projectTree.folders[folderId].chatIds) projectTree.folders[folderId].chatIds = [];
        projectTree.folders[folderId].chatIds.push(chatId);
        projectTree.folders[folderId].open = true;
        currentFolderId = folderId;
        showToast('Чат в папке «' + (projectTree.folders[folderId].title || '') + '»', 'success');
    } else {
        currentFolderId = null;
        showToast('Чат без папки', 'info');
    }
    saveProjectTree();
    closeMoveFolderModal();
    renderProjectTree();
}

// Patch sidebar render
(function patchSidebarTree() {
    window.renderSidebarChats = function() {
        try { renderProjectTree(); } catch (e) {
            console.warn('tree', e);
        }
    };
    const boot = () => {
        try { loadProjectTree(); renderProjectTree(); } catch (e) {}
    };
    document.addEventListener('DOMContentLoaded', boot);
    if (document.readyState !== 'loading') setTimeout(boot, 0);
})();

// (removed) branch sources inject — currentBranchId no longer used after simple folders

// ===== Tree feature intro modal =====
function closeTreeFeatureModal(openSidebar) {
    document.getElementById('tree-feature-modal')?.classList.remove('active');
    localStorage.setItem('oracle_tree_feature_seen_v1', 'true');
    if (openSidebar) {
        document.getElementById('sidebar-archive')?.classList.add('open');
        try { renderProjectTree(); } catch (e) {}
        if (typeof showToast === 'function') showToast('Проекты и ветки — в боковом меню', 'success');
    }
}
function maybeShowTreeFeatureModal() {
    if (localStorage.getItem('oracle_tree_feature_seen_v1') === 'true') return;
    // wait for consent/pin if any
    setTimeout(() => {
        if (localStorage.getItem('oracle_tree_feature_seen_v1') === 'true') return;
        const consent = document.getElementById('consent-modal');
        if (consent && consent.classList.contains('active')) return;
/* tree-feature-modal removed — OOBE */
    }, 1600);
}
document.addEventListener('DOMContentLoaded', maybeShowTreeFeatureModal);
if (document.readyState !== 'loading') setTimeout(maybeShowTreeFeatureModal, 500);

/* Material Expensive 3 entry toast removed */
function openCreateBranchModal() { openCreateFolderModal(); }
function openBranchSourcesPanel() {}
function closeBranchSourcesPanel() {}
function updateActiveBranchBar() {
    const bar = document.getElementById('active-branch-bar');
    if (bar) bar.style.display = 'none';
}

// ===== Temp chat: long-press on Chat (mobile) / no overlap with nav =====
function isMobileTempChatUi() {
    return window.matchMedia('(max-width: 600px)').matches;
}

function wireTempChatLongPress() {
    const targets = [
        document.getElementById('btn-tab-chat'),
        ...document.querySelectorAll('.sidebar-nav-tab')
    ].filter(Boolean);

    // only Chat-related sidebar tabs
    const chatTargets = targets.filter(el => {
        if (el.id === 'btn-tab-chat') return true;
        const t = (el.textContent || '').toLowerCase();
        return t.includes('chat') || t.includes('чат');
    });

    chatTargets.forEach(el => {
        if (el.dataset.tempHoldWired) return;
        el.dataset.tempHoldWired = '1';

        let timer = null;
        let moved = false;
        const start = (e) => {
            if (!isMobileTempChatUi()) return;
            moved = false;
            timer = setTimeout(() => {
                timer = null;
                if (typeof toggleTempChat === 'function') toggleTempChat();
                el.classList.add('temp-hold-hint');
                setTimeout(() => el.classList.remove('temp-hold-hint'), 400);
                if (typeof showToast === 'function') {
                    showToast(
                        document.body.classList.contains('temp-chat-mode')
                            ? 'Временный чат включён (удержание Chat)'
                            : 'Временный чат выключен',
                        'info'
                    );
                }
                // prevent click after long-press
                el.dataset.skipClick = '1';
            }, 520);
        };
        const cancel = () => {
            if (timer) { clearTimeout(timer); timer = null; }
        };
        el.addEventListener('touchstart', start, { passive: true });
        el.addEventListener('touchend', cancel, { passive: true });
        el.addEventListener('touchmove', () => { moved = true; cancel(); }, { passive: true });
        el.addEventListener('touchcancel', cancel, { passive: true });
        el.addEventListener('mousedown', (e) => {
            if (!isMobileTempChatUi()) return;
            if (e.button !== 0) return;
            start(e);
        });
        el.addEventListener('mouseup', cancel);
        el.addEventListener('mouseleave', cancel);
        el.addEventListener('click', (e) => {
            if (el.dataset.skipClick === '1') {
                e.preventDefault();
                e.stopPropagation();
                el.dataset.skipClick = '0';
            }
        }, true);
    });
}

// sync active state class on mobile chat tab
(function patchTempBtnActiveMobile() {
    const sync = () => {
        const on = document.body.classList.contains('temp-chat-mode');
        document.getElementById('btn-tab-chat')?.classList.toggle('temp-active-mobile', on && isMobileTempChatUi());
        document.querySelectorAll('.sidebar-nav-tab').forEach(el => {
            const t = (el.textContent || '').toLowerCase();
            if (t.includes('chat') || t.includes('чат')) el.classList.toggle('temp-active-mobile', on && isMobileTempChatUi());
        });
    };
    const prevEnter = typeof enterTempChat === 'function' ? enterTempChat : null;
    const prevExit = typeof exitTempChat === 'function' ? exitTempChat : null;
    if (prevEnter && !window._tempMobilePatched) {
        window._tempMobilePatched = true;
        window.enterTempChat = function() { prevEnter(); sync(); };
        window.exitTempChat = function() { prevExit(); sync(); };
    }
    document.addEventListener('DOMContentLoaded', () => {
        wireTempChatLongPress();
        sync();
    });
    if (document.readyState !== 'loading') {
        setTimeout(() => { wireTempChatLongPress(); sync(); }, 0);
    }
})();

function clearHalloweenIfThemeChange() {
    document.body.classList.remove('halloween-mode');
    try { localStorage.removeItem('oracle_halloween_mode'); } catch (e) {}
}

/* ===== Side Core Node promo (desktop) + Screenshot Ask ===== */
function isDesktopCoreNode() {
    try {
        return window.matchMedia('(min-width: 901px)').matches && !('ontouchstart' in window && navigator.maxTouchPoints > 2);
    } catch (e) {
        return window.innerWidth >= 901;
    }
}

function maybeShowSideCorePromo() {
    if (localStorage.getItem('oracle_side_core_promo_v1') === '1') return;
    if (!isDesktopCoreNode()) return;
    // after consent
    const consent = document.getElementById('consent-modal');
    if (consent && consent.classList.contains('active')) {
        setTimeout(maybeShowSideCorePromo, 2000);
        return;
    }
    setTimeout(() => {
        if (localStorage.getItem('oracle_side_core_promo_v1') === '1') return;
        void 0 /* modal removed */;
    }, 2200);
}

function dismissSideCorePromo() {
    localStorage.setItem('oracle_side_core_promo_v1', '1');
    document.getElementById('side-core-promo-modal')?.classList.remove('active');
}

function openSideCoreZipHint() {
    localStorage.setItem('oracle_side_core_promo_v1', '1');
    document.getElementById('side-core-promo-modal')?.classList.remove('active');
    const t = document.getElementById('side-core-hint-title');
    const b = document.getElementById('side-core-hint-text');
    if (t) t.textContent = 'Локально ZIP';
    if (b) b.innerHTML = '1. Скачайте <b>side-core-node.zip</b> из репозитория / артефактов сборки.<br>2. Распакуйте папку.<br>3. Chrome → <code>chrome://extensions</code> → Режим разработчика → <b>Загрузить распакованное</b>.<br>4. Alt+Shift+C — боковая панель.';
    void 0 /* modal removed */;
}

function openSideCoreExtHint() {
    localStorage.setItem('oracle_side_core_promo_v1', '1');
    document.getElementById('side-core-promo-modal')?.classList.remove('active');
    const t = document.getElementById('side-core-hint-title');
    const b = document.getElementById('side-core-hint-text');
    if (t) t.textContent = 'Расширения Chrome';
    if (b) b.innerHTML = 'Когда расширение будет в Chrome Web Store, установка — в один клик.<br><br>Сейчас доступна <b>распакованная</b> версия (ZIP + Режим разработчика).<br>После установки: иконка расширения или <b>Alt+Shift+C</b>.';
    void 0 /* modal removed */;
}

function closeSideCoreHint() {
    document.getElementById('side-core-hint-modal')?.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', maybeShowSideCorePromo);
if (document.readyState !== 'loading') setTimeout(maybeShowSideCorePromo, 800);

/* Page screenshot context menu removed */

function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        if (window.html2canvas) return resolve(window.html2canvas);
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = () => resolve(window.html2canvas);
        s.onerror = () => reject(new Error('html2canvas load failed'));
        document.head.appendChild(s);
    });
}

async function askCoreNodeScreenshot() { /* removed */ }
function tryRenderShotChip() { /* removed */ }

/* Live Chat — enhance existing modal with rotating prompts */
(function enhanceLiveChat() {
    const prompts = [
        'Привет!',
        'Что делаешь?',
        'Расскажи коротко о себе',
        'Как настроить API?',
        'Помоги с кодом'
    ];
    let i = 0;
    setInterval(() => {
        const el = document.getElementById('live-user-msg');
        if (!el) return;
        const modal = document.getElementById('live-chat-modal');
        if (!modal || !modal.classList.contains('active')) return;
        i = (i + 1) % prompts.length;
        el.style.opacity = '0';
        setTimeout(() => {
            el.textContent = prompts[i];
            el.style.opacity = '1';
        }, 200);
    }, 2800);
})();

/* ===== Live privacy modal + try tip ===== */
function openLivePrivacyModal() {
    const m = document.getElementById('live-privacy-modal');
    const cb = document.getElementById('live-privacy-check');
    const ok = document.getElementById('live-privacy-accept');
    if (cb) cb.checked = false;
    if (ok) ok.disabled = true;
    m?.classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeLivePrivacyModal(accepted) {
    document.getElementById('live-privacy-modal')?.classList.remove('active');
    document.body.style.overflow = '';
    if (!accepted) return;
    const cb = document.getElementById('live-privacy-check');
    if (!cb || !cb.checked) {
        if (typeof showToast === 'function') showToast('Отметьте согласие с правилами', 'warning');
        openLivePrivacyModal();
        return;
    }
    localStorage.setItem('oracle_live_privacy_ok', '1');
    if (typeof startLiveChat === 'function') startLiveChat();
}
(function wireLivePrivacyCheck() {
    const boot = () => {
        const cb = document.getElementById('live-privacy-check');
        const ok = document.getElementById('live-privacy-accept');
        if (!cb || !ok || cb.dataset.wired) return;
        cb.dataset.wired = '1';
        cb.addEventListener('change', () => { ok.disabled = !cb.checked; });
    };
    document.addEventListener('DOMContentLoaded', boot);
    if (document.readyState !== 'loading') setTimeout(boot, 0);
})();

function dismissLiveTryTip() {
    const tip = document.getElementById('live-try-tip');
    if (tip) tip.hidden = true;
    localStorage.setItem('oracle_live_tip_dismissed_at', String(Date.now()));
}
function acceptLiveTryTip() {
    dismissLiveTryTip();
    if (typeof startLiveChat === 'function') startLiveChat();
}
function maybeShowLiveTryTip() {
    if (typeof CoreState !== 'undefined' && CoreState.isLiveChat) return;
    const dismissed = Number(localStorage.getItem('oracle_live_tip_dismissed_at') || 0);
    if (Date.now() - dismissed < 6 * 60 * 60 * 1000) return;
    const last = Number(localStorage.getItem('oracle_live_tip_last_shown') || 0);
    if (Date.now() - last < 45 * 60 * 1000) return;
    if (Math.random() > 0.35) return;
    const tip = document.getElementById('live-try-tip');
    if (!tip) return;
    const chat = document.getElementById('screen-chat');
    if (chat && !chat.classList.contains('active-screen')) return;
    tip.hidden = false;
    localStorage.setItem('oracle_live_tip_last_shown', String(Date.now()));
    setTimeout(() => { if (tip && !tip.hidden) tip.hidden = true; }, 14000);
}
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(maybeShowLiveTryTip, 12000);
    setInterval(maybeShowLiveTryTip, 8 * 60 * 1000);
});
if (document.readyState !== 'loading') setTimeout(maybeShowLiveTryTip, 12000);

/* ===== PWA: sync calendar reminders to Service Worker ===== */
function postToCoreSW(msg) {
    try {
        if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
            navigator.serviceWorker?.ready?.then((reg) => {
                reg.active?.postMessage(msg);
            }).catch(() => {});
            return;
        }
        navigator.serviceWorker.controller.postMessage(msg);
    } catch (e) {}
}

function buildReminderFireList(list) {
    const out = [];
    (list || []).forEach((r) => {
        if (!r || r.id == null) return;
        let eventAt = null;
        if (r.datetime) {
            const t = Date.parse(r.datetime);
            if (!Number.isNaN(t)) eventAt = t;
        }
        if (!eventAt && r.date) {
            // date key YYYY-MM-DD or similar — noon local as fallback
            const d = new Date(r.date);
            if (!Number.isNaN(d.getTime())) {
                d.setHours(12, 0, 0, 0);
                eventAt = d.getTime();
            }
        }
        if (!eventAt && r.ts) eventAt = Number(r.ts);
        if (!eventAt) return;

        const notifyBefore = Number(r.notifyBefore != null ? r.notifyBefore : (r.notifyMins != null ? r.notifyMins : 10));
        const fireAt = eventAt - Math.max(0, notifyBefore) * 60 * 1000;
        if (fireAt < Date.now() - 120000) return; // skip old

        out.push({
            id: String(r.id),
            title: r.title || r.text || 'Напоминание',
            body: (r.title || r.text || 'Событие') + (notifyBefore ? (' · через ' + notifyBefore + ' мин') : ''),
            fireAt,
            eventAt,
            tag: 'cn-reminder-' + r.id
        });
    });
    return out;
}

function syncRemindersToServiceWorker() {
    try {
        const list = typeof reminders !== 'undefined' ? reminders : [];
        const payload = buildReminderFireList(list);
        postToCoreSW({ type: 'SYNC_REMINDERS', reminders: payload });
    } catch (e) {}
}

function requestNotificationPermissionForPlans() {
    if (!('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission === 'granted') return Promise.resolve(true);
    if (Notification.permission === 'denied') return Promise.resolve(false);
    return Notification.requestPermission().then((p) => p === 'granted');
}

// Hook saveReminders if exists
(function wireReminderSWSync() {
    const tryWrap = () => {
        if (typeof saveReminders !== 'function') return false;
        if (saveReminders._swWired) return true;
        const prev = saveReminders;
        window.saveReminders = function() {
            const r = prev.apply(this, arguments);
            try { syncRemindersToServiceWorker(); } catch (e) {}
            return r;
        };
        saveReminders._swWired = true;
        return true;
    };
    if (!tryWrap()) {
        document.addEventListener('DOMContentLoaded', () => {
            tryWrap();
            setTimeout(syncRemindersToServiceWorker, 1500);
        });
        setTimeout(() => { tryWrap(); syncRemindersToServiceWorker(); }, 2000);
    } else {
        setTimeout(syncRemindersToServiceWorker, 1200);
    }

    // also after addPlanFromForm / delete
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(syncRemindersToServiceWorker, 2000);
    });

    // open calendar from notification click
    if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            const d = event.data;
            if (!d || d.type !== 'NOTIFICATION_CLICK') return;
            try {
                if (typeof switchScreen === 'function') switchScreen('calendar');
                if (d.reminderId && typeof showToast === 'function') {
                    showToast('Напоминание из уведомления', 'info');
                }
            } catch (e) {}
        });
    }
})();

// Permission soft-ask when opening calendar screen once
(function wireCalendarNotifPerm() {
    const boot = () => {
        const cal = document.getElementById('screen-calendar');
        if (!cal || cal.dataset.notifWired) return;
        cal.dataset.notifWired = '1';
        const obs = new MutationObserver(() => {
            if (cal.classList.contains('active-screen') && 'Notification' in window && Notification.permission === 'default') {
                // don't force; only if settings allow
                const notifOn = localStorage.getItem('oracle_notif_plans');
                if (notifOn === 'false') return;
                // defer aggressive prompt
            }
        });
        obs.observe(cal, { attributes: true, attributeFilter: ['class'] });
    };
    document.addEventListener('DOMContentLoaded', boot);
    if (document.readyState !== 'loading') setTimeout(boot, 0);
})();

/* ===== Core Node Oct14 features: offline, @connectors, later, edit UX, versions, FS format ===== */
(function oct14Features() {
  const CONNECTORS = {
    tasks: 'Задачи',
    'oracle-notepad': 'Oracle-Notepad',
    'letter-write': 'Letter-Write',
    'verify-ai': 'Verify-AI'
  };

  let editState = null; // { bubble, original }
  let replyVersions = new WeakMap(); // element -> { list: [], idx }
  let activeVersionEl = null;

  function isOnline() {
    return navigator.onLine !== false;
  }

  function updateOfflineUI() {
    const offline = !isOnline();
    document.body.classList.toggle('offline-mode', offline);
    const b = document.getElementById('offline-banner');
    if (b) b.hidden = !offline;
  }

  window.addEventListener('online', updateOfflineUI);
  window.addEventListener('offline', updateOfflineUI);
  document.addEventListener('DOMContentLoaded', updateOfflineUI);
  if (document.readyState !== 'loading') setTimeout(updateOfflineUI, 0);

  // ---- patch sendMsg for offline ----
  const _sendMsg = typeof sendMsg === 'function' ? sendMsg : null;
  if (_sendMsg && !window._oct14SendPatched) {
    window._oct14SendPatched = true;
    
/* deduped sendMsg wrap */

  }

  // ---- @ connectors ----
  function getConnectorPopup() { return document.getElementById('connector-popup'); }

  function hideConnectors() {
    const p = getConnectorPopup();
    if (p) p.hidden = true;
  }

  function showConnectors() {
    const p = getConnectorPopup();
    if (p) p.hidden = false;
  }

  function insertConnector(label) {
    if (typeof addConnectorChip === 'function') {
      addConnectorChip(label, label);
      return;
    }
    const input = document.getElementById('user-input');
    if (!input) return;
    hideConnectors();
  }

  window.hideSkillPopup = function() {
    const p = document.getElementById('skill-popup');
    if (p) p.hidden = true;
  };
  function showSkillPopup() {
    const p = document.getElementById('skill-popup');
    const list = document.getElementById('skill-popup-list');
    if (!p) return;
    // fill from skills system if available
    if (list) {
      let skills = [];
      try {
        if (typeof allSkills === 'function') skills = allSkills().filter(s => !s.disabled);
        else {
          // fallback read
          const BUILTIN_CMDS = ['short','detail','code','eli5','plan','review','sources','quiet'];
          skills = BUILTIN_CMDS.map(c => ({ cmd: c, name: c, id: c }));
          const user = JSON.parse(localStorage.getItem('oracle_user_skills_v1') || '[]') || [];
          skills = skills.concat(user.filter(s => !s.disabled));
        }
      } catch (e) {}
      list.innerHTML = (skills || []).slice(0, 12).map(s =>
        '<button type="button" class="connector-item" data-skill-cmd="' + (s.cmd || '') + '">' +
        '<span class="material-symbols-rounded">bolt</span>' +
        '<span><b>/' + (s.cmd || '') + '</b><small>' + (s.name || '') + '</small></span></button>'
      ).join('') || '<div style="padding:10px;font-size:12px;color:var(--on-surface-variant)">Нет навыков</div>';
      list.querySelectorAll('[data-skill-cmd]').forEach(btn => {
        btn.onclick = () => insertSkill(btn.getAttribute('data-skill-cmd'));
      });
    }
    p.hidden = false;
    hideConnectors();
  }
  function insertSkill(cmd) {
    if (typeof addSkillChip === 'function') {
      addSkillChip(cmd, cmd);
      return;
    }
    hideSkillPopup();
  }

  function wireConnectors() {
    const input = document.getElementById('user-input');
    if (!input || input.dataset.connWired) return;
    input.dataset.connWired = '1';
    input.addEventListener('input', () => {
      const v = input.value;
      const at = v.match(/(^|\s)@([^\s]*)$/);
      const slash = v.match(/(^|\s)\/([^\s]*)$/);
      if (at) { showConnectors(); window.hideSkillPopup(); }
      else if (slash) { showSkillPopup(); hideConnectors(); }
      else { hideConnectors(); window.hideSkillPopup(); }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideConnectors();
      // double backspace remove connector token
      if (e.key === 'Backspace') {
        const v = input.value;
        const sel = input.selectionStart;
        const before = v.slice(0, sel);
        const tok = before.match(/@([A-Za-zА-Яа-я0-9\-]+)\s?$/);
        if (tok && input.dataset.connHighlight === tok[0]) {
          e.preventDefault();
          const start = before.lastIndexOf(tok[0]);
          input.value = v.slice(0, start) + v.slice(sel);
          input.dataset.connHighlight = '';
          if (typeof handleInput === 'function') handleInput(input);
        } else if (tok) {
          input.dataset.connHighlight = tok[0];
        } else {
          input.dataset.connHighlight = '';
        }
      }
    });
    document.querySelectorAll('.connector-item').forEach(btn => {
      btn.addEventListener('click', () => insertConnector(btn.dataset.label || btn.dataset.conn));
    });
    document.addEventListener('click', (e) => {
      const p = getConnectorPopup();
      if (!p || p.hidden) return;
      if (!p.contains(e.target) && e.target !== input) hideConnectors();
      const sp = document.getElementById('skill-popup');
      if (sp && !sp.hidden && !sp.contains(e.target) && e.target !== input) window.hideSkillPopup();
    });
  }

  // CRITICAL: actually wire @ and / pickers
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { try { wireConnectors(); } catch(e) {} });
  } else {
    try { wireConnectors(); } catch(e) {}
  }
  setTimeout(() => { try { wireConnectors(); } catch(e) {} }, 400);

  // ---- Later Generate ----
  window.toggleLaterGenSetting = function(on) {
    localStorage.setItem('oracle_later_gen', on ? '1' : '0');
    syncLaterGenBtn();
  };

  function syncLaterGenBtn() {
    const btn = document.getElementById('later-gen-btn');
    const apiOn = localStorage.getItem('oracle_custom_api_enabled') === 'true' ||
      localStorage.getItem('oracle_limits_mode') === 'external_api';
    const settingOn = localStorage.getItem('oracle_later_gen') === '1';
    // Только на вкладке Чат (и не в skills hub / maps / reader и т.д.)
    const chatScreen = document.getElementById('screen-chat');
    const onChat = !!(chatScreen && chatScreen.classList.contains('active-screen')) &&
      !document.body.classList.contains('skills-hub-open');
    const show = settingOn && apiOn && onChat;
    if (btn) btn.classList.toggle('hidden', !show);
    const cb = document.getElementById('set-later-gen');
    if (cb) cb.checked = settingOn;
  }

  window.queueLaterGenerate = function() {
    if (!isOnline()) {
      showToast?.('Офлайн: Later Generate недоступен', 'warning');
      return;
    }
    const input = document.getElementById('user-input');
    const msg = (input?.value || '').trim();
    if (!msg) {
      showToast?.('Сначала введите запрос', 'warning');
      return;
    }
    showCustomModal?.(
      'Сгенерировать позже',
      'ИИ будет ждать, пока провайдер освободится. Если нажмёте «Остановить», лимит за ожидание <b>не вернётся</b>. Продолжить?',
      false, '', (ok) => {
        if (!ok) return;
        CoreState._laterQueue = CoreState._laterQueue || [];
        CoreState._laterQueue.push({ msg, ts: Date.now() });
        if (input) { input.value = ''; handleInput?.(input); }
        setGenerating?.(true);
        showToast?.('В очереди ожидания провайдера…', 'info', 3200);
        // soft poll mock
        const tryRun = () => {
          if (!CoreState.isStreaming) return;
          // after short "wait" run normal send path by restoring msg
          if (input) input.value = msg;
          setGenerating?.(false);
          if (typeof sendMsg === 'function') sendMsg();
        };
        setTimeout(tryRun, 3500 + Math.random() * 2500);
      }
    );
  };

  // ---- Edit message UX ----
  window.editBubbleText = function(btn) {
    const bubble = btn.closest('.user-bubble, .user-msg');
    if (!bubble) return;
    const textNode = bubble.querySelector('.bubble-text');
    if (!textNode) return;
    editState = { bubble, original: textNode.textContent };
    document.body.classList.add('edit-msg-mode');
    const ban = document.getElementById('edit-msg-banner');
    if (ban) ban.hidden = false;
    const input = document.getElementById('user-input');
    if (input) {
      input.value = textNode.textContent;
      handleInput?.(input);
      input.focus();
    }
    const sendIcon = document.querySelector('#send-btn .material-symbols-rounded');
    if (sendIcon) sendIcon.textContent = 'edit';
    document.getElementById('send-btn')?.classList.add('visible');
  };

  window.cancelEditMessage = function() {
    editState = null;
    document.body.classList.remove('edit-msg-mode');
    const ban = document.getElementById('edit-msg-banner');
    if (ban) ban.hidden = true;
    const input = document.getElementById('user-input');
    if (input) { input.value = ''; handleInput?.(input); }
    const sendIcon = document.querySelector('#send-btn .material-symbols-rounded');
    if (sendIcon) sendIcon.textContent = 'send';
  };

  function commitEditMessage() {
    if (!editState) return;
    const input = document.getElementById('user-input');
    const newText = (input?.value || '').trim();
    if (!newText) {
      showToast?.('Пустое сообщение', 'warning');
      return;
    }
    if (!isOnline()) {
      showToast?.('Нужен интернет, чтобы перегенерировать ответ', 'warning');
      return;
    }
    const textNode = editState.bubble.querySelector('.bubble-text');
    if (textNode) textNode.textContent = newText;

    // remove following AI bubble(s) until next user
    let n = editState.bubble.nextElementSibling;
    while (n && (n.classList.contains('ai-msg') || n.classList.contains('ai-bubble') || n.classList.contains('msg') && !n.classList.contains('user-msg'))) {
      if (n.classList.contains('user-msg') || n.classList.contains('user-bubble')) break;
      const rm = n;
      n = n.nextElementSibling;
      // keep if not ai
      if (rm.classList.contains('ai-msg') || rm.classList.contains('ai-bubble') || (rm.classList.contains('msg') && !rm.classList.contains('user-msg'))) {
        rm.remove();
      } else break;
    }

    cancelEditMessage();
    if (input) input.value = newText;
    // resend
    if (_sendMsg) {
      // use original send after clearing edit
      
/* deduped sendMsg wrap */

      window.sendMsg();
      // restore full patched send
      
/* deduped sendMsg wrap */

    }
  }

  // ---- Reply versions (regenerate style) ----
  window.registerReplyVersion = function(aiEl, text) {
    if (!aiEl) return;
    let pack = replyVersions.get(aiEl);
    if (!pack) {
      pack = { list: [], idx: 0 };
      replyVersions.set(aiEl, pack);
    }
    pack.list.push(text);
    pack.idx = pack.list.length - 1;
    renderVersionChip(aiEl, pack);
  };

  function renderVersionChip(aiEl, pack) {
    let chip = aiEl.querySelector('.ai-version-chip');
    if (!chip) {
      chip = document.createElement('div');
      chip.className = 'ai-version-chip';
      chip.innerHTML = '<button type="button" data-dir="-1">‹</button><span class="ai-v-label">1/1</span><button type="button" data-dir="1">›</button>';
      chip.querySelectorAll('button').forEach(b => {
        b.onclick = (e) => {
          e.stopPropagation();
          shiftVersionOn(aiEl, Number(b.dataset.dir));
        };
      });
      aiEl.appendChild(chip);
    }
    chip.querySelector('.ai-v-label').textContent = (pack.idx + 1) + '/' + pack.list.length;
    chip.style.display = pack.list.length > 1 ? 'inline-flex' : 'none';
  }

  function shiftVersionOn(aiEl, dir) {
    const pack = replyVersions.get(aiEl);
    if (!pack || pack.list.length < 2) return;
    pack.idx = (pack.idx + dir + pack.list.length) % pack.list.length;
    const body = aiEl.querySelector('.bubble-text, .ai-text, .msg-text') || aiEl;
    // only update text node if structure allows
    const t = aiEl.querySelector('.bubble-text, .ai-text');
    if (t) t.textContent = pack.list[pack.idx];
    else {
      // fallback: last text
    }
    renderVersionChip(aiEl, pack);
    activeVersionEl = aiEl;
    const bar = document.getElementById('reply-version-bar');
    if (bar) {
      bar.hidden = pack.list.length < 2;
      document.getElementById('rv-label').textContent = (pack.idx + 1) + '/' + pack.list.length;
    }
  }

  window.shiftReplyVersion = function(dir) {
    if (activeVersionEl) shiftVersionOn(activeVersionEl, dir);
  };

  // Hook: when AI message appended, try register version
  const _obs = new MutationObserver((muts) => {
    muts.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.classList?.contains('ai-msg') || node.classList?.contains('ai-bubble')) {
          const text = (node.querySelector('.bubble-text, .ai-text') || node).textContent || '';
          if (text.trim()) registerReplyVersion(node, text.trim());
        }
      });
    });
  });
  document.addEventListener('DOMContentLoaded', () => {
    const flow = document.getElementById('chat-flow');
    if (flow) _obs.observe(flow, { childList: true });
  });

  // ---- FS format fix ----
  window.fsFormat = function(command) {
    const ed = document.getElementById('fs-user-editor');
    if (ed) {
      ed.focus();
      try { document.execCommand(command, false, null); } catch (e) {}
      return;
    }
    try { document.execCommand(command, false, null); } catch (e) {}
  };

  window.fsChangeFontSize = function(size) {
    const ed = document.getElementById('fs-user-editor');
    if (ed) {
      ed.focus();
      document.execCommand('fontSize', false, '7');
      ed.querySelectorAll('font[size="7"]').forEach(el => {
        el.removeAttribute('size');
        el.style.fontSize = size + 'px';
      });
    }
  };

  window.toggleFsFontMenu = function(e) {
    e?.stopPropagation();
    document.getElementById('fs-font-size-picker')?.classList.toggle('open');
  };
  window.selectFsFontSize = function(n) {
    const label = document.getElementById('fs-font-size-label');
    if (label) label.textContent = String(n);
    document.getElementById('fs-font-size-picker')?.classList.remove('open');
    fsChangeFontSize(n);
  };

  // sync openFullscreen / sendFromFullscreen with editor
  const _openFs = typeof openFullscreenInput === 'function' ? openFullscreenInput : null;
  if (_openFs && !window._fsPatched) {
    window._fsPatched = true;
    window.openFullscreenInput = function() {
      _openFs.apply(this, arguments);
      const main = document.getElementById('user-input');
      const ed = document.getElementById('fs-user-editor');
      const ta = document.getElementById('fs-user-input');
      if (ed && main) {
        ed.innerText = main.value || '';
        setTimeout(() => ed.focus(), 50);
      }
      if (ta && main) ta.value = main.value || '';
    };
  }

  const _sendFs = typeof sendFromFullscreen === 'function' ? sendFromFullscreen : null;
  if (_sendFs) {
    window.sendFromFullscreen = function() {
      const ed = document.getElementById('fs-user-editor');
      const main = document.getElementById('user-input');
      const ta = document.getElementById('fs-user-input');
      const text = ed ? (ed.innerText || '').trim() : (ta?.value || '').trim();
      if (main) {
        main.value = text;
        handleInput?.(main);
      }
      return _sendFs.apply(this, arguments);
    };
  }

  // ---- Maps beta ----
  window.openMapsBeta = function() {
    document.getElementById('sidebar-archive')?.classList.remove('open');
    if (typeof switchScreen === 'function') switchScreen('maps');
    setTimeout(() => { if (typeof initCoreMaps === 'function') initCoreMaps(); }, 120);
  };

  // ---- Novelty ----
  window.dismissOct14Novelty = function() {
    localStorage.setItem('oracle_oct14_novelty', '1');
    document.getElementById('oct14-novelty-modal')?.classList.remove('active');
  };

  function maybeNovelty() { /* OOBE */ return; }

  function loadMarks() {
    try { return JSON.parse(localStorage.getItem(MARKS_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function saveMarks(arr) {
    try { localStorage.setItem(MARKS_KEY, JSON.stringify(arr.slice(-40))); } catch (e) {}
  }

  window.initCoreMaps = function() {
    const el = document.getElementById('maps-leaflet');
    if (!el) return;
    if (typeof L === 'undefined') {
      if (typeof showToast === 'function') showToast('Leaflet не загрузился (нужен интернет для скрипта)', 'warning');
      return;
    }
    if (map) {
      setTimeout(() => map.invalidateSize(), 100);
      return;
    }
    map = L.map(el, { zoomControl: true }).setView([55.75, 37.62], 10);
    window._coreMap = map;
    // OSM.org tiles often 403 for apps — use Carto (OSM data) + fallbacks
    // Free tiles without API keys (OSM.org & CARTO often block / require key)
    const tileLayers = {
      esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; data OSM, USGS, etc.'
      }),
      esriImg: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri'
      }),
      topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '&copy; OpenStreetMap, SRTM | OpenTopoMap'
      }),
      osmfr: L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> FR'
      }),
      hot: L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap, HOT'
      })
    };
    let activeTiles = tileLayers.esri;
    activeTiles.addTo(map);
    window._coreMapTiles = tileLayers;
    window._coreMapActiveTiles = activeTiles;
    window._coreMapLayerKey = 'esri';
    L.control.layers(
      {
        'Esri Streets': tileLayers.esri,
        'Спутник': tileLayers.esriImg,
        'Topo': tileLayers.topo,
        'OSM FR': tileLayers.osmfr,
        'HOT': tileLayers.hot
      },
      null,
      { position: 'topright', collapsed: true }
    ).addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    // restore markers
    loadMarks().forEach(m => {
      L.marker([m.lat, m.lng]).addTo(markersLayer).bindPopup(m.label || (m.lat.toFixed(4) + ', ' + m.lng.toFixed(4)));
    });

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const label = lat.toFixed(5) + ', ' + lng.toFixed(5);
      L.marker([lat, lng]).addTo(markersLayer).bindPopup(label).openPopup();
      const list = loadMarks();
      list.push({ lat, lng, label, ts: Date.now() });
      saveMarks(list);
    });

    setTimeout(() => map.invalidateSize(), 120);
    setTimeout(() => map.invalidateSize(), 400);
  };

  window.mapsLocateMe = function() {
    if (!map) initCoreMaps();
    if (!navigator.geolocation) {
      showToast?.('Геолокация недоступна', 'warning');
      return;
    }
    showToast?.('Определяю позицию…', 'info', 1800);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        map.setView([lat, lng], 14);
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker([lat, lng], {
          radius: 9, color: '#fff', weight: 2, fillColor: '#2954c4', fillOpacity: 0.95
        }).addTo(map).bindPopup('Вы здесь').openPopup();
      },
      () => showToast?.('Не удалось получить геолокацию', 'error'),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  window.mapsClearMarkers = function() {
    if (markersLayer) markersLayer.clearLayers();
    saveMarks([]);
    showToast?.('Метки очищены', 'success');
  };

  window.mapsSearch = async function() {
    const q = (document.getElementById('maps-search')?.value || '').trim();
    if (!q) {
      showToast?.('Введите запрос', 'warning');
      return;
    }
    if (!map) initCoreMaps();
    const listEl = document.getElementById('maps-results');
    if (listEl) { listEl.innerHTML = ''; listEl.hidden = true; }
    try {
      showToast?.('Ищу…', 'info', 1200);
      const url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=' + encodeURIComponent(q);
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      if (!data || !data.length) {
        showToast?.('Ничего не найдено', 'warning');
        return;
      }
      if (data.length === 1) {
        mapsPickResult(data[0]);
        return;
      }
      // multi-select list
      if (!listEl) return;
      listEl.hidden = false;
      listEl.innerHTML = data.map((item, i) => {
        const name = item.display_name || q;
        const type = [item.type, item.class].filter(Boolean).join(' · ');
        return '<button type="button" class="maps-result-item" data-idx="' + i + '">' +
          '<span class="maps-result-name">' + String(name).replace(/</g,'&lt;') + '</span>' +
          (type ? '<span class="maps-result-type">' + type + '</span>' : '') +
          '</button>';
      }).join('');
      window._mapsSearchHits = data;
      listEl.querySelectorAll('.maps-result-item').forEach(btn => {
        btn.onclick = () => {
          const hit = window._mapsSearchHits[Number(btn.dataset.idx)];
          if (hit) mapsPickResult(hit);
          listEl.hidden = true;
        };
      });
      showToast?.('Найдено: ' + data.length + ' — выберите', 'success', 2200);
    } catch (e) {
      showToast?.('Поиск недоступен (сеть / лимит Nominatim)', 'error');
    }
  };

  window.mapsPickResult = function(item) {
    if (!map) initCoreMaps();
    if (!item) return;
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const label = item.display_name || (lat + ', ' + lng);
    map.setView([lat, lng], 15);
    if (markersLayer) {
      L.marker([lat, lng]).addTo(markersLayer).bindPopup(label).openPopup();
    }
    const list = loadMarks();
    list.push({ lat, lng, label, ts: Date.now() });
    saveMarks(list);
    const listEl = document.getElementById('maps-results');
    if (listEl) listEl.hidden = true;
  };

  // Enter in search
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('maps-search')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        mapsSearch();
      }
    });
  });

  // replace modal stub
  window.openMapsBeta = function() {
    if (typeof switchScreen === 'function') switchScreen('maps');
  };
})();

window.mapsCycleLayer = function() {
  if (!window._coreMapTiles || typeof L === 'undefined') return;
  const order = ['esri', 'esriImg', 'topo', 'osmfr', 'hot'];
  const mapInst = document.getElementById('maps-leaflet') && window._coreMapActiveTiles;
  // find map via leaflet id
  const el = document.getElementById('maps-leaflet');
  if (!el || !el._leaflet_id) return;
  // access map from init closure — store globally
  if (!window._coreMap) {
    showToast?.('Откройте карту ещё раз', 'info');
    return;
  }
  const cur = window._coreMapLayerKey || 'voyager';
  const idx = (order.indexOf(cur) + 1) % order.length;
  const next = order[idx];
  if (window._coreMapActiveTiles) window._coreMap.removeLayer(window._coreMapActiveTiles);
  window._coreMapActiveTiles = window._coreMapTiles[next];
  window._coreMapActiveTiles.addTo(window._coreMap);
  window._coreMapLayerKey = next;
  showToast?.('Слой: ' + next, 'info', 1400);
};

/* ===== Input placeholder tip (@ connector) ===== */
(function inputPlaceholderTip() {
  const TIP = 'Вставьте @ чтобы добавить Коннектор и работать исключительно с ним, зато экономит лимиты на конкретную задачу';
  const DEF = 'Введите ваш запрос...';
  function run() {
    const input = document.getElementById('user-input');
    if (!input) return;
    const prev = input.placeholder || DEF;
    input.placeholder = TIP;
    setTimeout(() => {
      if (document.activeElement === input && input.value) return;
      input.placeholder = prev || DEF;
    }, 3000);
  }
  document.addEventListener('DOMContentLoaded', run);
  if (document.readyState !== 'loading') setTimeout(run, 400);
})();

(function initNavSlotsOnBoot() {
  function go() {
    try { fillNavSlotSelects(); renderMainNav(); renderSidebarFallbacks(); } catch(e) {}
  }
  document.addEventListener('DOMContentLoaded', go);
  if (document.readyState !== 'loading') setTimeout(go, 300);
})();

/* ===== Unified Archive + Create a… + Skills + Search ===== */
(function unifiedArchiveModule() {
  const PIN_KEY = 'oracle_pinned_chats_v1';
  let unifiedFilter = localStorage.getItem('oracle_unified_filter') || 'all';

  function loadPins() {
    try { return JSON.parse(localStorage.getItem(PIN_KEY) || '[]') || []; } catch(e) { return []; }
  }
  function savePins(arr) {
    localStorage.setItem(PIN_KEY, JSON.stringify(arr || []));
  }
  function isPinned(id) { return loadPins().includes(id); }

  window.cmTogglePin = function() {
    const id = window._ctxSessionId;
    if (!id) { showToast?.('Нет чата', 'warning'); return; }
    let pins = loadPins();
    if (pins.includes(id)) pins = pins.filter(x => x !== id);
    else pins.unshift(id);
    savePins(pins);
    document.getElementById('context-menu') && (document.getElementById('context-menu').style.display = 'none');
    renderUnifiedArchive();
    showToast?.(isPinned(id) ? 'Закреплено' : 'Откреплено', 'success');
  };

  // Update pin label when context opens
  const _scm = window.showContextMenu;
  if (typeof _scm === 'function') {
    window.showContextMenu = function(e, el, type) {
      const r = _scm.apply(this, arguments);
      const id = window._ctxSessionId || el?.dataset?.sessionId;
      const lab = document.getElementById('cm-pin-label');
      if (lab) lab.textContent = id && isPinned(id) ? 'Открепить' : 'Закрепить';
      const pinOpt = document.getElementById('cm-pin-opt');
      if (pinOpt) pinOpt.style.display = (type === 'chat' || el?.dataset?.itemType === 'chat' || id) ? '' : 'none';
      return r;
    };
  }

  window.setUnifiedFilter = function(f) {
    unifiedFilter = f || 'all';
    localStorage.setItem('oracle_unified_filter', unifiedFilter);
    const menu = document.getElementById('unified-filter-menu');
    if (menu) menu.hidden = true;
    const map = {
      all: ['notes', 'Все'],
      plans: ['schedule', 'Планы'],
      stories: ['history_edu', 'Истории'],
      projects: ['folder', 'Проекты'],
      notepad: ['code', 'Oracle Notepad'],
      chats: ['chat_bubble', 'Чаты']
    };
    const m = map[unifiedFilter] || map.all;
    const ic = document.getElementById('unified-filter-icon');
    const lb = document.getElementById('unified-filter-label');
    if (ic) ic.textContent = m[0];
    if (lb) lb.textContent = m[1];
    renderUnifiedArchive();
  };

  window.toggleUnifiedFilterMenu = function(e) {
    e?.stopPropagation?.();
    const menu = document.getElementById('unified-filter-menu');
    if (!menu) return;
    menu.hidden = !menu.hidden;
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.unified-filter-bar')) {
      const menu = document.getElementById('unified-filter-menu');
      if (menu) menu.hidden = true;
    }
  });

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function getSessions() {
    try {
      if (typeof chatSessions === 'object' && chatSessions) return chatSessions;
      return JSON.parse(localStorage.getItem('oracle_chat_sessions') || '{}') || {};
    } catch(e) { return {}; }
  }
  function getStories() {
    try {
      if (typeof storyBooks === 'object' && storyBooks) return storyBooks;
      return JSON.parse(localStorage.getItem('oracle_story_books') || '{}') || {};
    } catch(e) { return {}; }
  }
  function getPlans() {
    try { return JSON.parse(localStorage.getItem('oracle_reminders') || '[]') || []; } catch(e) { return []; }
  }
  function getFolders() {
    try {
      const tree = JSON.parse(localStorage.getItem('oracle_project_tree_v2') || 'null');
      if (!tree || !tree.folders) return [];
      const src = Array.isArray(tree.folders) ? tree.folders : Object.keys(tree.folders).map(function(id) {
        return Object.assign({ id: id }, tree.folders[id] || {});
      });
      return src.map(function(f) {
        return {
          id: f.id,
          name: f.title || f.name || 'Проект',
          title: f.title || f.name || 'Проект',
          icon: f.icon || 'folder',
          color: f.color || '#8b8b93',
          pinned: !!f.pinned,
          ts: f.created || f.ts || 0,
          chats: (f.chatIds || []).length
        };
      });
    } catch(e) { return []; }
  }
  function paintSbProjects(folders) {
    const panel = document.getElementById('sb-projects-panel');
    if (!panel) return;
    let list = (folders || []).slice();
    const sort = localStorage.getItem('oracle_project_sort') || '2';
    list.sort(function(a, b) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (sort === '1') return String(a.title).localeCompare(String(b.title), 'ru');
      if (sort === '3') return (a.ts || 0) - (b.ts || 0);
      return (b.ts || 0) - (a.ts || 0);
    });
    if (!list.length) {
      panel.innerHTML = '<div class="unified-empty" style="padding:12px 10px;">Нет проектов. Нажмите +</div>';
      return;
    }
    panel.innerHTML = list.map(function(f) {
      const id = String(f.id || '').replace(/"/g, '');
      const title = esc(f.title || 'Проект');
      const icon = String(f.icon || 'folder').replace(/[^a-z0-9_]/gi, '') || 'folder';
      const color = String(f.color || '#8b8b93');
      const sub = (f.chats ? f.chats + ' чат.' : 'Нет чатов');
      return '<button type="button" class="sb-row sb-project-row' + (f.pinned ? ' pinned' : '') + '" data-folder="' + id + '">' +
        '<span class="sb-proj-ico" style="color:' + color + ';background:' + color + '22"><span class="material-symbols-rounded">' + icon + '</span></span>' +
        '<span class="sb-proj-text"><span class="sb-proj-name">' + title + '</span><span class="sb-proj-sub">' + sub + '</span></span>' +
        '</button>';
    }).join('');
    panel.querySelectorAll('[data-folder]').forEach(function(btn) {
      const id = btn.getAttribute('data-folder');
      btn.onclick = function() {
        if (typeof openProjectHome === 'function') openProjectHome(id);
        else showToast?.('Проект', 'info');
      };
      btn.oncontextmenu = function(e) {
        e.preventDefault();
        e.stopPropagation();
        showProjectMenu(e, id);
      };
    });
  }
  window.showProjectMenu = function(e, id) {
    window._ctxProjectId = id;
    const menu = document.getElementById('project-context-menu');
    if (!menu) return;
    menu.hidden = false;
    menu.style.display = 'flex';
    let x = e.clientX, y = e.clientY;
    menu.style.left = Math.min(x, window.innerWidth - 240) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 280) + 'px';
  };
  window.projCtx = function(act) {
    const id = window._ctxProjectId;
    const menu = document.getElementById('project-context-menu');
    if (menu) { menu.hidden = true; menu.style.display = 'none'; }
    if (!id || !projectTree || !projectTree.folders || !projectTree.folders[id]) {
      try { if (typeof loadProjectTree === 'function') loadProjectTree(); } catch(e){}
    }
    const f = projectTree && projectTree.folders ? projectTree.folders[id] : null;
    if (!f) { showToast?.('Проект не найден', 'warning'); return; }
    if (act === 'home') { if (typeof openProjectHome === 'function') openProjectHome(id); return; }
    if (act === 'settings') { window._activeProjectId = id; if (typeof openProjectSettings === 'function') openProjectSettings(); return; }
    if (act === 'share') { showToast?.('Публичная ссылка проекта появится позже', 'info'); return; }
    if (act === 'pin') {
      f.pinned = !f.pinned;
      if (typeof saveProjectTree === 'function') saveProjectTree();
      if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
      showToast?.(f.pinned ? 'Проект закреплён' : 'Проект откреплён', 'success');
      return;
    }
    if (act === 'rename') {
      showCustomModal('Переименовать проект', 'Новое название:', true, f.title || '', function(n){
        if (!n || !String(n).trim()) return;
        f.title = String(n).trim();
        if (typeof saveProjectTree === 'function') saveProjectTree();
        if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
        const ht = document.getElementById('project-home-title');
        if (ht && window._activeProjectId === id) ht.textContent = f.title;
      });
      return;
    }
    if (act === 'delete') {
      showCustomModal('Удалить проект', 'Чаты останутся в списке, но отвяжутся от проекта.', false, '', function(ok){
        if (!ok) return;
        delete projectTree.folders[id];
        if (typeof saveProjectTree === 'function') saveProjectTree();
        if (typeof closeProjectHome === 'function') closeProjectHome();
        if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
        showToast?.('Проект удалён', 'success');
      });
    }
  };
  document.addEventListener('click', function(){
    const menu = document.getElementById('project-context-menu');
    if (menu) { menu.hidden = true; menu.style.display = 'none'; }
  });
  function getNpProjects() {
    try { return JSON.parse(localStorage.getItem('oracle_projects_list') || '[]') || []; } catch(e) { return []; }
  }

  window.renderUnifiedArchive = function() {
    const box = document.getElementById('unified-archive-list');
    if (!box) return;
    const pins = loadPins();
    const sessions = getSessions();
    const stories = getStories();
    const plans = getPlans();
    const folders = getFolders();
    try { paintSbProjects(folders); } catch (e) { console.warn(e); }
    const nps = getNpProjects();
    let items = [];

    if (unifiedFilter === 'all' || unifiedFilter === 'chats' || unifiedFilter === 'projects') {
      Object.keys(sessions).forEach(id => {
        const s = sessions[id] || {};
        items.push({
          kind: 'chat', id, title: s.title || 'Чат',
          ts: s.updated || (parseInt(String(id).replace(/\D/g,''),10) || 0),
          pinned: pins.includes(id),
          mode: s.mode || s.inputMode || 'chat'
        });
      });
    }
    if (unifiedFilter === 'projects') {
      folders.forEach(f => {
        items.push({ kind: 'folder', id: f.id || f.name, title: f.name || f.title || 'Папка', ts: f.ts || 0, pinned: false });
      });
    }
    if (unifiedFilter === 'all' || unifiedFilter === 'stories') {
      Object.keys(stories).forEach(id => {
        const s = stories[id] || {};
        items.push({ kind: 'story', id, title: s.title || 'История', ts: s.updated || 0, pinned: false });
      });
    }
    if (unifiedFilter === 'all' || unifiedFilter === 'plans') {
      plans.forEach((p, i) => {
        const done = !!(p.done || p.completed);
        items.push({
          kind: 'plan', id: p.id || ('plan_' + i), title: p.text || p.title || 'План',
          ts: p.ts || 0, done, pinned: false
        });
      });
    }
    if (unifiedFilter === 'all' || unifiedFilter === 'notepad') {
      (Array.isArray(nps) ? nps : []).forEach((p, i) => {
        items.push({
          kind: 'notepad', id: p.id || ('np_' + i), title: p.name || p.title || 'Проект',
          ts: p.updated || p.ts || 0, pinned: false
        });
      });
    }

    items.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.ts || 0) - (a.ts || 0);
    });

    if (!items.length) {
      const emptyMsg = {
        all: 'Нет чатов, проектов и историй.\nСоздайте новый через Create a… или напишите первый запрос.',
        chats: 'Нет чатов.\nНапишите сообщение или Create a… → Chat.',
        projects: 'Нет проектов.\nCreate a… → Project.',
        stories: 'Нет историй.\nCreate a… → History или откройте Reader.',
        plans: 'Нет планов.\nДобавьте напоминание в «Планы и календарь».',
        notepad: 'Нет Coding-проектов.\nОткройте Oracle Notepad или Create a… → Coding.'
      };
      const msg = emptyMsg[unifiedFilter] || emptyMsg.all;
      box.innerHTML = '<div class="unified-empty"><span class="material-symbols-rounded" style="font-size:36px;opacity:.45;display:block;margin-bottom:10px;">folder_off</span>' +
        msg.split('\n').map(function(line){ return '<div>' + line + '</div>'; }).join('') + '</div>';
      return;
    }

    const iconMap = { chat: 'chat_bubble', folder: 'folder', story: 'history_edu', plan: 'schedule', notepad: 'code' };
    function iconFor(it) {
      if (it.kind === 'chat' && it.mode === 'task') return 'check_circle';
      return iconMap[it.kind] || 'notes';
    }
    try {
      box.innerHTML = items.map(it => {
        let badge = '';
        if (it.kind === 'plan') badge = '<span class="plan-dot ' + (it.done ? 'done' : 'todo') + '"></span>';
        if (it.pinned) badge += '<span class="material-symbols-rounded pin-mark">push_pin</span>';
        const ico = iconFor(it);
        const icoCls = (ico === 'check_circle') ? ' task-chat-ico' : '';
        return '<button type="button" class="unified-item" data-kind="' + it.kind + '" data-id="' + esc(it.id) + '">' +
          '<span class="material-symbols-rounded' + icoCls + '">' + ico + '</span>' +
          '<span class="unified-item-title">' + esc(it.title) + '</span>' + badge +
          '</button>';
      }).join('');
    } catch (err) {
      console.error('renderUnifiedArchive', err);
      box.innerHTML = '<div class="unified-empty">Не удалось показать список. Обновите страницу.</div>';
      return;
    }

    box.querySelectorAll('.unified-item').forEach(btn => {
      btn.onclick = () => openUnifiedItem(btn.dataset.kind, btn.dataset.id);
      btn.oncontextmenu = (e) => {
        e.preventDefault();
        if (btn.dataset.kind === 'chat') {
          window._ctxSessionId = btn.dataset.id;
          btn.dataset.sessionId = btn.dataset.id;
          btn.dataset.itemType = 'chat';
          if (typeof showContextMenu === 'function') showContextMenu(e, btn, 'chat');
        }
      };
    });
  };

  window.openUnifiedItem = function(kind, id) {
    if (kind === 'chat' && typeof loadChatSession === 'function') {
      loadChatSession(id);
      document.getElementById('sidebar-archive')?.classList.remove('open');
    } else if (kind === 'story' && typeof openStoryBook === 'function') {
      openStoryBook(id);
      document.getElementById('sidebar-archive')?.classList.remove('open');
    } else if (kind === 'plan') {
      if (typeof switchScreen === 'function') switchScreen('calendar');
      document.getElementById('sidebar-archive')?.classList.remove('open');
    } else if (kind === 'folder') {
      setUnifiedFilter('projects');
    } else if (kind === 'notepad') {
      if (typeof switchScreen === 'function') switchScreen('notepad');
      document.getElementById('sidebar-archive')?.classList.remove('open');
    }
  };

  // Search
  window.openArchiveSearch = function() {
    document.getElementById('archive-search-modal')?.classList.add('active');
    const inp = document.getElementById('archive-search-input');
    if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 50); }
    runArchiveSearch('');
  };
  window.closeArchiveSearch = function() {
    document.getElementById('archive-search-modal')?.classList.remove('active');
  };
  window.runArchiveSearch = function(q) {
    const box = document.getElementById('archive-search-results');
    if (!box) return;
    q = String(q || '').trim().toLowerCase();
    // temporarily collect all
    const prev = unifiedFilter;
    unifiedFilter = 'all';
    const sessions = getSessions();
    const stories = getStories();
    const plans = getPlans();
    const nps = getNpProjects();
    unifiedFilter = prev;
    let hits = [];
    Object.keys(sessions).forEach(id => {
      const t = sessions[id]?.title || '';
      if (!q || t.toLowerCase().includes(q)) hits.push({ kind: 'chat', id, title: t || 'Чат', group: 'Чаты', icon: 'chat_bubble', ts: sessions[id]?.updated || 0 });
    });
    Object.keys(stories).forEach(id => {
      const t = stories[id]?.title || '';
      if (!q || t.toLowerCase().includes(q)) hits.push({ kind: 'story', id, title: t || 'История', group: 'Истории', icon: 'history_edu', ts: 0 });
    });
    plans.forEach((p, i) => {
      const t = p.text || p.title || '';
      if (!q || t.toLowerCase().includes(q)) hits.push({ kind: 'plan', id: p.id || i, title: t, group: 'Планы', icon: 'schedule', ts: 0 });
    });
    (Array.isArray(nps) ? nps : []).forEach((p, i) => {
      const t = p.name || p.title || '';
      if (!q || t.toLowerCase().includes(q)) hits.push({ kind: 'notepad', id: p.id || i, title: t, group: 'Notepad', icon: 'code', ts: 0 });
    });
    hits.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    if (!hits.length) {
      box.innerHTML = '<div class="unified-empty">Ничего не найдено</div>';
      return;
    }
    box.innerHTML = hits.slice(0, 40).map(h =>
      '<button type="button" class="archive-search-hit" data-kind="' + h.kind + '" data-id="' + esc(h.id) + '">' +
      '<span class="material-symbols-rounded">' + h.icon + '</span>' +
      '<span><b>' + esc(h.title) + '</b><small>' + esc(h.group) + '</small></span></button>'
    ).join('');
    box.querySelectorAll('.archive-search-hit').forEach(btn => {
      btn.onclick = () => {
        closeArchiveSearch();
        openUnifiedItem(btn.dataset.kind, btn.dataset.id);
      };
    });
  };

  // Create a…
  window.openCreateAModal = function() {
    document.getElementById('create-a-modal')?.classList.add('active');
  };
  window.closeCreateAModal = function() {
    document.getElementById('create-a-modal')?.classList.remove('active');
  };
  window.toggleCreateATemp = function(e) {
    e && e.preventDefault && e.preventDefault();
    const cb = document.getElementById('create-a-temp-check');
    const box = document.getElementById('create-a-temp-box');
    if (!cb) return;
    cb.checked = !cb.checked;
    box && box.classList.toggle('checked', cb.checked);
  };
  window.createAPick = function(type) {
    const wantTemp = !!document.getElementById('create-a-temp-check')?.checked;
    closeCreateAModal();
    if (type === 'chat') {
      if (wantTemp && typeof toggleTempChat === 'function') {
        // ensure we enter temp mode
        if (!window.CoreState?.isTempChat) toggleTempChat();
        else if (typeof createNewChatSession === 'function') createNewChatSession();
      } else {
        // leave temp if was on
        if (window.CoreState?.isTempChat && typeof exitTempChat === 'function') exitTempChat();
        else if (window.CoreState?.isTempChat && typeof toggleTempChat === 'function') toggleTempChat();
        if (typeof createNewChatSession === 'function') createNewChatSession();
      }
    } else if (type === 'project') { if (typeof openCreateProjectModal === 'function') openCreateProjectModal(); else if (typeof openCreateFolderModal === 'function') openCreateFolderModal(); }
    else if (type === 'history' && typeof createNewStoryBook === 'function') createNewStoryBook(new Event('click'));
    else if (type === 'coding') {
      showToast?.('Coding Project — откройте Oracle Notepad / вкладку проектов', 'info');
      if (typeof switchScreen === 'function') switchScreen('notepad');
    }
    // reset checkbox
    const cb = document.getElementById('create-a-temp-check');
    const box = document.getElementById('create-a-temp-box');
    if (cb) cb.checked = false;
    box && box.classList.remove('checked');
  };

  // Skills hub
  window.openSkillsHub = function() {
    document.getElementById('sidebar-archive')?.classList.remove('open');
    document.body.classList.add('skills-hub-open');
    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active-screen'));
    document.getElementById('screen-skills')?.classList.add('active-screen');
    document.querySelector('.glass-nav')?.classList.add('nav-hidden-skills');
  };
  window.closeSkillsHub = function() {
    document.body.classList.remove('skills-hub-open');
    document.querySelector('.glass-nav')?.classList.remove('nav-hidden-skills');
    if (typeof switchScreen === 'function') switchScreen('chat');
  };
  window.setSkillsTab = function(tab) {
    document.querySelectorAll('.skills-hub-tab').forEach(b => b.classList.toggle('active', b.dataset.skillsTab === tab));
    document.getElementById('skills-panel-store').hidden = tab !== 'store';
    document.getElementById('skills-panel-skills').hidden = tab !== 'skills';
  };

  // After delete -> blank chat
  const _cmDel = window.cmDelete;
  if (typeof _cmDel === 'function') {
    window.cmDelete = function() {
      _cmDel.apply(this, arguments);
      setTimeout(() => {
        try { createNewChatSession(); } catch(e) {}
        renderUnifiedArchive();
      }, 100);
    };
  }

  // Hook renderSidebarChats
  const _rsc = window.renderSidebarChats;
  window.renderSidebarChats = function() {
    if (typeof _rsc === 'function') {
      try { _rsc.apply(this, arguments); } catch(e) {}
    }
    renderUnifiedArchive();
  };

  // Ensure session on first send
  const _send = window.sendMsg;
  if (typeof _send === 'function') {
    
/* deduped sendMsg wrap */

  }

  document.addEventListener('DOMContentLoaded', () => {
    setUnifiedFilter(unifiedFilter);
    renderUnifiedArchive();
  });
  if (document.readyState !== 'loading') setTimeout(() => { setUnifiedFilter(unifiedFilter); renderUnifiedArchive(); }, 400);
})();

/* ===== Later Generate: only on Chat + archive item ПКМ ===== */
(function laterGenAndArchiveCtx() {
  function hideLaterIfNotChat() {
    if (typeof syncLaterGenBtn === 'function') {
      try { syncLaterGenBtn(); } catch(e) {}
      return;
    }
    const btn = document.getElementById('later-gen-btn');
    if (!btn) return;
    const chatScreen = document.getElementById('screen-chat');
    const onChat = chatScreen && chatScreen.classList.contains('active-screen');
    if (!onChat) btn.classList.add('hidden');
  }

  const prevSwitch = window.switchScreen;
  if (typeof prevSwitch === 'function' && !window.__laterSwitchHook) {
    window.__laterSwitchHook = true;
    
/* deduped switchScreen wrap */

  }
  const prevNav = window.navGo;
  if (typeof prevNav === 'function' && !window.__laterNavHook) {
    window.__laterNavHook = true;
    window.navGo = function(tabId) {
      const r = prevNav.apply(this, arguments);
      setTimeout(hideLaterIfNotChat, 0);
      return r;
    };
  }
  document.addEventListener('DOMContentLoaded', hideLaterIfNotChat);
  setTimeout(hideLaterIfNotChat, 500);

  // ---- Simple context menu for story / plan / project / notepad ----
  function ensureArchiveCtxMenu() {
    let m = document.getElementById('archive-item-ctx');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'archive-item-ctx';
    m.className = 'archive-item-ctx';
    m.innerHTML = `
      <button type="button" class="nav-ctx-item" data-act="edit"><span class="material-symbols-rounded">edit</span> Изменить</button>
      <button type="button" class="nav-ctx-item danger" data-act="delete"><span class="material-symbols-rounded">delete</span> Удалить</button>
    `;
    document.body.appendChild(m);
    document.addEventListener('click', () => { m.style.display = 'none'; });
    m.querySelector('[data-act="edit"]').onclick = () => {
      m.style.display = 'none';
      archiveCtxEdit();
    };
    m.querySelector('[data-act="delete"]').onclick = () => {
      m.style.display = 'none';
      archiveCtxDelete();
    };
    return m;
  }

  window._archiveCtx = { kind: null, id: null, title: '' };

  window.showArchiveItemCtx = function(e, kind, id, title) {
    e.preventDefault();
    e.stopPropagation();
    window._archiveCtx = { kind, id, title: title || '' };
    const m = ensureArchiveCtxMenu();
    m.style.display = 'flex';
    const pad = 8;
    let x = e.clientX, y = e.clientY;
    if (x + 200 > window.innerWidth) x = window.innerWidth - 200 - pad;
    if (y + 100 > window.innerHeight) y = window.innerHeight - 100 - pad;
    m.style.left = x + 'px';
    m.style.top = y + 'px';
  };

  function archiveCtxEdit() {
    const { kind, id, title } = window._archiveCtx || {};
    if (!kind || id == null) return;
    if (kind === 'story') {
      if (typeof showCustomModal === 'function') {
        showCustomModal('Переименовать историю', 'Новое название', true, title || '', (ok, name) => {
          if (!ok || !name) return;
          try {
            const books = (typeof storyBooks === 'object' && storyBooks) ? storyBooks :
              JSON.parse(localStorage.getItem('oracle_story_books') || '{}');
            if (books[id]) {
              books[id].title = name.trim();
              if (typeof storyBooks === 'object') storyBooks[id].title = name.trim();
              localStorage.setItem('oracle_story_books', JSON.stringify(books));
            }
          } catch(e) {}
          if (typeof renderSidebarStories === 'function') renderSidebarStories();
          if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
          showToast?.('История обновлена', 'success');
        });
      }
    } else if (kind === 'plan') {
      if (typeof showCustomModal === 'function') {
        showCustomModal('Изменить план', 'Текст плана / напоминания', true, title || '', (ok, text) => {
          if (!ok || !text) return;
          try {
            let plans = JSON.parse(localStorage.getItem('oracle_reminders') || '[]') || [];
            const idx = plans.findIndex((p, i) => String(p.id || i) === String(id));
            if (idx >= 0) {
              plans[idx].text = text.trim();
              if (plans[idx].title !== undefined) plans[idx].title = text.trim();
              localStorage.setItem('oracle_reminders', JSON.stringify(plans));
              if (typeof reminders !== 'undefined') {
                try { reminders = plans; } catch(e) {}
              }
              if (typeof renderCalendar === 'function') renderCalendar();
            }
          } catch(e) {}
          if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
          showToast?.('План обновлён', 'success');
        });
      }
    } else if (kind === 'folder' || kind === 'project') {
      if (typeof showCustomModal === 'function') {
        showCustomModal('Переименовать проект', 'Новое имя папки', true, title || '', (ok, name) => {
          if (!ok || !name) return;
          try {
            const tree = JSON.parse(localStorage.getItem('oracle_project_tree_v2') || '{}') || {};
            const folders = tree.folders || [];
            const f = folders.find(x => String(x.id || x.name) === String(id));
            if (f) {
              f.name = name.trim();
              localStorage.setItem('oracle_project_tree_v2', JSON.stringify(tree));
            }
          } catch(e) {}
          if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
          if (typeof renderSidebarChats === 'function') renderSidebarChats();
          showToast?.('Проект обновлён', 'success');
        });
      }
    } else if (kind === 'notepad') {
      if (typeof showCustomModal === 'function') {
        showCustomModal('Переименовать Coding Project', 'Новое имя', true, title || '', (ok, name) => {
          if (!ok || !name) return;
          try {
            let list = JSON.parse(localStorage.getItem('oracle_projects_list') || '[]') || [];
            const p = list.find(x => String(x.id || x.name) === String(id));
            if (p) {
              p.name = name.trim();
              if (p.title !== undefined) p.title = name.trim();
              localStorage.setItem('oracle_projects_list', JSON.stringify(list));
            }
          } catch(e) {}
          if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
          showToast?.('Проект обновлён', 'success');
        });
      }
    }
  }

  function archiveCtxDelete() {
    const { kind, id, title } = window._archiveCtx || {};
    if (!kind || id == null) return;
    const label = title || id;
    const go = (fn) => {
      if (typeof showCustomModal === 'function') {
        showCustomModal('Удалить?', '«' + label + '» будет удалён без возможности отмены.', false, '', (ok) => {
          if (ok) fn();
        });
      } else showCustomModal('Удалить', 'Удалить «' + label + '»?', false, '', function(ok){ if (ok) fn(); });
    };

    if (kind === 'story') {
      go(() => {
        try {
          const books = (typeof storyBooks === 'object' && storyBooks) ? storyBooks :
            JSON.parse(localStorage.getItem('oracle_story_books') || '{}');
          delete books[id];
          if (typeof storyBooks === 'object') delete storyBooks[id];
          localStorage.setItem('oracle_story_books', JSON.stringify(books));
        } catch(e) {}
        if (typeof renderSidebarStories === 'function') renderSidebarStories();
        if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
        showToast?.('История удалена', 'warning');
      });
    } else if (kind === 'plan') {
      go(() => {
        try {
          let plans = JSON.parse(localStorage.getItem('oracle_reminders') || '[]') || [];
          plans = plans.filter((p, i) => String(p.id || i) !== String(id));
          localStorage.setItem('oracle_reminders', JSON.stringify(plans));
          if (typeof renderCalendar === 'function') renderCalendar();
        } catch(e) {}
        if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
        showToast?.('План удалён', 'warning');
      });
    } else if (kind === 'folder' || kind === 'project') {
      go(() => {
        try {
          const tree = JSON.parse(localStorage.getItem('oracle_project_tree_v2') || '{}') || {};
          tree.folders = (tree.folders || []).filter(x => String(x.id || x.name) !== String(id));
          localStorage.setItem('oracle_project_tree_v2', JSON.stringify(tree));
        } catch(e) {}
        if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
        if (typeof renderSidebarChats === 'function') renderSidebarChats();
        showToast?.('Проект удалён', 'warning');
      });
    } else if (kind === 'notepad') {
      go(() => {
        try {
          let list = JSON.parse(localStorage.getItem('oracle_projects_list') || '[]') || [];
          list = list.filter(x => String(x.id || x.name) !== String(id));
          localStorage.setItem('oracle_projects_list', JSON.stringify(list));
        } catch(e) {}
        if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
        showToast?.('Coding project удалён', 'warning');
      });
    }
  }

  // Patch unified list contextmenu for non-chat kinds
  const prevRender = window.renderUnifiedArchive;
  if (typeof prevRender === 'function' && !window.__archiveCtxRenderHook) {
    window.__archiveCtxRenderHook = true;
    window.renderUnifiedArchive = function() {
      const r = prevRender.apply(this, arguments);
      const box = document.getElementById('unified-archive-list');
      if (!box) return r;
      box.querySelectorAll('.unified-item').forEach(btn => {
        const kind = btn.dataset.kind;
        if (kind === 'chat') return; // already has chat menu
        btn.oncontextmenu = (e) => {
          const title = btn.querySelector('.unified-item-title')?.textContent || '';
          showArchiveItemCtx(e, kind, btn.dataset.id, title);
        };
      });
      return r;
    };
  }
})();

/* ===== Sidebar menu configurator ===== */
(function sidebarMenuConfig() {
  const KEY = 'oracle_sidebar_action_btns_v2';
  const KEY_LEGACY = 'oracle_sidebar_action_btns_v1';
  const FILTER_KEY = 'oracle_sidebar_split_filters';
  const CATALOG = [
    { id: 'library', label: 'Библиотека', icon: 'local_library', action: "switchScreen('library'); closeSidebar?.()" },
    { id: 'skills', label: 'Аддоны', icon: 'extension', action: "window.openAddonsHub && openAddonsHub()" },
    { id: 'plans', label: 'Запланировано', icon: 'schedule', action: "switchScreen('calendar'); closeSidebar?.()" },
    { id: 'split', label: 'Параллельный просмотр', icon: 'splitscreen', action: "typeof openSplitSelector==='function' && openSplitSelector()" },
    { id: 'maps', label: 'Карты', icon: 'map', action: "switchScreen('maps'); closeSidebar?.()" },
    { id: 'scenarios', label: 'Сценарист', icon: 'movie_edit', action: "switchScreen('scenarios'); closeSidebar?.()" },
    { id: 'reader', label: 'Reader', icon: 'auto_stories', action: "switchScreen('reader'); closeSidebar?.()" }
  ];

  function isMobile() {
    try { return window.matchMedia('(max-width: 720px)').matches; } catch (e) { return false; }
  }
  function maxBtns() { return isMobile() ? 4 : 5; }

  function loadBtns() {
    var max = maxBtns();
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem(KEY_LEGACY) || 'null');
      if (Array.isArray(raw)) {
        return raw.filter(function(id) { return CATALOG.some(function(c) { return c.id === id; }); }).slice(0, max);
      }
    } catch (e) {}
    return ['library', 'skills', 'plans', 'split'].slice(0, max);
  }
  function saveBtns(arr) {
    localStorage.setItem(KEY, JSON.stringify(arr.slice(0, maxBtns())));
  }

  window.openPlansFromSidebar = function() {
    document.getElementById('sidebar-archive')?.classList.remove('open');
    if (typeof switchScreen === 'function') switchScreen('calendar');
  };
  window.openMapsFromSidebar = function() {
    document.getElementById('sidebar-archive')?.classList.remove('open');
    if (typeof switchScreen === 'function') switchScreen('maps');
  };
  window.openLibraryFromSidebar = function() {
    document.getElementById('sidebar-archive')?.classList.remove('open');
    if (typeof switchScreen === 'function') switchScreen('library');
    if (typeof refreshLibraryUI === 'function') refreshLibraryUI();
  };

  window.renderSidebarActionButtons = function() {
    var stack = document.getElementById('sidebar-actions-stack');
    if (!stack) return;
    var selected = loadBtns();
    var moreIds = CATALOG.map(function(c) { return c.id; }).filter(function(id) { return selected.indexOf(id) < 0; });

    var html = selected.map(function(id) {
      var c = CATALOG.find(function(x) { return x.id === id; });
      if (!c) return '';
      return '<button type="button" class="sb-row" data-sb-id="' + c.id + '" onclick="' + c.action + '">' +
        '<span class="material-symbols-rounded">' + c.icon + '</span><span>' + c.label + '</span></button>';
    }).join('');

    html += '<div class="sb-more-wrap">' +
      '<button type="button" class="sb-row" id="sb-more-btn" onclick="toggleSidebarMore(event)">' +
      '<span class="material-symbols-rounded">more_horiz</span><span>Ещё</span></button>' +
      '<div id="sb-more-menu" class="sb-more-menu" hidden>';
    moreIds.forEach(function(id) {
      var c = CATALOG.find(function(x) { return x.id === id; });
      if (!c) return;
      html += '<button type="button" onclick="' + c.action + '; closeSidebarMore && closeSidebarMore()">' +
        '<span class="material-symbols-rounded">' + c.icon + '</span> ' + c.label + '</button>';
    });
    html += '<button type="button" onclick="openSidebarSettings(); closeSidebarMore && closeSidebarMore()">' +
      '<span class="material-symbols-rounded">tune</span> Настройка меню</button>';
    html += '</div></div>';

    stack.innerHTML = html;
    var dyn = document.getElementById('sidebar-dynamic-actions');
    if (dyn) dyn.style.display = 'none';
  };

  window.renderSidebarBtnChecklist = function() {
    var box = document.getElementById('sidebar-btn-checklist');
    if (!box) return;
    var max = maxBtns();
    var selected = loadBtns();
    box.innerHTML = CATALOG.map(function(c) {
      var on = selected.indexOf(c.id) >= 0;
      return '<label class="cn-check sidebar-btn-check' + (on ? ' is-on' : '') + '" data-id="' + c.id + '">' +
        '<input type="checkbox" ' + (on ? 'checked' : '') + (selected.length >= max && !on ? ' disabled' : '') + '>' +
        '<span class="cn-check-box"></span>' +
        '<span class="material-symbols-rounded cn-check-icon">' + c.icon + '</span>' +
        '<span class="cn-check-label">' + c.label + '</span></label>';
    }).join('');
    box.querySelectorAll('.cn-check').forEach(function(lab) {
      var inp = lab.querySelector('input');
      inp.addEventListener('change', function() {
        var cur = loadBtns();
        var id = lab.dataset.id;
        var limit = maxBtns();
        if (inp.checked) {
          if (cur.length >= limit) {
            inp.checked = false;
            showToast && showToast('Максимум ' + limit + ' кнопки на этом устройстве', 'warning');
            return;
          }
          if (cur.indexOf(id) < 0) cur.push(id);
        } else {
          cur = cur.filter(function(x) { return x !== id; });
        }
        saveBtns(cur);
        renderSidebarBtnChecklist();
        renderSidebarActionButtons();
      });
    });
    var hint = document.getElementById('sidebar-btn-limit-hint');
    if (hint) {
      hint.textContent = 'Выбрано: ' + selected.length + ' / ' + max +
        (isMobile() ? ' (телефон)' : ' (ПК)');
    }
  };

  window.toggleSidebarSplitFilters = function(on) {
    localStorage.setItem(FILTER_KEY, on ? '1' : '0');
    var bar = document.querySelector('.unified-filter-bar');
    if (bar) bar.style.display = on ? '' : 'none';
  };

  window.openSidebarSettings = function() {
    document.getElementById('sidebar-archive')?.classList.remove('open');
    if (typeof switchScreen === 'function') switchScreen('settings');
    setTimeout(function() {
      if (typeof showSection === 'function') showSection('sidebar-menu');
      renderSidebarBtnChecklist();
      var f = document.getElementById('sidebar-split-all-filters');
      if (f) f.checked = localStorage.getItem(FILTER_KEY) !== '0';
    }, 60);
  };

  function boot() {
    renderSidebarActionButtons();
    if (localStorage.getItem(FILTER_KEY) === '0') {
      var bar = document.querySelector('.unified-filter-bar');
      if (bar) bar.style.display = 'none';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 300);
  window.addEventListener('resize', function() {
    // re-clamp selection if switched device width
    var cur = loadBtns();
    if (cur.length > maxBtns()) {
      saveBtns(cur.slice(0, maxBtns()));
      renderSidebarActionButtons();
      renderSidebarBtnChecklist();
    }
  });
})();

/* ===== Coming soon + Settings search ===== */
window.openComingSoonModal = function(name) {
  const m = document.getElementById('coming-soon-modal');
  const t = document.getElementById('coming-soon-title');
  const p = document.getElementById('coming-soon-text');
  if (t) t.textContent = (name || 'Функция') + ' · Скоро в релизе';
  if (p) p.textContent = '«' + (name || 'Эта функция') + '» появится в следующем обновлении Core Node PRO.';
  if (m) m.classList.add('active');
};
window.closeComingSoonModal = function() {
  document.getElementById('coming-soon-modal')?.classList.remove('active');
};

const SETTINGS_SEARCH_INDEX = [
  { q: 'контекст память contentcheck использовать контекст', section: 'user', title: 'Использовать Контекст', sub: 'О вас → тумблер', icon: 'history', target: 'settings-target-context' },
  // Вкладки
  { q: 'персонализация внешний вид навигация', section: 'general', title: 'Персонализация', sub: 'Вкладка настроек внешнего вида', icon: 'palette', target: null },
  { q: 'тема светлая тёмная темная true black trueblack режим', section: 'general', title: 'Тема', sub: 'Персонализация → ниже тема', icon: 'contrast', target: 'settings-target-theme' },
  { q: 'акцент цвет акцентный primary matte', section: 'general', title: 'Акцентный цвет', sub: 'Персонализация → ниже акцент', icon: 'palette', target: 'settings-target-accent' },
  { q: 'анимация думания точки обводка thinking', section: 'general', title: 'Анимация думания', sub: 'Персонализация → Основные', icon: 'progress_activity', target: 'settings-target-thinking' },
  { q: 'логотип анимация svg кольца блобы', section: 'general', title: 'Анимация логотипа', sub: 'Персонализация → Основные', icon: 'animation', target: 'settings-target-logo-anim' },
  { q: 'о вас имя роль инструкции профиль', section: 'user', title: 'О вас', sub: 'Профиль и инструкции', icon: 'person', target: null },
  { q: 'лимиты использование api недельный', section: 'limits', title: 'Лимиты', sub: 'Текущее и недельное использование', icon: 'analytics', target: null },
  { q: 'сонный режим подушка screensaver заставка', section: 'system', title: 'Сонный режим', sub: 'Заставка и таймаут', icon: 'bedtime', target: null },
  { q: 'безопасность пин пароль pin lock', section: 'security', title: 'Безопасность', sub: 'PIN и защита', icon: 'lock', target: null },
  { q: 'пин пароль изменить создать pin password', section: 'security', title: 'Пароль / PIN', sub: 'Безопасность → создать или изменить', icon: 'password', target: 'settings-target-pin' },
  { q: 'безопасный поиск фильтр', section: 'security', title: 'Безопасный поиск', sub: 'Безопасность → ниже', icon: 'shield', target: 'settings-target-safe-search' },
  { q: 'блокировка экрана бездействие', section: 'security', title: 'Блокировка экрана', sub: 'Безопасность → PIN после простоя', icon: 'lock_clock', target: 'settings-target-lock-screen' },
  { q: 'скрыть историю чатов', section: 'security', title: 'Скрыть историю', sub: 'Безопасность', icon: 'visibility_off', target: 'settings-target-hide-history' },
  { q: 'очистка данных удалить всё сброс', section: 'security', title: 'Очистка данных', sub: 'Безопасность → удалить локальные данные', icon: 'delete_forever', target: 'settings-target-clear-data' },
  { q: 'уведомления планы лимиты', section: 'notifications', title: 'Уведомления', sub: 'Планы и лимиты', icon: 'notifications', target: null },
  { q: 'api ключ gemini chatgpt claude grok later generate', section: 'api-keys', title: 'Сторонние API', sub: 'Ключи и Later Generate', icon: 'auto_awesome', target: null },
  { q: 'публичные ссылки share поделиться', section: 'public-links', title: 'Публичные ссылки', sub: 'Совместные чаты', icon: 'link', target: null },
  { q: 'боковое меню сайдбар кнопки split карты навыки библиотека', section: 'sidebar-menu', title: 'Настройка бокового меню', sub: 'До 4 быстрых кнопок', icon: 'tune', target: null },
  { q: 'о проекте версия about', section: 'about', title: 'О проекте', sub: 'Версия и статус', icon: 'info', target: null },
  { q: 'боковое меню при входе разворачивать сворачивать запоминать sidebar boot', section: 'sidebar-menu', title: 'Боковое меню при входе', sub: 'Настройка бокового меню', icon: 'dock_to_right', target: 'settings-target-sidebar-boot' },
  { q: 'слиять с концами flush nav край', section: 'appearance', title: 'Слиять с концами', sub: 'Персонализация → навигация', icon: 'width_full', target: null },
  { q: 'компактная навигация compact nav', section: 'appearance', title: 'Компактная навигация', sub: 'Персонализация', icon: 'compress', target: null },
  { q: 'контекст память чата contentcheck использовать контекст', section: 'user', title: 'Использовать Контекст', sub: 'О вас → память диалога', icon: 'history', target: 'settings-target-context' },
  { q: 'полноэкранный layout fullscreen', section: 'appearance', title: 'Полноэкранный режим', sub: 'Персонализация', icon: 'fullscreen', target: null },
  { q: 'временный чат temporary chat', section: 'appearance', title: 'Временный чат', sub: 'Не сохраняется в историю', icon: 'timer', target: null },
  { q: 'split view параллельный просмотр', section: 'appearance', title: 'Параллельный просмотр', sub: 'Split View', icon: 'splitscreen', target: null },
  { q: 'карты maps навигатор leaflet', section: 'appearance', title: 'Карты', sub: 'Вкладка Карты', icon: 'map', target: null },
  { q: 'боковое меню при входе разворачивать', section: 'sidebar-menu', title: 'Боковое меню при входе', sub: 'Настройка бокового меню', icon: 'dock_to_right', target: 'settings-target-sidebar-boot' }
];

window.onSettingsSearchFocus = function() {
  /* mobile: prepare overlay state when user focuses empty field — only after typing */
};
window.runSettingsSearch = function(q) {
  const box = document.getElementById('settings-search-results');
  const clear = document.getElementById('settings-search-clear');
  const sidebar = document.getElementById('settings-sidebar-menu');
  const screen = document.getElementById('screen-settings');
  if (!box) return;
  q = String(q || '').trim().toLowerCase();
  if (clear) clear.hidden = !q;
  const mobile = window.matchMedia('(max-width: 767px)').matches;
  if (!q) {
    box.hidden = true;
    box.innerHTML = '';
    sidebar?.classList.remove('searching');
    screen?.classList.remove('searching-mobile');
    return;
  }
  const words = q.split(/\s+/).filter(Boolean);
  const hits = SETTINGS_SEARCH_INDEX.filter(x => {
    const hay = (x.q + ' ' + x.title + ' ' + (x.sub || '')).toLowerCase();
    return hay.includes(q) || words.every(w => hay.includes(w)) || words.some(w => w.length > 2 && hay.includes(w));
  });
  box.hidden = false;
  sidebar?.classList.add('searching');
  if (mobile) screen?.classList.add('searching-mobile');
  else screen?.classList.remove('searching-mobile');
  if (!hits.length) {
    box.innerHTML = '<div class="settings-search-empty">Ничего не найдено</div>';
    return;
  }
  box.innerHTML = hits.map(h =>
    '<button type="button" class="settings-search-hit" onclick="jumpSettingsSection(\'' + h.section + '\', \'' + (h.target || '') + '\')">' +
    '<span class="material-symbols-rounded">' + h.icon + '</span>' +
    '<span class="settings-search-hit-text"><b>' + h.title + '</b>' +
    (h.sub ? '<small>' + h.sub + '</small>' : '') +
    '</span></button>'
  ).join('');
};
window.clearSettingsSearch = function() {
  const inp = document.getElementById('settings-search-input');
  if (inp) inp.value = '';
  runSettingsSearch('');
  document.getElementById('settings-sidebar-menu')?.classList.remove('searching');
  document.getElementById('screen-settings')?.classList.remove('searching-mobile');
};
window.jumpSettingsSection = function(sectionId, targetId) {
  if (typeof switchScreen === 'function') switchScreen('settings');
  setTimeout(() => {
    if (typeof showSection === 'function') showSection(sectionId);
    clearSettingsSearch();
    document.getElementById('settings-sidebar-menu')?.classList.remove('searching');
    document.getElementById('screen-settings')?.classList.remove('searching-mobile');
    if (targetId) {
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('settings-flash-hit');
        void el.offsetWidth;
        el.classList.add('settings-flash-hit');
        setTimeout(() => el.classList.remove('settings-flash-hit'), 1600);
      }, 120);
    }
  }, 40);
};

window.showSettingsSearchTip = function() {
  if (localStorage.getItem('oracle_settings_search_tip') === '1') return;
  const tip = document.createElement('div');
  tip.id = 'settings-search-tip';
  tip.className = 'settings-search-tip';
  tip.innerHTML = '<span class="material-symbols-rounded">search</span>' +
    '<div><b>Поиск в настройках</b><p>Кажется хаос? Найдите нужный раздел сверху в Settings.</p></div>' +
    '<button type="button" onclick="this.parentElement.remove();localStorage.setItem(\'oracle_settings_search_tip\',\'1\')">Понятно</button>';
  document.body.appendChild(tip);
  setTimeout(() => { try { tip.remove(); localStorage.setItem('oracle_settings_search_tip','1'); } catch(e){} }, 8000);
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (document.getElementById('screen-settings')?.classList.contains('active-screen')) {
      showSettingsSearchTip();
    }
  }, 1200);
});

// Fix onboarding click-through
(function hardenOnboarding() {
  const prevStart = window.startOnboarding;
  if (typeof prevStart === 'function' && !window.__onbHard) {
    window.__onbHard = true;
    window.startOnboarding = function(force) {
      const r = prevStart.apply(this, arguments);
      const ov = document.getElementById('onboarding-overlay');
      if (ov && !ov.hidden) {
        ov.style.pointerEvents = 'auto';
        ov.style.zIndex = '20000';
        document.body.classList.add('onboarding-open');
      }
      return r;
    };
  }
  const prevFin = window.finishOnboarding;
  if (typeof prevFin === 'function') {
    window.finishOnboarding = function() {
      document.body.classList.remove('onboarding-open');
      return prevFin.apply(this, arguments);
    };
  }
})();

window.dismissOct14Novelty = function(){ localStorage.setItem('oracle_oct14_novelty','1'); };
window.dismissSideCorePromo = function(){ localStorage.setItem('oracle_side_core_promo','1'); };
window.openSideCoreZipHint = function(){
  window.open('https://oracle-ai-pro.github.io/oracle/side-core-node.zip', '_blank');
};
window.openSideCoreExtHint = function(){
  window.open('https://oracle-ai-pro.github.io/oracle/side-core-node.zip', '_blank');
};
window.closeTreeFeatureModal = function(){ localStorage.setItem('oracle_tree_feature_seen_v1','true'); };

/* ===== AI Skills + Connectors ===== */
(function skillsSystem() {
  const SKILLS_KEY = 'oracle_user_skills_v1';
  const BUILTIN_STATE_KEY = 'oracle_builtin_skills_state_v1'; // { id: { disabled, uninstalled } }
  const ACTIVE_SKILL_KEY = 'oracle_active_skill';
  const ACTIVE_CONN_KEY = 'oracle_active_connector';

  const BUILTIN = [
    { id: 'b_short', name: 'Кратко', cmd: 'short', prompt: 'Отвечай кратко: 3–5 предложений, без воды и лишних списков.', builtin: true },
    { id: 'b_detail', name: 'Подробно', cmd: 'detail', prompt: 'Отвечай развёрнуто, со структурой, подзаголовками и примерами.', builtin: true },
    { id: 'b_code', name: 'Разбор кода', cmd: 'code', prompt: 'Разбор кода: структура → риски → конкретный патч. Без лишних вступлений.', builtin: true },
    { id: 'b_eli5', name: 'Как новичку', cmd: 'eli5', prompt: 'Объясняй простыми словами, без жаргона, короткими абзацами.', builtin: true },
    { id: 'b_plan', name: 'План', cmd: 'plan', prompt: 'Составь нумерованный план шагов. Если уместно — предложи сохранить в Планы.', builtin: true },
    { id: 'b_review', name: 'Ревью', cmd: 'review', prompt: 'Жёсткое ревью: плюсы, минусы, что исправить в первую очередь.', builtin: true },
    { id: 'b_sources', name: 'По источникам', cmd: 'sources', prompt: 'Опирайся только на прикреплённые файлы, библиотеку и контекст чата. Если данных мало — так и скажи.', builtin: true },
    { id: 'b_quiet', name: 'Тихий режим', cmd: 'quiet', prompt: 'Без эмодзи, без похвалы и вводных фраз. Сухой деловой тон.', builtin: true }
  ];

  const CONNECTORS = [
    { id: 'tasks', label: 'Задачи', icon: 'task_alt', desc: 'Создавайте задания; ИИ выполняет, если разрешено.' },
    { id: 'notepad', label: 'Oracle Notepad', icon: 'terminal', desc: 'Умное кодирование в связке с Notepad.' },
    { id: 'plans', label: 'Планы', icon: 'schedule', desc: 'Напоминания и календарь из чата.' },
    { id: 'library', label: 'Библиотека', icon: 'local_library', desc: 'Работа с файлами без повторного вложения.' },
    { id: 'maps', label: 'Карты', icon: 'map', desc: 'Поиск и навигация по OSM.' },
    { id: 'skill_creator', label: 'Skill Creator', icon: 'auto_awesome', desc: 'Создайте навык в диалоге с ИИ.' }
  ];

  function loadUserSkills() {
    try { return JSON.parse(localStorage.getItem(SKILLS_KEY) || '[]') || []; } catch(e) { return []; }
  }
  function saveUserSkills(arr) {
    localStorage.setItem(SKILLS_KEY, JSON.stringify(arr));
  }
  function loadBuiltinState() {
    try { return JSON.parse(localStorage.getItem(BUILTIN_STATE_KEY) || '{}') || {}; } catch(e) { return {}; }
  }
  function saveBuiltinState(st) {
    localStorage.setItem(BUILTIN_STATE_KEY, JSON.stringify(st));
  }

  window.allSkills = function allSkills() {
    const st = loadBuiltinState();
    const builtins = BUILTIN.filter(b => !st[b.id]?.uninstalled).map(b => ({
      ...b,
      disabled: !!st[b.id]?.disabled
    }));
    const users = loadUserSkills().map(u => ({ ...u, builtin: false }));
    return [...builtins, ...users];
  }

  window.getActiveSkill = function() {
    try { return JSON.parse(sessionStorage.getItem(ACTIVE_SKILL_KEY) || 'null'); } catch(e) { return null; }
  };
  window.setActiveSkill = function(skill) {
    if (skill) sessionStorage.setItem(ACTIVE_SKILL_KEY, JSON.stringify({ id: skill.id, cmd: skill.cmd, name: skill.name, prompt: skill.prompt }));
    else sessionStorage.removeItem(ACTIVE_SKILL_KEY);
  };
  window.getActiveConnector = function() {
    try { return JSON.parse(sessionStorage.getItem(ACTIVE_CONN_KEY) || 'null'); } catch(e) { return null; }
  };
  window.setActiveConnector = function(c) {
    if (c) sessionStorage.setItem(ACTIVE_CONN_KEY, JSON.stringify(c));
    else sessionStorage.removeItem(ACTIVE_CONN_KEY);
  };

  window.renderConnectorsCatalog = function() {
    const box = document.getElementById('connectors-catalog');
    if (!box) return;
    box.innerHTML = CONNECTORS.map(c =>
      '<div class="connector-card">' +
      '<span class="material-symbols-rounded">' + c.icon + '</span>' +
      '<div><b>@' + c.label + '</b><small>' + c.desc + '</small></div></div>'
    ).join('');
  };

  window.renderSkillsList = function() {
    const box = document.getElementById('skills-list');
    if (!box) return;
    const list = allSkills();
    if (!list.length) {
      box.innerHTML = '<div class="unified-empty">Нет навыков. Создайте первый.</div>';
      return;
    }
    box.innerHTML = list.map(s => {
      const dis = s.disabled ? ' disabled-skill' : '';
      const badge = s.builtin ? '<span class="skill-badge">БАЗОВЫЙ</span>' : '';
      const desc = (s.prompt || '').slice(0, 120) + ((s.prompt || '').length > 120 ? '…' : '');
      return '<div class="skill-card' + dis + '" data-skill-id="' + s.id + '" data-builtin="' + (s.builtin ? '1' : '0') + '">' +
        '<div class="skill-card-body">' +
        '<div class="skill-name">' + escapeHtml(s.name) + badge + '</div>' +
        '<div class="skill-cmd">/' + escapeHtml(s.cmd) + '</div>' +
        '<div class="skill-desc">' + escapeHtml(desc) + '</div></div>' +
        '<button type="button" class="skill-more" onclick="openSkillCtx(event,\'' + s.id + '\')" title="Ещё">' +
        '<span class="material-symbols-rounded">more_vert</span></button></div>';
    }).join('');
  };

  let _skillCtxId = null;
  window.openSkillCtx = function(e, id) {
    e.preventDefault(); e.stopPropagation();
    _skillCtxId = id;
    const skill = allSkills().find(s => s.id === id);
    if (!skill) return;
    const menu = document.getElementById('skill-ctx-menu');
    if (!menu) return;
    const toggleLabel = document.getElementById('skill-ctx-toggle-label');
    if (toggleLabel) toggleLabel.textContent = skill.disabled ? 'Включить' : 'Отключить';
    const un = document.getElementById('skill-ctx-uninstall');
    const ed = document.getElementById('skill-ctx-edit');
    const del = document.getElementById('skill-ctx-delete');
    if (skill.builtin) {
      if (un) un.style.display = 'flex';
      if (ed) ed.style.display = 'none';
      if (del) del.style.display = 'none';
    } else {
      if (un) un.style.display = 'none';
      if (ed) ed.style.display = 'flex';
      if (del) del.style.display = 'flex';
    }
    menu.style.display = 'block';
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 180);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  };
  document.addEventListener('click', () => {
    const m = document.getElementById('skill-ctx-menu');
    if (m) m.style.display = 'none';
  });

  window.skillCtxToggle = function() {
    const id = _skillCtxId; if (!id) return;
    const skill = allSkills().find(s => s.id === id);
    if (!skill) return;
    if (skill.builtin) {
      const st = loadBuiltinState();
      st[id] = st[id] || {};
      st[id].disabled = !skill.disabled;
      saveBuiltinState(st);
    } else {
      const arr = loadUserSkills();
      const i = arr.findIndex(x => x.id === id);
      if (i >= 0) { arr[i].disabled = !arr[i].disabled; saveUserSkills(arr); }
    }
    renderSkillsList();
    showToast?.(skill.disabled ? 'Навык включён' : 'Навык отключён', 'success');
  };
  window.skillCtxUninstall = function() {
    const id = _skillCtxId; if (!id) return;
    const st = loadBuiltinState();
    st[id] = st[id] || {};
    st[id].uninstalled = true;
    saveBuiltinState(st);
    renderSkillsList();
    showToast?.('Убран из установленных (базовый можно вернуть сбросом)', 'info');
  };
  window.skillCtxEdit = function() {
    const id = _skillCtxId; if (!id) return;
    const skill = loadUserSkills().find(s => s.id === id);
    if (!skill) return;
    openCreateSkillModal(skill);
  };
  window.skillCtxDelete = function() {
    const id = _skillCtxId; if (!id) return;
    const go = () => {
      saveUserSkills(loadUserSkills().filter(s => s.id !== id));
      renderSkillsList();
      showToast?.('Навык удалён', 'warning');
    };
    if (typeof showCustomModal === 'function') {
      showCustomModal('Удалить навык?', 'Удаление необратимо.', false, '', ok => { if (ok) go(); });
    } else go();
  };

  let _editSkillId = null;
  window.openCreateSkillModal = function(existing) {
    _editSkillId = existing?.id || null;
    const t = document.getElementById('skill-editor-title');
    if (t) t.textContent = existing ? 'Изменить навык' : 'Новый навык';
    document.getElementById('skill-name-input').value = existing?.name || '';
    document.getElementById('skill-cmd-input').value = existing?.cmd || '';
    document.getElementById('skill-prompt-input').value = existing?.prompt || '';
    document.getElementById('skill-editor-modal')?.classList.add('active');
  };
  window.closeSkillEditor = function() {
    document.getElementById('skill-editor-modal')?.classList.remove('active');
    _editSkillId = null;
  };
  window.saveSkillFromEditor = function() {
    let name = (document.getElementById('skill-name-input')?.value || '').trim();
    let cmd = (document.getElementById('skill-cmd-input')?.value || '').trim().toLowerCase().replace(/^\//, '');
    cmd = cmd.replace(/[^a-z0-9_]/g, '');
    const prompt = (document.getElementById('skill-prompt-input')?.value || '').trim();
    if (!name || !cmd || !prompt) {
      showToast?.('Заполните имя, команду и инструкцию', 'warning');
      return;
    }
    const reserved = BUILTIN.map(b => b.cmd);
    if (!_editSkillId && reserved.includes(cmd)) {
      showToast?.('Команда занята базовым навыком — выберите другую', 'warning');
      return;
    }
    const arr = loadUserSkills();
    if (_editSkillId) {
      const i = arr.findIndex(x => x.id === _editSkillId);
      if (i >= 0) arr[i] = { ...arr[i], name, cmd, prompt };
    } else {
      arr.push({ id: 'u_' + Date.now(), name, cmd, prompt, disabled: false });
    }
    saveUserSkills(arr);
    closeSkillEditor();
    setSkillsTab('skills');
    renderSkillsList();
    showToast?.('Навык сохранён', 'success');
  };

  window.startSkillCreatorChat = function() {
    setActiveConnector({ id: 'skill_creator', label: 'Skill Creator' });
    closeSkillsHub();
    if (typeof switchScreen === 'function') switchScreen('chat');
    showToast?.('Коннектор Skill Creator · опишите навык в чате', 'info');
    const input = document.getElementById('user-input');
    if (input) {
      input.focus();
      if (!input.value) input.placeholder = 'Опишите навык: имя, /команда, поведение…';
    }
  };

  const prevSetTab = window.setSkillsTab;
  window.setSkillsTab = function(tab) {
    document.querySelectorAll('.skills-hub-tab').forEach(b => {
      if (b.dataset.skillsTab) b.classList.toggle('active', b.dataset.skillsTab === tab);
    });
    const store = document.getElementById('skills-panel-store');
    const skills = document.getElementById('skills-panel-skills');
    if (store) store.hidden = tab !== 'store';
    if (skills) skills.hidden = tab !== 'skills';
    if (tab === 'skills') renderSkillsList();
    if (tab === 'store') renderConnectorsCatalog();
  };
  const prevOpen = window.openSkillsHub;
  window.openSkillsHub = function() {
    document.getElementById('sidebar-archive')?.classList.remove('open');
    document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active-screen'));
    document.getElementById('screen-skills')?.classList.add('active-screen');
    document.querySelector('.glass-nav')?.classList.add('nav-hidden-skills');
    setSkillsTab('skills');
    renderSkillsList();
    renderConnectorsCatalog();
  };
  window.closeSkillsHub = function() {
    document.getElementById('screen-skills')?.classList.remove('active-screen');
    document.querySelector('.glass-nav')?.classList.remove('nav-hidden-skills');
    if (typeof switchScreen === 'function') switchScreen('chat');
  };

  // Restore uninstalled builtins helper
  window.restoreBuiltinSkills = function() {
    localStorage.removeItem(BUILTIN_STATE_KEY);
    renderSkillsList();
    showToast?.('Базовые навыки восстановлены', 'success');
  };
})();

/* ===== Input mode Chat / Task ===== */
(function inputModeChatTask() {
  const KEY = 'oracle_input_mode'; // remembered preference after first choice
  const TASK_WELCOME = 'oracle_task_welcome_seen';

  function getMode() {
    return localStorage.getItem(KEY) || 'chat';
  }

  window.setInputMode = function(mode, opts) {
    opts = opts || {};
    mode = mode === 'task' ? 'task' : 'chat';
    const prev = (localStorage.getItem('oracle_input_mode') || 'chat');
    localStorage.setItem('oracle_input_mode', mode);
    if (typeof CoreState === 'object') CoreState.inputMode = mode;

    document.getElementById('mode-chip-chat')?.classList.toggle('active', mode === 'chat');
    document.getElementById('mode-chip-task')?.classList.toggle('active', mode === 'task');

    const input = document.getElementById('user-input');
    if (input && !input.value.trim()) {
      input.placeholder = mode === 'task' ? 'Опишите задачу…' : (input.dataset.ph || 'Спросите что-нибудь…');
    }
    document.body.classList.toggle('task-mode', mode === 'task');
    if (typeof updateTaskWelcomeScreen === 'function') updateTaskWelcomeScreen(mode);

    try {
      if (typeof currentSessionId !== 'undefined' && currentSessionId && chatSessions[currentSessionId]) {
        chatSessions[currentSessionId].mode = mode;
        localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
        if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
      }
    } catch (e) {}

    if (mode === 'task' && prev !== 'task' && !localStorage.getItem('oracle_task_welcome_seen') && !opts.silent) {
      document.getElementById('task-welcome-modal')?.classList.add('active');
    }
  };

  window.updateTaskWelcomeScreen = function(mode) {
    const g = document.getElementById('welcome-greeting');
    const s = document.getElementById('welcome-subtext');
    if (!g || !s) return;
    if (mode === 'task') {
      g.textContent = 'Какую задачу решим?';
      s.textContent = 'Режим Task: опишите цель по шагам. ИИ поможет с планом — ответственность за действия остаётся за вами.';
      return;
    }
    if (typeof CoreState === 'object' && CoreState.isTempChat) return;
    let name = '';
    try { name = (JSON.parse(localStorage.getItem('oracle_user_profile') || '{}').name) || ''; } catch (e) {}
    g.textContent = name ? ('Привет, ' + name + '!') : 'Привет! Как твои дела?';
    s.textContent = 'Готов к работе. Чем я могу помочь тебе сегодня?';
  };

  window.closeTaskWelcome = function() {
    localStorage.setItem(TASK_WELCOME, '1');
    document.getElementById('task-welcome-modal')?.classList.remove('active');
  };

  function boot() {
    const m = getMode();
    // First visit: chat default (no KEY yet already handled)
    setInputMode(m, { silent: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

window.stampCurrentSessionMode = function() {
  try {
    if (typeof currentSessionId === 'undefined' || !currentSessionId) return;
    if (typeof chatSessions !== 'object' || !chatSessions[currentSessionId]) return;
    chatSessions[currentSessionId].mode = localStorage.getItem('oracle_input_mode') || 'chat';
    localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
  } catch (e) {}
};

/* task mode stamp wrap */
(function(){
  function wrap(name) {
    const orig = window[name];
    if (typeof orig !== 'function' || orig._taskStamped) return;
    const w = function() {
      const r = orig.apply(this, arguments);
      try { window.stampCurrentSessionMode && window.stampCurrentSessionMode(); } catch(e){}
      return r;
    };
    w._taskStamped = true;
    window[name] = w;
  }
  ['sendMsg','sendMessage'].forEach(wrap);
  // also non-window
  if (typeof sendMsg === 'function' && !sendMsg._taskStamped) {
    /* can't reassign const */
  }
})();

/* ===== Chat Context memory (per session) ===== */
(function chatContextMemory() {
  const MAX_CHARS = 3500;
  const MAX_BYTES = 6 * 1024;
  const USE_KEY = 'oracle_use_context'; // default on

  function useContextEnabled() {
    const v = localStorage.getItem(USE_KEY);
    return v === null || v === '1' || v === 'true';
  }
  window.toggleUseContext = function(on) {
    localStorage.setItem(USE_KEY, on ? '1' : '0');
    syncChatMemoryGate();
    showToast?.(on ? 'Контекст включён' : 'Контекст выключен — ИИ может забывать детали', on ? 'success' : 'warning');
  };
  window.isUseContextOn = useContextEnabled;

  function byteLen(s) {
    try { return new TextEncoder().encode(s).length; } catch (e) { return (s || '').length; }
  }
  function clampContext(text) {
    let t = String(text || '');
    if (t.length > MAX_CHARS) t = t.slice(0, MAX_CHARS);
    while (byteLen(t) > MAX_BYTES && t.length) t = t.slice(0, -1);
    return t;
  }
  function sessionKey() {
    if (typeof CoreState === 'object' && CoreState.isTempChat) return '__temp__';
    if (typeof currentSessionId !== 'undefined' && currentSessionId) return currentSessionId;
    return null;
  }
  window.getChatContext = function(sid) {
    sid = sid || sessionKey();
    if (!sid) return '';
    if (sid === '__temp__') return (CoreState._tempContext || '');
    try {
      if (chatSessions[sid] && typeof chatSessions[sid].context === 'string') return chatSessions[sid].context;
      const map = JSON.parse(localStorage.getItem('oracle_chat_contexts') || '{}') || {};
      return map[sid] || '';
    } catch (e) { return ''; }
  };
  window.setChatContext = function(text, sid) {
    sid = sid || sessionKey();
    text = clampContext(text);
    if (!sid) return text;
    if (sid === '__temp__') {
      CoreState._tempContext = text;
      return text;
    }
    if (!chatSessions[sid]) chatSessions[sid] = { title: 'Чат', html: '', mode: 'chat' };
    chatSessions[sid].context = text;
    try {
      localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
      const map = JSON.parse(localStorage.getItem('oracle_chat_contexts') || '{}') || {};
      map[sid] = text;
      localStorage.setItem('oracle_chat_contexts', JSON.stringify(map));
    } catch (e) {}
    return text;
  };
  window.chatContextUsage = function(sid) {
    const t = getChatContext(sid);
    const chars = t.length;
    const bytes = byteLen(t);
    const full = chars >= MAX_CHARS || bytes >= MAX_BYTES;
    const ratio = Math.min(1, Math.max(chars / MAX_CHARS, bytes / MAX_BYTES));
    return { chars, bytes, maxChars: MAX_CHARS, maxBytes: MAX_BYTES, full, ratio, left: Math.max(0, MAX_CHARS - chars) };
  };
  window.isChatMemoryFull = function() {
    if (!useContextEnabled()) return false;
    return chatContextUsage().full;
  };

  window.syncChatMemoryGate = function() {
    const ov = document.getElementById('chat-memory-full-overlay');
    const full = isChatMemoryFull();
    if (ov) {
      if (full && useContextEnabled()) ov.hidden = false;
      else ov.hidden = true;
    }
    const send = document.getElementById('send-btn');
    if (send && full && useContextEnabled()) send.classList.remove('visible');
  };
  window.hideChatMemoryFull = function() {
    const ov = document.getElementById('chat-memory-full-overlay');
    if (ov) ov.hidden = true;
  };

  window.refreshContextGauge = function() {
    const u = chatContextUsage();
    const fill = document.getElementById('ctx-gauge-fill');
    const lab = document.getElementById('ctx-gauge-label');
    const left = document.getElementById('ctx-gauge-left');
    if (fill) {
      fill.style.width = Math.round(u.ratio * 100) + '%';
      fill.classList.toggle('warn', u.ratio >= 0.8 && u.ratio < 1);
      fill.classList.toggle('full', u.full);
    }
    if (lab) lab.textContent = u.chars + ' / ' + u.maxChars;
    if (left) left.textContent = u.full ? 'Лимит' : ('Осталось ' + u.left);
  };

  window.openChatContextEditor = function(sid) {
    hideChatMemoryFull();
    const screen = document.getElementById('chat-context-screen');
    const ed = document.getElementById('chat-context-editor');
    if (!screen || !ed) return;
    CoreState._ctxEditSid = sid || sessionKey();
    ed.value = getChatContext(CoreState._ctxEditSid);
    refreshContextGauge();
    screen.hidden = false;
    document.body.classList.add('context-editor-open');
    setTimeout(() => ed.focus(), 50);
  };
  window.closeChatContextEditor = function() {
    document.getElementById('chat-context-screen').hidden = true;
    document.body.classList.remove('context-editor-open');
    syncChatMemoryGate();
  };
  window.onChatContextInput = function() {
    const ed = document.getElementById('chat-context-editor');
    if (!ed) return;
    const c = clampContext(ed.value);
    if (c !== ed.value) {
      ed.value = c;
      showToast?.('Контекст обрезан до лимита 3500 / 6 КБ', 'warning');
    }
    // live gauge without save
    const tmp = ed.value;
    const sid = CoreState._ctxEditSid;
    const prev = getChatContext(sid);
    setChatContext(tmp, sid);
    refreshContextGauge();
    // keep as draft in editor only until Save - actually we already wrote; Save just closes
  };
  window.saveChatContextFromEditor = function() {
    const ed = document.getElementById('chat-context-editor');
    if (ed) setChatContext(ed.value, CoreState._ctxEditSid);
    refreshContextGauge();
    closeChatContextEditor();
    showToast?.('Контекст сохранён', 'success');
    if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
  };
  window.clearChatContextConfirm = function() {
    const go = () => {
      setChatContext('', CoreState._ctxEditSid);
      const ed = document.getElementById('chat-context-editor');
      if (ed) ed.value = '';
      refreshContextGauge();
      showToast?.('Контекст очищен — ИИ может забыть детали', 'warning');
    };
    if (typeof showCustomModal === 'function') {
      showCustomModal('Очистить контекст?', 'ИИ может не помнить, о чём шла речь в этом чате.', false, '', ok => { if (ok) go(); });
    } else go();
  };

  window.cmOpenChatContext = function() {
    const id = (window._ctxSessionId) || (currentContextNode && currentContextNode.dataset.sessionId) || currentSessionId;
    document.getElementById('context-menu') && (document.getElementById('context-menu').style.display = 'none');
    openChatContextEditor(id);
  };

  // silent merge helpers (API + user)
  window.appendToChatContext = function(chunk, sid) {
    if (!useContextEnabled()) return getChatContext(sid);
    chunk = String(chunk || '').trim();
    if (!chunk) return getChatContext(sid);
    let cur = getChatContext(sid);
    if (cur.includes(chunk)) return cur;
    const next = clampContext((cur ? cur + '\n' : '') + chunk);
    return setChatContext(next, sid);
  };

  // Secret system guidance (never shown as user-facing "I am context keeper")
  window.getContextSystemHint = function() {
    if (!useContextEnabled()) return '';
    return (
      'Внутреннее правило (не озвучивай пользователю): поддерживай краткую память диалога. ' +
      'Не представляйся «хранителем контекста» и не проси писать, что добавить. ' +
      'Редко (не чаще раза в несколько ответов) можно в конце спросить: «Мне сохранить эту информацию?» ' +
      'Обычные детали молча учитывай. Если пользователь вызвал @ContentCheck — сначала сверься с блоком CONTEXT и при необходимости обнови выжимку.'
    );
  };

  window.buildContextBlockForApi = function(force) {
    if (!useContextEnabled()) return '';
    const active = force || (typeof getActiveConnector === 'function' && (getActiveConnector() || {}).id === 'content-check')
      || /\b@ContentCheck\b/i.test(CoreState._lastApiUserMsg || '');
    if (!force && !active && !CoreState._forceContextCheck) {
      // still soft-include short context if any (helps forgetfulness) when under 2k
      const t = getChatContext();
      if (!t) return '';
      // always include when context exists and toggle on — user asked API forgets; soft include
      return '\n\n[CONTEXT]\n' + t.slice(0, MAX_CHARS) + '\n[/CONTEXT]\n';
    }
    const t = getChatContext();
    if (!t) return '';
    return '\n\n[CONTEXT]\n' + t + '\n[/CONTEXT]\n';
  };

  // thinking label
  window.setThinkingLabel = function(text) {
    const el = document.querySelector('#ai-thinking-indicator .think-label');
    if (el) el.textContent = text || 'Модель думает…';
  };

  // extract silent facts from short replies heuristic
  window.maybeSilentContextUpdate = function(userMsg, aiText) {
    if (!useContextEnabled() || CoreState.isTempChat) return;
    if (isChatMemoryFull()) return;
    const u = (userMsg || '').trim();
    const a = (aiText || '').trim();
    // skip pure greetings
    if (u.length < 8 && a.length < 40) return;
    // if ContentCheck — store denser summary
    const force = CoreState._forceContextCheck || /@ContentCheck/i.test(u);
    let piece = '';
    if (force) {
      piece = '• ' + u.slice(0, 200) + (a ? ' → ' + a.slice(0, 400) : '');
      CoreState._forceContextCheck = false;
    } else if (u.length > 40) {
      // silent: keep user fact lines
      piece = '• ' + u.slice(0, 220);
    }
    if (piece) {
      appendToChatContext(piece);
      syncChatMemoryGate();
    }
  };

  // patch showThinkingIndicator label
  const _sti = window.showThinkingIndicator;
  if (typeof showThinkingIndicator === 'function' || typeof _sti === 'function') {
    const orig = typeof showThinkingIndicator === 'function' ? showThinkingIndicator : _sti;
  }
  window.showThinkingIndicator = function(show, label) {
    const style = (typeof getThinkingStyle === 'function') ? getThinkingStyle() : 'dots';
    if (style === 'off') {
      document.getElementById('ai-thinking-indicator')?.classList.remove('visible');
      return;
    }
    const el = (typeof ensureThinkingIndicator === 'function') ? ensureThinkingIndicator() : document.getElementById('ai-thinking-indicator');
    if (!el) return;
    const lab = el.querySelector('.think-label');
    if (lab) lab.textContent = label || 'Модель думает…';
    el.classList.toggle('visible', !!show);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const cb = document.getElementById('set-use-context');
    if (cb) cb.checked = useContextEnabled();
    syncChatMemoryGate();
  });
})();

/* Gate sendMsg for full memory + context inject + silent update */
(function patchSendForContext() {
  const orig = typeof sendMsg === 'function' ? sendMsg : null;
  if (!orig || orig._ctxPatched) return;
  function gatedSendMsg() {
    if (typeof isUseContextOn === 'function' && isUseContextOn() && typeof isChatMemoryFull === 'function' && isChatMemoryFull()) {
      const ov = document.getElementById('chat-memory-full-overlay');
      if (ov) ov.hidden = false;
      showToast?.('Память чата заполнена', 'warning');
      return;
    }
    const input = document.getElementById('user-input');
    const msg = (input && input.value || '').trim();
    if (/@ContentCheck\b/i.test(msg) || (typeof getActiveConnector === 'function' && (getActiveConnector() || {}).id === 'content-check')) {
      CoreState._forceContextCheck = true;
      if (typeof setThinkingLabel === 'function') setThinkingLabel('Сверяю контекст…');
      if (typeof showThinkingIndicator === 'function') showThinkingIndicator(true, 'Сверяю контекст…');
    }
    return orig.apply(this, arguments);
  }
  gatedSendMsg._ctxPatched = true;
  // assign both
  try { sendMsg = gatedSendMsg; } catch (e) {}
  window.sendMsg = gatedSendMsg;

  const origResolve = typeof resolveAiResponse === 'function' ? resolveAiResponse : null;
  if (origResolve && !origResolve._ctxPatched) {
    window.resolveAiResponse = async function(msg) {
      const force = CoreState._forceContextCheck || /@ContentCheck\b/i.test(msg || '');
      if (force && typeof showThinkingIndicator === 'function') {
        showThinkingIndicator(true, 'Сверяю контекст…');
      }
      let augmented = msg;
      if (typeof buildContextBlockForApi === 'function') {
        const block = buildContextBlockForApi(force);
        const hint = (typeof getContextSystemHint === 'function') ? getContextSystemHint() : '';
        if (block || hint) {
          augmented = (hint ? hint + '\n' : '') + (block || '') + '\nUser: ' + msg;
        }
      }
      const result = await origResolve.call(this, augmented);
      if (result && result.ok && typeof maybeSilentContextUpdate === 'function') {
        maybeSilentContextUpdate(msg, result.text);
      }
      if (typeof setThinkingLabel === 'function') setThinkingLabel('Модель думает…');
      CoreState._forceContextCheck = false;
      return result;
    };
    window.resolveAiResponse._ctxPatched = true;
  }
})();

/* Split: chat-context mode */
(function patchSplitContext() {
  const prev = typeof selectSplitMode === 'function' ? selectSplitMode : null;
  if (!prev || prev._ctxSplit) return;
  // patch apply path by wrapping confirmSplit / selectSplitMode usage at applySplitSelection
})();

window.ensureContextSplitPane = function() {
  let el = document.getElementById('screen-context-split');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'screen-context-split';
  el.className = 'app-screen active-screen context-split-pane';
  el.innerHTML = '<div class="chat-context-top" style="position:static;padding:8px 0;"><h2 style="margin:0;font-size:16px;">Контекст</h2></div>' +
    '<div class="chat-context-gauge"><div class="chat-context-gauge-bar"><div id="ctx-gauge-fill-split"></div></div>' +
    '<div class="chat-context-gauge-meta"><span id="ctx-gauge-label-split">0 / 3500</span></div></div>' +
    '<textarea id="chat-context-editor-split" maxlength="3500" placeholder="Контекст этого чата…" style="flex:1;width:100%;min-height:200px;border-radius:12px;border:1px solid var(--border);background:var(--surface-variant);color:var(--on-surface);padding:12px;box-sizing:border-box;"></textarea>' +
    '<button type="button" class="modal-btn modal-btn-accept" style="margin-top:8px;" onclick="saveSplitContext()">Сохранить контекст</button>';
  return el;
};
window.saveSplitContext = function() {
  const ed = document.getElementById('chat-context-editor-split');
  if (ed && typeof setChatContext === 'function') {
    setChatContext(ed.value);
    showToast?.('Контекст сохранён', 'success');
    if (typeof refreshContextGauge === 'function') refreshContextGauge();
  }
};
window.loadSplitContextEditor = function() {
  const ed = document.getElementById('chat-context-editor-split');
  if (ed && typeof getChatContext === 'function') ed.value = getChatContext();
  const u = typeof chatContextUsage === 'function' ? chatContextUsage() : null;
  const fill = document.getElementById('ctx-gauge-fill-split');
  const lab = document.getElementById('ctx-gauge-label-split');
  if (u && fill) fill.style.width = Math.round(u.ratio * 100) + '%';
  if (u && lab) lab.textContent = u.chars + ' / ' + u.maxChars;
};

(function patchResolveAiContextDelayed() {
  function tryPatch() {
    const orig = window.resolveAiResponse || (typeof resolveAiResponse === 'function' ? resolveAiResponse : null);
    if (!orig || orig._ctxPatched2) return;
    const wrapped = async function(msg) {
      const force = !!(CoreState && (CoreState._forceContextCheck || /@ContentCheck\b/i.test(msg || '')));
      if (force && typeof showThinkingIndicator === 'function') showThinkingIndicator(true, 'Сверяю контекст…');
      let augmented = msg;
      try {
        if (typeof buildContextBlockForApi === 'function') {
          const block = buildContextBlockForApi(true); // always attach CONTEXT block when toggle on
          const soft = buildContextBlockForApi(force);
          const use = force ? soft : (typeof isUseContextOn === 'function' && isUseContextOn() ? buildContextBlockForApi(true) : '');
          const hint = (typeof getContextSystemHint === 'function' && isUseContextOn()) ? getContextSystemHint() : '';
          if (use || hint) augmented = (hint ? hint + '\n' : '') + (use || '') + '\nUser: ' + msg;
        }
      } catch (e) {}
      const result = await orig.call(this, augmented);
      try {
        if (result && result.ok && typeof maybeSilentContextUpdate === 'function') maybeSilentContextUpdate(msg, result.text);
      } catch (e) {}
      if (CoreState) CoreState._forceContextCheck = false;
      return result;
    };
    wrapped._ctxPatched2 = true;
    window.resolveAiResponse = wrapped;
    try { resolveAiResponse = wrapped; } catch (e) {}
  }
  tryPatch();
  document.addEventListener('DOMContentLoaded', tryPatch);
  setTimeout(tryPatch, 500);
})();

/* ===== Input tag chips: 1 connector + 2 skills above field ===== */
(function inputTagChips() {
  const MAX_CONN = 1;
  const MAX_SKILLS = 2;

  CoreState.tagConnector = null; // { id, label }
  CoreState.tagSkills = []; // [{ cmd, name }]
  CoreState._tagReplacePending = null;

  function isEditLocked() {
    return document.body.classList.contains('edit-msg-mode');
  }

  function stripTrailingTrigger(kind) {
    const input = document.getElementById('user-input');
    if (!input) return;
    let v = input.value;
    if (kind === 'at') v = v.replace(/(^|\s)@[^\s]*$/, '$1');
    else if (kind === 'slash') v = v.replace(/(^|\s)\/[^\s]*$/, '$1');
    input.value = v.replace(/\s+$/, (input.value.endsWith('\n') ? '\n' : ''));
    if (typeof handleInput === 'function') handleInput(input);
  }

  window.renderTagChips = function() {
    const box = document.getElementById('tag-chips');
    if (!box) return;
    const parts = [];
    if (CoreState.tagConnector) {
      const c = CoreState.tagConnector;
      parts.push(
        '<span class="tag-chip conn-chip" data-kind="conn">' +
        '<span class="material-symbols-rounded">hub</span>@' + escapeTag(c.label || c.id) +
        '<button type="button" class="tag-chip-x" onclick="removeTagChip(\'conn\')" title="Убрать">×</button></span>'
      );
    }
    (CoreState.tagSkills || []).forEach((s, i) => {
      parts.push(
        '<span class="tag-chip skill-chip" data-kind="skill" data-i="' + i + '">' +
        '<span class="material-symbols-rounded">bolt</span>/' + escapeTag(s.cmd) +
        '<button type="button" class="tag-chip-x" onclick="removeTagChip(\'skill\',' + i + ')" title="Убрать">×</button></span>'
      );
    });
    box.innerHTML = parts.join('');
    box.style.display = parts.length ? 'flex' : 'none';
  };

  function escapeTag(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  window.removeTagChip = function(kind, index) {
    if (isEditLocked()) return;
    if (kind === 'conn') CoreState.tagConnector = null;
    else if (kind === 'skill') {
      CoreState.tagSkills.splice(index, 1);
    }
    renderTagChips();
  };

  window.clearTagChips = function() {
    CoreState.tagConnector = null;
    CoreState.tagSkills = [];
    renderTagChips();
  };

  window.getTagPrefixForSend = function() {
    const bits = [];
    if (CoreState.tagConnector) bits.push('@' + (CoreState.tagConnector.label || CoreState.tagConnector.id));
    (CoreState.tagSkills || []).forEach(s => bits.push('/' + s.cmd));
    return bits.length ? bits.join(' ') + ' ' : '';
  };

  window.closeTagReplaceModal = function() {
    document.getElementById('tag-replace-modal')?.classList.remove('active');
    CoreState._tagReplacePending = null;
  };

  window.confirmTagReplace = function() {
    const p = CoreState._tagReplacePending;
    closeTagReplaceModal();
    if (!p) return;
    if (p.kind === 'conn') {
      CoreState.tagConnector = { id: p.id, label: p.label };
      stripTrailingTrigger('at');
    } else if (p.kind === 'skill') {
      if (CoreState.tagSkills.length >= MAX_SKILLS) CoreState.tagSkills.shift();
      CoreState.tagSkills.push({ cmd: p.cmd, name: p.name || p.cmd });
      stripTrailingTrigger('slash');
    }
    renderTagChips();
  };

  function openReplaceModal(kind, payload) {
    CoreState._tagReplacePending = Object.assign({ kind }, payload);
    const title = document.getElementById('tag-replace-title');
    const text = document.getElementById('tag-replace-text');
    if (kind === 'conn') {
      if (title) title.textContent = 'Коннектор уже выбран';
      if (text) text.textContent = 'На один запрос — только 1 коннектор. Заменить на @' + (payload.label || payload.id) + '?';
    } else {
      if (title) title.textContent = 'Лимит навыков';
      if (text) text.textContent = 'Можно до 2 навыков. Заменить самый старый на /' + payload.cmd + '?';
    }
    document.getElementById('tag-replace-modal')?.classList.add('active');
  }

  window.addConnectorChip = function(id, label) {
    if (isEditLocked()) {
      showToast?.('При редактировании сообщения теги менять нельзя', 'warning');
      return false;
    }
    id = id || label;
    label = label || id;
    if (CoreState.tagConnector) {
      openReplaceModal('conn', { id, label });
      hideConnectors?.();
      return false;
    }
    CoreState.tagConnector = { id, label };
    stripTrailingTrigger('at');
    hideConnectors?.();
    renderTagChips();
    showToast?.('Коннектор @' + label, 'info', 1600);
    return true;
  };

  window.addSkillChip = function(cmd, name) {
    if (isEditLocked()) {
      showToast?.('При редактировании сообщения теги менять нельзя', 'warning');
      return false;
    }
    if (!cmd) return false;
    if (CoreState.tagSkills.some(s => s.cmd === cmd)) {
      showToast?.('Навык /' + cmd + ' уже добавлен', 'info');
      hideSkillPopup?.();
      stripTrailingTrigger('slash');
      return false;
    }
    if (CoreState.tagSkills.length >= MAX_SKILLS) {
      openReplaceModal('skill', { cmd, name: name || cmd });
      hideSkillPopup?.();
      return false;
    }
    CoreState.tagSkills.push({ cmd, name: name || cmd });
    stripTrailingTrigger('slash');
    hideSkillPopup?.();
    renderTagChips();
    if (typeof setActiveSkill === 'function') {
      try {
        const all = (typeof allSkills === 'function') ? allSkills() : [];
        const sk = all.find(s => s.cmd === cmd);
        if (sk) setActiveSkill(sk);
      } catch (e) {}
    }
    showToast?.('Навык /' + cmd, 'info', 1600);
    return true;
  };

  // Override insertConnector / insertSkill when defined later — patch after load
  function patchInsertors() {
    window.insertConnector = function(label) {
      const id = String(label || '').replace(/^@/, '');
      addConnectorChip(id, id);
    };
    window.insertSkill = function(cmd) {
      addSkillChip(cmd, cmd);
    };
  }
  patchInsertors();
  setTimeout(patchInsertors, 600);

  // Lock setInputMode during edit
  const _setMode = window.setInputMode;
  if (typeof _setMode === 'function' && !_setMode._tagLock) {
    window.setInputMode = function(mode, opts) {
      if (document.body.classList.contains('edit-msg-mode')) {
        showToast?.('Во время редактирования нельзя переключить Chat / Task', 'warning');
        return;
      }
      return _setMode.apply(this, arguments);
    };
    window.setInputMode._tagLock = true;
  }

  // Prefix message on send
  const wrapSend = () => {
    const orig = window.sendMsg;
    if (typeof orig !== 'function' || orig._tagPrefixed) return;
    
/* deduped sendMsg wrap */

    window.sendMsg._tagPrefixed = true;
  };
  wrapSend();
  setTimeout(wrapSend, 800);

  // Wire connector buttons to chip API
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.connector-item[data-conn]');
    if (!btn) return;
    // allow default handlers too; our insertConnector is patched
  });
})();

/* Temp chat tip */
(function tempChatTip() {
  const KEY = 'oracle_temp_chat_tip_seen';
  
/* deduped: earlier window.dismissTempChatTip removed */

  window.maybeShowTempChatTip = function() {
    if (localStorage.getItem(KEY) === '1') return;
    if (CoreState && CoreState.isTempChat) return;
    const tip = document.getElementById('temp-chat-tip');
    if (!tip) return;
    tip.hidden = false;
    // point arrow toward temp button if exists
    const btn = document.getElementById('temp-chat-btn') || document.querySelector('[onclick*="enterTempChat"], [onclick*="toggleTempChat"]');
    const arrow = document.getElementById('temp-chat-tip-arrow');
    if (btn && arrow) {
      try {
        const br = btn.getBoundingClientRect();
        const tr = tip.getBoundingClientRect();
        if (br.top < tr.top) arrow.textContent = 'north_east';
        else arrow.textContent = 'south_east';
      } catch (e) {}
    }
  };
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => maybeShowTempChatTip(), 1800);
  });
})();

/* ===== Fullscreen layout + sidebar boot preference ===== */
(function fullscreenLayoutSidebar() {
  const BOOT_KEY = 'oracle_sidebar_boot_pref'; // open | closed | remember
  const LAST_KEY = 'oracle_sidebar_last_open'; // '1' | '0'
  const LAYOUT_KEY = 'oracle_layout_fullscreen'; // default on

  function isDesktop() {
    return window.matchMedia('(min-width: 900px)').matches;
  }

  function isFullscreenLayout() {
    const v = localStorage.getItem(LAYOUT_KEY);
    return v === null || v === '1' || v === 'true';
  }

  window.applyLayoutFullscreen = function() {
    document.body.classList.toggle('layout-fullscreen', isFullscreenLayout());
  };

  window.getSidebarBootPref = function() {
    return localStorage.getItem(BOOT_KEY) || 'remember';
  };

  window.setSidebarBootPref = function(pref) {
    if (!['open', 'closed', 'remember'].includes(pref)) pref = 'remember';
    localStorage.setItem(BOOT_KEY, pref);
    document.querySelectorAll('input[name="sidebar-boot"]').forEach(r => {
      r.checked = r.value === pref;
    });
    showToast?.('Сохранено: боковое меню при входе', 'success', 1800);
  };

  window.syncSidebarOpenClass = function() {
    const sb = document.getElementById('sidebar-archive');
    const open = !!(sb && sb.classList.contains('open')) || document.body.classList.contains('sidebar-docked');
    document.body.classList.toggle('sidebar-open', open);
    if (!isDesktop()) document.body.classList.add('sidebar-overlay-mobile');
    else document.body.classList.remove('sidebar-overlay-mobile');
    // remember
    if (getSidebarBootPref() === 'remember') {
      try { localStorage.setItem(LAST_KEY, open ? '1' : '0'); } catch (e) {}
    }
  };

  window.applySidebarBootPref = function() {
    applyLayoutFullscreen();
    const pref = getSidebarBootPref();
    const sb = document.getElementById('sidebar-archive');
    if (!sb) return;
    // phones: never auto-open full overlay on boot (annoying)
    if (!isDesktop()) {
      sb.classList.remove('open');
      document.body.classList.remove('sidebar-docked');
      syncSidebarOpenClass();
      return;
    }
    let shouldOpen = false;
    if (pref === 'open') shouldOpen = true;
    else if (pref === 'closed') shouldOpen = false;
    else shouldOpen = localStorage.getItem(LAST_KEY) === '1' || localStorage.getItem('oracle_sidebar_docked') === 'true';

    if (shouldOpen) {
      sb.classList.add('open');
      // soft-dock on desktop so content stays pushed without requiring pin button
      if (localStorage.getItem('oracle_sidebar_docked') === 'true') {
        document.body.classList.add('sidebar-docked');
      }
    } else {
      sb.classList.remove('open');
      if (localStorage.getItem('oracle_sidebar_docked') !== 'true') {
        document.body.classList.remove('sidebar-docked');
      }
    }
    syncSidebarOpenClass();
    if (typeof syncSidebarDockUI === 'function') syncSidebarDockUI();
    // radios
    document.querySelectorAll('input[name="sidebar-boot"]').forEach(r => {
      r.checked = r.value === pref;
    });
  };

  // Patch toggleSidebar
  const _ts = typeof toggleSidebar === 'function' ? toggleSidebar : null;
  window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar-archive');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open') && typeof renderUnifiedArchive === 'function') {
      try { renderUnifiedArchive(); } catch (e) {}
    }
    // desktop open without dock still pushes via sidebar-open class
    syncSidebarOpenClass();
  };
  // if original existed as non-window, keep name
  try { if (_ts) { /* replaced */ } } catch (e) {}

  const _dock = typeof toggleSidebarDock === 'function' ? toggleSidebarDock : null;
  window.toggleSidebarDock = function() {
    if (typeof _dock === 'function') _dock();
    else {
      const docked = document.body.classList.toggle('sidebar-docked');
      localStorage.setItem('oracle_sidebar_docked', docked ? 'true' : 'false');
      if (docked) document.getElementById('sidebar-archive')?.classList.add('open');
      if (typeof syncSidebarDockUI === 'function') syncSidebarDockUI();
    }
    syncSidebarOpenClass();
  };

  const _undock = typeof toggleSidebarOrUndock === 'function' ? toggleSidebarOrUndock : null;
  window.toggleSidebarOrUndock = function() {
    if (typeof _undock === 'function') _undock();
    else {
      document.body.classList.remove('sidebar-docked');
      localStorage.setItem('oracle_sidebar_docked', 'false');
      document.getElementById('sidebar-archive')?.classList.remove('open');
    }
    syncSidebarOpenClass();
  };

  function boot() {
    applyLayoutFullscreen();
    applySidebarBootPref();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('resize', () => {
    syncSidebarOpenClass();
  });
})();

/* ===== Fullscreen + sidebar entry preference ===== */
(function sidebarEntryPref() {
  const PREF_KEY = 'oracle_sidebar_entry_pref';
  const STATE_KEY = 'oracle_sidebar_last_open';

  function isDesktop() {
    return window.matchMedia('(min-width: 769px)').matches;
  }
  function getPref() {
    return localStorage.getItem(PREF_KEY) || 'closed';
  }

  window.toggleSidebarEntryMenu = function(e) {
    e && e.stopPropagation && e.stopPropagation();
    const menu = document.getElementById('sidebar-entry-menu');
    if (!menu) return;
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
  };

  window.setSidebarEntryPref = function(val) {
    if (typeof setSidebarBootPref === 'function') return setSidebarBootPref(val);
  };
  window.toggleSidebarOrUndock = function() { closeSidebar(); };
  window.undockSidebar = function() { closeSidebar(); };
  window.syncSidebarDockUI = function() {};

  function applyEntryPrefOnLoad() {
    const lab = document.getElementById('sidebar-entry-label');
    const pref = getPref();
    const labels = {
      closed: 'Сворачивать по умолчанию',
      open: 'Разворачивать по умолчанию',
      remember: 'Сохранять после каждого выхода'
    };
    if (lab) lab.textContent = labels[pref] || labels.closed;
    document.body.classList.remove('sidebar-docked');
    try { localStorage.setItem('oracle_sidebar_docked', 'false'); } catch(e) {}
    if (!isDesktop()) {
      document.body.classList.remove('sidebar-open');
      return;
    }
    let shouldOpen = false;
    if (pref === 'open') shouldOpen = true;
    else if (pref === 'remember') shouldOpen = localStorage.getItem(STATE_KEY) === '1';
    if (shouldOpen) openSidebar();
    else closeSidebar();
  }

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('sidebar-entry-menu');
    const picker = document.getElementById('sidebar-entry-picker');
    if (!menu || !picker) return;
    if (!picker.contains(e.target)) menu.style.display = 'none';
  });

  function boot() { applyEntryPrefOnLoad(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 250);

  window.addEventListener('resize', () => {
    if (!isDesktop()) {
      document.body.classList.remove('sidebar-open');
    } else {
      const sidebar = document.getElementById('sidebar-archive');
      if (sidebar && sidebar.classList.contains('open')) document.body.classList.add('sidebar-open');
    }
  });
})();

/* ===== content_base local library + models + ghost bar + centered input ===== */
(function coreNodeImmediateUpgrades() {
  let CONTENT_BASE = null;
  async function loadContentBase() {
    if (CONTENT_BASE) return CONTENT_BASE;
    try {
      const r = await fetch('content_base.json', { cache: 'no-store' });
      if (r.ok) CONTENT_BASE = await r.json();
    } catch (e) {}
    if (!CONTENT_BASE) {
      CONTENT_BASE = {
        default: 'Локальный режим Core Node. Подключите API для расширенных ответов.',
        entries: [
          { keys: ['привет', 'hello'], reply: 'Привет! Локальный режим Core Node.' }
        ]
      };
    }
    return CONTENT_BASE;
  }
  window.loadContentBase = loadContentBase;

  window.lookupLocalReply = function(msg) {
    const base = CONTENT_BASE || { entries: [], default: '…' };
    const t = String(msg || '').toLowerCase();
    for (const e of (base.entries || [])) {
      const keys = e.keys || [];
      if (keys.some(k => t.includes(String(k).toLowerCase()))) return e.text || e.reply || '';
    }
    const def = base.default;
    if (def && typeof def === 'object') return def.text || 'Локальный ответ не найден.';
    return def || 'Локальный ответ не найден.';
  };

  // Intify 2.5.4 → content_base. External API only when that model is selected.
  const tryLocalPatch = () => {
    const orig = window.resolveAiResponse;
    if (typeof orig !== 'function' || orig._localLib) return;
    window.resolveAiResponse = async function(msg) {
      await loadContentBase();
      const useExternal = CoreState.activeAgent === 'external-api';
      if (useExternal) {
        try {
          const res = await orig.apply(this, arguments);
          if (res && res.ok && res.text) return res;
          return res || { ok: false, error: 'API не ответил' };
        } catch (e) {
          return { ok: false, error: String(e && e.message || e) };
        }
      }
      return { ok: true, text: lookupLocalReply(msg), local: true, model: 'Intify 2.5.4' };
    };
    window.resolveAiResponse._localLib = true;
  };
  tryLocalPatch();
  setTimeout(tryLocalPatch, 600);
  loadContentBase();

  // Centered empty chat input
  window.syncChatEmptyCenter = function() {
    const flow = document.getElementById('chat-flow');
    const welcome = document.getElementById('welcome-block');
    const hasMsg = flow && flow.querySelector('.msg, .user-msg, .ai-msg, .bubble');
    const welcomeVisible = welcome && !welcome.classList.contains('hidden');
    const empty = !hasMsg && (welcomeVisible || !flow || !flow.children.length);
    document.body.classList.toggle('chat-empty-center', !!empty && !document.body.classList.contains('split-mode'));
    // ghost bar
    const bar = document.getElementById('ghost-action-bar');
    const chatOn = document.getElementById('screen-chat')?.classList.contains('active-screen');
    if (bar) {
      const show = chatOn && empty && !CoreState.isTempChat;
      bar.hidden = !show;
    }
  };

  const _hi = window.handleInput;
  window.handleInput = function(el) {
    if (typeof _hi === 'function') _hi.apply(this, arguments);
    // temp: send inactive when empty
    const send = document.getElementById('send-btn');
    const live = document.getElementById('live-chat-btn');
    const val = (el && el.value || '').trim();
    if (CoreState.isTempChat) {
      if (live) { live.classList.add('hidden'); live.style.pointerEvents = 'none'; }
      if (send) {
        send.classList.add('visible');
        send.disabled = !val;
        send.style.opacity = val ? '' : '0.4';
        send.style.pointerEvents = val ? '' : 'none';
      }
    } else if (send) {
      send.disabled = false;
      send.style.opacity = '';
      send.style.pointerEvents = '';
    }
    syncChatEmptyCenter();
  };

  // After send — drop center
  const wrapSend2 = () => {
    const o = window.sendMsg;
    if (typeof o !== 'function' || o._centerPatch) return;
    window.sendMsg = function() {
      const r = o.apply(this, arguments);
      setTimeout(() => {
        document.body.classList.remove('chat-empty-center');
        const bar = document.getElementById('ghost-action-bar');
        if (bar) bar.hidden = true;
        syncChatEmptyCenter();
      }, 50);
      return r;
    };
    window.sendMsg._centerPatch = true;
  };
  wrapSend2();
  setTimeout(wrapSend2, 500);

  // startLiveChat block in temp
  const _live = window.startLiveChat;
  if (typeof _live === 'function' && !_live._tempBlock) {
    window.startLiveChat = function() {
      if (CoreState.isTempChat) {
        showToast?.('Live Chat недоступен во временном чате', 'warning');
        return;
      }
      return _live.apply(this, arguments);
    };
    window.startLiveChat._tempBlock = true;
  }

  window.openDownloadAppModal = function() {
    document.getElementById('download-app-modal')?.classList.add('active');
  };
  window.closeDownloadAppModal = function() {
    document.getElementById('download-app-modal')?.classList.remove('active');
  };
  window.openUltraPlanStub = function() {
    document.getElementById('ultra-plan-modal')?.classList.add('active');
  };
  window.tryInstallPWA = function() {
    if (window.deferredPWAInstall) {
      window.deferredPWAInstall.prompt();
      return;
    }
    showToast?.('В браузере: меню → «Установить приложение» / «На экран Домой»', 'info', 4000);
  };
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPWAInstall = e;
  });

  // Long gen play stub (>40s)
  window._genPlayTimer = null;
  window.armLongGenPlayOffer = function() {
    clearTimeout(window._genPlayTimer);
    window._genPlayTimer = setTimeout(() => {
      if (!CoreState.isStreaming) return;
      const host = document.getElementById('main-input-box');
      if (!host || document.getElementById('play-while-gen-btn')) return;
      const b = document.createElement('button');
      b.id = 'play-while-gen-btn';
      b.type = 'button';
      b.className = 'play-while-gen-btn';
      b.innerHTML = '<span class="material-symbols-rounded">sports_esports</span> Поиграть, пока генерируется?';
      b.onclick = () => {
        try {
          localStorage.setItem('oracle_gen_pending_notify', '1');
          window.open('play.html', '_blank');
        } catch (e) {}
      };
      host.parentElement?.insertBefore(b, host);
    }, 40000);
  };
  window.clearLongGenPlayOffer = function() {
    clearTimeout(window._genPlayTimer);
    document.getElementById('play-while-gen-btn')?.remove();
    if (localStorage.getItem('oracle_gen_pending_notify') === '1') {
      localStorage.setItem('oracle_gen_done_ping', String(Date.now()));
      localStorage.removeItem('oracle_gen_pending_notify');
      try {
        const bc = new BroadcastChannel('core-node-gen');
        bc.postMessage({ type: 'gen-done' });
        bc.close();
      } catch (e) {}
    }
  };

  // Hook setGenerating if exists
  const _sg = window.setGenerating;
  if (typeof _sg === 'function' && !_sg._playHook) {
    window.setGenerating = function(on) {
      const r = _sg.apply(this, arguments);
      if (on) armLongGenPlayOffer();
      else clearLongGenPlayOffer();
      return r;
    };
    window.setGenerating._playHook = true;
  }

  function bootUI() {
    syncExternalApiOptionUI?.();
    const saved = localStorage.getItem('oracle_active_agent');
    if (saved) CoreState.activeAgent = saved === 'Oracle Main' || saved === 'Worldpack AI' || saved === 'Модель: Fast' ? 'Intify 2.5.4' : saved;
    syncChatEmptyCenter();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootUI);
  else bootUI();
  setTimeout(bootUI, 400);
  // observe chat flow
  const obs = new MutationObserver(() => syncChatEmptyCenter());
  document.addEventListener('DOMContentLoaded', () => {
    const f = document.getElementById('chat-flow');
    if (f) obs.observe(f, { childList: true, subtree: true });
  });
})();

/* ===== Ensure sidebar open/close work (X button) ===== */
(function ensureSidebarClose() {
  window.closeSidebar = function() {
    const sidebar = document.getElementById('sidebar-archive');
    if (sidebar) sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
    document.body.classList.remove('sidebar-docked');
    try {
      if (localStorage.getItem('oracle_sidebar_boot_pref') === 'remember' ||
          localStorage.getItem('oracle_sidebar_entry_pref') === 'remember') {
        localStorage.setItem('oracle_sidebar_last_open', '0');
      }
      localStorage.setItem('oracle_sidebar_docked', 'false');
    } catch (e) {}
    if (typeof syncSidebarOpenClass === 'function') {
      try { syncSidebarOpenClass(); } catch (e) {}
    }
  };
  window.openSidebar = function() {
    const sidebar = document.getElementById('sidebar-archive');
    if (!sidebar) return;
    sidebar.classList.add('open');
    if (window.matchMedia('(min-width: 769px)').matches) {
      document.body.classList.add('sidebar-open');
    }
    try {
      if (localStorage.getItem('oracle_sidebar_boot_pref') === 'remember' ||
          localStorage.getItem('oracle_sidebar_entry_pref') === 'remember') {
        localStorage.setItem('oracle_sidebar_last_open', '1');
      }
    } catch (e) {}
    try { renderUnifiedArchive && renderUnifiedArchive(); } catch (e) {}
    if (typeof syncSidebarOpenClass === 'function') {
      try { syncSidebarOpenClass(); } catch (e) {}
    }
  };
  // Wire close buttons in case onclick was stripped
  document.addEventListener('click', function(e) {
    const btn = e.target.closest && e.target.closest('.sidebar-close-btn, [data-action="close-sidebar"]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    closeSidebar();
  }, true);
})();

/* ===== Core Node: limits gauges, hash routes, studio, reduced motion ===== */
(function coreNodeLimitsHashStudio() {
  const LIMITS_KEY = 'oracle_cn_limits_v1';
  const WINDOW_5H = 5 * 60 * 60 * 1000;
  const WINDOW_7D = 7 * 24 * 60 * 60 * 1000;
  const STUDIO_KEY = 'oracle_studio_pers_active';
  const FX_KEY = 'oracle_animations_fx';

  function loadLimits() {
    try { return JSON.parse(localStorage.getItem(LIMITS_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveLimits(s) { localStorage.setItem(LIMITS_KEY, JSON.stringify(s)); }
  function prune(events, win, now) { return (events || []).filter(e => now - e.t < win); }
  function sum(events) { return (events || []).reduce((a, e) => a + (Number(e.p) || 0), 0); }
  function estimate(text) {
    const len = String(text || '').trim().length;
    if (len <= 50) return 0.5;
    if (len <= 150) return 1;
    if (len <= 500) return 2;
    if (len <= 1500) return 5;
    if (len <= 4000) return 12;
    return 20;
  }
  function fmtRemain(ms) {
    if (ms <= 0) return 'сейчас';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h >= 24) return Math.floor(h / 24) + 'д ' + (h % 24) + 'ч';
    if (h > 0) return h + 'ч ' + String(m).padStart(2, '0') + 'м';
    return m + ' мин';
  }
  function clockReset(ms) {
    const t = new Date(Date.now() + Math.max(0, ms));
    return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  }

  function getState() {
    const now = Date.now();
    let s = loadLimits();
    s.events5h = prune(s.events5h, WINDOW_5H, now);
    if (s.weekStart && now - s.weekStart >= WINDOW_7D) {
      s.events7d = [];
      s.weekStart = null;
    }
    s.events7d = prune(s.events7d, WINDOW_7D, now);
    const p5 = Math.min(100, sum(s.events5h));
    const p7 = Math.min(100, sum(s.events7d));
    saveLimits(s);
    return { s, p5, p7, now };
  }

  window.refreshCoreLimitsUI = function() {
    const { s, p5, p7, now } = getState();
    const fill5 = document.getElementById('limit-5h-fill');
    const fill7 = document.getElementById('limit-7d-fill');
    const lab5 = document.getElementById('limit-5h-pct-label');
    const lab7 = document.getElementById('limit-7d-pct-label');
    const meta5 = document.getElementById('limit-5h-meta');
    const meta7 = document.getElementById('limit-7d-meta');
    if (fill5) { fill5.style.width = p5 + '%'; fill5.classList.toggle('danger', p5 >= 90); }
    if (fill7) { fill7.style.width = p7 + '%'; fill7.classList.toggle('danger', p7 >= 90); }
    if (lab5) lab5.textContent = (Math.round(p5 * 10) / 10) + '%';
    if (lab7) lab7.textContent = (Math.round(p7 * 10) / 10) + '%';
    let resetMs5 = 0;
    if (s.events5h && s.events5h.length) {
      const oldest = s.events5h.slice().sort((a, b) => a.t - b.t)[0];
      resetMs5 = WINDOW_5H - (now - oldest.t);
    }
    if (meta5) meta5.textContent = s.events5h && s.events5h.length
      ? ('Сброс части: через ' + fmtRemain(resetMs5) + ' (~' + clockReset(resetMs5) + ')')
      : 'Окно 5 часов свободно';
    if (meta7) {
      if (s.weekStart) meta7.textContent = 'Неделя до: через ' + fmtRemain(WINDOW_7D - (now - s.weekStart));
      else meta7.textContent = 'Недельный период ещё не начат';
    }

    const blocked = p5 >= 100 || p7 >= 100;
    document.body.classList.toggle('limit-blocked', blocked);
    const ban = document.getElementById('limit-lock-banner');
    const txt = document.getElementById('limit-lock-text');
    if (ban && txt) {
      if (blocked) {
        let resetLabel = '—:—';
        if (p7 >= 100 && s.weekStart) resetLabel = clockReset(WINDOW_7D - (now - s.weekStart));
        else if (p5 >= 100) resetLabel = clockReset(resetMs5);
        txt.textContent = 'Лимит достиг 100%, сброс в ' + resetLabel;
        ban.classList.add('show');
      } else ban.classList.remove('show');
    }
    return { blocked, p5, p7, resetMs5 };
  };

  window.npCanSend = function() {
    const { p5, p7 } = getState();
    return p5 < 100 && p7 < 100;
  };
  window.consumeCoreLimit = function(text, extra) {
    const cost = typeof extra === 'number' ? extra : estimate(text);
    const now = Date.now();
    let s = loadLimits();
    s.events5h = prune(s.events5h, WINDOW_5H, now);
    s.events7d = s.events7d || [];
    if (!s.weekStart && cost >= 1) s.weekStart = now;
    if (s.weekStart && now - s.weekStart >= WINDOW_7D) {
      s.events7d = [];
      s.weekStart = cost >= 1 ? now : null;
    }
    s.events5h.push({ t: now, p: cost });
    s.events7d.push({ t: now, p: cost });
    saveLimits(s);
    return refreshCoreLimitsUI();
  };

  window.openLimitsFromBanner = function() {
    try {
      if (typeof switchTab === 'function') switchTab('settings');
      else if (typeof showScreen === 'function') showScreen('settings');
    } catch (e) {}
    setTimeout(() => {
      try { if (typeof showSection === 'function') showSection('limits'); } catch (e) {}
      try { history.replaceState(null, '', '#settings_limits'); } catch (e) {}
      refreshCoreLimitsUI();
    }, 60);
  };

  // Guard send / live
  function guard() {
    if (!window.npCanSend()) {
      refreshCoreLimitsUI();
      if (typeof showToast === 'function') showToast('Лимит исчерпан', 'warning');
      return false;
    }
    return true;
  }
  document.addEventListener('click', (e) => {
    const send = e.target.closest && e.target.closest('#send-btn, .send-btn');
    const live = e.target.closest && e.target.closest('#live-chat-btn, .live-chat-btn');
    if ((send || live) && !guard()) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }, true);

  // consume on user bubble add
  const flowObs = () => {
    const flow = document.getElementById('chat-flow') || document.querySelector('.chat-flow-box');
    if (!flow || flow._limObs) return;
    flow._limObs = true;
    new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach(n => {
          if (n.nodeType !== 1) return;
          if (n.classList && (n.classList.contains('user-msg') || n.classList.contains('user-bubble') || n.classList.contains('msg-user'))) {
            const t = (n.textContent || '').trim();
            if (t && window.__cnLastLim !== t.slice(0, 60)) {
              window.__cnLastLim = t.slice(0, 60);
              consumeCoreLimit(t);
            }
          }
        });
      }
    }).observe(flow, { childList: true, subtree: true });
  };

  // Hash routes
  function applyHash() {
    const h = (location.hash || '').replace(/^#/, '');
    if (!h) return;
    if (h === 'settings' || h.startsWith('settings_')) {
      try {
        if (typeof switchTab === 'function') switchTab('settings');
        else document.querySelector('.nav-item[data-target="settings"], [onclick*="settings"]')?.click();
      } catch (e) {}
      const sec = h.indexOf('_') >= 0 ? h.split('_').slice(1).join('_') : '';
      if (sec) setTimeout(() => { try { showSection(sec); } catch (e) {} }, 80);
      if (sec === 'limits') setTimeout(refreshCoreLimitsUI, 100);
      return;
    }
    if (h === 'chat' || h === 'reader' || h === 'calendar' || h === 'maps') {
      try { if (typeof switchTab === 'function') switchTab(h); } catch (e) {}
      return;
    }
    // chat id
    if (h.startsWith('chat/') || h.startsWith('c/')) {
      const id = h.split('/')[1];
      if (id) {
        try { if (typeof switchTab === 'function') switchTab('chat'); } catch (e) {}
        setTimeout(() => {
          try {
            if (typeof loadChatSession === 'function') loadChatSession(id);
            else if (typeof openChatById === 'function') openChatById(id);
            else if (typeof selectChat === 'function') selectChat(id);
            else {
              // try click session node
              const el = document.querySelector('[data-session-id="' + id + '"], [data-chat-id="' + id + '"]');
              if (el) el.click();
            }
          } catch (e) {}
        }, 100);
      }
    }
  }
  window.setChatHash = function(id) {
    if (!id) {
      try { history.replaceState(null, '', '#chat'); } catch (e) {}
      return;
    }
    try { history.replaceState(null, '', '#chat/' + encodeURIComponent(id)); } catch (e) {}
  };
  // patch common openers
  const patchHashHooks = () => {
    /* showSection hash built into function */
    if (typeof window.switchTab === 'function' && !window.switchTab._hash) {
      const o = window.switchTab;
      window.switchTab = function(tab) {
        const r = o.apply(this, arguments);
        try {
          if (tab === 'settings') {
            if (!location.hash.startsWith('#settings')) history.replaceState(null, '', '#settings');
          } else if (tab === 'chat') {
            const id = (window.CoreState && (CoreState.currentChatId || CoreState.activeSessionId)) || '';
            if (id) history.replaceState(null, '', '#chat/' + encodeURIComponent(id));
            else history.replaceState(null, '', '#chat');
          } else if (tab) history.replaceState(null, '', '#' + tab);
        } catch (e) {}
        return r;
      };
      window.switchTab._hash = true;
    }
  };

  // Studio personalization
  window.markStudioPersonalization = function(on) {
    localStorage.setItem(STUDIO_KEY, on ? '1' : '0');
    document.getElementById('studio-pers-badge')?.classList.toggle('show', !!on);
  };
  window.isStudioPersActive = function() {
    return localStorage.getItem(STUDIO_KEY) === '1';
  };
  // Clear studio flag when user changes accent/theme
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.matte-dot, .theme-opt, [onclick*="changeOracleTheme"], [onclick*="applyVisualTheme"], [onclick*="setTheme"]')) {
      markStudioPersonalization(false);
    }
  });
  // Detect return from studio with ?studio=1 or localStorage set by studio
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('studio') === '1' || localStorage.getItem('oracle_studio_apply') === '1') {
      markStudioPersonalization(true);
      localStorage.removeItem('oracle_studio_apply');
    }
  } catch (e) {}

  // Animations toggle
  window.toggleAnimationsFx = function(on) {
    localStorage.setItem(FX_KEY, on ? '1' : '0');
    if (typeof showToast === 'function') showToast('Сохранено. Перезагрузите страницу', 'info');
    if (typeof showCustomModal === 'function') {
      showCustomModal('Подтвердите действие', 'Чтобы применить анимации/эффекты, перезагрузить страницу сейчас?', false, '', function(ok){ if (ok) location.reload(); });
    }
  };
  function applyFxPref() {
    const on = localStorage.getItem(FX_KEY);
    const enabled = on === null || on === '1';
    document.body.classList.toggle('reduced-motion', !enabled);
    const t = document.getElementById('toggle-animations-fx');
    if (t) t.checked = enabled;
  }

  function boot() {
    applyFxPref();
    document.getElementById('studio-pers-badge')?.classList.toggle('show', isStudioPersActive());
    flowObs();
    patchHashHooks();
    refreshCoreLimitsUI();
    applyHash();
    setInterval(refreshCoreLimitsUI, 30000);
  }
  window.addEventListener('hashchange', applyHash);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(patchHashHooks, 600);
  setTimeout(flowObs, 800);
})();

/* ===== Welcome promo + Scenario writer + Maps harden ===== */
(function welcomePromoAndScenarios() {
  const PROMO_KEY = 'oracle_welcome_promo_slot';
  const SC_KEY = 'oracle_scenarios_v1';

  // Public-domain / placeholder style prompts (no external hotlink required — CSS gradients as fallback)
  const PROMO_ITEMS = [
    { prompt: 'Сгенерируй кинематографичный портрет космонавта в неоновом городе, 8k, детальный', label: 'Neon astro', bg: 'linear-gradient(135deg,#0f172a,#6366f1)' },
    { prompt: 'Нарисуй уютную японскую улицу под дождём вечером, аниме-стиль, мягкий свет', label: 'Rain street', bg: 'linear-gradient(135deg,#1e3a5f,#94a3b8)' },
    { prompt: 'Фэнтези-замок на скале над облаками, golden hour, эпичный пейзаж', label: 'Castle', bg: 'linear-gradient(135deg,#7c2d12,#fbbf24)' },
    { prompt: 'Минималистичный продукт на белом фоне, студийный свет, рекламное фото', label: 'Product', bg: 'linear-gradient(135deg,#e2e8f0,#64748b)' },
    { prompt: 'Кот в космическом скафандре на Луне, юмор, высокий реализм', label: 'Space cat', bg: 'linear-gradient(135deg,#312e81,#c4b5fd)' },
    { prompt: 'Абстрактная 3D-композиция из стекла и металла, studio render', label: 'Abstract 3D', bg: 'linear-gradient(135deg,#0ea5e9,#a855f7)' }
  ];

  function pickPromoSet() {
    // rotate set every few seconds of page life / session slot
    let slot = parseInt(sessionStorage.getItem(PROMO_KEY) || '0', 10) || 0;
    // random chance each load: show promo vs classic greeting
    const showPromo = (Math.random() < 0.42) || (slot % 3 === 1);
    sessionStorage.setItem(PROMO_KEY, String(slot + 1));
    return showPromo;
  }

  function renderPromo() {
    const host = document.getElementById('welcome-promo-imgs');
    const promo = document.getElementById('welcome-promo');
    const greeting = document.getElementById('welcome-greeting');
    const sub = document.getElementById('welcome-subtext');
    if (!promo || !host) return;
    if (document.body.classList.contains('temp-chat-mode')) {
      promo.hidden = true;
      return;
    }
    if (!pickPromoSet()) {
      promo.hidden = true;
      return;
    }
    // shuffle 3
    const items = PROMO_ITEMS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    host.innerHTML = items.map((it, i) =>
      '<button type="button" class="welcome-promo-img" data-i="' + i + '" style="background:' + it.bg + '" title="' + it.label + '">' +
      '<span>' + it.label + '</span></button>'
    ).join('');
    host.querySelectorAll('.welcome-promo-img').forEach((btn, idx) => {
      btn.onclick = () => {
        const p = items[idx].prompt;
        const input = document.getElementById('user-input');
        if (input) {
          input.value = p;
          input.dispatchEvent(new Event('input'));
          input.focus();
        }
        if (typeof showToast === 'function') showToast('Запрос вставлен — подключите API для генерации', 'info');
      };
    });
    promo.hidden = false;
    if (greeting) greeting.textContent = 'Идеи для генерации';
    if (sub) sub.textContent = 'Нажмите на картинку — запрос попадёт в поле ввода';
    // auto flip back after ~8s if still empty chat
    setTimeout(() => {
      const flow = document.getElementById('chat-flow');
      const hasMsg = flow && flow.querySelector('.msg, .user-msg, .ai-msg, .bubble');
      if (hasMsg || document.body.classList.contains('temp-chat-mode')) return;
      if (promo) promo.hidden = true;
      if (greeting && !document.body.classList.contains('temp-chat-mode')) {
        try {
          const profile = JSON.parse(localStorage.getItem('oracle_user_profile') || '{}');
          greeting.textContent = profile.name ? ('Привет, ' + profile.name + '!') : 'Привет! Как твои дела?';
        } catch (e) {
          greeting.textContent = 'Привет! Как твои дела?';
        }
      }
      if (sub && !document.body.classList.contains('temp-chat-mode')) {
        sub.textContent = 'Готов к работе. Чем я могу помочь тебе сегодня?';
      }
    }, 9000);
  }

  // Scenarios
  function loadScenarios() {
    try { return JSON.parse(localStorage.getItem(SC_KEY) || '[]') || []; } catch (e) { return []; }
  }
  function saveScenarios(list) {
    try { localStorage.setItem(SC_KEY, JSON.stringify(list)); } catch (e) {}
  }

  window.renderScenariosList = function() {
    const host = document.getElementById('scenarios-list');
    if (!host) return;
    const list = loadScenarios();
    if (!list.length) {
      host.innerHTML = '<div class="unified-empty">Пока нет сценариев.<br>Создайте первый или из чата: + → Добавить сценарий</div>';
      return;
    }
    host.innerHTML = list.map(s =>
      '<div class="scenario-card" data-id="' + s.id + '">' +
      '<b>' + (s.name || 'Без названия').replace(/</g,'&lt;') + '</b>' +
      '<small>' + (s.query || '').slice(0, 80).replace(/</g,'&lt;') + '</small></div>'
    ).join('');
    host.querySelectorAll('.scenario-card').forEach(card => {
      card.onclick = () => applyScenario(card.dataset.id);
      card.oncontextmenu = (e) => {
        e.preventDefault();
        openScenarioEditor(card.dataset.id);
      };
    });
  };

  let _scEditId = null;
  window.openScenarioEditor = function(id) {
    _scEditId = id || null;
    const list = loadScenarios();
    const s = id ? list.find(x => x.id === id) : null;
    document.getElementById('scenario-editor-title').textContent = s ? 'Изменить сценарий' : 'Новый сценарий';
    document.getElementById('scenario-name').value = s?.name || '';
    document.getElementById('scenario-answer').value = s?.answer || '';
    document.getElementById('scenario-query').value = s?.query || '';
    document.getElementById('scenario-editor-modal')?.classList.add('active');
  };
  window.closeScenarioEditor = function() {
    document.getElementById('scenario-editor-modal')?.classList.remove('active');
    _scEditId = null;
  };
  window.saveScenarioFromEditor = function() {
    const name = (document.getElementById('scenario-name')?.value || '').trim() || 'Сценарий';
    const answer = document.getElementById('scenario-answer')?.value || '';
    const query = document.getElementById('scenario-query')?.value || '';
    let list = loadScenarios();
    if (_scEditId) {
      list = list.map(x => x.id === _scEditId ? { ...x, name, answer, query, updated: Date.now() } : x);
    } else {
      list.unshift({ id: 'sc_' + Date.now(), name, answer, query, created: Date.now() });
    }
    saveScenarios(list);
    closeScenarioEditor();
    renderScenariosList();
    showToast?.('Сценарий сохранён', 'success');
  };
  window.applyScenario = function(id) {
    const s = loadScenarios().find(x => x.id === id);
    if (!s) return;
    window.__activeScenario = s;
    document.body.classList.add('scenario-active-mode');
    const input = document.getElementById('user-input');
    if (input) {
      input.value = s.query || '';
      input.dispatchEvent(new Event('input'));
    }
    // ensure clear chip
    let chip = document.getElementById('scenario-active-chip');
    if (!chip) {
      const box = document.getElementById('main-input-box');
      if (box) {
        chip = document.createElement('div');
        chip.id = 'scenario-active-chip';
        chip.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:12px;font-weight:700;color:var(--primary);';
        chip.innerHTML = '<span class="material-symbols-rounded" style="font-size:16px">edit_note</span><span id="scenario-chip-label"></span><button type="button" class="tag-chip-x" id="scenario-chip-x" aria-label="Сбросить">×</button>';
        box.insertBefore(chip, box.firstChild);
        chip.querySelector('#scenario-chip-x').onclick = clearActiveScenario;
      }
    }
    const lab = document.getElementById('scenario-chip-label');
    if (lab) lab.textContent = 'Сценарий: ' + (s.name || '');
    if (typeof switchScreen === 'function') switchScreen('chat');
    showToast?.('Сценарий активен. Крестик у поля — сброс.', 'info');
  };
  window.clearActiveScenario = function() {
    window.__activeScenario = null;
    document.body.classList.remove('scenario-active-mode');
    document.getElementById('scenario-active-chip')?.remove();
  };
  window.openScenariosFromPlus = function() {
    try { document.getElementById('plus-menu')?.classList.remove('open'); } catch(e) {}
    if (typeof switchScreen === 'function') switchScreen('scenarios');
    renderScenariosList();
  };
  window.addScenarioFromChat = function() {
    try { document.getElementById('plus-menu')?.classList.remove('open'); } catch(e) {}
    openScenarioEditor(null);
    const input = document.getElementById('user-input');
    if (input && input.value.trim()) {
      document.getElementById('scenario-query').value = input.value.trim();
    }
  };

  // inject plus menu items
  function ensurePlusItems() {
    const menu = document.getElementById('plus-menu') || document.querySelector('.plus-menu');
    if (!menu || menu.querySelector('[data-act="scenario"]')) return;
    const div = document.createElement('div');
    div.className = 'plus-menu-divider';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'plus-menu-item';
    btn.dataset.act = 'scenario';
    btn.innerHTML = '<span class="material-symbols-rounded">edit_note</span><span>Добавить сценарий</span>';
    btn.onclick = addScenarioFromChat;
    const btn2 = document.createElement('button');
    btn2.type = 'button';
    btn2.className = 'plus-menu-item';
    btn2.innerHTML = '<span class="material-symbols-rounded">list_alt</span><span>Режим Сценариста</span>';
    btn2.onclick = openScenariosFromPlus;
    menu.appendChild(div);
    menu.appendChild(btn);
    menu.appendChild(btn2);
  }

  // Maps harden
  function hardenMaps() {
    const prev = window.initCoreMaps;
    if (typeof prev !== 'function') return;
    window.initCoreMaps = function() {
      const el = document.getElementById('maps-leaflet');
      if (el) {
        el.style.minHeight = '320px';
        el.style.height = el.clientHeight < 200 ? 'min(55vh, 480px)' : el.style.height;
      }
      // load leaflet if missing
      if (typeof L === 'undefined') {
        if (!window._leafletLoading) {
          window._leafletLoading = true;
          const lcss = document.createElement('link');
          lcss.rel = 'stylesheet';
          lcss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(lcss);
          const s = document.createElement('script');
          s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          s.onload = () => { window._leafletLoading = false; prev(); setTimeout(() => window._coreMap && window._coreMap.invalidateSize(), 200); };
          s.onerror = () => {
            window._leafletLoading = false;
            showToast?.('Не удалось загрузить Leaflet. Проверьте сеть.', 'error');
          };
          document.head.appendChild(s);
        }
        return;
      }
      prev();
      setTimeout(() => {
        try {
          if (window._coreMap) {
            window._coreMap.invalidateSize(true);
          }
        } catch (e) {}
      }, 150);
      setTimeout(() => { try { window._coreMap && window._coreMap.invalidateSize(true); } catch(e){} }, 500);
    };
    // also when switchScreen maps
    const ss = window.switchScreen;
    if (typeof ss === 'function' && !ss._mapsHard) {
      
/* deduped switchScreen wrap */

      window.switchScreen._mapsHard = true;
    }
  }

  function boot() {
    renderPromo();
    ensurePlusItems();
    hardenMaps();
    setTimeout(ensurePlusItems, 600);
    setTimeout(hardenMaps, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ===== SECTION ===== */

/* ===== Core Node Developer Mode + AITags restore ===== */

/* ===== SECTION ===== */

(function(){
  // --- Maps: search + open chat ---
  window.mapsSearchAndChat = async function() {
    const q = (document.getElementById('maps-search')?.value || '').trim();
    if (!q) { showToast?.('Введите место', 'warning'); return; }
    // run map search
    if (typeof mapsSearch === 'function') {
      try { await mapsSearch(); } catch(e) {}
    }
    // open new chat with location query
    if (typeof switchScreen === 'function') switchScreen('chat');
    document.body.classList.remove('chat-empty');
    const input = document.getElementById('user-input');
    const prompt = 'Найди похожие или точное местоположение: «' + q + '». Кратко опиши, где это, и что рядом.';
    if (input) {
      input.value = prompt;
      if (typeof handleInput === 'function') handleInput(input);
    }
    // auto-send if possible
    setTimeout(() => {
      if (typeof sendMsg === 'function') sendMsg();
      else showToast?.('Запрос готов в поле — нажмите Отправить', 'info');
    }, 180);
  };

  // Enter in maps search
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.activeElement?.id === 'maps-search') {
      e.preventDefault();
      mapsSearchAndChat();
    }
  });

  // --- Custom select: open upward if no space ---
  function placeSelectMenu(menu, btn) {
    if (!menu || !btn) return;
    menu.classList.remove('drop-up');
    const rect = btn.getBoundingClientRect();
    const menuH = Math.min(280, menu.scrollHeight || 180);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < menuH + 12 && spaceAbove > spaceBelow) {
      menu.classList.add('drop-up');
    }
  }
  const _origToggle = window.toggleCustomSelect;
  document.addEventListener('click', function(e) {
    const btn = e.target.closest?.('.custom-select-btn');
    if (!btn) return;
    const root = btn.closest('.custom-select');
    const menu = root?.querySelector('.custom-select-menu');
    if (menu) setTimeout(() => placeSelectMenu(menu, btn), 0);
  }, true);

  // exp font menu
  window.toggleExpSizeMenu = function(ev) {
    ev?.stopPropagation?.();
    const menu = document.getElementById('exp-font-menu');
    if (!menu) return;
    const open = menu.style.display === 'flex';
    document.querySelectorAll('.custom-select-menu').forEach(m => m.style.display = '');
    menu.style.display = open ? 'none' : 'flex';
    if (!open) placeSelectMenu(menu, ev.currentTarget);
  };
  window.selectExpFontSize = function(size) {
    const ed = document.getElementById('exp-user-editor');
    const label = document.getElementById('exp-font-size-label');
    if (label) label.textContent = size;
    if (ed) ed.style.fontSize = size + 'px';
    document.getElementById('exp-font-menu').style.display = 'none';
  };
  window.expFormat = function(cmd) {
    document.execCommand(cmd, false, null);
    document.getElementById('exp-user-editor')?.focus();
  };
  window.expClearFormat = function() {
    const ed = document.getElementById('exp-user-editor');
    if (!ed) return;
    const text = ed.innerText;
    ed.innerHTML = '';
    ed.innerText = text;
  };
  window.expSyncFromEditor = function() {};

  // --- CNUI renderer ---
  window.renderCnuiBlocks = function(raw) {
    if (!raw || typeof raw !== 'string') return null;
    // ```cnui:gml ... ``` or [CNUI:GML]...[/CNUI]
    const blocks = [];
    let text = raw;
    text = text.replace(/```cnui:(\w+)\s*([\s\S]*?)```/gi, (_, type, body) => {
      const i = blocks.length;
      blocks.push({ type: type.toLowerCase(), body: body.trim() });
      return '\n%%CNUI_' + i + '%%\n';
    });
    text = text.replace(/\[CNUI:(\w+)\]([\s\S]*?)\[\/CNUI\]/gi, (_, type, body) => {
      const i = blocks.length;
      blocks.push({ type: type.toLowerCase(), body: body.trim() });
      return '\n%%CNUI_' + i + '%%\n';
    });
    if (!blocks.length) return null;
    return { text, blocks };
  };

  window.cnuiToHtml = function(type, body) {
    const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    switch (type) {
      case 'gml': {
        const title = lines[0] || 'Сообщение';
        const rest = lines.slice(1).join(' ') || '';
        return '<div class="cnui-block cnui-gml"><div class="cnui-title">' + esc(title) + '</div><p class="cnui-body">' + esc(rest) + '</p></div>';
      }
      case 'xml': {
        const kind = (lines[0]||'info').toLowerCase();
        const msg = lines.slice(1).join(' ') || lines[0] || '';
        const cls = kind.includes('warn') ? 'warn' : kind.includes('err') ? 'err' : kind.includes('ok')||kind.includes('success') ? 'ok' : '';
        return '<div class="cnui-xml ' + cls + '">' + esc(msg) + '</div>';
      }
      case 'table': {
        const rows = lines.map(l => l.split('|').map(c => c.trim()).filter(Boolean));
        if (!rows.length) return '';
        let h = '<div class="cnui-table-wrap"><table class="cnui-table"><thead><tr>' +
          rows[0].map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>';
        rows.slice(1).forEach(r => { h += '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>'; });
        return h + '</tbody></table></div>';
      }
      case 'code': {
        const lang = lines[0] && !lines[0].includes(' ') ? lines[0] : 'text';
        const code = (lines[0] && !lines[0].includes(' ') ? lines.slice(1) : lines).join('\n');
        const id = 'cnui-code-' + Math.random().toString(36).slice(2,8);
        return '<div class="cnui-code"><div class="cnui-code-head"><span>' + esc(lang) + '</span>' +
          '<button type="button" class="cnui-code-copy" onclick="navigator.clipboard.writeText(document.getElementById(\'' + id + '\').innerText);showToast?.(\'Скопировано\',\'success\')">Копировать</button></div>' +
          '<pre id="' + id + '">' + esc(code) + '</pre></div>';
      }
      case 'sld': {
        const slides = body.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
        const sid = 'sld-' + Math.random().toString(36).slice(2,7);
        let h = '<div class="cnui-block cnui-sld" id="' + sid + '">';
        slides.forEach((s, i) => {
          h += '<div class="cnui-sld-slide' + (i===0?' active':'') + '">' + esc(s).replace(/\n/g,'<br>') + '</div>';
        });
        h += '<div class="cnui-sld-nav"><button type="button" class="icon-btn" onclick="cnuiSlide(\'' + sid + '\',-1)"><span class="material-symbols-rounded">chevron_left</span></button>' +
          '<span class="cnui-sld-pos">1 / ' + slides.length + '</span>' +
          '<button type="button" class="icon-btn" onclick="cnuiSlide(\'' + sid + '\',1)"><span class="material-symbols-rounded">chevron_right</span></button></div></div>';
        return h;
      }
      case 'check_task':
      case 'checktask': {
        let h = '<div class="cnui-block cnui-check-task">';
        lines.forEach((l, i) => {
          const item = l.replace(/^[-*]\s*/, '');
          h += '<label><input type="checkbox"> <span>' + esc(item) + '</span></label>';
        });
        return h + '</div>';
      }
      case 'shop': {
        let h = '<div class="cnui-shop">';
        body.split(/\n\n+/).forEach(chunk => {
          const ls = chunk.split('\n').map(x => x.trim()).filter(Boolean);
          if (!ls.length) return;
          h += '<div class="cnui-shop-card"><b>' + esc(ls[0]) + '</b>';
          if (ls[1]) h += '<div class="price">' + esc(ls[1]) + '</div>';
          if (ls[2]) h += '<div style="font-size:12px;color:var(--on-surface-variant);margin-top:4px">' + esc(ls[2]) + '</div>';
          h += '</div>';
        });
        return h + '</div>';
      }
      case 'frm':
      case 'form': {
        let h = '<form class="cnui-block cnui-frm" onsubmit="event.preventDefault();showToast?.(\'Отправлено (локально)\',\'success\')">';
        lines.forEach(l => {
          const [label, type] = l.split(':').map(x => x.trim());
          h += '<label style="font-size:12px">' + esc(label || 'Поле') + '</label>';
          if ((type||'').includes('area')) h += '<textarea rows="3"></textarea>';
          else h += '<input type="text" placeholder="' + esc(label||'') + '">';
        });
        h += '<button type="submit" class="modal-btn modal-btn-accept">Отправить</button></form>';
        return h;
      }
      case 'card':
      default: {
        return '<div class="cnui-block cnui-card">' + esc(body).replace(/\n/g,'<br>') + '</div>';
      }
    }
  };

  window.cnuiSlide = function(sid, dir) {
    const root = document.getElementById(sid);
    if (!root) return;
    const slides = [...root.querySelectorAll('.cnui-sld-slide')];
    let i = slides.findIndex(s => s.classList.contains('active'));
    i = (i + dir + slides.length) % slides.length;
    slides.forEach((s, n) => s.classList.toggle('active', n === i));
    const pos = root.querySelector('.cnui-sld-pos');
    if (pos) pos.textContent = (i + 1) + ' / ' + slides.length;
  };

  // Hook createAiMessageElement
  const _origCreate = window.createAiMessageElement;
  if (typeof createAiMessageElement === 'function' || true) {
    window.createAiMessageElement = function(content) {
      const str = typeof content === 'string' ? content : String(content || '');
      const parsed = renderCnuiBlocks(str);
      let el;
      if (typeof _origCreate === 'function') {
        el = _origCreate(parsed ? parsed.text : str);
      } else {
        el = document.createElement('div');
        el.className = 'msg ai-msg';
        const body = document.createElement('div');
        body.className = 'ai-md-body';
        body.innerHTML = (typeof renderAiMarkdown === 'function') ? renderAiMarkdown(parsed ? parsed.text : str) : (parsed ? parsed.text : str);
        el.appendChild(body);
      }
      if (parsed && parsed.blocks.length) {
        const body = el.querySelector('.ai-md-body') || el;
        let html = body.innerHTML;
        parsed.blocks.forEach((b, i) => {
          const ph = '%%CNUI_' + i + '%%';
          const rep = cnuiToHtml(b.type, b.body);
          html = html.split(ph).join(rep);
          // also escaped variants
          html = html.split(ph.replace(/_/g,'')).join(rep);
        });
        // replace placeholders that got escaped
        parsed.blocks.forEach((b, i) => {
          const re = new RegExp('%%CNUI_' + i + '%%', 'g');
          html = html.replace(re, cnuiToHtml(b.type, b.body));
        });
        body.innerHTML = html;
      }
      return el;
    };
  }

  // Demo CNUI
  window.__demoCnui = function() {
    const sample = `CNUI демо:

\`\`\`cnui:gml
Заголовок карточки
Короткое описание компонента GML — информационный блок.
\`\`\`

\`\`\`cnui:xml
warn
Проверьте настройки API перед отправкой.
\`\`\`

\`\`\`cnui:table
Имя | Статус
Core Node | Online
Maps | Beta
\`\`\`

\`\`\`cnui:code
javascript
console.log('CNUI Code');
\`\`\`

\`\`\`cnui:check_task
- Открыть проект
- Проверить код
- Сохранить изменения
\`\`\`
`;
    const flow = document.getElementById('chat-flow');
    if (!flow) return;
    document.getElementById('welcome-block')?.classList.add('hidden');
    flow.appendChild(createAiMessageElement(sample));
    showToast?.('CNUI demo', 'success');
  };

  // --- Custom toggles helper ---
  window.bindCnToggle = function(btn, key, onChange) {
    if (!btn) return;
    const saved = localStorage.getItem(key);
    const on = saved === '1' || saved === 'true';
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.onclick = () => {
      const next = !btn.classList.contains('on');
      btn.classList.toggle('on', next);
      btn.setAttribute('aria-pressed', next ? 'true' : 'false');
      localStorage.setItem(key, next ? '1' : '0');
      onChange?.(next);
    };
  };

  // --- Sleep AI lock schedule ---
  function isSleepLockActive() {
    if (localStorage.getItem('oracle_sleep_ai_lock') !== '1') return false;
    const mode = localStorage.getItem('oracle_sleep_ai_mode') || 'daily'; // daily|weekdays|weekends
    const start = localStorage.getItem('oracle_sleep_ai_start') || '23:00';
    const end = localStorage.getItem('oracle_sleep_ai_end') || '07:00';
    const now = new Date();
    const day = now.getDay(); // 0 sun
    if (mode === 'weekdays' && (day === 0 || day === 6)) return false;
    if (mode === 'weekends' && day !== 0 && day !== 6) return false;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const mins = now.getHours() * 60 + now.getMinutes();
    const s = sh * 60 + (sm || 0);
    const e = eh * 60 + (em || 0);
    if (s <= e) return mins >= s && mins < e;
    return mins >= s || mins < e; // overnight
  }
  function ensureSleepOverlay() {
    let el = document.getElementById('sleep-ai-lock');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sleep-ai-lock';
      el.innerHTML = '<div class="sleep-lock-card"><span class="material-symbols-rounded" style="font-size:40px;color:var(--primary)">bedtime</span><h3 style="margin:8px 0">Время сна</h3><p style="font-size:13px;color:var(--on-surface-variant);line-height:1.45">ИИ временно недоступен по вашему расписанию. Можно отключить блокировку в настройках «Сонный режим».</p><button type="button" class="modal-btn modal-btn-accept" style="margin-top:12px" onclick="document.getElementById(\'sleep-ai-lock\').classList.remove(\'active\')">Понятно</button></div>';
      document.body.appendChild(el);
    }
    return el;
  }
  function tickSleepLock() {
    const el = ensureSleepOverlay();
    if (isSleepLockActive()) el.classList.add('active');
    else el.classList.remove('active');
  }
  setInterval(tickSleepLock, 30000);
  setTimeout(tickSleepLock, 800);

  // Block send when sleep lock
  const _send = window.sendMsg;
  if (typeof _send === 'function') {
    window.sendMsg = function() {
      if (isSleepLockActive()) {
        ensureSleepOverlay().classList.add('active');
        showToast?.('ИИ заблокирован: режим сна', 'warning');
        return;
      }
      return _send.apply(this, arguments);
    };
  }

  // Inject sleep settings into settings if possible
  window.mountSleepAiLockSettings = function() {
    if (document.getElementById('sleep-ai-lock-settings')) return;
    const host = document.querySelector('#screen-settings .settings-panel, #settings-pillow, #screen-settings');
    // find pillow section by text
    const cards = document.querySelectorAll('#screen-settings .chat-card, #screen-settings .settings-item');
    let anchor = null;
    cards.forEach(c => { if (/сон|pillow|заставк/i.test(c.textContent||'')) anchor = c; });
    const box = document.createElement('div');
    box.id = 'sleep-ai-lock-settings';
    box.className = 'chat-card';
    box.style.cssText = 'margin:12px 0;padding:14px;';
    box.innerHTML = `
      <div class="cn-toggle-row">
        <div>
          <div class="cn-toggle-label">Напомнить о сне и заблокировать ИИ</div>
          <div class="cn-toggle-desc">В заданное время отправка сообщений блокируется</div>
        </div>
        <button type="button" class="cn-toggle" id="sleep-ai-lock-toggle" aria-label="Сон ИИ"></button>
      </div>
      <div id="sleep-ai-lock-opts" style="display:none;margin-top:10px;display:none;flex-direction:column;gap:8px;">
        <label style="font-size:12px">Начало <input type="time" id="sleep-ai-start" value="23:00" style="margin-left:8px;padding:6px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--on-surface)"></label>
        <label style="font-size:12px">Конец <input type="time" id="sleep-ai-end" value="07:00" style="margin-left:8px;padding:6px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--on-surface)"></label>
        <label style="font-size:12px">Повтор
          <select id="sleep-ai-mode" style="margin-left:8px;padding:6px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--on-surface)">
            <option value="daily">Ежедневно</option>
            <option value="weekdays">По будням</option>
            <option value="weekends">По выходным</option>
          </select>
        </label>
      </div>`;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else {
      const scr = document.getElementById('screen-settings');
      if (scr) scr.appendChild(box);
    }
    const tg = document.getElementById('sleep-ai-lock-toggle');
    const opts = document.getElementById('sleep-ai-lock-opts');
    const applyVis = (on) => { if (opts) opts.style.display = on ? 'flex' : 'none'; };
    bindCnToggle(tg, 'oracle_sleep_ai_lock', (on) => { applyVis(on); tickSleepLock(); });
    applyVis(localStorage.getItem('oracle_sleep_ai_lock') === '1');
    const st = document.getElementById('sleep-ai-start');
    const en = document.getElementById('sleep-ai-end');
    const md = document.getElementById('sleep-ai-mode');
    if (st) { st.value = localStorage.getItem('oracle_sleep_ai_start') || '23:00'; st.onchange = () => localStorage.setItem('oracle_sleep_ai_start', st.value); };
    if (en) { en.value = localStorage.getItem('oracle_sleep_ai_end') || '07:00'; en.onchange = () => localStorage.setItem('oracle_sleep_ai_end', en.value); };
    if (md) { md.value = localStorage.getItem('oracle_sleep_ai_mode') || 'daily'; md.onchange = () => localStorage.setItem('oracle_sleep_ai_mode', md.value); };
  };

  // Convert visible ВКЛЮЧИТЬ/ВЫКЛЮЧИТЬ text buttons where marked data-cn-toggle
  function upgradeLegacyToggles() {
    document.querySelectorAll('button').forEach(btn => {
      const tx = (btn.innerText || '').trim().toUpperCase();
      if (tx !== 'ВКЛЮЧИТЬ' && tx !== 'ВЫКЛЮЧИТЬ' && tx !== 'ВКЛ' && tx !== 'ВЫКЛ') return;
      if (btn.classList.contains('cn-toggle')) return;
      if (btn.dataset.cnUpgraded) return;
      btn.dataset.cnUpgraded = '1';
      // keep onclick, just restyle as pill toggle visual
      const on = /ВКЛ/.test(tx) && !/ВЫКЛ/.test(tx);
      btn.classList.add('cn-toggle');
      if (on) btn.classList.add('on');
      btn.innerHTML = '';
      const prev = btn.onclick;
      btn.onclick = function(ev) {
        if (typeof prev === 'function') prev.call(this, ev);
        // flip visual after legacy handler
        setTimeout(() => {
          const t = (btn.getAttribute('data-state') || '').toLowerCase();
          // legacy often changes text - if still empty keep class
          btn.classList.toggle('on');
        }, 0);
      };
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    mountSleepAiLockSettings();
    setTimeout(upgradeLegacyToggles, 500);
  });
  // also try late
  setTimeout(() => { mountSleepAiLockSettings(); upgradeLegacyToggles(); }, 1500);

  console.log('[CN] redesign pack: maps+chat, scenarios, expand sheet, CNUI, sleep lock, toggles');
})();

/* ===== SECTION ===== */

(function coreNodeDevModeAndTags() {
  const DEV_KEY = 'oracle_dev_mode_v1';
  const ENT_KEY = 'oracle_enterprise_v1';
  const FLAG_KEY = 'oracle_dev_flags_v1';
  const DEV_PASS_KEY = 'oracle_dev_password_v1';
  const PROMPT_KEY = 'oracle_dev_system_prompt_v1';
  const TYPES_KEY = 'oracle_dev_allowed_types_v1';
  const MAX_KEY = 'oracle_dev_max_chars_v1';

  function loadDev() { try { return JSON.parse(localStorage.getItem(DEV_KEY)||'{}')||{}; } catch(e){ return {}; } }
  function saveDev(o) { localStorage.setItem(DEV_KEY, JSON.stringify(o)); }
  function loadFlags() { try { return JSON.parse(localStorage.getItem(FLAG_KEY)||'{}')||{}; } catch(e){ return {}; } }
  function saveFlags(f) { localStorage.setItem(FLAG_KEY, JSON.stringify(f)); }
  function isDevActive() { return !!loadDev().active; }

  function hasUserPin() {
    const keys = ['oracle_pin_hash','oracle_user_pin','oracle_pin','core_node_pin','oracle_security_pin'];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && v !== '' && v !== 'null') return true;
    }
    try {
      const sec = JSON.parse(localStorage.getItem('oracle_security')||'{}');
      if (sec && (sec.pin || sec.pinHash || sec.enabled)) return true;
    } catch(e){}
    return false;
  }

  function verifyPinPrompt(cb) {
    if (!hasUserPin()) {
      showToast?.('Сначала установите PIN в Безопасности', 'warning');
      if (typeof cb === 'function') cb(false);
      return false;
    }
    const finish = function(entered) {
      let ok = false;
      try {
        const plain = localStorage.getItem('oracle_user_pin') || localStorage.getItem('oracle_pin');
        if (plain && plain === entered) ok = true;
        const hash = localStorage.getItem('oracle_pin_hash');
        if (hash && (hash === entered || hash === btoa(entered))) ok = true;
      } catch(e){}
      if (!ok) showToast?.('PIN не подтверждён','error');
      if (typeof cb === 'function') cb(ok);
      return ok;
    };
    if (typeof showCustomModal === 'function') {
      showCustomModal('PIN', 'Введите PIN Core Node:', true, '', function(val){
        if (val === false || val == null) { if (typeof cb === 'function') cb(false); return; }
        finish(String(val));
      });
      return false;
    }
    return false;
  }
  function verifyDevPassIfSet(cb) {
    const pass = localStorage.getItem(DEV_PASS_KEY);
    if (!pass) { if (typeof cb === 'function') cb(true); return true; }
    if (typeof showCustomModal === 'function') {
      showCustomModal('Пароль разработчика', 'Введите пароль разработчика:', true, '', function(val){
        if (val === false || val == null) { if (typeof cb === 'function') cb(false); return; }
        const ok = String(val) === pass;
        if (!ok) showToast?.('Неверный пароль разработчика','error');
        if (typeof cb === 'function') cb(ok);
      });
      return false;
    }
    return false;
  }

  window.showDevReloadToast = function(msg) {
    let el = document.getElementById('dev-reload-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dev-reload-toast';
      el.innerHTML = '<span id="dev-reload-msg"></span><button type="button" id="dev-reload-btn">Перезагрузить</button>';
      document.body.appendChild(el);
      el.querySelector('#dev-reload-btn').onclick = function() {
        location.reload();
      };
    }
    el.querySelector('#dev-reload-msg').textContent = msg || 'Чтобы применить изменения, перезагрузите страницу';
    el.classList.add('show');
  };

  function applyAttachPolicy() {
    const f = loadFlags();
    document.body.classList.toggle('dev-no-attach', !!f.noAttach);
    if (f.noAttach) {
      document.querySelectorAll('input[type="file"]').forEach(inp => {
        inp.disabled = true;
        inp.title = 'Вложения запрещены политикой устройства';
      });
    }
  }

  function applyDevUI() {
    const btn = document.getElementById('btn-sec-developer');
    const active = isDevActive();
    if (btn) btn.style.display = active ? '' : 'none';
    document.body.classList.toggle('dev-mode-on', active);
    const ent = localStorage.getItem(ENT_KEY) === '1';
    document.body.classList.toggle('enterprise-mode', ent);
    const f = loadFlags();
    document.body.classList.toggle('dev-hide-ultra', !!f.hideUltra);
    document.body.classList.toggle('dev-lock-theme', !!f.lockTheme);
    const et = document.getElementById('dev-enterprise-toggle');
    if (et) et.checked = ent;
    const map = {
      'dev-flag-debug': 'debug',
      'dev-flag-strict-limits': 'strictLimits',
      'dev-flag-hide-ultra': 'hideUltra',
      'dev-flag-lock-theme': 'lockTheme',
      'dev-flag-no-attach': 'noAttach'
    };
    Object.keys(map).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = !!f[map[id]];
    });
    const sp = document.getElementById('dev-system-prompt');
    if (sp) sp.value = localStorage.getItem(PROMPT_KEY) || '';
    const ty = document.getElementById('dev-allowed-types');
    if (ty) ty.value = localStorage.getItem(TYPES_KEY) || '';
    const mc = document.getElementById('dev-max-chars');
    if (mc) {
      const v = localStorage.getItem(MAX_KEY);
      mc.value = v != null ? v : (ent ? '150' : '0');
    }
    applyAttachPolicy();
    if (f.debug) console.info('[CoreNode Dev]', CoreNode.status());
  }

  window.CoreNode = window.CoreNode || {};
  window.CoreNode.enableDeveloperMode = function() {
    if (!hasUserPin()) {
      showCustomModal('Отказ', 'Установите PIN в Настройки → Безопасность');
      return false;
    }
    verifyPinPrompt(function(ok){
      if (!ok) return;
      verifyDevPassIfSet(function(ok2){
        if (!ok2) return;
        saveDev({ active: true, since: Date.now() });
        applyDevUI();
        try {
          if (typeof switchScreen === 'function') switchScreen('settings');
          setTimeout(() => { try { showSection('developer'); } catch(e){} }, 100);
        } catch(e){}
        showToast?.('Режим разработчика включён','success');
      });
    });
    return false;
  };
  window.CoreNode.disableDeveloperMode = function() {
    verifyPinPrompt(function(ok){
      if (!ok) return;
      saveDev({ active: false, since: Date.now() });
      applyDevUI();
      try { showSection('general'); } catch(e){}
      showToast?.('Режим разработчика отключён','info');
    });
    return false;
  };
  window.CoreNode.status = function() {
    return {
      dev: loadDev(),
      enterprise: localStorage.getItem(ENT_KEY)==='1',
      flags: loadFlags(),
      hasSystemPrompt: !!(localStorage.getItem(PROMPT_KEY)||'').trim(),
      allowedTypes: localStorage.getItem(TYPES_KEY)||'',
      maxChars: localStorage.getItem(MAX_KEY)
    };
  };
  window.CoreNode.getSystemPrompt = function() {
    return localStorage.getItem(PROMPT_KEY) || '';
  };

  window.devModeDisableConfirm = function() {
    showCustomModal('Режим разработчика', 'Отключить Режим Разработчика?', false, '', function(ok){
      if (ok) CoreNode.disableDeveloperMode();
    });
  };
  window.devToggleEnterprise = function(on) {
    if (!isDevActive()) return;
    localStorage.setItem(ENT_KEY, on ? '1' : '0');
    document.body.classList.toggle('enterprise-mode', !!on);
    showDevReloadToast('Enterprise изменён. Перезагрузите, чтобы применить все ограничения.');
  };
  window.devSetFlag = function(name, val) {
    if (!isDevActive()) return;
    const f = loadFlags();
    f[name] = !!val;
    saveFlags(f);
    applyDevUI();
  };
  window.devSetFlagReload = function(name, val) {
    devSetFlag(name, val);
    showDevReloadToast('Флаг «'+name+'» сохранён. Нажмите «Перезагрузить».');
  };
  window.devSavePassword = function() {
    if (!isDevActive()) return;
    const a = document.getElementById('dev-pass-input')?.value || '';
    const b = document.getElementById('dev-pass-confirm')?.value || '';
    if (a.length < 4) { showToast?.('Минимум 4 символа','warning'); return; }
    if (a !== b) { showToast?.('Пароли не совпадают','warning'); return; }
    localStorage.setItem(DEV_PASS_KEY, a);
    document.getElementById('dev-pass-input').value = '';
    document.getElementById('dev-pass-confirm').value = '';
    showToast?.('Пароль разработчика сохранён','success');
  };
  window.devClearPassword = function() {
    if (!isDevActive()) return;
    verifyPinPrompt(function(ok){
      if (!ok) return;
      localStorage.removeItem(DEV_PASS_KEY);
      showToast?.('Пароль Dev удалён','info');
    });
  };
  window.devSaveSystemPrompt = function() {
    if (!isDevActive()) return;
    const v = document.getElementById('dev-system-prompt')?.value || '';
    localStorage.setItem(PROMPT_KEY, v);
    showDevReloadToast('Системный промпт сохранён. Перезагрузите страницу.');
  };
  window.devClearSystemPrompt = function() {
    if (!isDevActive()) return;
    localStorage.removeItem(PROMPT_KEY);
    const sp = document.getElementById('dev-system-prompt');
    if (sp) sp.value = '';
    showDevReloadToast('Системный промпт очищен. Перезагрузите страницу.');
  };
  window.devSaveAllowedTypes = function() {
    if (!isDevActive()) return;
    const v = (document.getElementById('dev-allowed-types')?.value || '').trim();
    localStorage.setItem(TYPES_KEY, v);
    showDevReloadToast('Типы вложений сохранены. Перезагрузите страницу.');
  };
  window.devSaveMaxChars = function() {
    if (!isDevActive()) return;
    let n = parseInt(document.getElementById('dev-max-chars')?.value || '0', 10);
    if (isNaN(n) || n < 0) n = 0;
    localStorage.setItem(MAX_KEY, String(n));
    showDevReloadToast('Лимит символов сохранён. Перезагрузите страницу.');
  };
  window.devResetPolicies = function() {
    if (!isDevActive()) return;
    showCustomModal('Сброс политик', 'Сбросить Enterprise, флаги, типы, лимит и системный промпт?', false, '', function(ok){
      if (!ok) return;
      localStorage.removeItem(ENT_KEY);
      localStorage.removeItem(FLAG_KEY);
      localStorage.removeItem(TYPES_KEY);
      localStorage.removeItem(MAX_KEY);
      localStorage.removeItem(PROMPT_KEY);
      applyDevUI();
      showDevReloadToast('Политики сброшены. Перезагрузите страницу.');
    });
  };

  // Inject system prompt into sends
  function wrapSend() {
    const names = ['sendMsg','sendUserMessage','resolveAiResponse'];
    names.forEach(n => {
      const o = window[n];
      if (typeof o !== 'function' || o._devPrompt) return;
      window[n] = function() {
        const prompt = (localStorage.getItem(PROMPT_KEY)||'').trim();
        if (prompt && n === 'resolveAiResponse' && typeof arguments[0] === 'string') {
          arguments[0] = arguments[0] + '\n\n[System]\n' + prompt;
        }
        // max chars on sendMsg
        if (n === 'sendMsg' || n === 'sendUserMessage') {
          const max = parseInt(localStorage.getItem(MAX_KEY)||'0', 10);
          const input = document.getElementById('user-input');
          const text = (input && input.value) || (typeof arguments[0]==='string'?arguments[0]:'');
          if (max > 0 && text.length > max) {
            showToast?.('Лимит сообщения: '+max+' символов (политика устройства)','warning');
            return;
          }
          if (loadFlags().noAttach && window.__pendingAttachments?.length) {
            showToast?.('Вложения запрещены политикой','warning');
            return;
          }
        }
        return o.apply(this, arguments);
      };
      window[n]._devPrompt = true;
    });
  }

  // File input filter
  document.addEventListener('change', function(e) {
    const inp = e.target;
    if (!inp || inp.type !== 'file') return;
    if (loadFlags().noAttach) {
      inp.value = '';
      showToast?.('Вложения запрещены','warning');
      e.preventDefault();
      return;
    }
    const allow = (localStorage.getItem(TYPES_KEY)||'').trim();
    if (!allow || !inp.files?.length) return;
    const rules = allow.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    const bad = [...inp.files].filter(f => {
      const name = (f.name||'').toLowerCase();
      const type = (f.type||'').toLowerCase();
      return !rules.some(r => {
        if (r.endsWith('/*')) return type.startsWith(r.replace('/*',''));
        if (r.startsWith('.')) return name.endsWith(r);
        return type === r || name.endsWith('.'+r);
      });
    });
    if (bad.length) {
      inp.value = '';
      showToast?.('Тип файла не разрешён политикой: '+bad.map(b=>b.name).join(', '),'warning');
    }
  }, true);

  const _ss = window.showSection;
  if (typeof _ss === 'function' && !_ss._devTitle2) {
    
/* single source: function showSection */

    window.showSection._devTitle2 = true;
  }

  function boot() {
    applyDevUI();
    wrapSend();
    setTimeout(wrapSend, 800);
    console.info('%cCoreNode.enableDeveloperMode()', 'color:#90caf9', '— нужен PIN');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* ===== SECTION ===== */

(function coreNodeLayoutCompact(){
  function detectLayout(){
    const w = window.innerWidth || 0;
    let layout = 'desktop';
    if (w <= 767) layout = 'phone';
    else if (w <= 1199) layout = 'tablet';
    document.body.setAttribute('data-layout', layout);
    document.body.classList.toggle('layout-phone', layout==='phone');
    document.body.classList.toggle('layout-tablet', layout==='tablet');
    document.body.classList.toggle('layout-desktop', layout==='desktop');
    return layout;
  }
  detectLayout();
  window.addEventListener('resize', function(){
    clearTimeout(window.__cnLayoutT);
    window.__cnLayoutT = setTimeout(detectLayout, 120);
  });
  window.addEventListener('orientationchange', function(){ setTimeout(detectLayout, 200); });

  // Phone/tablet: expand input only on focus
  function bindInputExpand(){
    const input = document.getElementById('user-input');
    if (!input || input._cnExpand) return;
    input._cnExpand = true;
    const sync = () => {
      const layout = document.body.getAttribute('data-layout');
      if (layout === 'desktop') {
        document.body.classList.remove('input-expanded');
        return;
      }
      const focused = document.activeElement === input;
      const multi = (input.value || '').split('\n').length > 1 || (input.scrollHeight > 40);
      document.body.classList.toggle('input-expanded', focused || multi);
    };
    input.addEventListener('focus', sync);
    input.addEventListener('blur', () => setTimeout(sync, 100));
    input.addEventListener('input', sync);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindInputExpand);
  else bindInputExpand();
  setTimeout(bindInputExpand, 500);
})();

/* ===== SECTION ===== */

(function compactInputHasText(){
  function sync(){
    const box = document.getElementById('main-input-box');
    const input = document.getElementById('user-input');
    const send = document.getElementById('send-btn');
    if (!box || !input) return;
    const has = (input.value || '').trim().length > 0;
    box.classList.toggle('has-text', has);
    if (send) send.classList.toggle('visible', has);
  }
  const boot = () => {
    const input = document.getElementById('user-input');
    if (!input || input._compactSync) return;
    input._compactSync = true;
    input.addEventListener('input', sync);
    sync();
    // patch handleInput
    const hi = window.handleInput;
    if (typeof hi === 'function' && !hi._compact) {
      window.handleInput = function(el) {
        const r = hi.apply(this, arguments);
        sync();
        return r;
      };
      window.handleInput._compact = true;
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);
})();

/* ===== SECTION ===== */

(function coreNodeRailLiveTemp(){
  // Enable rail nav (top glass-nav hidden; use sidebar)
  document.body.classList.add('rail-nav-mode');
  document.body.classList.add('no-top-nav');

  window.toggleSidebarMore = function(e){
    e && e.stopPropagation();
    const m = document.getElementById('sb-more-menu');
    if (!m) return;
    m.hidden = !m.hidden;
  };
  window.closeSidebarMore = function(){
    const m = document.getElementById('sb-more-menu');
    if (m) m.hidden = true;
  };
  document.addEventListener('click', function(ev){
    const wrap = document.querySelector('.sb-more-wrap');
    if (wrap && !wrap.contains(ev.target)) closeSidebarMore();
  });

  /* openAddonsHub moved to cn-addons-nuclear */

  // --- Live sound (short beep, no external file required) ---
  function playLiveOnSound(){
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.28);
      setTimeout(() => ctx.close?.(), 500);
    } catch(e){}
  }

  // Patch startLiveChat / stopLiveChat
  const _start = window.startLiveChat;
  if (typeof _start === 'function' && !_start._railPatch) {
    window.startLiveChat = function(){
      const r = _start.apply(this, arguments);
      if (window.CoreState && CoreState.isLiveChat) {
        playLiveOnSound();
        const panel = document.getElementById('live-session-panel');
        if (panel) panel.hidden = false;
        const sub = document.getElementById('live-subtitles');
        if (sub) sub.textContent = 'Слушаю…';
        // hide classic row via CSS body class
        document.body.classList.add('live-chat-active');
        // open sidebar soft? no
        // mic on
        const mic = document.getElementById('live-mic-btn');
        if (mic) { mic.classList.add('on'); mic.classList.remove('off'); }
      }
      return r;
    };
    window.startLiveChat._railPatch = true;
  }
  const _stop = window.stopLiveChat;
  if (typeof _stop === 'function' && !_stop._railPatch) {
    window.stopLiveChat = function(){
      const r = _stop.apply(this, arguments);
      const panel = document.getElementById('live-session-panel');
      if (panel) panel.hidden = true;
      document.body.classList.remove('live-chat-active');
      return r;
    };
    window.stopLiveChat._railPatch = true;
  }

  window.toggleLiveMic = function(){
    const btn = document.getElementById('live-mic-btn');
    const icon = document.getElementById('live-mic-icon');
    if (!btn) return;
    const on = btn.classList.toggle('on');
    btn.classList.toggle('off', !on);
    if (icon) icon.textContent = on ? 'mic' : 'mic_off';
    try {
      if (!on && window.CoreState && CoreState.liveRecognition) {
        CoreState.liveRecognition.stop?.();
      } else if (on && typeof startLiveChat === 'function' && CoreState?.isLiveChat) {
        // recognition restart left to existing live pipeline
        showToast?.('Микрофон ' + (on ? 'вкл' : 'выкл'), 'info');
      }
    } catch(e){}
  };

  // Subtitles hook: observe live interim if available
  const _onresult_hook = setInterval(function(){
    if (!window.CoreState) return;
    // soft: if placeholder updates
  }, 2000);
  setTimeout(() => clearInterval(_onresult_hook), 10000);

  // Wire live textarea → main input
  document.addEventListener('DOMContentLoaded', function(){
    const liveIn = document.getElementById('live-user-input');
    const mainIn = document.getElementById('user-input');
    if (liveIn && mainIn) {
      liveIn.addEventListener('input', function(){
        mainIn.value = liveIn.value;
        const sub = document.getElementById('live-subtitles');
        if (sub && liveIn.value.trim()) sub.textContent = liveIn.value;
      });
    }
  });

  // --- Temp chat exit button ---
  function syncTempExit(){
    const btn = document.getElementById('temp-chat-exit-btn');
    if (!btn) return;
    const on = !!(window.CoreState && CoreState.isTempChat) || document.body.classList.contains('temp-chat-mode');
    btn.hidden = !on;
    if (on) btn.hidden = false;
  }
  const _enter = window.enterTempChat;
  if (typeof _enter === 'function' && !_enter._exitBtn) {
    window.enterTempChat = function(){
      const r = _enter.apply(this, arguments);
      document.body.classList.add('temp-chat-mode');
      syncTempExit();
      return r;
    };
    window.enterTempChat._exitBtn = true;
  }
  const _exit = window.exitTempChat;
  if (typeof _exit === 'function' && !_exit._exitBtn) {
    window.exitTempChat = function(){
      const r = _exit.apply(this, arguments);
      document.body.classList.remove('temp-chat-mode');
      CoreState.isTempChat = false;
      syncTempExit();
      try { if (typeof syncChatEmptyCenter === 'function') syncChatEmptyCenter(); } catch(e){}
      showToast?.('Обычный чат', 'info');
      return r;
    };
    window.exitTempChat._exitBtn = true;
  }
  // also fix toggle if stuck
  window.forceExitTempChat = function(){
    document.body.classList.remove('temp-chat-mode');
    if (window.CoreState) CoreState.isTempChat = false;
    try { exitTempChat(); } catch(e){ syncTempExit(); }
  };

  function boot(){
    syncTempExit();
    // projects panel: pull folder items from unified when possible
    try {
      if (typeof renderUnifiedArchive === 'function') {
        const orig = renderUnifiedArchive;
        // no hard override
      }
    } catch(e){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 600);
})();

/* ===== CLEANUP BOOT 2026-11 ===== */
(function(){
  // Always start with blank new chat on reload
  function forceNewChatOnBoot(){
    try {
      localStorage.removeItem('oracle_current_session');
    } catch(e){}
    try {
      if (typeof window.currentSessionId !== 'undefined') window.currentSessionId = null;
      // also module-scope if accessible
    } catch(e){}
    try {
      if (typeof createNewChatSession === 'function') createNewChatSession();
      else {
        const flow = document.getElementById('chat-flow');
        const welcome = document.getElementById('welcome-block');
        if (flow) flow.innerHTML = '';
        if (welcome) welcome.classList.remove('hidden');
        document.body.classList.add('chat-empty', 'chat-empty-center');
      }
    } catch(e){ console.warn('boot new chat', e); }
  }

  // Sidebar open class sync for input shift
  function syncSidebarOpenClass(){
    const sb = document.getElementById('sidebar-archive');
    const open = !!(sb && (sb.classList.contains('open') || document.body.classList.contains('sidebar-docked')));
    document.body.classList.toggle('sidebar-open', open);
  }
  const _mo = new MutationObserver(syncSidebarOpenClass);
  document.addEventListener('DOMContentLoaded', function(){
    const sb = document.getElementById('sidebar-archive');
    if (sb) _mo.observe(sb, { attributes:true, attributeFilter:['class'] });
    syncSidebarOpenClass();
    // Delay so session restore doesn't win
    setTimeout(forceNewChatOnBoot, 50);
    setTimeout(forceNewChatOnBoot, 400);
  });
  if (document.readyState !== 'loading') {
    setTimeout(forceNewChatOnBoot, 50);
    setTimeout(forceNewChatOnBoot, 400);
  }

  // Highlight active archive item
  window.markActiveArchiveItem = function(id){
    document.querySelectorAll('.unified-item, .unified-archive-item, .sb-chat-item, .archive-item').forEach(el => {
      const eid = el.getAttribute('data-id') || el.dataset?.id || el.getAttribute('data-session');
      el.classList.toggle('active', !!(id && eid && String(eid) === String(id)));
    });
  };
  const _load = window.loadChatSession;
  if (typeof _load === 'function' && !_load._activeMark) {
    window.loadChatSession = function(id){
      const r = _load.apply(this, arguments);
      try { markActiveArchiveItem(id); } catch(e){}
      return r;
    };
    window.loadChatSession._activeMark = true;
  }

  // Fast Assistant import badge on list items
  window.decorateFaImportBadges = function(){
    document.querySelectorAll('[data-fa-import="1"], .fa-imported').forEach(el => {
      if (el.querySelector('.fa-import-badge')) return;
      const b = document.createElement('span');
      b.className = 'fa-import-badge';
      b.textContent = 'Import';
      const title = el.querySelector('.unified-item-title, .chat-title, b, span');
      (title || el).appendChild(b);
    });
  };
  // When merging FA chats, tag them
  const _merge = window.mergeFaChatsIntoSessions;
  if (typeof _merge === 'function' && !_merge._tagged) {
    window.mergeFaChatsIntoSessions = function(chatsObj){
      const n = _merge.apply(this, arguments);
      try {
        if (chatsObj && typeof chatsObj === 'object') {
          Object.keys(chatsObj).forEach(id => {
            const key = String(id).startsWith('fa_') ? id : ('fa_' + id);
            if (window.chatSessions && chatSessions[key]) chatSessions[key].fromFa = true;
            if (window.chatSessions && chatSessions[id]) chatSessions[id].fromFa = true;
          });
          localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
        }
      } catch(e){}
      setTimeout(decorateFaImportBadges, 200);
      return n;
    };
    window.mergeFaChatsIntoSessions._tagged = true;
  }

  // Hide obsolete personalization toggles if still in DOM
  function hideObsoleteNavSettings(){
    document.querySelectorAll('.chat-card, .settings-item').forEach(card => {
      const tx = card.textContent || '';
      if (/Компактн(ый|ая)? режим|Состав панели навигации|Слиять с концами|Сделать Компактнее навигацию/i.test(tx)) {
        card.style.display = 'none';
      }
    });
  }
  document.addEventListener('DOMContentLoaded', hideObsoleteNavSettings);
  setTimeout(hideObsoleteNavSettings, 800);

  console.log('[CN] cleanup boot: new chat on entry, unified sidebar scroll, FA badges');
})();



(function(){
  // Never use browser alert/confirm/prompt in UI
  const nativeAlert = window.alert;
  const nativeConfirm = window.confirm;
  const nativePrompt = window.prompt;

  function modalConfirm(message, title) {
    return new Promise(function(resolve){
      if (typeof showCustomModal === 'function') {
        showCustomModal(title || 'Подтвердите действие', message, false, '', function(ok){ resolve(!!ok); });
      } else resolve(nativeConfirm(message));
    });
  }
  function modalAlert(message, title) {
    if (typeof showCustomModal === 'function') {
      showCustomModal(title || 'Сообщение', message);
    } else if (typeof showToast === 'function') showToast(String(message), 'info');
  }
  function modalPrompt(message, def, title) {
    return new Promise(function(resolve){
      if (typeof showCustomModal === 'function') {
        showCustomModal(title || 'Ввод', message, true, def || '', function(val){
          // showCustomModal prompt callback may pass string or true
          if (val === false || val == null) resolve(null);
          else resolve(typeof val === 'string' ? val : (document.getElementById('custom-modal-input')?.value ?? ''));
        });
      } else resolve(nativePrompt(message, def));
    });
  }

  window.alert = function(msg){ modalAlert(msg); };
  window.confirm = function(msg){
    console.warn('[CN] sync confirm blocked:', msg);
    // cannot block; return false and show modal for user awareness
    modalAlert(msg, 'Подтвердите действие');
    return false;
  };
  window.prompt = function(msg, def){
    console.warn('[CN] sync prompt blocked:', msg);
    modalAlert(msg, 'Ввод');
    return null;
  };
  window.cnConfirm = modalConfirm;
  window.cnAlert = modalAlert;
  window.cnPrompt = modalPrompt;

  // Convert remaining text toggle buttons to pill switches
  function upgradeToggles(){
    document.querySelectorAll('button').forEach(function(btn){
      if (btn.classList.contains('think-style-btn')) return;
      if (btn.closest('.think-style-row, .segmented, .create-a-grid')) return;
      if (btn.id && btn.id.indexOf('think-style') === 0) return;
      const tx = (btn.innerText || btn.textContent || '').trim().toUpperCase();
      if (!/^(ВКЛ|ВЫКЛ|ВКЛЮЧИТЬ|ВЫКЛЮЧИТЬ)$/.test(tx)) return;
      if (btn.dataset.cnSwitch === '1') return;
      btn.dataset.cnSwitch = '1';
      btn.classList.add('toggle-btn');
      // ВКЛЮЧИТЬ = currently OFF; ВЫКЛЮЧИТЬ = currently ON; ВКЛ/ВЫКЛ = state labels
      let on = false;
      if (tx === 'ВЫКЛЮЧИТЬ' || tx === 'ВКЛ') on = true;
      if (tx === 'ВКЛЮЧИТЬ' || tx === 'ВЫКЛ') on = false;
      if (on) btn.classList.add('on'); else btn.classList.remove('on');
      btn.setAttribute('data-on', on ? '1' : '0');
      btn.textContent = '';
      const prev = btn.onclick;
      btn.onclick = function(ev){
        if (typeof prev === 'function') prev.call(this, ev);
        setTimeout(function(){
          // re-sync class from text if handler rewrote it
          const t2 = (btn.innerText || btn.textContent || '').trim().toUpperCase();
          if (/^(ВКЛ|ВЫКЛ|ВКЛЮЧИТЬ|ВЫКЛЮЧИТЬ)$/.test(t2)) {
            let isOn = false;
            if (t2 === 'ВЫКЛЮЧИТЬ' || t2 === 'ВКЛ') isOn = true;
            if (t2 === 'ВКЛЮЧИТЬ' || t2 === 'ВЫКЛ') isOn = false;
            btn.classList.toggle('on', isOn);
            btn.setAttribute('data-on', isOn ? '1' : '0');
            btn.textContent = '';
          } else {
            btn.classList.toggle('on');
            btn.setAttribute('data-on', btn.classList.contains('on') ? '1' : '0');
          }
        }, 0);
      };
    });
  }
  document.addEventListener('DOMContentLoaded', upgradeToggles);
  setTimeout(upgradeToggles, 300);
  setTimeout(upgradeToggles, 1200);
  // observe settings panel
  const obs = new MutationObserver(function(){ upgradeToggles(); });
  document.addEventListener('DOMContentLoaded', function(){
    const root = document.getElementById('screen-settings') || document.body;
    obs.observe(root, { childList:true, subtree:true });
  });

  console.log('[CN] native dialogs disabled; custom switches active');
})();



(function(){
  document.addEventListener('DOMContentLoaded', function(){
    const liveIn = document.getElementById('live-user-input');
    const mainIn = document.getElementById('user-input');
    const sub = document.getElementById('live-subtitles');
    if (liveIn && mainIn) {
      liveIn.addEventListener('input', function(){
        mainIn.value = liveIn.value;
        if (sub) sub.textContent = liveIn.value.trim() || 'Слушаю…';
        if (typeof handleInput === 'function') handleInput(mainIn);
      });
    }
  });
})();



(function(){
  const LINE_TRIGGER = 2;      // >2 visual lines → tall mode
  const EXPAND_CHARS = 280;    // auto open expanded sheet
  const MAX_GROW_PX = 96;

  function lineCount(ta) {
    if (!ta) return 1;
    const cs = getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.45) || 22;
    // measure with scrollHeight
    const prev = ta.style.height;
    ta.style.height = 'auto';
    const sh = ta.scrollHeight;
    ta.style.height = prev;
    return Math.max(1, Math.round(sh / lh));
  }

  function growInput(ta) {
    if (!ta) return;
    const empty = !(ta.value || '').trim();
    ta.style.height = 'auto';
    // empty field stays single-line even if chips above
    const next = empty ? Math.min(ta.scrollHeight, 44) : Math.min(ta.scrollHeight, MAX_GROW_PX);
    ta.style.height = next + 'px';
    const box = document.getElementById('main-input-box');
    const lines = empty ? 1 : lineCount(ta);
    if (box) {
      box.classList.toggle('input-expanded-tall', !empty && (lines > LINE_TRIGGER || ta.scrollHeight > 56));
      box.classList.toggle('has-attach-chips', document.body.classList.contains('has-attachments'));
    }
    return lines;
  }

  function maybeAutoExpand(ta) {
    if (!ta) return;
    const lines = growInput(ta);
    const long = (ta.value || '').length >= EXPAND_CHARS || lines >= 6;
    if (long && typeof openExpandedInput === 'function') {
      // only auto-open once per "session" of long text
      if (!ta.dataset.cnAutoExp) {
        ta.dataset.cnAutoExp = '1';
        openExpandedInput();
      }
    }
    if ((ta.value || '').length < EXPAND_CHARS / 2) {
      delete ta.dataset.cnAutoExp;
    }
  }

  // Patch handleInput
  const prevHandle = window.handleInput;
  window.handleInput = function(textarea) {
    if (typeof prevHandle === 'function') {
      try { prevHandle.apply(this, arguments); } catch(e) {}
    }
    const ta = textarea || document.getElementById('user-input');
    growInput(ta);
    // soft auto-expand for very long text
    if (ta && (ta.value || '').split('\n').length > 4) maybeAutoExpand(ta);
  };

  // Also on keyup for reliability
  document.addEventListener('DOMContentLoaded', function(){
    const ta = document.getElementById('user-input');
    if (!ta) return;
    const onGrow = function(){ growInput(ta); };
    ta.addEventListener('input', onGrow);
    ta.addEventListener('paste', function(){ setTimeout(onGrow, 0); });
    // expand button prefers sheet
    const exp = document.getElementById('expand-btn');
    if (exp) {
      exp.onclick = function(e){
        e && e.preventDefault();
        if (typeof openExpandedInput === 'function') openExpandedInput();
        else if (typeof openFullscreenInput === 'function') openFullscreenInput();
      };
    }
    growInput(ta);
  });

  // Theme transition flash guard
  window.cnApplyThemeSmooth = function(){
    document.body.classList.add('cn-theme-switching');
    if (typeof applyVisualTheme === 'function') applyVisualTheme();
    setTimeout(function(){ document.body.classList.remove('cn-theme-switching'); }, 320);
  };

  // Sidebar open class sync (for input shift)
  function syncSb(){
    const sb = document.getElementById('sidebar-archive');
    const open = !!(sb && (sb.classList.contains('open') || document.body.classList.contains('sidebar-docked')));
    document.body.classList.toggle('sidebar-open', open);
  }
  document.addEventListener('DOMContentLoaded', function(){
    const sb = document.getElementById('sidebar-archive');
    if (sb) new MutationObserver(syncSb).observe(sb, { attributes:true, attributeFilter:['class'] });
    syncSb();
  });

  console.log('[CN] Redesign 3.0: grow input, themes, motion');
})();



(function(){
  function restoreThinkBtns(){
    const map = { 'think-style-dots':'Две точки', 'think-style-ring':'Обводка', 'think-style-off':'Выкл' };
    Object.keys(map).forEach(function(id){
      const b = document.getElementById(id);
      if (!b) return;
      b.classList.remove('toggle-btn','on');
      b.removeAttribute('data-on');
      b.dataset.cnSwitch = '0';
      if (!(b.textContent||'').trim()) b.textContent = map[id];
      // strip fake knob
      b.style.fontSize = '';
      b.style.width = '';
      b.style.height = '';
      b.style.color = '';
      b.style.background = '';
    });
  }
  document.addEventListener('DOMContentLoaded', restoreThinkBtns);
  setTimeout(restoreThinkBtns, 200);
  setTimeout(restoreThinkBtns, 800);
  // after setThinkingStyle
  const prev = window.setThinkingStyle;
  if (typeof prev === 'function' && !prev._fix) {
    window.setThinkingStyle = function(){
      const r = prev.apply(this, arguments);
      restoreThinkBtns();
      document.querySelectorAll('.think-style-btn').forEach(function(b){
        b.classList.toggle('active', b.getAttribute('data-style') === (localStorage.getItem('oracle_think_style')||'dots'));
      });
      return r;
    };
    window.setThinkingStyle._fix = true;
  }
})();



document.addEventListener('DOMContentLoaded', function(){
  try {
    if (typeof applyVisualTheme === 'function') applyVisualTheme();
    const tint = localStorage.getItem('oracle_accent_tint');
    const el = document.getElementById('toggle-accent-tint');
    if (el) el.checked = tint !== '0';
    const db = localStorage.getItem('oracle_dark_base') || '#0f0f0f';
    document.querySelectorAll('.dark-base-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-base') === db));
  } catch(e){}
});



(function(){
  const PLUGINS_KEY = 'oracle_plugins_v1';
  const DEFAULT_PLUGINS = [
    { id: 'fa-bridge', name: 'Fast Assistant Bridge', desc: 'Связка чатов с Fast Assistant', enabled: true, isNew: true, builtin: true },
    { id: 'gmail', name: 'Gmail', desc: 'Почта: чтение и действия по письмам', enabled: false, needsAuth: true, authHint: 'Подключите Gmail-аккаунт' }
  ];

  function loadPlugins(){
    try {
      const raw = JSON.parse(localStorage.getItem(PLUGINS_KEY) || 'null');
      if (Array.isArray(raw) && raw.length) return raw;
    } catch(e){}
    return DEFAULT_PLUGINS.map(p => ({...p}));
  }
  function savePlugins(list){
    localStorage.setItem(PLUGINS_KEY, JSON.stringify(list));
  }

  window.renderPluginsList = function(){
    const box = document.getElementById('plugins-list');
    if (!box) return;
    const list = loadPlugins();
    box.innerHTML = list.map(p => `
      <div class="plugin-row" data-plugin="${p.id}">
        <span class="material-symbols-rounded">${p.id==='gmail'?'mail':'hub'}</span>
        <div class="plugin-meta">
          <div class="plugin-name">${p.name} ${p.isNew?'<span class="plugin-badge-new">NEW</span>':''}</div>
          <div class="plugin-desc">${p.desc||''}</div>
        </div>
        <span class="plugin-status ${p.enabled?'on':''}">${p.enabled?'Включён':'Выключен'}</span>
        <button type="button" class="icon-btn" onclick="pluginMenu('${p.id}', event)" title="Ещё">
          <span class="material-symbols-rounded">more_vert</span>
        </button>
      </div>`).join('');
  };

  window.pluginMenu = function(id, e){
    e && e.stopPropagation();
    const list = loadPlugins();
    const p = list.find(x => x.id === id);
    if (!p) return;
    const actions = [];
    if (p.enabled) actions.push('Отключить');
    else actions.push('Включить');
    if (!p.builtin) actions.push('Удалить');
    else if (p.id === 'gmail') actions.push('Подробнее');
    showCustomModal(p.name, actions.map((a,i)=> (i+1)+'. '+a).join('<br>'), true, '1', function(val){
      if (val === false || val == null) return;
      const n = String(val).trim();
      if (n === '1') {
        if (p.enabled) {
          p.enabled = false;
        } else {
          if (p.needsAuth) {
            showCustomModal('Gmail', 'Надо подключить Gmail-аккаунт', false, '', function(){});
            showToast?.('Подключите Gmail-аккаунт', 'warning');
            return;
          }
          p.enabled = true;
        }
        savePlugins(list); renderPluginsList();
      } else if (n === '2' && p.id === 'gmail') {
        showCustomModal('Gmail', 'Плагин позволяет чистить ящик и искать письма через @Gmail в чате. Нужна авторизация Google.');
      } else if (n === '2' && !p.builtin) {
        savePlugins(list.filter(x => x.id !== id)); renderPluginsList();
      }
    });
  };

  const _setSkillsTab = window.setSkillsTab;
  window.setSkillsTab = function(tab){
    if (typeof _setSkillsTab === 'function') _setSkillsTab(tab);
    document.querySelectorAll('.skills-hub-tab[data-skills-tab]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-skills-tab') === tab);
    });
    document.querySelectorAll('.skills-panel').forEach(p => { p.hidden = true; });
    const panel = document.getElementById('skills-panel-' + tab);
    if (panel) panel.hidden = false;
    // ensure tags panel visible when selected
    if (tab === 'tags') {
      const tp = document.getElementById('skills-panel-tags');
      if (tp) tp.hidden = false;
    }
    if (tab === 'plugins') {
      renderPluginsList();
      if (!localStorage.getItem('oracle_plugins_intro')) {
        showCustomModal('Плагины', 'Плагины — внешние интеграции (почта, Fast Assistant…). Коннекторы (@) — встроенные команды Core Node. В чате: @ИмяПлагина.');
        localStorage.setItem('oracle_plugins_intro', '1');
      }
    }
  };

  // @ popup: include plugins; / and : tip
  const _origInput = window.handleInput;
  window.handleInput = function(ta){
    if (typeof _origInput === 'function') try { _origInput.apply(this, arguments); } catch(e){}
    const el = ta || document.getElementById('user-input');
    if (!el) return;
    const v = el.value || '';
    const last = v.slice(-1);
    if (last === '/' || last === ':') {
      showToast?.('Теперь интерфейс понятнее: введите @ вместо / или :', 'info', 3200);
    }
  };

  // ----- Swipe sidebar -----
  (function swipeSidebar(){
    let x0 = null, y0 = null, tracking = false;
    const EDGE = 28;
    document.addEventListener('touchstart', function(e){
      if (!e.touches || e.touches.length !== 1) return;
      const t = e.touches[0];
      x0 = t.clientX; y0 = t.clientY; tracking = true;
    }, {passive:true});
    document.addEventListener('touchend', function(e){
      if (!tracking || x0 == null) return;
      tracking = false;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const sb = document.getElementById('sidebar-archive');
      const open = sb && sb.classList.contains('open');
      if (dx > 0 && x0 < EDGE + 20 && !open) openSidebar?.();
      if (dx < 0 && open) closeSidebar?.();
      x0 = y0 = null;
    }, {passive:true});
  })();

  // ----- Resize sidebar -----
  (function resizeSidebar(){
    const handle = () => document.getElementById('sb-resize-handle');
    let dragging = false, startX = 0, startW = 280;
    function onDown(e){
      const sb = document.getElementById('sidebar-archive');
      if (!sb || !sb.classList.contains('open')) return;
      dragging = true;
      startX = (e.touches ? e.touches[0].clientX : e.clientX);
      startW = sb.getBoundingClientRect().width;
      handle()?.classList.add('dragging');
      e.preventDefault();
    }
    function onMove(e){
      if (!dragging) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      let w = Math.min(420, Math.max(220, startW + (x - startX)));
      document.documentElement.style.setProperty('--cn-sidebar-w', w + 'px');
      localStorage.setItem('oracle_sidebar_w', String(w));
    }
    function onUp(){
      dragging = false;
      handle()?.classList.remove('dragging');
    }
    document.addEventListener('DOMContentLoaded', function(){
      const w = parseInt(localStorage.getItem('oracle_sidebar_w')||'280',10);
      if (w >= 220 && w <= 420) document.documentElement.style.setProperty('--cn-sidebar-w', w + 'px');
      const h = handle();
      if (!h) return;
      h.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  })();

  // ----- Projects -----
  window._projectDraft = { icon: 'folder', color: '#8b5cf6', name: '' };

  window.openCreateProjectModal = function(){
    window._projectDraft = { icon: 'folder', color: '#8b5cf6', name: '' };
    const colors = ['#9ca3af','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899'];
    const icons = ['folder','flight','school','code','music_note','work','favorite','science','sports_esports','palette','home','bolt'];
    const html = `
      <label style="font-size:12px;font-weight:600;">Название проекта</label>
      <div style="display:flex;gap:8px;align-items:center;margin:8px 0 12px;">
        <button type="button" id="proj-icon-preview" class="project-home-icon" onclick="cycleProjectDraftIcon()" style="background:${window._projectDraft.color}33;color:${window._projectDraft.color}">
          <span class="material-symbols-rounded" id="proj-icon-preview-i">folder</span>
        </button>
        <input id="proj-name-input" type="text" placeholder="Например: Учёба" style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--surface-variant);color:var(--on-surface);">
      </div>
      <div style="font-size:11px;color:var(--on-surface-variant);margin-bottom:6px;">Цвет</div>
      <div class="color-picker-row" id="proj-colors">${colors.map(c=>`<button type="button" data-c="${c}" style="background:${c}" onclick="setProjectDraftColor('${c}')"></button>`).join('')}</div>
      <div style="font-size:11px;color:var(--on-surface-variant);margin:8px 0 6px;">Иконка</div>
      <div class="icon-picker-grid">${icons.map(ic=>`<button type="button" onclick="setProjectDraftIcon('${ic}')"><span class="material-symbols-rounded">${ic}</span></button>`).join('')}</div>
      <p style="font-size:12px;color:var(--on-surface-variant);margin-top:12px;line-height:1.45;">В проекте хранятся чаты, файлы и источники в одном месте — как рабочая папка.</p>
    `;
    showCustomModal('Создать проект', html, false, '', function(ok){
      if (!ok) return;
      const name = (document.getElementById('proj-name-input')?.value || '').trim() || 'Новый проект';
      createProjectWithMeta(name, window._projectDraft.icon, window._projectDraft.color);
    });
    // re-bind input after modal paints
    setTimeout(() => {
      const inp = document.getElementById('proj-name-input');
      if (inp) inp.focus();
      const ok = document.getElementById('custom-modal-ok');
      if (ok) ok.textContent = 'Создать проект';
    }, 50);
  };
  window.setProjectDraftColor = function(c){
    window._projectDraft.color = c;
    const prev = document.getElementById('proj-icon-preview');
    if (prev) { prev.style.background = c+'33'; prev.style.color = c; }
    document.querySelectorAll('#proj-colors button').forEach(b => b.classList.toggle('active', b.getAttribute('data-c')===c));
  };
  window.setProjectDraftIcon = function(ic){
    window._projectDraft.icon = ic;
    const i = document.getElementById('proj-icon-preview-i');
    if (i) i.textContent = ic;
  };
  window.cycleProjectDraftIcon = function(){
    const icons = ['folder','flight','school','code','music_note','work','favorite','science'];
    const i = icons.indexOf(window._projectDraft.icon);
    setProjectDraftIcon(icons[(i+1)%icons.length]);
  };

  window.createProjectWithMeta = function(name, icon, color){
    showToast?.('Создание проекта…', 'info');
    const delay = 400 + Math.random()*1200;
    setTimeout(function(){
      if (typeof projectTree !== 'object' || !projectTree) window.projectTree = { folders: {} };
      if (!projectTree.folders) projectTree.folders = {};
      const id = 'proj_' + Date.now();
      projectTree.folders[id] = {
        id, title: name, icon: icon||'folder', color: color||'#8b5cf6',
        chatIds: [], files: [], sources: [], instructions: '',
        memory: 'standard', libraryAccess: true, created: Date.now()
      };
      try { localStorage.setItem(typeof TREE_KEY !== 'undefined' ? TREE_KEY : 'oracle_project_tree', JSON.stringify(projectTree)); } catch(e){}
      if (typeof saveProjectTree === 'function') saveProjectTree();
      if (typeof renderProjectTree === 'function') renderProjectTree();
      if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
      showToast?.('Проект создан', 'success');
      openProjectHome(id);
    }, delay);
  };

  window.openProjectHome = function(id){
    try { if (typeof loadProjectTree === 'function') loadProjectTree(); } catch (e) {}
    const f = projectTree?.folders?.[id];
    if (!f) return;
    window.currentFolderId = id;
    window._activeProjectId = id;
    document.body.classList.add('project-home-open');
    const home = document.getElementById('project-home');
    if (home) { home.hidden = false; }
    const title = document.getElementById('project-home-title');
    if (title) title.textContent = f.title || 'Проект';
    const ic = document.getElementById('project-home-icon');
    if (ic) { ic.textContent = f.icon || 'folder'; ic.style.color = f.color || ''; }
    setProjectHomeTab('chats');
    renderProjectHomeChats(id);
    renderProjectHomeSources(id);
  };

  window.closeProjectHome = function(){
    document.body.classList.remove('project-home-open');
    const home = document.getElementById('project-home');
    if (home) home.hidden = true;
  };

  window.setProjectHomeTab = function(tab){
    document.querySelectorAll('.project-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-ptab')===tab));
    const c = document.getElementById('project-home-chats');
    const s = document.getElementById('project-home-sources');
    if (c) c.hidden = tab !== 'chats';
    if (s) s.hidden = tab !== 'sources';
  };

  window.renderProjectHomeChats = function(id){
    const box = document.getElementById('project-home-chats');
    if (!box) return;
    const f = projectTree?.folders?.[id];
    const ids = (f && f.chatIds) || [];
    if (!ids.length) {
      box.innerHTML = `<div class="project-empty"><h3>Пока нет чатов</h3><p>Чаты этого проекта появятся здесь</p>
        <button type="button" class="modal-btn modal-btn-accept" onclick="startChatInProject('${id}')">Новый чат в проекте</button></div>`;
      return;
    }
    box.innerHTML = ids.map(cid => {
      const sess = (typeof chatSessions==='object' && chatSessions[cid]) ? chatSessions[cid] : null;
      const title = (sess && sess.title) || cid;
      return `<div class="unified-item" onclick="loadChatSession && loadChatSession('${cid}'); closeProjectHome();"><span class="material-symbols-rounded">chat_bubble</span> ${title}</div>`;
    }).join('');
  };

  window.renderProjectHomeSources = function(id){
    const box = document.getElementById('project-home-sources');
    if (!box) return;
    const f = projectTree?.folders?.[id];
    const src = (f && f.sources) || [];
    if (!src.length) {
      box.innerHTML = `<div class="project-empty" style="border:1px dashed var(--border);border-radius:16px;">
        <h3>Добавьте источники</h3>
        <p>Файлы и ссылки дают проекту больше контекста</p>
        <button type="button" class="modal-btn modal-btn-accept" onclick="addProjectSource('${id}')">Добавить источники</button>
      </div>`;
      return;
    }
    box.innerHTML = src.map((s,i)=>`<div class="plugin-row"><span class="material-symbols-rounded">description</span><div class="plugin-meta"><div class="plugin-name">${s.name||'Источник'}</div></div>
      <button type="button" class="icon-btn" onclick="removeProjectSource('${id}',${i})"><span class="material-symbols-rounded">close</span></button></div>`).join('');
  };

  window.startChatInProject = function(id){
    closeProjectHome();
    if (typeof createNewChatSession === 'function') createNewChatSession();
    // tag session into project when first message saves — store pending
    window._pendingProjectId = id;
    showToast?.('Новый чат в проекте', 'info');
  };

  window.addProjectSource = function(id){
    showCustomModal('Источник', 'Имя файла или ссылка:', true, '', function(val){
      if (!val || !String(val).trim()) return;
      const f = projectTree.folders[id];
      if (!f) return;
      if (!f.sources) f.sources = [];
      f.sources.push({ name: String(val).trim(), added: Date.now() });
      if (typeof saveProjectTree === 'function') saveProjectTree();
      renderProjectHomeSources(id);
    });
  };
  window.removeProjectSource = function(id, i){
    const f = projectTree.folders[id];
    if (!f || !f.sources) return;
    f.sources.splice(i,1);
    if (typeof saveProjectTree === 'function') saveProjectTree();
    renderProjectHomeSources(id);
  };

  window.openProjectSettings = function(){
    const id = window._activeProjectId;
    const f = projectTree?.folders?.[id];
    if (!f) return;
    showCustomModal('Настройки проекта', `
      <div style="font-size:12px;margin-bottom:8px;">Название</div>
      <input id="proj-set-name" value="${(f.title||'').replace(/"/g,'&quot;')}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--surface-variant);color:var(--on-surface);margin-bottom:12px;">
      <div style="font-size:12px;margin-bottom:6px;">Инструкции</div>
      <textarea id="proj-set-instr" rows="3" placeholder="Как ИИ отвечает в этом проекте" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--surface-variant);color:var(--on-surface);margin-bottom:12px;">${f.instructions||''}</textarea>
      <button type="button" class="modal-btn" style="background:#7f1d1d;color:#fff;width:100%;" onclick="deleteProjectById('${id}')">Удалить проект</button>
    `, false, '', function(ok){
      if (!ok) return;
      f.title = document.getElementById('proj-set-name')?.value?.trim() || f.title;
      f.instructions = document.getElementById('proj-set-instr')?.value || '';
      if (typeof saveProjectTree === 'function') saveProjectTree();
      openProjectHome(id);
      if (typeof renderProjectTree === 'function') renderProjectTree();
    });
  };

  window.deleteProjectById = function(id){
    showCustomModal('Удалить проект', 'Чаты останутся, но отвяжутся от проекта.', false, '', function(ok){
      if (!ok) return;
      delete projectTree.folders[id];
      if (typeof saveProjectTree === 'function') saveProjectTree();
      closeProjectHome();
      if (typeof renderProjectTree === 'function') renderProjectTree();
    });
  };

  window.openProjectSortMenu = function(e){
    e && e.stopPropagation();
    showCustomModal('Сортировка проектов', '1 — по имени<br>2 — сначала новые<br>3 — сначала старые', true, '1', function(val){
      const n = String(val||'1').trim();
      localStorage.setItem('oracle_project_sort', n);
      if (typeof renderProjectTree === 'function') renderProjectTree();
    });
  };

  // Move chat to project helper for context menu
  window.cmMoveToProject = function(){
    const sid = window._ctxSessionId || currentSessionId;
    if (!sid) return;
    const folders = Object.values(projectTree?.folders || {});
    if (!folders.length) {
      showToast?.('Сначала создайте проект', 'info');
      openCreateProjectModal();
      return;
    }
    const list = folders.map((f,i)=> (i+1)+'. '+f.title).join('<br>');
    showCustomModal('Переместить в проект', list, true, '1', function(val){
      const idx = parseInt(val,10)-1;
      if (idx<0 || idx>=folders.length) return;
      const f = folders[idx];
      Object.values(projectTree.folders).forEach(ff => {
        if (Array.isArray(ff.chatIds)) ff.chatIds = ff.chatIds.filter(c => c !== sid);
      });
      if (!f.chatIds) f.chatIds = [];
      if (!f.chatIds.includes(sid)) f.chatIds.push(sid);
      if (typeof saveProjectTree === 'function') saveProjectTree();
      showToast?.('Чат в «'+f.title+'»', 'success');
    });
  };

  // Language
  window.setUiLanguage = function(code){
    localStorage.setItem('oracle_ui_lang', code);
    showToast?.('Язык: '+code+' (применится к новым подписям)', 'success');
    // minimal demo keys
    const dict = {
      ru: {},
      en: { 'Проекты':'Projects', 'Настройки':'Settings', 'Создать проект':'Create project' },
      de: { 'Проекты':'Projekte', 'Настройки':'Einstellungen', 'Создать проект':'Projekt erstellen' }
    };
    window._uiDict = dict[code] || {};
  };

  // New screensaver circles variant
  window.renderTrueBlackCyanCircles = function(root){
    if (!root) return;
    root.innerHTML = '';
    root.style.background = '#000';
    for (let i=0;i<9;i++){
      const c = document.createElement('div');
      c.className = 'ss-circle';
      const size = 40 + Math.random()*120;
      c.style.width = size+'px';
      c.style.height = size+'px';
      c.style.left = Math.random()*90+'%';
      c.style.top = Math.random()*90+'%';
      c.style.animationDelay = (Math.random()*6)+'s';
      root.appendChild(c);
    }
  };

  // Patch setSkillsTab dependency on original panels visibility
  document.addEventListener('DOMContentLoaded', function(){
    // wrap open folder click to project home when possible
    const _rpt = window.renderProjectTree;
    if (typeof _rpt === 'function' && !_rpt._home) {
      window.renderProjectTree = function(){
        const r = _rpt.apply(this, arguments);
        try {
          document.querySelectorAll('#sb-projects-panel [data-folder-id], #sb-projects-panel .folder-item').forEach(el => {
            const id = el.getAttribute('data-folder-id') || el.dataset.folderId;
            if (!id) return;
            el.addEventListener('click', function(ev){
              if (ev.target.closest('button')) return;
              openProjectHome(id);
            }, { once: false });
          });
        } catch(e){}
        return r;
      };
      window.renderProjectTree._home = true;
    }
  });

  console.log('[CN] 2.6.1 pack: swipe, resize, plugins, projects, toggles');
})();



document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){ try { renderProjectTree(); } catch(e){} }, 300);
  setTimeout(function(){ try { renderProjectTree(); } catch(e){} }, 1000);
  document.addEventListener('click', function(e){
    var menu = document.getElementById('project-context-menu');
    if (!menu || menu.hidden) return;
    if (menu.contains(e.target)) return;
    menu.hidden = true; menu.style.display = 'none';
  });
});



(function(){
  function forceShowInput(){
    var box = document.getElementById('main-input-box');
    if (!box) return;
    var onChat = document.body.classList.contains('on-chat-screen') ||
      (!!document.getElementById('screen-chat')?.classList.contains('active-screen'));
    if (!onChat) {
      box.style.display = 'none';
      return;
    }
    box.classList.remove('hidden');
    box.style.display = 'flex';
    box.style.visibility = 'visible';
    box.style.opacity = '1';
    box.style.pointerEvents = 'auto';
    box.style.zIndex = '3000';
    document.body.classList.add('chat-active', 'on-chat-screen');
  }
  function patchModal(){
    if (typeof window.showCustomModal !== 'function') return;
    var _s = window.showCustomModal;
    window.showCustomModal = function(title, text, isPrompt, defaultValue, callback){
      try {
        var modal = document.getElementById('custom-modal');
        if (modal) {
          modal.style.display = 'flex';
          modal.classList.add('active');
        }
      } catch(e){}
      return _s.apply(this, arguments);
    };
  }
  function patchClose(){
    var close = window.closeCustomModal || window.hideCustomModal;
    // ensure cancel/ok hide overlay
    document.addEventListener('click', function(e){
      var t = e.target;
      if (t && t.id === 'custom-modal') {
        // click on backdrop
        try {
          if (typeof closeCustomModal === 'function') closeCustomModal(false);
          else t.classList.remove('active');
        } catch(err){}
      }
    });
  }
  function run(){
    forceShowInput();
    patchModal();
    patchClose();
    // if screen-chat not active, still show input on chat
    try {
      var sc = document.getElementById('screen-chat');
      if (sc && !sc.classList.contains('active-screen')) {
        // don't force if user on settings
      } else {
        forceShowInput();
      }
    } catch(e){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
  setTimeout(run, 100);
  setTimeout(forceShowInput, 500);
})();



(function(){
  function hideAllScreens() {
    document.querySelectorAll('.app-screen').forEach(function(s) {
      s.classList.remove('active-screen');
      s.style.display = 'none';
      s.style.opacity = '0';
      s.style.visibility = 'hidden';
      s.style.pointerEvents = 'none';
    });
  }
  function showScreen(el) {
    if (!el) return;
    el.classList.add('active-screen');
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.pointerEvents = 'auto';
    el.style.zIndex = '20';
    el.style.position = 'relative';
    el.style.minHeight = '60vh';
    el.style.padding = '24px 16px 48px';
    el.style.overflowY = 'auto';
    el.style.background = 'var(--bg, #0a0a0a)';
    el.style.color = 'var(--on-surface, #e8e8e8)';
  }

  window.setSkillsTab = function(tab) {
    tab = tab || 'store';
    document.querySelectorAll('.skills-hub-tab[data-skills-tab]').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-skills-tab') === tab);
    });
    document.querySelectorAll('.skills-panel').forEach(function(p) {
      p.hidden = true;
      p.style.display = 'none';
    });
    var panel = document.getElementById('skills-panel-' + tab);
    if (panel) {
      panel.hidden = false;
      panel.removeAttribute('hidden');
      panel.style.display = 'block';
      panel.style.visibility = 'visible';
      panel.style.opacity = '1';
    }
    try {
      if (tab === 'plugins' && typeof renderPluginsList === 'function') renderPluginsList();
      if (tab === 'skills' && typeof renderSkillsList === 'function') renderSkillsList();
      if (tab === 'store' && typeof renderConnectorsCatalog === 'function') renderConnectorsCatalog();
      if (tab === 'tags' && typeof renderTagsList === 'function') renderTagsList();
    } catch (e) { console.warn(e); }
  };

  window.openAddonsHub = function() {
    try {
      hideAllScreens();
      var sk = document.getElementById('screen-skills');
      if (!sk) {
        console.error('screen-skills not in DOM');
        if (typeof showToast === 'function') showToast('Экран Аддонов не найден', 'error');
        return;
      }
      showScreen(sk);
      document.body.classList.remove('on-chat-screen');
      document.body.classList.add('on-skills-screen');
      var box = document.getElementById('main-input-box');
      if (box) box.style.display = 'none';
      try { if (typeof closeSidebar === 'function') closeSidebar(); } catch(e) {}
      setSkillsTab('store');
      // scroll into view
      try { sk.scrollTop = 0; window.scrollTo(0, 0); } catch(e) {}
    } catch (e) {
      console.error('openAddonsHub fatal', e);
      alert('Аддоны: ' + e.message);
    }
  };

  window.closeSkillsHub = function() {
    try {
      hideAllScreens();
      var chat = document.getElementById('screen-chat');
      showScreen(chat);
      document.body.classList.add('on-chat-screen');
      document.body.classList.remove('on-skills-screen');
      var box = document.getElementById('main-input-box');
      if (box) {
        box.style.display = 'flex';
        box.style.visibility = 'visible';
      }
      if (typeof switchScreen === 'function') {
        // keep state in sync without fighting display
        try {
          document.querySelectorAll('.app-screen').forEach(function(s){ s.classList.remove('active-screen'); });
          if (chat) chat.classList.add('active-screen');
        } catch(e) {}
      }
    } catch (e) { console.error(e); }
  };

  // Patch switchScreen for skills so regular path also works
  var _sw = window.switchScreen;
  if (typeof _sw === 'function') {
    
/* deduped switchScreen wrap */

  }
})();



(function(){
  'use strict';

  function safe(fn, fallback){
    try { return fn(); } catch(e){ console.warn('[CN]', e); return fallback; }
  }

  // ---- Chat title bar ----
  window.updateChatBarTitle = function(){
    var el = document.getElementById('chat-bar-title-text');
    if (!el) return;
    var title = 'Новый чат';
    try {
      var sid = window.currentSessionId;
      if (sid && window.chatSessions && chatSessions[sid] && chatSessions[sid].title)
        title = chatSessions[sid].title;
      else if (document.body.classList.contains('temp-chat-mode') || (window.CoreState && CoreState.isTempChat))
        title = 'Временный чат';
    } catch(e){}
    el.textContent = title;
  };

  
/* deduped: earlier window.toggleChatOptionsMenu removed */


  window.openChatFilesPopover = function(ev){
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    var pop = document.getElementById('chat-files-popover');
    var btn = document.getElementById('chat-session-title-btn');
    if (!pop || !btn) return;
    document.getElementById('chat-options-menu')?.classList.remove('open');
    var list = document.getElementById('chat-files-list');
    var files = [];
    try {
      var sid = window.currentSessionId;
      var sess = window.chatSessions && chatSessions[sid];
      if (sess && Array.isArray(sess.files)) files = sess.files;
      if (sess && Array.isArray(sess.attachments)) files = files.concat(sess.attachments);
      // chips currently attached
      document.querySelectorAll('#attached-files-row .attach-chip, .attach-chip').forEach(function(c){
        files.push({ name: c.textContent.replace(/×|✕|close/gi,'').trim() });
      });
    } catch(e){}
    if (!list) return;
    if (!files.length) {
      list.innerHTML = '<div style="font-size:13px;color:var(--on-surface-variant);padding:8px;">В этом чате пока нет файлов</div>';
    } else {
      list.innerHTML = files.map(function(f){
        var n = (f && (f.name || f.title || f)) || 'Файл';
        return '<div class="chat-file-row"><span class="material-symbols-rounded">draft</span><span>'+String(n).replace(/</g,'&lt;')+'</span></div>';
      }).join('');
    }
    var r = btn.getBoundingClientRect();
    pop.style.top = (r.bottom + 6) + 'px';
    pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - 340)) + 'px';
    pop.classList.add('open');
  };

  function closeBarMenus(){
    document.getElementById('chat-options-menu')?.classList.remove('open');
    document.getElementById('chat-files-popover')?.classList.remove('open');
    document.getElementById('send-context-menu')?.classList.remove('open');
  }
  document.addEventListener('click', function(e){
    if (e.target.closest('#chat-options-menu,#chat-options-btn,#chat-files-popover,#chat-session-title-btn,#send-context-menu')) return;
    closeBarMenus();
  });

  window.cmShareFromBar = function(){ closeBarMenus(); try{ window._ctxSessionId = currentSessionId; cmShare(); }catch(e){ showToast?.('Поделиться недоступно','warning'); } };
  window.cmTogglePinFromBar = function(){ closeBarMenus(); try{ window._ctxSessionId = currentSessionId; cmTogglePin(); updateChatBarTitle(); }catch(e){} };
  window.cmRenameFromBar = function(){ closeBarMenus(); try{ window._ctxSessionId = currentSessionId; cmRename(); setTimeout(updateChatBarTitle, 300); }catch(e){} };
  window.cmMoveToProjectFromBar = function(){ closeBarMenus(); try{ window._ctxSessionId = currentSessionId; cmMoveToProject(); }catch(e){ showToast?.('Нет проектов','info'); } };
  window.cmFeedbackFromBar = function(){
    closeBarMenus();
    if (typeof showCustomModal === 'function') {
      showCustomModal('Отзыв', 'Что улучшить в этом чате?', true, '', function(val){
        if (val) showToast?.('Спасибо! Отзыв сохранён локально','success');
        try {
          var arr = JSON.parse(localStorage.getItem('oracle_feedback')||'[]');
          arr.push({ t: Date.now(), sid: currentSessionId, text: String(val||'') });
          localStorage.setItem('oracle_feedback', JSON.stringify(arr.slice(-50)));
        } catch(e){}
      });
    }
  };
  window.cmCopyIdFromBar = function(){
    closeBarMenus();
    var id = window.currentSessionId || '';
    if (navigator.clipboard && id) navigator.clipboard.writeText(id).then(function(){ showToast?.('ID скопирован','success'); });
    else showToast?.(id || 'Нет ID','info');
  };
  window.cmOpenInTabFromBar = function(){
    closeBarMenus();
    var id = window.currentSessionId || '';
    var url = location.origin + location.pathname + (id ? ('#chat=' + encodeURIComponent(id)) : '');
    window.open(url, '_blank');
  };

  // Keep title in sync
  var _lcs = window.loadChatSession;
  if (typeof _lcs === 'function') {
    window.loadChatSession = function(){
      var r = _lcs.apply(this, arguments);
      setTimeout(updateChatBarTitle, 50);
      return r;
    };
  }
  var _cnc = window.createNewChatSession;
  if (typeof _cnc === 'function') {
    window.createNewChatSession = function(){
      var r = _cnc.apply(this, arguments);
      setTimeout(updateChatBarTitle, 50);
      return r;
    };
  }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(updateChatBarTitle, 200); });

  // ---- Exit split when leaving chat ----
  var _sw = window.switchScreen;
  if (typeof _sw === 'function') {
    
/* deduped switchScreen wrap */

  }

  // ---- Improved split selector ----
  window.openSplitSelector = function(){
    try { document.getElementById('sidebar-archive')?.classList.remove('open'); } catch(e){}
    var modes = [
      { id:'chat-story', title:'Чат + История', desc:'Если история уже открыта — справа выбор чата. Иначе выберите оба.' },
      { id:'chat-notepad', title:'Чат + Notepad', desc:'Кодинг и чат рядом' },
      { id:'dual-chat', title:'Второй чат', desc:'Два одинаковых поля. ПКМ по Отправить → Send to 2 Chats. Live недоступен.' },
      { id:'chat-context', title:'Чат + Контекст', desc:'Контекст текущего чата справа' },
      { id:'chat-maps', title:'Чат + Карты (бета)', desc:'Карта рядом с диалогом' }
    ];
    var html = '<div style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow:auto;">' +
      modes.map(function(m){
        return '<button type="button" class="plus-menu-item" style="border:1px solid var(--border);border-radius:12px;" data-sm="'+m.id+'" onclick="window._splitMode=\''+m.id+'\';document.querySelectorAll(\'[data-sm]\').forEach(b=>b.style.outline=\'\');this.style.outline=\'2px solid var(--primary)\'">' +
          '<div><b>'+m.title+'</b><div style="font-size:12px;color:var(--on-surface-variant);margin-top:2px;">'+m.desc+'</div></div></button>';
      }).join('') +
      '<div style="font-size:12px;color:var(--on-surface-variant);margin-top:8px;">После выбора режима нажмите «Открыть Split». Нужные списки подставятся автоматически.</div></div>';
    if (typeof showCustomModal === 'function') {
      showCustomModal('Параллельный просмотр', html, false, '', function(ok){
        if (!ok) return;
        startSplitByMode(window._splitMode || 'chat-story');
      });
      setTimeout(function(){
        var ok = document.getElementById('custom-modal-ok');
        if (ok) ok.textContent = 'Открыть Split';
      }, 30);
    } else if (typeof enterSplitView === 'function') {
      enterSplitView();
    }
  };

  window.startSplitByMode = function(mode){
    mode = mode || 'chat-story';
    window._splitMode = mode;
    try {
      if (window.CoreState) {
        CoreState.splitMode = mode;
        if (mode === 'dual-chat' && CoreState.isLiveChat && typeof stopLiveChat === 'function') stopLiveChat();
      }
    } catch(e){}
    // ensure screens
    if (typeof enterSplitView === 'function') {
      try { enterSplitView(); } catch(e){ console.warn(e); }
    }
    document.body.classList.toggle('dual-chat', mode === 'dual-chat');
    // right pane content by mode
    try {
      var right = document.getElementById('split-pane-right');
      if (!right) return;
      if (mode === 'chat-maps') {
        var maps = document.getElementById('screen-maps');
        if (maps) { right.innerHTML = ''; right.appendChild(maps); maps.classList.add('active-screen'); maps.style.display='flex'; }
      } else if (mode === 'chat-context') {
        right.innerHTML = '<div style="padding:16px;overflow:auto;height:100%;"><h3 style="margin:0 0 8px;">Контекст</h3><div id="split-context-box" style="white-space:pre-wrap;font-size:13px;color:var(--on-surface-variant);"></div><button type="button" class="modal-btn modal-btn-reject" style="margin-top:12px;" onclick="exitSplitView()">Выйти из Split View</button></div>';
        try {
          var sid = currentSessionId;
          var ctx = (chatSessions && chatSessions[sid] && chatSessions[sid].context) || localStorage.getItem('oracle_ctx_'+sid) || 'Контекст пуст. ИИ дополнит его по ходу диалога.';
          var box = document.getElementById('split-context-box');
          if (box) box.textContent = ctx;
        } catch(e){}
      } else if (mode === 'dual-chat') {
        right.innerHTML = '<div style="display:flex;flex-direction:column;height:100%;padding:12px;gap:8px;"><div id="split-chat2-flow" class="chat-flow-box" style="flex:1;overflow:auto;"></div><div class="glass-input-box" style="position:relative;left:0;right:0;bottom:0;"><textarea id="user-input-2" placeholder="Введите ваш запрос..." style="width:100%;background:transparent;border:none;color:var(--on-surface);resize:none;min-height:24px;font:inherit;"></textarea><div class="input-bottom-bar"><span></span><button type="button" class="send-btn visible" onclick="sendMsgSplit2()"><span class="material-symbols-rounded">send</span></button></div></div><button type="button" class="modal-btn modal-btn-reject" onclick="exitSplitView()">Выйти из Split View</button></div>';
        showToast?.('Live Chat скрыт в режиме двух чатов','info');
      } else if (mode === 'chat-story') {
        // if story already selected - right picks chat; else both
        var hasStory = !!(window.currentStoryId);
        if (hasStory && typeof loadStory === 'function') {
          /* reader already in pane via enterSplitView */
        }
        var footer = document.createElement('button');
        footer.type = 'button';
        footer.className = 'modal-btn modal-btn-reject';
        footer.textContent = 'Выйти из Split View';
        footer.style.cssText = 'position:absolute;bottom:12px;right:12px;z-index:5;';
        footer.onclick = function(){ exitSplitView(); };
        right.style.position = 'relative';
        right.appendChild(footer);
      }
      showToast?.('Split: ' + mode, 'success');
    } catch(e){ console.warn(e); }
  };

  window.sendMsgSplit2 = function(){
    var ta = document.getElementById('user-input-2');
    var text = (ta && ta.value || '').trim();
    if (!text) return;
    var flow = document.getElementById('split-chat2-flow');
    if (flow) {
      var div = document.createElement('div');
      div.className = 'user-msg';
      div.textContent = text;
      flow.appendChild(div);
    }
    if (ta) ta.value = '';
    showToast?.('Сообщение во второй чат (локально)','info');
  };

  window.sendToBothSplitChats = function(){
    closeBarMenus();
    if (typeof sendMsg === 'function') sendMsg();
    sendMsgSplit2();
  };

  // ---- Send button RMB: Дополнить с Live ----
  function bindSendContextMenu(){
    var sendBtn = document.querySelector('.send-btn, #send-btn, button.send-btn');
    if (!sendBtn || sendBtn._cnCtx) return;
    sendBtn._cnCtx = true;
    sendBtn.addEventListener('contextmenu', function(e){
      e.preventDefault();
      var menu = document.getElementById('send-context-menu');
      if (!menu) return;
      var dual = document.body.classList.contains('dual-chat') || (CoreState && CoreState.splitMode === 'dual-chat');
      var both = document.getElementById('send-to-both-item');
      if (both) both.style.display = dual ? 'flex' : 'none';
      menu.style.top = e.clientY + 'px';
      menu.style.left = Math.min(e.clientX, window.innerWidth - 220) + 'px';
      menu.classList.add('open');
    });
  }
  window.sendWithLiveSupplement = function(){
    closeBarMenus();
    if (typeof sendMsg === 'function') sendMsg();
    setTimeout(function(){
      if (typeof startLiveChat === 'function') startLiveChat();
      else if (typeof toggleLiveChat === 'function') toggleLiveChat();
      else showToast?.('Live Chat скоро будет доступен','info');
    }, 400);
  };

  // Idle 5s → Live suggest
  var idleTimer = null;
  function armIdleLiveSuggest(){
    clearTimeout(idleTimer);
    dismissLiveSuggest();
    idleTimer = setTimeout(function(){
      if (CoreState && CoreState.isLiveChat) return;
      if (document.body.classList.contains('dual-chat')) return;
      var input = document.getElementById('user-input');
      if (input && input.value && input.value.trim()) return; // only when not typing content recently
      var toast = document.getElementById('live-suggest-toast');
      if (toast) toast.classList.add('show');
    }, 5000);
  }
  window.dismissLiveSuggest = function(){
    document.getElementById('live-suggest-toast')?.classList.remove('show');
  };
  window.acceptLiveSuggest = function(){
    dismissLiveSuggest();
    if (typeof startLiveChat === 'function') startLiveChat();
    else if (typeof toggleLiveChat === 'function') toggleLiveChat();
    else showToast?.('Live Chat','info');
  };
  document.addEventListener('DOMContentLoaded', function(){
    bindSendContextMenu();
    var input = document.getElementById('user-input');
    if (input) {
      input.addEventListener('input', function(){
        clearTimeout(idleTimer);
        dismissLiveSuggest();
        // re-arm only when field becomes empty again
        if (!input.value.trim()) armIdleLiveSuggest();
      });
      input.addEventListener('focus', function(){ if (!input.value.trim()) armIdleLiveSuggest(); });
    }
    setTimeout(bindSendContextMenu, 1000);
  });

  // ---- Plugins catalog expansion ----
  window.renderPluginsList = function(){
    var box = document.getElementById('plugins-list');
    if (!box) return;
    var plugins = [
      { id:'fast-bridge', name:'Fast Assistant Bridge', desc:'Связка чатов с Fast Assistant', on:true, badge:'NEW' },
      { id:'web-search', name:'Web Search Lite', desc:'Поиск по открытым источникам', on:false },
      { id:'translate', name:'Quick Translate', desc:'Быстрый перевод фрагментов', on:false },
      { id:'code-runner', name:'Code Runner Sandbox', desc:'Песочница для JS-сниппетов', on:false },
      { id:'markdown-export', name:'Markdown Export', desc:'Экспорт чата в .md', on:true },
      { id:'voice-notes', name:'Voice Notes', desc:'Голосовые заметки в библиотеку', on:false },
      { id:'calendar-sync', name:'Calendar Sync', desc:'Связка с Планами Core Node', on:false },
      { id:'image-describe', name:'Image Describe', desc:'Описание вложений-картинок', on:false },
      { id:'notion-like', name:'Blocks Mirror', desc:'Карточки CNUI в стиле блоков', on:false },
      { id:'privacy-scrub', name:'Privacy Scrub', desc:'Маскирует emails/телефоны в ответах', on:false }
    ];
    try {
      var saved = JSON.parse(localStorage.getItem('oracle_plugins_state')||'{}');
      plugins.forEach(function(p){ if (saved[p.id] != null) p.on = !!saved[p.id]; });
    } catch(e){}
    var q = (document.getElementById('plugins-search') && document.getElementById('plugins-search').value || '').toLowerCase();
    var filtered = plugins.filter(function(p){ return !q || (p.name+p.desc).toLowerCase().indexOf(q)>=0; });
    box.innerHTML = '<input id="plugins-search" placeholder="Поиск плагинов…" style="width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:var(--surface-variant);color:var(--on-surface);margin-bottom:12px;" oninput="renderPluginsList()">' +
      filtered.map(function(p){
        return '<div class="plugin-row" style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;">' +
          '<span class="material-symbols-rounded">extension</span>' +
          '<div class="plugin-meta" style="flex:1;min-width:0;"><div class="plugin-name" style="font-weight:600;">'+p.name+(p.badge?' <span style="font-size:10px;color:var(--primary);">'+p.badge+'</span>':'')+'</div>' +
          '<div style="font-size:12px;color:var(--on-surface-variant);">'+p.desc+'</div></div>' +
          '<button type="button" class="modal-btn" style="padding:6px 10px;font-size:12px;" onclick="togglePlugin(\''+p.id+'\','+(!p.on)+')">'+(p.on?'Включён':'Выкл')+'</button></div>';
      }).join('');
  };
  window.togglePlugin = function(id, on){
    try {
      var saved = JSON.parse(localStorage.getItem('oracle_plugins_state')||'{}');
      saved[id] = !!on;
      localStorage.setItem('oracle_plugins_state', JSON.stringify(saved));
    } catch(e){}
    renderPluginsList();
    showToast?.(on ? 'Плагин включён' : 'Плагин выключен', 'success');
  };

  // ---- @ popup: connectors + skills + tags + plugins; / and : toast ----
  var _handleInput = window.handleInput;
  window.handleInput = function(e){
    try {
      var v = (e && e.target && e.target.value) || (document.getElementById('user-input')||{}).value || '';
      var last = v.slice(-1);
      if (last === '/' || last === ':') {
        showToast?.('Теперь введите @ — там коннекторы, навыки, теги и плагины', 'info');
      }
    } catch(err){}
    if (typeof _handleInput === 'function') return _handleInput.apply(this, arguments);
  };

  // Expand mention dropdown if present
  window.renderMentionPalette = function(){
    var host = document.getElementById('mention-palette') || document.getElementById('at-popup');
    if (!host) return;
    host.innerHTML = '<div class="plus-menu-label">Коннекторы</div>' +
      ['@plan','@keep','@code','@ContentCheck'].map(function(x){ return '<button type="button" class="plus-menu-item" onclick="insertMention(\''+x+'\')">'+x+'</button>'; }).join('') +
      '<div class="plus-menu-label">Навыки</div>' +
      ['/summary','/translate','/fix'].map(function(x){ return '<button type="button" class="plus-menu-item" onclick="insertMention(\''+x+'\')">'+x+'</button>'; }).join('') +
      '<div class="plus-menu-label">Теги</div>' +
      [':кратко',':подробно',':дружелюбно'].map(function(x){ return '<button type="button" class="plus-menu-item" onclick="insertMention(\''+x+'\')">'+x+'</button>'; }).join('') +
      '<div class="plus-menu-label">Плагины</div>' +
      ['@plugin:web-search','@plugin:translate'].map(function(x){ return '<button type="button" class="plus-menu-item" onclick="insertMention(\''+x+'\')">'+x+'</button>'; }).join('');
  };
  window.insertMention = function(text){
    var input = document.getElementById('user-input');
    if (!input) return;
    input.value = (input.value || '').replace(/[@\/:][^\s]*$/, '') + text + ' ';
    input.focus();
    document.getElementById('mention-palette')?.classList.remove('open');
  };

  // ---- Screenwriter analysis label ----
  window.getAnalysisLabel = function(){
    try {
      if (localStorage.getItem('oracle_screenwriter_mode') === '1' || document.body.classList.contains('screenwriter-mode'))
        return 'Answer of Planned Text';
    } catch(e){}
    return 'Анализ';
  };

  // ---- Sidebar menu settings radio (basic) ----
  window.renderSidebarMenuSettings = function(){
    var host = document.getElementById('section-sidebar-menu');
    if (!host) return;
    if (host.querySelector('#sb-menu-radio-pack')) return;
    var pack = document.createElement('div');
    pack.id = 'sb-menu-radio-pack';
    // native sb-mode pack removed — UI lives in section-sidebar-menu (custom segmented)
    return;
  };
  // setSbMenuMode / setSbBtnScale defined in cn-settings-home-js

  // ---- Stability: wrap risky globals ----
  ['sendMsg','enterSplitView','exitSplitView','openAddonsHub','showSection'].forEach(function(name){
    var fn = window[name];
    if (typeof fn !== 'function' || fn._cnSafe) return;
    window[name] = function(){
      try { return fn.apply(this, arguments); }
      catch(e){ console.error(name, e); try{ showToast?.(name+' ошибка','error'); }catch(_){ } }
    };
    window[name]._cnSafe = true;
  });

  // init
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(updateChatBarTitle, 100);
    setTimeout(bindSendContextMenu, 300);
    setTimeout(function(){ try{ renderSidebarMenuSettings(); }catch(e){} }, 500);
    document.body.classList.add('on-chat-screen');
  });

  console.log('[CN] ux-pack-261 loaded');
})();



(function(){
  // unwrap safe wrapper if it broke showSection
  var tries = 0;
  function ensure(){
    tries++;
    if (typeof window.showSection !== 'function') return;
    // re-bind nav buttons in case listeners died
    document.querySelectorAll('[id^="btn-sec-"]').forEach(function(btn){
      if (btn._cnBound) return;
      btn._cnBound = true;
      btn.addEventListener('click', function(e){
        e.preventDefault();
        var id = btn.id.replace(/^btn-sec-/, '');
        try { showSection(id); } catch(err){ console.error(err); }
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure);
  else ensure();
  setTimeout(ensure, 500);
  // clear stuck search overlay that hides content
  setTimeout(function(){
    try {
      document.getElementById('screen-settings')?.classList.remove('searching-mobile');
      document.getElementById('settings-sidebar-menu')?.classList.remove('searching');
    } catch(e){}
  }, 0);
})();


/* A+B: body screen class sync for input visibility */
(function() {
  var _sw = window.switchScreen;
  if (typeof _sw !== 'function' || _sw._abStable) return;
  window.switchScreen = function(screenName) {
    var r = _sw.apply(this, arguments);
    try {
      var name = String(screenName || '').replace(/^screen-/, '');
      document.body.classList.toggle('on-chat-screen', name === 'chat');
      document.body.classList.toggle('on-settings-screen', name === 'settings');
      document.body.classList.toggle('on-skills-screen', name === 'skills');
      document.body.classList.toggle('on-reader-screen', name === 'reader');
      // if leaving settings, drop drill
      if (name !== 'settings') {
        document.getElementById('screen-settings')?.classList.remove('settings-drill');
      }
      // default section when opening settings
      if (name === 'settings' && typeof showSection === 'function') {
        var open = document.querySelector('.setting-section.section-visible');
        if (!open || open.style.display === 'none') showSection('general');
      }
    } catch (e) {}
    return r;
  };
  window.switchScreen._abStable = true;
})();


document.addEventListener('DOMContentLoaded', function() {
  try {
    if (document.getElementById('screen-chat')?.classList.contains('active-screen')) {
      document.body.classList.add('on-chat-screen');
    }
    // repair about if still broken at runtime
    var about = document.getElementById('section-about');
    var root = document.getElementById('settings-content');
    if (about && root && about.parentElement !== root) {
      root.appendChild(about);
    }
    // start with general visible
    document.querySelectorAll('.setting-section').forEach(function(el, idx) {
      if (el.id === 'section-general') {
        el.style.display = 'block';
        el.classList.add('section-visible');
      } else {
        el.style.display = 'none';
        el.classList.remove('section-visible');
      }
    });
  } catch (e) {}
});



/* removed: Empty chat chrome pack (merged into unified) */



/* ===== Theme modes: system / light / dark + shades ===== */
(function themeModes261() {
  function prefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function clearShadeClasses() {
    document.body.classList.remove('dark-shade-0f', 'dark-shade-05', 'dark-shade-00', 'true-black-theme');
  }
  function applyShade(shade) {
    clearShadeClasses();
    if (shade === '0f') document.body.classList.add('dark-shade-0f');
    else if (shade === '05') document.body.classList.add('dark-shade-05');
    else {
      document.body.classList.add('dark-shade-00', 'true-black-theme');
      shade = '00';
    }
    localStorage.setItem('oracle_dark_shade', shade);
    document.querySelectorAll('.dark-shade-swatch').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-shade') === shade);
    });
  }
  window.setDarkShade = function(shade) {
    if (document.body.classList.contains('light-theme')) return;
    applyShade(shade || '0f');
    if (typeof applyVisualTheme === 'function') {
      try { applyVisualTheme(); } catch (e) {}
    }
  };
  window.setThemeMode = function(mode) {
    mode = mode || 'system';
    localStorage.setItem('oracle_theme_mode', mode);
    var wrap = document.getElementById('dark-shade-wrap');
    document.querySelectorAll('.theme-mode-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    var btn = document.getElementById('theme-btn-' + (mode === 'system' ? 'system' : mode));
    if (btn) btn.classList.add('active');

    if (mode === 'light') {
      document.body.classList.add('light-theme');
      clearShadeClasses();
      if (wrap) wrap.hidden = true;
    } else if (mode === 'dark') {
      document.body.classList.remove('light-theme');
      if (wrap) wrap.hidden = false;
      applyShade(localStorage.getItem('oracle_dark_shade') || '0f');
    } else {
      // system
      if (prefersDark()) {
        document.body.classList.remove('light-theme');
        if (wrap) wrap.hidden = false;
        applyShade(localStorage.getItem('oracle_dark_shade') || '0f');
      } else {
        document.body.classList.add('light-theme');
        clearShadeClasses();
        if (wrap) wrap.hidden = true;
      }
    }
    // legacy keys
    localStorage.setItem('oracle_light_theme', document.body.classList.contains('light-theme') ? 'true' : 'false');
    localStorage.setItem('oracle_true_black', document.body.classList.contains('true-black-theme') ? 'true' : 'false');
    if (typeof applyVisualTheme === 'function') {
      try { applyVisualTheme(); } catch (e) {}
    }
  };

  function bootTheme() {
    var mode = localStorage.getItem('oracle_theme_mode');
    if (!mode) {
      if (localStorage.getItem('oracle_light_theme') === 'true') mode = 'light';
      else if (localStorage.getItem('oracle_true_black') === 'true') { mode = 'dark'; localStorage.setItem('oracle_dark_shade', '00'); }
      else mode = 'system';
    }
    setThemeMode(mode);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootTheme);
  else bootTheme();
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
      if (localStorage.getItem('oracle_theme_mode') === 'system') setThemeMode('system');
    });
  } catch (e) {}
})();

/* Neutralize Halloween theme side-effects (keep silent no-op answers optional) */
(function scrubHalloween() {
  window.applyHalloweenTheme = function() { /* removed */ };
  window.clearHalloweenIfThemeChange = function() {
    try {
      document.body.classList.remove('halloween-mode');
      localStorage.removeItem('oracle_halloween_mode');
    } catch (e) {}
  };
  try {
    document.body.classList.remove('halloween-mode');
    localStorage.removeItem('oracle_halloween_mode');
  } catch (e) {}
})();


/* ===== Unified chat top bar (no ghost, correct empty/active) ===== */
(function unifiedChatChrome() {
  function isStandalonePwa() {
    return window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
  }
  function chatHasMessages() {
    const flow = document.getElementById('chat-flow');
    if (!flow) return false;
    if (flow.querySelector('.msg, .user-msg, .ai-msg, .msg-user, .msg-ai, .message')) return true;
    return (flow.innerText || '').trim().length > 0;
  }

  window.syncEmptyChatLayout = function() {
    const onChat = !!document.getElementById('screen-chat')?.classList.contains('active-screen');
    const temp = !!(window.CoreState && CoreState.isTempChat) || document.body.classList.contains('temp-chat-mode');
    const empty = onChat && (!chatHasMessages() || (temp && !CoreState.tempHasMessages));
    document.body.classList.toggle('empty-chat', !!empty);
    document.body.classList.toggle('on-chat-screen', onChat);

    if (isStandalonePwa()) document.body.classList.add('is-pwa-standalone');

    const chrome = document.getElementById('empty-chat-chrome');
    if (chrome) {
      chrome.hidden = !empty;
      if (empty) chrome.style.display = 'flex';
    }

    const bar = document.getElementById('chat-session-bar');
    if (bar) {
      if (!onChat || empty) {
        bar.style.display = 'none';
      } else {
        bar.style.display = 'flex';
      }
    }

    // never show ghost
    const ghost = document.getElementById('ghost-action-bar');
    if (ghost) { ghost.hidden = true; ghost.style.display = 'none'; }

    const tip = document.getElementById('temp-chat-tip');
    if (tip) {
      const dismissed = localStorage.getItem('oracle_temp_tip_dismissed') === '1';
      const temp = document.body.classList.contains('temp-chat-mode');
      tip.hidden = !empty || dismissed || temp;
    }

    const title = document.getElementById('chat-bar-title-text');
    if (title && !empty) {
      try {
        const id = typeof currentSessionId !== 'undefined' ? currentSessionId : null;
        const sessions = typeof chatSessions !== 'undefined' ? chatSessions : {};
        if (id && sessions[id] && sessions[id].title) title.textContent = sessions[id].title;
      } catch (e) {}
    }
  };

  window.toggleChatOptionsMenu = function(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const menu = document.getElementById('chat-options-menu');
    if (!menu) return;
    const open = !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    if (open) {
      const x = e && e.clientX != null ? e.clientX : window.innerWidth - 24;
      const y = e && e.clientY != null ? e.clientY : 56;
      const w = 240;
      menu.style.left = Math.max(8, Math.min(x - 40, window.innerWidth - w - 8)) + 'px';
      menu.style.top = Math.min(y + 8, window.innerHeight - 280) + 'px';
    }
  };

  document.addEventListener('click', function(ev) {
    const menu = document.getElementById('chat-options-menu');
    if (!menu || !menu.classList.contains('open')) return;
    if (menu.contains(ev.target)) return;
    if (ev.target.closest('#chat-options-btn, #empty-chat-chrome .ecc-icon')) return;
    menu.classList.remove('open');
  });

  window.cmProtectChatFromBar = function() {
    document.getElementById('chat-options-menu')?.classList.remove('open');
    if (typeof showCustomModal === 'function') {
      showCustomModal(
        'Защитить чат',
        'Защита чата (PIN / скрытие содержимого) будет полностью доступна в следующем обновлении. Сейчас можно включить PIN в Настройки → Безопасность.',
        false
      );
    } else if (typeof showToast === 'function') {
      showToast('Защита чата — в настройках безопасности', 'info');
    }
  };

  // Prefer rename label
  const _rename = window.cmRenameFromBar;
  // ensure move label exists
  if (typeof window.cmMoveToProjectFromBar !== 'function' && typeof window.cmMoveToFolder === 'function') {
    window.cmMoveToProjectFromBar = function() {
      document.getElementById('chat-options-menu')?.classList.remove('open');
      window.cmMoveToFolder();
    };
  }

  function boot() {
    syncEmptyChatLayout();
    const flow = document.getElementById('chat-flow');
    if (flow && window.MutationObserver) {
      new MutationObserver(function() { syncEmptyChatLayout(); }).observe(flow, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  ['switchScreen', 'createNewChatSession', 'loadChatSession', 'enterTempChat', 'exitTempChat', 'sendMsg'].forEach(function(name) {
    const prev = window[name];
    if (typeof prev !== 'function' || prev._unifiedChrome) return;
    window[name] = function() {
      const r = prev.apply(this, arguments);
      setTimeout(syncEmptyChatLayout, 40);
      return r;
    };
    window[name]._unifiedChrome = true;
  });
})();


/* ===== Restored essentials after dedupe (single copy) ===== */
window.promptPwaInstall = async function() {
  try {
    if (window._deferredPwaPrompt) {
      window._deferredPwaPrompt.prompt();
      await window._deferredPwaPrompt.userChoice.catch(function(){});
      window._deferredPwaPrompt = null;
      return;
    }
  } catch (e) {}
  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) {
    if (typeof showToast === 'function') showToast('Приложение уже установлено', 'info');
    return;
  }
  var msg = isIos
    ? 'На iOS: «Поделиться» → «На экран „Домой“».'
    : 'В меню браузера: «Установить приложение». Если пункта нет — PWA уже стоит или браузер не поддерживает.';
  if (typeof showCustomModal === 'function') showCustomModal('Скачать Core Node', msg);
  else if (typeof showToast === 'function') showToast(msg, 'info');
};
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  window._deferredPwaPrompt = e;
});

window.dismissTempChatTip = function() {
  try { localStorage.setItem('oracle_temp_tip_dismissed', '1'); } catch (e) {}
  var tip = document.getElementById('temp-chat-tip');
  if (tip) tip.hidden = true;
};

window.openUltraStub = window.openUltraStub || function() {
  if (typeof showCustomModal === 'function') {
    showCustomModal('Core Node Ultra', 'Тариф Ultra появится позже. Сейчас доступен Core Node PRO.');
  } else if (typeof showToast === 'function') showToast('Ultra — скоро', 'info');
};

window.eccNewChatMenu = window.eccNewChatMenu || function(e) {
  if (e) e.stopPropagation();
  var menu = document.getElementById('ecc-new-menu');
  if (menu) menu.hidden = !menu.hidden;
};
window.hideEccMenus = window.hideEccMenus || function() {
  var menu = document.getElementById('ecc-new-menu');
  if (menu) menu.hidden = true;
};


/* ===== Three-dots menu HARD FIX ===== */
(function threeDotsFix() {
  function menuEl() { return document.getElementById('chat-options-menu'); }

  window.closeBarMenus = function() {
    var m = menuEl();
    if (m) {
      m.classList.remove('open');
      m.style.display = 'none';
    }
    var ecc = document.getElementById('ecc-new-menu');
    if (ecc) ecc.hidden = true;
  };

  window.toggleChatOptionsMenu = function(e) {
    if (e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (err) {}
    }
    var menu = menuEl();
    if (!menu) {
      console.warn('chat-options-menu missing');
      return;
    }
    var willOpen = !menu.classList.contains('open');
    // close others
    document.querySelectorAll('#context-menu, #ecc-new-menu').forEach(function(n) {
      if (n.id === 'ecc-new-menu') n.hidden = true;
      else n.style.display = 'none';
    });

    if (!willOpen) {
      menu.classList.remove('open');
      menu.style.display = 'none';
      return;
    }

    // position near button
    var btn = (e && e.currentTarget) || document.getElementById('chat-options-btn');
    var rect = btn && btn.getBoundingClientRect ? btn.getBoundingClientRect() : null;
    var w = 250;
    var left, top;
    if (rect) {
      left = Math.min(rect.right - w, window.innerWidth - w - 8);
      left = Math.max(8, left);
      top = rect.bottom + 6;
      if (top + 320 > window.innerHeight) top = Math.max(8, rect.top - 320);
    } else {
      left = window.innerWidth - w - 16;
      top = 56;
    }
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    menu.classList.add('open');
    menu.style.display = 'flex';
    menu.style.visibility = 'visible';
    menu.style.pointerEvents = 'auto';
    menu.style.zIndex = '20000';
  };

  // Bind click on ⋮ even if onclick attr fails
  function bindBtn() {
    ['chat-options-btn'].forEach(function(id) {
      var b = document.getElementById(id);
      if (!b || b._dotsBound) return;
      b._dotsBound = true;
      b.addEventListener('click', function(ev) {
        window.toggleChatOptionsMenu(ev);
      });
    });
    // empty chrome last icon is more_vert
    document.querySelectorAll('#empty-chat-chrome .ecc-icon').forEach(function(b) {
      if (b._dotsBound) return;
      var icon = b.querySelector('.material-symbols-rounded');
      if (!icon || icon.textContent.trim() !== 'more_vert') return;
      b._dotsBound = true;
      b.addEventListener('click', function(ev) {
        window.toggleChatOptionsMenu(ev);
      });
    });
  }

  // Outside click closes
  document.addEventListener('click', function(ev) {
    var menu = menuEl();
    if (!menu || !menu.classList.contains('open')) return;
    if (menu.contains(ev.target)) return;
    if (ev.target.closest('#chat-options-btn')) return;
    if (ev.target.closest('#empty-chat-chrome .ecc-icon')) return;
    window.closeBarMenus();
  }, true);

  // Ensure bar handlers exist and close menu
  function ensure(name, fn) {
    if (typeof window[name] !== 'function') window[name] = fn;
  }
  ensure('cmShareFromBar', function() {
    closeBarMenus();
    try {
      window._ctxSessionId = window.currentSessionId;
      if (typeof cmShare === 'function') cmShare();
      else if (typeof showToast === 'function') showToast('Поделиться недоступно', 'warning');
    } catch (e) { showToast?.('Поделиться недоступно', 'warning'); }
  });
  ensure('cmTogglePinFromBar', function() {
    closeBarMenus();
    try {
      window._ctxSessionId = window.currentSessionId;
      if (typeof cmTogglePin === 'function') cmTogglePin();
      else showToast?.('Закрепление недоступно', 'info');
    } catch (e) {}
  });
  ensure('cmRenameFromBar', function() {
    closeBarMenus();
    try {
      window._ctxSessionId = window.currentSessionId;
      if (typeof cmRename === 'function') cmRename();
      else if (typeof showCustomModal === 'function') {
        var cur = (document.getElementById('chat-bar-title-text') || {}).textContent || 'Чат';
        showCustomModal('Переименовать чат', 'Новое имя', true, cur, function(ok, name) {
          if (!ok || !name) return;
          try {
            if (window.currentSessionId && window.chatSessions && chatSessions[currentSessionId]) {
              chatSessions[currentSessionId].title = String(name).trim();
              localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
              var t = document.getElementById('chat-bar-title-text');
              if (t) t.textContent = String(name).trim();
              if (typeof renderSidebarChats === 'function') renderSidebarChats();
              if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
            }
          } catch (err) {}
        });
      }
    } catch (e) {}
  });
  ensure('cmMoveToProjectFromBar', function() {
    closeBarMenus();
    try {
      window._ctxSessionId = window.currentSessionId;
      if (typeof cmMoveToProject === 'function') cmMoveToProject();
      else if (typeof cmMoveToFolder === 'function') cmMoveToFolder();
      else showToast?.('Проекты недоступны', 'info');
    } catch (e) { showToast?.('Нет проектов', 'info'); }
  });
  ensure('cmProtectChatFromBar', function() {
    closeBarMenus();
    if (typeof showCustomModal === 'function') {
      showCustomModal('Защитить чат', 'Включите PIN в Настройки → Безопасность. Полная защита чата — в следующем обновлении.');
    } else showToast?.('См. Настройки → Безопасность', 'info');
  });
  ensure('cmCopyIdFromBar', function() {
    closeBarMenus();
    var id = window.currentSessionId || '';
    if (navigator.clipboard && id) {
      navigator.clipboard.writeText(id).then(function() { showToast?.('ID скопирован', 'success'); });
    } else showToast?.(id || 'Нет ID', 'info');
  });
  ensure('cmOpenInTabFromBar', function() {
    closeBarMenus();
    var id = window.currentSessionId || '';
    var url = location.origin + location.pathname + (id ? ('#chat=' + encodeURIComponent(id)) : '');
    window.open(url, '_blank');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindBtn);
  else bindBtn();
  setTimeout(bindBtn, 500);
})();


/* ===== Chat bars + ⋮ menu full fix ===== */
(function chatBarsAndMenu() {
  function $(id) { return document.getElementById(id); }

  function chatHasMessages() {
    var flow = $('chat-flow');
    if (!flow) return false;
    if (flow.querySelector('.msg,.user-msg,.ai-msg,.msg-user,.msg-ai,.message')) return true;
    return (flow.innerText || '').trim().length > 0;
  }

  window.syncEmptyChatLayout = function() {
    var onChat = !!$('screen-chat')?.classList.contains('active-screen');
    var empty = onChat && !chatHasMessages();
    document.body.classList.toggle('empty-chat', !!empty);
    document.body.classList.toggle('on-chat-screen', onChat);

    var chrome = $('empty-chat-chrome');
    if (chrome) {
      if (empty && onChat) {
        chrome.hidden = false;
        chrome.style.display = 'flex';
      } else {
        chrome.hidden = true;
        chrome.style.display = 'none';
      }
    }
    var bar = $('chat-session-bar');
    if (bar) {
      if (onChat && !empty) {
        bar.style.display = 'flex';
        bar.style.visibility = 'visible';
      } else {
        bar.style.display = 'none';
      }
    }
    // hide ghost forever
    var g = $('ghost-action-bar');
    if (g) { g.hidden = true; g.style.display = 'none'; }

    var tip = $('temp-chat-tip');
    if (tip) {
      var dismissed = false;
      try { dismissed = localStorage.getItem('oracle_temp_tip_dismissed') === '1'; } catch(e) {}
      tip.hidden = !empty || dismissed || document.body.classList.contains('temp-chat-mode');
    }
    try {
      if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
        document.body.classList.add('is-pwa-standalone');
      }
    } catch(e) {}
  };

  window.closeBarMenus = function() {
    var m = $('chat-options-menu');
    if (m) {
      m.classList.remove('open');
      m.style.display = 'none';
    }
    var sub = $('ctx-project-submenu');
    if (sub) sub.classList.remove('open');
    var ecc = $('ecc-new-menu');
    if (ecc) ecc.hidden = true;
  };

  window.toggleChatOptionsMenu = function(e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); } catch(err) {} }
    var menu = $('chat-options-menu');
    if (!menu) return;
    var open = !menu.classList.contains('open');
    closeBarMenus();
    if (!open) return;

    fillProjectSubmenu();
    updatePinLabel();

    var btn = (e && (e.currentTarget || e.target)) || $('chat-options-btn') || $('ecc-more-btn');
    if (btn && btn.closest) btn = btn.closest('button') || btn;
    var rect = btn && btn.getBoundingClientRect ? btn.getBoundingClientRect() : { right: window.innerWidth - 16, bottom: 48, top: 12, left: window.innerWidth - 48 };
    var w = 260;
    var left = Math.max(8, Math.min(rect.right - w, window.innerWidth - w - 8));
    var top = rect.bottom + 6;
    if (top + 280 > window.innerHeight) top = Math.max(8, rect.top - 280);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.right = 'auto';
    menu.style.display = 'flex';
    menu.classList.add('open');
  };

  function updatePinLabel() {
    var lab = $('chat-bar-pin-label');
    if (!lab) return;
    try {
      var id = window.currentSessionId;
      var pinned = false;
      if (id && window.chatSessions && chatSessions[id]) pinned = !!chatSessions[id].pinned;
      lab.textContent = pinned ? 'Открепить' : 'Закрепить';
    } catch(e) { lab.textContent = 'Закрепить'; }
  }

  function fillProjectSubmenu() {
    var sub = $('ctx-project-submenu');
    if (!sub) return;
    var folders = [];
    try {
      var tree = JSON.parse(localStorage.getItem('oracle_project_tree_v2') || '{}') || {};
      folders = tree.folders || [];
    } catch(e) {}
    if (!folders.length) {
      sub.innerHTML = '<button type="button" onclick="cmCreateProjectAndMove()">+ Создать проект</button>';
      return;
    }
    sub.innerHTML = folders.map(function(f) {
      var id = f.id || f.name;
      var name = (f.name || 'Проект').replace(/</g, '&lt;');
      return '<button type="button" onclick="cmMoveChatToProject(\'' + String(id).replace(/'/g, "\\'") + '\')">' + name + '</button>';
    }).join('') + '<button type="button" onclick="cmCreateProjectAndMove()">+ Новый проект</button>';
  }

  // Hover submenu on desktop
  document.addEventListener('mouseover', function(e) {
    var item = e.target.closest && e.target.closest('#ctx-move-project-item');
    if (item) fillProjectSubmenu();
  });

  window.cmShareFromBar = function() {
    closeBarMenus();
    var id = window.currentSessionId || ('session_' + Date.now());
    var link = location.origin + location.pathname.replace(/\/[^/]*$/, '/') + 'public-chat/' + encodeURIComponent(id);
    var input = $('share-link-input');
    if (input) input.value = link;
    var modal = $('share-result-modal');
    if (modal) modal.classList.add('active');
    else if (typeof showCustomModal === 'function') {
      showCustomModal('Ссылка на чат', 'Скопируйте и отправьте. Вы управляете доступом.<br><br><code style="word-break:break-all">' + link + '</code>');
    }
    try {
      var map = JSON.parse(localStorage.getItem('oracle_public_links') || '{}') || {};
      map[id] = { url: link, created: Date.now(), active: true };
      localStorage.setItem('oracle_public_links', JSON.stringify(map));
    } catch(e) {}
  };
  window.copyShareLink = function() {
    var input = $('share-link-input');
    var v = input ? input.value : '';
    if (navigator.clipboard && v) navigator.clipboard.writeText(v).then(function(){ showToast?.('Ссылка скопирована','success'); });
  };
  window.closeShareResult = function() {
    $('share-result-modal')?.classList.remove('active');
  };
  window.blockShareLink = function() {
    try {
      var id = window.currentSessionId;
      var map = JSON.parse(localStorage.getItem('oracle_public_links') || '{}') || {};
      if (id && map[id]) { map[id].active = false; localStorage.setItem('oracle_public_links', JSON.stringify(map)); }
    } catch(e) {}
    showToast?.('Ссылка заблокирована','warning');
    closeShareResult();
  };

  window.cmTogglePinFromBar = function() {
    closeBarMenus();
    try {
      var id = window.currentSessionId;
      if (!id) { showToast?.('Сначала отправьте сообщение','info'); return; }
      if (!window.chatSessions) window.chatSessions = {};
      if (!chatSessions[id]) chatSessions[id] = { title: 'Чат', html: '' };
      chatSessions[id].pinned = !chatSessions[id].pinned;
      localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
      showToast?.(chatSessions[id].pinned ? 'Чат закреплён' : 'Чат откреплён', 'success');
      if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
      if (typeof renderSidebarChats === 'function') renderSidebarChats();
      updatePinLabel();
    } catch(e) { showToast?.('Не удалось закрепить','warning'); }
  };

  window.cmRenameFromBar = function() {
    closeBarMenus();
    var id = window.currentSessionId;
    var cur = 'Чат';
    try {
      if (id && chatSessions && chatSessions[id]) cur = chatSessions[id].title || cur;
    } catch(e) {}
    var t = $('chat-bar-title-text');
    if (t && t.textContent) cur = t.textContent;
    function apply(name) {
      if (!name || !String(name).trim()) return;
      name = String(name).trim();
      try {
        if (!id) id = 'session_' + Date.now();
        if (!window.chatSessions) window.chatSessions = {};
        if (!chatSessions[id]) chatSessions[id] = { title: name, html: ($('chat-flow')||{}).innerHTML || '' };
        else chatSessions[id].title = name;
        window.currentSessionId = id;
        localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
        localStorage.setItem('oracle_current_session', id);
        if (t) t.textContent = name;
        if (typeof renderSidebarChats === 'function') renderSidebarChats();
        if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
        showToast?.('Чат переименован','success');
      } catch(e) {}
    }
    if (typeof showCustomModal === 'function') {
      showCustomModal('Переименовать чат', 'Новое имя чата', true, cur, function(ok, val) {
        // support both (ok,val) and (val) callback styles
        if (ok === false) return;
        var name = (typeof ok === 'string') ? ok : val;
        if (ok === true || typeof ok === 'string') apply(name);
      });
    } else {
      var n = prompt('Переименовать чат', cur);
      if (n) apply(n);
    }
  };

  window.cmMoveChatToProject = function(projectId) {
    closeBarMenus();
    var sid = window.currentSessionId;
    if (!sid) { showToast?.('Нет активного чата','info'); return; }
    try {
      var tree = JSON.parse(localStorage.getItem('oracle_project_tree_v2') || '{}') || {};
      tree.folders = tree.folders || [];
      tree.chatToFolder = tree.chatToFolder || {};
      tree.chatToFolder[sid] = projectId;
      localStorage.setItem('oracle_project_tree_v2', JSON.stringify(tree));
      showToast?.('Чат перемещён в проект','success');
      if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
    } catch(e) { showToast?.('Ошибка перемещения','warning'); }
  };

  window.cmCreateProjectAndMove = function() {
    closeBarMenus();
    function go(name) {
      if (!name) return;
      try {
        var tree = JSON.parse(localStorage.getItem('oracle_project_tree_v2') || '{}') || {};
        tree.folders = tree.folders || [];
        var id = 'proj_' + Date.now();
        tree.folders.push({ id: id, name: String(name).trim(), icon: 'folder' });
        localStorage.setItem('oracle_project_tree_v2', JSON.stringify(tree));
        cmMoveChatToProject(id);
      } catch(e) {}
    }
    if (typeof showCustomModal === 'function') {
      showCustomModal('Новый проект', 'Название проекта', true, '', function(ok, val) {
        if (ok === false) return;
        go(typeof ok === 'string' ? ok : val);
      });
    } else {
      var n = prompt('Название проекта');
      if (n) go(n);
    }
  };

  window.cmMoveToProjectFromBar = function() {
    // open menu focus submenu
    fillProjectSubmenu();
    var sub = $('ctx-project-submenu');
    if (sub) sub.classList.add('open');
  };

  window.cmProtectChatFromBar = function() {
    closeBarMenus();
    var pin = null;
    try { pin = localStorage.getItem('oracle_user_pin') || localStorage.getItem('oracle_pin'); } catch(e) {}
    if (!pin) {
      if (typeof showCustomModal === 'function') {
        showCustomModal('Защитить чат (BETA)', 'Сначала создайте PIN в Настройки → Безопасность. Затем чат можно поместить в проект «Приватные чаты».');
      } else showToast?.('Сначала задайте PIN в Безопасности','warning');
      return;
    }
    // ensure Private folder
    try {
      var tree = JSON.parse(localStorage.getItem('oracle_project_tree_v2') || '{}') || {};
      tree.folders = tree.folders || [];
      var priv = tree.folders.find(function(f){ return f.name === 'Приватные чаты' || f.id === 'private_chats'; });
      if (!priv) {
        priv = { id: 'private_chats', name: 'Приватные чаты', icon: 'lock', locked: true };
        tree.folders.push(priv);
      } else {
        priv.locked = true;
      }
      tree.chatToFolder = tree.chatToFolder || {};
      var sid = window.currentSessionId;
      if (sid) {
        tree.chatToFolder[sid] = priv.id;
        if (!window.chatSessions) chatSessions = {};
        if (chatSessions[sid]) chatSessions[sid].protected = true;
        localStorage.setItem('oracle_chat_sessions', JSON.stringify(chatSessions));
      }
      localStorage.setItem('oracle_project_tree_v2', JSON.stringify(tree));
      showToast?.('Чат в «Приватные чаты» (нужен PIN)','success');
      if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
    } catch(e) {
      showToast?.('Не удалось защитить','warning');
    }
  };

  document.addEventListener('click', function(ev) {
    var menu = $('chat-options-menu');
    if (!menu || !menu.classList.contains('open')) return;
    if (menu.contains(ev.target)) return;
    if (ev.target.closest('#chat-options-btn, #ecc-more-btn')) return;
    closeBarMenus();
  }, true);

  function boot() {
    syncEmptyChatLayout();
    var flow = $('chat-flow');
    if (flow && window.MutationObserver) {
      new MutationObserver(function(){ syncEmptyChatLayout(); }).observe(flow, { childList: true, subtree: true });
    }
    ['chat-options-btn','ecc-more-btn'].forEach(function(id) {
      var b = $(id);
      if (b && !b._boundDots) {
        b._boundDots = true;
        b.addEventListener('click', function(ev){ toggleChatOptionsMenu(ev); });
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 300);

  ['switchScreen','createNewChatSession','loadChatSession','sendMsg','enterTempChat','exitTempChat'].forEach(function(n) {
    var p = window[n];
    if (typeof p !== 'function' || p._barsFix) return;
    window[n] = function() {
      var r = p.apply(this, arguments);
      setTimeout(syncEmptyChatLayout, 30);
      return r;
    };
    window[n]._barsFix = true;
  });
})();


/* ===== Boot splash + PWA flag + settings ensure ===== */
(function bootSplashAndSettings() {
  function markPwa() {
    var pwa = false;
    try {
      pwa = window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: window-controls-overlay)').matches
        || navigator.standalone === true;
    } catch (e) {}
    document.body.classList.toggle('is-pwa', !!pwa);
    document.body.classList.toggle('is-pwa-standalone', !!pwa);
  }

  function hideSplash() {
    var el = document.getElementById('boot-splash');
    if (!el) return;
    el.classList.add('boot-done');
    setTimeout(function() {
      try { el.remove(); } catch (e) { el.style.display = 'none'; }
    }, 500);
  }

  function ensureSettingsVisible() {
    // If on settings screen and no section visible, show general
    var screen = document.getElementById('screen-settings');
    if (!screen || !screen.classList.contains('active-screen')) return;
    var vis = document.querySelector('#settings-content .setting-section.section-visible');
    if (!vis) {
      if (typeof showSection === 'function') showSection('general');
    }
  }

  // Hash #settings_xxx
  function applySettingsHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (h.indexOf('settings_') === 0) {
      var sec = h.slice('settings_'.length) || 'general';
      if (typeof switchScreen === 'function') switchScreen('settings');
      else if (typeof switchTab === 'function') switchTab('settings');
      setTimeout(function() {
        if (typeof showSection === 'function') showSection(sec);
      }, 40);
    } else if (h === 'settings') {
      if (typeof switchScreen === 'function') switchScreen('settings');
      setTimeout(function() { showSection('general'); }, 40);
    }
  }

  markPwa();

  var minMs = 2000;
  var maxMs = 5000;
  var start = Date.now();
  function finish() {
    var waited = Date.now() - start;
    var left = Math.max(0, minMs - waited);
    // cap total ~ maxMs
    if (waited + left > maxMs) left = Math.max(0, maxMs - waited);
    setTimeout(function() {
      hideSplash();
      markPwa();
      applySettingsHash();
      ensureSettingsVisible();
      if (typeof syncEmptyChatLayout === 'function') syncEmptyChatLayout();
    }, left);
  }

  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish);
  // safety max
  setTimeout(finish, maxMs + 50);

  // When opening settings, always show a section
  var _sw = window.switchScreen;
  if (typeof _sw === 'function' && !_sw._settingsEnsure) {
    window.switchScreen = function(name) {
      var r = _sw.apply(this, arguments);
      if (name === 'settings' || name === 'screen-settings') {
        setTimeout(function() {
          var vis = document.querySelector('#settings-content .setting-section.section-visible');
          if (!vis && typeof showSection === 'function') showSection('general');
        }, 20);
      }
      return r;
    };
    window.switchScreen._settingsEnsure = true;
  }
})();


/* ===== Local chat.json model (single integration) ===== */
(function localChatModel() {
  var STORE = null;
  var LOADING = null;

  function loadChatJson() {
    if (STORE) return Promise.resolve(STORE);
    if (LOADING) return LOADING;
    LOADING = fetch('./chat.json', { cache: 'no-cache' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        STORE = data || { entries: [], fallback: '' };
        return STORE;
      })
      .catch(function() {
        STORE = { entries: [], fallback: '' };
        return STORE;
      })
      .finally(function() { LOADING = null; });
    return LOADING;
  }

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[ё]/g, 'е')
      .replace(/[^\S\r\n]+/g, ' ')
      .trim();
  }

  function scoreEntry(text, entry) {
    var keys = entry.keys || [];
    var best = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = normalize(keys[i]);
      if (!k) continue;
      if (text === k) best = Math.max(best, 100);
      else if (text.indexOf(k) !== -1) best = Math.max(best, 50 + Math.min(40, k.length));
      else if (k.indexOf(text) !== -1 && text.length >= 4) best = Math.max(best, 30);
    }
    return best;
  }

  window.matchLocalChatAnswer = function(userText) {
    if (!STORE || !STORE.entries || !STORE.entries.length) return null;
    var text = normalize(userText);
    if (!text || text.length < 2) return null;
    var best = null, bestScore = 0;
    for (var i = 0; i < STORE.entries.length; i++) {
      var sc = scoreEntry(text, STORE.entries[i]);
      if (sc > bestScore) {
        bestScore = sc;
        best = STORE.entries[i];
      }
    }
    if (bestScore >= 50) return best.answer;
    return null;
  };

  window.getLocalChatFallback = function() {
    return (STORE && STORE.fallback) || '';
  };

  window.tryLocalChatReply = function(userText, opts) {
    opts = opts || {};
    var forceLocal = opts.forceLocal || !navigator.onLine || opts.preferLocal;
    var answer = window.matchLocalChatAnswer(userText);
    if (answer) return Promise.resolve({ ok: true, text: answer, source: 'local' });
    if (forceLocal) {
      var fb = window.getLocalChatFallback();
      if (fb) return Promise.resolve({ ok: true, text: fb, source: 'local-fallback' });
    }
    return Promise.resolve({ ok: false, text: null, source: null });
  };

  // preload
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { loadChatJson(); });
  } else {
    loadChatJson();
  }
  window.reloadLocalChatModel = function() {
    STORE = null;
    return loadChatJson();
  };

  // Wrap sendMsg once: try local first when offline or before remote
  function installSendHook() {
    var prev = window.sendMsg;
    if (typeof prev !== 'function' || prev._localChat) return;
    window.sendMsg = function() {
      var args = arguments;
      var self = this;
      var input = document.getElementById('user-input');
      var text = '';
      if (input) text = (input.innerText || input.value || '').trim();
      // also try argument
      if (!text && typeof args[0] === 'string') text = args[0];

      var offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
      var prefer = offline || document.body.classList.contains('force-local-model');

      if (!text) return prev.apply(self, args);

      return loadChatJson().then(function() {
        return window.tryLocalChatReply(text, { forceLocal: offline, preferLocal: prefer });
      }).then(function(local) {
        if (local && local.ok && local.text && (offline || prefer)) {
          // Minimal local path: append user+ai if helpers exist
          try {
            if (typeof appendUserMessage === 'function') appendUserMessage(text);
            else if (typeof pushUserBubble === 'function') pushUserBubble(text);
            if (input) {
              if (input.value !== undefined) input.value = '';
              if (input.innerHTML !== undefined && input.isContentEditable) input.innerHTML = '';
            }
            if (typeof appendAIMessage === 'function') appendAIMessage(local.text);
            else if (typeof pushAiBubble === 'function') pushAiBubble(local.text);
            else if (typeof addMessage === 'function') addMessage('ai', local.text);
            else {
              var flow = document.getElementById('chat-flow');
              if (flow) {
                flow.insertAdjacentHTML('beforeend',
                  '<div class="msg user-msg">' + text.replace(/</g,'&lt;') + '</div>' +
                  '<div class="msg ai-msg">' + local.text + '</div>');
              }
            }
            if (typeof syncEmptyChatLayout === 'function') syncEmptyChatLayout();
            return;
          } catch (e) {
            console.warn('local reply render failed', e);
          }
        }
        // Online / no local match → original pipeline
        return prev.apply(self, args);
      });
    };
    window.sendMsg._localChat = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(installSendHook, 0); });
  } else {
    setTimeout(installSendHook, 0);
  }
  // late bind if sendMsg defined later
  setTimeout(installSendHook, 1500);
})();

/* ===== script block ===== */

/* ===== Core Node UX Hotfix: maps, settings, plans AI, copy toast, sidebar ===== */
(function CNUxHotfix(){
  'use strict';

  /* ---- showSection: single reliable implementation ---- */
  window.showSection = function(sectionId){
    sectionId = String(sectionId||'general').trim().replace(/^section-/,'');
    var map = {personalization:'general',appearance:'general',theme:'general','o-vas':'user',you:'user',profile:'user',safety:'security',protect:'security',apikeys:'api-keys',api:'api-keys',links:'public-links',public:'public-links',sidebar:'sidebar-menu',menu:'sidebar-menu',dev:'developer',lang:'language'};
    if(map[sectionId]) sectionId = map[sectionId];
    var root = document.getElementById('settings-content');
    var nodes = root ? root.querySelectorAll('.setting-section') : document.querySelectorAll('.setting-section');
    nodes.forEach(function(el){
      el.classList.remove('section-visible');
      el.style.setProperty('display','none','important');
    });
    var target = document.getElementById('section-'+sectionId) || document.getElementById('section-general');
    if(target){
      // ensure inside settings-content
      if(root && target.parentElement !== root) try{ root.appendChild(target); }catch(e){}
      target.classList.add('section-visible');
      target.style.setProperty('display','block','important');
      target.style.setProperty('visibility','visible','important');
      target.style.setProperty('height','auto','important');
      target.style.setProperty('overflow','visible','important');
    }
    document.querySelectorAll('[id^="btn-sec-"]').forEach(function(b){ b.classList.remove('active'); });
    var btn = document.getElementById('btn-sec-'+sectionId);
    if(btn) btn.classList.add('active');
    try{
      if(location.hash.indexOf('#settings')===0 || document.getElementById('screen-settings')?.classList.contains('active-screen'))
        history.replaceState(null,'','#settings_'+sectionId);
    }catch(e){}
  };

  /* ---- switchScreen: ensure maps + calendar work ---- */
  var _prevSwitch = typeof window.switchScreen === 'function' ? window.switchScreen : null;
  window.switchScreen = function(screenName){
    screenName = String(screenName||'chat').replace(/^screen-/,'');
    // hide all screens
    document.querySelectorAll('.app-screen').forEach(function(s){ s.classList.remove('active-screen'); });
    document.querySelectorAll('.glass-nav .nav-item').forEach(function(t){ t.classList.remove('active'); });
    var target = document.getElementById('screen-'+screenName);
    if(target) target.classList.add('active-screen');
    var tab = document.getElementById('btn-tab-'+screenName);
    if(tab) tab.classList.add('active');
    document.body.classList.toggle('on-chat-screen', screenName==='chat');
    document.body.classList.toggle('on-settings-screen', screenName==='settings');
    var box = document.getElementById('main-input-box');
    if(box){
      if(screenName==='chat'){ box.style.display='flex'; box.classList.remove('hidden'); }
      else { box.style.display='none'; }
    }
    var sub = document.getElementById('sub-nav-chat');
    if(sub) sub.style.display = screenName==='chat' ? 'flex' : 'none';
    document.getElementById('sidebar-archive')?.classList.remove('open');

    if(screenName==='calendar'){
      try{ if(typeof window.renderCalendar==='function') window.renderCalendar(); }catch(e){}
    }
    if(screenName==='maps'){
      setTimeout(function(){ try{ window.initCoreMaps && window.initCoreMaps(); }catch(e){ console.error(e);} }, 60);
      setTimeout(function(){ try{ window._coreMap && window._coreMap.invalidateSize(true); }catch(e){} }, 200);
      setTimeout(function(){ try{ window._coreMap && window._coreMap.invalidateSize(true); }catch(e){} }, 600);
    }
    if(screenName==='settings'){
      setTimeout(function(){
        var vis = document.querySelector('#settings-content .setting-section.section-visible');
        if(!vis) window.showSection('general');
      }, 20);
    }
    // call previous extras if any (without infinite loop)
    if(_prevSwitch && _prevSwitch !== window.switchScreen && !_prevSwitch._cnUx){
      try{ /* already did core; skip re-entry */ }catch(e){}
    }
  };
  window.switchScreen._cnUx = true;

  /* ---- Calendar view mode ---- */
  window._calView = localStorage.getItem('oracle_cal_view') || 'week';
  window.setCalendarView = function(v){
    if(['day','week','month'].indexOf(v)<0) v='week';
    window._calView = v;
    localStorage.setItem('oracle_cal_view', v);
    document.querySelectorAll('.cal-view-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-view')===v);
    });
    if(typeof window.renderCalendar==='function') window.renderCalendar();
  };

  // Enhance renderCalendar if present: week default, past gray
  (function patchRenderCal(){
    var tries=0;
    function attempt(){
      tries++;
      var orig = window.renderCalendar;
      // also expose nested if needed
      if(typeof orig !== 'function'){
        // try to bind from changeMonth sibling by defining fallback
        if(tries<20) return setTimeout(attempt, 200);
        // minimal fallback
        window.renderCalendar = function(){
          var grid = document.getElementById('calendar-days-grid');
          if(!grid) return;
          // use existing month logic light
        };
        return;
      }
      if(orig._cnView) return;
      window.renderCalendar = function(){
        var r = orig.apply(this, arguments);
        try{
          var grid = document.getElementById('calendar-days-grid');
          var weekdays = document.getElementById('cal-weekdays');
          var view = window._calView || 'week';
          if(weekdays) weekdays.style.display = (view==='day') ? 'none' : 'grid';
          if(!grid) return r;
          // mark past days
          grid.querySelectorAll('.calendar-day').forEach(function(cell){
            if(cell.classList.contains('past-day') || cell.disabled){
              cell.style.opacity = '0.4';
              cell.style.filter = 'grayscale(0.65)';
              cell.style.pointerEvents = 'none';
            }
          });
          // week view: show only current week rows roughly by hiding non-week if data attrs exist
          if(view==='week' && grid.children.length){
            // keep full month grid but highlight current week - OK for UX
            grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
          } else if(view==='day'){
            grid.style.gridTemplateColumns = '1fr';
          } else {
            grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
          }
        }catch(e){}
        return r;
      };
      window.renderCalendar._cnView = true;
      // ensure changeMonth global
      if(typeof window.changeMonth !== 'function'){
        window.changeMonth = function(dir){
          try{
            if(typeof currentCalDate !== 'undefined'){
              currentCalDate = new Date(currentCalDate.getFullYear(), currentCalDate.getMonth()+Number(dir), 1);
            }
          }catch(e){}
          if(window.renderCalendar) window.renderCalendar();
        };
      }
    }
    attempt();
  })();

  /* ---- AI Plan Creator (natural language) ---- */
  function nextWeekday(from, targetDow){
    // targetDow: 0=Sun ... 6=Sat; we use Mon=1..Sun=0 in JS getDay
    var d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    var day = d.getDay();
    var diff = (targetDow - day + 7) % 7;
    if(diff===0) diff = 7; // next occurrence
    d.setDate(d.getDate()+diff);
    return d;
  }
  function parseRuPlan(text){
    var raw = String(text||'').trim();
    if(!raw) return null;
    var now = new Date();
    var title = raw;
    var hours = 9, minutes = 0;
    var year = now.getFullYear(), month = now.getMonth(), day = now.getDate();
    var hasDate = false;

    // time HH:MM or H:MM
    var tm = raw.match(/\b([01]?\d|2[0-3])[:\.]([0-5]\d)\b/);
    if(tm){ hours = +tm[1]; minutes = +tm[2]; title = title.replace(tm[0], '').trim(); }

    // dd.mm.yyyy or dd.mm.yy or dd.mm
    var dm = raw.match(/\b(\d{1,2})[.\-\/](\d{1,2})(?:[.\-\/](\d{2,4}))?\b/);
    if(dm){
      hasDate = true;
      day = +dm[1]; month = +dm[2]-1;
      if(dm[3]){ year = +dm[3]; if(year<100) year += 2000; }
      title = title.replace(dm[0], '').trim();
    }

    // 1 января 2027 / 1 января
    var months = {января:0,февраля:1,марта:2,апреля:3,мая:4,июня:5,июля:6,августа:7,сентября:8,октября:9,ноября:10,декабря:11,
      январь:0,февраль:1,март:2,апрель:3,май:4,июнь:5,июль:6,август:7,сентябрь:8,октябрь:9,ноябрь:10,декабрь:11};
    var md = raw.toLowerCase().match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?\b/);
    if(md){
      hasDate = true;
      day = +md[1]; month = months[md[2]]; if(md[3]) year = +md[3];
      title = title.replace(new RegExp(md[0],'i'), '').trim();
    }

    // weekdays
    var wdMap = {воскресенье:0,вс:0,понедельник:1,пн:1,вторник:2,вт:2,среда:3,ср:3,среду:3,четверг:4,чт:4,пятница:5,пт:5,пятницу:5,суббота:6,сб:6,субботу:6};
    if(!hasDate){
      var low = raw.toLowerCase();
      if(/\bсегодня\b/.test(low)){ hasDate = true; }
      else if(/\bзавтра\b/.test(low)){ hasDate = true; day = now.getDate()+1; var t=new Date(year,month,day); year=t.getFullYear();month=t.getMonth();day=t.getDate(); title=title.replace(/завтра/ig,'').trim(); }
      else {
        for(var k in wdMap){
          if(low.indexOf(k)!==-1){
            var nd = nextWeekday(now, wdMap[k]);
            year=nd.getFullYear(); month=nd.getMonth(); day=nd.getDate(); hasDate=true;
            title = title.replace(new RegExp(k,'ig'),'').trim();
            break;
          }
        }
      }
    }

    // cleanup title
    title = title.replace(/\bв\s*$/i,'').replace(/\s{2,}/g,' ').replace(/^[\s,.\-—]+|[\s,.\-—]+$/g,'').trim();
    if(!title) title = 'План';

    if(!hasDate){
      // default: tomorrow
      var tom = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
      year=tom.getFullYear(); month=tom.getMonth(); day=tom.getDate();
    }

    var when = new Date(year, month, day, hours, minutes, 0, 0);
    // if in the past today with time, push +7 days for weekday-only? if past, next day
    if(when.getTime() < Date.now()-60000){
      when = new Date(when.getTime() + 24*3600*1000);
    }
    return { title: title, when: when };
  }

  window.createPlanFromNaturalLanguage = function(){
    var input = document.getElementById('ai-plan-input');
    var text = (input && input.value || '').trim();
    if(!text){
      if(typeof showToast==='function') showToast('Введите текст плана','warning');
      return;
    }
    var parsed = parseRuPlan(text);
    if(!parsed){ showToast?.('Не удалось разобрать','error'); return; }
    var key = parsed.when.getFullYear()+'-'+String(parsed.when.getMonth()+1).padStart(2,'0')+'-'+String(parsed.when.getDate()).padStart(2,'0');
    var timeStr = String(parsed.when.getHours()).padStart(2,'0')+':'+String(parsed.when.getMinutes()).padStart(2,'0');
    try{
      var list = [];
      try{ list = JSON.parse(localStorage.getItem('oracle_reminders')||'[]')||[]; }catch(e){ list=[]; }
      if(!Array.isArray(list)) list=[];
      var item = {
        id: 'rem_'+Date.now(),
        date: key,
        time: timeStr,
        text: parsed.title,
        title: parsed.title,
        notifyBefore: 10,
        color: '',
        created: Date.now()
      };
      list.push(item);
      localStorage.setItem('oracle_reminders', JSON.stringify(list));
      // sync in-memory if exists
      try{ if(typeof reminders!=='undefined' && Array.isArray(reminders)){ reminders.length=0; list.forEach(function(x){reminders.push(x);}); } }catch(e){}
      if(typeof window.renderCalendar==='function') window.renderCalendar();
      if(typeof window.renderReminders==='function') window.renderReminders();
      if(input) input.value='';
      var prev = document.getElementById('ai-plan-preview');
      if(prev){
        prev.style.display='block';
        prev.textContent = 'Создано: «'+parsed.title+'» · '+key+' '+timeStr;
      }
      showToast?.('План создан: '+parsed.title,'success');
    }catch(e){
      console.error(e);
      showToast?.('Ошибка сохранения плана','error');
    }
  };
  document.addEventListener('keydown', function(e){
    if(e.key==='Enter' && e.target && e.target.id==='ai-plan-input'){
      e.preventDefault();
      window.createPlanFromNaturalLanguage();
    }
  });

  /* ---- Copy toast with actions ---- */
  window.showCopyFragmentToast = function(text){
    text = String(text||'').trim();
    var frag = text.slice(0,15) + (text.length>15 ? '…' : '');
    var container = document.getElementById('toast-container');
    if(!container){
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none';
      document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.className = 'core-toast success copy-action-toast';
    toast.style.pointerEvents = 'auto';
    toast.innerHTML = '<div class="cat-text"><b>Скопирован фрагмент:</b> '+frag.replace(/</g,'&lt;')+'</div>'+
      '<div class="cat-actions">'+
      '<button type="button" class="primary" data-act="new">Новый чат</button>'+
      '<button type="button" data-act="edit">Отредактировать</button>'+
      '</div>';
    toast.querySelector('[data-act="new"]').onclick = function(){
      toast.remove();
      try{
        if(typeof createNewChatSession==='function') createNewChatSession();
        else if(typeof window.eccNewChatMenu==='function'){ /* noop */ }
        window.switchScreen && window.switchScreen('chat');
      }catch(e){}
    };
    toast.querySelector('[data-act="edit"]').onclick = function(){
      toast.remove();
      openCopyEditModal(text);
    };
    container.appendChild(toast);
    setTimeout(function(){ try{ toast.classList.add('out'); setTimeout(function(){ toast.remove(); }, 250);}catch(e){} }, 8000);
  };

  function openCopyEditModal(text){
    var existing = document.getElementById('copy-edit-modal');
    if(existing) existing.remove();
    var ov = document.createElement('div');
    ov.id = 'copy-edit-modal';
    ov.className = 'modal-overlay active';
    ov.innerHTML = '<div class="modal-card" style="max-width:480px">'+
      '<div class="modal-header"><span class="material-symbols-rounded">edit</span><h3 class="modal-title">Редактировать фрагмент</h3></div>'+
      '<textarea id="copy-edit-area" style="width:100%;min-height:120px;padding:12px;border-radius:12px;border:1px solid var(--border);background:var(--surface-variant);color:var(--on-surface);font-size:14px;resize:vertical"></textarea>'+
      '<div class="modal-actions">'+
      '<button type="button" class="modal-btn modal-btn-reject" id="copy-edit-cancel">Отмена</button>'+
      '<button type="button" class="modal-btn modal-btn-accept" id="copy-edit-copy">Скопировать снова</button>'+
      '</div></div>';
    document.body.appendChild(ov);
    var area = ov.querySelector('#copy-edit-area');
    area.value = text;
    ov.querySelector('#copy-edit-cancel').onclick = function(){ ov.remove(); };
    ov.querySelector('#copy-edit-copy').onclick = function(){
      var v = area.value;
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(v).then(function(){
          ov.remove();
          window.showCopyFragmentToast(v);
        }).catch(function(){ showToast?.('Не удалось скопировать','error'); });
      }
    };
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
  }

  // Patch common copy helpers
  window.copyMessageText = function(text){
    text = String(text||'');
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ window.showCopyFragmentToast(text); })
        .catch(function(){ showToast?.('Не удалось скопировать','error'); });
    } else {
      showToast?.('Буфер обмена недоступен','warning');
    }
  };
  // Hook buttons with data-copy or onclick patterns via event delegation
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('[data-copy-text], .msg-copy-btn, .copy-msg-btn, button[title="Копировать"]');
    if(!btn) return;
    // if already handled by inline, still enhance after short delay via monkeypatch below
  }, true);

  // Override showToast success "Скопировано" paths by wrapping clipboard writes is hard; wrap showToast for copy keywords
  var _st = window.showToast;
  // Don't break showToast; use explicit copyMessageText in UI.

  /* ---- Maps hard init ---- */
  window.initCoreMaps = window.initCoreMaps || function(){};
  (function(){
    var prev = window.initCoreMaps;
    window.initCoreMaps = function(){
      var el = document.getElementById('maps-leaflet');
      if(el){
        el.style.minHeight = 'min(55vh, 520px)';
        el.style.height = 'min(55vh, 520px)';
      }
      if(typeof L === 'undefined'){
        if(!window._leafletBoot){
          window._leafletBoot = true;
          var lcss=document.createElement('link'); lcss.rel='stylesheet';
          lcss.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(lcss);
          var s=document.createElement('script');
          s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          s.onload=function(){ window._leafletBoot=false; try{ prev(); }catch(e){} setTimeout(function(){ try{window._coreMap&&window._coreMap.invalidateSize(true);}catch(e){} }, 200); };
          document.head.appendChild(s);
        }
        return;
      }
      try{ prev(); }catch(e){ console.error(e); }
      setTimeout(function(){ try{ window._coreMap && window._coreMap.invalidateSize(true); }catch(e){} }, 100);
      setTimeout(function(){ try{ window._coreMap && window._coreMap.invalidateSize(true); }catch(e){} }, 400);
    };
  })();

  /* ---- Sidebar: hide projects if empty (desktop) ---- */
  window.setHideProjectsIfEmpty = function(on){
    localStorage.setItem('oracle_hide_projects_empty', on ? '1' : '0');
    document.body.classList.toggle('hide-empty-projects', !!on);
    window.syncProjectsEmptyState && window.syncProjectsEmptyState();
  };
  window.syncProjectsEmptyState = function(){
    var block = document.getElementById('sidebar-projects-block') || document.querySelector('[data-sidebar-projects], .sb-projects, #projects-list');
    if(!block){
      // try find by heading
      document.querySelectorAll('#sidebar-archive .sb-section, #sidebar-archive .archive-group').forEach(function(el){
        if(/проект/i.test(el.textContent||'')) block = el;
      });
    }
    if(!block) return;
    var has = false;
    try{
      var tree = JSON.parse(localStorage.getItem('oracle_project_tree_v2')||'{}')||{};
      has = Array.isArray(tree.folders) && tree.folders.length>0;
    }catch(e){}
    block.classList.toggle('is-empty', !has);
    block.id = block.id || 'sidebar-projects-block';
  };
  if(localStorage.getItem('oracle_hide_projects_empty')==='1'){
    document.body.classList.add('hide-empty-projects');
    var cb = document.getElementById('toggle-hide-projects-empty');
    if(cb) cb.checked = true;
  }

  /* ---- Mobile spacious sidebar ---- */
  if(window.matchMedia && window.matchMedia('(max-width:720px)').matches){
    document.body.classList.add('mobile-spacious-sb');
  }

  // boot
  function boot(){
    try{
      document.querySelectorAll('.cal-view-btn').forEach(function(b){
        b.classList.toggle('active', b.getAttribute('data-view')===(localStorage.getItem('oracle_cal_view')||'week'));
      });
      window.syncProjectsEmptyState && window.syncProjectsEmptyState();
      // rebind settings buttons
      document.querySelectorAll('[id^="btn-sec-"]').forEach(function(btn){
        btn.addEventListener('click', function(e){
          e.preventDefault();
          var id = btn.id.replace(/^btn-sec-/,'');
          window.showSection(id);
        }, { once:false });
      });
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);

  console.log('[CN] ux hotfix active');
})();

/* ===== script block ===== */

(function(){
  function lockAfterFirstTempMsg() {
    if (!window.CoreState || !CoreState.isTempChat) return;
    if (CoreState.tempHasMessages) return;
    CoreState.tempHasMessages = true;
    CoreState.tempPersonaLocked = true;
    var chooser = document.getElementById('temp-persona-chooser');
    if (chooser) {
      chooser.querySelectorAll('.temp-persona-card').forEach(function(c){ c.style.opacity = '0.55'; c.style.pointerEvents = 'none'; });
      var hint = chooser.querySelector('.temp-persona-hint');
      if (hint) hint.textContent = 'Выбор зафиксирован после первого сообщения.';
    }
  }
  // wrap sendMsg once
  function wrap() {
    var prev = window.sendMsg;
    if (typeof prev !== 'function' || prev._tempLock) return;
    window.sendMsg = function() {
      var wasTemp = !!(window.CoreState && CoreState.isTempChat);
      var r = prev.apply(this, arguments);
      if (wasTemp) setTimeout(lockAfterFirstTempMsg, 30);
      setTimeout(function(){ if (typeof syncEmptyChatLayout==='function') syncEmptyChatLayout(); }, 50);
      return r;
    };
    window.sendMsg._tempLock = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(wrap, 0); });
  else setTimeout(wrap, 0);
  setTimeout(wrap, 1200);
})();

/* ===== script block ===== */

(function(){
  'use strict';

  /* ---- Hide empty chrome in temp chat ---- */
  var _sync = window.syncEmptyChatLayout;
  window.syncEmptyChatLayout = function() {
    if (typeof _sync === 'function') {
      try { _sync.apply(this, arguments); } catch (e) {}
    }
    try {
      var temp = !!(window.CoreState && CoreState.isTempChat) || document.body.classList.contains('temp-chat-mode');
      var chrome = document.getElementById('empty-chat-chrome');
      if (chrome && temp) {
        chrome.hidden = true;
        chrome.style.display = 'none';
      }
      if (temp) document.body.classList.remove('empty-chat');
    } catch (e) {}
  };

  /* ---- Reliable screen switch (no stacked UI) ---- */
  window.switchScreen = function(screenName) {
    screenName = String(screenName || 'chat').replace(/^screen-/, '');

    // close overlays that block other tabs
    try {
      document.getElementById('sidebar-archive')?.classList.remove('open');
      document.body.classList.remove('sidebar-open');
      document.getElementById('sb-more-menu')?.setAttribute('hidden', '');
      document.getElementById('plus-menu')?.classList.remove('open');
      document.getElementById('chat-options-menu')?.classList.remove('open');
      document.getElementById('ecc-new-menu')?.setAttribute('hidden', '');
    } catch (e) {}

    // only one app-screen
    document.querySelectorAll('.app-screen').forEach(function(s) {
      s.classList.remove('active-screen');
      s.style.removeProperty('display');
    });
    var target = document.getElementById('screen-' + screenName);
    if (!target && screenName === 'addons') target = document.getElementById('screen-skills');
    if (target) {
      target.classList.add('active-screen');
      target.style.setProperty('display', 'flex', 'important');
    }

    document.querySelectorAll('.glass-nav .nav-item, [id^="btn-tab-"]').forEach(function(b) {
      b.classList.remove('active');
    });
    var tab = document.getElementById('btn-tab-' + screenName);
    if (tab) tab.classList.add('active');

    var onChat = screenName === 'chat';
    document.body.classList.toggle('on-chat-screen', onChat);
    document.body.classList.toggle('on-settings-screen', screenName === 'settings');
    document.body.classList.toggle('on-reader-screen', screenName === 'reader');
    document.body.classList.toggle('on-skills-screen', screenName === 'skills' || screenName === 'addons');

    // input + chrome only on chat
    var box = document.getElementById('main-input-box');
    if (box) {
      if (onChat) {
        box.style.display = 'flex';
        box.style.visibility = 'visible';
        box.classList.remove('hidden');
      } else {
        box.style.display = 'none';
      }
    }
    var sub = document.getElementById('sub-nav-chat');
    if (sub) sub.style.display = onChat ? 'flex' : 'none';

    var chrome = document.getElementById('empty-chat-chrome');
    var bar = document.getElementById('chat-session-bar');
    if (!onChat) {
      if (chrome) { chrome.hidden = true; chrome.style.display = 'none'; }
      if (bar) bar.style.display = 'none';
      document.body.classList.remove('empty-chat');
    } else {
      if (typeof window.syncEmptyChatLayout === 'function') {
        setTimeout(function() { window.syncEmptyChatLayout(); }, 20);
      }
    }

    if (screenName === 'calendar' && typeof window.renderCalendar === 'function') {
      try { window.renderCalendar(); } catch (e) {}
    }
    if (screenName === 'maps') {
      setTimeout(function() { try { window.initCoreMaps && window.initCoreMaps(); } catch (e) {} }, 50);
      setTimeout(function() { try { window._coreMap && window._coreMap.invalidateSize(true); } catch (e) {} }, 250);
    }
    if (screenName === 'settings') {
      setTimeout(function() {
        var vis = document.querySelector('#settings-content .setting-section.section-visible');
        if (!vis && typeof showSection === 'function') showSection('general');
      }, 20);
    }
    if (screenName === 'library' && typeof refreshLibraryUI === 'function') {
      try { refreshLibraryUI(); } catch (e) {}
    }
  };
  window.switchScreen._cnNavFix = true;

  /* ---- Fullscreen download ---- */
  window.openDownloadAppModal = function() {
    var el = document.getElementById('download-app');
    if (!el) return;
    el.hidden = false;
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('download-app-open');
  };
  window.closeDownloadAppModal = function() {
    var el = document.getElementById('download-app');
    if (el) {
      el.hidden = true;
      el.setAttribute('hidden', '');
      el.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('download-app-open');
    document.getElementById('download-app-modal')?.classList.remove('active');
  };
  window.promptPwaInstall = function() {
    window.openDownloadAppModal();
  };
  // Esc closes download
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.body.classList.contains('download-app-open')) {
      window.closeDownloadAppModal();
    }
  });

  console.log('[CN] nav+download fix');
})();

/* ===== script block ===== */

(function(){
  'use strict';
  var exportFmt = 'md';
  var canvaVisible = false;
  var drawing = false;
  var lastPt = null;
  var canvaUndo = null;
  var canvaStroke = '#000000';
  var ALLOWED_CANVA_COLORS = ['#000000','#ffffff','#ff3b30','#ff9500','#ffcc00','#34c759','#007aff','#af52de','#ff2d55'];

  window.readerCanvaSetColor = function(c, btn) {
    c = String(c || '').toLowerCase();
    if (ALLOWED_CANVA_COLORS.indexOf(c) === -1) c = '#000000';
    canvaStroke = c;
    document.querySelectorAll('#reader-canva-palette .rcp-swatch').forEach(function(b){
      b.classList.toggle('active', (b.getAttribute('data-c')||'').toLowerCase() === c);
    });
    if (btn) btn.classList.add('active');
  };

  function story() {
    try {
      if (!window.storyBooks) window.storyBooks = {};
      return window.currentStoryId ? storyBooks[currentStoryId] : null;
    } catch(e) { return null; }
  }

  function setStatus(text, kind) {
    ['reader-save-status','reader-save-status-tb'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      el.classList.remove('is-dirty','is-ok');
      if (kind) el.classList.add(kind);
    });
    var hint = document.getElementById('reader-close-hint');
    if (hint) {
      hint.textContent = (kind === 'is-dirty')
        ? 'Не закрывайте вкладку, пока идёт сохранение / правки'
        : 'Можно закрыть окно · при активной правке лучше не закрывать вкладку';
    }
  }

  window.readerOnStoryOpened = function(id) {
    var s = storyBooks[id];
    if (!s) return;
    var titleEl = document.getElementById('current-story-title-display');
    if (titleEl) titleEl.textContent = s.title || 'Без названия';
    var badge = document.getElementById('reader-ai-badge');
    if (badge) {
      var ai = !!(s.aiGenerated || s.fromAi || s.aiEnhanced);
      badge.hidden = !ai;
    }
    setStatus('Сохранено', 'is-ok');
    // restore canva
    var block = document.getElementById('reader-canva-block');
    if (s.canvaData) {
      canvaVisible = true;
      if (block) { block.hidden = false; }
      setTimeout(function(){ loadCanvaFromStory(); }, 30);
    } else {
      canvaVisible = false;
      if (block) block.hidden = true;
    }
    setupReaderEditor();
    renderReaderRecent();
  };

  function setupReaderEditor() {
    var editor = document.getElementById('editor');
    if (!editor || editor._readerBound) return;
    editor._readerBound = true;
    var t = null;
    editor.addEventListener('input', function() {
      setStatus('Сохранение…', 'is-dirty');
      clearTimeout(t);
      t = setTimeout(function(){ readerManualSave(true); }, 450);
    });
    editor.addEventListener('blur', function(){ readerManualSave(true); });
    editor.addEventListener('keydown', function(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); readerFormat('bold'); }
      if (k === 'i') { e.preventDefault(); readerFormat('italic'); }
      if (k === 'u') { e.preventDefault(); readerFormat('underline'); }
      if (k === 's') { e.preventDefault(); readerManualSave(); }
    });
  }

  window.readerManualSave = function(silent) {
    if (!window.currentStoryId || !storyBooks[currentStoryId]) {
      if (!silent) showToast && showToast('Сначала откройте историю', 'warning');
      return;
    }
    var editor = document.getElementById('editor');
    storyBooks[currentStoryId].content = editor ? editor.innerHTML : (storyBooks[currentStoryId].content || '');
    storyBooks[currentStoryId].updated = Date.now();
    // canva
    try {
      var c = document.getElementById('reader-canva');
      if (c && canvaVisible) storyBooks[currentStoryId].canvaData = c.toDataURL('image/png');
    } catch(e){}
    try { localStorage.setItem('oracle_story_books', JSON.stringify(storyBooks)); } catch(e){}
    setStatus('Сохранено · только что', 'is-ok');
    if (typeof renderSidebarStories === 'function') renderSidebarStories();
    if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
    if (!silent) showToast && showToast('История сохранена', 'success');
  };
  window.saveCurrentStory = window.readerManualSave;

  window.renameCurrentStory = function() {
    if (!currentStoryId || !storyBooks[currentStoryId]) {
      showToast && showToast('Нет открытой истории', 'warning');
      return;
    }
    var cur = storyBooks[currentStoryId].title || 'Без названия';
    function apply(name) {
      if (!name || !String(name).trim()) return;
      name = String(name).trim();
      storyBooks[currentStoryId].title = name;
      localStorage.setItem('oracle_story_books', JSON.stringify(storyBooks));
      var titleEl = document.getElementById('current-story-title-display');
      if (titleEl) titleEl.textContent = name;
      if (typeof renderSidebarStories === 'function') renderSidebarStories();
      if (typeof renderUnifiedArchive === 'function') renderUnifiedArchive();
      showToast && showToast('Название обновлено', 'success');
    }
    if (typeof showCustomModal === 'function') {
      showCustomModal('Переименовать историю', 'Новое название', true, cur, function(ok, val) {
        if (ok === false) return;
        apply(typeof ok === 'string' ? ok : val);
      });
    } else {
      var n = prompt('Название', cur);
      if (n) apply(n);
    }
  };

  window.readerFormat = function(cmd, val) {
    try { document.execCommand(cmd, false, val || null); } catch(e) {}
    var editor = document.getElementById('editor');
    if (editor) editor.focus();
    setStatus('Несохранено', 'is-dirty');
  };
  // compat
  window.format = window.readerFormat;

  window.toggleReaderColorPicker = function(e) {
    if (e) e.stopPropagation();
    var p = document.getElementById('reader-color-picker');
    if (!p) return;
    p.hidden = !p.hidden;
  };
  window.readerPickColor = function(c) {
    if (c) readerFormat('foreColor', c);
    else readerFormat('removeFormat');
    var p = document.getElementById('reader-color-picker');
    if (p) p.hidden = true;
  };
  document.addEventListener('click', function(e) {
    var p = document.getElementById('reader-color-picker');
    if (p && !p.hidden && !e.target.closest('.reader-color-wrap')) p.hidden = true;
    var m = document.getElementById('reader-canva-more-menu');
    if (m && !m.hidden && !e.target.closest('#reader-canva-more') && !m.contains(e.target)) m.hidden = true;
  });

  window.readerAskCoreNode = function() {
    var editor = document.getElementById('editor');
    var sel = '';
    try { sel = (window.getSelection && window.getSelection().toString()) || ''; } catch(e){}
    if (!sel && editor) {
      sel = (editor.innerText || '').trim().slice(0, 500);
    }
    var title = (story() && story().title) || 'история';
    var q = sel
      ? ('По истории «' + title + '»: ' + sel.slice(0, 400))
      : ('Вопрос по истории «' + title + '»: ');
    if (typeof switchScreen === 'function') switchScreen('chat');
    setTimeout(function() {
      var input = document.getElementById('user-input');
      if (input) {
        if (input.isContentEditable) input.innerText = q;
        else input.value = q;
        input.focus();
      }
      showToast && showToast('Фрагмент в поле чата — дополните вопрос и отправьте', 'info', 3500);
    }, 80);
  };

  /* Export */
  window.openReaderExportModal = function() {
    exportFmt = 'md';
    selectReaderExportFmt('md');
    document.getElementById('reader-export-modal')?.classList.add('active');
  };
  window.closeReaderExportModal = function() {
    document.getElementById('reader-export-modal')?.classList.remove('active');
  };
  window.selectReaderExportFmt = function(fmt) {
    exportFmt = fmt;
    document.querySelectorAll('.reader-export-opt').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-fmt') === fmt);
    });
    var go = document.getElementById('reader-export-go');
    if (go) go.textContent = 'Скачать в виде .' + fmt;
  };
  window.confirmReaderExport = function() {
    if (!currentStoryId || !storyBooks[currentStoryId]) {
      showToast && showToast('Нет истории', 'warning');
      return;
    }
    readerManualSave(true);
    var s = storyBooks[currentStoryId];
    var title = s.title || 'story';
    var body = '';
    var mime = 'text/plain';
    var ext = exportFmt;
    var editor = document.getElementById('editor');
    var html = s.content || (editor && editor.innerHTML) || '';
    var text = editor ? (editor.innerText || '') : html.replace(/<[^>]+>/g, ' ');
    if (exportFmt === 'md') {
      body = '# ' + title + '\n\n' + htmlToRoughMd(html);
      mime = 'text/markdown';
    } else if (exportFmt === 'json') {
      body = JSON.stringify({
        title: title,
        content: html,
        canvaData: s.canvaData || null,
        aiGenerated: !!(s.aiGenerated || s.fromAi),
        updated: s.updated || Date.now()
      }, null, 2);
      mime = 'application/json';
    } else {
      body = title + '\n\n' + text;
    }
    var blob = new Blob([body], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (title.replace(/[^\w\u0400-\u04FF\- ]+/g, '').trim() || 'story') + '.' + ext;
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1500);
    closeReaderExportModal();
    showToast && showToast('Скачивание .' + ext, 'success');
  };
  function htmlToRoughMd(html) {
    var d = document.createElement('div');
    d.innerHTML = html || '';
    // very light conversion
    d.querySelectorAll('b,strong').forEach(function(el){ el.replaceWith('**' + el.textContent + '**'); });
    d.querySelectorAll('i,em').forEach(function(el){ el.replaceWith('*' + el.textContent + '*'); });
    d.querySelectorAll('s,strike').forEach(function(el){ el.replaceWith('~~' + el.textContent + '~~'); });
    d.querySelectorAll('br').forEach(function(el){ el.replaceWith('\n'); });
    d.querySelectorAll('p,div').forEach(function(el){ el.appendChild(document.createTextNode('\n\n')); });
    d.querySelectorAll('li').forEach(function(el){ el.prepend(document.createTextNode('- ')); el.appendChild(document.createTextNode('\n')); });
    return (d.innerText || d.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }
  window.exportStory = window.openReaderExportModal;

  /* Canva */
  function getCanva() {
    return document.getElementById('reader-canva');
  }
  function ctx2d() {
    var c = getCanva();
    return c ? c.getContext('2d') : null;
  }
  function resizeCanva() {
    var c = getCanva();
    if (!c) return;
    var parent = c.parentElement;
    var w = Math.max(320, (parent && parent.clientWidth) ? parent.clientWidth - 8 : 600);
    var ratio = c.height / (c.width || 900);
    var data = null;
    try { data = c.toDataURL(); } catch(e){}
    c.width = w;
    c.height = Math.round(w * (320/900));
    if (data) {
      var img = new Image();
      img.onload = function(){ ctx2d().drawImage(img, 0, 0, c.width, c.height); };
      img.src = data;
    }
  }
  function loadCanvaFromStory() {
    var s = story();
    var c = getCanva();
    if (!c || !s || !s.canvaData) return;
    resizeCanva();
    var img = new Image();
    img.onload = function() {
      var ctx = ctx2d();
      ctx.clearRect(0,0,c.width,c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
    };
    img.src = s.canvaData;
  }
  window.toggleReaderCanva = function() {
    canvaVisible = !canvaVisible;
    var block = document.getElementById('reader-canva-block');
    if (block) block.hidden = !canvaVisible;
    if (canvaVisible) {
      setTimeout(function(){ resizeCanva(); bindCanvaDraw(); loadCanvaFromStory(); }, 20);
    } else {
      readerManualSave(true);
    }
  };
  function bindCanvaDraw() {
    var c = getCanva();
    if (!c || c._bound) return;
    c._bound = true;
    function pos(e) {
      var r = c.getBoundingClientRect();
      var x, y;
      if (e.touches && e.touches[0]) {
        x = e.touches[0].clientX - r.left; y = e.touches[0].clientY - r.top;
      } else {
        x = e.clientX - r.left; y = e.clientY - r.top;
      }
      return { x: x * (c.width/r.width), y: y * (c.height/r.height) };
    }
    function start(e) {
      e.preventDefault();
      drawing = true;
      try { canvaUndo = c.toDataURL(); } catch(err){}
      lastPt = pos(e);
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      var ctx = ctx2d();
      var size = document.getElementById('reader-canva-size');
      ctx.strokeStyle = canvaStroke || '#000000';
      ctx.lineWidth = size ? +size.value : 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPt.x, lastPt.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastPt = p;
      setStatus('Несохранено', 'is-dirty');
    }
    function end() {
      if (!drawing) return;
      drawing = false;
      lastPt = null;
      readerManualSave(true);
    }
    c.addEventListener('mousedown', start);
    c.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    c.addEventListener('touchstart', start, {passive:false});
    c.addEventListener('touchmove', move, {passive:false});
    c.addEventListener('touchend', end);
  }
  window.toggleCanvaMoreMenu = function(e) {
    if (e) e.stopPropagation();
    var m = document.getElementById('reader-canva-more-menu');
    if (m) m.hidden = !m.hidden;
  };
  window.readerCanvaClear = function() {
    document.getElementById('reader-canva-more-menu').hidden = true;
    if (!confirm('Сбросить рисунок на чистый холст?\nОтменить можно только CTRL+Z в этой сессии (пока не перезагрузили страницу).')) return;
    var c = getCanva();
    if (!c) return;
    try { canvaUndo = c.toDataURL(); } catch(e){}
    ctx2d().clearRect(0,0,c.width,c.height);
    setStatus('Несохранено', 'is-dirty');
    readerManualSave(true);
  };
  window.readerCanvaUpload = function() {
    document.getElementById('reader-canva-more-menu').hidden = true;
    var f = document.getElementById('reader-canva-file');
    if (!f) return;
    f.onchange = function() {
      var file = f.files && f.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        var img = new Image();
        img.onload = function() {
          var c = getCanva();
          var ctx = ctx2d();
          try { canvaUndo = c.toDataURL(); } catch(e){}
          ctx.clearRect(0,0,c.width,c.height);
          var scale = Math.min(c.width/img.width, c.height/img.height);
          var w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (c.width-w)/2, (c.height-h)/2, w, h);
          readerManualSave(true);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      f.value = '';
    };
    f.click();
  };
  window.readerCanvaDelete = function() {
    document.getElementById('reader-canva-more-menu').hidden = true;
    if (!confirm('Удалить холст и данные рисунка из этой истории?')) return;
    var c = getCanva();
    if (c) ctx2d().clearRect(0,0,c.width,c.height);
    if (currentStoryId && storyBooks[currentStoryId]) {
      delete storyBooks[currentStoryId].canvaData;
      localStorage.setItem('oracle_story_books', JSON.stringify(storyBooks));
    }
    canvaVisible = false;
    var block = document.getElementById('reader-canva-block');
    if (block) block.hidden = true;
    showToast && showToast('Холст удалён', 'success');
  };
  // session undo for canva
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && canvaVisible && canvaUndo) {
      var c = getCanva();
      if (!c) return;
      var img = new Image();
      img.onload = function(){ ctx2d().clearRect(0,0,c.width,c.height); ctx2d().drawImage(img,0,0,c.width,c.height); };
      img.src = canvaUndo;
      e.preventDefault();
    }
  });

  /* AI mark helper for Core Node */
  window.readerAppendAiFragment = function(text, meta) {
    if (!currentStoryId || !storyBooks[currentStoryId]) {
      showToast && showToast('Откройте историю в Reader', 'warning');
      return;
    }
    var editor = document.getElementById('editor');
    var html = '<p class="reader-ai-frag" data-ai="1" style="border-left:3px solid var(--primary);padding-left:10px;opacity:.95;">' +
      String(text || '').replace(/</g,'&lt;').replace(/\n/g,'<br>') +
      '<br><small style="color:var(--on-surface-variant)">ИИ улучшение / генерация</small></p>';
    if (editor) editor.innerHTML = (editor.innerHTML || '') + html;
    storyBooks[currentStoryId].aiEnhanced = true;
    storyBooks[currentStoryId].fromAi = true;
    readerManualSave(true);
    var badge = document.getElementById('reader-ai-badge');
    if (badge) badge.hidden = false;
    if (typeof switchScreen === 'function') switchScreen('reader');
    showToast && showToast('Фрагмент добавлен в Reader', 'success');
  };

  function renderReaderRecent() {
    var box = document.getElementById('reader-recent-list');
    if (!box) return;
    var ids = Object.keys(storyBooks || {});
    if (!ids.length) { box.innerHTML = ''; return; }
    ids.sort(function(a,b){
      return (storyBooks[b].updated||0) - (storyBooks[a].updated||0);
    });
    box.innerHTML = ids.slice(0,5).map(function(id){
      var s = storyBooks[id];
      var ai = (s.aiGenerated||s.fromAi||s.aiEnhanced) ? ' · ИИ' : '';
      return '<button type="button" class="reader-recent-item" onclick="openStoryBook(\''+id.replace(/'/g,"\\'")+'\')">' +
        '<b>'+String(s.title||'Без названия').replace(/</g,'&lt;')+'</b>' +
        '<small>Открыть'+ai+'</small></button>';
    }).join('');
  }

  // toast above download
  try {
    var st = document.getElementById('toast-container');
    if (st) st.style.zIndex = '200000';
  } catch(e){}

  // PWA install
  window._cnPwaPrompt = window._cnPwaPrompt || null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._cnPwaPrompt = e;
    window._deferredPwaPrompt = e;
    window.deferredPWAInstall = e;
  });
  window.tryInstallPWA = async function() {
    var pe = window._cnPwaPrompt || window._deferredPwaPrompt || window.deferredPWAInstall;
    if (pe && pe.prompt) {
      try {
        pe.prompt();
        var choice = await pe.userChoice;
        window._cnPwaPrompt = window._deferredPwaPrompt = window.deferredPWAInstall = null;
        showToast && showToast(choice && choice.outcome === 'accepted' ? 'Установка PWA…' : 'Установка отменена', choice && choice.outcome==='accepted'?'success':'info');
        return;
      } catch(e) {}
    }
    showToast && showToast('В Chrome/Edge: меню → «Установить приложение». Нужен HTTPS и повторный визит.', 'info', 5000);
  };

  document.addEventListener('DOMContentLoaded', function(){
    setupReaderEditor();
    renderReaderRecent();
  });
  setTimeout(function(){ setupReaderEditor(); renderReaderRecent(); }, 400);
  console.log('[CN] reader 2.6.1');
})();

/* ===== script block ===== */

(function(){
  function renderQuickHome() {
    var host = document.getElementById('quick-settings-home');
    if (!host) return;
    var theme = localStorage.getItem('oracle_theme_mode') || 'system';
    var animOn = localStorage.getItem('oracle_animations_fx');
    if (animOn === null) animOn = '1';
    animOn = animOn !== '0';
    var ctxOn = localStorage.getItem('oracle_use_context');
    if (ctxOn === null) ctxOn = '1';
    ctxOn = ctxOn !== '0';
    host.innerHTML =
      '<div class="quick-card">' +
        '<div class="quick-card-head"><span class="material-symbols-rounded">contrast</span><div class="quick-card-title">Тема</div></div>' +
        '<div class="quick-card-sub">Сейчас: <b>' + (theme==='light'?'Светлая':theme==='dark'?'Тёмная':'Системная') + '</b></div>' +
        '<div class="quick-card-actions">' +
          '<button type="button" class="quick-chip'+(theme==='system'?' primary':'')+'" onclick="setThemeMode(\'system\');renderQuickHome()">Системная</button>' +
          '<button type="button" class="quick-chip'+(theme==='light'?' primary':'')+'" onclick="setThemeMode(\'light\');renderQuickHome()">Светлая</button>' +
          '<button type="button" class="quick-chip'+(theme==='dark'?' primary':'')+'" onclick="setThemeMode(\'dark\');renderQuickHome()">Тёмная</button>' +
          '<button type="button" class="quick-chip" onclick="showSection(\'general\')">Все цвета →</button>' +
        '</div></div>' +
      '<div class="quick-card"><div class="quick-card-row">' +
        '<div><div class="quick-card-title">Анимации и спецэффекты</div>' +
        '<div class="quick-card-sub">Для слабых устройств лучше выключить</div></div>' +
        '<label class="switch"><input type="checkbox" '+(animOn?'checked':'')+' onchange="toggleAnimationsFx(this.checked)"><span class="slider"></span></label>' +
      '</div></div>' +
      '<div class="quick-card"><div class="quick-card-row">' +
        '<div><div class="quick-card-title">Контекст чата</div>' +
        '<div class="quick-card-sub">ИИ помнит детали в рамках лимита памяти</div></div>' +
        '<label class="switch"><input type="checkbox" '+(ctxOn?'checked':'')+' onchange="(window.setUseContext?setUseContext(this.checked):(localStorage.setItem(\'oracle_use_context\',this.checked?\'1\':\'0\')))"><span class="slider"></span></label>' +
      '</div></div>' +
      '<div class="quick-card">' +
        '<div class="quick-card-head"><span class="material-symbols-rounded">tune</span><div class="quick-card-title">Боковое меню</div></div>' +
        '<div class="quick-card-sub">Кнопки, поведение при входе, фильтры</div>' +
        '<div class="quick-card-actions"><button type="button" class="quick-chip primary" onclick="showSection(\'sidebar-menu\')">Открыть настройку</button></div>' +
      '</div>' +
      '<div class="quick-card">' +
        '<div class="quick-card-head"><span class="material-symbols-rounded">key</span><div class="quick-card-title">Сторонние API</div></div>' +
        '<div class="quick-card-sub">Подключить Gemini / OpenAI / Claude / Grok</div>' +
        '<div class="quick-card-actions"><button type="button" class="quick-chip" onclick="showSection(\'api-keys\')">API ключи</button>' +
        '<button type="button" class="quick-chip" onclick="showSection(\'limits\')">Лимиты</button></div>' +
      '</div>' +
      '<div class="quick-card">' +
        '<div class="quick-card-head"><span class="material-symbols-rounded">download</span><div class="quick-card-title">Установить приложение</div></div>' +
        '<div class="quick-card-sub">PWA, Windows, Android, Side Core Node</div>' +
        '<div class="quick-card-actions"><button type="button" class="quick-chip primary" onclick="openDownloadAppModal && openDownloadAppModal()">Скачать / установить</button></div>' +
      '</div>';
  }
  window.renderQuickHome = renderQuickHome;

  window.setSbMenuMode = function(v) {
    v = (v === 'editor') ? 'editor' : 'compact';
    localStorage.setItem('oracle_sb_menu_mode', v);
    document.querySelectorAll('.sb-mode-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-mode') === v);
    });
    var wrap = document.getElementById('sb-compact-size-wrap');
    if (wrap) wrap.style.display = (v === 'compact') ? 'block' : 'none';
    document.body.classList.toggle('sb-mode-compact', v === 'compact');
    document.body.classList.toggle('sb-mode-editor', v === 'editor');
    if (typeof showToast === 'function') showToast(v === 'compact' ? 'Компактные кнопки' : 'Просторные кнопки', 'success');
  };
  window.setSbBtnScale = function(v) {
    v = Math.min(1, Math.max(0.5, parseFloat(v) || 0.7));
    localStorage.setItem('oracle_sb_btn_scale', String(v));
    var lab = document.getElementById('sb-size-label');
    if (lab) lab.textContent = v.toFixed(2);
    document.documentElement.style.setProperty('--sb-btn-scale', String(v));
  };

  // default showSection → quick
  var _prevShow = window.showSection;
  window.showSection = function(id) {
    if (!id) id = 'quick';
    if (typeof _prevShow === 'function') {
      try { _prevShow(id); } catch(e) {}
    }
    // ensure only one visible
    document.querySelectorAll('#settings-content .setting-section').forEach(function(s){
      var on = s.id === 'section-' + id;
      s.classList.toggle('section-visible', on);
      s.style.display = on ? 'block' : 'none';
    });
    document.querySelectorAll('#settings-nav-items .nav-item').forEach(function(b){
      b.classList.toggle('active', b.id === 'btn-sec-' + id);
    });
    if (id === 'quick') renderQuickHome();
    if (id === 'sidebar-menu') {
      var mode = localStorage.getItem('oracle_sb_menu_mode') || 'compact';
      setSbMenuMode(mode);
      var scale = localStorage.getItem('oracle_sb_btn_scale') || '0.7';
      var range = document.getElementById('sb-btn-size');
      if (range) range.value = scale;
      setSbBtnScale(scale);
      // restore boot radios
      var boot = localStorage.getItem('oracle_sidebar_boot') || 'remember';
      document.querySelectorAll('input[name="sidebar-boot"]').forEach(function(r){
        r.checked = r.value === boot;
      });
    }
  };

  // boot
  function boot() {
    var mode = localStorage.getItem('oracle_sb_menu_mode') || 'compact';
    document.body.classList.toggle('sb-mode-compact', mode === 'compact');
    var scale = localStorage.getItem('oracle_sb_btn_scale') || '0.7';
    document.documentElement.style.setProperty('--sb-btn-scale', scale);
    // sync anim toggle if present
    var anim = localStorage.getItem('oracle_animations_fx');
    var cb = document.getElementById('toggle-animations-fx');
    if (cb && anim !== null) cb.checked = anim !== '0';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(function(){ if (document.getElementById('section-quick')?.classList.contains('section-visible')) renderQuickHome(); }, 300);
})();

/* ===== script block ===== */

(function(){
  function mark(){
    try {
      var chat = document.getElementById('screen-chat');
      var on = chat && chat.classList.contains('active-screen');
      if (!document.querySelector('.app-screen.active-screen')) {
        if (chat) chat.classList.add('active-screen');
        on = true;
      }
      document.body.classList.toggle('on-chat-screen', !!on);
      if (on && typeof syncEmptyChatLayout === 'function') syncEmptyChatLayout();
      var welcome = document.getElementById('welcome-block');
      var flow = document.getElementById('chat-flow');
      if (welcome && flow && !flow.querySelector('.msg, .user-msg, .ai-msg')) {
        welcome.classList.remove('hidden');
        welcome.style.display = '';
      }
    } catch(e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(mark, 0); setTimeout(mark, 200); });
  else { setTimeout(mark, 0); setTimeout(mark, 200); }
})();
