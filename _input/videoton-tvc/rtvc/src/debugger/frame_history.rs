use std::collections::VecDeque;

pub const DEFAULT_HISTORY_SECONDS: u32 = 5;
pub const MIN_HISTORY_SECONDS: u32 = 1;
pub const MAX_HISTORY_SECONDS: u32 = 30;
pub const TVC_FRAMES_PER_SECOND: usize = 50;
const THUMBNAIL_MAX_WIDTH: usize = 160;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum HistoryMode {
    #[default]
    PerFrame,
    LongTerm,
}

impl HistoryMode {
    pub fn label(self) -> &'static str {
        match self {
            Self::PerFrame => "Per frame",
            Self::LongTerm => "Long term",
        }
    }
}

#[derive(Clone)]
pub struct FrameThumbnail {
    pub pixels: Vec<u32>,
    pub width: usize,
    pub height: usize,
}

impl FrameThumbnail {
    pub fn from_framebuffer(pixels: &[u32], width: usize, height: usize) -> Self {
        if width == 0 || height == 0 || pixels.len() < width.saturating_mul(height) {
            return Self {
                pixels: Vec::new(),
                width: 0,
                height: 0,
            };
        }

        let step = width.div_ceil(THUMBNAIL_MAX_WIDTH).max(1);
        let thumbnail_width = width.div_ceil(step);
        let thumbnail_height = height.div_ceil(step);
        let mut thumbnail = Vec::with_capacity(thumbnail_width * thumbnail_height);
        for y in (0..height).step_by(step) {
            for x in (0..width).step_by(step) {
                thumbnail.push(pixels[y * width + x]);
            }
        }
        Self {
            pixels: thumbnail,
            width: thumbnail_width,
            height: thumbnail_height,
        }
    }

    fn byte_len(&self) -> usize {
        self.pixels.len() * std::mem::size_of::<u32>()
    }
}

pub struct FrameRecord {
    pub id: u64,
    pub snapshot: Vec<u8>,
    pub thumbnail: FrameThumbnail,
    pub frame_number: u64,
    pub pc: u16,
}

impl FrameRecord {
    fn byte_len(&self) -> usize {
        self.snapshot.len() + self.thumbnail.byte_len()
    }
}

pub struct FrameHistory {
    frames: VecDeque<FrameRecord>,
    selected: Option<usize>,
    recording: bool,
    duration_seconds: u32,
    mode: HistoryMode,
    next_id: u64,
    next_frame_number: u64,
}

impl Default for FrameHistory {
    fn default() -> Self {
        Self {
            frames: VecDeque::new(),
            selected: None,
            recording: false,
            duration_seconds: DEFAULT_HISTORY_SECONDS,
            mode: HistoryMode::default(),
            next_id: 1,
            next_frame_number: 0,
        }
    }
}

impl FrameHistory {
    pub fn start(&mut self) {
        self.clear();
        self.recording = true;
    }

    pub fn stop(&mut self) {
        self.recording = false;
    }

    pub fn clear(&mut self) {
        self.frames.clear();
        self.selected = None;
        self.next_frame_number = 0;
    }

    pub fn is_recording(&self) -> bool {
        self.recording
    }

    pub fn mode(&self) -> HistoryMode {
        self.mode
    }

    pub fn set_mode(&mut self, mode: HistoryMode) {
        if self.mode != mode {
            self.mode = mode;
            self.clear();
        }
    }

    pub fn duration_seconds(&self) -> u32 {
        self.duration_seconds
    }

    pub fn set_duration_seconds(&mut self, seconds: u32) {
        self.duration_seconds = seconds.clamp(MIN_HISTORY_SECONDS, MAX_HISTORY_SECONDS);
        self.enforce_capacity();
    }

    pub fn capacity(&self) -> usize {
        match self.mode {
            HistoryMode::PerFrame => self.duration_seconds as usize * TVC_FRAMES_PER_SECOND,
            HistoryMode::LongTerm => TVC_FRAMES_PER_SECOND + 9 + 2,
        }
    }

    pub fn len(&self) -> usize {
        self.frames.len()
    }

    pub fn is_empty(&self) -> bool {
        self.frames.is_empty()
    }

