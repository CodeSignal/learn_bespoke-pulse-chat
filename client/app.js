import Modal from './design-system/components/modal/modal.js';

let websocket = null;
let helpModal = null;

function initializeWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws`;

  try {
    websocket = new WebSocket(wsUrl);
    websocket.onopen = () => console.log('WebSocket connected');
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.message) alert(data.message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setTimeout(initializeWebSocket, 3000);
    };
    websocket.onerror = (error) => console.error('WebSocket error:', error);
  } catch (error) {
    console.error('Failed to create WebSocket connection:', error);
  }
}

async function initializeHelpModal() {
  try {
    const response = await fetch('./help-content.html');
    const helpContent = await response.text();
    helpModal = Modal.createHelpModal({ title: 'Help / User Guide', content: helpContent });
    const helpButton = document.getElementById('btn-help');
    if (helpButton) helpButton.addEventListener('click', () => helpModal.open());
  } catch (error) {
    console.error('Failed to load help content:', error);
    helpModal = Modal.createHelpModal({
      title: 'Help / User Guide',
      content: '<p>Help content could not be loaded.</p>'
    });
    const helpButton = document.getElementById('btn-help');
    if (helpButton) helpButton.addEventListener('click', () => helpModal.open());
  }
}

async function initialize() {
  await initializeHelpModal();
  initializeWebSocket();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
