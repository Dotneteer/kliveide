
//------------------------------------------------------------------------------------------
//   ____  ____
//  /   /\/   /
// /___/  \  /
// \   \   \/    � Copyright 2019 Xilinx, Inc. All rights reserved.
//  \   \        This file contains confidential and proprietary information of Xilinx, Inc.
//  /   /        and is protected under U.S. and international copyright and other
// /___/   /\    intellectual property laws.
// \   \  /  \
//  \___\/\___\
//
//-------------------------------------------------------------------------------------------
// Device:              7-Series
// Author:              Tatsukawa, Kruger, Defossez
// Entity Name:         top_plle2
// Purpose:             This is a basic demonstration of the PLL_DRP
//                      connectivity to the PLL_ADV.
// Tools:               Vivado_2019.1 or newer
// Limitations:
//
// Vendor:              Xilinx Inc.
// Version:             1.40
// Filename:            top_plle2.v
// Date Created:        30-Jul-2014
// Date Last Modified:  25-Jun-2019
//-------------------------------------------------------------------------------------------
// Disclaimer:
//      This disclaimer is not a license and does not grant any rights to the materials
//      distributed herewith. Except as otherwise provided in a valid license issued to you
//      by Xilinx, and to the maximum extent permitted by applicable law: (1) THESE MATERIALS
//      ARE MADE AVAILABLE "AS IS" AND WITH ALL FAULTS, AND XILINX HEREBY DISCLAIMS ALL
//      WARRANTIES AND CONDITIONS, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED
//      TO WARRANTIES OF MERCHANTABILITY, NON-INFRINGEMENT, OR FITNESS FOR ANY PARTICULAR
//      PURPOSE; and (2) Xilinx shall not be liable (whether in contract or tort, including
//      negligence, or under any other theory of liability) for any loss or damage of any
//      kind or nature related to, arising under or in connection with these materials,
//      including for any direct, or any indirect, special, incidental, or consequential
//      loss or damage (including loss of data, profits, goodwill, or any type of loss or
//      damage suffered as a result of any action brought by a third party) even if such
//      damage or loss was reasonably foreseeable or Xilinx had been advised of the
//      possibility of the same.
//
// CRITICAL APPLICATIONS
//      Xilinx products are not designed or intended to be fail-safe, or for use in any
//      application requiring fail-safe performance, such as life-support or safety devices
//      or systems, Class III medical devices, nuclear facilities, applications related to
//      the deployment of airbags, or any other applications that could lead to death,
//      personal injury, or severe property or environmental damage (individually and
//      collectively, "Critical Applications"). Customer assumes the sole risk and
//      liability of any use of Xilinx products in Critical Applications, subject only to
//      applicable laws and regulations governing limitations on product liability.
//
// THIS COPYRIGHT NOTICE AND DISCLAIMER MUST BE RETAINED AS PART OF THIS FILE AT ALL TIMES.
//
// Contact:    e-mail  hotline@xilinx.com        phone   + 1 800 255 7778
//-------------------------------------------------------------------------------------------
// Revision History:
//  Rev: 30-Apr-2014 - Tatsukawa
//      Initial code release.
//  Rev: 06-Jul-2023 - Alvin Albrecht
//      Substantially modified for the ZX Spectrum Next
//      Consult XAPP888 for the original
//-------------------------------------------------------------------------------------------

// This file is part of the ZX Spectrum Next Project
// <https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA/tree/master/cores>

