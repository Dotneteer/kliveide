
-- TBBlue / ZX Spectrum Next project
-- True Dual Port RAM 1RW + 1RW
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
use ieee.std_logic_unsigned.all;

entity tdpram is
   generic (
      addr_width_g : integer := 8;
      data_width_g : integer := 8
   );
   port (
      clk_a_i  : in  std_logic;
      we_a_i   : in  std_logic;
      addr_a_i : in  std_logic_vector(addr_width_g-1 downto 0);
      data_a_i : in  std_logic_vector(data_width_g-1 downto 0);
      data_a_o : out std_logic_vector(data_width_g-1 downto 0);
      --
      clk_b_i  : in  std_logic;
      we_b_i   : in  std_logic;
      addr_b_i : in  std_logic_vector(addr_width_g-1 downto 0);
      data_b_i : in  std_logic_vector(data_width_g-1 downto 0);
      data_b_o : out std_logic_vector(data_width_g-1 downto 0)
   );
end entity;

architecture rtl of tdpram is

   type ram_t is array (natural range 2**addr_width_g-1 downto 0) of std_logic_vector(data_width_g-1 downto 0);
   shared variable RAM : ram_t;

begin

   process (clk_a_i)
   begin
      if rising_edge(clk_a_i) then
         data_a_o <= RAM(conv_integer(addr_a_i));
         if we_a_i = '1' then
            RAM(conv_integer(addr_a_i)) := data_a_i;
         end if;
      end if;
   end process;
   
   process (clk_b_i)
   begin
      if rising_edge(clk_b_i) then
         data_b_o <= RAM(conv_integer(addr_b_i));
         if we_b_i = '1' then
            RAM(conv_integer(addr_b_i)) := data_b_i;
         end if;
      end if;
   end process;

end architecture;
