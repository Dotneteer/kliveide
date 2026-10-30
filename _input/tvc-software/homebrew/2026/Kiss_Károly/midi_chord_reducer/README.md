# MIDI Chord Reducer

Ez a program MIDI fájlokat elemez, és az összetett akkordokat (amelyeknél 3-nál több hang szól egyszerre) leegyszerűsíti a megadott beállítások alapján. Emellett a dob sávot (channel 10) automatikusan kiszűri a végeredményből. 

A kimenetet el lehet menteni leegyszerűsített MIDI fájlként, vagy kiexportálható szöveges (Assembler DB) formátumban is!

## Funkciók

- **Akkordok egyszerűsítése**: Max 3 hangból álló akkordokká alakítja a zenét.
- **Módok**:
  - 1: Csak alaphang
  - 2: Alaphang + kvint (Power chord)
  - 3: Alaphang + terc
- **Prioritás**: Kiválasztható, hogy a legmagasabb (dallam), a középső, vagy a legmélyebb (basszus) hangot őrizze-e meg mindenképp.
- **Dob sáv szűrés**: A MIDI Channel 10 (dobok) automatikusan eltávolításra kerülnek a kimenetből.
- **Szöveges Export (ASM)**: A redukált zene adott lépésközönként (pl. negyedenként, nyolcadonként) szöveges formátumba exportálható.
  - A formátum: `db hang1, hang2, hang3` (pl. `db C4, FISZ4, MUTE`)
  - Magyar zenei hangnevekkel (C, CISZ, D, DISZ, E, F, FISZ, G, GISZ, A, AISZ, B).

## Telepítés

A környezet legegyszerűbben az **`install.bat`** fájl futtatásával telepíthető.
A telepítő ellenőrzi a Python meglétét, és ha nincs, akkor telepíti (winget segítségével), majd letölti a szükséges kiegészítő modulokat (`mido`).

Kézi telepítés Pythonból:
```cmd
pip install -r requirements.txt
```

## Használat

A program elsősorban grafikus felülettel használható. Indításhoz kattints rá duplán, vagy futtasd az alábbi parancsot:
```cmd
python gui.py
```

Lehetőség van parancssoros futtatásra is, ha kötegelt feldolgozásra (scriptelésre) lenne szükség:
```cmd
python midi_chord_reducer.py bemenet.mid -m 1 -o kimenet.mid
```