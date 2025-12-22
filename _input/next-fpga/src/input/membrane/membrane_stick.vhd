
-- User Definable Keyboard Joystick
-- Copyright 2021 Alvin Albrecht
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

entity membrane_stick is
   port
   (
      i_CLK                : in std_logic;
      i_CLK_EN             : in std_logic;  -- scanning a new keyboard row, at least 25x slower than clock

      i_reset              : in std_logic;

      i_joy_en_n           : in std_logic;

      i_joy_left           : in std_logic_vector(11 downto 0);  -- active high  MODE X Z Y START A C B U D L R
      i_joy_left_type      : in std_logic_vector(2 downto 0);

      i_joy_right          : in std_logic_vector(11 downto 0);  -- active high  MODE X Z Y START A C B U D L R
      i_joy_right_type     : in std_logic_vector(2 downto 0);

      i_membrane_row       : in std_logic_vector(2 downto 0);
      o_membrane_col       : out std_logic_vector(6 downto 0);

      i_keymap_addr        : in std_logic_vector(4 downto 0);   -- left/right (4), button number (3:0)
      i_keymap_data        : in std_logic_vector(5 downto 0);   -- membrane row (5:3), membrane col (2:0)
      i_keymap_we          : in std_logic
   );
end entity;

architecture rtl of membrane_stick is

   component keyjoy_sdpram_64_6 is
   PORT (
      DPRA  : IN  STD_LOGIC_VECTOR(6-1 downto 0) := (OTHERS => '0');
      CLK   : IN STD_LOGIC;
      WE    : IN  STD_LOGIC;
      DPO   : OUT STD_LOGIC_VECTOR(6-1 downto 0);
      A     : IN  STD_LOGIC_VECTOR(6-1-(4*0*boolean'pos(7>4)) downto 0) := (OTHERS => '0');
      D     : IN  STD_LOGIC_VECTOR(6-1 downto 0) := (OTHERS => '0')
   );
   end component;

   signal state               : std_logic := '0';
   signal state_next          : std_logic;
   
   signal joy_state           : std_logic_vector(11 downto 0);
   signal joy_type            : std_logic_vector(2 downto 0);
   signal joy_addr_start      : std_logic_vector(4 downto 0);
   signal joy_bit_count_start : std_logic_vector(3 downto 0);
   signal joy_bit_count_end   : std_logic_vector(3 downto 0);
   
   signal bit_count_end       : std_logic;
   signal joy_sel             : std_logic;
   signal sram_addr           : std_logic_vector(4 downto 0);
   signal bit_count           : std_logic_vector(3 downto 0);
   signal bit_count_max       : std_logic_vector(3 downto 0);

   signal joy_keymap_do       : std_logic_vector(5 downto 0);
   signal membrane_col        : std_logic_vector(7 downto 0);

begin

   -- state machine

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            state <= '0';
         else
            state <= state_next;
         end if;
      end if;
   end process;

   process (state, i_CLK_EN, joy_sel, bit_count_end)
   begin
      case state is
         when '0' =>
            if i_CLK_EN = '1' then
               state_next <= '1';
            else
               state_next <= '0';
            end if;
         when others =>
            if joy_sel = '1' and bit_count_end = '1' then
               state_next <= '0';
            else
               state_next <= '1';
            end if;
      end case;
   end process;
   
   -- joystick parameter selection
   
   joy_state <= i_joy_left when joy_sel = '0' else i_joy_right;
   joy_type <= i_joy_left_type when bit_count_end = '0' else i_joy_right_type;
   
   process (joy_type)
   begin
      case joy_type is
         when "011" =>   -- Sinclair 1
            joy_addr_start <= "00000";
            joy_bit_count_start <= "0000";
            joy_bit_count_end <= "0100";
         when "000" =>   -- Sinclair 2
            joy_addr_start <= "00101";
            joy_bit_count_start <= "0000";
            joy_bit_count_end <= "0100";
         when "010" =>   -- Cursor
            joy_addr_start <= "01010";
            joy_bit_count_start <= "0000";
            joy_bit_count_end <= "0100";
         when "111" =>   -- User Defined
            joy_addr_start <= "10000";
            joy_bit_count_start <= "0000";
            joy_bit_count_end <= "1011";
         when "001" | "100" =>  -- Kempston
            joy_addr_start <= "10101";
            joy_bit_count_start <= "0101";
            joy_bit_count_end <= "1011";
         when others =>  -- MD Pad
            joy_addr_start <= "11000";
            joy_bit_count_start <= "1000";
            joy_bit_count_end <= "1011";
      end case;
   end process;
   
   -- joystick address generation
   
   bit_count_end <= '1' when bit_count = bit_count_max else '0';
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if state = '0' or bit_count_end = '1' then
            joy_sel <= bit_count_end;
            sram_addr <= joy_addr_start;
            bit_count <= joy_bit_count_start;
            bit_count_max <= joy_bit_count_end;
         elsif state = '1' then
            sram_addr <= sram_addr + 1;
            bit_count <= bit_count + 1;
         end if;
      end if;
   end process;
   
   -- joystick bit to key assignment lookup

   udk_map: keyjoy_sdpram_64_6  -- initialized with sinclair / cursor mappings
   port map                     -- src/ram/init/keyjoy_64_6.coe
   (
      -- async read (keymap)
      DPRA => joy_sel & sram_addr,
      DPO  => joy_keymap_do,
      -- sync write (cpu)
      CLK  => i_CLK,
      WE   => i_keymap_we,
      A    => i_keymap_addr(4) & '1' & i_keymap_addr(3 downto 0),
      D    => i_keymap_data
   );

   -- membrane column bits computation

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or (state = '0' and state_next = '1') or i_joy_en_n = '1' then
            membrane_col <= (others => '1');
         elsif state = '1' and joy_keymap_do(5 downto 3) = i_membrane_row and joy_state(to_integer(unsigned(bit_count))) = '1' then
            membrane_col(to_integer(unsigned(joy_keymap_do(2 downto 0)))) <= '0';
         end if;
      end if;
   end process;

   o_membrane_col <= membrane_col(6 downto 0);

end architecture;
