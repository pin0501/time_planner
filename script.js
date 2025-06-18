let tasks = [];
let selectedDate = '';
let selectedYear = null;
let selectedMonth = null;
let selectedAddTaskCategory = 'default';
let selectedAddTaskTime = '';
let selectedAddTaskDuration = '60';

const aiPlannerState = {
    goal: '',
    goalType: '無',
    intensity: '無',
    // 預設選中早上8點到晚上10點 (22點)
    timeSlotHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] 
};

const HOUR_HEIGHT = 60; 

const CATEGORIES = {
    work:     { name: '工作', color: '#0ea5e9' },
    study:    { name: '學習', color: '#14b8a6' },
    personal: { name: '私人', color: '#f43f5e' },
    sport:    { name: '運動', color: '#f59e0b' },
    chores:   { name: '家務', color: '#64748b' },
    default:  { name: '預設', color: '#9ca3af' }
};

// --- 頁面載入時執行的主要事件監聽器 ---
document.addEventListener('DOMContentLoaded', () => {
    tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    const today = new Date().toISOString().split('T')[0];
    
    document.getElementById('date-start').value = localStorage.getItem('plannerDateStart') || today;
    document.getElementById('date-end').value = localStorage.getItem('plannerDateEnd') || today;
    
    setupPopovers();
    setupEventListeners();
    setupTheme();
    renderTimelineGrid();
    handleDateChange();
    setupCurrentTimeIndicator();
});

function setupEventListeners() {
    document.getElementById('date-start').addEventListener('change', handleDateChange);
    document.getElementById('date-end').addEventListener('change', handleDateChange);
    document.getElementById('theme-checkbox').addEventListener('change', toggleTheme);
    document.getElementById('task-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') addTaskFromInput();
    });
    
    document.getElementById('ai-goal-input').addEventListener('input', (e) => aiPlannerState.goal = e.target.value);
    document.getElementById('ai-goal-type').addEventListener('change', (e) => aiPlannerState.goalType = e.target.value);
    document.getElementById('ai-intensity').addEventListener('change', (e) => aiPlannerState.intensity = e.target.value);

    setupSmartTimeSlots(); // 設定智慧時段選擇器
}

// --- 主題切換 ---
function setupTheme() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.getElementById('theme-checkbox').checked = isDarkMode;
    if (isDarkMode) document.documentElement.classList.add('dark');
}

function toggleTheme(e) {
    document.documentElement.classList.toggle('dark', e.target.checked);
    localStorage.setItem('darkMode', e.target.checked);
}

// --- 新增任務區域的 Popover 設定 ---
function setupPopovers() {
    const timePopover = document.getElementById('time-popover');
    timePopover.innerHTML = '';
    for (let h = 0; h < 24; h++) {
        ['00', '30'].forEach(m => {
            const time = `${String(h).padStart(2, '0')}:${m}`;
            const item = document.createElement('div');
            item.className = 'popover-item';
            item.textContent = time;
            item.onclick = () => {
                selectedAddTaskTime = time;
                document.getElementById('time-selector-btn').classList.add('active');
                togglePopover('time-popover', false);
            };
            timePopover.appendChild(item);
        });
    }
    
    const durationPopover = document.getElementById('duration-popover');
    durationPopover.innerHTML = '';
    [30, 60, 90, 120, 150, 180].forEach(d => {
        const item = document.createElement('div');
        item.className = 'popover-item';
        item.textContent = `${d} 分鐘`;
        item.onclick = () => {
            selectedAddTaskDuration = d.toString();
            document.getElementById('duration-selector-btn').classList.add('active');
            togglePopover('duration-popover', false);
        };
        durationPopover.appendChild(item);
    });
    
    const categoryPopover = document.getElementById('category-popover');
    categoryPopover.innerHTML = ''; 
    Object.keys(CATEGORIES).forEach(key => {
        const category = CATEGORIES[key];
        const item = document.createElement('div');
        item.className = 'category-popover-item';
        item.dataset.categoryKey = key;
        item.innerHTML = `<span class="color-dot" style="background-color: ${category.color};"></span><span class="category-name">${category.name}</span>`;
        item.onclick = () => {
            selectAddTaskCategory(key);
            togglePopover('category-popover', false);
        };
        categoryPopover.appendChild(item);
    });
    
    ['time-selector-btn', 'duration-selector-btn', 'category-selector-btn'].forEach(btnId => {
        const btn = document.getElementById(btnId);
        const popover = btn.querySelector('.popover');
        btn.addEventListener('click', e => {
            e.stopPropagation(); 
            togglePopover(popover.id);
        });
        popover.addEventListener('click', e => e.stopPropagation());
    });
    
    document.addEventListener('click', () => {
        document.querySelectorAll('.popover').forEach(p => p.classList.remove('visible'));
    });
    
    selectAddTaskCategory(selectedAddTaskCategory);
}

