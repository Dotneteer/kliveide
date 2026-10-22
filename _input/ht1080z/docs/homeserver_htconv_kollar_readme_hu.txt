
HTCONV v1.1a
----------------------------------------------------------------

Ez a program a különbözö HT állományok konvertálására készült.

A következõ állományok nyithatók meg:
-------------------------------------
Basic tokenizált fájlok CAS és BAS formátumai. A BAS formátum
csak a fejlécben különbözik a CAS-tól, a trs-80.com oldalon
ezt használják. Ennek a fejléce csak 1 db FFh karakter, míg a
CAS formátumú A5h D3h D3h D3h fn. (fn 1 karakter fájlnév).

Assembler forrásfájl CAS és ASM formátumai. Az EDTASM formátuma
támogatott. Az ASM formátumot használják a trs-80.com oldalon,
a különbség csak a fejlcben van, ebben nincs A5h karakter, a
D3h karaktertõl megegyezik a CAS-al.

CAS programfájlok (A5h 55h -val kezdõdik)

CMD programfájlok

Textfájlok

Mit mire lehet konvertálni:
---------------------------
Basic tokenizált fájlokat text fájlra és fordítva.
Assembler forrásfájlokat text fájlra és fordítva.
CAS fájlokat CMD formátumra és fordítva.

Formázás:
---------
Basic tokenizált állományok formázására van némi lehetõség:

COMPRESS: A kódból el lehet távolítani a space karaktereket, 
ez némileg gyorsítja a program futását, de inkább a memória 
miatt lehet érdekes (kevesebb helyet foglal a program, több 
hely marad a változóknak)

FORMAT: A kódba space karaktereket illeszt a parancsok elé
és után, igy könnyebben olvasható a program.

A text fájlok kis- ill. nagybetûsre konvertálhatól, kivéve a 
stringeket, azok sem a basic sem az assembler listákban nem
változnak. (Csak kényelmi szempontból érdekes, ki hogy szereti)

Parancsok:
----------
A parancsok az alsó ablakban a Command prompt után írhatók be.
Nem kell kiírni a teljes parancsot, legtöbbnél elég az elsõ 
betû ís, ill. annyi, amennyi megkülönbözteti a másik parancstól.
Kis és nagybetûvel egyaránt írhatók.

load filename.ext	- Fájl betöltése. Automatikusan megálla-
			  pítja a fájl típusát.

save filename.ext	- Fájl mentése. A típusnak megfelelõ
			  formátumban menti a fájlt.

compress		- Eltávolítja a basic fájlból a space
			  karaktereket.

format			- Basic fájlok formázása

toupper			- Text fájl nagybetûsre konvertálása

tolower			- Text fájl kisbetûsre konvertálása

output asm		- Text fájl EDTASM formátumra alakítása.
output bas		- Text fájl tokenizált basic-re alakítása.
output cas		- CMD fájl CAS formátumúra,
output cmd		- CAS fájl CMD formátumúra konvertálása.
output txt		- EDTASM vagy Basic fájl text formátumra.

exit			- Kilépés

? vagy help		- Help képenrnyõ

Billentyûk:
-----------
A fájlok tartalma a felsõ ablakban látható. A szövegfájlok a fel-le
nyilakkal srollozhatók, vagy a PgUp/PgDn-el lapozhatók. A CAS és CMD
fájlok rekordjai a PgUp/PgDn-el válthatók.

Az ESC gombbal megszakítható a parancssor, ill. ha az üres, akkor az 
EXIT utasítást ajánlja fel.

Parancssor:
-----------
Nagyobb mennyiségû adatok konvertálásához lehetõség van batch fájlból 
futtatni a programot. Ekkor nem jelennek meg a párbeszédablakok. Az
exit parancs használatára ilyenkor nincs szükség.

Néhány példa:

htconv load galaxy.cmd output cas save galaxy.cas
htconv load soundeff.asm output txt tolower save soundeff.txt
htconv load proba.txt output bas compress save proba.bas
htconv load szamok.bas format output txt save szamok.txt

ugyanezek rövidebben:

htconv l galaxy.cmd o cas s galaxy.cas
htconv l soundeff.asm o t tol s soundeff.txt
htconv l proba.txt o b c s proba.bas
htconv l szamok.bas f o t s szamok.txt

Kollár Zoltán, zka@freemail.hu

