// --- App State & Configuration ---
const STATE = {
    dailyGoal: 2000,
    caloriesEaten: 0,
    caloriesBurned: 0,
    waterGlasses: 0,
    waterGoal: 8,
    steps: 0,
    stepsGoal: 10000,
    sleepHours: 7.5,
    weight: 70,
    logs: [],
    medications: [],
    mood: null,
    theme: 'light',
    hasOnboarded: false
};

// --- Element Selectors ---
const els = {
    // Overlays & Modals
    modalOverlay: document.getElementById('modalOverlay'),
    allModals: document.querySelectorAll('.modal'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    onboarding: document.getElementById('onboarding'),

    // Dashboard Readouts
    calRemaining: document.getElementById('calRemaining'),
    waterCount: document.getElementById('waterCount'),
    waterLevel: document.getElementById('waterLevel'),
    stepsCount: document.getElementById('stepsCount'),
    sleepHours: document.getElementById('sleepHours'),
    weightVal: document.getElementById('weightVal'),
    currentMoodDisplay: document.getElementById('currentMoodDisplay'),

    // Rings
    calRing: document.getElementById('calRing'),
    stepsRing: document.getElementById('stepsRing'),

    // Forms & Inputs
    trackerForm: document.getElementById('trackerForm'),
    stepsForm: document.getElementById('stepsForm'),
    sleepForm: document.getElementById('sleepForm'),
    metricsForm: document.getElementById('metricsForm'),
    medsForm: document.getElementById('medsForm'),
    settingsForm: document.getElementById('settingsForm'),
    
    // Dynamic Lists
    logList: document.getElementById('activityLog'),
    medList: document.getElementById('medList'),

    // Navigation
    sidebarLinks: document.querySelectorAll('.sidebar-link'),
    dashboardContent: document.getElementById('dashboard-content'),
    profileSection: document.getElementById('profile-section'),
    allSections: document.querySelectorAll('.dashboard-section'),

    // Other
    currentDate: document.getElementById('currentDate')
};

// --- NAVIGATION --- 

function switchCategory(category) {
    els.sidebarLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick') === `switchCategory('${category}')`) {
            link.classList.add('active');
        }
    });

    els.dashboardContent.style.display = 'none';
    els.profileSection.style.display = 'none';
    els.allSections.forEach(section => section.style.display = 'none');

    if (category === 'profile') {
        els.profileSection.style.display = 'block';
    } else {
        els.dashboardContent.style.display = 'block';
        if (category === 'all') {
            els.allSections.forEach(section => section.style.display = 'block');
        } else {
            const sectionToShow = document.getElementById(`${category}-section`);
            if(sectionToShow) {
                sectionToShow.style.display = 'block';
            }
        }
    }
}

// --- DATA MANAGEMENT (LOCAL STORAGE) ---

function saveState() {
    localStorage.setItem('myHealthData', JSON.stringify(STATE));
}

function loadState() {
    const savedData = localStorage.getItem('myHealthData');
    if (savedData) {
        const parsedData = JSON.parse(savedData);
        Object.assign(STATE, parsedData);
    }
    const today = getTodayDateString();
    if(localStorage.getItem('lastUsedDate') !== today) {
        STATE.logs = [];
        STATE.caloriesEaten = 0;
        STATE.caloriesBurned = 0;
        STATE.waterGlasses = 0;
        STATE.steps = 0;
        localStorage.setItem('lastUsedDate', today);
    }
}

// --- CORE LOGIC ---

function addLog(logItem) {
    STATE.logs.push(logItem);
    if (logItem.type === 'food') {
        STATE.caloriesEaten += logItem.value;
    } else if (logItem.type === 'exercise' || logItem.type === 'workout') {
        STATE.caloriesBurned += logItem.value;
    } else if (logItem.type === 'water') {
        STATE.waterGlasses += 1;
    }
}

