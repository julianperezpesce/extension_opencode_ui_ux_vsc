# Tests - OpenCode DragonFu

Este directorio contiene las pruebas automatizadas para la extensión OpenCode DragonFu.

## Estructura

```
src/test/
├── runTest.ts           # Entry point para ejecutar tests
├── suite/
│   ├── index.ts         # Configuración del test runner
│   ├── extension.test.ts # Tests básicos de la extensión
│   └── slashCommands.unit.test.ts # Tests de comandos slash
```

## Tipos de Tests

### Tests Unitarios
Ubicados en `slashCommands.unit.test.ts`:
- ✅ Parsing de comandos slash (`/explain`, `/fix`, `/test`)
- ✅ Construcción de prompts
- ✅ Manejo de eventos del stream (delta como string vs objeto)
- ✅ Detección de archivos grandes
- ✅ Lógica de botones de comandos

### Tests de Integración
- `extension.test.ts` - Tests básicos de activación
- `webviewIntegration.test.ts` - Tests del webview
- `backendIntegration.test.ts` - Tests del backend
- `endToEndIntegration.test.ts` - Tests end-to-end

## Ejecución

### Ejecutar todas las pruebas
```bash
npm test
```

### Ejecutar pruebas unitarias específicas
```bash
./scripts/run-tests.sh --slash
```

### Ejecutar en modo watch
```bash
./scripts/run-tests.sh --watch
```

### Ejecutar con cobertura
```bash
./scripts/run-tests.sh --coverage
```

## Tests de Slash Commands

Los tests verifican:

1. **Parsing de Comandos**
   - `/explain this code` → `{command: "explain", args: "this code"}`
   - `/fix` → `{command: "fix", args: undefined}`
   - `/TEST function` → `{command: "test", args: "function"}` (case insensitive)

2. **Construcción de Prompts**
   - `/explain` → "Explica el siguiente código:..."
   - `/fix` → "Encuentra y corrige los errores..."
   - `/test` → "Genera tests unitarios..."

3. **Manejo de Delta (Bug Crítico Fixed)**
   - Delta como string: `" incremental text"`
   - Delta como objeto: `{text: " incremental text"}`
   - Fallback a part.text

4. **Archivos Grandes**
   - >50,000 chars = grande (muestra diálogo)
   - <50,000 chars = normal (envía directo)

## Agregar Nuevos Tests

Para agregar tests unitarios:

```typescript
suite("Mi Nueva Funcionalidad", () => {
  test("debería hacer algo", () => {
    const resultado = miFuncion("input")
    assert.strictEqual(resultado, "output esperado")
  })
})
```

## Troubleshooting

### Error: "Cannot find name 'document'"
Los tests de webview necesitan el DOM. Usa `slashCommands.unit.test.ts` como ejemplo de tests que no requieren DOM.

### Tests fallan por backend no disponible
Los tests de integración requieren el backend corriendo:
```bash
opencode serve
```

### Compilación falla
```bash
npm run compile
```
