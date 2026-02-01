#!/bin/bash
set -euo pipefail

# BAML code generation script for Nova
# This script generates Go client code from BAML definitions

echo "==> Generating BAML client code..."

# Check if baml-cli is installed
if ! command -v baml-cli &> /dev/null; then
    echo "Error: baml-cli not found. Install with:"
    echo "  npm install -g @boundaryml/baml-cli"
    echo "  or"
    echo "  brew install boundaryml/tap/baml"
    exit 1
fi

# Generate the BAML client
baml-cli generate

# Fix import issues in generated code
"$(dirname "$0")/fix-baml-imports.sh"

echo "==> BAML client generation complete!"
echo "Generated files in: baml_client/"
