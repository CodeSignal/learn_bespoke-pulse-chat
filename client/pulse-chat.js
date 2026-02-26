const TEAM_CONTEXT = `
TEAM STATE & SITUATION CONTEXT (shared knowledge all team members have):
- You work at Acme Corp on the "Horizon" product team.
- TODAY is launch day. The team is releasing Horizon v2.0 to production, scheduled for 10:00 AM.
- The launch includes a major dashboard redesign, new API endpoints, and an updated onboarding flow.
- Last night's staging deploy went mostly smooth, but error monitoring (Datadog) started showing unusual 500-error spikes on the /api/users endpoint around 8:45 AM — roughly 2% of requests.
- The root cause is not yet confirmed. Alex is investigating; it might be a race condition in the new connection pooling logic.
- Stakeholders (VP of Product, marketing team) are expecting the launch to go live at 10 AM sharp — marketing has a press release queued.
- The team is feeling the pressure but staying professional. There's a real question of whether to delay the launch or go ahead.
- The user you are chatting with is a software engineer on the team. They are involved in the launch but not the one investigating the error spikes directly.

IMPORTANT: Stay in character. Respond naturally based on your role's perspective on this situation. Keep messages brief (1-3 sentences), casual workplace tone. Do NOT break character or mention that you are an AI.
`;

const CONVERSATIONS = [
  {
    id: 'sarah-chen',
    name: 'Sarah Chen',
    role: 'Engineering Manager',
    avatarText: 'SC',
    avatarClass: 'manager',
    persona: TEAM_CONTEXT + `
YOUR ROLE: You are Sarah Chen, the Engineering Manager for the Horizon team.
- You're responsible for coordinating the launch and communicating with stakeholders.
- You're aware of the error spikes and are waiting on Alex's investigation before making a call.
- You're feeling the pressure from the VP but want to make the right technical decision.
- You're supportive of your team, protective of them, and don't want to ship something broken.
- You tend to ask clarifying questions and want status updates. Occasionally use emoji.`,
    messages: [
      { sender: 'them', text: 'Morning! Big day today 🚀 How are you feeling about the launch?', time: '8:30 AM' },
      { sender: 'me', text: 'Feeling good! Ran through the checklist this morning. Everything on my end is green.', time: '8:35 AM' },
    ]
  },
  {
    id: 'alex-rivera',
    name: 'Alex Rivera',
    role: 'Senior Engineer',
    avatarText: 'AR',
    avatarClass: 'peer',
    persona: TEAM_CONTEXT + `
YOUR ROLE: You are Alex Rivera, Senior Engineer and the tech lead on Horizon v2.0.
- You are currently investigating the 500-error spikes on /api/users.
- You suspect it's a race condition in the new database connection pooling logic you wrote.
- You're deep in the logs and Datadog dashboards right now. You're focused and a bit terse.
- You're honest about the risk — you don't want to sugarcoat it, but you're not panicking either.
- You have a dry sense of humor and care deeply about shipping quality code.
- If asked about launch readiness, you'll express concern about error spikes and mention that you are still investigating.`,
    messages: [
    ]
  },
  {
    id: 'jordan-kim',
    name: 'Jordan Kim',
    role: 'Product Designer',
    avatarText: 'JK',
    avatarClass: 'designer',
    persona: TEAM_CONTEXT + `
YOUR ROLE: You are Jordan Kim, Product Designer on the Horizon team.
- You led the dashboard redesign that's shipping in v2.0. You're proud of the work.
- You're aware of the error spikes but don't fully understand the technical details.
- You're concerned about user experience — if errors affect the onboarding flow, it could hurt first impressions.
- You're collaborative and want to help however you can (e.g., preparing a fallback UI, drafting user-facing error messages).
- You care about the launch going well because you coordinated closely with marketing on the new look.`,
    messages: [
      { sender: 'them', text: 'Hey! The I shared the design with the team!', time: '5:00 PM, Mon' },
      { sender: 'me', text: 'Thank, appreciate it!', time: '5:12 PM, Mon' },
    ]
  }
];

let conversations = [];
let activeConversationId = null;
let _abortController = null;
let _context = {};
let _apiBase = '';

const DATA_VERSION = 2;

function loadConversations() {
  try {
    const saved = localStorage.getItem('pulse-chat-data');
    const savedVersion = localStorage.getItem('pulse-chat-version');
    if (saved && Number(savedVersion) === DATA_VERSION) {
      conversations = JSON.parse(saved);
    } else {
      conversations = JSON.parse(JSON.stringify(CONVERSATIONS));
      localStorage.setItem('pulse-chat-version', String(DATA_VERSION));
    }
  } catch (err) {
    console.error('Failed to load conversations:', err);
    conversations = JSON.parse(JSON.stringify(CONVERSATIONS));
  }
}

