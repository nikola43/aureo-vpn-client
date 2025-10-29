// Global state
let currentUser = null;
let selectedNode = null;
let nodes = [];
let sessionUpdateInterval = null;

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Initialize app
window.addEventListener('DOMContentLoaded', () => {
    initLoginScreen();
    initDashboard();
});

// Login screen initialization
function initLoginScreen() {
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const apiUrlInput = document.getElementById('api-url');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const apiUrl = apiUrlInput.value;

        try {
            // Set API URL
            await window.go.main.App.SetAPIURL(apiUrl);

            // Attempt login
            const response = await window.go.main.App.Login(email, password);

            if (response.success) {
                currentUser = response.user;
                document.getElementById('username').textContent = response.user.username;
                showScreen('dashboard-screen');
                await loadNodes();
            }
        } catch (error) {
            loginError.textContent = error.message || 'Login failed. Please check your credentials.';
        }
    });
}

// Dashboard initialization
function initDashboard() {
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await window.go.main.App.Logout();
        currentUser = null;
        selectedNode = null;
        nodes = [];
        stopSessionUpdates();
        showScreen('login-screen');
    });

    // Refresh nodes button
    document.getElementById('refresh-nodes-btn').addEventListener('click', loadNodes);

    // Connect button
    document.getElementById('connect-btn').addEventListener('click', connectToVPN);

    // Disconnect button
    document.getElementById('disconnect-btn').addEventListener('click', disconnectFromVPN);

    // Filters
    document.getElementById('protocol-filter').addEventListener('change', loadNodes);
    document.getElementById('country-filter').addEventListener('input', filterNodes);
}

// Load nodes from API
async function loadNodes() {
    const nodesList = document.getElementById('nodes-list');
    nodesList.innerHTML = '<div class="loading">Loading nodes...</div>';

    try {
        const protocol = document.getElementById('protocol-filter').value;
        const country = '';

        nodes = await window.go.main.App.GetNodes(country, protocol);
        renderNodes(nodes);
    } catch (error) {
        nodesList.innerHTML = `<div class="error-message">Failed to load nodes: ${error.message}</div>`;
    }
}

// Filter nodes by country
function filterNodes() {
    const countryFilter = document.getElementById('country-filter').value.toLowerCase();
    const filteredNodes = nodes.filter(node =>
        node.country.toLowerCase().includes(countryFilter) ||
        node.city.toLowerCase().includes(countryFilter)
    );
    renderNodes(filteredNodes);
}

