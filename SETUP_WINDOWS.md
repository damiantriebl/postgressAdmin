# 🚀 Configuración para Windows - PostgreSQL Query Tool

## ❌ Problema Actual
El proyecto no puede compilar porque falta el linker de Visual Studio (`link.exe`).

## ✅ Solución Rápida

### Opción 1: Instalar Visual Studio Build Tools (Recomendado)
1. Descarga **Visual Studio Build Tools 2022**: https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Ejecuta el instalador
3. Selecciona **"C++ build tools"**
4. En la pestaña "Individual components", asegúrate de tener:
   - ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools
   - ✅ Windows 10/11 SDK (latest version)
5. Instala y reinicia tu terminal

### Opción 2: Instalar Visual Studio Community (Más completo)
1. Descarga **Visual Studio Community 2022**: https://visualstudio.microsoft.com/vs/community/
2. Durante la instalación, selecciona:
   - ✅ Desktop development with C++
3. Instala y reinicia

## 🔧 Verificar Instalación
Después de instalar, abre una nueva terminal y ejecuta:
```bash
# Verificar que el compilador esté disponible
where link.exe

# Debería mostrar algo como:
# C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.xx.xxxxx\bin\Hostx64\x64\link.exe
```

## 🚀 Ejecutar la Aplicación
Una vez instalado Visual Studio Build Tools:

```bash
# Instalar dependencias de Node.js
npm install

# Ejecutar en modo desarrollo
npm run tauri dev
```

## 📱 Lo que verás
- ✅ Interfaz moderna con Tailwind CSS
- ✅ Navegación por pestañas (Connection, Query, Schema)
- ✅ Comunicación funcional entre React y Rust
- ✅ Indicador de estado de conexión
- ✅ Base sólida para agregar PostgreSQL

## 🔄 Próximos Pasos
Una vez que la aplicación funcione, podremos continuar con:
- **Tarea 2.1**: Implementar conexión real a PostgreSQL
- **Tarea 2.2**: Agregar formulario de configuración
- **Tarea 3.1**: Editor de consultas SQL

## 🆘 Si Sigues Teniendo Problemas
1. Reinicia completamente tu terminal/PowerShell
2. Verifica que tengas Rust instalado: `rustc --version`
3. Verifica que tengas Node.js: `node --version`
4. Si persiste, prueba: `rustup update`

## 💡 Alternativa Temporal
Si no puedes instalar Visual Studio ahora, puedes:
1. Desarrollar solo el frontend: `npm run dev`
2. Ver la interfaz en http://localhost:1420
3. Instalar las herramientas más tarde para el backend