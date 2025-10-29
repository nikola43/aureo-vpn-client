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

        // Fix initial display issue - invalidate size after a short delay
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                console.log('Map size invalidated');
            }
        }, 250);

        // Also invalidate on window resize
        window.addEventListener('resize', () => {
            if (map) {
                map.invalidateSize();
            }
        });
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

    // Fetch user's public IP
    fetchUserIP();

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await window.go.main.App.Logout();
        currentUser = null;
        selectedNode = null;
        nodes = [];
        stopSessionUpdates();
        showScreen('login-screen');
    });

    // Quick Connect button
    const quickConnectBtn = document.getElementById('quick-connect-btn');
    if (quickConnectBtn) {
        console.log('Quick Connect button found');
        quickConnectBtn.addEventListener('click', async () => {
            console.log('Quick Connect clicked');
            try {
                if (!nodes || nodes.length === 0) {
                    console.log('No nodes loaded, loading nodes...');
                    await loadNodes();
                }

                if (nodes.length === 0) {
                    alert('No servers available');
                    return;
                }

                // Pick the fastest node (lowest load_score)
                selectedNode = nodes.reduce((best, node) =>
                    node.load_score < best.load_score ? node : best
                );
                console.log('Selected fastest node:', selectedNode.name, 'with load:', selectedNode.load_score);
                await connectToVPN();
            } catch (error) {
                console.error('Quick Connect error:', error);
                alert('Failed to quick connect: ' + error.message);
            }
        });
    }

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

// Fetch user's public IP
async function fetchUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        document.getElementById('current-ip').textContent = data.ip;
    } catch (error) {
        console.error('Failed to fetch IP:', error);
        document.getElementById('current-ip').textContent = 'Unable to fetch';
    }
}

