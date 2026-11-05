#![allow(dead_code)]

use std::collections::{HashMap, HashSet};

const KSADD: u8 = 1 << 0;
const KSDEL: u8 = 1 << 1;

const SHIFT_ON: u8 = 1 << 0;
const ALTGR_ON: u8 = 1 << 2;
const SHIFT_ALTGR_ON: u8 = SHIFT_ON | ALTGR_ON;

pub const KC_SHIFT: u32 = 16;
pub const KC_ALT: u32 = 18;
pub const KC_ALTGR: u32 = 225;

type Mapping = (u8, u8, u8);

pub struct Key {
    state: [u8; 11],
    row: u8,
    keymap: HashMap<u8, HashMap<u32, Mapping>>,
    is_mapped: HashSet<u32>,
    mod_state: u8,
    last_press: u32,
    ntable: String,
    stable: String,
}

impl Key {
    pub fn new() -> Self {
        let mut key = Key {
            state: [0xFF; 11],
            row: 0,
            keymap: HashMap::new(),
            is_mapped: HashSet::new(),
            mod_state: 0,
            last_press: 0,
            ntable: String::from(
                "53206í14^89ü*óö7tew;z@qr]ioő[úpugds\\h<af klá űéjbcx n yv ,.   -m",
            ),
            stable: String::from(
                "%+\"&/Í'!~()Ü#ÓÖ=TEW$Z`QR}IOŐ{ÚPUGDS|H>AF KLÁ ŰÉJBCX N YV ?:   _M",
            ),
        };

        key.keymap.insert(0, HashMap::new());
        key.keymap.insert(SHIFT_ON, HashMap::new());
        key.keymap.insert(ALTGR_ON, HashMap::new());
        key.keymap.insert(SHIFT_ALTGR_ON, HashMap::new());

        // Pre-mapped non-typable keys (unshifted)
        key.keymap.get_mut(&0).unwrap().insert(46, (5, 0, 0)); // del
        key.keymap.get_mut(&0).unwrap().insert(8, (5, 0, 0)); // backspace
        key.keymap.get_mut(&0).unwrap().insert(13, (5, 4, 0)); // return
        key.keymap.get_mut(&0).unwrap().insert(16, (6, 3, 0)); // shift
        key.keymap.get_mut(&0).unwrap().insert(20, (6, 5, 0)); // lock
        key.keymap.get_mut(&0).unwrap().insert(18, (7, 0, 0)); // alt
        key.keymap.get_mut(&0).unwrap().insert(27, (7, 3, 0)); // esc
        key.keymap.get_mut(&0).unwrap().insert(17, (7, 4, 0)); // ctrl
        key.keymap.get_mut(&0).unwrap().insert(32, (7, 5, 0)); // space
        key.keymap.get_mut(&0).unwrap().insert(38, (8, 1, 0)); // up
        key.keymap.get_mut(&0).unwrap().insert(40, (8, 2, 0)); // down
        key.keymap.get_mut(&0).unwrap().insert(9, (8, 3, 0)); // tab -> fire
        key.keymap.get_mut(&0).unwrap().insert(39, (8, 5, 0)); // right
        key.keymap.get_mut(&0).unwrap().insert(37, (8, 6, 0)); // left

        // Copy base mappings to all modifier states
        let base: HashMap<u32, Mapping> = key.keymap[&0].clone();
        for (kc, m) in &base {
            key.keymap.get_mut(&SHIFT_ON).unwrap().insert(*kc, *m);
            key.keymap.get_mut(&ALTGR_ON).unwrap().insert(*kc, *m);
            key.keymap.get_mut(&SHIFT_ALTGR_ON).unwrap().insert(*kc, *m);
        }

        // Pre-mark these character codes as already mapped
        key.is_mapped.insert(8);
        key.is_mapped.insert(9);
        key.is_mapped.insert(13);
        key.is_mapped.insert(32);

        key
    }

