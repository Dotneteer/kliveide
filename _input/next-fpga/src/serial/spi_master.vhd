
-- SPI Master
--
-- Copyright 2020-2022 Alvin Albrecht and Fabio Belavenuto
--
-- All rights reserved
--
-- Redistribution and use in source and synthezised forms, with or without
-- modification, are permitted provided that the following conditions are met:
--
-- * Redistributions of source code must retain the above copyright notice,
--   this list of conditions and the following disclaimer.
--
-- * Redistributions in synthesized form must reproduce the above copyright
--   notice, this list of conditions and the following disclaimer in the
--   documentation and/or other materials provided with the distribution.
--
-- * Neither the name of the author nor the names of other contributors may
--   be used to endorse or promote products derived from this software without
--   specific prior written permission.
--
-- THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
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

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity spi_master is
   port
   (
      i_CLK          : in  std_logic;     -- twice the spi sck frequency
      i_reset        : in  std_logic;
      
      i_spi_rd       : in  std_logic;     -- i/o read from spi
      i_spi_wr       : in  std_logic;     -- i/o write to spi
      
      i_spi_mosi_dat : in  std_logic_vector(7 downto 0);   -- data to write to spi (i/o write)
      o_spi_miso_dat : out std_logic_vector(7 downto 0);   -- data read from spi (i/o read)
      
      o_spi_sck      : out std_logic;     -- must synchronize with rising edge of i_CLK externally (on way out from fpga)
      o_spi_mosi     : out std_logic;     -- must synchronize with rising edge of i_CLK externally (on way out from fpga)
      i_spi_miso     : in  std_logic;     -- must synchronize with rising edge of i_CLK externally (on way into fpga)
      
      o_spi_wait_n   : out std_logic      -- wait signal for dma
   );
end entity;

architecture rtl of spi_master is

   signal spi_begin        : std_logic;
   
   signal state_last       : std_logic;
   signal state_idle       : std_logic;
   signal state_r          : std_logic_vector(4 downto 0) := "10000";
   
   signal oshift_r         : std_logic_vector(7 downto 0) := (others => '1');
   
   signal state_r0_d       : std_logic := '0';
   signal state_last_d     : std_logic := '0';
   
   signal ishift_r         : std_logic_vector(6 downto 0) := (others => '0');
   signal miso_dat         : std_logic_vector(7 downto 0) := (others => '0');
   
begin

   -- CPOL = 0, CPHA = 0

   -- spi transaction begin
   
   spi_begin <= '1' when (state_last = '1' or state_idle = '1') and (i_spi_rd = '1' or i_spi_wr = '1') else '0';
   
   -- state counter for one byte transfer
   
   state_last <= '1' when state_r(3 downto 0) = X"F" else '0';
   state_idle <= state_r(4);
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            state_r <= "10000";
         elsif spi_begin = '1' then
            state_r <= (others => '0');
         elsif state_idle = '0' then
            state_r <= state_r + 1;
         end if;
      end if;
   end process;
   
   -- output shift register
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            oshift_r <= (others => '1');
         elsif spi_begin = '1' and i_spi_rd = '1' then
            oshift_r <= (others => '1');
         elsif spi_begin = '1' and i_spi_wr = '1' then
            oshift_r <= i_spi_mosi_dat;
         elsif state_r(0) = '1' then
            oshift_r <= oshift_r(6 downto 0) & '1';
         end if;
      end if;
   end process;
   
   -- input shift register
   
   -- delay control signals one cycle due to external synchronization of spi sck and mosi
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            state_r0_d <= '0';
         else
            state_r0_d <= state_r(0);
         end if;
      end if;
   end process;
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            state_last_d <= '0';
         else
            state_last_d <= state_last;
         end if;
      end if;
   end process;

   -- independent from output shift register because spi signals are synchronized when they leave or enter the fpga
   -- without synchronization, problems are seen in some sd cards at higher system frequencies
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            ishift_r <= (others => '1');
         elsif state_r0_d = '1' then
            ishift_r <= ishift_r(5 downto 0) & i_spi_miso;
         end if;
      end if;
   end process;
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            miso_dat <= (others => '1');
         elsif state_last_d = '1' then
            miso_dat <= ishift_r & i_spi_miso;
         end if;
      end if;
   end process;
   
   -- spi signals
   
   o_spi_sck <= state_r(0);     -- must be synchronized on rising edge of i_CLK
   o_spi_mosi <= oshift_r(7);   -- must be synchronized on rising edge of i_CLK

   o_spi_miso_dat <= miso_dat;

   o_spi_wait_n <= state_idle or state_last_d;

end architecture;
