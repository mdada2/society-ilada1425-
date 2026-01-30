@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
gradlew.bat clean assembleRelease --no-daemon --warning-mode all
