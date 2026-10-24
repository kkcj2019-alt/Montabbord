Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\KKCJ-10e\Desktop\2409\Montabbord\"
sh.Run """C:\Program Files\nodejs\node.exe"" ""C:\Users\KKCJ-10e\Desktop\2409\Montabbord\auto-deploy.js""", 0, False