function togglePopover(popoverId, forceState) {
    const popover = document.getElementById(popoverId);
    const shouldBeVisible = typeof forceState === 'boolean' ? forceState : !popover.classList.contains('visible');
    document.querySelectorAll('.popover').forEach(p => {
        if(p.id !== popoverId) p.classList.remove('visible');
    });
    popover.classList.toggle('visible', shouldBeVisible);
}

function selectAddTaskCategory(categoryKey) {
    selectedAddTaskCategory = categoryKey;
    const btn = document.getElementById('category-selector-btn');
    btn.classList.toggle('active', categoryKey !== 'default');
    document.querySelectorAll('#category-popover .category-popover-item').forEach(el => {
        const isActive = el.dataset.categoryKey === categoryKey;
        el.classList.toggle('active', isActive);
        el.style.setProperty('--category-border-color', isActive ? (CATEGORIES[categoryKey]?.color || CATEGORIES.default.color) : 'transparent');
    });
}

// --- 日期處理與渲染 ---
function handleDateChange() {
    const start = document.getElementById('date-start').value;
    const end = document.getElementById('date-end').value;
    if (start && end && start <= end) {
        localStorage.setItem('plannerDateStart', start);
        localStorage.setItem('plannerDateEnd', end);
        
        if (!selectedDate || new Date(selectedDate) < new Date(start) || new Date(selectedDate) > new Date(end)) {
            selectedDate = start;
        }
        const currentSelected = new Date(selectedDate);
        selectedYear = currentSelected.getFullYear();
        selectedMonth = currentSelected.getMonth();
        
        renderDateNavigation();
        renderTasks();
        updateCurrentTimeIndicator();
    }
}

function renderDateNavigation() {
    const container = document.getElementById('date-navigation');
    container.innerHTML = '';
    const startStr = document.getElementById('date-start').value;
    const endStr = document.getElementById('date-end').value;
    if (!startStr || !endStr) return;
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    const duration = (end - start) / (1000 * 60 * 60 * 24);

    const showYearSelector = duration > 90 && start.getFullYear() !== end.getFullYear();
    const showMonthSelector = duration > 20 && (start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth());
    
    if (showYearSelector) {
        const years = [...new Set(getDatesBetween(start, end).map(d => new Date(d).getFullYear()))];
        container.appendChild(createButtonGroup(years, 'year', selectedYear, (year) => {
            selectedYear = parseInt(year);
            const firstDayOfYear = getDatesBetween(start, end).find(d => new Date(d).getFullYear() === selectedYear);
            selectedMonth = new Date(firstDayOfYear).getMonth();
            const firstDayOfMonth = getDatesBetween(start,end).find(d => new Date(d).getFullYear() === selectedYear && new Date(d).getMonth() === selectedMonth);
            selectedDate = firstDayOfMonth;
            renderDateNavigation();
            renderTasks();
        }));
    }

    if (showMonthSelector) {
        const months = [...new Set(getDatesBetween(start, end)
            .filter(d => new Date(d).getFullYear() === selectedYear)
            .map(d => new Date(d).getMonth())
        )];
        container.appendChild(createButtonGroup(months, 'month', selectedMonth, (month) => {
            selectedMonth = parseInt(month);
            const firstDayOfMonth = getDatesBetween(start,end).find(d => new Date(d).getFullYear() === selectedYear && new Date(d).getMonth() === selectedMonth);
            selectedDate = firstDayOfMonth;
            renderDateNavigation();
            renderTasks();
        }));
    }

    const days = getDatesBetween(start, end).filter(d => {
        const date = new Date(d);
        return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
    });
    container.appendChild(createButtonGroup(days, 'day', selectedDate, (day) => {
        selectedDate = day;
        renderDateNavigation();
        renderTasks();
        updateCurrentTimeIndicator();
    }));
}

