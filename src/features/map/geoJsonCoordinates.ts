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

export function isLinearRing(value: unknown): value is GeoJSON.Position[] {
    if (!isPositionArray(value, 4)) {
        return false;
    }
    const first = value[0];
    const last = value[value.length - 1];
    return (
        first.length === last.length &&
        first.every((coordinate, index) => coordinate === last[index])
    );
}
