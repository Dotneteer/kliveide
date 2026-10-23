# HT-1080Z sample files

Real HT-1080Z software, kept as test fixtures for the tape file viewer and the tape loader
(`test/ht1080z/sample-files.test.ts`, `test/ht1080z-hw/sample-files.test.ts`). Unlike the rest of
the HT-1080Z tests, whose programs were written for them, these are third-party files: the project
author chose to commit them, accepting the licensing risk, on 2026-10-23.

All five come from the HT-1080Z archive at <https://ht.homeserver.hu/>, which gives no licence for
them. They were downloaded on 2026-10-23. The site's TLS certificate chain did not verify, so the
hashes below are the record of what was fetched.

| File | What it is | Source | Bytes | SHA-256 |
|---|---|---|---|---|
| `galaxy.cas` | *Galaxy Invasion* (© 1980 Bill Hogue & Jeff Konyu, Big Five Software), a SYSTEM tape: 37 blocks from $5B00, starts at $7FB0 | [bin/cas/sys/galaxy.cas](https://ht.homeserver.hu/bin/cas/sys/galaxy.cas) | 9,924 | `88614c246d064999fc6beee36828be79ae73801551ab7e7081c39c41e869f65f` |
| `galaxyld.cas` | The same game with a title and instructions screen loaded first, starts at $7FD4 | [bin/cas/sys/galaxyld.cas](https://ht.homeserver.hu/bin/cas/sys/galaxyld.cas) | 11,235 | `906712f31c2fea7ec947593c7da6faac4c7633d327a3345595d7355fea65ced0` |
| `amoeba.cas` | A BASIC (CLOAD) tape: a Hungarian two-player game, 30 lines | [bin/cas/amoeba.cas](https://ht.homeserver.hu/bin/cas/amoeba.cas) | 2,005 | `5e6d725a7f85d6ab8542320b6a4ea3614a2963559a392288f4b7aeb5e12d1238` |
| `android-nim.cas` | A BASIC tape: Android Nim, 329 lines | [bin/cas/android-nim.cas](https://ht.homeserver.hu/bin/cas/android-nim.cas) | 13,949 | `ac9807fbfcb138adf18d2879d495e975116c9ad97c800f89123c28962098e019` |
| `auto1.cmd` | A `.cmd` load module from the site's EDI project: 7 blocks at $7000-$76FF, starts at $7000 | [projekt/edi/auto1.cmd](https://ht.homeserver.hu/projekt/edi/auto1.cmd) | 1,824 | `7baa548ba769f6b07d5e8bb5dd4f3fec3578d0a45883bd4c59378b92f3d095e5` |

The archive has no tokenised `.bas` files; the one the tests use is
`scripts/doc-shots/recipes/ht1080z-demo.bas`, which the emulated Series II saved.

Do not edit these files: the tests pin what is in them.
