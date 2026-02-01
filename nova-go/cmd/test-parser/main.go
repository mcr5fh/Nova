package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/mattruiters/nova/internal/hook"
)

func main() {
	input, err := hook.ParseInput(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	output, _ := json.MarshalIndent(input, "", "  ")
	fmt.Println(string(output))
}
