Cambridge Z88 OZ 4.7 ROM annotations (z88v47.rom.dis)

z88v47.rom.dis annotates the Cambridge Z88's OZ 4.7 ROM (z88v47.rom): the labels,
routine descriptions, comments and data regions the IDE shows over the ROM's banks.
Most of it is taken from the OZ project's own assembler source, aligned with the
ROM's bytes by Klive's importer (dev/scripts/import-oz-source.cjs):

  Repository  https://bitbucket.org/cambridge/oz
  Tag         V4.7
  Commit      603c979ac7ae9b23fe3f3feb7cae54c5a595d183

The OZ source is GPL v2 software, the result of many years of work by the Cambridge
Z88 developers: among them Gunther Strube, Thierry Peycru and Jorma Oksanen, who
reverse engineered, re-implemented and extended OZ. The original binary
implementation is (C) 1987, 1988 Trinity Concepts Limited, Protechnic Computers
Limited and Operating Systems Limited.

Permission: Gunther Strube gave the Klive IDE project this permission, recorded on
2026-11-15:

  "I, Gunther Strube, allow the Klive IDE project to use the Cambridge Z88 OZ
  source code to be publicly used in the ROM annotations."

Entries taken from the source carry the provenance "source" in the file, which names
the repository, tag and commit in its "sourceCode" key. The other entries (labels the
source does not have, region boundaries found from the bytes) are Klive's own work.
Bank 9, BBC BASIC (R.T. Russell's binary, which has no source in the repository), is
not annotated.

This notice covers the annotation file only. It says nothing about the ROM images
themselves (z88*.rom).
