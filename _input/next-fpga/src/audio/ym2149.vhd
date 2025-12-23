--
-- A simulation model of YM2149 (AY-3-8910 with bells on)
--
-- Copyright (c) MikeJ - Jan 2005
--
-- All rights reserved
--
-- Redistribution and use in source and synthezised forms, with or without
-- modification, are permitted provided that the following conditions are met:
--
-- Redistributions of source code must retain the above copyright notice,
-- this list of conditions and the following disclaimer.
--
-- Redistributions in synthesized form must reproduce the above copyright
-- notice, this list of conditions and the following disclaimer in the
-- documentation and/or other materials provided with the distribution.
--
-- Neither the name of the author nor the names of other contributors may
-- be used to endorse or promote products derived from this software without
-- specific prior written permission.
--
-- THIS CODE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
-- AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
-- THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
-- PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE
-- LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
-- CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
-- SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
-- INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
-- CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
-- ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
-- POSSIBILITY OF SUCH DAMAGE.
--
-- You are responsible for any legal issues arising from your use of this code.
--
-- The latest version of this file can be found at: www.fpgaarcade.com
--
-- Email support@fpgaarcade.com
--
-- Revision list
--
-- version 001 initial release
--
-- Clues from MAME sound driver and Kazuhiro TSUJIKAWA
--
-- These are the measured outputs from a real chip for a single Isolated channel into a 1K load (V)
-- vol 15 .. 0
-- 3.27 2.995 2.741 2.588 2.452 2.372 2.301 2.258 2.220 2.198 2.178 2.166 2.155 2.148 2.141 2.132
-- As the envelope volume is 5 bit, I have fitted a curve to the not quite log shape in order
-- to produced all the required values.
-- (The first part of the curve is a bit steeper and the last bit is more linear than expected)
--

-- Modifications made for the ZX Spectrum Next Project
-- <https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA/tree/master/cores>
--
-- 1. Bus addressing moved out of module
-- 2. Channel mixing moved out of module
-- 3. Eliminate unnecessary busctrl_re
-- 4. Make zero volume actually zero volume in the tables.
--    (Not how the real hw works but it makes audio out of the zx next cleaner)
-- 5. Add differences in how registers are read back on YM and AY
-- 6. Fix bug where envelope period counter was not reset on envelope reset
-- 7. Export currently selected register

library ieee;
use IEEE.std_logic_1164.all;
use IEEE.numeric_std.all;

entity YM2149 is
   generic (
      constant AY_ID    : std_logic_vector(1 downto 0) := "00"
   );
   port (
      CLK               : in  std_logic;     -- note 6 Mhz
      ENA               : in  std_logic;     -- clock enable for higher speed operation
      RESET_H           : in  std_logic;
      I_SEL_L           : in  std_logic;
      -- data bus
      I_DA              : in  std_logic_vector(7 downto 0);
      O_DA              : out std_logic_vector(7 downto 0);
      I_REG             : in  std_logic;
      -- control
      busctrl_addr      : in  std_logic;
      busctrl_we        : in  std_logic;
      ctrl_aymode       : in  std_logic;     -- 0 = YM, 1 = AY
      -- I/O ports
      port_a_i          : in  std_logic_vector(7 downto 0);
      port_a_o          : out std_logic_vector(7 downto 0);
      port_b_i          : in  std_logic_vector(7 downto 0);
      port_b_o          : out std_logic_vector(7 downto 0);
      -- audio channels out
      O_AUDIO_A         : out std_logic_vector(7 downto 0);
      O_AUDIO_B         : out std_logic_vector(7 downto 0);
      O_AUDIO_C         : out std_logic_vector(7 downto 0)
   );
end;

