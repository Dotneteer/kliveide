// Debug test to understand the CSS selector issue
const { render } = require('@testing-library/react');
const React = require('react');

// Simple test component
const TestComponent = React.createElement('div', {
  className: '_splitter_12345 _horizontal_12345',
  style: { display: 'none', left: '100px' }
}, null);

console.log('Testing CSS selector behavior...');

// This should help us understand how CSS.escape and querySelector work
const container = document.createElement('div');
container.innerHTML = '<div class="_splitter_12345 _horizontal_12345" style="display: none; left: 100px;"></div>';

console.log('Element HTML:', container.innerHTML);

// Test various selectors
const byClass = container.querySelector('._splitter_12345');
const byOriginalName = container.querySelector('.splitter');
const byEscapedName = container.querySelector('.\\5f splitter\\5f 12345');

console.log('Found by actual class:', !!byClass);
console.log('Found by original name:', !!byOriginalName);
console.log('Style display:', byClass?.style?.display);
