Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "D:\MONTABBORD"
sh.Run """C:\Program Files\nodejs\node.exe"" ""D:\MONTABBORD\auto-deploy.js""", 0, False
