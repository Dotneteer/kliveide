
-- ZX Spectrum Next ULA
-- Copyright 2020 Alvin Albrecht, Fabio Belavenuto and Victor Trucco
-- Thanks to Kev Brady for creating tests comparing original hardware
--
-- This file is part of the ZX Spectrum Next Project
-- <https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA/tree/master/cores>
--
-- The ZX Spectrum Next FPGA source code is free software: you can 
-- redistribute it and/or modify it under the terms of the GNU General 
-- Public License as published by the Free Software Foundation, either 
-- version 3 of the License, or (at your option) any later version.
--
-- The ZX Spectrum Next FPGA source code is distributed in the hope 
-- that it will be useful, but WITHOUT ANY WARRANTY; without even the 
-- implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR 
-- PURPOSE.  See the GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with the ZX Spectrum Next FPGA source code.  If not, see 
-- <https://www.gnu.org/licenses/>.
--

-- Features of this implementation:
--
-- * compatible with 48k, 128k, +3, pentagon ula including contention and floating bus
-- * hardware pixel scrolling in X and Y
-- * implements timex hi-res, hi-colour and dual screen
-- * dynamic choice of ULAnext, ULA+ and standard ula palette
--
-- References:
--
--   "The ZX Spectrum ULA: How to Design a Microcomputer", (c) 2010 Chris Smith
--   https://faqwiki.zxnet.co.uk/wiki/Contended_memory Emulator Reference
--   https://zxnet.co.uk/spectrum/schematics/Z70830.pdf +3 Schematic
--   http://sky.relative-path.com/zx/floating_bus.html by Ast A Moore
--
-- The implementation was simplified somewhat from Chris Smith's description and then
-- was complicated by the addition of pixel scrolling and re-interpretation of the
-- attribute byte.  It's definitely possible to rationalize this implementation but
-- that comes at the expense of clarity.
--
-- The display position as seen by the ULA and as described in Chris' book is held
-- in i_vc and i_hc.  There is a second horizontal counter i_phc which is a practical
-- counter in that 0 corresponds to when the system is actually generating pixel 0.
-- This position corresponds to ULA count i_hc = 0xC.
--
-- Because display memory is held in dual port bram, there is no real contention in
-- the zx next.  Instead contention is simulated at the exact moments it would occur
-- on the original machine.  And because there is no shortage of memory bandwidth to
-- bram, this implementation may continually access bram even outside the display area
-- with no detrimental impact on the system.

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity zxula is
   port (
   
      i_CLK_7                 : in std_logic;
      i_CLK_14                : in std_logic;
      i_CLK_CPU               : in std_logic;
      
      i_cpu_mreq_n            : in std_logic;
      i_cpu_iorq_n            : in std_logic;
      
      i_hc                    : in std_logic_vector(8 downto 0);
      i_vc                    : in std_logic_vector(8 downto 0);
      i_phc                   : in std_logic_vector(8 downto 0);
      
      i_timing_pentagon       : in std_logic;
      i_timing_p3             : in std_logic;
   
      i_port_ff_reg           : in std_logic_vector(5 downto 0);
      i_port_fe_border        : in std_logic_vector(2 downto 0);
      i_ula_shadow_en         : in std_logic;
      
      i_ulanext_en            : in std_logic;
      i_ulanext_format        : in std_logic_vector(7 downto 0);
      i_ulap_en               : in std_logic;
      
      o_ula_vram_a            : out std_logic_vector(13 downto 0);
      o_ula_shadow            : out std_logic;
      o_ula_vram_rd           : out std_logic;
      i_ula_vram_d            : in std_logic_vector(7 downto 0);
      
      o_ula_border            : out std_logic;
      o_ula_pixel             : out std_logic_vector(7 downto 0);
      o_ula_select_bgnd       : out std_logic;
      o_ula_clipped           : out std_logic;
      
      i_ula_clip_x1           : in std_logic_vector(7 downto 0);
      i_ula_clip_x2           : in std_logic_vector(7 downto 0);
      i_ula_clip_y1           : in std_logic_vector(7 downto 0);
      i_ula_clip_y2           : in std_logic_vector(7 downto 0);
      
      i_ula_scroll_x          : in std_logic_vector(7 downto 0);
      i_ula_scroll_y          : in std_logic_vector(7 downto 0);
      i_ula_fine_scroll_x     : in std_logic;
      
      i_p3_floating_bus       : in std_logic_vector(7 downto 0);
      o_ula_floating_bus      : out std_logic_vector(7 downto 0);
      
      i_contention_en         : in std_logic;
      i_contention_port       : in std_logic;
      i_contention_memory     : in std_logic;
      
      o_cpu_wait_n            : out std_logic;
      o_cpu_contend           : out std_logic
   
   );
