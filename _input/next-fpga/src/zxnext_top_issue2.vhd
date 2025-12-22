
-- ZX Spectrum Next Issue 2 FPGA Top Level
-- Copyright 2020-2023 Alvin Albrecht and Fabio Belavenuto
--
-- TBBLUE Issue 2 Top - Fabio Belavenuto
-- ZXNext Refactor - Alvin Albrecht
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

library UNISIM;
use UNISIM.VComponents.all;

entity zxnext_top_issue2 is
   generic (
      g_machine_id      : unsigned(7 downto 0)  := X"0A";   -- X"0A" = ZX Spectrum Next, X"FA" = Anti Brick (reset disabled, bootrom)
      g_video_def       : unsigned(2 downto 0)  := "000";   -- video mode default (0-6, vga-0 & vga-1 produce hdmi if hdmi module is included)
      g_version         : unsigned(7 downto 0)  := X"32";   -- 3.02
      g_sub_version     : unsigned(7 downto 0)  := X"01";   -- .01
      g_board_issue     : unsigned(3 downto 0)  := X"0";    -- issue 2 (see nextreg 0x0F)
      g_video_inc       : unsigned(1 downto 0)  := "10"     -- bit 1 = 1 to include HDMI module, bit 0 = 1 to include VGA module (if changed see zxnext_pins_issue2.ucf)
   );
   port (
      -- Clocks
      clock_50_i        : in    std_logic;

      -- SRAM (AS7C34096)
      ram_addr_o        : out   std_logic_vector(18 downto 0)  := (others => '0');
      ram_data_io       : inout std_logic_vector(15 downto 0)  := (others => 'Z');
      ram_oe_n_o        : out   std_logic                      := '1';
      ram_we_n_o        : out   std_logic                      := '1';
      ram_ce_n_o        : out   std_logic_vector( 3 downto 0)  := (others => '1');

      -- PS2
      ps2_clk_io        : inout std_logic                      := 'Z';
      ps2_data_io       : inout std_logic                      := 'Z';
      ps2_pin6_io       : inout std_logic                      := 'Z';  -- Mouse clock
      ps2_pin2_io       : inout std_logic                      := 'Z';  -- Mouse data

      -- SD Card
      sd_cs0_n_o        : out   std_logic                      := '1';
      sd_cs1_n_o        : out   std_logic                      := '1';
      sd_sclk_o         : out   std_logic                      := '0';
      sd_mosi_o         : out   std_logic                      := '0';
      sd_miso_i         : in    std_logic;

      -- Flash
      flash_cs_n_o      : out   std_logic                      := '1';
      flash_sclk_o      : out   std_logic                      := '0';
      flash_mosi_o      : out   std_logic                      := '0';
      flash_miso_i      : in    std_logic;
      flash_wp_o        : out   std_logic                      := '0';
      flash_hold_o      : out   std_logic                      := '1';

      -- Joystick
      joyp1_i           : in    std_logic;
      joyp2_i           : in    std_logic;
      joyp3_i           : in    std_logic;
      joyp4_i           : in    std_logic;
      joyp6_i           : in    std_logic;
      joyp7_o           : out   std_logic                      := '1';
      joyp9_i           : in    std_logic;
      joysel_o          : out   std_logic                      := '0';

      -- Audio
      audioext_l_o      : out   std_logic                      := '0';
      audioext_r_o      : out   std_logic                      := '0';
      audioint_o        : out   std_logic                      := '0';

      -- K7
      ear_port_i        : in    std_logic;
      mic_port_o        : out   std_logic                      := '0';

      -- Buttons
      btn_divmmc_n_i    : in    std_logic;
      btn_multiface_n_i : in    std_logic;
      btn_reset_n_i     : in    std_logic;

      -- Matrix keyboard
      keyb_row_o        : out   std_logic_vector( 7 downto 0)  := (others => 'Z');
      keyb_col_i        : in    std_logic_vector( 6 downto 0);

      -- Bus
      bus_rst_n_io      : inout std_logic                      := 'Z';
      bus_clk35_o       : out   std_logic                      := '1';
      bus_addr_o        : out   std_logic_vector(15 downto 0)  := (others => 'Z');
      bus_data_io       : inout std_logic_vector( 7 downto 0)  := (others => 'Z');
      bus_int_n_io      : inout std_logic                      := 'Z';
      bus_int_in_i      : in    std_logic;
      bus_nmi_n_i       : in    std_logic;
      bus_ramcs_io      : inout std_logic                      := 'Z';
      bus_romcs_i       : in    std_logic;
      bus_wait_n_i      : in    std_logic;
      bus_halt_n_o      : out   std_logic                      := '1';
      bus_iorq_n_o      : out   std_logic                      := '1';
      bus_m1_n_o        : out   std_logic                      := '1';
      bus_mreq_n_o      : out   std_logic                      := '1';
      bus_rd_n_io       : inout std_logic                      := '1';
      bus_wr_n_o        : out   std_logic                      := '1';
      bus_rfsh_n_o      : out   std_logic                      := '1';
      bus_busreq_n_i    : in    std_logic;
      bus_busack_n_o    : out   std_logic                      := '1';
      bus_iorqula_n_i   : in    std_logic;
      bus_y_o           : out   std_logic                      := '1';

      -- VGA
      rgb_r_o           : out   std_logic_vector( 2 downto 0)  := (others => '0');
      rgb_g_o           : out   std_logic_vector( 2 downto 0)  := (others => '0');
      rgb_b_o           : out   std_logic_vector( 2 downto 0)  := (others => '0');
      hsync_o           : out   std_logic                      := '1';
      vsync_o           : out   std_logic                      := '1';

      -- HDMI
      hdmi_p_o          : out   std_logic_vector(3 downto 0);
      hdmi_n_o          : out   std_logic_vector(3 downto 0);

      -- I2C (RTC and HDMI)
      i2c_scl_io        : inout std_logic                      := 'Z';
      i2c_sda_io        : inout std_logic                      := 'Z';

      -- ESP
      esp_gpio0_io      : inout std_logic                      := 'Z';
      esp_gpio2_io      : inout std_logic                      := 'Z';
      esp_rx_i          : in    std_logic;
      esp_tx_o          : out   std_logic                      := '1';

      -- PI GPIO
      accel_io          : inout std_logic_vector(27 downto 0)  := (others => 'Z')
   );
end entity;

architecture rtl of zxnext_top_issue2 is

   component system_pll
   port
   (
      RST         : in std_logic;
      SSTEP       : in std_logic;
      STATE       : in std_logic_vector(2 downto 0);
      CLKDRP      : in std_logic;
      SRDY_N      : out std_logic;
      CLKIN       : in std_logic;
      
      CLK0OUT     : out std_logic;
      CLK1OUT     : out std_logic;
      CLK2OUT     : out std_logic;
      CLK3OUT     : out std_logic;
      CLK4OUT     : out std_logic
   );
   end component;

   component system_pll_reduced
   port
   (
      RST         : in std_logic;
      SSTEP       : in std_logic;
      STATE       : in std_logic;
      CLKDRP      : in std_logic;
      SRDY_N      : out std_logic;
      CLKIN       : in std_logic;
      
      CLK0OUT     : out std_logic;
      CLK1OUT     : out std_logic;
      CLK2OUT     : out std_logic;
      CLK3OUT     : out std_logic;
      CLK4OUT     : out std_logic
   );
   end component;

   component ps2_mouse
   port
   (
      reset       : in std_logic;
      clk         : in std_logic;
      
      ps2mdat_i   : in std_logic;
      ps2mclk_i   : in std_logic;
      
      ps2mdat_o   : out std_logic;
      ps2mclk_o   : out std_logic;
      
      control_i   : in  std_logic_vector(2 downto 0);
      
      xcount      : out std_logic_vector(7 downto 0);
      ycount      : out std_logic_vector(7 downto 0);
      zcount      : out std_logic_vector(7 downto 0);
      
      mleft       : out std_logic;
      mright      : out std_logic;
      mthird      : out std_logic
   );
   end component;

   -- input synchronization

   signal joyp1_i_q              : std_logic;
   signal joyp2_i_q              : std_logic;
   signal joyp3_i_q              : std_logic;
   signal joyp4_i_q              : std_logic;
   signal joyp6_i_q              : std_logic;
   signal joyp9_i_q              : std_logic;
   
   signal ear_port_i_q           : std_logic;
   signal ear_port_i_qq          : std_logic;
   signal ear_port_i_qqq         : std_logic;
   
   signal btn_divmmc_n_i_q       : std_logic;
   signal btn_multiface_n_i_q    : std_logic;
   signal btn_reset_n_i_q        : std_logic;

   signal ps2_clk_io_q           : std_logic := '1';
   signal ps2_data_io_q          : std_logic := '1';
   signal ps2_pin6_io_q          : std_logic := '1';
   signal ps2_pin2_io_q          : std_logic := '1';

   signal keyb_col_i_q           : std_logic_vector(6 downto 0);

   signal bus_data_i_q           : std_logic_vector(7 downto 0);
   signal bus_int_n_i_q          : std_logic := '1';
   signal bus_nmi_n_i_q          : std_logic := '1';
   signal bus_nmi_n_i_qq         : std_logic;
-- signal bus_ramcs_i_q          : std_logic;
   signal bus_romcs_i_q          : std_logic;
   signal bus_wait_n_i_q         : std_logic;
   signal bus_busreq_n_i_q       : std_logic;
   signal bus_iorqula_n_i_q      : std_logic;
   signal bus_rd_n_i_q           : std_logic;

   signal esp_gpio0_i_q          : std_logic;
   signal esp_gpio2_i_q          : std_logic;
   signal esp_rx_i_q             : std_logic;

   signal accel_i_q              : std_logic_vector(27 downto 0);
   
   -- resets
   
   signal video_timing_change    : std_logic;
   signal actual_video_mode      : std_logic_vector(2 downto 0)   := std_logic_vector(g_video_def);
   signal poweron_counter        : std_logic_vector(4 downto 0)   := (others => '1');
   signal reset_poweron          : std_logic;
   
   type reset_state_t            is (S_RESET_IDLE, S_RESET_HARD_0, S_RESET_HARD_1, S_RESET_SOFT_0, S_RESET_SOFT_1);
   signal reset_state            : reset_state_t := S_RESET_HARD_0;
   signal reset_state_next       : reset_state_t;
   
   signal reset_counter_start    : std_logic;
   signal reset_counter_en       : std_logic;
   signal reset_counter          : std_logic_vector(9 downto 0);
   signal reset_counter_eb       : std_logic;
   signal reset_counter_done     : std_logic;
   
   signal reset_hard             : std_logic;
   signal reset_soft             : std_logic;
   signal reset                  : std_logic;
   
   signal bus_reset_n_q          : std_logic;
   signal bus_reset_noise_n      : std_logic;
   signal bus_reset_db_n         : std_logic;
   signal bus_reset_db_n_d       : std_logic := '1';
   signal expbus_reset           : std_logic;
   
   signal zxn_video_mode         : std_logic_vector(2 downto 0);
   signal zxn_reset_hard         : std_logic;
   signal zxn_reset_soft         : std_logic;
   signal zxn_reset_peripheral   : std_logic;
   
   -- clocks
   
   signal CLK_50                 : std_logic;
   signal clk_28_rdy_n           : std_logic;
   
   signal CLK_28                 : std_logic;
   signal CLK_28_n               : std_logic;
   signal CLK_14                 : std_logic;
   signal CLK_7                  : std_logic;
   signal CLK_28x5_n             : std_logic;
   
   signal reset_hdmi             : std_logic;
   signal clk_hdmi_valid         : std_logic;
   
   signal CLK_HDMIx5             : std_logic;
   signal CLK_HDMIx5_n           : std_logic;
   signal CLK_HDMI               : std_logic;   
   
   signal clk7_re_7              : std_logic;
   signal clk7_re_28             : std_logic;
   signal clk_28_sc              : std_logic_vector(1 downto 0);
   signal clk_3m5_cont           : std_logic;
   signal cpu_clk_s              : std_logic;
   signal CLK_i0                 : std_logic;
   signal CLK_i1                 : std_logic;
   signal CLK_CPU                : std_logic;
   
   signal clk_28_div             : std_logic_vector(17 downto 0);
   
   signal clkdiv_3_0             : std_logic;
   signal clkdiv_6_4             : std_logic;
   signal clkdiv_8_7             : std_logic;
   signal clkdiv_17_9            : std_logic;

   signal CLK_28_PSG_EN          : std_logic := '0';
   signal CLK_28_DEBOUNCE_EN     : std_logic := '0';
   signal CLK_28_MOUSE_109KHZ    : std_logic := '0';
   signal CLK_28_PS2_218KHZ      : std_logic := '0';
   signal CLK_28_JOY_EN          : std_logic := '0';
   signal CLK_28_MEMBRANE_EN     : std_logic := '0';

   
   signal zxn_clock_contend      : std_logic;
   signal zxn_clock_lsb          : std_logic;
   signal zxn_cpu_speed          : std_logic_vector(1 downto 0);
   signal zxn_cpu_speed_eff      : std_logic_vector(1 downto 0) := "00";
   signal zxn_cpu_speed_eff_28   : std_logic := '0';

   -- flashboot

   signal flashboot_start        : std_logic := '0';
   signal flashboot_coreid       : std_logic_vector(4 downto 0) := (others => '0');