// Check connection status when dashboard loads
async function checkConnectionStatus() {
    try {
        console.log('checkConnectionStatus: Calling IsConnected...');
        const isConnected = await window.go.main.App.IsConnected();
        console.log('checkConnectionStatus: IsConnected returned:', isConnected);

        const notConnectedView = document.getElementById('not-connected-view');
        const connectedView = document.getElementById('connected-view');

        if (isConnected) {
            // Show connected view
            notConnectedView.style.display = 'none';
            connectedView.style.display = 'block';

            // Get VPN stats
            try {
                const stats = await window.go.main.App.GetVPNStats();
                if (stats && stats.connected) {
                    if (stats.node_name) {
                        document.getElementById('server-title').textContent = stats.node_name;

                        // Try to find and set the connected node
                        if (nodes.length > 0) {
                            connectedNode = nodes.find(n => n.name === stats.node_name);
                            if (connectedNode) {
                                // Set flag background
                                const flagUrl = `https://flagcdn.com/w640/${connectedNode.country_code.toLowerCase()}.png`;
                                document.getElementById('flag-background').style.backgroundImage = `url('${flagUrl}')`;
                                document.getElementById('flag-background').style.display = 'block';

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
            // Show not connected view
            notConnectedView.style.display = 'block';
            connectedView.style.display = 'none';
            document.getElementById('flag-background').style.display = 'none';
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

    const notConnectedView = document.getElementById('not-connected-view');
    const connectedView = document.getElementById('connected-view');

    try {
        console.log('Starting connection process...');

        // Show connecting message
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
            statusMessage.textContent = 'Connecting...';
        }

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

            // Reset status message before hiding
            if (statusMessage) {
                statusMessage.textContent = 'You are not connected';
            }

            // Switch to connected view
            if (notConnectedView) notConnectedView.style.display = 'none';
            if (connectedView) connectedView.style.display = 'block';

            // Set flag background
            if (selectedNode.country_code) {
                const flagUrl = `https://flagcdn.com/w640/${selectedNode.country_code.toLowerCase()}.png`;
                const flagBg = document.getElementById('flag-background');
                if (flagBg) {
                    flagBg.style.backgroundImage = `url('${flagUrl}')`;
                    flagBg.style.display = 'block';
                }
            }

            // Update connection card
            const serverTitle = document.getElementById('server-title');
            if (serverTitle) {
                serverTitle.textContent = selectedNode.country || selectedNode.name;
            }

            const serverIp = document.getElementById('server-ip');
            if (serverIp) {
                serverIp.textContent = 'Fetching...';
                // Fetch real public IP from external API after connecting
                try {
                    const ipResponse = await fetch('https://api.ipify.org?format=json');
                    const ipData = await ipResponse.json();
                    serverIp.textContent = ipData.ip;
                } catch (ipError) {
                    console.error('Failed to fetch public IP:', ipError);
                    serverIp.textContent = response.client_ip || selectedNode.public_ip || '-';
                }
            }

            const serverLoadDisplay = document.getElementById('server-load-display');
            if (serverLoadDisplay) {
                serverLoadDisplay.textContent = Math.round(selectedNode.load_score) + '%';
            }

            // Update load circle
            const loadProgress = document.getElementById('load-ring-progress');
            if (loadProgress) {
                const load = Math.round(selectedNode.load_score);
                loadProgress.setAttribute('stroke-dasharray', `${load}, 100`);
                // Change color based on load
                if (load > 80) {
                    loadProgress.style.stroke = '#ef4444'; // red
                } else if (load > 50) {
                    loadProgress.style.stroke = '#eab308'; // yellow
                } else {
                    loadProgress.style.stroke = '#22c55e'; // green
                }
            }

            const protocolName = document.getElementById('protocol-name');
            if (protocolName) {
                protocolName.textContent = protocol === 'wireguard' ? 'WireGuard' : 'OpenVPN';
            }

            // Reset connection start time and stats tracking
            connectionStartTime = new Date();
            previousBytesReceived = 0;
            previousBytesSent = 0;
            previousStatsTime = Date.now();

            // Re-render nodes to show connected indicator
            if (nodes && nodes.length > 0) {
                renderNodes(nodes);
            }

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

        // Reset to not connected view
        if (notConnectedView) notConnectedView.style.display = 'block';
        if (connectedView) connectedView.style.display = 'none';

        const flagBg = document.getElementById('flag-background');
        if (flagBg) flagBg.style.display = 'none';

        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
            statusMessage.textContent = 'You are not connected';
        }
    }
    console.log('Connect function completed');
}

// Disconnect from VPN
async function disconnectFromVPN() {
    console.log('Disconnect from VPN called');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const notConnectedView = document.getElementById('not-connected-view');
    const connectedView = document.getElementById('connected-view');

    try {
        if (disconnectBtn) {
            disconnectBtn.disabled = true;
        }

        // Update UI
        const serverTitle = document.getElementById('server-title');
        if (serverTitle) {
            serverTitle.textContent = 'Disconnecting...';
        }

        // Disconnect - This will prompt for sudo password via terminal
        await window.go.main.App.DisconnectVPN();
        console.log('DisconnectVPN completed successfully');

        // Clear connected node
        connectedNode = null;

        // Switch to not connected view
        if (notConnectedView) notConnectedView.style.display = 'block';
        if (connectedView) connectedView.style.display = 'none';
        const flagBg = document.getElementById('flag-background');
        if (flagBg) flagBg.style.display = 'none';

        // Re-render nodes to remove connected indicator
        if (nodes && nodes.length > 0) {
            renderNodes(nodes);
        }

        // Update map markers
        if (map) {
            addServerMarkers(nodes);
        }

        // Refresh user IP
        fetchUserIP();

        // Stop session updates
        stopSessionUpdates();
    } catch (error) {
        console.error('Disconnect error:', error);

        // Force UI update even on error - clear state
        connectedNode = null;
        stopSessionUpdates();

        // Check if already disconnected
        try {
            const isConnected = await window.go.main.App.IsConnected();
            if (!isConnected) {
                console.log('Already disconnected, updating UI');
                // Already disconnected, just update UI
                if (notConnectedView) notConnectedView.style.display = 'block';
                if (connectedView) connectedView.style.display = 'none';
                const flagBg = document.getElementById('flag-background');
                if (flagBg) flagBg.style.display = 'none';

                if (nodes && nodes.length > 0) {
                    renderNodes(nodes);
                }
                if (map) {
                    addServerMarkers(nodes);
                }
                fetchUserIP();
            } else {
                // Still connected, show error
                alert(`Failed to disconnect: ${error}\n\nYou may need to manually run: sudo wg-quick down ~/.aureo-vpn/wg0.conf`);
            }
        } catch (checkError) {
            console.error('Failed to check connection status:', checkError);
            alert(`Failed to disconnect: ${error}`);
        }
    } finally {
        if (disconnectBtn) {
            disconnectBtn.disabled = false;
        }
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
                const notConnectedView = document.getElementById('not-connected-view');
                const connectedView = document.getElementById('connected-view');

                // Clear connected node
                connectedNode = null;

                // Switch to not connected view
                if (notConnectedView) notConnectedView.style.display = 'block';
                if (connectedView) connectedView.style.display = 'none';

                const flagBg = document.getElementById('flag-background');
                if (flagBg) flagBg.style.display = 'none';

                // Re-render nodes to remove connected indicator
                if (nodes && nodes.length > 0) {
                    renderNodes(nodes);
                }

                // Update map markers
                if (map) {
                    addServerMarkers(nodes);
                }

                // Refresh user IP
                fetchUserIP();

                stopSessionUpdates();
                return;
            }

            // Get VPN stats
            const stats = await window.go.main.App.GetVPNStats();
            console.log('VPN Stats:', stats);
            if (stats && stats.connected) {
                // Update speed stats in connection card
                const speedDown = document.getElementById('speed-down');
                const speedUp = document.getElementById('speed-up');

                if (speedDown && speedUp) {
                    const currentTime = Date.now();
                    const timeDelta = (currentTime - previousStatsTime) / 1000; // seconds

                    if (stats.bytes_received !== undefined && stats.bytes_sent !== undefined) {
                        // On first reading, just initialize the values
                        if (previousBytesReceived === 0 && previousBytesSent === 0) {
                            previousBytesReceived = stats.bytes_received;
                            previousBytesSent = stats.bytes_sent;
                            previousStatsTime = currentTime;
                            speedDown.textContent = '0 B/s';
                            speedUp.textContent = '0 B/s';
                        } else if (timeDelta > 0) {
                            // Calculate real-time speed based on delta
                            const receivedDelta = stats.bytes_received - previousBytesReceived;
                            const sentDelta = stats.bytes_sent - previousBytesSent;

                            const downSpeed = receivedDelta / timeDelta; // bytes per second
                            const upSpeed = sentDelta / timeDelta; // bytes per second

                            // Format speed
                            speedDown.textContent = formatSpeed(downSpeed);
                            speedUp.textContent = formatSpeed(upSpeed);

                            // Update previous values
                            previousBytesReceived = stats.bytes_received;
                            previousBytesSent = stats.bytes_sent;
                            previousStatsTime = currentTime;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to update session:', error);
            // Don't stop updates on error, just log it
        }
    }, 2000); // Update every 2 seconds for better real-time feel
}

// Track connection start time and stats for speed calculation
let connectionStartTime = null;
let previousBytesReceived = 0;
let previousBytesSent = 0;
let previousStatsTime = Date.now();

// Stop session updates
function stopSessionUpdates() {
    if (sessionUpdateInterval) {
        clearInterval(sessionUpdateInterval);
        sessionUpdateInterval = null;
    }
    // Reset connection start time and stats
    connectionStartTime = null;
    previousBytesReceived = 0;
    previousBytesSent = 0;
    previousStatsTime = Date.now();
}

// Format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Format speed (bytes per second)
function formatSpeed(bytesPerSecond) {
    if (bytesPerSecond < 0) bytesPerSecond = 0;
    if (bytesPerSecond === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return Math.round(bytesPerSecond / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
