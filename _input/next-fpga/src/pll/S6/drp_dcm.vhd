-- PROGRAM SPARTAN 6 DCM_CLKGEN
-- Copyright 2023 Alvin Albrecht
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

-- Program DFS M/D ratio

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

library UNISIM;
use UNISIM.vcomponents.all;

entity drp_dcm is
   port
   (
      RESET        : in std_logic;                      -- reset programming sequence with new frame
      
      START        : in std_logic;                      -- start programming single M/D multiplier
      DONE         : out std_logic;                     -- programming sequence complete
      FRAME        : in std_logic_vector(2 downto 0);   -- chosen video frame
      
      PROGCLK      : in std_logic;
      PROGEN       : out std_logic;                     -- to DCM_CLKGEN
      PROGDATA     : out std_logic;                     -- to DCM_CLKGEN
      PROGDONE     : in std_logic;                      -- from DCM_CLKGEN
      LOCKED       : in std_logic                       -- from DCM_CLKGEN
   );
end entity;

architecture rtl of drp_dcm is

   type   state_t        is (S_0, S_EN, S_L0, S_LOAD_D, S_D, S_LOAD_W0, S_W0, S_LOAD_M, S_M, S_LOAD_W1, S_W1, S_GO, S_L1, S_DONE);
   signal state          : state_t := S_0;
   signal state_next     : state_t;

   signal S0             : std_logic;
   signal load_w         : std_logic;
   signal load_d         : std_logic;
   signal load_m         : std_logic;
   
   signal rom_addr       : std_logic_vector(4 downto 0) := (others => '0');
   signal rom_data       : std_logic_vector(7 downto 0);
   
   type rom_t            is array (0 to 19) of std_logic_vector (7 downto 0);
   constant rom_dcm      : rom_t := (
      -- 0 = 48K 50Hz
      X"33", X"4A",      -- DCM_1 : D = 52-1, M =  75-1
      X"0F", X"0E",      -- DCM_2 : D = 16-1, M =  15-1
      -- 1 = 128K 50Hz
      X"12", X"D1",      -- DCM_1 : D = 19-1, M = 210-1
      X"01", X"4A",      -- DCM_2 : D =  2-1, M =  75-1
      -- 2 = Pent 50Hz
      X"1F", X"2C",      -- DCM_1 : D = 32-1, M =  45-1
      X"0F", X"0E",      -- DCM_2 : D = 16-1, M =  15-1
      -- 3 = 48K 60Hz
      X"1F", X"22",      -- DCM_1 : D = 32-1, M =  35-1
      X"1F", X"26",      -- DCM_2 : D = 32-1, M =  39-1
      -- 4 = 128K 60Hz
      X"25", X"30",      -- DCM_1 : D = 38-1, M =  49-1
      X"3F", X"40"       -- DCM_2 : D = 64-1, M =  65-1
   );

   signal count          : std_logic_vector(3 downto 0) := (others => '0');
   signal count_0        : std_logic;
   signal shift_r        : std_logic_vector(9 downto 0) := (others => '0');

begin

   -- state machine
   
   process (PROGCLK)
   begin
      if rising_edge(PROGCLK) then
         if RESET = '1' or state_next = S_0 then
            state <= S_0;
         else
            state <= state_next;
         end if;
      end if;
   end process;
   
   process (state, START, LOCKED, PROGDONE, count_0)
   begin
      case state is
         when S_0 =>
            state_next <= S_EN;
         when S_EN =>
            if START = '0' then
               state_next <= S_EN;
            else
               state_next <= S_L0;
            end if;
         when S_L0 =>
            if LOCKED = '0' or PROGDONE = '0' then
               state_next <= S_L0;
            else
               state_next <= S_LOAD_D;
            end if;
         when S_LOAD_D =>
            state_next <= S_D;
         when S_D =>
            if count_0 = '1' then
               state_next <= S_LOAD_W0;
            else
               state_next <= S_D;
            end if;
         when S_LOAD_W0 =>
            state_next <= S_W0;
         when S_W0 =>
            if count_0 = '1' then
               state_next <= S_LOAD_M;
            else
               state_next <= S_W0;
            end if;
         when S_LOAD_M =>
            state_next <= S_M;
         when S_M =>
            if count_0 = '1' then
               state_next <= S_LOAD_W1;
            else
               state_next <= S_M;
            end if;
         when S_LOAD_W1 =>
            state_next <= S_W1;
         when S_W1 =>
            if count_0 = '1' then
               state_next <= S_GO;
            else
               state_next <= S_W1;
            end if;
         when S_GO =>
            state_next <= S_L1;
         when S_L1 =>
            if LOCKED = '0' or PROGDONE = '0' then
               state_next <= S_L1;
            else
               state_next <= S_DONE;
            end if;
         when S_DONE =>
            state_next <= S_EN;
         when others =>
            state_next <= S_0;
      end case;
   end process;

   -- control signals
   
   S0 <= '1' when state = S_0 else '0';
   
   load_w <= '1' when state = S_LOAD_W0 or state = S_LOAD_W1 else '0';
   load_d <= '1' when state = S_LOAD_D else '0';
   load_m <= '1' when state = S_LOAD_M else '0';

   -- program rom
   
   process (PROGCLK)
   begin
      if rising_edge(PROGCLK) then
         if S0 = '1' then
            rom_addr <= FRAME & "00";
         elsif load_w = '1' then
            rom_addr <= rom_addr + 1;
         end if;
      end if;
   end process;
   
   rom_data <= rom_dcm(conv_integer(rom_addr));

   -- counter
   
   process (PROGCLK)
   begin
      if rising_edge(PROGCLK) then
         if S0 = '1' then
            count <= (others => '0');
         elsif load_w = '1' then
            count <= "0100";
         elsif load_d = '1' or load_m = '1' then
            count <= "1001";
         elsif count_0 = '0' then
            count <= count - 1;
         end if;
      end if;
   end process;
   
   count_0 <= '1' when count = 0 else '0';

   -- shift register
   
   process (PROGCLK)
   begin
      if rising_edge(PROGCLK) then
         if S0 = '1' then
            shift_r <= (others => '0');
         elsif load_d = '1' then
            shift_r <= rom_data & "01";
         elsif load_m = '1' then
            shift_r <= rom_data & "11";
         else
            shift_r <= '0' & shift_r(9 downto 1);
         end if;
      end if;
   end process;
   
   -- output

   process (PROGCLK)
   begin
      if rising_edge(PROGCLK) then
         if state = S_D or state = S_M or state = S_GO then
            PROGEN <= '1';
         else
            PROGEN <= '0';
         end if;
      end if;
   end process;

   process (PROGCLK)
   begin
      if rising_edge(PROGCLK) then
         PROGDATA <= shift_r(0);
      end if;
   end process;
   
   DONE <= '1' when state = S_DONE else '0';

end architecture;

