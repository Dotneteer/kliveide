
-- ZX Spectrum Next Layer 2 Bitmap Display
-- Copyright 2020 Alvin Albrecht and Victor Trucco
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

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity layer2 is
   port (
      i_CLK_7                 : in std_logic;                        -- pixel clock
      i_CLK_28                : in std_logic;
      
      i_sc                    : in std_logic_vector(1 downto 0);     -- 28MHz subcount
      
      i_phc                   : in std_logic_vector(8 downto 0);     -- current x coordinate
      i_pvc                   : in std_logic_vector(8 downto 0);     -- current y coordinate
      
      i_whc                   : in std_logic_vector(8 downto 0);     -- current wide x coordinate
      i_wvc                   : in std_logic_vector(8 downto 0);     -- current wide y coordinate
      
      i_layer2_en             : in std_logic;
      i_resolution            : in std_logic_vector(1 downto 0);     -- 00 = 256x192, 01 = 320x256, 1X = 640x256x4
      i_palette_offset        : in std_logic_vector(3 downto 0);
      
      i_scroll_x              : in std_logic_vector(8 downto 0);
      i_scroll_y              : in std_logic_vector(7 downto 0);
      
      i_clip_x1               : in std_logic_vector(7 downto 0);
      i_clip_x2               : in std_logic_vector(7 downto 0);
      i_clip_y1               : in std_logic_vector(7 downto 0);
      i_clip_y2               : in std_logic_vector(7 downto 0);
      
      i_layer2_active_bank    : in std_logic_vector(6 downto 0);     -- starting 16K bank
      
      o_layer2_sram_addr      : out std_logic_vector(20 downto 0);
      o_layer2_req_t          : out std_logic;
      i_layer2_sram_di        : in std_logic_vector(7 downto 0);
      
      o_layer2_en             : out std_logic;
      o_layer2_pixel          : out std_logic_vector(7 downto 0)
   );
end entity;

architecture rtl of layer2 is

   signal layer2_en_q            : std_logic;
   signal layer2_resolution_q    : std_logic_vector(1 downto 0);
   signal layer2_scroll_x_q      : std_logic_vector(8 downto 0);
   signal layer2_scroll_y_q      : std_logic_vector(7 downto 0);
   signal layer2_palette_offset_q   : std_logic_vector(3 downto 0);
   signal layer2_active_bank_q   : std_logic_vector(6 downto 0);
   
   signal clip_x1_q              : std_logic_vector(8 downto 0);
   signal clip_x2_q              : std_logic_vector(8 downto 0);
   signal clip_y1_q              : std_logic_vector(7 downto 0);
   signal clip_y2_q              : std_logic_vector(7 downto 0);
   
   signal layer2_wide_res        : std_logic;
   signal hc                     : std_logic_vector(8 downto 0);
   signal hc_eff                 : std_logic_vector(8 downto 0);
   signal vc_eff                 : std_logic_vector(8 downto 0);
   signal x_pre                  : std_logic_vector(9 downto 0);
   signal x                      : std_logic_vector(8 downto 0);
   signal y_pre                  : std_logic_vector(8 downto 0);
   signal y                      : std_logic_vector(7 downto 0);
   signal layer2_addr            : std_logic_vector(16 downto 0);

   signal hc_valid               : std_logic;
   signal vc_valid               : std_logic;
   signal layer2_clip_en         : std_logic;
   
   signal layer2_bank_eff        : std_logic_vector(7 downto 0);
   signal layer2_addr_eff        : std_logic_vector(21 downto 0);
   signal layer2_en              : std_logic;
   signal layer2_req_t           : std_logic;
   signal layer2_sram_addr       : std_logic_vector(20 downto 0);
   signal layer2_pixel_qq        : std_logic_vector(7 downto 0);
   
   signal layer2_en_qq           : std_logic;
   signal layer2_hires_qq        : std_logic;
   signal layer2_pixel_pre       : std_logic_vector(7 downto 0);
   signal layer2_pixel           : std_logic_vector(7 downto 0);

