-- F3 of .plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md: the whole ZX Spectrum Next core (zxnext.vhd,
-- unchanged) on an issue 4 board, as zxnext_top_issue4.vhd wires it: the four aligned clocks, the
-- CPU clock chosen by the core's speed output, the AY clock enable, the reset sequencer's soft reset,
-- and the SRAM controller (one 16-bit SRAM, synchronised to the 28 MHz clock). Every other input sits
-- at its idle level: no key, no joystick, no mouse, no expansion-bus peripheral, no SD card.
--
-- A run: power-on reset; the boot ROM (init/bootrom.txt, models.vhd) plays the firmware's part and
-- leaves config mode, then soft-resets; ROM 0's first bytes (patched in the SRAM image) run DI /
-- LD SP / JP entry, the state the harness's loadCode leaves. The SRAM (init/sram-base.txt, then
-- init/sram.txt on top) and banks 5/7 (init/bank5.txt, init/bank7.txt) hold the memory Klive's
-- harness had after loading the test program, so the program starts from the same bytes.
--
-- The run stops at the first M1 cycle after the program writes $A5 to NextReg $7F (the harness's
-- ready marker), i.e. right after that instruction, as Klive's runToNextRegWrite does; or after
-- MAX_CLOCKS. At the stop the memory is written out at once (no clock runs), then every NextReg is
-- read back through the core's own read mux, which needs a few clocks per register.
--
-- Output: out/result.txt (status, clocks and CPU clocks to the stop, PC, A, F, SP, every NextReg),
-- out/sram.txt (non-zero 64-byte blocks of the RAM area), out/bank5.txt / out/bank7.txt.
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use std.textio.all;
use work.f3_sim.all;

entity tb_next is
  generic (
    MAX_CLOCKS       : integer := 6000000; -- 28 MHz clocks after the program starts (~10.7 frames)
    PROGRESS_EVERY   : integer := 56000    -- a "PROGRESS clocks" line every 1/10 frame
  );
end entity;

architecture sim of tb_next is
  constant HALF_28 : time := 10 ns;

  signal clk_28, clk_28_n, clk_14, clk_7, clk_cpu : std_logic := '0';
  signal psg_en   : std_logic := '0';
  signal reset    : std_logic := '1';
  signal running  : boolean := true;

  signal cpu_speed : std_logic_vector(1 downto 0);
  signal cpu_contend, cpu_clk_lsb : std_logic;
  signal reset_soft, reset_hard, reset_periph : std_logic;

  signal ram_a_addr, ram_b_addr : std_logic_vector(20 downto 0);
  signal ram_a_req, ram_a_rd_n, ram_b_req_t : std_logic;
  signal ram_a_di, ram_a_do, ram_b_di : std_logic_vector(7 downto 0) := (others => '0');

  signal clk_div : unsigned(3 downto 0) := (others => '0');

  -- SRAM: 2 MB, byte addressed
  type sram_t is array (0 to 2**21 - 1) of integer range 0 to 255;
  shared variable sram : sram_t;  -- protected by being touched only in one process at a time

  signal hard_reset_requested : boolean := false;
