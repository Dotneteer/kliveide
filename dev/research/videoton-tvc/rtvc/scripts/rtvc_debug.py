#!/usr/bin/env python3
import socket
import json
import sys
import argparse
import cmd
import shlex
import readline # Enables command history and line editing

class RtvcShell(cmd.Cmd):
    intro = "Welcome to the RTVC Debugger Shell. Type help or ? to list commands.\n"
    prompt = "rtvc> "

    def __init__(self, host, port):
        super().__init__()
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            self.sock.connect((host, port))
        except ConnectionRefusedError:
            print(f"Error: Could not connect to emulator at {host}:{port}")
            sys.exit(1)
        self.sock.settimeout(5.0)
        print(f"Connected to emulator debugger at {host}:{port}")
        # Print initial status
        self.do_status("")

    def _send_cmd(self, cmd_dict):
        try:
            line = json.dumps(cmd_dict) + "\n"
            self.sock.sendall(line.encode("utf-8"))
            
            resp_bytes = b""
            while b"\n" not in resp_bytes:
                data = self.sock.recv(1)
                if not data:
                    break
                resp_bytes += data
            
            if not resp_bytes:
                print("Error: Connection closed by server.")
                return None
            
            return json.loads(resp_bytes.decode("utf-8").strip())
        except Exception as e:
            print(f"Communication Error: {e}")
            return None

    def do_status(self, arg):
        """Show Z80 CPU registers, cycles, running and halted status."""
        resp = self._send_cmd({"cmd": "status"})
        if not resp:
            return
        if resp.get("status") != "ok":
            print(f"Error: {resp.get('message')}")
            return
        
        print(f"System: {resp.get('system', 'unknown')}")
        print(f"AF: 0x{resp.get('af', 0):04X}   BC: 0x{resp.get('bc', 0):04X}   DE: 0x{resp.get('de', 0):04X}   HL: 0x{resp.get('hl', 0):04X}")
        print(f"IX: 0x{resp.get('ix', 0):04X}   IY: 0x{resp.get('iy', 0):04X}   SP: 0x{resp.get('sp', 0):04X}   PC: 0x{resp.get('pc', 0):04X}")
        print(f"Halted: {resp.get('halted')}   Running: {resp.get('running')}   Cycles: {resp.get('cycles')}")

    def do_stats(self, arg):
        """Show average emulation FPS over the recent rolling window."""
        resp = self._send_cmd({"cmd": "stats"})
        if not resp:
            return
        if resp.get("status") != "ok":
            print(f"Error: {resp.get('message')}")
            return

        print(
            f"Average FPS: {resp.get('average_fps', 0.0):.2f} "
            f"over {resp.get('window_seconds', 0.0):.2f}s "
            f"({resp.get('frames', 0)} frames, running: {resp.get('running')})"
        )

    def do_close_app(self, arg):
        """Close the emulator application and exit the debugger shell."""
        resp = self._send_cmd({"cmd": "close_app"})
        if resp and resp.get("status") == "ok":
            print("Emulator closed.")
            return True
        if resp:
            print(f"Error: {resp.get('message')}")
        return False

    def do_step(self, arg):
        """Step the Z80 CPU. Usage: step [count]"""
        count = 1
        if arg:
            try:
                count = int(arg)
            except ValueError:
                print("Error: count must be an integer.")
                return
        
        resp = self._send_cmd({"cmd": "step", "count": count})
        if resp and resp.get("status") == "ok":
            self.do_status("")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_continue(self, arg):
        """Resume execution in real time."""
        resp = self._send_cmd({"cmd": "continue"})
        if resp and resp.get("status") == "ok":
            print("Emulator resumed.")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_pause(self, arg):
        """Pause CPU execution."""
        resp = self._send_cmd({"cmd": "pause"})
        if resp and resp.get("status") == "ok":
            print("Emulator paused.")
            self.do_status("")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_reset(self, arg):
        """Reset the emulator state."""
        resp = self._send_cmd({"cmd": "reset"})
        if resp and resp.get("status") == "ok":
            print("Emulator reset.")
            self.do_status("")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_bp(self, arg):
        """Manage breakpoints.
        Usage:
          bp list
          bp add <address>
          bp rm <address>
        """
        parts = arg.split()
        if not parts:
            print("Usage: bp [list | add <addr> | rm <addr>]")
            return
        
        subcmd = parts[0].lower()
        if subcmd == "list":
            resp = self._send_cmd({"cmd": "breakpoint_list"})
            if resp and resp.get("status") == "ok":
                bps = resp.get("breakpoints", [])
                if bps:
                    print("Breakpoints: " + ", ".join(f"0x{bp:04X}" for bp in bps))
                else:
                    print("No active breakpoints.")
            elif resp:
                print(f"Error: {resp.get('message')}")
        elif subcmd in ("add", "rm", "remove"):
            if len(parts) < 2:
                print("Error: Missing address.")
                return
            try:
                addr = self._parse_number(parts[1])
            except ValueError:
                print("Error: Address must be decimal, 0x-prefixed, $-prefixed, or H-suffixed hex.")
                return
            
            cmd_name = "breakpoint_add" if subcmd == "add" else "breakpoint_remove"
            resp = self._send_cmd({"cmd": cmd_name, "addr": addr})
            if resp and resp.get("status") == "ok":
                print(f"Breakpoint {'added' if subcmd == 'add' else 'removed'} at 0x{addr:04X}")
            elif resp:
                print(f"Error: {resp.get('message')}")
        else:
            print("Unknown bp command. Use list, add, or rm.")

    def do_read(self, arg):
        """Read memory from mapped view or bank.
        Usage: read <address> <length> [bank]
        Examples:
          read 0x0000 32
          read 0x0000 64 sys
        """
        parts = arg.split()
        if len(parts) < 2:
            print("Usage: read <addr> <len> [bank]")
            return
        try:
            addr = self._parse_number(parts[0])
            length = self._parse_number(parts[1])
        except ValueError:
            print("Error: Address and length must be decimal, 0x-prefixed, $-prefixed, or H-suffixed hex.")
            return
        
        bank = parts[2] if len(parts) >= 3 else None
        
        cmd_dict = {"cmd": "read_memory", "addr": addr, "len": length}
        if bank:
            cmd_dict["bank"] = bank
            
        resp = self._send_cmd(cmd_dict)
        if resp and resp.get("status") == "ok":
            data = resp.get("data", [])
            print(self._hex_dump(addr, data))
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_disasm(self, arg):
        """Disassemble instructions.
        Usage: disasm <address> <byte_length>
        Example:
          disasm 0x0000 32
        """
        parts = arg.split()
        if len(parts) < 2:
            print("Usage: disasm <addr> <len>")
            return
        try:
            addr = self._parse_number(parts[0])
            length = self._parse_number(parts[1])
        except ValueError:
            print("Error: Address and length must be decimal, 0x-prefixed, $-prefixed, or H-suffixed hex.")
            return
            
        resp = self._send_cmd({"cmd": "disassemble", "addr": addr, "len": length})
        if resp and resp.get("status") == "ok":
            for inst in resp.get("instructions", []):
                inst_addr = inst.get("addr", 0)
                bytes_list = inst.get("bytes", [])
                bytes_str = " ".join(f"{b:02X}" for b in bytes_list).ljust(12)
                text = inst.get("text", "")
                print(f"0x{inst_addr:04X}:  {bytes_str} {text}")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_write(self, arg):
        """Write bytes to mapped memory or a raw TVC bank.
        Usage: write <address> <byte> [byte...] [bank=<bank>]
        Example:
          write 0x8000 3E 2A C9
          write 0x0000 F3 FB C9 bank=u0
        """
        parts = arg.split()
        if len(parts) < 2:
            print("Usage: write <addr> <byte> [byte...] [bank=<bank>]")
            return
        try:
            addr = self._parse_number(parts[0])
            bank = None
            byte_parts = []
            for value in parts[1:]:
                if value.lower().startswith("bank="):
                    bank = value.split("=", 1)[1]
                else:
                    byte_parts.append(value)
            data = [int(value, 16) for value in byte_parts]
        except ValueError:
            print("Error: Address or byte value is invalid.")
            return
        if not data:
            print("Error: At least one byte value is required.")
            return
        if not 0 <= addr <= 0xFFFF or any(not 0 <= value <= 0xFF for value in data):
            print("Error: Address must be 16-bit and byte values must be 00-FF.")
            return

        cmd_dict = {"cmd": "write_memory", "addr": addr, "data": data}
        if bank:
            cmd_dict["bank"] = bank

        resp = self._send_cmd(cmd_dict)
        if resp and resp.get("status") == "ok":
            location = f"{bank}:0x{addr:04X}" if bank else f"0x{addr:04X}"
            print(f"Wrote {resp.get('len', len(data))} byte(s) at {location}.")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_setreg(self, arg):
        """Set a Z80 register. Usage: setreg <name> <value>"""
        parts = arg.split()
        if len(parts) != 2:
            print("Usage: setreg <name> <value>")
            return
        try:
            value = self._parse_number(parts[1])
        except ValueError:
            print("Error: register value must be decimal, 0x-prefixed, $-prefixed, or H-suffixed hex.")
            return
        if not 0 <= value <= 0xFFFF:
            print("Error: register value must be between 0 and 65535.")
            return

        resp = self._send_cmd({"cmd": "set_register", "name": parts[0], "value": value})
        if resp and resp.get("status") == "ok":
            print(f"{resp.get('name', parts[0])}=0x{resp.get('value', value):04X}")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_out(self, arg):
        """Write a TVC I/O port. Usage: out <port> <value>"""
        parts = arg.split()
        if len(parts) != 2:
            print("Usage: out <port> <value>")
            return
        try:
            port = self._parse_number(parts[0])
            value = self._parse_number(parts[1])
        except ValueError:
            print("Error: port and value must be numbers.")
            return
        if not 0 <= port <= 0xFF or not 0 <= value <= 0xFF:
            print("Error: port and value must be 8-bit.")
            return

        resp = self._send_cmd({"cmd": "write_port", "port": port, "value": value})
        if resp and resp.get("status") == "ok":
            print(f"OUT (0x{port:02X}),0x{value:02X}")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_runirq(self, arg):
        """Run until the next interrupt is accepted or the debugger cycle limit is hit."""
        if arg.strip():
            print("Usage: runirq")
            return
        resp = self._send_cmd({"cmd": "run_to_interrupt"})
        if resp and resp.get("status") == "ok":
            print(
                f"Elapsed cycles: {resp.get('elapsed_cycles', 0)}; "
                f"interrupt accepted: {resp.get('interrupt_accepted')}"
            )
            self.do_status("")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_asm(self, arg):
        """Enter interactive assembler mode. Usage: asm [start_address]"""
        try:
            if arg.strip():
                addr = self._parse_number(arg)
            else:
                resp = self._send_cmd({"cmd": "status"})
                if not resp or resp.get("status") != "ok":
                    if resp:
                        print(f"Error: {resp.get('message')}")
                    return
                addr = resp.get("pc", 0)
        except ValueError:
            print("Error: Address must be decimal, 0x-prefixed, $-prefixed, or H-suffixed hex.")
            return
        if not 0 <= addr <= 0xFFFF:
            print("Error: Address must be between 0 and 65535.")
            return

        print("Assembler mode. Enter one Z80 instruction per line; blank line or 'exit' returns.")
        while True:
            try:
                source = input(f"asm {addr:04X}> ")
            except EOFError:
                print()
                break

            if not source.strip() or source.strip().lower() in ("exit", "quit", "q"):
                break

            resp = self._send_cmd({"cmd": "assemble", "addr": addr, "source": source})
            if resp and resp.get("status") == "ok":
                bytes_list = resp.get("bytes", [])
                write_resp = self._send_cmd(
                    {"cmd": "write_memory", "addr": addr, "data": bytes_list}
                )
                if write_resp and write_resp.get("status") == "ok":
                    bytes_str = " ".join(f"{byte:02X}" for byte in bytes_list)
                    print(f"{addr:04X}: {bytes_str}")
                    addr = resp.get("next_addr", addr + len(bytes_list)) & 0xFFFF
                elif write_resp:
                    print(f"Error: {write_resp.get('message')}")
            elif resp:
                print(f"Error: {resp.get('message')}")

    def do_asmfile(self, arg):
        """Assemble a source file and write it to mapped memory.
        Usage: asmfile <path> [origin]
        The source may use labels, ORG, EQU, DB/DEFB, DW/DEFW, and DS/DEFS.
        """
        try:
            parts = shlex.split(arg)
        except ValueError as err:
            print(f"Error: {err}")
            return
        if len(parts) not in (1, 2):
            print("Usage: asmfile <path> [origin]")
            return

        path = parts[0]
        try:
            if len(parts) == 2:
                origin = self._parse_number(parts[1])
            else:
                resp = self._send_cmd({"cmd": "status"})
                if not resp or resp.get("status") != "ok":
                    if resp:
                        print(f"Error: {resp.get('message')}")
                    return
                origin = resp.get("pc", 0)
        except ValueError:
            print("Error: Origin must be decimal, 0x-prefixed, $-prefixed, or H-suffixed hex.")
            return
        if not 0 <= origin <= 0xFFFF:
            print("Error: Origin must be between 0 and 65535.")
            return

        try:
            with open(path, "r", encoding="utf-8") as source_file:
                source = source_file.read()
        except OSError as err:
            print(f"Error: Could not read {path}: {err}")
            return

        resp = self._send_cmd({"cmd": "assemble", "addr": origin, "source": source})
        if not resp:
            return
        if resp.get("status") != "ok":
            print(f"Error: {resp.get('message')}")
            return

        segments = self._segments_from_assemble_response(resp, origin)
        if segments is None:
            return
        total = self._write_segments(segments)
        if total is None:
            return

        self._print_symbols(resp.get("symbols", {}))
        print(f"Assembled {total} byte(s); next address 0x{resp.get('next_addr', origin):04X}.")

    def do_loadasm(self, arg):
        """Load rtvc-asm TOML/JSON and write its segments to mapped memory.
        Usage: loadasm <path.toml>
        """
        try:
            parts = shlex.split(arg)
        except ValueError as err:
            print(f"Error: {err}")
            return
        if len(parts) != 1:
            print("Usage: loadasm <path.toml>")
            return

        path = parts[0]
        try:
            asm_json = self._load_structured_file(path)
        except ValueError as err:
            print(f"Error: {err}")
            return

        segments = self._segments_from_asm_json(asm_json)
        if segments is None:
            return
        total = self._write_segments(segments)
        if total is None:
            return

        self._print_symbols(asm_json.get("symbols", {}))
        next_addr = asm_json.get("next_addr")
        if isinstance(next_addr, int) and 0 <= next_addr <= 0xFFFF:
            print(f"Loaded {total} byte(s); next address 0x{next_addr:04X}.")
        else:
            print(f"Loaded {total} byte(s).")

    def do_loadz80json(self, arg):
        """Load converted ZX Spectrum .z80 TOML/JSON segments into mapped memory.
        Usage: loadz80toml <path.toml>
        """
        try:
            parts = shlex.split(arg)
        except ValueError as err:
            print(f"Error: {err}")
            return
        if len(parts) != 1:
            print("Usage: loadz80toml <path.toml>")
            return

        path = parts[0]
        try:
            z80_json = self._load_structured_file(path)
        except ValueError as err:
            print(f"Error: {err}")
            return

        segments = self._segments_from_z80_json(z80_json)
        if segments is None:
            return
        total = self._write_segments(segments)
        if total is None:
            return

        cpu = z80_json.get("cpu", {})
        if isinstance(cpu, dict):
            pc = cpu.get("pc")
            sp = cpu.get("sp")
            im = cpu.get("im")
            details = []
            if isinstance(pc, int) and 0 <= pc <= 0xFFFF:
                details.append(f"PC=0x{pc:04X}")
            if isinstance(sp, int) and 0 <= sp <= 0xFFFF:
                details.append(f"SP=0x{sp:04X}")
            if isinstance(im, int):
                details.append(f"IM={im}")
            if details:
                print("Snapshot CPU: " + " ".join(details))
        bridge = z80_json.get("tvc_bridge", {})
        if isinstance(bridge, dict):
            main_map = bridge.get("main_map_port_02")
            video_page = bridge.get("video_page_port_0c")
            video_mode = bridge.get("video_mode_port_06")
            if all(isinstance(value, int) for value in (main_map, video_page, video_mode)):
                print(
                    "TVC bridge hints: "
                    f"port 0x02=0x{main_map:02X}, "
                    f"port 0x0C=0x{video_page:02X}, "
                    f"port 0x06=0x{video_mode:02X}"
                )
        print(f"Loaded {total} byte(s) from converted Z80 TOML.")

    def do_loadtapjson(self, arg):
        """Load converted ZX Spectrum .tap TOML/JSON CODE segments into mapped memory.
        Usage: loadtaptoml <path.toml>
        """
        try:
            parts = shlex.split(arg)
        except ValueError as err:
            print(f"Error: {err}")
            return
        if len(parts) != 1:
            print("Usage: loadtaptoml <path.toml>")
            return

        path = parts[0]
        try:
            tap_json = self._load_structured_file(path)
        except ValueError as err:
            print(f"Error: {err}")
            return

        segments = self._segments_from_tap_json(tap_json)
        if segments is None:
            return
        total = self._write_segments(segments)
        if total is None:
            return

        entry = tap_json.get("entry")
        if isinstance(entry, int) and 0 <= entry <= 0xFFFF:
            print(f"Inferred entry: 0x{entry:04X}")
        candidates = tap_json.get("entry_candidates")
        if isinstance(candidates, list) and candidates:
            details = []
            for candidate in candidates:
                if not isinstance(candidate, dict):
                    continue
                line = candidate.get("line")
                addr = candidate.get("addr")
                if isinstance(line, int) and isinstance(addr, int):
                    details.append(f"line {line}: 0x{addr:04X}")
            if details:
                print("RANDOMIZE USR candidates: " + ", ".join(details))
        warnings = tap_json.get("warnings")
        if isinstance(warnings, list):
            for warning in warnings:
                if isinstance(warning, str):
                    print(f"Warning: {warning}")
        print(f"Loaded {total} byte(s) from converted TAP TOML.")

    def _load_structured_file(self, path):
        try:
            with open(path, "r", encoding="utf-8") as input_file:
                text = input_file.read()
        except OSError as err:
            raise ValueError(f"Could not read {path}: {err}") from err
        if path.lower().endswith(".json"):
            try:
                return json.loads(text)
            except json.JSONDecodeError as err:
                raise ValueError(f"{path} is not valid JSON: {err}") from err
        try:
            return self._parse_toml_subset(text)
        except ValueError as err:
            raise ValueError(f"{path} is not valid rtvc TOML: {err}") from err

    def _parse_toml_subset(self, text):
        root = {}
        current = root
        array_key = None
        array_lines = []

        for raw_line in text.splitlines():
            line = self._strip_toml_comment(raw_line).strip()
            if not line:
                continue
            if array_key is not None:
                array_lines.append(line)
                if "]" in line:
                    current[array_key] = self._parse_toml_array(" ".join(array_lines))
                    array_key = None
                    array_lines = []
                continue
            if line.startswith("[[") and line.endswith("]]"):
                path = line[2:-2].strip().split(".")
                parent = root
                for part in path[:-1]:
                    parent = parent.setdefault(part, {})
                current = {}
                parent.setdefault(path[-1], []).append(current)
                continue
            if line.startswith("[") and line.endswith("]"):
                current = root
                for part in line[1:-1].strip().split("."):
                    current = current.setdefault(part, {})
                continue
            if "=" not in line:
                raise ValueError(f"expected key/value line, got {raw_line!r}")
            key, value = [part.strip() for part in line.split("=", 1)]
            if value.startswith("[") and not value.rstrip().endswith("]"):
                array_key = key
                array_lines = [value]
            else:
                current[key] = self._parse_toml_value(value)

        if array_key is not None:
            raise ValueError(f"unterminated array for {array_key}")
        return root

    def _strip_toml_comment(self, line):
        in_string = False
        escaped = False
        for index, ch in enumerate(line):
            if escaped:
                escaped = False
                continue
            if ch == "\\" and in_string:
                escaped = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if ch == "#" and not in_string:
                return line[:index]
        return line

    def _parse_toml_value(self, value):
        value = value.strip()
        if value.startswith("["):
            return self._parse_toml_array(value)
        if value.startswith('"') and value.endswith('"'):
            return bytes(value[1:-1], "utf-8").decode("unicode_escape")
        if value == "true":
            return True
        if value == "false":
            return False
        return self._parse_number(value)

    def _parse_toml_array(self, value):
        inner = value.strip()
        if not inner.startswith("[") or not inner.endswith("]"):
            raise ValueError(f"invalid array {value!r}")
        inner = inner[1:-1].strip()
        if not inner:
            return []
        tokens = [token.strip() for token in inner.split(",") if token.strip()]
        return [self._parse_toml_value(token) for token in tokens]

    def _segments_from_assemble_response(self, resp, origin):
        return self._validate_segments(
            resp.get("segments") or [
            {
                "addr": resp.get("addr", origin),
                "bytes": resp.get("bytes", []),
                "len": resp.get("len", 0),
            }
            ]
        )

    def _segments_from_asm_json(self, asm_json):
        if not isinstance(asm_json, dict):
            print("Error: rtvc-asm document must be an object.")
            return None
        if asm_json.get("format") != "rtvc-asm-v1":
            print("Error: unsupported assembler format; expected rtvc-asm-v1.")
            return None
        return self._validate_segments(asm_json.get("segments"))

    def _segments_from_z80_json(self, z80_json):
        if not isinstance(z80_json, dict):
            print("Error: converted Z80 document must be an object.")
            return None
        if z80_json.get("format") != "rtvc-z80-snapshot-v1":
            print("Error: unsupported Z80 format; expected rtvc-z80-snapshot-v1.")
            return None
        if z80_json.get("machine") != "zx-spectrum-48k":
            print("Error: converted Z80 document must describe zx-spectrum-48k.")
            return None
        segments = self._validate_segments(z80_json.get("segments"))
        if segments is None:
            return None

        bridge = z80_json.get("tvc_bridge", {})
        mapping = bridge.get("segment_mapping") if isinstance(bridge, dict) else None
        if not isinstance(mapping, list):
            return segments
        bank_by_segment = {}
        for item in mapping:
            if isinstance(item, dict) and isinstance(item.get("segment"), str) and isinstance(item.get("suggested_tvc_bank"), str):
                bank_by_segment[item["segment"]] = item["suggested_tvc_bank"]

        converted = []
        for original, segment in zip(z80_json.get("segments", []), segments):
            name = original.get("name") if isinstance(original, dict) else None
            bank = bank_by_segment.get(name)
            if bank:
                segment = dict(segment)
                segment["addr"] = segment["addr"] & 0x3FFF
                segment["bank"] = bank
            converted.append(segment)
        return converted

    def _segments_from_tap_json(self, tap_json):
        if not isinstance(tap_json, dict):
            print("Error: converted TAP document must be an object.")
            return None
        if tap_json.get("format") != "rtvc-zx-tap-v1":
            print("Error: unsupported TAP format; expected rtvc-zx-tap-v1.")
            return None
        if tap_json.get("machine") != "zx-spectrum-48k":
            print("Error: converted TAP document must describe zx-spectrum-48k.")
            return None
        return self._validate_segments(tap_json.get("segments"))

    def _validate_segments(self, segments):
        if not isinstance(segments, list) or not segments:
            print("Error: document must contain at least one segment.")
            return None
        validated = []
        for index, segment in enumerate(segments):
            if not isinstance(segment, dict):
                print(f"Error: segment {index} must be an object.")
                return None
            addr = segment.get("addr")
            data = segment.get("bytes")
            if not isinstance(addr, int) or not 0 <= addr <= 0xFFFF:
                print(f"Error: segment {index} has invalid 16-bit addr.")
                return None
            if not isinstance(data, list) or any(
                not isinstance(byte, int) or not 0 <= byte <= 0xFF for byte in data
            ):
                print(f"Error: segment {index} bytes must be a list of 0..255 integers.")
                return None
            declared_len = segment.get("len")
            if declared_len is not None and declared_len != len(data):
                print(f"Error: segment {index} len does not match bytes length.")
                return None
            item = {"addr": addr, "bytes": data}
            bank = segment.get("bank")
            if isinstance(bank, str) and bank:
                item["bank"] = bank
            validated.append(item)
        return validated

    def _write_segments(self, segments):
        total = 0
        for segment in segments:
            addr = segment["addr"]
            data = segment["bytes"]
            cmd_dict = {"cmd": "write_memory", "addr": addr, "data": data}
            bank = segment.get("bank")
            if bank:
                cmd_dict["bank"] = bank
            write_resp = self._send_cmd(cmd_dict)
            if not write_resp:
                return None
            if write_resp.get("status") != "ok":
                location = f"{bank}:0x{addr:04X}" if bank else f"0x{addr:04X}"
                print(f"Error writing {location}: {write_resp.get('message')}")
                return None
            written = write_resp.get("len", len(data))
            total += written
            location = f"{bank}:0x{addr:04X}" if bank else f"0x{addr:04X}"
            print(f"Wrote {written} byte(s) at {location}.")
        return total

    def _print_symbols(self, symbols):
        if isinstance(symbols, dict) and symbols:
            names = ", ".join(
                f"{name}=0x{value:04X}"
                for name, value in sorted(symbols.items())
                if isinstance(value, int)
            )
            if names:
                print(f"Symbols: {names}")

    def do_save(self, arg):
        """Save a snapshot zip file. Usage: save <path>"""
        if not arg:
            print("Usage: save <snapshot_file_path>")
            return
        resp = self._send_cmd({"cmd": "save_snapshot", "path": arg})
        if resp and resp.get("status") == "ok":
            print(f"Snapshot saved to {arg}")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_load(self, arg):
        """Load a snapshot zip file. Usage: load <path>"""
        if not arg:
            print("Usage: load <snapshot_file_path>")
            return
        resp = self._send_cmd({"cmd": "load_snapshot", "path": arg})
        if resp and resp.get("status") == "ok":
            print(f"Snapshot loaded from {arg}")
            self.do_status("")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_screenshot(self, arg):
        """Capture screen as PNG. Usage: screenshot <path>"""
        if not arg:
            print("Usage: screenshot <png_file_path>")
            return
        resp = self._send_cmd({"cmd": "save_screenshot", "path": arg})
        if resp and resp.get("status") == "ok":
            print(f"Screenshot saved to {arg}")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_key(self, arg):
        """Send keyboard events.
        Usage:
          key press <char>
          key down <keycode>
          key up <keycode>
        Examples:
          key press A
          key down 65
          key up 65
        """
        parts = arg.split()
        if len(parts) < 2:
            print("Usage: key [press <char> | down <keycode> | up <keycode>]")
            return
        action = parts[0].lower()
        if action == "press":
            char = parts[1]
            resp = self._send_cmd({"cmd": "key", "action": "press", "char": char})
        elif action in ("down", "up"):
            try:
                code = self._parse_number(parts[1])
            except ValueError:
                print("Error: keycode must be decimal, 0x-prefixed, $-prefixed, or H-suffixed hex.")
                return
            resp = self._send_cmd({"cmd": "key", "action": action, "code": code})
        else:
            print("Unknown action. Use press, down, or up.")
            return

        if resp and resp.get("status") == "ok":
            print("Key command sent.")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_key_press(self, arg):
        """Hold a key for 50 Hz frames. Usage: key_press <keycode> <duration_frames>"""
        parts = arg.split()
        if len(parts) != 2:
            print("Usage: key_press <keycode> <duration_frames>")
            return
        try:
            key = self._parse_number(parts[0])
            duration = self._parse_number(parts[1])
        except ValueError:
            print("Error: keycode and duration must be numbers.")
            return
        resp = self._send_cmd({"cmd": "key_press", "key": key, "duration": duration})
        if resp and resp.get("status") == "ok":
            print(f"Key {key} pressed for {duration} frame(s).")
        elif resp:
            print(f"Error: {resp.get('message')}")

    def do_trace(self, arg):
        """Control the bounded instruction trace.
        Usage:
          trace start [capacity]
          trace stop
          trace clear
          trace status
          trace list [count]
        """
        parts = arg.split()
        if not parts:
            parts = ["status"]
        action = parts[0].lower()
        if action == "start":
            cmd_dict = {"cmd": "instruction_trace_start"}
            if len(parts) > 2:
                print("Usage: trace start [capacity]")
                return
            if len(parts) == 2:
                try:
                    cmd_dict["capacity"] = self._parse_number(parts[1])
                except ValueError:
                    print("Error: capacity must be a number.")
                    return
        elif action in ("stop", "clear", "status"):
            if len(parts) != 1:
                print(f"Usage: trace {action}")
                return
            cmd_dict = {"cmd": f"instruction_trace_{action}"}
        elif action == "list":
            if len(parts) > 2:
                print("Usage: trace list [count]")
                return
            cmd_dict = {"cmd": "instruction_trace_list"}
            if len(parts) == 2:
                try:
                    cmd_dict["limit"] = self._parse_number(parts[1])
                except ValueError:
                    print("Error: count must be a number.")
                    return
        else:
            print("Usage: trace [start [capacity] | stop | clear | status | list [count]]")
            return

        resp = self._send_cmd(cmd_dict)
        if not resp:
            return
        if resp.get("status") != "ok":
            print(f"Error: {resp.get('message')}")
            return
        if action == "list":
            for entry in resp.get("entries", []):
                registers = entry.get("registers", {})
                opcode = " ".join(f"{value:02X}" for value in entry.get("opcode", []))
                line = (
                    f"#{entry.get('sequence', 0):08d} "
                    f"{entry.get('pc', 0):04X}  {opcode:<11} "
                    f"{entry.get('instruction', ''):<20} "
                    f"AF={registers.get('af', 0):04X} BC={registers.get('bc', 0):04X} "
                    f"DE={registers.get('de', 0):04X} HL={registers.get('hl', 0):04X} "
                    f"SP={registers.get('sp', 0):04X}"
                )
                maps = []
                if entry.get("main_map") is not None:
                    maps.append(f"map={entry['main_map']:02X}")
                if entry.get("video_map") is not None:
                    maps.append(f"vid={entry['video_map']:02X}")
                writes = [
                    f"[{write.get('addr', 0):04X}]={write.get('value', 0):02X}"
                    for write in entry.get("memory_writes", [])
                ]
                ports = [
                    f"OUT({write.get('port', 0):04X})={write.get('value', 0):02X}"
                    for write in entry.get("port_writes", [])
                ]
                suffix = " ".join(maps + writes + ports)
                print(f"{line}  {suffix}".rstrip())
        else:
            print(
                f"Instruction trace: recording={resp.get('recording')} "
                f"entries={resp.get('entries', 0)}/{resp.get('capacity', 0)}"
            )

    def do_exit(self, arg):
        """Exit the debugger shell."""
        print("Goodbye.")
        return True

    def do_EOF(self, arg):
        """Exit the debugger shell on EOF (Ctrl-D)."""
        print()
        return self.do_exit(arg)

    # Aliases
    do_s = do_status
    do_fps = do_stats
    do_close = do_close_app
    do_t = do_step
    do_c = do_continue
    do_p = do_pause
    do_m = do_read
    do_d = do_disasm
    do_itrace = do_trace
    do_a = do_asm
    do_af = do_asmfile
    do_la = do_loadasm
    do_kp = do_key_press
    do_loadz80toml = do_loadz80json
    do_lz80 = do_loadz80json
    do_lz = do_loadz80json
    do_loadtaptoml = do_loadtapjson
    do_ltap = do_loadtapjson
    do_sr = do_setreg
    do_q = do_exit

    def _parse_number(self, value):
        value = value.strip().upper().replace("_", "")
        if value.startswith("$"):
            return int(value[1:], 16)
        if value.endswith("H"):
            return int(value[:-1], 16)
        if value.startswith("0X") or value.startswith("0B"):
            return int(value, 0)
        return int(value, 10)

    def _hex_dump(self, addr_start, data):
        lines = []
        for i in range(0, len(data), 16):
            chunk = data[i:i+16]
            hex_str = " ".join(f"{b:02X}" for b in chunk)
            # Add extra space after 8 bytes for readability
            if len(chunk) > 8:
                # 8 bytes = 23 chars (8 * 3 - 1)
                hex_str = hex_str[:23] + "  " + hex_str[24:]
            hex_str = hex_str.ljust(48)
            ascii_str = "".join(chr(b) if 32 <= b <= 126 else "." for b in chunk)
            lines.append(f"0x{addr_start + i:04X}:  {hex_str}  |{ascii_str}|")
        return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description="Videoton TV Computer Headless Debugger Client")
    parser.add_argument("--host", default="127.0.0.1", help="Debugger host IP (default: 127.0.0.1)")
    parser.add_argument("--port", "-p", type=int, default=8080, help="Debugger port (default: 8080)")
    args = parser.parse_args()

    shell = RtvcShell(args.host, args.port)
    shell.cmdloop()

if __name__ == "__main__":
    main()