function deleteLog(id) {
    const logIndex = STATE.logs.findIndex(l => l.id === id);
    if (logIndex === -1) return;
    const logItem = STATE.logs[logIndex];
    if (logItem.type === 'food') STATE.caloriesEaten -= logItem.value;
    else if (logItem.type === 'exercise' || logItem.type === 'workout') STATE.caloriesBurned -= logItem.value;
    else if (logItem.type === 'water') STATE.waterGlasses -= 1;
    STATE.logs.splice(logIndex, 1);
    saveState();
    updateUI();
}

function clearAllData() {
    if (confirm("Are you sure you want to reset all of today's data?")) {
        STATE.logs = [];
        STATE.caloriesEaten = 0;
        STATE.caloriesBurned = 0;
        STATE.waterGlasses = 0;
        STATE.steps = 0;
        saveState();
        updateUI();
    }
}

// --- UI UPDATES ---

function updateUI() {
    // Net Calories
    const netCalories = STATE.caloriesEaten - STATE.caloriesBurned;
    const remaining = STATE.dailyGoal - netCalories;
    els.calRemaining.textContent = remaining.toLocaleString();

    // Water
    els.waterCount.textContent = STATE.waterGlasses;
    const waterPercent = Math.min((STATE.waterGlasses / STATE.waterGoal) * 100, 100);
    els.waterLevel.style.height = `${waterPercent}%`;

    // Steps & Sleep & Weight
    els.stepsCount.textContent = STATE.steps.toLocaleString();
    els.sleepHours.textContent = STATE.sleepHours;
    els.weightVal.textContent = STATE.weight;

    // Mood
    if (STATE.mood) {
        els.currentMoodDisplay.textContent = `Feeling ${STATE.mood} today!`
    } else {
        els.currentMoodDisplay.textContent = 'No mood logged yet.'
    }

    // Rings (Circumference = 2 * PI * 45 = 282.7)
    const circumference = 282.7;
    const calPercent = Math.min(STATE.caloriesEaten / STATE.dailyGoal, 1);
    els.calRing.style.strokeDashoffset = circumference - (calPercent * circumference);

    const stepsPercent = Math.min(STATE.steps / STATE.stepsGoal, 1);
    els.stepsRing.style.strokeDashoffset = circumference - (stepsPercent * circumference);

    renderLogs();
    renderMeds();
    applyTheme();
}

function renderLogs() {
    els.logList.innerHTML = '';
    if (STATE.logs.length === 0) {
        els.logList.innerHTML = '<div class="card" style="text-align: center; padding: 40px;"><p>No activity logged yet today.</p></div>';
        return;
    }
    STATE.logs.slice().reverse().forEach(log => {
        const item = document.createElement('div');
        item.className = 'log-item';
        let valueLabel = '';
        if (log.type === 'food' || log.type === 'exercise') valueLabel = `${log.value.toLocaleString()} kcal`;
        else if (log.type === 'water') valueLabel = '1 Glass';

        item.innerHTML = `
            <div class="log-info"><h4>${log.name}</h4><p style="font-size: 12px; opacity: 0.6;">${new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></div>
            <div style="display: flex; align-items: center; gap: 16px;">
                <span class="log-value ${log.type === 'exercise' ? 'val-positive' : ''}">${valueLabel}</span>
                <button onclick="deleteLog(${log.id})" class="btn-icon" style="width:32px; height:32px; border-radius:8px; color: #ef4444;">&times;</button>
            </div>`;
        els.logList.appendChild(item);
    });
}

function renderMeds() {
    els.medList.innerHTML = '';
    if (STATE.medications.length === 0) {
        els.medList.innerHTML = '<div class="empty-state-mini">No meds scheduled</div>';
        return;
    }
    STATE.medications.forEach(med => {
        const medItem = document.createElement('div');
        medItem.className = 'med-item';
        medItem.innerHTML = `<span>${med.name} at ${med.time}</span><input type="checkbox">`;
        els.medList.appendChild(medItem);
    });
}

function applyTheme() {
    document.body.classList.toggle('dark-mode', STATE.theme === 'dark');
}

// --- MODALS & INTERACTIONS ---

