// ============================================
// AUREO VPN CLIENT - Main Application
// ============================================

// Global state
let currentUser = null;
let selectedNode = null;
let connectedNode = null;
let nodes = [];
let sessionUpdateInterval = null;
let connectionTimeInterval = null;
let map = null;
let markers = new Map();
let connectionStartTime = null;
let previousBytesReceived = 0;
let previousBytesSent = 0;
let previousStatsTime = Date.now();
let totalBytesTransferred = 0;

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// SCREEN MANAGEMENT
// ============================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');

    // Invalidate map size when showing dashboard
    if (screenId === 'dashboard-screen' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

// ============================================
// INITIALIZATION
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
    console.log('Aureo VPN Client initializing...');

    initLoginScreen();
    initRegisterScreen();
    initAuthToggle();
    initPasswordToggles();
    initDashboard();
    initTabNavigation();
    initQuickActions();
    initSettings();
    initMap();

    // Check for saved session
    if (window.go && window.go.main && window.go.main.App) {
        await checkSavedSession();
    } else {
        console.error('Wails runtime not available');
    }
});

// ============================================
// SESSION MANAGEMENT
// ============================================
async function checkSavedSession() {
    try {
        console.log('Checking for saved session...');
        const sessionData = await window.go.main.App.CheckSavedSession();

        if (sessionData && sessionData.has_session) {
            console.log('Found saved session, auto-login');
            currentUser = sessionData.user;
            updateUserUI(currentUser);
            showScreen('dashboard-screen');
            showToast('Welcome back, ' + currentUser.username + '!', 'success');
            await checkConnectionStatus();
            await loadNodes();
            await loadUserStats();
        }
    } catch (error) {
        console.error('Failed to check saved session:', error);
    }
}

// ============================================
// AUTH TOGGLE
// ============================================
function initAuthToggle() {
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('register-view').style.display = 'block';
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-view').style.display = 'none';
        document.getElementById('login-view').style.display = 'block';
    });
}

// ============================================
// PASSWORD TOGGLE
// ============================================
function initPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.getAttribute('data-target');
            const input = document.getElementById(targetId);
            input.type = input.type === 'password' ? 'text' : 'password';
            toggle.style.color = input.type === 'text' ? '#F59E0B' : '#6b7280';
        });
    });
}

// ============================================
// LOGIN
// ============================================
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

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;margin:0;"></div> Logging in...';

        try {
            await window.go.main.App.SetAPIURL(apiUrl);
            const response = await window.go.main.App.Login(email, password);

            if (response.success) {
                currentUser = response.user;
                updateUserUI(currentUser);
                showScreen('dashboard-screen');
                showToast('Welcome, ' + currentUser.username + '!', 'success');
                await checkConnectionStatus();
                await loadNodes();
                await loadUserStats();
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = error.message || 'Login failed. Please check your credentials.';
            showToast('Login failed', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Log in';
        }
    });
}

// ============================================
// REGISTER
// ============================================
function initRegisterScreen() {
    const registerForm = document.getElementById('register-form');
    const registerError = document.getElementById('register-error');
    const apiUrlInput = document.getElementById('api-url');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.textContent = '';

        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const apiUrl = apiUrlInput.value;

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="loading-spinner" style="width:18px;height:18px;margin:0;"></div> Creating account...';

        try {
            await window.go.main.App.SetAPIURL(apiUrl);
            const response = await window.go.main.App.Register(email, password, username);

            if (response.success) {
                currentUser = response.user;
                updateUserUI(currentUser);
                showScreen('dashboard-screen');
                showToast('Welcome to Aureo VPN, ' + currentUser.username + '!', 'success');
                await checkConnectionStatus();
                await loadNodes();
            }
        } catch (error) {
            console.error('Registration error:', error);
            registerError.textContent = error.message || 'Registration failed. Please try again.';
            showToast('Registration failed', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Create account';
        }
    });
}

// ============================================
// UPDATE USER UI
// ============================================
function updateUserUI(user) {
    if (!user) return;

    document.getElementById('username').textContent = user.username;
    document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();

    // Update subscription display
    const tier = user.subscription_tier || 'free';
    document.getElementById('user-plan').textContent = tier.charAt(0).toUpperCase() + tier.slice(1) + ' Plan';

    // Update stats tab
    document.getElementById('stat-subscription').textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
    document.getElementById('stat-total-sessions').textContent = user.connection_count || 0;
}

