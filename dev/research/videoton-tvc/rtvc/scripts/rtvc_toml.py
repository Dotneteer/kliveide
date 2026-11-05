"""Small TOML helpers for rtvc's human-readable byte segment artifacts."""


BYTES_PER_ROW = 16


def visible_ascii(byte):
    return chr(byte) if 0x20 <= byte <= 0x7E else "."


def quote_string(value):
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def hex_int(value, width=4):
    return f"0x{value:0{width}X}"


def scalar(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return hex_int(value, 2 if value <= 0xFF else 4)
    if isinstance(value, str):
        return quote_string(value)
    raise TypeError(f"unsupported TOML scalar {value!r}")


def inline_array(values):
    return "[" + ", ".join(scalar(value) for value in values) + "]"


def append_key(lines, key, value):
    if value is None:
        return
    if isinstance(value, list):
        lines.append(f"{key} = {inline_array(value)}")
    else:
        lines.append(f"{key} = {scalar(value)}")


def append_bytes(lines, key, values):
    lines.append(f"{key} = [")
    for start in range(0, len(values), BYTES_PER_ROW):
        row = values[start : start + BYTES_PER_ROW]
        body = ", ".join(hex_int(byte, 2) for byte in row)
        if row:
            body += ","
        ascii_gutter = "".join(visible_ascii(byte) for byte in row)
        lines.append(f"  {body:<95} # |{ascii_gutter}|")
    lines.append("]")


def document_to_toml(document):
    lines = []
    for key in (
        "format",
        "machine",
        "source",
        "version",
        "extended_header_len",
        "hardware_mode",
        "border_color",
        "block_count",
        "requested_origin",
        "origin",
        "next_addr",
        "entry",
        "ram_sha256",
        "tap_sha256",
    ):
        if key in document:
            append_key(lines, key, document[key])

    source_pages = document.get("source_pages")
    if isinstance(source_pages, dict):
        lines.append("")
        lines.append("[source_pages]")
        for key in ("compressed", "uncompressed"):
            if key in source_pages:
                append_key(lines, key, source_pages[key])

    cpu = document.get("cpu")
    if isinstance(cpu, dict):
        lines.append("")
        lines.append("[cpu]")
        for key, value in cpu.items():
            append_key(lines, key, value)

    bridge = document.get("tvc_bridge")
    if isinstance(bridge, dict):
        lines.append("")
        lines.append("[tvc_bridge]")
        for key, value in bridge.items():
            if key != "segment_mapping":
                append_key(lines, key, value)
        for item in bridge.get("segment_mapping", []):
            lines.append("")
            lines.append("[[tvc_bridge.segment_mapping]]")
            for key, value in item.items():
                append_key(lines, key, value)

    for item in document.get("tap_order", []):
        lines.append("")
        lines.append("[[tap_order]]")
        for item_key, value in item.items():
            append_key(lines, item_key, value)

    for key in ("headers", "entry_candidates", "lines"):
        for item in document.get(key, []):
            lines.append("")
            lines.append(f"[[{key}]]")
            for item_key, value in item.items():
                append_key(lines, item_key, value)

    symbols = document.get("symbols")
    if isinstance(symbols, dict):
        lines.append("")
        lines.append("[symbols]")
        for key, value in sorted(symbols.items()):
            append_key(lines, key, value)

    warnings = document.get("warnings")
    if isinstance(warnings, list):
        lines.append("")
        append_key(lines, "warnings", warnings)

    for segment in document.get("segments", []):
        lines.append("")
        lines.append("[[segments]]")
        for key, value in segment.items():
            if key != "bytes":
                append_key(lines, key, value)
        append_bytes(lines, "bytes", segment.get("bytes", []))

    for block in document.get("data_blocks", []):
        lines.append("")
        lines.append("[[data_blocks]]")
        for key, value in block.items():
            if key != "bytes":
                append_key(lines, key, value)
        append_bytes(lines, "bytes", block.get("bytes", []))

    for block in document.get("raw_blocks", []):
        lines.append("")
        lines.append("[[raw_blocks]]")
        for key, value in block.items():
            if key != "bytes":
                append_key(lines, key, value)
        append_bytes(lines, "bytes", block.get("bytes", []))

    return "\n".join(lines).rstrip() + "\n"
