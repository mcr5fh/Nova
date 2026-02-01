package paths

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// GetTraceDir returns the appropriate trace directory path based on git context.
// For git repositories: ~/.nova/repos/<repo-name>/<branch>/traces/
// For non-git repos: ~/.nova/local/default/traces/
func GetTraceDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user home directory: %w", err)
	}

	// Try to get git context
	repoName, branch, err := getGitContext()
	if err != nil {
		// Not a git repo or error getting git info, use fallback
		return filepath.Join(homeDir, ".nova", "local", "default", "traces"), nil
	}

	// Sanitize branch name for filesystem
	sanitizedBranch := sanitizeBranchName(branch)

	return filepath.Join(homeDir, ".nova", "repos", repoName, sanitizedBranch, "traces"), nil
}

// getGitContext returns the repository name and current branch.
// Returns error if not in a git repository or if git info cannot be determined.
func getGitContext() (repoName, branch string, err error) {
	// Find .git directory
	gitDir, err := findGitDir()
	if err != nil {
		return "", "", err
	}

	// Get current branch
	branch, err = getCurrentBranch(gitDir)
	if err != nil {
		return "", "", err
	}

	// Get repository name from remote origin
	repoName, err = getRepoName(gitDir)
	if err != nil {
		return "", "", err
	}

	return repoName, branch, nil
}

// findGitDir searches for .git directory starting from current directory.
func findGitDir() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		gitPath := filepath.Join(dir, ".git")
		if info, err := os.Stat(gitPath); err == nil && info.IsDir() {
			return gitPath, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached root without finding .git
			return "", errors.New("not a git repository")
		}
		dir = parent
	}
}

// getCurrentBranch reads the current branch from .git/HEAD.
func getCurrentBranch(gitDir string) (string, error) {
	headPath := filepath.Join(gitDir, "HEAD")
	content, err := os.ReadFile(headPath)
	if err != nil {
		return "", fmt.Errorf("failed to read HEAD: %w", err)
	}

	// HEAD typically contains: "ref: refs/heads/branch-name"
	headStr := strings.TrimSpace(string(content))
	if strings.HasPrefix(headStr, "ref: refs/heads/") {
		branch := strings.TrimPrefix(headStr, "ref: refs/heads/")
		return branch, nil
	}

	// Detached HEAD state - could use commit hash or "detached"
	return "detached", nil
}

// getRepoName extracts the repository name from git config.
func getRepoName(gitDir string) (string, error) {
	configPath := filepath.Join(gitDir, "config")
	content, err := os.ReadFile(configPath)
	if err != nil {
		return "", fmt.Errorf("failed to read git config: %w", err)
	}

	// Look for [remote "origin"] url
	lines := strings.Split(string(content), "\n")
	inRemoteOrigin := false
	for _, line := range lines {
		line = strings.TrimSpace(line)

		if line == `[remote "origin"]` {
			inRemoteOrigin = true
			continue
		}

		if inRemoteOrigin && strings.HasPrefix(line, "url = ") {
			url := strings.TrimPrefix(line, "url = ")
			return extractRepoName(url)
		}

		// Exit remote origin section if we hit another section
		if inRemoteOrigin && strings.HasPrefix(line, "[") {
			break
		}
	}

	return "", errors.New("no remote origin found in git config")
}

// extractRepoName extracts repository name from a git URL.
// Handles both HTTPS and SSH URLs.
func extractRepoName(url string) (string, error) {
	if url == "" {
		return "", errors.New("empty git URL")
	}

	// Remove .git suffix if present
	url = strings.TrimSuffix(url, ".git")

	// Extract last path component
	// For HTTPS: https://github.com/user/repo -> repo
	// For SSH: git@github.com:user/repo -> repo
	parts := strings.FieldsFunc(url, func(r rune) bool {
		return r == '/' || r == ':'
	})

	if len(parts) == 0 {
		return "", errors.New("invalid git URL format")
	}

	return parts[len(parts)-1], nil
}

// sanitizeBranchName converts branch name to filesystem-safe format.
// Replaces slashes and special characters with hyphens.
func sanitizeBranchName(branch string) string {
	// Replace slashes with hyphens
	sanitized := strings.ReplaceAll(branch, "/", "-")

	// Replace other special characters with hyphens
	reg := regexp.MustCompile(`[^a-zA-Z0-9_\-.]`)
	sanitized = reg.ReplaceAllString(sanitized, "-")

	return sanitized
}
