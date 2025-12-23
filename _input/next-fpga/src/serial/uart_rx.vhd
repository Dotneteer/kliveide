-- UART RX
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

-- UART Receiver
--
-- Receiving:
--
--   Byte is available on o_Rx_byte when o_Rx_avail = 1 for one cycle.
--
-- Errors:
--
--   1. o_err_framing = 1 for one cycle if expected stop bits are not present
--   2. o_err_parity = 1 for one cycle if there is a parity mismatch
--   3. o_err_break = 1 while a break condition exists
--
-- A received byte that is accompanied by an error is thrown away.
--
-- Prescaler:
--
-- One bit period is i_CLK divided by i_prescaler
--
-- Framing:
--
-- i_frame holds framing information:
--
--   bit 7 = 1 to immediately reset Rx to idle
--   bit 6 = pause when in idle state
--   bit 5 = enable hw flow control (not applicable here)
--   bits 4:3 = # bits in frame (11 = 8, 10 = 7, 01 = 6, 00 = 5)
--   bit 2 = parity enable
--   bit 1 = 1 for odd parity, 0 for even parity
--   bit 0 = 0 for one stop bit, 1 for two stop bits
--
-- The prescaler and frame bits 4:0 are sampled when the start bit is seen so
-- that the Rx parameters remain constant through the receive.
--

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity uart_rx is
   generic (
      PRESCALER_BITS       : positive := 17;                     -- number of bits in bit period divisor
      NOISE_REJECTION_BITS : positive := 2                       -- pulse widths less than 2^NOISE_REJECTION_BITS / i_CLK will be rejected
   );
   port 
   (
      i_CLK                : in std_logic;
      i_reset              : in std_logic;
      
      -- configuration
      
      i_frame              : in std_logic_vector(7 downto 0);    -- reset, pause, flow control (n/a here), # bits (2), parity en, parity odd, stop bits
      i_prescaler          : in std_logic_vector(PRESCALER_BITS-1 downto 0);   -- baud rate divisor
      
      -- receive byte
      
      o_Rx_avail           : out std_logic;                      -- 1 = Rx has byte (one cycle)
      o_Rx_byte            : out std_logic_vector(7 downto 0);

      o_err_framing        : out std_logic;                      -- one cycle
      o_err_parity         : out std_logic;                      -- one cycle
      o_err_break          : out std_logic;                      -- held as long as condition exists

      -- serial in

      i_Rx                 : in std_logic
   );
end entity;

architecture rtl of uart_rx is

   signal Rx                     : std_logic;
   signal Rx_d                   : std_logic;
   signal Rx_e                   : std_logic;
   
   signal rx_frame_bits          : std_logic_vector(1 downto 0);
   signal rx_frame_parity_en     : std_logic;
   signal rx_frame_stop_bits     : std_logic;
   signal rx_prescaler           : std_logic_vector(PRESCALER_BITS-1 downto 0);
   
   signal rx_shift               : std_logic_vector(7 downto 0);
   
   signal rx_timer_expired       : std_logic;
   signal rx_timer               : std_logic_vector(PRESCALER_BITS-1 downto 0);
   signal rx_timer_updated       : std_logic;
   
   signal rx_bit_count_expired   : std_logic;
   signal rx_bit_count           : std_logic_vector(2 downto 0);
   signal rx_parity              : std_logic;

   type state_t                  is (S_IDLE, S_START, S_BITS, S_PARITY, S_STOP_1, S_STOP_2, S_ERROR, S_PAUSE);
   signal state                  : state_t;
   signal state_next             : state_t;