function createButtonGroup(items, type, activeItem, onClick) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex flex-wrap gap-2';
    items.forEach(item => {
        const btn = document.createElement('button');
        const typeClass = `${type}-btn`;
        btn.className = `btn date-nav-btn ${typeClass}`;
        
        let value, text;
        if (type === 'year') { value = item; text = `${item}年`; } 
        else if (type === 'month') { value = item; text = `${item + 1}月`; } 
        else { value = item; text = new Date(item).getDate(); }

        btn.dataset.value = value;
        btn.textContent = text;
        if (value == activeItem) btn.classList.add('active');
        btn.addEventListener('click', (e) => onClick(e.target.dataset.value));
        wrapper.appendChild(btn);
    });
    return wrapper;
}

function getDatesBetween(start, end) {
    const dates = [];
    let current = new Date(new Date(start).setUTCHours(0,0,0,0));
    const stop = new Date(new Date(end).setUTCHours(0,0,0,0));
    while (current <= stop) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

// --- 任務列表與時間軸渲染 ---
function renderTasks() {
    document.getElementById('date-display').textContent = selectedDate;
    const list = document.getElementById('task-list');
    list.innerHTML = '';
    const filteredTasks = tasks
        .map((task, index) => ({ ...task, originalIndex: index })) 
        .filter(task => task.date === selectedDate)
        .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

    if (filteredTasks.length === 0) {
        list.innerHTML = `<div class="text-center py-6" style="color: var(--color-text-muted);">這天沒有任務</div>`;
    } else {
        filteredTasks.forEach(task => {
            const li = document.createElement('li');
            li.id = `task-item-${task.originalIndex}`;
            li.className = 'task-item';
            if (task.done) li.classList.add('done');
            
            const timeRange = getTaskTimeRange(task.time, task.duration);
            const hasDetails = task.details && task.details.trim() !== '';

            li.innerHTML = `
                <div class="task-main-info flex items-center p-3">
                    <button title="顯示/隱藏說明" class="details-toggle-btn text-gray-400 hover:text-blue-500 mr-2 ${hasDetails ? '' : 'invisible'}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <div class="category-dot" style="background-color: ${CATEGORIES[task.category]?.color || CATEGORIES.default.color};"></div>
                    <input type="checkbox" ${task.done ? 'checked' : ''} class="w-5 h-5 rounded-sm mr-2 border-gray-300 text-blue-500 focus:ring-blue-500 flex-shrink-0" onchange="toggleTask(${task.originalIndex})">
                    <div class="flex-grow">
                        <span class="task-name font-medium">${task.name}</span>
                        ${timeRange ? `<div class="text-sm" style="color: var(--color-text-muted);">${timeRange}</div>` : ''}
                    </div>
                    <button title="編輯任務" class="ml-4 text-gray-400 hover:text-blue-500" onclick="showEditModal(${task.originalIndex})">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                    </button>
                    <button title="刪除任務" class="ml-2 text-gray-400 hover:text-red-500" onclick="confirmDeleteTask(${task.originalIndex})">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                    </button>
                </div>
                <div class="task-details ml-8">${hasDetails ? task.details.replace(/\n/g, '<br>') : ''}</div>
            `;
            list.appendChild(li);
        });
        document.querySelectorAll('.details-toggle-btn').forEach(btn => btn.addEventListener('click', toggleDetails));
    }
    renderTimeline(filteredTasks);
}

function renderTimelineGrid() {
    const grid = document.getElementById('timeline-grid');
    grid.innerHTML = '';
    for (let hour = 0; hour < 24; hour++) {
        const hourEl = document.createElement('div');
        hourEl.className = 'timeline-hour';
        hourEl.textContent = `${String(hour).padStart(2, '0')}:00`;
        grid.appendChild(hourEl);
    }
}

function renderTimeline(dayTasks) {
    const tasksContainer = document.getElementById('timeline-tasks');
    tasksContainer.innerHTML = '';
    const tasksWithTime = dayTasks.filter(task => task.time && task.duration).sort((a,b) => a.time.localeCompare(b.time));
    
    const layout = [];
    tasksWithTime.forEach(task => {
        const [hour, minute] = task.time.split(':').map(Number);
        const startMinutes = hour * 60 + minute;
        const endMinutes = startMinutes + parseInt(task.duration);
        let placed = false;
        for (let i = 0; i < layout.length; i++) {
            if (layout[i].every(t => endMinutes <= t.startMinutes || startMinutes >= t.endMinutes)) {
                layout[i].push({ ...task, startMinutes, endMinutes });
                placed = true;
                break;
            }
        }
        if (!placed) { layout.push([{ ...task, startMinutes, endMinutes }]); }
    });
    
    const totalColumns = layout.length || 1;
    layout.forEach((column, colIndex) => {
        column.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = 'timeline-task-block';
            if (task.done) taskEl.classList.add('done');
            const top = (task.startMinutes / 60) * HOUR_HEIGHT;
            const height = (task.duration / 60) * HOUR_HEIGHT;
            const taskColor = CATEGORIES[task.category]?.color || CATEGORIES.default.color;
            const timeRange = getTaskTimeRange(task.time, task.duration);
            
            taskEl.style.top = `${top}px`;
            taskEl.style.height = `${Math.max(height, 25)}px`;
            taskEl.style.left = `calc(65px + ${(colIndex / totalColumns) * 100}%)`;
            taskEl.style.width = `calc(${(1 / totalColumns) * 100}% - 7px)`;
            
            const rgb = hexToRgb(taskColor);
            if(rgb) {
                taskEl.style.setProperty('--task-bg-start', `rgba(${rgb}, 0.85)`);
                taskEl.style.setProperty('--task-bg-end', `rgba(${rgb}, 0.65)`);
            }
            taskEl.style.setProperty('--task-border-color', taskColor);
            taskEl.innerHTML = `<strong class="task-name">${task.name}</strong><span class="task-time-range">${timeRange}</span>`;
            taskEl.onclick = () => highlightTaskInList(task.originalIndex);
            tasksContainer.appendChild(taskEl);
        });
    });
}

