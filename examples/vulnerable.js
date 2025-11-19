// examples/vulnerable.js

// ❌ 1. Insecure HTTP server with no auth, no validation
// const http = require("http");
// const url = require("url");
// const { exec } = require("child_process");
// const fs = require("fs");

// ❌ 2. Hardcoded secret API key (credential exposure)
// const API_KEY = "sk_test_1234567890_super_secret";

// Fake in-memory "DB" for demo
// const users = [
//   { id: 1, name: "admin", role: "admin", password: "admin123" },
//   { id: 2, name: "alice", role: "user", password: "alice123" }
// ];

http
  .createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    const query = parsed.query;
    const path = parsed.pathname || "/";

    // ❌ 3. Reflected XSS: echo user input directly in HTML
    if (path === "/greet" && query.name) {
      res.setHeader("Content-Type", "text/html");
      res.end(`<h1>Hello ${query.name}</h1>`); // XSS if name contains script
      return;
    }

    // ❌ 4. Dangerous eval with query parameter
    if (path === "/run-code" && query.code) {
      // Very bad: remote code execution
      eval(query.code);
      res.end("Code executed");
      return;
    }

    // ❌ 5. Command injection via child_process.exec
    if (path === "/list" && query.dir) {
      const cmd = `dir ${query.dir}`; // e.g. user can inject " & del *"
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          res.statusCode = 500;
          res.end("Error executing command");
          return;
        }
        res.setHeader("Content-Type", "text/plain");
        res.end(stdout || stderr);
      });
      return;
    }

    // ❌ 6. Insecure direct object reference: user can access any ID
    if (path === "/user" && query.id) {
      const id = parseInt(query.id, 10);
      const user = users.find((u) => u.id === id);
      if (!user) {
        res.statusCode = 404;
        res.end("User not found");
        return;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(user)); // exposes password, role, etc.
      return;
    }

    // ❌ 7. Insecure file read based on user input (path traversal)
    if (path === "/read-file" && query.filename) {
      const filename = query.filename; // e.g. ../../etc/passwd
      fs.readFile(filename, "utf-8", (err, data) => {
        if (err) {
          res.statusCode = 500;
          res.end("Could not read file");
          return;
        }
        res.setHeader("Content-Type", "text/plain");
        res.end(data);
      });
      return;
    }

    res.end("OK");
  })
  .listen(3000, () => {
    console.log("Insecure demo server running on port 3000");
  });