end entity;

architecture rtl of zxula is

   signal screen_mode_s       : std_logic_vector(2 downto 0);
   signal screen_mode         : std_logic_vector(2 downto 0);
   signal py_s                : std_logic_vector(8 downto 0);
   signal py                  : std_logic_vector(7 downto 0);
   signal px                  : std_logic_vector(8 downto 0);
   signal px_1                : std_logic_vector(8 downto 0);
   signal ula_shadow          : std_logic;

   signal addr_p_spc_12_5     : std_logic_vector(7 downto 0);
   signal addr_a_spc_12_5     : std_logic_vector(7 downto 0);
   signal vram_rd             : std_logic;
   signal vram_a              : std_logic_vector(13 downto 0);

   signal pbyte00             : std_logic_vector(7 downto 0);
   signal pbyte01             : std_logic_vector(7 downto 0);
   signal abyte00             : std_logic_vector(7 downto 0);
   signal abyte01             : std_logic_vector(7 downto 0);
   signal pbyte10             : std_logic_vector(7 downto 0);
   signal pbyte11             : std_logic_vector(7 downto 0);
   signal abyte10             : std_logic_vector(7 downto 0);
   signal abyte11             : std_logic_vector(7 downto 0);
   signal floating_bus_r      : std_logic_vector(7 downto 0);
   signal floating_bus_en     : std_logic;
   
   signal screen_mode_0       : std_logic_vector(2 downto 0);
   signal screen_mode_1       : std_logic_vector(2 downto 0);
   signal scroll_0            : std_logic_vector(3 downto 0);
   signal scroll_1            : std_logic_vector(3 downto 0);
   
   signal sload_0             : std_logic;
   signal sload_1             : std_logic;
   signal sload_x             : std_logic;
   signal sload_d             : std_logic;
   signal sload               : std_logic;
   
   signal shift_pbyte         : std_logic_vector(15 downto 0);
   signal shift_abyte         : std_logic_vector(15 downto 0);
   signal shift_screen_mode   : std_logic_vector(2 downto 0);
   signal shift_scroll        : std_logic_vector(3 downto 0);
   signal shift_reg_32        : std_logic_vector(31 downto 0);
   signal shift_reg_ld        : std_logic_vector(31 downto 0);
   signal shift_reg           : std_logic_vector(15 downto 0);
   
   signal border_active_v     : std_logic;
   signal border_active       : std_logic;
   signal border_active_d     : std_logic;
   signal border_active_ula   : std_logic;
   signal border_clr          : std_logic_vector(7 downto 0);
   signal border_clr_tmx      : std_logic_vector(7 downto 0);
   signal attr_reg            : std_logic_vector(15 downto 0);
   signal attr_scroll_r       : std_logic_vector(4 downto 0);
   signal screen_mode_r       : std_logic_vector(2 downto 0);
   signal attr_active         : std_logic_vector(7 downto 0);
   
   signal pixel_en            : std_logic;
   signal flash_cnt           : std_logic_vector(4 downto 0);
   
   signal ula_select_bgnd     : std_logic;
   signal ula_pixel           : std_logic_vector(7 downto 0);
   
   signal hc_adj              : std_logic_vector(3 downto 0);
   signal wait_s              : std_logic;
   signal mreq23_n            : std_logic;
   signal ioreqtw3_n          : std_logic;

