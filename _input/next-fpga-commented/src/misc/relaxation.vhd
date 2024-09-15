-- Signal Relaxation
-- Copyright 2022 Alvin Albrecht
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

-- An input high signal is brought back to zero after a minimum time has passed.

library ieee;
use ieee.std_logic_1164.all;
use ieee.std_logic_unsigned.all;

entity relaxation is
   generic
   (
      INVERT         : std_logic := '0';
      INITIAL_STATE  : std_logic := '0';
      COUNTER_SIZE   : positive := 4
   );
   port
   (
      i_CLK          : in std_logic;
      i_CLK_EN       : in std_logic;
      i_sig          : in std_logic;
      o_sig          : out std_logic
   );
end entity;

architecture rtl of relaxation is

   signal sig           : std_logic;
   signal counter       : std_logic_vector(COUNTER_SIZE downto 0) := (others => '0');
   signal sig_relaxed   : std_logic := INITIAL_STATE;

begin

   -- optional signal inversion
   
   sig <= i_sig xor INVERT;
   
   -- counter
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if sig = '0' then
            counter <= (others => '0');
         elsif i_CLK_EN = '1' and counter(COUNTER_SIZE) = '0' then
            counter <= counter + 1;
         end if;
      end if;
   end process;
   
   -- output
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         sig_relaxed <= sig and not counter(COUNTER_SIZE);
      end if;
   end process;
   
   o_sig <= sig_relaxed;

end architecture;
