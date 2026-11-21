import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';

export const projectFilesRouter = Router();

const WORKSPACE_ROOT = path.resolve(process.cwd());
const ALLOWED_TOP_DIRS = new Set(['android', 'backend', 'database', 'docs', 'admin-dashboard']);
const ALLOWED_ROOT_FILES = new Set(['README.md']);
const TEXT_EXTENSIONS = new Set([
  '.kt',
  '.kts',
  '.xml',
  '.properties',
  '.ts',
  '.sql',
  '.md',
  '.json',
]);

interface FileNode {
  path: string;
  name: string;
  category: string;
  size: number;
}

function walkAllowedDir(absDir: string, relPrefix: string, category: string, out: FileNode[]): void {
  if (!fs.existsSync(absDir)) return;
  const entries = fs.readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'build') continue;
    const absChild = path.join(absDir, entry.name);
    const relChild = `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      walkAllowedDir(absChild, relChild, category, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.has(ext)) {
        const stat = fs.statSync(absChild);
        out.push({
          path: relChild,
          name: entry.name,
          category,
          size: stat.size,
        });
      }
    }
  }
}

projectFilesRouter.get('/', (_req, res) => {
  const files: FileNode[] = [];
  for (const rootFile of ALLOWED_ROOT_FILES) {
    const abs = path.join(WORKSPACE_ROOT, rootFile);
    if (fs.existsSync(abs)) {
      files.push({
        path: rootFile,
        name: rootFile,
        category: 'docs',
        size: fs.statSync(abs).size,
      });
    }
  }
  for (const dir of ALLOWED_TOP_DIRS) {
    walkAllowedDir(path.join(WORKSPACE_ROOT, dir), dir, dir, files);
  }
  res.json({ files });
});

projectFilesRouter.get('/read', (req, res) => {
  const rel = typeof req.query.path === 'string' ? req.query.path.trim() : '';
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) {
    res.status(400).json({ error: 'Invalid file path' });
    return;
  }

  const normalizedRel = rel.replace(/\\/g, '/');
  const firstSegment = normalizedRel.split('/')[0];
  const isRootAllowed = ALLOWED_ROOT_FILES.has(normalizedRel);
  const isDirAllowed = ALLOWED_TOP_DIRS.has(firstSegment);

  if (!isRootAllowed && !isDirAllowed) {
    res.status(403).json({ error: 'Access restricted to deliverable project directories' });
    return;
  }

  const resolved = path.resolve(WORKSPACE_ROOT, normalizedRel);
  const baseBoundary = isRootAllowed
    ? WORKSPACE_ROOT + path.sep
    : path.resolve(WORKSPACE_ROOT, firstSegment) + path.sep;

  if (!resolved.startsWith(baseBoundary)) {
    res.status(403).json({ error: 'Path traversal blocked' });
    return;
  }

  const ext = path.extname(resolved).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const content = fs.readFileSync(resolved, 'utf8');
  res.json({ path: normalizedRel, content });
});
