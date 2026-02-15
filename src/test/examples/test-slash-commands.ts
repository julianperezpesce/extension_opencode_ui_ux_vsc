/**
 * Archivo de ejemplo para probar los comandos slash de OpenCode DragonFu
 * 
 * Instrucciones:
 * 1. Abre este archivo en VS Code
 * 2. Inicia el debugger (F5)
 * 3. Selecciona código y usa los botones:
 *    - 💡 Explain: Explica qué hace el código
 *    - 🔧 Fix: Encuentra y corrige errores
 *    - 🧪 Test: Genera tests unitarios
 * 
 * O escribe en el chat:
 *    - /explain - Explica el código seleccionado
 *    - /fix - Corrige errores en el código seleccionado
 *    - /test - Genera tests para el código seleccionado
 */

// ============================================================================
// EJEMPLO 1: Función simple para explicar
// ============================================================================

/**
 * Calcula el factorial de un número
 * @param n - Número entero positivo
 * @returns El factorial de n
 */
function factorial(n: number): number {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

// ============================================================================
// EJEMPLO 2: Código con errores para corregir
// ============================================================================

// ERROR 1: Variable no definida
function calcularArea(rectangulo: any) {
    // @ts-ignore - error intencional para probar /fix
    return rectangulo.width * heigth; // Error: 'heigth' no existe
}

// ERROR 2: Retorno incorrecto
function dividir(a: number, b: number): number {
    if (b === 0) {
        // @ts-ignore - error intencional para probar /fix
        return "Error: división por cero"; // Error: retorna string en vez de number
    }
    return a / b;
}

// ERROR 3: Loop infinito
function contarHasta(n: number): number[] {
    const numeros: number[] = [];
    let i = 0;
    while (i < n) {
        numeros.push(i);
        // Error: falta i++
    }
    return numeros;
}

// ============================================================================
// EJEMPLO 3: Función que necesita tests
// ============================================================================

/**
 * Valida si un email es válido
 * @param email - Dirección de email a validar
 * @returns true si es válido, false si no
 */
function validarEmail(email: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Calcula el promedio de un array de números
 * @param numeros - Array de números
 * @returns El promedio o 0 si el array está vacío
 */
function calcularPromedio(numeros: number[]): number {
    if (numeros.length === 0) return 0;
    const suma = numeros.reduce((acc, val) => acc + val, 0);
    return suma / numeros.length;
}

/**
 * Formatea una fecha a formato legible
 * @param fecha - Date a formatear
 * @returns String formateado (ej: "13 de febrero de 2026")
 */
function formatearFecha(fecha: Date): string {
    const meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    
    const dia = fecha.getDate();
    const mes = meses[fecha.getMonth()];
    const anio = fecha.getFullYear();
    
    return `${dia} de ${mes} de ${anio}`;
}

// ============================================================================
// EJEMPLO 4: Clase completa
// ============================================================================

class Calculadora {
    private historial: string[] = [];
    
    sumar(a: number, b: number): number {
        const resultado = a + b;
        this.historial.push(`${a} + ${b} = ${resultado}`);
        return resultado;
    }
    
    restar(a: number, b: number): number {
        const resultado = a - b;
        this.historial.push(`${a} - ${b} = ${resultado}`);
        return resultado;
    }
    
    multiplicar(a: number, b: number): number {
        const resultado = a * b;
        this.historial.push(`${a} * ${b} = ${resultado}`);
        return resultado;
    }
    
    dividir(a: number, b: number): number | null {
        if (b === 0) {
            console.error("No se puede dividir por cero");
            return null;
        }
        const resultado = a / b;
        this.historial.push(`${a} / ${b} = ${resultado}`);
        return resultado;
    }
    
    obtenerHistorial(): string[] {
        return [...this.historial];
    }
    
    limpiarHistorial(): void {
        this.historial = [];
    }
}

// ============================================================================
// INSTRUCCIONES DE USO
// ============================================================================

/*
PARA PROBAR /explain:
1. Selecciona la función 'factorial' (líneas 21-24)
2. Click en botón "Explain" o escribe /explain
3. Debería explicar qué hace la recursión

PARA PROBAR /fix:
1. Selecciona la función 'calcularArea' (líneas 31-33)
2. Click en botón "Fix" o escribe /fix
3. Debería detectar 'heigth' vs 'height'

PARA PROBAR /test:
1. Selecciona la función 'validarEmail' (líneas 65-68)
2. Click en botón "Test" o escribe /test
3. Debería generar casos de prueba
*/

export {
    factorial,
    calcularArea,
    dividir,
    contarHasta,
    validarEmail,
    calcularPromedio,
    formatearFecha,
    Calculadora
};
