-- (c) 2012 d18c7db(a)hotmail
--
-- This program is free software; you can redistribute it and/or modify it under
-- the terms of the GNU General Public License version 3 or, at your option,
-- any later version as published by the Free Software Foundation.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
--
-- For full details, see the GNU General Public License at www.gnu.org/licenses

-- Adapted for TBBLUE and the ZX Spectrum Next Project
-- (2017) by Victor Trucco & Fabio Belavenuto
-- <https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA/tree/master/cores>

--------------------------------------------------------------------------------
-- Video scan converter
--
-- Horizonal Timing
-- _____________              ______________________              _____________________
-- VIDEO (last) |____________|         VIDEO        |____________|         VIDEO (next)
-- -hD----------|-hA-|hB|-hC-|----------hD----------|-hA-|hB|-hC-|----------hD---------
-- __________________|  |________________________________|  |__________________________
-- HSYNC             |__|              HSYNC             |__|              HSYNC

-- Vertical Timing
-- _____________              ______________________              _____________________
-- VIDEO (last)||____________||||||||||VIDEO|||||||||____________||||||||||VIDEO (next)
-- -vD----------|-vA-|vB|-vC-|----------vD----------|-vA-|vB|-vC-|----------vD---------
-- __________________|  |________________________________|  |__________________________
-- VSYNC             |__|              VSYNC             |__|              VSYNC

-- Scan converter input and output timings compared to standard VGA
-- Resolution   - Frame   | Pixel      | Front     | HSYNC      | Back       | Active      | HSYNC    | Front    | VSYNC    | Back     | Active    | VSYNC
--              - Rate    | Clock      | Porch hA  | Pulse hB   | Porch hC   | Video hD    | Polarity | Porch vA | Pulse vB | Porch vC | Video vD  | Polarity
-------------------------------------------------------------------------------------------------------------------------------------------------------------
--  In  256x224 - 59.18Hz |  6.000 MHz | 38 pixels |  32 pixels |  58 pixels |  256 pixels | negative | 16 lines | 8 lines  | 16 lines | 224 lines | negative
--  Out 640x480 - 59.18Hz | 24.000 MHz |  2 pixels |  92 pixels |  34 pixels |  640 pixels | negative | 17 lines | 2 lines  | 29 lines | 480 lines | negative
--  VGA 640x480 - 59.94Hz | 25.175 MHz | 16 pixels |  96 pixels |  48 pixels |  640 pixels | negative | 10 lines | 2 lines  | 33 lines | 480 lines | negative

library ieee;
use ieee.std_logic_1164.all;
use ieee.std_logic_unsigned.all;
use ieee.numeric_std.all;

entity scan_convert is
   generic 
   (
      cstart      : integer range 0 to 2047 := 144;   -- composite sync start
      clength     : integer range 0 to 2047 := 640;   -- composite sync length

      hB          : integer range 0 to 2047 :=  96;   -- h sync
      hC          : integer range 0 to 2047 :=  48;   -- h back porch
      hD          : integer range 0 to 2047 := 640;   -- visible video

--    vA          : integer range 0 to 2047 :=  16;   -- v front porch
      vB          : integer range 0 to 2047 :=   2;   -- v sync
      vC          : integer range 0 to 2047 :=  33;   -- v back porch
      vD          : integer range 0 to 2047 := 480;   -- visible video

      hpad        : integer range 0 to 2047 :=   0;   -- H black border
      vpad        : integer range 0 to 2047 :=   0    -- V black border
   );
   port 
   (
      CLK         : in  std_logic;
      CLK_x2      : in  std_logic;
      --
      hA          : integer range 0 to 2047 :=  16;   -- h front porch
      I_VIDEO     : in  std_logic_vector(8 downto 0);
      I_HSYNC     : in  std_logic;
      I_VSYNC     : in  std_logic;
      I_SCANLIN   : in  std_logic_vector(1 downto 0);
      I_BLANK_N   : in  std_logic;
      --
      O_VIDEO_15  : out std_logic_vector(8 downto 0);
      O_VIDEO_31  : out std_logic_vector(8 downto 0);
      O_HSYNC     : out std_logic;
      O_VSYNC     : out std_logic;
      O_BLANK     : out std_logic   
   );
   
end;

