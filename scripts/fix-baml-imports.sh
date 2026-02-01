#!/bin/bash
set -euo pipefail

# Post-process BAML generated code to fix import issues
# This works around bugs in BAML's Go code generator (v0.218.1)

echo "==> Fixing BAML generated imports..."

# Fix missing fmt import in type_builder.go
if grep -q "fmt.State" baml_client/type_builder/type_builder.go && ! grep -q '"fmt"' baml_client/type_builder/type_builder.go; then
    echo "  - Adding missing fmt import to type_builder.go"
    sed -i '' '16 a\
import "fmt"\
' baml_client/type_builder/type_builder.go
fi

# Run goimports to clean up all unused imports
if command -v goimports &> /dev/null; then
    echo "  - Running goimports to clean unused imports"
    goimports -w baml_client/
else
    echo "  - Warning: goimports not found, skipping cleanup"
    echo "    Install with: go install golang.org/x/tools/cmd/goimports@latest"
fi

echo "==> BAML import fixes complete!"