function getTaskTimeRange(time, duration) {
    if (!time || !duration) return null;
    const [startHour, startMinute] = time.split(':').map(Number);
    const endMoment = new Date();
    endMoment.setHours(startHour, startMinute + parseInt(duration), 0);
    const endTime = `${String(endMoment.getHours()).padStart(2,'0')}:${String(endMoment.getMinutes()).padStart(2,'0')}`;
    return `${time} - ${endTime}`;
}

function toggleDetails(event) {
    const btn = event.currentTarget;
    const taskItem = btn.closest('.task-item');
    const details = taskItem.querySelector('.task-details');
    if (details) {
        btn.classList.toggle('open');
        details.classList.toggle('show');
    }
}

function highlightTaskInList(index) {
    document.querySelectorAll('.task-item').forEach(el => el.classList.remove('highlight'));
    const targetElement = document.getElementById(`task-item-${index}`);
    if(targetElement) {
        targetElement.classList.add('highlight');
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function hexToRgb(hex) {
    if(!hex) return null;
    let r = 0, g = 0, b = 0;
    if (hex.length == 4) { r = "0x" + hex[1] + hex[1]; g = "0x" + hex[2] + hex[2]; b = "0x" + hex[3] + hex[3]; } 
    else if (hex.length == 7) { r = "0x" + hex[1] + hex[2]; g = "0x" + hex[3] + hex[4]; b = "0x" + hex[5] + hex[6]; }
    return `${+r},${+g},${+b}`;
}

function setupCurrentTimeIndicator() {
    updateCurrentTimeIndicator();
    setInterval(updateCurrentTimeIndicator, 60000); 
}

function updateCurrentTimeIndicator() {
    const indicator = document.getElementById('timeline-current-time');
    const today = new Date().toISOString().split('T')[0];
    if (selectedDate === today) {
        indicator.classList.remove('hidden');
        const now = new Date();
        const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
        const topPosition = (minutesSinceMidnight / 60) * HOUR_HEIGHT;
        indicator.style.top = `${topPosition}px`;
    } else {
        indicator.classList.add('hidden');
    }
}

// --- 任務 CRUD (Create, Read, Update, Delete) ---
function saveTasks() { localStorage.setItem('tasks', JSON.stringify(tasks)); }

function addTaskFromInput(){
    const input = document.getElementById('task-input');
    const name = input.value.trim();
    if (!name) { showToast('請輸入任務內容！', 'error'); return; }
    if (!selectedDate) { showToast('請先選擇一個日期！', 'error'); return; }
    
    createTask(name, selectedAddTaskTime, selectedDate, selectedAddTaskDuration, selectedAddTaskCategory, '');
    
    input.value = '';
    selectedAddTaskTime = '';
    selectedAddTaskDuration = '60';
    selectAddTaskCategory('default');
    document.querySelectorAll('.icon-btn').forEach(btn => btn.classList.remove('active'));
    showToast('任務新增成功！', 'success');
}

function createTask(name, time, date, duration, category, details) {
    if (!name || !date) return;
    tasks.push({ name, time: time || '', date, duration: duration || '60', category: category || 'default', details: details || '', done: false });
    saveTasks();
    if (date === selectedDate) renderTasks();
}

function toggleTask(index) {
    tasks[index].done = !tasks[index].done;
    saveTasks();
    renderTasks();
}

function confirmDeleteTask(index) {
    showConfirmation('確定要刪除此任務嗎？', '此操作無法復原。', () => deleteTask(index));
}

function deleteTask(index) {
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
    showToast('任務已刪除', 'success');
}

function confirmClearTasks() {
    showConfirmation('確定要清除所有任務嗎？', '此操作將清除所有日期的所有任務，無法復原。', () => clearTasks());
}

function clearTasks() {
    tasks = [];
    saveTasks();
    handleDateChange();
    showToast('所有任務已清除', 'success');
}

function showEditModal(index) {
    const task = tasks[index];
    if (!task) return;
    
    document.getElementById('edit-task-index').value = index;
    document.getElementById('edit-task-name').value = task.name;
    document.getElementById('edit-task-details').value = task.details || '';
    document.getElementById('edit-task-time').value = task.time;
    document.getElementById('edit-task-duration').value = task.duration;
    
    const categorySelect = document.getElementById('edit-task-category');
    categorySelect.innerHTML = '';
    Object.keys(CATEGORIES).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = CATEGORIES[key].name;
        if (key === task.category) option.selected = true;
        categorySelect.appendChild(option);
    });

    showModal('edit-task-modal');
}

