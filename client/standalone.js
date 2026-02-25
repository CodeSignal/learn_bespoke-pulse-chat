import { init } from './pulse-chat.js';

const SIM_ID = 'pulse-chat';
const logBuffer = [];
let flushTimer = null;

function flushLogs() {
  const entries = logBuffer.splice(0);
  flushTimer = null;
  if (entries.length === 0) return;
  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries })
  }).catch(err => console.error('Failed to flush logs:', err));
}

function pushLog(entry) {
  logBuffer.push({ ...entry, ts: new Date().toISOString() });
  if (!flushTimer) flushTimer = setTimeout(flushLogs, 1000);
}

const context = {
  config: { id: SIM_ID, basePath: '' },
  emit: (eventType, payload = {}) => {
    pushLog({ simId: SIM_ID, dir: 'event', type: eventType, payload });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init(context));
} else {
  init(context);
}
