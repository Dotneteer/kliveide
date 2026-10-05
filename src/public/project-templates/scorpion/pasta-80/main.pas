program KliveWelcome;

var
  Greeting: String;
  Source: String;

procedure PrepareGreeting;
begin
  Greeting := #22#10#06#17#4'Welcome to Klive IDE';
  Source := #22#11#08#19#01'(Using PASTA-80)';
end;

begin
  PrepareGreeting;
  WriteLn(Greeting);
  WriteLn(Source);
end.