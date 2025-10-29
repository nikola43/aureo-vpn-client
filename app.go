package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/nikola43/aureo-vpn-client/internal/api"
	"github.com/nikola43/aureo-vpn-client/internal/models"
	"github.com/nikola43/aureo-vpn-client/internal/vpn"
)

// App struct
type App struct {
	ctx        context.Context
	apiClient  *api.Client
	vpnManager *vpn.WireGuardManager
	user       *models.User
	session    *models.Session
	nodeID     string
	nodeName   string
	configDir  string
}

// SessionData stores user session information
type SessionData struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	User         models.User  `json:"user"`
	APIURL       string       `json:"api_url"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Set config directory
	homeDir, err := os.UserHomeDir()
	if err == nil {
		a.configDir = filepath.Join(homeDir, ".aureo-vpn")
		os.MkdirAll(a.configDir, 0700)
	}

	// Initialize with default API URL - can be changed via SetAPIURL
	a.apiClient = api.NewClient("http://localhost:8080")

	// Initialize VPN manager
	vpnMgr, err := vpn.NewWireGuardManager()
	if err != nil {
		fmt.Printf("Warning: Failed to initialize VPN manager: %v\n", err)
	}
	a.vpnManager = vpnMgr
}

// currentAPIURL stores the current API URL for session saving
var currentAPIURL string = "http://155.138.238.145:8080"

// SetAPIURL sets the base API URL
func (a *App) SetAPIURL(url string) {
	currentAPIURL = url

	// Preserve access token if setting URL after login
	oldToken := ""
	if a.apiClient != nil {
		oldToken = a.apiClient.GetAccessToken()
	}

	a.apiClient = api.NewClient(url)

	// Restore token if it existed
	if oldToken != "" {
		a.apiClient.SetAccessToken(oldToken)
	}
}

// GetAPIURL returns the current API URL
func (a *App) GetAPIURL() string {
	return "API URL configured"
}

// saveSession saves the session data to file
func (a *App) saveSession(accessToken, refreshToken, apiURL string, user models.User) error {
	if a.configDir == "" {
		return fmt.Errorf("config directory not set")
	}

	sessionData := SessionData{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
		APIURL:       apiURL,
	}

	data, err := json.Marshal(sessionData)
	if err != nil {
		return fmt.Errorf("failed to marshal session data: %w", err)
	}

	sessionFile := filepath.Join(a.configDir, "session.json")
	if err := os.WriteFile(sessionFile, data, 0600); err != nil {
		return fmt.Errorf("failed to write session file: %w", err)
	}

	return nil
}

// loadSession loads the session data from file
func (a *App) loadSession() (*SessionData, error) {
	if a.configDir == "" {
		return nil, fmt.Errorf("config directory not set")
	}

	sessionFile := filepath.Join(a.configDir, "session.json")
	data, err := os.ReadFile(sessionFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // No session file exists
		}
		return nil, fmt.Errorf("failed to read session file: %w", err)
	}

	var sessionData SessionData
	if err := json.Unmarshal(data, &sessionData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal session data: %w", err)
	}

	return &sessionData, nil
}

// deleteSession deletes the session file
func (a *App) deleteSession() error {
	if a.configDir == "" {
		return nil
	}

	sessionFile := filepath.Join(a.configDir, "session.json")
	if err := os.Remove(sessionFile); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete session file: %w", err)
	}

	return nil
}

// CheckSavedSession checks if there's a saved session and returns it
func (a *App) CheckSavedSession() (map[string]interface{}, error) {
	sessionData, err := a.loadSession()
	if err != nil {
		return nil, err
	}

	if sessionData == nil {
		return map[string]interface{}{
			"has_session": false,
		}, nil
	}

	// Set API URL
	a.apiClient = api.NewClient(sessionData.APIURL)
	a.apiClient.SetAccessToken(sessionData.AccessToken)

	// Verify token is still valid by making a test request
	user, err := a.apiClient.GetUserProfile()
	if err != nil {
		// Token expired or invalid, delete session
		a.deleteSession()
		return map[string]interface{}{
			"has_session": false,
		}, nil
	}

	// Token is valid, restore session
	a.user = user

	return map[string]interface{}{
		"has_session":   true,
		"user":          user,
		"access_token":  sessionData.AccessToken,
		"refresh_token": sessionData.RefreshToken,
		"api_url":       sessionData.APIURL,
	}, nil
}

// Login authenticates the user
func (a *App) Login(email, password string) (map[string]interface{}, error) {
	loginResp, err := a.apiClient.Login(email, password)
	if err != nil {
		return nil, err
	}

	a.user = &loginResp.User

	// Save session to file
	if err := a.saveSession(loginResp.AccessToken, loginResp.RefreshToken, currentAPIURL, loginResp.User); err != nil {
		fmt.Printf("Warning: Failed to save session: %v\n", err)
	}

	return map[string]interface{}{
		"success":      true,
		"user":         loginResp.User,
		"accessToken":  loginResp.AccessToken,
		"refreshToken": loginResp.RefreshToken,
	}, nil
}

// Register creates a new user account
func (a *App) Register(email, password, username string) (map[string]interface{}, error) {
	loginResp, err := a.apiClient.Register(email, password, username)
	if err != nil {
		return nil, err
	}

	a.user = &loginResp.User

	// Save session to file
	if err := a.saveSession(loginResp.AccessToken, loginResp.RefreshToken, currentAPIURL, loginResp.User); err != nil {
		fmt.Printf("Warning: Failed to save session: %v\n", err)
	}

	return map[string]interface{}{
		"success":      true,
		"user":         loginResp.User,
		"accessToken":  loginResp.AccessToken,
		"refreshToken": loginResp.RefreshToken,
	}, nil
}

// Logout clears the current user session
func (a *App) Logout() error {
	a.user = nil
	a.session = nil
	a.apiClient.SetAccessToken("")

	// Delete saved session
	if err := a.deleteSession(); err != nil {
		fmt.Printf("Warning: Failed to delete session: %v\n", err)
	}

	return nil
}

// GetCurrentUser returns the current logged-in user
func (a *App) GetCurrentUser() (*models.User, error) {
	if a.user == nil {
		return nil, fmt.Errorf("no user logged in")
	}
	return a.user, nil
}

// GetNodes retrieves the list of available VPN nodes
func (a *App) GetNodes(country, protocol string) ([]models.VPNNode, error) {
	nodes, err := a.apiClient.GetNodes(country, protocol)
	if err != nil {
		return nil, err
	}
	return nodes, nil
}

// GetBestNode retrieves the best available node
func (a *App) GetBestNode() (*models.VPNNode, error) {
	return a.apiClient.GetBestNode()
}

// GetNode retrieves a specific node by ID
func (a *App) GetNode(nodeID string) (*models.VPNNode, error) {
	return a.apiClient.GetNode(nodeID)
}

// ConnectToVPN creates a VPN session and returns the configuration
func (a *App) ConnectToVPN(nodeID, protocol string) (map[string]interface{}, error) {
	if a.user == nil {
		return nil, fmt.Errorf("no user logged in")
	}

	if a.vpnManager == nil {
		return nil, fmt.Errorf("VPN manager not initialized")
	}

	// Check if already connected
	if a.vpnManager.IsConnected() {
		return nil, fmt.Errorf("already connected to VPN. Disconnect first")
	}

	// For now, only support WireGuard
	if protocol != "wireguard" {
		return nil, fmt.Errorf("only WireGuard protocol is currently supported")
	}

	// Generate WireGuard keys
	privateKey, publicKey, err := a.vpnManager.GenerateKeys()
	if err != nil {
		return nil, fmt.Errorf("failed to generate keys: %w", err)
	}

	// Register with the VPN server
	configResp, err := a.apiClient.RegisterWireGuardPeer(nodeID, publicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to register with VPN server: %w", err)
	}

	// Write WireGuard configuration
	err = a.vpnManager.WriteConfig(
		privateKey,
		configResp.ClientIP,
		configResp.ServerPublicKey,
		configResp.ServerEndpoint,
		configResp.DNS,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to write VPN config: %w", err)
	}

	// Connect to VPN
	err = a.vpnManager.Connect()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to VPN: %w", err)
	}

	// Store connection info
	a.nodeID = nodeID
	// Get node info
	node, err := a.apiClient.GetNode(nodeID)
	if err == nil {
		a.nodeName = node.Name
	}

	return map[string]interface{}{
		"success":   true,
		"client_ip": configResp.ClientIP,
		"node_id":   nodeID,
		"connected": true,
	}, nil
}

// DisconnectVPN disconnects the current VPN session
func (a *App) DisconnectVPN() error {
	if a.vpnManager == nil {
		return fmt.Errorf("VPN manager not initialized")
	}

	// Check if connected - if not, just clear state and return success
	if !a.vpnManager.IsConnected() {
		// Clear connection info even if not connected (cleanup state)
		a.nodeID = ""
		a.nodeName = ""
		a.session = nil
		return nil
	}

	// Disconnect VPN
	err := a.vpnManager.Disconnect()
	if err != nil {
		return fmt.Errorf("failed to disconnect VPN: %w", err)
	}

	// Clear connection info
	a.nodeID = ""
	a.nodeName = ""
	a.session = nil

	return nil
}

// GetCurrentSession returns the current VPN session
func (a *App) GetCurrentSession() (*models.Session, error) {
	if a.session == nil {
		return nil, fmt.Errorf("no active VPN session")
	}

	// Refresh session data from server
	session, err := a.apiClient.GetSession(a.session.ID)
	if err != nil {
		return nil, err
	}

	a.session = session
	return session, nil
}

// GetAllSessions retrieves all user sessions
func (a *App) GetAllSessions() ([]models.Session, error) {
	return a.apiClient.GetUserSessions()
}

// GetUserProfile retrieves the user profile
func (a *App) GetUserProfile() (*models.User, error) {
	user, err := a.apiClient.GetUserProfile()
	if err != nil {
		return nil, err
	}
	a.user = user
	return user, nil
}

// GetUserStats retrieves user statistics
func (a *App) GetUserStats() (map[string]interface{}, error) {
	return a.apiClient.GetUserStats()
}

// IsConnected returns whether there is an active VPN session
func (a *App) IsConnected() bool {
	if a.vpnManager == nil {
		return false
	}
	return a.vpnManager.IsConnected()
}

// GetVPNStats returns VPN connection statistics
func (a *App) GetVPNStats() (map[string]interface{}, error) {
	if a.vpnManager == nil {
		return nil, fmt.Errorf("VPN manager not initialized")
	}

	if !a.vpnManager.IsConnected() {
		return map[string]interface{}{
			"connected": false,
		}, nil
	}

	stats, err := a.vpnManager.GetStats()
	if err != nil {
		return nil, err
	}

	stats["node_id"] = a.nodeID
	stats["node_name"] = a.nodeName

	return stats, nil
}

// IsLoggedIn returns whether a user is logged in
func (a *App) IsLoggedIn() bool {
	return a.user != nil && a.apiClient.GetAccessToken() != ""
}

// GenerateConfig generates a VPN configuration without creating a session
func (a *App) GenerateConfig(nodeID, protocol string) (map[string]interface{}, error) {
	configResp, err := a.apiClient.GenerateConfig(nodeID, protocol)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"configID":      configResp.ConfigID,
		"configContent": configResp.ConfigContent,
		"protocol":      configResp.Protocol,
	}, nil
}