--   signal flashboot_failid       : std_logic_vector(4 downto 0) := (others => '0');

   -- sram interface
   
   signal sram_port_b_req        : std_logic;
   signal zxn_ram_b_req          : std_logic;
   signal sram_addr              : std_logic_vector(20 downto 0);
   signal sram_cs_n              : std_logic_vector(3 downto 0);
   signal sram_data_H            : std_logic;
   signal sram_rd_n              : std_logic;
   
   signal sram_oe_n_active       : std_logic                      := '0';
   signal sram_data_active       : std_logic_vector(15 downto 0)  := (others => '0');
   signal sram_port_a_active     : std_logic                      := '0';
   signal sram_port_b_active     : std_logic                      := '0';
   signal sram_data_H_active     : std_logic                      := '0';
   
   signal sram_data_in_byte      : std_logic_vector(7 downto 0);
   signal sram_port_a_dat        : std_logic_vector(7 downto 0);
   signal sram_port_b_dat        : std_logic_vector(7 downto 0);

   signal sram_we_line           : std_logic_vector(2 downto 0)   := "100";
   
   -- audio

   signal audioext_m             : std_logic;
   signal audioext_l             : std_logic;
   signal audioext_r             : std_logic;
   
   signal zxn_hdmi_audio         : std_logic;
   signal zxn_speaker_en         : std_logic;
   signal zxn_speaker_excl       : std_logic;

   signal zxn_audio_ear          : std_logic;
   signal zxn_audio_mic          : std_logic;

   signal zxn_audio_L            : std_logic_vector(12 downto 0);
   signal zxn_audio_R            : std_logic_vector(12 downto 0);
   signal zxn_audio_M            : std_logic_vector(14 downto 0);
   signal zxn_audio_M_s          : std_logic_vector(13 downto 0);
   
   -- video : vga
   
   signal ha_value               : integer range 0 to 2047;
   
   signal rgb_15                 : std_logic_vector(8 downto 0);
   signal rgb_31                 : std_logic_vector(8 downto 0);
   
   signal hsync_out              : std_logic;
   signal vsync_out              : std_logic;
   signal blank_out              : std_logic;
   
   signal zxn_rgb                : std_logic_vector(8 downto 0);
   signal zxn_rgb_cs_n           : std_logic;
   signal zxn_rgb_hs_n           : std_logic;
   signal zxn_rgb_vs_n           : std_logic;
   signal zxn_video_scanlines    : std_logic_vector(1 downto 0);
   signal zxn_rgb_blank_n        : std_logic;
   signal zxn_machine_timing     : std_logic_vector(2 downto 0);
   signal zxn_video_scandouble_en   : std_logic;
   
   -- video : hdmi

   signal zxn_hdmi_reset         : std_logic;
   signal zxn_hdmi_pixel_en      : std_logic;
   signal zxn_hdmi_lock          : std_logic;
   
   signal hdmi_min_hactive       : unsigned(9 downto 0);
   signal hdmi_min_hsync         : unsigned(9 downto 0);
   signal hdmi_max_hsync         : unsigned(9 downto 0);
   signal hdmi_max_hc            : unsigned(9 downto 0);
   signal hdmi_min_vactive       : unsigned(9 downto 0);
   signal hdmi_min_vsync         : unsigned(9 downto 0);
   signal hdmi_max_vsync         : unsigned(9 downto 0);
   signal hdmi_max_vc            : unsigned(9 downto 0);
   
   signal toHDMI_rgb             : std_logic_vector(8 downto 0);
   signal toHDMI_hsync           : std_logic;
   signal toHDMI_vsync           : std_logic;
   signal toHDMI_blank           : std_logic;
   
   signal tdms_r                 : std_logic_vector(9 downto 0);
   signal tdms_g                 : std_logic_vector(9 downto 0);
   signal tdms_b                 : std_logic_vector(9 downto 0);
   
   signal zxn_video_50_60        : std_logic;
   
   -- buttons, joystick, mouse, keyboard
   
   signal btn_reset_db_n            : std_logic;
   signal btn_reset_noise_n         : std_logic;
   signal btn_m1_multiface_n        : std_logic;
   signal btn_m1_multiface_db_n     : std_logic;
   signal btn_m1_multiface_noise_n  : std_logic;
   signal btn_drive_divmmc_n        : std_logic;
   signal btn_drive_divmmc_db_n     : std_logic;
   signal btn_drive_divmmc_noise_n  : std_logic;

   signal zxn_buttons            : std_logic_vector(1 downto 0);
   
   signal zxn_joy_left           : std_logic_vector(11 downto 0);
   signal zxn_joy_right          : std_logic_vector(11 downto 0);
   
   signal zxn_joy_io_mode_en     : std_logic;
   signal zxn_joy_io_mode_pin_7  : std_logic;
   
   signal zxn_joy_left_type      : std_logic_vector(2 downto 0);
   signal zxn_joy_right_type     : std_logic_vector(2 downto 0);

   signal ps2_mouse_data_in      : std_logic;
   signal ps2_mouse_clock_in     : std_logic;
   signal m_reset                : std_logic_vector(1 downto 0) := "01";
   signal ps2_mouse_data_out     : std_logic;
   signal ps2_mouse_clock_out    : std_logic;

   signal zxn_ps2_mode           : std_logic;
   signal zxn_mouse_control      : std_logic_vector(2 downto 0);
   signal zxn_mouse_x            : std_logic_vector(7 downto 0);
   signal zxn_mouse_y            : std_logic_vector(7 downto 0);
   signal zxn_mouse_wheel        : std_logic_vector(7 downto 0);
   signal zxn_mouse_button       : std_logic_vector(2 downto 0);
   
   signal ps2_kbd_data_in        : std_logic;
   signal ps2_kbd_clock_in       : std_logic;
   signal ps2_kbd_clock_out      : std_logic;
   signal ps2_kbd_data_out       : std_logic;
   signal ps2_kbd_data_out_en    : std_logic;
   signal ps2_kbd_clock_out_en   : std_logic;
   signal ps2_function_keys_n    : std_logic_vector(8 downto 1) := (others => '1');
   signal ps2_mf_nmi_n           : std_logic;
   signal ps2_divmmc_nmi_n       : std_logic;
   signal ps2_kbd_col            : std_logic_vector(6 downto 0);
   
   signal zxn_keymap_addr        : std_logic_vector(8 downto 0);
   signal zxn_keymap_dat         : std_logic_vector(7 downto 0);
   signal zxn_keymap_we          : std_logic;
   signal zxn_joymap_we          : std_logic;
   
   signal zxn_key_row            : std_logic_vector(7 downto 0);
   signal key_row_filtered       : std_logic_vector(7 downto 0);
   signal zxn_key_col            : std_logic_vector(4 downto 0);
   signal membrane_function_keys : std_logic_vector(10 downto 1);
   
   signal zxn_cancel_extended_entries  : std_logic;
   signal zxn_extended_keys      : std_logic_vector(15 downto 0);
   
   signal membrane_col           : std_logic_vector(4 downto 0);
   signal membrane_rows          : std_logic_vector(7 downto 0);
   signal keyb_col               : std_logic_vector(6 downto 0);
   signal membrane_index         : std_logic_vector(2 downto 0);
   signal membrane_stick_col     : std_logic_vector(6 downto 0);
   
   -- serial communication
   
   signal zxn_i2c_scl_n_o        : std_logic;
   signal zxn_i2c_sda_n_o        : std_logic;
   signal zxn_i2c_scl_n_i        : std_logic;
   signal zxn_i2c_sda_n_i        : std_logic;
   
   signal zxn_spi_ss_sd0_n       : std_logic;
   signal zxn_spi_ss_sd1_n       : std_logic;
   signal zxn_spi_sck            : std_logic;
   signal zxn_spi_mosi           : std_logic;
   signal sd_miso_q              : std_logic := '0';
   
   signal zxn_spi_ss_flash_n     : std_logic;
   signal flash_miso_q           : std_logic := '0';
   
   signal zxn_uart0_tx           : std_logic;
   signal zxn_uart0_rx           : std_logic;
   
   -- expansion bus
   
   signal expbus_type            : std_logic := '1';  -- 0 = fixed, 1 = unmodified
   
   signal zxn_bus_di             : std_logic_vector(7 downto 0);
   signal zxn_bus_int_n          : std_logic;
   signal zxn_bus_nmi_n          : std_logic;
   signal zxn_bus_romcs_n        : std_logic;
   signal zxn_bus_wait_n         : std_logic;
   signal zxn_bus_busreq_n       : std_logic;
   signal zxn_bus_iorqula_n      : std_logic;
   
   signal zxn_cpu_a              : std_logic_vector(15 downto 0);
   signal zxn_cpu_do             : std_logic_vector(7 downto 0);
   signal zxn_cpu_mreq_n         : std_logic;
   signal zxn_cpu_iorq_n         : std_logic;
   signal zxn_cpu_rd_n           : std_logic;
   signal zxn_cpu_wr_n           : std_logic;
   signal zxn_cpu_m1_n           : std_logic;
   signal zxn_cpu_int_n          : std_logic;
   signal zxn_cpu_busak_n        : std_logic;
   signal zxn_cpu_halt_n         : std_logic;
   signal zxn_cpu_rfsh_n         : std_logic;
   signal zxn_cpu_ieo            : std_logic;
   
   signal o_zxn_cpu_a            : std_logic_vector(15 downto 0) := (others => '0');
   signal o_zxn_cpu_do           : std_logic_vector(7 downto 0) := (others => '0');
   signal o_zxn_cpu_mreq_n       : std_logic := '1';
   signal o_zxn_cpu_iorq_n       : std_logic := '1';
   signal o_zxn_cpu_rd_n         : std_logic := '1';
   signal o_zxn_cpu_wr_n         : std_logic := '1';
   signal o_zxn_cpu_m1_n         : std_logic := '1';
   signal o_zxn_cpu_int_n        : std_logic := '1';
   signal o_zxn_cpu_busak_n      : std_logic := '1';
   signal o_zxn_cpu_halt_n       : std_logic := '1';
   signal o_zxn_cpu_rfsh_n       : std_logic := '1';
   signal o_zxn_cpu_ieo          : std_logic := '1';
   signal o_zxn_bus_clken        : std_logic := '0';
   signal o_zxn_bus_inten        : std_logic := '0';
   signal o_zxn_bus_y            : std_logic := '0';
   
   signal zxn_bus_en             : std_logic;
   signal zxn_bus_clken          : std_logic;
   signal bus_clk_cpu            : std_logic;
   
   signal zxn_bus_nmi_debounce_disable  : std_logic;
   
   -- esp gpio
   
   signal zxn_esp_gpio20_i       : std_logic_vector(2 downto 0);
   
   signal zxn_esp_gpio0_o        : std_logic;
   signal zxn_esp_gpio0_en_o     : std_logic;
   
   signal esp_gpio0_o            : std_logic := '1';
   signal esp_gpio0_en           : std_logic := '0';
   
   -- pi gpio
   
   signal zxn_pi_gpio_i          : std_logic_vector(27 downto 0);
   signal zxn_gpio_o             : std_logic_vector(27 downto 0);
   signal zxn_gpio_en            : std_logic_vector(27 downto 0);
   
   signal pi_gpio_o              : std_logic_vector(27 downto 0);
   signal pi_gpio_en             : std_logic_vector(27 downto 0) := (others => '0');
   
   -- zx next
   
   signal zxn_function_keys      : std_logic_vector(10 downto 1);
   
   signal zxn_flashboot          : std_logic;
   signal zxn_coreid             : std_logic_vector(4 downto 0);

   signal zxn_ram_a_addr         : std_logic_vector(20 downto 0);
   signal zxn_ram_a_req          : std_logic;
   signal zxn_ram_a_rd_n         : std_logic;
   signal zxn_ram_a_di           : std_logic_vector(7 downto 0);
   signal zxn_ram_a_do           : std_logic_vector(7 downto 0);
   
   signal zxn_ram_b_addr         : std_logic_vector(20 downto 0);
   signal zxn_ram_b_req_t        : std_logic;
   signal zxn_ram_b_di           : std_logic_vector(7 downto 0);

