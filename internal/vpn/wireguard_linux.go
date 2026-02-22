//go:build linux

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
	cmd := exec.Command("wg", "genkey")
	privateKeyBytes, err := cmd.Output()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate private key: %w", err)
	}
	privateKey = strings.TrimSpace(string(privateKeyBytes))

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

	if _, err := exec.LookPath("wg-quick"); err != nil {
		return fmt.Errorf("WireGuard not installed. Install with: sudo apt install wireguard-tools")
	}

	// Try to bring down any existing interface first
	downCmd := exec.Command("sudo", "wg-quick", "down", configPath)
	downCmd.Run() // ignore error

	// Bring up the WireGuard interface
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

	cmd := exec.Command("sudo", "wg-quick", "down", configPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		if strings.Contains(string(output), "is not a WireGuard interface") {
			return nil
		}
		return fmt.Errorf("failed to stop VPN: %w\nOutput: %s", err, string(output))
	}

	os.Remove(configPath)
	return nil
}

// IsConnected checks if the VPN is currently connected
func (m *WireGuardManager) IsConnected() bool {
	configPath := filepath.Join(m.configDir, "wg0.conf")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return false
	}

	// Check if wg0 interface exists
	cmd := exec.Command("ip", "link", "show", "wg0")
	if err := cmd.Run(); err != nil {
		return false
	}

	return true
}

// GetStats returns connection statistics
func (m *WireGuardManager) GetStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})
	stats["connected"] = m.IsConnected()

	cmd := exec.Command("sudo", "wg", "show")
	output, err := cmd.Output()
	if err != nil || len(output) == 0 {
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
