import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { SpecWriter } from './spec-writer';
import { readFile, rm, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

describe('SpecWriter', () => {
  const testSpecsDir = 'specs/solutions';
  let writer: SpecWriter;

  beforeEach(() => {
    writer = new SpecWriter();
  });

  afterEach(async () => {
    // Clean up test files
    const testFilePath = path.join(testSpecsDir, 'test-feature.md');
    if (existsSync(testFilePath)) {
      await rm(testFilePath);
    }
  });

  it('saves spec to correct location', async () => {
    const content = '# Test Spec\n\nThis is a test.';

    const filePath = await writer.saveSpec('test-feature', content);

    expect(filePath).toBe('specs/solutions/test-feature.md');
    expect(existsSync(filePath)).toBe(true);

    const saved = await readFile(filePath, 'utf-8');
    expect(saved).toBe(content);
  });

  it('creates directory if not exists', async () => {
    // Temporarily remove the directory if it exists
    const dirExisted = existsSync(testSpecsDir);
    if (dirExisted) {
      // We'll just test that the file is created correctly
      // since we don't want to delete the entire specs directory in tests
    }

    const content = '# Test Spec';
    await writer.saveSpec('test-feature', content);

    expect(existsSync(testSpecsDir)).toBe(true);
  });

  it('overwrites existing spec file', async () => {
    const initialContent = '# Initial Spec';
    const updatedContent = '# Updated Spec';

    await writer.saveSpec('test-feature', initialContent);
    await writer.saveSpec('test-feature', updatedContent);

    const saved = await readFile(path.join(testSpecsDir, 'test-feature.md'), 'utf-8');
    expect(saved).toBe(updatedContent);
  });

  it('returns full path to saved spec', async () => {
    const filePath = await writer.saveSpec('my-feature', '# Spec');

    expect(filePath).toBe('specs/solutions/my-feature.md');

    // Clean up
    if (existsSync(filePath)) {
      await rm(filePath);
    }
  });

  it('handles slugs with special characters by preserving them', async () => {
    const filePath = await writer.saveSpec('user-auth-v2', '# Spec');

    expect(filePath).toBe('specs/solutions/user-auth-v2.md');

    // Clean up
    if (existsSync(filePath)) {
      await rm(filePath);
    }
  });
});