`timescale 1ps/1ps

//-------------------------------------------------------------------------------------------
// Entity pin description
//-------------------------------------------------------------------------------------------
// Inputs
//      SSTEP:      Start a reconfiguration. It should only be pulsed for one clock cycle.
//      STATE:      Determines which state the PLL_ADV will be reconfigured to. A value
//                  of 0 correlates to state 1, and a value of 1 correlates to state 2.
//      RST:        RST will reset the entire reference design including the PLL_ADV.
//      CLKIN:      Clock for the PLL_ADV CLKIN as well as the clock for the PLL_DRP module
//      SRDY_N:     Asserts after the PLL_ADV is locked and the
//                  PLL_DRP module is ready to start another re-configuration.
// Outputs
//      LOCKED_OUT: PLL is locked after configuration or reconfiguration.
//      CLK0OUT:    These are the clock outputs from the PLL_ADV.
//      CLK1OUT:    These are the clock outputs from the PLL_ADV.
//      CLK2OUT:    These are the clock outputs from the PLL_ADV.
//      CLK3OUT:    These are the clock outputs from the PLL_ADV.
//      CLK4OUT:    These are the clock outputs from the PLL_ADV.
//      CLK5OUT:    These are the clock outputs from the PLL_ADV.
//-------------------------------------------------------------------------------------------

// PLL_1
//
// state  description    multiplier
//
//   0    50Hz 48K         45/52
//   1    50Hz 128K        45/38
//   2    50Hz Pentagon    50/64
//   3    60Hz 48K         39/32
//   4    60Hz 128K        35/76

`timescale 1ps/1ps

module top_1_plle2
   (
      input       RST,
      input       SSTEP,
      input [2:0] STATE,
      input       CLKDRP,
      //
      output      SRDY_N,
      output      LOCKED_OUT,
      //
      input       CLKIN,
      output      CLKOUT
   );
