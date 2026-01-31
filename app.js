// Supabase Configuration
const SUPABASE_URL = 'https://qwntcncvumahrenpjndh.supabase.co'; // Replace with your project URL
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3bnRjbmN2dW1haHJlbnBqbmRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MzkzMzYsImV4cCI6MjA4MzQxNTMzNn0.g0HzLyJ1oARzh4ehUP0dXCE0rCih94vSMYUuv6c-OJg'; // Replace with your anon key
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// State Management
const STATE = {
    user: null, // Logged in user
    dailyGoal: 2000,
    caloriesEaten: 0,
    caloriesBurned: 0,
    waterGlasses: 0,
    waterGoal: 8,
    heartRate: 72,
    spo2: 98,
    steps: 0,
    stepsGoal: 10000,
    sleepHours: 7.5,
    weight: 70,
    bmi: 22.5,
    stressLevel: 'Low',
    mood: 'Good',
    macros: { p: 0, c: 0, f: 0 },
    medList: [],
    logs: [],
    history: [],
    theme: 'light',
    notifications: { enabled: false, water: false },
    activeCategory: 'all'
};

let mainChart = null; // Global chart instance

// Selectors
const els = {
    appContainer: document.getElementById('appContainer'),
    calRemaining: document.getElementById('calRemaining'),
    waterCount: document.getElementById('waterCount'),
    waterLevel: document.getElementById('waterLevel'),
    bpmValue: document.getElementById('bpmValue'),
    spo2Value: document.getElementById('spo2Value'),
    stepsCount: document.getElementById('stepsCount'),
    stepsRing: document.getElementById('stepsRing'),
    sleepHours: document.getElementById('sleepHours'),
    stressValue: document.getElementById('stressValue'),
    stressFill: document.getElementById('stressFill'),
    currentMoodDisplay: document.getElementById('currentMoodDisplay'),
    weightVal: document.getElementById('weightVal'),
    bmiVal: document.getElementById('bmiVal'),
    medList: document.getElementById('medList'),
    macroP: document.getElementById('macroP'),
    macroC: document.getElementById('macroC'),
    macroF: document.getElementById('macroF'),
    logList: document.getElementById('activityLog'),
    modalOverlay: document.getElementById('modalOverlay'),
    trackerForm: document.getElementById('trackerForm'),
    currentDate: document.getElementById('currentDate'),
    onboarding: document.getElementById('onboarding'),
    weeklyChart: document.getElementById('weeklyChart'),
    authOverlay: document.getElementById('authOverlay'),
    authForm: document.getElementById('authForm'),
    authError: document.getElementById('authError'),
    authBtn: document.getElementById('authBtn')
};

// --- DATA PERSISTENCE & SYNCING ---

async function fetchState() {
    const today = getTodayDateString();

    // 1. Try to load local data first for speed
    const localData = JSON.parse(localStorage.getItem('myhealth_v2_data') || '{}');
    applyStateFromData(localData, today);

    // 2. If logged in, fetch from Supabase to overwrite/sync
    if (STATE.user) {
        try {
            // Fetch logs for today
            const { data: logData } = await supabase.from('logs').select('*').eq('date_string', today);
            if (logData) STATE.logs = logData;

            // Fetch stats (vitals, goals)
            const { data: statsData } = await supabase.from('user_stats').select('*').single();
            if (statsData) {
                STATE.heartRate = statsData.heart_rate;
                STATE.steps = statsData.steps;
                STATE.sleepHours = statsData.sleep_hours;
                STATE.spo2 = statsData.spo2;
                STATE.weight = statsData.weight;
                STATE.bmi = statsData.bmi;
                STATE.stressLevel = statsData.stress_level;
                STATE.mood = statsData.mood;
                STATE.medList = statsData.med_list;
                STATE.macros = statsData.macros;
            }

            const { data: settingsData } = await supabase.from('settings').select('*').single();
            if (settingsData) {
                STATE.dailyGoal = settingsData.daily_goal;
                STATE.waterGoal = settingsData.water_goal;
                STATE.stepsGoal = settingsData.steps_goal;
                STATE.theme = settingsData.theme;
            }
        } catch (err) { console.warn("Supabase Fetch Error:", err); }
    }

    calculateTotals();
    updateUI();
    applyTheme();
}

