
-- Audio Mixer
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
use ieee.std_logic_unsigned.all;
use ieee.numeric_std.all;

entity audio_mixer is
   port
   (
      clock_i        : in std_logic;
      reset_i        : in std_logic;
      
      -- beeper and tape

      exc_i          : in std_logic;
      ear_i          : in std_logic;
      mic_i          : in std_logic;
      
      -- ay
      
      ay_L_i         : in std_logic_vector(11 downto 0);
      ay_R_i         : in std_logic_vector(11 downto 0);
      
      -- dac
      
      dac_L_i        : in std_logic_vector(8 downto 0);
      dac_R_i        : in std_logic_vector(8 downto 0);
      
      -- pi i2s audio
      
      pi_i2s_L_i     : in std_logic_vector(9 downto 0);
      pi_i2s_R_i     : in std_logic_vector(9 downto 0);
      
      -- mixed pcm audio
      
      pcm_L_o        : out std_logic_vector(12 downto 0);
      pcm_R_o        : out std_logic_vector(12 downto 0)
   );
end entity;

architecture rtl of audio_mixer is

   constant ear_volume     : std_logic_vector(12 downto 0) := "0001000000000";
   constant mic_volume     : std_logic_vector(12 downto 0) := "0000010000000";

   signal ear        : std_logic_vector(12 downto 0);
   signal mic        : std_logic_vector(12 downto 0);
   signal ay_L       : std_logic_vector(12 downto 0);
   signal ay_R       : std_logic_vector(12 downto 0);
   signal dac_L      : std_logic_vector(12 downto 0);
   signal dac_R      : std_logic_vector(12 downto 0);
   signal i2s_L      : std_logic_vector(12 downto 0);
   signal i2s_R      : std_logic_vector(12 downto 0);
   
   signal pcm_L      : std_logic_vector(12 downto 0);   -- 0 - 8191
   signal pcm_R      : std_logic_vector(12 downto 0);   -- 0 - 8191

begin

   ear <= ear_volume when (ear_i = '1' and exc_i = '0') else (others => '0');   -- 0 / 512
   mic <= mic_volume when (mic_i = '1' and exc_i = '0') else (others => '0');   -- 0 / 128
   
   ay_L <= '0' & ay_L_i;   -- 0 - 2295
   ay_R <= '0' & ay_R_i;   -- 0 - 2295
   
   dac_L <= "00" & dac_L_i & "00";   -- 0 - 510 => 0 - 2040
   dac_R <= "00" & dac_R_i & "00";   -- 0 - 510 => 0 - 2040
   
   i2s_L <= "000" & pi_i2s_L_i;   -- 0 - 1023
   i2s_R <= "000" & pi_i2s_R_i;   -- 0 - 1023
   
   process (clock_i)
   begin
      if rising_edge(clock_i) then
         if reset_i = '1' then
            pcm_L <= (others => '0');
            pcm_R <= (others => '0');
         else
            pcm_L <= ear + mic + ay_L + dac_L + i2s_L;   -- 0 - 5998
            pcm_R <= ear + mic + ay_R + dac_R + i2s_R;   -- 0 - 5998
         end if;
      end if;
   end process;
   
   pcm_L_o <= pcm_L;
   pcm_R_o <= pcm_R;

end architecture;
