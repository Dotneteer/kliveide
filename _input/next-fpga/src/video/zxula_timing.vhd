-- ZX Spectrum Next Video Timing Module
--
-- Copyright 2023 Alvin Albrecht, Fabio Belavenuto
--
-- References:
-- 1 "The ZX Spectrum ULA: How to Design a Microcomputer", ISBN-13 978-0-9565071-0-5, (c) 2010 Chris Smith
-- 2 http://sblive.narod.ru/ZX-Spectrum/Pentagon128k/Pentagon128k.htm by Z.A.N.
--
-- Older versions of this module borrowed from the ZX UNO project:
-- <https://github.com/yomboprime/zxuno-addons/blob/master/test24_uart/common/pal_sync_generator.v>
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

library ieee;
use ieee.std_logic_1164.all;
use ieee.std_logic_unsigned.all;
use ieee.numeric_std.all;

entity zxula_timing is
   port
   (
      -- 28 MHz domain
      
      i_CLK_28           : in std_logic;
      
      i_50_60            : in std_logic;                      -- 0 = 50 Hz, 1 = 60 Hz
      i_timing           : in std_logic_vector(2 downto 0);   -- 1XX = pentagon, 010 = 128K, 011 = +3, else 48K
      
      i_cu_offset        : in std_logic_vector(7 downto 0);   -- offset applied to ula vertical pixel count for copper and line int
      
      -- 7 MHz doman
   
      i_CLK_7            : in std_logic;

      o_blank_n          : out std_logic;
      o_hsync_n          : out std_logic;
      o_vsync_n          : out std_logic;
      o_frame_sync       : out std_logic;
      
      o_hdmi_pixel_en    : out std_logic;                     -- pixel available for hdmi
      o_hdmi_frame_lock  : out std_logic;                     -- first pixel of hdmi frame should not be emitted before this time
      
      o_hc_ula           : out unsigned(8 downto 0);          -- ula horizontal count
      o_vc_ula           : out unsigned(8 downto 0);          -- ula vertical count
      o_vc_cu            : out unsigned(8 downto 0);          -- copper offsetted vertical count
      
      o_whc              : out unsigned(8 downto 0);          -- wide horizontal count for 320x256
      o_wvc              : out unsigned(8 downto 0);          -- wide vertical count for 320x256
      
      o_phc              : out unsigned(8 downto 0);          -- practical horizontal count for 256x192
      
      -- 28 MHz domain
      
      o_sc               : out std_logic_vector(1 downto 0);  -- 28 MHz sub pixel counter (four per pixel)

      i_inten_ula_n      : in std_logic;
      
      i_inten_line       : in std_logic;
      i_int_line         : in std_logic_vector(8 downto 0);
      
      -- 7 MHz domain
      
      o_int_ula          : out std_logic;                     -- 7 MHz pulse
      o_int_line         : out std_logic                      -- 7 MHz pulse
   );
end entity;

architecture rtl of zxula_timing is

   signal c_min_hblank         : unsigned(8 downto 0);
   signal c_min_hsync          : unsigned(8 downto 0);
   signal c_max_hsync          : unsigned(8 downto 0);
   signal c_max_hblank         : unsigned(8 downto 0);
   signal c_min_hactive        : unsigned(8 downto 0);
   signal c_max_hc             : unsigned(8 downto 0);
   
   signal c_min_vblank         : unsigned(8 downto 0);
   signal c_min_vsync          : unsigned(8 downto 0);
   signal c_max_vsync          : unsigned(8 downto 0);
   signal c_max_vblank         : unsigned(8 downto 0);
   signal c_min_vactive        : unsigned(8 downto 0);
   signal c_max_vc             : unsigned(8 downto 0);
   
   signal c_int_h              : unsigned(8 downto 0);
   signal c_int_v              : unsigned(8 downto 0);
   
   signal c_hdmi_xmin          : unsigned(8 downto 0);
   signal c_hdmi_xmax          : unsigned(8 downto 0);
   signal c_hdmi_ymin          : unsigned(8 downto 0);
   signal c_hdmi_ymax          : unsigned(8 downto 0);
   signal c_hdmi_ysync         : unsigned(8 downto 0);
   
   signal max_hc               : std_logic;
   signal max_vc               : std_logic;
   signal hc                   : unsigned(8 downto 0) := (others => '0');
   signal vc                   : unsigned(8 downto 0) := (others => '0');

   signal blank_n              : std_logic := '0';
   signal hsync_n              : std_logic := '1';
   signal vsync_n              : std_logic := '1';
   signal frame_sync           : std_logic := '0';
   signal hdmi_pixel_en        : std_logic := '0';
   signal hdmi_frame_lock      : std_logic := '0';
   
   signal ula_min_hactive      : unsigned(8 downto 0);
   signal ula_min_vactive      : std_logic;
   signal ula_max_hc           : std_logic;
   signal hc_ula               : unsigned(8 downto 0) := to_unsigned(256, 9);
   signal vc_ula               : unsigned(8 downto 0) := (others => '0');
   signal cvc                  : unsigned(8 downto 0) := (others => '0');
   
   signal wide_min_hactive     : unsigned(8 downto 0);
   signal wide_min_vactive     : unsigned(8 downto 0);
   signal wide_hactive         : std_logic;
   signal whc                  : unsigned(8 downto 0) := to_unsigned(320, 9);
   signal wvc                  : unsigned(8 downto 0) := (others => '0');
   
   signal phc                  : unsigned(8 downto 0) := to_unsigned(256, 9);
   
   signal whc_0_d              : std_logic := '0';
   signal sc                   : std_logic_vector(1 downto 0) := (others => '0');
   
   signal int_ula              : std_logic := '0';
   signal int_line             : std_logic := '0';
   signal int_line_num         : unsigned(8 downto 0) := (others => '0');
   
