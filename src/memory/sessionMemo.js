// src/memory/sessionMemory.js

const events = [];

// Add an event to in-memory trace
export function addEvent(event) {
  events.push({
    timestamp: new Date().toISOString(),
    ...event
  });
}

// Get the current trace
export function getMemory() {
  return [...events];
}

// Clear memory for a new run
export function clearMemory() {
  events.length = 0;
}
