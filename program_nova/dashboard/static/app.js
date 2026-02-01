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

    // View tabs
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const viewType = e.target.dataset.view;
            switchTab(viewType);
        });
    });
}

function switchTab(viewType) {
    // Update tab buttons
    document.querySelectorAll('.view-tab').forEach(tab => {
        if (tab.dataset.view === viewType) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === `${viewType}-view`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Render the appropriate view
    if (viewType === 'dependencies' && appState.data) {
        renderDependencyView();
    }
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
        console.log('[fetchStatus] Fetching status from API');

        const response = await fetch(`${API_BASE}/api/status`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        console.log('[fetchStatus] Received data from API:', {
            hasProject: !!data.project,
            hasTasks: !!data.tasks,
            hasRollups: !!data.rollups,
            hasHierarchy: !!data.hierarchy,
            hasMilestones: !!data.milestones,
            taskCount: data.tasks ? Object.keys(data.tasks).length : 0,
            hierarchyKeys: data.hierarchy ? Object.keys(data.hierarchy) : [],
            rollupsStructure: data.rollups ? {
                hasL0: !!data.rollups.l0_rollup,
                hasL1: !!data.rollups.l1_rollups,
                hasL2: !!data.rollups.l2_rollups,
                l1Keys: data.rollups.l1_rollups ? Object.keys(data.rollups.l1_rollups) : [],
                l2Keys: data.rollups.l2_rollups ? Object.keys(data.rollups.l2_rollups) : []
            } : null
        });

        appState.data = data;

        // Update the current view
        try {
            renderCurrentView();
        } catch (renderError) {
            console.error('[fetchStatus] Error in renderCurrentView:', renderError);
            // Don't update status indicator to 'error' if the data fetch succeeded
            // The error is in rendering, not in the connection
        }

        // Update header stats
        try {
            updateHeaderStats(data);
        } catch (statsError) {
            console.error('[fetchStatus] Error in updateHeaderStats:', statsError);
        }

        // Check if all tasks are complete - stop polling if so
        if (data.all_tasks_completed) {
            if (appState.pollInterval) {
                clearInterval(appState.pollInterval);
                appState.pollInterval = null;
                console.log('[fetchStatus] All tasks complete - polling stopped');
                updateStatusIndicator('completed');
            }
        } else {
            // Update status indicator
            updateStatusIndicator('connected');
        }
    } catch (error) {
        console.error('[fetchStatus] Error fetching status:', error);
        console.error('[fetchStatus] Stack trace:', error.stack);
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
    console.log('[renderL0View] Starting L0 view render');

    try {
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

        // Render tree view (wrapped in try-catch to prevent breaking the rest of the page)
        try {
            renderTreeView();
        } catch (error) {
            console.error('[renderL0View] Error in renderTreeView, but continuing with rest of page:', error);
        }

        // Render dependency view if that tab is active
        const dependencyTab = document.querySelector('.tab-content#dependency-view');
        if (dependencyTab && dependencyTab.classList.contains('active')) {
            try {
                renderDependencyView();
            } catch (error) {
                console.error('[renderL0View] Error in renderDependencyView, but continuing with rest of page:', error);
            }
        }

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

        console.log('[renderL0View] L0 view render completed');
    } catch (error) {
        console.error('[renderL0View] Error rendering L0 view:', error);
        throw error;
    }
}

function renderL1View(l1) {
    console.log(`[renderL1View] Rendering L1 view for: ${l1}`);

    try {
        const { rollups, hierarchy } = appState.data;

        // Defensive checks
        if (!rollups || !rollups.l1_rollups || !rollups.l1_rollups[l1]) {
            console.error(`[renderL1View] Missing rollup data for L1: ${l1}`);
            throw new Error(`Missing rollup data for L1: ${l1}`);
        }

        if (!hierarchy || !hierarchy[l1]) {
            console.error(`[renderL1View] Missing hierarchy data for L1: ${l1}`);
            throw new Error(`Missing hierarchy data for L1: ${l1}`);
        }

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
            // Defensive check for L2 rollup
            if (!rollups.l2_rollups || !rollups.l2_rollups[l1] || !rollups.l2_rollups[l1][l2]) {
                console.error(`[renderL1View] Missing rollup data for L2: ${l1}/${l2}`);
                continue;
            }

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

        console.log(`[renderL1View] L1 view render completed for: ${l1}`);
    } catch (error) {
        console.error('[renderL1View] Error rendering L1 view:', error);
        throw error;
    }
}

function renderL2View(l1, l2) {
    console.log(`[renderL2View] Rendering L2 view for: ${l1}/${l2}`);

    try {
        const { rollups, hierarchy } = appState.data;

        // Defensive checks
        if (!rollups || !rollups.l2_rollups || !rollups.l2_rollups[l1] || !rollups.l2_rollups[l1][l2]) {
            console.error(`[renderL2View] Missing rollup data for L2: ${l1}/${l2}`);
            throw new Error(`Missing rollup data for L2: ${l1}/${l2}`);
        }

        if (!hierarchy || !hierarchy[l1] || !hierarchy[l1][l2]) {
            console.error(`[renderL2View] Missing hierarchy data for L2: ${l1}/${l2}`);
            throw new Error(`Missing hierarchy data for L2: ${l1}/${l2}`);
        }

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

        console.log(`[renderL2View] L2 view render completed for: ${l1}/${l2}`);
    } catch (error) {
        console.error('[renderL2View] Error rendering L2 view:', error);
        throw error;
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

    // Check if milestones is actually an array before iterating
    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
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
    console.log('[updateHeaderStats] Updating header stats');

    try {
        // Defensive checks
        if (!data) {
            console.error('[updateHeaderStats] data is undefined');
            return;
        }

        if (!data.rollups) {
            console.error('[updateHeaderStats] rollups is undefined');
            return;
        }

        if (!data.rollups.l0_rollup) {
            console.error('[updateHeaderStats] l0_rollup is undefined');
            return;
        }

        if (!data.hierarchy) {
            console.error('[updateHeaderStats] hierarchy is undefined');
            return;
        }

        if (!data.tasks) {
            console.error('[updateHeaderStats] tasks is undefined');
            return;
        }

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

        console.log('[updateHeaderStats] Header stats updated successfully');
    } catch (error) {
        console.error('[updateHeaderStats] Error updating header stats:', error);
    }
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
        case 'completed':
            indicator.classList.add('completed');
            text.textContent = 'Completed';
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

// Tree View Functions
function renderTreeView() {
    console.log('[renderTreeView] Starting tree view render');

    try {
        // Defensive checks for data structure
        if (!appState.data) {
            console.error('[renderTreeView] appState.data is undefined');
            throw new Error('appState.data is undefined');
        }

        const { hierarchy, rollups, tasks } = appState.data;

        // Log the data structure
        console.log('[renderTreeView] Data structure:', {
            hasHierarchy: !!hierarchy,
            hasRollups: !!rollups,
            hasTasks: !!tasks,
            hierarchyKeys: hierarchy ? Object.keys(hierarchy) : [],
            rollupsKeys: rollups ? Object.keys(rollups) : []
        });

        // Check if required data exists
        if (!hierarchy) {
            console.error('[renderTreeView] hierarchy is undefined');
            throw new Error('hierarchy is undefined');
        }

        if (!rollups) {
            console.error('[renderTreeView] rollups is undefined');
            throw new Error('rollups is undefined');
        }

        if (!rollups.l1_rollups) {
            console.error('[renderTreeView] rollups.l1_rollups is undefined');
            throw new Error('rollups.l1_rollups is undefined');
        }

        if (!rollups.l2_rollups) {
            console.error('[renderTreeView] rollups.l2_rollups is undefined');
            throw new Error('rollups.l2_rollups is undefined');
        }

        if (!tasks) {
            console.error('[renderTreeView] tasks is undefined');
            throw new Error('tasks is undefined');
        }

        const container = document.getElementById('tree-container');
        if (!container) {
            console.error('[renderTreeView] tree-container element not found');
            throw new Error('tree-container element not found');
        }

        container.innerHTML = '';

        // Create tree structure for each L1 branch
        for (const [l1Name, l2Groups] of Object.entries(hierarchy)) {
            console.log(`[renderTreeView] Processing L1: ${l1Name}`);

            // Check if L1 rollup exists
            if (!rollups.l1_rollups[l1Name]) {
                console.error(`[renderTreeView] Missing L1 rollup for: ${l1Name}`);
                console.log('[renderTreeView] Available L1 rollups:', Object.keys(rollups.l1_rollups));
                continue; // Skip this L1 instead of crashing
            }

            const l1Node = createTreeNode({
                label: l1Name,
                level: 0,
                status: computeL1Status(l1Name, l2Groups, tasks),
                meta: {
                    duration: rollups.l1_rollups[l1Name].duration_seconds,
                    cost: rollups.l1_rollups[l1Name].cost_usd
                },
                onClick: () => showView('l1', l1Name)
            });

            // Add L2 children
            const l2Container = document.createElement('div');
            l2Container.className = 'tree-node-children';

            for (const [l2Name, taskIds] of Object.entries(l2Groups)) {
                console.log(`[renderTreeView] Processing L2: ${l1Name}/${l2Name}`);

                // Check if L2 rollup exists
                if (!rollups.l2_rollups[l1Name]) {
                    console.error(`[renderTreeView] Missing L2 rollup container for L1: ${l1Name}`);
                    continue;
                }

                if (!rollups.l2_rollups[l1Name][l2Name]) {
                    console.error(`[renderTreeView] Missing L2 rollup for: ${l1Name}/${l2Name}`);
                    console.log(`[renderTreeView] Available L2 rollups for ${l1Name}:`, Object.keys(rollups.l2_rollups[l1Name]));
                    continue; // Skip this L2 instead of crashing
                }

                const l2Node = createTreeNode({
                    label: l2Name,
                    level: 1,
                    status: computeL2Status(taskIds, tasks),
                    meta: {
                        duration: rollups.l2_rollups[l1Name][l2Name].duration_seconds,
                        cost: rollups.l2_rollups[l1Name][l2Name].cost_usd
                    },
                    onClick: () => showView('l2', l1Name, l2Name)
                });

                // Add task children
                const taskContainer = document.createElement('div');
                taskContainer.className = 'tree-node-children';

                for (const taskId of taskIds) {
                    console.log(`[renderTreeView] Processing task: ${taskId}`);

                    const task = tasks[taskId] || {};
                    const taskNode = createTreeNode({
                        label: `${taskId}: ${task.name || taskId}`,
                        level: 2,
                        status: task.status || 'pending',
                        meta: {
                            duration: task.status === 'in_progress'
                                ? computeLiveDuration(task.started_at)
                                : (task.duration_seconds || 0),
                            cost: computeCost(task.token_usage || {})
                        },
                        onClick: () => showView('l3', l1Name, l2Name, taskId),
                        isLeaf: true
                    });

                    taskContainer.appendChild(taskNode);
                }

                l2Node.appendChild(taskContainer);
                l2Container.appendChild(l2Node);
            }

            l1Node.appendChild(l2Container);
            container.appendChild(l1Node);
        }

        console.log('[renderTreeView] Tree view render completed successfully');
    } catch (error) {
        console.error('[renderTreeView] Error rendering tree view:', error);
        console.error('[renderTreeView] Stack trace:', error.stack);

        // Display error in the tree container instead of crashing
        const container = document.getElementById('tree-container');
        if (container) {
            container.innerHTML = `
                <div class="error-message" style="padding: 1rem; color: #dc3545; background: #f8d7da; border-radius: 4px; margin: 1rem 0;">
                    <strong>Error rendering tree view:</strong><br>
                    ${error.message}<br>
                    <small>Check browser console for details</small>
                </div>
            `;
        }

        // Re-throw the error so it can be caught by the caller if needed
        throw error;
    }
}

function createTreeNode({ label, level, status, meta, onClick, isLeaf = false }) {
    try {
        const node = document.createElement('div');
        node.className = `tree-node level-${level}`;

        const header = document.createElement('div');
        header.className = 'tree-node-header';

        // Toggle arrow (only for non-leaf nodes)
        if (!isLeaf) {
            const toggle = document.createElement('span');
            toggle.className = 'tree-node-toggle expanded';
            toggle.textContent = '▶';
            header.appendChild(toggle);

            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const children = node.querySelector('.tree-node-children');
                if (children) {
                    children.classList.toggle('collapsed');
                    toggle.classList.toggle('expanded');
                }
            });
        } else {
            // Spacer for leaf nodes
            const spacer = document.createElement('span');
            spacer.style.width = '1rem';
            header.appendChild(spacer);
        }

        // Status indicator
        const statusIndicator = document.createElement('div');
        statusIndicator.className = `tree-node-status ${status || 'pending'}`;
        header.appendChild(statusIndicator);

        // Label
        const labelElement = document.createElement('span');
        labelElement.className = 'tree-node-label';
        labelElement.textContent = label || 'Unnamed';
        header.appendChild(labelElement);

        // Metadata
        const metaContainer = document.createElement('div');
        metaContainer.className = 'tree-node-meta';

        // Defensive checks for meta object
        if (meta) {
            if (meta.duration !== undefined && meta.duration !== null) {
                const durationItem = document.createElement('span');
                durationItem.className = 'tree-node-meta-item';
                durationItem.innerHTML = `<span>⏱</span><span>${formatDuration(meta.duration)}</span>`;
                metaContainer.appendChild(durationItem);
            }

            if (meta.cost !== undefined && meta.cost !== null) {
                const costItem = document.createElement('span');
                costItem.className = 'tree-node-meta-item';
                costItem.innerHTML = `<span>💰</span><span>${formatCost(meta.cost)}</span>`;
                metaContainer.appendChild(costItem);
            }
        }

        header.appendChild(metaContainer);

        // Click handler (but not for toggle)
        if (onClick) {
            header.addEventListener('click', (e) => {
                if (!e.target.classList.contains('tree-node-toggle')) {
                    onClick();
                }
            });
        }

        node.appendChild(header);
        return node;
    } catch (error) {
        console.error('[createTreeNode] Error creating tree node:', error, { label, level, status, meta });
        // Return a minimal error node
        const errorNode = document.createElement('div');
        errorNode.className = 'tree-node error';
        errorNode.textContent = `Error creating node: ${label}`;
        return errorNode;
    }
}

function computeL1Status(l1Name, l2Groups, tasks) {
    const taskIds = getAllTaskIdsForL1(l2Groups);
    return computeRollupStatus(taskIds, tasks);
}

function computeL2Status(taskIds, tasks) {
    return computeRollupStatus(taskIds, tasks);
}

function computeRollupStatus(taskIds, tasks) {
    if (taskIds.length === 0) return 'pending';

    let hasInProgress = false;
    let hasCompleted = false;
    let hasPending = false;

    for (const taskId of taskIds) {
        const task = tasks[taskId];
        const status = task ? task.status : 'pending';

        if (status === 'in_progress') {
            hasInProgress = true;
        } else if (status === 'completed') {
            hasCompleted = true;
        } else {
            hasPending = true;
        }
    }

    // Rollup logic:
    // - If any task is in progress, parent is yellow (in_progress)
    // - If all tasks are completed, parent is green (completed)
    // - Otherwise, parent is red (pending)
    if (hasInProgress) {
        return 'in_progress';
    } else if (hasCompleted && !hasPending) {
        return 'completed';
    } else {
        return 'pending';
    }
}

// Dependency Graph View Functions
function renderDependencyView() {
    console.log('[renderDependencyView] Starting dependency graph render');

    try {
        const { task_definitions, tasks } = appState.data;

        if (!task_definitions) {
            console.error('[renderDependencyView] task_definitions not available');
            document.getElementById('dependency-graph-container').innerHTML =
                '<p class="empty-state">Dependency information not available</p>';
            return;
        }

        // Build dependency graph data structure
        const graph = buildDependencyGraph(task_definitions, tasks);

        // Render the graph
        renderDependencyGraphSVG(graph);

        console.log('[renderDependencyView] Dependency graph render completed');
    } catch (error) {
        console.error('[renderDependencyView] Error rendering dependency graph:', error);
        document.getElementById('dependency-graph-container').innerHTML =
            `<div class="error-message" style="padding: 1rem; color: #dc3545; background: #f8d7da; border-radius: 4px;">
                <strong>Error rendering dependency graph:</strong><br>
                ${error.message}
            </div>`;
    }
}

function buildDependencyGraph(taskDefinitions, taskStates) {
    // Calculate depth for each task (topological level)
    const depths = {};
    const visited = new Set();

    function calculateDepth(taskId) {
        if (depths[taskId] !== undefined) {
            return depths[taskId];
        }

        const task = taskDefinitions[taskId];
        if (!task) {
            depths[taskId] = 0;
            return 0;
        }

        const dependencies = task.depends_on || [];
        if (dependencies.length === 0) {
            depths[taskId] = 0;
            return 0;
        }

        const depthValues = dependencies.map(dep => calculateDepth(dep));
        depths[taskId] = Math.max(...depthValues) + 1;
        return depths[taskId];
    }

    // Calculate depths for all tasks
    for (const taskId in taskDefinitions) {
        calculateDepth(taskId);
    }

    // Group tasks by depth level
    const levels = {};
    for (const taskId in taskDefinitions) {
        const depth = depths[taskId];
        if (!levels[depth]) {
            levels[depth] = [];
        }
        levels[depth].push(taskId);
    }

    // Build edges
    const edges = [];
    for (const taskId in taskDefinitions) {
        const task = taskDefinitions[taskId];
        const dependencies = task.depends_on || [];

        for (const depId of dependencies) {
            edges.push({
                from: depId,
                to: taskId
            });
        }
    }

    return {
        levels,
        depths,
        edges,
        taskDefinitions,
        taskStates
    };
}

function renderDependencyGraphSVG(graph) {
    const container = document.getElementById('dependency-graph-container');
    container.innerHTML = '';

    const { levels, depths, edges, taskDefinitions, taskStates } = graph;

    // Layout constants
    const NODE_WIDTH = 200;
    const NODE_HEIGHT = 80;
    const LEVEL_SPACING = 200;
    const NODE_SPACING = 30;
    const MARGIN = 40;

    // Calculate dimensions
    const maxLevel = Math.max(...Object.keys(levels).map(Number));
    const maxNodesInLevel = Math.max(...Object.values(levels).map(arr => arr.length));

    const width = Math.max(1200, (maxLevel + 1) * LEVEL_SPACING + MARGIN * 2);
    const height = Math.max(600, maxNodesInLevel * (NODE_HEIGHT + NODE_SPACING) + MARGIN * 2);

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'dependency-graph');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Add arrowhead marker
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3, 0 6');
    polygon.setAttribute('class', 'dep-arrowhead');

    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Calculate node positions
    const nodePositions = {};

    for (const [level, taskIds] of Object.entries(levels)) {
        const levelNum = Number(level);
        const x = MARGIN + levelNum * LEVEL_SPACING;
        const totalHeight = taskIds.length * (NODE_HEIGHT + NODE_SPACING) - NODE_SPACING;
        const startY = (height - totalHeight) / 2;

        taskIds.forEach((taskId, index) => {
            const y = startY + index * (NODE_HEIGHT + NODE_SPACING);
            nodePositions[taskId] = { x, y, level: levelNum };
        });
    }

    // Draw edges first (so they appear behind nodes)
    const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesGroup.setAttribute('class', 'edges');

    for (const edge of edges) {
        const fromPos = nodePositions[edge.from];
        const toPos = nodePositions[edge.to];

        if (!fromPos || !toPos) continue;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        // Calculate path points
        const x1 = fromPos.x + NODE_WIDTH;
        const y1 = fromPos.y + NODE_HEIGHT / 2;
        const x2 = toPos.x;
        const y2 = toPos.y + NODE_HEIGHT / 2;

        // Create curved path
        const midX = (x1 + x2) / 2;
        const pathData = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

        path.setAttribute('d', pathData);
        path.setAttribute('class', 'dep-edge');

        edgesGroup.appendChild(path);
    }

    svg.appendChild(edgesGroup);

    // Draw level labels
    const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelsGroup.setAttribute('class', 'level-labels');

    for (let level = 0; level <= maxLevel; level++) {
        const x = MARGIN + level * LEVEL_SPACING;
        const y = MARGIN - 10;

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.setAttribute('class', 'dep-level-label');
        text.textContent = `Level ${level}`;

        labelsGroup.appendChild(text);
    }

    svg.appendChild(labelsGroup);

    // Draw nodes
    const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodesGroup.setAttribute('class', 'nodes');

    for (const [taskId, pos] of Object.entries(nodePositions)) {
        const taskDef = taskDefinitions[taskId];
        const taskState = taskStates[taskId] || {};
        const status = taskState.status || 'pending';

        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.setAttribute('class', 'dep-node');
        nodeGroup.setAttribute('data-task-id', taskId);

        // Node rectangle
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', pos.x);
        rect.setAttribute('y', pos.y);
        rect.setAttribute('width', NODE_WIDTH);
        rect.setAttribute('height', NODE_HEIGHT);
        rect.setAttribute('rx', 8);
        rect.setAttribute('class', `dep-node-rect ${status}`);

        nodeGroup.appendChild(rect);

        // Task ID
        const taskIdText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        taskIdText.setAttribute('x', pos.x + NODE_WIDTH / 2);
        taskIdText.setAttribute('y', pos.y + 22);
        taskIdText.setAttribute('text-anchor', 'middle');
        taskIdText.setAttribute('class', 'dep-node-text');
        taskIdText.textContent = taskId;

        nodeGroup.appendChild(taskIdText);

        // Task name (truncated)
        const taskName = taskDef.name || '';
        const truncatedName = taskName.length > 25 ? taskName.substring(0, 22) + '...' : taskName;

        const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameText.setAttribute('x', pos.x + NODE_WIDTH / 2);
        nameText.setAttribute('y', pos.y + 40);
        nameText.setAttribute('text-anchor', 'middle');
        nameText.setAttribute('class', 'dep-node-subtext');
        nameText.textContent = truncatedName;

        nodeGroup.appendChild(nameText);

        // Metadata (duration and cost)
        if (taskState.duration_seconds !== undefined || taskState.cost_usd !== undefined) {
            const duration = taskState.status === 'in_progress'
                ? computeLiveDuration(taskState.started_at)
                : (taskState.duration_seconds || 0);

            const cost = computeCost(taskState.token_usage || {});

            const metaText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            metaText.setAttribute('x', pos.x + NODE_WIDTH / 2);
            metaText.setAttribute('y', pos.y + 58);
            metaText.setAttribute('text-anchor', 'middle');
            metaText.setAttribute('class', 'dep-node-meta');
            metaText.textContent = `⏱ ${formatDuration(duration)} | 💰 ${formatCost(cost)}`;

            nodeGroup.appendChild(metaText);
        }

        // Click handler - find the L1 and L2 for this task
        const taskBranch = taskDef.branch;
        const taskGroup = taskDef.group;

        nodeGroup.addEventListener('click', () => {
            showView('l3', taskBranch, taskGroup, taskId);
        });

        nodesGroup.appendChild(nodeGroup);
    }

    svg.appendChild(nodesGroup);

    // Add to container
    container.appendChild(svg);

    // Add legend
    const legend = document.createElement('div');
    legend.className = 'graph-legend';
    legend.innerHTML = `
        <div class="legend-title">Status Legend:</div>
        <div class="legend-items">
            <div class="legend-item">
                <span class="legend-color pending"></span>
                <span>Pending</span>
            </div>
            <div class="legend-item">
                <span class="legend-color in_progress"></span>
                <span>In Progress</span>
            </div>
            <div class="legend-item">
                <span class="legend-color completed"></span>
                <span>Completed</span>
            </div>
        </div>
    `;
    container.appendChild(legend);
}
