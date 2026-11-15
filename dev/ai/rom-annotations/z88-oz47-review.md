# Z88 OZ 4.7 annotations: review notes

What the helpers that drafted the synopses (`helper-briefs/z88-draft-synopses.md`) found while reading the
code: places where the OZ source's comment and the code disagree (the synopsis follows the code), possible
bugs in OZ (recorded, not acted on), callers that only share a name, and points left at a summary level
that a later pass should confirm. Plan: `dev/plans/Z88_OZ47_ROM_ANNOTATIONS_PLAN.md`, Phase 3. Keys are
`<bank>:<offset in decimal>`, as in `z88-oz47-authored.json`.

## Kernel, banks 0 and 1 (2026-11-15)

- (kernel-1) HW_INT and HW_NMI run at two addresses: $0038/$0066 while bank 0 is paged at $0000 after a hard reset, and $C038/$C066 through the low-RAM vectors, which nmi_halt (os/nmi.asm) points at them before coma. I = COMA_RDSK in coma, 0 at reset.
- (kernel-1) Two-byte calls (CallGN, CallOS2byte, CallDC): the function's return address is $xx03 of the table page in S3; for kernel 0 that is OS_TBL+3, 'jp OSFramePop'. So OSDom and OSHt leave through OSFramePop.
- (kernel-1) HexNibble and rxbyte: the slice's callers in apps/eazylink, apps/flashstore and apps/index are those applications' own routines with the same name (case-insensitive match), not calls into the kernel.
- (kernel-1) ConvHexNibble's source comment says 'a'-'f', but it subtracts $37, which is right only for upper-case 'A'-'F'.
- (kernel-1) BadSwapAndFree / bsf_1: the page range (E up to A - 1, A = D on entry) is read from the arithmetic; BadAdvance's skip of b21 means page numbers are not always consecutive. A second look by someone who knows the bad-application memory scheme would help.
- (kernel-1) DoAlarms calls GN_Alp only when the handler's bank byte (ahnd_Func+2) is zero, and does nothing otherwise; that is what the code does, the reason is not in the source.
- (kernel-1) AppReleaseMem calls a bad application's enquiry entry (entry point + 3) with A = RC_Esc (via JpAHL's ex af,af').
- (kernel-1) sigx_read assumes EAZYLINK_TESTPROTOCOL is off; the bytes at $D34F confirm the OSSiGbt path.
- (kernel-1) OsOutKernel and OSOutMain registers were not traced, so the string writers (BankDispString, bind_strptr, OSOutString) have no Changes line.
- (kernel-2) PeekHL/PokeHL and their relatives read and write addresses at $8000 and above through the caller's S2/S3 binding taken from the OS frame (IY), so they need IY = OS frame only for those addresses.
- (kernel-2) fma_nof (0:9031): when a run of free pages reaches the bank's last page without being long enough, 'djnz nof_1' leaves B = 0 and 'djnz nof_0' wraps it to 255, so the scan seems to continue past the bank's 64 MAT entries. Not stated in the synopsis; worth a check against the bytes.
- (kernel-2) GetRealCmdPos (0:11200): the Fc = 1 cases are only partly traced (empty list, previous-command fallback at grcp_4, restart with command 1 at grcp_5); the synopsis says so in general terms.
- (kernel-2) fma_slt (0:8925): on a slot without RAM it returns Fc = 1 with A holding the slot's RAM size byte, not an error code; fma_any replaces it with RC_Room only after the last slot.
- (kernel-2) MountAllRAM 'skip if no RAM' test: a nonzero byte at the DOR address skips the device (unwritten bank reads non-zero).
- (kernel-2) Changes lines are left out where callees (DrawOZwd, GetAppDOR, OS_Bout, InitHelpWd) were not traced: PrntAppname, PrintTopic, PrntCommand, the Draw*HelpWd routines, OSMopMain/OSMclMain/OSMalMain, SetExclusiveBank, RebuildMAT, AddRAMCard.
- (kernel-2) Sidecar labels used for truncated names: MySetPndngAlmTsk, MTHPrintTknzd, GetRealCmdPos, MarkPageAsAllctd, ApplyQlfrsToA/ToESC, DrawOZwd, FndFreePageBankD, FndFreePageSlotD, FndFrePgeAnySlot, FndUnsdBnkAnySlt, CntUnsdPgsInBank.
- (kernel-3) GetHelpOffs: the source comment says Fc = 1, DE = 0 without help, but AND CMDF_HELP always clears Fc; the result is in Fz. Callers only copy DE to BC.
- (kernel-3) dmwd_2 (0:11542) is mth0's 'scf; ret'. The mth1.asm caller listed for it (mth1.asm:231) calls mth1's own local dmwd_2 in kernel bank 1, not this one.
- (kernel-3) InitMenuColumn returns Fc = 0 on both paths (CP 93 / OR A), so DrawMenuWd's 'jr c, dmwd_11' after InitMenuColumnE looks never taken; not verified at run time.
- (kernel-3) fsRestoreS2 and fsMS2BankB both end with LD B,A in fsMS2sub: fsRestoreS2 returns B = the S2 bank it bound again (mth0's comment at GetAppDOR, 'returns also B = old bank binding', is wrong for fsMS2BankB, which returns B unchanged).
- (kernel-3) expf_3 passes D = $10 with HL = byte_F843 to MvToFile, so fsmv_4 binds bank $10 into S1 and reads $7834. On a 128K ROM bank $10 mirrors bank 0 and the $3F filler is read; on this 512K image bank $10 is the FlashStore area and offset $3834 holds $FF, so the filler written is $FF. byte_F843 is then not read in bank 0. Evidence: bytes at file offset $43834.
- (kernel-3) ahb_1's callers include apps/alarm/alarm.asm, which has its own local ahb_1 label (a name collision in the slice's caller search).
- (kernel-3) SeekFile starts with EXX and never swaps back, so after SeekFile/SeekFileMayExpand the caller's DEHL is in the alternate set; the 32-bit counters (Add_/Sub_dehl_*) work on DE'HL'. Left out of the contracts beyond 'DE\'HL\''.
- (kernel-3) RestoreAllAppData: of the end mark $00 $0E $0F only the third byte is strictly checked (first: OR A clears Fc before JR C, source's own '!! bug?'; second: only < $0E fails).
- (kernel-3) CancelOZcmd clears the whole ubSysFlags1 byte, not only the <> / [] bits (SF1_B_SYSTOKENS and SF1_B_XTNDCHAR are in it too).
- (kernel-3) RdStdin's CLI path loads A from E after DC_In; DC_In's own contract was not traced, so the synopsis says only A = byte.
- (kernel-3) sub_EF92's full key map ($E0-$EF, $F0-$FF ranges, Fz on return) was described only at the level traced; its exact return codes per key range would need a closer pass.
- (kernel-4) 1:3390 no_filearea has two source definitions; the bytes at $8D3E (E1 E1 E1 3E 12 37 C9) are the one in os/osepr/eprfsave.asm (BuildFileEntHdr's error exit), not fepflfmt.asm's.
- (kernel-4) 1:252 Key2MetaTbl_end shares its address with CLI2KeyTable (no label of its own in the sidecar); the imported comment "table length" belongs to CLI2KeyTable's first byte. The synopsis describes both.
- (kernel-4) 1:248 c and 1:250 a: their 'callers' in the slice are unrelated `jp c`/`jr c` lines in apps/alarm; the tables are read only through Key2Meta's page-relative pointers.
- (kernel-4) 0:15542 WdBorders: the source comments say the right bracket goes on the 'last line', but both loops count down from endy, so after them H is the first line; the synopsis says first line.
- (kernel-4) 1:6492 TimeReset: the source comment says 'if bit 7 reset' but the code tests bit 0 of ubTimeBufferSelect (rrca, jr nc); the synopsis follows the code.
- (kernel-4) 1:6551 InitData pairs BL_TMK with BM_TACK* values and BL_TACK with BM_TMK* values; the synopsis names only the timer events (tick, second, minute).
- (kernel-4) 0:15695/0:15699 RestoreScreen/SaveScreen: no Changes line; RdFileByte/WrFileByte were not traced. Callers are OS_Sr (ossr.asm) and the process save/restore in filesys.asm.
- (kernel-5) dmwd_2, dmwd_4 and dmwd_5 have a second definition in mth0.asm (kernel 0, its own module); the bank 1 labels are mth1.asm's ($224A, $2260, $2272, checked against the bytes). The mth0.asm callers listed in the slice refer to mth0's own labels.
- (kernel-5) GetEscQKey and errbanner also exist in gn/gnerror.asm as separate module-local copies; the gnerror callers in the slice are not callers of these. Likewise cmd_up/cmd_down's apps/index/index.asm callers are Index's own labels.
- (kernel-5) This ROM is the slot 0 build: getAppHandle has no OZ_SLOT1 code (checked in the bytes at $9C16).
- (kernel-5) mnu_menu2 and mnu_smenu2 do not test mnu_m2's Fc before inc (hl) / dec (hl); HL is then whatever the topic lookup left. mnu_menu tests Fc only afterwards. Recorded, not called a bug.
- (kernel-5) GetEscQKey only ever returns with Fz = 1, so NQVoz's 'jr nz, fatal_err_wait_key' never loops.
- (kernel-5) help_help / help_right reach MTH_Topic, which runs InitHlpActiveCmd (A = 1) first; the topic number GetFirstTopicHelp returned in A is not stored, so which topic shows depends on DrawTopicHelpWd (mth0, not traced).
- (kernel-5) OZRevision's value ($0603C979) is read from the ROM bytes at $9E36.
- (kernel-6) GetCmdAttrByNum (1:10377) does not test Fc after GetRealCmdPosition: when that fails (start or end of the topic) B, C, HL are still read and returned with Fc = 1; only a missing topic returns early with A = 0. On that early path DE comes back as the caller's IX (IX is used to carry DE across OSBoxS1).
- (kernel-6) OSSpMain/OSNqMain accept high bytes $8D and $8E, which land inside the last JP/inline code of OSSpTable/OSNqTable rather than on an entry; only $80, $83, $86, $89, $8C are real reasons.
- (kernel-6) ResetWdAttrs (1:12799): the source comment says Fz = 0, but cp a leaves Fz = 1; the synopsis says Fz = 1.
- (kernel-6) GetPrvNonInfoTpc (1:10451) searches upwards from A-1, so it returns the previous non-INFO topic only when A-1 itself is not an INFO topic.
- (kernel-6) Key2Chr_tbl, Chr2VDU_tbl and VDU2Chr_tbl are one table at $B4E1 (90 entries, to $B648) seen through three columns; it has no terminator in key2chrt.asm, the zero bytes at $B649 end the Chr2ScreenCode search.
- (kernel-6) CheckFit (1:11286): when the given length is 255 SpPanel skips writing the attribute (the old one is still dropped), which looks like the way to reset a setting to its default; inferred from SpPanel, not documented.

## GN, DC and Index, the FPP: banks 3, $0C and $0D (2026-11-15)

- (gn-1) gdt_0 (3:1173): GNGdt pushes IX and then the old S1 binding before 'call gdt_0', and gdt_0 pushes nothing before gdt_4's 'ex (sp), ix', so for a handle or filter source (HL < 2) ReadOsfHL appears to get gdt_0's return address as IX, not the caller's IX. The OZ 4.0 layout (no S1 wrapper) had the caller's IX at (sp). Confirmed in the bytes at $C482-$C4BC; not run. Synopsis does not mention it.
- (gn-1) pdtFlw (3:1981): its error path drops one return address. That is right when called from pdt_0 or tail-jumped from pdtPutDoM/pdtPutMon, but pdtpm_2 'call pdtFlw' is two levels below pdt_0, so a GN_Flw error there looks like it unwinds one level too few. Not stated in the synopsis.
- (gn-1) GetEscQKey (3:7235): both exits return Fz = 1, so GNErr's 'jr nz, escq_wait_key' and 'jr z, err_7' loops never repeat; written into the synopsis.
- (gn-1) flo_GetMaxBSize (3:4250): always returns Fc = 0, so GN_Flo's 'jr c, flo_4' (bad table) after it never fires.
- (gn-1) ReturnCrcPartial (3:13471): source comment says 'Fc = 0, Fz = 0' but 'cp a' gives Fz = 1.
- (gn-1) bix_s1s2 (3:6262): the source comment 'S1=caller S2' on the HL-in-S3 path is wrong; the code binds caller S3 into S1 and keeps the current S2.
- (gn-1) GN_ret1b/1c/0: described by which values reach the caller (frame copies vs function registers); the exx bookkeeping inside OZCallReturn0/1 was not traced further.
- (gn-1) die_17 / AddYearDays: the 'leap year flag' copied into B' is bit 0 of the main B (the rule loop counter) per the source comments; not verified beyond that.
- (gn-1) InvCaseTable_end (3:6161) shares its address with SipExtended_tbl (no separate label in the slice).
- (dc-1) The command table main_3 has a 0 word for code 9 (cmd_purge, removed): MainLoop does not filter it, so command code 9 would jump to address 0.
- (dc-1) FreeCli frees the head of eIdxCliList (the newest CLI), not necessarily the CLI in IY; sub_D0D1 relies on the CLI in IY being the head, as GetCLI binds the head.
- (dc-1) FreeCli leaves the freed CLI's bank bound in S1; its callers restore S1 themselves.
- (dc-1) OpenBootCli: if DC_Icl fails the file is closed and Fc follows OS_Cl, so Index then does not try the EPR Boot.cli (index.asm:152 'jr nc, IndexReEntry').
- (dc-1) Callers listed for MainLoop, main_2, main_3, RemoveHighlight, ApplyA, DisplayCard, ZeroMem and GetLinkCDE include same-named labels in other banks' applications (filer, calculator, panel, flashstore); the synopses describe the bank $0C code only.
- (dc-1) Screen driver codes used here were checked in os/scrdrv1.asm (ScrDrvCmdTable): 1,"2C",$FE clears to the end of the window, $FD to the end of the line; 1,$FF scrolls up; 1,"2A",n applies the toggled attributes (ApplyScrAttr).
- (dc-2) DispFreeRamMap's pixel factor loop (freeram.asm factor_loop) rotates 8 right once per bank above one, so it gives 4 for a 2-bank card (correct, 8/2) but 1 for a 4-bank (64K) card where 8/4 = 2 is intended; odd sizes give other values. The synopsis states what the code does, not the comment's '8/card size'.
- (dc-2) DoInstall's bank loop (install.asm ci_allocmem_1: inc c; cp 7) stops when C reaches 7, so only AP0-AP6 are loaded although the comments say 0-7 and up to 8 banks are accepted. The synopsis says 'each bank entry' and step 4 does not claim AP7.
- (dc-2) The slice lists os/ossi0.asm:669/677 as callers of ConvHexNibble; ossi0.asm has its own ConvHexNibble (ossi0.asm:684), so those are a name collision, not callers of this bank $0C routine.
- (dc-2) CfgFilename is ':RAM.?/ozs?-*.upd' although the comments and cfgsyntax2_msg still say 'ozupdate.cfg'; the synopsis records both.
- (dc-2) Window block layout (InfoWdBlock, InstallWdBlock, RemoveWdBlock, UpdateWdBlock) is read from gn/gnwin.asm's GN_Win header: byte 0 = flags|ID, then X, Y, width, height, banner pointer.
- (dc-2) DC_Pol contract taken from dc/dc.asm: A bit 7 set tests the application handle in IX; Fz = 1 when not in use. GN_Cl returns IX = 0 (gn/gnfile.asm header), used for CloseCfgFile/ci_CloseFile exits.
- (dc-2) Changes: lines were left out for routines whose OZ calls (OS_Pout, GN_Win, OS_Hout) I did not trace beyond their headers; DispCardSizeClmn's 'no cursor no scrolling' source comment for 1,'2+T' was not repeated.
- (fp-1) Number format, as the code uses it: HLhlC (DEdeB) with H the top byte and l (e) the alternate low byte. C = 0: a 32-bit two's complement integer in HLhl. C <> 0: a float of value 1.m * 2^(C - $80) (the Developers' Notes' 0.1m * 2^(C - 127)), the mantissa's top 1 implied and H bit 7 holding the sign; 1.0 = 0,0,0,0,$80; pi = $490FDAA2, $81. In memory (LdDEdeB_IX, the series tables): l, h, L, H, exponent. On the stack (PushHLhlC): BC, HL, hl', six bytes.
- (fp-1) Errors inside the FPP jump to FPError, which resets SP from IY (the frame FPPmain built in os/lowram/rst.asm) and returns from the FP call with Fc = 1, A = RC_xxx; the internal routines' Error lines say this. Success returns through the $C000 return address FPPmain pushes (cp a: Fc = 0).
- (fp-1) Division, sub_0_E40E (multiply), sub_0_E441 and sub_0_E47A (square root) and loc_0_E3FB are called with the alternate register set active: their first operations act on the low halves. Their contracts name the registers in the usual sense (HLhl with H the top byte).
- (fp-1) div_2 (not in this slice) is the integer multiply that FPMul reaches when both operands are integers; its name is from the reverse engineering and is misleading.
- (fp-1) FPMul's callers listed in the slice are apps/calculator/calc.asm's own FpMul (a case-insensitive name match), not this routine.
- (fp-1) FPMod/FPIdv (mod_1) have no zero-divisor check, unlike div_1 (RC_Dvz). Not run; read from the code.
- (fp-1) Possible bug, read from the code and not run: sub_0_E13A keeps the exponent's sign character in AF' (ex af,af' after GetNumStart) while ReadNum -> ReadByteIX replaces A' with the old BLSC_SR1 when IX is in segment 3, so 'E-n' in a string in segment 3 could lose its minus sign.
- (fp-1) sub_0_E37D's tables end with a coefficient of exponent $80 or $81 (1.0 or 2.0): the routine returns onto those five bytes, which execute as NOP x4 and ADD A,B / ADD A,C. This is why the last coefficient doubles as the terminator.
- (fp-1) Thresholds checked numerically: $3504F333 at $80 = sqrt 2 (FPLn), $5413CCD0 at $7E = tan(pi/8), $1A82799A at $81 = tan(3*pi/8) (FPAtn), $3172:$17F8 with bc' $D1CF = 48-bit ln 2, $490FDAA2 with bc' $2169 = pi/4.

## Bank 2 (keymaps, LOWRAM, date filter) and MTH, bank 8 (2026-11-15)

- (b2-1) Fonts (HIRES1, LORES1) and the flash chip routines have no labels in this slice; nothing written for them.
- (b2-1) z88-dis.cjs fails with 'offset is out of bounds' for PAGE=2 on the LOWRAM range ($0800-$0BCB, run at $0000); the LOWRAM synopses are written from os/lowram/*.asm, the table counts from the ROM bytes.
- (b2-1) OZCallReturnCommon (unlabelled tail, after OZCallReturnFP): after restoring S3 it does DEC (ubAppCallLevel) before EX AF,AF', so the 'CALL Z,OZErrorHandler' tests the Z flag of that DEC: the error handler runs only when the call level drops to 0 (outermost call) and the stacked copy has Fc = 1 (SCF in Return1-FP; OR A in Return0, so Return0 never calls it). The source comment 'restore S2S3' is loose: only S3 is written there.
- (b2-1) DefErrHandler: Fz = 1 meaning 'fatal' follows CallErrorHandler (os/error.asm): handler returning Fc = 1 shows GN_Err and retries, Fc = 0 with Fz = 1 returns the error. process0.asm installs DefErrHandler + 1 (CP A; RET) when the DOR has AT2_Ie.
- (b2-1) The end_DateFltr_xx labels sit at the start of the next country's DateFilter_xx (same address); the synopses say both. Filter order in the bank: UK, FR, DK, NO, SE, FI, IT, ES, DE (lengths checked against each table's length word).
- (b2-1) Keymap country use comes from KeymapTable in os/spnq1.asm (UK keymap also for US, IS, JP, TR; FR for CH; DK for NO; FI for SE).
- (mth-1) Token texts are the full expansions, worked out by expanding nested tokens from the defm lines of mth/systoken.asm; byte counts are the stored lengths (offset differences), and they match the slice offsets.
- (mth-1) The bracketed numbers in the source comments (e.g. " returns " (19)) are not explained in the source; they may be usage counts, so they are left out.
- (mth-1) Token $80 ($01,"T") is described as the tiny-font toggle from its use in mth/appmth.asm ("A ",$80,"FAIL",$80) and the SOH "T" font sequences in gn/gnwin.asm; the VDU code itself is not defined in def/.
- (mth-1) The slice covers only SysTokenBase and tokens $80-$D8; tokens $D9-$FF and end_tokens are not in it.
- (mth-2) Tokens $D9-$FF: each token's text and length come from the SysTokenBase offset table (length = next offset - this one; end_tokens closes $FF). Expansions were computed from the ROM bytes and match the source comments. OS_Wrt/WriteToken (os/token.asm) expands bytes $80-$FF, recursively, and prints $7F as CR LF.
- (mth-2) The help-page texts were detokenised from the ROM; where a page is long the synopsis quotes its first sentence and summarises the rest.
- (mth-2) DOR names are the source labels in mth/appdors.asm (PrEdDOR, EasyLinkDOR and FlashstoreDOR are spelt that way there); they are in another slice, so check the sidecar spells them the same.
- (mth-2) Command counts per topic were counted by walking the records in the ROM (length byte at both ends), hidden = CMDF_HIDDEN ($04).
- (mth-2) The application's topic blocks (IndexTopics etc.) and the remaining FlashStore help pages (cmd_fe_help ... cmd_ffa_help) are not in this slice.
- (mth-3) All 90 labels are data. The help texts were decoded with the token table (mth/systoken.asm); $7F expands to CR LF (os/token.asm, OSWrt) and $00 ends a page. The quoted texts are the decoded expansions.
- (mth-3) The preference defaults are indexed by the low byte of the PA_xxx reason (def/syspar.def): PrefTbl1 for $00-$5A, PrefTbl2 (bit 7 set, masked) for the ISO translations PA_Tr10 onwards. A value's length is the next entry minus its own, so several unused or empty reasons share one label with length 0; each synopsis names the reasons that share its address.
- (mth-3) Readers: GetDefPrefDest (NqPanel's default path, when no saved panel value exists) and CheckFit, both in os/spnq1.asm, bind bank MTH_BNK into S1 to read the tables.
- (mth-3) The printer escape bytes are described as bytes and ESC sequences; I named the Epson meaning only for highlights where the panel name gives it (bold, italics, and so on), and did not name the international character sets ESC R n selects.
- (mth-3) defTr10 is commented N with tilde in the source but its value is 208; in ISO 8859-1 208 is Eth and 209 is N with tilde. I kept the source's comment and flagged it in the text; worth a check.
- (mth-3) FlashStore's cmd_*_help pages are named by the commands' menu names from FlashStoreCommands (FE Erase File from Card, BF Backup Files from Ram, RF Restore Files to Ram, FFA Format File Area, TFV Toggle File View, FC Copy all Files to Card). The application wording pattern used: "<App>'s help pages: ..." for a main help page, "<App>'s help page for the <>XX command (...)" for a command's page, "<App>'s application DOR" for the DORs.
- (mth-4) The slice holds no application DORs: it is the tail of preftbl.asm (defTr14-defTr38, Tr13out-Tr38out) and the error strings of errtbl.asm, so the DOR wording pattern was not used.
- (mth-4) PrefTbl1/PrefTbl2 are tables of one-byte offsets from the table's start; an entry's length is the next offset minus its own (no terminators). Readers: os/spnq1.asm GetDefPrefDest (OS_Nq panel default, C bit 7 selects PrefTbl2) and CheckFit (OS_Sp).
- (mth-4) TrNout strings are ESC R n, c, ESC R 0 (Epson international character set select, per the source's 'Epson FX-80 compatible' comment); I did not name the country of each set n, since sets 11, 14 and 15 are beyond the FX-80's documented 0-8 and I could not verify them.
- (mth-4) ErrStr_tbl entries are 4 bytes: code, flags (Z80F_Z = fatal), word pointer; GN_Esp (gn/gnerror.asm GNEsp/FindErrStr) puts the flags into the caller's F and returns BHL with B = MTH_BNK. Fatal codes: RC_Unk, RC_Bad, RC_Ms, RC_Err (all Internal_err), RC_Na, RC_Hand, RC_Type.
- (mth-4) The source's ISO 8859-1 comments are mojibake in the slice (UTF-8 read as Latin-1); the character names come from the defb values, written in ASCII words.
