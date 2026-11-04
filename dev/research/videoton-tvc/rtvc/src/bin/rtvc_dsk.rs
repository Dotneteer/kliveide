use fatfs::{FileSystem, FormatVolumeOptions, FsOptions};
use std::env;
use std::fs::OpenOptions;
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::process;

const BOOT_SECTOR_LEN: usize = 512;
const BOOT_SIGNATURE_OFFSET: u64 = 510;
const TOTAL_SECTORS_32_OFFSET: u64 = 32;
const TVC_360K_DISK_BYTES: u64 = 368_640;
const TVC_720K_DISK_BYTES: u64 = 737_280;

#[derive(Clone, Copy)]
struct DiskGeometry {
    label: &'static str,
    bytes: u64,
    total_sectors: u32,
    heads: u16,
    media: u8,
}

impl DiskGeometry {
    const TVC_360K: Self = Self {
        label: "360K",
        bytes: TVC_360K_DISK_BYTES,
        total_sectors: 720,
        heads: 1,
        media: 0xf8,
    };

    const TVC_720K: Self = Self {
        label: "720K",
        bytes: TVC_720K_DISK_BYTES,
        total_sectors: 1440,
        heads: 2,
        media: 0xf9,
    };
}

struct TvcDiskImage<T> {
    inner: T,
    synthesize_boot_signature: bool,
}

impl<T: Read + Write + Seek> TvcDiskImage<T> {
    fn new(mut inner: T) -> io::Result<Self> {
        let mut boot_sector = [0u8; BOOT_SECTOR_LEN];
        inner.seek(SeekFrom::Start(0))?;
        inner.read_exact(&mut boot_sector)?;
        inner.seek(SeekFrom::Start(0))?;

        Ok(Self {
            inner,
            synthesize_boot_signature: should_synthesize_boot_signature(&boot_sector),
        })
    }
}

impl<T: Read + Seek> Read for TvcDiskImage<T> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let pos = self.inner.stream_position()?;
        let read = self.inner.read(buf)?;

        if self.synthesize_boot_signature {
            for (idx, byte) in buf[..read].iter_mut().enumerate() {
                match pos + idx as u64 {
                    TOTAL_SECTORS_32_OFFSET..=35 => *byte = 0,
                    BOOT_SIGNATURE_OFFSET => *byte = 0x55,
                    offset if offset == BOOT_SIGNATURE_OFFSET + 1 => *byte = 0xAA,
                    _ => {}
                }
            }
        }

        Ok(read)
    }
}

impl<T: Write> Write for TvcDiskImage<T> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.inner.write(buf)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

impl<T: Seek> Seek for TvcDiskImage<T> {
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        self.inner.seek(pos)
    }
}

fn should_synthesize_boot_signature(boot_sector: &[u8; BOOT_SECTOR_LEN]) -> bool {
    let has_pc_signature = boot_sector[510] == 0x55 && boot_sector[511] == 0xAA;
    let has_tvc_boot_jump =
        boot_sector[0] == 0xEB && boot_sector[1] == 0xFE && boot_sector[2] == 0x90;
    let bytes_per_sector = u16::from_le_bytes([boot_sector[11], boot_sector[12]]);
    let sectors_per_cluster = boot_sector[13];
    let reserved_sectors = u16::from_le_bytes([boot_sector[14], boot_sector[15]]);
    let fats = boot_sector[16];
    let root_entries = u16::from_le_bytes([boot_sector[17], boot_sector[18]]);
    let total_sectors = u16::from_le_bytes([boot_sector[19], boot_sector[20]]);
    let sectors_per_fat = u16::from_le_bytes([boot_sector[22], boot_sector[23]]);
    let sectors_per_track = u16::from_le_bytes([boot_sector[24], boot_sector[25]]);
    let heads = u16::from_le_bytes([boot_sector[26], boot_sector[27]]);

    !has_pc_signature
        && has_tvc_boot_jump
        && bytes_per_sector == 512
        && sectors_per_cluster.is_power_of_two()
        && sectors_per_cluster != 0
        && reserved_sectors == 1
        && fats == 2
        && root_entries != 0
        && matches!(
            total_sectors as u64 * bytes_per_sector as u64,
            TVC_360K_DISK_BYTES | TVC_720K_DISK_BYTES
        )
        && sectors_per_fat != 0
        && sectors_per_track == 9
        && matches!(heads, 1 | 2)
}

