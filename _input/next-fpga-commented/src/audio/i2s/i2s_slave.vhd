
-- I2S Slave
-- Copyright 2020 Alvin Albrecht
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

-- Generates:
--  wsp - one on falling edge of sck indicates channel change
--
-- Reference:
--  <https://web.archive.org/web/20070102004400/http://www.nxp.com/acrobat_download/various/I2SBUS.pdf>

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity i2s_slave is
   port
   (
      i_i2s_sck      : in std_logic;
      i_i2s_ws       : in std_logic;

      o_i2s_sck      : out std_logic;
      o_i2s_ws       : out std_logic;
      o_i2s_wsp      : out std_logic
   );
end entity;

architecture rtl of i2s_slave is

   signal ws_d       : std_logic;

begin

   o_i2s_sck <= i_i2s_sck;
   o_i2s_ws <= i_i2s_ws;
   
   -- generate wsp
   
   process (i_i2s_sck)
   begin
      if rising_edge(i_i2s_sck) then
         ws_d <= i_i2s_ws;
      end if;
   end process;
   
   process (i_i2s_sck)
   begin
      if rising_edge(i_i2s_sck) then
         if i_i2s_ws /= ws_d then
            o_i2s_wsp <= '1';
         else
            o_i2s_wsp <= '0';
         end if;
      end if;
   end process;

end architecture;
