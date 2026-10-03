#!/usr/bin/env python3
"""Convert plain ZX Spectrum 48K .z80 snapshots to rtvc TOML segments."""

import argparse
import hashlib
import os
import sys

from rtvc_toml import document_to_toml


BASE_HEADER_SIZE = 30
PAGE_SIZE = 0x4000
RAM_SIZE = 0xC000


class Z80SnapshotError(ValueError):
    pass


def read_word(data, offset):
    return data[offset] | (data[offset + 1] << 8)


def read_pair_be(data, offset):
    return (data[offset] << 8) | data[offset + 1]


def normalized_flags(flags):
    return 1 if flags == 0xFF else flags


def decompress_z80(data, expected_len, v1):
    output = bytearray()
    offset = 0

    while len(output) < expected_len:
        if v1 and data[offset : offset + 4] == b"\x00\xED\xED\x00":
            break
        if offset >= len(data):
            raise Z80SnapshotError(
                f"truncated Z80 compressed data at {len(output)} of {expected_len} output bytes"
            )
        byte = data[offset]
        if byte == 0xED and offset + 1 < len(data) and data[offset + 1] == 0xED:
            if offset + 3 >= len(data):
                raise Z80SnapshotError("truncated Z80 run length")
            count = data[offset + 2] or 256
            value = data[offset + 3]
            if len(output) + count > expected_len:
                raise Z80SnapshotError("Z80 compressed run exceeds expected memory size")
            output.extend([value] * count)
            offset += 4
        else:
            output.append(byte)
            offset += 1

    if len(output) != expected_len:
        raise Z80SnapshotError(
            f"Z80 compressed data produced {len(output)} bytes, expected {expected_len}"
        )
    return bytes(output)


def load_extended_memory(data):
    if len(data) < 32:
        raise Z80SnapshotError("Z80 v2/v3 snapshot is missing its extended header")
    header_len = read_word(data, 30)
    if header_len not in (23, 54, 55):
        raise Z80SnapshotError(f"unsupported Z80 extended header length {header_len}")

    block_start = 32 + header_len
    if len(data) < block_start:
        raise Z80SnapshotError("truncated Z80 extended header")

    hardware_mode = data[34]
    if hardware_mode != 0:
        raise Z80SnapshotError(
            f"unsupported Z80 hardware mode {hardware_mode}; expected plain 48K"
        )
    if len(data) > 37 and data[37] & 0x80:
        raise Z80SnapshotError("unsupported modified 16K Z80 hardware mode")

    ram = bytearray(RAM_SIZE)
    loaded_pages = 0
    compressed_pages = []
    uncompressed_pages = []
    offset = block_start
    while offset < len(data):
        if len(data) - offset < 3:
            raise Z80SnapshotError("truncated Z80 memory block header")
        compressed_len = read_word(data, offset)
        page = data[offset + 2]
        offset += 3

        page_map = {
            8: (0, 0x01),
            4: (PAGE_SIZE, 0x02),
            5: (PAGE_SIZE * 2, 0x04),
        }
        if page not in page_map:
            raise Z80SnapshotError(f"unsupported Z80 page {page} in plain 48K snapshot")
        ram_offset, page_bit = page_map[page]
        if loaded_pages & page_bit:
            raise Z80SnapshotError(f"duplicate Z80 memory page {page}")

        if compressed_len == 0xFFFF:
            end = offset + PAGE_SIZE
            if end > len(data):
                raise Z80SnapshotError(f"truncated uncompressed Z80 page {page}")
            page_data = data[offset:end]
            offset = end
            uncompressed_pages.append(page)
        else:
            end = offset + compressed_len
            if end > len(data):
                raise Z80SnapshotError(f"truncated compressed Z80 page {page}")
            page_data = decompress_z80(data[offset:end], PAGE_SIZE, False)
            offset = end
            compressed_pages.append(page)

        ram[ram_offset : ram_offset + PAGE_SIZE] = page_data
        loaded_pages |= page_bit

    if loaded_pages != 0x07:
        raise Z80SnapshotError(
            f"incomplete 48K Z80 snapshot: expected pages 4, 5, and 8, mask is 0x{loaded_pages:02X}"
        )

    version = 2 if header_len == 23 else 3
    return {
        "pc": read_word(data, 32),
        "ram": bytes(ram),
        "version": version,
        "extended_header_len": header_len,
        "hardware_mode": hardware_mode,
        "compressed_pages": compressed_pages,
        "uncompressed_pages": uncompressed_pages,
    }


