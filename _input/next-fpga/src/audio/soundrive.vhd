
-- ZX Spectrum Next 4 x 8-bit DAC
-- Copyright 2020 Victor Trucco
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
use ieee.std_logic_unsigned.all;
use ieee.numeric_std.all;

entity soundrive is
   port
   (
      clock_i        : in std_logic;
      reset_i        : in std_logic;

      cpu_d_i        : in std_logic_vector(7 downto 0);
      
      -- left
      
      chA_wr_i       : in std_logic;
      chB_wr_i       : in std_logic;
      
      -- right
      
      chC_wr_i       : in std_logic;
      chD_wr_i       : in std_logic;
      
      -- nextreg mirrors
      
      nr_mono_we_i   : in std_logic;
      nr_left_we_i   : in std_logic;
      nr_right_we_i  : in std_logic;
      
      nr_audio_dat_i : in std_logic_vector(7 downto 0);
      
      -- pcm audio out
      
      pcm_L_o        : out std_logic_vector(8 downto 0);
      pcm_R_o        : out std_logic_vector(8 downto 0)
   );
end entity;

architecture rtl of soundrive is

   signal chA  : std_logic_vector(7 downto 0);
   signal chB  : std_logic_vector(7 downto 0);
   signal chC  : std_logic_vector(7 downto 0);
   signal chD  : std_logic_vector(7 downto 0);

begin

   process (clock_i)
   begin
      if rising_edge(clock_i) then
         if reset_i = '1' then
         
            chA <= X"80";
            chB <= X"80";
            chC <= X"80";
            chD <= X"80";
            
         else
            
            if chA_wr_i = '1' then
               chA <= cpu_d_i;
            elsif nr_mono_we_i = '1' then
               chA <= nr_audio_dat_i;
            end if;
            
            if chB_wr_i = '1' then
               chB <= cpu_d_i;
            elsif nr_left_we_i = '1' then
               chB <= nr_audio_dat_i;
            end if;
            
            if chC_wr_i = '1' then
               chC <= cpu_d_i;
            elsif nr_right_we_i = '1' then
               chC <= nr_audio_dat_i;
            end if;
            
            if chD_wr_i = '1' then
               chD <= cpu_d_i;
            elsif nr_mono_we_i = '1' then
               chD <= nr_audio_dat_i;
            end if;
         
         end if;
      end if;
   end process;
   
   process (clock_i)
   begin
      if rising_edge(clock_i) then
         pcm_L_o <= ('0' & chA) + ('0' & chB);
         pcm_R_o <= ('0' & chC) + ('0' & chD);
      end if;
   end process;

end architecture;