architecture RTL of YM2149 is

   -- signals
   type  array_16x8 is array (0 to 15) of std_logic_vector(7 downto 0);
   type  array_3x12 is array (1 to 3) of std_logic_vector(11 downto 0);
   
   signal cnt_div          : std_logic_vector(3 downto 0) := (others => '0');
   signal noise_div        : std_logic := '0';
   signal ena_div          : std_logic;
   signal ena_div_noise    : std_logic;
   signal noise_gen_comp   : std_logic_vector(4 downto 0);
   signal poly17_zero      : std_logic;
   signal poly17           : std_logic_vector(16 downto 0) := (others => '0');
   
   -- registers
   signal addr             : std_logic_vector(4 downto 0);
   
   signal reg              : array_16x8;
   signal env_reset        : std_logic;
   
   signal noise_gen_cnt    : std_logic_vector(4 downto 0);
   signal noise_gen_op     : std_logic;
   signal tone_gen_freq    : array_3x12;
   signal tone_gen_comp    : array_3x12;
   signal tone_gen_cnt     : array_3x12 := (others => (others => '0'));
   signal tone_gen_op      : std_logic_vector(3 downto 1) := "000";
   
   signal is_zero          : std_logic;
   signal is_ones          : std_logic;
   signal is_bot           : std_logic;
   signal is_bot_p1        : std_logic;
   signal is_top_m1        : std_logic;
   signal is_top           : std_logic;
   
   signal env_gen_freq     : std_logic_vector(15 downto 0);
   signal env_gen_comp     : std_logic_vector(15 downto 0);
   signal env_gen_cnt      : std_logic_vector(15 downto 0);
   signal env_ena          : std_logic;
   signal env_hold         : std_logic;
   signal env_inc          : std_logic;
   signal env_vol          : std_logic_vector(4 downto 0);
   
   signal chan_mixed       : std_logic_vector(2 downto 0);
   
   signal A                : std_logic_vector(4 downto 0);
   signal B                : std_logic_vector(4 downto 0);
   signal C                : std_logic_vector(4 downto 0);

   type volTableType32 is array (0 to 31) of unsigned(7 downto 0);
   type volTableType16 is array (0 to 15) of unsigned(7 downto 0);

   constant volTableAy : volTableType16 :=(
      x"00", x"03", x"04", x"06",
      x"0a", x"0f", x"15", x"22", 
      x"28", x"41", x"5b", x"72", 
      x"90", x"b5", x"d7", x"ff" 
   );

   constant volTableYm : volTableType32 :=(
      x"00", x"01", x"01", x"02", x"02", x"03", x"03", x"04",
      x"06", x"07", x"09", x"0a", x"0c", x"0e", x"11", x"13",
      x"17", x"1b", x"20", x"25", x"2c", x"35", x"3e", x"47",
      x"54", x"66", x"77", x"88", x"a1", x"c0", x"e0", x"ff"
   );    