begin

   -- capture settings for pixel period
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
   
         layer2_en_q <= i_layer2_en;
         
         layer2_resolution_q <= i_resolution;
         
         layer2_scroll_x_q <= i_scroll_x;
         layer2_scroll_y_q <= i_scroll_y;
         
         layer2_palette_offset_q <= i_palette_offset;
         
         layer2_active_bank_q <= i_layer2_active_bank;
      
      end if;
   end process;
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
      
         if i_resolution = "00" then
            clip_x1_q <= '0' & i_clip_x1;
            clip_x2_q <= '0' & i_clip_x2;
         else
            clip_x1_q <= i_clip_x1 & '0';
            clip_x2_q <= i_clip_x2 & '1';
         end if;
         
         clip_y1_q <= i_clip_y1;
         clip_y2_q <= i_clip_y2;

      end if;
   end process;
   
   -- generate layer 2 address one x pixel ahead
   
   layer2_wide_res <= '0' when layer2_resolution_q = "00" else '1';

   hc <= i_phc when layer2_wide_res = '0' else i_whc;
   hc_eff <= hc + 1;
   
   vc_eff <= i_pvc when layer2_wide_res = '0' else i_wvc;
   
   x_pre <= ('0' & hc_eff) + ('0' & layer2_scroll_x_q);
   x(8 downto 6) <= x_pre(8 downto 6) when (layer2_wide_res = '0' or (x_pre(9) = '0' and (x_pre(8) = '0' or x_pre(7 downto 6) = "00"))) else (x_pre(8 downto 6) + "011");
   x(5 downto 0) <= x_pre(5 downto 0);
   
   y_pre <= vc_eff + ('0' & layer2_scroll_y_q);
   y(7 downto 6) <= y_pre(7 downto 6) when (layer2_wide_res = '1' or (y_pre(8) = '0' and y_pre(7 downto 6) /= "11")) else (y_pre(7 downto 6) + 1);
   y(5 downto 0) <= y_pre(5 downto 0);
   
   layer2_addr <= ('0' & y & x(7 downto 0)) when layer2_wide_res = '0' else (x & y);

   -- clip
   
   hc_valid <= '1' when (layer2_wide_res = '0' and hc_eff(8) = '0') or (layer2_wide_res = '1' and (hc_eff(8) = '0' or hc_eff(7 downto 6) = "00")) else '0';
   vc_valid <= '1' when (layer2_wide_res = '1' and vc_eff(8) = '0') or (layer2_wide_res = '0' and (vc_eff(8) = '0' and vc_eff(7 downto 6) /= "11")) else '0';

   layer2_clip_en <= '1' when (hc_eff >= clip_x1_q) and (hc_eff <= clip_x2_q) and (vc_eff >= ('0' & clip_y1_q)) and (vc_eff <= ('0' & clip_y2_q)) and (hc_valid = '1') and (vc_valid = '1') else '0';

   -- generate sram cycle
   -- 0x040000 - 0x05FFFF (128K) => ZX Spectrum RAM  A20:A16 = 00100,BB max 11011,11
   
   layer2_bank_eff <= (('0' & layer2_active_bank_q(6 downto 4)) + 1) & layer2_active_bank_q(3 downto 0);
   layer2_addr_eff <= (layer2_bank_eff + ("00000" & layer2_addr(16 downto 14))) & layer2_addr(13 downto 0);
   
   layer2_en <= '1' when layer2_en_q = '1' and layer2_clip_en = '1' and layer2_addr_eff(21) = '0' else '0';
   
   process (i_CLK_28)
   begin
      if rising_edge(i_CLK_28) then
         if i_sc = "00" then
            if layer2_en = '1' then
               layer2_req_t <= not layer2_req_t;
            end if;
            layer2_sram_addr <= layer2_addr_eff(20 downto 0);
            layer2_pixel_qq <= i_layer2_sram_di;
         end if;
      end if;
   end process;

   o_layer2_sram_addr <= layer2_sram_addr;
   o_layer2_req_t <= layer2_req_t;

   -- generate pixels
   
   process (i_CLK_7) begin
      if rising_edge(i_CLK_7) then
         layer2_en_qq <= layer2_en;
         layer2_hires_qq <= layer2_resolution_q(1);
      end if;
   end process;
   
   layer2_pixel_pre <= layer2_pixel_qq when layer2_hires_qq = '0' else ("0000" & layer2_pixel_qq(7 downto 4)) when i_sc(1) = '0' else ("0000" & layer2_pixel_qq(3 downto 0));
   layer2_pixel <= (layer2_pixel_pre(7 downto 4) + layer2_palette_offset_q) & layer2_pixel_pre(3 downto 0);
   
   process (i_CLK_28)
   begin
      if rising_edge(i_CLK_28) then
         if i_sc(0) = '1' then
            o_layer2_pixel <= layer2_pixel;
         end if;
      end if;
   end process;
   
   o_layer2_en <= layer2_en_qq;

end architecture;
