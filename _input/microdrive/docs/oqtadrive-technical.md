# Technical Documentation

**Note: This is still work in progress, and definitely incomplete!**

## Differences *Spectrum/Interface 1* vs *QL*

While both systems are very similar, there are significant differences, so that cartridges created in one system cannot be used in the other. In particular, the file systems are completely different.

Other differences are (not a complete list):

| item                                  | *IF1*           | *QL*              |
|---------------------------------------|-----------------|-------------------|
| byte cycle                            | 12µs            | 10µs              |
| `COMMS_CLK` idle level                | `HIGH`          | `LOW`             |
| `COMMS_CLK` count for select/deselect | 8 on select, 16 on deselect | 8 for select & de-select combined |
| stop time if nothing received         | 250ms           | 600ms             |

## ROM Peculiarities

### *Spectrum*
- When formatting with an *Interface 1* with V2 ROM, records are longer than they normally would be with a V1 ROM. This is similar to how the *QL* does formatting. The last phase of `FORMAT` overwrites these long records with standard ones, but some (in particular sector 254) may be left over.

    - http://www.users.globalnet.co.uk/~jg27paw4/yr10/yr10_26.htm

### *QL*
- During format, *Minerva* ROM writes incorrect check sums for record headers, data, and extra data.
- *MG* & *Minerva* ROMs do additional checks, compared to older ROMs, when formatting a cartridge, and fail the format if any of the following is true during verification:
    - sectors above 253 are appearing (*Minerva* only)
    - number of good sectors is equal to total number of sectors

Here's a disassembly of the format code from the *MG* ROM (thanks to *tofro* of the *tlienhard* forum):

