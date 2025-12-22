
-- I2S Transmitter
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

-- Reference:
--  <https://web.archive.org/web/20070102004400/http://www.nxp.com/acrobat_download/various/I2SBUS.pdf>
--
-- Signals are already synchronized

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity i2s_transmit is
   generic
   (
      constant LR_WIDTH       : positive := 8    -- number of bits in the left and right channels (8: 7 downto 0)
   );
   port
   (
      i_CLK          : in std_logic;
      i_reset        : in std_logic;
      
      i_i2s_sck      : in std_logic;
      i_i2s_ws       : in std_logic;
      i_i2s_wsp      : in std_logic;
      o_i2s_sd       : out std_logic;
      
      i_i2s_L        : in std_logic_vector(LR_WIDTH-1 downto 0);
      i_i2s_R        : in std_logic_vector(LR_WIDTH-1 downto 0)
   );
end entity;

architecture rtl of i2s_transmit is

   signal sck_d         : std_logic;
   signal sck_fe        : std_logic;

   signal transmitter   : std_logic_vector(LR_WIDTH-1 downto 0);

begin

   -- i2s clock
   -- (accepting a slip of one fast clock period)
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            sck_d <= '0';
         else
            sck_d <= i_i2s_sck;
         end if;
      end if;
   end process;
   
   sck_fe <= sck_d and not i_i2s_sck;

   -- bit transmitter
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            transmitter(LR_WIDTH-1) <= '1';
            transmitter(LR_WIDTH-2 downto 0) <= (others => '0');
         elsif sck_fe = '1' then
            if i_i2s_wsp = '1' then
               if i_i2s_ws = '0' then
                  transmitter <= i_i2s_L;
               else
                  transmitter <= i_i2s_R;
               end if;
            else
               transmitter <= transmitter(LR_WIDTH-2 downto 0) & '0';
            end if;
         end if;
      end if;
   end process;

   -- output
   
   o_i2s_sd <= transmitter(LR_WIDTH-1);

end architecture;
