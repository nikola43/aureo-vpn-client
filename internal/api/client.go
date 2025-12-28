package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/nikola43/aureo-vpn-client/internal/models"
)

// Client represents the API client
type Client struct {
	baseURL     string
	httpClient  *http.Client
	accessToken string
}

// NewClient creates a new API client
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		accessToken: "",
	}
}

// SetAccessToken sets the access token for authenticated requests
func (c *Client) SetAccessToken(token string) {
	c.accessToken = token
}

// GetAccessToken returns the current access token
func (c *Client) GetAccessToken() string {
	return c.accessToken
}

// doRequest performs an HTTP request
func (c *Client) doRequest(method, path string, body interface{}, requiresAuth bool) ([]byte, error) {
	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequest(method, c.baseURL+path, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	if requiresAuth && c.accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.accessToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to perform request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		var errResp models.ErrorResponse
		if err := json.Unmarshal(respBody, &errResp); err == nil {
			if errResp.Message != "" {
				return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, errResp.Message)
			}
			if errResp.Error != "" {
				return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, errResp.Error)
			}
		}
		return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// ============================================
// HEALTH & STATUS
// ============================================

// Health checks the API health
func (c *Client) Health() (*models.HealthResponse, error) {
	respBody, err := c.doRequest("GET", "/health", nil, false)
	if err != nil {
		return nil, err
	}

	var health models.HealthResponse
	if err := json.Unmarshal(respBody, &health); err != nil {
		return nil, fmt.Errorf("failed to parse health response: %w", err)
	}

	return &health, nil
}

// ============================================
// AUTH ENDPOINTS
// ============================================

// Login authenticates a user
func (c *Client) Login(email, password string) (*models.LoginResponse, error) {
	reqBody := models.LoginRequest{
		Email:    email,
		Password: password,
	}

	respBody, err := c.doRequest("POST", "/api/v1/auth/login", reqBody, false)
	if err != nil {
		return nil, err
	}

	var loginResp models.LoginResponse
	if err := json.Unmarshal(respBody, &loginResp); err != nil {
		return nil, fmt.Errorf("failed to parse login response: %w", err)
	}

	// Store the access token
	c.SetAccessToken(loginResp.AccessToken)

	return &loginResp, nil
}

// Register creates a new user account
func (c *Client) Register(email, password, username string) (*models.LoginResponse, error) {
	reqBody := models.RegisterRequest{
		Email:    email,
		Password: password,
		Username: username,
	}

	respBody, err := c.doRequest("POST", "/api/v1/auth/register", reqBody, false)
	if err != nil {
		return nil, err
	}

	var loginResp models.LoginResponse
	if err := json.Unmarshal(respBody, &loginResp); err != nil {
		return nil, fmt.Errorf("failed to parse register response: %w", err)
	}

	// Store the access token
	c.SetAccessToken(loginResp.AccessToken)

	return &loginResp, nil
}

// RefreshToken refreshes the access token
func (c *Client) RefreshToken(refreshToken string) (string, error) {
	reqBody := models.RefreshTokenRequest{
		RefreshToken: refreshToken,
	}

	respBody, err := c.doRequest("POST", "/api/v1/auth/refresh", reqBody, false)
	if err != nil {
		return "", err
	}

	var tokenResp models.RefreshTokenResponse
	if err := json.Unmarshal(respBody, &tokenResp); err != nil {
		return "", fmt.Errorf("failed to parse refresh response: %w", err)
	}

	c.SetAccessToken(tokenResp.AccessToken)

	return tokenResp.AccessToken, nil
}

// ============================================
// USER ENDPOINTS
// ============================================

// GetUserProfile retrieves the current user's profile
func (c *Client) GetUserProfile() (*models.User, error) {
	respBody, err := c.doRequest("GET", "/api/v1/user/profile", nil, true)
	if err != nil {
		return nil, err
	}

	var user models.User
	if err := json.Unmarshal(respBody, &user); err != nil {
		return nil, fmt.Errorf("failed to parse user profile response: %w", err)
	}

	return &user, nil
}

