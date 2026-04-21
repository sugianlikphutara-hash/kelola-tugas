const fs = require("node:fs");
const path = require("node:path");

const MARKER = "codex-vite-net-use-workaround";

function patchViteWindowsNetUse(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`[${MARKER}] skip: file not found: ${filePath}`);
    return { status: "skipped" };
  }

  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes(MARKER)) {
    console.log(`[${MARKER}] ok: already patched`);
    return { status: "already_patched" };
  }

  const re =
    /exec\("net use", \(error, stdout\) => \{[\s\S]*?\}\);\r?\n\}/m;

  const match = original.match(re);
  if (!match) {
    console.log(
      `[${MARKER}] skip: could not locate net use exec block (vite file changed?)`
    );
    return { status: "skipped" };
  }

  const replacement = `try {\n\t\texec("net use", (error, stdout) => {\n\t\t\tif (error) return;\n\t\t\tconst lines = stdout.split("\\n");\n\t\t\tfor (const line of lines) {\n\t\t\t\tconst m = parseNetUseRE.exec(line);\n\t\t\t\tif (m) windowsNetworkMap.set(m[2], m[1]);\n\t\t\t}\n\t\t\tif (windowsNetworkMap.size === 0) safeRealpathSync = fs.realpathSync.native;\n\t\t\telse safeRealpathSync = windowsMappedRealpathSync;\n\t\t});\n\t} catch (error) {\n\t\t// ${MARKER}: some environments block child_process spawn (EPERM).\n\t\t// Fall back to sync realpath without mapped-drive optimization.\n\t\tsafeRealpathSync = fs.realpathSync;\n\t}\n}`;

  const patched = original.replace(re, replacement);
  if (patched === original) {
    console.log(`[${MARKER}] skip: no changes applied`);
    return { status: "skipped" };
  }

  fs.writeFileSync(filePath, patched, "utf8");
  console.log(`[${MARKER}] patched: ${filePath}`);
  return { status: "patched" };
}

function main() {
  const repoRoot = process.cwd();
  const viteChunkPath = path.join(
    repoRoot,
    "node_modules",
    "vite",
    "dist",
    "node",
    "chunks",
    "node.js"
  );

  const result = patchViteWindowsNetUse(viteChunkPath);
  if (result.status === "patched" || result.status === "already_patched") {
    process.exit(0);
  }

  // Don't fail install if Vite layout is different (CI or future upgrades).
  process.exit(0);
}

main();
