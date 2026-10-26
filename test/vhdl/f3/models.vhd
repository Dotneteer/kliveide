-- F3 of .plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md: simulation models for the parts of the ZX Spectrum
-- Next core that have no VHDL source in _input/next-fpga/src (Xilinx CORE Generator RAMs, the boot
-- ROM's BRAM), plus a dpram2 that can be preloaded. Written for the testbench, not taken from the
-- core: each states the behaviour it assumes.

-- ---------------------------------------------------------------------------------------------------
-- f3_sim: what the testbench and the models share. dump_banks: the testbench raises it at the end
-- of a run, and the bank 5 / bank 7 RAMs write their contents to out/bank5.txt / out/bank7.txt.
package f3_sim is
  signal dump_banks : boolean := false;
end package;

-- ---------------------------------------------------------------------------------------------------
-- dpram2 (replaces ram/dpram2.vhd in the testbench build). Same ports and timing as the core's:
-- port A writes and reads on clk_a's rising edge (a read in the same cycle as a write returns the
-- old byte), port B reads on clk_b's rising edge. Banks 5 and 7 live in two of these instances; an
-- instance whose path names bank5_ram / bank7_ram starts from init/bank5.txt / init/bank7.txt
-- ("offset value" lines, only the non-zero bytes) when the file exists, so the testbench can start
-- from the memory Klive's harness loaded, and writes out/bank5.txt / out/bank7.txt (same format)
-- when f3_sim.dump_banks rises. Every other instance starts all zero, as the core's own does.
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use std.textio.all;
use work.f3_sim.all;

entity dpram2 is
  generic (
    addr_width_g : integer := 8;
    data_width_g : integer := 8;
    init_file_g  : string  := "init/none.bin.txt"
  );
  port (
    clk_a_i  : in  std_logic;
    we_i     : in  std_logic;
    addr_a_i : in  std_logic_vector(addr_width_g-1 downto 0);
    data_a_i : in  std_logic_vector(data_width_g-1 downto 0);
    data_a_o : out std_logic_vector(data_width_g-1 downto 0);
    clk_b_i  : in  std_logic;
    addr_b_i : in  std_logic_vector(addr_width_g-1 downto 0);
    data_b_o : out std_logic_vector(data_width_g-1 downto 0)
  );
end entity;

