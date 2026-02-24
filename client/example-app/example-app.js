// example-app.js
// Interactive Component Showcase Application

import Modal from '../design-system/components/modal/modal.js';

// App state
let counterValue = 0;
let incrementAmount = 1;
let counterLabel = 'Counter';
let dropdownInstance = null;
let helpModal = null;

// Update counter display
function updateCounterDisplay() {
    const counterDisplay = document.getElementById('counter-value');
    const labelDisplay = document.getElementById('display-label');
    const labelValueDisplay = document.getElementById('display-label-value');
    const incrementValueDisplay = document.getElementById('display-increment-value');

    if (counterDisplay) {
      counterDisplay.textContent = counterValue;
    }

    if (labelDisplay) {
      labelDisplay.textContent = counterLabel;
    }

    if (labelValueDisplay) {
      labelValueDisplay.textContent = counterLabel;
    }

    if (incrementValueDisplay) {
      incrementValueDisplay.textContent = incrementAmount;
    }

    // Update status tags
    updateStatusTags();
}

// Update status tags based on counter value
function updateStatusTags() {
    const primaryTag = document.getElementById('status-tag-primary');
    const positiveTag = document.getElementById('status-tag-positive');
    const negativeTag = document.getElementById('status-tag-negative');

    if (counterValue > 0) {
      if (primaryTag) primaryTag.style.display = 'none';
      if (positiveTag) positiveTag.style.display = 'inline-block';
      if (negativeTag) negativeTag.style.display = 'none';
    } else if (counterValue < 0) {
      if (primaryTag) primaryTag.style.display = 'none';
      if (positiveTag) positiveTag.style.display = 'none';
      if (negativeTag) negativeTag.style.display = 'inline-block';
    } else {
      if (primaryTag) primaryTag.style.display = 'inline-block';
      if (positiveTag) positiveTag.style.display = 'none';
      if (negativeTag) negativeTag.style.display = 'none';
    }
}

// Increment counter
function incrementCounter() {
    counterValue += incrementAmount;
    updateCounterDisplay();
}

// Decrement counter
function decrementCounter() {
    counterValue -= incrementAmount;
    updateCounterDisplay();
}

// Reset counter
function resetCounter() {
    counterValue = 0;
    updateCounterDisplay();
}

// Initialize dropdown component
function initializeDropdown() {
    if (typeof window.Dropdown === 'undefined') {
      console.error('Dropdown class not found. Make sure dropdown.js is loaded.');
      return;
    }

    const dropdownItems = [
      { value: '1', label: '1' },
      { value: '5', label: '5' },
      { value: '10', label: '10' },
      { value: '25', label: '25' }
    ];

    try {
      dropdownInstance = new window.Dropdown('#increment-dropdown', {
        items: dropdownItems,
        selectedValue: '1',
        placeholder: 'Select increment amount',
        onSelect: (value) => {
          incrementAmount = parseInt(value, 10);
          updateCounterDisplay();
        }
      });
    } catch (error) {
      console.error('Error initializing dropdown:', error);
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Sidebar controls
    const btnIncrement = document.getElementById('btn-increment');
    const btnDecrement = document.getElementById('btn-decrement');
    const btnReset = document.getElementById('btn-reset');
    const counterLabelInput = document.getElementById('counter-label');

    // Increment button
    if (btnIncrement) {
      btnIncrement.addEventListener('click', incrementCounter);
    }

    // Decrement button
    if (btnDecrement) {
      btnDecrement.addEventListener('click', decrementCounter);
    }

    // Reset button
    if (btnReset) {
      btnReset.addEventListener('click', resetCounter);
    }

    // Label input
    if (counterLabelInput) {
      counterLabelInput.addEventListener('input', (e) => {
        counterLabel = e.target.value || 'Counter';
        updateCounterDisplay();
      });
    }
}

// Initialize help modal
async function initializeHelpModal() {
    try {
      const response = await fetch('./help-content.html');
      const helpContent = await response.text();

      // Create help modal with actual content
      helpModal = Modal.createHelpModal({
        title: 'Help / User Guide',
        content: helpContent
      });

      // Bind help button click handler
      const helpButton = document.getElementById('btn-help');
      if (helpButton) {
        helpButton.addEventListener('click', () => {
          helpModal.open();
        });
      }
    } catch (error) {
      console.error('Failed to load help content:', error);
      // Fallback to placeholder content
      helpModal = Modal.createHelpModal({
        title: 'Help / User Guide',
        content: '<p>Help content could not be loaded. Please check that help-content.html exists.</p>'
      });

      // Bind help button click handler
      const helpButton = document.getElementById('btn-help');
      if (helpButton) {
        helpButton.addEventListener('click', () => {
          helpModal.open();
        });
      }
    }
}

// Initialize everything when DOM is ready
async function initialize() {
  initializeEventListeners();
  await initializeHelpModal();
  setTimeout(() => {
    initializeDropdown();
    updateCounterDisplay();
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