function openModal(modalId) {
    const modalToOpen = document.getElementById(modalId);
    if (modalToOpen) {
        els.modalOverlay.classList.add('active');
        modalToOpen.style.display = 'block';
    }
}

function closeModal() {
    els.modalOverlay.classList.remove('active');
    els.allModals.forEach(modal => modal.style.display = 'none');
}

// --- EVENT HANDLERS ---

// Main form for calories/exercise
els.trackerForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('itemName').value;
    const value = parseFloat(document.getElementById('itemValue').value);
    const type = document.querySelector('input[name="entryType"]:checked').value;
    if (!name || isNaN(value)) return alert("Please enter valid data.");

    addLog({ id: Date.now(), name, value, type, timestamp: Date.now(), date_string: getTodayDateString() });
    saveState();
    updateUI();
    closeModal();
    e.target.reset();
});

// Steps form
els.stepsForm.addEventListener('submit', e => {
    e.preventDefault();
    const steps = parseInt(document.getElementById('stepAmount').value);
    if (isNaN(steps) || steps < 0) return alert("Please enter a valid number of steps.");
    STATE.steps += steps;
    saveState();
    updateUI();
    closeModal();
    e.target.reset();
});

// Sleep form
els.sleepForm.addEventListener('submit', e => {
    e.preventDefault();
    const hours = parseFloat(document.getElementById('sleepHoursInput').value);
    if (isNaN(hours) || hours < 0) return alert("Please enter a valid number of hours.");
    STATE.sleepHours = hours;
    saveState();
    updateUI();
    closeModal();
    e.target.reset();
});

// Weight/Metrics form
els.metricsForm.addEventListener('submit', e => {
    e.preventDefault();
    const weight = parseFloat(document.getElementById('weightInput').value);
    if (isNaN(weight) || weight < 0) return alert("Please enter a valid weight.");
    STATE.weight = weight;
    saveState();
    updateUI();
    closeModal();
    e.target.reset();
});

// Medication form
els.medsForm.addEventListener('submit', e => {
    e.preventDefault();
    const medName = document.getElementById('medName').value;
    const medTime = document.getElementById('medTime').value;
    if (!medName || !medTime) return alert("Please enter medication details.");
    STATE.medications.push({ name: medName, time: medTime });
    saveState();
    updateUI();
    closeModal();
    e.target.reset();
});

function addWater() {
    addLog({ id: Date.now(), name: '1 Glass of Water', value: 1, type: 'water', timestamp: Date.now(), date_string: getTodayDateString() });
    saveState();
    updateUI();
}

function logWorkout(workoutType) {
    const calories = workoutType === 'Run' ? 300 : workoutType === 'Cycle' ? 200 : 400; // Example values
    addLog({ id: Date.now(), name: workoutType, value: calories, type: 'exercise', timestamp: Date.now(), date_string: getTodayDateString() });
    saveState();
    updateUI();
}

function logMood(mood) {
    STATE.mood = mood;
    saveState();
    updateUI();
}

function openAddModal(type) {
    document.getElementById('modalTitle').textContent = type === 'food' ? 'Add Food' : 'Add Exercise';
    document.querySelector(`input[name="entryType"][value="${type}"]`).checked = true;
    openModal('inputModal');
}

function openSettings() {
    openModal('settingsModal');
}

function finishOnboarding() {
    STATE.hasOnboarded = true;
    saveState();
    if(els.onboarding) els.onboarding.style.display = 'none';
}

// --- UTILITY FUNCTIONS ---
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

// --- INITIALIZATION ---
function init() {
    loadState();

    if (els.currentDate) {
        els.currentDate.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    
    if (!STATE.hasOnboarded && els.onboarding) {
        els.onboarding.style.display = 'flex';
    } else if (els.onboarding) {
        els.onboarding.style.display = 'none';
    }
    
    switchCategory('all');
    updateUI();

    els.modalOverlay.addEventListener('click', (e) => {
        if (e.target === els.modalOverlay) closeModal();
    });

    console.log("Health Tracker Initialized (Complete)");
}

// Run the app
init();
