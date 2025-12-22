-- Z80 IM2 DEVICE
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

--
-- This module handles the im2 logic for an interrupting peripheral.
-- 
-- The input is (i_int_req) which is active high and indicates that the
-- peripheral wants to interrupt.  This signal should be held high until
-- the module indicates that the isr has been serviced (o_isr_serviced).
--
-- The daisy chain logic is implemented through (i_iei) and (o_ieo).
-- The highest priority device should have its iei signal set to '1'
-- and lower priority devices should have their iei connected to the
-- next higher priority device's ieo.
--
-- The variable width interrupt vector is output normally as all zeroes
-- unless the device must output its vector during an interrupt ack
-- cycle.  This allows multiple modules to have their vector outputs
-- logically ORed together to easily form the correct vector
-- presented to the z80.  This resulting vector should be output only
-- while /m1 and /iorq are both low.
--
-- The signal (o_isr_serviced) should be used to reset any other
-- interrupt logic outside this module.  The signal is held high for
-- one clock cycle.
--

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity im2_device is
   generic (
      constant VEC_BITS : positive := 8
   );
   port (
      i_CLK_CPU         : in std_logic;
      i_reset_n         : in std_logic;
      
      i_im2_mode        : in std_logic;   -- 1 if z80 is in im 2 mode (set 1 if unknown)
      
      i_m1_n            : in std_logic;
      i_iorq_n          : in std_logic;
      
      i_int_req         : in std_logic;   -- peripheral wants to generate an interrupt, hold high
      o_int_n           : out std_logic;  -- interrupt signal for z80
      
      i_dma_int_en      : in  std_logic;  -- enable dma interruption
      o_dma_int         : out std_logic;  -- interrupt dma operation
      
      i_reti_decode     : in std_logic;
      i_reti_seen       : in std_logic;
      o_isr_serviced    : out std_logic;  -- when set, reset i_int_req on next rising edge of clock
      
      i_iei             : in std_logic;   -- im2 daisy chain logic
      o_ieo             : out std_logic;  -- im2 daisy chain logic

      i_vec             : in std_logic_vector(VEC_BITS-1 downto 0);   -- peripheral im2 vector
      o_vec             : out std_logic_vector(VEC_BITS-1 downto 0)   -- generated im2 vector, must be qualified by /m1 * /iorq
   );
end entity;

architecture rtl of im2_device is

   type state_t         is (S_0, S_REQ, S_ACK, S_ISR);
   signal state         : state_t;
   signal state_next    : state_t;

begin

   -- state machine
   
   process (i_CLK_CPU)
   begin
      if rising_edge(i_CLK_CPU) then
         if i_reset_n = '0' then
            state <= S_0;
         else
            state <= state_next;
         end if;
      end if;
   end process;
   
   process (state, i_m1_n, i_iorq_n, i_int_req, i_iei, i_reti_seen, i_im2_mode)
   begin
      case state is
         when S_0 =>
            if i_int_req = '1' and i_m1_n = '1' then
               state_next <= S_REQ;
            else
               state_next <= S_0;
            end if;          
         when S_REQ =>
            if i_m1_n = '0' and i_iorq_n = '0' and i_iei = '1' and i_im2_mode = '1' then
               state_next <= S_ACK;
            else
               state_next <= S_REQ;
            end if;
         when S_ACK =>
            if i_m1_n = '1' then
               state_next <= S_ISR;
            else
               state_next <= S_ACK;
            end if;
         when S_ISR =>
            if i_reti_seen = '1' and i_iei = '1' and i_im2_mode = '1' then
               state_next <= S_0;
            else
               state_next <= S_ISR;
            end if;
         when others =>
            state_next <= S_0;
      end case;
   end process;
   
   -- output daisy chain
   
   process (state, i_iei, i_reti_decode)
   begin
      case state is
         when S_0 =>
            o_ieo <= i_iei;
         when S_REQ =>
            o_ieo <= i_iei and i_reti_decode;
         when others =>
            o_ieo <= '0';
      end case;
   end process;

   -- output z80 interrupt request
   
   o_int_n <= '0' when state = S_REQ and i_iei = '1' and i_im2_mode = '1' else '1';
   o_dma_int <= '1' when state /= S_0 and i_dma_int_en = '1' else '0';

   -- output interrupt vector
   
   o_vec <= i_vec when state = S_ACK or state_next = S_ACK else (others => '0');  -- qualify with /m1 * /iorq
   
   -- indicate isr was serviced
   
   o_isr_serviced <= '1' when state = S_ISR and state_next = S_0 else '0';

end architecture;
