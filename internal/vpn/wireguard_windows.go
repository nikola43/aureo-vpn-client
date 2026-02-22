//go:build windows

package vpn

import (
	_ "embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

const tunnelName = "wg0"

//go:embed wgbin/wg.exe
var embeddedWgExe []byte

//go:embed wgbin/wireguard.exe
var embeddedWireguardExe []byte

// ensureBinaries extracts the embedded WireGuard binaries to the config directory if not already present
func (m *WireGuardManager) ensureBinaries() error {
	binDir := filepath.Join(m.configDir, "bin")
	if err := os.MkdirAll(binDir, 0755); err != nil {
		return fmt.Errorf("failed to create bin directory: %w", err)
	}

	binaries := map[string][]byte{
		"wg.exe":        embeddedWgExe,
		"wireguard.exe": embeddedWireguardExe,
	}

	for name, data := range binaries {
		destPath := filepath.Join(binDir, name)
		// Skip if binary already exists with correct size
		if info, err := os.Stat(destPath); err == nil && info.Size() == int64(len(data)) {
			continue
		}
		if err := os.WriteFile(destPath, data, 0755); err != nil {
			return fmt.Errorf("failed to extract %s: %w", name, err)
		}
	}

	return nil
}

// findExe searches for a WireGuard executable: bundled bin dir, app dir, PATH, then Program Files
func (m *WireGuardManager) findExe(name string) (string, error) {
	// Check bundled bin directory first
	bundledPath := filepath.Join(m.configDir, "bin", name)
	if _, err := os.Stat(bundledPath); err == nil {
		return bundledPath, nil
	}

	// Check next to the running executable
	if exePath, err := os.Executable(); err == nil {
		p := filepath.Join(filepath.Dir(exePath), name)
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}

	// Check PATH
	if p, err := exec.LookPath(name); err == nil {
		return p, nil
	}

	// Check common Windows install locations
	for _, envVar := range []string{"ProgramFiles", "ProgramFiles(x86)"} {
		dir := os.Getenv(envVar)
		if dir != "" {
			p := filepath.Join(dir, "WireGuard", name)
			if _, err := os.Stat(p); err == nil {
				return p, nil
			}
		}
	}

	return "", fmt.Errorf("%s not found", name)
}

// hiddenCmd sets SysProcAttr to hide the console window for a command
func hiddenCmd(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd
}

// GenerateKeys generates a WireGuard key pair
func (m *WireGuardManager) GenerateKeys() (privateKey, publicKey string, err error) {
	if err := m.ensureBinaries(); err != nil {
		return "", "", err
	}

	wgExe, err := m.findExe("wg.exe")
	if err != nil {
		return "", "", fmt.Errorf("WireGuard wg.exe not found: %w", err)
	}

	cmd := hiddenCmd(exec.Command(wgExe, "genkey"))
	privateKeyBytes, err := cmd.Output()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate private key: %w", err)
	}
	privateKey = strings.TrimSpace(string(privateKeyBytes))

	cmd = hiddenCmd(exec.Command(wgExe, "pubkey"))
	cmd.Stdin = strings.NewReader(privateKey)
	publicKeyBytes, err := cmd.Output()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate public key: %w", err)
	}
	publicKey = strings.TrimSpace(string(publicKeyBytes))

	return privateKey, publicKey, nil
}

// Connect starts the WireGuard VPN connection using the Windows tunnel service.
// The app must be running as Administrator (enforced by the manifest).
func (m *WireGuardManager) Connect() error {
	if err := m.ensureBinaries(); err != nil {
		return err
	}

	configPath := filepath.Join(m.configDir, tunnelName+".conf")

	wireguardExe, err := m.findExe("wireguard.exe")
	if err != nil {
		return fmt.Errorf("wireguard.exe not found: %w", err)
	}

	// Remove existing tunnel service if any (ignore errors — tunnel may not exist)
	uninstall := hiddenCmd(exec.Command(wireguardExe, "/uninstalltunnelservice", tunnelName))
	uninstall.Run()
	time.Sleep(time.Second)

	// Install and start the WireGuard tunnel service
	install := hiddenCmd(exec.Command(wireguardExe, "/installtunnelservice", configPath))
	output, err := install.CombinedOutput()
	if err != nil {
		outputStr := string(output)
		lower := strings.ToLower(outputStr + err.Error())
		if strings.Contains(lower, "access") || strings.Contains(lower, "denied") || strings.Contains(lower, "privilege") {
			return fmt.Errorf("administrator privileges required. Please run Aureo VPN as Administrator")
		}
		return fmt.Errorf("failed to start VPN: %w\nOutput: %s", err, outputStr)
	}

	// Wait for the tunnel service to come up
	for i := 0; i < 10; i++ {
		time.Sleep(500 * time.Millisecond)
		if m.IsConnected() {
			return nil
		}
	}

	if m.IsConnected() {
		return nil
	}

	return fmt.Errorf("VPN tunnel service did not start in time. Check WireGuard logs")
}

// Disconnect stops the WireGuard VPN connection
func (m *WireGuardManager) Disconnect() error {
	wireguardExe, err := m.findExe("wireguard.exe")
	if err != nil {
		return nil // Not found — nothing to disconnect
	}

	cmd := hiddenCmd(exec.Command(wireguardExe, "/uninstalltunnelservice", tunnelName))
	output, err := cmd.CombinedOutput()
	if err != nil {
		outputStr := strings.ToLower(string(output))
		if strings.Contains(outputStr, "not found") ||
			strings.Contains(outputStr, "does not exist") ||
			strings.Contains(outputStr, "not installed") {
			return nil
		}
		return fmt.Errorf("failed to stop VPN: %w\nOutput: %s", err, string(output))
	}

	// Wait for service to stop
	for i := 0; i < 10; i++ {
		time.Sleep(500 * time.Millisecond)
		if !m.IsConnected() {
			break
		}
	}

	// Clean up config file
	configPath := filepath.Join(m.configDir, tunnelName+".conf")
	os.Remove(configPath)

	return nil
}

// IsConnected checks if the VPN is currently connected
func (m *WireGuardManager) IsConnected() bool {
	configPath := filepath.Join(m.configDir, tunnelName+".conf")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return false
	}

	// Check if the WireGuard tunnel Windows service is running
	cmd := hiddenCmd(exec.Command("sc", "query", "WireGuardTunnel$"+tunnelName))
	output, err := cmd.Output()
	if err != nil {
		return false
	}

	return strings.Contains(string(output), "RUNNING")
}

// GetStats returns connection statistics
func (m *WireGuardManager) GetStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})
	stats["connected"] = m.IsConnected()

	wgExe, err := m.findExe("wg.exe")
	if err != nil {
		stats["bytes_sent"] = int64(0)
		stats["bytes_received"] = int64(0)
		return stats, nil
	}

	cmd := hiddenCmd(exec.Command(wgExe, "show", tunnelName))
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
