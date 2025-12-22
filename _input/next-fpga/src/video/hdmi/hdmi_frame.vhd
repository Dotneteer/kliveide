-- HDMI Frame
-- Copyright 2023 Alvin Albrecht
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

entity hdmi_frame is
   port
   (
      i_reset_async_n  : std_logic;
      
      -- CLK_28 domain

      i_scanlines      : in std_logic_vector(1 downto 0);   -- CLK_28
      
      -- pixel in

      i_CLK_RGB        : in std_logic;                      -- CLK_14
      i_CLK_RGB_EN     : in std_logic;                      -- CLK_14
      
      i_rgb_sync       : in std_logic;                      -- CLK_7
      i_rgb            : in std_logic_vector(8 downto 0);   -- CLK_14

      -- pixel out

      i_CLK_HDMI       : in std_logic;                      -- ~ 27 MHZ

      o_blank          : out std_logic;
      o_vsync_n        : out std_logic;
      o_hsync_n        : out std_logic;
      
      o_rgb            : out std_logic_vector(8 downto 0);
      
      -- hdmi configuration
      
      i_HACTIVE        : in std_logic_vector(9 downto 0);   -- >=
      i_HSYNC_BEG      : in std_logic_vector(9 downto 0);   -- >= at least two cycles width
      i_HSYNC_END      : in std_logic_vector(9 downto 0);   -- <= at least two cycles width
      i_HLAST          : in std_logic_vector(9 downto 0);   -- ==
      
      i_VACTIVE        : in std_logic_vector(9 downto 0);   -- >=
      i_VSYNC_BEG      : in std_logic_vector(9 downto 0);   -- >=
      i_VSYNC_END      : in std_logic_vector(9 downto 0);   -- <=
      i_VLAST          : in std_logic_vector(9 downto 0)    -- ==
   );
end entity;
   
architecture rtl of hdmi_frame is
   
   signal scanlines      : std_logic_vector(1 downto 0) := (others => '0');

   signal rgb_sync       : std_logic := '0';

   type   state_t        is (S_ASYNC_RESET, S_RGB_SYNC, S_FRAME_WAIT, S_RUNNING);
   signal state          : state_t;
   signal state_next     : state_t;
   
   signal running        : std_logic;
   
   signal h_last         : std_logic;
   signal v_last         : std_logic;
   
   signal hcnt           : std_logic_vector(9 downto 0) := (others => '0');
   signal vcnt           : std_logic_vector(9 downto 0) := (others => '0');
   
   signal hsync_n        : std_logic := '1';
   signal vsync_n        : std_logic := '1';
   signal blank          : std_logic := '1';

   signal v_active       : std_logic;
   signal h_active       : std_logic;
   signal hdmi_active    : std_logic;

   signal waddr          : std_logic_vector(12 downto 0) := (others => '0');
   signal raddr          : std_logic_vector(12 downto 0) := (others => '0');
   signal raddr_lag      : std_logic_vector(12 downto 0) := (others => '0');

   signal rgb_raw        : std_logic_vector(8 downto 0);

   signal rgb_r_25       : std_logic_vector(3 downto 0);
   signal rgb_g_25       : std_logic_vector(3 downto 0);
   signal rgb_b_25       : std_logic_vector(3 downto 0);
   signal rgb_r_12       : std_logic_vector(3 downto 0);
   signal rgb_g_12       : std_logic_vector(3 downto 0);
   signal rgb_b_12       : std_logic_vector(3 downto 0);

   signal rgb_scanline   : std_logic_vector(8 downto 0) := (others => '0');

