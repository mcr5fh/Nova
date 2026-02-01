#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface HookInput {
    session_id: string;
    transcript_path: string;
    cwd: string;
    permission_mode: string;
    hook_event_name: string;
}

interface EditedFile {
    path: string;
    tool: string;
    timestamp: string;
}

interface SessionTracking {
    edited_files: EditedFile[];
}

function getFileCategory(filePath: string): 'backend' | 'frontend' | 'database' | 'other' {
    // Frontend detection (React Native/Expo)
    if (filePath.includes('/frontend/app/') ||
        filePath.includes('/frontend/components/') ||
        filePath.includes('/frontend/hooks/') ||
        filePath.includes('/frontend/utils/')) return 'frontend';

    // Backend detection (Python FastAPI)
    if (filePath.includes('/backend/src/hercules/api/') ||
        filePath.includes('/backend/src/hercules/bff/') ||
        filePath.includes('/backend/src/hercules/clients/') ||
        filePath.includes('/backend/scripts/')) return 'backend';

    // Database detection (SQLAlchemy + Alembic)
    if (filePath.includes('/backend/src/hercules/db/') ||
        filePath.includes('/backend/alembic/')) return 'database';

    return 'other';
}

function shouldCheckErrorHandling(filePath: string): boolean {
    // Skip test files, config files, and type definitions
    if (filePath.match(/\.(test|spec)\.(ts|tsx|py)$/)) return false;
    if (filePath.match(/test_.*\.py$/)) return false;
    if (filePath.match(/\.(config|d)\.(ts|tsx)$/)) return false;
    if (filePath.includes('types/')) return false;
    if (filePath.includes('.styles.ts')) return false;
    if (filePath.includes('__pycache__')) return false;

    // Check for code files (TypeScript/Python)
    return filePath.match(/\.(ts|tsx|js|jsx|py)$/) !== null;
}

