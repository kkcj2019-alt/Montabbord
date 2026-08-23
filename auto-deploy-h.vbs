Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "D:\bure\MontabborSupabase"
sh.Run """C:\Program Files\nodejs\node.exe"" ""D:\bure\MontabborSupabase\auto-deploy.js""", 0, False
