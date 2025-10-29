// Global state
let currentUser = null;
let selectedNode = null;
let connectedNode = null; // Track which node is currently connected
let nodes = [];
let sessionUpdateInterval = null;
let map = null; // Leaflet map instance
let markers = new Map(); // Store markers by node ID

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Initialize app
window.addEventListener('DOMContentLoaded', async () => {
    console.log('App loading...');
    console.log('Wails runtime available:', !!window.go);

    initLoginScreen();
    initRegisterScreen();
    initAuthToggle();
    initPasswordToggles();
    initDashboard();
    initMap();

    // Check for saved session
    if (window.go && window.go.main && window.go.main.App) {
        await checkSavedSession();
    } else {
        console.error('Wails runtime not available');
    }
});

// Check for saved session and auto-login
async function checkSavedSession() {
    try {
        console.log('Checking saved session...');
        const sessionData = await window.go.main.App.CheckSavedSession();
        console.log('Session data:', sessionData);

        if (sessionData && sessionData.has_session) {
            console.log('Found saved session, auto-login');
            // Auto-login with saved session
            currentUser = sessionData.user;
            document.getElementById('username').textContent = sessionData.user.username;
            showScreen('dashboard-screen');
            console.log('Checking connection status...');
            await checkConnectionStatus();
            console.log('Loading nodes...');
            await loadNodes();
        } else {
            console.log('No saved session found');
        }
    } catch (error) {
        console.error('Failed to check saved session:', error);
        // If there's an error, just stay on login screen
    }
}

// Auth view toggle
function initAuthToggle() {
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.style.display = 'none';
        registerView.style.display = 'block';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerView.style.display = 'none';
        loginView.style.display = 'block';
    });
}

// Password toggle functionality
function initPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.getAttribute('data-target');
            const input = document.getElementById(targetId);

            if (input.type === 'password') {
                input.type = 'text';
                toggle.style.color = '#9ca3af';
            } else {
                input.type = 'password';
                toggle.style.color = '#6b7280';
            }
        });
    });
}

// Initialize Leaflet map
function initMap() {
    console.log('Initializing Leaflet map...');

    // Wait for Leaflet to be loaded
    if (typeof L === 'undefined') {
        console.error('Leaflet not loaded yet');
        setTimeout(initMap, 100);
        return;
    }

    try {
        // Initialize map
        map = L.map('map', {
            center: [25, 0],
            zoom: 2.5,
            minZoom: 2,
            maxZoom: 6,
            worldCopyJump: true,
            zoomControl: true,
            attributionControl: false
        });

        // Add dark theme tile layer (CartoDB Dark Matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap © CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);

        // Position zoom controls
        map.zoomControl.setPosition('bottomright');

        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Failed to initialize map:', error);
    }
}

// Add server markers to map
function addServerMarkers(serverNodes) {
    console.log('addServerMarkers called with', serverNodes.length, 'nodes');

    if (!map) {
        console.error('Map not initialized yet');
        return;
    }

    // Clear existing markers
    markers.forEach(marker => {
        map.removeLayer(marker);
    });
    markers.clear();

    serverNodes.forEach(node => {
        console.log('Processing node:', node.name, 'lat:', node.latitude, 'lng:', node.longitude);

        // Skip nodes without coordinates
        if (!node.latitude || !node.longitude) {
            console.warn('Skipping node without coordinates:', node.name);
            return;
        }

        const loadPercentage = Math.round(node.load_score);
        const isConnected = connectedNode && connectedNode.id === node.id;

        // Determine marker class based on load and connection status
        let markerClass = 'server-marker';
        if (isConnected) {
            markerClass += ' connected';
        } else if (loadPercentage > 80) {
            markerClass += ' high-load';
        }

        // Create custom icon
        const icon = L.divIcon({
            className: markerClass,
            iconSize: [16, 14],
            iconAnchor: [8, 14]
        });

        // Create marker
        const marker = L.marker([node.latitude, node.longitude], { icon })
            .addTo(map);

        // Create popup content
        const popupContent = `
            <div class="server-popup">
                <h3>${node.name}</h3>
                <p>${node.city}, ${node.country}</p>
                <div class="load-bar">
                    <div class="load-fill" style="width: ${loadPercentage}%"></div>
                </div>
                <p class="load-text">Server Load: ${loadPercentage}%</p>
                ${isConnected ? '<p style="color: #22c55e; font-weight: 600; margin-top: 8px;">● Connected</p>' : ''}
                ${!isConnected ? `<button class="connect-btn" onclick="connectToServer('${node.id}')">Connect to Server</button>` : ''}
            </div>
        `;

        marker.bindPopup(popupContent);
        markers.set(node.id, marker);
    });
}

