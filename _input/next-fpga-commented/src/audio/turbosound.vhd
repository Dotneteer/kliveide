
-- TurboSound Next
-- Copyright 2020 Fabio Belavenuto and Alvin Albrecht
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

entity turbosound is
   port
   (
      clock_i        : in std_logic;
      clock_en_i     : in std_logic;
      
      reset_i        : in std_logic;
      
      aymode_i          : in std_logic;                     -- 0 = YM, 1 = AY
      turbosound_en_i   : in std_logic;                     -- 0 = use one AY, 1 = enable all AY
      
      psg_reg_addr_i : in std_logic;                        -- select a new ay register
      psg_reg_wr_i   : in std_logic;                        -- write to selected register
      psg_d_i        : in std_logic_vector(7 downto 0);     -- data in
      psg_d_o_reg_i  : in std_logic;                        -- output selected register rather than contents
      psg_d_o        : out std_logic_vector(7 downto 0);    -- selected register's contents
      
      mono_mode_i    : in std_logic_vector(2 downto 0);     -- 0 = stereo, 1 = mono for each psg
      stereo_mode_i  : in std_logic;                        -- 0 = ABC, 1 = ACB for all psg
   
--    port_a_i       : in std_logic_vector(7 downto 0);     -- IO Port A input on default AY
--    port_a_o       : out std_logic_vector(7 downto 0);    -- current R14 state
   
      pcm_ay_L_o     : out std_logic_vector(11 downto 0);
      pcm_ay_R_o     : out std_logic_vector(11 downto 0)
   );
end entity;

architecture rtl of turbosound is

   signal ay_select        : std_logic_vector(1 downto 0);
   signal psg0_pan         : std_logic_vector(1 downto 0);
   signal psg1_pan         : std_logic_vector(1 downto 0);
   signal psg2_pan         : std_logic_vector(1 downto 0);
   signal psg_addr         : std_logic;
   signal psg0_addr        : std_logic;
   signal psg0_we          : std_logic;
   signal psg1_addr        : std_logic;
   signal psg1_we          : std_logic;
   signal psg2_addr        : std_logic;
   signal psg2_we          : std_logic;
   
   signal psg0_do          : std_logic_vector(7 downto 0);
   signal psg0_A           : std_logic_vector(7 downto 0);
   signal psg0_B           : std_logic_vector(7 downto 0);
   signal psg0_C           : std_logic_vector(7 downto 0);
   signal psg0_L_mux       : std_logic_vector(7 downto 0);
   signal psg0_L_sum       : std_logic_vector(8 downto 0);
   signal psg0_R_mux       : std_logic_vector(8 downto 0);
   signal psg0_R_sum       : std_logic_vector(9 downto 0);
   signal psg0_L_fin       : std_logic_vector(9 downto 0);
   signal psg0_L           : std_logic_vector(9 downto 0);
   signal psg0_R           : std_logic_vector(9 downto 0);
   
   signal psg1_do          : std_logic_vector(7 downto 0);
   signal psg1_A           : std_logic_vector(7 downto 0);
   signal psg1_B           : std_logic_vector(7 downto 0);
   signal psg1_C           : std_logic_vector(7 downto 0);
   signal psg1_L_mux       : std_logic_vector(7 downto 0);
   signal psg1_L_sum       : std_logic_vector(8 downto 0);
   signal psg1_R_mux       : std_logic_vector(8 downto 0);
   signal psg1_R_sum       : std_logic_vector(9 downto 0);
   signal psg1_L_fin       : std_logic_vector(9 downto 0);
   signal psg1_L           : std_logic_vector(9 downto 0);
   signal psg1_R           : std_logic_vector(9 downto 0);

   signal psg2_do          : std_logic_vector(7 downto 0);
   signal psg2_A           : std_logic_vector(7 downto 0);
   signal psg2_B           : std_logic_vector(7 downto 0);
   signal psg2_C           : std_logic_vector(7 downto 0);
   signal psg2_L_mux       : std_logic_vector(7 downto 0);
   signal psg2_L_sum       : std_logic_vector(8 downto 0);
   signal psg2_R_mux       : std_logic_vector(8 downto 0);
   signal psg2_R_sum       : std_logic_vector(9 downto 0);
   signal psg2_L_fin       : std_logic_vector(9 downto 0);
   signal psg2_L           : std_logic_vector(9 downto 0);
   signal psg2_R           : std_logic_vector(9 downto 0);

   signal psg0_L_pan       : std_logic_vector(9 downto 0);
   signal psg1_L_pan       : std_logic_vector(9 downto 0);
   signal psg2_L_pan       : std_logic_vector(9 downto 0);
   signal psg0_R_pan       : std_logic_vector(9 downto 0);
   signal psg1_R_pan       : std_logic_vector(9 downto 0);
   signal psg2_R_pan       : std_logic_vector(9 downto 0);