begin

   -- cross clock domains
   
   process (i_CLK_HDMI)
   begin
      if rising_edge(i_CLK_HDMI) then
         scanlines <= i_scanlines;
      end if;
   end process;

   process (i_CLK_HDMI, i_reset_async_n)
   begin
      if i_reset_async_n = '0' then
         rgb_sync <= '0';
      elsif rising_edge(i_CLK_HDMI) then
         if state = S_RGB_SYNC then
            rgb_sync <= i_rgb_sync;
         else
            rgb_sync <= '0';
         end if;
      end if;
   end process;

   -- reset & frame sync
   
   process (i_CLK_HDMI, i_reset_async_n)
   begin
      if i_reset_async_n = '0' then
         state <= S_ASYNC_RESET;
      elsif rising_edge(i_CLK_HDMI) then
         state <= state_next;
      end if;
   end process;
   
   process (state, rgb_sync, h_last, v_last)
   begin
      case state is
         when S_ASYNC_RESET =>
            state_next <= S_RGB_SYNC;
         when S_RGB_SYNC =>
            if rgb_sync = '1' then
               state_next <= S_FRAME_WAIT;
            else
               state_next <= S_RGB_SYNC;
            end if;
         when S_FRAME_WAIT =>
            if h_last = '1' and v_last = '1' then
               state_next <= S_RUNNING;
            else
               state_next <= S_FRAME_WAIT;
            end if;
         when S_RUNNING =>
            state_next <= S_RUNNING;
         when others =>
            state_next <= S_RGB_SYNC;
      end case;
   end process;
   
   running <= '1' when state = S_RUNNING else '0';

   -- hdmi frame
   
   h_last <= '1' when hcnt = i_HLAST else '0';
   v_last <= '1' when vcnt = i_VLAST else '0';
   
   process (i_CLK_HDMI)
   begin
      if rising_edge(i_CLK_HDMI) then
         if rgb_sync = '1' then
            hcnt <= i_HACTIVE;
            vcnt <= i_VACTIVE;
         elsif h_last = '1' then
            hcnt <= (others => '0');
            if v_last = '1' then
               vcnt <= (others => '0');
            else
               vcnt <= vcnt + 1;
            end if;
         else
            hcnt <= hcnt + 1;
         end if;
      end if;
   end process;
   
   process (i_CLK_HDMI)
   begin
      if rising_edge(i_CLK_HDMI) then
         if (hcnt >= i_HSYNC_BEG) and (hcnt <= i_HSYNC_END) then
            hsync_n <= not running;
         else
            hsync_n <= '1';
         end if;
      end if;
   end process;
   
   o_hsync_n <= hsync_n;
   
   process (i_CLK_HDMI)
   begin
      if rising_edge(i_CLK_HDMI) then
         if (vcnt >= i_VSYNC_BEG) and (vcnt <= i_VSYNC_END) then
            vsync_n <= not running;
         else
            vsync_n <= '1';
         end if;
      end if;
   end process;
   
   o_vsync_n <= vsync_n;

   v_active <= '1' when vcnt >= i_VACTIVE else '0';
   h_active <= '1' when hcnt >= i_HACTIVE else '0';
   
   hdmi_active <= h_active and v_active;

   process (i_CLK_HDMI)
   begin
      if rising_edge(i_CLK_HDMI) then
         if hdmi_active = '1' then
            blank <= not running;
         else
            blank <= '1';
         end if;
      end if;
   end process;
   
   o_blank <= blank;

   -- pixel buffer
   
   process (i_CLK_RGB)
   begin
      if rising_edge(i_CLK_RGB) then
         if running = '0' then
            waddr <= (others => '0');
         elsif i_CLK_RGB_EN = '1' then
            waddr <= waddr + 1;
         end if;
      end if;
   end process;
   
   process (i_CLK_HDMI)
   begin
      if rising_edge(i_CLK_HDMI) then
         if running = '0' then
            raddr <= (others => '0');
         elsif hdmi_active = '1' then
            raddr <= raddr + 1;
         elsif (v_active = '1') and (hsync_n = '0') and (vcnt(0) /= i_VACTIVE(0)) then
            raddr <= raddr_lag;
         end if;
      end if;
   end process;
   
   process (i_CLK_HDMI)
   begin
      if rising_edge(i_CLK_HDMI) then
         if (hsync_n = '0') and (vcnt(0) = i_VACTIVE(0)) then
            raddr_lag <= raddr;
         end if;
      end if;
   end process;
   
   hdmi_buffer : entity work.dpram2
   generic map
   (
      addr_width_g   => 13,
      data_width_g   => 9
   )
   port map
   (
      -- sync write only port
      clk_a_i        => i_CLK_RGB,
      we_i           => i_CLK_RGB_EN,
      addr_a_i       => waddr,
      data_a_i       => i_rgb,
      -- sync read only port
      clk_b_i        => i_CLK_HDMI,
      addr_b_i       => raddr,
      data_b_o       => rgb_raw
   );

   rgb_r_25 <= ('0' & rgb_raw(8 downto 6)) + ("00" & rgb_raw(8 downto 7));
   rgb_g_25 <= ('0' & rgb_raw(5 downto 3)) + ("00" & rgb_raw(5 downto 4));
   rgb_b_25 <= ('0' & rgb_raw(2 downto 0)) + ("00" & rgb_raw(2 downto 1));
   
   rgb_r_12 <= (rgb_r_25) + ("000" & rgb_raw(8));
   rgb_g_12 <= (rgb_g_25) + ("000" & rgb_raw(5));
   rgb_b_12 <= (rgb_b_25) + ("000" & rgb_raw(2));

   process (running, vcnt, i_VACTIVE, scanlines, rgb_raw, rgb_r_25, rgb_g_25, rgb_b_25, rgb_r_12, rgb_g_12, rgb_b_12)
   begin
      if running = '0' then
         rgb_scanline <= (others => '0');
      elsif vcnt(0) = i_VACTIVE(0) then
         rgb_scanline <= rgb_raw;
      else
         case scanlines is
            when "00" =>
               rgb_scanline <= rgb_raw;
            when "01" =>
               rgb_scanline <= '0' & rgb_raw(8 downto 7) & '0' & rgb_raw(5 downto 4) & '0' & rgb_raw(2 downto 1);   -- 50%
            when "10" =>
               rgb_scanline <= rgb_r_25(3 downto 1) & rgb_g_25(3 downto 1) & rgb_b_25(3 downto 1);   -- 25%
            when others =>
               rgb_scanline <= rgb_r_12(3 downto 1) & rgb_g_12(3 downto 1) & rgb_b_12(3 downto 1);   -- 12.5%
         end case;
      end if;
   end process;

--   process (i_CLK_HDMI)
--   begin
--      if rising_edge(i_CLK_HDMI) then
--         o_rgb <= rgb_scanline;
--      end if;
--   end process;

   o_rgb <= rgb_scanline;

end architecture;

