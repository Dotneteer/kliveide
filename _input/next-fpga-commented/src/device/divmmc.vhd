
-- ZXN Divmmc
-- Copyright 2020 Alvin Albrecht and Fabio Belavenuto
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

entity divmmc is
   port (
      i_CLK                : in std_logic;
      i_reset              : in std_logic;
      
      i_cpu_a_15_13        : in std_logic_vector(2 downto 0);
      i_cpu_mreq_n         : in std_logic;
      i_cpu_m1_n           : in std_logic;
      
      i_en                 : in std_logic;
      i_automap_reset      : in std_logic;
      i_automap_active     : in std_logic;
      i_automap_rom3_active: in std_logic;
      i_retn_seen          : in std_logic;
      
      i_divmmc_button      : in std_logic;
      i_divmmc_reg         : in std_logic_vector(7 downto 0);

      i_automap_instant_on      : in std_logic;
      i_automap_delayed_on      : in std_logic;
      i_automap_delayed_off     : in std_logic;
      i_automap_rom3_instant_on : in std_logic;
      i_automap_rom3_delayed_on : in std_logic;
      i_automap_nmi_instant_on  : in std_logic;
      i_automap_nmi_delayed_on  : in std_logic;
      
      o_divmmc_rom_en      : out std_logic;
      o_divmmc_ram_en      : out std_logic;
      o_divmmc_rdonly      : out std_logic;
      o_divmmc_ram_bank    : out std_logic_vector(3 downto 0);
      
      o_disable_nmi        : out std_logic;
      o_automap_held       : out std_logic
   );
end entity;

architecture rtl of divmmc is

   signal conmem     : std_logic;
   signal mapram     : std_logic;
   signal page0      : std_logic;
   signal page1      : std_logic;
   signal rom_en     : std_logic;
   signal ram_en     : std_logic;
   signal ram_bank   : std_logic_vector(3 downto 0);
   
   signal button_nmi : std_logic;

   signal automap_nmi_instant_on  : std_logic;
   signal automap_nmi_delayed_on  : std_logic;
   
   signal automap_hold  : std_logic;
   signal automap_held  : std_logic;
   signal automap       : std_logic;

begin

   -- DIVMMC Paging
   
   conmem <= i_divmmc_reg(7);
   mapram <= i_divmmc_reg(6);
   
   page0 <= '1' when i_cpu_a_15_13 = "000" else '0';
   page1 <= '1' when i_cpu_a_15_13 = "001" else '0';
   
   -- Issue #7 : Also bring in divmmc bank 3 as rom substitute when conmem is set
   -- This is a departure from the original divmmc hardware
   
   rom_en <= '1' when (page0 = '1' and (conmem = '1' or automap = '1') and mapram = '0') else '0';
   ram_en <= '1' when (page0 = '1' and (conmem = '1' or automap = '1') and mapram = '1') or (page1 = '1' and (conmem = '1' or automap = '1')) else '0';
   ram_bank <= X"3" when page0 = '1' else i_divmmc_reg(3 downto 0);
   
   o_divmmc_rom_en <= rom_en and i_en;
   o_divmmc_ram_en <= ram_en and i_en;
   o_divmmc_rdonly <= '1' when page0 = '1' or (mapram = '1' and ram_bank = X"3") else '0';
   o_divmmc_ram_bank <= ram_bank;

   -- NMI
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or i_automap_reset = '1' or i_retn_seen = '1' then
            button_nmi <= '0';
         elsif i_divmmc_button = '1' then
            button_nmi <= '1';
         elsif automap_held = '1' then
            button_nmi <= '0';
         end if;
      end if;
   end process;

   -- Automap

   automap_nmi_instant_on <= i_automap_nmi_instant_on and button_nmi;
   automap_nmi_delayed_on <= i_automap_nmi_delayed_on and button_nmi;
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or i_automap_reset = '1' or i_retn_seen = '1' then
            automap_hold <= '0';
         elsif i_cpu_mreq_n = '0' and i_cpu_m1_n = '0' then           
            automap_hold <= (i_automap_active and (i_automap_instant_on or i_automap_delayed_on or automap_nmi_instant_on or automap_nmi_delayed_on)) or 
               (i_automap_rom3_active and (i_automap_rom3_instant_on or i_automap_rom3_delayed_on)) or 
               (automap_held and not (i_automap_active and i_automap_delayed_off));
         end if;
      end if;
   end process;

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or i_automap_reset = '1' or i_retn_seen = '1' then
            automap_held <= '0';
         elsif i_cpu_mreq_n = '1' then
            automap_held <= automap_hold;
         end if;
      end if;
   end process;

-- automap <= (not i_automap_reset) and (automap_held or (i_automap_active and (i_automap_instant_on or automap_nmi_instant_on) and not i_cpu_m1_n) or (i_automap_rom3_active and i_automap_rom3_instant_on and not i_cpu_m1_n));
   automap <= (not i_automap_reset) and (automap_held or (i_automap_active and (i_automap_instant_on or automap_nmi_instant_on)) or (i_automap_rom3_active and i_automap_rom3_instant_on));

   o_disable_nmi <= automap or button_nmi;
   o_automap_held <= automap_held;

end architecture;