    pub fn frames(&self) -> &VecDeque<FrameRecord> {
        &self.frames
    }

    /// Returns thumbnail indices arranged for display, with the newest snapshot
    /// first in every row.
    ///
    /// Per-frame history is divided into one-second rows. Long-term history
    /// separates the three retention resolutions into frames, seconds, and
    /// tens-of-seconds rows.
    pub fn thumbnail_rows(&self) -> Vec<Vec<usize>> {
        let newest = match self.frames.back() {
            Some(frame) => frame.frame_number,
            None => return Vec::new(),
        };
        let newest_first = (0..self.frames.len()).rev();

        match self.mode {
            HistoryMode::PerFrame => newest_first
                .collect::<Vec<_>>()
                .chunks(TVC_FRAMES_PER_SECOND)
                .map(|row| row.to_vec())
                .collect(),
            HistoryMode::LongTerm => {
                let mut frame_row = Vec::new();
                let mut second_row = Vec::new();
                let mut ten_second_row = Vec::new();
                let fps = TVC_FRAMES_PER_SECOND as u64;

                for index in newest_first {
                    let age = newest - self.frames[index].frame_number;
                    if age < fps {
                        frame_row.push(index);
                    } else if age < 10 * fps {
                        second_row.push(index);
                    } else {
                        ten_second_row.push(index);
                    }
                }

                [frame_row, second_row, ten_second_row]
                    .into_iter()
                    .filter(|row| !row.is_empty())
                    .collect()
            }
        }
    }

    pub fn selected_index(&self) -> Option<usize> {
        self.selected
    }

    pub fn selected(&self) -> Option<&FrameRecord> {
        self.selected.and_then(|index| self.frames.get(index))
    }

    pub fn selected_offset(&self) -> Option<isize> {
        self.frame_offset(self.selected?)
    }

    pub fn frame_offset(&self, index: usize) -> Option<isize> {
        let frame = self.frames.get(index)?;
        let newest = self.frames.back()?;
        Some(-((newest.frame_number - frame.frame_number) as isize))
    }

    pub fn memory_bytes(&self) -> usize {
        self.frames.iter().map(FrameRecord::byte_len).sum()
    }

    pub fn record_frame(&mut self, snapshot: Vec<u8>, thumbnail: FrameThumbnail, pc: u16) -> bool {
        if !self.recording {
            return false;
        }

        self.truncate_future();
        let record = FrameRecord {
            id: self.next_id,
            snapshot,
            thumbnail,
            frame_number: self.next_frame_number,
            pc,
        };
        self.next_id = self.next_id.wrapping_add(1);
        self.next_frame_number = self.next_frame_number.wrapping_add(1);
        self.frames.push_back(record);
        self.selected = Some(self.frames.len() - 1);
        self.enforce_capacity();
        true
    }

    pub fn select_previous(&mut self) -> bool {
        let Some(current) = self.selected.or_else(|| self.frames.len().checked_sub(1)) else {
            return false;
        };
        if current == 0 {
            return false;
        }
        self.selected = Some(current - 1);
        true
    }

    pub fn select_next(&mut self) -> bool {
        let Some(current) = self.selected else {
            return false;
        };
        if current + 1 >= self.frames.len() {
            return false;
        }
        self.selected = Some(current + 1);
        true
    }

    pub fn select_latest(&mut self) -> bool {
        let Some(latest) = self.frames.len().checked_sub(1) else {
            return false;
        };
        let changed = self.selected != Some(latest);
        self.selected = Some(latest);
        changed
    }

    pub fn select(&mut self, index: usize) -> bool {
        if index >= self.frames.len() || self.selected == Some(index) {
            return false;
        }
        self.selected = Some(index);
        true
    }

    pub fn branch_from_selected(&mut self) -> bool {
        let old_len = self.frames.len();
        self.truncate_future();
        if !self.frames.is_empty() {
            self.selected = Some(self.frames.len() - 1);
        }
        self.frames.len() != old_len
    }

    fn truncate_future(&mut self) {
        if let Some(selected) = self.selected {
            if selected + 1 < self.frames.len() {
                self.frames.truncate(selected + 1);
                self.next_frame_number = self.frames[selected].frame_number + 1;
            }
        }
    }

