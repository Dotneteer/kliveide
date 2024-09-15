-- HDMI PLL STACK FOR ARTIX 7
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

-- Generates HDMI clocks locked to various Spectrum models' video frames.

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

library UNISIM;
use UNISIM.vcomponents.all;

entity hdmi_plle2 is
   port
   (
      RST         : in std_logic;    -- disable hdmi clocks
      
      -- drp

      SSTEP       : in std_logic;    -- restart hdmi clocks (rising edge)
      CLKDRP      : in std_logic;    -- control logic clock
      
      -- video frame
      
      V5060       : in std_logic;                       -- 0 = 50Hz, 1 = 60Hz
      VMODEL      : in std_logic_vector(2 downto 0);    -- 1XX = Pentagon, 01X = 128K, else 48K

      -- clk

      CLKIN       : in std_logic;    --  28 MHz
      CLKIN_RDY_N : in std_logic;    -- input clock locked
      
      CLK0OUT     : out std_logic;   -- 135 MHz
      CLK0OUTB    : out std_logic;   -- 135 MHz inv
      CLK1OUT     : out std_logic;   --  27 MHz
      
      VALID       : out std_logic    -- 27 MHz indicates hdmi clocks functioning
   );
end entity;

architecture rtl of hdmi_plle2 is

   component top_1_plle2
   port
   (
      RST        : in std_logic;
      SSTEP      : in std_logic;
      STATE      : in std_logic_vector(2 downto 0);
      CLKDRP     : in std_logic;
      
      SRDY_N     : out std_logic;
      LOCKED_OUT : out std_logic;
      
      CLKIN      : in std_logic;
      CLKOUT     : out std_logic
   );
   end component;

   component top_2_mmcme2
   port
   (
      RST        : in std_logic;
      SSTEP      : in std_logic;
      STATE      : in std_logic_vector(2 downto 0);
      CLKDRP     : in std_logic;
      
      SRDY_N     : out std_logic;
      LOCKED_OUT : out std_logic;
      
      CLKIN      : in std_logic;
      CLKOUT     : out std_logic
   );
   end component;
   
   component top_3_plle2
   port
   (
      RST        : in std_logic;
      SSTEP      : in std_logic;
      STATE      : in std_logic_vector(2 downto 0);
      CLKDRP     : in std_logic;
      
      SRDY_N     : out std_logic;
      LOCKED_OUT : out std_logic;
      
      CLKIN      : in std_logic;
      CLKOUT5    : out std_logic;
      CLKOUT5N   : out std_logic;
      CLKOUT     : out std_logic
   );
   end component;

   signal hdmi_reset        : std_logic := '1';

   signal v_pll_reset       : std_logic_vector(3 downto 0) := (others => '1');
   signal pll_reset         : std_logic;
   
   signal vframe            : std_logic_vector(3 downto 0) := "0010";
   signal frame             : std_logic_vector(2 downto 0);
   
   signal sstep_int         : std_logic_vector(2 downto 0) := (others => '0');
   signal sen               : std_logic := '0';
   
   type state_t             is (S_0, S_SEN, S_PLL1, S_PLL2, S_PLL3);
   signal state             : state_t := S_0;
   signal state_next        : state_t;
   
   signal vsrdy_n           : std_logic_vector(2 downto 0) := (others => '1');
   signal vres              : std_logic_vector(2 downto 0) := (others => '1');
   
   signal sen_1             : std_logic;
   signal sen_2             : std_logic;
   signal sen_3             : std_logic;
   
   signal srdy_1_n          : std_logic;
   signal srdy_2_n          : std_logic;
   signal srdy_3_n          : std_logic;
   
   signal locked            : std_logic := '0';
   signal locked_hdmi       : std_logic := '0';
   
   signal clk1              : std_logic;
   signal clk2              : std_logic;
   signal clkhdmi           : std_logic;
   signal clkhdmi5          : std_logic;
   signal clkhdmi5n         : std_logic;
   
