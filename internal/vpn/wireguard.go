package vpn

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// WireGuardManager manages WireGuard VPN connections
type WireGuardManager struct {
	configDir string
}

// NewWireGuardManager creates a new WireGuard manager
func NewWireGuardManager() (*WireGuardManager, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	configDir := filepath.Join(homeDir, ".aureo-vpn")
	if err := os.MkdirAll(configDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	return &WireGuardManager{
		configDir: configDir,
	}, nil
}

// GenerateKeys generates a WireGuard key pair
func (m *WireGuardManager) GenerateKeys() (privateKey, publicKey string, err error) {
	// Generate private key
	cmd := exec.Command("wg", "genkey")
	privateKeyBytes, err := cmd.Output()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate private key: %w", err)
	}
	privateKey = strings.TrimSpace(string(privateKeyBytes))

	// Generate public key from private key
	cmd = exec.Command("wg", "pubkey")
	cmd.Stdin = strings.NewReader(privateKey)
	publicKeyBytes, err := cmd.Output()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate public key: %w", err)
	}
	publicKey = strings.TrimSpace(string(publicKeyBytes))

	return privateKey, publicKey, nil
}

// WriteConfig writes a WireGuard configuration file
func (m *WireGuardManager) WriteConfig(privateKey, clientIP, serverPublicKey, serverEndpoint, dns string) error {
	configPath := filepath.Join(m.configDir, "wg0.conf")

	// Build config without leading spaces/tabs
	config := "[Interface]\n"
	config += "PrivateKey = " + privateKey + "\n"
	config += "Address = " + clientIP + "/32\n"
	config += "DNS = " + dns + "\n"
	config += "\n"
	config += "[Peer]\n"
	config += "PublicKey = " + serverPublicKey + "\n"
	config += "Endpoint = " + serverEndpoint + "\n"
	config += "AllowedIPs = 0.0.0.0/0\n"
	config += "PersistentKeepalive = 25\n"

	if err := os.WriteFile(configPath, []byte(config), 0600); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// Connect starts the WireGuard VPN connection
func (m *WireGuardManager) Connect() error {
	configPath := filepath.Join(m.configDir, "wg0.conf")

	// Check if WireGuard is installed
	if _, err := exec.LookPath("wg-quick"); err != nil {
		return fmt.Errorf("WireGuard not installed. Install with: brew install wireguard-tools")
	}

	// Run wg-quick up
	cmd := exec.Command("sudo", "wg-quick", "up", configPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to start VPN: %w\nOutput: %s", err, string(output))
	}

	return nil
}

// Disconnect stops the WireGuard VPN connection
func (m *WireGuardManager) Disconnect() error {
	configPath := filepath.Join(m.configDir, "wg0.conf")

	// Run wg-quick down
	cmd := exec.Command("sudo", "wg-quick", "down", configPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Don't return error if already disconnected
		if strings.Contains(string(output), "is not a WireGuard interface") {
			return nil
		}
		return fmt.Errorf("failed to stop VPN: %w\nOutput: %s", err, string(output))
	}

	// Clean up config file
	os.Remove(configPath)

	return nil
}

// IsConnected checks if the VPN is currently connected
func (m *WireGuardManager) IsConnected() bool {
	// Check if config file exists first - if not, we're definitely not connected
	configPath := filepath.Join(m.configDir, "wg0.conf")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return false
	}

	// Try wg without sudo first (some systems allow it)
	cmd := exec.Command("wg", "show")
	output, err := cmd.Output()

	// If it fails, try with sudo but don't prompt (use cached credentials)
	if err != nil || len(output) == 0 {
		cmd = exec.Command("sudo", "-n", "wg", "show")
		output, err = cmd.Output()
		if err != nil {
			// If sudo -n fails (no cached credentials), assume not connected
			// rather than prompting for password
			return false
		}
	}

	// Check if there's any WireGuard interface active
	return len(output) > 0 && strings.Contains(string(output), "interface:")
}

// GetStats returns connection statistics
func (m *WireGuardManager) GetStats() (map[string]interface{}, error) {
	cmd := exec.Command("sudo", "wg", "show")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get stats: %w", err)
	}

	stats := make(map[string]interface{})
	stats["connected"] = len(output) > 0

	if len(output) > 0 {
		// Parse the output to extract transfer statistics
		outputStr := string(output)
		lines := strings.Split(outputStr, "\n")

		var bytesSent int64 = 0
		var bytesReceived int64 = 0
		var latestHandshake string

		for _, line := range lines {
			line = strings.TrimSpace(line)

			// Look for transfer line: "transfer: 1.23 KiB received, 2.34 KiB sent"
			if strings.HasPrefix(line, "transfer:") {
				parts := strings.Split(line, "transfer:")
				if len(parts) > 1 {
					transferData := strings.TrimSpace(parts[1])
					// Parse "X received, Y sent"
					transferParts := strings.Split(transferData, ",")

					for _, part := range transferParts {
						part = strings.TrimSpace(part)
						if strings.Contains(part, "received") {
							bytesReceived = parseTransferSize(part)
						} else if strings.Contains(part, "sent") {
							bytesSent = parseTransferSize(part)
						}
					}
				}
			}

			// Look for latest handshake
			if strings.HasPrefix(line, "latest handshake:") {
				parts := strings.Split(line, "latest handshake:")
				if len(parts) > 1 {
					latestHandshake = strings.TrimSpace(parts[1])
				}
			}
		}

		stats["bytes_sent"] = bytesSent
		stats["bytes_received"] = bytesReceived
		stats["latest_handshake"] = latestHandshake
	}

	return stats, nil
}

// parseTransferSize parses WireGuard transfer sizes like "1.23 KiB", "2.34 MiB", "567 B"
func parseTransferSize(sizeStr string) int64 {
	// Remove "received" or "sent" suffix
	sizeStr = strings.TrimSpace(sizeStr)
	sizeStr = strings.Replace(sizeStr, "received", "", 1)
	sizeStr = strings.Replace(sizeStr, "sent", "", 1)
	sizeStr = strings.TrimSpace(sizeStr)

	// Split number and unit
	parts := strings.Fields(sizeStr)
	if len(parts) < 2 {
		return 0
	}

	value := 0.0
	fmt.Sscanf(parts[0], "%f", &value)
	unit := parts[1]

	// Convert to bytes
	switch unit {
	case "B":
		return int64(value)
	case "KiB":
		return int64(value * 1024)
	case "MiB":
		return int64(value * 1024 * 1024)
	case "GiB":
		return int64(value * 1024 * 1024 * 1024)
	case "TiB":
		return int64(value * 1024 * 1024 * 1024 * 1024)
	default:
		return 0
	}
}
