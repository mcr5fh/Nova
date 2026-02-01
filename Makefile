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
	cd nova-go && $(GO) build $(GOFLAGS) $(LDFLAGS) -o ../$(BIN_DIR)/$(BINARY_NAME) ./cmd/$(BINARY_NAME)
	@echo "Binary built at $(BIN_DIR)/$(BINARY_NAME)"

# Install the binary to system path
install: build
	@echo "Installing $(BINARY_NAME) to $(INSTALL_DIR)..."
	@install -m 755 $(BIN_DIR)/$(BINARY_NAME) $(INSTALL_DIR)/$(BINARY_NAME)
	@echo "Installed successfully"

# Run tests
test:
	@echo "Running tests..."
	cd nova-go && $(GO) test -v -race -coverprofile=coverage.out ./...
	@echo "Tests completed"

# Run tests with coverage report
coverage: test
	@echo "Generating coverage report..."
	cd nova-go && $(GO) tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated at coverage.html"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf $(BIN_DIR)
	@rm -f $(BINARY_NAME)
	@rm -f coverage.out coverage.html
	@echo "Clean completed"

# Format code
fmt:
	@echo "Formatting code..."
	cd nova-go && $(GO) fmt ./...

# Run linter
lint:
	@echo "Running linter..."
	cd nova-go && $(GO) vet ./...

# Run golangci-lint
golangci-lint:
	@echo "Running golangci-lint..."
	cd nova-go && GODEBUG=gotypesalias=1 golangci-lint run --config=.golangci.yml --timeout=5m

# Run nilaway (nil pointer dereference checker)
nilaway:
	@echo "Running nilaway..."
	cd nova-go && which nilaway > /dev/null 2>&1 || (echo "Installing nilaway..." && $(GO) install go.uber.org/nilaway/cmd/nilaway@latest)
	cd nova-go && nilaway ./...

# Build and run
run: build
	$(BIN_DIR)/$(BINARY_NAME)

# Show help
help:
	@echo "Available targets:"
	@echo "  make build         - Build the binary to $(BIN_DIR)/$(BINARY_NAME)"
	@echo "  make install       - Install binary to $(INSTALL_DIR)"
	@echo "  make test          - Run all tests with race detector"
	@echo "  make coverage      - Run tests and generate coverage report"
	@echo "  make clean         - Remove build artifacts"
	@echo "  make fmt           - Format Go code"
	@echo "  make lint          - Run go vet"
	@echo "  make golangci-lint - Run golangci-lint"
	@echo "  make nilaway       - Run nilaway (nil pointer checker)"
	@echo "  make run           - Build and run the binary"
	@echo "  make all           - Same as make build (default)"
