#include <arch/zx/spectrum.h>

int main()
{
  zx_cls();
  zx_border(4);
  zx_setpaper(2);
  zx_setattrbright(1);
  zx_movecursorto(10,14);
  zx_printf("Welcome to Klive IDE - Using Z88DK");
  return 0;
}