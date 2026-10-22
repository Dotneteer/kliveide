#include <stdio.h>

/* A Next program that prints with printf: z88dk v2.4 links printf's format table into the classic
   Next startup's init code, so Klive warns about this build (`.ai/z88dk/targets.md`). */

int counter;

int main(void)
{
    for (counter = 1; counter <= 3; counter++) {
        printf("%d\n", counter);
    }
    while (1) {
    }
}