begin

   --p_waddr                : process(RESET_H, busctrl_addr)  
   process(clk)
   begin
      if clk'event and clk = '1' then
         if (RESET_H = '1') then
            addr <= (others => '0');
         elsif  busctrl_addr = '1' then -- yuk
            addr <= I_DA(4 downto 0);
         end if;
      end if;
   end process;

   --p_wdata                : process(RESET_H, busctrl_we, addr)
   process(clk)
   begin
      if clk'event and clk = '1' then
         env_reset <= '0';
         
         if RESET_H = '1' then
            reg <= (others => (others => '0'));
            reg(7) <= x"ff";
      
         elsif busctrl_we = '1' and addr(4) = '0' then    -- bits 7:5 are checked for 0 outside this module
               case addr(3 downto 0) is
                  when x"0" => reg(0)  <= I_DA;
                  when x"1" => reg(1)  <= I_DA;
                  when x"2" => reg(2)  <= I_DA;
                  when x"3" => reg(3)  <= I_DA;
                  when x"4" => reg(4)  <= I_DA;
                  when x"5" => reg(5)  <= I_DA;
                  when x"6" => reg(6)  <= I_DA;
                  when x"7" => reg(7)  <= I_DA;
                  when x"8" => reg(8)  <= I_DA;
                  when x"9" => reg(9)  <= I_DA;
                  when x"A" => reg(10) <= I_DA;
                  when x"B" => reg(11) <= I_DA;
                  when x"C" => reg(12) <= I_DA;
                  when x"D" => reg(13) <= I_DA;
                  when x"E" => reg(14) <= I_DA;
                  when x"F" => reg(15) <= I_DA;
                  when others => null;
               end case;
            
               if addr(3 downto 0) = x"D" then
                  env_reset <= '1';
               end if;
         end if;
      end if;
   end process;

   --p_rdata                : process(busctrl_re, addr, reg)
   process(clk)
   begin
      if clk'event and clk = '1' then
         if I_REG = '1' then
            O_DA <= AY_ID & '0' & addr;
         elsif addr(4) = '1' and ctrl_aymode = '0' then
            O_DA <= x"FF";
         else
            case addr(3 downto 0) is
               when x"0" => O_DA <= reg(0) ;
               when x"1" => O_DA <= (reg(1)(7) and not ctrl_aymode) & (reg(1)(6) and not ctrl_aymode) & (reg(1)(5) and not ctrl_aymode) & (reg(1)(4) and not ctrl_aymode) & reg(1)(3 downto 0) ;
               when x"2" => O_DA <= reg(2) ;
               when x"3" => O_DA <= (reg(3)(7) and not ctrl_aymode) & (reg(3)(6) and not ctrl_aymode) & (reg(3)(5) and not ctrl_aymode) & (reg(3)(4) and not ctrl_aymode) & reg(3)(3 downto 0) ;
               when x"4" => O_DA <= reg(4) ;
               when x"5" => O_DA <= (reg(5)(7) and not ctrl_aymode) & (reg(5)(6) and not ctrl_aymode) & (reg(5)(5) and not ctrl_aymode) & (reg(5)(4) and not ctrl_aymode) & reg(5)(3 downto 0) ;
               when x"6" => O_DA <= (reg(6)(7) and not ctrl_aymode) & (reg(6)(6) and not ctrl_aymode) & (reg(6)(5) and not ctrl_aymode) & reg(6)(4 downto 0) ;
               when x"7" => O_DA <= reg(7) ;
               when x"8" => O_DA <= (reg(8)(7) and not ctrl_aymode) & (reg(8)(6) and not ctrl_aymode) & (reg(8)(5) and not ctrl_aymode) & reg(8)(4 downto 0) ;
               when x"9" => O_DA <= (reg(9)(7) and not ctrl_aymode) & (reg(9)(6) and not ctrl_aymode) & (reg(9)(5) and not ctrl_aymode) & reg(9)(4 downto 0) ;
               when x"A" => O_DA <= (reg(10)(7) and not ctrl_aymode) & (reg(10)(6) and not ctrl_aymode) & (reg(10)(5) and not ctrl_aymode) & reg(10)(4 downto 0) ;
               when x"B" => O_DA <= reg(11);
               when x"C" => O_DA <= reg(12);
               when x"D" => O_DA <= (reg(13)(7) and not ctrl_aymode) & (reg(13)(6) and not ctrl_aymode) & (reg(13)(5) and not ctrl_aymode) & (reg(13)(4) and not ctrl_aymode) & reg(13)(3 downto 0) ;
               when x"E" => if (reg(7)(6) = '0') then -- input
                     O_DA <= port_a_i;
                  else
                     O_DA <= reg(14) and port_a_i;
                  end if;
               when x"F" => if (Reg(7)(7) = '0') then
                     O_DA <= port_b_i;
                  else
                     O_DA <= reg(15) and port_b_i;
                  end if;
               when others => null;
            end case;
         end if;
      end if;
   end process;

   port_a_o <= reg(14);
   port_b_o <= reg(15);

   --  p_divider              : process
   process(clk)
   begin
      if clk'event and clk = '1' then
         if ENA = '1' then
            ena_div <= '0';
            ena_div_noise <= '0';
            if (cnt_div = "0000") then
               cnt_div <= (not I_SEL_L) & "111";
               ena_div <= '1';

               noise_div <= not noise_div;
               if (noise_div = '1') then
                  ena_div_noise <= '1';
               end if;
            else
               cnt_div <= std_logic_vector(unsigned(cnt_div) - 1);
            end if;
         end if;
      end if;
   end process;  

   --  p_noise_gen            : process
   
   noise_gen_comp <= (std_logic_vector(unsigned(reg(6)(4 downto 0)) - 1)) when (reg(6)(4 downto 1) /= "0000") else (others => '0');
   poly17_zero <= '1' when (poly17 = "00000000000000000") else '0';
   
   process(clk)
   begin
      if clk'event and clk = '1' then
         if (ENA = '1') then
            if (ena_div_noise = '1') then -- divider ena
               if (noise_gen_cnt >= noise_gen_comp) then
                  noise_gen_cnt <= "00000";
                  poly17 <= (poly17(0) xor poly17(2) xor poly17_zero) & poly17(16 downto 1);
               else
                  noise_gen_cnt <= std_logic_vector(unsigned(noise_gen_cnt) + 1);
               end if;
            end if;
         end if;
      end if;
   end process;
   
   noise_gen_op <= poly17(0);

   --p_tone_gens            : process
   
   tone_gen_freq(1) <= reg(1)(3 downto 0) & reg(0);
   tone_gen_freq(2) <= reg(3)(3 downto 0) & reg(2);
   tone_gen_freq(3) <= reg(5)(3 downto 0) & reg(4);
   
   tone_gen_comp(1) <= (std_logic_vector(unsigned(tone_gen_freq(1)) - 1)) when (tone_gen_freq(1)(11 downto 1) /= (x"00" & "000")) else (others => '0');
   tone_gen_comp(2) <= (std_logic_vector(unsigned(tone_gen_freq(2)) - 1)) when (tone_gen_freq(2)(11 downto 1) /= (x"00" & "000")) else (others => '0');
   tone_gen_comp(3) <= (std_logic_vector(unsigned(tone_gen_freq(3)) - 1)) when (tone_gen_freq(3)(11 downto 1) /= (x"00" & "000")) else (others => '0');
   
   process(clk)
   begin
      if clk'event and clk = '1' then
         if (ENA = '1') then
            for i in 1 to 3 loop
               if (ena_div = '1') then -- divider ena
                  if (tone_gen_cnt(i) >= tone_gen_comp(i)) then
                     tone_gen_cnt(i) <= x"000";
                     tone_gen_op(i) <= not tone_gen_op(i);
                  else
                     tone_gen_cnt(i) <= std_logic_vector(unsigned(tone_gen_cnt(i)) + 1);
                  end if;
               end if;
            end loop;
         end if;
      end if;
   end process;

   --p_envelope_freq        : process
   
   env_gen_freq <= reg(12) & reg(11);
   env_gen_comp <= (std_logic_vector(unsigned(env_gen_freq) - 1)) when (env_gen_freq(15 downto 1) /= (x"000" & "000")) else (others => '0');
   
   process(clk)
   begin
      if clk'event and clk = '1' then
         if env_reset = '1' then
            env_gen_cnt <= x"0000";
            env_ena <= '1';
         elsif (ENA = '1') then
            if (ena_div = '1') then -- divider ena
               if (env_gen_cnt >= env_gen_comp) then
                  env_gen_cnt <= x"0000";
                  env_ena <= '1';
               else
                  env_gen_cnt <= std_logic_vector( unsigned( env_gen_cnt ) + 1 );
                  env_ena <= '0';
               end if;
            else
               env_ena <= '0';
            end if;
         end if;
      end if;
   end process;

   --p_envelope_shape       : process(env_reset, CLK)
   
   is_zero <= '1' when env_vol(4 downto 1) = "0000" else '0';
   is_ones <= '1' when env_vol(4 downto 1) = "1111" else '0';
   
   is_bot <= '1' when is_zero = '1' and env_vol(0) = '0' else '0';
   is_bot_p1 <= '1' when is_zero ='1' and env_vol(0) = '1' else '0';
   is_top_m1 <= '1' when is_ones = '1' and env_vol(0) = '0' else '0';
   is_top <= '1' when is_ones = '1' and env_vol(0) = '1' else '0';

   process(clk)
   begin
        -- envelope shapes
        -- C AtAlH
        -- 0 0 x x  \___
        --
        -- 0 1 x x  /___
        --
        -- 1 0 0 0  \\\\
        --
        -- 1 0 0 1  \___
        --
        -- 1 0 1 0  \/\/
        --           ___
        -- 1 0 1 1  \
        --
        -- 1 1 0 0  ////
        --           ___
        -- 1 1 0 1  /
        --
        -- 1 1 1 0  /\/\
        --
        -- 1 1 1 1  /___
      if clk'event and clk = '1' then
         if env_reset = '1' then
            -- load initial state
            if (reg(13)(2) = '0') then -- attack
               env_vol <= "11111";
               env_inc <= '0'; -- -1
            else
               env_vol <= "00000";
               env_inc <= '1'; -- +1
            end if;
            env_hold <= '0';
         elsif (ENA = '1') and (env_ena = '1') then
            if (env_hold = '0') then
               if (env_inc = '1') then
                  env_vol <= std_logic_vector( unsigned( env_vol ) + "00001");
               else
                  env_vol <= std_logic_vector( unsigned( env_vol ) + "11111");
               end if;
            end if;
            -- envelope shape control.
            if (reg(13)(3) = '0') then
               if (env_inc = '0') then -- down
                  if is_bot_p1 = '1' then
                     env_hold <= '1'; 
                  end if;
               else
                  if is_top = '1' then
                     env_hold <= '1';
                  end if;
               end if;
            elsif (reg(13)(0) = '1') then -- hold = 1
               if (env_inc = '0') then -- down
                  if (reg(13)(1) = '1') then -- alt
                     if is_bot = '1' then
                        env_hold <= '1';
                     end if;
                  else
                     if is_bot_p1 = '1' then
                        env_hold <= '1';
                     end if;
                  end if;
               else
                  if (reg(13)(1) = '1') then -- alt
                     if is_top = '1' then
                        env_hold <= '1';
                     end if;
                  else
                     if is_top_m1 = '1' then
                        env_hold <= '1'; 
                     end if;
                  end if;
               end if;
            elsif (reg(13)(1) = '1') then -- alternate
               if (env_inc = '0') then -- down
                  if is_bot_p1 = '1' then 
                     env_hold <= '1';
                  end if;
                  if is_bot = '1' then
                     env_hold <= '0';
                     env_inc <= '1';
                  end if;
               else
                  if is_top_m1 = '1' then
                     env_hold <= '1';
                  end if;
                  if is_top = '1' then
                     env_hold <= '0';
                     env_inc <= '0';
                  end if;
               end if;
            end if;
         end if;
      end if;
   end process;

   --p_chan_mixer_table     : process
   
   chan_mixed(0) <= (reg(7)(0) or tone_gen_op(1)) and (reg(7)(3) or noise_gen_op);
   chan_mixed(1) <= (reg(7)(1) or tone_gen_op(2)) and (reg(7)(4) or noise_gen_op);
   chan_mixed(2) <= (reg(7)(2) or tone_gen_op(3)) and (reg(7)(5) or noise_gen_op);
   
   process(clk)
   begin
      if clk'event and clk = '1' then
         if (ENA = '1') then

            A <= "00000";
            B <= "00000";
            C <= "00000";

            if (chan_mixed(0) = '1') then
               if (reg(8)(4) = '0') then
                  if (reg(8)(3 downto 0) = "0000") then
                     A <= "00000";
                  else
                     A <= reg(8)(3 downto 0) & "1";
                  end if;
               else
                  A <= env_vol(4 downto 0);
               end if;
            end if;

            if (chan_mixed(1) = '1') then
               if (reg(9)(4) = '0') then
                  if (reg(9)(3 downto 0) = "0000") then
                     B <= "00000";
                  else
                     B <= reg(9)(3 downto 0) & "1";
                  end if;
               else
                  B <= env_vol(4 downto 0);
               end if;
            end if;

            if (chan_mixed(2) = '1') then
               if (reg(10)(4) = '0') then
                  if (reg(10)(3 downto 0) = "0000") then
                     C <= "00000";
                  else
                     C <= reg(10)(3 downto 0) & "1";
                  end if;
               else
                  C <= env_vol(4 downto 0);
               end if;
            end if;

         end if;
      end if;    
   end process;

   process(clk)
   begin
      if clk'event and clk = '1' then
         if RESET_H = '1' then
            O_AUDIO_A <= x"00";
            O_AUDIO_B <= x"00";
            O_AUDIO_C <= x"00";
         else
            if(ctrl_aymode = '0') then
               O_AUDIO_A <= std_logic_vector( volTableYm( to_integer( unsigned( A ) ) ) );
               O_AUDIO_B <= std_logic_vector( volTableYm( to_integer( unsigned( B ) ) ) );
               O_AUDIO_C <= std_logic_vector( volTableYm( to_integer( unsigned( C ) ) ) );
            else
               O_AUDIO_A <= std_logic_vector( volTableAy( to_integer( unsigned( A(4 downto 1) ) ) ) );
               O_AUDIO_B <= std_logic_vector( volTableAy( to_integer( unsigned( B(4 downto 1) ) ) ) );
               O_AUDIO_C <= std_logic_vector( volTableAy( to_integer( unsigned( C(4 downto 1) ) ) ) );
            end if;
         end if;
      end if;
   end process;

end architecture RTL;
