--
-- Z80 compatible microprocessor core, asynchronous top level
--
-- Version : 0247
--
-- Copyright 2001-2002 Daniel Wallner (jesus@opencores.org)
--
-- Modifications for the ZX Spectrum Next Project
-- Copyright 2020 Fabio Belavenuto, Victor Trucco, Charlie Ingley, Garry Lancaster, ACX
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
-- Please report bugs to the author, but before you do so, please make sure that 
-- this is not a derivative work and that you have the latest version of this file.
--
-- The latest version of this file can be found at:
-- <http://www.opencores.org/cvsweb.shtml/t80/>
--
-- Limitations :
--
-- File history :
--
-- 0208 : First complete release
--
-- 0211 : Fixed interrupt cycle
--
-- 0235 : Updated for T80 interface change
--
-- 0238 : Updated for T80 interface change
--
-- 0240 : Updated for T80 interface change
--
-- 0242 : Updated for T80 interface change
--
-- 0247 : Fixed bus req/ack cycle
--

-- This file is part of the ZX Spectrum Next Project
-- <https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA/tree/master/cores>
--
-- Modifications for the ZX Spectrum Next were made by:
--
-- Fabio Belavenuto : partial fix of wait bug
-- Victor Trucco, Fabio Belavenuto, Garry Lancaster : additional instructions
-- Charlie Ingley : complete fix of wait logic
-- ACX : implement undocumented flags for SLI r,(IY+s)

library IEEE;
use IEEE.std_logic_1164.all;
use IEEE.numeric_std.all;
use work.T80N_Pack.all;
use work.Z80N_pack.all;