begin

   ------------------------------------------------------------
   -- SYNCHRONIZE ASYNCHRONOUS INPUTS
   ------------------------------------------------------------

   -- Joystick

   process (CLK_28)
   begin
      if falling_edge(CLK_28) then
         joyp1_i_q <= joyp1_i;
         joyp2_i_q <= joyp2_i;
         joyp3_i_q <= joyp3_i;
         joyp4_i_q <= joyp4_i;
         joyp6_i_q <= joyp6_i;
         joyp9_i_q <= joyp9_i;
      end if;
   end process;

   -- K7

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         ear_port_i_q <= ear_port_i;
      end if;
   end process;
   
   -- ear bit is inverted here; this is important!
   
   -- 1. NOISE REJECTION
   --
   --    Ignore pulses quicker than can be read by the computer.
   --    Ten cycles @ 3.5 MHz = 2.89 us

   ear_noise : entity work.debounce
   generic map
   (
      INITIAL_STATE  => '1',            -- rest state is 1 because input is inverted
      COUNTER_SIZE   => 1               -- reject pulses < 1.14 us
   )
   port map
   (
      clk_i          => CLK_28,
      clk_en_i       => CLK_28_PSG_EN,  -- 1.75 MHz
      button_i       => ear_port_i_q,
      button_o       => ear_port_i_qq
   );
   
   -- 2. RELAX STUCK AT ONE TO ZERO AFTER SOME TIME
   --
   --    Depending on the tape circuit used, the ear bit can become stuck at 1
   --    if the recorded tape signal just relaxes after outputting a 1 rather than
   --    recording an active transition to 0.  On the original Spectrums, the ear
   --    bit will relax to 0 after around 800 us max.  The ZX81 expects the output
   --    to return to 0 in less than 1300 us.
   --
   --    We will try relaxing a 1 to 0 after 1000 us which corresponds to a minimum
   --    unaffected frequency of 500 Hz at 50% duty.  Affected frequencies will see
   --    the duration of a high pulse reduced.

   -- Since the input is inverted, the goal is to change a 0 to 1 after 1000 us.
   -- Invert the result here so that proper polarity is delivered to zx next module.
   
   ear_relax : entity work.relaxation
   generic map
   (
      INVERT         => '1',
      INITIAL_STATE  => '0',
      COUNTER_SIZE   => 6                     -- 1152 us
   )
   port map
   (
      i_CLK          => CLK_28,
      i_CLK_EN       => CLK_28_MEMBRANE_EN,   -- 0.018 ms
      i_sig          => ear_port_i_qq,
      o_sig          => ear_port_i_qqq
   );
   
   -- Buttons
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         btn_divmmc_n_i_q <= btn_divmmc_n_i;
      end if;
   end process;

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         btn_multiface_n_i_q <= btn_multiface_n_i;
      end if;
   end process;

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         btn_reset_n_i_q <= btn_reset_n_i;
      end if;
   end process;

   -- PS/2 keyboard
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         ps2_clk_io_q <= ps2_clk_io;
         ps2_data_io_q <= ps2_data_io;
         ps2_pin6_io_q <= ps2_pin6_io;
         ps2_pin2_io_q <= ps2_pin2_io;
      end if;
   end process;

   -- Matrix keyboard
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         keyb_col_i_q <= keyb_col_i;
      end if;
   end process;

   -- Bus

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         bus_data_i_q <= bus_data_io;
         if expbus_type = '0' then 
            bus_int_n_i_q <= not bus_int_in_i;   -- fixed
         else
            bus_int_n_i_q <= bus_int_n_io;       -- unmodified
         end if;
         bus_nmi_n_i_q <= bus_nmi_n_i; -- or reset
         bus_romcs_i_q <= bus_romcs_i;
         bus_wait_n_i_q <= bus_wait_n_i;
         bus_busreq_n_i_q <= bus_busreq_n_i;
         bus_iorqula_n_i_q <= bus_iorqula_n_i;
         bus_rd_n_i_q <= bus_rd_n_io;
      end if;
   end process;

   -- ESP

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         esp_gpio0_i_q <= esp_gpio0_io;
         esp_gpio2_i_q <= esp_gpio2_io;
         esp_rx_i_q <= esp_rx_i;
      end if;
   end process;

   -- PI GPIO

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         accel_i_q <= accel_io;
      end if;
   end process;

   ------------------------------------------------------------
   -- RESETS --------------------------------------------------
   ------------------------------------------------------------

   -- power on or video timing change
   
   video_timing_change <= '1' when zxn_video_mode /= actual_video_mode else '0';

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         if video_timing_change = '1' then
            actual_video_mode <= zxn_video_mode;
            poweron_counter <= (others => '1');
         elsif reset_poweron = '1' then
            poweron_counter <= poweron_counter - 1;
         end if;
      end if;
   end process;
   
   reset_poweron <= '1' when poweron_counter /= "00000" else '0';
   
   -- hard and soft reset state machine

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         reset_state <= reset_state_next;
      end if;
   end process;
   
   process (reset_poweron, reset_state, zxn_reset_soft, expbus_reset, reset_counter_done)
   begin
      if reset_poweron = '1' then
         reset_state_next <= S_RESET_HARD_0;
      else
         case reset_state is
            when S_RESET_IDLE =>
               if zxn_reset_soft = '1' or expbus_reset = '1' then
                  reset_state_next <= S_RESET_SOFT_0;
               else
                  reset_state_next <= S_RESET_IDLE;
               end if;
            when S_RESET_HARD_0 =>
               if reset_poweron = '1' then
                  reset_state_next <= S_RESET_HARD_0;
               else
                  reset_state_next <= S_RESET_HARD_1;
               end if;
            when S_RESET_HARD_1 =>
               if reset_counter_done = '1' then
                  reset_state_next <= S_RESET_IDLE;
               else
                  reset_state_next <= S_RESET_HARD_1;
               end if;
            when S_RESET_SOFT_0 =>
               reset_state_next <= S_RESET_SOFT_1;
            when S_RESET_SOFT_1 =>
               if reset_counter_done = '1' then
                  reset_state_next <= S_RESET_IDLE;
               else
                  reset_state_next <= S_RESET_SOFT_1;
               end if;
            when others =>
               reset_state_next <= S_RESET_IDLE;
         end case;
      end if;
   end process;

   reset_counter_start <= '1' when reset_state = S_RESET_HARD_0 or reset_state = S_RESET_SOFT_0 else '0';
   reset_counter_en <= '1' when bus_reset_db_n = '1' or zxn_bus_en = '0' or zxn_reset_peripheral = '1' else '0';
   
   reset_hard <= '1' when reset_state = S_RESET_HARD_0 or reset_state = S_RESET_HARD_1 else '0';
   reset_soft <= '1' when reset_state = S_RESET_SOFT_0 or reset_state = S_RESET_SOFT_1 else '0';
   
   reset <= reset_hard or reset_soft;
   
   bus_rst_n_io <= '0' when zxn_reset_peripheral = '1' or (reset_counter_eb = '1' and (reset_hard = '1' or (reset_soft = '1' and zxn_bus_en = '1'))) else 'Z';  -- makes more sense if exp bus reset and esp reset are separated
   
   -- reset counter

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         if reset_counter_start = '1' then
            reset_counter <= (others => '1');
         elsif reset_counter_eb = '1' or (reset_counter_en = '1' and reset_counter(0) = '1') then
            reset_counter <= reset_counter - 1;
         end if;
      end if;
   end process;
   
   reset_counter_eb <= '1' when reset_counter(9 downto 1) /= "000000000" else '0';
   reset_counter_done <= '1' when reset_counter_eb = '0' and reset_counter(0) = '0' else '0';
   
   -- expansion bus reset

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         bus_reset_n_q <= bus_rst_n_io;
      end if;
   end process;
   
   db_expbus_rst_noise : entity work.debounce
      generic map
   (
      INITIAL_STATE  => '1',
      COUNTER_SIZE   => 4      -- 16 * CLK_28 = ~571ns
   )
   port map
   (
      clk_i          => CLK_28,
      clk_en_i       => '1',
      button_i       => bus_reset_n_q,
      button_o       => bus_reset_noise_n
   );

   db_expbus_rst : entity work.debounce
   generic map
   (
      INITIAL_STATE  => '1',
      COUNTER_SIZE   => 3      -- 8 * CLK_28_DEBOUNCE_EN period = ~ 74.8ms
   )
   port map
   (
      clk_i          => CLK_28,
      clk_en_i       => CLK_28_DEBOUNCE_EN,
      button_i       => bus_reset_noise_n,
      button_o       => bus_reset_db_n
   );
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         bus_reset_db_n_d <= bus_reset_db_n;
      end if;
   end process;   
   
   expbus_reset <= '1' when bus_reset_db_n_d = '1' and bus_reset_db_n = '0' and zxn_reset_peripheral = '0' and zxn_bus_en = '1' else '0';

   ------------------------------------------------------------
   -- CLOCKS --------------------------------------------------
   ------------------------------------------------------------
   
   -- system clocks

   BUFG_CLK50 : BUFG
   port map
   (
      I => clock_50_i,
      O => CLK_50
   );

   gen_clksys_1: if (g_video_inc(0) = '1') generate

      -- system clock includes full vga-0 through vga-6 range

      CLKSYS_PLL : system_pll
      port map
      (
         -- drp

         RST        => '0',
         SSTEP      => reset_poweron,      -- power on or video mode change
         STATE      => zxn_video_mode,     -- VGA 0-6
         CLKDRP     => CLK_50,
         SRDY_N     => clk_28_rdy_n,       -- clocks locked
          
         -- clk

         CLKIN      => CLK_50,
          
         CLK0OUT    => CLK_28,             -- 28 MHz
         CLK1OUT    => CLK_28_n,           -- 28 Mhz inverted
         CLK2OUT    => CLK_14,             -- 14 MHz
         CLK3OUT    => CLK_7,              --  7 MHz
         CLK4OUT    => CLK_28x5_n          -- 28 MHz * 5 inverted
      );

   end generate;

   gen_clksys_0: if (g_video_inc(0) = '0') generate

      -- system clock includes vga-0 and vga-1 only

      CLKSYS_PLL_REDUCED : system_pll_reduced
      port map
      (
         -- drp

         RST        => '0',
         SSTEP      => reset_poweron,      -- power on or video mode change
         STATE      => zxn_video_mode(0),  -- VGA 0-1
         CLKDRP     => CLK_50,
         SRDY_N     => clk_28_rdy_n,       -- clocks locked
          
         -- clk

         CLKIN      => CLK_50,
          
         CLK0OUT    => CLK_28,             -- 28 MHz
         CLK1OUT    => CLK_28_n,           -- 28 Mhz inverted
         CLK2OUT    => CLK_14,             -- 14 MHz
         CLK3OUT    => CLK_7,              --  7 MHz
         CLK4OUT    => CLK_28x5_n          -- 28 MHz * 5 inverted
      );

   end generate;

   gen_hdmi_pll_1: if (g_video_inc(1) = '1') generate

      -- only for hdmi
      
      reset_hdmi <= zxn_video_mode(2) or zxn_video_mode(1);   -- disable for VGA-2 and above
   
      CLKHDMI_PLL : entity work.hdmi_pll
      port map
      (
         RST          => reset_hdmi,          -- disable hdmi clocks
      
         -- drp

         SSTEP        => zxn_hdmi_reset,      -- restart hdmi clocks (rising edge)
         CLKDRP       => CLK_50,              -- control logic clock
      
         -- video frame
      
         V5060        => zxn_video_50_60,     -- 0 = 50Hz, 1 = 60Hz
         VMODEL       => zxn_machine_timing,  -- 1XX = Pentagon, 01X = 128K, else 48K

         -- clk

         CLKIN        => CLK_28,              --  28 MHz
         CLKIN_RDY_N  => clk_28_rdy_n,        -- input clock locked
      
         CLK0OUT      => CLK_HDMIx5,          -- 135 MHz
         CLK1OUT      => CLK_HDMIx5_n,        -- 135 MHz inv
         CLK2OUT      => CLK_HDMI,            --  27 MHz
      
         VALID        => clk_hdmi_valid       -- indicates hdmi clocks functioning
      );
   
   end generate;
   
   gen_hdmi_pll_0: if (g_video_inc(1) = '0') generate
   
      reset_hdmi <= '1';
      
      CLK_HDMIx5 <= '0';
      CLK_HDMIx5_n <= '1';
      CLK_HDMI <= '0';
      
      clk_hdmi_valid <= '0';
   
   end generate;

   -- cpu clock selection

   gen_clkbuf_1: if (g_video_inc(0) = '1') generate

      -- sufficient clock buffers in LX16 without HDMI

      process (CLK_7)
      begin
         if rising_edge(CLK_7) then
            if zxn_clock_lsb = '1' and zxn_clock_contend = '0' then
               clk_3m5_cont <= '0';
            elsif zxn_clock_lsb = '0' then
               clk_3m5_cont <= '1';
            end if;
         end if;
      end process;

      BUFGMUX1_i0 : BUFGMUX_1
      port map
      (
         I0 => clk_3m5_cont,
         I1 => CLK_7,
         S => zxn_cpu_speed(0),
         O => CLK_i0
      );

      BUFGMUX1_i1 : BUFGMUX_1
      port map
      (
         I0 => CLK_14,
         I1 => CLK_28,
         S => zxn_cpu_speed(0),
         O => CLK_i1
      );
   
      BUFGMUX1_i2 : BUFGMUX_1
      port map
      (
         I0 => CLK_i0,
         I1 => CLK_i1,
         S => zxn_cpu_speed(1),
         O => CLK_CPU
      );

   end generate;

   gen_clkbuf_0: if (g_video_inc(0) = '0') generate

      -- insufficient clock buffers in LX16 with HDMI

      -- cpu clock phase relationships

      process (CLK_7)
      begin
         if rising_edge(CLK_7) then
            clk7_re_7 <= not clk7_re_7;
         end if;
      end process;

      process (CLK_28)
      begin
         if rising_edge(CLK_28) then
            clk7_re_28 <= clk7_re_7;
         end if;
      end process;

      process (CLK_28)
      begin
         if rising_edge(CLK_28) then
            if clk7_re_28 /= clk7_re_7 then
               clk_28_sc <= "01";
            else
               clk_28_sc <= clk_28_sc + 1;
            end if;
         end if;
      end process;

      -- cpu clock selection

      zxn_cpu_speed_eff <= zxn_cpu_speed;
      zxn_cpu_speed_eff_28 <= zxn_cpu_speed(1) and zxn_cpu_speed(0);

      process (CLK_28)
      begin
         if rising_edge(CLK_28) then
            -- 3.5 MHz (decisions on rising edge of CLK_7)
            if clk_28_sc = "11" then
               if zxn_clock_lsb = '1' and zxn_clock_contend = '0' then
                  clk_3m5_cont <= '0';
               elsif zxn_clock_lsb = '0' then
                  clk_3m5_cont <= '1';
               end if;
            end if;
         end if;
      end process;

      process (CLK_28)
      begin
         if rising_edge(CLK_28) then
            case zxn_cpu_speed_eff is
               when "00" =>
                  -- 3.5 MHz (decisions on rising edge of CLK_7)
                  if clk_28_sc = "11" then
                     if zxn_clock_lsb = '1' and zxn_clock_contend = '0' then
                        cpu_clk_s <= '0';
                     elsif zxn_clock_lsb = '0' then
                        cpu_clk_s <= '1';
                     end if;
                  end if;
               when "01" =>
                  -- 7 MHz
                  cpu_clk_s <= not (clk_28_sc(1) xor clk_28_sc(0));
               when others =>
                  -- 14 MHz
                  cpu_clk_s <= clk_28_sc(0);
            end case;
         end if;
      end process;

      BUFGMUX1_CPU : BUFGMUX_1
      generic map
      (
         CLK_SEL_TYPE => "SYNC"   -- Glitchless ("SYNC") or fast ("ASYNC") clock switch-over
      )
      port map
      (
         I0 => cpu_clk_s,
         I1 => CLK_28,
         S => zxn_cpu_speed_eff_28,
         O => CLK_CPU
      );

   end generate;

   -- Clock Enables
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         clk_28_div <= clk_28_div + 1;
      end if;
   end process;
   
   CLK_28_MOUSE_109KHZ <= clk_28_div(7);   -- 109 kHz clock 50% duty for ps2 mouse
   CLK_28_PS2_218KHZ <= clk_28_div(6);     -- 218 kHz clock 50% duty cycle for ps2 keyboard
   
   clkdiv_3_0 <= '1' when clk_28_div(3 downto 0) = "1111" else '0';
   clkdiv_6_4 <= '1' when clk_28_div(6 downto 4) = "111" else '0';
   clkdiv_8_7 <= '1' when clk_28_div(8 downto 7) = "11" else '0';
   clkdiv_17_9 <= '1' when clk_28_div(17 downto 9) = "111111111" else '0';
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         CLK_28_PSG_EN <= clkdiv_3_0;                                                      -- AY clock enable @ 1.75MHz
         CLK_28_DEBOUNCE_EN <= clkdiv_17_9 and clkdiv_8_7 and clkdiv_6_4 and clkdiv_3_0;   -- 9.36ms period for debounce
         CLK_28_JOY_EN <= clkdiv_6_4 and clkdiv_3_0;                                       -- stick step every 4.57us (pulse width = 9.14us for each side)
         CLK_28_MEMBRANE_EN <= clkdiv_8_7 and clkdiv_6_4 and clkdiv_3_0;                   -- complete scan every 2.5 scanlines (0.018ms per row)
      end if;
  end process;
   
   ------------------------------------------------------------
   -- FPGA MULTIBOOT CONFIGURATION ----------------------------
   ------------------------------------------------------------
   
   -- cores separated by 512k in flash
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         if reset_poweron = '1' then
            flashboot_start <= '0';
         elsif flashboot_start = '0' then
            if zxn_reset_hard = '1' then
               flashboot_start <= '1';
               flashboot_coreid <= "00001";   -- zx next core at position 1
