-- ZX NEXT UARTS
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

-- Implements both uarts in the ZX Next.  The uarts share four registers,
-- one of which is used to select which uart to communicate with.
--
-- Both uarts have a 512 byte Rx buffer and a 64 byte Tx buffer

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity uart is
   generic
   (
      NOISE_REJECTION_BITS : positive := 2     -- pulse widths less than 2^NOISE_REJECTION_BITS / i_CLK will be rejected
   );
   port 
   (
      i_CLK                : in std_logic;
      i_CLK_n              : in std_logic;
      
      i_reset              : in std_logic;
      i_reset_hard         : in std_logic;
      
      i_uart_reg           : in std_logic_vector(1 downto 0);  -- 00 = Rx, 01 = select, 10 = frame, 11 = tx
      
      -- read from uart registers to cpu
      
      i_uart_rd            : in std_logic;
      o_cpu_d              : out std_logic_vector(7 downto 0);
      
      -- write from cpu to uart registers
      
      i_uart_wr            : in std_logic;
      i_cpu_d              : in std_logic_vector(7 downto 0);
      
      -- uart 0
      
      o_uart0_hwflow       : out std_logic;   -- 1 = hardware flow control enabled
      
      i_Rx_0               : in std_logic;
      o_Rx_0_rtr_n         : out std_logic;   -- 0 = ready to receive bytes
      
      o_Rx_0_avail         : out std_logic;   -- 1 = at least one byte in the Rx buffer
      o_Rx_0_near_full     : out std_logic;   -- 1 = Rx buffer is at least 3/4 full
      
      o_Rx_0_err           : out std_logic;   -- 1 = framing or parity error
      o_Rx_0_err_break     : out std_logic;   -- 1 = break condition detected
      
      o_Tx_0               : out std_logic;
      i_Tx_0_cts_n         : in std_logic;    -- 0 = clear to send bytes
      
      o_Tx_0_empty         : out std_logic;   -- 1 = Tx buffer is empty
      
      -- uart 1
      
      o_uart1_hwflow       : out std_logic;   -- 1 = hardware flow control enabled
      
      i_Rx_1               : in std_logic;
      o_Rx_1_rtr_n         : out std_logic;   -- 0 = ready to receive bytes
      
      o_Rx_1_avail         : out std_logic;   -- 1 = at least one byte in the Rx buffer
      o_Rx_1_near_full     : out std_logic;   -- 1 = Rx buffer is at least 3/4 full
      
      o_Rx_1_err           : out std_logic;   -- 1 = framing or parity error
      o_Rx_1_err_break     : out std_logic;   -- 1 = break condition detected
      
      o_Tx_1               : out std_logic;
      i_Tx_1_cts_n         : in std_logic;    -- 1 = clear to send bytes
      
      o_Tx_1_empty         : out std_logic    -- 1 = Tx buffer is empty
   );
end entity;

