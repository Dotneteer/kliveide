#pragma codeseg BANK_1

int banked_add(int a, int b) __banked
{
    return a + b;
}