    fn enforce_capacity(&mut self) {
        if self.mode == HistoryMode::LongTerm {
            let Some(newest) = self.frames.back().map(|frame| frame.frame_number) else {
                return;
            };
            let selected_id = self.selected().map(|frame| frame.id);
            let fps = TVC_FRAMES_PER_SECOND as u64;
            self.frames.retain(|frame| {
                let age = newest - frame.frame_number;
                age < fps
                    || (age < 10 * fps && frame.frame_number % fps == 0)
                    || (age < 30 * fps && frame.frame_number % (10 * fps) == 0)
            });
            self.selected =
                selected_id.and_then(|id| self.frames.iter().position(|frame| frame.id == id));
            return;
        }
        let excess = self.frames.len().saturating_sub(self.capacity());
        if excess == 0 {
            return;
        }
        self.frames.drain(..excess);
        self.selected = self
            .selected
            .map(|selected| selected.saturating_sub(excess));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(history: &mut FrameHistory, value: u8) {
        assert!(history.record_frame(
            vec![value],
            FrameThumbnail {
                pixels: vec![value as u32],
                width: 1,
                height: 1,
            },
            value as u16,
        ));
    }

    #[test]
    fn recording_is_bounded_and_evicts_oldest_frames() {
        let mut history = FrameHistory::default();
        history.start();
        history.duration_seconds = 1;
        for value in 0..=TVC_FRAMES_PER_SECOND as u8 {
            record(&mut history, value);
        }

        assert_eq!(history.len(), TVC_FRAMES_PER_SECOND);
        assert_eq!(history.frames.front().unwrap().snapshot, vec![1]);
        assert_eq!(history.selected_offset(), Some(0));
    }

    #[test]
    fn clearing_history_keeps_recording_active() {
        let mut history = FrameHistory::default();
        history.start();
        record(&mut history, 1);

        history.clear();

        assert!(history.is_empty());
        assert!(history.is_recording());
        record(&mut history, 2);
        assert_eq!(history.selected().unwrap().snapshot, vec![2]);
    }

    #[test]
    fn navigation_reports_offsets_from_latest_frame() {
        let mut history = FrameHistory::default();
        history.start();
        for value in 0..3 {
            record(&mut history, value);
        }

        assert_eq!(history.selected_offset(), Some(0));
        assert!(history.select_previous());
        assert_eq!(history.selected_offset(), Some(-1));
        assert!(history.select_previous());
        assert_eq!(history.selected_offset(), Some(-2));
        assert!(!history.select_previous());
        assert!(history.select_next());
        assert!(history.select_latest());
        assert_eq!(history.selected_offset(), Some(0));
    }

    #[test]
    fn recording_after_rewind_discards_future_branch() {
        let mut history = FrameHistory::default();
        history.start();
        for value in 0..4 {
            record(&mut history, value);
        }
        assert!(history.select_previous());
        assert!(history.select_previous());

        record(&mut history, 9);

        let values: Vec<u8> = history
            .frames()
            .iter()
            .map(|frame| frame.snapshot[0])
            .collect();
        assert_eq!(values, vec![0, 1, 9]);
        assert_eq!(history.selected_offset(), Some(0));
    }

    #[test]
    fn explicit_branch_discards_future_before_instruction_step() {
        let mut history = FrameHistory::default();
        history.start();
        for value in 0..4 {
            record(&mut history, value);
        }
        assert!(history.select_previous());
        assert!(history.select_previous());

        assert!(history.branch_from_selected());

        assert_eq!(history.len(), 2);
        assert_eq!(history.selected_offset(), Some(0));
        assert_eq!(history.selected().unwrap().snapshot, vec![1]);
    }

    #[test]
    fn duration_resize_trims_existing_history() {
        let mut history = FrameHistory::default();
        history.start();
        for value in 0..75 {
            record(&mut history, value);
        }

        history.set_duration_seconds(1);

        assert_eq!(history.len(), 50);
        assert_eq!(history.frames.front().unwrap().snapshot, vec![25]);
    }

    #[test]
    fn long_term_history_thins_older_frames_and_expires_them() {
        let mut history = FrameHistory::default();
        history.set_mode(HistoryMode::LongTerm);
        history.start();
        for frame in 0..=2000 {
            record(&mut history, (frame % 256) as u8);
            assert!(history.len() <= history.capacity());
        }
        let numbers: Vec<_> = history.frames().iter().map(|f| f.frame_number).collect();
        let expected: Vec<_> = [1000, 1500]
            .into_iter()
            .chain((1550..=1950).step_by(50))
            .chain(1951..=2000)
            .collect();
        assert_eq!(numbers, expected);
        history.select(0);
        assert_eq!(history.selected_offset(), Some(-1000));
        assert!(history.select_next());
        assert_eq!(history.selected_offset(), Some(-500));
    }

    #[test]
    fn thumbnail_rows_put_newest_snapshots_at_the_top_left() {
        let mut per_frame = FrameHistory::default();
        per_frame.start();
        for value in 0..103 {
            record(&mut per_frame, value);
        }
        let rows = per_frame.thumbnail_rows();
        assert_eq!(rows.iter().map(Vec::len).collect::<Vec<_>>(), [50, 50, 3]);
        assert_eq!(rows[0][0], 102);
        assert_eq!(rows[0][49], 53);
        assert_eq!(rows[1][0], 52);
        assert_eq!(rows[2], vec![2, 1, 0]);

        let mut long_term = FrameHistory::default();
        long_term.set_mode(HistoryMode::LongTerm);
        long_term.start();
        for value in 0..=2000 {
            record(&mut long_term, (value % 256) as u8);
        }
        let rows = long_term.thumbnail_rows();
        assert_eq!(rows.iter().map(Vec::len).collect::<Vec<_>>(), [50, 9, 2]);
        let frame_numbers: Vec<Vec<_>> = rows
            .iter()
            .map(|row| {
                row.iter()
                    .map(|&index| long_term.frames()[index].frame_number)
                    .collect()
            })
            .collect();
        assert_eq!(frame_numbers[0], (1951..=2000).rev().collect::<Vec<_>>());
        assert_eq!(
            frame_numbers[1],
            (31_u64..=39)
                .rev()
                .map(|second| second * 50)
                .collect::<Vec<_>>()
        );
        assert_eq!(frame_numbers[2], vec![1500, 1000]);
    }

    #[test]
    fn long_term_rewind_resumes_at_selected_emulated_time() {
        let mut history = FrameHistory::default();
        history.set_mode(HistoryMode::LongTerm);
        history.start();
        for frame in 0..=1000 {
            record(&mut history, (frame % 256) as u8);
        }
        let index = history
            .frames()
            .iter()
            .position(|f| f.frame_number == 500)
            .unwrap();
        history.select(index);
        assert!(history.branch_from_selected());
        record(&mut history, 42);
        assert_eq!(history.selected().unwrap().frame_number, 501);
        assert!(history.select_previous());
        assert_eq!(history.selected_offset(), Some(-1));
    }

    #[test]
    fn changing_modes_clears_history_and_preserves_recording_and_duration() {
        let mut history = FrameHistory::default();
        history.set_duration_seconds(7);
        history.start();
        record(&mut history, 1);
        history.set_mode(HistoryMode::LongTerm);
        assert!(history.is_empty());
        assert_eq!(history.selected_index(), None);
        assert!(history.is_recording());
        record(&mut history, 2);
        assert_eq!(history.selected().unwrap().frame_number, 0);
        history.set_mode(HistoryMode::LongTerm);
        assert_eq!(history.len(), 1);
        history.stop();
        history.set_mode(HistoryMode::PerFrame);
        assert!(history.is_empty());
        assert!(!history.is_recording());
        assert_eq!(history.duration_seconds(), 7);
    }

    #[test]
    fn thumbnail_downsamples_without_changing_pixel_order() {
        let width = 320;
        let height = 4;
        let pixels: Vec<u32> = (0..width * height).map(|value| value as u32).collect();

        let thumbnail = FrameThumbnail::from_framebuffer(&pixels, width, height);

        assert_eq!((thumbnail.width, thumbnail.height), (160, 2));
        assert_eq!(thumbnail.pixels[0], 0);
        assert_eq!(thumbnail.pixels[1], 2);
        assert_eq!(thumbnail.pixels[160], 640);
    }
}
