
-- UART 8/1/N
-- Copyright 2020 Victor Trucco and Alvin Albrecht
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
 
entity uart is
  port 
  (
      uart_prescaler_i     : in std_logic_vector(16 downto 0); 
      clock_i              : in  std_logic;
      reset_i              : in  std_logic;
      TX_start_i           : in  std_logic;
      TX_byte_i            : in  std_logic_vector(7 downto 0);
      TX_active_o          : out std_logic;
      TX_out_o             : out std_logic;
      TX_byte_finished_o   : out std_logic;
      RX_in_i              : in  std_logic;
      RX_byte_finished_o   : out std_logic;
      RX_byte_o            : out std_logic_vector(7 downto 0)
  );
end uart;
 
 
architecture rtl of uart is
 
   type tx_states is (STATE_TX_IDLE, STATE_TX_START, STATE_TX_DATA, STATE_TX_STOP, STATE_TX_FINISH);
   type rx_states is (STATE_RX_IDLE, STATE_RX_START, STATE_RX_DATA, STATE_RX_STOP, STATE_RX_FINISH);
   
   signal rx_current_state_s : rx_states := STATE_RX_IDLE;
   signal tx_current_state_s : tx_states := STATE_TX_IDLE;
   
   signal tx_clock_counter_s  : integer range 0 to 131071; -- range 0 to 3000 := 0;  -- ATTENTION: MAXIMUM OF TICKS TO WAIT!!!! 2916 for 9600 bps at 28mhz change here to slow speeds
   signal tx_bit_index_s      : integer range 0 to 7 := 0;  
   signal tx_data_s           : std_logic_vector(7 downto 0) := (others => '0');
   signal tx_clock_period_expire    : std_logic;
   signal tx_done_s           : std_logic := '0';
  
   signal rx_clock_counter_s  : integer range 0 to 131071; -- range 0 to 3000 := 0;  -- ATTENTION: MAXIMUM OF TICKS TO WAIT!!!! 2916 for 9600 bps at 28mhz change here to slow speeds
   signal rx_bit_index_s      : integer range 0 to 7 := 0;  
   signal rx_byte_s           : std_logic_vector(7 downto 0) := (others => '0');
   signal rx_byte_finished_s  : std_logic := '0';
   signal rx_data_s           : std_logic;
   signal rx_clock_period_expire       : std_logic;
   signal rx_clock_half_period_expire  : std_logic;
   
   signal Rx_in_db            : std_logic;
   
   signal ticks_per_bit_i     : integer range 0 to 131071;
   signal ticks_per_bit_rx    : integer range 0 to 131071;
   signal ticks_per_bit_tx    : integer range 0 to 131071;

