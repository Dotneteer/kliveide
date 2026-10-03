//! Regenerates `roms/rom_symbols_1_2.json` from the standalone ROM listings.
//!
//! Label addresses come from the real assembler (`rtvc-asm --format toml`),
//! so the database can never drift from what the listings assemble to. The
//! bank and file offset come from each listing's `Physical bank` header, the
//! canonical origin from its `ORG` line, and the key of every entry is
//! `(bank, image offset)` — there are no address aliases anymore.
//!
//! Curated prose (`summary`, `tags`, `usage`, …) is merged from the previous
//! database by `(bank, offset)`. Labels without a curated entry become
//! low-confidence stubs for a human to fill in.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::process::Command;

/// (ASM listing relative to the workspace root, bank id).
const LISTINGS: &[(&str, &str)] = &[
    ("roms/TVC12_D4.64K.asm", "sys"),
    ("roms/TVC12_D3.64K.asm", "sys"),
    ("roms/TVC12_D7.64K.asm", "exth"),
];

const JSON_PATH: &str = "roms/rom_symbols_1_2.json";
const IMAGE_LEN: u16 = 0x2000;

struct AsmLabel {
    bank: String,
    address: u16,
    offset: u16,
    name: String,
    kind: String,
}

pub fn rom_symbols(check: bool) -> Result<(), String> {
    let workspace = super::workspace_dir()?;
    let mut labels = Vec::new();
    for (asm, bank) in LISTINGS {
        labels.extend(labels_from_listing(&workspace, asm, bank)?);
    }
    let json_path = workspace.join(JSON_PATH);
    let previous = fs::read_to_string(&json_path)
        .map_err(|err| format!("failed to read {}: {err}", json_path.display()))?;
    let output = merge_database(&previous, labels)?;
    if check {
        if output == previous {
            println!("{JSON_PATH} is current");
            Ok(())
        } else {
            Err(format!(
                "{JSON_PATH} is stale: run `cargo xtask rom-symbols` to regenerate"
            ))
        }
    } else {
        fs::write(&json_path, &output)
            .map_err(|err| format!("failed to write {}: {err}", json_path.display()))?;
        println!("wrote {}", json_path.display());
        Ok(())
    }
}

/// Assembles one listing with `rtvc-asm` and converts its symbol table to
/// `(bank, offset)` labels.
fn labels_from_listing(
    workspace: &Path,
    asm: &str,
    bank: &str,
) -> Result<Vec<AsmLabel>, String> {
    let asm_path = workspace.join(asm);
    let source = fs::read_to_string(&asm_path)
        .map_err(|err| format!("failed to read {}: {err}", asm_path.display()))?;
    let (file_offset, origin) = listing_header(&source, asm)?;
    let toml = assemble_toml(workspace, &asm_path)?;
    let (toml_origin, symbols) = parse_toml_symbols(&toml, asm)?;
    if toml_origin != origin {
        return Err(format!(
            "{asm}: ORG origin {origin:04X} disagrees with assembler origin {toml_origin:04X}"
        ));
    }
    let mut labels = Vec::new();
    for (name, address) in symbols {
        if is_auto_label(&name) {
            continue;
        }
        let Some(local) = address.checked_sub(origin) else {
            println!("warning: {asm}: {name} at {address:04X} is below ORG; skipped");
            continue;
        };
        if local >= IMAGE_LEN {
            println!("warning: {asm}: {name} at {address:04X} is outside the image; skipped");
            continue;
        }
        labels.push(AsmLabel {
            bank: bank.to_string(),
            address,
            offset: file_offset + local,
            name: name.clone(),
            kind: infer_kind(&source, &name),
        });
    }
    Ok(labels)
}

/// Reads `; Physical bank: SYS offset 0000H` and the `ORG` line.
fn listing_header(source: &str, asm: &str) -> Result<(u16, u16), String> {
    let mut bank_offset = None;
    for line in source.lines() {
        let Some(rest) = line.strip_prefix("; Physical bank:") else {
            continue;
        };
        let parts: Vec<_> = rest.split_whitespace().collect();
        if parts.len() == 3 && parts[1].eq_ignore_ascii_case("offset") {
            let offset = parse_h_number(parts[2]).ok_or_else(|| {
                format!("{asm}: cannot parse bank offset in `{}`", line.trim())
            })?;
            bank_offset = Some(offset);
        }
    }
    let mut origin = None;
    for line in source.lines() {
        let code = line.split(';').next().unwrap_or("").trim();
        if let Some(rest) = code.strip_prefix("ORG ") {
            let first = rest.split([',', ' ', '\t']).next().unwrap_or("");
            origin = Some(parse_h_number(first).ok_or_else(|| {
                format!("{asm}: cannot parse ORG origin in `{}`", line.trim())
            })?);
            break;
        }
    }
    match (bank_offset, origin) {
        (Some(file_offset), Some(origin)) => Ok((file_offset, origin)),
        _ => Err(format!("{asm}: missing `Physical bank` header or ORG line")),
    }
}

