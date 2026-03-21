program KliveWelcome;

var
  Greeting: String;
  Source: String;

procedure PrepareGreeting;
begin
  Greeting := 'Welcome to Klive IDE';
  Source := 'Using PASTA-80';
end;

begin
  PrepareGreeting;
  WriteLn(Greeting);
  WriteLn(Source);
end.