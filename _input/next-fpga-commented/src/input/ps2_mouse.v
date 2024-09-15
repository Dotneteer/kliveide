
// PS2 Mouse
// Copyright 2006, 2007 Dennis van Weeren
//
// This file is part of the ZX Spectrum Next Project
// <https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA/tree/master/cores>
//
// The ZX Spectrum Next FPGA source code is free software: you can 
// redistribute it and/or modify it under the terms of the GNU General 
// Public License as published by the Free Software Foundation, either 
// version 3 of the License, or (at your option) any later version.
//
// The ZX Spectrum Next FPGA source code is distributed in the hope 
// that it will be useful, but WITHOUT ANY WARRANTY; without even the 
// implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR 
// PURPOSE.  See the GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the ZX Spectrum Next FPGA source code.  If not, see 
// <https://www.gnu.org/licenses/>.
//
// Original:
//   https://github.com/rkrajnc/minimig-mist/blob/master/rtl/minimig/userio_ps2mouse.v

// Modifed for the zx next project by Alvin Albrecht
// * Add controls to adjust dpi and mouse button swap (operate on returned result)

//PS2 mouse controller.
//This module decodes the standard 3 byte packet of an PS/2 compatible 2 or 3 button mouse.
//The module also automatically handles power-up initailzation of the mouse.
module ps2_mouse
(
   input    clk,           //bus clock
   input    reset,               //reset 

   input ps2mdat_i,        //mouse PS/2 data
   input ps2mclk_i,        //mouse PS/2 clk
   
   output   ps2mdat_o,        //mouse PS/2 data
   output   ps2mclk_o,        //mouse PS/2 clk
   
   input [2:0] control_i,    // button reverse, dpi
   
//  input [5:0] mou_emu,
//  input sof,
  output  reg [7:0]zcount,  // mouse Z counter
   output   reg [7:0]ycount,  //mouse Y counter
   output   reg [7:0]xcount,  //mouse X counter
   output   reg mleft,        //left mouse button output
   output   reg mthird,    //third(middle) mouse button output
   output   reg mright     //right mouse button output
// input test_load,        //load test value to mouse counter
// input [15:0] test_data  //mouse counter test value
);

reg           mclkout;
wire          mdatout;
reg  [ 2-1:0] mdatr;
reg  [ 3-1:0] mclkr;

reg  [11-1:0] mreceive;
reg  [12-1:0] msend;
reg  [16-1:0] mtimer;
reg  [ 3-1:0] mstate;
reg  [ 3-1:0] mnext;

reg           mreverse;
reg  [1:0]    mdpi;

reg  [7:0]    xydelta;
reg  [2:0]    mbutton;

wire          mclkneg;
reg           mrreset;
wire          mrready;
reg           msreset;
wire          msready;
reg           mtreset;
wire          mtready;
wire          mthalf;
reg  [ 3-1:0] mpacket;
reg           intellimouse=0;
wire          mcmd_done;
reg  [ 4-1:0] mcmd_cnt=1;
reg           mcmd_inc=0;
reg  [12-1:0] mcmd;


// bidirectional open collector IO buffers
//assign ps2mdat_o = (mdatout) ? 1'b1 : 1'b0;
//assign ps2mclk_o = (mclkout) ? 1'b1 : 1'b0;

assign ps2mdat_o = mdatout;
assign ps2mclk_o = mclkout;


// input synchronization of external signals
always @ (posedge clk) begin
  mdatr[1:0] <= #1 {mdatr[0],   ps2mdat_i};
  mclkr[2:0] <= #1 {mclkr[1:0], ps2mclk_i};
end

// detect mouse clock negative edge
assign mclkneg = mclkr[2] & !mclkr[1];

// PS2 mouse input shifter
always @ (posedge clk) begin
  if (mrreset)
    mreceive[10:0] <= #1 11'b11111111111;
  else if (mclkneg)
    mreceive[10:0] <= #1 {mdatr[1],mreceive[10:1]};
end

assign mrready = !mreceive[0];

// PS2 mouse data counter
always @ (posedge clk) begin
  if (reset)
    mcmd_cnt <= #1 4'd0;
  else if (mcmd_inc && !mcmd_done)
    mcmd_cnt <= #1 mcmd_cnt + 4'd1;
end

