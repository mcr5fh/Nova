package paths

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetTraceDir(t *testing.T) {
	tests := []struct {
		name           string
		setupGitRepo   bool
		repoName       string
		branch         string
		expectedSuffix string
	}{
		{
			name:           "git repo with branch",
			setupGitRepo:   true,
			repoName:       "test-repo",
			branch:         "main",
			expectedSuffix: filepath.Join(".nova", "repos", "test-repo", "main", "traces"),
		},
		{
			name:           "git repo with feature branch",
			setupGitRepo:   true,
			repoName:       "my-project",
			branch:         "feature/new-feature",
			expectedSuffix: filepath.Join(".nova", "repos", "my-project", "feature-new-feature", "traces"),
		},
		{
			name:           "non-git repo fallback",
			setupGitRepo:   false,
			expectedSuffix: filepath.Join(".nova", "local", "default", "traces"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create temporary directory for test
			tempDir := t.TempDir()
			oldDir, err := os.Getwd()
			if err != nil {
				t.Fatal(err)
			}
			defer os.Chdir(oldDir)

			if err := os.Chdir(tempDir); err != nil {
				t.Fatal(err)
			}

			// Setup git repo if needed
			if tt.setupGitRepo {
				// Initialize git repo
				if err := os.MkdirAll(filepath.Join(tempDir, ".git", "refs", "heads"), 0755); err != nil {
					t.Fatal(err)
				}

				// Create HEAD file pointing to branch
				headContent := "ref: refs/heads/" + tt.branch + "\n"
				if err := os.WriteFile(filepath.Join(tempDir, ".git", "HEAD"), []byte(headContent), 0644); err != nil {
					t.Fatal(err)
				}

				// Create config with remote origin
				configContent := `[remote "origin"]
	url = https://github.com/user/` + tt.repoName + `.git
`
				if err := os.WriteFile(filepath.Join(tempDir, ".git", "config"), []byte(configContent), 0644); err != nil {
					t.Fatal(err)
				}
			}

			// Get trace directory
			traceDir, err := GetTraceDir()
			if err != nil {
				t.Fatalf("GetTraceDir() error = %v", err)
			}

			// Verify the path ends with expected suffix
			homeDir, err := os.UserHomeDir()
			if err != nil {
				t.Fatal(err)
			}

			expectedPath := filepath.Join(homeDir, tt.expectedSuffix)
			if traceDir != expectedPath {
				t.Errorf("GetTraceDir() = %v, want %v", traceDir, expectedPath)
			}
		})
	}
}

func TestSanitizeBranchName(t *testing.T) {
	tests := []struct {
		name     string
		branch   string
		expected string
	}{
		{
			name:     "simple branch",
			branch:   "main",
			expected: "main",
		},
		{
			name:     "feature branch with slash",
			branch:   "feature/new-feature",
			expected: "feature-new-feature",
		},
		{
			name:     "branch with multiple slashes",
			branch:   "bugfix/issue/123",
			expected: "bugfix-issue-123",
		},
		{
			name:     "branch with special characters",
			branch:   "feature/add_new#feature",
			expected: "feature-add_new-feature",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := sanitizeBranchName(tt.branch)
			if result != tt.expected {
				t.Errorf("sanitizeBranchName(%q) = %q, want %q", tt.branch, result, tt.expected)
			}
		})
	}
}

func TestExtractRepoName(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		expected string
		wantErr  bool
	}{
		{
			name:     "https url",
			url:      "https://github.com/user/repo.git",
			expected: "repo",
			wantErr:  false,
		},
		{
			name:     "ssh url",
			url:      "git@github.com:user/repo.git",
			expected: "repo",
			wantErr:  false,
		},
		{
			name:     "https url without .git",
			url:      "https://github.com/user/repo",
			expected: "repo",
			wantErr:  false,
		},
		{
			name:     "empty url",
			url:      "",
			expected: "",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := extractRepoName(tt.url)
			if (err != nil) != tt.wantErr {
				t.Errorf("extractRepoName() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if result != tt.expected {
				t.Errorf("extractRepoName(%q) = %q, want %q", tt.url, result, tt.expected)
			}
		})
	}
}
