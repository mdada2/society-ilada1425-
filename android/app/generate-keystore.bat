@echo off
"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore society-ilada-release.keystore -alias society-ilada-key -keyalg RSA -keysize 2048 -validity 10000 -storepass SocietyIlada@2026 -keypass SocietyIlada@2026 -dname "CN=Society Ilada, OU=Development, O=Society Ilada, L=Maharashtra, ST=Maharashtra, C=IN"
