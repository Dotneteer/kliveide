use std::fs;

use rtvc_core::bus::{CpuBus, FakeBus};
use rtvc_core::z80::Z80;

fn to_hex16(v: u16) -> String {
    format!("{:04X}", v)
}

fn to_hex8(v: u8) -> String {
    format!("{:02X}", v)
}

fn parse_hex16(s: &str) -> u16 {
    u16::from_str_radix(s.trim(), 16).unwrap_or(0)
}

fn parse_hex8(s: &str) -> u8 {
    u8::from_str_radix(s.trim(), 16).unwrap_or(0)
}

fn strip_leading_number(s: &str) -> String {
    let mut chars = s.chars().peekable();
    // Skip leading whitespace
    while chars.peek().map(|c| c.is_whitespace()).unwrap_or(false) {
        chars.next();
    }
    // Skip digits
    while chars.peek().map(|c| c.is_ascii_digit()).unwrap_or(false) {
        chars.next();
    }
    // Skip whitespace after digits
    while chars.peek().map(|c| c.is_whitespace()).unwrap_or(false) {
        chars.next();
    }
    chars.collect()
}

fn generate_fuse_output(
    descr: &str,
    memlog: &[String],
    z80: &Z80,
    total_runtime: u32,
) -> Vec<String> {
    let mut result = Vec::new();
    result.push(descr.to_string());
    for entry in memlog {
        result.push(format!("    0 {}", entry));
    }

    let regs = vec![
        z80.get_reg_val("AF"),
        z80.get_reg_val("BC"),
        z80.get_reg_val("DE"),
        z80.get_reg_val("HL"),
        z80.get_reg_val("AFa"),
        z80.get_reg_val("BCa"),
        z80.get_reg_val("DEa"),
        z80.get_reg_val("HLa"),
        z80.get_reg_val("IX"),
        z80.get_reg_val("IY"),
        z80.get_reg_val("SP"),
        z80.get_reg_val("PC"),
    ];
    result.push(
        regs.iter()
            .map(|v| to_hex16(*v))
            .collect::<Vec<_>>()
            .join(" "),
    );

    let state = vec![
        to_hex8(z80.get_reg_val("I") as u8),
        to_hex8(z80.get_reg_val("R") as u8),
        z80.get_reg_val("IFF1").to_string(),
        z80.get_reg_val("IFF2").to_string(),
        z80.get_reg_val("im").to_string(),
        z80.get_reg_val("halted").to_string(),
        total_runtime.to_string(),
    ];
    result.push(state.join(" "));

    // Memory writes summary
    let mut mem_writes: Vec<(u16, u8)> = Vec::new();
    for entry in memlog {
        let parts: Vec<&str> = entry.split_whitespace().collect();
        if parts.len() >= 3 && parts[0] == "MW" {
            let addr = u16::from_str_radix(parts[1], 16).unwrap_or(0);
            let val = u8::from_str_radix(parts[2], 16).unwrap_or(0);
            mem_writes.push((addr, val));
        }
    }
    mem_writes.sort_by_key(|(a, _)| *a);
    mem_writes.dedup_by_key(|(a, _)| *a);

    let mut memlog2str = String::new();
    let mut memlog2addr: i32 = -2;
    for (addr, val) in mem_writes {
        let a = addr as i32;
        if a != memlog2addr + 1 {
            if !memlog2str.is_empty() {
                result.push(format!("{} -1", memlog2str));
            }
            memlog2str = format!("{} {}", to_hex16(addr), to_hex8(val));
        } else {
            memlog2str.push_str(&format!(" {}", to_hex8(val)));
        }
        memlog2addr = a;
    }
    if !memlog2str.is_empty() {
        result.push(format!("{} -1", memlog2str));
    }

    result.push("".to_string());
    result
}

