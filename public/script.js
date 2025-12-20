const API_URL = 'http://localhost:5000/api/milk';

// State
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let entries = [];
let selectedDate = null;

// Charts
let dailyChart = null;
let yearlyChart = null;

// Filter State
let filterStartDate = null;
let filterEndDate = null;

// DOM Elements
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthDisplay = document.getElementById('current-month-display');
const modal = document.getElementById('entry-modal');
const modalDateTitle = document.getElementById('modal-date-title');
const totalDisplay = document.getElementById('live-total');

// Inputs
const priceInput = document.getElementById('price-input');
const morningInput = document.getElementById('morning-input');
const nightInput = document.getElementById('night-input');
const notesInput = document.getElementById('notes-input');
const morningCostEl = document.getElementById('morning-cost');
const nightCostEl = document.getElementById('night-cost');

// Summary ELs
const summaryTotal = document.getElementById('summary-total');
const lastMonthTotalEl = document.getElementById('last-month-total');
// const monthChangeEl = document.getElementById('month-change');
const summaryLitres = document.getElementById('summary-litres');
const summaryAvg = document.getElementById('summary-avg');
const mostExpEl = document.getElementById('most-expensive');
const leastExpEl = document.getElementById('least-expensive');

// Analysis ELs
const analysisYearSelect = document.getElementById('analysis-year-select');
const yearTotalEl = document.getElementById('year-total');
const yearLitresEl = document.getElementById('year-litres');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadMonthData();
    setupEventListeners();
    setupCharts();
    populateAnalysisYears();
    initTheme();


});

function formatDateDisplay(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}

function setupEventListeners() {
    // Nav
    document.getElementById('nav-calendar').addEventListener('click', () => switchView('calendar'));
    document.getElementById('nav-analysis').addEventListener('click', () => switchView('analysis'));
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Calendar Controls
    document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));

    document.getElementById('filter-apply').addEventListener('click', applyFilters);
    document.getElementById('filter-clear').addEventListener('click', clearFilters);



    // Modal
    document.getElementById('btn-cancel').addEventListener('click', closeModal);
    document.getElementById('btn-save').addEventListener('click', saveEntry);
    document.getElementById('btn-delete').addEventListener('click', deleteEntry);

    [priceInput, morningInput, nightInput].forEach(inp => {
        inp.addEventListener('input', calculateModalDetails);
    });

    document.getElementById('export-pdf').addEventListener('click', exportPDF);

    // Analysis
    if (analysisYearSelect) analysisYearSelect.addEventListener('change', loadAnalysisData);
}

function switchView(view) {
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(`nav-${view}`).classList.add('active');

    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');

    if (view === 'analysis') {
        loadAnalysisData();
    } else {
        if (dailyChart) dailyChart.resize();
    }
}

function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    loadMonthData();
}

async function loadMonthData() {
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    currentMonthDisplay.innerText = `${monthNames[currentMonth]} ${currentYear}`;
    document.getElementById('prev-month').style.display = 'inline-block';
    document.getElementById('next-month').style.display = 'inline-block';

    try {
        const mStr = String(currentMonth + 1).padStart(2, '0');
        const res = await fetch(`${API_URL}/month?year=${currentYear}&month=${mStr}`);

        let fetchedEntries = [];
        if (res.ok) {
            fetchedEntries = await res.json();
        } else {
            console.error('Failed to load entries');
        }

        // Ensure array
        entries = Array.isArray(fetchedEntries) ? fetchedEntries : [];

        // Fetch last month safely
        let lastEntries = [];
        try {
            let lastM = currentMonth - 1;
            let lastY = currentYear;
            if (lastM < 0) { lastM = 11; lastY--; }
            const lmStr = String(lastM + 1).padStart(2, '0');
            const resLast = await fetch(`${API_URL}/month?year=${lastY}&month=${lmStr}`);
            if (resLast.ok) {
                lastEntries = await resLast.json();
            }
        } catch (e) { console.error("Last month error", e); }

        lastEntries = Array.isArray(lastEntries) ? lastEntries : [];

        renderCalendar();
        updateSummary(entries, lastEntries);
    } catch (err) {
        console.error("Error fetching data:", err);
    }
}

// Pagination State
let currentPage = 1;
const ITEMS_PER_PAGE = 35; // Showing 5 weeks per page looks good on 7-col grid
let filteredDates = []; // Changed from filteredEntries to filteredDates to imply full range
let isFilterMode = false;