function applyStateFromData(data, today) {
    const settings = data.settings || { daily_goal: 2000, water_goal: 8, theme: 'light', steps_goal: 10000 };
    STATE.dailyGoal = settings.daily_goal;
    STATE.waterGoal = settings.water_goal;
    STATE.stepsGoal = settings.steps_goal || 10000;
    STATE.theme = settings.theme || 'light';
    STATE.notifications = settings.notifications || { enabled: false, water: false };

    const stats = data.stats || { heart_rate: 72, steps: 0, sleep: 7.5, spo2: 98, weight: 70, bmi: 22.5, stress: 'Low', mood: 'Good', macros: { p: 0, c: 0, f: 0 }, medList: [] };
    STATE.heartRate = stats.heart_rate;
    STATE.steps = stats.steps;
    STATE.sleepHours = stats.sleep;
    STATE.spo2 = stats.spo2;
    STATE.weight = stats.weight;
    STATE.bmi = stats.bmi;
    STATE.stressLevel = stats.stress;
    STATE.mood = stats.mood;
    STATE.macros = stats.macros;
    STATE.medList = stats.med_list;

    STATE.logs = data.logs ? data.logs.filter(l => l.date_string === today) : [];
}

async function saveState() {
    // 1. Save Locally always
    const localData = {
        settings: {
            daily_goal: STATE.dailyGoal,
            water_goal: STATE.waterGoal,
            steps_goal: STATE.stepsGoal,
            theme: STATE.theme,
            notifications: STATE.notifications
        },
        stats: { heart_rate: STATE.heartRate, steps: STATE.steps, sleep: STATE.sleepHours, spo2: STATE.spo2, weight: STATE.weight, bmi: STATE.bmi, stress: STATE.stressLevel, mood: STATE.mood, macros: STATE.macros, medList: STATE.medList },
        logs: STATE.logs,
        history: STATE.history
    };
    localStorage.setItem('myhealth_v2_data', JSON.stringify(localData));

    // 2. Sync to Supabase if logged in
    if (STATE.user) {
        try {
            await supabase.from('settings').upsert({
                user_id: STATE.user.id,
                daily_goal: STATE.dailyGoal,
                water_goal: STATE.waterGoal,
                steps_goal: STATE.stepsGoal,
                theme: STATE.theme
            });

            await supabase.from('user_stats').upsert({
                user_id: STATE.user.id,
                heart_rate: STATE.heartRate,
                steps: STATE.steps,
                sleep_hours: STATE.sleepHours,
                spo2: STATE.spo2,
                weight: STATE.weight,
                bmi: STATE.bmi,
                stress_level: STATE.stressLevel,
                mood: STATE.mood,
                med_list: STATE.medList,
                macros: STATE.macros
            });

            // Sync logs (complex, usually only new ones)
            // For now, simpler to just replace all for today
            const today = getTodayDateString();
            await supabase.from('logs').delete().eq('date_string', today).eq('user_id', STATE.user.id);
            await supabase.from('logs').insert(STATE.logs.map(l => ({ ...l, user_id: STATE.user.id })));
        } catch (err) { console.warn("Supabase Save Error:", err); }
    }
}

// --- AUTHENTICATION ---

async function checkUser() {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
        STATE.user = data.user;
        els.authOverlay.style.display = 'none';
        init();
    } else {
        els.authOverlay.style.display = 'flex';
    }
}

if (els.authForm) {
    els.authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        els.authBtn.disabled = true;
        els.authBtn.textContent = 'Authenticating...';
        els.authError.style.display = 'none';

        try {
            // Try Sign In
            let { data, error } = await supabase.auth.signInWithPassword({ email, password });

            // If failed, try Sign Up (Simple flow for this app)
            if (error) {
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
                if (signUpError) throw signUpError;
                data = signUpData;
            }

            if (data?.user) {
                STATE.user = data.user;
                els.authOverlay.style.display = 'none';
                init();
            }
        } catch (err) {
            els.authError.textContent = err.message;
            els.authError.style.display = 'block';
        } finally {
            els.authBtn.disabled = false;
            els.authBtn.textContent = 'Sign In / Sign Up';
        }
    });
}

function skipAuth() {
    els.authOverlay.style.display = 'none';
    init();
}

function calculateTotals() {
    STATE.caloriesEaten = 0;
    STATE.caloriesBurned = 0;
    STATE.waterGlasses = 0;
    STATE.macros = { p: 0, c: 0, f: 0 };

    STATE.logs.forEach(log => {
        if (log.type === 'food') {
            STATE.caloriesEaten += log.value;
            if (log.macros) {
                STATE.macros.p += log.macros.p || 0;
                STATE.macros.c += log.macros.c || 0;
                STATE.macros.f += log.macros.f || 0;
            }
        }
        else if (log.type === 'exercise' || log.type === 'workout') STATE.caloriesBurned += log.value;
        else if (log.type === 'water') STATE.waterGlasses += 1;
    });
}