/// Runs `rtvc-asm --format toml` through Cargo and returns its stdout.
fn assemble_toml(workspace: &Path, asm_path: &Path) -> Result<String, String> {
    let output = Command::new("cargo")
        .arg("run")
        .arg("--quiet")
        .arg("--bin")
        .arg("rtvc-asm")
        .arg("--")
        .arg("--format")
        .arg("toml")
        .arg(asm_path)
        .current_dir(workspace)
        .output()
        .map_err(|err| format!("failed to run rtvc-asm through Cargo: {err}"))?;
    if !output.status.success() {
        return Err(format!(
            "rtvc-asm failed on {}:\n{}",
            asm_path.display(),
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    String::from_utf8(output.stdout)
        .map_err(|err| format!("assembler output is not UTF-8: {err}"))
}

/// Extracts the top-level `origin` and the `[symbols]` table from TOML output.
fn parse_toml_symbols(toml: &str, asm: &str) -> Result<(u16, Vec<(String, u16)>), String> {
    let mut origin = None;
    let mut symbols = Vec::new();
    let mut in_symbols = false;
    for line in toml.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            in_symbols = line == "[symbols]";
            continue;
        }
        if in_symbols {
            if line.is_empty() {
                continue;
            }
            let (name, value) = line.split_once('=').ok_or_else(|| {
                format!("{asm}: cannot parse symbols line `{line}`")
            })?;
            symbols.push((
                name.trim().to_string(),
                parse_0x_number(value.trim()).ok_or_else(|| {
                    format!("{asm}: cannot parse symbol value `{line}`")
                })?,
            ));
        } else if origin.is_none() && line.starts_with("origin ") {
            let value = line.split_once('=').map(|(_, value)| value.trim());
            origin = value.and_then(parse_0x_number);
        }
    }
    match origin {
        Some(origin) => Ok((origin, symbols)),
        None => Err(format!("{asm}: assembler output has no origin")),
    }
}

/// Mechanical branch/call targets (`LC348`, `LF000`, …) are not landmarks.
fn is_auto_label(name: &str) -> bool {
    name.len() == 5
        && name.starts_with('L')
        && name[1..].chars().all(|cell| cell.is_ascii_hexdigit())
}

/// Labels heading data emit blocks are tables, everything else is a routine.
fn infer_kind(source: &str, name: &str) -> String {
    let lines: Vec<&str> = source.lines().collect();
    for (index, line) in lines.iter().enumerate() {
        let code = line.split(';').next().unwrap_or("").trim();
        if code == format!("{name}:") {
            for next in &lines[index + 1..] {
                let next = next.split(';').next().unwrap_or("").trim();
                if next.is_empty() {
                    continue;
                }
                let head = next.split_whitespace().next().unwrap_or("");
                if ["DB", "DEFB", "DW", "DEFW", "DS", "DEFS"]
                    .contains(&head.to_ascii_uppercase().as_str())
                {
                    return "table".to_string();
                }
                return "routine".to_string();
            }
        }
    }
    "routine".to_string()
}

/// Merges generated labels with the curated prose of the previous database.
/// New labels become low-confidence stubs; vanished entries are dropped.
fn merge_database(previous: &str, mut labels: Vec<AsmLabel>) -> Result<String, String> {
    let mut document: serde_json::Value =
        serde_json::from_str(previous).map_err(|err| format!("symbols JSON is invalid: {err}"))?;
    let previous_symbols = document
        .get("symbols")
        .and_then(|symbols| symbols.as_array())
        .ok_or_else(|| "symbols JSON has no symbols array".to_string())?;
    let mut curated: BTreeMap<(String, u16), serde_json::Value> = BTreeMap::new();
    for symbol in previous_symbols {
        let bank = symbol
            .get("bank")
            .and_then(|bank| bank.as_str())
            .ok_or_else(|| "a symbol has no bank".to_string())?;
        let offset = symbol
            .get("offset")
            .and_then(|offset| offset.as_str())
            .and_then(parse_0x_number)
            .ok_or_else(|| "a symbol has an invalid offset".to_string())?;
        curated.insert((bank.to_string(), offset), symbol.clone());
    }
    labels.sort_by(|left, right| {
        (bank_order(&left.bank), left.offset, &left.name)
            .cmp(&(bank_order(&right.bank), right.offset, &right.name))
    });
    // Stacked labels share one physical key; the database holds one entry
    // per key with the extra spellings grouped as `alt_names`.
    let mut groups: Vec<((String, u16), Vec<&AsmLabel>)> = Vec::new();
    for label in &labels {
        let key = (label.bank.clone(), label.offset);
        if let Some((last_key, group)) = groups.last_mut()
            && *last_key == key
        {
            group.push(label);
        } else {
            groups.push((key, vec![label]));
        }
    }
    let mut symbols = Vec::new();
    let mut preserved = 0;
    let mut added = 0;
    for (key, group) in &groups {
        if let Some(existing) = curated.get(key).cloned() {
            preserved += 1;
            symbols.push(refresh_entry(existing, group));
        } else {
            added += 1;
            symbols.push(stub_entry(group));
        }
    }
    let dropped: Vec<String> = curated
        .keys()
        .filter(|key| !groups.iter().any(|(group_key, _)| group_key == *key))
        .filter_map(|key| curated.get(key))
        .filter_map(|symbol| symbol.get("name").and_then(|name| name.as_str()))
        .map(str::to_string)
        .collect();
    for (key, group) in &groups {
        if group.len() > 1 {
            let names: Vec<&str> = group.iter().map(|label| label.name.as_str()).collect();
            println!(
                "note: grouping {} at {} offset {:04X}",
                names.join(", "),
                key.0,
                key.1
            );
        }
    }
    for name in &dropped {
        println!("warning: {name} vanished from the listings; dropped");
    }
    document["symbols"] = serde_json::Value::Array(symbols);
    document["schema_version"] = serde_json::Value::from(2);
    document["status"] = serde_json::Value::from(
        "generated by `cargo xtask rom-symbols` from the standalone listings; curated prose merged by (bank, offset)",
    );
    println!("symbols: {preserved} preserved, {added} new stubs, {} dropped", dropped.len());
    let mut output = serde_json::to_string_pretty(&document)
        .map_err(|err| format!("failed to serialize symbols JSON: {err}"))?;
    output.push('\n');
    Ok(output)
}

/// Keeps curated prose, refreshes the generated identity fields.
/// The object is rebuilt key by key because `Map::remove` is a swap-remove
/// and would teleport the last field into the alias slot.
fn refresh_entry(existing: serde_json::Value, group: &[&AsmLabel]) -> serde_json::Value {
    let first = group[0];
    let object = existing.as_object().cloned().unwrap_or_default();
    for (field, current, generated) in [
        (
            "address",
            object.get("address").and_then(|value| value.as_str()),
            format!("0x{:04X}", first.address),
        ),
        (
            "offset",
            object.get("offset").and_then(|value| value.as_str()),
            format!("0x{:04X}", first.offset),
        ),
    ] {
        if current != Some(generated.as_str()) {
            println!(
                "warning: {} now assembles to {field} {} (was {})",
                first.name,
                generated,
                current.unwrap_or("?")
            );
        }
    }
    let names: Vec<&str> = group.iter().map(|label| label.name.as_str()).collect();
    let previous = object.get("name").and_then(|value| value.as_str());
    let primary = match previous {
        Some(previous) if names.contains(&previous) => previous.to_string(),
        _ => {
            if let Some(previous) = previous {
                println!(
                    "warning: {} renamed (was {previous}); ASM owns names now",
                    first.name
                );
            }
            first.name.clone()
        }
    };
    let mut refreshed = serde_json::Map::with_capacity(object.len() + 1);
    refreshed.insert("bank".to_string(), serde_json::Value::from(first.bank.clone()));
    refreshed.insert(
        "address".to_string(),
        serde_json::Value::from(format!("0x{:04X}", first.address)),
    );
    refreshed.insert(
        "offset".to_string(),
        serde_json::Value::from(format!("0x{:04X}", first.offset)),
    );
    refreshed.insert("name".to_string(), serde_json::Value::from(primary.clone()));
    refreshed.insert(
        "alt_names".to_string(),
        serde_json::Value::Array(
            names
                .iter()
                .filter(|name| **name != primary)
                .map(|name| serde_json::Value::from(name.to_string()))
                .collect(),
        ),
    );
    for (key, value) in &object {
        if !["bank", "address", "offset", "name", "aliases", "alt_names"].contains(&key.as_str()) {
            refreshed.insert(key.clone(), value.clone());
        }
    }
    serde_json::Value::Object(refreshed)
}

fn stub_entry(group: &[&AsmLabel]) -> serde_json::Value {
    let first = group[0];
    serde_json::json!({
        "bank": first.bank,
        "address": format!("0x{:04X}", first.address),
        "offset": format!("0x{:04X}", first.offset),
        "name": first.name,
        "alt_names": group[1..].iter().map(|label| label.name.clone()).collect::<Vec<_>>(),
        "kind": first.kind,
        "usage": [],
        "call_type": "internal",
        "summary": "",
        "input": "",
        "output": "",
        "effects": "",
        "tags": [],
        "sources": ["ASM"],
        "confidence": "low",
    })
}

fn bank_order(bank: &str) -> u8 {
    match bank {
        "sys" => 0,
        "exth" => 1,
        _ => 2,
    }
}

/// `1A2BH`-style Z80 hex.
fn parse_h_number(text: &str) -> Option<u16> {
    text.strip_suffix(['H', 'h'])
        .and_then(|digits| u16::from_str_radix(digits, 16).ok())
}

/// `0x1A2B`-style JSON hex.
fn parse_0x_number(text: &str) -> Option<u16> {
    text.strip_prefix("0x")
        .or_else(|| text.strip_prefix("0X"))
        .and_then(|digits| u16::from_str_radix(digits, 16).ok())
}