--               flashboot_failid <= "00000";   -- anti-brick core at position 0
            elsif zxn_flashboot = '1' then
               flashboot_start <= '1';
               flashboot_coreid <= zxn_coreid;
--               flashboot_failid <= "00001";   -- zx next core at position 1
            end if;
         end if;
      end if;
   end process;
   
   fpga_config : entity work.flashboot
   port map
   (
      i_CLK       => CLK_14,
      i_reset     => reset_poweron,
      
      i_start     => flashboot_start,
      
      i_coreid    => flashboot_coreid,
      i_failid    => "00000"   -- flashboot_failid
   );

   ------------------------------------------------------------
   -- SRAM INTERFACE ------------------------------------------
   ------------------------------------------------------------
   
   -- https://www.alliancememory.com/wp-content/uploads/pdf/sram/fa/as7c34096a_v2.1.pdf
   -- https://www.idt.com/document/dst/71v424-data-sheet
   
   -- SRAM cycles are executed within every 28MHz cycle and are
   -- granted to one of three simultaneous requesters, with the
   -- cpu granted highest priority and layer 2 granted second
   -- priority.

   -- To ensure that a 28MHz cpu speed would be possible, the 
   -- initial design allocates the entire 28MHz period to the 
   -- sram memory cycle with the result of reads stored at the 
   -- end of the period on the next rising edge.  This has
   -- the consequence that cpu instruction fetches and DMA
   -- 2-cycle reads must have one wait state inserted at 28MHz 
   -- speed.

   -- For memory write timing, the 5 x 28MHz hdmi clock is used
   -- to time the write pulse to ensure the write address is
   -- stable before the write pulse is asserted and to ensure
   -- the write cycle is completed before the end of the 28MHz period.
   
   -- Hard and soft resets span many 28MHz cycles so the currently
   -- running sram cycle is allowed to complete before the sram
   -- is held in a neutral state during the reset.  This ensures
   -- spurious writes don't contaminate the sram during soft reset.
   
   -- In the notation below, port A is r/w and is the highest
   -- priority assigned to the cpu.  Port B is read-only and
   -- is second priority assigned to layer 2.  Layer 2 requests
   -- can be delayed by one cycle so they are fine soaking up
   -- spare sram bandwidth at second priority.

   -- PORT A (R/W) (cpu/dma):
   --
   -- zxn_ram_a_addr   : std_logic_vector(20 downto 0)
   -- zxn_ram_a_req    : '1' on rising edge indicates memory request
   -- zxn_ram_a_rd_n   : '0' for read, '1' for write
   -- zxn_ram_a_do     : std_logic_vector(7 downto 0) data to write to memory
   -- zxn_ram_a_di     : std_logic_vector(7 downto 0) data read from memory
   
   -- PORT B (R) (layer 2):
   --
   -- zxn_ram_b_addr   : std_logic_vector(20 downto 0)
   -- zxn_ram_b_req_t  : toggles to indicate new request
   -- zxn_ram_b_di     : std_logic_vector(7 downto 0) data read from memory
   
   -- PORT C (R/W) (dma, soaks up spare bandwidth)
   
   -- SRAM I/O PINS:
   --
   -- ram_addr_o       : std_logic_vector(18 downto 0)
   -- ram_data_io      : std_logic_vector(15 downto 0)
   -- ram_oe_n_o
   -- ram_we_n_o
   -- ram_ce_n_o       : std_logic_vector(3 downto 0)
   
   -- Determine active port and sram signals for next memory cycle
   
   zxn_ram_b_req <= (zxn_ram_b_req_t xor sram_port_b_req) and not zxn_ram_a_req;   -- 0 = Port A (or nothing), 1 = Port B
   sram_addr <= (zxn_ram_a_addr(20) & zxn_ram_a_addr(0) & zxn_ram_a_addr(19 downto 1)) when zxn_ram_a_req = '1' else (zxn_ram_b_addr(20) & zxn_ram_b_addr(0) & zxn_ram_b_addr(19 downto 1));
   
   -- Track port B request which operates on a toggled signal
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         if zxn_ram_b_req = '1' then
            sram_port_b_req <= zxn_ram_b_req_t;
         end if;
      end if;
   end process;

   -- Select active sram chip
   
   process (zxn_ram_a_req, zxn_ram_b_req, sram_addr)
   begin
      if zxn_ram_a_req = '1' or zxn_ram_b_req = '1' then
         case sram_addr(20 downto 19) is
            when "00"   =>  sram_cs_n <= "1110";
            when "01"   =>  sram_cs_n <= "1101";
            when "10"   =>  sram_cs_n <= "1011";
            when others =>  sram_cs_n <= "0111";
         end case;
      else
         sram_cs_n <= (others => '1');
      end if;
   end process;
   
   sram_data_H <= sram_addr(19);
   sram_rd_n <= zxn_ram_a_rd_n and zxn_ram_a_req;  -- only port A can generate a write cycle
   
   -- Memory cycle
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         if reset = '1' then
         
            ram_ce_n_o <= (others => '1');
            ram_oe_n_o <= '1';
            ram_addr_o <= (others => '0');
            
            sram_oe_n_active <= '0';
            sram_data_active <= (others => '0');
            
            sram_port_a_active <= '0';
            sram_port_b_active <= '0';
            
            sram_data_H_active <= '0';

         else

            ram_ce_n_o <= sram_cs_n;
            ram_oe_n_o <= sram_rd_n or not (zxn_ram_a_req or zxn_ram_b_req);
            ram_addr_o <= sram_addr(18 downto 0);
            
            sram_oe_n_active <= sram_rd_n;
            sram_data_active <= zxn_ram_a_do & zxn_ram_a_do;
            
            sram_port_a_active <= zxn_ram_a_req;
            sram_port_b_active <= zxn_ram_b_req;
            
            sram_data_H_active <= sram_data_H;

         end if;
      end if;
   end process;
   
   -- SRAM read

   sram_data_in_byte <= ram_data_io(7 downto 0) when sram_data_H_active = '0' else ram_data_io(15 downto 8);

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         if sram_oe_n_active = '0' then
            if sram_port_a_active = '1' then
               sram_port_a_dat <= sram_data_in_byte;
            end if;
            if sram_port_b_active = '1' then
               sram_port_b_dat <= sram_data_in_byte;
            end if;
         end if;
      end if;
   end process;
   
   zxn_ram_a_di <= sram_port_a_dat;
   zxn_ram_b_di <= sram_port_b_dat;
   
   -- SRAM write

   -- CLK_28        +++++++++++++++---------------  period = 30.3 ns - 37.0 ns
   -- CLK_28x5_n    ---+++---+++---+++---+++---+++  period = 6.06 ns - 7.40 ns
   -- sram_we_line  444000000111111222222333333444
   -- ram_data_io   DDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
   -- ram_we_n_o    +++++++++------------+++++++++  duration = 12.1 ns - 14.8 ns

   process (CLK_28x5_n)
   begin
      if rising_edge(CLK_28x5_n) then
         if sram_we_line(2) = '1' then
            ram_we_n_o <= '1';
            if sram_oe_n_active = '1' then
               sram_we_line <= "000";
            end if;
         else
            ram_we_n_o <= sram_we_line(1);
            sram_we_line <= sram_we_line + 1;
         end if;
      end if;
   end process;

   ram_data_io <= sram_data_active when sram_oe_n_active = '1' else (others => 'Z');

   ------------------------------------------------------------
   -- AUDIO ---------------------------------------------------
   ------------------------------------------------------------

   -- tape save
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         mic_port_o <= zxn_audio_mic;
      end if;
   end process;
   
   -- audio jack

   audio_L : entity work.dac
   generic map
   (
      msbi_g   => 11
   )
   port map
   (
      clk_i    => CLK_28,
      res_i    => reset,
      dac_i    => zxn_audio_L(11 downto 0),
      dac_o    => audioext_l
   );
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         audioext_l_o <= audioext_l;
      end if;
   end process;
   
   audio_R : entity work.dac
   generic map
   (
      msbi_g   => 11
   )
   port map
   (
      clk_i    => CLK_28,
      res_i    => reset,
      dac_i    => zxn_audio_R(11 downto 0),
      dac_o    => audioext_r
   );
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         audioext_r_o <= audioext_r;
      end if;
   end process;

   -- optional internal speaker

   -- VBE(on) = 0.55 V
   -- VBE(max) = 0.8 V
   -- 17-bit dac = 21760 offset, signal range = 0:9929
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         zxn_audio_M_s <= ('0' & zxn_audio_L) + ('0' & zxn_audio_R);
      end if;
   end process;
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         if zxn_speaker_excl = '1' then
            zxn_audio_M <= zxn_audio_ear & (not zxn_audio_ear) & '0' & zxn_audio_mic & "00000000000";
         else
            zxn_audio_M <= (('0' & zxn_audio_M_s(13 downto 7)) + "01010101") & zxn_audio_M_s(6 downto 0);
         end if;
      end if;
   end process;
   
   audio_M : entity work.dac
   generic map
   (
      msbi_g   => 16     -- only using a small range of 16.7% through 24.2%
   )
   port map
   (
      clk_i    => CLK_28,
      res_i    => reset,
      dac_i    => '0' & zxn_audio_M & '0',
      dac_o    => audioext_m
   );

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         audioint_o <= audioext_m and zxn_speaker_en;
      end if;
   end process;
   
   gen_vga_1: if (g_video_inc(0) = '1') generate
   
      ------------------------------------------------------------
      -- VIDEO : VGA ---------------------------------------------
      ------------------------------------------------------------

      -- note: the values below are relative to the CLK period not standard VGA clock period
   
      sc_mod : entity work.scan_convert
      generic map
      (
         -- mark active area of input video
      
         cstart      =>  38*2,  -- composite sync start
         clength     => 352*2,  -- composite sync length
      
         -- output video timing
      
         hB          =>  32*2,   -- h sync
         hC          =>  40*2,   -- h back porch
         hD          => 352*2,   -- visible video (256 + both borders)
         hpad        =>   0*2,   -- create H black border

         vB          =>   2*2,   -- v sync
         vC          =>   5*2,   -- v back porch
         vD          => 284*2,   -- visible video
         vpad        =>   0*2    -- create V black border
      )
      port map
      (
         CLK         => CLK_14,
         CLK_x2      => CLK_28,

         hA          => ha_value,   -- h front porch
         I_VIDEO     => zxn_rgb,
         I_HSYNC     => zxn_rgb_hs_n,
         I_VSYNC     => zxn_rgb_vs_n,
         I_SCANLIN   => zxn_video_scanlines,
         I_BLANK_N   => zxn_rgb_cs_n,

         O_VIDEO_15  => rgb_15,     -- scanlines processed
         O_VIDEO_31  => rgb_31,     -- scanlines processed
         O_HSYNC     => hsync_out,
         O_VSYNC     => vsync_out,
         O_BLANK     => blank_out      
      );
   
      ha_value <= 48 when zxn_machine_timing(1) = '0' else 64;   -- 48k = 000 or 001, Pentagon = 100
   
      process (CLK_28)
      begin
         if falling_edge(CLK_28) then
      
            if zxn_video_scandouble_en = '0' then
         
               rgb_r_o <= rgb_15(8 downto 6);
               rgb_g_o <= rgb_15(5 downto 3);
               rgb_b_o <= rgb_15(2 downto 0);
            
               -- csync on hsync when the scandoubler is off
            
               hsync_o <= zxn_rgb_cs_n;
               vsync_o <= '1';
            
            else
         
               rgb_r_o <= rgb_31(8 downto 6);
               rgb_g_o <= rgb_31(5 downto 3);
               rgb_b_o <= rgb_31(2 downto 0);
            
               hsync_o <= hsync_out;
               vsync_o <= vsync_out;
         
            end if;
         end if;
      end process;

   end generate;

   gen_vga_0: if (g_video_inc(0) = '0') generate
   
      rgb_r_o <= (others => '0');
      rgb_g_o <= (others => '0');
      rgb_b_o <= (others => '0');
      
      hsync_o <= '1';
      vsync_o <= '1';

   end generate;

   gen_hdmi_1: if (g_video_inc(1) = '1') generate

      ------------------------------------------------------------
      -- VIDEO : HDMI --------------------------------------------
      ------------------------------------------------------------

      -- CEA-861-D 17,18 720 x 576p 50 Hz
      -- CEA-861-D  2, 3 720 x 480p 60 Hz
   
      process (zxn_video_50_60)
      begin
         if zxn_video_50_60 = '0' then
      
            -- 576p 50 Hz

            hdmi_min_hsync   <= to_unsigned(12, 10);
            hdmi_max_hsync   <= to_unsigned(75, 10);
            hdmi_min_hactive <= to_unsigned(144, 10);
            hdmi_max_hc      <= to_unsigned(863, 10);

            hdmi_min_vsync   <= to_unsigned(5, 10);
            hdmi_max_vsync   <= to_unsigned(9, 10);
            hdmi_min_vactive <= to_unsigned(49, 10);
            hdmi_max_vc      <= to_unsigned(624, 10);
      
         else
      
            -- 480p 60 Hz

            hdmi_min_hsync   <= to_unsigned(16, 10);
            hdmi_max_hsync   <= to_unsigned(77, 10);
            hdmi_min_hactive <= to_unsigned(138, 10);
            hdmi_max_hc      <= to_unsigned(857, 10);

            hdmi_min_vsync   <= to_unsigned(9, 10);
            hdmi_max_vsync   <= to_unsigned(14, 10);
            hdmi_min_vactive <= to_unsigned(45, 10);
            hdmi_max_vc      <= to_unsigned(524, 10);
      
         end if;
      end process;
   
      -- HDMI

      hdmi_frame : entity work.hdmi_frame
      port map
      (
         i_reset_async_n  => clk_hdmi_valid,
      
         -- CLK_28 domain

         i_scanlines      => zxn_video_scanlines,
      
         -- pixel in

         i_CLK_RGB        => CLK_14,
         i_CLK_RGB_EN     => zxn_hdmi_pixel_en,
      
         i_rgb_sync       => zxn_hdmi_lock,
         i_rgb            => zxn_rgb,
      
         -- pixel out

         i_CLK_HDMI       => CLK_HDMI,

         o_blank          => toHDMI_blank,
         o_vsync_n        => toHDMI_vsync,
         o_hsync_n        => toHDMI_hsync,
      
         o_rgb            => toHDMI_rgb,

         -- hdmi configuration
      
         i_HACTIVE        => std_logic_vector(hdmi_min_hactive),
         i_HSYNC_BEG      => std_logic_vector(hdmi_min_hsync),
         i_HSYNC_END      => std_logic_vector(hdmi_max_hsync),
         i_HLAST          => std_logic_vector(hdmi_max_hc),
      
         i_VACTIVE        => std_logic_vector(hdmi_min_vactive),
         i_VSYNC_BEG      => std_logic_vector(hdmi_min_vsync),
         i_VSYNC_END      => std_logic_vector(hdmi_max_vsync),
         i_VLAST          => std_logic_vector(hdmi_max_vc)
      );

      hdmi: entity work.hdmi
      generic map
      (
         FREQ           => 27000000,   -- pixel clock frequency
         FS             => 48000,      -- audio sample rate - should be 32000, 41000 or 48000 = 48KHz
         CTS            => 27000,      -- CTS = Freq(pixclk) * N / (128 * Fs)
         N              => 6144        -- N = 128 * Fs /1000,  128 * Fs /1500 <= N <= 128 * Fs /300 (Check HDMI spec 7.2 for details)
      )
      port map
      (
         I_CLK_PIXEL    => CLK_HDMI,
         I_R            => toHDMI_rgb(8 downto 6) & toHDMI_rgb(8 downto 6) & toHDMI_rgb(8 downto 7),
         I_G            => toHDMI_rgb(5 downto 3) & toHDMI_rgb(5 downto 3) & toHDMI_rgb(5 downto 4),
         I_B            => toHDMI_rgb(2 downto 0) & toHDMI_rgb(2 downto 0) & toHDMI_rgb(2 downto 1),
         I_BLANK        => toHDMI_blank,
         I_HSYNC        => toHDMI_hsync,
         I_VSYNC        => toHDMI_vsync,
         I_576P_N       => zxn_video_50_60,
      
         -- PCM audio
      
         I_AUDIO_ENABLE => zxn_hdmi_audio,
         I_AUDIO_PCM_L  => '0' & zxn_audio_L & "00",
         I_AUDIO_PCM_R  => '0' & zxn_audio_R & "00",
      
         -- TMDS parallel pixel synchronous outputs (serialize LSB first)
      
         O_RED          => tdms_r,
         O_GREEN        => tdms_g,
         O_BLUE         => tdms_b
      );

   end generate;

   gen_hdmi_0: if (g_video_inc(1) = '0') generate
   
      tdms_r <= (others => '0');
      tdms_g <= (others => '0');
      tdms_b <= (others => '0');
   
   end generate;

   hdmio: entity work.hdmi_out_xilinx_s6
   port map (
      clock_pixel_i     => CLK_HDMI,
      clock_tdms_i      => CLK_HDMIx5,
      clock_tdms_n_i    => CLK_HDMIx5_n,
      red_i             => tdms_r,
      green_i           => tdms_g,
      blue_i            => tdms_b,
      tmds_out_p        => hdmi_p_o,
      tmds_out_n        => hdmi_n_o
   );
   
   ------------------------------------------------------------
   -- BUTTONS, JOYSTICKS, MOUSE, KEYBOARD ---------------------
   ------------------------------------------------------------

   -- reset button
   
   db_0_noise : entity work.debounce
      generic map
   (
      INITIAL_STATE  => '1',
      COUNTER_SIZE   => 4      -- 16 * CLK_28 = ~571ns
   )
   port map
   (
      clk_i          => CLK_28,
      clk_en_i       => '1',
      button_i       => btn_reset_n_i_q,
      button_o       => btn_reset_noise_n
   );
   
   db_0_bounce : entity work.debounce
   generic map
   (
      INITIAL_STATE  => '1',
      COUNTER_SIZE   => 3      -- 8 * CLK_28_DEBOUNCE_EN period = ~ 74.8ms
   )
   port map
   (
      clk_i          => CLK_28,
      clk_en_i       => CLK_28_DEBOUNCE_EN,
      button_i       => btn_reset_noise_n,
      button_o       => btn_reset_db_n
   );

   -- multiface nmi button (nmi)
   
   db_1_noise : entity work.debounce
      generic map
   (
      INITIAL_STATE  => '1',
      COUNTER_SIZE   => 4      -- 16 * CLK_28 = ~571ns
   )
   port map
   (
      clk_i          => CLK_28,
      clk_en_i       => '1',
      button_i       => btn_multiface_n_i_q,
      button_o       => btn_m1_multiface_noise_n
   ); 

   db_1_bounce : entity work.debounce
   generic map
   (
      INITIAL_STATE  => '1',
      COUNTER_SIZE   => 3      -- 8 * CLK_28_DEBOUNCE_EN period = ~ 74.8ms
   )
   port map
   (
      clk_i          => CLK_28,
      clk_en_i       => CLK_28_DEBOUNCE_EN,
      button_i       => btn_m1_multiface_noise_n,
      button_o       => btn_m1_multiface_db_n
   );
   
   btn_m1_multiface_n <= btn_m1_multiface_db_n and ps2_mf_nmi_n;
   
   -- divmmc nmi button (drive)

   db_2_noise : entity work.debounce
      generic map
   (
      INITIAL_STATE  => '1',
      COUNTER_SIZE   => 4      -- 16 * CLK_28 = ~571ns
   )
   port map
   (
      clk_i          => CLK_28,
      clk_en_i       => '1',
      button_i       => btn_divmmc_n_i_q,
      button_o       => btn_drive_divmmc_noise_n
   );

   db_2_bounce : entity work.debounce
   generic map
   (
      INITIAL_STATE  => '1',
      COUNTER_SIZE   => 3      -- 8 * CLK_28_DEBOUNCE_EN period = ~ 74.8ms
   )
   port map
   (
      clk_i          => CLK_28,
      clk_en_i       => CLK_28_DEBOUNCE_EN,
      button_i       => btn_drive_divmmc_noise_n,
      button_o       => btn_drive_divmmc_db_n
   );
   
   btn_drive_divmmc_n <= btn_drive_divmmc_db_n and ps2_divmmc_nmi_n;
   
   -- joysticks
   -- md controller reads all joystick types
   
   joystick_mod : entity work.md6_joystick_connector_x2
   port map
   (
      i_reset        => reset,
      
      i_CLK_28       => CLK_28,
      i_CLK_EN       => CLK_28_JOY_EN,  -- approximately 9.14us pulse width on each stick
      
      i_joy_1_n      => joyp1_i_q,
      i_joy_2_n      => joyp2_i_q,
      i_joy_3_n      => joyp3_i_q,
      i_joy_4_n      => joyp4_i_q,
      i_joy_6_n      => joyp6_i_q,
      i_joy_9_n      => joyp9_i_q,
      
      i_io_mode_en      => zxn_joy_io_mode_en,
      i_io_mode_pin_7   => zxn_joy_io_mode_pin_7,

      o_joy_7        => joyp7_o,          -- md protocol
      o_joy_select   => joysel_o,         -- joystick selection mux (0 = left, 1 = right)

      o_joy_left     => zxn_joy_left,     -- active high  MODE X Z Y START A C B U D L R
      o_joy_right    => zxn_joy_right     -- active high  MODE X Z Y START A C B U D L R
   );
   
   -- ps2 mouse
   
   ps2_mouse_data_in <= ps2_pin2_io_q when zxn_ps2_mode = '0' else ps2_data_io_q;
   ps2_mouse_clock_in <= ps2_pin6_io_q when zxn_ps2_mode = '0' else ps2_clk_io_q;

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         if reset_poweron = '1' then
            m_reset <= "01";
         else
            case m_reset is
               when "01"   =>
                  if CLK_28_MOUSE_109KHZ = '0' then
                     m_reset <= "11";
                  end if;
               when "11"   =>
                  if CLK_28_MOUSE_109KHZ = '1' then
                     m_reset <= "00";
                  end if;
               when others =>
                  m_reset <= "00";
            end case;
         end if;
      end if;
   end process;
   
   ps2_mouse_mod : ps2_mouse
   port map
   (
      reset       => m_reset(0),                -- removed F12 reset (only available from ps2 kbd)
      clk         => CLK_28_MOUSE_109KHZ,
      
      ps2mdat_i   => ps2_mouse_data_in,
      ps2mclk_i   => ps2_mouse_clock_in,
      
      ps2mdat_o   => ps2_mouse_data_out,
      ps2mclk_o   => ps2_mouse_clock_out,
      
      control_i   => zxn_mouse_control,
      
      xcount      => zxn_mouse_x,
      ycount      => zxn_mouse_y,
      zcount      => zxn_mouse_wheel,
      
      mleft       => zxn_mouse_button(0),
      mright      => zxn_mouse_button(1),
      mthird      => zxn_mouse_button(2)
   );
   
   ps2_data_io <= '0' when (ps2_kbd_data_out = '0' and zxn_ps2_mode = '0') or (ps2_mouse_data_out = '0' and zxn_ps2_mode = '1') else 'Z';
   ps2_clk_io <= '0' when (ps2_kbd_clock_out = '0' and zxn_ps2_mode = '0') or (ps2_mouse_clock_out = '0' and zxn_ps2_mode = '1') else 'Z';

   ps2_pin2_io <= '0' when (ps2_mouse_data_out = '0' and zxn_ps2_mode = '0') or (ps2_kbd_data_out = '0' and zxn_ps2_mode = '1') else 'Z';
   ps2_pin6_io <= '0' when (ps2_mouse_clock_out = '0' and zxn_ps2_mode = '0') or (ps2_kbd_clock_out = '0' and zxn_ps2_mode = '1') else 'Z';

   -- ps2 keyboard
   
   ps2_kbd_data_in <= ps2_data_io_q when zxn_ps2_mode = '0' else ps2_pin2_io_q;
   ps2_kbd_clock_in <= ps2_clk_io_q when zxn_ps2_mode = '0' else ps2_pin6_io_q;

   ps2_kbd_mod : entity work.ps2_keyb
   generic map
   (
      CLK_KHZ           => 218
   )
   port map
   (
      i_CLK             => CLK_28,
      i_CLK_n           => CLK_28_n,
      i_CLK_PS2         => CLK_28_PS2_218KHZ,
      i_reset           => m_reset(0),
      -- ps2 interface
      i_ps2_clk_in      => ps2_kbd_clock_in,
      i_ps2_data_in     => ps2_kbd_data_in,
      o_ps2_clk_out_en  => ps2_kbd_clock_out_en,   -- actively driving highs to keep transitions sharp
      o_ps2_clk_out     => ps2_kbd_clock_out,
      o_ps2_data_out_en => ps2_kbd_data_out_en,    -- actively driving highs to keep transitions sharp
      o_ps2_data_out    => ps2_kbd_data_out,
      -- membrane interaction
      i_membrane_row    => membrane_index,
      o_membrane_col    => ps2_kbd_col,
      -- nmi button simulation
      o_mf_nmi_n        => ps2_mf_nmi_n,           -- F9
      o_divmmc_nmi_n    => ps2_divmmc_nmi_n,       -- F10
      -- function keys
      o_ps2_func_keys_n => ps2_function_keys_n,    -- F8:F1
      -- programmable keymap
      i_keymap_addr     => zxn_keymap_addr,
      i_keymap_data     => zxn_keymap_dat,
      i_keymap_we       => zxn_keymap_we
   );

   -- function keys via membrane keyboard
   
   -- mf button held turns keys 0-9 into function keys
   -- mf button held for < ~1000ms indicates multiface nmi if no function key pressed

   emu_fnkeys_mod : entity work.emu_fnkeys
   generic map
   (
      CLOCK_EN_PERIOD_MS   => 10,   -- debounce period is 9.6ms
      BUTTON_PERIOD_MS     => 1000  -- button held for less than 1s constitutes a short press
   )
   port map
   (
      i_CLK             => CLK_28,
      i_CLK_EN          => CLK_28_DEBOUNCE_EN,
      
      i_reset           => reset_poweron,
      
      i_rows            => zxn_key_row,
      o_rows_filtered   => key_row_filtered,
      
      i_cols            => membrane_col,
      o_cols_filtered   => zxn_key_col,
      
      i_button_m1_n     => btn_m1_multiface_n,      -- F9 = multiface nmi
      i_button_reset_n  => btn_reset_db_n,          -- F1 = hard reset, F4 = soft reset
      
      o_fnkeys          => membrane_function_keys   -- F10:F1 out
   );
      
   -- membrane keyboard
   
   membrane_mod : entity work.membrane
   port map
   (
      i_CLK             => CLK_28,
      i_CLK_EN          => CLK_28_MEMBRANE_EN,
      
      i_reset           => reset_poweron,
      
      i_rows            => key_row_filtered,
      o_cols            => membrane_col,
      
      o_membrane_rows   => membrane_rows,   -- 0 = active, 1 = Z
      o_membrane_ridx   => membrane_index,
      i_membrane_cols   => keyb_col,
      
      i_cancel_extended_entries => zxn_cancel_extended_entries,
      o_extended_keys => zxn_extended_keys
   );
   
   keyb_row_o(0) <= '0' when membrane_rows(0) = '0' else 'Z';
   keyb_row_o(1) <= '0' when membrane_rows(1) = '0' else 'Z';
   keyb_row_o(2) <= '0' when membrane_rows(2) = '0' else 'Z';
   keyb_row_o(3) <= '0' when membrane_rows(3) = '0' else 'Z';
   keyb_row_o(4) <= '0' when membrane_rows(4) = '0' else 'Z';
   keyb_row_o(5) <= '0' when membrane_rows(5) = '0' else 'Z';
   keyb_row_o(6) <= '0' when membrane_rows(6) = '0' else 'Z';
   keyb_row_o(7) <= '0' when membrane_rows(7) = '0' else 'Z';

   keyb_col <= keyb_col_i_q and membrane_stick_col and ps2_kbd_col;

   -- membrane joystick
   
   membrane_stick_mod : entity work.membrane_stick
   port map
   (
      i_CLK             => CLK_28,
      i_CLK_EN          => CLK_28_MEMBRANE_EN,

      i_reset           => reset,

      i_joy_en_n        => zxn_joy_io_mode_en,

      i_joy_left        => zxn_joy_left,
      i_joy_left_type   => zxn_joy_left_type,

      i_joy_right       => zxn_joy_right,
      i_joy_right_type  => zxn_joy_right_type,

      i_membrane_row    => membrane_index,
      o_membrane_col    => membrane_stick_col,

      i_keymap_addr     => zxn_keymap_addr(4 downto 0),
      i_keymap_data     => zxn_keymap_dat(5 downto 0),
      i_keymap_we       => zxn_joymap_we
   );

   ------------------------------------------------------------
   -- SERIAL COMMUNICATION ------------------------------------
   ------------------------------------------------------------

   -- i2c
   
   i2c_scl_io <= '0' when zxn_i2c_scl_n_o = '0' else 'Z';
   i2c_sda_io <= '0' when zxn_i2c_sda_n_o = '0' else 'Z';

   zxn_i2c_scl_n_i <= i2c_scl_io;
   zxn_i2c_sda_n_i <= i2c_sda_io;

   -- spi sd card
   
   sd_cs0_n_o <= zxn_spi_ss_sd0_n;
   sd_cs1_n_o <= zxn_spi_ss_sd1_n;

   process (CLK_CPU)
   begin
      if rising_edge(CLK_CPU) then
         sd_sclk_o  <= zxn_spi_sck;
         sd_mosi_o  <= zxn_spi_mosi;
      end if;
   end process;
   
   sd_miso_q  <= sd_miso_i;       -- no synchronization gives extra 30 ns for sd card to respond at 33 MHz (zx next is spi master)

   -- spi flash
   
   flash_cs_n_o <= zxn_spi_ss_flash_n;

   process (CLK_CPU)
   begin
      if rising_edge(CLK_CPU) then
         flash_sclk_o <= zxn_spi_sck;
         flash_mosi_o <= zxn_spi_mosi;
      end if;
   end process;
   
   flash_miso_q <= flash_miso_i;  -- no synchronization gives extra 30 ns for flash to respond at 33 MHz (zx next is spi master)

   flash_wp_o   <= '0';
   flash_hold_o <= '1';
   
   -- uart (esp)

   esp_tx_o <= zxn_uart0_tx;
   zxn_uart0_rx <= esp_rx_i_q;
   
   ------------------------------------------------------------
   -- EXPANSION BUS -------------------------------------------
   ------------------------------------------------------------
   
   process (CLK_28)
   begin 
      if rising_edge(CLK_28) then
         if reset = '1' then
            expbus_type <= bus_int_in_i;   -- 0 = fixed, 1 = unmodified
         end if;
      end if;
   end process;
   
   -- zxn_bus_en, zxn_bus_clken change on rising edge of cpu clock
   -- bus cpu clock is held/floated high while the bus is disabled
   -- assumes cpu clock freq << CLK_28
   -- not quite complete for external bus masters (busak = 0) on input side
   
   -- input

   zxn_bus_di <= bus_data_i_q;
   zxn_bus_int_n <= bus_int_n_i_q;
   zxn_bus_romcs_n <= bus_romcs_i_q;
   zxn_bus_wait_n <= bus_wait_n_i_q;
   zxn_bus_busreq_n <= bus_busreq_n_i_q;
   zxn_bus_iorqula_n <= bus_iorqula_n_i_q;
   
   db_expbus_nmi : entity work.asymmetrical_debounce
   generic map
   (
      INITIAL_STATE  => '1',
      COUNTER_SIZE   => 3      -- 8 * CLK_28_DEBOUNCE_EN period = ~ 74.8ms
   )
   port map
   (
      clk_i          => CLK_28,
      clk_en_i       => CLK_28_DEBOUNCE_EN,
      reset_i        => reset,
      button_i       => bus_nmi_n_i_q,
      button_o       => bus_nmi_n_i_qq
   );
   
   zxn_bus_nmi_n <= bus_nmi_n_i_qq when zxn_bus_nmi_debounce_disable = '0' else bus_nmi_n_i_q;
   
   -- output
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
      
         o_zxn_cpu_a <= zxn_cpu_a;
         o_zxn_cpu_do <= zxn_cpu_do;
         o_zxn_cpu_mreq_n <= zxn_cpu_mreq_n;
         o_zxn_cpu_iorq_n <= zxn_cpu_iorq_n;
         o_zxn_cpu_rd_n <= zxn_cpu_rd_n;
         o_zxn_cpu_wr_n <= zxn_cpu_wr_n;
         o_zxn_cpu_m1_n <= zxn_cpu_m1_n;
         o_zxn_cpu_busak_n <= zxn_cpu_busak_n and zxn_bus_en;
         o_zxn_cpu_halt_n <= zxn_cpu_halt_n or not zxn_bus_en;
         o_zxn_cpu_rfsh_n <= zxn_cpu_rfsh_n or not zxn_bus_en;
         o_zxn_cpu_ieo <= zxn_cpu_ieo and zxn_bus_en;

         o_zxn_bus_clken <= zxn_bus_en or zxn_bus_clken;
         o_zxn_bus_inten <= zxn_bus_en and not zxn_cpu_int_n;
         
         -- 0 = data bus in from expansion bus
         -- THIS IS INCORRECT FOR BUSAK=0 AS WE MUST ONLY DRIVE THE BUS IF THE NEXT IS RESPONDING WHEN RD=0
