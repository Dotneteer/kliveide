
-- ZX Spectrum Next LoRes Display
-- Copyright 2020 Victor Trucco and Alvin Albrecht
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

-- LoRes video mode
-- 128 x 96, 8-bit colour
-- $4000-$57FF for top half
-- $6000-$77FF for bottom half
--
-- LoRes radastan (original mode from zx uno <http://zxuno.speccy.org/>)
-- 128 x 96, 4-bit colour
-- $4000 - $57ff if timex dfile 0 active
-- $6000 - $77ff if timex dfile 1 active

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity lores is
   port (
      mode_i                  : in std_logic;                        -- 0 = lores, 1 = radastan
      dfile_i                 : in std_logic;                        -- timex display file to use for radastan
      ulap_en_i               : in std_logic;                        -- 1 = ula plus enabled
      
      lores_palette_offset_i  : in std_logic_vector(3 downto 0);
      
      hc_i                    : in std_logic_vector(8 downto 0);     -- current x coordinate
      vc_i                    : in std_logic_vector(8 downto 0);     -- current y coordinate

      clip_x1_i               : in std_logic_vector(7 downto 0);
      clip_x2_i               : in std_logic_vector(7 downto 0);
      clip_y1_i               : in std_logic_vector(7 downto 0);
      clip_y2_i               : in std_logic_vector(7 downto 0);

      scroll_x_i              : in std_logic_vector(7 downto 0);
      scroll_y_i              : in std_logic_vector(7 downto 0);

      lores_addr_o            : out std_logic_vector(13 downto 0);   -- bank 5 offset
      lores_data_i            : in std_logic_vector(7 downto 0);
      
      lores_pixel_o           : out std_logic_vector(7 downto 0);
      lores_pixel_en_o        : out std_logic                        -- 1 = valid pixel
   );
end entity;

architecture rtl of lores is

   signal x                : std_logic_vector(7 downto 0);
   signal y                : std_logic_vector(7 downto 0);
   signal y_pre            : std_logic_vector(8 downto 0);
   
   signal lores_addr       : std_logic_vector(13 downto 0);
   signal lores_addr_pre   : std_logic_vector(13 downto 0);
   signal lores_addr_rad   : std_logic_vector(13 downto 0);
   
   signal pixel_lores_nib_H   : std_logic_vector(3 downto 0);
   signal pixel_rad_nib_L  : std_logic_vector(3 downto 0);
   signal pixel_rad_nib_H  : std_logic_vector(3 downto 0);

begin

   -- generate pixel coordinate
   
   x <= hc_i(7 downto 0) + scroll_x_i;
   
   y_pre <= vc_i + ('0' & scroll_y_i);
   
   y(7 downto 6) <= (y_pre(7 downto 6) + 1) when y_pre >= 192 else y_pre(7 downto 6);
   y(5 downto 0) <= y_pre(5 downto 0);
   
   -- generate pixel address

   lores_addr_pre <= y(7 downto 1) & x(7 downto 1);
   
   lores_addr(13 downto 11) <= (lores_addr_pre(13 downto 11) + 1) when y >= 96 else lores_addr_pre(13 downto 11);
   lores_addr(10 downto 0) <= lores_addr_pre(10 downto 0);
   
   lores_addr_rad <= dfile_i & y(7 downto 1) & x(7 downto 2);
   
   lores_addr_o <= lores_addr when mode_i = '0' else lores_addr_rad;
   
   -- generate pixel out lores
   
   pixel_lores_nib_H <= lores_data_i(7 downto 4) + lores_palette_offset_i;
   
   -- generate pixel out lores radastan
   
   pixel_rad_nib_L <= lores_data_i(7 downto 4) when x(1) = '0' else lores_data_i(3 downto 0);
   pixel_rad_nib_H <= lores_palette_offset_i when ulap_en_i = '0' else ("11" & lores_palette_offset_i(1 downto 0));
   
   -- pixel out
   
   lores_pixel_o <= (pixel_rad_nib_H & pixel_rad_nib_L) when mode_i = '1' else (pixel_lores_nib_H & lores_data_i(3 downto 0));
   
   -- clip
   
   lores_pixel_en_o <= '1' when (hc_i >= '0' & clip_x1_i) and (hc_i <= '0' & clip_x2_i) and (vc_i >= '0' & clip_y1_i) and (vc_i <= '0' & clip_y2_i) else '0';

end architecture;
