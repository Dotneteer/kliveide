use crate::hbf::HBF;

pub(crate) struct ExpansionSlots {
    slots: [Option<HBF>; 4],
    // Two-bit extension type identifiers exposed by the 0x5A/0x5E status port.
    type_status: u8,
    // Selected extension memory mapping from port 0x03 bits 6-7.
    selected_mapping: u8,
}

impl ExpansionSlots {
    pub(crate) fn new() -> Self {
        Self {
            slots: [None, None, None, None],
            type_status: 0xFF,
            selected_mapping: 0,
        }
    }

    pub(crate) fn reset(&mut self) {
        self.selected_mapping = 0;
        self.recompute_type_status();
    }

    pub(crate) fn attach_hbf(&mut self, slot: usize, hbf: HBF) {
        if slot >= self.slots.len() {
            return;
        }
        self.slots[slot] = Some(hbf);
        self.recompute_type_status();
    }

    fn recompute_type_status(&mut self) {
        self.type_status = 0xFF;
        for (slot, ext) in self.slots.iter().enumerate() {
            let Some(ext) = ext else {
                continue;
            };
            let hbf_type = ext.get_type();
            self.type_status &= !(3 << (slot * 2));
            self.type_status |= hbf_type << (slot * 2);
        }
    }

    pub(crate) fn selected_mapping(&self) -> u8 {
        self.selected_mapping
    }

    pub(crate) fn set_selected_mapping(&mut self, mapping: u8) {
        self.selected_mapping = mapping & 0x03;
    }

    pub(crate) fn type_status(&self) -> u8 {
        self.type_status
    }

    pub(crate) fn set_type_status(&mut self, type_status: u8) {
        self.type_status = type_status;
    }

    fn active_mem_slot_mut(&mut self) -> Option<&mut HBF> {
        self.slots
            .get_mut(self.selected_mapping as usize)
            .and_then(Option::as_mut)
    }

    pub(crate) fn read_mem(&mut self, offset: u16) -> u8 {
        self.active_mem_slot_mut()
            .map(|slot| slot.r8(offset))
            .unwrap_or(0xFF)
    }

    pub(crate) fn write_mem(&mut self, offset: u16, val: u8) {
        if let Some(slot) = self.active_mem_slot_mut() {
            slot.w8(offset, val);
        }
    }

    fn port_slot(port: u8) -> Option<usize> {
        match port {
            0x10..=0x1F => Some(0),
            0x20..=0x2F => Some(1),
            0x30..=0x3F => Some(2),
            0x40..=0x4F => Some(3),
            _ => None,
        }
    }

    pub(crate) fn read_port(&mut self, port: u8) -> Option<u8> {
        let slot = Self::port_slot(port)?;
        Some(
            self.slots[slot]
                .as_mut()
                .map(|ext| ext.read_port(port & 0x0F))
                .unwrap_or(0xFF),
        )
    }

    pub(crate) fn write_port(&mut self, port: u8, val: u8) -> bool {
        let Some(slot) = Self::port_slot(port) else {
            return false;
        };
        if let Some(ext) = self.slots[slot].as_mut() {
            ext.write_port(port & 0x0F, val);
        }
        true
    }

    pub(crate) fn slot0(&self) -> Option<&HBF> {
        self.slots[0].as_ref()
    }

    pub(crate) fn slot0_mut(&mut self) -> Option<&mut HBF> {
        self.slots[0].as_mut()
    }
}