// Connect to server from map popup
window.connectToServer = async function(nodeId) {
    selectedNode = nodes.find(n => n.id === nodeId);
    if (selectedNode) {
        // Close all popups
        map.closePopup();

        // If already connected, ask to switch
        const isCurrentlyConnected = await window.go.main.App.IsConnected();
        if (isCurrentlyConnected) {
            if (confirm(`Switch to ${selectedNode.name}?`)) {
                await disconnectFromVPN();
                await connectToVPN();
            }
        } else {
            await connectToVPN();
        }
    }
}

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
            console.log('Logging in with email:', email, 'API:', apiUrl);
            // Set API URL
            await window.go.main.App.SetAPIURL(apiUrl);

            // Attempt login
            const response = await window.go.main.App.Login(email, password);
            console.log('Login response:', response);

            if (response.success) {
                console.log('Login successful');
                currentUser = response.user;
                document.getElementById('username').textContent = response.user.username;
                showScreen('dashboard-screen');
                console.log('Dashboard shown, checking connection...');
                await checkConnectionStatus();
                console.log('Loading nodes after login...');
                await loadNodes();
            } else {
                console.error('Login failed:', response);
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = error.message || 'Login failed. Please check your credentials.';
        }
    });
}

// Register screen initialization
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

        try {
            // Set API URL
            await window.go.main.App.SetAPIURL(apiUrl);

            // Attempt register
            const response = await window.go.main.App.Register(email, password, username);

            if (response.success) {
                currentUser = response.user;
                document.getElementById('username').textContent = response.user.username;
                showScreen('dashboard-screen');
                await checkConnectionStatus();
                await loadNodes();
            }
        } catch (error) {
            registerError.textContent = error.message || 'Registration failed. Please try again.';
        }
    });
}

// Dashboard initialization
function initDashboard() {
    console.log('Initializing dashboard...');

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await window.go.main.App.Logout();
        currentUser = null;
        selectedNode = null;
        nodes = [];
        stopSessionUpdates();
        showScreen('login-screen');
    });

    // Disconnect button
    const disconnectBtn = document.getElementById('disconnect-btn');
    if (disconnectBtn) {
        console.log('Disconnect button found, adding event listener');
        disconnectBtn.addEventListener('click', () => {
            console.log('Disconnect button click event fired');
            disconnectFromVPN();
        });
    } else {
        console.error('Disconnect button not found in DOM');
    }

    // Change server button
    const changeServerBtn = document.getElementById('change-server-btn');
    if (changeServerBtn) {
        changeServerBtn.addEventListener('click', () => {
            // Just show the node selection UI - disconnect is optional
            document.getElementById('countries-list').scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Sidebar tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // For now, only countries tab is functional
            // TODO: Implement profiles tab
        });
    });

    // Country filter
    document.getElementById('country-filter').addEventListener('input', filterNodes);
}