// UI Categorization
function switchCategory(cat) {
    STATE.activeCategory = cat;

    // Update nav buttons (sidebar)
    document.querySelectorAll('.sidebar-link').forEach(btn => {
        btn.classList.remove('active');
        const text = btn.textContent.toLowerCase();
        if (text.includes(cat)) btn.classList.add('active');
        if (cat === 'all' && text.includes('dashboard')) btn.classList.add('active');
    });

    // Sections logic
    const sections = ['activity-section', 'vitals-section', 'nutrition-section', 'mental-section'];
    const dashboardContent = document.getElementById('dashboard-content');
    const profileSection = document.getElementById('profile-section');

    if (cat === 'profile') {
        dashboardContent.style.display = 'none';
        profileSection.style.display = 'block';
    } else {
        dashboardContent.style.display = 'block';
        profileSection.style.display = 'none';

        sections.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (cat === 'all' || id.startsWith(cat)) {
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        });
    }

    triggerEntranceAnimations();
}

// UI Updates
function updateUI() {
    const netCalories = STATE.caloriesEaten - STATE.caloriesBurned;
    const remaining = STATE.dailyGoal - netCalories;

    els.calRemaining.textContent = remaining;
    els.waterCount.textContent = STATE.waterGlasses;
    els.bpmValue.textContent = STATE.heartRate;
    els.spo2Value.textContent = STATE.spo2;
    els.stepsCount.textContent = STATE.steps.toLocaleString();
    els.sleepHours.textContent = STATE.sleepHours;
    els.stressValue.textContent = STATE.stressLevel;
    els.weightVal.textContent = STATE.weight;
    els.bmiVal.textContent = STATE.bmi;
    els.macroP.textContent = STATE.macros.p;
    els.macroC.textContent = STATE.macros.c;
    els.macroF.textContent = STATE.macros.f;

    // Rings
    const circumference = 282.7; // 2 * pi * 45
    const calPercent = Math.min(STATE.caloriesEaten / STATE.dailyGoal, 1);
    document.getElementById('calRing').style.strokeDashoffset = circumference - (calPercent * circumference);

    const stepsPercent = Math.min(STATE.steps / STATE.stepsGoal, 1);
    document.getElementById('stepsRing').style.strokeDashoffset = circumference - (stepsPercent * circumference);

    // Water
    const waterPercent = Math.min((STATE.waterGlasses / STATE.waterGoal) * 100, 100);
    els.waterLevel.style.height = `${waterPercent}%`;

    // Stress Fill
    const stressMap = { 'Low': 20, 'Moderate': 50, 'High': 85 };
    els.stressFill.style.width = `${stressMap[STATE.stressLevel]}%`;

    renderMedList();
    renderLogs();
}

function renderMedList() {
    els.medList.innerHTML = '';
    if (STATE.medList.length === 0) {
        els.medList.innerHTML = '<div class="empty-state-mini">No meds scheduled</div>';
        return;
    }
    STATE.medList.forEach((med, idx) => {
        const div = document.createElement('div');
        div.className = 'med-item';
        div.innerHTML = `
            <span>${med.name} (${med.time})</span>
            <input type="checkbox" ${med.taken ? 'checked' : ''} onchange="toggleMed(${idx})">
        `;
        els.medList.appendChild(div);
    });
}

// Interactions
function addWater() {
    STATE.logs.push({
        id: Date.now(),
        name: 'Water Glass',
        value: 1,
        type: 'water',
        timestamp: Date.now(),
        date_string: getTodayDateString()
    });
    calculateTotals();
    saveState();
    updateUI();
}

function addSteps() {
    const val = prompt("Steps to add:", 1000);
    if (!val || isNaN(val)) return;
    STATE.steps += parseInt(val);
    saveState();
    updateUI();
}

function logWorkout(type) {
    const cals = { 'Run': 400, 'Cycle': 300, 'Gym': 250 };
    STATE.logs.push({
        id: Date.now(),
        name: type + ' Workout',
        value: cals[type],
        type: 'exercise',
        timestamp: Date.now(),
        date_string: getTodayDateString()
    });
    calculateTotals();
    saveState();
    updateUI();
}

