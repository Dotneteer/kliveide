
-- ZXN DMA
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

-- ATTENTION: Loosely based on Zilog Z80C10. There are differences!

library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;
use IEEE.STD_LOGIC_UNSIGNED.all;
 
entity z80dma is
   port 
   ( 
      reset_i        : in std_logic;
      clk_i          : in std_logic;
      turbo_i        : in std_logic_vector(1 downto 0);  -- 00 = 3.5MHz, 01 = 7MHz, 10 = 14MHz, 11 = 28MHz
      dma_mode_i     : in std_logic;  -- 1 = z80 dma compatible
      
      dma_en_wr_s    : in std_logic;
      dma_en_rd_s    : in std_logic;

      cpu_d_i        : in std_logic_vector(7 downto 0);
      wait_n_i       : in std_logic := '1';
      dma_delay_i    : in std_logic;
      
      bus_busreq_n_i : in std_logic;     -- busreq in
      cpu_busreq_n_o : out std_logic;    -- busreq from dma
      
      cpu_bai_n      : in std_logic;     -- busak in daisy chain
      cpu_bao_n      : out std_logic;    -- busak out daisy chain

      dma_a_o        : out std_logic_vector(15 downto 0);
      dma_d_o        : out std_logic_vector(7 downto 0);
      dma_d_i        : in std_logic_vector(7 downto 0);
      dma_rd_n_o     : out std_logic;
      dma_wr_n_o     : out std_logic;
      dma_mreq_n_o   : out std_logic;
      dma_iorq_n_o   : out std_logic;
      
      cpu_d_o        : out std_logic_vector(7 downto 0)
   );
      
end z80dma;
 
architecture z80dma_unit of z80dma is
   
   --type  array_7x8 is array (0 to 6) of std_logic_vector(7 downto 0);
   --signal reg                     : array_7x8;

   signal reg_temp               : std_logic_vector(7 downto 0);
      
   signal R0_dir_AtoB_s          : std_logic;  -- direction - 0 = B -> A   1 = A -> B
   --signal R0_tranfer_s            : std_logic; 
   --signal R0_search_s          : std_logic;  
   signal R0_start_addr_port_A_s    : std_logic_vector (15 downto 0);
   signal R0_block_len_s         : std_logic_vector (15 downto 0);
   
   signal R1_portAisIO_s         : std_logic;  -- 0 = Port A is Memory   1 = Port A is IO
   signal R1_portA_addrMode_s    : std_logic_vector (1 downto 0); -- address mode - 00 = decrements, 01 = increments, 10 or 11 = fixed
   signal R1_portA_timming_byte_s : std_logic_vector (1 downto 0) := "01";
   --signal R1_portA_preescaler_s   : std_logic_vector (7 downto 0);
   
   signal R2_portBisIO_s         : std_logic;  -- 0 = Port B is Memory   1 = Port B is IO
   signal R2_portB_addrMode_s    : std_logic_vector (1 downto 0); -- address mode - 00 = decrements, 01 = increments, 10 or 11 = fixed
   signal R2_portB_timming_byte_s : std_logic_vector (1 downto 0) := "01";
   signal R2_portB_preescaler_s  : std_logic_vector (7 downto 0);

   signal R3_dma_en_s            : std_logic; 
   --signal R3_int_en_s          : std_logic;
   --signal R3_stop_match_s         : std_logic;
   --signal R3_mask_s               : std_logic_vector (7 downto 0);
   --signal R3_match_s           : std_logic_vector (7 downto 0);
   
   signal R4_mode_s           : std_logic_vector (1 downto 0); -- 00 byte, 01 continuos, 10 burst
   signal R4_start_addr_port_B_s : std_logic_vector (15 downto 0);
   --signal R4_interrupt_control_s : std_logic_vector (7 downto 0);
   --signal R4_pulse_control_s      : std_logic_vector (7 downto 0);
   --signal R4_interrupt_vector_s   : std_logic_vector (7 downto 0);
   
   --signal R5_ready_act_hi_s    : std_logic; -- 0 = READY activel low, 1 = READY active high
   signal R5_ce_wait_s           : std_logic;-- 0 = CE only, 1 = CE / WAIT multiplexed
   signal R5_auto_restart_s      : std_logic;-- 0 = stop on end, 1 = auto restart
   
   signal R6_read_mask_s         : std_logic_vector (7 downto 0);
   
   signal status_atleastone      : std_logic;
   signal status_endofblock_n    : std_logic;
   
   type dma_seq_t is ( IDLE, START_DMA, WAITING_ACK, TRANSFERING_READ_1, TRANSFERING_READ_2, TRANSFERING_READ_3, TRANSFERING_READ_4, TRANSFERING_WRITE_1, TRANSFERING_WRITE_2, TRANSFERING_WRITE_3, TRANSFERING_WRITE_4, WAITING_CYCLES, FINISH_DMA );
   signal dma_seq_s        : dma_seq_t;
   
   signal dma_a_s          : std_logic_vector(15 downto 0) := X"FF00"; -- X"00FF" --X"FF00"; -- X"FF00" X"00FF";
   signal dma_d_s          : std_logic_vector(7 downto 0);
   signal dma_d_n_s        : std_logic_vector(7 downto 0);
   signal dma_d_p_s        : std_logic_vector(7 downto 0);
   signal wait_n_s         : std_logic;
   signal dma_read_cycle   : std_logic;
   signal dma_write_cycle  : std_logic;
   signal dma_mreq_cycle   : std_logic;
   signal dma_rw_cancel    : std_logic;
   signal dma_rw_extend    : std_logic;
   signal dma_rd_s         : std_logic;
   signal dma_rd_n_s       : std_logic;
   signal dma_wr_s         : std_logic;
   signal dma_wr_n_s       : std_logic;
   
   signal dma_src_s        : std_logic_vector(15 downto 0);
   signal dma_dest_s       : std_logic_vector(15 downto 0);
   signal dma_counter_s    : std_logic_vector(15 downto 0);
   
   signal DMA_timer_s : std_logic_vector(13 downto 0);
   
   signal read_count_s : std_logic_vector(2 downto 0);
   
   signal cpu_busreq_n_s : std_logic;
   
