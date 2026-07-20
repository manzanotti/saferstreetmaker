import * as L from 'leaflet';

function clipSegmentParams(
    start: L.LatLng,
    end: L.LatLng,
    bounds: L.LatLngBounds
): [number, number] | null {
    const deltaLng = end.lng - start.lng;
    const deltaLat = end.lat - start.lat;
    const p = [-deltaLng, deltaLng, -deltaLat, deltaLat];
    const q = [
        start.lng - bounds.getWest(),
        bounds.getEast() - start.lng,
        start.lat - bounds.getSouth(),
        bounds.getNorth() - start.lat
    ];

    let enter = 0;
    let exit = 1;

    for (let index = 0; index < p.length; index++) {
        if (p[index] === 0) {
            if (q[index] < 0) {
                return null;
            }
            continue;
        }

        const ratio = q[index] / p[index];
        if (p[index] < 0) {
            if (ratio > exit) {
                return null;
            }
            enter = Math.max(enter, ratio);
        } else {
            if (ratio < enter) {
                return null;
            }
            exit = Math.min(exit, ratio);
        }
    }

    return [enter, exit];
}

function interpolate(start: L.LatLng, end: L.LatLng, ratio: number): L.LatLng {
    return new L.LatLng(
        start.lat + (end.lat - start.lat) * ratio,
        start.lng + (end.lng - start.lng) * ratio
    );
}

function buildRuns(
    allLatLngs: L.LatLng[],
    selectedSet: Set<L.LatLng>,
    bounds: L.LatLngBounds,
    selected: boolean
): L.LatLng[][] {
    const matchesRun = allLatLngs.map((latLng) => selectedSet.has(latLng) === selected);
    const runs: L.LatLng[][] = [];

    let index = 0;
    while (index < allLatLngs.length) {
        if (!matchesRun[index]) {
            index++;
            continue;
        }

        let endIndex = index;
        while (endIndex + 1 < allLatLngs.length && matchesRun[endIndex + 1]) {
            endIndex++;
        }

        const run: L.LatLng[] = [];
        if (index > 0) {
            const params = clipSegmentParams(allLatLngs[index - 1], allLatLngs[index], bounds);
            const ratio = selected ? params?.[0] : params?.[1];
            if (ratio !== undefined && ratio > 0 && ratio < 1) {
                run.push(interpolate(allLatLngs[index - 1], allLatLngs[index], ratio));
            }
        }

        for (let pointIndex = index; pointIndex <= endIndex; pointIndex++) {
            run.push(allLatLngs[pointIndex]);
        }

        if (endIndex < allLatLngs.length - 1) {
            const params = clipSegmentParams(
                allLatLngs[endIndex],
                allLatLngs[endIndex + 1],
                bounds
            );
            const ratio = selected ? params?.[1] : params?.[0];
            if (ratio !== undefined && ratio > 0 && ratio < 1) {
                run.push(interpolate(allLatLngs[endIndex], allLatLngs[endIndex + 1], ratio));
            }
        }

        runs.push(run);
        index = endIndex + 1;
    }

    return runs;
}

export function buildClippedRuns(
    allLatLngs: L.LatLng[],
    selectedSet: Set<L.LatLng>,
    bounds: L.LatLngBounds
): L.LatLng[][] {
    return buildRuns(allLatLngs, selectedSet, bounds, true);
}

export function buildComplementRuns(
    allLatLngs: L.LatLng[],
    selectedSet: Set<L.LatLng>,
    bounds: L.LatLngBounds
): L.LatLng[][] {
    return buildRuns(allLatLngs, selectedSet, bounds, false);
}
