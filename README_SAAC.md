# Character Select SAA Client v0.9.0 Beta
*That's all you asked for*

<img src="https://github.com/mirabarukaso/character_select_stand_alone_app/blob/main/examples/overall02.png" width=55%>   

## Start 
Start your SAA as normal, finish the setup wizard, then navigate to `http://localhost:58189/`     
Web Service/Ports/Addr can be modify in your `settings.json`.    

## Things you need to know
1. Report bug with a screenshot and instructions on how to reproduce it.    
2. Works on iPad Pro with keyboard case, for others who didn't have the keyboard case, `right menu` and `preview window drag` is not working.    
3. The `Characters thumb` is not cached because it takes too long to load. You may notice some lag/jitter with the list thumbnail preview. Also, `drag and drop image` will take more time to transfer back to host then decode to base64 and transfer back.        
4. Spell check is now browser-based, so I haven't disable the browser's right-click menu.    
5. I have already set up a `Mutex Lock` for SAAC. You may receive an error message if your backend is working and you send another `Generate` job from a different tab.    
6. Just in case, there is a `Skeleton Key` to unlock the `Mutex Lock`; click `Reload Model` on the left of the `Model List`.    
7. Start your Comfyui/WebUI API on `computer A`; start SAA on `computer B` and set API to `computer A`; connect SAAC from `computer C`...    
8. You can modify/save `SAAC Settings` in `Settings` tab, but be noticed this is for your `SAA host PC`      
9. Write to clipboard not working from remote with HTTP mode, added a info window to show those message. Check `HTTPS mode` to solve that problem. [More information](https://webkit.org/blog/10855/async-clipboard-api/)       

## HTTPS mode
You should always use HTTPS/WSS for security. The HTTP fallback is suitable for development or local usage only.     

Browers and Antivirus Software will Flag Self-Signed Certificates as "Not Secure".
Self-signed certificates are not issued by a trusted Certificate Authority (CA) like Let’s Encrypt, DigiCert, or GlobalSign. Browsers rely on a pre-installed list of trusted CAs to verify certificates. Since self-signed certificates are created by the user (or server admin), they aren’t in this list, triggering a warning.     
*The safety of self-signed certificates depends on the use case, in short it's safe for SAAC. DO NOT share your cert.pem and key.pem to others.*      

Place `cert.pem` and `key.pem` to `html` folder and restart SAA, then navigate to `https://127.0.0.1:58189/` or connect from other computer via HTTPS. Otherwise SAA will run in HTTP fallback mode.       

Generate self-signed certificates:    
```
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```