function simulateHeartRate() {
    const interval = setInterval(() => {
        STATE.heartRate = 60 + Math.floor(Math.random() * 40);
        updateUI();
    }, 200);
    setTimeout(() => clearInterval(interval), 2000);
}

function simulateSpO2() {
    STATE.spo2 = 95 + Math.floor(Math.random() * 5);
    updateUI();
    saveState();
}

function logMood(mood) {
    const map = { 'happy': '😊 Feeling great today!', 'calm': '🧘 Feeling peaceful.', 'sad': '😢 A bit down today.', 'stressed': '😫 Feeling overwhelmed.' };
    STATE.mood = mood;
    els.currentMoodDisplay.textContent = map[mood];
    saveState();
}

function startBreathing() {
    els.stressValue.textContent = "Breathing...";
    els.stressFill.style.width = "0%";
    setTimeout(() => {
        els.stressFill.style.width = "100%";
        setTimeout(() => {
            STATE.stressLevel = 'Low';
            updateUI();
            saveState();
        }, 3000);
    }, 100);
}

function deleteLog(id) {
    STATE.logs = STATE.logs.filter(l => l.id !== id);
    calculateTotals();
    saveState();
    updateUI();
}

function toggleMed(idx) {
    STATE.medList[idx].taken = !STATE.medList[idx].taken;
    saveState();
}

function clearAllData() {
    if (confirm("Reset all data for today?")) {
        STATE.logs = [];
        STATE.steps = 0;
        STATE.waterGlasses = 0;
        calculateTotals();
        saveState();
        updateUI();
    }
}


// Modal and Form Helpers
function openModal(type) {
    els.modalOverlay.classList.add('active');
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');

    if (type === 'med') {
        document.getElementById('medsInputModal').style.display = 'block';
    } else if (type === 'metrics') {
        document.getElementById('metricsInputModal').style.display = 'block';
        document.getElementById('weightInput').value = STATE.weight;
    } else if (type === 'sleep') {
        document.getElementById('sleepModal').style.display = 'block';
        document.getElementById('sleepHoursInput').value = STATE.sleepHours;
    } else if (type === 'steps') {
        document.getElementById('stepsModal').style.display = 'block';
    } else if (type === 'menu') {
        document.getElementById('menuModal').style.display = 'block';
    } else if (type === 'settings') {
        document.getElementById('settingsModal').style.display = 'block';
    } else if (type === 'stats') {
        document.getElementById('statsModal').style.display = 'block';
    } else {
        document.getElementById('inputModal').style.display = 'block';
        document.getElementById('modalTitle').textContent = type === 'food' ? 'Add Food' : 'Log Workout';
    }
}

function openAddModal(type) {
    openModal(type);
    const radios = document.getElementsByName('entryType');
    radios.forEach(r => {
        if (r.value === type) r.checked = true;
    });
}

function openSettings() {
    openModal('settings');
    document.getElementById('notifyToggle').checked = STATE.notifications.enabled;
    document.getElementById('waterNotifyToggle').checked = STATE.notifications.water;
}

function openStats() {
    openModal('stats');
    setTimeout(renderChart, 100); // Wait for modal to show
}

function renderChart() {
    const ctx = document.getElementById('healthChart').getContext('2d');

    // Mock data for the last 7 days if history is empty
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const calData = STATE.history.length > 0 ? STATE.history.map(h => h.calories) : [1800, 2100, 1950, 2200, 1700, 2400, STATE.caloriesEaten];
    const stepsData = STATE.history.length > 0 ? STATE.history.map(h => h.steps) : [8000, 11000, 9500, 12000, 7500, 13000, STATE.steps];

    if (mainChart) mainChart.destroy();

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Calories',
                data: calData,
                borderColor: '#fb7185',
                backgroundColor: 'rgba(251, 113, 133, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Steps',
                data: stepsData,
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
                fill: true,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, labels: { color: '#fff' } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: 'rgba(255,255,255,0.6)' }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.6)' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.6)' }
                }
            }
        }
    });

    renderStatsSummary();
}

