#!/bin/bash

echo "====================================="
echo "Aureo VPN Client Setup"
echo "====================================="
echo ""

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.21 or later."
    exit 1
fi
echo "✓ Go is installed: $(go version)"

# Check if Wails is installed
if ! command -v wails &> /dev/null; then
    echo "⚠️  Wails CLI is not installed."
    echo "Installing Wails CLI..."
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
    echo "✓ Wails CLI installed"
else
    echo "✓ Wails CLI is installed: $(wails version)"
fi

# Install Go dependencies
echo ""
echo "Installing Go dependencies..."
go mod download
go mod tidy
echo "✓ Go dependencies installed"

# Generate Wails bindings
echo ""
echo "Generating Wails bindings..."
wails generate module || true
echo "✓ Bindings generated"

echo ""
echo "====================================="
echo "Setup complete!"
echo "====================================="
echo ""
echo "To run in development mode:"
echo "  make dev"
echo ""
echo "To build for production:"
echo "  make build"
echo ""
echo "See README.md for more information."