--       if (zxn_bus_en = '0') or (zxn_cpu_busak_n = '1' and (zxn_cpu_rd_n = '0' or zxn_cpu_m1_n = '0' or zxn_cpu_rfsh_n = '0')) or (zxn_cpu_busak_n = '0' and bus_rd_n_i_q = '1') then
         if (zxn_bus_en = '0') or (zxn_cpu_busak_n = '1' and (zxn_cpu_rd_n = '0' or zxn_cpu_m1_n = '0' or zxn_cpu_rfsh_n = '0')) or (zxn_cpu_busak_n = '0' and bus_rd_n_io = '1') then
            o_zxn_bus_y <= '0';
         else
            o_zxn_bus_y <= '1';
         end if;
         
      end if;
   end process;
   
   bus_addr_o <= (others => 'Z') when o_zxn_cpu_busak_n = '0' else o_zxn_cpu_a;
   bus_data_io <= (others => 'Z') when o_zxn_bus_y = '0' else o_zxn_cpu_do;
   bus_mreq_n_o <= 'Z' when o_zxn_cpu_busak_n = '0' else o_zxn_cpu_mreq_n;
   bus_iorq_n_o <= 'Z' when o_zxn_cpu_busak_n = '0' else o_zxn_cpu_iorq_n;
   bus_rd_n_io <= 'Z' when o_zxn_cpu_busak_n = '0' else o_zxn_cpu_rd_n;
   bus_wr_n_o <= 'Z' when o_zxn_cpu_busak_n = '0' else o_zxn_cpu_wr_n;
   bus_m1_n_o <= 'Z' when o_zxn_cpu_busak_n = '0' else o_zxn_cpu_m1_n;
   bus_int_n_io <= '0' when o_zxn_bus_inten = '1' else 'Z';
   bus_busack_n_o <= o_zxn_cpu_busak_n;
   bus_halt_n_o <= o_zxn_cpu_halt_n;
   bus_rfsh_n_o <= o_zxn_cpu_rfsh_n;
   bus_y_o <= o_zxn_bus_y;
   
   -- bus identification
   -- (while reset signal is asserted read bus type through bus_ramcs_io, not implemented)

