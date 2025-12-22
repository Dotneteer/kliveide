
-- Copyright 2010 Thiago Borges Abdnur
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

-- Original file traced to:
--   https://github.com/tiagochst/cmp613/blob/master/Lab4/Doc/ps2_iobase.vhd
--
-- License traced to:
--   https://code.google.com/archive/p/cmp613/source/default/source?page=20
--   https://code.google.com/archive/p/cmp613/

--
-------------------------------------------------------------------------------
-- Title      : MC613
-- Project    : PS2 Basic Protocol
-- Details    : www.ic.unicamp.br/~corte/mc613/
--              www.computer-engineering.org/ps2protocol/
-------------------------------------------------------------------------------
-- File       : ps2_base.vhd
-- Author     : Thiago Borges Abdnur
-- Company    : IC - UNICAMP
-- Last update: 2010/04/12
-------------------------------------------------------------------------------
-- Description: 
-- PS2 basic control
-------------------------------------------------------------------------------

LIBRARY ieee;
USE ieee.std_logic_1164.all;
USE ieee.numeric_std.all;

entity ps2_iobase is
   generic (
      clkfreq_g      : integer                        -- This is the system clock value in kHz
   );
   port(
      clock_i        : in    std_logic;                  -- system clock (same frequency as defined in 'clkfreq_g' generic)
      reset_i        : in    std_logic;                  -- Reset when '1'
      enable_i       : in    std_logic;               -- Enable
      
      ps2_data_i     : in std_logic;                     -- PS2 data pin
      ps2_clk_i      : in std_logic;                     -- PS2 clock pin
      ps2_data_o     : out std_logic;                 -- PS2 data pin
      ps2_clk_o      : out std_logic;                 -- PS2 clock pin
      ps2_data_out   : out std_logic;                 -- "1" when data is set    
      ps2_clk_out    : out std_logic;                 -- "1" when clock is set      
      
      data_rdy_i     : in    std_logic;                     -- Rise this to signal data is ready to be sent to device
      data_i         : in    std_logic_vector(7 downto 0);  -- Data to be sent to device
      send_rdy_o     : out   std_logic;                     -- '1' if data can be sent to device (wait for this before rising 'data_rdy_i'
      data_rdy_o     : out   std_logic;                     -- '1' when data from device has arrived
      data_o         : out   std_logic_vector(7 downto 0);  -- Data from device
      sigsending_o   : out   std_logic
   );
end;

architecture rtl of ps2_iobase is

   constant CLKSSTABLE     : integer := clkfreq_g / 150;
             
   signal sdata, hdata     : std_logic_vector(7 downto 0);
   signal sigtrigger       : std_logic;
   signal parchecked       : std_logic;
   signal sigsending       : std_logic;
   signal sigsendend       : std_logic;
   signal sigclkreleased   : std_logic;
   signal sigclkheld       : std_logic;

begin

   -- Trigger for state change to eliminate noise
   process(clock_i, ps2_clk_i, enable_i, reset_i)
      variable fcount, rcount : integer range CLKSSTABLE downto 0;
   begin
      if(rising_edge(clock_i) and enable_i = '1') then
         if reset_i = '1' then
            fcount := 0;
            rcount := 0;
            sigtrigger <= '0';
         -- Falling edge noise
         elsif ps2_clk_i = '0' then
            rcount := 0;
            if fcount >= CLKSSTABLE then
               sigtrigger <= '1';
            else
               fcount := fcount + 1;
            end if;
         -- Rising edge noise
         elsif ps2_clk_i = '1' then
            fcount := 0;
            if rcount >= CLKSSTABLE then
               sigtrigger <= '0';
            else
               rcount := rcount + 1;
            end if;
         end if;
      end if;
   end process;

   FROMPS2:
   process(sigtrigger, sigsending, reset_i)
      variable count : integer range 0 to 11;
   begin
      if reset_i = '1' or sigsending = '1' then
         sdata <= (others => '0');
         parchecked <= '0';
         count := 0;
      elsif rising_edge(sigtrigger) then
         if count = 0 then
            -- Idle state, check for start bit (0) only and don't
            -- start counting bits until we get it
            if ps2_data_i = '0' then
               -- This is a start bit
               count := count + 1;
            end if;
         else
            -- Running.  8-bit data comes in LSb first followed by
            -- a single stop bit (1)
            if count < 9 then
               sdata(count - 1) <= ps2_data_i;
            end if;
            if count = 9 then
               if (not (sdata(0) xor sdata(1) xor sdata(2) xor sdata(3)
                xor sdata(4) xor sdata(5) xor sdata(6) xor sdata(7))) = ps2_data_i then
                  parchecked <= '1';
               else
                  parchecked <= '0';
               end if;
            end if;
            count := count + 1;
            if count = 11 then
               count := 0;
               parchecked <= '0';
            end if;
         end if;
      end if;
   end process;

   data_rdy_o  <= enable_i and parchecked;
   data_o      <= sdata;

   -- Edge triggered send register
   process(data_rdy_i, sigsendend, reset_i)
   begin
      if(rising_edge(data_rdy_i)) then
         sigsending <= '1';
      end if;
      if reset_i = '1' or sigsendend = '1' then
         sigsending <= '0';
      end if;
   end process;

   -- Wait for at least 11ms before allowing to send again
   process(clock_i, sigsending, reset_i)
      -- clkfreq_g is the number of clocks within a milisecond
      variable countclk : integer range 0 to (12 * clkfreq_g);
   begin
      if(rising_edge(clock_i) and sigsending = '0') then       
         if countclk = (11 * clkfreq_g) then
            send_rdy_o <= '1';
         else
            countclk := countclk + 1;
         end if;
      end if;
      if sigsending = '1' then
         send_rdy_o <= '0';
         countclk := 0;
      end if;
      if reset_i = '1' then
         send_rdy_o <= '1';
         countclk := 0;
      end if;
   end process;
   
   -- Host input data register
   process(data_rdy_i, sigsendend, reset_i)
   begin
      if(rising_edge(data_rdy_i)) then
         hdata <= data_i;
      end if;
      if reset_i = '1' or sigsendend = '1' then
         hdata <= (others => '0');
      end if;
   end process;
   
   -- PS2 clock control
   process(enable_i, clock_i, sigsendend, reset_i, sigsending)
      constant US100CNT : integer := clkfreq_g / 10;
      variable count : integer range 0 to US100CNT + 101;
   begin
      if(rising_edge(clock_i) and sigsending = '1') then
         if count < US100CNT + 50 then
            count := count + 1;
            ps2_clk_o <= '0';
            ps2_clk_out <= '1';
            sigclkreleased <= '0';
            sigclkheld <= '0';
         elsif count < US100CNT + 100 then
            count := count + 1;
            ps2_clk_o <= '0';
            ps2_clk_out <= '1';
            sigclkreleased <= '0';
            sigclkheld <= '1';
         else
            ps2_clk_o <= '1';
            ps2_clk_out <= '0';
            sigclkreleased <= '1';
            sigclkheld <= '0';
         end if;
      end if;
      if enable_i = '0' or reset_i = '1' or sigsendend = '1' then
         ps2_clk_o      <= '1';
         ps2_clk_out    <= '0';
         sigclkreleased <= '1';
         sigclkheld     <= '0';
         count          := 0;
      end if;
   end process;

   -- Sending control
   TOPS2:
   process(enable_i, sigtrigger, sigsending, sigclkheld, sigclkreleased, reset_i)
      variable count : integer range 0 to 11;
   begin
      if(rising_edge(sigtrigger) and sigclkreleased = '1' and sigsending = '1') then
         if count >= 0 and count < 8 then
            ps2_data_o <= hdata(count);
            sigsendend <= '0';
            ps2_data_out <= '1';
         end if;
         if count = 8 then
            ps2_data_o <= (not (hdata(0) xor hdata(1) xor hdata(2) xor hdata(3)
             xor hdata(4) xor hdata(5) xor hdata(6) xor hdata(7)));
            sigsendend <= '0';
            ps2_data_out <= '1';
         end if;
         if count = 9 then
            ps2_data_o <= '1';
            ps2_data_out <= '0';
            sigsendend <= '0';
         end if;        
         if count = 10 then            
            ps2_data_o <= '1';
            ps2_data_out <= '0';
            sigsendend <= '1';
            count := 0;
         end if;
         count := count + 1;
      end if;     
      if sigclkheld = '1' then
         ps2_data_o <= '0';
         ps2_data_out <= '1';
         sigsendend <= '0';
         count := 0;
      end if;
      if enable_i = '0' or reset_i = '1' or sigsending = '0' then
         ps2_data_o <= '1';
         ps2_data_out <= '0';
         sigsendend <= '0';         
         count := 0;
      end if;
   end process;
   
   sigsending_o <= sigsending;

end rtl;
