Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\ACSER DIRECTION\Documents\Default Project\Montabbord\"
sh.Run """C:\Program Files\nodejs\node.exe"" ""C:\Users\ACSER DIRECTION\Documents\Default Project\Montabbord\auto-deploy.js""", 0, False
