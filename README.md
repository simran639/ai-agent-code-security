# AI-agent-code-security

## Multi-Step LLM-Driven Code Review with Semgrep MCP Tooling

   - Developer: Simran Shilpakar
   - Course Alignment: Google 5-Day AI Agents Intensive Program

## Overview
This project implements a multi-step AI security analysis agent that reviews JavaScript source code using:

- Static Analysis (Semgrep)

- LLM-based contextual reasoning (Ollama)

- MCP-style tool interoperability

- Traceable agent memory for quality and evaluation

- Automated Markdown 

## Installation
- Clone the repository

```
git clone https://github.com/simran639/ai-agent-code-security.git

cd ai-agent-code-security
```

- Install Dependencies
  
```
npm install
```

- Install Python and Semgrep in virtual environment
  
```
py -m venv venv

.\venv\Scripts\activate

pip install semgrep
```

- Pull an LLM model in Ollama
  
```
ollama pull qwen2.5-coder:7b
```

- Usage
  
```
npm run analyze
```

## Workflow Flowchart

```
Source files (JS/TS)
                |
     Step 1: LLM summary of code
                |
     Step 2: Semgrep MCP Tool → Static Findings
                |
     Step 3: LLM interprets each finding into structured JSON
                |
     Step 4: LLM merges all pieces into final Markdown security report
                |
     Step 5: Trace JSON saved for agent quality evaluation 
                |
             Done
```
