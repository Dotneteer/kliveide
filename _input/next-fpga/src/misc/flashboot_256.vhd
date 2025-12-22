-- Flashboot_256
-- Copyright 2022 Alvin Albrecht and Fabio Belavenuto
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

-- Artix A7
-- 256Mbit flash chip operated in 32-bit spi mode
-- cores separated by 2176k / 8 = 272

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

library UNISIM;
use UNISIM.VComponents.all;

entity flashboot_256 is
   port
   (
      i_CLK       : in std_logic;
      i_reset     : in std_logic;
      
      i_start     : in std_logic;
      i_coreid    : in std_logic_vector(3 downto 0)
   );
end entity;

architecture rtl of flashboot_256 is

   -- icape2 program
   
   type command_list_t is array(0 to 7) of std_logic_vector(33 downto 0);
   constant command_list : command_list_t := (
      "11" & X"FFFFFFFF",   -- 0 dummy word (looped)
      "00" & X"AA995566",   -- 1 sync word
      "00" & X"20000000",   -- 2 type 1 NOP
      "00" & X"30020001",   -- 3 type 1 write 1 word to WBSTAR
      "10" & X"00000000",   -- 4 ** insert flash address here **
      "00" & X"30008001",   -- 5 type 1 write 1 word to CMD
      "00" & X"0000000F",   -- 6 IPROG
      "00" & X"20000000"    -- 7 type 1 NOP (looped)
   );

   -- ^^ ce_n,we_n = "10" indicates data comes from spi address 

   signal command_res      : std_logic_vector(31 downto 0);
   signal swizzle          : std_logic_vector(31 downto 0);
   signal spi_address      : std_logic_vector(31 downto 0);
   
   type state_t            is (S_0, S_1, S_LOAD);
   signal state            : state_t := S_0;
   signal state_next       : state_t;
   
   signal ip               : std_logic_vector(2 downto 0) := (others => '0');  -- command_list'length
   signal command          : std_logic_vector(33 downto 0);

begin

   -- ICAPE2 Configuration Functions

   icap: ICAPE2
   generic map (
      ICAP_WIDTH => "X32"   -- specifies the input and output data width
   )
   port map
   (
      CLK   => i_CLK,                        -- input clock < 20 MHz
      CSIB  => command(33) and command(32),  -- active low select
      RDWRB => command(32),                  -- 0 = write, 1 = read
      I     => swizzle,                      -- 32-bit input
      O     => open
   );
   
   command_res <= spi_address when command(33 downto 32) = "10" else command(31 downto 0);

   process (command_res)
   begin
      for I in 0 to 7 loop
         swizzle(I) <= command_res(7-I);
         swizzle(I+8) <= command_res(7-I+8);
         swizzle(I+16) <= command_res(7-I+16);
         swizzle(I+24) <= command_res(7-I+24);
      end loop;
   end process;

   -- SPI Offset
   -- UG470, Table 7-2
   
   -- coreid max four bits avoids addition here
   -- coreid separated by 2176K in flash (2^21 + 2^17), spi 32-bit address in 23:0 of WBSTAR lose lowest 8-bits
   
   spi_address <= X"00" & X"0" & "000" & i_coreid & i_coreid & '0' & X"00";

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
