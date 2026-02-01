# Features Documentation

This directory contains comprehensive documentation for Nova features.

## Diagram Generation Feature

The diagram generation feature automatically creates and updates Mermaid diagrams based on agent conversation context.

### Quick Links

| Document | Purpose | Audience |
|----------|---------|----------|
| **[diagram-generation.md](./diagram-generation.md)** | Complete feature documentation with architecture, API reference, and troubleshooting | All developers |
| **[diagram-testing-guide.md](./diagram-testing-guide.md)** | Comprehensive test suite with 19 tests covering functionality, performance, and edge cases | QA testers, developers |
| **[diagram-quick-reference.md](./diagram-quick-reference.md)** | Quick reference guide with common operations, debugging tips, and code snippets | Developers needing quick answers |
| **[diagram-test-execution-report.md](./diagram-test-execution-report.md)** | Test execution status, code review results, and readiness assessment | Project managers, technical leads |

### Getting Started

1. **New to the feature?** Start with [diagram-generation.md](./diagram-generation.md) - Overview section
2. **Need to test?** Follow [diagram-testing-guide.md](./diagram-testing-guide.md) - Quick Smoke Test (5 min)
3. **Working on code?** Use [diagram-quick-reference.md](./diagram-quick-reference.md) for quick lookups
4. **Checking status?** See [diagram-test-execution-report.md](./diagram-test-execution-report.md) for current state

### Feature Overview

**What it does**: Automatically generates three types of Mermaid diagrams (flowcharts, ERDs, system architecture) based on agent conversations.

**Key components**:
- Backend: DiagramGenerator class with 5-second debouncing
- BAML: GenerateMermaidDiagrams function using Claude Haiku
- Frontend: DiagramPanel with tab switching and real-time rendering
- WebSocket: Real-time event broadcasting to all clients

**Performance**: 2-3 second generation time, non-blocking UI, < 100ms render time

### Quick Start (Developers)

```bash
# 1. Start BAML service
baml-cli dev

# 2. Start backend (separate terminal)
cd agent_loop_server && python server.py

# 3. Start frontend (separate terminal)
cd program_nova/dashboard/nextjs && npm run dev

# 4. Open browser to http://localhost:3000
# 5. Send message: "Create a user authentication system"
# 6. Observe diagrams generate in right panel
```

### Architecture at a Glance

```
User Message → Agent → DiagramGenerator (5s debounce) → BAML API
                                                           ↓
                                                      3 Diagrams
                                                           ↓
                        WebSocket Broadcast ← ← ← ← ← ← ← ←
                                ↓
                        useAgentChat Hook
                                ↓
                          DiagramPanel
                                ↓
                        MermaidRenderer
                                ↓
                             SVG
```

### Documentation Standards

All feature documentation should include:

- ✅ **Overview**: What the feature does
- ✅ **Architecture**: How components interact
- ✅ **API Reference**: Endpoints, events, types
- ✅ **Configuration**: Settings and options
- ✅ **Error Handling**: How errors are managed
- ✅ **Testing**: Manual and automated tests
- ✅ **Performance**: Benchmarks and optimization tips
- ✅ **Troubleshooting**: Common issues and fixes
- ✅ **Examples**: Code snippets and usage patterns
- ✅ **Quick Reference**: Developer cheat sheet

### Contributing

When adding new features:

1. Create feature documentation in this directory
2. Follow the template from diagram generation docs
3. Include testing guide with specific test cases
4. Create quick reference for common operations
5. Generate test execution report after implementation
6. Update this README with links to new docs

### Support

For questions or issues:

1. Check [diagram-quick-reference.md](./diagram-quick-reference.md) - Troubleshooting section
2. Check [diagram-generation.md](./diagram-generation.md) - Detailed explanations
3. Review [diagram-testing-guide.md](./diagram-testing-guide.md) - Debug steps in each test
4. Open issue on GitHub with logs and error messages

---

**Last Updated**: 2026-02-01
**Status**: Diagram feature fully documented and ready for testing
