rtvc full web emulator

This directory contains the full browser version of rtvc, built with:

  cargo xtask bundle-web-full docs

It opens the normal emulator UI in a browser and can load local CAS, DSK, ZIP,
and snapshot files through the app menus.

Example:

  python -m http.server 8000

Then open:

  http://localhost:8000/