function renderStatsSummary() {
    const summary = document.getElementById('statsSummary');
    const avgCal = Math.round(STATE.caloriesEaten);
    const totalSteps = STATE.steps;

    summary.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="card" style="padding: 16px; text-align: center;">
                <p style="font-size: 13px; opacity: 0.6;">Today's Avg</p>
                <h4 style="font-size: 20px;">${avgCal} kcal</h4>
            </div>
            <div class="card" style="padding: 16px; text-align: center;">
                <p style="font-size: 13px; opacity: 0.6;">Weekly High</p>
                <h4 style="font-size: 20px;">13,000 pts</h4>
            </div>
        </div>
    `;
}

function toggleNotifications() {
    STATE.notifications.enabled = document.getElementById('notifyToggle').checked;
    STATE.notifications.water = document.getElementById('waterNotifyToggle').checked;

    if (STATE.notifications.enabled) {
        if (Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }
    saveState();
}

function closeModal() {
    els.modalOverlay.classList.remove('active');
    setTimeout(() => {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    }, 300);
}

// Form Submissions
const registerForm = (id, handler) => {
    const form = document.getElementById(id);
    if (form) form.addEventListener('submit', (e) => {
        e.preventDefault();
        handler(new FormData(form), e);
        closeModal();
        form.reset();
    });
};

// Main Tracker Form
els.trackerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('itemName').value;
    const value = parseFloat(document.getElementById('itemValue').value);
    const type = document.querySelector('input[name="entryType"]:checked').value;

    if (!name || isNaN(value)) return;

    STATE.logs.push({
        id: Date.now(),
        name,
        value,
        type,
        timestamp: Date.now(),
        date_string: getTodayDateString()
    });

    calculateTotals();
    saveState();
    updateUI();
    closeModal();
    e.target.reset();
});

registerForm('stepsForm', (data) => {
    const val = parseInt(document.getElementById('stepAmount').value);
    if (val) {
        STATE.steps += val;
        // Estimate calories
        STATE.logs.push({
            id: Date.now(),
            name: 'Walking (' + val + ' steps)',
            value: Math.round(val * 0.04),
            type: 'exercise',
            timestamp: Date.now(),
            date_string: getTodayDateString()
        });
        saveState();
        updateUI();
    }
});

registerForm('sleepForm', (data) => {
    const val = parseFloat(document.getElementById('sleepHoursInput').value);
    if (val) {
        STATE.sleepHours = val;
        saveState();
        updateUI();
    }
});

registerForm('metricsForm', (data) => {
    const val = parseFloat(document.getElementById('weightInput').value);
    if (val) {
        STATE.weight = val;
        STATE.bmi = (val / 3.24).toFixed(1);
        saveState();
        updateUI();
    }
});

registerForm('medsForm', (data) => {
    const name = document.getElementById('medName').value;
    const time = document.getElementById('medTime').value;
    if (name && time) {
        STATE.medList.push({ name, time, taken: false });
        saveState();
        updateUI();
    }
});

function toggleTheme() {
    STATE.theme = STATE.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    saveState();
}

function finishOnboarding() {
    document.getElementById('onboarding').style.display = 'none';
}

function applyTheme() {
    document.body.classList.toggle('dark-mode', STATE.theme === 'dark');
}

function renderLogs() {
    els.logList.innerHTML = '';
    if (STATE.logs.length === 0) {
        els.logList.innerHTML = '<div class="empty-state"><p>No activity yet.</p></div>';
        return;
    }
    STATE.logs.slice().reverse().forEach(log => {
        const item = document.createElement('div');
        item.className = 'log-item';
        item.innerHTML = `
            <div class="log-info">
                <h4>${log.name}</h4>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="log-value">${log.value} ${log.type === 'food' ? 'kcal' : (log.type === 'water' ? 'gl' : 'kcal')}</span>
                <button onclick="deleteLog(${log.id})" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 18px;">&times;</button>
            </div>
        `;
        els.logList.appendChild(item);
    });
}

function getTodayDateString() { return new Date().toISOString().split('T')[0]; }

function init() {
    if (els.currentDate) {
        els.currentDate.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    fetchState();
    switchCategory('all');
    console.log("Health Tracker v2 Initialized 🚀");
}

// Optimization: Animation Trigger
function triggerEntranceAnimations() {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        // Fast, batched animation
        requestAnimationFrame(() => {
            card.style.transition = 'opacity 0.4s ease-out, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            // Small staggering for natural feel but much faster
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, i * 30);
        });
    });
}

// Global Initialization
(function bootstrap() {
    // 1. Immediate Local Render (Optimistic UI)
    init();

    // 2. Background Auth Check (Non-blocking)
    if (supabase) {
        checkUser().catch(err => console.warn("Background auth check failed:", err));
    }
})();

// Event listeners
els.modalOverlay.addEventListener('click', (e) => { if (e.target === els.modalOverlay) closeModal(); });


