// ── LTN polygon geometry / history helpers ───────────────────────────────
// Extracted from useLtnLayer.ts (pure geometry diffing, no closures).

export const getPolygonHistoryFeature = (polygon: any, defaultColour: string) => {
    const feature = polygon.toGeoJSON() as any;
    feature.properties = feature.properties ?? {};
    feature.properties.label = polygon['properties']?.label ?? '';
    feature.properties.color = polygon.options?.color ?? defaultColour;
    feature.properties.historyId = polygon['properties']?.historyId ?? '';
    return feature;
};

type PolygonPointChange =
    | {
          type: 'update';
          ringIndex: number;
          pointIndex: number;
          before: number[];
          after: number[];
      }
    | {
          type: 'insert';
          ringIndex: number;
          pointIndex: number;
          after: number[];
      }
    | {
          type: 'delete';
          ringIndex: number;
          pointIndex: number;
          before: number[];
      };

export const buildPolygonPointChanges = (
    beforeCoordinates: number[][][],
    afterCoordinates: number[][][]
) => {
    if (beforeCoordinates.length !== afterCoordinates.length) {
        return null;
    }

    const pointChanges = beforeCoordinates.flatMap((beforeRing, ringIndex) => {
        const afterRing = afterCoordinates[ringIndex];
        if (!Array.isArray(afterRing)) {
            return [];
        }

        let prefix = 0;
        while (
            prefix < beforeRing.length &&
            prefix < afterRing.length &&
            beforeRing[prefix][0] === afterRing[prefix][0] &&
            beforeRing[prefix][1] === afterRing[prefix][1]
        ) {
            prefix++;
        }

        let suffix = 0;
        while (
            suffix < beforeRing.length - prefix &&
            suffix < afterRing.length - prefix &&
            beforeRing[beforeRing.length - 1 - suffix][0] ===
                afterRing[afterRing.length - 1 - suffix][0] &&
            beforeRing[beforeRing.length - 1 - suffix][1] ===
                afterRing[afterRing.length - 1 - suffix][1]
        ) {
            suffix++;
        }

        const beforeMiddle = beforeRing.slice(prefix, beforeRing.length - suffix);
        const afterMiddle = afterRing.slice(prefix, afterRing.length - suffix);
        const ringChanges: PolygonPointChange[] = [];
        const sharedLength = Math.min(beforeMiddle.length, afterMiddle.length);

        for (let pointIndex = 0; pointIndex < sharedLength; pointIndex++) {
            const beforePoint = beforeMiddle[pointIndex];
            const afterPoint = afterMiddle[pointIndex];
            if (!Array.isArray(afterPoint) || beforePoint.length !== 2 || afterPoint.length !== 2) {
                return [];
            }

            if (beforePoint[0] === afterPoint[0] && beforePoint[1] === afterPoint[1]) {
                continue;
            }

            ringChanges.push({
                type: 'update',
                ringIndex,
                pointIndex: prefix + pointIndex,
                before: [beforePoint[0], beforePoint[1]],
                after: [afterPoint[0], afterPoint[1]]
            });
        }

        if (beforeMiddle.length > afterMiddle.length) {
            for (let pointIndex = sharedLength; pointIndex < beforeMiddle.length; pointIndex++) {
                const beforePoint = beforeMiddle[pointIndex];
                if (beforePoint.length !== 2) {
                    return [];
                }

                ringChanges.push({
                    type: 'delete',
                    ringIndex,
                    pointIndex: prefix + sharedLength,
                    before: [beforePoint[0], beforePoint[1]]
                });
            }
        } else if (afterMiddle.length > beforeMiddle.length) {
            for (let pointIndex = sharedLength; pointIndex < afterMiddle.length; pointIndex++) {
                const afterPoint = afterMiddle[pointIndex];
                if (!Array.isArray(afterPoint) || afterPoint.length !== 2) {
                    return [];
                }

                ringChanges.push({
                    type: 'insert',
                    ringIndex,
                    pointIndex: prefix + pointIndex,
                    after: [afterPoint[0], afterPoint[1]]
                });
            }
        }

        return ringChanges;
    });

    return pointChanges.length > 0 ? pointChanges : null;
};

export const getPolygonMutationPayload = (
    beforeFeature: any,
    afterFeature: any,
    defaultColour: string
) => {
    const beforeCoordinates = beforeFeature?.geometry?.coordinates ?? [];
    const afterCoordinates = afterFeature?.geometry?.coordinates ?? [];
    const pointChanges = buildPolygonPointChanges(beforeCoordinates, afterCoordinates);

    return {
        historyId:
            afterFeature?.properties?.historyId ?? beforeFeature?.properties?.historyId ?? '',
        ...(pointChanges
            ? { pointChanges }
            : {
                  beforeCoordinates,
                  afterCoordinates
              }),
        beforeLabel: beforeFeature?.properties?.label ?? '',
        afterLabel: afterFeature?.properties?.label ?? '',
        beforeColor: beforeFeature?.properties?.color ?? defaultColour,
        afterColor: afterFeature?.properties?.color ?? defaultColour
    };
};
