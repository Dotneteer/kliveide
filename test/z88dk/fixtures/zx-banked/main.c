extern int banked_add(int a, int b) __banked;

int counter;

int main(void)
{
    counter = banked_add(3, 4);
    return 0;
}
