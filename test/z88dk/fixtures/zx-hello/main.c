#include <stdio.h>

int counter;

struct point { int x; char y; };
struct point pt;

int add(int a, int b)
{
    int s = a + b;
    return s;
}

int main(void)
{
    counter = add(3, 4);
    pt.x = counter;
    printf("Hello %d\n", counter);
    return 0;
}
