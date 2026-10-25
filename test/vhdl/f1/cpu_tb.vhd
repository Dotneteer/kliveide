-- F1 of .plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md: the T80N from the ZX Spectrum Next FPGA source
-- (_input/next-fpga/src/cpu/t80na.vhd, unchanged) running the single-instruction cases written by
-- generate-cases.cjs. The CPU sees a flat 64K RAM and one I/O value; nothing else of the Next.
--
-- Per case: the CPU is reset; its first three reads are served "JP $8000" without touching RAM
-- (prelude); the case's prologue at $8000 loads every register and jumps to $8020; the instruction
-- runs; at the first M1 after it, PC, T-states, I, R, IFF1, IFF2 and IM are sampled, and from then
-- on every read is served the epilogue below (again without RAM) whose writes deliver SP, AF, BC,
-- DE, HL, IX, IY and the alternate set. Only the instruction's own writes reach RAM.
--
-- Generics: CASES (input file), RESULTS (output file), IO_VALUE (unused: each case says what its
-- I/O reads return),
-- PROGRESS_EVERY (a "PROGRESS n" line on stdout every n cases), TRACE_ID (>= 0: print the bus
-- cycles of that case).
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use std.textio.all;
use work.Z80N_pack.all;

entity cpu_tb is
  generic (
    CASES          : string  := "cases-0.txt";
    RESULTS        : string  := "results-0.txt";
    IO_VALUE       : integer := 255;
    PROGRESS_EVERY : integer := 1000;
    TRACE_ID       : integer := -1
  );
end entity;