begin

   process (CLKDRP)
   begin
      if rising_edge(CLKDRP) then
         hdmi_reset <= RST;
      end if;
   end process;

   process (CLKDRP)
   begin
      if rising_edge(CLKDRP) then
         if CLKIN_RDY_N = '1' or hdmi_reset = '1' then
            v_pll_reset <= (others => '1');
         elsif pll_reset = '1' then
            v_pll_reset <= v_pll_reset - 1;
         end if;
      end if;
   end process;
   
   pll_reset <= '1' when v_pll_reset /= 0 else '0';
   
   -- video frame
   
   process (CLKDRP)
   begin
      if rising_edge(CLKDRP) then
         vframe <= V5060 & VMODEL;
      end if;
   end process;

   -- 0 = 48K 50Hz, 1 = 128K 50Hz, 2 = Pent 50Hz, 3 = 48K 60Hz, 4 = 128K 60Hz

   process (vframe)
   begin
      if vframe(2) = '1' then
         frame <= "010";                             -- Pentagon 50Hz
      elsif vframe(1) = '1' then
         frame <= vframe(3) & '0' & not vframe(3);   -- 128K 50Hz / 60Hz
      else
         frame <= '0' & vframe(3) & vframe(3);       -- 48K 50Hz / 60Hz
      end if;
   end process;

   -- restart plls due to video frame change (extra cycle for vframe to settle first)
   
   process (CLKDRP)
   begin
      if rising_edge(CLKDRP) then
         if pll_reset = '1' then
            sstep_int <= (others => '0');
         else
            sstep_int <= SSTEP & sstep_int(2 downto 1);
         end if;
      end if;
   end process;
   
   process (CLKDRP)
   begin
      if rising_edge(CLKDRP) then
         if state = S_PLL1 then
            sen <= '0';
         else
            sen <= sen or (sstep_int(1) and not sstep_int(0));
         end if;
      end if;
   end process;

   -- state machine

   process (CLKDRP)
   begin
      if rising_edge(CLKDRP) then
         if pll_reset = '1' then
            state <= S_0;
         else
            state <= state_next;
         end if;
      end if;
   end process;
   
   process (state, vsrdy_n, sen, srdy_1_n, srdy_2_n, srdy_3_n)
   begin
      case state is
         when S_0 =>
            if vsrdy_n(0) = '1' and srdy_3_n = '0' then
               state_next <= S_PLL1;
            else
               state_next <= S_0;
            end if;
         when S_SEN =>
            if sen = '1' then
               state_next <= S_PLL1;
            else
               state_next <= S_SEN;
            end if;
         when S_PLL1 =>
            if vsrdy_n(2) = '1' and srdy_1_n = '0' then
               state_next <= S_PLL2;
            else
               state_next <= S_PLL1;
            end if;
         when S_PLL2 =>
            if vsrdy_n(1) = '1' and srdy_2_n = '0' then
               state_next <= S_PLL3;
            else
               state_next <= S_PLL2;
            end if;
         when S_PLL3 =>
            if vsrdy_n(0) = '1' and srdy_3_n = '0' then
               state_next <= S_SEN;
            else
               state_next <= S_PLL3;
            end if;
         when others =>
            state_next <= S_0;
      end case;
   end process;
   
   -- control logic
   
   process (CLKDRP)
   begin
      if rising_edge(CLKDRP) then
         if pll_reset = '1' then
            vsrdy_n <= (others => '1');
         else
            vsrdy_n <= srdy_1_n & srdy_2_n & srdy_3_n;
         end if;
      end if;
   end process;
   
   process (CLKDRP)
   begin
      if rising_edge(CLKDRP) then
         if pll_reset = '1' then
            vres <= (others => '1');
         elsif state_next = S_0 then
            vres <= '0' & vsrdy_n(2 downto 1);
         else
            vres <= (others => '0');
         end if;
      end if;
   end process;
   
   sen_1 <= '1' when state = S_PLL1 else '0';
   sen_2 <= '1' when state = S_PLL2 else '0';
   sen_3 <= '1' when state = S_PLL3 else '0';

   process (CLKDRP)
   begin
      if rising_edge(CLKDRP) then
         if state = S_SEN then
            locked <= '1';
         else
            locked <= '0';
         end if;
      end if;
   end process;
   
   -- pll chain

   pll_1 : top_1_plle2
   port map
   (
      RST        => vres(2),
      SSTEP      => sen_1,
      STATE      => frame,
      CLKDRP     => CLKDRP,
      
      SRDY_N     => srdy_1_n,
      LOCKED_OUT => open,
      
      CLKIN      => CLKIN,
      CLKOUT     => clk1
   );

   pll_2 : top_2_mmcme2
   port map
   (
      RST        => vres(1),
      SSTEP      => sen_2,
      STATE      => frame,
      CLKDRP     => CLKDRP,
      
      SRDY_N     => srdy_2_n,
      LOCKED_OUT => open,
      
      CLKIN      => clk1,
      CLKOUT     => clk2
   );
   
   pll_3 : top_3_plle2
   port map
   (
      RST        => vres(0),
      SSTEP      => sen_3,
      STATE      => frame,
      CLKDRP     => CLKDRP,
      
      SRDY_N     => srdy_3_n,
      LOCKED_OUT => open,
      
      CLKIN      => clk2,
      CLKOUT5    => clkhdmi5,
      CLKOUT5N   => clkhdmi5n,
      CLKOUT     => clkhdmi
   );
   
   -- deliver hdmi clocks glitch free
   
   process (clkhdmi, locked)
   begin
      if locked = '0' then
         locked_hdmi <= '0';
      elsif rising_edge(clkhdmi) then
         locked_hdmi <= '1';
      end if;
   end process;
   
   BUFG_CLKHDMI   : BUFGCE_1
   port map
   (
      CE => locked_hdmi,
      I  => clkhdmi,
      O  => CLK1OUT
   );

   BUFG_CLKHDMI5  : BUFGCE_1
   port map
   (
      CE => locked_hdmi,
      I  => clkhdmi5,
      O  => CLK0OUT
   );

   BUFG_CLKHDMI5N : BUFGCE
   port map
   (
      CE => locked_hdmi,
      I  => clkhdmi5n,
      O  => CLK0OUTB
   );
   
   VALID <= locked_hdmi;
   
end architecture;
