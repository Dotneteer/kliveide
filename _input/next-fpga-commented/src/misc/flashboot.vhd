-- Flashboot
-- Copyright 2020 Fabio Belavenuto and Alvin Albrecht
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

-- Spartan S6
-- 128Mbit flash chip operated in standard 24-bit spi mode

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

library UNISIM;
use UNISIM.VComponents.all;

entity flashboot is
   port
   (
      i_CLK       : in std_logic;
      i_reset     : in std_logic;
      
      i_start     : in std_logic;
      
      i_coreid    : in std_logic_vector(4 downto 0);
      i_failid    : in std_logic_vector(4 downto 0)
   );
end entity;

architecture rtl of flashboot is

   -- icap program
   
   type command_list_t is array(0 to 13) of std_logic_vector(17 downto 0);
   constant command_list   : command_list_t := (
      "11" & X"FFFF",  -- dummy word (looped, inactive)
      "00" & X"AA99",  -- sync word
      "00" & X"5566",  -- sync word
      "00" & X"30A1",  -- type 1 write one word to CMD
      "00" & X"0000",  --   null
--      "00" & X"31E1",  -- type 1 write one word to CWDT
--      "00" & X"FFFF",  --   wait 64K cycles for sync
      "00" & X"3261",  -- type 1 write one word to GENERAL_1
      "10" & X"0000",  --   multiboot start address 15:0
      "00" & X"3281",  -- type 1 write one word to GENERAL_2
      "10" & X"0001",  --   multiboot opcode and start address 23:16
--      "00" & X"32A1",  -- type 1 write one word to GENERAL_3
--      "10" & X"0002",  --   multiboot fallback start address 15:0
--      "00" & X"32C1",  -- type 1 write one word to GENERAL_4
--      "10" & X"0003",  --   multiboot fallback opcode and start address 23:16
--      "00" & X"30A1",  -- type 1 write one word to CMD
--      "00" & X"0000",  --   null
      "00" & X"3301",  -- type 1 write one word to MODE
      "00" & X"3100",  --   bitstream spi x 4
--      "00" & X"3201",  -- type 1 write one word to HC_OPT_REG
--      "00" & X"001F",  --   do not skip initialization
      "00" & X"30A1",  -- type 1 write one word to CMD
      "00" & X"000E",  --   IPROG
      "00" & X"2000"   -- type 1 nop  (looped)
   );

   -- ^ ce_n,wr_n = 10 indicates data comes from source other than command 15:0

   signal command_res      : std_logic_vector(15 downto 0);
   signal swizzle          : std_logic_vector(15 downto 0);
   
   signal coreid           : std_logic_vector(4 downto 0);
   signal spi_address      : std_logic_vector(31 downto 0);
   
   type state_t            is (S_0, S_1, S_LOAD);
   signal state            : state_t := S_0;
   signal state_next       : state_t;
   
   signal ip               : std_logic_vector(3 downto 0) := (others => '0');  -- command_list'length
   signal command          : std_logic_vector(17 downto 0);

begin

   -- ICAP Configuration Functions

   icap: ICAP_SPARTAN6
   port map
   (
      CLK   => i_CLK,                        -- input clock < 20 MHz
      CE    => command(17) and command(16),  -- active low select
      WRITE => command(16),                  -- 0 = write, 1 = read
      I     => swizzle                       -- 16-bit input
   );
   
   process (command, spi_address)
   begin
      case command(17 downto 16) is
         when "10" =>
            if command(0) = '0' then
               command_res <= spi_address(15 downto 0);
            else
               command_res <= spi_address(31 downto 16);
            end if;
         when others =>
            command_res <= command(15 downto 0);
      end case;
   end process;

   process (command_res)
   begin
      for I in 0 to 7 loop
         swizzle(I) <= command_res(7-I);
         swizzle(I+8) <= command_res(7-I+8);
      end loop;
   end process;

   -- SPI Offsets
   
--   coreid <= i_coreid when command(1) = '0' else i_failid;
   coreid <= i_coreid;
   
   spi_address <= X"6B" & coreid & "000" & X"0000";   -- core images every 512K
--   spi_address <= X"0B" & coreid & "000" & X"0000";   -- core images every 512K

   -- State Machine
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            state <= S_0;
         else
            state <= state_next;
         end if;
      end if;
   end process;
   
   process (state, i_start)
   begin
      case state is
         when S_0 =>
            if i_start = '0' then
               state_next <= S_1;
            else
               state_next <= S_0;
            end if;
         when S_1 =>
            if i_start = '1' then
               state_next <= S_LOAD;
            else
               state_next <= S_1;
            end if;
         when S_LOAD =>
            state_next <= S_LOAD;
         when others =>
            state_next <= S_0;
      end case;
   end process;
   
   -- instruction pointer
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if (state /= S_LOAD) then
            ip <= (others => '0');
         elsif ip /= (command_list'length - 1) then
            ip <= ip + 1;
         end if;
      end if;
   end process;
   
   command <= command_list(to_integer(unsigned(ip)));   -- ce_n, wr_n, command

end architecture;
