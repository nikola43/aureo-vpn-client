.PHONY: dev build clean install-deps

# Development mode with hot reload
dev:
	wails dev

# Build for current platform
build:
	wails build

# Build for all platforms
build-all:
	wails build -platform darwin/universal
	wails build -platform windows/amd64
	wails build -platform linux/amd64

# Build Windows installer (requires NSIS: choco install nsis)
# Run after 'wails build -platform windows/amd64'
build-installer:
	cp build/bin/aureo-vpn-client.exe build/windows/
	cp internal/vpn/wgbin/wg.exe build/windows/
	cp internal/vpn/wgbin/wireguard.exe build/windows/
	cd build/windows && makensis installer.nsi

# Clean build artifacts
clean:
	rm -rf build/bin/
	rm -rf frontend/dist/wailsjs/
	rm -f build/windows/aureo-vpn-client.exe
	rm -f build/windows/wg.exe
	rm -f build/windows/wireguard.exe
	rm -f build/windows/AureoVPN-Setup.exe

# Install Go dependencies
install-deps:
	go mod download
	go mod tidy

# Install Wails CLI
install-wails:
	go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Run the application (after building)
run:
	./build/bin/aureo-vpn-client

# Generate Wails bindings
generate:
	wails generate

# Help
help:
	@echo "Available targets:"
	@echo "  dev          - Run in development mode with hot reload"
	@echo "  build        - Build for current platform"
	@echo "  build-all    - Build for all platforms (macOS, Windows, Linux)"
	@echo "  build-installer - Build Windows NSIS installer (after build)"
	@echo "  clean        - Remove build artifacts"
	@echo "  install-deps - Install Go dependencies"
	@echo "  install-wails- Install Wails CLI"
	@echo "  run          - Run the built application"
	@echo "  generate     - Generate Wails bindings"
	@echo "  help         - Show this help message"
