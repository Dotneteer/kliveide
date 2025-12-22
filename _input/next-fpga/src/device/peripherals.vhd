-- INTERRUPTING PERIPHERALS
-- Copyright 2020 Alvin Albrecht
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

--
-- Instantiate interrupt handling for all peripherals.
--

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity peripherals is
   generic (
      constant NUM_PERIPH  : positive := 14;
      constant VEC_BITS    : positive := 4;
      constant EXCEPTION   : std_logic_vector(16 downto 1) := (others => '0')  -- make at least as big as max NUM_PERIPH
   );
   port (
      i_CLK_28             : in std_logic;
      i_CLK_CPU            : in std_logic;
      i_reset              : in std_logic;
      
      i_m1_n               : in std_logic;
      i_iorq_n             : in std_logic;
      
      i_im2_mode           : in std_logic;
      i_mode_pulse_0_im2_1 : in std_logic;

      i_int_en             : in std_logic_vector(NUM_PERIPH downto 1);
      i_int_req            : in std_logic_vector(NUM_PERIPH downto 1);
      i_int_unq            : in std_logic_vector(NUM_PERIPH downto 1);
      
      o_int_status         : out std_logic_vector(NUM_PERIPH downto 1);
      i_int_status_clear   : in std_logic_vector(NUM_PERIPH downto 1);
      
      i_iei                : in std_logic;
      o_ieo                : out std_logic;
      
      i_reti_decode        : in std_logic;
      i_reti_seen          : in std_logic;
   
      o_int_n              : out std_logic;
      o_vector             : out std_logic_vector(VEC_BITS-1 downto 0);
      
      i_dma_int_en         : in std_logic_vector(NUM_PERIPH downto 1);
      o_dma_int            : out std_logic;
      
      o_pulse_en           : out std_logic
   );
end entity;

architecture rtl of peripherals is

   type vector_t is array (NUM_PERIPH downto 1) of std_logic_vector(VEC_BITS-1 downto 0);
   signal vec              : vector_t;
   
   signal ie               : std_logic_vector(NUM_PERIPH downto 0);
   signal int_n            : std_logic_vector(NUM_PERIPH downto 1);
   signal pulse_en         : std_logic_vector(NUM_PERIPH downto 1);
   signal dma_int          : std_logic_vector(NUM_PERIPH downto 1);

begin

   ie(0) <= i_iei;

   -- instantiate interrupt handler for each device
   
   gen_per:
   for I in 1 to NUM_PERIPH generate
   
      peripheral: entity work.im2_peripheral
      generic map (
         VEC_BITS                => VEC_BITS,
         EXCEPTION               => EXCEPTION(I)
      )
      port map (
         i_CLK_28                => i_CLK_28,
         i_CLK_CPU               => i_CLK_CPU,
         i_reset                 => i_reset,
      
         i_m1_n                  => i_m1_n,
         i_iorq_n                => i_iorq_n,
         
         i_im2_mode              => i_im2_mode,
         i_mode_pulse_0_im2_1    => i_mode_pulse_0_im2_1,
      
         i_iei                   => ie(I-1),
         o_ieo                   => ie(I),
      
         i_reti_decode           => i_reti_decode,
         i_reti_seen             => i_reti_seen,
      
         i_int_en                => i_int_en(I),
         i_int_req               => i_int_req(I),
         i_int_unq               => i_int_unq(I),
   
         i_int_status_clear      => i_int_status_clear(I),
         o_int_status            => o_int_status(I),

         o_int_n                 => int_n(I),
         o_pulse_en              => pulse_en(I),
   
         i_vector                => std_logic_vector(to_unsigned(I-1,VEC_BITS)),
         o_vector                => vec(I),
         
         i_dma_int_en            => i_dma_int_en(I),
         o_dma_int               => dma_int(I)
      );

   end generate;
   
   -- im2 signals
   
   o_ieo <= ie(NUM_PERIPH);
   
   process (vec)
      variable tmp_vec : std_logic_vector(VEC_BITS-1 downto 0);
   begin
      tmp_vec := vec(1);
      
      for I in 2 to NUM_PERIPH loop
         tmp_vec := tmp_vec or vec(I);
      end loop;
      
      o_vector <= tmp_vec;
   end process;
   
   process (int_n)
      variable tmp_int_n : std_logic;
   begin
      tmp_int_n := int_n(1);
      
      for I in 2 to NUM_PERIPH loop
         tmp_int_n := tmp_int_n and int_n(I);
      end loop;
      
      o_int_n <= tmp_int_n;
   end process;

   -- pulse mode
   
   process (pulse_en)
      variable tmp_pulse_en : std_logic;
   begin
      tmp_pulse_en := pulse_en(1);
      
      for I in 2 to NUM_PERIPH loop
         tmp_pulse_en := tmp_pulse_en or pulse_en(I);
      end loop;
   
      o_pulse_en <= tmp_pulse_en;
   end process;

   -- interrupt dma operation
   
   process (dma_int)
      variable tmp_dma_int : std_logic;
   begin
      tmp_dma_int := dma_int(1);
      
      for I in 2 to NUM_PERIPH loop
         tmp_dma_int := tmp_dma_int or dma_int(I);
      end loop;
      
      o_dma_int <= tmp_dma_int;
   end process;

end architecture;
