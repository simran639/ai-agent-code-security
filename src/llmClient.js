// src/llmClient.js

/**
 * Improved LLM client with:
 * - large timeout
 * - retry logic
 * - detailed error messages
 */

export async function callLlm(messages) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";

  const maxRetries = 3;
  const timeoutMs = 500_000; // 200 seconds timeout for large prompts

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `[LLM ERROR] HTTP ${response.status}: ${text.substring(0, 200)}`
        );
      }

      const data = await response.json();
      return data?.message?.content ?? "";

    } catch (err) {
      console.error(`⚠️ LLM attempt ${attempt} failed: ${err.message}`);

      if (attempt === maxRetries) {
        throw new Error(
          `[LLM FAILURE] All retries failed. Last error: ${err.message}`
        );
      }

      console.log("⏳ Retrying LLM call...");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
