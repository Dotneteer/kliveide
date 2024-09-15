-- PS2 Keyboard
-- Copyright 2020 Fabio Belavenuto
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

-- ps2 button state is represented in an 8x7 matrix
-- when the physical membrane is scanned, the ps2 inserts column data
-- caps + sym shift presses are counted; shifts are not lost in multiple keys
-- typematic filtered so that shift counts remain accurate
-- F9 = multiface nmi button, F10 = divmmc nmi button
-- function keys work as on membrane: F9 + number but are also programmable
-- pause/break resets the ps2 matrix state

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity ps2_keyb is
   generic
   (
      CLK_KHZ           : integer
   );
   port
   (
      i_CLK             : in std_logic;
      i_CLK_n           : in std_logic;
      i_CLK_PS2         : in std_logic;
      i_reset           : in std_logic;
      -- ps2 interface
      i_ps2_clk_in      : in std_logic;
      i_ps2_data_in     : in std_logic;
      o_ps2_clk_out_en  : out std_logic;
      o_ps2_clk_out     : out std_logic;
      o_ps2_data_out_en : out std_logic;
      o_ps2_data_out    : out std_logic;
      -- membrane interaction
      i_membrane_row    : in std_logic_vector(2 downto 0);
      o_membrane_col    : out std_logic_vector(6 downto 0);
      -- nmi button simulation
      o_mf_nmi_n        : out std_logic;
      o_divmmc_nmi_n    : out std_logic;
      -- function key simulation
      o_ps2_func_keys_n : out std_logic_vector(7 downto 0);
      -- programmable keymap
      i_keymap_addr     : in std_logic_vector(8 downto 0);
      i_keymap_data     : in std_logic_vector(7 downto 0);
      i_keymap_we       : in std_logic
   );
end entity;

architecture rtl of ps2_keyb is

   signal capshift_count_zero    : std_logic;
   signal capshift_count         : std_logic_vector(2 downto 0);
   
   signal symshift_count_zero    : std_logic;
   signal symshift_count         : std_logic_vector(2 downto 0);

   type key_matrix_t is array (7 downto 0) of std_logic_vector(6 downto 0);
   signal matrix_state           : key_matrix_t := ((others => (others => '1')));
   
   signal row_0_n                : std_logic;
   signal row_7_n                : std_logic;
   
   signal ps2_keymap_data        : std_logic_vector(8 downto 0);
   
   signal ps2_current_keycode    : std_logic_vector(9 downto 0);
   signal ps2_last_keycode       : std_logic_vector(9 downto 0);
   
   signal ps2_code_valid         : std_logic;
   signal ps2_key_valid          : std_logic;
   signal ps2_fk_valid           : std_logic;
   signal ps2_matrix_reset       : std_logic;
   
   signal ps2_receive_valid      : std_logic;
   signal ps2_receive_valid_d    : std_logic;
   signal ps2_receive_valid_re   : std_logic;
   signal ps2_receive_data       : std_logic_vector(7 downto 0);
   signal ps2_send_valid         : std_logic := '0';

   signal ps2_data_01            : std_logic;
   signal ps2_data_09            : std_logic;
   signal ps2_data_1f            : std_logic;
   signal ps2_data_27            : std_logic;
   signal ps2_data_aa            : std_logic;
   signal ps2_data_e0            : std_logic;
   signal ps2_data_e1            : std_logic;
   signal ps2_data_f0            : std_logic;
   
   signal clk_ps2_d              : std_logic;
   signal clk_ps2_re             : std_logic;
   
   type state_t is (KM_IDLE, KM_READ, KM_END);
   signal state                  : state_t;
   signal state_next             : state_t;
   
   signal ps2_key_extend         : std_logic;
   signal ps2_key_release        : std_logic;