function applyFilters() {
    const startSensitive = document.getElementById('filter-start').value;
    const endSensitive = document.getElementById('filter-end').value;

    if (!startSensitive || !endSensitive) {
        alert("Please select both Start and End dates.");
        return;
    }

    filterStartDate = new Date(startSensitive);
    filterEndDate = new Date(endSensitive);

    // Normalize to midnight
    filterStartDate.setHours(0, 0, 0, 0);
    filterEndDate.setHours(0, 0, 0, 0);

    if (filterEndDate < filterStartDate) {
        alert("End date cannot be before Start date");
        return;
    }

    isFilterMode = true;

    // Clear Header IMMEDIATELY
    currentMonthDisplay.innerText = "";
    document.getElementById('prev-month').style.display = 'none';
    document.getElementById('next-month').style.display = 'none';

    currentPage = 1;
    loadFilteredData();
}

function clearFilters() {
    document.getElementById('filter-start').value = '';
    document.getElementById('filter-end').value = '';
    filterStartDate = null;
    filterEndDate = null;
    isFilterMode = false;

    // Hide Pagination Controls
    const controls = document.getElementById('pagination-controls');
    if (controls) controls.classList.add('hidden');

    loadMonthData();
}

async function loadFilteredData() {
    try {
        const res = await fetch(`${API_URL}/all`);
        if (!res.ok) throw new Error('Fetch failed');
        const allEntries = await res.json();

        // Generate ALL dates in range
        filteredDates = [];
        let ptr = new Date(filterStartDate);

        while (ptr <= filterEndDate) {
            // Create YYYY-MM-DD string
            const y = ptr.getFullYear();
            const m = String(ptr.getMonth() + 1).padStart(2, '0');
            const d = String(ptr.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            // Find entry or null
            const entry = allEntries.find(e => e.date === dateStr) || null;

            filteredDates.push({
                dateObj: new Date(ptr),
                dateStr: dateStr,
                entry: entry
            });

            ptr.setDate(ptr.getDate() + 1);
        }

        renderPaginationGrid();

        // Calculate Summary for Range
        // Filter actual entries from the generated list
        const validEntries = filteredDates
            .map(d => d.entry)
            .filter(e => e !== null);

        updateSummary(validEntries, []);
        updateChartForRange(filteredDates); // Use new char function for range
        updateChartForRange(filteredDates); // Use new char function for range

        // Header is already cleared in applyFilters, but ensure it stays cleared
        currentMonthDisplay.innerText = "";
        document.getElementById('prev-month').style.display = 'none';
        document.getElementById('next-month').style.display = 'none';

        // Show CSV Button
        const csvBtn = document.getElementById('export-csv');
        if (csvBtn) csvBtn.classList.remove('hidden');

    } catch (err) { console.error(err); }
}

function renderPaginationGrid() {
    calendarGrid.innerHTML = '';

    // Pagination controls are now OUTSIDE the grid in HTML
    const controls = document.getElementById('pagination-controls');
    if (controls) controls.classList.remove('hidden');

    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageItems = filteredDates.slice(startIdx, endIdx);

    if (pageItems.length === 0) {
        calendarGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:20px; color:var(--text-sub);">No days in range</div>';
    }

    pageItems.forEach(item => {
        const card = createDayCard(item.dateObj, item.entry);
        calendarGrid.appendChild(card);
    });

    renderPaginationControls();
    try { lucide.createIcons(); } catch (e) { }
}

function renderPaginationControls() {
    const container = document.getElementById('pagination-controls');
    if (!container) return;
    container.innerHTML = '';

    const totalPages = Math.ceil(filteredDates.length / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
        // Hide if only 1 page to save space? Or keep for consistency?
        // User asked for "1 2 3" fixed in bottom. If 1 page, maybe just "1".
        // If 1 page, usually no pagination needed, but let's keep it minimal.
    }

    const createBtn = (text, onClick, active = false, disabled = false) => {
        const b = document.createElement('button');
        b.innerHTML = text;
        if (active) b.classList.add('active');
        if (disabled) b.disabled = true;
        b.onclick = onClick;
        return b;
    };

    // Prev
    container.appendChild(createBtn('<', () => {
        if (currentPage > 1) { currentPage--; renderPaginationGrid(); }
    }, false, currentPage === 1));

    for (let i = 1; i <= totalPages; i++) {
        container.appendChild(createBtn(i, () => {
            currentPage = i;
            renderPaginationGrid();
        }, i === currentPage));
    }

    // Next
    container.appendChild(createBtn('>', () => {
        if (currentPage < totalPages) { currentPage++; renderPaginationGrid(); }
    }, false, currentPage === totalPages));
}

function createDayCard(dateObj, entry) {
    const card = document.createElement('div');
    card.className = 'calendar-day';

    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    // const dateStr = `${y}-${m}-${d}`; 
    // CAUTION: dateObj from new Date("yyyy-mm-dd") might differ in timezone.
    // Ideally rely on the entry string if available, else format carefully.

    // entry.date is YYYY-MM-DD. Use that if available.
    const dateStr = entry ? entry.date : `${y}-${m}-${d}`;

    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const dd_mm = `${d}-${m}-${y}`;

    // Highlight Today
    const today = new Date();
    if (dateObj.getDate() === today.getDate() &&
        dateObj.getMonth() === today.getMonth() &&
        dateObj.getFullYear() === today.getFullYear()) {
        card.classList.add('today-highlight');
    }

    let html = `
        <div class="day-header">
            <span>${dd_mm} ${dayName}</span>
        </div>
    `;

    if (entry) {
        html += `
            <div class="day-filled-data">
                <div class="data-row">
                    <span><i data-lucide="sun" width="12" style="display:inline"></i> ${entry.morningLitres}L</span>
                    <span><i data-lucide="moon" width="12" style="display:inline"></i> ${entry.nightLitres}L</span>
                </div>
            </div>
            <div class="data-row total">₹${entry.total ? entry.total.toFixed(2) : '0.00'}</div>
        `;
    } else {
        // Should not happen in pagination (we filter entries), but good for reuse
        html += `
            <div class="day-tap-msg">
                <i data-lucide="plus-circle" width="20"></i>
                <span>Add</span>
            </div>
         `;
    }

    card.innerHTML = html;
    card.addEventListener('click', () => openModal(dateStr, entry));
    return card;
}

function renderCalendar() {
    const filtersDiv = document.getElementById('pagination-controls');
    if (filtersDiv) filtersDiv.classList.add('hidden');

    const csvBtn = document.getElementById('export-csv');
    if (csvBtn) csvBtn.classList.add('hidden');

    calendarGrid.innerHTML = '';

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day empty';
        calendarGrid.appendChild(div);
    }

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(currentYear, currentMonth, d);
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const entry = entries.find(e => e.date === dateStr);

        const card = createDayCard(dateObj, entry);
        calendarGrid.appendChild(card);
    }

    try { lucide.createIcons(); } catch (e) { }

    // Update chart for just this month
    updateDailyChart(entries);
}

