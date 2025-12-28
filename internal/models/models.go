package models

import "time"

// ============================================
// AUTH MODELS
// ============================================

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

// RegisterRequest represents registration data
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Username string `json:"username"`
	FullName string `json:"full_name,omitempty"`
}

// RefreshTokenRequest represents token refresh request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// RefreshTokenResponse represents token refresh response
type RefreshTokenResponse struct {
	AccessToken string `json:"access_token"`
}

// ============================================
// USER MODELS
// ============================================

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

// UpdateProfileRequest represents profile update data
type UpdateProfileRequest struct {
	Username string `json:"username,omitempty"`
	Email    string `json:"email,omitempty"`
	FullName string `json:"full_name,omitempty"`
}

// UpdateProfileResponse represents profile update response
type UpdateProfileResponse struct {
	Message string `json:"message"`
	User    User   `json:"user"`
}

// UpdatePasswordRequest represents password update data
type UpdatePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

// UserStatsResponse represents user statistics
type UserStatsResponse struct {
	TotalSessions     int     `json:"total_sessions"`
	ActiveSessions    int     `json:"active_sessions"`
	DataTransferredGB float64 `json:"data_transferred_gb"`
}

// ============================================
// VPN NODE MODELS
// ============================================

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
	IsOperatorOwned    bool      `json:"is_operator_owned"`
	UptimePercentage   float64   `json:"uptime_percentage"`
	LastHeartbeat      time.Time `json:"last_heartbeat"`
}

// NodeListResponse represents the response from listing nodes
type NodeListResponse struct {
	Nodes      []VPNNode `json:"nodes"`
	TotalCount int       `json:"total_count"`
	Count      int       `json:"count"`
	Source     string    `json:"source,omitempty"`
}

// ============================================
// SESSION MODELS
// ============================================