fn main() {
    let test_data = fs::read_to_string("tests/tests.in").expect("Failed to read tests.in");
    let test_expected =
        fs::read_to_string("tests/tests.expected").expect("Failed to read tests.expected");

    let mut mmu = FakeBus::new();
    mmu.logging_enabled = true;
    let mut z80 = Z80::new();

    let test_lines: Vec<&str> = test_data.lines().collect();
    let expected_lines: Vec<&str> = test_expected.lines().collect();

    let mut state = 0;
    let mut descr = "";
    let mut run_time: i32 = 0;
    //let mut result_idx = 0;
    let mut expected_idx = 0;
    let mut passed = 0;
    let mut failed = 0;
    let mut first_failures: Vec<String> = Vec::new();

    for line in test_lines {
        let line = line.trim_end();
        match state {
            0 => {
                if line.is_empty() {
                    continue;
                }
                descr = line;
                state = 1;
            }
            1 => {
                let vals: Vec<&str> = line.split_whitespace().collect();
                if vals.len() >= 12 {
                    z80.set_reg_val("AF", parse_hex16(vals[0]));
                    z80.set_reg_val("BC", parse_hex16(vals[1]));
                    z80.set_reg_val("DE", parse_hex16(vals[2]));
                    z80.set_reg_val("HL", parse_hex16(vals[3]));
                    z80.set_reg_val("AFa", parse_hex16(vals[4]));
                    z80.set_reg_val("BCa", parse_hex16(vals[5]));
                    z80.set_reg_val("DEa", parse_hex16(vals[6]));
                    z80.set_reg_val("HLa", parse_hex16(vals[7]));
                    z80.set_reg_val("IX", parse_hex16(vals[8]));
                    z80.set_reg_val("IY", parse_hex16(vals[9]));
                    z80.set_reg_val("SP", parse_hex16(vals[10]));
                    z80.set_reg_val("PC", parse_hex16(vals[11]));
                }
                state = 2;
            }
            2 => {
                let vals: Vec<&str> = line.split_whitespace().filter(|s| !s.is_empty()).collect();
                if vals.len() >= 7 {
                    z80.set_reg_val("I", parse_hex8(vals[0]) as u16);
                    z80.set_reg_val("R", parse_hex8(vals[1]) as u16);
                    z80.set_reg_val("IFF1", parse_hex8(vals[2]) as u16);
                    z80.set_reg_val("IFF2", parse_hex8(vals[3]) as u16);
                    z80.set_reg_val("im", parse_hex8(vals[4]) as u16);
                    z80.set_reg_val("halted", parse_hex8(vals[5]) as u16);
                    // Parse runtime - it's decimal in the file
                    run_time = vals[6].parse::<i32>().unwrap_or(0);
                }
                state = 3;
            }
            3 => {
                let vals: Vec<&str> = line.split_whitespace().collect();
                if vals.is_empty() || vals[0] == "-1" {
                    state = 4;
                    continue;
                }
                let mut addr = parse_hex16(vals[0]);
                for i in 1..vals.len() {
                    if vals[i] == "-1" {
                        break;
                    }
                    let v = parse_hex8(vals[i]);
                    mmu.w8(addr, v);
                    addr = addr.wrapping_add(1);
                }
            }
            _ => {}
        }

        if state == 4 {
            // Execute
            mmu.log.clear();
            let mut total_runtime = 0u32;
            let mut remaining = run_time;
            while remaining > 0 {
                let step_time = z80.step(&mut mmu, remaining);
                remaining -= step_time as i32;
                total_runtime += step_time;
            }

            let result = generate_fuse_output(descr, &mmu.log, &z80, total_runtime);

            // Compare with expected
            let exp_start = expected_idx;
            let mut local_pass = true;
            let mut res_idx = 0;

            while expected_idx < expected_lines.len() && !expected_lines[expected_idx].is_empty() {
                let exp_line = expected_lines[expected_idx].to_uppercase();
                if res_idx >= result.len() {
                    local_pass = false;
                    break;
                }
                let res_line = result[res_idx].to_uppercase();

                // Ignore contention lines in expected
                if exp_line.contains(" MC ") || exp_line.contains(" PC ") {
                    expected_idx += 1;
                    continue;
                }

                // Strip leading cycle numbers for comparison
                if exp_line.starts_with("  ") {
                    let exp_stripped = strip_leading_number(&exp_line);
                    let res_stripped = strip_leading_number(&res_line);
                    if exp_stripped.trim() != res_stripped.trim() {
                        local_pass = false;
                    }
                } else {
                    if exp_line.trim() != res_line.trim() {
                        local_pass = false;
                    }
                }

                expected_idx += 1;
                res_idx += 1;
            }

            // Skip empty line in expected
            if expected_idx < expected_lines.len() && expected_lines[expected_idx].is_empty() {
                expected_idx += 1;
            }

            if local_pass {
                passed += 1;
                println!("{} ......... OK", descr);
            } else {
                failed += 1;
                if first_failures.len() < 5 {
                    let mut fail_msg = format!("FAIL: {}\n", descr);
                    fail_msg.push_str("Expected (from expected file):\n");
                    let mut ei = exp_start;
                    while ei < expected_lines.len() && !expected_lines[ei].is_empty() {
                        if !expected_lines[ei].contains("MC") && !expected_lines[ei].contains("PC")
                        {
                            fail_msg.push_str(&format!("{}\n", expected_lines[ei]));
                        }
                        ei += 1;
                    }
                    fail_msg.push_str("Got:\n");
                    for r in &result {
                        fail_msg.push_str(&format!("{}\n", r));
                    }
                    first_failures.push(fail_msg);
                }
                println!("{} ......... FAIL", descr);
            }

            // Reset for next test
            mmu.clear();
            state = 0;
        }
    }

    println!("\n========================================");
    println!("Passed: {}", passed);
    println!("Failed: {}", failed);

    for f in &first_failures {
        println!("\n{}", f);
    }
}