// Check connection status when dashboard loads
async function checkConnectionStatus() {
    try {
        console.log('checkConnectionStatus: Calling IsConnected...');
        const isConnected = await window.go.main.App.IsConnected();
        console.log('checkConnectionStatus: IsConnected returned:', isConnected);

        if (isConnected) {
            // Update connection card
            const serverName = document.getElementById('server-name');
            const serverDetails = document.getElementById('server-details');
            const connectionStats = document.getElementById('connection-stats');
            const disconnectBtn = document.getElementById('disconnect-btn');
            const changeServerBtn = document.getElementById('change-server-btn');
            const backBtn = document.getElementById('back-btn');

            // Show disconnect and change server buttons
            disconnectBtn.style.display = 'block';
            changeServerBtn.style.display = 'block';
            backBtn.style.display = 'none';
            connectionStats.style.display = 'block';
            serverDetails.style.display = 'block';

            // Get VPN stats
            try {
                const stats = await window.go.main.App.GetVPNStats();
                if (stats && stats.connected) {
                    if (stats.node_name) {
                        serverName.textContent = stats.node_name;

                        // Try to find and set the connected node
                        if (nodes.length > 0) {
                            connectedNode = nodes.find(n => n.name === stats.node_name);
                            if (connectedNode) {
                                renderNodes(nodes);
                            }
                        }
                    }

                    // Start session updates for real-time stats
                    startSessionUpdates();
                }
            } catch (err) {
                console.error('Failed to get VPN stats:', err);
            }
        } else {
            // Reset connection card
            const serverName = document.getElementById('server-name');
            const serverDetails = document.getElementById('server-details');
            const connectionStats = document.getElementById('connection-stats');
            const disconnectBtn = document.getElementById('disconnect-btn');
            const changeServerBtn = document.getElementById('change-server-btn');

            serverName.textContent = 'Not Connected';
            serverDetails.style.display = 'none';
            connectionStats.style.display = 'none';
            disconnectBtn.style.display = 'none';
            changeServerBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to check connection status:', error);
    }
}

// Load nodes from API
async function loadNodes() {
    console.log('loadNodes called');
    const nodesList = document.getElementById('nodes-list');
    nodesList.innerHTML = '<div class="loading">Loading nodes...</div>';

    try {
        // No protocol filter in new UI, get all nodes
        const country = '';
        const protocol = ''; // Empty string to get all protocols

        console.log('Calling GetNodes API...');
        nodes = await window.go.main.App.GetNodes(country, protocol);
        console.log('Received nodes:', nodes);
        console.log('Number of nodes:', nodes ? nodes.length : 0);

        if (!nodes || nodes.length === 0) {
            nodesList.innerHTML = '<div class="loading">No nodes available</div>';
            return;
        }

        renderNodes(nodes);

        // Add markers to map if map is initialized
        if (map) {
            console.log('Adding markers to map');
            addServerMarkers(nodes);
        } else {
            console.warn('Map not initialized, skipping markers');
        }
    } catch (error) {
        console.error('Error loading nodes:', error);
        nodesList.innerHTML = `<div class="error-message">Failed to load nodes: ${error.message || error}</div>`;
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

// Get country flag URL
function getCountryFlagUrl(countryCode, countryName) {
    // If we have a country code, use it
    if (countryCode && countryCode.length === 2) {
        return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
    }

    // Try to map common country names to ISO codes
    const countryMap = {
        'united states': 'us',
        'usa': 'us',
        'united kingdom': 'gb',
        'uk': 'gb',
        'germany': 'de',
        'france': 'fr',
        'netherlands': 'nl',
        'spain': 'es',
        'italy': 'it',
        'canada': 'ca',
        'australia': 'au',
        'japan': 'jp',
        'singapore': 'sg',
        'india': 'in',
        'brazil': 'br',
        'mexico': 'mx',
        'sweden': 'se',
        'norway': 'no',
        'denmark': 'dk',
        'finland': 'fi',
        'poland': 'pl',
        'switzerland': 'ch',
        'austria': 'at',
        'belgium': 'be',
        'czech republic': 'cz',
        'ireland': 'ie',
        'portugal': 'pt',
        'greece': 'gr',
        'hong kong': 'hk',
        'south korea': 'kr',
        'taiwan': 'tw',
        'israel': 'il',
        'south africa': 'za',
        'new zealand': 'nz',
        'argentina': 'ar',
        'chile': 'cl',
        'colombia': 'co',
        'turkey': 'tr',
        'russia': 'ru',
        'ukraine': 'ua',
        'romania': 'ro',
        'bulgaria': 'bg',
        'hungary': 'hu'
    };

    const normalizedName = (countryName || '').toLowerCase().trim();
    const code = countryMap[normalizedName] || 'us'; // Default to USA
    return `https://flagcdn.com/w40/${code}.png`;
}

// Render nodes list
function renderNodes(nodesToRender) {
    console.log('renderNodes called with', nodesToRender ? nodesToRender.length : 0, 'nodes');
    const nodesList = document.getElementById('nodes-list');

    if (!nodesToRender || nodesToRender.length === 0) {
        console.warn('No nodes to render');
        nodesList.innerHTML = '<div class="loading">No nodes available</div>';
        return;
    }

    console.log('Rendering nodes:', nodesToRender);
    nodesList.innerHTML = nodesToRender.map(node => {
        const isSelected = selectedNode && selectedNode.id === node.id;
        const isConnected = connectedNode && connectedNode.id === node.id;
        const loadPercentage = Math.round(node.load_score);
        const flagUrl = getCountryFlagUrl(node.country_code, node.country);

        return `
            <div class="node-item ${isSelected ? 'selected' : ''} ${isConnected ? 'connected' : ''}" data-node-id="${node.id}">
                <div class="node-flag-wrapper">
                    <img src="${flagUrl}" alt="${node.country}" class="node-flag" onerror="this.src='https://flagcdn.com/w40/us.png'">
                    ${isConnected ? '<div class="connected-dot"></div>' : ''}
                </div>
                <div class="node-info">
                    <div class="node-name">${node.country}</div>
                    <div class="node-location">${node.city || node.name}</div>
                </div>
                <div class="node-load">
                    <span class="load-value">${loadPercentage}%</span>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers
    document.querySelectorAll('.node-item').forEach(item => {
        item.addEventListener('click', async () => {
            const nodeId = item.getAttribute('data-node-id');
            selectedNode = nodesToRender.find(n => n.id === nodeId);

            // If already connected, ask to change server
            const isCurrentlyConnected = await window.go.main.App.IsConnected();
            if (isCurrentlyConnected) {
                if (confirm(`Switch to ${selectedNode.name}?`)) {
                    await disconnectFromVPN();
                    await connectToVPN();
                }
            } else {
                // Direct connect
                await connectToVPN();
            }
        });
    });
}

// Connect to VPN
async function connectToVPN() {
    console.log('Connect to VPN called');
    console.log('Selected node:', selectedNode);

    if (!selectedNode) {
        console.error('No node selected');
        alert('Please select a node first');
        return;
    }

    // UI elements
    const serverName = document.getElementById('server-name');
    const serverIP = document.getElementById('server-ip');
    const serverLoad = document.getElementById('server-load');
    const serverDetails = document.getElementById('server-details');
    const connectionStats = document.getElementById('connection-stats');
    const protocolName = document.getElementById('protocol-name');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const changeServerBtn = document.getElementById('change-server-btn');

    try {
        console.log('Starting connection process...');

        // Update UI to show connecting
        serverName.textContent = `Connecting to ${selectedNode.name}...`;

        // Determine protocol - prefer WireGuard
        const protocol = selectedNode.supports_wireguard ? 'wireguard' : 'openvpn';
        console.log('Using protocol:', protocol);
        console.log('Node ID:', selectedNode.id);

        // Connect - This will prompt for sudo password via terminal
        console.log('Calling ConnectToVPN...');
        const response = await window.go.main.App.ConnectToVPN(selectedNode.id, protocol);
        console.log('Connection response:', response);

        if (response.success || response.connected) {
            console.log('Connection successful');

            // Set connected node
            connectedNode = selectedNode;

            // Update connection card
            serverName.textContent = selectedNode.name;
            serverIP.textContent = response.client_ip || selectedNode.ip || '-';
            serverLoad.textContent = Math.round(selectedNode.load_score) + '%';
            protocolName.textContent = protocol === 'wireguard' ? 'WireGuard' : 'OpenVPN';

            // Show connection details
            serverDetails.style.display = 'block';
            connectionStats.style.display = 'block';
            disconnectBtn.style.display = 'block';
            changeServerBtn.style.display = 'block';

            // Reset connection start time
            connectionStartTime = new Date();

            // Re-render nodes to show connected indicator
            renderNodes(nodes);

            // Update map markers
            if (map) {
                addServerMarkers(nodes);
            }

            // Start session updates for real-time stats
            startSessionUpdates();
        } else {
            console.error('Connection response did not indicate success');
            throw new Error('Connection failed');
        }
    } catch (error) {
        console.error('Connection error:', error);
        alert(`Failed to connect: ${error}\n\nMake sure:\n1. WireGuard is installed (brew install wireguard-tools)\n2. You enter your password when prompted\n3. You have admin privileges`);

        // Reset UI
        serverName.textContent = 'Connection Failed';
        serverDetails.style.display = 'none';
        connectionStats.style.display = 'none';
    }
    console.log('Connect function completed');
}

// Disconnect from VPN
async function disconnectFromVPN() {
    const disconnectBtn = document.getElementById('disconnect-btn');
    const serverName = document.getElementById('server-name');
    const serverDetails = document.getElementById('server-details');
    const connectionStats = document.getElementById('connection-stats');
    const changeServerBtn = document.getElementById('change-server-btn');

    try {
        disconnectBtn.disabled = true;

        // Update UI
        serverName.textContent = 'Disconnecting...';

        // Disconnect - This will prompt for sudo password via terminal
        await window.go.main.App.DisconnectVPN();

        // Clear connected node
        connectedNode = null;

        // Update UI
        serverName.textContent = 'Not Connected';
        serverDetails.style.display = 'none';
        connectionStats.style.display = 'none';
        disconnectBtn.style.display = 'none';
        changeServerBtn.style.display = 'none';

        // Re-render nodes to remove connected indicator
        renderNodes(nodes);

        // Update map markers
        if (map) {
            addServerMarkers(nodes);
        }

        // Stop session updates
        stopSessionUpdates();
    } catch (error) {
        console.error('Disconnect error:', error);
        alert(`Failed to disconnect: ${error}\n\nYou may need to manually run: sudo wg-quick down ~/.aureo-vpn/wg0.conf`);
    } finally {
        disconnectBtn.disabled = false;
    }
}


// Start periodic session updates
function startSessionUpdates() {
    if (sessionUpdateInterval) return;

    sessionUpdateInterval = setInterval(async () => {
        try {
            // Check if still connected
            const isConnected = await window.go.main.App.IsConnected();

            if (!isConnected) {
                // Connection lost, update UI
                const serverName = document.getElementById('server-name');
                const serverDetails = document.getElementById('server-details');
                const connectionStats = document.getElementById('connection-stats');

                // Clear connected node
                connectedNode = null;

                serverName.textContent = 'Connection Lost';
                serverDetails.style.display = 'none';
                connectionStats.style.display = 'none';
                document.getElementById('disconnect-btn').style.display = 'none';
                document.getElementById('change-server-btn').style.display = 'none';

                // Re-render nodes to remove connected indicator
                renderNodes(nodes);

                // Update map markers
                if (map) {
                    addServerMarkers(nodes);
                }

                stopSessionUpdates();
                return;
            }

            // Get VPN stats
            const stats = await window.go.main.App.GetVPNStats();
            if (stats && stats.connected) {
                // Update speed stats in connection card
                const speedDown = document.getElementById('speed-down');
                const speedUp = document.getElementById('speed-up');

                if (speedDown && speedUp) {
                    // Calculate speed based on bytes transferred
                    // Note: This is cumulative, not real-time speed
                    // For real speed, we'd need to track changes over time
                    if (stats.bytes_received !== undefined) {
                        // Simple approximation: show as KB/s
                        const kbps = Math.round(stats.bytes_received / 1024 / 2); // Rough estimate
                        speedDown.textContent = kbps > 0 ? `${kbps} KB/s` : '0 KB/s';
                    }
                    if (stats.bytes_sent !== undefined) {
                        const kbps = Math.round(stats.bytes_sent / 1024 / 2); // Rough estimate
                        speedUp.textContent = kbps > 0 ? `${kbps} KB/s` : '0 KB/s';
                    }
                }
            }
        } catch (error) {
            console.error('Failed to update session:', error);
        }
    }, 2000); // Update every 2 seconds for better real-time feel
}

// Track connection start time
let connectionStartTime = null;

// Stop session updates
function stopSessionUpdates() {
    if (sessionUpdateInterval) {
        clearInterval(sessionUpdateInterval);
        sessionUpdateInterval = null;
    }
    // Reset connection start time
    connectionStartTime = null;
}

// Format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
