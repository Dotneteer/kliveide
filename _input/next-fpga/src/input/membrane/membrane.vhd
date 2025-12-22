
-- Keyboard Membrane Scan
-- Copyright 2020 Victor Trucco and Alvin Albrecht
--
-- Membrane state machine - Victor Trucco
-- Refactor & modify for 8x7 matrix - Alvin Albrecht
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

entity membrane is
   port
   (
      i_CLK             : in  std_logic;
      i_CLK_EN          : in  std_logic;
      
      i_reset           : in  std_logic;
      
      i_rows            : in  std_logic_vector(7 downto 0);   -- key rows being read
      o_cols            : out std_logic_vector(4 downto 0);   -- key cols returned for read
      
      o_membrane_rows   : out std_logic_vector(7 downto 0);   -- physical membrane rows  0 = active, 1 = Z
      o_membrane_ridx   : out std_logic_vector(2 downto 0);   -- physical membrane row by number 0-7
      i_membrane_cols   : in  std_logic_vector(6 downto 0);   -- physical membrane cols returned, 6:5 are extra columns
      
      i_cancel_extended_entries  : in std_logic;              -- cancel making entries in the standard 8x5 matrix for the extra keys
      o_extended_keys   : out std_logic_vector(15 downto 0)
   );
end entity;

architecture rtl of membrane is

   type key_matrix_t is array (7 downto 0) of std_logic_vector(6 downto 0);

   signal state            : std_logic_vector(8 downto 0) := '1' & X"FE";
   signal index            : natural range 0 to 7;
   
   signal matrix_state     : key_matrix_t := ((others => (others => '1')));
   signal matrix_work      : key_matrix_t := ((others => (others => '1')));
   
   signal matrix_state_ex  : std_logic_vector(16 downto 0);
   signal matrix_work_ex   : std_logic_vector(16 downto 0);
   
   signal matrix_state_ex_0 : std_logic_vector(18 downto 0);
   signal matrix_state_ex_1 : std_logic_vector(18 downto 0);
   
   signal matrix_state_0   : std_logic_vector(4 downto 0);
   signal matrix_state_3   : std_logic_vector(4 downto 0);
   signal matrix_state_4   : std_logic_vector(4 downto 0);
   signal matrix_state_5   : std_logic_vector(4 downto 0);
   signal matrix_state_7   : std_logic_vector(4 downto 0);
   
   signal r0               : std_logic_vector(4 downto 0);
   signal r1               : std_logic_vector(4 downto 0);
   signal r2               : std_logic_vector(4 downto 0);
   signal r3               : std_logic_vector(4 downto 0);
   signal r4               : std_logic_vector(4 downto 0);
   signal r5               : std_logic_vector(4 downto 0);
   signal r6               : std_logic_vector(4 downto 0);
   signal r7               : std_logic_vector(4 downto 0);

