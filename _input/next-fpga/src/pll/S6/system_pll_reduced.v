///////////////////////////////////////////////////////////////////////////////
//    
//    Company:          Xilinx
//    Engineer:         Karl Kurbjun and Carl Ribbing
//    Date:             2/19/2009
//    Design Name:      PLL DRP
//    Module Name:      top.v
//    Version:          1.0
//    Target Devices:   Spartan 6 Family
//    Tool versions:    L.68 (lin)
//    Description:      This is a basic demonstration of the PLL_DRP 
//                      connectivity to the PLL_ADV.
// 
//    Disclaimer:  XILINX IS PROVIDING THIS DESIGN, CODE, OR
//                 INFORMATION "AS IS" SOLELY FOR USE IN DEVELOPING
//                 PROGRAMS AND SOLUTIONS FOR XILINX DEVICES.  BY
//                 PROVIDING THIS DESIGN, CODE, OR INFORMATION AS
//                 ONE POSSIBLE IMPLEMENTATION OF THIS FEATURE,
//                 APPLICATION OR STANDARD, XILINX IS MAKING NO
//                 REPRESENTATION THAT THIS IMPLEMENTATION IS FREE
//                 FROM ANY CLAIMS OF INFRINGEMENT, AND YOU ARE
//                 RESPONSIBLE FOR OBTAINING ANY RIGHTS YOU MAY
//                 REQUIRE FOR YOUR IMPLEMENTATION.  XILINX
//                 EXPRESSLY DISCLAIMS ANY WARRANTY WHATSOEVER WITH
//                 RESPECT TO THE ADEQUACY OF THE IMPLEMENTATION,
//                 INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OR
//                 REPRESENTATIONS THAT THIS IMPLEMENTATION IS FREE
//                 FROM CLAIMS OF INFRINGEMENT, IMPLIED WARRANTIES
//                 OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
//                 PURPOSE.
// 
//                 (c) Copyright 2008 Xilinx, Inc.
//                 All rights reserved.
// 
///////////////////////////////////////////////////////////////////////////////

// Substantially modified, original can be found in XAPP879

// This file is part of the ZX Spectrum Next Project
// <https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA/tree/master/cores>

