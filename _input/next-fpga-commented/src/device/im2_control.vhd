-- Z80 IM2 CONTROL BLOCK
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
-- This control block is responsible for recognizing the reti instruction
-- (opcode bytes ED 4D only, which is compatible with Zilog peripherals) and
-- for indicating when a reti instruction may be decoded so that IEO is
-- only asserted by already acknowledged interrupters.  It also decodes the
-- retn instruction ED 45.
--
-- IM2 peripherals should use the output signals as follows:
--
-- o_reti_decode : When asserted, peripherals must only make IEO low
--    if the peripheral's interrupt has already been acknowledged or if
--    IEI is low.  Synchronized to the rising edge of CLK.
--
-- o_reti_seen : When asserted, the peripheral with its IEI signal high
--    and whose interrupt has already been acknowledged should reset its
--    interrupt logic since its interrupt routine is terminating.  Asserted
--    for exactly one cycle and synchronized to the rising edge of CLK.
--

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity im2_control is
   port (
      i_CLK_CPU         : in std_logic;
      i_reset           : in std_logic;
      
      i_m1_n            : in std_logic;
      i_mreq_n          : in std_logic;
      i_iorq_n          : in std_logic;
      
      i_rd_n            : in std_logic;
      i_wr_n            : in std_logic;
      
      i_cpu_d           : in std_logic_vector(7 downto 0);
      
      o_im_mode         : out std_logic_vector(1 downto 0);  -- 00 = im 0, 01 = im 1, 10 = im 2 changes on falling edge of T3

      o_reti_decode     : out std_logic;   -- reti is being decoded, only acknowledged interrupters should deassert IEO
      o_reti_seen       : out std_logic;   -- reti instruction has been detected active in T3 for rising edge of T4
      
      o_retn_seen       : out std_logic;   -- retn instruction has been detected active in T3 for rising edge of T4

      o_dma_delay       : out std_logic    -- delay dma busak through reti pop
   );
end entity;

architecture rtl of im2_control is

   signal ifetch              : std_logic;
   signal ifetch_d            : std_logic;
   signal ifetch_fe_t3        : std_logic;
   
   signal cpu_opcode          : std_logic_vector(7 downto 0);
   
   signal opcode_ed           : std_logic;
   signal opcode_4d           : std_logic;
   signal opcode_cb           : std_logic;
   signal opcode_45           : std_logic;
   signal opcode_ddfd         : std_logic;
   
   type state_t               is (S_0, S_ED_T4, S_ED4D_T4, S_ED45_T4, S_CB_T4, S_SRL_T1, S_SRL_T2, S_DDFD_T4);
   signal state               : state_t;
   signal state_next          : state_t;
   
   signal im_mode             : std_logic_vector(1 downto 0) := "00";