architecture rtl of uart is

   component sdpram_64_9 is
   PORT (

      DPRA  : IN  STD_LOGIC_VECTOR(6-1 downto 0) := (OTHERS => '0');
      CLK   : IN STD_LOGIC;
      WE    : IN  STD_LOGIC;
      DPO   : OUT STD_LOGIC_VECTOR(9-1 downto 0);
      A     : IN  STD_LOGIC_VECTOR(6-1-(4*0*boolean'pos(6>4)) downto 0) := (OTHERS => '0');
      D     : IN  STD_LOGIC_VECTOR(9-1 downto 0) := (OTHERS => '0')

   );
   end component;

   signal uart_select_wr            : std_logic;
   signal uart_frame_wr             : std_logic;
   signal uart_tx_wr                : std_logic;
   signal uart_tx_rd                : std_logic;
   signal uart_rx_wr                : std_logic;
   signal uart_rx_rd                : std_logic;
   
   signal uart0_tx_rd               : std_logic;
   signal uart1_tx_rd               : std_logic;
   signal uart0_tx_rd_d             : std_logic;
   signal uart1_tx_rd_d             : std_logic;
   signal uart0_tx_rd_fe            : std_logic;
   signal uart1_tx_rd_fe            : std_logic;
   
   signal uart_select_r             : std_logic;
   
   signal uart0_prescalar_msb_r     : std_logic_vector(2 downto 0) := (others => '0');
   signal uart1_prescalar_msb_r     : std_logic_vector(2 downto 0) := (others => '0');
   
   signal uart0_framing_r           : std_logic_vector(7 downto 0) := X"18";
   signal uart1_framing_r           : std_logic_vector(7 downto 0) := X"18";
   
   signal uart0_prescalar_lsb_r     : std_logic_vector(13 downto 0) := "00000011110011";
   signal uart1_prescalar_lsb_r     : std_logic_vector(13 downto 0) := "00000011110011";
   
   signal uart0_fifo_reset          : std_logic;
   signal uart0_rx_rd               : std_logic;
   signal uart0_tx_wr               : std_logic;
   
   signal uart0_rx_avail            : std_logic;
   signal uart0_rx_byte             : std_logic_vector(7 downto 0);
   signal uart0_rx_err_framing      : std_logic;
   signal uart0_rx_err_parity       : std_logic;
   signal uart0_rx_err_break        : std_logic;
   
   signal uart0_rx_fifo_empty       : std_logic;
   signal uart0_rx_fifo_full_near   : std_logic;
   signal uart0_rx_fifo_full_almost : std_logic;
   signal uart0_rx_fifo_full        : std_logic;
   signal uart0_rx_fifo_raddr       : std_logic_vector(8 downto 0);
   signal uart0_rx_fifo_waddr       : std_logic_vector(8 downto 0);
   
   signal uart0_tx_busy             : std_logic;
   signal uart0_tx_fifo_empty       : std_logic;
   signal uart0_tx_fifo_full        : std_logic;
   signal uart0_tx_fifo_raddr       : std_logic_vector(5 downto 0);
   signal uart0_tx_fifo_waddr       : std_logic_vector(5 downto 0);
   
   signal uart0_tx_byte             : std_logic_vector(8 downto 0);
   signal uart0_tx_en               : std_logic;
   signal uart0_tx_wr_d             : std_logic;
   signal uart0_tx_fifo_we          : std_logic;
   signal Tx_0                      : std_logic;
   
   signal uart0_status_rx_err_overflow    : std_logic;
   signal uart0_status_rx_err_framing     : std_logic;
   signal uart0_status_rx_near_full       : std_logic;
   signal uart0_status_rx_avail           : std_logic;
   signal uart0_status_tx_full            : std_logic;
   signal uart0_status_tx_empty           : std_logic;
   signal uart0_status_rx_err_break       : std_logic;
   signal uart0_status_rx_err             : std_logic;

   signal uart1_fifo_reset          : std_logic;
   signal uart1_rx_rd               : std_logic;
   signal uart1_tx_wr               : std_logic;
   
   signal uart1_rx_avail            : std_logic;
   signal uart1_rx_byte             : std_logic_vector(7 downto 0);
   signal uart1_rx_err_framing      : std_logic;
   signal uart1_rx_err_parity       : std_logic;
   signal uart1_rx_err_break        : std_logic;
   
   signal uart1_rx_fifo_empty       : std_logic;
   signal uart1_rx_fifo_full_near   : std_logic;
   signal uart1_rx_fifo_full_almost : std_logic;
   signal uart1_rx_fifo_full        : std_logic;
   signal uart1_rx_fifo_raddr       : std_logic_vector(8 downto 0);
   signal uart1_rx_fifo_waddr       : std_logic_vector(8 downto 0);
   
   signal uart1_tx_busy             : std_logic;
   signal uart1_tx_fifo_empty       : std_logic;
   signal uart1_tx_fifo_full        : std_logic;
   signal uart1_tx_fifo_raddr       : std_logic_vector(5 downto 0);
   signal uart1_tx_fifo_waddr       : std_logic_vector(5 downto 0);
   
   signal uart1_tx_byte             : std_logic_vector(8 downto 0);
   signal uart1_tx_en               : std_logic;
   signal uart1_tx_wr_d             : std_logic;
   signal uart1_tx_fifo_we          : std_logic;
   signal Tx_1                      : std_logic;
   
   signal uart1_status_rx_err_overflow    : std_logic;
   signal uart1_status_rx_err_framing     : std_logic;
   signal uart1_status_rx_near_full       : std_logic;
   signal uart1_status_rx_avail           : std_logic;
   signal uart1_status_tx_full            : std_logic;
   signal uart1_status_tx_empty           : std_logic;
   signal uart1_status_rx_err_break       : std_logic;
   signal uart1_status_rx_err             : std_logic;
   
   signal uart0_rx_o                : std_logic_vector(8 downto 0);
   signal uart1_rx_o                : std_logic_vector(8 downto 0);
   
   signal uart0_rx_avail_d          : std_logic;
   signal uart0_rx_byte_d           : std_logic_vector(8 downto 0);
   signal uart0_rx_fifo_addr        : std_logic_vector(8 downto 0);
   signal uart0_rx_fifo_we          : std_logic;
   
   signal uart1_rx_avail_d          : std_logic;
   signal uart1_rx_byte_d           : std_logic_vector(8 downto 0);
   signal uart1_rx_fifo_addr        : std_logic_vector(8 downto 0);
   signal uart1_rx_fifo_we          : std_logic;
   
begin

   -----------------
   -- UART REGISTERS
   -----------------
   
   process (i_uart_reg, i_uart_rd, i_uart_wr)
   begin
   
      uart_select_wr <= '0';
      uart_frame_wr <= '0';
      uart_tx_wr <= '0';
      uart_tx_rd <= '0';
      uart_rx_wr <= '0';
      uart_rx_rd <= '0';
   
      case i_uart_reg is
         when "00" =>
            uart_rx_wr <= i_uart_wr;
            uart_rx_rd <= i_uart_rd;
         when "01" =>
            uart_select_wr <= i_uart_wr;
         when "10" =>
            uart_frame_wr <= i_uart_wr;
         when others =>
            uart_tx_wr <= i_uart_wr;
            uart_tx_rd <= i_uart_rd;
      end case;
   
   end process;
   
   uart0_tx_rd <= uart_tx_rd and not uart_select_r;
   uart1_tx_rd <= uart_tx_rd and uart_select_r;
   
   process(i_CLK)
   begin
      if rising_edge(i_CLK) then
         uart0_tx_rd_d <= uart0_tx_rd;
         uart1_tx_rd_d <= uart1_tx_rd;
      end if;
   end process;
   
   uart0_tx_rd_fe <= uart0_tx_rd_d and not uart_tx_rd;
   uart1_tx_rd_fe <= uart1_tx_rd_d and not uart_tx_rd;

   -- uart select
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' then
            uart_select_r <= '0';
            if i_reset_hard = '1' then
               uart0_prescalar_msb_r <= (others => '0');
               uart1_prescalar_msb_r <= (others => '0');
            end if;
         elsif uart_select_wr = '1' then
            uart_select_r <= i_cpu_d(6);
            if i_cpu_d(4) = '1' then
               if i_cpu_d(6) = '0' then
                  uart0_prescalar_msb_r <= i_cpu_d(2 downto 0);
               else
                  uart1_prescalar_msb_r <= i_cpu_d(2 downto 0);
               end if;
            end if;
         end if;
      end if;
   end process;   
   
   -- uart frame
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset_hard = '1' then
            uart0_framing_r <= X"18";
            uart1_framing_r <= X"18";
         elsif uart_frame_wr = '1' then
            if uart_select_r = '0' then
               uart0_framing_r <= i_cpu_d;  -- reset, tx break, flow control, # bits (2), parity en, parity odd, stop bits
            else
               uart1_framing_r <= i_cpu_d;  -- reset, tx break, flow control, # bits (2), parity en, parity odd, stop bits
            end if;
         end if;
      end if;
   end process;
   
   o_uart0_hwflow <= uart0_framing_r(5);
   o_uart1_hwflow <= uart1_framing_r(5);
   
   -- uart prescaler lsb
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset_hard = '1' then
            uart0_prescalar_lsb_r <= "00000011110011";   -- 115200 @ 28MHz system clock
            uart1_prescalar_lsb_r <= "00000011110011";   -- 115200 @ 28MHz system clock
         elsif uart_rx_wr = '1' then
            if uart_select_r = '0' then
               if i_cpu_d(7) = '0' then
                  uart0_prescalar_lsb_r(6 downto 0) <= i_cpu_d(6 downto 0);
               else
                  uart0_prescalar_lsb_r(13 downto 7) <= i_cpu_d(6 downto 0);
               end if;
            else
               if i_cpu_d(7) = '0' then
                  uart1_prescalar_lsb_r(6 downto 0) <= i_cpu_d(6 downto 0);
               else
                  uart1_prescalar_lsb_r(13 downto 7) <= i_cpu_d(6 downto 0);
               end if;
            end if;
         end if;
      end if;
   end process;
   
   -- read registers
   
   process (uart_select_r, i_uart_reg, uart0_rx_o, uart0_prescalar_msb_r, uart0_framing_r, uart0_status_rx_err_break, uart0_status_rx_err_framing,
            uart0_status_tx_empty, uart0_status_rx_near_full, uart0_status_rx_err_overflow, uart0_status_tx_full, uart0_status_rx_avail,
            uart1_rx_o, uart1_prescalar_msb_r, uart1_framing_r, uart1_status_rx_err_break, uart1_status_rx_err_framing, uart1_status_tx_empty,
            uart1_status_rx_near_full, uart1_status_rx_err_overflow, uart1_status_tx_full, uart1_status_rx_avail)            
   begin
      if uart_select_r = '0' then
         case i_uart_reg is
            when "00" =>
               if uart0_status_rx_avail = '1' then
                  o_cpu_d <= uart0_rx_o(7 downto 0);
               else
                  o_cpu_d <= (others => '0');
               end if;
            when "01" =>
               o_cpu_d <= "00000" & uart0_prescalar_msb_r;
            when "10" =>
               o_cpu_d <= uart0_framing_r;
            when others =>
               o_cpu_d <= uart0_status_rx_err_break & uart0_status_rx_err_framing & (uart0_rx_o(8) and uart0_status_rx_avail) & uart0_status_tx_empty &
                          uart0_status_rx_near_full & uart0_status_rx_err_overflow & uart0_status_tx_full & uart0_status_rx_avail;
         end case;
      else
         case i_uart_reg is
            when "00" =>
               if uart1_status_rx_avail = '1' then
                  o_cpu_d <= uart1_rx_o(7 downto 0);
               else
                  o_cpu_d <= (others => '0');
               end if;
            when "01" =>
               o_cpu_d <= "01000" & uart1_prescalar_msb_r;
            when "10" =>
               o_cpu_d <= uart1_framing_r;
            when others =>
               o_cpu_d <= uart1_status_rx_err_break & uart1_status_rx_err_framing & (uart1_rx_o(8) and uart1_status_rx_avail) & uart1_status_tx_empty &
                          uart1_status_rx_near_full & uart1_status_rx_err_overflow & uart1_status_tx_full & uart1_status_rx_avail;
         end case;
      end if;
   end process;

   ---------
   -- UART 0
   ---------
   
   uart0_fifo_reset <= i_reset or uart0_framing_r(7);
   
   uart0_rx_rd <= uart_rx_rd and not uart_select_r;
   uart0_tx_wr <= uart_tx_wr and not uart_select_r;
   
   -- uart rx
   
   uart0_rx_mod: entity work.uart_rx
   generic map
   (
      PRESCALER_BITS       => 17,
      NOISE_REJECTION_BITS => NOISE_REJECTION_BITS
   )
   port map
   (
      i_CLK                => i_CLK,
      i_reset              => i_reset,

      i_frame              => uart0_framing_r(7) & "00" & uart0_framing_r(4 downto 0),  -- reset, pause, flow control (n/a here), # bits (2), parity en, parity odd, stop bits
      i_prescaler          => uart0_prescalar_msb_r & uart0_prescalar_lsb_r,

      o_Rx_avail           => uart0_rx_avail,         -- 1 = Rx has byte (one cycle)
      o_Rx_byte            => uart0_rx_byte,

      o_err_framing        => uart0_rx_err_framing,   -- one cycle
      o_err_parity         => uart0_rx_err_parity,    -- one cycle
      o_err_break          => uart0_rx_err_break,     -- held

      i_Rx                 => i_Rx_0
   );

   uart0_rx_fifop: entity work.fifop
   generic map
   (
      DEPTH_BITS  => 9
   )
   port map
   (
      i_CLK          => i_CLK,
      i_reset        => uart0_fifo_reset,
      
      o_empty        => uart0_rx_fifo_empty,        -- held
      o_full_near    => uart0_rx_fifo_full_near,    -- held (3/4)
      o_full_almost  => uart0_rx_fifo_full_almost,  -- held (full - 2 bytes)
      o_full         => uart0_rx_fifo_full,         -- held
      
      i_rd           => uart0_rx_rd,                -- read address adjusted on falling edge if not empty
      o_raddr        => uart0_rx_fifo_raddr,
      
      i_wr           => uart0_rx_fifo_we,           -- write address adjusted on falling edge if not full
      o_waddr        => uart0_rx_fifo_waddr
   );
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if uart0_fifo_reset = '1' then
            o_Rx_0_rtr_n <= uart0_framing_r(5);
         else
            o_Rx_0_rtr_n <= uart0_framing_r(5) and uart0_rx_fifo_full_almost;
         end if;
      end if;
   end process;
   
   -- uart0 rx fifo memory is shared with uart1 rx in a single bram block due to size (below)
   
   -- uart tx
   
   uart0_tx_mod: entity work.uart_tx
   generic map
   (
      PRESCALER_BITS       => 17
   )
   port map
   (
      i_CLK                => i_CLK,
      i_reset              => i_reset,

      i_frame              => uart0_framing_r,  -- reset, break, flow control, # bits (2), parity en, parity odd, stop bits
      i_prescaler          => uart0_prescalar_msb_r & uart0_prescalar_lsb_r,

      o_busy               => uart0_tx_busy,    -- '0' if Tx is ready for another byte
      
      i_Tx_en              => uart0_tx_en,
      i_Tx_byte            => uart0_tx_byte(7 downto 0),
      
      i_cts_n              => i_Tx_0_cts_n,     -- '0' if receiver is ready (only if flow control is enabled)

      o_Tx                 => Tx_0
   );
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         o_Tx_0 <= Tx_0;
      end if;
   end process;

   uart0_tx_fifop: entity work.fifop
   generic map
   (
      DEPTH_BITS  => 6
   )
   port map
   (
      i_CLK          => i_CLK,
      i_reset        => uart0_fifo_reset,
      
      o_empty        => uart0_tx_fifo_empty,       -- held
      o_full_near    => open,
      o_full_almost  => open,
      o_full         => uart0_tx_fifo_full,        -- held
      
      i_rd           => uart0_tx_en,               -- read address adjusted on falling edge if not empty
      o_raddr        => uart0_tx_fifo_raddr,
      
      i_wr           => uart0_tx_fifo_we,          -- write address adjusted on falling edge if not full
      o_waddr        => uart0_tx_fifo_waddr
   );
   
   -- cpu write, uart read
   
   uart0_tx_fifo: sdpram_64_9  -- 64x8 needed but the natural size for xilinx is 64x9
   port map
   (
      -- async read (uart)
      DPRA => uart0_tx_fifo_raddr,
      DPO  => uart0_tx_byte,
      -- sync write (cpu)
      CLK  => i_CLK_n,
      WE   => uart0_tx_fifo_we,
      A    => uart0_tx_fifo_waddr,
      D    => '0' & i_cpu_d
   );
   
   uart0_tx_en <= '1' when uart0_tx_busy = '0' and uart0_tx_fifo_empty = '0' else '0';
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         uart0_tx_wr_d <= uart0_tx_wr;
      end if;
   end process;

   uart0_tx_fifo_we <= uart0_tx_wr and (not uart0_tx_wr_d) and not uart0_tx_fifo_full;

   -- uart status
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if uart0_fifo_reset = '1' or uart0_tx_rd_fe = '1' then
            uart0_status_rx_err_overflow <= '0';
            uart0_status_rx_err_framing <= '0';
         else
            uart0_status_rx_err_overflow <= uart0_status_rx_err_overflow or (uart0_rx_avail and uart0_rx_avail_d);
            uart0_status_rx_err_framing <= uart0_status_rx_err_framing or uart0_rx_err_framing or uart0_rx_err_parity;
         end if;
      end if;
   end process;

   uart0_status_rx_near_full <= uart0_rx_fifo_full_near;
   uart0_status_rx_avail <= not uart0_rx_fifo_empty;
   uart0_status_tx_full <= uart0_tx_fifo_full;
   uart0_status_tx_empty <= uart0_tx_fifo_empty and not uart0_tx_busy;
   uart0_status_rx_err_break <= uart0_rx_err_break;
   uart0_status_rx_err <= uart0_status_rx_err_overflow or uart0_status_rx_err_framing;
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         o_Rx_0_near_full <= uart0_status_rx_near_full;
         o_Rx_0_avail <= uart0_status_rx_avail;
         
         o_Rx_0_err_break <= uart0_status_rx_err_break;
         o_Rx_0_err <= uart0_status_rx_err;
         
         o_Tx_0_empty <= uart0_tx_fifo_empty;
      end if;
   end process;

   ---------
   -- UART 1
   ---------

   uart1_fifo_reset <= i_reset or uart1_framing_r(7);
   
   uart1_rx_rd <= uart_rx_rd and uart_select_r;
   uart1_tx_wr <= uart_tx_wr and uart_select_r;
   
   -- uart rx
   
   uart1_rx_mod: entity work.uart_rx
   generic map
   (
      PRESCALER_BITS       => 17,
      NOISE_REJECTION_BITS => NOISE_REJECTION_BITS
   )
   port map
   (
      i_CLK                => i_CLK,
      i_reset              => i_reset,

      i_frame              => uart1_framing_r(7) & "00" & uart1_framing_r(4 downto 0),  -- reset, pause, flow control (n/a here), # bits (2), parity en, parity odd, stop bits
      i_prescaler          => uart1_prescalar_msb_r & uart1_prescalar_lsb_r,

      o_Rx_avail           => uart1_rx_avail,   -- 1 = Rx has byte (one cycle)
      o_Rx_byte            => uart1_rx_byte,

      o_err_framing        => uart1_rx_err_framing,   -- one cycle
      o_err_parity         => uart1_rx_err_parity,    -- one cycle
      o_err_break          => uart1_rx_err_break,     -- held

      i_Rx                 => i_Rx_1
   );

   uart1_rx_fifop: entity work.fifop
   generic map
   (
      DEPTH_BITS  => 9
   )
   port map
   (
      i_CLK         => i_CLK,
      i_reset       => uart1_fifo_reset,
      
      o_empty       => uart1_rx_fifo_empty,        -- held
      o_full_near   => uart1_rx_fifo_full_near,    -- held (3/4)
      o_full_almost => uart1_rx_fifo_full_almost,  -- held (full - 2 bytes)
      o_full        => uart1_rx_fifo_full,         -- held
      
      i_rd          => uart1_rx_rd,                -- read address adjusted on falling edge if not empty
      o_raddr       => uart1_rx_fifo_raddr,
      
      i_wr          => uart1_rx_fifo_we,           -- write address adjusted on falling edge if not full
      o_waddr       => uart1_rx_fifo_waddr
   );

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if uart1_fifo_reset = '1' then
            o_Rx_1_rtr_n <= uart1_framing_r(5);
         else
            o_Rx_1_rtr_n <= uart1_framing_r(5) and uart1_rx_fifo_full_almost;
         end if;
      end if;
   end process;
   
   -- uart1 rx fifo memory is shared with uart0 rx in a single bram block due to size (below)
   
   -- uart tx
   
   uart1_tx_mod: entity work.uart_tx
   generic map
   (
      PRESCALER_BITS       => 17
   )
   port map
   (
      i_CLK                => i_CLK,
      i_reset              => i_reset,

      i_frame              => uart1_framing_r,  -- reset, break, flow control, # bits (2), parity en, parity odd, stop bits
      i_prescaler          => uart1_prescalar_msb_r & uart1_prescalar_lsb_r,

      o_busy               => uart1_tx_busy,    -- '0' if Tx is ready for another byte
      
      i_Tx_en              => uart1_tx_en,
      i_Tx_byte            => uart1_tx_byte(7 downto 0),
      
      i_cts_n              => i_Tx_1_cts_n,     -- '0' if receiver is ready (only if flow control is enabled)

      o_Tx                 => Tx_1
   );

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         o_Tx_1 <= Tx_1;
      end if;
   end process;
   
   uart1_tx_fifop: entity work.fifop
   generic map
   (
      DEPTH_BITS  => 6
   )
   port map
   (
      i_CLK          => i_CLK,
      i_reset        => uart1_fifo_reset,
      
      o_empty        => uart1_tx_fifo_empty,       -- held
      o_full_near    => open,
      o_full_almost  => open,
      o_full         => uart1_tx_fifo_full,        -- held
      
      i_rd           => uart1_tx_en,               -- read address adjusted on falling edge if not empty
      o_raddr        => uart1_tx_fifo_raddr,
      
      i_wr           => uart1_tx_fifo_we,          -- write address adjusted on falling edge if not full
      o_waddr        => uart1_tx_fifo_waddr
   );
   
   -- cpu write, uart read
   
   uart1_tx_fifo: sdpram_64_9  -- 64x8 needed but the natural size for xilinx is 64x9
   port map
   (
      -- async read (uart)
      DPRA => uart1_tx_fifo_raddr,
      DPO  => uart1_tx_byte,
      -- sync write (cpu)
      CLK  => i_CLK_n,
      WE   => uart1_tx_fifo_we,
      A    => uart1_tx_fifo_waddr,
      D    => '0' & i_cpu_d
   );
   
   uart1_tx_en <= '1' when uart1_tx_busy = '0' and uart1_tx_fifo_empty = '0' else '0';
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         uart1_tx_wr_d <= uart1_tx_wr;
      end if;
   end process;

   uart1_tx_fifo_we <= uart1_tx_wr and (not uart1_tx_wr_d) and not uart1_tx_fifo_full;

   -- uart status

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if uart1_fifo_reset = '1' or uart1_tx_rd_fe = '1' then
            uart1_status_rx_err_overflow <= '0';
            uart1_status_rx_err_framing <= '0';
         else
            uart1_status_rx_err_overflow <= uart1_status_rx_err_overflow or (uart1_rx_avail and uart1_rx_avail_d);
            uart1_status_rx_err_framing <= uart1_status_rx_err_framing or uart1_rx_err_framing or uart1_rx_err_parity;
         end if;
      end if;
   end process;

   uart1_status_rx_near_full <= uart1_rx_fifo_full_near;
   uart1_status_rx_avail <= not uart1_rx_fifo_empty;
   uart1_status_tx_full <= uart1_tx_fifo_full;
   uart1_status_tx_empty <= uart1_tx_fifo_empty and not uart1_tx_busy;
   uart1_status_rx_err_break <= uart1_rx_err_break;
   uart1_status_rx_err <= uart1_status_rx_err_overflow or uart1_status_rx_err_framing;

   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         o_Rx_1_near_full <= uart1_status_rx_near_full;
         o_Rx_1_avail <= uart1_status_rx_avail;
         
         o_Rx_1_err_break <= uart1_status_rx_err_break;
         o_Rx_1_err <= uart1_status_rx_err;
         
         o_Tx_1_empty <= uart1_tx_fifo_empty;
      end if;
   end process;
   
   --------------------------
   -- UART 0/1 RX FIFO MEMORY
   --------------------------

   -- cpu read, uart write
   
   uart_fifo_rx: entity work.tdpram
   generic map 
   (
      addr_width_g  => 10,
      data_width_g  => 9
   )
   port map 
   (
      -- uart 0
      clk_a_i  => i_CLK,
      we_a_i   => uart0_rx_fifo_we,
      addr_a_i => '0' & uart0_rx_fifo_addr,
      data_a_i => uart0_rx_byte_d,
      data_a_o => uart0_rx_o,
      -- uart 1
      clk_b_i  => i_CLK,
      we_b_i   => uart1_rx_fifo_we,
      addr_b_i => '1' & uart1_rx_fifo_addr,
      data_b_i => uart1_rx_byte_d,
      data_b_o => uart1_rx_o
   );

   -- share a single bram unit, the two ports are independent
   -- cpu read must have priority because response must be within two cycles for dma
   
   -- uart 0
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or uart0_rx_fifo_we = '1' then
            uart0_rx_avail_d <= '0';
            uart0_rx_byte_d <= (others => '0');
         elsif uart0_rx_avail = '1' and uart0_rx_avail_d = '0' then
            uart0_rx_avail_d <= '1';
            uart0_rx_byte_d <= uart0_status_rx_err & uart0_rx_byte;
         end if;
      end if;
   end process;
   
   uart0_rx_fifo_addr <= uart0_rx_fifo_waddr when uart0_rx_fifo_we = '1' else uart0_rx_fifo_raddr;
   uart0_rx_fifo_we <= uart0_rx_avail_d and (not uart0_rx_fifo_full) and (not uart0_rx_rd) and (not uart0_tx_rd);

   -- uart 1
   
   process (i_CLK)
   begin
      if rising_edge(i_CLK) then
         if i_reset = '1' or uart1_rx_fifo_we = '1' then
            uart1_rx_avail_d <= '0';
            uart1_rx_byte_d <= (others => '0');
         elsif uart1_rx_avail = '1' and uart1_rx_avail_d = '0' then
            uart1_rx_avail_d <= '1';
            uart1_rx_byte_d <= uart1_status_rx_err & uart1_rx_byte;
         end if;
      end if;
   end process;
   
   uart1_rx_fifo_addr <= uart1_rx_fifo_waddr when uart1_rx_fifo_we = '1' else uart1_rx_fifo_raddr;
   uart1_rx_fifo_we <= uart1_rx_avail_d and (not uart1_rx_fifo_full) and (not uart1_rx_rd) and (not uart1_tx_rd);

end architecture;
