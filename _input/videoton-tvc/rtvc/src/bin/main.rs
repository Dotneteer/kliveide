use eframe::egui::ViewportBuilder;
use rtvc_core::{app_state, emu, ui};

const APP_ICON_PNG: &[u8] = include_bytes!("../../assets/rtvc-app-icon.png");

fn main() -> eframe::Result<()> {
    let app_state_file = app_state::AppStateFile::load();
    let machine_type = app_state_file
        .state
        .machine_type
        .unwrap_or_else(|| emu::MachineType::all_types()[0]);
    let mut emu = emu::Emu::new(machine_type);
    if let Some(vid_model) = app_state_file.state.vid_model {
        emu.set_vid_model(vid_model);
    }
    emu.set_fast_boot(app_state_file.state.fast_boot);
    emu.load_roms();
    // Command-line arguments parsing
    let args = std::env::args().collect::<Vec<String>>();
    let mut disks_to_mount: Vec<String> = Vec::new();
    let mut tape_to_mount: Option<String> = None;
    let mut tape_to_inject: Option<String> = None;
    let mut snapshot_to_load: Option<String> = None;
    let mut headless = false;
    let mut port = 8080u16;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "-d" | "--disk" => {
                if i + 1 < args.len() {
                    if disks_to_mount.len() < 2 {
                        disks_to_mount.push(args[i + 1].clone());
                    } else {
                        eprintln!("Error: at most two -d/--disk arguments are supported");
                        std::process::exit(1);
                    }
                    i += 2;
                } else {
                    eprintln!("Error: missing value for {}", args[i]);
                    std::process::exit(1);
                }
            }
            "-t" | "--tape" => {
                if i + 1 < args.len() {
                    tape_to_mount = Some(args[i + 1].clone());
                    i += 2;
                } else {
                    eprintln!("Error: missing value for {}", args[i]);
                    std::process::exit(1);
                }
            }
            "-i" | "--inject" => {
                if i + 1 < args.len() {
                    tape_to_inject = Some(args[i + 1].clone());
                    i += 2;
                } else {
                    eprintln!("Error: missing value for {}", args[i]);
                    std::process::exit(1);
                }
            }
            "-H" | "--headless" => {
                headless = true;
                i += 1;
            }
            "-p" | "--port" => {
                if i + 1 < args.len() {
                    if let Ok(p) = args[i + 1].parse::<u16>() {
                        port = p;
                    } else {
                        eprintln!("Error: invalid port value: {}", args[i + 1]);
                        std::process::exit(1);
                    }
                    i += 2;
                } else {
                    eprintln!("Error: missing value for {}", args[i]);
                    std::process::exit(1);
                }
            }
            "-h" | "--help" => {
                println!("rtvc v{} - Z80 Emulator", env!("CARGO_PKG_VERSION"));
                println!();
                println!("Usage: rtvc [options] [snapshot.rtvcsnap.zip|game.z80]");
                println!();
                println!("Options:");
                println!("  -d, --disk <path>      Mount a disk (first = A:, second = B:)");
                println!("  -t, --tape <path>      Mount a CAS tape for loading");
                println!("  -i, --inject <path>    Inject a CAS tape directly into memory");
                println!("  -H, --headless         Enable headless execution mode");
                println!(
                    "  -p, --port <port>      TCP port for the debugger socket (default: 8080)"
                );
                println!("  -h, --help             Display this help message");
                std::process::exit(0);
            }
            arg => {
                if arg.starts_with('-') {
                    eprintln!("Error: unknown option {}", arg);
                    std::process::exit(1);
                } else if snapshot_to_load.is_none() {
                    snapshot_to_load = Some(arg.to_string());
                    i += 1;
                } else {
                    eprintln!("Error: multiple positional arguments (only one snapshot allowed)");
                    std::process::exit(1);
                }
            }
        }
    }

    let mut loaded_snapshot = false;
    if let Some(snapshot_path) = snapshot_to_load {
        let snapshot_path = std::path::PathBuf::from(snapshot_path);
        if let Err(err) = emu.load_snapshot_file(&snapshot_path) {
            eprintln!("failed to load snapshot {}: {err}", snapshot_path.display());
        } else {
            loaded_snapshot = true;
        }
    }

    for (drive, disk_path) in disks_to_mount.iter().enumerate() {
        let path = std::path::PathBuf::from(disk_path);
        if let Err(err) = emu.insert_disk_file_path_drive(drive, &path) {
            eprintln!("failed to mount disk {}: {err}", path.display());
        }
    }
    if let Some(tape_path) = tape_to_mount {
        let path = std::path::PathBuf::from(tape_path);
        if let Err(err) = emu.play_tape_file_path(&path) {
            eprintln!("failed to mount tape {}: {err}", path.display());
        }
    }
    if let Some(tape_path) = tape_to_inject {
        let path = std::path::PathBuf::from(tape_path);
        if let Err(err) = emu.inject_tape_file_path(&path) {
            eprintln!("failed to inject tape {}: {err}", path.display());
        }
    }

    if !loaded_snapshot {
        if emu.loaded_disk[0].is_none() && app_state_file.state.disk_loaded {
            if let Some(file_name) = &app_state_file.state.disk_file_name {
                emu.insert_disk_by_file_name(file_name);
            }
        }
        if emu.loaded_tape.is_none() && app_state_file.state.tape_loaded {
            if let Some(file_name) = &app_state_file.state.tape_file_name {
                emu.inject_tape_by_file_name(file_name);
            }
        }
    }
    if headless {
        if let Err(err) = rtvc_core::debugger::run_headless(emu, port) {
            eprintln!("Error: failed to bind debugger port {port}: {err}");
            std::process::exit(1);
        }
        return Ok(());
    }

    let debugger = match rtvc_core::debugger::start_debugger_server(port) {
        Ok(debugger) => Some(debugger),
        Err(err) => {
            eprintln!("Error: failed to bind debugger port {port}: {err}");
            std::process::exit(1);
        }
    };
    let app = ui::EmuApp::new(emu, app_state_file, debugger);
    let app_icon =
        eframe::icon_data::from_png_bytes(APP_ICON_PNG).expect("invalid embedded RTVC app icon");

    let options = eframe::NativeOptions {
        viewport: ViewportBuilder::default()
            .with_inner_size([800.0, 600.0])
            .with_resizable(true)
            .with_icon(app_icon)
            .with_title(format!(
                "rtvc v{} - Z80 Emulator",
                env!("CARGO_PKG_VERSION")
            )),
        ..Default::default()
    };

    eframe::run_native("rtvc", options, Box::new(|_cc| Ok(Box::new(app))))
}
