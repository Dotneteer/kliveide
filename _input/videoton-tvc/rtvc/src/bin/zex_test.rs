use std::fs;
use std::io::{self, Write};

use rtvc_core::bus::{CpuBus, FakeBus};
use rtvc_core::z80::Z80;

fn run_zex(file_path: &str, skip_cnt: u16) -> Result<(), Box<dyn std::error::Error>> {
    println!("--- Running ZEX test: {} ---", file_path);
    let mut fakemmu = FakeBus::new();

    let test_data = fs::read(file_path)?;
    // 0x0100 = start address
    for (i, &byte) in test_data.iter().enumerate() {
        fakemmu.w8(0x0100 + i as u16, byte);
    }

    // stack address
    fakemmu.w8(6, 0xE4);
    fakemmu.w8(7, 0x00);
    // first test address
    fakemmu.w8(0x0120, (0x3A + 2 * skip_cnt) as u8);

    let mut z80 = Z80::new();
    z80.set_reg_val("PC", 0x0100);

    let mut io_out = io::stdout();

    loop {
        z80.step(&mut fakemmu, 0);
        let pc = z80.get_reg_val("PC");

        // 0 = soft reset
        if pc == 0 {
            break;
        }
        // 5 = system call
        else if pc == 5 {
            let c = z80.get_reg_val("C");
            if c == 2 {
                let e = z80.get_reg_val("E") as u8;
                io_out.write_all(&[e])?;
                io_out.flush()?;
            } else if c == 9 {
                let mut txt_addr = z80.get_reg_val("DE");
                let mut txt_str = Vec::new();
                loop {
                    let txt_chr = fakemmu.r8(txt_addr);
                    if txt_chr == b'$' {
                        break;
                    }
                    txt_str.push(txt_chr);
                    txt_addr = txt_addr.wrapping_add(1);
                }
                io_out.write_all(&txt_str)?;
                io_out.flush()?;

                // If output contains ERROR, we should stop
                if let Ok(s) = std::str::from_utf8(&txt_str) {
                    if s.contains("ERROR") {
                        println!("\nTest failed with error.");
                        std::process::exit(1);
                    }
                }
            }
            let ret_addr = z80.pop16(&mut fakemmu);
            z80.set_reg_val("PC", ret_addr);
        }
    }
    println!("\n--- Completed: {} ---\n", file_path);
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let cmd = args.next();

    match cmd.as_deref() {
        Some("zexdoc") => {
            run_zex("tests/zexdoc.com", 0)?;
        }
        Some("zexall") => {
            run_zex("tests/zexall.com", 0)?;
        }
        _ => {
            // By default, run both
            run_zex("tests/zexdoc.com", 0)?;
            run_zex("tests/zexall.com", 0)?;
        }
    }

    Ok(())
}