    pub fn reset(&mut self) {
        self.state = [0xFF; 11];
        self.mod_state = 0;
        self.last_press = 0;
    }

    fn add_mapping(&mut self, ch: char) -> Option<Mapping> {
        // Don't auto-map over modifier key entries
        if self.last_press == KC_SHIFT
            || self.last_press == 17
            || self.last_press == KC_ALT
            || self.last_press == KC_ALTGR
        {
            return None;
        }

        let mut flags = 0u8;

        if let Some(idx) = self.ntable.chars().position(|c| c == ch) {
            if self.mod_state & SHIFT_ON != 0 {
                flags |= KSDEL;
            }
            let mapping: Mapping = ((idx / 8) as u8, (idx % 8) as u8, flags);
            if let Some(map) = self.keymap.get_mut(&self.mod_state) {
                map.insert(self.last_press, mapping);
            }
            return Some(mapping);
        }

        if let Some(idx) = self.stable.chars().position(|c| c == ch) {
            if self.mod_state & SHIFT_ON == 0 {
                flags |= KSADD;
            }
            let mapping: Mapping = ((idx / 8) as u8, (idx % 8) as u8, flags);
            if let Some(map) = self.keymap.get_mut(&self.mod_state) {
                map.insert(self.last_press, mapping);
            }
            return Some(mapping);
        }

        None
    }

    fn fix_state(&mut self, val: u8, down: bool) {
        if val & KSADD != 0 {
            self.key_set(6, 3, down || (self.mod_state & SHIFT_ON) != 0);
        }
        if val & KSDEL != 0 {
            self.key_set(6, 3, !down && (self.mod_state & SHIFT_ON) != 0);
        }
    }

    fn key_update(&mut self, code: u32, down: bool) -> bool {
        if code == KC_SHIFT {
            if down {
                self.mod_state |= SHIFT_ON;
            } else {
                self.mod_state &= !SHIFT_ON;
            }
        }
        if code == KC_ALTGR {
            if down {
                self.mod_state |= ALTGR_ON;
            } else {
                self.mod_state &= !ALTGR_ON;
            }
        }

        let entry = if let Some(map) = self.keymap.get(&self.mod_state) {
            map.get(&code).copied()
        } else {
            None
        };
        if let Some(m) = entry {
            self.apply_mapping(m, down);
        }
        let found = entry.is_some();

        if !down {
            let mut to_release: Vec<Mapping> = Vec::new();
            for (_, map) in &self.keymap {
                if let Some(&m) = map.get(&code) {
                    to_release.push(m);
                }
            }
            for m in to_release {
                self.key_set(m.0, m.1, false);
                self.fix_state(m.2, false);
            }
        }

        found
    }

    fn apply_mapping(&mut self, m: Mapping, down: bool) {
        self.key_set(m.0, m.1, down);
        self.fix_state(m.2, down);
    }

    pub fn key_down(&mut self, code: u32) -> bool {
        self.last_press = code;
        if code != 0 {
            self.key_update(code, true)
        } else {
            true
        }
    }

    pub fn key_up(&mut self, code: u32) {
        if code != 0 {
            self.key_update(code, false);
        }
    }

    pub fn key_press(&mut self, ch: char) {
        let code = ch as u32;
        if code != 0 && !self.is_mapped.contains(&code) {
            if let Some(m) = self.add_mapping(ch) {
                self.is_mapped.insert(code);
                self.apply_mapping(m, true);
            }
        }
    }

    pub fn select_row(&mut self, val: u8) {
        self.row = val & 0x0F;
    }

    pub fn read_row(&self) -> u8 {
        self.state.get(self.row as usize).copied().unwrap_or(0xFF)
    }

    fn key_set(&mut self, row: u8, col: u8, down: bool) {
        if let Some(state_row) = self.state.get_mut(row as usize) {
            if down {
                *state_row &= !(1u8 << col);
            } else {
                *state_row |= 1u8 << col;
            }
        }
    }
}

#[cfg(test)]
#[path = "key_tests.rs"]
mod tests;