```assembly
                             LAB_000050e6                                    XREF[1]:     000050ce(j)  
        000050e6 60 00 00 ca     bra.w      abortFormatFailed
                             LAB_000050ea                                    XREF[1]:     000050e0(j)  
        000050ea 4a 85           tst.l      D5
        000050ec 6d 04           blt.b      LAB_000050f2
        000050ee 7a ff           moveq      #-0x1,D5
        000050f0 60 d2           bra.b      LAB_000050c4
                             LAB_000050f2                                    XREF[1]:     000050ec(j)  
        000050f2 7a 00           moveq      #0x0,D5
        000050f4 2f 09           move.l     A1,-(SP)
                             LAB_000050f6                                    XREF[1]:     00005114(j)  
        000050f6 4a 11           tst.b      (A1)
        000050f8 66 12           bne.b      LAB_0000510c
        000050fa 0c 05 00 01     cmpi.b     #0x1,D5b
        000050fe 63 1a           bls.b      LAB_0000511a
        00005100 42 29 ff fe     clr.b      (-0x2,A1)
        00005104 42 29 00 02     clr.b      (0x2,A1)
        00005108 54 49           addq.w     #0x2,A1
        0000510a 52 05           addq.b     #0x1,D5b
                             LAB_0000510c                                    XREF[1]:     000050f8(j)  
        0000510c 54 49           addq.w     #0x2,A1
        0000510e 52 05           addq.b     #0x1,D5b
        00005110 0c 05 00 fe     cmpi.b     #-0x2,D5b
        00005114 65 e0           bcs.b      LAB_000050f6
        00005116 22 5f           movea.l    (SP)+,A1
        00005118 60 06           bra.b      LAB_00005120
                             LAB_0000511a                                    XREF[1]:     000050fe(j)  
        0000511a 58 4f           addq.w     #0x4,SP
        0000511c 60 00 00 94     bra.w      abortFormatFailed
                             LAB_00005120                                    XREF[1]:     00005118(j)  
        00005120 7a 00           moveq      #0x0,D5
                             LAB_00005122                                    XREF[1]:     0000513a(j)  
        00005122 53 11           subq.b     #0x1,(A1)                                        map entry for sector
        00005124 0c 11 00 fe     cmpi.b     #-0x2,(A1)                                       did the sector fail verification?
        00005128 6e 0c           bgt.b      LAB_00005136                                     yes, both passes
        0000512a 67 02           beq.b      LAB_0000512e                                     yes, one pass only
        0000512c 52 57           addq.w     #0x1,(SP)                                        nothing failed, increment good s
                             LAB_0000512e                                    XREF[1]:     0000512a(j)  
        0000512e 1f 45 00 03     move.b     D5b,(0x3,SP)                                     store total sectors
        00005132 18 11           move.b     (A1),D4b                                         Highest sector map entry
        00005134 28 49           movea.l    A1,A4                                            and pointer to it
                             LAB_00005136                                    XREF[1]:     00005128(j)  
        00005136 54 49           addq.w     #0x2,A1                                          next sector map entry
        00005138 52 05           addq.b     #0x1,D5b                                         increment sector counter
        0000513a 64 e6           bcc.b      LAB_00005122                                     until all possible sectors done
        0000513c 52 2f 00 03     addq.b     #0x1,(0x3,SP)                                    one more total sector
        00005140 0c 57 00 c8     cmpi.w     #0xc8,(SP)                                       At least 200 good sectors verify
        00005144 6d 6c           blt.b      abortFormatFailed                                nope, format failed
        00005146 3a 2f 00 02     move.w     (0x2,SP),D5w
        0000514a ba 57           cmp.w      (SP),D5w                                         total sectors == good sectors?
        0000514c 67 64           beq.b      abortFormatFailed                                too good to be true -> format fa
        0000514e 43 ed 00 0e     lea        (0xe,A5),A1                                      point to data block in header
        00005152 70 00           moveq      #0x0,D0
                             clearLoop                                       XREF[1]:     00005158(j)  
        00005154 42 99           clr.l      (A1)+                                            clear next 512 bytes
        00005156 52 00           addq.b     #0x1,D0b                                         (i.e. all file/block map entries)
        00005158 6a fa           bpl.b      clearLoop
        0000515a 43 ed 02 70     lea        (0x270,A5),A1                                    start of map in buffer
        0000515e 12 bc 00 f8     move.b     #-0x8,(A1)                                       sector 0 is always map
        00005162 22 17           move.l     (SP),D1                                          good/total sectors
        00005164 d2 41           add.w      D1w,D1w                                          create offset to last sector in 
        00005166 04 41 00 10     subi.w     #0x10,D1w                                        require good sector for directory
                             searchRoomForDirectory                          XREF[1]:     00005172(j)  
        0000516a 55 41           subq.w     #0x2,D1w                                         should be at least nine away from
        0000516c 0c 31 00        cmpi.b     #-0x3,(0x0,A1,D1w*0x1)                           sector vacant?
                 fd 10 00
        00005172 66 f6           bne.b      searchRoomForDirectory                           no, try another one
        00005174 42 31 10 00     clr.b      (0x0,A1,D1w*0x1)                                 use for file number 0, the direct
        00005178 33 41 01 fe     move.w     D1w,(0x1fe,A1)=>switchD_0000046e::switchD        last sector allocated
        0000517c e2 49           lsr.w      #0x1,D1w
        0000517e 1e 81           move.b     D1b,(SP)
        00005180 74 00           moveq      #0x0,D2
        00005182 4e ba 00 d0     jsr        FUN_00005254                                     undefined FUN_00005254()
        00005186 60 2a           bra.b      abortFormatFailed
        00005188 43 ed 02 70     lea        (0x270,A5),A1
        0000518c 3f 11           move.w     (A1),-(SP)
        0000518e 4e ba 00 52     jsr        MD_WRITE                                         undefined MD_WRITE()
        00005192 54 4f           addq.w     #0x2,SP
        00005194 14 17           move.b     (SP),D2b
        00005196 4e ba 00 bc     jsr        FUN_00005254                                     undefined FUN_00005254()
        0000519a 60 16           bra.b      abortFormatFailed
        0000519c 43 ed 00 0e     lea        (0xe,A5),A1
        000051a0 22 bc 00        move.l     #0x40,(A1)
                 00 00 40
        000051a6 42 67           clr.w      -(SP)
        000051a8 4e ba 00 38     jsr        MD_WRITE                                         undefined MD_WRITE()
        000051ac 54 4f           addq.w     #0x2,SP
        000051ae 7e 00           moveq      #0x0,D7
        000051b0 60 02           bra.b      LAB_000051b4
                             abortFormatFailed                               XREF[6]:     000050e6(j), 0000511c(j), 
                                                                                          00005144(j), 0000514c(j), 
                                                                                          00005186(j), 0000519a(j)  
        000051b2 7e f2           moveq      #-0xe,D7

```
