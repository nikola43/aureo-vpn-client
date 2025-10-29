package models

import "time"

// LoginRequest represents the login credentials
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse represents the login response
type LoginResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	User         User   `json:"user"`
}

// User represents a user
type User struct {
	ID                 string    `json:"id"`
	Email              string    `json:"email"`
	Username           string    `json:"username"`
	FullName           string    `json:"full_name"`
	SubscriptionTier   string    `json:"subscription_tier"`
	SubscriptionExpiry time.Time `json:"subscription_expiry"`
	IsActive           bool      `json:"is_active"`
	IsAdmin            bool      `json:"is_admin"`
	DataTransferredGB  float64   `json:"data_transferred_gb"`
	ConnectionCount    int       `json:"connection_count"`
	TwoFactorEnabled   bool      `json:"two_factor_enabled"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// VPNNode represents a VPN node
type VPNNode struct {
	ID                 string    `json:"id"`
	Name               string    `json:"name"`
	Hostname           string    `json:"hostname"`
	Country            string    `json:"country"`
	CountryCode        string    `json:"country_code"`
	City               string    `json:"city"`
	PublicIP           string    `json:"public_ip"`
	Latitude           float64   `json:"latitude"`
	Longitude          float64   `json:"longitude"`
	Status             string    `json:"status"`
	IsActive           bool      `json:"is_active"`
	LoadScore          float64   `json:"load_score"`
	Latency            int       `json:"latency"`
	CurrentConnections int       `json:"current_connections"`
	MaxConnections     int       `json:"max_connections"`
	SupportsWireGuard  bool      `json:"supports_wireguard"`
	SupportsOpenVPN    bool      `json:"supports_openvpn"`
	WireGuardPort      int       `json:"wireguard_port"`
	OpenVPNPort        int       `json:"openvpn_port"`
	LastHeartbeat      time.Time `json:"last_heartbeat"`
}

// Session represents a VPN session
type Session struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	NodeID        string    `json:"node_id"`
	Protocol      string    `json:"protocol"`
	ClientIP      string    `json:"client_ip"`
	TunnelIP      string    `json:"tunnel_ip"`
	Status        string    `json:"status"`
	ConnectedAt   time.Time `json:"connected_at"`
	BytesSent     int64     `json:"bytes_sent"`
	BytesReceived int64     `json:"bytes_received"`
	DataUsedGB    float64   `json:"data_used_gb"`
	Latency       int       `json:"latency"`
}

// CreateSessionRequest represents a session creation request
type CreateSessionRequest struct {
	NodeID   string `json:"node_id"`
	Protocol string `json:"protocol"` // wireguard or openvpn
}

// CreateSessionResponse represents a session creation response
type CreateSessionResponse struct {
	Session Session `json:"session"`
	Config  string  `json:"config"`
}

// GenerateConfigRequest represents a config generation request
type GenerateConfigRequest struct {
	NodeID   string `json:"node_id"`
	Protocol string `json:"protocol"`
}

// GenerateConfigResponse represents a config generation response
type GenerateConfigResponse struct {
	ConfigID      string `json:"config_id"`
	ConfigContent string `json:"config_content"`
	Protocol      string `json:"protocol"`
}

// WireGuardConfigResponse represents the response from registering a WireGuard peer
type WireGuardConfigResponse struct {
	ServerPublicKey string `json:"server_public_key"`
	ServerEndpoint  string `json:"server_endpoint"`
	ClientIP        string `json:"client_ip"`
	DNS             string `json:"dns"`
}

// ErrorResponse represents an error response from the API
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// NodeListResponse represents the response from listing nodes
type NodeListResponse struct {
	Nodes      []VPNNode `json:"nodes"`
	TotalCount int       `json:"total_count"`
}
