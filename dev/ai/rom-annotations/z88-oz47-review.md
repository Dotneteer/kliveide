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