function analyzeFileContent(filePath: string): {
    hasTryCatch: boolean;
    hasAsync: boolean;
    hasSQLAlchemy: boolean;
    hasFastAPI: boolean;
    hasApiCall: boolean;
} {
    if (!existsSync(filePath)) {
        return { hasTryCatch: false, hasAsync: false, hasSQLAlchemy: false, hasFastAPI: false, hasApiCall: false };
    }

    const content = readFileSync(filePath, 'utf-8');

    return {
        hasTryCatch: /try\s*:/.test(content), // Python try syntax
        hasAsync: /async\s+(def|with)/.test(content), // Python async
        hasSQLAlchemy: /select\(|AsyncSession|\.execute\(|\.scalar|\.all\(\)|db\.add|db\.commit/i.test(content),
        hasFastAPI: /@router\.(get|post|put|delete|patch)|APIRouter|FastAPI/i.test(content),
        hasApiCall: /fetch\(|axios\.|httpx\.|AsyncClient/i.test(content),
    };
}

async function main() {
    try {
        // Read input from stdin
        const input = readFileSync(0, 'utf-8');
        const data: HookInput = JSON.parse(input);

        const { session_id } = data;
        const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

        // Check for edited files tracking
        const cacheDir = join(process.env.HOME || '/root', '.claude', 'tsc-cache', session_id);
        const trackingFile = join(cacheDir, 'edited-files.log');

        if (!existsSync(trackingFile)) {
            // No files edited this session, no reminder needed
            process.exit(0);
        }

        // Read tracking data
        const trackingContent = readFileSync(trackingFile, 'utf-8');
        const editedFiles = trackingContent
            .trim()
            .split('\n')
            .filter(line => line.length > 0)
            .map(line => {
                const [timestamp, tool, path] = line.split('\t');
                return { timestamp, tool, path };
            });

        if (editedFiles.length === 0) {
            process.exit(0);
        }

        // Categorize files
        const categories = {
            backend: [] as string[],
            frontend: [] as string[],
            database: [] as string[],
            other: [] as string[],
        };

        const analysisResults: Array<{
            path: string;
            category: string;
            analysis: ReturnType<typeof analyzeFileContent>;
        }> = [];

        for (const file of editedFiles) {
            if (!shouldCheckErrorHandling(file.path)) continue;

            const category = getFileCategory(file.path);
            categories[category].push(file.path);

            const analysis = analyzeFileContent(file.path);
            analysisResults.push({ path: file.path, category, analysis });
        }

        // Check if any code that needs error handling was written
        const needsAttention = analysisResults.some(
            ({ analysis }) =>
                analysis.hasTryCatch ||
                analysis.hasAsync ||
                analysis.hasSQLAlchemy ||
                analysis.hasFastAPI ||
                analysis.hasApiCall
        );

        if (!needsAttention) {
            // No risky code patterns detected, skip reminder
            process.exit(0);
        }

        // Display reminder
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 ERROR HANDLING SELF-CHECK');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Backend reminders
        if (categories.backend.length > 0) {
            const backendFiles = analysisResults.filter(f => f.category === 'backend');
            const hasTryCatch = backendFiles.some(f => f.analysis.hasTryCatch);
            const hasSQLAlchemy = backendFiles.some(f => f.analysis.hasSQLAlchemy);
            const hasFastAPI = backendFiles.some(f => f.analysis.hasFastAPI);

            console.log('⚠️  Backend Changes Detected (Python/FastAPI)');
            console.log(`   ${categories.backend.length} file(s) edited\n`);

            if (hasTryCatch) {
                console.log('   ❓ Did you add sentry_sdk.capture_exception() in except blocks?');
            }
            if (hasSQLAlchemy) {
                console.log('   ❓ Are SQLAlchemy operations wrapped in error handling?');
            }
            if (hasFastAPI) {
                console.log('   ❓ Do FastAPI routes raise HTTPException with proper status codes?');
            }

            console.log('\n   💡 Backend Best Practice:');
            console.log('      - Capture unexpected errors to Sentry with capture_exception()');
            console.log('      - Use custom exception classes (HerculesError, ValidationError)');
            console.log('      - Raise HTTPException for expected errors (400, 404, etc.)\n');
        }

        // Frontend reminders
        if (categories.frontend.length > 0) {
            const frontendFiles = analysisResults.filter(f => f.category === 'frontend');
            const hasApiCall = frontendFiles.some(f => f.analysis.hasApiCall);
            const hasTryCatch = frontendFiles.some(f => f.analysis.hasTryCatch);

            console.log('💡 Frontend Changes Detected (React Native/Expo)');
            console.log(`   ${categories.frontend.length} file(s) edited\n`);

            if (hasApiCall) {
                console.log('   ❓ Do API calls handle errors with React Query onError?');
                console.log('   ❓ Are error messages shown to users (toast/alert)?');
            }
            if (hasTryCatch) {
                console.log('   ❓ Are errors displayed to the user?');
            }

            console.log('\n   💡 Frontend Best Practice:');
            console.log('      - Use React Query error handling (onError, isError)');
            console.log('      - Show user-friendly error messages with toast/alert');
            console.log('      - Use error boundaries for component crashes\n');
        }

        // Database reminders
        if (categories.database.length > 0) {
            console.log('🗄️  Database Changes Detected (SQLAlchemy/Alembic)');
            console.log(`   ${categories.database.length} file(s) edited\n`);
            console.log('   ❓ Did you verify column names against SQLAlchemy models?');
            console.log('   ❓ Are Alembic migrations tested?');
            console.log('   ❓ Did you update both upgrade() and downgrade()?\n');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💡 TIP: Disable with SKIP_ERROR_REMINDER=1');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        process.exit(0);
    } catch (err) {
        // Silently fail - this is just a reminder, not critical
        process.exit(0);
    }
}

main().catch(() => process.exit(0));