architecture RTL of scan_convert is
   --
   -- input timing
   --
   
   signal ivsync_last_x2   : std_logic := '1';
   signal ihsync_last      : std_logic := '1';
   signal hpos_i        : std_logic_vector(10 downto 0) := (others => '0');

   --
   -- output timing
   --
   signal hpos_o        : std_logic_vector(10 downto 0) := (others => '0');

   signal vcnt          : integer range 0 to 2047 := 0;
   signal hcnt          : integer range 0 to 2047 := 0;
   signal hcnti         : integer range 0 to 2047 := 0;

   -- video
   signal impar_15      : std_logic                      := '0';
   signal impar_31      : std_logic                      := '0';
   signal video_31_s    : std_logic_vector(8 downto 0);
   
   signal blank_s       : std_logic;

   signal rgb_r_25      : std_logic_vector(3 downto 0);
   signal rgb_g_25      : std_logic_vector(3 downto 0);
   signal rgb_b_25      : std_logic_vector(3 downto 0);
   signal rgb_r_12      : std_logic_vector(3 downto 0);
   signal rgb_g_12      : std_logic_vector(3 downto 0);
   signal rgb_b_12      : std_logic_vector(3 downto 0);

begin
   -- dual port line buffer, max line of 1024 pixels
   u_run : entity work.dpram2
   generic map 
   (
      addr_width_g   => 11,
      data_width_g   => 9
   )
   port map 
   (
      clk_a_i     => CLK,
      addr_a_i    => hpos_i,
      data_a_i    => I_VIDEO,
      we_i        => '1',
      --
      clk_b_i     => CLK_x2,
      addr_b_i    => hpos_o,
      data_b_o    => video_31_s
   );
   
   -- Scanlines
   
   rgb_r_25 <= std_logic_vector(unsigned('0' & video_31_s(8 downto 6)) + unsigned("00" & video_31_s(8 downto 7)));
   rgb_g_25 <= std_logic_vector(unsigned('0' & video_31_s(5 downto 3)) + unsigned("00" & video_31_s(5 downto 4)));
   rgb_b_25 <= std_logic_vector(unsigned('0' & video_31_s(2 downto 0)) + unsigned("00" & video_31_s(2 downto 1)));
   
   rgb_r_12 <= std_logic_vector(unsigned(rgb_r_25) + unsigned("000" & video_31_s(8 downto 8)));
   rgb_g_12 <= std_logic_vector(unsigned(rgb_g_25) + unsigned("000" & video_31_s(5 downto 5)));
   rgb_b_12 <= std_logic_vector(unsigned(rgb_b_25) + unsigned("000" & video_31_s(2 downto 2)));

    process (CLK_X2)
    begin
        if rising_edge(CLK_X2) then

            if blank_s = '0' then
            
                O_VIDEO_31 <= video_31_s;
                
                if impar_31 = '1' then
                
                     if I_SCANLIN = "01" then -- 50%
                        O_VIDEO_31 <= '0' & video_31_s(8 downto 7) & '0' & video_31_s(5 downto 4) & '0' & video_31_s(2 downto 1);
                     elsif I_SCANLIN = "10" then -- 25%
                        O_VIDEO_31 <= rgb_r_25(3 downto 1) & rgb_g_25(3 downto 1) & rgb_b_25(3 downto 1);
                     elsif I_SCANLIN = "11" then -- 12.5%
                        O_VIDEO_31 <= rgb_r_12(3 downto 1) & rgb_g_12(3 downto 1) & rgb_b_12(3 downto 1);
                     end if;
                     
                end if;
                
            else
                O_VIDEO_31 <= (others=>'0');
                
            end if;
            
        end if;
    end process;

   process (CLK)
      variable r_v : unsigned(2 downto 0);
      variable g_v : unsigned(2 downto 0);
      variable b_v : unsigned(2 downto 0);
   begin
      if rising_edge(CLK) then
         r_v := unsigned(I_VIDEO(8 downto 6));
         g_v := unsigned(I_VIDEO(5 downto 3));
         b_v := unsigned(I_VIDEO(2 downto 0));
         if impar_15 = '1' and I_SCANLIN /= "00" then
            if unsigned(I_VIDEO(8 downto 6)) > 0 then r_v := unsigned(I_VIDEO(8 downto 6)) - 1; end if;
            if unsigned(I_VIDEO(5 downto 3)) > 0 then g_v := unsigned(I_VIDEO(5 downto 3)) - 1; end if;
            if unsigned(I_VIDEO(2 downto 0)) > 0 then b_v := unsigned(I_VIDEO(2 downto 0)) - 1; end if;
         end if;
         if I_BLANK_N = '1' then
            O_VIDEO_15 <= std_logic_vector(r_v & g_v & b_v);
         else
            O_VIDEO_15 <= (others=>'0');
         end if;
      end if;
   end process;

   -- horizontal counter for input video
   p_hcounter : process (CLK, I_HSYNC, ihsync_last, hcnti)
   begin
      if rising_edge(CLK) then--CLK'event and CLK = '0' then
         ihsync_last <= I_HSYNC;
         -- trigger off rising hsync
         if I_HSYNC = '1' and ihsync_last = '0' then
            hcnti <= 0;
            impar_15 <= not impar_15 and I_VSYNC;
         else
            hcnti <= hcnti + 1;
         end if;
      end if;
   end process;

   -- increment write position during active video
   p_ram_in : process (CLK, hcnti)
   begin
      if rising_edge(CLK) then--(CLK'event and CLK = '0') then
         if (hcnti < cstart) or (hcnti >= (cstart + clength)) then
            hpos_i <= (others => '0');
         else
            hpos_i <= hpos_i + 1;
         end if;
      end if;
   end process;

   -- VGA H and V counters, synchronized to input frame V sync, then H sync
   p_out_ctrs : process (CLK_x2, I_VSYNC, ivsync_last_x2, hcnt)
      variable trigger : boolean;
   begin
      if CLK_x2'event and CLK_x2 = '1' then
         ivsync_last_x2 <= I_VSYNC;
         if (I_VSYNC = '0') and (ivsync_last_x2 = '1') then
            trigger := true;
         elsif trigger and I_HSYNC = '0' then
            trigger := false;
            hcnt <= 0;
            vcnt <= 0;
            impar_31 <= '0';
         else
            hcnt <= hcnt + 1;
            if hcnt = (hA+hB+hC+hD+hpad+hpad-1) then
               hcnt <= 0;
               vcnt <= vcnt + 1;
               impar_31 <= not impar_31;
            end if;
         end if;
      end if;
   end process;
   
   -- generate hsync
   p_gen_hsync : process (CLK_x2)
   begin
      if CLK_x2'event and CLK_x2 = '1' then
      -- H sync timing
         if (hcnt < hB) then
            O_HSYNC <= '0';
         else
            O_HSYNC <= '1';
         end if;
      end if;
   end process;

   -- generate vsync
   p_gen_vsync : process (CLK_x2)
   begin
      if CLK_x2'event and CLK_x2 = '1' then
      -- V sync timing
         if (vcnt < vB) then
            O_VSYNC <= '0';
         else
            O_VSYNC <= '1';
         end if;
      end if;
   end process;

   -- generate active output video
   p_gen_active_vid : process (CLK_x2)
   begin
      if CLK_x2'event and CLK_x2 = '1' then
         -- visible video area doubled from the original game
         if ((hcnt >= (hB + hC + hpad)) and (hcnt < (hB + hC + hD + hpad))) and ((vcnt > 2*(vB + vC + vpad)) and (vcnt <= 2*(vB + vC + vD + vpad))) then
            hpos_o <= hpos_o + 1;
         else
            hpos_o <= (others => '0');
         end if;
      end if;
   end process;
   
   -- generate blanking signal including additional borders to pad the input signal to standard VGA resolution
   p_gen_blank : process (CLK_x2)
   begin
      if CLK_x2'event and CLK_x2 = '1' then
         -- active video area 640x480 (VGA) after padding with blank borders
         if ((hcnt >= (hB + hC)) and (hcnt < (hB + hC + hD + 2*hpad))) and ((vcnt > 2*(vB + vC)) and (vcnt <= 2*(vB + vC + vD + 2*vpad))) then
            blank_s <= '0';
         else
            blank_s <= '1';
         end if;
      end if;
   end process;
   
   O_BLANK <= blank_s;

end architecture RTL;
