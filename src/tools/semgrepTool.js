// src/tools/semgrepTool.js
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";

const execAsync = promisify(exec);

/**
 * Runs Semgrep on the given file using the SEMGREP_CMD env variable.
 * This version:
 *   - Fails loudly if Semgrep is missing or invalid
 *   - Prints clear diagnostics
 *   - Guarantees we do not proceed with empty Semgrep findings silently
 */
export async function runSemgrepOnFile(filePath) {
  const config = process.env.SEMGREP_CONFIG || "r/javascript";
  const semgrepCmd = process.env.SEMGREP_CMD || "semgrep";

  // Validate Semgrep path (Windows venv case especially)
  if (!fs.existsSync(semgrepCmd.replace(/\"/g, ""))) {
    console.error("\n❌ SEMGREP ERROR: Semgrep executable not found.");
    console.error("   SEMGREP_CMD is set to:", semgrepCmd);
    console.error("   Make sure your .env file contains the correct path, e.g.:");
    console.error("   SEMGREP_CMD=./venv/Scripts/semgrep.exe\n");
    throw new Error("Semgrep executable not found or invalid path.");
  }

  const cmd = `"${semgrepCmd}" --config ${config} --json "${filePath}"`;

  console.log(`\n[SemgrepTool] Running command: ${cmd}\n`);

  try {
    const { stdout, stderr } = await execAsync(cmd);

    if (stderr && stderr.trim().length > 0) {
      console.warn("[SemgrepTool] Semgrep stderr:", stderr);
    }

    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch (jsonErr) {
      console.error("\n❌ ERROR: Semgrep returned invalid JSON.");
      console.error("Raw Semgrep output:\n", stdout);
      throw new Error("Failed to parse Semgrep JSON output.");
    }

    console.log(`[SemgrepTool] Semgrep returned ${parsed.results.length} findings.\n`);

    return parsed.results || [];

  } catch (err) {
    console.error("\n❌ ERROR: Semgrep failed to run.");
    console.error("Details:", err.message);
    console.error("\nTroubleshooting:");
    console.error("  • Ensure Semgrep is installed in your venv:");
    console.error("      pip install semgrep");
    console.error("  • Then set SEMGREP_CMD in your .env file:");
    console.error("      SEMGREP_CMD=./venv/Scripts/semgrep.exe\n");
    throw err; // We fail loud & clear now
  }
}