begin

   ticks_per_bit_i <= to_integer(unsigned(uart_prescaler_i)) - 1;
 
   -- OUTs
   
   TX_byte_finished_o <= tx_done_s;
   RX_byte_finished_o <= rx_byte_finished_s;
   RX_byte_o <= rx_byte_s;

   -- RX process
   
   db : entity work.debounce
   generic map
   (
      INITIAL_STATE  => '1',
      COUNTER_SIZE   => 2        -- reject noise < 142ns
   )
   port map
   (
      clk_i          => clock_i,
      clk_en_i       => '1',
      button_i       => RX_in_i,
      button_o       => Rx_in_db
   );
   
   rx_data_s <= Rx_in_db;

   rx_clock_period_expire <= '1' when rx_clock_counter_s = ticks_per_bit_rx else '0';
   rx_clock_half_period_expire <= '1' when rx_clock_counter_s = ticks_per_bit_rx / 2 else '0';
   
   process (clock_i)
   begin
       if rising_edge(clock_i) then
         
         if reset_i = '1' then
         
            rx_current_state_s <= STATE_RX_IDLE;
         
         else
         
            case rx_current_state_s is
       
                 when STATE_RX_IDLE =>
                 
                         ticks_per_bit_rx <= ticks_per_bit_i;
                         
                         rx_byte_finished_s <= '0';
                         rx_clock_counter_s <= 0;
                         rx_bit_index_s <= 0;
                
                         if rx_data_s = '0' then  -- Wait for start bit
                              rx_current_state_s <= STATE_RX_START;
                         else
                              rx_current_state_s <= STATE_RX_IDLE;
                         end if;
          
                    
                 when STATE_RX_START =>
                 
                      --wait for the middle of start bit
                      
                      if rx_data_s = '1' then
                      
                        rx_current_state_s <= STATE_RX_IDLE;

                      elsif rx_clock_half_period_expire = '1' then
                      
                        rx_clock_counter_s <= 0;
                        rx_current_state_s <= STATE_RX_DATA;

                      else
                      
                        rx_clock_counter_s <= rx_clock_counter_s + 1;
                        rx_current_state_s <= STATE_RX_START;
                        
                      end if;
          
                    
                 
                 when STATE_RX_DATA =>
                 
                      -- Wait for the correct number of cycles
                      
                      if rx_clock_period_expire = '1' then
                      
                           rx_clock_counter_s <= 0;
                           rx_byte_s(rx_bit_index_s) <= rx_data_s;
                            
                           -- Check if all the byte was sent
                           if rx_bit_index_s = 7 then

                              rx_current_state_s   <= STATE_RX_STOP;
                           
                           else
                           
                              rx_bit_index_s <= rx_bit_index_s + 1;
                              rx_current_state_s <= STATE_RX_DATA;
                           
                           end if;
                      
                      else

                           rx_clock_counter_s <= rx_clock_counter_s + 1;
                           rx_current_state_s   <= STATE_RX_DATA;

                      end if;
          
          
                 -- Stop bit = 1
                 when STATE_RX_STOP =>
                 
                      -- Wait for the correct number of cycles
                      if rx_clock_period_expire = '1' then
                      
                        if rx_data_s = '0' then
                        
                           rx_current_state_s <= STATE_RX_IDLE;
                        
                        else
                        
                           rx_byte_finished_s <= '1';
                           rx_current_state_s <= STATE_RX_FINISH;
                        
                        end if;
                     
                      else
                      
                           rx_clock_counter_s <= rx_clock_counter_s + 1;
                           rx_current_state_s <= STATE_RX_STOP;

                      end if;
          
                            
                 when STATE_RX_FINISH =>
                 
                      rx_current_state_s <= STATE_RX_IDLE;
                      rx_byte_finished_s <= '0';
                    
                 when others =>
                 
                     rx_current_state_s <= STATE_RX_IDLE;
       
            end case;
         end if;
       end if;
   end process;
   
   -- end RX process
   
  -- TX process
  
  tx_clock_period_expire <= '1' when tx_clock_counter_s = ticks_per_bit_tx else '0';
  
  process (clock_i)
  begin
  
    if rising_edge(clock_i) then
     
     if reset_i = '1' then
     
      tx_current_state_s <= STATE_TX_IDLE;
     
     else
     
      case tx_current_state_s is
 
        when STATE_TX_IDLE =>
        
             ticks_per_bit_tx <= ticks_per_bit_i;
             
             TX_active_o <= '0';
             TX_out_o <= '1';  -- Idle
             tx_done_s   <= '0';
             tx_clock_counter_s <= 0;
             tx_bit_index_s <= 0;
    
             if TX_start_i = '1' then
             
               tx_data_s <= TX_byte_i;
               tx_current_state_s <= STATE_TX_START;
               
             else
             
               tx_current_state_s <= STATE_TX_IDLE;
               
             end if;
           
        -- Start bit = 0
        when STATE_TX_START =>
        
             TX_active_o <= '1';
             TX_out_o <= '0';
    
             -- Wait for the correct number of cycles
             
             if tx_clock_period_expire = '1' then
             
               tx_clock_counter_s <= 0;
               tx_current_state_s <= STATE_TX_DATA;
             
             else
             
               tx_clock_counter_s <= tx_clock_counter_s + 1;
               tx_current_state_s <= STATE_TX_START;
             
             end if;

        when STATE_TX_DATA =>
        
             TX_out_o <= tx_data_s(tx_bit_index_s);
             
             -- Wait for the correct number of cycles
             
             if tx_clock_period_expire = '1' then
             
               tx_clock_counter_s <= 0;
                
               -- Send all bit from the byte
               if tx_bit_index_s = 7 then

                 tx_current_state_s <= STATE_TX_STOP;
               
               else
               
                 tx_bit_index_s <= tx_bit_index_s + 1;
                 tx_current_state_s <= STATE_TX_DATA;
               
               end if;
             
             else
             
               tx_clock_counter_s <= tx_clock_counter_s + 1;
               tx_current_state_s <= STATE_TX_DATA;
             
             end if;
 
        -- Stop bit = 1
        when STATE_TX_STOP =>
        
             TX_out_o <= '1';
    
             -- Wait for the correct number of cycles
             
             if tx_clock_period_expire = '1' then

               tx_current_state_s <= STATE_TX_FINISH;

             else
             
               tx_clock_counter_s <= tx_clock_counter_s + 1;
               tx_current_state_s <= STATE_TX_STOP;
             
             end if;
         
        when STATE_TX_FINISH =>
        
             TX_active_o <= '0';
             tx_done_s   <= '1';
             tx_current_state_s <= STATE_TX_IDLE;
               
        when others =>
        
             tx_current_state_s <= STATE_TX_IDLE;
 
      end case;
     end if;
    end if;
    
  end process;
  --end of TX process
 
   
end rtl;