function updateTask() {
    const index = document.getElementById('edit-task-index').value;
    if (index === '' || !tasks[index]) return;
    
    tasks[index].name = document.getElementById('edit-task-name').value;
    tasks[index].details = document.getElementById('edit-task-details').value;
    tasks[index].time = document.getElementById('edit-task-time').value;
    tasks[index].duration = document.getElementById('edit-task-duration').value;
    tasks[index].category = document.getElementById('edit-task-category').value;
    
    saveTasks();
    renderTasks();
    hideModal('edit-task-modal');
    showToast('任務更新成功！', 'success');
}

// --- 匯入/匯出 ---
function importTasks(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedTasks = JSON.parse(e.target.result);
            if (Array.isArray(importedTasks)) {
                tasks = importedTasks;
                saveTasks();
                if (tasks.length > 0) {
                    const dates = tasks.map(t => new Date(t.date));
                    const minDate = new Date(Math.min(...dates));
                    const maxDate = new Date(Math.max(...dates));
                    document.getElementById('date-start').value = minDate.toISOString().split('T')[0];
                    document.getElementById('date-end').value = maxDate.toISOString().split('T')[0];
                    selectedDate = minDate.toISOString().split('T')[0]; 
                }
                showToast('成功匯入任務！', 'success');
                handleDateChange();
            } else { throw new Error('檔案格式不符'); }
        } catch (err) { showToast('匯入失敗，請檢查檔案格式。', 'error'); }
    };
    reader.readAsText(file);
}