begin
  -- -------------------------------------------------------------------------------- clocks
  -- 28/14/7 MHz with aligned rising edges (one MMCM), and the CPU clock in the same delta: the core
  -- is timed as if CLK_CPU's edges coincide with the 28 MHz clock's (BUFGMUX from the same MMCM).
  -- 3.5 MHz is CLK_3M5_CONT, a flop on CLK_7 that holds the clock high while the ULA contends
  -- (zxnext_top_issue4.vhd ~980-990).
  clocks : process
    variable p : integer := 0;
    variable cont : std_logic := '1';
    variable c28, c14, c7 : std_logic;
  begin
    while running loop
      c28 := '1' when p mod 2 = 0 else '0';
      c14 := '1' when p mod 4 < 2 else '0';
      c7  := '1' when p mod 8 < 4 else '0';
      if c7 = '1' and clk_7 = '0' then
        if cpu_clk_lsb = '1' and cpu_contend = '0' then cont := '0';
        elsif cpu_clk_lsb = '0' then cont := '1';
        end if;
      end if;
      clk_28 <= c28; clk_28_n <= not c28; clk_14 <= c14; clk_7 <= c7;
      case cpu_speed is
        when "00"   => clk_cpu <= cont;
        when "01"   => clk_cpu <= c7;
        when "10"   => clk_cpu <= c14;
        when others => clk_cpu <= c28;
      end case;
      wait for HALF_28;
      p := (p + 1) mod 8;
    end loop;
    wait;
  end process;

  -- AY clock enable at 1.75 MHz (zxnext_top_issue4.vhd ~1035-1045)
  psg : process (clk_28)
  begin
    if rising_edge(clk_28) then
      clk_div <= clk_div + 1;
      psg_en <= '1' when clk_div = "1111" else '0';
    end if;
  end process;

  -- -------------------------------------------------------------------------------- SRAM
  -- zxnext_top_issue4.vhd ~2300-2380: port A (CPU, read/write) wins over port B (Layer 2, read-only,
  -- toggle request). A request registered on a rising edge is carried out during the next cycle:
  -- the read data are registered on the edge after it, a write lands in that cycle.
  sram_ctrl : process (clk_28)
    variable b_req_last : std_logic := '0';
    variable act_a, act_b, act_read : boolean := false;
    variable act_addr, act_data : integer := 0;
    variable b_req : std_logic;
  begin
    if rising_edge(clk_28) then
      if reset = '1' then
        act_a := false; act_b := false; act_read := false;
      else
        -- the cycle registered last edge
        if act_read then
          if act_a then ram_a_di <= std_logic_vector(to_unsigned(sram(act_addr), 8)); end if;
          if act_b then ram_b_di <= std_logic_vector(to_unsigned(sram(act_addr), 8)); end if;
        elsif act_a then
          sram(act_addr) := act_data;
        end if;
        -- the next cycle
        b_req := (ram_b_req_t xor b_req_last) and not ram_a_req;
        if b_req = '1' then b_req_last := ram_b_req_t; end if;
        act_a := ram_a_req = '1';
        act_b := b_req = '1';
        if ram_a_req = '1' then
          act_addr := to_integer(unsigned(ram_a_addr));
          act_read := ram_a_rd_n = '0';
        else
          act_addr := to_integer(unsigned(ram_b_addr));
          act_read := true;
        end if;
        if not is_x(ram_a_do) then act_data := to_integer(unsigned(ram_a_do)); end if;
      end if;
    end if;
  end process;

  -- -------------------------------------------------------------------------------- the core
  dut : entity work.zxnext
    generic map (
      g_machine_id  => X"0A", g_video_def => "000", g_version => X"32", g_sub_version => X"01",
      g_board_issue => X"2",  g_video_inc => "11")
    port map (
      i_CLK_28 => clk_28, i_CLK_28_n => clk_28_n, i_CLK_14 => clk_14, i_CLK_7 => clk_7,
      i_CLK_CPU => clk_cpu, i_CLK_PSG_EN => psg_en,
      o_CPU_SPEED => cpu_speed, o_CPU_CONTEND => cpu_contend, o_CPU_CLK_LSB => cpu_clk_lsb,
      i_RESET => reset, o_RESET_SOFT => reset_soft, o_RESET_HARD => reset_hard,
      o_RESET_PERIPHERAL => reset_periph, o_FLASH_BOOT => open, o_CORE_ID => open,
      i_SPKEY_FUNCTION => (others => '0'), i_SPKEY_BUTTONS => (others => '0'),
      o_KBD_CANCEL => open, o_KBD_ROW => open, i_KBD_COL => (others => '1'),
      i_KBD_EXTENDED_KEYS => (others => '0'),  -- active high: no key
      o_KEYMAP_ADDR => open, o_KEYMAP_DATA => open, o_KEYMAP_WE => open, o_JOYMAP_WE => open,
      i_JOY_LEFT => (others => '0'), i_JOY_RIGHT => (others => '0'),
      o_JOY_IO_MODE_EN => open, o_JOY_IO_MODE_PIN_7 => open, o_JOY_LEFT_TYPE => open, o_JOY_RIGHT_TYPE => open,
      i_MOUSE_X => (others => '0'), i_MOUSE_Y => (others => '0'), i_MOUSE_BUTTON => (others => '0'),
      i_MOUSE_WHEEL => (others => '0'), o_PS2_MODE => open, o_MOUSE_CONTROL => open,
      i_I2C_SCL_n => '1', i_I2C_SDA_n => '1', o_I2C_SCL_n => open, o_I2C_SDA_n => open,
      o_SPI_SS_FLASH_n => open, o_SPI_SS_SD1_n => open, o_SPI_SS_SD0_n => open, o_SPI_SCK => open,
      o_SPI_MOSI => open, i_SPI_SD_MISO => '1', i_SPI_FLASH_MISO => '1',
      i_UART0_RX => '1', o_UART0_TX => open, i_UART0_CTS_n => '0', o_UART0_RTR_n => open,
      o_RGB => open, o_RGB_CS_n => open, o_RGB_VS_n => open, o_RGB_HS_n => open, o_RGB_BK_n => open,
      o_VIDEO_50_60 => open, o_VIDEO_SCANLINES => open, o_VIDEO_SCANDOUBLE => open, o_VIDEO_MODE => open,
      o_MACHINE_TIMING => open, o_HDMI_RESET => open, o_HDMI_PIXEL => open, o_HDMI_LOCK => open,
      o_AUDIO_HDMI_AUDIO_EN => open, o_AUDIO_SPEAKER_EN => open, o_AUDIO_SPEAKER_EXCL => open,
      i_AUDIO_EAR => '0', o_AUDIO_MIC => open, o_AUDIO_EAR => open, o_AUDIO_L => open, o_AUDIO_R => open,
      o_RAM_A_ADDR => ram_a_addr, o_RAM_A_REQ => ram_a_req, o_RAM_A_RD_n => ram_a_rd_n,
      i_RAM_A_DI => ram_a_di, o_RAM_A_DO => ram_a_do,
      o_RAM_B_ADDR => ram_b_addr, o_RAM_B_REQ_T => ram_b_req_t, i_RAM_B_DI => ram_b_di,
      o_BUS_ADDR => open, i_BUS_DI => (others => '1'), o_BUS_DO => open,
      o_BUS_MREQ_n => open, o_BUS_IORQ_n => open, o_BUS_RD_n => open, o_BUS_WR_n => open, o_BUS_M1_n => open,
      i_BUS_WAIT_n => '1', i_BUS_NMI_n => '1', i_BUS_INT_n => '1', o_BUS_INT_n => open,
      i_BUS_BUSREQ_n => '1', o_BUS_BUSAK_n => open, o_BUS_HALT_n => open, o_BUS_RFSH_n => open,
      o_BUS_IEO => open, i_BUS_ROMCS_n => '1', i_BUS_IORQULA_n => '1', o_BUS_EN => open,
      o_BUS_CLKEN => open, o_BUS_NMI_DEBOUNCE_DISABLE => open,
      i_ESP_GPIO_20 => (others => '1'), o_ESP_GPIO_0 => open, o_ESP_GPIO_0_EN => open,
      i_GPIO => (others => '1'), o_GPIO => open, o_GPIO_EN => open,
      o_XDNA_LOAD => open, o_XDNA_SHIFT => open, i_XDNA_DO => '0',
      o_XADC_RESET => open, o_XADC_DEN => open, o_XADC_DADDR => open, o_XADC_DWE => open,
      i_XADC_DRDY => '0', o_XADC_DI => open, i_XADC_DO => (others => '0'), i_XADC_BUSY => '0',
      i_XADC_EOC => '0', i_XADC_EOS => '0', o_XADC_CONVST => open, o_XADC_CONTROL => open);

  -- -------------------------------------------------------------------------------- the run
  run : block
    alias nr_wr_en  is << signal .tb_next.dut.nr_wr_en  : std_logic >>;
    alias nr_wr_reg is << signal .tb_next.dut.nr_wr_reg : std_logic_vector(7 downto 0) >>;
    alias nr_wr_dat is << signal .tb_next.dut.nr_wr_dat : std_logic_vector(7 downto 0) >>;
    alias nr_reg    is << signal .tb_next.dut.nr_register : std_logic_vector(7 downto 0) >>;
    alias nr_rd     is << signal .tb_next.dut.port_253b_dat : std_logic_vector(7 downto 0) >>;
    alias m1_n      is << signal .tb_next.dut.z80_m1_n : std_logic >>;
    alias cpu_a     is << signal .tb_next.dut.z80_a : std_logic_vector(15 downto 0) >>;
    alias cpu_acc   is << signal .tb_next.dut.cpu_mod.z80n.ACC : std_logic_vector(7 downto 0) >>;
    alias cpu_f     is << signal .tb_next.dut.cpu_mod.z80n.F : std_logic_vector(7 downto 0) >>;
    alias cpu_sp    is << signal .tb_next.dut.cpu_mod.z80n.SP : unsigned(15 downto 0) >>;
    -- the raw frame counters of zxula_timing (where the interrupt position is defined and what
    -- Klive's line/HC are), not zxnext's hc/vc, which are the ULA's display-relative counts
    alias vc        is << signal .tb_next.dut.timing_mod.vc : unsigned(8 downto 0) >>;
    alias hc        is << signal .tb_next.dut.timing_mod.hc : unsigned(8 downto 0) >>;
  begin
    main : process
      file f : text;
      variable l, lmsg : line;
      variable st : file_open_status;
      variable addr, v, n : integer;
      variable clocks, cpu_clocks, marker_clock, marker_cpu : integer := 0;
      variable stop_pc, stop_a, stop_f, stop_sp : integer := -1;
      variable max_clocks : integer;
      variable rel_vc, rel_hc : integer := -1;  -- release the firmware's soft reset at this raster point
      variable prev_hc : integer := -1;
      variable entry_vc, entry_hc, stop_vc, stop_hc, stop_cpu, stop_clocks : integer := -1;
      variable frames_run, prev_vc : integer := 0;
      variable started, marker : boolean := false;
      variable soft_resets : integer := 0;
      variable prev_cpu : std_logic := '0';
      variable start_pc : integer := -1;
      variable all_zero : boolean;
    begin
      -- ---- memory before the run
      sram := (others => 0);
      for pass in 0 to 1 loop
        if pass = 0 then file_open(st, f, "init/sram-base.txt", read_mode);
        else file_open(st, f, "init/sram.txt", read_mode); end if;
        if st = open_ok then
          while not endfile(f) loop
            readline(f, l);
            next when l'length = 0;
            read(l, addr);
            for k in 0 to 63 loop read(l, v); sram(addr + k) := v; end loop;
          end loop;
          file_close(f);
        end if;
      end loop;
      file_open(st, f, "init/entry.txt", read_mode);
      if st = open_ok then readline(f, l); read(l, start_pc); file_close(f); end if;
      file_open(st, f, "init/release.txt", read_mode);
      if st = open_ok then readline(f, l); read(l, rel_vc); read(l, rel_hc); file_close(f); end if;
      max_clocks := MAX_CLOCKS;
      file_open(st, f, "init/limit.txt", read_mode);
      if st = open_ok then readline(f, l); read(l, max_clocks); file_close(f); end if;

      -- ---- power-on reset, then the boot ROM runs; its soft reset is the sequencer's
      reset <= '1';
      for k in 1 to 1100 loop wait until rising_edge(clk_28); end loop;
      reset <= '0';
      loop
        wait until rising_edge(clk_28);
        clocks := clocks + 1;
        if reset_hard = '1' then hard_reset_requested <= true; exit; end if;
        if reset_soft = '1' and reset = '0' then
          -- S_RESET_SOFT_0/1: the reset is held until the 10-bit counter runs out
          soft_resets := soft_resets + 1;
          reset <= '1';
          for k in 1 to 1024 loop wait until rising_edge(clk_28); end loop;
          -- then held until the raster reaches the release point (on the first 28 MHz clock of
          -- that HC), so the program's first fetch lands where Klive starts it: line 0, HC 0
          -- (init/release.txt, calibrated once per testbench; the raster runs through resets)
          if rel_vc >= 0 then
            loop
              wait until rising_edge(clk_28);
              exit when to_integer(vc) = rel_vc and to_integer(hc) = rel_hc and prev_hc /= rel_hc;
              prev_hc := to_integer(hc);
            end loop;
          end if;
          reset <= '0';
        end if;
        -- the program starts at its entry's first M1 (after the firmware's soft reset)
        if not started and soft_resets > 0 and m1_n = '0' and to_integer(unsigned(cpu_a)) = start_pc then
          started := true; clocks := 0; cpu_clocks := 0;
          entry_vc := to_integer(vc); entry_hc := to_integer(hc); prev_vc := entry_vc;
          write(lmsg, string'("STARTED")); writeline(output, lmsg);
        end if;
        if started then
          if clk_cpu = '1' and prev_cpu = '0' then cpu_clocks := cpu_clocks + 1; end if;
          -- frames since the first fetch: each time the raw line counter wraps to 0
          if to_integer(vc) = 0 and prev_vc /= 0 then frames_run := frames_run + 1; end if;
          prev_vc := to_integer(vc);
          -- the stop: the first M1 after the marker's write (the next instruction's fetch)
          if marker and m1_n = '0' then
            stop_vc := to_integer(vc); stop_hc := to_integer(hc); stop_cpu := cpu_clocks; stop_clocks := clocks;
            stop_pc := to_integer(unsigned(cpu_a));
            stop_a := to_integer(unsigned(cpu_acc)); stop_f := to_integer(unsigned(cpu_f));
            stop_sp := to_integer(cpu_sp);
            exit;
          end if;
          if not marker and nr_wr_en = '1' and nr_wr_reg = x"7F" and nr_wr_dat = x"A5" then
            marker := true; marker_clock := clocks; marker_cpu := cpu_clocks;
            write(lmsg, string'("MARKER ") & integer'image(clocks)); writeline(output, lmsg);
          end if;
          exit when clocks >= max_clocks;
          if clocks mod PROGRESS_EVERY = 0 then
            write(lmsg, string'("PROGRESS ") & integer'image(clocks)); writeline(output, lmsg);
          end if;
        elsif clocks > 3000000 then
          write(lmsg, string'("ERROR the program never started")); writeline(output, lmsg);
          exit;
        end if;
        prev_cpu := clk_cpu;
      end loop;

      -- ---- the RAM area of the SRAM ($40000 up), non-zero 64-byte blocks
      file_open(f, "out/sram.txt", write_mode);
      addr := 16#40000#;
      while addr < 2**21 loop
        all_zero := true;
        for k in 0 to 63 loop if sram(addr + k) /= 0 then all_zero := false; end if; end loop;
        if not all_zero then
          write(l, addr);
          for k in 0 to 63 loop write(l, " " & integer'image(sram(addr + k))); end loop;
          writeline(f, l);
        end if;
        addr := addr + 64;
      end loop;
      file_close(f);
      -- ---- banks 5 and 7 (the models write them in zero time)
      dump_banks <= true;
      wait for 1 ns;

      -- ---- read every NextReg through the core's read mux (registered on the 28 MHz clock)
      file_open(f, "out/result.txt", write_mode);
      write(l, string'("started ") & boolean'image(started)); writeline(f, l);
      write(l, string'("marker ") & boolean'image(marker) & " " & integer'image(marker_clock) & " " & integer'image(marker_cpu)); writeline(f, l);
      write(l, string'("clocks ") & integer'image(clocks)); writeline(f, l);
      write(l, string'("hard_reset ") & boolean'image(hard_reset_requested)); writeline(f, l);
      write(l, string'("entry_beam ") & integer'image(entry_vc) & " " & integer'image(entry_hc)); writeline(f, l);
      write(l, string'("stop_beam ") & integer'image(stop_vc) & " " & integer'image(stop_hc)); writeline(f, l);
      write(l, string'("stop_cpu ") & integer'image(stop_cpu)); writeline(f, l);
      write(l, string'("stop_clocks ") & integer'image(stop_clocks)); writeline(f, l);
      write(l, string'("stop_frame ") & integer'image(frames_run)); writeline(f, l);
      write(l, string'("pc ") & integer'image(stop_pc)); writeline(f, l);
      write(l, string'("a ") & integer'image(stop_a)); writeline(f, l);
      write(l, string'("f ") & integer'image(stop_f)); writeline(f, l);
      write(l, string'("sp ") & integer'image(stop_sp)); writeline(f, l);
      for r in 0 to 255 loop
        nr_reg <= force std_logic_vector(to_unsigned(r, 8));
        wait until rising_edge(clk_28);
        wait until rising_edge(clk_28);
        wait until falling_edge(clk_28);
        write(l, string'("nr ") & integer'image(r) & " " & integer'image(to_integer(unsigned(nr_rd))));
        writeline(f, l);
      end loop;
      nr_reg <= release;
      file_close(f);

      write(lmsg, string'("DONE")); writeline(output, lmsg);
      running <= false;
      wait;
    end process;
  end block;
end architecture;
