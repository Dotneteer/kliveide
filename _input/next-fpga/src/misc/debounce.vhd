
-- Button Debounce
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

entity debounce is
   generic
   (
      INITIAL_STATE  : std_logic := '0';
      COUNTER_SIZE   : positive := 4
   );
   port
   (
      clk_i          : in std_logic;
      clk_en_i       : in std_logic;
      button_i       : in std_logic;
      button_o       : out std_logic
   );
end entity;

architecture rtl of debounce is

   signal button        : std_logic_vector(1 downto 0) := INITIAL_STATE & INITIAL_STATE;
   signal button_noise  : std_logic;
   signal counter       : std_logic_vector(COUNTER_SIZE downto 0) := (others => '0');
   signal button_db     : std_logic := INITIAL_STATE;

begin

   -- button
   
   process (clk_i)
   begin
      if rising_edge(clk_i) then
         button <= button(0) & button_i;
      end if;
   end process;
   
   button_noise <= button(0) xor button(1);
   
   -- counter
   
   process (clk_i)
   begin
      if rising_edge(clk_i) then
         if button_noise = '1' then
            counter <= (others => '0');
         elsif clk_en_i = '1' and counter(COUNTER_SIZE) = '0' then
            counter <= counter + 1;
         end if;
      end if;
   end process;
   
   -- output
   
   process (clk_i)
   begin
      if rising_edge(clk_i) then
         if counter(COUNTER_SIZE) = '1' then
            button_db <= button(1);
         end if;
      end if;
   end process;
   
   button_o <= button_db;

end architecture;
