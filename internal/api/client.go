package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
			return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, errResp.Message)
		}
		return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

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
	reqBody := map[string]string{
		"email":    email,
		"password": password,
		"username": username,
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

// GetNodes retrieves the list of available VPN nodes
func (c *Client) GetNodes(country, protocol string) ([]models.VPNNode, error) {
	path := "/api/v1/nodes"
	if country != "" || protocol != "" {
		path += "?"
		if country != "" {
			path += "country=" + country
		}
		if protocol != "" {
			if country != "" {
				path += "&"
			}
			path += "protocol=" + protocol
		}
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

// GetUserSessions retrieves all active sessions for the current user
func (c *Client) GetUserSessions() ([]models.Session, error) {
	respBody, err := c.doRequest("GET", "/api/v1/user/sessions", nil, true)
	if err != nil {
		return nil, err
	}

	var sessions []models.Session
	if err := json.Unmarshal(respBody, &sessions); err != nil {
		return nil, fmt.Errorf("failed to parse sessions response: %w", err)
	}

	return sessions, nil
}

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