// UpdateUserProfile updates the current user's profile
func (c *Client) UpdateUserProfile(req models.UpdateProfileRequest) (*models.UpdateProfileResponse, error) {
	respBody, err := c.doRequest("PUT", "/api/v1/user/profile", req, true)
	if err != nil {
		return nil, err
	}

	var updateResp models.UpdateProfileResponse
	if err := json.Unmarshal(respBody, &updateResp); err != nil {
		return nil, fmt.Errorf("failed to parse update profile response: %w", err)
	}

	return &updateResp, nil
}

// UpdatePassword updates the current user's password
func (c *Client) UpdatePassword(oldPassword, newPassword string) error {
	reqBody := models.UpdatePasswordRequest{
		OldPassword: oldPassword,
		NewPassword: newPassword,
	}

	_, err := c.doRequest("PUT", "/api/v1/user/password", reqBody, true)
	return err
}

// GetUserStats retrieves user statistics
func (c *Client) GetUserStats() (map[string]interface{}, error) {
	respBody, err := c.doRequest("GET", "/api/v1/user/stats", nil, true)
	if err != nil {
		return nil, err
	}

	var stats map[string]interface{}
	if err := json.Unmarshal(respBody, &stats); err != nil {
		return nil, fmt.Errorf("failed to parse user stats response: %w", err)
	}

	return stats, nil
}

// GetUserSessions retrieves all active sessions for the current user
func (c *Client) GetUserSessions() ([]models.Session, error) {
	respBody, err := c.doRequest("GET", "/api/v1/user/sessions", nil, true)
	if err != nil {
		return nil, err
	}

	var sessionsResp models.SessionListResponse
	if err := json.Unmarshal(respBody, &sessionsResp); err != nil {
		// Try parsing as array directly
		var sessions []models.Session
		if err := json.Unmarshal(respBody, &sessions); err != nil {
			return nil, fmt.Errorf("failed to parse sessions response: %w", err)
		}
		return sessions, nil
	}

	return sessionsResp.Sessions, nil
}

// ============================================
// NODE ENDPOINTS
// ============================================

// GetNodes retrieves the list of available VPN nodes
func (c *Client) GetNodes(country, protocol string) ([]models.VPNNode, error) {
	path := "/api/v1/nodes"
	params := url.Values{}
	if country != "" {
		params.Add("country", country)
	}
	if protocol != "" {
		params.Add("protocol", protocol)
	}
	if len(params) > 0 {
		path += "?" + params.Encode()
	}

	respBody, err := c.doRequest("GET", path, nil, true)
	if err != nil {
		return nil, err
	}

	var nodeListResp models.NodeListResponse
	if err := json.Unmarshal(respBody, &nodeListResp); err != nil {
		return nil, fmt.Errorf("failed to parse nodes response: %w", err)
	}

	return nodeListResp.Nodes, nil
}

// GetBestNode retrieves the best available node
func (c *Client) GetBestNode() (*models.VPNNode, error) {
	respBody, err := c.doRequest("GET", "/api/v1/nodes/best", nil, true)
	if err != nil {
		return nil, err
	}

	var node models.VPNNode
	if err := json.Unmarshal(respBody, &node); err != nil {
		return nil, fmt.Errorf("failed to parse best node response: %w", err)
	}

	return &node, nil
}

// GetNode retrieves a specific node by ID
func (c *Client) GetNode(nodeID string) (*models.VPNNode, error) {
	respBody, err := c.doRequest("GET", "/api/v1/nodes/"+nodeID, nil, true)
	if err != nil {
		return nil, err
	}

	var node models.VPNNode
	if err := json.Unmarshal(respBody, &node); err != nil {
		return nil, fmt.Errorf("failed to parse node response: %w", err)
	}

	return &node, nil
}

// ============================================
// SESSION ENDPOINTS
// ============================================

// CreateSession creates a new VPN session
func (c *Client) CreateSession(nodeID, protocol string) (*models.CreateSessionResponse, error) {
	reqBody := models.CreateSessionRequest{
		NodeID:   nodeID,
		Protocol: protocol,
	}

	respBody, err := c.doRequest("POST", "/api/v1/sessions", reqBody, true)
	if err != nil {
		return nil, err
	}

	var sessionResp models.CreateSessionResponse
	if err := json.Unmarshal(respBody, &sessionResp); err != nil {
		return nil, fmt.Errorf("failed to parse session response: %w", err)
	}

	return &sessionResp, nil
}

