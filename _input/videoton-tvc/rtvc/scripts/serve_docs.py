#!/usr/bin/env python3
"""
A simple HTTP server to host and serve the rtvc emulator web documents (docs/ directory).
Supports both Windows and macOS (and Linux).
"""

import http.server
import os
import socket
import sys
import webbrowser
import mimetypes

def find_free_port(start_port=8000, max_port=8100):
    """Find a free TCP port to bind to, starting from start_port."""
    for port in range(start_port, max_port + 1):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                # Bind to localhost
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No free port available in the range {start_port}-{max_port}")

def main():
    # Force stdout to flush immediately (line buffering)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)

    # Get the directory of the current script and locate the docs folder
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(script_dir, ".."))
    docs_dir = os.path.join(repo_root, "docs")

    if not os.path.isdir(docs_dir):
        print(f"Error: The docs directory does not exist at: {docs_dir}", file=sys.stderr)
        print("Please build the web bundle first (e.g., cargo xtask bundle-web-full docs) or run this script from the repository root.", file=sys.stderr)
        sys.exit(1)

    # Change the working directory to docs_dir so that the simple handler serves it.
    os.chdir(docs_dir)

    # Ensure correct MIME types are mapped (crucial for WebAssembly on some platforms like Windows)
    mimetypes.add_type('application/wasm', '.wasm')
    mimetypes.add_type('text/javascript', '.js')

    # Find an available port
    try:
        port = find_free_port()
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    url = f"http://127.0.0.1:{port}/"

    # Set up the server
    server_address = ('127.0.0.1', port)
    
    # We configure the handler to subclass SimpleHTTPRequestHandler.
    # We can also add nice headers (e.g., to disable caching during development).
    class DocsHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            # Disable caching for active development/testing
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            super().end_headers()

    # Enable address reuse so we don't get 'address already in use' errors on quick restarts
    http.server.HTTPServer.allow_reuse_address = True

    try:
        with http.server.HTTPServer(server_address, DocsHTTPRequestHandler) as httpd:
            print(f"Serving RTVC Web Emulator from: {docs_dir}")
            print(f"Local Server URL: {url}")
            print("Press Ctrl+C to stop the server.")

            # Attempt to automatically open the default web browser
            try:
                webbrowser.open(url)
            except Exception as e:
                print(f"Note: Could not open browser automatically: {e}")

            # Start serving
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server. Goodbye!")
        sys.exit(0)
    except Exception as e:
        print(f"Server error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
