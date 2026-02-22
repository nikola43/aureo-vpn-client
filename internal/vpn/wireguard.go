package vpn

import (
	"fmt"
	"os"
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

// parseWgShowStats parses wg show output for transfer and handshake stats
func parseWgShowStats(output string) (bytesSent, bytesReceived int64, latestHandshake string) {
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)

		if strings.HasPrefix(line, "transfer:") {
			parts := strings.Split(line, "transfer:")
			if len(parts) > 1 {
				transferData := strings.TrimSpace(parts[1])
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

		if strings.HasPrefix(line, "latest handshake:") {
			parts := strings.Split(line, "latest handshake:")
			if len(parts) > 1 {
				latestHandshake = strings.TrimSpace(parts[1])
			}
		}
	}

	return
}