// Session represents a VPN session
type Session struct {
	ID                 string    `json:"id"`
	UserID             string    `json:"user_id"`
	NodeID             string    `json:"node_id"`
	Protocol           string    `json:"protocol"`
	ClientIP           string    `json:"client_ip"`
	TunnelIP           string    `json:"tunnel_ip"`
	Status             string    `json:"status"`
	ConnectedAt        time.Time `json:"connected_at"`
	DisconnectedAt     time.Time `json:"disconnected_at,omitempty"`
	BytesSent          int64     `json:"bytes_sent"`
	BytesReceived      int64     `json:"bytes_received"`
	DataUsedGB         float64   `json:"data_used_gb"`
	Latency            int       `json:"latency"`
	PacketLoss         float64   `json:"packet_loss"`
	SplitTunnelEnabled bool      `json:"split_tunnel_enabled"`
	KillSwitchEnabled  bool      `json:"kill_switch_enabled"`
	DNSLeakProtection  bool      `json:"dns_leak_protection"`
	IsMultiHop         bool      `json:"is_multi_hop"`
	ClientVersion      string    `json:"client_version"`
	DeviceType         string    `json:"device_type"`
	OSType             string    `json:"os_type"`
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

// SessionListResponse represents sessions list response
type SessionListResponse struct {
	Sessions []Session `json:"sessions"`
	Count    int       `json:"count"`
}

// ============================================
// CONFIG MODELS
// ============================================

// GenerateConfigRequest represents a config generation request
type GenerateConfigRequest struct {
	NodeID    string `json:"node_id"`
	Protocol  string `json:"protocol"`
	PublicKey string `json:"public_key,omitempty"`
}

// GenerateConfigResponse represents a config generation response
type GenerateConfigResponse struct {
	ConfigID      string `json:"config_id"`
	ConfigContent string `json:"config_content"`
	Protocol      string `json:"protocol"`
}

// WireGuardConfigResponse represents the response from registering a WireGuard peer
type WireGuardConfigResponse struct {
	SessionID       string `json:"session_id"`
	ServerPublicKey string `json:"server_public_key"`
	ServerEndpoint  string `json:"server_endpoint"`
	ClientIP        string `json:"client_ip"`
	DNS             string `json:"dns"`
	AllowedIPs      string `json:"allowed_ips"`
	Keepalive       int    `json:"keepalive"`
}

// ============================================
// OPERATOR MODELS
// ============================================

// Operator represents a node operator
type Operator struct {
	ID                       string    `json:"id"`
	UserID                   string    `json:"user_id"`
	WalletAddress            string    `json:"wallet_address"`
	WalletType               string    `json:"wallet_type"`
	Status                   string    `json:"status"`
	IsVerified               bool      `json:"is_verified"`
	VerifiedAt               time.Time `json:"verified_at,omitempty"`
	TotalEarned              float64   `json:"total_earned"`
	PendingPayout            float64   `json:"pending_payout"`
	LastPayoutAt             time.Time `json:"last_payout_at,omitempty"`
	TotalNodesCreated        int       `json:"total_nodes_created"`
	ActiveNodesCount         int       `json:"active_nodes_count"`
	TotalBandwidthKB         int64     `json:"total_bandwidth_kb"`
	TotalConnectionsServed   int64     `json:"total_connections_served"`
	AverageUptime            float64   `json:"average_uptime"`
	ReputationScore          float64   `json:"reputation_score"`
	StakeAmount              float64   `json:"stake_amount"`
	StakeStatus              string    `json:"stake_status"`
	StakedAt                 time.Time `json:"staked_at,omitempty"`
	KYCStatus                string    `json:"kyc_status"`
	KYCSubmittedAt           time.Time `json:"kyc_submitted_at,omitempty"`
	TaxID                    string    `json:"tax_id"`
	Email                    string    `json:"email"`
	PhoneNumber              string    `json:"phone_number"`
	Country                  string    `json:"country"`
	CreatedAt                time.Time `json:"created_at"`
	UpdatedAt                time.Time `json:"updated_at"`
}

// RegisterOperatorRequest represents operator registration data
type RegisterOperatorRequest struct {
	WalletAddress string `json:"wallet_address"`
	WalletType    string `json:"wallet_type"`
	Country       string `json:"country"`
	Email         string `json:"email"`
	PhoneNumber   string `json:"phone_number,omitempty"`
}

// RegisterOperatorResponse represents operator registration response
type RegisterOperatorResponse struct {
	Operator Operator `json:"operator"`
	Message  string   `json:"message"`
}

// CreateNodeRequest represents operator node creation request
type CreateNodeRequest struct {
	Name          string  `json:"name"`
	Hostname      string  `json:"hostname"`
	PublicIP      string  `json:"public_ip"`
	InternalIP    string  `json:"internal_ip,omitempty"`
	Country       string  `json:"country"`
	CountryCode   string  `json:"country_code"`
	City          string  `json:"city"`
	WireGuardPort int     `json:"wireguard_port"`
	OpenVPNPort   int     `json:"openvpn_port,omitempty"`
	Latitude      float64 `json:"latitude,omitempty"`
	Longitude     float64 `json:"longitude,omitempty"`
}

// CreateNodeResponse represents node creation response
type CreateNodeResponse struct {
	Node      VPNNode `json:"node"`
	PublicKey string  `json:"public_key"`
	Message   string  `json:"message"`
}

// OperatorEarning represents an earning record
type OperatorEarning struct {
	ID                string    `json:"id"`
	OperatorID        string    `json:"operator_id"`
	NodeID            string    `json:"node_id"`
	SessionID         string    `json:"session_id"`
	BandwidthKB       int64     `json:"bandwidth_kb"`
	DurationMinutes   int       `json:"duration_minutes"`
	RatePerGB         float64   `json:"rate_per_gb"`
	AmountUSD         float64   `json:"amount_usd"`
	Status            string    `json:"status"`
	PaidAt            time.Time `json:"paid_at,omitempty"`
	ConnectionQuality int       `json:"connection_quality"`
	UserRating        int       `json:"user_rating,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}

// EarningsListResponse represents earnings list response
type EarningsListResponse struct {
	Earnings []OperatorEarning `json:"earnings"`
	Total    int               `json:"total"`
	Limit    int               `json:"limit"`
	Offset   int               `json:"offset"`
}

// OperatorPayout represents a payout record
type OperatorPayout struct {
	ID              string    `json:"id"`
	OperatorID      string    `json:"operator_id"`
	AmountUSD       float64   `json:"amount_usd"`
	CryptoAmount    float64   `json:"crypto_amount"`
	CryptoCurrency  string    `json:"crypto_currency"`
	ExchangeRate    float64   `json:"exchange_rate"`
	WalletAddress   string    `json:"wallet_address"`
	TransactionHash string    `json:"transaction_hash"`
	TransactionFee  float64   `json:"transaction_fee"`
	Status          string    `json:"status"`
	ProcessedAt     time.Time `json:"processed_at,omitempty"`
	CompletedAt     time.Time `json:"completed_at,omitempty"`
	PayoutMethod    string    `json:"payout_method"`
	CreatedAt       time.Time `json:"created_at"`
}

// PayoutsListResponse represents payouts list response
type PayoutsListResponse struct {
	Payouts []OperatorPayout `json:"payouts"`
	Total   int              `json:"total"`
	Limit   int              `json:"limit"`
	Offset  int              `json:"offset"`
}

// OperatorStats represents operator statistics
type OperatorStats struct {
	TotalEarnings           float64 `json:"total_earnings"`
	PendingPayout           float64 `json:"pending_payout"`
	TotalNodes              int     `json:"total_nodes"`
	ActiveNodes             int     `json:"active_nodes"`
	TotalBandwidthGB        float64 `json:"total_bandwidth_gb"`
	TotalConnections        int64   `json:"total_connections"`
	AverageUptime           float64 `json:"average_uptime"`
	ReputationScore         float64 `json:"reputation_score"`
	CurrentTier             string  `json:"current_tier"`
	NextTierProgress        float64 `json:"next_tier_progress"`
	TodayEarnings           float64 `json:"today_earnings"`
	WeekEarnings            float64 `json:"week_earnings"`
	MonthEarnings           float64 `json:"month_earnings"`
	ActiveConnectionsNow    int     `json:"active_connections_now"`
	BandwidthUsageToday     float64 `json:"bandwidth_usage_today"`
	AverageSessionDuration  float64 `json:"average_session_duration"`
	AverageConnectionRating float64 `json:"average_connection_rating"`
}

// OperatorDashboard represents full operator dashboard data
type OperatorDashboard struct {
	Operator       Operator          `json:"operator"`
	Stats          OperatorStats     `json:"stats"`
	ActiveNodes    []VPNNode         `json:"active_nodes"`
	RecentEarnings []OperatorEarning `json:"recent_earnings"`
	RecentPayouts  []OperatorPayout  `json:"recent_payouts"`
}

// RewardTier represents a reward tier
type RewardTier struct {
	TierName           string  `json:"tier_name"`
	MinReputationScore float64 `json:"min_reputation_score"`
	MinUptimePercent   float64 `json:"min_uptime_percent"`
	BaseRatePerGB      float64 `json:"base_rate_per_gb"`
	BonusMultiplier    float64 `json:"bonus_multiplier"`
	MinBandwidth       int     `json:"min_bandwidth"`
	MaxLatency         int     `json:"max_latency"`
}

// RewardTiersResponse represents reward tiers list response
type RewardTiersResponse struct {
	Tiers []RewardTier `json:"tiers"`
	Count int          `json:"count"`
}

// ============================================
// ADMIN MODELS
// ============================================

// AdminStats represents system-wide statistics
type AdminStats struct {
	TotalUsers     int `json:"total_users"`
	ActiveUsers    int `json:"active_users"`
	TotalNodes     int `json:"total_nodes"`
	OnlineNodes    int `json:"online_nodes"`
	TotalSessions  int `json:"total_sessions"`
	ActiveSessions int `json:"active_sessions"`
}

// ============================================
// ERROR MODELS
// ============================================

// ErrorResponse represents an error response from the API
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// ============================================
// HEALTH MODELS
// ============================================

// HealthResponse represents health check response
type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Version  string `json:"version,omitempty"`
}