// ============================================
// TAB NAVIGATION
// ============================================
function initTabNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');

            // Update active tab
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show/hide content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
            });

            const targetContent = document.getElementById('tab-' + tabName);
            if (targetContent) {
                targetContent.style.display = 'block';
            }

            // Load data for specific tabs
            if (tabName === 'stats') {
                loadUserStats();
            }
        });
    });
}

// ============================================
// QUICK ACTIONS
// ============================================
function initQuickActions() {
    // Quick Connect
    document.getElementById('action-quick').addEventListener('click', async () => {
        await quickConnect();
    });

    // Secure Core - Connect to most secure server
    document.getElementById('action-secure').addEventListener('click', async () => {
        if (nodes.length === 0) await loadNodes();

        // Find node with lowest load score (most secure)
        const secureNode = nodes.reduce((best, node) =>
            node.load_score < best.load_score ? node : best
        );

        if (secureNode) {
            selectedNode = secureNode;
            showToast('Connecting to secure server...', 'info');
            await connectToVPN();
        }
    });

    // P2P - Show P2P friendly servers (for now, just filter by low load)
    document.getElementById('action-p2p').addEventListener('click', async () => {
        if (nodes.length === 0) await loadNodes();

        const p2pNodes = nodes.filter(n => n.load_score < 60);
        if (p2pNodes.length > 0) {
            renderNodes(p2pNodes);
            showToast('Showing P2P-friendly servers', 'info');
        } else {
            showToast('No P2P servers available', 'warning');
        }
    });

    // Random - Connect to random server
    document.getElementById('action-random').addEventListener('click', async () => {
        if (nodes.length === 0) await loadNodes();

        const randomIndex = Math.floor(Math.random() * nodes.length);
        selectedNode = nodes[randomIndex];

        showToast('Connecting to random server...', 'info');
        await connectToVPN();
    });
}

// ============================================
// DASHBOARD INITIALIZATION
// ============================================
function initDashboard() {
    fetchUserIP();

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        if (connectedNode) {
            const confirm = window.confirm('You are currently connected. Disconnect and logout?');
            if (confirm) {
                await disconnectFromVPN();
            } else {
                return;
            }
        }

        await window.go.main.App.Logout();
        currentUser = null;
        selectedNode = null;
        connectedNode = null;
        nodes = [];
        stopSessionUpdates();
        showScreen('login-screen');
        showToast('Logged out successfully', 'info');
    });

    // Quick Connect button
    document.getElementById('quick-connect-btn').addEventListener('click', quickConnect);

    // Disconnect button
    document.getElementById('disconnect-btn').addEventListener('click', () => {
        disconnectFromVPN();
    });

    // Change server button
    document.getElementById('change-server-btn').addEventListener('click', () => {
        // Switch to servers tab and scroll to list
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-tab="servers"]').classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        document.getElementById('tab-servers').style.display = 'block';
    });

    // Country filter
    document.getElementById('country-filter').addEventListener('input', filterNodes);
}

// ============================================
// QUICK CONNECT
// ============================================
async function quickConnect() {
    try {
        const isCurrentlyConnected = await window.go.main.App.IsConnected();
        if (isCurrentlyConnected) {
            showToast('Already connected', 'info');
            await checkConnectionStatus();
            return;
        }

        if (nodes.length === 0) {
            await loadNodes();
        }

        if (nodes.length === 0) {
            showToast('No servers available', 'error');
            return;
        }

        // Pick the fastest node (lowest load_score)
        selectedNode = nodes.reduce((best, node) =>
            node.load_score < best.load_score ? node : best
        );

        showToast('Connecting to fastest server...', 'info');
        await connectToVPN();
    } catch (error) {
        console.error('Quick Connect error:', error);
        showToast('Connection failed: ' + error.message, 'error');
    }
}

// ============================================
// FETCH USER IP
// ============================================
async function fetchUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        document.getElementById('current-ip').textContent = data.ip;
    } catch (error) {
        console.error('Failed to fetch IP:', error);
        document.getElementById('current-ip').textContent = 'Unknown';
    }
}

