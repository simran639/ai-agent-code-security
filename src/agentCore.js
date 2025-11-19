// src/agentCore.js
import "dotenv/config";
import { readSourceFile } from "./tools/fileTool.js";
import { semgrepToolHandler } from "./mcp/semgrepMcpTool.js";
import { addEvent, getMemory, clearMemory } from "./memory/sessionMemo.js";
import { callLlm } from "./llmClient.js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: node src/agentCore.js <path-to-js-file>");
    process.exit(1);
  }

  clearMemory();

  addEvent({
    type: "system",
    message: `Starting multi-step security analysis for ${filePath}`
  });

  // 1) Read source file
  addEvent({
    type: "thought",
    message: "Step 1: Load the JavaScript source code."
  });

  const source = await readSourceFile(filePath);

  addEvent({
    type: "observation",
    tool: "fileTool",
    details: `Loaded ${source.length} characters of code.`
  });

  // 2) Run Semgrep via MCP-style tool wrapper
  addEvent({
    type: "thought",
    message:
      "Step 2: Run Semgrep (MCP-style tool) to collect static analysis findings."
  });

  const semgrepResponse = await semgrepToolHandler({ path: filePath });
  const semgrepResults = semgrepResponse.findings || [];

  addEvent({
    type: "observation",
    tool: semgrepResponse.tool_name,
    details: `Semgrep (config=${semgrepResponse.config_used}) returned ${semgrepResults.length} findings.`
  });

  // ──────────────────────────────────────────────
  // 3) LLM Call #1 – High-level source summary
  // ──────────────────────────────────────────────
  addEvent({
    type: "thought",
    message:
      "Step 3: Ask the LLM for a high-level summary of the code and broad security posture."
  });

  const summaryPrompt = buildSourceSummaryPrompt(source, filePath);
  const sourceSummary = await callLlm([
    {
      role: "system",
      content:
        "You are a senior application security engineer. " +
        "Give concise, accurate summaries in bullet points."
    },
    {
      role: "user",
      content: summaryPrompt
    }
  ]);

  addEvent({
    type: "observation",
    tool: "llm",
    details: "Generated high-level source summary."
  });

  // ──────────────────────────────────────────────
  // 4) LLM Call #2..N – Interpret each Semgrep finding separately
  // ──────────────────────────────────────────────
  addEvent({
    type: "thought",
    message:
      "Step 4: For each Semgrep finding, ask the LLM to produce a structured issue with severity & confidence."
  });

  const structuredIssues = [];

  for (let i = 0; i < semgrepResults.length; i++) {
    const finding = semgrepResults[i];

    addEvent({
      type: "thought",
      message: `Interpreting Semgrep finding ${i + 1}/${semgrepResults.length}.`
    });

    const findingPrompt = buildIssueFromFindingPrompt(source, finding, filePath);

    let issueText;
    try {
      issueText = await callLlm([
        {
          role: "system",
          content:
            "You are a senior application security engineer. " +
            "Return a single JSON object only, no extra commentary."
        },
        {
          role: "user",
          content: findingPrompt
        }
      ]);
    } catch (err) {
      addEvent({
        type: "observation",
        tool: "llm",
        details: `Failed to interpret Semgrep finding ${i + 1}: ${err.message}`
      });
      continue;
    }

    // Try to parse JSON; if it fails, keep raw text
    let parsedIssue;
    try {
      parsedIssue = JSON.parse(issueText);
    } catch {
      parsedIssue = {
        parse_error: true,
        raw_text: issueText
      };
    }

    structuredIssues.push(parsedIssue);

    addEvent({
      type: "observation",
      tool: "llm",
      details: `Got structured issue for finding ${i + 1}.`
    });
  }

  // ──────────────────────────────────────────────
  // 5) LLM Call #Final – Merge summary + issues into final report
  // ──────────────────────────────────────────────
  addEvent({
    type: "thought",
    message:
      "Step 5: Ask the LLM to compose the final security report using the source summary and structured issues."
  });

  const finalReportPrompt = buildFinalReportPrompt(
    filePath,
    sourceSummary,
    structuredIssues
  );

  const finalReport = await callLlm([
    {
      role: "system",
      content:
        "You are a senior application security engineer. " +
        "Generate a clear, concise Markdown security report. " +
        "Do not include raw JSON in the final output."
    },
    {
      role: "user",
      content: finalReportPrompt
    }
  ]);

  addEvent({
    type: "observation",
    tool: "llm",
    details: "Final security report generated."
  });

  // 6) Save security report to ./reports
  const { reportsDir, fullPath: reportPath } = buildReportPath(filePath);
  await mkdir(reportsDir, { recursive: true });

  const reportContent = `# Security Review Report

File analyzed: \`${filePath}\`  
Generated at: ${new Date().toISOString()}

---

${finalReport}
`;

  await writeFile(reportPath, reportContent, "utf-8");
  console.log(`\n✅ Security report written to: ${reportPath}`);

  // 7) Save trace for quality / observability
  const tracePath = path.join(
    "eval_trace_" + Date.now().toString() + ".json"
  );
  await writeFile(tracePath, JSON.stringify(getMemory(), null, 2), "utf-8");
  console.log(`🧠 Trace written to: ${tracePath}\n`);
}

