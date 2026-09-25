function toLocalSvgPoint(path: SVGGeometryElement, clientX: number, clientY: number) {
    const svg = path.ownerSVGElement;
    const matrix = path.getScreenCTM();
    if (!svg || !matrix) {
        return null;
    }

    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(matrix.inverse());
}

export function isHoveringPolygonStroke(
    element: Element,
    clientX: number,
    clientY: number
): boolean {
    if (!(element instanceof SVGGeometryElement) || !('isPointInStroke' in element)) {
        return false;
    }

    const localPoint = toLocalSvgPoint(element, clientX, clientY);
    if (!localPoint) {
        return false;
    }

    return element.isPointInStroke(localPoint);
}

export function isHoveringPolygonFill(element: Element, clientX: number, clientY: number): boolean {
    if (!(element instanceof SVGGeometryElement) || !('isPointInFill' in element)) {
        return false;
    }

    const localPoint = toLocalSvgPoint(element, clientX, clientY);
    if (!localPoint) {
        return false;
    }

    return element.isPointInFill(localPoint);
}