fn print_usage() {
    println!("rtvc-dsk: TVC DOS disk image utility");
    println!("Usage:");
    println!("  rtvc-dsk new <diskfile>          - Create a new, formatted 360K TVC DOS disk");
    println!("  rtvc-dsk new720 <diskfile>       - Create a new, formatted 720K TVC DOS disk");
    println!("  rtvc-dsk format <diskfile>       - Format an existing file as 360K TVC DOS disk");
    println!("  rtvc-dsk format720 <diskfile>    - Format an existing file as 720K TVC DOS disk");
    println!("  rtvc-dsk dir <diskfile:path>     - List directory contents (path defaults to /)");
    println!("  rtvc-dsk cat <diskfile:path>     - Print file contents to stdout");
    println!("  rtvc-dsk get <diskfile:path> [hostfile] - Copy a file out of the disk image");
    println!("  rtvc-dsk put <diskfile:path> <hostfile> - Copy a host file into the disk image");
}

fn parse_target(target: &str) -> (PathBuf, String) {
    // To handle Windows paths like C:\foo.dsk:inner/path we look for the *last* colon,
    // but if it's at index 1 (like C:), we ignore it as a drive letter.
    let colon_idx = target.rfind(':');
    if let Some(idx) = colon_idx {
        if idx == 1 {
            // Probably a drive letter, no inner path
            (target.into(), "/".to_string())
        } else {
            let path = target[..idx].into();
            let mut inner_path = target[idx + 1..].to_string();
            if inner_path.is_empty() {
                inner_path = "/".to_string();
            }
            if !inner_path.starts_with('/') {
                inner_path.insert(0, '/');
            }
            (path, inner_path)
        }
    } else {
        (target.into(), "/".to_string())
    }
}

fn do_format<W: Read + Write + Seek>(mut stream: W, geometry: DiskGeometry) -> std::io::Result<()> {
    let options = FormatVolumeOptions::new()
        .bytes_per_sector(512)
        .bytes_per_cluster(1024)
        .fats(2)
        .max_root_dir_entries(112)
        .total_sectors(geometry.total_sectors)
        .media(geometry.media)
        .sectors_per_track(9)
        .heads(geometry.heads);

    fatfs::format_volume(&mut stream, options)?;

    // TVC VT-DOS bootloader compatibility:
    // VT-DOS rejects the disk if it looks like a standard MS-DOS boot sector
    // where bytes are `EB xx 90` with MSDOS5.0. We patch the boot sector to
    // `EB FE 90` and OEM string `DiskMgr1` which makes VT-DOS accept the disk.
    stream.rewind()?;
    let mut boot_sector = [0u8; 512];
    stream.read_exact(&mut boot_sector)?;

    boot_sector[0] = 0xEB;
    boot_sector[1] = 0xFE; // JMP $-2
    boot_sector[2] = 0x90; // NOP
    boot_sector[3..11].copy_from_slice(b"DiskMgr1");

    stream.rewind()?;
    stream.write_all(&boot_sector)?;

    Ok(())
}

fn open_filesystem(path: &PathBuf) -> io::Result<FileSystem<TvcDiskImage<std::fs::File>>> {
    let file = OpenOptions::new().read(true).write(true).open(path)?;
    let disk = TvcDiskImage::new(file)?;
    FileSystem::new(disk, FsOptions::new())
}

fn read_disk_file(path: &PathBuf, inner_path: &str) -> Vec<u8> {
    let fs = open_filesystem(path).unwrap_or_else(|err| {
        eprintln!("Failed to open filesystem: {err}");
        process::exit(1);
    });
    let root_dir = fs.root_dir();

    if inner_path == "/" {
        eprintln!("Target must be a file inside the disk image");
        process::exit(1);
    }

    let mut f = root_dir.open_file(&inner_path[1..]).unwrap_or_else(|err| {
        eprintln!("Failed to open {inner_path}: {err}");
        process::exit(1);
    });
    let mut buf = Vec::new();
    f.read_to_end(&mut buf).unwrap_or_else(|err| {
        eprintln!("Failed to read {inner_path}: {err}");
        process::exit(1);
    });
    buf
}