architecture sim of cpu_tb is
  constant HALF : time := 5 ns;

  signal clk_n  : std_logic := '0';
  signal rst_n  : std_logic := '0';
  signal m1_n, mreq_n, iorq_n, rd_n, wr_n, rfsh_n, halt_n, busak_n : std_logic;
  signal a      : std_logic_vector(15 downto 0);
  signal di     : std_logic_vector(7 downto 0) := x"FF";
  signal do     : std_logic_vector(7 downto 0);
  signal z_dout : std_logic;
  signal z_data : std_logic_vector(15 downto 0);
  signal z_cmd  : Z80N_seq;
  signal running : boolean := true;

  type byte_array is array (natural range <>) of integer range 0 to 255;

  -- The epilogue: LD (nn),SP / PUSH AF / LD (nn),BC / LD (nn),DE / LD (nn),HL / LD (nn),IX /
  -- LD (nn),IY / EXX / LD (nn),BC / LD (nn),DE / LD (nn),HL / EX AF,AF' / PUSH AF
  constant EPI : byte_array(0 to 37) := (
    16#ED#, 16#73#, 16#00#, 16#FF#,  16#F5#,
    16#ED#, 16#43#, 16#02#, 16#FF#,  16#ED#, 16#53#, 16#04#, 16#FF#,  16#22#, 16#06#, 16#FF#,
    16#DD#, 16#22#, 16#08#, 16#FF#,  16#FD#, 16#22#, 16#0A#, 16#FF#,  16#D9#,
    16#ED#, 16#43#, 16#0C#, 16#FF#,  16#ED#, 16#53#, 16#0E#, 16#FF#,  16#22#, 16#10#, 16#FF#,
    16#08#, 16#F5#);
  constant EPI_WRITES : integer := 22;
  -- M1 cycles of the epilogue: ED 73, F5, ED 43, ED 53, 22, DD 22, FD 22, D9, ED 43, ED 53, 22, 08, F5
  constant EPI_M1 : integer := 2 + 1 + 2 + 2 + 1 + 2 + 2 + 1 + 2 + 2 + 1 + 1 + 1;
  constant PRELUDE : byte_array(0 to 2) := (16#C3#, 16#00#, 16#80#);
  constant INSTR_ADDR : integer := 16#8020#;
  constant WATCHDOG : integer := 4000; -- clocks per case before it is reported as a timeout

  function to_int(v : std_logic_vector) return integer is
  begin
    if is_x(v) then return -1; end if;
    return to_integer(unsigned(v));
  end function;
  function bit_int(b : std_logic) return integer is
  begin
    if b = '1' then return 1; elsif b = '0' then return 0; else return -1; end if;
  end function;
begin
  clk_n <= not clk_n after HALF when running else clk_n;

  cpu : entity work.T80Na
    generic map (Mode => 0)
    port map (
      RESET_n => rst_n, CLK_n => clk_n, WAIT_n => '1', INT_n => '1', NMI_n => '1', BUSRQ_n => '1',
      M1_n => m1_n, MREQ_n => mreq_n, IORQ_n => iorq_n, RD_n => rd_n, WR_n => wr_n, RFSH_n => rfsh_n,
      HALT_n => halt_n, BUSAK_n => busak_n, A => a, D_i => di, D_o => do,
      Z80N_dout_o => z_dout, Z80N_data_o => z_data, Z80N_command_o => z_cmd);

  -- A block after the CPU instance, so the external names below exist when they are elaborated
  run : block
  -- Internal state read through VHDL-2008 external names (not visible on the CPU's pins)
    alias t_r    is << signal .cpu_tb.cpu.z80n.R        : unsigned(7 downto 0) >>;
    alias t_i    is << signal .cpu_tb.cpu.z80n.I        : std_logic_vector(7 downto 0) >>;
    alias t_iff1 is << signal .cpu_tb.cpu.z80n.IntE_FF1 : std_logic >>;
    alias t_iff2 is << signal .cpu_tb.cpu.z80n.IntE_FF2 : std_logic >>;
    alias t_im   is << signal .cpu_tb.cpu.z80n.IStatus  : std_logic_vector(1 downto 0) >>;
  begin
  main : process
    type ram_t is array (0 to 65535) of integer range 0 to 255;
    variable ram : ram_t := (others => 0);

    file f_in  : text;
    file f_out : text;
    variable lin, lout, lmsg : line;
    variable ok : boolean;

    -- the current case
    variable id, m1_target, n_instr, io_value, n, v, addr : integer;
    type int_array is array (natural range <>) of integer;
    variable mem_addr : int_array(0 to 1023);
    variable n_mem : integer;

    -- writes by the instruction: address, value before the first write
    variable w_addr, w_pre : int_array(0 to 255);
    variable n_w : integer;
    variable epi_w_addr, epi_w_val : int_array(0 to EPI_WRITES - 1);
    variable n_epi_w : integer;

    type mode_t is (M_PRELUDE, M_RUN, M_INSTR, M_EPI, M_DONE);
    variable mode : mode_t;
    variable idx, m1_count, clocks, t_start, t_instr, pc_after : integer;
    variable s_r, s_i, s_iff1, s_iff2, s_im : integer;
    variable prev_m1, prev_rd, prev_wr : std_logic;
    variable done_cases : integer := 0;
    variable timeout, trace : boolean;
    variable io_writes : integer;
    -- The address of the memory read in progress, taken when the read starts: the core issues one
    -- SRAM request per read with the address of that moment (zxnext.vhd ~3150-3165, sram_req_t),
    -- and the T80N may move the address bus before the read ends (seen in LDPIRX).
    variable rd_addr : integer := 0;

    procedure serve is
      -- Drives the data bus for the read in progress (seen at this half-cycle)
    begin
      if rd_n = '0' and mreq_n = '0' then
        case mode is
          when M_PRELUDE => di <= std_logic_vector(to_unsigned(PRELUDE(idx), 8));
          when M_EPI =>
            if idx <= EPI'high then di <= std_logic_vector(to_unsigned(EPI(idx), 8)); else di <= x"00"; end if;
          when others => di <= std_logic_vector(to_unsigned(ram(rd_addr), 8));
        end case;
      elsif rd_n = '0' and iorq_n = '0' then
        di <= std_logic_vector(to_unsigned(io_value, 8));
      end if;
    end procedure;

    procedure word16(lo, hi : integer; variable res : out integer) is
    begin
      res := epi_w_val(lo) + 256 * epi_w_val(hi);
    end procedure;
    variable r_sp, r_af, r_bc, r_de, r_hl, r_ix, r_iy, r_bc2, r_de2, r_hl2, r_af2 : integer;
    variable capture_ok : boolean;
    variable tmp : integer;
  begin
    file_open(f_in, CASES, read_mode);
    file_open(f_out, RESULTS, write_mode);
    while not endfile(f_in) loop
      -- ---------------------------------------------------------------- load the case
      readline(f_in, lin);
      next when lin'length = 0;
      read(lin, id); read(lin, m1_target); read(lin, n_instr); read(lin, io_value);
      read(lin, n);
      for k in 0 to n - 1 loop read(lin, v); ram(16#8000# + k) := v; end loop;
      read(lin, n);
      for k in 0 to n - 1 loop read(lin, v); ram(16#8080# + k) := v; end loop;
      read(lin, n_mem);
      for k in 0 to n_mem - 1 loop read(lin, addr); read(lin, v); mem_addr(k) := addr; ram(addr) := v; end loop;
      trace := id = TRACE_ID;

      -- ---------------------------------------------------------------- run it
      mode := M_PRELUDE; idx := 0; m1_count := 0; clocks := 0; n_w := 0; n_epi_w := 0;
      t_start := 0; t_instr := -1; pc_after := -1; timeout := false; io_writes := 0;
      prev_m1 := '1'; prev_rd := '1'; prev_wr := '1';
      rst_n <= '0';
      for k in 1 to 4 loop wait until rising_edge(clk_n); end loop;
      rst_n <= '1';
      loop
        wait on clk_n;
        if rising_edge(clk_n) then clocks := clocks + 1; end if;
        if trace then
          write(lmsg, string'("TRACE clk=") & integer'image(clocks) & " A=" & integer'image(to_int(a)) &
                " M1=" & std_logic'image(m1_n) & " MREQ=" & std_logic'image(mreq_n) & " IORQ=" & std_logic'image(iorq_n) &
                " RD=" & std_logic'image(rd_n) & " WR=" & std_logic'image(wr_n) & " DI=" & integer'image(to_int(di)) &
                " DO=" & integer'image(to_int(do)));
          writeline(output, lmsg);
        end if;

        -- a new M1 cycle
        if m1_n = '0' and prev_m1 = '1' then
          if mode = M_RUN and to_int(a) = INSTR_ADDR then
            mode := M_INSTR; m1_count := 1; t_start := clocks;
          elsif mode = M_INSTR then
            m1_count := m1_count + 1;
            if m1_count = m1_target + 1 then
              -- the first fetch after the instruction: PC and T-states now, then serve the epilogue.
              -- I, R, IFF and IM are read when the epilogue ends: the T80N applies EI/DI/RETN/IM/LD I,A/
              -- LD R,A during the *next* fetch (T2/T3), which no program can observe in between.
              t_instr := clocks - t_start; pc_after := to_int(a);
              mode := M_EPI; idx := 0;
            end if;
          end if;
        end if;

        -- a memory read finished: advance the served sequence
        if rd_n = '1' and prev_rd = '0' and (mode = M_PRELUDE or mode = M_EPI) then
          idx := idx + 1;
          if mode = M_PRELUDE and idx = PRELUDE'length then mode := M_RUN; end if;
        end if;

        -- a write started
        if wr_n = '0' and prev_wr = '1' then
          if iorq_n = '0' then
            io_writes := io_writes + 1;
          elsif mode = M_EPI then
            if n_epi_w < EPI_WRITES then
              epi_w_addr(n_epi_w) := to_int(a); epi_w_val(n_epi_w) := to_int(do); n_epi_w := n_epi_w + 1;
            end if;
            if n_epi_w = EPI_WRITES then
              -- the epilogue's last write: none of its instructions touches I, IFF or IM, and its
              -- 20 M1 cycles (EPI_M1) have each added 1 to R's low 7 bits
              s_i := to_int(t_i); s_iff1 := bit_int(t_iff1); s_iff2 := bit_int(t_iff2); s_im := to_int(t_im);
              s_r := to_integer(t_r);
              s_r := (s_r / 128) * 128 + ((s_r mod 128) - EPI_M1 + 128) mod 128;
              mode := M_DONE;
            end if;
          else
            addr := to_int(a); v := to_int(do);
            if addr >= 0 and v >= 0 then
              tmp := -1;
              for k in 0 to n_w - 1 loop if w_addr(k) = addr then tmp := k; end if; end loop;
              if tmp < 0 and n_w <= w_addr'high then w_addr(n_w) := addr; w_pre(n_w) := ram(addr); n_w := n_w + 1; end if;
              ram(addr) := v;
            end if;
          end if;
        end if;

        -- a memory read started: keep its address
        if rd_n = '0' and prev_rd = '1' and mreq_n = '0' and to_int(a) >= 0 then rd_addr := to_int(a); end if;

        prev_m1 := m1_n; prev_rd := rd_n; prev_wr := wr_n;
        serve;
        exit when mode = M_DONE;
        if clocks > WATCHDOG then timeout := true; exit; end if;
      end loop;

      -- ---------------------------------------------------------------- report
      capture_ok := not timeout and n_epi_w = EPI_WRITES;
      write(lout, id);
      if not capture_ok then
        write(lout, string'(" ERROR"));
        if timeout then write(lout, string'(" timeout")); end if;
        write(lout, string'(" mode=") & mode_t'image(mode) & " m1=" & integer'image(m1_count) & " epiw=" & integer'image(n_epi_w));
      else
        -- order of the epilogue's writes: SP lo/hi, A, F, BC, DE, HL, IX, IY, BC', DE', HL', A', F'
        word16(0, 1, r_sp);
        r_af := epi_w_val(2) * 256 + epi_w_val(3);
        word16(4, 5, r_bc); word16(6, 7, r_de); word16(8, 9, r_hl); word16(10, 11, r_ix); word16(12, 13, r_iy);
        word16(14, 15, r_bc2); word16(16, 17, r_de2); word16(18, 19, r_hl2);
        r_af2 := epi_w_val(20) * 256 + epi_w_val(21);
        -- the captured addresses must be the epilogue's own (else the parse above is wrong)
        if epi_w_addr(0) /= 16#FF00# or epi_w_addr(1) /= 16#FF01# or epi_w_addr(4) /= 16#FF02# or epi_w_addr(19) /= 16#FF11# then
          write(lout, string'(" ERROR capture-order"));
        else
          write(lout, " " & integer'image(pc_after) & " " & integer'image(r_af) & " " & integer'image(r_bc) & " " &
                integer'image(r_de) & " " & integer'image(r_hl) & " " & integer'image(r_af2) & " " & integer'image(r_bc2) & " " &
                integer'image(r_de2) & " " & integer'image(r_hl2) & " " & integer'image(r_ix) & " " & integer'image(r_iy) & " " &
                integer'image(r_sp) & " " & integer'image(s_i) & " " & integer'image(s_r) & " " & integer'image(s_iff1) & " " &
                integer'image(s_iff2) & " " & integer'image(s_im) & " " & integer'image(t_instr));
          -- memory changes, by address
          for x in 0 to n_w - 2 loop
            for y in 0 to n_w - 2 - x loop
              if w_addr(y) > w_addr(y + 1) then
                tmp := w_addr(y); w_addr(y) := w_addr(y + 1); w_addr(y + 1) := tmp;
                tmp := w_pre(y); w_pre(y) := w_pre(y + 1); w_pre(y + 1) := tmp;
              end if;
            end loop;
          end loop;
          n := 0;
          for k in 0 to n_w - 1 loop if ram(w_addr(k)) /= w_pre(k) then n := n + 1; end if; end loop;
          write(lout, " " & integer'image(n));
          for k in 0 to n_w - 1 loop
            if ram(w_addr(k)) /= w_pre(k) then write(lout, " " & integer'image(w_addr(k)) & " " & integer'image(ram(w_addr(k)))); end if;
          end loop;
          write(lout, " io " & integer'image(io_writes));
        end if;
      end if;
      writeline(f_out, lout);

      -- ---------------------------------------------------------------- back to the baseline (all zero)
      for k in 0 to n_mem - 1 loop ram(mem_addr(k)) := 0; end loop;
      for k in 0 to n_w - 1 loop ram(w_addr(k)) := 0; end loop;

      done_cases := done_cases + 1;
      if done_cases mod PROGRESS_EVERY = 0 then
        write(lmsg, string'("PROGRESS ") & integer'image(done_cases));
        writeline(output, lmsg);
      end if;
    end loop;
    file_close(f_in);
    file_close(f_out);
    write(lmsg, string'("DONE ") & integer'image(done_cases));
    writeline(output, lmsg);
    running <= false;
    wait;
  end process;
  end block;
end architecture;
