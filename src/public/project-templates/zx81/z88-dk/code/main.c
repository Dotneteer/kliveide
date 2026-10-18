#include <stdio.h>

/* Built by z88dk (sccz80, classic library) for this machine. Set breakpoints on the lines
   below and press Debug: Watch shows `counter`, the Variables panel the locals. */

int counter;

int square(int value)
{
    int result = value * value;
    return result;
}

int main(void)
{
    printf("Welcome to Klive IDE - z88dk\n\n");
    for (counter = 1; counter <= 5; counter++) {
        printf("%d squared is %d\n", counter, square(counter));
    }
    return 0;
}
