
-- ZX Spectrum Next Tilemap Display
-- Copyright 2020 Alvin Albrecht
--
-- Ideas - Spectrum Next Team
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

-- Currently the hi-res pixel fetch requires 26/32 cycles at 28MHz to accommodate
-- a scrolling screen but this can be improved to 23 cycles. -- AA

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use ieee.std_logic_unsigned.all;

entity tilemap is
   port (
      reset_i              : in std_logic;
      
      clock_master_i       : in std_logic;            -- 28MHz synchronized with 7MHz pixel clock
      clock_master_180o_i  : in std_logic;            -- 28MHz inverted
      
      hcounter_i           : in unsigned(8 downto 0);  -- sprite counter 0-319 visible area
      vcounter_i           : in unsigned(8 downto 0);  -- sprite counter 0-255 visible area
      subpixel_i           : in std_logic_vector(1 downto 0);  -- 28MHz subpixel count
      
      control_i            : in std_logic_vector(6 downto 0);
      default_flags_i      : in std_logic_vector(7 downto 0);  -- default flags if tilemap flags are eliminated
      transp_colour_i      : in std_logic_vector(3 downto 0);
      
      -- ULA Memory Interface
      
      tm_mem_bank7_o       : out std_logic;
      tm_mem_addr_o        : out std_logic_vector(13 downto 0);
      tm_mem_rd_o          : out std_logic;
      tm_mem_ack_i         : in std_logic;
      tm_mem_data_i        : in std_logic_vector(7 downto 0);
   
      -- Memory Map
      
      tm_map_base_i        : in std_logic_vector(6 downto 0);   -- bit 6 is bank selector, 5:0 are offsets into 16K
      tm_tile_base_i       : in std_logic_vector(6 downto 0);   -- bit 6 is bank selector, 5:0 are offsets into 16K

      -- Out
      
      pixel_o              : out std_logic_vector(7 downto 0);  -- tilemap pixel
      pixel_en_o           : out std_logic;                     -- tilemap pixel is valid
      pixel_below_o        : out std_logic;                     -- tilemap pixel should cover ula pixel
      pixel_textmode_o     : out std_logic;                     -- tilemap pixel is a textmode pixel
      
      -- Scroll
      
      tm_scroll_x_i        : in std_logic_vector(9 downto 0);
      tm_scroll_y_i        : in std_logic_vector(7 downto 0);
      
      -- Clip Window
      
      clip_x1_i            : in unsigned(7 downto 0);
      clip_x2_i            : in unsigned(7 downto 0);
      clip_y1_i            : in unsigned(7 downto 0);
      clip_y2_i            : in unsigned(7 downto 0)
   );
end entity;