// ──────────────────────────────────────────────
// Helper: build report path
// ──────────────────────────────────────────────
function buildReportPath(filePath) {
  const reportsDir = "reports";
  const baseName = path.basename(filePath).replace(/\.[^/.]+$/, ""); // e.g. vulnerable
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-"); // safe for filenames
  const fileName = `security_report_${baseName}_${timestamp}.pdf`;
  return { reportsDir, fullPath: path.join(reportsDir, fileName) };
}

// ──────────────────────────────────────────────
// Prompt builders
// ──────────────────────────────────────────────

function buildSourceSummaryPrompt(source, filePath) {
  return `
You are reviewing a JavaScript file for security issues.

File path: ${filePath}

1. Give a short bullet-point summary of what this file does (max 5 bullets).
2. Describe the overall security posture in 3–5 sentences.
3. Mention any obviously dangerous patterns you notice at a high level
   (but do NOT go into detailed per-issue reports yet).

--- SOURCE CODE START ---
${source}
--- SOURCE CODE END ---
`;
}

function buildIssueFromFindingPrompt(source, finding, filePath) {
  return `
You are given:

- A JavaScript source file.
- A SINGLE Semgrep finding as JSON (static analysis result).

Your task: interpret this finding and return exactly ONE JSON object with the following shape:

{
  "title": "short human-readable name of the issue",
  "category": "e.g. injection, xss, auth, access_control, crypto, misc",
  "severity": "LOW | MEDIUM | HIGH | CRITICAL",
  "confidence": "LOW | MEDIUM | HIGH",
  "explanation": "2-4 sentences explaining the issue in plain language.",
  "location": "line or snippet indicating where in the code this happens",
  "fix": "a concrete, code-level suggestion or safer pattern",
  "source_of_evidence": "e.g. 'Semgrep rule <rule-id>', 'manual review + Semgrep', etc."
}

Guidance for confidence:
- HIGH: very likely a real issue based on the code and the Semgrep rule.
- MEDIUM: likely issue but some contextual uncertainty.
- LOW: speculative or weak evidence; only mark LOW if you really are unsure.

Do NOT wrap the JSON in backticks. Do NOT add any commentary outside the JSON.

File path: ${filePath}

--- SOURCE CODE START ---
${source}
--- SOURCE CODE END ---

--- SEMGREP FINDING (JSON) START ---
${JSON.stringify(finding, null, 2)}
--- SEMGREP FINDING END ---
`;
}

function buildFinalReportPrompt(filePath, sourceSummary, structuredIssues) {
  return `
You are composing a final security report for a JavaScript file.

File: ${filePath}

You are given:
1) A high-level summary of the file and its security posture (from a previous step).
2) A list of structured issues derived from Semgrep findings, each including
   title, category, severity, confidence, explanation, location, fix, and source_of_evidence.

Your tasks:

1. Start with a short "Overall Security Posture" section (2–4 paragraphs max).
2. Add a "Findings by Category" section:
   - Group issues by category.
   - Within each category, list each issue with:
     - Title
     - Severity and confidence
     - Short explanation
     - Location
     - Concrete fix
3. Add a "Likely False Positives or Low-Confidence Items" section:
   - List any issues where confidence == LOW, with a short justification.
4. End with a "Prioritized Checklist" section:
   - Bullet list of actions, each prefixed like: [CRITICAL/HIGH/MEDIUM] [confidence] Action.

Keep the report concise and well-structured in Markdown.

--- HIGH-LEVEL SOURCE SUMMARY START ---
${sourceSummary}
--- HIGH-LEVEL SOURCE SUMMARY END ---

--- STRUCTURED ISSUES (JSON) START ---
${JSON.stringify(structuredIssues, null, 2)}
--- STRUCTURED ISSUES (JSON) END ---
`;
}

// ──────────────────────────────────────────────

main().catch((err) => {
  console.error("Agent run failed:", err);
  process.exit(1);
});