function exportTasks() {
    if (tasks.length === 0) { showToast('沒有任務可以匯出。', 'error'); return; }
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// --- Modal & Toast 通用函式 ---
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

function showConfirmation(title, body, onConfirm) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-body').textContent = body;
    
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', () => {
        onConfirm();
        hideModal('confirm-modal');
    });

    document.getElementById('confirm-modal-cancel').onclick = () => hideModal('confirm-modal');
    showModal('confirm-modal');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// --- 智慧時段選擇器邏輯 ---
const PRESET_HOURS = {
    morning: [8, 9, 10, 11],
    afternoon: [13, 14, 15, 16, 17],
    evening: [19, 20, 21, 22]
};

function setupSmartTimeSlots() {
    const bar = document.querySelector('#smart-timeslot-bar .grid');
    bar.innerHTML = '';
    for (let i = 0; i < 24; i++) {
        const hourBlock = document.createElement('div');
        hourBlock.className = 'timeslot-hour';
        hourBlock.dataset.hour = i;
        bar.appendChild(hourBlock);
        hourBlock.addEventListener('click', () => handleHourClick(i));
    }
    document.querySelectorAll('#ai-timeslot-presets .timeslot-btn').forEach(btn => {
        btn.addEventListener('click', () => handlePresetClick(btn.dataset.preset));
    });
    updateSmartTimeSlotUI();
}

function handleHourClick(hour) {
    const index = aiPlannerState.timeSlotHours.indexOf(hour);
    if (index > -1) aiPlannerState.timeSlotHours.splice(index, 1);
    else aiPlannerState.timeSlotHours.push(hour);
    updateSmartTimeSlotUI();
}

function handlePresetClick(preset) {
    if (preset === 'clear') {
        aiPlannerState.timeSlotHours = [];
    } else {
        const hoursToAdd = PRESET_HOURS[preset];
        const isAlreadyAdded = hoursToAdd.every(h => aiPlannerState.timeSlotHours.includes(h));
        if (isAlreadyAdded) {
            aiPlannerState.timeSlotHours = aiPlannerState.timeSlotHours.filter(h => !hoursToAdd.includes(h));
        } else {
            aiPlannerState.timeSlotHours = [...new Set([...aiPlannerState.timeSlotHours, ...hoursToAdd])];
        }
    }
    updateSmartTimeSlotUI();
}

function updateSmartTimeSlotUI() {
    aiPlannerState.timeSlotHours.sort((a,b) => a - b);
    for (let i = 0; i < 24; i++) {
        const hourBlock = document.querySelector(`#smart-timeslot-bar [data-hour="${i}"]`);
        if (hourBlock) hourBlock.classList.toggle('active', aiPlannerState.timeSlotHours.includes(i));
    }
    Object.keys(PRESET_HOURS).forEach(preset => {
        const btn = document.querySelector(`#ai-timeslot-presets [data-preset="${preset}"]`);
        if (btn) {
            const isAlreadyAdded = PRESET_HOURS[preset].every(h => aiPlannerState.timeSlotHours.includes(h));
            btn.classList.toggle('active', isAlreadyAdded);
        }
    });
}

function convertHoursToPromptString() {
    if (aiPlannerState.timeSlotHours.length === 0) return '任意時段';
    if (aiPlannerState.timeSlotHours.length === 24) return '全天任意時段';

    const hours = [...aiPlannerState.timeSlotHours];
    if (hours.length === 0) return '任意時段'; // Double check for safety
    
    const ranges = [];
    let start = hours[0];
    let end = hours[0];

    for (let i = 1; i < hours.length; i++) {
        if (hours[i] === end + 1) {
            end = hours[i];
        } else {
            ranges.push(`${String(start).padStart(2, '0')}:00-${String(end + 1).padStart(2, '0')}:00`);
            start = hours[i];
            end = hours[i];
        }
    }
    ranges.push(`${String(start).padStart(2, '0')}:00-${String(end + 1).padStart(2, '0')}:00`);
    return ranges.join(', ');
}

