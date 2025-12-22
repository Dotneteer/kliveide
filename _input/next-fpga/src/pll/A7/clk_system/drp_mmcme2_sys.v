//-------------------------------------------------------------------------------------------
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
// Device:              7_Series
// Author:              Tatsukawa, Kruger, Ribbing, Defossez
// Entity Name:         mmcme2_drp
// Purpose:             This calls the DRP register calculation functions and
//                      provides a state machine to perform MMCM reconfiguration
//                      based on the calculated values stored in an initialized
//                      ROM.
//                      7-Series MMCM is called:            MMCME2
//                          Ultrascale MMCM is called:      MMCME3
//                          UltrascalePlus MMCM is called:  MMCME4
//                      MMCME3 attributes
//                          CLKINx_PERIOD:      0.968 to 100.000 (x = 1 or 2)
//                          REF_JITTERx:        0.001 to 0.999 (x = 1 or 2)
//                          BANDWIDTH:          LOW, HIGH, OPTIMIZED and POSTCRC
//                          COMPENSATION:       AUTO, ZHOLD, EXTERNAL, INTERNAL and BUF_IN
//                          DIVCLK_DIVIDE:      1 to 106
//                          CLKFBOUT_MULT_F:    2 to 64
//                          CLKFBOUT_PHASE:     -360 to 360
//                          CLKOUTn_DIVIDE:     1 to 128 (n = 0 to 6)
//                          CLKOUTn_PHASE:      -360 to 360 (n = 0 to 6)
//                          CLKOUTn_DUTY_CYCLE: 0.01 to 0.99 (n = 0 to 6)
//
// Tools:               Vivado_2019.1 or newer
// Limitations:         None
//
// Vendor:              Xilinx Inc.
// Version:             1.40
// Filename:            mmcme2_drp.v
// Date Created:        22-Oct-2014
// Date Last Modified:  25-Jun-2019
//-------------------------------------------------------------------------------------------
// Disclaimer:
//        This disclaimer is not a license and does not grant any rights to the materials
//        distributed herewith. Except as otherwise provided in a valid license issued to you
//        by Xilinx, and to the maximum extent permitted by applicable law: (1) THESE MATERIALS
//        ARE MADE AVAILABLE "AS IS" AND WITH ALL FAULTS, AND XILINX HEREBY DISCLAIMS ALL
//        WARRANTIES AND CONDITIONS, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED
//        TO WARRANTIES OF MERCHANTABILITY, NON-INFRINGEMENT, OR FITNESS FOR ANY PARTICULAR
//        PURPOSE; and (2) Xilinx shall not be liable (whether in contract or tort, including
//        negligence, or under any other theory of liability) for any loss or damage of any
//        kind or nature related to, arising under or in connection with these materials,
//        including for any direct, or any indirect, special, incidental, or consequential
//        loss or damage (including loss of data, profits, goodwill, or any type of loss or
//        damage suffered as a result of any action brought by a third party) even if such
//        damage or loss was reasonably foreseeable or Xilinx had been advised of the
//        possibility of the same.
//
// CRITICAL APPLICATIONS
//        Xilinx products are not designed or intended to be fail-safe, or for use in any
//        application requiring fail-safe performance, such as life-support or safety devices
//        or systems, Class III medical devices, nuclear facilities, applications related to
//        the deployment of airbags, or any other applications that could lead to death,
//        personal injury, or severe property or environmental damage (individually and
//        collectively, "Critical Applications"). Customer assumes the sole risk and
//        liability of any use of Xilinx products in Critical Applications, subject only to
//        applicable laws and regulations governing limitations on product liability.
//
// THIS COPYRIGHT NOTICE AND DISCLAIMER MUST BE RETAINED AS PART OF THIS FILE AT ALL TIMES.
//
// Contact:    e-mail  hotline@xilinx.com        phone   + 1 800 255 7778
//-------------------------------------------------------------------------------------------
// Revision History:
//  Rev: 13-Jan-2011 - Tatsukawa
//      Updated ROM[18,41] LOCKED bitmask to 16'HFC00
//  Rev: 30-May-2013 - Tatsukawa
//      Adding Fractional support for CLKFBOUT_MULT_F, CLKOUT0_DIVIDE_F
//  Rev: 30-Apr-2014 - Tatsukawa
//      For fractional multiply changed order to enable fractional
//      before the multiply is applied to prevent false VCO DRCs
//      (e.g. DADDR 7'h15 must be set before updating 7'h14)
//  Rev: 24-Oct-2014 - Ribbing
//      Parameters have been added to clarify Reg1/Reg2/Shared registers
//  Rev: 08-Jun-2015 - Kruger
//      WAIT_LOCK update
//  Rev: 02-May-2016 - Kruger
//      Reordering FRAC_EN bits DADDR(7'h09, 7'h15)
//      Registers before frac settings (7'h08, 7'h14)
//  Rev: 19-Sep-2018 - Defossez
//      Updated comments of BANDWIDTH.
//      Corrected some typos.
//  Rev: 25-Jun-2019 - Defossez
//      Adding registering possibility for LOCKE signal.
//  Rev: 08-May-2022 - Alvin Albrecht
//      Specialized for ZX Spectrum Next project, consult XAPP888 for original
//-------------------------------------------------------------------------------------------

// This file is part of the ZX Spectrum Next Project
// <https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA/tree/master/cores>