function saveConversations() {
  try {
    localStorage.setItem('pulse-chat-data', JSON.stringify(conversations));
  } catch (err) {
    console.error('Failed to save conversations:', err);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getLastMessage(conv) {
  if (conv.messages.length === 0) return { text: 'No messages yet', time: '' };
  return conv.messages[conv.messages.length - 1];
}

function renderConversationList() {
  const listEl = document.getElementById('chat-conversation-list');
  if (!listEl) return;

  listEl.innerHTML = conversations.map(conv => {
    const last = getLastMessage(conv);
    const isActive = conv.id === activeConversationId;
    const prefix = last.sender === 'me' ? 'You: ' : '';
    const preview = prefix + last.text;

    return `
      <button class="chat-conversation-item ${isActive ? 'active' : ''}" data-conv-id="${conv.id}">
        <div class="chat-avatar ${conv.avatarClass}">${conv.avatarText}</div>
        <div class="chat-conv-details">
          <div class="chat-conv-top-row">
            <span class="chat-conv-name">${escapeHtml(conv.name)}</span>
            <span class="chat-conv-time">${last.time}</span>
          </div>
          <div class="chat-conv-preview">${escapeHtml(preview.substring(0, 50))}</div>
        </div>
      </button>
    `;
  }).join('');
}

function renderMessages() {
  const messagesEl = document.getElementById('chat-messages');
  const nameEl = document.getElementById('chat-contact-name');
  const roleEl = document.getElementById('chat-contact-role');
  const inputArea = document.getElementById('chat-input-area');

  if (!activeConversationId) {
    messagesEl.innerHTML = '<div class="chat-empty">Choose a conversation from the sidebar to start chatting.</div>';
    nameEl.textContent = 'Select a conversation';
    roleEl.textContent = '';
    inputArea.hidden = true;
    return;
  }

  const conv = conversations.find(c => c.id === activeConversationId);
  if (!conv) return;

  nameEl.textContent = conv.name;
  roleEl.textContent = conv.role;
  inputArea.hidden = false;

  messagesEl.innerHTML = conv.messages.map(msg => {
    const isSent = msg.sender === 'me';
    const senderName = isSent ? 'You' : conv.name;
    const avatarClass = isSent ? '' : conv.avatarClass;
    const avatarText = isSent ? 'Me' : conv.avatarText;

    return `
      <div class="chat-message ${isSent ? 'sent' : 'received'}">
        <div class="chat-avatar ${avatarClass}">${avatarText}</div>
        <div class="chat-bubble">
          <div class="chat-bubble-meta">
            <span class="chat-bubble-sender">${escapeHtml(senderName)}</span>
            <span class="chat-bubble-time">${msg.time}</span>
          </div>
          ${escapeHtml(msg.text)}
        </div>
      </div>
    `;
  }).join('');

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTypingIndicator(conv) {
  const messagesEl = document.getElementById('chat-messages');
  const indicator = document.createElement('div');
  indicator.className = 'chat-typing';
  indicator.id = 'typing-indicator';
  indicator.innerHTML = `
    <div class="chat-avatar ${conv.avatarClass}" style="width:24px;height:24px;font-size:10px">${conv.avatarText}</div>
    <span>${escapeHtml(conv.name)} is typing</span>
    <span class="typing-dots"><span></span><span></span><span></span></span>
  `;
  messagesEl.appendChild(indicator);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function sendMessage(text) {
  if (!text.trim() || !activeConversationId) return;

  const conv = conversations.find(c => c.id === activeConversationId);
  if (!conv) return;

  conv.messages.push({ sender: 'me', text: text.trim(), time: formatTime() });
  saveConversations();
  renderMessages();
  renderConversationList();

  if (_context.emit) {
    _context.emit('chat:message-sent', {
      conversationId: conv.id,
      contactName: conv.name,
      sender: 'user',
      text: text.trim()
    });
  }

  showTypingIndicator(conv);

  try {
    const apiMessages = conv.messages.map(m => ({
      role: m.sender === 'me' ? 'user' : 'assistant',
      content: m.text
    }));

    const res = await fetch(_apiBase + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages, persona: conv.persona })
    });

    const data = await res.json();

    if (activeConversationId !== conv.id) return;

    removeTypingIndicator();

    conv.messages.push({ sender: 'them', text: data.response, time: formatTime() });
    saveConversations();
    renderMessages();
    renderConversationList();

    if (_context.emit) {
      _context.emit('chat:message-received', {
        conversationId: conv.id,
        contactName: conv.name,
        sender: conv.name,
        text: data.response
      });
    }

  } catch (err) {
    console.error('Failed to get chat response:', err);
    removeTypingIndicator();

    conv.messages.push({
      sender: 'them',
      text: 'Sorry, I got disconnected for a sec. What were you saying?',
      time: formatTime()
    });
    saveConversations();
    renderMessages();
    renderConversationList();
  }
}

function selectConversation(convId) {
  activeConversationId = convId;
  renderConversationList();
  renderMessages();

  const inputEl = document.getElementById('chat-input');
  if (inputEl) inputEl.focus();
}

export function init(context = {}) {
  _context = context;
  _apiBase = (context.config && context.config.basePath) || '';
  _abortController = new AbortController();
  const signal = _abortController.signal;

  loadConversations();
  renderConversationList();
  renderMessages();

  document.getElementById('chat-conversation-list').addEventListener('click', (e) => {
    const item = e.target.closest('.chat-conversation-item');
    if (item) selectConversation(item.dataset.convId);
  }, { signal });

  document.getElementById('chat-input-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value;
    input.value = '';
    sendMessage(text);
  }, { signal });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      activeConversationId = null;
      renderConversationList();
      renderMessages();
    }
  }, { signal });
}

export function destroy() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
  conversations = [];
  activeConversationId = null;
  _context = {};
  _apiBase = '';
}

export function onAction(action) {
  if (action.type === 'add-message') {
    const p = action.payload || {};
    const conv = conversations.find(c => c.id === p.conversationId);
    if (!conv) return;

    conv.messages.push({
      sender: 'them',
      text: p.text || '',
      time: p.time || formatTime()
    });
    saveConversations();
    renderConversationList();
    if (activeConversationId === conv.id) renderMessages();
  } else if (action.type === 'trigger-typing') {
    const conv = conversations.find(c => c.id === action.payload?.conversationId);
    if (conv && activeConversationId === conv.id) {
      showTypingIndicator(conv);
      setTimeout(removeTypingIndicator, action.payload?.duration || 2000);
    }
  }
}

export function onMessage(message) {
  console.log('Pulse Chat received message:', message);
}
