/* A Cambridge Z88 application built by z88dk (sccz80, classic library). Run inserts the card
   z88dk writes into slot 3, restarts the Z88 and starts the application with the Square key
   and APP_KEY. Set breakpoints on the lines below and press Debug to stop in them. */

#include <dor.h>
#define APP_NAME "Klive C"
#define APP_INFO "Made with Klive IDE"
#define APP_KEY 'K'
#include <application.h>

#include <stdio.h>

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
    getchar();
    return 0;
}