entity T80Na is

   generic(
      Mode : integer := 0  -- Standard Z80 CPU
   );
   port(
      -- Reset (input, active Low). RESET initializes the CPU as follows: it resets the
      -- interrupt enable flip-flop, clears the Program Counter and registers I and R, and sets the
      -- interrupt status to Mode 0. During reset time, the address and data bus enter a high-impedance
      -- state, and all control output signals enter an inactive state. RESET must be active for
      -- a minimum of three full clock cycles before a reset operation is complete.
      RESET_n  : in    std_logic; -- active low reset

      -- Clock (input). Single-phase MOS-level clock.
      CLK_n    : in    std_logic; -- negative edge clock

      -- WAIT (input, active Low). WAIT communicates to the CPU that the addressed
      -- memory or I/O devices are not ready for a data transfer. The CPU continues to enter a
      -- WAIT state as long as this signal is active. Extended WAIT periods can prevent the CPU
      -- from properly refreshing dynamic memory.
      WAIT_n   : in    std_logic; 

      -- Interrupt Request (input, active Low). An Interrupt Request is generated by I/O
      -- devices. The CPU honors a request at the end of the current instruction if the internal software-
      -- controlled interrupt enable flip-flop (IFF) is enabled. INT is normally wired-OR and
      -- requires an external pull-up for these applications.
      INT_n    : in    std_logic;

      -- Nonmaskable Interrupt (input, negative edge-triggered). NMI contains a higher priority
      -- than INT. NMI is always recognized at the end of the current instruction, independent
      -- of the status of the interrupt enable flip-flop, and automatically forces the CPU to
      -- restart at location 0066h.
      NMI_n    : in    std_logic;

      -- Bus Request (input, active Low). Bus Request contains a higher priority than
      -- NMI and is always recognized at the end of the current machine cycle. BUSREQ forces
      -- the CPU address bus, data bus, and control signals MREQ, IORQ, RD, and WR to enter a
      -- high-impedance state so that other devices can control these lines. BUSREQ is normally
      -- wired OR and requires an external pull-up for these applications. Extended BUSREQ periods
      -- due to extensive DMA operations can prevent the CPU from properly refreshing
      -- dynamic RAM.
      BUSRQ_n  : in    std_logic;

      -- Machine Cycle One (output, active Low). M1, together with MREQ, indicates that the
      -- current machine cycle is the op code fetch cycle of an instruction execution. M1, when
      -- operating together with IORQ, indicates an interrupt acknowledge cycle.
      M1_n     : out   std_logic;

      -- Memory Request (output, active Low, tristate). MREQ indicates that the address
      -- bus holds a valid address for a memory read or a memory write operation.
      MREQ_n   : out   std_logic;

      -- Input/Output Request (output, active Low, tristate). IORQ indicates that the lower
      -- half of the address bus holds a valid I/O address for an I/O read or write operation. IORQ
      -- is also generated concurrently with M1 during an interrupt acknowledge cycle to indicate
      -- that an interrupt response vector can be placed on the data bus.
      IORQ_n   : out   std_logic;

      -- Read (output, active Low, tristate). RD indicates that the CPU wants to read data from
      -- memory or an I/O device. The addressed I/O device or memory should use this signal to
      -- gate data onto the CPU data bus.
      RD_n     : out   std_logic;

      -- Write (output, active Low, tristate). WR indicates that the CPU data bus contains
      -- valid data to be stored at the addressed memory or I/O location.
      WR_n     : out   std_logic;

      -- Refresh (output, active Low). RFSH, together with MREQ, indicates that the lower
      -- seven bits of the system’s address bus can be used as a refresh address to the system’s
      -- dynamic memories.
      RFSH_n   : out   std_logic;

      -- HALT State (output, active Low). HALT indicates that the CPU has executed a
      -- HALT instruction and is waiting for either a nonmaskable or a maskable interrupt (with
      -- the mask enabled) before operation can resume. During HALT, the CPU executes NOPs to
      -- maintain memory refreshes.
      HALT_n   : out   std_logic;

      -- Bus Acknowledge (output, active Low). Bus Acknowledge indicates to the
      -- requesting device that the CPU address bus, data bus, and control signals MREQ, IORQ,
      -- RD, and WR have entered their high-impedance states. The external circuitry can now
      -- control these lines.
      BUSAK_n  : out   std_logic;

      -- Address Bus (output, active High, tristate). A15–A0 form a 16-bit Address Bus,
      -- which provides the addresses for memory data bus exchanges (up to 64 KB) and for I/O
      -- device exchanges.
      A        : out   std_logic_vector(15 downto 0);

      -- Data Bus (input/output, active High, tristate). D7–D0 constitute an 8-bit bidirectional
      -- data bus, used for data exchanges with memory and I/O.
      -- Data bus input
      D_i      : in    std_logic_vector( 7 downto 0);

      -- Data bus output
      D_o      : out   std_logic_vector( 7 downto 0);

      -- Extended functions
      Z80N_dout_o       : out std_logic := '0';
      Z80N_data_o       : out std_logic_vector(15 downto 0);

      -- Z80N command type
      Z80N_command_o    : out Z80N_seq 
   );
end T80Na;


architecture rtl of T80Na is

   signal CEN           : std_logic; -- Signs that the clock is active (enabled)
   signal Reset_s       : std_logic; -- Signs that reset is active
   signal IntCycle_n    : std_logic; -- Is the CPU in an interrupt cycle? (active low)
   signal IORQ          : std_logic; -- IORQ state
   signal NoRead        : std_logic; 
   signal Write         : std_logic;
   signal MREQ          : std_logic;
   signal MReq_Inhibit     : std_logic;
   signal Req_Inhibit      : std_logic;
   signal RD            : std_logic;
   signal MREQ_n_i         : std_logic;
   signal MREQ_rw       : std_logic;   -- 30/10/19 Charlie Ingley-- add MREQ control
   signal IORQ_n_i         : std_logic;
   signal IORQ_t1          : std_logic;   -- 30/10/19 Charlie Ingley-- add IORQ control
   signal IORQ_t2          : std_logic;   -- 30/10/19 Charlie Ingley-- add IORQ control
   signal IORQ_rw       : std_logic;   -- 30/10/19 Charlie Ingley-- add IORQ control
   signal IORQ_int         : std_logic;   -- 30/10/19 Charlie Ingley-- add IORQ interrupt control
   signal IORQ_int_inhibit : std_logic_vector(2 downto 0);
   signal RD_n_i        : std_logic;
   signal WR_n_i        : std_logic;
   signal WR_t2         : std_logic;   -- 30/10/19 Charlie Ingley-- add WR control
   signal RFSH_n_i         : std_logic;
   signal BUSAK_n_i     : std_logic;
   signal A_i           : std_logic_vector(15 downto 0);
   signal DO            : std_logic_vector(7 downto 0);
   signal DI_Reg        : std_logic_vector (7 downto 0); -- Input synchroniser
   signal MCycle        : std_logic_vector(2 downto 0);
   signal TState        : std_logic_vector(2 downto 0); -- The T-State sequence number when executing an instruction

