#include <stdio.h>

/* Built by z88dk (sccz80, classic library) for this machine. Set breakpoints on the lines
   below and press Debug: Watch shows `counter`, the Variables panel the locals.

   This program prints with putchar, not printf: in z88dk v2.4 the Next's classic startup code
   runs into printf's format table, so a program that uses printf may fail to start. */

int counter;
int squared;

int square(int value)
{
    int result = value * value;
    return result;
}

/* Prints text without a newline */
void print_text(char *text)
{
    while (*text) {
        putchar(*text++);
    }
}

/* Prints a number that is not negative, digit by digit */
void print_number(int number)
{
    if (number >= 10) {
        print_number(number / 10);
    }
    putchar('0' + number % 10);
}

int main(void)
{
    print_text("Welcome to Klive IDE - z88dk\n\n");
    for (counter = 1; counter <= 5; counter++) {
        squared = square(counter);
        print_number(counter);
        print_text(" squared is ");
        print_number(squared);
        putchar('\n');
    }
    /* A .nex program has nowhere to return to: .nexload starts it with the stack from the NEX
       header and no return address, so returning from main would crash and reset the machine.
       Stay here instead (a soft reset, NextReg $02 = 1, would go back to NextZXOS). */
    while (1) {
    }
}
