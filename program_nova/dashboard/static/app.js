/**
 * Program Nova Dashboard Frontend
 *
 * Implements 4-level drill-down navigation:
 * L0: Project Overview → L1: Branch Detail → L2: Group Detail → L3: Task Detail
 */

// Global state
let appState = {
    data: null,
    currentView: 'l0',
    selectedL1: null,
    selectedL2: null,
    selectedTaskId: null,
    pollInterval: null,
    logsInterval: null
};

// API Configuration
const API_BASE = window.location.origin;
const POLL_INTERVAL = 2000; // 2 seconds

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    startPolling();
    updateStatusIndicator('connecting');
});

// Event Listeners
function setupEventListeners() {
    // Back button
    document.getElementById('back-button').addEventListener('click', handleBack);

    // Refresh logs button
    document.getElementById('refresh-logs').addEventListener('click', () => {
        if (appState.selectedTaskId) {
            fetchTaskLogs(appState.selectedTaskId);
        }
    });
}

// Navigation
function handleBack() {
    if (appState.currentView === 'l3') {
        // Stop logs polling
        if (appState.logsInterval) {
            clearInterval(appState.logsInterval);
            appState.logsInterval = null;
        }
        showView('l2', appState.selectedL1, appState.selectedL2);
    } else if (appState.currentView === 'l2') {
        showView('l1', appState.selectedL1);
    } else if (appState.currentView === 'l1') {
        showView('l0');
    }
}

function showView(view, l1 = null, l2 = null, taskId = null) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('view-active'));

    // Update state
    appState.currentView = view;
    appState.selectedL1 = l1;
    appState.selectedL2 = l2;
    appState.selectedTaskId = taskId;

    // Show back button for non-L0 views
    const backButton = document.getElementById('back-button');
    backButton.style.display = view !== 'l0' ? 'block' : 'none';

    // Update breadcrumbs
    updateBreadcrumbs(view, l1, l2, taskId);

    // Show the target view
    document.getElementById(`view-${view}`).classList.add('view-active');

    // Render the view
    if (appState.data) {
        switch (view) {
            case 'l0':
                renderL0View();
                break;
            case 'l1':
                renderL1View(l1);
                break;
            case 'l2':
                renderL2View(l1, l2);
                break;
            case 'l3':
                renderL3View(taskId);
                break;
        }
    }
}

function updateBreadcrumbs(view, l1, l2, taskId) {
    const breadcrumbs = document.getElementById('breadcrumbs');
    let html = '<span class="breadcrumb-item" onclick="showView(\'l0\')">Project</span>';

    if (l1) {
        html += `<span class="breadcrumb-item" onclick="showView('l1', '${l1}')">${l1}</span>`;
    }

    if (l2) {
        html += `<span class="breadcrumb-item" onclick="showView('l2', '${l1}', '${l2}')">${l2}</span>`;
    }

    if (taskId) {
        html += `<span class="breadcrumb-item active">${taskId}</span>`;
    } else if (view === 'l2' && l2) {
        html = html.replace(`onclick="showView('l2', '${l1}', '${l2}')"`, 'class="breadcrumb-item active"');
    } else if (view === 'l1' && l1) {
        html = html.replace(`onclick="showView('l1', '${l1}')"`, 'class="breadcrumb-item active"');
    }

    breadcrumbs.innerHTML = html;
}

// Data Fetching
async function startPolling() {
    await fetchStatus();
    appState.pollInterval = setInterval(fetchStatus, POLL_INTERVAL);
}

async function fetchStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        appState.data = data;

        // Update the current view
        renderCurrentView();

        // Update header stats
        updateHeaderStats(data);

        // Update status indicator
        updateStatusIndicator('connected');
    } catch (error) {
        console.error('Error fetching status:', error);
        updateStatusIndicator('error');
    }
}

