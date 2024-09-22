///////////////////////////////////////////////////////////////////////////////
//
// Company:          Xilinx
// Engineer:         Karl Kurbjun and Carl Ribbing
// Date:             12/10/2009
// Design Name:      PLL DRP
// Module Name:      pll_drp.v
// Version:          1.1
// Target Devices:   Spartan 6 Family
// Tool versions:    L.68 (lin)
// Description:      This calls the DRP register calculation functions and
//                   provides a state machine to perform PLL reconfiguration
//                   based on the calulated values stored in a initialized ROM.
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

module drp_pll
   #(
      //***********************************************************************
      // State 0 Parameters - These are for the first reconfiguration state.
      //***********************************************************************
   
      // These parameters have an effect on the feedback path.  A change on
      // these parameters will effect all of the clock outputs.
      //
      // The paramaters are composed of:
      //    _MULT: This can be from 1 to 64.  It has an effect on the VCO
      //          frequency which consequently, effects all of the clock
      //          outputs.
      //    _PHASE: This is the phase multiplied by 1000. For example if
      //          a phase of 24.567 deg was desired the input value would be
      //          24567.  The range for the phase is from -360000 to 360000.
      
      parameter S0_CLKFBOUT_MULT          = 28,
      parameter S0_CLKFBOUT_PHASE         = 0,
      
      // The bandwidth parameter effects the phase error and the jitter filter
      // capability of the MMCM.  For more information on this parameter see the
      // Device user guide.
      
      parameter S0_BANDWIDTH              = "LOW",
      
      // The divclk parameter allows th einput clock to be divided before it
      // reaches the phase and frequency comparitor.  This can be set between
      // 1 and 128.
      
      parameter S0_DIVCLK_DIVIDE          = 2,
         
     // The following parameters describe the configuration that each clock
      // output should have once the reconfiguration for state one has
      // completed.
      //
      // The parameters are composed of:
      //    _DIVIDE: This can be from 1 to 128
      //    _PHASE: This is the phase multiplied by 1000. For example if
      //          a phase of 24.567 deg was desired the input value would be
      //          24567.  The range for the phase is from -360000 to 360000.
      //    _DUTY: This is the duty cycle multiplied by 100,000.  For example if 
      //          a duty cycle of .24567 was desired the input would be
      //          24567.
      
      parameter S0_CLKOUT0_DIVIDE         = 100,
      parameter S0_CLKOUT0_PHASE          = 0,
      parameter S0_CLKOUT0_DUTY           = 50000,
      
      parameter S0_CLKOUT1_DIVIDE         = 100,
      parameter S0_CLKOUT1_PHASE          = 0,
      parameter S0_CLKOUT1_DUTY           = 50000,
      
      parameter S0_CLKOUT2_DIVIDE         = 100,
      parameter S0_CLKOUT2_PHASE          = 0,
      parameter S0_CLKOUT2_DUTY           = 50000,
      
      parameter S0_CLKOUT3_DIVIDE         = 100,
      parameter S0_CLKOUT3_PHASE          = 0,
      parameter S0_CLKOUT3_DUTY           = 50000,
      
      parameter S0_CLKOUT4_DIVIDE         = 100,
      parameter S0_CLKOUT4_PHASE          = 0,
      parameter S0_CLKOUT4_DUTY           = 50000,
      
      parameter S0_CLKOUT5_DIVIDE         = 100,
      parameter S0_CLKOUT5_PHASE          = 0,
      parameter S0_CLKOUT5_DUTY           = 50000,

      //***********************************************************************
      // State 1 Parameters - These are for the second reconfiguration state.
      //***********************************************************************
 
      parameter S1_CLKFBOUT_MULT          = 28,
      parameter S1_CLKFBOUT_PHASE         = 0,
      parameter S1_BANDWIDTH              = "LOW",
      parameter S1_DIVCLK_DIVIDE          = 2,

      parameter S1_CLKOUT0_DIVIDE         = 100,
      parameter S1_CLKOUT0_PHASE          = 0,
      parameter S1_CLKOUT0_DUTY           = 50000,
      
      parameter S1_CLKOUT1_DIVIDE         = 100,
      parameter S1_CLKOUT1_PHASE          = 0,
      parameter S1_CLKOUT1_DUTY           = 50000,
      
      parameter S1_CLKOUT2_DIVIDE         = 100,
      parameter S1_CLKOUT2_PHASE          = 0,
      parameter S1_CLKOUT2_DUTY           = 50000,
      
      parameter S1_CLKOUT3_DIVIDE         = 100,
      parameter S1_CLKOUT3_PHASE          = 0,
      parameter S1_CLKOUT3_DUTY           = 50000,
      
      parameter S1_CLKOUT4_DIVIDE         = 100,
      parameter S1_CLKOUT4_PHASE          = 0,
      parameter S1_CLKOUT4_DUTY           = 50000,

      parameter S1_CLKOUT5_DIVIDE         = 100,
      parameter S1_CLKOUT5_PHASE          = 0,
      parameter S1_CLKOUT5_DUTY           = 50000,

      //***********************************************************************
      // State 2 Parameters - These are for the third reconfiguration state.
      //***********************************************************************
      
      parameter S2_CLKFBOUT_MULT          = 28,
      parameter S2_CLKFBOUT_PHASE         = 0,
      parameter S2_BANDWIDTH              = "LOW",
      parameter S2_DIVCLK_DIVIDE          = 2,

      parameter S2_CLKOUT0_DIVIDE         = 100,
      parameter S2_CLKOUT0_PHASE          = 0,
      parameter S2_CLKOUT0_DUTY           = 50000,
      
      parameter S2_CLKOUT1_DIVIDE         = 100,
      parameter S2_CLKOUT1_PHASE          = 0,
      parameter S2_CLKOUT1_DUTY           = 50000,
      
      parameter S2_CLKOUT2_DIVIDE         = 100,
      parameter S2_CLKOUT2_PHASE          = 0,
      parameter S2_CLKOUT2_DUTY           = 50000,
      
      parameter S2_CLKOUT3_DIVIDE         = 100,
      parameter S2_CLKOUT3_PHASE          = 0,
      parameter S2_CLKOUT3_DUTY           = 50000,
      
      parameter S2_CLKOUT4_DIVIDE         = 100,
      parameter S2_CLKOUT4_PHASE          = 0,
      parameter S2_CLKOUT4_DUTY           = 50000,

      parameter S2_CLKOUT5_DIVIDE         = 100,
      parameter S2_CLKOUT5_PHASE          = 0,
      parameter S2_CLKOUT5_DUTY           = 50000,
      
      //***********************************************************************
      // State 3 Parameters - These are for the fourth reconfiguration state.
      //***********************************************************************

      parameter S3_CLKFBOUT_MULT          = 28,
      parameter S3_CLKFBOUT_PHASE         = 0,
      parameter S3_BANDWIDTH              = "LOW",
      parameter S3_DIVCLK_DIVIDE          = 2,

      parameter S3_CLKOUT0_DIVIDE         = 100,
      parameter S3_CLKOUT0_PHASE          = 0,
      parameter S3_CLKOUT0_DUTY           = 50000,
      
      parameter S3_CLKOUT1_DIVIDE         = 100,
      parameter S3_CLKOUT1_PHASE          = 0,
      parameter S3_CLKOUT1_DUTY           = 50000,
      
      parameter S3_CLKOUT2_DIVIDE         = 100,
      parameter S3_CLKOUT2_PHASE          = 0,
      parameter S3_CLKOUT2_DUTY           = 50000,
      
      parameter S3_CLKOUT3_DIVIDE         = 100,
      parameter S3_CLKOUT3_PHASE          = 0,
      parameter S3_CLKOUT3_DUTY           = 50000,
      
      parameter S3_CLKOUT4_DIVIDE         = 100,
      parameter S3_CLKOUT4_PHASE          = 0,
      parameter S3_CLKOUT4_DUTY           = 50000,

      parameter S3_CLKOUT5_DIVIDE         = 100,
      parameter S3_CLKOUT5_PHASE          = 0,
      parameter S3_CLKOUT5_DUTY           = 50000,
            
      //***********************************************************************
      // State 4 Parameters - These are for the fifth reconfiguration state.
      //***********************************************************************

      parameter S4_CLKFBOUT_MULT          = 28,
      parameter S4_CLKFBOUT_PHASE         = 0,
      parameter S4_BANDWIDTH              = "LOW",
      parameter S4_DIVCLK_DIVIDE          = 2,

      parameter S4_CLKOUT0_DIVIDE         = 100,
      parameter S4_CLKOUT0_PHASE          = 0,
      parameter S4_CLKOUT0_DUTY           = 50000,
      
      parameter S4_CLKOUT1_DIVIDE         = 100,
      parameter S4_CLKOUT1_PHASE          = 0,
      parameter S4_CLKOUT1_DUTY           = 50000,
      
      parameter S4_CLKOUT2_DIVIDE         = 100,
      parameter S4_CLKOUT2_PHASE          = 0,
      parameter S4_CLKOUT2_DUTY           = 50000,
      
      parameter S4_CLKOUT3_DIVIDE         = 100,
      parameter S4_CLKOUT3_PHASE          = 0,
      parameter S4_CLKOUT3_DUTY           = 50000,
      
      parameter S4_CLKOUT4_DIVIDE         = 100,
      parameter S4_CLKOUT4_PHASE          = 0,
      parameter S4_CLKOUT4_DUTY           = 50000,

      parameter S4_CLKOUT5_DIVIDE         = 100,
      parameter S4_CLKOUT5_PHASE          = 0,
      parameter S4_CLKOUT5_DUTY           = 50000,
      
      //***********************************************************************
      // State 5 Parameters - These are for the sixth reconfiguration state.
      //***********************************************************************

      parameter S5_CLKFBOUT_MULT          = 28,
      parameter S5_CLKFBOUT_PHASE         = 0,
      parameter S5_BANDWIDTH              = "LOW",
      parameter S5_DIVCLK_DIVIDE          = 2,

      parameter S5_CLKOUT0_DIVIDE         = 100,
      parameter S5_CLKOUT0_PHASE          = 0,
      parameter S5_CLKOUT0_DUTY           = 50000,
      
      parameter S5_CLKOUT1_DIVIDE         = 100,
      parameter S5_CLKOUT1_PHASE          = 0,
      parameter S5_CLKOUT1_DUTY           = 50000,
      
      parameter S5_CLKOUT2_DIVIDE         = 100,
      parameter S5_CLKOUT2_PHASE          = 0,
      parameter S5_CLKOUT2_DUTY           = 50000,
      
      parameter S5_CLKOUT3_DIVIDE         = 100,
      parameter S5_CLKOUT3_PHASE          = 0,
      parameter S5_CLKOUT3_DUTY           = 50000,
      
      parameter S5_CLKOUT4_DIVIDE         = 100,
      parameter S5_CLKOUT4_PHASE          = 0,
      parameter S5_CLKOUT4_DUTY           = 50000,

      parameter S5_CLKOUT5_DIVIDE         = 100,
      parameter S5_CLKOUT5_PHASE          = 0,
      parameter S5_CLKOUT5_DUTY           = 50000,

      //***********************************************************************
      // State 6 Parameters - These are for the seventh reconfiguration state.
      //***********************************************************************

      parameter S6_CLKFBOUT_MULT          = 28,
      parameter S6_CLKFBOUT_PHASE         = 0,
      parameter S6_BANDWIDTH              = "LOW",
      parameter S6_DIVCLK_DIVIDE          = 2,

      parameter S6_CLKOUT0_DIVIDE         = 100,
      parameter S6_CLKOUT0_PHASE          = 0,
      parameter S6_CLKOUT0_DUTY           = 50000,
      
      parameter S6_CLKOUT1_DIVIDE         = 100,
      parameter S6_CLKOUT1_PHASE          = 0,
      parameter S6_CLKOUT1_DUTY           = 50000,
      
      parameter S6_CLKOUT2_DIVIDE         = 100,
      parameter S6_CLKOUT2_PHASE          = 0,
      parameter S6_CLKOUT2_DUTY           = 50000,
      
      parameter S6_CLKOUT3_DIVIDE         = 100,
      parameter S6_CLKOUT3_PHASE          = 0,
      parameter S6_CLKOUT3_DUTY           = 50000,
      
      parameter S6_CLKOUT4_DIVIDE         = 100,
      parameter S6_CLKOUT4_PHASE          = 0,
      parameter S6_CLKOUT4_DUTY           = 50000,

      parameter S6_CLKOUT5_DIVIDE         = 100,
      parameter S6_CLKOUT5_PHASE          = 0,
      parameter S6_CLKOUT5_DUTY           = 50000
      
   ) (
      // These signals are controlled by user logic interface and are covered
      // in more detail within the XAPP.
      input [2:0]       SADDR,
      input             SEN,
      input             SCLK,
      input             RST,
      output reg        SRDY_N,
      
      // These signals are to be connected to the PLL_ADV by port name.
      // Their use matches the PLL port description in the Device User Guide.
      input      [15:0] DO,
      input             DRDY,
      input             LOCKED,
      output reg        DWE,
      output reg        DEN,
      output reg [4:0]  DADDR,
      output reg [15:0] DI,
      output            DCLK,
      output reg        RST_PLL
   );

   // 100 ps delay for behavioral simulations
   localparam  TCQ = 100;

   // Make sure the memory is implemented as distributed (does not work on 11.2)
   (* rom_style = "distributed" *)

   reg [36:0]  rom [160:0];
   reg [7:0]   rom_addr;
   reg [36:0]  rom_do;
   reg         next_srdy_n;
   reg [7:0]   next_rom_addr;
   reg [7:0]   start_addr;
   reg [4:0]   next_daddr;
   reg         next_dwe;
   reg         next_den;
   reg         next_rst_pll;
   reg [15:0]  next_di;
   
   // Pass SCLK to DCLK for the PLL
   
   assign DCLK = SCLK;
   
   // include the PLL reconfiguration functions.  This contains the constant
   // functions that are used in the calculations below.  This file is 
   // required.
   
   `include "drp_pll_func.h"

   //**************************************************************************
   // State 0 Calculations
   //**************************************************************************
   
   localparam [22:0] S0_CLKFBOUT       =
      s6_pll_count_calc(S0_CLKFBOUT_MULT, S0_CLKFBOUT_PHASE, 50000);
     
   localparam [22:0] S0_CLKFBOUT2      =
      s6_pll_count_calc(S0_CLKFBOUT_MULT, S0_CLKFBOUT_PHASE, 50000);
      
   localparam [9:0]  S0_DIGITAL_FILT   = 
      s6_pll_filter_lookup(S0_CLKFBOUT_MULT, S0_BANDWIDTH);
      
   localparam [39:0] S0_LOCK           =
      s6_pll_lock_lookup(S0_CLKFBOUT_MULT);
      
   localparam [22:0] S0_DIVCLK         = 
      s6_pll_count_calc(S0_DIVCLK_DIVIDE, 0, 50000); 
      
   localparam [22:0] S0_CLKOUT0        =
      s6_pll_count_calc(S0_CLKOUT0_DIVIDE, S0_CLKOUT0_PHASE, S0_CLKOUT0_DUTY); 
         
   localparam [22:0] S0_CLKOUT1        = 
      s6_pll_count_calc(S0_CLKOUT1_DIVIDE, S0_CLKOUT1_PHASE, S0_CLKOUT1_DUTY); 
         
   localparam [22:0] S0_CLKOUT2        = 
      s6_pll_count_calc(S0_CLKOUT2_DIVIDE, S0_CLKOUT2_PHASE, S0_CLKOUT2_DUTY); 
         
   localparam [22:0] S0_CLKOUT3        = 
      s6_pll_count_calc(S0_CLKOUT3_DIVIDE, S0_CLKOUT3_PHASE, S0_CLKOUT3_DUTY); 
         
   localparam [22:0] S0_CLKOUT4        = 
      s6_pll_count_calc(S0_CLKOUT4_DIVIDE, S0_CLKOUT4_PHASE, S0_CLKOUT4_DUTY);

   localparam [22:0] S0_CLKOUT5        = 
      s6_pll_count_calc(S0_CLKOUT5_DIVIDE, S0_CLKOUT5_PHASE, S0_CLKOUT5_DUTY);
      
   //**************************************************************************
   // State 1 Calculations
   //**************************************************************************
   
   localparam [22:0] S1_CLKFBOUT       =
      s6_pll_count_calc(S1_CLKFBOUT_MULT, S1_CLKFBOUT_PHASE, 50000);
     
   localparam [22:0] S1_CLKFBOUT2      =
      s6_pll_count_calc(S1_CLKFBOUT_MULT, S1_CLKFBOUT_PHASE, 50000);
      
   localparam [9:0]  S1_DIGITAL_FILT   = 
      s6_pll_filter_lookup(S1_CLKFBOUT_MULT, S1_BANDWIDTH);
      
   localparam [39:0] S1_LOCK           =
      s6_pll_lock_lookup(S1_CLKFBOUT_MULT);
      
   localparam [22:0] S1_DIVCLK         = 
      s6_pll_count_calc(S1_DIVCLK_DIVIDE, 0, 50000); 
      
   localparam [22:0] S1_CLKOUT0        =
      s6_pll_count_calc(S1_CLKOUT0_DIVIDE, S1_CLKOUT0_PHASE, S1_CLKOUT0_DUTY); 
         
   localparam [22:0] S1_CLKOUT1        = 
      s6_pll_count_calc(S1_CLKOUT1_DIVIDE, S1_CLKOUT1_PHASE, S1_CLKOUT1_DUTY); 
         
   localparam [22:0] S1_CLKOUT2        = 
      s6_pll_count_calc(S1_CLKOUT2_DIVIDE, S1_CLKOUT2_PHASE, S1_CLKOUT2_DUTY); 
         
   localparam [22:0] S1_CLKOUT3        = 
      s6_pll_count_calc(S1_CLKOUT3_DIVIDE, S1_CLKOUT3_PHASE, S1_CLKOUT3_DUTY); 
         
   localparam [22:0] S1_CLKOUT4        = 
      s6_pll_count_calc(S1_CLKOUT4_DIVIDE, S1_CLKOUT4_PHASE, S1_CLKOUT4_DUTY); 

   localparam [22:0] S1_CLKOUT5        = 
      s6_pll_count_calc(S1_CLKOUT5_DIVIDE, S1_CLKOUT5_PHASE, S1_CLKOUT5_DUTY); 
      
   //**************************************************************************
   // State 2 Calculations
   //**************************************************************************
   
   localparam [22:0] S2_CLKFBOUT       = 
      s6_pll_count_calc(S2_CLKFBOUT_MULT, S2_CLKFBOUT_PHASE, 50000);
     
   localparam [22:0] S2_CLKFBOUT2      = 
      s6_pll_count_calc(S2_CLKFBOUT_MULT, S2_CLKFBOUT_PHASE, 50000);
      
   localparam [9:0] S2_DIGITAL_FILT    = 
      s6_pll_filter_lookup(S2_CLKFBOUT_MULT, S2_BANDWIDTH);
   
   localparam [39:0] S2_LOCK           = 
      s6_pll_lock_lookup(S2_CLKFBOUT_MULT);
   
   localparam [22:0] S2_DIVCLK         = 
      s6_pll_count_calc(S2_DIVCLK_DIVIDE, 0, 50000); 
   
   localparam [22:0] S2_CLKOUT0        = 
      s6_pll_count_calc(S2_CLKOUT0_DIVIDE, S2_CLKOUT0_PHASE, S2_CLKOUT0_DUTY);
         
   localparam [22:0] S2_CLKOUT1        = 
      s6_pll_count_calc(S2_CLKOUT1_DIVIDE, S2_CLKOUT1_PHASE, S2_CLKOUT1_DUTY);
         
   localparam [22:0] S2_CLKOUT2        = 
      s6_pll_count_calc(S2_CLKOUT2_DIVIDE, S2_CLKOUT2_PHASE, S2_CLKOUT2_DUTY);
         
   localparam [22:0] S2_CLKOUT3        = 
      s6_pll_count_calc(S2_CLKOUT3_DIVIDE, S2_CLKOUT3_PHASE, S2_CLKOUT3_DUTY);
         
   localparam [22:0] S2_CLKOUT4        = 
      s6_pll_count_calc(S2_CLKOUT4_DIVIDE, S2_CLKOUT4_PHASE, S2_CLKOUT4_DUTY);

   localparam [22:0] S2_CLKOUT5        = 
      s6_pll_count_calc(S2_CLKOUT5_DIVIDE, S2_CLKOUT5_PHASE, S2_CLKOUT5_DUTY);

   //**************************************************************************
   // State 3 Calculations
   //**************************************************************************
   
   localparam [22:0] S3_CLKFBOUT       = 
      s6_pll_count_calc(S3_CLKFBOUT_MULT, S3_CLKFBOUT_PHASE, 50000);
     
   localparam [22:0] S3_CLKFBOUT2      = 
      s6_pll_count_calc(S3_CLKFBOUT_MULT, S3_CLKFBOUT_PHASE, 50000);
      
   localparam [9:0] S3_DIGITAL_FILT    = 
      s6_pll_filter_lookup(S3_CLKFBOUT_MULT, S3_BANDWIDTH);
   
   localparam [39:0] S3_LOCK           = 
      s6_pll_lock_lookup(S3_CLKFBOUT_MULT);
   
   localparam [22:0] S3_DIVCLK         = 
      s6_pll_count_calc(S3_DIVCLK_DIVIDE, 0, 50000); 
   
   localparam [22:0] S3_CLKOUT0        = 
      s6_pll_count_calc(S3_CLKOUT0_DIVIDE, S3_CLKOUT0_PHASE, S3_CLKOUT0_DUTY);
         
   localparam [22:0] S3_CLKOUT1        = 
      s6_pll_count_calc(S3_CLKOUT1_DIVIDE, S3_CLKOUT1_PHASE, S3_CLKOUT1_DUTY);
         
   localparam [22:0] S3_CLKOUT2        = 
      s6_pll_count_calc(S3_CLKOUT2_DIVIDE, S3_CLKOUT2_PHASE, S3_CLKOUT2_DUTY);
         
   localparam [22:0] S3_CLKOUT3        = 
      s6_pll_count_calc(S3_CLKOUT3_DIVIDE, S3_CLKOUT3_PHASE, S3_CLKOUT3_DUTY);
         
   localparam [22:0] S3_CLKOUT4        = 
      s6_pll_count_calc(S3_CLKOUT4_DIVIDE, S3_CLKOUT4_PHASE, S3_CLKOUT4_DUTY);

   localparam [22:0] S3_CLKOUT5        = 
      s6_pll_count_calc(S3_CLKOUT5_DIVIDE, S3_CLKOUT5_PHASE, S3_CLKOUT5_DUTY);

   //**************************************************************************
   // State 4 Calculations
   //**************************************************************************
   
   localparam [22:0] S4_CLKFBOUT       = 
      s6_pll_count_calc(S4_CLKFBOUT_MULT, S4_CLKFBOUT_PHASE, 50000);
     
   localparam [22:0] S4_CLKFBOUT2      = 
      s6_pll_count_calc(S4_CLKFBOUT_MULT, S4_CLKFBOUT_PHASE, 50000);
      
   localparam [9:0] S4_DIGITAL_FILT    = 
      s6_pll_filter_lookup(S4_CLKFBOUT_MULT, S4_BANDWIDTH);
   
   localparam [39:0] S4_LOCK           = 
      s6_pll_lock_lookup(S4_CLKFBOUT_MULT);
   
   localparam [22:0] S4_DIVCLK         = 
      s6_pll_count_calc(S4_DIVCLK_DIVIDE, 0, 50000); 
   
   localparam [22:0] S4_CLKOUT0        = 
      s6_pll_count_calc(S4_CLKOUT0_DIVIDE, S4_CLKOUT0_PHASE, S4_CLKOUT0_DUTY);
         
   localparam [22:0] S4_CLKOUT1        = 
      s6_pll_count_calc(S4_CLKOUT1_DIVIDE, S4_CLKOUT1_PHASE, S4_CLKOUT1_DUTY);
         
   localparam [22:0] S4_CLKOUT2        = 
      s6_pll_count_calc(S4_CLKOUT2_DIVIDE, S4_CLKOUT2_PHASE, S4_CLKOUT2_DUTY);
         
   localparam [22:0] S4_CLKOUT3        = 
      s6_pll_count_calc(S4_CLKOUT3_DIVIDE, S4_CLKOUT3_PHASE, S4_CLKOUT3_DUTY);
         
   localparam [22:0] S4_CLKOUT4        = 
      s6_pll_count_calc(S4_CLKOUT4_DIVIDE, S4_CLKOUT4_PHASE, S4_CLKOUT4_DUTY);

   localparam [22:0] S4_CLKOUT5        = 
      s6_pll_count_calc(S4_CLKOUT5_DIVIDE, S4_CLKOUT5_PHASE, S4_CLKOUT5_DUTY);

   //**************************************************************************
   // State 5 Calculations
   //**************************************************************************
   
   localparam [22:0] S5_CLKFBOUT       = 
      s6_pll_count_calc(S5_CLKFBOUT_MULT, S5_CLKFBOUT_PHASE, 50000);
     
   localparam [22:0] S5_CLKFBOUT2      = 
      s6_pll_count_calc(S5_CLKFBOUT_MULT, S5_CLKFBOUT_PHASE, 50000);
      
   localparam [9:0] S5_DIGITAL_FILT    = 
      s6_pll_filter_lookup(S5_CLKFBOUT_MULT, S5_BANDWIDTH);
   
   localparam [39:0] S5_LOCK           = 
      s6_pll_lock_lookup(S5_CLKFBOUT_MULT);
   
   localparam [22:0] S5_DIVCLK         = 
      s6_pll_count_calc(S5_DIVCLK_DIVIDE, 0, 50000); 
   
   localparam [22:0] S5_CLKOUT0        = 
      s6_pll_count_calc(S5_CLKOUT0_DIVIDE, S5_CLKOUT0_PHASE, S5_CLKOUT0_DUTY);
         
   localparam [22:0] S5_CLKOUT1        = 
      s6_pll_count_calc(S5_CLKOUT1_DIVIDE, S5_CLKOUT1_PHASE, S5_CLKOUT1_DUTY);
         
   localparam [22:0] S5_CLKOUT2        = 
      s6_pll_count_calc(S5_CLKOUT2_DIVIDE, S5_CLKOUT2_PHASE, S5_CLKOUT2_DUTY);
         
   localparam [22:0] S5_CLKOUT3        = 
      s6_pll_count_calc(S5_CLKOUT3_DIVIDE, S5_CLKOUT3_PHASE, S5_CLKOUT3_DUTY);
         
   localparam [22:0] S5_CLKOUT4        = 
      s6_pll_count_calc(S5_CLKOUT4_DIVIDE, S5_CLKOUT4_PHASE, S5_CLKOUT4_DUTY);

   localparam [22:0] S5_CLKOUT5        = 
      s6_pll_count_calc(S5_CLKOUT5_DIVIDE, S5_CLKOUT5_PHASE, S5_CLKOUT5_DUTY);

   //**************************************************************************
   // State 6 Calculations
   //**************************************************************************
   
   localparam [22:0] S6_CLKFBOUT       = 
      s6_pll_count_calc(S6_CLKFBOUT_MULT, S6_CLKFBOUT_PHASE, 50000);
     
   localparam [22:0] S6_CLKFBOUT2      = 
      s6_pll_count_calc(S6_CLKFBOUT_MULT, S6_CLKFBOUT_PHASE, 50000);
      
   localparam [9:0] S6_DIGITAL_FILT    = 
      s6_pll_filter_lookup(S6_CLKFBOUT_MULT, S6_BANDWIDTH);
   
   localparam [39:0] S6_LOCK           = 
      s6_pll_lock_lookup(S6_CLKFBOUT_MULT);
   
   localparam [22:0] S6_DIVCLK         = 
      s6_pll_count_calc(S6_DIVCLK_DIVIDE, 0, 50000); 
   
   localparam [22:0] S6_CLKOUT0        = 
      s6_pll_count_calc(S6_CLKOUT0_DIVIDE, S6_CLKOUT0_PHASE, S6_CLKOUT0_DUTY);
         
   localparam [22:0] S6_CLKOUT1        = 
      s6_pll_count_calc(S6_CLKOUT1_DIVIDE, S6_CLKOUT1_PHASE, S6_CLKOUT1_DUTY);
         
   localparam [22:0] S6_CLKOUT2        = 
      s6_pll_count_calc(S6_CLKOUT2_DIVIDE, S6_CLKOUT2_PHASE, S6_CLKOUT2_DUTY);
         
   localparam [22:0] S6_CLKOUT3        = 
      s6_pll_count_calc(S6_CLKOUT3_DIVIDE, S6_CLKOUT3_PHASE, S6_CLKOUT3_DUTY);
         
   localparam [22:0] S6_CLKOUT4        = 
      s6_pll_count_calc(S6_CLKOUT4_DIVIDE, S6_CLKOUT4_PHASE, S6_CLKOUT4_DUTY);

   localparam [22:0] S6_CLKOUT5        = 
      s6_pll_count_calc(S6_CLKOUT5_DIVIDE, S6_CLKOUT5_PHASE, S6_CLKOUT5_DUTY);

   initial begin
   
      // rom entries contain (in order) the address, a bitmask, and a bitset
      
      //***********************************************************************
      // State 0 Initialization
      //***********************************************************************
      
     rom[0] = {5'h05, 16'h50FF,  S0_CLKOUT0[19], 1'b0, S0_CLKOUT0[18], 1'b0,//bits 15 down to 12
                                 S0_CLKOUT0[16], S0_CLKOUT0[17], S0_CLKOUT0[15], S0_CLKOUT0[14], 8'h00};//bits 11 downto 0
                         
     rom[1] = {5'h06, 16'h010B,  S0_CLKOUT1[4], S0_CLKOUT1[5], S0_CLKOUT1[3], S0_CLKOUT1[12], //bits 15 down to 12
                                 S0_CLKOUT1[1], S0_CLKOUT1[2], S0_CLKOUT1[19], 1'b0, S0_CLKOUT1[17], S0_CLKOUT1[16], //bits 11 down to 6
                          S0_CLKOUT1[14], S0_CLKOUT1[15], 1'b0, S0_CLKOUT0[13], 2'b00}; //bits 5 down to 0
                         
     rom[2] = {5'h07, 16'hE02C,  3'b000, S0_CLKOUT1[11], S0_CLKOUT1[9], S0_CLKOUT1[10], //bits 15 down to 10
                                 S0_CLKOUT1[8], S0_CLKOUT1[7], S0_CLKOUT1[6], S0_CLKOUT1[20], 1'b0, S0_CLKOUT1[13], //bits 9 down to 4 
                          2'b00, S0_CLKOUT1[21], S0_CLKOUT1[22]}; //bits 3 down to 0
                         
     rom[3] = {5'h08, 16'h4001,  S0_CLKOUT2[22], 1'b0, S0_CLKOUT2[5], S0_CLKOUT2[21], //bits 15 downto 12
                                 S0_CLKOUT2[12], S0_CLKOUT2[4], S0_CLKOUT2[3], S0_CLKOUT2[2], S0_CLKOUT2[0], S0_CLKOUT2[19], //bits 11 down to 6
                          S0_CLKOUT2[17], S0_CLKOUT2[18], S0_CLKOUT2[15], S0_CLKOUT2[16], S0_CLKOUT2[14], 1'b0}; //bits 5 down to 0
                         
     rom[4] = {5'h09, 16'h0D03,  S0_CLKOUT3[14], S0_CLKOUT3[15], S0_CLKOUT0[21], S0_CLKOUT0[22], 2'b00, S0_CLKOUT2[10], 1'b0, //bits 15 downto 8
                                 S0_CLKOUT2[9], S0_CLKOUT2[8], S0_CLKOUT2[6], S0_CLKOUT2[7], S0_CLKOUT2[13], S0_CLKOUT2[20], 2'b00}; //bits 7 downto 0
                         
     rom[5] = {5'h0A, 16'hB001,  1'b0, S0_CLKOUT3[13], 2'b00, S0_CLKOUT3[21], S0_CLKOUT3[22], S0_CLKOUT3[5], S0_CLKOUT3[4], //bits 15 downto 8
                                 S0_CLKOUT3[12], S0_CLKOUT3[2], S0_CLKOUT3[0], S0_CLKOUT3[1], S0_CLKOUT3[18], S0_CLKOUT3[19], //bits 7 downto 2
                          S0_CLKOUT3[17], 1'b0}; //bits 1 downto 0
                          
     rom[6] = {5'h0B, 16'h0110,  S0_CLKOUT0[5], S0_CLKOUT4[19], S0_CLKOUT4[14], S0_CLKOUT4[17], //bits 15 downto 12
                                 S0_CLKOUT4[15], S0_CLKOUT4[16], S0_CLKOUT0[4], 1'b0, S0_CLKOUT3[11], S0_CLKOUT3[10], //bits 11 downto 6 
                          S0_CLKOUT3[9], 1'b0, S0_CLKOUT3[7], S0_CLKOUT3[8], S0_CLKOUT3[20], S0_CLKOUT3[6]}; //bits 5 downto 0
                         
     rom[7] = {5'h0C, 16'h0B00,  S0_CLKOUT4[7], S0_CLKOUT4[8], S0_CLKOUT4[20], S0_CLKOUT4[6], 1'b0, S0_CLKOUT4[13], //bits 15 downto 10
                                 2'b00, S0_CLKOUT4[22], S0_CLKOUT4[21], S0_CLKOUT4[4], S0_CLKOUT4[5], S0_CLKOUT4[3], //bits 9 downto 3
                          S0_CLKOUT4[12], S0_CLKOUT4[1], S0_CLKOUT4[2]}; //bits 2 downto 0
                         
     rom[8] = {5'h0D, 16'h0008,  S0_CLKOUT5[2], S0_CLKOUT5[3], S0_CLKOUT5[0], S0_CLKOUT5[1], S0_CLKOUT5[18], //bits 15 downto 11
                          S0_CLKOUT5[19], S0_CLKOUT5[17], S0_CLKOUT5[16], S0_CLKOUT5[15], S0_CLKOUT0[3], //bits 10 downto 6
                          S0_CLKOUT0[0], S0_CLKOUT0[2], 1'b0, S0_CLKOUT4[11], S0_CLKOUT4[9], S0_CLKOUT4[10]}; //bits 5 downto 0
                         
     rom[9] = {5'h0E, 16'h00D0,  S0_CLKOUT5[10], S0_CLKOUT5[11], S0_CLKOUT5[8], S0_CLKOUT5[9], S0_CLKOUT5[6], //bits 15 downto 11
                          S0_CLKOUT5[7], S0_CLKOUT5[20], S0_CLKOUT5[13], 2'b00, S0_CLKOUT5[22], 1'b0, //bits 10 downto 4
                          S0_CLKOUT5[5], S0_CLKOUT5[21], S0_CLKOUT5[12], S0_CLKOUT5[4]}; //bits 3 downto 0
                         
     rom[10] = {5'h0F, 16'h0003, S0_CLKFBOUT[4], S0_CLKFBOUT[5], S0_CLKFBOUT[3], S0_CLKFBOUT[12], S0_CLKFBOUT[1], //bits 15 downto 11
                                 S0_CLKFBOUT[2], S0_CLKFBOUT[0], S0_CLKFBOUT[19], S0_CLKFBOUT[18], S0_CLKFBOUT[17], //bits 10 downto 6
                          S0_CLKFBOUT[15], S0_CLKFBOUT[16], S0_CLKOUT0[12], S0_CLKOUT0[1], 2'b00}; //bits 5 downto 0
                          
     rom[11] = {5'h10, 16'h800C, 1'b0, S0_CLKOUT0[9], S0_CLKOUT0[11], S0_CLKOUT0[10], S0_CLKFBOUT[10], S0_CLKFBOUT[11], //bits 15 downto 10
                          S0_CLKFBOUT[9], S0_CLKFBOUT[8], S0_CLKFBOUT[7], S0_CLKFBOUT[6], S0_CLKFBOUT[13],  //bits 9 downto 5
                          S0_CLKFBOUT[20], 2'b00, S0_CLKFBOUT[21], S0_CLKFBOUT[22]}; //bits 4 downto 0
                              
     rom[12] = {5'h11, 16'hFC00, 6'h00, S0_CLKOUT3[3], S0_CLKOUT3[16], S0_CLKOUT2[11], S0_CLKOUT2[1], S0_CLKOUT1[18], //bits 15 downto 6
                          S0_CLKOUT1[0], S0_CLKOUT0[6], S0_CLKOUT0[20], S0_CLKOUT0[8], S0_CLKOUT0[7]}; //bits 5 downto 0
                          
     rom[13] = {5'h12, 16'hF0FF, 4'h0, S0_CLKOUT5[14], S0_CLKFBOUT[14], S0_CLKOUT4[0], S0_CLKOUT4[18],  8'h00};  //bits 15 downto 0
                          
     rom[14] = {5'h13, 16'h5120, S0_DIVCLK[11], 1'b0, S0_DIVCLK[10], 1'b0, S0_DIVCLK[7], S0_DIVCLK[8],  //bits 15 downto 10
                                 S0_DIVCLK[0], 1'b0, S0_DIVCLK[5], S0_DIVCLK[2], 1'b0, S0_DIVCLK[13], 4'h0};  //bits 9 downto 0
                          
     rom[15] = {5'h14, 16'h2FFF, S0_LOCK[1], S0_LOCK[2], 1'b0, S0_LOCK[0], 12'h000}; //bits 15 downto 0
                          
     rom[16] = {5'h15, 16'hBFF4, 1'b0, S0_DIVCLK[12], 10'h000, S0_LOCK[38], 1'b0, S0_LOCK[32], S0_LOCK[39]}; //bits 15 downto 0                         
                          
     rom[17] = {5'h16, 16'h0A55, S0_LOCK[15], S0_LOCK[13], S0_LOCK[27], S0_LOCK[16], 1'b0, S0_LOCK[10],   //bits 15 downto 10
                                 1'b0, S0_DIVCLK[9], S0_DIVCLK[1], 1'b0, S0_DIVCLK[6], 1'b0, S0_DIVCLK[3],  //bits 9 downto 3
                          1'b0, S0_DIVCLK[4], 1'b0};  //bits 2 downto 0
     
     rom[18] = {5'h17, 16'hFFD0, 10'h000, S0_LOCK[17], 1'b0, S0_LOCK[8], S0_LOCK[9], S0_LOCK[23], S0_LOCK[22]}; //bits 15 downto 0    
                          
     rom[19] = {5'h18, 16'h1039, S0_DIGITAL_FILT[6], S0_DIGITAL_FILT[7], S0_DIGITAL_FILT[0], 1'b0, //bits 15 downto 12
                          S0_DIGITAL_FILT[2], S0_DIGITAL_FILT[1], S0_DIGITAL_FILT[3], S0_DIGITAL_FILT[9], //bits 11 downto 8
                          S0_DIGITAL_FILT[8], S0_LOCK[26], 3'h0, S0_LOCK[19], S0_LOCK[18], 1'b0}; //bits 7 downto 0                       
                          
     rom[20] = {5'h19, 16'h0000, S0_LOCK[24], S0_LOCK[25], S0_LOCK[21], S0_LOCK[14], S0_LOCK[11], //bits 15 downto 11
                          S0_LOCK[12], S0_LOCK[20], S0_LOCK[6], S0_LOCK[35], S0_LOCK[36], //bits 10 downto 6
                          S0_LOCK[37], S0_LOCK[3], S0_LOCK[33], S0_LOCK[31], S0_LOCK[34], S0_LOCK[30]}; //bits 5 downto 0
                          
     rom[21] = {5'h1A, 16'hFFFC, 14'h0000, S0_LOCK[28], S0_LOCK[29]};  //bits 15 downto 0
     
     rom[22] = {5'h1D, 16'h2FFF, S0_LOCK[7], S0_LOCK[4], 1'b0, S0_LOCK[5], 12'h000};   //bits 15 downto 0

      //***********************************************************************
      // State 1 Initialization
      //***********************************************************************
      
     rom[23] = {5'h05, 16'h50FF,  S1_CLKOUT0[19], 1'b0, S1_CLKOUT0[18], 1'b0,//bits 15 down to 12
                                 S1_CLKOUT0[16], S1_CLKOUT0[17], S1_CLKOUT0[15], S1_CLKOUT0[14], 8'h00};//bits 11 downto 0
                         
     rom[24] = {5'h06, 16'h010B,  S1_CLKOUT1[4], S1_CLKOUT1[5], S1_CLKOUT1[3], S1_CLKOUT1[12], //bits 15 down to 12
                                 S1_CLKOUT1[1], S1_CLKOUT1[2], S1_CLKOUT1[19], 1'b0, S1_CLKOUT1[17], S1_CLKOUT1[16], //bits 11 down to 6
                          S1_CLKOUT1[14], S1_CLKOUT1[15], 1'b0, S1_CLKOUT0[13], 2'b00}; //bits 5 down to 0
                         
     rom[25] = {5'h07, 16'hE02C,  3'b000, S1_CLKOUT1[11], S1_CLKOUT1[9], S1_CLKOUT1[10], //bits 15 down to 10
                                 S1_CLKOUT1[8], S1_CLKOUT1[7], S1_CLKOUT1[6], S1_CLKOUT1[20], 1'b0, S1_CLKOUT1[13], //bits 9 down to 4 
                          2'b00, S1_CLKOUT1[21], S1_CLKOUT1[22]}; //bits 3 down to 0
                         
     rom[26] = {5'h08, 16'h4001,  S1_CLKOUT2[22], 1'b0, S1_CLKOUT2[5], S1_CLKOUT2[21], //bits 15 downto 12
                                 S1_CLKOUT2[12], S1_CLKOUT2[4], S1_CLKOUT2[3], S1_CLKOUT2[2], S1_CLKOUT2[0], S1_CLKOUT2[19], //bits 11 down to 6
                          S1_CLKOUT2[17], S1_CLKOUT2[18], S1_CLKOUT2[15], S1_CLKOUT2[16], S1_CLKOUT2[14], 1'b0}; //bits 5 down to 0
                         
     rom[27] = {5'h09, 16'h0D03,  S1_CLKOUT3[14], S1_CLKOUT3[15], S1_CLKOUT0[21], S1_CLKOUT0[22], 2'b00, S1_CLKOUT2[10], 1'b0, //bits 15 downto 8
                                 S1_CLKOUT2[9], S1_CLKOUT2[8], S1_CLKOUT2[6], S1_CLKOUT2[7], S1_CLKOUT2[13], S1_CLKOUT2[20], 2'b00}; //bits 7 downto 0
                         
     rom[28] = {5'h0A, 16'hB001,  1'b0, S1_CLKOUT3[13], 2'b00, S1_CLKOUT3[21], S1_CLKOUT3[22], S1_CLKOUT3[5], S1_CLKOUT3[4], //bits 15 downto 8
                                 S1_CLKOUT3[12], S1_CLKOUT3[2], S1_CLKOUT3[0], S1_CLKOUT3[1], S1_CLKOUT3[18], S1_CLKOUT3[19], //bits 7 downto 2
                          S1_CLKOUT3[17], 1'b0}; //bits 1 downto 0
                          
     rom[29] = {5'h0B, 16'h0110,  S1_CLKOUT0[5], S1_CLKOUT4[19], S1_CLKOUT4[14], S1_CLKOUT4[17], //bits 15 downto 12
                                 S1_CLKOUT4[15], S1_CLKOUT4[16], S1_CLKOUT0[4], 1'b0, S1_CLKOUT3[11], S1_CLKOUT3[10], //bits 11 downto 6 
                          S1_CLKOUT3[9], 1'b0, S1_CLKOUT3[7], S1_CLKOUT3[8], S1_CLKOUT3[20], S1_CLKOUT3[6]}; //bits 5 downto 0
                         
     rom[30] = {5'h0C, 16'h0B00,  S1_CLKOUT4[7], S1_CLKOUT4[8], S1_CLKOUT4[20], S1_CLKOUT4[6], 1'b0, S1_CLKOUT4[13], //bits 15 downto 10
                                 2'b00, S1_CLKOUT4[22], S1_CLKOUT4[21], S1_CLKOUT4[4], S1_CLKOUT4[5], S1_CLKOUT4[3], //bits 9 downto 3
                          S1_CLKOUT4[12], S1_CLKOUT4[1], S1_CLKOUT4[2]}; //bits 2 downto 0
                         
     rom[31] = {5'h0D, 16'h0008,  S1_CLKOUT5[2], S1_CLKOUT5[3], S1_CLKOUT5[0], S1_CLKOUT5[1], S1_CLKOUT5[18], //bits 15 downto 11
                          S1_CLKOUT5[19], S1_CLKOUT5[17], S1_CLKOUT5[16], S1_CLKOUT5[15], S1_CLKOUT0[3], //bits 10 downto 6
                          S1_CLKOUT0[0], S1_CLKOUT0[2], 1'b0, S1_CLKOUT4[11], S1_CLKOUT4[9], S1_CLKOUT4[10]}; //bits 5 downto 0
                         
     rom[32] = {5'h0E, 16'h00D0,  S1_CLKOUT5[10], S1_CLKOUT5[11], S1_CLKOUT5[8], S1_CLKOUT5[9], S1_CLKOUT5[6], //bits 15 downto 11
                          S1_CLKOUT5[7], S1_CLKOUT5[20], S1_CLKOUT5[13], 2'b00, S1_CLKOUT5[22], 1'b0, //bits 10 downto 4
                          S1_CLKOUT5[5], S1_CLKOUT5[21], S1_CLKOUT5[12], S1_CLKOUT5[4]}; //bits 3 downto 0
                         
     rom[33] = {5'h0F, 16'h0003, S1_CLKFBOUT[4], S1_CLKFBOUT[5], S1_CLKFBOUT[3], S1_CLKFBOUT[12], S1_CLKFBOUT[1], //bits 15 downto 11
                                 S1_CLKFBOUT[2], S1_CLKFBOUT[0], S1_CLKFBOUT[19], S1_CLKFBOUT[18], S1_CLKFBOUT[17], //bits 10 downto 6
                          S1_CLKFBOUT[15], S1_CLKFBOUT[16], S1_CLKOUT0[12], S1_CLKOUT0[1], 2'b00}; //bits 5 downto 0
                          
     rom[34] = {5'h10, 16'h800C, 1'b0, S1_CLKOUT0[9], S1_CLKOUT0[11], S1_CLKOUT0[10], S1_CLKFBOUT[10], S1_CLKFBOUT[11], //bits 15 downto 10
                          S1_CLKFBOUT[9], S1_CLKFBOUT[8], S1_CLKFBOUT[7], S1_CLKFBOUT[6], S1_CLKFBOUT[13],  //bits 9 downto 5
                          S1_CLKFBOUT[20], 2'b00, S1_CLKFBOUT[21], S1_CLKFBOUT[22]}; //bits 4 downto 0
                              
     rom[35] = {5'h11, 16'hFC00, 6'h00, S1_CLKOUT3[3], S1_CLKOUT3[16], S1_CLKOUT2[11], S1_CLKOUT2[1], S1_CLKOUT1[18], //bits 15 downto 6
                          S1_CLKOUT1[0], S1_CLKOUT0[6], S1_CLKOUT0[20], S1_CLKOUT0[8], S1_CLKOUT0[7]}; //bits 5 downto 0
                          
     rom[36] = {5'h12, 16'hF0FF, 4'h0, S1_CLKOUT5[14], S1_CLKFBOUT[14], S1_CLKOUT4[0], S1_CLKOUT4[18],  8'h00};  //bits 15 downto 0
                          
     rom[37] = {5'h13, 16'h5120, S1_DIVCLK[11], 1'b0, S1_DIVCLK[10], 1'b0, S1_DIVCLK[7], S1_DIVCLK[8],  //bits 15 downto 10
                                 S1_DIVCLK[0], 1'b0, S1_DIVCLK[5], S1_DIVCLK[2], 1'b0, S1_DIVCLK[13], 4'h0};  //bits 9 downto 0
                          
     rom[38] = {5'h14, 16'h2FFF, S1_LOCK[1], S1_LOCK[2], 1'b0, S1_LOCK[0], 12'h000}; //bits 15 downto 0
                          
     rom[39] = {5'h15, 16'hBFF4, 1'b0, S1_DIVCLK[12], 10'h000, S1_LOCK[38], 1'b0, S1_LOCK[32], S1_LOCK[39]}; //bits 15 downto 0                         
                          
     rom[40] = {5'h16, 16'h0A55, S1_LOCK[15], S1_LOCK[13], S1_LOCK[27], S1_LOCK[16], 1'b0, S1_LOCK[10],   //bits 15 downto 10
                                 1'b0, S1_DIVCLK[9], S1_DIVCLK[1], 1'b0, S1_DIVCLK[6], 1'b0, S1_DIVCLK[3],  //bits 9 downto 3
                          1'b0, S1_DIVCLK[4], 1'b0};  //bits 2 downto 0
     
     rom[41] = {5'h17, 16'hFFD0, 10'h000, S1_LOCK[17], 1'b0, S1_LOCK[8], S1_LOCK[9], S1_LOCK[23], S1_LOCK[22]}; //bits 15 downto 0    
                          
     rom[42] = {5'h18, 16'h1039, S1_DIGITAL_FILT[6], S1_DIGITAL_FILT[7], S1_DIGITAL_FILT[0], 1'b0, //bits 15 downto 12
                          S1_DIGITAL_FILT[2], S1_DIGITAL_FILT[1], S1_DIGITAL_FILT[3], S1_DIGITAL_FILT[9], //bits 11 downto 8
                          S1_DIGITAL_FILT[8], S1_LOCK[26], 3'h0, S1_LOCK[19], S1_LOCK[18], 1'b0}; //bits 7 downto 0                       
                          
     rom[43] = {5'h19, 16'h0000, S1_LOCK[24], S1_LOCK[25], S1_LOCK[21], S1_LOCK[14], S1_LOCK[11], //bits 15 downto 11
                          S1_LOCK[12], S1_LOCK[20], S1_LOCK[6], S1_LOCK[35], S1_LOCK[36], //bits 10 downto 6
                          S1_LOCK[37], S1_LOCK[3], S1_LOCK[33], S1_LOCK[31], S1_LOCK[34], S1_LOCK[30]}; //bits 5 downto 0
                          
     rom[44] = {5'h1A, 16'hFFFC, 14'h0000, S1_LOCK[28], S1_LOCK[29]};  //bits 15 downto 0
     
     rom[45] = {5'h1D, 16'h2FFF, S1_LOCK[7], S1_LOCK[4], 1'b0, S1_LOCK[5], 12'h000};   //bits 15 downto 0
     
      //***********************************************************************
      // State 2 Initialization
      //***********************************************************************
      
      rom[46] = {5'h05, 16'h50FF,  S2_CLKOUT0[19], 1'b0, S2_CLKOUT0[18], 1'b0,//bits 15 down to 12
                                 S2_CLKOUT0[16], S2_CLKOUT0[17], S2_CLKOUT0[15], S2_CLKOUT0[14], 8'h00};//bits 11 downto 0
                         
     rom[47] = {5'h06, 16'h010B,  S2_CLKOUT1[4], S2_CLKOUT1[5], S2_CLKOUT1[3], S2_CLKOUT1[12], //bits 15 down to 12
                                 S2_CLKOUT1[1], S2_CLKOUT1[2], S2_CLKOUT1[19], 1'b0, S2_CLKOUT1[17], S2_CLKOUT1[16], //bits 11 down to 6
                          S2_CLKOUT1[14], S2_CLKOUT1[15], 1'b0, S2_CLKOUT0[13], 2'h0}; //bits 5 down to 0
                         
     rom[48] = {5'h07, 16'hE02C,  3'h0, S2_CLKOUT1[11], S2_CLKOUT1[9], S2_CLKOUT1[10], //bits 15 down to 10
                                 S2_CLKOUT1[8], S2_CLKOUT1[7], S2_CLKOUT1[6], S2_CLKOUT1[20], 1'b0, S2_CLKOUT1[13], //bits 9 down to 4 
                          2'b00, S2_CLKOUT1[21], S2_CLKOUT1[22]}; //bits 3 down to 0
                         
     rom[49] = {5'h08, 16'h4001,  S2_CLKOUT2[22], 1'b0, S2_CLKOUT2[5], S2_CLKOUT2[21], //bits 15 downto 12
                                 S2_CLKOUT2[12], S2_CLKOUT2[4], S2_CLKOUT2[3], S2_CLKOUT2[2], S2_CLKOUT2[0], S2_CLKOUT2[19], //bits 11 down to 6
                          S2_CLKOUT2[17], S2_CLKOUT2[18], S2_CLKOUT2[15], S2_CLKOUT2[16], S2_CLKOUT2[14], 1'b0}; //bits 5 down to 0
                         
     rom[50] = {5'h09, 16'h0D03,  S2_CLKOUT3[14], S2_CLKOUT3[15], S2_CLKOUT0[21], S2_CLKOUT0[22], 2'h0, S2_CLKOUT2[10], 1'b0, //bits 15 downto 8
                                 S2_CLKOUT2[9], S2_CLKOUT2[8], S2_CLKOUT2[6], S2_CLKOUT2[7], S2_CLKOUT2[13], S2_CLKOUT2[20], 2'h0}; //bits 7 downto 0
                         
     rom[51] = {5'h0A, 16'hB001,  1'b0, S2_CLKOUT3[13], 2'h0, S2_CLKOUT3[21], S2_CLKOUT3[22], S2_CLKOUT3[5], S2_CLKOUT3[4], //bits 15 downto 8
                                 S2_CLKOUT3[12], S2_CLKOUT3[2], S2_CLKOUT3[0], S2_CLKOUT3[1], S2_CLKOUT3[18], S2_CLKOUT3[19], //bits 7 downto 2
                          S2_CLKOUT3[17], 1'b0}; //bits 1 downto 0
                          
     rom[52] = {5'h0B, 16'h0110,  S2_CLKOUT0[5], S2_CLKOUT4[19], S2_CLKOUT4[14], S2_CLKOUT4[17], //bits 15 downto 12
                                 S2_CLKOUT4[15], S2_CLKOUT4[16], S2_CLKOUT0[4], 1'b0, S2_CLKOUT3[11], S2_CLKOUT3[10], //bits 11 downto 6 
                          S2_CLKOUT3[9], 1'b0, S2_CLKOUT3[7], S2_CLKOUT3[8], S2_CLKOUT3[20], S2_CLKOUT3[6]}; //bits 5 downto 0
                         
     rom[53] = {5'h0C, 16'h0B00,  S2_CLKOUT4[7], S2_CLKOUT4[8], S2_CLKOUT4[20], S2_CLKOUT4[6], 1'b0, S2_CLKOUT4[13], //bits 15 downto 10
                                 2'h0, S2_CLKOUT4[22], S2_CLKOUT4[21], S2_CLKOUT4[4], S2_CLKOUT4[5], S2_CLKOUT4[3], //bits 9 downto 3
                          S2_CLKOUT4[12], S2_CLKOUT4[1], S2_CLKOUT4[2]}; //bits 2 downto 0
                         
     rom[54] = {5'h0D, 16'h0008,  S2_CLKOUT5[2], S2_CLKOUT5[3], S2_CLKOUT5[0], S2_CLKOUT5[1], S2_CLKOUT5[18], //bits 15 downto 11
                          S2_CLKOUT5[19], S2_CLKOUT5[17], S2_CLKOUT5[16], S2_CLKOUT5[15], S2_CLKOUT0[3], //bits 10 downto 6
                          S2_CLKOUT0[0], S2_CLKOUT0[2], 1'b0, S2_CLKOUT4[11], S2_CLKOUT4[9], S2_CLKOUT4[10]}; //bits 5 downto 0
                         
     rom[55] = {5'h0E, 16'h00D0,  S2_CLKOUT5[10], S2_CLKOUT5[11], S2_CLKOUT5[8], S2_CLKOUT5[9], S2_CLKOUT5[6], //bits 15 downto 11
                          S2_CLKOUT5[7], S2_CLKOUT5[20], S2_CLKOUT5[13], 2'h0, S2_CLKOUT5[22], 1'b0, //bits 10 downto 4
                          S2_CLKOUT5[5], S2_CLKOUT5[21], S2_CLKOUT5[12], S2_CLKOUT5[4]}; //bits 3 downto 0
                         
     rom[56] = {5'h0F, 16'h0003, S2_CLKFBOUT[4], S2_CLKFBOUT[5], S2_CLKFBOUT[3], S2_CLKFBOUT[12], S2_CLKFBOUT[1], //bits 15 downto 11
                                 S2_CLKFBOUT[2], S2_CLKFBOUT[0], S2_CLKFBOUT[19], S2_CLKFBOUT[18], S2_CLKFBOUT[17], //bits 10 downto 6
                          S2_CLKFBOUT[15], S2_CLKFBOUT[16], S2_CLKOUT0[12], S2_CLKOUT0[1], 2'b00}; //bits 5 downto 0
                          
     rom[57] = {5'h10, 16'h800C, 1'b0, S2_CLKOUT0[9], S2_CLKOUT0[11], S2_CLKOUT0[10], S2_CLKFBOUT[10], S2_CLKFBOUT[11], //bits 15 downto 10
                          S2_CLKFBOUT[9], S2_CLKFBOUT[8], S2_CLKFBOUT[7], S2_CLKFBOUT[6], S2_CLKFBOUT[13],  //bits 9 downto 5
                          S2_CLKFBOUT[20], 2'h0, S2_CLKFBOUT[21], S2_CLKFBOUT[22]}; //bits 4 downto 0
                              
     rom[58] = {5'h11, 16'hFC00, 6'h00, S2_CLKOUT3[3], S2_CLKOUT3[16], S2_CLKOUT2[11], S2_CLKOUT2[1], S2_CLKOUT1[18], //bits 15 downto 6
                          S2_CLKOUT1[0], S2_CLKOUT0[6], S2_CLKOUT0[20], S2_CLKOUT0[8], S2_CLKOUT0[7]}; //bits 5 downto 0
                          
     rom[59] = {5'h12, 16'hF0FF, 4'h0, S2_CLKOUT5[14], S2_CLKFBOUT[14], S2_CLKOUT4[0], S2_CLKOUT4[18],  8'h00};  //bits 15 downto 0
                          
     rom[60] = {5'h13, 16'h5120, S2_DIVCLK[11], 1'b0, S2_DIVCLK[10], 1'b0, S2_DIVCLK[7], S2_DIVCLK[8],  //bits 15 downto 10
                                 S2_DIVCLK[0], 1'b0, S2_DIVCLK[5], S2_DIVCLK[2], 1'b0, S2_DIVCLK[13], 4'h0};  //bits 9 downto 0
                          
     rom[61] = {5'h14, 16'h2FFF, S2_LOCK[1], S2_LOCK[2], 1'b0, S2_LOCK[0], 12'h000}; //bits 15 downto 0
                          
     rom[62] = {5'h15, 16'hBFF4, 1'b0, S2_DIVCLK[12], 10'h000, S2_LOCK[38], 1'b0, S2_LOCK[32], S2_LOCK[39]}; //bits 15 downto 0                         
                          
     rom[63] = {5'h16, 16'h0A55, S2_LOCK[15], S2_LOCK[13], S2_LOCK[27], S2_LOCK[16], 1'b0, S2_LOCK[10],   //bits 15 downto 10
                                 1'b0, S2_DIVCLK[9], S2_DIVCLK[1], 1'b0, S2_DIVCLK[6], 1'b0, S2_DIVCLK[3],  //bits 9 downto 3
                          1'b0, S2_DIVCLK[4], 1'b0};  //bits 2 downto 0
     
     rom[64] = {5'h17, 16'hFFD0, 10'h000, S2_LOCK[17], 1'b0, S2_LOCK[8], S2_LOCK[9], S2_LOCK[23], S2_LOCK[22]}; //bits 15 downto 0    
                          
     rom[65] = {5'h18, 16'h1039, S2_DIGITAL_FILT[6], S2_DIGITAL_FILT[7], S2_DIGITAL_FILT[0], 1'b0, //bits 15 downto 12
                          S2_DIGITAL_FILT[2], S2_DIGITAL_FILT[1], S2_DIGITAL_FILT[3], S2_DIGITAL_FILT[9], //bits 11 downto 8
                          S2_DIGITAL_FILT[8], S2_LOCK[26], 3'h0, S2_LOCK[19], S2_LOCK[18], 1'b0}; //bits 7 downto 0                       
                          
     rom[66] = {5'h19, 16'h0000, S2_LOCK[24], S2_LOCK[25], S2_LOCK[21], S2_LOCK[14], S2_LOCK[11], //bits 15 downto 11
                          S2_LOCK[12], S2_LOCK[20], S2_LOCK[6], S2_LOCK[35], S2_LOCK[36], //bits 10 downto 6
                          S2_LOCK[37], S2_LOCK[3], S2_LOCK[33], S2_LOCK[31], S2_LOCK[34], S2_LOCK[30]}; //bits 5 downto 0
                          
     rom[67] = {5'h1A, 16'hFFFC, 14'h0000, S2_LOCK[28], S2_LOCK[29]};  //bits 15 downto 0
     
     rom[68] = {5'h1D, 16'h2FFF, S2_LOCK[7], S2_LOCK[4], 1'b0, S2_LOCK[5], 12'h000};   //bits 15 downto 0
     
      //***********************************************************************
      // State 3 Initialization
      //***********************************************************************
      
      rom[69] = {5'h05, 16'h50FF,  S3_CLKOUT0[19], 1'b0, S3_CLKOUT0[18], 1'b0,//bits 15 down to 12
                                 S3_CLKOUT0[16], S3_CLKOUT0[17], S3_CLKOUT0[15], S3_CLKOUT0[14], 8'h00};//bits 11 downto 0
                         
     rom[70] = {5'h06, 16'h010B,  S3_CLKOUT1[4], S3_CLKOUT1[5], S3_CLKOUT1[3], S3_CLKOUT1[12], //bits 15 down to 12
                                 S3_CLKOUT1[1], S3_CLKOUT1[2], S3_CLKOUT1[19], 1'b0, S3_CLKOUT1[17], S3_CLKOUT1[16], //bits 11 down to 6
                          S3_CLKOUT1[14], S3_CLKOUT1[15], 1'b0, S3_CLKOUT0[13], 2'h0}; //bits 5 down to 0
                         
     rom[71] = {5'h07, 16'hE02C,  3'h0, S3_CLKOUT1[11], S3_CLKOUT1[9], S3_CLKOUT1[10], //bits 15 down to 10
                                 S3_CLKOUT1[8], S3_CLKOUT1[7], S3_CLKOUT1[6], S3_CLKOUT1[20], 1'b0, S3_CLKOUT1[13], //bits 9 down to 4 
                          2'b00, S3_CLKOUT1[21], S3_CLKOUT1[22]}; //bits 3 down to 0
                         
     rom[72] = {5'h08, 16'h4001,  S3_CLKOUT2[22], 1'b0, S3_CLKOUT2[5], S3_CLKOUT2[21], //bits 15 downto 12
                                 S3_CLKOUT2[12], S3_CLKOUT2[4], S3_CLKOUT2[3], S3_CLKOUT2[2], S3_CLKOUT2[0], S3_CLKOUT2[19], //bits 11 down to 6
                          S3_CLKOUT2[17], S3_CLKOUT2[18], S3_CLKOUT2[15], S3_CLKOUT2[16], S3_CLKOUT2[14], 1'b0}; //bits 5 down to 0
                         
     rom[73] = {5'h09, 16'h0D03,  S3_CLKOUT3[14], S3_CLKOUT3[15], S3_CLKOUT0[21], S3_CLKOUT0[22], 2'h0, S3_CLKOUT2[10], 1'b0, //bits 15 downto 8
                                 S3_CLKOUT2[9], S3_CLKOUT2[8], S3_CLKOUT2[6], S3_CLKOUT2[7], S3_CLKOUT2[13], S3_CLKOUT2[20], 2'h0}; //bits 7 downto 0
                         
     rom[74] = {5'h0A, 16'hB001,  1'b0, S3_CLKOUT3[13], 2'h0, S3_CLKOUT3[21], S3_CLKOUT3[22], S3_CLKOUT3[5], S3_CLKOUT3[4], //bits 15 downto 8
                                 S3_CLKOUT3[12], S3_CLKOUT3[2], S3_CLKOUT3[0], S3_CLKOUT3[1], S3_CLKOUT3[18], S3_CLKOUT3[19], //bits 7 downto 2
                          S3_CLKOUT3[17], 1'b0}; //bits 1 downto 0
                          
     rom[75] = {5'h0B, 16'h0110,  S3_CLKOUT0[5], S3_CLKOUT4[19], S3_CLKOUT4[14], S3_CLKOUT4[17], //bits 15 downto 12
                                 S3_CLKOUT4[15], S3_CLKOUT4[16], S3_CLKOUT0[4], 1'b0, S3_CLKOUT3[11], S3_CLKOUT3[10], //bits 11 downto 6 
                          S3_CLKOUT3[9], 1'b0, S3_CLKOUT3[7], S3_CLKOUT3[8], S3_CLKOUT3[20], S3_CLKOUT3[6]}; //bits 5 downto 0
                         
     rom[76] = {5'h0C, 16'h0B00,  S3_CLKOUT4[7], S3_CLKOUT4[8], S3_CLKOUT4[20], S3_CLKOUT4[6], 1'b0, S3_CLKOUT4[13], //bits 15 downto 10
                                 2'h0, S3_CLKOUT4[22], S3_CLKOUT4[21], S3_CLKOUT4[4], S3_CLKOUT4[5], S3_CLKOUT4[3], //bits 9 downto 3
                          S3_CLKOUT4[12], S3_CLKOUT4[1], S3_CLKOUT4[2]}; //bits 2 downto 0
                         
     rom[77] = {5'h0D, 16'h0008,  S3_CLKOUT5[2], S3_CLKOUT5[3], S3_CLKOUT5[0], S3_CLKOUT5[1], S3_CLKOUT5[18], //bits 15 downto 11
                          S3_CLKOUT5[19], S3_CLKOUT5[17], S3_CLKOUT5[16], S3_CLKOUT5[15], S3_CLKOUT0[3], //bits 10 downto 6
                          S3_CLKOUT0[0], S3_CLKOUT0[2], 1'b0, S3_CLKOUT4[11], S3_CLKOUT4[9], S3_CLKOUT4[10]}; //bits 5 downto 0
                         
     rom[78] = {5'h0E, 16'h00D0,  S3_CLKOUT5[10], S3_CLKOUT5[11], S3_CLKOUT5[8], S3_CLKOUT5[9], S3_CLKOUT5[6], //bits 15 downto 11
                          S3_CLKOUT5[7], S3_CLKOUT5[20], S3_CLKOUT5[13], 2'h0, S3_CLKOUT5[22], 1'b0, //bits 10 downto 4
                          S3_CLKOUT5[5], S3_CLKOUT5[21], S3_CLKOUT5[12], S3_CLKOUT5[4]}; //bits 3 downto 0
                         
     rom[79] = {5'h0F, 16'h0003, S3_CLKFBOUT[4], S3_CLKFBOUT[5], S3_CLKFBOUT[3], S3_CLKFBOUT[12], S3_CLKFBOUT[1], //bits 15 downto 11
                                 S3_CLKFBOUT[2], S3_CLKFBOUT[0], S3_CLKFBOUT[19], S3_CLKFBOUT[18], S3_CLKFBOUT[17], //bits 10 downto 6
                          S3_CLKFBOUT[15], S3_CLKFBOUT[16], S3_CLKOUT0[12], S3_CLKOUT0[1], 2'b00}; //bits 5 downto 0
                          
     rom[80] = {5'h10, 16'h800C, 1'b0, S3_CLKOUT0[9], S3_CLKOUT0[11], S3_CLKOUT0[10], S3_CLKFBOUT[10], S3_CLKFBOUT[11], //bits 15 downto 10
                          S3_CLKFBOUT[9], S3_CLKFBOUT[8], S3_CLKFBOUT[7], S3_CLKFBOUT[6], S3_CLKFBOUT[13],  //bits 9 downto 5
                          S3_CLKFBOUT[20], 2'h0, S3_CLKFBOUT[21], S3_CLKFBOUT[22]}; //bits 4 downto 0
                              
     rom[81] = {5'h11, 16'hFC00, 6'h00, S3_CLKOUT3[3], S3_CLKOUT3[16], S3_CLKOUT2[11], S3_CLKOUT2[1], S3_CLKOUT1[18], //bits 15 downto 6
                          S3_CLKOUT1[0], S3_CLKOUT0[6], S3_CLKOUT0[20], S3_CLKOUT0[8], S3_CLKOUT0[7]}; //bits 5 downto 0
                          
     rom[82] = {5'h12, 16'hF0FF, 4'h0, S3_CLKOUT5[14], S3_CLKFBOUT[14], S3_CLKOUT4[0], S3_CLKOUT4[18],  8'h00};  //bits 15 downto 0
                          
     rom[83] = {5'h13, 16'h5120, S3_DIVCLK[11], 1'b0, S3_DIVCLK[10], 1'b0, S3_DIVCLK[7], S3_DIVCLK[8],  //bits 15 downto 10
                                 S3_DIVCLK[0], 1'b0, S3_DIVCLK[5], S3_DIVCLK[2], 1'b0, S3_DIVCLK[13], 4'h0};  //bits 9 downto 0
                          
     rom[84] = {5'h14, 16'h2FFF, S3_LOCK[1], S3_LOCK[2], 1'b0, S3_LOCK[0], 12'h000}; //bits 15 downto 0
                          
     rom[85] = {5'h15, 16'hBFF4, 1'b0, S3_DIVCLK[12], 10'h000, S3_LOCK[38], 1'b0, S3_LOCK[32], S3_LOCK[39]}; //bits 15 downto 0                         
                          
     rom[86] = {5'h16, 16'h0A55, S3_LOCK[15], S3_LOCK[13], S3_LOCK[27], S3_LOCK[16], 1'b0, S3_LOCK[10],   //bits 15 downto 10
                                 1'b0, S3_DIVCLK[9], S3_DIVCLK[1], 1'b0, S3_DIVCLK[6], 1'b0, S3_DIVCLK[3],  //bits 9 downto 3
                          1'b0, S3_DIVCLK[4], 1'b0};  //bits 2 downto 0
     
     rom[87] = {5'h17, 16'hFFD0, 10'h000, S3_LOCK[17], 1'b0, S3_LOCK[8], S3_LOCK[9], S3_LOCK[23], S3_LOCK[22]}; //bits 15 downto 0    
                          
     rom[88] = {5'h18, 16'h1039, S3_DIGITAL_FILT[6], S3_DIGITAL_FILT[7], S3_DIGITAL_FILT[0], 1'b0, //bits 15 downto 12
                          S3_DIGITAL_FILT[2], S3_DIGITAL_FILT[1], S3_DIGITAL_FILT[3], S3_DIGITAL_FILT[9], //bits 11 downto 8
                          S3_DIGITAL_FILT[8], S3_LOCK[26], 3'h0, S3_LOCK[19], S3_LOCK[18], 1'b0}; //bits 7 downto 0                       
                          
     rom[89] = {5'h19, 16'h0000, S3_LOCK[24], S3_LOCK[25], S3_LOCK[21], S3_LOCK[14], S3_LOCK[11], //bits 15 downto 11
                          S3_LOCK[12], S3_LOCK[20], S3_LOCK[6], S3_LOCK[35], S3_LOCK[36], //bits 10 downto 6
                          S3_LOCK[37], S3_LOCK[3], S3_LOCK[33], S3_LOCK[31], S3_LOCK[34], S3_LOCK[30]}; //bits 5 downto 0
                          
     rom[90] = {5'h1A, 16'hFFFC, 14'h0000, S3_LOCK[28], S3_LOCK[29]};  //bits 15 downto 0
     
     rom[91] = {5'h1D, 16'h2FFF, S3_LOCK[7], S3_LOCK[4], 1'b0, S3_LOCK[5], 12'h000};   //bits 15 downto 0
     
      //***********************************************************************
      // State 4 Initialization
      //***********************************************************************
      
      rom[92] = {5'h05, 16'h50FF,  S4_CLKOUT0[19], 1'b0, S4_CLKOUT0[18], 1'b0,//bits 15 down to 12
                                 S4_CLKOUT0[16], S4_CLKOUT0[17], S4_CLKOUT0[15], S4_CLKOUT0[14], 8'h00};//bits 11 downto 0
                         
     rom[93] = {5'h06, 16'h010B,  S4_CLKOUT1[4], S4_CLKOUT1[5], S4_CLKOUT1[3], S4_CLKOUT1[12], //bits 15 down to 12
                                 S4_CLKOUT1[1], S4_CLKOUT1[2], S4_CLKOUT1[19], 1'b0, S4_CLKOUT1[17], S4_CLKOUT1[16], //bits 11 down to 6
                          S4_CLKOUT1[14], S4_CLKOUT1[15], 1'b0, S4_CLKOUT0[13], 2'h0}; //bits 5 down to 0
                         
     rom[94] = {5'h07, 16'hE02C,  3'h0, S4_CLKOUT1[11], S4_CLKOUT1[9], S4_CLKOUT1[10], //bits 15 down to 10
                                 S4_CLKOUT1[8], S4_CLKOUT1[7], S4_CLKOUT1[6], S4_CLKOUT1[20], 1'b0, S4_CLKOUT1[13], //bits 9 down to 4 
                          2'b00, S4_CLKOUT1[21], S4_CLKOUT1[22]}; //bits 3 down to 0
                         
     rom[95] = {5'h08, 16'h4001,  S4_CLKOUT2[22], 1'b0, S4_CLKOUT2[5], S4_CLKOUT2[21], //bits 15 downto 12
                                 S4_CLKOUT2[12], S4_CLKOUT2[4], S4_CLKOUT2[3], S4_CLKOUT2[2], S4_CLKOUT2[0], S4_CLKOUT2[19], //bits 11 down to 6
                          S4_CLKOUT2[17], S4_CLKOUT2[18], S4_CLKOUT2[15], S4_CLKOUT2[16], S4_CLKOUT2[14], 1'b0}; //bits 5 down to 0
                         
     rom[96] = {5'h09, 16'h0D03,  S4_CLKOUT3[14], S4_CLKOUT3[15], S4_CLKOUT0[21], S4_CLKOUT0[22], 2'h0, S4_CLKOUT2[10], 1'b0, //bits 15 downto 8
                                 S4_CLKOUT2[9], S4_CLKOUT2[8], S4_CLKOUT2[6], S4_CLKOUT2[7], S4_CLKOUT2[13], S4_CLKOUT2[20], 2'h0}; //bits 7 downto 0
                         
     rom[97] = {5'h0A, 16'hB001,  1'b0, S4_CLKOUT3[13], 2'h0, S4_CLKOUT3[21], S4_CLKOUT3[22], S4_CLKOUT3[5], S4_CLKOUT3[4], //bits 15 downto 8
                                 S4_CLKOUT3[12], S4_CLKOUT3[2], S4_CLKOUT3[0], S4_CLKOUT3[1], S4_CLKOUT3[18], S4_CLKOUT3[19], //bits 7 downto 2
                          S4_CLKOUT3[17], 1'b0}; //bits 1 downto 0
                          
     rom[98] = {5'h0B, 16'h0110,  S4_CLKOUT0[5], S4_CLKOUT4[19], S4_CLKOUT4[14], S4_CLKOUT4[17], //bits 15 downto 12
                                 S4_CLKOUT4[15], S4_CLKOUT4[16], S4_CLKOUT0[4], 1'b0, S4_CLKOUT3[11], S4_CLKOUT3[10], //bits 11 downto 6 
                          S4_CLKOUT3[9], 1'b0, S4_CLKOUT3[7], S4_CLKOUT3[8], S4_CLKOUT3[20], S4_CLKOUT3[6]}; //bits 5 downto 0
                         
     rom[99] = {5'h0C, 16'h0B00,  S4_CLKOUT4[7], S4_CLKOUT4[8], S4_CLKOUT4[20], S4_CLKOUT4[6], 1'b0, S4_CLKOUT4[13], //bits 15 downto 10
                                 2'h0, S4_CLKOUT4[22], S4_CLKOUT4[21], S4_CLKOUT4[4], S4_CLKOUT4[5], S4_CLKOUT4[3], //bits 9 downto 3
                          S4_CLKOUT4[12], S4_CLKOUT4[1], S4_CLKOUT4[2]}; //bits 2 downto 0
                         
     rom[100] = {5'h0D, 16'h0008,  S4_CLKOUT5[2], S4_CLKOUT5[3], S4_CLKOUT5[0], S4_CLKOUT5[1], S4_CLKOUT5[18], //bits 15 downto 11
                          S4_CLKOUT5[19], S4_CLKOUT5[17], S4_CLKOUT5[16], S4_CLKOUT5[15], S4_CLKOUT0[3], //bits 10 downto 6
                          S4_CLKOUT0[0], S4_CLKOUT0[2], 1'b0, S4_CLKOUT4[11], S4_CLKOUT4[9], S4_CLKOUT4[10]}; //bits 5 downto 0
                         
     rom[101] = {5'h0E, 16'h00D0,  S4_CLKOUT5[10], S4_CLKOUT5[11], S4_CLKOUT5[8], S4_CLKOUT5[9], S4_CLKOUT5[6], //bits 15 downto 11
                          S4_CLKOUT5[7], S4_CLKOUT5[20], S4_CLKOUT5[13], 2'h0, S4_CLKOUT5[22], 1'b0, //bits 10 downto 4
                          S4_CLKOUT5[5], S4_CLKOUT5[21], S4_CLKOUT5[12], S4_CLKOUT5[4]}; //bits 3 downto 0
                         
     rom[102] = {5'h0F, 16'h0003, S4_CLKFBOUT[4], S4_CLKFBOUT[5], S4_CLKFBOUT[3], S4_CLKFBOUT[12], S4_CLKFBOUT[1], //bits 15 downto 11
                                 S4_CLKFBOUT[2], S4_CLKFBOUT[0], S4_CLKFBOUT[19], S4_CLKFBOUT[18], S4_CLKFBOUT[17], //bits 10 downto 6
                          S4_CLKFBOUT[15], S4_CLKFBOUT[16], S4_CLKOUT0[12], S4_CLKOUT0[1], 2'b00}; //bits 5 downto 0
                          
     rom[103] = {5'h10, 16'h800C, 1'b0, S4_CLKOUT0[9], S4_CLKOUT0[11], S4_CLKOUT0[10], S4_CLKFBOUT[10], S4_CLKFBOUT[11], //bits 15 downto 10
                          S4_CLKFBOUT[9], S4_CLKFBOUT[8], S4_CLKFBOUT[7], S4_CLKFBOUT[6], S4_CLKFBOUT[13],  //bits 9 downto 5
                          S4_CLKFBOUT[20], 2'h0, S4_CLKFBOUT[21], S4_CLKFBOUT[22]}; //bits 4 downto 0
                              
     rom[104] = {5'h11, 16'hFC00, 6'h00, S4_CLKOUT3[3], S4_CLKOUT3[16], S4_CLKOUT2[11], S4_CLKOUT2[1], S4_CLKOUT1[18], //bits 15 downto 6
                          S4_CLKOUT1[0], S4_CLKOUT0[6], S4_CLKOUT0[20], S4_CLKOUT0[8], S4_CLKOUT0[7]}; //bits 5 downto 0
                          
     rom[105] = {5'h12, 16'hF0FF, 4'h0, S4_CLKOUT5[14], S4_CLKFBOUT[14], S4_CLKOUT4[0], S4_CLKOUT4[18],  8'h00};  //bits 15 downto 0
                          
     rom[106] = {5'h13, 16'h5120, S4_DIVCLK[11], 1'b0, S4_DIVCLK[10], 1'b0, S4_DIVCLK[7], S4_DIVCLK[8],  //bits 15 downto 10
                                 S4_DIVCLK[0], 1'b0, S4_DIVCLK[5], S4_DIVCLK[2], 1'b0, S4_DIVCLK[13], 4'h0};  //bits 9 downto 0
                          
     rom[107] = {5'h14, 16'h2FFF, S4_LOCK[1], S4_LOCK[2], 1'b0, S4_LOCK[0], 12'h000}; //bits 15 downto 0
                          
     rom[108] = {5'h15, 16'hBFF4, 1'b0, S4_DIVCLK[12], 10'h000, S4_LOCK[38], 1'b0, S4_LOCK[32], S4_LOCK[39]}; //bits 15 downto 0                         
                          
     rom[109] = {5'h16, 16'h0A55, S4_LOCK[15], S4_LOCK[13], S4_LOCK[27], S4_LOCK[16], 1'b0, S4_LOCK[10],   //bits 15 downto 10
                                 1'b0, S4_DIVCLK[9], S4_DIVCLK[1], 1'b0, S4_DIVCLK[6], 1'b0, S4_DIVCLK[3],  //bits 9 downto 3
                          1'b0, S4_DIVCLK[4], 1'b0};  //bits 2 downto 0
     
     rom[110] = {5'h17, 16'hFFD0, 10'h000, S4_LOCK[17], 1'b0, S4_LOCK[8], S4_LOCK[9], S4_LOCK[23], S4_LOCK[22]}; //bits 15 downto 0    
                          
     rom[111] = {5'h18, 16'h1039, S4_DIGITAL_FILT[6], S4_DIGITAL_FILT[7], S4_DIGITAL_FILT[0], 1'b0, //bits 15 downto 12
                          S4_DIGITAL_FILT[2], S4_DIGITAL_FILT[1], S4_DIGITAL_FILT[3], S4_DIGITAL_FILT[9], //bits 11 downto 8
                          S4_DIGITAL_FILT[8], S4_LOCK[26], 3'h0, S4_LOCK[19], S4_LOCK[18], 1'b0}; //bits 7 downto 0                       
                          
     rom[112] = {5'h19, 16'h0000, S4_LOCK[24], S4_LOCK[25], S4_LOCK[21], S4_LOCK[14], S4_LOCK[11], //bits 15 downto 11
                          S4_LOCK[12], S4_LOCK[20], S4_LOCK[6], S4_LOCK[35], S4_LOCK[36], //bits 10 downto 6
                          S4_LOCK[37], S4_LOCK[3], S4_LOCK[33], S4_LOCK[31], S4_LOCK[34], S4_LOCK[30]}; //bits 5 downto 0
                          
     rom[113] = {5'h1A, 16'hFFFC, 14'h0000, S4_LOCK[28], S4_LOCK[29]};  //bits 15 downto 0
     
     rom[114] = {5'h1D, 16'h2FFF, S4_LOCK[7], S4_LOCK[4], 1'b0, S4_LOCK[5], 12'h000};   //bits 15 downto 0
     
      //***********************************************************************
      // State 5 Initialization
      //***********************************************************************
      
      rom[115] = {5'h05, 16'h50FF,  S5_CLKOUT0[19], 1'b0, S5_CLKOUT0[18], 1'b0,//bits 15 down to 12
                                 S5_CLKOUT0[16], S5_CLKOUT0[17], S5_CLKOUT0[15], S5_CLKOUT0[14], 8'h00};//bits 11 downto 0
                         
     rom[116] = {5'h06, 16'h010B,  S5_CLKOUT1[4], S5_CLKOUT1[5], S5_CLKOUT1[3], S5_CLKOUT1[12], //bits 15 down to 12
                                 S5_CLKOUT1[1], S5_CLKOUT1[2], S5_CLKOUT1[19], 1'b0, S5_CLKOUT1[17], S5_CLKOUT1[16], //bits 11 down to 6
                          S5_CLKOUT1[14], S5_CLKOUT1[15], 1'b0, S5_CLKOUT0[13], 2'h0}; //bits 5 down to 0
                         
     rom[117] = {5'h07, 16'hE02C,  3'h0, S5_CLKOUT1[11], S5_CLKOUT1[9], S5_CLKOUT1[10], //bits 15 down to 10
                                 S5_CLKOUT1[8], S5_CLKOUT1[7], S5_CLKOUT1[6], S5_CLKOUT1[20], 1'b0, S5_CLKOUT1[13], //bits 9 down to 4 
                          2'b00, S5_CLKOUT1[21], S5_CLKOUT1[22]}; //bits 3 down to 0
                         
     rom[118] = {5'h08, 16'h4001,  S5_CLKOUT2[22], 1'b0, S5_CLKOUT2[5], S5_CLKOUT2[21], //bits 15 downto 12
                                 S5_CLKOUT2[12], S5_CLKOUT2[4], S5_CLKOUT2[3], S5_CLKOUT2[2], S5_CLKOUT2[0], S5_CLKOUT2[19], //bits 11 down to 6
                          S5_CLKOUT2[17], S5_CLKOUT2[18], S5_CLKOUT2[15], S5_CLKOUT2[16], S5_CLKOUT2[14], 1'b0}; //bits 5 down to 0
                         
     rom[119] = {5'h09, 16'h0D03,  S5_CLKOUT3[14], S5_CLKOUT3[15], S5_CLKOUT0[21], S5_CLKOUT0[22], 2'h0, S5_CLKOUT2[10], 1'b0, //bits 15 downto 8
                                 S5_CLKOUT2[9], S5_CLKOUT2[8], S5_CLKOUT2[6], S5_CLKOUT2[7], S5_CLKOUT2[13], S5_CLKOUT2[20], 2'h0}; //bits 7 downto 0
                         
     rom[120] = {5'h0A, 16'hB001,  1'b0, S5_CLKOUT3[13], 2'h0, S5_CLKOUT3[21], S5_CLKOUT3[22], S5_CLKOUT3[5], S5_CLKOUT3[4], //bits 15 downto 8
                                 S5_CLKOUT3[12], S5_CLKOUT3[2], S5_CLKOUT3[0], S5_CLKOUT3[1], S5_CLKOUT3[18], S5_CLKOUT3[19], //bits 7 downto 2
                          S5_CLKOUT3[17], 1'b0}; //bits 1 downto 0
                          
     rom[121] = {5'h0B, 16'h0110,  S5_CLKOUT0[5], S5_CLKOUT4[19], S5_CLKOUT4[14], S5_CLKOUT4[17], //bits 15 downto 12
                                 S5_CLKOUT4[15], S5_CLKOUT4[16], S5_CLKOUT0[4], 1'b0, S5_CLKOUT3[11], S5_CLKOUT3[10], //bits 11 downto 6 
                          S5_CLKOUT3[9], 1'b0, S5_CLKOUT3[7], S5_CLKOUT3[8], S5_CLKOUT3[20], S5_CLKOUT3[6]}; //bits 5 downto 0
                         
     rom[122] = {5'h0C, 16'h0B00,  S5_CLKOUT4[7], S5_CLKOUT4[8], S5_CLKOUT4[20], S5_CLKOUT4[6], 1'b0, S5_CLKOUT4[13], //bits 15 downto 10
                                 2'h0, S5_CLKOUT4[22], S5_CLKOUT4[21], S5_CLKOUT4[4], S5_CLKOUT4[5], S5_CLKOUT4[3], //bits 9 downto 3
                          S5_CLKOUT4[12], S5_CLKOUT4[1], S5_CLKOUT4[2]}; //bits 2 downto 0
                         
     rom[123] = {5'h0D, 16'h0008,  S5_CLKOUT5[2], S5_CLKOUT5[3], S5_CLKOUT5[0], S5_CLKOUT5[1], S5_CLKOUT5[18], //bits 15 downto 11
                          S5_CLKOUT5[19], S5_CLKOUT5[17], S5_CLKOUT5[16], S5_CLKOUT5[15], S5_CLKOUT0[3], //bits 10 downto 6
                          S5_CLKOUT0[0], S5_CLKOUT0[2], 1'b0, S5_CLKOUT4[11], S5_CLKOUT4[9], S5_CLKOUT4[10]}; //bits 5 downto 0
                         
     rom[124] = {5'h0E, 16'h00D0,  S5_CLKOUT5[10], S5_CLKOUT5[11], S5_CLKOUT5[8], S5_CLKOUT5[9], S5_CLKOUT5[6], //bits 15 downto 11
                          S5_CLKOUT5[7], S5_CLKOUT5[20], S5_CLKOUT5[13], 2'h0, S5_CLKOUT5[22], 1'b0, //bits 10 downto 4
                          S5_CLKOUT5[5], S5_CLKOUT5[21], S5_CLKOUT5[12], S5_CLKOUT5[4]}; //bits 3 downto 0
                         
     rom[125] = {5'h0F, 16'h0003, S5_CLKFBOUT[4], S5_CLKFBOUT[5], S5_CLKFBOUT[3], S5_CLKFBOUT[12], S5_CLKFBOUT[1], //bits 15 downto 11
                                 S5_CLKFBOUT[2], S5_CLKFBOUT[0], S5_CLKFBOUT[19], S5_CLKFBOUT[18], S5_CLKFBOUT[17], //bits 10 downto 6
                          S5_CLKFBOUT[15], S5_CLKFBOUT[16], S5_CLKOUT0[12], S5_CLKOUT0[1], 2'b00}; //bits 5 downto 0
                          
     rom[126] = {5'h10, 16'h800C, 1'b0, S5_CLKOUT0[9], S5_CLKOUT0[11], S5_CLKOUT0[10], S5_CLKFBOUT[10], S5_CLKFBOUT[11], //bits 15 downto 10
                          S5_CLKFBOUT[9], S5_CLKFBOUT[8], S5_CLKFBOUT[7], S5_CLKFBOUT[6], S5_CLKFBOUT[13],  //bits 9 downto 5
                          S5_CLKFBOUT[20], 2'h0, S5_CLKFBOUT[21], S5_CLKFBOUT[22]}; //bits 4 downto 0
                              
     rom[127] = {5'h11, 16'hFC00, 6'h00, S5_CLKOUT3[3], S5_CLKOUT3[16], S5_CLKOUT2[11], S5_CLKOUT2[1], S5_CLKOUT1[18], //bits 15 downto 6
                          S5_CLKOUT1[0], S5_CLKOUT0[6], S5_CLKOUT0[20], S5_CLKOUT0[8], S5_CLKOUT0[7]}; //bits 5 downto 0
                          
     rom[128] = {5'h12, 16'hF0FF, 4'h0, S5_CLKOUT5[14], S5_CLKFBOUT[14], S5_CLKOUT4[0], S5_CLKOUT4[18],  8'h00};  //bits 15 downto 0
                          
     rom[129] = {5'h13, 16'h5120, S5_DIVCLK[11], 1'b0, S5_DIVCLK[10], 1'b0, S5_DIVCLK[7], S5_DIVCLK[8],  //bits 15 downto 10
                                 S5_DIVCLK[0], 1'b0, S5_DIVCLK[5], S5_DIVCLK[2], 1'b0, S5_DIVCLK[13], 4'h0};  //bits 9 downto 0
                          
     rom[130] = {5'h14, 16'h2FFF, S5_LOCK[1], S5_LOCK[2], 1'b0, S5_LOCK[0], 12'h000}; //bits 15 downto 0
                          
     rom[131] = {5'h15, 16'hBFF4, 1'b0, S5_DIVCLK[12], 10'h000, S5_LOCK[38], 1'b0, S5_LOCK[32], S5_LOCK[39]}; //bits 15 downto 0                        
                          
     rom[132] = {5'h16, 16'h0A55, S5_LOCK[15], S5_LOCK[13], S5_LOCK[27], S5_LOCK[16], 1'b0, S5_LOCK[10],   //bits 15 downto 10
                                 1'b0, S5_DIVCLK[9], S5_DIVCLK[1], 1'b0, S5_DIVCLK[6], 1'b0, S5_DIVCLK[3],  //bits 9 downto 3
                          1'b0, S5_DIVCLK[4], 1'b0};  //bits 2 downto 0
     
     rom[133] = {5'h17, 16'hFFD0, 10'h000, S5_LOCK[17], 1'b0, S5_LOCK[8], S5_LOCK[9], S5_LOCK[23], S5_LOCK[22]}; //bits 15 downto 0   
                          
     rom[134] = {5'h18, 16'h1039, S5_DIGITAL_FILT[6], S5_DIGITAL_FILT[7], S5_DIGITAL_FILT[0], 1'b0, //bits 15 downto 12
                          S5_DIGITAL_FILT[2], S5_DIGITAL_FILT[1], S5_DIGITAL_FILT[3], S5_DIGITAL_FILT[9], //bits 11 downto 8
                          S5_DIGITAL_FILT[8], S5_LOCK[26], 3'h0, S5_LOCK[19], S5_LOCK[18], 1'b0}; //bits 7 downto 0                       
                          
     rom[135] = {5'h19, 16'h0000, S5_LOCK[24], S5_LOCK[25], S5_LOCK[21], S5_LOCK[14], S5_LOCK[11], //bits 15 downto 11
                          S5_LOCK[12], S5_LOCK[20], S5_LOCK[6], S5_LOCK[35], S5_LOCK[36], //bits 10 downto 6
                          S5_LOCK[37], S5_LOCK[3], S5_LOCK[33], S5_LOCK[31], S5_LOCK[34], S5_LOCK[30]}; //bits 5 downto 0
                          
     rom[136] = {5'h1A, 16'hFFFC, 14'h0000, S5_LOCK[28], S5_LOCK[29]};  //bits 15 downto 0
     
     rom[137] = {5'h1D, 16'h2FFF, S5_LOCK[7], S5_LOCK[4], 1'b0, S5_LOCK[5], 12'h000};  //bits 15 downto 0
     
      //***********************************************************************
      // State 6 Initialization
      //***********************************************************************
      
      rom[138] = {5'h05, 16'h50FF,  S6_CLKOUT0[19], 1'b0, S6_CLKOUT0[18], 1'b0,//bits 15 down to 12
                                 S6_CLKOUT0[16], S6_CLKOUT0[17], S6_CLKOUT0[15], S6_CLKOUT0[14], 8'h00};//bits 11 downto 0
                         
     rom[139] = {5'h06, 16'h010B,  S6_CLKOUT1[4], S6_CLKOUT1[5], S6_CLKOUT1[3], S6_CLKOUT1[12], //bits 15 down to 12
                                 S6_CLKOUT1[1], S6_CLKOUT1[2], S6_CLKOUT1[19], 1'b0, S6_CLKOUT1[17], S6_CLKOUT1[16], //bits 11 down to 6
                          S6_CLKOUT1[14], S6_CLKOUT1[15], 1'b0, S6_CLKOUT0[13], 2'h0}; //bits 5 down to 0
                         
     rom[140] = {5'h07, 16'hE02C,  3'h0, S6_CLKOUT1[11], S6_CLKOUT1[9], S6_CLKOUT1[10], //bits 15 down to 10
                                 S6_CLKOUT1[8], S6_CLKOUT1[7], S6_CLKOUT1[6], S6_CLKOUT1[20], 1'b0, S6_CLKOUT1[13], //bits 9 down to 4 
                          2'b00, S6_CLKOUT1[21], S6_CLKOUT1[22]}; //bits 3 down to 0
                         
     rom[141] = {5'h08, 16'h4001,  S6_CLKOUT2[22], 1'b0, S6_CLKOUT2[5], S6_CLKOUT2[21], //bits 15 downto 12
                                 S6_CLKOUT2[12], S6_CLKOUT2[4], S6_CLKOUT2[3], S6_CLKOUT2[2], S6_CLKOUT2[0], S6_CLKOUT2[19], //bits 11 down to 6
                          S6_CLKOUT2[17], S6_CLKOUT2[18], S6_CLKOUT2[15], S6_CLKOUT2[16], S6_CLKOUT2[14], 1'b0}; //bits 5 down to 0
                         
     rom[142] = {5'h09, 16'h0D03,  S6_CLKOUT3[14], S6_CLKOUT3[15], S6_CLKOUT0[21], S6_CLKOUT0[22], 2'h0, S6_CLKOUT2[10], 1'b0, //bits 15 downto 8
                                 S6_CLKOUT2[9], S6_CLKOUT2[8], S6_CLKOUT2[6], S6_CLKOUT2[7], S6_CLKOUT2[13], S6_CLKOUT2[20], 2'h0}; //bits 7 downto 0
                         
     rom[143] = {5'h0A, 16'hB001,  1'b0, S6_CLKOUT3[13], 2'h0, S6_CLKOUT3[21], S6_CLKOUT3[22], S6_CLKOUT3[5], S6_CLKOUT3[4], //bits 15 downto 8
                                 S6_CLKOUT3[12], S6_CLKOUT3[2], S6_CLKOUT3[0], S6_CLKOUT3[1], S6_CLKOUT3[18], S6_CLKOUT3[19], //bits 7 downto 2
                          S6_CLKOUT3[17], 1'b0}; //bits 1 downto 0
                          
     rom[144] = {5'h0B, 16'h0110,  S6_CLKOUT0[5], S6_CLKOUT4[19], S6_CLKOUT4[14], S6_CLKOUT4[17], //bits 15 downto 12
                                 S6_CLKOUT4[15], S6_CLKOUT4[16], S6_CLKOUT0[4], 1'b0, S6_CLKOUT3[11], S6_CLKOUT3[10], //bits 11 downto 6 
                          S6_CLKOUT3[9], 1'b0, S6_CLKOUT3[7], S6_CLKOUT3[8], S6_CLKOUT3[20], S6_CLKOUT3[6]}; //bits 5 downto 0
                         
     rom[145] = {5'h0C, 16'h0B00,  S6_CLKOUT4[7], S6_CLKOUT4[8], S6_CLKOUT4[20], S6_CLKOUT4[6], 1'b0, S6_CLKOUT4[13], //bits 15 downto 10
                                 2'h0, S6_CLKOUT4[22], S6_CLKOUT4[21], S6_CLKOUT4[4], S6_CLKOUT4[5], S6_CLKOUT4[3], //bits 9 downto 3
                          S6_CLKOUT4[12], S6_CLKOUT4[1], S6_CLKOUT4[2]}; //bits 2 downto 0
                         
     rom[146] = {5'h0D, 16'h0008,  S6_CLKOUT5[2], S6_CLKOUT5[3], S6_CLKOUT5[0], S6_CLKOUT5[1], S6_CLKOUT5[18], //bits 15 downto 11
                          S6_CLKOUT5[19], S6_CLKOUT5[17], S6_CLKOUT5[16], S6_CLKOUT5[15], S6_CLKOUT0[3], //bits 10 downto 6
                          S6_CLKOUT0[0], S6_CLKOUT0[2], 1'b0, S6_CLKOUT4[11], S6_CLKOUT4[9], S6_CLKOUT4[10]}; //bits 5 downto 0
                         
     rom[147] = {5'h0E, 16'h00D0,  S6_CLKOUT5[10], S6_CLKOUT5[11], S6_CLKOUT5[8], S6_CLKOUT5[9], S6_CLKOUT5[6], //bits 15 downto 11
                          S6_CLKOUT5[7], S6_CLKOUT5[20], S6_CLKOUT5[13], 2'h0, S6_CLKOUT5[22], 1'b0, //bits 10 downto 4
                          S6_CLKOUT5[5], S6_CLKOUT5[21], S6_CLKOUT5[12], S6_CLKOUT5[4]}; //bits 3 downto 0
                         
     rom[148] = {5'h0F, 16'h0003, S6_CLKFBOUT[4], S6_CLKFBOUT[5], S6_CLKFBOUT[3], S6_CLKFBOUT[12], S6_CLKFBOUT[1], //bits 15 downto 11
                                 S6_CLKFBOUT[2], S6_CLKFBOUT[0], S6_CLKFBOUT[19], S6_CLKFBOUT[18], S6_CLKFBOUT[17], //bits 10 downto 6
                          S6_CLKFBOUT[15], S6_CLKFBOUT[16], S6_CLKOUT0[12], S6_CLKOUT0[1], 2'b00}; //bits 5 downto 0
                          
     rom[149] = {5'h10, 16'h800C, 1'b0, S6_CLKOUT0[9], S6_CLKOUT0[11], S6_CLKOUT0[10], S6_CLKFBOUT[10], S6_CLKFBOUT[11], //bits 15 downto 10
                          S6_CLKFBOUT[9], S6_CLKFBOUT[8], S6_CLKFBOUT[7], S6_CLKFBOUT[6], S6_CLKFBOUT[13],  //bits 9 downto 5
                          S6_CLKFBOUT[20], 2'h0, S6_CLKFBOUT[21], S6_CLKFBOUT[22]}; //bits 4 downto 0
                              
     rom[150] = {5'h11, 16'hFC00, 6'h00, S6_CLKOUT3[3], S6_CLKOUT3[16], S6_CLKOUT2[11], S6_CLKOUT2[1], S6_CLKOUT1[18], //bits 15 downto 6
                          S6_CLKOUT1[0], S6_CLKOUT0[6], S6_CLKOUT0[20], S6_CLKOUT0[8], S6_CLKOUT0[7]}; //bits 5 downto 0
                          
     rom[151] = {5'h12, 16'hF0FF, 4'h0, S6_CLKOUT5[14], S6_CLKFBOUT[14], S6_CLKOUT4[0], S6_CLKOUT4[18],  8'h00};  //bits 15 downto 0
                          
     rom[152] = {5'h13, 16'h5120, S6_DIVCLK[11], 1'b0, S6_DIVCLK[10], 1'b0, S6_DIVCLK[7], S6_DIVCLK[8],  //bits 15 downto 10
                                 S6_DIVCLK[0], 1'b0, S6_DIVCLK[5], S6_DIVCLK[2], 1'b0, S6_DIVCLK[13], 4'h0};  //bits 9 downto 0
                          
     rom[153] = {5'h14, 16'h2FFF, S6_LOCK[1], S6_LOCK[2], 1'b0, S6_LOCK[0], 12'h000}; //bits 15 downto 0
                          
     rom[154] = {5'h15, 16'hBFF4, 1'b0, S6_DIVCLK[12], 10'h000, S6_LOCK[38], 1'b0, S6_LOCK[32], S6_LOCK[39]}; //bits 15 downto 0                        
                          
     rom[155] = {5'h16, 16'h0A55, S6_LOCK[15], S6_LOCK[13], S6_LOCK[27], S6_LOCK[16], 1'b0, S6_LOCK[10],   //bits 15 downto 10
                                 1'b0, S6_DIVCLK[9], S6_DIVCLK[1], 1'b0, S6_DIVCLK[6], 1'b0, S6_DIVCLK[3],  //bits 9 downto 3
                          1'b0, S6_DIVCLK[4], 1'b0};  //bits 2 downto 0
     
     rom[156] = {5'h17, 16'hFFD0, 10'h000, S6_LOCK[17], 1'b0, S6_LOCK[8], S6_LOCK[9], S6_LOCK[23], S6_LOCK[22]}; //bits 15 downto 0   
                          
     rom[157] = {5'h18, 16'h1039, S6_DIGITAL_FILT[6], S6_DIGITAL_FILT[7], S6_DIGITAL_FILT[0], 1'b0, //bits 15 downto 12
                          S6_DIGITAL_FILT[2], S6_DIGITAL_FILT[1], S6_DIGITAL_FILT[3], S6_DIGITAL_FILT[9], //bits 11 downto 8
                          S6_DIGITAL_FILT[8], S6_LOCK[26], 3'h0, S6_LOCK[19], S6_LOCK[18], 1'b0}; //bits 7 downto 0                       
                          
     rom[158] = {5'h19, 16'h0000, S6_LOCK[24], S6_LOCK[25], S6_LOCK[21], S6_LOCK[14], S6_LOCK[11], //bits 15 downto 11
                          S6_LOCK[12], S6_LOCK[20], S6_LOCK[6], S6_LOCK[35], S6_LOCK[36], //bits 10 downto 6
                          S6_LOCK[37], S6_LOCK[3], S6_LOCK[33], S6_LOCK[31], S6_LOCK[34], S6_LOCK[30]}; //bits 5 downto 0
                          
     rom[159] = {5'h1A, 16'hFFFC, 14'h0000, S6_LOCK[28], S6_LOCK[29]};  //bits 15 downto 0
     
     rom[160] = {5'h1D, 16'h2FFF, S6_LOCK[7], S6_LOCK[4], 1'b0, S6_LOCK[5], 12'h000};  //bits 15 downto 0
   end

   // Output the initialized rom value based on rom_addr each clock cycle
   
   always @(posedge SCLK) begin
      rom_do<= #TCQ rom[rom_addr];
   end
   
   //**************************************************************************
   // Everything below is associated whith the state machine that is used to
   // Read/Modify/Write to the PLL.
   //**************************************************************************

   // State sync
   reg [3:0]  current_state   = RESTART;
   reg [3:0]  next_state      = RESTART;
   
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
   
   // These variables are used to keep track of the number of iterations that 
   //    each state takes to reconfigure
   // STATE_COUNT_CONST is used to reset the counters and should match the
   //    number of registers necessary to reconfigure each state.
   localparam STATE_COUNT_CONST = 23;
   reg [4:0] state_count         = STATE_COUNT_CONST; 
   reg [4:0] next_state_count    = STATE_COUNT_CONST;
   
   // This block assigns the next register value from the state machine below
   always @(posedge SCLK) begin
      DADDR       <= #TCQ next_daddr;
      DWE         <= #TCQ next_dwe;
      DEN         <= #TCQ next_den;
      RST_PLL     <= #TCQ next_rst_pll;
      DI          <= #TCQ next_di;
      
      SRDY_N      <= #TCQ next_srdy_n;
      
      rom_addr    <= #TCQ next_rom_addr;
      state_count <= #TCQ next_state_count;
   end
   
   // This block assigns the next state, reset is syncronous.
   always @(posedge SCLK) begin
      if(RST) begin
         current_state <= #TCQ RESTART;
      end else begin
         current_state <= #TCQ next_state;
      end
   end

   always @* begin
      case(SADDR)
         3'd0    : start_addr = 8'h00;
         3'd1    : start_addr = STATE_COUNT_CONST * 1;
         3'd2    : start_addr = STATE_COUNT_CONST * 2;
         3'd3    : start_addr = STATE_COUNT_CONST * 3;
         3'd4    : start_addr = STATE_COUNT_CONST * 4;
         3'd5    : start_addr = STATE_COUNT_CONST * 5;
         3'd6    : start_addr = STATE_COUNT_CONST * 6;
         default : start_addr = 8'h00;
      endcase
   end

   always @* begin
      // Setup the default values
      next_srdy_n       = 1'b1;
      next_daddr        = DADDR;
      next_dwe          = 1'b0;
      next_den          = 1'b0;
      next_rst_pll      = RST_PLL;
      next_di           = DI;
      next_rom_addr     = rom_addr;
      next_state_count  = state_count;
   
      case (current_state)
         // If RST is asserted reset the machine
         RESTART: begin
            next_daddr     = 5'h00;
            next_di        = 16'h0000;
            next_rom_addr  = 8'h00;
            next_rst_pll   = 1'b1;
            next_state     = WAIT_LOCK;
         end
         
         // Waits for the PLL to assert LOCKED
         WAIT_LOCK: begin
            // Make sure reset is de-asserted
            next_rst_pll   = 1'b0;
            if(LOCKED) begin
               // PLL is locked, go on to wait for the SEN signal
               next_state  = WAIT_SEN;
            end else begin
               // Keep waiting, locked has not asserted yet
               next_state  = WAIT_LOCK;
            end
         end
         
         // Wait for the next SEN pulse and set the ROM addr appropriately 
         //    based on SADDR
         WAIT_SEN: begin
            next_rom_addr = start_addr;
            next_state_count = STATE_COUNT_CONST;
            next_srdy_n   = SEN;
            if(SEN) begin
               // Go on to address the PLL
               next_state = ADDRESS;
            end else begin
               // Keep waiting for SEN to be asserted
               next_state = WAIT_SEN;
            end
         end
         
         // Set the address on the PLL and assert DEN to read the value
         ADDRESS: begin
            // Reset the DCM through the reconfiguration
            next_rst_pll   = 1'b1;
            // Enable a read from the PLL and set the PLL address
            next_den       = 1'b1;
            next_daddr     = rom_do[36:32];
            
            // Wait for the data to be ready
            next_state     = WAIT_A_DRDY;
         end
         
         // Wait for DRDY to assert after addressing the PLL
         WAIT_A_DRDY: begin
            if(DRDY) begin
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
            // Go on to write the data to the PLL
            next_state        = WRITE;
         end
         
         // DI is setup so assert DWE, DEN, and RST_PLL.  Subtract one from the
         //    state count and go to wait for DRDY.
         WRITE: begin
            // Set WE and EN on PLL
            next_dwe          = 1'b1;
            next_den          = 1'b1;
            
            // Decrement the number of registers left to write
            next_state_count  = state_count - 1'b1;
            // Wait for the write to complete
            next_state        = WAIT_DRDY;
         end
         
         // Wait for DRDY to assert from the PLL.  If the state count is not 0
         //    jump to ADDRESS (continue reconfiguration).  If state count is
         //    0 wait for lock.
         WAIT_DRDY: begin
            if(DRDY) begin
               // Write is complete
               if(state_count > 0) begin
                  // If there are more registers to write keep going
                  next_state  = ADDRESS;
               end else begin
                  // There are no more registers to write so wait for the PLL
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