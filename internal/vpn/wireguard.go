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

	// Create a temporary shell script for macOS
	scriptContent := fmt.Sprintf(`#!/bin/bash
# Try to bring down any existing WireGuard interface
wg-quick down "%s" 2>/dev/null || true

# Small delay to ensure interface is fully removed
sleep 0.5

# Bring up new interface
wg-quick up "%s"
`, configPath, configPath)

	scriptPath := filepath.Join(m.configDir, "connect.sh")
	if err := os.WriteFile(scriptPath, []byte(scriptContent), 0755); err != nil {
		return fmt.Errorf("failed to create connect script: %w", err)
	}
	defer os.Remove(scriptPath)

	// Run the script through osascript with admin privileges
	script := fmt.Sprintf(`do shell script "%s" with administrator privileges`, scriptPath)
	cmd := exec.Command("osascript", "-e", script)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to start VPN: %w\nOutput: %s", err, string(output))
	}

	return nil
}

// Disconnect stops the WireGuard VPN connection
func (m *WireGuardManager) Disconnect() error {
	configPath := filepath.Join(m.configDir, "wg0.conf")

	// Run wg-quick down through osascript to get admin privileges via GUI prompt
	escapedPath := strings.ReplaceAll(configPath, `"`, `\"`)
	script := fmt.Sprintf(`do shell script "wg-quick down %s" with administrator privileges`, escapedPath)

	cmd := exec.Command("osascript", "-e", script)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// Check if it's just because interface doesn't exist
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

	// On macOS, check if the utun interface exists by using ifconfig
	// This doesn't require sudo and is more reliable
	cmd := exec.Command("ifconfig")
	output, err := cmd.Output()
	if err != nil {
		return false
	}

	// Look for a utun interface with the WireGuard marker in output
	// WireGuard on macOS typically creates utun interfaces
	outputStr := string(output)

	// If we can run wg show without sudo, use it for a more accurate check
	wgCmd := exec.Command("wg", "show")
	wgOutput, wgErr := wgCmd.Output()
	if wgErr == nil && len(wgOutput) > 0 {
		return strings.Contains(string(wgOutput), "interface:")
	}

	// Fallback: check if any utun interface exists and config file is present
	// This is a reasonable indication that WireGuard is running
	return strings.Contains(outputStr, "utun") && configPath != ""
}

// GetStats returns connection statistics
func (m *WireGuardManager) GetStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})
	stats["connected"] = m.IsConnected()

	// Use sudo wg show directly (assumes wg is in sudoers/visudo for passwordless access)
	cmd := exec.Command("sudo", "wg", "show")
	output, err := cmd.Output()

	if err != nil || len(output) == 0 {
		// If command fails, return zeros
		fmt.Printf("Failed to get WireGuard stats: %v\n", err)
		stats["bytes_sent"] = int64(0)
		stats["bytes_received"] = int64(0)
		return stats, nil
	}

	// Parse the output to extract transfer statistics
	outputStr := string(output)
	fmt.Printf("WireGuard stats output:\n%s\n", outputStr)
	lines := strings.Split(outputStr, "\n")

	var bytesSent int64 = 0
	var bytesReceived int64 = 0
	var latestHandshake string

	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Look for transfer line: "transfer: 1.23 KiB received, 2.34 KiB sent"
		if strings.HasPrefix(line, "transfer:") {
			fmt.Printf("Found transfer line: %s\n", line)
			parts := strings.Split(line, "transfer:")
			if len(parts) > 1 {
				transferData := strings.TrimSpace(parts[1])
				// Parse "X received, Y sent"
				transferParts := strings.Split(transferData, ",")

				for _, part := range transferParts {
					part = strings.TrimSpace(part)
					if strings.Contains(part, "received") {
						bytesReceived = parseTransferSize(part)
						fmt.Printf("Parsed bytes received: %d\n", bytesReceived)
					} else if strings.Contains(part, "sent") {
						bytesSent = parseTransferSize(part)
						fmt.Printf("Parsed bytes sent: %d\n", bytesSent)
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
	fmt.Printf("Final stats - sent: %d, received: %d\n", bytesSent, bytesReceived)

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