async function fetchTaskLogs(taskId) {
    try {
        const response = await fetch(`${API_BASE}/api/tasks/${taskId}/logs`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const logsElement = document.getElementById('task-logs');
        logsElement.textContent = data.logs || 'No logs available';

        // Auto-scroll if enabled
        const autoScroll = document.getElementById('auto-scroll').checked;
        if (autoScroll) {
            logsElement.scrollTop = logsElement.scrollHeight;
        }
    } catch (error) {
        console.error('Error fetching logs:', error);
        document.getElementById('task-logs').textContent = `Error loading logs: ${error.message}`;
    }
}

// Rendering
function renderCurrentView() {
    if (!appState.data) return;

    switch (appState.currentView) {
        case 'l0':
            renderL0View();
            break;
        case 'l1':
            renderL1View(appState.selectedL1);
            break;
        case 'l2':
            renderL2View(appState.selectedL1, appState.selectedL2);
            break;
        case 'l3':
            renderL3View(appState.selectedTaskId);
            break;
    }
}

function renderL0View() {
    const { rollups, hierarchy, milestones } = appState.data;

    // Update progress bar
    const allTaskIds = getAllTaskIds(hierarchy);
    const completedCount = allTaskIds.filter(id => {
        const task = appState.data.tasks[id];
        return task && task.status === 'completed';
    }).length;
    const totalCount = allTaskIds.length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    document.getElementById('progress-bar-fill').style.width = `${percentage}%`;
    document.getElementById('progress-text').textContent = `${completedCount} / ${totalCount} tasks (${percentage}%)`;

    // Render milestones
    renderMilestones(milestones);

    // Render L1 branches
    const branchesGrid = document.getElementById('branches-grid');
    branchesGrid.innerHTML = '';

    for (const [l1, groups] of Object.entries(hierarchy)) {
        const rollup = rollups.l1_rollups[l1];
        const taskIds = getAllTaskIdsForL1(hierarchy[l1]);
        const taskCount = taskIds.length;
        const completedTaskCount = taskIds.filter(id => {
            const task = appState.data.tasks[id];
            return task && task.status === 'completed';
        }).length;

        const card = createCard({
            title: l1,
            status: rollup.status,
            metrics: [
                { label: 'Progress', value: `${completedTaskCount} / ${taskCount}` },
                { label: 'Duration', value: formatDuration(rollup.duration_seconds) },
                { label: 'Tokens', value: formatNumber(getTotalTokens(rollup.token_usage)) },
                { label: 'Cost', value: formatCost(rollup.cost_usd) }
            ],
            onClick: () => showView('l1', l1)
        });

        branchesGrid.appendChild(card);
    }
}

function renderL1View(l1) {
    const { rollups, hierarchy } = appState.data;

    document.getElementById('l1-title').textContent = l1;

    // Show branch stats
    const rollup = rollups.l1_rollups[l1];
    const statsHtml = `
        <div class="metric">
            <span class="metric-label">Status</span>
            <span class="metric-value">${formatStatus(rollup.status)}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Duration</span>
            <span class="metric-value">${formatDuration(rollup.duration_seconds)}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Tokens</span>
            <span class="metric-value">${formatNumber(getTotalTokens(rollup.token_usage))}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Cost</span>
            <span class="metric-value">${formatCost(rollup.cost_usd)}</span>
        </div>
    `;
    document.getElementById('l1-stats').innerHTML = statsHtml;

    // Render L2 groups
    const groupsGrid = document.getElementById('groups-grid');
    groupsGrid.innerHTML = '';

    for (const [l2, taskIds] of Object.entries(hierarchy[l1])) {
        const rollup = rollups.l2_rollups[l1][l2];
        const completedTaskCount = taskIds.filter(id => {
            const task = appState.data.tasks[id];
            return task && task.status === 'completed';
        }).length;

        const card = createCard({
            title: l2,
            status: rollup.status,
            metrics: [
                { label: 'Progress', value: `${completedTaskCount} / ${taskIds.length}` },
                { label: 'Duration', value: formatDuration(rollup.duration_seconds) },
                { label: 'Tokens', value: formatNumber(getTotalTokens(rollup.token_usage)) },
                { label: 'Cost', value: formatCost(rollup.cost_usd) }
            ],
            onClick: () => showView('l2', l1, l2)
        });

        groupsGrid.appendChild(card);
    }
}

function renderL2View(l1, l2) {
    const { rollups, hierarchy } = appState.data;

    document.getElementById('l2-title').textContent = l2;

    // Show group stats
    const rollup = rollups.l2_rollups[l1][l2];
    const statsHtml = `
        <div class="metric">
            <span class="metric-label">Status</span>
            <span class="metric-value">${formatStatus(rollup.status)}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Duration</span>
            <span class="metric-value">${formatDuration(rollup.duration_seconds)}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Tokens</span>
            <span class="metric-value">${formatNumber(getTotalTokens(rollup.token_usage))}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Cost</span>
            <span class="metric-value">${formatCost(rollup.cost_usd)}</span>
        </div>
    `;
    document.getElementById('l2-stats').innerHTML = statsHtml;

    // Render tasks table
    const taskIds = hierarchy[l1][l2];
    const tbody = document.getElementById('tasks-table-body');
    tbody.innerHTML = '';

    for (const taskId of taskIds) {
        const task = appState.data.tasks[taskId] || {};
        const tr = document.createElement('tr');
        tr.onclick = () => showView('l3', l1, l2, taskId);

        const duration = task.status === 'in_progress'
            ? computeLiveDuration(task.started_at)
            : (task.duration_seconds || 0);

        const totalTokens = getTotalTokens(task.token_usage || {});
        const cost = computeCost(task.token_usage || {});

        tr.innerHTML = `
            <td class="task-id">${taskId}</td>
            <td>${task.name || taskId}</td>
            <td>
                <span class="status-icon ${task.status || 'pending'}">
                    ${formatStatus(task.status || 'pending')}
                </span>
            </td>
            <td>${formatDuration(duration)}</td>
            <td>${formatNumber(totalTokens)}</td>
            <td>${formatCost(cost)}</td>
        `;

        tbody.appendChild(tr);
    }
}

function renderL3View(taskId) {
    const task = appState.data.tasks[taskId] || {};

    document.getElementById('l3-title').textContent = `Task ${taskId}`;
    document.getElementById('task-id').textContent = taskId;
    document.getElementById('task-status').innerHTML = `<span class="status-icon ${task.status || 'pending'}">${formatStatus(task.status || 'pending')}</span>`;

    // Compute duration
    const duration = task.status === 'in_progress'
        ? computeLiveDuration(task.started_at)
        : (task.duration_seconds || 0);
    document.getElementById('task-duration').textContent = formatDuration(duration);

    document.getElementById('task-worker').textContent = task.worker_id || 'N/A';
    document.getElementById('task-started').textContent = task.started_at ? formatTimestamp(task.started_at) : 'N/A';
    document.getElementById('task-completed').textContent = task.completed_at ? formatTimestamp(task.completed_at) : 'N/A';

    // Token usage
    const tokenUsage = task.token_usage || {};
    document.getElementById('task-input-tokens').textContent = formatNumber(tokenUsage.input_tokens || 0);
    document.getElementById('task-output-tokens').textContent = formatNumber(tokenUsage.output_tokens || 0);
    document.getElementById('task-cache-read').textContent = formatNumber(tokenUsage.cache_read_tokens || 0);
    document.getElementById('task-cache-creation').textContent = formatNumber(tokenUsage.cache_creation_tokens || 0);
    document.getElementById('task-cost').textContent = formatCost(computeCost(tokenUsage));

    // Commit info
    const commitContainer = document.getElementById('task-commit-container');
    if (task.commit_sha) {
        commitContainer.style.display = 'block';
        document.getElementById('task-commit').textContent = task.commit_sha;
        document.getElementById('task-files').textContent = task.files_changed
            ? task.files_changed.join(', ')
            : 'N/A';
    } else {
        commitContainer.style.display = 'none';
    }

    // Error info
    const errorContainer = document.getElementById('task-error-container');
    if (task.error) {
        errorContainer.style.display = 'block';
        document.getElementById('task-error').textContent = task.error;
    } else {
        errorContainer.style.display = 'none';
    }

    // Load logs
    fetchTaskLogs(taskId);

    // Start polling logs for in-progress tasks
    if (appState.logsInterval) {
        clearInterval(appState.logsInterval);
    }
    if (task.status === 'in_progress') {
        appState.logsInterval = setInterval(() => fetchTaskLogs(taskId), POLL_INTERVAL);
    }
}

function renderMilestones(milestones) {
    const listElement = document.getElementById('milestones-list');

    if (!milestones || milestones.length === 0) {
        listElement.innerHTML = '<p class="empty-state">No milestones reached yet</p>';
        return;
    }

    listElement.innerHTML = '';
    for (const milestone of milestones) {
        const div = document.createElement('div');
        div.className = 'milestone-item';
        div.innerHTML = `
            <div class="milestone-name">${milestone.name}</div>
            <div class="milestone-message">${milestone.message}</div>
        `;
        listElement.appendChild(div);
    }
}

// UI Components
function createCard({ title, status, metrics, onClick }) {
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = onClick;

    const metricsHtml = metrics.map(m => `
        <div class="metric">
            <span class="metric-label">${m.label}</span>
            <span class="metric-value">${m.value}</span>
        </div>
    `).join('');

    card.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">${title}</h3>
            <div class="status-badge ${status}"></div>
        </div>
        <div class="card-metrics">
            ${metricsHtml}
        </div>
    `;

    return card;
}

// Utility Functions
function updateHeaderStats(data) {
    const { rollups } = data;
    const l0 = rollups.l0_rollup;

    const allTaskIds = getAllTaskIds(data.hierarchy);
    const completedCount = allTaskIds.filter(id => {
        const task = data.tasks[id];
        return task && task.status === 'completed';
    }).length;

    document.getElementById('project-progress').textContent = `${completedCount} / ${allTaskIds.length}`;
    document.getElementById('project-duration').textContent = formatDuration(l0.duration_seconds);
    document.getElementById('project-cost').textContent = formatCost(l0.cost_usd);
}

function updateStatusIndicator(status) {
    const indicator = document.getElementById('status-indicator');
    const text = document.querySelector('.status-text');

    indicator.className = 'status-indicator';

    switch (status) {
        case 'connected':
            indicator.classList.add('connected');
            text.textContent = 'Live';
            break;
        case 'error':
            indicator.classList.add('error');
            text.textContent = 'Connection Error';
            break;
        case 'connecting':
        default:
            text.textContent = 'Connecting...';
            break;
    }
}

function getAllTaskIds(hierarchy) {
    const taskIds = [];
    for (const l1 of Object.values(hierarchy)) {
        for (const l2TaskIds of Object.values(l1)) {
            taskIds.push(...l2TaskIds);
        }
    }
    return taskIds;
}

function getAllTaskIdsForL1(l1Groups) {
    const taskIds = [];
    for (const l2TaskIds of Object.values(l1Groups)) {
        taskIds.push(...l2TaskIds);
    }
    return taskIds;
}

function getTotalTokens(tokenUsage) {
    if (!tokenUsage) return 0;
    return (tokenUsage.input_tokens || 0) +
           (tokenUsage.output_tokens || 0) +
           (tokenUsage.cache_read_tokens || 0) +
           (tokenUsage.cache_creation_tokens || 0);
}

function computeCost(tokenUsage) {
    if (!tokenUsage) return 0;

    const PRICE_INPUT = 3.00 / 1_000_000;
    const PRICE_OUTPUT = 15.00 / 1_000_000;
    const PRICE_CACHE_READ = 0.30 / 1_000_000;
    const PRICE_CACHE_CREATION = 3.75 / 1_000_000;

    return (
        (tokenUsage.input_tokens || 0) * PRICE_INPUT +
        (tokenUsage.output_tokens || 0) * PRICE_OUTPUT +
        (tokenUsage.cache_read_tokens || 0) * PRICE_CACHE_READ +
        (tokenUsage.cache_creation_tokens || 0) * PRICE_CACHE_CREATION
    );
}

function computeLiveDuration(startedAt) {
    if (!startedAt) return 0;
    const start = new Date(startedAt);
    const now = new Date();
    return Math.floor((now - start) / 1000);
}

// Formatters
function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
}

function formatNumber(num) {
    if (!num || num === 0) return '0';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
}

function formatCost(cost) {
    if (!cost || cost === 0) return '$0.00';
    return `$${cost.toFixed(4)}`;
}

function formatStatus(status) {
    const statusMap = {
        'completed': 'Completed',
        'in_progress': 'In Progress',
        'failed': 'Failed',
        'pending': 'Pending'
    };
    return statusMap[status] || status;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
}
