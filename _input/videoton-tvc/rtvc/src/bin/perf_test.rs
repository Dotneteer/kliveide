use std::time::Instant;

use rtvc_core::bus::{CpuBus, FakeBus};
use rtvc_core::z80::Z80;

struct BenchGroup {
    name: &'static str,
    bytes: &'static [u8],
    t_states: u32,
}

const PROG_ADDR: u16 = 0x0100;
const TARGET_T: u64 = 2_000_000;
const BATCH: usize = 20_000;

const GROUPS: &[BenchGroup] = &[
    BenchGroup {
        name: "nop",
        bytes: &[0x00],
        t_states: 4,
    },
    BenchGroup {
        name: "ld_rr",
        bytes: &[0x78],
        t_states: 4,
    },
    BenchGroup {
        name: "ld_r_n",
        bytes: &[0x3E, 0x12],
        t_states: 7,
    },
    BenchGroup {
        name: "alu_add_r",
        bytes: &[0x80],
        t_states: 4,
    },
    BenchGroup {
        name: "alu_add_n",
        bytes: &[0xC6, 0x12],
        t_states: 7,
    },
    BenchGroup {
        name: "alu_sub_r",
        bytes: &[0x90],
        t_states: 4,
    },
    BenchGroup {
        name: "alu_and_r",
        bytes: &[0xA0],
        t_states: 4,
    },
    BenchGroup {
        name: "alu_xor_r",
        bytes: &[0xA8],
        t_states: 4,
    },
    BenchGroup {
        name: "alu_or_r",
        bytes: &[0xB0],
        t_states: 4,
    },
    BenchGroup {
        name: "alu_cp_r",
        bytes: &[0xB8],
        t_states: 4,
    },
    BenchGroup {
        name: "inc_r",
        bytes: &[0x04],
        t_states: 4,
    },
    BenchGroup {
        name: "dec_r",
        bytes: &[0x05],
        t_states: 4,
    },
    BenchGroup {
        name: "ld16_nn",
        bytes: &[0x01, 0x34, 0x12],
        t_states: 10,
    },
    BenchGroup {
        name: "inc16",
        bytes: &[0x03],
        t_states: 6,
    },
    BenchGroup {
        name: "dec16",
        bytes: &[0x0B],
        t_states: 6,
    },
    BenchGroup {
        name: "add16",
        bytes: &[0x09],
        t_states: 11,
    },
    BenchGroup {
        name: "push_pop",
        bytes: &[0xC5, 0xC1],
        t_states: 21,
    },
    BenchGroup {
        name: "push_pop_ix",
        bytes: &[0xDD, 0xE5, 0xDD, 0xE1],
        t_states: 29,
    },
    BenchGroup {
        name: "ld_r_mem",
        bytes: &[0x7E],
        t_states: 7,
    },
    BenchGroup {
        name: "ld_mem_r",
        bytes: &[0x77],
        t_states: 7,
    },
    BenchGroup {
        name: "cb_rlc",
        bytes: &[0xCB, 0x00],
        t_states: 8,
    },
    BenchGroup {
        name: "cb_rrc",
        bytes: &[0xCB, 0x08],
        t_states: 8,
    },
    BenchGroup {
        name: "cb_sla",
        bytes: &[0xCB, 0x20],
        t_states: 8,
    },
    BenchGroup {
        name: "cb_sra",
        bytes: &[0xCB, 0x28],
        t_states: 8,
    },
    BenchGroup {
        name: "cb_srl",
        bytes: &[0xCB, 0x38],
        t_states: 8,
    },
    BenchGroup {
        name: "cb_bit",
        bytes: &[0xCB, 0x40],
        t_states: 8,
    },
    BenchGroup {
        name: "cb_set",
        bytes: &[0xCB, 0xC0],
        t_states: 8,
    },
    BenchGroup {
        name: "cb_res",
        bytes: &[0xCB, 0x80],
        t_states: 8,
    },
    BenchGroup {
        name: "ed_ldi",
        bytes: &[0xED, 0xA0],
        t_states: 16,
    },
    BenchGroup {
        name: "ed_cpi",
        bytes: &[0xED, 0xA1],
        t_states: 16,
    },
    BenchGroup {
        name: "ed_ini",
        bytes: &[0xED, 0xA2],
        t_states: 16,
    },
    BenchGroup {
        name: "ed_ld_a_i",
        bytes: &[0xED, 0x57],
        t_states: 9,
    },
    BenchGroup {
        name: "ed_ld_i_a",
        bytes: &[0xED, 0x47],
        t_states: 9,
    },
    BenchGroup {
        name: "ed_rrd",
        bytes: &[0xED, 0x67],
        t_states: 18,
    },
    BenchGroup {
        name: "ed_neg",
        bytes: &[0xED, 0x7C],
        t_states: 8,
    },
    BenchGroup {
        name: "dd_add_ix",
        bytes: &[0xDD, 0x09],
        t_states: 15,
    },
    BenchGroup {
        name: "dd_inc_ix",
        bytes: &[0xDD, 0x23],
        t_states: 10,
    },
    BenchGroup {
        name: "dd_dec_ix",
        bytes: &[0xDD, 0x2B],
        t_states: 10,
    },
    BenchGroup {
        name: "fd_add_iy",
        bytes: &[0xFD, 0x19],
        t_states: 15,
    },
    BenchGroup {
        name: "dd_ld_a_ix",
        bytes: &[0xDD, 0x7E, 0x05],
        t_states: 19,
    },
    BenchGroup {
        name: "dd_ld_ix_a",
        bytes: &[0xDD, 0x77, 0x05],
        t_states: 19,
    },
    BenchGroup {
        name: "dd_inc_mem",
        bytes: &[0xDD, 0x34, 0x05],
        t_states: 23,
    },
    BenchGroup {
        name: "ddcb_bit",
        bytes: &[0xDD, 0xCB, 0xFE, 0x47],
        t_states: 20,
    },
    BenchGroup {
        name: "ddcb_set",
        bytes: &[0xDD, 0xCB, 0xFE, 0xFE],
        t_states: 23,
    },
    BenchGroup {
        name: "fd_ld_a_iy",
        bytes: &[0xFD, 0x7E, 0x05],
        t_states: 19,
    },
];

