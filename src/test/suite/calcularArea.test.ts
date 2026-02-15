import * as assert from "assert"

interface Rectangulo {
    width: number;
    height: number;
}

function calcularArea(rectangulo: Rectangulo | undefined | null): number {
    if (!rectangulo) {
        throw new Error("Rectángulo no puede ser null o undefined");
    }
    if (rectangulo.width < 0 || rectangulo.height < 0) {
        throw new Error("Las dimensiones no pueden ser negativas");
    }
    return rectangulo.width * rectangulo.height;
}

suite("calcularArea Function Test Suite", () => {
    test("Should calculate area correctly for positive dimensions", () => {
        const rectangulo = { width: 5, height: 3 };
        const resultado = calcularArea(rectangulo);
        assert.strictEqual(resultado, 15, "Area should be width * height");
    });

    test("Should return 0 when width is 0", () => {
        const rectangulo = { width: 0, height: 10 };
        const resultado = calcularArea(rectangulo);
        assert.strictEqual(resultado, 0, "Area should be 0 when width is 0");
    });

    test("Should return 0 when height is 0", () => {
        const rectangulo = { width: 10, height: 0 };
        const resultado = calcularArea(rectangulo);
        assert.strictEqual(resultado, 0, "Area should be 0 when height is 0");
    });

    test("Should return 0 when both dimensions are 0", () => {
        const rectangulo = { width: 0, height: 0 };
        const resultado = calcularArea(rectangulo);
        assert.strictEqual(resultado, 0, "Area should be 0 when both are 0");
    });

    test("Should handle decimal dimensions", () => {
        const rectangulo = { width: 2.5, height: 4.2 };
        const resultado = calcularArea(rectangulo);
        assert.strictEqual(resultado, 10.5, "Area should handle decimals correctly");
    });

    test("Should handle large numbers", () => {
        const rectangulo = { width: 1000000, height: 5000000 };
        const resultado = calcularArea(rectangulo);
        assert.strictEqual(resultado, 5000000000000, "Area should handle large numbers");
    });

    test("Should throw error when rectangulo is undefined", () => {
        assert.throws(
            () => calcularArea(undefined as any),
            Error,
            "Should throw when rectangulo is undefined"
        );
    });

    test("Should throw error when rectangulo is null", () => {
        assert.throws(
            () => calcularArea(null as any),
            Error,
            "Should throw when rectangulo is null"
        );
    });

    test("Should throw error when width is negative", () => {
        assert.throws(
            () => calcularArea({ width: -5, height: 10 }),
            Error,
            "Should throw when width is negative"
        );
    });

    test("Should throw error when height is negative", () => {
        assert.throws(
            () => calcularArea({ width: 5, height: -10 }),
            Error,
            "Should throw when height is negative"
        );
    });
})