begin

   -- nmi buttons simulated via F9 and F10
   -- these must be singled out to detect them the same way as the button presses
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or ps2_matrix_reset = '1' then
            o_mf_nmi_n <= '1';
         elsif ps2_key_valid = '1' and ((ps2_key_extend = '0' and ps2_data_01 = '1') or (ps2_key_extend = '1' and ps2_data_1f = '1')) then
            o_mf_nmi_n <= ps2_key_release;
         end if;
      end if;
   end process;
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or ps2_matrix_reset = '1' then
            o_divmmc_nmi_n <= '1';
         elsif ps2_key_valid = '1' and ((ps2_key_extend = '0' and ps2_data_09 = '1') or (ps2_key_extend = '1' and ps2_data_27 = '1')) then
            o_divmmc_nmi_n <= ps2_key_release;
         end if;
      end if;
   end process;
   
   -- matrix representation
   
   capshift_count_zero <= '1' when capshift_count = std_logic_vector(to_unsigned(0,capshift_count'length)) else '0';
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or ps2_matrix_reset = '1' then
            capshift_count <= (others => '0');
         elsif ps2_key_valid = '1' and ps2_keymap_data(6) = '1' then
            if ps2_key_release = '0' then
               capshift_count <= capshift_count + 1;
            elsif capshift_count_zero = '0' then
               capshift_count <= capshift_count - 1;
            end if;
         end if;
      end if;
   end process;
   
   symshift_count_zero <= '1' when symshift_count = std_logic_vector(to_unsigned(0,symshift_count'length)) else '0';
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or ps2_matrix_reset = '1' then
            symshift_count <= (others => '0');
         elsif ps2_key_valid = '1' and ps2_keymap_data(7) = '1' then
            if ps2_key_release = '0' then
               symshift_count <= symshift_count + 1;
            elsif symshift_count_zero = '0' then
               symshift_count <= symshift_count - 1;
            end if;
         end if;
      end if;
   end process;

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or ps2_matrix_reset = '1' then
            matrix_state <= ((others => (others => '1')));
         elsif ps2_key_valid = '1' and ps2_keymap_data(2 downto 0) /= "111" then
            matrix_state(to_integer(unsigned(ps2_keymap_data(5 downto 3))))(to_integer(unsigned(ps2_keymap_data(2 downto 0)))) <= ps2_key_release;
         end if;
      end if;
   end process;
   
   -- membrane scan
   
   row_0_n <= '0' when i_membrane_row = "000" else '1';
   row_7_n <= '0' when i_membrane_row = "111" else '1';
   
   o_membrane_col <= (matrix_state(to_integer(unsigned(i_membrane_row)))(6 downto 2)) & 
                     (matrix_state(to_integer(unsigned(i_membrane_row)))(1) and (row_7_n or symshift_count_zero)) & 
                     (matrix_state(to_integer(unsigned(i_membrane_row)))(0) and (row_0_n or capshift_count_zero));

   -- ps2 function keys
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or ps2_matrix_reset = '1' then
            o_ps2_func_keys_n <= (others => '1');
         elsif ps2_fk_valid = '1' then
            o_ps2_func_keys_n(to_integer(unsigned(ps2_keymap_data(2 downto 0)))) <= ps2_key_release;
         end if;
      end if;
   end process;

   -- ps2 keymap

   keymap: entity work.keymaps
   port map
   (
      clock_i     => i_CLK_n,
      addr_wr_i   => i_keymap_addr,
      data_i      => '0' & i_keymap_data,
      we_i        => i_keymap_we,
      --
      addr_rd_i   => ps2_key_extend & ps2_receive_data,
      data_o      => ps2_keymap_data
   );

   ps2_current_keycode <= ps2_key_release & ps2_key_extend & ps2_receive_data;

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or ps2_matrix_reset = '1' then
            ps2_last_keycode <= (others => '1');
         elsif ps2_code_valid = '1' then
            ps2_last_keycode <= ps2_current_keycode;   -- eliminate typematic
         end if;
      end if;
   end process;

   ps2_code_valid <= '1' when (state = KM_READ) and ((ps2_last_keycode /= ps2_current_keycode) or ps2_key_release = '1') else '0';
   
   ps2_key_valid <= '1' when ps2_code_valid = '1' and ps2_keymap_data(7 downto 6) /= "11" else '0';
   ps2_fk_valid <= '1' when ps2_code_valid = '1' and ps2_keymap_data(7 downto 6) = "11" else '0';

   ps2_matrix_reset <= (ps2_key_valid and ps2_data_e1) or ps2_send_valid;
   
   -- ps2 interface
   
   -- The reset may not be seen inside this module because it operates on a much slower clock.
   -- The module needs to be rewritten and replaced, possibly merging keyboard and mouse.
   
   ps2_alt0: entity work.ps2_iobase
   generic map (
      clkfreq_g      => CLK_KHZ
   )
   port map (
      clock_i        => i_CLK_PS2,
      reset_i        => i_reset,
      enable_i       => '1',
      ps2_clk_i      => i_ps2_clk_in, 
      ps2_data_i     => i_ps2_data_in, 
      ps2_clk_o      => o_ps2_clk_out, 
      ps2_data_o     => o_ps2_data_out, 
      ps2_data_out   => o_ps2_data_out_en, 
      ps2_clk_out    => o_ps2_clk_out_en, 
      data_rdy_i     => ps2_send_valid,
      data_i         => X"F8",
      send_rdy_o     => open,
      data_rdy_o     => ps2_receive_valid,
      data_o         => ps2_receive_data,
      sigsending_o   => open
   );
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or (clk_ps2_re = '1' and ps2_send_valid = '1') then
            ps2_send_valid <= '0';
         elsif ps2_receive_valid_re = '1' and ps2_data_aa = '1' then
            ps2_send_valid <= '1';
         end if;
      end if;
   end process;

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            clk_ps2_d <= '1';
         else
            clk_ps2_d <= i_CLK_PS2;
         end if;
      end if;
   end process;
    
   clk_ps2_re <= i_CLK_PS2 and not clk_ps2_d;
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            ps2_receive_valid_d <= '0';
         else
            ps2_receive_valid_d <= ps2_receive_valid;
         end if;
      end if;
   end process;
   
   ps2_receive_valid_re <= ps2_receive_valid and not ps2_receive_valid_d;

   process (ps2_receive_data)
   begin
      ps2_data_01 <= '0';
      ps2_data_09 <= '0';
      ps2_data_1f <= '0';
      ps2_data_27 <= '0';
      ps2_data_aa <= '0';
      ps2_data_e0 <= '0';
      ps2_data_e1 <= '0';
      ps2_data_f0 <= '0';
      case ps2_receive_data is
         when X"01" => ps2_data_01 <= '1';
         when X"09" => ps2_data_09 <= '1';
         when X"1F" => ps2_data_1f <= '1';
         when X"27" => ps2_data_27 <= '1';
         when X"AA" => ps2_data_aa <= '1';
         when X"E0" => ps2_data_e0 <= '1';
         when X"E1" => ps2_data_e1 <= '1';
         when X"F0" => ps2_data_f0 <= '1';
         when others => null;
      end case;
   end process;

   -- ps2 state machine
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            state <= KM_IDLE;
         else
            state <= state_next;
         end if;
      end if;
   end process;
   
   process (state, ps2_receive_valid_re, ps2_data_aa, ps2_data_e0, ps2_data_f0)
   begin
      case state is
         when KM_IDLE =>
            if ps2_receive_valid_re = '1' then
               if ps2_data_aa = '1' then
                  state_next <= KM_END;
               elsif ps2_data_e0 = '1' or ps2_data_f0 = '1' then
                  state_next <= KM_IDLE;
               else
                  state_next <= KM_READ;
               end if;
            else
               state_next <= KM_IDLE;
            end if;
         when KM_READ =>
            state_next <= KM_END;
         when KM_END =>
            state_next <= KM_IDLE;
         when others =>
            state_next <= KM_IDLE;
      end case;
   end process;

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or state = KM_END then
            ps2_key_extend <= '0';
         elsif ps2_receive_valid_re = '1' and ps2_data_e0 = '1' then
            ps2_key_extend <= '1';
         end if;
      end if;
   end process;
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or state = KM_END then
            ps2_key_release <= '0';
         elsif ps2_receive_valid_re = '1' and ps2_data_f0 = '1' then
            ps2_key_release <= '1';
         end if;
      end if;
   end process;

end architecture;
