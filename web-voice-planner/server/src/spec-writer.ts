import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SPECS_DIR = 'specs/solutions';

export class SpecWriter {
  async saveSpec(slug: string, content: string): Promise<string> {
    // Ensure directory exists
    if (!existsSync(SPECS_DIR)) {
      await mkdir(SPECS_DIR, { recursive: true });
    }

    const filename = `${slug}.md`;
    const filePath = path.join(SPECS_DIR, filename);

    await writeFile(filePath, content, 'utf-8');

    return filePath;
  }
}
