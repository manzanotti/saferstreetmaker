export function isPosition(value: unknown): value is GeoJSON.Position {
    return (
        Array.isArray(value) &&
        value.length >= 2 &&
        value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
    );
}

export function isPositionArray(
    value: unknown,
    minimumLength: number
): value is GeoJSON.Position[] {
    return Array.isArray(value) && value.length >= minimumLength && value.every(isPosition);
}
