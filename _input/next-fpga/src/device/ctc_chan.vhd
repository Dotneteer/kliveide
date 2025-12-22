-- Z80 CTC Channel
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

-- One channel of a Z80 CTC (counter/timer circuit)
-- http://www.zilog.com/docs/z80/ps0181.pdf
--
-- Clarifications:
--
-- 1. Hard reset requires a control word to be written with D2 = 1
--    (time constant follows) otherwise the channel effectively
--    ignores the control word and will remain in the hard reset state.
--
-- 2. Soft reset is generated when the control word's D1 = 1.  if
--    D2 = 0, the channel will enter the hard reset state.  If D2 = 1
--    the channel expects a time constant to be written next and after
--    that the counter/timer will run as expected.
--
-- 3. Changing the trigger edge selection in bit 4 counts as a clock edge.
--    A timer waiting for a clock edge to start will start and in counter
--    mode, the count will be decremented.
--
-- 4. ZC/TO is asserted for one clock cycle and not for the entire
--    duration that the count is at zero.

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity ctc_chan is
   port (
   
      i_CLK       : in std_logic;
      i_reset     : in std_logic;   -- hard reset
      
      i_iowr      : in std_logic;   -- write to this channel
      o_iowr_tc   : out std_logic;  -- channel expects time constant next (ignore vector write)

      i_int_en_wr : in std_logic;   -- separately write interrupt enable, must not overlap iowr
      i_int_en    : in std_logic;

      i_cpu_d     : in std_logic_vector(7 downto 0);
      o_cpu_d     : out std_logic_vector(7 downto 0);  -- current count

      i_clk_trg   : in std_logic;   -- external clock / trigger, must be synchronized with rising edge of i_CLK

      o_zc_to     : out std_logic;  -- asserted for one i_CLK cycle
      o_int_en    : out std_logic   -- set if interrupt is enabled

   );
end entity;

architecture rtl of ctc_chan is

   signal reset_hard             : std_logic;
   signal reset_soft             : std_logic;
   
   signal clk_trg_d              : std_logic;
   signal clk_trg_edge           : std_logic;
   
   signal p_count                : std_logic_vector(7 downto 0);
   signal p_count_lo             : std_logic;
   signal p_count_hi             : std_logic;
   signal prescaler_clk          : std_logic;
   
   signal t_count_en             : std_logic;
   signal t_count_zero           : std_logic;
   signal t_count                : std_logic_vector(7 downto 0);
   signal t_count_zero_d         : std_logic;
   signal zc_to                  : std_logic;
   
   type   state_t                is (S_CONTROL_WORD, S_TIME_CONSTANT, S_WAIT, S_RUNNING);
   signal state                  : state_t;
   signal state_next             : state_t;
   
   signal iowr_d                 : std_logic;
   signal iowr                   : std_logic;
   signal iowr_tc_exp            : std_logic;
   signal iowr_tc                : std_logic;
   signal iowr_cr                : std_logic;
   signal control_reg            : std_logic_vector(5 downto 0);
   signal time_constant_reg      : std_logic_vector(7 downto 0);
   signal reset_soft_trigger     : std_logic;
   signal clk_edge_change        : std_logic;
   
begin

   -- RESET

   reset_hard <= i_reset;
   reset_soft <= '1' when state /= S_RUNNING else '0';

   -- CLOCK / TRIGGER

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         clk_trg_d <= i_clk_trg;
      end if;
   end process;

   clk_trg_edge <= ((clk_trg_d and not i_clk_trg) or clk_edge_change) when control_reg(4-2) = '0' else ((i_clk_trg and not clk_trg_d) or clk_edge_change);  -- one cycle

   -- PRESCALER

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if reset_soft = '1' then
            p_count <= (others => '0');
         else
            p_count <= p_count + 1;
         end if;
      end if;
   end process;

   p_count_lo <= '1' when p_count(3 downto 0) = "1111" else '0';
   p_count_hi <= '1' when p_count(7 downto 4) = "1111" else '0';

   prescaler_clk <= (p_count_lo) when control_reg(5-2) = '0' else (p_count_lo and p_count_hi);  -- one cycle

   -- COUNTER

   t_count_en <= prescaler_clk when control_reg(6-2) = '0' else clk_trg_edge;
   t_count_zero <= '1' when t_count = X"00" else '0';

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if reset_soft = '1' then
            t_count <= time_constant_reg;
         elsif zc_to = '1' then
            t_count <= time_constant_reg;
         elsif t_count_en = '1' then
            t_count <= t_count - 1;
         end if;
      end if;
   end process;
   
   o_cpu_d <= t_count;

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         t_count_zero_d <= t_count_zero;
      end if;
   end process;

   zc_to <= '1' when t_count_zero = '1' and t_count_zero_d = '0' and state = S_RUNNING else '0';  -- one cycle
   
   o_zc_to <= zc_to;

   -- STATE MACHINE

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if reset_hard = '1' then
            state <= S_CONTROL_WORD;
         else
            state <= state_next;
         end if;
      end if;
   end process;

   process (reset_soft_trigger, i_cpu_d, state, iowr_cr, iowr_tc, control_reg, clk_trg_edge)
   begin
      if reset_soft_trigger = '1' then
         if i_cpu_d(2) = '0' then
            state_next <= S_CONTROL_WORD;
         else
            state_next <= S_TIME_CONSTANT;
         end if;
      else
         case state is
            when S_CONTROL_WORD =>
               if iowr_cr = '1' and i_cpu_d(2) = '1' then
                  state_next <= S_TIME_CONSTANT;
               else
                  state_next <= S_CONTROL_WORD;
               end if;
            when S_TIME_CONSTANT =>
               if iowr_tc = '1' then
                  state_next <= S_WAIT;
               else
                  state_next <= S_TIME_CONSTANT;
               end if;
            when S_WAIT =>
               if control_reg(6-2) = '0' and control_reg(3-2) = '1' and clk_trg_edge = '0' then
                  state_next <= S_WAIT;
               else
                  state_next <= S_RUNNING;
               end if;
            when S_RUNNING =>
               state_next <= S_RUNNING;
            when others =>
               state_next <= S_CONTROL_WORD;
         end case;
      end if;
   end process;

   -- REGISTERS
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         iowr_d <= i_iowr;
      end if;
   end process;

   iowr <= i_iowr and not iowr_d;
   iowr_tc_exp <= '1' when (control_reg(2-2) = '1' and state /= S_CONTROL_WORD) else '0';

   o_iowr_tc <= iowr_tc_exp;

   iowr_tc <= '1' when iowr = '1' and iowr_tc_exp = '1' else '0';
   iowr_cr <= '1' when iowr = '1' and iowr_tc_exp = '0' and i_cpu_d(0) = '1' else '0';

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if reset_hard = '1' then
            control_reg <= (others => '0');
         elsif iowr_cr = '1' then
            control_reg <= i_cpu_d(7 downto 2);
         elsif iowr_tc = '1' then
            control_reg(2-2) <= '0';
         elsif i_int_en_wr = '1' then
            control_reg(7-2) <= i_int_en;
         end if;
      end if;
   end process;
   
   o_int_en <= control_reg(7-2);

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if reset_hard = '1' then
            time_constant_reg <= (others => '0');
         elsif iowr_tc = '1' then
            time_constant_reg <= i_cpu_d;
         end if;
      end if;
   end process;

   reset_soft_trigger <= '1' when iowr_cr = '1' and i_cpu_d(1) = '1' else '0';
   clk_edge_change <= '1' when iowr_cr = '1' and (i_cpu_d(4) /= control_reg(4-2)) else '0';

end architecture;