function openModal(dateStr, entry) {
    selectedDate = dateStr;
    const dateObj = new Date(dateStr);

    let displayTitle = dateStr;
    try {
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const dd_mm_yyyy = formatDateDisplay(dateObj);
        displayTitle = `${dd_mm_yyyy} — ${dayName}`;
    } catch (e) { }

    modalDateTitle.innerText = displayTitle;

    if (entry) {
        morningInput.value = entry.morningLitres;
        nightInput.value = entry.nightLitres;
        notesInput.value = entry.notes || '';

        // Try to infer price, else default to 60 or existing input
        const totalL = entry.morningLitres + entry.nightLitres;
        if (totalL > 0 && entry.total > 0) {
            priceInput.value = (entry.total / totalL).toFixed(2);
        } else {
            // keep existing priceInput value or default
            if (!priceInput.value) priceInput.value = 60;
        }
    } else {
        morningInput.value = '';
        nightInput.value = '';
        notesInput.value = '';
        if (!priceInput.value) priceInput.value = 60;
    }

    calculateModalDetails();
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('visible'), 10);
}

function closeModal(e) {
    if (e) e.preventDefault();
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 200);
}

function calculateModalDetails() {
    const p = parseFloat(priceInput.value) || 0;
    const m = parseFloat(morningInput.value) || 0;
    const n = parseFloat(nightInput.value) || 0;

    const mCost = m * p;
    const nCost = n * p;
    const total = mCost + nCost;

    morningCostEl.innerText = `₹${mCost.toFixed(2)}`;
    nightCostEl.innerText = `₹${nCost.toFixed(2)}`;
    totalDisplay.innerText = `₹${total.toFixed(2)}`;
}