begin

   --
   -- MEMORY FETCH
   --
   
   -- Sample Display Mode and Scroll Amount Prior to Address Generation

   screen_mode_s <= i_port_ff_reg(2 downto 0) when i_ula_shadow_en = '0' else "000";  -- limit timex modes to bank 5 as bank 7 only has 8k bram
   py_s <= i_vc + ('0' & i_ula_scroll_y);
   
   process (i_CLK_7)
   begin
      if falling_edge(i_CLK_7) then
         if i_hc(3 downto 0) = X"3" or i_hc(3 downto 0) = X"B" then

            px <= i_ula_fine_scroll_x & (i_hc(7 downto 3) + i_ula_scroll_x(7 downto 3)) & i_ula_scroll_x(2 downto 0);
            
            if py_s(8 downto 7) = "11" then
               py <= (not py_s(7)) & py_s(6 downto 0);
            elsif py_s(8) = '1' or py_s(7 downto 6) = "11" then
               py <= (py_s(7 downto 6) + 1) & py_s(5 downto 0);
            else
               py <= py_s(7 downto 0);
            end if;
            
            screen_mode <= screen_mode_s;
            ula_shadow <= i_ula_shadow_en;

         end if;
      end if;
   end process;
   
   px_1 <= px(8) & (px(7 downto 3) + 1) & px(2 downto 0);

   -- Generate memory read cycles
   
   -- Cycles 0x8,0x9 and 0xC,0xD read pixel bytes
   -- Cycles 0xA,0xB and 0xE,0xF read attribute bytes
   
   addr_p_spc_12_5 <= py(7 downto 6) & py(2 downto 0) & py(5 downto 3);
   addr_a_spc_12_5 <= "110" & py(7 downto 3);
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
      
         vram_rd <= '0';
      
         case i_hc(3 downto 0) is
            
            when X"F" | X"3" =>
               vram_a <= screen_mode(0) & addr_p_spc_12_5 & px_1(7 downto 3);

            when X"1" | X"5" =>
               if screen_mode(1) = '1' then
                  vram_a <= '1' & addr_p_spc_12_5 & px_1(7 downto 3);
               else
                  vram_a <= screen_mode(0) & addr_a_spc_12_5 & px_1(7 downto 3);
               end if;
      
            when X"7" | X"B" =>
               vram_a <= screen_mode(0) & addr_p_spc_12_5 & px(7 downto 3);
            
            when X"9" | X"D" =>
               if screen_mode(1) = '1' then
                  vram_a <= '1' & addr_p_spc_12_5 & px(7 downto 3);
               else
                  vram_a <= screen_mode(0) & addr_a_spc_12_5 & px(7 downto 3);
               end if;
            
            when X"0" | X"2" | X"4" | X"6" | X"8" | X"A" | X"C" | X"E" =>
               vram_rd <= '1';
            
            when others =>
               null;

         end case;
   
      end if;
   end process;
   
   o_ula_vram_a <= vram_a;
   o_ula_vram_rd <= vram_rd;
   o_ula_shadow <= ula_shadow;

   -- Record bytes read from memory and associated mode information
   
   process (i_CLK_7)
   begin
      if falling_edge(i_CLK_7) then
      
         case i_hc(3 downto 0) is
         
            when X"1" =>
               pbyte11 <= i_ula_vram_d;
            
            when X"3" =>
               abyte11 <= i_ula_vram_d;
            
            when X"5" =>
               pbyte01 <= i_ula_vram_d;
            
            when X"7" =>
               abyte01 <= i_ula_vram_d;
            
            when X"9" =>
               pbyte00 <= i_ula_vram_d;
            
            when X"B" =>
               abyte00 <= i_ula_vram_d;
            
            when X"D" =>
               pbyte10 <= i_ula_vram_d;
            
            when X"F" =>
               abyte10 <= i_ula_vram_d;
            
            when others => null;
            
         end case;
      
      end if;
   end process;

   process (i_CLK_7)
   begin
      if falling_edge(i_CLK_7) then

         if border_active_ula = '1' then
         
            floating_bus_r <= X"FF";
            floating_bus_en <= '0';
            
         else
         
            case i_hc(3 downto 0) is
   
               when X"1" =>
                  floating_bus_r <= X"FF";
                  floating_bus_en <= '0';
               
               when X"9" =>
                  floating_bus_r <= i_ula_vram_d;
                  floating_bus_en <= '1';
            
               when X"B" =>
                  floating_bus_r <= i_ula_vram_d;
            
               when X"D" =>
                  floating_bus_r <= i_ula_vram_d;
            
               when X"F" =>
                  floating_bus_r <= i_ula_vram_d;
            
               when others => null;
            
            end case;
         
         end if;

      end if;
   end process;
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
      
         if i_hc(3 downto 0) = X"7" then
            screen_mode_0 <= screen_mode;
            scroll_0 <= px(2 downto 0) & px(8);
         end if;
         
         if i_hc(3 downto 0) = X"B" then
            screen_mode_1 <= screen_mode;
            scroll_1 <= px(2 downto 0) & px(8);
         end if;
      
      end if;
   end process;
   
   --
   -- PIXEL SHIFT REGISTER
   --
   
   sload_0 <= '1' when i_hc(3 downto 0) = X"C" else '0';
   sload_1 <= '1' when i_hc(3 downto 0) = X"4" else '0';
   
   sload_x <= sload_0 or sload_1;
   
   process (i_CLK_14)
   begin
      if rising_edge(i_CLK_14) then
         sload_d <= sload_x;
      end if;
   end process;
   
   sload <= sload_x and not sload_d;
   
   -- Shifted pixel load
   
   shift_pbyte <= (pbyte00 & pbyte01) when sload_0 = '1' else (pbyte10 & pbyte11);
   shift_abyte <= (abyte00 & abyte01) when sload_0 = '1' else (abyte10 & abyte11);
   shift_screen_mode <= screen_mode_0 when sload_0 = '1' else screen_mode_1;
   shift_scroll <= scroll_0 when sload_0 = '1' else scroll_1;
   
   shift_reg_32 <= (shift_pbyte(15 downto 8) & shift_abyte(15 downto 8) & shift_pbyte(7 downto 0) & shift_abyte(7 downto 0)) when shift_screen_mode(2) = '1' else
                   (shift_pbyte(15) & shift_pbyte(15) & shift_pbyte(14) & shift_pbyte(14) & shift_pbyte(13) & shift_pbyte(13) & shift_pbyte(12) & shift_pbyte(12) &
                    shift_pbyte(11) & shift_pbyte(11) & shift_pbyte(10) & shift_pbyte(10) & shift_pbyte(9) & shift_pbyte(9) & shift_pbyte(8) & shift_pbyte(8) &
                    shift_pbyte(7) & shift_pbyte(7) & shift_pbyte(6) & shift_pbyte(6) & shift_pbyte(5) & shift_pbyte(5) & shift_pbyte(4) & shift_pbyte(4) &
                    shift_pbyte(3) & shift_pbyte(3) & shift_pbyte(2) & shift_pbyte(2) & shift_pbyte(1) & shift_pbyte(1) & shift_pbyte(0) & shift_pbyte(0));
   
   shift_reg_ld <= std_logic_vector(shift_left(unsigned(shift_reg_32), to_integer(unsigned(shift_scroll))));
   
   process (i_CLK_14)
   begin
      if rising_edge(i_CLK_14) then
         if sload = '1' then
            shift_reg <= shift_reg_ld(31 downto 16);
         else
            shift_reg <= shift_reg(14 downto 0) & '0';
         end if;
      end if;
   end process;
   
   --
   -- ATTRIBUTE REGISTER
   --

   -- Indicate when second attribute byte should be used
   
   border_active_v <= i_vc(8) or (i_vc(7) and i_vc(6));
   border_active <= i_phc(8) or border_active_v;
   border_active_ula <= i_hc(8) or border_active_v;
   
   border_clr <= "00" & i_port_fe_border & i_port_fe_border;
   border_clr_tmx <= "01" & (not i_port_ff_reg(5 downto 3)) & i_port_ff_reg(5 downto 3);
   
   process (i_CLK_14)
   begin
      if rising_edge(i_CLK_14) then
         if sload = '1' then
         
            if shift_screen_mode(2) = '1' then
               attr_reg <= border_clr_tmx & border_clr_tmx;
            elsif border_active = '1' then
               attr_reg <= border_clr & border_clr;
            else
               attr_reg <= shift_abyte;
            end if;

            attr_scroll_r <= '0' & shift_scroll;
            screen_mode_r <= shift_screen_mode;
            
         else
         
            if attr_scroll_r(4) = '0' then
               attr_scroll_r <= attr_scroll_r + 1;
            end if;
            
            if i_timing_pentagon = '1' and border_active = '1' then
               if screen_mode_r(2) = '1' then
                  attr_reg <= border_clr_tmx & border_clr_tmx;
               else
                  attr_reg <= border_clr & border_clr;
               end if;
            end if;
            
         end if;
      end if;
   end process;
   
   attr_active <= attr_reg(15 downto 8) when attr_scroll_r(4) = '0' else attr_reg(7 downto 0);
   
   --
   -- GENERATE RGB PIXEL OUT
   --
   
   -- Delay border turn off signal by half a pixel
   
   process (i_CLK_14)
   begin
      if rising_edge(i_CLK_14) then
         border_active_d <= border_active;
      end if;
   end process;
   
   pixel_en <= (shift_reg(15) xor (attr_active(7) and flash_cnt(4) and (not i_ulanext_en) and not i_ulap_en)) and not border_active_d;
   
   -- Flash Counter
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if i_hc = ('0' & X"00") and i_vc = ('0' & X"00") then
            flash_cnt <= flash_cnt + 1;
         end if;
      end if;
   end process;
   
   -- Standard ULA, ULAnext, ULA+
   
   process (i_CLK_14)
      constant paper_base_index : std_logic_vector(7 downto 0) := "10000000"; 
   begin
      if falling_edge(i_CLK_14) then
      
         ula_select_bgnd <= '0';

         if i_ulanext_en = '1' then
         
            -- ULAnext

            if border_active_d = '1' then
         
               -- border
            
               if i_ulanext_format = X"FF" then
                  ula_select_bgnd <= '1';
               end if;
            
               ula_pixel <= paper_base_index(7 downto 3) & attr_active(5 downto 3);
         
            elsif pixel_en = '1' then
         
               -- ink
         
               ula_pixel <= attr_active and i_ulanext_format;
         
            else
         
               -- paper
         
               case i_ulanext_format is
            
                  when X"01" =>   ula_pixel <= paper_base_index(7) & attr_active(7 downto 1);
                  when X"03" =>   ula_pixel <= paper_base_index(7 downto 6) & attr_active(7 downto 2);
                  when X"07" =>   ula_pixel <= paper_base_index(7 downto 5) & attr_active(7 downto 3);
                  when X"0F" =>   ula_pixel <= paper_base_index(7 downto 4) & attr_active(7 downto 4);
                  when X"1F" =>   ula_pixel <= paper_base_index(7 downto 3) & attr_active(7 downto 5);
                  when X"3F" =>   ula_pixel <= paper_base_index(7 downto 2) & attr_active(7 downto 6);
                  when X"7F" =>   ula_pixel <= paper_base_index(7 downto 1) & attr_active(7);
                  when others =>  ula_select_bgnd <= '1';
               
               end case;
         
            end if;
         
         elsif i_ulap_en = '1' then
         
            -- ULA+
            
            ula_pixel(7 downto 3) <= "11" & attr_active(7 downto 6) & (screen_mode_r(2) or not pixel_en);
            
            if pixel_en = '1' then
               ula_pixel(2 downto 0) <= attr_active(2 downto 0);
            else
               ula_pixel(2 downto 0) <= attr_active(5 downto 3);
            end if;
         
         else
         
            -- Standard ULA
            
            ula_pixel(7 downto 3) <= "000" & not pixel_en & attr_active(6);
            
            if pixel_en = '1' then
               ula_pixel(2 downto 0) <= attr_active(2 downto 0);
            else
               ula_pixel(2 downto 0) <= attr_active(5 downto 3);
            end if;

         end if;

      end if;
   end process;
   
   -- Pixel Out
   
   o_ula_clipped <= '0' when (i_phc >= i_ula_clip_x1 and i_phc <= i_ula_clip_x2 and i_vc >= i_ula_clip_y1 and i_vc <= i_ula_clip_y2) or border_active = '1' else '1';
   
   o_ula_pixel <= ula_pixel;
   o_ula_select_bgnd <= ula_select_bgnd;
   
   o_ula_border <= border_active;  -- border_active_d ??
   
   --
   -- FLOATING BUS
   --

   o_ula_floating_bus <= (floating_bus_r(7 downto 1) & (floating_bus_r(0) or i_timing_p3)) when (border_active_ula = '0' and floating_bus_en = '1') else i_p3_floating_bus when i_timing_p3 = '1' else X"FF";
   
   --
   -- CPU CONTENTION
   --

   -- the zx next is a synchronous machine and decides whether the z80 clock will be allowed to go low in the previous i_hc cycle (contend 3-14)
   -- the original spectrums are combinatorial, they will OR a one into the clock in the current cycle (contend 4-15)

   hc_adj <= i_hc(3 downto 0) + 1;
   wait_s <= '1' when ((hc_adj(3 downto 2) /= "00") or (hc_adj(3 downto 1) = "000" and i_timing_p3 = '1')) and i_hc(8) = '0' and border_active_v = '0' and i_contention_en = '1' else '0';

   -- 48k / 128k

   process (i_CLK_CPU)
   begin
      if rising_edge(i_CLK_CPU) then
         mreq23_n <= i_cpu_mreq_n;
         ioreqtw3_n <= i_cpu_iorq_n;
      end if;
   end process;

   o_cpu_contend <= '1' when ((i_contention_memory = '1' and mreq23_n = '1') or (i_contention_port = '1' and i_cpu_iorq_n = '0' and ioreqtw3_n = '1')) and i_timing_p3 = '0' and wait_s = '1' else '0';
   
   -- +3

-- o_cpu_wait_n <= '0' when ((i_cpu_mreq_n = '0' and i_contention_memory = '1') or (i_cpu_iorq_n = '0' and i_contention_port = '1')) and i_timing_p3 = '1' and wait_s = '1' else '1';
   o_cpu_wait_n <= '0' when (i_cpu_mreq_n = '0' and i_contention_memory = '1') and i_timing_p3 = '1' and wait_s = '1' else '1';

end architecture;
