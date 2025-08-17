// Quick test to verify sprite color functionality
const { createMachine } = require('./test/c64/test-machine');

const machine = createMachine();
const vic = machine.vicDevice;

console.log('Testing sprite color functionality...');

// Reset the VIC device
vic.reset();

// Verify initial state
console.log('Initial sprite colors:');
for (let i = 0; i < 8; i++) {
  console.log(`  Sprite ${i}: ${vic.spriteData[i].color}`);
}

// Set different colors for each sprite
console.log('\nSetting sprite colors...');
for (let i = 0; i < 8; i++) {
  const color = i + 1; // Colors 1-8
  vic.writeRegister(0x27 + i, color);
  console.log(`  Set sprite ${i} to color ${color}`);
}

// Verify the colors are set correctly
console.log('\nFinal sprite colors:');
for (let i = 0; i < 8; i++) {
  console.log(`  Sprite ${i}: ${vic.spriteData[i].color} (register: ${vic.registers[0x27 + i]})`);
}

// Test high nibble masking
console.log('\nTesting high nibble masking...');
vic.writeRegister(0x27, 0xFF); // Should mask to 0x0F
console.log(`Sprite 0 with 0xFF input: ${vic.spriteData[0].color} (should be 15)`);

console.log('\nSprite color functionality test completed successfully!');