begin

   --
   -- physical membrane row scan
   --
   
   -- one-hot state machine

   -- 0  = START
   -- 1  = A8
   -- 2  = A9
   -- 3  = A10
   -- 4  = A11
   -- 5  = A12
   -- 6  = A13
   -- 7  = A14
   -- 8  = A15

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            state <= '1' & X"FE";
         elsif i_CLK_EN = '1' then
            state <= state(7 downto 0) & state(8);
         end if;
      end if;
   end process;
   
   o_membrane_rows <= state(8 downto 1);

   -- store physical membrane scan into matrix
   
   process (state)
   begin
      if state(1) = '0' then
         index <= 0;
      elsif state(2) = '0' then
         index <= 1;
      elsif state(3) = '0' then
         index <= 2;
      elsif state(4) = '0' then
         index <= 3;
      elsif state(5) = '0' then
         index <= 4;
      elsif state(6) = '0' then
         index <= 5;
      elsif state(7) = '0' then
         index <= 6;
      else
         index <= 7;
      end if;
   end process;
   
   o_membrane_ridx <= std_logic_vector(to_unsigned(index,3));
   
   -- 8 x 5
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            matrix_state <= ((others => (others => '1')));
            matrix_work <= ((others => (others => '1')));
         elsif i_CLK_EN = '1' then
            if state(0) = '0' then
               for I in 0 to 7 loop
                  matrix_state(I) <= matrix_work(I);
               end loop;
            else
               matrix_work(index) <= i_membrane_cols;
            end if;
         end if;
      end if;
   end process;
               
   -- extra two columns

   -- ex registers contain keypresses for:
   --
   -- key  CPR SMR |  N  M SYM SPC  O  P  6  7  8  9  0  5  4  3  2  1 CAP
   -- bit  18  17  | 16 15 14  13  12 11 10  9  8  7  6  5  4  3  2  1  0
   
   -- column bits 6:5 arranged on rows as follows:
   --
   --         bit 6       bit 5
   --
   -- row 0   UP          EXTEND
   -- row 1   GRAPH       CAPS LOCK
   -- row 2   INV VIDEO   TRUE VIDEO
   -- row 3   EDIT        BREAK
   -- row 4   "           ;
   -- row 5   .           ,
   -- row 6   RIGHT       DELETE
   -- row 7   DOWN        LEFT
   
   -- Make it harder for naive software to incorrectly read composite keys by
   -- advancing shift key state one scan and holding shift key state an extra scan.
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or i_cancel_extended_entries = '1' then
            matrix_state_ex_1 <= (others => '1');
            matrix_state_ex_0 <= (others => '1');
            matrix_work_ex <= (others => '1');
         elsif i_CLK_EN = '1' then
            if state(0) = '0' then
               matrix_state_ex_1 <= matrix_state_ex_0;
               matrix_state_ex_0 <= matrix_work_ex(0) & matrix_work_ex(14) & matrix_work_ex(16 downto 15) & (matrix_work_ex(14) and matrix_state_ex_1(17)) & matrix_work_ex(13 downto 1) & (matrix_work_ex(0) and matrix_state_ex_1(18));
               matrix_work_ex <= (others => '1');
            else
               case index is
                  when 0 =>
                     matrix_work_ex(0) <= matrix_work_ex(0) and i_membrane_cols(6) and i_membrane_cols(5);
                     matrix_work_ex(9) <= i_membrane_cols(6);
                     matrix_work_ex(14) <= matrix_work_ex(14) and i_membrane_cols(5);
                  when 1 =>
                     matrix_work_ex(0) <= matrix_work_ex(0) and i_membrane_cols(6) and i_membrane_cols(5);
                     matrix_work_ex(7) <= i_membrane_cols(6);
                     matrix_work_ex(2) <= i_membrane_cols(5);
                  when 2 =>
                     matrix_work_ex(0) <= matrix_work_ex(0) and i_membrane_cols(6) and i_membrane_cols(5);
                     matrix_work_ex(4) <= i_membrane_cols(6);
                     matrix_work_ex(3) <= i_membrane_cols(5);
                  when 3 =>
                     matrix_work_ex(0) <= matrix_work_ex(0) and i_membrane_cols(6) and i_membrane_cols(5);
                     matrix_work_ex(1) <= i_membrane_cols(6);
                     matrix_work_ex(13) <= i_membrane_cols(5);
                  when 4 =>
                     matrix_work_ex(14) <= matrix_work_ex(14) and i_membrane_cols(6) and i_membrane_cols(5);
                     matrix_work_ex(11) <= i_membrane_cols(6);
                     matrix_work_ex(12) <= i_membrane_cols(5);
                  when 5 =>
                     matrix_work_ex(14) <= matrix_work_ex(14) and i_membrane_cols(6) and i_membrane_cols(5);
                     matrix_work_ex(15) <= i_membrane_cols(6);
                     matrix_work_ex(16) <= i_membrane_cols(5);
                  when 6 =>
                     matrix_work_ex(0) <= matrix_work_ex(0) and i_membrane_cols(6) and i_membrane_cols(5);
                     matrix_work_ex(8) <= i_membrane_cols(6);
                     matrix_work_ex(6) <= i_membrane_cols(5);
                  when others =>
                     matrix_work_ex(0) <= matrix_work_ex(0) and i_membrane_cols(6) and i_membrane_cols(5);
                     matrix_work_ex(10) <= i_membrane_cols(6);
                     matrix_work_ex(5) <= i_membrane_cols(5);
               end case;
            end if;
         end if;
      end if;
   end process;

   matrix_state_ex <= matrix_state_ex_1(16 downto 15) & (matrix_state_ex_1(14) and matrix_state_ex_0(14)) & matrix_state_ex_1(13 downto 1) & (matrix_state_ex_1(0) and matrix_state_ex_0(0));

   -- read matrix state

   matrix_state_0 <= matrix_state(0)(4 downto 1) & (matrix_state(0)(0) and matrix_state_ex(0));
   matrix_state_3 <= matrix_state(3)(4 downto 0) and matrix_state_ex(5 downto 1);
   matrix_state_4 <= matrix_state(4)(4 downto 0) and matrix_state_ex(10 downto 6);
   matrix_state_5 <= matrix_state(5)(4 downto 2) & (matrix_state(5)(1 downto 0) and matrix_state_ex(12 downto 11));
   matrix_state_7 <= matrix_state(7)(4) & (matrix_state(7)(3 downto 0) and matrix_state_ex(16 downto 13));
   
   r0 <= matrix_state_0  when i_rows(0) = '0' else (others => '1');
   r1 <= matrix_state(1)(4 downto 0) when i_rows(1) = '0' else (others => '1');
   r2 <= matrix_state(2)(4 downto 0) when i_rows(2) = '0' else (others => '1');
   r3 <= matrix_state_3  when i_rows(3) = '0' else (others => '1');
   r4 <= matrix_state_4  when i_rows(4) = '0' else (others => '1');
   r5 <= matrix_state_5  when i_rows(5) = '0' else (others => '1');
   r6 <= matrix_state(6)(4 downto 0) when i_rows(6) = '0' else (others => '1');
   r7 <= matrix_state_7  when i_rows(7) = '0' else (others => '1');
   
   o_cols <= r0 and r1 and r2 and r3 and r4 and r5 and r6 and r7;
   
   o_extended_keys <= not (matrix_state(7)(6 downto 5) & matrix_state(6)(6 downto 5) & matrix_state(5)(6 downto 5) & matrix_state(4)(6 downto 5) &
                      matrix_state(3)(6 downto 5) & matrix_state(2)(6 downto 5) & matrix_state(1)(6 downto 5) & matrix_state(0)(6 downto 5));
   
end architecture;
