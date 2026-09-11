// skillsRegistry.js — load prompt-injection skills from skills/ directory.
// Pure file-system reads, fail-open (missing dir -> return []).
// English code, comments, and errors.
import fs from "fs/promises";
import path from "path";

let cachedSkills = null;

export async function findSkillsDir() {
  const candidates = [
    path.join(process.cwd(), "skills"),
    path.join(process.cwd(), "app", "skills"),
    process.env.HOME ? path.join(process.env.HOME, ".9router", "skills") : null,
  ].filter(Boolean);

  for (const dir of candidates) {
    try {
      const st = await fs.stat(dir);
      if (st.isDirectory()) return dir;
    } catch {}
  }
  return null;
}

export async function findSkillsDirForUpdate() {
  return await findSkillsDir();
}

export function invalidateSkillCache() {
  cachedSkills = null;
}

export async function getInstalledSkills(options = {}) {
  const { forceRefresh = false } = options;
  if (cachedSkills && !forceRefresh) return cachedSkills;

  const skillsDir = await findSkillsDir();
  if (!skillsDir) {
    cachedSkills = [];
    return [];
  }

  let entries;
  try {
    entries = await fs.readdir(skillsDir, { withFileTypes: true });
  } catch {
    cachedSkills = [];
    return [];
  }

  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(skillsDir, entry.name);
    try {
      const manifestRaw = await fs.readFile(path.join(skillDir, "manifest.json"), "utf8");
      const manifest = JSON.parse(manifestRaw);

      if (manifest.hook !== "system-prompt") continue;

      let prompt = "";
      const promptFile = manifest.prompt_file || "prompt.txt";
      // Basename guard
      if (/^[a-zA-Z0-9._-]+$/.test(promptFile)) {
        try {
          prompt = await fs.readFile(path.join(skillDir, promptFile), "utf8");
        } catch {}
      }

      skills.push({
        id: manifest.id || entry.name,
        name: manifest.name || entry.name,
        description: manifest.description || "",
        version: manifest.version || "1.0.0",
        hook: manifest.hook,
        prompt: prompt.trim(),
        defaultEnabled: Boolean(manifest.default_enabled),
        updatable: Boolean(manifest.updatable),
        sourceRepo: manifest.source_repo || null,
        sourceBranch: manifest.source_branch || null,
        sourcePath: manifest.source_path || null,
        contentHash: manifest.content_hash || null,
        source: manifest.source || null,
      });
    } catch {}
  }

  cachedSkills = skills;
  return skills;
}

export async function getSkillById(id) {
  const all = await getInstalledSkills();
  return all.find((s) => s.id === id) || null;
}
