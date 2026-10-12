import fs from "fs";
import path from "path";

function search(dir, pattern) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', '.vite', '.next', '.astro'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      search(full, pattern);
    } else if (entry.isFile() && /\.(ts|tsx|js|json|md)$/.test(entry.name)) {
      try {
        const content = fs.readFileSync(full, 'utf8');
        if (pattern.test(content)) {
          console.log(full);
        }
      } catch (e) {}
    }
  }
}

search('apps', /portable-handoff|context.*handoff/i);
search('packages', /portable-handoff|context.*handoff/i);
