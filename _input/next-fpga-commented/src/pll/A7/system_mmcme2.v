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
// Entity Name:         top_mmcme2
// Purpose:             This is a basic demonstration of the MMCM_DRP
//                      connectivity to the MMCM_ADV.
// Tools:               Vivado_2019.1 or newer
// Limitations:
//
// Vendor:              Xilinx Inc.
// Version:             1.40
// Filename:            top_mmcme2.v
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
//      Initial code release
//  Rev: 25-Jun-2019 - Defossez
//      Add possibility to register the LOCKED signal.
//  Rev: 08-May-2022 - Alvin Albrecht
//      Specialized for ZX Spectrum Next project, consult XAPP888 for original
//-------------------------------------------------------------------------------------------

// This file is part of the ZX Spectrum Next Project
// <https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA/tree/master/cores>

`timescale 1ps/1ps

//-------------------------------------------------------------------------------------------
// Entity pin description
//-------------------------------------------------------------------------------------------
// Inputs
//      SSTEP:      Start a reconfiguration. It should only be pulsed for one clock cycle.
//      STATE:      Determines which state the MMCM_ADV will be reconfigured to. A value
//                  of 0 correlates to state 1, and a value of 1 correlates to state 2.
//      RST:        RST will reset the entire reference design including the MMCM_ADV.
//      CLKIN:      Clock for the MMCM_ADV CLKIN as well as the clock for the MMCM_DRP module
//      SRDY_N:     Asserted after the MMCM_ADV is locked and the MMCM_DRP module is ready to
//                  start another re-configuration.
// Outputs
//      LOCKED_OUT: MMCM is locked after configuration or reconfiguration.
//      CLK0OUT:    These are the clock outputs from the MMCM_ADV.
//      CLK1OUT:    These are the clock outputs from the MMCM_ADV.
//      CLK2OUT:    These are the clock outputs from the MMCM_ADV.
//      CLK3OUT:    These are the clock outputs from the MMCM_ADV.
//      CLK4OUT:    These are the clock outputs from the MMCM_ADV.
//      CLK5OUT:    These are the clock outputs from the MMCM_ADV.
//      CLK6OUT:    These are the clock outputs from the MMCM_ADV.
//-------------------------------------------------------------------------------------------

module system_mmcme2
    (
        input        RST,
        input        SSTEP,
        input  [2:0] STATE,
        input        CLKDRP,
        //
        output       SRDY_N,
        output       LOCKED_OUT,
        //
        input        CLKIN,
        //
        output       CLK0OUTB,
        output       CLK1OUT,
        output       CLK1OUTB,
        output       CLK2OUT,
        output       CLK3OUT
    );
//-------------------------------------------------------------------------------------------
// These signals are used as direct connections between the MMCM_ADV and the
// MMCM_DRP.
(* mark_debug = "true" *) wire [15:0]    di;
(* mark_debug = "true" *) wire [6:0]     daddr;
(* mark_debug = "true" *) wire [15:0]    dout;
(* mark_debug = "true" *) wire           den;
(* mark_debug = "true" *) wire           dwe;
wire            dclk;
wire            rst_mmcm;
wire            drdy;
reg [3:0]       sstep_int = 4'b0000;
wire            sstep_single_cycle;
// These signals are used for the BUFG's necessary for the design.
wire            clkfb_bufgout;
wire            clkfb_bufgin;
wire            clk0b_bufgin;
wire            clk1_bufgin;
wire            clk1b_bufgin;
wire            clk2_bufgin;
wire            clk3_bufgin;
wire            LOCKED;
//-------------------------------------------------------------------------------------------
BUFG BUFG_FB    (.O (clkfb_bufgout),    .I (clkfb_bufgin));
BUFG BUFG_CLK0B (.O (CLK0OUTB),         .I (clk0b_bufgin));
BUFG BUFG_CLK1  (.O (CLK1OUT),          .I (clk1_bufgin));
BUFG BUFG_CLK1B (.O (CLK1OUTB),         .I (clk1b_bufgin));
BUFG BUFG_CLK2  (.O (CLK2OUT),          .I (clk2_bufgin));
BUFG BUFG_CLK3  (.O (CLK3OUT),          .I (clk3_bufgin));
//
// MMCM_ADV that reconfiguration will take place on
//
//  BANDWIDTH:              : "HIGH", "LOW" or "OPTIMIZED"
//  DIVCLK_DIVIDE           : Value from 1 to 106
//  CLKFBOUT_MULT_F         : Value from 2 to 64
//  CLKFBOUT_PHASE          :
//  CLKFBOUT_USE_FINE_PS    : "TRUE" or "FALSE",
//  CLKIN1_PERIOD           : Value from 0.968 to 100.000. Set the period (ns) of input clocks
//  REF_JITTER1             :
//  CLKIN2_PERIOD           :
//  REF_JITTER2             :
//  CLKOUT parameters:
//  DIVIDE                  : Value from 1 to 128
//  DUTY_CYCLE              : 0.01 to 0.99 - This is dependent on the divide value.
//  PHASE                   : 0.0 to 360.0 - This is dependent on the divide value.
//  USE_FINE_PS             : TRUE or FALSE
//  Misc parameters
//  COMPENSATION
//  STARTUP_WAIT
//
MMCME2_ADV #(
   .BANDWIDTH           ("OPTIMIZED"),
   .DIVCLK_DIVIDE       (2),
   .CLKFBOUT_MULT_F     (28),
   .CLKFBOUT_PHASE      (0.0),
   .CLKFBOUT_USE_FINE_PS("FALSE"),
   .CLKIN1_PERIOD       (20.000),
   .REF_JITTER1         (0.010),
   .CLKIN2_PERIOD       (20.000),
   .REF_JITTER2         (0.010),
   .CLKOUT0_DIVIDE_F    (5),
   .CLKOUT0_DUTY_CYCLE  (0.5),
   .CLKOUT0_PHASE       (0.0),
   .CLKOUT0_USE_FINE_PS ("FALSE"),
   .CLKOUT1_DIVIDE      (25),
   .CLKOUT1_DUTY_CYCLE  (0.5),
   .CLKOUT1_PHASE       (0.0),
   .CLKOUT1_USE_FINE_PS ("FALSE"),
   .CLKOUT2_DIVIDE      (50),
   .CLKOUT2_DUTY_CYCLE  (0.5),
   .CLKOUT2_PHASE       (0.0),
   .CLKOUT2_USE_FINE_PS ("FALSE"),
   .CLKOUT3_DIVIDE      (100),
   .CLKOUT3_DUTY_CYCLE  (0.5),
   .CLKOUT3_PHASE       (0.0),
   .CLKOUT3_USE_FINE_PS ("FALSE"),
   .CLKOUT4_DIVIDE      (100),
   .CLKOUT4_DUTY_CYCLE  (0.5),
   .CLKOUT4_PHASE       (0.0),
   .CLKOUT4_USE_FINE_PS ("FALSE"),
   .CLKOUT4_CASCADE     ("FALSE"),
   .CLKOUT5_DIVIDE      (100),
   .CLKOUT5_DUTY_CYCLE  (0.5),
   .CLKOUT5_PHASE       (0.0),
   .CLKOUT5_USE_FINE_PS ("FALSE"),
   .CLKOUT6_DIVIDE      (100),
   .CLKOUT6_DUTY_CYCLE  (0.5),
   .CLKOUT6_PHASE       (0.0),
   .CLKOUT6_USE_FINE_PS ("FALSE"),
   .COMPENSATION        ("ZHOLD"),
   .STARTUP_WAIT        ("FALSE")
) mmcme2_adv_inst (
   .CLKFBOUT            (clkfb_bufgin),
   .CLKFBOUTB           (),
   .CLKFBSTOPPED        (),
   .CLKINSTOPPED        (),
   .CLKOUT0             (),
   .CLKOUT0B            (clk0b_bufgin),
   .CLKOUT1             (clk1_bufgin),
   .CLKOUT1B            (clk1b_bufgin),
   .CLKOUT2             (clk2_bufgin),
   .CLKOUT2B            (),
   .CLKOUT3             (clk3_bufgin),
   .CLKOUT3B            (),
   .CLKOUT4             (),
   .CLKOUT5             (),
   .CLKOUT6             (),
   .DO                  (dout),
   .DRDY                (drdy),
   .DADDR               (daddr),
   .DCLK                (dclk),
   .DEN                 (den),
   .DI                  (di),
   .DWE                 (dwe),
   .LOCKED              (LOCKED),
   .CLKFBIN             (clkfb_bufgout),
   .CLKIN1              (CLKIN),
   .CLKIN2              (CLKIN),
   .CLKINSEL            (1'b1),
   .PSDONE              (),
   .PSCLK               (1'b0),
   .PSEN                (1'b0),
   .PSINCDEC            (1'b0),
   .PWRDWN              (1'b0),
   .RST                 (rst_mmcm)
);

// MMCM_DRP instance that will perform the reconfiguration operations

drp_mmcme2_sys #(

    // Register the LOCKED signal with the MMCME3_ADV input clock.
    // The LOCKED_IN (LOCKED from the MMCME3_ADV) is fed into a register and then
    // passed the LOCKED_OUT when REGISTER_LOCKED is set to "Reg" or when set to
    // "NoReg" LOCKED_IN is just passed on to LOCKED_OUT without being registered.
    
    .REGISTER_LOCKED       ("Reg"),
    
    // Use the registered LOCKED signal from the MMCME3 also for the DRP state machine.
    
    .USE_REG_LOCKED        ("No"),
    
    // Possible combination of above two parameters:
    // | REGISTER_LOCKED | USE_REG_LOCKED |                                            |
    // |-----------------|----------------|--------------------------------------------|
    // |      "NoReg"    |     "No"       | LOCKED is just passed through mmcme3_drp   |
    // |                 |                | and is used as is with the state machine   |
    // |      "NoReg"    |     "Yes"      | NOT ALLOWED                                |
    // |       "Reg"     |     "No"       | LOCKED is registered but the unregistered  |
    // |                 |                | version is used for the state machine.     |
    // |       "Reg"     |     "Yes"      | LOCKED is registered and the registered    |
    // |                 |                | version is also used by the state machine. |
    //

    //***********************************************************************
    // Output Dividers - Common to All States
    //***********************************************************************

    // mmcm output clock dividers are programmed by the MMCME2_ADV instantiation
    // some parameter values are used for fractional feedback calculations
    // these must be consistent with the instantiation above

    .O_CLKOUT0_DIVIDE(5),
    .O_CLKOUT0_PHASE(0),
    .O_CLKOUT0_DUTY(50000),
   
    .O_CLKOUT1_DIVIDE(25),
    .O_CLKOUT1_PHASE(0),
    .O_CLKOUT1_DUTY(50000),

    .O_CLKOUT2_DIVIDE(50),
    .O_CLKOUT2_PHASE(0),
    .O_CLKOUT2_DUTY(50000),
    
    .O_CLKOUT3_DIVIDE(100),
    .O_CLKOUT3_PHASE(0),
    .O_CLKOUT3_DUTY(50000),
    
    .O_CLKOUT4_DIVIDE(100),
    .O_CLKOUT4_PHASE(0),
    .O_CLKOUT4_DUTY(50000),
    
    .O_CLKOUT5_DIVIDE(100),
    .O_CLKOUT5_PHASE(0),
    .O_CLKOUT5_DUTY(50000),
    
    .O_CLKOUT6_DIVIDE(100),
    .O_CLKOUT6_PHASE(0),
    .O_CLKOUT6_DUTY(50000),

    //***********************************************************************
    // State 0 Parameters - Fsys = 28.000000 MHz
    //***********************************************************************
    
    .S0_CLKFBOUT_MULT(28),
    .S0_CLKFBOUT_PHASE(000_000),
    .S0_CLKFBOUT_FRAC(000),
    .S0_CLKFBOUT_FRAC_EN(0),
    .S0_BANDWIDTH("OPTIMIZED"),
    .S0_DIVCLK_DIVIDE(2),

    //***********************************************************************
    // State 1 Parameters - Fsys = 28.571429 MHz (actually 28.583333 MHz)
    //***********************************************************************

    .S1_CLKFBOUT_MULT(42),
    .S1_CLKFBOUT_PHASE(000_000),
    .S1_CLKFBOUT_FRAC(875),
    .S1_CLKFBOUT_FRAC_EN(1),
    .S1_BANDWIDTH("OPTIMIZED"),
    .S1_DIVCLK_DIVIDE(3),

    //***********************************************************************
    // State 2 Parameters - Fsys = 29.464286 MHz (actually 29.437500 MHz)
    //***********************************************************************

    .S2_CLKFBOUT_MULT(58),
    .S2_CLKFBOUT_PHASE(000_000),
    .S2_CLKFBOUT_FRAC(875),
    .S2_CLKFBOUT_FRAC_EN(1),
    .S2_BANDWIDTH("OPTIMIZED"),
    .S2_DIVCLK_DIVIDE(4),

    //***********************************************************************
    // State 3 Parameters - Fsys = 30.000000 MHz
    //***********************************************************************

    .S3_CLKFBOUT_MULT(30),
    .S3_CLKFBOUT_PHASE(000_000),
    .S3_CLKFBOUT_FRAC(000),
    .S3_CLKFBOUT_FRAC_EN(0),
    .S3_BANDWIDTH("OPTIMIZED"),
    .S3_DIVCLK_DIVIDE(2),

    //***********************************************************************
    // State 4 Parameters - Fsys = 31.000000 MHz
    //***********************************************************************

    .S4_CLKFBOUT_MULT(31),
    .S4_CLKFBOUT_PHASE(000_000),
    .S4_CLKFBOUT_FRAC(000),
    .S4_CLKFBOUT_FRAC_EN(0),
    .S4_BANDWIDTH("OPTIMIZED"),
    .S4_DIVCLK_DIVIDE(2),

    //***********************************************************************
    // State 5 Parameters - Fsys = 32.000000 MHz
    //***********************************************************************

    .S5_CLKFBOUT_MULT(32),
    .S5_CLKFBOUT_PHASE(000_000),
    .S5_CLKFBOUT_FRAC(000),
    .S5_CLKFBOUT_FRAC_EN(0),
    .S5_BANDWIDTH("OPTIMIZED"),
    .S5_DIVCLK_DIVIDE(2),

    //***********************************************************************
    // State 6 Parameters - Fsys = 33.000000 MHz
    //***********************************************************************

    .S6_CLKFBOUT_MULT(33),
    .S6_CLKFBOUT_PHASE(000_000),
    .S6_CLKFBOUT_FRAC(000),
    .S6_CLKFBOUT_FRAC_EN(0),
    .S6_BANDWIDTH("OPTIMIZED"),
    .S6_DIVCLK_DIVIDE(2)
    
) drp_mmcme2_sys_inst (

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
    .RST_MMCM           (rst_mmcm),
    .LOCKED_OUT         (LOCKED_OUT)
    
);

// Only start DRP after initial lock and when STATE has changed

always @(posedge CLKDRP)
   sstep_int <= {SSTEP, sstep_int[3:1]};   // must delay a few cycles

assign sstep_single_cycle = sstep_int[1] & ~sstep_int[0];

//-------------------------------------------------------------------------------------------
endmodule