async function saveEntry(e) {
    e.preventDefault();
    const p = parseFloat(priceInput.value) || 0;
    const m = parseFloat(morningInput.value) || 0;
    const n = parseFloat(nightInput.value) || 0;
    const total = (m + n) * p;

    const payload = {
        date: selectedDate,
        morningLitres: m,
        nightLitres: n,
        total: total,
        notes: notesInput.value
    };

    try {
        const res = await fetch(`${API_URL}/entry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Save failed');

        triggerConfetti();
        closeModal();
        loadMonthData();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteEntry(e) {
    e.preventDefault();
    if (!confirm('Clear this day?')) return;
    try {
        const res = await fetch(`${API_URL}/entry/${selectedDate}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Delete failed");

        closeModal();
        // Wait small amount to ensure server processes
        setTimeout(() => loadMonthData(), 100);
    } catch (err) { alert(err.message); }
}

function updateSummary(current, last) {
    // Safety check
    if (!Array.isArray(current)) current = [];
    if (!Array.isArray(last)) last = [];

    const totalCost = current.reduce((acc, e) => acc + (e.total || 0), 0);
    const lastTotalCost = last.reduce((acc, e) => acc + (e.total || 0), 0);

    summaryTotal.innerText = `₹${totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    lastMonthTotalEl.innerText = `₹${lastTotalCost.toFixed(2)}`;

    // Change metric removed
    // let change = 0;
    // if (lastTotalCost > 0) change = ((totalCost - lastTotalCost) / lastTotalCost) * 100;
    // monthChangeEl.innerText = `${change > 0 ? '+' : ''}${change.toFixed(0)}%`;
    // monthChangeEl.style.color = change >= 0 ? 'var(--danger)' : 'var(--success)';

    const totalLitres = current.reduce((acc, e) => acc + (e.morningLitres || 0) + (e.nightLitres || 0), 0);
    summaryLitres.innerText = `${totalLitres} L`;

    const today = new Date();
    let divisor = new Date(currentYear, currentMonth + 1, 0).getDate();
    if (currentYear === today.getFullYear() && currentMonth === today.getMonth()) divisor = today.getDate();

    const avg = totalCost / (divisor || 1);
    summaryAvg.innerText = `₹${avg.toFixed(2)}`;

    if (current.length > 0) {
        const sorted = [...current].sort((a, b) => b.total - a.total);
        const max = sorted[0];
        const nonZero = sorted.filter(e => e.total > 0);
        const least = nonZero.length > 0 ? nonZero[nonZero.length - 1] : null;

        mostExpEl.innerText = max ? `${max.date.split('-')[2]} (₹${max.total})` : '—';
        leastExpEl.innerText = least ? `${least.date.split('-')[2]} (₹${least.total})` : '—';
    } else {
        mostExpEl.innerText = '—';
        leastExpEl.innerText = '—';
    }

    updateDailyChart(current);
}

// CHARTS
function setupCharts() {
    // Daily
    const ctx = document.getElementById('dailyChart').getContext('2d');
    dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Cumulative Cost (₹)',
                data: [],
                borderColor: '#5b4ddb',
                backgroundColor: 'rgba(91, 77, 219, 0.05)',
                fill: true,
                tension: 0.3,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, border: { display: false } }
            }
        }
    });

    // Yearly
    const ctx2 = document.getElementById('yearlyChart').getContext('2d');
    yearlyChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            datasets: [{
                label: 'Monthly Spend (₹)',
                data: [],
                backgroundColor: '#5b4ddb',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

function updateDailyChart(entries) {
    if (!dailyChart) return;

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const labels = [];
    const data = [];
    let runningTotal = 0;

    // Map entries
    const entryMap = {};
    if (Array.isArray(entries)) {
        entries.forEach(e => entryMap[e.date] = e.total);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const val = entryMap[dateStr] || 0;
        runningTotal += val;

        labels.push(d);
        data.push(runningTotal);
    }

    dailyChart.data.labels = labels;
    dailyChart.data.datasets[0].data = data;
    dailyChart.update();
}

function updateChartForRange(rangeData) {
    if (!dailyChart) return;

    const labels = [];
    const data = [];
    let runningTotal = 0;

    rangeData.forEach(item => {
        const d = item.dateObj;
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        labels.push(label);

        const val = item.entry ? item.entry.total : 0;
        runningTotal += val;
        data.push(runningTotal);
    });

    dailyChart.data.labels = labels;
    dailyChart.data.datasets[0].data = data;
    dailyChart.update();
}

function populateAnalysisYears() {
    if (!analysisYearSelect) return;
    analysisYearSelect.innerHTML = '';
    const thisYear = new Date().getFullYear();
    for (let y = thisYear; y >= thisYear - 4; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.innerText = y;
        analysisYearSelect.appendChild(opt);
    }
}

async function loadAnalysisData() {
    if (!analysisYearSelect) return;
    const year = analysisYearSelect.value;

    try {
        const res = await fetch(`${API_URL}/all`);
        if (!res.ok) return;
        const all = await res.json();

        const yearEntries = all.filter(e => e.date.startsWith(year));

        const monthlyTotals = new Array(12).fill(0);
        let yearTotal = 0;
        let yearLitres = 0;

        yearEntries.forEach(e => {
            const m = parseInt(e.date.split('-')[1]) - 1;
            monthlyTotals[m] += e.total;
            yearTotal += e.total;
            yearLitres += (e.morningLitres + e.nightLitres);
        });

        yearlyChart.data.datasets[0].data = monthlyTotals;
        yearlyChart.update();

        yearTotalEl.innerText = `₹${yearTotal.toLocaleString('en-IN')}`;
        yearLitresEl.innerText = `${yearLitres} L`;

    } catch (err) {
        console.error(err);
    }
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text(`Milk Expenses: ${currentMonthDisplay.innerText}`, 14, 20);

    const tableData = entries.map(e => [e.date, e.morningLitres, e.nightLitres, e.total]);

    doc.autoTable({
        startY: 30,
        head: [['Date', 'Morning (L)', 'Night (L)', 'Total (INR)']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [91, 77, 219] }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.text(`Total Spend: ${summaryTotal.innerText}`, 14, finalY);
    doc.text(`Total Litres: ${summaryLitres.innerText}`, 14, finalY + 7);

    doc.save(`milk-tracker-${currentMonth + 1}-${currentYear}.pdf`);
}

function triggerConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = [];
    for (let i = 0; i < 80; i++) {
        pieces.push({
            x: canvas.width / 2, y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
            color: `hsl(${Math.random() * 360}, 100%, 60%)`, life: 120
        });
    }
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        pieces.forEach(p => {
            if (p.life > 0) {
                p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
                ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 6, 6);
                active = true;
            }
        });
        if (active) requestAnimationFrame(animate);
    }
    animate();
}

/* CALCULATOR LOGIC */
class Calculator {
    constructor(prevOperandTextElement, currentOperandTextElement) {
        this.prevOperandTextElement = prevOperandTextElement;
        this.currentOperandTextElement = currentOperandTextElement;
        this.clear();
        this.memory = 0;
    }

    clear() {
        this.currentOperand = '0';
        this.previousOperand = '';
        this.operation = undefined;
    }

    delete() {
        if (this.currentOperand === '0') return;
        this.currentOperand = this.currentOperand.toString().slice(0, -1);
        if (this.currentOperand === '') this.currentOperand = '0';
    }

    appendNumber(number) {
        if (number === '.' && this.currentOperand.includes('.')) return;
        if (this.currentOperand === '0' && number !== '.') {
            this.currentOperand = number.toString();
        } else {
            this.currentOperand = this.currentOperand.toString() + number.toString();
        }
    }

    chooseOperation(operation) {
        if (this.currentOperand === '') return;
        if (this.previousOperand !== '') {
            this.compute();
        }
        this.operation = operation;
        this.previousOperand = this.currentOperand;
        this.currentOperand = '0';
    }

    compute() {
        let computation;
        const prev = parseFloat(this.previousOperand);
        const current = parseFloat(this.currentOperand);
        if (isNaN(prev) || isNaN(current)) return;

        switch (this.operation) {
            case '+': computation = prev + current; break;
            case '-': computation = prev - current; break;
            case '×':
            case '*': computation = prev * current; break;
            case '÷':
            case '/': computation = prev / current; break;
            default: return;
        }
        this.currentOperand = computation;
        this.operation = undefined;
        this.previousOperand = '';
    }

    specialOperation(op) {
        const current = parseFloat(this.currentOperand);
        if (isNaN(current)) return;

        let res = 0;
        switch (op) {
            case '1/x': res = 1 / current; break;
            case 'x2': res = current * current; break;
            case 'sqrt': res = Math.sqrt(current); break;
            case 'plus-minus': res = current * -1; break;
            case '%': res = current / 100; break;
            default: return;
        }
        this.currentOperand = res;
    }

    // Memory
    memoryClear() { this.memory = 0; }
    memoryRecall() { this.currentOperand = this.memory; }
    memoryAdd() { this.memory += parseFloat(this.currentOperand) || 0; }
    memorySubtract() { this.memory -= parseFloat(this.currentOperand) || 0; }
    memoryStore() { this.memory = parseFloat(this.currentOperand) || 0; }

    updateDisplay() {
        this.currentOperandTextElement.innerText = this.getDisplayNumber(this.currentOperand);
        if (this.operation != null) {
            this.prevOperandTextElement.innerText =
                `${this.getDisplayNumber(this.previousOperand)} ${this.operation}`;
        } else {
            this.prevOperandTextElement.innerText = '';
        }
    }

    getDisplayNumber(number) {
        const stringNumber = number.toString();
        const integerDigits = parseFloat(stringNumber.split('.')[0]);
        const decimalDigits = stringNumber.split('.')[1];
        let integerDisplay;
        if (isNaN(integerDigits)) {
            integerDisplay = '';
        } else {
            integerDisplay = integerDigits.toLocaleString('en', { maximumFractionDigits: 0 });
        }
        if (decimalDigits != null) {
            return `${integerDisplay}.${decimalDigits}`;
        } else {
            return integerDisplay;
        }
    }
}

// Calculator Setup
document.addEventListener('DOMContentLoaded', () => {
    // ... existing init ...

    // Init Calculator
    const prevText = document.getElementById('calc-prev-operand');
    const currText = document.getElementById('calc-current-operand');
    const calculator = new Calculator(prevText, currText);

    // Toggle
    const panel = document.getElementById('calculator-panel');
    const toggleBtn = document.getElementById('calc-toggle');
    const closeBtn = document.getElementById('calc-close');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            panel.classList.toggle('hidden');
        });
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            panel.classList.add('hidden');
        });
    }

    // Buttons
    document.querySelectorAll('.btn-calc').forEach(button => {
        button.addEventListener('click', () => {
            if (button.classList.contains('num')) {
                calculator.appendNumber(button.getAttribute('data-num'));
                calculator.updateDisplay();
            }
            else if (button.classList.contains('op-main')) {
                calculator.chooseOperation(button.innerText);
                calculator.updateDisplay();
            }
            else if (button.classList.contains('eq')) {
                calculator.compute();
                calculator.updateDisplay();
            }
            else if (button.getAttribute('data-op') === 'C') {
                calculator.clear();
                calculator.updateDisplay();
            }
            else if (button.getAttribute('data-op') === 'DEL') {
                calculator.delete();
                calculator.updateDisplay();
            }
            // Memory & Special
            else {
                const op = button.getAttribute('data-op');
                if (['MC', 'MR', 'M+', 'M-', 'MS'].includes(op)) {
                    if (op === 'MC') calculator.memoryClear();
                    if (op === 'MR') calculator.memoryRecall();
                    if (op === 'M+') calculator.memoryAdd();
                    if (op === 'M-') calculator.memorySubtract();
                    if (op === 'MS') calculator.memoryStore();
                    calculator.updateDisplay(); // For MR/Update
                }
                else if (op === 'CE') {
                    calculator.currentOperand = '0';
                    calculator.updateDisplay();
                }
                else {
                    calculator.specialOperation(op);
                    calculator.updateDisplay();
                }
            }
        });
    });
});

/* THEME LOGIC */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    // Timeout to ensure charts are created if race condition, though setupCharts runs before initTheme in DOMContentLoaded
    setTimeout(updateChartsTheme, 100);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    updateChartsTheme();
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    // Reset to initial state for Lucide to pick up
    btn.innerHTML = theme === 'dark'
        ? '<i data-lucide="sun"></i>'
        : '<i data-lucide="moon"></i>';

    if (window.lucide) {
        window.lucide.createIcons({
            root: btn
        });
    }
}

function updateChartsTheme() {
    // Get CSS Variable
    const style = getComputedStyle(document.documentElement);
    const primary = style.getPropertyValue('--primary').trim();

    if (dailyChart) {
        dailyChart.data.datasets[0].borderColor = primary;
        // Optional: Update background color alpha if desired, but sticking to primary is consistent
        // dailyChart.data.datasets[0].backgroundColor = ... 
        dailyChart.update();
    }

    if (yearlyChart) {
        yearlyChart.data.datasets[0].backgroundColor = primary;
        yearlyChart.update();
    }
}
