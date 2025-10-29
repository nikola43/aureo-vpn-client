package main

import (
	"context"
	"fmt"

	"github.com/nikola43/aureo-vpn-client/internal/api"
	"github.com/nikola43/aureo-vpn-client/internal/models"
)

// App struct
type App struct {
	ctx       context.Context
	apiClient *api.Client
	user      *models.User
	session   *models.Session
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Initialize with default API URL - can be changed via SetAPIURL
	a.apiClient = api.NewClient("http://localhost:8080")
}

// SetAPIURL sets the base API URL
func (a *App) SetAPIURL(url string) {
	a.apiClient = api.NewClient(url)
	// Preserve access token if it exists
	if a.user != nil {
		// Token would need to be re-obtained or stored separately
	}
}

// GetAPIURL returns the current API URL
func (a *App) GetAPIURL() string {
	return "API URL configured"
}

// Login authenticates the user
func (a *App) Login(email, password string) (map[string]interface{}, error) {
	loginResp, err := a.apiClient.Login(email, password)
	if err != nil {
		return nil, err
	}

	a.user = &loginResp.User

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

	// Create session
	sessionResp, err := a.apiClient.CreateSession(nodeID, protocol)
	if err != nil {
		return nil, err
	}

	a.session = &sessionResp.Session

	return map[string]interface{}{
		"success": true,
		"session": sessionResp.Session,
		"config":  sessionResp.Config,
	}, nil
}

// DisconnectVPN disconnects the current VPN session
func (a *App) DisconnectVPN() error {
	if a.session == nil {
		return fmt.Errorf("no active VPN session")
	}

	err := a.apiClient.DisconnectSession(a.session.ID)
	if err != nil {
		return err
	}

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
	return a.session != nil && a.session.Status == "active"
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