// ============================================
// CHECK CONNECTION STATUS
// ============================================
async function checkConnectionStatus() {
    try {
        const isConnected = await window.go.main.App.IsConnected();
        const notConnectedView = document.getElementById('not-connected-view');
        const connectedView = document.getElementById('connected-view');
        const connectionCard = document.getElementById('connection-card');

        if (isConnected) {
            const stats = await window.go.main.App.GetVPNStats();

            if (stats && stats.connected) {
                notConnectedView.style.display = 'none';
                connectedView.style.display = 'block';
                connectionCard.classList.add('connected');

                // Update server title
                document.getElementById('server-title').textContent = stats.node_name || 'Connected';

                // Fetch public IP
                updateServerIP();

                // Find connected node
                if (nodes.length > 0) {
                    connectedNode = nodes.find(n => n.name === stats.node_name || n.id === stats.node_id);
                    if (connectedNode) {
                        updateLoadDisplay(connectedNode.load_score);
                        setFlagBackground(connectedNode.country_code);
                        renderNodes(nodes);
                        if (map) addServerMarkers(nodes);
                    }
                }

                // Initialize stats
                connectionStartTime = connectionStartTime || new Date();
                previousBytesReceived = 0;
                previousBytesSent = 0;
                previousStatsTime = Date.now();

                startSessionUpdates();
            }
        } else {
            showDisconnectedView();
        }
    } catch (error) {
        console.error('Failed to check connection status:', error);
    }
}

// ============================================
// SHOW DISCONNECTED VIEW
// ============================================
function showDisconnectedView() {
    const notConnectedView = document.getElementById('not-connected-view');
    const connectedView = document.getElementById('connected-view');
    const connectionCard = document.getElementById('connection-card');
    const flagBg = document.getElementById('flag-background');

    notConnectedView.style.display = 'block';
    connectedView.style.display = 'none';
    connectionCard.classList.remove('connected', 'has-flag');
    flagBg.style.display = 'none';

    connectedNode = null;
    fetchUserIP();
}

// ============================================
// UPDATE SERVER IP
// ============================================
async function updateServerIP() {
    const serverIp = document.getElementById('server-ip');
    serverIp.textContent = '...';

    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        serverIp.textContent = data.ip;
    } catch (error) {
        serverIp.textContent = '-';
    }
}

// ============================================
// UPDATE LOAD DISPLAY
// ============================================
function updateLoadDisplay(loadScore) {
    const load = Math.round(loadScore);
    document.getElementById('server-load-display').textContent = load + '%';

    const loadFill = document.getElementById('load-bar-fill');
    loadFill.style.width = load + '%';
    loadFill.className = 'load-bar-fill ' + (load > 80 ? 'high' : load > 50 ? 'medium' : 'low');
}

// ============================================
// SET FLAG BACKGROUND
// ============================================
function setFlagBackground(countryCode) {
    if (!countryCode) return;

    const flagBg = document.getElementById('flag-background');
    const connectionCard = document.getElementById('connection-card');
    const flagUrl = `https://flagcdn.com/w640/${countryCode.toLowerCase()}.png`;

    flagBg.style.backgroundImage = `url('${flagUrl}')`;
    flagBg.style.display = 'block';
    connectionCard.classList.add('has-flag');
}

// ============================================
// LOAD NODES
// ============================================
async function loadNodes() {
    const nodesList = document.getElementById('nodes-list');
    nodesList.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading servers...</div>';

    try {
        nodes = await window.go.main.App.GetNodes('', '');

        if (!nodes || nodes.length === 0) {
            nodesList.innerHTML = '<div class="loading">No servers available</div>';
            return;
        }

        // Sort by load score
        nodes.sort((a, b) => a.load_score - b.load_score);

        renderNodes(nodes);

        if (map) {
            addServerMarkers(nodes);
        }
    } catch (error) {
        console.error('Error loading nodes:', error);
        nodesList.innerHTML = `<div class="loading" style="color:#EF4444;">Failed to load servers</div>`;
        showToast('Failed to load servers', 'error');
    }
}

// ============================================
// FILTER NODES
// ============================================
function filterNodes() {
    const filter = document.getElementById('country-filter').value.toLowerCase();
    const filtered = nodes.filter(node =>
        node.country.toLowerCase().includes(filter) ||
        node.city.toLowerCase().includes(filter) ||
        node.name.toLowerCase().includes(filter)
    );
    renderNodes(filtered);
}