begin

   -- shape read / write cycles
   -- what is done here to avoid 14MHz wait states is awful but should go away in a rewrite of the dma module
   
   process (clk_i)
   begin
      if falling_edge(clk_i) then
         wait_n_s <= wait_n_i;
      end if;
   end process;

   dma_rw_cancel <= '1' when wait_n_i = '1' and (dma_seq_s = TRANSFERING_READ_4 or dma_seq_s = TRANSFERING_WRITE_4) else '0';
   
   process (clk_i)
   begin
      if falling_edge(clk_i) then
         dma_rd_s <= dma_read_cycle and not dma_rw_cancel;
         dma_wr_s <= dma_write_cycle and not dma_rw_cancel;
      end if;
   end process;
   
   -- Avoid wait state for 14MHz
   dma_rw_extend <= '1' when turbo_i = "10" and (dma_seq_s = TRANSFERING_READ_4 or dma_seq_s = TRANSFERING_WRITE_4) else '0';
   
   dma_rd_n_s <= not (dma_rd_s or (dma_rw_extend and dma_read_cycle));
   dma_wr_n_s <= not (dma_wr_s or (dma_rw_extend and dma_write_cycle));
   
   process (clk_i)
   begin
      if falling_edge(clk_i) then
         if dma_read_cycle = '1' then
            dma_d_n_s <= dma_d_i;
         end if;
      end if;
   end process;

   process (clk_i)
   begin
      if rising_edge(clk_i) then
         if dma_read_cycle = '1' then
            dma_d_p_s <= dma_d_i;
         end if;
      end if;
   end process;

   dma_d_s <= dma_d_n_s when turbo_i /= "10" else dma_d_p_s;
   
   dma_a_o <= dma_a_s;
   dma_d_o <= dma_d_s;
   
   dma_mreq_n_o <= (not dma_mreq_cycle) or (dma_rd_n_s and dma_wr_n_s);
   dma_iorq_n_o <= dma_mreq_cycle or (dma_rd_n_s and dma_wr_n_s) ;

   dma_rd_n_o <= dma_rd_n_s or not dma_read_cycle;
   dma_wr_n_o <= dma_wr_n_s or not dma_write_cycle;

   -- dma state machine
   
   cpu_busreq_n_o <= cpu_busreq_n_s;
   
   process (clk_i)
   
      type reg_wr_seq_t is ( IDLE, R0_BYTE_0, R0_BYTE_1, R0_BYTE_2, R0_BYTE_3, R1_BYTE_0,  R1_BYTE_1, R2_BYTE_0, R2_BYTE_1, R3_BYTE_0, R3_BYTE_1, R4_BYTE_0, R4_BYTE_1, R4_BYTE_2, R4_BYTE_3, R4_BYTE_4, R6_BYTE_0 );
      variable reg_wr_seq_s      : reg_wr_seq_t;
      
      type reg_rd_seq_t is ( RD_STATUS, RD_COUNTER_HI, RD_COUNTER_LO, RD_PORT_A_LO, RD_PORT_A_HI, RD_PORT_B_LO, RD_PORT_B_HI );
      variable reg_rd_seq_s      : reg_rd_seq_t;

      variable cs_wr_v : std_logic_vector(1 downto 0);
      variable cs_rd_v : std_logic_vector(1 downto 0);

      
   begin
      if rising_edge(clk_i) then
      
       if reset_i = '1' then
       
            dma_seq_s <= IDLE;
            
            dma_a_s        <= (others => '0');
            
            dma_read_cycle <= '0';
            dma_write_cycle <= '0';
            dma_mreq_cycle <= '0';

            dma_counter_s  <= (others=>'0');
            
            cpu_d_o        <= (others=>'0');

            cpu_busreq_n_s <= '1';
            cpu_bao_n <= cpu_bai_n;
            --cpu_bao_n <= '1';
            
            reg_wr_seq_s := IDLE;
            
            DMA_timer_s <= (others => '0');
            
            R1_portA_timming_byte_s <= "01";
            R2_portB_timming_byte_s <= "01";
            R2_portB_preescaler_s <= X"00";
            R4_mode_s <= "01";
            R5_ce_wait_s <= '0';
            R5_auto_restart_s <= '0';
            R6_read_mask_s <= "01111111";
            
            status_atleastone <= '0';
            status_endofblock_n <= '1';
            
            read_count_s <= "000";
            reg_rd_seq_s := RD_STATUS;

       else
      
         --DMA prescalar counter
         case turbo_i is
            when "00"   => DMA_timer_s <= DMA_timer_s + "00000000001000";
            when "01"   => DMA_timer_s <= DMA_timer_s + "00000000000100";
            when "10"   => DMA_timer_s <= DMA_timer_s + "00000000000010";
            when others => DMA_timer_s <= DMA_timer_s + "00000000000001";
         end case;
      
         --DMA transfer process
         case dma_seq_s is
                  
               when IDLE => 
               
                  cpu_busreq_n_s <= '1';
                  cpu_bao_n <= cpu_bai_n;
                  
                  status_atleastone <= '0';
                  
               when START_DMA => 
               
                  if bus_busreq_n_i = '0' or cpu_bai_n = '0' or dma_delay_i = '1' then
                  
                     -- wait for other dma to finish
                     cpu_busreq_n_s <= '1';
                     cpu_bao_n <= cpu_bai_n;
                  
                  else
                  
                     -- request the bus
                     cpu_busreq_n_s <= '0';
                     cpu_bao_n <= '1';
                     
                     dma_seq_s <= WAITING_ACK;
                  
                  end if;

               when WAITING_ACK => 
               
                  dma_a_s <= dma_src_s;
                  dma_write_cycle <= '0';

                  if (R0_dir_AtoB_s = '1' and R1_portAisIO_s = '0') or (R0_dir_AtoB_s = '0' and R2_portBisIO_s = '0') then
                     dma_mreq_cycle <= '1';     
                  else
                     dma_mreq_cycle <= '0';
                  end if;

                  if cpu_bai_n = '0' then
                  
                     dma_seq_s <= TRANSFERING_READ_1;                   
                     dma_read_cycle <= '1';

                  else
                  
                     dma_read_cycle <= '0';
                  
                  end if;
                  
               when TRANSFERING_READ_1 => 
                        
                        DMA_timer_s <= (others => '0');
                        
                        if R0_dir_AtoB_s = '1' then -- A -> B
                           case R1_portA_timming_byte_s(1 downto 0) is
                              when "00" =>   dma_seq_s   <= TRANSFERING_READ_2; -- 4 cycles
                              when "01" =>   dma_seq_s   <= TRANSFERING_READ_3; -- 3 cycles
                              when "10" =>   dma_seq_s   <= TRANSFERING_READ_4; -- 2 cycles                          
                              when others => dma_seq_s   <= TRANSFERING_READ_2; -- 4 cycles     
                           end case;
                        else -- B -> A
                           case R2_portB_timming_byte_s(1 downto 0) is
                              when "00" =>   dma_seq_s   <= TRANSFERING_READ_2; -- 4 cycles
                              when "01" =>   dma_seq_s   <= TRANSFERING_READ_3; -- 3 cycles
                              when "10" =>   dma_seq_s   <= TRANSFERING_READ_4; -- 2 cycles                          
                              when others => dma_seq_s   <= TRANSFERING_READ_2; -- 4 cycles     
                           end case;
                        end if;
                  
                  -- end if;
                  
               when TRANSFERING_READ_2 => 
                  -- dma_d_s        <= dma_d_i;
                  dma_seq_s   <= TRANSFERING_READ_3;
                  
               when TRANSFERING_READ_3 => 
                  -- dma_d_s        <= dma_d_i; 
                  dma_seq_s   <= TRANSFERING_READ_4;
                        
               when TRANSFERING_READ_4 =>
               
                  -- dma_d_s        <= dma_d_i; 
               
                  -- if R5_ce_wait_s = '1' and wait_n_s = '0' then
                  if wait_n_s = '1' then

                     dma_seq_s <= TRANSFERING_WRITE_1;

                     dma_a_s <= dma_dest_s;
                     
                     dma_read_cycle <= '0';
                     dma_write_cycle <= '1';
                     
                     if (R0_dir_AtoB_s = '1' and R2_portBisIO_s = '0') or (R0_dir_AtoB_s = '0' and R1_portAisIO_s = '0') then
                        dma_mreq_cycle <= '1';
                     else
                        dma_mreq_cycle <= '0';
                     end if;

                  end if;

               when TRANSFERING_WRITE_1 => 
               
                        dma_counter_s  <= dma_counter_s + 1;

                        if R0_dir_AtoB_s = '0' then -- B -> A
                           case R1_portA_timming_byte_s(1 downto 0) is
                              when "00" =>   dma_seq_s   <= TRANSFERING_WRITE_2; -- 4 cycles
                              when "01" =>   dma_seq_s   <= TRANSFERING_WRITE_3; -- 3 cycles
                              when "10" =>   dma_seq_s   <= TRANSFERING_WRITE_4; -- 2 cycles                         
                              when others => dma_seq_s   <= TRANSFERING_WRITE_2; -- 4 cycles    
                           end case;
                        else -- A -> B
                           case R2_portB_timming_byte_s(1 downto 0) is
                              when "00" =>   dma_seq_s   <= TRANSFERING_WRITE_2; -- 4 cycles
                              when "01" =>   dma_seq_s   <= TRANSFERING_WRITE_3; -- 3 cycles
                              when "10" =>   dma_seq_s   <= TRANSFERING_WRITE_4; -- 2 cycles                         
                              when others => dma_seq_s   <= TRANSFERING_WRITE_2; -- 4 cycles    
                           end case;
                        end if;

                        if (R0_dir_AtoB_s = '1' and R1_portA_addrMode_s = "01") or
                           (R0_dir_AtoB_s = '0' and R2_portB_addrMode_s = "01") then
                           dma_src_s      <= dma_src_s + 1;
                        end if;
                        
                        if (R0_dir_AtoB_s = '1' and R1_portA_addrMode_s = "00") or
                           (R0_dir_AtoB_s = '0' and R2_portB_addrMode_s = "00") then
                           dma_src_s      <= dma_src_s - 1;
                        end if;
                           
                        if (R0_dir_AtoB_s = '1' and R2_portB_addrMode_s = "01") or
                           (R0_dir_AtoB_s = '0' and R1_portA_addrMode_s = "01") then
                           dma_dest_s     <= dma_dest_s + 1;
                        end if;
                        
                        if (R0_dir_AtoB_s = '1' and R2_portB_addrMode_s = "00") or
                           (R0_dir_AtoB_s = '0' and R1_portA_addrMode_s = "00") then
                           dma_dest_s     <= dma_dest_s - 1;
                        end if;

               when TRANSFERING_WRITE_2 => 
               
                  dma_seq_s      <= TRANSFERING_WRITE_3;

               when TRANSFERING_WRITE_3 => 
               
                  dma_seq_s      <= TRANSFERING_WRITE_4;
                  
               when TRANSFERING_WRITE_4 =>

                  -- if R5_ce_wait_s = '1' and wait_n_s = '0' then
                  if wait_n_s = '1' then
                  
                     status_atleastone <= '1';
                     
                     dma_a_s <= dma_src_s;
                     dma_write_cycle <= '0';

                     if (R0_dir_AtoB_s = '1' and R1_portAisIO_s = '0') or (R0_dir_AtoB_s = '0' and R2_portBisIO_s = '0') then
                        dma_mreq_cycle <= '1';     
                     else
                        dma_mreq_cycle <= '0';
                     end if;
                  
                     -- check if we need to wait cycles before the next cycle
                     if (R2_portB_preescaler_s > 0) and (('0' & R2_portB_preescaler_s) > DMA_timer_s(13 downto 5)) then
                        dma_seq_s <= WAITING_CYCLES;
                     elsif dma_counter_s < R0_block_len_s then --TO DO: test for block len = 0 - check the datasheet!
                        if dma_delay_i = '1' then
                           dma_seq_s <= START_DMA;
                        else
                           dma_seq_s <= TRANSFERING_READ_1;
                           dma_read_cycle <= '1';
                        end if;
                     else  
                        dma_seq_s <= FINISH_DMA;
                     end if;
                  
                  end if;

               when WAITING_CYCLES => 
               
                  if R4_mode_s = "10" then -- burst mode

                        --give time to CPU in burst mode
                        if ('0' & R2_portB_preescaler_s(7 downto 0)) > DMA_timer_s(13 downto 5) then
                           cpu_busreq_n_s <= '1';   --release bus
                           cpu_bao_n <= cpu_bai_n;  --forward busak to other dma devices
                        end if;
                        
                  end if;
                           
                  if ('0' & R2_portB_preescaler_s) > DMA_timer_s(13 downto 5) then
                           dma_seq_s   <= WAITING_CYCLES;
                           
                  elsif dma_counter_s < R0_block_len_s then --TO DO: test for block len = 0 - check the datasheet!
                           
                           if cpu_busreq_n_s = '1' then
                              -- bus was given up
                              dma_seq_s <= START_DMA;
                           else
                              dma_seq_s <= WAITING_ACK;
                           end if;

                  else  
                           dma_seq_s   <= FINISH_DMA;
                  end if;
                  
                  
                  
               when FINISH_DMA =>
               
                  status_endofblock_n <= '0';
                  
                  if R5_auto_restart_s = '1' then --reload the values
                        if R0_dir_AtoB_s = '1' then  -- direction - 0 = B -> A   1 = A -> B
                           dma_src_s      <= R0_start_addr_port_A_s;
                           dma_dest_s     <= R4_start_addr_port_B_s;
                        else
                           dma_src_s      <= R4_start_addr_port_B_s;
                           dma_dest_s     <= R0_start_addr_port_A_s;
                        end if;
                        
                        if dma_mode_i = '0' then
                           dma_counter_s     <= (others=>'0');
                        else
                           dma_counter_s     <= (others=>'1');  -- z80 dma loads -1
                        end if;
                        
                        if cpu_busreq_n_s = '1' then
                           dma_seq_s <= START_DMA;
                        else
                           dma_seq_s <= WAITING_ACK;
                        end if;
                  else
                        dma_seq_s <= IDLE;
                  end if;
      
         end case;
            
            --detect WR falling edge 
            cs_wr_v := cs_wr_v(0) & (not dma_en_wr_s);
                
            --detect RD falling edge 
            cs_rd_v := cs_rd_v(0) & (not dma_en_rd_s);
            
            if cs_wr_v = "10" then
            --write in registers (only on falling edge of DMA CS and write)
            
            
                  case reg_wr_seq_s is
                  
                  when IDLE =>
                           
                           -- Register 0
                           if cpu_d_i(7) = '0' and (cpu_d_i(1) = '1' or cpu_d_i(0) = '1') then 
                                 
                                 reg_temp <= cpu_d_i;

                                 R0_dir_AtoB_s  <= cpu_d_i(2);
                                 --R0_search_s  <= cpu_d_i(1);
                                 --R0_tranfer_s    <= cpu_d_i(0);
                                 
                                 if cpu_d_i(3) = '1' then
                                    reg_wr_seq_s := R0_BYTE_0;
                                 elsif cpu_d_i(4) = '1' then
                                    reg_wr_seq_s := R0_BYTE_1;
                                 elsif cpu_d_i(5) = '1' then
                                    reg_wr_seq_s := R0_BYTE_2;
                                 elsif cpu_d_i(6) = '1' then
                                    reg_wr_seq_s := R0_BYTE_3;
                                 else
                                    reg_wr_seq_s := IDLE;
                                 end if;

                           end if;
                           -- end of Register 0
                           
                           -- Register 1
                           if cpu_d_i(7) = '0' and cpu_d_i(2 downto 0) = "100" then 
                                 
                                 reg_temp <= cpu_d_i;
                                 
                                 R1_portAisIO_s <= cpu_d_i(3);
                                 R1_portA_addrMode_s <= cpu_d_i(5 downto 4);
                                 
                                 if cpu_d_i(6) = '0' then 
                                    reg_wr_seq_s := IDLE;
                                 else
                                    reg_wr_seq_s := R1_BYTE_0;
                                 end if;

                           end if;
                           -- end of Register 1
                           
                           -- Register 2
                           if cpu_d_i(7) = '0' and cpu_d_i(2 downto 0) = "000" then 
                                 
                                 reg_temp <= cpu_d_i;
                                 
                                 R2_portBisIO_s <= cpu_d_i(3);
                                 R2_portB_addrMode_s <= cpu_d_i(5 downto 4);
                                 
                                 if cpu_d_i(6) = '0' then 
                                    reg_wr_seq_s := IDLE;
                                 else
                                    reg_wr_seq_s := R2_BYTE_0;
                                 end if;

                           end if;
                           -- end of Register 2
                           
                           -- Register 3
                           if cpu_d_i(7) = '1' and cpu_d_i(1 downto 0) = "00" then 
                                 
                                 reg_temp <= cpu_d_i;
                                 
                                 R3_dma_en_s <= cpu_d_i(6);
                                 
                                 if cpu_d_i(6) = '1' then
                                    dma_seq_s <= START_DMA;
                                 end if;
                                 
                                 --R3_int_en_s  <= cpu_d_i(5);
                                 --R3_stop_match_s <= cpu_d_i(2);
                                 
                                 if cpu_d_i(3) = '1' then
                                    reg_wr_seq_s := R3_BYTE_0;
                                 elsif cpu_d_i(4) = '1' then
                                    reg_wr_seq_s := R3_BYTE_1;
                                 else
                                    reg_wr_seq_s := IDLE;
                                 end if;

                           end if;
                           -- end of Register 3
                           
                           -- Register 4
                           if cpu_d_i(7) = '1' and cpu_d_i(1 downto 0) = "01" then 
                           
                                 reg_temp <= cpu_d_i;
                                 
                                 R4_mode_s <= cpu_d_i(6 downto 5);
                                 
                                 if cpu_d_i(2) = '1' then
                                    reg_wr_seq_s := R4_BYTE_0;
                                 elsif cpu_d_i(3) = '1' then
                                    reg_wr_seq_s := R4_BYTE_1;
                                 elsif cpu_d_i(4) = '1' then
                                    reg_wr_seq_s := R4_BYTE_2;
                                 else
                                    reg_wr_seq_s := IDLE;
                                 end if;
                              
                           end if;
                           -- end of Register 4
                     
                           -- Register 5
                           if cpu_d_i(7 downto 6) = "10" and cpu_d_i(2 downto 0) = "010" then 
                                 
                                 reg_temp <= cpu_d_i;

                              -- R5_ready_act_hi_s <= cpu_d_i(3);
                                 R5_ce_wait_s <= cpu_d_i(4);
                                 R5_auto_restart_s <= cpu_d_i(5);

                                 reg_wr_seq_s := IDLE;

                           end if;
                           -- end of Register 5
                     
                     
                           -- Register 6
                           if cpu_d_i(7) = '1' and cpu_d_i(1 downto 0) = "11" then 
                              
                              reg_temp <= cpu_d_i;
                              reg_wr_seq_s := IDLE;
                              
                              if cpu_d_i(7 downto 0) = X"C3" then -- reset
                                 dma_seq_s <= IDLE;
                                 status_endofblock_n <= '1';
                                 status_atleastone <= '0';
                                 R1_portA_timming_byte_s <= "01";
                                 R2_portB_timming_byte_s <= "01";
                                 R2_portB_preescaler_s <= x"00";
                                 R5_ce_wait_s <= '0';
                                 R5_auto_restart_s <= '0';
                              
                              elsif cpu_d_i(7 downto 0) = X"C7" then -- reset port A timming
                                 R1_portA_timming_byte_s <= "01";
                              
                              elsif cpu_d_i(7 downto 0) = X"CB" then -- reset port B timming
                                 R2_portB_timming_byte_s <= "01";

                              elsif cpu_d_i(7 downto 0) = X"CF" then -- Load
                                 status_endofblock_n <= '1';
                                 
                                 if R0_dir_AtoB_s = '1' then  -- direction - 0 = B -> A   1 = A -> B
                                    dma_src_s      <= R0_start_addr_port_A_s;
                                    dma_dest_s     <= R4_start_addr_port_B_s;
                                 else
                                    dma_src_s      <= R4_start_addr_port_B_s;
                                    dma_dest_s     <= R0_start_addr_port_A_s;
                                 end if;
                                 
                                 if dma_mode_i = '0' then
                                    dma_counter_s     <= (others=>'0');
                                 else
                                    dma_counter_s     <= (others=>'1');  -- z80 dma loads -1
                                 end if;

                              elsif cpu_d_i(7 downto 0) = X"D3" then -- Continue
                                 status_endofblock_n <= '1';
                                 
                                 if dma_mode_i = '0' then
                                    dma_counter_s     <= (others=>'0');
                                 else
                                    dma_counter_s     <= (others=>'1');  -- z80 dma loads -1
                                 end if;
                              
                              elsif cpu_d_i(7 downto 0) = X"AF" then -- Disable Interrupts
                              
                              elsif cpu_d_i(7 downto 0) = X"AB" then -- Enable Interrupts
                              
                              elsif cpu_d_i(7 downto 0) = X"A3" then -- Reset and Disable Interrupts
                              
                              elsif cpu_d_i(7 downto 0) = X"B7" then -- Enable after RETI
                              
                              elsif cpu_d_i(7 downto 0) = X"BF" then -- Read Status byte
                                 reg_rd_seq_s := RD_STATUS;
                              
                              elsif cpu_d_i(7 downto 0) = X"8B" then -- Reinitialize Status Byte
                                 status_endofblock_n <= '1';
                                 status_atleastone <= '0';
                              
                              elsif cpu_d_i(7 downto 0) = X"A7" then -- Initialize Read Sequence
                              
                                 if R6_read_mask_s(0) = '1' then    -- status byte
                                    reg_rd_seq_s := RD_STATUS;
                                    
                                 elsif R6_read_mask_s(1) = '1' then -- byte counter LO
                                    reg_rd_seq_s := RD_COUNTER_LO;
                           
                                 elsif R6_read_mask_s(2) = '1' then -- byte counter HI
                                    reg_rd_seq_s := RD_COUNTER_HI;
                           
                                 elsif R6_read_mask_s(3) = '1' then -- port A address counter LO
                                    reg_rd_seq_s := RD_PORT_A_LO;
                           
                                 elsif R6_read_mask_s(4) = '1' then -- port A address counter HI
                                    reg_rd_seq_s := RD_PORT_A_HI;
                           
                                 elsif R6_read_mask_s(5) = '1' then -- port B address counter LO
                                    reg_rd_seq_s := RD_PORT_B_LO;
                           
                                 elsif R6_read_mask_s(6) = '1' then -- port B address counter HI
                                    reg_rd_seq_s := RD_PORT_B_HI;
                                    
                                 else
                                    reg_rd_seq_s := RD_STATUS;
                                    
                                 end if;
                        
                              elsif cpu_d_i(7 downto 0) = X"B3" then -- Force Ready
                              
                              elsif cpu_d_i(7 downto 0) = X"87" then -- Enable DMA
                                 dma_seq_s <= START_DMA;
                                 
                              elsif cpu_d_i(7 downto 0) = X"83" then -- Disable DMA
                                 dma_seq_s <= IDLE;

                              elsif cpu_d_i(7 downto 0) = X"BB" then -- Read mask follows
                                 reg_wr_seq_s := R6_BYTE_0;
                              end if;
                              
                           end if;
                           -- end of Register 6
   
                  
                  when R0_BYTE_0 =>
                        R0_start_addr_port_A_s(7 downto 0) <= cpu_d_i;
                        
                        if reg_temp(4) = '1' then
                           reg_wr_seq_s := R0_BYTE_1;
                        elsif reg_temp(5) = '1' then
                           reg_wr_seq_s := R0_BYTE_2;
                        elsif reg_temp(6) = '1' then
                           reg_wr_seq_s := R0_BYTE_3;
                        else
                           reg_wr_seq_s := IDLE;
                        end if;

                  when R0_BYTE_1 =>
                        R0_start_addr_port_A_s(15 downto 8) <= cpu_d_i;
                        
                        if reg_temp(5) = '1' then
                           reg_wr_seq_s := R0_BYTE_2;
                        elsif reg_temp(6) = '1' then
                           reg_wr_seq_s := R0_BYTE_3;
                        else
                           reg_wr_seq_s := IDLE;
                        end if;
                                 
                  when R0_BYTE_2 =>
                        R0_block_len_s(7 downto 0) <= cpu_d_i;
                        
                        if reg_temp(6) = '1' then
                           reg_wr_seq_s := R0_BYTE_3;
                        else
                           reg_wr_seq_s := IDLE;
                        end if;

                  when R0_BYTE_3 =>
                        R0_block_len_s(15 downto 8) <= cpu_d_i;
                        reg_wr_seq_s := IDLE;
                           
                  when R1_BYTE_0 =>
                        R1_portA_timming_byte_s <= cpu_d_i(1 downto 0);
                        
                        if cpu_d_i(5) = '1' then
                              reg_wr_seq_s := R1_BYTE_1;
                        else
                              reg_wr_seq_s := IDLE;
                        end if;
                                 
                        
                  when R1_BYTE_1 =>
                        --R1_portA_preescaler_s <= cpu_d_i;
                        reg_wr_seq_s := IDLE;

                  when R2_BYTE_0 =>
                        R2_portB_timming_byte_s <= cpu_d_i(1 downto 0);
                        
                        if cpu_d_i(5) = '1' then
                              reg_wr_seq_s := R2_BYTE_1;
                        else
                              reg_wr_seq_s := IDLE;
                        end if;
                        
                  when R2_BYTE_1 =>
                        R2_portB_preescaler_s <= cpu_d_i;
                        reg_wr_seq_s := IDLE;
                        
                  when R3_BYTE_0 =>
                        --R3_mask_s <= cpu_d_i;
                        
                        if reg_temp(4) = '1' then
                           reg_wr_seq_s := R3_BYTE_1;
                        else
                           reg_wr_seq_s := IDLE;
                        end if;

                  when R3_BYTE_1 =>
                        --R3_match_s <= cpu_d_i;
                        reg_wr_seq_s := IDLE;

                  when R4_BYTE_0 =>
                        R4_start_addr_port_B_s(7 downto 0) <= cpu_d_i;
                        
                        if reg_temp(3) = '1' then
                           reg_wr_seq_s := R4_BYTE_1;
                        elsif reg_temp(4) = '1' then
                           reg_wr_seq_s := IDLE; --R4_BYTE_2;
                        else
                           reg_wr_seq_s := IDLE;
                        end if;

                  when R4_BYTE_1 =>
                        R4_start_addr_port_B_s(15 downto 8) <= cpu_d_i;
                        
                  --    if reg_temp(4) = '1' then
                  --       reg_wr_seq_s := R4_BYTE_2;
                  --    else
                           reg_wr_seq_s := IDLE;
                  --    end if;
                           
               -- when R4_BYTE_2 =>
               --       R4_interrupt_control_s <= cpu_d_i;
               --       
               --       if cpu_d_i(3) = '1' then
               --          reg_wr_seq_s := R4_BYTE_3;
               --       elsif cpu_d_i(4) = '1' then
               --          reg_wr_seq_s := R4_BYTE_4;
               --       else
               --          reg_wr_seq_s := IDLE;
               --       end if;
               --          
               -- when R4_BYTE_3 =>
               --       R4_pulse_control_s <= cpu_d_i;
               --       
               --       if R4_interrupt_control_s(4) = '1' then
               --          reg_wr_seq_s := R4_BYTE_4;
               --       else
               --          reg_wr_seq_s := IDLE;
               --       end if;
   --
               -- when R4_BYTE_4 =>
               --       R4_interrupt_vector_s <= cpu_d_i;
               --       reg_wr_seq_s := IDLE;
                     
                  when R6_BYTE_0 =>
                        R6_read_mask_s <= cpu_d_i;
                        
                        if cpu_d_i(0) = '1' then -- status byte
                           reg_rd_seq_s := RD_STATUS;
                           
                        elsif cpu_d_i(1) = '1' then -- byte counter LO
                           reg_rd_seq_s := RD_COUNTER_LO;
                        
                        elsif cpu_d_i(2) = '1' then -- byte counter HI
                           reg_rd_seq_s := RD_COUNTER_HI;   
                           
                        elsif cpu_d_i(3) = '1' then -- port A address counter LO
                           reg_rd_seq_s := RD_PORT_A_LO;
                           
                        elsif cpu_d_i(4) = '1' then -- port A address counter HI
                           reg_rd_seq_s := RD_PORT_A_HI;

                        elsif cpu_d_i(5) = '1' then -- port B address counter LO
                           reg_rd_seq_s := RD_PORT_B_LO;
                           
                        elsif cpu_d_i(6) = '1' then -- port B address counter HI
                           reg_rd_seq_s := RD_PORT_B_HI;
                        
                        else
                           reg_rd_seq_s := RD_STATUS;
                           
                        end if;
                        
                        reg_wr_seq_s := IDLE;   
                        
                        
                  when others => null;
                  end case;   

   
            elsif cs_rd_v = "10" then
            --read from registers (only on falling edge of DMA CS and RD)

                     case reg_rd_seq_s is
                        
                     when RD_STATUS => 
                     
                        cpu_d_o <= "00" & status_endofblock_n & "1101" & status_atleastone;
                     
                        if R6_read_mask_s(1) = '1' then -- byte counter LO
                           reg_rd_seq_s := RD_COUNTER_LO;
                           
                        elsif R6_read_mask_s(2) = '1' then -- byte counter HI
                           reg_rd_seq_s := RD_COUNTER_HI;
                           
                        elsif R6_read_mask_s(3) = '1' then -- port A address counter LO
                           reg_rd_seq_s := RD_PORT_A_LO;
                           
                        elsif R6_read_mask_s(4) = '1' then -- port A address counter HI
                           reg_rd_seq_s := RD_PORT_A_HI;
                           
                        elsif R6_read_mask_s(5) = '1' then -- port B address counter LO
                           reg_rd_seq_s := RD_PORT_B_LO;
                           
                        elsif R6_read_mask_s(6) = '1' then -- port B address counter HI
                           reg_rd_seq_s := RD_PORT_B_HI;
                           
                        --elsif R6_read_mask_s(0) = '1' then -- status byte
                        -- reg_rd_seq_s := RD_STATUS;
                           
                        else
                           reg_rd_seq_s := RD_STATUS;
                           
                        end if;
                     
                     
                  when RD_COUNTER_LO => 
                     
                        cpu_d_o <= dma_counter_s(7 downto 0);
                     
                        if R6_read_mask_s(2) = '1' then -- byte counter HI
                           reg_rd_seq_s := RD_COUNTER_HI;
                           
                        elsif R6_read_mask_s(3) = '1' then -- port A address counter LO
                           reg_rd_seq_s := RD_PORT_A_LO;
                           
                        elsif R6_read_mask_s(4) = '1' then -- port A address counter HI
                           reg_rd_seq_s := RD_PORT_A_HI;
                           
                        elsif R6_read_mask_s(5) = '1' then -- port B address counter LO
                           reg_rd_seq_s := RD_PORT_B_LO;
                           
                        elsif R6_read_mask_s(6) = '1' then -- port B address counter HI
                           reg_rd_seq_s := RD_PORT_B_HI;
                           
                        elsif R6_read_mask_s(0) = '1' then -- status byte
                           reg_rd_seq_s := RD_STATUS;
                           
                        elsif R6_read_mask_s(1) = '1' then -- byte counter LO
                           reg_rd_seq_s := RD_COUNTER_LO;   
                           
                        else
                           reg_rd_seq_s := RD_STATUS;
                           
                        end if;
                     
                     
                     when RD_COUNTER_HI => 
                     
                        cpu_d_o <= dma_counter_s(15 downto 8);
                        
                        if R6_read_mask_s(3) = '1' then -- port A address counter LO
                           reg_rd_seq_s := RD_PORT_A_LO;
                           
                        elsif R6_read_mask_s(4) = '1' then -- port A address counter HI
                           reg_rd_seq_s := RD_PORT_A_HI;
                           
                        elsif R6_read_mask_s(5) = '1' then -- port B address counter LO
                           reg_rd_seq_s := RD_PORT_B_LO;
                           
                        elsif R6_read_mask_s(6) = '1' then -- port B address counter HI
                           reg_rd_seq_s := RD_PORT_B_HI;
                           
                        elsif R6_read_mask_s(0) = '1' then -- status byte
                           reg_rd_seq_s := RD_STATUS;
                           
                        elsif R6_read_mask_s(1) = '1' then -- byte counter LO
                           reg_rd_seq_s := RD_COUNTER_LO;
                        
                        elsif R6_read_mask_s(2) = '1' then -- byte counter HI
                           reg_rd_seq_s := RD_COUNTER_HI;
                        
                        else
                           reg_rd_seq_s := RD_STATUS;
                           
                        end if;
                  
                     
                     when RD_PORT_A_LO => 
                     
                     
                        if R0_dir_AtoB_s = '1' then  -- direction - 0 = B -> A   1 = A -> B
                              cpu_d_o <=  dma_src_s(7 downto 0);
                        else
                              cpu_d_o <=  dma_dest_s(7 downto 0);
                        end if;
                           
                        if R6_read_mask_s(4) = '1' then -- port A address counter HI
                           reg_rd_seq_s := RD_PORT_A_HI;
                           
                        elsif R6_read_mask_s(5) = '1' then -- port B address counter LO
                           reg_rd_seq_s := RD_PORT_B_LO;
                           
                        elsif R6_read_mask_s(6) = '1' then -- port B address counter HI
                           reg_rd_seq_s := RD_PORT_B_HI;
                           
                        elsif R6_read_mask_s(0) = '1' then -- status byte
                           reg_rd_seq_s := RD_STATUS;
                           
                        elsif R6_read_mask_s(1) = '1' then -- byte counter LO
                           reg_rd_seq_s := RD_COUNTER_LO;
                        
                        elsif R6_read_mask_s(2) = '1' then -- byte counter HI
                           reg_rd_seq_s := RD_COUNTER_HI;   
                           
                        elsif R6_read_mask_s(3) = '1' then -- port A address counter LO
                           reg_rd_seq_s := RD_PORT_A_LO;
                           
                        else
                           reg_rd_seq_s := RD_STATUS;
                           
                        end if;
                        
                        
                  
                     when RD_PORT_A_HI => 
                     
                        if R0_dir_AtoB_s = '1' then  -- direction - 0 = B -> A   1 = A -> B
                              cpu_d_o <=  dma_src_s(15 downto 8);
                        else
                              cpu_d_o <=  dma_dest_s(15 downto 8);
                        end if;
                           
                        if R6_read_mask_s(5) = '1' then -- port B address counter LO
                           reg_rd_seq_s := RD_PORT_B_LO;
                           
                        elsif R6_read_mask_s(6) = '1' then -- port B address counter HI
                           reg_rd_seq_s := RD_PORT_B_HI;
                           
                        elsif R6_read_mask_s(0) = '1' then -- status byte
                           reg_rd_seq_s := RD_STATUS;
                           
                        elsif R6_read_mask_s(1) = '1' then -- byte counter LO
                           reg_rd_seq_s := RD_COUNTER_LO;
                        
                        elsif R6_read_mask_s(2) = '1' then -- byte counter HI
                           reg_rd_seq_s := RD_COUNTER_HI;   
                           
                        elsif R6_read_mask_s(3) = '1' then -- port A address counter LO
                           reg_rd_seq_s := RD_PORT_A_LO;
                           
                        elsif R6_read_mask_s(4) = '1' then -- port A address counter HI
                           reg_rd_seq_s := RD_PORT_A_HI;
                           
                        else
                           reg_rd_seq_s := RD_STATUS;

                        end if;
                        
                        
                     when RD_PORT_B_LO => 
                     
                        if R0_dir_AtoB_s = '1' then  -- direction - 0 = B -> A   1 = A -> B
                              cpu_d_o <=  dma_dest_s(7 downto 0);
                        else
                              cpu_d_o <=  dma_src_s(7 downto 0);
                        end if;
                           
                        if R6_read_mask_s(6) = '1' then -- port B address counter HI
                           reg_rd_seq_s := RD_PORT_B_HI;
                           
                        elsif R6_read_mask_s(0) = '1' then -- status byte
                           reg_rd_seq_s := RD_STATUS;
                           
                        elsif R6_read_mask_s(1) = '1' then -- byte counter LO
                           reg_rd_seq_s := RD_COUNTER_LO;
                        
                        elsif R6_read_mask_s(2) = '1' then -- byte counter HI
                           reg_rd_seq_s := RD_COUNTER_HI;   
                           
                        elsif R6_read_mask_s(3) = '1' then -- port A address counter LO
                           reg_rd_seq_s := RD_PORT_A_LO;
                           
                        elsif R6_read_mask_s(4) = '1' then -- port A address counter HI
                           reg_rd_seq_s := RD_PORT_A_HI;

                        elsif R6_read_mask_s(5) = '1' then -- port B address counter LO
                           reg_rd_seq_s := RD_PORT_B_LO;
                           
                        else
                           reg_rd_seq_s := RD_STATUS;
                           
                        end if;
                        
                        
                     when RD_PORT_B_HI => 
                     
                        if R0_dir_AtoB_s = '1' then  -- direction - 0 = B -> A   1 = A -> B
                              cpu_d_o <=  dma_dest_s(15 downto 8);
                        else
                              cpu_d_o <=  dma_src_s(15 downto 8);
                        end if;
                           
                        if R6_read_mask_s(0) = '1' then -- status byte
                           reg_rd_seq_s := RD_STATUS;
                           
                        elsif R6_read_mask_s(1) = '1' then -- byte counter LO
                           reg_rd_seq_s := RD_COUNTER_LO;
                        
                        elsif R6_read_mask_s(2) = '1' then -- byte counter HI
                           reg_rd_seq_s := RD_COUNTER_HI;   
                           
                        elsif R6_read_mask_s(3) = '1' then -- port A address counter LO
                           reg_rd_seq_s := RD_PORT_A_LO;
                           
                        elsif R6_read_mask_s(4) = '1' then -- port A address counter HI
                           reg_rd_seq_s := RD_PORT_A_HI;

                        elsif R6_read_mask_s(5) = '1' then -- port B address counter LO
                           reg_rd_seq_s := RD_PORT_B_LO;
                           
                        elsif R6_read_mask_s(6) = '1' then -- port B address counter HI
                           reg_rd_seq_s := RD_PORT_B_HI;
                           
                        else
                           reg_rd_seq_s := RD_STATUS;
                           
                        end if;
                     
      
                     when others =>
                     
                        cpu_d_o <= X"00";
                        reg_rd_seq_s := RD_STATUS;
                     
                     end case;
            
            end if;
         
      end if;
    end if;
   end process;
   
end z80dma_unit;