assign mcmd_done = (mcmd_cnt == 4'd9);

// mouse init commands
always @ (*) begin
  case (mcmd_cnt)
    //                GUARD STOP  PARITY DATA   START
    4'h0    : mcmd = {1'b1, 1'b1, 1'b1,  8'hff, 1'b0}; // reset
    4'h1    : mcmd = {1'b1, 1'b1, 1'b1,  8'hf3, 1'b0}; // set sample rate
    4'h2    : mcmd = {1'b1, 1'b1, 1'b0,  8'hc8, 1'b0}; // sample rate = 200
    4'h3    : mcmd = {1'b1, 1'b1, 1'b1,  8'hf3, 1'b0}; // set sample rate
    4'h4    : mcmd = {1'b1, 1'b1, 1'b0,  8'h64, 1'b0}; // sample rate = 100
    4'h5    : mcmd = {1'b1, 1'b1, 1'b1,  8'hf3, 1'b0}; // set sample rate
    4'h6    : mcmd = {1'b1, 1'b1, 1'b1,  8'h50, 1'b0}; // sample rate = 80
    4'h7    : mcmd = {1'b1, 1'b1, 1'b0,  8'hf2, 1'b0}; // read device type
    4'h8    : mcmd = {1'b1, 1'b1, 1'b0,  8'hf4, 1'b0}; // enable data reporting
    default : mcmd = {1'b1, 1'b1, 1'b0,  8'hf4, 1'b0}; // enable data reporting
  endcase
end

// PS2 mouse send shifter
always @ (posedge clk) begin
  if (msreset)
    msend[11:0] <= #1 mcmd;
  else if (!msready && mclkneg)
    msend[11:0] <= #1 {1'b0,msend[11:1]};
end

assign msready = (msend[11:0]==12'b000000000001);
assign mdatout = msend[0];

// PS2 mouse timer
always @(posedge clk) begin
  if (mtreset)
    mtimer[15:0] <= #1 16'h0000;
  else
    mtimer[15:0] <= #1 mtimer[15:0] + 16'd1;
end

assign mtready = (mtimer[15:0]==16'hffff);
assign mthalf = mtimer[11];

always @ (posedge clk) begin
  mreverse <= #1 control_i[2];
  mdpi <= #1 control_i[1:0];
end

always @ (*) begin
  case(mdpi)
    2'b00   : xydelta = {mreceive[7:1],1'b0};
    2'b01   : xydelta = mreceive[8:1];
    2'b10   : xydelta = {mreceive[8],mreceive[8:2]};
    default : xydelta = {mreceive[8],mreceive[8],mreceive[8:3]};
  endcase
end

always @ (*) begin
  if (mreverse)
    mbutton = {mreceive[3],mreceive[1],mreceive[2]};
  else
    mbutton = {mreceive[3],mreceive[2],mreceive[1]};
end

// PS2 mouse packet decoding and handling
always @ (posedge clk) begin
  if (reset) begin
    {mthird,mright,mleft} <= #1 3'b000;
    xcount[7:0] <= #1 8'h00;
    ycount[7:0] <= #1 8'h00;
    zcount[7:0] <= #1 8'h00;
  end else begin
//    if (test_load) // test value preload
//      {ycount[7:2],xcount[7:2]} <= #1 {test_data[15:10],test_data[7:2]};
    if (mpacket == 3'd1) // buttons
        {mthird,mright,mleft} <= #1 mbutton;
    else if (mpacket == 3'd2) // delta X movement
      xcount[7:0] <= #1 xcount[7:0] + xydelta;
    else if (mpacket == 3'd3) // delta Y movement
      ycount[7:0] <= #1 ycount[7:0] + xydelta;
    else if (mpacket == 3'd4) // delta Z movement
      zcount[7:0] <= #1 zcount[7:0] + {{4{mreceive[4]}}, mreceive[4:1]};
//    else if (sof) begin
//      if (mou_emu[3]) ycount <= #1 ycount - 1'b1;
//      else if (mou_emu[2]) ycount <= #1 ycount + 1'b1;
//      if (mou_emu[1]) xcount <= #1 xcount - 1'b1;
//      else if (mou_emu[0]) xcount <= #1 xcount + 1'b1;
//    end
  end
end

// PS2 intellimouse flag
always @ (posedge clk) begin
  if (reset)
    intellimouse <= #1 1'b0;
  else if ((mpacket==3'd5) && (mreceive[2:1] == 2'b11))
    intellimouse <= #1 1'b1;
end

// PS2 mouse state machine
always @ (posedge clk) begin
  if (reset || mtready)
    mstate <= #1 0;
  else
    mstate <= #1 mnext;
end

always @ (*) begin
  mclkout  = 1'b1;
  mtreset  = 1'b1;
  mrreset  = 1'b0;
  msreset  = 1'b0;
  mpacket  = 3'd0;
  mcmd_inc = 1'b0;
  case(mstate)

    0 : begin
      // initialize mouse phase 0, start timer
      mtreset=1;
      mnext=1;
    end

    1 : begin
      //initialize mouse phase 1, hold clk low and reset send logic
      mclkout=0;
      mtreset=0;
      msreset=1;
      if (mthalf) begin
        // clk was low long enough, go to next state
        mnext=2;
      end else begin
        mnext=1;
      end
    end

    2 : begin
      // initialize mouse phase 2, send command/data to mouse
      mrreset=1;
      mtreset=0;
      if (msready) begin
        // command sent
        mcmd_inc = 1;
        case (mcmd_cnt)
          0 : mnext = 4;
          1 : mnext = 6;
          2 : mnext = 6;
          3 : mnext = 6;
          4 : mnext = 6;
          5 : mnext = 6;
          6 : mnext = 6;
          7 : mnext = 5;
          8 : mnext = 6;
          default : mnext = 6;
        endcase
      end else begin
        mnext=2;
      end
    end

    3 : begin
      // get first packet byte
      mtreset=1;
      if (mrready) begin
        // we got our first packet byte
        mpacket=1;
        mrreset=1;
        mnext=4;
      end else begin
        // we are still waiting
        mnext=3;
      end
    end

    4 : begin
      // get second packet byte
      mtreset=1;
      if (mrready) begin
        // we got our second packet byte
        mpacket=2;
        mrreset=1;
        mnext=5;
      end else begin
        // we are still waiting
        mnext=4;
      end
    end

    5 : begin
      // get third packet byte 
      mtreset=1;
      if (mrready) begin
        // we got our third packet byte
        mpacket=3;
        mrreset=1;
        mnext = (intellimouse || !mcmd_done) ? 6 : 3;
      end else begin
        // we are still waiting
        mnext=5;
      end
    end

    6 : begin
      // get fourth packet byte
      mtreset=1;
      if (mrready) begin
        // we got our fourth packet byte
        mpacket = (mcmd_cnt == 8) ? 5 : 4;
        mrreset=1;
        mnext = !mcmd_done ? 0 : 3;
      end else begin
        // we are still waiting
        mnext=6;
      end
    end

    default : begin
      //we should never come here
      mclkout=1'bx;
      mrreset=1'bx;
      mtreset=1'bx;
      msreset=1'bx;
      mpacket=3'bxxx;
      mnext=0;
    end

  endcase
end


endmodule
