
-- I2S Master
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
--  sck - master clock
--  ws  - channel selection (0 = left, 1 = right)
--  wsp - one on falling edge of sck indicates channel change
--
-- Reference:
--  <https://web.archive.org/web/20070102004400/http://www.nxp.com/acrobat_download/various/I2SBUS.pdf>
--
-- Sample Rate = SR = i_CLK / 2^(CLK_DIV_PRE) / (i_CLK_DIV+1) / LR_WIDTH / 4
-- i_CLK_DIV   = (i_CLK / 2^(CLK_DIV_PRE) / SR / LR_WIDTH / 4) - 1

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity i2s_master is
   generic
   (
      constant CLK_DIV_PRE    : natural  := 0;   -- divide clock by 2^(CLK_DIV_PRE)
      constant CLK_DIV_MBIT   : positive := 7;   -- size of programmable divider (7 downto 0)
      constant LR_WIDTH       : positive := 8;   -- number of bits in the left and right channels (8: 7 downto 0)
      constant LR_WIDTH_MBIT  : positive := 2    -- number of bits needed to represent LR_WIDTH-1 (2 downto 0)
   );
   port
   (
      i_reset        : in std_logic;
      
      i_CLK          : in std_logic;
      i_CLK_DIV      : in std_logic_vector(CLK_DIV_MBIT downto 0);
      
      o_i2s_sck      : out std_logic;
      o_i2s_ws       : out std_logic;
      o_i2s_wsp      : out std_logic
   );
end entity;

architecture rtl of i2s_master is

   signal sck              : std_logic;
   signal sck_count        : std_logic_vector((CLK_DIV_PRE + CLK_DIV_MBIT) downto 0);
   signal clk_div          : std_logic_vector(CLK_DIV_MBIT downto 0);

   signal sck_edge         : std_logic;
   signal sck_fe           : std_logic;
   signal sck_re           : std_logic;
   
   signal ws               : std_logic;
   signal ws_d             : std_logic;
   signal wsp              : std_logic;
   signal width_count      : std_logic_vector(LR_WIDTH_MBIT downto 0);

begin

   -- sck
   
   sck_edge <= '1' when (sck_count((CLK_DIV_PRE + CLK_DIV_MBIT) downto CLK_DIV_PRE) = clk_div) else '0';
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            sck <= '0';
            sck_count <= (others => '0');
            clk_div <= i_CLK_DIV;
         elsif sck_edge = '1' then
            if sck = '1' and wsp = '1' then
               clk_div <= i_CLK_DIV;
            end if;
            sck <= not sck;
            sck_count <= (others => '0');
         else
            sck_count <= sck_count + 1;
         end if;
      end if;
   end process;
   
   sck_re <= sck_edge and not sck;
   sck_fe <= sck_edge and sck;
   
   -- channel selection

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            ws <= '1';
            width_count <= std_logic_vector(to_unsigned(LR_WIDTH-1, width_count'length));
         elsif sck_fe = '1' then
            if width_count = std_logic_vector(to_unsigned(LR_WIDTH-1, width_count'length)) then
               ws <= not ws;
               width_count <= (others => '0');
            else
               width_count <= width_count + 1;
            end if;
         end if;
      end if;
   end process;

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            ws_d <= '1';
         elsif sck_fe = '1' then
            ws_d <= ws;
         end if;
      end if;
   end process;

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            wsp <= '0';
         elsif sck_re = '1' then
            if ws /= ws_d then
               wsp <= '1';
            else
               wsp <= '0';
            end if;
         end if;
      end if;
   end process;
   
   -- output
   
   o_i2s_sck <= sck;
   o_i2s_ws <= ws;
   o_i2s_wsp <= wsp;
   
end architecture;
