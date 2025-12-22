
-- Function Keys Emulation
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

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity emu_fnkeys is
   generic
   (
      CLOCK_EN_PERIOD_MS   : natural;
      BUTTON_PERIOD_MS     : natural
   );
   port
   (
      i_CLK             : in  std_logic;
      i_CLK_EN          : in  std_logic;
      
      i_reset           : in  std_logic;
      
      i_rows            : in  std_logic_vector(7 downto 0);
      o_rows_filtered   : out std_logic_vector(7 downto 0);
      
      i_cols            : in  std_logic_vector(4 downto 0);
      o_cols_filtered   : out std_logic_vector(4 downto 0);
      
      i_button_m1_n     : in  std_logic;
      i_button_reset_n  : in  std_logic;
      
      o_fnkeys          : out std_logic_vector(10 downto 1)
   );
end entity;

architecture rtl of emu_fnkeys is

   constant PERIOD         : natural                        := BUTTON_PERIOD_MS / CLOCK_EN_PERIOD_MS;
   signal timer_count      : natural range 0 to PERIOD      := 0;
   
   signal timer_set        : std_logic;
   signal timer_expired    : std_logic;
   
   type state_t is (S_IDLE, S_MF_ROW_A11, S_MF_ROW_A12, S_MF_CHECK, S_MF_DONE, S_RESET_CHECK, S_RESET_DONE);
   
   signal state            : state_t;
   signal next_state       : state_t;
   
   signal local_rows       : std_logic_vector(7 downto 0);
   signal local_cols       : std_logic_vector(4 downto 0);
   
   signal cancel_nmi       : std_logic := '0';
   signal local_fnkeys     : std_logic_vector(10 downto 1)  := (others => '0');

begin

   o_rows_filtered <= local_rows;
   o_cols_filtered <= local_cols;
   
   o_fnkeys <= local_fnkeys;
   
   --
   -- timer
   --
   
   timer_set <= '1' when state = S_IDLE and (i_button_reset_n = '0' or i_button_m1_n = '0') else '0';
   timer_expired <= '1' when timer_count = 0 else '0';
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            timer_count <= 0;
         elsif timer_set = '1' then
            timer_count <= PERIOD;
         elsif i_CLK_EN = '1' and timer_expired = '0' then
            timer_count <= timer_count - 1;
         end if;
      end if;
   end process;
   
   --
   -- state machine
   --
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            state <= S_IDLE;
         else
            state <= next_state;
         end if;
      end if;
   end process;

   process (state, i_button_m1_n, i_button_reset_n)
   begin
      case state is
         
         when S_IDLE =>
            if i_button_reset_n = '0' then
               next_state <= S_RESET_CHECK;
            elsif i_button_m1_n = '0' then
               next_state <= S_MF_ROW_A11;
            else
               next_state <= S_IDLE;
            end if;
         
         when S_MF_ROW_A11 =>
            next_state <= S_MF_ROW_A12;
         
         when S_MF_ROW_A12 =>
            next_state <= S_MF_CHECK;
         
         when S_MF_CHECK =>
            if i_button_m1_n = '1' then
               next_state <= S_MF_DONE;
            else
               next_state <= S_MF_ROW_A11;
            end if;
         
         when S_MF_DONE =>
            next_state <= S_IDLE;
         
         when S_RESET_CHECK =>
            if i_button_reset_n = '1' then
               next_state <= S_RESET_DONE;
            else
               next_state <= S_RESET_CHECK;
            end if;
         
         when S_RESET_DONE =>
            next_state <= S_IDLE;
         
         when others =>
            next_state <= S_IDLE;
         
      end case;
   end process;
   
   local_rows <= i_rows when state = S_IDLE else "11110111" when state = S_MF_ROW_A11 else "11101111";
   local_cols <= i_cols when state = S_IDLE else (others => '1');
   
   --
   -- function keys
   --

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            cancel_nmi <= '0';
         elsif state = S_IDLE then
            cancel_nmi <= '0';
         else
            cancel_nmi <= cancel_nmi or not (i_cols(4) and i_cols(3) and i_cols(2) and i_cols(1) and i_cols(0));
         end if;
      end if;
   end process;
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            local_fnkeys <= (others => '0');
         elsif state = S_MF_ROW_A11 then
            local_fnkeys(5 downto 1) <= not i_cols(4 downto 0);
         elsif state = S_MF_ROW_A12 then
            local_fnkeys(10 downto 6) <= not (i_cols(0) & i_cols(1) & i_cols(2) & i_cols(3) & i_cols(4));
         elsif state = S_MF_DONE then
            local_fnkeys <= '0' & (not timer_expired and not cancel_nmi) & "00000000";  -- F9 = multiface nmi on short press
         elsif state = S_RESET_DONE then
            if timer_expired = '1' then
               local_fnkeys <= "0000000001";   -- F1 = hard reset on long press
            else
               local_fnkeys <= "0000001000";   -- F4 = soft reset on short press
            end if;
         elsif state = S_IDLE then
            local_fnkeys <= (others => '0');
         end if;
      end if;
   end process;

end architecture;