// ============================================
// GET FLAG URL
// ============================================
function getCountryFlagUrl(countryCode, countryName) {
    if (countryCode && countryCode.length === 2) {
        return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
    }

    const countryMap = {
        'united states': 'us', 'usa': 'us', 'united kingdom': 'gb', 'uk': 'gb',
        'germany': 'de', 'france': 'fr', 'netherlands': 'nl', 'spain': 'es',
        'italy': 'it', 'canada': 'ca', 'australia': 'au', 'japan': 'jp',
        'singapore': 'sg', 'india': 'in', 'brazil': 'br', 'mexico': 'mx',
        'sweden': 'se', 'norway': 'no', 'denmark': 'dk', 'finland': 'fi',
        'poland': 'pl', 'switzerland': 'ch', 'austria': 'at', 'belgium': 'be',
        'czech republic': 'cz', 'ireland': 'ie', 'portugal': 'pt', 'greece': 'gr',
        'hong kong': 'hk', 'south korea': 'kr', 'taiwan': 'tw', 'israel': 'il',
        'south africa': 'za', 'new zealand': 'nz', 'argentina': 'ar', 'chile': 'cl',
        'colombia': 'co', 'turkey': 'tr', 'russia': 'ru', 'ukraine': 'ua',
        'romania': 'ro', 'bulgaria': 'bg', 'hungary': 'hu'
    };

    const code = countryMap[(countryName || '').toLowerCase().trim()] || 'us';
    return `https://flagcdn.com/w40/${code}.png`;
}