begin

   -- display dimensions

   process (i_timing, i_50_60)
   begin
   
      if i_timing(2) = '1' then
      
         -- Pentagon
         
         c_min_hblank  <= to_unsigned(0, 9);
         c_int_h       <= to_unsigned(448+3-12, 9); -- 3 (0)
         c_min_hsync   <= to_unsigned(16, 9);       -- displays don't like hsync = hblank
         c_max_hsync   <= to_unsigned(47, 9);
         c_max_hblank  <= to_unsigned(63, 9);
         c_min_hactive <= to_unsigned(128, 9);      -- 256x192 area
         c_max_hc      <= to_unsigned(447, 9);
         
         c_min_vblank  <= to_unsigned(0, 9);
         c_int_v       <= to_unsigned(319, 9);      -- (0)
         c_min_vsync   <= to_unsigned(1, 9);        -- displays don't like vsync = vblank
         c_max_vsync   <= to_unsigned(14, 9);
         c_max_vblank  <= to_unsigned(15, 9);
         c_min_vactive <= to_unsigned(80, 9);       -- 256x192 area
         c_max_vc      <= to_unsigned(319, 9);
         
         -- hdmi 360x288
         
         c_hdmi_xmin   <= to_unsigned(76, 9);
         c_hdmi_xmax   <= to_unsigned(435, 9);
         c_hdmi_ymin   <= to_unsigned(24, 9);
         c_hdmi_ymax   <= to_unsigned(311, 9);
         c_hdmi_ysync  <= to_unsigned(24+0, 9);
         
      elsif i_timing(1) = '1' then
      
         if i_50_60 = '0' then
         
            -- 128K 50 Hz
            
            c_min_hblank  <= to_unsigned(0, 9);
            
            if i_timing(0) = '0' then
               c_int_h    <= to_unsigned(136+4-12, 9);   -- 128K
            else
               c_int_h    <= to_unsigned(136+2-12, 9);   -- +3
            end if;
            
            c_min_hsync   <= to_unsigned(16, 9);
            c_max_hsync   <= to_unsigned(47, 9);
            c_max_hblank  <= to_unsigned(95, 9);
            c_min_hactive <= to_unsigned(136, 9);   -- 256x192 area
            c_max_hc      <= to_unsigned(455, 9);
         
            c_min_vblank  <= to_unsigned(0, 9);
            c_int_v       <= to_unsigned(1, 9);
            c_min_vsync   <= to_unsigned(1, 9);     -- displays don't like vsync = vblank
            c_max_vsync   <= to_unsigned(4, 9);
            c_max_vblank  <= to_unsigned(7, 9);
            c_min_vactive <= to_unsigned(64, 9);    -- 256x192 area
            c_max_vc      <= to_unsigned(310, 9);
         
            -- hdmi 360x288
         
            c_hdmi_xmin   <= to_unsigned(88, 9);
            c_hdmi_xmax   <= to_unsigned(447, 9);
            c_hdmi_ymin   <= to_unsigned(16, 9);
            c_hdmi_ymax   <= to_unsigned(303, 9);
            c_hdmi_ysync  <= to_unsigned(16+4, 9);
            
         else
         
            -- 128K 60 Hz
         
            c_min_hblank  <= to_unsigned(0, 9);
            
            if i_timing(0) = '0' then
               c_int_h    <= to_unsigned(136+4-12, 9);   -- 128K
            else
               c_int_h    <= to_unsigned(136+2-12, 9);   -- +3
            end if;
            
            c_min_hsync   <= to_unsigned(16, 9);
            c_max_hsync   <= to_unsigned(47, 9);
            c_max_hblank  <= to_unsigned(95, 9);
            c_min_hactive <= to_unsigned(136, 9);   -- 256x192 area
            c_max_hc      <= to_unsigned(455, 9);
         
            c_min_vblank  <= to_unsigned(0, 9);
            c_int_v       <= to_unsigned(0, 9);
            c_min_vsync   <= to_unsigned(1, 9);     -- displays don't like vsync = vblank
            c_max_vsync   <= to_unsigned(4, 9);
            c_max_vblank  <= to_unsigned(7, 9);
            c_min_vactive <= to_unsigned(40, 9);    -- 256x192 area
            c_max_vc      <= to_unsigned(263, 9);
            
            -- hdmi 360x240
         
            c_hdmi_xmin   <= to_unsigned(88, 9);
            c_hdmi_xmax   <= to_unsigned(447, 9);
            c_hdmi_ymin   <= to_unsigned(16, 9);
            c_hdmi_ymax   <= to_unsigned(255, 9);
            c_hdmi_ysync  <= to_unsigned(16+0, 9);
            
         end if;

      else

         if i_50_60 = '0' then
         
            -- 48K 50 Hz
            
            c_min_hblank  <= to_unsigned(0, 9);
            c_int_h       <= to_unsigned(128+0-12, 9);
            c_min_hsync   <= to_unsigned(16, 9);
            c_max_hsync   <= to_unsigned(47, 9);
            c_max_hblank  <= to_unsigned(95, 9);
            c_min_hactive <= to_unsigned(128, 9);   -- 256x192 area
            c_max_hc      <= to_unsigned(447, 9);
         
            c_min_vblank  <= to_unsigned(0, 9);
            c_int_v       <= to_unsigned(0, 9);
            c_min_vsync   <= to_unsigned(1, 9);     -- displays don't like vsync = vblank
            c_max_vsync   <= to_unsigned(4, 9);
            c_max_vblank  <= to_unsigned(7, 9);
            c_min_vactive <= to_unsigned(64, 9);    -- 256x192 area
            c_max_vc      <= to_unsigned(311, 9);
         
            -- hdmi 360x288
         
            c_hdmi_xmin   <= to_unsigned(80, 9);
            c_hdmi_xmax   <= to_unsigned(439, 9);
            c_hdmi_ymin   <= to_unsigned(16, 9);
            c_hdmi_ymax   <= to_unsigned(303, 9);
            c_hdmi_ysync  <= to_unsigned(16+4, 9);
         
         else
         
            -- 48K 60 Hz

            c_min_hblank  <= to_unsigned(0, 9);
            c_int_h       <= to_unsigned(128+0-12, 9);
            c_min_hsync   <= to_unsigned(16, 9);
            c_max_hsync   <= to_unsigned(47, 9);
            c_max_hblank  <= to_unsigned(95, 9);
            c_min_hactive <= to_unsigned(128, 9);   -- 256x192 area
            c_max_hc      <= to_unsigned(447, 9);
         
            c_min_vblank  <= to_unsigned(0, 9);
            c_int_v       <= to_unsigned(0, 9);
            c_min_vsync   <= to_unsigned(1, 9);     -- displays don't like vsync = vblank
            c_max_vsync   <= to_unsigned(4, 9);
            c_max_vblank  <= to_unsigned(7, 9);
            c_min_vactive <= to_unsigned(40, 9);    -- 256x192 area
            c_max_vc      <= to_unsigned(263, 9);
         
            -- hdmi 360x240
            
            c_hdmi_xmin   <= to_unsigned(80, 9);
            c_hdmi_xmax   <= to_unsigned(439, 9);
            c_hdmi_ymin   <= to_unsigned(16, 9);
            c_hdmi_ymax   <= to_unsigned(255, 9);
            c_hdmi_ysync  <= to_unsigned(16+0, 9);
            
         end if;
         
      end if;

   end process;

   -- frame counter
   
   max_hc <= '1' when hc = c_max_hc else '0';
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if max_hc = '1' then
            hc <= (others => '0');
         else
            hc <= hc + 1;
         end if;
      end if;
   end process;
   
   max_vc <= '1' when vc = c_max_vc else '0';
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if max_hc = '1' then
            if max_vc = '1' then
               vc <= (others => '0');
            else
               vc <= vc + 1;
            end if;
         end if;
      end if;
   end process;
   
   -- EVERYTHING BELOW DELAYED ONE PIXEL FROM FRAME COUNTER
   
   -- frame signals

   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if (hc <= c_max_hblank) or (vc <= c_max_vblank) then
            blank_n <= '0';
         else
            blank_n <= '1';
         end if;
      end if;
   end process;
   
   o_blank_n <= blank_n;

   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if (hc >= c_min_hsync) and (hc <= c_max_hsync) then
            hsync_n <= '0';
         else
            hsync_n <= '1';
         end if;
         if (vc >= c_min_vsync) and (vc <= c_max_vsync) then
            vsync_n <= '0';
         else
            vsync_n <= '1';
         end if;
      end if;
   end process;
   
   o_hsync_n <= hsync_n;
   o_vsync_n <= vsync_n;
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if (max_hc = '1') and (max_vc = '1') then
            frame_sync <= '1';
         else
            frame_sync <= '0';
         end if;
      end if;
   end process;
   
   o_frame_sync <= frame_sync;
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if (hc >= c_hdmi_xmin) and (hc <= c_hdmi_xmax) and (vc >= c_hdmi_ymin) and (vc <= c_hdmi_ymax) then
            hdmi_pixel_en <= '1';
         else
            hdmi_pixel_en <= '0';
         end if;
      end if;
   end process;
   
   o_hdmi_pixel_en <= hdmi_pixel_en;
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if (vc = c_hdmi_ysync) and (max_hc = '1') then
            hdmi_frame_lock <= '1';
         else
            hdmi_frame_lock <= '0';
         end if;
      end if;
   end process;
   
   o_hdmi_frame_lock <= hdmi_frame_lock;

   -- pixel counters
   
   -- ula

   ula_min_hactive <= c_min_hactive - 12;
   ula_max_hc <= '1' when hc = ula_min_hactive else '0';
   ula_min_vactive <= '1' when vc = c_min_vactive else '0';
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if ula_max_hc = '1' then
            hc_ula <= (others => '0');
         else
            hc_ula <= hc_ula + 1;
         end if;
      end if;
   end process;
   
   o_hc_ula <= hc_ula;
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if ula_max_hc = '1' then
            if ula_min_vactive = '1' then
               vc_ula <= (others => '0');
            else
               vc_ula <= vc_ula + 1;
            end if;
         end if;
      end if;
   end process;

   o_vc_ula <= vc_ula;
   
   -- copper offset vertical counter
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if ula_max_hc = '1' then
            if ula_min_vactive = '1' then
               cvc <= unsigned ('0' & i_cu_offset);
            elsif cvc = c_max_vc then
               cvc <= (others => '0');
            else
               cvc <= cvc + 1;
            end if;
         end if;
      end if;
   end process;
   
   o_vc_cu <= cvc;
   
   -- practical wide counters for 320x256 surface
   
   wide_min_hactive <= c_min_hactive - 32 - 16;
   wide_min_vactive <= c_min_vactive - 32 - 2;
   
   wide_hactive <= '1' when hc = wide_min_hactive else '0';
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if wide_hactive = '1' then
            whc <= "111110000";   -- start at -16
         else
            whc <= whc + 1;
         end if;
      end if;
   end process;
   
   o_whc <= whc;
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if wide_hactive = '1' then
            if vc = wide_min_vactive then
               wvc <= "111111110";   -- start at -2
            else
               wvc <= wvc + 1;
            end if;
         end if;
      end if;
   end process;

   o_wvc <= wvc;

   -- practical counter for 256x192 surface
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if wide_hactive = '1' then
            phc <= "111010000";   -- start at -48
         else
            phc <= phc + 1;
         end if;
      end if;
   end process;
   
   o_phc <= phc;

   -- 28 MHz sub-pixel counter

   process (i_CLK_28)
   begin
      if rising_edge(i_CLK_28) then
         whc_0_d <= whc(0);
      end if;
   end process;
   
   process (i_CLK_28)
   begin
      if rising_edge(i_CLK_28) then
         if whc(0) /= whc_0_d then
            sc <= "01";
         else
            sc <= sc + 1;
         end if;
      end if;
   end process;
   
   o_sc <= sc;

   -- interrupts
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if (i_inten_ula_n = '0') and (hc = c_int_h) and (vc = c_int_v) then
            int_ula <= '1';
         else
            int_ula <= '0';
         end if;
      end if;
   end process;
   
   o_int_ula <= int_ula;

   -- semantics for line interrupt is that it occurs before the line is drawn
   
   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if i_int_line = 0 then
            int_line_num <= c_max_vc;
         else
            int_line_num <= unsigned(i_int_line) - 1;
         end if;
      end if;
   end process;

   process (i_CLK_7)
   begin
      if rising_edge(i_CLK_7) then
         if (i_inten_line = '1') and (hc_ula = 255) and (cvc = int_line_num) then
            int_line <= '1';
         else
            int_line <= '0';
         end if;
      end if;
   end process;
   
   o_int_line <= int_line;
      
end architecture;