begin

   -- NOISE REJECTION
   
   db : entity work.debounce
   generic map
   (
      INITIAL_STATE  => '1',
      COUNTER_SIZE   => NOISE_REJECTION_BITS
   )
   port map
   (
      clk_i          => i_CLK,
      clk_en_i       => '1',
      button_i       => i_Rx,
      button_o       => Rx
   );
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         Rx_d <= Rx;
      end if;
   end process;
   
   Rx_e <= Rx xor Rx_d;

   -- RECEIVE VARIABLES
   
   process (i_CLK)
   begin
      if falling_edge(i_CLK) then
         if state = S_IDLE then
            rx_frame_bits <= i_frame(4 downto 3);
            rx_frame_parity_en <= i_frame(2);
            rx_frame_stop_bits <= i_frame(0);
            rx_prescaler <= i_prescaler;
         end if;
      end if;
   end process;

   -- shift register
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if state = S_START or state_next = S_ERROR then
            rx_shift <= (others => '1');
         elsif (state = S_BITS or state = S_ERROR) and rx_timer_expired = '1' then
            rx_shift <= Rx & rx_shift(7 downto 1);
         elsif state = S_STOP_1 and rx_timer_expired = '1' then
            case rx_frame_bits is
               when "10"   => rx_shift <= '0' & rx_shift(7 downto 1);
               when "01"   => rx_shift <= "00" & rx_shift(7 downto 2);
               when "00"   => rx_shift <= "000" & rx_shift(7 downto 3);
               when others => rx_shift <= rx_shift;
            end case;
         end if;
      end if;
   end process;
   
   -- baud rate timer

   rx_timer_expired <= '1' when rx_timer(PRESCALER_BITS-1 downto 1) = std_logic_vector(to_unsigned(0,PRESCALER_BITS-1)) else '0';

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if state = S_IDLE then
            rx_timer <= '0' & rx_prescaler(PRESCALER_BITS-1 downto 1);
         elsif rx_timer_expired = '1' then
            rx_timer <= rx_prescaler;
            rx_timer_updated <= '0';
         elsif state /= S_START and Rx_e = '1' and rx_timer_updated = '0' then
            rx_timer <= '0' & rx_prescaler(PRESCALER_BITS-1 downto 1);
            rx_timer_updated <= '1';
         else
            rx_timer <= rx_timer - 1;
         end if;
      end if;
   end process;

   -- bit counter & parity calculation
   
   rx_bit_count_expired <= '1' when rx_bit_count = "000" else '0';
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if state = S_IDLE then
            rx_bit_count <= '1' & rx_frame_bits;
            rx_parity <= i_frame(1);
         elsif state = S_BITS and rx_timer_expired = '1' then
            rx_bit_count <= rx_bit_count - 1;
            rx_parity <= rx_parity xor Rx;
         end if;
      end if;
   end process;

   -- STATE MACHINE

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or i_frame(7) = '1' then
            state <= S_PAUSE;
         else
            state <= state_next;
         end if;
      end if;
   end process;
   
   process (state, Rx, rx_timer_expired, rx_bit_count_expired, rx_frame_parity_en, rx_parity, rx_frame_stop_bits, i_frame)
   begin
      case state is
         when S_IDLE =>
            if i_frame(6) = '1' then
               state_next <= S_PAUSE;
            elsif Rx = '0' then
               state_next <= S_START;
            else
               state_next <= S_IDLE;
            end if;
         when S_START =>
            if Rx = '1' then
               state_next <= S_IDLE;
            elsif rx_timer_expired = '1' then
               state_next <= S_BITS;
            else
               state_next <= S_START;
            end if;
         when S_BITS =>
            if rx_bit_count_expired = '0' or rx_timer_expired = '0' then
               state_next <= S_BITS;
            elsif rx_frame_parity_en = '1' then
               state_next <= S_PARITY;
            else
               state_next <= S_STOP_1;
            end if;
         when S_PARITY =>
            if rx_timer_expired = '0' then
               state_next <= S_PARITY;
            elsif Rx = rx_parity then
               state_next <= S_STOP_1;
            else
               state_next <= S_ERROR;
            end if;
         when S_STOP_1 =>
            if rx_timer_expired = '0' then
               state_next <= S_STOP_1;
            elsif Rx = '0' then
               state_next <= S_ERROR;
            elsif rx_frame_stop_bits = '1' then
               state_next <= S_STOP_2;
            else
               state_next <= S_IDLE;
            end if;
         when S_STOP_2 =>
            if rx_timer_expired = '0' then
               state_next <= S_STOP_2;
            elsif Rx = '0' then
               state_next <= S_ERROR;
            else
               state_next <= S_IDLE;
            end if;
         when S_ERROR =>
            if Rx = '0' then
               state_next <= S_ERROR;
            else
               state_next <= S_IDLE;
            end if;
         when S_PAUSE =>
            if i_frame(6) = '1' or Rx = '0' then
               state_next <= S_PAUSE;
            else
               state_next <= S_IDLE;
            end if;
         when others =>
            state_next <= S_IDLE;
      end case;
   end process;

   -- OUTPUT
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if (state = S_STOP_1 or state = S_STOP_2) and state_next = S_IDLE then
            o_Rx_avail <= '1';
         else
            o_Rx_avail <= '0';
         end if;
      end if;
   end process;
   
   o_Rx_byte <= rx_shift;

   o_err_parity <= '1' when state = S_PARITY and state_next = S_ERROR else '0';
   o_err_framing <= '1' when (state = S_STOP_1 or state = S_STOP_2) and state_next = S_ERROR else '0';
   o_err_break <= '1' when state = S_ERROR and rx_shift = "00000000" else '0';

end architecture;