// GetSession retrieves a session by ID
func (c *Client) GetSession(sessionID string) (*models.Session, error) {
	respBody, err := c.doRequest("GET", "/api/v1/sessions/"+sessionID, nil, true)
	if err != nil {
		return nil, err
	}

	var session models.Session
	if err := json.Unmarshal(respBody, &session); err != nil {
		return nil, fmt.Errorf("failed to parse session response: %w", err)
	}

	return &session, nil
}

// DisconnectSession disconnects a VPN session
func (c *Client) DisconnectSession(sessionID string) error {
	_, err := c.doRequest("DELETE", "/api/v1/sessions/"+sessionID, nil, true)
	return err
}

// ============================================
// CONFIG ENDPOINTS
// ============================================

// GenerateConfig generates a VPN configuration
func (c *Client) GenerateConfig(nodeID, protocol string) (*models.GenerateConfigResponse, error) {
	reqBody := models.GenerateConfigRequest{
		NodeID:   nodeID,
		Protocol: protocol,
	}

	respBody, err := c.doRequest("POST", "/api/v1/config/generate", reqBody, true)
	if err != nil {
		return nil, err
	}

	var configResp models.GenerateConfigResponse
	if err := json.Unmarshal(respBody, &configResp); err != nil {
		return nil, fmt.Errorf("failed to parse config response: %w", err)
	}

	return &configResp, nil
}

// RegisterWireGuardPeer registers a WireGuard peer with the VPN server
func (c *Client) RegisterWireGuardPeer(nodeID, publicKey string) (*models.WireGuardConfigResponse, error) {
	reqBody := map[string]string{
		"node_id":    nodeID,
		"public_key": publicKey,
	}

	respBody, err := c.doRequest("POST", "/api/v1/config/generate", reqBody, true)
	if err != nil {
		return nil, err
	}

	var configResp models.WireGuardConfigResponse
	if err := json.Unmarshal(respBody, &configResp); err != nil {
		return nil, fmt.Errorf("failed to parse wireguard config response: %w", err)
	}

	return &configResp, nil
}

// ============================================
// OPERATOR ENDPOINTS
// ============================================

// RegisterOperator registers the user as a node operator
func (c *Client) RegisterOperator(req models.RegisterOperatorRequest) (*models.RegisterOperatorResponse, error) {
	respBody, err := c.doRequest("POST", "/api/v1/operator/register", req, true)
	if err != nil {
		return nil, err
	}

	var opResp models.RegisterOperatorResponse
	if err := json.Unmarshal(respBody, &opResp); err != nil {
		return nil, fmt.Errorf("failed to parse operator registration response: %w", err)
	}

	return &opResp, nil
}

// CreateOperatorNode creates a new node for the operator
func (c *Client) CreateOperatorNode(req models.CreateNodeRequest) (*models.CreateNodeResponse, error) {
	respBody, err := c.doRequest("POST", "/api/v1/operator/nodes", req, true)
	if err != nil {
		return nil, err
	}

	var nodeResp models.CreateNodeResponse
	if err := json.Unmarshal(respBody, &nodeResp); err != nil {
		return nil, fmt.Errorf("failed to parse node creation response: %w", err)
	}

	return &nodeResp, nil
}

// GetOperatorNodes retrieves operator's nodes
func (c *Client) GetOperatorNodes() ([]models.VPNNode, error) {
	respBody, err := c.doRequest("GET", "/api/v1/operator/nodes", nil, true)
	if err != nil {
		return nil, err
	}

	var nodeListResp models.NodeListResponse
	if err := json.Unmarshal(respBody, &nodeListResp); err != nil {
		return nil, fmt.Errorf("failed to parse operator nodes response: %w", err)
	}

	return nodeListResp.Nodes, nil
}

// GetOperatorStats retrieves operator statistics
func (c *Client) GetOperatorStats() (*models.OperatorStats, error) {
	respBody, err := c.doRequest("GET", "/api/v1/operator/stats", nil, true)
	if err != nil {
		return nil, err
	}

	var stats models.OperatorStats
	if err := json.Unmarshal(respBody, &stats); err != nil {
		return nil, fmt.Errorf("failed to parse operator stats response: %w", err)
	}

	return &stats, nil
}