// Render nodes list
function renderNodes(nodesToRender) {
    const nodesList = document.getElementById('nodes-list');

    if (nodesToRender.length === 0) {
        nodesList.innerHTML = '<div class="loading">No nodes available</div>';
        return;
    }

    nodesList.innerHTML = nodesToRender.map(node => {
        const isSelected = selectedNode && selectedNode.id === node.id;
        const loadPercentage = Math.round(node.load_score);
        const protocols = [];
        if (node.supports_wireguard) protocols.push('WireGuard');
        if (node.supports_openvpn) protocols.push('OpenVPN');

        return `
            <div class="node-item ${isSelected ? 'selected' : ''}" data-node-id="${node.id}">
                <div class="node-info">
                    <div class="node-name">${node.name}</div>
                    <div class="node-location">${node.city}, ${node.country} (${protocols.join(', ')})</div>
                </div>
                <div class="node-stats">
                    <div class="node-stat">
                        <span class="label">Load</span>
                        <span class="value">${loadPercentage}%</span>
                    </div>
                    <div class="node-stat">
                        <span class="label">Latency</span>
                        <span class="value">${node.latency || 0}ms</span>
                    </div>
                    <div class="node-stat">
                        <span class="label">Users</span>
                        <span class="value">${node.current_connections}/${node.max_connections}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers
    document.querySelectorAll('.node-item').forEach(item => {
        item.addEventListener('click', () => {
            const nodeId = item.getAttribute('data-node-id');
            selectedNode = nodesToRender.find(n => n.id === nodeId);
            renderNodes(nodesToRender);
        });
    });
}

// Connect to VPN
async function connectToVPN() {
    if (!selectedNode) {
        alert('Please select a node first');
        return;
    }

    const connectBtn = document.getElementById('connect-btn');
    const connectionStatus = document.getElementById('connection-status');
    const connectionInfo = document.getElementById('connection-info');

    try {
        connectBtn.disabled = true;
        connectionStatus.className = 'status-connecting';
        connectionStatus.querySelector('h3').textContent = 'Connecting...';
        connectionInfo.textContent = `Connecting to ${selectedNode.name}...`;

        // Determine protocol
        const protocol = selectedNode.supports_wireguard ? 'wireguard' : 'openvpn';

        // Connect
        const response = await window.go.main.App.ConnectToVPN(selectedNode.id, protocol);

        if (response.success) {
            connectionStatus.className = 'status-connected';
            connectionStatus.querySelector('h3').textContent = 'Connected';
            connectionInfo.textContent = `Connected to ${selectedNode.name}`;

            // Show disconnect button
            connectBtn.style.display = 'none';
            document.getElementById('disconnect-btn').style.display = 'block';

            // Show session panel and update info
            updateSessionInfo(response.session);
            document.getElementById('session-panel').style.display = 'block';

            // Start session updates
            startSessionUpdates();
        }
    } catch (error) {
        alert(`Failed to connect: ${error.message}`);
        connectionStatus.className = 'status-disconnected';
        connectionStatus.querySelector('h3').textContent = 'Disconnected';
        connectionInfo.textContent = 'Connection failed';
    } finally {
        connectBtn.disabled = false;
    }
}

// Disconnect from VPN
async function disconnectFromVPN() {
    const disconnectBtn = document.getElementById('disconnect-btn');
    const connectionStatus = document.getElementById('connection-status');
    const connectionInfo = document.getElementById('connection-info');

    try {
        disconnectBtn.disabled = true;

        await window.go.main.App.DisconnectVPN();

        connectionStatus.className = 'status-disconnected';
        connectionStatus.querySelector('h3').textContent = 'Disconnected';
        connectionInfo.textContent = 'Not connected to VPN';

        // Show connect button
        document.getElementById('connect-btn').style.display = 'block';
        disconnectBtn.style.display = 'none';

        // Hide session panel
        document.getElementById('session-panel').style.display = 'none';

        // Stop session updates
        stopSessionUpdates();
    } catch (error) {
        alert(`Failed to disconnect: ${error.message}`);
    } finally {
        disconnectBtn.disabled = false;
    }
}

// Update session info display
function updateSessionInfo(session) {
    document.getElementById('session-id').textContent = session.id.substring(0, 8) + '...';
    document.getElementById('tunnel-ip').textContent = session.tunnel_ip || 'N/A';
    document.getElementById('session-protocol').textContent = session.protocol || 'N/A';

    const bytesSent = (session.bytes_sent / 1024 / 1024).toFixed(2);
    const bytesReceived = (session.bytes_received / 1024 / 1024).toFixed(2);
    document.getElementById('bytes-sent').textContent = `${bytesSent} MB`;
    document.getElementById('bytes-received').textContent = `${bytesReceived} MB`;

    if (session.connected_at) {
        const connectedTime = new Date(session.connected_at);
        const duration = Math.floor((Date.now() - connectedTime.getTime()) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        document.getElementById('connected-time').textContent = `${minutes}m ${seconds}s`;
    }
}

// Start periodic session updates
function startSessionUpdates() {
    if (sessionUpdateInterval) return;

    sessionUpdateInterval = setInterval(async () => {
        try {
            const session = await window.go.main.App.GetCurrentSession();
            if (session) {
                updateSessionInfo(session);
            }
        } catch (error) {
            console.error('Failed to update session:', error);
            stopSessionUpdates();
        }
    }, 5000); // Update every 5 seconds
}

// Stop session updates
function stopSessionUpdates() {
    if (sessionUpdateInterval) {
        clearInterval(sessionUpdateInterval);
        sessionUpdateInterval = null;
    }
}

// Format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