//-------------------------------------------------------------------------------------------
// These signals are used as direct connections between the PLL_ADV and the
// PLL_DRP.
wire [15:0]     di;
wire [6:0]      daddr; //pll_drp
wire [15:0]     dout;
wire            den;
wire            dwe;
wire            dclk;
wire            rst_pll;
wire            drdy;
reg [3:0]       sstep_int = 4'b0000;
wire            sstep_single_cycle;
wire            clkfb;
wire            LOCKED;
//-------------------------------------------------------------------------------------------
// PLL_ADV that reconfiguration will take place on
//
//  BANDWIDTH:              : "HIGH", "LOW", "OPTIMIZED"
//  DIVCLK_DIVIDE           : Value from 1 to 56
//  CLKFBOUT_MULT           : Value from 2 to 64
//  CLKFBOUT_PHASE          :
//  CLKIN1_PERIOD           : Value from 0.968 to 100.000. Set the period (ns) of input clocks
//  REF_JITTER1             :
//  CLKIN2_PERIOD           :
//  REF_JITTER2             :
//  CLKOUT parameters:
//  DIVIDE                  : Value from 1 to 128
//  DUTY_CYCLE              : 0.01 to 0.99 - This is dependent on the divide value.
//  PHASE                   : 0.0 to 360.0 - This is dependent on the divide value.
//  Misc parameters
//  COMPENSATION
//
PLLE2_ADV #(
    .BANDWIDTH          ("OPTIMIZED"),
    .DIVCLK_DIVIDE      (1),
    .CLKFBOUT_MULT      (45),
    .CLKFBOUT_PHASE     (0.0),
    .CLKIN1_PERIOD      (35.714),
    .REF_JITTER1        (0.010),
    .CLKIN2_PERIOD      (35.714),
    .REF_JITTER2        (0.010),
    .CLKOUT0_DIVIDE     (38),
    .CLKOUT0_DUTY_CYCLE (0.5),
    .CLKOUT0_PHASE      (0.0),
    .CLKOUT1_DIVIDE     (32),
    .CLKOUT1_DUTY_CYCLE (0.5),
    .CLKOUT1_PHASE      (0.0),
    .CLKOUT2_DIVIDE     (32),
    .CLKOUT2_DUTY_CYCLE (0.5),
    .CLKOUT2_PHASE      (0.0),
    .CLKOUT3_DIVIDE     (32),
    .CLKOUT3_DUTY_CYCLE (0.5),
    .CLKOUT3_PHASE      (0.0),
    .CLKOUT4_DIVIDE     (32),
    .CLKOUT4_DUTY_CYCLE (0.5),
    .CLKOUT4_PHASE      (0.0),
    .CLKOUT5_DIVIDE     (32),
    .CLKOUT5_DUTY_CYCLE (0.5),
    .CLKOUT5_PHASE      (0.0),
    .COMPENSATION       ("ZHOLD")
) plle2_adv_inst (
    .CLKFBOUT           (clkfb),
    .CLKOUT0            (CLKOUT),
    .CLKOUT1            (),
    .CLKOUT2            (),
    .CLKOUT3            (),
    .CLKOUT4            (),
    .CLKOUT5            (),
    .DO                 (dout),
    .DRDY               (drdy),
    .DADDR              (daddr),
    .DCLK               (dclk),
    .DEN                (den),
    .DI                 (di),
    .DWE                (dwe),
    .LOCKED             (LOCKED),
    .CLKFBIN            (clkfb),
    .CLKIN1             (CLKIN),
    .CLKIN2             (CLKIN),
    .CLKINSEL           (1'b1),
    .PWRDWN             (1'b0),
    .RST                (rst_pll)
);

// PLL_DRP instance that will perform the reconfiguration operations

drp_plle2 #(
    // Register the LOCKED signal with the PLLE3_ADV input clock.
    // The LOCKED_IN (LOCKED from the PLLE3_ADV) is fed into a register and then
    // passed the LOCKED_OUT when REGISTER_LOCKED is set to "Reg" or when set to
    // "NoReg" LOCKED_IN is just passed on to LOCKED_OUT without being registered.

    .REGISTER_LOCKED       ("Reg"),

    // Use the registered LOCKED signal from the PLLE3 also for the DRP state machine.

    .USE_REG_LOCKED        ("No"),

    // Possible combination of above two parameters:
    // | REGISTER_LOCKED | USE_REG_LOCKED |                                            |
    // |-----------------|----------------|--------------------------------------------|
    // |      "NoReg"    |     "No"       | LOCKED is just passed through PLLe3_drp   |
    // |                 |                | and is used as is with the state machine   |
    // |      "NoReg"    |     "Yes"      | NOT ALLOWED                                |
    // |       "Reg"     |     "No"       | LOCKED is registered but the unregistered  |
    // |                 |                | version is used for the state machine.     |
    // |       "Reg"     |     "Yes"      | LOCKED is registered and the registered    |
    // |                 |                | version is also used by the state machine. |
    //

    //***********************************************************************
    // Unused Output Dividers
    //***********************************************************************
    
    .O_CLKOUT3_DIVIDE(32),
    .O_CLKOUT3_PHASE(0),
    .O_CLKOUT3_DUTY(50000),
    
    .O_CLKOUT4_DIVIDE(32),
    .O_CLKOUT4_PHASE(0),
    .O_CLKOUT4_DUTY(50000),
    
    .O_CLKOUT5_DIVIDE(32),
    .O_CLKOUT5_PHASE(0),
    .O_CLKOUT5_DUTY(50000),

    //***********************************************************************
    // State 0 Parameters - 48K 50Hz
    //***********************************************************************

    .S0_CLKFBOUT_MULT(45),
    .S0_CLKFBOUT_PHASE(0),
    .S0_BANDWIDTH("OPTIMIZED"),
    .S0_DIVCLK_DIVIDE(1),

    .S0_CLKOUT0_DIVIDE(52),
    .S0_CLKOUT0_PHASE(0),
    .S0_CLKOUT0_DUTY(50000),

    .S0_CLKOUT1_DIVIDE(52),
    .S0_CLKOUT1_PHASE(0),
    .S0_CLKOUT1_DUTY(50000),

    .S0_CLKOUT2_DIVIDE(52),
    .S0_CLKOUT2_PHASE(0),
    .S0_CLKOUT2_DUTY(50000),
    
    //***********************************************************************
    // State 1 Parameters - 128K 50Hz
    //***********************************************************************

    .S1_CLKFBOUT_MULT(45),
    .S1_CLKFBOUT_PHASE(0),
    .S1_BANDWIDTH("OPTIMIZED"),
    .S1_DIVCLK_DIVIDE(1),

    .S1_CLKOUT0_DIVIDE(38),
    .S1_CLKOUT0_PHASE(0),
    .S1_CLKOUT0_DUTY(50000),

    .S1_CLKOUT1_DIVIDE(38),
    .S1_CLKOUT1_PHASE(0),
    .S1_CLKOUT1_DUTY(50000),
    
    .S1_CLKOUT2_DIVIDE(38),
    .S1_CLKOUT2_PHASE(0),
    .S1_CLKOUT2_DUTY(50000),

    //***********************************************************************
    // State 2 Parameters - Pentagon 50Hz
    //***********************************************************************

    .S2_CLKFBOUT_MULT(50),
    .S2_CLKFBOUT_PHASE(0),
    .S2_BANDWIDTH("OPTIMIZED"),
    .S2_DIVCLK_DIVIDE(1),

    .S2_CLKOUT0_DIVIDE(64),
    .S2_CLKOUT0_PHASE(0),
    .S2_CLKOUT0_DUTY(50000),

    .S2_CLKOUT1_DIVIDE(64),
    .S2_CLKOUT1_PHASE(0),
    .S2_CLKOUT1_DUTY(50000),

    .S2_CLKOUT2_DIVIDE(64),
    .S2_CLKOUT2_PHASE(0),
    .S2_CLKOUT2_DUTY(50000),
    
    //***********************************************************************
    // State 3 Parameters - 48K 60Hz
    //***********************************************************************

    .S3_CLKFBOUT_MULT(39),
    .S3_CLKFBOUT_PHASE(0),
    .S3_BANDWIDTH("OPTIMIZED"),
    .S3_DIVCLK_DIVIDE(1),

    .S3_CLKOUT0_DIVIDE(32),
    .S3_CLKOUT0_PHASE(0),
    .S3_CLKOUT0_DUTY(50000),

    .S3_CLKOUT1_DIVIDE(32),
    .S3_CLKOUT1_PHASE(0),
    .S3_CLKOUT1_DUTY(50000),

    .S3_CLKOUT2_DIVIDE(32),
    .S3_CLKOUT2_PHASE(0),
    .S3_CLKOUT2_DUTY(50000),
    
    //***********************************************************************
    // State 4 Parameters - 128K 60Hz
    //***********************************************************************

    .S4_CLKFBOUT_MULT(35),
    .S4_CLKFBOUT_PHASE(0),
    .S4_BANDWIDTH("OPTIMIZED"),
    .S4_DIVCLK_DIVIDE(1),

    .S4_CLKOUT0_DIVIDE(76),
    .S4_CLKOUT0_PHASE(0),
    .S4_CLKOUT0_DUTY(50000),

    .S4_CLKOUT1_DIVIDE(76),
    .S4_CLKOUT1_PHASE(0),
    .S4_CLKOUT1_DUTY(50000),

    .S4_CLKOUT2_DIVIDE(76),
    .S4_CLKOUT2_PHASE(0),
    .S4_CLKOUT2_DUTY(50000)

) drp_plle2_inst (
    .SADDR              (STATE),
    .SEN                (sstep_single_cycle),
    .RST                (RST),
    .SRDY_N             (SRDY_N),
    .SCLK               (CLKDRP),
    .DO                 (dout),
    .DRDY               (drdy),
    .LOCK_REG_CLK_IN    (CLKDRP),
    .LOCKED_IN          (LOCKED),
    .DWE                (dwe),
    .DEN                (den),
    .DADDR              (daddr),
    .DI                 (di),
    .DCLK               (dclk),
    .RST_PLL            (rst_pll),
    .LOCKED_OUT         (LOCKED_OUT)
);

// Only start DRP after initial lock and when STATE has changed

always @(posedge CLKDRP) 
    sstep_int <= {SSTEP, sstep_int[3:1]};

assign sstep_single_cycle = sstep_int[1] & ~sstep_int[0];

//-------------------------------------------------------------------------------------------
endmodule
