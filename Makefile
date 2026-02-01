.PHONY: build install test clean all

# Binary name and location
BINARY_NAME=nova-go
BIN_DIR=bin
INSTALL_DIR=/usr/local/bin

# Build variables
GO=go
GOFLAGS=-v
LDFLAGS=-ldflags "-s -w"

# Default target
all: build

# Build the binary
build:
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BIN_DIR)
	$(GO) build $(GOFLAGS) $(LDFLAGS) -o $(BIN_DIR)/$(BINARY_NAME) ./cmd/$(BINARY_NAME)
	@echo "Binary built at $(BIN_DIR)/$(BINARY_NAME)"

# Install the binary to system path
install: build
	@echo "Installing $(BINARY_NAME) to $(INSTALL_DIR)..."
	@install -m 755 $(BIN_DIR)/$(BINARY_NAME) $(INSTALL_DIR)/$(BINARY_NAME)
	@echo "Installed successfully"

# Run tests
test:
	@echo "Running tests..."
	$(GO) test -v -race -coverprofile=coverage.out ./...
	@echo "Tests completed"

# Run tests with coverage report
coverage: test
	@echo "Generating coverage report..."
	$(GO) tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated at coverage.html"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(BIN_DIR)
	@rm -f coverage.out coverage.html
	@rm -f nova-go/$(BINARY_NAME)
	@echo "Clean completed"

# Format code
fmt:
	@echo "Formatting code..."
	$(GO) fmt ./...

# Run linter
lint:
	@echo "Running linter..."
	$(GO) vet ./...

# Build and run
run: build
	$(BIN_DIR)/$(BINARY_NAME)

# Show help
help:
	@echo "Available targets:"
	@echo "  make build    - Build the binary to $(BIN_DIR)/$(BINARY_NAME)"
	@echo "  make install  - Install binary to $(INSTALL_DIR)"
	@echo "  make test     - Run all tests with race detector"
	@echo "  make coverage - Run tests and generate coverage report"
	@echo "  make clean    - Remove build artifacts"
	@echo "  make fmt      - Format Go code"
	@echo "  make lint     - Run go vet"
	@echo "  make run      - Build and run the binary"
	@echo "  make all      - Same as make build (default)"
