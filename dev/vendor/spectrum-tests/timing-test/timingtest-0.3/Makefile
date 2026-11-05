# gmake

NAME = timingtest
VERSION = 0.3
PKG := $(NAME)-$(VERSION)

PROGS := timing

all: $(addsuffix .tap,$(PROGS))

timing.out: timing.asm codetime.asm frametime.asm interrupt.asm delay.asm getvar.asm setvar.asm

%.out : %.asm
	sjasmplus --nologo $<

%.tap : %.bas %.out
	mktap -b $(basename $(word 1,$^)) 9000 <$(word 1,$^) >$@
	mktap    $(basename $(word 2,$^)) 40000 <$(word 2,$^) >>$@

FILES := Makefile $(addsuffix .asm,$(PROGS)) $(addsuffix .bas,$(PROGS)) $(addsuffix .tap,$(PROGS)) \
	$(addsuffix .asm, codetime frametime interrupt delay getvar setvar)

dist:
	ln -s . $(PKG)
	tar czf $(PKG).tar.gz --group=root --owner=root $(addprefix $(PKG)/, $(FILES))
	zip $(PKG).zip $(addprefix $(PKG)/, $(FILES))
	rm $(PKG)

clean:
	rm -rf *.out *.tap

tidy: clean
	rm -rf $(PROGS)