// --- AI 規劃核心邏輯 ---
function showAIPlannerModal() {
    const start = document.getElementById('date-start').value;
    const end = document.getElementById('date-end').value;
    if (!start || !end) {
        showToast("請先設定有效的起始和結束日期！", "error");
        return;
    }
    document.getElementById('ai-planner-range').textContent = `${start} 到 ${end}`;
    
    document.getElementById('ai-goal-input').value = aiPlannerState.goal;
    document.getElementById('ai-goal-type').value = aiPlannerState.goalType;
    document.getElementById('ai-intensity').value = aiPlannerState.intensity;
    
    updateSmartTimeSlotUI();
    showModal('ai-planner-modal');
}

async function generateGlobalPlan() {
    if (!aiPlannerState.goal) {
        showToast('請輸入您的主要目標！', 'error');
        return;
    }
    
    const startDate = document.getElementById('date-start').value;
    const endDate = document.getElementById('date-end').value;
    const timeSlotForPrompt = convertHoursToPromptString();

    let prompt = `你是一位經驗豐富、嚴謹的AI專案規劃助理，擅長根據使用者的總體目標，安排出合理、密集、具可行性的每日行程。
    請依據以下資訊進行任務規劃：使用者目標：${aiPlannerState.goal}、時間範圍：${startDate} 至 ${endDate}、目標類型：${aiPlannerState.goalType}、安排強度：「${aiPlannerState.intensity}」、時段偏好：「${timeSlotForPrompt}」
    ---
    請理解總體目標，將總體目標拆解為一系列具體子任務，並根據時間範圍與強度，**將每日安排任務的總時數控制在指定範圍內，平均分散至時間範圍：${startDate} 至 ${endDate}當中每天**。可為每日安排多個任務細項，避免使任務過於籠統。

    ### 對每個子任務，請提供以下資訊（回傳格式為 JSON 陣列）：
    - 'taskName'：具體明確的子任務名稱。
    - 'category'：任務類別，從 ['work', 'study', 'personal', 'sport', 'chores'] 中選擇。
    - 'duration'：此任務需要的時間（單位為分鐘，如 30、60、90、120、150）。
    - 'date'：任務安排的日期（格式：YYYY-MM-DD），**絕對不能超出 ${startDate} 和 ${endDate} 的範圍**。
    - 'time'：建議的開始時間（格式為 HH:MM，**必須是有效的 24 小時制時間，例如 09:30 或 22:00，不得出現 24:00 或之後的時間**）。
    - 'details'：數句簡要說明，清楚任務內容與重點。

    ### 請嚴格遵守以下規則：
    1.  **語言一致性**：所有輸出的文字內容，特別是 'taskName' 和 'details'，**都必須使用與使用者目標相同的語言（繁體中文）**。
    2.  **時間與日期限制**：嚴格遵守 'date' 和 'time' 的格式與範圍限制，絕不創造不存在的日期或時間。
    3.  **處理超載任務**：如果總體目標過於繁重，無法在指定時間內完成，你應該優先安排最重要的核心任務。對於排不進的次要任務，請在最後一個任務的 'details' 中附註說明，例如：「部分任務因時間限制未排入，建議延長規劃期間或調整目標。」
    4.  **任務不重疊**：確保同一天內任務的時間區間不會互相重疊，並在任務間保留適當緩衝。
    5.  **邏輯順序**：若任務屬於學習或技能訓練，請適度考慮循序漸進的安排（例如先理論，再實作）。
    `;
    
    showModal('loading-modal');
    hideModal('ai-planner-modal');

    try {
        const generatedPlan = await callBackendAPI(prompt);
        
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        generatedPlan.forEach(task => {
            if (task.date === today && task.time < currentTime) return;
            if (new Date(task.date) >= new Date(startDate) && new Date(task.date) <= new Date(endDate)) {
                createTask(task.taskName, task.time, task.date, task.duration, task.category, task.details);
            } else {
                createTask(task.taskName, task.time, startDate, task.duration, task.category, task.details);
            }
        });
        renderTasks();
        showToast('AI 計畫已成功生成！', 'success');
    } catch (error) {
        console.error("Error generating plan:", error);
        showToast(error.message, "error");
    } finally {
        hideModal('loading-modal');
    }
}

async function callBackendAPI(prompt) {
    const response = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt }),
    });

    if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.message || `請求失敗，狀態碼: ${response.status}`);
    }

    const result = await response.json();
    return result;
}