-- bus_ramcs_io <= 'Z' when bus_reset_n_q = '0' else o_zxn_cpu_ieo;
   bus_ramcs_io <= 'Z' when bus_rst_n_io = '0' else o_zxn_cpu_ieo;
   
   -- clock to expansion bus

   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         bus_clk_cpu <= clk_3m5_cont;
      end if;
   end process;
   
   bus_clk35_o <= '1' when o_zxn_bus_clken = '0' else bus_clk_cpu;

   ------------------------------------------------------------
   -- ESP GPIO ------------------------------------------------
   ------------------------------------------------------------
   
   -- input
   
   zxn_esp_gpio20_i <= esp_gpio2_i_q & '0' & esp_gpio0_i_q;
   
   -- output
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         esp_gpio0_o <= zxn_esp_gpio0_o;
         esp_gpio0_en <= zxn_esp_gpio0_en_o;
      end if;
   end process;
   
   esp_gpio2_io <= 'Z';
   esp_gpio0_io <= 'Z' when esp_gpio0_en = '0' else esp_gpio0_o;

   ------------------------------------------------------------
   -- PI GPIO -------------------------------------------------
   ------------------------------------------------------------
   
   -- input

   zxn_pi_gpio_i <= accel_i_q;
   
   -- output
   
   process (CLK_28)
   begin
      if rising_edge(CLK_28) then
         pi_gpio_o <= zxn_gpio_o;
         pi_gpio_en <= zxn_gpio_en;
      end if;
   end process;
   
   accel_io(27) <= 'Z' when pi_gpio_en(27) = '0' else pi_gpio_o(27);
   accel_io(26) <= 'Z' when pi_gpio_en(26) = '0' else pi_gpio_o(26);
   accel_io(25) <= 'Z' when pi_gpio_en(25) = '0' else pi_gpio_o(25);
   accel_io(24) <= 'Z' when pi_gpio_en(24) = '0' else pi_gpio_o(24);
   accel_io(23) <= 'Z' when pi_gpio_en(23) = '0' else pi_gpio_o(23);
   accel_io(22) <= 'Z' when pi_gpio_en(22) = '0' else pi_gpio_o(22);
   accel_io(21) <= 'Z' when pi_gpio_en(21) = '0' else pi_gpio_o(21);
   accel_io(20) <= 'Z' when pi_gpio_en(20) = '0' else pi_gpio_o(20);
   accel_io(19) <= 'Z' when pi_gpio_en(19) = '0' else pi_gpio_o(19);
   accel_io(18) <= 'Z' when pi_gpio_en(18) = '0' else pi_gpio_o(18);
   accel_io(17) <= 'Z' when pi_gpio_en(17) = '0' else pi_gpio_o(17);
   accel_io(16) <= 'Z' when pi_gpio_en(16) = '0' else pi_gpio_o(16);
   accel_io(15) <= 'Z' when pi_gpio_en(15) = '0' else pi_gpio_o(15);
   accel_io(14) <= 'Z' when pi_gpio_en(14) = '0' else pi_gpio_o(14);
   accel_io(13) <= 'Z' when pi_gpio_en(13) = '0' else pi_gpio_o(13);
   accel_io(12) <= 'Z' when pi_gpio_en(12) = '0' else pi_gpio_o(12);
   accel_io(11) <= 'Z' when pi_gpio_en(11) = '0' else pi_gpio_o(11);
   accel_io(10) <= 'Z' when pi_gpio_en(10) = '0' else pi_gpio_o(10);
   accel_io(9)  <= 'Z' when pi_gpio_en(9)  = '0' else pi_gpio_o(9);
   accel_io(8)  <= 'Z' when pi_gpio_en(8)  = '0' else pi_gpio_o(8);
   accel_io(7)  <= 'Z' when pi_gpio_en(7)  = '0' else pi_gpio_o(7);
   accel_io(6)  <= 'Z' when pi_gpio_en(6)  = '0' else pi_gpio_o(6);
   accel_io(5)  <= 'Z' when pi_gpio_en(5)  = '0' else pi_gpio_o(5);
   accel_io(4)  <= 'Z' when pi_gpio_en(4)  = '0' else pi_gpio_o(4);
   accel_io(3)  <= 'Z' when pi_gpio_en(3)  = '0' else pi_gpio_o(3);
   accel_io(2)  <= 'Z' when pi_gpio_en(2)  = '0' else pi_gpio_o(2);
   accel_io(1)  <= 'Z' when pi_gpio_en(1)  = '0' else pi_gpio_o(1);
   accel_io(0)  <= 'Z' when pi_gpio_en(0)  = '0' else pi_gpio_o(0);

   ------------------------------------------------------------
   -- TBBLUE / ZXNEXT -----------------------------------------
   ------------------------------------------------------------

   --  F1 = hard reset
   --  F2 = toggle scandoubler, hdmi reset
   --  F3 = toggle 50Hz / 60Hz display
   --  F4 = soft reset
   --  F5 = (temporary) expansion bus on
   --  F6 = (temporary) expansion bus off
   --  F7 = change scanline weight
   --  F8 = change cpu speed
   --  F9 = m1 button (multiface nmi)
   -- F10 = drive button (divmmc nmi)

   zxn_function_keys <= (membrane_function_keys(10) or not btn_drive_divmmc_n) & membrane_function_keys(9) & (membrane_function_keys(8 downto 1) or not ps2_function_keys_n(8 downto 1));
   zxn_buttons <= (not btn_drive_divmmc_n) & (not btn_m1_multiface_n);
      
   zxnext : entity work.zxnext
   generic map
   (
      g_machine_id         => g_machine_id,
      g_video_def          => g_video_def,
      g_version            => g_version,
      g_sub_version        => g_sub_version,
      g_board_issue        => g_board_issue,
      g_video_inc          => g_video_inc
   )
   port map
   (
      -- CLOCK
      
      i_CLK_28             => CLK_28,
      i_CLK_28_n           => CLK_28_n,
      i_CLK_14             => CLK_14,
      i_CLK_7              => CLK_7,
      i_CLK_CPU            => CLK_CPU,
      i_CLK_PSG_EN         => CLK_28_PSG_EN,
      
      o_CPU_SPEED          => zxn_cpu_speed,
      o_CPU_CONTEND        => zxn_clock_contend,
      o_CPU_CLK_LSB        => zxn_clock_lsb,
      
      -- RESET

      i_RESET              => reset,
      
      o_RESET_SOFT         => zxn_reset_soft,
      o_RESET_HARD         => zxn_reset_hard,
      o_RESET_PERIPHERAL   => zxn_reset_peripheral,
      
      -- FLASH BOOT
      
      o_FLASH_BOOT         => zxn_flashboot,
      o_CORE_ID            => zxn_coreid,
      
      -- SPECIAL KEYS

      i_SPKEY_FUNCTION     => zxn_function_keys,
      i_SPKEY_BUTTONS      => zxn_buttons,
      
      -- MEMBRANE KEYBOARD
      
      o_KBD_CANCEL         => zxn_cancel_extended_entries,
      
      o_KBD_ROW            => zxn_key_row,
      i_KBD_COL            => zxn_key_col,
      
      i_KBD_EXTENDED_KEYS  => zxn_extended_keys,
      
      -- PS/2 KEYBOARD AND KEY JOYSTICK SETUP
      
      o_KEYMAP_ADDR        => zxn_keymap_addr,
      o_KEYMAP_DATA        => zxn_keymap_dat,
      o_KEYMAP_WE          => zxn_keymap_we,
      o_JOYMAP_WE          => zxn_joymap_we,
      
      -- JOYSTICK
      
      i_JOY_LEFT           => zxn_joy_left,
      i_JOY_RIGHT          => zxn_joy_right,

      o_JOY_IO_MODE_EN     => zxn_joy_io_mode_en,
      o_JOY_IO_MODE_PIN_7  => zxn_joy_io_mode_pin_7,
      
      o_JOY_LEFT_TYPE      => zxn_joy_left_type,
      o_JOY_RIGHT_TYPE     => zxn_joy_right_type,
      
      -- MOUSE
      
      i_MOUSE_X            => zxn_mouse_x,
      i_MOUSE_Y            => zxn_mouse_y,
      i_MOUSE_BUTTON       => zxn_mouse_button,
      i_MOUSE_WHEEL        => zxn_mouse_wheel(3 downto 0),
      
      o_PS2_MODE           => zxn_ps2_mode,
      o_MOUSE_CONTROL      => zxn_mouse_control,
      
      -- I2C
      
      i_I2C_SCL_n          => zxn_i2c_scl_n_i,
      i_I2C_SDA_n          => zxn_i2c_sda_n_i,
      
      o_I2C_SCL_n          => zxn_i2c_scl_n_o,
      o_I2C_SDA_n          => zxn_i2c_sda_n_o,
      
      -- SPI

      o_SPI_SS_FLASH_n     => zxn_spi_ss_flash_n,
      o_SPI_SS_SD1_n       => zxn_spi_ss_sd1_n,
      o_SPI_SS_SD0_n       => zxn_spi_ss_sd0_n,

      o_SPI_SCK            => zxn_spi_sck,         -- must synchronize on rising edge of i_CLK_CPU
      o_SPI_MOSI           => zxn_spi_mosi,        -- must synchronize on rising edge of i_CLK_CPU
      
      i_SPI_SD_MISO        => sd_miso_q,           -- must synchronize on rising edge of i_CLK_CPU
      i_SPI_FLASH_MISO     => flash_miso_q,        -- must synchronize on rising edge of i_CLK_CPU
      
      -- UART
      
      i_UART0_RX           => zxn_uart0_rx,
      o_UART0_TX           => zxn_uart0_tx,
      i_UART0_CTS_n        => '0',
      o_UART0_RTR_n        => open,
      
      -- VIDEO
      -- synchronized to i_CLK_14
      
      o_RGB                => zxn_rgb,
      o_RGB_CS_n           => zxn_rgb_cs_n,
      o_RGB_VS_n           => zxn_rgb_vs_n,
      o_RGB_HS_n           => zxn_rgb_hs_n,
      o_RGB_BK_n           => zxn_rgb_blank_n,
      
      o_VIDEO_50_60        => zxn_video_50_60,
      o_VIDEO_SCANLINES    => zxn_video_scanlines,
      o_VIDEO_SCANDOUBLE   => zxn_video_scandouble_en,
      
      o_VIDEO_MODE         => zxn_video_mode,                     -- VGA 0-6
      o_MACHINE_TIMING     => zxn_machine_timing,                 -- video timing: 00X = 48k, 010 = 128k, 011 = +3, 100 = pentagon
      
      o_HDMI_RESET         => zxn_hdmi_reset,
      o_HDMI_PIXEL         => zxn_hdmi_pixel_en,
      o_HDMI_LOCK          => zxn_hdmi_lock,
      
      -- AUDIO
      
      o_AUDIO_HDMI_AUDIO_EN => zxn_hdmi_audio,

      o_AUDIO_SPEAKER_EN   => zxn_speaker_en,
      o_AUDIO_SPEAKER_EXCL => zxn_speaker_excl,
      
      i_AUDIO_EAR          => ear_port_i_qqq,
      o_AUDIO_MIC          => zxn_audio_mic,
      o_AUDIO_EAR          => zxn_audio_ear,

      o_AUDIO_L            => zxn_audio_L,
      o_AUDIO_R            => zxn_audio_R,

      -- EXTERNAL SRAM (synchronized to i_CLK_28)
      -- memory transactions complete in one cycle, data read is registered but available asap
      
      -- Port A is read/write and highest priority (CPU)
      
      o_RAM_A_ADDR         => zxn_ram_a_addr,
      o_RAM_A_REQ          => zxn_ram_a_req,
      o_RAM_A_RD_n         => zxn_ram_a_rd_n,
      i_RAM_A_DI           => zxn_ram_a_di,
      o_RAM_A_DO           => zxn_ram_a_do,
      
      -- Port B is read only (LAYER 2)
      
      o_RAM_B_ADDR         => zxn_ram_b_addr,
      o_RAM_B_REQ_T        => zxn_ram_b_req_t,
      i_RAM_B_DI           => zxn_ram_b_di,
      
      -- EXPANSION BUS
      
      o_BUS_ADDR           => zxn_cpu_a,
      i_BUS_DI             => zxn_bus_di,
      o_BUS_DO             => zxn_cpu_do,
      o_BUS_MREQ_n         => zxn_cpu_mreq_n,
      o_BUS_IORQ_n         => zxn_cpu_iorq_n,
      o_BUS_RD_n           => zxn_cpu_rd_n,
      o_BUS_WR_n           => zxn_cpu_wr_n,
      o_BUS_M1_n           => zxn_cpu_m1_n,
      i_BUS_WAIT_n         => zxn_bus_wait_n,
      i_BUS_NMI_n          => zxn_bus_nmi_n,
      i_BUS_INT_n          => zxn_bus_int_n,
      o_BUS_INT_n          => zxn_cpu_int_n,
      i_BUS_BUSREQ_n       => zxn_bus_busreq_n,
      o_BUS_BUSAK_n        => zxn_cpu_busak_n,
      o_BUS_HALT_n         => zxn_cpu_halt_n,
      o_BUS_RFSH_n         => zxn_cpu_rfsh_n,
      o_BUS_IEO            => zxn_cpu_ieo,
      
      i_BUS_ROMCS_n        => zxn_bus_romcs_n,
      i_BUS_IORQULA_n      => zxn_bus_iorqula_n,
      
      o_BUS_EN             => zxn_bus_en,
      o_BUS_CLKEN          => zxn_bus_clken,

      o_BUS_NMI_DEBOUNCE_DISABLE  => zxn_bus_nmi_debounce_disable,
      
      -- ESP GPIO
      
      i_ESP_GPIO_20        => zxn_esp_gpio20_i,
      
      o_ESP_GPIO_0         => zxn_esp_gpio0_o,
      o_ESP_GPIO_0_EN      => zxn_esp_gpio0_en_o,

      -- PI GPIO
      
      i_GPIO               => zxn_pi_gpio_i,
      
      o_GPIO               => zxn_gpio_o,
      o_GPIO_EN            => zxn_gpio_en,
      
      -- XILINX PERIPHERALS
      
      o_XDNA_LOAD          => open,
      o_XDNA_SHIFT         => open,
      i_XDNA_DO            => '0',
      
      o_XADC_RESET         => open,
      
      o_XADC_DEN           => open,
      o_XADC_DADDR         => open,
      o_XADC_DWE           => open,
      i_XADC_DRDY          => '0',
      o_XADC_DI            => open,
      i_XADC_DO            => (others => '0'),
      
      i_XADC_BUSY          => '0',
      i_XADC_EOC           => '0',
      i_XADC_EOS           => '0',
      o_XADC_CONVST        => open,

      o_XADC_CONTROL       => open
   );

end architecture;