def load_z80(data):
    if len(data) < BASE_HEADER_SIZE:
        raise Z80SnapshotError(
            f"Z80 snapshot must contain at least {BASE_HEADER_SIZE} bytes, got {len(data)}"
        )
    if data[29] & 0x03 > 2:
        raise Z80SnapshotError(f"invalid Z80 interrupt mode {data[29] & 0x03}")

    base_pc = read_word(data, 6)
    flags = normalized_flags(data[12])
    if base_pc != 0:
        memory = data[BASE_HEADER_SIZE:]
        if flags & 0x20:
            ram = decompress_z80(memory, RAM_SIZE, True)
            compressed = True
        else:
            if len(memory) != RAM_SIZE:
                raise Z80SnapshotError(
                    f"uncompressed Z80 v1 memory must be {RAM_SIZE} bytes, got {len(memory)}"
                )
            ram = memory
            compressed = False
        version_info = {
            "pc": base_pc,
            "ram": ram,
            "version": 1,
            "extended_header_len": 0,
            "hardware_mode": 0,
            "compressed_pages": [8, 4, 5] if compressed else [],
            "uncompressed_pages": [] if compressed else [8, 4, 5],
        }
    else:
        version_info = load_extended_memory(data)

    pc = version_info["pc"]
    ram = version_info["ram"]
    cpu = {
        "af": read_pair_be(data, 0),
        "bc": read_word(data, 2),
        "hl": read_word(data, 4),
        "pc": pc,
        "sp": read_word(data, 8),
        "i": data[10],
        "r": (data[11] & 0x7F) | ((flags & 0x01) << 7),
        "de": read_word(data, 13),
        "bc_alt": read_word(data, 15),
        "de_alt": read_word(data, 17),
        "hl_alt": read_word(data, 19),
        "af_alt": read_pair_be(data, 21),
        "iy": read_word(data, 23),
        "ix": read_word(data, 25),
        "iff1": data[27] != 0,
        "iff2": data[28] != 0,
        "im": data[29] & 0x03,
    }

    segments = []
    for name, addr, start in (
        ("spectrum_ram_4000_7fff", 0x4000, 0),
        ("spectrum_ram_8000_bfff", 0x8000, PAGE_SIZE),
        ("spectrum_ram_c000_ffff", 0xC000, PAGE_SIZE * 2),
    ):
        chunk = ram[start : start + PAGE_SIZE]
        segments.append(
            {
                "name": name,
                "addr": addr,
                "len": len(chunk),
                "bytes": list(chunk),
            }
        )

    return {
        "format": "rtvc-z80-snapshot-v1",
        "machine": "zx-spectrum-48k",
        "version": version_info["version"],
        "extended_header_len": version_info["extended_header_len"],
        "hardware_mode": version_info["hardware_mode"],
        "border_color": (flags >> 1) & 0x07,
        "cpu": cpu,
        "ram_sha256": hashlib.sha256(ram).hexdigest(),
        "segments": segments,
        "source_pages": {
            "compressed": version_info["compressed_pages"],
            "uncompressed": version_info["uncompressed_pages"],
        },
        "tvc_bridge": {
            "main_map_port_02": 0xB4,
            "video_page_port_0c": 0x00,
            "video_mode_port_06": 0x00,
            "segment_mapping": [
                {"segment": "spectrum_ram_4000_7fff", "suggested_tvc_bank": "vid0"},
                {"segment": "spectrum_ram_8000_bfff", "suggested_tvc_bank": "u2"},
                {"segment": "spectrum_ram_c000_ffff", "suggested_tvc_bank": "u3"},
            ],
        },
    }


def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Convert a plain ZX Spectrum 48K .z80 snapshot to rtvc TOML."
    )
    parser.add_argument("input", help=".z80 snapshot to convert")
    parser.add_argument("-o", "--output", help="output TOML path; defaults to stdout")
    parser.add_argument(
        "--compact",
        action="store_true",
        help="accepted for compatibility; TOML output is always human-readable",
    )
    parser.add_argument(
        "--no-source-path",
        action="store_true",
        help="omit the input filename from the generated TOML",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    try:
        with open(args.input, "rb") as snapshot_file:
            data = snapshot_file.read()
        document = load_z80(data)
    except (OSError, Z80SnapshotError) as err:
        print(f"z80_to_toml: {err}", file=sys.stderr)
        return 1

    if not args.no_source_path:
        document["source"] = os.path.basename(args.input)

    output = document_to_toml(document)

    if args.output:
        try:
            with open(args.output, "w", encoding="utf-8") as output_file:
                output_file.write(output)
        except OSError as err:
            print(f"z80_to_toml: could not write {args.output}: {err}", file=sys.stderr)
            return 1
    else:
        sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