// GetOperatorEarnings retrieves operator earnings history
func (c *Client) GetOperatorEarnings(limit, offset int) (*models.EarningsListResponse, error) {
	path := fmt.Sprintf("/api/v1/operator/earnings?limit=%d&offset=%d", limit, offset)

	respBody, err := c.doRequest("GET", path, nil, true)
	if err != nil {
		return nil, err
	}

	var earningsResp models.EarningsListResponse
	if err := json.Unmarshal(respBody, &earningsResp); err != nil {
		return nil, fmt.Errorf("failed to parse earnings response: %w", err)
	}

	return &earningsResp, nil
}

// GetOperatorPayouts retrieves operator payout history
func (c *Client) GetOperatorPayouts(limit, offset int) (*models.PayoutsListResponse, error) {
	path := fmt.Sprintf("/api/v1/operator/payouts?limit=%d&offset=%d", limit, offset)

	respBody, err := c.doRequest("GET", path, nil, true)
	if err != nil {
		return nil, err
	}

	var payoutsResp models.PayoutsListResponse
	if err := json.Unmarshal(respBody, &payoutsResp); err != nil {
		return nil, fmt.Errorf("failed to parse payouts response: %w", err)
	}

	return &payoutsResp, nil
}

// RequestPayout requests a manual payout
func (c *Client) RequestPayout() error {
	_, err := c.doRequest("POST", "/api/v1/operator/payout/request", nil, true)
	return err
}

// GetOperatorDashboard retrieves the full operator dashboard
func (c *Client) GetOperatorDashboard() (*models.OperatorDashboard, error) {
	respBody, err := c.doRequest("GET", "/api/v1/operator/dashboard", nil, true)
	if err != nil {
		return nil, err
	}

	var dashboard models.OperatorDashboard
	if err := json.Unmarshal(respBody, &dashboard); err != nil {
		return nil, fmt.Errorf("failed to parse operator dashboard response: %w", err)
	}

	return &dashboard, nil
}

// GetRewardTiers retrieves all reward tiers
func (c *Client) GetRewardTiers() (*models.RewardTiersResponse, error) {
	respBody, err := c.doRequest("GET", "/api/v1/operator/rewards/tiers", nil, false)
	if err != nil {
		return nil, err
	}

	var tiersResp models.RewardTiersResponse
	if err := json.Unmarshal(respBody, &tiersResp); err != nil {
		return nil, fmt.Errorf("failed to parse reward tiers response: %w", err)
	}

	return &tiersResp, nil
}

// ============================================
// ADMIN ENDPOINTS
// ============================================

// GetAdminStats retrieves system-wide statistics (admin only)
func (c *Client) GetAdminStats() (*models.AdminStats, error) {
	respBody, err := c.doRequest("GET", "/api/v1/admin/stats", nil, true)
	if err != nil {
		return nil, err
	}

	var stats models.AdminStats
	if err := json.Unmarshal(respBody, &stats); err != nil {
		return nil, fmt.Errorf("failed to parse admin stats response: %w", err)
	}

	return &stats, nil
}

// GetAllNodes retrieves all nodes (admin only)
func (c *Client) GetAllNodes() ([]models.VPNNode, error) {
	respBody, err := c.doRequest("GET", "/api/v1/admin/nodes", nil, true)
	if err != nil {
		return nil, err
	}

	var nodeListResp models.NodeListResponse
	if err := json.Unmarshal(respBody, &nodeListResp); err != nil {
		return nil, fmt.Errorf("failed to parse admin nodes response: %w", err)
	}

	return nodeListResp.Nodes, nil
}

// GetAllUsers retrieves all users (admin only)
func (c *Client) GetAllUsers() ([]models.User, error) {
	respBody, err := c.doRequest("GET", "/api/v1/admin/users", nil, true)
	if err != nil {
		return nil, err
	}

	var usersResp struct {
		Users []models.User `json:"users"`
	}
	if err := json.Unmarshal(respBody, &usersResp); err != nil {
		return nil, fmt.Errorf("failed to parse admin users response: %w", err)
	}

	return usersResp.Users, nil
}

// VerifyOperator verifies an operator (admin only)
func (c *Client) VerifyOperator(operatorID string) error {
	_, err := c.doRequest("PUT", "/api/v1/admin/operators/"+operatorID+"/verify", nil, true)
	return err
}
