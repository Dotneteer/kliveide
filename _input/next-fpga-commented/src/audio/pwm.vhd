
-- Pulse Width Modulator DAC
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

-- Generates N/M output on a sample period of M
-- Sample rate = i_CLK / M

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity pwm is
   generic
   (
      M     : integer := 255;
      M_bit : integer := 7      -- highest bit number to represent M
   );
   port
   (
      i_CLK       : in std_logic;
      i_reset     : in std_logic;
      
      i_pcm       : in std_logic_vector(M_bit downto 0);
      o_pwm       : out std_logic
   );
end entity;

architecture rtl of pwm is

   signal sample  : std_logic_vector(M_bit downto 0);
   signal period  : std_logic_vector(M_bit downto 0);
   
   signal tally   : std_logic_vector(M_bit+1 downto 0);
   signal delta   : std_logic_vector(M_bit+1 downto 0);
   
   signal pwm_one : std_logic;

begin

   -- period counter
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            period <= (others => '0');
         elsif period = M then
            period <= (others => '0');
         else
            period <= period + 1;
         end if;
      end if;
   end process;
   
   -- pwm output
   
   pwm_one <= '1' when tally >= ('0' & std_logic_vector(to_unsigned(M, M_bit+1))) else '0';
   delta <= ('0' & sample) when pwm_one = '0' else (('0' & sample) - ('0' & std_logic_vector(to_unsigned(M, M_bit+1))));
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            tally <= (others => '0');
            sample <= (others => '0');
         elsif period = M then
            tally <= '0' & i_pcm;
            sample <= i_pcm;
         else
            tally <= tally + delta;
         end if;
      end if;
   end process;

   -- output
   
   o_pwm <= pwm_one;
   
end architecture;