begin

   --
   -- AY Select & Panning
   --
   
   process (clock_i)
   begin
      if rising_edge(clock_i) then
         if reset_i = '1' then
         
            ay_select <= "11";
            
            psg0_pan <= "11";
            psg1_pan <= "11";
            psg2_pan <= "11";
         
         elsif turbosound_en_i = '1' and psg_reg_addr_i = '1' and psg_d_i(7) = '1' and psg_d_i(4 downto 2) = "111" then

            case psg_d_i(1 downto 0) is
               when "10"   =>  psg1_pan <= psg_d_i(6 downto 5); ay_select <= "10";
               when "01"   =>  psg2_pan <= psg_d_i(6 downto 5); ay_select <= "01";
               when others =>  psg0_pan <= psg_d_i(6 downto 5); ay_select <= "11";
            end case;
         
         end if;
      end if;
   end process;

   psg_addr <= '1' when psg_reg_addr_i = '1' and psg_d_i(7 downto 5) = "000" else '0';
   
   psg0_addr <= '1' when ay_select = "11" and psg_addr = '1' else '0';
   psg0_we <= '1' when ay_select = "11" and psg_reg_wr_i = '1' else '0';

   psg1_addr <= '1' when ay_select = "10" and psg_addr = '1' else '0';
   psg1_we <= '1' when ay_select = "10" and psg_reg_wr_i = '1' else '0';

   psg2_addr <= '1' when ay_select = "01" and psg_addr = '1' else '0';
   psg2_we <= '1' when ay_select = "01" and psg_reg_wr_i = '1' else '0';
   
   --
   -- AY #0
   --
   
   psg0 : entity work.ym2149
   generic map (
      AY_ID             => "11"
   )
   port map (
      CLK               => clock_i,              -- master clock more than 6MHz
      ENA               => clock_en_i,           -- gated clock signal used by ym2149
      RESET_H           => reset_i,
      I_SEL_L           => '1',                  -- 1 for compatible counting with ay8910
      -- data bus
      I_DA              => psg_d_i,
      O_DA              => psg0_do,              -- read from currently selected register
      I_REG             => psg_d_o_reg_i,
      -- control
      busctrl_addr      => psg0_addr,            -- 1 to change selected register
      busctrl_we        => psg0_we,              -- 1 to write to selected register
      ctrl_aymode       => aymode_i,             -- 0 = YM, 1 = AY
      -- I/O ports
      port_a_i          => (others => '1'),      -- external input to IO Port A (reg 14) AY#0
      port_a_o          => open,                 -- last byte written to reg 14 (not the same as reading from reg 14) AY#0
      port_b_i          => (others => '1'),
      port_b_o          => open,
      -- audio channels out
      O_AUDIO_A         => psg0_A,
      O_AUDIO_B         => psg0_B,
      O_AUDIO_C         => psg0_C
   );
   
   -- stereo / mono mix
   
   psg0_L_mux <= psg0_C when stereo_mode_i = '1' or mono_mode_i(0) = '1' else psg0_B;
   psg0_L_sum <= ('0' & psg0_L_mux) + ('0' & psg0_A);
   
   psg0_R_mux <= psg0_L_sum when mono_mode_i(0) = '1' else ('0' & psg0_C);
   psg0_R_sum <= ('0' & psg0_R_mux) + ("00" & psg0_B);
   
   psg0_L_fin <= psg0_R_sum when mono_mode_i(0) = '1' else ('0' & psg0_L_sum);
   
   process (clock_i)
   begin
      if rising_edge(clock_i) then
         if ay_select = "11" or turbosound_en_i = '1' then
            psg0_L <= psg0_L_fin;
            psg0_R <= psg0_R_sum;
         else
            psg0_L <= (others => '0');
            psg0_R <= (others => '0');
         end if;
      end if;
   end process;
   
   --
   -- AY #1
   --

   psg1 : entity work.ym2149
   generic map (
      AY_ID             => "10"
   )
   port map (
      CLK               => clock_i,
      ENA               => clock_en_i,
      RESET_H           => reset_i,
      I_SEL_L           => '1',
      -- data bus
      I_DA              => psg_d_i,
      O_DA              => psg1_do,
      I_REG             => psg_d_o_reg_i,
      -- control
      busctrl_addr      => psg1_addr,
      busctrl_we        => psg1_we,
      ctrl_aymode       => aymode_i,
      -- I/O ports
      port_a_i          => (others => '1'),
      port_a_o          => open,
      port_b_i          => (others => '1'),
      port_b_o          => open,
      -- audio channels out
      O_AUDIO_A         => psg1_A,
      O_AUDIO_B         => psg1_B,
      O_AUDIO_C         => psg1_C
   );
   
   -- stereo / mono mix

   psg1_L_mux <= psg1_C when stereo_mode_i = '1' or mono_mode_i(1) = '1' else psg1_B;
   psg1_L_sum <= ('0' & psg1_L_mux) + ('0' & psg1_A);
   
   psg1_R_mux <= psg1_L_sum when mono_mode_i(1) = '1' else ('0' & psg1_C);
   psg1_R_sum <= ('0' & psg1_R_mux) + ("00" & psg1_B);
   
   psg1_L_fin <= psg1_R_sum when mono_mode_i(1) = '1' else ('0' & psg1_L_sum);
   
   process (clock_i)
   begin
      if rising_edge(clock_i) then
         if ay_select = "10" or turbosound_en_i = '1' then
            psg1_L <= psg1_L_fin;
            psg1_R <= psg1_R_sum;
         else
            psg1_L <= (others => '0');
            psg1_R <= (others => '0');
         end if;
      end if;
   end process;

   --
   -- AY #2
   --
   
   psg2 : entity work.ym2149
   generic map (
      AY_ID             => "01"
   )
   port map (
      CLK               => clock_i,
      ENA               => clock_en_i,
      RESET_H           => reset_i,
      I_SEL_L           => '1',
      -- data bus
      I_DA              => psg_d_i,
      O_DA              => psg2_do,
      I_REG             => psg_d_o_reg_i,
      -- control
      busctrl_addr      => psg2_addr,
      busctrl_we        => psg2_we,
      ctrl_aymode       => aymode_i,
      -- I/O ports
      port_a_i          => (others => '1'),
      port_a_o          => open,
      port_b_i          => (others => '1'),
      port_b_o          => open,
      -- audio channels out
      O_AUDIO_A         => psg2_A,
      O_AUDIO_B         => psg2_B,
      O_AUDIO_C         => psg2_C
   );
   
   -- stereo / mono mix

   psg2_L_mux <= psg2_C when stereo_mode_i = '1' or mono_mode_i(2) = '1' else psg2_B;
   psg2_L_sum <= ('0' & psg2_L_mux) + ('0' & psg2_A);
   
   psg2_R_mux <= psg2_L_sum when mono_mode_i(2) = '1' else ('0' & psg2_C);
   psg2_R_sum <= ('0' & psg2_R_mux) + ("00" & psg2_B);
   
   psg2_L_fin <= psg2_R_sum when mono_mode_i(2) = '1' else ('0' & psg2_L_sum);
   
   process (clock_i)
   begin
      if rising_edge(clock_i) then
         if ay_select = "01" or turbosound_en_i = '1' then
            psg2_L <= psg2_L_fin;
            psg2_R <= psg2_R_sum;
         else
            psg2_L <= (others => '0');
            psg2_R <= (others => '0');
         end if;
      end if;
   end process;
   
   --
   -- Turbosound Output
   --
   
   psg_d_o <= psg1_do when ay_select = "10" else psg2_do when ay_select = "01" else psg0_do;
   
   psg0_L_pan <= psg0_L when psg0_pan(1) = '1' else (others => '0');
   psg1_L_pan <= psg1_L when psg1_pan(1) = '1' else (others => '0');
   psg2_L_pan <= psg2_L when psg2_pan(1) = '1' else (others => '0');
   
   psg0_R_pan <= psg0_R when psg0_pan(0) = '1' else (others => '0');
   psg1_R_pan <= psg1_R when psg1_pan(0) = '1' else (others => '0');
   psg2_R_pan <= psg2_R when psg2_pan(0) = '1' else (others => '0');
   
   process (clock_i)
   begin
      if rising_edge(clock_i) then
         pcm_ay_L_o <= ("00" & psg0_L_pan) + ("00" & psg1_L_pan) + ("00" & psg2_L_pan);
         pcm_ay_R_o <= ("00" & psg0_R_pan) + ("00" & psg1_R_pan) + ("00" & psg2_R_pan);
      end if;
   end process;
   
end architecture;
