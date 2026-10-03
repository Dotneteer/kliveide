# Coding Experiments

This directory contains small, tracked Z80 programs used to investigate TVC
hardware and emulator behavior. Keep generally useful source experiments here;
game-specific port code belongs in the standalone `tvc-ports` repository.

Write assembled CAS, TOML, BIN, screenshots, and other generated results under
the ignored `target/coding/` directory rather than committing them.

Compile numbered BASIC sources with `rtvc-basic`, and Z80 helper sources with
`rtvc-asm --format cas`:

```bash
mkdir -p target/coding
cargo run --bin rtvc-basic -- coding/crtc-register-explorer.bas -o target/coding/crtc-register-explorer.cas
```

`rtvc-tocas` compiles the same sources to sibling `.cas` files:

```bash
cargo run --bin rtvc-tocas -- coding/crtc-register-explorer.bas coding/crtc-register-explorer.asm
```
