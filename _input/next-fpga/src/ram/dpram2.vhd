
-- TBBlue / ZX Spectrum Next project
-- Generic Dual Port RAM 1RW + 1R
--
-- All rights reserved
--
-- Redistribution and use in source and synthezised forms, with or without
-- modification, are permitted provided that the following conditions are met:
--
-- Redistributions of source code must retain the above copyright notice,
-- this list of conditions and the following disclaimer.
--
-- Redistributions in synthesized form must reproduce the above copyright
-- notice, this list of conditions and the following disclaimer in the
-- documentation and/or other materials provided with the distribution.
--
-- Neither the name of the author nor the names of other contributors may
-- be used to endorse or promote products derived from this software without
-- specific prior written permission.
--
-- THIS CODE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
-- AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
-- THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
-- PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE
-- LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
-- CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
-- SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
-- INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
-- CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
-- ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
-- POSSIBILITY OF SUCH DAMAGE.
--
-- You are responsible for any legal issues arising from your use of this code.

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use std.textio.all;

entity dpram2 is
   generic (
      addr_width_g : integer := 8;
      data_width_g : integer := 8;
      init_file_g  : string  := "init/none.bin.txt"
   );
   port (
      clk_a_i  : in  std_logic;
      we_i     : in  std_logic;
      addr_a_i : in  std_logic_vector(addr_width_g-1 downto 0);
      data_a_i : in  std_logic_vector(data_width_g-1 downto 0);
      data_a_o : out std_logic_vector(data_width_g-1 downto 0);
      clk_b_i  : in  std_logic;
      addr_b_i : in  std_logic_vector(addr_width_g-1 downto 0);
      data_b_o : out std_logic_vector(data_width_g-1 downto 0)
  );

end dpram2;

architecture rtl of dpram2 is

   type ram_t is array (0 to 2**addr_width_g-1) of bit_vector(data_width_g-1 downto 0);

   impure function InitRamFromFile (RamFileName : in string) return ram_t is
      file     RamFile     : text is in RamFileName;
      variable RamFileLine : line;
      variable RAM         : ram_t;
      variable RAM_0       : ram_t := (others => (others => '0'));
   begin
      if RamFileName = "init/none.bin.txt" then
         return RAM_0;
      else
         for I in ram_t'range loop
            readline (RamFile, RamFileLine);
            read (RamFileLine, RAM(I));
         end loop;
         return RAM;
      end if;
   end function;

   signal ram_q : ram_t := InitRamFromFile(init_file_g);

   signal read_addr_a_q : unsigned(addr_width_g-1 downto 0);
   signal read_addr_b_q : unsigned(addr_width_g-1 downto 0);

begin

   mem_a: process (clk_a_i)
   begin
      if rising_edge(clk_a_i) then
         if we_i = '1' then
            ram_q(to_integer(unsigned(addr_a_i))) <= to_bitvector(data_a_i);
         end if;
         data_a_o <= to_stdlogicvector(ram_q(to_integer(unsigned(addr_a_i))));
      end if;
   end process mem_a;

   mem_b: process (clk_b_i)
   begin
      if rising_edge(clk_b_i) then
         data_b_o    <= to_stdlogicvector(ram_q(to_integer(unsigned(addr_b_i))));
      end if;
   end process mem_b;

end rtl;
