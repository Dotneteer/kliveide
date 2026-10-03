#![allow(dead_code)]

use std::fmt;

pub const MAGIC: &[u8; 8] = b"RTVCSNAP";
pub const VERSION: u16 = 2;

#[derive(Debug)]
pub enum SnapshotError {
    InvalidMagic,
    UnsupportedVersion(u16),
    UnexpectedEof,
    InvalidChunk(&'static str),
    InvalidData(String),
}

impl fmt::Display for SnapshotError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SnapshotError::InvalidMagic => write!(f, "invalid snapshot magic"),
            SnapshotError::UnsupportedVersion(version) => {
                write!(f, "unsupported snapshot version {version}")
            }
            SnapshotError::UnexpectedEof => write!(f, "unexpected end of snapshot"),
            SnapshotError::InvalidChunk(chunk) => write!(f, "invalid snapshot chunk {chunk}"),
            SnapshotError::InvalidData(msg) => write!(f, "invalid snapshot data: {msg}"),
        }
    }
}

impl std::error::Error for SnapshotError {}

pub type Result<T> = std::result::Result<T, SnapshotError>;

pub struct Writer {
    data: Vec<u8>,
}

impl Writer {
    pub fn new() -> Self {
        Writer { data: Vec::new() }
    }

    pub fn into_inner(self) -> Vec<u8> {
        self.data
    }

    pub fn u8(&mut self, value: u8) {
        self.data.push(value);
    }

    pub fn u16(&mut self, value: u16) {
        self.data.extend_from_slice(&value.to_le_bytes());
    }

    pub fn u32(&mut self, value: u32) {
        self.data.extend_from_slice(&value.to_le_bytes());
    }

    pub fn u64(&mut self, value: u64) {
        self.data.extend_from_slice(&value.to_le_bytes());
    }

    pub fn i32(&mut self, value: i32) {
        self.data.extend_from_slice(&value.to_le_bytes());
    }

    pub fn usize(&mut self, value: usize) {
        self.u64(value as u64);
    }

    pub fn bytes(&mut self, value: &[u8]) {
        self.u32(value.len() as u32);
        self.data.extend_from_slice(value);
    }

    pub fn raw_bytes(&mut self, value: &[u8]) {
        self.data.extend_from_slice(value);
    }

    pub fn string(&mut self, value: &str) {
        self.bytes(value.as_bytes());
    }
}

pub struct Reader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Reader { data, pos: 0 }
    }

    pub fn is_empty(&self) -> bool {
        self.pos >= self.data.len()
    }

    pub fn remaining(&self) -> usize {
        self.data.len().saturating_sub(self.pos)
    }

    pub fn u8(&mut self) -> Result<u8> {
        Ok(self.take(1)?[0])
    }

    pub fn u16(&mut self) -> Result<u16> {
        let bytes = self.take(2)?;
        Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
    }

    pub fn u32(&mut self) -> Result<u32> {
        let bytes = self.take(4)?;
        Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    pub fn u64(&mut self) -> Result<u64> {
        let bytes = self.take(8)?;
        Ok(u64::from_le_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        ]))
    }

    pub fn i32(&mut self) -> Result<i32> {
        let bytes = self.take(4)?;
        Ok(i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    pub fn usize(&mut self) -> Result<usize> {
        Ok(self.u64()? as usize)
    }

    pub fn bytes(&mut self) -> Result<&'a [u8]> {
        let len = self.u32()? as usize;
        self.take(len)
    }

    pub fn string(&mut self) -> Result<String> {
        let bytes = self.bytes()?;
        String::from_utf8(bytes.to_vec())
            .map_err(|_| SnapshotError::InvalidData("invalid utf-8 string".to_string()))
    }

    pub fn raw_bytes(&mut self, len: usize) -> Result<&'a [u8]> {
        self.take(len)
    }

    fn take(&mut self, len: usize) -> Result<&'a [u8]> {
        let end = self
            .pos
            .checked_add(len)
            .ok_or(SnapshotError::UnexpectedEof)?;
        if end > self.data.len() {
            return Err(SnapshotError::UnexpectedEof);
        }
        let bytes = &self.data[self.pos..end];
        self.pos = end;
        Ok(bytes)
    }
}

pub struct Chunk<'a> {
    pub id: [u8; 4],
    pub data: &'a [u8],
}

pub fn write_file(chunks: &[([u8; 4], Vec<u8>)]) -> Vec<u8> {
    let mut out = Writer::new();
    out.raw_bytes(MAGIC);
    out.u16(VERSION);
    for (id, data) in chunks {
        out.raw_bytes(id);
        out.u32(data.len() as u32);
        out.raw_bytes(data);
    }
    out.into_inner()
}

pub fn read_file(data: &[u8]) -> Result<Vec<Chunk<'_>>> {
    let mut reader = Reader::new(data);
    if reader.raw_bytes(MAGIC.len())? != MAGIC {
        return Err(SnapshotError::InvalidMagic);
    }
    let version = reader.u16()?;
    if version != VERSION {
        return Err(SnapshotError::UnsupportedVersion(version));
    }

    let mut chunks = Vec::new();
    while !reader.is_empty() {
        let id = reader.raw_bytes(4)?;
        let len = reader.u32()? as usize;
        let data = reader.raw_bytes(len)?;
        chunks.push(Chunk {
            id: [id[0], id[1], id[2], id[3]],
            data,
        });
    }
    Ok(chunks)
}
