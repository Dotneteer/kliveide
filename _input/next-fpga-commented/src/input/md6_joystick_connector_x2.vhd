
-- Sega Mega Drive Pads x 2
-- Copyright 2020, 2022 Victor Trucco and Alvin Albrecht
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

entity md6_joystick_connector_x2 is
   port 
   (
      i_reset        : in std_logic;
      
      i_CLK_28       : in std_logic;
      i_CLK_EN       : in std_logic;    -- every ~4.57us
      
      i_joy_1_n      : in std_logic;
      i_joy_2_n      : in std_logic;
      i_joy_3_n      : in std_logic;
      i_joy_4_n      : in std_logic;
      i_joy_6_n      : in std_logic;
      i_joy_9_n      : in std_logic;
      
      i_io_mode_en      : in std_logic;
      i_io_mode_pin_7   : in std_logic;
      
      o_joy_7        : out std_logic;
      o_joy_select   : out std_logic;   -- 0 = left connector, 1 = right connector

      o_joy_left     : out std_logic_vector(11 downto 0);   -- active high  MODE X Z Y START A C B U D L R
      o_joy_right    : out std_logic_vector(11 downto 0)    -- active high  MODE X Z Y START A C B U D L R
   );
end entity;

architecture rtl of md6_joystick_connector_x2 is

   signal io_mode          : std_logic := '0';
   signal io_mode_change   : std_logic;

   -- https://github.com/jonthysell/SegaController/wiki/How-To-Read-Sega-Controllers
   
   -- The state machine consists of 512 states for a period of ~2.34ms
   -- 496 states are padding to allow the md controllers time to reset between reads ~2.26ms
   
   -- Pulse width of the select signal must be < ~15us otherwise 6-button controllers won't work
   -- Here it's ~9.14us

   signal state      : std_logic_vector(8 downto 0);
   signal state_next : std_logic_vector(8 downto 0);
   
   -- X X X X X S S 7 J
   --
   --   X = padding for md pad reset
   -- SS7 = eight states in state machine, 7 = select on pin 7
   --   J = connector being read: left = 0, right = 1
   
   signal state_rest : std_logic;
   
   signal joy_left_six_button_n     : std_logic;
   signal joy_left_n                : std_logic_vector(11 downto 0);
   
   signal joy_right_six_button_n    : std_logic;
   signal joy_right_n               : std_logic_vector(11 downto 0);
   
   signal joy_raw                   : std_logic_vector(5 downto 0);
   
begin

   -- io mode
   
   process (i_CLK_28)
   begin
      if rising_edge(i_CLK_28) then
         io_mode <= i_io_mode_en;
      end if;
   end process;
   
   io_mode_change <= io_mode xor i_io_mode_en;

   -- md pad state machine
   
   state_rest <= state(8) or state(7) or state(6) or state(5) or state(4);
   state_next <= state + 1;
   
   process (i_CLK_28)
   begin
      if rising_edge(i_CLK_28) then
         if i_reset = '1' or io_mode_change = '1' then
            state <= "111110000";
         elsif io_mode = '1' then
            state <= "1111100" & state_next(1 downto 0);
         elsif i_CLK_EN = '1' then
            state <= state_next;
         end if;
      end if;
   end process;

   o_joy_7 <= (state_rest or state(1)) when io_mode = '0' else i_io_mode_pin_7;
   o_joy_select <= state(0) when io_mode = '0' else state(1);
   
   -- build md pad state
   
   joy_raw <= i_joy_9_n & i_joy_6_n & i_joy_1_n & i_joy_2_n & i_joy_3_n & i_joy_4_n;
   
   process (i_CLK_28)
   begin
      if rising_edge(i_CLK_28) then
         if i_reset = '1' or io_mode_change = '1' then
         
            joy_left_n <= (others => '1');
            joy_right_n <= (others => '1');
         
         elsif i_CLK_EN = '1' and state_rest = '0' then
         
            case state(3 downto 0) is
            
               when "000" & '0' =>
                  joy_left_six_button_n <= '1';
                  joy_left_n <= (others => '1');
                  joy_right_six_button_n <= '1';
                  joy_right_n <= (others => '1');
               
               when "010" & '0' =>
                  if i_joy_3_n = '0' and i_joy_4_n = '0' then
                     joy_left_n(7 downto 6) <= i_joy_9_n & i_joy_6_n;
                  end if;

               when "010" & '1' =>
                  if i_joy_3_n = '0' and i_joy_4_n = '0' then
                     joy_right_n(7 downto 6) <= i_joy_9_n & i_joy_6_n;
                  end if;

               when "011" & '0' =>
                  joy_left_n(5 downto 0) <= joy_raw;
               
               when "011" & '1' =>
                  joy_right_n(5 downto 0) <= joy_raw;
               
               when "100" & '0' =>
                  joy_left_six_button_n <= i_joy_1_n or i_joy_2_n;
               
               when "100" & '1' =>
                  joy_right_six_button_n <= i_joy_1_n or i_joy_2_n;
               
               when "101" & '0' =>
                  if joy_left_six_button_n = '0' then
                     joy_left_n(11 downto 8) <= i_joy_4_n & i_joy_3_n & i_joy_1_n & i_joy_2_n;
                  end if;
               
               when "101" & '1' =>
                  if joy_right_six_button_n = '0' then
                     joy_right_n(11 downto 8) <= i_joy_4_n & i_joy_3_n & i_joy_1_n & i_joy_2_n;
                  end if;
                  
               when others => null;
               
            end case;
            
         end if;
      end if;
   end process;
   
   process (i_CLK_28)
   begin
      if rising_edge(i_CLK_28) then
         if i_reset = '1' or io_mode_change = '1' then
            o_joy_left <= (others => '0');
            o_joy_right <= (others => '0');
         elsif io_mode = '1' and state(1 downto 0) = "01" then
            o_joy_left <= "000000" & not joy_raw;
         elsif io_mode = '1' and state(1 downto 0) = "11" then
            o_joy_right <= "000000" & not joy_raw;
         elsif io_mode = '0' and state_rest = '1' then
            o_joy_left <= not joy_left_n;
            o_joy_right <= not joy_right_n;
         end if;
      end if;
   end process;

end architecture;
