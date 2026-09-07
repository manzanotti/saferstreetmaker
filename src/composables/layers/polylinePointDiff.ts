/**
 * Pure geometry diffing helpers for polyline/polygon "edit" mutations.
 * Extracted from polylineHelpers.ts: given the coordinates of a feature before
 * and after an edit, produce a compact list of per-vertex changes (rather than
 * recording the full before/after coordinate arrays) so history payloads stay
 * small.
 */
export function getFeatureCoordinates(feature: any): number[][] {
    const coordinates = feature?.geometry?.coordinates;
    return Array.isArray(coordinates)
        ? coordinates.map((coordinate: any) => [coordinate[0], coordinate[1]])
        : [];
}

export type PolylinePointChange =
    | {
          type: 'update';
          index: number;
          before: number[];
          after: number[];
      }
    | {
          type: 'insert';
          index: number;
          after: number[];
      }
    | {
          type: 'delete';
          index: number;
          before: number[];
      };

export function buildPolylinePointChanges(beforeCoords: number[][], afterCoords: number[][]) {
    let prefix = 0;
    while (
        prefix < beforeCoords.length &&
        prefix < afterCoords.length &&
        beforeCoords[prefix][0] === afterCoords[prefix][0] &&
        beforeCoords[prefix][1] === afterCoords[prefix][1]
    ) {
        prefix++;
    }

    let suffix = 0;
    while (
        suffix < beforeCoords.length - prefix &&
        suffix < afterCoords.length - prefix &&
        beforeCoords[beforeCoords.length - 1 - suffix][0] ===
            afterCoords[afterCoords.length - 1 - suffix][0] &&
        beforeCoords[beforeCoords.length - 1 - suffix][1] ===
            afterCoords[afterCoords.length - 1 - suffix][1]
    ) {
        suffix++;
    }

    const beforeMiddle = beforeCoords.slice(prefix, beforeCoords.length - suffix);
    const afterMiddle = afterCoords.slice(prefix, afterCoords.length - suffix);
    const pointChanges: PolylinePointChange[] = [];

    const sharedLength = Math.min(beforeMiddle.length, afterMiddle.length);
    for (let index = 0; index < sharedLength; index++) {
        const beforePoint = beforeMiddle[index];
        const afterPoint = afterMiddle[index];
        if (!Array.isArray(afterPoint) || beforePoint.length !== 2 || afterPoint.length !== 2) {
            return null;
        }

        if (beforePoint[0] === afterPoint[0] && beforePoint[1] === afterPoint[1]) {
            continue;
        }

        pointChanges.push({
            type: 'update',
            index: prefix + index,
            before: [beforePoint[0], beforePoint[1]],
            after: [afterPoint[0], afterPoint[1]]
        });
    }

    if (beforeMiddle.length > afterMiddle.length) {
        for (let index = sharedLength; index < beforeMiddle.length; index++) {
            const beforePoint = beforeMiddle[index];
            if (beforePoint.length !== 2) {
                return null;
            }

            pointChanges.push({
                type: 'delete',
                index: prefix + sharedLength,
                before: [beforePoint[0], beforePoint[1]]
            });
        }
    } else if (afterMiddle.length > beforeMiddle.length) {
        for (let index = sharedLength; index < afterMiddle.length; index++) {
            const afterPoint = afterMiddle[index];
            if (!Array.isArray(afterPoint) || afterPoint.length !== 2) {
                return null;
            }

            pointChanges.push({
                type: 'insert',
                index: prefix + index,
                after: [afterPoint[0], afterPoint[1]]
            });
        }
    }

    return pointChanges.length > 0 ? pointChanges : null;
}
