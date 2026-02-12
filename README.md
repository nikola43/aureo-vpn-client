<div align="center">

# 🖥️ Aureo VPN — Desktop Client

### Cross-platform VPN application built with Go and Wails

[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?style=for-the-badge&logo=go&logoColor=white)](https://go.dev/)
[![Wails](https://img.shields.io/badge/Wails-2.x-DF0000?style=for-the-badge)](https://wails.io/)
[![macOS](https://img.shields.io/badge/macOS-Supported-000000?style=for-the-badge&logo=apple&logoColor=white)]()
[![Windows](https://img.shields.io/badge/Windows-Supported-0078D6?style=for-the-badge&logo=windows&logoColor=white)]()
[![Linux](https://img.shields.io/badge/Linux-Supported-FCC624?style=for-the-badge&logo=linux&logoColor=black)]()

</div>

---

## 📸 Screenshots

<table>
<tr>
<td align="center" width="50%">

**Login**

`<!-- screenshot -->`

</td>
<td align="center" width="50%">

**Dashboard**

`<!-- screenshot -->`

</td>
</tr>
</table>

---

## ✨ Features

- 🔒 **VPN Connection** — Connect to VPN using WireGuard or OpenVPN
- 🗺️ **Interactive World Map** — Leaflet.js-powered map with node markers and load indicators
- 🌐 **Server Browser** — Browse nodes by country and protocol with real-time load data
- ⚡ **Quick Actions** — Quick Connect, Secure Core, P2P Friendly, Random Server
- 📊 **Real-Time Stats** — Live upload/download speed, data transferred, connection timer
- 🔑 **User Authentication** — Login/register with session persistence
- 🎨 **Premium Dark UI** — Gold-accented design with color-coded load indicators

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Aureo Desktop App                         │
│                                                               │
│  ┌─────────────────────┐     ┌──────────────────────────┐   │
│  │   Frontend (Web)    │     │      Go Backend          │   │
│  │                     │     │                          │   │
│  │  HTML/JS/CSS        │◄───►│  App struct              │   │
│  │  Leaflet.js Map     │     │  ├── api.Client          │   │
│  │  Tabs & Controls    │     │  ├── vpn.WireGuardMgr    │   │
│  │                     │     │  ├── Session state        │   │
│  │  Wails JS Bindings  │     │  └── Config (~/.aureo)   │   │
│  └─────────────────────┘     └──────────┬───────────────┘   │
│                                          │                    │
└──────────────────────────────────────────┼────────────────────┘
                                           │ HTTPS/REST
                                           ▼
                                ┌──────────────────────┐
                                │   Aureo API Gateway   │
                                │   (aureo-vpn backend)  │
                                └──────────────────────┘
```

---

## 📦 Prerequisites

Before building the application, ensure you have the following installed:

### 1️⃣ Go (1.21 or later)
```bash
# Check Go version
go version
```

### 2️⃣ Wails CLI
```bash
# Install Wails
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### 3️⃣ Node.js (for frontend dependencies, if needed)

### 4️⃣ Platform-specific requirements
- **macOS**: Xcode Command Line Tools
- **Windows**: WebView2
- **Linux**: GTK3 and webkit2gtk

---

## 🌐 API Endpoints Used

The client communicates with the Aureo VPN API Gateway. Here are the endpoints used:

### 🔑 Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration

### 📡 Nodes
- `GET /api/v1/nodes` - List all available VPN nodes
  - Query params: `country`, `protocol`
- `GET /api/v1/nodes/best` - Get the best available node
- `GET /api/v1/nodes/:id` - Get specific node details

### 🔗 Sessions
- `POST /api/v1/sessions` - Create new VPN session
  - Body: `{"node_id": "uuid", "protocol": "wireguard|openvpn"}`
- `GET /api/v1/sessions/:id` - Get session details
- `DELETE /api/v1/sessions/:id` - Disconnect VPN session

### 👤 User
- `GET /api/v1/user/profile` - Get user profile
- `GET /api/v1/user/sessions` - Get all user sessions
- `GET /api/v1/user/stats` - Get user statistics

### ⚙️ Config
- `POST /api/v1/config/generate` - Generate VPN configuration
  - Body: `{"node_id": "uuid", "protocol": "wireguard|openvpn"}`

---

## 📁 Project Structure

```
aureo-vpn-client/
├── main.go                    # Main entry point
├── app.go                     # Application logic exposed to frontend
├── wails.json                 # Wails configuration
├── go.mod                     # Go dependencies
├── internal/
│   ├── api/
│   │   └── client.go         # API client for HTTP requests
│   └── models/
│       └── models.go         # Data models
└── frontend/
    └── dist/
        ├── index.html        # Main HTML
        ├── style.css         # Styling
        └── app.js            # Frontend JavaScript
```

---

## 🔨 Building

### ⚡ Development Mode

Run the application in development mode with hot reload:

```bash
cd aureo-vpn-client
wails dev
```

### 📦 Production Build

Build the application for your platform:

```bash
# Build for current platform
wails build

# Build for specific platform
wails build -platform darwin/universal    # macOS (Universal binary)
wails build -platform windows/amd64       # Windows 64-bit
wails build -platform linux/amd64         # Linux 64-bit
```

The built application will be in the `build/bin` directory.

---

## ⚙️ Configuration

### 🌐 API URL

The default API URL is `http://localhost:8080`. You can change this in the login screen before logging in.

To permanently change the default, modify the `startup` function in `app.go`:

```go
func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    // Change this URL to your API Gateway address
    a.apiClient = api.NewClient("http://your-api-gateway:8080")
}
```

---

## 🚀 Usage

### 1️⃣ Launch the application
The login screen will appear.

### 2️⃣ Configure API URL (optional)
Enter your Aureo VPN API Gateway URL. Default: `http://localhost:8080`

### 3️⃣ Login
Enter your email and password, then click "Login".

### 4️⃣ Select a VPN node
Browse the list of available nodes. Filter by protocol (WireGuard/OpenVPN) or by country/city. Click on a node to select it.

### 5️⃣ Connect to VPN
Click the "Connect" button. The app will create a session with the selected node and update the status to "Connected".

### 6️⃣ Monitor your connection
View session information: tunnel IP, protocol, data usage. Real-time statistics update every 5 seconds.

### 7️⃣ Disconnect
Click the "Disconnect" button to terminate the session.

---

## ⚡ Backend Methods

The following methods are exposed to the frontend via Wails:

### 🔑 Authentication
- `Login(email, password string)` - Authenticate user
- `Register(email, password, username string)` - Create new account
- `Logout()` - Clear session
- `IsLoggedIn()` - Check if user is authenticated

### 📡 Node Management
- `GetNodes(country, protocol string)` - Get list of nodes
- `GetBestNode()` - Get optimal node
- `GetNode(nodeID string)` - Get specific node details

### 🔗 VPN Connection
- `ConnectToVPN(nodeID, protocol string)` - Connect to VPN
- `DisconnectVPN()` - Disconnect from VPN
- `IsConnected()` - Check connection status
- `GetCurrentSession()` - Get active session details
- `GetAllSessions()` - Get all user sessions

### 👤 User Info
- `GetCurrentUser()` - Get logged-in user
- `GetUserProfile()` - Get user profile from API
- `GetUserStats()` - Get usage statistics

### ⚙️ Configuration
- `SetAPIURL(url string)` - Set API base URL
- `GenerateConfig(nodeID, protocol string)` - Generate VPN config

---

## 🔐 VPN Protocols

### 🔒 WireGuard
- Modern, fast, and secure VPN protocol
- Uses UDP for optimal performance
- Recommended for most use cases

### 🔒 OpenVPN
- Established VPN protocol
- More compatible with restricted networks
- TCP and UDP support

---

## 🐛 Troubleshooting

### ⚠️ Cannot connect to API
- Ensure the API Gateway is running
- Check the API URL in the login screen
- Verify network connectivity

### 🔨 Build errors
```bash
# Clean build cache
rm -rf build/

# Update Wails
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Install dependencies
go mod download
```

### 🌐 Frontend not loading
```bash
# Ensure frontend directory exists
ls -la frontend/dist/

# Verify files are present
ls -la frontend/dist/*.html
```

---

## 👷 Development

### ➕ Adding new features

1. **Backend**: Add methods to `app.go` and expose them to frontend
2. **API Client**: Add API calls to `internal/api/client.go`
3. **Models**: Define data structures in `internal/models/models.go`
4. **Frontend**: Update `frontend/dist/app.js` to call new backend methods

### 🧪 Testing

```bash
# Run API Gateway (in aureo-vpn directory)
cd ../aureo-vpn
go run cmd/api-gateway/main.go

# Run VPN Client in dev mode
cd ../aureo-vpn-client
wails dev
```

---

## 🛡️ Security Notes

- 🔒 Access tokens are stored in memory only
- 🔐 Passwords are never stored locally
- 🌐 All API communication should use HTTPS in production
- 🔑 VPN configurations contain sensitive keys — handle with care

---

## 📄 License

See LICENSE file for details.

---

## 💬 Support

For issues or questions, please refer to the Aureo VPN documentation or contact support.

---

<div align="center">

Built with ❤️ using Go & Wails

</div>
