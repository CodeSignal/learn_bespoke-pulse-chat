import { init } from './pulse-chat.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init({}));
} else {
  init({});
}
