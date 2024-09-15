-- UART TX
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

-- UART Transmitter
--
-- Sending:
--
--   1. Wait for o_busy = 0 (break state will hold o_busy = 1)
--   2. Set i_Tx_byte = byte to send, i_Tx_en = 1 for one cycle
--
-- Prescaler:
--
-- One bit period is i_CLK divided by i_prescaler
--
-- Framing:
--
-- i_frame holds framing information:
--
--   bit 7 = 1 to immediately reset Tx to idle; any in flight byte is ended prematurely
--   bit 6 = 1 to hold break (o_Tx = 0) while Tx is idle (cannot send in break state)
--   bit 5 = 1 to enable flow control signal i_rdr (1 = receiver ready)
--   bits 4:3 = # bits in frame (11 = 8, 10 = 7, 01 = 6, 00 = 5)
--   bit 2 = parity enable
--   bit 1 = 1 for odd parity, 0 for even parity
--   bit 0 = 0 for one stop bit, 1 for two stop bits
--
--  The prescaler and frame bits 4:0 are sampled at the time a byte is sent to hold
--  Tx parameters constant through a transmission.
--

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;
 
entity uart_tx is
   generic (
      PRESCALER_BITS       : positive := 17                      -- number of bits in bit period divisor
   );
   port 
   (
      i_CLK                : in std_logic;
      i_reset              : in std_logic;
      
      -- configuration
      
      i_frame              : in std_logic_vector(7 downto 0);    -- reset, break, flow control, # bits (2), parity en, parity odd, stop bits
      i_prescaler          : in std_logic_vector(PRESCALER_BITS-1 downto 0);   -- baud rate divisor
      
      -- send byte
      
      o_busy               : out std_logic;                      -- 0 = Tx ready for next byte
      
      i_Tx_en              : in std_logic;                       -- 1 = byte is being written (one cycle)
      i_Tx_byte            : in std_logic_vector(7 downto 0);
      
      i_cts_n              : in std_logic;                       -- 0 = receiver is ready for Tx (if flow control is enabled)  

      -- serial out

      o_Tx                 : out std_logic
   );
end entity;

architecture rtl of uart_tx is

   signal tx_frame_parity_en     : std_logic;
   signal tx_frame_stop_bits     : std_logic;
   signal tx_prescaler           : std_logic_vector(PRESCALER_BITS-1 downto 0);
   
   signal tx_shift               : std_logic_vector(7 downto 0);
   
   signal tx_timer_expired       : std_logic;
   signal tx_timer               : std_logic_vector(PRESCALER_BITS-1 downto 0);
   
   signal tx_bit_count_expired   : std_logic;
   signal tx_bit_count           : std_logic_vector(2 downto 0);
   signal tx_parity              : std_logic;

   type state_t                  is (S_IDLE, S_RTR, S_START, S_BITS, S_PARITY, S_STOP_1, S_STOP_2);
   signal state                  : state_t;
   signal state_next             : state_t;

begin
   
   -- TRANSMISSION VARIABLES
   
   process (i_CLK)
   begin
      if falling_edge(i_CLK) then
         if state = S_IDLE then
            tx_frame_parity_en <= i_frame(2);
            tx_frame_stop_bits <= i_frame(0);
            tx_prescaler <= i_prescaler;
         end if;
      end if;
   end process;
   
   -- shift register
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if state = S_IDLE then
            tx_shift <= i_Tx_byte;
         elsif state = S_BITS and tx_timer_expired = '1' then
            tx_shift <= '0' & tx_shift(7 downto 1);
         end if;
      end if;
   end process;
   
   -- baud rate timer
   
   tx_timer_expired <= '1' when tx_timer(PRESCALER_BITS-1 downto 1) = std_logic_vector(to_unsigned(0,PRESCALER_BITS-1)) else '0';
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if (state /= state_next) or tx_timer_expired = '1' then
            tx_timer <= tx_prescaler;
         else
            tx_timer <= tx_timer - 1;
         end if;
      end if;
   end process;
   
   -- bit counter & parity calculation
   
   tx_bit_count_expired <= '1' when tx_bit_count = "000" else '0';
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if state = S_IDLE then
            tx_bit_count <= '1' & i_frame(4 downto 3);
            tx_parity <= i_frame(1);
         elsif state = S_BITS and tx_timer_expired = '1' then
            tx_bit_count <= tx_bit_count - 1;
            tx_parity <= tx_parity xor tx_shift(0);
         end if;
      end if;
   end process;

   -- STATE MACHINE
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or i_frame(7) = '1' then
            state <= S_IDLE;
         else
            state <= state_next;
         end if;
      end if;
   end process;
   
   process (state, i_frame, i_Tx_en, i_cts_n, tx_timer_expired, tx_bit_count_expired, tx_frame_parity_en, tx_frame_stop_bits)
   begin
      case state is
         when S_IDLE =>
            if i_frame(6) = '1' or i_Tx_en = '0' then
               state_next <= S_IDLE;
            elsif i_Tx_en = '1' and (i_cts_n = '0' or i_frame(5) = '0') then
               state_next <= S_START;
            elsif i_Tx_en = '1' and (i_cts_n = '1' and i_frame(5) = '1') then
               state_next <= S_RTR;
            else
               state_next <= S_IDLE;
            end if;
         when S_RTR =>
            if i_cts_n = '1' and i_frame(5) = '1' then
               state_next <= S_RTR;
            else
               state_next <= S_START;
            end if;
         when S_START =>
            if tx_timer_expired = '1' then
               state_next <= S_BITS;
            else
               state_next <= S_START;
            end if;
         when S_BITS =>
            if tx_bit_count_expired = '0' or tx_timer_expired = '0' then
               state_next <= S_BITS;
            elsif tx_frame_parity_en = '1' then
               state_next <= S_PARITY;
            else
               state_next <= S_STOP_1;
            end if;
         when S_PARITY =>
            if tx_timer_expired = '1' then
               state_next <= S_STOP_1;
            else
               state_next <= S_PARITY;
            end if;
         when S_STOP_1 => 
            if tx_timer_expired = '0' then
               state_next <= S_STOP_1;
            elsif tx_frame_stop_bits = '1' then
               state_next <= S_STOP_2;
            else
               state_next <= S_IDLE;
            end if;
         when S_STOP_2 =>
            if tx_timer_expired = '0' then
               state_next <= S_STOP_2;
            else
               state_next <= S_IDLE;
            end if;
         when others =>
            state_next <= S_IDLE;
      end case;
   end process;

   -- OUTPUT

   o_busy <= '1' when state /= S_IDLE or i_frame(7) = '1' or i_frame(6) = '1' else '0';
   
   process (state, i_frame, tx_shift, tx_parity)
   begin
      case state is
         when S_IDLE   => o_Tx <= not i_frame(6);
         when S_START  => o_Tx <= '0';
         when S_BITS   => o_Tx <= tx_shift(0);
         when S_PARITY => o_Tx <= tx_parity;
         when others   => o_Tx <= '1';
      end case;
   end process;
   
end architecture;
