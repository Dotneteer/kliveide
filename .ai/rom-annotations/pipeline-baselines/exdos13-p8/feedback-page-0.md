# ep-exdos13.rom page 0: feedback on the tools (D11)

3 compile(s) so far. Review this with the project author; accepted proposals go to
`.ai/rom-annotations/pipeline-backlog.md` with the ROM and the evidence.

## cards

### feedback missing (27, asked)

Proposal: add the fact to the cards (stage 9-11), or a convention that knows it

- $00F2-$0104: CALL $00F2 returns past its inline byte (EX (SP)); the cards for $0360, $0380, $03B4 and $0F07 say "return cannot be followed" and list $0364, $0384, $03B8 as unreached, though they are the continuations (.rom-annotations/work/ep-exdos13.rom/ann/range-01.ann:1092)
- $013A-$01A1: The 72 bytes $04BD-$0504 are copied to IY+$01ED and patched; JP (IY) at $049F and the CALL at $0F0C run that copy, so $04BD-$04E5 is RAM code and $04E6-$0504 two device descriptor templates (.rom-annotations/work/ep-exdos13.rom/ann/range-01.ann:1093)
- $0013-$0017: IY is the workspace + $80 from $0017 on, and ACT4_VAR shows IY-$5E..IY-$3B are EXDOS's own EXOS variables $40-$63; a card fact naming those would save reading the variable code each time (.rom-annotations/work/ep-exdos13.rom/ann/range-01.ann:1097)
- $073F-$0767: Table words $0691 and $06AB name $0741 and $0767, the $B7 inside LD H,$B7 (create entries); no card or hidden-entry line has them (.rom-annotations/work/ep-exdos13.rom/ann/range-02.ann:1000)
- $095B: Card lists table $06A7 as a way in; that word is the drive-letter device's interrupt slot, never called (DD_IRQFLAG 0) (.rom-annotations/work/ep-exdos13.rom/ann/range-02.ann:1002)
- $0F0B: The walk does not go on after CALL $00F2's inline byte: $0F0B (after $0F07) and $0F33 (after $0F2F) are carded as unreached with no way in, though both run on when $00F2 returns past its byte (.rom-annotations/work/ep-exdos13.rom/ann/range-03.ann:880)
- $0AD1: $0AD1 ($80) is data: $0ABA sets IX = $CAC9 and $0AE5 reads (IX+8); the card lists it as an instruction of $0ACD. A LD IX,nn pointing into this page could flag the bytes it reads at fixed offsets (.rom-annotations/work/ep-exdos13.rom/ann/range-03.ann:881)
- $0F3F: The message numbers passed to $0098 ($3D, $44-$49) had to be decoded by hand from page 1's table; a card could show the message text for an LD A,n before CALL $3074 (.rom-annotations/work/ep-exdos13.rom/ann/range-03.ann:884)
- $1005: The card does not say the entry's address ($D005) is passed at $01CA to $03DF, which stores it as the RAM disk's driver; nor the same for $1FD3 at $01B2. A "referenced as an immediate" fact would have saved a search of the ROM bytes. (.rom-annotations/work/ep-exdos13.rom/ann/range-04.ann:1014)
- $17F7: The function table's entry 4 ($0558 = $D7F8) enters inside JP NZ,$803E at $17F7 (LD A,$80); the card lists only the jump-out, not the hidden entry (.rom-annotations/work/ep-exdos13.rom/ann/range-05.ann:795)
- $16AE: The CALL $00F2 inline byte split $16AA/$16D0/$1701/$17B1/$19B0 into "unreached" cards; the routine they continue would read better as one card (.rom-annotations/work/ep-exdos13.rom/ann/range-05.ann:796)
- $1C9F: The card gives no port numbers: C comes from IN C,(C) on port $B3, so every IN/OUT (C) in the driver had to be traced by hand (.rom-annotations/work/ep-exdos13.rom/ann/range-06.ann:941)
- $1A37: The card says BC, HL change but the code restores both (POP BC at $1A6B, EX (SP),IX / POP HL at $1A92) (.rom-annotations/work/ep-exdos13.rom/ann/range-06.ann:943)
- $2216: The card does not say that $2216 reads the byte table at $2229-$2230 (indexed by the lowest set bit of A) (.rom-annotations/work/ep-exdos13.rom/ann/range-07.ann:1013)
- $2231: No card says the functions 4-6 return with the register sets exchanged (EXX at $2266, $221E, $227E): the caller's B, C, HL are the counters kept in BC', HL' (.rom-annotations/work/ep-exdos13.rom/ann/range-07.ann:1014)
- $24CD: The cards of $2477-$2544 do not say that $24CD pops its caller's address and $2544 returns with JP (HL): every card lists "no return is reachable" or a foreign stack (.rom-annotations/work/ep-exdos13.rom/ann/range-08.ann:1080)
- $2B5E-$2BF1: The cards say only "jump $0037"/"jump $0033"; that these are extension actions 3 and 2 of the dispatcher at $0013 (B, DE, C as EXOS hands them) had to come from the listing (.rom-annotations/work/ep-exdos13.rom/ann/range-09.ann:936)
- $2E30: The write at $2E30 reads 10 bytes from $2F3E, running past the bytes region $2F38-$2F43 into the code at $2F44-$2F47; no card notes a data read that overlaps code (.rom-annotations/work/ep-exdos13.rom/ann/range-09.ann:938)
- $327F-$34EF: The command handlers' entry state comes from $2C47-$2C55 (A = $FF with NZ, NC; HL = the text; IX = DE = IY+$FD; C = 0): a card for a table-entered handler should carry it (.rom-annotations/work/ep-exdos13.rom/ann/range-10.ann:946)
- $390B: The command handlers' entry (A = $FF, NZ; HL = the parameter text, length at HL-1; IX = DE = the request block) comes from $2C17-$2C57, which the cards do not say; the AND (HL) at $3B11, $3B3D and $3B69 only make sense with it. (.rom-annotations/work/ep-exdos13.rom/ann/range-11.ann:1049)
- $3C18: The return address the routine at $3C1F pushes (ld de,$FCDC / push de) is not shown: $3C18, $3C6A and $3C7B all return to $3CDC, not to $3C1F's caller (.rom-annotations/work/ep-exdos13.rom/ann/range-12.ann:303)
- $0C45-$0C57: Four jump targets inside one routine were left unlabelled between ranges; the problem list caught them only at the merge (.rom-annotations/work/ep-exdos13.rom/ann/range-13-merge.ann:17)
- $0550-$058D: ld hl,$C550 / add hl,bc / ld e,(hl) at $0524 indexes a 31-entry word table (cp $1F at $0505); the proposals offered five fragments ($0552, $0558, $0568, $057A, $058F) and false targets ($38D7, $058E's neighbours) instead of the table (.rom-annotations/work/ep-exdos13.rom/regions/page-0.ann:182)
- $068D-$06C2: The device entry tables are found from the descriptors' DD_TAB words ($04EE = $468D, $04FF = $46A7: page-1 addresses of this page); the proposals had fragments only (.rom-annotations/work/ep-exdos13.rom/regions/page-0.ann:183)
- $04E6-$0504: The $48-byte block copied by ldir at $0180 holds RAM code and two device descriptors; the card shows the descriptors as code and the words proposal at $04CE lands on the RAM code's patched operands (.rom-annotations/work/ep-exdos13.rom/regions/page-0.ann:184)
- $2C58-$2D40: The command table (counted name, handler word; 0 ends) is read by $2B9E and $2BF6; the proposals saw only six of its names as text and a few bytes, and the hidden entries $2BF0/$2BF7/$2C0D came from the copyright text at $2BBC (.rom-annotations/work/ep-exdos13.rom/regions/page-0.ann:187)
- $0131-$0139: ld de,$C131 at $3FCD (then ldir 9) makes a counted text; the listing decodes $0139 ':' into ld a,($F211) and hides the entry at $013A (.rom-annotations/work/ep-exdos13.rom/regions/page-0.ann:188)

### feedback wrong (19, asked)

Proposal: find the stage that produced the fact and add the case as a test

- $01D1: "in from: jump $0B78" is false: the JP Z at $0B78 follows a JR Z on the same flag and never jumps; its bytes hide POP DE/POP BC at $0B79 (.rom-annotations/work/ep-exdos13.rom/ann/range-01.ann:1094)
- $2D74: The card's body includes $2D92-$2D99, which follow an unconditional JR and are reached from nowhere on the card (.rom-annotations/work/ep-exdos13.rom/ann/range-01.ann:1096)
- $0A01: Marked unreached, yet it ran: CALL $00F2 at $09FD returns past its inline byte ($0A00) into $0A01 (.rom-annotations/work/ep-exdos13.rom/ann/range-02.ann:1001)
- $0470-$04AE: IY and the alternates are pushed at $0472-$047A and popped at $04A4-$04AE, yet every caller's facts say IY may change; Keeps: IY was settled from that (.rom-annotations/work/ep-exdos13.rom/ann/range-02.ann:1005)
- $09CC-$0B8E: HL at $09CC and IX at $0AD2 come back (push/pop at $09D3/$09F5; ex (sp),ix at $0B37 then pop ix at $0B7C) though the facts list them as changed (.rom-annotations/work/ep-exdos13.rom/ann/range-02.ann:1006)
- $1FC5: The card runs $1FC5 on past its RET at $1FD2 into $1FD3-$1FEA, a separate entry (the floppy driver, address passed at $01B2); it should be its own card. (.rom-annotations/work/ep-exdos13.rom/ann/range-04.ann:1015)
- $154A: $1581 is reported as a jump to $3F16, but it is reached only with Z (from $157F) so never jumps; its operand bytes hide LD D,$FF at $1582 (from $157A). (.rom-annotations/work/ep-exdos13.rom/ann/range-04.ann:1016)
- $1AA2: The facts say IY may change, but no path writes it: the only IY writes on the page are $0017, $0480 (restored at $04AC), $09B2 and DISK_IO's own (restored) (.rom-annotations/work/ep-exdos13.rom/ann/range-06.ann:944)
- $1A37: BC and HL come back: POP BC at $1A6B and POP HL at $1A94 (the Keeps: warnings are settled from the code) (.rom-annotations/work/ep-exdos13.rom/ann/range-06.ann:945)
- $23AB: The card says the routine jumps out of the page to $0126 and $0226: both JP Z are never taken (NZ on every path in), they only hide LD H,1 and LD H,2 (.rom-annotations/work/ep-exdos13.rom/ann/range-07.ann:1011)
- $240B: The card says $2405 leaves for $93CB: JP NZ follows BIT 2,E with Z, so it never jumps; it hides RES 2,E at $240C (.rom-annotations/work/ep-exdos13.rom/ann/range-07.ann:1012)
- $236D: The facts say C, IX and IY may change: C comes back from DISK_IO and the PUSH BC/POP BC around ADDR_READ and FD_CHECK_STEP, IX from POP IX at $234E, and nothing writes IY (.rom-annotations/work/ep-exdos13.rom/ann/range-07.ann:1019)
- $23C8: The facts say L may change: ADDR_READ pushes and pops HL around DISK_IO, and DISK_IO 0 does not touch L (.rom-annotations/work/ep-exdos13.rom/ann/range-07.ann:1020)
- $1FD3: Range 4's FLOPPY_DRIVER says function 7 goes to $241D: the code (SUB 2, DEC, SUB 4, DEC) sends 8 there and makes 7 fail with $BD, which range 8's IY-$12 = 8 test needs (.rom-annotations/work/ep-exdos13.rom/ann/range-08.ann:1079)
- $3DDB: Keeps: none (IY may change) only because $0336's return was not followed; OPEN_FREE_CHAN keeps IX and IY, so $3DDB and $2DA3 keep IY (.rom-annotations/work/ep-exdos13.rom/ann/range-09.ann:935)
- $373E: The card lists "jump $1114" as a way in, but the JP NZ at $1114 follows XOR A and never jumps (range 4 says so); $373E is only a fall-through. (.rom-annotations/work/ep-exdos13.rom/ann/range-11.ann:1047)
- $3A13: The cards for $39DA-$3A2E say "jumps out of the page to $000E": the JP NC at $3A29 follows a taken JR NC and never jumps; its operand is the hidden LD C,0 at $3A2A. (.rom-annotations/work/ep-exdos13.rom/ann/range-11.ann:1048)
- $3D5C: The card says $3D5C jumps out of the page to $AF1B: OR $AE before it always gives NZ, so the JP Z never runs; its bytes only hide the exit $3D5D (DEC DE, XOR A) (.rom-annotations/work/ep-exdos13.rom/ann/range-12.ann:302)
- $04CE-$04D5: Not words: RAM code (ld a,n / out / jp / jp (hl)) whose operands $0180-$01A1 patch (.rom-annotations/work/ep-exdos13.rom/regions/page-0.ann:185)

### feedback listing (15, asked)

Proposal: find what the card lacked that the listing gave

- $0CBE-$0D70: Cards of $0CBE, $1193, $1A48, $0C1E stop at a fall-through into another range's label; the routine's work needed the listing (.rom-annotations/work/ep-exdos13.rom/ann/range-02.ann:1003)
- $09CC-$1000: Opened the listing around the range: the cards split one routine into many jump targets and do not show the callees in other ranges ($0A2E, $0C1E, $0C30, $0CC9, $0ED5), which the buffer and prompt routines only make sense with (.rom-annotations/work/ep-exdos13.rom/ann/range-03.ann:883)
- $0F9C-$0FD6: Opened to see what falls into $0FD6 (the key read and $BFF2 test) and $01A0-$01E0 for the $D005 reference. (.rom-annotations/work/ep-exdos13.rom/ann/range-04.ann:1018)
- $0505-$0550: Opened the dispatcher to learn the flags fn 6 enters with (A = 0, Z, AF' = 2n) for the JP NZ at $17F7 (.rom-annotations/work/ep-exdos13.rom/ann/range-05.ann:798)
- $1148-$11D8: Opened to learn what $1148, $1172, $1190 and $1193 take and return: callee contracts are not on the cards (.rom-annotations/work/ep-exdos13.rom/ann/range-06.ann:946)
- $1EE0-$2000: Opened to see the dispatcher at $1FD3 (range 4's card) that enters every routine of this range (.rom-annotations/work/ep-exdos13.rom/ann/range-07.ann:1016)
- $2440-$2580: Opened for the format code past my cards ($2477-$2544) and the pair lists at $2553 (.rom-annotations/work/ep-exdos13.rom/ann/range-07.ann:1017)
- $1C9F-$1DE2: Opened to learn what DISK_IO 7 returns in B and how DISK_IO treats IY (.rom-annotations/work/ep-exdos13.rom/ann/range-07.ann:1018)
- $2440-$2B50: Opened to follow the format's passes, the byte transfer across ranges 8-9 and the run of hidden entries ($2683, $2921) (.rom-annotations/work/ep-exdos13.rom/ann/range-08.ann:1082)
- $29E4-$2B5D: The range starts inside $29E4 and ends inside $2B2E: the stack layout the fragments share (three words, then four) had to be worked out from the listing across ranges 8 and 9 (.rom-annotations/work/ep-exdos13.rom/ann/range-09.ann:939)
- $3118-$3131: Had to read $30D3-$3118 to see what $3127's POP takes (the number pushed at $30D3) (.rom-annotations/work/ep-exdos13.rom/ann/range-10.ann:948)
- $2B9B-$2C58: Had to read the command dispatcher and decode the command table by hand to know which handler is which command (.rom-annotations/work/ep-exdos13.rom/ann/range-10.ann:949)
- $3580-$363F: The cards start in the middle of TYPE/COPY ($363F); the stack layout (the status at $35FD, the segment list at $35AF) and IX (the destination's block from $360C) needed the listing of range 10's part. (.rom-annotations/work/ep-exdos13.rom/ann/range-11.ann:1051)
- $3BC0-$3E90: The cards here are inner pieces of routines whose heads are on ranges 9-11; the pushes they pop ($3BE2, $3C2D, $3C50, $3CBD, $3D44, $3DFB) and the entries' flags needed the listing (.rom-annotations/work/ep-exdos13.rom/ann/range-12.ann:305)
- $0000-$3FFF: Opened the whole page to judge the proposals: the cards' memory lines did not show which code reads $020C, $0366, $09B6, $1000, $1132, $17E1, $1A96, $2229, $24C2, $2553, $2BBC, $2F38, $2F9E, $2FB7, $33B9, $36D4, $3A97, $3B66, $3BDB (all ld rr,nn of an address on this page) (.rom-annotations/work/ep-exdos13.rom/regions/page-0.ann:189)

### listing requests (199, measured)

Proposal: each is a card that was not enough: read the reason and add what was missing

- $0000-$0100: EXOS_ROM header extent and the entry code: the proposals cover only the 8-byte name
- $0000-$0100: EXOS_ROM header extent and the entry code: the proposals cover only the 8-byte name
- $0000-$3FFF: Region pass: judging the 57 proposals against the code that reads them and searching for missed tables (ld hl,table then indexing) needs the whole page
- $0000-$05C0: range-01: see code between cards, data blocks and the RAM-copied block at 04BD
- $19B4-$1F80: read range 6 routines in sequence with their fall-throughs
- $1490-$19E0: range-05: read the routines on my cards
- $09CC-$0AA3: context for range 03: callees CC, /bin/zshA2E and the routine that /bin/zshAA3 ends
- $0AA0-$0C70: range 03: the buffer routines /bin/zshAA3-/bin/zshC69 and their neighbours in other ranges
- $0FA0-$16DA: range-04: see the code around and between my cards (callers, the parts in other ranges that my routines fall into)
- $00F2-$0131: range 03: what CALL $00F2 with its inline byte does, used at $0F07 and $0F2F
- $0460-$0620: range-02: context of the function-table handlers and their callees 0470, 0505, 0550-058D
- $0C70-$0F00: range 03: routines $0C6B-$0EEB and the callees between them
- $05E8-$0AD2: range-02: the range's own code in sequence, to read routines whose cards stop at a fall-through
- $0F00-$1010: range 03: the error-report routine $0EEB-$0FD4 and its tail
- $01A0-$01E0: range-04: what refers to $D005 (word at $01CB)
- $0F33-$0FA2: range-04: the caller that falls into $0FD6 (key answer)
- $00F2-$0130: range-05: what CALL $00F2 with its inline byte and CALL $0105 do, used throughout my range
- $02CF-$02D8: range-05: $02D1 called by $17CD
- $3020-$3090: range 03: the output-buffer helpers $3023-$3083
- $31C6-$3240: range 03: $31C6/$31D8 and the $31F4 they jump to
- $3261-$3270: range 03: $3261
- $3E31-$3E50: range 03: $3E31
- $0505-$0550: range 03: the entry/exit at $052F that $0F33 jumps to
- $0098-$00B5: range 03: the message routine $0098 that $3074 calls
- $00B5-$00F2: range 03: what $0098 returns to $3074
- $1F80-$1FD8: what 1F71 (my range's last subroutine) returns, for 1D27 and 1D44
- $0DB9-$0E2C: range-01: callees and ends of routines on my cards
- $0AB9-$0AF6: range-01: callees and ends of routines on my cards
- $0BAE-$0C06: range-01: callees and ends of routines on my cards
- $0CC9-$0D6D: range-01: callees and ends of routines on my cards
- $0ED4-$0F32: range-01: callees and ends of routines on my cards
- $2D5E-$2D9A: range-01: callees and ends of routines on my cards
- $2F85-$2F90: range-01: callees and ends of routines on my cards
- $3FB0-$3FE2: range-01: callees and ends of routines on my cards
- $05A4-$0640: range-01: callees and ends of routines on my cards
- $0B78-$0B80: range-01: callees and ends of routines on my cards
- $00C0-$0130: range-02: what CALL $00F2 with an inline byte does, used at $09FD
- $0240-$02E0: range-02: callees $025D and $02D1 of $0624/$062D/$067A
- $0505-$0590: how the function table that reaches 1AB9/1B4C/1BAB/1C6D is indexed
- $1148-$11D8: contract of the cluster-chain helpers 1148/1172/1190/1193 my routines call
- ... and 159 more

## detectors

### data regions no detector proposed (135, measured)

Proposal: look at what told the AI it was data; a recurring shape is a new detector (proposals.ts)

- bytes $0AD1-$0AD1
- text $0000-$0007
- words $0008-$0009
- text $0131-$0139
- text $020C-$0220
- text $0366-$036B
- bytes $04E6-$04F2
- text $04F3-$04F6
- bytes $04F7-$0504
- words $0550-$058D
- words $068D-$06C2
- text $09B6-$09CB
- bytes $0CAF-$0CB3
- bytes $1000-$1004
- bytes $1132-$113C
- text $113D-$1142
- bytes $1143-$1147
- bytes $1500-$1501
- text $1502-$1512
- bytes $17E1-$17E1
- text $1A96-$1AA1
- bytes $2229-$2230
- bytes $24C2-$24C4
- text $24C5-$24CC
- bytes $2553-$257C
- text $2BBC-$2BDB
- text $2C58-$2C5A
- words $2C5B-$2C5C
- text $2C5D-$2C5F
- words $2C60-$2C61
- text $2C62-$2C64
- words $2C65-$2C66
- text $2C67-$2C69
- words $2C6A-$2C6B
- text $2C6C-$2C6F
- words $2C70-$2C71
- text $2C72-$2C75
- words $2C76-$2C77
- text $2C78-$2C7B
- words $2C7C-$2C7D
- ... and 95 more

## conventions

### feedback pattern (15, asked)

Proposal: write it as a convention plug-in (conventions/), with its source (D4)

- $01B2-$01CA: Driver routines are passed as DE to ADD_UNITS ($1FD3, $1005) and called through DRIVER_CALL; their cards say unreached (.rom-annotations/work/ep-exdos13.rom/ann/range-01.ann:1095)
- $0252-$0372: The Changes questions for IX, IY and the alternates on $0252, $0281, $02B9, $030C and $036C come from the unfollowed returns of CALL $00F2; no path through them uses EXX (except RELINK_LET_DEV) or loads IX/IY (.rom-annotations/work/ep-exdos13.rom/ann/range-01.ann:1098)
- $0710-$08FC: Device entries use LD H,$B7 to hide an OR A entry and EX AF,AF' to carry open/create in F'; card facts lose both (.rom-annotations/work/ep-exdos13.rom/ann/range-02.ann:1004)
- $0B78-$0B7E: Two skip tricks the cards cannot see: JP Z at $0B78 is never taken (Z was tested just before) and hides POP DE/POP BC; CP $C1 at $0B7E hides POP BC. A conditional jump right after a jump on the same condition could be flagged as never taken (.rom-annotations/work/ep-exdos13.rom/ann/range-03.ann:882)
- $1513-$1546: PATH_GET_CHAR and PATH_UNGET_CHAR keep the text in the alternate set; every caller's register facts (BC', DE') follow from that, worked out by hand several times. (.rom-annotations/work/ep-exdos13.rom/ann/range-04.ann:1017)
- $154A-$1627: The name reader $1513 runs in the other register set (EXX), so C and DE swap meaning across calls; cards could say which set a register fact is in (.rom-annotations/work/ep-exdos13.rom/ann/range-05.ann:797)
- $1C9F-$1F89: The driver's IY-relative variables (IY-$1F to IY-$13) recur on 30 cards with no shared summary (.rom-annotations/work/ep-exdos13.rom/ann/range-06.ann:942)
- $22C1-$2545: The driver's per-drive arrays (IX = IY + drive: -$0B, -$07, -$03, +$01, +$05, +$09/+$0D, +$11/+$15, +$19) recur on 40 cards with no shared summary (.rom-annotations/work/ep-exdos13.rom/ann/range-07.ann:1015)
- $26E2-$2B5D: The transfer state at IY+$48-$5A and the control block's fields (+$17-$2C) recur on 40 cards with no shared summary (.rom-annotations/work/ep-exdos13.rom/ann/range-08.ann:1081)
- $2B69-$2B98: $2B69 and $2B6E end with EXX: every call swaps the register sets, so HELP_EXDOS's list runs in the other set; the register facts cannot show the swap count (.rom-annotations/work/ep-exdos13.rom/ann/range-09.ann:937)
- $3858-$385A: JP NZ,nn after XOR A (and JP Z after OR $AE at $3D5A) is never taken and hides an entry in its operand; the card calls it "jumps out of the page" (.rom-annotations/work/ep-exdos13.rom/ann/range-10.ann:947)
- $3864-$3907: The copy helpers keep a flag in F' across calls (the end-of-file mark, Z/NZ, and COPY_FILL_BUF's carry); the cards list AF' as "may change" without saying which flag carries what. (.rom-annotations/work/ep-exdos13.rom/ann/range-11.ann:1050)
- $3E3A-$3E7F: $3E3A-$3E7F repeats $3DBA-$3DFF byte for byte (the absolute calls unchanged); a "same bytes as code elsewhere on the page" fact would have said so at once (.rom-annotations/work/ep-exdos13.rom/ann/range-12.ann:304)
- $00F2: Every call to $00F2 (28 of them) is followed by one inline byte; only the 13 read in the profile were proposed, and inline bytes swallowed code at $0383, $03B7, $0A00, $0F32, $16DA, $19B3. A callee that does ex (sp),hl / ld e,(hl) / inc hl / ex (sp),hl should mark the byte after every call (.rom-annotations/work/ep-exdos13.rom/regions/page-0.ann:181)
- $0907-$3B1F: The "4 words, each the address of code the walk reached" proposals at $058F, $0907, $0924, $1AD4, $1B88, $1C2F, $2687, $2E13, $2ECF, $2F08, $3489, $34DE, $3B18 are all CALL/JP/CALL cc instructions that did not run in the profile; an unrun CD/C3/Cx nn nn is not a table (.rom-annotations/work/ep-exdos13.rom/regions/page-0.ann:186)

### unknown register facts the AI settled (96, measured)

Proposal: a call that recurs is a contract a convention plug-in can supply (the EXOS call is the model)

- 28 x calls $00F2, whose return the pass cannot follow ($0332, $0336, $0360, $036C)
- 22 x returns with 2 byte(s) still pushed: a computed jump, not a return ($0549, $0AD2, $0AE0, $257D)
- 12 x jumps out of the page to $xxxx ($17E2, $17E2, $17EE, $17EE)
- 10 x calls $16C7, whose return the pass cannot follow ($12F9, $17E2, $17EE, $1805)
- 9 x calls $0549, whose return the pass cannot follow ($0505, $327F, $341B, $3495)
- 9 x calls $3C1F, whose return the pass cannot follow ($32AB, $33BE, $33BF, $342F)
- 8 x calls $16AA, whose return the pass cannot follow ($12CF, $15C6, $15D4, $1AB9)
- 8 x calls $0336, whose return the pass cannot follow ($2DA3, $2DA3, $2DA3, $34E9)
- 6 x calls $09FC, whose return the pass cannot follow ($0BBD, $125C, $1268, $1A37)
- 5 x calls $16D0, whose return the pass cannot follow ($15C6, $15D4, $1805, $196C)
- 4 x calls $0470, whose return the pass cannot follow ($058E, $05A6, $0C1E, $0C5A)
- 4 x POP below the routine's own pushes: it takes the caller's stack (the return address) ($1005, $1FC5, $22C1, $24CD)
- 3 x jp (iy): the target is not known statically ($03C8, $03DF, $0470)
- 2 x EX (SP) on the caller's stack (the return address) ($00F2, $00F2)
- 2 x calls $0372, whose return the pass cannot follow ($0281, $02B9)
- 2 x returns with 8 byte(s) still pushed: a computed jump, not a return ($06C3, $1C9F)
- 2 x calls $03DF, whose return the pass cannot follow ($0AD2, $0AE0)
- 2 x calls $09F9, whose return the pass cannot follow ($125C, $1268)
- 2 x changes SP: the stack is not followed past it ($1FC5, $1FC5)
- 2 x calls $24CD, whose return the pass cannot follow ($24CD, $24CD)
- 2 x jp (hl): the target is not known statically ($24CD, $2BF1)
- 1 x calls $0332, whose return the pass cannot follow ($030C)
- 1 x calls $0360, whose return the pass cannot follow ($073F)
- 1 x calls $0465, whose return the pass cannot follow ($0C69)
- 1 x calls $0329, whose return the pass cannot follow ($1005)
- 1 x paths meet here with different stack depths ($1005)
- 1 x goes to $xxxx, which is not an instruction start in the code (inside an instruction, or data) ($154A)
- 1 x calls $28D8, whose return the pass cannot follow ($278C)
- 1 x calls $28EB, whose return the pass cannot follow ($278C)
- 1 x returns with 4 byte(s) still pushed: a computed jump, not a return ($2BF1)

