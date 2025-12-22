// Two minute program to generate a text representation of a binary file for initializing RAM blocks in vhdl.
// Alvin Albrecht 2020 for blaming purposes.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

unsigned char coe = 0;
unsigned char width = 8;

int main(int argc, char **argv)
{
   FILE *in;
   FILE *out;

   int i, c;
   unsigned char outfile[512];
   
   for (i = 1; i < argc-1; ++i)
   {
      if ((strcmp(argv[i],"-coe") == 0) && (coe == 0))
      {
         coe = 1;
      }
      else if ((argv[i][0] == '-') && ((width = (unsigned char)strtoul(&argv[i][1],NULL,10)) != 0))
      {
         if (width > 8)
            width = 8;
      }
      else
      {
         break;
      }
   }
   
   
   if ((argc < 2) || (i != (argc-1)))
   {
      printf("bin2txt [-coe] [-width] file\n");
      exit(0);
   }
   
   if ((in = fopen(argv[argc-1], "rb")) == NULL)
   {
      printf("File \"%s\" not found\n", argv[1]);
      exit(0);
   }
   
   strcpy(outfile, argv[argc-1]);
   strcat(outfile, coe ? ".coe" : ".txt");
   
   if ((out = fopen(outfile, "wb")) == NULL)
   {
      printf("Output file \"%s\" no good\n", outfile);
      fclose(in);
      exit(0);
   }
   
   if (coe)
   {
      fprintf(out, "memory_initialization_radix=2;\r\n");
      fprintf(out, "memory_initialization_vector=\r\n");
   }
   
   while ((c = fgetc(in)) != EOF)
   {
      for (i = (1 << (width-1)); i; i >>= 1)
         fputc((i & c) ? '1' : '0', out);

      if (coe)
      {
         if ((c = fgetc(in)) == EOF)
         {
            fputc(';', out);
         }
         else
         {
            fputc(',', out);
            ungetc(c, in);
         }
      }
      
      fputc('\r', out);
      fputc('\n', out);
   }
   
   fclose(in);
   fclose(out);
   
   return 0;
}
