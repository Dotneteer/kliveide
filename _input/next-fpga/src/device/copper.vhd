
-- ZX Spectrum Next Copper Coprocessor
-- Copyright 2020 Victor Trucco
-- Theoretical Model - Mike Dailly 
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
use IEEE.std_logic_unsigned.ALL;

entity copper is
   port (
      clock_i           : in  std_logic;
      reset_i           : in  std_logic;
         
      copper_en_i       : in std_logic_vector(1 downto 0);

      hcount_i       : in unsigned(8 downto 0);
      vcount_i       : in unsigned(8 downto 0);
      
      copper_list_addr_o   : out std_logic_vector(9 downto 0);
      copper_list_data_i   : in std_logic_vector(15 downto 0);
      
      copper_dout_o     : out std_logic;
      copper_data_o     : out std_logic_vector(14 downto 0)
   );
end entity;

architecture rtl of copper is

   signal copper_list_addr_s  : std_logic_vector(9 downto 0);
   signal copper_dout_s    : std_logic := '0';
   signal last_state_s     : std_logic_vector(1 downto 0) := "00";
   
begin

   process (clock_i)
      variable line_v : unsigned(8 downto 0);
   begin
   
      if rising_edge(clock_i) then     
         
         if reset_i = '1' then
            
            copper_list_addr_s <= (others => '0');
            
            copper_dout_s <= '0';
            copper_data_o <= (others => '0');
            
         else
         
            -- check if we are entering on "01" or "11" mode and reset the address to 0000
            if last_state_s /= copper_en_i then
            
                  last_state_s <= copper_en_i;
                  
                  if copper_en_i = "01" or copper_en_i = "11" then
                     copper_list_addr_s <= (others=>'0');
                  end if;
                  
                  copper_dout_s <= '0';
               
            elsif copper_en_i = "11" and vcount_i = 0 and hcount_i = 0 then --restart at frame start
            
                  copper_list_addr_s <= (others=>'0');
                  copper_dout_s <= '0';
            
            elsif copper_en_i /= "00" then
                  
                  if copper_dout_s = '1' then --if we are on MOVE, clear the output for the next cycle

                     copper_dout_s <= '0';
                  
                  -- command WAIT
                  elsif copper_list_data_i(15) = '1' then
                        
                     if vcount_i = unsigned(copper_list_data_i(8 downto 0)) and hcount_i >= unsigned(copper_list_data_i(14 downto 9)&"000") + 12 then 
                        copper_list_addr_s <= copper_list_addr_s + 1; -- if it's time, load the next copper command
                     end if;
                        
                     copper_dout_s <= '0';
                           
                  else -- command MOVE
                        
                     copper_data_o <= copper_list_data_i(14 downto 0);
                           
                     if copper_list_data_i(14 downto 8) /= "0000000" then -- dont generate the write pulse if its a NOP (MOVE 0,0)
                        copper_dout_s <= '1';
                     end if;
                           
                     copper_list_addr_s <= copper_list_addr_s + 1;
                        
                  end if;

            else
                  
                  copper_dout_s <= '0';
                     
            end if;
                  
         end if;
      end if;
   end process;
   
   copper_list_addr_o <= copper_list_addr_s;
   copper_dout_o <= copper_dout_s;

end architecture;
