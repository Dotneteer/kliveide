
-- Async Input Synchronization
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

library ieee;
use ieee.std_logic_1164.all;
use ieee.std_logic_unsigned.all;

entity synchronize is
   port
   (
      i_CLK    : in  std_logic;
      i_signal : in  std_logic;
      o_signal : out std_logic
   );
end entity;

architecture rtl of synchronize is

   signal sig  : std_logic;

begin

   process (i_CLK)
   begin
      if falling_edge(i_CLK) then
         sig <= i_signal;
      end if;
   end process;
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         o_signal <= sig;
      end if;
   end process;

end architecture;
