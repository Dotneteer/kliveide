
-- I2S Receiver
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
--  https://web.archive.org/web/20070102004400/http://www.nxp.com/acrobat_download/various/I2SBUS.pdf

-- Signals are already synchronized

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity i2s_receive is
   generic
   (
      constant LR_WIDTH       : positive := 8;   -- number of bits in the left and right channels (8: 7 downto 0)
      constant LR_WIDTH_MBIT  : positive := 2    -- number of bits needed to represent LR_WIDTH-1 (2 downto 0)
   );
   port
   (
      i_CLK          : in std_logic;
      i_reset        : in std_logic;
      
      i_i2s_sck      : in std_logic;
      i_i2s_ws       : in std_logic;
      i_i2s_wsp      : in std_logic;
      i_i2s_sd       : in std_logic;
      
      o_i2s_L        : out std_logic_vector(LR_WIDTH-1 downto 0);
      o_i2s_R        : out std_logic_vector(LR_WIDTH-1 downto 0)
   );
end entity;

architecture rtl of i2s_receive is

   signal sck_d      : std_logic;
   signal sck_re     : std_logic;
   signal sck_fe     : std_logic;
   
   signal wsp_e      : std_logic;

   signal receiver   : std_logic_vector(LR_WIDTH downto 0);
   signal recv_count : std_logic_vector(LR_WIDTH_MBIT downto 0);

   signal recv_L     : std_logic_vector(LR_WIDTH-1 downto 0);
   signal recv_R     : std_logic_vector(LR_WIDTH-1 downto 0);


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
   
   sck_re <= i_i2s_sck and not sck_d;
   sck_fe <= sck_d and not i_i2s_sck;
   
   -- change activation edge for wsp
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            wsp_e <= '0';
         elsif sck_fe = '1' then
            wsp_e <= i_i2s_wsp;
         end if;
      end if;
   end process;

   -- bit receiver
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            receiver <= (others => '0');
            recv_count <= std_logic_vector(to_unsigned(LR_WIDTH-1, recv_count'length));
         elsif sck_re = '1' then
            if wsp_e = '1' then
               receiver(LR_WIDTH) <= i_i2s_sd;
               receiver(LR_WIDTH-1 downto 0) <= (others => '0');
               recv_count <= std_logic_vector(to_unsigned(LR_WIDTH-1, recv_count'length));
            else
               receiver(to_integer(unsigned(recv_count))) <= i_i2s_sd;
               if recv_count /= std_logic_vector(to_unsigned(0, recv_count'length)) then
                  recv_count <= recv_count - 1;
               end if;
            end if;
         end if;
      end if;
   end process;
            
   -- LR load
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            recv_L <= (others => '0');
            recv_R <= (others => '0');
         elsif sck_fe = '1' and i_i2s_wsp = '1' then
            if i_i2s_ws = '0' then
               recv_R <= receiver(LR_WIDTH downto 1);
            else
               recv_L <= receiver(LR_WIDTH downto 1);
            end if;
         end if;
      end if;
   end process;
   
   -- output
   
   o_i2s_L <= recv_L;
   o_i2s_R <= recv_R;

end architecture;
