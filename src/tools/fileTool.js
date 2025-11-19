// src/tools/fileTool.js
import { readFile } from "node:fs/promises";

export async function readSourceFile(filePath) {
  const content = await readFile(filePath, "utf-8");
  return content;
}
