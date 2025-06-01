#!/usr/bin/env node

/**
 * Custom script to run Vitest UI and automatically close when browser is closed
 */

import { spawn } from 'child_process'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let vitestProcess = null
let isClosing = false

// Function to start Vitest UI
function startVitest() {
  console.log('🧪 Starting Vitest UI...')
  
  vitestProcess = spawn('npx', ['vitest', '--ui', '--open'], {
    stdio: 'inherit',
    cwd: join(__dirname, '..')
  })

  vitestProcess.on('close', (code) => {
    if (!isClosing) {
      console.log(`\n🔴 Vitest UI process exited with code ${code}`)
      process.exit(code)
    }
  })

  vitestProcess.on('error', (error) => {
    console.error('❌ Failed to start Vitest UI:', error)
    process.exit(1)
  })
}

// Function to gracefully close Vitest
function closeVitest() {
  if (vitestProcess && !isClosing) {
    isClosing = true
    console.log('\n🔄 Closing Vitest UI...')
    
    // Try graceful shutdown first
    vitestProcess.kill('SIGTERM')
    
    // Force kill after 5 seconds if it doesn't close gracefully
    setTimeout(() => {
      if (vitestProcess) {
        console.log('🔨 Force killing Vitest UI process...')
        vitestProcess.kill('SIGKILL')
      }
    }, 5000)
  }
}

// Handle process termination signals
process.on('SIGINT', () => {
  console.log('\n⚡ Received SIGINT, closing Vitest UI...')
  closeVitest()
  setTimeout(() => process.exit(0), 1000)
})

process.on('SIGTERM', () => {
  console.log('\n⚡ Received SIGTERM, closing Vitest UI...')
  closeVitest()
  setTimeout(() => process.exit(0), 1000)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  closeVitest()
  process.exit(1)
})

// Start the process
console.log('🚀 Starting Vitest UI with auto-close behavior...')
console.log('💡 Press Ctrl+C to stop the test UI server')
startVitest()
