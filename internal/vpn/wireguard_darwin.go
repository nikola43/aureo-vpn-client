//go:build darwin

package vpn

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

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

	bytesSent, bytesReceived, latestHandshake := parseWgShowStats(string(output))
	stats["bytes_sent"] = bytesSent
	stats["bytes_received"] = bytesReceived
	stats["latest_handshake"] = latestHandshake

	return stats, nil
}