`timescale 1ps/1ps

module system_pll_reduced
   (
      // drp

      input RST,
      input SSTEP,          // power on or video mode change
      input STATE,          // VGA 0-1
      input CLKDRP,
      output SRDY_N,        // clocks locked
      
      // clk

      input CLKIN,
      
      output CLK0OUT,       // 28 MHz
      output CLK1OUT,       // 28 Mhz inverted
      output CLK2OUT,       // 14 MHz
      output CLK3OUT,       //  7 MHz
      output CLK4OUT        // 28 MHz * 5 inverted
   );
   
   reg [3:0]      sstep_int = 4'b0000;
   wire           sstep_single_cycle;
   
   // These signals are used as direct connections between the PLL_ADV and the
   // DRP_PLL.
   
   wire [15:0]    di;
   wire [4:0]     daddr;
   wire [15:0]    dout;
   wire           den;
   wire           dwe;
   wire           dclk;
   wire           rst_pll;
   wire           drdy;
   wire           locked;
   
   // These signals are used for the BUFGs necessary for the design.

   wire           clkfb;
   
   wire           clk0_bufgin;
   wire           clk0_bufgout;
   
   wire           clk1_bufgin;
   wire           clk1_bufgout;
   
   wire           clk2_bufgin;
   wire           clk2_bufgout;
   
   wire           clk3_bufgin;
   wire           clk3_bufgout;
   
   wire           clk4_bufgin;
   wire           clk4_bufgout;

   BUFG BUFG_CLK0 (
      .O(CLK0OUT),
      .I(clk0_bufgin) 
   );
   
   BUFG BUFG_CLK1 (
      .O(CLK1OUT),
      .I(clk1_bufgin) 
   );
   
   BUFG BUFG_CLK2 (
      .O(CLK2OUT),
      .I(clk2_bufgin) 
   );
   
   BUFG BUFG_CLK3 (
      .O(CLK3OUT),
      .I(clk3_bufgin) 
   );
   
   BUFG BUFG_CLK4 (
      .O(CLK4OUT),
      .I(clk4_bufgin) 
   );

   // PLL_ADV that reconfiguration will take place on
   PLL_ADV #(
      .SIM_DEVICE("SPARTAN6"),
      .DIVCLK_DIVIDE(1), // 1 to 52
      
      .BANDWIDTH("LOW"), // "HIGH", "LOW" or "OPTIMIZED"
      
      // CLKFBOUT stuff
      .CLKFBOUT_MULT(14), 
      .CLKFBOUT_PHASE(0.0),
      
      // Set the clock period (ns) of input clocks and reference jitter
      .REF_JITTER(0.100),
      .CLKIN1_PERIOD(20.000),
      .CLKIN2_PERIOD(20.000), 

      // CLKOUT parameters:
      // DIVIDE: (1 to 128)
      // DUTY_CYCLE: (0.01 to 0.99) - This is dependent on the divide value.
      // PHASE: (0.0 to 360.0) - This is dependent on the divide value.
      .CLKOUT0_DIVIDE(25),        // 28 MHz
      .CLKOUT0_DUTY_CYCLE(0.5),
      .CLKOUT0_PHASE(0.0), 
      
      .CLKOUT1_DIVIDE(25),        // 28 MHz inverted
      .CLKOUT1_DUTY_CYCLE(0.5),
      .CLKOUT1_PHASE(180.0), 
      
      .CLKOUT2_DIVIDE(50),        // 14 MHz
      .CLKOUT2_DUTY_CYCLE(0.5),
      .CLKOUT2_PHASE(0.0),
      
      .CLKOUT3_DIVIDE(100),       //  7 MHz
      .CLKOUT3_DUTY_CYCLE(0.5),
      .CLKOUT3_PHASE(0.0),
      
      .CLKOUT4_DIVIDE(5),         // 28 MHz * 5 inverted
      .CLKOUT4_DUTY_CYCLE(0.5),
      .CLKOUT4_PHASE(180.0), 
      
      .CLKOUT5_DIVIDE(100),       // not used
      .CLKOUT5_DUTY_CYCLE(0.5),
      .CLKOUT5_PHASE(0.0),
      
      // Set the compensation
      .COMPENSATION("SYSTEM_SYNCHRONOUS"),
      
      // PMCD stuff (not used)
      .EN_REL("FALSE"),
      .PLL_PMCD_MODE("FALSE"),
      .RST_DEASSERT_CLK("CLKIN1")
   ) PLL_ADV_inst (
      .CLKFBDCM(),
      .CLKFBOUT(clkfb),

      // CLK outputs
      .CLKOUT0(clk0_bufgin),      // 28 MHz
      .CLKOUT1(clk1_bufgin),      // 28 MHz inverted
      .CLKOUT2(clk2_bufgin),      // 14 MHz
      .CLKOUT3(clk3_bufgin),      //  7 MHz
      .CLKOUT4(clk4_bufgin),      // 28 MHz * 5 inverted
      .CLKOUT5(),
      
      // CLKOUTS to DCM
      .CLKOUTDCM0(),
      .CLKOUTDCM1(),
      .CLKOUTDCM2(), 
      .CLKOUTDCM3(),
      .CLKOUTDCM4(),
      .CLKOUTDCM5(), 
      
      // DRP Ports
      .DO(dout),
      .DRDY(drdy), 
      .DADDR(daddr), 
      .DCLK(dclk),
      .DEN(den),
      .DI(di),
      .DWE(dwe),
      
      .LOCKED(locked),
      .CLKFBIN(clkfb),
      
      // Clock inputs
      .CLKIN1(CLKIN), 
      .CLKIN2(),
      .CLKINSEL(1'b1),
      
      .REL(1'b0),
      .RST(rst_pll)
   );
   
   // DRP_PLL instance that will perform the reconfiguration operations
   drp_pll_reduced #(
   
      //***********************************************************************
      // VGA-0, FSYS = 28 MHz
      //***********************************************************************
      
      .S0_CLKFBOUT_MULT(14),
      .S0_CLKFBOUT_PHASE(0),
      .S0_BANDWIDTH("LOW"),
      .S0_DIVCLK_DIVIDE(1),

      .S0_CLKOUT0_DIVIDE(25),
      .S0_CLKOUT0_PHASE(0),
      .S0_CLKOUT0_DUTY(50000),

      .S0_CLKOUT1_DIVIDE(25),
      .S0_CLKOUT1_PHASE(180000),
      .S0_CLKOUT1_DUTY(50000),

      .S0_CLKOUT2_DIVIDE(50),
      .S0_CLKOUT2_PHASE(0),
      .S0_CLKOUT2_DUTY(50000),

      .S0_CLKOUT3_DIVIDE(100),
      .S0_CLKOUT3_PHASE(0),
      .S0_CLKOUT3_DUTY(50000),

      .S0_CLKOUT4_DIVIDE(5),
      .S0_CLKOUT4_PHASE(180000),
      .S0_CLKOUT4_DUTY(50000),

      //***********************************************************************
      // VGA-1, FSYS = 28.571429 MHz
      //***********************************************************************
      
      .S1_CLKFBOUT_MULT(16),
      .S1_CLKFBOUT_PHASE(0),
      .S1_BANDWIDTH("LOW"),
      .S1_DIVCLK_DIVIDE(1),
          
      .S1_CLKOUT0_DIVIDE(28),
      .S1_CLKOUT0_PHASE(0),
      .S1_CLKOUT0_DUTY(50000),
          
      .S1_CLKOUT1_DIVIDE(28),
      .S1_CLKOUT1_PHASE(180000),
      .S1_CLKOUT1_DUTY(50000),
          
      .S1_CLKOUT2_DIVIDE(56),
      .S1_CLKOUT2_PHASE(0),
      .S1_CLKOUT2_DUTY(50000),
          
      .S1_CLKOUT3_DIVIDE(112),
      .S1_CLKOUT3_PHASE(0),
      .S1_CLKOUT3_DUTY(50000),
          
      .S1_CLKOUT4_DIVIDE(6),
      .S1_CLKOUT4_PHASE(180000),
      .S1_CLKOUT4_DUTY(50000)

      //***********************************************************************
     
   ) DRP_PLL_REDUCED_inst (
      // Top port connections
      .SADDR(STATE),
      .SEN(sstep_single_cycle),
      .RST(RST),
      .SRDY_N(SRDY_N),
      .SCLK(CLKDRP),
      
      // Direct connections to the PLL_ADV
      .DO(dout),
      .DRDY(drdy),
      .LOCKED(locked),
      .DWE(dwe),
      .DEN(den),
      .DADDR(daddr),
      .DI(di),
      .DCLK(dclk),
      .RST_PLL(rst_pll)
   );

   always @(posedge CLKDRP)
      sstep_int <= {SSTEP, sstep_int[3:1]};    // must delay SSTEP by four cycles

   assign sstep_single_cycle = sstep_int[1] & ~sstep_int[0];

endmodule