architecture sim of dpram2 is
  type ram_t is array (0 to 2**addr_width_g-1) of std_logic_vector(data_width_g-1 downto 0);

  function contains(s, part : string) return boolean is
  begin
    if part'length > s'length then return false; end if;
    for i in s'low to s'high - part'length + 1 loop
      if s(i to i + part'length - 1) = part then return true; end if;
    end loop;
    return false;
  end function;

  impure function init_ram(path : string) return ram_t is
    variable ram : ram_t := (others => (others => '0'));
    file f : text;
    variable st : file_open_status;
    variable l : line;
    variable v, i : integer;
    variable name : line;
  begin
    if contains(path, "bank5_ram") then
      name := new string'("init/bank5.txt");
    elsif contains(path, "bank7_ram") then
      name := new string'("init/bank7.txt");
    else
      return ram;
    end if;
    file_open(st, f, name.all, read_mode);
    if st /= open_ok then return ram; end if;
    while not endfile(f) loop
      readline(f, l);
      next when l'length = 0;
      read(l, i);
      read(l, v);
      ram(i) := std_logic_vector(to_unsigned(v, data_width_g));
    end loop;
    file_close(f);
    return ram;
  end function;

  signal ram_q : ram_t := init_ram(dpram2'path_name);
begin
  mem_a : process (clk_a_i)
  begin
    if rising_edge(clk_a_i) then
      if we_i = '1' then
        ram_q(to_integer(unsigned(addr_a_i))) <= data_a_i;
      end if;
      data_a_o <= ram_q(to_integer(unsigned(addr_a_i)));
    end if;
  end process;

  mem_b : process (clk_b_i)
  begin
    if rising_edge(clk_b_i) then
      data_b_o <= ram_q(to_integer(unsigned(addr_b_i)));
    end if;
  end process;

  dump : process
    file f : text;
    variable l : line;
    variable bank : integer := -1;
  begin
    if contains(dpram2'path_name, "bank5_ram") then bank := 5;
    elsif contains(dpram2'path_name, "bank7_ram") then bank := 7;
    end if;
    if bank < 0 then wait; end if;
    wait until dump_banks;
    file_open(f, "out/bank" & integer'image(bank) & ".txt", write_mode);
    for i in ram_q'range loop
      if to_integer(unsigned(ram_q(i))) /= 0 then
        write(l, integer'image(i) & " " & integer'image(to_integer(unsigned(ram_q(i)))));
        writeline(f, l);
      end if;
    end loop;
    file_close(f);
    wait;
  end process;
end architecture;

-- ---------------------------------------------------------------------------------------------------
-- bootrom (rom/bootrom.vhd needs Xilinx UNISIM). An 8K ROM read on clk's rising edge, as a block RAM
-- is, holding init/bootrom.txt (one decimal byte per line): the testbench's stand-in for the firmware.
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
use std.textio.all;

entity bootrom is
  port (
    CLK  : in  std_logic;
    ADDR : in  std_logic_vector(12 downto 0);
    DATA : out std_logic_vector(7 downto 0)
  );
end entity;

architecture sim of bootrom is
  type rom_t is array (0 to 8191) of std_logic_vector(7 downto 0);
  impure function init_rom return rom_t is
    variable rom : rom_t := (others => (others => '0'));
    file f : text;
    variable st : file_open_status;
    variable l : line;
    variable v, i : integer;
  begin
    file_open(st, f, "init/bootrom.txt", read_mode);
    if st /= open_ok then return rom; end if;
    i := 0;
    while not endfile(f) and i < 8192 loop
      readline(f, l);
      read(l, v);
      rom(i) := std_logic_vector(to_unsigned(v, 8));
      i := i + 1;
    end loop;
    file_close(f);
    return rom;
  end function;
  constant ROM : rom_t := init_rom;
begin
  process (CLK)
  begin
    if rising_edge(CLK) then
      DATA <= ROM(to_integer(unsigned(ADDR)));
    end if;
  end process;
end architecture;

-- ---------------------------------------------------------------------------------------------------
-- Xilinx CORE Generator RAMs (their .xco files are not in the source). Distributed RAMs: synchronous
-- write, asynchronous read. Block RAM: synchronous read. ASSUMPTION, to verify before sprite and
-- tilemap results count: no extra output register on any of them.
library ieee; use ieee.std_logic_1164.all; use ieee.numeric_std.all;
entity sdpram_64_9 is
  port (DPRA : in std_logic_vector(5 downto 0); CLK : in std_logic; WE : in std_logic;
        DPO : out std_logic_vector(8 downto 0); A : in std_logic_vector(5 downto 0); D : in std_logic_vector(8 downto 0));
end;
architecture sim of sdpram_64_9 is
  type ram_t is array (0 to 63) of std_logic_vector(8 downto 0);
  signal ram : ram_t := (others => (others => '0'));
begin
  process (CLK) begin if rising_edge(CLK) then if WE = '1' then ram(to_integer(unsigned(A))) <= D; end if; end if; end process;
  DPO <= ram(to_integer(unsigned(DPRA)));
end;

library ieee; use ieee.std_logic_1164.all; use ieee.numeric_std.all;
entity sdpram_128_8 is
  port (DPRA : in std_logic_vector(6 downto 0); CLK : in std_logic; WE : in std_logic;
        DPO : out std_logic_vector(7 downto 0); A : in std_logic_vector(6 downto 0); D : in std_logic_vector(7 downto 0));
end;
architecture sim of sdpram_128_8 is
  type ram_t is array (0 to 127) of std_logic_vector(7 downto 0);
  signal ram : ram_t := (others => (others => '0'));
begin
  process (CLK) begin if rising_edge(CLK) then if WE = '1' then ram(to_integer(unsigned(A))) <= D; end if; end if; end process;
  DPO <= ram(to_integer(unsigned(DPRA)));
end;

library ieee; use ieee.std_logic_1164.all; use ieee.numeric_std.all;
entity sdpram_16_9 is
  port (DPRA : in std_logic_vector(3 downto 0); CLK : in std_logic; WE : in std_logic;
        DPO : out std_logic_vector(8 downto 0); A : in std_logic_vector(3 downto 0); D : in std_logic_vector(8 downto 0));
end;
architecture sim of sdpram_16_9 is
  type ram_t is array (0 to 15) of std_logic_vector(8 downto 0);
  signal ram : ram_t := (others => (others => '0'));
begin
  process (CLK) begin if rising_edge(CLK) then if WE = '1' then ram(to_integer(unsigned(A))) <= D; end if; end if; end process;
  DPO <= ram(to_integer(unsigned(DPRA)));
end;

library ieee; use ieee.std_logic_1164.all; use ieee.numeric_std.all;
entity spram_320_9 is
  port (CLK : in std_logic; WE : in std_logic; SPO : out std_logic_vector(8 downto 0);
        A : in std_logic_vector(8 downto 0); D : in std_logic_vector(8 downto 0));
end;
architecture sim of spram_320_9 is
  type ram_t is array (0 to 511) of std_logic_vector(8 downto 0);
  signal ram : ram_t := (others => (others => '0'));
begin
  process (CLK) begin if rising_edge(CLK) then if WE = '1' then ram(to_integer(unsigned(A))) <= D; end if; end if; end process;
  SPO <= ram(to_integer(unsigned(A)));
end;

library ieee; use ieee.std_logic_1164.all; use ieee.numeric_std.all;
entity sdpbram_16k_8 is
  port (WEA : in std_logic_vector(0 downto 0); ADDRA : in std_logic_vector(13 downto 0); DINA : in std_logic_vector(7 downto 0);
        CLKA : in std_logic; ENB : in std_logic; ADDRB : in std_logic_vector(13 downto 0);
        DOUTB : out std_logic_vector(7 downto 0); CLKB : in std_logic);
end;
architecture sim of sdpbram_16k_8 is
  type ram_t is array (0 to 16383) of std_logic_vector(7 downto 0);
  signal ram : ram_t := (others => (others => '0'));
begin
  process (CLKA) begin if rising_edge(CLKA) then if WEA(0) = '1' then ram(to_integer(unsigned(ADDRA))) <= DINA; end if; end if; end process;
  process (CLKB) begin if rising_edge(CLKB) then if ENB = '1' then DOUTB <= ram(to_integer(unsigned(ADDRB))); end if; end if; end process;
end;
