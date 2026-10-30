2 mapaddr = 30000
3 dim snakex(200)
4 dim snakey(200)
5 graphics 16
6 randomize
7 setpaper 0
8 setcharacter 180, 60, 102, 231, 255, 255, 254, 124, 56, 0, 0
9 setcharacter 181, 60, 102, 231, 255, 255, 127, 62, 28, 0, 0
10 setcharacter 182, 24, 60, 102, 231, 255, 255, 126, 60, 0, 0
11 setcharacter 183, 60, 126, 255, 255, 231, 102, 60, 24, 0, 0
12 setcharacter 184, 24, 60, 126, 126, 126, 126, 60, 24, 0, 0
13 setcharacter 185, 255, 129, 165, 165, 165, 129, 255, 129, 0, 0
14 setcharacter 186, 24, 24, 60, 126, 255, 255, 126, 60, 0, 0
15 setcharacter 190, 60, 126, 255, 255, 255, 255, 126, 60, 0, 0
16 setcharacter 191, 0, 126, 255, 195, 195, 255, 126, 0, 0, 0
17 setcharacter 192, 0, 0, 24, 60, 126, 60, 24, 0, 0, 0
18 setcharacter 193, 60, 126, 219, 255, 255, 126, 24, 24, 0, 0
19 cls
20 setink 14
21 printat 3, 1: chr$(193)
22 printat 3, 2: chr$(190)
23 printat 3, 3: chr$(190)
24 printat 3, 4: chr$(191)
25 printat 4, 4: chr$(190)
26 printat 5, 4: chr$(191)
27 printat 6, 4: chr$(190)
28 printat 6, 5: chr$(190)
29 printat 6, 6: chr$(191)
30 printat 7, 6: chr$(190)
31 printat 8, 6: chr$(191)
32 printat 9, 6: chr$(190)
33 printat 9, 7: chr$(190)
34 printat 9, 8: chr$(192)
35 setink 10
36 printat 12, 3: "K Ç G Y É"
37 setink 15
38 printat 15, 1: "1 - Kezdo"
39 printat 16, 1: "2 - Nehez"
40 k$ = inkey$
41 if k$ = "1" then gamemode = 1: goto 44
42 if k$ = "2" then gamemode = 2: goto 44
43 goto 40
44 cls
45 setink 15
46 printat 10, 3: "Betîltës..."
47 for i = 0 to 319
48 poke mapaddr + i, 0
49 next
50 cls
51 x = 7
52 y = 10
53 dx = 1
54 dy = 0
55 score = 0
56 lepes = 0
57 oldx = 0
58 oldy = 0
59 snakelength = 5
60 snakehead = 0
61 snaketail = 0
62 for i = 0 to 4
63 snakex(i) = 7 - i
64 snakey(i) = 10
65 next
66 if gamemode = 1 then speed = 5
67 if gamemode = 2 then speed = 2
68 gosub 133
69 setink 15
70 printat 1, 1: "Pont:"
71 gosub 107
72 addr = mapaddr + y * 16 + x
73 cell = peek(addr)
74 if cell = 1 then goto 149
75 if cell = 2 then gosub 115
76 poke addr, 1
77 snakehead = snakehead + 1
78 if snakehead > 199 then snakehead = 0
79 snakex(snakehead) = x
80 snakey(snakehead) = y
81 if snakehead - snaketail >= snakelength then gosub 125
82 if oldx > 0 then setink 14: printat oldy + 2 + 1, oldx + 1: chr$(184)
83 setink 14
84 headchar = 180
85 if dx = -1 then headchar = 181
86 if dy = -1 then headchar = 182
87 if dy = 1 then headchar = 183
88 printat y + 2 + 1, x + 1: chr$(headchar)
89 oldx = x
90 oldy = y
91 lepes = lepes + 1
92 score = lepes
93 setink 15
94 printat 1, 7: score
95 for d = 1 to speed
96 k$ = inkey$
97 if k$ = "w" and dy = 0 then dx = 0: dy = -1
98 if k$ = "s" and dy = 0 then dx = 0: dy = 1
99 if k$ = "a" and dx = 0 then dx = -1: dy = 0
100 if k$ = "d" and dx = 0 then dx = 1: dy = 0
101 next
102 x = x + dx
103 y = y + dy
104 if x < 0 or x >= 15 then goto 149
105 if y < 0 or y >= 16 then goto 149
106 goto 72
107 foodx = rnd(15 - 2) + 1
108 foody = rnd(16 - 2) + 1
109 foodaddr = mapaddr + foody * 16 + foodx
110 if peek(foodaddr) <> 0 then goto 107
111 poke foodaddr, 2
112 setink 10
113 printat foody + 2 + 1, foodx + 1: chr$(186)
114 return
115 snakelength = snakelength + 3
116 foodx = rnd(15 - 2) + 1
117 foody = rnd(16 - 2) + 1
118 foodaddr = mapaddr + foody * 16 + foodx
119 if peek(foodaddr) <> 0 then goto 116
120 poke foodaddr, 2
121 setink 10
122 printat foody + 2 + 1, foodx + 1: chr$(186)
123 sound pitch 800, volume 10, duration 1
124 return
125 tx = snakex(snaketail)
126 ty = snakey(snaketail)
127 tailaddr = mapaddr + ty * 16 + tx
128 poke tailaddr, 0
129 printat ty + 2 + 1, tx + 1: " "
130 snaketail = snaketail + 1
131 if snaketail > 199 then snaketail = 0
132 return
133 setink 6
134 for i = 0 to 15
135 printat 2, i: chr$(185)
136 poke mapaddr + 0 * 16 + i, 1
137 next
138 for i = 1 to 16
139 printat i + 2, 0: chr$(185)
140 poke mapaddr + i * 16 + 0, 1
141 printat i + 2, 15 : chr$(185)
142 poke mapaddr + i * 16 + 15 , 1
143 next
144 for i = 0 to 15
145 printat 16 + 2 + 1, i: chr$(185)
146 poke mapaddr + (16 + 1) * 16 + i, 1
147 next
148 return
149 sound pitch 400, volume 15, duration 5
150 cls
151 setink 14
152 printat 8, 2: " JÄTÅK VÅGE!"
153 printat 10, 3: "Pont:"
154 printat 10, 8: score
155 printat 12, 2: "SPACE - Menó"
156 k$ = inkey$
157 if k$ <> " " then goto 156
158 cls
159 setink 14
160 printat 3, 1: chr$(193)
161 printat 3, 2: chr$(190)
162 printat 3, 3: chr$(190)
163 printat 3, 4: chr$(191)
164 printat 4, 4: chr$(190)
165 printat 5, 4: chr$(191)
166 printat 6, 4: chr$(190)
167 printat 6, 5: chr$(190)
168 printat 6, 6: chr$(191)
169 printat 7, 6: chr$(190)
170 printat 8, 6: chr$(191)
171 printat 9, 6: chr$(190)
172 printat 9, 7: chr$(190)
173 printat 9, 8: chr$(192)
174 setink 10
175 printat 12, 3: "K I G Y O"
176 setink 15
177 printat 15, 1: "1 - Kezdo"
178 printat 16, 1: "2 - Nehez"
179 goto 40
180 end
