#!/bin/bash

# Setup WireGuard sudoers configuration for passwordless access
# This allows wg and wg-quick commands to run without password prompts

USERNAME=$(whoami)

echo "Setting up passwordless sudo for WireGuard commands..."
echo "Username: $USERNAME"

# Create sudoers file content
SUDOERS_CONTENT="# Allow $USERNAME to run WireGuard commands without password
$USERNAME ALL=(ALL) NOPASSWD: /usr/local/bin/wg
$USERNAME ALL=(ALL) NOPASSWD: /usr/local/bin/wg-quick
$USERNAME ALL=(ALL) NOPASSWD: /opt/homebrew/bin/wg
$USERNAME ALL=(ALL) NOPASSWD: /opt/homebrew/bin/wg-quick"

# Write to temporary file
TEMP_FILE=$(mktemp)
echo "$SUDOERS_CONTENT" > "$TEMP_FILE"

# Validate the sudoers file
if sudo visudo -c -f "$TEMP_FILE" >/dev/null 2>&1; then
    echo "Sudoers configuration is valid"

    # Copy to sudoers.d
    sudo cp "$TEMP_FILE" /etc/sudoers.d/wireguard
    sudo chmod 440 /etc/sudoers.d/wireguard

    echo "✓ WireGuard sudoers configuration installed successfully!"
    echo "✓ File: /etc/sudoers.d/wireguard"
    echo ""
    echo "You can now run 'sudo wg show' without entering a password."
else
    echo "✗ Error: Invalid sudoers configuration"
    rm "$TEMP_FILE"
    exit 1
fi

# Clean up
rm "$TEMP_FILE"

echo ""
echo "Testing configuration..."
if sudo -n wg show >/dev/null 2>&1; then
    echo "✓ Success! WireGuard commands now work without password"
else
    echo "⚠ Note: If you see a password prompt, you may need to run 'sudo -k' to clear the sudo cache and try again"
fi
