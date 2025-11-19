// src/mcp/semgrepMcpTool.js

// MCP-style wrapper for the Semgrep tool.
// This is not a full MCP server, but it follows the same concepts:
// - tool definition (name, description, input schema)
// - handler that executes the tool and returns JSON-serializable output

import { runSemgrepOnFile } from "../tools/semgrepTool.js";

export const semgrepToolDefinition = {
  name: "semgrep_scan",
  description:
    "Scan a JavaScript source file with Semgrep and return raw findings.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the JavaScript file to scan"
      },
      config: {
        type: "string",
        description:
          "Semgrep config to use (e.g., p/javascript, r/javascript, r/security-audit). Optional.",
        nullable: true
      }
    },
    required: ["path"]
  }
};

/**
 * MCP-style tool handler.
 * args should match the input_schema above.
 */
export async function semgrepToolHandler(args) {
  const { path, config } = args;

  if (config) {
    process.env.SEMGREP_CONFIG = config;
  }

  const findings = await runSemgrepOnFile(path);

  return {
    tool_name: semgrepToolDefinition.name,
    target_file: path,
    config_used: process.env.SEMGREP_CONFIG || "p/javascript",
    findings
  };
}