architecture rtl of tilemap is

   -- coregen
   
   component sdpram_16_9 is
   port (
      DPRA                    : IN  STD_LOGIC_VECTOR(4-1 downto 0) := (OTHERS => '0');
      CLK                     : IN STD_LOGIC;
      WE                      : IN  STD_LOGIC;
      DPO                     : OUT STD_LOGIC_VECTOR(9-1 downto 0);
      A                       : IN  STD_LOGIC_VECTOR(4-1-(4*0*boolean'pos(4>4)) downto 0) := (OTHERS => '0');
      D                       : IN  STD_LOGIC_VECTOR(9-1 downto 0) := (OTHERS => '0')
   );
   end component;
   
   --

   signal mode_i              : std_logic;  -- 1 = 80x32, 0 = 40x32
   signal strip_flags_i       : std_logic;  -- 1 = eliminate flags from tilemap
   signal textmode_i          : std_logic;  -- 1 = extend palette offset to 7 bits at expense of rotations and mirrors
-- signal reduced_tm_i        : std_logic;  -- 1 = tilemap area reduced to 64x24 / 32x24
-- signal split_addr_i        : std_logic;  -- 1 = tilemap flags and tiles split between two 8k halves
   signal mode_512_i          : std_logic;  -- 1 = 512 tile mode
   signal tm_on_top_i         : std_logic;  -- 1 = tilemap is always on top
   
   signal tm_mem_fetch        : std_logic;
   signal tm_pixel_half_wr    : std_logic;
   signal tm_pixel_half_rd    : std_logic;
   signal tm_mode             : std_logic;
   signal hcount              : std_logic_vector(10 downto 0);
   signal hcount_eff          : std_logic_vector(9 downto 0);
   signal hcount_effsub       : std_logic_vector(9 downto 0);
   signal tm_mem_ack_d        : std_logic;

   -- tilemap pixel loader
   
   type   state_t             is (S_IDLE, S_READ_TILE_0, S_READ_TILE_1, S_READ_PIXELS);
   signal state_s             : state_t;
   signal next_state_s        : state_t;
   
   signal tm_abs_x            : std_logic_vector(9 downto 0);
   signal tm_abs_y            : std_logic_vector(11 downto 0);
   signal tm_pixel            : std_logic_vector(2 downto 0);
   signal tm_tilemap_0        : std_logic_vector(7 downto 0);
   signal tm_tilemap_1        : std_logic_vector(7 downto 0);
   signal tm_tile_base_q      : std_logic_vector(6 downto 0);
   signal tm_map_base_q       : std_logic_vector(6 downto 0);
   signal tm_strip_flags_q    : std_logic;
   signal textmode_q          : std_logic;
   signal mode_512_q          : std_logic;
   signal tm_on_top_q         : std_logic;
   signal textmode_0          : std_logic;
   signal textmode_1          : std_logic;
   
   signal tm_next_pixel       : std_logic_vector(2 downto 0);
   
   signal tm_x_addend_0       : std_logic_vector(9 downto 0);
   signal tm_x_addend_1       : std_logic_vector(9 downto 0);
   signal tm_x_sum            : std_logic_vector(10 downto 0);
   signal tm_x_correction     : std_logic_vector(3 downto 0);
   signal tm_next_abs_x       : std_logic_vector(9 downto 0);
   
   signal tm_abs_y_s          : std_logic_vector(7 downto 0);
   signal tm_abs_y_mult_sub   : std_logic_vector(7 downto 0);
   signal tm_abs_y_mult       : std_logic_vector(8 downto 0);
   
   signal tm_effective_x_mirror     : std_logic;
   signal tm_effective_x      : std_logic_vector(2 downto 0);
   signal tm_effective_y      : std_logic_vector(2 downto 0);
   signal tm_transformed_x    : std_logic_vector(2 downto 0);
   signal tm_transformed_y    : std_logic_vector(2 downto 0);
   
   signal tm_tilemap_pixel_waddr    : std_logic_vector(3 downto 0);
   signal tm_tilemap_pixel_we       : std_logic;
   signal tm_tilemap_pixel_data_standard        : std_logic_vector(7 downto 0);
   signal tm_tilemap_pixel_data_textmode_shift  : std_logic_vector(7 downto 0);
   signal tm_tilemap_pixel_data_textmode        : std_logic_vector(7 downto 0);
   signal tm_tilemap_pixel_wdata    : std_logic_vector(8 downto 0);
   
   signal tm_mem_addr_pix_sub_sub   : std_logic_vector(8 downto 0);
   signal tm_mem_addr_pix_sub       : std_logic_vector(13 downto 0);
   signal tm_mem_addr_tile_sub      : std_logic_vector(13 downto 0);
   signal tm_mem_addr_tile_sub_sub  : std_logic_vector(11 downto 0);
   signal tm_mem_addr_sub           : std_logic_vector(13 downto 0);
   signal tm_mem_addr_offset        : std_logic_vector(6 downto 0);

   -- VIDEO OUT
   
   signal video_addr          : std_logic_vector(3 downto 0);
   signal video_data          : std_logic_vector(8 downto 0);
   
   signal xsv                 : unsigned(8 downto 0);
   signal xev                 : unsigned(8 downto 0);
   signal ysv                 : unsigned(7 downto 0);
   signal yev                 : unsigned(7 downto 0);

   signal pixel_en_s          : std_logic;
   signal pixel_en_f          : std_logic;
   signal pixel_textmode_s    : std_logic;
   signal pixel_en_standard_s : std_logic;
   signal video_data_q        : std_logic_vector(10 downto 0);
   
begin

   --------------------------
   -- TILEMAP CONTROL ALIASES
   --------------------------

   mode_i <= control_i(6);          -- 0 = 40x32, 1 = 80x32
   strip_flags_i <= control_i(5);   -- 1 = eliminate tilemap flags
   textmode_i <= control_i(3);      -- 1 = extend palette offset to 7 bits at expense of rotations and mirrors
-- reduced_tm_i <= control_i(3);    -- 1 = select reduced tilemap area (32x24 or 64x24) NOT IMPLEMENTED
-- split_addr_i <= control_i(2);    -- 1 = select split addressing NOT IMPLEMENTED
   mode_512_i <= control_i(1);      -- 1 = select 512 tile mode
   tm_on_top_i <= control_i(0);     -- 1 = tilemap always on top of ula

   -----------------------
   -- TILEMAP PIXEL MEMORY
   -----------------------
   
   tilemem : sdpram_16_9
   port map (
      DPRA  => video_addr,
      CLK   => clock_master_i,
      WE    => tm_tilemap_pixel_we,
      DPO   => video_data,
      A     => tm_tilemap_pixel_waddr,
      D     => tm_tilemap_pixel_wdata
   );

   -------------
   -- SCHEDULING
   -------------

   hcount <= std_logic_vector(hcounter_i(8 downto 0)) & subpixel_i;

   process (clock_master_i)
   begin
      if rising_edge(clock_master_i) then
         if reset_i = '1' then
            tm_mode <= '0';
         elsif hcount(4 downto 0) = "11111" then
            tm_mode <= mode_i;
         end if;
      end if;
   end process;
   
   hcount_effsub <= hcount(10 downto 1) when tm_mode = '1' else ((hcount(10) and hcount(9)) & hcount(10 downto 2));  -- sign extend
   hcount_eff <= (hcount_effsub(9 downto 3) + 1) & hcount_effsub(2 downto 0);  -- one character ahead
   
   tm_mem_fetch <= '1' when hcount_eff(2 downto 0) = "000" else '0';
   
   process (clock_master_i)
   begin
      if rising_edge(clock_master_i) then
         if reset_i = '1' then
            tm_pixel_half_wr <= '0';
         elsif hcount_eff(2 downto 0) = "111" and hcount(1 downto 0) = "11" then
            tm_pixel_half_wr <= not tm_pixel_half_wr;
         end if;
      end if;
   end process;

   tm_pixel_half_rd <= not tm_pixel_half_wr;
   
   process (clock_master_180o_i)
   begin
      if rising_edge(clock_master_180o_i) then
         tm_mem_ack_d <= tm_mem_ack_i;
      end if;
   end process;
   
   -----------------------
   -- TILEMAP PIXEL LOADER
   -----------------------

   -- state

   process (clock_master_i)
   begin
      if rising_edge(clock_master_i) then
         if reset_i = '1' then
            state_s <= S_IDLE;
         elsif hcount_eff(2 downto 0) = "111" and hcount(1 downto 0) = "11" then
            state_s <= S_IDLE;
         else
            state_s <= next_state_s;
         end if;
      end if;
   end process;

   -- next state combinatorial

   process (state_s, tm_mem_fetch, tm_mem_ack_d, tm_next_pixel, tm_abs_x, tm_next_abs_x)
   begin
      case state_s is
         when S_IDLE        =>   if tm_mem_fetch = '1' then
                                    next_state_s <= S_READ_TILE_0;
                                 else
                                    next_state_s <= S_IDLE;
                                 end if;
         when S_READ_TILE_0 =>   if tm_mem_ack_d = '1' then
                                    next_state_s <= S_READ_TILE_1;
                                 else
                                    next_state_s <= S_READ_TILE_0;
                                 end if;
         when S_READ_TILE_1 =>   if tm_mem_ack_d = '1' then
                                    next_state_s <= S_READ_PIXELS;
                                 else
                                    next_state_s <= S_READ_TILE_1;
                                 end if;
         when S_READ_PIXELS =>   if tm_mem_ack_d = '0' then
                                    next_state_s <= S_READ_PIXELS;
                                 elsif tm_next_pixel = "000" then
                                    next_state_s <= S_IDLE;
                                 elsif tm_next_abs_x(3) /= tm_abs_x(3) then
                                    next_state_s <= S_READ_TILE_0;
                                 else
                                    next_state_s <= S_READ_PIXELS;
                                 end if;
         when others        =>   next_state_s <= S_IDLE;
      end case;
   end process;

   -- state machine variables

   tm_next_pixel <= tm_pixel + 1;

   tm_x_addend_0 <= tm_scroll_x_i when state_s = S_IDLE else tm_abs_x;
   tm_x_addend_1 <= hcount_eff when state_s = S_IDLE else "0000000001";
   tm_x_sum <= ('0' & tm_x_addend_0) + ('0' & tm_x_addend_1);
   tm_x_correction <= "1100" when tm_x_sum >= 1280 else
                      "0001" when tm_x_sum >= 960 and tm_mode = '0' else
                      "0110" when tm_x_sum >= 640 else
                      "1011" when tm_x_sum >= 320 and tm_mode = '0' else
                      "0000";
   tm_next_abs_x(9 downto 6) <= tm_x_sum(9 downto 6) + tm_x_correction;
   tm_next_abs_x(5 downto 0) <= tm_x_sum(5 downto 0);

   tm_effective_x_mirror <= tm_tilemap_1(3) xor tm_tilemap_1(1);                                            -- rotation inverts x mirror
   tm_effective_x <= tm_abs_x(2 downto 0) when tm_effective_x_mirror = '0' else not (tm_abs_x(2 downto 0)); -- x mirror inverts x coord
   tm_effective_y <= tm_abs_y(2 downto 0) when tm_tilemap_1(2) = '0' else not (tm_abs_y(2 downto 0));       -- y mirror inverts y coord
   tm_transformed_x <= tm_effective_x when tm_tilemap_1(1) = '0' else tm_effective_y;                       -- rotation exchanges x and y
   tm_transformed_y <= tm_effective_y when tm_tilemap_1(1) = '0' else tm_effective_x;

   tm_abs_y_s <= tm_scroll_y_i + std_logic_vector(vcounter_i(7 downto 0));
   tm_abs_y_mult_sub <= ('0' & tm_abs_y_s(7 downto 3) & "00") + ("000" & tm_abs_y_s(7 downto 3));  -- * 5
   tm_abs_y_mult <= '0' & tm_abs_y_mult_sub when tm_mode = '0' else tm_abs_y_mult_sub & '0';

   process (clock_master_i)
   begin
      if rising_edge(clock_master_i) then
         if reset_i = '1' then
            tm_abs_x <= (others => '0');
            tm_abs_y <= (others => '0');
            tm_pixel <= (others => '0');
            tm_tilemap_0 <= (others => '0');
            tm_tilemap_1 <= (others => '0');
            tm_map_base_q <= (others => '0');
            tm_tile_base_q <= (others => '0');
            tm_strip_flags_q <= '0';
            textmode_q <= '0';
            mode_512_q <= '0';
            tm_on_top_q <= '0';
         elsif state_s = S_IDLE then
            tm_abs_x <= tm_next_abs_x;
            tm_abs_y <= tm_abs_y_mult & tm_abs_y_s(2 downto 0);
            tm_pixel <= (others => '0');
            tm_map_base_q <= tm_map_base_i;
            tm_tile_base_q <= tm_tile_base_i;
            tm_strip_flags_q <= strip_flags_i;
            textmode_q <= textmode_i;
            mode_512_q <= mode_512_i;
            tm_on_top_q <= tm_on_top_i;
         elsif state_s = S_READ_TILE_0 then
            tm_tilemap_0 <= tm_mem_data_i;
            if tm_pixel_half_wr = '0' then
               textmode_0 <= textmode_q;
            else
               textmode_1 <= textmode_q;
            end if;
         elsif state_s = S_READ_TILE_1 then
            if tm_strip_flags_q = '0' then
               tm_tilemap_1 <= tm_mem_data_i;
            else
               tm_tilemap_1 <= default_flags_i;
            end if;
         elsif state_s = S_READ_PIXELS then
            if tm_mem_ack_d = '1' then
               tm_pixel <= tm_next_pixel;
               tm_abs_x <= tm_next_abs_x;
            end if;
         end if;
      end if;
   end process;

   -- write pixel data to local memory
   
   tm_tilemap_pixel_waddr <= tm_pixel_half_wr & tm_pixel;
   tm_tilemap_pixel_we <= '1' when state_s = S_READ_PIXELS else '0';
   
   tm_tilemap_pixel_data_standard(7 downto 4) <= tm_tilemap_1(7 downto 4);
   tm_tilemap_pixel_data_standard(3 downto 0) <= tm_mem_data_i(7 downto 4) when tm_transformed_x(0) = '0' else tm_mem_data_i(3 downto 0);
   
   tm_tilemap_pixel_data_textmode_shift <= std_logic_vector(shift_left(unsigned(tm_mem_data_i), to_integer(unsigned(tm_abs_x(2 downto 0)))));
   tm_tilemap_pixel_data_textmode <= tm_tilemap_1(7 downto 1) & tm_tilemap_pixel_data_textmode_shift(7);
   
   tm_tilemap_pixel_wdata(8) <= (tm_tilemap_1(0) or mode_512_q) and not tm_on_top_q;
   tm_tilemap_pixel_wdata(7 downto 0) <= tm_tilemap_pixel_data_standard when textmode_q = '0' else tm_tilemap_pixel_data_textmode;

   -- read from external memory
   
   tm_mem_addr_pix_sub_sub <= (mode_512_q and tm_tilemap_1(0)) & tm_tilemap_0;
   tm_mem_addr_pix_sub <= (tm_mem_addr_pix_sub_sub & tm_transformed_y & tm_transformed_x(2 downto 1)) when textmode_q = '0' else ("00" & tm_mem_addr_pix_sub_sub & tm_abs_y(2 downto 0));
   tm_mem_addr_tile_sub_sub <= (tm_abs_y(11 downto 3) + ("00000" & tm_abs_x(9 downto 6))) & tm_abs_x(5 downto 3);
   tm_mem_addr_tile_sub <= '0' & tm_mem_addr_tile_sub_sub & '0' when state_s = S_READ_TILE_0 and tm_strip_flags_q = '0' else 
                           '0' & tm_mem_addr_tile_sub_sub & '1' when tm_strip_flags_q = '0' else
                           "00" & tm_mem_addr_tile_sub_sub;
   tm_mem_addr_sub <= tm_mem_addr_pix_sub when state_s = S_READ_PIXELS else tm_mem_addr_tile_sub;
   tm_mem_addr_offset <= tm_tile_base_q when state_s = S_READ_PIXELS else tm_map_base_q;

   tm_mem_bank7_o <= tm_mem_addr_offset(6);
   tm_mem_addr_o <= (tm_mem_addr_sub(13 downto 8) + tm_mem_addr_offset(5 downto 0)) & tm_mem_addr_sub(7 downto 0);
   tm_mem_rd_o <= '0' when state_s = S_IDLE else '1';

   ------------------------
   -- GENERATE VIDEO OUTPUT
   ------------------------

   video_addr <= tm_pixel_half_rd & hcount_eff(2 downto 0);

   process (clock_master_i)
   begin
      if rising_edge(clock_master_i) then
         if hcount(1 downto 0) = "11" then  -- rising edge of 7MHz
            xsv <= clip_x1_i & '0';
            xev <= clip_x2_i & '1';
            ysv <= clip_y1_i;
            yev <= clip_y2_i;
         end if;
      end if;
   end process;

   pixel_en_s <= '1' when (hcounter_i < 320) and (vcounter_i(8) = '0') and (hcounter_i >= xsv) and (hcounter_i <= xev) and (vcounter_i >= ysv) and (vcounter_i <= yev) else '0';
   
   pixel_textmode_s <= (textmode_0 and not tm_pixel_half_rd) or (textmode_1 and tm_pixel_half_rd);
   pixel_en_standard_s <= '1' when pixel_en_s = '1' and (video_data(3 downto 0) /= transp_colour_i) else '0';

   pixel_en_f <= (pixel_en_standard_s and not pixel_textmode_s) or (pixel_en_s and pixel_textmode_s);
   
   process (clock_master_i)
   begin
      if rising_edge(clock_master_i) then
         if reset_i = '1' then
            video_data_q <= (others => '0');
         elsif hcount(0) = '1' then   -- rising edge of 14MHz
            video_data_q(10) <= pixel_textmode_s;
            video_data_q(9 downto 0) <= pixel_en_f & video_data;
         end if;
      end if;
   end process;

   pixel_textmode_o <= video_data_q(10);
   pixel_en_o <= video_data_q(9);
   pixel_below_o <= video_data_q(8);
   pixel_o <= video_data_q(7 downto 0);

end architecture;