begin

   CEN <= '1';

   BUSAK_n <= BUSAK_n_i;                                    -- 30/10/19 Charlie Ingley - IORQ/RD/WR changes
   MREQ_rw <= MREQ and (Req_Inhibit or MReq_Inhibit);             --          added MREQ timing control
   MREQ_n_i <= not MREQ_rw;                                 --          changed MREQ generation 
   IORQ_rw <= IORQ and not (IORQ_t1 or IORQ_t2);                        --          added IORQ generation timing control
   IORQ_n_i <= not ((IORQ_int and not IORQ_int_inhibit(2)) or IORQ_rw); --          changed IORQ generation
   RD_n_i <= not (RD and (MREQ_rw or IORQ_rw));                         --          changed RD/IORQ generation
   WR_n_i <= not (Write and ((WR_t2 and MREQ_rw) or IORQ_rw));          --          added WR/IORQ timing control

-- MREQ_n <= MREQ_n_i when BUSAK_n_i = '1' else 'Z';
-- IORQ_n <= IORQ_n_i when BUSAK_n_i = '1' else 'Z';
-- RD_n <= RD_n_i when BUSAK_n_i = '1' else 'Z';
-- WR_n <= WR_n_i when BUSAK_n_i = '1' else 'Z';
-- RFSH_n <= RFSH_n_i when BUSAK_n_i = '1' else 'Z';
-- A <= A_i when BUSAK_n_i = '1' else (others => 'Z');
-- D <= DO when Write = '1' and BUSAK_n_i = '1' else (others => 'Z');

   MREQ_n <= MREQ_n_i;
   IORQ_n <= IORQ_n_i;
   RD_n <= RD_n_i;
   WR_n <= WR_n_i;
   RFSH_n <= RFSH_n_i;
   A <= A_i;
   D_o <= DO;

   process (RESET_n, CLK_n)
   begin
      if RESET_n = '0' then
         Reset_s <= '0';
      elsif CLK_n'event and CLK_n = '1' then
         Reset_s <= '1';
      end if;
   end process;

   z80n : T80N
      generic map(
         Mode => Mode,
         IOWait => 1)
      port map(
         CEN => CEN,
         M1_n => M1_n,
         IORQ => IORQ,
         NoRead => NoRead,
         Write => Write,
         RFSH_n => RFSH_n_i,
         HALT_n => HALT_n,
         WAIT_n => Wait_n,
         INT_n => INT_n,
         NMI_n => NMI_n,
         RESET_n => Reset_s,
         BUSRQ_n => BUSRQ_n,
         BUSAK_n => BUSAK_n_i,
         CLK_n => CLK_n,
         A => A_i,
--       DInst => D,
         DInst => D_i,
         DI => DI_Reg,
         DO => DO,
         MC => MCycle,
         TS => TState,
         IntCycle_n => IntCycle_n,
         
         Z80N_dout_o       => Z80N_dout_o,      
         Z80N_data_o       => Z80N_data_o,      
         Z80N_command_o    => Z80N_command_o 
      );

   process (CLK_n)
   begin
      if CLK_n'event and CLK_n = '0' then
         if TState = "011" and BUSAK_n_i = '1' then
--          DI_Reg <= to_x01(D);
            DI_Reg <= D_i;
         end if;
      end if;
   end process;