// ============================================
// RENDER NODES
// ============================================
function renderNodes(nodesToRender) {
    const nodesList = document.getElementById('nodes-list');

    if (!nodesToRender || nodesToRender.length === 0) {
        nodesList.innerHTML = '<div class="loading">No servers found</div>';
        return;
    }

    nodesList.innerHTML = nodesToRender.map(node => {
        const isSelected = selectedNode && selectedNode.id === node.id;
        const isConnected = connectedNode && connectedNode.id === node.id;
        const loadPercentage = Math.round(node.load_score);
        const flagUrl = getCountryFlagUrl(node.country_code, node.country);
        const loadClass = loadPercentage > 80 ? 'high' : loadPercentage > 50 ? 'medium' : 'low';

        return `
            <div class="node-item ${isSelected ? 'selected' : ''} ${isConnected ? 'connected' : ''}" data-node-id="${node.id}">
                <div class="node-flag-wrapper">
                    <img src="${flagUrl}" alt="${node.country}" class="node-flag" onerror="this.src='https://flagcdn.com/w40/us.png'">
                    ${isConnected ? '<div class="connected-indicator"></div>' : ''}
                </div>
                <div class="node-info">
                    <div class="node-name">${node.country}</div>
                    <div class="node-location">${node.city || node.name}</div>
                </div>
                <div class="node-stats">
                    ${node.latency ? `<span class="node-latency">${node.latency}ms</span>` : ''}
                    <div class="node-load">
                        <span class="load-value ${loadClass}">${loadPercentage}%</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers
    document.querySelectorAll('.node-item').forEach(item => {
        item.addEventListener('click', async () => {
            const nodeId = item.getAttribute('data-node-id');
            selectedNode = nodesToRender.find(n => n.id === nodeId);

            const isCurrentlyConnected = await window.go.main.App.IsConnected();
            if (isCurrentlyConnected) {
                if (connectedNode && connectedNode.id === nodeId) {
                    showToast('Already connected to this server', 'info');
                    return;
                }

                if (confirm(`Switch to ${selectedNode.country}?`)) {
                    await disconnectFromVPN();
                    await connectToVPN();
                }
            } else {
                await connectToVPN();
            }
        });
    });
}

// ============================================
// CONNECT TO VPN
// ============================================
async function connectToVPN() {
    if (!selectedNode) {
        showToast('Please select a server first', 'warning');
        return;
    }

    const notConnectedView = document.getElementById('not-connected-view');
    const statusMessage = document.getElementById('status-message');

    try {
        statusMessage.textContent = 'Connecting...';
        statusMessage.classList.remove('disconnected');

        // Use preferred protocol from settings, fall back to what node supports
        let protocol = getPreferredProtocol();
        if (protocol === 'wireguard' && !selectedNode.supports_wireguard) {
            protocol = 'openvpn';
        } else if (protocol === 'openvpn' && !selectedNode.supports_openvpn && selectedNode.supports_wireguard) {
            protocol = 'wireguard';
        }

        const response = await window.go.main.App.ConnectToVPN(selectedNode.id, protocol);

        if (response.success || response.connected) {
            connectedNode = selectedNode;

            // Update UI
            document.getElementById('not-connected-view').style.display = 'none';
            document.getElementById('connected-view').style.display = 'block';
            document.getElementById('connection-card').classList.add('connected');

            document.getElementById('server-title').textContent = selectedNode.country || selectedNode.name;
            document.getElementById('protocol-name').textContent = protocol === 'wireguard' ? 'WireGuard' : 'OpenVPN';

            setFlagBackground(selectedNode.country_code);
            updateLoadDisplay(selectedNode.load_score);
            updateServerIP();

            // Reset stats
            connectionStartTime = new Date();
            previousBytesReceived = 0;
            previousBytesSent = 0;
            previousStatsTime = Date.now();
            totalBytesTransferred = 0;

            renderNodes(nodes);
            if (map) addServerMarkers(nodes);

            startSessionUpdates();
            startConnectionTimer();

            showToast('Connected to ' + selectedNode.country, 'success');
        }
    } catch (error) {
        console.error('Connection error:', error);
        statusMessage.textContent = 'You are not protected';
        statusMessage.classList.add('disconnected');

        showToast('Connection failed: ' + error.message, 'error');
    }
}

// ============================================
// DISCONNECT FROM VPN
// ============================================
async function disconnectFromVPN() {
    const disconnectBtn = document.getElementById('disconnect-btn');
    const serverTitle = document.getElementById('server-title');

    try {
        disconnectBtn.disabled = true;
        serverTitle.textContent = 'Disconnecting...';

        await window.go.main.App.DisconnectVPN();

        showDisconnectedView();
        stopSessionUpdates();
        stopConnectionTimer();

        renderNodes(nodes);
        if (map) addServerMarkers(nodes);

        showToast('Disconnected', 'info');
    } catch (error) {
        console.error('Disconnect error:', error);

        // Check if actually disconnected
        const isConnected = await window.go.main.App.IsConnected();
        if (!isConnected) {
            showDisconnectedView();
            renderNodes(nodes);
            if (map) addServerMarkers(nodes);
        } else {
            showToast('Failed to disconnect', 'error');
        }
    } finally {
        disconnectBtn.disabled = false;
    }
}

// ============================================
// SESSION UPDATES
// ============================================
function startSessionUpdates() {
    if (sessionUpdateInterval) return;

    sessionUpdateInterval = setInterval(async () => {
        try {
            const isConnected = await window.go.main.App.IsConnected();

            if (!isConnected) {
                showDisconnectedView();
                stopSessionUpdates();
                stopConnectionTimer();
                renderNodes(nodes);
                if (map) addServerMarkers(nodes);
                showToast('Connection lost', 'warning');
                return;
            }

            const stats = await window.go.main.App.GetVPNStats();

            if (stats && stats.connected) {
                const currentTime = Date.now();
                const timeDelta = (currentTime - previousStatsTime) / 1000;

                if (stats.bytes_received !== undefined && stats.bytes_sent !== undefined) {
                    if (previousBytesReceived === 0 && previousBytesSent === 0) {
                        previousBytesReceived = stats.bytes_received;
                        previousBytesSent = stats.bytes_sent;
                        previousStatsTime = currentTime;
                    } else if (timeDelta > 0) {
                        const receivedDelta = stats.bytes_received - previousBytesReceived;
                        const sentDelta = stats.bytes_sent - previousBytesSent;

                        const downSpeed = receivedDelta / timeDelta;
                        const upSpeed = sentDelta / timeDelta;

                        document.getElementById('speed-down').textContent = formatSpeed(downSpeed);
                        document.getElementById('speed-up').textContent = formatSpeed(upSpeed);

                        // Update total transferred
                        totalBytesTransferred = stats.bytes_received + stats.bytes_sent;
                        document.getElementById('stat-data-transferred').textContent = formatBytes(totalBytesTransferred);

                        previousBytesReceived = stats.bytes_received;
                        previousBytesSent = stats.bytes_sent;
                        previousStatsTime = currentTime;
                    }
                }
            }
        } catch (error) {
            console.error('Failed to update session:', error);
        }
    }, 2000);
}

function stopSessionUpdates() {
    if (sessionUpdateInterval) {
        clearInterval(sessionUpdateInterval);
        sessionUpdateInterval = null;
    }

    connectionStartTime = null;
    previousBytesReceived = 0;
    previousBytesSent = 0;
    previousStatsTime = Date.now();
}

// ============================================
// CONNECTION TIMER
// ============================================
function startConnectionTimer() {
    if (connectionTimeInterval) return;

    connectionTimeInterval = setInterval(() => {
        if (connectionStartTime) {
            const elapsed = Math.floor((new Date() - connectionStartTime) / 1000);
            const hours = Math.floor(elapsed / 3600);
            const minutes = Math.floor((elapsed % 3600) / 60);
            const seconds = elapsed % 60;

            document.getElementById('stat-connection-time').textContent =
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function stopConnectionTimer() {
    if (connectionTimeInterval) {
        clearInterval(connectionTimeInterval);
        connectionTimeInterval = null;
    }
    document.getElementById('stat-connection-time').textContent = '00:00:00';
}

// ============================================
// LOAD USER STATS
// ============================================
async function loadUserStats() {
    try {
        const stats = await window.go.main.App.GetUserStats();
        if (stats) {
            if (stats.total_sessions !== undefined) {
                document.getElementById('stat-total-sessions').textContent = stats.total_sessions;
            }
            if (stats.data_transferred_gb !== undefined) {
                document.getElementById('stat-data-transferred').textContent = stats.data_transferred_gb.toFixed(2) + ' GB';
            }
        }
    } catch (error) {
        console.error('Failed to load user stats:', error);
    }
}

// ============================================
// FORMAT HELPERS
// ============================================
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSecond) {
    if (bytesPerSecond < 0) bytesPerSecond = 0;
    if (bytesPerSecond === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return (bytesPerSecond / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

// ============================================
// MAP INITIALIZATION
// ============================================
function initMap() {
    if (typeof L === 'undefined') {
        setTimeout(initMap, 100);
        return;
    }

    try {
        map = L.map('map', {
            center: [25, 0],
            zoom: 2.5,
            minZoom: 2,
            maxZoom: 6,
            worldCopyJump: true,
            zoomControl: true,
            attributionControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);

        map.zoomControl.setPosition('bottomright');

        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 250);

        window.addEventListener('resize', () => {
            if (map) map.invalidateSize();
        });
    } catch (error) {
        console.error('Failed to initialize map:', error);
    }
}

// ============================================
// MAP MARKERS
// ============================================
function addServerMarkers(serverNodes) {
    if (!map) return;

    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers.clear();

    serverNodes.forEach(node => {
        if (!node.latitude || !node.longitude) return;

        const loadPercentage = Math.round(node.load_score);
        const isConnected = connectedNode && connectedNode.id === node.id;

        let markerClass = 'server-marker';
        if (isConnected) {
            markerClass += ' connected';
        } else if (loadPercentage > 80) {
            markerClass += ' high-load';
        }

        const icon = L.divIcon({
            className: markerClass,
            iconSize: [16, 14],
            iconAnchor: [8, 14]
        });

        const marker = L.marker([node.latitude, node.longitude], { icon }).addTo(map);

        const flagUrl = node.country_code ? `https://flagcdn.com/w640/${node.country_code.toLowerCase()}.png` : '';
        const loadColor = loadPercentage > 80 ? '#EF4444' : loadPercentage > 50 ? '#F59E0B' : '#10B981';

        const popupContent = `
            <div class="server-popup">
                ${flagUrl ? `<div class="popup-flag-background" style="background-image: url('${flagUrl}');"></div>` : ''}
                <div class="popup-content-wrapper">
                    <h3>${node.name}</h3>
                    <p class="popup-location">${node.city}, ${node.country}</p>
                    <div class="load-bar">
                        <div class="load-fill" style="width: ${loadPercentage}%; background: ${loadColor};"></div>
                    </div>
                    <p class="load-text">Server Load: ${loadPercentage}%</p>
                    ${isConnected ? '<p class="connected-status">Connected</p>' : ''}
                    ${isConnected ?
                        `<button class="disconnect-btn" onclick="disconnectFromServer()">Disconnect</button>` :
                        `<button class="connect-btn" onclick="connectToServer('${node.id}')">Connect</button>`
                    }
                </div>
            </div>
        `;

        marker.bindPopup(popupContent);
        markers.set(node.id, marker);
    });
}