fn default_host_path_for_get(inner_path: &str) -> Option<PathBuf> {
    inner_path
        .rsplit('/')
        .find(|part| !part.is_empty())
        .map(PathBuf::from)
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        print_usage();
        process::exit(1);
    }

    let cmd = args[1].as_str();
    let target = &args[2];

    match cmd {
        "new" | "new720" => {
            let geometry = if cmd == "new720" {
                DiskGeometry::TVC_720K
            } else {
                DiskGeometry::TVC_360K
            };
            let path: PathBuf = target.into();
            println!(
                "Creating new empty {} disk at: {}",
                geometry.label,
                path.display()
            );
            let mut file = OpenOptions::new()
                .read(true)
                .write(true)
                .create(true)
                .truncate(true)
                .open(&path)
                .expect("Failed to create file");

            let blank = vec![0u8; geometry.bytes as usize];
            file.write_all(&blank).expect("Failed to write blank data");
            file.rewind().unwrap();

            do_format(&mut file, geometry).expect("Failed to format volume");
            println!("Disk created and formatted successfully.");
        }
        "format" | "format720" => {
            let geometry = if cmd == "format720" {
                DiskGeometry::TVC_720K
            } else {
                DiskGeometry::TVC_360K
            };
            let path: PathBuf = target.into();
            println!(
                "Formatting existing {} disk at: {}",
                geometry.label,
                path.display()
            );
            let mut file = OpenOptions::new()
                .read(true)
                .write(true)
                .open(&path)
                .expect("Failed to open file");

            do_format(&mut file, geometry).expect("Failed to format volume");
            println!("Disk formatted successfully.");
        }
        "dir" => {
            let (path, inner_path) = parse_target(target);
            let fs = open_filesystem(&path).unwrap_or_else(|err| {
                eprintln!("Failed to open filesystem: {err}");
                process::exit(1);
            });
            let root_dir = fs.root_dir();

            // Navigate to inner_path...
            // In fatfs, you can use `root_dir.open_dir(&inner_path)` if it's not root
            let dir = if inner_path == "/" {
                root_dir
            } else {
                root_dir
                    .open_dir(&inner_path[1..])
                    .expect("Failed to open directory")
            };

            for entry in dir.iter() {
                let entry = entry.unwrap();
                println!(
                    "{:12} {:8} {}",
                    entry.file_name(),
                    entry.len(),
                    if entry.is_dir() { "<DIR>" } else { "" }
                );
            }
        }
        "cat" => {
            let (path, inner_path) = parse_target(target);
            let buf = read_disk_file(&path, &inner_path);
            std::io::stdout()
                .write_all(&buf)
                .expect("Failed to write to stdout");
        }
        "get" => {
            let (path, inner_path) = parse_target(target);
            let host_path = if args.len() >= 4 {
                PathBuf::from(&args[3])
            } else {
                default_host_path_for_get(&inner_path).unwrap_or_else(|| {
                    eprintln!("get target must include a file name inside the disk image");
                    process::exit(1);
                })
            };
            let data = read_disk_file(&path, &inner_path);
            std::fs::write(&host_path, &data).unwrap_or_else(|err| {
                eprintln!("Failed to write {}: {err}", host_path.display());
                process::exit(1);
            });
            println!(
                "Copied {} byte(s) from {} to {}",
                data.len(),
                inner_path,
                host_path.display()
            );
        }
        "put" => {
            if args.len() < 4 {
                eprintln!("put requires a host file path");
                print_usage();
                process::exit(1);
            }
            let (path, inner_path) = parse_target(target);
            if inner_path == "/" {
                eprintln!("put target must include a file name inside the disk image");
                process::exit(1);
            }
            let host_path = PathBuf::from(&args[3]);
            let data = std::fs::read(&host_path).unwrap_or_else(|err| {
                eprintln!("Failed to read {}: {err}", host_path.display());
                process::exit(1);
            });

            let fs = open_filesystem(&path).unwrap_or_else(|err| {
                eprintln!("Failed to open filesystem: {err}");
                process::exit(1);
            });
            let root_dir = fs.root_dir();
            let inner_name = &inner_path[1..];
            if root_dir.open_file(inner_name).is_ok() {
                root_dir.remove(inner_name).unwrap_or_else(|err| {
                    eprintln!("Failed to replace {inner_path}: {err}");
                    process::exit(1);
                });
            }
            let mut file = root_dir.create_file(inner_name).unwrap_or_else(|err| {
                eprintln!("Failed to create {inner_path}: {err}");
                process::exit(1);
            });
            file.write_all(&data).unwrap_or_else(|err| {
                eprintln!("Failed to write {inner_path}: {err}");
                process::exit(1);
            });
            println!(
                "Copied {} byte(s) from {} to {}",
                data.len(),
                host_path.display(),
                inner_path
            );
        }
        _ => {
            eprintln!("Unknown command: {}", cmd);
            print_usage();
            process::exit(1);
        }
    }
}

#[cfg(test)]
#[path = "rtvc_dsk_tests.rs"]
mod tests;