begin

   -- detect instruction fetch cycles
   
   ifetch <= '1' when i_m1_n = '0' and i_mreq_n = '0' else '0';
   
   process (i_CLK_CPU)
   begin
      if rising_edge(i_CLK_CPU) then
         if i_reset = '1' then
            ifetch_d <= '0';
         else
            ifetch_d <= ifetch;
         end if;
      end if;
   end process;

   ifetch_fe_t3 <= ifetch_d and not ifetch;
   
   -- hold opcode read by cpu
   
   process (i_CLK_CPU)
   begin
      if rising_edge(i_CLK_CPU) then
         if i_reset = '1' then
            cpu_opcode <= (others => '0');
         elsif ifetch = '1' then
            cpu_opcode <= i_cpu_d;
         end if;
      end if;
   end process;
   
   -- recognize important opcodes ED 4D CB 45 FD DD
   
   process (cpu_opcode)
   begin
      
      opcode_ed <= '0';
      opcode_4d <= '0';
      opcode_cb <= '0';
      opcode_45 <= '0';
      opcode_ddfd <= '0';
      
      case cpu_opcode is
         when X"ED" => opcode_ed <= '1';
         when X"4D" => opcode_4d <= '1';
         when X"CB" => opcode_cb <= '1';
         when X"45" => opcode_45 <= '1';
         when X"DD" => opcode_ddfd <= '1';
         when X"FD" => opcode_ddfd <= '1';
         when others => null;
      end case;
   
   end process;
   
   -- state machine
   
   process (i_CLK_CPU)
   begin
      if rising_edge(i_CLK_CPU) then
         if i_reset = '1' then
            state <= S_0;
         else
            state <= state_next;
         end if;
      end if;
   end process;
   
   process (state, ifetch_fe_t3, opcode_ed, opcode_cb, opcode_4d, opcode_45, opcode_ddfd)
   begin
      case state is
         when S_0 =>
            if ifetch_fe_t3 = '1' and opcode_ed = '1' then
               state_next <= S_ED_T4;
            elsif ifetch_fe_t3 = '1' and opcode_cb = '1' then
               state_next <= S_CB_T4;
            elsif ifetch_fe_t3 = '1' and opcode_ddfd = '1' then
               state_next <= S_DDFD_T4;
            else
               state_next <= S_0;
            end if;
         when S_ED_T4 =>
            if ifetch_fe_t3 = '1' and opcode_4d = '1' then
               state_next <= S_ED4D_T4;
            elsif ifetch_fe_t3 = '1' and opcode_45 = '1' then
               state_next <= S_ED45_T4;
            elsif ifetch_fe_t3 = '1' then
               state_next <= S_0;
            else
               state_next <= S_ED_T4;
            end if;
         when S_ED4D_T4 =>
--          state_next <= S_0;
            state_next <= S_SRL_T1;
         -- On the zx next, the dma can be interrupted by devices.
         -- These extra states prevent an accumulation of return addresses on the stack.
         when S_SRL_T1 =>
            state_next <= S_SRL_T2;
         when S_SRL_T2 =>
            state_next <= S_0;
         when S_ED45_T4 =>
--          state_next <= S_0;
            state_next <= S_SRL_T1;
         when S_CB_T4 =>
            if ifetch_fe_t3 = '1' then
               state_next <= S_0;
            else
               state_next <= S_CB_T4;
            end if;
         when S_DDFD_T4 =>
            if ifetch_fe_t3 = '1' and opcode_ddfd = '1' then
               state_next <= S_DDFD_T4;
            elsif ifetch_fe_t3 = '1' then
               state_next <= S_0;
            else
               state_next <= S_DDFD_T4;
            end if;
         when others =>
            state_next <= S_0;
      end case;
   end process;
   
   -- interrupt mode
   
   -- IM 0 : ED 46/4E/66/6E
   -- IM 1 : ED 56/76
   -- IM 2 : ED 5E/7E
   
   process (i_CLK_CPU)
   begin
      if falling_edge(i_CLK_CPU) then
         if i_reset = '1' then
            im_mode <= (others => '0');
         elsif state = S_ED_T4 and ifetch_fe_t3 = '1' and cpu_opcode(7 downto 6) = "01" and cpu_opcode(2 downto 0) = "110" then
            im_mode <= (cpu_opcode(4) and cpu_opcode(3)) & (cpu_opcode(4) and not cpu_opcode(3));
         end if;
      end if;
   end process;
   
   o_im_mode <= im_mode;
   
   -- output signals
   
   o_reti_decode <= '1' when state = S_ED_T4 else '0';
   o_reti_seen <= '1' when state_next = S_ED4D_T4 else '0';  -- zilog peripherals require im2 reset on rising edge of T4

   o_retn_seen <= '1' when state_next = S_ED45_T4 else '0';
   
   o_dma_delay <= '1' when state = S_ED_T4 or state = S_ED4D_T4 or state = S_ED45_T4 or state = S_SRL_T1 or state = S_SRL_T2 else '0';

end architecture;