fn build_program(mmu: &mut FakeBus, inst_bytes: &[u8]) {
    let mut addr = PROG_ADDR;
    for &b in inst_bytes {
        mmu.w8(addr, b);
        addr += 1;
    }
    mmu.w8(addr, 0xC3);
    mmu.w8(addr + 1, 0x00);
    mmu.w8(addr + 2, 0x00);
}

fn set_regs(z80: &mut Z80, reset_pc: bool) {
    if reset_pc {
        z80.set_reg_val("PC", PROG_ADDR);
    }
    z80.set_reg_val("HL", 0x8000);
    z80.set_reg_val("DE", 0x9000);
    z80.set_reg_val("IX", 0x8000);
    z80.set_reg_val("IY", 0x8000);
    z80.set_reg_val("SP", 0xFFFE);
}

fn run_group(z80: &mut Z80, mmu: &mut FakeBus, group: &BenchGroup) -> (u64, f64) {
    let per_iter = group.t_states as u64 + 10;
    let mut remaining = TARGET_T;
    let mut total = 0u64;

    mmu.clear();
    build_program(mmu, group.bytes);

    let start = Instant::now();

    while remaining > 0 {
        let batch_count = BATCH.min((remaining / per_iter) as usize);
        if batch_count == 0 {
            break;
        }

        set_regs(z80, true);

        for _ in 0..batch_count {
            loop {
                let t = z80.step(mmu, 0);
                total += t as u64;
                if z80.get_reg_val("PC") == 0 {
                    break;
                }
            }
        }

        remaining = remaining.saturating_sub(batch_count as u64 * per_iter);
    }

    let elapsed = start.elapsed();
    (total, elapsed.as_secs_f64())
}

fn main() {
    println!("Z80 Instruction Benchmark");
    println!("{:─<80}", "");
    println!(
        "{:20} {:>10} {:>12} {:>14} {:>14}",
        "Group", "T-states", "Time (s)", "MIPS", "MHz"
    );
    println!("{:─<80}", "");

    let mut z80 = Z80::new();
    let mut mmu = FakeBus::new();

    let mut all_tstates = 0u64;
    let mut all_time = 0.0;

    for group in GROUPS {
        let (tstates, secs) = run_group(&mut z80, &mut mmu, group);
        let mips = if secs > 0.0 {
            (tstates as f64) / secs / 1_000_000.0
        } else {
            0.0
        };

        println!(
            "{:20} {:>10} {:>12.6} {:>14.3} {:>14.3}",
            group.name, tstates, secs, mips, mips
        );

        all_tstates += tstates;
        all_time += secs;
    }

    println!("{:─<80}", "");
    let avg = if all_time > 0.0 {
        (all_tstates as f64) / all_time / 1_000_000.0
    } else {
        0.0
    };
    println!(
        "{:20} {:>10} {:>12.6} {:>14.3} {:>14.3}",
        "TOTAL", all_tstates, all_time, avg, avg
    );
}