-- 30/10/19 Charlie Ingley - Generate WR_t2 to correct MREQ/WR timing
   process (Reset_s,CLK_n) 
   begin
      if Reset_s = '0' then         
         WR_t2 <= '0';
      elsif CLK_n'event and CLK_n = '0' then
         if MCycle /= "001" then 
               if TState = "010" then  -- WR starts on falling edge of T2 for MREQ
                  WR_t2 <=  Write;
               end if;
         end if;
         if TState = "011" then        -- end WR
            WR_t2 <= '0';
         end if;
      end if;
   end process;

-- Generate Req_Inhibit 
   process (Reset_s,CLK_n)
   begin
      if Reset_s = '0' then
         Req_Inhibit <= '1';  -- Charlie Ingley 30/10/19 - changed Req_Inhibit polarity
      elsif CLK_n'event and CLK_n = '1' then
         if MCycle = "001" and TState = "010" and WAIT_n = '1' then  -- by Fabio Belavenuto - fix behavior of Wait_n
            Req_Inhibit <= '0';
         else
            Req_Inhibit <= '1';
         end if;
      end if;
   end process;

-- Generate MReq_Inhibit
   process (Reset_s, CLK_n)
   begin
      if Reset_s = '0' then
         MReq_Inhibit <= '1'; -- Charlie Ingley 30/10/19 - changed Req_Inhibit polarity
      elsif CLK_n'event and CLK_n = '0' then
         if MCycle = "001" and TState = "010" and WAIT_n = '1' then  -- by Fabio Belavenuto - fix behavior of Wait_n
            MReq_Inhibit <= '0';
         else
            MReq_Inhibit <= '1';
         end if;
      end if;
   end process;

-- Generate RD for MREQ
   process(Reset_s,CLK_n)
   begin
      if Reset_s = '0' then
         RD <= '0';
         MREQ <= '0';
      elsif CLK_n'event and CLK_n = '0' then
         if MCycle = "001" then
            if TState = "001" then
               RD <= IntCycle_n;
               MREQ <= IntCycle_n;
            end if;
            if TState = "011" then
               RD <= '0';
               MREQ <= '1';
            end if;
            if TState = "100" then
               MREQ <= '0';
            end if;
         else
            if TState = "001" and NoRead = '0' then 
               RD <= not Write;  
               MREQ <= not IORQ;
            end if;
            if TState = "011" then
               RD <= '0';
               MREQ <= '0';
            end if;
         end if;
      end if;
   end process;
   
 -- 30/10/19 Charlie Ingley - Generate IORQ_int for IORQ interrupt timing control
   process(Reset_s,CLK_n)
   begin
      if Reset_s = '0' then
         IORQ_int <= '0';
      elsif CLK_n'event and CLK_n = '1' then
         if MCycle = "001" then
            if TState = "001" then
               IORQ_int <= not IntCycle_n;
            end if;
            if TState = "010" then
               IORQ_int <= '0';
            end if;
         end if;
      end if;
   end process;

   process(Reset_s,CLK_n)
   begin
      if Reset_s = '0' then
         IORQ_int_inhibit <= "111";
      elsif CLK_n'event and CLK_n = '0' then
         if IntCycle_n = '0' then
            if MCycle = "001" then
               IORQ_int_inhibit <= IORQ_int_inhibit(1 downto 0) & '0';
            end if;
            if MCycle = "010" then
               IORQ_int_inhibit <= "111";
            end if;
         end if;
      end if;
   end process;

-- 30/10/19 Charlie Ingley - Generate IORQ_t1 for IORQ timing control
   process(Reset_s, CLK_n)
   begin
      if Reset_s = '0' then
         IORQ_t1 <= '1';
      elsif CLK_n'event and CLK_n = '0' then 
         if TState = "001" then 
            IORQ_t1 <= not IntCycle_n;
         end if;
         if TState = "011" then
            IORQ_t1 <= '1';
         end if;
      end if;
   end process;
   
-- 30/10/19 Charlie Ingley - Generate IORQ_t2 for IORQ timing control 
   process (RESET_n, CLK_n)
   begin
      if RESET_n = '0' then
         IORQ_t2 <= '1';
      elsif CLK_n'event and CLK_n = '1' then
         IORQ_t2 <= IORQ_t1;  
      end if;
   end process; 
 
end;
