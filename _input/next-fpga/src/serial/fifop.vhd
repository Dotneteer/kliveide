
-- FIFO Manager
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
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity fifop is
   generic (
      constant DEPTH_BITS     : positive := 9
   );
   port (
      i_CLK          : in std_logic;
      i_reset        : in std_logic;
      
      o_empty        : out std_logic;   -- held
      o_full_near    : out std_logic;   -- held (3/4)
      o_full_almost  : out std_logic;   -- held (full - 2 bytes)
      o_full         : out std_logic;   -- held
      
      i_rd           : in std_logic;
      o_raddr        : out std_logic_vector(DEPTH_BITS-1 downto 0);
      
      i_wr           : in std_logic;
      o_waddr        : out std_logic_vector(DEPTH_BITS-1 downto 0)
   );
end entity;

architecture rtl of fifop is

   signal stored        : std_logic_vector(DEPTH_BITS downto 0);
   
   signal empty      : std_logic;
   signal full       : std_logic;

   signal rd_dly     : std_logic;
   signal wr_dly     : std_logic;
   
   signal rd_advance : std_logic;
   signal wr_advance : std_logic;
   
   signal rd_addr    : std_logic_vector(DEPTH_BITS-1 downto 0);
   signal wr_addr    : std_logic_vector(DEPTH_BITS-1 downto 0);

begin

   -- read from fifo
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            rd_dly <= '0';
         else
            rd_dly <= i_rd;
         end if;
      end if;
   end process;

   rd_advance <= rd_dly and (not i_rd) and (not empty);

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            rd_addr <= (others => '0');
         elsif rd_advance = '1' then
            rd_addr <= rd_addr + 1;
         end if;
      end if;
   end process;
   
   -- write to fifo
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            wr_dly <= '0';
         else
            wr_dly <= i_wr;
         end if;
      end if;
   end process;

   wr_advance <= wr_dly and (not i_wr) and (not full);
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            wr_addr <= (others => '0');
         elsif wr_advance = '1' then
            wr_addr <= wr_addr + 1;
         end if;
      end if;
   end process;
   
   -- track number of stored bytes
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            stored <= (others => '0');
         elsif rd_advance = '0' and wr_advance = '1' then
            stored <= stored + 1;
         elsif rd_advance = '1' and wr_advance = '0' then
            stored <= stored - 1;
         end if;
      end if;
   end process;
   
   -- flags
   
   empty <= '1' when stored = std_logic_vector(to_unsigned(0,stored'length)) else '0';
   full <= stored(DEPTH_BITS);

   -- output
   
   o_empty <= empty;
   o_full_near <= stored(DEPTH_BITS) or (stored(DEPTH_BITS-1) and stored(DEPTH_BITS-2));
   o_full_almost <= '1' when stored(DEPTH_BITS) = '1' or (stored(DEPTH_BITS-1 downto 1) = std_logic_vector(to_unsigned(-1,stored'length-1))) else '0';
   o_full <= full;
   
   o_raddr <= rd_addr;
   o_waddr <= wr_addr;

end architecture;
