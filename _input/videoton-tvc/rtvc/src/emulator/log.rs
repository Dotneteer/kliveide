#![allow(dead_code)]

const MAX_ENTRIES: usize = 200;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LogCategory {
    Sound,
    Video,
    Tape,
    Disk,
    Other,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LogEntry {
    pub category: LogCategory,
    pub message: String,
}

impl std::ops::Deref for LogEntry {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.message
    }
}

impl PartialEq<&str> for LogEntry {
    fn eq(&self, other: &&str) -> bool {
        self.message == *other
    }
}

impl std::fmt::Display for LogEntry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.message.fmt(f)
    }
}

pub trait Logger {
    fn log(&mut self, msg: &str);
    fn log_with_category(&mut self, category: LogCategory, msg: &str);
}

pub struct Log {
    pub entries: Vec<LogEntry>,
}

impl Log {
    pub fn new() -> Self {
        Log {
            entries: Vec::with_capacity(MAX_ENTRIES),
        }
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }
}

impl Logger for Log {
    fn log(&mut self, msg: &str) {
        self.log_with_category(LogCategory::Other, msg);
    }

    fn log_with_category(&mut self, category: LogCategory, msg: &str) {
        if self.entries.len() >= MAX_ENTRIES {
            self.entries.remove(0);
        }
        self.entries.push(LogEntry {
            category,
            message: msg.to_string(),
        });
    }
}