`timescale 1ps/1ps

module drp_mmcme2_sys
    #(
        // Register the LOCKED signal with teh MMCME3_ADV input clock.
        // The LOCKED_IN (LOCKED from the MMCME3_ADV) is fed into a register and then
        // passed the LOCKED_OUT when REGISTER_LOCKED is set to "Reg" or when set to
        // "NoReg" LOCKED_IN is just passed on to LOCKED_OUT without being registered.
        
        parameter REGISTER_LOCKED       = "Reg",
        
        // Use the registered LOCKED signal from the MMCME3 also for the DRP state machine.
        
        parameter USE_REG_LOCKED        = "No",
        
        // Possible/allowed combinations of above two parameters:
        
        // | REGISTER_LOCKED | USE_REG_LOCKED |                                            |
        // |-----------------|----------------|--------------------------------------------|
        // |      "NoReg"    |     "No"       | LOCKED is just passed through mmcme3_drp   |
        // |                 |                | and is used as is with the state machine   |
        // |      "NoReg"    |     "Yes"      | NOT ALLOWED                                |
        // |       "Reg"     |     "No"       | LOCKED is registered but the unregistered  |
        // |                 |                | version is used for the state machine.     |
        // |       "Reg"     |     "Yes"      | LOCKED is registered and the registered    |
        // |                 |                | version is also used by the state machine. |


        //***********************************************************************
        // Output Dividers - Common to All States
        //***********************************************************************

        // mmcm output clock dividers are programmed by the MMCME2_ADV instantiation and
        // are not modified by this drp interface.
        
        // some register writes are mixed with output divider registers so these parameters
        // need to be known here
        
        parameter O_CLKOUT0_DIVIDE          = 5,
        parameter O_CLKOUT0_PHASE           = 0,
        parameter O_CLKOUT0_DUTY            = 50000,

        parameter O_CLKOUT1_DIVIDE          = 25,
        parameter O_CLKOUT1_PHASE           = 0,
        parameter O_CLKOUT1_DUTY            = 50000,

        parameter O_CLKOUT2_DIVIDE          = 50,
        parameter O_CLKOUT2_PHASE           = 0,
        parameter O_CLKOUT2_DUTY            = 50000,

        parameter O_CLKOUT3_DIVIDE          = 100,
        parameter O_CLKOUT3_PHASE           = 0,
        parameter O_CLKOUT3_DUTY            = 50000,

        parameter O_CLKOUT4_DIVIDE          = 100,
        parameter O_CLKOUT4_PHASE           = 0,
        parameter O_CLKOUT4_DUTY            = 50000,

        parameter O_CLKOUT5_DIVIDE          = 100,
        parameter O_CLKOUT5_PHASE           = 0,
        parameter O_CLKOUT5_DUTY            = 50000,

        parameter O_CLKOUT6_DIVIDE          = 100,
        parameter O_CLKOUT6_PHASE           = 0,
        parameter O_CLKOUT6_DUTY            = 50000,

        //***********************************************************************
        // State 0 Parameters 
        //***********************************************************************
        
        // These parameters have an effect on the feedback path. A change on
        // these parameters will effect all of the clock outputs.
        
        // The parameters are composed of:
        //
        //    _MULT: This can be from 2 to 64. It has an effect on the VCO
        //          frequency which consequently, effects all of the clock
        //          outputs.
        //    _PHASE: This is the phase multiplied by 1000. For example if
        //          a phase of 24.567 deg was desired the input value would be
        //          24567. The range for the phase is from -360000 to 360000.
        //    _FRAC: This can be from 0 to 875. This represents the fractional
        //          divide multiplied by 1000.
        //          M = _MULT + _FRAC / 1000
        //          e.g. M=8.125
        //               _MULT = 8
        //               _FRAC = 125
        //    _FRAC_EN: This indicates fractional divide has been enabled. If 1
        //          then the fractional divide algorithm will be used to calculate
        //          register settings. If 0 then default calculation to be used.
        
        parameter S0_CLKFBOUT_MULT          = 28,
        parameter S0_CLKFBOUT_PHASE         = 0,
        parameter S0_CLKFBOUT_FRAC          = 0,
        parameter S0_CLKFBOUT_FRAC_EN       = 0,
        
        // The bandwidth parameter effects the phase error and the jitter filter
        // capability of the MMCM. For more information on this parameter see the
        // Device user guide.
        //
        // Possible values are: "LOW", "LOW_SS", "HIGH" and "OPTIMIZED"
        
        parameter S0_BANDWIDTH              = "LOW",
        
        // The divclk parameter allows the input clock to be divided before it
        // reaches the phase and frequency comparator. This can be set between
        // 1 and 128.
        
        parameter S0_DIVCLK_DIVIDE          = 2,
        
        //***********************************************************************
        // State 1 Parameters 
        //***********************************************************************

        parameter S1_CLKFBOUT_MULT          = 42,
        parameter S1_CLKFBOUT_PHASE         = 0,
        parameter S1_CLKFBOUT_FRAC          = 875,
        parameter S1_CLKFBOUT_FRAC_EN       = 1,
        
        parameter S1_BANDWIDTH              = "LOW",
        
        parameter S1_DIVCLK_DIVIDE          = 3,

        //***********************************************************************
        // State 2 Parameters 
        //***********************************************************************

        parameter S2_CLKFBOUT_MULT          = 58,
        parameter S2_CLKFBOUT_PHASE         = 0,
        parameter S2_CLKFBOUT_FRAC          = 875,
        parameter S2_CLKFBOUT_FRAC_EN       = 1,
        
        parameter S2_BANDWIDTH              = "LOW",
        
        parameter S2_DIVCLK_DIVIDE          = 4,

        //***********************************************************************
        // State 3 Parameters 
        //***********************************************************************

        parameter S3_CLKFBOUT_MULT          = 30,
        parameter S3_CLKFBOUT_PHASE         = 0,
        parameter S3_CLKFBOUT_FRAC          = 0,
        parameter S3_CLKFBOUT_FRAC_EN       = 0,
        
        parameter S3_BANDWIDTH              = "LOW",
        
        parameter S3_DIVCLK_DIVIDE          = 2,

        //***********************************************************************
        // State 4 Parameters 
        //***********************************************************************

        parameter S4_CLKFBOUT_MULT          = 31,
        parameter S4_CLKFBOUT_PHASE         = 0,
        parameter S4_CLKFBOUT_FRAC          = 0,
        parameter S4_CLKFBOUT_FRAC_EN       = 0,
        
        parameter S4_BANDWIDTH              = "LOW",
        
        parameter S4_DIVCLK_DIVIDE          = 2,

        //***********************************************************************
        // State 5 Parameters 
        //***********************************************************************

        parameter S5_CLKFBOUT_MULT          = 32,
        parameter S5_CLKFBOUT_PHASE         = 0,
        parameter S5_CLKFBOUT_FRAC          = 0,
        parameter S5_CLKFBOUT_FRAC_EN       = 0,
        
        parameter S5_BANDWIDTH              = "LOW",
        
        parameter S5_DIVCLK_DIVIDE          = 2,

        //***********************************************************************
        // State 6 Parameters 
        //***********************************************************************

        parameter S6_CLKFBOUT_MULT          = 33,
        parameter S6_CLKFBOUT_PHASE         = 0,
        parameter S6_CLKFBOUT_FRAC          = 0,
        parameter S6_CLKFBOUT_FRAC_EN       = 0,
        
        parameter S6_BANDWIDTH              = "LOW",
        
        parameter S6_DIVCLK_DIVIDE          = 2

    ) (

        // These signals are controlled by user logic interface and are covered
        // in more detail within the XAPP.
        
        input      [2:0]  SADDR,
        input             SEN,
        input             SCLK,
        input             RST,
        output reg        SRDY_N,
        
        // These signals are to be connected to the MMCM_ADV by port name.
        // Their use matches the MMCM port description in the Device User Guide.
        
        input      [15:0] DO,
        input             DRDY,
        input             LOCK_REG_CLK_IN,
        input             LOCKED_IN,
        output reg        DWE,
        output reg        DEN,
        output reg [6:0]  DADDR,
        output reg [15:0] DI,
        output            DCLK,
        output reg        RST_MMCM,
        output            LOCKED_OUT
    );
    
//----------------------------------------------------------------------------------------

    wire        IntLocked;
    wire        IntRstMmcm;

    // 100 ps delay for behavioral simulations
    localparam  TCQ = 100;

    // Make sure the memory is implemented as distributed
    (* rom_style = "distributed" *)

    reg  [38:0]  rom [69:0];
    reg  [6:0]   rom_addr;
    reg  [38:0]  rom_do;
    reg          next_srdy_n;
    reg  [6:0]   next_rom_addr;
    reg  [6:0]   start_addr;
    reg  [6:0]   next_daddr;
    reg          next_dwe;
    reg          next_den;
    reg          next_rst_mmcm;
    reg  [15:0]  next_di;

    // Insert a register in LOCKED or not depending on the value given to the parameters
    // REGISTER_LOCKED. When REGISTER_LOCKED is set to "Reg" insert a register, when set
    // to "NoReg" don't insert a register but just pass the LOCKED signal from input to
    // output.
    
    // Use or not, under USE_REG_LOCKED parameter control, the registered version of the
    // LOCKED signal for the DRP state machine.
    // Possible/allowed combinations of the two LOCKED related parameters:
    
    // | REGISTER_LOCKED | USE_REG_LOCKED |                                            |
    // |-----------------|----------------|--------------------------------------------|
    // |      "NoReg"    |     "No"       | LOCKED is just passed through mmcme3_drp   |
    // |                 |                | and is used as is with the state machine   |
    // |      "NoReg"    |     "Yes"      | NOT ALLOWED                                |
    // |       "Reg"     |     "No"       | LOCKED is registered but the unregistered  |
    // |                 |                | version is used for the state machine.     |
    // |       "Reg"     |     "Yes"      | LOCKED is registered and the registered    |
    // |                 |                | version is also used by the state machine. |
    
    generate
        if (REGISTER_LOCKED == "NoReg" && USE_REG_LOCKED == "No") begin
            assign LOCKED_OUT = LOCKED_IN;
            assign IntLocked = LOCKED_IN;
        end else if (REGISTER_LOCKED == "Reg" && USE_REG_LOCKED == "No") begin
            FDRE #(
                .INIT           (0),
                .IS_C_INVERTED  (0),
                .IS_D_INVERTED  (0),
                .IS_R_INVERTED  (0)
            ) mmcme3_drp_I_Fdrp (
                .D      (LOCKED_IN),
                .CE     (1'b1),
                .R      (IntRstMmcm),
                .C      (LOCK_REG_CLK_IN),
                .Q      (LOCKED_OUT)
            );
            //
            assign IntLocked = LOCKED_IN;
        end else if (REGISTER_LOCKED == "Reg" && USE_REG_LOCKED == "Yes") begin
            FDRE #(
                .INIT           (0),
                .IS_C_INVERTED  (0),
                .IS_D_INVERTED  (0),
                .IS_R_INVERTED  (0)
            ) mmcme3_drp_I_Fdrp (
                .D  (LOCKED_IN),
                .CE (1'b1),
                .R  (IntRstMmcm),
                .C  (LOCK_REG_CLK_IN),
                .Q  (LOCKED_OUT)
            );
            //
            assign IntLocked = LOCKED_OUT;
        end
    endgenerate

    // Pass SCLK to DCLK for the MMCM
    
    assign DCLK = SCLK;
    assign IntRstMmcm = RST_MMCM;

    // Include the MMCM reconfiguration functions.  This contains the constant
    // functions that are used in the calculations below.  This file is
    // required.
    
    `include "drp_mmcme2_sys_func.h"

    //**************************************************************************
    // State 0 Calculations
    //**************************************************************************

    localparam [37:0] S0_CLKFBOUT       =
       mmcm_count_calc(S0_CLKFBOUT_MULT, S0_CLKFBOUT_PHASE, 50000);

    localparam [37:0] S0_CLKFBOUT_FRAC_CALC       =
       mmcm_frac_count_calc(S0_CLKFBOUT_MULT, S0_CLKFBOUT_PHASE, 50000, S0_CLKFBOUT_FRAC);

    localparam [9:0]  S0_DIGITAL_FILT   =
       mmcm_filter_lookup(S0_CLKFBOUT_MULT, S0_BANDWIDTH);

    localparam [39:0] S0_LOCK           =
       mmcm_lock_lookup(S0_CLKFBOUT_MULT);

    localparam [37:0] S0_DIVCLK         =
       mmcm_count_calc(S0_DIVCLK_DIVIDE, 0, 50000);

    // output dividers shared by all states

    localparam [37:0] O_CLKOUT0        =
       mmcm_count_calc(O_CLKOUT0_DIVIDE, O_CLKOUT0_PHASE, O_CLKOUT0_DUTY);

    localparam [37:0] O_CLKOUT1        =
       mmcm_count_calc(O_CLKOUT1_DIVIDE, O_CLKOUT1_PHASE, O_CLKOUT1_DUTY);

    localparam [37:0] O_CLKOUT2        =
       mmcm_count_calc(O_CLKOUT2_DIVIDE, O_CLKOUT2_PHASE, O_CLKOUT2_DUTY);

    localparam [37:0] O_CLKOUT3        =
       mmcm_count_calc(O_CLKOUT3_DIVIDE, O_CLKOUT3_PHASE, O_CLKOUT3_DUTY);

    localparam [37:0] O_CLKOUT4        =
       mmcm_count_calc(O_CLKOUT4_DIVIDE, O_CLKOUT4_PHASE, O_CLKOUT4_DUTY);

    localparam [37:0] O_CLKOUT5        =
       mmcm_count_calc(O_CLKOUT5_DIVIDE, O_CLKOUT5_PHASE, O_CLKOUT5_DUTY);

    localparam [37:0] O_CLKOUT6        =
       mmcm_count_calc(O_CLKOUT6_DIVIDE, O_CLKOUT6_PHASE, O_CLKOUT6_DUTY);

    //**************************************************************************
    // State 1 Calculations
    //**************************************************************************

    localparam [37:0] S1_CLKFBOUT       =
       mmcm_count_calc(S1_CLKFBOUT_MULT, S1_CLKFBOUT_PHASE, 50000);

    localparam [37:0] S1_CLKFBOUT_FRAC_CALC       =
       mmcm_frac_count_calc(S1_CLKFBOUT_MULT, S1_CLKFBOUT_PHASE, 50000, S1_CLKFBOUT_FRAC);

    localparam [9:0]  S1_DIGITAL_FILT   =
       mmcm_filter_lookup(S1_CLKFBOUT_MULT, S1_BANDWIDTH);

    localparam [39:0] S1_LOCK           =
       mmcm_lock_lookup(S1_CLKFBOUT_MULT);

    localparam [37:0] S1_DIVCLK         =
       mmcm_count_calc(S1_DIVCLK_DIVIDE, 0, 50000);

    //**************************************************************************
    // State 2 Calculations
    //**************************************************************************

    localparam [37:0] S2_CLKFBOUT       =
       mmcm_count_calc(S2_CLKFBOUT_MULT, S2_CLKFBOUT_PHASE, 50000);

    localparam [37:0] S2_CLKFBOUT_FRAC_CALC       =
       mmcm_frac_count_calc(S2_CLKFBOUT_MULT, S2_CLKFBOUT_PHASE, 50000, S2_CLKFBOUT_FRAC);

    localparam [9:0]  S2_DIGITAL_FILT   =
       mmcm_filter_lookup(S2_CLKFBOUT_MULT, S2_BANDWIDTH);

    localparam [39:0] S2_LOCK           =
       mmcm_lock_lookup(S2_CLKFBOUT_MULT);

    localparam [37:0] S2_DIVCLK         =
       mmcm_count_calc(S2_DIVCLK_DIVIDE, 0, 50000);

    //**************************************************************************
    // State 3 Calculations
    //**************************************************************************

    localparam [37:0] S3_CLKFBOUT       =
       mmcm_count_calc(S3_CLKFBOUT_MULT, S3_CLKFBOUT_PHASE, 50000);

    localparam [37:0] S3_CLKFBOUT_FRAC_CALC       =
       mmcm_frac_count_calc(S3_CLKFBOUT_MULT, S3_CLKFBOUT_PHASE, 50000, S3_CLKFBOUT_FRAC);

    localparam [9:0]  S3_DIGITAL_FILT   =
       mmcm_filter_lookup(S3_CLKFBOUT_MULT, S3_BANDWIDTH);

    localparam [39:0] S3_LOCK           =
       mmcm_lock_lookup(S3_CLKFBOUT_MULT);

    localparam [37:0] S3_DIVCLK         =
       mmcm_count_calc(S3_DIVCLK_DIVIDE, 0, 50000);
       
    //**************************************************************************
    // State 4 Calculations
    //**************************************************************************

    localparam [37:0] S4_CLKFBOUT       =
       mmcm_count_calc(S4_CLKFBOUT_MULT, S4_CLKFBOUT_PHASE, 50000);

    localparam [37:0] S4_CLKFBOUT_FRAC_CALC       =
       mmcm_frac_count_calc(S4_CLKFBOUT_MULT, S4_CLKFBOUT_PHASE, 50000, S4_CLKFBOUT_FRAC);

    localparam [9:0]  S4_DIGITAL_FILT   =
       mmcm_filter_lookup(S4_CLKFBOUT_MULT, S4_BANDWIDTH);

    localparam [39:0] S4_LOCK           =
       mmcm_lock_lookup(S4_CLKFBOUT_MULT);

    localparam [37:0] S4_DIVCLK         =
       mmcm_count_calc(S4_DIVCLK_DIVIDE, 0, 50000);
       
    //**************************************************************************
    // State 5 Calculations
    //**************************************************************************

    localparam [37:0] S5_CLKFBOUT       =
       mmcm_count_calc(S5_CLKFBOUT_MULT, S5_CLKFBOUT_PHASE, 50000);

    localparam [37:0] S5_CLKFBOUT_FRAC_CALC       =
       mmcm_frac_count_calc(S5_CLKFBOUT_MULT, S5_CLKFBOUT_PHASE, 50000, S5_CLKFBOUT_FRAC);

    localparam [9:0]  S5_DIGITAL_FILT   =
       mmcm_filter_lookup(S5_CLKFBOUT_MULT, S5_BANDWIDTH);

    localparam [39:0] S5_LOCK           =
       mmcm_lock_lookup(S5_CLKFBOUT_MULT);

    localparam [37:0] S5_DIVCLK         =
       mmcm_count_calc(S5_DIVCLK_DIVIDE, 0, 50000);
       
    //**************************************************************************
    // State 6 Calculations
    //**************************************************************************

    localparam [37:0] S6_CLKFBOUT       =
       mmcm_count_calc(S6_CLKFBOUT_MULT, S6_CLKFBOUT_PHASE, 50000);

    localparam [37:0] S6_CLKFBOUT_FRAC_CALC       =
       mmcm_frac_count_calc(S6_CLKFBOUT_MULT, S6_CLKFBOUT_PHASE, 50000, S6_CLKFBOUT_FRAC);

    localparam [9:0]  S6_DIGITAL_FILT   =
       mmcm_filter_lookup(S6_CLKFBOUT_MULT, S6_BANDWIDTH);

    localparam [39:0] S6_LOCK           =
       mmcm_lock_lookup(S6_CLKFBOUT_MULT);

    localparam [37:0] S6_DIVCLK         =
       mmcm_count_calc(S6_DIVCLK_DIVIDE, 0, 50000);

    initial begin
    
       // rom entries contain (in order) the address, a bitmask, and a bitset
       
       //***********************************************************************
       // State 0 Initialization
       //***********************************************************************

       // Store the power bits
       
       rom[0] = {7'h28, 16'h0000, 16'hFFFF};

       // Update CLKOUT6 (intermingled CLKFBOUT bits)

       rom[1] = (S0_CLKFBOUT_FRAC_EN == 0) ?
                {7'h13, 16'hC000, O_CLKOUT6[31:16]}:
                {7'h13, 16'hC000, O_CLKOUT6[31:30], S0_CLKFBOUT_FRAC_CALC[35:32], O_CLKOUT6[25:16]};

       // Store the input divider
       
       rom[2] = {7'h16, 16'hC000, {2'h0, S0_DIVCLK[23:22], S0_DIVCLK[11:0]} };

       // Store the feedback divide and phase
       
       rom[3] = (S0_CLKFBOUT_FRAC_EN == 0) ?
                {7'h14, 16'h1000, S0_CLKFBOUT[15:0]}:
                {7'h14, 16'h1000, S0_CLKFBOUT_FRAC_CALC[15:0]};
       rom[4] = (S0_CLKFBOUT_FRAC_EN == 0) ?
                {7'h15, 16'h8000, S0_CLKFBOUT[31:16]}:
                {7'h15, 16'h8000, S0_CLKFBOUT_FRAC_CALC[31:16]};

       // Store the lock settings
       
       rom[5] = {7'h18, 16'hFC00, {6'h00, S0_LOCK[29:20]} };
       rom[6] = {7'h19, 16'h8000, {1'b0 , S0_LOCK[34:30], S0_LOCK[9:0]} };
       rom[7] = {7'h1A, 16'h8000, {1'b0 , S0_LOCK[39:35], S0_LOCK[19:10]} };

       // Store the filter settings
       
       rom[8] = {7'h4E, 16'h66FF,
                 S0_DIGITAL_FILT[9], 2'h0, S0_DIGITAL_FILT[8:7], 2'h0,
                 S0_DIGITAL_FILT[6], 8'h00 };
       rom[9] = {7'h4F, 16'h666F,
                 S0_DIGITAL_FILT[5], 2'h0, S0_DIGITAL_FILT[4:3], 2'h0,
                 S0_DIGITAL_FILT[2:1], 2'h0, S0_DIGITAL_FILT[0], 4'h0 };

       //***********************************************************************
       // State 1 Initialization
       //***********************************************************************

       // Store the power bits
       
       rom[10] = {7'h28, 16'h0000, 16'hFFFF};

       // Update CLKOUT6 (intermingled CLKFBOUT bits)

       rom[11] = (S1_CLKFBOUT_FRAC_EN == 0) ?
                 {7'h13, 16'hC000, O_CLKOUT6[31:16]}:
                 {7'h13, 16'hC000, O_CLKOUT6[31:30], S1_CLKFBOUT_FRAC_CALC[35:32], O_CLKOUT6[25:16]};

       // Store the input divider
       
       rom[12] = {7'h16, 16'hC000, {2'h0, S1_DIVCLK[23:22], S1_DIVCLK[11:0]} };

       // Store the feedback divide and phase
       
       rom[13] = (S1_CLKFBOUT_FRAC_EN == 0) ?
                {7'h14, 16'h1000, S1_CLKFBOUT[15:0]}:
                {7'h14, 16'h1000, S1_CLKFBOUT_FRAC_CALC[15:0]};
       rom[14] = (S1_CLKFBOUT_FRAC_EN == 0) ?
                {7'h15, 16'h8000, S1_CLKFBOUT[31:16]}:
                {7'h15, 16'h8000, S1_CLKFBOUT_FRAC_CALC[31:16]};

       // Store the lock settings
       
       rom[15] = {7'h18, 16'hFC00, {6'h00, S1_LOCK[29:20]} };
       rom[16] = {7'h19, 16'h8000, {1'b0 , S1_LOCK[34:30], S1_LOCK[9:0]} };
       rom[17] = {7'h1A, 16'h8000, {1'b0 , S1_LOCK[39:35], S1_LOCK[19:10]} };

       // Store the filter settings
       
       rom[18] = {7'h4E, 16'h66FF,
                 S1_DIGITAL_FILT[9], 2'h0, S1_DIGITAL_FILT[8:7], 2'h0,
                 S1_DIGITAL_FILT[6], 8'h00 };
       rom[19] = {7'h4F, 16'h666F,
                 S1_DIGITAL_FILT[5], 2'h0, S1_DIGITAL_FILT[4:3], 2'h0,
                 S1_DIGITAL_FILT[2:1], 2'h0, S1_DIGITAL_FILT[0], 4'h0 };

       //***********************************************************************
       // State 2 Initialization
       //***********************************************************************

       // Store the power bits
       
       rom[20] = {7'h28, 16'h0000, 16'hFFFF};

       // Update CLKOUT6 (intermingled CLKFBOUT bits)

       rom[21] = (S2_CLKFBOUT_FRAC_EN == 0) ?
                 {7'h13, 16'hC000, O_CLKOUT6[31:16]}:
                 {7'h13, 16'hC000, O_CLKOUT6[31:30], S2_CLKFBOUT_FRAC_CALC[35:32], O_CLKOUT6[25:16]};

       // Store the input divider
       
       rom[22] = {7'h16, 16'hC000, {2'h0, S2_DIVCLK[23:22], S2_DIVCLK[11:0]} };

       // Store the feedback divide and phase
       
       rom[23] = (S2_CLKFBOUT_FRAC_EN == 0) ?
                {7'h14, 16'h1000, S2_CLKFBOUT[15:0]}:
                {7'h14, 16'h1000, S2_CLKFBOUT_FRAC_CALC[15:0]};
       rom[24] = (S2_CLKFBOUT_FRAC_EN == 0) ?
                {7'h15, 16'h8000, S2_CLKFBOUT[31:16]}:
                {7'h15, 16'h8000, S2_CLKFBOUT_FRAC_CALC[31:16]};

       // Store the lock settings
       
       rom[25] = {7'h18, 16'hFC00, {6'h00, S2_LOCK[29:20]} };
       rom[26] = {7'h19, 16'h8000, {1'b0 , S2_LOCK[34:30], S2_LOCK[9:0]} };
       rom[27] = {7'h1A, 16'h8000, {1'b0 , S2_LOCK[39:35], S2_LOCK[19:10]} };

       // Store the filter settings
       
       rom[28] = {7'h4E, 16'h66FF,
                 S2_DIGITAL_FILT[9], 2'h0, S2_DIGITAL_FILT[8:7], 2'h0,
                 S2_DIGITAL_FILT[6], 8'h00 };
       rom[29] = {7'h4F, 16'h666F,
                 S2_DIGITAL_FILT[5], 2'h0, S2_DIGITAL_FILT[4:3], 2'h0,
                 S2_DIGITAL_FILT[2:1], 2'h0, S2_DIGITAL_FILT[0], 4'h0 };

       //***********************************************************************
       // State 3 Initialization
       //***********************************************************************

       // Store the power bits
       
       rom[30] = {7'h28, 16'h0000, 16'hFFFF};

       // Update CLKOUT6 (intermingled CLKFBOUT bits)

       rom[31] = (S3_CLKFBOUT_FRAC_EN == 0) ?
                 {7'h13, 16'hC000, O_CLKOUT6[31:16]}:
                 {7'h13, 16'hC000, O_CLKOUT6[31:30], S3_CLKFBOUT_FRAC_CALC[35:32], O_CLKOUT6[25:16]};

       // Store the input divider
       
       rom[32] = {7'h16, 16'hC000, {2'h0, S3_DIVCLK[23:22], S3_DIVCLK[11:0]} };

       // Store the feedback divide and phase
       
       rom[33] = (S3_CLKFBOUT_FRAC_EN == 0) ?
                {7'h14, 16'h1000, S3_CLKFBOUT[15:0]}:
                {7'h14, 16'h1000, S3_CLKFBOUT_FRAC_CALC[15:0]};
       rom[34] = (S3_CLKFBOUT_FRAC_EN == 0) ?
                {7'h15, 16'h8000, S3_CLKFBOUT[31:16]}:
                {7'h15, 16'h8000, S3_CLKFBOUT_FRAC_CALC[31:16]};

       // Store the lock settings
       
       rom[35] = {7'h18, 16'hFC00, {6'h00, S3_LOCK[29:20]} };
       rom[36] = {7'h19, 16'h8000, {1'b0 , S3_LOCK[34:30], S3_LOCK[9:0]} };
       rom[37] = {7'h1A, 16'h8000, {1'b0 , S3_LOCK[39:35], S3_LOCK[19:10]} };

       // Store the filter settings
       
       rom[38] = {7'h4E, 16'h66FF,
                 S3_DIGITAL_FILT[9], 2'h0, S3_DIGITAL_FILT[8:7], 2'h0,
                 S3_DIGITAL_FILT[6], 8'h00 };
       rom[39] = {7'h4F, 16'h666F,
                 S3_DIGITAL_FILT[5], 2'h0, S3_DIGITAL_FILT[4:3], 2'h0,
                 S3_DIGITAL_FILT[2:1], 2'h0, S3_DIGITAL_FILT[0], 4'h0 };

       //***********************************************************************
       // State 4 Initialization
       //***********************************************************************

       // Store the power bits
       
       rom[40] = {7'h28, 16'h0000, 16'hFFFF};

       // Update CLKOUT6 (intermingled CLKFBOUT bits)

       rom[41] = (S4_CLKFBOUT_FRAC_EN == 0) ?
                 {7'h13, 16'hC000, O_CLKOUT6[31:16]}:
                 {7'h13, 16'hC000, O_CLKOUT6[31:30], S4_CLKFBOUT_FRAC_CALC[35:32], O_CLKOUT6[25:16]};

       // Store the input divider
       
       rom[42] = {7'h16, 16'hC000, {2'h0, S4_DIVCLK[23:22], S4_DIVCLK[11:0]} };

       // Store the feedback divide and phase
       
       rom[43] = (S4_CLKFBOUT_FRAC_EN == 0) ?
                {7'h14, 16'h1000, S4_CLKFBOUT[15:0]}:
                {7'h14, 16'h1000, S4_CLKFBOUT_FRAC_CALC[15:0]};
       rom[44] = (S4_CLKFBOUT_FRAC_EN == 0) ?
                {7'h15, 16'h8000, S4_CLKFBOUT[31:16]}:
                {7'h15, 16'h8000, S4_CLKFBOUT_FRAC_CALC[31:16]};

       // Store the lock settings
       
       rom[45] = {7'h18, 16'hFC00, {6'h00, S4_LOCK[29:20]} };
       rom[46] = {7'h19, 16'h8000, {1'b0 , S4_LOCK[34:30], S4_LOCK[9:0]} };
       rom[47] = {7'h1A, 16'h8000, {1'b0 , S4_LOCK[39:35], S4_LOCK[19:10]} };

       // Store the filter settings
       
       rom[48] = {7'h4E, 16'h66FF,
                 S4_DIGITAL_FILT[9], 2'h0, S4_DIGITAL_FILT[8:7], 2'h0,
                 S4_DIGITAL_FILT[6], 8'h00 };
       rom[49] = {7'h4F, 16'h666F,
                 S4_DIGITAL_FILT[5], 2'h0, S4_DIGITAL_FILT[4:3], 2'h0,
                 S4_DIGITAL_FILT[2:1], 2'h0, S4_DIGITAL_FILT[0], 4'h0 };

       //***********************************************************************
       // State 5 Initialization
       //***********************************************************************

       // Store the power bits
       
       rom[50] = {7'h28, 16'h0000, 16'hFFFF};

       // Update CLKOUT6 (intermingled CLKFBOUT bits)

       rom[51] = (S5_CLKFBOUT_FRAC_EN == 0) ?
                 {7'h13, 16'hC000, O_CLKOUT6[31:16]}:
                 {7'h13, 16'hC000, O_CLKOUT6[31:30], S5_CLKFBOUT_FRAC_CALC[35:32], O_CLKOUT6[25:16]};

       // Store the input divider
       
       rom[52] = {7'h16, 16'hC000, {2'h0, S5_DIVCLK[23:22], S5_DIVCLK[11:0]} };

       // Store the feedback divide and phase
       
       rom[53] = (S5_CLKFBOUT_FRAC_EN == 0) ?
                {7'h14, 16'h1000, S5_CLKFBOUT[15:0]}:
                {7'h14, 16'h1000, S5_CLKFBOUT_FRAC_CALC[15:0]};
       rom[54] = (S5_CLKFBOUT_FRAC_EN == 0) ?
                {7'h15, 16'h8000, S5_CLKFBOUT[31:16]}:
                {7'h15, 16'h8000, S5_CLKFBOUT_FRAC_CALC[31:16]};

       // Store the lock settings
       
       rom[55] = {7'h18, 16'hFC00, {6'h00, S5_LOCK[29:20]} };
       rom[56] = {7'h19, 16'h8000, {1'b0 , S5_LOCK[34:30], S5_LOCK[9:0]} };
       rom[57] = {7'h1A, 16'h8000, {1'b0 , S5_LOCK[39:35], S5_LOCK[19:10]} };

       // Store the filter settings
       
       rom[58] = {7'h4E, 16'h66FF,
                 S5_DIGITAL_FILT[9], 2'h0, S5_DIGITAL_FILT[8:7], 2'h0,
                 S5_DIGITAL_FILT[6], 8'h00 };
       rom[59] = {7'h4F, 16'h666F,
                 S5_DIGITAL_FILT[5], 2'h0, S5_DIGITAL_FILT[4:3], 2'h0,
                 S5_DIGITAL_FILT[2:1], 2'h0, S5_DIGITAL_FILT[0], 4'h0 };

       //***********************************************************************
       // State 6 Initialization
       //***********************************************************************

       // Store the power bits
       
       rom[60] = {7'h28, 16'h0000, 16'hFFFF};

       // Update CLKOUT6 (intermingled CLKFBOUT bits)

       rom[61] = (S6_CLKFBOUT_FRAC_EN == 0) ?
                 {7'h13, 16'hC000, O_CLKOUT6[31:16]}:
                 {7'h13, 16'hC000, O_CLKOUT6[31:30], S6_CLKFBOUT_FRAC_CALC[35:32], O_CLKOUT6[25:16]};

       // Store the input divider
       
       rom[62] = {7'h16, 16'hC000, {2'h0, S6_DIVCLK[23:22], S6_DIVCLK[11:0]} };

       // Store the feedback divide and phase
       
       rom[63] = (S6_CLKFBOUT_FRAC_EN == 0) ?
                {7'h14, 16'h1000, S6_CLKFBOUT[15:0]}:
                {7'h14, 16'h1000, S6_CLKFBOUT_FRAC_CALC[15:0]};
       rom[64] = (S6_CLKFBOUT_FRAC_EN == 0) ?
                {7'h15, 16'h8000, S6_CLKFBOUT[31:16]}:
                {7'h15, 16'h8000, S6_CLKFBOUT_FRAC_CALC[31:16]};

       // Store the lock settings
       
       rom[65] = {7'h18, 16'hFC00, {6'h00, S6_LOCK[29:20]} };
       rom[66] = {7'h19, 16'h8000, {1'b0 , S6_LOCK[34:30], S6_LOCK[9:0]} };
       rom[67] = {7'h1A, 16'h8000, {1'b0 , S6_LOCK[39:35], S6_LOCK[19:10]} };

       // Store the filter settings
       
       rom[68] = {7'h4E, 16'h66FF,
                 S6_DIGITAL_FILT[9], 2'h0, S6_DIGITAL_FILT[8:7], 2'h0,
                 S6_DIGITAL_FILT[6], 8'h00 };
       rom[69] = {7'h4F, 16'h666F,
                 S6_DIGITAL_FILT[5], 2'h0, S6_DIGITAL_FILT[4:3], 2'h0,
                 S6_DIGITAL_FILT[2:1], 2'h0, S6_DIGITAL_FILT[0], 4'h0 };
    end

    // Output the initialized rom value based on rom_addr each clock cycle
    
    always @(posedge SCLK) begin
       rom_do<= #TCQ rom[rom_addr];
    end

    //**************************************************************************
    // Everything below is associated whith the state machine that is used to
    // Read/Modify/Write to the MMCM.
    //**************************************************************************

    // State Definitions
    
    localparam RESTART      = 4'h1;
    localparam WAIT_LOCK    = 4'h2;
    localparam WAIT_SEN     = 4'h3;
    localparam ADDRESS      = 4'h4;
    localparam WAIT_A_DRDY  = 4'h5;
    localparam BITMASK      = 4'h6;
    localparam BITSET       = 4'h7;
    localparam WRITE        = 4'h8;
    localparam WAIT_DRDY    = 4'h9;

    // State sync
    
    reg [3:0]  current_state   = RESTART;
    reg [3:0]  next_state      = RESTART;

    // These variables are used to keep track of the number of iterations that
    //    each state takes to reconfigure.
    // STATE_COUNT_CONST is used to reset the counters and should match the
    //    number of registers necessary to reconfigure each state.
    
    localparam STATE_COUNT_CONST  = 10;
    reg [4:0] state_count         = STATE_COUNT_CONST;
    reg [4:0] next_state_count    = STATE_COUNT_CONST;

    // This block assigns the next register value from the state machine below
    
    always @(posedge SCLK) begin
       DADDR       <= #TCQ next_daddr;
       DWE         <= #TCQ next_dwe;
       DEN         <= #TCQ next_den;
       RST_MMCM    <= #TCQ next_rst_mmcm;
       DI          <= #TCQ next_di;

       SRDY_N      <= #TCQ next_srdy_n;

       rom_addr    <= #TCQ next_rom_addr;
       state_count <= #TCQ next_state_count;
    end

    // This block assigns the next state, reset is synchronous.
    
    always @(posedge SCLK) begin
       if(RST) begin
          current_state <= #TCQ RESTART;
       end else begin
          current_state <= #TCQ next_state;
       end
    end

    always @* begin
       case (SADDR)
          3'b000  : start_addr = 7'd0;
          3'b001  : start_addr = 7'd10;
          3'b010  : start_addr = 7'd20;
          3'b011  : start_addr = 7'd30;
          3'b100  : start_addr = 7'd40;
          3'b101  : start_addr = 7'd50;
          3'b110  : start_addr = 7'd60;
          default : start_addr = 7'd0;
       endcase
    end

    always @* begin
       // Setup the default values
       next_srdy_n       = 1'b1;
       next_daddr        = DADDR;
       next_dwe          = 1'b0;
       next_den          = 1'b0;
       next_rst_mmcm     = RST_MMCM;
       next_di           = DI;
       next_rom_addr     = rom_addr;
       next_state_count  = state_count;

       case (current_state)
          // If RST is asserted reset the machine
          RESTART: begin
             next_daddr     = 7'h00;
             next_di        = 16'h0000;
             next_rom_addr  = 7'h00;
             next_rst_mmcm  = 1'b1;
             next_state     = WAIT_LOCK;
          end

          // Waits for the MMCM to assert IntLocked
          WAIT_LOCK: begin
             // Make sure reset is de-asserted
             next_rst_mmcm   = 1'b0;
             if(IntLocked) begin
                // MMCM is IntLocked, go on to wait for the SEN signal
                next_state  = WAIT_SEN;
             end else begin
                // Keep waiting, IntLocked has not asserted yet
                next_state  = WAIT_LOCK;
             end
          end

          // Wait for the next SEN pulse and set the ROM addr appropriately
          WAIT_SEN: begin
             next_rom_addr = start_addr;
             next_state_count = STATE_COUNT_CONST;
             next_srdy_n = SEN;
             if (SEN) begin
                // Go on to address the MMCM
                next_state = ADDRESS;
             end else begin
                // Keep waiting for SEN to be asserted
                next_state = WAIT_SEN;
             end
          end

          // Set the address on the MMCM and assert DEN to read the value
          ADDRESS: begin
             // Reset the DCM through the reconfiguration
             next_rst_mmcm  = 1'b1;
             // Enable a read from the MMCM and set the MMCM address
             next_den       = 1'b1;
             next_daddr     = rom_do[38:32];

             // Wait for the data to be ready
             next_state     = WAIT_A_DRDY;
          end

          // Wait for DRDY to assert after addressing the MMCM
          WAIT_A_DRDY: begin
             if (DRDY) begin
                // Data is ready, mask out the bits to save
                next_state = BITMASK;
             end else begin
                // Keep waiting till data is ready
                next_state = WAIT_A_DRDY;
             end
          end

          // Zero out the bits that are not set in the mask stored in rom
          BITMASK: begin
             // Do the mask
             next_di     = rom_do[31:16] & DO;
             // Go on to set the bits
             next_state  = BITSET;
          end

          // After the input is masked, OR the bits with calculated value in rom
          BITSET: begin
             // Set the bits that need to be assigned
             next_di           = rom_do[15:0] | DI;
             // Set the next address to read from ROM
             next_rom_addr     = rom_addr + 1'b1;
             // Go on to write the data to the MMCM
             next_state        = WRITE;
          end

          // DI is setup so assert DWE, DEN, and RST_MMCM.  Subtract one from the
          //    state count and go to wait for DRDY.
          WRITE: begin
             // Set WE and EN on MMCM
             next_dwe          = 1'b1;
             next_den          = 1'b1;

             // Decrement the number of registers left to write
             next_state_count  = state_count - 1'b1;
             // Wait for the write to complete
             next_state        = WAIT_DRDY;
          end

          // Wait for DRDY to assert from the MMCM.  If the state count is not 0
          //    jump to ADDRESS (continue reconfiguration).  If state count is
          //    0 wait for lock.
          WAIT_DRDY: begin
             if(DRDY) begin
                // Write is complete
                if(state_count > 0) begin
                   // If there are more registers to write keep going
                   next_state  = ADDRESS;
                end else begin
                   // There are no more registers to write so wait for the MMCM
                   // to lock
                   next_state  = WAIT_LOCK;
                end
             end else begin
                // Keep waiting for write to complete
                next_state     = WAIT_DRDY;
             end
          end

          // If in an unknown state reset the machine
          default: begin
             next_state = RESTART;
          end
       endcase
    end
endmodule
