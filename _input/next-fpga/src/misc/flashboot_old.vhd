
-- Flashboot
-- Copyright 2020 Fabio Belavenuto
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

library UNISIM;
use UNISIM.VComponents.all;

entity flashboot is
   port(
      reset_i     : in  std_logic;
      clock_i     : in  std_logic;
      start_i     : in  std_logic;
      spiaddr_i   : in  std_logic_vector(31 downto 0)
   );
end entity;

architecture Behavioral of flashboot is

   ----------------------------------------------------------------------------
   -- ICAP configuration data codes
   ----------------------------------------------------------------------------
   --  For custom data codes like the ones for reading back, take a look to:
   --    [OPCODES]        UG380 page 88   table  5-23
   --    [CFG PACKETS]    UG380 page 89   tables 5-{24, 25}
   --    [CG REGISTERS]   UG380 page 90   table  5-30
   ----------------------------------------------------------------------------
   constant DUMMY_C        : std_logic_vector(15 downto 0) := X"FFFF";  -- 
   constant NOOP_C         : std_logic_vector(15 downto 0) := X"2000";  -- 
   constant NULL1_C        : std_logic_vector(15 downto 0) := X"0000";  --
   constant NULL2_C        : std_logic_vector(15 downto 0) := X"1111";  -- 
   constant SYNCH_C        : std_logic_vector(15 downto 0) := X"AA99";  --
   constant SYNCL_C        : std_logic_vector(15 downto 0) := X"5566";  --
   constant CMD_WR_GEN1_C  : std_logic_vector(15 downto 0) := X"3261";  -- 
   constant CMD_WR_GEN2_C  : std_logic_vector(15 downto 0) := X"3281";  -- 
   constant CMD_WR_CMD_C   : std_logic_vector(15 downto 0) := X"30A1";  -- 
   constant CMD_WR_MOD_C   : std_logic_vector(15 downto 0) := X"3301";  -- 
   constant CMD_IPROG_C    : std_logic_vector(15 downto 0) := X"000E";  --
   constant BIT4X_C        : std_logic_vector(15 downto 0) := X"3100";  -- 

   type states_t is (IDLE, SYNC_H, SYNC_L, GEN1_H, GEN1_L, GEN2_H, GEN2_L, NUL_H,
            NUL_L, MOD_H, MOD_L, RBT_H, RBT_L, NOOP_0, NOOP_1, NOOP_2, NOOP_3);

   signal state_s       : states_t;
   signal next_state_s  : states_t;

   signal icap_ce_r_s   : std_logic;
   signal icap_wr_r_s   : std_logic;
   signal icap_ce_s     : std_logic;
   signal icap_wr_s     : std_logic;
   signal icap_i_r_s    : std_logic_vector(15 downto 0);
   signal icap_i_s      : std_logic_vector(15 downto 0);

-- signal spi_addr_s    : std_logic_vector(31 downto 0)     := X"6B000000";   -- 0B = Fast Read, 3B = Dual Fast Read, 6B = Quad Fast Read

begin

   ICAP_SPARTAN6_inst : ICAP_SPARTAN6
   port map (
      CLK   => clock_i,          -- 1-bit input: Clock input
      CE    => icap_ce_s,        -- 1-bit input: Active-Low ICAP Enable input
      I     => icap_i_s,         -- 16-bit input: Configuration data input bus
      WRITE => icap_wr_s         -- 1-bit input: Read/Write control input
   );

   -- assign values
   process(clock_i)
   begin
      if rising_edge(clock_i) then
         -- First we order the bits according to UG380 Table2-5 page 37, as specified in page 126
         icap_i_s(0)    <= icap_i_r_s(7);  
         icap_i_s(1)    <= icap_i_r_s(6);
         icap_i_s(2)    <= icap_i_r_s(5);
         icap_i_s(3)    <= icap_i_r_s(4);
         icap_i_s(4)    <= icap_i_r_s(3);  
         icap_i_s(5)    <= icap_i_r_s(2);
         icap_i_s(6)    <= icap_i_r_s(1);
         icap_i_s(7)    <= icap_i_r_s(0);
         icap_i_s(8)    <= icap_i_r_s(15);  
         icap_i_s(9)    <= icap_i_r_s(14);
         icap_i_s(10)   <= icap_i_r_s(13);
         icap_i_s(11)   <= icap_i_r_s(12);
         icap_i_s(12)   <= icap_i_r_s(11);  
         icap_i_s(13)   <= icap_i_r_s(10);
         icap_i_s(14)   <= icap_i_r_s(9);
         icap_i_s(15)   <= icap_i_r_s(8);
         icap_wr_s      <= icap_wr_r_s;
         icap_ce_s      <= icap_ce_r_s;
      end if;
   end process;

   -- next state
   process(clock_i)
   begin
      if rising_edge(clock_i) then
         if reset_i = '1' then
            state_s <= IDLE;
         else
            state_s <= next_state_s;
         end if;
      end if;
   end process;

   -- FSM
   process (state_s, start_i, spiaddr_i)
   begin
      case state_s is
         when IDLE =>
            if start_i = '1' then
               next_state_s   <= SYNC_H;
               icap_ce_r_s    <= '0';
               icap_wr_r_s    <= '0';
               icap_i_r_s     <= SYNCH_C;
            else
               next_state_s   <= IDLE;
               icap_ce_r_s    <= '1';
               icap_wr_r_s    <= '1';
               icap_i_r_s     <= DUMMY_C;
            end if;
         when SYNC_H =>
            next_state_s   <= SYNC_L;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= SYNCL_C;
         when SYNC_L =>
            next_state_s   <= NUL_H;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= CMD_WR_CMD_C;
         when NUL_H =>
            next_state_s   <= GEN1_H;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= NULL1_C;
         when GEN1_H =>
            next_state_s   <= GEN1_L;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= CMD_WR_GEN1_C;
         when GEN1_L =>
            next_state_s   <= GEN2_H;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= spiaddr_i(15 downto 0);
         when GEN2_H =>
            next_state_s   <= GEN2_L;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= CMD_WR_GEN2_C;
         when GEN2_L =>
            next_state_s   <= MOD_H;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= spiaddr_i(31 downto 16);
         when MOD_H =>
            next_state_s   <= MOD_L;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= CMD_WR_MOD_C;
         when MOD_L =>
            next_state_s   <= NUL_L;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= BIT4X_C;
         when NUL_L =>
            next_state_s   <= RBT_H;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= CMD_WR_CMD_C;
         when RBT_H =>
            next_state_s   <= RBT_L;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= CMD_IPROG_C;
         when RBT_L =>
            next_state_s   <= NOOP_0;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= NOOP_C;
         when NOOP_0 =>
            next_state_s   <= NOOP_1;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= NOOP_C;
         when NOOP_1 =>
            next_state_s   <= NOOP_2;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= NOOP_C;
         when NOOP_2 =>
            next_state_s   <= NOOP_3;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= NOOP_C;
         when NOOP_3 =>
            next_state_s   <= IDLE;
            icap_ce_r_s    <= '0';
            icap_wr_r_s    <= '0';
            icap_i_r_s     <= NULL2_C;
         when others =>
            next_state_s   <= IDLE;
            icap_ce_r_s    <= '1';
            icap_wr_r_s    <= '1';
            icap_i_r_s     <= NULL2_C;
      end case;
   end process;

end architecture;