// Global functions for map popup buttons
window.connectToServer = async function(nodeId) {
    selectedNode = nodes.find(n => n.id === nodeId);
    if (selectedNode) {
        map.closePopup();

        const isCurrentlyConnected = await window.go.main.App.IsConnected();
        if (isCurrentlyConnected) {
            if (confirm(`Switch to ${selectedNode.country}?`)) {
                await disconnectFromVPN();
                await connectToVPN();
            }
        } else {
            await connectToVPN();
        }
    }
};

window.disconnectFromServer = async function() {
    map.closePopup();
    await disconnectFromVPN();
};

// ============================================
// SETTINGS MANAGEMENT
// ============================================
const defaultSettings = {
    protocol: 'wireguard',
    killswitch: false,
    autoconnect: false,
    dns: true,
    notifications: true
};

let appSettings = { ...defaultSettings };

function initSettings() {
    // Load saved settings from localStorage
    loadSettings();

    // Protocol select
    const protocolSelect = document.getElementById('protocol-select');
    if (protocolSelect) {
        protocolSelect.value = appSettings.protocol;
        protocolSelect.addEventListener('change', (e) => {
            appSettings.protocol = e.target.value;
            saveSettings();
            showToast(`Protocol changed to ${e.target.value === 'wireguard' ? 'WireGuard' : 'OpenVPN'}`, 'success');
        });
    }

    // Kill Switch toggle
    const killswitchToggle = document.getElementById('killswitch-toggle');
    if (killswitchToggle) {
        killswitchToggle.checked = appSettings.killswitch;
        killswitchToggle.addEventListener('change', (e) => {
            appSettings.killswitch = e.target.checked;
            saveSettings();
            showToast(`Kill Switch ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
        });
    }

    // Auto Connect toggle
    const autoconnectToggle = document.getElementById('autoconnect-toggle');
    if (autoconnectToggle) {
        autoconnectToggle.checked = appSettings.autoconnect;
        autoconnectToggle.addEventListener('change', (e) => {
            appSettings.autoconnect = e.target.checked;
            saveSettings();
            showToast(`Auto Connect ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
        });
    }

    // DNS Leak Protection toggle
    const dnsToggle = document.getElementById('dns-toggle');
    if (dnsToggle) {
        dnsToggle.checked = appSettings.dns;
        dnsToggle.addEventListener('change', (e) => {
            appSettings.dns = e.target.checked;
            saveSettings();
            showToast(`DNS Leak Protection ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
        });
    }

    // Notifications toggle
    const notificationsToggle = document.getElementById('notifications-toggle');
    if (notificationsToggle) {
        notificationsToggle.checked = appSettings.notifications;
        notificationsToggle.addEventListener('change', (e) => {
            appSettings.notifications = e.target.checked;
            saveSettings();
            showToast(`Notifications ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
        });
    }

    // Prevent click events on setting items from interfering with toggle clicks
    document.querySelectorAll('.setting-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // If the click is directly on the setting item (not on control), toggle the input
            if (!e.target.closest('.setting-control')) {
                const toggle = item.querySelector('input[type="checkbox"]');
                const select = item.querySelector('select');
                if (toggle) {
                    toggle.checked = !toggle.checked;
                    toggle.dispatchEvent(new Event('change'));
                } else if (select) {
                    select.focus();
                }
            }
        });
    });
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('aureo-vpn-settings');
        if (saved) {
            appSettings = { ...defaultSettings, ...JSON.parse(saved) };
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        appSettings = { ...defaultSettings };
    }
}

function saveSettings() {
    try {
        localStorage.setItem('aureo-vpn-settings', JSON.stringify(appSettings));
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

function getPreferredProtocol() {
    return appSettings.protocol || 'wireguard';
}
